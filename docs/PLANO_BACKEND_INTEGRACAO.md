# Arboriza — plano do backend e integração

Levantamento em 08/11/2026, para validação antes da implementação. O objetivo é conectar o site React ao processamento já existente no protótipo, mantendo a solução simples e evoluindo por entregas verificáveis.

## Situação atual

O frontend já permite validar a navegação, o mapa, a organização administrativa, o gerenciador de camadas e a seleção dos setores urbanos do IBGE. Os resultados, a análise, o login e o acervo ainda são demonstrações. A composição administrativa usa somente o modo compacto. Algumas funções de interface, como edição de pontos, importação, exportação, revisão de copas e seleção por desenho, também ainda precisam ser construídas ou conectadas.

A pasta `app/backend` contém apenas um README. O backend em `prototipo-01/backend` é uma base FastAPI utilizável como referência e fonte de código, mas não é ainda o backend completo do produto. Este documento é um plano, não um contrato final de API nem uma aprovação automática para implementar todas as etapas.

## O que existe no protótipo

Conferido em `prototipo-01/backend/api.py`:

| Recurso existente | Como funciona hoje | Adaptação necessária |
| --- | --- | --- |
| Recortes e perfis | `GET /api/recortes` apresenta recortes, perfis e disponibilidade. | Expor configurações adequadas à nova interface, verificando imagens e modelos locais. |
| Análise | `POST /api/analises` e `POST /api/analises/setores` iniciam uma execução; `GET /api/analises/{id}` acompanha estado e etapa. Apenas uma análise simultânea por processo. | Preservar o fluxo, validar entradas e condições reais; tratar erros e recuperação após reinício. |
| Resultados | GeoJSON de pontos e camadas de fusão (`copas`, `pontos-todos`, `pontos-grupos`, `pontos-complementos`) por análise concluída. | Traduzir para os tipos e gerenciador do React; manter origem, coordenadas e metadados. |
| Território | Malha, interseção com desenho, resumo, cobertura, plano de blocos e exportação GeoJSON; análise por setores exige a versão da malha. | Conectar progressivamente à seleção existente e validar limites e dados. |
| Diagnóstico de ruas | Endpoint para análise por pontos ou camadas de copas vinculadas a uma análise territorial. | Integrar após validar dados, critérios e experiência de revisão; não publicar prioridades fictícias. |

O estado dos trabalhos é mantido em memória; arquivos são gravados em pastas locais, mas as consultas de status/resultados dependem do registro em memória da execução atual. Reiniciar o servidor perde esse registro. Não há, nessa API, autenticação, acervo durável, gestão de usuários ou publicação para o público. A UI de camadas do protótipo contém lógica no navegador que também precisa ser avaliada, não apenas copiada do servidor. Um processamento concluído não comprova a qualidade das detecções.

## Necessidades por área

| Área | Necessidade de integração | Situação / observação |
| --- | --- | --- |
| Login e administração | Login, sessão, encerramento e autorização da equipe nas rotas e operações administrativas. Cadastro público não previsto; criação de usuários pela equipe. | Implementação nova. Proteger a API, além da navegação no React. Definir criação inicial de usuário, duração de sessão e recuperação de acesso. |
| Mapa administrativo: território | Obter malha e versão; conferir setores selecionados; resumo, desenho/interseção e enquadramento; solicitar análise pelos IDs e versão. | A malha estática e seleção básica já existem no React; endpoints territoriais existem no protótipo. Definir fonte única e comportamento em mudança de versão. |
| Análise | Perfis, parâmetros, disponibilidade de fonte, iniciar, acompanhar estado/etapa e recuperar falhas. | Adaptar API do protótipo. A interrupção atual no React é apenas simulação; não prometer cancelamento remoto sem implementá-lo. |
| Camadas e revisão | Carregar resultados e limites, múltiplas camadas, propriedades e metadados; editar pontos e revisar copas quando disponível. | A interface usa exemplos; arquivos do protótipo requerem adaptação. Definir como guardar edições e preservar resultado original. |
| Importação/exportação | Receber resultados compatíveis, validar GeoJSON e metadados; exportar resultados e território. | Exportações parciais existem no protótipo; importação e integração com acervo precisam de definição e implementação. Não pressupor que qualquer GeoJSON tenha informações suficientes. |
| Acervo | Listar, buscar e abrir cada análise ou importação, com nome, prévia, abrangência, origem, estado e histórico. | Hoje é demonstrativo. Criar registros persistentes e associação com arquivos e território. |
| Publicação | Equipe seleciona um registro revisado, publica ou retira do ar; preservar histórico. | Nova regra no backend. Uma única publicação para a mesma combinação exata de setores; uma combinação diferente pode sobrepor setores. Definir tratamento de resultados sem setores, concorrência e substituição. |
| Mapa público | Listar resultados publicados com nome e prévia; visitante seleciona e consulta camadas e detalhes publicados. | Hoje usa áreas e pontos fictícios; catálogo e carregamento real ainda precisam de interface e API. Expor somente conteúdo aprovado. |
| Visualizações | Pontos, densidade e limites podem usar dados recebidos; agrupamento por zoom e visualização por setor. | Densidade atual é demonstrativa. Agrupamento e métricas por setor dependem de implementação e regras de contagem; não equivalem a cobertura de copas. |
| Início e regra 3-30-300 | Conteúdo educativo e navegação. | Podem permanecer estáticos. A regra não é calculada com os dados de pontos atuais. |

