import type { DB } from "../../db/client";

/** Placeholder hasta la Task 9 (embeddings precomputados). */
export async function loadEmbeddingsIfPresent(_db: DB, _path: string): Promise<{ loaded: number; stale: number }> {
  return { loaded: 0, stale: 0 };
}
