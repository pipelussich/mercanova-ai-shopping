import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requestDb } from "@/server/request-db";
import { formatUSD } from "@/domain/money";
import { dateFormat } from "@/lib/format";
import { listOrders } from "@/server/orders/order-service";
import { getSessionId } from "@/server/session";

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mis órdenes</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Orders />
      </Suspense>
    </div>
  );
}

async function Orders() {
  const orders = await listOrders(await requestDb(), await getSessionId());
  if (orders.length === 0)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-muted-foreground">Todavía no hiciste ninguna compra.</p>
          <Link href="/" className={buttonVariants()}>
            Ver el catálogo
          </Link>
        </CardContent>
      </Card>
    );
  return (
    <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orden</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Entrega</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Link href={`/ordenes/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                  {o.id}
                </Link>
              </TableCell>
              <TableCell>{dateFormat.format(new Date(o.createdAt))}</TableCell>
              <TableCell>{o.items.reduce((s, i) => s + i.quantity, 0)}</TableCell>
              <TableCell>{o.deliveryMethod === "shipping" ? "Envío" : "Retiro"}</TableCell>
              <TableCell className="text-right tabular-nums">{formatUSD(o.totalCents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
