'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import {
  useIsAdmin,
  useFactoryOverview,
  usePauseFactory,
  useSetPlatformFee,
  useSetFeeRecipient,
  useSetMaxDuration,
  useCampaignControls,
  useRoleManagement,
} from '@/hooks/useAdmin'
import { AddressChip, TxFeedback, Spinner, ConnectButton } from '@/components/ui'
import { fmtEth, fmtFeeBps } from '@/lib/utils'
import { ADDRESSES } from '@/lib/constants'
import { type Abi } from 'viem'

// ─── Reusable admin block wrapper ─────────────────────────────────────────────
function AdminBlock({
  title,
  badge,
  children,
}: {
  title: string
  badge?: { label: string; ok: boolean }
  children: React.ReactNode
}) {
  return (
    <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/30 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
          {title}
        </h2>
        {badge && (
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              badge.ok
                ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5'
                : 'text-rose-400 border-rose-500/25 bg-rose-500/5'
            }`}
          >
            {badge.label}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Reusable input + button row ─────────────────────────────────────────────
function InputAction({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  btnLabel,
  btnClass = 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600',
  disabled,
  type = 'text',
  min,
  max,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  btnLabel: string
  btnClass?: string
  disabled?: boolean
  type?: string
  min?: string
  max?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                     text-xs font-mono text-zinc-300 placeholder-zinc-600
                     focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value}
          className={`px-4 py-2 text-xs font-mono font-semibold rounded
                      transition-colors disabled:opacity-40 whitespace-nowrap ${btnClass}`}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { address } = useAccount()
  const { isOperator, isDefaultAdmin, hasAnyRole } = useIsAdmin(address)
  const { data: overview, refetch: refetchOverview } = useFactoryOverview()

  const pauseFactory    = usePauseFactory()
  const setFeeHook      = useSetPlatformFee()
  const setRecipient    = useSetFeeRecipient()
  const setDuration     = useSetMaxDuration()
  const campaignCtrl    = useCampaignControls()
  const roleHook        = useRoleManagement()

  // Local form state
  const [newFee, setNewFee]               = useState('')
  const [newRecipient, setNewRecipient]   = useState('')
  const [newDuration, setNewDuration]     = useState('')
  const [campaignAddr, setCampaignAddr]   = useState('')
  const [roleAddr, setRoleAddr]           = useState('')

  // Parse overview data
  const isPaused       = overview?.[0]?.result as boolean | undefined
  const campaignCount  = overview?.[1]?.result as bigint | undefined
  const feeBps         = overview?.[2]?.result as number | undefined
  const feeRecipient   = overview?.[3]?.result as `0x${string}` | undefined
  const maxDays        = overview?.[4]?.result as number | undefined
  const totalSupply    = overview?.[5]?.result as bigint | undefined

  // ── Not connected ────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-6 opacity-20">⚙</div>
        <h2 className="font-display italic text-2xl text-zinc-400 mb-4">Admin Panel</h2>
        <p className="text-sm font-mono text-zinc-600 mb-8">Connect your wallet to access admin functions.</p>
        <ConnectButton />
      </div>
    )
  }

  // ── No access ────────────────────────────────────────────────────────────
  if (!hasAnyRole) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-6 opacity-20">🔒</div>
        <h2 className="font-display italic text-2xl text-zinc-400 mb-3">Access Denied</h2>
        <p className="text-xs font-mono text-zinc-600">
          Your address does not have <span className="text-zinc-400">OPERATOR_ROLE</span> or{' '}
          <span className="text-zinc-400">DEFAULT_ADMIN_ROLE</span> on the factory contract.
        </p>
        <div className="mt-6 p-3 rounded border border-zinc-800 inline-block">
          <AddressChip address={address} chars={8} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="font-display italic text-3xl text-zinc-100">Admin Panel</h1>
          <div className="flex gap-2">
            {isOperator && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border
                               text-amber-400 border-amber-500/25 bg-amber-500/5">
                OPERATOR
              </span>
            )}
            {isDefaultAdmin && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border
                               text-violet-400 border-violet-500/25 bg-violet-500/5">
                DEFAULT_ADMIN
              </span>
            )}
          </div>
        </div>
        <p className="text-xs font-mono text-zinc-500">
          Direct contract management — changes are on-chain and irreversible.
        </p>
      </div>

      {/* Contract addresses */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {[
          { label: 'Factory',   addr: ADDRESSES.factory   },
          { label: 'FundToken', addr: ADDRESSES.fundToken  },
          { label: 'Governor',  addr: ADDRESSES.governor   },
          { label: 'Timelock',  addr: ADDRESSES.timelock   },
        ].map(({ label, addr }) => (
          <div key={label} className="p-3 rounded border border-zinc-800 bg-zinc-900/20">
            <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
            <AddressChip address={addr} chars={4} />
          </div>
        ))}
      </div>

      <div className="space-y-5">

        {/* ── Block 1: Factory Status ── */}
        <AdminBlock
          title="Factory Status"
          badge={isPaused !== undefined
            ? { label: isPaused ? 'PAUSED' : 'ACTIVE', ok: !isPaused }
            : undefined
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Campaigns', value: campaignCount?.toString() ?? '—' },
              { label: 'Platform Fee',    value: feeBps !== undefined ? fmtFeeBps(feeBps) : '—' },
              { label: 'Max Duration',    value: maxDays ? `${maxDays} days` : '—' },
              { label: 'FUND Supply',     value: totalSupply ? `${fmtEth(totalSupply, 2)}` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded bg-zinc-800/40">
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
                <div className="text-sm font-mono font-semibold text-zinc-200">{value}</div>
              </div>
            ))}
          </div>

          {feeRecipient && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Fee Recipient:</span>
              <AddressChip address={feeRecipient} chars={8} />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => isPaused ? pauseFactory.unpause() : pauseFactory.pause()}
              disabled={pauseFactory.isPending || pauseFactory.isConfirming || isPaused === undefined}
              className={`px-4 py-2 text-xs font-mono font-semibold rounded
                          transition-colors disabled:opacity-40 flex items-center gap-2
                          ${isPaused
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-rose-600 text-white hover:bg-rose-500'}`}
            >
              {(pauseFactory.isPending || pauseFactory.isConfirming) && <Spinner />}
              {isPaused ? 'Unpause Factory' : 'Pause Factory'}
            </button>
          </div>

          <TxFeedback
            hash={pauseFactory.hash}
            isPending={pauseFactory.isPending}
            isConfirming={pauseFactory.isConfirming}
            isSuccess={pauseFactory.isSuccess}
            error={pauseFactory.error}
            successMessage={isPaused ? 'Factory unpaused!' : 'Factory paused!'}
          />
        </AdminBlock>

        {/* ── Block 2: Fee Settings ── */}
        <AdminBlock title="Fee Settings">
          <InputAction
            label="Platform Fee (basis points — max 1000 = 10%)"
            placeholder={feeBps !== undefined ? `Current: ${feeBps} bps (${fmtFeeBps(feeBps)})` : '250'}
            value={newFee}
            onChange={setNewFee}
            onSubmit={() => { setFeeHook.setFee(Number(newFee)); setNewFee('') }}
            btnLabel="Set Fee"
            disabled={setFeeHook.isPending || setFeeHook.isConfirming}
            type="number"
            min="0"
            max="1000"
          />
          <TxFeedback
            hash={setFeeHook.hash}
            isPending={setFeeHook.isPending}
            isConfirming={setFeeHook.isConfirming}
            isSuccess={setFeeHook.isSuccess}
            error={setFeeHook.error}
            successMessage="Platform fee updated!"
          />

          <InputAction
            label="Fee Recipient Address"
            placeholder={feeRecipient ?? '0x...'}
            value={newRecipient}
            onChange={setNewRecipient}
            onSubmit={() => { setRecipient.setRecipient(newRecipient as `0x${string}`); setNewRecipient('') }}
            btnLabel="Set Recipient"
            disabled={setRecipient.isPending || setRecipient.isConfirming}
          />
          <TxFeedback
            hash={setRecipient.hash}
            isPending={setRecipient.isPending}
            isConfirming={setRecipient.isConfirming}
            isSuccess={setRecipient.isSuccess}
            error={setRecipient.error}
            successMessage="Fee recipient updated!"
          />

          <InputAction
            label={`Max Campaign Duration (days — current: ${maxDays ?? '—'})`}
            placeholder="365"
            value={newDuration}
            onChange={setNewDuration}
            onSubmit={() => { setDuration.setDuration(Number(newDuration)); setNewDuration('') }}
            btnLabel="Set Duration"
            disabled={setDuration.isPending || setDuration.isConfirming}
            type="number"
            min="1"
          />
          <TxFeedback
            hash={setDuration.hash}
            isPending={setDuration.isPending}
            isConfirming={setDuration.isConfirming}
            isSuccess={setDuration.isSuccess}
            error={setDuration.error}
            successMessage="Max duration updated!"
          />
        </AdminBlock>

        {/* ── Block 3: Campaign Management ── */}
        <AdminBlock title="Campaign Management">
          <div>
            <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
              Campaign Address
            </label>
            <input
              value={campaignAddr}
              onChange={(e) => setCampaignAddr(e.target.value)}
              placeholder="0x..."
              className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                         text-xs font-mono text-zinc-300 placeholder-zinc-600
                         focus:outline-none focus:border-amber-500/50 transition-colors mb-3"
            />
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: 'Pause',
                  fn: () => campaignCtrl.pauseCampaign(campaignAddr as `0x${string}`),
                  cls: 'border border-amber-500/40 text-amber-400 hover:bg-amber-500/10',
                },
                {
                  label: 'Unpause',
                  fn: () => campaignCtrl.unpauseCampaign(campaignAddr as `0x${string}`),
                  cls: 'border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10',
                },
                {
                  label: 'Cancel Campaign',
                  fn: () => campaignCtrl.cancelCampaign(campaignAddr as `0x${string}`),
                  cls: 'bg-rose-600 text-white hover:bg-rose-500',
                },
                {
                  label: 'Revoke Token Roles',
                  fn: () => campaignCtrl.revokeTokenRoles(campaignAddr as `0x${string}`),
                  cls: 'border border-zinc-600 text-zinc-400 hover:bg-zinc-700',
                },
              ].map(({ label, fn, cls }) => (
                <button
                  key={label}
                  onClick={fn}
                  disabled={campaignCtrl.isPending || campaignCtrl.isConfirming || !campaignAddr}
                  className={`px-4 py-2 text-xs font-mono font-semibold rounded
                              transition-colors disabled:opacity-40 flex items-center gap-2 ${cls}`}
                >
                  {(campaignCtrl.isPending || campaignCtrl.isConfirming) && <Spinner />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1 p-3 rounded bg-zinc-800/30 border border-zinc-800">
            <p className="text-[10px] font-mono text-zinc-600 leading-relaxed">
              <span className="text-zinc-500 font-semibold">Cancel</span> — transitions campaign to CANCELLED,
              contributors can refund.{' '}
              <span className="text-zinc-500 font-semibold">Revoke Token Roles</span> — removes MINTER+BURNER
              from campaign (use after finalization if not done automatically).
            </p>
          </div>

          <TxFeedback
            hash={campaignCtrl.hash}
            isPending={campaignCtrl.isPending}
            isConfirming={campaignCtrl.isConfirming}
            isSuccess={campaignCtrl.isSuccess}
            error={campaignCtrl.error}
            successMessage="Campaign action confirmed!"
          />
        </AdminBlock>

        {/* ── Block 4: Role Management (admin only) ── */}
        {isDefaultAdmin && (
          <AdminBlock title="Role Management">
            <div>
              <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
                Wallet Address
              </label>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={roleAddr}
                  onChange={(e) => setRoleAddr(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                             text-xs font-mono text-zinc-300 placeholder-zinc-600 min-w-0
                             focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <button
                  onClick={() => roleHook.grantOperator(roleAddr as `0x${string}`)}
                  disabled={roleHook.isPending || roleHook.isConfirming || !roleAddr}
                  className="px-3 py-2 text-xs font-mono font-semibold rounded
                             bg-emerald-600 text-white hover:bg-emerald-500
                             disabled:opacity-40 transition-colors flex items-center gap-2"
                >
                  {(roleHook.isPending || roleHook.isConfirming) && <Spinner />}
                  Grant Operator
                </button>
                <button
                  onClick={() => roleHook.revokeOperator(roleAddr as `0x${string}`)}
                  disabled={roleHook.isPending || roleHook.isConfirming || !roleAddr}
                  className="px-3 py-2 text-xs font-mono font-semibold rounded
                             bg-rose-600 text-white hover:bg-rose-500
                             disabled:opacity-40 transition-colors flex items-center gap-2"
                >
                  Revoke Operator
                </button>
              </div>
            </div>

            <div className="p-3 rounded bg-zinc-800/30 border border-zinc-800">
              <p className="text-[10px] font-mono text-zinc-600 leading-relaxed">
                <span className="text-zinc-500 font-semibold">OPERATOR_ROLE</span> —
                can pause/cancel campaigns, update fee settings.{' '}
                <span className="text-amber-500/70">Only DEFAULT_ADMIN can grant/revoke roles.</span>
              </p>
            </div>

            <TxFeedback
              hash={roleHook.hash}
              isPending={roleHook.isPending}
              isConfirming={roleHook.isConfirming}
              isSuccess={roleHook.isSuccess}
              error={roleHook.error}
              successMessage="Role updated!"
            />
          </AdminBlock>
        )}

        {/* ── Block 5: Danger Zone ── */}
        {isDefaultAdmin && (
          <AdminBlock title="Danger Zone">
            <div className="p-3 rounded border border-rose-500/20 bg-rose-500/5">
              <p className="text-xs font-mono text-rose-400/80 mb-3">
                ⚠ The actions below permanently affect protocol governance. Only proceed if you understand the implications.
              </p>
              <p className="text-[10px] font-mono text-zinc-600 leading-relaxed">
                To renounce deployer roles and fully decentralize, call via CLI:
              </p>
              <div className="mt-2 space-y-1">
                {[
                  `cast send ${ADDRESSES.factory} "renounceRole(bytes32,address)" 0x0000...0000 <YOUR_ADDRESS> --account <WALLET>`,
                  `cast send ${ADDRESSES.fundToken} "renounceRole(bytes32,address)" 0x0000...0000 <YOUR_ADDRESS> --account <WALLET>`,
                ].map((cmd, i) => (
                  <code key={i} className="block text-[10px] font-mono text-zinc-500 bg-zinc-800/60
                                           border border-zinc-700 rounded px-2 py-1.5 break-all">
                    {cmd}
                  </code>
                ))}
              </div>
            </div>
          </AdminBlock>
        )}

      </div>
    </div>
  )
}