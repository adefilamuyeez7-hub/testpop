import { ShoppingCart } from "@/components/ShoppingCart";

export function CartPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
      <div className="max-w-4xl">
        <ShoppingCart />
      </div>
    </div>
  );
}
