import { describe, expect, it } from "vitest";
import { lineIssue, summarizeCart, validateQuantity } from "@/domain/cart";

describe("validateQuantity", () => {
  it("rechaza cantidades no enteras, menores a 1 o mayores a 99", () => {
    for (const q of [0, -1, 1.5, 100, Number.NaN])
      expect(() => validateQuantity(q, 50, true)).toThrow(expect.objectContaining({ code: "INVALID_QUANTITY" }));
  });

  it("rechaza productos discontinuados", () => {
    expect(() => validateQuantity(1, 10, false)).toThrow(expect.objectContaining({ code: "PRODUCT_INACTIVE" }));
  });

  it("rechaza pedir más que lo disponible", () => {
    expect(() => validateQuantity(3, 2, true)).toThrow(expect.objectContaining({ code: "INSUFFICIENT_STOCK" }));
    expect(() => validateQuantity(1, 0, true)).toThrow(expect.objectContaining({ code: "INSUFFICIENT_STOCK" }));
  });

  it("acepta cantidades dentro del stock", () => {
    expect(() => validateQuantity(2, 2, true)).not.toThrow();
  });
});

describe("lineIssue", () => {
  it("marca líneas sin stock suficiente o discontinuadas", () => {
    expect(lineIssue(3, 2, true)).toBe("INSUFFICIENT_STOCK");
    expect(lineIssue(1, 5, false)).toBe("INACTIVE");
    expect(lineIssue(2, 2, true)).toBeNull();
  });
});

describe("summarizeCart", () => {
  it("suma totales en centavos y detecta problemas", () => {
    const s = summarizeCart([
      { quantity: 2, priceCents: 1999, issue: null },
      { quantity: 1, priceCents: 50001, issue: "INSUFFICIENT_STOCK" },
    ]);
    expect(s).toEqual({ totalCents: 2 * 1999 + 50001, itemCount: 3, hasIssues: true });
  });

  it("un carrito vacío no tiene problemas", () => {
    expect(summarizeCart([])).toEqual({ totalCents: 0, itemCount: 0, hasIssues: false });
  });
});
