import * as Switch from '@radix-ui/react-switch'
import { useId } from 'react'
import './ui.css'

type ToggleProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export default function Toggle({ label, checked, onChange, disabled = false }: ToggleProps) {
  const id = useId()
  return <div className="ar-toggle-field">
    <label htmlFor={id}>{label}</label>
    <Switch.Root id={id} className="ar-switch" checked={checked} onCheckedChange={onChange} disabled={disabled}>
      <Switch.Thumb className="ar-switch-thumb" />
    </Switch.Root>
  </div>
}
