# Experimento local — entrega 1

O DeepForest gera caixas de possíveis copas. Este experimento converte o centro das caixas em pontos WGS84 e salva resultados para importar na interface atual. Não há API ou alteração da interface nesta entrega.

## Executar no ambiente preparado

```powershell
Set-Location 'X:\-code-\arboriza-sematec\prototipo-01'
.\.venv\Scripts\python.exe -m backend.analysis
```

O comando carrega os pesos uma vez e executa Centro e Centro-norte, nas janelas 400 e 800, com sobreposição de 25% e confiança mínima 0,50. Os resultados ficam em uma pasta nova dentro de `resultados/`, sem sobrescrever execuções anteriores. Encerre o HQ-SAM e outros trabalhos de GPU antes de medir; não execute dois experimentos ao mesmo tempo.

Para um teste diferente:

```powershell
.\.venv\Scripts\python.exe -m backend.analysis --recorte centro --janelas 400 --confianca 0.3
```

`--recorte`: `centro`, `centro-norte` ou `todos`; `--janelas`: 400 e/ou 800; `--confianca`: 0.1 a 1; `--saida`: diretório de resultados. O piso interno de detecção é 0,1. Baixar a confiança não recupera copas para as quais o modelo não propôs uma caixa acima desse piso.

Cada combinação salva três arquivos com o mesmo nome-base:

- `.geojson`: pontos candidatos, score, origem, recorte, caixa em pixels e `revisado: false`.
- `.png`: imagem analisada com caixas verdes e pontos azuis das detecções selecionadas. A faixa superior é apenas uma legenda do diagnóstico.
- `.json`: parâmetros efetivos, caixas após a deduplicação nativa, motivos de descarte, origem e hash da imagem, pesos, versões, tempos e memória. As caixas abaixo da confiança escolhida continuam nesse diagnóstico; âncoras e caixas suprimidas pelo próprio modelo não são arquivadas.

`comparacao.json` resume as quatro execuções. Os pontos indicam aproximadamente centros de copas, não posições de troncos.

## Abrir os resultados no mapa

1. Abra a interface em <http://127.0.0.1:5175/>; o servidor estático continua independente do experimento.
2. Escolha **Centro** na área de estudo e importe os dois GeoJSONs `deepforest-centro-p400...` e `deepforest-centro-p800...`.
3. Alterne a **Camada em exibição** para comparar. Os resultados vazios também são camadas válidas.
4. Repita com **Centro-norte** e seus dois arquivos. Cada importação cria uma camada separada; suas marcações manuais são preservadas.
5. Use as ferramentas existentes para corrigir e exportar os pontos. As edições ficam na camada da interface, não alteram o diagnóstico original nem significam validação automática das árvores.

Para facilitar o primeiro teste, os cinco GeoJSONs gerados (quatro da bateria original e o Centro adicional em 0,15) também estão reunidos em [`resultados/entrega-01/`](resultados/entrega-01/). Essa pasta é uma cópia da entrega; novas execuções continuam nas suas próprias pastas.

## Primeira execução real — 05/11/2026

Arquivos em [`resultados/20261105T063853Z-2589c5/`](resultados/20261105T063853Z-2589c5/). Dados e resultados são locais, ignorados pelo Git.

| Recorte | Janela | Caixas após NMS, score ≥ 0,1 | Candidatos, score ≥ 0,5 | Inferência | Pico alocado PyTorch |
|---|---:|---:|---:|---:|---:|
| Centro | 400 | 85 | 3 | 1,088 s | 303,6 MiB |
| Centro | 800 | 8 | 0 | 0,290 s | 310,5 MiB |
| Centro-norte | 400 | 36 | 1 | 0,570 s | 305,0 MiB |
| Centro-norte | 800 | 6 | 0 | 0,309 s | 310,5 MiB |

RTX 5070, CUDA 12.8, PyTorch 2.10.0+cu128 e DeepForest 2.1.0. A validação CUDA, importação da biblioteca, conferência e carga do modelo levaram 35,0 s, fora das inferências. A primeira inferência também inclui custos de inicialização; os tempos não são um benchmark controlado. O pico reservado foi de 324–364 MiB; memória alocada pelo PyTorch não representa toda a VRAM utilizada pelo Windows.

