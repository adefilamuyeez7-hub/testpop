# Campaign UI Audit Report
**Status:** CRITICAL - Campaign features missing from UI despite backend implementation  
**Generated:** 2026-04-04

---

## Executive Summary

The backend has **full campaign investment API implementation** but **ZERO campaign UI exists** in the frontend. Artists cannot submit campaigns, and investors cannot bid/invest despite all database tables, API endpoints, and business logic being ready.

### Gap Analysis
| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Campaign creation | ✅ Implemented | ❌ No UI | MISSING |
| Campaign listing | ✅ Implemented | ⚠️ Partial | INCOMPLETE |
| Campaign detail view | ✅ Implemented | ❌ No UI | MISSING |
| Investment submission | ✅ Implemented | ❌ No UI | MISSING |
| Investment form | ✅ Implemented | ❌ No UI | MISSING |
| Campaign management | ✅ Implemented | ⚠️ Partial | INCOMPLETE |

---

## Backend Implementation (READY)

### API Endpoints
- ✅ `GET /ip-campaigns` - List all campaigns (with visibility/status filtering)
- ✅ `POST /ip-campaigns` - Create new campaign (artist only, approval workflow)
- ✅ `PATCH /ip-campaigns/:id` - Update campaign (admin review workflow)
- ✅ `GET /ip-investments` - List investments
- ✅ `POST /ip-investments` - Submit investment/bid (fully implemented)
- ✅ `GET /royalty-distributions` - Investor payouts

### Database Schema (COMPLETE)

**ip_campaigns table (25+ fields)**
```sql
- id, artist_id, slug, title, summary, description
- campaign_type, rights_type, visibility, status
- funding_target_eth, minimum_raise_eth, unit_price_eth, total_units
- units_sold, opens_at, closes_at
- legal_doc_uri, cover_image_uri
- metadata (JSON: committed_amount_eth, review_status, etc.)
- created_at, updated_at
```

**ip_investments table**
```sql
- id, campaign_id, investor_wallet
- amount_eth, units_purchased, status
- metadata, created_at, updated_at
```

**royalty_distributions table**
```sql
- id, campaign_id, investor_wallet
- distribution_amount_eth, status
- created_at, updated_at
```

### Campaign Status Workflow
```
draft → review → active → funded → settled → closed
```

### Visibility Levels
- `private` - Only artist can see
- `listed` - Public, discoverable
- `unlisted` - Public, requires direct link

---

## Frontend Implementation (CRITICAL GAPS)

### Existing Components (Partial)

#### 1. **CreateCampaignDialog.tsx**
- ✅ Exists but incomplete
- ✅ Has form for POAP campaigns (not IP campaigns)
- ❌ Not integrated into any page
- ❌ Focuses on reward allocation percentages (subscriber/bidder/creator splits)
- ❌ No IP investment/funding fields

#### 2. **CampaignActionPanel.tsx** 
- ✅ Exists but incomplete
- ✅ Handles campaign submission content (for content campaigns)
- ✅ Has bid/entry purchase flow
- ❌ Not integrated into campaign detail page
- ❌ No IP investment interface

#### 3. **CampaignManagementPanel.tsx**
- ✅ Exists but incomplete
- ✅ Reviews campaign submissions (artist-side)
- ❌ Not integrated into any artist dashboard
- ❌ No campaign list rendering

### Completely Missing UI

#### 1. **Campaign Listing Page** ❌
- No page to browse/filter campaigns
- No campaign cards/grid view
- Missing from navigation
- How investors discover opportunities: **NOT POSSIBLE**

#### 2. **Campaign Detail Page** ❌
- No `/campaign/:id` route
- No campaign info display (title, description, funding goals)
- No progress bar (units sold / target)
- No investment form
- No timeline display (opens/closes dates)

#### 3. **Campaign Investment Form** ❌
- No form component for submitting investment
- No ETH amount input
- No units calculation
- No transaction submission
- How investors bid: **NOT POSSIBLE**

#### 4. **Campaign Creation Flow** ❌
- No artist dashboard to create campaigns
- No form for campaign details
- No legal document upload
- No funding target/unit configuration
- How artists submit campaigns: **NOT POSSIBLE**

#### 5. **Campaign Management Dashboard** ❌
- No artist view of their campaigns
- No campaign status tracking
- No investor list for campaign
- No royalty distribution view

#### 6. **Routes/Navigation** ❌
Routes:
```
- /campaigns                      ❌ MISSING - List campaigns
- /campaigns/:id                  ❌ MISSING - Campaign detail
- /campaigns/create               ❌ MISSING - Create campaign
- /studio/campaigns               ❌ MISSING - Artist dashboard
- /portfolio/investments          ❌ MISSING - Investor portfolio
```

