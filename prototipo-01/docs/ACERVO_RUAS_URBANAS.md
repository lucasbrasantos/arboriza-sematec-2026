# Base viária local para os 499 setores urbanos

O escopo é a união dos setores urbanos de Araçatuba da malha IBGE já usada no
projeto, incluindo núcleos isolados. Não é uma tentativa de mapear toda a área
rural do município. A malha contém 499 setores e sua união tem cerca de 77,99 km².

## Dados e métricas

O OpenStreetMap fornece os eixos das vias, nomes, classes e outras tags disponíveis.
Ele não fornece as contagens de copas ou a classificação dos trechos mostrada no
Arboriza. O diagnóstico continua calculando localmente as associações aos pontos
atuais da camada, as taxas por 100 m e o entorno geométrico parcial/completo.

Os eixos são obtidos com uma consulta de leitura Overpass, usando os mesmos tipos
viários do piloto. Isso não baixa imagens, não executa IA e não usa a API de edição
OSM para fazer centenas de consultas por setor. Classes novas, como caminhos de
pedestres, não foram acrescentadas silenciosamente às regras existentes.

Referências: [API Usage Policy](https://operations.osmfoundation.org/policies/api/)
e [Overpass: Commons](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).

## Aquisição, filtragem e índice

1. Projetar a união dos setores para EPSG:31982 e adicionar 50 m de contexto.
2. Consultar uma caixa que contenha essa região, solicitando geometrias completas
   dos objetos OSM `way`. A resposta pode conter vias entre os núcleos isolados.
3. Filtrar localmente: guardar somente vias que interceptam a união com o contexto.
   Um objeto retido conserva sua geometria completa; o diagnóstico o recorta depois.
4. Projetar as geometrias uma vez e guardar WKB métrico no SQLite, com ID OSM único.
5. Guardar extents em RTree e pré-calcular os vínculos dos eixos com cada setor.
   O diagnóstico usa a chave composta indexada setor/via, lê só os eixos relevantes
   e elimina duplicações quando uma via cruza mais de um setor selecionado.
6. Reutilizar até 64 seleções de base geométrica em memória. Tamanho/data de
   modificação do banco invalidam essa memória quando o acervo é substituído.

As associações aos pontos **não** ficam nesse cache. Editar/excluir pontos muda o
diagnóstico seguinte, mesmo que a base viária já esteja na memória.

O banco fica em `data/ruas/acervo-urbano-osm/ruas.sqlite3`, com resposta original,
hash SHA-256, consulta, data do OSM, data de coleta e manifesto no mesmo diretório.
Tudo isso está sob `data/`, ignorado pelo Git. Os metadados conferem a versão da
malha e todos os setores solicitados. Uma atualização só publica o novo SQLite
depois de concluir a indexação e o teste de integridade. Respostas parciais/erros
preservam o banco anterior. A captura tem limite de resposta de 128 MiB.

Se não houver catálogo urbano instalado, as três amostras antigas continuam como
fallback do piloto. Um catálogo presente mas incompatível com a malha gera erro,
sem ocultar o problema usando amostras antigas. A interface identifica a base como
**OSM local** ou **Piloto** conforme a resposta efetivamente utilizada.

## Custo e medição real

A aquisição autorizada desta etapa fez uma consulta externa:

| Item | Medição |
|---|---:|
| Objetos viários recebidos na caixa | 6.247 |
| Resposta JSON descompactada | 4,56 MiB |
| Tempo de aquisição | 39,08 s |
| Eixos retidos no entorno urbano | 5.314 |
| Eixos que cruzam os setores | 5.155 |
| Vínculos setor/via | 8.796 |
| Setores sem eixo cadastrado cruzando a área | 0 de 499 |
| Tamanho do SQLite | 2,08 MiB |
| Tempo total de captura e indexação | 40,33 s |

Um objeto OSM pode representar parte de uma rua: 5.314 eixos não significa
5.314 ruas distintas por nome. Ter eixos nos 499 setores também não comprova
que o cadastro OSM representa todas as ruas reais, suas calçadas ou acessibilidade.

Leitura da base geométrica, na máquina desta execução:

| Seleção | Eixos retornados | Primeira leitura | Mediana de 5 repetições |
|---|---:|---:|---:|
| Setor 350280405000001 | 22 | 1,56 ms | 0,40 ms |
| Setor 350280405000005 | 15 | 1,31 ms | 0,32 ms |
| Todos os 499 setores | 5.155 | 154,14 ms | 0,40 ms |

Esses tempos medem somente a obtenção das geometrias, não o diagnóstico de toda
a cidade. No teste HTTP com os 125 pontos reais do v2 no setor 350280405000001,
o diagnóstico completo gerou 42 trechos em 76 ms na primeira chamada e 25 ms na
segunda. Conservação de contagens foi conferida: associados + sem via próxima +
fora do setor = pontos enviados. A API não executou novamente as IAs nem buscou
imagens. O mapa de fundo continua independente e pode consultar DataGEO/OSM.

Evidências: `resultados/base-ruas/medicoes.json`, `diagnostico-setor-v2.json` e
`catalogo-local.jpg`. As durações dependem da máquina, seleção e carga do servidor.

## Uso e atualização

Depois de reiniciar a API e recarregar a página, uma camada com análise territorial
vinculada pode usar **Analisar ruas próximas** em qualquer dos 499 setores.
Continua sendo necessário ter os pontos e o resumo da análise disponíveis. Não é
preciso refazer a detecção de árvores para ampliar somente a base viária.

Dentro de `prototipo-01`, para reutilizar a resposta já baixada e reconstruir o índice:

```powershell
.\.envs\detectree2\Scripts\python.exe -B -u .\scripts\preparar_ruas_urbanas.py
```

Para buscar uma versão nova do OSM e substituir o catálogo apenas ao concluir:

```powershell
.\.envs\detectree2\Scripts\python.exe -B -u .\scripts\preparar_ruas_urbanas.py --atualizar
```

Há logs de aquisição, bytes recebidos, filtragem/indexação e resumo final.
Em falha do serviço, executar novamente permite reaproveitar uma resposta local
completa e validada quando disponível. Não há atualização automática a cada análise.

## Limites preservados

Esta etapa amplia e acelera a base viária. Mantém o cálculo dos trechos e seus
parâmetros; não introduz novas IAs, cores de prioridade ou posições de plantio.
Eixos de rua não comprovam existência/largura de calçada ou disponibilidade para
plantar. As camadas v2 de indivíduos, grupos e complementos continuam separadas.

Validação: 76 testes Python e 33 JavaScript, consulta HTTP com pontos v2 reais e
conferência do painel no navegador, identificado como OSM local, sem erros JS.