O fluxo técnico executou as quatro combinações, mas a identificação ficou incompleta. Nas imagens de diagnóstico, os quatro candidatos sobrepõem visualmente copas; muitas outras copas ficaram sem pontos, incluindo o conjunto escuro grande próximo ao topo do recorte Centro. Nenhuma caixa após NMS com score ≥ 0,1 cobre o centro aproximado dessa copa (pixel 675,180), nas duas janelas. Reduzir apenas a confiança não resolve esse caso.

Nos diagnósticos já calculados, um corte de 0,3 manteria 17/2 candidatos no Centro e 5/0 no Centro-norte, para janelas 400/800. Isso é uma contagem dos scores arquivados, não uma nova execução nem prova de melhora. A comparação principal permanece em 0,5. Não há referência manual completa revisada, precisão ou recall calculados. Não foi escolhida uma configuração vencedora; a janela 800 prevista para a futura API continua sujeita à sua avaliação.

Validações: seis testes automatizados de coordenadas, CRS projetado, bordas, pixels inválidos, RGB, resultado vazio e recusa de CPU; hashes idênticos às imagens de origem; RGB Rasterio idêntico ao RGB do leitor da biblioteca; ida e volta entre pixels e coordenadas nos quatro GeoJSONs. A importação real dos quatro arquivos e da variante adicional em 0,15 passou no navegador, incluindo as duas camadas vazias e a preservação das marcações manuais. A sobreposição geográfica do Centro foi inspecionada no Leaflet.

## Comparação exploratória com sua marcação do Centro

O arquivo `data/arboriza-pontos_CENTRO_.geojson` contém **68 pontos** manuais, com `revisado: false`. Conforme informado pelo autor, inclui árvores, arbustos e outros verdes, com marcação ampla; não é uma referência revisada de árvores individuais. O arquivo original foi apenas lido.

Foi executada uma análise adicional, mantendo os pesos e a janela 400, com confiança mínima **0,15**. Ela gerou **58 candidatos**. Arquivos em [`resultados/20261105T064446Z-f49246/`](resultados/20261105T064446Z-f49246/), com GeoJSON, PNG e registro completo. A bateria original em 0,50 foi preservada. Repetir:

```powershell
.\.venv\Scripts\python.exe -m backend.analysis --recorte centro --janelas 400 --confianca 0.15
```

Score 0,15 é um limiar do detector, **não 15% de probabilidade de acerto**. A contagem próxima à manual não basta para escolher a configuração.

Foi feita uma associação exploratória um-a-um em UTM 22S (EPSG:32722), maximizando pares dentro de cada distância e depois minimizando a distância total. Um mesmo ponto não pode corresponder a vários outros. Os raios abaixo mostram a sensibilidade à posição aproximada dos cliques, sem escolher um raio como validação de qualidade.

| Raio máximo | Pares por proximidade | Manuais sem par | Automáticos sem par |
|---|---:|---:|---:|
| 2 m | 17 | 51 | 41 |
| 3 m | 26 | 42 | 32 |
| 5 m | 32 | 36 | 26 |

Esses números **não são precisão/recall nem classificação de acertos e erros**. Os conjuntos usam critérios diferentes, e centros de copas podem ficar afastados dos cliques manuais.

A [imagem comparativa](resultados/20261105T064446Z-f49246/comparacao-manual-centro.png) mostra os 68 pontos manuais em amarelo, os 58 automáticos em azul e linhas verdes para pares até 3 m. O JSON de mesmo nome registra hash da referência, método, tolerâncias, pares e distâncias. A inspeção mostra copas omitidas e alguns pontos automáticos sobre telhados. Esta variante serve para sua revisão; não foi aprovada como configuração definitiva.

## Rodada 2 — escala e triagem de cor, 05/11/2026

Após o relato de pontos sobre telhados e ruas, foram repetidos os dois recortes com janelas **200, 300 e 400**, sobreposição 25% e corte 0,15, usando o mesmo modelo e o mesmo RGB original. Não foi aumentado o contraste ou a saturação da imagem enviada à IA.

Os arquivos, o script que reproduz a rodada, os parâmetros e o log completo estão em [`resultados/rodada-02-20261105/`](resultados/rodada-02-20261105/). Foram restaurados os scripts do stash autorizado, sem excluir o stash; um `.gitignore` na raiz passou a proteger também caches, pesos, dados, logs, checkpoints e debug dos experimentos.

Foi acrescentada uma triagem de cor **posterior à detecção**, separada da confiança: HSV OpenCV, H 25–95 (escala 0–179), S ≥ 35 e V ≥ 30 (escala 0–255), com pelo menos **10% dos pixels válidos da caixa** nessa faixa. Essa proporção é um parâmetro experimental, não probabilidade de ser árvore. Os candidatos que não passam são separados para revisão, não apagados. O filtro não conhece a geometria exata da copa e pode descartar árvores de outras cores, em sombra ou com caixa imprecisa.