Navigation:
- No "Campaigns" link in main nav
- No campaign discovery entry point
- Not mentioned in page sidebar

---

## Current Page Structure

### InvestPage.tsx
- **Current Purpose:** Marketplace for **products** (physical/digital goods)
- **What it shows:** Product listings with filters (category, price, popularity)
- **What it does:** Shopping cart → checkout → product purchase
- **Issue:** This is NOT campaign investment, it's e-commerce

### Missing Pages Needed
1. **CampaignsPage.tsx** - Campaign listing/discovery
2. **CampaignDetailPage.tsx** - Single campaign view + investment form
3. **CampaignCreationPage.tsx** - Artist creates new campaign
4. **ArtistCampaignsDashboard.tsx** - Artist manages funded campaigns
5. **InvestorPortfolioPage.tsx** - View investments and returns

---

## Development Priority

### Critical Path (MVP)

**Phase 1: Listing & Discovery**
- [ ] Create `CampaignsPage.tsx`
  - Fetch campaigns from `GET /ip-campaigns`
  - Display campaign cards (title, artist, progress, status)
  - Filter by visibility/status/artist
  - Link to detail page

- [ ] Update navigation to include "Campaigns" link
- [ ] Add `/campaigns` route

**Phase 2: Campaign Detail & Investment**
- [ ] Create `CampaignDetailPage.tsx`
  - Fetch campaign and investment data
  - Display full campaign info
  - Show progress (units sold, ETH raised, timeline)
  - Render investment form component

- [ ] Create `InvestmentForm.tsx` component
  - ETH amount input
  - Units calculation (amount_eth / unit_price_eth)
  - Submit to `POST /ip-investments`
  - Handle wallet connection
  - Display success/error messages

- [ ] Add `/campaigns/:id` route

**Phase 3: Artist Campaign Creation**
- [ ] Create `CampaignCreationPage.tsx`
  - Multi-step form for campaign setup
  - Fields: title, description, funding target, unit pricing, timeline
  - Legal document upload
   - Submit to `POST /ip-campaigns`
  
- [ ] Add `/campaigns/create` route
- [ ] Integrate into artist studio/dashboard

**Phase 4: Management & Portfolio**
- [ ] Create `ArtistCampaignsDashboard.tsx`
  - List artist's campaigns
  - Show investor list and commitments
  - Display royalty distributions
  - Campaign status controls (activate, close, settle)

- [ ] Create `InvestorPortfolioPage.tsx`
  - List investments made
  - Show returns/distributions
  - Campaign performance tracking

---

## Technical Implementation Details

### API Integration Points

**Campaign Listing**
```typescript
const { data: campaigns } = await supabase
  .from('ip_campaigns')
  .select('*')
  .in('visibility', ['listed', 'unlisted'])
  .eq('status', 'active');
```

**Submit Investment**
```typescript
const response = await fetch('/api/ip-investments', {
  method: 'POST',
  body: JSON.stringify({
    campaign_id: campaignId,
    amount_eth: parseFloat(investmentAmount),
  }),
  headers: {
    'Authorization': `Bearer ${apiToken}`
  }
});
```

**Create Campaign**
```typescript
const response = await fetch('/api/ip-campaigns', {
  method: 'POST',
  body: JSON.stringify({
    title, description, campaign_type, rights_type,
    funding_target_eth, unit_price_eth, total_units,
    opens_at, closes_at, legal_doc_uri, cover_image_uri
  }),
  headers: {
    'Authorization': `Bearer ${apiToken}`
  }
});
```

### Component Architecture

```
CampaignsPage                       (Listing)
├── CampaignCard[]
└── CampaignFilter

CampaignDetailPage                  (Detail)
├── CampaignHeader
├── CampaignInfo
├── ProgressBar
├── TimelineDisplay
└── InvestmentForm
    ├── AmountInput
    ├── UnitsCalculation
    └── SubmitButton

CampaignCreationPage                (Artist)
├── CampaignForm
│   ├── BasicInfoStep
│   ├── FundingStep
│   ├── TimingStep
│   └── LegalStep
└── ReviewStep

ArtistCampaignsDashboard            (Artist)
├── CampaignsList
└── CampaignDetail
    ├── InvestorList
    ├── RoyaltyView
    └── ControlPanel
```

---

## Hooks & Utilities Needed

### Custom Hooks
- `useIPCampaigns()` - Fetch campaigns listing
- `useIPCampaignDetail(campaignId)` - Fetch single campaign data
- `useSubmitInvestment()` - Investment submission with loading/error
- `useCreateCampaign()` - Campaign creation workflow
- `useInvestmentHistory()` - Investor's investments
- `useArtistCampaigns()` - Artist's campaigns

