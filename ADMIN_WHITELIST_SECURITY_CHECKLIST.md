# Admin Whitelist Operations - Security Verification Checklist

## ✅ Backend Security (Server-Side)

- [x] POST `/admin/approve-artist` has `authRequired` middleware
- [x] POST `/admin/approve-artist` has `adminRequired` middleware  
- [x] DELETE `/whitelist/:id` has `authRequired` middleware
- [x] DELETE `/whitelist/:id` has `adminRequired` middleware
- [x] POST `/pinata/file` has `authRequired` middleware
- [x] POST `/pinata/json` has `authRequired` middleware
- [x] All endpoints use JWT verification with `JWT_SECRET`
- [x] All endpoints check admin wallet against `ADMIN_WALLETS` env var
- [x] All operations logged to `admin_audit_log` table
- [x] Wallet addresses normalized to lowercase before processing
- [x] Supabase service role used for database operations
- [x] PINATA_JWT never exposed to frontend

## ✅ Frontend Security (Client-Side)

- [x] `secureApiRequest()` in `src/lib/db.ts` requires `VITE_SECURE_API_BASE_URL`
- [x] `deleteWhitelistEntry()` uses `secureApiRequest()` with backend route
- [x] `updateWhitelistEntry()` uses `secureApiRequest()` with backend route
- [x] `useApproveArtist()` hook uses `VITE_SECURE_API_BASE_URL`
- [x] `getRuntimeApiToken()` retrieves JWT from runtime session
- [x] Authorization header includes JWT: `Bearer [token]`
- [x] All file uploads via `/api/pinata/file` routed through backend
- [x] Metadata uploads via `/api/pinata/json` routed through backend
- [x] Errors throw descriptive messages when backend not configured

## ✅ Environment Configuration

- [x] `.env.local` template includes `VITE_SECURE_API_BASE_URL`
- [x] `.env.local` template includes `PINATA_JWT` placeholder
- [x] `server/.env.local.example` documents all required vars
- [x] `vite.config.ts` exposes `VITE_SECURE_API_BASE_URL` in build
- [x] `vite.config.ts` exposes `VITE_PINATA_API_BASE_URL` in build
- [x] Vercel environment variable templates provided

## ✅ Admin Operations Flow

### Approve Artist
```
1. Admin clicks "Approve" on whitelist entry
2. Frontend calls useApproveArtist().approve(wallet)
3. Frontend makes POST /admin/approve-artist with JWT
4. Backend validates JWT (authRequired)
5. Backend checks admin role (adminRequired)
6. Backend checks ADMIN_WALLETS env var
7. Backend updates whitelist.status = "approved"
8. Backend deploys per-artist contract (if enabled)
9. Backend logs to admin_audit_log
10. Frontend receives result and updates UI
✅ SECURE: All checks bypass frontend code
```

### Delete Artist
```
1. Admin clicks "Delete" on whitelist entry
2. Frontend calls deleteWhitelistEntry(id)
3. secureApiRequest() checks VITE_SECURE_API_BASE_URL
4. Frontend makes DELETE /whitelist/:id with JWT
5. Backend validates JWT (authRequired)
6. Backend checks admin role (adminRequired)
7. Backend checks ADMIN_WALLETS env var
8. Backend deletes from whitelist table
9. Frontend receives 204 No Content
✅ SECURE: Cannot be bypassed from frontend
```

### Upload File to IPFS
```
1. Artist uploads image in studio
2. Frontend calls uploadFileToPinata(file)
3. pinata.ts uses secureApiRequest() to /api/pinata/file
4. secureApiRequest() checks VITE_SECURE_API_BASE_URL
5. Frontend makes POST /api/pinata/file with JWT + file data
6. Backend validates JWT (authRequired)
7. Backend uses PINATA_JWT to call Pinata API
8. Backend returns CID to frontend
9. Frontend saves CID as IPFS URL
✅ SECURE: PINATA_JWT never exposed to browser
```

## 🔧 Required Setup Steps

