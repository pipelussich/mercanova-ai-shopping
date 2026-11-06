import type { DB } from "@/db/client";
import { isDomainError } from "@/domain/errors";
import { centsToUsd } from "@/domain/money";
import type { EmbedQuery } from "../embeddings";

export type ToolContext = { db: DB; sessionId: string; embedQuery: EmbedQuery };

export const usd = centsToUsd;

/** Los errores de dominio vuelven al modelo como datos para que los explique; el resto se propaga. */
export async function asToolResult<T>(
  fn: () => Promise<T>,
): Promise<T | { ok: false; error: string; message: string }> {
  try {
    return await fn();
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: err.code, message: err.message };
    throw err;
  }
}
