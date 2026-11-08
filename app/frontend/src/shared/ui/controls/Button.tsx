import type { ComponentPropsWithoutRef } from 'react'
import '../styles/ui.css'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  appearance?: 'primary' | 'secondary' | 'quiet'
}

export default function Button({ appearance = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`ar-button ar-button--${appearance} ${className}`} {...props} />
}
