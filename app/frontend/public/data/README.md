# Malha territorial local

`setores-urbanos-aracatuba-ibge-2022.geojson` é uma cópia sem alteração do arquivo preparado em `prototipo-01/data/territorial/`, conferida por SHA-256. Contém 499 setores urbanos de Araçatuba/SP (3502804), em EPSG:4326, identificados como malha definitiva do Censo 2022 nos metadados.

A origem, URL do ZIP, data de aquisição e hash da fonte original permanecem no objeto `arboriza`. O hash do ZIP de origem e o hash deste GeoJSON são arquivos diferentes e não devem ser comparados entre si.

SHA-256 deste GeoJSON: `75319a11635e81d3133618e4727325315c3768ab8b49136d6ab341cb3558bb6b`.

Não houve novo download nesta etapa. O frontend carrega esta cópia estática sob demanda, valida município/CRS/situação, IDs, coordenadas e anéis, e mostra a atribuição ao IBGE. O conjunto não equivale ao perímetro urbano legal atual nem inclui todos os setores rurais.

A área exibida para a seleção é a soma de `AREA_KM2` declarada na fonte; não é uma união recalculada dos polígonos ou cobertura de copas. A lista de códigos oferece uma alternativa ao clique no mapa.
