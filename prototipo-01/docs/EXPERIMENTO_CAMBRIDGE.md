# Piloto Detectree2 Cambridge — 05/11/2026

Os dois recortes atuais foram processados no Windows, na RTX 5070, com o peso urbano Cambridge. A saída principal é um ponto WGS84 no centro de cada caixa, representando uma **possível copa**, sem confirmar árvore individual ou localização de tronco. A interface/F5 permanecem os mesmos, com importação manual dos GeoJSONs.

## Resultados para revisar

Pasta: `resultados/detectree2-cambridge-piloto/20261105T175332Z-9697ec/`.

| Corte de score | Centro | Centro-norte |
|---|---:|---:|
| 0,15 | 33 | 12 |
| 0,30 | 22 | 6 |
| 0,50 | 13 | 4 |

Começar pelos arquivos `cambridge-centro-t200m-c0.15.geojson` e `cambridge-centro-norte-t200m-c0.15.geojson`. São os cortes com mais candidatos **dentre os avaliados nesta execução**. Os sufixos `c0.30` e `c0.50` permitem observar o que desaparece quando o corte aumenta; nenhum foi escolhido como vencedor. Score não é probabilidade de acerto e não é diretamente equivalente ao score de outro modelo.

Para visualizar as comparações, abrir `comparacao-centro.png`, `comparacao-centro-norte.png` e `copa-escura-comparacao.png`, na mesma pasta. As comparações incluem os controles DeepForest p300/0,15 com e sem HSV, sem executar novamente ou sobrescrever esses resultados. O painel manual do Centro contém os 68 pontos mistos originais e não é uma referência validada de árvores.

Na interface já existente: iniciar pelo F5, escolher o recorte, importar o GeoJSON como camada e revisar com as ferramentas de pontos. Exportar suas correções para preservá-las; a importação continua em memória.

## O que foi observado

- **Copa escura grande do Centro:** Cambridge propôs uma caixa/ponto na região que o DeepForest p300/0,15 não havia marcado, inclusive antes do filtro de cor. A proposta representa o conjunto de copas como um objeto; não demonstra quantos indivíduos existem ali. Exemplo preservado: `centro-0017`, score do modelo aproximadamente 0,882.
- **Omissões:** ainda há copas/vegetação visíveis sem propostas nos cortes apresentados. É necessária revisão humana para separar árvores de outros verdes. Os registros não permitem afirmar que toda omissão é reconhecimento: pode envolver corte de score, NMS interno, escala ou transferência do treinamento.
- **Possível duplicação de borda:** `centro-0002` e `centro-0040` aparecem sobre uma mesma região próxima à borda superior esquerda. O segundo vem da janela iniciada em y=210 e toca a borda da janela. As duas caixas sobrevivem ao NMS global por IoU 0,5. Isso é evidência de um caso a revisar na agregação, sem provar automaticamente que são dois indivíduos ou que um deve ser removido.
- **Precisão global desconhecida:** os pontos estão visualmente alinhados com a imagem, mas isso não comprova que todos representam árvores. Não foram calculados precisão, recall ou superioridade geral. Árvores omitidas e propostas artificiais precisam ser revisadas sobre uma referência completa.

## Configuração e rastreabilidade

- Detectree2 2.1.2, revisão `39da1ba52e9392e54c2b29deef711f1b676bf86b`; Detectron2 compilado da revisão `247691a1c292654867deb35cabb27f18d75a1363`.
- Peso `urban_trees_Cambridge_20230630.pth` (503.062.799 bytes), conferido por MD5 do Zenodo e SHA-256 do manifesto `backend/cambridge-model.json`.
- Modelo/configuração `mask_rcnn_R_101_FPN_3x`, uma classe; configuração completa salva por recorte. A inferência recebeu BGR conforme `DefaultPredictor`, convertido explicitamente do RGB8 original.
- Imagens detalhadas originais, sem realce de contraste/saturação ou HSV. CRS, pixels válidos, metadados e hashes foram preservados.
- Janelas de aproximadamente 200 m: **821 × 770 pixels**, redimensionadas pela rede para **853 × 800**. Uma janela por chamada, trabalhadores zero, modelo carregado uma vez para os dois recortes.
- Sobreposição nominal 25%, com última janela ancorada na borda para evitar preenchimento artificial. Pelo tamanho destes recortes, a sobreposição efetiva entre as duas posições é maior, aproximadamente 70% em x e 73% em y. Coordenadas exatas estão no JSON.
- Piso de inferência 0,15; cortes 0,15/0,30/0,50 derivados da mesma execução, sem nova inferência por corte.
- NMS nativo por janela seguido de **NMS global de caixas, IoU 0,5**, via torchvision em CPU. Esse último passo é uma agregação explícita deste piloto; não é a limpeza de polígonos `clean_crowns` do Detectree2. Não houve filtro adicional de área ou cor.

