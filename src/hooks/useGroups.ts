import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group, Profile } from '../lib/types'

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setGroups((data as Group[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createGroup = useCallback(
    async (name: string, emoji: string, currency: string) => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return { error: 'Not signed in' }

      const { data, error } = await supabase
        .from('groups')
        .insert({ name, emoji, currency, created_by: uid, type: 'group' })
        .select()
        .single()
      if (error) return { error: error.message }

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: (data as Group).id, profile_id: uid })
      if (memberError) return { error: memberError.message }

      await load()
      return { error: null, group: data as Group }
    },
    [load],
  )

  // Create a 1-on-1 personal group with a friend found by email.
  const createPersonalGroup = useCallback(
    async (friendEmail: string, currency: string) => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return { error: 'Not signed in' }

      // Look up the friend.
      const { data: friendData, error: lookupErr } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', friendEmail.trim())
        .maybeSingle()
      if (lookupErr) return { error: lookupErr.message }
      const friend = friendData as Profile | null
      if (!friend) return { error: 'No SplitUp user with that email. Ask them to sign up first.' }
      if (friend.id === uid) return { error: "You can't add yourself." }

      // Check if a personal group already exists between these two people.
      const { data: existing } = await supabase
        .from('groups')
        .select('id')
        .eq('type', 'personal')
        .eq('created_by', uid)
        .ilike('name', friend.full_name || friend.email)
        .maybeSingle()
      if (existing) return { error: 'You already have a personal group with this person.' }

      const name = friend.full_name || friend.email.split('@')[0]
      const { data, error } = await supabase
        .from('groups')
        .insert({ name, emoji: '👤', currency, created_by: uid, type: 'personal' })
        .select()
        .single()
      if (error) return { error: error.message }

      const gid = (data as Group).id
      const { error: membersErr } = await supabase
        .from('group_members')
        .insert([
          { group_id: gid, profile_id: uid },
          { group_id: gid, profile_id: friend.id },
        ])
      if (membersErr) return { error: membersErr.message }

      await load()
      return { error: null, group: data as Group, friend }
    },
    [load],
  )

  return { groups, loading, error, reload: load, createGroup, createPersonalGroup }
}
