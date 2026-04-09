/**
 * Asset Type Detection and Utilities
 * Determines file type from MIME types, file extensions, or URIs
 */

export type AssetType = 'image' | 'video' | 'audio' | 'pdf' | 'epub' | 'merchandise' | 'digital';

const MIME_TYPE_MAP: Record<string, AssetType> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',

  // Videos
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',

  // Audio
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/webm': 'audio',
  'audio/ogg': 'audio',
  'audio/aac': 'audio',
  'audio/flac': 'audio',

  // Documents
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
};

const EXTENSION_MAP: Record<string, AssetType> = {
  // Images
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.svg': 'image',

  // Videos
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.flv': 'video',

  // Audio
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.aac': 'audio',
  '.flac': 'audio',
  '.m4a': 'audio',

  // Documents
  '.pdf': 'pdf',
  '.epub': 'epub',
};

/**
 * Detect asset type from file extension
 * @param filename Name or path of file
 * @returns Detected AssetType or 'digital' as fallback
 */
export function detectAssetTypeFromFilename(filename: string): AssetType {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return EXTENSION_MAP[ext] || 'digital';
}

/**
 * Detect asset type from MIME type
 * @param mimeType MIME type string (e.g., "video/mp4")
 * @returns Detected AssetType or 'digital' as fallback
 */
export function detectAssetTypeFromMime(mimeType: string): AssetType {
  const cleanMime = mimeType.split(';')[0].trim(); // Remove charset
  return MIME_TYPE_MAP[cleanMime] || 'digital';
}

/**
 * Detect asset type from File object
 * Tries MIME type first, then falls back to filename
 * @param file File to analyze
 * @returns Detected AssetType
 */
export function detectAssetTypeFromFile(file: File): AssetType {
  if (file.type) {
    const detected = detectAssetTypeFromMime(file.type);
    if (detected !== 'digital') return detected;
  }
  return detectAssetTypeFromFilename(file.name);
}

/**
 * Detect asset type from URI (IPFS, HTTPS, data URL)
 * Uses file extension from path
 * @param uri File URI/URL
 * @returns Detected AssetType or 'digital' as default
 */
export function detectAssetTypeFromUri(uri: string): AssetType {
  try {
    // Extract path component from URI
    let path = uri;
    
    if (uri.startsWith('ipfs://')) {
      path = uri.substring(7); // Remove ipfs:// prefix
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      try {
        const url = new URL(uri);
        path = url.pathname;
      } catch {
        path = uri;
      }
    }

    // Get file extension from path
    const filename = path.split('/').pop() || '';
    const detected = detectAssetTypeFromFilename(filename);
    
    return detected;
  } catch {
    return 'digital'; // Keep unknown assets downloadable instead of forcing image rendering
  }
}

/**
 * Get file extension for asset type
 * @param assetType The asset type
 * @returns Common file extension with dot prefix
 */
export function getFileExtensionForType(assetType: AssetType): string {
  const extensions: Record<AssetType, string> = {
    image: '.jpg',
    video: '.mp4',
    audio: '.mp3',
    pdf: '.pdf',
    epub: '.epub',
    merchandise: '.pdf', // For physical product specs
    digital: '.zip',
  };
  return extensions[assetType] || '.bin';
}

/**
 * Get display label for asset type
 * @param assetType The asset type
 * @returns Human-readable label
 */
export function getAssetTypeLabel(assetType: AssetType): string {
  const labels: Record<AssetType, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    pdf: 'PDF Document',
    epub: 'E-Book',
    merchandise: 'Product',
    digital: 'Downloadable File',
  };
  return labels[assetType] || 'File';
}

/**
 * Get icon name for asset type (for lucide-react)
 * @param assetType The asset type
 * @returns Icon name
 */
export function getIconForAssetType(assetType: AssetType): string {
  const icons: Record<AssetType, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Music',
    pdf: 'FileText',
    epub: 'Book',
    merchandise: 'Package',
    digital: 'Download',
  };
  return icons[assetType] || 'File';
}

/**
 * Check if asset type can be previewed in browser
 * @param assetType The asset type
 * @returns true if can be displayed inline
 */
export function canPreviewAsset(assetType: AssetType): boolean {
  return ['image', 'video', 'audio', 'pdf'].includes(assetType);
}

/**
 * Check if asset requires external viewer
 * @param assetType The asset type
 * @returns true if needs special handling
 */
export function requiresSpecialViewer(assetType: AssetType): boolean {
  return ['pdf', 'epub'].includes(assetType);
}
