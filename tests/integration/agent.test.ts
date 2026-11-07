import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { APICallError, type UIMessage, type UIMessageChunk } from "ai";
import { convertArrayToReadableStream, convertReadableStreamToArray, MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { createAgentStream } from "@/ai/agent";
import { loadMessages, saveMessages } from "@/server/chat/chat-repo";
import { resetOperationalState } from "@/server/seed/import-dataset";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";

const { db, close } = createDb(testDatabaseUrl());
const failingEmbed = async () => {
  throw new Error("sin embeddings");
};

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function toolCallStream(toolName: string, input: unknown) {
  return {
    stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: "call-1", toolName, input: JSON.stringify(input) },
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
    ]),
  };
}

function textStream(text: string) {
  return {
    stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: text },
      { type: "text-end", id: "t1" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
    ]),
  };
}

const userMessage = (text: string): UIMessage => ({
  id: randomUUID(),
  role: "user",
  parts: [{ type: "text", text }],
});

async function run(models: MockLanguageModelV4[], text = "Busco auriculares") {
  const session = randomUUID();
  const chunks = (await convertReadableStreamToArray(
    createAgentStream({
      db,
      sessionId: session,
      messages: [userMessage(text)],
      embedQuery: failingEmbed,
      models,
      maxRetries: 0,
      retryDelayMs: 0,
    }),
  )) as UIMessageChunk[];
  return { session, chunks };
}

beforeEach(async () => resetOperationalState(db, DATASET_PATH));
afterAll(async () => close());

describe("agente", () => {
  it("usa las tools sobre datos reales y responde en varios pasos", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCallStream("search_products", { query: "headphones", maxPriceUsd: 200 }),
        textStream("Te recomiendo…"),
      ],
    });
    const { chunks } = await run([model]);
    const output = chunks.find((c) => c.type === "tool-output-available") as
      { output: { results: { priceUsd: number; category: string }[] } } | undefined;
    expect(output?.output.results.length).toBeGreaterThan(0);
    expect(output!.output.results.every((r) => r.priceUsd <= 200)).toBe(true);
    expect(chunks.some((c) => c.type === "text-delta" && c.delta === "Te recomiendo…")).toBe(true);
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it("no puede registrar compras aunque el modelo lo intente", async () => {
    const model = new MockLanguageModelV4({
      doStream: [toolCallStream("place_order", { confirm: true }), textStream("No puedo comprar por vos.")],
    });
    await run([model], "Comprámelo ya");
    const [{ n }] = await db.execute<{ n: string }>(sql`select count(*) as n from orders`);
    expect(Number(n)).toBe(0);
  });

  it("cambia al modelo de respaldo si el principal está saturado", async () => {
    const saturated = new MockLanguageModelV4({
      doStream: async () => {
        throw new APICallError({
          message: "Resource exhausted",
          url: "https://example.test",
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: true,
        });
      },
    });
    const backup = new MockLanguageModelV4({ doStream: [textStream("Hola, ¿qué estás buscando?")] });
    const { chunks } = await run([saturated, backup], "Hola");
    expect(chunks.some((c) => c.type === "text-delta" && c.delta.includes("Hola"))).toBe(true);
    expect(chunks.some((c) => c.type === "error")).toBe(false);
  });

  it("si el modelo principal no responde, corta por timeout y usa el de respaldo", async () => {
    const hanging = new MockLanguageModelV4({
      doStream: ({ abortSignal }) =>
        new Promise((_, reject) => abortSignal?.addEventListener("abort", () => reject(abortSignal.reason))),
    });
    const backup = new MockLanguageModelV4({ doStream: [textStream("Respuesta del respaldo")] });
    const t0 = Date.now();
    const session = randomUUID();
    const chunks = (await convertReadableStreamToArray(
      createAgentStream({
        db,
        sessionId: session,
        messages: [userMessage("Hola")],
        embedQuery: failingEmbed,
        models: [hanging, backup],
        maxRetries: 0,
        retryDelayMs: 0,
        firstContentTimeoutMs: 200,
      }),
    )) as UIMessageChunk[];
    expect(Date.now() - t0).toBeLessThan(5_000);
    expect(chunks.some((c) => c.type === "text-delta" && c.delta === "Respuesta del respaldo")).toBe(true);
  });

  it("si todos los modelos fallan, emite un error claro en español", async () => {
    const down = new MockLanguageModelV4({
      doStream: async () => {
        throw new APICallError({
          message: "unavailable",
          url: "https://example.test",
          requestBodyValues: {},
          statusCode: 503,
          isRetryable: true,
        });
      },
    });
    const { chunks } = await run([down, down]);
    const err = chunks.find((c) => c.type === "error") as { errorText: string } | undefined;
    expect(err?.errorText).toMatch(/mucha demanda/);
  });
});

describe("historial del chat", () => {
  it("una sesión no puede sobrescribir mensajes de otra reutilizando el id", async () => {
    const victim = randomUUID();
    const attacker = randomUUID();
    const original: UIMessage = { id: randomUUID(), role: "user", parts: [{ type: "text", text: "mensaje original" }] };
    await saveMessages(db, victim, [original]);
    await saveMessages(db, attacker, [{ ...original, parts: [{ type: "text", text: "pisado" }] }]);
    expect(await loadMessages(db, victim)).toEqual([original]);
  });

  it("guarda y recupera la conversación de la sesión", async () => {
    const session = randomUUID();
    const msgs: UIMessage[] = [
      userMessage("hola"),
      { id: randomUUID(), role: "assistant", parts: [{ type: "text", text: "¡Hola!" }] },
    ];
    await saveMessages(db, session, msgs);
    await saveMessages(db, session, msgs); // idempotente
    expect(await loadMessages(db, session)).toEqual(msgs);
    expect(await loadMessages(db, randomUUID())).toEqual([]);
  });
});
