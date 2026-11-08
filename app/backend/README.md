# Arboriza — API FastAPI

API e motor de processamento do Arboriza. O frontend ainda não está conectado.

## Execução local

No PowerShell, em `app/backend`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn arboriza_api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

A documentação fica em `http://127.0.0.1:8000/docs`. Use um processo/worker; uma trava impede duas instâncias com o mesmo banco. Esta versão ainda não foi preparada para exposição na internet.

A API fornece duas famílias de modelos: Controle (Cambridge) e Modelo v2 (Restor + Cambridge). `GET /api/analises/perfis` retorna `modelos` com as duas famílias e `perfis` com as variações técnicas disponíveis, incluindo fontes diferentes do Controle e o perfil multiescala experimental histórico. O modelo v2 usa somente o acervo local; grupos e complementos são distintos de indivíduos.

## Pastas

- `arboriza_api/access`: autenticação, usuários e criação inicial.
- `arboriza_api/core`: configuração e banco.
- `arboriza_api/analyses`, `territory`, `streets`: contratos e rotas.
- `arboriza_api/engine`: motor, dividido em `models`, `imagery`, `inference` e `geography`.
- `modelos`: pesos e metadados dos modelos, ignorados pelo Git.
- `data`: ortofotos, malha e acervo de ruas compartilhados com o protótipo.
- `banco/arboriza.sqlite`: usuários, sessões e execuções.
- `cache`: caches de processamento do motor.
- `resultados`: arquivos produzidos por análises.

`ARBORIZA_DATABASE`, `ARBORIZA_DATA_DIR`, `ARBORIZA_RESULTS_DIR`, `ARBORIZA_MODELS_DIR` e `ARBORIZA_CACHE_DIR` permitem configurar caminhos. Banco, dados, modelos e resultados são ignorados pelo Git e precisam de backup; guardar banco e resultados de forma consistente.

O ambiente `.venv` foi criado nesta máquina com Python 3.12 e os pacotes do ambiente validado do protótipo foram copiados para ele. O executável, as bibliotecas e a extensão CUDA estão no backend, mas a venv depende da instalação base do Python e não deve ser considerada portátil para outro computador. As listas de versões estão em `requirements/`. Detectron2/Detectree2 incluem componentes nativos compilados para esta combinação Windows/CUDA; reconstruir um ambiente em outra máquina exige instalação/compilação compatível e validação própria.

`python -m arboriza_api.access.bootstrap` cria interativamente o primeiro administrador somente se não houver usuários. A autenticação retorna bearer token com expiração; apenas administradores gerenciam usuários.

## Limites

Uma análise interrompida por reinício fica marcada como erro e não é retomada automaticamente. Diagnóstico de ruas não equivale a recomendação de plantio. Revisão, acervo, publicação e frontend ainda não foram integrados. O protótipo mantém uma cópia anterior do motor e dos pesos como salvaguarda; alterações futuras em um não são automaticamente aplicadas ao outro.

## Verificação

```powershell
.\.venv\Scripts\python.exe -B -W ignore -m unittest discover -s tests
```
