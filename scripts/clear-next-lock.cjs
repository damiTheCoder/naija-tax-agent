#!/usr/bin/env node

const { existsSync, unlinkSync } = require("fs");
const { join } = require("path");

const lockPath = join(process.cwd(), ".next", "dev", "lock");

try {
  if (existsSync(lockPath)) {
    unlinkSync(lockPath);
    console.log(`[dev] Removed stale Next.js lock at ${lockPath}`);
  }
} catch (error) {
  console.warn(`[dev] Warning: unable to clear Next.js lock (${error.message})`);
}
