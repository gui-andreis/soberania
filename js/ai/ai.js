// Camada de "inteligência" do jogo:
//  - DATALOG: grava ordens livres, conversas com o conselheiro e relatórios (localStorage + exportação JSON)
//    para você analisar depois e criar novas ações/regras offline.
//  - INTENT: interpretador offline de ordens em português (palavras-chave + números), sem IA.
//  - ADVISOR: conselheiro por regras (diagnóstico do estado do país).
//  - GEMINI: integração opcional com a API gratuita do Google Gemini (desligada por padrão).
(function (S) {
  'use strict';
  const U = S.U, H = S.H;

  // ===================== CONFIG =====================
  const CFG_KEY = 'soberania.config';
  const CONFIG = {
    defaults: { geminiKey: '', geminiModel: 'gemini-2.5-flash', useAiOrders: false, useAiAdvisor: false, useAiReports: false, logData: true, autosave: true, chartMonths: 120 },
    get() { try { return Object.assign({}, this.defaults, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) { return Object.assign({}, this.defaults); } },
    set(patch) { const c = Object.assign(this.get(), patch); try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) { /* sem storage */ } return c; },
    aiReady() { const c = this.get(); return !!c.geminiKey; }
  };

  // ===================== DATALOG =====================
  const LOG_KEY = 'soberania.dataset';
  const DATALOG = {
    all() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; } },
    add(entry) {
      if (!CONFIG.get().logData) return;
      const arr = this.all();
      arr.push(Object.assign({ ts: new Date().toISOString() }, entry));
      while (arr.length > 3000) arr.shift();
      try { localStorage.setItem(LOG_KEY, JSON.stringify(arr)); } catch (e) { arr.splice(0, 500); try { localStorage.setItem(LOG_KEY, JSON.stringify(arr)); } catch (e2) { /* cheio */ } }
    },
    clear() { try { localStorage.removeItem(LOG_KEY); } catch (e) { /* */ } },
    stats() {
      const a = this.all();
      const by = {};
      for (const x of a) by[x.type] = (by[x.type] || 0) + 1;
      return { total: a.length, by: by, unmatched: a.filter((x) => x.type === 'ordem' && !x.matched).length };
    },
    context(st) { return st ? { pais: st.cid, ano: st.year, tri: st.q, regime: st.regime, ideologia: st.leader.ideoId, aprovacao: +st.pol.approval.toFixed(1), inflacao: +st.e.infl.toFixed(1), crescimento: +st.e.growthYoY.toFixed(1) } : {}; }
  };

  // ===================== INTENT (offline) =====================
  const STOP = new Set(['o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'para', 'pra', 'por', 'com', 'que', 'ao', 'aos', 'se', 'eu', 'quero', 'vamos', 'vou', 'fazer', 'agora', 'governo', 'nosso', 'nossa', 'meu', 'minha', 'pais']);
  const SYN = {
    'aumentar': ['subir', 'elevar', 'ampliar', 'aumento', 'aumente', 'suba', 'mais'], 'reduzir': ['baixar', 'cortar', 'diminuir', 'reducao', 'corte', 'menos', 'abaixar', 'baixe', 'corta'],
    'privatizar': ['vender', 'privatizacao', 'privatiza', 'privatize'], 'estatizar': ['nacionalizar', 'estatizacao', 'nacionalizacao', 'estatiza', 'expropriar'],
    'juros': ['selic', 'taxa basica', 'taxa de juros', 'juro'], 'imposto': ['impostos', 'tributo', 'tributos', 'taxa', 'aliquota'],
    'petroleo': ['petrobras', 'pemex', 'pdvsa', 'oleo', 'gas'], 'energia': ['eletrobras', 'eletricidade', 'luz'], 'bancos': ['banco', 'caixa', 'banco do brasil'],
    'mineracao': ['vale', 'minerio', 'mina'], 'telecom': ['telefonia', 'telebras', 'telecomunicacoes'], 'correios': ['correio'], 'saneamento': ['sabesp', 'agua'],
    'guerra': ['invadir', 'atacar', 'ofensiva'], 'salario minimo': ['minimo', 'piso salarial']
  };
  function norm(s) { return U.stripAccents(s).replace(/[^a-z0-9%,. ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function expand(text) {
    let t = ' ' + norm(text) + ' ';
    for (const k in SYN) for (const v of SYN[k]) if (t.includes(' ' + v + ' ')) t += ' ' + k + ' ';
    return t;
  }
  const INTENT = {};
  INTENT.parse = function (st, text) {
    const t = expand(text);
    const words = t.split(' ').filter((w) => w && !STOP.has(w));
    const results = [];
    // 1) ações do catálogo por palavras-chave
    for (const a of S.ACTIONS.list) {
      let score = 0;
      const kws = (a.kw || []).concat([U.stripAccents(a.name.toLowerCase())]);
      for (const kw of kws) {
        const k = norm(kw);
        if (!k) continue;
        if (t.includes(' ' + k + ' ') || t.includes(k)) score = Math.max(score, 3 + k.split(' ').length * 2);
        else {
          const kwWords = k.split(' ').filter((w) => !STOP.has(w));
          const hit = kwWords.filter((w) => words.some((x) => x === w || (w.length > 5 && x.startsWith(w.slice(0, -2))))).length;
          if (kwWords.length && hit === kwWords.length) score = Math.max(score, 3 + hit * 2);
          else if (hit >= 2) score = Math.max(score, hit);
        }
      }
      // verbo direcional
      if (score > 0 && a.id.endsWith('_subir') && /reduzir/.test(t)) score -= 4;
      if (score > 0 && a.id.endsWith('_reduzir') && /aumentar/.test(t)) score -= 4;
      if (score > 0 && a.id.startsWith('privatizar') && /estatizar/.test(t)) score -= 5;
      if (score > 0 && a.id.startsWith('estatizar') && /privatizar/.test(t)) score -= 5;
      if (score >= 3) results.push({ type: 'action', id: a.id, score: score, label: a.name });
    }
    // alvo diplomático (país mencionado)
    let target = null;
    for (const c of S.COUNTRIES.list) {
      const n = norm(S.COUNTRIES.nameAt(c, H.t(st)));
      const n2 = norm(c.name);
      if (c.id !== st.cid && (t.includes(' ' + n + ' ') || t.includes(' ' + n2 + ' ') || t.includes(' ' + c.id.toLowerCase() + ' '))) target = c.id;
    }
    // 2) parâmetros numéricos: juros
    const num = (re) => { const m = t.match(re); return m ? parseFloat(m[1].replace(',', '.')) : null; };
    if (/juros/.test(t)) {
      const v = num(/juros[a-z ]*?(?:para|a|em)?\s*(\d+(?:[.,]\d+)?)\s*%?/);
      if (v !== null && v < 200) results.push({ type: 'rate', value: v, score: 9, label: 'Definir juro básico em ' + U.fmt(v, 2) + '%' });
      else if (/aumentar/.test(t)) results.push({ type: 'rateDelta', value: 1, score: 6, label: 'Subir o juro básico em 1 p.p.' });
      else if (/reduzir/.test(t)) results.push({ type: 'rateDelta', value: -1, score: 6, label: 'Cortar o juro básico em 1 p.p.' });
    }
    // 3) orçamento: "aumentar gasto com saude em 1%"
    const BUD = { saude: 'saude', educacao: 'educacao', escola: 'educacao', militar: 'militar', defesa: 'militar', exercito: 'militar', infraestrutura: 'infra', obras: 'infra', social: 'social', previdencia: 'previdencia', aposentadoria: 'previdencia', subsidio: 'subsidios', administracao: 'admin', maquina: 'admin' };
    if (/gasto|orcamento|investimento|verba|investir|gastar/.test(t)) {
      for (const k in BUD) if (t.includes(k)) {
        const dir = /reduzir/.test(t) ? -1 : 1;
        const v = num(/(\d+(?:[.,]\d+)?)\s*(?:%|por cento|pontos)/) || 0.5;
        results.push({ type: 'budget', cat: BUD[k], value: dir * Math.min(3, v), score: 8, label: (dir > 0 ? 'Aumentar' : 'Reduzir') + ' orçamento de ' + k + ' em ' + U.fmt(Math.min(3, v), 1) + ' p.p. do PIB' });
        break;
      }
    }
    results.sort((a, b) => b.score - a.score);
    // remove duplicatas e itens muito fracos em relação ao melhor
    // mantém o melhor de cada tipo + ações fortes (ordens compostas: "privatizar X e baixar juros")
    const bestAction = Math.max(0, ...results.filter((r) => r.type === 'action').map((r) => r.score));
    const out = [];
    for (const r of results) {
      if (out.some((o) => o.type === r.type && o.id === r.id)) continue;
      if (r.type !== 'action' || r.score >= Math.max(4, bestAction * 0.7)) out.push(r);
    }
    for (const r of out) if (r.type === 'action' && S.ACTIONS.byId[r.id].target) r.target = target;
    return out.slice(0, 5);
  };

  // ===================== ADVISOR (offline) =====================
  const ADVISOR = {};
  ADVISOR.diagnose = function (st) {
    const e = st.e, p = st.pol, tips = [];
    const neutral = H.trait(st, 'neutralReal', 2.5);
    const tgt = st.inflTarget;
    if (e.infl > 400) tips.push({ sev: 3, t: 'Hiperinflação. Nenhum plano funciona sem cortar o déficit e parar a emissão. Planos com desindexação (estilo Real) têm mais chance se houver superávit primário e reservas.' });
    else if (e.infl > (tgt != null ? tgt + 3 : 10)) tips.push({ sev: 2, t: `Inflação de ${U.fmt(e.infl, 1)}% está acima do confortável. Juro real atual: ${U.fmt(e.realRate, 1)}% (neutro estimado para este país: ~${U.fmt(neutral, 1)}%). ${e.realRate < neutral ? 'A política monetária está estimulativa — juros precisariam subir.' : 'A política monetária já é contracionista; falta ajuda do fiscal.'}` });
    if (e.infl < 0) tips.push({ sev: 2, t: 'Deflação: aumenta o peso real das dívidas. Considere estímulo monetário e fiscal.' });
    if (e.growthYoY < -1) tips.push({ sev: 2, t: `Recessão (${U.fmt(e.growthYoY, 1)}%). ${e.debt < e.debtTol ? 'Há espaço fiscal para estímulo.' : 'Com dívida alta, estímulo fiscal pode piorar a confiança — prefira juros e reformas.'}` });
    if (e.primDef > 3) tips.push({ sev: 2, t: `Déficit primário de ${U.fmt(e.primDef, 1)}% do PIB. Mercado cobra prêmio de risco de ${U.fmt(e.riskPrem, 1)} p.p.` });
    if (e.debt > e.debtTol) tips.push({ sev: 2, t: `Dívida de ${U.fmt(e.debt, 0)}% do PIB acima do que o mercado tolera para este país (~${U.fmt(e.debtTol, 0)}%).` });
    if (e.reserves < 3 && !['euro', 'dolarizado'].includes(st.fxRegime)) tips.push({ sev: 3, t: `Reservas para só ${U.fmt(e.reserves, 1)} meses de importação. Risco de crise cambial${H.isFixed(st) ? ' — com câmbio fixo, um ataque especulativo é iminente' : ''}.` });
    if (e.unemp > e.u0 + 3) tips.push({ sev: 2, t: `Desemprego (${U.fmt(e.unemp, 1)}%) bem acima do início do governo.` });
    if (p.approval < 30) tips.push({ sev: 3, t: `Aprovação de ${U.fmt(p.approval, 0)}%. Perigo de ${H.dem(st) ? 'derrota eleitoral, impeachment ou paralisia' : 'revolta popular ou golpe'}.` });
    if (p.militaryLoyalty < 40) tips.push({ sev: 3, t: `Lealdade militar baixa (${U.fmt(p.militaryLoyalty, 0)}). Risco de golpe por trimestre: ~${U.fmt(S.POL.coupProb(st) * 100, 1)}%.` });
    if (p.coherence < 45) tips.push({ sev: 2, t: 'Sua base acha que você traiu o programa. Medidas alinhadas à sua ideologia recuperam coerência.' });
    if (H.dem(st) && p.congress < 40) tips.push({ sev: 2, t: `Apoio no Congresso de ${U.fmt(p.congress, 0)}%. Reformas difíceis tendem a ser rejeitadas; uma coalizão ou emendas ajudam (custam coerência e aumentam corrupção).` });
    if (p.nextElection && H.dem(st)) {
      const mLeft = p.nextElection - st.month;
      if (mLeft <= 12 && mLeft > 0) tips.push({ sev: 1, t: `Eleição em ${mLeft} meses. Intenção de voto estimada: ${U.fmt(S.POL.voteShare(st, null, p.termsServed >= S.POL.termLimit(st)), 1)}%.` });
    }
    if (st.mil.wars.length) tips.push({ sev: 2, t: `Em guerra contra ${st.mil.wars.map((w) => H.cname(w.target, st)).join(', ')}. Cansaço de guerra: ${U.fmt(st.mil.warEx, 0)}/100.` });
    if (e.shortage > 15) tips.push({ sev: 2, t: 'Escassez de produtos: controle de preços ou economia planificada estão gerando filas.' });
    if (!tips.length) tips.push({ sev: 0, t: 'Situação sob controle. Bom momento para reformas estruturais (educação, infraestrutura, produtividade), que só dão resultado em anos.' });
    return tips.sort((a, b) => b.sev - a.sev);
  };
  const TOPICS = [
    [/inflac|preco|carestia/, (st) => `Inflação: ${U.fmt(st.e.infl, 1)}% a.a.; expectativa ${U.fmt(st.e.inflExp, 1)}%. ${st.inflTarget != null ? 'Meta: ' + U.fmt(st.inflTarget, 1) + '%. ' : ''}Inércia do país: ${U.fmt(H.trait(st, 'inertia', 0.5) * 100, 0)}% (quanto maior, mais lenta a desinflação). Repasse cambial: ${U.fmt(H.trait(st, 'fxPass', 0.2) * 100, 0)}%.`],
    [/juro|selic|banco central/, (st) => `Juro básico: ${U.fmt(st.e.rate, 2)}%; juro real: ${U.fmt(st.e.realRate, 1)}%. Juro neutro real estimado: ${U.fmt(H.trait(st, 'neutralReal', 2.5), 1)}% — ${st.cid === 'BR' ? 'o Brasil historicamente precisa de juros reais mais altos que a média por causa de inflação inercial, crédito direcionado e baixa poupança.' : 'acima disso, os juros freiam a economia; abaixo, estimulam.'} BC ${st.cbIndep ? 'autônomo: você só pode pressionar.' : 'subordinado: você define a taxa na aba Moeda e preços.'}`],
    [/desempreg|emprego/, (st) => `Desemprego: ${U.fmt(st.e.unemp, 1)}% (estrutural ~${U.fmt(H.trait(st, 'uStar', 6) + (st.e.uStarShift || 0), 1)}%). Crescer acima do potencial (${U.fmt(st.e.gpot, 1)}%) reduz o desemprego; reformas trabalhistas e ensino técnico mexem no estrutural.`],
    [/divida|fiscal|deficit|gasto/, (st) => `Dívida ${U.fmt(st.e.debt, 0)}% do PIB; resultado primário ${U.fmt(-st.e.primDef, 1)}%; juros nominais ${U.fmt(st.e.interestNom, 1)}% do PIB. Prêmio de risco ${U.fmt(st.e.riskPrem, 1)} p.p. Tolerância estimada do mercado: ~${U.fmt(st.e.debtTol, 0)}% do PIB.`],
    [/eleic|voto|reelei/, (st) => st.pol.nextElection ? `Próxima eleição em ${U.fmt((st.pol.nextElection - st.month) / 12, 1)} anos. Intenção de voto estimada hoje: ${U.fmt(S.POL.voteShare(st, null, st.pol.termsServed >= S.POL.termLimit(st)), 1)}%. Crescimento, inflação baixa e desemprego em queda pesam mais que qualquer propaganda.` : 'Não há eleições previstas neste regime.'],
    [/golpe|militar|exercito/, (st) => `Lealdade militar: ${U.fmt(st.pol.militaryLoyalty, 0)}/100. Risco de tentativa de golpe neste trimestre: ${U.fmt(S.POL.coupProb(st) * 100, 1)}%. Se acontecer, chance de sucesso ~${U.fmt(S.POL.coupSuccess(st) * 100, 0)}%.`],
    [/guerra|invadir|atacar/, (st) => st.mil.wars.length ? st.mil.wars.map((w) => `Guerra contra ${H.cname(w.target, st)}: placar ${U.fmt(w.score, 0)} (vitória em +100, derrota em -100).`).join(' ') : 'Não estamos em guerra. Use Defesa & Diplomacia para ver as chances estimadas antes de qualquer ação militar.'],
    [/aprova|popular/, (st) => 'Aprovação por grupo: ' + Object.keys(st.pol.groups).sort((a, b) => st.pol.groups[a] - st.pol.groups[b]).map((g) => S.POLITICS.groups[g].name + ' ' + U.fmt(st.pol.groups[g], 0)).join(', ') + '.'],
    [/privatiz|estatiz|estata/, (st) => `Peso das estatais: ${U.fmt(st.e.soe, 0)}/100. Privatizar gera receita e eficiência no médio prazo; para um governo de ${S.POLITICS.ideologies[st.leader.ideoId].name}, ${st.leader.e < -20 ? 'privatizar vai irritar sua base.' : st.leader.e > 20 ? 'privatizar agrada sua base.' : 'o custo político é moderado.'}`],
    [/cambio|dolar|moeda/, (st) => `Regime cambial: ${st.fxRegime}. Câmbio real ${U.fmt(st.e.rer, 0)} (100 = equilíbrio; >100 = moeda barata/competitiva). Reservas: ${U.fmt(st.e.reserves, 1)} meses de importação.`]
  ];
  ADVISOR.answer = function (st, q) {
    const t = U.stripAccents(q.toLowerCase());
    const hits = TOPICS.filter((x) => x[0].test(t)).map((x) => x[1](st));
    if (hits.length) return hits.join('\n\n');
    const intents = INTENT.parse(st, q);
    if (intents.length) return 'Isso parece uma ordem. Encontrei estas medidas no catálogo: ' + intents.map((i) => '“' + i.label + '”').join(', ') + '. Use a caixa "Ordem livre" na aba Decisões para executá-las.';
    return 'Diagnóstico atual:\n• ' + ADVISOR.diagnose(st).slice(0, 4).map((x) => x.t).join('\n• ');
  };

  // ===================== GEMINI (opcional) =====================
  const GEMINI = {};
  GEMINI.call = async function (prompt, json, history) {
    const cfg = CONFIG.get();
    if (!cfg.geminiKey) throw new Error('Configure a chave da API do Gemini na aba Config.');
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(cfg.geminiModel) + ':generateContent';
    const contents = (history || []).concat([{ role: 'user', parts: [{ text: prompt }] }]);
    const body = { contents: contents, generationConfig: { temperature: 0.6 } };
    if (json) body.generationConfig.responseMimeType = 'application/json';
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.geminiKey }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini respondeu ' + res.status + ': ' + (await res.text()).slice(0, 300));
    const data = await res.json();
    const text = (((data.candidates || [])[0] || {}).content || {}).parts ? data.candidates[0].content.parts.map((p) => p.text || '').join('') : '';
    return text;
  };
  GEMINI.stateSummary = function (st) {
    const e = st.e, p = st.pol;
    return `País: ${H.name(st)} | Data: ${st.q}º tri/${st.year} | Regime: ${S.POLITICS.regimes[st.regime].name} | Ideologia do governante: ${S.POLITICS.ideologies[st.leader.ideoId].name}
PIB 12m: ${U.fmt(e.growthYoY, 1)}% | Inflação: ${U.fmt(e.infl, 1)}% | Juro: ${U.fmt(e.rate, 2)}% | Desemprego: ${U.fmt(e.unemp, 1)}% | Dívida: ${U.fmt(e.debt, 0)}% PIB | Primário: ${U.fmt(-e.primDef, 1)}% PIB | Reservas: ${U.fmt(e.reserves, 1)} meses | Pobreza: ${U.fmt(e.poverty, 0)}%
Aprovação: ${U.fmt(p.approval, 0)}% | Congresso: ${U.fmt(p.congress, 0)}% | Lealdade militar: ${U.fmt(p.militaryLoyalty, 0)} | Protestos: ${U.fmt(p.protests, 0)} | Grupos: ${Object.keys(p.groups).map((g) => g + ' ' + Math.round(p.groups[g])).join(', ')}
Guerras: ${st.mil.wars.map((w) => w.target).join(', ') || 'nenhuma'} | Sanções contra nós: ${st.dip.sanctionedBy.join(', ') || 'nenhuma'}`;
  };
  // Interpreta ordem livre: devolve ações do catálogo e/ou um efeito customizado (com limites rígidos)
  GEMINI.interpretOrder = async function (st, text) {
    const catalog = S.ACTIONS.list.filter((a) => S.GAME.actionStatus(st, a).ok || S.GAME.actionStatus(st, a).capital).map((a) => a.id + ': ' + a.name).join('\n');
    const prompt = `Você é o motor de regras de um simulador geopolítico REALISTA. Priorize sempre a realidade histórica e econômica.
${GEMINI.stateSummary(st)}

O governante deu esta ordem: "${text}"

Catálogo de ações disponíveis (id: nome):
${catalog}

Responda SOMENTE JSON: {"acoes":["id",...],"alvo":"código do país ou null","custom":null | {"nome":"...","descricao":"...","efeitos":{"gap":n,"infl":n,"confidence":n,"unemp":n,"debt":n,"poverty":n,"legit":n,"approval":n},"grupos":{"trabalhadores":n,"pobres":n,"classe_media":n,"empresarios":n,"financeiro":n,"agro":n,"militares":n,"religiosos":n,"servidores":n,"estudantes":n,"sindicatos":n},"ideologia":{"e":-100..100,"s":-100..100}},"explicacao":"curta, em português"}
Use "acoes" quando a ordem corresponder ao catálogo. Use "custom" só se nada corresponder; efeitos pequenos e realistas (|valor| <= 5, grupos <= 12).`;
    const raw = await GEMINI.call(prompt, true);
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { throw new Error('Resposta inválida do Gemini'); }
    // valida e limita
    obj.acoes = (obj.acoes || []).filter((id) => S.ACTIONS.byId[id]);
    if (obj.custom) {
      const c = obj.custom, eff = {}, groups = {};
      const LIM = { gap: 3, infl: 4, confidence: 8, unemp: 1.5, debt: 3, poverty: 3, legit: 6, approval: 4 };
      for (const k in LIM) if (c.efeitos && typeof c.efeitos[k] === 'number') eff[k] = U.clamp(c.efeitos[k], -LIM[k], LIM[k]);
      for (const g of S.POLITICS.groupIds) if (c.grupos && typeof c.grupos[g] === 'number') groups[g] = U.clamp(c.grupos[g], -12, 12);
      obj.custom = { nome: String(c.nome || 'Medida especial').slice(0, 80), descricao: String(c.descricao || '').slice(0, 300), eff: eff, groups: groups, ideo: { e: U.clamp((c.ideologia || {}).e || 0, -100, 100), s: U.clamp((c.ideologia || {}).s || 0, -100, 100) } };
    }
    DATALOG.add({ type: 'ordem', source: 'gemini', input: text, output: obj, matched: obj.acoes.length > 0 || !!obj.custom, ctx: DATALOG.context(st) });
    return obj;
  };
  GEMINI.advise = async function (st, question, chat) {
    const history = (chat || []).slice(-10).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
    const prompt = `Você é o conselheiro-chefe (economista e cientista político) de um governante num simulador geopolítico realista. Responda em português, direto, com base em evidências históricas.
${GEMINI.stateSummary(st)}
Diagnóstico do motor: ${ADVISOR.diagnose(st).map((x) => x.t).join(' | ')}
Pergunta: ${question}`;
    return GEMINI.call(prompt, false, history);
  };
  GEMINI.narrate = async function (st, rep) {
    const prompt = `Escreva em português, em 4-6 frases, uma narrativa jornalística realista do trimestre ${rep.q}º/${rep.y} de ${H.name(st)}, explicando o que as decisões do governo causaram. Dados: ${JSON.stringify({ acoes: rep.actions.map((a) => a.name + ': ' + a.lines.join(' ')), eventos: rep.events.map((e) => e.title), resumo: rep.summary })}`;
    return GEMINI.call(prompt, false);
  };

  S.AI = { CONFIG, DATALOG, INTENT, ADVISOR, GEMINI };
})(globalThis.S = globalThis.S || {});
