import path from "node:path";
import { describe, expect, it } from "vitest";
import { excelSerialToDate, readWorkbook } from "@/server/seed/xlsx-reader";

const DATASET = path.resolve(__dirname, "../../data/MercaNova_dataset_obligatorio_2.xlsx");

describe("excelSerialToDate", () => {
  it("convierte el serial de Excel a fecha UTC", () => {
    expect(excelSerialToDate(46086).toISOString()).toBe("2026-03-05T00:00:00.000Z");
    expect(excelSerialToDate(46322.541666666664).toISOString()).toBe("2026-10-27T13:00:00.000Z");
  });
});

describe("readWorkbook", () => {
  it("lee las hojas del dataset por nombre de columna", async () => {
    const wb = await readWorkbook(DATASET);
    expect(Object.keys(wb)).toEqual([
      "Products",
      "Specifications",
      "Pricing",
      "Inventory",
      "Warehouses",
      "Relations",
      "Categories",
      "Brands",
    ]);
    const first = wb.Products[0];
    expect(first.product_id).toBe("MN-MON-0001");
    expect(first.active).toBe(true);
    expect(first.not_recommended_for).toBeNull();
    expect(first.weight_kg).toBe(6.74);
    expect(wb.Products).toHaveLength(360);
    expect(wb.Inventory[0]).toMatchObject({ warehouse_id: "WH-MVD-CEN", available_qty: 7 });
  });
});
