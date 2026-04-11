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

const WS_URL = 'ws://localhost:8000/ws'
const PING_INTERVAL_MS = 25_000

export function useWebSocket(initial: { indices: IndexData[]; signals: SignalData[] }): WsState {
  const [state, setState] = useState<WsState>({
    indices: initial.indices,
    signals: initial.signals,
    status: 'connecting',
    lastUpdated: null,
  })

  const wsRef   = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)

  const clearTimers = useCallback(() => {
    if (pingRef.current)  clearInterval(pingRef.current)
    if (retryRef.current) clearTimeout(retryRef.current)
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setState(s => ({ ...s, status: 'open' }))
      retryCount.current = 0
      // 定期 ping で接続を維持
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, PING_INTERVAL_MS)
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'snapshot' || msg.type === 'update') {
          setState(s => ({
            ...s,
            indices: msg.indices ?? s.indices,
            signals: msg.signals ?? s.signals,
            lastUpdated: new Date(),
          }))
        }
      } catch {}
    }

    ws.onclose = () => {
      clearTimers()
      setState(s => ({ ...s, status: 'closed' }))
      // 指数バックオフで再接続（最大 30 秒）
      const delay = Math.min(1000 * 2 ** retryCount.current, 30_000)
      retryCount.current += 1
      retryRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [clearTimers])

  useEffect(() => {
    connect()
    return () => {
      clearTimers()
      wsRef.current?.close()
    }
  }, [connect, clearTimers])

  return state
}
