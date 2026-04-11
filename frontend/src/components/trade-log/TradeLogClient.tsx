'use client'
import { useState, useCallback } from 'react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import type { TradePosition, TradePositionCreate } from '@/lib/api'

const today = () => new Date().toISOString().slice(0, 10)

function PnlBar({ pnl, tp, sl, entry }: { pnl: number | null; tp: number | null; sl: number | null; entry: number }) {
  if (pnl === null) return null
  const tpPct = tp ? (tp - entry) / entry * 100 : null
  const slPct = sl ? (sl - entry) / entry * 100 : null
  const color = pnl >= 0 ? '#3fb950' : '#f85149'
  return (
    <div className='flex flex-col gap-0.5 mt-1'>
      <div className='relative h-1.5 bg-[#30363d] rounded-full overflow-visible'>
        {slPct !== null && (
          <div
            className='absolute top-0 h-full w-0.5 bg-sell/70'
            style={{ left: `${Math.max(0, Math.min(100, 50 + slPct * 5))}%` }}
            title={`SL: ${slPct.toFixed(1)}%`}
          />
        )}
        {tpPct !== null && (
          <div
            className='absolute top-0 h-full w-0.5 bg-buy/70'
            style={{ left: `${Math.max(0, Math.min(100, 50 + tpPct * 5))}%` }}
            title={`TP: +${tpPct.toFixed(1)}%`}
          />
        )}
        <div
          className='absolute top-0 h-full w-1.5 rounded-full'
          style={{ left: `${Math.max(0, Math.min(98, 50 + pnl * 5))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function PositionRow({ pos, onClose, onDelete }: {
  pos: TradePosition
  onClose: (id: number, price: number) => void
  onDelete: (id: number) => void
}) {
  const pnl = pos.pnl_pct
  const pnlAmt = pos.pnl_amount
  const pnlColor = pnl === null ? '' : pnl >= 0 ? 'text-buy' : 'text-sell'
  const [closing, setClosing] = useState(false)
  const [closePrice, setClosePrice] = useState(String(pos.current_price ?? pos.entry_price))

  return (
    <tr className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors'>
      <td className='px-3 py-2.5 pl-4'>
        <p className='font-mono text-[11px] text-[#8b949e]'>{pos.ticker}</p>
        <p className='text-sm text-[#e6edf3]'>{pos.name}</p>
        <p className='text-[10px] text-[#8b949e]'>{pos.market}</p>
      </td>
      <td className='px-3 py-2.5 text-xs text-[#8b949e]'>{pos.entry_date}</td>
      <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3]'>
        {pos.entry_price.toLocaleString('ja-JP')}
      </td>
      <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3]'>
        {pos.shares}
      </td>
      <td className='px-3 py-2.5'>
        <p className='font-mono text-sm text-[#e6edf3]'>
          {pos.current_price?.toLocaleString('ja-JP') ?? '—'}
        </p>
        {pos.status === 'open' && (
          <PnlBar pnl={pnl} tp={pos.take_profit} sl={pos.stop_loss} entry={pos.entry_price} />
        )}
      </td>
      <td className={clsx('px-3 py-2.5 font-mono text-sm font-semibold', pnlColor)}>
        {pnl !== null ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%` : '—'}
        {pnlAmt !== null && (
          <p className='text-[10px] font-normal'>
            {pnlAmt >= 0 ? '+' : ''}{pnlAmt.toLocaleString('ja-JP')}
          </p>
        )}
      </td>
      <td className='px-3 py-2.5 text-xs text-[#8b949e]'>
        {pos.take_profit ? (
          <span className='text-buy'>{pos.take_profit.toLocaleString('ja-JP')}</span>
        ) : '—'}
        {' / '}
        {pos.stop_loss ? (
          <span className='text-sell'>{pos.stop_loss.toLocaleString('ja-JP')}</span>
        ) : '—'}
      </td>
      <td className='px-3 py-2.5 text-xs text-[#8b949e]'>
        <span className={clsx(
          'px-2 py-0.5 rounded text-xs font-medium',
          pos.status === 'open'
            ? 'bg-buy/10 text-buy border border-buy/30'
            : 'bg-[#30363d] text-[#8b949e] border border-dim'
        )}>
          {pos.status === 'open' ? 'オープン' : 'クローズ'}
        </span>
      </td>
      <td className='px-3 py-2.5'>
        <div className='flex gap-1'>
          {pos.status === 'open' && (
            <>
              {!closing ? (
                <button
                  onClick={() => setClosing(true)}
                  className='text-[10px] px-2 py-1 rounded bg-[#2d2a1a] text-hold border border-hold/30 hover:bg-hold/20 transition-colors'
                >
                  決済
                </button>
              ) : (
                <div className='flex items-center gap-1'>
                  <input
                    type='number'
                    value={closePrice}
                    onChange={e => setClosePrice(e.target.value)}
                    className='w-20 px-1.5 py-0.5 text-[10px] bg-[#0d1117] border border-dim rounded text-[#e6edf3] focus:outline-none focus:border-accent'
                  />
                  <button
                    onClick={() => {
                      const price = parseFloat(closePrice)
                      if (!isNaN(price) && price > 0) { onClose(pos.id, price); setClosing(false) }
                    }}
                    className='text-[10px] px-2 py-1 rounded bg-buy/20 text-buy border border-buy/30 hover:bg-buy/30 transition-colors'
                  >
                    確定
                  </button>
                  <button
                    onClick={() => setClosing(false)}
                    className='text-[10px] px-1.5 py-1 rounded text-[#8b949e] hover:text-[#e6edf3] transition-colors'
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
          <button
            onClick={() => onDelete(pos.id)}
            className='text-[10px] px-2 py-1 rounded bg-sell/10 text-sell border border-sell/30 hover:bg-sell/20 transition-colors'
          >
            削除
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState<Partial<TradePositionCreate>>({
    entry_date: today(),
    shares: 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof TradePositionCreate, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }))

  const submit = async () => {
    if (!form.ticker || !form.entry_price || !form.entry_date) {
      setError('銘柄・購入単価・購入日は必須です')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.addPosition(form as TradePositionCreate)
      setForm({ entry_date: today(), shares: 1 })
      onAdded()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const inp = 'input text-sm'
  const lbl = 'label text-xs'

  return (
    <div className='bg-card border border-dim rounded-lg p-4'>
      <h3 className='text-sm font-semibold text-[#e6edf3] mb-3'>新規ポジション追加</h3>
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'>
        <div>
          <label className={lbl}>銘柄コード *</label>
          <input
            className={inp}
            placeholder='7203.T / NVDA'
            value={form.ticker ?? ''}
            onChange={e => set('ticker', e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label className={lbl}>購入日 *</label>
          <input
            type='date'
            className={inp}
            value={form.entry_date ?? ''}
            onChange={e => set('entry_date', e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>購入単価 *</label>
          <input
            type='number'
            className={inp}
            placeholder='3500'
            value={form.entry_price ?? ''}
            onChange={e => set('entry_price', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>
        <div>
          <label className={lbl}>株数</label>
          <input
            type='number'
            className={inp}
            placeholder='100'
            value={form.shares ?? ''}
            onChange={e => set('shares', e.target.value ? parseFloat(e.target.value) : 1)}
          />
        </div>
        <div>
          <label className={lbl}>利確価格 (TP)</label>
          <input
            type='number'
            className={inp}
            placeholder='3850'
            value={form.take_profit ?? ''}
            onChange={e => set('take_profit', e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div>
          <label className={lbl}>損切価格 (SL)</label>
          <input
            type='number'
            className={inp}
            placeholder='3200'
            value={form.stop_loss ?? ''}
            onChange={e => set('stop_loss', e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
      </div>
      {error && <p className='text-sell text-xs mt-2'>{error}</p>}
      <div className='flex justify-end mt-3'>
        <button
          onClick={submit}
          disabled={loading}
          className='btn-primary text-sm px-4 py-2 disabled:opacity-50'
        >
          {loading ? '追加中...' : 'ポジション追加'}
        </button>
      </div>
    </div>
  )
}

export default function TradeLogClient({ initialPositions }: { initialPositions: TradePosition[] }) {
  const [positions, setPositions] = useState(initialPositions)
  const [tab, setTab] = useState<'open' | 'closed'>('open')
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const all = await api.getPositions()
      setPositions(all)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleClose = async (id: number, price: number) => {
    await api.updatePosition(id, { status: 'closed', exit_price: price, exit_date: today() })
    reload()
  }

  const handleDelete = async (id: number) => {
    await api.deletePosition(id)
    reload()
  }

  const filtered = positions.filter(p => p.status === tab)
  const openPnl = positions
    .filter(p => p.status === 'open' && p.pnl_amount !== null)
    .reduce((sum, p) => sum + (p.pnl_amount ?? 0), 0)

  return (
    <div className='flex flex-col gap-4 max-w-[1600px] mx-auto'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-[#e6edf3]'>Trade Log</h1>
          <p className='text-sm text-[#8b949e]'>ポジション管理・売買記録</p>
        </div>
        <div className='flex items-center gap-4'>
          {openPnl !== 0 && (
            <div className='text-right'>
              <p className='text-[10px] text-[#8b949e]'>含み損益合計</p>
              <p className={clsx('text-base font-mono font-bold', openPnl >= 0 ? 'text-buy' : 'text-sell')}>
                {openPnl >= 0 ? '+' : ''}{openPnl.toLocaleString('ja-JP')}
              </p>
            </div>
          )}
          <button
            onClick={reload}
            disabled={loading}
            className='text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors px-3 py-1.5 border border-dim rounded-md'
          >
            {loading ? '更新中...' : '更新'}
          </button>
        </div>
      </div>

      <AddForm onAdded={reload} />

      <div className='bg-card border border-dim rounded-lg'>
        <div className='flex items-center gap-2 px-4 py-3 border-b border-dim'>
          {(['open', 'closed'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1.5 text-xs rounded-md transition-colors border',
                tab === t
                  ? 'bg-accent/20 text-accent border-accent/50'
                  : 'text-[#8b949e] border-dim hover:text-[#e6edf3]'
              )}
            >
              {t === 'open' ? `オープン (${positions.filter(p => p.status === 'open').length})` : `クローズ (${positions.filter(p => p.status === 'closed').length})`}
            </button>
          ))}
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm min-w-[900px]'>
            <thead>
              <tr className='text-xs text-[#8b949e] border-b border-dim bg-[#0d1117]/50'>
                {['銘柄', '購入日', '購入単価', '株数', '現在値', '損益', 'TP / SL', 'ステータス', '操作'].map(h => (
                  <th key={h} className='px-3 py-2.5 text-left font-medium whitespace-nowrap first:pl-4'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(pos => (
                <PositionRow key={pos.id} pos={pos} onClose={handleClose} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className='py-16 text-center text-xs text-[#8b949e]'>
              {tab === 'open' ? 'オープンポジションはありません' : '決済済みポジションはありません'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
