import { readPoints } from './points.js';
import { pairCrowns, readCrowns } from './crowns.js';

// Polling sequencial: só agenda a próxima consulta depois de receber a anterior.
export function connectAnalysis(store, onLayer, isTerritoryActive = () => false, onVisualState = () => {}, getTerritory = () => null) {
	const $ = id => document.getElementById(id);
	const ids = { centro: 'centro', norte: 'centro-norte' };
	const sectorProfiles = ['controle', 'controle-datageo', 'controle-local', 'fusao'];
	let catalog = null, running = null;
	const status = (text, error = false) => {
		$('analysis-status').textContent = text;
		$('analysis-status').classList.toggle('error', error);
	};
	async function request(path, body) {
		const response = await fetch(path, { method: body ? 'POST' : 'GET',
			headers: body ? { 'Content-Type': 'application/json' } : {},
			body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			const error = new Error(typeof data.detail === 'string' ? data.detail : `Pedido recusado (${response.status}). Confira os parâmetros.`);
			error.status = response.status; throw error;
		}
		return response.json();
	}
	function refresh() {
		const recorte = catalog?.recortes.find(item => item.id === ids[$('area').value]);
		const selecting = isTerritoryActive(), territory = selecting && getTerritory();
		$('analyze').disabled = Boolean(running) || !catalog || (selecting
			? !territory || !sectorProfiles.includes($('analysis-profile').value) : !recorte?.disponivel);
		$('analysis-profile').disabled = !catalog || Boolean(running);
		$('analysis-score').disabled = Boolean(running);
		$('profile-help').textContent = catalog?.perfis.find(item => item.id === $('analysis-profile').value)?.descricao || 'Configurações do modelo Cambridge.';
		if (!running && catalog && selecting && !territory) status('A seleção por setores precisa conter ao menos um setor.');
		else if (!running && catalog && selecting && !sectorProfiles.includes($('analysis-profile').value)) status('Para setores, escolha um dos perfis Controle ou Restor + Cambridge.');
		else if (!running && catalog && selecting) status(`Pronto para analisar ${territory.ids.length} setor(es) completo(s).`);
		else if (!running && catalog && !recorte) status('Selecione setores para analisá-los ou escolha um dos recortes disponíveis.');
		else if (!running && recorte && !recorte.disponivel) status('A imagem local deste recorte não foi encontrada.', true);
		else if (!running && catalog && ($('analysis-status').textContent.startsWith('Selecione setores para analisá-los')
			|| $('analysis-status').textContent.startsWith('A seleção por setores'))) status('Pronto para analisar este recorte.');
	}
	async function monitor() {
		$('retry-analysis').hidden = true;
		onVisualState({ mode: 'running', stage: running.stage || `${running.name} · Acompanhando análise…`, seconds: running.seconds });
		try {
			while (running) {
				const context = running;
				const job = await request(`/api/analises/${context.id}`);
				const seconds = job.duracao_s.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
				context.seconds = job.duracao_s; context.stage = `${context.name} · ${job.etapa}`;
				onVisualState({ mode: 'running', stage: context.stage, seconds: context.seconds });
				status(`${context.name} · ${job.etapa} · ${seconds} s`);
				if (job.estado === 'erro') { running = null; refresh(); throw new Error(job.erro || 'A análise falhou.'); }
				if (job.estado === 'concluida') {
					onVisualState({ mode: 'running', stage: `${context.name} · Carregando resultado…`, seconds: context.seconds });
					const points = readPoints(await request(`/api/analises/${context.id}/geojson`));
					const extraLayers = [];
					let crowns;
					if (job.resumo?.perfil === 'fusao') {
						crowns = readCrowns(await request(`/api/analises/${context.id}/camadas/copas`));
						pairCrowns(crowns, points);
						for (const [part, label, count] of [['pontos-grupos', 'Grupos de copas', job.resumo.grupos_copas],
							['pontos-complementos', 'Complementos pendentes', job.resumo.complementos_pendentes]]) {
							if (count) extraLayers.push({ part, label, points: readPoints(await request(`/api/analises/${context.id}/camadas/${part}`)) });
						}
						for (const layer of extraLayers) pairCrowns(crowns, layer.points);
					}
					let completion;
					// A limpeza pode acontecer durante o download; conferir antes de adicionar.
					if (store.cleared === context.cleared) {
						const activate = store.revision === context.revision && $('area').value === context.area && !isTerritoryActive();
						const name = `${context.name} · ${context.profile} · score ${context.score.toLocaleString('pt-BR')} · ${new Date(job.criada_em).toLocaleString('pt-BR')}`;
						const metadata = { analysisId: context.id, recorte: job.recorte };
						if (crowns) Object.assign(metadata, { modelVersion: 2, crowns: pairCrowns(crowns, points) });
						if (context.territory) metadata.studyArea = { recorte: 'custom', bounds: context.territory.bounds };
						onLayer(name, points, metadata, activate);
						for (const layer of extraLayers) onLayer(`${name} · ${layer.label}`, layer.points,
							{ ...metadata, analysisPart: layer.part, crowns: pairCrowns(crowns, layer.points) }, false);
						const warning = job.resumo?.janelas_no_limite_deteccoes ? ' Algumas janelas atingiram o limite de detecções; revise o resultado.' : '';
						const cache = Number.isInteger(job.resumo?.janelas_cache)
							? (job.resumo.fonte_imagens === 'acervo_local'
								? ` Imagens: ${job.resumo.janelas_locais} janelas do acervo local, sem download; ${job.resumo.janelas_cache_acervo ?? 0} recortes prontos reutilizados. Inferência executada nesta análise.`
								: ` Imagens: ${job.resumo.janelas_cache} do cache e ${job.resumo.janelas_download} baixadas${job.resumo.fonte_imagens === 'datageo_direto_sem_cache' ? ', sem usar cache' : ''}.`) : '';
						completion = `${points.length} possíveis árvores · ${seconds} s. ${activate ? 'Camada pronta para revisão.' : 'Camada adicionada; sua edição atual foi preservada.'}${cache}${warning}`;
						if (job.resumo?.perfil === 'fusao') completion = `${points.length} copas individuais · ${job.resumo.grupos_copas} grupos · ${job.resumo.complementos_pendentes} complementos pendentes · ${seconds} s. Modelo v2: pontos e copas vinculados; ative Mostrar copas para visualizar.${warning}`;
					} else completion = `Análise concluída em ${seconds} s. O mapa foi limpo; o resultado ficou salvo no disco.`;
					running = null; onVisualState({ mode: 'idle' }); refresh(); status(completion); return;
				}
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		} catch (error) {
			// Falha HTTP pode ser transitória: permite acompanhar o mesmo pedido, sem reenviá-lo.
			if (error.status === 404) { running = null; refresh(); }
			onVisualState(running
				? { mode: 'waiting', stage: 'A análise pode continuar. Retome no painel.', seconds: running.seconds }
				: { mode: 'idle' });
			status(`${error.message} As camadas anteriores foram preservadas.`, true);
			$('retry-analysis').hidden = !running;
		}
	}
	$('analysis-profile').onchange = refresh;
	$('retry-analysis').onclick = monitor;
	$('analyze').onclick = async () => {
		if (running || !catalog || !$('analysis-score').reportValidity()) return;
		const territory = isTerritoryActive() ? getTerritory() : null;
		if (isTerritoryActive() && (!territory || !sectorProfiles.includes($('analysis-profile').value))) return;
		const area = $('area').value, recorte = catalog.recortes.find(item => item.id === ids[area]);
		if (!territory && !recorte?.disponivel) return;
		const profile = $('analysis-profile').selectedOptions[0];
		running = { area, revision: store.revision, cleared: store.cleared, name: territory ? `${territory.ids.length} setor(es)` : recorte.nome, territory,
			profile: profile.textContent, score: Number($('analysis-score').value) };
		onVisualState({ mode: 'running', stage: `${running.name} · Iniciando análise…` });
		refresh(); status('Iniciando análise…');
		try {
			const data = territory
				? await request('/api/analises/setores', { ids: territory.ids, fonte_malha: territory.source, score: running.score,
					...($('analysis-profile').value !== 'controle' ? { perfil: $('analysis-profile').value } : {}) })
				: await request('/api/analises', { recorte: recorte.id, perfil: profile.value, score: running.score });
			running.id = data.analysis_id;
			await monitor();
		} catch (error) { running = null; onVisualState({ mode: 'idle' }); refresh(); status(error.message, true); }
	};
	request('/api/recortes').then(data => {
		catalog = data;
		$('analysis-profile').replaceChildren(...data.perfis.map(profile => new Option(profile.nome, profile.id)));
		status('Pronto para analisar este recorte.'); refresh();
	}).catch(() => status('API indisponível. Inicie o protótipo pelo F5 e recarregue a página.', true));
	return { refresh };
}
