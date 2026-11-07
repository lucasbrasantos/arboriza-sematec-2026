# Mapa público — interface em validação

## Decisões aprovadas

- Área Início validada; autorizada a etapa do mapa público.
- Mapa geográfico navegável com Leaflet e React Leaflet; resultados demonstrativos até a integração com a API do Arboriza.
- Painel lateral recolhível, detalhes na própria lateral e “Voltar à exploração”.
- Identidade compartilhada aprovada: verdes, Manrope, vidro e destaque Mel, com prioridade de leitura nas ferramentas.
- Mapa ocupando toda a tela, navegação compacta e lateral flutuante sobre o mapa, somente em `/mapa`.
- Densidade demonstrativa com paletas, separada da escolha de imagem aérea/ruas. Resultados continuam fictícios.

## Reaproveitamento do protótipo 01

O protótipo já reúne consulta cartográfica, seleção territorial, camadas locais, edição e análise. A área pública reaproveita a abordagem de Leaflet, os limites dos recortes Centro/Centro-norte, as prévias locais e as fontes de fundo. O JavaScript que manipula o DOM do protótipo não foi copiado para o React.

Edição, histórico, importação/exportação, execução da análise e publicação pertencem ao trabalho da equipe. Não foram migrados nesta etapa. O protótipo HTML/Python permanece preservado.

## Organização da interface

- **Explorar:** escolher recorte, buscar nos exemplos e selecionar item pela lista ou pelo mapa. Pontos e trechos ficam em grupos recolhíveis, com contagem e até cinco itens por página. A busca abre os grupos correspondentes; mudar a busca ou o recorte reinicia a paginação.
- **Mapa base:** miniatura no canto inferior esquerdo abre o seletor de imagem aérea/ruas, inspirado na organização do Google Maps. A escolha mantém o modo de visualização e a paleta.
- **Visualização:** botão junto a “Entenda o mapa” abre as opções Pontos individuais e Densidade de pontos. Paletas Vegetal, Solar, Azul e Personalizada; a última permite escolher as duas cores do gradiente.
- **Camadas:** exibir ou ocultar pontos, trechos e limite do recorte. Ocultar pontos também oculta a densidade.
- **Detalhes:** explicar significado, origem e limites do exemplo; coordenadas em uma seção opcional.
- **Retorno:** mantém busca, camadas, grupo e página da lista, devolvendo foco ao item consultado quando ele está visível. Recolher preserva a seleção e o centro geográfico.
- **Navegação:** zoom, arrastar, centralizar recorte, escala métrica e legenda “Entenda o mapa”.
- **Celular:** começa recolhido. O painel abre sobre o mapa; controles encobertos ficam fora da navegação por teclado. “Ver este item no mapa” recolhe os detalhes mantendo a seleção. Escape, com foco na lateral, fecha o painel e devolve foco ao botão principal. Os seletores inferiores também fecham por Escape e devolvem foco ao seu acionador.

O cabeçalho completo da landing page não aparece em `/mapa`. A marca permite voltar ao site, e o botão Explorar/Recolher controla a lateral. O mapa continua atrás dos painéis; ao selecionar ou centralizar um recorte no desktop, a câmera considera a parte livre à direita da lateral.

A busca usa somente o contorno externo de foco, conforme o ajuste aprovado no laboratório.

## Dados e transparência

`map-data.ts` contém nove pontos e três trechos tipados, distribuídos entre dois recortes. **Posições, traçados e prioridades são fictícios.** Não são saídas do detector, árvores confirmadas, diagnósticos ou recomendações para essas ruas.

Alta, Moderada e Baixa demonstram classes de prioridade; não há cálculo ou limites de classificação definidos. Pontos não equivalem a cobertura de copas e a regra 3-30-300 não é calculada.

A densidade usa cada ponto fictício com peso igual a um. É uma suavização visual da concentração relativa, com aparência dependente do zoom e do raio configurado. Não mede temperatura, cobertura de copas ou árvores por km². Em modo de densidade, os marcadores individuais são ocultados, exceto o item selecionado para consulta.

Os retângulos são áreas de estudo do protótipo, sem representar limites oficiais de bairros/município ou a delimitação final da área piloto. A vista da cidade demonstra navegação sem resultados publicados.

A busca é local: filtra os itens ilustrativos do recorte e oferece outros recortes cujo nome corresponda ao texto. Não é geocodificação de endereços. Nenhuma análise, consulta à API do Arboriza, autenticação ou publicação ocorre nesta etapa.

## Fontes cartográficas

