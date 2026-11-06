import { errorResponse } from "../_lib/respond";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // ~60 s de voz comprimida sobran
const ACCEPTED = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac"];

type Deps = {
  transcribe: (audio: Uint8Array, mediaType: string) => Promise<string>;
  enabled: () => boolean;
};

/** POST multipart con el campo `audio` → `{ text }`. La consulta se procesa después como texto normal. */
export function createTranscribeHandler({ transcribe, enabled }: Deps) {
  return async function POST(req: Request): Promise<Response> {
    if (!enabled())
      return errorResponse(503, "AI_DISABLED", "La entrada por voz no está disponible (falta GEMINI_API_KEY).");

    let file: FormDataEntryValue | null;
    try {
      file = (await req.formData()).get("audio");
    } catch {
      return errorResponse(400, "BAD_REQUEST", "No recibimos el audio. Probá grabar de nuevo.");
    }
    if (!(file instanceof Blob) || file.size === 0)
      return errorResponse(400, "EMPTY_AUDIO", "No recibimos audio. Probá grabar de nuevo.");
    if (file.size > MAX_AUDIO_BYTES)
      return errorResponse(413, "AUDIO_TOO_LARGE", "El audio es demasiado largo. Grabá una consulta más corta.");

    const mediaType = file.type.split(";")[0].trim().toLowerCase();
    if (!ACCEPTED.includes(mediaType))
      return errorResponse(415, "UNSUPPORTED_AUDIO", "Formato de audio no soportado. Probá con otro navegador.");

    let text: string;
    try {
      text = (await transcribe(new Uint8Array(await file.arrayBuffer()), mediaType)).trim();
    } catch (err) {
      console.error("[transcribe] error:", err instanceof Error ? `${err.name}: ${err.message}` : err);
      return errorResponse(
        503,
        "TRANSCRIPTION_FAILED",
        "No pudimos transcribir el audio en este momento. Probá de nuevo o escribí tu consulta.",
      );
    }
    if (!text)
      return errorResponse(
        422,
        "EMPTY_TRANSCRIPT",
        "No pude entender el audio. Probá de nuevo hablando más cerca del micrófono.",
      );
    return Response.json({ text });
  };
}
