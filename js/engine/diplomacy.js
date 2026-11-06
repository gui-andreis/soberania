// Diplomacia e guerra: poder relativo, relações, alianças, probabilidades de desfecho.
(function (S) {
  'use strict';
  const U = S.U, H = S.H, C = S.COUNTRIES, W = S.WORLD;
  const DIP = {};

  // Poder militar de um país (índice). Para o jogador, usa o estado real; para os outros, séries históricas.
  DIP.powerOf = function (cid, st) {
    const t = H.t(st);
    if (cid === st.cid) {
      const gdp = st.e.Y;
      const tech = Math.pow(H.gdppc(st) / 10000, 0.5);
      const mil = Math.max(0.3, st.e.budget.militar);
      return gdp * mil / 100 * tech * (1 + st.mil.bonus / 100) * (st.flags.mobilizacao ? 1.5 : 1) * 10;
    }
    const c = C.byId[cid];
    const pop = U.interp(c.pop, t), gdppc = U.interp(c.gdppc, t);
    const gdp = pop * gdppc / 1000;
    const mil = Math.max(0.3, U.interp(c.milPct, t, 2));
    return gdp * mil / 100 * Math.pow(gdppc / 10000, 0.5) * 10;
  };
  DIP.hasNukes = function (cid, st) {
    if (cid === st.cid) return st.mil.nukes;
    const n = C.byId[cid].t.nukes;
    return n && H.t(st) >= n;
  };
  DIP.isGreatPower = (cid, st) => DIP.powerOf(cid, st) > 400 || DIP.hasNukes(cid, st);
  DIP.isNeighbor = (st, cid) => H.neighbors(st).includes(cid) || (C.byId[cid].neighbors || []).includes(st.cid);
  DIP.canProject = (st, cid) => DIP.isNeighbor(st, cid) || DIP.powerOf(st.cid, st) > 300 || st.mil.nukes;

  // Relações iniciais
  DIP.initialRelation = function (a, b, t) {
    const ba = W.blocOf(a, t), bb = W.blocOf(b, t);
    let r = 10;
    if (ba === bb && ba !== 'neutro' && ba !== 'nao_alinhado') r += 40;
    const opposed = [['ocidente', 'socialista'], ['ocidente', 'eixo'], ['socialista', 'eixo'], ['ocidente', 'revisionista']];
    for (const o of opposed) if ((ba === o[0] && bb === o[1]) || (ba === o[1] && bb === o[0])) r -= 45;
    for (const rv of W.rivalries) {
      if (((rv[0] === a && rv[1] === b) || (rv[0] === b && rv[1] === a)) && t >= rv[2] && t < rv[3]) r += rv[4];
    }
    for (const org of ['otan', 'cee', 'mercosul', 'brics', 'nafta', 'asean', 'pacto']) if (W.isMember(a, org, t) && W.isMember(b, org, t)) r += 15;
    const ca = C.byId[a], cb = C.byId[b];
    if (ca.region === cb.region) r += 8;
    return U.clamp(r, -90, 90);
  };

  DIP.others = function (st) {
    const t = H.t(st);
    return C.list.filter((c) => c.id !== st.cid && C.available(c, t)).map((c) => c.id);
  };

  DIP.allyOf = function (cid, st) {
    // aliados relevantes do alvo (por bloco/organizações), para dissuasão
    const t = H.t(st);
    const allies = [];
    for (const o of DIP.others(st).concat([])) {
      if (o === cid) continue;
      if ((W.isMember(cid, 'otan', t) && W.isMember(o, 'otan', t)) || (W.isMember(cid, 'pacto', t) && W.isMember(o, 'pacto', t))) allies.push(o);
    }
    if (W.blocOf(cid, t) === 'ocidente' && cid !== 'US' && t >= 1945 && C.available(C.byId.US, t) && !allies.includes('US')) allies.push('US');
    return allies.filter((x) => x !== st.cid);
  };

  // ---------- Probabilidades de ações coercitivas ----------
  DIP.ratio = function (st, cid) {
    const ours = DIP.powerOf(st.cid, st);
    let theirs = DIP.powerOf(cid, st);
    // aliados entram parcialmente se o alvo for atacado
    for (const a of DIP.allyOf(cid, st)) if (st.dip.rel[a] !== undefined && st.dip.rel[a] < 50) theirs += DIP.powerOf(a, st) * 0.35;
    return ours / Math.max(0.01, theirs);
  };

  DIP.ultimatumOutcomes = function (st, cid) {
    const r = DIP.ratio(st, cid);
    const lr = Math.log(r);
    const postWar = H.t(st) >= 1945;
    const theirNukes = DIP.hasNukes(cid, st);
    const capit = U.clamp(0.02 + U.logistic(lr - 2.2) * 0.45 - (theirNukes ? 0.1 : 0), 0.005, 0.5);
    const war = U.clamp(0.25 + U.logistic(lr) * 0.35 + (st.dip.rel[cid] < -40 ? 0.15 : 0), 0.05, 0.9);
    const med = postWar ? 0.18 : 0.08;
    const sanc = postWar ? 0.12 + (W.blocOf(cid, H.t(st)) === 'ocidente' ? 0.12 : 0) : 0.04;
    return U.normalizeOutcomes([
      { p: capit, key: 'capitula', label: H.cname(cid, st) + ' cede às exigências' },
      { p: war, key: 'guerra', label: 'Recusa e conflito armado' },
      { p: med, key: 'mediacao', label: 'Mediação internacional (ONU/terceiros)' },
      { p: sanc, key: 'sancoes', label: 'Recusa + sanções internacionais contra você' }
    ]);
  };

  DIP.warOdds = function (st, cid) {
    const r = DIP.ratio(st, cid);
    const lr = Math.log(r);
    const theirNukes = DIP.hasNukes(cid, st), ourNukes = st.mil.nukes;
    let win = U.logistic(lr * 1.3);
    if (theirNukes && !ourNukes) win *= 0.25;
    const outcomes = [
      { p: win * 0.8, key: 'vitoria', label: 'Vitória militar' },
      { p: 0.2 + (1 - Math.abs(win - 0.5)) * 0.25, key: 'impasse', label: 'Impasse e paz negociada' },
      { p: (1 - win) * 0.8, key: 'derrota', label: 'Derrota militar' }
    ];
    if (theirNukes || ourNukes) outcomes.push({ p: 0.03 + (theirNukes && ourNukes ? 0.03 : 0), key: 'nuclear', label: 'Escalada nuclear' });
    return U.normalizeOutcomes(outcomes);
  };

  DIP.acceptProb = function (st, cid, kind) {
    const rel = st.dip.rel[cid] || 0;
    const base = { comercio: 0.35, alianca: 0.15, emprestimo: 0.2, paz: 0.3 }[kind] || 0.3;
    const blocBonus = H.myBloc(st) === W.blocOf(cid, H.t(st)) ? 0.15 : 0;
    return U.clamp(base + rel / 160 + blocBonus, 0.03, 0.95);
  };

  // ---------- Guerra ----------
  DIP.startWar = function (st, cid, opts) {
    if (st.mil.wars.some((w) => w.target === cid)) return;
    opts = opts || {};
    st.mil.wars.push({ target: cid, sinceMonth: st.month, score: opts.score || 0, aggressor: !!opts.aggressor, existential: !!opts.existential, label: opts.label || '',
      ourAllies: (opts.ourAllies || []).filter((a) => a[0] !== st.cid), enemyAllies: (opts.enemyAllies || []).filter((a) => a[0] !== st.cid) });
    st.dip.rel[cid] = -100;
    if (opts.aggressor && H.t(st) >= 1945) {
      H.applyRel(st, { '*': -8 }, 1);
      if (W.blocOf(cid, H.t(st)) === 'ocidente' && H.myBloc(st) !== 'ocidente') H.sanctionsOnUs(st, { by: 'ocidente', on: true });
    }
    st.timeline.push({ y: st.year, q: st.q, kind: 'guerra', title: 'Guerra contra ' + H.cname(cid, st), text: opts.label || '' });
  };
  DIP.endWar = function (st, cid, result) {
    st.mil.wars = st.mil.wars.filter((w) => w.target !== cid);
    if (!st.mil.wars.length) delete st.flags.mobilizacao;
    st.dip.rel[cid] = Math.max(st.dip.rel[cid], -50);
    st.timeline.push({ y: st.year, q: st.q, kind: 'guerra', title: 'Fim da guerra contra ' + H.cname(cid, st), text: result });
  };

  // razão de forças numa guerra específica, incluindo coalizões datadas [cid, de, até]
  DIP.warRatio = function (st, w) {
    const t = H.t(st);
    const active = (a) => S.COUNTRIES.byId[a[0]] && t >= (a[1] || 0) && (a[2] === undefined || t < a[2]);
    let ours = DIP.powerOf(st.cid, st), theirs = DIP.powerOf(w.target, st);
    for (const a of w.ourAllies || []) if (active(a)) ours += DIP.powerOf(a[0], st) * 0.6;
    for (const a of w.enemyAllies || []) if (active(a)) theirs += DIP.powerOf(a[0], st) * 0.6;
    if (!(w.enemyAllies || []).length) for (const a of DIP.allyOf(w.target, st)) if ((st.dip.rel[a] || 0) < 50) theirs += DIP.powerOf(a, st) * 0.35;
    return ours / Math.max(0.01, theirs);
  };

  // passo mensal da guerra
  DIP.warMonth = function (st, rng, out) {
    for (const w of st.mil.wars.slice()) {
      const r = DIP.warRatio(st, w);
      const drift = U.clamp(Math.log(r) * 2.2, -6, 6) * (w.existential ? 0.45 : 1) + (st.pol.militaryLoyalty - 50) * 0.02 - st.mil.warEx * 0.02;
      w.score += drift + U.gauss(rng) * 3.5;
      const intensity = U.clamp(0.4 + Math.min(r, 1 / r) * 0.6, 0.3, 1);
      st.e.gapMod = (st.e.gapMod || 0) - 0.12 * intensity;
      st.mil.warEx = U.clamp(st.mil.warEx + (H.dem(st) ? 1.3 : 0.7) * intensity, 0, 100);
      const deaths = st.e.pop * 0.04 * intensity * (w.existential ? 8 : 1); // milhares de mortos no mês
      H.deaths(st, deaths);
      st.stats.warDeaths += deaths;
      if (w.score >= 100 || w.score <= -100) {
        const victory = w.score >= 100;
        const tname = H.cname(w.target, st);
        DIP.endWar(st, w.target, victory ? 'vitória' : 'derrota');
        if (victory) {
          H.applyEffects(st, { legit: 10, groups: { militares: 15, religiosos: 4, classe_media: 6 }, confidence: 5, military: 10, warEx: -40 }, 1, 'Vitória');
          out.push({ sev: 'positivo', title: 'Vitória contra ' + tname, text: 'Suas forças venceram. O prestígio do governo e das Forças Armadas dispara.' });
        } else {
          H.applyEffects(st, { legit: -18, groups: { militares: -25, classe_media: -10, trabalhadores: -8 }, confidence: -12, military: -20, debt: 8, warEx: -30 }, 1, 'Derrota');
          out.push({ sev: 'crise', title: 'Derrota contra ' + tname, text: 'A guerra terminou em derrota. A legitimidade do regime está abalada.' });
          if (w.existential) st.pendingGameOver = { reason: 'derrota', text: 'O país foi derrotado e ocupado em uma guerra existencial.' };
        }
      }
    }
    if (!st.mil.wars.length) st.mil.warEx = Math.max(0, st.mil.warEx - 1.5);
  };

  S.DIP = DIP;
})(globalThis.S = globalThis.S || {});
