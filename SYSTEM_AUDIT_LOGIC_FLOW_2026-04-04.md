# System Audit And Logic Flow

Date: 2026-04-04

## Audit Scope

This audit reviewed the current frontend, secure backend, Supabase access layer, and the latest marketplace/drop changes.

Verification run:

- `npm run build` -> passed
- `npm test` -> passed
- `npm run lint` -> passed with warnings after removing one dead-code lint blocker in `src/pages/Index.tsx`

## Executive Summary

The application now has a coherent public surface:

- public discovery pages for home, drops, artists, marketplace, product detail
- guarded creator/admin areas for studio and admin workflows
- a secure backend for authenticated writes, checkout recording, admin actions, IP campaigns, and royalty reads
- a stronger Supabase read layer in `src/lib/supabaseStore.ts` with schema fallback logic

The biggest remaining issues are not basic routing failures. They are consistency issues between data layers and a few places where UI reads data more directly than the hardened store layer.

## What Works

### Public UI

- `src/App.tsx` wires all main public routes correctly.
- `src/components/AppLayout.tsx` gives a stable shell with top bar, bottom nav, and route outlet.
- `src/pages/DropsPage.tsx` and `src/pages/DropDetailPage.tsx` are using the modern Supabase query layer and now support linked marketplace releases.
- `src/pages/ProductsPage.tsx` has been updated from "Shop" into "Marketplace" and now surfaces rights/investment context next to product listings.
- `src/pages/ProductDetailPage.tsx` supports gallery, shipping, and onchain release tabs.
- `src/pages/CartPage.tsx`, `src/components/ShoppingCart.tsx`, and `src/pages/CheckoutPage.tsx` provide a complete buyer flow.

### Secure/Auth Layer

- `src/lib/secureAuth.ts` implements a challenge/sign/verify secure wallet session.
- `src/components/ArtistGuard.tsx` and `src/components/AdminGuard.tsx` correctly gate studio/admin access through backend session establishment.
- `server/index.js` exposes auth challenge/verify/session endpoints and role-gated admin/artist operations.

### Commerce And Data

- `src/lib/supabaseStore.ts` provides the most resilient read path in the codebase:
  - product schema fallback
  - drop schema fallback
  - missing relation fallback
  - metadata image enrichment
- `src/pages/CheckoutPage.tsx` validates onchain state before recording orders, which is the right order of operations.
- `server/index.js` includes CRUD and operational routes for:
  - artists
  - drops
  - products
  - orders
  - creative releases
  - product assets
  - entitlements
  - fulfillments
  - IP campaigns
  - IP investments
  - royalty distributions

### Latest Change Set That Is Now Functioning

- drop detail pages can resolve linked marketplace releases/products
- marketplace terminology is now aligned in nav and page copy
- the duplicate `contract_address` migration no longer hard-fails on existing databases

## Broken Or Risky Areas

### 1. Search Panel Bypasses Public Visibility Rules

Files:

- `src/components/TopBar.tsx:54`
- `src/components/TopBar.tsx:60`
- `src/lib/supabaseStore.ts:365`
- `src/lib/supabaseStore.ts:124`

Problem:

- the search panel queries `artists`, `drops`, and `products` directly from the raw Supabase client
- the artist query does not reuse the public artist filtering logic from `fetchPublicArtistsFromSupabase`
- the drop query only filters by status and does not reuse the non-expired filtering logic

Impact:

- non-public artists may appear in search results
- expired drops can still appear in search
- search can disagree with the main catalog pages

Recommendation:

- move search onto shared fetch helpers or add a dedicated backend/search endpoint that applies the same visibility rules as the public catalog

### 2. Product Detail Depends On Backend-Only Creative Release Fetch

Files:

- `src/lib/db.ts:721`
- `src/pages/ProductDetailPage.tsx:95`

Problem:

- `getCreativeRelease()` only fetches from `VITE_SECURE_API_BASE_URL`
- if the secure backend base URL is missing or unreachable, the function returns `null`
- `ProductDetailPage` depends on that function for release tabs like shipping/physical details

Impact:

- the product detail page still loads, but release-specific metadata silently disappears in degraded/local environments
- this creates a split where products seem "partially working" instead of clearly failing

Recommendation:

- add a safe Supabase fallback for public creative release reads, matching the pattern already used in `supabaseStore.ts`

### 3. Admin Analytics Mixes Legacy Cache With Live Query Data

Files:

- `src/main.tsx:15`
- `src/lib/artistStore.ts:237`
- `src/pages/AdminPage.tsx:1215`

Problem:

- admin analytics uses `getAllArtists()` and `getAllDrops()` from the legacy `artistStore`
- the same page also uses live product and Supabase analytics data elsewhere
- the legacy cache is initialized asynchronously and can drift from the newer React Query/Supabase flow

Impact:

- dashboard metrics can disagree with the public marketplace/drops pages
- analytics cards may be stale after writes unless both systems happen to stay in sync

Recommendation:

- retire analytics reads from `artistStore`
- compute admin analytics from the same live Supabase queries used by the public/catalog surfaces

