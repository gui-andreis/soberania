// Regimes, ideologias e grupos de interesse.
(function (S) {
  'use strict';
  const P = {};

  // e = eixo econômico (-100 estatista/esquerda .. +100 mercado/direita)
  // s = eixo social (-100 progressista/libertário .. +100 conservador/autoritário)
  P.ideologies = {
    comunista: { name: 'Comunista', e: -90, s: 10, desc: 'Propriedade estatal dos meios de produção, planejamento central.' },
    socialista: { name: 'Socialista / Esquerda', e: -62, s: -35, desc: 'Estado forte, redistribuição, direitos trabalhistas e estatais estratégicas.' },
    populista: { name: 'Nacional-populista de esquerda', e: -45, s: 25, desc: 'Trabalhismo, nacionalismo econômico, carisma do líder (varguismo, peronismo, chavismo).' },
    socdem: { name: 'Social-democrata', e: -28, s: -30, desc: 'Economia de mercado com Estado de bem-estar robusto.' },
    centro: { name: 'Centro', e: 5, s: 5, desc: 'Pragmatismo, coalizões amplas, reformas graduais.' },
    liberal: { name: 'Liberal', e: 65, s: -25, desc: 'Livre mercado, Estado enxuto, privatizações e abertura comercial.' },
    conservador: { name: 'Conservador / Centro-direita', e: 40, s: 45, desc: 'Ordem, tradição, responsabilidade fiscal, pró-mercado moderado.' },
    nacionalista: { name: 'Nacionalista / Direita radical', e: 25, s: 75, desc: 'Soberania, segurança, valores tradicionais, desconfiança de instituições externas.' },
    fascista: { name: 'Fascista / Corporativista', e: 0, s: 95, desc: 'Estado corporativo, culto ao líder, supressão de oposição. Historicamente associado à década de 1920-40.', minYear: 1919, maxYear: 2100 },
    teocratico: { name: 'Teocrático', e: -10, s: 95, desc: 'Lei religiosa como base do Estado.' }
  };

  P.regimes = {
    presidencialista: { name: 'Democracia presidencialista', democracy: true, elections: true, parliament: false, repression: 0.1, press: 75, legitBase: 60, coupMult: 1, desc: 'Presidente eleito com mandato fixo; depende do Congresso para aprovar reformas.' },
    parlamentarista: { name: 'Democracia parlamentarista', democracy: true, elections: true, parliament: true, repression: 0.1, press: 80, legitBase: 62, coupMult: 0.8, desc: 'Governo depende da maioria do parlamento; pode cair por moção de desconfiança.' },
    semipresidencialista: { name: 'Semipresidencialismo', democracy: true, elections: true, parliament: true, repression: 0.12, press: 75, legitBase: 60, coupMult: 0.9, desc: 'Presidente eleito divide poder com primeiro-ministro.' },
    hegemonico: { name: 'Regime de partido hegemônico', democracy: false, elections: true, rigged: 0.7, parliament: false, repression: 0.45, press: 35, legitBase: 50, coupMult: 0.8, desc: 'Eleições existem, mas o partido no poder controla máquina, mídia e apuração.' },
    monarquia_abs: { name: 'Monarquia absoluta', democracy: false, elections: false, parliament: false, repression: 0.6, press: 20, legitBase: 50, coupMult: 1.1, desc: 'O monarca concentra todos os poderes.' },
    militar: { name: 'Ditadura militar', democracy: false, elections: false, parliament: false, repression: 0.75, press: 15, legitBase: 40, coupMult: 1.6, desc: 'Junta ou general no poder; censura e repressão; golpes internos são frequentes.' },
    partido_unico: { name: 'Estado de partido único', democracy: false, elections: false, parliament: false, repression: 0.8, press: 8, legitBase: 50, coupMult: 0.6, desc: 'Um partido controla o Estado, a economia e a informação.' },
    autocracia: { name: 'Autocracia personalista', democracy: false, elections: false, parliament: false, repression: 0.65, press: 20, legitBase: 45, coupMult: 1.2, desc: 'Poder concentrado em um líder, com instituições esvaziadas.' },
    teocracia: { name: 'Teocracia', democracy: false, elections: true, rigged: 0.5, parliament: false, repression: 0.7, press: 15, legitBase: 50, coupMult: 0.7, desc: 'Clero comanda o Estado; eleições sob tutela religiosa.' }
  };

  // Grupos de interesse. e/s = posição ideológica média; power = peso em estabilidade (não-eleitoral)
  P.groups = {
    trabalhadores: { name: 'Trabalhadores urbanos', e: -45, s: 20, power: 1.0 },
    pobres: { name: 'Pobres e informais', e: -55, s: 35, power: 0.6 },
    classe_media: { name: 'Classe média', e: 15, s: 5, power: 1.1 },
    empresarios: { name: 'Empresários / indústria', e: 60, s: 20, power: 1.4 },
    financeiro: { name: 'Mercado financeiro', e: 75, s: -10, power: 1.3 },
    agro: { name: 'Agro / elites rurais', e: 50, s: 55, power: 1.2 },
    militares: { name: 'Militares', e: 20, s: 65, power: 1.6 },
    religiosos: { name: 'Religiosos', e: 5, s: 80, power: 0.9 },
    servidores: { name: 'Servidores públicos', e: -35, s: -5, power: 0.8 },
    estudantes: { name: 'Jovens e estudantes', e: -40, s: -60, power: 0.7 },
    sindicatos: { name: 'Sindicatos', e: -70, s: -5, power: 1.0 }
  };
  P.groupIds = Object.keys(P.groups);

  // Peso eleitoral de cada grupo conforme urbanização e religiosidade
  P.groupWeights = function (urban, religiosity, year) {
    const rural = 100 - urban;
    const w = {
      trabalhadores: 0.08 + urban * 0.0018,
      pobres: 0.08 + rural * 0.0016,
      classe_media: 0.04 + urban * 0.0016,
      empresarios: 0.03,
      financeiro: 0.012 + (year > 1980 ? 0.008 : 0),
      agro: 0.02 + rural * 0.0012,
      militares: 0.03,
      religiosos: 0.02 + religiosity * 0.0009,
      servidores: 0.03 + (year > 1950 ? 0.02 : 0),
      estudantes: 0.03 + urban * 0.0005 + (year > 1960 ? 0.02 : 0),
      sindicatos: 0.02 + urban * 0.0004
    };
    const tot = S.U.sum(Object.values(w));
    for (const k in w) w[k] /= tot;
    return w;
  };

  // Afinidade inicial de um grupo com a ideologia do governante (0-100)
  P.initialGroupApproval = function (gid, ideo) {
    const g = P.groups[gid];
    const dist = Math.hypot(g.e - ideo.e, (g.s - ideo.s) * 0.7);
    return S.U.clamp(78 - dist * 0.38, 18, 85);
  };

  S.POLITICS = P;
})(globalThis.S = globalThis.S || {});
