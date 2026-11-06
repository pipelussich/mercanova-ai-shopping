"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { checkoutSchema, type CheckoutInput } from "@/domain/checkout";
import { formatUSD } from "@/domain/money";
import type { Order } from "@/server/orders/order-service";
import { useCart } from "../cart/cart-context";
import { clearCheckout, loadCheckout, type WarehouseOption } from "./checkout-storage";

export function OrderReview({ warehouses }: { warehouses: WarehouseOption[] }) {
  const router = useRouter();
  const { cart, loading, refresh } = useCart();
  const [data, setData] = useState<CheckoutInput | null | undefined>(undefined);
  // Una clave por intento de compra: reintentos y doble click no duplican la orden.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    const parsed = checkoutSchema.safeParse(loadCheckout());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leer datos del paso 1
    setData(parsed.success ? parsed.data : null);
  }, []);

  if (data === undefined || (loading && !cart)) return <Skeleton className="h-96" />;
  if (data === null)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">Primero completá tus datos de entrega.</p>
          <Link href="/checkout" className={buttonVariants()}>
            Ir al paso 1
          </Link>
        </CardContent>
      </Card>
    );
  if (!cart || cart.lines.length === 0)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">Tu carrito está vacío.</p>
          <Link href="/" className={buttonVariants()}>
            Ver el catálogo
          </Link>
        </CardContent>
      </Card>
    );

  const pickup = warehouses.find((w) => w.id === data.pickupWarehouseId);

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, idempotencyKey, expectedTotalCents: cart.totalCents }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? { code: "INTERNAL", message: "No pudimos registrar la compra. Probá de nuevo." });
        await refresh(); // precios o stock pudieron cambiar: mostrar el estado actual
        return;
      }
      const order = body as Order;
      clearCheckout();
      await refresh();
      router.push(`/ordenes/${order.id}?nueva=1`);
    } catch {
      setError({ code: "NETWORK", message: "No pudimos conectarnos con el servidor. Revisá tu conexión y reintentá." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-medium">Productos</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {cart.lines.map((l) => (
              <li key={l.product.id} className="flex justify-between gap-4">
                <span>
                  {l.quantity} × {l.product.name}
                  {l.issue && (
                    <span className="block text-destructive">
                      {l.issue === "INACTIVE" ? "Discontinuado" : `Sólo quedan ${l.product.availableQty} unidades`}
                    </span>
                  )}
                </span>
                <span className="tabular-nums">{formatUSD(l.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-3 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums" data-testid="review-total">
              {formatUSD(cart.totalCents)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 text-sm">
          <h2 className="mb-1 font-medium">Entrega</h2>
          <p>
            {data.customerName} · {data.email} · {data.phone}
          </p>
          {data.deliveryMethod === "shipping" ? (
            <p>
              Envío a {data.address}, {data.department}
            </p>
          ) : (
            <p>
              Retiro en {pickup?.name ?? data.pickupWarehouseId} ({pickup?.city})
            </p>
          )}
          <Link href="/checkout" className="mt-1 w-fit text-muted-foreground underline">
            Cambiar datos
          </Link>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span>{error.message}</span>
            {error.code === "PRICE_CHANGED" && (
              <span>Arriba ves el total actualizado. Si estás de acuerdo, confirmá de nuevo.</span>
            )}
            {["INSUFFICIENT_STOCK", "PRODUCT_INACTIVE", "PICKUP_UNAVAILABLE"].includes(error.code) && (
              <Link href="/carrito" className="underline">
                Ajustar el carrito
              </Link>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Compra simulada: no se realiza ningún cobro. Al confirmar se registra la orden y se descuenta el stock.
      </p>
      <Button size="lg" className="h-11" onClick={confirm} disabled={submitting || cart.hasIssues}>
        {submitting ? (
          <>
            <Loader2 className="animate-spin" /> Confirmando…
          </>
        ) : (
          `Confirmar compra por ${formatUSD(cart.totalCents)}`
        )}
      </Button>
    </div>
  );
}