### Local Development
```bash
1. Set VITE_SECURE_API_BASE_URL=http://localhost:3001 in .env.local
2. Set VITE_PINATA_API_BASE_URL=http://localhost:3001/api/pinata in .env.local
3. Set PINATA_JWT=<your-pinata-jwt> in .env.local
4. Set APP_JWT_SECRET=<random-32-char-string> in server/.env.local
5. Set ADMIN_WALLETS=<your-wallet> in server/.env.local
6. Run: npm run dev (frontend on :8080)
7. Run: node server/index.js (backend on :3001)
```

### Production (Vercel)
```bash
1. Set environment variables in Vercel Dashboard:
   - VITE_SECURE_API_BASE_URL=https://api.example.com
   - VITE_PINATA_API_BASE_URL=https://api.example.com/api/pinata
   - PINATA_JWT=<production-pinata-jwt>
   - APP_JWT_SECRET=<strong-random-32-char-string>
   - ADMIN_WALLETS=<admin-wallet-addresses>
   - JWT_SECRET=<strong-random-32-char-string>
   - SUPABASE_URL=<production-supabase-url>
   - SUPABASE_SERVICE_ROLE_KEY=<production-service-key>

2. Verify vite.config.ts exposes VITE_SECURE_API_BASE_URL (done ✅)
3. Rebuild and redeploy
```

## 🧪 Testing Checklist

### Manual Testing (Local)
- [ ] Start backend: `node server/index.js`
- [ ] Start frontend: `npm run dev`
- [ ] Connect wallet in /admin panel
- [ ] Try to approve artist (Tx: Check for JWT in Network tab)
- [ ] Try to delete artist (Tx: Check request goes to localhost:3001)
- [ ] Try to upload image in /artist-studio
- [ ] Check browser console for no "Set VITE_SECURE_API_BASE_URL" errors
- [ ] Check server logs for "authRequired: JWT verified" messages
- [ ] Check server logs for "adminRequired: Admin check passed" messages

### Automated Testing Ideas
- [ ] Unit test: secureApiRequest() throws without VITE_SECURE_API_BASE_URL
- [ ] E2E test: Admin can approve artist (needs browser automation)
- [ ] E2E test: Non-admin cannot approve artist (401 response)
- [ ] E2E test: File upload returns IPFS CID

## 📊 Audit Trail Verification

### Check Admin Actions
```sql
-- Supabase SQL Editor
SELECT * FROM admin_audit_log 
ORDER BY created_at DESC 
LIMIT 20;
```

### Expected Log Entry
```json
{
  "admin_wallet": "0x4b393730efc0e3c1e0c0944fbf05edef4ee58092",
  "action": "approve_artist",
  "target_wallet": "0x...",
  "status": "approved",
  "details": {
    "deploymentStatus": "deployed",
    "contractAddress": "0x...",
    "deploymentTx": "0x..."
  },
  "created_at": "2026-03-30T10:30:00Z"
}
```

## 🚨 Security Issues If Any

❌ WOULD BE INSECURE IF:
- Frontend had direct access to PINATA_JWT
- Frontend could modify `role` claim in JWT
- `adminRequired` middleware missing from endpoints
- ADMIN_WALLETS not enforced server-side
- `authRequired` missing from sensitive endpoints
- JWT secret hardcoded in frontend
- VITE_SECURE_API_BASE_URL not required for writes

✅ CURRENTLY SECURE BECAUSE:
- PINATA_JWT only on backend
- JWT verified via APP_JWT_SECRET known only to backend
- adminRequired middleware on all admin endpoints
- Admin wallet checked against ADMIN_WALLETS env var
- authRequired on all sensitive operations
- JWT_SECRET is environment variable
- secureApiRequest() throws if VITE_SECURE_API_BASE_URL missing

## 📝 Notes

- All error messages clearly indicate need for trusted backend setup
- Audit trail helps debug and investigate issues
- Multi-admin support via comma-separated ADMIN_WALLETS
- Rate limiting should be added on /auth/nonce endpoint
- Consider adding IP whitelisting for admin operations
- Consider requiring 2FA for production admin operations