| Recorte | Janela | Originais em 0,15 | Mantidos pela triagem de cor | Separados para revisão | Pares até 3 m antes → depois |
|---|---:|---:|---:|---:|---|
| Centro | 200 | 183 | 108 | 75 | 37 → 37 |
| Centro | 300 | 79 | 53 | 26 | 32 → 32 |
| Centro | 400 | 58 | 40 | 18 | 26 → 26 |
| Centro-norte | 200 | 116 | 65 | 51 | Sem referência manual |
| Centro-norte | 300 | 50 | 30 | 20 | Sem referência manual |
| Centro-norte | 400 | 21 | 15 | 6 | Sem referência manual |

A associação continua exploratória, um-a-um com os 68 pontos mistos, em UTM 22S. Não há precisão/recall medidos. A preservação dos pares próximos não comprova que todas as árvores tenham sido mantidas; candidatos sem par também podem ser árvores reais.

Para revisar primeiro, abrir `deepforest-centro-p300-c0.15-cor.geojson` (53 pontos) e comparar com o original de mesmo prefixo (79 pontos). O arquivo `-revisar-cor.geojson` contém os 26 separados. Repetir com Centro-norte: 30 mantidos e 20 separados. Os PNGs `-cor.png` mostram mantidos em verde e separados em laranja.

Observações da inspeção: a janela 200 aumenta bastante as subdivisões e possíveis duplicações; a janela 300 é uma alternativa razoável para a próxima revisão, mas ainda há objetos artificiais verdes mantidos e copas omitidas. O conjunto escuro grande do Centro continua sem uma detecção que represente sua parte central. A triagem de cor não pode criar propostas que o detector não gerou. Saturação isolada também não separou bem os exemplos examinados de telhados e árvores: seus valores medianos eram semelhantes.

Nenhum padrão definitivo da interface/API foi alterado. Para avançar na identificação, a próxima decisão é revisar estes candidatos e/ou comparar um modelo de reconhecimento de cobertura de copas como evidência adicional, em vez de intensificar apenas filtros de verde. Qualquer segundo modelo ou treinamento exige um novo experimento e avaliação, não uma promessa de melhora.

## Reinstalação e estrutura

O ambiente já está pronto nesta máquina. Para recriá-lo com Python 3.12:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -m venv .venv
$env:PIP_CACHE_DIR = "$PWD\.cache\pip"
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.\.venv\Scripts\python.exe -m backend.detector
.\.venv\Scripts\python.exe -m unittest backend.test_analysis -v
```

`requirements.txt` fixa as dependências principais; `requirements-lock.txt` registra todas as versões instaladas e validadas. O laboratório antigo não é modificado. A falha de CUDA interrompe o experimento; não há fallback automático para CPU.

Os dados necessários são os dois `aracatuba-*_rgb8.tif` e seus respectivos `aracatuba-*_fonte.json`, já copiados para `data/ortofotos/` de `X:\-code-\segmentacao-teste\media\ortofotos`. Em outra instalação, copie esses quatro arquivos para a mesma pasta relativa. Eles são produtos RGB renderizados do WMS IGC/DataGEO 2023/2024, não os rasters originais do aerolevantamento. A procedência completa é preservada nos JSONs.

`backend/detector.py` cuida de CUDA, pesos e inferência; `backend/analysis.py` cuida de imagens, georreferenciamento, arquivos e CLI. A API será acrescentada só após seu feedback, chamando a mesma análise. Não usamos banco, filas externas ou abstrações adicionais.

O comando `backend.detector` prepara os pesos na revisão fixada em `backend/model.json`, conferindo hashes. Também prepara o backbone ResNet50 que a biblioteca instancia antes de carregar os pesos completos. Os arquivos ficam em `.models/` e `.cache/`; a análise reutiliza somente os pesos locais. A preparação inicial exige internet; o experimento posterior não. O mapa continua dependendo dos serviços externos.

Fontes: [DeepForest 2.1.0](https://github.com/weecology/DeepForest/releases/tag/v2.1.0), [pesos oficiais e licença MIT](https://huggingface.co/weecology/deepforest-tree), [predição por janelas](https://deepforest.readthedocs.io/en/stable/user_guide/16_prediction.html).
