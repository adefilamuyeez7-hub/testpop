# PDF Viewing in App - Comprehensive Audit

**Audit Date:** April 4, 2026  
**Component:** PdfReader, DropDetailPage, MyCollectionPage  
**Status:** ⚠️ ISSUES IDENTIFIED

---

## Executive Summary

The PDF viewing system has a working implementation with a proxy mechanism to handle CORS and URL resolution. However, there are several potential failure points that could prevent PDFs from displaying correctly.

**Current Implementation:** 
- ✅ Proxy-based loading via `/api/media/proxy` to avoid CORS issues
- ✅ IPFS URI resolution to gateway URLs  
- ✅ Supports blob, data, HTTP, HTTPS, and IPFS sources
- ⚠️ PDFs hidden if drop is gated
- ⚠️ Relies on correct asset type detection

---

## How PDF Viewing Works

### 1. **Data Flow: Drop Page → PDF Reader**

```
DropDetailPage
  ↓
resolveDropAssetType() → determines if assetType === "pdf"
  ↓
mediaSrc = ipfsToHttp(deliveryUri || imageUri)
  ↓
showInlinePdfReader = (assetType === "pdf" AND mediaSrc AND !isGated)
  ↓
<PdfReader src={mediaSrc} />
```

### 2. **Source URL Resolution**

File: `src/components/collection/PdfReader.tsx` lines 26-35

```typescript
const resolvedSourceUrl = (() => {
  const trimmed = src.trim();
  if (!trimmed) return "";
  
  // Category 1: Local URLs (blob, data, file paths)
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:") || trimmed.startsWith("/")) {
    return trimmed;
  }
  
  // Category 2: Remote URLs (HTTP, IPFS)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("ipfs://")) {
    return `/api/media/proxy?url=${encodeURIComponent(trimmed)};
  }
  
  // Category 3: Fallback - pass through
  return trimmed;
})();
```

### 3. **Server-Side Proxy Handling**

File: `server/index.js` lines 4001-4050

**Route:** `GET /api/media/proxy?url=<URL>`

**Process:**
```javascript
1. Extract URL from query: resolveMediaProxyTarget(req.query.url)
2. Validate it's a recognized format (HTTP, HTTPS, IPFS)
3. Fetch the file from the source
4. Set proper headers:
   - Content-Type: (from upstream)
   - Content-Disposition: "inline" (for PDFs)
   - CORS headers: Allow-Origin: *
   - Cache-Control: public, max-age=3600
5. Return file stream to client
```

### 4. **PDF Rendering (React-PDF)**

File: `src/components/collection/PdfReader.tsx` lines 7-9

```typescript
// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = 
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
```

**Rendering Flow:**
```
setPdfSource(resolvedSourceUrl)
  ↓
<Document file={pdfSource}>
  - onLoadSuccess: Set total pages
  - onLoadError: Show error message
  - onSourceError: Show error message
  ↓
<Page pageNumber={pageNumber}>
  - onRenderSuccess: Hide loading
  - onRenderError: Show render error
