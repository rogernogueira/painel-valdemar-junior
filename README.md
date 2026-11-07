# Painel de Valdemar Júnior

Painel interativo dos votos para deputado estadual no Tocantins, comparando o 1º turno de 2022 e 2026 por município e local de votação. O nome encontrado no pacote do TSE é **Valdemar Júnior** (`VALDEMAR JUNIOR`).

## Acessar

- Site: https://rogernogueira.github.io/painel-valdemar-junior/
- Versão autocontida: `dados/paineis/valdemar-junior/painel-local.html`

O painel usa DuckDB-WASM e Leaflet; o navegador precisa de acesso à internet para carregar o motor DuckDB pelo jsDelivr.

## Dados

- 2022: Republicanos, número 10010 — 17.779 votos.
- 2026: MDB, número 15015 — 20.957 votos.
- Fontes: Boletins de Urna e cadastros de locais de votação do TSE; malha municipal do IBGE; coordenadas complementares do OpenStreetMap.
- Os locais são pareados por município e número do local. Mudanças de prédio e coordenadas aproximadas estão indicadas no painel.
- Comparações de votos absolutos não controlam por mudança do eleitorado, partido ou contexto eleitoral.

Proveniência, dicionário e checksums ficam em `dados/paineis/valdemar-junior/metadata/`.

## Desenvolvimento

Requisitos: Node.js e npm. O pacote de dados já está incluído.

```bash
cd painel
npm ci
npm run build
```

O build atualiza o artefato em `dados/paineis/valdemar-junior/` e a pasta `docs/` publicada pelo GitHub Pages.
