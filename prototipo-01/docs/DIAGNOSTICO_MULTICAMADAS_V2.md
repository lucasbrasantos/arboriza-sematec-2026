# Diagnóstico de ruas com camadas e máscaras do v2

## Comportamento aprovado

Ao selecionar uma camada vinculada ao modelo v2, o formulário do diagnóstico
mostra as camadas da **mesma execução**, com caixas de seleção:

- Individuais: marcada por padrão.
- Grupos de copas: marcada por padrão.
- Complementos pendentes: desmarcada por padrão; pode ser incluída para comparação.

É possível selecionar apenas uma categoria ou várias camadas. A seleção não
altera as camadas do mapa. Camadas de outra execução não são oferecidas nessa
combinação. Novas camadas de grupos que chegam ao concluir uma análise também
são incluídas nas opções. Escolhas feitas pelo usuário são mantidas durante a
sessão; recarregar a página retorna aos padrões.

O diagnóstico do Controle continua funcionando com a camada ativa e suas
coordenadas, sem exigir máscaras ou mudar seus parâmetros anteriores.

## Originais, exclusões e duplicações

A interface envia o ID da análise e os IDs das copas vivas de cada camada
selecionada. Não envia novamente as geometrias detalhadas das máscaras.
O servidor usa `copas.geojson` e `pontos-todos.geojson` da execução original,
validando identidade, tipo e vínculo com a análise. Isso é compatível com a
revisão do v2: posições são fixas e exclusões retiram IDs da seleção.

Consequências:

- Pares excluídos da revisão não entram no cálculo quando não constam de nenhuma
  camada selecionada.
- O mesmo `copa_id` presente em cópias de camadas entra somente uma vez.
- Se uma cópia selecionada ainda contém o par, ele continua na união das entradas.
- IDs desconhecidos ou de outra execução são recusados antes do diagnóstico.
- O resultado original e suas máscaras não são sobrescritos.

O servidor mantém em memória até oito conjuntos de resultados originais já
projetados. Mudanças de tamanho/data dos arquivos invalidam esse cache.
Os cálculos de associação e cobertura são refeitos para a seleção enviada;
não há execução dos modelos nem aquisição de imagens/ruas nessa operação.

Exportar uma camada v2 preserva o ID da análise e sua finalidade em `arboriza`.
A importação também recupera esse vínculo dos metadados das copas ou dos pontos
de exportações anteriores, recusando mistura de execuções no mesmo arquivo.
Para diagnosticar uma camada reimportada, os resultados originais e o resumo
territorial precisam estar disponíveis neste computador.

## Duas medições diferentes por trecho

### Associação dos pontos

Conserva a regra anterior: o centro representativo é atribuído a um único trecho
mais próximo dentro da distância escolhida. Agora os resultados são separados:

- `individuos_proximos`: candidatos individuais.
- `grupos_proximos`: pontos que representam grupos; não equivalem a indivíduos.
- `complementos_proximos`: propostas pendentes.
- `individuos_por_100m`: taxa calculada somente com os candidatos individuais.

A linha de distribuição e os marcadores mantêm essas categorias: verde para
individuais, roxo para grupos, âmbar para pendentes e azul para seleção.

As cores das ruas e os filtros continuam descritivos. No v2 usam presença/ausência
de **pontos-base**, isto é, indivíduos e grupos, excluindo os pendentes. Não foi
criado limiar de prioridade por porcentagem de copa.

### Cobertura estimada de copas

Para cada trecho:

1. Construir a faixa ao redor do eixo com a distância configurada. Por exemplo,
   25 m significa 25 m para cada lado, incluindo extremidades arredondadas.
2. Intersectar essa faixa com a união dos setores analisados. Essa é a área
   efetivamente avaliada; o exterior dos setores não entra no denominador.
3. Consultar as máscaras selecionadas por índice espacial STRtree e recortá-las
   pela faixa avaliada.
4. Unir somente as máscaras individuais e de grupos, contando sobreposições uma
   vez. As máscaras pendentes ficam fora da área de cobertura, mesmo selecionadas.
5. Calcular `100 × área da união das copas / área da faixa avaliada`.

Os campos são `area_faixa_avaliada_m2`, `area_copas_base_m2`,
`cobertura_copas_base_percentual` e `mascaras_na_faixa_por_tipo`.

Um grupo pode ter seu centro longe do eixo e ainda contribuir com sua máscara
para a cobertura da faixa. Por isso o detalhe diferencia **pontos associados** de
**máscaras que cruzam a faixa**. Uma máscara pode tocar várias faixas; não se deve
somar essas áreas para calcular a cobertura total do setor.

Esta medida descreve a faixa do trecho, não certifica cobertura do bairro nem
aplica uma meta automática de 30%. Também não determina aptidão para plantio.

## Contrato e organização

`POST /api/ruas/diagnostico` mantém a entrada antiga `pontos` ou aceita,
exclusivamente, a nova entrada:

```json
{
  "analysis_id": "20261108T010300Z-04ea89a4",
  "distancia_m": 25,
  "camadas": [
    {"id_camada": "camada-individuais", "ids_copas": ["ID-original-da-copa"]},
    {"id_camada": "camada-grupos", "ids_copas": ["ID-original-do-grupo"]}
  ]
}
```

Limites: até 12 camadas, 10.000 IDs por camada e 50.000 registros enviados no
pedido. A resposta informa contagens por tipo, duplicações ignoradas, posições
originais para o mapa e medições de cobertura por trecho. IDs de camadas não
substituem a validação das copas contra os arquivos da execução original.

| Arquivo | Papel |
|---|---|
| `backend/street_canopies.py` | Ler/validar originais, selecionar IDs, deduplicar e medir união de máscaras |
| `backend/street_analysis.py` | Associar pontos por tipo e calcular cobertura na faixa observada |
| `backend/api.py` | Validar entrada antiga ou seleção de camadas |
| `frontend/js/street-inputs.js` | Seleção de camadas da mesma execução e preparação dos IDs |
| `frontend/js/street-analysis.js` | Consulta, estado e invalidação por mudanças em qualquer camada selecionada |
| `frontend/js/street-panel.js`, `street-map.js` | Contagens separadas, cobertura e categorias visuais |

## Validação

- **80 testes Python e 38 JavaScript**: união de máscaras sobrepostas, exclusão
  dos pendentes, denominador parcial, máscara de grupo sem centro perto da rua,
  IDs repetidos, exclusões, rejeição de outra execução, contrato HTTP, padrões
  do seletor e invalidação ao mudar uma camada secundária.
- API com dados reais do setor `350280405000001`: 125 indivíduos + 20 grupos,
  42 trechos em 0,226 s na primeira chamada e 0,118 s na repetição.
- Incluir os 10 pendentes levou 0,120 s e não alterou a área de cobertura-base
  de nenhum dos 42 trechos.
- Navegador: três camadas reimportadas com vínculo preservado; padrão indivíduos
  + grupos confirmado; consulta conjunta; seleção do trecho; inclusão opcional
  dos pendentes sem alterar a cobertura exibida. Sem erros JavaScript.
- Trecho 9 da Rua Anita Garibaldi: 6 indivíduos e 2 grupos associados pelo ponto;
  máscaras de 11 indivíduos e 3 grupos na faixa; cobertura estimada de **20,97%**,
  com 1.246,94 m² de copas em 5.945,20 m² avaliados. São métricas distintas.
- Conferência desktop/celular, sem overflow horizontal na largura de 390 px.

Evidências em `resultados/ruas-multicamadas-v2/`: medições, respostas das três
consultas e capturas `desktop-final.jpg` e `mobile-final.jpg`.
