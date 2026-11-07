import { motion, useSpring } from 'motion/react'
import type { PointerEvent } from 'react'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import './living-graphic.css'

export type GraphicKind = 'branch' | 'canopy' | 'leaf'
type LivingGraphicProps = {
  kind?: GraphicKind
  className?: string
  motionEnabled?: boolean
  replay?: number
}

const leaves = [
  { x: 160, y: 264, angle: -65, color: 'var(--ar-leaf)' },
  { x: 181, y: 228, angle: 54, color: 'var(--ar-green)' },
  { x: 202, y: 186, angle: -60, color: 'var(--ar-green)' },
  { x: 219, y: 143, angle: 52, color: 'var(--ar-leaf)' },
  { x: 233, y: 102, angle: -48, color: 'var(--ar-highlight, #e9b949)' },
  { x: 242, y: 63, angle: 15, color: 'var(--ar-forest)' },
] as const

/** Geometria decorativa. O gesto não altera dados nem representa uma espécie. */
export default function LivingGraphic({ kind = 'branch', className = '', motionEnabled = true, replay = 0 }: LivingGraphicProps) {
  const reduced = usePrefersReducedMotion()
  const enabled = motionEnabled && !reduced
  const turn = useSpring(0, { stiffness: 115, damping: 19 })
  const shift = useSpring(0, { stiffness: 90, damping: 22 })

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!enabled || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    const position = (event.clientX - rect.left) / rect.width - .5
    turn.set(position * 10)
    shift.set(position * 12)
  }

  return <motion.svg className={`ar-living-graphic ${className}`} viewBox="0 0 380 360" fill="none"
    aria-hidden="true" focusable="false" onPointerMove={move} onPointerLeave={() => { turn.set(0); shift.set(0) }}
    style={{ rotate: enabled ? turn : 0, x: enabled ? shift : 0 }}>
    <motion.g key={replay} initial={false} whileInView={{ rotate: enabled ? [0, -4, 3, 0] : 0 }}
      viewport={{ once: true, amount: .3 }} transition={{ duration: .8, ease: 'easeOut' }} style={{ transformOrigin: '50% 85%' }}>
      {kind === 'branch' && <>
        <path d="M119 331C182 264 228 143 245 35" stroke="var(--ar-forest)" strokeWidth="3" strokeLinecap="round" />
        {leaves.map(({ x, y, angle, color }, index) => <g key={y} transform={`translate(${x} ${y}) rotate(${angle})`}>
          <motion.g initial={false} whileInView={{ scale: enabled ? [.88, 1] : 1 }} viewport={{ once: true }}
            whileHover={enabled ? { rotate: -11, scale: 1.06 } : {}} transition={{ duration: .5, delay: index * .025 }}>
            <path d="M0 0C-63-18-55-96 0-112 55-96 63-18 0 0Z" fill={color} />
            <path d="M0-9v-87m0 55-21-18m21-6 17-16" stroke="var(--ar-paper)" strokeWidth="1.4" opacity=".8" />
          </motion.g>
        </g>)}
      </>}
      {kind === 'canopy' && <>
        <motion.g whileHover={enabled ? { rotate: -5 } : {}} style={{ transformOrigin: '50% 50%' }}>
          <path d="M40 167C40 89 96 32 174 32v135Z" fill="var(--ar-green)" />
          <path d="M188 32c78 0 134 57 134 135H188Z" fill="var(--ar-highlight, #e9b949)" />
          <path d="M40 181h134v134C96 315 40 259 40 181Z" fill="var(--ar-leaf)" />
          <path d="M188 181h134c0 78-56 134-134 134Z" fill="var(--ar-forest)" />
          <path d="M181 91v221m0-76-69-61m69 24 68-60" stroke="var(--ar-paper)" strokeWidth="2" />
        </motion.g>
        <circle cx="303" cy="284" r="26" fill="var(--ar-highlight, #e9b949)" />
      </>}
      {kind === 'leaf' && <>
        <path d="M188 316C36 239 52 93 188 29c136 64 152 210 0 287Z" fill="var(--ar-green)" />
        <path d="M188 316V29c136 64 152 210 0 287Z" fill="var(--ar-leaf)" />
        <path d="M188 342V69m0 103-56-40m56 99 67-50m-67 90-72-48" stroke="var(--ar-forest)" strokeWidth="2" />
        <circle cx="296" cy="72" r="30" fill="var(--ar-highlight, #e9b949)" />
      </>}
    </motion.g>
  </motion.svg>
}
