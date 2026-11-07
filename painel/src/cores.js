// Escala sequencial do mapa de percentual: interpolação em OKLab entre dois
// tokens do CSS, para o degradê ter passos visualmente iguais.

const lerToken = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

// "#rrggbb" ou "oklch(L% C H)" → [L, a, b] em OKLab
function paraOklab(cor) {
  const ok = cor.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/i);
  if (ok) {
    const [L, C, h] = [Number(ok[1]) / 100, Number(ok[2]), (Number(ok[3]) * Math.PI) / 180];
    return [L, C * Math.cos(h), C * Math.sin(h)];
  }
  const hex = cor.replace("#", "");
  const lin = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function paraHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return "#" + rgb.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    const e = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(e * 255).toString(16).padStart(2, "0");
  }).join("");
}

// fn(t) com t de 0 a 1 → cor ao longo das paradas (tokens), em trechos iguais
export function escalaSequencial(...tokens) {
  const paradas = tokens.map((t) => paraOklab(lerToken(t)));
  const trechos = paradas.length - 1;
  return (t) => {
    const k = Math.min(1, Math.max(0, t)) * trechos;
    const i = Math.min(trechos - 1, Math.floor(k));
    const [a, b] = [paradas[i], paradas[i + 1]];
    return paraHex(a.map((v, j) => v + (b[j] - v) * (k - i)));
  };
}

// topo "redondo" da escala: 3,7% → 4%, 23% → 25%, 61% → 70%
export function topoEscala(max) {
  if (!(max > 0)) return 1;
  const passos = [1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];
  return passos.find((p) => p >= max) ?? 100;
}
