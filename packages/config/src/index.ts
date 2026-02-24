import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  WEB_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  LITELLM_API_BASE: z.string().url(),
  LITELLM_MASTER_KEY: z.string().min(1),
  LANGSMITH_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  E2B_API_KEY: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional()
});

export type Environment = z.infer<typeof envSchema>;

export const readEnv = (source: NodeJS.ProcessEnv = process.env): Environment => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issue = parsed.error.issues
      .map((item) => `${item.path.join(".")}: ${item.message}`)
      .join(", ");
    throw new Error(`Invalid environment variables: ${issue}`);
  }
  return parsed.data;
};
