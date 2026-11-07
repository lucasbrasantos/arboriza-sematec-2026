import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import branchImage from '../../assets/graphics/botanical-branch.png'
import './botanical-cutout.css'

type BotanicalCutoutProps = { className?: string; replay?: number; eager?: boolean }

/** Imagem sintética decorativa, aprovada no laboratório. Não representa dado ambiental. */
export default function BotanicalCutout({ className = '', replay = 0, eager = false }: BotanicalCutoutProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const turn = useSpring(0, { stiffness: 95, damping: 23 })
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const drift = useTransform(scrollYProgress, [0, 1], [12, -12])

  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    turn.set(((event.clientX - rect.left) / rect.width - .5) * 9)
  }

  return <motion.div ref={ref} className={`ar-botanical-cutout ${className}`} aria-hidden="true"
    onPointerMove={move} onPointerLeave={() => turn.set(0)} style={{ rotate: reduced ? 0 : turn, y: reduced ? 0 : drift }}>
    <motion.img key={replay} src={branchImage} alt="" width={1536} height={1024} loading={eager ? 'eager' : 'lazy'}
      initial={false} whileInView={{ rotate: reduced ? 0 : [0, -5, 2, 0] }} viewport={{ once: true }} transition={{ duration: .85 }} />
  </motion.div>
}
