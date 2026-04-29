import { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE } from '../api/client'
import type { WatcherChangeEvent } from '@prism/shared'

export type { WatcherChangeEvent }

const RECONNECT_DELAY_MS = 2000

export function useFileWatcher() {
  const [changes, setChanges] = useState<WatcherChangeEvent[]>([])
  const [connected, setConnected] = useState(false)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let es: EventSource | null = null

    function connect() {
      es = new EventSource(`${API_BASE}/watch`)

      es.onopen = () => {
        setConnected(true)
      }

      es.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as WatcherChangeEvent
          setChanges((prev) => {
            const idx = prev.findIndex((c) => c.entryId === data.entryId)
            if (idx >= 0) {
              // 替换旧记录
              const next = [...prev]
              next[idx] = data
              return next
            }
            return [...prev, data]
          })
        } catch {
          // 忽略无法解析的消息
        }
      }

      es.onerror = () => {
        setConnected(false)
        es?.close()
        reconnectRef.current = setTimeout(() => {
          connect()
        }, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      es?.close()
      if (reconnectRef.current !== null) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
    }
  }, [])

  const dismissChange = useCallback((entryId: string) => {
    setChanges((prev) => prev.filter((c) => c.entryId !== entryId))
  }, [])

  return { changes, dismissChange, connected }
}
