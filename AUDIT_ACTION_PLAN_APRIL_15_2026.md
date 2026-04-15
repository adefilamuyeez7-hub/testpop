# POPUP Platform - Audit Action Plan
**Date**: April 15, 2026  
**Current Production Readiness**: 70% (↑ from 40% after April 15 fixes)  
**Target**: 95% by end of April  
**Total Effort**: 40-50 hours  

---

## EXECUTIVE SUMMARY

✅ **COMPLETED (April 15, 2026)**:
- Row-Level Security (RLS) migration created (355 lines SQL)
- CSRF protection added to 11 endpoints
- Input validation framework built (4 schemas)
- Auth module extracted (335 lines, modular)
- TypeScript strict mode enabled

⚠️ **REMAINING BLOCKERS** (24 issues):
- **4 CRITICAL** — Must fix before any user data
- **8 HIGH** — Must fix before launch
- **8 MEDIUM** — Should fix before launch
- **4 LOW** — Nice-to-have polish

---

## PRIORITY 1: CRITICAL BLOCKERS (Do Now - 1 Week)

### 1.1 Verify RLS Migration Deployed ⏱️ 15 minutes
**Status**: Migration created, deployment status UNKNOWN  
**Risk**: Data breach if not deployed (any user reads all data)

**Action**:
```sql
-- Run in Supabase SQL Editor to verify:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('drops', 'orders', 'subscriptions', 'products', 'subscriptions', 'artists', 'profiles', 'whitelist');

-- Should show rowsecurity = true for ALL 8 tables
-- If false: Execute entire contents of supabase/migrations/20260415_rls_policies_complete.sql
```

**Test RLS**:
```sql
-- Verify row-level access control works:
-- Set JWT to user-A-wallet
SELECT * FROM orders 
WHERE buyer_wallet = 'user-B-wallet';

-- Should return: NO ROWS (RLS blocked it)
```

✅ **Completion Criteria**: All 8 tables show `rowsecurity = true` + test passes

---

### 1.2 Add CSRF to 5 Missing Endpoints ⏱️ 30 minutes
**Status**: 75% complete (11/16 endpoints protected)  
**Missing Endpoints**:
1. `POST /pinata/file` (line 4381)
2. `POST /api/pinata/file` (line 4382)
3. `POST /admin/approve-artist` (line 4652)
4. `POST /admin/reject-artist` (line 4699)
5. `POST /maintenance/cleanup-drops` (line 1825)

**Action**:
```javascript
// In server/index.js, add csrfProtection middleware:

// Line 4381:
- app.post("/pinata/file", authRequired, upload.single("file"), pinataFileImpl);
+ app.post("/pinata/file", authRequired, csrfProtection, upload.single("file"), pinataFileImpl);

// Line 4382:
- app.post("/api/pinata/file", authRequired, upload.single("file"), pinataFileImpl);
+ app.post("/api/pinata/file", authRequired, csrfProtection, upload.single("file"), pinataFileImpl);

// Line 4652:
- app.post("/admin/approve-artist", authRequired, adminRequired, async (req, res) => {
+ app.post("/admin/approve-artist", authRequired, adminRequired, csrfProtection, async (req, res) => {

// Line 4699 + 1825: Similar pattern
```

**Test**:
```bash
# POST with token should succeed (200)
curl -X POST http://localhost:3000/pinata/file \
  -H "X-CSRF-Token: <token-from-GET-/api/csrf-token>" \
  -H "Authorization: Bearer <jwt>"

# POST without token should fail (403)
curl -X POST http://localhost:3000/pinata/file \
  -H "Authorization: Bearer <jwt>"
# Should return: { "error": "CSRF token missing" }
```

✅ **Completion Criteria**: All 5 endpoints have `csrfProtection` middleware + tests pass

---

### 1.3 Add Pagination to All List Endpoints ⏱️ 3 hours
**Status**: Utilities defined (unused), endpoints lack pagination  
**Affected Endpoints** (6 total):
- `GET /orders` (line 3050)
- `GET /gifts` (line 3783)
- `GET /ip-campaigns` (line 3583)
- `GET /ip-investments` (line 3639)
- `GET /artist-applications` (line ~4800)
- `GET /entitlements` (line ~4850)

**Action**:
```javascript
// Import pagination utilities (already defined at line 4183):
const { getPaginationParams, buildPaginatedResponse } = require('./pagination-helpers');

// Example: GET /orders
// OLD (unbounded, N+1 queries):
app.get("/orders", authRequired, async (req, res) => {
  const data = await listOrdersForBuyer(requestedWallet);
  return res.json(filtered);
});

// NEW (paginated, efficient):
app.get("/orders", authRequired, async (req, res) => {
  const { page, limit, sort, order } = getPaginationParams(req);
  const offset = (page - 1) * limit;
  
  // Get total count
  const { count: total } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("buyer_wallet", requestedWallet);

  // Get paginated results
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("buyer_wallet", requestedWallet)
    .order(sort, { ascending: order === "asc" })
    .range(offset, offset + limit - 1);

  if (error) return res.status(400).json({ error: error.message });
  
  return res.json(buildPaginatedResponse(data, total, page, limit));
});

// Frontend calls:
// GET /orders?page=1&limit=20&sort=created_at&order=desc
```

