# Detectron2 no Windows — marco técnico

Validado em 05/11/2026 no Windows 10, com RTX 5070 de 12 GB. Este documento registra o marco técnico da instalação. A avaliação posterior em imagens reais está no [piloto Cambridge](EXPERIMENTO_CAMBRIDGE.md); os testes sintéticos abaixo não medem reconhecimento de árvores.

## Instalação validada

| Componente | Versão/local |
|---|---|
| Python | 3.12.10, ambiente `.envs/detectree2` |
| PyTorch / torchvision | 2.7.1+cu128 / 0.22.1+cu128 |
| CUDA Toolkit / nvcc | 12.8 / 12.8.61 |
| MSVC selecionado | 19.38.33145, toolset 14.38.33130 |
| Build Tools 2022 | 17.14.37827.9, `C:\BuildTools\Arboriza2022` |
| Detectron2 | 0.6, revisão `247691a1c292654867deb35cabb27f18d75a1363` |
| Arquitetura CUDA | `sm_120`, específica para a RTX 5070 |

O Detectron2 foi compilado do [código oficial](https://github.com/facebookresearch/detectron2/tree/247691a1c292654867deb35cabb27f18d75a1363), **sem patches no código-fonte**. A versão curta 0.6 não identifica sozinha a revisão utilizada. O projeto não oferece suporte oficial completo ao Windows; o resultado aqui é uma validação desta combinação local. [Instalação oficial](https://detectron2.readthedocs.io/en/latest/tutorials/install.html).

As versões Python foram fixadas em `requirements/requirements-detectron2-lock.txt`, separado dos requisitos DeepForest. A interface/F5 continuam usando `.venv`; não foi criado servidor novo.

Os componentes finais do Build Tools são `Microsoft.VisualStudio.Component.VC.CoreBuildTools`, `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` e `Microsoft.VisualStudio.Component.VC.14.38.17.8.x86.x64`. O pacote padrão instala também o toolset 14.44; o script seleciona explicitamente **14.38**, compatível com a combinação proposta. O componente IDE testado durante o diagnóstico foi removido desta instalação de Build Tools.

Foram selecionados os subpacotes CUDA `nvcc_12.8`, `cudart_12.8`, `thrust_12.8`, `cublas_dev_12.8`, `cusparse_dev_12.8`, `cusolver_dev_12.8` e `curand_dev_12.8`. Não foi solicitado driver novo ou Nsight. O driver permaneceu em 621.14. [Matriz CUDA/MSVC e subpacotes](https://docs.nvidia.com/cuda/archive/12.8.0/cuda-installation-guide-microsoft-windows/index.html).

## Repetir a validação

Na raiz `X:\-code-\arboriza-sematec`:

```powershell
.\prototipo-01\scripts\detectron2-windows.ps1
```

O helper prepara o ambiente de compilação somente para o processo atual e executa `check_detectron2.py`. Não precisa abrir um prompt de administrador. Ele não modifica o ambiente do DeepForest nem o launcher da interface.

O teste verifica CUDA disponível, extensão Detectron2 com CUDA, NMS comum/rotacionado, ROIAlign comum/rotacionado com paridade numérica CPU/GPU e um fluxo Mask R-CNN R101 completo com caixas e máscaras na GPU. Usa **entrada sintética neutra de 128 × 128 e pesos aleatórios**, sem baixar um modelo genérico COCO. As cinco saídas sintéticas não são árvores ou uma métrica de qualidade. Falhas retornam código diferente de zero e ficam no JSON; não há troca automática para CPU.

Resultado registrado: `resultados/detectron2-windows-marco-01/check-20261105T173229Z.json`. O teste passou e usou pico de 266,2 MiB alocados/274 MiB reservados pelo PyTorch. Isso não estima memória ou velocidade do futuro processamento de ortofotos com pesos treinados.

Nessa execução, o upstream emitiu um aviso de depreciação de `torch.meshgrid`, sem impedir o resultado. Os seis testes existentes em `tests.test_analysis` também passaram. Os hashes dos arquivos de interface/launcher amostrados e o `pip freeze` do ambiente original permaneceram iguais. O F5 não foi novamente exercitado pela interface gráfica nesta entrega.

## Recriar o ambiente Python

Os componentes de sistema acima precisam estar instalados antes destes comandos. Para uma instalação nova, dentro de `prototipo-01`, usando o executável Python 3.12 disponível na máquina:

```powershell
python -m venv .envs/detectree2
.\.envs\detectree2\Scripts\python.exe -m pip install -r requirements/requirements-detectron2-lock.txt
git init .cache/sources/detectron2
git -C .cache/sources/detectron2 remote add origin https://github.com/facebookresearch/detectron2.git
git -C .cache/sources/detectron2 fetch --depth 1 origin 247691a1c292654867deb35cabb27f18d75a1363
git -C .cache/sources/detectron2 checkout --detach FETCH_HEAD
.\scripts\detectron2-windows.ps1 -m pip install --no-build-isolation --no-deps --no-cache-dir .cache/sources/detectron2
.\scripts\detectron2-windows.ps1
```

Não recriar sobre o ambiente já validado sem necessidade. O helper contém os caminhos locais do Build Tools/Toolkit e a arquitetura 12.0 desta GPU; conferir esses valores ao reproduzir em outra máquina. Ao trocar PyTorch/CUDA, recompilar e validar novamente o Detectron2.

## Diagnóstico e espaço

A primeira compilação falhou com `Host compiler targets unsupported OS`. O MSVC antigo instalado como componente isolado não fornecia os scripts legados esperados pelo nvcc. O pacote padrão de ferramentas C++ forneceu `vcvarsall.bat`/`vcvars64.bat`; depois disso, um kernel CUDA compilado localmente retornou 42 na GPU e o Detectron2 compilou. Não foram criados scripts vazios ou usadas flags para ignorar incompatibilidade de compilador.

Um primeiro teste sintético com imagem preta gerou resultado vazio com pesos aleatórios. A entrada foi ajustada para a média dos pixels da rede, produzindo uma entrada normalizada neutra que exercita deterministicamente o caminho de caixas e máscaras. Ambos os relatórios foram preservados; essa escolha não altera o detector real ou suas futuras imagens.

O manifesto `resultados/detectron2-windows-marco-01/manifesto.json` registra revisão, hash da extensão, instaladores, arquivos de preservação e tamanhos. A pasta também guarda recibos das instalações e logs de compilação/validação. Tudo gerado permanece fora do Git.

| Diretório novo | Tamanho lógico aproximado |
|---|---:|
| Ambiente Python no projeto | 5,84 GiB |
| Fonte/build Detectron2 no projeto | 0,123 GiB |
| Instaladores no projeto | 0,017 GiB |
| Build Tools no sistema | 3,287 GiB |
| CUDA Toolkit no sistema | 0,356 GiB |

Espaço livre medido ao encerrar: aproximadamente **60,6 GiB em X:** e **61,8 GiB em C:**. Caches compartilhados do instalador e alterações de outros processos podem fazer a diferença física variar. Os novos diretórios `.envs/`, fontes, builds e relatórios estão ignorados.

Após autorização do usuário, o [piloto Cambridge](EXPERIMENTO_CAMBRIDGE.md) foi executado nos dois recortes. A comparação com flexi aguarda revisão dos resultados desse piloto.