## Structural Risks

### Dual Data Layer

The codebase still has two read models:

- modern: `src/lib/supabaseStore.ts` + `src/hooks/useSupabase.ts`
- legacy: `src/lib/artistStore.ts`

This is the main architectural source of inconsistency. The application is partway through a migration but not fully off the older cache model.

### Test Coverage Is Minimal

File:

- `src/test/example.test.ts:1`

Current test coverage is only a smoke test for imports and array return shape. There is no automated coverage for:

- wallet auth
- admin approvals
- drop publishing
- marketplace checkout
- IP campaign creation/investment
- collection entitlement rendering

## Lint Warnings Still Open

Current warnings are non-blocking but worth cleaning:

- `src/components/collection/EpubReader.tsx` missing hook dependency
- `src/pages/DropsPage.tsx` unnecessary hook dependency
- several `react-refresh/only-export-components` warnings in shared UI files

## Logic Flow

### 1. Public Visitor Flow

1. User lands on `/`
2. Home page shows featured content, artist discovery, and CTA paths
3. User moves into:
   - `/drops`
   - `/artists`
   - `/products`
4. From detail pages the user can:
   - collect a drop
   - open an artist profile
   - add marketplace items to cart

### 2. Wallet Authentication Flow

1. User connects wallet through Reown/Wagmi
2. Protected areas call `establishSecureSession(wallet)`
3. Frontend requests `/auth/challenge`
4. Wallet signs challenge
5. Frontend posts signature to `/auth/verify`
6. Backend returns runtime API token + role
7. Guard decides access:
   - artist/admin allowed into protected routes
   - others blocked with diagnostic UI

### 3. Artist Onboarding Flow

1. User submits artist application via `/apply`
2. Application is stored in Supabase and mirrored into whitelist state
3. Admin reviews in `/admin`
4. Approved wallet gains backend role access
5. Artist can enter `/studio`

### 4. Artist Publishing Flow

1. Artist opens `/studio`
2. Uploads media/metadata through Pinata-backed flow
3. Creates:
   - drops
   - products
   - campaign metadata
   - release records
4. Studio writes to backend/Supabase and may also trigger onchain actions
5. Public catalog reads published content through Supabase query hooks

### 5. Drop Flow

1. Public drop list loads from `useSupabaseLiveDrops()`
2. `supabaseStore` normalizes schema, enriches media, and filters expired content
3. User opens `/drops/:id`
4. Drop detail resolves:
   - artist data
   - media preview
   - contract metadata
   - linked marketplace release/product if available
5. Primary action depends on drop type:
   - direct collect
   - auction bid
   - campaign action

### 6. Marketplace Flow

1. Public marketplace loads published products from `useSupabasePublishedProducts()`
2. Products are mapped into cart-compatible store objects
3. Rights/investment cards are layered in from IP campaigns
4. User opens a product detail page or adds to cart
5. Cart persists locally through Zustand storage

### 7. Checkout Flow

1. User opens `/checkout`
2. Frontend validates address + shipping fields
3. For each item:
   - reads onchain product/release state
   - verifies price, stock, listing id, and activity
   - executes onchain purchase
   - records the order through secure backend
4. Order items and fulfillment rows are created server-side
5. Buyer sees result in `/orders` and later `/collection`

### 8. Investment / Revenue Flow

1. Admin or artist creates an IP campaign
2. Campaign appears on artist profile and marketplace rights surfaces
3. Investor commits via secure backend
4. Investor positions can be read back for the authenticated wallet
5. Royalty distributions can be shown to the authenticated wallet

Note:

- the UI now supports discovery and tracking of rights-bearing positions
- there is not yet a complete secondary resale transaction engine for relisting those positions onchain

### 9. Admin Flow

1. Admin enters `/admin`
2. Backend session verifies `admin` role
3. Admin manages:
   - artist approvals/rejections
   - products
   - orders
   - raise requests
   - featured creator slots
   - analytics

## UI Map After Latest Marketplace Changes

### Public Surface

- Home: branded landing page, featured slides, discovery rails
- Drops: drop-first discovery and collection actions
- Drop Detail: media-first detail page plus linked marketplace release panel
- Artists: artist directory
- Artist Profile: portfolio, drops, subscription, investment entry points
- Marketplace: primary products plus rights/investment context
- Product Detail: gallery, shipping, physical details, onchain links
- Cart / Checkout / Orders: commerce flow

### Protected Surface

- Studio: creator publishing and release management
- Admin: whitelist, product, order, raise, featured, analytics tabs

## Recommended Next Fixes

1. Unify search with the public data layer so results obey the same visibility and expiry rules as catalog pages.
2. Remove remaining admin analytics dependence on `artistStore`.
3. Add Supabase fallback reads for `getCreativeRelease()` and related public release data.
4. Add integration tests for:
   - secure auth handshake
   - checkout success/failure paths
   - admin approval
   - drop detail linked release rendering
5. Finish UI terminology cleanup so all "shop" labels consistently read "marketplace".
