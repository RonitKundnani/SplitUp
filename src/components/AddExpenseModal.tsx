import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { formatMoney, splitEqually } from '../lib/balances'
import { CATEGORIES, type Profile } from '../lib/types'

type SplitMode = 'equal' | 'custom'

export default function AddExpenseModal({
  open,
  onClose,
  groupId,
  members,
  currentUserId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  members: Profile[]
  currentUserId: string
  onSaved: () => void
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('general')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState<SplitMode>('equal')
  const [involved, setInvolved] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Reset state each time the modal opens.
  useEffect(() => {
    if (!open) return
    setDescription('')
    setAmount('')
    setCategory('general')
    setPaidBy(currentUserId)
    setSpentAt(new Date().toISOString().slice(0, 10))
    setMode('equal')
    setInvolved(new Set(members.map((m) => m.id)))
    setCustom({})
    setError(null)
  }, [open, members, currentUserId])

  const total = Number(amount) || 0

  const equalPreview = useMemo(() => {
    const ids = members.filter((m) => involved.has(m.id)).map((m) => m.id)
    return splitEqually(total, ids)
  }, [members, involved, total])

  const customTotal = useMemo(
    () => Object.values(custom).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [custom],
  )

  function toggleInvolved(id: string) {
    setInvolved((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!description.trim()) return setError('Add a description.')
    if (total <= 0) return setError('Enter an amount greater than zero.')

    let splits: { profile_id: string; amount: number }[]
    if (mode === 'equal') {
      const ids = members.filter((m) => involved.has(m.id)).map((m) => m.id)
      if (ids.length === 0) return setError('Pick at least one person to split with.')
      const map = splitEqually(total, ids)
      splits = ids.map((id) => ({ profile_id: id, amount: map[id] }))
    } else {
      splits = Object.entries(custom)
        .map(([profile_id, v]) => ({ profile_id, amount: Number(v) || 0 }))
        .filter((s) => s.amount > 0)
      if (splits.length === 0) return setError('Enter at least one custom amount.')
      if (Math.abs(customTotal - total) > 0.01) {
        return setError(
          `Custom split (${formatMoney(customTotal)}) must equal the total (${formatMoney(total)}).`,
        )
      }
    }

    setBusy(true)
    const { data: expense, error: expError } = await supabase
      .from('expenses')
      .insert({
        group_id: groupId,
        description: description.trim(),
        amount: total,
        category,
        paid_by: paidBy,
        created_by: currentUserId,
        spent_at: spentAt,
      })
      .select()
      .single()

    if (expError || !expense) {
      setBusy(false)
      return setError(expError?.message ?? 'Failed to save expense.')
    }

    const { error: splitError } = await supabase.from('expense_splits').insert(
      splits.map((s) => ({ expense_id: expense.id, profile_id: s.profile_id, amount: s.amount })),
    )

    setBusy(false)
    if (splitError) return setError(splitError.message)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add an expense">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Description</label>
          <input
            autoFocus
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dinner, groceries, Uber…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Paid by</label>
            <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === currentUserId ? 'You' : m.full_name || m.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Split</label>
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
              {(['equal', 'custom'] as SplitMode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 capitalize transition ${
                    mode === m ? 'bg-white shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 rounded-lg border border-gray-200 p-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                {mode === 'equal' ? (
                  <input
                    type="checkbox"
                    checked={involved.has(m.id)}
                    onChange={() => toggleInvolved(m.id)}
                    className="h-4 w-4 accent-brand-500"
                  />
                ) : (
                  <Avatar name={m.full_name || m.email} seed={m.id} size={28} />
                )}
                <span className="flex-1 truncate text-sm">
                  {m.id === currentUserId ? 'You' : m.full_name || m.email}
                </span>
                {mode === 'equal' ? (
                  <span className="text-sm tabular-nums text-gray-500">
                    {involved.has(m.id) ? formatMoney(equalPreview[m.id] ?? 0) : '—'}
                  </span>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                    value={custom[m.id] ?? ''}
                    onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                    placeholder="0.00"
                  />
                )}
              </div>
            ))}
          </div>

          {mode === 'custom' && (
            <p
              className={`mt-1 text-right text-xs ${
                Math.abs(customTotal - total) > 0.01 ? 'text-rose-600' : 'text-gray-400'
              }`}
            >
              {formatMoney(customTotal)} of {formatMoney(total)}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save expense'}
        </button>
      </form>
    </Modal>
  )
}
