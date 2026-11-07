// Monta o painel no mesmo formato do HarvestBoard, depois do `vite build`:
//   dados/paineis/{uf}/assets/app.js, assets/app.css   (versão servida)
//   dados/paineis/{uf}/index.html                       (lê data/, sql/, metadata/)
//   dados/paineis/{uf}/painel-local.html                (arquivo único: tudo embutido em window.__PAINEL__)
// O pacote de dados (data/, sql/, metadata/) é gerado antes por
// `uv run dados_painel_deputados.py --uf {uf}`.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const uf = process.env.UF || "to";
const pacote = join(raiz, "..", "dados", "paineis", uf);
const dist = join(raiz, "dist");
const TABELAS = ["municipios", "locais", "candidatos", "votos"];
const METADADOS = ["dataset", "codebook", "provenance"];

if (!existsSync(join(pacote, "metadata", "dataset.json"))) {
  console.error(`Pacote de dados não encontrado em ${pacote}. Rode antes: uv run dados_painel_deputados.py --uf ${uf}`);
  process.exit(1);
}

const ler = (...p) => readFileSync(join(...p), "utf8");
const dataset = JSON.parse(ler(pacote, "metadata", "dataset.json"));
const titulo = process.env.TITULO || dataset.title;
// SAIDA: pasta de uma variante (ex.: o painel exclusivo de um candidato),
// com cópia do pacote de dados; sem ela, o painel vai para o próprio pacote
const saida = process.env.SAIDA ? join(raiz, process.env.SAIDA) : pacote;
if (saida !== pacote) {
  for (const sub of ["data", "sql", "metadata"]) cpSync(join(pacote, sub), join(saida, sub), { recursive: true });
}

// versão servida
mkdirSync(join(saida, "assets"), { recursive: true });
copyFileSync(join(dist, "assets", "app.js"), join(saida, "assets", "app.js"));
copyFileSync(join(dist, "assets", "app.css"), join(saida, "assets", "app.css"));
const cabeca = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>`;
writeFileSync(join(saida, "index.html"), `<!doctype html>
<html lang="pt-BR">
<head>
${cabeca}
<link rel="stylesheet" href="assets/app.css">
</head>
<body>
<div id="root"></div>
<script type="module" src="assets/app.js"></script>
</body>
</html>
`);

// arquivo único
const embutido = {
  parquet: Object.fromEntries(TABELAS.map((t) => [t, ler(pacote, "data", `${t}.parquet.txt`)])),
  metadata: Object.fromEntries(METADADOS.map((m) => [m, JSON.parse(ler(pacote, "metadata", `${m}.json`))])),
  checksums: ler(pacote, "metadata", "checksums.sha256"),
  sql: ler(pacote, "sql", "views.sql"),
};
// "</" dentro de um <script> fecharia o bloco
const json = JSON.stringify(embutido).replace(/<\//g, "<\\/");
const js = ler(dist, "assets", "app.js").replace(/<\/script/gi, "<\\/script");
const css = ler(dist, "assets", "app.css");
const local = `<!doctype html>
<html lang="pt-BR">
<head>
${cabeca}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>window.__PAINEL__=${json};</script>
<script type="module">${js}</script>
</body>
</html>
`;
writeFileSync(join(saida, "painel-local.html"), local);
console.log(`painel montado em ${saida}`);
console.log(`  painel-local.html: ${(Buffer.byteLength(local) / 2 ** 20).toFixed(1)} MB`);
console.log(`  index.html + assets/ (servir a pasta por HTTP)`);
