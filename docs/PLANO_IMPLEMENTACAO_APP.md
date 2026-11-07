# Arboriza — plano de implementação do app

**Situação:** etapas 1 e 2 validadas. Mistura visual, animações e nova escala dos grafismos da área Início aprovadas; Mel escolhido como destaque predominante, com Coral e Azul-céu pontuais. Aplicação dessas escolhas na página concluída para validação do conjunto antes da área Mapa.
**Contexto:** complementa o [escopo funcional](ESCOPO_WEBSITE_PRIMEIRA_ENTREGA.md). O prazo anteriormente informado para a primeira entrega foi 09/11/2026; este plano não garante viabilidade nesse prazo.

## Acordo de trabalho e validação

- O usuário quer acompanhar cada etapa, decisão, dúvida e implementação. Apresentar opções, implicações e recomendações antes de tomar decisões materiais; aguardar sua escolha quando necessário.
- Ao terminar cada etapa, demonstrar o resultado, relatar arquivos alterados, verificações, pendências e limitações; parar e aguardar validação explícita do usuário antes de avançar à etapa seguinte.
- Correções solicitadas durante a validação pertencem à etapa atual. Decisões pendentes e mudanças de direção devem ser anotadas com o usuário, sem presumir aprovação por silêncio.
- O usuário poderá criar as pastas ou iniciar o projeto por conta própria. Quando avisar, examinar o estado real, ler os arquivos e regras locais, preservar alterações existentes e alinhar a continuação com ele; não recriar nem sobrescrever sua estrutura automaticamente.
- Manter arquitetura simples e organizada; aplicar os princípios de separação de responsabilidades conforme a necessidade, evitando camadas e dependências sem uso concreto.
- Decisão atualizada pelo usuário em 06/11/2026: frontend em **TypeScript com tipagem estrita**, substituindo o JavaScript da proposta inicial. Componentes e contratos devem ser tipados; verificações de tipos fazem parte do build.

## Direção acordada

- Três **áreas** do produto: Início, Mapa público e Administração. Poderão existir páginas adicionais, como login; três áreas não limitam a quantidade de rotas.
- UrbVerde é a referência principal para a estrutura do produto e a experiência do mapa. Community Greening, Lake Nona, a página de arborização de Araçatuba e as imagens enviadas complementam a identidade sustentável, orgânica e interativa.
- Página inicial expressiva, com interações de mouse e animações a discutir; mapa e administração claros e confortáveis para operar.
- Glassmorphism nos componentes principais e cartões, com identidade própria do Arboriza: transparência, cor e desfoque equilibrados com a temática de natureza e cidade. Não reproduzir integralmente o estilo visual da Apple.
- Área piloto de Araçatuba para a primeira entrega e visão de expansão para a cidade toda; regra 3-30-300 como conteúdo educativo. Dados e diagnósticos demonstrativos devem ser identificados como tais.
- Estrutura proposta: `app/frontend` em React + TypeScript, `app/backend` para a API Python/FastAPI e, se necessário, `app/scripts` e README. `prototipo-01` segue como referência e laboratório existente.

## Etapa 0 — Preparação conjunta

- Aguardar o usuário informar quando quiser iniciar e se criou alguma estrutura.
- Inspecionar o repositório, as alterações existentes, dependências, instruções locais e o protótipo de mapa antes de qualquer modificação.
- Apresentar a estrutura concreta encontrada e o plano da etapa 1. Validar com o usuário as decisões ainda abertas que afetem a execução.

**Validação:** confirmar ponto de partida e autorizar a etapa 1. A aprovação deste plano, isoladamente, não autoriza iniciar a implementação.

## Etapa 1 — Estrutura React, navegação e placeholders

**Objetivo:** entregar uma aplicação limpa e navegável, ainda sem design final.

- Criar ou aproveitar `app/frontend`, com React + Vite e TypeScript estrito, conforme a decisão atualizada do usuário, verificando antes o que ele já fez.
- Remover conteúdo de demonstração gerado pelo template e organizar uma estrutura inicial pequena por área e código compartilhado, sem criar componentes complexos antecipadamente.
- Configurar navegação e rotas: `/` (Início), `/mapa` (Mapa público), `/admin` (Administração) e `/login` (Login), além de tratamento simples para rota inexistente.
- Criar links funcionais entre áreas e placeholders simples com o nome da página. Os placeholders não representam autenticação, mapa, análise ou publicação funcionando.
- Documentar como instalar, executar e gerar a aplicação. Criar ou alterar somente os arquivos necessários para esta etapa.
- Verificar inicialização, navegação pelos links e URLs diretas, retorno do navegador, rota inexistente e build; observar comportamento básico em desktop e viewport móvel. Registrar limites se o ambiente impedir alguma verificação.

