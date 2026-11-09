# Base urbana permanente V2

O mapa em `/mapa/comparar` lê somente os polígonos dos setores e seus indicadores. Não solicita os pontos nem as copas detalhadas. O acesso também está no mapa público e, após selecionar dois ou mais setores, no mapa administrativo. Rótulos começam desativados; quantidade e cobertura percentual são opcionais. As classes de cores são calculadas para a base inteira e permanecem fixas ao selecionar um recorte.

## Indicadores

- Indivíduos: candidatos individuais do V2, atribuídos uma única vez pelo ponto representativo, com desempate de fronteira pelo código IBGE.
- Densidade: indivíduos por hectare de setor.
- Cobertura: área da união de máscaras individuais e de grupos, recortada pelo setor e dividida pela área projetada do setor. Complementos pendentes ficam excluídos. A cobertura do conjunto usa as áreas, sem média simples dos percentuais.
- Cinza significa ausência de resultado publicado; não é zero. Os pontos são centros representativos de copas, não posições confirmadas dos troncos.

## Processamento

No portal administrativo, o painel **Base urbana permanente** permite gerar, pausar, retomar e publicar. A API verifica o papel de administrador. O processo é independente da API e compartilha um lock de GPU com as análises normais; pause a base para executar outra análise.

Alternativa no terminal, dentro de `app/backend`:

```powershell
.\.venv\Scripts\python.exe -m arboriza_api.urban_base
.\.venv\Scripts\python.exe -m arboriza_api.urban_base --retomar
.\.venv\Scripts\python.exe -m arboriza_api.urban_base --publicar
```

O comando inicial cobre todos os 499 setores urbanos. `--ids CODIGO...` cria um piloto parcial, que não pode substituir a base publicada. A estimativa usa a vazão observada de cada motor; consolidação/exportação são etapas seguintes e ficam sem ETA até terminarem. A grade, a resolução, os modelos e a fusão são preservados. Uma thread prepara a próxima imagem, a GPU faz a inferência e um único escritor converte/salva máscaras. Os checkpoints SQLite são confirmados por janela, sem guardar a cidade inteira em RAM.

Imagens/modelos/malha alterados impedem retomar uma execução incompatível. Reinício abrupto é detectado pelo lock do processo; resultados anteriores permanecem disponíveis. O cache da inferência é compartilhado com o V2 existente, identificado pelos pixels, validade, modelo e janela. O código foi comparado com a fusão original em testes de contagem e área; a execução real piloto produziu os mesmos 125 indivíduos e 20 grupos.

## Arquivos persistentes

Cada versão fica em `app/backend/resultados/base-urbana/ID/`:

- `pedido.json`, `estado.json`, `modelos.json` e `execucao.log`: entradas, progresso e procedência.
- `catalogo.sqlite`: janelas completas, candidatos, índice espacial e resultado consolidado.
- `pontos.geojson`, `copas.geojson` e `aracatuba.gpkg`: exportações completas com categorias.
- `setores.geojson`: limites e estatísticas que alimentam o mapa.

`current.json` identifica a execução e `published.json` identifica a versão publicada. Publicar também salva `app/frontend/public/data/base-urbana-aracatuba.geojson`: esse resumo leve vai para o Git. Um novo clone ou uma inicialização posterior lê a base pronta, sem executar modelos. O frontend usa esse snapshot também quando a API não está disponível. Atualizar a base exige uma ação administrativa explícita.

Os arquivos detalhados são locais e ignorados pelo Git; a entrega inicial autorizada também os anexa a uma release do GitHub (GeoJSONs comprimidos e GeoPackage). `base-urbana-downloads.json` guarda os links de download para clones que não têm os detalhes locais. Guardar backup do diretório de resultados continua recomendado.

## Finalização inicial autorizada

`scripts/finalizar_base_urbana.py --manifest CAMINHO` é um auxiliar local, iniciado explicitamente para a entrega de 09/11/2026. Aguarda a execução, verifica integridade/quantidades/geometrias dos 499 setores, executa os testes Python, lint e build, publica o snapshot, faz commit/push e envia anexos da release. O manifesto fixa branch, commit inicial e hashes dos arquivos revisados: mudanças concorrentes interrompem o envio. Falhas são registradas em `finalizacao.json`; não há push se os testes falharem. Credenciais existentes do Git são usadas somente em memória. O processo impede suspensão enquanto está ativo e libera essa solicitação ao terminar, sem alterar o plano de energia.

Esse auxiliar não faz parte do fluxo normal da API e não usa IA, tokens ou agendamentos do chat. Não declara que todos os possíveis fluxos da aplicação foram testados: valida os contratos e artefatos necessários à entrega. Capturas de QA usam o piloto real de um setor, sem publicá-lo como resultado da cidade.
