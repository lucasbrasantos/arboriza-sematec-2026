import { BoxSelect, MousePointer2, Move, Plus, Redo2, Trash2, Undo2 } from 'lucide-react'

export type PointTool = 'select' | 'move' | 'add' | 'box'
type Props = { tool: PointTool; selected: number; total: number; linked: boolean; editable: boolean; busy: boolean; dirty: boolean; canUndo: boolean; canRedo: boolean; status: string; onTool: (tool: PointTool) => void; onAll: () => void; onInvert: () => void; onClear: () => void; onDelete: () => void; onUndo: () => void; onRedo: () => void }
const tools = [{ id: 'select', label: 'Selecionar', key: 'V', icon: MousePointer2 }, { id: 'move', label: 'Mover', key: 'M', icon: Move }, { id: 'add', label: 'Adicionar', key: 'P', icon: Plus }, { id: 'box', label: 'Retângulo', key: 'B', icon: BoxSelect }] as const

export default function PointToolbar({ tool, selected, total, linked, editable, busy, dirty, canUndo, canRedo, status, onTool, onAll, onInvert, onClear, onDelete, onUndo, onRedo }: Props) {
  return <div className="editor-floating-toolbar ar-glass v2-point-toolbar" role="group" aria-label="Ferramentas de edição de pontos">
    <div className="v2-point-toolbar-head"><strong>{linked ? 'Pontos e copas' : 'Pontos'}</strong><span>{selected.toLocaleString('pt-BR')} {selected === 1 ? 'selecionado' : 'selecionados'}</span><div><button type="button" disabled={!editable || !total || busy} onClick={onAll}>Selecionar todos</button><button type="button" disabled={!editable || !total || busy} onClick={onInvert}>Inverter</button><button type="button" disabled={!selected || busy} onClick={onClear}>Limpar</button></div></div>
    <div className="v2-point-toolbar-actions">{tools.map(({ id, label, key, icon: Icon }) => <button key={id} type="button" aria-pressed={tool === id} aria-keyshortcuts={key} title={linked && (id === 'add' || id === 'move') ? 'Ponto e copa vinculados têm posições fixas.' : `${label} (${key})`} disabled={!editable || busy || linked && (id === 'add' || id === 'move')} onClick={() => onTool(id)}><kbd>{key}</kbd><Icon size={16} /><span>{label}</span></button>)}
      <button type="button" disabled={!editable || !selected || busy} onClick={onDelete} title={linked ? 'Excluir pontos e copas vinculadas (Delete)' : 'Apagar seleção (Delete)'}><kbd>Del</kbd><Trash2 size={16} /><span>Apagar</span></button>
      <button type="button" disabled={!canUndo || busy} onClick={onUndo} title="Desfazer (Ctrl+Z)"><kbd>Ctrl+Z</kbd><Undo2 size={16} /><span>Desfazer</span></button>
      <button type="button" disabled={!canRedo || busy} onClick={onRedo} title="Refazer (Ctrl+Y)"><kbd>Ctrl+Y</kbd><Redo2 size={16} /><span>Refazer</span></button>
    </div><p role="status" aria-live="polite">{status}{dirty && ' · Alterações nesta sessão ainda não foram salvas.'}</p>
  </div>
}
