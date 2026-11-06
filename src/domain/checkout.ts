import { z } from "zod";
import { URUGUAY_DEPARTMENTS } from "./departments";

/** Datos mínimos para simular una compra (RF-11). Nunca datos de tarjeta (RF-13). */
export const checkoutSchema = z
  .object({
    customerName: z
      .string({ error: "Ingresá tu nombre." })
      .trim()
      .min(2, "Ingresá tu nombre completo.")
      .max(80, "El nombre es demasiado largo."),
    email: z.string({ error: "Ingresá tu email." }).trim().email("Ingresá un email válido."),
    phone: z
      .string({ error: "Ingresá un teléfono." })
      .trim()
      .regex(/^[0-9 +()-]{6,20}$/, "Ingresá un teléfono válido (sólo números, espacios, +, - y paréntesis)."),
    deliveryMethod: z.enum(["shipping", "pickup"], { error: "Elegí un método de entrega." }),
    address: z.string().trim().optional(),
    department: z.string().optional(),
    pickupWarehouseId: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.deliveryMethod === "shipping") {
      if (!v.address || v.address.length < 5 || v.address.length > 200)
        ctx.addIssue({ code: "custom", path: ["address"], message: "Ingresá una dirección de envío (5 a 200 caracteres)." });
      if (!v.department || !(URUGUAY_DEPARTMENTS as readonly string[]).includes(v.department))
        ctx.addIssue({ code: "custom", path: ["department"], message: "Elegí un departamento de Uruguay." });
    } else if (!v.pickupWarehouseId) {
      ctx.addIssue({ code: "custom", path: ["pickupWarehouseId"], message: "Elegí el depósito donde vas a retirar." });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
