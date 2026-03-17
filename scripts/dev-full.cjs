#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { existsSync, mkdirSync } = require("fs");
const { join } = require("path");
const { spawn } = require("child_process");
const {
  LOCAL_POCKETBASE_BINARY,
  checkPocketBaseHealth,
  isLoopbackPocketBase,
  resolvePocketBaseUrl,
} = require("./dev-safe.cjs");

const projectDir = process.cwd();
const pocketBaseDataDir = join(projectDir, ".pocketbase", "pb_data");
const pocketBasePublicDir = join(projectDir, ".pocketbase", "pb_public");
const pocketBaseMigrationsDir = join(projectDir, ".pocketbase", "pb_migrations");
const waitTimeoutMs = Number.parseInt(process.env.DEV_FULL_POCKETBASE_WAIT_MS || "15000", 10);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureLocalPocketBaseDirs() {
  mkdirSync(pocketBaseDataDir, { recursive: true });
  mkdirSync(pocketBasePublicDir, { recursive: true });
  mkdirSync(pocketBaseMigrationsDir, { recursive: true });
}

function stopChild(child, signal = "SIGTERM") {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill(signal);
  } catch {
    // Ignore termination failures during shutdown.
  }
}

async function waitForPocketBase(urlString, child) {
  const timeoutAt = Date.now() + (Number.isFinite(waitTimeoutMs) && waitTimeoutMs > 0 ? waitTimeoutMs : 15000);

  while (Date.now() < timeoutAt) {
    const health = await checkPocketBaseHealth(urlString);
    if (health.ok) {
      return;
    }

    if (child && child.exitCode !== null) {
      throw new Error(`PocketBase exited before becoming healthy (exit code ${child.exitCode}).`);
    }

    await sleep(300);
  }

  throw new Error(`PocketBase did not become healthy within ${Math.max(1, Math.round((timeoutAt - (timeoutAt - waitTimeoutMs)) / 1000))}s.`);
}

function startLocalPocketBase(urlString) {
  if (!existsSync(LOCAL_POCKETBASE_BINARY)) {
    throw new Error(
      `Local PocketBase binary not found at ${LOCAL_POCKETBASE_BINARY}. Run \`npm run pb:up\` for Docker or install the local binary and retry.`
    );
  }

  ensureLocalPocketBaseDirs();
  console.log(`[dev:full] Starting local PocketBase for ${urlString}`);

  return spawn(
    LOCAL_POCKETBASE_BINARY,
    [
      "--dir",
      pocketBaseDataDir,
      "--publicDir",
      pocketBasePublicDir,
      "--migrationsDir",
      pocketBaseMigrationsDir,
      "serve",
      "--http",
      "127.0.0.1:8090",
    ],
    {
      cwd: projectDir,
      stdio: "inherit",
    }
  );
}

async function main() {
  const pocketBaseUrl = resolvePocketBaseUrl();
  const health = await checkPocketBaseHealth(pocketBaseUrl);

  let pocketBaseChild = null;
  let nextChild = null;
  let shuttingDown = false;
  let ownsPocketBase = false;

  const shutdown = (signal = "SIGTERM") => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopChild(nextChild, signal);
    if (ownsPocketBase) {
      stopChild(pocketBaseChild, signal);
    }
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => shutdown(signal));
  }

  if (health.ok) {
    console.log(`[dev:full] Using existing PocketBase at ${pocketBaseUrl}`);
  } else if (isLoopbackPocketBase(pocketBaseUrl)) {
    ownsPocketBase = true;
    pocketBaseChild = startLocalPocketBase(pocketBaseUrl);
    pocketBaseChild.on("exit", (code, signal) => {
      if (shuttingDown) {
        return;
      }

      console.error(
        `[dev:full] PocketBase exited unexpectedly${signal ? ` (signal ${signal})` : ` (code ${code ?? 0})`}.`
      );
      shutdown("SIGTERM");
    });

    await waitForPocketBase(pocketBaseUrl, pocketBaseChild);
    console.log(`[dev:full] PocketBase is ready at ${pocketBaseUrl}`);
  } else {
    throw new Error(
      `PocketBase at ${pocketBaseUrl} is not reachable, and dev:full only auto-starts loopback PocketBase instances.`
    );
  }

  const nodeBin = process.execPath;
  nextChild = spawn(nodeBin, [join(projectDir, "scripts", "dev-safe.cjs")], {
    cwd: projectDir,
    stdio: "inherit",
    env: {
      ...process.env,
      DEV_SAFE_SKIP_POCKETBASE_PREFLIGHT: "1",
    },
  });

  nextChild.on("exit", (code, signal) => {
    if (!shuttingDown) {
      shuttingDown = true;
      if (ownsPocketBase) {
        stopChild(pocketBaseChild, "SIGTERM");
      }
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code || 0);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[dev:full] Failed to start full dev stack (${error.message})`);
    process.exit(1);
  });
}
