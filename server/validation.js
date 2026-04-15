/**
 * Input Validation Schemas
 * 
 * Comprehensive Zod-based validation for all API endpoints.
 * Ensures type safety, prevents injection attacks, and validates business logic.
 * 
 * Usage:
 *   const { success, data, error } = validateInput(schema, userInput);
 *   if (!success) return res.status(400).json({ error, details: error.errors });
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM VALIDATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ethereum wallet address validator (0x followed by 40 hex chars)
 */
const walletSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address");

/**
 * UUID validator for database IDs
 */
const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Transaction hash validator (0x followed by 64 hex chars)
 */
const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");

/**
 * IPFS URI validator
 */
const ipfsUriSchema = z
  .string()
  .startsWith("ipfs://", "IPFS URI must start with ipfs://");

/**
 * URL validator
 */
const urlSchema = z.string().url("Invalid URL format").optional();

/**
 * Price validator (non-negative number)
 */
const priceSchema = z
  .number()
  .min(0, "Price cannot be negative")
  .max(1000000, "Price exceeds maximum");

/**
 * Positive integer validator
 */
const positiveIntSchema = z
  .number()
  .int("Must be integer")
  .min(1, "Must be greater than 0");

// ═══════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const authChallengeSchema = z.object({
  wallet: walletSchema,
});

export const authVerifySchema = z.object({
  wallet: walletSchema,
  signature: z.string().min(130, "Invalid signature length"),
  nonce: z.string().length(64, "Invalid nonce length"),
});

// ═══════════════════════════════════════════════════════════════════════════
// ARTIST SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const artistProfileSchema = z.object({
  wallet: walletSchema,
  name: z.string().min(1).max(200).optional(),
  handle: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: urlSchema,
  banner_url: urlSchema,
  twitter_url: urlSchema,
  instagram_url: urlSchema,
  website_url: urlSchema,
  portfolio: z.array(z.string()).optional(),
  contact_email: z.string().email().optional(),
});

export const artistApplicationSchema = z.object({
  artist_name: z.string().min(1).max(200),
  bio: z.string().max(1000),
  portfolio_url: urlSchema,
  twitter_url: urlSchema,
  instagram_url: urlSchema,
  art_types: z.array(z.string()).min(1),
  website_url: urlSchema,
});

// ═══════════════════════════════════════════════════════════════════════════
// DROP SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const dropCreateSchema = z.object({
  artist_id: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price_eth: priceSchema.optional(),
  supply: positiveIntSchema.optional(),
  image_url: urlSchema,
  image_ipfs_uri: ipfsUriSchema.optional(),
  metadata_ipfs_uri: ipfsUriSchema.optional(),
  asset_type: z.enum(["image", "video", "audio", "pdf", "epub"]).optional(),
  is_gated: z.boolean().optional(),
  type: z.enum(["drop", "auction", "campaign"]).optional(),
  ends_at: z.string().datetime().optional(),
});

export const dropUpdateSchema = dropCreateSchema.partial();

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const productCreateSchema = z.object({
  artist_id: uuidSchema.optional(),
  creator_wallet: walletSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: priceSchema,
  supply: z.number().int().min(1).optional(),
  product_type: z.enum(["digital", "physical", "hybrid"]),
  image_url: urlSchema,
  image_ipfs_uri: ipfsUriSchema.optional(),
  metadata_ipfs_uri: ipfsUriSchema,
  asset_type: z
    .enum(["image", "video", "audio", "pdf", "epub", "merchandise", "digital"])
    .optional(),
  is_gated: z.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

// ═══════════════════════════════════════════════════════════════════════════
// ORDER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const orderItemSchema = z.object({
  product_id: uuidSchema,
  quantity: positiveIntSchema,
});

