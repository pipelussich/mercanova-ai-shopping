"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "./cart-context";

export function CartButton() {
  const { cart } = useCart();
  const count = cart?.itemCount ?? 0;
  return (
    <Link
      href="/carrito"
      className={buttonVariants({ variant: "outline" })}
      aria-label={`Carrito (${count} productos)`}
    >
      <ShoppingCart /> Carrito
      {count > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{count}</span>
      )}
    </Link>
  );
}
