# POPUP Mobile Navigation And Screens

## Navigation Model

Primary navigation should be a four-tab bottom nav:

- Home
- Discovery
- Marketplace
- Profile

This keeps the mental model simple and Instagram-like:

- one tab for immersive discovery
- one tab for browse/feed behavior
- one tab for commerce/trading
- one tab for identity and ownership

## Tab Definitions

### Home

Role:
Story-style discovery.

Behavior:

- one primary card at a time
- tap, swipe, and quick reaction behaviors
- creator-led product presentation

Key components:

- story card
- creator chip
- product type badge
- preview CTA
- collect CTA
- like and gift/share actions

### Discovery

Role:
Feed-style product browsing.

Behavior:

- vertically scrollable feed
- richer product card details than Home
- open product detail or preview

Key components:

- creator header
- media preview
- action row
- collect bar

### Marketplace

Role:
Dedicated resale venue for creator tokens.

Behavior:

- token listing browse
- search/filter
- buy/list actions

Key components:

- token cards
- price panels
- creator identity
- listing CTA

### Profile

Role:
Adaptive dashboard for collectors and creators.

Behavior:

- if collector-first user: show collected items, saved items, purchases
- if creator signals exist: show creator dashboard modules

Key components:

- identity header
- collected grid
- creator dashboard cards
- earnings and token modules

## Screen Inventory

### Home Screens

- Home Story Feed
- Product Quick Preview
- Creator Mini Profile

### Discovery Screens

- Discovery Feed
- Product Detail
- Creator Profile

### Marketplace Screens

- Marketplace Feed
- Token Detail
- Create Listing
- Buy Confirmation

### Profile Screens

- Collector Dashboard
- Creator Dashboard
- Collected Products
- Purchase History
- Saved Products
- Product Management
- Earnings
- Creator Token Management

## Home Screen Spec

Layout:

- full-screen or near full-screen card
- floating creator meta
- minimal chrome
- clear action stack on the lower half

Priority actions:

- preview
- collect
- like
- gift/share

Design direction:

- cinematic
- motion-led
- minimal text clutter

## Discovery Screen Spec

Layout:

- feed cards similar to social posts
- creator info at top
- media preview in center
- action row below
- collect area pinned within card

Priority actions:

- like
- gift/share
- collect
- open creator

Design direction:

- recognizable social rhythm
- stronger metadata than Home

## Marketplace Screen Spec

Layout:

- denser than discovery
- focused on pricing and listing clarity
- separate visual language from content feed

Priority actions:

- buy
- list
- view activity

Design direction:

- utility-first, but still on-brand

## Profile Screen Spec

Layout:

- top identity area
- segmented sections based on user role
- collector modules first for passive users
- creator modules appear when relevant

Collector modules:

- Collected
- Saved
- Purchases

Creator modules:

- Publish Product
- Earnings
- Products
- Launch Creator Token
- Marketplace Activity

## Interaction Rules

- avoid top-level secondary nav clutter
- show wallet connect only when needed
- never block browsing behind auth
- every primary button should lead somewhere functional
- avoid fake stats, fake notifications, and hardcoded state in production views

## Responsive Strategy

### Desktop

- route users to a branded landing page
- use desktop to explain and convert
- encourage entry into the product experience

### Mobile

- route users directly into discovery-first product surfaces
- make swipe and feed interactions the default