export const orderCreateSchema = z.object({
  buyer_wallet: walletSchema,
  items: z.array(orderItemSchema).min(1).optional(),
  product_id: uuidSchema.optional(),
  quantity: z.number().int().min(1).optional(),
  tx_hash: txHashSchema.optional(),
  total_price: priceSchema.optional(),
  shipping_address_jsonb: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

export const orderUpdateSchema = z.object({
  status: z.enum(["pending", "paid", "processing", "shipped", "delivered"]).optional(),
  tx_hash: txHashSchema.optional(),
  approval_status: z.enum(["pending", "approved", "rejected"]).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const campaignCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000),
  artist_id: uuidSchema,
  drop_id: uuidSchema,
  category: z.enum(["music", "art", "film", "gaming", "other"]).optional(),
  budget_eth: priceSchema.optional(),
  target_audience: z.string().max(1000).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
});

export const campaignSubmissionSchema = z.object({
  campaign_id: uuidSchema,
  artist_wallet: walletSchema,
  content_url: urlSchema,
  caption: z.string().max(500).optional(),
  content_type: z.enum(["image", "video", "text"]).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// INVESTMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const investmentCreateSchema = z.object({
  campaign_id: uuidSchema,
  investor_wallet: walletSchema,
  amount_eth: priceSchema.min(0.001, "Minimum investment: 0.001 ETH"),
  tx_hash: txHashSchema.optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// WHITELIST SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const whitelistEntrySchema = z.object({
  wallet: walletSchema,
  status: z.enum(["pending", "approved", "rejected"]),
  reason: z.string().max(500).optional(),
});

export const whitelistUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  admin_notes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE UPLOAD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().min(1).max(100 * 1024 * 1024), // Max 100MB
  mimetype: z.enum([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
    "application/pdf",
  ]),
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const notificationSchema = z.object({
  recipient_wallet: walletSchema,
  title: z.string().min(1).max(200),
  message: z.string().max(5000),
  type: z.enum(["info", "success", "warning", "error"]),
  action_url: urlSchema,
});

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate input data against a Zod schema
 * 
 * @param {z.ZodSchema} schema - Zod validation schema
 * @param {any} data - Data to validate
 * @returns {Object} { success: boolean, data?: any, error?: ZodError }
 * 
 * @example
 *   const result = validateInput(productCreateSchema, req.body);
 *   if (!result.success) {
 *     return res.status(400).json({ error: result.error.message });
 *   }
 */
export function validateInput(schema, data) {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    return {
      success: false,
      error: error.errors || [{ message: error.message }],
    };
  }
}

/**
 * Safely coerce string input to correct types
 * Useful for query parameters which arrive as strings
 * 
 * @example
 *   const limit = coerceNumber(req.query.limit, 20, 100);
 */
export function coerceNumber(value, defaultValue, max = null) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return defaultValue;
  if (max !== null && num > max) return max;
  return num;
}

export default {
  validateInput,
  coerceNumber,
  // Schemas
  authChallengeSchema,
  authVerifySchema,
  artistProfileSchema,
  artistApplicationSchema,
  dropCreateSchema,
  dropUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  orderCreateSchema,
  orderUpdateSchema,
  campaignCreateSchema,
  campaignSubmissionSchema,
  investmentCreateSchema,
  whitelistEntrySchema,
  whitelistUpdateSchema,
  fileUploadSchema,
  notificationSchema,
};
import { z } from "zod";

// Drop validation schema
export const dropUpdateSchema = z.object({
  creative_release_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price_eth: z.number().min(0).optional(),
  supply: z.number().int().min(0).optional(),
  image_url: z.string().url().optional(),
  metadata_ipfs_uri: z.string().startsWith("ipfs://").optional(),
  image_ipfs_uri: z.string().startsWith("ipfs://").optional(),
  asset_type: z.enum(["image", "video", "audio", "pdf", "epub"]).optional(),
  preview_uri: z.string().optional(),
  delivery_uri: z.string().optional(),
  is_gated: z.boolean().optional(),
  status: z.enum(["draft", "live", "published", "ended"]).optional(),
  type: z.enum(["drop", "auction", "campaign"]).optional(),
  revenue: z.number().min(0).optional(),
  ends_at: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

// Product validation schema
export const productCreateSchema = z.object({
  artist_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0),
  supply: z.number().int().min(0).optional(),
  product_type: z.enum(["digital", "physical", "hybrid"]),
  image_url: z.string().url().optional(),
  metadata_ipfs_uri: z.string().startsWith("ipfs://"),
  image_ipfs_uri: z.string().startsWith("ipfs://").optional(),
  asset_type: z.enum(["image", "video", "audio", "pdf", "epub", "merchandise", "digital"]).optional(),
  preview_uri: z.string().optional(),
  delivery_uri: z.string().optional(),
  is_gated: z.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
  metadata: z.record(z.any()).optional(),
});

// Campaign submission schema
export const campaignSubmissionSchema = z.object({
  dropId: z.string(),
  contentUrl: z.string().url().optional(),
  caption: z.string().max(500).optional(),
}).refine(data => data.contentUrl || data.caption, {
  message: "Either contentUrl or caption must be provided",
});

// Order validation schema
export const orderCreateSchema = z.object({
  product_id: z.string().uuid(),
  buyer_wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  quantity: z.number().int().min(1),
  tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  total_price: z.number().min(0),
});

// Validation helper
export function validateInput(schema, data) {
  try {
    return { success: true, data: schema.parse(data) };
  } catch (error) {
    return { success: false, error: error.errors };
  }
}
