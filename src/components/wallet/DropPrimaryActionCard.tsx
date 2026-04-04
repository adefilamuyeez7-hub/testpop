import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Gavel, ShoppingCart } from "lucide-react";
import { parseEther } from "viem";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampaignActionPanel } from "@/components/campaign/CampaignActionPanel";
import { useWallet, usePlaceBid } from "@/hooks/useContracts";
import { useMintArtist } from "@/hooks/useContractsArtist";
import type { Product } from "@/lib/db";
import { resolveDropBehavior } from "@/lib/dropBehavior";
import type { Web3Error } from "@/lib/types";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import { useCartStore } from "@/stores/cartStore";

type DropActionData = {
  id: string;
  title: string;
  artist: string;
  priceEth: string;
  currentBidEth?: string;
  maxBuy?: number;
  bought?: number;
  bids: number;
  type: "drop" | "auction" | "campaign";
  endsIn: string;
  contractAddress: string | null;
  contractDropId?: number | null;
  contractKind?: "artDrop" | "poapCampaign" | "poapCampaignV2" | "creativeReleaseEscrow" | "productStore" | null;
  assetType: string;
  previewUri?: string;
  deliveryUri?: string;
  image: string;
  metadata?: Record<string, unknown>;
};

type DropPrimaryActionCardProps = {
  drop: DropActionData;
  linkedProduct?: Product | null;
  sourceKind?: string | null;
  onCollectSuccess: (payload: { ownerWallet: string; mintedTokenId: number | null }) => void;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function DropPrimaryActionCardInner({
  drop,
  linkedProduct,
  sourceKind,
  onCollectSuccess,
}: DropPrimaryActionCardProps) {
  const navigate = useNavigate();
  const { address, isConnected, connectWallet, chain, requestActiveChainSwitch, isSwitchingNetwork } = useWallet();
  const { placeBid, isPending: isBidPending, isConfirming: isBidConfirming, isSuccess: isBidSuccess, error: bidError } = usePlaceBid();
  const { mint: mintArtist, mintedTokenId, isConfirming: isMintConfirming, isSuccess: isMintSuccess, error: mintError } = useMintArtist();
  const { addItem, items } = useCartStore();
  const [bidAmount, setBidAmount] = useState("");

  const remaining = (drop.maxBuy ?? 0) - (drop.bought ?? 0);
  const boughtPct = drop.maxBuy ? Math.round(((drop.bought ?? 0) / drop.maxBuy) * 100) : 0;
  const hasContractAddress = Boolean(drop.contractAddress && drop.contractAddress !== ZERO_ADDRESS);
  const hasContractListing = drop.contractDropId !== null && drop.contractDropId !== undefined;
  const behavior = useMemo(
    () =>
      resolveDropBehavior({
        drop,
        linkedProduct,
        sourceKind,
      }),
    [drop, linkedProduct, sourceKind]
  );
  const isBuyDrop = behavior.mode === "collect";
  const isAuctionDrop = behavior.mode === "auction";
  const isCampaignDrop = behavior.mode === "campaign";
  const isCheckoutDrop = behavior.mode === "checkout";
  const checkoutContractKind =
    linkedProduct?.contract_kind ??
    (drop.contractKind === "creativeReleaseEscrow" || drop.contractKind === "productStore"
      ? drop.contractKind
      : "productStore");
  const checkoutPriceEth = String(linkedProduct?.price_eth ?? drop.priceEth ?? "0");
  const checkoutPriceWei = useMemo(() => {
    try {
      return parseEther(checkoutPriceEth);
    } catch {
      return 0n;
    }
  }, [checkoutPriceEth]);
  const availableUnits = Math.max(
    0,
    (linkedProduct?.stock ?? drop.maxBuy ?? 0) - (linkedProduct?.sold ?? drop.bought ?? 0)
  );
  const isUnlimitedStock = (linkedProduct?.stock ?? 0) === 0;
  const isCheckoutSoldOut = (linkedProduct?.stock ?? 0) > 0 && availableUnits <= 0;
  const existingCartItem = linkedProduct?.id
    ? items.find((item) => item.productId === linkedProduct.id)
    : null;

  useEffect(() => {
    if (isMintSuccess && address) {
      onCollectSuccess({ ownerWallet: address, mintedTokenId });
    }
  }, [address, isMintSuccess, mintedTokenId, onCollectSuccess]);

  useEffect(() => {
    if (isBidSuccess) {
      toast.success("Bid placed successfully!");
    }
  }, [isBidSuccess]);

  useEffect(() => {
    if (bidError) {
      toast.error(`Bid failed: ${bidError?.message || "Unknown error"}`);
    }
  }, [bidError]);

  useEffect(() => {
    if (isCheckoutDrop && linkedProduct?.id && !behavior.isOnchainReady) {
      console.warn("Checkout drop is missing onchain linkage", {
        dropId: drop.id,
        productId: linkedProduct.id,
        contractKind: checkoutContractKind,
        contractListingId: linkedProduct.contract_listing_id,
        contractProductId: linkedProduct.contract_product_id,
      });
    }
  }, [behavior.isOnchainReady, checkoutContractKind, drop.id, isCheckoutDrop, linkedProduct]);

  useEffect(() => {
    if (!mintError) return;

    const errMsg = (mintError as Web3Error)?.message || "Unknown error";
    if (errMsg.includes("Failed to fetch")) {
      toast.error(`Wallet or RPC connection failed. Switch to Base Sepolia and try again.`);
      return;
    }
    if (errMsg.toLowerCase().includes("requested resource is unavailable")) {
      toast.error(`Your wallet could not reach ${ACTIVE_CHAIN.name}. Switch networks in the wallet, reconnect, and try again.`);
      return;
    }
    if (errMsg.includes("insufficient funds")) {
      toast.error("Insufficient balance for mint plus gas fees.");
      return;
    }
    if (errMsg.includes("network fee") || errMsg.includes("gas")) {
      toast.error("Network congested. Try again in a moment.");
      return;
    }
    toast.error(`Mint failed: ${errMsg}`);
  }, [mintError]);

  const handleCollectDrop = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (chain?.id !== ACTIVE_CHAIN.id) {
      try {
        await requestActiveChainSwitch(`Collecting this drop requires ${ACTIVE_CHAIN.name}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Switch to ${ACTIVE_CHAIN.name} and try again.`);
      }
      return;
    }
    if (!isBuyDrop) {
      toast.error("This listing is not a direct collect drop.");
      return;
    }
    if (remaining <= 0) {
      toast.error("Sold out");
      return;
    }
    if (!hasContractListing || drop.contractDropId === null) {
      toast.error("This drop is not linked to a live ArtDrop listing yet.");
      return;
    }
    if (!hasContractAddress || !drop.contractAddress) {
      toast.error("Artist contract not properly deployed yet.");
      return;
    }

    mintArtist(drop.contractDropId, parseEther(drop.priceEth), drop.contractAddress);
  };

  const handlePlaceBid = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (chain?.id !== ACTIVE_CHAIN.id) {
      try {
        await requestActiveChainSwitch(`Bidding on this drop requires ${ACTIVE_CHAIN.name}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Switch to ${ACTIVE_CHAIN.name} and try again.`);
      }
      return;
    }
    if (!isAuctionDrop) {
      toast.error("This listing is not an auction.");
      return;
    }
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      toast.error("Enter a valid bid amount");
      return;
    }
    if (!hasContractListing || drop.contractDropId === null) {
      toast.error("Auction not linked to contract");
      return;
    }

    placeBid(drop.contractDropId, bidAmount);
    toast.loading("Placing bid...");
  };

  const handleAddToCart = async () => {
    if (!linkedProduct?.id) {
      toast.error("This release is still syncing with checkout.");
      return;
    }
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (!behavior.isOnchainReady) {
      toast.error("This release is not ready for checkout yet.");
      return;
    }
    if (isCheckoutSoldOut) {
      toast.error("This release is sold out.");
      return;
    }

    addItem(
      linkedProduct.id,
      linkedProduct.creative_release_id ?? null,
      checkoutContractKind,
      linkedProduct.contract_listing_id ?? null,
      linkedProduct.contract_product_id ?? null,
      1,
      checkoutPriceWei,
      linkedProduct.name || drop.title,
      linkedProduct.image_url || drop.image || ""
    );
    toast.success("Added to cart!");
  };

  const handleCheckoutNow = async () => {
    if (!linkedProduct?.id) {
      toast.error("This release is still syncing with checkout.");
      return;
    }
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (!behavior.isOnchainReady) {
      toast.error("This release is not ready for checkout yet.");
      return;
    }
    if (isCheckoutSoldOut) {
      toast.error("This release is sold out.");
      return;
    }

    if (!existingCartItem) {
      addItem(
        linkedProduct.id,
        linkedProduct.creative_release_id ?? null,
        checkoutContractKind,
        linkedProduct.contract_listing_id ?? null,
        linkedProduct.contract_product_id ?? null,
        1,
        checkoutPriceWei,
        linkedProduct.name || drop.title,
      linkedProduct.image_url || drop.image || ""
    );
    }

    navigate("/checkout");
  };

  return (
    <div className="p-4 rounded-2xl bg-card shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {isAuctionDrop && drop.currentBidEth ? "Current Bid" : "Price"}
          </p>
          <p className="text-xl font-bold text-primary">
            {isCheckoutDrop ? checkoutPriceEth : drop.currentBidEth || drop.priceEth} ETH
          </p>
        </div>
        {drop.bids > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Gavel className="h-3 w-3" /> {drop.bids} bids
          </p>
        )}
      </div>

      {isBuyDrop ? (
        <>
          <div className="mb-3">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full gradient-primary" style={{ width: `${boughtPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {drop.bought || 0} of {drop.maxBuy} claimed · {remaining} left
            </p>
          </div>
          <Button
            onClick={handleCollectDrop}
            disabled={!hasContractListing || remaining <= 0 || isMintConfirming || isMintSuccess || isSwitchingNetwork}
            className="w-full rounded-full gradient-primary text-primary-foreground font-semibold h-11"
          >
            {isMintConfirming ? "Collecting..." : isMintSuccess ? "Collected" : `Collect · ${drop.priceEth} ETH`}
          </Button>
          {mintError && (
            <p className="text-xs text-destructive mt-2">
              {(mintError as Web3Error).shortMessage || (mintError as Web3Error).message}
            </p>
          )}
        </>
      ) : isCheckoutDrop ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center justify-between">
              <span>Availability</span>
              <span className="font-semibold text-foreground">
                {isUnlimitedStock ? "Open edition" : `${availableUnits} left`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fulfillment</span>
              <span className="font-semibold text-foreground capitalize">
                {linkedProduct?.product_type || "physical"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delivery</span>
              <span className="font-semibold text-foreground">
                {linkedProduct?.delivery_uri || drop.deliveryUri ? "Gated access" : "Standard checkout"}
              </span>
            </div>
          </div>
          {!behavior.isOnchainReady && (
            <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              This release is visible, but its checkout contract is not ready yet.
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleAddToCart}
              disabled={!linkedProduct?.id || !behavior.isOnchainReady || isCheckoutSoldOut}
              variant="outline"
              className="flex-1 rounded-full h-11"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {isCheckoutSoldOut ? "Sold Out" : "Add to Cart"}
            </Button>
            <Button
              onClick={handleCheckoutNow}
              disabled={!linkedProduct?.id || !behavior.isOnchainReady || isCheckoutSoldOut}
              className="flex-1 rounded-full gradient-primary text-primary-foreground font-semibold h-11"
            >
              {isCheckoutSoldOut ? "Sold Out" : "Checkout Now"}
            </Button>
          </div>
        </div>
      ) : isAuctionDrop ? (
        <div className="space-y-3">
          <Input
            type="number"
            min="0.001"
            value={bidAmount}
            onChange={(event) => setBidAmount(event.target.value)}
            placeholder="Enter bid amount (ETH)"
            className="h-10 rounded-xl bg-secondary text-sm"
          />
          <p className="text-xs text-muted-foreground">Auction bidding is live on-chain for this listing.</p>
          <Button
            onClick={handlePlaceBid}
            disabled={isBidPending || isBidConfirming || isSwitchingNetwork}
            className="w-full rounded-full gradient-primary text-primary-foreground font-semibold h-11"
          >
            {isBidPending || isBidConfirming ? "Confirming..." : "Place Bid"}
          </Button>
        </div>
      ) : isCampaignDrop ? (
        <CampaignActionPanel
          dropId={drop.id}
          fallbackTitle={drop.title}
          fallbackPriceEth={drop.priceEth}
          contractCampaignId={drop.contractDropId}
          contractAddress={drop.contractAddress}
          campaignMetadata={drop.metadata}
        />
      ) : (
        <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          This drop has an unsupported contract configuration.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px] capitalize">
          {isCheckoutDrop ? "checkout" : drop.type === "drop" ? "collect" : drop.type}
        </Badge>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {drop.endsIn}
        </p>
      </div>
    </div>
  );
}

const DropPrimaryActionCard = (props: DropPrimaryActionCardProps) => <DropPrimaryActionCardInner {...props} />;

export default DropPrimaryActionCard;
