import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BrandMark from '../components/BrandMark'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  // `detectSessionInUrl` is true on web, so opening the recovery link
  // establishes a temporary session and fires a PASSWORD_RECOVERY event.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // If Supabase already restored a session from the link, we're good.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/login'), 1500)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <BrandMark />
          <h1 className="mt-3 text-2xl font-bold">Set a new password</h1>
        </div>

        {done ? (
          <p className="text-center text-sm text-brand-600">
            Password updated! Redirecting to login…
          </p>
        ) : !ready ? (
          <p className="text-center text-sm text-gray-500 dark:text-slate-400">
            Open this page from the reset link in your email to continue.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
