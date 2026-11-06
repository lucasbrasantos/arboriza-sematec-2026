# Arboriza — resumo de decisões, escopo e evolução do projeto

**Atualizado em:** 05/11/2026.\
**Finalidade:** reunir o contexto necessário para a equipe preparar e atualizar os documentos da fase 2 acadêmica, especialmente fluxo do usuário, wireframes, arquitetura, justificativa da stack e backlog.\
**Estado atual:** interface do Protótipo 01 aprovada pelo responsável pelo projeto; experimento Python executado; resultados de identificação aguardando revisão. A API do Protótipo 01 ainda não foi implementada.

> A fase 2 acadêmica, de design e arquitetura, é diferente da segunda entrega técnica do protótipo, que será a integração com FastAPI. Este documento registra decisões e evidências; não significa que todas as funcionalidades descritas já estejam prontas.

## 1. Projeto, problema e proposta

O **Arboriza** é um projeto da SEMATEC / Ideathon FATEC 2026, no tema **Mobilidade Urbana e Sustentabilidade**, com foco inicial em **Araçatuba/SP**.

O problema central é a dificuldade de localizar e priorizar trechos urbanos pouco arborizados, especialmente ruas, calçadas e espaços de circulação de pedestres. A proposta é organizar informações geográficas para apoiar o planejamento da arborização e a avaliação de oportunidades de plantio.

O público inicial previsto nos materiais do projeto são equipes municipais de meio ambiente, planejamento urbano e mobilidade. Os beneficiários esperados são moradores, pedestres e usuários do transporte coletivo. As necessidades específicas dessas equipes e o uso institucional ainda precisam de validação com pessoas desse público; não há implantação ou parceria municipal confirmada neste resumo.

### Frentes do produto pretendido

| Frente | Comportamento pretendido | Situação atual |
|---|---|---|
| Mapear a arborização | Localizar possíveis árvores em um mapa, registrando suas posições e a origem dos dados. | Marcação manual pronta; detecção automática em experimento local. |
| Entender a distribuição | Visualizar concentração de pontos e, futuramente, relacionar a arborização às ruas e aos trechos deficitários. | Densidade de pontos pronta; análise da malha viária ainda futura. |
| Apoiar a priorização | Organizar diagnósticos e propostas preliminares para avaliação municipal. | Visão de produto; priorização, cenários de plantio e relatório por trecho ainda não implementados. |

As propostas de plantio, quando desenvolvidas, serão preliminares e dependerão de avaliação técnica e vistoria. O sistema não foi definido como substituto da decisão das equipes responsáveis.

## 2. Principal mudança de direção

A investigação começou com **segmentação de imagens**, procurando traçar os contornos das copas. Depois dos testes, foi esclarecido que o objetivo principal do sistema não exige o contorno exato de cada árvore.

A direção atual prioriza:

- Identificar possíveis árvores e registrar sua posição aproximada.
- Representar cada detecção como um ponto ou “bolinha” no mapa.
- Permitir revisão e correção manual desses pontos.
- Visualizar sua distribuição e concentração.
- Futuramente relacionar os resultados com ruas e indicadores de arborização.

Uma detecção deverá poder ser representada por um ponto mesmo sem produzir um polígono detalhado da copa. Isso reduz o foco em edição de contornos, sem eliminar a necessidade futura de estimar cobertura quando o indicador exigir área.

**Árvore, arbusto, gramado e região verde não são a mesma classe.** O usuário demonstrou interesse mais amplo em reconhecer vegetação, mas decidiu que o primeiro experimento do Protótipo 01 terá como saída **pontos de possíveis árvores**. A classificação das outras classes não foi incluída nessa primeira entrega.

## 3. Relação com a regra 3-30-300

A regra 3-30-300 foi mencionada como referência para a evolução do diagnóstico urbano:

