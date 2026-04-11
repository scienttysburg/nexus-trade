'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const NAV = [
  { href: '/',          label: 'Market Pulse',  sub: 'ダッシュボード',  icon: '◉' },
  { href: '/screener',  label: 'Signal Radar',  sub: 'シグナル一覧',    icon: '⚡' },
  { href: '/sectors',   label: 'Sector Matrix', sub: 'セクター分析',    icon: '▦' },
  { href: '/news',      label: 'Market Intel',  sub: 'AIニュース',      icon: '◎' },
  { href: '/watchlist', label: 'Watchlist',     sub: 'お気に入り',      icon: '★' },
  { href: '/trade-log', label: 'Trade Log',     sub: 'ポジション管理',  icon: '₿' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className='w-56 shrink-0 bg-card border-r border-dim flex flex-col'>
      <div className='px-4 py-5 border-b border-dim'>
        <span className='text-accent font-bold text-lg tracking-wide'>NEXUS</span>
        <span className='text-[#e6edf3] font-bold text-lg'> TRADE</span>
      </div>
      <nav className='flex flex-col gap-0.5 p-2 flex-1'>
        {NAV.map(({ href, label, sub, icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors',
                active
                  ? 'bg-[#1c2128] text-accent'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128]'
              )}
            >
              <span className='text-base w-4 text-center shrink-0'>{icon}</span>
              <div className='min-w-0'>
                <p className={clsx('text-xs font-semibold leading-tight', active ? 'text-accent' : '')}>
                  {label}
                </p>
                <p className='text-[10px] text-[#8b949e] leading-tight'>{sub}</p>
              </div>
            </Link>
          )
        })}
      </nav>
      <div className='px-3 py-2 border-t border-dim'>
        <Link
          href='/settings'
          className={clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-[10px]',
            path === '/settings' ? 'text-accent bg-[#1c2128]' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128]'
          )}
        >
          <span>⚙</span>
          <span>設定</span>
        </Link>
        <div className='px-3 pt-1 flex items-center justify-between'>
          <span className='text-[10px] text-[#30363d]'>v0.4.0</span>
        </div>
      </div>
    </aside>
  )
}
