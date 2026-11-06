// Núcleo: aplicação de efeitos, helpers de requisito/condição usados por ações e eventos.
(function (S) {
  'use strict';
  const U = S.U;
  const H = {};

  // ---------- Consultas sobre o estado ----------
  H.country = (st) => S.COUNTRIES.byId[st.cid];
  H.t = (st) => st.year + (st.q - 1) / 4;
  H.regime = (st) => S.POLITICS.regimes[st.regime];
  H.dem = (st) => !!S.POLITICS.regimes[st.regime].democracy;
  H.auth = (st) => !S.POLITICS.regimes[st.regime].democracy;
  H.ideo = (st) => st.leader; // {e, s, ideoId}
  H.left = (st) => st.leader.e < -20;
  H.right = (st) => st.leader.e > 20;
  H.trait = (st, k, fb) => S.COUNTRIES.trait(H.country(st), k, H.t(st), fb);
  H.stepTrait = (st, k, fb) => S.COUNTRIES.stepTrait(H.country(st), k, H.t(st), fb);
  H.oilExp = (st) => Math.max(0, H.trait(st, 'oil', 0));
  H.oilImp = (st) => Math.max(0, -H.trait(st, 'oil', 0));
  H.commodity = (st) => H.trait(st, 'commodity', 0.2);
  H.open = (st) => st.e.open;
  H.isFixed = (st) => ['ouro', 'fixo', 'conversibilidade', 'euro', 'dolarizado'].includes(st.fxRegime);
  H.atWar = (st) => st.mil.wars.length > 0;
  H.member = (st, org) => !!st.dip.orgs[org];
  H.gdppc = (st) => st.e.Y * 1000 / st.e.pop;
  H.advanced = (st) => H.gdppc(st) > 25000;
  H.region = (st) => H.country(st).region;
  H.neighbors = (st) => H.country(st).neighbors || [];
  H.has = (st, f) => !!st.flags[f];
  H.sector = (st, s) => st.sectors[s];
  H.disaster = (st, k) => (H.country(st).t.dis || {})[k] || 0;
  H.growth = (st) => st.e.growthYoY;
  H.crisis = (st) => st.e.growthYoY < -2 || st.e.infl > 40 || st.e.unemp > 14;
  H.rng = (st) => S.RNG;
  H.yr = (a, b) => (st) => H.t(st) >= a && (b === undefined || H.t(st) < b);
  H.blocOf = (cid, st) => S.WORLD.blocOf(cid, H.t(st));
  H.myBloc = (st) => (st.dip.blocOverride || S.WORLD.blocOf(st.cid, H.t(st)));
  H.coldWar = (st) => H.t(st) >= 1947 && H.t(st) < 1991.9;
  H.euroMember = (st) => st.fxRegime === 'euro';
  H.fmt = U.fmt;
  H.name = (st) => S.COUNTRIES.nameAt(H.country(st), H.t(st));
  H.cname = (cid, st) => S.COUNTRIES.nameAt(S.COUNTRIES.byId[cid], H.t(st));

  // ---------- Efeitos ----------
  // Rótulos usados no relatório
  H.LABELS = {
    gap: 'Atividade (hiato do produto)', gpot: 'Crescimento potencial', infl: 'Inflação', inflExp: 'Expectativa de inflação',
    fx: 'Câmbio', reserves: 'Reservas', debt: 'Dívida/PIB', confidence: 'Confiança dos mercados', unemp: 'Desemprego',
    poverty: 'Pobreza', gini: 'Desigualdade', industry: 'Produção industrial', invest: 'Investimento', soe: 'Peso das estatais',
    open: 'Abertura comercial', minWage: 'Salário mínimo real', tax: 'Carga tributária', tb: 'Balança comercial',
    health: 'Saúde', education: 'Educação', infra: 'Infraestrutura', security: 'Segurança', corruption: 'Corrupção',
    press: 'Liberdade de imprensa', environment: 'Meio ambiente', approval: 'Aprovação geral', legit: 'Legitimidade',
    stability: 'Estabilidade', congress: 'Apoio no Congresso', military: 'Lealdade militar', protests: 'Protestos',
    coherence: 'Coerência ideológica', strength: 'Poder militar', warEx: 'Cansaço de guerra', shortage: 'Escassez',
    uStar: 'Desemprego estrutural', capital: 'Capital político', wageIndex: 'Reajuste automático do mínimo', demand: 'Demanda',
    inflMult: 'Multiplicador da inflação', investShift: 'Investimento privado', supply: 'Choque de oferta', tfp: 'Produtividade'
  };

  // Chaves numéricas simples -> caminho no estado
  const PATHS = {
    gap: ['e', 'gap'], demand: ['e', 'gapMod'], supply: ['e', 'supplyShock'], indexation: ['e', 'indexation'], investShift: ['e', 'investShift'], tbShift: ['e', 'tbShift'], wageIndex: ['e', 'wageIndex'], extShare: ['e', 'extShare'], reserves: ['e', 'reserves'], debt: ['e', 'debt'],
    confidence: ['e', 'confShift'], unemp: ['e', 'unemp'], poverty: ['e', 'povShift'], invest: ['e', 'invest'],
    soe: ['e', 'soe'], minWage: ['e', 'minWage'], tax: ['e', 'tax'], tb: ['e', 'tb'], gpot: ['e', 'tfp'], uStar: ['e', 'uStarShift'],
    shortage: ['e', 'shortage'], monetize: ['e', 'monetize'],
    health: ['soc', 'healthShift'], education: ['soc', 'eduShift'], infra: ['soc', 'infraShift'], security: ['soc', 'secShift'], secShift: ['soc', 'secShift'], povShift: ['e', 'povShift'],
    corruption: ['soc', 'corruption'], press: ['soc', 'press'], environment: ['soc', 'environment'],
    legit: ['pol', 'legit'], congress: ['pol', 'congressShift'], military: ['pol', 'milShift'], protests: ['pol', 'protests'],
    coherence: ['pol', 'coherence'], capital: ['pol', 'capital'], polarization: ['pol', 'polarization'],
    warEx: ['mil', 'warEx'], milTech: ['mil', 'tech']
  };
  const BOUNDS = {
    confShift: [-60, 60], unemp: [0.5, 45], soe: [0, 100], tax: [3, 65], corruption: [0, 100], press: [0, 100], environment: [0, 100],
    legit: [0, 100], protests: [0, 100], coherence: [0, 100], reserves: [0, 40], debt: [0, 1e9], invest: [3, 50], minWage: [20, 300],
    capital: [0, 12], polarization: [0, 100], warEx: [0, 100], monetize: [0, 1], shortage: [0, 100], indexation: [-0.4, 0.4], extShare: [0, 0.9], wageIndex: [0, 1.2]
  };

  H.applyEffects = function (st, eff, mult, src) {
    if (!eff) return;
    if (typeof eff === 'function') eff = eff(st);
    if (!eff) return;
    mult = mult === undefined ? 1 : mult;
    const log = [];
    for (const k in eff) {
      const v = eff[k];
      if (v === undefined || v === null) continue;
      if (PATHS[k]) {
        const [a, b] = PATHS[k];
        let nv = (st[a][b] || 0) + v * mult;
        const bnd = BOUNDS[b];
        if (bnd) nv = U.clamp(nv, bnd[0], bnd[1]);
        st[a][b] = nv;
        log.push([k, v * mult]);
        continue;
      }
      switch (k) {
        case 'infl': { const cur = (Math.exp(st.e.inflL) - 1) * 100; st.e.inflL = Math.log(1 + Math.max(-30, cur + v * mult) / 100); log.push([k, v * mult]); break; }
        case 'inflMult': { const cur = (Math.exp(st.e.inflL) - 1) * 100; st.e.inflL = Math.log(1 + Math.max(-30, cur * v) / 100); st.e.inflExpL = Math.log(1 + Math.max(-30, ((Math.exp(st.e.inflExpL) - 1) * 100) * v) / 100); break; }
        case 'inflExp': { const cur = (Math.exp(st.e.inflExpL) - 1) * 100; st.e.inflExpL = Math.log(1 + Math.max(-30, cur + v * mult) / 100); log.push([k, v * mult]); break; }
        case 'fx': st.e.fx *= 1 + (v * mult) / 100; st.e.rer *= 1 + (v * mult) / 100; log.push([k, v * mult]); break;
        case 'gini': st.e.giniShift += (v * mult) / 100; break;
        case 'open': st.e.open = U.clamp(st.e.open + v * mult, 0.02, 1.6); log.push([k, v * mult]); break;
        case 'industry': st.e.indShift += v * mult; log.push([k, v * mult]); break;
        case 'strength': st.mil.bonus = U.clamp(st.mil.bonus + v * mult, -80, 300); log.push([k, v * mult]); break;
        case 'approval': for (const g in st.pol.groups) H.groupShock(st, g, v * mult); log.push([k, v * mult]); break;
        case 'groups': for (const g in v) if (st.pol.groups[g] !== undefined) H.groupShock(st, g, v[g] * mult); break;
        case 'base': for (const g in v) if (st.pol.base[g] !== undefined) st.pol.base[g] = U.clamp(st.pol.base[g] + v[g] * mult, 0, 100); break;
        case 'budget': for (const c in v) st.e.budget[c] = Math.max(0, (st.e.budget[c] || 0) + v[c] * mult); break;
        case 'taxes': for (const c in v) st.e.taxes[c] = U.clamp((st.e.taxes[c] || 0) + v[c] * mult, -50, 100); break;
        case 'rel': H.applyRel(st, v, mult); break;
        case 'deaths': H.deaths(st, v * mult); log.push([k, v * mult]); break;
        case 'flags': Object.assign(st.flags, v); break;
        case 'unflag': for (const f of [].concat(v)) delete st.flags[f]; break;
        case 'sector': Object.assign(st.sectors, v); break;
        case 'regime': H.setRegime(st, v); break;
        case 'cbIndep': st.cbIndep = !!v; break;
        case 'target': st.inflTarget = v; break;
        case 'fxRegime': st.fxRegime = v; break;
        case 'world': for (const w in v) st.world.shock[w] = (st.world.shock[w] || 0) + v[w] * mult; break;
        case 'mods': for (const m of v) H.addMod(st, m, src); break;
        case 'lag': for (const l of v) st.pending.push({ at: st.turn + l.turns, eff: l.eff, src: src, note: l.note }); break;
        case 'org': for (const o in v) { if (v[o]) st.dip.orgs[o] = true; else delete st.dip.orgs[o]; } break;
        case 'sanctions': H.sanctionsOnUs(st, v); break;
        case 'popAdj': st.e.popAdj *= 1 + (v * mult) / 100; break;
        case 'nukes': st.mil.nukes = !!v; break;
        case 'election': st.pol.snapElection = v; break;
        case 'gameOver': st.pendingGameOver = v; break;
        case 'war': S.DIP.startWar(st, v.target, v); break;
        case 'peace': S.DIP.endWar(st, v.target, v.result || 'paz'); break;
        case 'text': break;
        default: break;
      }
    }
    return log;
  };

  H.groupShock = function (st, g, v) {
    st.pol.shock[g] = U.clamp((st.pol.shock[g] || 0) + v, -60, 60);
  };

  H.addMod = function (st, m, src) {
    // m: {name, turns, per:{...efeitos por mês}}  (turns em trimestres)
    st.mods.push({ name: m.name || src || 'efeito', months: (m.turns || 1) * 3, per: m.per, src: src, id: m.id });
  };
  H.hasMod = (st, id) => st.mods.some((m) => m.id === id);

  H.applyRel = function (st, v, mult) {
    for (const k in v) {
      const d = v[k] * mult;
      if (k === '*') { for (const c in st.dip.rel) st.dip.rel[c] = U.clamp(st.dip.rel[c] + d, -100, 100); }
      else if (k.startsWith('bloc:')) {
        const b = k.slice(5);
        for (const c in st.dip.rel) if (S.WORLD.blocOf(c, H.t(st)) === b) st.dip.rel[c] = U.clamp(st.dip.rel[c] + d, -100, 100);
      } else if (k === 'neighbors') {
        for (const c of H.neighbors(st)) if (st.dip.rel[c] !== undefined) st.dip.rel[c] = U.clamp(st.dip.rel[c] + d, -100, 100);
      } else if (st.dip.rel[k] !== undefined) st.dip.rel[k] = U.clamp(st.dip.rel[k] + d, -100, 100);
    }
  };

  H.sanctionsOnUs = function (st, v) {
    // v: {by: 'ocidente'|cid, on: true/false, severity}
    if (v.on) {
      if (!st.dip.sanctionedBy.includes(v.by)) st.dip.sanctionedBy.push(v.by);
    } else st.dip.sanctionedBy = st.dip.sanctionedBy.filter((x) => x !== v.by);
  };

  H.deaths = function (st, thousands) {
    // mortes em milhares
    const popM = st.e.pop;
    const frac = (thousands / 1000) / popM;
    st.e.popAdj *= 1 - frac;
    st.stats.deaths += thousands;
  };

  H.setRegime = function (st, r) {
    if (!S.POLITICS.regimes[r] || st.regime === r) return;
    const old = st.regime;
    st.regime = r;
    st.timeline.push({ y: st.year, q: st.q, kind: 'regime', title: 'Mudança de regime', text: S.POLITICS.regimes[old].name + ' → ' + S.POLITICS.regimes[r].name });
    const R = S.POLITICS.regimes[r];
    st.soc.press = U.clamp(st.soc.press * 0.5 + R.press * 0.5, 0, 100);
    if (R.elections && !S.POLITICS.regimes[old].elections) S.POL.scheduleElection(st, true);
  };

  // Ideologia de uma ação contra a do governante: devolve choques por grupo e penalidade de coerência
  H.ideologyReaction = function (st, ideo, weight) {
    if (!ideo) return { groups: {}, betrayal: 0 };
    weight = weight || 1;
    const L = st.leader;
    const G = S.POLITICS.groups;
    const out = {};
    const ae = ideo.e || 0, as = ideo.s || 0;
    // traição: ação no lado oposto ao do líder (eixo econômico e social separados)
    let betrayal = 0;
    if (Math.abs(L.e) > 20 && U.sign(ae) !== U.sign(L.e) && Math.abs(ae) > 15) betrayal += (Math.abs(ae - L.e) / 200) * (Math.abs(L.e) / 60);
    if (Math.abs(L.s) > 25 && U.sign(as) !== U.sign(L.s) && Math.abs(as) > 15) betrayal += (Math.abs(as - L.s) / 200) * (Math.abs(L.s) / 70);
    betrayal = Math.min(betrayal, 1.6);
    for (const g in G) {
      const align = (ae * G[g].e + as * G[g].s) / 10000; // -1..1
      let d = align * 7 * weight;
      // grupos do lado oposto ao líder dão pouco crédito mesmo quando gostam da ação ("não confio nele")
      const distLeader = Math.hypot(G[g].e - L.e, G[g].s - L.s);
      if (d > 0 && distLeader > 90) d *= 0.55;
      // base ideológica do líder sente traição
      if (betrayal > 0 && distLeader < 85) d -= betrayal * 13 * weight * (1 - distLeader / 105);
      out[g] = d;
    }
    return { groups: out, betrayal: betrayal * weight };
  };

  S.H = H;
})(globalThis.S = globalThis.S || {});
