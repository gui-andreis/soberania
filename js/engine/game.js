// Orquestração: criar partida, executar ações, rodar trimestre, eventos, relatórios.
(function (S) {
  'use strict';
  const U = S.U, H = S.H, C = S.COUNTRIES, P = S.POLITICS;
  const G = {};
  const VERSION = 1;

  // séries registradas mensalmente para os gráficos
  G.SERIES = {
    approval: (st) => st.pol.approval, growth: (st) => st.e.growthYoY, gdppc: (st) => H.gdppc(st), gdp: (st) => st.e.Y,
    infl: (st) => st.e.infl, rate: (st) => st.e.rate, realRate: (st) => st.e.realRate, fx: (st) => st.e.fx, rer: (st) => st.e.rer,
    money: (st) => st.e.money, prices: (st) => st.e.priceIdx, unemp: (st) => st.e.unemp, poverty: (st) => st.e.poverty,
    gini: (st) => st.e.gini, debt: (st) => st.e.debt, primDef: (st) => -st.e.primDef, nominalDef: (st) => -st.e.nominalDef,
    revenue: (st) => st.e.revenue, spending: (st) => U.sum(Object.values(st.e.budget)), interest: (st) => st.e.interestNom,
    tb: (st) => st.e.tb, reserves: (st) => st.e.reserves, confidence: (st) => st.e.confidence, industry: (st) => st.e.industry,
    invest: (st) => st.e.invest, minWage: (st) => st.e.minWage, health: (st) => st.soc.health, education: (st) => st.soc.education,
    infraIdx: (st) => st.soc.infraIdx, security: (st) => st.soc.security, corruption: (st) => st.soc.corruption, press: (st) => st.soc.press,
    environment: (st) => st.soc.environment, protests: (st) => st.pol.protests, stability: (st) => st.pol.stability, legit: (st) => st.pol.legit,
    congress: (st) => st.pol.congress, militaryLoyalty: (st) => st.pol.militaryLoyalty, strength: (st) => S.DIP.powerOf(st.cid, st),
    oil: (st) => st.world.oilEff, commod: (st) => st.world.commodEff, worldGrowth: (st) => st.world.gEff, worldRate: (st) => st.world.rateEff,
    soe: (st) => st.e.soe, open: (st) => st.e.open * 100, pop: (st) => st.e.pop, riskPrem: (st) => st.e.riskPrem, shortage: (st) => st.e.shortage || 0,
    coherence: (st) => st.pol.coherence, gap: (st) => st.e.gap, milPct: (st) => st.e.budget.militar
  };

  G.SECTORS = {
    petroleo: { name: 'Petróleo e gás', soe: 6, rev: 2.5 }, mineracao: { name: 'Mineração', soe: 4, rev: 1.5 },
    energia: { name: 'Energia elétrica', soe: 6, rev: 2 }, telecom: { name: 'Telecomunicações', soe: 4, rev: 1.5, from: 1920 },
    bancos: { name: 'Bancos', soe: 8, rev: 2 }, siderurgia: { name: 'Siderurgia', soe: 4, rev: 1 }, ferrovias: { name: 'Ferrovias', soe: 3, rev: 0.5 },
    aviacao: { name: 'Aviação civil', soe: 2, rev: 0.5, from: 1930 }, correios: { name: 'Correios', soe: 2, rev: 0.3 }, saneamento: { name: 'Água e saneamento', soe: 3, rev: 0.8 }
  };
  const SECTOR_THRESH = { ferrovias: 12, correios: 0, saneamento: 20, energia: 30, petroleo: 32, telecom: 35, siderurgia: 45, aviacao: 45, mineracao: 50, bancos: 60 };
  const SECTOR_OVERRIDE = {
    BR: { petroleo: [[1920, 'privado'], [1953.8, 'estatal']], mineracao: [[1920, 'privado'], [1942, 'estatal'], [1997.3, 'privado']], siderurgia: [[1920, 'privado'], [1941, 'estatal'], [1993, 'privado']], telecom: [[1920, 'privado'], [1972, 'estatal'], [1998.5, 'privado']], aviacao: [[1920, 'privado'], [1969, 'estatal'], [1994, 'privado']], energia: [[1920, 'privado'], [1962, 'estatal'], [2022.5, 'privado']], bancos: [[1920, 'estatal']], ferrovias: [[1920, 'estatal'], [1997, 'privado']] },
    MX: { petroleo: [[1920, 'privado'], [1938.2, 'estatal']], bancos: [[1920, 'privado'], [1982.7, 'estatal'], [1991, 'privado']] },
    VE: { petroleo: [[1920, 'privado'], [1976, 'estatal']], siderurgia: [[1920, 'privado'], [2008, 'estatal']], telecom: [[1920, 'privado'], [2007, 'estatal']] },
    IR: { petroleo: [[1920, 'privado'], [1951.3, 'estatal']] },
    AR: { petroleo: [[1920, 'privado'], [1922, 'estatal'], [1993, 'privado'], [2012.3, 'estatal']], aviacao: [[1920, 'privado'], [1950, 'estatal'], [1990, 'privado'], [2008, 'estatal']], correios: [[1920, 'estatal'], [1997, 'privado'], [2003, 'estatal']] },
    UK: { energia: [[1920, 'privado'], [1948, 'estatal'], [1990, 'privado']], ferrovias: [[1920, 'privado'], [1948, 'estatal'], [1994, 'privado']], siderurgia: [[1920, 'privado'], [1967, 'estatal'], [1988, 'privado']], telecom: [[1920, 'estatal'], [1984, 'privado']], correios: [[1920, 'estatal'], [2013, 'privado']], petroleo: [[1920, 'privado']] },
    US: { petroleo: [[1920, 'privado']], energia: [[1920, 'privado']], telecom: [[1920, 'privado']], ferrovias: [[1920, 'privado']], bancos: [[1920, 'privado']], aviacao: [[1920, 'privado']], saneamento: [[1920, 'estatal']], correios: [[1920, 'estatal']] },
    NG: { petroleo: [[1960, 'privado'], [1971, 'estatal']] }, CL: { mineracao: [[1920, 'privado'], [1971.5, 'estatal']] },
    RU: { petroleo: [[1920, 'estatal'], [1995, 'privado'], [2004, 'estatal']] }, CN: { bancos: [[1920, 'privado'], [1949.8, 'estatal']] }
  };
  const SUFFRAGE = { US: 1920, UK: 1928, CA: 1918, AU: 1902, DE: 1918, BR: 1932, AR: 1947, MX: 1953, CL: 1949, CO: 1954, VE: 1946, FR: 1944, IT: 1946, ES: 1931, PT: 1974, RU: 1917, TR: 1934, IR: 1963, EG: 1956, ZA: 1930, NG: 1960, IN: 1947, CN: 1949, JP: 1945, KR: 1948, ID: 1945 };

  // ---------------- Nova partida ----------------
  G.newGame = function (o) {
    const c = C.byId[o.cid];
    const t = o.year + (o.quarter - 1) / 4;
    const seed = o.seed || (Date.now() % 2147483647);
    const rng = U.makeRng(seed);
    const ideo = P.ideologies[o.ideology];
    const pop = U.interp(c.pop, t), gdppc = U.interp(c.gdppc, t);
    const Y = pop * gdppc / 1000;
    const infl = Math.min(50000, U.interp(c.infl, t, 4));
    const tax = U.interp(c.tax, t, 15);
    const milPct = U.interp(c.milPct, t, 2);
    const urban = U.interp(c.urban, t, 50);
    const gini = U.interp(c.gini, t, 0.4);
    const uStar = C.trait(c, 'uStar', t, 6);
    const unemp = c.unemp ? U.interp(c.unemp, t, uStar) : uStar;
    const histReg = C.histRegime(c, t);
    const regime = o.regime || histReg;
    const fxReg = C.stepTrait(c, 'fx', t, 'flutuante');
    const target = C.stepTrait(c, 'target', t, null);
    const cbIndep = o.cbIndep !== undefined ? o.cbIndep : !!C.stepTrait(c, 'cbIndep', t, false);
    const primDef0 = 0.6;
    // orçamento inicial
    const total = tax + primDef0;
    const civ = Math.max(2, total - milPct);
    const yrs = t - 1920;
    const budget = {
      previdencia: civ * U.clamp(0.06 + yrs * 0.0022 + urban * 0.0008, 0.05, 0.38),
      saude: civ * U.clamp(0.04 + yrs * 0.0012, 0.04, 0.2),
      educacao: civ * 0.13,
      social: civ * U.clamp(0.02 + yrs * 0.0008, 0.02, 0.12),
      infra: civ * 0.12,
      subsidios: civ * 0.04,
      admin: 0,
      militar: milPct
    };
    budget.admin = Math.max(0.5, civ - (budget.previdencia + budget.saude + budget.educacao + budget.social + budget.infra + budget.subsidios));
    const tariff = t < 1930 ? 20 : t < 1950 ? 35 : t < 1990 ? (c.region === 'latam' || c.region === 'asia' || c.region === 'africa' ? 40 : 15) : t < 2000 ? 15 : 9;
    const openT = C.trait(c, 'open', t, 0.3);
    const corruption = C.trait(c, 'corruption', t, 50);

    const st = {
      v: VERSION, seed: seed, rngState: 0, cid: c.id, year: o.year, q: o.quarter, month: o.year * 12 + (o.quarter - 1) * 3,
      startYear: o.year, startQ: o.quarter, turn: 0, difficulty: o.difficulty || 'normal',
      leader: { name: o.leaderName || 'Você', party: o.partyName || 'Partido do Governo', ideoId: o.ideology, e: ideo.e, s: ideo.s },
      regime: regime, cbIndep: cbIndep, inflTarget: target, fxRegime: fxReg, rateMode: 'auto',
      e: {
        Y: Y, Ypot: Y, gap: 0, gpot: 2, tfp: 0, pop: pop, popBase: pop, popAdj: 1,
        infl: infl, inflL: Math.log(1 + infl / 100), inflExp: infl, inflExpL: Math.log(1 + infl / 100), inflMemory: Math.min(infl, 3000), inflExpShockL: 0,
        rate: 0, rateManual: 0, realRate: 0, effRate: 0, riskPrem: 1.5, cred: 0.3,
        fx: 100, rer: 100, depHist: [], fxDep12: 0, reserves: H_reserves(c, t), tb: 0, tbShift: 0,
        debt: U.interp(c.debt, t, 40), extShare: (gdppc > 25000 || c.id === 'US') ? 0.08 : 0.3,
        primDef: primDef0, primDefEMA: primDef0, revenue: tax, tax: tax, budget: budget,
        taxes: { renda: 0, consumo: 0, empresas: 0, comercio: tariff, exportacao: (c.id === 'AR' && t >= 2002 && t < 2024) ? 25 : 0, fortunas: 0, financeiro: 0 },
        tariffRef: tariff, monetize: 0, monEff: 0, money: 100, priceIdx: 100,
        unemp: unemp, u0: unemp, uStarShift: 0, minWage: 100, wageIndex: 0.3,
        poverty: 0, povShift: 0, povCal: 1, gini: gini, gini0: gini, giniShift: 0,
        confidence: 50, confShift: 0, industry: 100, indShift: 0, gapPrevInd: 0, invest: 0, invest0: 0, investShift: 0,
        soe: U.interp(c.soe, t, 15), open: openT, shortage: 0, growthYoY: 0, Yhist: [], Yq: [],
        socialRef: budget.social, subsRef: budget.subsidios, milRef: budget.militar, adminRef: budget.admin, prevRef: budget.previdencia, eduRef: budget.educacao,
        debt0: 0, pov0: 0, corr0: corruption, sec0: 0
      },
      soc: { health: 50, education: 40, infraIdx: 40, security: 60, corruption: corruption, press: P.regimes[regime].press, environment: t < 1960 ? 75 : 65, healthShift: 0, eduShift: 0, infraShift: 0, secShift: 0 },
      pol: {
        approval: 50, groups: {}, base: {}, base0: {}, shock: {}, weights: P.groupWeights(urban, C.trait(c, 'religiosity', t, 50), o.year),
        legit: 50, stability: 60, congress: 45, congressBase: 42, militaryLoyalty: 60, protests: 15, coherence: 75,
        capital: 4, capitalMax: 3, termsServed: 1, termStartMonth: o.year * 12 + (o.quarter - 1) * 3, nextElection: null, histRegime: histReg
      },
      mil: { bonus: 0, warEx: 0, wars: [], nukes: !!(c.t.nukes && t >= c.t.nukes), nukeProgress: 0, tech: 0 },
      dip: { rel: {}, orgs: {}, sanctionedBy: [], deals: {}, alliances: {} },
      sectors: {}, flags: {}, mods: [], pending: [], queue: [], pendingEvents: [], fired: {}, cooldown: {},
      world: { shock: {} }, hist: { start: 0, series: {} }, mandates: [], reports: [], timeline: [], chat: [],
      stats: { deaths: 0, warDeaths: 0, elections: [], actions: 0, betrayals: 0 }, over: false
    };
    st.rngState = seed;
    // investimento base
    st.e.invest0 = U.clamp(14 + (c.id === 'CN' && t > 1990 ? 22 : 0) + (c.id === 'KR' && t > 1970 ? 12 : 0) + (c.id === 'JP' && t > 1955 && t < 1995 ? 12 : 0) + (C.trait(c, 'planned', t, 0) * 10) + (gdppc > 20000 ? 5 : 0), 8, 45);
    st.e.invest = st.e.invest0;
    // regime cambial coerente
    if (st.fxRegime === 'euro' && t < 1999) st.fxRegime = 'fixo';
    if ((st.fxRegime === 'fixo' || st.fxRegime === 'ouro') && infl > 40) st.fxRegime = 'banda';
    st.e.resNormal = st.e.reserves;
    // juros iniciais
    const neutral = C.trait(c, 'neutralReal', t, 2.5);
    st.e.rate = Math.max(0.5, neutral + infl * (infl > 200 ? 1.02 : 1) + (target != null ? 0.5 * (infl - target) : 0));
    if (C.trait(c, 'planned', t, 0) > 0.5) st.e.rate = 3;
    st.e.rateManual = Math.round(st.e.rate * 4) / 4;
    st.e.effRate = st.e.rate;
    st.e.realRate = neutral;
    // grupos
    for (const g of P.groupIds) {
      let a = P.initialGroupApproval(g, ideo);
      if (regime === 'militar' && g === 'militares') a += 18;
      if (!P.regimes[regime].democracy && g === 'estudantes') a -= 10;
      if (regime === 'teocracia' && g === 'religiosos') a += 20;
      st.pol.groups[g] = a; st.pol.base[g] = a; st.pol.base0[g] = a; st.pol.shock[g] = 0;
    }
    let a = 0; for (const g in st.pol.groups) a += st.pol.groups[g] * st.pol.weights[g];
    st.pol.approval = a;
    st.pol.legit = P.regimes[regime].legitBase + (regime === histReg ? 10 : -15);
    st.pol.militaryLoyalty = U.clamp(st.pol.groups.militares + (regime === 'militar' ? 15 : 0), 0, 100);
    if (P.regimes[regime].elections) S.POL.scheduleElection(st, true);
    if (!P.regimes[regime].democracy) st.pol.congress = 90;
    // setores
    for (const s in G.SECTORS) {
      const ov = SECTOR_OVERRIDE[c.id] && SECTOR_OVERRIDE[c.id][s];
      st.sectors[s] = ov ? U.step(ov, t, 'privado') : (st.e.soe >= SECTOR_THRESH[s] ? 'estatal' : 'privado');
    }
    // organizações e relações
    for (const org in S.WORLD.orgs) if (S.WORLD.isMember(c.id, org, t)) st.dip.orgs[org] = true;
    for (const other of S.DIP.others(st)) st.dip.rel[other] = S.DIP.initialRelation(c.id, other, t);
    // flags históricas
    if (SUFFRAGE[c.id] && t >= SUFFRAGE[c.id]) st.flags.votoFeminino = true;
    if (C.trait(c, 'apartheid', t, 0) > 0.5) st.flags.apartheid = true;
    if (t >= 1945 && st.dip.orgs.fmi) st.flags.fmiMembro = true;
    if (C.trait(c, 'colonial', t, 0) > 0.3) st.flags.imperio = true;
    if (st.fxRegime === 'controle') st.flags.controleCapitais = true;
    if (c.id === 'AR' && t >= 1991.25 && t < 2002) st.fxRegime = 'conversibilidade';
    // mundo inicial
    const rng2 = U.makeRng(seed + 1);
    S.SIM.updateWorld(st, rng2);
    st.world.frontier = U.interp(S.WORLD.frontier, Math.min(t, 2025));
    // indicadores sociais iniciais = alvo de longo prazo
    const lg = Math.log10(Math.max(300, gdppc));
    st.soc.health = U.clamp(20 * lg - 45 + budget.saude * 4.5 + yrs * 0.16, 3, 99);
    st.soc.education = U.clamp(20 * lg - 52 + budget.educacao * 3.5 + yrs * 0.1, 3, 99);
    st.soc.infraIdx = U.clamp(20 * lg - 42 + budget.infra * 6, 3, 99);
    // pobreza calibrada
    const basePov = 100 * (1 - U.logistic((Math.log(gdppc) - Math.log(4000)) * 1.6)) * Math.pow(gini / 0.38, 1.3);
    if (c.poverty) st.e.povCal = U.clamp(U.interp(c.poverty, t) / basePov, 0.3, 3);
    st.e.poverty = U.clamp(basePov * st.e.povCal, 0.5, 97);
    st.e.pov0 = st.e.poverty;
    st.e.debt0 = st.e.debt;
    st.soc.security = U.clamp(72 - 0.9 * (unemp - 5) - 0.35 * (st.e.poverty - 15) - 0.2 * (corruption - 40), 5, 95);
    st.e.sec0 = st.soc.security;
    st.e.oilRef = st.world.oilEff; st.e.commodRef = st.world.commodEff;
    // Calibração: o crescimento potencial "neutro" acompanha a média histórica dos 10 anos seguintes
    // (fatores estruturais da nossa linha do tempo); o ajuste decai e suas decisões passam a dominar.
    if (t <= 2015) {
      const y2 = Math.min(t + 10, 2025);
      const hg = (Math.pow((U.interp(c.gdppc, y2) * U.interp(c.pop, y2)) / (gdppc * pop), 1 / (y2 - t)) - 1) * 100;
      const popJump = Math.abs(U.interp(c.pop, y2) / pop - 1) > 0.3;
      st.e.gpot = S.SIM.potentialGrowth(st);
      if (!popJump && isFinite(hg)) st.e.tfpCal = U.clamp(hg - st.e.gpot + 0.4, -4, 5);
    }
    // pré-histórico para os gráficos
    G.prefillHistory(st, c, t);
    st.mandates.push({ start: st.month, label: st.leader.name });
    st.timeline.push({ y: st.year, q: st.q, kind: 'inicio', title: 'Você assume o governo', text: st.leader.name + ' (' + ideo.name + ') assume ' + C.nameAt(c, t) + ' sob ' + P.regimes[regime].name + '.' });
    if (regime !== histReg) st.timeline.push({ y: st.year, q: st.q, kind: 'regime', title: 'Linha do tempo alternativa', text: 'Regime histórico era ' + P.regimes[histReg].name + '. Legitimidade inicial reduzida.' });
    st.rngState = U.makeRng(seed).getState();
    return st;
  };

  function H_reserves(c, t) {
    let r = 4;
    if (c.id === 'CN' && t > 2005) r = 22; if (c.id === 'JP' && t > 1990) r = 14; if (c.id === 'KR' && t > 1999) r = 8;
    if (c.id === 'BR' && t > 2008) r = 16; if (c.id === 'RU' && t > 2005) r = 18; if (c.id === 'US') r = 2; if (c.id === 'AR' && t > 2018) r = 2.5;
    if (c.id === 'VE' && t > 2014) r = 1.5; if (c.id === 'US' && t < 1971) r = 14; if (c.id === 'MX' && t >= 1994 && t < 1995) r = 1.5;
    return r;
  }

  // gera ~6 anos de histórico mensal a partir das séries históricas, para os gráficos começarem com contexto
  G.prefillHistory = function (st, c, t0) {
    const months = 72;
    const keys = Object.keys(G.SERIES);
    for (const k of keys) st.hist.series[k] = [];
    const startM = st.month - months;
    st.hist.start = startM;
    const rng = U.makeRng(st.seed + 99);
    let prices = 100, money = 100, fx = 100;
    const pts = [];
    for (let i = 0; i < months; i++) {
      const tt = (startM + i) / 12;
      if (tt < c.from) { pts.push(null); continue; }
      const infl = Math.min(50000, U.interp(c.infl, tt, 4));
      const gdppc = U.interp(c.gdppc, tt), pop = U.interp(c.pop, tt);
      const gdppcPrev = U.interp(c.gdppc, tt - 1);
      const popPrev = U.interp(c.pop, tt - 1);
      const popG = Math.abs(pop / popPrev - 1) > 0.06 ? 0.01 : pop / popPrev - 1;
      pts.push({ infl, gdppc, pop, growth: ((gdppc / gdppcPrev) * (1 + popG) - 1) * 100, debt: U.interp(c.debt, tt, 40), unemp: c.unemp ? U.interp(c.unemp, tt) : st.e.u0 });
    }
    // preços/moeda retroativos (normalizados para terminar em 100)
    const fwd = [];
    for (let i = 0; i < months; i++) {
      const p = pts[i];
      if (p) { prices *= Math.pow(1 + p.infl / 100, 1 / 12); money *= Math.pow(1 + (p.infl + 2) / 100, 1 / 12); fx *= Math.pow(1 + Math.max(-5, p.infl - 3) / 100, 1 / 12); }
      fwd.push([prices, money, fx]);
    }
    const last = fwd[fwd.length - 1];
    for (let i = 0; i < months; i++) {
      const p = pts[i];
      for (const k of keys) {
        let v = null;
        if (p) {
          const noise = 1 + U.gauss(rng) * 0.01;
          switch (k) {
            case 'infl': v = p.infl; break;
            case 'growth': v = p.growth + U.gauss(rng) * 0.3; break;
            case 'gdppc': v = p.gdppc; break;
            case 'gdp': v = p.gdppc * p.pop / 1000; break;
            case 'debt': v = p.debt; break;
            case 'unemp': v = p.unemp * noise; break;
            case 'prices': v = fwd[i][0] / last[0] * 100; break;
            case 'money': v = fwd[i][1] / last[1] * 100; break;
            case 'fx': v = fwd[i][2] / last[2] * 100; break;
            case 'pop': v = p.pop; break;
            case 'oil': v = U.interp(S.WORLD.oil, (startM + i) / 12); break;
            case 'commod': v = U.interp(S.WORLD.commod, (startM + i) / 12); break;
            case 'worldGrowth': v = U.interp(S.WORLD.growth, (startM + i) / 12); break;
            case 'worldRate': v = U.interp(S.WORLD.rate, (startM + i) / 12); break;
            default: v = null;
          }
        }
        st.hist.series[k].push(v);
      }
    }
    // líderes históricos como "governos anteriores"
    if (c.l) {
      for (let i = 0; i < months; i++) {
        const tt = (startM + i) / 12;
        const L = C.histLeader(c, tt);
        const prev = st.mandates[st.mandates.length - 1];
        if (L && (!prev || prev.label !== L[1])) st.mandates.push({ start: startM + i, label: L[1], hist: true });
      }
    } else st.mandates.push({ start: startM, label: 'Governos anteriores', hist: true });
    // preenche Yhist com crescimento histórico
    const g0 = pts[months - 1] ? pts[months - 1].growth : 2;
    for (let i = 12; i >= 0; i--) st.e.Yhist.push(st.e.Y / Math.pow(1 + g0 / 100, i / 12));
    st.e.growthYoY = g0;
    st.e.gap = U.clamp((g0 - 2.5) * 0.4, -6, 4);
    st.e.Ypot = st.e.Y / (1 + st.e.gap / 100);
  };

  G.record = function (st) {
    for (const k in G.SERIES) {
      if (!st.hist.series[k]) st.hist.series[k] = [];
      let v = G.SERIES[k](st);
      if (typeof v === 'number' && !isFinite(v)) v = null;
      st.hist.series[k].push(v);
    }
  };

  // ---------------- Ações ----------------
  G.actionStatus = function (st, a, target) {
    if (a.req) {
      const r = a.req(st, target);
      if (r !== true && r !== undefined) return { ok: false, why: typeof r === 'string' ? r : 'Indisponível neste contexto' };
    }
    if (a.minYear && H.t(st) < a.minYear) return { ok: false, why: 'Disponível a partir de ' + a.minYear };
    if (a.maxYear && H.t(st) >= a.maxYear) return { ok: false, why: 'Não faz sentido após ' + a.maxYear };
    if (a.dem && !H.dem(st)) return { ok: false, why: 'Exige regime democrático' };
    if (a.auth && H.dem(st)) return { ok: false, why: 'Exige regime autoritário' };
    if (a.once && st.flags['done_' + a.id]) return { ok: false, why: 'Já realizado' };
    const cd = st.cooldown[a.id];
    if (cd && st.turn < cd) return { ok: false, why: 'Aguarde ' + (cd - st.turn) + ' trimestre(s)' };
    const cost = G.actionCost(st, a);
    const queued = st.queue.reduce((s, q) => s + q.cost, 0);
    if (st.pol.capital - queued < cost) return { ok: false, why: 'Capital político insuficiente', capital: true };
    if (st.queue.some((q) => q.id === a.id && (q.target || null) === (target || null))) return { ok: false, why: 'Já está na fila' };
    return { ok: true };
  };
  G.actionCost = (st, a) => a.cost === undefined ? 1 : a.cost;

  G.congressPassProb = function (st, a) {
    if (!a.congress || !H.dem(st)) return 1;
    const p = st.pol;
    return U.clamp(U.logistic((p.congress - 30 - a.congress * 30) / 9 + (p.approval - 45) / 25), 0.03, 0.98);
  };

  G.outcomesFor = function (st, a, target) {
    if (!a.outcomes) return null;
    const list = a.outcomes(st, target);
    return list ? U.normalizeOutcomes(list) : null;
  };

  G.queueAction = function (st, a, target) {
    const s = G.actionStatus(st, a, target);
    if (!s.ok) return s;
    st.queue.push({ id: a.id, target: target || null, cost: G.actionCost(st, a) });
    return { ok: true };
  };
  G.unqueue = function (st, idx) { st.queue.splice(idx, 1); };

  G.executeAction = function (st, a, target, rng, report) {
    const entry = { id: a.id, name: a.name + (target ? ' — ' + H.cname(target, st) : ''), lines: [], groups: {} };
    st.pol.capital -= G.actionCost(st, a);
    st.stats.actions++;
    if (a.cooldown) st.cooldown[a.id] = st.turn + a.cooldown;
    if (a.once) st.flags['done_' + a.id] = true;
    // Congresso
    const pp = G.congressPassProb(st, a);
    if (pp < 1) {
      if (rng() > pp) {
        entry.lines.push('❌ Rejeitada pelo Congresso (chance de aprovação era ' + Math.round(pp * 100) + '%).');
        H.applyEffects(st, { approval: -1.5, congress: -2 }, 1, a.name);
        entry.failed = true;
        report.actions.push(entry);
        return;
      }
      entry.lines.push('✅ Aprovada no Congresso (chance era ' + Math.round(pp * 100) + '%).');
    }
    const before = snapshotGroups(st);
    // ideologia
    if (a.ideo) {
      const r = H.ideologyReaction(st, a.ideo, a.ideoWeight || 1);
      for (const g in r.groups) H.groupShock(st, g, r.groups[g]);
      // parte da reação é permanente (muda a base)
      for (const g in r.groups) st.pol.base[g] = U.clamp(st.pol.base[g] + r.groups[g] * 0.25, 0, 100);
      if (r.betrayal > 0.15) {
        st.pol.coherence = U.clamp(st.pol.coherence - r.betrayal * 14, 0, 100);
        st.stats.betrayals++;
        entry.lines.push('⚠️ Sua base ideológica (' + P.ideologies[st.leader.ideoId].name + ') viu essa medida como contraditória com o programa que te elegeu.');
      }
    }
    if (a.groups) H.applyEffects(st, { groups: typeof a.groups === 'function' ? a.groups(st, target) : a.groups }, 1, a.name);
    const eff = typeof a.eff === 'function' ? a.eff(st, target) : a.eff;
    if (eff) H.applyEffects(st, eff, 1, a.name);
    if (a.text) entry.lines.push(typeof a.text === 'function' ? a.text(st, target) : a.text);
    // desfechos probabilísticos
    if (a.outcomes) {
      const outs = G.outcomesFor(st, a, target);
      const pick = U.pickWeighted(rng, outs);
      entry.lines.push('🎲 Resultado: ' + pick.label + ' (chance era ' + Math.round(pick.p * 100) + '%).');
      if (pick.eff) H.applyEffects(st, typeof pick.eff === 'function' ? pick.eff(st, target) : pick.eff, 1, a.name);
      if (pick.text) entry.lines.push(typeof pick.text === 'function' ? pick.text(st, target) : pick.text);
      if (pick.after) pick.after(st, target, rng, report);
      entry.outcome = pick.key;
    }
    if (a.after) a.after(st, target, rng, report);
    const after = snapshotGroups(st);
    for (const g in after) entry.groups[g] = after[g] - before[g];
    report.actions.push(entry);
    st.timeline.push({ y: st.year, q: st.q, kind: 'acao', title: entry.name, text: entry.lines.join(' ') });
  };
  function snapshotGroups(st) {
    const o = {}; for (const g in st.pol.groups) o[g] = st.pol.groups[g] + (st.pol.shock[g] || 0) * 0.22; return o;
  }

  // ---------------- Eventos ----------------
  G.resolveEventChoice = function (st, idx, choiceIdx, rng) {
    const pe = st.pendingEvents[idx];
    if (!pe) return null;
    const ev = S.EVENTS.byId[pe.id];
    const ch = ev.choices[choiceIdx];
    const res = { title: pe.title || ev.title, choice: typeof ch.label === 'function' ? ch.label(st) : ch.label, lines: [] };
    if (ch.ideo) {
      const r = H.ideologyReaction(st, typeof ch.ideo === 'function' ? ch.ideo(st) : ch.ideo, 0.7);
      for (const g in r.groups) H.groupShock(st, g, r.groups[g]);
      if (r.betrayal > 0.2) st.pol.coherence -= r.betrayal * 8;
    }
    if (ch.eff) H.applyEffects(st, typeof ch.eff === 'function' ? ch.eff(st) : ch.eff, 1, ev.title);
    if (ch.outcomes) {
      const outs = U.normalizeOutcomes(ch.outcomes(st));
      const pick = U.pickWeighted(rng, outs);
      res.lines.push('🎲 ' + pick.label + ' (chance era ' + Math.round(pick.p * 100) + '%)');
      if (pick.eff) H.applyEffects(st, typeof pick.eff === 'function' ? pick.eff(st) : pick.eff, 1, ev.title);
      if (pick.text) res.lines.push(typeof pick.text === 'function' ? pick.text(st) : pick.text);
    }
    if (ch.text) res.lines.push(typeof ch.text === 'function' ? ch.text(st) : ch.text);
    st.pendingEvents.splice(idx, 1);
    st.timeline.push({ y: st.year, q: st.q, kind: 'escolha', title: res.title, text: 'Decisão: ' + res.choice + '. ' + res.lines.join(' ') });
    st.lastChoices = st.lastChoices || [];
    st.lastChoices.push(res);
    return res;
  };

  // ---------------- Turno ----------------
  G.endTurn = function (st) {
    if (st.over) return null;
    const rng = U.makeRng(st.rngState || st.seed);
    const report = { y: st.year, q: st.q, actions: [], events: [], politics: [], before: G.snapshot(st), choices: st.lastChoices || [] };
    st.lastChoices = [];
    // escolhas pendentes não resolvidas: escolhe a primeira automaticamente
    while (st.pendingEvents.length) {
      const r = G.resolveEventChoice(st, 0, 0, rng);
      if (r) { r.auto = true; report.choices.push(r); }
    }
    // ações
    const q = st.queue.slice(); st.queue = [];
    for (const item of q) {
      const a = S.ACTIONS.byId[item.id];
      if (a) G.executeAction(st, a, item.target, rng, report);
    }
    // 3 meses
    const pol = [];
    for (let m = 0; m < 3; m++) {
      st.month++;
      S.SIM.month(st, rng);
      S.DIP.warMonth(st, rng, pol);
      S.POL.monthly(st, rng);
      G.record(st);
    }
    st.turn++;
    st.q++; if (st.q > 4) { st.q = 1; st.year++; }
    // efeitos defasados
    const due = st.pending.filter((p) => p.at <= st.turn);
    st.pending = st.pending.filter((p) => p.at > st.turn);
    for (const d of due) {
      H.applyEffects(st, d.eff, 1, d.src);
      if (d.note) report.politics.push({ sev: 'info', title: 'Efeito de longo prazo: ' + d.src, text: d.note });
    }
    // flags temporárias
    if (st.flags.pressaoBC && rng() < 0.5) delete st.flags.pressaoBC;
    // política trimestral (eleições etc.)
    S.POL.quarterly(st, rng, pol);
    report.politics.push(...pol);
    // eventos
    const evs = S.EVENTS.roll(st, rng);
    for (const ev of evs) report.events.push(ev);
    // fim de jogo?
    if (st.pendingGameOver) {
      st.over = true;
      st.gameOver = st.pendingGameOver;
      st.timeline.push({ y: st.year, q: st.q, kind: 'fim', title: 'Fim do governo', text: st.gameOver.text });
    }
    report.after = G.snapshot(st);
    report.summary = G.buildSummary(st, report);
    st.reports.push(report);
    if (st.reports.length > 80) st.reports.shift();
    st.rngState = rng.getState();
    return report;
  };

  G.snapshot = function (st) {
    const o = {};
    for (const k of ['approval', 'growth', 'infl', 'rate', 'unemp', 'poverty', 'debt', 'primDef', 'fx', 'reserves', 'confidence', 'stability', 'protests', 'congress', 'legit', 'gdppc', 'tb', 'militaryLoyalty']) o[k] = G.SERIES[k](st);
    o.groups = Object.assign({}, st.pol.groups);
    return o;
  };

  // Narrativa do relatório (sem IA): compara antes/depois e atribui causas prováveis
  G.buildSummary = function (st, rep) {
    const b = rep.before, a = rep.after, lines = [];
    const d = (k) => a[k] - b[k];
    const f = U.fmt, fs = U.fmtSigned;
    lines.push('A economia ' + (a.growth > 3 ? 'cresce com força' : a.growth > 0.5 ? 'cresce' : a.growth > -1 ? 'está estagnada' : 'está em recessão') + ' (' + fs(a.growth, 1) + '% em 12 meses).');
    if (Math.abs(d('infl')) > 0.3 || a.infl > 10) lines.push('Inflação ' + (d('infl') > 0 ? 'subiu' : 'caiu') + ' para ' + f(a.infl, 1) + '% ao ano (' + fs(d('infl'), 1) + ' p.p.).');
    if (Math.abs(d('rate')) > 0.25) lines.push('Juro básico ' + (d('rate') > 0 ? 'subiu' : 'caiu') + ' para ' + f(a.rate, 2) + '% (' + (st.cbIndep ? 'decisão do Banco Central autônomo' : 'decisão do governo/BC') + ').');
    if (Math.abs(d('unemp')) > 0.2) lines.push('Desemprego ' + (d('unemp') > 0 ? 'subiu' : 'caiu') + ' para ' + f(a.unemp, 1) + '%.');
    if (Math.abs(d('fx')) > 3) lines.push('A moeda ' + (d('fx') > 0 ? 'se desvalorizou ' : 'se valorizou ') + f(Math.abs(d('fx') / b.fx * 100), 1) + '% frente ao dólar.');
    if (Math.abs(d('debt')) > 1) lines.push('Dívida pública foi a ' + f(a.debt, 1) + '% do PIB (' + fs(d('debt'), 1) + ' p.p.).');
    if (a.reserves < 2.5) lines.push('⚠️ Reservas internacionais críticas: ' + f(a.reserves, 1) + ' meses de importação.');
    lines.push('Aprovação: ' + f(a.approval, 1) + '% (' + fs(d('approval'), 1) + ').');
    // grupos que mais mudaram
    const gd = Object.keys(a.groups).map((g) => [g, a.groups[g] - b.groups[g]]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 3);
    const gtxt = gd.filter((x) => Math.abs(x[1]) > 1.5).map((x) => P.groups[x[0]].name + ' ' + fs(x[1], 0));
    if (gtxt.length) lines.push('Maiores mudanças de humor: ' + gtxt.join(', ') + '.');
    // causas
    const causes = [];
    if (st.e.realRate - H.trait(st, 'neutralReal', 2.5) > 3) causes.push('juros reais bem acima do neutro estão freando a atividade');
    if (st.e.realRate - H.trait(st, 'neutralReal', 2.5) < -3) causes.push('juros reais muito abaixo do neutro estimulam a demanda mas pressionam a inflação');
    if (st.e.primDef > 3) causes.push('déficit primário elevado (' + f(st.e.primDef, 1) + '% do PIB) preocupa credores');
    if (st.e.monEff > 0.2) causes.push('o Tesouro está sendo financiado com emissão de moeda — combustível para inflação');
    if (st.world.gEff < 1) causes.push('a economia mundial está fraca (' + f(st.world.gEff, 1) + '%)');
    if (st.world.commodEff > 110 && H.commodity(st) > 0.4) causes.push('preços de commodities altos favorecem as exportações');
    if (st.world.commodEff < 75 && H.commodity(st) > 0.4) causes.push('preços de commodities baixos derrubam as exportações');
    if (st.mil.wars.length) causes.push('o esforço de guerra drena recursos e vidas');
    if (st.e.shortage > 15) causes.push('há escassez de produtos nas prateleiras');
    if (causes.length) lines.push('Fatores: ' + causes.join('; ') + '.');
    return lines;
  };

  G.saveKey = 'soberania.saves';
  S.GAME = G;
})(globalThis.S = globalThis.S || {});
