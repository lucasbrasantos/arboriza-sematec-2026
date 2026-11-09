# Leitura rápida do acervo local

## O que mudou

O SQLite guarda o catálogo e o índice espacial RTree, não as imagens como BLOBs.
Os GeoTIFFs originais continuam em `data/ortofotos/acervo-urbano-25cm`.
O módulo compartilhado `backend/local_imagery.py` atende o Controle Local e a fusão
Restor + Cambridge. O Controle tradicional e o DataGEO direto conservam suas fontes.

O fluxo é:

1. No início da análise, inventariar arquivos e conferir tamanho/data de modificação e auxiliares de máscara, metadados e overviews.
2. Abrir metadados somente de TIFFs novos ou alterados. Nas próximas análises,
   recuperar limites do SQLite, inclusive após reiniciar a API.
3. Consultar o RTree para localizar os blocos que interceptam cada janela.
4. Procurar o recorte preparado pela identidade das fontes, limites, CRS, dimensões
   e versão do processamento. Uma mudança nesses parâmetros gera outro recorte.
5. Se faltar, ler apenas a área necessária. Grades nativas alinhadas usam leitura
   direta por janela; outras grades conservam reprojeção bilinear com WarpedVRT.
   Máscaras e precedência das fontes são preservadas nas emendas.
6. Salvar o recorte em GeoTIFF com máscara interna, sem DEFLATE, para reduzir CPU
   nas próximas leituras. O Controle lê esse arquivo diretamente, sem uma segunda
   cópia temporária. O mosaico inteiro não é carregado em RAM.
7. Executar a inferência normalmente. O cache de imagem não contém pontos.

Novos blocos são descobertos na próxima análise. Arquivos usados que mudarem durante
a vida de um leitor também têm sua revisão conferida antes de reutilizar a janela.
Os arquivos originais devem ser substituídos por arquivos finalizados; não editar
um TIFF enquanto uma análise o está lendo. O capturador já publica blocos finalizados.

## Armazenamento e acompanhamento

O catálogo e as janelas ficam em `.cache/acervo-local-v1/`, ignorado pelo Git.
A escrita das janelas usa arquivo temporário e substituição atômica.
O cache mantém até **10 GiB** de recortes derivados, descartando os menos recentemente
usados quando precisa de espaço. A janela recém-gerada é preservada mesmo se
sozinha exceder esse orçamento. Ortofotos originais não são removidas por essa rotina.
O limite é configurável no construtor de `LocalImages` (`limit_bytes`).

No Controle Local, `resumo.json` informa:

- `indexacao_acervo_s` e `metadados_acervo_atualizados`;
- `janelas_locais` e `janelas_cache_acervo` (recortes preparados reutilizados);
- `preparacao_imagens_s`, `leitura_local_total_s` e `inferencia_total_s`;
- hashes RGB/validade e medições por janela, incluindo `cache_janela_local`.

A interface distingue os recortes reutilizados e informa que a inferência foi
executada nessa análise. `janelas_cache` continua significando o cache WMS anterior.
A fusão também usa o leitor otimizado, mas conserva seu cache separado de máscaras
de inferência: uma reutilização de imagem e uma reutilização de inferência são coisas
diferentes. O cache de máscaras não foi alterado nesta etapa.

Para testar na interface: reiniciar a API, recarregar a página e executar duas vezes
o mesmo recorte com **Controle · Acervo local** e o mesmo score. A segunda execução
deve indicar recortes prontos reutilizados. A primeira carga dos pesos e o aquecimento
da GPU continuam podendo aumentar bastante o tempo total.

## Medição real no Centro

Com os 523 blocos e nove janelas de 800 × 800 pixels:

| Medição | Antes | Depois, recortes preparados |
|---|---:|---:|
| Índice das fontes | cerca de 2,12 s | 0,23–0,26 s |
| Preparação completa das imagens na análise | 1,641 s | 0,219–0,229 s |
| Análise completa, modelo carregado | 4,816 s | 1,215–1,222 s |
| Candidatos | 29 | 29 |

São execuções locais, não uma garantia de duração. A primeira criação do catálogo
novo ainda abriu os 523 TIFFs: 2,371 s. Criar os nove recortes pela primeira vez levou
1,150 s; relê-los no benchmark isolado levou cerca de 0,215 s. As nove imagens e máscaras
foram idênticas, por SHA-256, às da análise anterior à otimização.

Na execução com processo novo, carregar Cambridge custou 7,114 s e o total foi
10,123 s. As duas execuções seguintes, na mesma instância, levaram 1,215 s e 1,222 s,
com inferência nova de 0,502–0,518 s e nove recortes reutilizados.

Evidências locais, ignoradas pelo Git:
`resultados/otimizacao-acervo/preparacao-final.json` e `analises-final.json`, além dos diretórios
de cada análise contendo os pontos, configuração e resumo.

Testes cobrem catálogo após reiniciar o leitor, invalidação por mudança na fonte,
novos blocos/remoção, grades diferentes, igualdade com WarpedVRT nas emendas e
máscaras, descarte dos derivados e inferência nova mesmo com recorte reutilizado.
Não houve novo download do acervo, reinício da API do usuário ou mudança no fundo
do mapa nesta etapa.
