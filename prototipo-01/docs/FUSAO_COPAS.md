# Perfil experimental Restor + Cambridge

## Decisões aprovadas

- Adicionar um perfil experimental, preservando Controle e Multiescala.
- Copas individuais, grupos de copas e complementos têm pontos e polígonos ligados pelo mesmo ID.
- Grupos aparecem em uma camada de pontos própria e não entram na contagem de indivíduos.
- Complementos encontrados apenas pelo Cambridge ficam pendentes, em camada própria, fora da cobertura operacional.

O processamento está no laboratório `prototipo-01`, onde já existe a API de análise. O backend do novo `app/` ainda é uma estrutura inicial; esta entrega não conecta o React a dados reais nem aplica o stash do diagnóstico de ruas. A captura urbana que o usuário deixou rodando não foi reiniciada ou alterada nesta etapa.

## Usar

Reinicie o servidor local de análise se ele já estiver aberto, recarregue a interface do protótipo e escolha **Restor + Cambridge · experimental** em Perfil de análise. Funciona com os recortes locais Centro/Centro-norte e com setores que estejam cobertos pelas imagens locais disponíveis.

A interface gera camadas separadas de pontos individuais, grupos e complementos pendentes, sem trocar automaticamente a camada ativa pelos grupos/complementos. A identidade de uma camada agora inclui a análise e sua finalidade; várias camadas da mesma análise permanecem distintas após recarregar o navegador. A ficha de cada ponto identifica seu tipo e o ID da copa vinculada.

As máscaras são exportadas e acessíveis pela API; ainda não há uma nova camada visual de polígonos no mapa do protótipo. A revisão conjunta de pontos/polígonos e a integração com o app React são etapas seguintes a validar.

Comando alternativo, dentro de `prototipo-01`:

```powershell
.\.envs\detectree2\Scripts\python.exe -u -m backend.service --recorte centro --perfil fusao --score 0.15
```

Os pesos Restor foram preparados na máquina durante esta entrega. Para preparar novamente no ambiente existente:

```powershell
.\.envs\detectree2\Scripts\python.exe -u -m backend.restor
```

Esse comando baixa somente os recursos Restor da revisão fixa; não executa captura de ortofotos. A inferência não baixa modelos automaticamente nem usa CPU como fallback.

## Modelos e configuração

Restor: `restor/tcd-mask-rcnn-r50`, revisão `0b4a94d7c81d319826b79ad1868733ae869a1141`, SHA-256 do peso `5c33e18df30ef39de2f9f4b309e1e63f7a351e63a930721e50ffda0efe5b19db`. Peso e configuração são conferidos por hash. A ficha oficial identifica a licença como CC BY-NC; a procedência acompanha o manifesto local.

Cambridge: mesmo peso e manifesto já usados pelo protótipo. O perfil atual mantém seu limite de detecções; a instância usada pela fusão recebe explicitamente limite de **512 detecções por janela**, assim como Restor e o experimento recebido.

Os dois modelos rodam em CUDA no ambiente existente. As configurações completas, revisões e identificação de dispositivo são gravadas em `modelos.json` por análise. Não houve treinamento nem alteração dos pesos. Execução em GPU e janelas ancoradas em grade global podem produzir propostas diferentes das execuções CPU/janelas relativas ao recorte do projeto recebido; os 367 candidatos daquele exemplo não são uma meta de igualdade.

Restor usa janelas de 512 px (128 m), interpolação bilinear de entrada de 2,5× e corte final fixo de **0,50**. Essa interpolação aproxima a escala de entrada do experimento, mas não cria detalhe novo. Cambridge usa janelas de 200 e 100 m. A sobreposição é de 25%; o campo de score da interface controla **somente Cambridge**, com padrão 0,15. A descrição do perfil explica essa distinção.

## Imagens e execução territorial

Correção posterior do Centro: o contorno geográfico dos recortes é densificado antes de projetar para UTM. Isso corrige a divergência de 1–2 pixels na borda do raster original sem relaxar a validação. Os três Controles e o teste de fonte local/DataGEO estão descritos em [COMPARACAO_FONTES_CONTROLE.md](COMPARACAO_FONTES_CONTROLE.md).

A fonte local consulta TIFFs finalizados do novo acervo urbano, os recortes locais existentes e o cache WMS já adquirido. Arquivos `.part` da captura em andamento não são usados. Um índice espacial procura fontes que cruzem a janela solicitada. Dados com resolução estimada acima de 27 cm são excluídos desta entrada, evitando usar o JPG de aproximadamente 50 cm como se fosse 25 cm.

As janelas são lidas/reprojetadas em EPSG:31982 a 0,25 m/pixel. A máscara de validade da origem é preservada, e toda a parte da seleção dentro de cada janela precisa estar coberta. Se faltar imagem, a análise falha com mensagem explícita e preserva resultados anteriores. **Não há download automático no perfil experimental nesta etapa**: aguarde os blocos necessários ou selecione uma área já disponível localmente.

O limite de 5 MP por pedido do app recebido não foi transportado. O perfil trabalha com janelas limitadas, sem enviar a seleção inteira ao modelo de uma vez. Isso permite planejar setores maiores, mas não significa validação de desempenho/qualidade para a cidade inteira nesta entrega.

Cada janela completa pode ser reaproveitada de `.cache/fusao-mascaras-v1`. A chave inclui pixels RGB, validade, coordenadas, motor, configurações, revisões/pesos e runtime; o score Cambridge é aplicado após a inferência e não obriga repetir a rede quando continua acima do piso. O cache usa polígonos das máscaras, sem carregar máscaras de todas as janelas simultaneamente. O cache desta primeira etapa não tem limpeza automática; ele não é o acervo permanente nem o cache WMS. Sua política de tamanho deve ser definida antes de processamentos municipais repetidos.

