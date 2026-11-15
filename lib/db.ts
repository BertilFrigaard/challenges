import { Pool } from "pg";

// Reuse a single pool across hot reloads in development, so each edit
// doesn't open a fresh set of connections to Postgres.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

// An idle client erroring (e.g. Postgres restarting) must not crash the server.
pool.on("error", (err) => {
  console.error("Postgres pool error:", err.message);
});

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;
