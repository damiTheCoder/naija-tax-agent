#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { existsSync, unlinkSync, rmSync } = require("fs");
const { join } = require("path");
const { execSync } = require("child_process");

const lockPath = join(process.cwd(), ".next", "dev", "lock");
const devServerPath = join(process.cwd(), ".next", "dev", "server");

function hasActiveNextProcessInProject() {
  try {
    const output = execSync("lsof -a -d cwd -c node -Fnpc", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const lines = output.split("\n");
    let currentPid = "";
    let currentPath = "";
    const pidsInProject = [];

    for (const line of lines) {
      if (line.startsWith("p")) {
        currentPid = line.slice(1).trim();
      } else if (line.startsWith("n")) {
        currentPath = line.slice(1).trim();
        if (currentPid && currentPath === process.cwd()) {
          pidsInProject.push(currentPid);
        }
      }
    }

    for (const pid of pidsInProject) {
      if (!pid || pid === String(process.pid)) continue;
      try {
        const command = execSync(`ps -p ${pid} -o command=`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (command.includes("next dev") || command.includes("next-server")) {
          return true;
        }
      } catch {
        // Ignore race conditions where process exits mid-check.
      }
    }
  } catch {
    // If lsof/ps is unavailable, continue with cleanup fallback.
  }

  return false;
}

if (hasActiveNextProcessInProject()) {
  console.log("[dev] Active Next.js process detected for this project. Skipping stale cleanup.");
  process.exit(0);
}

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
    // Prevent sporadic ENOTEMPTY rmdir failures when Next.js tries to rotate dev artifacts.
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
