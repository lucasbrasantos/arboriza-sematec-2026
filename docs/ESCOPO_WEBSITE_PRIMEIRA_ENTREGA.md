# Arboriza — escopo funcional da primeira entrega do website

Data do levantamento: 05/11/2026. Prazo informado: até segunda-feira, 09/11/2026.

Este documento consolida as decisões da conversa de definição do produto. Descreve funcionalidades pretendidas, sem atestar que já estejam implementadas ou que o detector tenha qualidade validada. O trabalho atual é de levantamento; os wireframes ainda não foram desenhados.

## 1. Objetivo e públicos

O Arboriza deverá mapear possíveis árvores, permitir sua revisão e diagnosticar ruas ou trechos pouco arborizados, apoiando a priorização de sua avaliação.

O website atenderá cidadãos e equipes técnicas. A consulta será pública, enquanto a edição, a análise, a revisão e a publicação da base ficarão restritas à equipe.

A primeira entrega terá uma área piloto delimitada em Araçatuba/SP. A visão de expansão é cobrir toda a cidade, com organização e consulta por bairros e regiões. Navegar pelo mapa não significará que todos os locais já tenham diagnóstico disponível.

## 2. Decisões funcionais acordadas

| Tema | Definição da primeira entrega |
|---|---|
| Resultado principal | Mapear e diagnosticar trechos pouco arborizados para apoiar sua priorização. |
| Abrangência | Área piloto delimitada; expansão posterior para toda Araçatuba. |
| Consulta pública | Mapa e diagnóstico disponíveis no próprio website. |
| Edição | Restrita à equipe, em uma área administrativa com autenticação. |
| Entrada dos resultados | Executar a análise de imagem pelo site e também importar resultados já processados. |
| Revisão | A equipe revisa as marcações antes de publicar os resultados. |
| Prioridade dos trechos | O sistema sugere uma classificação por critérios definidos; a equipe revisa e pode ajustar antes da publicação. |
| Regra 3-30-300 | Conteúdo educativo e referência de planejamento, sem cálculo de seus componentes nesta entrega. |
| Exportação | A equipe pode exportar os dados geográficos. |
| Resumo para o público | Consulta online; relatório para download ou impressão fica fora desta entrega. |
| Wireframes | Três telas: Início, Mapa público com diagnóstico e Administração. |

## 3. Fluxos principais

### Consulta pública

Abrir o site → conhecer a proposta → explorar o mapa → selecionar uma área ou trecho com dados publicados → consultar o diagnóstico e a prioridade de avaliação.

### Trabalho da equipe

Entrar na administração → selecionar a área piloto → executar uma análise ou importar um resultado → revisar e corrigir as marcações → gerar a classificação inicial dos trechos → revisar e ajustar as prioridades → salvar e publicar → disponibilizar o resultado na consulta pública.

As duas formas de entrada devem convergir para o mesmo fluxo de revisão e publicação. O resultado de uma análise não deve substituir automaticamente a base já publicada.

## 4. Briefing das três telas do wireframe

Os elementos abaixo são a proposta inicial de organização das telas, a detalhar na etapa de wireframe. As três telas representam os usos principais; páginas de apoio, como login, também fazem parte do website.

### Tela 1 — Início

- Apresentação curta do Arboriza e do problema de arborização urbana.
- Explicação resumida do funcionamento: analisar, revisar, diagnosticar e consultar.
- Ação principal: “Explorar mapa”.
- Seção educativa sobre a regra 3-30-300 e sua relação com o projeto.
- Indicação da área piloto e da visão de expansão.
- Acesso à área da equipe e referências do projeto.

### Tela 2 — Mapa público com diagnóstico

- Mapa como elemento principal, com identificação da área atendida.
- Camadas dos pontos publicados e das prioridades dos trechos, com legenda.
- Seleção de área ou trecho para abrir um painel de diagnóstico.
- Painel com identificação do trecho, indicadores disponíveis, prioridade revisada, explicação dos critérios, fontes e atualização dos dados.
- Identificação clara dos locais sem análise publicada.
- Sugestões de navegação: busca por localização e filtros pelos recortes atendidos.
- Se houver camada de densidade, identificá-la como concentração de pontos.

