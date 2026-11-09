# Instalação dos modelos de análise do Arboriza

Este guia prepara a API local para os modelos de visão computacional usados nas análises de copas. Ele complementa o [README do backend](README.md). O fluxo é voltado ao ambiente Windows/CUDA usado nos pilotos do Arboriza; não é um instalador universal.

## Máquina usada nos pilotos

As análises documentadas foram executadas nesta configuração:

| Componente | Configuração observada |
|---|---|
| Sistema | Windows 10 Pro, versão 22H2, build 19045 |
| Processador | AMD Ryzen 5 5600G, 6 núcleos / 12 threads |
| Memória RAM | 64 GiB instalados |
| GPU | NVIDIA GeForce RTX 5070, 12 GB de VRAM (12.227 MiB reportados pelo driver) |
| Driver NVIDIA | 621.14 na máquina validada |
| CUDA Toolkit para compilação | 12.8.61 |
| Python | 3.12.10 |
| PyTorch / torchvision | 2.7.1+cu128 / 0.22.1+cu128 |
| Compilador | MSVC 14.38, Build Tools 2022 |
| Detectron2 | Revisão `247691a1c292654867deb35cabb27f18d75a1363`, compilada para `sm_120` (RTX 5070) |
| Detectree2 | Revisão `39da1ba52e9392e54c2b29deef711f1b676bf86b` |

Essa é a estação de trabalho usada em todas as análises de imagem documentadas no projeto, inclusive nos experimentos do protótipo. **Não é uma configuração mínima comprovada.** Os ambientes Python variaram entre experimentos; a tabela registra a pilha do backend atual Cambridge/Restor. Os adaptadores Cambridge e Restor atuais exigem CUDA e não fazem fallback automático para CPU ou GPU AMD. Os requisitos mínimos de RAM e VRAM ainda não foram medidos em ensaios controlados. Um pico de memória observado num piloto Cambridge não representa o consumo total do desktop nem comprova o mínimo; o perfil combinado Restor + Cambridge também exige medição própria.

O público pode abrir o site e consultar o mapa sem GPU. A GPU é requisito do ambiente que executa as análises.

## Quais modelos são instalados

- **Detectree2 / Cambridge:** segmentação Mask R-CNN R101/FPN, com pesos urbanos publicados para Cambridge. O perfil Controle usa este modelo.
- **Restor TCD R50:** Mask R-CNN R50. O perfil v2 combina suas propostas com Cambridge e separa indivíduos, grupos e complementos pendentes.

São modelos pré-treinados de terceiros; a equipe não treinou os pesos do zero. As análises continuam sendo estimativas que precisam de revisão. O peso Restor está identificado com licença CC BY-NC; avalie suas condições antes de qualquer uso fora do contexto permitido.

DeepForest aparece em experimentos anteriores do protótipo e usa ambiente/versionamento distintos; não é necessário para instalar as famílias Cambridge e Restor usadas pela API atual.

## 1. Pré-requisitos de sistema

Use a GPU NVIDIA/CUDA e prepare:

1. Driver NVIDIA compatível com CUDA 12.8.
2. CUDA Toolkit 12.8, incluindo `nvcc`.
3. Microsoft Build Tools 2022 com ferramentas C++ e toolset MSVC 14.38.
4. Python 3.12 de 64 bits, Git e PowerShell.

Na combinação original, o toolkit ficou em `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8` e o `VsDevCmd.bat` em `C:\BuildTools\Arboriza2022\Common7\Tools\VsDevCmd.bat`. O script abaixo aceita outros caminhos pelos ambientes `ARBORIZA_CUDA_HOME` e `ARBORIZA_VSDEVCMD`, mas a versão do toolkit, toolset e arquitetura precisam continuar compatíveis.

