# Security & Architecture Audit - Phase 4
**Date**: March 30, 2026  
**Status**: IN PROGRESS  
**Scope**: Admin/Whitelist flows, Backend security, Onchain integration

---

## EXECUTIVE SUMMARY

✅ **Completed**: Secure backend API routing for admin whitelist operations  
❌ **Issues Found**: 5 critical  
⚠️ **Incomplete**: 3 features requiring implementation  

---

## FINDINGS

### 1. ✅ ADMIN ARTIST DELETION - CURRENTLY SECURE

**Current Implementation**:
```
Frontend (AdminPage.tsx)
  → removeArtist(id)
    → dbDeleteWhitelistEntry(id)
      → secureApiRequest(DELETE /whitelist/:id)
        → Backend (server/index.js)
          → authRequired (JWT token validation)
          → adminRequired (admin wallet check)
          → Supabase delete
```

**Security Posture**: ✅ GOOD
- DELETE endpoint has `authRequired` + `adminRequired` middleware
- JWT tokens validated with HS256 and issuer/audience claims
- Admin wallet verified against `ADMIN_WALLETS` env var
- Supabase uses service role key on backend (not exposed to client)

**Status**: Artist deletion backend is secure ✅

---

### 2. ⚠️ MISSING: WHITELIST REJECTION ENDPOINT

**Issue**: Admin can approve/revoke artists, but no dedicated reject endpoint exists.

**Current Flow**:
```
useApproveArtist() → POST /admin/approve-artist
  { wallet, approve: false, deployContract: false }
```

**Problem**: Rejection is handled via the same approval endpoint with `approve: false`. This can be confusing. A dedicated endpoint would be clearer.

**Recommendation**: Create `POST /admin/reject-artist` endpoint
```typescript
// Backend
app.post("/admin/reject-artist", authRequired, adminRequired, async (req, res) => {
  const { wallet, reason } = req.body;
  const normalized = normalizeWallet(wallet);
  
  // Update whitelist status to "rejected"
  // Optionally log rejection reason in audit table
  // Notify artist via Supabase email trigger
});
```

---

### 3. ⚠️ ENVIRONMENT: MISSING SECURE API BASE URL CONFIG

**Issue**: `VITE_SECURE_API_BASE_URL` is NOT set up in Vite config, but AdminAPI code expects it.

**Current Code** (src/lib/adminApi.ts:11):
```typescript
const API_BASE = (import.meta.env.VITE_SECURE_API_BASE_URL || import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
```

**Missing**: Vite config doesn't define environment variable for build process.

**Fix Required**:
```typescript
// vite.config.ts
import { loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    define: {
      'import.meta.env.VITE_SECURE_API_BASE_URL': JSON.stringify(
        env.VITE_SECURE_API_BASE_URL || env.VITE_API_BASE || ""
      ),
    },
    // ... rest of config
  };
});
```

**Environment Variables Needed**:
```
# .env.local for development
VITE_SECURE_API_BASE_URL=http://localhost:8787

# In Vercel/production dashboard
VITE_SECURE_API_BASE_URL=https://api.yourdomain.com
VITE_API_BASE=https://api.yourdomain.com
```

---

### 4. ❌ MISSING: ONCHAIN WHITELIST IMPLEMENTATION

**Issue**: User requested "enable new whitelist that is minted onchain" - this doesn't exist yet.

**Current State**: Whitelist is DB-only (Supabase)
```
✅ Supabase whitelist table (status: pending/approved/rejected)
❌ No onchain whitelist contract
❌ No minting of whitelist NFTs/tokens
❌ No onchain verification flow
```

**What's Needed**:

#### Option A: Whitelist NFT (ERC721)
```solidity
contract WhitelistNFT is ERC721Enumerable {
  mapping(address => bool) public whitelisted;
  
  function mintWhitelistNFT(address artist) onlyAdmin {
    _mint(artist, tokenId);
    whitelisted[artist] = true;
  }
}
```

**Pro**: Cleaner, composable, artists own their approval
**Con**: Adds complexity, gas costs

#### Option B: Whitelist Mapping (Simple)
```solidity
contract Whitelist {
  mapping(address => bool) public approved;
  
  function setApproval(address artist, bool status) onlyAdmin {
    approved[artist] = status;
    emit WhitelistUpdated(artist, status);
  }
}
```

**Pro**: Minimal overhead, gas efficient
**Con**: Not composable, centralized

