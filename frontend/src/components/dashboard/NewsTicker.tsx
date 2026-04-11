'use client'
import { useEffect, useRef } from 'react'

export default function NewsTicker({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let x = 0
    const speed = 0.5
    const step = () => {
      x -= speed
      if (Math.abs(x) >= el.scrollWidth / 2) x = 0
      el.style.transform = `translateX(${x}px)`
      requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [])

  const doubled = [...items, ...items]

  return (
    <div className='bg-card border border-dim rounded-lg overflow-hidden'>
      <div className='flex items-center'>
        <span className='shrink-0 px-3 py-2 text-xs font-bold text-[#0d1117] bg-accent'>LIVE</span>
        <div className='overflow-hidden flex-1 py-2'>
          <div ref={ref} className='flex whitespace-nowrap will-change-transform'>
            {doubled.map((item, i) => (
              <span key={i} className='text-xs text-[#c9d1d9] px-8'>{item}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
