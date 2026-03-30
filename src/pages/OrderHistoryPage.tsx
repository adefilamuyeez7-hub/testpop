import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useGetUserOrders, useGetOrder } from "@/hooks/useProductStore";
import { formatEther } from "viem";
import { Loader2 } from "lucide-react";

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { orderIds, isLoading: ordersLoading } = useGetUserOrders(address);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's real orders from Supabase or contract
  // TODO: Replace with actual contract queries for user's orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        if (!address || !ordersLoading) {
          // TODO: Fetch real orders from Supabase or contract
          setOrders([]);
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching orders:", error);
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [address, ordersLoading]);

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground mb-4">Please connect your wallet to view orders</p>
            <Button onClick={() => navigate("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Order History</h1>
        <p className="text-muted-foreground">Track your purchases</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length > 0 ? (
        <div className="grid gap-6">
          {orders.map((order) => (
            <Card key={order.orderId} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {/* Product Image */}
                <div className="w-full md:w-32 h-32 flex-shrink-0 bg-muted">
                  <img
                    src={order.productImage}
                    alt={order.productName}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Order Details */}
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{order.productName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Order #{order.orderId}
                        </p>
                      </div>
                      <Badge variant={order.fulfilled ? "default" : "secondary"}>
                        {order.fulfilled ? "Fulfilled" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {order.quantity} • Ordered on{" "}
                      {new Date(order.timestamp).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-lg font-bold">
                      {formatEther(order.totalPrice)} ETH
                    </span>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/products/${order.productName.split(" ").join("-")}`)
                      }
                    >
                      View Product
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground mb-4">You haven't placed any orders yet</p>
            <Button onClick={() => navigate("/products")}>Shop Now</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
