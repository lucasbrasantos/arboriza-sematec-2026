# Levantamento de camadas, território e paridade com o protótipo

Inspeção estática em 08/11/2026. Pedido: levantar lacunas antes de continuar a interface ou integrar backend. Nenhuma interface, processamento ou banco foi alterado nesta rodada.

## Correção do modelo da interface

A amostra React trata os recortes Centro/Centro-norte como seleção principal e usa Camadas para ligar/desligar tipos de dados. Isso ainda não representa a coleção de resultados que o usuário precisa gerenciar.

- **Território:** setores censitários selecionados ou geometria que define o estudo.
- **Execução/importação:** origem de um resultado, com identidade e parâmetros próprios.
- **Camada de resultado:** conjunto visual com ID, nome, geometria de referência, pontos/copas e vínculo com a execução/importação. Uma execução pode produzir várias camadas relacionadas.
- **Registro no acervo/publicação:** organiza o material salvo e define o que ficará disponível ao público. A composição do registro precisa preservar a família de camadas; não pressupor uma análise igual a uma única camada.

Distinguir camada **visível** de camada **ativa para edição/inspeção**. Várias podem ser exibidas simultaneamente; somente uma deve ser alvo de edição por vez. Alternar visibilidade não deve trocar silenciosamente a camada editável. O enquadramento automático será uma preferência, com ação manual sempre disponível.

## O que o código atual do protótipo confirma

`frontend/js/layers.js` mantém coleção, ID, camada ativa, metadados de análise/parte/área e recuperação local. `app.js` renderiza os pontos da camada atual, restaura área/setores ao selecionar e oferece enquadramento automático opcional. Assim, busca e exibição geral simultânea de várias camadas são melhorias solicitadas para o React, não capacidades gerais comprovadas no renderizador atual.

Há seleção multicamadas específica no diagnóstico v2: individuais, grupos e complementos da mesma execução, com regras de vínculo/deduplicação. Essa escolha não altera automaticamente as camadas exibidas no mapa. Referências: `street-inputs.js`, `street-analysis.js` e `docs/DIAGNOSTICO_MULTICAMADAS_V2.md` do protótipo.

Uma análise pode gerar camadas de indivíduos, grupos de copas e complementos pendentes. Essas categorias têm significados diferentes; não somar grupos e pendentes como árvores individuais confirmadas.

## Matriz de lacunas

| Item | Protótipo inspecionado | React antes desta rodada | Próxima interface recomendada |
|---|---|---|---|
| Coleção de resultados | Camadas com identidade e camada ativa | Recortes fixos e visibilidade por tipo | Gerenciador próprio, sempre acessível |
| Busca e volume | Lista de camadas sem busca; pontos com carregamento adicional | Grupos paginados de exemplos | Busca/filtros, grupos por execução, paginação ou renderização incremental; desempenho precisa de teste |
| Várias camadas no mapa | Renderização geral da ativa; combinação específica no diagnóstico v2 | Um recorte de exemplos por vez | Visibilidade individual e simultânea, camada ativa destacada |
| Enquadramento | Preferência automática ao selecionar e ação manual | Centralizar recorte fixo | Enquadrar camada ou todas as visíveis; preferência de enquadramento ao ativar |
| Propriedades da camada | Nome, contagens, área de estudo, origem/partes e vínculos | Inspetor somente de ponto/trecho fictício | Inspetor com abas Camada/Seleção; total da camada e total no recorte separados |
| Limites e áreas | Retângulo, contexto territorial e restauração de setores da execução | Retângulos de referência | Distinguir retângulo envolvente, setores selecionados e área efetivamente analisada |
| Setores IBGE | Malha urbana, clique/código/desenho, operações de seleção | Ausentes | Visualizar geometrias reais, busca por código, seleção e resumo territorial |
| Seleção territorial | Substituir/adicionar/remover; todos/inverter/limpar; área nomeada/exportação | Controle indisponível | Barra contextual e lista de setores selecionados, com retorno aos pontos |
| Edição e histórico | Adicionar/mover/apagar, seleção múltipla/retangular, desfazer/refazer | Apenas seleção; demais botões indisponíveis | Edição local vinculada à camada ativa e histórico por camada |
| Copas v2 | Polígonos e pontos vinculados, categorias e restrições de edição | Sem copas | Mostrar/ocultar copas; seleção vinculada; exclusão/desfazer do par; preservar identidade |
| Importação/exportação | GeoJSON com área, copas e metadados; validação de vínculos | Indisponível | Importação real de arquivo local, erros úteis e exportação preservando a informação |
| Acompanhamento | Execução/status reais, retomada do mesmo pedido e avisos de resultados | Modal demonstrativo com sucesso/erro/interrupção | Preservar estados de perda de conexão, retomada e carregamento das camadas |
| Diagnóstico de ruas | Busca, filtros, mapa/detalhes, distância, camadas v2 e cobertura por máscaras | Trechos fictícios | Leitor de resultados de diagnóstico, categorias/legenda e métricas com denominador explícito |
| Modos da interface | Painel lateral/flutuante e preferências locais | Laterais recolhíveis | Detalhado/Compacto alteram composição; preservam camadas, seleção e tarefa |

