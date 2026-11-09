# Arboriza — API FastAPI

API e motor de processamento do Arboriza, conectados ao portal administrativo local.

> A pasta `.venv` não é incluída no Git. O comando abaixo funciona no ambiente preparado desta máquina; em outro computador, será necessário criar um ambiente Python 3.12 e instalar dependências compatíveis. Detectron2/Detectree2 têm componentes compilados para CUDA e não possuem uma instalação genérica garantida no Windows. Dados, imagens e pesos também precisam ser obtidos/preparados à parte.

### Hardware usado nas análises

Os pilotos foram executados em Windows 10 Pro com AMD Ryzen 5 5600G (6 núcleos / 12 threads), 64 GB de RAM e NVIDIA GeForce RTX 5070 (12 GB de VRAM). A pilha Cambridge/Restor foi validada com Python 3.12.10, PyTorch 2.7.1+cu128, torchvision 0.22.1+cu128, CUDA Toolkit 12.8.61 e Detectron2 compilado para `sm_120`. Esses dados descrevem a máquina testada; não estabelecem mínimos de hardware. Para preparar os modelos numa instalação nova, siga o [guia de instalação de modelos](INSTALACAO_MODELOS_IA.md).

## Execução local

No PowerShell, em `app/backend`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn arboriza_api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

A documentação fica em `http://127.0.0.1:8000/docs`. Use um processo/worker; uma trava impede duas instâncias com o mesmo banco. Esta versão ainda não foi preparada para exposição na internet. Consulte `requirements/requirements-api.txt` e `requirements/requirements-detectree2-lock.txt` como registros de versões, não como garantia de instalação automática em qualquer máquina; Detectron2 e Detectree2 são preparados separadamente.

A API fornece duas famílias de modelos: Controle (Cambridge) e Modelo v2 (Restor + Cambridge). `GET /api/analises/perfis` retorna `modelos` com as duas famílias e `perfis` com as variações técnicas disponíveis, incluindo fontes diferentes do Controle e o perfil multiescala experimental histórico. O modelo v2 usa somente o acervo local; grupos e complementos são distintos de indivíduos.

## Pastas

- `arboriza_api/access`: autenticação, usuários e criação inicial.
- `arboriza_api/core`: configuração e banco.
- `arboriza_api/analyses`, `territory`, `streets`: contratos e rotas.
- `arboriza_api/imagery`: tiles transparentes do acervo local para o mapa.
- `arboriza_api/engine`: motor, dividido em `models`, `imagery`, `inference` e `geography`.
- `modelos`: pesos e metadados dos modelos, ignorados pelo Git.
- `data`: ortofotos, malha e acervo de ruas compartilhados com o protótipo.
- `banco/arboriza.sqlite`: usuários, sessões e execuções.
- `cache`: caches de processamento do motor.
- `resultados`: arquivos produzidos por análises.

`ARBORIZA_DATABASE`, `ARBORIZA_DATA_DIR`, `ARBORIZA_RESULTS_DIR`, `ARBORIZA_MODELS_DIR` e `ARBORIZA_CACHE_DIR` permitem configurar caminhos. Banco, dados, modelos e resultados são ignorados pelo Git e precisam de backup; guardar banco e resultados de forma consistente.

O ambiente `.venv` foi criado nesta máquina com Python 3.12 e os pacotes do ambiente validado do protótipo foram copiados para ele. O executável, as bibliotecas e a extensão CUDA estão no backend, mas a venv depende da instalação base do Python e não deve ser considerada portátil para outro computador. As listas de versões estão em `requirements/`. Detectron2/Detectree2 incluem componentes nativos compilados para esta combinação Windows/CUDA; reconstruir um ambiente em outra máquina exige instalação/compilação compatível e validação própria.

`python -m arboriza_api.access.bootstrap` cria interativamente o primeiro administrador somente se não houver usuários. A autenticação retorna bearer token com expiração; apenas administradores gerenciam usuários.

### Conta local para demonstração

Para reproduzir o acesso administrativo no clone local, com o backend parado ou em execução, use um banco ainda sem usuários:

```powershell
.\.venv\Scripts\python.exe -m arboriza_api.access.demo_admin
```

O comando cria `demo` / `ArborizaDemo2026!` somente quando a tabela de usuários está vazia. Se já houver alguém cadastrado, encerra sem alterar nada. Essa credencial é pública e serve apenas para desenvolvimento local em `127.0.0.1`; não a use em uma instalação acessível pela internet. Para outro ambiente, crie uma senha própria com `python -m arboriza_api.access.bootstrap`.

## Limites

Uma análise interrompida por reinício fica marcada como erro e não é retomada automaticamente. Diagnóstico de ruas não equivale a recomendação de plantio. Território, execução e leitura das camadas GeoJSON já estão integrados ao mapa administrativo. Revisão persistente, envio ao acervo, aprovação e publicação continuam pendentes. O protótipo mantém uma cópia anterior do motor e dos pesos como salvaguarda; alterações futuras em um não são automaticamente aplicadas no outro.

O mapa solicita tiles locais WebP transparentes a partir do zoom 14 e os sobrepõe à base DataGEO, que ainda é carregada como cobertura e fallback. O índice é criado sob demanda em `cache/mapa-local-index`; até 512 tiles ficam em memória e tiles compostos são guardados em `cache/mapa-local-tiles` (limite de 2 GB). A chave do cache considera a versão dos GeoTIFFs. Reinicie a API após alterar o acervo; o cache do navegador expira em cinco minutos. A camada local usa somente os GeoTIFFs de 25 cm; a área sem pixels válidos permanece transparente. A sobreposição reduz o tamanho dos tiles locais, mas não evita as solicitações simultâneas à DataGEO e não é uma medição comparativa de latência.

## Verificação

```powershell
.\.venv\Scripts\python.exe -B -W ignore -m unittest discover -s tests
```
