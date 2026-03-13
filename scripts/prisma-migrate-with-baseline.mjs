#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function runCommand(command, { capture = false } = {}) {
  if (capture) {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  }
  execSync(command, { stdio: "inherit" });
  return "";
}

function tryMigrateDeploy() {
  try {
    runCommand("npx prisma migrate deploy");
    return { ok: true, output: "" };
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    return { ok: false, output: `${stdout}\n${stderr}` };
  }
}

function resolveAllMigrationsAsApplied() {
  const migrationsDir = path.resolve("prisma/migrations");
  const migrationNames = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrationNames) {
    const command = `npx prisma migrate resolve --applied "${migrationName}"`;
    const result = (() => {
      try {
        runCommand(command, { capture: true });
        return { ok: true, output: "" };
      } catch (error) {
        const stdout = typeof error.stdout === "string" ? error.stdout : "";
        const stderr = typeof error.stderr === "string" ? error.stderr : "";
        return { ok: false, output: `${stdout}\n${stderr}` };
      }
    })();

    if (!result.ok) {
      const normalized = result.output.toLowerCase();
      if (!normalized.includes("already")) {
        process.stderr.write(result.output);
        process.exit(1);
      }
    }
  }
}

const firstAttempt = tryMigrateDeploy();
if (firstAttempt.ok) {
  process.exit(0);
}

if (!firstAttempt.output.includes("P3005")) {
  process.stderr.write(firstAttempt.output);
  process.exit(1);
}

console.log("Detected Prisma P3005 (non-empty DB without migration baseline). Baseline-resolving existing migrations.");
resolveAllMigrationsAsApplied();

const secondAttempt = tryMigrateDeploy();
if (!secondAttempt.ok) {
  process.stderr.write(secondAttempt.output);
  process.exit(1);
}
