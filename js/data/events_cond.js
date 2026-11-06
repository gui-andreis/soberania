// Eventos condicionais (disparam pelo estado do país) e eventos do futuro (pós-2025, probabilísticos).
(function (S) {
  'use strict';
  const U = S.U, H = S.H, POL = S.POL;
  const ev = [];
  const C = (o) => ev.push(Object.assign({ kind: 'cond', cooldown: 6 }, o));
  const F = (o) => ev.push(Object.assign({ kind: 'futuro', cooldown: 20 }, o));
  const t = (st) => H.t(st);

  // ======================= PODER E REGIME =======================
  C({ id: 'c_golpe', title: 'Tentativa de golpe militar', sev: 'crise', prob: (st) => POL.coupProb(st), cooldown: 4,
    text: 'Tanques nas ruas da capital. Um grupo de generais exige sua renúncia e ocupa emissoras de rádio e TV.',
    choices: [
      { label: 'Resistir e convocar a população às ruas', ideo: { e: 0, s: -20 }, outcomes: (st) => { const p = 1 - POL.coupSuccess(st); return [
        { p: p, label: 'O golpe fracassa', eff: { legit: 10, military: 15, approval: 6, groups: { militares: -6, estudantes: 10 } } },
        { p: 1 - p, label: 'O golpe triunfa', eff: { gameOver: { reason: 'golpe', text: 'Um golpe militar derrubou seu governo.' } } }]; } },
      { label: 'Negociar com os golpistas (ceder ministérios e pautas)', ideo: { e: 15, s: 50 }, outcomes: (st) => [
        { p: 0.55, label: 'Acordo: você fica, mas sob tutela militar', eff: { military: 20, legit: -15, budget: { militar: 0.4 }, groups: { militares: 15, estudantes: -10 }, capital: -2 } },
        { p: 0.45, label: 'Os militares recusam e assumem o poder', eff: { gameOver: { reason: 'golpe', text: 'Os militares assumiram o poder após negociações fracassadas.' } } }] },
      { label: 'Renunciar e partir para o exílio', eff: { gameOver: { reason: 'renuncia', text: 'Você renunciou diante do golpe militar.' } } }] });
  C({ id: 'c_revolucao', title: 'Insurreição popular', sev: 'crise', prob: (st) => POL.revolutionProb(st), cooldown: 4,
    text: 'Multidões cercam o palácio do governo. Barricadas, greves gerais e motins se espalham.',
    choices: [
      { label: 'Ordenar repressão armada', ideo: { e: 0, s: 80 }, outcomes: (st) => { const p = U.clamp(0.2 + (st.pol.militaryLoyalty - 50) * 0.015 + S.POLITICS.regimes[st.regime].repression * 0.3, 0.05, 0.85); return [
        { p: p, label: 'A insurreição é esmagada', eff: (s) => ({ deaths: s.e.pop * 0.03, legit: -20, protests: -30, rel: { 'bloc:ocidente': t(s) > 1975 ? -20 : -5 }, groups: { estudantes: -20, militares: 5 } }) },
        { p: 1 - p, label: 'Soldados confraternizam com a multidão: o regime cai', eff: { gameOver: { reason: 'revolucao', text: 'Uma insurreição popular derrubou seu governo.' } } }]; } },
      { label: 'Grandes concessões e governo de união nacional', ideo: { e: -20, s: -40 }, outcomes: (st) => [
        { p: 0.5, label: 'As concessões acalmam o país', eff: { legit: 8, protests: -25, budget: { social: 0.8 }, capital: -2, congress: -10 } },
        { p: 0.5, label: 'Concessões tardias: a revolução avança', eff: { gameOver: { reason: 'revolucao', text: 'Uma insurreição popular derrubou seu governo.' } } }] },
      { label: 'Renunciar', eff: { gameOver: { reason: 'renuncia', text: 'Você renunciou diante da insurreição.' } } }] });
  C({ id: 'c_impeachment', title: 'Processo de impeachment', sev: 'crise', prob: (st) => POL.impeachProb(st), cooldown: 8,
    text: 'Com aprovação no chão e o Congresso hostil, a Câmara aceita a denúncia por crime de responsabilidade.',
    choices: [
      { label: 'Lutar no Congresso (liberar cargos e emendas)', ideo: { e: 0, s: 0 }, outcomes: (st) => { const p = U.clamp(0.25 + (st.pol.congress - 25) * 0.015 + (st.pol.approval - 20) * 0.01, 0.05, 0.8); return [
        { p: p, label: 'O impeachment é barrado', eff: { congress: 8, corruption: 3, legit: -4 } },
        { p: 1 - p, label: 'Você é afastado do cargo', eff: { gameOver: { reason: 'impeachment', text: 'O Congresso aprovou seu impeachment.' } } }]; } },
      { label: 'Ir às ruas denunciar "golpe"', ideo: { e: 0, s: 20 }, outcomes: (st) => [
        { p: U.clamp(0.15 + st.pol.approval * 0.008, 0.05, 0.5), label: 'A pressão popular salva o mandato', eff: { polarization: 15, protests: 15 } },
        { p: 0.7, label: 'Afastado mesmo assim', eff: { gameOver: { reason: 'impeachment', text: 'O Congresso aprovou seu impeachment.' } } }] },
      { label: 'Renunciar antes do julgamento', eff: { gameOver: { reason: 'renuncia', text: 'Você renunciou durante o processo de impeachment.' } } }] });
  C({ id: 'c_desconfianca', title: 'Moção de desconfiança', sev: 'crise', prob: (st) => POL.noConfidenceProb(st), cooldown: 6,
    text: 'A oposição, somada a dissidentes da base, apresenta moção de desconfiança contra o governo.',
    choices: [
      { label: 'Enfrentar a votação', outcomes: (st) => { const p = U.clamp(0.2 + (st.pol.congress - 30) * 0.03, 0.05, 0.85); return [
        { p: p, label: 'O governo sobrevive à moção', eff: { congress: 6 } },
        { p: 1 - p, label: 'O governo cai: novas eleições', eff: { election: true, legit: -4 } }]; } },
      { label: 'Dissolver o parlamento e convocar eleições', eff: { election: true } }] });
  C({ id: 'c_militares_ultimato', title: 'Comandantes militares enviam carta ao governo', sev: 'alerta', prob: (st) => (st.pol.militaryLoyalty < 38 ? 0.12 * H.trait(st, 'coup', 0.1) * 5 : 0), cooldown: 8,
    text: 'Os chefes das Forças Armadas manifestam "preocupação" com os rumos do país e exigem mudanças.',
    choices: [
      { label: 'Ceder às exigências (orçamento, ministério da Defesa, pautas)', ideo: { e: 15, s: 50 }, eff: { budget: { militar: 0.3 }, military: 15, groups: { militares: 10, estudantes: -6 }, legit: -4 } },
      { label: 'Trocar os comandantes', ideo: { e: 0, s: -20 }, outcomes: (st) => [{ p: 0.6, label: 'Novos comandantes legalistas assumem', eff: { military: 10, groups: { militares: -5 } } }, { p: 0.4, label: 'A caserna reage mal', eff: { military: -12 } }] },
      { label: 'Ignorar publicamente', eff: { military: -6 } }] });
  C({ id: 'c_traicao_base', title: 'Base ideológica se revolta', sev: 'alerta', prob: (st) => (st.pol.coherence < 40 ? 0.25 : 0), cooldown: 8,
    text: (st) => 'Militantes e parlamentares do ' + st.leader.party + ' acusam o governo de abandonar o programa que o elegeu. "Não foi para isso que votamos."',
    eff: { congress: -8, approval: -2 },
    choices: [
      { label: 'Voltar ao programa original', ideo: (st) => ({ e: st.leader.e, s: st.leader.s }), eff: { coherence: 15, congress: 4, confidence: -2 } },
      { label: 'Defender o pragmatismo e buscar novos aliados', ideo: { e: 0, s: 0 }, eff: { congress: 4, coherence: -5, groups: { classe_media: 2 } } }] });
  C({ id: 'c_congresso_hostil', title: 'Paralisia no Congresso', sev: 'alerta', prob: (st) => (H.dem(st) && st.pol.congress < 32 ? 0.3 : 0), cooldown: 6,
    text: 'Sem maioria, o governo não aprova nada. Vetos são derrubados e CPIs se multiplicam.',
    eff: { capital: -1 },
    choices: [
      { label: 'Negociar uma coalizão ampla', ideo: { e: 0, s: 0 }, eff: { congress: 14, coherence: -6, corruption: 2 } },
      { label: 'Governar por medidas provisórias/decretos', ideo: { e: 0, s: 30 }, eff: { legit: -3, congress: -4, capital: 1 } },
      { label: 'Apelar às ruas contra o Congresso', ideo: { e: 0, s: 40 }, eff: { polarization: 10, protests: 8, congress: -6, approval: 2 } }] });
  C({ id: 'c_campanha', title: 'Ano eleitoral', sev: 'info', prob: (st) => (st.pol.nextElection && st.pol.nextElection - st.month > 0 && st.pol.nextElection - st.month <= 6 ? 1 : 0), cooldown: 8,
    text: (st) => 'Faltam poucos meses para as eleições. Pesquisas indicam ' + U.fmt(POL.voteShare(st, null, st.pol.termsServed >= POL.termLimit(st)), 0) + '% para ' + (st.pol.termsServed >= POL.termLimit(st) ? 'o candidato do governo' : 'você') + '.',
    choices: [
      { label: 'Pacote eleitoral: reajustes, isenções e obras', ideo: { e: -25, s: 0 }, eff: { budget: { social: 0.6, infra: 0.4 }, approval: 4, confidence: -6, lag: [{ turns: 4, eff: { budget: { social: -0.4, infra: -0.4 } } }] } },
      { label: 'Campanha responsável, sem gastança', ideo: { e: 25, s: 0 }, eff: { confidence: 3 } },
      { label: 'Campanha agressiva contra a oposição', ideo: { e: 0, s: 40 }, eff: { approval: 2, polarization: 10 } }] });
  C({ id: 'c_eleicao_fraudada', title: 'Denúncias de fraude eleitoral', sev: 'alerta', prob: (st) => (S.POLITICS.regimes[st.regime].rigged && st.stats.elections.length && st.stats.elections[st.stats.elections.length - 1].y === st.year ? 0.4 : 0), cooldown: 12,
    text: 'Observadores e a oposição denunciam fraude na última eleição. Protestos se espalham.', eff: (st) => ({ protests: 15, legit: -6, rel: { 'bloc:ocidente': t(st) > 1990 ? -8 : -2 } }) });
  C({ id: 'c_pressao_democratizacao', title: 'Pressão pela redemocratização', sev: 'alerta', prob: (st) => (!H.dem(st) && t(st) > 1974 && t(st) < 2000 && st.regime === 'militar' ? 0.06 : !H.dem(st) && st.pol.groups.estudantes < 25 ? 0.02 : 0), cooldown: 12,
    text: 'Oposição, Igreja, OAB, sindicatos e empresários pedem eleições diretas (como as Diretas Já de 1984).', eff: { protests: 12 },
    choices: [{ label: 'Abertura lenta, gradual e segura', ideo: { e: 0, s: -20 }, eff: { press: 10, legit: 6, groups: { estudantes: 6, militares: -4 } } }, { label: 'Endurecer o regime', ideo: { e: 0, s: 70 }, eff: { press: -10, protests: -6, legit: -8, groups: { estudantes: -12 } } }] });
  C({ id: 'c_desestabilizacao_externa', title: 'Desestabilização com apoio estrangeiro', sev: 'alerta', prob: (st) => (H.coldWar(st) && st.leader.e < -40 && H.myBloc(st) !== 'socialista' && ['latam', 'oriente_medio', 'asia', 'africa'].includes(H.region(st)) ? 0.05 : 0), cooldown: 12,
    text: 'Documentos indicam que serviços de inteligência estrangeiros financiam a oposição, a imprensa crítica e oficiais descontentes (como no Irã 1953, Guatemala 1954, Brasil 1964, Chile 1973).',
    eff: { military: -8, confidence: -5, groups: { militares: -5, financeiro: -4 } },
    choices: [{ label: 'Moderar a política para reduzir a hostilidade americana', ideo: { e: 30, s: 0 }, eff: { rel: { US: 15 }, military: 6, coherence: -6 } }, { label: 'Denunciar e buscar apoio soviético', ideo: { e: -40, s: 20 }, eff: { rel: { US: -20, RU: 20 }, military: -6, groups: { estudantes: 6 } } }] });
  C({ id: 'c_pressao_bloco', title: 'Pressão do bloco socialista', sev: 'alerta', prob: (st) => (H.coldWar(st) && H.myBloc(st) === 'socialista' && st.cid !== 'RU' && st.leader.e > -30 ? 0.06 : 0), cooldown: 12,
    text: 'Moscou adverte que reformas "contrarrevolucionárias" não serão toleradas (Hungria 1956, Tchecoslováquia 1968).', eff: { military: -6 },
    choices: [{ label: 'Recuar nas reformas', ideo: { e: -40, s: 30 }, eff: { coherence: -6, rel: { RU: 15 } } }, { label: 'Persistir', ideo: { e: 30, s: -30 }, outcomes: () => [{ p: 0.5, label: 'Moscou tolera', eff: { rel: { RU: -15 } } }, { p: 0.5, label: 'Intervenção militar soviética', eff: { gameOver: { reason: 'intervencao', text: 'Tanques do Pacto de Varsóvia derrubaram seu governo.' } } }] }] });

  // ======================= ECONOMIA (estado) =======================
  C({ id: 'c_hiperinflacao', title: 'Hiperinflação', sev: 'crise', prob: (st) => (st.e.infl > 400 ? 0.5 : 0), cooldown: 6,
    text: (st) => 'Inflação de ' + U.fmt(st.e.infl, 0) + '% ao ano. Preços remarcados várias vezes por dia, salários evaporam, poupança desaparece.',
    eff: { approval: -4, protests: 8, groups: { pobres: -6, classe_media: -6 } },
    choices: [
      { label: 'Plano de estabilização com âncora e ajuste fiscal', ideo: { e: 30, s: 0 }, outcomes: (st) => { const p = U.clamp(0.25 + (st.e.primDef < 1 ? 0.25 : 0) + (st.e.reserves > 4 ? 0.15 : 0) + st.e.cred * 0.2 - (st.e.monetize > 0 ? 0.2 : 0), 0.05, 0.85); return [
        { p: p, label: 'A inflação despenca', eff: { inflMult: 0.08, monetize: -1, confidence: 15, approval: 8, groups: { pobres: 12, classe_media: 10 }, budget: { admin: -0.5 } } },
        { p: 1 - p, label: 'O plano fracassa', eff: { inflMult: 0.7, confidence: -6 } }]; } },
      { label: 'Congelar preços e salários', ideo: { e: -40, s: 20 }, eff: { flags: { congelamento: true }, inflMult: 0.3, lag: [{ turns: 2, eff: { unflag: 'congelamento', infl: 60 }, note: 'O congelamento ruiu e a hiperinflação voltou.' }] } },
      { label: 'Seguir emitindo para pagar salários', ideo: { e: -30, s: 0 }, eff: { monetize: 0.2, groups: { servidores: 3, financeiro: -10 } } }] });
  C({ id: 'c_inflacao_alta', title: 'Inflação corrói o poder de compra', sev: 'alerta', prob: (st) => (st.e.infl > 12 && st.e.infl <= 400 ? 0.18 : 0), cooldown: 8,
    text: (st) => 'Com inflação de ' + U.fmt(st.e.infl, 1) + '%, donas de casa reclamam do preço da comida e sindicatos pedem reajustes.',
    eff: { groups: { pobres: -3, trabalhadores: -3 } },
    choices: [{ label: 'Defender juros mais altos e corte de gastos', ideo: { e: 40, s: 0 }, eff: (st) => ({ inflExp: -1.5, budget: { admin: -0.3 }, confidence: 4, flags: st.cbIndep ? {} : {} }) }, { label: 'Culpar empresários e "especuladores"', ideo: { e: -40, s: 20 }, eff: { approval: 2, confidence: -4, groups: { empresarios: -6 } } }, { label: 'Zerar impostos de alimentos', ideo: { e: 0, s: 0 }, eff: { tax: -0.3, infl: -0.8, groups: { pobres: 4 } } }] });
  C({ id: 'c_deflacao', title: 'Deflação e espiral de dívidas', sev: 'alerta', prob: (st) => (st.e.infl < -1 ? 0.3 : 0), cooldown: 8,
    text: 'Preços em queda aumentam o peso real das dívidas; consumidores adiam compras (Fisher, 1933).', eff: { gap: -0.6, confidence: -3 },
    choices: [{ label: 'Expansão monetária e fiscal', ideo: { e: -20, s: 0 }, eff: { inflExp: 1.5, demand: 0.5 } }, { label: 'Esperar o ajuste natural', ideo: { e: 50, s: 0 }, eff: { gap: -1 } }] });
  C({ id: 'c_corrida_cambial', title: 'Ataque especulativo contra a moeda', sev: 'crise', prob: (st) => (H.isFixed(st) && !['euro', 'dolarizado'].includes(st.fxRegime) && st.e.reserves < 1.6 ? 0.7 : st.fxRegime === 'banda' && st.e.reserves < 1.2 ? 0.6 : 0), cooldown: 4,
    text: 'As reservas acabaram. Especuladores apostam na desvalorização e drenam os últimos dólares.',
    choices: [
      { label: 'Desvalorizar e deixar flutuar', ideo: { e: 10, s: 0 }, eff: (st) => ({ fxRegime: 'flutuante', fx: Math.max(25, 110 - st.e.rer), infl: 8, confidence: -10, gap: -2, legit: -5, groups: { classe_media: -10, agro: 6 } }) },
      { label: 'Juros altíssimos para defender a paridade', ideo: { e: 30, s: 0 }, outcomes: () => [{ p: 0.3, label: 'A defesa funciona temporariamente', eff: { gap: -3, reserves: 1 } }, { p: 0.7, label: 'A paridade cai mesmo assim', eff: { fxRegime: 'flutuante', fx: 45, infl: 10, gap: -4, confidence: -15, legit: -8 } }] },
      { label: 'Pedir socorro ao FMI', ideo: { e: 35, s: 0 }, req: (st) => st.dip.orgs.fmi, eff: { flags: { fmi: true }, reserves: 5, confidence: 6, budget: { admin: -0.5, infra: -0.4 }, groups: { sindicatos: -8 }, lag: [{ turns: 12, eff: { unflag: 'fmi' } }] } }] });
  C({ id: 'c_default', title: 'Credores fecham as portas', sev: 'crise', prob: (st) => (!st.flags.default && st.e.riskPrem > 12 && st.e.debt > 60 ? 0.5 : 0), cooldown: 6,
    text: 'O Tesouro não consegue rolar a dívida: leilões fracassam e o prêmio de risco explode.',
    choices: [
      { label: 'Declarar moratória', ideo: { e: -30, s: 10 }, eff: { flags: { default: true }, confidence: -15, gap: -3, groups: { financeiro: -20 } } },
      { label: 'Ajuste fiscal draconiano + FMI', ideo: { e: 50, s: 0 }, eff: (st) => ({ flags: st.dip.orgs.fmi ? { fmi: true } : {}, reserves: st.dip.orgs.fmi ? 4 : 0, budget: { admin: -1, infra: -0.7, social: -0.5 }, confidence: 10, protests: 12, groups: { sindicatos: -12, servidores: -12, pobres: -8, financeiro: 10 } }) },
      { label: 'Financiar com emissão de moeda', ideo: { e: -40, s: 0 }, eff: { monetize: 0.7, inflExp: 10, confidence: -10 } }] });
  C({ id: 'c_rebaixamento', title: 'Agência rebaixa a nota de crédito', sev: 'alerta', prob: (st) => (t(st) > 1975 && st.e.primDef > 2.5 && st.e.debt > 60 ? 0.15 : 0), cooldown: 10,
    text: 'Moody\'s e S&P cortam a nota soberana citando trajetória explosiva da dívida.', eff: { confidence: -6, fx: 4, groups: { financeiro: -6 } } });
  C({ id: 'c_grau_investimento', title: 'País conquista grau de investimento', sev: 'positivo', prob: (st) => (t(st) > 1985 && !H.advanced(st) && st.e.confidence > 68 && st.e.debt < 55 && st.e.infl < 7 && !st.flags.grauInvest ? 0.25 : 0), cooldown: 20,
    text: 'Agências de risco elevam o país ao grau de investimento. Fundos internacionais podem comprar seus títulos.', eff: { flags: { grauInvest: true }, confidence: 8, reserves: 2, fx: -6, investShift: 1, groups: { financeiro: 10, classe_media: 3 } } });
  C({ id: 'c_recessao', title: 'Recessão', sev: 'alerta', prob: (st) => (st.e.growthYoY < -1 ? 0.35 : 0), cooldown: 6,
    text: (st) => 'O PIB caiu ' + U.fmt(-st.e.growthYoY, 1) + '% em 12 meses. Comércio fecha lojas, indústria demite.',
    choices: [{ label: 'Estímulo fiscal emergencial', ideo: { e: -30, s: 0 }, eff: (st) => ({ budget: { infra: 0.7, social: 0.4 }, demand: 0.6, confidence: st.e.debt > 80 ? -6 : -1, lag: [{ turns: 6, eff: { budget: { infra: -0.7, social: -0.4 } } }] }) }, { label: 'Reformas pró-mercado para recuperar a confiança', ideo: { e: 45, s: 0 }, eff: { confidence: 7, groups: { sindicatos: -4, empresarios: 4 } } }, { label: 'Aguardar', eff: {} }] });
  C({ id: 'c_milagre', title: '"Milagre econômico"', sev: 'positivo', prob: (st) => (st.e.growthYoY > 6 && st.e.infl < 15 ? 0.3 : 0), cooldown: 12,
    text: (st) => 'Crescimento de ' + U.fmt(st.e.growthYoY, 1) + '%: emprego em alta, obras por toda parte, otimismo nas ruas.', eff: { approval: 4, legit: 4, confidence: 5 } });
  C({ id: 'c_superaquecimento', title: 'Economia superaquecida', sev: 'alerta', prob: (st) => (st.e.gap > 3.5 ? 0.3 : 0), cooldown: 8,
    text: 'Falta mão de obra, filas para comprar carro, aluguéis disparam. A inflação dá sinais de aceleração.', eff: { supply: 1, inflExp: 0.8 },
    choices: [{ label: 'Esfriar: cortar gastos', ideo: { e: 40, s: 0 }, eff: { budget: { infra: -0.4, subsidios: -0.2 }, confidence: 4 } }, { label: 'Deixar a festa continuar', ideo: { e: -30, s: 0 }, eff: { approval: 1, inflExp: 1 } }] });
  C({ id: 'c_desemprego', title: 'Desemprego em massa', sev: 'crise', prob: (st) => (st.e.unemp > 14 ? 0.3 : 0), cooldown: 6,
    text: (st) => U.fmt(st.e.unemp, 1) + '% da força de trabalho está desempregada. Filas por vagas dão a volta no quarteirão.', eff: { protests: 8, secShift: -2, groups: { trabalhadores: -4 } },
    choices: [{ label: 'Frentes de trabalho emergenciais', ideo: { e: -35, s: 0 }, eff: { budget: { infra: 0.6 }, unemp: -1.2, lag: [{ turns: 4, eff: { budget: { infra: -0.6 } } }], groups: { trabalhadores: 6, pobres: 5 } } }, { label: 'Flexibilizar contratações', ideo: { e: 50, s: 0 }, eff: { uStar: -0.4, groups: { sindicatos: -8, empresarios: 6 } } }] });
  C({ id: 'c_fome', title: 'Saques e revoltas da fome', sev: 'crise', prob: (st) => ((st.e.poverty > 45 && st.e.infl > 30) || (st.e.shortage > 35) ? 0.35 : 0), cooldown: 6,
    text: 'Multidões saqueiam supermercados e armazéns. Há mortos em confrontos com a polícia.', eff: { protests: 15, deaths: 0.05, legit: -5 },
    choices: [{ label: 'Distribuir alimentos e subsidiar a cesta básica', ideo: { e: -35, s: 0 }, eff: { budget: { social: 0.5, subsidios: 0.4 }, poverty: -2, protests: -8, groups: { pobres: 10 } } }, { label: 'Toque de recolher e repressão', ideo: { e: 0, s: 60 }, eff: { protests: -10, legit: -6, deaths: 0.05, groups: { pobres: -10, militares: 3 } } }] });
  C({ id: 'c_escassez', title: 'Prateleiras vazias', sev: 'alerta', prob: (st) => (st.e.shortage > 25 ? 0.4 : 0), cooldown: 6,
    text: 'Faltam carne, leite, papel higiênico e remédios. Mercado negro floresce; ágio de 30%.', eff: { groups: { classe_media: -6, pobres: -5 } },
    choices: [{ label: 'Liberar preços', ideo: { e: 50, s: 0 }, eff: (st) => ({ unflag: 'congelamento', infl: Math.min(40, st.e.shortage), shortage: -st.e.shortage * 0.7, groups: { empresarios: 6, pobres: -4 } }) }, { label: 'Fiscais do governo contra remarcação', ideo: { e: -45, s: 30 }, eff: { approval: 1, groups: { empresarios: -6 } } }, { label: 'Importar emergencialmente', ideo: { e: 0, s: 0 }, eff: { reserves: -1, shortage: -10 } }] });
  C({ id: 'c_protestos_massa', title: 'Protestos de massa', sev: 'crise', prob: (st) => (st.pol.protests > 62 ? 0.4 : 0), cooldown: 4,
    text: 'Milhões nas ruas das principais cidades exigem mudanças, e parte deles pede a sua saída.',
    choices: [
      { label: 'Ouvir as ruas: pacote de respostas', ideo: { e: -20, s: -20 }, eff: { protests: -15, budget: { social: 0.3 }, capital: -1, approval: 3 } },
      { label: 'Repressão policial', ideo: { e: 0, s: 60 }, eff: (st) => ({ protests: H.dem(st) ? 5 : -15, legit: H.dem(st) ? -8 : -4, deaths: 0.01, groups: { estudantes: -12, militares: 3 } }) },
      { label: 'Trocar ministros', ideo: { e: 0, s: 0 }, eff: { protests: -6, congress: -3 } }] });
  C({ id: 'c_polarizacao', title: 'Violência política', sev: 'alerta', prob: (st) => (st.pol.polarization > 55 ? 0.2 : 0), cooldown: 8,
    text: 'Militantes de lados opostos entram em confronto; um político é assassinado.', eff: { protests: 8, legit: -3, deaths: 0.01 },
    choices: [{ label: 'Pacto pela pacificação com a oposição', ideo: { e: 0, s: -30 }, eff: { polarization: -12, coherence: -4 } }, { label: 'Culpar a oposição', ideo: { e: 0, s: 40 }, eff: { polarization: 8, groups: { religiosos: 2 } } }] });
  C({ id: 'c_fuga_capitais', title: 'Fuga de capitais', sev: 'crise', prob: (st) => (st.e.confidence < 25 && !st.flags.controleCapitais ? 0.35 : 0), cooldown: 6,
    text: 'Investidores retiram dólares em massa; a moeda despenca e a bolsa derrete.', eff: (st) => ({ reserves: -2, fx: st.fxRegime === 'flutuante' ? 12 : 0, confidence: -4 }),
    choices: [{ label: 'Controle de capitais', ideo: { e: -40, s: 20 }, eff: { flags: { controleCapitais: true }, reserves: 1 } }, { label: 'Anunciar medidas pró-mercado', ideo: { e: 45, s: 0 }, eff: { confidence: 8, coherence: -4 } }] });
  C({ id: 'c_fmi_oferta', title: 'FMI oferece programa', sev: 'info', prob: (st) => (st.e.reserves < 2 && !st.flags.fmi && st.dip.orgs.fmi ? 0.4 : 0), cooldown: 8,
    text: 'Com reservas críticas, o FMI oferece um empréstimo stand-by — com condicionalidades.',
    choices: [{ label: 'Aceitar', ideo: { e: 40, s: 0 }, eff: { flags: { fmi: true }, reserves: 5, confidence: 10, budget: { admin: -0.5, subsidios: -0.4, infra: -0.3 }, groups: { sindicatos: -10, estudantes: -8, financeiro: 8 }, lag: [{ turns: 12, eff: { unflag: 'fmi' } }] } }, { label: 'Recusar', ideo: { e: -40, s: 20 }, eff: { confidence: -5, groups: { sindicatos: 4 } } }] });
  C({ id: 'c_euforia', title: 'Euforia na bolsa', sev: 'positivo', prob: (st) => (st.e.confidence > 78 ? 0.25 : 0), cooldown: 10,
    text: 'Bolsa em recorde, IPOs em fila, capital estrangeiro entrando.', eff: { investShift: 0.5, reserves: 1, groups: { financeiro: 6, classe_media: 3 } } });
  C({ id: 'c_bolha_credito', title: 'Bolha de crédito', sev: 'alerta', prob: (st) => (st.e.realRate < -2 && st.e.growthYoY > 3.5 ? 0.12 : 0), cooldown: 12,
    text: 'Crédito barato infla preços de imóveis e ações. Endividamento das famílias bate recorde.', eff: { confidence: 2, lag: [{ turns: 6, eff: { gap: -2.5, confidence: -10 }, note: 'A bolha de crédito estourou.' }] } });
  C({ id: 'c_commodity_boom', title: 'Boom de commodities', sev: 'positivo', prob: (st) => (st.world.commodEff > 112 && H.commodity(st) > 0.35 ? 0.25 : 0), cooldown: 16,
    text: 'Preços de soja, minério e carne nas alturas trazem uma chuva de dólares.', eff: { confidence: 5, reserves: 1.5 },
    choices: [{ label: 'Poupar em fundo soberano', ideo: { e: 25, s: 0 }, eff: { reserves: 2, demand: -0.2, confidence: 4 } }, { label: 'Gastar em programas sociais e obras', ideo: { e: -30, s: 0 }, eff: { budget: { social: 0.4, infra: 0.4 }, approval: 3 } }] });
  C({ id: 'c_commodity_bust', title: 'Queda dos preços de commodities', sev: 'alerta', prob: (st) => (st.world.commodEff < 72 && H.commodity(st) > 0.4 ? 0.2 : 0), cooldown: 16,
    text: 'O fim do ciclo de commodities derruba exportações e receitas fiscais.', eff: { confidence: -5, groups: { agro: -6 } } });
  C({ id: 'c_petrodolares', title: 'Chuva de petrodólares', sev: 'positivo', prob: (st) => (st.world.oilEff > 85 && H.oilExp(st) > 0.35 ? 0.2 : 0), cooldown: 16,
    text: 'Petróleo caro enche os cofres. A tentação de gastar é enorme — e a doença holandesa ronda a indústria.', eff: { reserves: 2 },
    choices: [{ label: 'Fundo soberano e disciplina', ideo: { e: 25, s: 0 }, eff: { flags: { fundoSoberano: true }, reserves: 2, confidence: 4 } }, { label: 'Expandir gastos e subsídios', ideo: { e: -35, s: 0 }, eff: { budget: { social: 0.7, subsidios: 0.6 }, approval: 4, industry: -2 } }] });
  C({ id: 'c_gasolina', title: 'Gasolina cara gera revolta', sev: 'alerta', prob: (st) => (st.world.oilEff > 95 && H.oilImp(st) > 0.4 ? 0.2 : 0), cooldown: 10,
    text: 'O preço dos combustíveis dispara nas bombas; taxistas e motoboys protestam.', eff: { approval: -3, protests: 5 },
    choices: [{ label: 'Subsidiar combustível', ideo: { e: -25, s: 0 }, eff: { budget: { subsidios: 0.5 }, infl: -0.5, approval: 2 } }, { label: 'Manter preços de mercado', ideo: { e: 35, s: 0 }, eff: { confidence: 2 } }] });
  C({ id: 'c_cambio_paralelo', title: 'Disparada do dólar paralelo', sev: 'alerta', prob: (st) => (st.flags.controleCapitais && st.e.infl > 25 ? 0.25 : 0), cooldown: 8,
    text: 'O "dólar blue" vale o dobro do oficial. Exportadores seguram vendas, importadores não conseguem divisas.', eff: { tbShift: -0.3, confidence: -4, shortage: 4 },
    choices: [{ label: 'Unificar o câmbio (desvalorização forte)', ideo: { e: 40, s: 0 }, eff: { unflag: 'controleCapitais', fxRegime: 'flutuante', fx: 50, infl: 15, confidence: 6, groups: { agro: 8, classe_media: -8 } } }, { label: 'Endurecer o controle', ideo: { e: -40, s: 30 }, eff: { confidence: -4, groups: { classe_media: -4 } } }] });
  C({ id: 'c_espiral_indexacao', title: 'Espiral preços-salários', sev: 'alerta', prob: (st) => (st.e.infl > 60 && st.e.wageIndex > 0.5 ? 0.25 : 0), cooldown: 10,
    text: 'Gatilhos salariais e reajustes automáticos alimentam uma corrida entre preços e salários.', eff: { indexation: 0.05 } });
  C({ id: 'c_divida_explosiva', title: 'Dívida pública em trajetória explosiva', sev: 'alerta', prob: (st) => (st.e.debt > (H.advanced(st) ? 140 : 90) ? 0.15 : 0), cooldown: 12,
    text: (st) => 'A dívida bruta atingiu ' + U.fmt(st.e.debt, 0) + '% do PIB. Economistas alertam para risco de dominância fiscal.', eff: { confidence: -5, inflExp: 1 } });
  C({ id: 'c_corrupcao_sistemica', title: 'Corrupção sistêmica afasta investidores', sev: 'alerta', prob: (st) => (st.soc.corruption > 72 ? 0.12 : 0), cooldown: 16,
    text: 'Relatórios internacionais apontam o país como um dos mais corruptos do mundo.', eff: { confidence: -4, investShift: -0.5, rel: { 'bloc:ocidente': -3 } } });
  C({ id: 'c_crime', title: 'Explosão da criminalidade', sev: 'alerta', prob: (st) => (st.soc.security < 30 ? 0.25 : 0), cooldown: 8,
    text: 'Homicídios e roubos batem recorde. A população se tranca em casa.', eff: { groups: { classe_media: -6, pobres: -4 }, approval: -2 },
    choices: [{ label: 'Endurecer: mais polícia e penas maiores', ideo: { e: 0, s: 55 }, eff: { budget: { admin: 0.2 }, secShift: 3, groups: { classe_media: 5, religiosos: 3, estudantes: -4 } } }, { label: 'Prevenção: emprego jovem, escolas integrais', ideo: { e: -30, s: -20 }, eff: { budget: { educacao: 0.2, social: 0.2 }, lag: [{ turns: 6, eff: { secShift: 4 } }], groups: { estudantes: 4 } } }] });
  C({ id: 'c_previdencia', title: 'Rombo da previdência', sev: 'alerta', prob: (st) => (st.e.budget.previdencia > 10 && st.e.primDef > 1.5 ? 0.12 : 0), cooldown: 16,
    text: 'O gasto com aposentadorias já supera saúde e educação somados. O envelhecimento piora a conta.', eff: { confidence: -3 } });
  C({ id: 'c_sancoes', title: 'Sanções econômicas apertam', sev: 'alerta', prob: (st) => (st.dip.sanctionedBy.length ? 0.25 : 0), cooldown: 8,
    text: 'Bancos estrangeiros congelam ativos, importações de peças e remédios ficam difíceis.', eff: { shortage: 5, confidence: -3, groups: { classe_media: -4, empresarios: -4 } },
    choices: [{ label: 'Buscar parceiros alternativos (China, Rússia, Índia)', ideo: { e: -20, s: 20 }, eff: { rel: { CN: 6, RU: 6, IN: 4 }, shortage: -3 } }, { label: 'Negociar o levantamento das sanções', ideo: { e: 20, s: -20 }, outcomes: (st) => [{ p: 0.3, label: 'Sanções aliviadas', eff: { sanctions: { by: 'ocidente', on: false }, confidence: 6 } }, { p: 0.7, label: 'Sem acordo', eff: {} }] }, { label: 'Discurso de resistência nacional', ideo: { e: 0, s: 50 }, eff: { approval: 2, legit: 3, groups: { militares: 4 } } }] });

  // ======================= GUERRA (estado) =======================
  C({ id: 'c_cansaco_guerra', title: 'Protestos contra a guerra', sev: 'alerta', prob: (st) => (st.mil.wars.length && st.mil.warEx > 55 ? 0.35 : 0), cooldown: 4,
    text: 'Famílias de soldados mortos e estudantes protestam: "tragam nossos filhos de volta".', eff: { protests: 10, approval: -3 },
    choices: [{ label: 'Buscar negociação de paz', ideo: { e: 0, s: -30 }, outcomes: (st) => [{ p: 0.5, label: 'Cessar-fogo assinado', eff: (s) => ({ peace: { target: s.mil.wars[0].target, result: 'cessar-fogo' }, warEx: -30, approval: 5 }) }, { p: 0.5, label: 'O inimigo rejeita', eff: {} }] }, { label: 'Endurecer: censura e lei de segurança nacional', ideo: { e: 0, s: 70 }, eff: { press: -10, protests: -8, legit: -5 } }] });
  C({ id: 'c_vitoria_proxima', title: 'O inimigo pede negociações', sev: 'positivo', prob: (st) => (st.mil.wars.some((w) => w.score > 65) ? 0.4 : 0), cooldown: 4,
    text: (st) => H.cname(st.mil.wars.find((w) => w.score > 65).target, st) + ' propõe um armistício em termos favoráveis a você.',
    choices: [{ label: 'Aceitar a paz vitoriosa', ideo: { e: 0, s: 0 }, eff: (st) => ({ peace: { target: st.mil.wars.find((w) => w.score > 65).target, result: 'paz vitoriosa' }, legit: 8, approval: 6, groups: { militares: 10 }, warEx: -30 }) }, { label: 'Continuar até a rendição total', ideo: { e: 0, s: 60 }, eff: { groups: { militares: 4, estudantes: -4 } } }] });
  C({ id: 'c_derrota_proxima', title: 'Generais recomendam armistício', sev: 'crise', prob: (st) => (st.mil.wars.some((w) => w.score < -60) ? 0.4 : 0), cooldown: 4,
    text: 'O Estado-Maior admite que a frente pode colapsar e recomenda negociar.',
    choices: [{ label: 'Pedir armistício (concessões territoriais)', ideo: { e: 0, s: -10 }, eff: (st) => ({ peace: { target: st.mil.wars.find((w) => w.score < -60).target, result: 'derrota negociada' }, legit: -12, groups: { militares: -12, classe_media: -4 }, debt: 4 }) }, { label: 'Lutar até o fim', ideo: { e: 0, s: 80 }, eff: { budget: { militar: 1.5 }, strength: 10, groups: { militares: 4 } } }] });

  // ======================= FUTURO (pós-2025) =======================
  F({ id: 'f_pandemia', title: 'Nova pandemia global', sev: 'crise', prob: 0.006, cooldown: 60, text: 'Um novo patógeno respiratório se espalha por todos os continentes.',
    eff: (st) => ({ world: { growth: -4, trade: -12, oil: -25 }, gap: -3, confidence: -10, deaths: st.e.pop * (st.soc.health > 70 ? 0.5 : 1.5) }),
    choices: [{ label: 'Lockdown e auxílio emergencial', ideo: { e: -30, s: -10 }, eff: { gap: -3, budget: { social: 2.5 }, lag: [{ turns: 3, eff: { budget: { social: -2.5 } } }], approval: 3 } }, { label: 'Medidas moderadas e foco em vacinas', eff: (st) => ({ deaths: st.e.pop * 0.5, gap: -1.5 }) }, { label: 'Manter tudo aberto', ideo: { e: 40, s: 40 }, eff: (st) => ({ deaths: st.e.pop * 2.5, health: -4, legit: -5 }) }] });
  F({ id: 'f_crise_financeira', title: 'Crise financeira global', sev: 'crise', prob: 0.008, cooldown: 32, text: 'Uma bolha de ativos (dívida privada, cripto ou imóveis comerciais) estoura nos países ricos.',
    eff: { world: { growth: -3.5, trade: -10, commod: -20, rate: -2 }, confidence: -12, reserves: -1 } });
  F({ id: 'f_choque_petroleo', title: 'Choque do petróleo (conflito no Golfo)', sev: 'crise', prob: 0.006, cooldown: 24, text: 'Conflito fecha o Estreito de Ormuz; o barril dispara.',
    eff: (st) => ({ world: { oil: 70, growth: -1.2, infl: 2 }, infl: H.oilImp(st) * 2.5, confidence: H.oilExp(st) > 0.3 ? 6 : -4 }) });
  F({ id: 'f_taiwan', title: 'Crise militar no Estreito de Taiwan', sev: 'crise', prob: (st) => (t(st) < 2040 ? 0.004 : 0.002), cooldown: 80, text: 'A China bloqueia Taiwan. Cadeias globais de semicondutores param; EUA e aliados ameaçam reagir.',
    eff: (st) => ({ world: { growth: -3, trade: -25, infl: 2 }, confidence: -10, industry: -4 }),
    choices: [{ label: 'Alinhar-se aos EUA (sanções à China)', ideo: { e: 10, s: 20 }, eff: { rel: { US: 10, CN: -30 }, tbShift: -0.5 } }, { label: 'Neutralidade', ideo: { e: 0, s: 0 }, eff: { rel: { US: -4, CN: 2 } } }, { label: 'Apoiar Pequim', ideo: { e: -20, s: 20 }, eff: { rel: { CN: 20, US: -30 }, sanctions: { by: 'ocidente', on: true } } }] });
  F({ id: 'f_ia_boom', title: 'Salto de produtividade com inteligência artificial', sev: 'positivo', prob: (st) => (t(st) < 2045 ? 0.01 : 0.004), cooldown: 40, text: 'Uma nova geração de sistemas de IA eleva a produtividade de serviços e indústria em todo o mundo.',
    eff: (st) => ({ world: { tfp: 0.4, growth: 0.8 }, gpot: 0.3 * Math.min(1.5, st.soc.education / 60), confidence: 5 }),
    choices: [{ label: 'Investir pesado em IA e requalificação', ideo: { e: 10, s: -10 }, eff: { budget: { educacao: 0.3 }, gpot: 0.2, groups: { estudantes: 6, empresarios: 6 } } }, { label: 'Regular fortemente e proteger empregos', ideo: { e: -30, s: 10 }, eff: { gpot: -0.1, groups: { sindicatos: 8, empresarios: -6 } } }] });
  F({ id: 'f_ia_desemprego', title: 'Automação elimina empregos de escritório', sev: 'alerta', prob: (st) => (t(st) > 2028 ? 0.008 : 0), cooldown: 40, text: 'IA substitui em massa atendentes, analistas e programadores júnior.',
    eff: { uStar: 1, groups: { classe_media: -8, trabalhadores: -4, estudantes: -6 } },
    choices: [{ label: 'Renda básica financiada por imposto sobre IA', ideo: { e: -50, s: -10 }, eff: { budget: { social: 1 }, tax: 0.6, poverty: -2, groups: { classe_media: 6, pobres: 8, empresarios: -10 } } }, { label: 'Requalificação profissional em massa', ideo: { e: 10, s: 0 }, eff: { budget: { educacao: 0.4 }, lag: [{ turns: 8, eff: { uStar: -0.7 } }] } }, { label: 'Deixar o mercado se ajustar', ideo: { e: 55, s: 0 }, eff: { gini: 1.5, groups: { empresarios: 6, classe_media: -4 } } }] });
  F({ id: 'f_clima', title: 'Evento climático extremo sem precedentes', sev: 'crise', prob: (st) => 0.008 + Math.max(0, t(st) - 2030) * 0.0006, cooldown: 12, text: 'Calor, secas e enchentes simultâneas quebram recordes históricos.',
    eff: (st) => ({ deaths: st.e.pop * 0.2, gap: -1, infl: 1, groups: { agro: -6 }, environment: -3 }) });
  F({ id: 'f_crise_alimentos', title: 'Crise alimentar global', sev: 'alerta', prob: (st) => 0.004 + Math.max(0, t(st) - 2030) * 0.0003, cooldown: 24, text: 'Quebras de safra simultâneas em grandes produtores levam a preços recordes de alimentos.',
    eff: (st) => ({ world: { commod: 30, infl: 1.5 }, infl: 2, poverty: H.commodity(st) > 0.4 ? -0.5 : 2 }) });
  F({ id: 'f_tempestade_solar', title: 'Tempestade solar severa', sev: 'crise', prob: 0.0008, cooldown: 200, text: 'Uma ejeção de massa coronal danifica satélites e transformadores em todo o hemisfério.', eff: { world: { growth: -2 }, gap: -2, infra: -4 } });
  F({ id: 'f_ciberguerra', title: 'Ataque cibernético global', sev: 'alerta', prob: 0.006, cooldown: 24, text: 'Malware paralisa bancos, portos e hospitais em dezenas de países.', eff: { world: { growth: -0.6 }, gap: -0.5, confidence: -4 } });
  F({ id: 'f_china_imobiliario', title: 'Colapso do setor imobiliário chinês', sev: 'alerta', prob: (st) => (t(st) < 2035 ? 0.006 : 0.002), cooldown: 60, text: 'A desaceleração chinesa se aprofunda; demanda por commodities despenca.',
    eff: (st) => (st.cid === 'CN' ? { gap: -4, confidence: -15, debt: 8 } : { world: { commod: -20, growth: -0.8 }, confidence: H.commodity(st) > 0.4 ? -6 : -1 }) });
  F({ id: 'f_divida_eua', title: 'Crise de confiança na dívida americana', sev: 'crise', prob: 0.003, cooldown: 60, text: 'Leilões do Tesouro americano fracassam; juros longos disparam e o dólar oscila violentamente.',
    eff: (st) => ({ world: { rate: 2, growth: -1.5 }, confidence: st.cid === 'US' ? -20 : -6, reserves: st.cid === 'US' ? 0 : -1 }) });
  F({ id: 'f_fusao', title: 'Primeira usina de fusão nuclear comercial', sev: 'positivo', prob: (st) => (t(st) > 2040 ? 0.005 : 0), cooldown: 200, once: true, text: 'Energia abundante e limpa começa a chegar à rede.',
    eff: (st) => ({ world: { oil: -40, tfp: 0.3 }, confidence: H.oilExp(st) > 0.3 ? -10 : 5 }) });
  F({ id: 'f_migracao_climatica', title: 'Migração climática em massa', sev: 'alerta', prob: (st) => (t(st) > 2035 ? 0.006 : 0), cooldown: 24, text: 'Milhões deixam regiões inabitáveis pelo calor e pela falta de água.',
    choices: [{ label: 'Acolher migrantes', ideo: { e: 0, s: -40 }, eff: { popAdj: 1, budget: { social: 0.3 }, groups: { estudantes: 5, trabalhadores: -4, religiosos: -2 } } }, { label: 'Fechar fronteiras', ideo: { e: 0, s: 60 }, eff: { rel: { '*': -4 }, groups: { militares: 4, estudantes: -6 } } }] });
  F({ id: 'f_superbacteria', title: 'Surto de superbactéria resistente', sev: 'alerta', prob: 0.003, cooldown: 60, text: 'Infecções resistentes a todos os antibióticos se espalham em hospitais.', eff: (st) => ({ deaths: st.e.pop * 0.1, health: -2 }) });
  F({ id: 'f_desdolarizacao', title: 'Avanço da desdolarização', sev: 'info', prob: 0.004, cooldown: 60, text: 'BRICS lançam sistema de pagamentos alternativo; bancos centrais trocam dólares por ouro.',
    choices: [{ label: 'Aderir ao novo sistema', ideo: { e: -20, s: 10 }, eff: { rel: { CN: 8, RU: 6, US: -10 } } }, { label: 'Manter o padrão dólar', ideo: { e: 20, s: 0 }, eff: { rel: { US: 5 } } }] });
  F({ id: 'f_litio', title: 'Corrida por minerais críticos', sev: 'positivo', prob: (st) => (H.commodity(st) > 0.4 ? 0.006 : 0.001), cooldown: 40, text: 'A demanda por lítio, cobre, níquel e terras raras dispara com a transição energética.',
    eff: { world: { commod: 15 }, confidence: 3 },
    choices: [{ label: 'Exigir processamento local (agregar valor)', ideo: { e: -30, s: 20 }, eff: { industry: 3, investShift: -0.3 } }, { label: 'Abrir ao investimento estrangeiro', ideo: { e: 40, s: 0 }, eff: { investShift: 1, reserves: 1 } }] });
  F({ id: 'f_recessao_global', title: 'Recessão global', sev: 'alerta', prob: 0.01, cooldown: 24, text: 'As maiores economias entram em recessão simultaneamente.', eff: { world: { growth: -2.2, commod: -10, oil: -15 }, confidence: -5 } });
  F({ id: 'f_guerra_regional', title: 'Grande guerra regional', sev: 'alerta', prob: 0.006, cooldown: 40, text: 'Um conflito entre potências regionais desorganiza o comércio e os mercados de energia.', eff: (st) => ({ world: { oil: 25, growth: -0.8 }, infl: H.oilImp(st), confidence: -3 }) });

  S.EVENTS.add(ev);
})(globalThis.S = globalThis.S || {});
