import { APICallError, RetryError, type LanguageModel } from "ai";
import { getEnv } from "../env";
import { getGoogle } from "./google";

/** El historial vive en nuestra DB: no pedimos a Google que guarde las interacciones. */
export const GOOGLE_PROVIDER_OPTIONS = { google: { store: false } } as const;

export class AIUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "El asistente está con mucha demanda en este momento. Probá de nuevo en unos segundos; podés seguir usando la tienda normalmente.",
    );
    this.name = "AIUnavailableError";
    this.cause = cause;
  }
}

/** Modelo principal y de respaldo (ambos del free tier), vía la Interactions API de Gemini. */
export function chatModels(): LanguageModel[] {
  const env = getEnv();
  const google = getGoogle();
  return [google.interactions(env.GEMINI_CHAT_MODEL), google.interactions(env.GEMINI_FALLBACK_MODEL)];
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function isRetryable(err: unknown): boolean {
  if (RetryError.isInstance(err)) return isRetryable(err.lastError);
  if (APICallError.isInstance(err)) return err.isRetryable || RETRYABLE_STATUS.has(err.statusCode ?? 0);
  if (err instanceof Error)
    return (
      err.name === "TimeoutError" || err.name === "AbortError" || /fetch failed|ECONNRESET|ETIMEDOUT/i.test(err.message)
    );
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ejecuta `run` con el modelo principal; ante errores transitorios (cuota, 5xx, timeouts) reintenta con
 * backoff exponencial y luego pasa al modelo de respaldo. Errores del pedido (400/401/403) se relanzan.
 */
export async function withModelFallback<T>(
  run: (model: LanguageModel) => Promise<T>,
  models: LanguageModel[] = chatModels(),
  opts: { retriesPerModel?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { retriesPerModel = 2, baseDelayMs = 800 } = opts;
  let last: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt <= retriesPerModel; attempt++) {
      try {
        return await run(model);
      } catch (err) {
        if (!isRetryable(err)) throw err;
        last = err;
        if (attempt < retriesPerModel && baseDelayMs > 0)
          await sleep(baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs);
      }
    }
  }
  throw new AIUnavailableError(last);
}
