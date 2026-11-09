# Identificação local — Protótipo 01

## Uso

1. Inicie pelo F5: **Protótipo 01: interface**.
2. Escolha Centro ou Centro-norte em **Área de estudo**.
3. Escolha o perfil e o corte de score; clique em **Identificar possíveis árvores**.
4. Acompanhe a etapa real e a duração. O mapa continua navegável e editável.
5. Revise a nova camada com as ferramentas existentes e exporte o GeoJSON corrigido.

Se você trocar de recorte, editar pontos ou selecionar outra camada durante a análise, a nova camada será adicionada sem assumir a seleção atual. Se limpar o mapa, a análise em andamento ficará apenas no disco. Falhas preservam as camadas anteriores. Uma falha de conexão oferece **Acompanhar novamente**, sem repetir a análise.

Durante o processamento, o mapa apresenta um contorno pulsante e um indicador com a etapa e a duração retornadas pela API. O indicador não bloqueia os controles do mapa. Se o acompanhamento perder a conexão, o contorno muda de cor e o indicador avisa que a análise pode continuar; use **Acompanhar novamente** no painel. O efeito respeita a preferência por movimento reduzido. A duração exibida é tempo decorrido, não uma previsão de término.

## Perfis

São configurações do **mesmo Detectree2 Cambridge**, não modelos diferentes:

| Perfil | Processamento | Papel |
|---|---|---|
| Controle, padrão | Janelas de 200 m; NMS de caixas IoU 0,5 | Reproduzir o controle anterior |
| Multiescala, experimental | 200 + 100 m; agregação por máscaras IoU 0,5, sem corte por contenção | Procurar copas adicionais e comparar erros |

Uma janela é um pedaço da imagem enviado ao modelo. Ambos usam RGB8 original, sobreposição de 25%, lote de uma janela e os mesmos pesos. Janelas menores alteram a escala com que as copas chegam ao modelo; não aumentam a resolução real da ortofoto. Não há filtro obrigatório de verde.

O corte começa em **0,15**, ajustável de 0,05 a 1. Score não é probabilidade de acerto. O preditor carrega com piso 0,05; o corte escolhido é aplicado no processamento e registrado no resultado. Multiescala pode aumentar omissões recuperadas, falsos positivos e duplicações. Não é declarada superior apenas por produzir mais pontos.

## Estrutura e preservação

- `backend/detectree.py`: modelo local e inferência CUDA.
- `backend/cambridge.py` e `multiscale.py`: processamento e agregação já usados nos experimentos.
- `backend/service.py`: executa um dos dois perfis, reutilizando o modelo.
- `backend/api.py`: endpoints das análises e da seleção territorial, estado das análises em memória e uma análise ativa por vez.
- `frontend/js/analysis.js`: execução e consultas sequenciais a cada segundo.
- `frontend/js/layers.js`: lista de camadas e persistência local.

Cada análise salva em `resultados/interface/<id>/`: `pontos.geojson`, resumo, estado final, relatórios por escala, configuração do preditor, máscaras e imagens de diagnóstico. Falhas registram `erro.log`. Arquivos gerados continuam fora do Git. Os pontos representam centros aproximados das caixas de copas, não a posição do tronco.

As camadas e edições ficam no armazenamento deste navegador e desta origem (host/porta). Limpar dados do navegador pode apagá-las; exporte cópias. O arquivo original do modelo no disco não é alterado pela revisão na interface. Camadas antigas salvas como marcação manual são migradas ao próximo salvamento. Excluir camadas pede confirmação; “Limpar mapa” mantém uma camada manual vazia para novas marcações.

**Camadas** e **Pontos** são controles flutuantes no canto direito, abaixo do zoom. Abrem para baixo, com exclusão mútua. Clicar em uma camada recupera sua área e enquadra o mapa; clicar novamente na camada ativa também restaura seu recorte após uma navegação personalizada. Um enquadramento temporário não sobrescreve a área original de outra camada.

Os limites ficam em `studyArea` no armazenamento local e em `arboriza.area` no GeoJSON exportado. As camadas antigas recuperam os recortes conhecidos pelo identificador ou pelo nome padrão de exportação. Sem identificação, usa-se a extensão dos pontos com pequena margem, sem afirmar que esse era o retângulo original. Os IDs, scores e demais propriedades dos pontos são preservados. Uma marcação fora dos limites amplia a área da camada para incluí-la.

## Seleção e análise territorial — piloto

O painel **Seleção territorial** carrega os setores urbanos de Araçatuba da malha definitiva do Censo 2022. Clique em **Selecionar setores** para trocar temporariamente a barra de pontos pela barra territorial. Clique em setores para alterná-los ou use retângulo/desenho livre com os modos **Substituir**, **Adicionar** e **Remover**. O desenho precisa ter área, e setores apenas tocados pela borda não entram. A prévia destaca o setor inteiro e informa a área da união.

