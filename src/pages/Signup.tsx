import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandMark from '../components/BrandMark'

export default function Signup() {
  const { user, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifySent, setVerifySent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={redirect} replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error, data } = await signUp(email, password, fullName)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    // When confirmations are on and the email is already registered, Supabase
    // returns a user with an empty `identities` array (and no session).
    const alreadyRegistered = !!data?.user && data.user.identities?.length === 0
    if (alreadyRegistered) {
      setError('This email is already registered. Log in instead.')
      return
    }
    // No session back means the email must be confirmed before signing in.
    const needsConfirmation = !data?.session
    if (needsConfirmation) {
      setVerifySent(true)
      return
    }
    // Confirmations off → session is live, go straight in.
    navigate(redirect)
  }

  if (verifySent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl dark:bg-brand-500/20">
            ✅
          </div>
          <h1 className="mt-4 text-xl font-bold">Verify your email</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            We sent a confirmation link to <span className="font-medium">{email}</span>. Click it,
            then come back and sign in.
          </p>
          <Link
            to={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="btn-primary mt-5 inline-block w-full"
          >
            Go to login
          </Link>
          <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">
            Didn&apos;t get it? Check your spam folder.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <BrandMark />
          <h1 className="mt-3 text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Start splitting expenses</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              required
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ronit Kundnani"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
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
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link
            to={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-medium text-brand-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
