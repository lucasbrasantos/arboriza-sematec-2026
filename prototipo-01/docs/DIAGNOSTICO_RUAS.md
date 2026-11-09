# Diagnóstico de ruas: interface e lógica do piloto

## Objetivo e decisões desta etapa

Permitir conferir a relação entre pontos de possíveis árvores e trechos de ruas antes de definir prioridades ou propostas de plantio. As escolhas validadas pelo usuário foram painel lateral substituindo a edição e imagem aérea suavizada ao entrar, com alternância para a original.

O diagnóstico é um modo de leitura. A navegação do mapa permanece disponível; os atalhos e gestos que editam pontos ficam suspensos. Sair restaura ferramentas, pontos, densidade e mapa de fundo conforme as preferências anteriores. Nenhum ponto é movido para o eixo da rua, excluído ou criado por esse modo.

## Base urbana ampliada

A etapa posterior instalou um catálogo SQLite para os **499 setores urbanos**. O diagnóstico prefere esse acervo e mantém as três amostras como fallback quando o banco não está instalado. Consulte [ACERVO_RUAS_URBANAS.md](ACERVO_RUAS_URBANAS.md) para aquisição, índices, desempenho e atualização. As referências a três setores abaixo descrevem o piloto anterior.

## Como testar

Para combinar indivíduos e grupos do modelo v2, com cobertura por máscaras e
contagens separadas, consulte [DIAGNOSTICO_MULTICAMADAS_V2.md](DIAGNOSTICO_MULTICAMADAS_V2.md).
As instruções de camada única abaixo continuam válidas para o Controle.

1. Inicie a API/interface pelo fluxo local e abra `index.html`. Após atualizar o código, recarregue a página; reinicie o servidor se ele ainda estiver executando a versão Python anterior.
2. Em Camadas, selecione uma análise territorial com pontos e resumo disponível neste computador. O piloto tem vias locais para os setores `350280405000005`, `350280405000340` e `350280405000505`.
3. Em Diagnóstico de ruas, mantenha a distância de 25 m ou ajuste entre 5 e 100 m. Clique em Analisar ruas próximas.
4. Confira a silhueta real do setor, o escurecimento externo e a legenda. Alterne imagem suavizada/original e contorno sem executar novamente a análise.
5. Busque uma rua; a busca ignora acentos e maiúsculas. Filtre Todos, Sem pontos ou Com pontos. As linhas que não correspondem ao filtro ficam discretas e deixam de ser selecionáveis.
6. Clique em um trecho da lista ou do mapa. O trecho fica azul, assim como seus pontos associados. Os detalhes mostram números e distribuição ao longo do eixo. O botão Enquadrar trecho sempre permite localizar manualmente. A seleção pela lista só enquadra automaticamente se a preferência do menu Camadas estiver habilitada.
7. Volte à edição. Confira que a contagem, posições, seleção e histórico de pontos permanecem preservados.

## Entrada e vínculo territorial

`POST /api/ruas/diagnostico` recebe:

```json
{
  "analysis_id": "20261106T152006Z-99eb9532",
  "distancia_m": 25,
  "pontos": [[-50.44, -21.21]]
}
```

As coordenadas são longitude/latitude em WGS84 e refletem a camada atual, inclusive revisões feitas pelo usuário. Os setores vêm de `resultados/interface/<analysis_id>/resumo.json`, com conferência do hash da malha IBGE. O cliente não substitui arbitrariamente esse vínculo enviando outros setores. Uma camada manual sem vínculo não pode ser diagnosticada neste piloto; a interface explica essa condição.

As vias vêm das amostras locais GeoJSON do OpenStreetMap, com setor, hash da malha e data de coleta conferidos. A consulta não executa novamente o detector de copas e não baixa ortofotos para fazer esse cruzamento. O mapa navegável continua podendo solicitar suas imagens de fundo ao DataGEO.

## Cálculo passo a passo

1. Unir as geometrias dos setores selecionados e projetar para EPSG:31982, com unidades em metros.
2. Deduplicar as vias por ID OSM e recortá-las pela união dos setores.
3. Dividir cada parte linear de cada via em trechos de até 100 m. O restante pode ser menor. Não há, nesta etapa, fusão de vias por nome nem segmentação semântica por quarteirão ou cruzamento.
4. Construir um índice espacial STRtree para procurar o trecho mais próximo de cada ponto.
5. Contar à parte os pontos fora da seleção. Para os pontos internos, procurar o trecho mais próximo até a distância escolhida. Se não houver nenhum, contar como sem via próxima. Um ponto elegível contribui para apenas um trecho, mesmo em cruzamentos. Empates usam o ID do trecho para resultado determinístico.
6. Para cada associação, devolver o índice do ponto na entrada (`indice`), sua projeção em metros ao longo da linha (`posicao_m`) e a distância ao eixo (`distancia_m`). O índice liga o detalhe aos pontos originais no mapa. A projeção serve somente ao desenho linear no painel.
7. Calcular `pontos_por_100m = quantidade * 100 / comprimento_m`. Por exemplo, 3 pontos em 50 m correspondem a 6 pontos por 100 m. Isso normaliza comprimento; não representa porcentagem de vegetação.
8. Gerar uma faixa geométrica em torno do trecho com `buffer(distancia_m)`, incluindo extremidades arredondadas. Calcular `cobertura_entorno_percentual = 100 * area(faixa ∩ setores) / area(faixa)`.
9. Marcar entorno parcial quando mais de 0,01 m² dessa faixa fica fora dos setores. Essa tolerância trata ruído numérico, não classifica prioridade. O percentual exibido é arredondado para duas casas; perto de 100%, arredondamento e tolerância podem produzir um trecho parcial exibindo 100%.

