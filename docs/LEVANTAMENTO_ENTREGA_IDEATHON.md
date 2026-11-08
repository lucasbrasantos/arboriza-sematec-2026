# Arboriza — levantamento para a entrega final do Ideathon

**Data:** 08/11/2026.  
**Fonte:** [Ideathon — Fatec 2026](doc-apoio/Ideathon%20-%20Fatec%202026.pdf), páginas 10–12; cronograma na página 4.  
**Escopo desta rodada:** diagnóstico e plano de documentação. Não certifica conformidade final, não cria conta de demonstração e não publica o site. Vídeo e produção do pitch ficam a cargo da equipe, fora desta rodada.

## 1. Resultado do levantamento

A implementação tem vários elementos necessários, mas a documentação principal ainda não reúne todos os itens exigidos. Há instruções de execução e fontes distribuídas em READMEs e relatórios, enquanto o README da raiz cobre apenas problema, solução e links de desenvolvimento. O README de `app/` ainda descreve uma versão anterior sem backend, em desacordo com o código e com o README atual do frontend.

As maiores pendências não são apenas textuais: confirmar um endereço acessível à banca, disponibilizar acesso demonstrativo às funções protegidas e conferir o percurso de uso sem instalações ou chaves particulares do avaliador. A existência do código não prova que esse percurso já esteja disponível.

## 2. Matriz de exigências

| Exigência | Evidência encontrada | Situação e ação necessária |
| --- | --- | --- |
| Link acessível do protótipo | READMEs indicam endereços `127.0.0.1`; API documentada como local, sem preparação para exposição na internet. | **Pendente de definição.** Registrar URL de entrega e validar acesso por outro dispositivo. Endereço local não é um link acessível remotamente à banca. |
| README: problema e solução | Presentes no README principal. | **Parcialmente coberto.** Atualizar solução para o escopo atual: análise, revisão, acervo e publicação. Propostas automáticas de plantio não devem aparecer como capacidade já validada. |
| README: como rodar | Comandos separados nos READMEs de frontend, backend e protótipo. | **Parcialmente coberto.** Criar percurso principal na raiz com links de detalhe; esclarecer preparação dos dados/modelos e a diferença entre uso da demonstração e instalação para desenvolvimento. |
| README: limitações e próximos passos | Informações em documentos de escopo e relatórios técnicos. | **Pendente na raiz.** Resumir qualidade não validada globalmente, abrangência real, dados de exemplo, dependências e roadmap. |
| Declaração de originalidade | Não foi localizada declaração consolidada. | **Pendente.** A equipe precisa confirmar autoria e desenvolvimento durante o evento, reconhecendo explicitamente bibliotecas, pesos pré-treinados e recursos de terceiros. |
| Declaração de IA: ferramentas, finalidade e conteúdo gerado | Há registro de um grafismo botânico sintético e seu prompt; a conversa registra assistência de IA em planejamento, código e documentação. | **Parcialmente coberto.** Consolidar declaração curta, com uma tabela das ferramentas e contribuições efetivamente usadas. Confirmar histórico adicional com os integrantes. |
| Fontes de dados e simulações | IGC/DataGEO, IBGE e OSM documentados em relatórios; assets têm notas próprias; exemplos identificados em várias telas. | **Parcialmente coberto.** Reunir índice de fontes e manter a indicação de simulação junto aos exemplos. Rever telas novas antes da entrega. |
| Uso em navegador/celular sem instalação | Frontend web em React; inferência executada no servidor. | **Arquitetura compatível, entrega não comprovada.** O visitante não deve instalar Node, Python, CUDA ou pesos; o ambiente da equipe pode precisar desses componentes. Validar a versão entregue em outro dispositivo. |
| Sem dependência de serviço pago/chave privada | Fluxo central utiliza modelos locais e fontes cartográficas; proposta futura de edição de fotos dependeria de API externa. | **Conferir na entrega.** O caminho obrigatório da demonstração precisa funcionar sem a banca fornecer chave ou contratar serviço. A simulação generativa futura não pode ser requisito desse caminho; se oferecida, precisa ter alternativa gratuita sem chave exigida do avaliador. |
| Sem login obrigatório, ou conta demonstrativa funcional | Início e `/mapa` são públicos no roteamento. Administração exige sessão real; usuários são criados internamente. | **Consulta pública prevista; acesso administrativo demonstrativo pendente de confirmação.** Definir conta própria para demonstração, instruções e permissões. Não remover a proteção da administração apenas para atender ao evento. |
| Dados reais ou explicitamente simulados | Fontes oficiais e pilotos reais coexistem com exemplos de interface. | **Parcialmente coberto.** Auditar legendas e metadados da versão final. Proposta de copa não é árvore confirmada; ausência de resultado não significa zero árvores. |
| Git com commits de pelo menos 3 integrantes | `git shortlog -s HEAD` mostra seis grafias/identidades de autor; há nomes e aliases diferentes. | **Evidência favorável.** Confirmar a correspondência de pelo menos três identidades com integrantes reais. Não confundir aliases com pessoas distintas nem fabricar histórico. |
| Contraste, texto redimensionável e informação além da cor | Há foco visível, rótulos, preferência de movimento reduzido e estilos responsivos. | **Implementação parcial; verificação final necessária.** Conferir zoom de texto, teclado e legendas nos fluxos públicos e administrativos; não declarar auditoria completa sem executá-la. |
| Bibliotecas e templates declarados | `package.json`, requisitos Python e nota sobre template oficial React/Vite no README do frontend. | **Parcialmente coberto.** Criar resumo legível das principais dependências, template e licenças/atribuições relevantes. Arquivo de dependências sozinho não explica o uso à banca. |
| Presença mínima nos checkpoints | Não comprovável pelo código consultado. | **Confirmação da equipe.** Reunir evidências disponíveis com integrantes/organização. |
| Repositório criado no evento; projeto não pré-existente | Primeiro commit local alcançável: `bdc5fe7`, em 04/11/2026; PDF informa atividades em 03–06/11 e apresentação em 09/11. | **Datas compatíveis, prova incompleta.** Conferir criação do repositório na plataforma e procedência do material. Data do primeiro commit não comprova sozinha criação do repositório nem originalidade integral. |