## Modelo inicial proposto

Usar Python/FastAPI, reaproveitando módulos do protótipo em `app/backend` de forma incremental. SQLite é uma boa opção inicial para ambiente local e metadados; arquivos GeoJSON e saídas grandes podem permanecer em armazenamento local referenciado pelo banco. O banco deve registrar pessoas autorizadas, execuções, resultados, camadas, abrangência e publicações. Tipos, estados e relacionamentos serão refinados antes da implementação; evitar uma estrutura excessiva.

Manter resultado de análise/importação separado das suas camadas. Identificar uma abrangência por IDs de setores normalizados e versão da malha; se a abrangência não for um conjunto de setores, a regra de identidade ainda precisa ser decidida. A operação de publicação precisa verificar a regra de unicidade de forma atômica. Uma análise nova não altera a publicação automaticamente. Arquivos e metadados devem continuar coerentes após erro ou reinício.

## Sequência sugerida para validar em partes

1. **Base local:** inventariar dependências, caminhos, modelos e dados do protótipo; preparar FastAPI em `app/backend`, configuração local e inicialização documentada. Testar disponibilidade sem iniciar inferência pesada. Validar estrutura antes de prosseguir.
2. **Acesso da equipe:** usuário inicial, login/sessão e proteção real das operações e das telas. Validar fluxo e restrições localmente.
3. **Território e análise:** integrar seleção dos setores, versão da malha, perfis, execução real e acompanhamento; validar com uma área pequena e dados reais disponíveis. Manter execução única inicialmente, como no protótipo.
4. **Resultados e revisão:** ler GeoJSON e camadas reais, associar propriedades e permitir revisar; decidir e implementar edição e salvamento sem perder a origem. Validar os resultados com a equipe.
5. **Acervo e arquivos:** persistir registros e histórico; adicionar importação/exportação com formatos e validação acordados. Testar reinício e recuperação.
6. **Publicação e mapa público:** aplicar a regra de abrangência, publicar/retirar, listar resultados aprovados e carregá-los no mapa público. Validar sobreposições e histórico.
7. **Aprimoramentos:** diagnóstico de ruas, agrupamento de pontos e análises por setor conforme dados e critérios validados, com desempenho e usabilidade avaliados.

A ordem pode ser ajustada após validação. Cada etapa combina frontend e backend quando necessário e termina com uma demonstração para aprovação.

## Pontos a decidir antes das etapas correspondentes

- Criação e recuperação do primeiro usuário da equipe e política de sessão; implantação apenas local ou também em rede.
- Quais perfis, modelo, fontes de imagem e cobertura estarão disponíveis no primeiro processamento real; recursos da máquina e acesso aos arquivos existentes.
- Como diferenciar detecção original, edição e validação humana; o que significa um resultado pronto para publicação.
- Formato obrigatório de importação, prévia/nome, e se arquivos importados precisam informar setores e versão da malha.
- Publicação de uma nova versão para a mesma combinação: bloquear até retirada ou oferecer substituição explícita; tratar resultados sem setores.
- Regras de diagnóstico, contagem e duplicidade quando áreas ou camadas se sobrepõem; definição de métricas por setor.

## Critérios mínimos de verificação

Validar contratos e erros, acesso não autorizado, persistência após reinício, falha de processamento e leitura de resultados, importação inválida, conflito de publicação e acesso público apenas a registros publicados. Testar um fluxo completo com dados e modelo reais quando disponíveis, distinguindo funcionamento técnico de precisão do modelo. Verificar responsividade, acessibilidade e desempenho com volume representativo antes de afirmar que a solução está pronta para uso amplo.
