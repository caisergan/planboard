import { useState, useRef, useEffect } from 'preact/hooks'
import { useTheme, themes, fonts } from '../lib/theme'
import { HashIcon } from './Icons'
import { ConnectionDot } from './ConnectionDot'
import { rescan } from '../lib/api'

interface Props {
  connected: boolean
  onLogoClick: () => void
  onRescanComplete: () => void
}

export function Header({ connected, onLogoClick, onRescanComplete }: Props) {
  const { theme, setTheme } = useTheme()
  const [scanning, setScanning] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function close(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropdownOpen])

  async function handleRescan() {
    if (scanning) return
    setScanning(true)
    try {
      await rescan()
      onRescanComplete()
    } catch (err) {
      console.error('Rescan failed:', err)
    } finally {
      setScanning(false)
    }
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: theme.header.bg, backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${theme.header.border}`,
      padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div onClick={onLogoClick} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: theme.accent.dim,
          display: 'grid', placeItems: 'center', color: theme.accent.main,
        }}>
          <HashIcon width={16} height={16} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          Planboard
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Rescan button */}
        <button
          onClick={handleRescan}
          disabled={scanning}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: scanning ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: fonts.body,
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            opacity: scanning ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {scanning ? 'Scanning...' : 'Rescan'}
        </button>

        {/* Theme picker */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: fonts.body,
              background: 'rgba(255,255,255,0.08)', color: '#fff',
            }}
          >
            <span style={{
              width: 14, height: 14, borderRadius: 4, flexShrink: 0,
              background: theme.accent.main, border: '2px solid rgba(255,255,255,0.3)',
            }} />
            {theme.label}
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: theme.bg.card,
              border: `1px solid ${theme.border.light}`,
              borderRadius: 10, padding: 4, minWidth: 180,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100,
            }}>
              {themes.map(t => (
                <button
                  key={t.name}
                  onClick={() => { setTheme(t); setDropdownOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, fontFamily: fonts.body, textAlign: 'left',
                    background: t.name === theme.name ? theme.accent.dim : 'transparent',
                    color: theme.text.primary,
                  }}
                >
                  <div style={{ display: 'flex', gap: 3 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: t.bg.base, border: `1px solid ${t.border.default}` }} />
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: t.accent.main, border: `1px solid ${t.border.default}` }} />
                  </div>
                  <span>{t.label}</span>
                  {t.name === theme.name && (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.accent.main} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <ConnectionDot connected={connected} />
      </div>
    </header>
  )
}
