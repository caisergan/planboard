import { useState, useEffect } from 'preact/hooks'
import { useTheme, fonts } from '../lib/theme'

interface Props {
  percentage: number
  size?: number
  strokeWidth?: number
}

export function ProgressRing({ percentage, size = 58, strokeWidth = 4 }: Props) {
  const { theme } = useTheme()
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const target = circ * (1 - percentage / 100)
  const [offset, setOffset] = useState(circ)

  useEffect(() => {
    const id = setTimeout(() => setOffset(target), 80)
    return () => clearTimeout(id)
  }, [target])

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.ring.track} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={theme.accent.main} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
      <text
        x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill={theme.text.primary} fontSize={size * 0.24}
        fontFamily={fonts.body} fontWeight="600"
      >
        {percentage}%
      </text>
    </svg>
  )
}