```

---

## Critical Issues & Root Causes

### 🔴 ISSUE #1: Empty mediaSrc (High Impact)

**Symptom:** PDF doesn't show inline, blank page

**Root Cause:** 
```typescript
// DropDetailPage.tsx line 187
const mediaSrc = drop ? ipfsToHttp(drop.deliveryUri || drop.imageUri || drop.image || "") : "";
```

If ALL of these are empty, mediaSrc will be `""`, and PDF won't render:
- `deliveryUri` - NOT SET
- `imageUri` - NOT SET (from `preview_uri` field)
- `image` - NOT SET (from `image_url`/`image_ipfs_uri`)

**Verification Check:**
```typescript
// In browser console on drop detail page:
console.log({
  deliveryUri: drop?.deliveryUri,
  imageUri: drop?.imageUri,
  image: drop?.image,
  mediaSrc: drop?.deliveryUri || drop?.imageUri || drop?.image || ""
});
```

**Fix Recommendation:**
```typescript
// Better fallback with explicit logging
const mediaSrc = useMemo(() => {
  if (!drop) return "";
  
  const candidates = [
    drop.deliveryUri,
    drop.imageUri,
    drop.image,
    drop.previewUri, // Add this fallback
  ];
  
  const selected = candidates.find(c => c?.trim());
  
  if (!selected) {
    console.warn("⚠️ No PDF source found for drop:", {
      id: drop.id,
      title: drop.title,
      assetType: drop.assetType,
      candidates,
    });
  }
  
  return ipfsToHttp(selected || "");
}, [drop]);
```

---

### 🔴 ISSUE #2: Incorrect Asset Type Detection (High Impact)

**Symptom:** PDF file uploaded but doesn't show as PDF viewer

**Root Cause:**
File: `src/pages/DropDetailPage.tsx` lines 41-61

```typescript
function resolveDropAssetType(dropRecord: {
  asset_type?: string | null;
  delivery_uri?: string | null;
  preview_uri?: string | null;
  image_ipfs_uri?: string | null;
  image_url?: string | null;
}): AssetType {
  const storedType = (dropRecord.asset_type || "").trim().toLowerCase() as AssetType | "";
  
  // If asset_type is set and not "digital", use it
  if (storedType && storedType !== "digital") {
    return storedType;
  }

  // Otherwise try to infer from URIs
  const candidates = [
    dropRecord.delivery_uri,
    dropRecord.preview_uri,
    dropRecord.image_ipfs_uri,
    dropRecord.image_url,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const inferredType = detectAssetTypeFromUri(candidate);
    if (inferredType === "pdf" || inferredType === "epub") {
      return inferredType;
    }
  }

  return storedType || "image";
}
```

**Problem Scenarios:**

1. **Stored Type is NULL/Empty:**
   ```
   asset_type = NULL → Falls back to URI detection
   → All URIs are empty → Returns "image"
   → PDF won't display as PDF
   ```

2. **URI Detection Fails:**
   ```
   deliveryUri = "ipfs://bafyABC123" (no .pdf extension)
   → detectAssetTypeFromUri() can't determine type from IPFS hash
   → Returns "image"
   → PDF loads as image (fails)
   ```

3. **Asset Type Stored as "digital":**
   ```
   asset_type = "digital" → Triggers fallback to URI detection
   Should be: asset_type = "pdf"
   ```

**How detectAssetTypeFromUri Works:**

Need to check this function:
```typescript
// Location: src/lib/assetTypes.ts
export function detectAssetTypeFromUri(uri: string): AssetType {
  // Likely checks file extension and MIME type
}
```

---

### 🟡 ISSUE #3: Gated Drops Hide PDF Inline (Medium Impact)

**Symptom:** PDF exists but shows download button instead of inline reader

**Root Cause:**
File: `src/pages/DropDetailPage.tsx` line 188

```typescript
const showInlinePdfReader = Boolean(
  drop && 
  drop.assetType === "pdf" && 
  mediaSrc && 
  !drop.isGated  // ← PDF won't show inline if gated
);
```

**Implementation Detail:**
```typescript
// Line 354-360: Gated drops show download button instead
{!showInlinePdfReader && (drop.assetType === "pdf" || drop.assetType === "epub" || drop.assetType === "digital") && (
  <DownloadPanel assetType={drop.assetType} /> // Shows download button
)}
```

**Design Question:** Is this intentional?
- ✅ Makes sense: Don't show full PDF before purchase
- ❌ But user might want preview before purchasing

---

### 🟡 ISSUE #4: PDF.js Worker Loading (Medium Impact)

**Symptom:** PDF loads but doesn't render, blank page

**Root Cause:**
File: `src/components/collection/PdfReader.tsx` lines 7-9

```typescript
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = 
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}
```

**Potential Issues:**

1. **CDN Unreachable:**
   - CDN requests fail silently in some environments
   - Browser console would show CORS error
   - PDF.js worker fails to initialize

2. **Version Mismatch:**
   ```
   react-pdf version: X.Y.Z
   PDF.js version used: A.B.C
   → If `pdfjs.version` doesn't match, worker fails
   ```

**Verification in Browser:**
```javascript
// Check if worker loaded correctly
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log("Service Workers:", regs);
});

