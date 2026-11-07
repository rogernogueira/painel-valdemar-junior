// "Sobre os dados": descrição do pacote, tabelas, proveniência, dicionário e
// checksums, lidos de metadata/.
import { fmt } from "../formato.js";

export default function Sobre({ meta }) {
  if (!meta) return null;
  const { dataset, codebook, provenance, checksums } = meta;
  const porTabela = codebook.reduce((acc, c) => ((acc[c.table] ??= []).push(c), acc), {});
  return (
    <section className="sobre" aria-labelledby="sobre-titulo">
      <h2 id="sobre-titulo">Sobre os dados e o método</h2>
      <p className="apoio">{dataset.subtitle}. Unidade de observação: {dataset.unit_of_observation}.</p>

      <details>
        <summary>Pacote e tabelas</summary>
        {/* blocos sem borda: o acordeon já é a única camada de contenção */}
        <div className="grade-sobre">
        <div className="bloco">
          <h3>Pacote</h3>
          <dl>
            <dt>Identificador</dt><dd><code>{dataset.dataset_id}</code></dd>
            <dt>Gerado em</dt><dd>{dataset.exported_at.replace("T", " ").replace("Z", " UTC")}</dd>
            <dt>Cobertura</dt><dd>{dataset.spatial_coverage}, {dataset.anos.join(" e ")}, {dataset.turno}º turno</dd>
            <dt>Municípios</dt><dd>{fmt(dataset.municipios)}</dd>
            <dt>Locais de votação</dt><dd>{fmt(dataset.locais)} ({fmt(dataset.locais_sem_coordenada)} sem coordenada)</dd>
            <dt>Candidato</dt><dd>{dataset.candidate.name} · {dataset.candidate.cargo}</dd>
            <dt>2022</dt><dd>{dataset.candidate.partido_2022} {dataset.candidate.numero_2022} · {fmt(dataset.candidate.votos_2022)} votos</dd>
            <dt>2026</dt><dd>{dataset.candidate.partido_2026} {dataset.candidate.numero_2026} · {fmt(dataset.candidate.votos_2026)} votos</dd>
            <dt>Licença</dt><dd>{dataset.license}</dd>
          </dl>
        </div>
        <div className="bloco">
          <h3>Tabelas (data/*.parquet)</h3>
          <table>
            <thead><tr><th>Tabela</th><th className="n">Linhas</th><th className="n">Colunas</th><th className="n">KB</th></tr></thead>
            <tbody>
              {dataset.tables.map((t) => (
                <tr key={t.name}><td><code>{t.name}</code></td><td className="n">{fmt(t.rows)}</td><td className="n">{t.columns}</td><td className="n">{fmt(Math.round(t.bytes / 1024))}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="nota-tabela">As telas consultam só as views de <code>sql/views.sql</code>; quem baixa o pacote e roda o mesmo SQL no DuckDB obtém os mesmos números.</p>
        </div>
        </div>
      </details>

      <details>
        <summary>Proveniência e processamento</summary>
        <ul>{provenance.sources.map((s) => <li key={s.name}><b>{s.name}</b>, {s.publisher}: <code>{s.file}</code></li>)}</ul>
        <ol>{provenance.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      </details>

      <details>
        <summary>Dicionário de dados</summary>
        {Object.entries(porTabela).map(([tabela, colunas]) => (
          <div key={tabela} className="rolagem-x">
            <h4><code>{tabela}</code></h4>
            <table>
              <tbody>{colunas.map((c) => <tr key={c.column}><td><code>{c.column}</code></td><td>{c.description}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
      </details>

      <details>
        <summary>Checksums (SHA-256)</summary>
        <pre className="rolagem-x">{checksums}</pre>
      </details>
    </section>
  );
}
