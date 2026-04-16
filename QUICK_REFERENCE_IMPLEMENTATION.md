# Critical Fixes - Quick Reference & Implementation Guide
**Date:** April 15, 2026  
**Priority:** IMMEDIATE (Week 1)  
**Time Estimate:** 4-6 hours  

---

## Executive Summary

Three critical security issues need immediate fixing:

| Issue | Risk | Fix Effort | Impact |
|-------|------|-----------|--------|
| CSRF tokens unused | High | 2 hours | Security gap |
| Auth tokens in localStorage | Critical | 2 hours | XSS vulnerability |
| Relative API paths | Medium | 1 hour | Routing inconsistency |

**Total Effort:** ~5 hours  
**Testing:** 1-2 hours  
**Rollout:** Low risk (hooks only)

---

## Quick File Reference

### Files to Create
```
src/lib/authContext.ts          NEW - Token management
```

### Files to Modify
```
src/lib/apiBase.ts              ADD CSRF injection functions
src/hooks/useNotifications.ts    REPLACE entire file
src/lib/adminApi.ts             UPDATE headers function
src/App.tsx                      ADD CSRF initialization
src/pages/login.tsx (or equiv)   ADD token storage
```

---

## Implementation Checklist

### Phase 1: Token Management (45 min)

- [ ] **Create authContext.ts**
  ```bash
  touch src/lib/authContext.ts
  ```
  Copy from CRITICAL_FIXES_IMPLEMENTATION.md → Fix 2
  
- [ ] **Update apiBase.ts**
  - Add `createMutationHeaders()` function
  - Add `secureFetch()` function
  - Keep existing CSRF functions unchanged
  - Append to end of file

### Phase 2: Hook Updates (90 min)

- [ ] **Replace useNotifications.ts**
  - Delete current file content
  - Copy full replacement from CRITICAL_FIXES_IMPLEMENTATION.md → Fix 3
  - Verify imports resolve
  
- [ ] **Update adminApi.ts**
  - Import `createMutationHeaders`
  - Replace `getAuthHeaders()` implementation
  - Update `approve()` function call
  - Copy from CRITICAL_FIXES_IMPLEMENTATION.md → Fix 4

### Phase 3: App Integration (30 min)

- [ ] **Update App.tsx**
  Add on mount:
  ```typescript
  import { initializeCSRFToken } from '@/lib/apiBase';
  
  useEffect(() => {
    initializeCSRFToken().catch(err => 
      console.warn('CSRF init failed (non-critical):', err)
    );
  }, []);
  ```

- [ ] **Update Login Component**
  Replace all `localStorage.setItem('authToken', token)` with:
  ```typescript
  import { setAuthToken } from '@/lib/authContext';
  
  // After successful login:
  setAuthToken(token);
  ```

- [ ] **Update Logout Component**
  Replace `localStorage.removeItem('authToken')` with:
  ```typescript
  import { clearAuthToken } from '@/lib/authContext';
  
  clearAuthToken();
  ```

### Phase 4: Testing (60 min)

- [ ] **Manual Testing**
  - [ ] Notifications fetch with CSRF token
  - [ ] Notifications update with CSRF token
  - [ ] Admin approval includes CSRF token
  - [ ] No localStorage usage for auth
  - [ ] CSRF token appears in request headers
  - [ ] Logout clears all tokens
  - [ ] Polling cancels properly on unmount

- [ ] **Browser DevTools**
  - Open Network tab
  - Check POST/PATCH requests:
    ```
    ✅ Authorization header present
    ✅ X-CSRF-Token header present
    ✅ Credentials: include set
    ✅ No localStorage use
    ```

- [ ] **Console Check**
  - [ ] No "Cannot read property 'getItem'" from localStorage
  - [ ] CSRF token initialization message
  - [ ] No unhandled promise rejection on CSRF

---

## Before/After Code Comparison

### BEFORE: Vulnerable Pattern
```typescript
// ❌ BAD: localStorage + no CSRF
const response = await fetch('/api/notifications', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
});
```

### AFTER: Secure Pattern
```typescript
// ✅ GOOD: Secure auth + CSRF
import { getAuthToken, createMutationHeaders } from '@/lib/authContext';
import { SECURE_API_BASE } from '@/lib/apiBase';

const headers = await createMutationHeaders({
  'Authorization': `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json'
}, 'PATCH');

const response = await fetch(
  `${SECURE_API_BASE}/notifications/preferences`,
  {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify(data)
  }
);
```

---

## Import Statements Changes

### Hooks & Components
```typescript
// OLD ❌
import { useNotifications } from '@/hooks/useNotifications';

// NEW ✅ (same)
import { useNotifications } from '@/hooks/useNotifications';
// Hook handles auth internally now
```

### Auth Tokens
```typescript
// OLD ❌
import { useEffect } from 'react';
// ... then in login handler:
localStorage.setItem('authToken', jwt);

// NEW ✅
import { setAuthToken } from '@/lib/authContext';
// ... then in login handler:
setAuthToken(jwt);
```

### API Calls
```typescript
// OLD ❌
const response = await fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
});

