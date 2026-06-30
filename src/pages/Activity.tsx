import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useActivity } from '../hooks/useActivity'
import { formatMoney } from '../lib/balances'
import { timeAgo } from '../lib/types'
import Avatar from '../components/Avatar'

export default function Activity() {
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { items, loading } = useActivity(uid)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-gray-500">Everything that happened across your groups</p>
      </div>

      {loading && <p className="text-gray-400">Loading activity…</p>}

      {!loading && items.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-3xl">📭</div>
          <p className="mt-2 font-medium text-gray-600">No activity yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Add an expense or settle up to see activity here.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={`/groups/${item.group_id}`}
              className="card flex items-start gap-3 p-3 transition hover:shadow-md"
            >
              {/* Group emoji bubble */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg">
                {item.group_emoji}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{item.actor_name}</span>{' '}
                    <span className="text-gray-600">{item.description}</span>
                  </p>
                  {item.amount !== undefined && item.type === 'expense_added' && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-700">
                      {formatMoney(item.amount, item.currency)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="truncate">{item.group_name}</span>
                  <span>·</span>
                  <span className="shrink-0">{timeAgo(item.created_at)}</span>
                </div>
              </div>

              <Avatar name={item.actor_name} seed={item.actor_id} size={28} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
