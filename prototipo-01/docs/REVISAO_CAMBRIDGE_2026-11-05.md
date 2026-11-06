# Cambridge — revisão dos novos pontos manuais

Rodada de 05/11/2026, posterior à exportação com IDs e números estáveis. Objetivo: investigar omissões e duplicações; não medir precisão/recall de árvores.

## Entradas e execução

- Centro: `data/arboriza-pontos_centro_2026-11-05_17-17-15.geojson`, 64 pontos, números 1–63 e 65.
- Centro-norte: `data/arboriza-pontos_centro-norte_2026-11-05_17-21-23.geojson`, 36 pontos, números 66–101.
- Todos os 100 pontos têm ID e número únicos na sua camada, ficam dentro do raster e sobre pixels válidos. Os arquivos originais foram preservados; hashes estão no JSON comparativo.
- Os pontos continuam com `revisado: false`, sem distinguir árvores, arbustos e outros verdes. Não são uma referência completa de árvores individuais. Um conjunto inseparável de copas pode representar uma unidade, conforme o critério aceito pelo usuário.
- Duas execuções novas e sequenciais, com pesos Cambridge já instalados e conferidos por hash: controle com piso 0,15; diagnóstico com piso 0,05. Ambas usam RGB8 original, janelas de 200 m, sobreposição nominal 25%, NMS global de caixas IoU 0,5, sem HSV ou realce da imagem. Configuração, versões, máscaras, caixas e scores estão arquivados por execução.
- A execução controle reproduziu exatamente as caixas, scores e coordenadas do piloto anterior em 0,15. Os candidatos em 0,15 derivados do diagnóstico também foram idênticos. Nenhum parâmetro padrão foi alterado.

Pasta da rodada: [`resultados/revisao-exportados-20261105/`](../resultados/revisao-exportados-20261105/).

## Comparação espacial

“Clique coberto” significa que o pixel do ponto manual pertence a pelo menos uma máscara mantida. É uma verificação de localização, não uma correspondência validada entre árvores. Um clique fora de uma máscara pode estar na borda da mesma copa; vários cliques podem pertencer a um único conjunto.

| Medida | Centro | Centro-norte |
|---|---:|---:|
| Cliques manuais | 64 | 36 |
| Candidatos automáticos, 200 m / 0,15 | 33 | 12 |
| Cliques cobertos por essas máscaras | 30 | 12 |
| Candidatos automáticos, 200 m / 0,05 | 64 | 31 |
| Cliques cobertos por essas máscaras | 44 | 20 |
| Cliques adicionais cobertos ao baixar o corte | 14 | 8 |

O diagnóstico inclui dez candidatos no Centro e seis no Centro-norte cujas máscaras não contêm nenhum clique manual. Isso não comprova falsos positivos: pode haver árvores não marcadas, deslocamentos dos cliques ou subdivisões da mesma copa. A inspeção encontrou, contudo, uma proposta sobre um telhado no Centro-norte, score aproximadamente 0,099. Chegar a 64 candidatos no Centro não equivale a acertar os 64 pontos manuais.

Foi feita também associação 1:1 de máxima cardinalidade por distância, com preferência por vizinhos. Os raios exploratórios de 3/5/8 m produzem 30/31/31 pares no Centro e 11/11/12 no Centro-norte. Não são limites calibrados nem métricas de acerto; os pares e os elementos sem associação estão no JSON.

## Casos identificados pelos números novos

| Caso | Evidência nesta rodada | Interpretação e limite |
|---|---|---|
| Centro 12 | Máscara mantida, score 0,882; cobre a copa escura conhecida. | Está detectada no controle. |
| Centro 13 | Duas máscaras mantidas no diagnóstico, scores 0,0963 e 0,0647; nenhuma chega a 0,15. | O corte remove propostas dessa região; baixar o corte também introduz duplicações. |
| Centro 4 | Duas máscaras mantidas no controle; uma toca a borda da janela. Interseção / área da menor máscara = 91,35%; IoU das máscaras = 0,5204. | Forte caso de duplicação por janela para revisão; o NMS atual usa caixas, não essas máscaras. |
| Centro 26 | O diagnóstico contém uma máscara cobrindo o clique, score 0,0562, suprimida pelo NMS global. | Caso localizado de perda de cobertura na agregação; o corte 0,15 também a excluiria. |
| Norte 66, 76, 77, 79, 81 | Há máscaras mantidas em 0,15 cobrindo esses cliques. | O número novo permite resolver relatos anteriores sem presumir a ordem de arquivos antigos. |
| Norte 71 e 88 | Propostas mantidas com scores 0,0984 e 0,0840. | Abaixo do corte; o filtro HSV não participa dessa perda. |
| Norte 68, 69, 70 e 89 | Sem máscara cobrindo os cliques em 200 m, mesmo com piso 0,05. | O resultado não permite separar propostas abaixo de 0,05, NMS interno, escala e limitação do modelo. A saída arquivada de 100 m cobre esses cliques em 0,15. |
| Norte 82–85 | O clique 83 está coberto no controle; 82, 84 e 85 ficam fora da máscara. | Como o usuário aceita um ponto por conjunto inseparável, revisar o grupo antes de contar três árvores omitidas. |
| Norte: telhado | Caixa mantida no diagnóstico, score 0,0988; região de telhado visível na imagem. | Exemplo de falso positivo visual a revisar; ainda não permite estimar precisão global. |

As posições antigas citadas como Centro 14/66 ficam próximas dos novos pontos 12/13 (aproximadamente 0,22/0,69 m). A numeração válida para esta revisão é a dos arquivos novos. Não se deve transferir os números antigos automaticamente.

## Escala: comparação reaproveitada, sem nova inferência de 100 m

