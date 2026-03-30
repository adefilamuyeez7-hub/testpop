# Onchain & Persistent Storage Implementation - Complete

**Date**: March 30, 2026  
**Status**: ✅ COMPLETE  
**Scope**: Migrate from in-memory/hardcoded data to onchain + persistent database storage

---

## EXECUTIVE SUMMARY

All data that was previously stored in-memory or hardcoded is now:
- **Whitelist**: Stored both onchain (ArtDropFactory contract) and in Supabase DB
- **Nonces**: Migrated from in-memory Map to Supabase table
- **Admin Actions**: Logged to Supabase audit table for accountability
- **Environment Variables**: Properly configured through Vite build system

**Zero local/hardcoded data remaining** ✅

---

## CHANGES IMPLEMENTED

### 1. ✅ ONCHAIN WHITELIST (ArtDropFactory.sol)

**Added to `contracts/ArtDropFactory.sol`**:

```solidity
// New mappings
mapping(address => bool) public artistApproved;
mapping(address => uint256) public approvalTimestamp;
address[] public approvedArtists;

// New event
event ArtistApprovalUpdated(address indexed artist, bool approved, uint256 timestamp);

// New functions
function setArtistApproval(address _artist, bool _approved) external onlyOwner
function isArtistApproved(address _artist) external view returns (bool)
function getApprovedArtists() external view returns (address[] memory)
function getApprovedArtistCount() external view returns (uint256)
```

**Benefits**:
- Artist approval is now immutable onchain
- Prevents tampering from database alone
- Contract deployment requires onchain approval
- Decentralized approval source of truth

**Data Flow**:
```
Admin API (/admin/approve-artist)
  ├─→ Update Supabase whitelist table
  ├─→ Call setArtistApproval() on ArtDropFactory contract ✅ NEW
  ├─→ Deploy per-artist ArtDrop contract
  └─→ Log audit trail to admin_audit_log table
```

---

### 2. ✅ NONCE STORAGE MIGRATION (Supabase-Backed)

**Removed**:
```javascript
const nonces = new Map();  // ❌ In-memory, lost on restart, not shared across instances
function cleanupExpiredNonces() { /* ... */ }
```

**Added**: Supabase `nonces` table + helper functions

**New Functions in `server/index.js`**:

```javascript
async function issueNonce(wallet) {
  // Stores nonce in Supabase with 5-minute expiry
  // One entry per wallet (overwrites old nonces)
  return { nonce, issuedAt };
}

async function verifyNonce(wallet, nonce) {
  // Retrieves nonce from Supabase
  // Marks as used (one-time use)
  // Prevents replay attacks across server instances
  return nonce_record;
}

async function cleanupExpiredNonces() {
  // Deletes expired unused nonces from database
  // Can be called periodically or on demand
}
```

**Migration Schema** (`supabase/migrations/20260330_create_nonces_table.sql`):

```sql
CREATE TABLE nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  nonce TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_nonces_wallet_unused ON nonces(wallet, used);
CREATE INDEX idx_nonces_expires_at ON nonces(expires_at);
```

**Benefits**:
- ✅ Nonces persist across server restarts
- ✅ Multi-instance deployments share nonce state
- ✅ One-time use enforcement (prevents replay)
- ✅ Automatic expiry cleanup
- ✅ Full audit trail of auth attempts
- ✅ Can integrate with distributed systems (Redis, etc.)

**Updated Endpoints**:

#### `/auth/challenge` - Nonce Issuance
```javascript
app.post("/auth/challenge", async (req, res) => {
  // 1. Clean expired nonces from DB
  await cleanupExpiredNonces();
  
  // 2. Issue new nonce to Supabase
  const { nonce, issuedAt } = await issueNonce(wallet);
  
  // 3. Return challenge message
  return res.json({ wallet, nonce, issuedAt, message });
});
```

#### `/auth/verify` - Signature Verification
```javascript
app.post("/auth/verify", async (req, res) => {
  // 1. Clean expired nonces
  await cleanupExpiredNonces();
  
  // 2. Retrieve nonce from Supabase
  const nonceRecord = await supabase
    .from("nonces")
    .select("id, nonce, issued_at")
    .eq("wallet", wallet)
    .eq("used", false)
    .maybeSingle();
  
  // 3. Verify signature matches message + nonce
  const recovered = ethers.verifyMessage(message, signature);
  
  // 4. Mark nonce as USED (one-time only!)
  await supabase
    .from("nonces")
    .update({ used: true, used_at: now })
    .eq("id", nonceRecord.id);
  
  // 5. Issue JWT token
  return res.json({ apiToken, supabaseToken, ... });
});
```

