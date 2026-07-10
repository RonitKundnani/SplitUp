import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, type Theme } from '../context/ThemeContext'
import Avatar from './Avatar'
import BrandMark from './BrandMark'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const opts: { key: Theme; icon: string; label: string }[] = [
    { key: 'light', icon: '☀️', label: 'Light' },
    { key: 'dark', icon: '🌙', label: 'Dark' },
    { key: 'system', icon: '💻', label: 'System' },
  ]
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-slate-800">
      {opts.map((o) => (
        <button
          key={o.key}
          title={o.label}
          onClick={() => setTheme(o.key)}
          className={`rounded-md px-2 py-1 text-sm transition ${
            theme === o.key
              ? 'bg-white shadow-sm dark:bg-slate-700'
              : 'text-gray-400 dark:text-slate-500'
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const name = (user?.user_metadata?.full_name as string) || user?.email || 'You'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-600">
            <BrandMark size={28} />
            <span className="hidden sm:inline">SplitUp</span>
          </Link>
          <Link
            to="/activity"
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Activity
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{name}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500">{user?.email}</div>
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