A prévia também compara a seleção com as máscaras válidas dos GeoTIFFs locais de Centro e Centro-norte, sem contar duas vezes a sobreposição entre eles. O percentual indica disponibilidade geométrica de pixels válidos nesses arquivos; não garante qualidade visual nem cobertura de outras ortofotos. Uma parte sem imagem não é considerada analisada.

O endpoint `POST /api/territorio/cobertura-por-setor` aceita `{ "ids": [...] }` e informa a cobertura individual por esses mesmos dois recortes: área coberta, área pendente e estado `completo`, `parcial` ou `sem_imagem`. O estado completo admite até 0,01 m² de diferença por ruído numérico. A consulta é um diagnóstico: não adquire imagens, não verifica sua qualidade ou licença, e ainda não aciona o modelo nem aparece como nova ação na interface.

### Cache local de imagens — preparação

O diretório `data/ortofotos/cache-blocos/` armazena cópias verificadas e um catálogo SQLite com hash, origem, CRS, limites, resolução e dimensões. Os recortes originais permanecem onde estavam. Para importar um dos recortes locais conhecidos, a partir de `prototipo-01`:

```powershell
.\.envs\detectree2\Scripts\python.exe .\scripts\preparar_cache_ortofotos.py --recorte centro
.\.envs\detectree2\Scripts\python.exe .\scripts\preparar_cache_ortofotos.py --recorte centro-norte
```

O padrão permite até 10 GiB de arquivos de imagem no cache e exige 1 GiB livre após a cópia. `--limite-gib` altera o limite daquela execução; não muda uma configuração persistente. Arquivos órfãos também entram na conta. Uma nova importação com o mesmo conteúdo confere a integridade antes de reutilizar; falta ou alteração gera erro. Nenhuma limpeza automática é feita. Essa preparação copia os dois recortes inteiros atuais: ainda não divide novos blocos, não adquire imagens externas e não conecta o cache ao detector ou à prévia de cobertura. Essas integrações serão validadas nas próximas etapas.

### Aquisição IGC e cache persistente de análise

`backend/orthophoto_wms.py` prepara a aquisição de recortes da camada `ORTOFOTOS_SP_2023_2024` pelo WMS do DataGEO. O catálogo declara resolução espacial de 25 cm para a fonte; a resolução efetiva do recorte depende dos limites e das dimensões solicitadas. O serviço devolve uma imagem RGB renderizada, não o GeoTIFF original do levantamento. A aquisição valida formato, dimensões e transparência, limita a resposta a 20 MiB e a 2048 pixels por dimensão e produz um GeoTIFF com máscara válida em EPSG:4674. Esses limites são do protótipo e não uma declaração sobre os limites do serviço.

As imagens de análise são armazenadas em `data/ortofotos/cache-wms/`, fora do Git, com catálogo SQLite. A chave inclui fonte, camada, CRS, limites, dimensões e versão do processamento. Antes de reutilizar, o sistema confere tamanho e SHA-256. Uma janela idêntica é lida localmente, inclusive se for parte de outra seleção; janelas ainda não salvas são obtidas do DataGEO. O padrão permite até 10 GiB de arquivos nesse cache e mantém reserva de 1 GiB de espaço livre. Ao atingir o limite, a importação falha sem apagar imagens existentes. Arquivos alterados ou ausentes causam erro explícito. Não há expiração, renovação automática, limpeza ou substituição silenciosa; uma imagem reutilizada não garante que a fonte online esteja igual atualmente.

O download é preparado em `data/ortofotos/temporario/` e seu diretório é removido ao fim da execução, inclusive em exceções comuns; a cópia verificada no cache permanece. Uma interrupção abrupta do processo ou do computador pode deixar arquivos temporários órfãos; ainda não existe recuperação automática. O cache antigo `cache-blocos` permanece separado e preservado.

A seleção territorial agora pode iniciar a aquisição pelo botão de análise e enviar as imagens ao detector. Um piloto em um setor pequeno concluiu com imagens reais e CUDA, mas não comprova a qualidade ou a cobertura de todos os setores. Ainda é necessário confirmar as condições aplicáveis ao uso automatizado, processamento e cache da camada.

Para testar: selecione um ou mais setores, mantenha o modo territorial ativo, escolha o perfil **Controle · 200 m** e clique em **Identificar possíveis árvores** no painel de área. O trabalho congela os IDs e o hash da malha no início. Ao concluir, a camada é adicionada sem interromper a seleção; clique em **Voltar aos pontos** e selecione a nova camada na lista **Camadas**. O retângulo exibido para a camada envolve a seleção; sua área não é a área exata dos polígonos dos setores.