Pitch de no máximo seis slides e vídeo de backup de 1–2 minutos continuam obrigatórios pelo PDF, embora sua produção esteja fora desta rodada. O briefing de apresentação anterior contém uma sugestão extensa de dez slides: usar como material de apoio e condensar o deck final para até seis; não entregar dez slides como pitch final.

## 3. Organização proposta para a documentação

### README principal

Deve funcionar como porta de entrada da entrega, nesta ordem:

1. Nome, proposta, problema e público.
2. Link do protótipo e percurso rápido para avaliação.
3. Como acessar a parte pública e, quando necessário, a conta demonstrativa da equipe.
4. Funcionalidades disponíveis e estado da versão entregue.
5. Como executar localmente, com pré-requisitos e links aos guias frontend/backend.
6. Fontes de dados, exemplos simulados e limitações de interpretação.
7. Declarações resumidas de originalidade, uso de IA, bibliotecas e template.
8. Limitações conhecidas e próximos passos.
9. Integrantes, contribuições e links de documentação.

O README deve explicar o que a banca encontrará no link publicado. Não tratar `npm run dev`, uma venv ou o endereço `localhost` como instrução de acesso de um visitante remoto.

### Documentos de apoio sugeridos

| Documento proposto | Conteúdo |
| --- | --- |
| `docs/ORIGINALIDADE_E_USO_DE_IA.md` | Declaração da equipe, ferramentas, finalidades, conteúdos gerados/assistidos e responsabilidade pela revisão. |
| `docs/FONTES_E_CREDITOS.md` | Bases geográficas, imagens, modelos pré-treinados, licenças, assets decorativos, bibliotecas e template. |
| READMEs de `app/`, frontend e backend | Percurso coerente com a versão final; separar estado atual de notas históricas. |

Estes nomes são uma proposta. Não é necessário criar dezenas de arquivos: a declaração curta pode ficar no README, com os detalhes em um ou dois documentos de apoio.

## 4. Declaração de IA: nível de detalhe suficiente

