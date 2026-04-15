/**
 * Stub Contract Hooks
 * These are disabled - onchain contracts have been removed
 */

export { useWallet } from "./useWallet";

export function useCreateCampaign() {
  return {
    createCampaignAsync: async () => {
      throw new Error("Onchain contracts are disabled");
    },
    isPending: false,
  };
}

export function useGetSubscriberCountFromArtistContract() {
  return {
    count: 0,
    isLoading: false,
  };
}

export function useSubscribeToArtistContract() {
  return {
    subscribe: async () => {
      throw new Error("Onchain contracts are disabled");
    },
    isPending: false,
  };
}

export function useIsSubscribedToArtistContract() {
  return {
    isSubscribed: false,
    isLoading: false,
  };
}