A soma das associações, dos pontos sem via próxima e dos pontos fora da seleção deve ser igual à quantidade enviada. A porcentagem do entorno não mede cobertura de copa, qualidade das detecções, cobertura da imagem ou completude do OSM. Apenas diz quanto da faixa geométrica está dentro da seleção.

## Leitura das cores e do mapa

| Sinal | Significado |
|---|---|
| Laranja | Zero pontos associados ao trecho segundo os parâmetros atuais |
| Verde azulado | Um ou mais pontos associados |
| Azul | Trecho selecionado e seus pontos associados |
| Contorno claro tracejado | Limite real da união dos setores |
| Exterior escurecido | Começa 20 m além dos setores para dar respiro visual às ruas da borda |
| Entorno parcial nos detalhes | Parte da faixa de comparação está fora dos setores analisados |

Não há comparação com metade da maior taxa nem classificação automática de prioridade. Trechos com entorno parcial continuam recebendo a cor correspondente à contagem. Todos os pontos da camada aparecem no mapa; apenas os associados ao trecho selecionado ficam azuis.

A abertura da máscara usa uma cópia da união dos setores com buffer de **20 m**, calculado em EPSG:31982 e devolvido como `geometria_contexto_visual`, com `margem_contexto_visual_m: 20`. Essa cópia serve exclusivamente à visualização; recorte de vias, associação de pontos e métricas continuam usando a união original. O tracejado continua no limite real. A margem segue a geometria com cantos arredondados, em vez de escalar os vértices pelo centro. Se o servidor ainda não enviar essa geometria, a interface usa o limite original como fallback.

As camadas Leaflet têm ordem explícita: máscara, ruas, rua selecionada, pontos e contorno. O limite permanece por cima das ruas. As vias usam traço colorido de **7 px a 82% de opacidade**, apoiado por base clara de 12 px a 38%; o selecionado usa azul de 10 px a 90% com base clara de 15 px a 70%. Extremidades e junções arredondadas mantêm a leitura contínua. Os filtros atenuam as duas partes do traço e desativam a interação das vias filtradas. A suavização aplica um filtro visual somente às imagens de fundo; não modifica pixels usados pelo modelo ou coordenadas.

## Organização do código

| Arquivo | Responsabilidade |
|---|---|
| `backend/api.py` | Contrato HTTP, validação de entrada e vínculo da análise |
| `backend/street_analysis.py` | Projeção, recorte, trechos, índice espacial, associação única e métricas |
| `frontend/js/street-analysis.js` | Ciclo do modo, consulta cancelável, descarte de respostas antigas, filtros e seleção |
| `frontend/js/street-data.js` | Categorias descritivas, ordenação, busca, totais e anéis da máscara |
| `frontend/js/street-map.js` | Panes, estilos, contorno, máscara, pontos e enquadramento |
| `frontend/js/street-panel.js` | Lista, detalhes, distribuição linear e controles acessíveis |
| `frontend/js/app.js` | Integração com ferramentas e restauração do modo de edição |
| `frontend/index.html`, `frontend/css/street-analysis.css` | Estrutura, legenda, estados e composição responsiva |

Enquanto a consulta ocorre, há estado de carregamento e retorno disponível. Sair cancela a espera no cliente e descarta uma eventual resposta tardia; não promete interromper um cálculo síncrono já iniciado no servidor. Erros mantêm a saída e oferecem tentar novamente. Uma assinatura da camada, análise, pontos e distância impede reaproveitar resultados desatualizados. O timeout da consulta é de 30 s. Filtrar, selecionar, alternar imagem e ocultar contorno usam o resultado em memória, sem repetir a consulta.

Os textos provenientes de nomes de vias e erros são inseridos com `textContent`. Lista e controles usam botões nativos e estado pressionado. A cor é acompanhada por legenda e informação textual. A lista segue ordem alfabética; seu número identifica o trecho nessa listagem, sem representar ranking.

## Restauração sobre o modelo v2

