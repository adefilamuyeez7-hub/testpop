import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "wagmi";
import { useCartStore } from "@/stores/cartStore";
import { useCheckoutCart } from "@/hooks/useProductStore";
import { formatEther } from "viem";
import { toast } from "sonner";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const checkoutCart = useCheckoutCart();

  const [email, setEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Button onClick={() => navigate("/products")}>Continue Shopping</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPrice = getTotalPrice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !shippingAddress || !city || !postalCode || !country) {
      toast.error("Please fill in all shipping details");
      return;
    }

    try {
      setIsCheckingOut(true);
      // Create order metadata (IPFS would be used in production)
      const orderMetadata = JSON.stringify({
        email,
        shippingAddress,
        city,
        postalCode,
        country,
        notes,
        timestamp: new Date().toISOString(),
      });

      // Execute checkout
      await checkoutCart(totalPrice, orderMetadata);

      // Clear cart after successful checkout
      clearCart();
      setOrderPlaced(true);
      toast.success("Order placed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Checkout failed";
      toast.error(errorMessage);
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Order Confirmed!</h2>
            <p className="text-muted-foreground">
              Your order has been placed successfully. You'll receive a confirmation email shortly.
            </p>
            <div className="pt-4 space-y-2">
              <Button
                onClick={() => navigate("/products")}
                variant="outline"
                className="w-full"
              >
                Continue Shopping
              </Button>
              <Button
                onClick={() => navigate("/orders")}
                className="w-full"
              >
                View My Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate("/cart")}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Cart
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
              <CardDescription>
                Where should we ship your order?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="123 Main St"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="New York"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="postal">Postal Code *</Label>
                    <Input
                      id="postal"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="10001"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Special Instructions</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special delivery instructions?"
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isCheckingOut}
                  className="w-full"
                  size="lg"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    "Complete Purchase"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.name} x {item.quantity}
                    </span>
                    <span className="font-semibold">
                      {formatEther(item.price * BigInt(item.quantity))} ETH
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold">{formatEther(totalPrice)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network Fee:</span>
                  <span className="font-semibold">~0.005 ETH</span>
                </div>
              </div>

              <div className="border-t pt-4 flex justify-between">
                <span className="font-bold">Total:</span>
                <span className="text-lg font-bold">{formatEther(totalPrice)} ETH</span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm">
                <p className="font-semibold mb-1">Powered by Base Sepolia</p>
                <p className="text-muted-foreground">
                  Make sure you have enough ETH in your wallet to complete this transaction.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
