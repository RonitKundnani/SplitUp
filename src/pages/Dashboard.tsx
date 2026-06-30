import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroups } from '../hooks/useGroups'
import CreateGroupModal from '../components/CreateGroupModal'

export default function Dashboard() {
  const { groups, loading, error, createGroup } = useGroups()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your groups</h1>
          <p className="text-sm text-gray-500">Shared expenses, split fairly.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + New group
        </button>
      </div>

      {loading && <p className="text-gray-400">Loading groups…</p>}
      {error && <p className="text-rose-600">{error}</p>}

      {!loading && groups.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <div className="text-4xl">🫙</div>
          <p className="font-medium">No groups yet</p>
          <p className="max-w-xs text-sm text-gray-500">
            Create a group for your roommates, a trip, or a project to start tracking shared
            expenses.
          </p>
          <button className="btn-primary" onClick={() => setOpen(true)}>
            Create your first group
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <Link
            key={g.id}
            to={`/groups/${g.id}`}
            className="card flex items-center gap-4 p-4 transition hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">
              {g.emoji}
            </span>
            <div>
              <div className="font-semibold">{g.name}</div>
              <div className="text-xs text-gray-400">
                Created {new Date(g.created_at).toLocaleDateString()}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <CreateGroupModal open={open} onClose={() => setOpen(false)} onCreate={createGroup} />
    </div>
  )
}
