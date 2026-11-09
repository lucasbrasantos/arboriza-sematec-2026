# Base urbana V2 — continuidade

## Entrega concluída — 09/11/2026

Base 499/499 concluída e publicada: 104.904 indivíduos, 11.653 grupos, cobertura 14,808%. Commit funcional `9189254` enviado à `app-front`; release e seus quatro anexos enviados. Ver `docs/RELATORIO_BASE_URBANA_V2.md`. A inferência NÃO precisa ser refeita. Capturas reais em `docs/assets/base-urbana-v2/`. O recibo do email Gmail e o encerramento dos processos devem ser conferidos em `app/backend/cache/base-urbana-qa/entrega-final.json` (registro local após envio). Não repetir inferência.


## LEIA PRIMEIRO — entrega noturna autorizada em andamento

Trabalhar na pasta ORIGINAL `X:\-code-\arboriza-sematec`, branch `app-front`. Usuário autorizou explicitamente concluir, validar, COMMITAR e SUBIR para GitHub enquanto dorme; também pediu salvar arquivos e minimizar tokens. Não esperar nova aprovação. Não trocar a branch; preservar o fix de StreetWorkspace.

### Estado após implementação e QA (09/11/2026)

- Base completa em execução: `app/backend/resultados/base-urbana/20261109T031948-ca7410d3/`. Ler `estado.json`, `execucao.log`, `finalizacao.json` (quando criado). São 29.882 janelas para os 499 setores. Não iniciar outra versão nem repetir GPU. A inferência foi acelerada com pipeline de leitura/GPU/escritor, preservando pixels, modelos, máscaras e regras; retomou dos checkpoints após 1.884 janelas.
- Piloto concluído em `20261109T031847-ff1e5e4c`: 125 indivíduos, 20 grupos, 6,566% de cobertura, iguais ao resultado anterior. 81 janelas reutilizadas; aproximadamente 11 s.
- API administrativa pronta: iniciar/retomar/pausar/publicar; lock GPU compartilhado; processo independente da API; ETA por motor; snapshot público leve.
- UI pronta em `/mapa/comparar`, link no mapa público e botão no administrativo (mínimo 2 setores); seleção, 3 métricas, escala fixa global e rótulos desligados por padrão. Painel administrativo no hub, restrito a admins.
- Comparação pública usa somente setores + estatísticas. Após publicação, `app/frontend/public/data/base-urbana-aracatuba.geojson` será salvo e versionado. Novo clone lê o snapshot sem GPU. Pontos/copas/GeoPackage completos ficam salvos em resultados e serão anexados à release GitHub; links em `base-urbana-downloads.json`.
- 73 testes Python passaram; lint/build/TypeScript e detector Impeccable passaram. AuthTest isola os novos locks/estado para não interferir com a GPU real. Testes novos comparam NMS/áreas com fusão original, persistência e exportação GPKG/GeoJSON.
- QA visual no navegador interno com resposta de teste do piloto real: desktop 1440x900 e celular 390x844, seleção, cobertura/quantidade, rótulos. Sem erros; interceptação e viewport foram removidas. Capturas em `app/backend/cache/base-urbana-qa/{desktop,mobile}-piloto.png`. O piloto NÃO foi publicado como cidade. Não alegar que a cidade foi concluída antes do resultado real.
- GitHub remoto `https://github.com/lucasbrasantos/arboriza-sematec-2026.git`, branch `app-front`, base `86f506d403107fb28f629a82a872e7dec4e36c9a`. A credencial local foi conferida e tem permissão push; nunca imprimir token.

### Conclusão automática local

