import { readFile } from "node:fs/promises";
import pg from "pg";

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(schema);
  console.log("Database schema is up to date.");
} catch (err) {
  console.error("Schema setup failed:", (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
