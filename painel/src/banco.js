// Abre o DuckDB-WASM no navegador, registra os Parquet do pacote e roda a
// camada de views (sql/views.sql). Os dados vêm embutidos (painel-local.html,
// em window.__PAINEL__) ou, na versão servida, de data/*.parquet.txt.
import * as duckdb from "@duckdb/duckdb-wasm";

export const TABELAS = ["municipios", "locais", "candidatos", "votos"];
const METADADOS = ["dataset", "codebook", "provenance"];

const embutido = () => window.__PAINEL__ ?? null;

async function texto(caminho) {
  const resposta = await fetch(caminho);
  if (!resposta.ok) throw new Error(`não foi possível ler ${caminho} (${resposta.status})`);
  return resposta.text();
}

function base64ParaBytes(b64) {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function carregarMetadados() {
  const p = embutido();
  const meta = {};
  for (const nome of METADADOS) {
    meta[nome] = p?.metadata?.[nome] ?? JSON.parse(await texto(`metadata/${nome}.json`));
  }
  meta.checksums = p?.checksums ?? (await texto("metadata/checksums.sha256"));
  return meta;
}

export async function abrirBanco(aoProgredir = () => {}) {
  aoProgredir("Carregando o motor de consulta (DuckDB)");
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  // o worker vem da CDN; um Blob local evita o bloqueio de origem cruzada
  const urlWorker = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }),
  );
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(urlWorker));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(urlWorker);

  aoProgredir("Lendo as tabelas do pacote");
  const p = embutido();
  for (const tabela of TABELAS) {
    const b64 = p?.parquet?.[tabela] ?? (await texto(`data/${tabela}.parquet.txt`));
    await db.registerFileBuffer(`${tabela}.parquet`, base64ParaBytes(b64));
  }
  const con = await db.connect();
  for (const tabela of TABELAS) {
    await con.query(`CREATE OR REPLACE VIEW ${tabela} AS SELECT * FROM read_parquet('${tabela}.parquet')`);
  }

  aoProgredir("Montando as views");
  await con.query(p?.sql ?? (await texto("sql/views.sql")));
  return con;
}

// Linhas como objetos simples: inteiros grandes do DuckDB viram Number
function simples(linha) {
  const o = {};
  for (const [k, v] of Object.entries(linha)) o[k] = typeof v === "bigint" ? Number(v) : v;
  return o;
}

export async function consultar(con, sql, parametros = []) {
  const consulta = await con.prepare(sql);
  try {
    const resultado = await consulta.query(...parametros);
    return resultado.toArray().map((linha) => simples(linha.toJSON()));
  } finally {
    await consulta.close();
  }
}
