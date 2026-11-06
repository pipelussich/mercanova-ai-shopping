import { DomainError } from "./errors";

export type DeliveryMethod = "shipping" | "pickup";
export type WarehouseStock = { warehouseId: string; available: number };
export type Allocation = { warehouseId: string; quantity: number };

/**
 * Decide de qué depósitos salen las unidades de una línea.
 * - Retiro: todo del depósito elegido.
 * - Envío: greedy desde el depósito con más stock (menos paquetes por orden); empate por id.
 */
export function allocate(
  requested: number,
  stock: WarehouseStock[],
  method: DeliveryMethod,
  pickupWarehouseId?: string,
): Allocation[] {
  if (method === "pickup") {
    const w = stock.find((s) => s.warehouseId === pickupWarehouseId);
    if (!w || w.available < requested)
      throw new DomainError("PICKUP_UNAVAILABLE", undefined, { available: w?.available ?? 0 });
    return [{ warehouseId: w.warehouseId, quantity: requested }];
  }

  const total = stock.reduce((s, w) => s + Math.max(w.available, 0), 0);
  if (total < requested) throw new DomainError("INSUFFICIENT_STOCK", undefined, { available: total });

  const sorted = [...stock]
    .filter((s) => s.available > 0)
    .sort((a, b) => b.available - a.available || a.warehouseId.localeCompare(b.warehouseId));
  const result: Allocation[] = [];
  let remaining = requested;
  for (const w of sorted) {
    if (remaining === 0) break;
    const take = Math.min(w.available, remaining);
    result.push({ warehouseId: w.warehouseId, quantity: take });
    remaining -= take;
  }
  return result;
}
