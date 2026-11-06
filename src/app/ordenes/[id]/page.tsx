import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/db/client";
import { formatUSD } from "@/domain/money";
import { getOrder } from "@/server/orders/order-service";
import { getSessionId } from "@/server/session";
import { dateFormat } from "@/lib/format";

export default function OrderPage({ params, searchParams }: PageProps<"/ordenes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <OrderView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OrderView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await getOrder(getDb(), await getSessionId(), decodeURIComponent(id));
  if (!order) notFound();
  const isNew = sp.nueva === "1";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/ordenes" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Mis órdenes
      </Link>
      {isNew && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
          <div>
            <p className="font-semibold text-emerald-900">¡Compra confirmada!</p>
            <p className="text-sm text-emerald-900/80">
              Registramos tu orden <strong>{order.id}</strong> y actualizamos el stock. Compra simulada: no se realizó
              ningún cobro.
            </p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
            <span>Orden {order.id}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {dateFormat.format(new Date(order.createdAt))} · Confirmada
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3 text-sm">
            {order.items.map((i) => {
              const from = order.allocations.filter((a) => a.productId === i.productId);
              return (
                <li key={i.productId} className="flex justify-between gap-4">
                  <span>
                    <Link href={`/productos/${i.productId}`} className="font-medium hover:underline">
                      {i.quantity} × {i.productName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {formatUSD(i.unitPriceCents)} c/u · sale de{" "}
                      {from.map((a) => `${a.warehouseName} (${a.quantity})`).join(", ")}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatUSD(i.lineTotalCents)}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between border-t pt-3 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatUSD(order.totalCents)}</span>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Entrega</p>
            <p>
              {order.customerName} · {order.email} · {order.phone}
            </p>
            {order.deliveryMethod === "shipping" ? (
              <p>
                Envío a {order.address}, {order.department}
              </p>
            ) : (
              <p>
                Retiro en {order.pickupWarehouse?.name} ({order.pickupWarehouse?.city})
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