---

### 3. ✅ ADMIN AUDIT LOGGING

**New Table** (`supabase/migrations/20260330_create_audit_log_table.sql`):

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY,
  admin_wallet TEXT NOT NULL,
  action TEXT NOT NULL,        -- 'approve_artist', 'reject_artist', 'deploy_contract', etc.
  target_wallet TEXT,
  status TEXT,
  details JSONB,               -- Stores deployment info, rejection reasons, etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Logged Actions**:

- ✅ `/admin/approve-artist` → Logs approval, deployment status, onchain update
- ✅ `/admin/reject-artist` → Logs rejection reason, onchain removal
- ✅ Contract deployments → Logs contract address, transaction hash
- ✅ Admin deletion → Tracked through DELETE /whitelist/:id endpoint

**Audit Trail Example**:

```json
{
  "admin_wallet": "0x1234...",
  "action": "approve_artist",
  "target_wallet": "0xabcd...",
  "status": "approved",
  "details": {
    "deploymentStatus": "deployed",
    "contractAddress": "0x789...",
    "deploymentTx": "0xdef...",
    "onchainUpdateTx": "0x123..."
  },
  "created_at": "2026-03-30T12:34:56Z"
}
```

---

### 4. ✅ VITE ENVIRONMENT VARIABLE CONFIG

**Updated `vite.config.ts`**:

```typescript
import { defineConfig } from "vite";
import { loadEnv } from "vite";  // ✅ NEW

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");  // ✅ Load .env files
  
  return {
    define: {
      // ✅ Expose VITE_SECURE_API_BASE_URL to build
      "import.meta.env.VITE_SECURE_API_BASE_URL": JSON.stringify(
        env.VITE_SECURE_API_BASE_URL || env.VITE_API_BASE || ""
      ),
    },
    // ... rest of config
  };
});
```

**Environment Variables**:

```bash
# .env.local (development)
VITE_SECURE_API_BASE_URL=http://localhost:8787
VITE_API_BASE=http://localhost:8787

# .env.production (or Vercel dashboard)
VITE_SECURE_API_BASE_URL=https://api.yourdomain.com
VITE_API_BASE=https://api.yourdomain.com
```

**Benefits**:
- ✅ No hardcoded API URLs
- ✅ Environment-specific configuration
- ✅ Secure for production deployments
- ✅ Works with Vercel, Netlify, etc.

---

### 5. ✅ DEDICATED REJECTION ENDPOINT

**New Endpoint: `POST /admin/reject-artist`**

```javascript
app.post("/admin/reject-artist", authRequired, adminRequired, async (req, res) => {
  const { wallet, reason } = req.body;
  
  // 1. Update whitelist status to "rejected"
  await supabase.from("whitelist").update({
    status: "rejected",
    rejection_reason: reason
  }).eq("wallet", wallet);
  
  // 2. Remove approval from onchain whitelist
  await setArtistApprovalOnchain(wallet, false);
  
  // 3. Log audit trail
  await supabase.from("admin_audit_log").insert({
    admin_wallet: req.auth.wallet,
    action: "reject_artist",
    details: { reason }
  });
  
  return res.json({ success: true, rejection: { reason, rejectedAt } });
});
```

**Benefits**:
- ✅ Clear separation from approval
- ✅ Tracks rejection reason
- ✅ Updates onchain whitelist
- ✅ Removes confusion with `approve: false`

---

### 6. ✅ ENHANCED APPROVE ENDPOINT

**Updated: `POST /admin/approve-artist`**

**New Flow**:

```
Request: { wallet, approve, deployContract }
  │
  ├─→ ✅ Update Supabase whitelist.status
  │
  ├─→ ✅ Call setArtistApprovalOnchain(wallet, true)
  │     └─→ Calls ArtDropFactory.setArtistApproval()
  │     └─→ Emits ArtistApprovalUpdated event
  │
  ├─→ ✅ Deploy per-artist contract (requires onchain approval)
  │     └─→ Calls deployArtDrop() which checks artistApproved[wallet]
  │     └─→ Returns contract address + deployment tx
  │
  ├─→ ✅ Update artist record with contract address
  │
  └─→ ✅ Log to admin_audit_log table
      └─→ Records deployment status, contract address, txn hash
```

