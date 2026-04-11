'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const NAV = [
  { href: '/',          label: 'ダッシュボード',       icon: '▦' },
  { href: '/screener',  label: 'シグナルスクリーナー', icon: '⚡' },
  { href: '/settings',  label: '設定',                 icon: '⚙' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className='w-56 shrink-0 bg-card border-r border-dim flex flex-col'>
      <div className='px-4 py-5 border-b border-dim'>
        <span className='text-accent font-bold text-lg tracking-wide'>NEXUS</span>
        <span className='text-[#e6edf3] font-bold text-lg'> TRADE</span>
      </div>
      <nav className='flex flex-col gap-1 p-3 flex-1'>
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
              path === href
                ? 'bg-[#1c2128] text-accent font-medium'
                : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128]'
            )}
          >
            <span className='text-base'>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className='px-4 py-3 border-t border-dim flex items-center justify-between'>
        <span className='text-[10px] text-[#8b949e]'>Nexus Trade</span>
        <span className='text-[10px] font-mono text-[#30363d] bg-[#1c2128] px-1.5 py-0.5 rounded'>v0.3.0</span>
      </div>
    </aside>
  )
}
