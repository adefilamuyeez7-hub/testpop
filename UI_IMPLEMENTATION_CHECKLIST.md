# POPUP UI Implementation Checklist

## 1. App Structure

- Build desktop landing page at `/`
- Route mobile `/` to story-style Home
- Create dedicated `/discover`
- Create dedicated `/marketplace`
- Create adaptive `/profile`
- Nest creator tools under `/profile/creator`
- Remove secondary global nav clutter

## 2. Navigation

- Implement mobile bottom nav with four tabs
- Ensure active state is obvious
- Keep nav labels short and social-app familiar
- Remove admin from product navigation
- Keep admin as a standalone access point if needed

## 3. Desktop Landing Page

- Add clear POPUP positioning headline
- Add product explainer subtext
- Add media/video hero
- Add CTA into app
- Add creator/product preview examples
- Keep desktop shell minimal and conversion-focused

## 4. Mobile Home

- Build story-like swipe card layout
- Show one dominant product at a time
- Attach creator identity to each story card
- Support tap preview
- Support collect CTA
- Support like CTA
- Support gift/share CTA
- Ensure motion feels smooth and intentional

## 5. Discovery Feed

- Build social feed layout
- Show creator header on each card
- Render media preview inline
- Show file type badge
- Add like action
- Add gift/share action
- Add collect action
- Add creator profile entry
- Add empty, loading, and error states

## 6. Product Detail

- Render image preview properly
- Render PDF preview properly
- Render downloadable-tool preview properly
- Show creator identity and trust metadata
- Show clear collect price or free state
- Support just-in-time wallet connect
- Update ownership state immediately after collect

## 7. Marketplace

- Separate visual style from discovery feed
- Show creator token listings clearly
- Show creator identity per token
- Add list-for-sale action
- Add buy action
- Add token detail screen
- Add transaction and activity states

## 8. Profile

- Default to collector-friendly dashboard
- Show collected products
- Show saved products
- Show purchase history
- Show simple wallet state
- Detect creator state and reveal creator modules

## 9. Creator Dashboard

- Add publish product button
- Add products management
- Add earnings overview
- Add token launch entry point
- Add token activity area
- Ensure every dashboard button leads to a real route

## 10. Wallet UX

- Remove dead connect button behavior
- Trigger wallet connect only on protected actions
- Show meaningful error state if wallet is unavailable
- Show connected state cleanly
- Avoid noisy wallet chrome

## 11. Data Integrity

- Remove hardcoded fake profile stats
- Remove hardcoded fake marketplace values
- Remove fake notifications from production UI
- Replace mock placeholders with empty states if data is unavailable
- Ensure buttons disable gracefully when backend state is missing

## 12. File-Type Experience

- PDF opens in in-app reader
- Image opens in viewer
- Downloadable tools show download CTA after ownership
- Locked state should explain what unlocks after collect

## 13. UX Quality

- No dead buttons
- No broken routes
- No duplicate nav systems
- No auth wall before browsing
- No misleading mock data in production surfaces
- Keep collector journey simple

## 14. QA Checklist

- Test desktop landing
- Test mobile Home
- Test discovery feed scrolling
- Test product preview by file type
- Test collect flow with and without wallet
- Test marketplace buy/list routes
- Test profile collector mode
- Test profile creator mode
- Test responsive layout on laptop and phone widths
