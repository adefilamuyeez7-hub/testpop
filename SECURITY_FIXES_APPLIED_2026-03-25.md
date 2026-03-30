# Security fixes applied

## Frontend
- Fixed `ArtistGuard` to await whitelist verification.
- Removed browser-side Pinata JWT usage. Uploads now require a trusted backend proxy endpoint.
- Stopped using localStorage as an authorization source for artist whitelist checks.
- Moved privileged Supabase writes in `src/lib/db.ts` behind a backend API boundary.

## Smart contracts
- `ArtistSharesToken.sol`
  - Added explicit successful-campaign withdrawal for the artist.
  - Reworked failed-campaign refunds to a pull model.
  - Burns campaign-issued shares when an investor claims a failed-campaign refund.
- `ProductStore.sol`
  - Replaced immediate excess-payment refunds with queued buyer refunds.
  - Added `claimPendingRefund()`.
  - Added `ProductRemovedFromCart` event.

## Supabase
- Replaced hardcoded admin wallet policies with JWT-claim helper functions.
- Documented expectation for backend-issued JWTs with `wallet` and `role` claims.
