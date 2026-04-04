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
  contract_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  contract_drop_id: z.number().int().min(0).optional(),
  contract_kind: z.enum(["artDrop", "poapCampaign", "poapCampaignV2", "creativeReleaseEscrow"]).optional(),
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
  contract_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  contract_drop_id: z.number().int().min(0).optional(),
  contract_kind: z.enum(["artDrop", "poapCampaign", "poapCampaignV2", "creativeReleaseEscrow"]).optional(),
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