## Fusão e vínculo entre saídas

1. Converter as máscaras binárias da rede em polígonos em metros, preservando componentes e furos. Descartar máscaras com menos de 20 pixels válidos.
2. Suprimir duplicações do mesmo tipo com IoU de pelo menos 0,50. Restor preserva a distinção entre grupo e indivíduo. Cambridge 200 m forma a base; os 100 m complementam sem substituir as propostas já mantidas.
3. Cruzar Cambridge com Restor. Correspondência exige ao menos 12 pixels equivalentes de interseção e IoU ≥ 0,25 ou interseção sobre a máscara menor ≥ 0,50. A evidência é registrada, sem fazer média de scores.
4. Manter os polígonos Restor como base. Cambridge sem correspondência torna-se complemento pendente.
5. Recortar os polígonos pela seleção territorial. Gerar seu centroide em projeção métrica; quando ficar fora da geometria, usar um ponto interno representativo.
6. Exportar ponto e polígono com o mesmo `id` e `properties.copa_id`, tipo, origem, score, estado e análise de origem. O ponto representa a copa, **não o tronco**.

O `candidatos` do resumo é a quantidade de propostas individuais Restor. `grupos_copas`, `complementos_pendentes` e `propostas_totais` são campos separados. Um grupo pode sobrepor uma proposta individual, pois são tipos diferentes; não se deve somar os grupos à contagem de árvores.

## Cobertura

A cobertura operacional é a área da união dos polígonos Restor individuais e de grupos, recortada pela seleção, dividida pela área da seleção. Sobreposições não são somadas. Complementos pendentes ficam excluídos. Para seleção territorial, também há cobertura individual por setor em `cobertura_por_setor`.

A cobertura confirmada começa em zero. A porcentagem operacional é uma estimativa automática para revisão, não certificação do componente 30 da regra 3-30-300. Esta etapa não mede os componentes 3 e 300.

Os arquivos são um **snapshot vinculado por IDs**. Mover ou apagar um ponto no editor atual não modifica automaticamente sua máscara nem recalcula a cobertura salva. Essa sincronização e a confirmação/descarte de copas precisam de uma etapa própria de revisão; não devem ser inferidas só porque os IDs estão ligados.

## Arquivos e API

| Arquivo | Conteúdo |
|---|---|
| `pontos.geojson` | Copas individuais, compatível com o fluxo atual |
| `pontos-grupos.geojson` | Pontos de grupos, fora da contagem individual |
| `pontos-complementos.geojson` | Pontos Cambridge pendentes |
| `pontos-todos.geojson` | Todos os pontos, com tipo e vínculo |
| `copas.geojson` | Todos os polígonos, com IDs iguais aos pontos correspondentes |
| `resumo.json` | Contagens, cobertura, regras e medições por janela |
| `modelos.json` | Configurações e procedência dos modelos |

`POST /api/analises` aceita `perfil: "fusao"`. `POST /api/analises/setores` também aceita `perfil: "fusao"`; a ausência desse campo conserva Controle. Ambos usam a fila existente de uma análise por vez.

`GET /api/analises/<id>/geojson` conserva os pontos individuais. Os demais arquivos ficam em `GET /api/analises/<id>/camadas/<nome>`, com nomes permitidos `copas`, `pontos-todos`, `pontos-grupos` e `pontos-complementos`. Os resultados ficam no diretório da análise, sem sobrescrever execuções anteriores.

## Verificação em 07/11/2026

- 52 testes Python passaram: incluindo máscaras/pontos ligados, grupos, complementos, união de áreas, recorte, centroide fora da geometria, validade de raster e contrato HTTP.
- 18 testes JavaScript passaram: incluindo camadas da mesma análise por finalidade, persistência e importação das três categorias no perfil territorial.
- Piloto real CUDA na imagem de 512 × 512 do entorno da igreja, já existente no projeto recebido: **43 propostas individuais, 8 grupos e 3 complementos**, em 19 janelas. Processamento após carregar modelos: **6,225 s**. Repetição com todas as janelas em cache: **0,607 s**, com geometrias idênticas.
- Os pesos Restor e Cambridge carregaram na GPU com suas configurações separadas. A inferência antiga não foi substituída.
- Fluxo HTTP real com o mesmo piloto: criação assíncrona, conclusão e leitura de todas as coleções retornaram sucesso; foram conferidos os IDs ponto/polígono e as contagens por categoria. Resultado em `resultados/fusao-http/20261107T222603Z-c26e2d40/`.
- Fluxo territorial HTTP real no setor completo `350280405000005`: **208 propostas individuais, 14 grupos e 17 complementos**, 86 janelas e cobertura operacional preliminar de **6,21%**. O processamento após carregar os modelos levou **19,552 s**. IDs dos setores, versão da malha e cobertura por setor foram preservados. Resultado em `resultados/fusao-setor-piloto/20261107T222752Z-e39e0c14/`.

O piloto não comprova precisão por árvore. A figura `comparacao.png` mostra inclusive um complemento Cambridge sobre o telhado circular, que permanece pendente e fora da cobertura operacional — exemplo concreto da utilidade dessa separação.

A figura e os arquivos do piloto estão em `resultados/fusao-piloto/20261107T222039Z-73dd628a/`. O processamento da cidade inteira e a revisão por usuário no novo app ainda não foram validados.
