// O contorno é informativo: não captura cliques nem representa avanço espacial.
export function createAnalysisVisual() {
	const $ = id => document.getElementById(id);
	const mapArea = document.querySelector('.map-area');
	return state => {
		if (!state || state.mode === 'idle') {
			delete mapArea.dataset.analysisState;
			$('analysis-map-indicator').hidden = true;
			return;
		}
		mapArea.dataset.analysisState = state.mode;
		$('analysis-map-indicator').hidden = false;
		$('analysis-map-label').textContent = state.mode === 'waiting' ? 'Acompanhamento interrompido' : 'Análise em andamento';
		$('analysis-map-stage').textContent = state.stage;
		$('analysis-map-time').textContent = Number.isFinite(state.seconds)
			? `${state.seconds.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : '—';
	};
}
