import { useEffect, useState } from "react";

const STORAGE_KEY = "popup-demo-wallet";

function randomAddress() {
  return `0x${Math.random().toString(16).slice(2, 6)}...${Math.random()
    .toString(16)
    .slice(2, 6)}`.toUpperCase();
}

export function useDemoWallet() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setAddress(saved);
    }
  }, []);

  const connect = () => {
    const next = randomAddress();
    window.localStorage.setItem(STORAGE_KEY, next);
    setAddress(next);
  };

  const disconnect = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
  };

  return {
    address,
    isConnected: Boolean(address),
    connect,
    disconnect,
  };
}