**Response Example**:

```json
{
  "success": true,
  "artist": {
    "id": "uuid",
    "wallet": "0x...",
    "contract_address": "0x...",
    "contract_deployed_at": "2026-03-30T12:34:56Z"
  },
  "deployment": {
    "status": "deployed",
    "address": "0x...",
    "tx": "0x..."
  },
  "onchain": {
    "transactionHash": "0x...",
    "blockNumber": 123456
  }
}
```

---

## DATA ARCHITECTURE

### Before (Local/Hardcoded)
```
❌ Nonces: In-memory Map (lost on restart)
❌ Whitelist: Supabase only (no onchain enforcement)
❌ Admin Actions: No audit trail
❌ API Base URL: Hardcoded
```

### After (Onchain + Persistent)
```
✅ Nonces: Supabase table (persistent, one-time use)
✅ Whitelist: Onchain mapping (ArtDropFactory) + Supabase table
✅ Admin Actions: Supabase audit_log table (full trail)
✅ API URLs: Vite config + environment variables
```

---

## DATA FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  (React + Viem)                                             │
└────────────────────────────┬─────────────────────────────────┘
                             │
                    Uses VITE_SECURE_API_BASE_URL
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                      BACKEND (Express)                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ /auth/challenge                                         │ │
│  │  └─→ issueNonce() ─────────────────┐                  │ │
│  │                                    │                   │ │
│  │ /auth/verify                       └─→ Supabase DB    │ │
│  │  └─→ verifyNonce() ────────────────────> (nonces)    │ │
│  │                                                        │ │
│  │ /admin/approve-artist                                  │ │
│  │  ├─→ Update whitelist table ──────────┐              │ │
│  │  ├─→ setArtistApprovalOnchain() ──────┼─→ RPC Call  │ │
│  │  ├─→ deployArtDrop() ────────────────┘   ▼           │ │
│  │  └─→ Log audit trail ────────────────> Supabase DB   │ │
│  │                                      (admin_audit_log)│ │
│  │ /admin/reject-artist                                   │ │
│  │  ├─→ Update whitelist (rejected)                       │ │
│  │  ├─→ setArtistApprovalOnchain(false) ──┐             │ │
│  │  └─→ Log audit trail                   └─→ RPC Call  │ │
└──────────────────────────────────────────────────────────────┘
            │                        │
            ├────────────────────────┼──────────────────┐
            │                        │                  │
            ▼                        ▼                  ▼
┌──────────────────┐   ┌─────────────────────┐  ┌─────────────────┐
│   Supabase DB    │   │ Base Sepolia Chain  │  │ IPFS/Pinata     │
│                  │   │                     │  │ (File Storage)  │
│ • whitelist      │   │ ArtDropFactory      │  │                 │
│ • artists        │   │   ├─ artistApproved │  │ Metadata        │
│ • drops          │   │   ├─ setApproval()  │  │ Assets          │
│ • orders         │   │   └─ deployArtDrop()│  │                 │
│ • nonces         │   │                     │  │                 │
│ • admin_audit_log│   │ ArtDropArtist       │  │                 │
│                  │   │   ├─ mint()         │  │                 │
│                  │   │   └─ subscribe()    │  │                 │
└──────────────────┘   └─────────────────────┘  └─────────────────┘
```

---

## MIGRATION INSTRUCTIONS

### 1. Deploy Smart Contract Updates

```bash
# Compile contracts
npm run compile

# Deploy to Base Sepolia
# Update ART_DROP_FACTORY_ADDRESS in .env

npx hardhat run scripts/deploy-factory.mjs --network baseSepolia
```

### 2. Run Supabase Migrations

```sql
-- Run in Supabase SQL Editor:

-- Create nonces table
psql << 'EOF'
  -- Run contents of supabase/migrations/20260330_create_nonces_table.sql
EOF

-- Create audit log table
psql << 'EOF'
  -- Run contents of supabase/migrations/20260330_create_audit_log_table.sql
EOF
```

### 3. Update Environment Variables

```bash
# .env.local (or .env file in project root)
VITE_SECURE_API_BASE_URL=http://localhost:8787
VITE_API_BASE=http://localhost:8787

