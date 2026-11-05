# Protótipo 01

Interface de teste do Arboriza: HTML, CSS e JavaScript, com Leaflet 1.9.4 e Leaflet.heat 0.2.0 carregados por CDN. Sem instalação de pacotes ou etapa de build.

Para iniciar pela raiz do repositório:

```powershell
.\prototipo-01\.venv\Scripts\python.exe .\prototipo-01\scripts\run.py
```

O script abre <http://127.0.0.1:5175/> no navegador padrão. Ctrl+C encerra o servidor. Dentro de `prototipo-01`, use `.\.venv\Scripts\python.exe .\scripts\run.py`. Para outra porta ou sem abrir o navegador, acrescente `--port 5176` ou `--no-browser`. Se a porta estiver ocupada, encerre o servidor anterior.

No **VS Code**, abra a raiz `arboriza-sematec`, escolha **Protótipo 01: interface** em Executar e Depurar e pressione **F5**. A configuração em `.vscode/launch.json` usa o ambiente `.venv` já preparado; requer a extensão Python Debugger, instalada nesta máquina. Shift+F5 encerra a execução.

O servidor utiliza apenas a biblioteca padrão do Python e publica somente os arquivos de `frontend/`, sem expor dados, resultados, modelos ou código do backend. O [experimento Python com DeepForest](docs/EXPERIMENTO.md) continua separado e gera GeoJSONs para importação manual; a API e o botão de análise ficam para a segunda entrega, após sua avaliação.

A [preparação Detectron2 no Windows](docs/DETECTRON2_WINDOWS.md) foi validada em ambiente separado. O [piloto Detectree2 Cambridge](docs/EXPERIMENTO_CAMBRIDGE.md) já processou os dois recortes e gerou pontos para revisão; não há precisão global validada.

- Alterne entre ruas (OpenStreetMap) e imagem aérea (IGC/DataGEO, levantamento 2023/2024).
- Escolha um dos dois recortes ou use o enquadramento atual como área de estudo.
- Use a barra inferior para adicionar pontos, selecionar por clique ou retângulo, mover em grupo e apagar a seleção. Ctrl/Shift + clique combina pontos; Shift + arraste também seleciona por retângulo. Arrastar um ponto selecionado move o grupo. A ferramenta **Mover (M)** permite iniciar o arraste em qualquer lugar do mapa, mantendo a seleção; use **Selecionar (V)** para voltar a navegar pelo mapa.
- **Selecionar todos**, **Inverter seleção** e **Limpar seleção** atuam sobre a camada inteira, incluindo os pontos fora do enquadramento ou ainda não exibidos na lista.
- A lista mostra os pontos do mais recente ao mais antigo; as caixas combinam a seleção e o nome aproxima o mapa até o ponto. Em telas estreitas, a lista se fecha para liberar a visualização.
- Ao selecionar um único ponto, uma ficha no mapa mostra número, ID, coordenadas, origem e dados do modelo quando disponíveis. Ela permanece aberta após soltar o mouse; clicar novamente no ponto selecionado reabre a ficha. Use **Copiar coordenadas** ou **Copiar informações**; o segundo copia o objeto GeoJSON completo do ponto. Para seleção múltipla, a ficha fecha.
- O botão de coordenadas no canto inferior esquerdo do canvas, junto à escala de distância, mostra latitude e longitude sob o cursor. Clique para copiar os valores exibidos. A posição fica congelada ao passar o mouse pelos controles, para conseguir copiar o último local apontado no mapa.
- Atalhos: Ctrl+A seleciona todos da camada; Delete apaga; Ctrl+Z desfaz; Ctrl+Y ou Ctrl+Shift+Z refaz; Esc limpa a seleção e volta à ferramenta Selecionar. V/M/P/B escolhem selecionar/mover/adicionar/retângulo; L abre ou fecha a lista. Os atalhos aparecem nos botões. No macOS, Command substitui Ctrl.
- O histórico guarda até 50 ações por camada, apenas durante a sessão. Mover ou apagar vários pontos conta como uma ação. Pontos manuais ficam salvos neste navegador, incluindo alterações desfeitas/refeitas.
- Importe arquivos GeoJSON de pontos WGS84 para alternar entre resultados. Cada arquivo vira uma camada. O `Feature.id` e `properties.numero` são exportados e preservados na reimportação; IDs existentes dos modelos são mantidos. Arquivos antigos sem esses campos recebem novos IDs/números na primeira importação: lacunas da numeração antiga não podem ser reconstruídas a partir deles. Arquivos importados ficam em memória; exporte as alterações para guardá-las.
- Os botões do cabeçalho alternam o tema claro/escuro e o painel lateral/flutuante. Essas preferências ficam salvas neste navegador.
- Para ajustar o vidro, altere as variáveis no início de `frontend/css/styles.css`: `--glass-opacity` (82% no tema claro, 84% no escuro; menor valor deixa mais transparente), `--glass-blur` (20px; maior valor desfoca mais) e `--glass-saturation` (1.2). São compartilhadas pelo painel flutuante, pela barra de ferramentas e pela lista; evite aplicar `opacity` ao painel inteiro, pois isso também apaga o texto.
- A contagem na área é separada do total da camada. A exportação inclui a camada inteira selecionada. O nome do arquivo identifica o recorte selecionado e a data/hora local da exportação, por exemplo: `arboriza-pontos_centro-norte_2026-11-05_17-40-23.geojson`.
- A densidade é uma visualização de concentração de pontos, não uma medida de cobertura de copas nem uma avaliação da regra 3-30-300.

As três imagens em `frontend/assets/` são prévias JPEG leves das mesmas ortofotos IGC/DataGEO: cidade (768×768) e dois recortes (512×512), cerca de 252 KiB no total. Permanecem sob os blocos detalhados durante o carregamento. Fora dessa área não há prévia local. Os blocos WMS usam 512 pixels e nível máximo de detalhe 19; acima dele o mapa amplia a imagem existente, sem solicitar resolução adicional. Isso reduz requisições e espaços vazios; a velocidade dos detalhes ainda depende do serviço externo. Não há cache persistente de blocos nem download em lote.

A interface ainda não dispara detecção automática e não contém dados de árvores simulados. A área delimitada é uma área de estudo, não uma área já analisada. Os pontos do experimento Python são possíveis árvores, sujeitos à revisão. Internet é necessária para as bibliotecas e os mapas; os serviços externos podem ficar indisponíveis.

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
node --test tests/test-points.mjs
.\.envs\detectree2\Scripts\python.exe -m unittest tests.test_analysis tests.test_cambridge
```
