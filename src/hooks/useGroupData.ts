import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Expense, Group, JoinRequest, Profile, Settlement } from '../lib/types'

interface GroupData {
  group: Group | null
  members: Profile[]
  expenses: Expense[]
  settlements: Settlement[]
  requests: JoinRequest[]
  loading: boolean
  error: string | null
}

export function useGroupData(groupId: string | undefined) {
  const [data, setData] = useState<GroupData>({
    group: null,
    members: [],
    expenses: [],
    settlements: [],
    requests: [],
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!groupId) return
    setData((d) => ({ ...d, loading: true, error: null }))

    const [groupRes, membersRes, expensesRes, settlementsRes, requestsRes] = await Promise.all([
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
      supabase
        // join_requests has two FKs to profiles (profile_id + decided_by), so
        // disambiguate the embed by naming the foreign-key column explicitly.
        .from('join_requests')
        .select('*, profile:profiles!profile_id(*)')
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ])

    const error =
      groupRes.error?.message ||
      membersRes.error?.message ||
      expensesRes.error?.message ||
      settlementsRes.error?.message ||
      requestsRes.error?.message ||
      null

    // The embedded join can come back as an object or a single-element array
    // depending on the relationship inference, so normalize both shapes.
    const members: Profile[] = ((membersRes.data ?? []) as { profile: Profile | Profile[] | null }[])
      .map((row) => (Array.isArray(row.profile) ? row.profile[0] : row.profile))
      .filter((p): p is Profile => Boolean(p))

    const requests: JoinRequest[] = (
      (requestsRes.data ?? []) as (Omit<JoinRequest, 'profile'> & {
        profile: Profile | Profile[] | null
      })[]
    ).map((r) => ({
      ...r,
      profile: Array.isArray(r.profile) ? r.profile[0] : r.profile ?? undefined,
    }))

    setData({
      group: (groupRes.data as Group) ?? null,
      members,
      expenses: (expensesRes.data as Expense[]) ?? [],
      settlements: (settlementsRes.data as Settlement[]) ?? [],
      requests,
      loading: false,
      error,
    })
  }, [groupId])

  useEffect(() => {
    load()
  }, [load])

  return { ...data, reload: load }
}
