// const _AREA_COLOR = '#F39D24';
const _AREA_COLOR = '#F39D24';

export const recortes = {
	centro: [[-21.2102, -50.4404], [-21.2079, -50.4379]],
	norte: [[-21.208, -50.442], [-21.2057, -50.4395]],
};

export function readStudyArea(value) {
	const b = value?.bounds;
	if (!Array.isArray(b) || b.length !== 2 || b.some(p => !Array.isArray(p) || p.length !== 2
		|| !p.every(Number.isFinite) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)
		|| b[0][0] >= b[1][0] || b[0][1] >= b[1][1]) return undefined;
	const key = value.recorte === 'centro-norte' ? 'norte' : value.recorte;
	// Limites personalizados não podem habilitar a análise de um recorte diferente.
	const known = recortes[key]?.every((p, i) => p.every((n, j) => Math.abs(n - b[i][j]) < 1e-8));
	return { recorte: known ? key : 'custom', bounds: b.map(p => [...p]) };
}

export function studyAreaFor(layer) {
	let result = readStudyArea(layer.studyArea);
	const points = layer.points.map(p => p.feature.geometry.coordinates);
	if (!result) {
		const sources = [...new Set(layer.points.map(p => p.feature.properties.recorte).filter(Boolean))];
		const filename = layer.name.match(/^arboriza-pontos_(centro-norte|centro)(?:_|\.geojson$)/i)?.[1].toLowerCase();
		const source = layer.recorte || (sources.length === 1 ? sources[0] : sources.length ? null : filename);
		const key = source === 'centro-norte' ? 'norte' : source;
		if (recortes[key]) result = { recorte: key, bounds: recortes[key].map(p => [...p]) };
	}
	if (!points.length) return result;
	if (result && points.every(([lng, lat]) => lat >= result.bounds[0][0] && lat <= result.bounds[1][0]
		&& lng >= result.bounds[0][1] && lng <= result.bounds[1][1])) return result;
	// Camadas antigas sem recorte ou pontos movidos para fora dele: incluir todos os pontos.
	const coordinates = points.map(([lng, lat]) => [lat, lng]).concat(result?.bounds || []);
	const south = Math.min(...coordinates.map(p => p[0])), north = Math.max(...coordinates.map(p => p[0]));
	const west = Math.min(...coordinates.map(p => p[1])), east = Math.max(...coordinates.map(p => p[1]));
	const margin = result ? 0 : .0001;
	return { recorte: 'custom', bounds: [[Math.max(-90, south-margin), Math.max(-180, west-margin)],
		[Math.min(90, north+margin), Math.min(180, east+margin)]] };
}

export function createMap(onLoading, onError) {
	const map = L.map('map', { zoomControl: false, maxZoom: 21, preferCanvas: true, boxZoom: false });
	L.control.zoom({ position: 'topright' }).addTo(map);
	L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
	map.createPane('preview').style.zIndex = 190;

	const preview = (file, bounds) => L.imageOverlay(`assets/${file}.jpg`, bounds, { pane: 'preview', interactive: false });

	const detail = L.tileLayer.wms('https://datageo.ambiente.sp.gov.br/geoimage/datageoimg/ows', {
		layers: 'ORTOFOTOS_SP_2023_2024', format: 'image/jpeg', version: '1.1.1',
		attribution: 'Ortofotos © IGC-SP / DataGEO, 2023/2024',
		tileSize: 512, maxNativeZoom: 19, maxZoom: 21, keepBuffer: 3,
		updateWhenZooming: false, updateWhenIdle: true, updateInterval: 250,
	});

	const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		maxNativeZoom: 19, maxZoom: 21, updateWhenZooming: false,
	});

	const bases = {
		ortofoto: L.layerGroup([
			preview('cidade', [[-21.27, -50.49], [-21.15, -50.38]]),
			preview('centro', recortes.centro), preview('norte', recortes.norte), detail,
		]),
		ruas: streets,
	};

	[detail, streets].forEach(layer => {
		layer.on('loading load', () => { if (map.hasLayer(layer)) onLoading(layer.isLoading()); });
		layer.on('tileerror', () => { if (map.hasLayer(layer)) onError(); });
	});

	bases.ortofoto.addTo(map);

	// const area = L.rectangle(recortes.centro, {
	// 	color: _AREA_COLOR, weight: 2, dashArray: '6 5', fillOpacity: .03, interactive: false,
	// }).addTo(map);

	const area = L.rectangle(recortes.centro, {
		color: _AREA_COLOR,
		weight: 4,
		dashArray: '6 5',
		fillColor: _AREA_COLOR,
		fillOpacity: 0.15,
		interactive: false
	}).addTo(map);

	const markers = L.layerGroup().addTo(map);
	const heat = L.heatLayer?.([], { radius: 28, blur: 22, maxZoom: 19, minOpacity: .3 });

	const setBase = name => {
		Object.entries(bases).forEach(([key, layer]) => key === name ? layer.addTo(map) : map.removeLayer(layer));
		onLoading((name === 'ortofoto' ? detail : streets).isLoading());
	};
	const fitArea = () => map.fitBounds(area.getBounds(), { padding: [32, 32] });
	return { map, area, markers, heat, setBase, fitArea };
}
