'use client'
import { useEffect, useState } from 'react'

function MarketBadge({ label, open }: { label: string; open: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${open ? 'bg-buy/10 text-buy' : 'bg-[#30363d] text-[#8b949e]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-buy animate-pulse' : 'bg-[#8b949e]'}`} />
      {label}
    </span>
  )
}

export default function Header() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const h = jst.getHours()
      const open = (h >= 9 && h < 15) && jst.getDay() !== 0 && jst.getDay() !== 6
      setTime(
        jst.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Tokyo' }) + ' JST'
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const h = jst.getHours()
  const jpOpen = h >= 9 && h < 15 && jst.getDay() !== 0 && jst.getDay() !== 6

  const nyNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const nyH = nyNow.getHours()
  const usOpen = nyH >= 9 && nyH < 16 && nyNow.getDay() !== 0 && nyNow.getDay() !== 6

  return (
    <header className='h-12 bg-card border-b border-dim flex items-center justify-between px-4 shrink-0'>
      <div className='flex items-center gap-3'>
        <MarketBadge label='東京市場' open={jpOpen} />
        <MarketBadge label='NY市場'   open={usOpen} />
      </div>
      <span className='font-mono text-sm text-[#8b949e]'>{time}</span>
    </header>
  )
}
