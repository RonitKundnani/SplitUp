import { useState } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { formatMoney, type Debt } from '../lib/balances'
import type { Profile } from '../lib/types'

export default function SettleUpModal({
  open,
  onClose,
  groupId,
  debts,
  members,
  currentUserId,
  currency,
  onSettled,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  debts: Debt[]
  members: Profile[]
  currentUserId: string
  currency: string
  onSettled: () => void
}) {
  const fmt = (n: number) => formatMoney(n, currency)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id)
    if (!m) return 'Someone'
    return m.id === currentUserId ? 'You' : m.full_name || m.email
  }

  async function record(debt: Debt, key: string) {
    setBusyId(key)
    setError(null)
    const { error } = await supabase.from('settlements').insert({
      group_id: groupId,
      from_profile: debt.from,
      to_profile: debt.to,
      amount: debt.amount,
    })
    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    onSettled()
  }

  return (
    <Modal open={open} onClose={onClose} title="Settle up">
      {debts.length === 0 ? (
        <div className="py-6 text-center">
          <div className="text-3xl">🎉</div>
          <p className="mt-2 font-medium">All settled up!</p>
          <p className="text-sm text-gray-500">No outstanding balances in this group.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            The simplest set of payments to clear all balances. Tap a row once the payment has been
            made to record it.
          </p>
          {debts.map((debt, i) => {
            const key = `${debt.from}-${debt.to}-${i}`
            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
              >
                <Avatar name={nameOf(debt.from)} seed={debt.from} size={32} />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{nameOf(debt.from)}</span>
                  <span className="text-gray-400"> pays </span>
                  <span className="font-medium">{nameOf(debt.to)}</span>
                  <div className="font-semibold text-brand-600">{fmt(debt.amount)}</div>
                </div>
                <button
                  className="btn-secondary px-3 py-1.5 text-xs"
                  disabled={busyId === key}
                  onClick={() => record(debt, key)}
                >
                  {busyId === key ? 'Recording…' : 'Mark paid'}
                </button>
              </div>
            )
          })}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
