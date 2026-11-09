# Login da equipe — interface em validação

Implementado em `/login` por autorização do usuário em 08/11/2026, mantendo a etapa somente no frontend.

- Tema aprovado: Manrope, verdes, destaque Mel, fotografia local de referência e `GlassPanel` sem inclinação; `Button` compartilhado. CSS restrito à funcionalidade, sem dependências novas.
- Campos Usuário e Senha. O identificador definitivo da conta será confirmado com o contrato do backend; não se exige e-mail nesta amostra.
- Mostrar/ocultar senha com nome acessível e estado pressionado. Foco externo único por campo, rótulos e mensagens associadas aos campos inválidos.
- Validação local somente de preenchimento. O envio vazio foca o primeiro campo inválido. Não há avaliação de credenciais, força de senha ou conta existente.
- Envio preenchido permanece em `/login`, informa que não abriu sessão e limpa a senha. Não há chamadas de API, armazenamento de credenciais ou sessão simulada.
- Link independente “Visualizar portal demonstrativo” permite avaliar a interface administrativa. Nenhuma rota é protegida nesta etapa.
- Sem cadastro público. O texto orienta procurar a equipe para cadastro interno e ajuda com senha; não há recuperação fictícia.

## Verificações

Lint e build com TypeScript estrito aprovados. No Chromium desktop: formulário vazio, preenchimento parcial, foco no campo inválido, mostrar senha, envio demonstrativo, limpeza da senha, recarga e navegação ao portal conferidos. Captura desktop em `output/site-react-login/desktop.png` na pasta Sematec.

Viewport 375 × 812: formulário e navegação examinados pela captura visível da janela e árvore de acessibilidade. A captura de página inteira móvel falhou na ferramenta; não há imagem móvel exportada. Viewport temporário restaurado. Não houve teste em aparelho físico ou auditoria completa de acessibilidade.

Backend, autenticação, autorização das APIs, persistência e cadastro interno de usuários continuam pendentes. SQLite permanece uma proposta para a versão local, sem implementação nesta rodada.
