import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroupData } from '../hooks/useGroupData'
import {
  computeNetBalances,
  formatMoney,
  simplifyDebts,
} from '../lib/balances'
import { CATEGORIES, categoryMeta } from '../lib/types'
import Avatar from '../components/Avatar'
import AddExpenseModal from '../components/AddExpenseModal'
import InviteModal from '../components/InviteModal'
import SettleUpModal from '../components/SettleUpModal'

type Tab = 'expenses' | 'balances'

export default function GroupDetail() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { group, members, expenses, settlements, requests, loading, error, reload } =
    useGroupData(groupId)

  const [tab, setTab] = useState<Tab>('expenses')
  const [showExpense, setShowExpense] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const net = useMemo(
    () => computeNetBalances(expenses, settlements),
    [expenses, settlements],
  )
  const debts = useMemo(() => simplifyDebts(net), [net])
  const myBalance = net[uid] ?? 0

  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id)
    if (!m) return 'Someone'
    return m.id === uid ? 'You' : m.full_name || m.email
  }

  const filteredExpenses = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter],
  )

  if (loading) return <p className="text-gray-400">Loading group…</p>
  if (error) return <p className="text-rose-600">{error}</p>
  if (!group) return <p className="text-gray-500">Group not found.</p>

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-600">
        ← All groups
      </Link>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">
            {group.emoji}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <button
              className="text-sm text-gray-400 hover:text-gray-600"
              onClick={() => setShowInvite(true)}
            >
              {members.length} member{members.length === 1 ? '' : 's'} · invite
              {requests.length > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {requests.length} pending
                </span>
              )}
            </button>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowExpense(true)}>
          + Expense
        </button>
      </div>

      {/* Your balance summary */}
      <div className="card mb-5 flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">Your balance</div>
          <div
            className={`text-2xl font-bold ${
              myBalance > 0.009
                ? 'text-brand-600'
                : myBalance < -0.009
                  ? 'text-rose-600'
                  : 'text-gray-700'
            }`}
          >
            {myBalance > 0.009 && '+'}
            {formatMoney(myBalance)}
          </div>
          <div className="text-xs text-gray-400">
            {myBalance > 0.009
              ? 'you are owed overall'
              : myBalance < -0.009
                ? 'you owe overall'
                : 'you are all settled'}
          </div>
        </div>
        <button className="btn-secondary" onClick={() => setShowSettle(true)}>
          Settle up
        </button>
      </div>

      {/* Member avatars */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Avatar name={m.full_name || m.email} seed={m.id} size={28} />
            <span className="text-sm text-gray-600">{m.id === uid ? 'You' : m.full_name || m.email}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium">
        {(['expenses', 'balances'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 capitalize transition ${
              tab === t ? 'bg-white shadow-sm' : 'text-gray-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'expenses' && (
        <div>
          {/* Category filter */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>
                {c.emoji} {c.label}
              </Chip>
            ))}
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">
              No expenses {filter !== 'all' ? 'in this category ' : ''}yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredExpenses.map((e) => {
                const meta = categoryMeta(e.category)
                const yourShare =
                  e.splits?.find((s) => s.profile_id === uid)?.amount ?? 0
                return (
                  <li key={e.id} className="card flex items-center gap-3 p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-lg">
                      {meta.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{e.description}</div>
                      <div className="text-xs text-gray-400">
                        {nameOf(e.paid_by)} paid {formatMoney(Number(e.amount))} ·{' '}
                        {new Date(e.spent_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">your share</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatMoney(yourShare)}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'balances' && (
        <div className="space-y-2">
          {members.map((m) => {
            const bal = net[m.id] ?? 0
            return (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <Avatar name={m.full_name || m.email} seed={m.id} size={36} />
                <span className="flex-1 text-sm font-medium">
                  {m.id === uid ? 'You' : m.full_name || m.email}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    bal > 0.009
                      ? 'text-brand-600'
                      : bal < -0.009
                        ? 'text-rose-600'
                        : 'text-gray-400'
                  }`}
                >
                  {bal > 0.009 ? `gets back ${formatMoney(bal)}` : null}
                  {bal < -0.009 ? `owes ${formatMoney(-bal)}` : null}
                  {Math.abs(bal) <= 0.009 ? 'settled' : null}
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
                    <span className="ml-auto font-semibold text-brand-600">
                      {formatMoney(d.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <AddExpenseModal
        open={showExpense}
        onClose={() => setShowExpense(false)}
        groupId={group.id}
        members={members}
        currentUserId={uid}
        onSaved={reload}
      />
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        groupId={group.id}
        requests={requests}
        onChanged={reload}
      />
      <SettleUpModal
        open={showSettle}
        onClose={() => setShowSettle(false)}
        groupId={group.id}
        debts={debts}
        members={members}
        currentUserId={uid}
        onSettled={reload}
      />
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
