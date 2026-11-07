// Mapa em Leaflet com dois fundos da Esri (sem chave de API): cinza-claro no
// estado e satélite (com nomes de lugares por cima) ao abrir um município; o
// controle no canto troca entre os dois a qualquer momento.
// Estado: municípios coloridos pela variação do candidato. Município: o
// contorno em destaque e os locais de votação como círculos proporcionais à
// variação. O mapa é criado uma vez; as camadas são trocadas conforme a seleção.
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fmt, pct, seta, sinal, situacaoDe } from "../formato.js";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const FUNDOS = {
  mapa: {
    nome: "Mapa",
    url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    atribuicao: "Fundo &copy; Esri, HERE, Garmin, &copy; OpenStreetMap; malha IBGE",
    zoomNativo: 16,
  },
  satelite: {
    nome: "Satélite",
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    atribuicao: "Imagem &copy; Esri, Maxar, Earthstar Geographics; malha IBGE",
    // a imagem da Esri no Tocantins vai até o nível 17 (acima vem o ladrilho
    // "Map data not yet available"); o Leaflet amplia o 17 nos níveis acima
    zoomNativo: 17,
    // nomes de cidades, estradas e rios sobre a imagem
    rotulos: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
  },
};
const ZOOM_MAXIMO = 18;
const ZOOM_SEDE = 15;          // limite do zoom inicial na sede (cidade com um único local)
const RAIO_SEDE_M = 5000;      // locais considerados da área urbana
const RAIO = { min: 5, max: 18 };
const MARGEM_ZOOM = [24, 24];
const VISTA_INICIAL = { centro: [-10.2, -48.3], zoom: 6 };   // TO; ajustada ao contorno logo depois

// cores do Design System, lidas dos tokens do CSS
function tokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  return {
    subiu: v("--sobe"), subiuLocal: v("--sobe-local"), caiu: v("--cai"), semVoto: v("--sem-voto"),
    texto: v("--text"), superficie: v("--surface"), cinza: v("--gray"), azulDeep: v("--brand-blue-deep"),
  };
}

// conteúdo da dica como DOM (texto dos dados nunca vira HTML)
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

