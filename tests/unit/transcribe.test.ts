import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { transcribeAudio } from "@/ai/transcribe";

describe("transcribeAudio", () => {
  it("no se cuelga si el modelo nunca responde: corta por timeout", async () => {
    process.env.DATABASE_URL ??= "postgres://test";
    const hanging = new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_, reject) => abortSignal?.addEventListener("abort", () => reject(abortSignal.reason))),
    });
    const t0 = Date.now();
    await expect(
      transcribeAudio(new Uint8Array([1, 2, 3]), "audio/wav", { models: [hanging], timeoutMs: 100 }),
    ).rejects.toBeDefined();
    expect(Date.now() - t0).toBeLessThan(3_000);
    expect(hanging.doGenerateCalls).toHaveLength(1);
    expect(hanging.doGenerateCalls[0].abortSignal?.aborted).toBe(true);
  }, 10_000);
});
