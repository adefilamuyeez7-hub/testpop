import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "wagmi";
import { useCartStore } from "@/stores/cartStore";
import { formatEther } from "viem";
import { toast } from "sonner";
import { createOrder as dbCreateOrder } from "@/lib/db";
import { buyOnchainProduct } from "@/lib/productStoreChain";
import {
  CHECKOUT_COUNTRIES,
  detectCheckoutCountry,
  formatCheckoutPhone,
  getCheckoutCountryMeta,
  type CheckoutCountry,
} from "@/lib/checkout";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { items, getTotalPrice, clearCart, removeItems } = useCartStore();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState<CheckoutCountry>(detectCheckoutCountry());
  const [notes, setNotes] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutProgress, setCheckoutProgress] = useState("");
  const checkoutInFlightRef = useRef(false);
  const countryMeta = getCheckoutCountryMeta(country);

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

    if (checkoutInFlightRef.current) {
      return;
    }

    if (!email || !phone || !shippingAddress || !city || !postalCode || !country) {
      toast.error("Please fill in all shipping details");
      return;
    }

    if (!address) {
      toast.error("Connect your wallet to place the order");
      return;
    }

    const completedPurchases: Array<{ productId: string; name: string; txHash: `0x${string}` }> = [];

    try {
      checkoutInFlightRef.current = true;
      setIsCheckingOut(true);
      const formattedPhone = formatCheckoutPhone(country, phone);

      for (const item of items) {
        if (!item.contractProductId || item.contractProductId < 1) {
          throw new Error(`"${item.name}" is not linked to the onchain product store yet.`);
        }

        setCheckoutProgress(`Purchasing ${item.name} onchain...`);
        const orderMetadata = JSON.stringify({
          email,
          phone: formattedPhone,
          dial_code: countryMeta.dialCode,
          street: shippingAddress,
          city,
          postal_code: postalCode,
          country,
          notes,
          db_product_id: item.productId,
          contract_product_id: item.contractProductId,
          quantity: item.quantity,
        });

        const purchase = await buyOnchainProduct({
          contractProductId: item.contractProductId,
          quantity: item.quantity,
          unitPriceWei: BigInt(item.price),
          orderMetadata,
          account: address as `0x${string}`,
        });
        completedPurchases.push({ productId: item.productId, name: item.name, txHash: purchase.hash });

        setCheckoutProgress(`Recording ${item.name} order...`);
        try {
          await dbCreateOrder({
            buyer_wallet: address.toLowerCase(),
            product_id: item.productId,
            quantity: item.quantity,
            tx_hash: purchase.hash,
            items: [{
              product_id: item.productId,
              quantity: item.quantity,
            }],
            shipping_address_jsonb: {
              email,
              phone: formattedPhone,
              dial_code: countryMeta.dialCode,
              street: shippingAddress,
              city,
              postal_code: postalCode,
              country,
              notes,
            },
          });
        } catch (recordError) {
          const message = recordError instanceof Error ? recordError.message : "Unknown error";
          throw new Error(
            `Purchase confirmed onchain for "${item.name}" but the order could not be recorded. Tx: ${purchase.hash}. ${message}`
          );
        }
      }

      clearCart();
      setOrderPlaced(true);
      setCheckoutProgress("");
      toast.success("Onchain purchase completed successfully!");
    } catch (error) {
      if (error instanceof Error) {
        console.error("Checkout error:", error);
      }
      const errorMessage = error instanceof Error ? error.message : "Checkout failed";
      if (completedPurchases.length > 0) {
        removeItems(completedPurchases.map((purchase) => purchase.productId));
        const remainingCount = items.length - completedPurchases.length;
        toast.error(
          remainingCount > 0
            ? `${completedPurchases.length} item(s) were purchased successfully. The remaining ${remainingCount} item(s) are still in your cart. ${errorMessage}`
            : errorMessage
        );
      } else {
        toast.error(errorMessage);
      }
      setCheckoutProgress("");
    } finally {
      checkoutInFlightRef.current = false;
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
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="flex rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
                    <div className="flex items-center border-r border-input px-3 text-sm text-muted-foreground">
                      {countryMeta.dialCode}
                    </div>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={countryMeta.phonePlaceholder}
                      className="border-0 shadow-none focus-visible:ring-0"
                      required
                    />
                  </div>
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
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value as CheckoutCountry)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    required
                  >
                    {CHECKOUT_COUNTRIES.map((option) => (
                      <option key={option.name} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
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
                      {checkoutProgress || "Processing..."}
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
                      {formatEther(BigInt(item.price) * BigInt(item.quantity))} ETH
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
                  <span className="text-muted-foreground">Estimated wallet gas:</span>
                  <span className="font-semibold">Paid separately</span>
                </div>
              </div>

              <div className="border-t pt-4 flex justify-between">
                <span className="font-bold">Items total:</span>
                <span className="text-lg font-bold">{formatEther(totalPrice)} ETH</span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm">
                <p className="font-semibold mb-1">Powered by Base Sepolia</p>
                <p className="text-muted-foreground">
                  Checkout submits an onchain purchase for each product in your cart, records the matching tx hash in your order history, and asks your wallet to confirm gas separately.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