**Validação:** demonstrar a aplicação navegável, estrutura, arquivos alterados e verificações. Aguardar o usuário aprovar antes de iniciar identidade visual.

### Registro da entrega técnica — 06/11/2026

- Criado `app/frontend` com React + Vite, React Router declarativo e TypeScript estrito. A tipagem foi uma escolha explícita do usuário durante a implementação, substituindo JavaScript.
- Organizados `src/app`, `src/features` por área e `src/shared`, com caminhos tipados centralizados. Removidos o conteúdo e os assets de demonstração do template.
- Rotas `/`, `/mapa`, `/admin` e `/login` com placeholders identificados pelo nome, cabeçalho compartilhado, indicação de rota ativa e títulos no navegador. Caminhos desconhecidos oferecem retorno ao início.
- Criados README de execução e organização em `app/` e `app/frontend/`, e README de reserva em `app/backend/`. O backend não foi implementado.
- Verificados: `npm run lint`, build com `tsc -b`, links, histórico Voltar, acesso direto às quatro rotas no preview do build, recarga de `/mapa`, rota inexistente, foco por teclado e link para pular ao conteúdo.
- Layout conferido no navegador em desktop e viewport 375 × 812, sem transbordamento horizontal. Não houve teste em dispositivo físico. O console não apresentou erros nas interações verificadas.
- Servidor de desenvolvimento local configurado em `http://127.0.0.1:5173/`. Estilo básico provisório, sem autenticação, dados, mapa ou integração de API. A etapa 2 segue aguardando validação.

## Etapa 2 — Identidade visual e componentes compartilhados

**Objetivo:** estabelecer as fundações visuais antes de compor as áreas finais.

- Apresentar para escolha uma direção visual baseada no UrbVerde, complementada pelas demais referências e imagens enviadas.
- Propor paleta, tipografia, ícones, espaçamentos e formas orgânicas, com exemplos pequenos para avaliação; as cores discutidas anteriormente são ponto de partida, não valores finais aprovados.
- Estudar variações de glassmorphism para cabeçalho, painéis e cartões, com gradações de transparência e desfoque e uma alternativa de fundo mais opaco quando necessário. Avaliar leitura sobre fotos e mapas, contraste, responsividade e custo visual/desempenho.
- Apresentar exemplos de botões, campos, cartões, navegação e painéis compartilhados, criando apenas componentes necessários.
- Levar para escolha as opções de movimento e bibliotecas da seção de pesquisa. Antes de instalar, apresentar dependência, benefício, limitações e onde será usada.
- Considerar teclado, foco visível, legenda que não dependa somente de cor, preferência por movimento reduzido e alternativas quando transparência/desfoque não forem adequados.

**Validação:** mostrar amostras concretas da identidade, dos componentes, do vidro e dos movimentos propostos. Aguardar escolhas e aprovação antes de construir a área Início.

### Registro das amostras — 06/11/2026

- O usuário autorizou uma rota separada, a comparação de três direções e a exploração de vidro com profundidade, com preferência inicial pela combinação entre natural e profundo.
- Criado o laboratório em `/laboratorio` com variantes Natural, Profundidade e Equilíbrio; tema restrito ao experimento e componentes compartilhados tipados.
- Adicionados Motion, Radix Slider/Switch, Lucide e Manrope local para os usos concretos das amostras. O vidro é construído em CSS, sem refração física.
- Controles ajustam material e movimento; mapa, busca e botão de teste são identificados como demonstração.
- Referências, assets, escolhas e próximos pontos de avaliação estão em [Laboratório visual](LABORATORIO_VISUAL.md).

## Etapa 3 — Área Início

**Objetivo:** construir uma apresentação responsiva e interativa do Arboriza.

- Compor a página usando a identidade e os componentes compartilhados aprovados.
- Desenvolver apresentação do projeto, chamada ao mapa, explicação do funcionamento, demonstração inicial do mapa, conteúdo educativo sobre 3-30-300 e informações de fontes/equipe.
- Apresentar opções de imagem, vídeo, grafismos e interações de mouse/rolagem antes da escolha; usar apenas materiais cuja origem e uso estejam definidos.
- Preparar uma prévia de mapa demonstrativa claramente identificada, sem apresentá-la como diagnóstico real ou integração pronta.
- Avaliar navegação, links, acessibilidade básica, adaptação para celular e movimento reduzido.

