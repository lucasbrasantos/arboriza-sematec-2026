# Mapa administrativo — primeira amostra em validação

## Objetivo e limites

Espaço de produção da equipe em `/admin/mapa`: selecionar território, executar análises ou importar resultados, revisar pontos/copas e trechos, exportar e preparar um registro para o acervo. O público consulta somente material publicado. Login visual aprovado em 08/11/2026; autenticação, permissões, processamento e persistência ainda não estão integrados.

Usuário autorizou a primeira amostra em 08/11/2026. A prévia estática foi substituída por mapa navegável, contextos, inspetor e acompanhamento demonstrativo. A rodada seguinte acrescentou gerenciador de resultados e seleção da malha real do IBGE; o estado atual está na seção Camadas e território abaixo. O protótipo permanece preservado, sem migração automática de código DOM para React.

## Levantamento atual do protótipo

Inspeção de `prototipo-01/frontend/index.html` e módulos `js/points.js`, `app.js`, `layers.js`, `analysis.js` e `street-inputs.js`:

| Tarefa existente | Destino proposto |
|---|---|
| Recortes, enquadramento, setores por código/clique/retângulo/desenho livre, adicionar/remover setores e áreas locais | Painel **Área**; barra contextual de seleção territorial |
| Perfil de análise, corte de score, andamento e retomada do acompanhamento | Painel **Análise**; resumo da área e configurações avançadas recolhíveis |
| Selecionar, adicionar, mover, seleção retangular, apagar, desfazer/refazer e lista de pontos | Painel **Revisão** e barra compacta de edição no mapa |
| Pontos/copas vinculados do modelo v2 | Revisão contextual; preservar as restrições do protótipo para adicionar/mover e a exclusão do par |
| Diagnóstico de ruas próximas, distância de comparação, filtros, busca e detalhes de trecho | Modo **Diagnóstico de ruas**, dentro de Revisão, com retorno explícito à edição de pontos |
| Camadas, GeoJSON, visibilidade de pontos/copas/densidade | Painel **Camadas** com lista agrupada e importação/exportação |

O levantamento é estático: não comprova resultados de IA, qualidade de segmentação ou funcionamento ponta a ponta. O score não será apresentado como probabilidade de acerto.

## Composição aprovada para a amostra

- Mapa em toda a tela, navegação compacta com saída para Administração, Acervo e Início.
- Lateral esquerda flutuante recolhível com **Área / Análise / Revisão / Camadas**, combinada com um inspetor de propriedades à direita, aberto ao selecionar um exemplo. No celular, somente um painel por vez.
- Barra compacta de ferramentas com rótulos/atalhos, ferramenta ativa visível e ações habilitadas conforme o tipo de camada e seleção. Barra muda entre seleção territorial e edição de pontos, sem exibir todas as ferramentas ao mesmo tempo.
- Bases cartográficas separadas das visualizações de dados, como no mapa público. Copas e contornos no controle de Camadas; pontos e densidade no de Visualização.
- Área ativa, camada ativa, quantidade selecionada e alterações locais visíveis. Salvar registro e exportar separados; publicar fica no acervo.
- Durante análise, modal central com camada escurecida, bloqueando o mapa, as duas laterais, navegação, barra e atalhos. Foco permanece no acompanhamento; Escape não fecha durante execução. Há interrupção explícita da demonstração local, sem promessa de cancelamento de processamento remoto.
- No celular, um painel por vez; ferramentas com toque e rótulos legíveis. Vidro mais opaco nas configurações, textos compactos, sem decoração sobre a área de dados. Herdar verdes/Manrope/Mel, foco único e movimento reduzido.

A composição híbrida foi escolhida pelo usuário, com referência a editores técnicos e barra flutuante central inferior com vidro.

## O que funciona nesta amostra

