import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { formatMoney, splitByPercent, splitEqually } from '../lib/balances'
import { CATEGORIES, type Expense, type Profile, type SplitMode } from '../lib/types'

const MODE_LABELS: Record<SplitMode, string> = {
  equal: 'Equally',
  full: 'One owes all',
  percent: 'By %',
  custom: 'Amounts',
}

export default function EditExpenseModal({
  open,
  onClose,
  expense,
  members,
  currentUserId,
  currency,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  expense: Expense | null
  members: Profile[]
  currentUserId: string
  currency: string
  onSaved: () => void
  onDeleted: () => void
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('general')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [spentAt, setSpentAt] = useState('')
  const [mode, setMode] = useState<SplitMode>('equal')
  const [involved, setInvolved] = useState<Set<string>>(new Set())
  const [fullPayer, setFullPayer] = useState('')
  const [percent, setPercent] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fmt = (n: number) => formatMoney(n, currency)

  // Pre-populate from the existing expense when it opens.
  useEffect(() => {
    if (!open || !expense) return
    setDescription(expense.description)
    setAmount(String(expense.amount))
    setCategory(expense.category)
    setPaidBy(expense.paid_by)
    setSpentAt(expense.spent_at)
    setError(null)
    setConfirmDelete(false)

    // Infer split mode from existing splits.
    const splits = expense.splits ?? []
    if (splits.length === 0) {
      setMode('equal')
      setInvolved(new Set(members.map((m) => m.id)))
      return
    }
    const total = Number(expense.amount)
    const isFullSingle = splits.length === 1
    if (isFullSingle) {
      setMode('full')
      setFullPayer(splits[0].profile_id)
      return
    }
    const equalShare = total / members.length
    const isEqual = splits.every((s) => Math.abs(Number(s.amount) - equalShare) < 0.02)
    if (isEqual) {
      setMode('equal')
      setInvolved(new Set(splits.map((s) => s.profile_id)))
      return
    }
    // Default to custom for everything else.
    setMode('custom')
    const cm: Record<string, string> = {}
    for (const s of splits) cm[s.profile_id] = String(s.amount)
    setCustom(cm)
  }, [open, expense, members])

  const total = Number(amount) || 0

  const splitMap = useMemo<Record<string, number>>(() => {
    if (mode === 'equal') return splitEqually(total, members.filter((m) => involved.has(m.id)).map((m) => m.id))
    if (mode === 'full') return fullPayer ? { [fullPayer]: total } : {}
    if (mode === 'percent') {
      const pct: Record<string, number> = {}
      for (const m of members) pct[m.id] = Number(percent[m.id]) || 0
      return splitByPercent(total, pct)
    }
    const map: Record<string, number> = {}
    for (const m of members) { const v = Number(custom[m.id]) || 0; if (v > 0) map[m.id] = v }
    return map
  }, [mode, total, members, involved, fullPayer, percent, custom])

  const splitSum = useMemo(() => Object.values(splitMap).reduce((s, v) => s + v, 0), [splitMap])
  const percentSum = useMemo(() => members.reduce((s, m) => s + (Number(percent[m.id]) || 0), 0), [members, percent])

  function toggleInvolved(id: string) {
    setInvolved((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!description.trim()) return setError('Add a description.')
    if (total <= 0) return setError('Enter an amount greater than zero.')
    if (mode === 'equal' && involved.size === 0) return setError('Pick at least one person.')
    if (mode === 'full' && !fullPayer) return setError('Choose who owes it all.')
    if (mode === 'percent' && Math.abs(percentSum - 100) > 0.1) return setError(`Percentages must add up to 100% (currently ${percentSum}%).`)
    if (mode === 'custom' && Math.abs(splitSum - total) > 0.01) return setError(`Custom amounts (${fmt(splitSum)}) must equal total (${fmt(total)}).`)

    const splits = Object.entries(splitMap)
      .map(([profile_id, amt]) => ({ profile_id, amount: amt }))
      .filter((s) => s.amount > 0)
    if (splits.length === 0) return setError('Split assigns nothing to anyone.')
    if (!expense) return

    setBusy(true)
    // Update expense row.
    const { error: updErr } = await supabase
      .from('expenses')
      .update({ description: description.trim(), amount: total, category, paid_by: paidBy, spent_at: spentAt })
      .eq('id', expense.id)
    if (updErr) { setBusy(false); return setError(updErr.message) }

    // Replace splits.
    const { error: delErr } = await supabase.from('expense_splits').delete().eq('expense_id', expense.id)
    if (delErr) { setBusy(false); return setError(delErr.message) }
    const { error: insErr } = await supabase.from('expense_splits').insert(
      splits.map((s) => ({ expense_id: expense.id, profile_id: s.profile_id, amount: s.amount }))
    )
    setBusy(false)
    if (insErr) return setError(insErr.message)
    onSaved()
    onClose()
  }

  async function deleteExpense() {
    if (!expense) return
    setBusy(true)
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    setBusy(false)
    if (error) { setError(error.message); return }
    onDeleted()
    onClose()
  }

  const labelFor = (m: Profile) => (m.id === currentUserId ? 'You' : m.full_name || m.email)

  if (!expense) return null

  return (
    <Modal open={open} onClose={onClose} title="Edit expense">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Description</label>
          <input autoFocus className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" min="0" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Paid by</label>
            <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{labelFor(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Split</label>
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
              {(Object.keys(MODE_LABELS) as SplitMode[]).map((m) => (
                <button type="button" key={m} onClick={() => setMode(m)}
                  className={`rounded-md px-2 py-1 transition ${mode === m ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-gray-200 p-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                {mode === 'equal' && (
                  <input type="checkbox" checked={involved.has(m.id)} onChange={() => toggleInvolved(m.id)} className="h-4 w-4 accent-brand-500" />
                )}
                {mode === 'full' && (
                  <input type="radio" name="fp" checked={fullPayer === m.id} onChange={() => setFullPayer(m.id)} className="h-4 w-4 accent-brand-500" />
                )}
                <span className="flex-1 truncate text-sm">{labelFor(m)}</span>
                {mode === 'percent' ? (
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.1" min="0" className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                      value={percent[m.id] ?? ''} onChange={(e) => setPercent((p) => ({ ...p, [m.id]: e.target.value }))} placeholder="0" />
                    <span className="text-xs text-gray-400">%</span>
                    <span className="w-20 text-right text-xs tabular-nums text-gray-400">{fmt(splitMap[m.id] ?? 0)}</span>
                  </div>
                ) : mode === 'custom' ? (
                  <input type="number" step="0.01" min="0" className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                    value={custom[m.id] ?? ''} onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))} placeholder="0.00" />
                ) : (
                  <span className="text-sm tabular-nums text-gray-500">
                    {(mode === 'equal' && involved.has(m.id)) || (mode === 'full' && fullPayer === m.id)
                      ? fmt(splitMap[m.id] ?? 0) : '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
          {mode === 'percent' && (
            <p className={`mt-1 text-right text-xs ${Math.abs(percentSum - 100) > 0.1 ? 'text-rose-600' : 'text-gray-400'}`}>
              {percentSum}% of 100%
            </p>
          )}
          {mode === 'custom' && (
            <p className={`mt-1 text-right text-xs ${Math.abs(splitSum - total) > 0.01 ? 'text-rose-600' : 'text-gray-400'}`}>
              {fmt(splitSum)} of {fmt(total)}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>

        {/* Delete — only the creator can delete */}
        {expense.created_by === currentUserId && (
          <div className="border-t border-gray-100 pt-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm text-gray-600">Delete this expense?</p>
                <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button type="button" className="btn bg-rose-500 px-3 py-1.5 text-sm text-white hover:bg-rose-600" onClick={deleteExpense} disabled={busy}>Delete</button>
              </div>
            ) : (
              <button type="button" className="btn-ghost w-full text-rose-500 hover:bg-rose-50" onClick={() => setConfirmDelete(true)}>
                Delete expense
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
