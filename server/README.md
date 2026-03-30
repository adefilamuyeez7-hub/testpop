# PopUp trusted backend

This backend closes the three remaining gaps from the audit:

1. wallet-authenticated write enforcement
2. JWT issuance for app sessions and optional Supabase-compatible claims
3. server-side Pinata proxying

## Environment

Create `server/.env` or set these variables in Railway/Render:

- `PORT=8787`
- `FRONTEND_ORIGIN=http://localhost:5173`
- `APP_JWT_SECRET=...`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_JWT_SECRET=...` (optional but required if you want a Supabase-compatible JWT returned)
- `PINATA_JWT=...`
- `ADMIN_WALLETS=0xabc...,0xdef...`

## Local run

```bash
npm install
npm run server:dev
```

## Auth flow

1. `POST /auth/challenge` with a wallet address
2. Sign the returned message with the connected wallet
3. `POST /auth/verify` with wallet + signature
4. Store `apiToken` as `popup_api_token`
5. Optionally store `supabaseToken` if you plan to do direct authenticated reads against Supabase

## Security notes

- privileged writes now go through the backend only
- the backend uses the Supabase service role key and its own wallet-authenticated session token
- Pinata credentials never enter the browser bundle