O piloto divide a união em células métricas de 150 m, cada uma com uma janela de 200 m de contexto (25% de sobreposição). Cada centro de detecção pertence a uma única célula, deve estar dentro da união selecionada e é submetido à deduplicação espacial por IoU de caixas de 0,5. Pixels necessários da parte selecionada são verificados pela máscara WMS: se faltarem, a análise falha sem publicar resultado completo. O resumo registra as janelas baixadas e reutilizadas, tempos de aquisição, leitura e inferência, janelas que atingiram o limite do modelo e hash da imagem renderizada. O detector pode cometer omissões e falsos positivos, inclusive nas bordas; a qualidade ainda não foi medida contra referência revisada.

A análise territorial usa apenas o perfil Controle nesta etapa. Não há fila persistente, retomada após reinício, repetição automática de requisições ou previsão confiável de tempo. Uma interrupção exige reiniciar o trabalho. Não se recomenda iniciar toda a cidade antes de medir setores de tamanhos variados e revisar a estabilidade e os resultados. O tempo exibido é decorrido; as medições registradas servirão para uma estimativa futura.

**Toda área urbana** seleciona todos os 499 setores classificados como urbanos no arquivo preparado, incluindo núcleos urbanos isolados. **Inverter** atua sobre esse conjunto; **Limpar** não apaga áreas salvas nem pontos. A fonte é um recorte estatístico de 2022 e não comprova o perímetro legal atual. A área é calculada em SIRGAS 2000 / UTM 22S; a geometria exibida e exportada é GeoJSON em WGS84.

Áreas nomeadas e a seleção temporária ficam no armazenamento deste navegador e desta origem. **Exportar área em GeoJSON** guarda a união e os IDs dos setores, com metadados e hash da fonte; a importação de pontos não importa áreas. Mudanças da malha são detectadas ao carregar uma área salva. Use o botão **Voltar aos pontos** para encerrar a seleção e restaurar a edição. A seleção por si só não inicia o modelo; a análise começa ao clicar no botão.

O arquivo da malha fica fora do Git em `data/territorial/`. O comando de preparação e os detalhes da fonte estão no [README](../README.md). A API informa erro recuperável se a malha não estiver disponível.

O servidor usa um processo e uma instância do modelo, carregada na primeira análise. Pedidos concorrentes recebem HTTP 409. Consultas e exportações continuam disponíveis. Reiniciar o servidor perde o acompanhamento das tarefas em memória; resultados concluídos permanecem importáveis no disco. Não há fallback silencioso para CPU.

| Endpoint | Função |
|---|---|
| `GET /api/recortes` | Recortes, limites e perfis disponíveis |
| `POST /api/analises` | `{recorte, perfil, score}` → `analysis_id` |
| `POST /api/analises/setores` | `{ids, fonte_malha, score}` → `analysis_id`, com perfil Controle |
| `GET /api/analises/{id}` | Estado, etapa, duração e resumo |
| `GET /api/analises/{id}/geojson` | Pontos da análise concluída |
| `GET /api/territorio/setores` | Malha urbana local e metadados do IBGE |
| `POST /api/territorio/intersecoes` | IDs dos setores com interseção de área positiva com o desenho |
| `POST /api/territorio/resumo` | Contagem, limites e área da união dos setores selecionados |
| `POST /api/territorio/cobertura-local` | Área da seleção coberta pelas máscaras válidas das imagens locais |
| `POST /api/territorio/cobertura-por-setor` | Cobertura geométrica individual pelos dois recortes locais |
| `POST /api/territorio/geojson` | GeoJSON da união e IDs dos setores selecionados |

Estados: `pendente`, `processando`, `concluida`, `erro`.

## Diagnóstico exploratório de ruas

Selecione em **Camadas** uma camada de pontos criada por uma análise territorial concluída neste computador. A seleção restaura os IDs de setores da análise; **Enquadrar ao selecionar camada** permite desativar o ajuste automático. Em **Diagnóstico de ruas**, escolha a distância e clique em **Analisar ruas próximas**. O botão fica desativado quando não há pontos. A seleção territorial, se estiver aberta, é fechada preservando o rascunho.

O diagnóstico substitui a edição por um painel lateral com busca, filtros e detalhes ligados ao mapa. O retângulo sai de cena: o contorno real dos setores permanece acima das vias, e uma máscara escurece apenas o exterior da seleção. A imagem aérea inicia suavizada e pode voltar ao original sem nova consulta. Laranja significa **sem pontos associados**, verde azulado significa **com pontos** e azul significa **selecionado**. Essas categorias são descritivas; não há limiares de prioridade. O entorno parcial é informado separadamente, com a porcentagem geométrica da faixa de comparação dentro dos setores. Os pontos disponíveis continuam contados.

