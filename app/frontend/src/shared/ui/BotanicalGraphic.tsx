import { motion } from 'motion/react'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import './botanical.css'

type BotanicalGraphicProps = { className?: string; kind?: 'leaves' | 'canopy'; motionEnabled?: boolean }

export default function BotanicalGraphic({ className = '', kind = 'leaves', motionEnabled = true }: BotanicalGraphicProps) {
  const reduced = usePrefersReducedMotion()
  const enabled = motionEnabled && !reduced
  return <svg className={`ar-botanical ${className}`} viewBox="0 0 420 300" fill="none" aria-hidden="true" focusable="false">
    {kind === 'canopy' ? <g>
      <path d="M25 145C25 73 84 22 156 22v123Z" fill="var(--ar-leaf)" />
      <path d="M166 145V22c73 0 132 51 132 123Z" fill="var(--ar-green)" />
      <path d="M25 155h131v123C84 278 25 227 25 155Z" fill="var(--ar-forest)" />
      <path d="M166 155h132c0 72-59 123-132 123Z" fill="var(--ar-mint)" />
      <motion.path d="M86 226c0-113 139-7 139-128" stroke="currentColor" strokeWidth="1.5" initial={{ pathLength: enabled ? .1 : 1 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.5 }} />
    </g> : <g stroke="currentColor" strokeWidth="1.2">
      <path d="M202 269C64 217 68 72 205 27c119 71 135 185-3 242Z" fill="var(--ar-leaf)" stroke="none" />
      <motion.path d="M91 294C191 223 203 135 205 27M205 178l-65-41m62-2 52-39m-71 122-64-30m79-14 74-40" initial={{ pathLength: enabled ? .05 : 1 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6 }} />
      <path d="M312 253c-24-72 11-129 84-135 31 83-5 132-84 135Z" />
      <path d="m312 253 84-135m-64 101 37 1m-15-33-4-35" />
    </g>}
  </svg>
}
