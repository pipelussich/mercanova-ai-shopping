import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handleRoute, readJson } from "@/app/api/_lib/respond";
import { DomainError } from "@/domain/errors";

const body = async (res: Response) => (await res.json()) as { error: { code: string; message: string } };

describe("handleRoute", () => {
  it("JSON inválido → 400 con mensaje en español", async () => {
    const req = new Request("http://x", { method: "POST", body: "{no es json" });
    const res = await handleRoute(async () => Response.json(await readJson(req)));
    expect(res.status).toBe(400);
    expect((await body(res)).error.message).toMatch(/JSON válido/);
  });

  it("producto inexistente → 404", async () => {
    const res = await handleRoute(async () => {
      throw new DomainError("PRODUCT_NOT_FOUND");
    });
    expect(res.status).toBe(404);
    expect(await body(res)).toMatchObject({
      error: { code: "PRODUCT_NOT_FOUND", message: "No encontramos ese producto." },
    });
  });

  it("stock insuficiente → 409 con detalles", async () => {
    const res = await handleRoute(async () => {
      throw new DomainError("INSUFFICIENT_STOCK", "Sólo hay 2 unidades disponibles.", { available: 2 });
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { details: { available: 2 } } });
  });

  it("validación → 422 con el primer mensaje", async () => {
    const res = await handleRoute(async () => {
      z.object({ quantity: z.number({ error: "La cantidad tiene que ser un número." }) }).parse({ quantity: "x" });
      return Response.json({});
    });
    expect(res.status).toBe(422);
    expect((await body(res)).error.message).toBe("La cantidad tiene que ser un número.");
  });

  it("error inesperado → 500 genérico, sin stack ni detalles internos", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleRoute(async () => {
      throw new Error("connection refused at 10.0.0.5:5432 password=secret");
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/secret|10\.0\.0\.5|stack|at /);
    expect(JSON.parse(text)).toEqual({
      error: { code: "INTERNAL", message: "Ocurrió un error inesperado. Probá de nuevo." },
    });
    log.mockRestore();
  });
});
