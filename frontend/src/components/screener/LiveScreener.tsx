'use client'
import { useWebSocket } from '@/hooks/useWebSocket'
import SignalTable from './SignalTable'
import type { IndexData, SignalData } from '@/lib/api'
import clsx from 'clsx'

interface Props {
  initialSignals: SignalData[]
}

export default function LiveScreener({ initialSignals }: Props) {
  const { signals, status, lastUpdated } = useWebSocket({
    indices: [],
    signals: initialSignals,
  })

  return (
    <div className='flex flex-col gap-4 max-w-[1600px] mx-auto'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-[#e6edf3]'>シグナルスクリーナー</h1>
          <p className='text-sm text-[#8b949e]'>テクニカル指標に基づく買い/売りシグナル一覧</p>
        </div>
        <div className='flex items-center gap-2 text-xs text-[#8b949e]'>
          <span className={clsx(
            'w-2 h-2 rounded-full',
            status === 'open' ? 'bg-buy animate-pulse' :
            status === 'closed' ? 'bg-sell' : 'bg-hold animate-pulse'
          )} />
          {status === 'open' ? 'ライブ' : status === 'closed' ? '再接続中' : '接続中'}
          {lastUpdated && (
            <span className='text-[10px]'>
              / {lastUpdated.toLocaleTimeString('ja-JP')}
            </span>
          )}
        </div>
      </div>
      <SignalTable initialData={signals} />
    </div>
  )
}
