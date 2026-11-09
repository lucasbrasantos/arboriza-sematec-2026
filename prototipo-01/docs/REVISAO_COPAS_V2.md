# Modelo v2: visualização e revisão de pontos e copas

## Decisões aprovadas

- Começar mostrando somente os pontos; permitir ligar/desligar as copas.
- Cada proposta tem um ponto e um polígono com o mesmo `copa_id`.
- Excluir pelo ponto ou pela copa remove o par da revisão. Desfazer/refazer restaura/remove ambos.
- Não mover pontos nem copas do v2. Não adicionar pontos avulsos a essas camadas; usar uma camada manual.
- Usar o acervo urbano a 25 cm também nos recortes Centro/Centro-norte, sem fallback silencioso ao TIFF antigo ou ao DataGEO.

Um grupo também possui um ponto e um polígono, mas representa um grupo, não uma
árvore individual. Individuais, grupos e complementos continuam em camadas separadas.

## Como testar

1. Reiniciar a API e recarregar a interface do laboratório `prototipo-01`.
2. Escolher **Modelo v2 · Restor + Cambridge · experimental**.
3. Analisar Centro/Centro-norte ou selecionar setores completos e executar a análise.
4. Abrir **Arquivos e visualização** e marcar **Mostrar copas do modelo v2**.
   Com os dois controles de visibilidade é possível mostrar pontos, copas ou ambos.
5. Selecionar um ponto na lista/mapa ou clicar na copa. O destaque azul identifica
   a seleção; a ficha informa tipo, área da copa, coordenadas, score e vínculo.
6. Usar **Excluir ponto e copa**, **Apagar** ou Delete. Conferir a remoção do par.
   Ctrl+Z desfaz e Ctrl+Y refaz, durante a sessão.
7. Exportar a camada, recarregar e reimportar para conferir os pares restantes.

A legenda usa verde para indivíduos, roxo com traço interrompido para grupos,
âmbar pontilhado para complementos e azul para seleção. É recolhível. No celular,
o painel flutuante existente permite usar o mapa sem ocupar a tela com o painel lateral.

## Estado, histórico e persistência

`crowns.js` valida Polygon/MultiPolygon em WGS84, IDs únicos e correspondência
com os pontos. Um resultado incompleto não é adicionado parcialmente às camadas.

`PointLayer` mantém o histórico já existente dos pontos. As máscaras-base são
imutáveis: `livingCrowns(layer)` filtra os polígonos pelos pontos vivos na revisão.
Excluir altera a lista de pontos, e o mesmo filtro remove a máscara; desfazer
restaura o ponto e sua máscara. Isso evita dois históricos que possam divergir.
Mover/adicionar é bloqueado tanto nos controles/atalhos quanto no estado de pontos.
Camadas manuais e do Controle conservam a edição anterior.

Os pontos/metadados continuam no localStorage. As geometrias são guardadas em
IndexedDB (`arboriza-copas-v2`), por camada, e carregadas ao ativar uma camada v2.
O desenho dos polígonos é preparado somente quando sua visualização é ativada.
Os dados sobrevivem ao reinício da API; não dependem de a tarefa continuar no
catálogo em memória do servidor. Camadas antigas podem recuperar suas máscaras
pela API se a tarefa original ainda estiver disponível. Quando isso não é possível,
a interface oferece tentar novamente e orienta importar uma exportação ou refazer
a análise. Falhas de armazenamento orientam exportar a revisão.

**Exportar camada** continua gerando uma FeatureCollection de pontos e inclui
as copas vivas em `arboriza.copas`, a área de estudo, `versao_modelo: 2` e
`revisao_local: true`. Esse membro adicional preserva pontos e máscaras no mesmo
arquivo para reimportação no Arboriza. Outros leitores GeoJSON podem mostrar
somente os pontos; as máscaras originais em GeoJSON padrão continuam disponíveis
em `copas.geojson` no diretório da análise.

A importação mantém o limite de 10.000 pontos por camada, aceita até 50 MB para
arquivos com copas e conserva 5 MB para arquivos somente de pontos. Exportações
sem as copas carregadas são bloqueadas para não perder os vínculos.

As correções são locais à camada revisada. Não sobrescrevem `pontos.geojson`,
`copas.geojson` ou `resumo.json` da execução original. A cobertura do resumo original
continua sendo o retrato daquela execução; esta etapa não apresenta nem recalcula
uma porcentagem de cobertura revisada. Revisão das máscaras não é treinamento.

## Acervo e backend

O ID da API permanece `fusao`; a interface passa a chamá-lo de modelo v2.
`AnalysisService.run_fusion` fornece explicitamente apenas os TIFFs finalizados de
`data/ortofotos/acervo-urbano-25cm`. Os recortes conhecidos conservam o contorno
georreferenciado anterior; o TIFF antigo é consultado para delimitar esse contorno,
mas os pixels enviados às redes vêm do acervo.

O leitor compartilhado usa catálogo SQLite/RTree e cache limitado de recortes.
Permanece também o cache separado das máscaras de inferência. O resumo registra
`versao_modelo`, `fonte_imagens`, tempo de indexação, atualização de metadados,
`janelas_cache_acervo` e `janelas_cache_inferencia`. Não há aquisição de imagens
automática no v2. Ausência de cobertura gera erro explícito e preserva camadas anteriores.

## Validação desta etapa

- 65 testes Python e 25 JavaScript, incluindo fonte exclusiva do acervo, recorte,
  falta de acervo antes de carregar GPU, validação dos vínculos, exclusão,
  histórico, bloqueio de movimento/adição e preservação de camadas em erro.
- Centro, com acervo e GPU reais: **75 candidatos individuais, 0 grupos e 2
  complementos pendentes**, 16,3 s incluindo a primeira carga dos modelos.
  Execução: `resultados/interface/20261108T010035Z-f62a1445/`.
- Setor completo `350280405000001`, **13,96 ha**: **125 candidatos, 20 grupos e 10
  complementos**, 81 janelas, 11,95 s, com reutilização de parte da inferência.
  Todas as fontes registradas pertencem ao acervo urbano.
  Execução: `resultados/interface/20261108T010300Z-04ea89a4/`.
- Navegador real: estado inicial com pontos; mostrar copas; seleção; exclusão
  75→74; desfazer 74→75; refazer 75→74; reinício da API e recarga mantendo 74;
  exportação e reimportação de **74 pontos/74 polígonos**, com os mesmos IDs.
  O arquivo original permaneceu com 75 pontos.
- Conferência visual desktop/celular, sem erros de console JavaScript.
  Capturas em `resultados/v2-interface/desktop-final.jpg` e `mobile-final.jpg`.

Os números acima são propostas automáticas e evidências de funcionamento, não uma
medida de precisão por árvore. Não houve novo treinamento, captura de ortofotos,
alteração do mapa de fundo, integração com o React ou aplicação do stash de ruas.
