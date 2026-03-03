#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { existsSync, rmSync, unlinkSync } = require("fs");
const { join } = require("path");
const { execSync, spawn } = require("child_process");

const projectDir = process.cwd();
const lockPath = join(projectDir, ".next", "dev", "lock");
const devServerPath = join(projectDir, ".next", "dev", "server");

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
  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
      console.log(`[dev] Removed stale Next.js lock at ${lockPath}`);
    }
  } catch (error) {
    console.warn(`[dev] Warning: unable to clear Next.js lock (${error.message})`);
  }

  try {
    if (existsSync(devServerPath)) {
      rmSync(devServerPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      console.log(`[dev] Cleared stale Next.js dev server dir at ${devServerPath}`);
    }
  } catch (error) {
    console.warn(`[dev] Warning: unable to clear Next.js dev server dir (${error.message})`);
  }
}

const running = findActiveNextDevProcessInProject();
if (running) {
  console.log(`[dev] Existing Next.js process detected (pid ${running.pid}). Restarting to load latest generated clients/code.`);
  stopProcess(running.pid);
}

clearStaleArtifacts();

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
