# Vercel Deployment - Environment Variables Setup
**Date**: April 15, 2026  
**Status**: ✅ Code pushed, ⏳ Awaiting Vercel env configuration

---

## 📋 SUMMARY OF CHANGES

✅ **Committed to GitHub**:
- Updated Supabase credentials in `.env.local.example` files
- Regenerated validation schemas (15 comprehensive schemas)
- Regenerated database migration (15 tables + RLS policies)
- Extracted auth module to `server/routes/auth.js`
- Wired input validation to critical endpoints
- Commit: `feat: Update Supabase credentials, regenerate schemas, extract auth module`

✅ **Online**: 
- Push to `main` branch completed
- Vercel should auto-detect changes (if connected)

⏳ **Next**: Set environment variables in Vercel dashboard

---

## 🚀 VERCEL ENVIRONMENT SETUP (REQUIRED)

### Step 1: Login to Vercel Dashboard
```
https://vercel.com/dashboard
```

### Step 2: Select Your Project
- Project name: `testpop` (or your Vercel project name)
- Click → Settings → Environment Variables

### Step 3: Add NEW Supabase Credentials

#### Frontend Variables (Accessible to Browser)
```
VITE_SUPABASE_URL=https://hdqgpqjpmzkipvfxtsku.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BC7i4frQriqD2UpaKVSDvQ_n0DmPj3m
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcWdwcWpwbXpraXB2Znh0c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzIxMTAsImV4cCI6MjA5MTgwODExMH0.Hx9OyP19U8hzIrHAj5qLo8AW9CFTCLg6R1zgI1UkfRc
```

**Environments**: Select both `Production` and `Preview`

#### Backend Variables (Server-Only, Not Visible to Browser)
```
SUPABASE_URL=https://hdqgpqjpmzkipvfxtsku.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcWdwcWpwbXpraXB2Znh0c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzIxMTAsImV4cCI6MjA5MTgwODExMH0.Hx9OyP19U8hzIrHAj5qLo8AW9CFTCLg6R1zgI1UkfRc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcWdwcWpwbXpraXB2Znh0c2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIzMjExMCwiZXhwIjoyMDkxODA4MTEwfQ.EPVYvx4yqHjMbFC_QL0Vm_KeNViTe8f60BGelGLSbxQ
```

**Environments**: Select `Production` only (sensitive!)

### Step 4: Verify All Required Variables

**Complete List for Reference**:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY
VITE_FACTORY_ADDRESS
VITE_ARTIST_SHARES_ADDRESS
VITE_POAP_CAMPAIGN_ADDRESS
VITE_PRODUCT_STORE_ADDRESS
VITE_CREATIVE_RELEASE_ESCROW_ADDRESS
VITE_WALLETCONNECT_PROJECT_ID
VITE_WEB3AUTH_CLIENT_ID
VITE_ADMIN_WALLET
VITE_FOUNDER_WALLET
VITE_BASE_RPC_URL
VITE_BASE_SEPOLIA_RPC_URL
VITE_SECURE_API_BASE_URL
VITE_PINATA_API_BASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
APP_JWT_SECRET
PINATA_JWT
PINATA_API_KEY
PINATA_API_SECRET
ADMIN_WALLETS
FRONTEND_ORIGIN
NODE_ENV
BASE_SEPOLIA_RPC_URL
```

### Step 5: Remove OLD Credentials

In Vercel Dashboard → Settings → Environment Variables → scroll down

**DELETE old Supabase variables**:
- ❌ Remove any with old `supabase.co` URLs (if different from `hdqgpqjpmzkipvfxtsku`)
- ❌ Remove any old `SUPABASE_URL` values
- ❌ Remove old `SUPABASE_ANON_KEY` values

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] **Frontend variables added** (VITE_SUPABASE_*)
- [ ] **Backend variables added** (SUPABASE_URL, SUPABASE_*_KEY)
- [ ] **Old credentials removed** from Vercel
- [ ] **All 30+ env vars configured** 
- [ ] **Redeploy triggered** (Vercel → Deployments → Redeploy)
- [ ] **Test in browser**: Visit https://testpop-one.vercel.app (your Vercel domain)
- [ ] Verify no "Supabase connection failed" errors

---

## 🔍 VERIFICATION AFTER DEPLOYMENT

### 1. Check Frontend Loads
```
Browser → Your Vercel domain → Open DevTools Console
Should see NO: "Failed to initialize Supabase"
```

### 2. Check Auth Works
```
Click "Connect Wallet" 
Should reach Supabase (not connection error)
```

### 3. Check Backend API
```
Browser → Network tab → any POST request
Should see 200/201 responses (not 500)
```

### 4. Check Logs
```
Vercel Dashboard → Your Project → Functions → Logs
Look for "Starting server..." 
No "SUPABASE_URL not set" errors
```

---

## 🚨 COMMON ISSUES

### Issue: "Cannot read property 'from' of undefined"
**Cause**: Supabase not initialized  
**Fix**: Ensure `SUPABASE_URL` + `SUPABASE_ANON_KEY` set in Vercel env vars

### Issue: "401 Unauthorized" on API calls  
**Cause**: Wrong JWT secret or RLS policies blocking  
**Fix**: Check `APP_JWT_SECRET` is set, verify RLS policies in Supabase

### Issue: "CORS error in browser console"
**Cause**: `FRONTEND_ORIGIN` doesn't match your domain  
**Fix**: Update to your Vercel domain: `https://testpop-one.vercel.app`

### Issue: File uploads fail
**Cause**: `PINATA_JWT` not configured  
**Fix**: Add Pinata credentials to Vercel env vars

---

## 📞 NEXT STEPS

1. **Go to Vercel Dashboard Now**: https://vercel.com/dashboard
2. **Add environment variables** above (copy-paste from this file)
3. **Remove old credentials** (if any exist)
4. **Trigger redeploy**: Vercel → Deployments → Select latest → Redeploy
5. **Test in browser**: Visit your Vercel domain
6. **Check logs**: If errors, review Vercel function logs

---

## 📝 NEW SUPABASE CREDENTIALS REFERENCE

**Project URL**: 
```
https://hdqgpqjpmzkipvfxtsku.supabase.co
```

**Publishable Key** (safe for frontend):
```
sb_publishable_BC7i4frQriqD2UpaKVSDvQ_n0DmPj3m
```

**Anon Key** (use for API):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcWdwcWpwbXpraXB2Znh0c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzIxMTAsImV4cCI6MjA5MTgwODExMH0.Hx9OyP19U8hzIrHAj5qLo8AW9CFTCLg6R1zgI1UkfRc
```

**Service Role Key** (backend only - 🔐 KEEP SECRET 🔐):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcWdwcWpwbXpraXB2Znh0c2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIzMjExMCwiZXhwIjoyMDkxODA4MTEwfQ.EPVYvx4yqHjMbFC_QL0Vm_KeNViTe8f60BGelGLSbxQ
```

---

**⏰ Estimated time to complete**: 15 minutes