✅ **Completion Criteria**: All 6 endpoints return:
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "pages": 8,
  "hasMore": true
}
```

---

### 1.4 Wire Input Validation to 30 Endpoints ⏱️ 4 hours
**Status**: Schemas created, 5 endpoints wired, 30+ need integration  
**Benefit**: Prevents SQL injection, type corruption, DoS attacks

**Affected Endpoints** (sample):
- `POST /creative-releases` (line 2706) - No schema validation
- `POST /ip-campaigns` (line 3583) - No schema validation  
- `POST /ip-investments` (line 3639) - No schema validation
- `POST /gifts/:id/accept` (line 3792) - No schema validation

**Action**:
```javascript
// Pattern: Add validation check before using request body

// BEFORE (line 2706):
registerRoute("post", "/creative-releases", authRequired, async (req, res) => {
  const payload = normalizeCreativeReleasePayload(req.body || {});
  if (!payload.title) {
    return res.status(400).json({ error: "title is required" });
  }
  // Continues without validating price_eth, supply, etc.
});

// AFTER:
registerRoute("post", "/creative-releases", authRequired, async (req, res) => {
  const payload = normalizeCreativeReleasePayload(req.body || {});
  
  // ADD THIS:
  const validation = validateInput(creativeReleaseSchema, payload);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid creative release", details: validation.error });
  }
  
  // Use validated data
  const insertPayload = validation.data;
  // ... rest of handler
});
```

**Create Missing Schemas** (server/validation.js):
```javascript
// Add these if missing:
export const creativeReleaseSchema = z.object({
  artist_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  price_eth: z.number().min(0).max(1000000),
  supply: z.number().int().min(1),
  // ... other required fields
});

export const campaignSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  // ... other fields
});
```

✅ **Completion Criteria**: 
- All 30 endpoints have validation
- POST with invalid data returns 400 with error details
- POST with valid data succeeds (200)

---

### 1.5 Run `npm audit` & Fix High/Critical Vulnerabilities ⏱️ 2 hours
**Status**: Not yet run  
**Why**: Found vulnerabilities could be exploited before launch

**Action**:
```bash
# Check for vulnerabilities
npm audit

# Fix automatically if possible
npm audit fix

# If manual fixes needed, update package.json versions
npm audit fix --force  # Only if necessary

# Verify:
npm audit --audit-level=moderate
# Should return: "No vulnerabilities found"
```

✅ **Completion Criteria**: `npm audit --audit-level=moderate` returns clean

---

### 1.6 Load Test with 100 Concurrent Users ⏱️ 4 hours
**Status**: Not done  
**Why**: Ensures critical fixes don't break under load; identifies performance issues

**Action**:
```bash
# Install load testing tool
npm install -g k6

# Create test script (load-test.js):
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users over 2 min
    { duration: '5m', target: 100 }, // Stay at 100 users for 5 min
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function() {
  // Test pagination
  let res1 = http.get(__ENV.BASE_URL + '/api/orders?page=1&limit=20');
  check(res1, { 'orders status 200': (r) => r.status === 200 });
  
  // Test auth
  let res2 = http.get(__ENV.BASE_URL + '/api/auth/session');
  check(res2, { 'auth status 401': (r) => r.status === 401 });
}

# Run load test
k6 run --vus 100 --duration 30s load-test.js

