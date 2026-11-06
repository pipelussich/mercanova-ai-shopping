import { z } from "zod";

const optionalString = z
  .string()
  .transform((v) => v.trim())
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  DATABASE_URL: z.string({ error: "DATABASE_URL es obligatoria" }).min(1, "DATABASE_URL es obligatoria"),
  GEMINI_API_KEY: optionalString,
  GEMINI_CHAT_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-3.1-flash-lite"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  GEMINI_TRANSCRIBE_MODEL: z.string().default("gemini-3.5-transcribe"),
});

export type Env = z.infer<typeof envSchema> & { hasAI: boolean };

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuración inválida en: ${fields}. Revisá tu archivo .env (ver .env.example).`);
  }
  return { ...result.data, hasAI: Boolean(result.data.GEMINI_API_KEY) };
}

let cached: Env | undefined;

/** Env validado, memoizado. Lazy para que `next build` no exija variables. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export function hasAI(): boolean {
  return getEnv().hasAI;
}
