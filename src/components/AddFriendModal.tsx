import { useState } from 'react'
import Modal from './Modal'
import { CURRENCIES } from '../lib/types'

export default function AddFriendModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (email: string, currency: string) => Promise<{ error: string | null }>
}) {
  const [email, setEmail] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await onAdd(email.trim(), currency)
    setBusy(false)
    if (error) { setError(error); return }
    setEmail('')
    setCurrency('INR')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a friend">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Creates a private space between you two for tracking personal expenses — like lending
          money, shared meals, or anything 1-on-1.
        </p>
        <div>
          <label className="label">Friend's email</label>
          <input
            autoFocus
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
          />
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Adding…' : 'Add friend'}
        </button>
      </form>
    </Modal>
  )
}
