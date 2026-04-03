import type { AssetType } from "@/lib/assetTypes";
import { resolveMediaUrl } from "@/lib/pinata";

type DropCoverInput = {
  assetType?: AssetType | null;
  previewUri?: string | null;
  imageUrl?: string | null;
  imageIpfsUri?: string | null;
  deliveryUri?: string | null;
  metadata?: Record<string, unknown> | null;
};

const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const BARE_IPFS_CID_PATTERN = /^(bafy[a-z2-7]+|bafk[a-z2-7]+|Qm[1-9A-HJ-NP-Za-km-z]{44,})$/;

function trimCandidate(candidate?: string | null) {
  return candidate?.trim() || "";
}

function stripQueryAndHash(value: string) {
  return value.replace(/[?#].*$/, "");
}

function normalizeIpfsLikeValue(value: string) {
  const stripped = stripQueryAndHash(value);
  const gatewayMatch = stripped.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i);
  if (gatewayMatch?.[1]) {
    return `ipfs://${gatewayMatch[1]}`;
  }

  if (/^ipfs:\/\/ipfs\//i.test(stripped)) {
    return `ipfs://${stripped.replace(/^ipfs:\/\/ipfs\//i, "")}`;
  }

  if (/^ipfs:\/\//i.test(stripped)) {
    return `ipfs://${stripped.replace(/^ipfs:\/\//i, "")}`;
  }

  if (BARE_IPFS_CID_PATTERN.test(stripped)) {
    return `ipfs://${stripped}`;
  }

  return stripped;
}

function isIpfsLikeValue(value: string) {
  const stripped = stripQueryAndHash(value);
  return (
    /^ipfs:\/\//i.test(stripped) ||
    /^https?:\/\/[^/]+\/ipfs\/.+/i.test(stripped) ||
    BARE_IPFS_CID_PATTERN.test(stripped)
  );
}

export function sameMediaTarget(left?: string | null, right?: string | null) {
  const normalizedLeft = trimCandidate(left);
  const normalizedRight = trimCandidate(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizeIpfsLikeValue(normalizedLeft) === normalizeIpfsLikeValue(normalizedRight);
}

export function isLikelyPreviewableImageUrl(candidate?: string | null) {
  const value = trimCandidate(candidate);
  if (!value) {
    return false;
  }

  if (/^data:image\//i.test(value)) {
    return true;
  }

  if (/^(blob:|file:|about:)/i.test(value)) {
    return false;
  }

  if (isIpfsLikeValue(value)) {
    return true;
  }

  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  return IMAGE_EXTENSION_PATTERN.test(stripQueryAndHash(value));
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getMetadataCoverCandidate(metadata?: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const directCandidate =
    readStringField(metadata, "coverImageUri") ||
    readStringField(metadata, "cover_image_uri") ||
    readStringField(metadata, "cover_image") ||
    readStringField(metadata, "previewUri") ||
    readStringField(metadata, "preview_uri");

  if (directCandidate) {
    return directCandidate;
  }

  const properties = metadata.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return "";
  }

  const propertiesRecord = properties as Record<string, unknown>;
  return (
    readStringField(propertiesRecord, "coverImageUri") ||
    readStringField(propertiesRecord, "cover_image_uri") ||
    readStringField(propertiesRecord, "cover_image") ||
    readStringField(propertiesRecord, "previewUri") ||
    readStringField(propertiesRecord, "preview_uri")
  );
}

export function resolveDropCoverImage({
  assetType,
  previewUri,
  imageUrl,
  imageIpfsUri,
  deliveryUri,
  metadata,
}: DropCoverInput) {
  const metadataCover = getMetadataCoverCandidate(metadata);
  const candidates = [metadataCover, previewUri, imageUrl, imageIpfsUri];
  const shouldAvoidDeliveryAsset = Boolean(assetType && assetType !== "image");
  const uniqueCandidateTargets = new Set(
    candidates
      .map((candidate) => trimCandidate(candidate))
      .filter(Boolean)
      .map((candidate) => normalizeIpfsLikeValue(candidate))
  );
  const hasOnlyOneCandidateTarget = uniqueCandidateTargets.size <= 1;

  for (const candidate of candidates) {
    const value = trimCandidate(candidate);
    if (!value) {
      continue;
    }

    if (shouldAvoidDeliveryAsset && sameMediaTarget(value, deliveryUri)) {
      continue;
    }

    if (
      shouldAvoidDeliveryAsset &&
      !deliveryUri &&
      hasOnlyOneCandidateTarget &&
      !/^data:image\//i.test(value) &&
      !IMAGE_EXTENSION_PATTERN.test(stripQueryAndHash(value))
    ) {
      continue;
    }

    if (isLikelyPreviewableImageUrl(value)) {
      return resolveMediaUrl(value);
    }

    if (assetType === "image") {
      return resolveMediaUrl(value);
    }
  }

  return "";
}
