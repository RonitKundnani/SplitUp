import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Expense, Group, Profile, Settlement } from '../lib/types'

interface GroupData {
  group: Group | null
  members: Profile[]
  expenses: Expense[]
  settlements: Settlement[]
  loading: boolean
  error: string | null
}

export function useGroupData(groupId: string | undefined) {
  const [data, setData] = useState<GroupData>({
    group: null,
    members: [],
    expenses: [],
    settlements: [],
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!groupId) return
    setData((d) => ({ ...d, loading: true, error: null }))

    const [groupRes, membersRes, expensesRes, settlementsRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase
        .from('group_members')
        .select('profile:profiles(*)')
        .eq('group_id', groupId),
      supabase
        .from('expenses')
        .select('*, splits:expense_splits(*)')
        .eq('group_id', groupId)
        .order('spent_at', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('settlements')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false }),
    ])

    const error =
      groupRes.error?.message ||
      membersRes.error?.message ||
      expensesRes.error?.message ||
      settlementsRes.error?.message ||
      null

    // The embedded join can come back as an object or a single-element array
    // depending on the relationship inference, so normalize both shapes.
    const members: Profile[] = ((membersRes.data ?? []) as { profile: Profile | Profile[] | null }[])
      .map((row) => (Array.isArray(row.profile) ? row.profile[0] : row.profile))
      .filter((p): p is Profile => Boolean(p))

    setData({
      group: (groupRes.data as Group) ?? null,
      members,
      expenses: (expensesRes.data as Expense[]) ?? [],
      settlements: (settlementsRes.data as Settlement[]) ?? [],
      loading: false,
      error,
    })
  }, [groupId])

  useEffect(() => {
    load()
  }, [load])

  return { ...data, reload: load }
}
