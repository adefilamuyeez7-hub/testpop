# POPUP Platform - Code Optimization & Performance Guide

## Quick Win Optimizations (Implement This Week)

### 1. Add CSRF Protection (CRITICAL - 4 Hours)

**File: server/index.js**

Add after middleware setup (around line 290):

```javascript
// CSRF Token Middleware
const csrfTokens = new Map(); // In production, use Redis

app.get('/api/csrf-token', (req, res) => {
  const wallet = req.query.wallet || 'anonymous';
  const token = crypto.randomBytes(32).toString('hex');
  const key = `csrf:${wallet}`;
  csrfTokens.set(key, token);
  
  // Clear old tokens after 1 hour
  setTimeout(() => csrfTokens.delete(key), 60 * 60 * 1000);
  
  res.json({ token, expiresIn: 3600 });
});

app.use((req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Verify CSRF token
  const token = req.headers['x-csrf-token'];
  const wallet = normalizeWallet(req.body?.wallet || req.query?.wallet || '');
  const key = `csrf:${wallet}`;
  const storedToken = csrfTokens.get(key);
  
  if (!token || token !== storedToken) {
    return res.status(403).json({ error: 'CSRF token invalid or missing' });
  }
  
  csrfTokens.delete(key); // One-time use
  next();
});
```

**File: src/lib/db.ts**

Add CSRF handling:

```typescript
let cachedCsrfToken: string | null = null;
let csrfTokenExpiry: number = 0;

async function getCsrfToken(wallet: string): Promise<string> {
  const now = Date.now();
  if (cachedCsrfToken && csrfTokenExpiry > now) {
    return cachedCsrfToken;
  }
  
  const response = await fetch(`${SECURE_API_BASE_URL}/api/csrf-token?wallet=${wallet}`);
  const { token, expiresIn } = await response.json();
  cachedCsrfToken = token;
  csrfTokenExpiry = now + (expiresIn * 1000) - 60000; // Refresh 1 min before expiry
  return token;
}

export async function secureApiRequest(
  endpoint: string, 
  options: RequestInit,
  wallet?: string
) {
  const headers = new Headers(options.headers);
  
  // Add CSRF token for state-changing operations
  if (['POST', 'PATCH', 'DELETE'].includes(options.method || 'GET') && wallet) {
    const csrfToken = await getCsrfToken(wallet);
    headers.set('X-CSRF-Token', csrfToken);
  }
  
  return fetch(`${SECURE_API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });
}
```

---

### 2. Fix Sensitive Data in Logs (CRITICAL - 1 Hour)

**File: server/index.js**

Search for these patterns and fix:

```javascript
// ❌ DANGEROUS
console.error('Wallet error:', error);
console.log('Deployment TX:', deploymentTx);
console.debug('Supabase error:', error);

// ✅ SAFE
console.error('Wallet initialization failed');
console.log('Deployment succeeded');
console.debug('Database operation completed');

// For errors, use structured logging without stack:
console.error({
  errorType: error.name,
  errorMessage: error.message.substring(0, 50), // Truncate
  timestamp: new Date().toISOString()
  // NEVER: error, error.stack, error.cause
});
```

---

### 3. Add Error Boundaries to React (HIGH - 2 Hours)

**File: src/components/ErrorBoundary.tsx** (Create new)

```typescript
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', {
      error: error.message,
      component: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-8">Please try refreshing the page.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

**File: src/main.tsx** (Wrap root)

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
```

---

## Performance Optimizations (1-2 Weeks)

### 4. Eliminate N+1 Queries

**Current (Bad):**
```typescript
async function getArtistsWithDrops() {
  const artists = await supabase.from('artists').select('*');  // Query 1
  const withDrops = await Promise.all(
    artists.map(a => 
      supabase.from('drops').select('*').eq('artist_id', a.id)  // Queries 2-N+1
    )
  );
  return artists.map((a, i) => ({ ...a, drops: withDrops[i] }));
}
```

**Optimized (Good):**
```typescript
async function getArtistsWithDrops() {
  const [artists, drops] = await Promise.all([
    supabase.from('artists').select('*'),
    supabase.from('drops').select('*')
  ]);
  
  const dropsMap = new Map();
  drops.forEach(drop => {
    if (!dropsMap.has(drop.artist_id)) {
      dropsMap.set(drop.artist_id, []);
    }
    dropsMap.get(drop.artist_id).push(drop);
  });
  
  return artists.map(a => ({
    ...a,
    drops: dropsMap.get(a.id) || []
  }));
}
```

**Savings:** 500-100x faster for large datasets

---

### 5. Add Pagination Everywhere

**File: src/lib/db.ts**

```typescript
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export async function getArtistsWithPagination(options: PaginationOptions) {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100); // Max 100
  const offset = (page - 1) * limit;

  const query = supabase
    .from('artists')
    .select('*', { count: 'exact' });

  if (options.sort) {
    query.order(options.sort, { ascending: options.order === 'asc' });
  }

  const { data, count, error } = await query
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    page,
    limit,
    pages: Math.ceil((count || 0) / limit)
  };
}
```

**Savings:** 95% reduction in data transfer for list endpoints

---

### 6. Route-Based Code Splitting

**File: src/routes/index.tsx**

```typescript
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Lazy load heavy routes
const ArtistStudioPage = lazy(() => import('./ArtistStudioPage'));
const PdfReader = lazy(() => import('../components/collection/PdfReader'));
const AdminPanel = lazy(() => import('./AdminRoute'));

