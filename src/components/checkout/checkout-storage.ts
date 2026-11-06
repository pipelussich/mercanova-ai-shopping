import type { CheckoutInput } from "@/domain/checkout";

const KEY = "mn-checkout";

export function saveCheckout(data: CheckoutInput) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* sin storage: el usuario vuelve a completar el formulario */
  }
}

export function loadCheckout(): Partial<CheckoutInput> | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCheckout() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignorar */
  }
}

export type WarehouseOption = { id: string; name: string; city: string };
