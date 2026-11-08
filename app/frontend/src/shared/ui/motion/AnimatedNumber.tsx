import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

type AnimatedNumberProps = { value: number; suffix?: string; motionEnabled?: boolean; delay?: number }

export default function AnimatedNumber({ value, suffix = '', motionEnabled = true, delay = 0 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const visible = useInView(ref, { once: true, amount: .6 })
  const reduced = usePrefersReducedMotion()
  const current = useMotionValue(0)
  const display = useTransform(current, (number) => Math.round(number).toString())
  const enabled = motionEnabled && !reduced

  useEffect(() => {
    if (!enabled) { current.set(value); return }
    if (!visible) return
    const animation = animate(current, value, { duration: 1.25, delay, ease: [.16, 1, .3, 1] })
    return () => animation.stop()
  }, [visible, enabled, current, value, delay])

  return <span className="ar-animated-number" ref={ref}>
    <span className="ar-sr-only">{value}{suffix}</span>
    <motion.span aria-hidden="true">{enabled ? display : String(value)}</motion.span>
    {suffix && <span className="ar-number-suffix" aria-hidden="true">{suffix}</span>}
  </span>
}
