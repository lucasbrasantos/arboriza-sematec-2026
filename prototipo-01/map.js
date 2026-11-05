// const _AREA_COLOR = '#F39D24';
const _AREA_COLOR = '#F39D24';

export const recortes = {
	centro: [[-21.2102, -50.4404], [-21.2079, -50.4379]],
	norte: [[-21.208, -50.442], [-21.2057, -50.4395]],
};

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