#### Recommended: **Option B + emit events** → reuse ArtDropFactory's approval flow

**Implementation Plan**:
1. Add `mapping(address => bool) public artistApproved` to ArtDropFactory
2. Add `setArtistApproval(address artist, bool approved)` onlyOwner function
3. Backend calls this when admin approves
4. Frontend verifies approval before allowing deployment

---

### 5. ⚠️ WALLET AUTHENTICATION: NONCE REUSE POTENTIAL

**Issue**: Nonces stored in memory map, expires after 10 minutes. In production with multiple server instances, nonces won't sync.

**Current Code** (server/index.js:44-51):
```javascript
const nonces = new Map();

function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [wallet, entry] of nonces.entries()) {
    if (entry.expiresAt <= now) nonces.delete(wallet);
  }
}
```

**Problem in Production**:
- If you have 2 server instances: Server A issues nonce, Server B can't verify it
- Nonce expiry is per-instance, not synchronized
- No audit trail of auth attempts

**Recommended Fix**: Use Redis for nonce storage
```javascript
// Use Redis instead of Map
const redis = new Redis(process.env.REDIS_URL);

async function issueNonce(wallet) {
  const nonce = generateNonce();
  await redis.setex(`nonce:${wallet}`, 600, nonce); // 10 min expiry
  return nonce;
}

async function verifyNonce(wallet, nonce) {
  const stored = await redis.get(`nonce:${wallet}`);
  if (stored !== nonce) throw new Error("Invalid nonce");
  
  // Delete after verification (prevents replay)
  await redis.del(`nonce:${wallet}`);
  return true;
}
```

**Or**: Use Supabase for nonce table (simpler, no extra service)
```sql
CREATE TABLE nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  nonce TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## FULL CODE AUDIT RESULTS

### Architecture Graph
```
Frontend (React + Viem)
├── Admin/Whitelist UI (AdminPage.tsx)
│   ├── Approve: POST /admin/approve-artist ✅ SECURE
│   ├── Reject: POST /admin/approve-artist (approve=false) ✅ WORKS (not ideal)
│   └── Delete: DELETE /whitelist/:id ✅ SECURE
├── Artist Studio (ArtistStudioPage.tsx)
│   └── Create drops (uses per-artist contracts) ✅ SECURE
└── Collection (MyCollectionPage.tsx)
    └── View assets (multi-format) ✅ WORKS

Backend (Express + Node)
├── Auth Layer
│   ├── POST /auth/nonce ✅ Issue challenge
│   ├── POST /auth/verify ✅ Verify signature → JWT
│   └── JWT validation ✅ HS256 with claims
├── Admin Operations
│   ├── POST /admin/approve-artist ✅ Deploy + approve
│   ├── GET /admin/artists ✅ List pending/approved
│   └── DELETE /whitelist/:id ✅ Remove artist
├── File Operations
│   ├── POST /pinata/file ✅ Upload to IPFS
│   └── POST /pinata/json ✅ Upload metadata
└── Smart Contract Integration
    ├── Deployment (ArtDropFactory) ✅ Can be called
    └── Verification ⚠️ Limited logging

Contracts (Solidity)
├── ArtDropArtist.sol ✅ Per-artist NFT contract
├── ArtDropFactory.sol ✅ Deploys per-artist instances
├── ArtistSharesToken.sol ⚠️ Not actively used
├── ProductStore.sol ⚠️ Unclear if active
└── POAPCampaign.sol ⚠️ Unused
```

### File Security Checklist

| File | Secure? | Issues | Notes |
|------|---------|--------|-------|
| `server/index.js` | ✅ GOOD | Nonce reuse in multi-instance | Use Redis/DB for nonces |
| `src/lib/adminApi.ts` | ✅ GOOD | Missing env var in Vite | Add to vite.config.ts |
| `src/pages/AdminPage.tsx` | ✅ GOOD | State management solid | No issues found |
| `src/lib/whitelist.ts` | ⚠️ MIXED | Fallback to localStorage risky | OK for non-sensitive data |
| `src/lib/db.ts` | ✅ GOOD | Uses secureApiRequest for writes | Correct pattern |
| `vite.config.ts` | ⚠️ MISSING | No env var handling | Needs loadEnv() setup |
| `.env.example` | ✅ GOOD | Comprehensive, secure defaults | Documentation clear |

---

## ACTION ITEMS

### 🔴 CRITICAL (Do First)
- [ ] 1. Add `VITE_SECURE_API_BASE_URL` to Vite config with `loadEnv()`
- [ ] 2. Set `VITE_SECURE_API_BASE_URL` in `.env.local` and Vercel/deployment
- [ ] 3. Implement `POST /admin/reject-artist` endpoint (dedicated rejection)
- [ ] 4. Migrate nonce storage from in-memory Map to Redis or Supabase

### 🟡 IMPORTANT (Phase 4 work)
- [ ] 5. Design & implement onchain whitelist (recommend Option B: mapping in factory)
- [ ] 6. Add `setArtistApproval` to ArtDropFactory contract
- [ ] 7. Update admin approval flow to call blockchain whitelist function
- [ ] 8. Add admin audit logging table (tracks who approved/rejected whom, when)

### 🟢 NICE TO HAVE (Enhancement)
- [ ] 9. Email notifications when artist approved/rejected
- [ ] 10. Artist appeal/reapplication workflow
- [ ] 11. Whitelist expiry dates (periodic re-approval)
- [ ] 12. Multi-sig admin approval for sensitive actions

---

## SECURITY RECOMMENDATIONS

### 1. **Environment Variable Management**
```bash
# Local development
cp .env.example .env.local
# Edit VITE_SECURE_API_BASE_URL=http://localhost:8787

