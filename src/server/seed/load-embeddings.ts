import type { DB } from "../../db/client";

/** Placeholder hasta la Task 9 (embeddings precomputados). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub hasta Task 9
export async function loadEmbeddingsIfPresent(_db: DB, _path: string): Promise<{ loaded: number; stale: number }> {
  return { loaded: 0, stale: 0 };
}