# Analyze results - look for:
# - Response time p95 < 1000ms
# - Error rate < 1%
# - No timeouts
```

✅ **Completion Criteria**: 
- Response time p95 < 1000ms
- Error rate < 1%
- No "connection refused" errors

---

## PRIORITY 2: HIGH-PRIORITY ISSUES (Do Next - 2 Weeks)

### 2.1 Refactor Monolithic Server into Modules ⏱️ 7-10 days
**Impact**: Easier to develop, test, maintain  
**Already Started**: Auth module extracted (server/routes/auth.js)

**Next Steps**:
```
1. Extract drops routes → server/routes/drops.js (250 lines)
2. Extract products routes → server/routes/products.js (300 lines)
3. Extract orders routes → server/routes/orders.js (400 lines)
4. Extract admin routes → server/routes/admin.js (250 lines)
5. Extract campaigns routes → server/routes/campaigns.js (150 lines)
6. Extract media routes → server/routes/media.js (100 lines)
7. Clean up main server/index.js → only setup + mounting
```

**Blueprint**: [BACKEND_REFACTORING_BLUEPRINT.md](BACKEND_REFACTORING_BLUEPRINT.md)

---

### 2.2 Per-Route Error Boundaries (Frontend) ⏱️ 4 hours
```typescript
// src/components/RouteErrorBoundary.tsx
function withErrorBoundary<P>(Component: React.FC<P>) {
  return (props: P) => (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

// Apply to all routes:
const OrderHistoryPageSafe = withErrorBoundary(OrderHistoryPage);
```

---

### 2.3 Admin Audit Logging Completion ⏱️ 2 hours
Ensure ALL admin actions logged to `admin_audit_log` table.

---

### 2.4 Database Index Optimization ⏱️ 2 hours
```sql
CREATE INDEX idx_orders_buyer_wallet ON orders(buyer_wallet);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_drops_artist_id ON drops(artist_id);
CREATE INDEX idx_drops_status ON drops(status);
CREATE INDEX idx_products_creator_wallet ON products(creator_wallet);
CREATE INDEX idx_entitlements_buyer_wallet ON entitlements(buyer_wallet);
```

---

### 2.5 Rate Limiting on Public Endpoints ⏱️ 2 hours
```javascript
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip || 'unknown',
});

app.get("/products", publicLimiter, async (req, res) => { ... });
app.get("/drops", publicLimiter, async (req, res) => { ... });
```

---

### 2.6 Response Time Monitoring ⏱️ 2 hours
```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`SLOW: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  next();
});
```

---

## PRIORITY 3: MEDIUM-PRIORITY (Do After Launch)

### 3.1 Fix TypeScript any Types ⏱️ 4 hours
Convert 20+ `any` types to `unknown` with runtime validation.

### 3.2 Add Integration Tests ⏱️ 1 week
```bash
npm test  # Using vitest
```

### 3.3 API Documentation ⏱️ 4 hours
Generate OpenAPI/Swagger spec for 30+ endpoints.

### 3.4 Code Comments & JSDoc ⏱️ 3 hours
Document complex functions.

---

## DEPLOYMENT BLOCKING CHECKLIST

✅ Before launching to ANY production users, verify:

- [ ] RLS migration deployed & verified (Section 1.1)
- [ ] CSRF on all 5 endpoints (Section 1.2)
- [ ] Pagination on list endpoints (Section 1.3)
- [ ] Input validation wired (Section 1.4)
- [ ] npm audit clean (Section 1.5)
- [ ] Load test passes 100 users (Section 1.6)
- [ ] Error messages don't expose schema
- [ ] Admin logging complete
- [ ] Response times monitored
- [ ] No console errors in browser DevTools
- [ ] All env variables configured
- [ ] Database backups scheduled

---

## WEEKLY SCHEDULE TO LAUNCH

**Week 1 (Apr 15-21)**: Critical Blockers
- Mon-Tue: RLS verification + CSRF + Pagination (8 hours)
- Wed: Input validation wiring (4 hours)
- Thu: npm audit + Load testing (6 hours)
- Fri: Buffer + documentation (2 hours)

**Week 2 (Apr 22-28)**: High-Priority Build
- Mon-Wed: Server refactoring Phase 1 (5 days)
- Thu-Fri: Error boundaries + Monitoring (2 days)

**Week 3 (Apr 29-30)**: Final Polish
- Apr 29: Load test again, performance tuning
- Apr 30: Production readiness sign-off

---

## SUCCESS METRICS

**Production Readiness Score**:
- Start: 70% ✅
- After Priority 1: 85% 🟠
- After Priority 2: 95% 🟢
- After Priority 3: 100% ✅

**Performance Metrics**:
- API response time p95: < 500ms
- Database queries < 10 per request
- Load test: 100 concurrent users, < 1% error rate
- Zero critical vulnerabilities

**Code Quality**:
- TypeScript: 100% strict mode compliance
- Test coverage: 80%+ for critical paths
- Code duplication: < 5%
- Documentation: All public APIs documented

---

## RESOURCES & REFERENCES

- [COMPREHENSIVE_AUDIT_APRIL_15_2026_FINAL.md](COMPREHENSIVE_AUDIT_APRIL_15_2026_FINAL.md) - Full audit details
- [BACKEND_REFACTORING_BLUEPRINT.md](BACKEND_REFACTORING_BLUEPRINT.md) - Architecture plan
- [server/routes/auth.js](server/routes/auth.js) - Example modular route extraction
- [server/validation.js](server/validation.js) - Validation schemas
- [FIXES_APPLIED_APRIL15_2026.md](FIXES_APPLIED_APRIL15_2026.md) - Changes already made

---

**Questions?** Review specific issues in the full audit report.
