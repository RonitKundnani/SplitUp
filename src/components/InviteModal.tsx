import { useEffect, useState } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import type { JoinRequest } from '../lib/types'

export default function InviteModal({
  open,
  onClose,
  groupId,
  requests,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  requests: JoinRequest[]
  onChanged: () => void
}) {
  const [link, setLink] = useState<string | null>(null)
  const [loadingLink, setLoadingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Ensure the group has an invite token, then build the shareable URL.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setCopied(false)
    setLoadingLink(true)

    async function ensureInvite() {
      const { data: existing, error: selErr } = await supabase
        .from('group_invites')
        .select('token')
        .eq('group_id', groupId)
        .limit(1)
        .maybeSingle()

      if (selErr) {
        if (!cancelled) setError(selErr.message)
        return
      }

      let token = existing?.token as string | undefined
      if (!token) {
        const { data: userData } = await supabase.auth.getUser()
        const { data: created, error: insErr } = await supabase
          .from('group_invites')
          .insert({ group_id: groupId, created_by: userData.user?.id })
          .select('token')
          .single()
        if (insErr) {
          if (!cancelled) setError(insErr.message)
          return
        }
        token = created?.token as string
      }

      if (!cancelled && token) {
        setLink(`${window.location.origin}/join/${token}`)
      }
    }

    ensureInvite().finally(() => !cancelled && setLoadingLink(false))
    return () => {
      cancelled = true
    }
  }, [open, groupId])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy automatically — select the link and copy it manually.')
    }
  }

  async function approve(req: JoinRequest) {
    setBusyId(req.id)
    setError(null)
    const { error } = await supabase.rpc('approve_join_request', { request_id: req.id })
    setBusyId(null)
    if (error) setError(error.message)
    else onChanged()
  }

  async function reject(req: JoinRequest) {
    setBusyId(req.id)
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('join_requests')
      .update({ status: 'rejected', decided_by: userData.user?.id, decided_at: new Date().toISOString() })
      .eq('id', req.id)
    setBusyId(null)
    if (error) setError(error.message)
    else onChanged()
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite people">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm text-gray-500">
            Share this link. Anyone who opens it can ask to join — you approve the request before
            they&apos;re added.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              className="input font-mono text-xs"
              value={loadingLink ? 'Generating link…' : link ?? ''}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button className="btn-primary shrink-0" onClick={copy} disabled={!link}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold">
            Pending requests{requests.length > 0 && ` (${requests.length})`}
          </div>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400">No pending requests right now.</p>
          ) : (
            <ul className="space-y-2">
              {requests.map((req) => {
                const name = req.profile?.full_name || req.profile?.email || 'Someone'
                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5"
                  >
                    <Avatar name={name} seed={req.profile_id} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{name}</div>
                      <div className="truncate text-xs text-gray-400">{req.profile?.email}</div>
                    </div>
                    <button
                      className="btn-ghost px-2 py-1 text-xs text-rose-600"
                      disabled={busyId === req.id}
                      onClick={() => reject(req)}
                    >
                      Decline
                    </button>
                    <button
                      className="btn-primary px-3 py-1.5 text-xs"
                      disabled={busyId === req.id}
                      onClick={() => approve(req)}
                    >
                      {busyId === req.id ? '…' : 'Approve'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}
