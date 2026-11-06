// COMPOSER: interpretador offline de ordens livres que CRIA medidas novas (sem IA).
// Em vez de procurar uma carta pronta, entende a ordem como  alavanca + verbo + quantidade + prazo
//   "Congelar o salário mínimo por três meses sem repor a inflação"
//   "Aumentar o imposto de renda em 5 pontos", "Cortar 20% do gasto militar", "Proibir importações por 1 ano"
// e calcula os efeitos a partir do estado atual do país (inflação, orçamento, indexação...).
// Os efeitos gerados são objetos JSON simples (vão no save) e passam pelo mesmo motor das cartas.
// O que não couber em nenhuma alavanca precisa da IA (Gemini) — a interface avisa.
(function (S) {
  'use strict';
  const U = S.U, H = S.H;
  const C = {};

  // ---------------- leitura do texto ----------------
  const NUMW = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, dezoito: 18, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, meio: 0.5, meia: 0.5 };
  const NUMRE = '(-?\\d+(?:[.,]\\d+)?|' + Object.keys(NUMW).join('|') + ')';
  const toNum = (s) => (s in NUMW ? NUMW[s] : parseFloat(String(s).replace(',', '.')));
  C.norm = function (s) {
    return U.stripAccents(String(s || '')).replace(/(^|\s)-(?=\d)/g, '$1§').replace(/[^a-z0-9%,.;§ ]/g, ' ').replace(/§/g, '-').replace(/\s+/g, ' ').trim();
  };

  const V_UP = /\b(aumentar|aumente|aumento|subir|suba|elevar|eleve|ampliar|amplie|expandir|reajustar|reajuste|dobrar|triplicar|criar|instituir|introduzir|investir|turbinar|majorar|mais)\b/;
  const V_DOWN = /\b(reduzir|reduza|reducao|cortar|corte|corta|baixar|baixe|diminuir|diminua|abaixar|enxugar|zerar|zere|eliminar|acabar|extinguir|retirar|remover|tirar|menos)\b/;
  const V_FREEZE = /\b(congelar|congele|congelamento|travar|trave|tabelar|tabele|tabelamento|segurar)\b|\bsem (repor|reposicao|reajuste|reajustar|correcao|corrigir)\b|\bnao (reajustar|corrigir|repor)\b/;
  const V_BAN = /\b(proibir|proiba|banir|bloquear|vetar|impedir|suspender|restringir|limitar)\b/;
  const V_FREE = /\b(liberar|libere|liberalizar|abrir|facilitar)\b/;

  function verbOf(t) {
    // o verbo que aparece primeiro na cláusula decide (ex.: "reduzir o consumo congelando..." não acontece pois a finalidade é removida)
    const cand = [['freeze', V_FREEZE], ['ban', V_BAN], ['free', V_FREE], ['down', V_DOWN], ['up', V_UP]]
      .map(([k, re]) => { const m = t.match(re); return m ? { k: k, i: m.index } : null; }).filter(Boolean).sort((a, b) => a.i - b.i);
    if (!cand.length) return null;
    // "sem repor a inflação" é qualificador forte de congelamento mesmo que outro verbo apareça antes
    if (/\bsem (repor|reposicao|reajuste|correcao)|\bnao (reajustar|repor|corrigir)/.test(t) && cand[0].k !== 'down') return 'freeze';
    return cand[0].k;
  }
  function durationOf(t) {
    const m = t.match(new RegExp('\\b(?:por|durante|ao longo de|pelos proximos|pelas proximas|nos proximos|nas proximas)\\s+(?:os\\s+|as\\s+)?' + NUMRE + '\\s+(dia|dias|semana|semanas|mes|meses|trimestre|trimestres|semestre|semestres|ano|anos)\\b'));
    if (m) {
      const n = toNum(m[1]), u = m[2];
      const months = u.startsWith('dia') ? n / 30 : u.startsWith('semana') ? n / 4.3 : u.startsWith('mes') ? n : u.startsWith('trimestre') ? n * 3 : u.startsWith('semestre') ? n * 6 : n * 12;
      return Math.max(1, Math.round(months));
    }
    if (/\b(um|1) ano\b/.test(t) && /\bpor\b/.test(t)) return 12;
    if (/\btemporari/.test(t)) return 6;
    return null;
  }
  function amountOf(t) {
    // % ou "pontos"; "pela metade", "dobrar", "zerar"
    if (/\bpela metade\b|\bmetade\b/.test(t)) return { v: 50, unit: '%', half: true };
    if (/\bdobrar\b/.test(t)) return { v: 100, unit: '%' };
    if (/\btriplicar\b/.test(t)) return { v: 200, unit: '%' };
    if (/\bzerar\b|\bzere\b|\beliminar\b|\bacabar com\b|\bextinguir\b/.test(t)) return { v: 100, unit: '%', zero: true };
    let m = t.match(/(-?\d+(?:[.,]\d+)?)\s*(%|por cento)\s*(do pib)?/);
    if (m) return { v: Math.abs(parseFloat(m[1].replace(',', '.'))), unit: m[3] ? 'pib' : '%' };
    m = t.match(new RegExp(NUMRE + '\\s*(pontos? percentua(?:l|is)|pontos?|p\\.?p\\.?)(\\s+do pib)?'));
    if (m) return { v: Math.abs(toNum(m[1])), unit: m[3] ? 'pib' : 'pp' };
    return null;
  }
  // remove a finalidade ("pra reduzir o consumo e frear a inflação"): não é ordem, é o motivo
  function stripGoal(t) {
    return t.replace(/\b(pra|para|a fim de|afim de|visando|com o objetivo de|com objetivo de|de modo a|de forma a|com intuito de|com o intuito de|e assim|e consequentemente|consequentemente|porque|pois)\s+(?!\d|-\d)(?:o |a |os |as )?[a-z]+(?:ar|er|ir|ndo)\b.*$/, '').trim();
  }

  // ---------------- utilidades de efeito ----------------
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  function grp(o, scale) {
    const out = {};
    for (const g in o) { const v = U.clamp(o[g] * (scale || 1), -28, 28); if (Math.abs(v) >= 0.5) out[g] = r1(v); }
    return out;
  }
  const turnsOf = (months) => Math.max(1, Math.round(months / 3));
  const durTxt = (months) => months >= 12 && months % 12 === 0 ? (months / 12) + (months === 12 ? ' ano' : ' anos') : months + (months === 1 ? ' mês' : ' meses');
  // perda real de um valor nominal congelado por m meses com inflação pi
  const realLoss = (pi, m) => (1 - Math.pow(1 + Math.max(0, pi) / 100, -m / 12)) * 100;

  // ---------------- alavancas ----------------
  const LEVERS = [];
  const lever = (id, match, build) => LEVERS.push({ id: id, match: match, build: build });

  // ===== impostos (vem antes para "imposto sobre combustível" não cair em combustível) =====
  const TAXCAT = [
    ['renda', /imposto de renda|\bir\b|irpf|renda/, 'imposto de renda'],
    ['consumo', /consumo|\biva\b|icms|\bipi\b|vendas|mercadorias|produtos/, 'impostos sobre consumo'],
    ['empresas', /empresa|lucro|corporativ|pessoa juridica|irpj|csll/, 'imposto sobre empresas'],
    ['comercio', /importa|tarifa|alfandeg|aduan/, 'tarifas de importação'],
    ['exportacao', /exporta/, 'imposto sobre exportações'],
    ['financeiro', /transac|\biof\b|cpmf|financeir|bancos/, 'imposto sobre transações financeiras'],
    ['fortunas', /fortuna|patrimonio|riqueza|bilionari|milionari|heranca/, 'imposto sobre patrimônio']
  ];
  // por ponto de alíquota: [carga tributária (% PIB), efeitos extras, grupos]
  const TAXFX = {
    renda: { tax: 0.33, ex: { gini: -0.2, demand: -0.05 }, g: { classe_media: -2.7, financeiro: -2.7, empresarios: -1.3, pobres: 1, sindicatos: 1.3 }, ideo: -40 },
    consumo: { tax: 0.43, ex: { infl: 0.33, gini: 0.13, demand: -0.07 }, g: { pobres: -2, classe_media: -2, trabalhadores: -1.7, financeiro: 1 }, ideo: 10 },
    empresas: { tax: 0.2, ex: { investShift: -0.25, confidence: -1 }, g: { empresarios: -3, financeiro: -1.5, sindicatos: 1 }, ideo: -45 },
    comercio: { tax: 0, ex: { open: -0.004, industry: 0.3, infl: 0.08, tb: 0.03 }, g: { empresarios: 0.6, sindicatos: 0.4, classe_media: -0.5, agro: -0.2 }, ideo: -25 },
    exportacao: { tax: 0, ex: { infl: -0.05 }, g: { agro: -1.8, pobres: 0.3, sindicatos: 0.3 }, ideo: -40 },
    financeiro: { tax: 0.5, ex: {}, g: { classe_media: -3, financeiro: -4, empresarios: -2.5 }, ideo: -15 },
    fortunas: { tax: 0.3, ex: { gini: -0.4, confidence: -6, reserves: -0.8 }, g: { financeiro: -14, empresarios: -10, sindicatos: 8, estudantes: 8, pobres: 4 }, ideo: -60 }
  };
  const TAXSHARE = { renda: 0.28, consumo: 0.4, empresas: 0.12, financeiro: 0.04, fortunas: 0.01 };
  lever('imposto', (t) => /imposto|tributo|tributar|taxar|aliquota|\biva\b|icms|\bipi\b|\bir\b|cpmf|\biof\b|tarifas? (de )?importa|tarifas? alfandeg/.test(t), function (st, t, v, amt, months) {
    const cat = (TAXCAT.find((c) => c[1].test(t)) || ['consumo', null, 'impostos sobre consumo']);
    const k = cat[0], F = TAXFX[k];
    let dir = v === 'down' || v === 'free' ? -1 : v === 'up' || v === 'ban' ? 1 : 0;
    if (/\btaxar\b|\btributar\b|\bcriar\b/.test(t) && !V_DOWN.test(t)) dir = 1;
    if (!dir) return null;
    let pts = amt ? (amt.unit === 'pib' ? amt.v / Math.max(0.05, F.tax || 0.1) : amt.v) : (k === 'comercio' || k === 'exportacao' ? 10 : 3);
    const cur = st.e.taxes[k] || 0;
    let taxDelta = pts * F.tax;
    if (amt && amt.zero) { // zerar: derruba a parcela da arrecadação daquele tributo
      if (k === 'comercio' || k === 'exportacao') { pts = Math.max(0, cur); taxDelta = 0; }
      else { taxDelta = st.e.tax * (TAXSHARE[k] || 0.05); pts = taxDelta / Math.max(0.05, F.tax); }
    }
    if ((k === 'comercio' || k === 'exportacao') && dir < 0) pts = Math.min(pts, Math.max(0, cur));
    if (k === 'fortunas') { pts = 1; taxDelta = 0.3; }
    if (pts <= 0) return { fail: `Não há ${cat[2]} para reduzir.` };
    pts = Math.min(pts, 60);
    const eff = { tax: r2(dir * taxDelta), taxes: { [k]: r1(dir * pts) } };
    for (const x in F.ex) eff[x] = r2(dir * F.ex[x] * (k === 'fortunas' ? 1 : pts));
    if (k === 'comercio') eff.rel = { '*': r1(-dir * Math.min(8, pts * 0.2)) };
    eff.groups = grp(F.g, dir * (k === 'fortunas' ? 1 : pts));
    // impostos muito altos geram sonegação, fuga e protestos
    if (dir > 0 && taxDelta > 3) { eff.protests = r1(taxDelta * 2); eff.confidence = r1((eff.confidence || 0) - taxDelta * 1.5); }
    if (dir < 0 && taxDelta > 2) eff.confidence = r1((eff.confidence || 0) - (taxDelta - 2) * 1.5); // buraco fiscal assusta o mercado
    if (months) eff.lag = [{ turns: turnsOf(months), eff: { tax: r2(-eff.tax), taxes: { [k]: r1(-dir * pts) } }, note: `Fim da mudança temporária em ${cat[2]}.` }];
    const verb = amt && amt.zero ? 'Zerar' : dir > 0 ? 'Aumentar' : 'Reduzir';
    const qty = amt && amt.zero ? '' : ` em ${U.fmt(pts, pts < 10 ? 1 : 0)} ponto(s)`;
    return {
      name: `${verb} ${cat[2]}${qty}${months ? ' por ' + durTxt(months) : ''}`,
      desc: `Carga tributária ${dir > 0 ? '+' : '−'}${U.fmt(Math.abs(taxDelta), 1)}% do PIB.` + (k === 'consumo' ? ' Imposto sobre consumo mexe direto nos preços e pesa mais nos pobres.' : '') + (dir < 0 && taxDelta > 1 ? ' Sem corte de gastos equivalente, o déficit sobe.' : ''),
      ideo: { e: dir * F.ideo, s: k === 'comercio' ? dir * 30 : 0 }, eff: eff, cost: taxDelta > 3 ? 2 : 1, congress: U.clamp(0.25 + Math.abs(taxDelta) * 0.08, 0.2, 0.85)
    };
  });

  // ===== salário mínimo =====
  lever('salario_minimo', (t) => /salario minimo|piso salarial|piso nacional|\bo minimo\b|\bdo minimo\b/.test(t), function (st, t, v, amt, months) {
    const e = st.e, pi = Math.max(0, e.infl);
    if (v === 'freeze' || (v === 'down' && !amt && /sem (repor|reajuste|reposicao)/.test(t))) {
      const m = months || 12;
      const wi = Math.max(0, e.wageIndex || 0);
      const loss = realLoss(pi, m) * Math.max(0.15, wi); // perda extra em relação ao reajuste que viria
      const L = Math.min(40, loss);
      return {
        name: `Congelar o salário mínimo por ${durTxt(m)} (sem repor a inflação)`,
        desc: `Com inflação de ${U.fmt(pi, 1)}% a.a., o piso perde ≈${U.fmt(L, 1)}% do poder de compra no período. Menos renda → menos consumo → menos pressão sobre os preços; em troca, mais pobreza, desgaste com trabalhadores e sindicatos.` + (wi < 0.1 ? ' Atenção: o piso já não tem reajuste automático, então o efeito é pequeno.' : ''),
        ideo: { e: 35, s: 0 },
        eff: {
          wageIndex: r2(-wi), confidence: r1(Math.min(4, 1 + L * 0.15)), protests: r1(L * 0.4),
          groups: grp({ trabalhadores: -(3 + L * 0.8), sindicatos: -(4 + L), pobres: -(2 + L * 0.6), empresarios: 2 + L * 0.35, financeiro: 1 + L * 0.2 }),
          lag: [{ turns: turnsOf(m), eff: { wageIndex: r2(wi) }, note: 'Acabou o congelamento do salário mínimo: os reajustes voltaram (a perda do período não é reposta).' }]
        },
        cost: 1, congress: 0.25
      };
    }
    if (v === 'up') {
      const p = Math.min(200, amt ? (amt.unit === '%' ? amt.v : amt.v) : 10);
      const eff = {
        minWage: r1(p), infl: r1(p * 0.06 + Math.max(0, p - 20) * 0.08), unemp: r1(p * (e.unemp < 6 ? 0.05 : 0.025) + Math.max(0, p - 25) * 0.05),
        budget: { previdencia: r2(e.budget.previdencia * p * 0.003) }, uStar: r2(Math.max(0, p - 15) * 0.02),
        groups: grp({ trabalhadores: 0.8 * p, sindicatos: 0.8 * p, pobres: 0.6 * p, empresarios: -0.8 * p, financeiro: -0.4 * p }), confidence: r1(-Math.max(0, p - 10) * 0.3)
      };
      if (months) eff.lag = [{ turns: turnsOf(months), eff: { minWage: r1(-p) }, note: 'O aumento temporário do salário mínimo acabou.' }];
      return { name: `Aumentar o salário mínimo em ${U.fmt(p, 0)}% (ganho real)${months ? ' por ' + durTxt(months) : ''}`, desc: 'Mais renda e consumo na base; custo para empresas e previdência. Aumentos grandes geram inflação e informalidade.', ideo: { e: -35, s: 0 }, eff: eff, cost: p > 25 ? 2 : 1, congress: U.clamp(0.25 + p / 100, 0.25, 0.9) };
    }
    if (v === 'down') {
      const p = Math.min(80, amt ? amt.v : 10);
      return {
        name: `Cortar o salário mínimo nominal em ${U.fmt(p, 0)}%`, desc: 'Corte nominal do piso: raríssimo na história, derruba consumo e aprovação, gera protestos.', ideo: { e: 55, s: 10 },
        eff: { minWage: r1(-p), infl: r1(-p * 0.04), protests: r1(p * 1.2), legit: r1(-p * 0.25), unemp: r1(-p * 0.02), groups: grp({ trabalhadores: -1.4 * p, sindicatos: -1.5 * p, pobres: -1.1 * p, classe_media: -0.3 * p, empresarios: 0.6 * p }) },
        cost: 2, congress: 0.7
      };
    }
    return null;
  });

  // ===== salário dos servidores =====
  lever('servidores', (t) => /servidor|funcionalismo|funcionarios publicos|salario dos professores|salario dos policiais|folha do governo/.test(t) && /salari|remunera|reajust|congel|vencimento|folha/.test(t), function (st, t, v, amt, months) {
    const e = st.e, adm = e.budget.admin, pi = Math.max(0, e.infl);
    if (v === 'freeze') {
      const m = months || 12;
      const cut = Math.min(adm * 0.4, adm * realLoss(pi, m) / 100 * 0.6);
      return { name: `Congelar salários dos servidores por ${durTxt(m)}`, desc: `A inflação de ${U.fmt(pi, 1)}% corrói a folha: economia de ≈${U.fmt(cut, 2)}% do PIB.`, ideo: { e: 35, s: 0 },
        eff: { budget: { admin: r2(-cut) }, groups: grp({ servidores: -(5 + cut * 25), sindicatos: -3, financeiro: 3 }), protests: r1(cut * 10) }, cost: 1, congress: 0.2 };
    }
    const p = Math.min(80, amt ? amt.v : 10);
    const d = adm * p / 100 * 0.6 * (v === 'up' ? 1 : v === 'down' ? -1 : 0);
    if (!d) return null;
    const eff = { budget: { admin: r2(d) }, demand: r2(d * 0.2), groups: grp({ servidores: (v === 'up' ? 0.9 : -1.6) * p, sindicatos: (v === 'up' ? 0.3 : -0.6) * p, financeiro: (v === 'up' ? -0.3 : 0.3) * p }) };
    if (v === 'down') { eff.protests = r1(p * 0.8); eff.confidence = r1(p * 0.15); }
    if (months) eff.lag = [{ turns: turnsOf(months), eff: { budget: { admin: r2(-d) } }, note: 'Acabou a mudança temporária nos salários dos servidores.' }];
    return { name: `${v === 'up' ? 'Reajustar' : 'Cortar'} salários dos servidores em ${U.fmt(p, 0)}%`, desc: `Folha ${d > 0 ? '+' : '−'}${U.fmt(Math.abs(d), 2)}% do PIB.`, ideo: { e: v === 'up' ? -25 : 45, s: 0 }, eff: eff, cost: p > 20 ? 2 : 1, congress: v === 'down' ? 0.55 : 0.2 };
  });

  // ===== aluguéis =====
  lever('alugueis', (t) => /aluguel|alugueis|aluguer|inquilin|locac/.test(t), function (st, t, v, amt, months) {
    if (v !== 'freeze' && v !== 'down' && v !== 'ban') return null;
    const m = months || 12;
    return { name: `Congelar os aluguéis por ${durTxt(m)}`, desc: 'Alivia inquilinos agora; proprietários retiram imóveis do mercado e a oferta encolhe depois.', ideo: { e: -40, s: 0 },
      eff: { infl: r1(-Math.min(1.5, 0.3 + st.e.infl * 0.01)), groups: grp({ pobres: 8, trabalhadores: 5, estudantes: 6, classe_media: 2, empresarios: -6, financeiro: -4 }),
        lag: [{ turns: turnsOf(m), eff: { investShift: r2(-0.1 * turnsOf(m)), infl: r1(0.3 + m * 0.05), poverty: 0.3 }, note: 'Fim do congelamento dos aluguéis: reajustes represados e falta de imóveis.' }] }, cost: 1, congress: 0.35 };
  });

  // ===== combustíveis e energia =====
  lever('combustivel', (t) => /gasolina|diesel|combustive|etanol|\bgas de cozinha|botijao|energia eletrica|conta de luz|\bluz\b|eletricidade|tarifa de energia/.test(t), function (st, t, v, amt, months) {
    const e = st.e;
    const item = /luz|energia|eletric/.test(t) ? 'da energia elétrica' : /botijao|gas de cozinha/.test(t) ? 'do gás de cozinha' : 'dos combustíveis';
    if (v === 'freeze' || v === 'down') {
      const m = months || 12;
      const p = v === 'down' ? Math.min(60, amt ? amt.v : 10) : 0;
      const sub = Math.min(3, 0.3 + Math.max(0, e.infl) * 0.015 + p * 0.04 + (H.oilImp(st) * 0.4));
      const stateOil = st.sectors.petroleo === 'estatal' || st.sectors.energia === 'estatal';
      const eff = { budget: { subsidios: r2(sub) }, infl: r1(-(0.6 + p * 0.06)), groups: grp({ classe_media: 6 + p * 0.2, trabalhadores: 5 + p * 0.2, agro: 4, pobres: 3, financeiro: -5 - p * 0.15 }),
        lag: [{ turns: turnsOf(m), eff: { budget: { subsidios: r2(-sub) }, infl: r1(0.6 + p * 0.05 + m * 0.04), groups: { classe_media: -4, trabalhadores: -3 } }, note: `Fim do ${v === 'freeze' ? 'congelamento' : 'desconto'} do preço ${item}: o preço represado foi repassado.` }] };
      if (stateOil) { eff.debt = r1(sub * 0.5); eff.confidence = -3; }
      return { name: `${v === 'freeze' ? 'Congelar' : 'Baixar em ' + U.fmt(p, 0) + '%'} o preço ${item} por ${durTxt(m)}`, desc: `Subsídio de ≈${U.fmt(sub, 1)}% do PIB enquanto durar${stateOil ? ' (prejuízo também nas estatais)' : ''}. Segura a inflação agora; o represamento volta depois.`, ideo: { e: -25, s: 5 }, eff: eff, cost: sub > 1.5 ? 2 : 1, congress: 0 };
    }
    if (v === 'up') {
      const cut = Math.min(e.budget.subsidios, amt ? e.budget.subsidios * amt.v / 100 : 1);
      if (cut < 0.05) return { fail: 'Quase não há subsídios para retirar.' };
      return { name: `Reajustar o preço ${item} (retirar subsídio)`, desc: 'Bom para o fiscal; pressiona a inflação e pode gerar protestos.', ideo: { e: 45, s: 0 },
        eff: { budget: { subsidios: r2(-cut) }, infl: r1(cut * 2), protests: r1(5 + e.poverty * 0.2 * cut), confidence: r1(cut * 5), groups: grp({ pobres: -9, trabalhadores: -7, classe_media: -6, agro: -4, financeiro: 7 }, Math.min(2, cut)) }, cost: 1, congress: 0 };
    }
    return null;
  });

  // ===== preços de alimentos =====
  lever('alimentos', (t) => /alimento|comida|cesta basica|\bcarne\b|\barroz\b|feijao|\bpao\b|\bleite\b|\bovo/.test(t) && !/exporta|importa/.test(t), function (st, t, v, amt, months) {
    if (v !== 'freeze' && v !== 'down') return null;
    const m = months || 6;
    return { name: `Tabelar o preço dos alimentos por ${durTxt(m)}`, desc: 'Preço máximo por decreto. Alivia o bolso; produtores reduzem a oferta e aparecem filas e mercado paralelo.', ideo: { e: -45, s: 10 },
      eff: { infl: r1(-Math.min(3, 0.8 + st.e.infl * 0.02)), shortage: r1(4 + m * 0.8), groups: grp({ pobres: 10, trabalhadores: 6, classe_media: 3, agro: -14, empresarios: -6 }),
        lag: [{ turns: turnsOf(m), eff: { infl: r1(1 + m * 0.2), groups: { pobres: -4 } }, note: 'Fim do tabelamento dos alimentos: preços reprimidos subiram de uma vez.' }] }, cost: 1, congress: 0 };
  });

  // ===== congelamento geral de preços =====
  lever('precos', (t) => /\bprecos\b|\bpreco\b|tabelamento|tabelar/.test(t), function (st, t, v, amt, months) {
    if (v !== 'freeze' && v !== 'ban') return null;
    const m = months || 9, q = turnsOf(m);
    const pi = Math.max(0, st.e.infl);
    return { name: `Congelar todos os preços por ${durTxt(m)}`, desc: `Inflação cai na hora; sem ajuste fiscal, volta com força e falta produto nas prateleiras (Cruzado 1986). Quanto mais longo, maior a escassez.`, ideo: { e: -50, s: 20 },
      eff: { flags: { congelamento: true }, inflMult: 0.25, groups: grp({ pobres: 14, trabalhadores: 10, classe_media: 10, empresarios: -12, agro: -8, financeiro: -6 }),
        lag: [{ turns: q, eff: { unflag: 'congelamento', infl: r1(10 + pi * 0.25 + q * 3), inflExp: r1(8 + q * 2), confidence: -6, groups: { classe_media: -12, pobres: -10, trabalhadores: -8 } }, note: 'O congelamento de preços acabou: a inflação reprimida voltou.' }] },
      cost: 2, congress: 0 };
  });

  // ===== gastos do orçamento =====
  const BUDCAT = [
    ['saude', /saude|hospita|\bsus\b|medic/, 'saúde', { pobres: 1, classe_media: 0.7, trabalhadores: 0.5 }],
    ['educacao', /educac|escola|ensino|universidad|professor/, 'educação', { estudantes: 1.2, classe_media: 0.6, pobres: 0.5 }],
    ['militar', /militar|defesa|forcas armadas|exercito|marinha|aeronautica/, 'defesa', { militares: 1.6 }],
    ['infra', /infraestrutura|obras|estrada|rodovia|ferrovia|ponte/, 'infraestrutura', { empresarios: 0.7, trabalhadores: 0.6 }],
    ['previdencia', /previdencia|aposentad|pensao|pensoes|inss/, 'previdência', { trabalhadores: 0.6, servidores: 0.6, pobres: 0.4 }],
    ['social', /social|assistencia|bolsa|transferencia|programas sociais/, 'assistência social', { pobres: 1.4 }],
    ['subsidios', /subsidio/, 'subsídios', { agro: 0.7, classe_media: 0.5, empresarios: 0.4 }],
    ['admin', /administrac|maquina publica|custeio|ministerio|burocracia/, 'administração', { servidores: 1.2 }]
  ];
  lever('gasto', (t) => /gasto|gastos|orcamento|verba|despesa|investir|investimento em|investimentos em|financiamento d/.test(t) || (V_DOWN.test(t) && BUDCAT.some((c) => c[1].test(t)) && /\bcortar|enxugar\b/.test(t)), function (st, t, v, amt, months) {
    const c = BUDCAT.find((x) => x[1].test(t));
    if (!c) return null;
    let dir = v === 'up' ? 1 : v === 'down' ? -1 : 0;
    if (/\binvestir\b/.test(t) && !dir) dir = 1;
    if (!dir) return null;
    const cur = st.e.budget[c[0]] || 0;
    let d = amt ? (amt.unit === 'pib' || amt.unit === 'pp' ? amt.v : cur * amt.v / 100) : Math.max(0.2, cur * 0.1);
    if (amt && amt.zero) d = cur;
    if (dir < 0) d = Math.min(d, cur);
    d = Math.min(d, 6);
    if (d < 0.01) return { fail: `Quase não há gasto com ${c[2]} para cortar.` };
    const eff = { budget: { [c[0]]: r2(dir * d) }, demand: r2(dir * d * 0.35), groups: grp(c[3], dir * Math.min(14, d * 8)) };
    if (dir < 0) eff.confidence = r1(Math.min(8, d * 3));
    if (dir > 0 && st.e.debt > st.e.debtTol) eff.confidence = r1(-Math.min(8, d * 3));
    if (c[0] === 'saude' && dir > 0) eff.lag = [{ turns: 6, eff: { health: r1(d * 2) } }];
    if (c[0] === 'educacao' && dir > 0) eff.lag = [{ turns: 10, eff: { education: r1(d * 2), gpot: r2(d * 0.04) } }];
    if (c[0] === 'infra' && dir > 0) eff.lag = [{ turns: 8, eff: { infra: r1(d * 2), gpot: r2(d * 0.05) } }];
    if (c[0] === 'militar') eff.strength = r1(dir * d * 6);
    if (dir < 0 && d > 1) eff.protests = r1(d * 3);
    if (months) (eff.lag = eff.lag || []).push({ turns: turnsOf(months), eff: { budget: { [c[0]]: r2(-dir * d) } }, note: `Fim da mudança temporária no gasto com ${c[2]}.` });
    const ideoE = dir > 0 ? (c[0] === 'militar' ? 5 : -30) : 40;
    return { name: `${dir > 0 ? 'Aumentar' : (amt && amt.zero ? 'Zerar' : 'Cortar')} o gasto com ${c[2]} em ${U.fmt(d, 2)}% do PIB${months ? ' por ' + durTxt(months) : ''}`, desc: `Hoje: ${U.fmt(cur, 2)}% do PIB → ${U.fmt(Math.max(0, cur + dir * d), 2)}%.`, ideo: { e: ideoE, s: c[0] === 'militar' ? dir * 25 : 0 }, eff: eff, cost: d > 1.5 ? 2 : 1, congress: U.clamp(0.2 + d * 0.12 + (dir < 0 ? 0.1 : 0), 0.2, 0.85) };
  });

  // ===== importações / exportações =====
  lever('comercio', (t) => /importa|exporta/.test(t) && (V_BAN.test(t) || V_FREE.test(t) || V_DOWN.test(t) || V_UP.test(t)), function (st, t, v, amt, months) {
    const imp = /importa/.test(t);
    const ban = V_BAN.test(t), total = /\bproibir|banir|vetar\b/.test(t);
    const eff = {};
    let name, desc, ideo;
    if (imp && (ban || v === 'down')) {
      const s = total ? 1 : 0.5;
      Object.assign(eff, { taxes: { comercio: r1(25 * s) }, open: r2(-0.08 * s), industry: r1(4 * s), infl: r1((1 + st.e.open * 6) * s), shortage: r1(st.e.open * 20 * s), tb: r1(0.8 * s), rel: { '*': r1(-5 * s) }, gpot: r2(-0.08 * s), groups: grp({ empresarios: 4, sindicatos: 4, classe_media: -8, agro: -3 }, s * 1.5) });
      name = `${total ? 'Proibir' : 'Restringir'} importações`; desc = 'Protege a indústria local no curto prazo; produtos somem ou encarecem, parceiros retaliam e a produtividade cai.'; ideo = { e: -30, s: 35 };
    } else if (imp && (v === 'free' || v === 'up')) {
      Object.assign(eff, { taxes: { comercio: r1(-Math.min(10, st.e.taxes.comercio || 0)) }, open: 0.06, industry: -3, infl: -0.8, gpot: 0.08, rel: { '*': 3 }, groups: grp({ empresarios: -6, classe_media: 7, sindicatos: -6, agro: 3 }) });
      name = 'Liberar importações'; desc = 'Mais concorrência e produtos baratos; indústria protegida sofre.'; ideo = { e: 45, s: -10 };
    } else if (!imp && (ban || v === 'down')) {
      const s = total ? 1 : 0.5;
      Object.assign(eff, { infl: r1(-1.2 * s), tb: r1(-1.5 * s), reserves: r1(-1 * s), rel: { '*': r1(-3 * s) }, groups: grp({ agro: -18, empresarios: -6, pobres: 4, trabalhadores: 2 }, s) });
      name = `${total ? 'Proibir' : 'Restringir'} exportações`; desc = 'Barateia o produto no mercado interno; derruba dólares, investimento e relações comerciais (Argentina, carne 2006).'; ideo = { e: -40, s: 10 };
    } else return null;
    if (months) eff.lag = [{ turns: turnsOf(months), eff: Object.assign({ open: eff.open ? -eff.open : 0 }, eff.taxes ? { taxes: { comercio: -eff.taxes.comercio } } : {}), note: `Fim da medida temporária: ${name.toLowerCase()}.` }];
    return { name: name + (months ? ' por ' + durTxt(months) : ''), desc: desc, ideo: ideo, eff: eff, cost: 1, congress: 0.2 };
  });

  // ---------------- composição ----------------
  function splitClauses(t) {
    const chunks = t.split(/[;.]|,(?!\d)/).map((c) => c.trim()).filter(Boolean);
    const out = [];
    for (const ch of chunks) {
      const g = stripGoal(ch);
      if (!g) continue;
      // "congelar X e aumentar Y" → duas ordens
      for (const p of g.split(/\s+e\s+(?=(?:tambem\s+)?[a-z]+(?:ar|er|ir)\b)/)) if (p.trim()) out.push(p.trim());
    }
    return out;
  }

  C.parse = function (st, text) {
    const t = C.norm(text);
    const clauses = splitClauses(t);
    const res = [], fails = [];
    let prev = null;
    for (const cl of clauses) {
      const lv = LEVERS.find((l) => l.match(cl));
      if (!lv) {
        // cláusula sem assunto ("sem repor a inflação", "por 3 meses"): qualifica a anterior
        if (prev) prev.text += ' ' + cl;
        continue;
      }
      prev = { lever: lv, text: cl };
      res.push(prev);
    }
    const out = [];
    for (const r of res) {
      const v = verbOf(r.text);
      if (!v) continue;
      let m;
      try { m = r.lever.build(st, r.text, v, amountOf(r.text), durationOf(r.text)); } catch (e) { m = null; }
      if (!m) continue;
      if (m.fail) { fails.push(m.fail); continue; }
      m.lever = r.lever.id;
      m.source = text;
      out.push(m);
    }
    return { measures: out, fails: fails };
  };

  // Resumo legível dos efeitos imediatos (mostrado antes de o jogador enfileirar)
  C.preview = function (m) {
    const e = m.eff || {}, L = H.LABELS, parts = [];
    const skip = { groups: 1, lag: 1, mods: 1, flags: 1, unflag: 1, rel: 1, budget: 1, taxes: 1 };
    for (const k in e) if (!skip[k] && typeof e[k] === 'number' && Math.abs(e[k]) >= 0.05) parts.push((L[k] || k) + ' ' + U.fmtSigned(e[k], Math.abs(e[k]) < 1 ? 2 : 1));
    if (e.budget) for (const b in e.budget) parts.push('Gasto ' + b + ' ' + U.fmtSigned(e.budget[b], 2) + ' p.p. PIB');
    if (e.lag) for (const l of e.lag) if (l.note) parts.push('depois de ' + l.turns + ' tri: ' + l.note);
    return parts.join(' · ');
  };

  C.LEVER_NAMES = ['salário mínimo', 'salário dos servidores', 'preços (todos ou alimentos)', 'aluguéis', 'combustíveis/energia', 'impostos (renda, consumo, empresas, importação, exportação, transações, fortunas)', 'gastos (saúde, educação, defesa, infraestrutura, previdência, social, subsídios, administração)', 'importações/exportações', 'juros (inclusive zero e negativos)'];

  S.COMPOSER = C;
})(globalThis.S = globalThis.S || {});
