/**
 * Input validation utilities for the PopUp application
 */

export function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export function isValidEthereumAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 1000; // Reasonable limits
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' };
  }

  return { valid: true };
}

export function validateProductForm(data: {
  name: string;
  description: string;
  priceEth: string;
  stock: number;
  category: string;
  nftLink: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.name.trim()) {
    errors.name = 'Product name is required';
  } else if (data.name.length > 100) {
    errors.name = 'Product name must be less than 100 characters';
  }

  if (!data.description.trim()) {
    errors.description = 'Description is required';
  } else if (data.description.length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  if (!isValidEthereumAmount(data.priceEth)) {
    errors.priceEth = 'Please enter a valid Ethereum amount (0.001 - 1000 ETH)';
  }

  if (data.stock < 0 || data.stock > 10000) {
    errors.stock = 'Stock must be between 0 and 10,000';
  }

  if (!data.category) {
    errors.category = 'Please select a category';
  }

  if (data.nftLink && !isValidUrl(data.nftLink)) {
    errors.nftLink = 'Please enter a valid URL';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
// ─────────────────────────────────────────────────────────────────────────────
//  Wallet & Application Validation (Zod)
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

/**
 * Normalize a wallet address to lowercase with 0x prefix.
 * Used consistently across all DB operations to prevent duplicates.
 */
export function normalizeWallet(address: string | undefined): string {
  if (!address) throw new Error("Wallet address is required.");
  const normalized = address.toLowerCase().trim();
  if (!normalized.startsWith("0x")) return `0x${normalized}`;
  return normalized;
}

export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
  .transform(normalizeWallet);

/**
 * Full Zod schema for artist application form submissions.
 */
export const artistApplicationSchema = z.object({
  wallet_address: ethereumAddressSchema,
  email: z.string().email("Invalid email address"),
  artist_name: z
    .string()
    .min(2, "Artist name must be at least 2 characters")
    .max(100, "Artist name must be under 100 characters"),
  bio: z
    .string()
    .min(10, "Bio must be at least 10 characters")
    .max(1000, "Bio must be under 1000 characters"),
  art_types: z.array(z.string()).min(1, "Select at least one art type"),
  twitter_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  instagram_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  website_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  portfolio_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  terms_agreed: z
    .boolean()
    .refine((val) => val === true, "You must agree to the terms"),
});

export type ArtistApplicationInput = z.infer<typeof artistApplicationSchema>;

/**
 * Parse and validate raw form data against the artist application schema.
 * Converts Zod errors into a single readable message.
 */
export function validateApplicationData(data: unknown): ArtistApplicationInput {
  try {
    return artistApplicationSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      throw new Error(`Validation failed: ${messages.join(", ")}`);
    }
    throw error;
  }
}
