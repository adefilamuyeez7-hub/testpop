import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cartStore";
import { formatEther } from "viem";

export function ShoppingCart() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, getTotalPrice, getTotalItems, clearCart } =
    useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  if (items.length === 0) {
    return (
      <Card className="col-span-full">
        <CardContent className="pt-12 pb-12 text-center">
          <p className="text-muted-foreground mb-4">Your cart is empty</p>
          <Button onClick={() => navigate("/products")} variant="default">
            Continue Shopping
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalPrice = getTotalPrice();
  const totalItems = getTotalItems();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shopping Cart</CardTitle>
          <CardDescription>{items.length} items • {totalItems} units</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.productId} className="flex gap-4 border-b pb-4 last:border-0 last:pb-0">
                <div className="w-20 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatEther(item.price)} ETH each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.productId, Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-16"
                    />
                    <span className="text-sm font-semibold">
                      {formatEther(item.price * BigInt(item.quantity))} ETH
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.productId)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-semibold">{formatEther(totalPrice)} ETH</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gas estimate:</span>
            <span className="font-semibold">~0.005 ETH</span>
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="font-bold">Total:</span>
            <span className="text-lg font-bold">{formatEther(totalPrice)} ETH</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/products")}
          className="flex-1"
        >
          Continue Shopping
        </Button>
        <Button
          onClick={() => navigate("/checkout")}
          disabled={isCheckingOut}
          className="flex-1 gap-2"
        >
          {isCheckingOut ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Proceed to Checkout
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
