import centro from '../../assets/samples/centro.jpg'
import norte from '../../assets/samples/norte.jpg'

export type AnalysisRecord = { id: string; name: string; description: string; coverage: string; origin: 'Análise de imagem' | 'Importação'; state: 'review' | 'empty'; points: number; segments: number; preview: string | null }
// Cenários fictícios de interface; não são registros salvos ou análises reais.
export const demoRecords: readonly AnalysisRecord[] = [
  { id: 'centro', name: 'Arborização do Centro', description: 'Primeira análise ilustrativa', coverage: 'Recorte Centro · X', origin: 'Análise de imagem', state: 'review', points: 6, segments: 2, preview: centro },
  { id: 'centro-reanalise', name: 'Centro — nova avaliação', description: 'Outra análise da mesma abrangência; apenas uma pode ficar publicada', coverage: 'Recorte Centro · X', origin: 'Análise de imagem', state: 'review', points: 6, segments: 2, preview: centro },
  { id: 'centro-norte', name: 'Corredor Centro–Norte', description: 'Abrangência combinada, que pode coexistir com X', coverage: 'Conjunto demonstrativo · X + Y', origin: 'Importação', state: 'review', points: 9, segments: 3, preview: norte },
]
export const areaStateLabels: Record<AnalysisRecord['state'], string> = { review: 'Revisão pendente', empty: 'Sem resultados' }
export function normalizeAreaSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim() }
