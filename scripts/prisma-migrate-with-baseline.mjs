#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function runPrisma(args) {
  const result = spawnSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const output = `${stdout}${stderr}`;

  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error);
    return { ok: false, output: `${output}\n${message}` };
  }

  return { ok: result.status === 0, output };
}

function tryMigrateDeploy() {
  return runPrisma(["migrate", "deploy"]);
}

function resolveAllMigrationsAsApplied() {
  const migrationsDir = path.resolve("prisma/migrations");
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const migrationNames = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrationNames) {
    const result = runPrisma(["migrate", "resolve", "--applied", migrationName]);

    if (!result.ok) {
      const normalized = result.output.toLowerCase();
      if (!normalized.includes("already") || !normalized.includes("applied")) {
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

if (!/P3005/i.test(firstAttempt.output)) {
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
