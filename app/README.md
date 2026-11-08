# Arboriza — aplicação final

Esta pasta reúne o produto final. O laboratório HTML/Python permanece em `../prototipo-01/`.

## Organização

- `frontend/`: React, TypeScript estrito, Vite e React Router.
- `backend/`: espaço reservado para a API Python/FastAPI, ainda sem implementação.
- Scripts de apoio serão adicionados quando houver uma tarefa concreta a automatizar.

## Executar o frontend

Pré-requisito: Node.js 22.22 ou superior. A configuração foi verificada com Node.js 24.18.1 e npm 11.16.0.

```powershell
cd app/frontend
npm ci
npm run dev
```

Abra <http://127.0.0.1:5173/>. O servidor usa uma porta fixa e informa erro se já estiver ocupada. Ctrl+C encerra a execução.

A rota `/` apresenta a área Início validada. `/mapa` contém mapa navegável, painel lateral recolhível e resultados demonstrativos; veja [Mapa público](../docs/MAPA_PUBLICO.md). `/admin` apresenta o portal demonstrativo e `/login` a interface de acesso da equipe, ainda sem autenticação. `/laboratorio` preserva a comparação visual, documentada no [laboratório visual](../docs/LABORATORIO_VISUAL.md). Não há autenticação nem integração com a API do Arboriza.

Para conferir qualidade e gerar o build:

```powershell
npm run typecheck
npm run lint
npm run build
```

`npm run preview` serve o build localmente em <http://127.0.0.1:4173/>. Consulte o [README do frontend](frontend/README.md) para detalhes.

## Próxima validação

A estrutura, a identidade e a área Início foram validadas. O mapa público incorpora as escolhas de navegação e painel aprovadas e está em avaliação antes de avançar à Administração e integração.

- [Plano por etapas](../docs/PLANO_IMPLEMENTACAO_APP.md).
- [Escopo funcional](../docs/ESCOPO_WEBSITE_PRIMEIRA_ENTREGA.md).

UrbVerde segue como referência principal de produto, acompanhado das referências de sustentabilidade já discutidas. A área Início e o cabeçalho usam o tema compartilhado aprovado; o laboratório preserva as três variantes para comparação.
