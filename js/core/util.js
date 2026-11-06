// SOBERANIA — utilitários base. Todos os módulos penduram em globalThis.S
(function (S) {
  'use strict';
  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  U.sum = (arr) => arr.reduce((a, b) => a + b, 0);
  U.avg = (arr) => (arr.length ? U.sum(arr) / arr.length : 0);
  U.deepClone = (o) => JSON.parse(JSON.stringify(o));
  U.logistic = (x) => 1 / (1 + Math.exp(-x));

  // Interpolação em âncoras [[ano, valor], ...]. Mesmo ano repetido = salto.
  U.interp = function (anchors, t, fallback) {
    if (!anchors || !anchors.length) return fallback;
    if (t <= anchors[0][0]) return anchors[0][1];
    const last = anchors[anchors.length - 1];
    if (t >= last[0]) return last[1];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (t >= a[0] && t < b[0]) {
        if (b[0] === a[0]) return b[1];
        return U.lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return last[1];
  };
  // Valor "em degrau": último âncora <= t (para regimes, flags históricas)
  U.step = function (anchors, t, fallback) {
    if (!anchors || !anchors.length) return fallback;
    let v = fallback;
    for (const a of anchors) if (t >= a[0]) v = a[1];
    return v;
  };

  // RNG determinístico (mulberry32) — estado salvo no jogo
  U.makeRng = function (seed) {
    let s = seed >>> 0;
    const rng = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.getState = () => s;
    rng.setState = (v) => { s = v >>> 0; };
    return rng;
  };
  U.gauss = function (rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // escolhe um resultado de [{p, ...}] (p não precisa somar 1)
  U.pickWeighted = function (rng, list) {
    const tot = U.sum(list.map((x) => Math.max(0, x.p)));
    if (tot <= 0) return list[0];
    let r = rng() * tot;
    for (const x of list) { r -= Math.max(0, x.p); if (r <= 0) return x; }
    return list[list.length - 1];
  };
  U.normalizeOutcomes = function (list) {
    const tot = U.sum(list.map((x) => Math.max(0, x.p))) || 1;
    return list.map((x) => Object.assign({}, x, { p: Math.max(0, x.p) / tot }));
  };

  U.stripAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Formatação pt-BR
  U.fmt = function (v, dec) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (dec === undefined) dec = Math.abs(v) >= 100 ? 0 : 1;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  U.fmtSigned = (v, dec) => (v > 0 ? '+' : '') + U.fmt(v, dec);
  U.fmtBig = function (v) {
    const a = Math.abs(v);
    if (a >= 1e6) return U.fmt(v / 1e6, 2) + ' mi';
    if (a >= 1e3) return U.fmt(v / 1e3, 1) + ' mil';
    return U.fmt(v, 1);
  };
  U.MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  U.monthLabel = (m) => U.MONTHS[((m % 12) + 12) % 12] + '/' + Math.floor(m / 12);
  U.quarterLabel = (y, q) => q + 'º tri/' + y;

  S.U = U;
})(globalThis.S = globalThis.S || {});
