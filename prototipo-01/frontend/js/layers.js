import { PointLayer, readPoints } from './points.js';
import { studyAreaFor } from './map.js';
import { crownStorage, pairCrowns } from './crowns.js';

// Camadas e persistência do navegador. Os arquivos do experimento permanecem no disco.
export function createLayers(beforeChange, onChange, message) {
	const key = 'arboriza-prototipo-01-camadas';
	const legacy = 'arboriza-prototipo-01-manual';
	const list = document.getElementById('layer-list');
	let layers = [], active = 0, revision = 0, cleared = 0;
	const make = (name, features = [], metadata = {}) => {
		const layer = Object.assign(new PointLayer(name, features), { id: crypto.randomUUID(), ...metadata });
		if (layer.crowns) {
			layer.crowns = pairCrowns(layer.crowns, features);
			layer.modelVersion = 2;
			layer.crownKey ||= crypto.randomUUID();
		}
		layer.studyArea = studyAreaFor(layer);
		return layer;
	};
	try {
		const saved = JSON.parse(localStorage.getItem(key) || 'null');
		if (saved) {
			layers = saved.layers.map(item => make(item.name, readPoints(item.geojson), { id: item.id, recorte: item.recorte, analysisId: item.analysisId, analysisPart: item.analysisPart, studyArea: item.studyArea, modelVersion: item.modelVersion, crownKey: item.crownKey }));
			active = Math.max(0, layers.findIndex(layer => layer.id === saved.active));
		} else {
			const old = JSON.parse(localStorage.getItem(legacy) || 'null');
			if (old) layers = [make('Marcação manual', readPoints(old))];
		}
	} catch { message('Não foi possível recuperar as camadas locais. Os arquivos exportados podem ser importados novamente.', true); }
	if (!layers.length) layers.push(make('Marcação manual'));
	const current = () => layers[active];

	function save() {
		revision++;
		try {
			localStorage.setItem(key, JSON.stringify({ active: current().id, layers: layers.map(layer => ({
				id: layer.id, name: layer.name, recorte: layer.recorte, analysisId: layer.analysisId, analysisPart: layer.analysisPart, studyArea: layer.studyArea, modelVersion: layer.modelVersion, crownKey: layer.crownKey, geojson: layer.geojson(),
			})) }));
			localStorage.removeItem(legacy);
			return true;
		} catch { message('Não foi possível salvar no navegador. Exporte as camadas para guardar suas alterações.', true); return false; }
	}

	function render() {
		document.getElementById('layer-count').textContent = layers.length;
		list.replaceChildren();
		layers.forEach((layer, index) => {
			const row = document.createElement('li');
			const select = document.createElement('button'); select.type = 'button'; select.className = 'layer-select';
			select.setAttribute('aria-pressed', String(index === active));
			const name = document.createElement('strong'); name.textContent = layer.name;
			const count = document.createElement('span'); count.textContent = `${layer.points.length} pontos${index === active ? ' · em exibição' : ''}`;
			select.append(name, count);
			select.onclick = () => {
				beforeChange(); active = index; onChange(true); save();
				list.querySelector('[aria-pressed="true"]').focus();
			};
			const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger layer-remove';
			remove.setAttribute('aria-label', `Excluir camada ${layer.name}`); remove.title = 'Excluir camada';
			remove.innerHTML = '<svg aria-hidden="true"><use href="#i-delete" /></svg>';
			remove.onclick = async () => {
				if (!await confirmAction('Excluir camada?', `“${layer.name}” será removida deste navegador. Exporte as alterações que quiser guardar.`, 'Excluir camada')) return;
				beforeChange();
				const selectedId = current().id;
				layers.splice(layers.indexOf(layer), 1);
				if (layer.crownKey) crownStorage(layer.crownKey, null).catch(() => {});
				if (!layers.length) layers.push(make('Marcação manual'));
				active = Math.max(0, layers.findIndex(item => item.id === selectedId));
				onChange(current().id !== selectedId); const saved = save();
				if (saved) message('Camada removida. Os arquivos no disco foram preservados.');
			};
			row.append(select, remove); list.append(row);
		});
	}
	document.getElementById('clear-map').onclick = async () => {
		if (!await confirmAction('Limpar todo o mapa?', 'Todas as camadas e marcações serão removidas deste navegador. Exporte o que quiser guardar. Uma análise em andamento não será adicionada após a limpeza.', 'Limpar mapa')) return;
		beforeChange();
		layers.forEach(layer => { if (layer.crownKey) crownStorage(layer.crownKey, null).catch(() => {}); });
		layers = [make('Marcação manual')]; active = 0; cleared++;
		const saved = save(); onChange();
		if (saved) message('Mapa limpo. Os arquivos de resultados no disco foram preservados.');
	};
	return { current, render, save, all: () => [...layers],
		async loadCrowns(layer = current(), retry = false) {
			if (!layer.linkedCrowns || layer.crowns || layer.crownsLoading || (layer.crownsError && !retry)) return;
			layer.crownsLoading = true; layer.crownsError = null;
			try {
				let data;
				if (layer.crownKey) {
					try { data = await crownStorage(layer.crownKey); }
					catch { /* Tentar recuperar o resultado original da API quando disponível. */ }
				}
				if (!data && layer.analysisId) {
					const response = await fetch(`/api/analises/${encodeURIComponent(layer.analysisId)}/camadas/copas`, { signal: AbortSignal.timeout(20000) });
					if (response.ok) data = await response.json();
				}
				if (!data) throw new Error('Copas não encontradas. Importe uma exportação com copas ou refaça a análise v2.');
				// Guardar todas as máscaras disponíveis permite desfazer exclusões nesta sessão.
				pairCrowns(data, layer.points.map(p => p.feature));
				layer.crowns = data; layer.modelVersion = 2; layer.crownKey ||= crypto.randomUUID();
				try { await crownStorage(layer.crownKey, data); }
				catch { layer.crownsError = 'As copas estão disponíveis nesta sessão. Exporte a camada: o navegador não conseguiu guardá-las.'; }
				save();
			} catch (error) { layer.crownsError = error.message; }
			finally { layer.crownsLoading = false; if (current() === layer) onChange(false); }
		},
		get revision() { return revision; }, get cleared() { return cleared; },
		add(name, features, metadata = {}, activate = true) {
			if (metadata.analysisId && layers.some(layer => layer.analysisId === metadata.analysisId
				&& (layer.analysisPart || '') === (metadata.analysisPart || ''))) return;
			if (activate) beforeChange();
			const layer = make(name, features, metadata);
			layers.push(layer);
			if (layer.crowns) crownStorage(layer.crownKey, layer.crowns).catch(() => {
				layer.crownsError = 'As copas estão disponíveis nesta sessão, mas não foram salvas no navegador. Exporte a camada para guardá-las.';
				message(layer.crownsError, true);
			});
			if (activate) active = layers.length - 1;
			const saved = save();
			if (activate) onChange(true); else render();
			return saved;
		},
	};
}

export function confirmAction(title, text, action) {
	const dialog = document.getElementById('confirm-dialog');
	document.getElementById('confirm-title').textContent = title;
	document.getElementById('confirm-text').textContent = text;
	document.getElementById('confirm-action').textContent = action;
	dialog.returnValue = ''; dialog.showModal();
	return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
