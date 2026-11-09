import L from 'leaflet';
import { segmentIntensity, intensityColor } from './street-intensity.js';
import { outsideRings } from './street-data.js';

export function createStreetMap(map, onSelect, metric = 'base-rate') {
	const pointColor = kind => ({ copa_individual: '#137c66', grupo_de_copas: '#7954b5', complemento_pendente: '#b66a08' }[kind] || '#245c40');
	const panes = { streetMask: 430, streetRoads: 440, streetPoints: 455, streetSelected: 450, streetBoundary: 460 };
	for (const [name, zIndex] of Object.entries(panes)) {
		if (!map.getPane(name)) map.createPane(name).style.zIndex = zIndex;
		if (name !== 'streetRoads') map.getPane(name).style.pointerEvents = 'none';
	}
	let maximum = 0;
	let layers = [], lines = new Map(), casings = new Map(), points = [], pointGroup = null, selected = null, contours = [], features;
	const keep = layer => { layers.push(layer); layer.addTo(map); return layer; };
	const baseStyle = feature => ({ pane: 'streetRoads', color: intensityColor(segmentIntensity(feature, metric), maximum),
		weight: 7, opacity: .82, lineCap: 'round', lineJoin: 'round', bubblingMouseEvents: false });
	function clear() {
		layers.forEach(layer => map.removeLayer(layer));
		layers = []; lines.clear(); casings.clear(); points = []; pointGroup = null; selected = null; contours = [];
	}
	function draw(data, layerPoints) {
		clear(); features = data; maximum = data.features.reduce((max, feature) => Math.max(max, segmentIntensity(feature, metric)), 0);
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
		const group = pointGroup = keep(L.layerGroup());
		points = layerPoints.map((point, index) => L.circleMarker([point[1], point[0]], { pane: 'streetPoints', radius: 3.5,
			color: '#ffffff', weight: 1.2, fillColor: pointColor(data.arboriza.tipos_pontos?.[index]), fillOpacity: .95, interactive: false }).addTo(group));
	}
	function select(id) {
		if (selected) { map.removeLayer(selected); layers = layers.filter(l => l !== selected); selected = null; }
		points.forEach((point, index) => point.setStyle({ radius: 3.5, fillColor: pointColor(features?.arboriza.tipos_pontos?.[index]), weight: 1.2 }));
        const chosenIds = new Set(Array.isArray(id) ? id : id ? [id] : []);
        const chosen = features?.features.filter(f => chosenIds.has(String(f.id))) || [];
        if (!chosen.length) return;
        selected = keep(L.layerGroup(chosen.flatMap(feature => [
            L.geoJSON(feature, { pane: 'streetSelected', interactive: false,
                style: { pane: 'streetSelected', color: '#ffffff', weight: 15, opacity: .7, interactive: false } }),
            L.geoJSON(feature, { pane: 'streetSelected', interactive: false,
                style: { pane: 'streetSelected', color: '#1677d2', weight: 10, opacity: .9, lineCap: 'round', lineJoin: 'round', interactive: false } })
        ])));
        for (const feature of chosen) for (const assigned of feature.properties.pontos_associados || []) points[assigned.indice]?.setStyle({ radius: 6, fillColor: '#1677d2', weight: 2 });
	}
	return { draw, clear, select,
		focus(id) { const paths = (Array.isArray(id) ? id : [id]).map(key => lines.get(key)).filter(Boolean); if (paths.length) map.fitBounds(L.featureGroup(paths).getBounds(), { padding: [65, 65], maxZoom: 19, animate: false }); },
		filter(ids) {
			for (const [id, line] of lines) {
				const visible = ids.has(id); line.options.interactive = visible;
				line.setStyle({ opacity: visible ? .82 : .1, weight: visible ? 7 : 2.5 });
				casings.get(id)?.setStyle({ opacity: visible ? .38 : .03, weight: visible ? 12 : 5 });
			}
		},
		showBoundary(show) { for (const line of contours) { if (show) line.addTo(map); else map.removeLayer(line); } },
		showPoints(show) { if (pointGroup) { if (show) pointGroup.addTo(map); else map.removeLayer(pointGroup); } }
	};
}
