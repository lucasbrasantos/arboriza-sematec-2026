# Aplicação Arboriza

O produto combina uma interface React/TypeScript e uma API local Python/FastAPI. O site público não pede login. Análise de imagens e ferramentas de equipe usam o backend e exigem acesso administrativo.

## Requisitos

- Windows PowerShell, Git, Node.js 22.22+ e Python 3.12.
- Para iniciar somente o frontend: Node.js e conexão para os mapas externos.
- Para iniciar a API: dependências Python de `backend/requirements/`.
- Para executar inferência: GPU NVIDIA/CUDA compatível com Detectron2/torchvision e pesos Cambridge/Restor locais.
- As imagens aéreas e o acervo viário também são arquivos locais. Não estão incluídos no clone por tamanho e procedência.

Os ambientes CUDA e pesos validados no projeto são específicos da máquina. Um `pip install` genérico não substitui a instalação compatível do Detectron2/Detectree2. Veja o guia do [backend](backend/README.md) antes de preparar outra máquina.

O hardware dos pilotos foi Windows 10 Pro, Ryzen 5 5600G, 64 GB de RAM e RTX 5070 com 12 GB de VRAM. Essa é a configuração observada, não o mínimo garantido. O [guia de instalação dos modelos de análise](backend/INSTALACAO_MODELOS_IA.md) registra versões, compilação CUDA, obtenção dos pesos e limites de reprodução.

## Instalação rápida para interface pública

```powershell
git clone https://github.com/lucasbrasantos/arboriza-sematec-2026.git
cd arboriza-sematec-2026/app/frontend
npm ci
npm run dev
```

Abra <http://127.0.0.1:5173/>. A página inicial e o mapa público não precisam de login. O Vite encaminha `/api` ao backend em `127.0.0.1:8000`, se ele estiver em execução.

## Iniciar frontend e API

Em um terminal, prepare o backend seguindo seu [README](backend/README.md), ative o ambiente e inicie a API em `127.0.0.1:8000`. Em outro terminal:

```powershell
cd app/frontend
npm ci
npm run dev
```

Crie a conta local demonstrativa apenas depois que a API e o ambiente Python estiverem preparados. No diretório `app/backend`:

```powershell
.\.venv\Scripts\python.exe -m arboriza_api.access.demo_admin
```

As credenciais locais são `demo` / `ArborizaDemo2026!`. O comando recusa criar essa conta se já existir qualquer usuário no banco e não altera contas existentes. Não exponha essa senha em uma instância pública. O acesso é para desenvolvimento em `127.0.0.1`; uma demonstração hospedada deve receber uma conta própria e devidamente limitada.

## Pastas

- `frontend/`: site, estilos, fontes e aplicações do navegador.
- `backend/arboriza_api/`: autenticação, análise, território, mapa e acervo.
- `backend/requirements/`: conjuntos de dependências Python fixados.
- `backend/data/`, `modelos/`, `cache/`, `resultados/`, `banco/`: arquivos locais ignorados pelo Git.

## Verificação local

No diretório `app/frontend`, `npm run lint`, `npm run typecheck` e `npm run build` verificam o frontend. No backend, o comando de testes está documentado em `app/backend/README.md`. A disponibilidade das análises depende dos dados, pesos e CUDA indicados no endpoint `/api/health`.

Para limitações, fontes, créditos e declaração de IA, veja o [README principal](../README.md) e a página pública `/sobre`.
