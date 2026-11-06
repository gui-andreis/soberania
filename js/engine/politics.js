// Política interna: aprovação por grupo, protestos, estabilidade, Congresso, eleições, golpes e revoluções.
(function (S) {
  'use strict';
  const U = S.U, H = S.H;
  const POL = {};

  const inflPain = (pi) => (pi <= 4 ? Math.max(-2, (pi - 2) * 0) : -Math.log(1 + (pi - 4) / 8) * 6);

  // Termos econômicos por grupo (pontos de aprovação)
  POL.econTerms = function (st) {
    const e = st.e, b = e.budget, soc = st.soc;
    const g = U.clamp(e.growthYoY - 2, -10, 8);
    const ip = inflPain(e.infl);
    const uGap = e.unemp - e.u0;
    const real = U.clamp(e.realRate - H.trait(st, 'neutralReal', 2.5), -15, 12);
    const tx = e.taxes;
    const mil = (b.militar - e.milRef);
    const war = st.mil.wars.length;
    const short = -(e.shortage || 0) * 0.15;
    const corr = -(soc.corruption - e.corr0) * 0.25;
    const out = {
      trabalhadores: 0.9 * g + 1.1 * ip - 1.6 * uGap + (e.minWage - 100) * 0.25 + short,
      pobres: 0.6 * g + 1.4 * ip - 0.9 * uGap - (e.poverty - e.pov0) * 0.5 + (b.social - e.socialRef) * 3 + (b.subsidios - e.subsRef) * 2 + (e.minWage - 100) * 0.15 + short,
      classe_media: 1.0 * g + 1.2 * ip - 0.8 * uGap - (tx.renda || 0) * 0.5 - (tx.consumo || 0) * 0.4 + (soc.security - e.sec0) * 0.25 + corr + short * 0.8,
      empresarios: 1.5 * g + (e.confidence - 50) * 0.18 - (tx.empresas || 0) * 0.7 - (e.minWage - 100) * 0.12 - Math.max(0, e.unemp < 4 ? 2 : 0) + 0.6 * ip,
      financeiro: 0.8 * g + real * 0.9 + 0.9 * ip - Math.max(0, e.primDef) * 2.2 - Math.max(0, e.debt - e.debt0 - 10) * 0.15 + (st.flags.default ? -25 : 0) - (tx.financeiro || 0) * 1.5 - (tx.fortunas || 0) * 4,
      agro: 1.0 * g + 9 * (st.world.commodEff / 100 - 1) + (e.rer - 100) * 0.15 - (tx.exportacao || 0) * 0.55 + 0.6 * ip,
      militares: mil * 7 - (st.pol.protests - 30) * 0.12 + 0.4 * g + (war ? (st.mil.wars[0].score > 0 ? 6 : -8) : 0),
      religiosos: 0.5 * g + 0.7 * ip - 0.4 * uGap,
      servidores: 0.4 * g + 1.2 * ip + (b.admin - e.adminRef) * 4 + (b.previdencia - e.prevRef) * 1.5,
      estudantes: 0.8 * g + 0.7 * ip - 1.0 * uGap + (b.educacao - e.eduRef) * 3 + (soc.press - 60) * 0.12 + corr * 0.8 - (war ? 4 : 0),
      sindicatos: 0.5 * g + 1.0 * ip - 1.8 * uGap + (e.minWage - 100) * 0.35
    };
    return out;
  };

  POL.monthly = function (st, rng) {
    const p = st.pol, e = st.e;
    const econ = POL.econTerms(st);
    const yearsIn = (st.month - p.termStartMonth) / 12;
    const fatigue = H.dem(st) ? -Math.min(12, yearsIn * 1.4) : -Math.min(8, yearsIn * 0.6);
    const honey = Math.max(0, 10 - (st.month - p.termStartMonth) * 0.9);
    const warRally = st.mil.wars.length ? Math.max(0, 10 - (st.month - st.mil.wars[0].sinceMonth) * 0.7) - st.mil.warEx * 0.18 : 0;
    const repress = S.POLITICS.regimes[st.regime].repression;
    for (const g in p.groups) {
      const target = p.base[g] + econ[g] + fatigue + honey + warRally + (p.shock[g] || 0);
      p.groups[g] += (U.clamp(target, 0, 100) - p.groups[g]) * 0.22;
      p.shock[g] = (p.shock[g] || 0) * 0.94;
    }
    // ideologia de base se move um pouco com o tempo para o centro (memória curta)
    for (const g in p.base) p.base[g] += (p.base0[g] - p.base[g]) * 0.003;

    // aprovação geral ponderada
    let a = 0;
    for (const g in p.groups) a += p.groups[g] * p.weights[g];
    p.approval = U.clamp(a, 1, 99);

    // protestos
    const ip = -inflPain(e.infl);
    const protestT = U.clamp(Math.max(0, 48 - p.approval) * 1.3 + ip * 1.2 + Math.max(0, e.unemp - e.u0) * 1.5 + (e.shortage || 0) * 0.3
      + Math.max(0, 50 - p.legit) * 0.3 - repress * 15 + (H.dem(st) ? 5 : 0) + (p.protestShift || 0), 0, 100);
    p.protests += (protestT - p.protests) * 0.12;
    p.protestShift = (p.protestShift || 0) * 0.92;

    // legitimidade: democracias ganham com eleições; autocracias com desempenho
    const R = S.POLITICS.regimes[st.regime];
    const legitT = U.clamp(R.legitBase + (st.regime === p.histRegime ? 8 : -8) + (p.approval - 45) * 0.35 + (p.legitBonus || 0)
      - (st.dip.sanctionedBy.length * 4) + (st.soc.press - R.press) * 0.05, 3, 98);
    p.legit += (legitT - p.legit) * 0.02;
    p.legitBonus = (p.legitBonus || 0) * 0.995;

    // lealdade militar
    const mlT = U.clamp(p.groups.militares * 0.6 + H.trait(st, 'inst', 50) * 0.35 + (st.regime === 'militar' ? 20 : 0) + (p.milShift || 0), 0, 100);
    p.militaryLoyalty += (mlT - p.militaryLoyalty) * 0.1;
    p.milShift = (p.milShift || 0) * 0.97;

    // Congresso
    if (R.democracy || R.parliament) {
      const cT = U.clamp(p.congressBase + (p.approval - 45) * 0.45 + (p.congressShift || 0), 5, 95);
      p.congress += (cT - p.congress) * 0.08;
      p.congressShift = (p.congressShift || 0) * 0.97;
    } else p.congress = 90;

    // estabilidade
    const crisis = (e.growthYoY < -3 ? 6 : 0) + (e.infl > 100 ? 8 : 0) + (e.infl > 1000 ? 10 : 0);
    p.stability = U.clamp(p.approval * 0.35 + p.legit * 0.3 + p.militaryLoyalty * 0.2 + (100 - p.protests) * 0.15 - crisis, 0, 100);
    p.coherence = U.clamp(p.coherence + (70 - p.coherence) * 0.004, 0, 100);
  };

  // ---------------- Eleições ----------------
  POL.termYears = (st) => H.stepTrait(st, 'term', 4);
  POL.scheduleElection = function (st, fresh) {
    const yrs = POL.termYears(st);
    st.pol.nextElection = st.month + Math.round(yrs * 12);
  };
  POL.termLimit = function (st) {
    if (!H.dem(st)) return 99;
    if (H.trait(st, 'parl', false) === true || H.stepTrait(st, 'parl', false) === true) return 99;
    if (st.flags.mandatoIlimitado) return 99;
    const lim = H.stepTrait(st, 'termLimit', null);
    if (lim != null) return lim;
    const re = st.flags.reeleicao !== undefined ? st.flags.reeleicao : H.stepTrait(st, 'reelect', true);
    return re ? 2 : 1;
  };

  POL.voteShare = function (st, rng, successor) {
    const e = st.e, p = st.pol;
    let share = 50 + 0.62 * (p.approval - 45) + 1.2 * U.clamp(e.growthYoY - 2, -6, 6) - Math.min(8, Math.max(0, e.infl - 6) * 0.08)
      - Math.max(0, e.unemp - e.u0) * 0.6 + (successor ? -3 : 1.5) + (rng ? U.gauss(rng) * 3.2 : 0);
    const R = S.POLITICS.regimes[st.regime];
    if (R.rigged) share = share * (1 - R.rigged) + 68 * R.rigged;
    return U.clamp(share, 3, 97);
  };

  // retorna lista de mensagens/eventos do trimestre
  POL.quarterly = function (st, rng, out) {
    const p = st.pol, R = S.POLITICS.regimes[st.regime];
    // capital político
    const capMax = 3 + (p.approval > 60 ? 1 : 0) + (p.approval < 30 ? -1 : 0) + (!R.democracy ? 1 : 0) + ((st.month - p.termStartMonth) < 12 ? 1 : 0);
    p.capitalMax = Math.max(2, capMax);
    p.capital = Math.min(p.capitalMax + 2, p.capital + p.capitalMax);

    // eleição
    if (R.elections && p.nextElection && st.month >= p.nextElection) POL.runElection(st, rng, out);
    if (p.snapElection) { p.snapElection = false; POL.runElection(st, rng, out, true); }
  };

  POL.runElection = function (st, rng, out, snap) {
    const p = st.pol, R = S.POLITICS.regimes[st.regime];
    const limit = POL.termLimit(st);
    const successor = p.termsServed >= limit;
    const share = POL.voteShare(st, rng, successor);
    const parl = R.parliament;
    const who = successor ? 'O candidato do seu partido' : st.leader.name;
    const won = share > 50;
    const res = { kind: 'eleicao', share, won, successor };
    st.stats.elections.push({ y: st.year, q: st.q, share: share, won: won });
    if (won) {
      if (successor) {
        st.leader.name = 'Sucessor(a) de ' + st.leader.name.replace(/^Sucessor\(a\) de /, '');
        p.termsServed = 1;
      } else p.termsServed += 1;
      p.termStartMonth = st.month;
      p.congressBase = U.clamp(30 + (share - 50) * 1.4 + (parl ? 12 : 0), 15, 80);
      p.legitBonus = (p.legitBonus || 0) + 6;
      POL.scheduleElection(st);
      out.push({ sev: 'positivo', title: (snap ? 'Eleição antecipada' : 'Eleições gerais') + ': vitória', text: who + ' venceu com ' + U.fmt(share, 1) + '% dos votos válidos. Novo mandato começa agora.' });
      st.mandates.push({ start: st.month, label: st.leader.name + (p.termsServed > 1 ? ' (' + p.termsServed + 'º mandato)' : '') });
    } else {
      out.push({ sev: 'crise', title: (snap ? 'Eleição antecipada' : 'Eleições gerais') + ': derrota', text: who + ' perdeu com ' + U.fmt(share, 1) + '% dos votos. A oposição assume o governo.' });
      st.pendingGameOver = { reason: 'eleicao', text: 'Seu grupo político perdeu as eleições com ' + U.fmt(share, 1) + '% dos votos.' };
    }
    st.timeline.push({ y: st.year, q: st.q, kind: 'eleicao', title: won ? 'Vitória eleitoral' : 'Derrota eleitoral', text: U.fmt(share, 1) + '% dos votos' });
    return res;
  };

  // probabilidade trimestral de golpe (tentativa)
  POL.coupProb = function (st) {
    const p = st.pol, R = S.POLITICS.regimes[st.regime];
    const prone = H.trait(st, 'coup', 0.1);
    const loyal = p.militaryLoyalty;
    let pr = prone * R.coupMult * 0.05 * Math.pow(Math.max(0, 55 - loyal) / 25, 1.6) * (1 + Math.max(0, 40 - p.approval) / 20) * (1 + p.protests / 80);
    if (H.crisis(st)) pr *= 1.5;
    if (H.coldWar(st) && st.leader.e < -40 && H.myBloc(st) !== 'socialista') pr *= 1.6; // Guerra Fria: golpes contra governos de esquerda
    const inst = H.trait(st, 'inst', 50) / 100;
    pr *= Math.pow(1 - inst, 2) * 2.5 * (H.t(st) > 1991 ? 0.5 : 1);
    return U.clamp(pr, 0, 0.35);
  };
  POL.coupSuccess = function (st) {
    const p = st.pol;
    return U.clamp(0.6 - (p.militaryLoyalty - 30) * 0.012 - (p.approval - 40) * 0.006 - (p.legit - 50) * 0.004 - H.trait(st, 'inst', 50) * 0.005 - (H.t(st) > 1991 ? 0.12 : 0), 0.05, 0.92);
  };
  POL.revolutionProb = function (st) {
    const p = st.pol, R = S.POLITICS.regimes[st.regime];
    if (p.stability > 30 || p.protests < 55) return 0;
    return U.clamp((30 - p.stability) * 0.006 * (p.protests / 70) * (R.democracy ? 0.4 : 1) * (1 - R.repression * 0.4) * (p.militaryLoyalty < 40 ? 1.8 : 1), 0, 0.3);
  };
  POL.impeachProb = function (st) {
    const p = st.pol, R = S.POLITICS.regimes[st.regime];
    if (!R.democracy || R.parliament) return 0;
    if (p.approval > 25 || p.congress > 38) return 0;
    return U.clamp((25 - p.approval) * 0.012 + (38 - p.congress) * 0.01 + (st.soc.corruption > 60 ? 0.05 : 0), 0, 0.45);
  };
  POL.noConfidenceProb = function (st) {
    const p = st.pol, R = S.POLITICS.regimes[st.regime];
    if (!R.parliament || !R.democracy) return 0;
    if (p.congress > 45) return 0;
    return U.clamp((45 - p.congress) * 0.02, 0, 0.5);
  };

  S.POL = POL;
})(globalThis.S = globalThis.S || {});
