# Protótipo 01

Protótipo do Arboriza: interface HTML/CSS/JavaScript com Leaflet e uma API local FastAPI para identificar possíveis árvores nos dois recortes de Araçatuba. Sem etapa de build no frontend.

Para iniciar pela raiz do repositório:

```powershell
.\prototipo-01\.envs\detectree2\Scripts\python.exe .\prototipo-01\scripts\run.py
```

O script abre <http://127.0.0.1:5175/> no navegador padrão. Ctrl+C encerra o servidor. Dentro de `prototipo-01`, use `.\.envs\detectree2\Scripts\python.exe .\scripts\run.py`. Para outra porta ou sem abrir o navegador, acrescente `--port 5176` ou `--no-browser`. Se a porta estiver ocupada, encerre o servidor anterior.

No **VS Code**, abra a raiz `arboriza-sematec`, escolha **Protótipo 01: interface** em Executar e Depurar e pressione **F5**. A configuração usa o ambiente `.envs/detectree2` já preparado no Windows; requer a extensão Python Debugger. Shift+F5 encerra a execução. Pare o servidor estático antigo antes de iniciar esta versão.

O mesmo processo serve API e `frontend/` em 127.0.0.1, sem publicar dados, pesos, ambientes ou diagnósticos como arquivos estáticos. A API fornece apenas os pontos de análises concluídas. O [fluxo local integrado](docs/FLUXO_LOCAL.md) explica os perfis, resultados e dependências. O [experimento DeepForest](docs/EXPERIMENTO.md) permanece separado.

Ao abrir o endereço inicial, a página de boas-vindas apresenta o projeto. Use **Conheça o projeto** para ler sobre a regra 3-30-300 e a detecção, ou **Explorar mapa** para abrir a interface existente. O mapa permanece acessível diretamente em `/index.html`; os links no cabeçalho permitem voltar às novas páginas. A imagem e os pontos decorativos na abertura não representam resultados de uma análise. As novas páginas usam `frontend/css/paginas.css`, separado dos estilos do mapa; as fontes externas têm alternativas locais caso não carreguem.

A [preparação Detectron2 no Windows](docs/DETECTRON2_WINDOWS.md) foi validada em ambiente separado. O [piloto Detectree2 Cambridge](docs/EXPERIMENTO_CAMBRIDGE.md) já processou os dois recortes e gerou pontos para revisão; não há precisão global validada.

A [revisão dos novos arquivos manuais](docs/REVISAO_CAMBRIDGE_2026-11-05.md) compara 64 pontos do Centro e 36 do Centro-norte com novas execuções Cambridge, separando corte de score, escala e agregação.

A [pesquisa de fontes e rodada de múltiplas escalas](docs/FONTES_IMAGENS_E_MULTIESCALA_2026-11-05.md) explica 100/200 m, diferencia os fundos DataGEO e Sentinel-2 e registra as variantes experimentais de agregação por máscaras. Elas permanecem separadas do padrão atual.

