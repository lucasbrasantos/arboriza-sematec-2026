// Estados descritivos, sem limiares de prioridade ou avaliação de plantio.
export const streetCategory = feature => (feature.properties.pontos_base_proximos ?? feature.properties.pontos_proximos) > 0 ? 'with-points' : 'no-points';

export function streetEntries(collection) {
	return [...collection.features].sort((a, b) => a.properties.nome.localeCompare(b.properties.nome, 'pt-BR')
		|| String(a.id).localeCompare(String(b.id))).map((feature, index) => ({ feature, number: index + 1 }));
}

export function visibleStreets(entries, category = 'all', search = '') {
	const clean = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
	const query = clean(search.trim());
	return entries.filter(({ feature }) => (category === 'all' || streetCategory(feature) === category)
		&& clean(feature.properties.nome).includes(query));
}

export function streetTotals(entries) {
	return { all: entries.length, 'with-points': entries.filter(e => streetCategory(e.feature) === 'with-points').length,
		'no-points': entries.filter(e => streetCategory(e.feature) === 'no-points').length,
		partial: entries.filter(e => e.feature.properties.vizinhanca_parcial).length };
}

export function outsideRings(geometry) {
	if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) throw new Error('O diagnóstico não retornou os limites dos setores.');
	const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
	return [[[85, -180], [85, 180], [-85, 180], [-85, -180]],
		...polygons.flatMap(polygon => polygon.map(ring => ring.map(([lng, lat]) => [lat, lng])))];
}
