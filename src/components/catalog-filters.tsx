"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, categoryLabel } from "@/domain/categories";

export function CatalogFilters({ brands, showSearch = true }: { brands: string[]; showSearch?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("max") ?? "");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.push(`/?${next.toString()}`));
  };

  const hasFilters = ["q", "category", "brand", "max", "stock", "inactive"].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {showSearch && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: query.trim() || null });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describí lo que estás buscando… ej: auriculares cómodos para videollamadas"
              className="h-10 pl-9"
              aria-label="Buscar productos"
            />
          </div>
          <Button type="submit" className="h-10" disabled={pending}>
            Buscar
          </Button>
        </form>
      )}

      <div className="flex flex-wrap items-end gap-4 text-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-category">Categoría</Label>
          <select
            id="f-category"
            className="h-8 rounded-md border bg-background px-2"
            value={params.get("category") ?? ""}
            onChange={(e) => update({ category: e.target.value || null })}
          >
            <option value="">Todas</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-brand">Marca</Label>
          <select
            id="f-brand"
            className="h-8 rounded-md border bg-background px-2"
            value={params.get("brand") ?? ""}
            onChange={(e) => update({ brand: e.target.value || null })}
          >
            <option value="">Todas</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            update({ max: maxPrice || null });
          }}
        >
          <Label htmlFor="f-max">Precio máx. (USD)</Label>
          <Input
            id="f-max"
            type="number"
            min={0}
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={() => update({ max: maxPrice || null })}
            className="h-8 w-28"
          />
        </form>
        <label className="flex h-8 items-center gap-2">
          <Checkbox
            checked={params.get("stock") === "1"}
            onCheckedChange={(v) => update({ stock: v ? "1" : null })}
          />
          Sólo con stock
        </label>
        <label className="flex h-8 items-center gap-2">
          <Checkbox
            checked={params.get("inactive") === "1"}
            onCheckedChange={(v) => update({ inactive: v ? "1" : null })}
          />
          Mostrar discontinuados
        </label>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setMaxPrice("");
              startTransition(() => router.push("/"));
            }}
          >
            <X /> Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
