// Gráficos SVG no estilo "painel econômico": faixas por governo com média tracejada, linha dourada, tooltip.
(function (S) {
  'use strict';
  const U = S.U;
  const CH = {};
  const BAND_FILL = ['rgba(90,130,90,0.16)', 'rgba(150,115,60,0.16)', 'rgba(110,90,150,0.18)', 'rgba(150,70,70,0.18)', 'rgba(70,120,150,0.16)', 'rgba(140,140,70,0.14)'];
  const BAND_LINE = ['#6fbf8a', '#d9a55a', '#9d8ad6', '#e06c6c', '#69b5d9', '#c9c46a'];
  let uid = 0;

  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, step0 = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step * 0.5; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function logTicks(min, max) {
    const out = [];
    const a = Math.floor(Math.log10(Math.max(1e-9, min))), b = Math.ceil(Math.log10(max));
    const step = Math.max(1, Math.ceil((b - a) / 7)); // muitas décadas (hiperinflação): espaça os rótulos
    for (let p = a; p <= b; p += step) out.push(Math.pow(10, p));
    return out;
  }

  // Extrai a janela de dados
  CH.windowData = function (st, key, months) {
    const arr = st.hist.series[key] || [];
    const n = arr.length;
    const from = months ? Math.max(0, n - months) : 0;
    const pts = [];
    for (let i = from; i < n; i++) if (arr[i] !== null && arr[i] !== undefined && isFinite(arr[i])) pts.push({ m: st.hist.start + i, v: arr[i] });
    return pts;
  };

  CH.bandsFor = function (st, m0, m1) {
    const out = [];
    const ms = st.mandates.slice().sort((a, b) => a.start - b.start);
    for (let i = 0; i < ms.length; i++) {
      const s = Math.max(ms[i].start, m0), e = Math.min(i + 1 < ms.length ? ms[i + 1].start : m1 + 1, m1 + 1);
      if (e > s) out.push({ start: s, end: e, label: ms[i].label, hist: ms[i].hist, idx: i });
    }
    return out;
  };

  // opts: {key, keys:[{key,color,label}], unit, dec, log, zero, months, height, fmt}
  CH.render = function (st, opts) {
    const id = 'ch' + (++uid);
    const W = 760, Hh = opts.height || 290, padL = 56, padR = 74, padT = 34, padB = 26;
    const keys = opts.keys || [{ key: opts.key, color: '#f4c34f', label: opts.label || '' }];
    const datasets = keys.map((k) => ({ k: k, pts: CH.windowData(st, k.key, opts.months) }));
    const all = datasets.flatMap((d) => d.pts);
    if (all.length < 2) return '<div class="chart-empty">Sem dados suficientes ainda.</div>';
    const m0 = Math.min(...all.map((p) => p.m)), m1 = Math.max(...all.map((p) => p.m));
    let vmin = Math.min(...all.map((p) => p.v)), vmax = Math.max(...all.map((p) => p.v));
    const log = opts.log && vmin > 0;
    if (opts.zero && !log) { vmin = Math.min(vmin, 0); vmax = Math.max(vmax, 0); }
    if (opts.min !== undefined) vmin = Math.min(vmin, opts.min);
    if (opts.max !== undefined) vmax = Math.max(vmax, opts.max);
    let ticks;
    if (log) { ticks = logTicks(vmin, vmax); vmin = ticks[0]; vmax = ticks[ticks.length - 1]; }
    else { const pad = (vmax - vmin) * 0.08 || 1; ticks = niceTicks(vmin - pad, vmax + pad, 5); vmin = ticks[0]; vmax = ticks[ticks.length - 1]; }
    const X = (m) => padL + ((m - m0) / Math.max(1, m1 - m0)) * (W - padL - padR);
    const Y = (v) => {
      if (log) return padT + (1 - (Math.log10(v) - Math.log10(vmin)) / (Math.log10(vmax) - Math.log10(vmin))) * (Hh - padT - padB);
      return padT + (1 - (v - vmin) / (vmax - vmin)) * (Hh - padT - padB);
    };
    const fmt = opts.fmt || ((v) => U.fmt(v, opts.dec));
    let svg = `<svg viewBox="0 0 ${W} ${Hh}" class="chart-svg" preserveAspectRatio="none" role="img" aria-label="${opts.title || ''}">`;
    // faixas de governo
    const bands = CH.bandsFor(st, m0, m1);
    const main = datasets[0].pts;
    bands.forEach((b, i) => {
      const x0 = X(b.start), x1 = X(Math.min(b.end, m1 + 1) - (b.end > m1 ? 0 : 0));
      const ci = b.idx % BAND_FILL.length;
      svg += `<rect x="${x0}" y="${padT}" width="${Math.max(0, Math.min(X(m1), x1) - x0)}" height="${Hh - padT - padB}" fill="${BAND_FILL[ci]}"/>`;
      const inBand = main.filter((p) => p.m >= b.start && p.m < b.end);
      if (inBand.length) {
        const avg = U.avg(inBand.map((p) => p.v));
        b.avg = avg;
        const xa = X(inBand[0].m), xb = X(inBand[inBand.length - 1].m);
        if (!log || avg > 0) svg += `<line x1="${xa}" x2="${xb}" y1="${Y(avg)}" y2="${Y(avg)}" stroke="${BAND_LINE[ci]}" stroke-width="1.6" stroke-dasharray="5 4" opacity="0.9"/>`;
        const w = Math.min(X(m1), x1) - x0;
        if (w > 70) {
          const lab = b.label.length > 22 ? b.label.slice(0, 21) + '…' : b.label;
          svg += `<text x="${x0 + 8}" y="${padT + 16}" class="band-lab">${esc(lab)}</text><text x="${x0 + 8}" y="${padT + 30}" class="band-sub">média ${fmt(avg)}</text>`;
        }
      }
    });
    // grade
    for (const tk of ticks) {
      const y = Y(tk);
      svg += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="grid"/>`;
      svg += `<text x="${padL - 8}" y="${y + 4}" class="axis" text-anchor="end">${log ? U.fmtBig(tk) : fmt(tk)}${opts.axisUnit || ''}</text>`;
    }
    if (opts.zero && !log && vmin < 0 && vmax > 0) svg += `<line x1="${padL}" x2="${W - padR}" y1="${Y(0)}" y2="${Y(0)}" class="zero"/>`;
    if (opts.refLine !== undefined && opts.refLine !== null) svg += `<line x1="${padL}" x2="${W - padR}" y1="${Y(opts.refLine)}" y2="${Y(opts.refLine)}" class="ref"/><text x="${W - padR + 4}" y="${Y(opts.refLine) - 4}" class="axis">${opts.refLabel || ''}</text>`;
    // eixo x (anos)
    const y0 = Math.floor(m0 / 12), y1 = Math.floor(m1 / 12);
    const span = y1 - y0;
    const stepY = span > 60 ? 10 : span > 30 ? 5 : span > 14 ? 2 : 1;
    for (let y = Math.ceil(y0 / stepY) * stepY; y <= y1; y += stepY) {
      const x = X(y * 12);
      if (x < padL - 1) continue;
      svg += `<text x="${x}" y="${Hh - 6}" class="axis" text-anchor="middle">${y}</text>`;
    }
    if (span < 1) for (let m = m0; m <= m1; m += 3) svg += `<text x="${X(m)}" y="${Hh - 6}" class="axis" text-anchor="middle">${U.MONTHS[m % 12]}</text>`;
    // linhas
    datasets.forEach((d, di) => {
      if (d.pts.length < 2) return;
      let path = '';
      let pen = false;
      for (let i = 0; i < d.pts.length; i++) {
        const p = d.pts[i];
        if (log && p.v <= 0) { pen = false; continue; }
        path += (pen ? 'L' : 'M') + X(p.m).toFixed(1) + ' ' + Y(p.v).toFixed(1);
        pen = true;
      }
      svg += `<path d="${path}" fill="none" stroke="${d.k.color || '#f4c34f'}" stroke-width="${di === 0 ? 2.4 : 1.8}" stroke-linejoin="round" ${d.k.dash ? 'stroke-dasharray="4 3"' : ''}/>`;
      const last = d.pts[d.pts.length - 1];
      if (di === 0 || d.k.pill) {
        const ly = Y(Math.max(log ? vmin : -Infinity, last.v));
        svg += `<rect x="${W - padR + 6}" y="${ly - 10}" rx="4" width="${padR - 10}" height="20" class="pill" fill="${d.k.color || '#f4c34f'}"/><text x="${W - padR + 6 + (padR - 10) / 2}" y="${ly + 4}" class="pill-t" text-anchor="middle">${fmt(last.v)}${opts.pillUnit || ''}</text>`;
      }
    });
    // camada de hover
    svg += `<line class="hover-line" x1="0" x2="0" y1="${padT}" y2="${Hh - padB}" style="display:none"/><circle class="hover-dot" r="4" style="display:none"/>`;
    svg += `<rect class="hover-cap" x="${padL}" y="${padT}" width="${W - padL - padR}" height="${Hh - padT - padB}" fill="transparent"/>`;
    svg += '</svg>';
    CH._meta[id] = { X, Y, m0, m1, padL, padR, W, datasets, bands, fmt, opts, log, vmin };
    let legend = '';
    if (keys.length > 1) legend = '<div class="legend">' + keys.map((k) => `<span><i style="background:${k.color}"></i>${esc(k.label)}</span>`).join('') + '</div>';
    return `<div class="chart" id="${id}">${svg}<div class="tip" style="display:none"></div></div>${legend}`;
  };
  CH._meta = {};

  CH.bind = function (root) {
    root.querySelectorAll('.chart').forEach((el) => {
      const meta = CH._meta[el.id];
      if (!meta) return;
      const svg = el.querySelector('svg');
      const cap = el.querySelector('.hover-cap'), line = el.querySelector('.hover-line'), dot = el.querySelector('.hover-dot'), tip = el.querySelector('.tip');
      if (!cap) return;
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const x = (cx - r.left) / r.width * meta.W;
        const m = Math.round(meta.m0 + (x - meta.padL) / (meta.W - meta.padL - meta.padR) * (meta.m1 - meta.m0));
        const main = meta.datasets[0].pts;
        let best = main[0];
        for (const p of main) if (Math.abs(p.m - m) < Math.abs(best.m - m)) best = p;
        const px = meta.X(best.m), py = meta.Y(meta.log ? Math.max(meta.vmin, best.v) : best.v);
        line.setAttribute('x1', px); line.setAttribute('x2', px); line.style.display = '';
        dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.style.display = '';
        const band = meta.bands.find((b) => best.m >= b.start && best.m < b.end);
        let rows = meta.datasets.map((d) => { const q = d.pts.find((p) => p.m === best.m); return q ? `<div class="tip-v" style="color:${d.k.color}">${meta.fmt(q.v)}${meta.opts.pillUnit || ''}${d.k.label && meta.datasets.length > 1 ? ' <small>' + esc(d.k.label) + '</small>' : ''}</div>` : ''; }).join('');
        tip.innerHTML = `<div class="tip-d">${U.MONTHS[best.m % 12]}/${Math.floor(best.m / 12)}</div>${rows}${band ? `<div class="tip-b"><i style="background:${BAND_LINE[band.idx % BAND_LINE.length]}"></i>${esc(band.label)}</div>` : ''}`;
        tip.style.display = '';
        const left = px / meta.W * r.width;
        tip.style.left = Math.min(r.width - 150, Math.max(0, left + 12)) + 'px';
        tip.style.top = Math.max(0, py / svg.viewBox.baseVal.height * r.height - 40) + 'px';
      };
      const leave = () => { line.style.display = 'none'; dot.style.display = 'none'; tip.style.display = 'none'; };
      cap.addEventListener('mousemove', move); cap.addEventListener('touchmove', move, { passive: true });
      cap.addEventListener('mouseleave', leave); cap.addEventListener('touchend', leave);
    });
  };

  // Análise automática para o painel lateral (bullets)
  CH.insights = function (st, key, opts) {
    const all = CH.windowData(st, key, 0);
    const win = CH.windowData(st, key, opts.months);
    if (win.length < 2) return [];
    const fmt = opts.fmt || ((v) => U.fmt(v, opts.dec));
    const u = opts.pillUnit || '';
    const out = [];
    let pk = win[0], tr = win[0];
    for (const p of win) { if (p.v > pk.v) pk = p; if (p.v < tr.v) tr = p; }
    const lab = (p) => U.MONTHS[p.m % 12] + '/' + Math.floor(p.m / 12);
    out.push(`Pico de <b>${fmt(pk.v)}${u}</b> em ${lab(pk)}`);
    out.push(`Mínimo de <b>${fmt(tr.v)}${u}</b> em ${lab(tr)}`);
    const last = all[all.length - 1];
    const yearAgo = all.find((p) => p.m === last.m - 12);
    if (yearAgo) {
      if (opts.log || opts.pct) out.push(`Em 12 meses: <b>${U.fmtSigned((last.v / yearAgo.v - 1) * 100, 1)}%</b>`);
      else out.push(`Em 12 meses: <b>${U.fmtSigned(last.v - yearAgo.v, opts.dec === undefined ? 1 : opts.dec)}${opts.ppUnit || ' p.p.'}</b>`);
    }
    // média do governo atual x anterior
    const ms = st.mandates.slice().sort((a, b) => a.start - b.start);
    const cur = ms[ms.length - 1];
    const prev = ms.length > 1 ? ms[ms.length - 2] : null;
    const curPts = all.filter((p) => p.m >= cur.start);
    if (curPts.length > 2) {
      let s = `Média de ${esc(cur.label)}: <b>${fmt(U.avg(curPts.map((p) => p.v)))}${u}</b>`;
      if (prev) { const pp = all.filter((p) => p.m >= prev.start && p.m < cur.start); if (pp.length) s += ` (antes: ${fmt(U.avg(pp.map((p) => p.v)))}${u})`; }
      out.push(s);
    }
    if (opts.extra) out.push(...[].concat(opts.extra(st)).filter(Boolean));
    return out;
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  CH.esc = esc;
  CH.BAND_LINE = BAND_LINE;
  S.CHARTS = CH;
})(globalThis.S = globalThis.S || {});
