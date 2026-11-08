# Arboriza — frontend

Aplicação React com TypeScript estrito, Vite e React Router em modo declarativo.

## Estado atual — acesso da equipe

O login, a sessão e o logout usam a API real. As rotas `/admin`, `/admin/mapa` e `/admin/acervo` exigem sessão; administradores podem gerenciar usuários no portal. O token fica na sessão da aba e é validado pela API após recarregar. O servidor Vite encaminha `/api` para `127.0.0.1:8000`; o backend precisa estar em execução. `npm run preview` não configura esse proxy. No mapa administrativo, território, configuração, execução e carregamento das camadas reais usam a API. Os exemplos continuam disponíveis, identificados como demonstrativos. Revisão persistente, acervo e publicação ainda aguardam integração. As notas mais antigas abaixo descrevem a evolução da interface, não seu estado atual.

No VS Code, use **Arboriza: frontend + backend** em Executar e Depurar para iniciar os dois processos. Há também configurações individuais e a opção anterior do protótipo.

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
    home/              # Início: páginas e estilos
    map/               # Mapa público: páginas, componentes, dados e estilos
    admin/             # Administração: páginas, componentes, dados e estilos
    auth/              # Acesso: páginas, componentes, contexto, serviços e estilos
    style-lab/         # Laboratório visual
  shared/
    components/        # Layout, mapas ilustrativos, seções e feedback
    config/            # Caminhos tipados, usados nas rotas e nos links
    styles/            # Base e tema aprovados
    ui/                # Controles, superfícies, grafismos, movimento e estilos
    hooks/             # Preferência de movimento reduzido
```

## Rotas

| Caminho | Conteúdo |
|---|---|
| `/` | Landing page Início, validada |
| `/mapa` | Mapa em toda a tela, painel flutuante e densidade demonstrativa, com refinamento aprovado |
| `/admin` | Primeira amostra de áreas de trabalho, aguardando validação visual |
| `/admin?area=centro` | Exemplo de área aberta; suporta acesso direto e recarga |
| `/login` | Interface demonstrativa de acesso da equipe |
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

A área Início usa a identidade aprovada, componentes compartilhados, prévia ilustrativa e números animados da regra 3-30-300. O mapa público usa Leaflet/React Leaflet com bases cartográficas reais e resultados fictícios: busca local, grupos paginados, camadas e detalhes na lateral flutuante. Mapa de fundo e visualização são independentes; Leaflet.heat oferece densidade relativa demonstrativa com paletas prontas e duas cores personalizadas. Consulte [Mapa público](../../docs/MAPA_PUBLICO.md).

A organização administrativa por área de trabalho e a primeira amostra pequena foram aprovadas. `/admin` apresenta três áreas fictícias, busca sem distinção de acentos, filtro por situação e estado vazio. Cada área abre por `?area=`, com resumo, prévia de referência quando disponível e etapas orientativas de obtenção, revisão e preparação da publicação. Identificadores desconhecidos têm estado próprio. No retorno à lista, busca/filtro e foco no item são preservados enquanto a página permanece montada; a recarga não persiste busca/filtro. A área sem resultados indica “Aguardando resultados”.

A amostra reutiliza `GlassPanel`, `Button` e o tema aprovado com Manrope, verdes, vidro e Mel, sem nova identidade ou dependências. Aguarda validação visual e de navegação antes dos formulários; o botão de configuração permanece indisponível com explicação visível. Login possui formulário demonstrativo e o acesso a `/admin` não representa uma sessão autenticada. Não há persistência, análise/importação/revisão/exportação/publicação reais ou integração com a API do Arboriza. Contagens fictícias não confirmam árvores nem cobertura de copas. Consulte [Administração](../../docs/ADMINISTRACAO.md).

Lint e build com checagem de tipos aprovados para a amostra administrativa. Busca/filtro, vazio, abertura/retorno e foco, identificador desconhecido e recarga foram conferidos no Chromium desktop e em viewport 375 × 812, sem avisos ou erros de console observados. O CSS contempla movimento reduzido. Dispositivos físicos, outros navegadores, desempenho e API real não foram validados.

O mapa e o laboratório são carregados sob demanda. Tokens aprovados e componentes tipados são compartilhados entre as áreas. Imagens locais, interações e instruções de validação estão descritas no [levantamento das amostras](../../docs/LABORATORIO_VISUAL.md). O tema usa uma camada CSS de fundação para que os estilos de cada componente tenham precedência previsível.

Para hospedar a SPA, o servidor precisará encaminhar URLs de páginas ao `index.html`, preservando caminhos de arquivos e, quando existir, da API. Vite dev e preview já atendem os acessos diretos usados nesta validação; `preview` não é servidor de produção.

O projeto foi iniciado a partir do template oficial React do [Vite](https://vite.dev/guide/) e usa [React Router](https://reactrouter.com/start/declarative/installation). O conteúdo e os assets de demonstração do template foram removidos.


### Portal administrativo

- `/admin`: entrada com os dois acessos.
- `/admin/mapa`: mapa navegável, contextos à esquerda, propriedades à direita, barra flutuante e análise demonstrativa com bloqueio modal. Sem edição ou análise real.
- `/admin/acervo`: registros fictícios de análises e importações; detalhes em `?registro=ID`.
- `/login`: formulário demonstrativo; sem autenticação, cadastro público ou proteção de rotas.

SQLite permanece uma proposta para o backend local futuro, sem alterações de persistência nesta etapa. A regra de publicação por abrangência está documentada em `docs/ADMINISTRACAO.md`; não é executada pelo frontend.


### Login da equipe — interface

Campos Usuário e Senha, mostrar/ocultar senha e validação de preenchimento. Envio com dados fictícios informa que não há autenticação e limpa a senha; não cria sessão, transmite credenciais ou persiste os campos. Não há cadastro público. Acesso ao portal demonstrativo é um link independente. Consulte [Login](../../docs/LOGIN.md).


### Mapa administrativo — estrutura e demonstrações

Registro histórico da primeira amostra. O estado atual está descrito no início deste README e em [Mapa administrativo](../../docs/MAPA_ADMINISTRATIVO.md).


### Camadas e setores censitários

O mapa administrativo tem gerenciador de resultados reais carregados da API e exemplos identificados, com visibilidade simultânea, camada ativa independente e enquadramento. A segmentação, grupos e complementos do modelo v2 aparecem em camadas separadas. Os controles de Pontos, Segmentação e Densidade ficam na barra do mapa. O estado visual continua na sessão em memória.

A malha urbana real do IBGE é fornecida pela API. A seleção por clique ou código, busca paginada e resumo visual de setores/área estão disponíveis. A área da UI é a soma declarada pelo IBGE; o backend calcula a geometria para o processamento. Ferramentas de desenho, edição e salvamento de revisão seguem pendentes. Consulte [Mapa administrativo](../../docs/MAPA_ADMINISTRATIVO.md).
