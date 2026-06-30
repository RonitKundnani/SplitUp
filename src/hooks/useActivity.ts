import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/balances'
import type { ActivityItem } from '../lib/types'

interface RawExpense {
  id: string
  description: string
  amount: number
  created_at: string
  group_id: string
  paid_by: string
  group: { id: string; name: string; emoji: string; currency: string } | null
  payer: { id: string; full_name: string; email: string } | null
}

interface RawSettlement {
  id: string
  amount: number
  created_at: string
  group_id: string
  from_profile: string
  to_profile: string
  group: { id: string; name: string; emoji: string; currency: string } | null
  from: { id: string; full_name: string; email: string } | null
  to_p: { id: string; full_name: string; email: string } | null
}

export function useActivity(currentUserId: string) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)

    const [expRes, setRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('id, description, amount, created_at, group_id, paid_by, group:groups(id,name,emoji,currency), payer:profiles!paid_by(id,full_name,email)')
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('settlements')
        .select('id, amount, created_at, group_id, from_profile, to_profile, group:groups(id,name,emoji,currency), from:profiles!from_profile(id,full_name,email), to_p:profiles!to_profile(id,full_name,email)')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const normalize = <T extends { group: unknown }>(data: T[] | null) =>
      (data ?? []).map((row) => ({
        ...row,
        group: Array.isArray(row.group) ? row.group[0] : row.group,
      }))

    const normalizeProfile = <T extends { payer?: unknown; from?: unknown; to_p?: unknown }>(data: T[]) =>
      data.map((row) => ({
        ...row,
        payer: Array.isArray((row as { payer?: unknown }).payer) ? (row as { payer: unknown[] }).payer[0] : (row as { payer?: unknown }).payer,
        from: Array.isArray((row as { from?: unknown }).from) ? (row as { from: unknown[] }).from[0] : (row as { from?: unknown }).from,
        to_p: Array.isArray((row as { to_p?: unknown }).to_p) ? (row as { to_p: unknown[] }).to_p[0] : (row as { to_p?: unknown }).to_p,
      }))

    const expenses = normalizeProfile(normalize(expRes.data as RawExpense[] | null)) as RawExpense[]
    const settlements = normalizeProfile(normalize(setRes.data as RawSettlement[] | null)) as RawSettlement[]

    const nameOf = (p: { full_name: string; email: string } | null) =>
      p?.full_name || p?.email?.split('@')[0] || 'Someone'

    const expItems: ActivityItem[] = expenses
      .filter((e) => e.group)
      .map((e) => ({
        id: `exp-${e.id}`,
        type: 'expense_added',
        group_id: e.group_id,
        group_name: e.group!.name,
        group_emoji: e.group!.emoji,
        actor_name: e.paid_by === currentUserId ? 'You' : nameOf(e.payer),
        actor_id: e.paid_by,
        description: `added "${e.description}"`,
        amount: Number(e.amount),
        currency: e.group!.currency,
        created_at: e.created_at,
      }))

    const settlementItems: ActivityItem[] = settlements
      .filter((s) => s.group)
      .map((s) => ({
        id: `set-${s.id}`,
        type: 'settlement',
        group_id: s.group_id,
        group_name: s.group!.name,
        group_emoji: s.group!.emoji,
        actor_name: s.from_profile === currentUserId ? 'You' : nameOf(s.from),
        actor_id: s.from_profile,
        description: `paid ${nameOf(s.to_p)} ${formatMoney(Number(s.amount), s.group!.currency)}`,
        amount: Number(s.amount),
        currency: s.group!.currency,
        created_at: s.created_at,
      }))

    const all = [...expItems, ...settlementItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    setItems(all)
    setLoading(false)
  }, [currentUserId])

  useEffect(() => {
    load()
  }, [load])

  return { items, loading, reload: load }
}
