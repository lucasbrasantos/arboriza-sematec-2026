import centro from '../../assets/samples/centro.jpg'
import norte from '../../assets/samples/norte.jpg'

export type WorkArea = { id: string; name: string; description: string; state: 'review' | 'empty'; points: number; segments: number; preview: string | null }
// Cenários fictícios de interface; não são registros salvos ou análises reais.
export const workAreas: readonly WorkArea[] = [
  { id: 'centro', name: 'Centro', description: 'Recorte de referência do protótipo', state: 'review', points: 6, segments: 2, preview: centro },
  { id: 'norte', name: 'Centro-norte', description: 'Outro recorte para explorar a organização', state: 'review', points: 3, segments: 1, preview: norte },
  { id: 'nova-area', name: 'Área de estudo', description: 'Exemplo de área ainda sem resultados', state: 'empty', points: 0, segments: 0, preview: null },
]
export const areaStateLabels: Record<WorkArea['state'], string> = { review: 'Revisão pendente', empty: 'Sem resultados' }
export function normalizeAreaSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim() }