A seleção pela lista respeita a preferência de enquadramento; **Enquadrar trecho** funciona manualmente. Os detalhes mostram comprimento, contagem, taxa por 100 m e um desenho da projeção dos pontos ao longo do eixo. **Voltar à edição de pontos** restaura os controles, a base e as preferências de visualização. O diagnóstico não altera os pontos; uma mudança na camada ou nos pontos invalida o resultado, e respostas tardias são ignoradas. Consulte [DIAGNOSTICO_RUAS.md](DIAGNOSTICO_RUAS.md) para a lógica completa, fórmulas e validações.

A API lê os IDs dos setores e o hash da malha do resumo da análise original no disco, mas usa os pontos atuais da camada ativa, inclusive edições. Camadas manuais/importadas que não mantenham uma análise territorial vinculada não podem ser usadas neste piloto; recarregue ou gere uma camada de análise de setores. Os trechos não são persistidos e podem ser calculados novamente. O diagnóstico usa somente os pontos da camada e não observa áreas ainda não analisadas.

O piloto cruza amostras locais em `data/ruas/piloto-osm/`, de © OpenStreetMap contributors, ODbL. Foram preparadas amostras para os setores `350280405000005`, `350280405000340` e `350280405000505`. Outras seleções só funcionarão após preparar os dados necessários. O script abaixo solicita uma caixa pequena para cada setor e não sobrescreve arquivos; a API principal OSM é usada apenas nesta coleta piloto limitada. Para ampliação da cidade, selecionar uma fonte de extratos adequada em vez de fazer consultas em massa à API de edição.

```powershell
.\.envs\detectree2\Scripts\python.exe .\scripts\preparar_ruas_piloto.py 350280405000340
```

Os eixos são recortados pelos setores e divididos em até 100 m, valor provisório para comparação. Cada ponto do setor é atribuído apenas ao trecho mais próximo até a distância indicada (padrão 25 m, ajustável de 5 a 100 m); pontos sem via próxima ou fora dos setores são contados à parte. A vizinhança marcada como parcial ultrapassa a área analisada e sua contagem pode estar incompleta. Trechos muito curtos podem gerar taxas por 100 m pouco representativas. Uma via representada em faixas separadas pode aparecer mais de uma vez.

As amostras OSM são incompletas, podem omitir vias que não tenham nós na caixa da consulta e não confirmam calçadas, limite de propriedade ou locais disponíveis para plantar. Na amostra consultada não foram encontradas calçadas explicitamente identificadas. Este resultado não mede a regra 3-30-300 nem detecta locais de plantio; as cores descrevem apenas presença ou ausência de pontos associados, sem medir déficit.

## Ambiente e reprodução

Use Python 3.12 e o ambiente Windows/CUDA de [DETECTRON2_WINDOWS.md](DETECTRON2_WINDOWS.md). Os pesos Cambridge e os dois GeoTIFFs locais são os mesmos do piloto. As dependências adicionais já foram instaladas nesta máquina; para reinstalá-las no ambiente existente:

```powershell
.\.envs\detectree2\Scripts\python.exe -m pip install -r requirements/requirements-api.txt
```

O mesmo serviço pode ser executado sem interface:

```powershell
.\.envs\detectree2\Scripts\python.exe -m backend.service --recorte centro --perfil multiescala --score 0.15
```

A saída do comando fica em `resultados/comando/<id>/`. Não execute simultaneamente outro laboratório/modelo durante medições.

## Validação desta integração

Na RTX 5070, os quatro pedidos HTTP reais em score 0,15 reproduziram: Centro **33 / 66** e Centro-norte **12 / 35** candidatos, respectivamente Controle / Multiescala. Uma instância do modelo foi reutilizada. Pico alocado observado pelo PyTorch: até **616,3 MiB**, sem representar toda a memória do processo/desktop. A primeira análise levou cerca de 25 s incluindo inicialização; as seguintes, nesta rodada, aproximadamente 0,6 a 2,4 s. Não são garantias de desempenho.

Os 24 testes automatizados passaram e cobrem coordenadas, máscaras, deduplicação, contrato HTTP, ocupado, resultado vazio, falha de GPU simulada e preservação de resultado anterior. A validação no navegador cobre execução real, troca de recorte, edição concorrente, persistência após recarga, exclusão, limpeza e acionamento da exportação. O GeoJSON fornecido pela API foi conferido; o salvamento final do download pelo navegador ainda precisa da validação do usuário. Não foi provocado um esgotamento real de VRAM.

As referências manuais ainda misturam árvores e outros verdes. Não há precisão/recall validado. Contornos detalhados, bairros, porcentagem de cobertura, regra 3-30-300 e seleção personalizada por chunks continuam fora desta entrega.