# Production (Vercel)
# Set in Environment Variables:
# - VITE_SECURE_API_BASE_URL=https://api.yourdomain.com
# - NODE_ENV=production
# - APP_JWT_SECRET=<strong-secret>
# - ADMIN_WALLETS=0x...
```

### 2. **Nonce Management - Immediate Fix**
Replace in-memory nonce map with database-backed approach to support load balancing.

### 3. **Rate Limiting**
Add rate limiting to auth endpoints to prevent brute force:
```javascript
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: "Too many auth attempts, try again later",
});

app.post("/auth/verify", authLimiter, ...);
```

### 4. **Audit Logging**
Track all admin actions:
```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY,
  admin_wallet TEXT NOT NULL,
  action TEXT NOT NULL, -- 'approve', 'reject', 'deploy', etc.
  target_wallet TEXT,
  status TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. **Contract Deployment Verification**
Currently deployment is placeholder. Implement actual verification:
```javascript
async function deployArtistContractForWallet(wallet) {
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  
  const factory = new ethers.Contract(
    ART_DROP_FACTORY_ADDRESS,
    FACTORY_ABI,
    deployer
  );
  
  const tx = await factory.deployArtistContract(wallet, FOUNDER_WALLET);
  const receipt = await tx.wait();
  
  // Extract contract address from event logs
  const contractAddress = extractFromLogs(receipt, FACTORY_ABI);
  
  return { contractAddress, deploymentTx: tx.hash };
}
```

---

## VALIDATION CHECKLIST

- [x] All admin endpoints have `authRequired` middleware
- [x] All admin endpoints have `adminRequired` middleware
- [x] JWT tokens validated on every request
- [x] Admin wallet verified from Supabase/env
- [x] Sensitive data (DEPLOYER_PRIVATE_KEY) not exposed to frontend
- [ ] Nonce replay prevention implemented
- [ ] Rate limiting on auth endpoints
- [ ] Audit logging for admin actions
- [ ] Onchain whitelist contract deployed
- [ ] Environment variables configured in production

---

## NEXT STEPS

1. **Immediate** (Today):
   - Fix Vite env var loading
   - Set VITE_SECURE_API_BASE_URL in .env.local
   - Test admin approval flow end-to-end

2. **This Week**:
   - Implement Redis/Supabase nonce storage
   - Create onchain whitelist contract
   - Add admin rejection endpoint
   - Set up audit logging

3. **Next Sprint**:
   - Integrate onchain whitelist with admin flow
   - Add email notifications
   - Rate limiting & security hardening
   - Load test multi-instance setup

---

## CONCLUSION

**Current Security**: ✅ Backend API routing is properly secured with JWT + admin checks

**Critical Gaps**:
1. Native support for onchain whitelist (not yet implemented)
2. Environment variable configuration incomplete in Vite
3. Nonce replay prevention limited to single instance

**Recommendation**: Proceed with Phase 4 product model refactoring, but prioritize fixing Vite env var + nonce storage before production deployment.

---

**Audit Conducted By**: Security Review Agent  
**Status**: PENDING FIXES  
**Next Review**: After implementing CRITICAL items
