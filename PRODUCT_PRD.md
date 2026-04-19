# POPUP Product Requirements Document

## Product Vision

POPUP is an onchain digital product discovery platform that feels as intuitive and culturally familiar as Instagram, while enabling creators to launch, sell, and resell digital products and creator tokens.

The product should feel content-first, mobile-native, and low-friction:

- Discover before connecting a wallet
- Preview before collecting
- Scroll and swipe before configuring anything
- Let collectors participate without forced account registration

## Product Positioning

POPUP sits at the intersection of:

- social product discovery
- digital collectibles and digital downloads
- creator commerce
- onchain ownership and resale

Core promise:

`Discover digital products from creators in a fast, visual feed, then collect, own, and resell them onchain.`

## Product Principles

1. Discovery first
Users should be able to open the app and immediately browse products without onboarding friction.

2. Mobile native
The default product experience should feel designed for a phone first, not adapted from desktop.

3. Creator identity matters
Every product should feel tied to a real creator profile, story, and brand.

4. Wallets should support the UX, not dominate it
Collectors should only be asked to connect when they actually need to collect, buy, or list.

5. Product cards are the core unit
The app should revolve around rich, visual, action-oriented cards.

6. Content types must render naturally
PDFs, images, and downloadable tools should each have a clear preview and post-collect experience.

## Target Users

### Collector

Motivations:

- discover useful or collectible digital products
- support creators
- collect quickly without complexity
- browse casually like a social app

Needs:

- no forced registration
- easy previews
- clear collect actions
- lightweight wallet prompts

### Creator

Motivations:

- publish digital products
- build a profile and audience
- earn from sales
- launch creator tokens
- benefit from resale activity

Needs:

- simple publishing tools
- product analytics
- token launch and listing tools
- creator dashboard

### Trader / Reseller

Motivations:

- buy and resell creator tokens
- participate in creator upside

Needs:

- clear token listing flows
- simple peer-to-peer marketplace experience

## Core Problems To Solve

1. Existing onchain commerce products feel too financial and too technical.
2. Most creator marketplaces are search-first instead of discovery-first.
3. Digital files are often poorly previewed before purchase.
4. Wallet connection is introduced too early and creates drop-off.
5. Creator token features often overwhelm the core consumer product.

## Core Jobs To Be Done

### Collector jobs

- When I am exploring, I want to discover digital products in a familiar swipe/feed interface so I can browse without effort.
- When I see a product I like, I want to preview it quickly so I can decide whether to collect it.
- When I decide to collect, I want the shortest possible path to completion.

### Creator jobs

- When I launch a product, I want it to appear in a discovery surface that feels alive and social.
- When I manage my business, I want a dashboard showing products, earnings, token activity, and audience signals.

### Marketplace jobs

- When I want to trade creator tokens, I want a dedicated marketplace that does not clutter discovery.

## Scope

### In Scope

- mobile-first discovery experience
- desktop landing page
- story-like home experience
- Instagram-like discovery feed
- creator profiles
- collector profile
- creator dashboard
- peer-to-peer creator token marketplace
- collect flows for supported digital file types
- wallet connect at point of action

### Out of Scope For V1

- mandatory email/password registration for collectors
- complex social graph features
- full messaging/chat
- creator subscription communities
- advanced moderation systems beyond basic reporting

## Information Architecture

### Desktop

- Landing Page
- App Entry

Desktop should primarily explain the product, show live previews, and route users into the mobile-style app experience.

### Mobile App Core Tabs

- Home
- Discovery
- Marketplace
- Profile

## Main Screens

### 1. Home

Purpose:
Story-like discovery surface for quick emotional engagement and creator-led browsing.

Core behaviors:

- full-screen product cards
- vertical or tap-through story interaction
- creator avatar and name attached to each card
- quick preview
- collect CTA
- like CTA
- gift/share CTA

### 2. Discovery

Purpose:
Scrollable feed of digital products, similar to Instagram feed behavior.

Core behaviors:

- feed of product cards
- creator metadata
- likes
- gifts/shares
- collect button
- preview inline or modal
- filter by file type or creator category

### 3. Marketplace

Purpose:
Dedicated area for creator token resale and peer-to-peer market activity.

Core behaviors:

- token listing feed
- buy / sell / list flows
- creator token detail
- price and volume activity

### 4. Profile

Purpose:
Adaptive space for either collectors or creators.

Collector view:

- collected products
- saved items
- purchase history
- wallet status

Creator view:

- creator dashboard
- products
- earnings
- token activity
- launch tools

## Supported Content Types

### PDF

- preview first pages in app
- open full reader after collect

### Image

- render inline in feed and detail views
- support zoomed preview

### Downloadable tools

- render cover, description, screenshots, and file metadata
- enable secure download after collect

## Functional Requirements

### Discovery

- Users can browse without logging in.
- Users can preview supported content before collecting.
- Users can like products.
- Users can gift/share products.
- Users can open creator profiles from every card.

### Collect

- Users can collect free or paid products.
- Wallet connect is triggered when required by collect flow.
- Post-collect access updates immediately.

### Creator

- Creators can publish products with file type metadata.
- Creators can see product performance and earnings.
- Creators can launch creator tokens.

### Marketplace

- Users can list creator tokens for resale.
- Users can browse creator token listings.
- Users can purchase listed creator tokens.

## Non-Functional Requirements

- fast mobile load times
- smooth swipe and scroll interactions
- clear empty states
- no dead buttons
- no fake hardcoded production data
- graceful wallet errors
- responsive layout across modern phones and laptops

## Success Metrics

### Acquisition

- landing page to app-entry conversion
- first product detail open rate

### Engagement

- products viewed per session
- swipe completion rate
- discovery feed dwell time
- likes and gifts per active user

### Conversion

- wallet connect rate from collect intent
- collect conversion rate
- creator token listing conversion

### Retention

- returning collectors
- repeat collects
- returning creators publishing multiple drops

## Risks

- over-indexing on crypto mechanics may weaken mass-market usability
- weak previews will reduce trust and conversion
- forcing wallet connection too early will hurt browsing retention
- mixing token trading too closely with discovery can dilute product clarity

## V1 Definition Of Done

- desktop landing page is live
- mobile home supports story-like discovery
- discovery feed supports product browsing and creator context
- marketplace supports creator token resale
- profile adapts to creator or collector mode
- PDF, image, and downloadable tool flows are functional
- collectors can browse without registration