O regulamento pede **quais ferramentas, para quê e o que foi gerado**. Não exige publicar cada prompt, conversa, token ou versão de todos os modelos de assistência. Evitar uma declaração vaga que diga apenas “usamos IA”.

Proposta de texto, a ser validada pela equipe antes de assinar/publicar:

> A equipe utilizou ferramentas de inteligência artificial como apoio ao planejamento, desenvolvimento, revisão de código, documentação e produção de elementos gráficos do Arboriza. As contribuições foram selecionadas, adaptadas e revisadas pelos integrantes. O projeto também utiliza modelos pré-treinados de visão computacional para propor copas de árvores; suas saídas são estimativas sujeitas a revisão. As ferramentas, finalidades e materiais correspondentes são relacionados abaixo, preservando os créditos e as condições de uso dos recursos de terceiros.

| Ferramenta / modelo | Finalidade e contribuição a registrar | Grau de confirmação |
| --- | --- | --- |
| Codex / assistência OpenAI | Apoio em arquitetura, implementação React/Python, ajustes de interface, revisão e documentação. | Presente no desenvolvimento desta conversa. Confirmar outras ferramentas usadas pelos integrantes. |
| ChatGPT | Planejamento, discussão de escopo e apoio a textos e materiais de apresentação. | Confirmar identificação que a equipe pretende declarar para as ferramentas de conversa utilizadas. Não duplicar como ferramenta diferente se for o mesmo uso. |
| Ferramenta integrada de geração de imagens OpenAI | Recorte botânico sintético `botanical-branch.png`, usado como decoração. | Registrado em `app/frontend/src/assets/graphics/README.md`, com prompt; não é fotografia de Araçatuba. O modelo exato do gerador não foi identificado nesse registro. |
| Detectree2 / Cambridge | Inferência de possíveis copas com pesos pré-treinados. | Documentado no motor e nos manifestos. Não declarar treinamento próprio. |
| Restor TCD + Cambridge | Perfil v2 de pontos/copas, com indivíduos, grupos e complementos pendentes. | Documentado no perfil de fusão. |
| DeepForest | Experimentos históricos de detecção, separados dos perfis atuais. | Documentado no laboratório; identificar como investigação anterior. |
| HQ-SAM | Laboratório anterior de segmentação, caso apresentado como parte da trajetória. | Documentado no histórico; não é o motor do fluxo atual. |
| Gemini para simulação de fachada | Proposta futura de edição generativa de imagem. | Não declarar como ferramenta já utilizada nessa funcionalidade. |

Se a equipe quiser citar versões de modelos de assistência, usar somente as que conseguir confirmar nos registros. Os IDs dos modelos de detecção podem ser detalhados porque há manifestos. Modelos de detecção do produto e ferramentas usadas para ajudar a desenvolver o produto devem aparecer como finalidades distintas.

## 5. Originalidade: declaração e evidências

Proposta de texto **pendente de confirmação dos integrantes**:

> O Arboriza foi desenvolvido pela equipe no contexto do Ideathon FATEC 2026. O projeto reúne implementação, integração e decisões de produto realizadas pelos integrantes, com apoio declarado de ferramentas de IA e utilização de bibliotecas, modelos pré-treinados e fontes de dados de terceiros devidamente identificados. Não reivindicamos autoria dos recursos externos utilizados. O histórico Git registra a evolução e a participação da equipe.

Antes de adotar esse texto, confirmar que ele descreve corretamente a origem do código e dos materiais. A existência de um laboratório anterior dentro da mesma semana não significa, por si só, infração; é necessário distinguir fases internas do evento de recursos anteriores ao evento. Caso exista base pré-existente relevante, esclarecer sua procedência e consultar a organização sobre a compatibilidade com a regra, em vez de ocultá-la.

Não alterar datas/autores de commits para preencher o requisito. A equipe deve identificar os integrantes reais e suas contribuições, aproveitando o histórico que já existe.

## 6. Registro de fontes e créditos

Consolidar, com links e função no sistema:

