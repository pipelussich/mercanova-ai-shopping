import { describe, expect, it } from "vitest";
import { createTranscribeHandler, MAX_AUDIO_BYTES } from "@/app/api/transcribe/handler";

function request(blob: Blob | null) {
  const form = new FormData();
  if (blob) form.append("audio", blob, "voz.webm");
  return new Request("http://localhost/api/transcribe", { method: "POST", body: form });
}

const audio = (bytes: number, type = "audio/webm;codecs=opus") => new Blob([new Uint8Array(bytes)], { type });

describe("POST /api/transcribe", () => {
  const ok = createTranscribeHandler({ transcribe: async () => "  necesito auriculares  ", enabled: () => true });

  it("devuelve el texto transcripto", async () => {
    const res = await ok(request(audio(1000)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "necesito auriculares" });
  });

  it("rechaza formatos que no son audio", async () => {
    const res = await ok(request(audio(1000, "image/png")));
    expect(res.status).toBe(415);
    expect((await res.json()).error.message).toMatch(/formato/i);
  });

  it("rechaza audios demasiado grandes", async () => {
    const res = await ok(request(audio(MAX_AUDIO_BYTES + 1)));
    expect(res.status).toBe(413);
  });

  it("rechaza audio vacío o ausente", async () => {
    expect((await ok(request(audio(0)))).status).toBe(400);
    expect((await ok(request(null))).status).toBe(400);
  });

  it("avisa cuando no se entendió nada", async () => {
    const empty = createTranscribeHandler({ transcribe: async () => "   ", enabled: () => true });
    const res = await empty(request(audio(1000)));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: "EMPTY_TRANSCRIPT" } });
  });

  it("informa si la IA no está configurada", async () => {
    const off = createTranscribeHandler({ transcribe: async () => "x", enabled: () => false });
    expect((await off(request(audio(1000)))).status).toBe(503);
  });

  it("devuelve un error amable si Gemini falla", async () => {
    const failing = createTranscribeHandler({
      transcribe: async () => {
        throw new Error("boom");
      },
      enabled: () => true,
    });
    const res = await failing(request(audio(1000)));
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toMatch(/escrib/i);
  });
});