O stash `analise de ruas aprimorada` foi reaplicado preservando a entrada original
no Git. Os conflitos de `app.js` e `analysis.js` foram combinados com o v2:
mensagens de cache/fontes e vínculo ponto/copa foram mantidos. Entrar no diagnóstico
oculta as máscaras e a legenda de copas; sair restaura a visualização anterior e
conserva o bloqueio de movimento do v2. A importação versionada do módulo territorial
evita recuperar a versão antiga em cache, sem `restoreSelection`.

O diagnóstico continua recebendo os pontos da camada ativa. Para contar candidatos
individuais do v2, usar sua camada de indivíduos; os pontos das camadas de grupos
e complementos têm seus próprios significados. Nesta restauração não foi criada
uma regra nova de agregação, prioridade ou confirmação de plantio.

Validação da integração: **71 testes Python e 33 JavaScript**. Uma consulta HTTP
real com 72 pontos do setor `350280405000005` retornou 38 trechos e margem visual
de 20 m. No navegador, uma nova camada Controle Local do mesmo setor gerou
78 candidatos usando somente o acervo; o diagnóstico exibiu 38 trechos, com filtros,
seleção e retorno à edição preservando os pontos. O v2 também manteve seus 74 pares
e o bloqueio de movimento após entrar/sair do diagnóstico. Um recorte sem vínculo
territorial continua recebendo erro explícito, como no piloto original.

Captura de conferência: `resultados/restauracao-ruas/diagnostico.jpg`.
Os dados de ruas continuam limitados às três amostras locais do piloto.
LoveDA/UDD/YOLO do projeto recebido não foram incorporados: a próxima decisão
é ampliar a base viária e definir as métricas com pontos/copas do v2 antes de
adotar novas segmentações ou chamar trechos de locais aptos para plantio.

## Validação de 06/11/2026

- 47 testes Python passaram: API, análise, território, imagens/cache e diagnóstico. Os novos casos conferem associação única, conservação da quantidade de pontos, índices, projeções e cobertura geométrica.
- 24 testes JavaScript passaram: incluindo seleção ligada ao mapa, filtros, enquadramento opcional, preservação da camada, invalidação, cancelamento, erro/repetição, resposta tardia e máscara com buracos.
- Conferência no navegador em 1280 × 720 e em viewport de 390 × 844: lista e clique no eixo da rua, seleção e seus pontos, busca/filtro sem resultados, troca do tratamento da imagem e retorno à edição. O painel do diagnóstico permaneceu lateral mesmo com preferência de edição flutuante; ao sair, a edição voltou com os 72 pontos. Não foram registrados erros de console nessa conferência. O viewport estreito é uma simulação no navegador, não teste em aparelho físico.
- Ajuste posterior da margem de 20 m e dos traços: 6 testes específicos do diagnóstico Python e os 24 testes JavaScript passaram. O novo caso confirma que um ponto 10 m fora do setor aparece na área de contexto visual, mas permanece fora da análise; as vias continuam recortadas no limite original. O visual foi conferido novamente no desktop e viewport estreito, usando Rua Bandeirantes na borda do setor 005, sem erros de console e com os 72 pontos preservados ao sair.
- Cruzamento HTTP sobre resultados reais já salvos, sem nova inferência do detector:

| Análise | Pontos | Trechos | Trechos com pontos | Entorno parcial | Pontos associados |
|---|---:|---:|---:|---:|---:|
| Setor 005, 12:20:06 | 72 | 38 | 25 | 24 | 54 |
| Setor 340, 10:04:16 | 118 | 68 | 40 | 51 | 90 |

Os demais pontos ficaram nas categorias fora da seleção ou sem via próxima. Essa validação confere o processamento, não a identificação em campo de cada árvore.

## Limites e próxima validação

Amostras OSM podem omitir vias, inclusive vias sem nós dentro da caixa usada na coleta piloto. Eixos separados por sentido e partes de uma mesma rua podem gerar múltiplos trechos. Sobras muito pequenas ainda aparecem e sua taxa por 100 m deve ser interpretada com cuidado. Não foi criado um corte mínimo nem uma regra de agrupamento sem aprovação do usuário.

Os pontos são candidatos a copas, inclusive em terrenos privados, e a associação por proximidade não prova que a árvore está na calçada. Ausência de pontos não prova ausência de árvores. Este diagnóstico não identifica espaços plantáveis nem calcula os componentes 3, 30 ou 300 da regra 3-30-300.

Após validar esta interface, a próxima decisão recomendada é como agrupar trechos curtos e apresentar intervalos ao longo da rua sem pontos associados. Qualquer limiar de distância ou prioridade, bem como eventual margem de análise além dos setores para completar o entorno, deve ser validado antes de implementação. A base de vias para toda a cidade também precisa de uma fonte de extratos adequada; não ampliar com consultas em massa à API de edição OSM.
