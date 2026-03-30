# Three remaining fixes applied

## 1) Trusted backend added
A new `server/` folder now provides:

- wallet challenge/verify auth
- app JWT issuance
- optional Supabase-compatible JWT issuance
- server-enforced CRUD routes for artists, drops, products, orders, whitelist
- server-side Pinata proxy routes

## 2) JWT gap closed
`POST /auth/verify` now returns:

- `apiToken`: used by the frontend for privileged backend requests
- `supabaseToken`: optional token signed with `SUPABASE_JWT_SECRET` so RLS claims can be supplied from wallet auth

## 3) Contract hardening added
`contracts/ArtistSharesToken.sol` now includes:

- `Pausable`
- explicit emergency pause/unpause
- tracked refund liability
- tracked revenue claimed
- `outstandingObligations()` and `availableSurplus()`
- owner-only paused `recoverSurplusETH()`
- owner-only paused `recoverAccidentalERC20()`

## Important truth
I implemented the backend and contract work in the repo, but I did not wire every frontend screen to automatically request a signed backend session on wallet connect. The helper for that is in `src/lib/secureAuth.ts`.
