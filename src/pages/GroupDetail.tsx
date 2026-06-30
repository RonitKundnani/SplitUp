import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroupData } from '../hooks/useGroupData'
import { useRecurring } from '../hooks/useRecurring'
import { computeNetBalances, formatMoney, simplifyDebts } from '../lib/balances'
import { CATEGORIES, categoryMeta, type Expense, timeAgo } from '../lib/types'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import AddExpenseModal from '../components/AddExpenseModal'
import EditExpenseModal from '../components/EditExpenseModal'
import InviteModal from '../components/InviteModal'
import SettleUpModal from '../components/SettleUpModal'
import AddRecurringModal from '../components/AddRecurringModal'

type Tab = 'expenses' | 'balances' | 'insights' | 'recurring'

export default function GroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { group, members, expenses, settlements, requests, loading, error, reload } =
    useGroupData(groupId)

  const { recurring, fireOverdue, addRecurring, toggleActive, deleteRecurring } = useRecurring(
    groupId,
    uid,
    reload,
  )

  const [tab, setTab] = useState<Tab>('expenses')
  const [showExpense, setShowExpense] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const net = useMemo(() => computeNetBalances(expenses, settlements), [expenses, settlements])
  const debts = useMemo(() => simplifyDebts(net), [net])
  const myBalance = net[uid] ?? 0

  // Auto-fire overdue recurring expenses once members load.
  useEffect(() => {
    if (members.length > 0) fireOverdue(members.map((m) => m.id))
  }, [members, fireOverdue])

  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id)
    if (!m) return 'Someone'
    return m.id === uid ? 'You' : m.full_name || m.email
  }

  const filteredExpenses = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter],
  )

  // ── Insights helpers ──────────────────────────────────────────────────────
  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses])
  const myShare = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.splits?.find((sp) => sp.profile_id === uid)?.amount) || 0), 0),
    [expenses, uid],
  )

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) map[e.category] = (map[e.category] ?? 0) + Number(e.amount)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [expenses])

  const byMonth = useMemo(() => {
    const map: Record<string, number> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      map[d.toLocaleString('default', { month: 'short', year: '2-digit' })] = 0
    }
    for (const e of expenses) {
      const d = new Date(e.spent_at)
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
      if (key in map) map[key] = (map[key] ?? 0) + Number(e.amount)
    }
    return Object.entries(map)
  }, [expenses])

  const maxMonth = useMemo(() => Math.max(...byMonth.map(([, v]) => v), 1), [byMonth])
  const maxCat = useMemo(() => Math.max(...byCategory.map(([, v]) => v), 1), [byCategory])

  // ── Leave group ───────────────────────────────────────────────────────────
  async function leaveGroup() {
    if (Math.abs(myBalance) > 0.01) {
      setLeaveError(`You need to settle up first. Your balance is ${formatMoney(myBalance, group!.currency)}.`)
      return
    }
    setLeaving(true)
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId!)
      .eq('profile_id', uid)
    setLeaving(false)
    if (error) { setLeaveError(error.message); return }
    navigate('/')
  }

  if (loading) return <p className="text-gray-400">Loading group…</p>
  if (error) return <p className="text-rose-600">{error}</p>
  if (!group) return <p className="text-gray-500">Group not found.</p>

  const fmt = (n: number) => formatMoney(n, group.currency)

  return (
    <div>
      <Link
        to={group.type === 'personal' ? '/?tab=friends' : '/'}
        className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-600"
      >
        {group.type === 'personal' ? '← All friends' : '← All groups'}
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">
            {group.emoji}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            {group.type === 'personal' ? (
              <span className="text-sm text-gray-400">
                {members.length} member{members.length === 1 ? '' : 's'}
              </span>
            ) : (
              <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setShowInvite(true)}>
                {members.length} member{members.length === 1 ? '' : 's'} · invite
                {requests.length > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {requests.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowExpense(true)}>+ Expense</button>
      </div>

      {/* Balance card */}
      <div className="card mb-5 flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">Your balance</div>
          <div className={`text-2xl font-bold ${myBalance > 0.009 ? 'text-brand-600' : myBalance < -0.009 ? 'text-rose-600' : 'text-gray-700'}`}>
            {myBalance > 0.009 && '+'}{fmt(myBalance)}
          </div>
          <div className="text-xs text-gray-400">
            {myBalance > 0.009 ? 'you are owed' : myBalance < -0.009 ? 'you owe' : 'all settled'}
          </div>
        </div>
        <button className="btn-secondary" onClick={() => setShowSettle(true)}>Settle up</button>
      </div>

      {/* Members */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Avatar name={m.full_name || m.email} seed={m.id} size={28} />
            <span className="text-sm text-gray-600">{m.id === uid ? 'You' : m.full_name || m.email}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium">
        {(['expenses', 'balances', 'insights', 'recurring'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md py-2 capitalize transition ${tab === t ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
            {t === 'recurring' ? '🔁' : ''}{t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Expenses tab ── */}
      {tab === 'expenses' && (
        <div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>
                {c.emoji} {c.label}
              </Chip>
            ))}
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">
              No expenses{filter !== 'all' ? ' in this category' : ''} yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredExpenses.map((e) => {
                const meta = categoryMeta(e.category)
                const yourShare = Number(e.splits?.find((s) => s.profile_id === uid)?.amount ?? 0)
                const canEdit = e.created_by === uid
                return (
                  <li key={e.id} className="card flex items-center gap-3 p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-lg">
                      {meta.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{e.description}</div>
                      <div className="text-xs text-gray-400">
                        {nameOf(e.paid_by)} paid {fmt(Number(e.amount))} · {new Date(e.spent_at).toLocaleDateString()}
                        {' · '}{timeAgo(e.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">your share</div>
                      <div className="text-sm font-semibold tabular-nums">{fmt(yourShare)}</div>
                    </div>
                    {canEdit && (
                      <button className="btn-ghost shrink-0 px-2 py-1 text-xs text-gray-400 hover:text-gray-700"
                        onClick={() => setEditExpense(e)}>✏️</button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Balances tab ── */}
      {tab === 'balances' && (
        <div className="space-y-2">
          {members.map((m) => {
            const bal = net[m.id] ?? 0
            return (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <Avatar name={m.full_name || m.email} seed={m.id} size={36} />
                <span className="flex-1 text-sm font-medium">{m.id === uid ? 'You' : m.full_name || m.email}</span>
                <span className={`text-sm font-semibold tabular-nums ${bal > 0.009 ? 'text-brand-600' : bal < -0.009 ? 'text-rose-600' : 'text-gray-400'}`}>
                  {bal > 0.009 ? `gets back ${fmt(bal)}` : bal < -0.009 ? `owes ${fmt(-bal)}` : 'settled'}
                </span>
              </div>
            )
          })}

          <div className="card mt-4 p-4">
            <div className="mb-2 text-sm font-semibold">Suggested payments</div>
            {debts.length === 0 ? (
              <p className="text-sm text-gray-500">Everyone is settled up. 🎉</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {debts.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="font-medium">{nameOf(d.from)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium">{nameOf(d.to)}</span>
                    <span className="ml-auto font-semibold text-brand-600">{fmt(d.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Insights tab ── */}
      {tab === 'insights' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total spent" value={fmt(totalSpent)} />
            <StatCard label="Your share" value={fmt(myShare)} />
            <StatCard label="Expenses" value={String(expenses.length)} />
          </div>

          {/* Monthly trend */}
          <div className="card p-4">
            <div className="mb-3 text-sm font-semibold">Monthly spending (last 6 months)</div>
            {byMonth.every(([, v]) => v === 0) ? (
              <p className="text-sm text-gray-400">No data yet.</p>
            ) : (
              <div className="flex items-end gap-2">
                {byMonth.map(([label, val]) => (
                  <div key={label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm bg-brand-100" style={{ height: 80 }}>
                      <div
                        className="w-full rounded-t-sm bg-brand-500 transition-all"
                        style={{ height: `${(val / maxMonth) * 100}%`, marginTop: `${(1 - val / maxMonth) * 100}%` }}
                      />
                    </div>
                    <div className="text-center text-[10px] text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category breakdown */}
          <div className="card p-4">
            <div className="mb-3 text-sm font-semibold">By category</div>
            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-400">No expenses yet.</p>
            ) : (
              <div className="space-y-2">
                {byCategory.map(([key, val]) => {
                  const meta = categoryMeta(key)
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>{meta.emoji} {meta.label}</span>
                        <span className="font-medium tabular-nums">{fmt(val)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-brand-400 transition-all"
                          style={{ width: `${(val / maxCat) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Recurring tab ── */}
      {tab === 'recurring' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">Auto-added on schedule when you open the group.</p>
            <button className="btn-primary text-sm" onClick={() => setShowRecurring(true)}>+ Add</button>
          </div>

          {recurring.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl">🔁</div>
              <p className="mt-2 font-medium text-gray-600">No recurring expenses</p>
              <p className="mt-1 text-sm text-gray-400">Rent, subscriptions, utility bills…</p>
              <button className="btn-primary mt-3" onClick={() => setShowRecurring(true)}>Add one</button>
            </div>
          ) : (
            <ul className="space-y-2">
              {recurring.map((r) => (
                <li key={r.id} className="card flex items-center gap-3 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-lg">
                    {categoryMeta(r.category).emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.description}</div>
                    <div className="text-xs text-gray-400">
                      {fmt(Number(r.amount))} · {r.frequency} · next {new Date(r.next_due_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button className="btn-ghost px-2 py-1 text-xs text-gray-400"
                    onClick={() => toggleActive(r.id, !r.active)}>
                    {r.active ? 'Pause' : 'Resume'}
                  </button>
                  {r.created_by === uid && (
                    <button className="btn-ghost px-2 py-1 text-xs text-rose-500"
                      onClick={() => deleteRecurring(r.id)}>Del</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Leave group */}
      <div className="mt-10 border-t border-gray-100 pt-6">
        {leaveError && <p className="mb-2 text-sm text-rose-600">{leaveError}</p>}
        <button
          className="btn-ghost w-full text-rose-500 hover:bg-rose-50"
          onClick={leaveGroup}
          disabled={leaving}
        >
          {leaving ? 'Leaving…' : 'Leave group'}
        </button>
        {Math.abs(myBalance) > 0.01 && (
          <p className="mt-1 text-center text-xs text-gray-400">
            Settle your balance first before leaving.
          </p>
        )}
      </div>

      {/* Modals */}
      <AddExpenseModal open={showExpense} onClose={() => setShowExpense(false)}
        groupId={group.id} members={members} currentUserId={uid} currency={group.currency} onSaved={reload} />
      <EditExpenseModal open={!!editExpense} onClose={() => setEditExpense(null)}
        expense={editExpense} members={members} currentUserId={uid} currency={group.currency}
        onSaved={reload} onDeleted={reload} />
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)}
        groupId={group.id} requests={requests} onChanged={reload} />
      <SettleUpModal open={showSettle} onClose={() => setShowSettle(false)}
        groupId={group.id} debts={debts} members={members} currentUserId={uid} currency={group.currency} onSettled={reload} />
      <AddRecurringModal open={showRecurring} onClose={() => setShowRecurring(false)}
        groupId={group.id} members={members} currentUserId={uid} currency={group.currency} onAdd={addRecurring} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
      {children}
    </button>
  )
}