export const routes = [
  {
    path: '/studio',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ArtistStudioPage />
      </Suspense>
    )
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <AdminPanel />
      </Suspense>
    )
  }
];
```

**Savings:** ~150 KB reduction in initial bundle

---

## Database Optimizations (1 Week)

### 7. Add Missing Constraints

**File: SUPABASE_SCHEMA.sql** (Add to migration)

```sql
-- Prevent duplicate artists per wallet
ALTER TABLE artists ADD CONSTRAINT unique_artist_wallet UNIQUE (wallet);

-- Ensure orders have either drop or product
ALTER TABLE orders ADD CONSTRAINT check_drop_or_product 
  CHECK ((drop_id IS NOT NULL AND product_id IS NULL) 
    OR (drop_id IS NULL AND product_id IS NOT NULL));

-- Prevent negative prices
ALTER TABLE drops ADD CONSTRAINT check_price_positive CHECK (price_eth > 0);
ALTER TABLE products ADD CONSTRAINT check_product_price_positive CHECK (price_eth > 0);

-- Prevent duplicate subscriptions
ALTER TABLE subscriptions ADD CONSTRAINT unique_subscription 
  UNIQUE (artist_id, subscriber_wallet);
```

---

### 8. Query Performance Tuning

Add EXPLAIN ANALYZE to slow queries:

```sql
-- Check if index is used
EXPLAIN ANALYZE
SELECT * FROM drops 
WHERE artist_id = '1234' AND status = 'live'
ORDER BY created_at DESC;

-- Check for N+1 patterns
EXPLAIN ANALYZE
SELECT * FROM orders 
WHERE buyer_wallet = '0x123'
ORDER BY created_at DESC LIMIT 20;
```

---

## Security Hardening (2-3 Days)

### 9. Input Validation on All Endpoints

```javascript
// server/index.js
app.post('/api/drops', authRequired, async (req, res) => {
  try {
    // Validate input
    const validated = dropCreateSchema.parse(req.body);
    
    // Verify authorization
    if (!isArtist(req.wallet, validated.artist_id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Execute
    const result = await supabase.from('drops').insert(validated).select();
    res.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ error: 'Server error' });
  }
});
```

---

## Monitoring & Observability (2-3 Days)

### 10. Add Structured Logging

**File: server/utils/logger.js** (Create new)

```javascript
export class Logger {
  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const log = JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
    
    if (level === 'error') {
      console.error(log);
    } else {
      console.log(log);
    }
  }

  info(message, meta) { this.log('info', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
  error(message, meta) { this.log('error', message, meta); }
  debug(message, meta) { this.log('debug', message, meta); }
}

export const logger = new Logger();
```

---

## Implementation Priority

### Phase 1: Critical Security (Week 1)
1. ✅ CSRF Protection - 4 hours
2. ✅ Remove Sensitive Logs - 1 hour
3. ✅ Error Boundaries - 2 hours
4. ✅ Input Validation - 2 hours
5. Deploy & test - 4 hours

**Total: 13 hours**

### Phase 2: Performance (Week 2-3)
1. Eliminate N+1 queries - 3 days
2. Add pagination - 2 days
3. Route lazy loading - 1 day
4. Query optimization - 2 days

**Total: 8 days**

### Phase 3: Code Quality (Week 4-6)
1. Enable TypeScript strict
2. Module refactoring
3. Add comprehensive tests
4. API documentation

**Total: 10-14 days**

---

## Success Metrics

| Metric | Before | After | Owner |
|--------|--------|-------|-------|
| Bundle Size | 600 KB | 350 KB | Frontend |
| LCP | 3.2s | <2.5s | Frontend |
| API Latency | 500ms | <200ms | Backend |
| Security Issues | 5 CRITICAL | 0 | All |
| Type Safety | 250 'any' | 0 'any' | All |
| Test Coverage | <10% | >80% | All |

---

## Checklist for You

- [ ] Review this audit report
- [ ] Prioritize fixes (likely: CSRF → N+1 → Refactoring)
- [ ] Create jira/issues for each fix
- [ ] Assign owners (backend/frontend)
- [ ] Weekly sync on progress
- [ ] Deploy Phase 1 by end of week
- [ ] Deploy Phase 2 by end of week 3
- [ ] Full deployment after Phase 3

---

**Next Steps:**
1. Create git branches for each optimization
2. Implement Phase 1 security fixes immediately
3. Set up monitoring/alerting
4. Run security audit on Phase 1 deployment
5. Plan Phase 2 with team

