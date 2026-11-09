import { streetCategory } from './street-data.js';

const number = (value, digits = 1) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
const $ = id => document.getElementById(id);

export function createStreetPanel({ select, focus, back, filter, presentation, boundary, points, retry }) {
	$('street-back').onclick = back;
	$('street-retry').onclick = retry;
	$('street-search').oninput = () => filter(null, $('street-search').value);
	for (const button of document.querySelectorAll('[data-street-filter]')) button.onclick = () => filter(button.dataset.streetFilter, null);
	for (const button of document.querySelectorAll('[data-street-background]')) button.onclick = () => presentation(button.dataset.streetBackground);
	$('street-boundary').onchange = () => boundary($('street-boundary').checked);
	$('street-points').onchange = () => points($('street-points').checked);
	let rows = new Map(), selectedId = null;
	function showDetail(entry, distance, autoScroll = true) {
		const empty = $('street-detail-empty'), panel = $('street-detail');
		empty.hidden = Boolean(entry); panel.hidden = !entry;
		for (const [id, row] of rows) row.setAttribute('aria-pressed', String(Boolean(entry && id === String(entry.feature.id))));
		if (!entry) { selectedId = null; return; }
		const p = entry.feature.properties;
		const v2 = p.cobertura_copas_base_percentual !== undefined;
		$('street-detail-name').textContent = p.nome;
		$('street-detail-number').textContent = `Trecho ${entry.number} · ${p.vizinhanca_parcial ? 'entorno parcial' : 'entorno completo'}`;
		$('street-detail-count-label').textContent = v2 ? 'Individuais' : 'Pontos';
		$('street-detail-rate-label').textContent = v2 ? 'Individuais / 100 m' : 'Pontos / 100 m';
		$('street-detail-count').textContent = v2 ? p.individuos_proximos : p.pontos_proximos;
		$('street-detail-length').textContent = `${number(p.comprimento_m)} m`;
		$('street-detail-rate').textContent = number(v2 ? p.individuos_por_100m : p.pontos_por_100m, 2);
		$('street-detail-canopies').hidden = !v2;
		if (v2) {
			$('street-detail-types').textContent = `Também pelo ponto: ${count(p.grupos_proximos, 'grupo', 'grupos')} · ${count(p.complementos_proximos, 'pendente', 'pendentes')}.`;
			$('street-canopy-percent').textContent = `${number(p.cobertura_copas_base_percentual, 2)}%`;
			$('street-canopy-area').textContent = `· ${number(p.area_copas_base_m2, 2)} m² de ${number(p.area_faixa_avaliada_m2, 2)} m² avaliados`;
			const masks = p.mascaras_na_faixa_por_tipo;
			$('street-canopy-masks').textContent = `Máscaras na faixa: ${count(masks.copa_individual, 'individual', 'individuais')} · ${count(masks.grupo_de_copas, 'grupo', 'grupos')}. Pendentes excluídos.`;
		}
		$('street-detail-coverage').textContent = `${number(p.cobertura_entorno_percentual, 2)}% da faixa de ${distance} m ao redor do trecho está dentro dos setores analisados.`;
		$('street-detail-note').textContent = p.vizinhanca_parcial
			? 'Os pontos disponíveis continuam contados. A parte do entorno fora dos setores não foi avaliada.'
			: 'Todo o entorno geométrico está dentro dos setores. As detecções e a base de ruas ainda precisam de revisão.';
		$('street-focus').onclick = () => focus(String(entry.feature.id));
		const strip = $('street-strip'); strip.replaceChildren();
		const svgNS = 'http://www.w3.org/2000/svg';
		const add = (name, attrs) => { const el = document.createElementNS(svgNS, name); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); strip.append(el); return el; };
		add('line', { x1: 10, y1: 20, x2: 290, y2: 20, stroke: 'currentColor', 'stroke-width': 2 });
		for (const point of p.pontos_associados || []) add('circle', { cx: 10 + 280 * Math.min(1, Math.max(0, point.posicao_m / p.comprimento_m)), cy: 20, r: 4,
			fill: point.tipo === 'grupo_de_copas' ? '#7954b5' : point.tipo === 'complemento_pendente' ? '#b66a08' : 'currentColor', opacity: .75 });
		strip.setAttribute('aria-label', `${p.pontos_proximos} pontos projetados ao longo de ${number(p.comprimento_m)} metros do eixo da rua.`);
		$('street-strip-end').textContent = `${number(p.comprimento_m)} m`;
		if (autoScroll && selectedId !== String(entry.feature.id)) panel.scrollIntoView({ block: 'start', behavior: 'instant' });
		selectedId = String(entry.feature.id);
	}
	return {
		open(layer) {
			$('street-workspace').hidden = false; $('street-layer-name').textContent = layer.name;
			$('street-search').value = ''; $('street-boundary').checked = true;
			$('street-workspace').setAttribute('aria-busy', 'true');
			$('street-results').hidden = true; $('street-loading').hidden = false; $('street-failure').hidden = true;
			showDetail(null); $('street-back').focus({ preventScroll: true });
		},
		close() { $('street-workspace').hidden = true; },
		error(message) { $('street-workspace').setAttribute('aria-busy', 'false'); $('street-loading').hidden = true; $('street-failure').hidden = false; $('street-error').textContent = message; },
		ready(data, totals) {
			const v2 = Boolean(data.arboriza.multicamadas), types = data.arboriza.totais_por_tipo;
			$('street-input-summary').hidden = !v2;
			$('street-v2-explanation').hidden = !v2;
			$('street-point-type-legend').hidden = !v2;
			$('street-canopy-method').hidden = !v2;
			if (v2) $('street-input-summary').textContent = `${count(data.arboriza.camadas_consideradas, 'camada', 'camadas')} · ${count(types.copa_individual, 'individual', 'individuais')} · ${count(types.grupo_de_copas, 'grupo', 'grupos')} · ${count(types.complemento_pendente, 'pendente', 'pendentes')}.`
				+ (data.arboriza.duplicados_ignorados ? ` ${data.arboriza.duplicados_ignorados} registros duplicados ignorados.` : '');
			for (const prefix of ['street-filter', 'street-legend']) {
				$(`${prefix}-empty-label`).textContent = v2 ? 'Sem pontos-base' : 'Sem pontos';
				$(`${prefix}-detected-label`).textContent = v2 ? 'Com pontos-base' : 'Com pontos';
			}
			$('street-source-kind').textContent = data.arboriza.tipo_base_viaria === 'acervo_urbano_osm' ? 'OSM local' : 'Piloto';
			$('street-workspace').setAttribute('aria-busy', 'false'); $('street-loading').hidden = true; $('street-failure').hidden = true; $('street-results').hidden = false;
			$('street-sector-summary').textContent = `${data.arboriza.setores.length} setor(es) · ${totals.all} trechos em ordem alfabética`;
			$('street-coverage-summary').textContent = `${totals.partial} trechos têm parte do entorno fora da área analisada. Eles continuam mostrando os pontos disponíveis.`;
			$('street-points-summary').textContent = `${data.arboriza.pontos_enviados} pontos na camada; ${data.arboriza.pontos_sem_via_proxima} sem via próxima e ${data.arboriza.pontos_fora_selecao} fora dos setores.`;
			$('street-method-distance').textContent = `${data.arboriza.distancia_m} m`;
			for (const key of ['all', 'no-points', 'with-points']) $(`street-count-${key}`).textContent = totals[key];
		},
		list(entries, category, total) {
			rows.clear(); $('street-list').replaceChildren();
			for (const button of document.querySelectorAll('[data-street-filter]')) button.setAttribute('aria-pressed', String(button.dataset.streetFilter === category));
			$('street-list-summary').textContent = `${entries.length} de ${total} trechos`;
			$('street-list-empty').hidden = entries.length > 0;
			for (const entry of entries) {
				const p = entry.feature.properties, li = document.createElement('li'), button = document.createElement('button');
				button.type = 'button'; button.className = 'street-row'; button.dataset.category = streetCategory(entry.feature); button.setAttribute('aria-pressed', 'false');
				const name = document.createElement('strong'); name.textContent = p.nome;
				const info = document.createElement('span'); info.textContent = `Trecho ${entry.number} · ${number(p.comprimento_m)} m · `
					+ (p.individuos_proximos === undefined ? `${p.pontos_proximos} ponto(s)`
						: `${count(p.individuos_proximos, 'individual', 'individuais')} · ${count(p.grupos_proximos, 'grupo', 'grupos')} · ${count(p.complementos_proximos, 'pendente', 'pendentes')}`);
				const coverage = document.createElement('small'); coverage.textContent = p.vizinhanca_parcial ? `Entorno parcial · ${number(p.cobertura_entorno_percentual)}% dentro da área` : 'Entorno completo';
				button.append(name, info, coverage); button.onclick = () => select(String(entry.feature.id), 'list');
				li.append(button); $('street-list').append(li); rows.set(String(entry.feature.id), button);
			}
		},
		detail: showDetail,
		background(mode) { for (const button of document.querySelectorAll('[data-street-background]')) button.setAttribute('aria-pressed', String(button.dataset.streetBackground === mode)); },
		visibility(view) { $('street-boundary').checked = view.boundary; $('street-points').checked = view.points; }
	};
}
