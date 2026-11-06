import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/domain/checkout";
import { URUGUAY_DEPARTMENTS } from "@/domain/departments";

const base = { customerName: "Ana Pérez", email: "ana@example.com", phone: "099 123 456" };

describe("checkoutSchema", () => {
  it("acepta un envío completo", () => {
    const r = checkoutSchema.safeParse({
      ...base,
      deliveryMethod: "shipping",
      address: "Av. 18 de Julio 1234",
      department: "Montevideo",
    });
    expect(r.success).toBe(true);
  });

  it("acepta un retiro en depósito", () => {
    expect(
      checkoutSchema.safeParse({ ...base, deliveryMethod: "pickup", pickupWarehouseId: "WH-MVD-CEN" }).success,
    ).toBe(true);
  });

  it("exige dirección para envíos", () => {
    const r = checkoutSchema.safeParse({ ...base, deliveryMethod: "shipping", department: "Montevideo" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/dirección/i);
  });

  it("rechaza departamentos inexistentes", () => {
    const r = checkoutSchema.safeParse({
      ...base,
      deliveryMethod: "shipping",
      address: "Calle 1 234",
      department: "Narnia",
    });
    expect(r.success).toBe(false);
  });

  it("exige depósito para retiro", () => {
    expect(checkoutSchema.safeParse({ ...base, deliveryMethod: "pickup" }).success).toBe(false);
  });

  it("valida email y teléfono", () => {
    expect(
      checkoutSchema.safeParse({ ...base, email: "no-es-email", deliveryMethod: "pickup", pickupWarehouseId: "X" })
        .success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, phone: "abc", deliveryMethod: "pickup", pickupWarehouseId: "X" }).success,
    ).toBe(false);
  });

  it("conoce los 19 departamentos", () => {
    expect(URUGUAY_DEPARTMENTS).toHaveLength(19);
  });
});
