import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

export default function Layout() {
  const { user, signOut } = useAuth()
  const name = (user?.user_metadata?.full_name as string) || user?.email || 'You'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-600">
            <span className="text-xl">💸</span> SplitUp
          </Link>
          <Link to="/activity" className="text-sm text-gray-500 hover:text-gray-800">Activity</Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{name}</div>
              <div className="text-xs text-gray-400">{user?.email}</div>
            </div>
            <Avatar name={name} seed={user?.id} size={34} />
            <button className="btn-ghost px-2 py-1 text-sm" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
