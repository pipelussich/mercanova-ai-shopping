import { describe, expect, it } from "vitest";
import { stockLabelEs, stockStatus } from "@/domain/stock";

describe("stockStatus", () => {
  it("usa los umbrales del dataset", () => {
    expect(stockStatus(0)).toBe("Out of stock");
    expect(stockStatus(1)).toBe("Low stock");
    expect(stockStatus(2)).toBe("Low stock");
    expect(stockStatus(3)).toBe("In stock");
    expect(stockStatus(30)).toBe("In stock");
  });
});

describe("stockLabelEs", () => {
  it("traduce el estado para la UI", () => {
    expect(stockLabelEs("Out of stock")).toBe("Sin stock");
    expect(stockLabelEs("Low stock")).toBe("Últimas unidades");
    expect(stockLabelEs("In stock")).toBe("En stock");
  });
});
