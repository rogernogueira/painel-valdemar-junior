import { useEffect, useMemo, useRef, useState } from "react";
import { abrirBanco, carregarMetadados, consultar } from "./banco.js";
import { fmt, nomeCargo, nomeProprio, sinal } from "./formato.js";
import { Cabecalho, Rodape } from "./componentes/Moldura.jsx";
import Mapa, { Legenda } from "./componentes/Mapa.jsx";
import { ListaLocal, TabelaLocais, TabelaMunicipios } from "./componentes/Tabelas.jsx";
import MapaPercentual, { TabelaPercentual } from "./componentes/MapaPercentual.jsx";
import Sobre from "./componentes/Sobre.jsx";

// Painel exclusivo de um candidato: definido no build (npm run build:nilton).
// Sem os seletores de cargo e candidato, com o nome em destaque no título.
const FIXO = import.meta.env.VITE_CANDIDATO
  ? { chave: import.meta.env.VITE_CANDIDATO, cargo: import.meta.env.VITE_CARGO || "estadual" }
  : null;
const INICIAL = FIXO ?? { cargo: "estadual", chave: "NILTON FRANCO" };

// Consultas: só views (sql/views.sql), nunca as tabelas cruas
const SQL = {
  candidatos: "SELECT * FROM v_candidatos ORDER BY cargo, votos_2026 DESC, votos_2022 DESC",
  municipios: "SELECT cod_ibge, municipio, geometria FROM municipios ORDER BY cod_ibge",
  totais: "SELECT * FROM v_totais WHERE cargo = ? AND chave = ?",
  porMunicipio: "SELECT * FROM v_por_municipio WHERE cargo = ? AND chave = ?",
  porLocal: "SELECT * FROM v_por_local WHERE cargo = ? AND chave = ? AND cod_ibge = ?",
  local: "SELECT * FROM locais WHERE local_id = ?",
  lista: "SELECT * FROM v_lista_2026 WHERE cargo = ? AND local_id = ? ORDER BY ordem_tipo, votos DESC, nome",
};

const ABAS = [
  { id: "variacao", nome: "Variação 2022 × 2026" },
  { id: "percentual", nome: "Percentual dos votos" },
];

// Abas no padrão WAI-ARIA: setas trocam de aba, Home e End vão às pontas
function Abas({ ativa, aoTrocar }) {
  const botoes = useRef({});
  function teclado(ev) {
    const i = ABAS.findIndex((a) => a.id === ativa);
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ABAS.length - 1 }[ev.key];
    if (destino === undefined) return;
    ev.preventDefault();
    const aba = ABAS[(destino + ABAS.length) % ABAS.length];
    aoTrocar(aba.id);
    botoes.current[aba.id]?.focus();
  }
  return (
    <div className="abas" role="tablist" aria-label="Visões do mapa" onKeyDown={teclado}>
      {ABAS.map((a) => (
        <button key={a.id} ref={(el) => { botoes.current[a.id] = el; }} type="button" role="tab" id={`aba-${a.id}`}
          aria-selected={a.id === ativa} aria-controls={`painel-${a.id}`} tabIndex={a.id === ativa ? 0 : -1}
          onClick={() => aoTrocar(a.id)}>
          {a.nome}
        </button>
      ))}
    </div>
  );
}

function rotuloCandidato(c) {
  const ano = (a) => (c[`votos_${a}`] > 0 ? `${c[`partido_${a}`]} ${c[`numero_${a}`]}, ${fmt(c[`votos_${a}`])} votos` : "não concorreu");
  return `${c.nome} (2026: ${ano(2026)}; 2022: ${ano(2022)})`;
}

