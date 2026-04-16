# ARTIST DASHBOARD AVATAR IMAGE ISSUE - AUDIT REPORT
**Date:** April 15, 2026  
**Issue:** Avatar image not displaying in artist dashboard profile upload

---

## Problem Summary

When an artist uploads a profile avatar in the Artist Studio dashboard, the image shows a preview during upload but **disappears after saving and reloading** the page.

---

## Root Cause Analysis

### The Data Flow Issue

**Upload Path (Working ✅):**
1. User selects avatar file via file input
2. FileReader creates data URL: `data:image/png;base64,...`
3. Data URL stored in `profile.avatarPreview` for preview display
4. File uploaded to Pinata, returns CID: `bafy...`
5. CID converted to gateway URL: `https://gateway.pinata.cloud/ipfs/bafy...`
6. Gateway URL sent to backend and normalized to `ipfs://bafy...` format
7. Normalized `ipfs://bafy...` stored in Supabase database

**Reload Path (BROKEN ❌):**
1. Profile loads from Supabase with `avatar_url: "ipfs://bafy..."`
2. Avatar URL is assigned directly to `profile.avatarPreview`
3. Frontend renders: `<img src={profile.avatarPreview} />`
4. Browser attempts to load `ipfs://bafy...` as direct image URL
5. **IPFS URI format is not a valid HTML image src** → Image doesn't load!

---

## Code Issues Identified

### Issue #1: Unresolved IPFS URLs in Avatar Preview
**File:** [src/pages/ArtistStudioPage.tsx](src/pages/ArtistStudioPage.tsx#L1960)  
**Lines:** 1960-1964

```tsx
setProfile({
  // ... other fields
  avatarPreview: artist.avatar,  // ❌ This is "ipfs://bafy..." format
  bannerPreview: artist.banner,  // ❌ This is "ipfs://bafy..." format
});
```

**Problem:** The `artist.avatar` and `artist.banner` values come from the database as `ipfs://...` format (normalized by the backend), but they're being used directly as image `src` attributes without conversion to HTTP gateway URLs.

### Issue #2: Missing URL Resolution in State Setting
**File:** [src/pages/ArtistStudioPage.tsx](src/pages/ArtistStudioPage.tsx#L1840-1850)

```tsx
const artist = artistProfileRecord
  ? {
      ...fallbackArtist,
      // ... other fields
      avatar: artistProfileRecord.avatar_url || "",  // ❌ Raw IPFS URI
      banner: artistProfileRecord.banner_url || "",  // ❌ Raw IPFS URI
```

**Problem:** The avatar and banner are set from `artistProfileRecord` without applying `resolveMediaUrl()` conversion.

---

## Solution

Convert IPFS URIs to HTTP gateway URLs when loading profile data. Use the existing `resolveMediaUrl()` function from [src/lib/pinata.ts](src/lib/pinata.ts#L328) to handle this.

### Fix Implementation

Apply the following changes to the profile loading logic in ArtistStudioPage.tsx around line 1840:

**Before:**
```tsx
avatar: artistProfileRecord.avatar_url || "",
banner: artistProfileRecord.banner_url || "",
```

**After:**
```tsx
avatar: resolveMediaUrl(artistProfileRecord.avatar_url) || "",
banner: resolveMediaUrl(artistProfileRecord.banner_url) || "",
```

And when setting the profile state at line 1960-1964:

**Before:**
```tsx
avatarPreview: artist.avatar,
bannerPreview: artist.banner,
```

**After:**
```tsx
avatarPreview: resolveMediaUrl(artist.avatar) || artist.avatar,
bannerPreview: resolveMediaUrl(artist.banner) || artist.banner,
```

---

## Impact Assessment

- **Severity:** HIGH - Users cannot see their profile avatar after saving
- **Affected Component:** Artist Studio Dashboard > Profile Setup Tab
- **User Impact:** Profile appears incomplete with missing avatar image
- **Data Loss:** None - images are stored correctly in Pinata/Supabase

---

## Required Imports

The `resolveMediaUrl` function needs to be imported at the top of ArtistStudioPage.tsx:

```tsx
import { resolveMediaUrl } from "@/lib/pinata";
```

---

## Testing Recommendations

1. ✅ Upload a new avatar in Artist Studio
2. ✅ Verify preview shows during upload
3. ✅ Save profile
4. ✅ Page refresh or navigate away and return
5. ✅ Verify avatar is still visible after reload
6. ✅ Repeat for banner image
7. ✅ Check public artist profile page shows the same avatar

---

## Files to Modify

- [src/pages/ArtistStudioPage.tsx](src/pages/ArtistStudioPage.tsx) - Apply URL resolution to avatar/banner loading

---

## Additional Notes

- The backend correctly normalizes URLs to `ipfs://` format (good for storage)
- The `resolveMediaUrl()` function already handles this conversion perfectly
- Similar pattern is correctly used in ArtistProfilePage.tsx (line 73)
- The fix maintains consistency with how other image URLs are handled in the codebase
