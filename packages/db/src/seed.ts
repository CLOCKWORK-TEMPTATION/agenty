import { connectDb } from "./index.js";

const run = async (): Promise<void> => {
  const client = await connectDb();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO users (id, email) VALUES ('user-seed', 'seed@example.com') ON CONFLICT (id) DO NOTHING`
    );
    await client.query(
      `INSERT INTO projects (id, name) VALUES ('project-seed', 'Seed Project') ON CONFLICT (id) DO NOTHING`
    );
    await client.query(
      `INSERT INTO templates (id, name, version, body)
       VALUES ('template-coding', 'Coding Default', '1.0.0', '{"roles": ["planner", "verifier"]}'::jsonb)
       ON CONFLICT (id) DO NOTHING`
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown seed error";
  throw new Error(`Seed failed: ${message}`);
});
