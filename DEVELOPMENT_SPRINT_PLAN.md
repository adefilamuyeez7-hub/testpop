# POPUP Development Sprint Plan

## Sprint Goal

Turn POPUP into a coherent Instagram-style onchain digital discovery product with a clean desktop landing page and a mobile-first collector experience.

## Sprint 1: Architecture Reset

Objective:
Repair the app structure so the product has a clear foundation.

Tasks:

- split desktop landing from mobile app entry
- finalize route map
- clean global navigation
- move creator and collection routes under profile
- remove dead shell patterns

Definition of done:

- routes match product model
- no duplicate secondary nav
- desktop and mobile entry experiences are distinct

## Sprint 2: Discovery Surfaces

Objective:
Make the core discovery experience feel social and mobile-native.

Tasks:

- implement Home story-style experience
- implement Discovery feed
- unify product card model
- attach creator identity to every card
- add like, gift/share, and collect actions

Definition of done:

- users can browse Home and Discovery fluidly
- cards feel consistent across surfaces

## Sprint 3: Product Access And File Rendering

Objective:
Make products trustworthy and usable after collection.

Tasks:

- finalize product detail screen
- implement PDF rendering flow
- implement image rendering flow
- implement downloadable tool access flow
- wire owned-state access behavior

Definition of done:

- all supported file types have a valid preview/access path
- post-collect experience is clear

## Sprint 4: Wallet And Collect Flow

Objective:
Reduce conversion friction and fix wallet behavior.

Tasks:

- connect wallet only on collect or market action
- improve missing-wallet errors
- clean connected state UI
- remove broken or misleading connect states

Definition of done:

- connect button works
- collect flow is usable
- no silent failures

## Sprint 5: Profile And Creator Tools

Objective:
Make profile useful for both collectors and creators.

Tasks:

- build collector dashboard
- build creator dashboard
- publish product flow
- earnings summary
- token launch entry point

Definition of done:

- profile buttons are functional
- creator operations live under profile
- collector experience remains simple

## Sprint 6: Marketplace

Objective:
Create a distinct creator-token resale layer.

Tasks:

- build marketplace listing feed
- build token detail
- build buy flow
- build sell/list flow
- add activity display

Definition of done:

- marketplace is functional and distinct from discovery

## Sprint 7: Integrity And Polish

Objective:
Remove false production signals and improve trust.

Tasks:

- remove remaining hardcoded data
- replace fake notifications with real empty states
- audit dead buttons
- audit routing gaps
- polish responsive UI and motion

Definition of done:

- no major fake data remains in core surfaces
- no critical dead actions remain

## Suggested Execution Order

1. Routing and shell reset
2. Mobile Home and Discovery
3. Product detail and file rendering
4. Wallet and collect flow
5. Profile and creator dashboard
6. Marketplace
7. QA and polish

## Team Output By Track

### Product / UX

- finalize flows
- approve screen hierarchy
- validate collector-first experience

### Frontend

- routes
- navigation
- page layouts
- card components
- responsive behavior

### Backend / Data

- remove mocks
- provide real feed and product data
- support collect ownership state
- support marketplace listing state

### QA

- route testing
- wallet testing
- file preview testing
- responsive testing

## Immediate Build Priorities

- make `/` behave correctly on desktop and mobile
- make Home and Discovery match the product story
- make connect and collect reliable
- make profile routes functional