export default function App() {
  const [con, setCon] = useState(null);
  const [progresso, setProgresso] = useState("Preparando");
  const [erro, setErro] = useState(null);
  const [meta, setMeta] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [sel, setSel] = useState({ ...INICIAL, cidade: null, local: null });
  const [totais, setTotais] = useState(null);
  const [porMunicipio, setPorMunicipio] = useState([]);
  const [porLocal, setPorLocal] = useState([]);
  const [local, setLocal] = useState({ info: null, lista: [] });
  const [aba, setAba] = useState("variacao");
  const [anoPct, setAnoPct] = useState(2026);

  // abertura: motor, pacote, listas fixas
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [c, m] = await Promise.all([abrirBanco(setProgresso), carregarMetadados()]);
        const [cands, muns] = await Promise.all([consultar(c, SQL.candidatos), consultar(c, SQL.municipios)]);
        if (!vivo) return;
        setMeta(m);
        setCandidatos(cands);
        setMunicipios(muns.map((x) => ({ ...x, geometria: JSON.parse(x.geometria) })));
        setCon(c);
      } catch (e) {
        if (vivo) setErro(e.message || String(e));
      }
    })();
    return () => { vivo = false; };
  }, []);

  // candidato → totais e municípios
  useEffect(() => {
    if (!con) return;
    let vivo = true;
    Promise.all([consultar(con, SQL.totais, [sel.cargo, sel.chave]), consultar(con, SQL.porMunicipio, [sel.cargo, sel.chave])])
      .then(([t, m]) => { if (vivo) { setTotais(t[0] ?? null); setPorMunicipio(m); } });
    return () => { vivo = false; };
  }, [con, sel.cargo, sel.chave]);

  // município → locais do candidato
  useEffect(() => {
    if (!con || !sel.cidade) { setPorLocal([]); return undefined; }
    let vivo = true;
    consultar(con, SQL.porLocal, [sel.cargo, sel.chave, sel.cidade]).then((r) => { if (vivo) setPorLocal(r); });
    return () => { vivo = false; };
  }, [con, sel.cargo, sel.chave, sel.cidade]);

  // local → lista de 2026
  useEffect(() => {
    if (!con || !sel.local) { setLocal({ info: null, lista: [] }); return undefined; }
    let vivo = true;
    Promise.all([consultar(con, SQL.local, [sel.local]), consultar(con, SQL.lista, [sel.cargo, sel.local])])
      .then(([i, l]) => { if (vivo) setLocal({ info: i[0] ?? null, lista: l }); });
    return () => { vivo = false; };
  }, [con, sel.cargo, sel.local]);

  const doCargo = useMemo(() => candidatos.filter((c) => c.cargo === sel.cargo), [candidatos, sel.cargo]);
  const candidato = doCargo.find((c) => c.chave === sel.chave) ?? null;
  const nomeCidade = sel.cidade ? municipios.find((m) => m.cod_ibge === sel.cidade)?.municipio ?? "" : "";
  const pontos = porLocal.filter((p) => p.lat != null && p.lon != null);
  const resumoCidade = porMunicipio.find((m) => m.cod_ibge === sel.cidade) ?? null;
  const desempenhoLocal = porLocal.find((p) => p.local_id === sel.local) ?? null;

  const mudar = (parcial) => setSel((s) => ({ ...s, ...parcial }));
  const nomeExibido = nomeProprio(candidato?.nome ?? INICIAL.chave);
  useEffect(() => {
    if (FIXO) document.title = `${nomeExibido}, 2022 e 2026`;
  }, [nomeExibido]);
  const trocarCargo = (cargo) => {
    const primeiro = candidatos.find((c) => c.cargo === cargo);
    mudar({ cargo, chave: primeiro ? primeiro.chave : "", cidade: null, local: null });
  };

  if (erro) {
    return (
      <div className="pagina"><div className="estado erro" role="alert">
        <h2>O painel não abriu</h2>
        <p>{erro}</p>
        <p>O motor de consulta (DuckDB) vem da internet (jsDelivr): confira a conexão e recarregue.</p>
      </div></div>
    );
  }

  return (
    <div className="pagina">
      <Cabecalho indicadores={FIXO
        ? [`${nomeCargo(FIXO.cargo).replace(/^./, (c) => c.toUpperCase())} no Tocantins`, "Boletins de Urna do 1º turno"]
        : ["Deputados no Tocantins", "Boletins de Urna do 1º turno"]} />
      <main className="corpo gutter">
        <section>
          {FIXO ? (
            <>
              <h1 className="nome-candidato">{nomeExibido}</h1>
              <p className="titulo-segunda">Onde ganhou e perdeu votos para {nomeCargo(FIXO.cargo)}, 2022 e 2026</p>
            </>
          ) : (
            <>
              <h1>Onde cada candidato ganhou e perdeu votos</h1>
              <p className="titulo-segunda">Deputados no Tocantins, 2022 e 2026</p>
            </>
          )}
          <p className="apoio">
            {candidato
              ? `${FIXO ? "Candidatura" : candidato.nome}: ${candidato.votos_2022 > 0 ? `${candidato.partido_2022} ${candidato.numero_2022} em 2022` : "não concorreu em 2022"}, ${candidato.votos_2026 > 0 ? `${candidato.partido_2026} ${candidato.numero_2026} em 2026` : "não concorreu em 2026"}. `
              : ""}
            Votos no 1º turno, pelos Boletins de Urna do TSE, comparados município a município e local a local.
          </p>
        </section>

        {!con ? (
          <div className="estado" role="status">{progresso}…</div>
        ) : (
          <>
            {!FIXO && <div className="filtros">
              <label htmlFor="f-cargo">Cargo
                <select id="f-cargo" value={sel.cargo} onChange={(e) => trocarCargo(e.target.value)}>
                  <option value="estadual">Deputado estadual</option>
                  <option value="federal">Deputado federal</option>
                </select>
              </label>
              <label htmlFor="f-cand" className="largo">Candidato (ordenado pelos votos de 2026)
                <select id="f-cand" value={sel.chave} onChange={(e) => mudar({ chave: e.target.value, local: null })}>
                  {doCargo.map((c) => <option key={c.chave} value={c.chave}>{rotuloCandidato(c)}</option>)}
                </select>
              </label>
            </div>}

            <div className="kpis">
              <div className="kpi"><span>Votos em 2022</span><b>{fmt(totais?.votos_2022)}</b></div>
              <div className="kpi"><span>Votos em 2026</span><b>{fmt(totais?.votos_2026)}</b></div>
              <div className="kpi"><span>Variação</span><b>{sinal(totais?.variacao)}</b></div>
              <div className="kpi sobe"><span>Municípios com aumento</span><b>{fmt(totais?.municipios_subiu)}</b></div>
              <div className="kpi cai"><span>Municípios com queda</span><b>{fmt(totais?.municipios_caiu)}</b></div>
            </div>

            <Abas ativa={aba} aoTrocar={setAba} />

            {aba === "variacao" && (
            <div role="tabpanel" id="painel-variacao" aria-labelledby="aba-variacao" className="painel-aba">
            <nav className="trilha" aria-label="Navegação do mapa">
              {sel.cidade ? <button type="button" onClick={() => mudar({ cidade: null, local: null })}>Tocantins</button> : <strong>Tocantins</strong>}
              {sel.cidade && <span aria-hidden="true">›</span>}
              {sel.cidade && (sel.local
                ? <button type="button" onClick={() => mudar({ local: null })}>{nomeCidade}</button>
                : <strong>{nomeCidade}</strong>)}
              {sel.local && <span aria-hidden="true">›</span>}
              {sel.local && <strong>{local.info?.local ?? ""}</strong>}
            </nav>

            <div className="grade">
              <div className="cartao">
                <Mapa municipios={municipios} porMunicipio={porMunicipio} cidade={sel.cidade} pontos={pontos}
                  localSel={sel.local}
                  aoEscolherCidade={(cidade) => mudar({ cidade, local: null })}
                  aoEscolherLocal={(l) => mudar({ local: l })} />
                <Legenda cidade={sel.cidade} />
              </div>
              <div className="cartao painel">
                {!sel.cidade && <TabelaMunicipios candidato={candidato} linhas={porMunicipio} aoEscolher={(cidade) => mudar({ cidade, local: null })} />}
                {sel.cidade && !sel.local && <TabelaLocais candidato={candidato?.nome ?? ""} municipio={nomeCidade} resumo={resumoCidade} linhas={porLocal} aoEscolher={(l) => mudar({ local: l })} />}
                {sel.local && <ListaLocal candidato={candidato?.nome ?? ""} local={local.info} desempenho={desempenhoLocal} cargo={sel.cargo} chaveSel={sel.chave}
                  linhas={local.lista} aoEscolherCandidato={FIXO ? null : (chave) => mudar({ chave })} />}
              </div>
            </div>
            </div>
            )}

            {aba === "percentual" && (
            <div role="tabpanel" id="painel-percentual" aria-labelledby="aba-percentual" className="painel-aba">
              <fieldset className="anos">
                <legend>Ano</legend>
                {[2022, 2026].map((a) => (
                  <label key={a}>
                    <input type="radio" name="ano-pct" value={a} checked={anoPct === a} onChange={() => setAnoPct(a)} />
                    {a}
                  </label>
                ))}
              </fieldset>
              <div className="grade">
                <div className="cartao">
                  <MapaPercentual municipios={municipios} porMunicipio={porMunicipio} ano={anoPct} candidato={candidato?.nome ?? ""} />
                </div>
                <div className="cartao painel">
                  <TabelaPercentual candidato={candidato?.nome ?? ""} ano={anoPct} linhas={porMunicipio} />
                </div>
              </div>
            </div>
            )}

            <Sobre meta={meta} />
          </>
        )}
      </main>
      <Rodape dataset={meta?.dataset} />
    </div>
  );
}
