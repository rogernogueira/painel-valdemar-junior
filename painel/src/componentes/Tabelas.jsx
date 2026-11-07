// Painel lateral: municípios do candidato, locais do município e lista de
// votos de 2026 de um local.
import { fmt, nomeCargo, seta, situacaoDe } from "../formato.js";

function Variacao({ valor }) {
  return <span className={`pill ${situacaoDe(valor)}`}>{seta(valor)}</span>;
}

function Linha({ aoAtivar, destaque, children }) {
  const props = aoAtivar
    ? {
        className: `clicavel${destaque ? " destaque" : ""}`,
        tabIndex: 0,
        onClick: aoAtivar,
        onKeyDown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); aoAtivar(); } },
      }
    : { className: destaque ? "destaque" : undefined };
  return <tr {...props}>{children}</tr>;
}

// Destaque com a variação do candidato no município ou no local escolhido:
// "80 votos em 2022 → 15 em 2026 (▼ -65)", na cor do papel (subiu ou caiu).
function Destaque({ nome, onde, dados }) {
  if (!dados) {
    return (
      <div className="destaque igual">
        <p className="destaque-rotulo">{nome} {onde}</p>
        <p className="destaque-valor">Sem votos nos dois anos</p>
      </div>
    );
  }
  const s = situacaoDe(dados.variacao);
  return (
    <div className={`destaque ${s}`}>
      <p className="destaque-rotulo">{nome} {onde}</p>
      <p className="destaque-valor">
        <b>{fmt(dados.votos_2022)}</b> votos em 2022 → <b>{fmt(dados.votos_2026)}</b> em 2026{" "}
        <span className="destaque-variacao">({seta(dados.variacao)})</span>
      </p>
    </div>
  );
}

export function TabelaMunicipios({ candidato, linhas, aoEscolher }) {
  const ordenadas = [...linhas].sort((a, b) => b.variacao - a.variacao);
  return (
    <>
      <h3>{candidato ? candidato.nome : "—"}</h3>
      <p>Municípios do maior aumento à maior queda. Clique num município (aqui ou no mapa) para ver os locais.</p>
      <div className="rolagem">
        <table>
          <thead><tr><th>Município</th><th className="n">2022</th><th className="n">2026</th><th className="n">Var.</th></tr></thead>
          <tbody>
            {ordenadas.map((m) => (
              <Linha key={m.cod_ibge} aoAtivar={() => aoEscolher(m.cod_ibge)}>
                <td>{m.municipio}</td><td className="n">{fmt(m.votos_2022)}</td><td className="n">{fmt(m.votos_2026)}</td>
                <td className="n"><Variacao valor={m.variacao} /></td>
              </Linha>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TabelaLocais({ candidato, municipio, resumo, linhas, aoEscolher }) {
  const ordenadas = [...linhas].sort((a, b) => a.variacao - b.variacao);
  return (
    <>
      <h3>{municipio}</h3>
      <Destaque nome={candidato} onde="no município" dados={resumo} />
      <p>Clique num local (no mapa ou na tabela) para ver os candidatos de 2026.</p>
      <div className="rolagem">
        <table>
          <thead><tr><th>Local</th><th className="n">2022</th><th className="n">2026</th><th className="n">Var.</th></tr></thead>
          <tbody>
            {ordenadas.map((p) => (
              <Linha key={p.local_id} aoAtivar={() => aoEscolher(p.local_id)}>
                <td>{p.local}{p.lat == null && <small> (sem coordenada)</small>}</td>
                <td className="n">{fmt(p.votos_2022)}</td><td className="n">{fmt(p.votos_2026)}</td>
                <td className="n"><Variacao valor={p.variacao} /></td>
              </Linha>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ListaLocal({ candidato, local, desempenho, cargo, chaveSel, linhas, aoEscolherCandidato }) {
  const total = linhas.reduce((s, l) => s + l.votos, 0);
  return (
    <>
      <h3>{local ? local.local : "—"}</h3>
      {local?.endereco && <p>{local.endereco}</p>}
      <Destaque nome={candidato} onde="neste local" dados={desempenho} />
      <p>Votos para {nomeCargo(cargo)} em 2026 neste local: {fmt(total)}, incluindo legenda, brancos e nulos.{aoEscolherCandidato && " Clique num candidato para vê-lo no mapa."}</p>
      <div className="rolagem">
        <table>
          <thead><tr><th>Candidato</th><th>Nº</th><th>Partido</th><th className="n">Votos 2026</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <Linha key={l.chave} destaque={l.chave === chaveSel}
                aoAtivar={l.tipo === "Nominal" && aoEscolherCandidato ? () => aoEscolherCandidato(l.chave) : null}>
                <td>{l.nome}</td><td className="n-txt">{l.numero ?? ""}</td><td>{l.partido}</td><td className="n">{fmt(l.votos)}</td>
              </Linha>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
