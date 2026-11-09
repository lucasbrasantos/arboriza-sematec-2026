import { useMemo, useState } from 'react'
import type { Coordinate, MapItem, PointItem } from '../../map/data/map-data'
import type { ResultLayer } from '../data/result-layers'

type Snapshot = { items: MapItem[]; selected: string[]; label: string }
type Draft = { items: MapItem[]; selected: string[]; past: Snapshot[]; future: Snapshot[]; dirty: boolean }
type Drafts = Record<string, Draft>
const emptyDraft = (layer: ResultLayer): Draft => ({ items: layer.items, selected: [], past: [], future: [], dirty: false })
const snapshot = (draft: Draft, label: string): Snapshot => ({ items: draft.items, selected: draft.selected, label })
const pointItems = (items: MapItem[]): PointItem[] => items.filter((item): item is PointItem => item.kind === 'point')

export function usePointEditor(source: readonly ResultLayer[]) {
  const [drafts, setDrafts] = useState<Drafts>({})
  const layers = useMemo(() => source.map((layer) => drafts[layer.id] ? { ...layer, items: drafts[layer.id]?.items ?? layer.items } : layer), [source, drafts])
  const selectedIds = useMemo(() => new Set(Object.values(drafts).flatMap((draft) => draft.selected)), [drafts])
  function selected(layer: ResultLayer): ReadonlySet<string> { return new Set(drafts[layer.id]?.selected ?? []) }
  function update(layer: ResultLayer, transform: (draft: Draft) => Draft) {
    setDrafts((current) => ({ ...current, [layer.id]: transform(current[layer.id] ?? emptyDraft(layer)) }))
  }
  function commit(draft: Draft, items: MapItem[], selectedIds: string[], label: string): Draft {
    return { items, selected: selectedIds, past: [...draft.past, snapshot(draft, label)].slice(-50), future: [], dirty: true }
  }
  function pick(layer: ResultLayer, id: string, additive: boolean) {
    update(layer, (draft) => { const next = additive ? new Set(draft.selected) : new Set<string>(); if (additive && next.has(id)) next.delete(id); else next.add(id); return { ...draft, selected: [...next] } })
  }
  function selectMany(layer: ResultLayer, ids: string[], additive = false) {
    update(layer, (draft) => ({ ...draft, selected: [...new Set([...(additive ? draft.selected : []), ...ids])] }))
  }
  function selectAll(layer: ResultLayer) { update(layer, (draft) => ({ ...draft, selected: pointItems(draft.items).map((item) => item.id) })) }
  function invert(layer: ResultLayer) { update(layer, (draft) => { const previous = new Set(draft.selected); return { ...draft, selected: pointItems(draft.items).filter((item) => !previous.has(item.id)).map((item) => item.id) } }) }
  function clear(layer: ResultLayer) { update(layer, (draft) => ({ ...draft, selected: [] })) }
  function remove(layer: ResultLayer) {
    update(layer, (draft) => { const selected = new Set(draft.selected); return selected.size ? commit(draft, draft.items.filter((item) => !selected.has(item.id)), [], 'Apagar pontos') : draft })
  }
  function add(layer: ResultLayer, position: Coordinate) {
    const id = `manual:${crypto.randomUUID()}`
    const point: PointItem = { id, kind: 'point', area: 'cidade', label: 'Ponto adicionado manualmente', position, properties: { origem: 'manual', revisado: false } }
    update(layer, (draft) => commit(draft, [...draft.items, point], [id], 'Adicionar ponto'))
  }
  function move(layer: ResultLayer, coordinates: ReadonlyMap<string, Coordinate>) {
    if (!coordinates.size) return
    update(layer, (draft) => commit(draft, draft.items.map((item) => item.kind === 'point' && coordinates.has(item.id) ? { ...item, position: coordinates.get(item.id) ?? item.position } : item), draft.selected, 'Mover pontos'))
  }
  function history(layer: ResultLayer, redo: boolean) {
    update(layer, (draft) => {
      const from = redo ? draft.future : draft.past
      const previous = from.at(-1)
      if (!previous) return draft
      return redo
        ? { ...draft, items: previous.items, selected: previous.selected, future: from.slice(0, -1), past: [...draft.past, snapshot(draft, previous.label)].slice(-50), dirty: true }
        : { ...draft, items: previous.items, selected: previous.selected, past: from.slice(0, -1), future: [...draft.future, snapshot(draft, previous.label)].slice(-50), dirty: true }
    })
  }
  function replaceLayers(ids: string[]) { setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id)))) }
  const draft = (layer: ResultLayer) => drafts[layer.id] ?? emptyDraft(layer)
  return { replaceLayers, layers, selectedIds, draft, selected, pick, selectMany, selectAll, invert, clear, remove, add, move, history }
}
