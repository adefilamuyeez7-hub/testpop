# POPUP Platform Reboot Blueprint (2026-04-10)

## 1. Product Direction

Rebuild POPUP around three core surfaces:

1. Home (creator-forward showcase)
2. Discover (social purchase feed)
3. Profile (collector + creator operating dashboard)

This reboot removes unclear purchase flows and gives every user role a predictable path.

## 2. Core User Types

1. Guest Collector
   - Can connect wallet (or social wallet connector).
   - Can browse all public content.
   - Can buy through onchain checkout or off-ramp partner.
   - No forced KYC for basic purchase flow.

2. Creator (admin-whitelisted)
   - Can publish two product classes:
   - Digital product: art, ebook, downloadable files.
   - Physical product: shipped merchandise / physical deliverables.
   - Can launch campaign types:
   - Drop: instant buy (onchain or on-ramp/off-ramp path).
   - Auction: onchain bidding.
   - Bid Campaign: bid via ETH or content submission.
   - Can upload portfolio showcase.
   - Can launch a limited tokenized creator card (tradeable onchain).

3. Admin
   - Handles creator whitelist and creator controls.
   - Manages system-level moderation/feature flags.

4. External Guest
   - Can open shared product card outside POPUP.
   - Can complete digital purchase/collect flow from external card links.

## 3. Flow Rules (Source of Truth)

1. Drop
   - Default action: Collect onchain.

2. Product / Hybrid physical-backed flow
   - Default action: Checkout flow for physical delivery.

3. Discovery CTA set
   - Comment, Buy, Share.

4. Home CTA set
   - Gift, Profile.
   - Subscribe CTA removed from home.

## 4. Surface Definitions

### Home
- Featured creator projects in deck/slide format.
- Card CTAs:
  - Gift: generate/copy external share link.
  - Profile: open creator profile.

### Discover
- Instagram-like post/feed layout.
- Each post shows media + creator context + action strip.
- Action strip:
  - Comment
  - Buy
  - Share

### Profile Dashboard
- Collector modules:
  - Collection
  - POAP
  - Subscriptions
  - Cart
  - Orders
- Creator/admin modules:
  - Creator Dashboard
  - Studio/Admin quick access (role-gated by existing app rules).

## 5. Build Strategy (Reboot Branch)

1. Phase 1 (Current implementation target)
   - New route-level UX for Home, Discover, Profile.
   - Unified CTA behavior and stable share hooks.

2. Phase 2
   - Creator campaign launch wizard redesign.
   - Admin creator-approval and role dashboard cleanup.
   - Tokenized creator card launch path.

3. Phase 3
   - External embeddable product card SDK.
   - Off-ramp provider orchestration and conversion tracking.

## 6. Non-Negotiables

1. Every buy CTA must map to an explicit intent (`collect` or `checkout`).
2. Discovery and Share surfaces must produce consistent intent for the same item.
3. Social previews must always include usable image metadata and canonical URLs.
