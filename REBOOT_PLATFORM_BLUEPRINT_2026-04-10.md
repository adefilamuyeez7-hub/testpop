# POPUP Platform Reboot Blueprint (2026-04-10)

## Product Rebuild Goal

Rebuild POPUP from the beginning around three primary surfaces:

1. Home (creator discovery deck)
2. Discover (social-commerce post feed)
3. Profile (collector and creator dashboard)

The reboot keeps purchase intent explicit, supports onchain + partner checkout, and removes confusing CTAs.

## Primary Surfaces

### Home

- Discovery-first homepage for creators.
- Featured projects presented in deck/slide style.
- Card CTAs:
  - Gift
  - Profile
- Subscribe CTA is removed from home.

### Discover

- Instagram-like social feed for digital and collectible products.
- Every post supports exactly three actions:
  - Comment
  - Buy
  - Share

### Profile

- Collector dashboard modules:
  - Collection
  - POAP
  - Subscriptions
  - Cart
  - Order tracking
- Creator and operations modules:
  - Creator dashboard
  - Creator studio
  - Portfolio showcase upload
  - Tokenized creator card launch
  - Admin control access

## User Types and Flows

### Guest Collector

- Can buy any public product with wallet connect or social connect.
- Can complete purchase onchain or through off-ramp/on-ramp partners.
- No forced KYC for baseline buying flow.

### Creator (Admin Whitelisted)

- Can publish two content classes:
  - Digital product (art, ebook, downloadable files)
  - Physical product
- Can launch three campaign forms:
  - Drop: instant buy (onchain or partner checkout)
  - Auction: onchain bidding
  - Bid campaign: bid with content or ETH
- Can upload portfolio showcase.
- Can launch limited tokenized creator card tradable onchain.

### Admin

- Manages creator whitelist and approval system.
- Oversees creator tools and platform-level controls.

### External Guest

- Can discover and buy through shared product cards outside POPUP.
- External cards remain checkout compatible for digital or collectible flows.

## Flow Rules (Source of Truth)

1. Every Buy CTA maps to a clear intent:
   - `collect` for onchain collection
   - `checkout` for partner/commerce flow
2. Discover and Share routes must keep intent consistent for the same item.
3. Home and Discover surface only relevant CTAs per context.
4. Social previews should include canonical URL and media metadata.

## Phased Delivery

### Phase 1

- New Home, Discover, and Profile experience.
- Core role and campaign model embedded in app.

### Phase 2

- Creator launch wizard and campaign authoring overhaul.
- Admin approval workflow refinement.
- Tokenized creator card launch path hardening.

### Phase 3

- External embeddable product card SDK.
- Partner checkout orchestration and conversion analytics.
