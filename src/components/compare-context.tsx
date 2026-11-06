"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const MAX_COMPARE = 4;
const STORAGE_KEY = "mn-compare";

type CompareItem = { id: string; name: string };
type CompareCtx = {
  items: CompareItem[];
  has: (id: string) => boolean;
  toggle: (item: CompareItem) => void;
  clear: () => void;
};

const Ctx = createContext<CompareCtx | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar desde localStorage
      if (Array.isArray(saved)) setItems(saved.slice(0, MAX_COMPARE));
    } catch {
      /* storage no disponible: comparación sólo en memoria */
    }
  }, []);

  const persist = (next: CompareItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignorar */
    }
    return next;
  };

  const toggle = useCallback((item: CompareItem) => {
    setItems((prev) => {
      if (prev.some((p) => p.id === item.id)) return persist(prev.filter((p) => p.id !== item.id));
      if (prev.length >= MAX_COMPARE) {
        toast.warning(`Podés comparar hasta ${MAX_COMPARE} productos.`);
        return prev;
      }
      return persist([...prev, item]);
    });
  }, []);

  const value = useMemo<CompareCtx>(
    () => ({
      items,
      has: (id) => items.some((i) => i.id === id),
      toggle,
      clear: () => setItems(persist([])),
    }),
    [items, toggle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompare(): CompareCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompare fuera de CompareProvider");
  return ctx;
}
