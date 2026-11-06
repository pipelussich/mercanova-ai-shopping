import { embed, embedMany } from "ai";
import { getEnv } from "../env";
import { getGoogle } from "./google";

export const EMBEDDING_DIMENSIONS = 768;

export type EmbedQuery = (text: string) => Promise<number[]>;

function model() {
  return getGoogle().textEmbedding(getEnv().GEMINI_EMBEDDING_MODEL);
}

/**
 * Embeddings de documentos (catálogo). Se usa offline para generar data/embeddings.json.
 * El free tier cuenta cada texto como un pedido (límite ~100/min), por eso va en tandas con pausa.
 */
export async function embedDocuments(
  texts: string[],
  opts: { batchSize?: number; pauseMs?: number; onBatch?: (done: number) => void } = {},
): Promise<number[][]> {
  const { batchSize = 50, pauseMs = 62_000, onBatch } = opts;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    if (i > 0 && pauseMs > 0) await sleep(pauseMs);
    let embeddings: number[][] | undefined;
    for (let attempt = 1; !embeddings; attempt++) {
      try {
        ({ embeddings } = await embedMany({
          model: model(),
          values: texts.slice(i, i + batchSize),
          maxParallelCalls: 1,
          maxRetries: 0,
          providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" } },
        }));
      } catch (err) {
        const quota = (err as { statusCode?: number }).statusCode === 429;
        if (!quota || attempt >= 4) throw err;
        await sleep(65_000); // la ventana del free tier es por minuto
      }
    }
    out.push(...embeddings);
    onBatch?.(out.length);
  }
  return out;
}

/** Embedder para la app: si no hay key, falla enseguida y la búsqueda cae a palabras clave. */
export function queryEmbedder(): EmbedQuery {
  if (!getEnv().hasAI)
    return async () => {
      throw new Error("IA deshabilitada");
    };
  return embedQuery;
}

/** Embedding de una consulta del usuario (1 llamada a Gemini por búsqueda). */
export const embedQuery: EmbedQuery = async (text) => {
  const { embedding } = await embed({
    model: model(),
    value: text,
    maxRetries: 1,
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_QUERY" } },
  });
  return embedding;
};