// Or check PDF.js directly
import { pdfjs } from 'react-pdf';
console.log("Worker source:", pdfjs.GlobalWorkerOptions.workerSrc);
```

---

### 🟡 ISSUE #5: CORS Issues on Proxy (Medium Impact)

**Symptom:** "This PDF source could not be reached" error

**Root Cause:**
File: `server/index.js` lines 4001-4050

**Proxy Flow:**
```
Browser → /api/media/proxy?url=https://gateway.pinata.cloud/ipfs/...
  ↓
Server → Fetch upstream
  ↓
Return with CORS headers
```

**Potential Issues:**

1. **Upstream URL Invalid:**
   ```javascript
   const target = resolveMediaProxyTarget(req.query.url);
   if (!target) {
     return res.status(400).json({ error: "Invalid media URL" });
   }
   ```

2. **Upstream Server Blocks Requests:**
   ```javascript
   // Server fetches without auth headers
   const upstream = await fetch(target, {
     method: "GET",
     headers: { Accept: req.headers.accept || "*/*" },
   });
   
   // Some servers require User-Agent, auth, etc.
   ```

3. **URL Encoding Issues:**
   ```
   Original: ipfs://bafyABC123/my file.pdf
   Encoded: ipfs%3A%2F%2FbafyABC123%2Fmy%20file.pdf
   
   If decoding is wrong, URL is malformed
   ```

---

### 🟡 ISSUE #6: Error Handling Not Visible to User (Medium Impact)

**Symptom:** PDF won't load but only generic error shown

**Root Cause:**
File: `src/components/collection/PdfReader.tsx` lines 121-146

```typescript
{error && !isLoading && (
  <div className="...">
    <p className="text-sm text-white/80">{error}</p>
    <!-- Open PDF in Browser button -->
  </div>
)}
```

**Error Messages in Code:**
```typescript
setError("This PDF source could not be reached.");
setError("This PDF could not be loaded.");
setError("This PDF loaded but could not be rendered on this device.");
```

**Problem:** Console errors are not logged in user-facing error
- Console shows details: `console.error("Failed to load PDF:", error);`
- But user only sees generic message
- Developer can't debug from support tickets

---

## Detailed Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   User Views Drop Detail Page                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Supabase Query: getDropById(id)  │
        │   Returns: dropRecord              │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  resolveDropAssetType(dropRecord)  │ ← ISSUE #2
        │  Output: assetType                 │
        │  - Checks: asset_type field        │
        │  - Detects: from URIs              │
        └────────────┬───────────────────────┘
                     │
                     ├─→ assetType = "pdf" ✓
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  mediaSrc = ipfsToHttp(             │ ← ISSUE #1
        │    deliveryUri ||                  │
        │    imageUri ||                     │
        │    image ||                        │
        │    ""                              │
        │  )                                 │
        └────────────┬───────────────────────┘
                     │
                     ├─→ mediaSrc = "" ✗ (Empty)
                     │
                     ├─→ mediaSrc = "https://..." ✓
                     │   (HTTP URL)
                     │
                     ├─→ mediaSrc = "ipfs://..." ✓
                     │   (IPFS URI)
                     │
                     ▼
        ┌────────────────────────────────────┐
        │ showInlinePdfReader =              │ ← ISSUE #3
        │   (assetType === "pdf" &&          │
        │    mediaSrc &&                     │
        │    !isGated)                       │
        └────────────┬───────────────────────┘
                     │
                     ├─→ false (gated) → Show Download
                     │
                     ├─→ false (no mediaSrc) → Blank
                     │
                     ├─→ true → Show PdfReader
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  <PdfReader src={mediaSrc} />      │
        │  resolvedSourceUrl = ...           │
        └────────────┬───────────────────────┘
                     │
                     ├─→ Starts with "blob:" → Use as-is
                     │
                     ├─→ Starts with "data:" → Use as-is
                     │
                     ├─→ Starts with "/" → Use as-is
                     │
                     ├─→ Starts with "http://" or "https://"
                     │   → `/api/media/proxy?url=...`
                     │
                     ├─→ Starts with "ipfs://" 
                     │   → `/api/media/proxy?url=...`
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  loadPdfSource()                   │
        │  setPdfSource(resolvedSourceUrl)   │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  <Document file={pdfSource}>       │ ← ISSUE #4
        │  Browser requests PDF from URL     │
        │  PDF.js loads worker from CDN      │
        └────────────┬───────────────────────┘
                     │
                     ├─→ Worker fails
                     │   → Still renders with basic PDF.js
                     │   → Functionality limited
                     │
                     ├─→ If resolvedSourceUrl is proxy
                     │   Browser → Server proxy
                     │     → Server fetches from source
                     │     → Returns proxied stream ← ISSUE #5
                     │
                     ├─→ If resolvedSourceUrl is direct
                     │   Browser → Direct fetch
                     │     → May fail on CORS
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  Callbacks:                        │
        │  - onLoadSuccess({numPages})       │
        │  - onLoadError(error)              │ ← ISSUE #6
        │  - onSourceError(error)            │
        │  - onRenderSuccess()               │
        │  - onRenderError(error)            │
        └────────────────────────────────────┘
```

