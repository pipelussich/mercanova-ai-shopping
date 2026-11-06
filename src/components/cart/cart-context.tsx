"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Cart, CartMutation } from "@/server/cart/cart-service";

type CartCtx = {
  cart: Cart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  add: (productId: string, quantity?: number) => Promise<CartMutation | null>;
  setQuantity: (productId: string, quantity: number) => Promise<CartMutation | null>;
  remove: (productId: string) => Promise<CartMutation | null>;
};

const Ctx = createContext<CartCtx | null>(null);

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("No pudimos conectarnos con el servidor. Revisá tu conexión.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "Ocurrió un error inesperado.");
  return data as T;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCart(await apiFetch<Cart>("/api/cart"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del carrito
    void refresh();
  }, [refresh]);

  // Otras partes de la app (p.ej. el asistente) avisan que el carrito cambió.
  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener("mn:cart-changed", onChange);
    return () => window.removeEventListener("mn:cart-changed", onChange);
  }, [refresh]);

  const mutate = useCallback(async (url: string, init: RequestInit) => {
    try {
      const r = await apiFetch<CartMutation>(url, init);
      setCart(r.cart);
      return r;
    } catch (e) {
      toast.error((e as Error).message);
      await refresh();
      return null;
    }
  }, [refresh]);

  const value = useMemo<CartCtx>(
    () => ({
      cart,
      loading,
      refresh,
      add: (productId, quantity = 1) =>
        mutate("/api/cart/items", { method: "POST", body: JSON.stringify({ productId, quantity }) }),
      setQuantity: (productId, quantity) =>
        mutate(`/api/cart/items/${encodeURIComponent(productId)}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        }),
      remove: (productId) => mutate(`/api/cart/items/${encodeURIComponent(productId)}`, { method: "DELETE" }),
    }),
    [cart, loading, refresh, mutate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart fuera de CartProvider");
  return ctx;
}

export function notifyCartChanged() {
  window.dispatchEvent(new Event("mn:cart-changed"));
}