### Utilities
- `calculateUnitsFromEth(amount, unitPrice)` - Investment calculation
- `formatCampaignStatus(status)` - Status display text
- `isCampaignOpen(campaign)` - Check if accepting investments
- `getCampaignProgress(campaign)` - Units/funding progress

---

## Database Types & Interfaces

### IPCampaign
```typescript
interface IPCampaign {
  id: string;
  artist_id: string;
  title: string;
  description: string;
  funding_target_eth: number;
  unit_price_eth: number;
  total_units: number;
  units_sold: number;
  status: 'draft' | 'review' | 'active' | 'funded' | 'settled';
  visibility: 'private' | 'listed' | 'unlisted';
  opens_at: string | null;
  closes_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

### IPInvestment
```typescript
interface IPInvestment {
  id: string;
  campaign_id: string;
  investor_wallet: string;
  amount_eth: number;
  units_purchased: number;
  status: 'pending' | 'confirmed' | 'settled';
  created_at: string;
  updated_at: string;
}
```

---

## Current State Summary

| Component | Lines | Status | Notes |
|-----------|-------|--------|-------|
| **Backend** | | | |
| POST /ip-investments | ~100+ | ✅ COMPLETE | Fully validated, updates campaign units |
| GET /ip-campaigns | ~50 | ✅ COMPLETE | Visibility/status filtering |
| PATCH /ip-campaigns | ~50 | ✅ COMPLETE | Admin review workflow |
| Database schema | ~150 | ✅ COMPLETE | All tables + indexes |
| **Frontend** | | | |
| Campaign pages | N/A | ❌ ZERO | No listing, detail, or creation |
| Campaign components | ~400 | ⚠️ PARTIAL | Only POAP campaigns + submission form |
| Campaign routes | N/A | ❌ ZERO | No `/campaigns/*` routes |
| Campaign navigation | N/A | ❌ ZERO | No links to campaigns |
| Investment form | N/A | ❌ ZERO | Component completly missing |

---

## Blockers & Dependencies

### Before UI Can Be Built
1. ✅ Backend API endpoints complete
2. ✅ Database schema finalized
3. ✅ Authentication system ready (JWT + wallet)
4. ✅ Supabase client configured

### UI Implementation Can Begin Immediately
- No backend changes needed
- Database ready for reads/writes
- All API contracts defined

---

## Recommended Next Steps

1. **Immediate (Today)**
   - Create `CampaignsPage.tsx` with campaign listing
   - Create `CampaignDetailPage.tsx` with detail view
   - Add `/campaigns` and `/campaigns/:id` routes
   - Add campaign nav link

2. **Short-term (This week)**
   - Implement `InvestmentForm.tsx` component
   - Add investment submission flow
   - Test E2E campaign discovery → investment

3. **Medium-term**
   - Campaign creation UI for artists
   - Artist campaign dashboard
   - Investor portfolio view

4. **Long-term**
   - Campaign management workflows
   - Royalty distribution dashboard
   - Advanced filtering/search

---

## Files to Create/Modify

### New Files (Phase 1)
```
src/pages/
  ├── CampaignsPage.tsx          (Campaign listing)
  ├── CampaignDetailPage.tsx     (Campaign detail + invest)
  └── [future files]

src/components/
  ├── campaign/
  │   ├── CampaignCard.tsx       (Listing card)
  │   ├── CampaignHeader.tsx     (Detail header)
  │   ├── CampaignInfo.tsx       (Detail content)
  │   ├── ProgressBar.tsx        (Units/ETH progress)
  │   └── InvestmentForm.tsx     (Investment submission)
  └── [future files]

src/hooks/
  ├── useIPCampaigns.ts          (Campaign fetching)
  ├── useIPCampaignDetail.ts     (Detail fetching)
  ├── useSubmitInvestment.ts     (Investment submission)
  └── [future files]
```

### Modified Files
```
src/App.tsx                        (Add campaign routes)
src/components/appShellNav.ts     (Add campaign nav)
src/components/TopBar.tsx         (Add campaign link)
```

---

## Conclusion

**The infrastructure is completely ready.** The backend team has built a robust campaign investment system. However, **no user-facing UI exists yet**, making the entire feature invisible to users.

**The gap is purely frontend.** Artists cannot discover how to submit a campaign. Investors cannot find opportunities to invest. All the business logic and data handling is in place, waiting for UI to unlock it.

**Estimated effort:** 2-3 weeks for full implementation (discovery → detail → investment → management)
