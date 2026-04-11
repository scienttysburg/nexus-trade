'use client'
import { useState, useTransition } from 'react'
import { api, type SymbolsData, type AppSettings, type SymbolEntry } from '@/lib/api'

interface Props {
  initialSymbols: SymbolsData
  initialSettings: AppSettings | null
}

const DEFAULT_SETTINGS: AppSettings = {
  refresh_interval: 60,
  broadcast_interval: 30,
  discord_webhook: '',
  slack_webhook: '',
  webhook_enabled: false,
  webhook_score_threshold: 80,
}

const SECTOR_OPTIONS = [
  '半導体・電子部品', '銀行・金融', '自動車・輸送機器', '電機', '医薬品・ヘルスケア',
  '情報通信', '電子機器', '食品・飲料', '機械・製造', '精密機器', '商社',
  '不動産', 'エネルギー・資源', '化学', '小売・消費財', 'テクノロジー',
  'SNS・メディア', 'eコマース', 'EV・自動車', '決済・金融', 'ゲーム・エンタメ',
]

const REFRESH_OPTIONS   = [10, 30, 60, 120, 300]
const BROADCAST_OPTIONS = [1, 5, 10, 30, 60]

export default function SettingsClient({ initialSymbols, initialSettings }: Props) {
  const [symbols, setSymbols]     = useState<SymbolsData>(initialSymbols)
  const [settings, setSettings]   = useState<AppSettings>(initialSettings ?? DEFAULT_SETTINGS)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const [newTicker,   setNewTicker]   = useState('')
  const [newName,     setNewName]     = useState('')
  const [newSector,   setNewSector]   = useState(SECTOR_OPTIONS[0])
  const [newMarket,   setNewMarket]   = useState<'JP' | 'US'>('JP')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')

  async function handleLookup() {
    if (!newTicker.trim()) return
    setLookupState('loading')
    try {
      const info = await api.lookupSymbol(newTicker.trim())
      setNewTicker(info.ticker)
      setNewName(info.name)
      setNewSector(info.sector)
      setNewMarket(info.market as 'JP' | 'US')
      setLookupState('ok')
    } catch {
      setLookupState('err')
    }
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function handleToggle(ticker: string, enabled: boolean) {
    startTransition(async () => {
      try {
        await api.toggleSymbol(ticker, enabled)
        setSymbols(prev => ({
          jp: prev.jp.map(s => s.ticker === ticker ? { ...s, enabled } : s),
          us: prev.us.map(s => s.ticker === ticker ? { ...s, enabled } : s),
        }))
        showToast(`${ticker} を${enabled ? '有効' : '無効'}化しました`)
      } catch (e: unknown) {
        showToast((e as Error).message, false)
      }
    })
  }

  function handleDelete(ticker: string) {
    if (!confirm(`${ticker} を削除しますか？`)) return
    startTransition(async () => {
      try {
        await api.deleteSymbol(ticker)
        setSymbols(prev => ({
          jp: prev.jp.filter(s => s.ticker !== ticker),
          us: prev.us.filter(s => s.ticker !== ticker),
        }))
        showToast(`${ticker} を削除しました`)
      } catch (e: unknown) {
        showToast((e as Error).message, false)
      }
    })
  }

  function handleAddSymbol() {
    if (!newTicker.trim() || !newName.trim()) {
      showToast('ティッカーと名称は必須です', false)
      return
    }
    startTransition(async () => {
      try {
        await api.addSymbol({ ticker: newTicker.trim().toUpperCase(), name: newName.trim(), sector: newSector, market: newMarket })
        const entry: SymbolEntry = { ticker: newTicker.trim().toUpperCase(), name: newName.trim(), sector: newSector, enabled: true }
        setSymbols(prev => newMarket === 'JP'
          ? { ...prev, jp: [...prev.jp, entry] }
          : { ...prev, us: [...prev.us, entry] }
        )
        setNewTicker(''); setNewName('')
        showToast(`${entry.ticker} を追加しました`)
      } catch (e: unknown) {
        showToast((e as Error).message, false)
      }
    })
  }

  function handleSettingsSave() {
    startTransition(async () => {
      try {
        const updated = await api.updateSettings(settings)
        setSettings(updated)
        showToast('設定を保存しました')
      } catch (e: unknown) {
        showToast((e as Error).message, false)
      }
    })
  }

  return (
    <div className='max-w-4xl mx-auto space-y-8 animate-fade-in'>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm font-medium shadow-lg transition-all
          ${toast.ok ? 'bg-[#238636] text-white' : 'bg-[#da3633] text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* ---- 銘柄管理 ---- */}
      <section className='bg-card border border-dim rounded-lg p-6'>
        <h2 className='text-base font-semibold text-[#e6edf3] mb-4'>銘柄管理</h2>

        {/* 追加フォーム */}
        <div className='space-y-2 mb-6 p-3 border border-dim rounded-md bg-[#0d1117]'>
          <p className='text-xs text-[#8b949e]'>コードを入力して「自動取得」を押すと銘柄名・業種・市場が自動設定されます</p>
          {/* ティッカー + 自動取得 */}
          <div className='flex gap-2'>
            <input
              className='input flex-1'
              placeholder='ティッカー (例: 7203 / NVDA / 8136.T)'
              value={newTicker}
              onChange={e => { setNewTicker(e.target.value); setLookupState('idle') }}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
            />
            <button
              onClick={handleLookup}
              disabled={!newTicker.trim() || lookupState === 'loading'}
              className='btn-primary px-3 text-xs'
            >
              {lookupState === 'loading' ? '取得中…' : '自動取得'}
            </button>
          </div>
          {lookupState === 'err' && (
            <p className='text-xs text-sell'>銘柄情報を取得できませんでした。手動で入力してください。</p>
          )}
          {/* 銘柄名・業種・市場 */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
            <input
              className='input col-span-2 md:col-span-1'
              placeholder='銘柄名'
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <select className='input' value={newSector} onChange={e => setNewSector(e.target.value)}>
              {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className='input' value={newMarket} onChange={e => setNewMarket(e.target.value as 'JP' | 'US')}>
              <option value='JP'>日本株 (JP)</option>
              <option value='US'>米国株 (US)</option>
            </select>
            <button
              onClick={handleAddSymbol}
              disabled={isPending}
              className='btn-primary'
            >
              ウォッチリストに追加
            </button>
          </div>
        </div>

        {/* JP リスト */}
        <SymbolList title='日本株' items={symbols.jp} onToggle={handleToggle} onDelete={handleDelete} isPending={isPending} />
        <div className='mt-4' />
        <SymbolList title='米国株' items={symbols.us} onToggle={handleToggle} onDelete={handleDelete} isPending={isPending} />
      </section>

      {/* ---- 更新設定 ---- */}
      <section className='bg-card border border-dim rounded-lg p-6'>
        <h2 className='text-base font-semibold text-[#e6edf3] mb-4'>更新設定</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label className='label'>バックグラウンドリフレッシュ間隔</label>
            <select
              className='input w-full'
              value={settings.refresh_interval}
              onChange={e => setSettings(s => ({ ...s, refresh_interval: Number(e.target.value) }))}
            >
              {REFRESH_OPTIONS.map(v => <option key={v} value={v}>{v} 秒</option>)}
            </select>
            <p className='text-[11px] text-[#8b949e] mt-1'>yfinance からのデータ取得間隔</p>
          </div>
          <div>
            <label className='label'>WebSocket ブロードキャスト間隔</label>
            <select
              className='input w-full'
              value={settings.broadcast_interval}
              onChange={e => setSettings(s => ({ ...s, broadcast_interval: Number(e.target.value) }))}
            >
              {BROADCAST_OPTIONS.map(v => <option key={v} value={v}>{v} 秒</option>)}
            </select>
            <p className='text-[11px] text-[#8b949e] mt-1'>フロントエンドへのプッシュ頻度</p>
          </div>
        </div>
      </section>

      {/* ---- 通知設定 ---- */}
      <section className='bg-card border border-dim rounded-lg p-6'>
        <h2 className='text-base font-semibold text-[#e6edf3] mb-4'>外部通知 (Webhook)</h2>
        <div className='space-y-4'>
          <div className='flex items-center gap-3'>
            <span className='label w-32 shrink-0'>通知を有効化</span>
            <button
              onClick={() => setSettings(s => ({ ...s, webhook_enabled: !s.webhook_enabled }))}
              className={`relative inline-flex h-5 w-10 rounded-full transition-colors
                ${settings.webhook_enabled ? 'bg-[#238636]' : 'bg-[#30363d]'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5
                ${settings.webhook_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div>
            <label className='label'>Discord Webhook URL</label>
            <input
              className='input w-full font-mono text-xs'
              placeholder='https://discord.com/api/webhooks/...'
              value={settings.discord_webhook}
              onChange={e => setSettings(s => ({ ...s, discord_webhook: e.target.value }))}
            />
          </div>

          <div>
            <label className='label'>Slack Webhook URL</label>
            <input
              className='input w-full font-mono text-xs'
              placeholder='https://hooks.slack.com/services/...'
              value={settings.slack_webhook}
              onChange={e => setSettings(s => ({ ...s, slack_webhook: e.target.value }))}
            />
          </div>

          <div>
            <label className='label'>通知スコア閾値: <span className='text-accent'>{settings.webhook_score_threshold}</span></label>
            <input
              type='range' min={0} max={100} step={5}
              className='w-full accent-[#58a6ff]'
              value={settings.webhook_score_threshold}
              onChange={e => setSettings(s => ({ ...s, webhook_score_threshold: Number(e.target.value) }))}
            />
            <div className='flex justify-between text-[10px] text-[#8b949e] mt-0.5'>
              <span>0</span><span>50</span><span>100</span>
            </div>
            <p className='text-[11px] text-[#8b949e] mt-1'>この閾値以上のシグナルが出たときに通知を送信</p>
          </div>
        </div>
      </section>

      <div className='flex justify-end pb-8'>
        <button
          onClick={handleSettingsSave}
          disabled={isPending}
          className='btn-primary px-8'
        >
          {isPending ? '保存中…' : '設定を保存'}
        </button>
      </div>
    </div>
  )
}

function SymbolList({
  title, items, onToggle, onDelete, isPending,
}: {
  title: string
  items: SymbolEntry[]
  onToggle: (ticker: string, enabled: boolean) => void
  onDelete: (ticker: string) => void
  isPending: boolean
}) {
  return (
    <div>
      <h3 className='text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2'>{title}</h3>
      <div className='divide-y divide-[#30363d] border border-dim rounded-md overflow-hidden'>
        {items.length === 0 && (
          <p className='text-[#8b949e] text-sm px-4 py-3'>銘柄がありません</p>
        )}
        {items.map(s => (
          <div key={s.ticker} className='flex items-center gap-3 px-4 py-2.5 bg-[#0d1117] hover:bg-[#1c2128] transition-colors'>
            <span className='font-mono text-xs text-accent w-24 shrink-0'>{s.ticker}</span>
            <span className='text-sm text-[#e6edf3] flex-1'>{s.name}</span>
            <span className='text-xs text-[#8b949e] hidden md:block w-32 shrink-0'>{s.sector}</span>
            <button
              onClick={() => onToggle(s.ticker, !s.enabled)}
              disabled={isPending}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0
                ${s.enabled ? 'bg-[#238636]' : 'bg-[#30363d]'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5
                ${s.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <button
              onClick={() => onDelete(s.ticker)}
              disabled={isPending}
              className='text-[#8b949e] hover:text-[#f85149] text-sm transition-colors shrink-0'
              title='削除'
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
