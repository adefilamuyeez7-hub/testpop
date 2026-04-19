# POPUP Route Map And Screen Architecture

## Routing Principles

1. Desktop and mobile should not share the same entry experience.
2. Desktop should open to a branded landing page.
3. Mobile should open directly into product discovery.
4. Discovery, marketplace, and profile should be clearly separated.
5. Creator workflows should live inside profile, not as a separate global navigation system.

## Platform Entry Logic

### Desktop

- `/` -> desktop landing page
- primary CTA -> enter app experience

### Mobile

- `/` -> Home story-style discovery

This keeps desktop focused on conversion and mobile focused on usage.

## Top-Level Route Map

### Public Routes

- `/`
- `/discover`
- `/marketplace`
- `/product/:productId`
- `/creator/:creatorId`

### Profile Routes

- `/profile`
- `/profile/collected`
- `/profile/saved`
- `/profile/purchases`
- `/profile/settings`

### Creator Routes Under Profile

- `/profile/creator`
- `/profile/creator/products`
- `/profile/creator/publish`
- `/profile/creator/earnings`
- `/profile/creator/token`
- `/profile/creator/token/launch`
- `/profile/creator/token/activity`

### Marketplace Routes

- `/marketplace`
- `/marketplace/token/:tokenId`
- `/marketplace/token/:tokenId/buy`
- `/marketplace/token/:tokenId/list`

## Navigation System

## Mobile Bottom Nav

- `Home`
- `Discovery`
- `Marketplace`
- `Profile`

### Tab To Route Mapping

- `Home` -> `/`
- `Discovery` -> `/discover`
- `Marketplace` -> `/marketplace`
- `Profile` -> `/profile`

## Desktop Navigation

Desktop landing should use a simple header:

- logo
- product explainer anchors
- open app CTA
- connect button only if useful after app entry

Desktop app views can still use the same main tabs, but without duplicating mobile-only interaction patterns.

## Screen Architecture

## 1. Home

Route:

- `/` on mobile

Purpose:

- immersive, story-like product discovery

Primary modules:

- story card stack
- creator chip
- product preview trigger
- collect CTA
- like CTA
- gift/share CTA

Secondary modules:

- quick entry to creator profile
- progress indicators

## 2. Discovery

Route:

- `/discover`

Purpose:

- browse many digital products in a familiar feed

Primary modules:

- feed composer container
- product card
- creator meta header
- social action bar
- collect action area

Secondary modules:

- filters
- sort controls
- empty states

## 3. Product Detail

Route:

- `/product/:productId`

Purpose:

- provide trust, preview, context, and collection action

Primary modules:

- media preview
- creator identity
- description
- file type metadata
- price or collect state
- collect CTA

Secondary modules:

- similar products
- creator products

## 4. Creator Profile

Route:

- `/creator/:creatorId`

Purpose:

- show creator identity and product inventory

Primary modules:

- creator hero
- creator bio
- product grid/list
- token overview if relevant

Secondary modules:

- follow/save later if added in future

## 5. Marketplace

Route:

- `/marketplace`

Purpose:

- dedicated token resale environment

Primary modules:

- token listings feed
- market filters
- token card
- list CTA

Secondary modules:

- activity snapshots
- price changes

## 6. Profile

Route:

- `/profile`

Purpose:

- role-adaptive dashboard

Collector default modules:

- collected
- saved
- purchases
- wallet state

Creator modules:

- creator dashboard summary
- publish product
- earnings
- token tools

## 7. Creator Dashboard

Routes:

- `/profile/creator`
- nested creator routes

Purpose:

- creator operations center

Modules:

- product performance
- earnings summary
- publish CTA
- token launch CTA
- token activity

## Route Guard Strategy

### Browsing Routes

These should not require registration:

- `/`
- `/discover`
- `/product/:productId`
- `/creator/:creatorId`
- `/marketplace`

### Action-Gated Routes

These may require wallet connection:

- collect actions
- buy/list marketplace actions
- creator publish flows
- creator token launch flows

### Profile Routes

- allow lightweight access to `/profile`
- request wallet connection when user needs owned state or creator controls

## Recommended Route Ownership

- landing and platform entry
- discovery surfaces
- product detail surfaces
- marketplace surfaces
- profile surfaces

Each area should have its own page-level container and shared card components rather than one oversized shell controlling everything.
