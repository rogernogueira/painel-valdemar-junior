const inteiro = new Intl.NumberFormat("pt-BR");

export const fmt = (v) => (v == null ? "—" : inteiro.format(v));
export const sinal = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + inteiro.format(v));
// estado também em forma, não só em cor
export const seta = (v) => (v > 0 ? "▲ " : v < 0 ? "▼ " : "= ") + sinal(v);
export const pct = (v) => (v == null ? "—" : `${v.toLocaleString("pt-BR")}%`);
export const situacaoDe = (v) => (v > 0 ? "subiu" : v < 0 ? "caiu" : "igual");
export const nomeCargo = (c) => (c === "estadual" ? "deputado estadual" : "deputado federal");

// "NILTON FRANCO" → "Nilton Franco"; partículas em minúscula ("Maria das Dores")
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
export const nomeProprio = (nome) => String(nome ?? "").toLowerCase().split(/\s+/)
  .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ");