O Centro produziu 66 propostas após o NMS nativo e antes da agregação global, das quais 33 foram suprimidas pelo NMS global. Centro-norte produziu 23, com 11 supressões globais. **Supressão por sobreposição não confirma que eram duplicatas reais**; candidatos e razões continuam disponíveis para revisar esse efeito. Nenhuma janela atingiu o limite de 100 detecções, e todos os centros mantidos estavam dentro de suas máscaras previstas.

As máscaras de todas as propostas pós-NMS nativo foram guardadas em COCO RLE, comprimidas em `*-mascaras.json.gz`, com identificador, janela e deslocamento. O JSON de cada recorte guarda scores, caixas, razões, vínculo da supressão, bordas de janela e parâmetros. As propostas anteriores ao piso/NMS interno não estão arquivadas.

## Execução e validação

Carga e conferência do modelo: cerca de **1,90 s**. Centro levou **17,82 s** na inferência/transferência/codificação de máscaras; Centro-norte, **0,37 s**. A primeira janela do primeiro recorte concentrou 17,46 s; as demais ficaram aproximadamente entre 0,07 e 0,10 s. Isso distingue a execução inicial das seguintes, sem atribuir uma causa específica ao custo inicial. O emulador mobile do usuário estava aberto; estes tempos não constituem comparação de desempenho com GPU exclusiva.

Pico PyTorch por recorte: aproximadamente **567 MiB alocados / 856 MiB reservados**, sem erro de memória. Esses valores não incluem toda a VRAM do desktop/emulador.

Passaram 11 testes no ambiente novo, incluindo os seis existentes e verificações de cobertura das janelas, escala métrica, metadados, RGB/BGR e deduplicação. Os seis testes originais também passaram no ambiente DeepForest. Foram conferidos os seis GeoJSONs pelo parser real da interface e pelo estado de pontos, incluindo mover/exportar/desfazer/refazer, sem abrir o navegador. A validação dos artefatos conferiu 89 máscaras, consistência das camadas e conversão coordenada/pixel (erro inferior a 0,00001 pixel). Foram preservados os hashes de 106 arquivos de dados, resultados anteriores e interface. Detalhes em `validacao.json` e logs.

## Repetir o piloto

Dentro de `prototipo-01`, com o ambiente e o peso já preparados:

```powershell
.\scripts\detectron2-windows.ps1 -m backend.cambridge
```

Cada execução cria uma pasta nova. Parâmetros disponíveis: `--recorte`, `--janela-m`, `--sobreposicao`, `--iou`, `--cortes`, `--nota` e `--saida`. Exemplo para repetir somente o Centro:

```powershell
.\scripts\detectron2-windows.ps1 -m backend.cambridge --recorte centro --cortes 0.15 0.30 0.50
```

O comando falha explicitamente se CUDA ou o peso correto não estiver disponível. Não altera os dados originais ou camadas do navegador.

Para preparar novamente este ambiente, partir da [instalação Detectron2 validada](DETECTRON2_WINDOWS.md), instalar `requirements/requirements-detectree2-lock.txt` e depois `git+https://github.com/PatBall1/detectree2.git@39da1ba52e9392e54c2b29deef711f1b676bf86b` com `pip --no-deps`. Os dois projetos fonte são instalados separadamente das dependências fixadas. Baixar o peso pelo endereço de `backend/cambridge-model.json` para `.models/detectree2/`; o adaptador confere seu SHA-256 ao carregar. A versão Rasterio deste ambiente é 1.4.4, mantendo o NumPy 1.26.4 validado; o ambiente DeepForest continua separado.

