import { describe, expect, it } from "vitest";
import { allocate } from "@/domain/allocation";

const stock = [
  { warehouseId: "A", available: 3 },
  { warehouseId: "B", available: 4 },
];

describe("allocate", () => {
  it("para envío toma primero del depósito con más stock", () => {
    expect(allocate(5, stock, "shipping")).toEqual([
      { warehouseId: "B", quantity: 4 },
      { warehouseId: "A", quantity: 1 },
    ]);
  });

  it("desempata por id de depósito", () => {
    expect(
      allocate(
        2,
        [
          { warehouseId: "Z", available: 2 },
          { warehouseId: "C", available: 2 },
        ],
        "shipping",
      ),
    ).toEqual([{ warehouseId: "C", quantity: 2 }]);
  });

  it("para retiro toma todo del depósito elegido", () => {
    expect(allocate(2, stock, "pickup", "A")).toEqual([{ warehouseId: "A", quantity: 2 }]);
  });

  it("falla si el depósito de retiro no alcanza", () => {
    expect(() => allocate(4, stock, "pickup", "A")).toThrow(expect.objectContaining({ code: "PICKUP_UNAVAILABLE" }));
  });

  it("falla si el stock total no alcanza", () => {
    expect(() => allocate(8, stock, "shipping")).toThrow(expect.objectContaining({ code: "INSUFFICIENT_STOCK" }));
  });

  it("ignora depósitos sin stock", () => {
    expect(allocate(1, [{ warehouseId: "A", available: 0 }, ...stock.slice(1)], "shipping")).toEqual([
      { warehouseId: "B", quantity: 1 },
    ]);
  });
});