Referências oficiais: [guia CUDA 12.8 para Windows](https://docs.nvidia.com/cuda/archive/12.8.0/cuda-installation-guide-microsoft-windows/index.html), [versões anteriores do PyTorch](https://docs.pytorch.org/get-started/previous-versions/) e [instalação do Detectron2](https://detectron2.readthedocs.io/en/latest/tutorials/install.html). O projeto validou a combinação registrada acima; a documentação oficial do Detectron2 não garante esta compilação Windows específica.

## 2. Criar o ambiente Python do backend

Abra PowerShell na pasta `app/backend`:

```powershell
py -3.12 --version
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements/requirements-detectree2-lock.txt
.\.venv\Scripts\python.exe -m pip install -r requirements/requirements-api.txt
```

O primeiro comando deve indicar Python `3.12.10` para reproduzir a pilha validada; se mostrar outra versão, instale/seleciona essa versão antes de criar a `.venv`. O arquivo `requirements-detectree2-lock.txt` fixa PyTorch, torchvision e as dependências geoespaciais do ambiente piloto. Ele **não instala** Detectron2 nem Detectree2: são compilado e biblioteca instalados nos passos seguintes. A `.venv` e os arquivos de dados/pesos não são enviados ao Git.

## 3. Compilar e instalar Detectron2 e Detectree2

Na pasta `app/backend`, obtenha a revisão exata do Detectron2 registrada nos resultados:

```powershell
New-Item -ItemType Directory -Force .cache/sources/detectron2 | Out-Null
git -C .cache/sources/detectron2 init
git -C .cache/sources/detectron2 remote add origin https://github.com/facebookresearch/detectron2.git
git -C .cache/sources/detectron2 fetch --depth 1 origin 247691a1c292654867deb35cabb27f18d75a1363
git -C .cache/sources/detectron2 checkout --detach FETCH_HEAD
```

Compile e instale o código usando o wrapper que seleciona CUDA/MSVC e compila para a arquitetura da RTX 5070:

```powershell
.\scripts\detectron2-windows.ps1 -m pip install --no-build-isolation --no-deps --no-cache-dir .cache/sources/detectron2
.\.venv\Scripts\python.exe -m pip install --no-deps "git+https://github.com/PatBall1/detectree2.git@39da1ba52e9392e54c2b29deef711f1b676bf86b"
```

O wrapper espera a `.venv` em `app/backend/.venv`. Por padrão usa os caminhos locais mostrados acima; para caminhos diferentes, defina `ARBORIZA_CUDA_HOME` e `ARBORIZA_VSDEVCMD` antes de executá-lo. Ele fixa `TORCH_CUDA_ARCH_LIST=12.0`, apropriado à RTX 5070. Não copie esse alvo ao usar outra GPU sem confirmar sua arquitetura e recompilar a extensão.

Confira a disponibilidade do runtime e da extensão compilada:

```powershell
.\.venv\Scripts\python.exe -c "import torch; from detectron2 import _C; print('GPU:', torch.cuda.get_device_name(0)); print('CUDA PyTorch:', torch.version.cuda); print('Detectron2 CUDA:', _C.has_cuda()); assert torch.cuda.is_available() and _C.has_cuda()"
```

## 4. Baixar os pesos dos modelos

### Cambridge

Baixe o arquivo para o diretório esperado pelo backend. O SHA-256 abaixo deve coincidir com o manifesto incluído no código:

```powershell
New-Item -ItemType Directory -Force modelos/detectree2 | Out-Null
$cambridge = 'modelos/detectree2/urban_trees_Cambridge_20230630.pth'
Invoke-WebRequest 'https://zenodo.org/records/15863800/files/urban_trees_Cambridge_20230630.pth?download=1' -OutFile $cambridge
if ((Get-FileHash $cambridge -Algorithm SHA256).Hash.ToLowerInvariant() -ne '3bcfc86ee2daff04cb894d2d9bf5d5bf95a74f6fe1df776353ce0d538b5d0075') { throw 'SHA-256 do peso Cambridge não confere com o manifesto.' }
```

O peso tem aproximadamente 503 MB. Origem, hash e licença CC BY 4.0: [manifesto Cambridge](arboriza_api/engine/models/cambridge-model.json) e [registro Zenodo](https://zenodo.org/records/15863800).

### Restor

O módulo baixa `config.yaml` e `model.pth` da revisão fixada, confere o hash do peso e grava um manifesto local:

```powershell
.\.venv\Scripts\python.exe -m arboriza_api.engine.models.restor
```

O peso Restor é obtido do [repositório oficial do modelo](https://huggingface.co/restor/tcd-mask-rcnn-r50), revisão `0b4a94d7c81d319826b79ad1868733ae869a1141`. O diretório resultante é `app/backend/modelos/restor-tcd-r50/`.

Os arquivos permanecem fora do Git. O backend não baixa os pesos durante a análise: prepare-os primeiro.

## 5. Adicionar os dados geográficos e iniciar

Além dos pesos, coloque as ortofotos, malha e dados viários preparados nos caminhos locais do backend, por padrão sob `app/backend/data/`. Esses dados não estão no Git. Consulte [fontes, aquisição e organização do acervo](../../prototipo-01/docs/ACERVO_URBANO_LOCAL.md) e a seção de caminhos no [README do backend](README.md). Ajuste `ARBORIZA_DATA_DIR` se usar outra pasta.

Inicie a API com um único worker:

```powershell
.\.venv\Scripts\python.exe -m uvicorn arboriza_api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Consulte `http://127.0.0.1:8000/api/health` para saber se a pasta de dados e os pesos Cambridge/Restor estão presentes. Isso confirma disponibilidade dos arquivos, não a qualidade das detecções. O frontend pode ser iniciado em outro terminal, seguindo o [README do frontend](../frontend/README.md).

## Limitações da reprodução

- A compilação original do Detectron2 foi validada em Windows 10 com CUDA 12.8, MSVC 14.38 e RTX 5070; outra combinação pode exigir ajustes e recompilação.
- O projeto não estabeleceu mínimos de CPU, RAM ou VRAM, nem garantiu suporte a CPU, AMD ou outras placas NVIDIA.
- Medições de tempo/VRAM dos pilotos não são benchmark controlado nem previsão para análise completa da cidade.
- Instalar pacotes e pesos não instala os dados geográficos, não valida a qualidade e não torna o serviço pronto para exposição pública.
- Revise as licenças dos pesos e bibliotecas para o uso pretendido; pesos e código podem ter termos diferentes.
