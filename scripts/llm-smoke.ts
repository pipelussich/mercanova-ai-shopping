/**
 * Smoke test contra Gemini real: tool calling multi-paso + streaming con el provider configurado.
 * Uso: npm run llm:smoke
 */
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { getEnv } from "../src/env";
import { GOOGLE_PROVIDER_OPTIONS, withModelFallback } from "../src/ai/provider";

async function main() {
  const env = getEnv();
  console.log(`Modelos: ${env.GEMINI_CHAT_MODEL} → ${env.GEMINI_FALLBACK_MODEL}`);
  const started = Date.now();
  const { text, toolCalls, modelId } = await withModelFallback(async (model) => {
    const result = streamText({
      model,
      providerOptions: GOOGLE_PROVIDER_OPTIONS,
      stopWhen: stepCountIs(3),
      tools: {
        get_price: tool({
          description: "Returns the current price in USD of a product by id.",
          inputSchema: z.object({ productId: z.string() }),
          execute: async ({ productId }) => ({ productId, priceUsd: 468.62 }),
        }),
      },
      prompt: "¿Cuánto sale el producto MN-MON-0001? Usá la herramienta y respondé en una frase en español.",
    });
    let streamed = "";
    for await (const delta of result.textStream) streamed += delta;
    const steps = await result.steps;
    return {
      text: streamed,
      toolCalls: steps.flatMap((s) => s.toolCalls.map((c) => c.toolName)),
      modelId: (await result.response).modelId,
    };
  });
  console.log(`Modelo usado: ${modelId} (${Date.now() - started} ms)`);
  console.log(`Tools llamadas: ${toolCalls.join(", ") || "ninguna"}`);
  console.log(`Respuesta: ${text}`);
  if (!toolCalls.includes("get_price") || !text.trim()) process.exit(2);
}

main().catch((err) => {
  console.error("Smoke falló:", err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exit(1);
});