export default function Mapa({ municipios, porMunicipio, cidade, pontos, localSel, aoEscolherCidade, aoEscolherLocal }) {
  const caixa = useRef(null);
  const mapa = useRef(null);
  const camadas = useRef({ municipios: null, locais: null });
  const fundos = useRef(null);
  const cores = useRef(null);
  // callbacks atuais, sem recriar as camadas a cada render
  const acoes = useRef({ aoEscolherCidade, aoEscolherLocal });
  acoes.current = { aoEscolherCidade, aoEscolherLocal };

  const colecao = useMemo(() => ({
    type: "FeatureCollection",
    features: municipios.map((m) => ({ type: "Feature", properties: { cod_ibge: m.cod_ibge, municipio: m.municipio }, geometry: m.geometria })),
  }), [municipios]);
  const porCod = useMemo(() => new Map(porMunicipio.map((m) => [m.cod_ibge, m])), [porMunicipio]);

  // cria o mapa uma vez
  useEffect(() => {
    cores.current = tokens();
    const m = L.map(caixa.current, { zoomSnap: 0.25, preferCanvas: false, attributionControl: true })
      .setView(VISTA_INICIAL.centro, VISTA_INICIAL.zoom);
    const camadaFundo = (f) => L.tileLayer(f.url, { attribution: f.atribuicao, maxNativeZoom: f.zoomNativo, maxZoom: ZOOM_MAXIMO });
    fundos.current = {
      mapa: camadaFundo(FUNDOS.mapa),
      satelite: L.layerGroup([
        camadaFundo(FUNDOS.satelite),
        L.tileLayer(FUNDOS.satelite.rotulos, { maxNativeZoom: FUNDOS.satelite.zoomNativo, maxZoom: ZOOM_MAXIMO }),
      ]),
    };
    fundos.current.mapa.addTo(m);
    L.control.layers({ [FUNDOS.mapa.nome]: fundos.current.mapa, [FUNDOS.satelite.nome]: fundos.current.satelite },
      null, { position: "topright", collapsed: false }).addTo(m);
    m.setMaxZoom(ZOOM_MAXIMO);
    m.attributionControl.setPrefix(false);
    mapa.current = m;
    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(caixa.current);
    return () => { obs.disconnect(); m.remove(); mapa.current = null; };
  }, []);

  // municípios: cor pela situação do candidato; o selecionado em destaque
  useEffect(() => {
    const m = mapa.current;
    if (!m || !colecao.features.length) return;
    const c = cores.current;
    camadas.current.municipios?.remove();
    const camada = L.geoJSON(colecao, {
      style: (f) => {
        const d = porCod.get(f.properties.cod_ibge);
        const cor = !d ? c.semVoto : d.situacao === "subiu" ? c.subiu : d.situacao === "caiu" ? c.caiu : c.semVoto;
        const selecionado = f.properties.cod_ibge === cidade;
        return {
          fillColor: cor,
          // no município o fundo é satélite: a cidade sem véu, contorno claro e grosso
          fillOpacity: cidade ? (selecionado ? 0 : 0.12) : 0.72,
          color: c.superficie,
          weight: selecionado ? 3.5 : 0.8,
          dashArray: selecionado ? "8 5" : null,
        };
      },
      onEachFeature: (f, camadaMun) => {
        const d = porCod.get(f.properties.cod_ibge);
        camadaMun.bindTooltip(dica(d ? [
          f.properties.municipio,
          `2022: ${fmt(d.votos_2022)} votos (${pct(d.pct_2022)} dos válidos)`,
          `2026: ${fmt(d.votos_2026)} votos (${pct(d.pct_2026)} dos válidos)`,
          `Variação: ${seta(d.variacao)}${d.variacao_pct != null ? ` (${sinal(d.variacao_pct)}%)` : ""}`,
        ] : [f.properties.municipio, "Sem votos do candidato nos dois anos"]), { sticky: true, direction: "top", offset: [0, -8] });
        camadaMun.on("click", () => acoes.current.aoEscolherCidade(f.properties.cod_ibge));
        camadaMun.on("mouseover", () => { if (f.properties.cod_ibge !== cidade) camadaMun.setStyle({ weight: 2, color: c.texto }); });
        camadaMun.on("mouseout", () => camada.resetStyle(camadaMun));
      },
    }).addTo(m);
    camadas.current.municipios = camada;
    camadas.current.locais?.bringToFront();
  }, [colecao, porCod, cidade]);

  // fundo: satélite ao abrir um município, mapa cinza no estado
  useEffect(() => {
    const m = mapa.current;
    const f = fundos.current;
    if (!m || !f) return;
    const [sai, entra] = cidade ? [f.mapa, f.satelite] : [f.satelite, f.mapa];
    if (m.hasLayer(sai)) m.removeLayer(sai);
    if (!m.hasLayer(entra)) entra.addTo(m);
  }, [cidade]);

  // enquadramento: o estado inteiro ou, num município, a sede. A sede é a
  // mediana dos locais de votação (quase todos ficam na área urbana); o zoom
  // pega os locais a até RAIO_SEDE_M dela, deixando de fora os rurais distantes.
  // Enquanto os locais da cidade não chegam, mostra o município inteiro.
  // Com um local escolhido (no mapa ou na tabela), zoom máximo nele.
  useEffect(() => {
    const m = mapa.current;
    const camada = camadas.current.municipios;
    if (!m || !camada) return;
    const voo = { padding: MARGEM_ZOOM, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.6 };
    const daCidade = cidade ? pontos.filter((p) => p.cod_ibge === cidade) : [];
    const escolhido = localSel ? daCidade.find((p) => p.local_id === localSel) : null;
    if (escolhido) {
      m.flyTo([escolhido.lat, escolhido.lon], ZOOM_MAXIMO, { duration: voo.duration });
      return;
    }
    if (daCidade.length) {
      const mediana = (v) => { const o = [...v].sort((x, y) => x - y); return o[Math.floor(o.length / 2)]; };
      const sede = L.latLng(mediana(daCidade.map((p) => p.lat)), mediana(daCidade.map((p) => p.lon)));
      const perto = daCidade.filter((p) => m.distance(sede, [p.lat, p.lon]) <= RAIO_SEDE_M);
      const limites = L.latLngBounds((perto.length ? perto : daCidade).map((p) => [p.lat, p.lon])).pad(0.15);
      m.flyToBounds(limites, { ...voo, maxZoom: ZOOM_SEDE });
      return;
    }
    let limites = camada.getBounds();
    if (cidade) camada.eachLayer((l) => { if (l.feature.properties.cod_ibge === cidade) limites = l.getBounds(); });
    m.flyToBounds(limites, voo);
  }, [cidade, colecao, pontos, localSel]);

  // locais de votação do município
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const c = cores.current;
    camadas.current.locais?.remove();
    camadas.current.locais = null;
    if (!cidade || !pontos.length) return;
    const maxVar = Math.max(1, ...pontos.map((p) => Math.abs(p.variacao)));
    const raio = (v) => RAIO.min + (RAIO.max - RAIO.min) * Math.sqrt(Math.abs(v) / maxVar);
    const grupo = L.featureGroup();
    // os maiores embaixo, para os pequenos continuarem clicáveis
    [...pontos].sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao)).forEach((p) => {
      const s = situacaoDe(p.variacao);
      const selecionado = p.local_id === localSel;
      L.circleMarker([p.lat, p.lon], {
        radius: raio(p.variacao),
        fillColor: s === "subiu" ? c.subiuLocal : s === "caiu" ? c.caiu : c.cinza,
        fillOpacity: selecionado ? 1 : 0.88,
        color: selecionado ? c.texto : c.superficie,
        weight: selecionado ? 3 : 2,
      })
        .bindTooltip(dica([
          p.local, p.endereco,
          `2022: ${fmt(p.votos_2022)} votos; 2026: ${fmt(p.votos_2026)} (${seta(p.variacao)})`,
          p.mesmo_predio === "não" ? "Outro prédio com o mesmo número em 2022" : null,
          p.coordenada_aproximada === "sim" ? "Coordenada aproximada" : null,
        ]), { direction: "top", offset: [0, -6] })
        .on("click", (ev) => { L.DomEvent.stopPropagation(ev); acoes.current.aoEscolherLocal(p.local_id); })
        .addTo(grupo);
    });
    grupo.addTo(m);
    camadas.current.locais = grupo;
  }, [cidade, pontos, localSel]);

  return (
    <div className="mapa" ref={caixa} role="region"
      aria-label={cidade ? "Mapa do município com os locais de votação" : "Mapa dos municípios"} />
  );
}

export function Legenda({ cidade }) {
  const itens = cidade
    ? [["ponto subiu", "▲ subiu"], ["ponto caiu", "▼ caiu"], ["ponto igual", "= igual"]]
    : [["mun subiu", "▲ subiu"], ["mun caiu", "▼ caiu"], ["mun sem-voto", "igual ou sem voto"]];
  return (
    <div className="legenda">
      {itens.map(([cls, texto]) => (
        <span key={cls}><i className={`${cls}${cidade ? " redondo" : ""}`} aria-hidden="true" />{texto}</span>
      ))}
      <span>
        {cidade
          ? "Tamanho do círculo: variação de votos. Clique num local para ver os candidatos de 2026; a tabela ao lado lista todos."
          : "Clique num município para ver os locais de votação."}
      </span>
    </div>
  );
}
