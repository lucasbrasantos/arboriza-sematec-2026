// A escolha é por camada; a identidade da proposta é copa_id, não o índice visual.
export const isV2 = layer => layer.modelVersion === 2 || layer.points.some(p => p.feature.properties?.copa_id);
export const kindOf = layer => layer.analysisPart === 'pontos-grupos' ? 'grupo_de_copas'
  : layer.analysisPart === 'pontos-complementos' ? 'complemento_pendente'
    : layer.points[0]?.feature.properties?.tipo || 'copa_individual';
export const kindLabels = { copa_individual: 'Individuais', grupo_de_copas: 'Grupos de copas', complemento_pendente: 'Complementos pendentes' };

export function familyLayers(layer, all) {
  return layer.analysisId && isV2(layer) ? all.filter(item => item.analysisId === layer.analysisId && isV2(item)) : [];
}

export function prepareStreetLayers(layer, selected) {
  const layers = [], points = [], seen = new Set();
  for (const item of selected) {
    if (!layer.analysisId || item.analysisId !== layer.analysisId || !isV2(item)) {
      throw new Error('Selecione camadas da mesma execução do modelo v2.');
    }
    const ids = item.points.map(point => {
      const id = point.feature.properties?.copa_id;
      if (!id || point.feature.id !== id) throw new Error('A camada contém um ponto sem vínculo válido com sua copa.');
      if (!seen.has(id)) { seen.add(id); points.push(point.feature.geometry.coordinates.slice(0, 2)); }
      return id;
    });
    layers.push({ id_camada: item.id, ids_copas: ids });
  }
  if (!points.length) throw new Error('Selecione ao menos uma camada com propostas.');
  if (points.length > 50000 || layers.length > 12) throw new Error('Selecione até 12 camadas e 50.000 registros.');
  return { camadas: layers, points };
}

export function createStreetLayerPicker(current, all, onChange) {
  const $ = id => document.getElementById(id);
  const choices = new Map();
  let layoutKey;
  const available = () => familyLayers(current(), all());
  function selection() {
    return available().filter(layer => {
      const key = `${layer.analysisId}/${layer.id}`;
      if (!choices.has(key)) choices.set(key, kindOf(layer) !== 'complemento_pendente');
      return choices.get(key);
    });
  }
  return { selection,
    refresh(disabled = false) {
      const candidates = available();
      $('street-layer-picker').hidden = !isV2(current());
      if (!candidates.length) {
        if (isV2(current())) {
          $('street-layer-options').replaceChildren();
          $('street-layer-options').textContent = 'Esta camada precisa do vínculo com a análise original neste computador.';
          layoutKey = undefined;
        }
        return;
      }
      const chosen = new Set(selection().map(layer => layer.id));
      const key = JSON.stringify([current().analysisId, disabled, candidates.map(layer => [layer.id, layer.name, layer.points.length, chosen.has(layer.id)])]);
      if (key === layoutKey) return;
      layoutKey = key;
      $('street-layer-options').replaceChildren();
      for (const layer of candidates) {
        const label = document.createElement('label'); label.className = 'street-layer-option';
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = chosen.has(layer.id); input.disabled = disabled;
        const text = document.createElement('span'), title = document.createElement('strong'), detail = document.createElement('small');
        title.textContent = `${kindLabels[kindOf(layer)] || 'Propostas'} · ${layer.points.length}`;
        detail.textContent = layer.name; text.append(title, detail); label.append(input, text);
        input.onchange = () => { choices.set(`${layer.analysisId}/${layer.id}`, input.checked); onChange(); };
        $('street-layer-options').append(label);
      }
    },
  };
}
