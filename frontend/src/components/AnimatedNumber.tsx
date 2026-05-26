import { useState, useEffect } from 'preact/hooks'

interface Props {
  value: number
  duration?: number
}

export function AnimatedNumber({ value, duration = 900 }: Props) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start = 0
    const step = Math.max(1, Math.ceil(value / (duration / 16)))
    const id = setInterval(() => {
      start = Math.min(start + step, value)
      setDisplay(start)
      if (start >= value) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [value, duration])

  return <>{display}</>
}
