import { describe, expect, it } from "vitest";
import { parseEnv } from "@/env";

describe("parseEnv", () => {
  it("aplica los modelos por defecto y detecta que no hay IA sin key", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x" });
    expect(env.GEMINI_CHAT_MODEL).toBe("gemini-3.5-flash-lite");
    expect(env.GEMINI_FALLBACK_MODEL).toBe("gemini-3.1-flash-lite");
    expect(env.GEMINI_EMBEDDING_MODEL).toBe("gemini-embedding-001");
    expect(env.GEMINI_TRANSCRIBE_MODEL).toBe("gemini-3.5-transcribe");
    expect(env.hasAI).toBe(false);
  });

  it("detecta la key de Gemini", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x", GEMINI_API_KEY: "k" });
    expect(env.hasAI).toBe(true);
  });

  it("trata una key vacía como ausente", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x", GEMINI_API_KEY: "  " });
    expect(env.hasAI).toBe(false);
  });

  it("falla si falta DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
