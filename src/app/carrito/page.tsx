import { CartView } from "@/components/cart/cart-view";

export default function CartPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Tu carrito</h1>
      <CartView />
    </div>
  );
}
