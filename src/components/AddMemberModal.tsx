import { useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export default function AddMemberModal({
  open,
  onClose,
  groupId,
  existingIds,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  existingIds: string[]
  onAdded: () => void
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const target = email.trim().toLowerCase()
    if (!target) return
    setBusy(true)
    setError(null)

    // Look the person up by email. They must already have a SplitUp account.
    const { data, error: lookupError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', target)
      .maybeSingle()

    if (lookupError) {
      setBusy(false)
      setError(lookupError.message)
      return
    }
    const profile = data as Profile | null
    if (!profile) {
      setBusy(false)
      setError('No SplitUp user found with that email. Ask them to sign up first.')
      return
    }
    if (existingIds.includes(profile.id)) {
      setBusy(false)
      setError('That person is already in this group.')
      return
    }

    const { error: insertError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, profile_id: profile.id })

    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setEmail('')
    onAdded()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a member">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Add someone by the email they signed up with. They&apos;ll see this group the next time
          they open SplitUp.
        </p>
        <div>
          <label className="label">Email</label>
          <input
            autoFocus
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Adding…' : 'Add to group'}
        </button>
      </form>
    </Modal>
  )
}
