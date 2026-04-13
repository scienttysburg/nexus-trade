'use client'
import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import type { PaperAccount, PaperOrder, PaperPosition } from '@/lib/api'

// ──────────────────── 数値フォーマット ────────────────────

function fmtJPY(v: number) {
  return v.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
}
function fmtPct(v: number, digits = 2) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}
function pnlColor(v: number | null) {
  if (v === null) return 'text-[#8b949e]'
  return v >= 0 ? 'text-buy' : 'text-sell'
}

// ──────────────────── サマリーカード ────────────────────

function AccountSummary({ account }: { account: PaperAccount }) {
  const items = [
    { label: '総資産',      value: `¥${fmtJPY(account.total_assets)}`,    sub: `初期資金: ¥${fmtJPY(account.initial_balance)}`, color: '' },
    { label: '現金残高',    value: `¥${fmtJPY(account.cash_balance)}`,     sub: '',    color: '' },
    { label: '評価額',      value: `¥${fmtJPY(account.positions_value)}`,  sub: '',    color: '' },
    { label: '含み損益',    value: `¥${fmtJPY(account.unrealized_pnl)}`,   sub: '',    color: pnlColor(account.unrealized_pnl) },
    { label: '確定損益',    value: `¥${fmtJPY(account.realized_pnl)}`,     sub: '',    color: pnlColor(account.realized_pnl) },
    { label: '総損益率',    value: fmtPct(account.return_pct),             sub: `取引回数: ${account.total_trades}`,  color: pnlColor(account.return_pct) },
  ]
  return (
    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'>
      {items.map(({ label, value, sub, color }) => (
        <div key={label} className='bg-card border border-dim rounded-lg px-4 py-3'>
          <p className='text-[10px] text-[#8b949e] mb-1'>{label}</p>
          <p className={clsx('text-base font-mono font-semibold', color || 'text-[#e6edf3]')}>{value}</p>
          {sub && <p className='text-[10px] text-[#8b949e] mt-0.5'>{sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ──────────────────── 注文フォーム ────────────────────

type InputMode = 'shares' | 'amount'

function OrderForm({ onOrderDone }: { onOrderDone: () => void }) {
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [inputMode, setInputMode] = useState<InputMode>('amount')
  const [shares, setShares] = useState('')
  const [amount, setAmount] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchPrice = useCallback(async (t: string) => {
    if (!t) return
    try {
      const res = await fetch(`/api/v1/crypto`)
      const data = await res.json()
      const found = data.find((s: { ticker: string; price: number; name: string }) => s.ticker === t.toUpperCase())
      if (found) {
        setCurrentPrice(found.price)
        setName(found.name)
        return
      }
    } catch { /* fallback below */ }
    try {
      const res = await fetch(`/api/v1/stocks/${encodeURIComponent(t.toUpperCase())}`)
      if (res.ok) {
        const data = await res.json()
        setCurrentPrice(data.price)
        setName(data.name || t.toUpperCase())
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!ticker) { setCurrentPrice(null); return }
    const timer = setTimeout(() => fetchPrice(ticker), 600)
    return () => clearTimeout(timer)
  }, [ticker, fetchPrice])

  // 金額 ↔ 数量の相互計算
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return
    if (inputMode === 'amount' && amount) {
      const qty = parseFloat(amount) / currentPrice
      if (!isNaN(qty)) setShares(qty.toFixed(qty < 1 ? 6 : 4))
    } else if (inputMode === 'shares' && shares) {
      const amt = parseFloat(shares) * currentPrice
      if (!isNaN(amt)) setAmount(amt.toFixed(0))
    }
  }, [amount, shares, currentPrice, inputMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const body = {
        ticker: ticker.toUpperCase(),
        name,
        order_type: orderType,
        shares: inputMode === 'shares' ? parseFloat(shares) : undefined,
        amount: inputMode === 'amount' ? parseFloat(amount) : undefined,
      }
      const result = await api.paperOrder(body)
      const action = result.type === 'buy' ? '買付' : '売却'
      setSuccess(`${action}完了: ${result.ticker} × ${result.shares.toFixed(result.shares < 1 ? 6 : 4)} @ ¥${fmtJPY(result.price)}`)
      setTicker('')
      setShares('')
      setAmount('')
      setCurrentPrice(null)
      setName('')
      onOrderDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '注文に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='bg-card border border-dim rounded-lg p-5 flex flex-col gap-4'>
      <h2 className='text-sm font-semibold text-[#e6edf3]'>成行注文</h2>

      {/* 買い/売り切り替え */}
      <div className='flex gap-2'>
        {(['buy', 'sell'] as const).map(t => (
          <button
            key={t}
            type='button'
            onClick={() => setOrderType(t)}
            className={clsx(
              'flex-1 py-2 text-sm font-semibold rounded-md border transition-colors',
              orderType === t
                ? t === 'buy'
                  ? 'bg-buy/20 text-buy border-buy/50'
                  : 'bg-sell/20 text-sell border-sell/50'
                : 'text-[#8b949e] border-dim hover:bg-[#1c2128]'
            )}
          >{t === 'buy' ? '成行買い' : '成行売り'}</button>
        ))}
      </div>

      {/* ティッカー */}
      <div className='flex flex-col gap-1'>
        <label className='label'>ティッカー</label>
        <div className='flex gap-2 items-center'>
          <input
            type='text'
            value={ticker}
            onChange={e => setTicker(e.target.value)}
            placeholder='例: BTC-USD / 7203.T / NVDA'
            className='input flex-1'
            required
          />
          {currentPrice !== null && (
            <span className='text-xs font-mono text-accent shrink-0'>
              ¥{fmtJPY(currentPrice)}
            </span>
          )}
        </div>
        {name && <p className='text-[10px] text-[#8b949e]'>{name}</p>}
      </div>

      {/* 入力モード切り替え */}
      <div className='flex gap-2'>
        {(['amount', 'shares'] as const).map(m => (
          <button
            key={m}
            type='button'
            onClick={() => setInputMode(m)}
            className={clsx(
              'px-3 py-1 text-xs rounded-md border transition-colors',
              inputMode === m
                ? 'bg-accent/20 text-accent border-accent/50'
                : 'text-[#8b949e] border-dim hover:bg-[#1c2128]'
            )}
          >{m === 'amount' ? '金額指定' : '数量指定'}</button>
        ))}
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <div className='flex flex-col gap-1'>
          <label className='label'>金額 (¥)</label>
          <input
            type='number'
            value={amount}
            onChange={e => { setAmount(e.target.value); setInputMode('amount') }}
            placeholder='例: 100000'
            className='input'
            min='1'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='label'>数量</label>
          <input
            type='number'
            value={shares}
            onChange={e => { setShares(e.target.value); setInputMode('shares') }}
            placeholder='例: 0.001'
            className='input'
            step='any'
            min='0'
          />
        </div>
      </div>

      {error && <p className='text-xs text-sell bg-sell/10 border border-sell/30 rounded px-3 py-2'>{error}</p>}
      {success && <p className='text-xs text-buy bg-buy/10 border border-buy/30 rounded px-3 py-2'>{success}</p>}

      <button
        type='submit'
        disabled={loading || !ticker}
        className={clsx(
          'btn-primary py-2.5 text-sm font-semibold rounded-md transition-colors',
          loading || !ticker ? 'opacity-50 cursor-not-allowed' : ''
        )}
      >
        {loading ? '処理中…' : orderType === 'buy' ? '買い注文を発注' : '売り注文を発注'}
      </button>
    </form>
  )
}

// ──────────────────── 保有ポジション ────────────────────

function PositionTable({ positions }: { positions: PaperPosition[] }) {
  if (positions.length === 0) {
    return (
      <div className='bg-card border border-dim rounded-lg py-10 text-center text-xs text-[#8b949e]'>
        保有ポジションなし
      </div>
    )
  }
  return (
    <div className='bg-card border border-dim rounded-lg overflow-x-auto'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-dim text-[10px] text-[#8b949e] uppercase'>
            <th className='px-4 py-2 text-left font-medium'>銘柄</th>
            <th className='px-3 py-2 text-right font-medium'>種別</th>
            <th className='px-3 py-2 text-right font-medium'>購入価格</th>
            <th className='px-3 py-2 text-right font-medium'>現在価格</th>
            <th className='px-3 py-2 text-right font-medium'>数量</th>
            <th className='px-3 py-2 pr-4 text-right font-medium'>含み損益</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pos => (
            <tr key={pos.id} className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors'>
              <td className='px-4 py-2.5'>
                <p className='font-mono text-xs text-[#8b949e]'>{pos.ticker}</p>
                <p className='text-sm text-[#e6edf3]'>{pos.name}</p>
              </td>
              <td className='px-3 py-2.5 text-right'>
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded border',
                  pos.asset_type === 'crypto'
                    ? 'text-[#f0883e] border-[#f0883e]/30 bg-[#f0883e]/10'
                    : 'text-accent border-accent/30 bg-accent/10'
                )}>
                  {pos.asset_type === 'crypto' ? 'Crypto' : 'Stock'}
                </span>
              </td>
              <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3] text-right'>
                ¥{fmtJPY(pos.entry_price)}
              </td>
              <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3] text-right'>
                {pos.current_price != null ? `¥${fmtJPY(pos.current_price)}` : '—'}
              </td>
              <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3] text-right'>
                {pos.shares < 1 ? pos.shares.toFixed(6) : pos.shares.toFixed(4)}
              </td>
              <td className={clsx('px-3 py-2.5 pr-4 font-mono text-sm text-right', pnlColor(pos.pnl_amount))}>
                {pos.pnl_amount != null ? `¥${fmtJPY(pos.pnl_amount)}` : '—'}
                {pos.pnl_pct != null && (
                  <p className='text-[10px] font-normal'>{fmtPct(pos.pnl_pct)}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ──────────────────── 注文履歴 ────────────────────

function OrderHistory({ orders }: { orders: PaperOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className='bg-card border border-dim rounded-lg py-10 text-center text-xs text-[#8b949e]'>
        注文履歴なし
      </div>
    )
  }
  return (
    <div className='bg-card border border-dim rounded-lg overflow-x-auto'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-dim text-[10px] text-[#8b949e] uppercase'>
            <th className='px-4 py-2 text-left font-medium'>日時</th>
            <th className='px-3 py-2 text-left font-medium'>銘柄</th>
            <th className='px-3 py-2 text-right font-medium'>種別</th>
            <th className='px-3 py-2 text-right font-medium'>約定価格</th>
            <th className='px-3 py-2 text-right font-medium'>数量</th>
            <th className='px-3 py-2 text-right font-medium'>金額</th>
            <th className='px-3 py-2 pr-4 text-right font-medium'>確定損益</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors'>
              <td className='px-4 py-2.5 text-xs text-[#8b949e] font-mono'>{o.executed_at}</td>
              <td className='px-3 py-2.5'>
                <p className='font-mono text-xs text-[#8b949e]'>{o.ticker}</p>
                <p className='text-sm text-[#e6edf3]'>{o.name}</p>
              </td>
              <td className='px-3 py-2.5 text-right'>
                <span className={clsx(
                  'text-xs font-semibold',
                  o.order_type === 'buy' ? 'text-buy' : 'text-sell'
                )}>
                  {o.order_type === 'buy' ? '買' : '売'}
                </span>
              </td>
              <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3] text-right'>
                ¥{fmtJPY(o.price)}
              </td>
              <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3] text-right'>
                {o.shares < 1 ? o.shares.toFixed(6) : o.shares.toFixed(4)}
              </td>
              <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3] text-right'>
                ¥{fmtJPY(o.amount)}
              </td>
              <td className={clsx(
                'px-3 py-2.5 pr-4 font-mono text-sm text-right',
                o.pnl != null ? pnlColor(o.pnl) : 'text-[#8b949e]'
              )}>
                {o.pnl != null ? `¥${fmtJPY(o.pnl)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ──────────────────── メインコンポーネント ────────────────────

type Tab = 'portfolio' | 'history'

export default function SimulationDesk() {
  const [account, setAccount] = useState<PaperAccount | null>(null)
  const [orders, setOrders] = useState<PaperOrder[]>([])
  const [tab, setTab] = useState<Tab>('portfolio')
  const [resetting, setResetting] = useState(false)

  const fetchAccount = useCallback(async () => {
    try {
      const data = await api.paperAccount()
      setAccount(data)
    } catch { /* ignore */ }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.paperOrders(100)
      setOrders(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchAccount()
    fetchOrders()
    const timer = setInterval(fetchAccount, 30_000)
    return () => clearInterval(timer)
  }, [fetchAccount, fetchOrders])

  const handleOrderDone = () => {
    fetchAccount()
    fetchOrders()
  }

  const handleReset = async () => {
    if (!confirm('デモ口座をリセットしますか？全ポジション・注文履歴が削除され、初期資金に戻ります。')) return
    setResetting(true)
    try {
      await api.paperReset()
      await fetchAccount()
      await fetchOrders()
    } finally {
      setResetting(false)
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={clsx(
        'px-4 py-2 text-xs font-medium rounded-md border transition-colors',
        tab === t
          ? 'bg-accent/20 text-accent border-accent/50'
          : 'text-[#8b949e] border-dim hover:text-[#e6edf3] hover:bg-[#1c2128]'
      )}
    >{label}</button>
  )

  return (
    <div className='flex flex-col gap-5 max-w-[1400px] mx-auto'>
      {/* ヘッダー */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-[#e6edf3]'>Simulation Desk</h1>
          <p className='text-sm text-[#8b949e]'>デモ売買 — リスクなしでトレードを練習</p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className='px-3 py-1.5 text-xs rounded-md border border-sell/30 text-sell hover:bg-sell/10 transition-colors disabled:opacity-50'
        >
          {resetting ? 'リセット中…' : '口座リセット'}
        </button>
      </div>

      {/* サマリー */}
      {account && <AccountSummary account={account} />}

      {/* 2カラムレイアウト */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-5'>
        {/* 注文フォーム */}
        <div className='lg:col-span-1'>
          <OrderForm onOrderDone={handleOrderDone} />
          <p className='text-[10px] text-[#8b949e] mt-2 px-1'>
            ※ ティッカー例: BTC-USD / ETH-USD（仮想通貨）、NVDA / AAPL（米国株）、7203.T（日本株）
          </p>
        </div>

        {/* ポートフォリオ / 履歴 */}
        <div className='lg:col-span-2 flex flex-col gap-3'>
          <div className='flex gap-2'>
            {tabBtn('portfolio', `保有ポジション (${account?.positions.length ?? 0})`)}
            {tabBtn('history', `注文履歴 (${orders.length})`)}
          </div>
          {tab === 'portfolio'
            ? <PositionTable positions={account?.positions ?? []} />
            : <OrderHistory orders={orders} />
          }
        </div>
      </div>
    </div>
  )
}
