import { useEffect, useRef, useState } from 'preact/hooks'
import type { WSEvent } from '../lib/types'

export function useWebSocket(onEvent: (event: WSEvent) => void) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>()
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    let attempt = 0
    let disposed = false

    function connect() {
      if (disposed) return
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        attempt = 0
      }

      ws.onmessage = (ev) => {
        const event: WSEvent = JSON.parse(ev.data)
        onEventRef.current(event)
      }

      ws.onclose = () => {
        setConnected(false)
        if (disposed) return
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
        attempt++
        reconnectTimer.current = window.setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      disposed = true
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return { connected }
}
