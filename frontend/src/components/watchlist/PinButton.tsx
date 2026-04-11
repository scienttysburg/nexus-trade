'use client'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

const STORAGE_KEY = 'nexus_watchlist'

export default function PinButton({ ticker }: { ticker: string }) {
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
      setPinned(saved.includes(ticker))
    } catch {}
  }, [ticker])

  const toggle = () => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
      const next = pinned ? saved.filter(t => t !== ticker) : [...saved, ticker]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setPinned(!pinned)
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      title={pinned ? 'ウォッチリストから削除' : 'ウォッチリストに追加'}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors',
        pinned
          ? 'bg-hold/20 text-hold border-hold/40 hover:bg-sell/20 hover:text-sell hover:border-sell/40'
          : 'bg-[#1c2128] text-[#8b949e] border-dim hover:text-hold hover:border-hold/40'
      )}
    >
      <span>{pinned ? '★' : '☆'}</span>
      <span>{pinned ? 'ウォッチ中' : 'ウォッチリスト'}</span>
    </button>
  )
}
