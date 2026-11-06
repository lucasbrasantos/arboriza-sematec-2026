# Fontes de imagens e teste de múltiplas escalas

Pesquisa em 05/11/2026, com execução terminada em 06/11 UTC / 05/11 no horário de São Paulo. Nenhuma fonte nova foi integrada à interface ou enviada ao detector nesta rodada. As inferências usam os mesmos dois rasters IGC e os pesos Cambridge locais.

## O que significam 100 m e 200 m

São as dimensões físicas aproximadas de cada janela enviada à rede. O raster mantém sua resolução; muda o enquadramento.

| Configuração observada | 200 m | 100 m |
|---|---:|---:|
| Janela no raster | 821 × 770 pixels | 411 × 385 pixels |
| Entrada efetiva da rede, altura × largura | 800 × 853 | 800 × 854 |
| Janelas por recorte | 4 | 16 |

A mesma copa aparece aproximadamente duas vezes maior em cada dimensão na entrada da rede quando a janela passa a 100 m. Há menos contexto e mais inferências. A interpolação não acrescenta detalhe capturado. Copas e bordas também ficam em posições diferentes nas janelas. Portanto, uma escala pode recuperar um caso e perder outro.

Figura: [`explicacao-escalas.jpg`](../resultados/rodada-multiescala/20261106T010056Z-a8776f/explicacao-escalas.jpg). Os números acima foram medidos nas execuções, não são uma especificação universal do modelo.

## DataGEO: camada IGC e fundo Satélite são imagens distintas

