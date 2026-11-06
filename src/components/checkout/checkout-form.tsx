"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkoutSchema, type CheckoutInput } from "@/domain/checkout";
import { URUGUAY_DEPARTMENTS } from "@/domain/departments";
import { useCart } from "../cart/cart-context";
import { loadCheckout, saveCheckout, type WarehouseOption } from "./checkout-storage";

type Errors = Partial<Record<keyof CheckoutInput, string>>;

export function CheckoutForm({ warehouses }: { warehouses: WarehouseOption[] }) {
  const router = useRouter();
  const { cart, loading } = useCart();
  const [form, setForm] = useState<Partial<CheckoutInput>>({ deliveryMethod: "shipping", department: "Montevideo" });
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    const saved = loadCheckout();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recuperar datos ya ingresados
    if (saved) setForm((f) => ({ ...f, ...saved }));
  }, []);

  if (!loading && (!cart || cart.lines.length === 0))
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">Tu carrito está vacío: no hay nada para comprar todavía.</p>
          <Link href="/" className={buttonVariants()}>
            Ver el catálogo
          </Link>
        </CardContent>
      </Card>
    );

  const set = (k: keyof CheckoutInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = checkoutSchema.safeParse(form);
    if (!r.success) {
      const next: Errors = {};
      for (const i of r.error.issues) next[i.path[0] as keyof CheckoutInput] ??= i.message;
      setErrors(next);
      return;
    }
    saveCheckout(r.data);
    router.push("/checkout/confirmar");
  };

  const field = (k: keyof CheckoutInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input
        id={k}
        name={k}
        value={(form[k] as string) ?? ""}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={!!errors[k]}
        {...props}
      />
      {errors[k] && <p className="text-sm text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <Card>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          {field("customerName", "Nombre y apellido", { autoComplete: "name" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("email", "Email", { type: "email", autoComplete: "email" })}
            {field("phone", "Teléfono", { type: "tel", autoComplete: "tel" })}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Entrega</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="deliveryMethod"
                checked={form.deliveryMethod === "shipping"}
                onChange={() => set("deliveryMethod", "shipping")}
              />
              Envío a domicilio (gratis)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="deliveryMethod"
                checked={form.deliveryMethod === "pickup"}
                onChange={() => set("deliveryMethod", "pickup")}
              />
              Retiro en un local de MercaNova
            </label>
          </fieldset>

          {form.deliveryMethod === "shipping" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">{field("address", "Dirección", { autoComplete: "street-address" })}</div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="department">Departamento</Label>
                <select
                  id="department"
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  value={form.department ?? ""}
                  onChange={(e) => set("department", e.target.value)}
                >
                  {URUGUAY_DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                {errors.department && <p className="text-sm text-destructive">{errors.department}</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pickupWarehouseId">Local de retiro</Label>
              <select
                id="pickupWarehouseId"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={form.pickupWarehouseId ?? ""}
                onChange={(e) => set("pickupWarehouseId", e.target.value)}
              >
                <option value="">Elegí un local…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.city}
                  </option>
                ))}
              </select>
              {errors.pickupWarehouseId && <p className="text-sm text-destructive">{errors.pickupWarehouseId}</p>}
            </div>
          )}

          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Pago simulado: no te vamos a pedir datos de tarjeta ni se realiza ningún cobro.
          </p>
          <div className="flex justify-between gap-2">
            <Link href="/carrito" className={buttonVariants({ variant: "ghost" })}>
              Volver al carrito
            </Link>
            <Button type="submit" size="lg">
              Revisar compra
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
