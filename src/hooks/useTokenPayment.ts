import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import type { PaymentOption } from "@/lib/paymentConfig";

/**
 * Token approval and payment processor
 * Handles ERC20 token approvals and transfers for USDC/USDT payments
 */

export interface TokenTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  chain: number;
  timestamp: number;
}

export function useTokenPayment(paymentOption: PaymentOption | null) {
  const { address } = useAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const [tx, setTx] = useState<TokenTransaction | null>(null);

  /**
   * Check if user has sufficient token balance
   */
  const checkBalance = useCallback(async (amount: bigint): Promise<boolean> => {
    if (!address || !paymentOption) {
      toast.error("Wallet not connected or payment option missing");
      return false;
    }

    // In production, would call contract.balanceOf(address)
    // For now, we'll show a simulated check
    toast.info("Checking token balance...");

    // Simulate balance check (replace with actual contract call)
    const hasBalance = true;
    if (!hasBalance) {
      toast.error(`Insufficient ${paymentOption.token} balance`);
      return false;
    }

    return true;
  }, [address, paymentOption]);

  /**
   * Approve token spending
   * User must approve the ProductStoreUSDC contract to spend their tokens
   */
  const approveToken = useCallback(
    async (amount: bigint): Promise<string | null> => {
      if (!address || !paymentOption) {
        toast.error("Wallet not connected");
        return null;
      }

      try {
        setIsProcessing(true);
        toast.loading(`Approving ${paymentOption.token}...`);

        // Step 1: Check if approval is needed
        // In production: call contract.allowance(userAddress, spenderAddress)
        const approvalNeeded = true;

        if (!approvalNeeded) {
          toast.dismiss();
          return "approved";
        }

        // Step 2: Send approval transaction
        // In production: call contract.approve(spenderAddress, amount)
        const approvalHash = `0x${Math.random().toString(16).slice(2)}`;

        // Simulate approval confirmation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        toast.dismiss();
        toast.success(`${paymentOption.token} approved for spending`);
        return approvalHash;
      } catch (error) {
        toast.dismiss();
        const message = error instanceof Error ? error.message : "Approval failed";
        toast.error(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [address, paymentOption]
  );

  /**
   * Transfer tokens to merchant wallet
   */
  const transferToken = useCallback(
    async (
      recipientAddress: string,
      amount: bigint,
      description: string
    ): Promise<TokenTransaction | null> => {
      if (!address || !paymentOption) {
        toast.error("Wallet not connected");
        return null;
      }

      try {
        setIsProcessing(true);
        toast.loading(`Sending ${paymentOption.token} payment...`);

        // Step 1: Check balance first
        const hasBalance = await checkBalance(amount);
        if (!hasBalance) {
          toast.dismiss();
          return null;
        }

        // Step 2: Approve if needed
        const approvalHash = await approveToken(amount);
        if (!approvalHash) {
          toast.dismiss();
          return null;
        }

        // Step 3: Transfer tokens
        // In production: call contract.transfer(recipientAddress, amount)
        const transferHash = `0x${Math.random().toString(16).slice(2)}`;

        // Simulate transfer confirmation
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const transaction: TokenTransaction = {
          hash: transferHash,
          from: address,
          to: recipientAddress,
          amount: amount.toString(),
          token: paymentOption.token,
          chain: paymentOption.chainId,
          timestamp: Date.now(),
        };

        setTx(transaction);
        toast.dismiss();
        toast.success(`${paymentOption.token} sent successfully`);

        return transaction;
      } catch (error) {
        toast.dismiss();
        const message = error instanceof Error ? error.message : "Transfer failed";
        toast.error(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [address, paymentOption, checkBalance, approveToken]
  );

  return {
    isProcessing,
    lastTx: tx,
    checkBalance,
    approveToken,
    transferToken,
  };
}

/**
 * Switch network in user's wallet
 * Prompts MetaMask or other wallet to switch chains
 */
export async function switchNetwork(chainId: number, chainName: string, rpcUrl: string): Promise<boolean> {
  if (!window.ethereum) {
    toast.error("Wallet not installed");
    return false;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    // Chain not added yet, try to add it
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${chainId.toString(16)}`,
              chainName,
              rpcUrls: [rpcUrl],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            },
          ],
        });
        return true;
      } catch (addError) {
        toast.error("Failed to add network");
        return false;
      }
    }
    toast.error("Failed to switch network");
    return false;
  }
}

/**
 * Detect if wallet is already connected to desired chain
 */
export async function isConnectedToChain(targetChainId: number): Promise<boolean> {
  if (!window.ethereum) return false;

  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    return parseInt(chainId, 16) === targetChainId;
  } catch {
    return false;
  }
}
