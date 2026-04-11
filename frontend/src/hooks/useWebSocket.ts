'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import type { IndexData, SignalData } from '@/lib/api'

type WsStatus = 'connecting' | 'open' | 'closed'

interface WsState {
  indices: IndexData[]
  signals: SignalData[]
  status: WsStatus
  lastUpdated: Date | null
}

const WS_URL           = 'ws://localhost:8000/ws'
const PING_INTERVAL_MS = 20_000   // 20 秒ごと ping (Safari の 30 秒タイムアウト対策)
const MAX_RETRY_DELAY  = 30_000   // 最大 30 秒

export function useWebSocket(initial: { indices: IndexData[]; signals: SignalData[] }): WsState {
  const [state, setState] = useState<WsState>({
    indices: initial.indices,
    signals: initial.signals,
    status: 'connecting',
    lastUpdated: null,
  })

  const wsRef       = useRef<WebSocket | null>(null)
  const pingRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount  = useRef(0)
  const manualClose = useRef(false)

  const clearTimers = useCallback(() => {
    if (pingRef.current)  clearInterval(pingRef.current)
    if (retryRef.current) clearTimeout(retryRef.current)
    pingRef.current  = null
    retryRef.current = null
  }, [])

  const connect = useCallback(() => {
    if (manualClose.current) return
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    setState(s => ({ ...s, status: 'connecting' }))

    ws.onopen = () => {
      setState(s => ({ ...s, status: 'open' }))
      retryCount.current = 0
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, PING_INTERVAL_MS)
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string)
        if (msg.type === 'snapshot' || msg.type === 'update') {
          setState(s => ({
            ...s,
            indices:     msg.indices ?? s.indices,
            signals:     msg.signals ?? s.signals,
            lastUpdated: new Date(),
          }))
        }
      } catch {}
    }

    ws.onclose = (ev) => {
      clearTimers()
      setState(s => ({ ...s, status: 'closed' }))
      if (manualClose.current) return

      // Safari は code=1001 (going away) でタブ復帰時に切断することがある
      const delay = Math.min(1000 * 2 ** retryCount.current, MAX_RETRY_DELAY)
      retryCount.current += 1
      retryRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [clearTimers])

  // ページ可視性変化 (タブ切り替え / Safari の バックグラウンド抑制) への対応
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        wsRef.current?.readyState !== WebSocket.OPEN
      ) {
        clearTimers()
        retryCount.current = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [connect, clearTimers])

  useEffect(() => {
    manualClose.current = false
    connect()
    return () => {
      manualClose.current = true
      clearTimers()
      wsRef.current?.close()
    }
  }, [connect, clearTimers])

  return state
}
