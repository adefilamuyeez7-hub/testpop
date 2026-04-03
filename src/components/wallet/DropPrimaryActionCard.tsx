import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Gavel } from "lucide-react";
import { parseEther } from "viem";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampaignActionPanel } from "@/components/campaign/CampaignActionPanel";
import { useWallet, usePlaceBid } from "@/hooks/useContracts";
import { useMintArtist } from "@/hooks/useContractsArtist";
import type { Web3Error } from "@/lib/types";
import { ACTIVE_CHAIN } from "@/lib/wagmi";

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
  contractKind?: "artDrop" | "poapCampaign" | "poapCampaignV2" | null;
  assetType: string;
  previewUri?: string;
  deliveryUri?: string;
  image: string;
};

type DropPrimaryActionCardProps = {
  drop: DropActionData;
  onCollectSuccess: (payload: { ownerWallet: string; mintedTokenId: number | null }) => void;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function DropPrimaryActionCardInner({ drop, onCollectSuccess }: DropPrimaryActionCardProps) {
  const { address, isConnected, connectWallet, chain, requestActiveChainSwitch, isSwitchingNetwork } = useWallet();
  const { placeBid, isPending: isBidPending, isConfirming: isBidConfirming, isSuccess: isBidSuccess, error: bidError } = usePlaceBid();
  const { mint: mintArtist, mintedTokenId, isConfirming: isMintConfirming, isSuccess: isMintSuccess, error: mintError } = useMintArtist();
  const [bidAmount, setBidAmount] = useState("");

  const remaining = (drop.maxBuy ?? 0) - (drop.bought ?? 0);
  const boughtPct = drop.maxBuy ? Math.round(((drop.bought ?? 0) / drop.maxBuy) * 100) : 0;
  const hasContractAddress = Boolean(drop.contractAddress && drop.contractAddress !== ZERO_ADDRESS);
  const hasContractListing = drop.contractDropId !== null && drop.contractDropId !== undefined;
  const isBuyDrop = drop.type === "drop" && drop.contractKind === "artDrop";
  const isAuctionDrop = drop.type === "auction" && drop.contractKind === "poapCampaign";
  const isCampaignDrop = drop.type === "campaign";

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

  return (
    <div className="p-4 rounded-2xl bg-card shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-muted-foreground">{isAuctionDrop && drop.currentBidEth ? "Current Bid" : "Price"}</p>
          <p className="text-xl font-bold text-primary">{drop.currentBidEth || drop.priceEth} ETH</p>
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
          contractCampaignId={drop.contractDropId}
          contractAddress={drop.contractAddress}
        />
      ) : (
        <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          This drop has an unsupported contract configuration.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px] capitalize">
          {drop.type === "drop" ? "collect" : drop.type}
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
