# Arboriza — diagnóstico e proposta da rodada 3

**Data:** 05/11/2026. **Situação:** diagnóstico e limpeza concluídos (seção 10). Detectron2 foi validado com CUDA no Windows (seção 12). Após autorização, o piloto Cambridge processou os dois recortes (seção 13); flexi e demais modelos aguardam a revisão do usuário.

Objetivo: comparar reconhecimento e localização de árvores visíveis em imagens urbanas de Araçatuba. Pontos são a saída principal; máscaras ficam como diagnóstico e não obrigam a acrescentar edição de contornos ao produto. A API e a interface aprovada permanecem fora desta rodada.

## 1. Confronto com a pesquisa recebida

Foi lido o relatório `C:\Users\lucas\OneDrive\Documentos\ChatGPT\Sematec\output\Pesquisa_IA_Mapeamento_Arvores_2026-11-05.md` e conferidos código, metadados, parâmetros, resultados e espaço em disco dos laboratórios. Os slides e o Q&A oficiais do seminário de Wellington corroboram a distinção entre copas, representação simplificada e atributos que dependem de outras fontes. O vídeo não foi novamente transcrito nesta análise.

As conclusões centrais são compatíveis com o experimento: quantidade semelhante à manual não comprova identificação; o HSV é posterior à proposta; os 68 pontos misturam classes; a diferença de resolução existe. A pesquisa de Wellington não fornece um checkpoint validado para Araçatuba, nem comprova que trocar RetinaNet por Mask R-CNN resolverá os erros locais. O Q&A também distingue atributos derivados de LiDAR daqueles observáveis em RGB. [Slides oficiais](https://www.landcareresearch.co.nz/assets/Events/Remote-sensing/2023/AI-powered-tree-mapping-in-urban-rural-and-forest-environments-presentation.pdf), [Q&A](https://www.landcareresearch.co.nz/assets/Events/Remote-sensing/2023/AI-powered-tree-mapping-in-urban-rural-and-forest-environments-QA.pdf).

## 2. Diagnóstico: evidência e hipótese

| Grupo de erro | Já comprovado localmente | Ainda precisa ser testado |
|---|---|---|
| Reconhecimento | Há propostas sobre objetos artificiais e omissões, inclusive no conjunto escuro grande do Centro. | Quanto decorre do domínio de treinamento, da resolução ou dos parâmetros. Não há taxa validada de FP/FN por classe. |
| Escala e janelas | Fonte com aproximadamente 0,244 × 0,260 m/pixel; o DeepForest documenta treino em 10 cm com recortes 400. Janelas menores mudaram fortemente os resultados. O redimensionamento interno observado foi mínimo 800 e máximo 1333 pixels. | Qual combinação de campo de visão, resolução e redimensionamento reduz erros. Uma janela de 160 pixels é uma ablação possível, não um vencedor presumido. |
| Deduplicação e individualização | A biblioteca aplica NMS por janela e agregação. A janela 200 gerou muitas subdivisões aparentes. As saídas atuais arquivam caixas após NMS. | Quantas propostas são duplicatas da mesma árvore, quantas pertencem a árvores vizinhas e quantas árvores foram suprimidas. Os registros atuais não permitem reconstruir todas as supressões anteriores. |
| Filtros posteriores | No Centro, janela 300/score 0,15: 79 propostas → 53 mantidas por HSV. Os 32 pares exploratórios até 3 m foram preservados. | Quantas árvores reais foram descartadas e quantos artificiais passaram. Preservar pares com referência mista não prova ausência de falsos negativos. |
| Localização/representação | A conversão pixel/coordenada e a leitura RGB foram verificadas anteriormente; não foi observado deslocamento sistemático nesses testes. | Separar caixa realmente sobre um telhado de caixa que contém copa, mas cujo centro fica fora dela. Um ponto sobre uma rua não basta, isoladamente, para classificar o objeto como falso. |

Não atribuir o problema atual ao antigo corte de 2.000 pixels do laboratório HQ-SAM: ele não é utilizado pelo detector DeepForest. Também não tratar HSV ou score como classificador infalível. [Orientação oficial do DeepForest sobre resolução e adaptação](https://deepforest.readthedocs.io/en/stable/user_guide/10_better.html).

## 3. Referência manual antes de medir qualidade

Preservar o arquivo original de 68 pontos e criar uma versão revisada, com identificadores estáveis, autor/revisor, data e vínculo ao hash da imagem. A revisão será humana; sugestões da IA não serão promovidas automaticamente a verdade de referência.

Classes propostas: `arvore_visivel`, `arbusto_ou_outro_verde`, `objeto_artificial`, `incerto` e `grupo_nao_individualizavel`. Incluir palmeiras identificáveis na classe árvore. Não inventar indivíduos escondidos sob outras copas. Casos sem informação visual suficiente ficam incertos; grupos ambíguos são anotados como regiões de exclusão para a métrica de indivíduos e relatados à parte.

Revisar os 68 cliques e **completar todas as árvores visíveis individualizáveis** dentro dos limites avaliados. Registrar também exemplos negativos de telhados, carros, quadras, sombras e gramados. A ausência de clique numa referência incompleta não é um negativo confirmado.

Os dois recortes atuais já foram inspecionados e seus limites até se sobrepõem parcialmente. Serão áreas de **calibração**, não teste cego. Proposta para o primeiro ciclo: acrescentar **quatro áreas urbanas novas**, de quarteirões/localizações distintos, sem sobreposição com calibração, da mesma fonte e escala aproximada. Fixar coordenadas, imagens e referências antes de avaliar os modelos. Com somente os dois recortes atuais, ainda é possível fazer um piloto, mas não declarar generalização.

Para ajuste fino posterior, obter outras áreas de treino separadas dessas quatro áreas de teste. Pontos bastam para a avaliação proposta de localização; Detectree2/DINO exigirão caixas ou máscaras apropriadas para treinamento, não caixas arbitrárias criadas silenciosamente ao redor dos cliques.

## 4. Comparação proposta e configurações

| Método | Configuração inicial/proposta de calibração | Saída comum |
|---|---|---|
| DeepForest atual | Preservar p300/0,15 sem HSV como controle rastreável, além dos resultados p400 existentes. Ablação nativa de 160/200/300/400 pixels e interpolação para 10 cm, com janelas 400 e 1000. | Centro da caixa. |
| Detectree2 Cambridge | Peso `urban_trees_Cambridge_20230630.pth`, configuração Mask R-CNN associada; campos de visão de 100 e 200 m na calibração, começando pela recomendação urbana de aproximadamente 200 m. | Centro da caixa; máscara guardada para diagnóstico. |
| Detectree2 flexi | Peso `250312_flexi.pth`, com sua configuração associada; comparar os mesmos campos de visão de 100 e 200 m. | Centro da caixa; máscara guardada. |
| CanopyRS DINO + Swin-L | Peso multiconjunto `dino-swin-l-384-multi-NQOS`; somente detector, sem SAM 2/3 e sem o segundo checkpoint ajustado em SelvaMask nesta primeira rodada. | Centro da caixa. |
| SAM 3 por texto, opcional | Imagens estáticas, independente das caixas do DeepForest. Comparar `tree` e `tree canopy` só na calibração e congelar o texto antes do teste. Usar SAM 3 como proposto, sem trocar automaticamente para SAM 3.1. | Centro da caixa; máscaras como diagnóstico. |

A ablação de escala mantém comparações de campo físico: aproximadamente 40 m (160 pixels nativos versus 400 interpolados a 10 cm) e 100 m (400 nativos versus 1000 interpolados). A interpolação preserva georreferenciamento, mas **não cria detalhe capturado a 10 cm**. Esses valores são aproximados, pois o raster atual tem pixels ligeiramente diferentes nos dois eixos. Registrar também o redimensionamento realmente aplicado pela rede.

Para o CanopyRS, fazer primeiro um teste de viabilidade com entrada pequena, lote 1 e precisão mista quando suportada. Depois calibrar a configuração geográfica. Seu preset publicado usa 1777 pixels, GSD de 4,5 cm e sobreposição 75%; não aplicá-lo cegamente como se nossa fonte tivesse essa resolução. Comparar a entrada derivada da fonte atual com reamostragem explícita, mantendo as transformações registradas. Reduzir a entrada para resolver memória é uma alteração experimental e deve ser registrada. [Preset e requisitos](https://hugobaudchon.github.io/CanopyRS/user-guide/presets/), [configuração do detector](https://github.com/hugobaudchon/CanopyRS/blob/main/canopyrs/config/detectors/dino_swinL_multi_NQOS.yaml).

Primeiro comparar os modelos **sem HSV e sem realce de saturação/contraste**. Depois aplicar o HSV atual como ablação separada. Scores terão cortes próprios por modelo, escolhidos na calibração; não impor 0,15 a todos. Registrar propostas por janela antes da agregação, coordenadas globais, parâmetros e motivos de supressão/filtragem, evitando atribuir ao reconhecimento uma perda causada pelo pós-processamento. Calibrar também agregação/NMS; proximidade entre duas árvores reais não autoriza removê-las como duplicatas.

## 5. Métricas e escolha

- Correspondência principal um-a-um entre pontos e referência revisada, em UTM 22S. Proposta inicial: raio máximo de 3 m, acompanhado da sensibilidade em 2 e 5 m; fixar a regra antes do teste reservado. Usar a mesma convenção de centro de caixa nos métodos para não misturar diferenças de representação com reconhecimento.
- Precisão = TP/(TP+FP), recall = TP/(TP+FN), F1 e resultados por área. Incluir cortes e curvas precisão-recall; score não é probabilidade calibrada de acerto.
- Contagem: diferença assinada e erro absoluto por área; erro relativo somente quando a referência não for vazia. Áreas sem árvores continuam importantes para medir falsos positivos.
- Duplicações: propostas extras associáveis à mesma árvore já correspondida contam como FP e recebem essa categoria de erro; revisar ambiguidades com árvores vizinhas. Registrar também fusões/grupos quando identificáveis.
- Localização: distância dos pares associados e análise separada de sombras, copas pequenas, copas encostadas e objetos artificiais.
- Operação: carga inicial, inferência aquecida, tempo total, pico de memória alocada/reservada e condição do desktop. Não comparar tempos frios de uma rede com tempos aquecidos de outra.
- Correção manual: medir tempo ativo, adições, exclusões e movimentos necessários para chegar ao mesmo critério final. Variar a ordem das camadas para reduzir efeito de aprendizado; registrar o tempo manual sem IA como comparação, quando possível.

Os parâmetros serão escolhidos apenas na calibração. A proposta de decisão é recomendar um substituto quando reduzir o tempo de correção e não piorar o equilíbrio de detecção do controle no teste reservado, examinando precisão e recall separadamente. Se houver troca entre omissões e falsos positivos, apresentar o compromisso ao usuário em vez de forçar um vencedor. Quatro áreas são um piloto; diferenças pequenas não comprovam superioridade estatística ou validade rural/florestal.

## 6. Dependências e RTX 5070 de 12 GB

O DeepForest atual já executou com CUDA nessa GPU. Isso **não valida os operadores compilados dos outros modelos**.

- Detectree2 depende de Detectron2, PyTorch/torchvision compatíveis, bibliotecas geográficas e extensões C++/CUDA. Windows não tem suporte oficial completo do Detectron2. [Instalação oficial](https://detectron2.readthedocs.io/en/latest/tutorials/install.html).
- CanopyRS usa Detrex/Detectron2 compilados, GDAL e dependências próprias. O projeto fixa torch 2.7.1/torchvision 0.22.1 e NumPy < 2, diferentes do ambiente atual. Não instalar sobre o `.venv` do controle. Linux é recomendado pelos autores; Windows é descrito como possível e mais trabalhoso. [Instalação](https://hugobaudchon.github.io/CanopyRS/getting-started/installation/), [dependências](https://github.com/hugobaudchon/CanopyRS/blob/main/pyproject.toml).
- Para Blackwell, validar uma combinação com CUDA 12.8 e compilação para a arquitetura da GPU. Não copiar automaticamente a instrução cu126 do tutorial do pipeline. O suporte Blackwell foi introduzido no PyTorch 2.7 com CUDA 12.8. [PyTorch](https://pytorch.org/blog/pytorch-2-7/).
- SAM 3 possui requisitos próprios e acesso aos pesos sujeito a aceite no Hugging Face. A documentação recomenda Python 3.12+; seu pacote restringe NumPy < 2. Isso também justifica isolamento. Não foi verificado acesso da conta do usuário nem feita autenticação. [Repositório oficial](https://github.com/facebookresearch/sam3).

Na inspeção inicial, foram encontrados Visual Studio com ferramentas C++, mas não `nvcc` no PATH nem `CUDA_PATH`. O comando WSL não listou uma distribuição utilizável nessa sessão. Essa inspeção não validava a toolchain. A escolha posterior por Windows e a validação técnica estão registradas nas seções 11 e 12.

O preset DINO + Swin-L informa aproximadamente **10 GB de memória de GPU**, inclusive na configuração somente detector. Logo, 12 GB tornam a tentativa plausível, mas com pouca folga para o Windows e o navegador. Começar com lote 1, uma rede por vez, inferência sem gradientes e blocos pequenos; liberar o processo entre famílias. Detectree2 deve passar por teste de NMS/ROIAlign CUDA; DINO, pelos operadores de atenção deformável; depois carregar o checkpoint e executar uma imagem pequena. Não anunciar viabilidade confirmada antes disso.

Para SAM 3, começar por uma imagem/bloco, sem vídeo ou processamento simultâneo. O tamanho do arquivo de pesos não é uma estimativa suficiente de VRAM. Treinamento completo de Swin-L/SAM 3 não faz parte desta proposta; eventual ajuste fino será outra etapa, dimensionada após a comparação.

## 7. Espaço dos modelos: metadados consultados, sem download

GiB = 1.073.741.824 bytes. Valores abaixo são dos arquivos específicos necessários, não de repositórios inteiros.

| Checkpoint | Bytes | GiB |
|---|---:|---:|
| Detectree2 Cambridge | 503.062.799 | 0,469 |
| Detectree2 flexi | 503.063.232 | 0,469 |
| CanopyRS DINO + Swin-L multiconjunto | 2.622.868.490 | 2,443 |
| SAM 3 `sam3.pt`, opcional | 3.450.062.241 | 3,213 |
| **Rodada principal, sem SAM 3** | **3.628.994.521** | **3,380** |
| **Com SAM 3** | **7.079.056.762** | **6,593** |

Fontes de tamanho: [API oficial do Zenodo](https://zenodo.org/api/records/15863800), [metadados CanopyRS no Hugging Face](https://huggingface.co/api/models/CanopyRS/dino-swin-l-384-multi-NQOS?blobs=true), [metadados SAM 3](https://huggingface.co/api/models/facebook/sam3?blobs=true). Revisão CanopyRS consultada: `b7fba7c6ccc150a26c4a0fbb8d7575939601b664`; SAM 3: `3c879f39826c281e95690f02c7821c4de09afae7`. Registrar novamente revisões e checksums antes da execução aprovada.

O SAM 3 também oferece `model.safetensors` de aproximadamente 3,20 GiB. Baixar **um formato**, de acordo com o carregador adotado, e não os dois. Não baixar também o DINO ajustado em SelvaMask: seria outro arquivo de 2,443 GiB, sem necessidade para o primeiro ciclo urbano. Evitar pesos de SAM 2 ou outros segmentadores quando a etapa é somente detector.

**Orçamento de planejamento, não medição de uma instalação já feita:** reservar aproximadamente **25–35 GiB adicionais** para a rodada principal, incluindo os 3,38 GiB de pesos, ambientes isolados, Linux/toolchain se necessários e temporários de compilação. Com SAM 3 e outro ambiente, planejar **35–45 GiB**. A faixa depende do reaproveitamento comprovadamente compatível de dependências; três cópias independentes de PyTorch/CUDA e ferramentas podem ultrapassá-la. Instalar por etapas e reavaliar o espaço a cada família.

O usuário informou 46 GB livres. A inspeção deste momento retornou aproximadamente **56,34 GiB livres em X:** e **65,61 GiB em C:**; o valor varia. Usar os 46 GB informados como orçamento conservador. Os pesos cabem; o risco de espaço está nas dependências, compilações, duplicação de caches e eventual disco virtual WSL. Definir sua localização e limite antes de instalar; WSL pode ocupar C: por padrão.

Não baixar datasets completos de treinamento nesta primeira rodada. Usar os pequenos recortes e referências locais. Instalar sem manter caches grandes de download e evitar copiar o mesmo checkpoint para cada execução.

## 8. Limpeza proposta, ainda não executada

Inventário por tamanhos lógicos dos arquivos, sem seguir links simbólicos; o espaço físico liberado pode diferir.

| Local/ação proposta | Espaço estimado recuperável | Preservação |
|---|---:|---|
| Remover `X:\-code-\segmentacao-teste\back\.venv` | 4,750 GiB | Manter requisitos, código e informações do ambiente nos relatórios. |
| Remover `X:\-code-\segmentacao-teste\back\sam_hq_vit_h.pth` | 2,394 GiB | Guardar origem, hash e instrução de novo download. |
| Remover `X:\-code-\segmentacao-teste\front\node_modules` | 0,111 GiB | Manter manifests/lockfiles do frontend. |
| Remover `X:\-code-\arboriza-sematec\prototipo-01\.cache\pip` | 2,975 GiB | Ambiente instalado e requirements-lock permanecem. |
| **Total principal** | **10,230 GiB** | Sem remover imagens, marcações ou evidência das avaliações. |

O laboratório antigo inteiro ocupa 7,446 GiB. Remover os três itens propostos libera 7,255 GiB e deixa aproximadamente 0,191 GiB de código, Git, dados, uploads e relatórios. Há alterações staged, unstaged e arquivos novos nos dois clones; apagar as pastas inteiras descartaria trabalho ainda não commitado. A recomendação é desativar o laboratório, preservando esse arquivo leve, ou produzir um backup leve verificado antes de excluir sua estrutura.

No protótipo atual, manter:

- `.venv` (5,329 GiB), pois contém o controle DeepForest e é utilizado pelo F5;
- `.models/deepforest-tree` (0,120 GiB);
- `.cache/torch` (0,095 GiB), que contém o backbone ResNet50 necessário ao carregamento offline e conferido pelo código;
- as imagens, seus metadados e os 68 pontos originais;
- `20261105T063853Z-2589c5` (bateria inicial, inclusive resultados vazios), `20261105T064446Z-f49246` (0,15 e comparação manual) e `rodada-02-20261105` (escala/cor, script e logs).

Os resultados atuais totalizam apenas **27,35 MiB**. Os controles anteriores continuam relevantes para a pesquisa e não devem ser excluídos só por serem antigos. `entrega-01` é uma cópia de conveniência de aproximadamente 33 KiB, e `diagnostico-cor-preliminar` ocupa aproximadamente 12 KiB; removê-los não libera espaço significativo e exigiria atualizar referências. Só retirar duplicatas/diagnósticos auxiliares após inventário e eventual arquivamento, sem sacrificar a rastreabilidade.

Não limpar caches globais de outros projetos. Não remover `.git`, código, lockfiles ou marcações sem destino de preservação definido. Antes de uma exclusão aprovada: conferir caminhos absolutos, links e processos que utilizam os diretórios; registrar o inventário e verificar cópias/hashes preservados. A execução posterior aprovada está registrada na seção 10.

## 9. Ordem de execução após confirmação

1. Confirmar o destino do laboratório antigo e o ambiente de execução dos novos modelos. Registrar o estado e preservar os arquivos únicos.
2. Limpar somente os caminhos aprovados e medir o espaço efetivamente recuperado. Confirmar que F5 e o controle DeepForest continuam funcionais.
3. Organizar/revisar a referência e congelar a separação espacial. Selecionar as quatro novas áreas de teste; não calibrar nelas.
4. Validar a toolchain CUDA e os operadores compilados antes de baixar todos os checkpoints. Instalar uma família por vez, sem modificar o ambiente do controle.
5. Executar DeepForest como controle e ablação de escala; Detectree2 urbano/flexi; DINO multiconjunto somente detector. SAM 3 é um passo adicional condicionado a acesso, disco e VRAM.
6. Calibrar parâmetros, congelá-los e avaliar o teste reservado. Exportar pontos, scores, diagnósticos anteriores/posteriores aos filtros, métricas por área e custo de correção manual.
7. Apresentar a comparação para decisão. Se o peso pronto ainda for insuficiente, planejar ajuste fino com áreas de treino adicionais e negativos difíceis, sem reutilizar o teste reservado para escolher parâmetros.

**Decisões atualizadas:** o usuário escolheu preservar o arquivo leve do laboratório antigo e remover apenas as dependências/peso. Expressou preferência por Windows e solicitou esclarecimentos sobre WSL/desempenho; nenhum WSL foi autorizado ou instalado. A proposta passa a priorizar uma verificação de viabilidade nativa Windows, deixando WSL2 como alternativa caso os componentes compilados impeçam a execução. SAM 3 permanece opcional. Isso não valida uso rural/florestal nem autoriza integrar a API.

## 10. Limpeza executada após confirmação — 05/11/2026

Foram removidos somente `segmentacao-teste/back/.venv`, `segmentacao-teste/front/node_modules`, `segmentacao-teste/back/sam_hq_vit_h.pth` e `prototipo-01/.cache/pip`. Os caminhos absolutos e a ausência de links/junctions nos ancestrais foram conferidos antes da exclusão; não foram identificados processos Python/Node pelos caminhos do laboratório antigo.

Foram registrados e comparados os hashes SHA-256 dos **355 arquivos preservados**, sem diferenças. O estado staged/unstaged/untracked dos dois clones também foi preservado. A medição de espaço livre em X: aumentou aproximadamente **10,30 GiB**, chegando a **66,64 GiB** naquele momento. Essa diferença física pode variar em relação ao tamanho lógico do inventário.

O ambiente do Protótipo 01, seus pesos DeepForest e o backbone ResNet50 foram mantidos. Seus hashes foram conferidos contra o manifesto, e o launcher foi exercitado com `--help`. Não houve nova inferência nesta limpeza. Manifestos e registro das remoções: `prototipo-01/resultados/limpeza-laboratorio-20261105/`.

### Windows e WSL: critério para a próxima decisão

WSL2 executa Linux dentro do Windows e pode usar a mesma GPU por CUDA. Não aumenta os 12 GB de VRAM nem é uma solução de reconhecimento de árvores. Não foi medido desempenho comparativo nesta máquina. [NVIDIA](https://docs.nvidia.com/cuda/wsl-user-guide/index.html).

O motivo para considerar WSL é a compatibilidade das ferramentas Linux de Detectron2/Detrex. Para operações com muitos arquivos, a Microsoft recomenda manter ambientes e dados utilizados pelo Linux no filesystem Linux, evitando depender de acessos repetidos a `/mnt/x` durante compilação/execução. Isso precisa ser considerado no planejamento do disco virtual e das cópias de dados. [Microsoft](https://learn.microsoft.com/en-us/windows/wsl/filesystems).

Respeitando a preferência do usuário, propor primeiro um teste Windows nativo em ambiente isolado: conferir CUDA Toolkit/compilador e validar os operadores CUDA necessários antes de baixar todos os checkpoints. Se isso exigir adaptações excessivas ou não for compatível, apresentar o bloqueio e decidir a adoção de WSL com o usuário. O protótipo e seu F5 podem continuar no Windows em qualquer uma das alternativas.

## 11. Plano escolhido: Windows → Detectron2 → Detectree2

### Direção e limites

Detectron2 é o framework; Detectree2 fornece a aplicação e os pesos voltados a copas. Validaremos primeiro o framework na GPU e depois o reconhecimento com pesos de árvores. Usar um detector genérico COCO não substituiria esse experimento.

O resumo recebido do Google é uma sugestão de candidatos, não uma comprovação de superioridade. O peso Cambridge foi treinado em ambiente urbano, mas sua precisão em Araçatuba ainda não foi medida. O SAM 2 oferece segmentação guiada por pontos/caixas: nesse fluxo, depende da identificação inicial dos objetos. Não garante reconhecimento de árvores nem contornos perfeitos. [Pesos Detectree2](https://github.com/PatBall1/detectree2/blob/master/model_garden/README.md), [SAM 2](https://github.com/facebookresearch/sam2).

Continuaremos produzindo **pontos de possíveis árvores**. Máscaras serão diagnósticos opcionais. CanopyRS, SAM e integração com a API ficam para decisões posteriores à revisão deste experimento.

### Marco 1 — instalação nativa e validação técnica

**Constatado na inspeção anterior à instalação:** Windows 10 build 19045; RTX 5070 de 12 GB; Visual Studio 2026, versão 18.8, com toolset MSVC 14.51. O Windows SDK 10.0.26100.0 estava presente. Não foi encontrado CUDA Toolkit no diretório padrão, `CUDA_PATH` ou `nvcc` no PATH. A execução anterior do DeepForest usa o runtime do PyTorch e não comprovava disponibilidade de compilador CUDA.

**Combinação inicial proposta, ainda não validada:** Python 3.12, PyTorch 2.7.1/cu128, torchvision 0.22.1, CUDA Toolkit 12.8 e MSVC v143 14.38, com Build Tools 2022 instalado lado a lado caso necessário. A matriz CUDA 12.8 lista MSVC 193x/VS 2022; o compilador padrão encontrado é de outra família. Não usar uma opção para ignorar a verificação do compilador como solução inicial. [CUDA Windows](https://docs.nvidia.com/cuda/archive/12.8.0/cuda-installation-guide-microsoft-windows/index.html), [componente MSVC](https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools?view=vs-2022), [Blackwell no PyTorch](https://pytorch.org/blog/pytorch-2-7/).

Preparar um ambiente em `prototipo-01/.envs/detectree2`, acrescentando o caminho ao ignore antes de criá-lo. Manter fontes e temporários em `.cache` e pesos em `.models/detectree2`. Não instalar as dependências sobre o `.venv` atual. Selecionar componentes de desenvolvimento necessários, preservando o driver NVIDIA e a instalação atual do Visual Studio.

Compilar Detectron2 de uma revisão registrada para a arquitetura real da GPU. Validar ambiente, extensão compilada, operações CUDA de NMS/ROIAlign e uma inferência Mask R-CNN. Registrar versões, comandos, logs, memória e qualquer adaptação local. Uma importação bem-sucedida ou execução somente em CPU não encerra o marco. O projeto não oferece suporte oficial completo a Windows; compatibilidade local permanece uma hipótese até esses testes. [Instalação Detectron2](https://detectron2.readthedocs.io/en/latest/tutorials/install.html).

**Decisão antes da instalação:** alinhar a preparação do Toolkit/Build Tools, pois instala componentes fora do ambiente do projeto. **Entrega:** prova técnica Windows/CUDA e instrução reproduzível. Se houver bloqueio, apresentar erro e alternativas para decisão; não migrar automaticamente de sistema ou GPU para CPU.

### Marco 2 — primeiro piloto com o peso Cambridge

Após validar o marco 1, baixar somente `urban_trees_Cambridge_20230630.pth`, conferir checksum e registrar revisão do código, configuração associada e origem dos pesos.

Executar sequencialmente Centro e Centro-norte, RGB original, lote 1, trabalhadores 0, sem filtro HSV. Começar com campo de visão de aproximadamente **200 m**, recomendado pelos autores para esse peso; calcular janelas a partir da escala real e registrar redimensionamento, sobreposição e agregação. Uma sobreposição inicial de 25% será parâmetro experimental, não garantia de deduplicação. [Model garden](https://github.com/PatBall1/detectree2/blob/master/model_garden/README.md).

Salvar caixas/scores por janela antes da agregação, resultado agregado, razões de descarte, parâmetros e tempos. Exportar centros de caixas em WGS84, imagens de diagnóstico e JSON da execução, compatíveis com a importação atual. Preservar máscaras compactadas se fornecidas pelo modelo; registrar se o centro da caixa não cair na máscara, sem trocar silenciosamente a convenção de posição.

Reaproveitar leitura geográfica e geração de artefatos com alterações pequenas: desacoplar do DeepForest os metadados e funções comuns que hoje estão ligados a `detector.py`. Acrescentar um adaptador Detectree2 e um comando de experimento; não criar servidor ou camadas abstratas genéricas.

**Entrega e pausa:** revisar a copa escura conhecida, árvores pequenas, copas próximas e negativos como telhados/ruas. Importar os pontos na interface aprovada. Registrar funcionamento e erros observados, sem métricas de precisão sobre os 68 pontos mistos.

### Marco 3 — comparação controlada após sua revisão

Baixar `250312_flexi.pth` e comparar com Cambridge e DeepForest atual. Começar flexi em aproximadamente 100 m, conforme orientação dos autores; avaliar 100/200 m na calibração. Comparar cortes próprios por modelo, inicialmente 0,15/0,30/0,50 como valores exploratórios, guardando o piso de inferência e os parâmetros de NMS. Esses scores não são probabilidades nem têm significado equivalente entre modelos.

Revisar a referência manual conforme seção 3. Usar os dois recortes atuais para calibração; reservar áreas novas distintas antes de afirmar desempenho fora desses exemplos. Sem novas áreas, apresentar somente resultado de piloto.

Aplicar as métricas da seção 5: precisão/recall com correspondência um-a-um, duplicações, erro de contagem/localização, memória/tempo e tempo de correção humana. Comparar primeiro sem filtro de cor; filtros e realces serão ablações identificadas. Escolher parâmetros na calibração e congelá-los antes do teste reservado. Um modelo será recomendado pelos erros e esforço de revisão, nunca apenas por produzir quantidade semelhante a 68.

**Entrega e pausa:** apresentar resultados por área e compromisso entre omissões e falsos positivos. Decidir com o usuário se vale integrar, ajustar o modelo com exemplos locais ou testar CanopyRS/SAM.

### Armazenamento e decisões

Os dois pesos Detectree2 consultados somam aproximadamente **0,94 GiB**: Cambridge 0,469 GiB e flexi 0,469 GiB. O primeiro download será somente Cambridge. [Metadados dos arquivos](https://zenodo.org/api/records/15863800).

Para esta família no Windows, reservar inicialmente **15–25 GiB adicionais**, somando ambiente, compiladores/Toolkit, builds e temporários em C: e X:. Trata-se de orçamento conservador, não tamanho medido dos instaladores selecionados. Conferir ambos os volumes e o orçamento real antes da instalação; não baixar todas as famílias de modelos de uma vez. Após a limpeza, X: tinha aproximadamente 66,64 GiB livres.

**Validações com o usuário:** preparação dos componentes do sistema; entrega técnica do marco 1; resultado visual do Cambridge; comparação final e eventual integração. Escolhas rotineiras dentro do marco aprovado podem ser executadas e registradas sem uma pergunta por comando. Não alterar a interface, F5, marcações ou controles anteriores nesta rodada.

## 12. Marco 1 executado — Detectron2/CUDA nativo Windows

Após autorização do usuário, foram instalados seletivamente Build Tools 2022 e CUDA Toolkit 12.8. O ambiente `prototipo-01/.envs/detectree2` utiliza Python 3.12.10, PyTorch 2.7.1+cu128 e torchvision 0.22.1+cu128. O Detectron2 foi compilado da revisão `247691a1c292654867deb35cabb27f18d75a1363` com MSVC 19.38.33145 para `sm_120`, sem patches no código-fonte.

Passaram: kernel CUDA compilado localmente; NMS comum/rotacionado; ROIAlign comum/rotacionado com paridade CPU/GPU; fluxo Mask R-CNN R101 de caixas e máscaras em CUDA. A inferência utilizou entrada sintética neutra 128 × 128 e pesos aleatórios, portanto **não valida reconhecimento de árvores nem estima desempenho em ortofotos**. Os testes existentes de georreferenciamento passaram (6), e hashes de controle/dependências do ambiente anterior foram preservados. A interface e o launcher não foram alterados; não houve novo teste gráfico do F5.

O marco ocupa aproximadamente 5,98 GiB no projeto e 3,64 GiB nos diretórios das ferramentas de sistema. Na medição final, X: tinha 60,6 GiB livres e C: 61,8 GiB. Os pesos Cambridge/flexi ainda não foram baixados.

Instruções e versões: `prototipo-01/DETECTRON2_WINDOWS.md`. Resultados, manifesto, recibos e logs: `prototipo-01/resultados/detectron2-windows-marco-01/`. O piloto Cambridge foi posteriormente autorizado e executado, conforme seção 13.

## 13. Piloto Cambridge executado — aguardando revisão

O peso oficial Cambridge, com 503.062.799 bytes, foi baixado do Zenodo e conferido por MD5/SHA-256. Detectree2 2.1.2 (revisão `39da1ba52e9392e54c2b29deef711f1b676bf86b`) executou sobre os RGB8 originais, sem realce ou HSV, com modelo único reutilizado e lote 1. O emulador mobile do usuário estava aberto; não houve erro de memória.

Com janelas de aproximadamente 200 m e NMS global de caixas IoU 0,5, os cortes 0,15/0,30/0,50 geraram **33/22/13 candidatos no Centro** e **12/6/4 no Centro-norte**. Antes da agregação global havia 66 e 23 propostas, respectivamente. Essa agregação é explícita do piloto, não a limpeza nativa de polígonos do Detectree2. Scores não são probabilidades, nem equivalem ao mesmo corte no DeepForest.

Na inspeção visual, houve uma proposta para a copa escura grande antes omitida pelo DeepForest p300/0,15; ela agrupa a região em um único ponto, sem validar número de indivíduos. Persistem omissões e uma possível duplicação de borda a revisar na agregação. Não foram calculados precisão/recall ou declarado vencedor.

Foram gerados seis GeoJSONs, diagnósticos, comparações visuais, configurações e máscaras RLE das 89 propostas pós-NMS nativo. A validação conferiu alinhamento, máscaras, contrato de importação/edição/exportação da interface e preservação de 106 arquivos. Os 11 testes do ambiente novo e os seis testes de regressão no ambiente DeepForest passaram. A interface/API não foram alteradas.

Documentação da entrega: `prototipo-01/EXPERIMENTO_CAMBRIDGE.md`. Resultados: `prototipo-01/resultados/detectree2-cambridge-piloto/20261105T175332Z-9697ec/`. A próxima comparação/alteração de estratégia aguarda feedback do usuário.