## IBGE: dados disponíveis e limites

Conferido o arquivo `prototipo-01/data/territorial/setores-urbanos-aracatuba-ibge-2022.geojson`: 687.245 bytes, 499 feições Polygon com IDs e metadados da malha definitiva do Censo 2022; recorte municipal de Araçatuba/SP, situação Urbana. Fonte e hash registrados no próprio arquivo; preparação em `scripts/preparar_setores_ibge.py`.

O arquivo cobre os setores classificados como urbanos dessa fonte, inclusive núcleos isolados. Não representa todos os setores rurais ou o perímetro urbano legal atual. Nesta inspeção não houve novo download nem validação geométrica exaustiva.

O protótipo usa API Python para interseção do desenho, união/área em projeção métrica, resumo, cobertura de imagens e exportação territorial. A seleção por desenho retorna setores inteiros com interseção de área positiva; não transforma o desenho automaticamente no polígono exato da análise.

Podemos exibir a malha e selecionar IDs por clique/código no React a partir de arquivo estático, sem novo backend. Desenho, união e medição podem executar no cliente com implementação validada ou reaproveitar o serviço territorial existente. Não calcular área de polígonos somando graus de latitude/longitude. Não reconstruir a área analisada apenas pelo envelope dos pontos: uma análise válida pode retornar zero candidatos.

## Gerenciador e modos propostos

**Detalhado administrativo:** região própria para a coleção de camadas, com busca, filtros, agrupamento por execução, visibilidade e camada ativa. Contextos Área/Análise/Revisão permanecem acessíveis; detalhes da camada e do elemento selecionado na direita. Barra flutuante preservada. Um gerenciador maior, com espaço real de layout, é aceitável neste modo.

**Compacto:** composição flutuante atual, com gerenciador recolhível. Troca de modo preserva camadas visíveis, camada ativa, setores, ferramenta, seleção e alterações. Evitar exibir uma segunda cópia independente do estado.

Metadados úteis: nome, origem (análise/importação/manual), ID da execução, categoria, área territorial, retângulo em ha/m²/km² identificado como tal, quantidade total e dentro da área, data/parâmetros quando disponíveis, revisão e situação de salvamento/publicação. Sem inventar valores indisponíveis. Polígonos de copa e resultados de diagnóstico têm legendas e medidas próprias.

**Mapa público:** mesma organização de resultados publicados, com nomes e prévias, busca e visibilidade; inspeção de informações e setores associados quando disponíveis. Sem edição, parâmetros de execução ou acesso à IA. Exibir vários resultados não os funde nem valida sua soma. Não deduplicar árvores de análises sobrepostas apenas por proximidade. “Sem análise”, “resultado vazio” e “camada oculta” precisam ser distintos.

## O que pode avançar antes do backend novo

1. Modelo de camadas na interface, camada ativa/visível, gerenciador pesquisável e múltipla exibição com exemplos identificados.
2. Modos Detalhado/Compacto e inspetor de camada/seleção, com preservação do contexto.
3. Malha real do IBGE como arquivo estático, consulta e seleção inicial por ID/clique. Confirmar cálculos/desenhos em etapa própria.
4. Importação/exportação local, metadados e revisão local, respeitando o contrato de arquivos do protótipo.
5. Leitura de resultados já processados e estados de interface para jobs/diagnósticos.

Persistência compartilhada, login/autorização, execução de IA, publicação efetiva, regras canônicas de abrangência e consultas em grande volume dependem de integração. O protótipo já possui API territorial e processamento, além de acervo viário SQLite documentado; integrar não exige reescrever esses cálculos do zero. A existência dos arquivos/rotas não comprova execução validada nesta rodada.

## Ordem recomendada

Gerenciador e identidade das camadas → malha/seleção IBGE → edição e arquivos locais → composição pública dos publicados → integração de execução e persistência. Não esgotar todas as telas de configuração antes de fechar os contratos: camadas, território e metadados precisam permanecer compatíveis com as saídas reais.


## Evolução após o levantamento

Implementados no mapa administrativo o gerenciador de camadas com múltipla visibilidade, modo Detalhado/Compacto, propriedades da camada e seleção inicial da malha IBGE real por clique/código. Estado e limites em [Mapa administrativo](MAPA_ADMINISTRATIVO.md). O catálogo público ainda aguarda sua rodada de implementação.
