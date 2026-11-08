# Administração — portal, mapa de produção e acervo

## Situação em 07/11/2026

A organização foi revisada com o usuário: entrada em `/admin` com dois cards grandes, **Mapa administrativo** (`/admin/mapa`) e **Análises e importações** (`/admin/acervo`). O acervo anterior foi adaptado para registros individuais, com nome, prévia, origem, abrangência e abertura por `?registro=`. O espaço do mapa já apresenta a primeira amostra navegável, contextos, propriedades e acompanhamento demonstrativo; edição, seleção territorial e processamento ainda serão implementados. Consulte [Mapa administrativo](MAPA_ADMINISTRATIVO.md). `/login` possui interface demonstrativa de acesso da equipe; detalhes em [Login](LOGIN.md).

Acesso futuro exclusivo da equipe, com usuários cadastrados internamente, sem cadastro público. Cada análise/importação gera um registro próprio. Duas análises de X não ficam publicadas simultaneamente; X e X + Y podem coexistir como publicações distintas. A verificação de abrangências e os conflitos de publicação serão definidos no backend. Nenhuma publicação real ocorre nesta amostra.

A etapa permanece somente no frontend. SQLite é uma opção proposta para a futura versão local, sem instalação, esquema ou backend criados. Credenciais, sessão, autorização e cadastro interno de usuários dependem da integração posterior.

Os três registros fictícios exemplificam X, outra análise de X e X + Y. A imagem e as contagens da combinação são demonstrativas, sem delimitação territorial calculada. Os detalhes das etapas permanecem orientativos. O registro abaixo descreve a primeira amostra anterior à revisão do portal; esta seção prevalece para rotas e organização atuais.

## O que já está definido

- Uso pela equipe responsável; consulta pública separada da edição.
- Produzir resultados tanto por análise no site quanto por importação de resultados processados.
- Revisar marcações e prioridades antes da publicação.
- Exportar dados geográficos pela equipe.
- React, TypeScript estrito, CSS por componente e identidade compartilhada aprovada.
- Construção progressiva, com validação do usuário antes das decisões principais e da próxima rodada.

## Levantamento do código atual

| Referência | O que oferece hoje | Consequência para esta etapa |
|---|---|---|
| `app/frontend/src/features/admin/AdminPage.tsx`, `admin-data.ts` e `admin.css` | Lista de três áreas fictícias, busca/filtro, abertura e resumo, com etapas orientativas. | Primeira amostra disponível; formulários e operações ainda serão construídos após validação. |
| `app/frontend/src/features/auth/LoginPage.tsx` | Formulário demonstrativo de acesso da equipe. | Não há sessão ou proteção real de rotas. |
| `prototipo-01/frontend/index.html` e módulos em `js/` | Recortes e seleção territorial; perfis/corte de score; acompanhamento de análise; importação/exportação GeoJSON; ferramentas de pontos e camadas com armazenamento no navegador. | Reaproveitar conceitos e estudar o comportamento, preservando o protótipo e sem copiar a manipulação de DOM para React. |
| `prototipo-01/backend/api.py` | Rotas de recortes, análises assíncronas/status/GeoJSON e operações territoriais. | Contrato é referência para a futura integração; não equivale a um backend administrativo com autenticação, revisão e publicação. |

O levantamento do protótipo é estático; a amostra React recebeu as verificações descritas abaixo. Nenhuma análise foi executada ou qualidade de detecção validada nesta rodada.

## Organização aprovada

Entrada por **Áreas de trabalho**, com busca, situação e ação para abrir cada área. Dentro da área, uma sequência curta:

1. **Obter resultados:** escolher entre análise e importação, mantendo identificada a origem.
2. **Revisar:** consultar mapa/lista de candidatos e trechos; revisar marcações e prioridades conforme critérios a definir.
3. **Preparar publicação:** conferir área, origem, revisão e prévia do conteúdo público antes de publicar.

