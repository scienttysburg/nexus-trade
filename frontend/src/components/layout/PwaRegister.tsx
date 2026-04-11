'use client'
import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(e => console.warn('[SW] registration failed:', e))
    }
  }, [])

  return null
}
