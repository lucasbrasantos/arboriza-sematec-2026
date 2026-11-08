import { readPoints } from './points.js';
import { createMap, recortes, readStudyArea, studyAreaFor } from './map.js';
import { createLayers, confirmAction } from './layers.js';
import { connectAnalysis } from './analysis.js';
import { createAnalysisVisual } from './analysis-visual.js';
import { connectTerritory } from './territory.js';
import { createCrownOverlay, crownKinds, livingCrowns, pairCrowns } from './crowns.js';

const $ = id => document.getElementById(id);
const message = (text, error = false) => {
	$('status').textContent = text;
	$('status').classList.toggle('error', error);
};
const pref = (name, fallback) => { try { return localStorage.getItem(name) || fallback; } catch { return fallback; } };
const remember = (name, value) => { try { localStorage.setItem(name, value); } catch { /* Preferências são opcionais. */ } };

document.addEventListener('DOMContentLoaded', () => {
	if (window.L) start();
	else message('Não foi possível carregar o mapa. Verifique a conexão e recarregue.', true);
});

function start() {
	const { map, area, markers, heat, setBase, fitArea } = createMap(loading => {
		$('loading').hidden = !loading;
		$('map').setAttribute('aria-busy', String(loading));
	}, () => message('Alguns blocos não carregaram. Verifique a conexão ou troque o mapa de fundo.', true));
	const container = $('map');
	$('crown-legend').open = container.clientWidth > 640;
	const circles = new Map();
	const pointPopup = L.popup({ className: 'point-info', autoPan: false, closeOnClick: false, maxWidth: 280 });
	const coordinateButton = $('mouse-coordinates');
	const coordinateControl = L.control({ position: 'bottomleft' });
	coordinateControl.onAdd = () => coordinateButton;
	coordinateControl.addTo(map);
	L.DomEvent.disableClickPropagation(coordinateButton);
	L.DomEvent.disableScrollPropagation(coordinateButton);
	let tool = 'select', gesture = null, ignoreClickUntil = 0, listLimit = 50, analysis, territory;
	const store = createLayers(cancelGesture, focus => {
		if (focus) restoreLayerArea();
		listLimit = 50; render();
	}, message);
	const current = store.current;
	let shownLayer;
	const crownOverlay = createCrownOverlay(map, (id, additive) => {
		if (territory?.active) return;
		const point = current().points.find(p => p.feature.properties.copa_id === id);
		if (point) {
			cancelGesture(); tool = 'select'; container.dataset.tool = tool;
			document.querySelectorAll('button[data-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
			togglePoint(point.key, additive);
		}
	});
	const latLng = point => L.latLng(point.feature.geometry.coordinates[1], point.feature.geometry.coordinates[0]);

	function changed(text) {
		current().studyArea = studyAreaFor(current());
		render();
		message(text); store.save();
	}

	function restoreLayerArea() {
		const context = studyAreaFor(current());
		if (!context) return;
		current().studyArea = context;
		$('area').value = context.recorte; area.setBounds(context.bounds); fitArea(); analysis?.refresh();
	}

	const selectedArea = () => ({ recorte: $('area').value,
		bounds: [[area.getBounds().getSouth(), area.getBounds().getWest()], [area.getBounds().getNorth(), area.getBounds().getEast()]] });

	function selection() {
		const layer = current();
		const byKey = new Map(layer.points.map(point => [point.key, point]));
		circles.forEach((circle, key) => circle.setStyle({
			radius: layer.selected.has(key) ? 7 : 5.5,
			fillColor: layer.selected.has(key) ? '#1971c2' : crownKinds[byKey.get(key)?.feature.properties.tipo]?.color || '#23734a',
			color: '#ffffff', weight: layer.selected.has(key) ? 3 : 2, fillOpacity: 1,
		}));
		$('selection-count').textContent = `${layer.selected.size} selecionados`;
		$('delete-points').disabled = !layer.selected.size;
		$('undo').disabled = !layer.past.length;
		$('redo').disabled = !layer.future.length;
		crownOverlay.select(new Set(layer.points.filter(p => layer.selected.has(p.key)).map(p => p.feature.properties.copa_id).filter(Boolean)));
		document.querySelectorAll('[data-tool="move"], [data-tool="add"]').forEach(button => {
			button.disabled = Boolean(layer.linkedCrowns);
			button.title = layer.linkedCrowns ? 'Modelo v2: ponto e copa têm posição fixa. Você pode excluir o par.'
				: button.dataset.tool === 'move' ? 'Mover seleção (M)' : 'Adicionar árvore (P)';
		});
		$('undo').title = `Desfazer${layer.past.length ? ': ' + layer.past.at(-1).label : ''} (Ctrl+Z)`;
		$('redo').title = `Refazer${layer.future.length ? ': ' + layer.future.at(-1).label : ''} (Ctrl+Y)`;
		$('select-all').disabled = !layer.points.length;
		$('invert-selection').disabled = !layer.points.length;
		$('clear-selection').disabled = !layer.selected.size;
		document.querySelectorAll('#point-list input').forEach(input => {
			input.checked = layer.selected.has(input.value);
			input.closest('li').classList.toggle('selected', input.checked);
		});
		if (tool === 'select' && layer.selected.size === 1 && ($('show-points').checked || ($('show-crowns').checked && layer.crowns))) {
			const point = layer.points.find(p => layer.selected.has(p.key));
			pointPopup.setLatLng(latLng(point)).setContent(pointInfo(point)).openOn(map);
		} else map.closePopup(pointPopup);
	}

	function pointInfo(point) {
		const box = document.createElement('div');
		const heading = document.createElement('strong'); heading.textContent = `Ponto ${point.number}`;
		const details = document.createElement('p');
		const feature = point.feature, p = latLng(point);
		details.textContent = `Latitude: ${p.lat.toFixed(7)}\nLongitude: ${p.lng.toFixed(7)}\nID: ${feature.id}`;
		details.textContent += `\nOrigem: ${feature.properties.origem || 'não informada'}`;
		if (feature.properties.modelo) details.textContent += `\nModelo: ${feature.properties.modelo}`;
		if (feature.properties.copa_id) {
			const kinds = { copa_individual: 'Copa individual candidata', grupo_de_copas: 'Grupo de copas (não equivale a uma árvore)', complemento_pendente: 'Complemento Cambridge pendente' };
			details.textContent += `\nTipo: ${kinds[feature.properties.tipo] || feature.properties.tipo}\nCopa vinculada: ${feature.properties.copa_id}`;
			if (Number.isFinite(feature.properties.area_copa_m2)) details.textContent += `\nÁrea da copa: ${feature.properties.area_copa_m2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
			details.textContent += '\nO ponto representa a copa, não a posição exata do tronco.';
		}
		if (Number.isFinite(feature.properties.score)) details.textContent += `\nScore: ${feature.properties.score.toFixed(3)}`;
		const actions = document.createElement('div'); actions.className = 'row';
		for (const [label, text] of [['Copiar coordenadas', `${p.lat}, ${p.lng}`],
			['Copiar informações', JSON.stringify(feature, null, 2)]]) {
			const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
			button.onclick = () => copyText(text, label);
			actions.append(button);
		}
		if (feature.properties.copa_id) {
			const removePair = document.createElement('button'); removePair.type = 'button';
			removePair.className = 'danger'; removePair.textContent = 'Excluir ponto e copa';
			removePair.onclick = remove; actions.append(removePair);
		}
		box.append(heading, details, actions); return box;
	}

	async function copyText(text, label) {
		try { await navigator.clipboard.writeText(text); message(`${label}: copiado.`); }
		catch { message('Não foi possível copiar. Selecione o texto exibido e copie manualmente.', true); }
	}

	function togglePoint(key, additive = false) {
		const selected = current().selected;
		if (!additive) selected.clear();
		if (additive && selected.has(key)) selected.delete(key);
		else selected.add(key);
		selection();
	}

	function renderList() {
		$('list-count').textContent = `${current().points.length} pontos`;
		if ($('point-browser').hidden) return;
		const list = $('point-list');
		list.replaceChildren();
		current().points.slice().reverse().slice(0, listLimit).forEach(point => {
			const row = document.createElement('li');
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox'; checkbox.value = point.key;
			checkbox.setAttribute('aria-label', `Selecionar ponto ${point.number}`);
			checkbox.onchange = () => togglePoint(point.key, true);
			const button = document.createElement('button');
			button.type = 'button'; button.className = 'point-item';
			const title = document.createElement('strong'); title.textContent = `Ponto ${point.number}`;
			const detail = document.createElement('span');
			const p = latLng(point); detail.textContent = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
			button.append(title, detail);
			button.onclick = event => {
				cancelGesture();
				togglePoint(point.key, event.ctrlKey || event.metaKey || event.shiftKey);
				$('show-points').checked = true; markers.addTo(map);
				map.setView(latLng(point), Math.max(map.getZoom(), 19), { animate: false });
				if (container.clientWidth < 640) showList(false);
				selection();
			};
			row.append(checkbox, button); list.append(row);
		});
		$('more-points').hidden = listLimit >= current().points.length;
	}

	function updateHeat() {
		if (heat && map.hasLayer(heat)) heat.setLatLngs(current().points.map(point => [latLng(point).lat, latLng(point).lng, 1]));
	}

	function render() {
		const layer = current();
		if (shownLayer !== layer.id) {
			shownLayer = layer.id;
			$('show-crowns').checked = false;
			if (layer.linkedCrowns) { tool = 'select'; $('show-points').checked = true; markers.addTo(map); }
		}
		void store.loadCrowns(layer);
		$('crown-controls').hidden = !layer.linkedCrowns;
		$('point-tools-title').textContent = layer.linkedCrowns ? 'Revisar pontos e copas' : 'Pontos de árvores';
		$('show-crowns').disabled = !layer.crowns;
		$('crown-load-status').textContent = layer.crownsLoading ? 'Carregando copas vinculadas…'
			: layer.crownsError || (layer.crowns ? `${layer.points.length} pares nesta revisão. Excluir remove ponto e copa; Desfazer restaura ambos.` : 'Esta camada não possui copas disponíveis.');
		$('crown-retry').hidden = !layer.crownsError || Boolean(layer.crowns);
		$('crown-legend').hidden = !layer.linkedCrowns || Boolean(territory?.active);
		$('crown-mode-label').textContent = $('show-crowns').checked ? 'Copas e pontos vinculados' : 'Pontos do modelo v2';
		crownOverlay.render(layer, $('show-crowns').checked && !territory?.active);
		container.dataset.tool = tool;
		document.querySelectorAll('button[data-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
		markers.clearLayers(); circles.clear();
		layer.points.forEach(point => {
			circles.set(point.key, L.circleMarker(latLng(point), { interactive: false, pane: 'crown-points' }).addTo(markers));
		});
		updateHeat();
		const bounds = area.getBounds();
		const inside = layer.points.filter(point => bounds.contains(latLng(point))).length;
		const r = Math.PI / 180;

		const hectares = 6371008.8 ** 2 * (Math.sin(bounds.getNorth() * r) - Math.sin(bounds.getSouth() * r)) * (bounds.getEast() - bounds.getWest()) * r / 10000;
		const m2 = hectares * 10000;
		const km2 = hectares / 100;

		$('area-size').innerHTML = `
			<span class="area-primary">
				${hectares.toLocaleString('pt-BR', {
			maximumFractionDigits: 2
		})} ha
			</span>
			<small class="area-secondary">
				${m2.toLocaleString('pt-BR', {
			maximumFractionDigits: 2
		})} m² ·
				${km2.toLocaleString('pt-BR', {
			maximumFractionDigits: 4
		})} km²
			</small>`;

		$('point-count').textContent = inside;
		$('point-summary').textContent = layer.points.length
			? `${layer.points.length} pontos na camada; ${inside} na área. Marcações ainda não validadas.`
			: 'Nenhum ponto. Use Adicionar na barra ou importe um GeoJSON.';
		$('export').disabled = !layer.points.length;
		store.render(); renderList(); selection();
	}

	function setTool(next) {
		if (current().linkedCrowns && ['move', 'add'].includes(next)) {
			message('No modelo v2, ponto e copa têm posição fixa. Selecione para excluir o par ou use uma camada manual.', true); return;
		}
		if (territory?.active) territory.exit();
		cancelGesture(); tool = next; ignoreClickUntil = 0;
		if (tool !== 'select') map.closePopup(pointPopup);
		container.dataset.tool = tool;
		document.querySelectorAll('[data-tool]').forEach(button => {
			if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
		});
		$('show-points').checked = true; markers.addTo(map);
		message(current().linkedCrowns && tool === 'select'
			? 'Selecione um ponto ou copa. Delete exclui o par; Ctrl+Z desfaz. As posições são fixas.'
			: { select: 'Clique para selecionar. Ctrl/Shift combina pontos; arraste a seleção para mover.', move: 'Arraste de qualquer lugar do mapa para mover a seleção. V volta a selecionar e navegar.', add: 'Clique dentro da área para adicionar uma árvore. Esc volta à seleção.', box: 'Arraste um retângulo para selecionar. Ctrl/Shift mantém a seleção anterior.' }[tool]);
	}

	function hitPoint(position) {
		if (!$('show-points').checked) return null;
		let hit = null, distance = 12;
		current().points.forEach(point => {
			const d = map.latLngToContainerPoint(latLng(point)).distanceTo(position);
			if (d < distance) { hit = point; distance = d; }
		});
		return hit;
	}

	function cancelGesture() {
		if (!gesture) return;
		gesture.rectangle?.remove();
		if (container.hasPointerCapture(gesture.pointer)) container.releasePointerCapture(gesture.pointer);
		gesture = null; map.dragging.enable(); render();
	}

	container.addEventListener('pointerdown', event => {
		if (territory?.active) return;
		if (event.button !== 0 || !event.isPrimary || event.target.closest('.leaflet-control, .leaflet-popup') || gesture) return;
		const start = map.mouseEventToContainerPoint(event);
		const point = hitPoint(start);
		if (current().linkedCrowns && tool === 'select' && point) {
			return;
		}
		if (tool === 'add' || (tool === 'select' && !point && !event.shiftKey)) return;
		const additive = event.ctrlKey || event.metaKey || event.shiftKey;
		if (tool === 'move' && !current().selected.size) {
			message('Selecione pontos com V, B ou na lista; depois use M para mover o grupo.', true);
			return;
		}
		if (tool === 'move' || (tool === 'select' && point)) {
			if (tool === 'select' && (additive || !current().selected.has(point.key))) togglePoint(point.key, additive);
			gesture = {
				pointer: event.pointerId, start, type: 'move', moved: false,
				originals: current().points.filter(p => current().selected.has(p.key)).map(p => [p.key, map.latLngToContainerPoint(latLng(p))])
			};
		} else {
			gesture = {
				pointer: event.pointerId, start, type: 'box', additive,
				rectangle: L.rectangle([map.containerPointToLatLng(start), map.containerPointToLatLng(start)], { color: '#1971c2', weight: 1.5, fillOpacity: .12, interactive: false }).addTo(map)
			};
		}
		map.dragging.disable(); container.setPointerCapture(event.pointerId); event.preventDefault();
	});

	container.addEventListener('pointermove', event => {
		if (!gesture || gesture.pointer !== event.pointerId) return;
		const position = map.mouseEventToContainerPoint(event);
		if (gesture.type === 'box') gesture.rectangle.setBounds([map.containerPointToLatLng(gesture.start), map.containerPointToLatLng(position)]);
		else if (position.distanceTo(gesture.start) > 4) {
			gesture.moved = true;
			const delta = position.subtract(gesture.start);
			gesture.coordinates = new Map(gesture.originals.map(([key, origin]) => {
				const p = map.containerPointToLatLng(origin.add(delta));
				circles.get(key).setLatLng(p);
				return [key, [p.lng, p.lat]];
			}));
		}
	});

	container.addEventListener('pointerup', event => {
		if (!gesture || gesture.pointer !== event.pointerId) return;
		const finished = gesture;
		gesture = null;
		if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
		map.dragging.enable(); ignoreClickUntil = performance.now() + 350;
		if (finished.type === 'box') {
			const bounds = finished.rectangle.getBounds(); finished.rectangle.remove();
			if (!finished.additive) current().selected.clear();
			current().points.forEach(point => { if (bounds.contains(latLng(point))) current().selected.add(point.key); });
			selection(); message(`${current().selected.size} pontos selecionados.`);
		} else if (finished.moved && finished.coordinates.size) {
			if ([...finished.coordinates.values()].some(([lng, lat]) => Math.abs(lng) > 180 || Math.abs(lat) > 85)) {
				render(); message('O grupo precisa permanecer dentro do mapa.', true); return;
			}
			current().move(finished.coordinates); changed(`${finished.coordinates.size} pontos movidos. Ctrl+Z desfaz a ação.`);
		} else selection(); // Reabre a ficha também no clique de um ponto já selecionado.
	});
	container.addEventListener('pointercancel', cancelGesture);
	map.on('click', event => {
		if (territory?.active) return;
		if (performance.now() < ignoreClickUntil) return;
		if (current().linkedCrowns && tool === 'select') {
			const point = hitPoint(map.latLngToContainerPoint(event.latlng));
			if (point) { togglePoint(point.key, event.originalEvent.ctrlKey || event.originalEvent.metaKey || event.originalEvent.shiftKey); return; }
		}
		if (tool === 'add') {
			if (!area.getBounds().contains(event.latlng)) return message('Adicione dentro da área delimitada ou ajuste a área de estudo.', true);
			if (current().points.length >= 10000) return message('Esta camada atingiu o limite de 10.000 pontos do protótipo.', true);
			if (!current().points.length) current().studyArea = selectedArea();
			current().add([event.latlng.lng, event.latlng.lat]); changed('Ponto adicionado. Continue marcando ou pressione Esc.');
		} else if (tool === 'select' && !event.originalEvent.ctrlKey && !event.originalEvent.metaKey) {
			current().selected.clear(); selection();
		}
	});
	map.on('mousemove', event => {
		if (event.originalEvent.target.closest('.leaflet-control, .leaflet-popup')) return;
		$('mouse-lat').textContent = event.latlng.lat.toFixed(6);
		$('mouse-lng').textContent = event.latlng.lng.toFixed(6);
		coordinateButton.disabled = false;
	});
	coordinateButton.onclick = () => copyText(`${$('mouse-lat').textContent}, ${$('mouse-lng').textContent}`, 'Coordenadas do cursor');

	const undo = redo => { cancelGesture(); if (current().history(redo)) changed(redo ? 'Ação refeita.' : 'Ação desfeita.'); };
	const remove = () => { const count = current().selected.size; if (count) {
		const linked = current().linkedCrowns;
		current().remove(); changed(`${count} ${linked ? (count === 1 ? 'par de ponto e copa excluído desta revisão' : 'pares de ponto e copa excluídos desta revisão') : 'pontos apagados'}. Ctrl+Z restaura a seleção.`);
	} };
	document.querySelectorAll('button[data-tool]').forEach(button => button.onclick = () => setTool(button.dataset.tool));
	$('delete-points').onclick = remove;
	$('undo').onclick = () => undo(false); $('redo').onclick = () => undo(true);
	$('select-all').onclick = () => { current().selected = new Set(current().points.map(p => p.key)); selection(); };
	$('invert-selection').onclick = () => {
		current().selected = new Set(current().points.filter(p => !current().selected.has(p.key)).map(p => p.key));
		selection();
	};
	$('clear-selection').onclick = () => { current().selected.clear(); selection(); };
	const showPanel = name => {
		if (name && container.clientWidth <= 720 && document.body.dataset.panel === 'floating') {
			document.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-expanded', 'false'));
			document.querySelectorAll('[data-section]').forEach(section => section.classList.remove('open'));
		}
		for (const [key, button, panel] of [['points', 'list-toggle', 'point-browser'], ['layers', 'layers-toggle', 'layer-browser']]) {
			$(panel).hidden = name !== key; $(button).setAttribute('aria-expanded', String(name === key));
		}
		renderList(); selection();
	};
	const showList = show => showPanel(show ? 'points' : null);
	$('list-toggle').onclick = () => showList($('point-browser').hidden);
	$('layers-toggle').onclick = () => showPanel($('layer-browser').hidden ? 'layers' : null);
	$('list-close').onclick = () => { showList(false); $('list-toggle').focus(); };
	$('more-points').onclick = () => { listLimit += 50; renderList(); selection(); };
	document.addEventListener('keydown', event => {
		if (territory?.active) return;
		if ($('confirm-dialog').open || event.target.closest('textarea, select, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"])')) return;
		const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
		if (command && ['z', 'y', 'a'].includes(key)) {
			event.preventDefault();
			if (key === 'a') $('select-all').click();
			else undo(key === 'y' || event.shiftKey);
		} else if (key === 'escape') { showPanel(null); setTool('select'); current().selected.clear(); selection(); }
		else if (['delete', 'backspace'].includes(key)) { event.preventDefault(); remove(); }
		else if (!command && !event.altKey) {
			if (key === 'l') $('list-toggle').click();
			else if (['v', 'm', 'p', 'b'].includes(key)) setTool({ v: 'select', m: 'move', p: 'add', b: 'box' }[key]);
		}
	});

	$('area').onchange = () => { cancelGesture(); area.setBounds(recortes[$('area').value]); fitArea(); render(); analysis.refresh(); };
	$('fit-area').onclick = fitArea;
	$('use-view').onclick = () => {
		const bounds = map.getBounds();
		if (bounds.getWest() < -180 || bounds.getEast() > 180) return message('Aproxime o mapa para escolher uma área.', true);
		area.setBounds(bounds); $('area').value = 'custom'; render(); analysis.refresh(); message('Enquadramento definido como área de estudo.');
	};
	document.querySelectorAll('[name="basemap"]').forEach(input => input.onchange = () => {
		setBase(input.value);
		$('source').textContent = input.value === 'ortofoto' ? 'IGC / DataGEO, levantamento 2023/2024. Resolução declarada: 25 cm.' : 'Ruas e referências do OpenStreetMap.';
		message('Mapa de fundo alterado.');
	});
	$('show-points').onchange = event => {
		event.target.checked ? markers.addTo(map) : map.removeLayer(markers);
		if (current().linkedCrowns) $('crown-mode-label').textContent = $('show-crowns').checked
			? (event.target.checked ? 'Copas e pontos vinculados' : 'Copas do modelo v2') : 'Pontos do modelo v2';
		selection();
	};
	$('show-crowns').onchange = () => { render(); };
	$('crown-retry').onclick = () => { void store.loadCrowns(current(), true); render(); };
	$('show-density').disabled = !heat;
	$('show-density').onchange = event => {
		if (event.target.checked) { heat.addTo(map); updateHeat(); }
		else map.removeLayer(heat);
	};
	$('import').onchange = async event => {
		for (const file of event.target.files) {
			try {
				if (file.size > 50_000_000) throw new Error('Use arquivos de até 50 MB para camadas com copas.');
				const data = JSON.parse(await file.text()), features = readPoints(data);
				if (!data.arboriza?.copas && file.size > 5_000_000) throw new Error('Use arquivos de até 5 MB para camadas somente de pontos.');
				const crowns = data.arboriza?.copas ? pairCrowns(data.arboriza.copas, features) : undefined;
				listLimit = 50; setTool('select');
				const studyArea = readStudyArea(data.arboriza?.area);
				const saved = store.add(file.name, features, { studyArea, crowns, modelVersion: data.arboriza?.versao_modelo });
				if (saved) message(`${features.length} pontos importados. Alterne a camada para comparar.`);
			} catch (error) { message(`Não foi possível importar ${file.name}. ${error.message}`, true); }
		}
		event.target.value = '';
	};
	$('export').onclick = () => {
		const context = studyAreaFor(current()) || selectedArea();
		const recorte = ({ centro: 'centro', norte: 'centro-norte', custom: 'area-personalizada' }[context.recorte]);
		const now = new Date(), pad = value => String(value).padStart(2, '0');
		const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
		if (current().linkedCrowns && !current().crowns) return message('Carregue as copas antes de exportar para preservar os vínculos do modelo v2.', true);
		const data = { ...current().geojson(), arboriza: { area: context,
			...(current().crowns ? { versao_modelo: 2, copas: livingCrowns(current()), revisao_local: true } : {}) } };
		const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }));
		const link = document.createElement('a'); link.href = url; link.download = `arboriza-pontos_${recorte}_${date}_${time}.geojson`; link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000); message('Camada inteira exportada em GeoJSON.');
	};

	function theme(value) {
		document.documentElement.dataset.theme = value;
		$('theme-toggle').setAttribute('aria-pressed', String(value === 'dark'));
		$('theme-label').textContent = value === 'dark' ? 'Tema claro' : 'Tema escuro';
		remember('arboriza-theme', value);
	}
	function panel(value) {
		document.body.dataset.panel = value;
		$('panel-toggle').setAttribute('aria-pressed', String(value === 'floating'));
		$('panel-label').textContent = value === 'floating' ? 'Painel lateral' : 'Painel flutuante';
		remember('arboriza-panel', value);
	}
	$('theme-toggle').onclick = () => theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
	$('panel-toggle').onclick = () => panel(document.body.dataset.panel === 'floating' ? 'side' : 'floating');
	document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
		const open = button.getAttribute('aria-expanded') !== 'true';
		if (open && container.clientWidth <= 720) showPanel(null);
		document.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-expanded', String(open && tab === button)));
		document.querySelectorAll('[data-section]').forEach(section => section.classList.toggle('open', open && section.dataset.section === button.dataset.tab));
	});
	new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(container);
	const toolsObserver = new ResizeObserver(() => {
		const visible = $('territory-tools').hidden ? $('point-tools') : $('territory-tools');
		container.parentElement.style.setProperty('--tools-height', `${visible.offsetHeight}px`);
	});
	toolsObserver.observe($('point-tools')); toolsObserver.observe($('territory-tools'));
	theme(pref('arboriza-theme', 'light')); panel(pref('arboriza-panel', 'side'));
	$('controls').disabled = false; $('point-tools').disabled = false; $('map-lists').disabled = false;
	analysis = connectAnalysis(store, (name, features, metadata, activate) => {
		activate = activate && !gesture && !territory?.active;
		if (activate) setTool('select');
		const saved = store.add(name, features, metadata, activate);
		if (saved) message('Nova camada de possíveis árvores disponível. Revise os pontos antes de usar as contagens.');
	}, () => Boolean(territory?.active), createAnalysisVisual(), () => territory?.selection);
	territory = connectTerritory({ map, confirmAction, onSelectionChange() { analysis?.refresh(); }, onActiveChange(active) {
		if (active) {
			cancelGesture(); map.closePopup(pointPopup);
			container.dataset.tool = 'select';
			if (map.hasLayer(area)) area.remove();
			$('point-tools').hidden = true; $('point-tools').disabled = true;
			$('territory-tools').hidden = false; $('territory-tools').disabled = false;
			$('crown-legend').hidden = true; crownOverlay.render(current(), false);
		} else {
			area.addTo(map); $('point-tools').hidden = false; $('point-tools').disabled = false;
			$('territory-tools').hidden = true; $('territory-tools').disabled = true;
			setTool('select');
			render();
		}
		analysis.refresh();
	} });
	restoreLayerArea(); fitArea(); render(); setTool('select');
}
