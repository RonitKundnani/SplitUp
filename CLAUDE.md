# SplitUp — Mobile App (iOS & Android)

You are building the **React Native / Expo mobile app** for SplitUp — a Splitwise-style shared
expense tracker. The cloud backend (Supabase) is **fully built and live**. You are only building
the mobile UI. Do not touch the database schema or RLS policies.

---

## 1. Existing backend

**Supabase project:** `https://ltxsxpbwtehvaecsxjhl.supabase.co`

The user will give you the publishable key to put in `.env`. It starts with `sb_publishable_`.

### Tables (already exist — do not recreate)

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user, auto-created by a DB trigger on signup |
| `groups` | Expense groups. `type`: `'group'` (multi-person) or `'personal'` (1-on-1 friend). Has `currency` (e.g. `'INR'`). |
| `group_members` | Many-to-many: which profiles are in which group |
| `expenses` | An expense in a group. `paid_by` + `created_by` are profile ids. |
| `expense_splits` | How much each member owes for a given expense |
| `settlements` | A recorded payment from `from_profile` to `to_profile` |
| `group_invites` | Shareable tokens for invite links (`/join/<token>`) |
| `join_requests` | Pending requests to join a group (status: pending/approved/rejected) |
| `recurring_expenses` | Templates that auto-generate expenses on a schedule |

### Supabase RPCs (already exist — call as-is)

```ts
// Returns group info from a token — use on the invite deep-link screen.
supabase.rpc('resolve_invite', { invite_token: token })

// Atomically add the requester to the group + mark request approved.
// Only callable by an existing group member.
supabase.rpc('approve_join_request', { request_id: id })
```

---

## 2. Tech stack to use

| Layer | Choice |
|---|---|
| Framework | **Expo SDK 51+** with Expo Router (file-based routing) |
| Language | **TypeScript** |
| Styling | **NativeWind v4** (Tailwind for React Native) |
| Backend | **@supabase/supabase-js** v2 |
| Auth | Supabase Auth — email + password (no magic links, no OAuth needed) |
| Navigation | Expo Router tabs + stack (no React Navigation manually) |
| State | React hooks + context (same pattern as web app — no Redux/Zustand) |
| Storage | `expo-secure-store` for Supabase session persistence |
| Deep links | Expo's deep linking for invite links (`splitup://join/<token>`) |

Do **not** use Expo Go's managed workflow for native modules — use the **development build** workflow (`npx expo run:ios` / `npx expo run:android`) so SecureStore and deep links work properly.

---

## 3. Environment setup

Create `.env` in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://ltxsxpbwtehvaecsxjhl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_XXXX
```

Note: Expo uses `EXPO_PUBLIC_` prefix (not `VITE_`).

---

## 4. Copy these lib files verbatim

These three files are **100% reusable** from the web app — pure TypeScript, no DOM APIs, no
React web dependencies. Create them at `src/lib/` and **do not modify them**.

### `src/lib/types.ts`

```ts
export interface Profile {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface Group {
  id: string
  name: string
  emoji: string
  currency: string
  type: 'group' | 'personal'
  created_by: string
  created_at: string
}

export const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
] as const

export interface GroupMember {
  group_id: string
  profile_id: string
  joined_at: string
  profile?: Profile
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  profile_id: string
  amount: number
}

export interface Expense {
  id: string
  group_id: string
  description: string
  amount: number
  category: string
  paid_by: string
  created_by: string
  spent_at: string
  created_at: string
  splits?: ExpenseSplit[]
}

export interface Settlement {
  id: string
  group_id: string
  from_profile: string
  to_profile: string
  amount: number
  created_at: string
}

export interface JoinRequest {
  id: string
  group_id: string
  profile_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profile?: Profile
}

export type SplitMode = 'equal' | 'full' | 'percent' | 'custom'

export interface SplitData {
  involved?: string[]
  fullPayer?: string
  percentMap?: Record<string, number>
  customMap?: Record<string, number>
}

export interface RecurringExpense {
  id: string
  group_id: string
  description: string
  amount: number
  category: string
  paid_by: string
  split_mode: SplitMode
  split_data: SplitData
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  next_due_at: string
  created_by: string
  created_at: string
  active: boolean
}

export type ActivityType = 'expense_added' | 'settlement' | 'member_joined'

export interface ActivityItem {
  id: string
  type: ActivityType
  group_id: string
  group_name: string
  group_emoji: string
  actor_name: string
  actor_id: string
  description: string
  amount?: number
  currency?: string
  created_at: string
}

export const CATEGORIES = [
  { key: 'general', label: 'General', emoji: '🧾' },
  { key: 'food', label: 'Food & Drink', emoji: '🍔' },
  { key: 'groceries', label: 'Groceries', emoji: '🛒' },
  { key: 'rent', label: 'Rent & Utilities', emoji: '🏠' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'transport', label: 'Transport', emoji: '🚕' },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
] as const

