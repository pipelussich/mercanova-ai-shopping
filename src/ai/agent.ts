import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  RetryError,
  stepCountIs,
  streamText,
  type LanguageModel,
  type UIMessage,
} from "ai";
import type { DB } from "@/db/client";
import type { EmbedQuery } from "./embeddings";
import { AIUnavailableError, chatModels, GOOGLE_PROVIDER_OPTIONS, isRetryable, withModelFallback } from "./provider";
import { SYSTEM_PROMPT } from "./system-prompt";
import { buildTools } from "./tools";

export const MAX_AGENT_STEPS = 6;

export type AgentStreamOptions = {
  db: DB;
  sessionId: string;
  /** Historial completo (persistido) + el mensaje nuevo del usuario. */
  messages: UIMessage[];
  embedQuery: EmbedQuery;
  models?: LanguageModel[];
  /** Reintentos internos del SDK por modelo antes de pasar al de respaldo. */
  maxRetries?: number;
  retryDelayMs?: number;
  /** Si el modelo no produce contenido en este tiempo se corta y se pasa al de respaldo. */
  firstContentTimeoutMs?: number;
  /** Tope total de la respuesta (todos los pasos). */
  totalTimeoutMs?: number;
  onFinish?: (messages: UIMessage[]) => Promise<void> | void;
};

/** Mensaje para el usuario cuando falla el asistente (sin detalles internos). */
export function friendlyAIError(err: unknown): string {
  if (err instanceof AIUnavailableError) return err.message;
  if (RetryError.isInstance(err) || (APICallError.isInstance(err) && isRetryable(err)))
    return new AIUnavailableError().message;
  console.error("[assistant] error:", err instanceof Error ? `${err.name}: ${err.message}` : err);
  return "Tuve un problema para responder. Probá de nuevo; podés seguir usando la tienda normalmente.";
}

export const FIRST_CONTENT_TIMEOUT_MS = 20_000;
export const TOTAL_TIMEOUT_MS = 120_000;

function timeoutError(message: string) {
  return Object.assign(new Error(message), { name: "TimeoutError" });
}

const CONTENT_PARTS = new Set(["text-delta", "tool-call", "tool-input-start", "reasoning-delta", "finish"]);

/**
 * Agente único con tools (sin multi-agent): decide en hasta MAX_AGENT_STEPS pasos qué capacidades reales de la app
 * usar. Si el modelo principal falla antes de producir contenido (cuota/5xx), reintenta con el de respaldo.
 */
export function createAgentStream(opts: AgentStreamOptions): ReadableStream {
  const tools = buildTools({ db: opts.db, sessionId: opts.sessionId, embedQuery: opts.embedQuery });

  return createUIMessageStream({
    originalMessages: opts.messages,
    onError: friendlyAIError,
    onFinish: opts.onFinish ? ({ messages }) => opts.onFinish!(messages) : undefined,
    execute: async ({ writer }) => {
      const modelMessages = await convertToModelMessages(opts.messages, { tools, ignoreIncompleteToolCalls: true });
      const total = AbortSignal.timeout(opts.totalTimeoutMs ?? TOTAL_TIMEOUT_MS);
      await withModelFallback(
        async (model) => {
          // Un modelo que acepta la conexión y nunca responde no debe bloquear el chat: se aborta y se reintenta.
          const firstContent = new AbortController();
          const timer = setTimeout(
            () => firstContent.abort(timeoutError("El modelo no respondió a tiempo")),
            opts.firstContentTimeoutMs ?? FIRST_CONTENT_TIMEOUT_MS,
          );
          const result = streamText({
            abortSignal: AbortSignal.any([firstContent.signal, total]),
            model,
            system: SYSTEM_PROMPT,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(MAX_AGENT_STEPS),
            providerOptions: GOOGLE_PROVIDER_OPTIONS,
            maxRetries: opts.maxRetries ?? 2,
            onError: () => {}, // los errores se manejan abajo / en onError del stream de UI
          });
          // Se crea el stream de UI antes de leer: cada consumidor recibe su propia copia del stream.
          const ui = result.toUIMessageStream({ sendStart: false, onError: friendlyAIError });
          const reader = result.fullStream.getReader();
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done || value.type === "abort") {
                if (firstContent.signal.aborted) throw firstContent.signal.reason;
                if (total.aborted) throw timeoutError("La respuesta tardó demasiado");
                break;
              }
              if (value.type === "error") throw firstContent.signal.aborted ? firstContent.signal.reason : value.error;
              if (CONTENT_PARTS.has(value.type)) break;
            }
          } finally {
            clearTimeout(timer);
          }
          void (async () => {
            while (!(await reader.read()).done);
          })().catch(() => {});
          writer.merge(ui);
        },
        opts.models ?? chatModels(),
        { retriesPerModel: 0, baseDelayMs: opts.retryDelayMs ?? 800 },
      );
    },
  });
}