**Última instrução do usuário (foi dormir):** minimizar tokens/consultas, monitorar GPU/CPU/RAM/disco e preservar saldo de uso (percentuais de quota não estão acessíveis de modo confiável). Após conclusão: testar/reportar, commit/push na `app-front` (NÃO main), enviar email para `lucasbrasantos@gmail.com` com prints REAIS da cidade inteira, resultado e links, usando Gmail conectado e skill `status-email`. Depois encerrar API/Vite/auxiliares iniciados pelo agente, sem matar processos alheios nem desligar Windows. Só finalizar a resposta após Gmail enviado e limpeza. O usuário não responderá; não pedir confirmação.

- Gmail já conferido: conexão é `bragasantoslucas123@gmail.com`; destinatário explicitamente solicitado é `lucasbrasantos@gmail.com`. Usar send_email MIME multipart com HTML e PNGs anexos/inline, assunto Arboriza, incluir linha `Identificador: codex-status-email`. Skill lida em `C:\Users\lucas\.agents\skills\status-email\SKILL.md` e template correspondente. O conector Gmail só pode ser chamado pelo agente; o auxiliar local NÃO envia email. NÃO esquecer esta etapa.
- Depois da conclusão automática, fazer QA do mapa real via CUA, salvar capturas desktop/mobile na pasta de cache, enviar por Gmail, conferir resposta id e então encerrar processos locais próprios (API/Vite/auxiliares); conferir PIDs/comandos antes de parar.
- Em ~7.664 janelas houve WinError 5 transitório ao substituir `estado.json`, causado por concorrência de leitura do Windows. Checkpoints preservados. `jobs.atomic_json` agora tenta novamente com backoff; novo teste cobre bloqueio transitório. Inferência retomada do SQLite, sem repetir janelas. O auxiliar de finalização anterior terminou com erro e deve ser relançado com novo manifesto dos hashes corrigidos.
- Auxiliar agora registra CPU, RAM disponível, GPU/VRAM/temperatura/potência e disco a cada 30 s em `recursos.jsonl`. GPU ≥85°C, RAM livre <3 GiB ou disco <1 GiB causam pausa preventiva (sem alterações no plano de energia). Temperatura de CPU não é fornecida por API comum e não foi prometida. Não executar testes GPU simultâneos à inferência.

`scripts/finalizar_base_urbana.py` aguarda esta execução e mantém o sistema acordado sem alterar plano de energia. Valida todas as geometrias, contagens e formatos dos 499 setores; repete testes Python e lint/build; publica snapshot; faz commit/push e cria release com GeoJSONs comprimidos, GeoPackage e resumo. Interrompe envio se testes falharem ou se branch/HEAD/arquivos revisados mudarem. Nenhum dado/modelo/cache/credencial entra no commit.

Manifesto previsto: `app/backend/cache/base-urbana-qa/finalizacao-manifesto.json`. Logs: `finalizacao-out.log` e `finalizacao-err.log` na mesma pasta. Antes de iniciar outra instância, conferir PID em `finalizacao-processo.json` e o estado final. Se o manifesto já existir e o auxiliar estiver rodando, NÃO editar arquivos rastreados: os hashes são fixados para proteção de commit. Em caso de correção necessária, parar somente o auxiliar, preservar a inferência, corrigir/testar e gerar novo manifesto antes de relançar.

O envio só está concluído quando `finalizacao.json` contém `stage: concluido`, SHA e URL da release. Se houver `stage: erro`, ler o log e resolver; não afirmar sucesso nem refazer inferência. Após sucesso, conferir remoto e mapa com a base inteira, além de revisar os relatórios. Ainda não há commit desta implementação no momento deste registro.


## Recuperação anterior preservada

A venv foi recuperada (5.872 arquivos + 26 auxiliares), com auditoria de 22.358 arquivos sem ausentes. Banco íntegro, 523 ortofotos presentes, CUDA validada. Relatório em `app/backend/cache/recuperacao-ambiente/REVISAO_FINAL.md`. O bug de toggle das ruas foi corrigido em `StreetWorkspace.tsx` e está incluído na entrega. A worktree `X:\-code-\arboriza-sematec-base-urbana` contém somente rascunho antigo; não usá-la para continuar.
