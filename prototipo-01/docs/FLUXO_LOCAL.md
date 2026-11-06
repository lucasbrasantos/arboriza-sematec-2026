# Identificação local — Protótipo 01

## Uso

1. Inicie pelo F5: **Protótipo 01: interface**.
2. Escolha Centro ou Centro-norte em **Área de estudo**.
3. Escolha o perfil e o corte de score; clique em **Identificar possíveis árvores**.
4. Acompanhe a etapa real e a duração. O mapa continua navegável e editável.
5. Revise a nova camada com as ferramentas existentes e exporte o GeoJSON corrigido.

Se você trocar de recorte, editar pontos ou selecionar outra camada durante a análise, a nova camada será adicionada sem assumir a seleção atual. Se limpar o mapa, a análise em andamento ficará apenas no disco. Falhas preservam as camadas anteriores. Uma falha de conexão oferece **Acompanhar novamente**, sem repetir a análise.

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

## Seleção territorial — etapa 1

O painel **Seleção territorial** carrega os setores urbanos de Araçatuba da malha definitiva do Censo 2022. Clique em **Selecionar setores** para trocar temporariamente a barra de pontos pela barra territorial. Clique em setores para alterná-los ou use retângulo/desenho livre com os modos **Substituir**, **Adicionar** e **Remover**. O desenho precisa ter área, e setores apenas tocados pela borda não entram. A prévia destaca o setor inteiro e informa a área da união.

**Toda área urbana** seleciona todos os 499 setores classificados como urbanos no arquivo preparado, incluindo núcleos urbanos isolados. **Inverter** atua sobre esse conjunto; **Limpar** não apaga áreas salvas nem pontos. A fonte é um recorte estatístico de 2022 e não comprova o perímetro legal atual. A área é calculada em SIRGAS 2000 / UTM 22S; a geometria exibida e exportada é GeoJSON em WGS84.

Áreas nomeadas e a seleção temporária ficam no armazenamento deste navegador e desta origem. **Exportar área em GeoJSON** guarda a união e os IDs dos setores, com metadados e hash da fonte; a importação de pontos não importa áreas. Mudanças da malha são detectadas ao carregar uma área salva. Use o botão **Voltar aos pontos** para encerrar a seleção e restaurar a edição. A seleção não altera `studyArea`, não alimenta os endpoints de análise e não executa o modelo.

O arquivo da malha fica fora do Git em `data/territorial/`. O comando de preparação e os detalhes da fonte estão no [README](../README.md). A API informa erro recuperável se a malha não estiver disponível.

O servidor usa um processo e uma instância do modelo, carregada na primeira análise. Pedidos concorrentes recebem HTTP 409. Consultas e exportações continuam disponíveis. Reiniciar o servidor perde o acompanhamento das tarefas em memória; resultados concluídos permanecem importáveis no disco. Não há fallback silencioso para CPU.

| Endpoint | Função |
|---|---|
| `GET /api/recortes` | Recortes, limites e perfis disponíveis |
| `POST /api/analises` | `{recorte, perfil, score}` → `analysis_id` |
| `GET /api/analises/{id}` | Estado, etapa, duração e resumo |
| `GET /api/analises/{id}/geojson` | Pontos da análise concluída |
| `GET /api/territorio/setores` | Malha urbana local e metadados do IBGE |
| `POST /api/territorio/intersecoes` | IDs dos setores com interseção de área positiva com o desenho |
| `POST /api/territorio/resumo` | Contagem, limites e área da união dos setores selecionados |
| `POST /api/territorio/geojson` | GeoJSON da união e IDs dos setores selecionados |

Estados: `pendente`, `processando`, `concluida`, `erro`.

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
