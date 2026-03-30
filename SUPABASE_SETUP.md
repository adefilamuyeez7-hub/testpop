# ⚡ Supabase Setup Guide

## 1️⃣ Create Supabase Account & Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up (use email or GitHub)
3. Create a new project:
   - **Project name**: `thepopup-fixed`
   - **Database password**: Create strong password (save it!)
   - **Region**: Pick closest to users (US recommended)
   - Click "Create new project" (wait ~2 min for initialization)

## 2️⃣ Get Your Credentials

After project loads:
1. Go to **Settings** → **API** (left sidebar)
2. Copy these values:
   - 📋 **Project URL** (looks like `https://XXX.supabase.co`)
   - 🔑 **anon public key** (long string starting with `eyJ...`)

## 3️⃣ Set Up Environment Variables

Create or update your `.env.local` file in project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Save the file.

## 4️⃣ Create Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy entire contents from `SUPABASE_SCHEMA.sql` in this repo
4. Paste into the SQL editor
5. Click **Run** (green button)
6. Wait for tables to be created ✅

## 5️⃣ Test Connection

Run this in your terminal:

```bash
npm run dev
```

The app should load without Supabase errors.

---

## 📊 Database Tables Created

| Table | Purpose | Rows |
|-------|---------|------|
| `artists` | Artist profiles | ~100 expected |
| `drops` | Art drops | ~500 expected |
| `products` | Products for sale | ~200 expected |
| `orders` | Purchase orders | Grows daily |
| `whitelist` | Approved artists | ~50 expected |
| `analytics` | Page views | Auto-purged after 90 days |

---

## 🔐 Security (RLS)

Row-Level Security is **enabled** on all tables:
- ✅ Artists see only their own data (with update permission)
- ✅ Buyers see only their own orders
- ✅ Sellers see orders for their products
- ✅ Public profiles visible to everyone
- ✅ Wallet required for modifications

---

## 🔄 Next Steps

After credentials are set:

1. **Install Supabase client** (already done)
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Update artistStore.ts** to use `src/lib/db.ts` instead of localStorage

3. **Migrate AdminPage.ts** (whitelist, products, orders)

4. **Update ArtistStudioPage.tsx** to save profiles to DB

5. **Test in local dev** before deploying to production

---

## 💾 Data Migration (Optional)

To migrate existing localStorage data to Supabase:

```typescript
// This is for reference - will create a migration script if needed
const localStorage_artists = JSON.parse(
  window.localStorage.getItem("popup_artist_profiles") || "[]"
);
const localStorage_drops = JSON.parse(
  window.localStorage.getItem("popup_artist_drops") || "[]"
);

// Bulk insert to Supabase (coming next)
```

---

## 🚀 Deployment to Production

When ready to deploy:

1. In Vercel dashboard, add env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Deploy:
   ```bash
   git add .
   git commit -m "feat: integrate Supabase for production database"
   git push origin master
   # Vercel auto-deploys
   ```

3. Verify in production domain that DB queries work

---

## 🆘 Troubleshooting

### "Missing Supabase environment variables"
→ Make sure `.env.local` has both variables and you ran `npm run dev` fresh

### "Table does not exist"
→ Run the SQL schema again in Supabase SQL Editor

### "Failed to fetch data"
→ Check that Supabase project is running (check dashboard status)

### "RLS policy violated"
→ Wallet auth not working - ensure wallet signature is logged

---

## 📞 Support

- Supabase docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

---

✅ **Once you provide credentials in `.env.local`, everything is ready to go!**
