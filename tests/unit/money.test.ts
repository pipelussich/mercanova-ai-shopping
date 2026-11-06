import { describe, expect, it } from "vitest";
import { centsToUsd, formatUSD, toCents } from "@/domain/money";

describe("toCents", () => {
  it("convierte strings de numeric a centavos enteros", () => {
    expect(toCents("468.62")).toBe(46862);
  });

  it("redondea floats sin errores de coma flotante", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
  });

  it("rechaza valores no numéricos", () => {
    expect(() => toCents("abc")).toThrow();
  });
});

describe("formatUSD", () => {
  it("formatea en dólares con separadores de Uruguay", () => {
    expect(formatUSD(46862)).toContain("468,62");
    expect(formatUSD(123456)).toContain("1.234,56");
  });
});

describe("centsToUsd", () => {
  it("devuelve dólares con dos decimales", () => {
    expect(centsToUsd(46862)).toBe(468.62);
  });
});
