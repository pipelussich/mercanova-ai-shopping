"use client";

import Link from "next/link";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/domain/money";
import { useCart } from "./cart-context";

export function CartView() {
  const { cart, loading, setQuantity, remove } = useCart();

  if (loading && !cart) return <Skeleton className="h-64 w-full" />;
  if (!cart || cart.lines.length === 0)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-muted-foreground">Tu carrito está vacío.</p>
          <Link href="/" className={buttonVariants()}>
            Ver el catálogo
          </Link>
        </CardContent>
      </Card>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-3 lg:col-span-2">
        {cart.lines.map((l) => (
          <Card key={l.product.id}>
            <CardContent className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- placeholder externo */}
              <img src={l.product.imageUrl ?? ""} alt="" className="size-20 rounded-md border object-cover" />
              <div className="flex min-w-48 flex-1 flex-col gap-1">
                <Link href={`/productos/${l.product.id}`} className="font-medium hover:underline">
                  {l.product.name}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {formatUSD(l.product.priceCents)} c/u · {l.product.availableQty} disponibles
                </span>
                {l.issue && (
                  <span className="flex items-center gap-1 text-sm text-destructive">
                    <AlertTriangle className="size-4" />
                    {l.issue === "INACTIVE"
                      ? "Este producto fue discontinuado. Quitalo para continuar."
                      : `Sólo quedan ${l.product.availableQty} unidades. Ajustá la cantidad.`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1" aria-label={`Cantidad de ${l.product.name}`}>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Restar uno"
                  disabled={l.quantity <= 1}
                  onClick={() => setQuantity(l.product.id, l.quantity - 1)}
                >
                  <Minus />
                </Button>
                <input
                  key={l.quantity}
                  type="number"
                  min={1}
                  defaultValue={l.quantity}
                  aria-label="Cantidad"
                  className="h-7 w-14 rounded-md border bg-background text-center tabular-nums"
                  onBlur={(e) => {
                    const q = Number(e.target.value);
                    if (q !== l.quantity) void setQuantity(l.product.id, q);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Sumar uno"
                  onClick={() => setQuantity(l.product.id, l.quantity + 1)}
                >
                  <Plus />
                </Button>
              </div>
              <span className="w-28 text-right font-medium tabular-nums">{formatUSD(l.lineTotalCents)}</span>
              <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${l.product.name}`} onClick={() => remove(l.product.id)}>
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span>Productos ({cart.itemCount})</span>
            <span className="tabular-nums">{formatUSD(cart.totalCents)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Envío</span>
            <span>Gratis</span>
          </div>
          <div className="flex justify-between border-t pt-3 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums" data-testid="cart-total">
              {formatUSD(cart.totalCents)}
            </span>
          </div>
          {cart.hasIssues ? (
            <p className="text-sm text-destructive">Resolvé los avisos del carrito para continuar.</p>
          ) : null}
          <Link
            href="/checkout"
            aria-disabled={cart.hasIssues}
            className={buttonVariants({ size: "lg", className: cart.hasIssues ? "pointer-events-none opacity-50" : "" })}
          >
            Ir al checkout
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