A camada que analisamos é **ORTOFOTOS_SP_2023_2024**, com resolução nativa declarada de 25 cm e composição RGB natural. Os nossos arquivos são renderizações PNG do WMS, posteriormente georreferenciadas/reprojetadas; não são os GeoTIFFs originais do levantamento. O manifesto local confirma GetMap PNG 1024 × 1024, raster final 1066 × 980 e aproximadamente 0,244 × 0,260 m/pixel. RGB16 de teste não adiciona detalhe: foi gerado do RGB8. [Metadados oficiais IGC](https://datageo.ambiente.sp.gov.br/geoportal/catalog/search/resource/details.page?uuid=%7B7665C108-A2FF-49D8-A1EF-A6968BA6016A%7D).

O site DataGEO é um visualizador com diferentes mapas de fundo. A configuração pública consultada define **Satélite como Google Satellite** e Híbrido como Google Hybrid. Assim, os créditos Airbus/Maxar relatados pelo usuário são compatíveis com outro fundo, e não demonstram que se trata da mesma ortofoto IGC. A configuração foi lida como texto/JSONP, sem executar seu código e sem reutilizar credenciais. [Visualizador](https://datageo.ambiente.sp.gov.br/app/), [configuração pública](https://datageo.ambiente.sp.gov.br/core/rest/config?ctx=DATAGEO).

O crédito “©2026” não confirma sozinho a data de captura da imagem. Imagens podem formar mosaicos e a data de aquisição exige metadados do trecho. [Explicação oficial do Google sobre datas e fornecedores](https://support.google.com/earth/answer/6327779?hl=en).

Uma aparência mais nítida/saturada pode resultar de outra aquisição, condições de iluminação, sensor ou processamento de cor. Essas são hipóteses para a diferença visual; ainda não executamos comparação do detector entre essas imagens.

Os termos padrão Google Maps Platform restringem extração de conteúdo fora dos serviços e seu uso para treinar, testar, validar ou ajustar modelos. A exibição no portal não entrega automaticamente uma licença de raster para este experimento. O caminho a avaliar é obter uma imagem autorizada diretamente do fornecedor, ou uma ortofoto pública adequada. [Termos, seção 3.2.3](https://cloud.google.com/maps-platform/terms). Não foram baixados tiles Google nem executada IA sobre eles.

## Copernicus: distinguir o portal da coleção

O link enviado seleciona **Sentinel-2 L1C / True Color**. Essa coleção tem RGB e NIR a 10 m/pixel; outras bandas têm 20/60 m. Não constitui substituição de maior detalhe para o raster atual. Uma copa de 5 m teria cerca de 20 pixels de diâmetro a 25 cm, mas apenas meio pixel a 10 m: cálculo de escala, não limite absoluto de detectabilidade. [Instrumento Sentinel-2](https://sentiwiki.copernicus.eu/web/s2-mission).

O dia 20/10/2026 na URL é um intervalo de busca/visualização. Não foi confirmada nesta pesquisa uma cena sem nuvens cobrindo esses recortes nesse dia; a data do produto precisa ser conferida separadamente.

Para vegetação, a banda adicional relevante é sobretudo o **infravermelho próximo (NIR)**. NDVI combina NIR e vermelho; não é simples saturação e não identifica isoladamente árvore, gramado ou arbusto. A falsa cor pode representar essas bandas em canais visíveis. [NDVI e bandas B08/B04](https://custom-scripts.sentinel-hub.com/custom-scripts/sentinel-2/ndvi/).

Para análise espectral, preferir **L2A**, com correção atmosférica e reflectância de superfície, conferindo nuvens, sombras, máscaras e os offsets radiométricos. L1C fornece reflectância no topo da atmosfera. [Produtos Sentinel-2](https://sentiwiki.copernicus.eu/web/s2-products). O Browser permite download analítico de bandas/GeoTIFF; não é necessário limitar o trabalho a uma captura de tela. [Download analítico](https://documentation.dataspace.copernicus.eu/Applications/Browser.html#image-download).

Uso proposto no Arboriza: vegetação por bairros, parques e mudanças temporais, como camada complementar. Esse dado de 10 m não resolve a localização de cada árvore de calçada. Outras coleções no ecossistema Copernicus podem ter resolução/acesso diferentes; as conclusões acima referem-se ao Sentinel-2 do link enviado.

O Cambridge atual usa três canais RGB, convertidos para BGR pelo adaptador. Substituir esses canais por NDVI/falsa cor muda o domínio de entrada. Um benefício precisaria de experimento separado ou de outro modelo/fusão de sinais, não pode ser pressuposto.

## Outras opções e disponibilidade verificada

| Fonte | O que foi confirmado | Uso e pendência para Araçatuba |
|---|---|---|
| IGC: raster original | A camada atual declara 25 cm e RGB. | Manter controle e investigar acesso ao produto original/folha e data exata; não pressupor NIR disponível. |
| Airbus Pléiades Neo / OneAtlas | Produto de 30 cm; catálogo com opções de aquisição e download; canal de projetos acadêmicos. | Boa opção para solicitar amostra autorizada dos mesmos recortes. Cobertura, preço, data e concessão acadêmica ainda não foram confirmados. |
| Vantor/WorldView, anteriormente Maxar | Hub oferece catálogo, download/streaming e produtos de 30 cm. | Alternativa comercial a consultar. Não garante a mesma cena mostrada pelo Google. |
| Esri World Imagery / Wayback | Há metadados consultáveis por posição; regras próprias de uso/exportação. | Serve para procurar alternativas e datas, sujeito às permissões do produto escolhido. Ver consulta local abaixo. |
| Planet SkySat | Produtos ortorretificados amostrados a 50 cm, incluindo RGB e multiespectrais. | Alternativa de aquisição/atualidade; resolução nominal não supera os 25 cm atuais. Acervo local não confirmado. |
| INPE CBERS-4A / WPM | PAN 2 m e multiespectral 8 m. | Alternativa pública para contexto regional; menos indicada que as ortofotos para pequenas copas urbanas. |
| Ortofoto local/drone | Proposta de buscar produto real em 5–10 cm, com metadados e autorização. | Não localizamos nesta pesquisa um arquivo público dessa resolução para os dois recortes; aquisição/parceria seria necessária. |

Fontes: [Airbus Pléiades Neo](https://space-solutions.airbus.com/imagery/our-optical-and-radar-satellite-imagery/pleiades-neo/), [OneAtlas APIs e aquisições](https://api.oneatlas.airbus.com/getting-started/apis-overview/), [Airbus acadêmico](https://space-solutions.airbus.com/contact-us/academic-project/), [Vantor Hub](https://vantor.com/product/platform/hub/), [Esri metadados](https://support.esri.com/en-us/knowledge-base/how-to-view-the-world-imagery-basemap-metadata-in-arcgi-000018129), [Esri exportação](https://www.arcgis.com/home/item.html?id=226d23f076da478bba4589e7eae95952), [Planet SkySat](https://docs.planet.com/data/imagery/skysat/), [INPE](https://data.inpe.br/dados/).

Uma consulta pontual da Esri nos dois recortes retornou **Vivid/Vantor, captura declarada 11/12/2025, resolução 0,34 m, acurácia declarada 5 m**, bloco `Vivid_Standard_BR26_26Q1`, publicação `Raster Basemaps 2026.R05`. O registro informa níveis 12–17; não é confirmação da fonte em qualquer nível de zoom, da cena Google, nem da imagem mais nítida existente. As camadas de metadados 9/10 não retornaram registros para o ponto consultado. [Registro consultado](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/0/query?f=pjson&where=OBJECTID%3D1872835&outFields=SRC_DATE%2CSRC_RES%2CSRC_ACC%2CNICE_NAME%2CNICE_DESC%2CMinMapLevel%2CMaxMapLevel%2CBlockName%2CReleaseName&returnGeometry=false).

“Mais recente” e “maior resolução” são critérios separados. Mesmo a imagem comercial de 30–34 cm pode ser visualmente superior em alguma região por contraste/iluminação, mas não ganha resolução nominal sobre 25 cm. Só um teste A/B verifica o efeito no detector.

## Liberdade de fonte com estrutura simples

Proposta para a integração futura: distinguir **fundo do mapa** e **imagem da análise**. O primeiro ajuda na navegação; o segundo deve ser um raster autorizado com CRS, data, GSD, identificação e hash. O Leaflet pode continuar na interface. Uma entrada GeoTIFF acompanhada de metadados permite testar diferentes fornecedores sem trocar o detector a cada origem. Não foram implementados novos seletores/adaptadores nesta entrega.

Comparação de fonte proposta: obter uma amostra licenciada do mesmo local; conferir alinhamento, nuvens/sombras, data e resolução; revisar árvores que mudaram entre datas; executar a mesma configuração em A/B; só depois testar variantes moderadas de cor. Nitidez aparente ou mais candidatos não bastam. NIR precisa ser uma banda medida e alinhada, não um filtro inventado sobre RGB.

## Nova rodada executada: 200/100 m e máscaras

Pasta: [`20261106T010056Z-a8776f`](../resultados/rodada-multiescala/20261106T010056Z-a8776f/). São 40 janelas novas, uma instância Cambridge na RTX 5070 e piso 0,15 em todas as inferências. Nada foi instalado/baixado em pesos. Máscaras após o NMS nativo foram preservadas antes da agregação experimental.

A regra inicial conserva propostas em ordem de score e suprime sobreposição de máscara **IoU ≥ 0,5 OU interseção/área menor ≥ 0,9**. Na combinação, conserva as máscaras primárias de 200 m e acrescenta propostas de 100 m que passam pela agregação. Esses limiares são experimentais. Uma ablação CPU desativou apenas a contenção, reutilizando as mesmas inferências; não foi feita nova inferência para ajustar contagens.

| Variante, score ≥ 0,15 | Centro: candidatos / cliques cobertos | Norte: candidatos / cliques cobertos |
|---|---:|---:|
| Controle 200 m, NMS de caixas | 33 / 30 | 12 / 12 |
| 200 m, máscaras + contenção | 31 / 29 | 12 / 12 |
| 100 m, máscaras + contenção | 51 / 38 | 26 / 15 |
| 200 + 100 m, máscaras + contenção | 54 / 43 | 32 / 21 |
| 200 m, somente IoU de máscaras | 32 / 30 | 12 / 12 |
| 200 + 100 m, somente IoU de máscaras | 66 / 44 | 35 / 23 |

“Cliques cobertos” verifica se o ponto manual pertence a alguma máscara mantida. São 64 e 36 cliques mistos, ainda sem referência completa/revisada e sem consolidação dos conjuntos de copas. A tabela não mede precisão, recall nem número verdadeiro de árvores.

### Evidências

- A duplicação do **Centro 4** foi removida pelas duas regras de máscaras. A copa escura **Centro 12** permaneceu. **Centro 13 continua ausente em 0,15**, mesmo com ambas as escalas; a rodada anterior mostrou propostas abaixo desse corte.
- A regra de contenção removeu a proposta que cobria o **Centro 37**. Ela tinha IoU de máscara 0,3470 e interseção/área menor 0,9789 com a proposta mantida. Desativar a contenção recupera a cobertura desse clique. Isso identifica o efeito do filtro, mas a referência precisa definir se ambas representam o mesmo conjunto visual.
- A variante combinada somente com IoU preservou todos os cliques cobertos pelo controle e acrescentou cobertura de 14 cliques no Centro e 11 no Norte. No Norte: **68, 69, 70, 73, 82, 86, 88, 89, 92, 98, 100**.
- Persistem propostas sobre construções e subdivisões/possíveis duplicações em regiões de copas. Ausência de clique manual não confirma falso positivo; os exemplos visuais precisam ser classificados.
- O trade-off ficou explícito: a contenção reduz propostas, mas pode eliminar cobertura desejada; somente IoU preserva mais propostas, mas pode repetir partes da mesma copa. Nenhuma regra foi promovida a padrão.

### Funcionamento, arquivos e reprodução

Carga do modelo: 1,61 s. Processamento por recorte/escala: Centro 200 m 17,44 s; Centro 100 m 1,34 s; Norte 200 m 0,53 s; Norte 100 m 1,11 s. A primeira chamada concentra custo inicial; a GPU era compartilhada com o desktop. Pico PyTorch 567 MiB alocados / 856 MiB reservados, sem erro de memória. Agregação medida separadamente em CPU. Isso não mede toda a VRAM nem é benchmark entre fontes.

Foram validados 17 testes Python, incluindo sobreposição, contenção, máscaras disjuntas, offsets, preservação de âncoras e ablação da contenção. Todos os pontos exportados foram conferidos contra a transformação do raster, a máscara de validade e seus IDs/scores; GeoJSONs também foram conferidos com o parser da interface. Os dados originais permanecem no local.

- `comparacao-*.jpg`: seis variantes com os mesmos cliques numerados, amarelo para cobertura pela máscara do painel e rosa para ausência de cobertura. Caixas verdes e pontos azuis são candidatos.
- `revisao-manual.json` e `revisao-pontos.csv`: associação por número, ganhos/perdas e possíveis duplicações.
- `*-c0.15.geojson`: camadas para importação manual; `*-c0.15.json`: mantidos, descartes, vínculo da supressão e medidas de sobreposição.
- `cambridge-*-t*m.json`, configurações e RLE: inferências de origem, tempos, memória, hashes, parâmetros e versões.
- `execucao.json`: manifesto da inferência. `ablacao-contencao.json`: manifesto separado da ablação CPU, com hashes dos scripts correspondentes.

Dentro de `prototipo-01`, repetir o experimento inicial com:

```powershell
.\scripts\detectron2-windows.ps1 -m backend.multiscale
.\.envs\detectree2\Scripts\python.exe -m unittest tests.test_multiscale tests.test_cambridge tests.test_analysis
```

O comando gera nova pasta, preservando as anteriores. Os scripts `avaliar.py`, `ablar_contencao.py` e `explicar_escalas.py` estão junto aos resultados desta rodada e registram a reprodução da comparação, da ablação e da figura. Para reproduzir a rodada arquivada, executar a ablação antes de `avaliar.py`; nenhum desses scripts de pós-processamento usa a GPU. Resultados, logs e scripts gerados nessa pasta permanecem ignorados pelo Git.

## Próxima decisão

Revisar a variante combinada somente com IoU junto com os exemplos de duplicação/aglomerados e os falsos positivos, sem adotá-la automaticamente. Para comparar imagens, priorizar acesso a uma amostra original/autorizada IGC ou Airbus/WorldView dos mesmos locais. Copernicus Sentinel-2 fica como complemento de vegetação regional; novas fontes e índices ainda precisam de teste A/B. A interface aprovada continua preservada.
