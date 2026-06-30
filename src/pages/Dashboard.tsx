import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../hooks/useGroups'
import CreateGroupModal from '../components/CreateGroupModal'
import AddFriendModal from '../components/AddFriendModal'
import type { Group } from '../lib/types'

type Tab = 'groups' | 'friends'

function GroupCard({ g }: { g: Group }) {
  return (
    <Link
      to={`/groups/${g.id}`}
      className="card flex items-center gap-4 p-4 transition hover:shadow-md"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">
        {g.emoji}
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold">{g.name}</div>
        <div className="text-xs text-gray-400">
          {g.currency} · {new Date(g.created_at).toLocaleDateString()}
        </div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { groups, loading, error, createGroup, createPersonalGroup } = useGroups()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'groups')
  const [showGroup, setShowGroup] = useState(false)
  const [showFriend, setShowFriend] = useState(false)

  const realGroups = useMemo(() => groups.filter((g) => g.type === 'group'), [groups])
  const personalGroups = useMemo(() => groups.filter((g) => g.type === 'personal'), [groups])

  const uid = user?.id ?? ''

  return (
    <div>
      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1 text-sm font-medium">
        {(['groups', 'friends'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 capitalize transition ${
              tab === t ? 'bg-white shadow-sm' : 'text-gray-500'
            }`}
          >
            {t === 'groups' ? `💸 Groups` : `👤 Friends`}
          </button>
        ))}
      </div>

      {tab === 'groups' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Your groups</h1>
              <p className="text-sm text-gray-500">Multi-person shared expenses</p>
            </div>
            <button className="btn-primary" onClick={() => setShowGroup(true)}>
              + New group
            </button>
          </div>

          {loading && <p className="text-gray-400">Loading…</p>}
          {error && <p className="text-rose-600">{error}</p>}

          {!loading && realGroups.length === 0 && (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <div className="text-4xl">🫙</div>
              <p className="font-medium">No groups yet</p>
              <p className="max-w-xs text-sm text-gray-500">
                Create a group for roommates, a trip, or any shared situation.
              </p>
              <button className="btn-primary" onClick={() => setShowGroup(true)}>
                Create your first group
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {realGroups.map((g) => <GroupCard key={g.id} g={g} />)}
          </div>
        </div>
      )}

      {tab === 'friends' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Friends</h1>
              <p className="text-sm text-gray-500">1-on-1 personal expenses</p>
            </div>
            <button className="btn-primary" onClick={() => setShowFriend(true)}>
              + Add friend
            </button>
          </div>

          {loading && <p className="text-gray-400">Loading…</p>}

          {!loading && personalGroups.length === 0 && (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <div className="text-4xl">🤝</div>
              <p className="font-medium">No friends added yet</p>
              <p className="max-w-xs text-sm text-gray-500">
                Add a friend to track personal lending, shared meals, or anything between just two
                people.
              </p>
              <button className="btn-primary" onClick={() => setShowFriend(true)}>
                Add your first friend
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {personalGroups.map((g) => {
              const isOwn = g.created_by === uid
              return (
                <Link
                  key={g.id}
                  to={`/groups/${g.id}`}
                  className="card flex items-center gap-4 p-4 transition hover:shadow-md"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xl">
                    👤
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{g.name}</div>
                    <div className="text-xs text-gray-400">
                      {isOwn ? 'Added by you' : 'Added by them'} · {g.currency}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <CreateGroupModal
        open={showGroup}
        onClose={() => setShowGroup(false)}
        onCreate={createGroup}
      />
      <AddFriendModal
        open={showFriend}
        onClose={() => setShowFriend(false)}
        onAdd={createPersonalGroup}
      />
    </div>
  )
}
