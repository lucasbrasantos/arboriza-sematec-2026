import { readPoints } from './points.js';

// Polling sequencial: só agenda a próxima consulta depois de receber a anterior.
export function connectAnalysis(store, onLayer, isTerritoryActive = () => false) {
	const $ = id => document.getElementById(id);
	const ids = { centro: 'centro', norte: 'centro-norte' };
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
		$('analyze').disabled = !recorte?.disponivel || Boolean(running) || isTerritoryActive();
		$('analysis-profile').disabled = !catalog || Boolean(running);
		$('analysis-score').disabled = Boolean(running);
		$('profile-help').textContent = catalog?.perfis.find(item => item.id === $('analysis-profile').value)?.descricao || 'Configurações do modelo Cambridge.';
		if (!running && catalog && isTerritoryActive()) status('A seleção por setores ainda não está disponível para análise.');
		else if (!running && catalog && !recorte) status('Análise disponível somente nos recortes Centro e Centro-norte.');
		else if (!running && recorte && !recorte.disponivel) status('A imagem local deste recorte não foi encontrada.', true);
		else if (!running && catalog && ($('analysis-status').textContent.startsWith('Análise disponível somente')
			|| $('analysis-status').textContent.startsWith('A seleção por setores'))) status('Pronto para analisar este recorte.');
	}
	async function monitor() {
		$('retry-analysis').hidden = true;
		try {
			while (running) {
				const context = running;
				const job = await request(`/api/analises/${context.id}`);
				const seconds = job.duracao_s.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
				status(`${context.name} · ${job.etapa} · ${seconds} s`);
				if (job.estado === 'erro') { running = null; refresh(); throw new Error(job.erro || 'A análise falhou.'); }
				if (job.estado === 'concluida') {
					const points = readPoints(await request(`/api/analises/${context.id}/geojson`));
					// A limpeza pode acontecer durante o download; conferir antes de adicionar.
					if (store.cleared === context.cleared) {
						const activate = store.revision === context.revision && $('area').value === context.area && !isTerritoryActive();
						const name = `${context.name} · ${context.profile} · score ${context.score.toLocaleString('pt-BR')} · ${new Date(job.criada_em).toLocaleString('pt-BR')}`;
						onLayer(name, points, { analysisId: context.id, recorte: job.recorte }, activate);
						status(`${points.length} possíveis árvores · ${seconds} s. ${activate ? 'Camada pronta para revisão.' : 'Camada adicionada; sua edição atual foi preservada.'}`);
					} else status(`Análise concluída em ${seconds} s. O mapa foi limpo; o resultado ficou salvo no disco.`);
					running = null; refresh(); return;
				}
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		} catch (error) {
			// Falha HTTP pode ser transitória: permite acompanhar o mesmo pedido, sem reenviá-lo.
			if (error.status === 404) { running = null; refresh(); }
			status(`${error.message} As camadas anteriores foram preservadas.`, true);
			$('retry-analysis').hidden = !running;
		}
	}
	$('analysis-profile').onchange = refresh;
	$('retry-analysis').onclick = monitor;
	$('analyze').onclick = async () => {
		if (running || !catalog || isTerritoryActive() || !$('analysis-score').reportValidity()) return;
		const area = $('area').value, recorte = catalog.recortes.find(item => item.id === ids[area]);
		if (!recorte?.disponivel) return;
		const profile = $('analysis-profile').selectedOptions[0];
		running = { area, revision: store.revision, cleared: store.cleared, name: recorte.nome,
			profile: profile.textContent, score: Number($('analysis-score').value) };
		refresh(); status('Iniciando análise…');
		try {
			const data = await request('/api/analises', { recorte: recorte.id, perfil: profile.value, score: running.score });
			running.id = data.analysis_id;
			await monitor();
		} catch (error) { running = null; refresh(); status(error.message, true); }
	};
	request('/api/recortes').then(data => {
		catalog = data;
		$('analysis-profile').replaceChildren(...data.perfis.map(profile => new Option(profile.nome, profile.id)));
		status('Pronto para analisar este recorte.'); refresh();
	}).catch(() => status('API indisponível. Inicie o protótipo pelo F5 e recarregue a página.', true));
	return { refresh };
}