export const FREQUENCIES = [
  { key: 'daily',   label: 'Every day' },
  { key: 'weekly',  label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
  { key: 'yearly',  label: 'Every year' },
] as const

export function categoryMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0]
}

export function nextDueDate(frequency: RecurringExpense['frequency'], from: Date = new Date()): string {
  const d = new Date(from)
  switch (frequency) {
    case 'daily':   d.setDate(d.getDate() + 1); break
    case 'weekly':  d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().slice(0, 10)
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}
```

### `src/lib/balances.ts`

```ts
import type { Expense, Settlement } from './types'

export interface Debt {
  from: string
  to: string
  amount: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeNetBalances(
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const net: Record<string, number> = {}
  const add = (id: string, delta: number) => {
    net[id] = round2((net[id] ?? 0) + delta)
  }
  for (const e of expenses) {
    add(e.paid_by, Number(e.amount))
    for (const s of e.splits ?? []) {
      add(s.profile_id, -Number(s.amount))
    }
  }
  for (const s of settlements) {
    add(s.from_profile, Number(s.amount))
    add(s.to_profile, -Number(s.amount))
  }
  return net
}

export function simplifyDebts(net: Record<string, number>): Debt[] {
  const creditors: { id: string; amount: number }[] = []
  const debtors:   { id: string; amount: number }[] = []
  for (const [id, balance] of Object.entries(net)) {
    if (balance > 0.009)  creditors.push({ id, amount: balance })
    else if (balance < -0.009) debtors.push({ id, amount: -balance })
  }
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)
  const debts: Debt[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].amount, creditors[j].amount))
    if (pay > 0) debts.push({ from: debtors[i].id, to: creditors[j].id, amount: pay })
    debtors[i].amount   = round2(debtors[i].amount   - pay)
    creditors[j].amount = round2(creditors[j].amount - pay)
    if (debtors[i].amount   <= 0.009) i++
    if (creditors[j].amount <= 0.009) j++
  }
  return debts
}

export function splitEqually(total: number, memberIds: string[]): Record<string, number> {
  const n = memberIds.length
  const result: Record<string, number> = {}
  if (n === 0) return result
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / n)
  let remainder = totalCents - base * n
  for (const id of memberIds) {
    const cents = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--
    result[id] = cents / 100
  }
  return result
}

export function splitByPercent(
  total: number,
  percentById: Record<string, number>,
): Record<string, number> {
  const ids = Object.keys(percentById).filter((id) => (percentById[id] ?? 0) > 0)
  const result: Record<string, number> = {}
  if (ids.length === 0) return result
  const totalCents = Math.round(total * 100)
  let allocated = 0
  for (const id of ids) {
    const cents = Math.round((totalCents * percentById[id]) / 100)
    result[id] = cents
    allocated += cents
  }
  const diff = totalCents - allocated
  if (diff !== 0) {
    const biggest = ids.reduce((a, b) => (result[a] >= result[b] ? a : b))
    result[biggest] += diff
  }
  for (const id of ids) result[id] = result[id] / 100
  return result
}

const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: 'en-IN', USD: 'en-US', EUR: 'en-IE', GBP: 'en-GB',
  AED: 'en-AE', AUD: 'en-AU', CAD: 'en-CA', JPY: 'ja-JP', SGD: 'en-SG',
}

export function formatMoney(amount: number, currency = 'INR'): string {
  const locale = LOCALE_BY_CURRENCY[currency] ?? 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}
```

### `src/lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const url  = process.env.EXPO_PUBLIC_SUPABASE_URL!
const key  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Persist the Supabase session in the device's secure keychain.
const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(url, key, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // must be false in React Native
  },
})
```

---

## 5. Screen map

Build these screens using **Expo Router** file-based routing:

```
app/
  _layout.tsx              ← Root layout, AuthProvider, session check
  (auth)/
    login.tsx              ← Email + password login
    signup.tsx             ← Email + password signup
  (app)/
    _layout.tsx            ← Bottom tab navigator (Groups | Friends | Activity | Profile)
    index.tsx              ← Groups tab — list of type='group' groups
    friends.tsx            ← Friends tab — list of type='personal' groups
    activity.tsx           ← Activity feed (recent expenses + settlements)
    profile.tsx            ← Current user info + sign out
  groups/
    [id].tsx               ← Group detail (4 tabs: Expenses | Balances | Insights | Recurring)
  join/
    [token].tsx            ← Invite deep-link handler
