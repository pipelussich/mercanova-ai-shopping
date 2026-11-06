/**
 * Evals del asistente con Gemini real (consume cuota del free tier): `npm run evals`.
 * Corre contra db-test, un caso por vez con pausa, y escribe evals/last-report.md como evidencia.
 */
import { randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UIMessage, UIMessageChunk } from "ai";
import { sql } from "drizzle-orm";
import { createAgentStream } from "@/ai/agent";
import { embedQuery } from "@/ai/embeddings";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { importDataset, resetOperationalState } from "@/server/seed/import-dataset";
import { loadEmbeddingsIfPresent } from "@/server/seed/load-embeddings";
import { DATASET_PATH, testDatabaseUrl } from "../tests/integration/helpers";
import { buildCases, type EvalCase } from "./cases";

if (existsSync(".env")) process.loadEnvFile(".env");
process.env.DATABASE_URL = testDatabaseUrl();

const PAUSE_MS = 7_000;
const { db, close } = createDb(testDatabaseUrl());

type ToolCall = { name: string; input: unknown; output?: unknown };
type CaseRun = { id: string; tools: ToolCall[]; finalText: string; failures: string[]; ms: number };
const runs: CaseRun[] = [];
let cases: EvalCase[] = [];

async function runTurns(turns: string[]) {
  const sessionId = randomUUID();
  let history: UIMessage[] = [];
  const tools: ToolCall[] = [];
  let finalText = "";
  for (const turn of turns) {
    const messages: UIMessage[] = [
      ...history,
      { id: randomUUID(), role: "user", parts: [{ type: "text", text: turn }] },
    ];
    let finished: UIMessage[] = messages;
    const byId = new Map<string, ToolCall>();
    let text = "";
    const reader = createAgentStream({
      db,
      sessionId,
      messages,
      embedQuery,
      onFinish: (all) => {
        finished = all;
      },
    }).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const c = value as UIMessageChunk;
      if (c.type === "tool-input-available") {
        const call = { name: c.toolName, input: c.input };
        byId.set(c.toolCallId, call);
        tools.push(call);
      } else if (c.type === "tool-output-available") {
        const call = byId.get(c.toolCallId);
        if (call) call.output = c.output;
      } else if (c.type === "text-delta") text += c.delta;
      else if (c.type === "error") throw new Error(`Error del asistente: ${c.errorText}`);
    }
    history = finished;
    finalText = text;
  }
  return { sessionId, tools, finalText };
}

/** Montos en US$/USD/$ del texto, normalizando separadores ("1.234,56", "85.27", "200"). */
export function amountsIn(text: string): number[] {
  const re = /(?:US\$|USD|U\$S|\$)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
  return [...text.matchAll(re)].map((m) => {
    const raw = m[1];
    const lastSep = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
    const decimals = lastSep >= 0 ? raw.length - lastSep - 1 : 0;
    if (lastSep >= 0 && decimals <= 2)
      return Number(raw.slice(0, lastSep).replace(/[.,]/g, "") + "." + raw.slice(lastSep + 1));
    return Number(raw.replace(/[.,]/g, ""));
  });
}

function pricesFrom(value: unknown, out: number[] = []): number[] {
  if (Array.isArray(value)) value.forEach((v) => pricesFrom(v, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (/Usd$/.test(k) && typeof v === "number") out.push(v);
      else pricesFrom(v, out);
    }
  return out;
}

function productsFrom(value: unknown, out: { name: string; priceUsd: number }[] = []) {
  if (Array.isArray(value)) value.forEach((v) => productsFrom(v, out));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.name === "string" && typeof o.priceUsd === "number") out.push({ name: o.name, priceUsd: o.priceUsd });
    Object.values(o).forEach((v) => productsFrom(v, out));
  }
  return out;
}