**Validação:** demonstrar desktop e celular, animações e interações; ajustar conforme feedback e aguardar aprovação para avançar.

### Implementação da área Início — 06/11/2026

- O usuário aprovou a direção Equilíbrio, a paleta, os componentes, a interação com o vidro, os pontos e os estados de botões. Pediu mistura com a fotografia e a profundidade da outra amostra.
- Corrigido o foco duplicado da busca no laboratório: o contêiner mantém o destaque e o campo interno não cria outro outline.
- Construída a página `/` com tema compartilhado aprovado, floresta de referência, vidro claro e profundo, grafismos vetoriais de apoio, conteúdo do projeto, processo de detecção, prévia ilustrativa do mapa, regra 3-30-300 e fontes.
- Componentes `RuleSection` e `IllustrativeMap` são compartilhados com o laboratório. `AnimatedNumber`, `Reveal` e `BotanicalGraphic` organizam a contagem por entrada na tela, movimentos moderados e elementos gráficos. A preferência por movimento reduzido é respeitada.
- Cabeçalho compartilhado adaptado ao tema, com menu móvel e fechamento por Escape. Mudanças de área retornam ao início da página; comparações entre amostras mantêm a posição de rolagem.
- Imagens e pontos são explicitamente identificados como referência ou demonstração. Não houve integração com a API ou implementação das ferramentas da área Mapa.
- Lint, build com checagem de tipos e `git diff --check` aprovados. Busca com foco externo único, contagem por rolagem, menu móvel, seleção dos pontos e movimento reduzido conferidos no Chromium. Os limites da verificação estão registrados no [laboratório visual](LABORATORIO_VISUAL.md).

### Refinamento de grafismos e destaque — 06/11/2026

- Mistura visual, intensidade das animações e ajustes gerais aprovados. Usuário pediu aumentar muito a presença e interação dos elementos de apoio e adicionar uma cor de destaque.
- Confirmada mistura de vetores com recortes botânicos. Criada comparação no laboratório, com Mel, Coral e Azul-céu, três composições, entrada por rolagem, resposta ao ponteiro e repetição por botão acessível por teclado/toque. Sem dependências adicionais.
- O ramo transparente é gerado com IA e identificado como tal; não constitui foto local, espécie identificada ou dado ambiental.
- Validar a escolha concreta antes de aplicá-la à área Início e aos futuros estados de apoio do Mapa e Administração. As ferramentas de mapa não recebem grafismos decorativos sobre a área de dados.

### Aplicação da escolha aprovada — 06/11/2026

- Usuário aprovou a presença dos grafismos para aplicar à área Início e escolheu Mel como destaque principal; autorizou Coral e Azul-céu em detalhes pontuais.
- Tokens de destaque adicionados ao tema compartilhado. Ações, foco, estados e pontos ilustrativos do mapa mantêm seus próprios papéis de cor.
- Ramos com textura fotográfica, copas e folhas vetoriais distribuídos pela abertura, apresentação, processo, seção fotográfica, chamada da prévia, regra educativa e encerramento. Não há elementos decorativos sobre a área de dados da prévia do mapa.
- Componente compartilhado `BotanicalCutout` reutiliza o asset aprovado, responde ao ponteiro e à rolagem e respeita movimento reduzido. Botão “Animar folhas” repete a composição da abertura por teclado, toque ou clique. Sem dependências novas.
- Avaliar o resultado integrado da área Início antes de iniciar a área Mapa.
- Verificação no Chromium: desktop, viewport 375 × 812, teclado, imagens e movimento reduzido conferidos. Sem transbordamento horizontal ou erros no console nos percursos examinados. Aparelhos físicos, outros navegadores e desempenho em rede móvel não foram medidos.

## Etapa 4 — Área Mapa público

- Estudar o aproveitamento do `prototipo-01` com o usuário antes de escolher como integrá-lo ao React.
- Construir estrutura do mapa, busca/seleção da área, camadas, legenda e painel de diagnóstico, usando os padrões compartilhados aprovados.
- Na ausência de integração, usar apenas dados demonstrativos identificados e preparar estados de carregamento, vazio, erro e área sem dados.
- Explicitar a área piloto e não equiparar pontos ou concentração de pontos a cobertura de copas.

**Validação:** revisar aparência, navegação, painéis, responsividade, transparência dos dados e ferramentas; aguardar aprovação.