O próximo marco aguarda sua revisão: comparar flexi e os controles, calibrar agregação/score com referência revisada e reservar áreas distintas para teste. Nenhum segundo peso ou API foi acrescentado nesta entrega.

## Origem dos pesos

Ball, James; Kotthoff, Christopher. *detectree2 trained models*. Zenodo, [doi:10.5281/zenodo.15863800](https://doi.org/10.5281/zenodo.15863800). O registro informa **CC BY 4.0** para os pesos. O código Detectree2 declara MIT. Arquivos pesados, ambientes e resultados gerados permanecem fora do Git. [Model garden oficial](https://github.com/PatBall1/detectree2/blob/39da1ba52e9392e54c2b29deef711f1b676bf86b/model_garden/README.md).

## Revisão do usuário e investigação dos casos 14/66

O usuário relatou menos propostas sobre telhados no Centro, omissões no Centro-norte e aceitou representar um conjunto visual inseparável de copas por um único ponto. Esse passa a ser o critério do protótipo para aglomerados; referências futuras precisam respeitar essa unidade, sem tratar automaticamente cada clique do mesmo conjunto como árvore omitida.

Os arquivos manuais atuais têm 65 pontos no Centro e 26 no Centro-norte, sem números exportados. Pela lista ainda aberta no navegador foram recuperadas as referências do Centro: ponto 14, aproximadamente `[-50.438835, -21.208315]`, e ponto 66, `[-50.43841481208802, -21.208270160302597]`. O primeiro usa a coordenada arredondada exibida na lista; o segundo foi associado ao ponto do arquivo por coordenadas. Os antigos números 66–89 do Centro-norte **não foram associados por suposição de ordem**; aguardam nova exportação com IDs/números.

Uma ablação isolada reutilizou um único modelo, RGB original, NMS global IoU 0,5, piso 0,05 e janelas de 200/100 m. Não modificou os defaults do comando, o piloto anterior ou os dados do usuário. Resultados: `resultados/revisao-usuario-20261105/score-escala/`; rastreio dos casos e comparação visual: `resumo-casos.json`, `casos.json`, `casos-centro-14-66.png` na pasta de revisão.

- **Ponto 66 / 200 m:** duas propostas mantidas cobrem o clique com scores 0,0963 e 0,0647. Portanto, o corte 0,15 explica sua ausência nessa configuração. Não foi perda pelo NMS global nem por HSV, que estava desligado. Os registros não inspecionam propostas anteriores ao NMS nativo.
- **Ponto 66 / 100 m:** aparecem propostas de até 0,1412 cobrindo o clique, ainda abaixo de 0,15. Reduzir a janela, sozinho, não recuperou esse clique no corte atual.
- **Ponto 14 / 200 m:** a proposta de aproximadamente 0,882 cobre a região; a sobreposição de outra janela é suprimida, restando uma máscara sobre esse clique. Com 100 m, duas propostas mantidas de aproximadamente 0,176/0,172 cobrem o mesmo clique, mostrando a importância de revisar agregação e recortes antes de adotar multiescala.
- **Centro-norte:** em 0,15, máscaras mantidas cobrem 9 dos 26 cliques manuais com 200 m e 15 com 100 m. Isso é uma verificação espacial exploratória, **não recall**: os pontos ainda podem incluir outros verdes e múltiplos cliques sobre um mesmo aglomerado. A inspeção da variante 100 m também mostrou proposta sobre um telhado e subdivisões adicionais.

O corte 0,05 gera 64 candidatos no Centro/31 no Centro-norte com 200 m; com 100 m, 138/77. Aproximar a contagem manual não valida essas configurações. O padrão continua 200 m/0,15 para o piloto; nenhum ajuste foi promovido automaticamente.

Próxima decisão após revisar os arquivos numerados: avaliar um complemento de escala/score com agregação por sobreposição e inclusão de máscaras, preservando um ponto por conjunto visual. Não unir somente por distância, pois isso pode combinar regiões que continuam visualmente separadas. Flexi e integração API continuam aguardando validação.