- **IGC-SP / DataGEO:** ortofotos RGB da coleção 2023/2024, GSD declarado de 25 cm; distinguir imagem de fundo da imagem efetivamente analisada e manter procedência/data disponível.
- **IBGE:** malha definitiva dos setores do Censo 2022, filtrada para os 499 setores urbanos de Araçatuba; registrar versão, município e processamento do recorte.
- **OpenStreetMap:** fundo de ruas e eixos viários para diagnóstico. As métricas de copas/trechos são calculadas pelo Arboriza, não fornecidas prontas pelo OSM.
- **Cambridge / Restor / DeepForest:** pesos e configurações de terceiros, função e licença aplicável. Restor consta com restrição não comercial na ficha já documentada; não confundir licença de biblioteca com licença de pesos.
- **Assets visuais:** fotografia de floresta do Unsplash (referência estética, não paisagem local), grafismo botânico sintético, SVGs de apoio e marca fornecida pela equipe.
- **Bibliotecas e template:** React, TypeScript, Vite/template React, React Router, Leaflet/React Leaflet/Leaflet.heat, Motion, Radix UI, Lucide e Manrope; Python/FastAPI/Pydantic, PyTorch/torchvision, Detectron2/Detectree2, Rasterio, PyProj e Shapely, conforme o ambiente entregue. Conferir licenças a partir das dependências efetivas.
- **Exemplos e imagens de referência:** identificar dados fictícios, interface ilustrativa e capturas de referências externas, sem apresentá-los como resultados próprios.

Manter atribuição cartográfica no próprio mapa, não somente no README. Uma declaração geral de dados simulados não substitui rótulos locais quando há dados reais e fictícios na mesma aplicação.

## 7. Proposta para uma página do site

Criar uma página pública **“Sobre o projeto e transparência”**, acessível pelo rodapé, com rota sugerida `/sobre`:

- Proposta do Arboriza e contexto acadêmico.
- Equipe e responsabilidades, depois de confirmadas.
- Fontes cartográficas e distinção entre resultados, exemplos e estimativas.
- Nota curta de originalidade e uso de IA.
- Principais tecnologias, bibliotecas e créditos.
- Limitações e próximos passos.
- Link do repositório e da documentação.

Essa página é uma sugestão de comunicação, não uma exigência explícita de página adicional no regulamento. O README continua sendo obrigatório. A página não deve publicar senhas de contas internas nem chaves de API; o acesso demonstrativo precisa ser próprio para avaliação.

## 8. Decisões e informações que faltam

1. URL final e forma de disponibilização da demonstração. Confirmar que a API necessária também estará acessível, sem depender do computador do avaliador.
2. Conta de demonstração: quais funcionalidades a banca poderá acessar e como obter as instruções. Usar conta própria e permissões compatíveis, evitando expor a conta real de administração.
3. Nomes e papéis dos integrantes; vínculo dos autores Git com pelo menos três pessoas da equipe.
4. Confirmação da origem do projeto e dos materiais, data de criação do repositório e registros de checkpoints disponíveis.
5. Ferramentas adicionais de IA usadas por outros integrantes e materiais gerados: textos, código, logo, imagens ou slides. Declarar somente o que for confirmado.
6. Versão final das funcionalidades de acervo e consulta pública e quais exemplos continuarão demonstrativos.
7. Aprovação da página pública de transparência e de seu conteúdo; não é necessária para iniciar a atualização dos documentos.

## 9. Ordem recomendada de trabalho

1. Confirmar informações de autoria/IA e preparar declarações curtas, fontes e créditos.
2. Atualizar README principal e corrigir descrições antigas nos READMEs auxiliares.
3. Concluir disponibilização do protótipo, acesso demonstrativo e fluxo sem chave/serviço pago obrigatório.
4. Conferir rótulos de dados e acessibilidade mínima da versão de entrega.
5. Se aprovada, criar a página pública reaproveitando o conteúdo consolidado.

## 10. Limites desta conferência

Foi feita leitura das exigências do PDF, inspeção de arquivos de documentação, roteamento, autenticação, créditos de assets e histórico Git local. Não houve nova auditoria de acessibilidade, teste de hospedagem, login de demonstração, validação de presença em checkpoints ou investigação independente de autoria. Nenhum desses itens foi marcado como concluído sem evidência.
