'use client'
import { useState, useTransition } from 'react'
import { api, type BacktestResult } from '@/lib/api'

interface Props { ticker: string }

const GRADE = (ev: number, wr: number, pf: number) => {
  if (ev >= 1.5 && wr >= 60 && pf >= 1.5) return { label: 'S', color: 'text-buy border-buy bg-[#1a4731]' }
  if (ev >= 0.8 && wr >= 50 && pf >= 1.2) return { label: 'A', color: 'text-[#85e89d] border-[#3fb950]/50 bg-[#122d20]' }
  if (ev >= 0.3 && pf >= 1.0)             return { label: 'B', color: 'text-hold border-hold/50 bg-[#2d2a1a]' }
  if (ev >= 0)                             return { label: 'C', color: 'text-[#f97583] border-sell/50 bg-[#2d1a1a]' }
  return { label: 'D', color: 'text-sell border-sell bg-[#3d1818]' }
}

export default function BacktestCard({ ticker }: Props) {
  const [result, setResult]   = useState<BacktestResult | null>(null)
  const [error, setError]     = useState('')
  const [days, setDays]       = useState(90)
  const [isPending, start]    = useTransition()

  function run() {
    setError('')
    start(async () => {
      try {
        const r = await api.backtest(ticker, { days })
        setResult(r)
      } catch (e: unknown) {
        setError((e as Error).message)
      }
    })
  }

  const grade = result ? GRADE(result.expected_value, result.win_rate, result.profit_factor) : null

  return (
    <div className='bg-card border border-dim rounded-lg p-4'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-sm font-semibold text-[#e6edf3]'>📊 バックテスト (簡易シミュレーション)</h2>
        <div className='flex items-center gap-2'>
          <select
            className='input text-xs py-1'
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={30}>過去 30 日</option>
            <option value={90}>過去 90 日</option>
            <option value={180}>過去 180 日</option>
            <option value={365}>過去 1 年</option>
          </select>
          <button onClick={run} disabled={isPending} className='btn-primary text-xs py-1 px-3'>
            {isPending ? '計算中…' : '実行'}
          </button>
        </div>
      </div>

      {error && <p className='text-sell text-xs'>{error}</p>}

      {result && result.total_trades === 0 && (
        <p className='text-[#8b949e] text-sm'>この期間中にエントリーシグナルがありませんでした。</p>
      )}

      {result && result.total_trades > 0 && (
        <div className='space-y-4'>
          {/* サマリーカード */}
          <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2'>
            {/* グレード */}
            <div className={`border rounded-lg p-3 text-center flex flex-col items-center justify-center ${grade!.color}`}>
              <p className='text-[10px] uppercase tracking-wide opacity-70 mb-0.5'>グレード</p>
              <p className='text-3xl font-bold leading-none'>{grade!.label}</p>
            </div>

            <Stat label='総トレード数' value={String(result.total_trades)} color='text-[#e6edf3]' />
            <Stat
              label='勝率'
              value={`${result.win_rate.toFixed(1)}%`}
              color={result.win_rate >= 50 ? 'text-buy' : 'text-sell'}
              sub={`${result.win_trades}勝 ${result.loss_trades}敗`}
            />
            <Stat
              label='平均利益'
              value={`+${result.avg_win_pct.toFixed(2)}%`}
              color='text-buy'
            />
            <Stat
              label='平均損失'
              value={`-${result.avg_loss_pct.toFixed(2)}%`}
              color='text-sell'
            />
            <Stat
              label='プロフィットF'
              value={result.profit_factor >= 99 ? '∞' : result.profit_factor.toFixed(2)}
              color={result.profit_factor >= 1.2 ? 'text-buy' : 'text-sell'}
              sub='総利益 / 総損失'
            />
            <Stat
              label='期待値 / トレード'
              value={`${result.expected_value >= 0 ? '+' : ''}${result.expected_value.toFixed(2)}%`}
              color={result.expected_value >= 0 ? 'text-buy' : 'text-sell'}
            />
          </div>

          {/* 最大ドローダウン */}
          <div className='flex items-center gap-2 text-xs text-[#8b949e]'>
            <span>最大ドローダウン:</span>
            <span className='text-sell font-mono'>-{result.max_drawdown.toFixed(2)}%</span>
            <span className='opacity-40'>|</span>
            <span>期間: {result.period_days} 日間</span>
            <span className='opacity-40'>|</span>
            <span>シグナル閾値: Buy (65点以上) / TP+5% / SL-3% / 最大5日保有</span>
          </div>

          {/* 直近トレード履歴 */}
          <div>
            <p className='text-xs text-[#8b949e] mb-2'>直近トレード履歴 (最大30件)</p>
            <div className='overflow-x-auto'>
              <table className='w-full text-xs'>
                <thead>
                  <tr className='border-b border-dim text-[#8b949e]'>
                    <th className='text-left py-1.5 pr-3'>エントリー日</th>
                    <th className='text-left py-1.5 pr-3'>イグジット日</th>
                    <th className='text-right py-1.5 pr-3'>エントリー</th>
                    <th className='text-right py-1.5 pr-3'>イグジット</th>
                    <th className='text-right py-1.5'>損益</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.trades].reverse().map((t, i) => (
                    <tr key={i} className='border-b border-dim/30 hover:bg-[#1c2128] transition-colors'>
                      <td className='font-mono py-1.5 pr-3 text-[#8b949e]'>{t.entry_date}</td>
                      <td className='font-mono py-1.5 pr-3 text-[#8b949e]'>{t.exit_date}</td>
                      <td className='font-mono py-1.5 pr-3 text-right'>{t.entry_price.toLocaleString()}</td>
                      <td className='font-mono py-1.5 pr-3 text-right'>{t.exit_price.toLocaleString()}</td>
                      <td className={`font-mono py-1.5 text-right font-medium
                        ${t.result === 'win' ? 'text-buy' : t.result === 'loss' ? 'text-sell' : 'text-[#8b949e]'}`}>
                        {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!result && !isPending && (
        <p className='text-xs text-[#8b949e]'>「実行」ボタンを押すと過去データでシグナルロジックをシミュレーションします。</p>
      )}
    </div>
  )
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className='bg-[#0d1117] border border-dim rounded-lg p-3 text-center'>
      <p className='text-[10px] text-[#8b949e] mb-1 uppercase tracking-wide leading-tight'>{label}</p>
      <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
      {sub && <p className='text-[10px] text-[#8b949e] mt-0.5'>{sub}</p>}
    </div>
  )
}
