import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
import type { MotionStyle, MotionValue } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import './ui.css'

type GlassPanelProps = {
  children: ReactNode
  className?: string
  style?: MotionStyle
  interactive?: boolean
  motionEnabled?: boolean
}

export default function GlassPanel({ children, className = '', style, interactive = true, motionEnabled = true }: GlassPanelProps) {
  const reduced = usePrefersReducedMotion()
  const enabled = interactive && motionEnabled && !reduced
  const turnX = useSpring(0, { stiffness: 160, damping: 24 })
  const turnY = useSpring(0, { stiffness: 160, damping: 24 })
  const lightX = useMotionValue(50)
  const lightY = useMotionValue(0)
  const reflection = useMotionTemplate`radial-gradient(500px circle at ${lightX}% ${lightY}%, rgb(255 255 255 / .38), transparent 65%)`

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    turnX.set((.5 - y) * 6)
    turnY.set((x - .5) * 6)
    lightX.set(x * 100)
    lightY.set(y * 100)
  }

  function reset() {
    turnX.set(0)
    turnY.set(0)
    lightX.set(50)
    lightY.set(0)
  }

  const panelStyle: MotionStyle & { '--reflection': MotionValue<string> } = {
    ...style,
    rotateX: enabled ? turnX : 0,
    rotateY: enabled ? turnY : 0,
    '--reflection': reflection,
  }

  return <motion.div className={`ar-glass ${className}`} style={panelStyle} onPointerMove={move} onPointerLeave={reset}>
    {children}
  </motion.div>
}