Reavaliamos a saída de `resultados/revisao-usuario-20261105/score-escala/` com os novos 100 cliques. O hash das imagens foi conferido. Esse experimento antigo usou piso 0,05 e permite derivar a camada 0,15. A saída de 200 m / 0,15 foi conferida contra o controle novo. Esta comparação mede sensibilidade à janela, não desempenho temporal entre rodadas.

| Saída arquivada 100 m / 0,15 | Centro | Centro-norte |
|---|---:|---:|
| Candidatos | 54 | 29 |
| Cliques cobertos | 38 | 19 |
| Cliques cobertos que faltam no controle 200 m | 14 | 11 |
| Cliques cobertos em 200 m que deixam de estar cobertos | 6 | 4 |

No Centro-norte, os recuperados são 68, 69, 70, 73, 82, 86, 88, 89, 92, 98 e 100. Os perdidos são 76, 77, 79 e 91. Logo, trocar simplesmente para 100 m não preserva todos os casos anteriores. O arquivo [`escala-arquivada.json`](../resultados/revisao-exportados-20261105/escala-arquivada.json) lista todos os casos.

## Funcionamento técnico

- Controle: carga do modelo 1,63 s; processamento por recorte aproximadamente 17,29 s no Centro e 0,87 s no Norte. Inferência/transferência/codificação: 16,75 s e 0,37 s. O primeiro recorte inclui o custo inicial da primeira inferência.
- Diagnóstico: carga 1,95 s; processamento aproximadamente 18,84 s e 1,14 s. Pico máximo registrado: 616 MiB alocados e 1.094 MiB reservados pelo PyTorch. Não representa toda a VRAM do desktop.
- Não houve erro de memória ou fallback para CPU. A GPU estava compartilhada com o desktop; os tempos não são um benchmark com GPU exclusiva.
- Centro: 66 propostas antes do NMS global e 33 depois, no controle. Norte: 23 antes e 12 depois. Nenhum clique manual perdeu sua única máscara de cobertura por NMS global no controle; isso não comprova ausência de outras perdas de objetos pela agregação.
- Os diagnósticos armazenam apenas propostas posteriores ao piso de score e ao NMS nativo. Não foi inspecionado o conjunto interno completo de propostas da rede.

## Próxima rodada proposta

1. Revisar as classes e grupos na referência manual: árvore, conjunto de copas, arbusto, outro verde, não árvore ou incerto. Completar árvores visíveis nas áreas escolhidas. A planilha `referencia-para-revisao.csv` mantém IDs, números e coordenadas, deixando a classificação humana em branco.
2. Testar agregação por máscaras/contensão e bordas, começando pelos casos Centro 4 e 13. Evitar união somente por proximidade, que pode juntar copas visualmente separadas.
3. Testar complemento de 100 m ao controle de 200 m, registrando origem de cada proposta e comparando ganho, perdas, duplicações e falsos positivos revisados. Não concatenar os pontos das duas escalas sem agregação.
4. Comparar essa variante com Cambridge atual e, depois de validar o escopo, com flexi. Mudar um fator por vez e usar áreas distintas para calibração e teste. Cor pode ser um sinal auxiliar de revisão, sem virar requisito obrigatório que elimine copas escuras ou de outras cores.
5. Considerar ajuste fino com exemplos locais e negativos difíceis se essas comparações mantiverem erros de reconhecimento. Precisão/recall e contagem de árvores só após revisão da referência e definição da unidade de aglomerado.

## Arquivos e reprodução

- [`comparacao-centro.jpg`](../resultados/revisao-exportados-20261105/comparacao-centro.jpg) e [`comparacao-centro-norte.jpg`](../resultados/revisao-exportados-20261105/comparacao-centro-norte.jpg): manual, controle e diagnóstico lado a lado. Amarelo = clique coberto no controle; rosa = clique fora das máscaras do controle; caixas verdes e pontos azuis = propostas do painel. Não são rótulos de verdade.
- [`casos-chave.jpg`](../resultados/revisao-exportados-20261105/casos-chave.jpg): aproximações dos exemplos discutidos.
- `pontos-diagnostico.csv` / `.json`: localização e evidências por número; `comparacao-manual.json`: contagens, associações, hashes e caminhos exatos das execuções.
- `controle/20261105T205204Z-450ace/`: GeoJSONs novos em 0,15/0,30/0,50, máscaras, configurações, métricas e diagnósticos.
- `diagnostico/20261105T205304Z-d10101/`: mesma estrutura, com piso 0,05. Essa camada serve para diagnóstico e não é um novo padrão aprovado.
- `detalhes-*.jpg`: folhas de aproximações dos cliques sem cobertura no controle.
- Scripts de revisão, logs e resultados ficam nessa pasta local, ignorada pelo Git. O código do detector e a interface não foram alterados por esta rodada.

Para refazer a inferência em pastas novas, dentro de `prototipo-01`:

```powershell
.\scripts\detectron2-windows.ps1 -m backend.cambridge --saida resultados/revisao-exportados-20261105/controle
.\scripts\detectron2-windows.ps1 -m backend.cambridge --cortes 0.05 0.15 0.30 0.50 --saida resultados/revisao-exportados-20261105/diagnostico
.\.envs\detectree2\Scripts\python.exe resultados/revisao-exportados-20261105/revisar.py
.\.envs\detectree2\Scripts\python.exe resultados/revisao-exportados-20261105/conferir_escala.py
.\.envs\detectree2\Scripts\python.exe resultados/revisao-exportados-20261105/gerar_detalhes.py
```

Os comandos de inferência geram novos subdiretórios; os scripts de revisão atualizam apenas os resumos desta rodada usando as execuções concluídas mais recentes. Os GeoJSONs manuais e as rodadas anteriores permanecem preservados.
