import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { splitByPercent, splitEqually } from '../lib/balances'
import { nextDueDate, type RecurringExpense } from '../lib/types'

export function useRecurring(groupId: string | undefined, currentUserId: string, onCreated: () => void) {
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    const { data } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('group_id', groupId)
      .eq('active', true)
      .order('next_due_at', { ascending: true })
    setRecurring((data as RecurringExpense[]) ?? [])
    setLoading(false)
  }, [groupId])

  // Auto-fire any recurring expenses that are due today or overdue.
  const fireOverdue = useCallback(async (memberIds: string[]) => {
    if (!groupId) return
    const today = new Date().toISOString().slice(0, 10)

    const { data: due } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('group_id', groupId)
      .eq('active', true)
      .lte('next_due_at', today)

    if (!due || due.length === 0) return

    let fired = false
    for (const r of due as RecurringExpense[]) {
      // Build the split.
      let splitMap: Record<string, number> = {}
      const total = Number(r.amount)

      if (r.split_mode === 'equal') {
        const ids = (r.split_data.involved ?? memberIds).filter((id) => memberIds.includes(id))
        splitMap = splitEqually(total, ids)
      } else if (r.split_mode === 'full') {
        const fp = r.split_data.fullPayer
        if (fp && memberIds.includes(fp)) splitMap = { [fp]: total }
      } else if (r.split_mode === 'percent') {
        splitMap = splitByPercent(total, r.split_data.percentMap ?? {})
      } else {
        splitMap = r.split_data.customMap ?? {}
      }

      const splits = Object.entries(splitMap)
        .filter(([, amt]) => amt > 0)
        .map(([profile_id, amount]) => ({ profile_id, amount }))
      if (splits.length === 0) continue

      // Create the expense.
      const { data: exp } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          description: r.description,
          amount: total,
          category: r.category,
          paid_by: r.paid_by,
          created_by: currentUserId,
          spent_at: r.next_due_at,
        })
        .select()
        .single()

      if (!exp) continue

      await supabase.from('expense_splits').insert(
        splits.map((s) => ({ expense_id: exp.id, profile_id: s.profile_id, amount: s.amount }))
      )

      // Advance next_due_at.
      await supabase
        .from('recurring_expenses')
        .update({ next_due_at: nextDueDate(r.frequency, new Date(r.next_due_at)) })
        .eq('id', r.id)

      fired = true
    }

    if (fired) {
      onCreated()
      load()
    }
  }, [groupId, currentUserId, onCreated, load])

  useEffect(() => {
    load()
  }, [load])

  const addRecurring = useCallback(async (rec: Omit<RecurringExpense, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('recurring_expenses').insert(rec)
    if (error) return { error: error.message }
    await load()
    return { error: null }
  }, [load])

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    await supabase.from('recurring_expenses').update({ active }).eq('id', id)
    await load()
  }, [load])

  const deleteRecurring = useCallback(async (id: string) => {
    await supabase.from('recurring_expenses').delete().eq('id', id)
    await load()
  }, [load])

  return { recurring, loading, reload: load, fireOverdue, addRecurring, toggleActive, deleteRecurring }
}
