import { useState, useEffect } from 'preact/hooks'
import { ComponentChildren } from 'preact'

interface Props {
  children: ComponentChildren
  routeKey: string
}

export function PageWrap({ children, routeKey }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [routeKey])

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    }}>
      {children}
    </div>
  )
}