- Alterne entre ruas (OpenStreetMap) e imagem aérea (IGC/DataGEO, levantamento 2023/2024).
- Escolha um dos dois recortes ou use o enquadramento atual como área de estudo.
- Em **Seleção territorial**, abra a malha urbana do IBGE de 2022 e selecione setores por clique, retângulo ou desenho livre. A barra inferior muda durante a seleção; **Voltar aos pontos** restaura a edição. O desenho seleciona setores inteiros que têm interseção de área positiva; tocar apenas a borda não seleciona o setor.
- **Toda área urbana** seleciona os 499 setores de Araçatuba classificados como urbanos na fonte preparada, inclusive núcleos isolados. Inverter atua sobre essa mesma malha. A área exibida é a união dos setores em km² e hectares, não uma medida de cobertura arbórea. Esta é uma delimitação estatística do Censo 2022, não a confirmação do perímetro urbano legal atual.
- Dê um nome e salve áreas territoriais neste navegador; carregue-as de novo pelo painel ou exporte a seleção em GeoJSON como cópia. Elas são independentes das camadas de pontos e ficam vinculadas à versão da malha. Limpar dados do navegador ou mudar de host/porta pode torná-las indisponíveis. A importação existente continua destinada a pontos, não a áreas territoriais.
- Com a seleção territorial ativa, o perfil Controle permite analisar os setores escolhidos. As imagens IGC necessárias são reutilizadas do cache local ou buscadas do DataGEO; a camada de pontos é adicionada ao concluir. A qualidade das detecções precisa de revisão e a análise da cidade inteira ainda não foi validada.
- Durante a análise dos recortes disponíveis, um contorno pulsante e um indicador no mapa mostram a etapa informada pela API e o tempo decorrido. O mapa permanece navegável e editável. Se o acompanhamento perder a conexão, o indicador muda de estado e o painel oferece **Acompanhar novamente** sem iniciar outra análise. Não há estimativa de tempo restante nesta versão.
- Use a barra inferior para adicionar pontos, selecionar por clique ou retângulo, mover em grupo e apagar a seleção. Ctrl/Shift + clique combina pontos; Shift + arraste também seleciona por retângulo. Arrastar um ponto selecionado move o grupo. A ferramenta **Mover (M)** permite iniciar o arraste em qualquer lugar do mapa, mantendo a seleção; use **Selecionar (V)** para voltar a navegar pelo mapa.
- **Selecionar todos**, **Inverter seleção** e **Limpar seleção** atuam sobre a camada inteira, incluindo os pontos fora do enquadramento ou ainda não exibidos na lista.
- A lista mostra os pontos do mais recente ao mais antigo; as caixas combinam a seleção e o nome aproxima o mapa até o ponto. Em telas estreitas, a lista se fecha para liberar a visualização.
- Na ferramenta **Selecionar (V)**, selecionar um único ponto abre uma ficha no mapa com número, ID, coordenadas, origem e dados do modelo quando disponíveis. Ela permanece aberta após soltar o mouse; clicar novamente no ponto selecionado reabre a ficha. Use **Copiar coordenadas** ou **Copiar informações**; o segundo copia o objeto GeoJSON completo do ponto. A ficha fecha na seleção múltipla ou ao trocar para outra ferramenta; adicionar pontos não abre a ficha.
- O botão de coordenadas no canto inferior esquerdo do canvas, junto à escala de distância, mostra latitude e longitude sob o cursor. Clique para copiar os valores exibidos. A posição fica congelada ao passar o mouse pelos controles, para conseguir copiar o último local apontado no mapa.
- Atalhos: Ctrl+A seleciona todos da camada; Delete apaga; Ctrl+Z desfaz; Ctrl+Y ou Ctrl+Shift+Z refaz; Esc limpa a seleção e volta à ferramenta Selecionar. V/M/P/B escolhem selecionar/mover/adicionar/retângulo; L abre ou fecha a lista. Os atalhos aparecem nos botões. No macOS, Command substitui Ctrl.
- O histórico guarda até 50 ações por camada durante a sessão. Mover ou apagar vários pontos conta como uma ação. Todas as camadas, seus IDs e as edições ficam salvos neste navegador; o histórico de desfazer/refazer não sobrevive à recarga. Exporte cópias dos pontos importantes.
- Os botões **Camadas** e **Pontos** ficam no canto direito do mapa, abaixo do zoom. Abrem para baixo e apenas uma lista permanece aberta. O atalho L alterna a lista de pontos; Esc recolhe as listas. A lista saiu da barra de edição.
- Importe arquivos GeoJSON de pontos WGS84 para alternar entre resultados. Cada arquivo vira uma camada. O `Feature.id` e `properties.numero` são exportados e preservados na reimportação; IDs dos modelos são mantidos. Arquivos antigos recebem IDs/números na primeira importação. O painel Camadas permite selecionar, excluir uma camada e “Limpar mapa” com confirmação; os arquivos no disco são preservados.
- Clicar em uma camada recupera seus pontos, o recorte e o enquadramento, mesmo se ela já estiver ativa. Os limites personalizados são salvos no navegador e no campo `arboriza.area` do GeoJSON exportado. Camadas antigas usam a identificação do recorte (inclusive o nome padrão de exportação); sem identificação, a área é aproximada pela extensão dos pontos. Pontos editados fora dos limites ampliam a área da camada para incluí-los.
- Os botões do cabeçalho alternam o tema claro/escuro e o painel lateral/flutuante. Essas preferências ficam salvas neste navegador.
- Para ajustar o vidro, altere as variáveis no início de `frontend/css/styles.css`: `--glass-opacity` (82% no tema claro, 84% no escuro; menor valor deixa mais transparente), `--glass-blur` (20px; maior valor desfoca mais) e `--glass-saturation` (1.2). São compartilhadas pelo painel flutuante, pela barra de ferramentas e pela lista; evite aplicar `opacity` ao painel inteiro, pois isso também apaga o texto.
- A contagem na área é separada do total da camada. A exportação inclui a camada inteira selecionada. O nome do arquivo identifica o recorte selecionado e a data/hora local da exportação, por exemplo: `arboriza-pontos_centro-norte_2026-11-05_17-40-23.geojson`.
- A densidade é uma visualização de concentração de pontos, não uma medida de cobertura de copas nem uma avaliação da regra 3-30-300.

