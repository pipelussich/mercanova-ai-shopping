"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-context";

export function AddToCartButton({
  productId,
  productName,
  active,
  availableQty,
  size = "sm",
}: {
  productId: string;
  productName: string;
  active: boolean;
  availableQty: number;
  size?: "sm" | "default" | "lg";
}) {
  const { add } = useCart();
  const [busy, setBusy] = useState(false);

  if (!active)
    return (
      <Button size={size} variant="outline" disabled title="Producto discontinuado">
        Discontinuado
      </Button>
    );
  if (availableQty <= 0)
    return (
      <Button size={size} variant="outline" disabled title="Sin stock disponible">
        Sin stock
      </Button>
    );

  return (
    <Button
      size={size}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await add(productId, 1);
        setBusy(false);
        if (r) toast.success(`Agregaste ${productName} al carrito.`);
      }}
    >
      <ShoppingCart /> Agregar
    </Button>
  );
}
