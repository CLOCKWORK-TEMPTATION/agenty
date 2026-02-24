import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { connectDb, coreSchemaSql } from "./index.js";

const run = async (): Promise<void> => {
  const client = await connectDb();
  try {
    await client.query("BEGIN");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(coreSchemaSql);

    const migration001Path = join(process.cwd(), "packages", "db", "migrations", "001_initial.sql");
    const migration001Sql = await readFile(migration001Path, "utf-8");
    await client.query(migration001Sql);

    const migration002Path = join(process.cwd(), "packages", "db", "migrations", "002_complete_schema.sql");
    const migration002Sql = await readFile(migration002Path, "utf-8");
    await client.query(migration002Sql);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown migration error";
  throw new Error(`Migration failed: ${message}`);
});
