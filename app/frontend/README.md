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
    styles/            # Base e tema aprovados
    ui/                # Primitivas visuais compartilhadas
    hooks/             # Preferência de movimento reduzido
```

## Rotas

| Caminho | Conteúdo |
|---|---|
| `/` | Landing page Início, validada |
| `/mapa` | Mapa em toda a tela, painel flutuante e densidade demonstrativa, em validação |
| `/admin` | Administração |
| `/login` | Login |
| `/laboratorio` | Redireciona para a combinação visual recomendada |
| `/laboratorio/natural` | Amostra natural e leve |
| `/laboratorio/profundo` | Amostra com vidro mais profundo |
| `/laboratorio/equilibrio` | Combinação recomendada |
| Demais caminhos | Página não encontrada e link para o início |

O cabeçalho é compartilhado e indica a rota ativa nas áreas do site. `/mapa` usa navegação compacta própria para liberar a área cartográfica. Cada página tem seu próprio título no navegador e pode ser aberta diretamente ou recarregada no servidor local Vite. O link para pular ao conteúdo e a navegação por teclado estão preparados.

## Padrões

- TypeScript com `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`.
- Propriedades tipadas; imports de tipos explícitos e ausência de `any` nos componentes.
- Funcionalidades organizadas por área, com compartilhamento apenas quando houver uso real.
- Caminhos centralizados em `shared/config/paths.ts`.
- CSS por componente e tema compartilhado aprovado.
- Bibliotecas, contratos e regras serão adicionados conforme as etapas aprovadas.

## Limites desta etapa

A área Início usa a identidade aprovada, componentes compartilhados, prévia ilustrativa e números animados da regra 3-30-300. O mapa público usa Leaflet/React Leaflet com bases cartográficas reais e resultados fictícios: busca local, grupos paginados, camadas e detalhes na lateral flutuante. Mapa de fundo e visualização são independentes; Leaflet.heat oferece densidade relativa demonstrativa com paletas prontas e duas cores personalizadas. Consulte [Mapa público](../../docs/MAPA_PUBLICO.md). Administração e Login continuam como placeholders; acesso a `/admin` não representa uma sessão autenticada. Não há análise de imagens, publicação ou integração com a API do Arboriza nesta etapa.

O mapa e o laboratório são carregados sob demanda. Tokens aprovados e componentes tipados são compartilhados entre as áreas. Imagens locais, interações e instruções de validação estão descritas no [levantamento das amostras](../../docs/LABORATORIO_VISUAL.md). O tema usa uma camada CSS de fundação para que os estilos de cada componente tenham precedência previsível.

Para hospedar a SPA, o servidor precisará encaminhar URLs de páginas ao `index.html`, preservando caminhos de arquivos e, quando existir, da API. Vite dev e preview já atendem os acessos diretos usados nesta validação; `preview` não é servidor de produção.

O projeto foi iniciado a partir do template oficial React do [Vite](https://vite.dev/guide/) e usa [React Router](https://reactrouter.com/start/declarative/installation). O conteúdo e os assets de demonstração do template foram removidos.