As três imagens em `frontend/assets/` são prévias JPEG leves das mesmas ortofotos IGC/DataGEO: cidade (768×768) e dois recortes (512×512), cerca de 252 KiB no total. Permanecem sob os blocos detalhados durante o carregamento. Fora dessa área não há prévia local. Os blocos WMS do mapa usam 512 pixels e nível máximo de detalhe 19; acima dele o mapa amplia a imagem existente, sem solicitar resolução adicional. A velocidade dos detalhes do mapa ainda depende do serviço externo. O cache persistente de imagens da análise não é usado como camada visual do mapa.

### Preparar a malha territorial em outra instalação

O arquivo preparado fica em `prototipo-01/data/territorial/`, fora do Git. Para recriá-lo com o ambiente Detectree2 existente:

```powershell
.\prototipo-01\.envs\detectree2\Scripts\python.exe .\prototipo-01\scripts\preparar_setores_ibge.py
```

O script baixa temporariamente a malha definitiva do IBGE de São Paulo (aproximadamente 80 MB), extrai somente setores com município `3502804` e situação `Urbana`, registra a origem e o SHA-256 e remove o download temporário. Ele não sobrescreve um arquivo territorial existente. Reinicie o servidor após preparar o arquivo. Sem ele, a interface de pontos continua disponível e a seleção territorial informa como preparar os dados.

A interface analisa os recortes Centro e Centro-norte ou setores selecionados com o perfil Controle. “Usar enquadramento” continua disponível para edição manual, mas desenhos arbitrários sem seleção de setores ainda não podem ser analisados. Os pontos são possíveis árvores, sujeitos à revisão. A inferência usa pesos locais e CUDA; áreas sem imagens em cache precisam do DataGEO.

Fontes: [IGC/DataGEO](https://datageo.ambiente.sp.gov.br/geoportal/catalog/search/resource/details.page?uuid=%7B7665C108-A2FF-49D8-A1EF-A6968BA6016A%7D), [OpenStreetMap](https://www.openstreetmap.org/copyright), [política dos mapas públicos](https://operations.osmfoundation.org/policies/tiles/). Os mapas são usados para visualização, sem download em lote.

## Organização

- `frontend/`: HTML, CSS, JavaScript e prévias públicas do mapa.
- `backend/`: processamento Python e configurações dos modelos.
- `scripts/`: inicialização da interface e preparação/verificação dos ambientes.
- `tests/`: testes de pontos e processamento geográfico.
- `requirements/`: dependências e versões fixadas de cada ambiente.
- `docs/`: instruções e relatórios dos experimentos deste protótipo.
- `data/`, `resultados/`, `.models/`, `.cache/`, `.venv/` e `.envs/`: arquivos locais fora do Git e da publicação web.

Execute os testes dentro de `prototipo-01`:

```powershell
node --test tests/test-points.mjs tests/test-areas.mjs tests/test-territory-analysis.mjs tests/test-analysis-loading.mjs
.\.envs\detectree2\Scripts\python.exe -m unittest tests.test_analysis tests.test_cambridge tests.test_multiscale tests.test_api
.\.envs\detectree2\Scripts\python.exe -m unittest tests.test_territory
```