- Rota em toda a tela e sob demanda. Reutilização do componente `MapCanvas`, das bases reais e dos exemplos fictícios do mapa público, sem importar sua página inteira. Enquadramento considera o espaço das duas laterais.
- Troca de contextos e recortes; grupos paginados de exemplos; seleção pelo mapa ou lista; inspetor com origem, coordenadas e prioridade ilustrativa quando aplicável. Não há score nem copa inventados para os exemplos.
- Laterais recolhíveis com recuperação de foco e Escape; um painel por vez em largura móvel. Barra muda por contexto. Seleção funciona; ações de edição, território, arquivos e histórico estão indisponíveis e identificadas como próximas etapas.
- Visibilidade de pontos/trechos/limites, base aérea/ruas e densidade relativa. Ocultar a camada de um item selecionado limpa a seleção.
- Demonstração de análise com conferência inicial, preparação, análise, organização, conclusão e erro. Etapas por temporizador local: 2s + 6s + 2s; falha simulada após a análise. Tempo decorrido real da simulação; sem porcentagem ou previsão inventadas.
- Dialog nativo modal com backdrop, foco na etapa atual, bloqueio do restante da página e animação moderada. “Interromper demonstração” desmonta o acompanhamento e limpa seus temporizadores. Na conclusão, “Revisar exemplos” abre os mesmos exemplos já disponíveis. A repetição do cenário de erro pode seguir para sucesso, explicitamente como teste da interface.
- Preferência por movimento reduzido respeitada no mapa e nas animações do acompanhamento. Sem dependências novas.

## Limites e próximas rodadas

A seleção não confirma árvores. Os pontos, traçados e prioridades são fictícios. As figuras cartográficas são recortes do protótipo, não setores oficiais. A demonstração não produz novas detecções, não envia imagens, não salva no acervo e não publica. Não há autenticação nem proteção real das rotas.

1. Validar composição, proporções, barra contextual, propriedades e estados do acompanhamento.
2. Implementar edição local de pontos e histórico, seguida da seleção territorial e dos fluxos GeoJSON.
3. Trazer copas vinculadas e diagnóstico por ruas preservando as restrições do protótipo.
4. Definir contrato e integrar IA, persistência, usuários internos e salvamento de registros no acervo. Regras efetivas de publicação ficam no fluxo aprovado.

Não foi implementado cancelamento remoto: o botão interrompe apenas a demonstração local. Configurações avançadas descrevem o que será integrado, sem escolher modelo ou valores de corte sem validação.


## Verificação da primeira amostra — 08/11/2026

- Lint e build com TypeScript estrito aprovados; `git diff --check` conferido.
- Chromium desktop 1280 × 720: contextos, seleção pelo mapa/lista, inspetor, recolhimento, densidade e recortes conferidos.
- Acompanhamento: conferência, etapas automáticas, conclusão e abertura da revisão, erro simulado, repetição iniciada e interrompida. Preservação da seleção anterior conferida.
- Dialog nativo modal: foco na etapa atual e dentro do modal por Tab; Escape não encerra execução; a camada de fundo intercepta interação fora do painel. Interromper devolve foco ao acionador e fecha o acompanhamento.
- Viewport 375 × 812: um painel por vez, inspetor, acompanhamento e retorno conferidos; sem transbordamento horizontal no percurso examinado. Viewport restaurado.
- Ajustado o redimensionamento do canvas compartilhado para ignorar dimensões transitórias iguais a zero. Densidade ativa, ida/volta ao viewport móvel e troca de recorte repetidas sem novos erros nesse percurso.
- Seleção e detalhes no mapa público conferidos após a alteração do componente compartilhado.
- Capturas em `output/site-react-editor` na pasta de trabalho Sematec, incluindo revisão desktop, acompanhamento e vistas móveis.

Não houve teste de processamento real, cancelamento remoto, servidor, persistência, edição, arquivos, publicação, grande volume, aparelhos físicos ou auditoria completa de acessibilidade. Animações reduzidas estão contempladas no CSS/hook existente, sem emulação específica adicional nesta rodada.