---

## Collection Page PDF Flow

File: `src/pages/MyCollectionPage.tsx`

**Simpler Flow:**
```
User clicks item in collection with assetType === "pdf"
  ↓
setSelectedItem(item)
  ↓
resolveCollectedAssetSource(item) → returns deliveryUri || previewUri || imageUrl
  ↓
<PdfReader src={src} />
  ↓
Same rendering as drop detail page
```

**Key Difference:**
- No `isGated` check - PDFs always show if owned
- Asset resolution simpler - uses stored fields directly

---

## Testing Checklist

### ✅ To Verify PDF Viewing Works:

```bash
# 1. Check Drop Record in Supabase
SELECT id, title, asset_type, delivery_uri, preview_uri, image_ipfs_uri, image_url, is_gated
FROM drops
WHERE asset_type = 'pdf'
LIMIT 1;

# Expected output:
# asset_type = 'pdf'
# At least one of: delivery_uri, preview_uri, image_ipfs_uri, image_url is NOT NULL

# 2. Navigate to drop detail page in browser
# DevTools Console should show:
console.log({
  assetType: drop.assetType,     // Should be "pdf"
  mediaSrc: mediaSrc,              // Should be non-empty URL
  isGated: drop.isGated,           // Should be false for inline view
  showInlinePdf: showInlinePdfReader, // Should be true
});

# 3. Verify proxy endpoint works
curl "https://testpop-one.vercel.app/api/media/proxy?url=https://example.com/file.pdf"
# Should return: PDF file with correct headers

# 4. Check worker loading
window.pdfjs.GlobalWorkerOptions.workerSrc
# Should output: CDN URL

# 5. Trigger manual test
# In browser, navigate to /drops/:id where drop has PDF
# Watch Network tab:
# - Request to drop detail page ✓
# - Request to /api/media/proxy?url=... ✓
# - Response is PDF file ✓
```

---

## Recommended Fixes (Priority Order)

### P1: Fix Empty mediaSrc Detection

```typescript
// src/pages/DropDetailPage.tsx
const mediaSrc = useMemo(() => {
  if (!drop) return "";
  
  const sources = [
    drop.deliveryUri,
    drop.imageUri, 
    drop.image,
    drop.previewUri, // Add fallback
  ];
  
  const selected = sources.find(s => s?.trim());
  const resolved = ipfsToHttp(selected || "");
  
  console.debug("PDF Source Resolution", {
    dropId: drop.id,
    assetType: drop.assetType,
    sources,
    selected,
    resolved,
  });
  
  return resolved;
}, [drop]);
```

### P2: Improve Asset Type Detection