Exportação é uma ação associada aos resultados da área. Novas análises devem ter identidade própria; a relação entre versões e dados publicados será validada antes da persistência.

Essa organização foi escolhida para manter claro a qual território pertencem os resultados e as ações. As três etapas da amostra são orientações; não representam operações disponíveis ou concluídas.

## Primeira amostra implementada — aguardando validação

- Estrutura de `/admin` com aviso de ambiente demonstrativo e três cenários fictícios: Centro, Centro-norte e Área de estudo. As imagens de referência vêm do protótipo e não definem o limite final da área piloto.
- Busca local normalizada, sem distinção de maiúsculas ou acentos, filtro por situação e estado sem resultados com ação para limpar busca/filtro.
- Abertura da área por `?area=`, permitindo acesso direto e recarga; identificador desconhecido mostra estado próprio e retorno à lista.
- Retorno à lista preserva busca/filtro e recupera o foco no item enquanto a página permanece montada. A busca e o filtro não são persistidos após recarga ou saída da página.
- Resumo com situação ilustrativa, origem fictícia e prévia quando disponível. A área sem resultados mostra “Aguardando resultados”, sem apresentar ausência de dados como contagem comprovada de zero árvores.
- Etapas Obter resultados, Revisar marcações e trechos e Preparar publicação como orientação. O botão de configurar análise/importação está desabilitado e acompanhado da explicação de que os formulários vêm na próxima rodada.
- Reutilização de `GlassPanel`, `Button` e do tema compartilhado em `shared/styles/theme.css`: Manrope, verdes, vidro e destaque Mel nos papéis aprovados. É uma extensão da identidade existente, sem nova identidade visual ou dependências.
- Layout adaptado ao celular, foco por teclado, avisos textuais de situação e entrada discreta em CSS. A preferência por movimento reduzido desativa a animação de entrada e a transição das linhas.

Não foram construídos formulários, edição/revisão no mapa, análise, importação, exportação, salvamento ou publicação. Os números dos cenários não confirmam árvores, cobertura de copas, revisão realizada ou prioridade validada. A regra 3-30-300 permanece educativa.

Não há API, persistência ou sessão nesta amostra. Login e proteção efetiva serão tratados na etapa apropriada de integração.

## Verificações e limites

- Lint e build com checagem de tipos aprovados.
- Percursos manuais no Chromium em desktop (largura de 1280 px) e viewport 375 × 812: busca, filtros, vazio, abertura da área, retorno, recuperação de foco, endereço desconhecido e recarga conferidos. Sem avisos ou erros de console nos percursos examinados.
- Capturas locais em `C:/Users/lucas/OneDrive/Documentos/ChatGPT/Sematec/output/site-react-admin/` registram a amostra.
- A preferência por movimento reduzido está contemplada no CSS; isso não equivale a uma auditoria completa de acessibilidade. Dispositivos físicos, outros navegadores, desempenho e API real não foram validados.
- A aprovação visual pelo usuário continua pendente. As verificações técnicas não autorizam avançar aos formulários.

## Decisões seguintes

Validar a composição concreta, navegação e estados desta amostra. Após essa aprovação, definir por partes os formulários de análise/importação, a interação de revisão no mapa e a conferência de publicação. Formatos aceitos, campos obrigatórios, critérios, persistência e permissões continuam abertos.


## Verificação da revisão do portal

Lint e build com TypeScript estrito aprovados. Conferidos no Chromium: dois acessos do portal, busca por abrangência no acervo, abertura/recarregamento do registro e retorno ao portal. Captura desktop em `output/site-react-portal/desktop.png` na pasta Sematec. A leitura de layout móvel foi feita com viewport 375 × 812, mas a captura móvel falhou na ferramenta; a revisão visual móvel desta revisão permanece pendente. Viewport restaurado. Nenhum login real, processamento, persistência ou publicação foram testados.