```

---

## 6. Feature checklist

Implement **every** feature the web app has. Do not skip any:

### Auth
- [ ] Email + password signup (collects full name, stored in `profiles.full_name`)
- [ ] Email + password login
- [ ] Session persisted via `expo-secure-store`
- [ ] Sign out
- [ ] After login/signup, redirect to the invite screen if arrived via deep link

### Dashboard (bottom tabs)
- [ ] **Groups tab** — lists `type='group'` groups, "New group" button
- [ ] **Friends tab** — lists `type='personal'` groups, "Add friend" button
- [ ] **Activity tab** — recent expenses + settlements across all groups
- [ ] **Profile tab** — name, email, sign out

### Create group
- [ ] Name, emoji picker (10 options), currency selector (9 currencies, default INR)
- [ ] Creator is automatically added as first member

### Add friend (personal group)
- [ ] Search by email → find profile → create `type='personal'` group → add both members

### Group / Friend detail (tabs)
**Expenses tab**
- [ ] Category filter chips (horizontal scroll)
- [ ] Expense list: description, payer, date, your share
- [ ] Edit ✏️ button on expenses you created — opens edit sheet
- [ ] Delete in edit sheet (confirm step, creator only)

**Balances tab**
- [ ] Net balance per member (colour coded green/red)
- [ ] Suggested payments list (debt simplification algorithm from `balances.ts`)
- [ ] "Mark paid" on each suggested payment → records a settlement

**Insights tab**
- [ ] 3 stat cards: Total spent · Your share · # Expenses
- [ ] Monthly bar chart (last 6 months, CSS-equivalent using View heights)
- [ ] Category horizontal bar chart (top 6 categories)

**Recurring tab**
- [ ] List active recurring expenses with next due date
- [ ] Pause / Resume / Delete each one
- [ ] Add recurring expense: all 4 split modes, frequency picker
- [ ] **On screen focus**, auto-fire any overdue recurring expenses (same logic as web):
  fire once, advance `next_due_at` past today using `nextDueDate()` in a while-loop

### Add expense (bottom sheet / modal)
All 4 split modes with live previews:
- [ ] **Equally** — checkboxes per member, shows per-person amount
- [ ] **One owes all** — radio to pick who bears the full cost
- [ ] **By %** — number input per member, live sum validation (must = 100%)
- [ ] **Custom amounts** — number input per member, live sum vs total validation
- [ ] Paid by selector, category picker, date picker

### Invite system
- [ ] "Invite" button in group header (groups only, not personal)
- [ ] Shows shareable deep link: `splitup://join/<token>` (generate/fetch token)
- [ ] Copy to clipboard / native share sheet
- [ ] Pending requests list with Approve / Decline
- [ ] Red badge on invite button showing pending count
- [ ] `join/[token].tsx` screen: shows group info, "Request to join" button
  - handles: not-yet-member, already-member, already-requested, request sent

### Leave group
- [ ] Button at bottom of group detail
- [ ] Blocked with an error message if `|balance| > 0.01` (must settle first)
- [ ] On confirm → delete from `group_members` → navigate back

---

## 7. Key implementation notes

### Supabase embed disambiguation
`join_requests` has two FKs to `profiles` (`profile_id` and `decided_by`). Always use the
explicit hint when embedding:
```ts
.select('*, profile:profiles!profile_id(*)')
```

### Session-aware Supabase client
Wrap the app in an `AuthProvider` (same pattern as the web app). Use
`supabase.auth.onAuthStateChange` to keep the session in React context.

### Recurring fire guard
Use a `useRef` flag (reset on groupId change) to ensure `fireOverdue()` runs **once per
screen focus**, not on every re-render. The web app has this bug fix already.

### formatMoney
`Intl.NumberFormat` works in React Native's Hermes engine (v0.68+). Use `formatMoney()` from
`balances.ts` directly — no library needed.

### Deep links
Configure `app.json`:
```json
{
  "expo": {
    "scheme": "splitup",
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [{ "scheme": "splitup", "host": "join" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```
The invite link from the web app is `https://yourapp.vercel.app/join/<token>`. For the
mobile app, use the `splitup://join/<token>` scheme. Both share the same token from
`group_invites.token`.

### iOS / Android build
After initial setup run:
```bash
npx expo run:ios     # requires Xcode + simulator
npx expo run:android # requires Android Studio + emulator
```
Do not use `expo start` with Expo Go for testing — `expo-secure-store` is not available in
Expo Go.

---

## 8. Shared data hooks

Rewrite these hooks from the web app using **identical Supabase queries** — only the
React Native-compatible return values differ (no JSX, just data):

| Web hook | Mobile equivalent |
|---|---|
| `useGroups` | `useGroups` — same queries, same `createGroup`/`createPersonalGroup` logic |
| `useGroupData` | `useGroupData` — fetches group + members + expenses + settlements + requests |
| `useRecurring` | `useRecurring` — same fire logic, same `addRecurring`/`toggleActive`/`deleteRecurring` |
| `useActivity` | `useActivity` — same two-query merge (expenses + settlements), same sort |

---

## 9. Project owner

**GitHub:** RonitKundnani
**Supabase project ref:** `ltxsxpbwtehvaecsxjhl`
**Web app repo:** `github.com/RonitKundnani/SplitUp`

The mobile app should be a **separate Expo project** in a new repo (e.g. `SplitUp-Mobile`).
It shares the same Supabase backend — no schema changes needed.
