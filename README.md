# TradeJournal (React + Supabase-ready)

This app now supports a cloud database via Supabase with localStorage fallback.

## 1. Install

```powershell
cd C:\Users\Dip\Documents\Playground
npm install
```

## 2. Database Setup (Supabase)

1. Create a Supabase project.
2. Open SQL Editor and run:

`database/supabase_schema.sql`

3. Copy env template:

```powershell
Copy-Item .env.example .env
```

4. Set your values in `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If env vars are empty, app continues using localStorage.

## 3. Run

```powershell
npm run dev
```

## 4. Build

```powershell
npm run build
npm run preview
```

## 5. Deploy (Vercel preview)

```powershell
vercel deploy . -y
```

Add the same env vars in Vercel Project Settings -> Environment Variables.