- **3:** visibilidade de pelo menos três árvores bem estabelecidas a partir de locais como moradia, trabalho ou estudo.
- **30:** pelo menos 30% de cobertura de copas no bairro.
- **300:** acesso a uma área verde pública de qualidade a uma distância de até 300 metros.

Ela é uma referência de planejamento citada no projeto, não um cálculo já entregue. A definição e seus fundamentos podem ser consultados no [artigo de Konijnendijk](https://doi.org/10.1007/s11676-022-01523-z).

Para o Arboriza, as implicações são:

| Componente | O que será necessário estudar | Limite do protótipo atual |
|---|---|---|
| Visibilidade de árvores | Pontos de observação e uma forma de avaliar a visibilidade efetiva. | Um ponto próximo de uma residência não comprova que a árvore seja visível de uma janela. |
| Cobertura de copas | Áreas ocupadas pelas copas e delimitação da unidade territorial avaliada. | Quantidade de pontos e mapa de densidade não calculam porcentagem de cobertura. |
| Acesso a áreas verdes | Cadastro das áreas verdes e critérios de acesso/distância, incluindo a possibilidade de analisar rotas pela rede viária. | Não basta procurar a árvore mais próxima; essa análise ainda não existe. |

O método operacional de avaliação dos três componentes ainda será definido. A relação entre ruas, árvores e áreas verdes é uma evolução pretendida, não uma comprovação atual de atendimento à regra.

## 4. Caminho percorrido e decisões tomadas

| Passo | Decisão ou aprendizado |
|---|---|
| Organização inicial | Inicializar o repositório Arboriza, criar `docs/` e manter o README inicial simples, explicando descrição, problema e solução. |
| Pesquisa da stack | Considerar aplicação web, React, Python/FastAPI e alternativas com .NET. A preferência posterior foi usar Python para a análise e a proposta de API. |
| Laboratório de segmentação | Usar os repositórios de frontend e backend de um amigo, com autorização dele, como base de um laboratório separado para reprodução e aprendizado. |
| Teste manual com HQ-SAM | Confirmar que o fluxo conseguia segmentar regiões úteis, mas observar falhas com objetos pequenos, cliques e refinamento. |
| HQ-SAM automático | Experimentar geração automática de máscaras e seleção de candidatas por cor. Aprender que segmentar uma região não significa classificá-la como árvore. |
| Usabilidade do laboratório | Trabalhar seleção de regiões automáticas, desenho livre, redução de vértices e preservação de prévias, sem substituir o estilo da toolbar restaurado pelo usuário. |
| Reavaliação do objetivo | Priorizar a identificação e posição das árvores em vez do tracejado exato de cada copa. |
| Escolha do mapa do novo protótipo | Não integrar Google Maps nesta versão; adotar Leaflet, ruas do OpenStreetMap e ortofotos do IGC/DataGEO. |
| Protótipo 01 | Construir primeiro uma interface simples em HTML, CSS e JavaScript; integrar Python depois, mediante validação. |
| Validação da interface | Aprovar o mapa e aprimorar ferramentas de pontos com comportamentos familiares de programas de edição. |
| Separação das entregas Python | Testar o modelo por comando e importar GeoJSONs primeiro; adicionar API e botão somente após a avaliação dos resultados. |
| DeepForest | Testar o modelo pronto de copas nos dois recortes atuais, sem assumir que seria superior ao HQ-SAM para todos os casos. |
| Referência manual | Usar os 68 pontos fornecidos pelo usuário como comparação exploratória, pois a marcação também inclui arbustos e outros verdes. |
| Ponto de parada atual | Aguardar a revisão dos arquivos pelo usuário antes de melhorar o experimento ou integrar a API. |

## 5. Laboratório HQ-SAM: o que foi investigado

O laboratório `segmentacao-teste` é separado do Protótipo 01 e serve como histórico técnico. Ele foi baseado nos projetos [SegmentacaoFront](https://github.com/ThiagoBaso/SegmentacaoFront) e [SegmentacaoBack](https://github.com/ThiagoBaso/SegmentacaoBack), de ThiagoBaso, com autorização para clonagem e testes informada pelo usuário.

A base utiliza React, FastAPI, GeoTIFF, GeoJSON e HQ-SAM ViT-H. Foram investigados modos manual e automático de segmentação, isolamento de imagens por sessão, processamento sequencial na GPU e exportação geográfica.

Entre os ajustes do laboratório estão a remoção de um corte manual fixo de 2.000 pixels, que eliminava regiões pequenas, e correções para não acumular cliques de tentativas rejeitadas. Também foram trabalhadas cópia de região automática para prévia editável, desenho por vértices, simplificação do contorno e preservação da seleção ao trocar de ferramenta. Parte da validação posterior de usabilidade utilizou preditor simulado e ainda exigia teste interativo com o modelo real; não se deve registrar todos esses comportamentos como integralmente validados em campo.

O fluxo automático experimentou, entre outros parâmetros, área mínima de 2 m² e filtro HSV por proporção de verde. Esses valores pertencem ao laboratório de máscaras e **não são regras do detector DeepForest**.

Aprendizados relevantes:

- O HQ-SAM pode segmentar uma copa sem saber que ela representa uma árvore.
- Filtros de verde podem excluir copas escuras ou de outras cores e incluir objetos artificiais verdes.
- Aumentar a quantidade de amostras pode gerar mais regiões e mais trabalho de revisão, sem comprovar maior qualidade.
- Contar máscaras não equivale necessariamente a contar árvores individuais.
- A precisão geométrica do contorno passou a ser uma prioridade menor que a identificação e localização úteis.

Foram discutidos ajustes de contraste, levels e saturação, comparação de filtros, SAM 3 e combinação de um detector com HQ-SAM. **Essas discussões não significam que as alternativas tenham sido instaladas, comparadas e aprovadas.** A sequência antiga de preparação de imagens e segundo modelo foi redirecionada para o novo protótipo de pontos. O DeepForest foi testado isoladamente; não foi implementado um pipeline DeepForest → HQ-SAM.

## 6. Stack e arquitetura escolhidas para o Protótipo 01

| Parte | Escolha | Justificativa e situação |
|---|---|---|
| Interface | HTML, CSS e JavaScript nativos | Reduzir dependências e tempo de construção de um protótipo. Implementado, sem etapa de build. |
| Mapa | Leaflet | Navegação e composição de camadas no navegador. Implementado. |
| Ruas | OpenStreetMap | Fundo cartográfico para orientação. Implementado. |
| Imagem aérea | WMS IGC/DataGEO, levantamento 2023/2024 | Fonte pública usada nos recortes e na visualização. Implementado. |
| Densidade | Leaflet.heat | Visualização de concentração de pontos. Implementado. |
| Análise | Python 3.12 | Usar o ecossistema de visão computacional e geoprocessamento. Experimento implementado. |
| Modelo atual | DeepForest 2.1.0, pesos `weecology/deepforest-tree` | Testar detecção de copas e conversão para pontos. Qualidade ainda em avaliação. |
| Execução de IA | PyTorch com CUDA | Processamento local na RTX 5070. Validado nos experimentos executados. |
| Dados raster | Rasterio e metadados do GeoTIFF | Preservar a relação entre imagem, pixels e posições geográficas. Implementado. |
| Intercâmbio | GeoJSON, pontos em WGS84 | Importar, editar e exportar camadas no mapa. Implementado. |
| API futura | FastAPI | Conectar o mesmo processamento Python à interface. Planejado; ainda não implementado no Protótipo 01. |

React foi utilizado no laboratório anterior e cogitado para o produto; **não é a tecnologia da interface atual**. .NET foi considerado, mas não adotado neste experimento. A arquitetura de produção do sistema definitivo não foi fechada por este protótipo.

### Organização do código

O pedido foi manter código pequeno, organizado e com responsabilidades claras, aplicando os princípios de separação sem criar uma estrutura extensa de Clean Architecture.

- Interface: arquivos estáticos, módulo do mapa e estado/edição dos pontos.
- Detector: preparação dos pesos, validação CUDA e chamada ao DeepForest.
- Análise: leitura da imagem, conversão geográfica, diagnósticos e comando do experimento.
- API futura: receber pedidos e chamar a mesma análise, sem duplicar a lógica.

Não foram adotados banco de dados, microsserviços, filas externas, infraestrutura de nuvem ou classes genéricas de repositório. O ambiente Python do protótipo é independente do ambiente do laboratório HQ-SAM.

## 7. Fontes de imagem, coordenadas e desempenho do mapa

Os dois recortes iniciais são **Centro** e **Centro-norte**, em Araçatuba. Os GeoTIFFs RGB8 preparados para os testes têm 1066 × 980 pixels e CRS EPSG:4326. Foram produzidos a partir de imagens renderizadas pelo WMS IGC/DataGEO, com metadados de procedência preservados.

O catálogo informa levantamento 2023/2024 e resolução declarada de 25 cm. A data exata da tomada de cada imagem não foi confirmada. A data do download não deve ser apresentada como data da fotografia. Os arquivos de teste não são os rasters originais do aerolevantamento.

Decisões sobre os dados:

- Usar os dois recortes locais primeiro, para comparar os modelos com entradas reproduzíveis.
- Não usar captura de tela do navegador ou os JPEGs leves da interface como entrada do experimento Python.
- Converter o centro das caixas de detecção para longitude/latitude usando o georreferenciamento do raster.
- Considerar NoData e limites da imagem, sem gerar pontos em pixels inválidos.
- Registrar origem, hash da imagem, parâmetros, revisão dos pesos e versões do ambiente.
- Manter imagens grandes, pesos, ambientes virtuais e resultados gerados fora do Git.

Para reduzir o branco durante zoom e navegação, foram adicionadas prévias JPEG locais leves da mesma fonte, sob os blocos detalhados. O WMS utiliza blocos de 512 pixels e um limite configurado de detalhe de nível 19; acima desse nível o mapa amplia a imagem existente. As prévias cobrem a região preparada para o teste, não todas as áreas para as quais o usuário possa navegar.

Isso melhora a continuidade visual, mas não garante carregamento instantâneo dos detalhes. A velocidade e disponibilidade do mapa ainda dependem dos serviços externos. Não foi implementado download em lote nem cache persistente de blocos do mapa.

As imagens atuais são RGB; o experimento não dispõe de banda de infravermelho e não calcula NDVI real.

## 8. Interface aprovada e ferramentas disponíveis

A interface do Protótipo 01 foi construída e refinada com validações do usuário. Sua aprovação mais recente confirmou o mapa, a barra inferior compacta, a lista de pontos e os painéis com transparência moderada.

### Mapa e camadas

- Navegação e zoom, com alternância entre ruas e imagem aérea.
- Seleção de Centro, Centro-norte ou enquadramento atual como área de estudo.
- Contagem dos pontos dentro da área, separada do total da camada.
- Alternância entre pontos e mapa de densidade.
- Importação de múltiplos GeoJSONs, cada um como uma camada separada.
- Exportação da camada inteira em exibição.

### Edição dos pontos

- Adicionar pontos por clique e selecionar por clique ou retângulo.
- Combinar seleções usando Ctrl/Shift.
- Mover grupos e usar uma ferramenta Mover para iniciar o arraste fora dos pontos.
- Selecionar todos, inverter ou limpar a seleção e apagar em grupo.
- Lista do mais recente para o mais antigo, com seleção individual e localização no mapa.
- Desfazer e refazer até 50 ações por camada durante a sessão; um movimento ou exclusão em grupo conta como uma ação.
- Atalhos visíveis nos botões: V selecionar, M mover, P adicionar, B retângulo, L lista, Delete apagar, Ctrl+Z desfazer, Ctrl+Y refazer; Ctrl+A seleciona todos e Esc volta à seleção e limpa a seleção atual.

### Apresentação e persistência

- Temas claro e escuro e alternância entre painel lateral e painel flutuante.
- Aparência de vidro fosco, com barra e lista compactas para liberar área do mapa.
- Preferências de tema/painel e pontos manuais salvos no navegador.
- Camadas importadas e seu histórico ficam em memória; é necessário exportar as alterações para preservá-las fora da sessão.

A densidade representa concentração de pontos. Ela não é uma medição de temperatura, cobertura de copas, número validado de árvores ou cumprimento da regra 3-30-300. Editar um ponto não o transforma automaticamente em uma árvore validada.

## 9. Experimento Python realizado

### Divisão aprovada

1. **Entrega 1:** executar o modelo por comando, salvar diagnósticos e importar os GeoJSONs na interface existente.
2. **Entrega 2:** integrar um botão de análise à API, somente após a revisão e autorização do usuário.

A entrega 1 foi executada. A entrega 2 não foi iniciada.

### Configuração e rastreabilidade

- DeepForest 2.1.0, PyTorch 2.10.0+cu128 e Python 3.12.
- Pesos oficiais, com revisão exata e hashes registrados.
- RTX 5070 com aproximadamente 12 GB de VRAM.
- Uma instância do modelo por execução, com processamento sequencial.
- Comparação de janelas 400 e 800 pixels, sobreposição de 25%, lote de uma janela e zero trabalhadores de carregamento no Windows.
- Deduplicação nativa da biblioteca, sem filtro obrigatório de verde, sem realce artificial e sem HQ-SAM nesse fluxo.
- Confiança mínima inicial de 0,50, ajustável pelo comando; o piso interno de propostas arquivadas é 0,10.
- Preparação inicial dos pesos com internet; análise posterior com os pesos locais.
- Ausência de CUDA interrompe o experimento; não há troca automática para CPU.

Cada execução gera GeoJSON de candidatos, PNG de diagnóstico e JSON com parâmetros, caixas, scores, descartes, origem, tempos e memória. Os pontos representam centros aproximados de possíveis copas, não troncos.

### Resultados iniciais em 0,50

| Recorte | Janela | Caixas após deduplicação, score ≥ 0,10 | Candidatos em score ≥ 0,50 |
|---|---:|---:|---:|
| Centro | 400 | 85 | 3 |
| Centro | 800 | 8 | 0 |
| Centro-norte | 400 | 36 | 1 |
| Centro-norte | 800 | 6 | 0 |

As quatro combinações executaram na GPU. As inferências variaram aproximadamente de 0,29 a 1,09 segundo, além da carga inicial de cerca de 35 segundos. O pico de memória alocada pelo PyTorch ficou em torno de 304–310 MiB. São registros dessas execuções, não uma garantia de desempenho para outras áreas ou um benchmark controlado; a primeira inferência inclui custos de inicialização e a medição não representa toda a VRAM ocupada pelo sistema.

O funcionamento técnico foi demonstrado. A qualidade de identificação ficou incompleta: várias copas visíveis não receberam pontos, inclusive um conjunto escuro grande no Centro. Os resultados vazios em 800 não são falhas de exportação; são ausência de candidatos acima do limiar utilizado.

## 10. Comparação com os pontos manuais

O usuário disponibilizou o arquivo `arboriza-pontos_CENTRO_.geojson`, que contém **68 pontos**. A marcação é ampla e inclui o que ele considerou árvore, verde ou arbusto. Portanto, ela serve como referência exploratória, não como um inventário validado de árvores individuais.

A partir dessa referência foi feita uma análise adicional do Centro, com janela 400 e score mínimo **0,15**, resultando em **58 candidatos**. A bateria original em 0,50 foi preservada.

| Score mínimo no Centro, janela 400 | Candidatos |
|---|---:|
| 0,10 | 85 |
| 0,15 | 58 |
| 0,20 | 37 |
| 0,30 | 17 |
| 0,50 | 3 |

Os cortes 0,10, 0,20 e 0,30 desta tabela foram contados sobre as propostas já arquivadas. Houve execução adicional específica em 0,15. **Score não é uma porcentagem comprovada de acerto**, e aproximar a quantidade de 68 não é suficiente para escolher o limiar.

Também foi comparada a proximidade entre os dois conjuntos, em uma projeção métrica local, com associação um-a-um:

| Distância máxima | Pares próximos | Pontos manuais sem par | Automáticos sem par |
|---|---:|---:|---:|
| 2 m | 17 | 51 | 41 |
| 3 m | 26 | 42 | 32 |
| 5 m | 32 | 36 | 26 |

Essas associações não são precisão, recall ou uma classificação automática de acertos e erros. A referência é mista, não revisada, e o clique manual pode ficar afastado do centro previsto de uma copa.

A imagem comparativa usa amarelo para os pontos manuais e azul para os automáticos. Foram observadas copas omitidas e marcações automáticas sobre alguns telhados. A variante 0,15 está disponível para avaliação, mas não foi aprovada como configuração definitiva. O arquivo manual original foi preservado.

## 11. Validação realizada e limites conhecidos

### O que tem evidência técnica

- Interface navegável e ferramentas de pontos testadas no navegador.
- Layouts conferidos em desktop e em tamanhos simulados de tablet/celular; isso não equivale a teste em aparelhos físicos.
- Histórico, seleção múltipla, movimento em grupo, importação e exportação exercitados.
- Seis testes Python cobrindo coordenadas, projeção, bordas, máscaras de validade, leitura RGB, resultado vazio e recusa de CPU quando CUDA não está disponível.
- Imagens locais conferidas por hash e equivalência RGB com o leitor usado no fluxo da biblioteca.
- Conversão de ida e volta entre pixel e coordenada verificada nos resultados.
- Importação real das cinco camadas geradas, inclusive as duas vazias, preservando as marcações manuais.

### O que ainda não foi demonstrado

- Identificação confiável de todas as árvores da área.
- Separação validada entre árvores, arbustos, gramados e outros objetos.
- Precisão, recall ou contagem de árvores baseada em referência completa e revisada.
- Generalização para outras regiões, datas e fontes de imagem.
- Processamento de cidade inteira, operação multiusuário ou serviço de produção.
- Análise completa de ruas, cobertura arbórea e regra 3-30-300.
- Uso real por equipes municipais ou aprovação de intervenções de plantio.

Imagem com mais resolução pode ajudar, mas não elimina a necessidade de avaliar o modelo e os dados. Também não está comprovado que trocar para um modelo mais novo resolverá as falhas observadas.

## 12. Próxima entrega técnica já planejada, ainda condicionada à revisão

A integração prevista utilizará **FastAPI**, reaproveitando o mesmo processamento do comando. O fluxo será escolher o recorte, informar confiança mínima, iniciar análise, acompanhar a etapa e receber uma nova camada editável.

| Interface planejada | Responsabilidade |
|---|---|
| `GET /api/recortes` | Listar os dois recortes e seus limites. |
| `POST /api/analises` | Iniciar análise de recorte/confiança e retornar identificador. |
| `GET /api/analises/{id}` | Consultar estado, etapa e resumo. |
| `GET /api/analises/{id}/geojson` | Obter os candidatos da análise concluída. |

Decisões do plano aprovado:

- Uma análise ativa por vez; solicitações simultâneas receberão resposta de ocupado.
- Estados `pendente`, `processando`, `concluida` e `erro`.
- Consulta de andamento a cada segundo, sem sobreposição e sem aplicar respostas antigas à seleção atual.
- Mapa navegável durante o processamento e resultados anteriores preservados em caso de falha.
- Nova camada por execução, sem substituir marcações manuais.
- Análise limitada aos dois recortes; o enquadramento personalizado não será automaticamente analisável nessa primeira integração.
- Um processo FastAPI servindo interface pública e API, sem expor dados internos, pesos e ambiente como arquivos estáticos.
- Resultados em disco; tarefas em memória, encerradas se o servidor reiniciar.

A janela 800 e a confiança 0,50 estavam previstas como configuração inicial da interface futura, mas os experimentos mostraram suas limitações. **Não houve aprovação de um novo padrão definitivo.** A API não será usada para esconder ou considerar resolvida a qualidade do detector.

## 13. Escopo separado por situação

| Situação | Itens |
|---|---|
| Implementado e com interface aprovada | Mapa navegável, fundos cartográficos, áreas de estudo, camadas de pontos, densidade, edição manual, histórico, importação/exportação, temas e painéis. |
| Implementado, com resultados aguardando revisão | Experimento DeepForest local, quatro combinações iniciais, variante Centro em 0,15 e comparação com a marcação manual. |
| Planejado, após avaliação do experimento | API e botão de identificação nos dois recortes, usando o mesmo processamento Python. |
| Visão futura, sem implementação nesta entrega | Novas áreas de imagem, relação com ruas, indicadores de déficit, cobertura de copas, avaliação 3-30-300, propostas preliminares e relatório por trecho. |
| Alternativas discutidas, sem decisão de integração | Preparação de imagem por contraste/saturação, SAM 3, treinamento ou ajuste fino, outros detectores e combinação detector → segmentador. |

**Fora do protótipo atual:** segmentação precisa de cada copa, classificação de espécies, identificação completa de arbustos/gramados, processamento de cidade inteira, banco de dados, infraestrutura de produção, autenticação obrigatória, recomendação técnica definitiva de plantio e validação automática da regra 3-30-300.

Os materiais iniciais também excluíam do MVP energia solar, limpeza urbana, sensores, escolha final de espécies e aprovação de plantio. Terrenos baldios apareciam como possibilidade de expansão. Não há decisão posterior de incluir esses itens no Protótipo 01.

## 14. Orientações para os documentos da fase 2 acadêmica

O roteiro do evento pede, na etapa de design e arquitetura:

1. **Fluxo do usuário** em um diagrama simples.
2. **Wireframes de pelo menos três telas.**
3. **Diagrama de arquitetura técnica**, stack e justificativa das escolhas.
4. **Backlog priorizado**, por MoSCoW ou método semelhante, com corte explícito do que não será feito.

### Como refletir as decisões nesses documentos

- **Fluxo atual:** abrir mapa → escolher fundo e área → marcar pontos ou importar uma camada → visualizar e comparar → revisar pontos → exportar.
- **Fluxo planejado de análise:** escolher um recorte suportado → iniciar análise → acompanhar etapas → receber candidatos em nova camada → revisar → exportar. Identificar a chamada ao Python como integração ainda futura.
- **Wireframes:** manter a identidade e as ferramentas já aprovadas. A distribuição em pelo menos três telas deve ser definida e documentada pela equipe; vários painéis de uma única página não devem ser automaticamente declarados como três telas prontas.
- **Arquitetura:** mostrar o navegador com Leaflet, as fontes cartográficas e o processamento Python. No estado atual, a ponte entre Python e navegador é o arquivo GeoJSON; a ligação por API deve aparecer como planejada.
- **Stack:** justificar HTML/CSS/JS pela simplicidade do protótipo e Python pelas bibliotecas de análise. Não desenhar React, .NET, banco ou microsserviços como se fossem componentes do Protótipo 01.
- **Backlog:** distinguir funcionalidades prontas, validação do detector pendente, integração aprovada mas ainda não iniciada e ideias futuras. Não transformar toda alternativa pesquisada em requisito obrigatório.
- **Papéis:** o Canvas existente contém uma distribuição de responsabilidades da equipe. Este resumo não altera nomes ou papéis; confirmar com o grupo se aquela distribuição continua válida.

### Alinhamento necessário com os materiais anteriores

O Canvas e o pitch existentes são registros do início do projeto. O Canvas enfatiza cobertura, trechos deficitários e propostas preliminares; o pitch ainda dá destaque à identificação de áreas abertas e triagem de espaços maiores. A direção mais recente do protótipo enfatiza **pontos de possíveis árvores, revisão e distribuição espacial**.

Ao finalizar os documentos, harmonizar esses textos para não apresentar como um único escopo já implementado: detecção de árvores, identificação de terrenos livres, cálculo de cobertura e planejamento completo de plantio. Preservar o objetivo de apoio ao planejamento urbano, indicando o que é a prova atual e o que é evolução pretendida.

### Requisitos do evento que precisam continuar visíveis

- Protótipo acessível pelo navegador e demonstração sem dependência de serviço pago ou chave privada.
- Dados reais ou explicitamente declarados como simulados; não apresentar resultados inventados como observados.
- Registro das fontes de dados, bibliotecas, templates, ferramentas de IA e contribuições geradas com seu auxílio.
- Repositório e colaboração por Git, conforme os requisitos do roteiro; este resumo não audita a participação ou os commits individuais.
- Acessibilidade básica: contraste, redimensionamento de texto e interação que não dependa apenas de cores.

O fluxo técnico atual é local: o navegador não precisa de instalação especial, mas o experimento de IA requer o ambiente Python e a GPU preparados no computador que o executa. Um link de demonstração acessível a outras pessoas, um servidor compartilhado e o atendimento completo às exigências de entrega final ainda devem ser organizados pela equipe. O endereço `127.0.0.1` não é uma publicação externa.

O roteiro também exige, para a entrega final, README com execução/limites/próximos passos, pitch deck, vídeo de backup e declarações de originalidade/uso de IA. Esses artefatos não são automaticamente concluídos pela existência deste resumo. O laboratório baseado nos repositórios do amigo deve ser identificado como referência de experimentação, com autoria e aproveitamento declarados; o uso de IA na pesquisa e geração assistida de código/documentação também deve ser registrado.

## 15. Referências e localização dos materiais

- [Repositório Arboriza](https://github.com/lucasbrasantos/arboriza-sematec-2026).
- [README principal: descrição, problema e solução](../README.md).
- [Roteiro do Ideathon FATEC](Ideathon%20-%20Fatec%202026.pdf), especialmente as páginas 6 e 10–12.
- [Canvas, escopo e papéis iniciais](Arboriza_Canvas_Escopo.pptx).
- [Pitch inicial](pitch_arboriza_2min.docx).
- [Guia da interface do Protótipo 01](../prototipo-01/README.md).
- [Guia e relatório do experimento DeepForest](../prototipo-01/docs/EXPERIMENTO.md).
- [Dados do IGC/DataGEO utilizados nos recortes](https://datageo.ambiente.sp.gov.br/geoportal/catalog/search/resource/details.page?uuid=%7B7665C108-A2FF-49D8-A1EF-A6968BA6016A%7D).
- [OpenStreetMap e atribuição](https://www.openstreetmap.org/copyright).
- [DeepForest: pesos oficiais e licença](https://huggingface.co/weecology/deepforest-tree).
- [Fundamentação da regra 3-30-300](https://doi.org/10.1007/s11676-022-01523-z).

Na máquina atual, o repositório está em `X:\-code-\arboriza-sematec`; o laboratório anterior está em `X:\-code-\segmentacao-teste`. Os cinco GeoJSONs para revisão estão em `prototipo-01/resultados/entrega-01/`, e a comparação visual manual/automática está na execução `prototipo-01/resultados/20261105T064446Z-f49246/`. Como dados e resultados são ignorados pelo Git, compartilhar somente o repositório ou este Markdown não transfere esses arquivos automaticamente.

**Próximo marco acordado:** o usuário revisará os arquivos do experimento. A partir do feedback será definido se a prioridade será melhorar a identificação ou autorizar a integração com a API. Nenhuma dessas próximas ações foi iniciada por este resumo.
