// Estado dos pontos. Alterações imutáveis permitem histórico sem duplicar a camada inteira.
export class PointLayer {
  constructor(name, features = []) {
    this.name = name;
    this.sequence = Math.max(0, ...features.map(f => f.properties?.numero).filter(Number.isSafeInteger));
    this.points = features.map(feature => this.wrap(feature));
    this.selected = new Set();
    this.past = [];
    this.future = [];
  }

  wrap(feature) {
    const key = crypto.randomUUID();
    const number = feature.properties?.numero ?? ++this.sequence;
    return { key, number, feature: { ...feature, id: feature.id ?? key,
      properties: { ...feature.properties, numero: number } } };
  }

  snapshot(label) { return { points: this.points, selected: new Set(this.selected), label }; }

  commit(points, selected, label) {
    this.past.push(this.snapshot(label));
    if (this.past.length > 50) this.past.shift();
    this.future = [];
    this.points = points;
    this.selected = selected;
  }

  add(coordinates) {
    const point = this.wrap({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties: { origem: 'manual', revisado: false } });
    this.commit([...this.points, point], new Set([point.key]), 'Adicionar ponto');
  }

  remove() {
    if (!this.selected.size) return;
    this.commit(this.points.filter(p => !this.selected.has(p.key)), new Set(), 'Apagar pontos');
  }

  move(coordinates) {
    if (!coordinates.size) return;
    const changed = this.points.map(point => coordinates.has(point.key) ? {
      ...point, feature: { ...point.feature, geometry: {
        ...point.feature.geometry, coordinates: [...coordinates.get(point.key), ...point.feature.geometry.coordinates.slice(2)],
      } },
    } : point);
    this.commit(changed, new Set(this.selected), 'Mover pontos');
  }

  history(redo = false) {
    const from = redo ? this.future : this.past;
    const to = redo ? this.past : this.future;
    const entry = from.pop();
    if (!entry) return false;
    to.push(this.snapshot(entry.label));
    this.points = entry.points;
    this.selected = new Set(entry.selected);
    return true;
  }

  geojson() { return { type: 'FeatureCollection', features: this.points.map(p => p.feature) }; }
}

export function readPoints(data) {
  if (!data || typeof data !== 'object') throw new Error('O arquivo não contém um objeto GeoJSON válido.');
  const allowed = ['EPSG:4326', 'urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:EPSG::4326'];
  if (data.crs && !allowed.includes(data.crs.properties?.name)) throw new Error('Use coordenadas geográficas WGS84.');
  const features = data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : null;
  if (!Array.isArray(features) || features.length > 10000 || features.some(f => {
    const c = f?.geometry?.coordinates;
    return f?.type !== 'Feature' || f.geometry?.type !== 'Point' || !Array.isArray(c) || c.length < 2
      || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90;
  })) throw new Error('Envie até 10.000 pontos GeoJSON em longitude/latitude (WGS84).');
  const numbers = features.map(f => f.properties?.numero).filter(n => n !== undefined);
  if (numbers.some(n => !Number.isSafeInteger(n) || n <= 0) || new Set(numbers).size !== numbers.length) {
    throw new Error('Os números dos pontos devem ser inteiros positivos e únicos na camada.');
  }
  return features;
}
