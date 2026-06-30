import { useState } from 'react'
import Modal from './Modal'
import { formatMoney, splitEqually } from '../lib/balances'
import {
  CATEGORIES,
  FREQUENCIES,
  type Profile,
  type RecurringExpense,
  type SplitMode,
} from '../lib/types'

const MODE_LABELS: Record<SplitMode, string> = {
  equal: 'Equally',
  full: 'One owes all',
  percent: 'By %',
  custom: 'Amounts',
}

export default function AddRecurringModal({
  open,
  onClose,
  groupId,
  members,
  currentUserId,
  currency,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  members: Profile[]
  currentUserId: string
  currency: string
  onAdd: (rec: Omit<RecurringExpense, 'id' | 'created_at'>) => Promise<{ error: string | null }>
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('general')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [frequency, setFrequency] = useState<RecurringExpense['frequency']>('monthly')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState<SplitMode>('equal')
  const [involved, setInvolved] = useState<Set<string>>(new Set(members.map((m) => m.id)))
  const [fullPayer, setFullPayer] = useState(members.find((m) => m.id !== currentUserId)?.id ?? '')
  const [percent, setPercent] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const total = Number(amount) || 0
  const fmt = (n: number) => formatMoney(n, currency)

  const equalPreview = splitEqually(total, members.filter((m) => involved.has(m.id)).map((m) => m.id))
  const percentSum = members.reduce((s, m) => s + (Number(percent[m.id]) || 0), 0)
  const customSum = members.reduce((s, m) => s + (Number(custom[m.id]) || 0), 0)

  function buildSplitData() {
    if (mode === 'equal') return { involved: [...involved] }
    if (mode === 'full') return { fullPayer }
    if (mode === 'percent') {
      const pm: Record<string, number> = {}
      for (const m of members) pm[m.id] = Number(percent[m.id]) || 0
      return { percentMap: pm }
    }
    const cm: Record<string, number> = {}
    for (const m of members) { const v = Number(custom[m.id]) || 0; if (v > 0) cm[m.id] = v }
    return { customMap: cm }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!description.trim()) return setError('Add a description.')
    if (total <= 0) return setError('Enter an amount.')
    if (mode === 'equal' && involved.size === 0) return setError('Pick at least one person.')
    if (mode === 'full' && !fullPayer) return setError('Choose who owes it all.')
    if (mode === 'percent' && Math.abs(percentSum - 100) > 0.1) return setError(`Percentages must add to 100% (now ${percentSum}%).`)
    if (mode === 'custom' && Math.abs(customSum - total) > 0.01) return setError(`Amounts (${fmt(customSum)}) must equal total (${fmt(total)}).`)

    setBusy(true)
    const { error } = await onAdd({
      group_id: groupId,
      description: description.trim(),
      amount: total,
      category,
      paid_by: paidBy,
      split_mode: mode,
      split_data: buildSplitData(),
      frequency,
      next_due_at: startDate,
      created_by: currentUserId,
      active: true,
    })
    setBusy(false)
    if (error) { setError(error); return }
    setDescription(''); setAmount(''); setError(null)
    onClose()
  }

  const labelFor = (m: Profile) => (m.id === currentUserId ? 'You' : m.full_name || m.email)

  return (
    <Modal open={open} onClose={onClose} title="Add recurring expense">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          This expense will be automatically added on the chosen schedule every time someone opens the group.
        </p>

        <div>
          <label className="label">Description</label>
          <input autoFocus className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rent, Netflix, Wi-Fi…" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" min="0" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="label">First due date</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
            <label className="label">Repeats</label>
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringExpense['frequency'])}>
              {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
          </select>
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
                  <input type="checkbox" checked={involved.has(m.id)}
                    onChange={() => setInvolved((p) => { const n = new Set(p); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })}
                    className="h-4 w-4 accent-brand-500" />
                )}
                {mode === 'full' && (
                  <input type="radio" name="fp2" checked={fullPayer === m.id} onChange={() => setFullPayer(m.id)} className="h-4 w-4 accent-brand-500" />
                )}
                <span className="flex-1 truncate text-sm">{labelFor(m)}</span>
                {mode === 'percent' ? (
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.1" min="0" className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                      value={percent[m.id] ?? ''} onChange={(e) => setPercent((p) => ({ ...p, [m.id]: e.target.value }))} placeholder="0" />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                ) : mode === 'custom' ? (
                  <input type="number" step="0.01" min="0" className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                    value={custom[m.id] ?? ''} onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))} placeholder="0.00" />
                ) : (
                  <span className="text-sm tabular-nums text-gray-400">
                    {(mode === 'equal' && involved.has(m.id)) ? fmt(equalPreview[m.id] ?? 0)
                      : (mode === 'full' && fullPayer === m.id) ? fmt(total) : '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save recurring expense'}
        </button>
      </form>
    </Modal>
  )
}
