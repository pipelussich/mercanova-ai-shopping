import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/db/client";
import { listWarehouses } from "@/server/catalog/catalog-service";

export default function CheckoutPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
      <p className="text-sm text-muted-foreground">
        Paso 1 de 2 · Datos de entrega. En el paso siguiente vas a revisar y confirmar la compra.
      </p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const warehouses = await listWarehouses(getDb());
  return (
    <CheckoutForm
      warehouses={warehouses.filter((w) => w.pickup_enabled).map((w) => ({ id: w.id, name: w.name, city: w.city }))}
    />
  );
}
