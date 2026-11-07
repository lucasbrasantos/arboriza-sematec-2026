import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'

type RevealProps = { children: ReactNode; className?: string; delay?: number; motionEnabled?: boolean }

export default function Reveal({ children, className, delay = 0, motionEnabled = true }: RevealProps) {
  const reduced = usePrefersReducedMotion()
  const enabled = motionEnabled && !reduced
  return <motion.div className={className} initial={{ y: enabled ? 16 : 0 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .65, delay, ease: [.16, 1, .3, 1] }}>
    {children}
  </motion.div>
}
