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
  created_by: string
  created_at: string
}

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

export function categoryMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0]
}
