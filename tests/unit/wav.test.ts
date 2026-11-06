import { describe, expect, it } from "vitest";
import { encodeWav } from "@/components/assistant/wav";

describe("encodeWav", () => {
  it("genera un WAV PCM 16-bit mono con encabezado válido", async () => {
    const blob = encodeWav(new Float32Array([0, 1, -1, 0.5]), 16_000);
    const view = new DataView(await blob.arrayBuffer());
    const str = (o: number, n: number) => String.fromCharCode(...new Uint8Array(view.buffer, o, n));
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 4 * 2);
    expect(str(0, 4)).toBe("RIFF");
    expect(str(8, 4)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getInt16(46, true)).toBe(0x7fff); // 1.0 → máximo positivo
    expect(view.getInt16(48, true)).toBe(-0x8000); // -1.0 → mínimo
  });
});
