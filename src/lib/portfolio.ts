import { resolveMediaUrl } from "@/lib/pinata";
import { isLikelyPreviewableImageUrl } from "@/lib/mediaPreview";

type PortfolioImageLike = {
  image?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  image_uri?: string | null;
  imageUri?: string | null;
  preview_uri?: string | null;
  previewUri?: string | null;
  src?: string | null;
  url?: string | null;
  coverImageUri?: string | null;
  cover_image_uri?: string | null;
};

export function resolvePortfolioImage(piece?: PortfolioImageLike | string | null): string {
  if (!piece) {
    return "";
  }

  if (typeof piece === "string") {
    return isLikelyPreviewableImageUrl(piece) ? resolveMediaUrl(piece) : "";
  }

  const candidates = [
    piece.image,
    piece.imageUrl,
    piece.image_url,
    piece.imageUri,
    piece.image_uri,
    piece.previewUri,
    piece.preview_uri,
    piece.coverImageUri,
    piece.cover_image_uri,
    piece.src,
    piece.url,
  ];

  for (const candidate of candidates) {
    if (isLikelyPreviewableImageUrl(candidate)) {
      return resolveMediaUrl(candidate);
    }
  }

  return "";
}