## Etapa 5 — Área Administração

- Projetar e construir a interface de acesso e administração, com seleção de área, análise, importação, revisão de pontos e prioridades, salvamento, exportação e publicação, conforme forem aprovados.
- Sem API, representar ações e estados como demonstração e não como operações efetivamente concluídas; não tratar a tela de login como segurança real.
- Comparar ferramentas disponíveis no protótipo e apresentar o que será reaproveitado.

**Validação:** demonstrar o fluxo e estados, indicar claramente o que é simulado e aguardar aprovação.

## Etapa 6 — Backend e integração progressiva

- Propor e validar a estrutura concreta de `app/backend`, o contrato da API e o plano de reaproveitamento do processamento Python.
- Integrar por partes: consulta pública, análise executada pelo site, importação, revisão e prioridade, persistência, autenticação/autorização e publicação. A ordem exata e as tecnologias de armazenamento são decisões a validar.
- Resguardar os resultados publicados durante novas análises e tratar carregamento, falha e retomada quando definidos no contrato.
- A classificação de trechos, os critérios, a associação dos pontos às ruas e a qualidade do detector dependem de investigação e validação; não presumir que o protótipo já os resolva.

**Validação:** demonstrar cada integração com dados reais ou claramente identificados, compartilhar os resultados das verificações e aguardar aprovação a cada parte relevante e ao final da etapa.

## Etapa 7 — Revisão da entrega piloto

- Fazer percurso completo de cidadão e equipe; verificar dados reais, origem, estados, navegação, responsividade e autenticação no servidor.
- Revisar documentação de execução, limites, fontes e preparação da demonstração.
- Discutir disponibilidade da API, execução da análise, publicação do site e eventuais custos antes de definir infraestrutura ou implantação.

**Validação final:** apresentar o que funciona, o que permanece pendente, como foi verificado e o que não foi testado. A publicação e quaisquer etapas adicionais serão tratadas conforme instruções do usuário.

## Opções para pesquisar e validar juntos

As opções abaixo registram a pesquisa inicial. Após a avaliação do laboratório, Motion, Radix Slider/Switch, Lucide e Manrope passaram a integrar a base aprovada. As alternativas de refração e GSAP continuam como opções não adotadas.

| Necessidade | Opção | Possível uso e ponto de atenção |
|---|---|---|
| Transições simples | CSS nativo | Hover, foco, pequenas entradas e abertura de painéis; solução simples para avaliar primeiro. |
| Animações em React | [Motion for React](https://motion.dev/docs/react) | Gestos, hover, rolagem e transições de componentes; avaliar necessidade e tamanho antes de instalar. |
| Sequências e rolagem mais elaboradas | [GSAP](https://gsap.com/docs/v3/) | Linha do tempo e animações mais complexas; maior complexidade de integração, a comparar com Motion e CSS. |
| Vidro fosco | [CSS `backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) | Transparência e desfoque personalizáveis; estudar legibilidade, fallback e desempenho sobre mapa e vídeo. |
| Vidro com refração | [Liquid Glass for React](https://liquidglass.theatom.lk/docs) | Biblioteca independente inspirada no efeito da Apple; a própria documentação descreve diferenças por navegador. Avaliar maturidade, licença, compatibilidade e desempenho antes de adotar. |
| Vidro com refração alternativo | [simple-liquid-glass](https://github.com/lucaperullo/simple-liquid-glass) | Abordagens com SVG/WebGL e fallback; verificar exigências, diferenças entre navegadores e custo de manutenção. |
| Movimento reduzido | [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | Respeitar a preferência do usuário e manter acesso ao conteúdo com movimentos reduzidos. |

**Base aprovada no laboratório:** vidro fosco com CSS e movimentos moderados com Motion. Refração forte e GSAP podem ser avaliados em exemplos isolados, mediante interesse do usuário.

## Decisões abertas

- Ajustes finais de composição, imagens e intensidade dos movimentos na área Início.
- Intensidade e locais de aplicação do vidro nas próximas áreas; comportamento sobre o mapa.
- Detalhes finais da estrutura criada pelo usuário, estratégia de execução e distribuição da equipe.
- Área piloto exata, qualidade do detector, associação a trechos, critérios de prioridade e formato final dos dados.
- Persistência, autenticação, infraestrutura e estratégia de publicação.

Esses pontos serão apresentados no momento adequado para validação; não impedem o planejamento nem autorizam avançar automaticamente entre etapas.