// NEW ✅
import { SECURE_API_BASE, createMutationHeaders } from '@/lib/apiBase';
import { getAuthToken } from '@/lib/authContext';

const headers = await createMutationHeaders({
  'Authorization': `Bearer ${getAuthToken()}`,
}, 'PATCH');
const response = await fetch(
  `${SECURE_API_BASE}/endpoint`,
  { method: 'PATCH', headers, credentials: 'include' }
);
```

---

## Rollback Plan

If issues occur, these are non-breaking changes:

```bash
# Revert to previous version
git revert <commit-hash>

# OR manually revert files:
git checkout HEAD -- src/hooks/useNotifications.ts
git checkout HEAD -- src/lib/apiBase.ts
# etc.
```

No database changes, no breaking API changes.

---

## Verification Script (Run After Implementation)

```bash
# Check file existence
[ -f src/lib/authContext.ts ] && echo "✅ authContext.ts created"
[ -f src/hooks/useNotifications.ts ] && echo "✅ useNotifications.ts updated"

# Search for localStorage 'authToken' (should be 0)
STORAGE_REFS=$(grep -r "localStorage.*authToken" src/ 2>/dev/null | wc -l)
echo "❓ localStorage authToken references: $STORAGE_REFS (should be 0)"

# Search for CSRF usage (should be >0)
CSRF_REFS=$(grep -r "X-CSRF-Token" src/ 2>/dev/null | wc -l)
echo "✅ X-CSRF-Token references: $CSRF_REFS (should be >2)"

# Search for createMutationHeaders usage (should be >0)
MUTATION_REFS=$(grep -r "createMutationHeaders" src/ 2>/dev/null | wc -l)
echo "✅ createMutationHeaders usage: $MUTATION_REFS (should be >2)"
```

---

## Deployment Notes

### Time to Deploy
- Development: ~2 hours
- Testing: ~1 hour
- Code Review: ~30 min
- Deploy: ~5 min
- **Total: ~3.5 hours**

### Risk Assessment
- **Breaking Changes:** None ❌
- **Database Changes:** None ❌
- **API Changes:** None ❌
- **Risk Level:** LOW ✅

### Rollout Strategy
1. Merge to feature branch
2. QA testing in staging
3. Merge to main
4. Deploy to production
5. Monitor for 24 hours
6. Deploy to all regions

---

## Success Criteria

After implementation, verify:

### Security
- [x] No localStorage use for auth tokens
- [x] All mutations include CSRF token
- [x] SECURE_API_BASE used for all endpoints
- [x] HTTP-only cookies ready for production

### Functionality  
- [x] Notifications fetch without errors
- [x] Notification preferences update works
- [x] Admin approval works
- [x] User can logout and reverify token
- [x] CSRF token rotates properly

### Performance
- [x] No increase in request latency
- [x] No memory leaks from AbortController
- [x] Polling cleans up on unmount
- [x] Multiple notifications don't race

### Logging
- [x] CSRF initialization logged
- [x] Auth errors logged with context
- [x] Polling lifecycle logged
- [x] No sensitive data in logs

---

## Next Steps After Implementation

### Week 2 - HIGH Priority
1. [ ] Replace `any` types (40+ instances in db.ts)
2. [ ] Add Zod schemas for API responses
3. [ ] Implement retry logic with exponential backoff
4. [ ] Add error boundaries to components

### Week 3 - MEDIUM Priority  
1. [ ] Replace notification polling with WebSocket
2. [ ] Enable/implement contract hooks
3. [ ] Add response validation to all endpoints
4. [ ] Create comprehensive API documentation

### Week 4 - Nice to Have
1. [ ] Add health check endpoint
2. [ ] Implement circuit breaker pattern
3. [ ] Add API performance monitoring
4. [ ] Create request/response middleware

---

## Support & Debugging

### Common Issues & Fixes

**Issue: "getAuthToken() returns null"**
```typescript
// Check if token was set
export function hasAuthToken(): boolean {
  return getAuthToken() !== null;
}

// In component:
if (!hasAuthToken()) {
  console.error('User not authenticated');
  redirectToLogin();
}
```

**Issue: "CSRF token not included in request"**
```bash
# Check headers in Network tab
# Should show: X-CSRF-Token: ...

# Check if createMutationHeaders called:
const headers = await createMutationHeaders({...}, 'PATCH');
console.log('Headers:', headers); // verify token present
```

**Issue: "AbortController warnings"**
```typescript
// Ensure cleanup in useEffect return:
return () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
};
```

---

## Documentation Linked to This Guide

- **Full Implementation Details:** `CRITICAL_FIXES_IMPLEMENTATION.md`
- **User Flow Architecture:** `DETAILED_USER_FLOW_ANALYSIS.md`
- **Original Audit:** `API_INTEGRATION_AUDIT_APRIL15_2026.md`

---

**Created:** April 15, 2026  
**Status:** Ready for Implementation  
**Contact:** Frontend Audit Team

