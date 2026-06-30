import { useState } from 'react'
import Modal from './Modal'
import { CURRENCIES } from '../lib/types'

const EMOJIS = ['👥', '🏠', '✈️', '🍔', '🎉', '🏝️', '🚗', '🎓', '💼', '⚽']

export default function CreateGroupModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (name: string, emoji: string, currency: string) => Promise<{ error: string | null }>
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('👥')
  const [currency, setCurrency] = useState('INR')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await onCreate(name.trim(), emoji, currency)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setName('')
    setEmoji('👥')
    setCurrency('INR')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a group">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Group name</label>
          <input
            autoFocus
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Apartment 4B, Goa Trip…"
          />
        </div>
        <div>
          <label className="label">Icon</label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((em) => (
              <button
                type="button"
                key={em}
                onClick={() => setEmoji(em)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition ${
                  emoji === em ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Currency</label>
          <select
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            All expenses in this group are tracked in this currency.
          </p>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </Modal>
  )
}
