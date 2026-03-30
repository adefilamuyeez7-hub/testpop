# 🚀 Deploy Supabase Schema (REQUIRED)

**Status:** ⚠️ INCOMPLETE - Database schema not deployed to Supabase

Your app has the migration file ready, but the tables haven't been created in your Supabase project yet.

---

## ✅ What You Need to Do

### Step 1: Get Supabase Credentials

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (or create one if needed)
3. Go to **Settings** → **API** (left sidebar)
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

### Step 2: Create `.env.local`

In your project root, create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-here.supabase.co
VITE_SUPABASE_ANON_KEY=paste-your-anon-key-here
```

**⚠️ Important:** Replace the values with your actual credentials from Step 1.

### Step 3: Run the Migration

Choose ONE method:

#### Method A: Using Supabase Dashboard (Easiest)

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **+ New query**
3. Copy the entire contents of this file:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
4. Paste it into the SQL editor in Supabase
5. Click **Run** button (top right)
6. ✅ Wait for "Success!" message

#### Method B: Using Supabase CLI (If You Have It Installed)

```bash
# Make sure you have .env.local configured first

# Link project
supabase link --project-ref your-project-ref

# Run migrations
supabase migration up

# Or push all changes
supabase db push
```

#### Method C: Copy-Paste SQL (Recommended for First Time)

1. Open [SUPABASE_SCHEMA.sql](./SUPABASE_SCHEMA.sql) in your project
2. Copy ALL content
3. Go to Supabase Dashboard → SQL Editor
4. Create New query
5. Paste the SQL
6. Click Run

---

## 🧪 Verify Deployment

After running the migration, test it:

### Test 1: In Browser Console

1. Restart dev server: `npm run dev`
2. Open DevTools (F12)
3. Go to Console tab
4. Run:
   ```javascript
   window.checkSupabase()
   ```
5. Should see: ✅ `Connected to Supabase successfully`

### Test 2: In Supabase Dashboard

1. Go to **SQL Editor**
2. Create new query:
   ```sql
   SELECT * FROM artists LIMIT 5;
   ```
3. Should run without errors

### Test 3: Check Tables Exist

In SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should show:
- ✅ artists
- ✅ drops
- ✅ products
- ✅ orders
- ✅ campaigns

---

## 🐛 Troubleshooting

### ❌ "Error: relation does not exist"
- **Problem:** Tables weren't created
- **Fix:** Run the SQL migration again (Method A or C above)

### ❌ "401 Unauthorized" after running
- **Problem:** Invalid credentials in `.env.local`
- **Fix:** Double-check `VITE_SUPABASE_ANON_KEY` is correct

### ❌ "CORS error" in console
- **Problem:** RLS policy issue
- **Fix:** Re-run the migration to fix policies

### ❌ Migration file not found
- **Problem:** Looking in wrong folder
- **Fix:** File is at: `supabase/migrations/001_initial_schema.sql`

---

## 📋 What Gets Created

Running the migration creates:

| Table | Purpose |
|-------|---------|
| `artists` | Artist profiles with wallet, bio, social links |
| `drops` | Art drops created by artists |
| `products` | Products for sale (physical/digital) |
| `orders` | Customer purchase orders |
| `campaigns` | POAP campaign data |

Plus:
- ✅ All necessary indexes (for fast queries)
- ✅ Row Level Security (RLS) policies
- ✅ Foreign key relationships
- ✅ Auto-update triggers for `updated_at`

---

## ⏱️ Expected Timeline

- Create migration: ✅ Done
- Get Supabase credentials: 5 min
- Run SQL migration: 2-3 min
- Verify in console: 1 min
- **Total:** ~10 minutes

---

## 📚 Next Steps After Deployment

1. **Test the API:**
   ```bash
   npm run test -- src/test/supabase-api.test.ts
   ```

2. **Check Network Tab:**
   - Open DevTools → Network Tab
   - Look for requests to `*.supabase.co/rest/v1/*`

3. **Create Sample Data:**
   - Open browser console
   - Save a test artist profile
   - Create a test product

4. **Monitor in Supabase:**
   - Go to Supabase Dashboard
   - View Table Editor
   - See your created data in real-time

---

## ⚡ Quick Ref: Full Setup Checklist

- [ ] Created Supabase account/project
- [ ] Copied credentials to `.env.local`
- [ ] Restarted dev server
- [ ] Ran SQL migration in Supabase
- [ ] Verified tables exist (✅ in SQL Editor)
- [ ] Tested `window.checkSupabase()` (✅ should pass)
- [ ] Restarted dev server again
- [ ] App loads without Supabase errors

---

**Having issues?** The migration file is at `supabase/migrations/001_initial_schema.sql` - copy & paste it into Supabase SQL Editor and click Run!
