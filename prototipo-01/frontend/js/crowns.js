// Máscaras originais são imutáveis. Os pontos vivos determinam os pares da revisão.
export const crownKinds = {
  copa_individual: { label: 'Copa individual candidata', color: '#137c66', dashArray: null },
  grupo_de_copas: { label: 'Grupo de copas', color: '#7954b5', dashArray: '7 3' },
  complemento_pendente: { label: 'Complemento pendente', color: '#b66a08', dashArray: '2 4' },
};

export function readCrowns(data) {
  if (data?.crs && !['EPSG:4326', 'urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:EPSG::4326'].includes(data.crs.properties?.name)) {
    throw new Error('Use copas com coordenadas geográficas WGS84.');
  }
  const coordinate = p => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite)
    && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  const ring = r => Array.isArray(r) && r.length >= 4 && r.every(coordinate)
    && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1];
  const polygon = p => Array.isArray(p) && p.length > 0 && p.every(ring);
  const ids = new Set();
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 10000
    || data.features.some(f => {
      const id = f?.properties?.copa_id;
      const geometry = f?.geometry;
      const valid = f?.type === 'Feature' && typeof id === 'string' && id.length > 0
        && f.id === id && !ids.has(id) && Object.hasOwn(crownKinds, f.properties.tipo)
        && (geometry?.type === 'Polygon' ? polygon(geometry.coordinates)
          : geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)
            && geometry.coordinates.length > 0 && geometry.coordinates.every(polygon));
      ids.add(id);
      return !valid;
    })) throw new Error('As copas precisam conter até 10.000 polígonos WGS84 com vínculos únicos e válidos.');
  return data;
}

export function pairCrowns(data, features) {
  const crowns = readCrowns(data);
  const byId = new Map(crowns.features.map(f => [f.properties.copa_id, f]));
  const ids = new Set();
  const paired = features.map(point => {
    const id = point.properties?.copa_id;
    const crown = byId.get(id);
    if (!crown || ids.has(id) || point.id !== id || crown.properties.tipo !== point.properties.tipo) {
      throw new Error('Há pontos sem copa correspondente ou vínculos duplicados. As camadas anteriores foram preservadas.');
    }
    ids.add(id);
    return crown;
  });
  return { ...crowns, features: paired };
}

export function livingCrowns(layer) {
  return layer.crowns ? pairCrowns(layer.crowns, layer.points.map(p => p.feature)) : null;
}

// IndexedDB evita colocar as geometrias grandes no localStorage dos pontos.
async function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Armazenamento de copas indisponível neste navegador.'));
    const request = indexedDB.open('arboriza-copas-v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('copas');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Feche outras abas antigas do mapa e tente novamente.'));
  });
}

export async function crownStorage(key, data) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('copas', data === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('copas');
      const request = data === undefined ? store.get(key) : data === null ? store.delete(key) : store.put(data, key);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Não foi possível guardar as copas.'));
    });
  } finally { db.close(); }
}

export function createCrownOverlay(map, onSelect) {
  map.createPane('crowns').style.zIndex = 410;
  map.createPane('crown-points').style.zIndex = 430;
  const features = new Map();
  let previousPoints, previousData, selected = new Set();
  const style = feature => {
    const chosen = selected.has(feature.properties.copa_id);
    return { ...crownKinds[feature.properties.tipo], color: chosen ? '#1683e0' : crownKinds[feature.properties.tipo].color,
      weight: chosen ? 3.5 : 2, opacity: 1, fillOpacity: chosen ? .28 : .17 };
  };
  const overlay = L.geoJSON(null, { pane: 'crowns', bubblingMouseEvents: false, style,
    onEachFeature(feature, path) {
      features.set(feature.properties.copa_id, path);
      path.on('click', event => onSelect(feature.properties.copa_id,
        event.originalEvent.ctrlKey || event.originalEvent.metaKey || event.originalEvent.shiftKey));
    },
  });
  return {
    render(layer, visible) {
      if (!visible || !layer.crowns) { overlay.remove(); return; }
      if (previousPoints !== layer.points || previousData !== layer.crowns) {
        previousPoints = layer.points; previousData = layer.crowns;
        overlay.clearLayers(); features.clear();
        if (layer.crowns) overlay.addData(livingCrowns(layer));
      }
      overlay.addTo(map);
    },
    select(ids) {
      const changed = new Set([...selected, ...ids]);
      selected = ids;
      changed.forEach(id => { const path = features.get(id); if (path) path.setStyle(style(path.feature)); });
    },
  };
}
