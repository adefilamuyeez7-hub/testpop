/* ===================================================================================
 * TRUSTED BACKEND SECURITY SETUP
 * ===================================================================================
 * 
 * Admin operations (whitelist, delete, upload files) REQUIRE a trusted backend.
 * This architecture ensures:
 * - All writes must be authenticated and authorized server-side
 * - Wallet verification happens on backend with JWT tokens
 * - Sensitive secrets (PINATA_JWT) never exposed to frontend
 * - Rate limiting and audit trails on backend
 * 
 * SECURITY FLOW:
 * 1. Frontend user wallet connects (MetaMask, etc)
 * 2. Frontend gets JWT token from backend (/auth/challenge -> /auth/verify)
 * 3. Frontend includes JWT in Authorization header for all writes
 * 4. Backend verifies JWT and checks admin role
 * 5. Backend performs operation with secret credentials
 * 6. Operation result returned to frontend
 * 
 * =================================================================================== */

// BACKEND ENDPOINTS - All require authRequired + adminRequired middleware

/**
 * POST /admin/approve-artist
 * Middleware: authRequired, adminRequired
 * Description: Approve artist for whitelist and deploy contract
 * 
 * Request:
 * {
 *   wallet: "0x...",        // Artist wallet to approve
 *   approve: true,          // true = approve, false = reject
 *   deployContract: true    // true = deploy per-artist contract
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   artist: { id, wallet, name, contract_address },
 *   deployment: { status, address, tx, error }
 * }
 * 
 * Security:
 * ✅ authRequired: JWT token required in Authorization header
 * ✅ adminRequired: Checked against ADMIN_WALLETS env var
 * ✅ Wallet normalized to lowercase before DB lookup
 * ✅ Supabase uses service role for database updates
 * ✅ Logs all approvals in admin_audit_log table
 */

/**
 * DELETE /whitelist/:id
 * Middleware: authRequired, adminRequired
 * Description: Remove artist from whitelist
 * 
 * Request:
 * DELETE /whitelist/[uuid]
 * Authorization: Bearer [jwt_token]
 * 
 * Response: 204 No Content
 * 
 * Security:
 * ✅ authRequired: JWT token required
 * ✅ adminRequired: Admin role checked
 * ✅ Verifies whitelist entry exists before delete
 * ✅ Supabase RLS policies enforce row-level security
 */

/**
 * POST /pinata/file
 * Middleware: authRequired
 * Description: Upload file to IPFS via Pinata
 * 
 * Request:
 * POST /api/pinata/file
 * Content-Type: multipart/form-data
 * Authorization: Bearer [jwt_token]
 * Body: { file: [binary] }
 * 
 * Response: { cid: "Qm..." }
 * 
 * Security:
 * ✅ authRequired: JWT token required (prevents anonymous uploads)
 * ✅ PINATA_JWT never exposed in frontend code
 * ✅ Backend proxies request with PINATA_JWT
 * ✅ File size limits enforced server-side
 * ✅ MIME type validation on backend
 */

/**
 * POST /pinata/json
 * Middleware: authRequired
 * Description: Upload metadata JSON to IPFS via Pinata
 * 
 * Request:
 * POST /api/pinata/json
 * Content-Type: application/json
 * Authorization: Bearer [jwt_token]
 * Body: { metadata: { ... } }
 * 
 * Response: { cid: "Qm...", uri: "ipfs://Qm..." }
 * 
 * Security:
 * ✅ authRequired: JWT token required
 * ✅ PINATA_JWT used only on backend
 * ✅ JSON validation on backend
 * ✅ Content-Type enforced
 */

// FRONTEND ARCHITECTURE - How to use secure backend

/**
 * 1. ALL PROTECTED WRITES go through secureApiRequest() in src/lib/db.ts
 * 
 * Example:
 * ```typescript
 * export async function deleteWhitelistEntry(id: string) {
 *   return secureApiRequest<void>(`/whitelist/${id}`, {
 *     method: "DELETE",
 *   });
 * }
 * ```
 * 
 * secureApiRequest ensures:
 * - VITE_SECURE_API_BASE_URL is set (throws error if not)
 * - JWT token is included in Authorization header
 * - Request goes to: ${VITE_SECURE_API_BASE_URL}/whitelist/:id
 */

/**
 * 2. Admin operations use special hooks from src/lib/adminApi.ts
 * 
 * Example:
 * ```typescript
 * const { approve, isLoading, error } = useApproveArtist();
 * await approve("0x...", true, true);
 * ```
 * 
 * Hook ensures:
 * - VITE_SECURE_API_BASE_URL is required
 * - JWT token retrieved via getRuntimeApiToken()
 * - Error thrown if admin API not configured
 */

// CONFIGURATION REQUIREMENTS

