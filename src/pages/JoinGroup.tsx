import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface InviteInfo {
  group_id: string
  group_name: string
  group_emoji: string
  member_count: number
}

type Status = 'loading' | 'invalid' | 'ready' | 'member' | 'requested' | 'submitting' | 'done'

export default function JoinGroup() {
  const { token } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  const resolve = useCallback(async () => {
    if (!token) return
    setStatus('loading')

    const { data, error } = await supabase.rpc('resolve_invite', { invite_token: token })
    const invite = (data as InviteInfo[] | null)?.[0]
    if (error || !invite) {
      setStatus('invalid')
      return
    }
    setInfo(invite)

    // Already a member? (RLS lets you see your own membership row.)
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', invite.group_id)
      .eq('profile_id', user?.id ?? '')
      .maybeSingle()
    if (membership) {
      setStatus('member')
      return
    }

    // Already requested?
    const { data: existing } = await supabase
      .from('join_requests')
      .select('status')
      .eq('group_id', invite.group_id)
      .eq('profile_id', user?.id ?? '')
      .maybeSingle()
    if (existing?.status === 'pending') {
      setStatus('requested')
      return
    }

    setStatus('ready')
  }, [token, user?.id])

  useEffect(() => {
    resolve()
  }, [resolve])

  async function requestToJoin() {
    if (!info || !user) return
    setStatus('submitting')
    setError(null)
    // Upsert tolerates a previously rejected request for the same group.
    const { error } = await supabase
      .from('join_requests')
      .upsert(
        { group_id: info.group_id, profile_id: user.id, status: 'pending' },
        { onConflict: 'group_id,profile_id' },
      )
    if (error) {
      setStatus('ready')
      setError(error.message)
      return
    }
    setStatus('done')
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        {status === 'loading' && <p className="text-gray-400">Checking invite…</p>}

        {status === 'invalid' && (
          <>
            <div className="text-4xl">🔗</div>
            <h1 className="mt-2 text-xl font-bold">Invite not found</h1>
            <p className="mt-1 text-sm text-gray-500">
              This link is invalid or has been removed. Ask for a fresh one.
            </p>
            <Link to="/" className="btn-secondary mt-4">
              Go home
            </Link>
          </>
        )}

        {info && status !== 'invalid' && status !== 'loading' && (
          <>
            <div className="text-4xl">{info.group_emoji}</div>
            <h1 className="mt-2 text-xl font-bold">{info.group_name}</h1>
            <p className="text-sm text-gray-400">
              {info.member_count} member{info.member_count === 1 ? '' : 's'}
            </p>

            {status === 'member' && (
              <>
                <p className="mt-4 text-sm text-brand-600">You&apos;re already in this group.</p>
                <button
                  className="btn-primary mt-3 w-full"
                  onClick={() => navigate(`/groups/${info.group_id}`)}
                >
                  Open group
                </button>
              </>
            )}

            {status === 'requested' && (
              <>
                <p className="mt-4 text-sm text-gray-600">
                  Your request to join is pending. You&apos;ll get in once a member approves it.
                </p>
                <Link to="/" className="btn-secondary mt-3 inline-block">
                  Back to your groups
                </Link>
              </>
            )}

            {(status === 'ready' || status === 'submitting') && (
              <>
                <p className="mt-4 text-sm text-gray-600">
                  Request to join this group. A current member will approve you.
                </p>
                <button
                  className="btn-primary mt-3 w-full"
                  onClick={requestToJoin}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Sending…' : 'Request to join'}
                </button>
              </>
            )}

            {status === 'done' && (
              <>
                <div className="mt-4 text-2xl">✅</div>
                <p className="mt-1 text-sm text-gray-600">
                  Request sent! You&apos;ll see the group here once a member approves it.
                </p>
                <Link to="/" className="btn-secondary mt-3 inline-block">
                  Back to your groups
                </Link>
              </>
            )}

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
