import { streetEntries, streetTotals, visibleStreets } from './street-data.js';
import { createStreetMap } from './street-map.js?v=3';
import { createStreetPanel } from './street-panel.js?v=3';
import { createStreetLayerPicker, isV2, prepareStreetLayers } from './street-inputs.js';

// O modo de leitura usa uma cópia visual; os pontos editáveis permanecem na camada.
export function connectStreetAnalysis({ map, current, getLayers = () => [current()], isTerritoryActive = () => false, exitTerritory = () => {},
	onDiagnostic = () => {}, shouldFocus = () => false, createMapView = createStreetMap, createPanel = createStreetPanel, createPicker = createStreetLayerPicker }) {
	const $ = id => document.getElementById(id);
	let active = false, controller = null, resultKey = null, entries = [], category = 'all', search = '', selected = null, distance = 25;
	const picker = createPicker(current, getLayers, refresh);
	const selectedLayers = () => isV2(current()) ? picker.selection() : [current()];
	const signature = layer => JSON.stringify({ id: layer.id, analysisId: layer.analysisId,
		layers: selectedLayers().map(part => [part.id, part.points.map(item => [item.feature.id, item.feature.geometry.coordinates])]), distance: $('street-distance').value });
	const status = (text, error = false) => { $('street-status').textContent = text; $('street-status').classList.toggle('error', error); };
	const drawing = createMapView(map, id => select(id, 'map'));
	const panel = createPanel({ select, focus: id => drawing.focus(id), back: close, retry: run,
		filter(nextCategory, nextSearch) { category = nextCategory ?? category; search = nextSearch ?? search; filter(); },
		presentation, boundary: show => drawing.showBoundary(show) });
	function presentation(mode) { document.body.dataset.streetBackground = mode; panel.background(mode); }
	function select(id, source) {
		selected = entries.find(e => String(e.feature.id) === id) || null;
		drawing.select(selected ? id : null); panel.detail(selected, distance);
		if (selected && source === 'list' && shouldFocus()) drawing.focus(id);
	}
	function filter() {
		const visible = visibleStreets(entries, category, search), ids = new Set(visible.map(e => String(e.feature.id)));
		panel.list(visible, category, entries.length); drawing.filter(ids);
		if (selected && !ids.has(String(selected.feature.id))) select(null);
		else panel.detail(selected, distance);
	}
	function close() {
		controller?.abort(); controller = null;
		if (!active) return;
		active = false; resultKey = null; entries = []; selected = null;
		drawing.clear(); panel.close(); delete document.body.dataset.streetBackground;
		onDiagnostic(false); refresh(); $('street-analyze').focus({ preventScroll: true });
	}
	function refresh() {
		const layer = current();
		if (active && signature(layer) !== resultKey) { close(); status('A camada ou os pontos mudaram. Analise as ruas novamente.'); }
		picker.refresh(active);
		$('street-analyze').disabled = active || !selectedLayers().some(part => part.points.length);
		$('street-distance').disabled = active;
	}
	async function run() {
		if (controller) return;
		const layer = current();
		if (!selectedLayers().some(part => part.points.length) || !$('street-distance').reportValidity()) return;
		if (!layer.analysisId) return status('Selecione uma camada produzida pela análise de setores neste computador.', true);
		let v2;
		try { if (isV2(layer)) v2 = prepareStreetLayers(layer, selectedLayers()); }
		catch (error) { return status(error.message, true); }
		if (isTerritoryActive()) exitTerritory();
		if (isTerritoryActive()) return status('Não foi possível sair da seleção territorial. Tente novamente.', true);
		const key = signature(layer), request = new AbortController(); controller = request; resultKey = key;
		distance = Number($('street-distance').value); entries = []; selected = null; category = 'all'; search = '';
		if (!active) { active = true; onDiagnostic(true); }
		drawing.clear(); panel.open(v2 ? { name: `Modelo v2 · ${v2.camadas.length} camada(s) da mesma análise` } : layer); presentation('soft'); refresh();
		status('Comparando pontos com a base local de ruas…');
		const timer = setTimeout(() => request.abort(new Error('A consulta demorou mais de 30 segundos. Tente novamente.')), 30000);
		try {
			const points = v2?.points || layer.points.map(item => item.feature.geometry.coordinates.slice(0, 2));
			const response = await fetch('/api/ruas/diagnostico', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ analysis_id: layer.analysisId, distancia_m: distance,
					...(v2 ? { camadas: v2.camadas } : { pontos: points }) }), signal: request.signal });
			const data = await response.json();
			if (controller !== request || !active) return;
			if (signature(current()) !== key || isTerritoryActive()) { close(); status('A camada ou os pontos mudaram durante a análise. Execute novamente.'); return; }
			if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Não foi possível analisar as ruas (${response.status}).`);
			drawing.draw(data, data.arboriza.pontos_diagnostico || points); entries = streetEntries(data); panel.ready(data, streetTotals(entries)); filter();
			status(`${entries.length} trechos disponíveis no diagnóstico.`);
		} catch (error) {
			if (controller === request && active) { drawing.clear(); panel.error(request.signal.reason?.message || error.message || 'Não foi possível analisar as ruas.'); }
		} finally { clearTimeout(timer); if (controller === request) controller = null; }
	}
	$('street-distance').oninput = refresh; $('street-analyze').onclick = run;
	refresh();
	return { refresh, close, get active() { return active; } };
}