- Imagem aérea: serviço WMS IGC-SP / DataGEO, camada `ORTOFOTOS_SP_2023_2024`, reaproveitada do protótipo.
- Prévias locais: cópias de `cidade.jpg`, `centro.jpg` e `norte.jpg`. Sustentam a abertura e uma referência visual em falha de rede; não substituem todos os blocos remotos.
- Ruas: [OpenStreetMap](https://www.openstreetmap.org/copyright), com atribuição visível, cache normal do navegador e sem download em massa ou recurso de mapas offline. Considerar a [política de tiles](https://operations.osmfoundation.org/policies/tiles/) ao definir a hospedagem.

Serviços remotos precisam de conexão. Carregamento, falha dos blocos e “Tentar novamente” são apresentados na interface.

## Organização técnica

```text
features/map/
  MapPage.tsx              # Estado e composição
  MapCanvas.tsx            # Leaflet, bases, navegação e geometria
  HeatmapOverlay.tsx       # Ciclo de vida da camada de densidade
  MapSidebar.tsx           # Exploração, camadas e detalhes
  MapResultGroup.tsx       # Grupos recolhíveis e paginação
  MapDisplayControls.tsx   # Fundo, visualização e legenda
  map-data.ts              # Tipos e fixtures identificadas
  map*.css                 # Estilos por responsabilidade
```

- Leaflet 1.9.4, React Leaflet 5.0.0 e tipos de desenvolvimento `@types/leaflet` 1.9.22.
- Leaflet.heat 0.2.0, já adotado no protótipo, com `@types/leaflet.heat`. A versão 1.0.0 foi avaliada e não adotada: sua declaração de tipos não é compatível com a versão de Leaflet desta aplicação.
- TypeScript estrito e união discriminada entre ponto e trecho, sem `any` nos componentes.
- Rota sob demanda: Leaflet não entra no carregamento inicial da landing page.
- Tema, vidro, Toggle, movimento reduzido e grafismo do estado sem resultados reaproveitados.
- Cores dos dados separadas dos destaques decorativos; contorno claro nos trechos e recortes para leitura sobre imagem aérea.
- Sem camadas de arquitetura, armazenamento ou serviços sem uso concreto.

Referências técnicas: [React Leaflet](https://react-leaflet.js.org/docs/api-map/) e [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html).

## Próximos modos propostos — ainda não implementados

| Modo | Uso | Cuidados para os dados reais |
|---|---|---|
| Pontos agrupados | Somar marcações próximas ao afastar e separá-las ao aproximar. | Agrupamento por proximidade na tela, sem representar bairro ou setor. Distinguir contagem de candidatos e árvores revisadas. |
| Setores censitários | Colorir cada setor pela estimativa ou por um indicador comparável. | Usar a malha oficial definitiva do Censo 2022; definir cálculo e área efetivamente analisada. Exibir origem, data e limitações. |
| Densidade com dados publicados | Explorar concentração espacial das marcações. | Manter legenda de intensidade relativa; definir escala, pesos e comportamento por zoom antes de comparar áreas. |

O [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) é uma opção para avaliar no modo de agrupamento. Nenhuma dependência de agrupamento foi adicionada nesta etapa.

A referência territorial é a [malha de setores censitários e divisões intramunicipais do IBGE](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/26565-malhas-de-setores-censitarios-divisoes-intramunicipais.html). Os retângulos atuais não simulam setores censitários. Antes da integração, validar como tratar contagem total, densidade por km² efetivamente analisado e cobertura parcial de um setor. “Sem análise” deve ter aparência própria, distinta de zero árvores; um recorte parcial não permite atribuir automaticamente uma estimativa ao setor inteiro.

Esses modos ficam em **Visualização**; os conjuntos disponíveis, como setores, trechos e limites, ficam em **Camadas**. Novos provedores de imagem entram em **Mapa base**. O painel inferior usa um único seletor aberto de cada vez; não há drawer permanente adicional.

Os grupos e a paginação preparam a interação para listas maiores, mas não demonstram capacidade de processar toda a cidade. Volume real exigirá avaliar consultas por área visível, agregação espacial, paginação da API e desempenho com dados representativos.

## Verificação e limites

- Lint e build com checagem de tipos executados.
- No Chromium: acesso/recarregamento de `/mapa`, seleção pelo mapa e pela lista, detalhes e retorno mantendo a busca.
- Busca de recortes, troca Centro/Centro-norte, vista sem resultados, camadas ocultas e alternância aérea/ruas conferidas.
- Zoom, arrastar, centralizar e recolher/abrir painel conferidos. Seleção centralizada antes e depois do recolhimento.
- Desktop e viewport 375 × 812 sem transbordamento horizontal nos percursos examinados. Painel móvel, seleção, foco, Escape e movimento reduzido conferidos.
- Falha de rede induzida: mensagem, prévia local e nova tentativa após restaurar a conexão conferidas. Emulações de rede, viewport e movimento restauradas ao final.
- Capturas em `output/site-react-mapa` na pasta de trabalho Sematec.
- Sem teste em aparelho físico, outros navegadores, grande volume de pontos, qualidade do detector ou desempenho em rede móvel. Falhas de rede provocadas no teste eram esperadas.

### Refinamento imersivo — 07/11/2026

- Lint e build com TypeScript estrito executados novamente.
- Chromium em 1280 × 720 e viewport 375 × 812: mapa ocupa a altura toda, sem transbordamento horizontal nos percursos examinados. Cabeçalho aprovado da área Início preservado.
- Densidade renderizada, troca de paletas, duas cores personalizadas e manutenção da escolha ao reabrir o seletor conferidas. Alternar aérea/ruas preserva a visualização.
- Grupos, busca com abertura automática, paginação de cinco itens, limites de página e retorno dos detalhes à página/item anterior conferidos.
- Painel móvel, controles encobertos fora da navegação por teclado, Escape dentro dos painéis e retorno de foco conferidos. Sem erros ou avisos no console nos percursos examinados.
- Viewport restaurado. Capturas adicionais em `output/site-react-mapa-imersivo` na pasta de trabalho Sematec.
- A validação anterior de falha de rede e movimento reduzido não foi repetida neste refinamento. Não houve medição de desempenho com muitos pontos nem validação em aparelho físico.

## Próxima validação

O usuário aprovou o refinamento imersivo em 07/11/2026 e autorizou iniciar a etapa de Administração. API, área piloto real, critérios, setores oficiais, agrupamento e dados revisados continuam pendentes. Proposta da próxima etapa em [Administração](ADMINISTRACAO.md).
