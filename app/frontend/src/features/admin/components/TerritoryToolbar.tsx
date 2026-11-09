import { ArrowLeft, BoxSelect, Check, MousePointer2, Pencil, LocateFixed } from 'lucide-react'
import type { TerritoryOperation, TerritoryTool } from './TerritoryDrawing'

type Props = { tool: TerritoryTool; operation: TerritoryOperation; count: number; busy: boolean; available: boolean; status: string; onTool: (tool: TerritoryTool) => void; onOperation: (operation: TerritoryOperation) => void; onFit: () => void; onAll: () => void; onInvert: () => void; onClear: () => void; onBack: () => void; onClose: () => void }
const tools = [{ id: 'click', label: 'Setor', icon: MousePointer2 }, { id: 'box', label: 'Retângulo', icon: BoxSelect }, { id: 'free', label: 'Desenho livre', icon: Pencil }] as const

export default function TerritoryToolbar({ tool, operation, count, busy, available, status, onTool, onOperation, onFit, onAll, onInvert, onClear, onBack, onClose }: Props) {
  return <div className="editor-floating-toolbar ar-glass v2-territory-toolbar" role="group" aria-label="Ferramentas de seleção territorial">
    <div className="v2-territory-toolbar-head"><strong>Seleção territorial</strong><span>{count.toLocaleString('pt-BR')} {count === 1 ? 'setor' : 'setores'}</span><button type="button" onClick={onBack} disabled={busy}><ArrowLeft size={14} /> Voltar</button><button type="button" onClick={onClose} disabled={busy}><Check size={14} /> Concluir</button></div>
    <div className="v2-territory-toolbar-row">{tools.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tool === id} disabled={busy} onClick={() => onTool(id)}><Icon size={15} /><span>{label}</span></button>)}
      <button type="button" disabled={!count || busy} onClick={onFit}><LocateFixed size={15} /><span>Enquadrar</span></button>
    </div>
    <div className="v2-territory-toolbar-actions"><label>Ao desenhar<select value={operation} disabled={busy} onChange={(event) => { const next = event.currentTarget.value; if (next === 'replace' || next === 'add' || next === 'remove') onOperation(next) }}><option value="replace">Substituir</option><option value="add">Adicionar</option><option value="remove">Remover</option></select></label>
      <div className="v2-territory-bulk"><button type="button" disabled={busy || !available} onClick={onAll}>Todos</button><button type="button" disabled={busy || !available} onClick={onInvert}>Inverter</button><button type="button" disabled={!count || busy} onClick={onClear}>Limpar</button></div>
    </div>
    <p role="status" aria-live="polite">{status}</p>
  </div>
}
