import { PointLayer, readPoints } from './points.js';
import { createMap, recortes } from './map.js';

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
	const storageKey = 'arboriza-prototipo-01-manual';
	const layers = [new PointLayer('Marcação manual')];
	const circles = new Map();
	const pointPopup = L.popup({ className: 'point-info', autoPan: false, closeOnClick: false, maxWidth: 280 });
	const coordinateButton = $('mouse-coordinates');
	const coordinateControl = L.control({ position: 'bottomleft' });
	coordinateControl.onAdd = () => coordinateButton;
	coordinateControl.addTo(map);
	L.DomEvent.disableClickPropagation(coordinateButton);
	L.DomEvent.disableScrollPropagation(coordinateButton);
	let active = 0, tool = 'select', gesture = null, ignoreClickUntil = 0, listLimit = 50;
	const current = () => layers[active];
	const latLng = point => L.latLng(point.feature.geometry.coordinates[1], point.feature.geometry.coordinates[0]);
	try {
		const saved = localStorage.getItem(storageKey);
		if (saved) layers[0] = new PointLayer('Marcação manual', readPoints(JSON.parse(saved)));
	} catch { message('As marcações locais não puderam ser recuperadas. Importe um GeoJSON para restaurá-las.', true); }
	try {
		if (layers[0].points.length) localStorage.setItem(storageKey, JSON.stringify(layers[0].geojson()));
	} catch { message('Não foi possível salvar os IDs locais. Exporte a camada para preservá-los.', true); }

	function changed(text) {
		render();
		try {
			if (active === 0) localStorage.setItem(storageKey, JSON.stringify(current().geojson()));
			message(text);
		} catch { message(`${text} Não foi possível salvar neste navegador; exporte a camada.`, true); }
	}

	function selection() {
		const layer = current();
		circles.forEach((circle, key) => circle.setStyle({
			radius: layer.selected.has(key) ? 7 : 5.5,
			fillColor: layer.selected.has(key) ? '#1971c2' : '#23734a',
			color: '#ffffff', weight: layer.selected.has(key) ? 3 : 2, fillOpacity: 1,
		}));
		$('selection-count').textContent = `${layer.selected.size} selecionados`;
		$('delete-points').disabled = !layer.selected.size;
		$('undo').disabled = !layer.past.length;
		$('redo').disabled = !layer.future.length;
		$('undo').title = `Desfazer${layer.past.length ? ': ' + layer.past.at(-1).label : ''} (Ctrl+Z)`;
		$('redo').title = `Refazer${layer.future.length ? ': ' + layer.future.at(-1).label : ''} (Ctrl+Y)`;
		$('select-all').disabled = !layer.points.length;
		$('invert-selection').disabled = !layer.points.length;
		$('clear-selection').disabled = !layer.selected.size;
		document.querySelectorAll('#point-list input').forEach(input => {
			input.checked = layer.selected.has(input.value);
			input.closest('li').classList.toggle('selected', input.checked);
		});
		if (layer.selected.size === 1 && $('show-points').checked) {
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
		if (Number.isFinite(feature.properties.score)) details.textContent += `\nScore: ${feature.properties.score.toFixed(3)}`;
		const actions = document.createElement('div'); actions.className = 'row';
		for (const [label, text] of [['Copiar coordenadas', `${p.lat}, ${p.lng}`],
			['Copiar informações', JSON.stringify(feature, null, 2)]]) {
			const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
			button.onclick = () => copyText(text, label);
			actions.append(button);
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

	function render() {
		const layer = current();
		markers.clearLayers(); circles.clear();
		layer.points.forEach(point => {
			circles.set(point.key, L.circleMarker(latLng(point), { interactive: false }).addTo(markers));
		});
		heat?.setLatLngs(layer.points.map(point => [latLng(point).lat, latLng(point).lng, 1]));
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
		renderList(); selection();
	}

	function setTool(next) {
		cancelGesture(); tool = next; ignoreClickUntil = 0;
		container.dataset.tool = tool;
		document.querySelectorAll('[data-tool]').forEach(button => {
			if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
		});
		$('show-points').checked = true; markers.addTo(map);
		message({ select: 'Clique para selecionar. Ctrl/Shift combina pontos; arraste a seleção para mover.', move: 'Arraste de qualquer lugar do mapa para mover a seleção. V volta a selecionar e navegar.', add: 'Clique dentro da área para adicionar uma árvore. Esc volta à seleção.', box: 'Arraste um retângulo para selecionar. Ctrl/Shift mantém a seleção anterior.' }[tool]);
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
		if (event.button !== 0 || !event.isPrimary || event.target.closest('.leaflet-control, .leaflet-popup') || gesture) return;
		const start = map.mouseEventToContainerPoint(event);
		const point = hitPoint(start);
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
		if (performance.now() < ignoreClickUntil) return;
		if (tool === 'add') {
			if (!area.getBounds().contains(event.latlng)) return message('Adicione dentro da área delimitada ou ajuste a área de estudo.', true);
			if (current().points.length >= 10000) return message('Esta camada atingiu o limite de 10.000 pontos do protótipo.', true);
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
	const remove = () => { const count = current().selected.size; if (count) { current().remove(); changed(`${count} pontos apagados. Ctrl+Z restaura a seleção.`); } };
	document.querySelectorAll('button[data-tool]').forEach(button => button.onclick = () => setTool(button.dataset.tool));
	$('delete-points').onclick = remove;
	$('undo').onclick = () => undo(false); $('redo').onclick = () => undo(true);
	$('select-all').onclick = () => { current().selected = new Set(current().points.map(p => p.key)); selection(); };
	$('invert-selection').onclick = () => {
		current().selected = new Set(current().points.filter(p => !current().selected.has(p.key)).map(p => p.key));
		selection();
	};
	$('clear-selection').onclick = () => { current().selected.clear(); selection(); };
	const showList = show => {
		$('point-browser').hidden = !show; $('list-toggle').setAttribute('aria-expanded', String(show));
		renderList(); selection();
	};
	$('list-toggle').onclick = () => showList($('point-browser').hidden);
	$('list-close').onclick = () => { showList(false); $('list-toggle').focus(); };
	$('more-points').onclick = () => { listLimit += 50; renderList(); selection(); };
	document.addEventListener('keydown', event => {
		if (event.target.closest('textarea, select, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"])')) return;
		const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
		if (command && ['z', 'y', 'a'].includes(key)) {
			event.preventDefault();
			if (key === 'a') $('select-all').click();
			else undo(key === 'y' || event.shiftKey);
		} else if (key === 'escape') { setTool('select'); current().selected.clear(); selection(); }
		else if (['delete', 'backspace'].includes(key)) { event.preventDefault(); remove(); }
		else if (!command && !event.altKey) {
			if (key === 'l') $('list-toggle').click();
			else if (['v', 'm', 'p', 'b'].includes(key)) setTool({ v: 'select', m: 'move', p: 'add', b: 'box' }[key]);
		}
	});

	$('area').onchange = () => { cancelGesture(); area.setBounds(recortes[$('area').value]); fitArea(); render(); };
	$('fit-area').onclick = fitArea;
	$('use-view').onclick = () => {
		const bounds = map.getBounds();
		if (bounds.getWest() < -180 || bounds.getEast() > 180) return message('Aproxime o mapa para escolher uma área.', true);
		area.setBounds(bounds); $('area').value = 'custom'; render(); message('Enquadramento definido como área de estudo.');
	};
	document.querySelectorAll('[name="basemap"]').forEach(input => input.onchange = () => {
		setBase(input.value);
		$('source').textContent = input.value === 'ortofoto' ? 'IGC / DataGEO, levantamento 2023/2024. Resolução declarada: 25 cm.' : 'Ruas e referências do OpenStreetMap.';
		message('Mapa de fundo alterado.');
	});
	$('dataset').onchange = () => { cancelGesture(); active = Number($('dataset').value); current().selected.clear(); listLimit = 50; setTool('select'); render(); };
	$('show-points').onchange = event => {
		event.target.checked ? markers.addTo(map) : map.removeLayer(markers);
		selection();
	};
	$('show-density').disabled = !heat;
	$('show-density').onchange = event => event.target.checked ? heat.addTo(map) : map.removeLayer(heat);
	$('import').onchange = async event => {
		for (const file of event.target.files) {
			try {
				if (file.size > 5_000_000) throw new Error('Use arquivos de até 5 MB.');
				const features = readPoints(JSON.parse(await file.text()));
				layers.push(new PointLayer(file.name, features)); active = layers.length - 1;
				$('dataset').add(new Option(file.name, active)); $('dataset').value = String(active);
				listLimit = 50; setTool('select'); render(); message(`${features.length} pontos importados. Alterne a camada para comparar.`);
			} catch (error) { message(`Não foi possível importar ${file.name}. ${error.message}`, true); }
		}
		event.target.value = '';
	};
	$('export').onclick = () => {
		const recorte = $('area').selectedOptions[0].textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
		const now = new Date(), pad = value => String(value).padStart(2, '0');
		const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
		const url = URL.createObjectURL(new Blob([JSON.stringify(current().geojson(), null, 2)], { type: 'application/geo+json' }));
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
		document.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-expanded', String(open && tab === button)));
		document.querySelectorAll('[data-section]').forEach(section => section.classList.toggle('open', open && section.dataset.section === button.dataset.tab));
	});
	new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(container);
	new ResizeObserver(([entry]) => container.parentElement.style.setProperty('--tools-height', `${entry.borderBoxSize[0].blockSize}px`)).observe($('point-tools'));
	theme(pref('arboriza-theme', 'light')); panel(pref('arboriza-panel', 'side'));
	$('controls').disabled = false; $('point-tools').disabled = false;
	fitArea(); render(); setTool('select');
}