```typescript
// src/pages/DropDetailPage.tsx
function resolveDropAssetType(dropRecord): AssetType {
  const storedType = (dropRecord.asset_type || "").trim().toLowerCase() as AssetType | "";
  
  // Trust stored type if it's a valid non-generic type
  if (storedType && storedType !== "digital" && storedType !== "image") {
    return storedType;
  }

  // Try URI-based detection with more sources
  const candidates = [
    dropRecord.delivery_uri,
    dropRecord.preview_uri,
    dropRecord.image_ipfs_uri,
    dropRecord.image_url,
    dropRecord.metadata_ipfs_uri, // Try metadata too
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const inferred = detectAssetTypeFromUri(candidate);
    if (inferred === "pdf" || inferred === "epub") {
      console.debug(`Inferred asset type '${inferred}' from URI: ${candidate}`);
      return inferred;
    }
  }

  // Last resort: if stored type exists, use it
  if (storedType) return storedType;
  
  return "image";
}
```

### P3: Add Better Error Logging

```typescript
// src/components/collection/PdfReader.tsx
onLoadError={(loadError) => {
  const errorDetails = {
    type: "LoadError",
    message: loadError?.message || String(loadError),
    src: src,
    resolvedSourceUrl: resolvedSourceUrl,
    timestamp: new Date().toISOString(),
  };
  
  console.error("PDF Load Failed:", errorDetails);
  
  // Log to backend for debugging
  fetch('/api/logging/error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorDetails),
  }).catch(() => {}); // Ignore logging errors
  
  setError("This PDF could not be opened in the in-app reader.");
  setIsLoading(false);
}}
```

### P4: Add Upstream Headers for Proxy

```javascript
// server/index.js, mediaProxyImpl
const upstream = await fetch(target, {
  method: "GET",
  headers: {
    Accept: req.headers.accept || "*/*",
    "User-Agent": req.headers["user-agent"] || "POPUP-PDF-Proxy/1.0",
    // Some servers require Referer
    Referer: `https://${req.headers.host}`,
  },
  // Add timeout
  timeout: 30000,
});
```

---

## Known Working Examples

**PDF that WILL display:**
```
Drop attributes:
- asset_type: "pdf"
- delivery_uri: "ipfs://bafyABC123"
- is_gated: false

Page actions:
1. Load drop detail page
2. resolveDropAssetType() → "pdf"
3. mediaSrc = https://gateway.pinata.cloud/ipfs/bafyABC123
4. showInlinePdfReader = true
5. PdfReader component renders
```

**PDF that WON'T display:**
```
Drop attributes:
- asset_type: NULL
- delivery_uri: NULL
- preview_uri: NULL
- image_ipfs_uri: "ipfs://bafyABC123" (no file extension - can't detect)
- is_gated: false

Page actions:
1. Load drop detail page
2. resolveDropAssetType() → detectAssetTypeFromUri("ipfs://bafyABC123") → can't detect → "image"
3. assetType = "image" (WRONG)
4. showInlinePdfReader = false (because assetType !== "pdf")
5. Shows as image instead of PDF
```

---

## Summary Table

| Issue | Severity | Impact | Root Cause | Fix Effort |
|-------|----------|--------|-----------|-----------|
| Empty mediaSrc | HIGH | PDF blank | Missing fallback | 2 hours |
| Asset type not detected | HIGH | Shows as image | URI detection fails | 3 hours |
| Gated drops hide PDF | MEDIUM | User can't preview | Design choice | 1 hour |
| PDF.js worker CDN | MEDIUM | Limited rendering | External CDN | 1 hour |
| CORS on proxy | MEDIUM | "URL unreachable" | Missing headers | 1 hour |
| Error logging poor | MEDIUM | Hard to debug | Generic errors | 1 hour |

---

## Browser Console Commands to Debug

```javascript
// Check DOM elements
document.querySelectorAll('[class*="PdfReader"]')
document.querySelectorAll('canvas') // PDF renders to canvas

// Check for error messages
document.body.innerText // Look for error text

// Check what was rendered
console.log(document.querySelector('[role="region"]')) // PDF text layer

// Check network requests
fetch('/api/media/proxy?url=https://example.com/test.pdf')
  .then(r => r.blob())
  .then(blob => console.log("PDF fetched:", blob.size, "bytes"))

// Check PDF.js directly  
import { pdfjs } from 'react-pdf'
console.log(pdfjs.version)
console.log(pdfjs.GlobalWorkerOptions.workerSrc)
```
