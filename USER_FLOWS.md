# POPUP User Flows

## Flow 1: Collector Discovery To Collect

1. User opens POPUP on mobile.
2. User lands on `Home` story-style product discovery.
3. User taps into a product card.
4. User previews the file.
5. User taps `Collect`.
6. If wallet is not connected, user is prompted to connect.
7. User confirms collect.
8. Product becomes available in collector access state.
9. User can view, read, or download based on file type.

Design intent:

- no registration wall
- no wallet prompt before intent
- minimal steps between desire and collect

## Flow 2: Collector Discovery Feed Interaction

1. User opens `Discovery`.
2. User scrolls through product feed.
3. User sees creator identity, product type, and collect CTA.
4. User can like, gift/share, or open creator profile.
5. User can preview product without leaving discovery context.
6. User can collect immediately from feed or detail.

Design intent:

- familiar social browsing behavior
- product cards should support action without heavy context switching

## Flow 3: Collector Access After Collect

1. User opens `Profile`.
2. User sees `Collected`.
3. User selects an owned product.
4. Based on content type:
   - PDF opens in in-app reader
   - image opens in viewer
   - tool shows download action

Design intent:

- ownership should lead directly to usage

## Flow 4: Creator Publish Product

1. Creator opens `Profile`.
2. Creator enters creator dashboard.
3. Creator taps `Publish Product`.
4. Creator uploads asset and enters metadata.
5. Creator selects product type and price.
6. Creator publishes.
7. Product enters discovery surfaces.

Design intent:

- creator tools should feel integrated, not hidden in an admin maze

## Flow 5: Creator Launch Token

1. Creator opens dashboard.
2. Creator selects `Launch Creator Token`.
3. Creator completes token setup.
4. Token is created and can later be listed in `Marketplace`.

Design intent:

- token launch belongs to creator operations, not the main discovery feed

## Flow 6: Marketplace Resale

1. User opens `Marketplace`.
2. User browses creator token listings.
3. User opens token detail.
4. User buys or lists peer-to-peer.

Design intent:

- trading should be a dedicated behavior, separated from product discovery