### Tela 3 — Administração

- Tela representada com a equipe já autenticada.
- Seleção da área e acesso às análises disponíveis.
- Ações de executar análise e importar resultados.
- Mapa com ferramentas de seleção, adição, movimentação, exclusão e revisão dos pontos, aproveitando o protótipo atual.
- Visualização das prioridades sugeridas e possibilidade de ajuste pela equipe.
- Ações de salvar, exportar dados e publicar.
- Feedback de processamento, conclusão e falha, preservando o trabalho existente.

## 5. Requisitos necessários para sustentar o fluxo

- Autenticação da equipe e proteção das operações administrativas também no servidor.
- Persistência dos dados e separação entre trabalho em revisão e resultado publicado.
- Registro da origem dos resultados, área analisada, fonte da imagem e atualização da publicação.
- Consulta pública aos resultados publicados, sem necessidade de login.
- Estados de carregamento, análise em andamento, resultado vazio, erro e área sem diagnóstico.
- Interface pública utilizável em celular e computador; revisão técnica organizada prioritariamente para computador.
- Legendas e rótulos que não dependam apenas de cores.

Esses requisitos decorrem do fluxo proposto e devem ser detalhados no backlog. A stack e a infraestrutura definitivas não foram escolhidas nesta conversa.

## 6. Limites da primeira entrega

- A cobertura de toda a cidade pertence à expansão, e não ao recorte inicial.
- Cidadãos não editarão a base nem enviarão contribuições nesta versão.
- Não haverá avaliação automática de atendimento à regra 3-30-300.
- Elaboração de propostas de plantio e indicação de espécies não fazem parte do fluxo escolhido.
- Não haverá relatório público para download ou impressão.

Os pontos automáticos representam possíveis árvores e precisam de revisão. Quantidade de pontos ou densidade não equivale a porcentagem de cobertura de copas. A prioridade publicada será uma indicação para avaliação dos trechos, com critérios declarados.

## 7. Pendências antes de detalhar a implementação

1. Delimitar exatamente a área piloto e confirmar a disponibilidade das imagens e dos dados das ruas.
2. Avaliar a qualidade do detector nos recortes usados, incluindo omissões, duplicações e objetos classificados incorretamente.
3. Definir como associar os pontos revisados às ruas e dividir as ruas em trechos. A posição aproximada de uma copa não comprova, por si só, que a árvore esteja em uma calçada pública.
4. Definir os indicadores, os limites das classes de prioridade e o tratamento de áreas com dados incompletos. Medidas como pontos revisados por extensão de trecho podem ser investigadas, sem tratá-las como cobertura de copas ou como regra já validada.
5. Detalhar o salvamento, a revisão e a publicação da base, incluindo o formato dos arquivos importados e exportados; GeoJSON é a proposta inicial, alinhada ao protótipo existente.
6. Definir onde a análise de imagem será executada e como a equipe acessará o website publicado. A execução local na GPU não comprova disponibilidade como serviço web.
7. Confirmar a distribuição do trabalho na equipe; a quantidade de implementadores não foi informada neste levantamento.

## 8. Critérios de demonstração da primeira entrega

- Uma pessoa consegue abrir o site, chegar ao mapa e consultar um diagnóstico real publicado da área piloto.
- Uma pessoa autenticada da equipe consegue executar uma análise e importar um resultado externo, revisando os dados de ambas as origens.
- A equipe consegue obter uma sugestão de prioridade, revisá-la e publicar o resultado.
- A consulta pública reflete a publicação, e o trabalho permanece salvo após reabrir a aplicação.
- A equipe consegue exportar os dados geográficos.
- O site explica a regra 3-30-300, os critérios utilizados e os limites do diagnóstico.

## 9. Contexto técnico existente

Consultar o [resumo de decisões da fase 2](RESUMO_DECISOES_ESCOPO_FASE_2.md), o [guia do protótipo](../prototipo-01/README.md) e o [relatório do experimento](../prototipo-01/docs/EXPERIMENTO.md) para distinguir a implementação atual deste escopo pretendido. As decisões desta conversa ampliam o produto desejado; não registram conclusão automática das integrações, da administração ou do diagnóstico por trechos.