async function evaluate(c: EvalCase, r: Awaited<ReturnType<typeof runTurns>>): Promise<string[]> {
  const failures: string[] = [];
  const called = new Set(r.tools.map((t) => t.name));
  const e = c.expect;
  for (const t of e.toolsCalled ?? []) if (!called.has(t)) failures.push(`no llamó ${t}`);
  for (const t of e.toolsNotCalled ?? []) if (called.has(t)) failures.push(`llamó ${t} y no debía`);
  if (e.askClarification) {
    if (!r.finalText.includes("?")) failures.push("no hizo una pregunta aclaratoria");
    if (called.has("search_products")) failures.push("buscó antes de aclarar");
  }
  for (const re of e.mustNotMatch ?? []) if (re.test(r.finalText)) failures.push(`el texto contiene ${re}`);
  if (e.mustMatchAny && !e.mustMatchAny.some((re) => re.test(r.finalText)))
    failures.push(`el texto no contiene ninguno de ${e.mustMatchAny.join(" | ")}`);
  if (e.pricesMustMatchDb) {
    const base = [...pricesFrom(r.tools.map((t) => t.output)), ...c.turns.flatMap(amountsIn)];
    // También se aceptan cálculos sobre precios reales (diferencias y sumas, p.ej. "una diferencia de US$ 15").
    const known = [...base, ...base.flatMap((a) => base.flatMap((b) => [Math.abs(a - b), a + b]))];
    for (const a of amountsIn(r.finalText))
      if (!known.some((k) => Math.abs(k - a) <= 0.01)) failures.push(`monto US$ ${a} no proviene de la DB`);
  }
  if (e.maxPriceUsd != null) {
    const named = productsFrom(r.tools.map((t) => t.output)).filter((p) => r.finalText.includes(p.name));
    for (const p of named) if (p.priceUsd > e.maxPriceUsd) failures.push(`recomendó ${p.name} (US$ ${p.priceUsd})`);
  }
  for (const [tool, max] of Object.entries(e.maxCalls ?? {})) {
    const n = r.tools.filter((t) => t.name === tool).length;
    if (n > max) failures.push(`llamó ${tool} ${n} veces (máx. ${max})`);
  }
  if (e.cartProductId) {
    const cart = await db.execute<{ product_id: string; quantity: number }>(
      sql`select product_id, quantity from cart_items where session_id = ${r.sessionId}`,
    );
    if (cart.length !== 1 || cart[0].product_id !== e.cartProductId || cart[0].quantity !== 1)
      failures.push(`carrito final ${JSON.stringify(cart)} (esperado 1 × ${e.cartProductId})`);
  }
  if (e.noOrders) {
    const [{ n }] = await db.execute<{ n: string }>(
      sql`select count(*) as n from orders where session_id = ${r.sessionId}`,
    );
    if (Number(n) > 0) failures.push("se creó una orden");
  }
  return failures;
}

beforeAll(async () => {
  await runMigrations(testDatabaseUrl());
  await importDataset(db, DATASET_PATH);
  await resetOperationalState(db, DATASET_PATH);
  const r = await loadEmbeddingsIfPresent(db, path.resolve("data/embeddings.json"));
  if (r.loaded === 0) throw new Error("No hay embeddings cargados: corré npm run embeddings:generate");
  cases = await buildCases(db);
}, 120_000);

afterAll(async () => {
  const passed = runs.filter((r) => r.failures.length === 0).length;
  const lines = [
    `# Evals del asistente`,
    ``,
    `Fecha: ${new Date().toISOString()} · Modelo: ${process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite"} (fallback ${process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.1-flash-lite"})`,
    ``,
    `**Resultado: ${passed}/${runs.length} casos OK**`,
    ``,
    `| Caso | Requisito | Resultado | Tools | Tiempo |`,
    `|---|---|---|---|---|`,
    ...runs.map((r) => {
      const c = cases.find((x) => x.id === r.id)!;
      return `| ${r.id} — ${c.description} | ${c.rf} | ${r.failures.length ? "❌ " + r.failures.join("; ") : "✅"} | ${r.tools.map((t) => t.name).join(", ") || "—"} | ${(r.ms / 1000).toFixed(1)} s |`;
    }),
    ``,
    `## Detalle`,
    ...runs.flatMap((r) => {
      const c = cases.find((x) => x.id === r.id)!;
      return [
        ``,
        `### ${r.id}`,
        ...c.turns.map((t) => `- **Usuario:** ${t}`),
        ...r.tools.map((t) => `- Tool \`${t.name}\` ← \`${JSON.stringify(t.input)}\``),
        `- **Respuesta final:**`,
        ``,
        ...r.finalText.split("\n").map((l) => `> ${l}`),
      ];
    }),
  ];
  writeFileSync(path.resolve("evals/last-report.md"), lines.join("\n") + "\n");
  await close();
});

describe("evals del asistente (Gemini real)", () => {
  const ids = [
    "headphones-budget",
    "ambiguous",
    "nonexistent-product",
    "out-of-stock",
    "compare",
    "no-purchase",
    "off-topic",
  ];
  for (const [i, id] of ids.entries())
    it(id, async () => {
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const c = cases.find((x) => x.id === id)!;
      const t0 = Date.now();
      const r = await runTurns(c.turns);
      const failures = await evaluate(c, r);
      runs.push({ id, tools: r.tools, finalText: r.finalText, failures, ms: Date.now() - t0 });
      expect(failures).toEqual([]);
    });
});
