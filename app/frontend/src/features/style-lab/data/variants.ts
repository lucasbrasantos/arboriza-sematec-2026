export type StyleVariant = 'natural' | 'profundo' | 'equilibrio'

type VariantConfig = { label: string; description: string; opacity: number; blur: number }

export const variants: Record<StyleVariant, VariantConfig> = {
	natural: { label: 'Natural', description: 'Luz, cores vegetais e superfícies suaves. Uma direção mais próxima do UrbVerde.', opacity: 90, blur: 10 },
	profundo: { label: 'Profundidade', description: 'Vidro mais presente, luz sobre a fotografia e uma atmosfera imersiva.', opacity: 55, blur: 30 },
	equilibrio: { label: 'Equilíbrio', description: 'A leveza da natureza com profundidade nos lugares certos. Nossa combinação recomendada.', opacity: 68, blur: 22 },
}

export const variantOrder: readonly StyleVariant[] = ['natural', 'profundo', 'equilibrio']
