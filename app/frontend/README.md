# Arboriza — frontend

Interface web do Arboriza, feita com React, TypeScript estrito e Vite. A navegação usa React Router; o mapa usa Leaflet e React Leaflet. A API local precisa estar ativa para autenticação e operações administrativas conectadas.

## Rodar localmente

Requisitos: Node.js 22.22 ou superior e npm. No PowerShell, a partir desta pasta:

```powershell
npm ci
npm run dev
```

Abra <http://127.0.0.1:5173/>. Para login e funções administrativas, inicie também a API conforme [`../backend/README.md`](../backend/README.md). O Vite encaminha `/api` para `127.0.0.1:8000`. A conta de demonstração é criada manualmente no banco local vazio pelo comando `python -m arboriza_api.access.demo_admin`; veja as instruções no README do backend.

## Rotas principais

| Caminho | Área |
|---|---|
| `/` | Apresentação, prévia ilustrativa e referência educativa 3-30-300. |
| `/mapa` | Mapa público para consultar os resultados disponibilizados. Exemplos demonstrativos são identificados. |
| `/sobre` | Transparência: objetivo, fontes, uso de IA, tecnologias, equipe e limitações. |
| `/login` | Entrada da equipe, conectada à API. Não há cadastro público. |
| `/admin` | Área da equipe e acesso às ferramentas administrativas. Requer login. |
| `/admin/mapa` | Mapa de análise: setores censitários, execução e camadas de resultados. Requer login e dados/modelos locais para inferência. |
| `/admin/acervo` | Registros de análise/importação e fluxo de revisão/publicação. Requer login. |

## Comandos

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia o desenvolvimento com atualização automática. |
| `npm run typecheck` | Confere os tipos TypeScript e a configuração Vite. |
| `npm run lint` | Analisa o código com Oxlint. |
| `npm run build` | Confere os tipos e gera `dist/`. |
| `npm run preview` | Serve `dist/` para uma conferência local; não configura o proxy da API. |

## Organização

```text
src/
  app/                 # rotas e composição da aplicação
  features/             # início, mapa, administração, acesso e transparência
  shared/               # layout, tema, componentes, grafismos e utilitários comuns
```

As funcionalidades ficam organizadas por área em `features/`. Os caminhos nomeados ficam centralizados em `shared/config/paths.ts`; estilos de identidade compartilhados ficam em `shared/styles/` e componentes comuns em `shared/`.

## Limites e dados demonstrativos

O mapa público pode ser navegado sem conta; os resultados publicados dependem do acervo disponível na API. Alguns pontos e indicadores de interface são fictícios e identificados como demonstração. Não devem ser interpretados como inventário confirmado de árvores. A análise de imagens retorna propostas de copas para revisão da equipe; os pesos e os dados geográficos não acompanham o clone por Git.

Para fontes, créditos, modelos, declaração de originalidade e uso de IA, veja o [README principal](../../README.md) e a página pública `/sobre`. Para preparar inferência real, consulte [`../backend/README.md`](../backend/README.md).

O frontend começou pelo template oficial React do [Vite](https://vite.dev/guide/). As bibliotecas e seus créditos estão no `package.json` e na página Sobre. Para hospedar a SPA, o servidor deve encaminhar rotas da aplicação ao `index.html`, mantendo os caminhos dos arquivos e da API.
