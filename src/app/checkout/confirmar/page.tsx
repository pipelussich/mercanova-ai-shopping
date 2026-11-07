import { Suspense } from "react";
import { OrderReview } from "@/components/checkout/order-review";
import { Skeleton } from "@/components/ui/skeleton";
import { requestDb } from "@/server/request-db";
import { listWarehouses } from "@/server/catalog/catalog-service";

export default function ConfirmPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Revisá y confirmá tu compra</h1>
      <p className="text-sm text-muted-foreground">Paso 2 de 2 · La compra se registra sólo cuando confirmás.</p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Review />
      </Suspense>
    </div>
  );
}

async function Review() {
  const warehouses = await listWarehouses(await requestDb());
  return <OrderReview warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, city: w.city }))} />;
}
