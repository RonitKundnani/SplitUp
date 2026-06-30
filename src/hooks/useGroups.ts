import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // RLS limits this to groups the current user is a member of (or created).
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
    async (name: string, emoji: string) => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return { error: 'Not signed in' }

      const { data, error } = await supabase
        .from('groups')
        .insert({ name, emoji, created_by: uid })
        .select()
        .single()
      if (error) return { error: error.message }

      // Add the creator as the first member.
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: (data as Group).id, profile_id: uid })
      if (memberError) return { error: memberError.message }

      await load()
      return { error: null, group: data as Group }
    },
    [load],
  )

  return { groups, loading, error, reload: load, createGroup }
}
