# Arboriza — laboratório visual

## Situação

Etapa 2 e área Início validadas pelo usuário, com Equilíbrio como direção principal e Mel como destaque predominante. O laboratório continua disponível para comparação. A área Mapa público está em avaliação, conforme [registro da implementação](MAPA_PUBLICO.md). O laboratório não implementa os dados do produto.

O usuário autorizou comparar uma direção natural, uma com vidro mais profundo e uma combinação de ambas, dando preferência inicial à combinação e pedindo exploração de profundidade, animações e interações de mouse.

## Endereços locais

- <http://127.0.0.1:5173/laboratorio> abre a combinação recomendada.
- `/laboratorio/natural`: fundo claro e superfícies com maior opacidade.
- `/laboratorio/profundo`: abertura imersiva com vidro verde escuro e fotografia em destaque.
- `/laboratorio/equilibrio`: base clara com profundidade nos componentes sobre imagens.

O cabeçalho do app inclui o link “Laboratório visual”. A amostra tem navegação própria e retorno ao app. Início já apresenta a landing page; Mapa público, Administração e Login continuam como placeholders.

## O que experimentar

1. Compare as três abas. O conteúdo e a paleta são compartilhados para facilitar a comparação do material.
2. Mova o cursor sobre os cartões: a inclinação é sutil e o reflexo acompanha a posição do ponteiro.
3. Ajuste opacidade e desfoque. “Restaurar esta amostra” recupera os valores iniciais da variante atual.
4. Desligue “Reflexo e movimento”. A preferência de movimento reduzido do sistema também é respeitada, inclusive se mudar com a página aberta.
5. Clique nos pontos fictícios da imagem aérea e oculte ou exiba a camada.
6. Teste o campo de busca e o botão de interação. Ambos dão feedback de demonstração, sem consultar API ou salvar dados.
7. Clique em uma cor para copiar seu código; se o navegador impedir acesso ao clipboard, o código continua informado no feedback.

## Proposta de identidade

- Referência principal: UrbVerde. As demais referências discutidas complementam o caráter sustentável, orgânico e imersivo.
- Paleta: Floresta `#143F2B`, Folha `#246B45`, Broto `#B9D594`, Névoa `#E6EEE1`, Papel `#F7F9F3`.
- Tipografia: Manrope variável, servida localmente pelo pacote Fontsource.
- Vidro: fundo translúcido, desfoque, brilho acompanhando o cursor, bordas iluminadas e sombra com profundidade. Não implementa refração física ou a reprodução do Liquid Glass da Apple.
- O modelo profundo também explora uma atmosfera escura na abertura; a combinação mantém a superfície clara e concentra o vidro sobre fotografia e mapa.
- Os tokens aprovados também são usados na área Início e no cabeçalho do app. As variantes comparativas continuam disponíveis somente no laboratório.

## Organização e bibliotecas

- `app/frontend/src/features/style-lab/`: composição das amostras, variantes e estilos da página.
- `app/frontend/src/shared/styles/theme.css`: tokens propostos, limitados à classe `.ar-theme`.
- `app/frontend/src/shared/ui/`: Button, GlassPanel, MaterialSlider e Toggle tipados.
- `app/frontend/src/shared/hooks/usePrefersReducedMotion.ts`: preferência de movimento do sistema, atualizada ao vivo via `useSyncExternalStore`.
- O código específico do laboratório é carregado sob demanda por `React.lazy`; os componentes aprovados também são utilizados pela área Início.

Bibliotecas adicionadas para este experimento:

| Biblioteca | Uso |
|---|---|
| [Motion](https://motion.dev/docs/react) | Entrada da abertura, valores animados, reflexo e inclinação dos cartões. |
| [Radix Slider](https://www.radix-ui.com/primitives/docs/components/slider) | Controles de opacidade e desfoque com interação por teclado. |
| [Radix Switch](https://www.radix-ui.com/primitives/docs/components/switch) | Controle de movimento. |
| [Lucide React](https://lucide.dev/guide/react) | Ícones SVG tipados e consistentes. |
| [Fontsource Manrope](https://fontsource.org/fonts/manrope) | Fonte local, sem requisição ao Google Fonts na navegação. |

O vidro é CSS próprio com fallback mais opaco quando `backdrop-filter` não estiver disponível. A diferença de resultado entre navegadores ainda precisa ser conferida; não houve validação em aparelhos físicos.

## Fontes e conteúdo

- Fotografia de floresta: [imagem via Unsplash](https://images.unsplash.com/photo-1441974231531-c6227db76b6e), sob a [licença Unsplash](https://unsplash.com/license). Armazenada localmente; é uma referência estética e não representa Araçatuba.
- Ortofoto: prévia IGC/DataGEO reutilizada do protótipo HTML. Os pontos sobrepostos foram criados apenas para demonstrar seleção e camadas; não são resultados do detector.
- Marca: `assets/logo/logo-full.svg`, já existente no projeto, copiada para os assets das amostras.
- Regra 3-30-300: conteúdo educativo resumido com link ao [estudo de Konijnendijk](https://doi.org/10.1007/s11676-022-01523-z). Não há cálculo de atendimento à regra.

## Avaliação recebida e aplicada — 06/11/2026

- Equilíbrio, paleta, cartões, interações, marcações e estados aprovados.
- Busca corrigida para mostrar apenas o outline externo do contêiner, preservando foco visível.
- Floresta e vidro profundo combinados com a base clara na área Início e na amostra Equilíbrio.
- Regra 3-30-300 extraída para `shared/components/RuleSection`, com números que contam uma vez ao entrar na tela. O texto acessível mantém o valor final e movimentos reduzidos dispensam a contagem.
- Prévia de mapa extraída para `IllustrativeMap`, com seleção e camadas demonstrativas. Sua evolução para ferramentas reais pertence à etapa do mapa.
- Grafismos de folhas e copas geométricas criados em SVG e distribuídos entre as seções. São elementos decorativos, sem bloquear controles ou compor dados geográficos.
- Entradas por rolagem, desenho de linhas e movimentos de ponteiro usados com moderação, sem novas dependências.

## Próxima validação do usuário

- Mistura entre Equilíbrio e Profundidade, ajustes gerais e intensidade das animações da área Início aprovados pelo usuário.
- Usuário pediu grafismos muito mais presentes, maiores, visíveis e responsivos a eventos, além de uma cor de destaque complementar.
- A amostra `/laboratorio/equilibrio#grafismos` compara Mel `#E9B949`, Coral `#EE9C82` e Azul-céu `#91BFE0`. O usuário escolheu Mel como destaque predominante e autorizou as outras duas cores em detalhes pontuais. As cores decorativas não alteram ações, estados ou classes de diagnóstico.
- Confirmada preferência por mistura de vetores marcantes com recortes botânicos. O laboratório reúne ramo com aparência fotográfica gerado por IA, vetores próprios de folhas e copa geométrica, três composições e controle de movimento.
- O usuário aprovou a escala e presença da mistura para a página Início. A composição foi aplicada à abertura, apresentação, processo, seção fotográfica, chamada da prévia, regra e encerramento. Avaliar agora o conjunto integrado; Mapa e Administração continuam nas próximas etapas.
- O arquivo gerado e o prompt final estão documentados em `app/frontend/src/assets/graphics/README.md`. É uma amostra estética, não fotografia documental ou espécie identificada.

A próxima validação da área Início permite seguir para a etapa do mapa, conforme o plano por etapas.

## Verificações realizadas

- Lint e build com checagem de tipos aprovados.
- Rotas das três variantes, redirecionamento de `/laboratorio`, navegação de retorno ao app e preservação dos placeholders conferidos no navegador.
- Opacidade alterada pelo teclado e valores restaurados; seleção e ocultação de pontos fictícios, busca demonstrativa e feedback do botão verificados.
- Reflexo e inclinação do cartão conferidos por interação com o ponteiro.
- Preferência de movimento reduzido emulada e alterada ao vivo: movimento desligado, controle desabilitado e restauração ao remover a preferência, sem recarregar a página.
- Desktop e viewport 375 × 812 conferidos; sem transbordamento horizontal nas áreas examinadas. Console sem erros nas interações verificadas.
- Após o feedback, conferidos na área Início: contagem de 3, 30 e 300 ao entrar na seção, valores finais sem contagem com movimento reduzido, seleção da prévia, menu móvel com Escape e retorno ao topo ao trocar de área. Na busca do laboratório, o campo interno não apresenta outline e o contêiner conserva o foco externo.
- No estudo de grafismos: troca das três cores e composições, botão por teclado, controle de movimento e preferência reduzida ao vivo conferidos. Imagem transparente carregada; viewport 375 × 812 sem transbordamento horizontal. O detector mecânico da skill Impeccable não encontrou ocorrências nos novos componentes.
- Na aplicação aprovada à área Início: composição desktop e móvel conferida, imagens carregadas, botão “Animar folhas” acionado por teclado, contagem final preservada com movimento reduzido e console sem erros nas interações examinadas. Corrigido um conflito de posicionamento entre o estilo compartilhado e os ramos sobrepostos. Capturas em `output/site-react-inicio-grafismos` na pasta de trabalho Sematec.
- Lint, build com TypeScript e `git diff --check` passaram novamente após a implementação da área Início. Captura da abertura: `output/site-react-inicio/inicio-desktop.jpg` na pasta de trabalho Sematec.
- Esta verificação foi realizada no navegador Chromium disponível. Aparelhos físicos e outros navegadores ainda não foram testados; não foram medidos FPS ou consumo de GPU.
