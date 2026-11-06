import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { AIUnavailableError, isRetryable, withModelFallback } from "@/ai/provider";

const apiError = (statusCode: number) =>
  new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
    isRetryable: [429, 500, 502, 503, 504].includes(statusCode),
  });

const models = ["m1", "m2"] as unknown as Parameters<typeof withModelFallback>[1];
const fast = { retriesPerModel: 2, baseDelayMs: 0 };

describe("isRetryable", () => {
  it("reintenta cuota y errores transitorios, no errores del pedido", () => {
    expect(isRetryable(apiError(429))).toBe(true);
    expect(isRetryable(apiError(503))).toBe(true);
    expect(isRetryable(apiError(400))).toBe(false);
    expect(isRetryable(apiError(401))).toBe(false);
    expect(isRetryable(Object.assign(new Error("timeout"), { name: "TimeoutError" }))).toBe(true);
  });
});

describe("withModelFallback", () => {
  it("reintenta en el mismo modelo ante 429", async () => {
    const calls: string[] = [];
    const result = await withModelFallback(
      async (m) => {
        calls.push(String(m));
        if (calls.length < 3) throw apiError(429);
        return "ok";
      },
      models,
      fast,
    );
    expect(result).toBe("ok");
    expect(calls).toEqual(["m1", "m1", "m1"]);
  });

  it("pasa al modelo de respaldo cuando el principal sigue fallando", async () => {
    const calls: string[] = [];
    const result = await withModelFallback(
      async (m) => {
        calls.push(String(m));
        if (m === ("m1" as unknown)) throw apiError(503);
        return "ok";
      },
      models,
      fast,
    );
    expect(result).toBe("ok");
    expect(calls).toEqual(["m1", "m1", "m1", "m2"]);
  });

  it("no reintenta errores no recuperables", async () => {
    let n = 0;
    await expect(
      withModelFallback(
        async () => {
          n++;
          throw apiError(401);
        },
        models,
        fast,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(n).toBe(1);
  });

  it("lanza AIUnavailableError si todos los modelos fallan", async () => {
    await expect(
      withModelFallback(
        async () => {
          throw apiError(429);
        },
        models,
        fast,
      ),
    ).rejects.toBeInstanceOf(AIUnavailableError);
  });
});
