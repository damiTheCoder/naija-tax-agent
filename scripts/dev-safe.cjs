#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { existsSync, readFileSync, rmSync, unlinkSync } = require("fs");
const { join } = require("path");
const { execSync, spawn } = require("child_process");
const http = require("http");
const https = require("https");
const dotenv = require("dotenv");

const projectDir = process.cwd();
const lockPath = join(projectDir, ".next", "dev", "lock");
const devServerPath = join(projectDir, ".next", "dev", "server");
const isVerbose = process.env.DEV_SAFE_VERBOSE === "1";
const LOCAL_POCKETBASE_BINARY = join(projectDir, ".tools", "pocketbase", "0.35.1", "pocketbase");
const DEFAULT_POCKETBASE_URL = "http://127.0.0.1:8090";
const DEV_ENV_FILES = [".env.development.local", ".env.local", ".env.development", ".env"];

function logVerbose(message) {
  if (isVerbose) {
    console.log(message);
  }
}

function readEnvFileValues() {
  const values = {};

  for (const fileName of DEV_ENV_FILES) {
    const filePath = join(projectDir, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    try {
      const parsed = dotenv.parse(readFileSync(filePath, "utf8"));
      Object.assign(values, parsed, values);
    } catch (error) {
      console.warn(`[dev] Warning: unable to parse ${fileName} (${error.message})`);
    }
  }

  return values;
}

function resolvePocketBaseUrl() {
  const envFileValues = readEnvFileValues();
  return (
    process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    envFileValues.POCKETBASE_URL ||
    envFileValues.NEXT_PUBLIC_POCKETBASE_URL ||
    DEFAULT_POCKETBASE_URL
  );
}

function isLoopbackPocketBase(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function checkPocketBaseHealth(urlString) {
  return new Promise((resolve) => {
    let url;

    try {
      url = new URL("/api/health", urlString);
    } catch {
      resolve({ ok: false, reason: "invalid_url" });
      return;
    }

    const client = url.protocol === "https:" ? https : http;
    const timeoutMs = Number.parseInt(process.env.DEV_SAFE_POCKETBASE_TIMEOUT_MS || "1200", 10);
    const request = client.request(
      url,
      {
        method: "GET",
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1200,
      },
      (response) => {
        const ok = typeof response.statusCode === "number" && response.statusCode >= 200 && response.statusCode < 500;
        response.resume();
        resolve({
          ok,
          reason: ok ? null : `http_${response.statusCode || "unknown"}`,
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        reason: error.code || error.message || "unreachable",
      });
    });

    request.end();
  });
}

async function warnIfPocketBaseIsDown() {
  if (process.env.DEV_SAFE_SKIP_POCKETBASE_PREFLIGHT === "1") {
    return;
  }

  const pocketBaseUrl = resolvePocketBaseUrl();
  const result = await checkPocketBaseHealth(pocketBaseUrl);
  if (result.ok) {
    logVerbose(`[dev] PocketBase reachable at ${pocketBaseUrl}`);
    return;
  }

  console.warn(
    `[dev] Warning: PocketBase at ${pocketBaseUrl} is not reachable (${result.reason || "unreachable"}). Admin auth/support features will fail until it starts.`
  );

  if (isLoopbackPocketBase(pocketBaseUrl)) {
    if (existsSync(LOCAL_POCKETBASE_BINARY)) {
      console.warn("[dev] Start it with `npm run pb:up:local`.");
    } else {
      console.warn("[dev] Start it with `npm run pb:up` or install the local PocketBase binary and use `npm run pb:up:local`.");
    }
  }
}

function getProjectCwdForPid(pid) {
  try {
    const output = execSync(`lsof -a -p ${pid} -d cwd -Fn`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const cwdLine = output
      .split("\n")
      .find((line) => line.startsWith("n"));

    if (!cwdLine) {
      return null;
    }

    return cwdLine.slice(1).trim() || null;
  } catch {
    return null;
  }
}

function findActiveNextDevProcessInProject() {
  try {
    const output = execSync("ps -eo pid=,args=", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      const firstSpace = line.indexOf(" ");
      if (firstSpace <= 0) {
        continue;
      }

      const pid = line.slice(0, firstSpace).trim();
      const command = line.slice(firstSpace + 1).trim();

      if (!pid || !command || pid === String(process.pid)) {
        continue;
      }

      const isNextDevProcess =
        command.includes("next dev") ||
        command.includes("next-server") ||
        command.includes("next/dist/bin/next");

      if (!isNextDevProcess) {
        continue;
      }

      const cwd = getProjectCwdForPid(pid);
      if (cwd && cwd === projectDir) {
        return { pid, command };
      }
    }
  } catch {
    // Fall through to cleanup/start flow.
  }

  return null;
}

function stopProcess(pid) {
  try {
    process.kill(Number(pid), "SIGTERM");
  } catch (error) {
    console.warn(`[dev] Warning: unable to stop existing dev server pid ${pid} (${error.message})`);
    return;
  }

  const waitUntil = Date.now() + 4000;
  while (Date.now() < waitUntil) {
    try {
      process.kill(Number(pid), 0);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    } catch {
      return;
    }
  }

  try {
    process.kill(Number(pid), "SIGKILL");
  } catch {
    // Ignore if process already exited.
  }
}

function clearStaleArtifacts() {
  const cleanedArtifacts = [];
  let hadLock = false;

  try {
    if (existsSync(lockPath)) {
      hadLock = true;
      unlinkSync(lockPath);
      cleanedArtifacts.push("lock");
    }
  } catch (error) {
    console.warn(`[dev] Warning: unable to clear Next.js lock (${error.message})`);
  }

  try {
    // If lock existed, assume previous shutdown was unclean and clear server cache.
    // Can also be forced with NEXT_DEV_FORCE_CLEAN=1.
    if ((hadLock || process.env.NEXT_DEV_FORCE_CLEAN === "1") && existsSync(devServerPath)) {
      rmSync(devServerPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      cleanedArtifacts.push("dev-server-dir");
    }
  } catch (error) {
    console.warn(`[dev] Warning: unable to clear Next.js dev server dir (${error.message})`);
  }

  if (cleanedArtifacts.length > 0) {
    console.log(`[dev] Cleaned stale Next.js artifacts (${cleanedArtifacts.join(", ")}).`);
    logVerbose(`[dev] lockPath=${lockPath}`);
    logVerbose(`[dev] devServerPath=${devServerPath}`);
  }
}

async function main() {
  const running = findActiveNextDevProcessInProject();
  if (running) {
    console.log(`[dev] Existing Next.js process detected (pid ${running.pid}). Restarting to load latest generated clients/code.`);
    stopProcess(running.pid);
  }

  clearStaleArtifacts();
  await warnIfPocketBaseIsDown();

  const nextBin = join(
    projectDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next"
  );

  const command = existsSync(nextBin) ? nextBin : "next";
  const child = spawn(command, ["dev", "--webpack"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code || 0);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[dev] Failed to start dev server (${error.message})`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_POCKETBASE_URL,
  LOCAL_POCKETBASE_BINARY,
  checkPocketBaseHealth,
  isLoopbackPocketBase,
  resolvePocketBaseUrl,
  warnIfPocketBaseIsDown,
};
