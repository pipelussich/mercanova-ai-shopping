"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Undo2 } from "lucide-react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { useCart } from "@/components/cart/cart-context";
import { ComparisonTable } from "@/components/comparison-table";
import { CompareToggle } from "@/components/compare-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatUSD, toCents } from "@/domain/money";
import { productImageUrl } from "@/domain/product-images";
import { stockLabelEs, type StockStatus } from "@/domain/stock";
import { TOOL_STATUS_ES } from "./types";

type MiniProduct = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  priceUsd: number;
  availableQty: number;
  stockStatus: StockStatus;
  active?: boolean;
  rating?: number | null;
  matchReasons?: string[];
};

function MiniProductCard({ p }: { p: MiniProduct }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-background p-3 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto del producto */}
      <img
        src={productImageUrl({ id: p.id, imageUrl: null })}
        alt=""
        className="size-16 shrink-0 rounded-md border bg-white object-contain"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/productos/${p.id}`} className="font-medium leading-snug hover:underline">
            {p.name}
          </Link>
          <span className="shrink-0 font-semibold tabular-nums">{formatUSD(toCents(p.priceUsd))}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {p.brand && <span>{p.brand}</span>}
          {p.rating != null && <span>★ {p.rating.toFixed(1)}</span>}
          <span className={p.availableQty > 0 ? "text-emerald-700" : "text-destructive"}>
            {p.active === false ? "Discontinuado" : `${stockLabelEs(p.stockStatus)} (${p.availableQty} u.)`}
          </span>
        </div>
        {p.matchReasons && p.matchReasons.length > 0 && (
          <p className="text-xs text-muted-foreground">Coincide con: {p.matchReasons.join(", ")}</p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <AddToCartButton
            productId={p.id}
            productName={p.name}
            active={p.active !== false}
            availableQty={p.availableQty}
            size="sm"
          />
          <CompareToggle id={p.id} name={p.name} />
          <Link href={`/productos/${p.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ExternalLink /> Ver
          </Link>
        </div>
      </div>
    </div>
  );
}

type CartToolOutput =
  | {
      ok: true;
      action: "add" | "update" | "remove";
      productId: string;
      productName: string;
      quantity: number;
      previousQuantity: number;
    }
  | { ok: false; error: string; message: string };

function CartChangeCard({ out }: { out: CartToolOutput }) {
  const { setQuantity, remove } = useCart();
  const [undone, setUndone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!out.ok)
    return (
      <p className="flex items-center gap-1.5 rounded-md bg-destructive/5 p-2 text-sm text-destructive">
        <AlertTriangle className="size-4" /> {out.message}
      </p>
    );
  const label =
    out.action === "remove"
      ? `Quité ${out.productName} del carrito`
      : out.action === "add"
        ? `Agregué ${out.quantity - out.previousQuantity} × ${out.productName} al carrito`
        : `Cambié ${out.productName} a ${out.quantity} unidades`;
  const undo = async () => {
    setBusy(true);
    const r =
      out.previousQuantity === 0 ? await remove(out.productId) : await setQuantity(out.productId, out.previousQuantity);
    setBusy(false);
    if (r) setUndone(true);
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-2 text-sm">
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="size-4 text-emerald-600" /> {undone ? `Deshecho: ${label.toLowerCase()}` : label}
      </span>
      {!undone && (
        <Button size="sm" variant="outline" onClick={undo} disabled={busy}>
          <Undo2 /> Deshacer
        </Button>
      )}
    </div>
  );
}

type ToolPart = { type: string; state: string; input?: unknown; output?: unknown; errorText?: string };

/** Renderiza el resultado de una tool con los datos que devolvió (estado actual de la DB). */
export function ToolResult({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "");
  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> {TOOL_STATUS_ES[name] ?? "Procesando…"}
      </p>
    );
  if (part.state === "output-error") {
    // Argumentos mal armados por el modelo: el SDK se los devuelve y el agente reintenta solo, no es un error para la persona.
    if (part.errorText?.startsWith("Invalid input for tool")) return null;
    return <p className="text-xs text-destructive">No pude completar una consulta ({TOOL_STATUS_ES[name] ?? name}).</p>;
  }
  if (part.state !== "output-available") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- outputs tipados por tool en el servidor
  const out = part.output as any;
  switch (name) {
    case "search_products":
      if (!out.results?.length) return null;
      return (
        <div className="flex flex-col gap-2">
          {out.results.map((p: MiniProduct) => (
            <MiniProductCard key={p.id} p={p} />
          ))}
        </div>
      );
    case "get_related_products":
      if (!out.related?.length) return null;
      return (
        <div className="flex flex-col gap-2">
          {out.related.map((r: { product: MiniProduct }) => (
            <MiniProductCard key={r.product.id} p={r.product} />
          ))}
        </div>
      );
    case "get_product_details":
      return out.error ? null : <MiniProductCard p={out} />;
    case "compare_products":
      if (out.error) return null;
      return (
        <div className="text-xs">
          <ComparisonTable
            products={out.products.map((p: MiniProduct & { warrantyMonths: number | null }) => ({
              ...p,
              brand: p.brand ?? "",
              rating: p.rating ?? null,
              priceCents: toCents(p.priceUsd),
            }))}
            rows={out.rows}
          />
        </div>
      );
    case "add_to_cart":
    case "update_cart_item":
    case "remove_from_cart":
      return <CartChangeCard out={out} />;
    case "propose_checkout":
      return out.ready ? (
        <Link href="/checkout" className={buttonVariants({ size: "sm", className: "w-fit" })}>
          Ir al checkout ({formatUSD(toCents(out.totalUsd))})
        </Link>
      ) : (
        <div className="flex flex-col gap-1 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
          {out.issues.map((i: string) => (
            <span key={i}>{i}</span>
          ))}
          <Link href="/carrito" className="underline">
            Ver carrito
          </Link>
        </div>
      );
    case "get_orders":
      return out.orders?.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {out.orders.map((o: { id: string; totalUsd: number }) => (
            <li key={o.id}>
              <Link href={`/ordenes/${o.id}`} className="underline">
                {o.id}
              </Link>{" "}
              · {formatUSD(toCents(o.totalUsd))}
            </li>
          ))}
        </ul>
      ) : null;
    default:
      return null;
  }
}
