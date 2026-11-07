// Aba "Percentual dos votos": cada município pintado num degradê de verde (a
// mesma família do mapa de variação) pela
// fatia dos votos válidos (nominais + legenda) que o candidato teve ali, no ano
// escolhido. A escala vai de 0% ao topo "redondo" acima do maior percentual, em
// raiz quadrada: a maioria dos municípios tem percentuais baixos, que numa
// escala linear ficariam quase brancos. Municípios sem voto levam hachura.
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { escalaSequencial, topoEscala } from "../cores.js";
import { fmt, pct } from "../formato.js";

const FUNDO = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  atribuicao: "Fundo &copy; Esri, HERE, Garmin, &copy; OpenStreetMap; malha IBGE",
  zoomNativo: 16,
};
const VISTA_INICIAL = { centro: [-10.2, -48.3], zoom: 6 };
const MARGEM_ZOOM = [24, 24];
const PARADAS_LEGENDA = 5;
const HACHURA = "hachura-sem-voto";
// posição na escala (0 a 1) de um percentual, e o percentual de uma posição
const posicao = (valor, topo) => Math.sqrt(Math.max(0, valor) / topo);
const valorEm = (t, topo) => topo * t * t;

// padrão SVG de listras para os municípios sem voto, no SVG do Leaflet
function garantirHachura(svg) {
  if (!svg || svg.querySelector(`#${HACHURA}`)) return;
  const css = getComputedStyle(document.documentElement);
  const ns = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(ns, "defs");
  const padrao = document.createElementNS(ns, "pattern");
  Object.entries({ id: HACHURA, width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" })
    .forEach(([k, v]) => padrao.setAttribute(k, v));
  const fundo = document.createElementNS(ns, "rect");
  Object.entries({ width: 8, height: 8, fill: css.getPropertyValue("--neutral").trim() }).forEach(([k, v]) => fundo.setAttribute(k, v));
  const listra = document.createElementNS(ns, "rect");
  Object.entries({ width: 2.5, height: 8, fill: css.getPropertyValue("--gray").trim() }).forEach(([k, v]) => listra.setAttribute(k, v));
  padrao.append(fundo, listra);
  defs.append(padrao);
  svg.prepend(defs);
}

function dica(linhas) {
  const el = document.createElement("div");
  el.className = "dica-mapa";
  linhas.filter(Boolean).forEach((l, i) => {
    const p = document.createElement(i === 0 ? "b" : "div");
    p.textContent = l;
    el.appendChild(p);
  });
  return el;
}

export default function MapaPercentual({ municipios, porMunicipio, ano, candidato }) {
  const caixa = useRef(null);
  const mapa = useRef(null);
  const camada = useRef(null);
  const escala = useRef(null);

  const colecao = useMemo(() => ({
    type: "FeatureCollection",
    features: municipios.map((m) => ({ type: "Feature", properties: { cod_ibge: m.cod_ibge, municipio: m.municipio }, geometry: m.geometria })),
  }), [municipios]);
  const porCod = useMemo(() => new Map(porMunicipio.map((m) => [m.cod_ibge, m])), [porMunicipio]);
  const topo = topoEscala(Math.max(0, ...porMunicipio.map((m) => m[`pct_${ano}`] ?? 0)));

  useEffect(() => {
    escala.current = escalaSequencial("--escala-0", "--escala-meio", "--escala-1");
    const m = L.map(caixa.current, { zoomSnap: 0.25 }).setView(VISTA_INICIAL.centro, VISTA_INICIAL.zoom);
    L.tileLayer(FUNDO.url, { attribution: FUNDO.atribuicao, maxNativeZoom: FUNDO.zoomNativo, maxZoom: 18 }).addTo(m);
    m.attributionControl.setPrefix(false);
    mapa.current = m;
    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(caixa.current);
    return () => { obs.disconnect(); m.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !colecao.features.length) return;
    const contorno = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
    camada.current?.remove();
    camada.current = L.geoJSON(colecao, {
      style: (f) => {
        const d = porCod.get(f.properties.cod_ibge);
        const semVoto = !((d?.[`votos_${ano}`] ?? 0) > 0);
        return {
          fillColor: semVoto ? `url(#${HACHURA})` : escala.current(posicao(d[`pct_${ano}`] ?? 0, topo)),
          fillOpacity: semVoto ? 1 : 0.92,
          color: contorno,
          weight: 0.8,
        };
      },
      onEachFeature: (f, l) => {
        const d = porCod.get(f.properties.cod_ibge);
        const votos = d?.[`votos_${ano}`] ?? 0;
        l.bindTooltip(dica(votos > 0 ? [
          f.properties.municipio,
          `${pct(d[`pct_${ano}`])} dos votos válidos em ${ano}`,
          `${fmt(votos)} votos`,
        ] : [f.properties.municipio, `Sem votos em ${ano}`]), { sticky: true, direction: "top", offset: [0, -8] });
        l.on("mouseover", () => l.setStyle({ weight: 2.5, color: getComputedStyle(document.documentElement).getPropertyValue("--text").trim() }));
        l.on("mouseout", () => camada.current.resetStyle(l));
      },
    }).addTo(m);
    garantirHachura(caixa.current.querySelector(".leaflet-overlay-pane svg"));
    m.fitBounds(camada.current.getBounds(), { padding: MARGEM_ZOOM });
  }, [colecao, porCod, ano, topo]);

  // marcas da legenda em posições iguais da barra (valores em raiz quadrada)
  const paradas = Array.from({ length: PARADAS_LEGENDA }, (_, i) => valorEm(i / (PARADAS_LEGENDA - 1), topo));
  const semVoto = municipios.length - porMunicipio.filter((m) => (m[`votos_${ano}`] ?? 0) > 0).length;
  return (
    <>
      <div className="mapa" ref={caixa} role="region"
        aria-label={`Mapa do percentual de votos de ${candidato} por município em ${ano}`} />
      <div className="legenda-pct">
        <div className="escala" aria-hidden="true">
          <div className="escala-barra" />
          <div className="escala-rotulos">
            {paradas.map((v) => <span key={v}>{pct(Math.round(v * 10) / 10)}</span>)}
          </div>
        </div>
        <span className="sem-voto"><i aria-hidden="true" />Sem votos ({fmt(semVoto)} municípios)</span>
      </div>
      <p className="legenda-texto">
        Fatia dos votos válidos (nominais e de legenda) do cargo em cada município. Quanto mais escuro,
        maior o percentual; a escala é em raiz quadrada, para os percentuais baixos também ganharem cor.
        A lista ao lado traz os mesmos números.
      </p>
    </>
  );
}

export function TabelaPercentual({ candidato, ano, linhas }) {
  const ordenadas = linhas
    .filter((m) => (m[`votos_${ano}`] ?? 0) > 0)
    .sort((a, b) => (b[`pct_${ano}`] ?? 0) - (a[`pct_${ano}`] ?? 0));
  return (
    <>
      <h3>{candidato}</h3>
      <p>Municípios do maior ao menor percentual dos votos válidos em {ano}.</p>
      {ordenadas.length === 0 && <p>O candidato não teve votos em {ano}.</p>}
      <div className="rolagem">
        <table>
          <thead><tr><th>Município</th><th className="n">Votos</th><th className="n">% válidos</th></tr></thead>
          <tbody>
            {ordenadas.map((m) => (
              <tr key={m.cod_ibge}>
                <td>{m.municipio}</td>
                <td className="n">{fmt(m[`votos_${ano}`])}</td>
                <td className="n">{pct(m[`pct_${ano}`])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
