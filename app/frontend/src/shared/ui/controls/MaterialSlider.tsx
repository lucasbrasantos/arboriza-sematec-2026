import * as Slider from '@radix-ui/react-slider'
import '../styles/ui.css'

type MaterialSliderProps = {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (value: number) => void
}

export default function MaterialSlider({ label, value, min, max, unit, onChange }: MaterialSliderProps) {
  return <div className="ar-slider-field">
    <div className="ar-slider-label"><span>{label}</span><output>{value}{unit}</output></div>
    <Slider.Root className="ar-slider" min={min} max={max} step={1} value={[value]} onValueChange={(values) => {
      const next = values[0]
      if (next !== undefined) onChange(next)
    }}>
      <Slider.Track className="ar-slider-track"><Slider.Range className="ar-slider-range" /></Slider.Track>
      <Slider.Thumb className="ar-slider-thumb" aria-label={label} />
    </Slider.Root>
  </div>
}
