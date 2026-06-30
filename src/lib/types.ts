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
  involved?: string[]          // equal
  fullPayer?: string           // full
  percentMap?: Record<string, number> // percent
  customMap?: Record<string, number>  // custom
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
