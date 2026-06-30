import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { formatMoney, splitByPercent, splitEqually } from '../lib/balances'
import { CATEGORIES, type Profile } from '../lib/types'

type SplitMode = 'equal' | 'full' | 'percent' | 'custom'

const MODE_LABELS: Record<SplitMode, string> = {
  equal: 'Equally',
  full: 'One owes all',
  percent: 'By %',
  custom: 'Amounts',
}

export default function AddExpenseModal({
  open,
  onClose,
  groupId,
  members,
  currentUserId,
  currency,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  members: Profile[]
  currentUserId: string
  currency: string
  onSaved: () => void
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('general')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState<SplitMode>('equal')
  const [involved, setInvolved] = useState<Set<string>>(new Set())
  const [fullPayer, setFullPayer] = useState<string>(currentUserId)
  const [percent, setPercent] = useState<Record<string, string>>({})
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
    setFullPayer(members.find((m) => m.id !== currentUserId)?.id ?? currentUserId)
    setPercent({})
    setCustom({})
    setError(null)
  }, [open, members, currentUserId])

  const total = Number(amount) || 0
  const fmt = (n: number) => formatMoney(n, currency)

  // Build the per-member split for the current mode (used for preview + save).
  const splitMap = useMemo<Record<string, number>>(() => {
    if (mode === 'equal') {
      return splitEqually(total, members.filter((m) => involved.has(m.id)).map((m) => m.id))
    }
    if (mode === 'full') {
      return fullPayer ? { [fullPayer]: total } : {}
    }
    if (mode === 'percent') {
      const pct: Record<string, number> = {}
      for (const m of members) pct[m.id] = Number(percent[m.id]) || 0
      return splitByPercent(total, pct)
    }
    // custom
    const map: Record<string, number> = {}
    for (const m of members) {
      const v = Number(custom[m.id]) || 0
      if (v > 0) map[m.id] = v
    }
    return map
  }, [mode, total, members, involved, fullPayer, percent, custom])

  const splitSum = useMemo(
    () => Object.values(splitMap).reduce((s, v) => s + v, 0),
    [splitMap],
  )
  const percentSum = useMemo(
    () => members.reduce((s, m) => s + (Number(percent[m.id]) || 0), 0),
    [members, percent],
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

    if (mode === 'equal' && involved.size === 0) {
      return setError('Pick at least one person to split with.')
    }
    if (mode === 'full' && !fullPayer) {
      return setError('Choose who owes the full amount.')
    }
    if (mode === 'percent' && Math.abs(percentSum - 100) > 0.1) {
      return setError(`Percentages must add up to 100% (currently ${percentSum}%).`)
    }
    if (mode === 'custom' && Math.abs(splitSum - total) > 0.01) {
      return setError(`Custom amounts (${fmt(splitSum)}) must equal the total (${fmt(total)}).`)
    }

    const splits = Object.entries(splitMap)
      .map(([profile_id, amt]) => ({ profile_id, amount: amt }))
      .filter((s) => s.amount > 0)

    if (splits.length === 0) return setError('This split assigns nothing to anyone.')

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

  const labelFor = (m: Profile) => (m.id === currentUserId ? 'You' : m.full_name || m.email)

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
                  {labelFor(m)}
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
              {(Object.keys(MODE_LABELS) as SplitMode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    mode === m ? 'bg-white shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {mode === 'full' && (
            <p className="mb-2 text-xs text-gray-500">
              The whole amount is owed by one person. Combine with “Paid by” above — e.g. you paid
              and they owe all of it means you lent them the full amount.
            </p>
          )}

          <div className="space-y-1 rounded-lg border border-gray-200 p-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                {mode === 'equal' && (
                  <input
                    type="checkbox"
                    checked={involved.has(m.id)}
                    onChange={() => toggleInvolved(m.id)}
                    className="h-4 w-4 accent-brand-500"
                  />
                )}
                {mode === 'full' && (
                  <input
                    type="radio"
                    name="fullPayer"
                    checked={fullPayer === m.id}
                    onChange={() => setFullPayer(m.id)}
                    className="h-4 w-4 accent-brand-500"
                  />
                )}
                {(mode === 'percent' || mode === 'custom') && (
                  <Avatar name={m.full_name || m.email} seed={m.id} size={28} />
                )}

                <span className="flex-1 truncate text-sm">{labelFor(m)}</span>

                {mode === 'percent' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                      value={percent[m.id] ?? ''}
                      onChange={(e) => setPercent((p) => ({ ...p, [m.id]: e.target.value }))}
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-400">%</span>
                    <span className="w-20 text-right text-xs tabular-nums text-gray-400">
                      {fmt(splitMap[m.id] ?? 0)}
                    </span>
                  </div>
                ) : mode === 'custom' ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                    value={custom[m.id] ?? ''}
                    onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                    placeholder="0.00"
                  />
                ) : (
                  <span className="text-sm tabular-nums text-gray-500">
                    {(mode === 'equal' && involved.has(m.id)) || (mode === 'full' && fullPayer === m.id)
                      ? fmt(splitMap[m.id] ?? 0)
                      : '—'}
                  </span>
                )}
              </div>
            ))}
          </div>

          {mode === 'percent' && (
            <p
              className={`mt-1 text-right text-xs ${
                Math.abs(percentSum - 100) > 0.1 ? 'text-rose-600' : 'text-gray-400'
              }`}
            >
              {percentSum}% of 100%
            </p>
          )}
          {mode === 'custom' && (
            <p
              className={`mt-1 text-right text-xs ${
                Math.abs(splitSum - total) > 0.01 ? 'text-rose-600' : 'text-gray-400'
              }`}
            >
              {fmt(splitSum)} of {fmt(total)}
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