/**
 * REQUIRED ENVIRONMENT VARIABLES
 * 
 * Frontend (.env.local, .env.production):
 * VITE_SECURE_API_BASE_URL=http://localhost:3001          (dev)
 * VITE_SECURE_API_BASE_URL=https://api.example.com        (prod)
 * 
 * Backend (server/.env.local, Vercel Dashboard):
 * PORT=3001
 * NODE_ENV=production
 * PINATA_JWT=<pinata-jwt-from-app.pinata.cloud>
 * SUPABASE_URL=<from-supabase-dashboard>
 * SUPABASE_SERVICE_ROLE_KEY=<from-supabase-dashboard>
 * JWT_SECRET=<strong-random-string>
 * ADMIN_WALLETS=0x...,0x...
 * 
 * Vite build (vite.config.ts):
 * Exposes VITE_SECURE_API_BASE_URL to frontend JavaScript
 * (Already configured in latest commit)
 */

// AUTHENTICATION FLOW

/**
 * 1. User connects wallet in frontend
 * 
 * 2. Get nonce from backend:
 *    POST /auth/challenge { wallet: "0x..." }
 *    Response: { nonce: "1234567890" }
 * 
 * 3. Sign nonce with wallet:
 *    signature = wallet.sign(message)
 * 
 * 4. Verify signature and get JWT:
 *    POST /auth/verify { wallet: "0x...", signature: "0x...", nonce: "1234567890" }
 *    Response: { token: "eyJhbGciOiJIUzI1NiIs..." }
 * 
 * JWT token contains:
 * {
 *   wallet: "0x...",
 *   role: "admin" or "artist" or "collector",
 *   iat: 1234567890,
 *   exp: 1234567890 + 15min,
 *   iss: "popup-app",
 *   aud: "web"
 * }
 * 
 * 5. Frontend stores JWT and includes in all authenticated requests:
 *    Authorization: Bearer [token]
 * 
 * 6. Backend validates JWT:
 *    authRequired middleware: jwt.verify(token, JWT_SECRET)
 *    adminRequired middleware: checks token.role === "admin"
 * 
 * 7. Backend verifies admin wallet against ADMIN_WALLETS env var
 */

// AUDIT TRAIL

/**
 * All admin operations logged in admin_audit_log table:
 * 
 * {
 *   id: UUID,
 *   admin_wallet: "0x...",        // Who performed action
 *   action: "approve_artist" | "reject_artist" | "delete_artist",
 *   target_wallet: "0x...",       // Who was affected
 *   status: "approved" | "rejected" | "deployed" | "failed",
 *   details: {
 *     deploymentStatus: "deployed" | "pending" | "failed",
 *     contractAddress: "0x...",
 *     deploymentTx: "0x...",
 *     error?: "Error message"
 *   },
 *   created_at: ISO8601
 * }
 * 
 * Query recent admin actions:
 * SELECT * FROM admin_audit_log
 * WHERE admin_wallet = '0x...'
 * ORDER BY created_at DESC
 * LIMIT 50;
 */

// TROUBLESHOOTING

/**
 * ERROR: "operation requires a trusted backend. Set VITE_SECURE_API_BASE_URL"
 * 
 * Solution:
 * 1. Check .env.local has VITE_SECURE_API_BASE_URL=http://localhost:3001
 * 2. Restart Vite dev server (npm run dev)
 * 3. Check Vercel Dashboard → Environment Variables for production
 * 4. Verify vite.config.ts exposes VITE_SECURE_API_BASE_URL (see latest commit)
 * 
 * DEBUG:
 * - Open browser DevTools → Network tab
 * - Try admin action (approve artist, delete from whitelist)
 * - Check request headers for Authorization: Bearer [token]
 * - Check request URL is: http://localhost:3001/admin/approve-artist
 * - Check response status (should be 200, not 401 or 403)
 */

/**
 * ERROR: "401 Unauthorized"
 * 
 * Solution:
 * 1. JWT token expired - User needs to reconnect wallet
 * 2. JWT secret mismatch - Check APP_JWT_SECRET in server/.env.local
 * 3. Token not in request header - Check getRuntimeApiToken() is being called
 * 4. Browser cookies blocked - Check credentials: "include" is set
 */

/**
 * ERROR: "403 Forbidden"
 * 
 * Solution:
 * 1. User not admin - Check wallet is in ADMIN_WALLETS env var
 * 2. Verify in server logs: console.log("Admin check:", req.auth.role)
 * 3. Ensure wallet address matches (case-sensitive in env var)
 * 4. Check admin role in JWT token: jwt.io to decode token
 */

/**
 * File upload fails silently:
 * 
 * Solution:
 * 1. Check PINATA_JWT is set in Vercel Environment Variables
 * 2. Verify Pinata JWT is valid: curl -H "Authorization: Bearer [JWT]" https://api.pinata.cloud/v2/keys/1
 * 3. Check VITE_PINATA_API_BASE_URL in .env.local: http://localhost:3001/api/pinata
 * 4. Check Vite exposes VITE_PINATA_API_BASE_URL (see latest commit)
 * 5. Look at browser DevTools Network tab for /api/pinata requests
 * 6. Check server logs for POST /pinata/file errors
 */

export {};
