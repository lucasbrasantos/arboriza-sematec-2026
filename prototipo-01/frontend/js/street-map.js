import { outsideRings, streetCategory } from './street-data.js';

export function createStreetMap(map, onSelect) {
	const pointColor = kind => ({ copa_individual: '#137c66', grupo_de_copas: '#7954b5', complemento_pendente: '#b66a08' }[kind] || '#245c40');
	const panes = { streetMask: 430, streetRoads: 440, streetPoints: 455, streetSelected: 450, streetBoundary: 460 };
	for (const [name, zIndex] of Object.entries(panes)) {
		if (!map.getPane(name)) map.createPane(name).style.zIndex = zIndex;
		if (name !== 'streetRoads') map.getPane(name).style.pointerEvents = 'none';
	}
	let layers = [], lines = new Map(), casings = new Map(), points = [], selected = null, contours = [], features;
	const keep = layer => { layers.push(layer); layer.addTo(map); return layer; };
	const baseStyle = feature => ({ pane: 'streetRoads', color: streetCategory(feature) === 'no-points' ? '#df7416' : '#059b83',
		weight: 7, opacity: .82, lineCap: 'round', lineJoin: 'round', bubblingMouseEvents: false });
	function clear() {
		layers.forEach(layer => map.removeLayer(layer));
		layers = []; lines.clear(); casings.clear(); points = []; selected = null; contours = [];
	}
	function draw(data, layerPoints) {
		clear(); features = data;
		keep(L.polygon(outsideRings(data.arboriza.geometria_contexto_visual || data.arboriza.geometria_setores), { pane: 'streetMask', stroke: false,
			fillColor: '#10281f', fillOpacity: .5, fillRule: 'evenodd', interactive: false }));
		for (const style of [{ color: '#183d30', weight: 2.5, opacity: .65 }, { color: '#fff', weight: 1.3, dashArray: '5 7', opacity: .95 }]) {
			contours.push(keep(L.geoJSON(data.arboriza.geometria_setores,
				{ pane: 'streetBoundary', interactive: false, style: { ...style, pane: 'streetBoundary', fill: false, interactive: false } })));
		}
		// Uma base clara separa as vias da fotografia sem tornar a faixa colorida opaca.
		keep(L.geoJSON(data, { pane: 'streetRoads', interactive: false,
			style: { pane: 'streetRoads', color: '#ffffff', weight: 12, opacity: .38,
				lineCap: 'round', lineJoin: 'round', interactive: false },
			onEachFeature(feature, path) { casings.set(String(feature.id), path); } }));
		keep(L.geoJSON(data, { attribution: 'Vias © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
			pane: 'streetRoads', style: baseStyle, onEachFeature(feature, path) {
				lines.set(String(feature.id), path); path.on('click', () => onSelect(String(feature.id)));
			} }));
		const group = keep(L.layerGroup());
		points = layerPoints.map((point, index) => L.circleMarker([point[1], point[0]], { pane: 'streetPoints', radius: 3.5,
			color: '#ffffff', weight: 1.2, fillColor: pointColor(data.arboriza.tipos_pontos?.[index]), fillOpacity: .95, interactive: false }).addTo(group));
	}
	function select(id) {
		if (selected) { map.removeLayer(selected); layers = layers.filter(l => l !== selected); selected = null; }
		points.forEach((point, index) => point.setStyle({ radius: 3.5, fillColor: pointColor(features?.arboriza.tipos_pontos?.[index]), weight: 1.2 }));
		const feature = features?.features.find(f => String(f.id) === id);
		if (!feature) return;
		selected = keep(L.layerGroup([
			L.geoJSON(feature, { pane: 'streetSelected', interactive: false,
				style: { pane: 'streetSelected', color: '#ffffff', weight: 15, opacity: .7, interactive: false } }),
			L.geoJSON(feature, { pane: 'streetSelected', interactive: false,
				style: { pane: 'streetSelected', color: '#1677d2', weight: 10, opacity: .9, lineCap: 'round', lineJoin: 'round', interactive: false } })
		]));
		for (const assigned of feature.properties.pontos_associados || []) points[assigned.indice]?.setStyle({ radius: 6, fillColor: '#1677d2', weight: 2 });
	}
	return { draw, clear, select,
		focus(id) { const line = lines.get(id); if (line) map.fitBounds(line.getBounds(), { padding: [65, 65], maxZoom: 19, animate: false }); },
		filter(ids) {
			for (const [id, line] of lines) {
				const visible = ids.has(id); line.options.interactive = visible;
				line.setStyle({ opacity: visible ? .82 : .1, weight: visible ? 7 : 2.5 });
				casings.get(id)?.setStyle({ opacity: visible ? .38 : .03, weight: visible ? 12 : 5 });
			}
		},
		showBoundary(show) { for (const line of contours) show ? line.addTo(map) : map.removeLayer(line); }
	};
}
