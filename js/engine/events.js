// Motor de eventos: históricos (datados), aleatórios (probabilísticos), condicionais (dependem do estado) e futuros (pós-2025).
(function (S) {
  'use strict';
  const U = S.U, H = S.H;
  const EV = { list: [], byId: {} };

  // Formato do evento:
  // { id, kind: 'hist'|'rand'|'cond'|'futuro', title, text, sev, date:[ano,tri] | window:[ini,fim],
  //   only:[cids], not:[cids], cond(st), prob (número ou fn), cooldown (trimestres), once, eff, choices:[{label, desc, eff, ideo, outcomes(st)}] }
  EV.add = function (arr) {
    for (const ev of arr) {
      if (EV.byId[ev.id]) { console.warn('evento duplicado', ev.id); continue; }
      if (ev.once === undefined) ev.once = ev.kind === 'hist';
      EV.list.push(ev); EV.byId[ev.id] = ev;
    }
  };

  EV.applicable = function (st, ev) {
    const t = H.t(st);
    if (ev.once && st.fired[ev.id] !== undefined) return false;
    if (st.cooldown['ev_' + ev.id] && st.turn < st.cooldown['ev_' + ev.id]) return false;
    if (ev.only && !ev.only.includes(st.cid)) return false;
    if (ev.not && ev.not.includes(st.cid)) return false;
    if (ev.date) { if (st.year !== ev.date[0] || st.q !== ev.date[1]) return false; }
    if (ev.window) { if (t < ev.window[0] || (ev.window[1] !== undefined && t >= ev.window[1])) return false; }
    if (ev.kind === 'futuro' && t < 2026) return false;
    if (ev.regimes && !ev.regimes.includes(st.regime)) return false;
    if (ev.dem === true && !H.dem(st)) return false;
    if (ev.dem === false && H.dem(st)) return false;
    if (ev.cond) { try { if (!ev.cond(st)) return false; } catch (e) { return false; } }
    return true;
  };

  EV.prob = function (st, ev) {
    let p = ev.prob === undefined ? (ev.kind === 'hist' ? 1 : 0.02) : (typeof ev.prob === 'function' ? ev.prob(st) : ev.prob);
    if (!isFinite(p)) p = 0;
    return U.clamp(p, 0, 1);
  };

  EV.fire = function (st, ev, rng) {
    st.fired[ev.id] = st.turn;
    if (ev.cooldown) st.cooldown['ev_' + ev.id] = st.turn + ev.cooldown;
    else if (!ev.once) st.cooldown['ev_' + ev.id] = st.turn + 12;
    const text = typeof ev.text === 'function' ? ev.text(st) : ev.text;
    const title = typeof ev.title === 'function' ? ev.title(st) : ev.title;
    const res = { id: ev.id, title: title, text: text, sev: ev.sev || 'info', kind: ev.kind, lines: [] };
    if (ev.eff) H.applyEffects(st, typeof ev.eff === 'function' ? ev.eff(st) : ev.eff, 1, title);
    if (ev.outcomes) {
      const outs = U.normalizeOutcomes(ev.outcomes(st));
      const pick = U.pickWeighted(rng, outs);
      res.lines.push('🎲 ' + pick.label + ' (chance era ' + Math.round(pick.p * 100) + '%)');
      if (pick.eff) H.applyEffects(st, typeof pick.eff === 'function' ? pick.eff(st) : pick.eff, 1, title);
      if (pick.text) res.lines.push(typeof pick.text === 'function' ? pick.text(st) : pick.text);
    }
    if (ev.after) ev.after(st, rng, res);
    if (ev.choices && ev.choices.length) {
      st.pendingEvents.push({ id: ev.id, title: title, text: text });
      res.hasChoices = true;
    }
    st.timeline.push({ y: st.year, q: st.q, kind: ev.kind, title: title, text: text + (res.lines.length ? ' ' + res.lines.join(' ') : '') });
    return res;
  };

  EV.roll = function (st, rng) {
    const out = [];
    // ordem aleatória para não privilegiar os primeiros da lista
    const order = EV.list.map((e, i) => [rng(), e]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    let randCount = 0;
    const diff = st.difficulty === 'facil' ? 0.7 : st.difficulty === 'dificil' ? 1.3 : 1;
    // históricos primeiro (sempre disparam se aplicáveis)
    for (const ev of order) {
      if (ev.kind !== 'hist') continue;
      if (!EV.applicable(st, ev)) continue;
      if (rng() < EV.prob(st, ev)) out.push(EV.fire(st, ev, rng));
    }
    for (const ev of order) {
      if (ev.kind === 'hist') continue;
      if (randCount >= 3 && ev.kind !== 'cond') continue;
      if (!EV.applicable(st, ev)) continue;
      let p = EV.prob(st, ev);
      if (ev.sev === 'crise' || ev.sev === 'alerta') p *= diff;
      if (rng() < p) { out.push(EV.fire(st, ev, rng)); if (ev.kind !== 'cond') randCount++; }
      if (out.length >= 7) break;
    }
    return out;
  };

  S.EVENTS = EV;
})(globalThis.S = globalThis.S || {});
