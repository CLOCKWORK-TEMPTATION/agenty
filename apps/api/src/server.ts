import { buildApp } from "./app.js";

const start = async (): Promise<void> => {
  const app = await buildApp({ logger: true });
  const host = "0.0.0.0";
  const port = Number(process.env.API_PORT ?? 4000);

  await app.listen({ host, port });
};

start().catch((error: unknown) => {
  if (error instanceof Error) {
    throw new Error(`API startup failed: ${error.message}`);
  }
  throw new Error("API startup failed: unknown error");
});
