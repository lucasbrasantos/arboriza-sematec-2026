# Captura local das ortofotos urbanas a 25 cm/pixel

## Escopo aprovado

Capturar os 499 setores urbanos da malha IBGE 2022 já usada pelo projeto, com 25 m de contexto. Não é um download de todo o retângulo envolvente nem de todo o território rural do município. Só são solicitados os quadrados de 500 × 500 m que intersectam a união dos setores ou esse contexto; buracos e espaços entre regiões permanecem fora do planejamento quando não há interseção. O raster preserva o quadrado completo, para reutilização em outros recortes.

Para a malha atual, o plano contém **523 blocos**. Um bloco pode conter terreno fora do setor porque a grade precisa ser estável entre seleções. O log informa a porcentagem de setor em cada bloco e identifica os que servem apenas ao contexto. A grade é ancorada em múltiplos de 500 m em EPSG:31982, não no retângulo de cada seleção.

Cada requisição tem 2000 × 2000 pixels em EPSG:31982: **0,25 × 0,25 m por pixel**, com PNG e transparência no transporte. A camada é `ORTOFOTOS_SP_2023_2024`. O catálogo oficial declara GSD nativo de 25 cm:

https://datageo.ambiente.sp.gov.br/geoportal/catalog/search/resource/details.page?uuid=%7B7665C108-A2FF-49D8-A1EF-A6968BA6016A%7D

O GetCapabilities foi consultado em 07/11/2026 e anunciou PNG e EPSG:31982. Foi conferida uma resposta piloto em memória, antes da instrução de deixar a execução com o usuário: PNG de 2000 × 2000, cerca de 8 MB, com pixels válidos em todo esse bloco. Esse teste não é o download do acervo nem garante as respostas dos demais blocos.

## Executar no PowerShell

```powershell
Set-Location 'X:\-code-\arboriza-sematec\prototipo-01'
.\.envs\detectree2\Scripts\python.exe -u .\scripts\baixar_acervo_urbano.py --baixar --paralelos 3
```

Para conferir somente o plano, retire `--baixar`. Nesse modo não há requisições, criação de acervo ou execução de modelos.

O script usa as bibliotecas do ambiente existente do protótipo. Não inicia frontend, servidor de mapas nem inferência. Não precisa do ZIP do outro projeto ou dos pesos Restor.

## Logs, arquivos e retomada

Destino padrão:

```text
prototipo-01/data/ortofotos/acervo-urbano-25cm/
  plano.json
  progresso.json
  captura.log
  31982-500-<coluna>-<linha>.tif
  31982-500-<coluna>-<linha>.json
```

- `plano.json`: IDs dos setores, hash da malha, geometrias reais/de contexto, grade, interseções e blocos necessários.
- `captura.log`: histórico com data, horário, requisições, tentativas, falhas e progresso. Também aparece no terminal.
- `progresso.json`: resumo atualizado a cada bloco, reutilizações, arquivos completos, falhas e lista dos pendentes.
- GeoTIFFs: RGB8, compressão sem perdas DEFLATE, blocos internos de 512 px, máscara de validade e overviews de 2×, 4× e 8×. Georreferência e procedência também são embutidas no arquivo.
- JSON de cada bloco: requisição exata, origem, data, hashes do PNG/TIFF, tamanho, tempo, tentativas e pixels válidos.

O log dá sinal de atividade a cada 20 s mesmo se nenhum bloco terminou. A estimativa de tempo começa após três novos blocos e usa o ritmo observado da sessão. Rede, retries, compressão e diferenças entre imagens podem mudar esse tempo; não é uma promessa de duração.

Pode interromper com **Ctrl+C** e aguardar os trabalhadores encerrarem. Execute depois o mesmo comando para retomar: arquivos íntegros são conferidos e reutilizados, inclusive um TIFF publicado antes de uma interrupção na gravação de seu JSON. A trava do sistema operacional impede duas capturas simultâneas no mesmo diretório. Não apague `.captura.lock`; sua existência não significa que exista um processo ativo.

Falhas têm até cinco tentativas, com espera progressiva e respeito ao `Retry-After` numérico até 60 s. As conexões paralelas podem ser ajustadas de 1 a 4. Uma falha definitiva não impede os demais blocos de terminar: o resumo mostra os pendentes, e nova execução tenta novamente esses blocos. Arquivos existentes incompatíveis ou com hash alterado são sinalizados, sem sobrescrita silenciosa.

Uma imagem incompleta não é aceita como completa: além de conferir formato, dimensões, transformação e hash, a validação exige pixels válidos em toda a porção necessária do setor/contexto dentro do bloco. Transparência fora dessa porção é permitida. Essa validação verifica cobertura declarada pelo WMS; não detecta todo defeito visual de uma ortofoto.

Código de saída: `0` para conclusão sem pendentes, `1` se houver falhas/pendentes e `130` para interrupção do usuário. O diretório de dados já é ignorado pelo Git. O script não aplica stashes nem modifica o frontend.

## Espaço e uso posterior

Os 523 blocos somam 6,28 GB de RGB bruto antes de compressão, máscaras e overviews. O tamanho final depende do conteúdo. O script preserva pelo menos 1 GiB livre antes de gravar cada novo TIFF e mostra o espaço livre no resumo.

Não é necessário costurar tudo em um JPG. Os arquivos já têm blocos internos e pirâmides para leituras menores. Um VRT ou catálogo espacial poderá reuni-los logicamente para recortar imagens por coordenadas. A aquisição em blocos também facilita completar regiões futuras sem recriar um mosaico inteiro.

Esta etapa **não liga automaticamente o acervo ao detector ou ao mapa**. As próximas integrações são:

1. Consultar cobertura local e ler as janelas da análise; solicitar ao DataGEO apenas o que falta, registrando fonte/resolução/validade.
2. Servir tiles para o mapa, com cache, overviews e reprojeção conforme o frontend. O navegador não deve receber o mosaico inteiro. Uso local do acervo não transforma o computador em um servidor público de imagens.
3. Integrar Restor + Cambridge ao planejamento territorial, com máscaras e pontos vinculados pelo mesmo ID; fazer a deduplicação entre janelas e recortar os resultados pelos setores.

O JPG antigo serve como possível visão geral após validar sua georreferência, mas reamostrá-lo de aproximadamente 50 cm para 25 cm não recupera o detalhe descartado. O novo acervo deve vir de novas requisições à fonte nativa.

## Verificação desta entrega

Testes offline usam imagens sintéticas e respostas HTTP simuladas. Cobrem exclusão de quadrados sem setor/contexto, grade a 25 cm, máscara válida na área necessária, GeoTIFF, retomada sem rede, integridade, falha parcial e o comportamento padrão sem download. O capturador não foi executado para iniciar a aquisição; a execução real fica com o usuário.
