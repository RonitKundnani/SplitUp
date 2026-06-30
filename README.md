# 💸 SplitUp

A Splitwise-style app for tracking and splitting shared expenses across people and
groups. Built as a full-stack web app with a cloud database, structured so the data
layer can be reused for a React Native mobile app later.

## Features

- **Auth** — email/password sign up & sign in (Supabase Auth).
- **Profiles & groups** — create groups (roommates, trips, projects).
- **Invite by link & approve requests** — share a `/join/<token>` link; opening it sends a *request* (no auto-join) that an existing member approves or declines.
- **Add & split expenses** — split equally across selected members or enter custom amounts; pick who paid, a category, and a date.
- **Balances & settle up** — net balance per person plus a greedy debt-simplification algorithm that suggests the fewest payments to clear everyone. Record settlements with one tap.
- **History & categories** — full expense history filterable by category.

## Tech stack

| Layer    | Choice                                            |
| -------- | ------------------------------------------------- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS       |
| Backend  | Supabase (Postgres, Auth, Row-Level Security)     |
| Routing  | React Router                                       |

There is no custom server — the React app talks to Supabase directly, and Postgres
Row-Level Security enforces that users only ever see groups they belong to.

## Getting started

### 1. Create a Supabase project

1. Sign up at [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project (the free tier is plenty).
2. Open the **SQL Editor**, paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it. This creates the tables, the auto-profile trigger, and all RLS policies.
3. (Optional, recommended for local testing) Under **Authentication → Providers → Email**, turn **off** "Confirm email" so you can sign in immediately without checking an inbox.

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local` with the values from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:5173. Until `.env.local` is set, the app shows a setup banner
instead of the login screen.

> **Note:** This project uses Vite 5 / React 18, pinned for Node 18 compatibility. Node 18+ is required.

## How to try it end-to-end

1. Sign up two accounts (e.g. in a normal window and an incognito window).
2. In account A, create a group, then add account B by its email.
3. Add a few expenses paid by different people, split equally or custom.
4. Open the **Balances** tab to see who owes whom, then **Settle up** to record a payment.

## Project structure

```
supabase/migrations/0001_init.sql   # schema + RLS (run this in Supabase)
src/
  lib/
    supabase.ts      # Supabase client
    types.ts         # shared types + expense categories
    balances.ts      # net-balance + debt-simplification + equal-split math
  context/AuthContext.tsx
  hooks/             # useGroups, useGroupData (data fetching)
  components/        # Modal, Avatar, Layout, the Add/Settle modals
  pages/             # Login, Signup, Dashboard, GroupDetail
```

## Roadmap to mobile

The reusable core lives in `src/lib/` (`supabase.ts`, `types.ts`, `balances.ts`) and the
hooks. The `@supabase/supabase-js` client works as-is in React Native / Expo, so a mobile
app can share the schema, types, and balance logic and only re-implement the UI layer.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server                 |
| `npm run build`   | Typecheck + production build         |
| `npm run preview` | Preview the production build         |
| `npm run lint`    | Typecheck only (`tsc --noEmit`)      |
