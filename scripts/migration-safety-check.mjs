#!/usr/bin/env node
import pg from 'pg';

const { Client } = pg;
const ADVISORY_LOCK_ID = 72707369;

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail("DATABASE_URL is required for migration safety checks.");
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 10000,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");

    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [ADVISORY_LOCK_ID]
    );
    const acquired = lockResult.rows?.[0]?.acquired === true;

    if (!acquired) {
      fail(
        "Migration safety check failed: advisory lock is currently held by another session. Retry later."
      );
    }

    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
    console.log("Migration safety check passed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Migration safety check failed: ${message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
