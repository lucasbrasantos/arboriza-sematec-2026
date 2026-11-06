# Arboriza — frontend

Aplicação React com TypeScript estrito, Vite e React Router em modo declarativo.

## Começar

Requer Node.js 22.22 ou superior e npm. A partir desta pasta:

```powershell
npm ci
npm run dev
```

Endereço: <http://127.0.0.1:5173/>. A porta é fixa; não são expostos serviços na rede local por padrão.

## Comandos

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia o desenvolvimento com atualização automática. |
| `npm run typecheck` | Confere os tipos da aplicação e da configuração Vite. |
| `npm run lint` | Analisa o código com Oxlint, fornecido pelo template Vite. |
| `npm run build` | Confere os tipos e gera `dist/`. |
| `npm run preview` | Serve `dist/` em <http://127.0.0.1:4173/> para conferência local. |

## Estrutura

```text
src/
  main.tsx
  app/                 # Composição, rotas e página não encontrada
  features/
    home/              # Início
    map/               # Mapa público
    admin/             # Administração
    auth/              # Login
  shared/
    components/        # Layout, cabeçalho e placeholder
    config/            # Caminhos tipados, usados nas rotas e nos links
    styles/            # Base provisória
```

## Rotas

| Caminho | Conteúdo |
|---|---|
| `/` | Início |
| `/mapa` | Mapa público |
| `/admin` | Administração |
| `/login` | Login |
| `/laboratorio` | Redireciona para a combinação visual recomendada |
| `/laboratorio/natural` | Amostra natural e leve |
| `/laboratorio/profundo` | Amostra com vidro mais profundo |
| `/laboratorio/equilibrio` | Combinação recomendada |
| Demais caminhos | Página não encontrada e link para o início |

O cabeçalho é compartilhado e indica a rota ativa. Cada página tem seu próprio título no navegador e pode ser aberta diretamente ou recarregada no servidor local Vite. O link para pular ao conteúdo e a navegação por teclado estão preparados.

## Padrões

- TypeScript com `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`.
- Propriedades tipadas; imports de tipos explícitos e ausência de `any` nos componentes.
- Funcionalidades organizadas por área, com compartilhamento apenas quando houver uso real.
- Caminhos centralizados em `shared/config/paths.ts`.
- CSS simples nesta etapa; a identidade visual depende de validação separada.
- Bibliotecas, contratos e regras serão adicionados conforme as etapas aprovadas.

## Limites desta etapa

As quatro páginas principais são placeholders. Acesso a `/admin` não representa uma sessão autenticada. O laboratório tem controles de demonstração: a busca não consulta API, os pontos são fictícios e o botão de teste não salva dados. Não há análise de imagens ou publicação. O backend será criado posteriormente.

O laboratório é carregado sob demanda. Tokens propostos, componentes tipados, imagens locais e instruções de validação estão descritos no [levantamento das amostras](../../docs/LABORATORIO_VISUAL.md).

Para hospedar a SPA, o servidor precisará encaminhar URLs de páginas ao `index.html`, preservando caminhos de arquivos e, quando existir, da API. Vite dev e preview já atendem os acessos diretos usados nesta validação; `preview` não é servidor de produção.

O projeto foi iniciado a partir do template oficial React do [Vite](https://vite.dev/guide/) e usa [React Router](https://reactrouter.com/start/declarative/installation). O conteúdo e os assets de demonstração do template foram removidos.
