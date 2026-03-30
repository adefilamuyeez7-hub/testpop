# POPUP-master — Changes Applied

This document records every modification made during the ZIP 1 → ZIP 2 integration
and the waitlist separation work.

---

## 1. New Page: Artist Application (`/apply`)

**File:** `src/pages/ArtistApplicationPage.tsx`

Ported from ZIP 1 and adapted to ZIP 2's architecture:
- Uses `useWallet()` from `@/hooks/useContracts` (not `useAccount` directly)
- No RainbowKit dependency — consistent with the rest of the app
- Runs client-side Zod validation via `validateApplicationData()` before any DB call
- Checks for an existing application on wallet connect and shows the correct status screen
- Three states: form (new), pending/rejected (submitted), approved (redirects to `/studio`)
- Duplicate detection uses Supabase `23505` error code
- Success dialog on first submission

**Route added to `App.tsx`:** `/apply` inside `<AppLayout>` (gets TopBar + BottomNav)

---

## 2. Database Functions — Artist Applications + Waitlist

**File:** `src/lib/db.ts` (appended — existing code untouched)

New types exported:
- `ArtistApplication` — full row type
- `ArtistApplicationInsert` — insert shape

New functions exported:
- `submitArtistApplication(data)` — validates, normalizes wallet, inserts, returns row
- `getArtistApplication(wallet)` — fetch by normalized wallet address
- `getAllApplications(status?)` — admin list, optionally filtered by status
- `updateApplicationStatus(id, status, reviewedBy, notes?)` — approve or reject
- `approveArtistAtomically(...)` — 3-step upsert: application → whitelist → artist profile
- `getWaitlistEntry(wallet)` — check if a wallet was on the pre-launch waitlist
- `getWaitlistCount()` — total number of waitlist entries
- `getAllWaitlistEntries()` — full list for admin use

**How to use `getWaitlistEntry` for personalised onboarding:**
```ts
import { getWaitlistEntry } from "@/lib/db";

// On wallet connect (e.g. in ProfilePage or onboarding flow):
const entry = await getWaitlistEntry(address);
if (entry) {
  // Show "Welcome back — you joined our waitlist on [date]" banner
  // Or grant early-access perks, badge, etc.
}
```

---

## 3. Zod Validation Schemas

**File:** `src/lib/validation.ts` (appended — existing utilities untouched)

Added:
- `normalizeWallet(address)` — lowercase + 0x prefix enforcement
- `ethereumAddressSchema` — Zod string schema with regex + transform
- `artistApplicationSchema` — full form schema (wallet, email, name, bio, art_types, URLs, terms)
- `ArtistApplicationInput` — inferred TypeScript type
- `validateApplicationData(data)` — parses unknown input, converts Zod errors to readable string

---

## 4. Database Migration

**File:** `supabase/migrations/008_artist_applications.sql`

Creates:
- `public.waitlist` table (wallet_address UNIQUE, created_at) with RLS
- `public.artist_applications` table with all application fields, status check constraint,
  RLS policies, performance indexes, and `updated_at` trigger

Run this against your Supabase project before deploying:
```bash
supabase db push
# or paste the SQL directly in Supabase SQL editor
```

---

## 5. App Router Update

**File:** `src/App.tsx`

- Added lazy import: `const ArtistApplicationPage = lazy(() => import("./pages/ArtistApplicationPage"))`
- Added route: `<Route path="/apply" element={<ArtistApplicationPage />} />` inside `<AppLayout>`