## Revisão de prioridade — camadas e IBGE

O usuário esclareceu que a coleção de camadas é o centro da área de trabalho e que a seleção por setores censitários do IBGE Censo 2022 é essencial. A amostra inicial não cobria esses requisitos. O mapa administrativo usa somente a composição compacta com painéis flutuantes; a opção de modo detalhado foi removida após avaliação. O gerenciador de camadas e a seleção territorial foram implementados conforme o levantamento em [Camadas e território](LEVANTAMENTO_CAMADAS_E_TERRITORIO.md).


## Camadas e território — entrega de 08/11/2026

- Gerenciador próprio com busca por nome/execução/categoria, filtro Todas/Visíveis/Ocultas, agrupamento por ID de execução, paginação de cinco camadas e controles separados para ativação e visibilidade. Seis camadas fictícias demonstram famílias da mesma execução, importação, comparação e resultado vazio.
- Múltiplas camadas visíveis simultaneamente, pontos e contornos coloridos por camada. Selecionar um ponto identifica sua camada de origem. Somar marcações sobrepostas não equivale a contar árvores únicas.
- Camada ativa pode estar oculta. Preferência de enquadramento ao ativar, enquadramento manual por camada e de todas as visíveis. Resultados vazios mantêm geometria de referência.
- Inspetor Camada/Seleção com execução, origem, categoria, visibilidade, marcações totais e dentro do retângulo, e área esférica aproximada do retângulo em ha/m²/km². Não confundir com copas ou união territorial. Camadas fictícias não recebem vínculo inventado com setores selecionados na sessão.
- Composição compacta única, com painéis flutuantes recolhíveis. A camada ativa, visibilidade, filtros do gerenciador e seleção territorial permanecem na memória durante a sessão. Recarregar a página reinicia os exemplos; não há persistência ou registro no acervo.
- Malha estática real de 499 setores urbanos do Censo 2022: carregamento sob demanda, validação e erro com nova tentativa, busca por código, lista paginada, clique no mapa, todos/inverter/limpar, enquadramento da seleção ou malha completa. Cores distinguem selecionados. A soma de `AREA_KM2` é identificada como área declarada pelo IBGE.
- Barra de Área alterna Navegar/Setores. Enquanto seleciona setores, pontos e trechos de resultados não interceptam cliques nem teclado. Fora desse contexto, os polígonos ficam apenas em visualização. Ocultar a malha conserva a seleção.
- Sem bibliotecas ou backend novos. Reaproveitados Leaflet/React Leaflet e o arquivo territorial do protótipo, preservado por hash; procedência em `app/frontend/public/data/README.md`.

### Verificações desta rodada

Lint/build com TypeScript estrito aprovados. Dez verificações diretas do leitor territorial, incluindo a malha real e rejeição de entradas inválidas. Cópia do GeoJSON idêntica ao original e disponível no build.

No Chromium: separação entre ativa e visível, múltipla exibição e cores, camada vazia, busca sem resultados, paginação, alternância de modos sem perda da seleção, 499 setores carregados, seleção por código/clique, todos/inverter e soma declarada conferidos. Viewport móvel 375 × 812: um painel por vez e largura sem transbordamento nos percursos examinados. Capturas em `output/site-react-camadas-ibge` na pasta Sematec.

Não houve teste de desempenho com milhares de resultados, aparelho físico, auditoria completa de acessibilidade, falha de rede induzida para a malha ou processamento real. Nenhuma alteração de publicação ou catálogo do mapa público nesta rodada.

### Próximas validações

Validar o gerenciador, os modos e a seleção territorial antes de desenho/interseção/união geométrica, edição/histórico e arquivos locais. A organização dos resultados publicados no mapa público e o vínculo com o acervo continuam na sequência do plano. A API de IA, persistência, autenticação e publicação efetiva continuam pendentes.