# Production (Vercel/Netlify)
# Set in Dashboard:
# - VITE_SECURE_API_BASE_URL=https://api.yourdomain.com
# - VITE_API_BASE=https://api.yourdomain.com
```

### 4. Rebuild Frontend

```bash
npm run build
# Vite now properly loads VITE_SECURE_API_BASE_URL
```

### 5. Restart Backend

```bash
npm run server
# Server now uses Supabase for nonces instead of in-memory Map
```

---

## VERIFICATION CHECKLIST

- [x] ArtDropFactory has onchain `artistApproved` mapping
- [x] ArtDropFactory has `setArtistApproval()` function
- [x] ArtDropFactory requires approval before `deployArtDrop()`
- [x] Supabase `nonces` table created with proper indexes
- [x] Supabase `admin_audit_log` table created
- [x] Nonce functions use async Supabase calls
- [x] One-time nonce use enforced (marked as used)
- [x] `/auth/challenge` stores nonces in DB
- [x] `/auth/verify` retrieves and marks nonces as used
- [x] `/admin/approve-artist` calls `setArtistApprovalOnchain()`
- [x] `/admin/reject-artist` endpoint created
- [x] Both admin endpoints log to audit table
- [x] Vite config loads environment variables
- [x] VITE_SECURE_API_BASE_URL exposed to build
- [x] All admin operations have authRequired + adminRequired
- [x] All endpoints properly handle errors
- [x] No in-memory data structures remain
- [x] No hardcoded API URLs in source code

---

## SECURITY IMPROVEMENTS

1. **Nonce Replay Prevention**
   - One-time use enforcement (marked after verification)
   - Persisted across server restarts
   - Works with load balancers + multiple instances

2. **Onchain Approval Verification**
   - Whitelist stored immutably on blockchain
   - Contract deployment requires onchain proof
   - Prevents admin-only database tampering

3. **Admin Audit Trail**
   - All approvals/rejections logged
   - Tracks who approved whom and when
   - Stores deployment details and errors
   - Can be used for compliance/debugging

4. **Environment Isolation**
   - API URLs configured per environment
   - Production URLs separate from dev
   - No secrets in source code

---

## NEXT STEPS (Optional Enhancements)

1. **Rate Limiting**
   ```javascript
   const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 5,
   });
   app.post("/auth/verify", authLimiter, ...);
   ```

2. **Redis Cache for Nonces** (High-traffic deployments)
   ```javascript
   async function issueNonce(wallet) {
     const nonce = generateNonce();
     await redis.setex(`nonce:${wallet}`, 300, nonce);
   }
   ```

3. **Email Notifications**
   - Send email when artist approved
   - Send email when artist rejected (with reason)
   - Send email to admin when new artist applies

4. **Whitelist Expiry**
   - Add `expires_at` field to whitelist table
   - Periodically re-approve artists
   - Archive old approvals

5. **Multi-Sig Approval** (For high-security scenarios)
   - Require 2+ admins to approve artists
   - Implement signing workflow

---

## TESTING

### Test Nonce Storage
```bash
# Should use Supabase, not in-memory Map
curl -X POST http://localhost:8787/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet": "0x..."}'

# Check Supabase: SELECT * FROM nonces
```

### Test Onchain Approval
```bash
# Should call setArtistApproval() on contract
curl -X POST http://localhost:8787/admin/approve-artist \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"wallet": "0x...", "approve": true, "deployContract": true}'

# Check Supabase: SELECT * FROM admin_audit_log
# Check Chain: ArtDropFactory.isArtistApproved(0x...)
```

### Test Rejection Endpoint
```bash
curl -X POST http://localhost:8787/admin/reject-artist \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"wallet": "0x...", "reason": "Does not meet criteria"}'
```

---

## SUMMARY

✅ **All local/hardcoded data migrated to persistent storage**

| Data | Before | After |
|------|--------|-------|
| Nonces | In-memory Map ❌ | Supabase `nonces` table ✅ |
| Whitelist | DB only ❌ | ArtDropFactory + Supabase ✅ |
| Admin Actions | No logging ❌ | Supabase `admin_audit_log` ✅ |
| API URLs | Hardcoded ❌ | Vite config + Env vars ✅ |

**Result**: Enterprise-grade architecture with auditability, scalability, and onchain enforcement.
