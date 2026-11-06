// Seleção territorial separada das camadas e do histórico de pontos.
export function connectTerritory({ map, confirmAction, onActiveChange, onSelectionChange = () => {} }) {
	const $ = id => document.getElementById(id);
	const container = map.getContainer();
	const savedKey = 'arboriza-prototipo-01-areas-territoriais';
	const draftKey = 'arboriza-prototipo-01-selecao-territorial';
	let active = false, collection, sectors, selected = new Set(), saved = [], summary, savedUnavailable = false;
	let tool = 'click', drawing, drawingRequest = false, summaryRevision = 0, generation = 0, ignoreClickUntil = 0;

	function status(text, error = false) {
		for (const id of ['territory-map-status', 'territory-sidebar-status']) {
			$(id).textContent = text; $(id).classList.toggle('error', error);
		}
	}
	async function request(path, body) {
		const response = await fetch(path, {
			method: body ? 'POST' : 'GET',
			headers: body ? { 'Content-Type': 'application/json' } : {},
			body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(typeof data.detail === 'string' ? data.detail : `Não foi possível consultar os setores (${response.status}).`);
		}
		return response.json();
	}
	function readSaved() {
		try {
			const value = JSON.parse(localStorage.getItem(savedKey) || '[]');
			if (!Array.isArray(value) || !value.every(item => item && typeof item.id === 'string'
				&& typeof item.name === 'string' && typeof item.source === 'string' && Array.isArray(item.sectors)
				&& item.sectors.every(id => typeof id === 'string'))) throw new Error('Áreas salvas inválidas');
			return value;
		} catch { savedUnavailable = true; return []; }
	}
	function writeSaved() {
		if (savedUnavailable) { status('Não foi possível ler as áreas salvas; os dados existentes foram preservados.', true); return false; }
		try { localStorage.setItem(savedKey, JSON.stringify(saved)); return true; }
		catch { status('Não foi possível salvar neste navegador. Verifique o armazenamento disponível.', true); return false; }
	}
	function saveDraft() {
		try { localStorage.setItem(draftKey, JSON.stringify({ source: collection.arboriza.sha256_fonte, sectors: [...selected] })); }
		catch { /* Salvar a área pelo nome continua disponível quando houver espaço. */ }
	}
	function renderSaved() {
		const current = $('territory-saved').value;
		$('territory-saved').replaceChildren(new Option('Selecione uma área', ''),
			...saved.map(item => new Option(`${item.name} · ${item.sectors.length} setores`, item.id)));
		if (saved.some(item => item.id === current)) $('territory-saved').value = current;
		$('territory-load').disabled = !$('territory-saved').value || drawingRequest;
		$('territory-delete').disabled = !$('territory-saved').value;
	}

	function sectorStyle(feature) {
		if (!active)
			return {
				opacity: 0,
				fillOpacity: 0
			};
		if (selected.has(String(feature.id)))
			return {
				color: '#17659c',
				weight: 2,
				opacity: .95,
				fillColor: '#2887bd',
				fillOpacity: .28
			};
		return {
			color: '#215c40',
			weight: 1, opacity: .65,
			fillColor: '#92E7AD',
			fillOpacity: .25
		};
	}

	function renderSectors() {
		sectors?.eachLayer(layer => {
			layer.options.interactive = active && tool === 'click';
			layer.setStyle(sectorStyle(layer.feature));
		});
	}
	function renderButtons(calculating = false) {
		const needsSummary = calculating || drawingRequest || (selected.size > 0 && !summary);
		$('territory-count').textContent = `${selected.size} ${selected.size === 1 ? 'setor' : 'setores'}`;
		$('territory-clear').disabled = !selected.size || drawingRequest;
		$('territory-invert').disabled = drawingRequest;
		$('territory-all').disabled = drawingRequest;
		$('territory-sector-toggle').disabled = !$('territory-sector').value || drawingRequest;
		$('territory-fit').disabled = !summary?.bounds || calculating;
		$('territory-save').disabled = !selected.size || needsSummary || savedUnavailable;
		$('territory-export').disabled = !selected.size || needsSummary;
		$('territory-load').disabled = !$('territory-saved').value || drawingRequest;
		onSelectionChange();
	}
	async function updateSelection(next, fit = false) {
		selected = new Set(next); summary = undefined;
		const revision = ++summaryRevision;
		renderSectors(); saveDraft(); renderButtons(Boolean(selected.size));
		if (!selected.size) { $('territory-summary').textContent = 'Nenhum setor selecionado.'; $('territory-coverage').textContent = ''; return; }
		$('territory-summary').textContent = `Calculando a área de ${selected.size} setores…`;
		$('territory-coverage').textContent = 'Conferindo as imagens locais…';
		try {
			const result = await request('/api/territorio/resumo', { ids: [...selected] });
			if (revision !== summaryRevision) return;
			summary = result;
			const km2 = (result.area_m2 / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
			const ha = (result.area_m2 / 10_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
			$('territory-summary').textContent = `${result.setores} ${result.setores === 1 ? 'setor' : 'setores'} · ${km2} km² (${ha} ha). Prévia de setores inteiros.`;
			renderButtons();
			if (fit) fitSelection();
			try {
				const coverage = await request('/api/territorio/cobertura-local', { ids: [...selected] });
				if (revision !== summaryRevision) return;
				const percent = coverage.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
				$('territory-coverage').textContent = `Recortes locais antigos: ${percent}% da seleção (${coverage.imagens.length ? coverage.imagens.join(' e ') : 'nenhum'}). A análise usará o cache ou buscará imagens IGC 2023/2024 no DataGEO.`;
			} catch {
				if (revision === summaryRevision) $('territory-coverage').textContent = 'Não foi possível conferir a cobertura das imagens locais.';
			}
		} catch (error) {
			if (revision !== summaryRevision) return;
			$('territory-summary').textContent = 'Não foi possível calcular a área selecionada.';
			$('territory-coverage').textContent = '';
			renderButtons(true); status(error.message, true);
		}
	}
	function fitSelection() {
		if (!summary?.bounds) return;
		const [west, south, east, north] = summary.bounds;
		map.fitBounds([[south, west], [north, east]], { padding: [30, 30] });
	}
	function setTool(next) {
		cancelDrawing(); tool = next; container.dataset.territoryTool = next;
		document.querySelectorAll('[data-territory-tool]').forEach(button => {
			button.setAttribute('aria-pressed', String(button.dataset.territoryTool === next));
		});
		renderSectors();
		status({
			click: 'Clique em um setor para selecionar ou remover.', box: 'Arraste para desenhar um retângulo sobre os setores.',
			free: 'Arraste para desenhar uma área fechada sobre os setores.'
		}[next]);
	}
	function toggleSector(id) {
		if (!active || drawingRequest) return;
		const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id);
		updateSelection(next); status(`Setor ${id} ${next.has(id) ? 'selecionado' : 'removido'}. A área inclui setores inteiros.`);
	}
	async function initialize() {
		collection = await request('/api/territorio/setores');
		const known = new Set(collection.features.map(feature => String(feature.id)));
		sectors = L.geoJSON(collection, {
			style: sectorStyle, onEachFeature(feature, layer) {
				layer.on('click', () => { if (active && tool === 'click' && performance.now() >= ignoreClickUntil) toggleSector(String(feature.id)); });
			}
		}).addTo(map);
		map.attributionControl.addAttribution('Setores © IBGE, Censo 2022');
		saved = readSaved(); renderSaved();
		try {
			const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
			if (draft?.source === collection.arboriza.sha256_fonte && Array.isArray(draft.sectors)
				&& draft.sectors.every(id => known.has(id))) selected = new Set(draft.sectors);
		} catch { /* Uma seleção temporária inválida não altera áreas salvas. */ }
	}
	async function start() {
		if (active || $('territory-toggle').disabled) return;
		$('territory-toggle').disabled = true; status('Carregando a malha de setores…');
		try {
			if (!collection) await initialize();
			active = true; generation++; onActiveChange(true);
			$('territory-toggle').setAttribute('aria-pressed', 'true');
			$('territory-toggle').textContent = 'Voltar aos pontos'; $('territory-details').hidden = false;
			setTool('click'); await updateSelection(selected);
			if (savedUnavailable) status('Não foi possível ler as áreas salvas; os dados existentes foram preservados.', true);
			if (window.matchMedia('(max-width: 720px)').matches) {
				const tab = document.querySelector('[data-tab="territory"]');
				if (document.body.dataset.panel === 'floating' && tab?.getAttribute('aria-expanded') === 'true') tab.click();
				else container.scrollIntoView({ block: 'start', behavior: 'smooth' });
			}
		} catch (error) { status(error.message, true); }
		finally { $('territory-toggle').disabled = false; }
	}
	function exit() {
		if (!active) return;
		active = false; generation++; cancelDrawing(); delete container.dataset.territoryTool;
		$('territory-toggle').setAttribute('aria-pressed', 'false');
		$('territory-toggle').textContent = 'Selecionar setores'; $('territory-details').hidden = true;
		renderSectors(); onActiveChange(false);
	}
	function cancelDrawing() {
		if (!drawing) return;
		drawing.layer.remove();
		if (container.hasPointerCapture(drawing.pointer)) container.releasePointerCapture(drawing.pointer);
		drawing = null; map.dragging.enable();
	}
	async function applyDrawing(geometry) {
		const currentGeneration = generation;
		const operation = $('territory-operation').value;
		drawingRequest = true; renderButtons(); status('Localizando os setores atingidos…');
		try {
			const result = await request('/api/territorio/intersecoes', { geometry });
			if (!active || currentGeneration !== generation) return;
			const next = operation === 'replace' ? new Set() : new Set(selected);
			for (const id of result.ids) operation === 'remove' ? next.delete(id) : next.add(id);
			await updateSelection(next);
			if (active && currentGeneration === generation) status(`${result.ids.length} ${result.ids.length === 1 ? 'setor atingido' : 'setores atingidos'}. A prévia inclui os setores inteiros.`);
		} catch (error) { if (active && currentGeneration === generation) status(error.message, true); }
		finally { drawingRequest = false; renderButtons(); }
	}
	container.addEventListener('pointerdown', event => {
		if (!active || tool === 'click' || drawingRequest || drawing || event.button !== 0 || !event.isPrimary
			|| event.target.closest('.leaflet-control, .leaflet-popup')) return;
		const start = map.mouseEventToContainerPoint(event);
		const latlng = map.containerPointToLatLng(start);
		const layer = tool === 'box' ? L.rectangle([latlng, latlng], { color: '#17659c', weight: 2, fillOpacity: .12, interactive: false })
			: L.polyline([latlng], { color: '#17659c', weight: 2, interactive: false });
		drawing = { pointer: event.pointerId, start, points: [start], layer: layer.addTo(map), type: tool };
		map.dragging.disable(); container.setPointerCapture(event.pointerId); event.preventDefault();
	});
	container.addEventListener('pointermove', event => {
		if (!drawing || drawing.pointer !== event.pointerId) return;
		const point = map.mouseEventToContainerPoint(event);
		if (drawing.type === 'box') drawing.layer.setBounds([map.containerPointToLatLng(drawing.start), map.containerPointToLatLng(point)]);
		else if (point.distanceTo(drawing.points.at(-1)) >= 4 && drawing.points.length < 2500) {
			drawing.points.push(point); drawing.layer.addLatLng(map.containerPointToLatLng(point));
		}
	});
	container.addEventListener('pointerup', event => {
		if (!drawing || drawing.pointer !== event.pointerId) return;
		const finished = drawing, end = map.mouseEventToContainerPoint(event);
		cancelDrawing(); ignoreClickUntil = performance.now() + 350;
		let points;
		if (finished.type === 'box') {
			if (Math.abs(end.x - finished.start.x) < 5 || Math.abs(end.y - finished.start.y) < 5) return status('Arraste para formar um retângulo com área.', true);
			points = [finished.start, L.point(end.x, finished.start.y), end, L.point(finished.start.x, end.y)];
		} else {
			points = [...finished.points, end];
			if (points.length < 4) return status('Desenhe uma área com pelo menos três lados.', true);
		}
		const ring = points.map(point => { const value = map.containerPointToLatLng(point); return [value.lng, value.lat]; });
		ring.push(ring[0]); applyDrawing({ type: 'Polygon', coordinates: [ring] });
	});
	container.addEventListener('pointercancel', cancelDrawing);
	document.addEventListener('keydown', event => {
		if (!active || event.key !== 'Escape' || $('confirm-dialog').open) return;
		event.preventDefault(); if (drawing) cancelDrawing(); else exit();
	});
	$('territory-toggle').onclick = () => active ? exit() : start();
	$('territory-exit').onclick = exit;
	document.querySelectorAll('[data-territory-tool]').forEach(button => button.onclick = () => setTool(button.dataset.territoryTool));
	$('territory-all').onclick = () => { updateSelection(collection.features.map(feature => String(feature.id)), true); status('Selecionados todos os setores urbanos do IBGE, incluindo núcleos isolados.'); };
	$('territory-invert').onclick = () => { updateSelection(collection.features.map(feature => String(feature.id)).filter(id => !selected.has(id))); status('Seleção invertida entre os setores urbanos.'); };
	$('territory-clear').onclick = () => { updateSelection([]); status('Seleção territorial limpa.'); };
	$('territory-fit').onclick = fitSelection;
	$('territory-sector').oninput = () => renderButtons();
	$('territory-sector-toggle').onclick = () => {
		const id = $('territory-sector').value.trim();
		if (!collection.features.some(feature => String(feature.id) === id)) return status('Código não encontrado entre os setores urbanos de Araçatuba.', true);
		toggleSector(id);
	};
	$('territory-save').onclick = () => {
		const name = $('territory-name').value.trim();
		if (!name) { $('territory-name').focus(); return status('Informe um nome para salvar a área.', true); }
		if (saved.some(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return status('Já existe uma área com esse nome. Escolha outro nome.', true);
		const item = { id: crypto.randomUUID(), name, source: collection.arboriza.sha256_fonte, sectors: [...selected] };
		saved.push(item);
		if (!writeSaved()) { saved.pop(); return; }
		renderSaved(); $('territory-saved').value = item.id; renderSaved();
		status(`Área “${name}” salva neste navegador.`);
	};
	$('territory-saved').onchange = renderSaved;
	$('territory-load').onclick = () => {
		const item = saved.find(value => value.id === $('territory-saved').value);
		if (!item) return;
		const known = new Set(collection.features.map(feature => String(feature.id)));
		if (item.source !== collection.arboriza.sha256_fonte || item.sectors.some(id => !known.has(id))) return status('A área usa uma versão diferente da malha IBGE e precisa ser conferida.', true);
		$('territory-name').value = item.name; updateSelection(item.sectors, true); status(`Área “${item.name}” recuperada.`);
	};
	$('territory-delete').onclick = async () => {
		const item = saved.find(value => value.id === $('territory-saved').value);
		if (!item || !await confirmAction('Excluir área salva?', `“${item.name}” será removida deste navegador.`, 'Excluir área')) return;
		const previous = saved; saved = saved.filter(value => value.id !== item.id);
		if (!writeSaved()) { saved = previous; return; }
		renderSaved(); status('Área salva removida. A seleção atual foi preservada.');
	};
	$('territory-export').onclick = async () => {
		try {
			const data = await request('/api/territorio/geojson', { ids: [...selected] });
			data.features[0].properties.nome = $('territory-name').value.trim() || 'Área territorial';
			const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/geo+json' }));
			const link = document.createElement('a'); link.href = url; link.download = 'arboriza-area-territorial.geojson'; link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000); status('Área territorial exportada em GeoJSON.');
		} catch (error) { status(error.message, true); }
	};
	return { get active() { return active; }, get selection() {
		if (!active || !summary?.bounds || !selected.size || drawingRequest) return null;
		const [west, south, east, north] = summary.bounds;
		return { ids: [...selected], source: collection.arboriza.sha256_fonte,
			bounds: [[south, west], [north, east]] };
	}, exit };
}
