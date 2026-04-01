import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOrdersByBuyer } from "@/lib/db";
import { mapBuyerOrderToDisplay, type BuyerOrderRecord } from "@/lib/orders";

type DisplayOrder = ReturnType<typeof mapBuyerOrderToDisplay>;

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchOrders() {
      if (!address) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const buyerOrders = await getOrdersByBuyer(address.toLowerCase());
        if (!active) return;
        setOrders((buyerOrders || []).map((order) => mapBuyerOrderToDisplay(order as BuyerOrderRecord)));
      } catch (error) {
        console.error("Error fetching orders:", error);
        if (!active) return;
        setOrders([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void fetchOrders();

    return () => {
      active = false;
    };
  }, [address]);

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
          {orders.map((order) => {
            const heroItem = order.items[0];
            const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <Card key={order.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-32 h-32 flex-shrink-0 bg-muted">
                    {heroItem?.image ? (
                      <img
                        src={heroItem.image}
                        alt={heroItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {order.items.length > 1 ? `${order.items.length} items` : heroItem?.name || "Order"}
                          </h3>
                          <p className="text-sm text-muted-foreground">Order #{order.id}</p>
                        </div>
                        <Badge variant={order.status === "delivered" ? "default" : "secondary"}>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {totalUnits} • Ordered on {order.date}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Tracking: {order.trackingCode}
                      </p>
                      {order.address ? (
                        <p className="text-sm text-muted-foreground mt-1">{order.address}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-lg font-bold">
                        {formatEther(BigInt(Math.round(order.totalEth * 1e18)))} ETH
                      </span>
                      {heroItem ? (
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/products/${heroItem.id}`)}
                        >
                          View Product
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
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
