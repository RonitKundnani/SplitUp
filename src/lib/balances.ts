import type { Expense, Settlement } from './types'

export interface Debt {
  from: string // profile id who pays
  to: string // profile id who receives
  amount: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Net balance per profile id.
 *   positive  -> the group owes this person (they are owed money)
 *   negative  -> this person owes the group
 *
 * For each expense the payer is credited the full amount and every person in
 * the split is debited their share. Settlements move money directly: the payer
 * (from) reduces what they owe, the receiver (to) reduces what they are owed.
 */
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
    // from paid to -> from's debt shrinks (balance up), to's credit shrinks.
    add(s.from_profile, Number(s.amount))
    add(s.to_profile, -Number(s.amount))
  }

  return net
}

/**
 * Greedy debt simplification (min cash flow). Repeatedly matches the biggest
 * creditor with the biggest debtor until everyone is settled. Produces at most
 * n-1 transactions for n people.
 */
export function simplifyDebts(net: Record<string, number>): Debt[] {
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const [id, balance] of Object.entries(net)) {
    if (balance > 0.009) creditors.push({ id, amount: balance })
    else if (balance < -0.009) debtors.push({ id, amount: -balance })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const debts: Debt[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].amount, creditors[j].amount))
    if (pay > 0) {
      debts.push({ from: debtors[i].id, to: creditors[j].id, amount: pay })
    }
    debtors[i].amount = round2(debtors[i].amount - pay)
    creditors[j].amount = round2(creditors[j].amount - pay)
    if (debtors[i].amount <= 0.009) i++
    if (creditors[j].amount <= 0.009) j++
  }

  return debts
}

/**
 * Split a total equally across n people in cents so the parts always sum back
 * to the exact total (the first few people absorb the rounding remainder).
 */
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

/**
 * Split a total by percentage. Percentages are expected to sum to ~100; any
 * rounding remainder (in cents) is given to the largest share so the parts
 * always add back up to the exact total.
 */
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

  // Hand the leftover (positive or negative) to the biggest share.
  const diff = totalCents - allocated
  if (diff !== 0) {
    const biggest = ids.reduce((a, b) => (result[a] >= result[b] ? a : b))
    result[biggest] += diff
  }

  for (const id of ids) result[id] = result[id] / 100
  return result
}

// Locale per currency so digit grouping looks right (e.g. ₹1,00,000 for INR).
const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  AED: 'en-AE',
  AUD: 'en-AU',
  CAD: 'en-CA',
  JPY: 'ja-JP',
  SGD: 'en-SG',
}

export function formatMoney(amount: number, currency = 'INR'): string {
  const locale = LOCALE_BY_CURRENCY[currency] ?? 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}
