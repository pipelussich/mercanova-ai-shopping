import { generateText, transcribe, type LanguageModel } from "ai";
import { getEnv } from "../env";
import { getGoogle } from "./google";
import { GOOGLE_PROVIDER_OPTIONS, withModelFallback } from "./provider";

const INSTRUCTION =
  "Transcribí literalmente este audio en español. Devolvé sólo el texto, sin comentarios ni comillas.";

/**
 * Voz → texto (RF-08) con Gemini (gratis). Medido el 2026-11-06: el modelo de chat multimodal transcribe ~5x más
 * rápido (≈1,7 s) que el modelo de transcripción dedicado (≈8 s), así que va primero; el dedicado queda de respaldo.
 */
export const TRANSCRIBE_TIMEOUT_MS = 20_000;

export async function transcribeAudio(
  audio: Uint8Array,
  mediaType: string,
  opts: { models?: LanguageModel[]; timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS;
  try {
    const { text } = await withModelFallback(
      (model) =>
        generateText({
          model,
          providerOptions: GOOGLE_PROVIDER_OPTIONS,
          maxRetries: 1,
          abortSignal: AbortSignal.timeout(timeoutMs), // un modelo colgado no bloquea la consulta por voz
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: INSTRUCTION },
                { type: "file", mediaType, data: audio },
              ],
            },
          ],
        }),
      opts.models,
      { retriesPerModel: 0 },
    );
    return text.trim();
  } catch {
    const { text } = await transcribe({
      model: getGoogle().transcription(getEnv().GEMINI_TRANSCRIBE_MODEL),
      audio,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return text.trim();
  }
}
