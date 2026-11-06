// Modelo macroeconômico mensal. Inspirado em modelos novo-keynesianos simples (curva IS, Phillips com inércia,
// regra de Taylor), dinâmica de dívida r-g, paridade de juros com prêmio de risco e convergência de renda (Solow).
(function (S) {
  'use strict';
  const U = S.U, H = S.H, W = S.WORLD;
  const SIM = {};

  const L = (pct) => Math.log(1 + Math.max(-95, pct) / 100); // % -> log
  const P = (l) => (Math.exp(l) - 1) * 100; // log -> %

  // ---------------- Mundo ----------------
  SIM.updateWorld = function (st, rng) {
    const t = st.year + (st.month % 12) / 12;
    const w = st.world;
    const shock = w.shock;
    if (t <= W.LAST_YEAR + 0.99) {
      w.growth = U.interp(W.growth, t);
      w.oil = U.interp(W.oil, t);
      w.commod = U.interp(W.commod, t);
      w.rate = U.interp(W.rate, t);
      w.infl = U.interp(W.infl, t);
      w.trade = U.interp(W.tradeFactor, t);
      w.frontier = U.interp(W.frontier, t);
    } else {
      // Futuro: processo estocástico com reversão à média
      w.growth += 0.08 * (3.0 - w.growth) + U.gauss(rng) * 0.12;
      w.oil = Math.max(20, w.oil * Math.exp(0.02 * Math.log(72 / w.oil) + U.gauss(rng) * 0.045));
      w.commod = Math.max(40, w.commod * Math.exp(0.02 * Math.log(100 / w.commod) + U.gauss(rng) * 0.03));
      w.infl += 0.06 * (2.6 - w.infl) + U.gauss(rng) * 0.08;
      const taylor = 1 + w.infl + 0.5 * (w.infl - 2) + 0.4 * (w.growth - 3);
      w.rate += 0.1 * (Math.max(0, taylor) - w.rate);
      w.trade += 0.02 * (1 - w.trade);
      w.frontier *= 1 + (1.3 + (shock.tfp || 0)) / 1200;
    }
    // choques globais (eventos) com decaimento
    w.gEff = w.growth + (shock.growth || 0);
    w.oilEff = Math.max(10, w.oil * (1 + (shock.oil || 0) / 100));
    w.commodEff = Math.max(20, w.commod * (1 + (shock.commod || 0) / 100));
    w.rateEff = Math.max(0, w.rate + (shock.rate || 0));
    w.inflEff = w.infl + (shock.infl || 0);
    w.tradeEff = Math.max(0.2, w.trade * (1 + (shock.trade || 0) / 100));
    for (const k in shock) { shock[k] *= 0.93; if (Math.abs(shock[k]) < 0.01) delete shock[k]; }
  };

  // ---------------- Potencial ----------------
  SIM.frontierTfp = function (year) {
    if (year < 1930) return 1.6; if (year < 1940) return 1.0; if (year < 1950) return 1.6;
    if (year < 1974) return 2.4; if (year < 1995) return 1.4; if (year < 2006) return 1.7; return 1.2;
  };

  SIM.potentialGrowth = function (st) {
    const c = H.country(st), e = st.e, t = st.year + (st.month % 12) / 12;
    const popNow = U.interp(c.pop, t), popNext = U.interp(c.pop, t + 1);
    let popG = (popNext / popNow - 1) * 100;
    if (Math.abs(popG) > 6) popG = 0; // saltos de território (reunificação, fim da URSS)
    const gdppc = H.gdppc(st);
    const ratio = Math.max(1, st.world.frontier / gdppc);
    const inst = H.trait(st, 'inst', 50) + (st.pol.instShift || 0);
    const planned = H.trait(st, 'planned', 0);
    const qual = U.clamp(
      (inst / 100) * 0.4 + (st.soc.education / 100) * 0.4 + (e.invest / 25) * 0.45 + Math.min(1, e.open / 0.5) * 0.2
      + (st.soc.infraIdx / 100) * 0.2 - planned * 0.25 - Math.max(0, st.soc.corruption - 55) * 0.008, 0.05, 1.5);
    const conv = 0.017 * Math.log(ratio) * Math.max(0, qual - 0.3);
    e.qual = qual;
    const aging = H.trait(st, 'aging', 0) * 0.8;
    const soeDrag = Math.max(0, e.soe - 40) * 0.012;
    const war = st.mil.wars.length ? -0.5 : 0;
    const sanc = st.dip.sanctionedBy.length ? -0.4 * st.dip.sanctionedBy.length : 0;
    // conv está em fração: 0.021*ln*qual -> ex.: 0.03 = 3 p.p.
    const g = popG * 0.75 + SIM.frontierTfp(t) * U.clamp(qual, 0.3, 1) + conv * 100 + e.tfp + (e.tfpCal || 0) - aging - soeDrag + war + sanc;
    return U.clamp(g, -6, 12);
  };

  // ---------------- Passo mensal ----------------
  SIM.month = function (st, rng) {
    const e = st.e, soc = st.soc, w = st.world, c = H.country(st);
    const year = st.year, t = year + (st.month % 12) / 12;
    SIM.updateWorld(st, rng);

    // efeitos contínuos (mods)
    for (const m of st.mods) { if (m.months > 0) { H.applyEffects(st, m.per, 1, m.src); m.months--; } }
    st.mods = st.mods.filter((m) => m.months > 0);

    const inertia = U.clamp(H.trait(st, 'inertia', 0.5) + (e.indexation || 0), 0.05, 0.97);
    const neutral = H.trait(st, 'neutralReal', 2.5) + Math.max(0, (e.riskPrem || 1) - 2) * 0.3;
    const planned = H.trait(st, 'planned', 0);
    const commodity = H.commodity(st), oilT = H.trait(st, 'oil', 0);
    const fxPass = H.trait(st, 'fxPass', 0.2);

    // ---- Fiscal ----
    const spending = U.sum(Object.values(e.budget));
    const taxEff = e.tax * (1 + 0.012 * e.gap) * (1 - Math.min(0.15, Math.max(0, Math.log10(Math.max(1, e.infl)) - 1.3) * 0.08)) // efeito Olivera-Tanzi
      + (e.taxes.exportacao || 0) * commodity * 0.06 + (e.taxes.comercio || 0) * e.open * 0.03 * w.tradeEff;
    e.revenue = taxEff + (oilT > 0 && st.sectors.petroleo === 'estatal' ? oilT * (w.oilEff / 70) * 3 : 0);
    e.primDef = spending - e.revenue;
    e.primDefEMA += (e.primDef - e.primDefEMA) / 30;

    // prêmio de risco
    const repression = (year < 1980 && (H.isFixed(st) || st.flags.controleCapitais || st.fxRegime === 'controle')) ? 0.6 : 0; // repressão financeira (Bretton Woods)
    const debtTol = (H.advanced(st) ? 95 : 55) + (e.extShare < 0.15 ? 25 : 0) + (H.trait(st, 'reserveCurrency', 0) ? 30 : 0);
    e.debtTol = debtTol;
    const rpTarget = U.clamp(0.6 + Math.max(0, e.debt - debtTol) * 0.06 * (1 - repression) + Math.max(0, e.primDef) * 0.55 + (st.flags.default ? 9 : 0)
      + (50 - e.confidence) * 0.06 + (e.reserves < 3 ? (3 - e.reserves) * 0.8 : 0) + (st.dip.sanctionedBy.length ? 2 : 0)
      - (H.trait(st, 'reserveCurrency', 0) ? 0.8 : 0), 0.2, 30);
    e.riskPrem += (rpTarget - e.riskPrem) * 0.15;

    // monetização: explícita (flag) ou forçada (sem acesso a mercado)
    let mon = e.monetize || 0;
    if ((st.flags.default || e.riskPrem > 14) && !st.flags.fmi && e.primDef > 0) mon = Math.max(mon, 0.6);
    if (H.isFixed(st) && st.fxRegime !== 'ouro') mon *= 0.5;
    e.monEff = mon;

    // ---- Política monetária ----
    const target = st.inflTarget;
    const cred = U.clamp(0.15 + (st.cbIndep ? 0.3 : 0) + (target != null ? 0.15 : 0) + (e.confidence - 50) / 250 - Math.min(0.35, Math.max(0, e.inflMemory - 15) / 200) + (st.flags.credShift || 0) - mon * 0.4, 0.02, 0.9);
    e.cred = cred;
    const anchor = target != null ? target : (H.isFixed(st) ? w.inflEff : Math.min(e.infl, Math.max(3, w.inflEff + 1)));
    // expectativa: combinação de âncora e inflação passada (em log, para lidar com hiperinflação)
    const lExpT = cred * L(anchor) + (1 - cred) * L(e.infl);
    e.inflExpL += (lExpT - e.inflExpL) * 0.25 + (e.inflExpShockL || 0);
    e.inflExpShockL = 0;
    e.inflExp = P(e.inflExpL);

    let rateTarget;
    if (st.fxRegime === 'euro' || st.fxRegime === 'dolarizado') rateTarget = Math.max(0, w.rateEff + (st.fxRegime === 'euro' ? -0.5 : 0)) + Math.min(3, e.riskPrem * 0.15);
    else if (st.fxRegime === 'conversibilidade' || st.fxRegime === 'ouro') rateTarget = w.rateEff + e.riskPrem + Math.max(0, 3 - e.reserves) * 1.5;
    else {
      const tgt = target != null ? target : Math.max(2, Math.min(e.infl, w.inflEff + 2));
      rateTarget = neutral + e.inflExp + 0.5 * (e.infl - tgt) + 0.5 * e.gap - (st.flags.pressaoBC ? 1.0 : 0);
      if (H.isFixed(st)) rateTarget = Math.max(rateTarget, w.rateEff + e.riskPrem + Math.max(0, 4 - e.reserves));
    }
    rateTarget = Math.max(H.t(st) < 2009 ? 0.5 : -0.5, rateTarget);
    if (st.rateMode === 'manual' && !st.cbIndep && st.fxRegime !== 'euro' && st.fxRegime !== 'dolarizado') e.rate += (e.rateManual - e.rate) * 0.6;
    else e.rate += (rateTarget - e.rate) * 0.3;
    const realRate = ((1 + e.rate / 100) / (1 + e.inflExp / 100) - 1) * 100;
    e.realRate = realRate;

    // ---- Hiato do produto (demanda) ----
    const debtDrag = e.debt > 90 ? 0.5 : 1;
    const fiscal = 0.55 * debtDrag * (e.primDef - e.primDefEMA) + 0.12 * (e.primDef - 1);
    const monetary = -0.4 * U.clamp(realRate - neutral, -12, 15) * (1 - planned * 0.8);
    const trade = w.tradeEff;
    const external = e.open * trade * (1.1 * (w.gEff - 3) + 0.04 * (e.rer - 100))
      + commodity * 7 * (w.commodEff / 100 - 1) * Math.min(1.2, e.open + 0.2)
      + (oilT > 0 ? oilT * 5 * (w.oilEff / 70 - 1) : oilT * 2.2 * (w.oilEff / 70 - 1));
    const conf = (e.confidence - 50) * 0.05;
    const sanc = st.dip.sanctionedBy.length ? -1.2 * Math.min(3, st.dip.sanctionedBy.length) : 0;
    const credit = -Math.max(0, e.riskPrem - 6) * 0.25;
    const hyper = -Math.max(0, Math.log10(Math.max(1, e.infl)) - 1.7) * 2.5;
    const shortage = -(e.shortage || 0) * 0.04;
    const gapStar = U.clamp(fiscal + monetary + external + conf + sanc + credit + hyper + shortage + (e.gapMod || 0), -25, 10);
    e.gapStar = gapStar;
    e.gap += (gapStar - e.gap) * 0.12 + U.gauss(rng) * 0.22;
    e.gap = U.clamp(e.gap, -30, 12);

    // ---- Potencial e PIB ----
    e.gpot = SIM.potentialGrowth(st);
    e.Ypot *= 1 + e.gpot / 1200;
    e.Y = e.Ypot * (1 + e.gap / 100);
    e.popBase = U.interp(c.pop, t);
    e.pop = e.popBase * e.popAdj;

    // ---- Inflação (Phillips com inércia, em log) ----
    const fxDepAnnual = (e.fxDep12 || 0); // depreciação acumulada 12m (%)
    const oilShock = oilT < 0 ? (-oilT) * 0.05 * (w.oilEff - (e.oilRef || w.oilEff)) : oilT * 0.01 * (w.oilEff - (e.oilRef || w.oilEff));
    let piTarget = e.inflExp + 0.32 * e.gap + fxPass * Math.max(-20, fxDepAnnual - e.infl) * 0.5 + oilShock
      + (e.supplyShock || 0) - (e.budget.subsidios - e.subsRef) * 0.8 + (e.taxes.comercio - e.tariffRef) * 0.04;
    // emissão monetária: impulso multiplicativo (pode gerar hiperinflação)
    const monPush = mon * Math.max(0, e.primDef + Math.max(0, e.debt * realRate / 100) * 0.2);
    let lPiT = L(Math.max(-12, piTarget)) + monPush * 0.05;
    if (H.isFixed(st) && st.fxRegime !== 'ouro') lPiT = lPiT * 0.5 + L(w.inflEff + 0.3 * e.gap) * 0.5;
    if (st.fxRegime === 'ouro') lPiT = Math.max(L(-12), lPiT * 0.3 + L(w.inflEff) * 0.7);
    if (st.flags.congelamento) lPiT = Math.min(lPiT, L(3));
    const speed = 0.05 + 0.3 * (1 - inertia);
    e.inflL += (lPiT - e.inflL) * speed + U.gauss(rng) * 0.002;
    e.inflL = U.clamp(e.inflL, L(-25), L(1e5));
    let infl = P(e.inflL);
    // economia planificada: inflação reprimida vira escassez
    if (planned > 0.4) {
      const repressed = infl * planned * 0.75;
      e.shortage = U.clamp((e.shortage || 0) * 0.97 + Math.max(0, repressed - 3) * 0.05, 0, 100);
      infl -= repressed;
    } else if (st.flags.congelamento) {
      e.shortage = U.clamp((e.shortage || 0) + 1.5, 0, 100);
    } else e.shortage = Math.max(0, (e.shortage || 0) * 0.9);
    e.infl = infl;
    e.inflMemory += (Math.min(e.infl, 3000) - e.inflMemory) / 120;
    e.priceIdx *= Math.pow(1 + e.infl / 100, 1 / 12);

    // ---- Câmbio ----
    let dep = 0; // % ao mês (positivo = desvaloriza)
    const worldReal = w.rateEff - w.inflEff;
    if (st.fxRegime === 'flutuante' || st.fxRegime === 'controle') {
      dep = (Math.exp((e.inflL - L(w.inflEff)) / 12) - 1) * 100 + 0.04 * (100 - e.rer)
        - 0.06 * U.clamp(realRate - worldReal - e.riskPrem, -10, 10) / 3
        - commodity * 0.15 * ((w.commodEff - (e.commodRef || w.commodEff)) / Math.max(30, e.commodRef || w.commodEff)) * 100 / 12
        + (50 - e.confidence) * 0.01 + U.gauss(rng) * (st.fxRegime === 'controle' ? 0.5 : 1.3);
      if (st.fxRegime === 'controle') dep *= 0.6;
    } else if (st.fxRegime === 'banda') {
      dep = (Math.exp((e.inflL - L(w.inflEff)) / 12) - 1) * 100 * 0.9 + U.gauss(rng) * 0.3;
    } else dep = 0;
    dep = U.clamp(dep, -15, 400);
    e.fx *= 1 + dep / 100;
    e.rer *= (1 + dep / 100) * Math.pow((1 + w.inflEff / 100) / (1 + e.infl / 100), 1 / 12);
    e.rer = U.clamp(e.rer, 25, 400);
    e.depHist.push(dep); if (e.depHist.length > 12) e.depHist.shift();
    e.fxDep12 = (e.depHist.reduce((a, d) => a * (1 + d / 100), 1) - 1) * 100;
    e.commodRef = (e.commodRef || w.commodEff) + (w.commodEff - (e.commodRef || w.commodEff)) / 24;
    e.oilRef = (e.oilRef || w.oilEff) + (w.oilEff - (e.oilRef || w.oilEff)) / 18;

    // ---- Setor externo ----
    const tbTarget = e.open * (12 * (e.rer - 100) / 100) * Math.min(1.2, trade) - 0.25 * e.gap
      + commodity * 6 * (w.commodEff / 100 - 1) + oilT * 6 * (w.oilEff / 70 - 1) - (e.taxes.exportacao || 0) * commodity * 0.05 + (e.tbShift || 0);
    e.tb += (tbTarget - e.tb) * 0.08;
    const capOpen = st.flags.controleCapitais ? 0.3 : (st.flags.capitaisLivres ? 1.2 : 0.8);
    const flows = capOpen * (0.04 * U.clamp(realRate - worldReal - e.riskPrem * 0.6, -15, 15) + (e.confidence - 50) * 0.006);
    let drain = 0;
    if (H.isFixed(st) && st.fxRegime !== 'euro' && st.fxRegime !== 'dolarizado' && !H.trait(st, 'reserveCurrency', 0)) drain = Math.max(0, 93 - e.rer) * 0.012 + Math.max(0, -flows) * 0.5;
    const importsPctGDP = Math.max(3, e.open * 22);
    e.reserves += ((e.tb + flows * 3) / importsPctGDP) * 1.0 - drain + (st.flags.compraReservas ? 0.35 : 0) + (e.resNormal - e.reserves) * 0.035;
    e.reserves = U.clamp(e.reserves, 0, 30);
    e.tfpCal = (e.tfpCal || 0) * 0.997;

    // ---- Dívida pública (em termos reais, inclui erosão inflacionária e câmbio) ----
    const effTarget = e.rate * (1 - e.extShare) + (w.rateEff + e.riskPrem) * e.extShare;
    e.effRate += (effTarget - e.effRate) * 0.06;
    const effReal = ((1 + e.effRate / 100) / (1 + e.infl / 100) - 1) * 100;
    const gNom = e.gpot + (e.gap - (e.gapPrev || e.gap)) * 12;
    const realG = U.clamp(gNom, -40, 40);
    e.gapPrev = e.gap;
    const fxReval = e.extShare * e.debt * (dep / 100 - (e.infl - w.inflEff) / 1200);
    e.debt += (e.primDef + e.debt * (effReal - realG) / 100) / 12 - (mon * Math.max(0, e.primDef)) / 12 + Math.max(-2, fxReval);
    e.debt = U.clamp(e.debt, 0, 400);
    e.interestNom = Math.min(80, e.debt * e.effRate / 100);
    e.interestReal = e.debt * effReal / 100;
    e.nominalDef = e.primDef + e.interestNom;

    // ---- Moeda ----
    e.money *= Math.pow((1 + e.infl / 100) * (1 + e.gpot / 100), 1 / 12) * (1 + mon * Math.max(0, e.primDef) / 600);

    // ---- Trabalho ----
    const uStar = H.trait(st, 'uStar', 6) + (e.uStarShift || 0) - planned * 3;
    const uTarget = Math.max(0.8, uStar - 0.6 * e.gap);
    e.unemp += (uTarget - e.unemp) * 0.15 + U.gauss(rng) * 0.04;
    e.unemp = U.clamp(e.unemp, 0.5, 45);
    // salário mínimo real corroído pela inflação
    e.minWage *= Math.pow((1 + (e.wageIndex || 0) * e.infl / 100) / (1 + e.infl / 100), 1 / 12);

    // ---- Pobreza e desigualdade ----
    const gdppc = H.gdppc(st);
    const giniT = U.clamp(e.gini0 + e.giniShift + (e.unemp - uStar) * 0.002 + Math.min(0.03, Math.max(0, e.infl - 30) / 3000)
      - (e.budget.social - e.socialRef) * 0.004 - (e.minWage - 100) * 0.0004, 0.2, 0.75);
    e.gini += (giniT - e.gini) * 0.01;
    const basePov = 100 * (1 - U.logistic((Math.log(gdppc) - Math.log(4000)) * 1.6)) * Math.pow(e.gini / 0.38, 1.3);
    const povT = U.clamp(basePov * e.povCal + (e.povShift || 0) + 0.7 * (e.unemp - uStar) + Math.min(15, Math.max(0, e.infl - 8) * 0.06)
      - (e.budget.social - e.socialRef) * 2.2 - (e.minWage - 100) * 0.06 + (e.shortage || 0) * 0.08, 0.5, 97);
    e.poverty += (povT - e.poverty) * 0.06;

    // ---- Confiança ----
    const confT = 50 + 1.8 * U.clamp(e.growthYoY - 2, -8, 8) - Math.min(25, Math.max(0, e.infl - 6) * 0.25)
      - Math.max(0, e.debt - debtTol) * 0.2 * (1 - repression) - Math.max(0, e.primDef - 1.5) * 2 + (st.pol.stability - 50) * 0.25
      + (e.confShift || 0) - (st.flags.default ? 15 : 0) - Math.max(0, 3 - e.reserves) * 3;
    e.confidence += (U.clamp(confT, 2, 98) - e.confidence) * 0.12;
    e.confShift *= 0.985;
    e.povShift *= 0.995;

    // ---- Indústria ----
    const indTrend = e.gpot * 1.0 + (e.rer - 100) * 0.02 + (e.taxes.comercio - e.tariffRef) * 0.02 + e.indShift * 0.1;
    e.industry *= 1 + (indTrend + (e.gap - e.gapPrevInd) * 12 * 1.3) / 1200;
    e.gapPrevInd = e.gap;
    e.indShift *= 0.99;

    // ---- Sociais (deriva lenta para alvos) ----
    const lg = Math.log10(Math.max(300, gdppc));
    const era = (year - 1920);
    const hT = U.clamp(20 * lg - 45 + e.budget.saude * 4.5 + era * 0.16 + (soc.healthShift || 0), 3, 99);
    const edT = U.clamp(20 * lg - 52 + e.budget.educacao * 3.5 + era * 0.1 + (soc.eduShift || 0), 3, 99);
    const iT = U.clamp(20 * lg - 42 + e.budget.infra * 6 + (soc.infraShift || 0), 3, 99);
    soc.health += (hT - soc.health) * 0.012;
    soc.education += (edT - soc.education) * 0.006;
    soc.infraIdx += (iT - soc.infraIdx) * 0.008;
    const secT = U.clamp(72 - 0.9 * (e.unemp - 5) - 0.35 * (e.poverty - 15) - 0.2 * (soc.corruption - 40) + (soc.secShift || 0)
      + (st.budgetPolice || 0), 3, 97);
    soc.security += (secT - soc.security) * 0.03;
    const corrBase = H.trait(st, 'corruption', 50);
    soc.corruption += ((corrBase + (st.pol.corrDrift || 0)) - soc.corruption) * 0.004 + (soc.press < 30 ? 0.03 : 0);
    soc.environment += (65 - soc.environment) * 0.002;

    // ---- Investimento ----
    const invT = U.clamp(e.invest0 + (e.confidence - 50) * 0.08 - Math.max(0, realRate - neutral) * 0.15 + (e.investShift || 0), 5, 48);
    e.invest += (invT - e.invest) * 0.03;

    // ---- histórico de PIB p/ crescimento interanual ----
    e.Yhist.push(e.Y); if (e.Yhist.length > 13) e.Yhist.shift();
    e.growthYoY = e.Yhist.length >= 13 ? (e.Y / e.Yhist[0] - 1) * 100 : e.gpot + e.gap * 0.3;
    e.Yq.push(e.Y); if (e.Yq.length > 4) e.Yq.shift();

    // decaimento de choques temporários
    e.supplyShock = (e.supplyShock || 0) * 0.9;
    e.gapMod = (e.gapMod || 0) * 0.9;
  };

  S.SIM = SIM;
})(globalThis.S = globalThis.S || {});
