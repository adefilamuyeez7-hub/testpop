// Common type definitions for the application

// Error types for wagmi/viem operations
export interface Web3Error {
  shortMessage?: string;
  message: string;
  name?: string;
  code?: number;
}

// Product types for marketplace
export interface Product {
  id: string;
  name: string;
  category: string;
  priceEth: string;
  stock: number;
  sold: number;
  status: "active" | "draft" | "out_of_stock";
  nftLink: string;
  uploadedAt: string;
  description: string;
  image?: string;
  imageUri?: string;
}

// Cart/Order types for InvestPage
export interface CartItem {
  product: Product;
  quantity: number;
  addedAt: Date;
}

export interface OrderInfo {
  id: string;
  status: number;
  items: CartItem[];
  total: number;
  deliveryAddress?: string;
  trackingNumber?: string;
}

// Profile types for ArtistStudioPage
export interface ArtistProfile {
  name: string;
  bio: string;
  website: string;
  instagram: string;
  twitter: string;
  discord: string;
  email: string;
  location: string;
  [key: string]: string; // For dynamic form fields
}

// Component prop types
export interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

// Marketplace types
export interface SortOption {
  value: string;
  label: string;
}