# Três perfis Controle e correção da borda do Centro

## Escolhas aprovadas

| Perfil | Origem das imagens |
|---|---|
| Controle · 200 m | Comportamento atual preservado: GeoTIFF original para recortes; cache WMS com download quando faltar para setores |
| Controle · DataGEO direto | Cada janela é baixada novamente; não consulta nem preenche o cache WMS |
| Controle · Acervo local | Somente os novos GeoTIFFs de `data/ortofotos/acervo-urbano-25cm`, sem download nem fallback WMS |

Restor + Cambridge e Multiescala permanecem disponíveis. A alteração não muda as imagens de fundo do mapa nem inicia o capturador. O manifesto local foi conferido: 523/523 blocos concluídos, sem falhas registradas na captura.

## Como comparar

1. Reinicie o servidor da API e recarregue a interface do laboratório `prototipo-01`.
2. Escolha o mesmo recorte, por exemplo Centro, e o mesmo corte de score.
3. Execute Controle · DataGEO direto e depois Controle · Acervo local. Cada execução cria sua própria camada e diretório de resultados.
4. Compare `resumo.json`: fonte, quantidade de janelas, tempo de preparação das imagens, download, leitura local, inferência e carregamento do modelo. As medições de cada janela incluem origem, dimensões, limites, CRS e hash dos pixels/validade.
5. A interface informa se as janelas foram baixadas sem cache ou lidas do acervo. O indicador geral inclui a carga do modelo, quando ela ocorrer; para comparar aquisição, use `preparacao_imagens_s` e `download_total_s`.

Os dois perfis novos funcionam tanto com recortes quanto com setores e compartilham o mesmo processamento: Cambridge, mesmo peso/configuração, limite original de 100 detecções, score, janelas de 200 m, passo de 150 m e deduplicação. A grade de comparação é **EPSG:31982 a 25 cm/pixel**, com 800 × 800 pixels por janela. A consulta DataGEO usa essa mesma grade e a leitura local preserva a grade do acervo, evitando uma reprojeção intermediária para coordenadas geográficas.

O Controle atual não foi reescrito para essa comparação. Nos recortes originais, seu planejamento anterior é relativo à imagem; os perfis novos usam a grade territorial comum. Por isso, a comparação que isola a fonte é entre **DataGEO direto e Acervo local**, sem presumir que todos os três terão necessariamente a mesma contagem de candidatos.

Mesmo com geometria e parâmetros iguais, respostas do serviço e pixels locais podem variar por processamento/reamostragem do WMS. Quantidade de pontos por si só não mede precisão. A GPU também pode demorar mais na primeira inferência; diferencie aquecimento, aquisição e processamento.

## Correção do erro na fusão do Centro

O erro `Acervo local incompleto na janela restor/5814/79734` foi reproduzido com o GeoTIFF original do Centro, independentemente da conclusão do novo acervo. Havia uma divergência de 1 pixel nessa janela e 2 pixels em outra: o contorno geográfico do raster, transformado para UTM apenas pelos vértices originais, incluía pontos de amostragem levemente fora da borda real do raster.

A solução densifica a borda geográfica antes da reprojeção, em passos de no máximo 0,00001 grau. Isso aproxima a curva projetada com precisão suficiente para a grade de 25 cm. Não foi adotada uma tolerância cega de pixels nem desativada a checagem de validade. Uma falha real na região necessária continua interrompendo a análise.

A fusão do recorte Centro continua usando o raster original desse recorte, agora com o contorno corrigido. A fusão por setores continua consultando o acervo e as demais fontes locais existentes. O novo Controle Local lê explicitamente só o acervo recém-baixado.

## API e implementação

Os IDs dos novos perfis são `controle-datageo` e `controle-local`, aceitos em `POST /api/analises` e `POST /api/analises/setores`. O ID `controle` mantém seu significado anterior e continua sendo o padrão.

`control_sources.py` fornece as duas origens. Ambas passam pelo mesmo `run_sector_analysis`, com grade métrica habilitada apenas nos perfis novos. A aquisição WMS aceita EPSG:31982 em coordenadas leste/norte; seu modo padrão EPSG:4674 conserva a ordem de eixos latitude/longitude do WMS 1.3.0. O arquivo de configuração e o hash do peso ficam registrados para a comparação.

O acervo é lido em janelas, com índice espacial. O perfil local usa uma requisição interna de leitura da grade, não a transferência do mosaico inteiro ao navegador. O cache WMS existente não é apagado, sobrescrito nem consultado por esses dois perfis novos.

## Verificações

- Regressão sintética do raster Centro com suas dimensões e limites reais: reproduziu a divergência antiga e conferiu ausência de pixels exigidos fora da cobertura após a correção.
- Teste offline das fontes: local sem rede/cache WMS; DataGEO simulado repetido faz uma nova aquisição; grade, dimensões, parâmetros e pixels sintéticos idênticos.
- Contrato HTTP e interface: os perfis novos são aceitos para setores e o resultado identifica a fonte usada.
- O download completo do acervo não foi repetido. Os testes reais usam apenas as janelas do recorte Centro.

Na validação real pela API, a fusão do Centro concluiu com 70 propostas individuais, 1 grupo e 9 complementos pendentes, usando o raster original com a borda corrigida. O resultado está em `resultados/comparacao-fontes/20261107T225029Z/20261107T225057Z-4ef63adf/`.

Após alinhar os Controles novos à grade UTM, o teste real com GPU previamente aquecida gerou:

| Fonte | Janelas | Candidatos | Preparação das imagens | Inferência |
|---|---:|---:|---:|---:|
| Acervo local | 9 | 29 | 1,553 s | 0,629 s |
| DataGEO direto | 9 | 29 | 11,689 s | 0,502 s |

Os hashes de RGB e validade foram **idênticos nas 9 janelas**. O DataGEO registrou 9 downloads e nenhuma reutilização de cache; o Local registrou 9 leituras locais e nenhum download. São medições desta execução, sem garantia de duração para outras regiões. A preparação inclui aquisição/leitura, validação e arquivos temporários; a indexação inicial das fontes e o carregamento do modelo também podem afetar a duração total apresentada pela API.

Relatório da comparação: `resultados/comparacao-fontes-utm/20261107T225437Z/comparacao.json`.

A otimização posterior adiciona catálogo SQLite/RTree e cache limitado de recortes preparados, mantendo inferência nova no Controle. Consulte [OTIMIZACAO_ACERVO_LOCAL.md](OTIMIZACAO_ACERVO_LOCAL.md) para arquitetura, medições e teste.
