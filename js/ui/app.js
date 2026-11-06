// Interface do jogo. Renderização por template strings + delegação de eventos (data-a="acao").
(function (S) {
  'use strict';
  const U = S.U, H = S.H, G = S.GAME, P = S.POLITICS, CH = S.CHARTS, AI = S.AI;
  const esc = CH.esc;
  const $ = (sel, root) => (root || document).querySelector(sel);

  const UI = { st: null, page: 'painel', months: 120, decCat: 'todas', decSearch: '', modalQueue: [], intentResults: null, chatBusy: false, setup: {} };
  S.UI = UI;

  const PAGES = [
    ['painel', 'Painel'], ['aprovacao', 'Aprovação'], ['atividade', 'Atividade'], ['moeda', 'Moeda e preços'], ['trabalho', 'Trabalho'],
    ['fiscal', 'Fiscal'], ['industria', 'Indústria'], ['externo', 'Setor externo'], ['social', 'Social'], ['defesa', 'Defesa e diplomacia'],
    ['decisoes', 'Decisões'], ['relatorios', 'Relatórios'], ['historia', 'Linha do tempo'], ['conselheiro', 'Conselheiro'], ['config', 'Config']
  ];
  const WINDOWS = [[12, '1A'], [48, '4A'], [120, '10A'], [300, '25A'], [0, 'Tudo']];

  // ======================= ARMAZENAMENTO =======================
  const STORE = {
    key: 'soberania.saves',
    list() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch (e) { return {}; } },
    save(slot, st) {
      const all = this.list();
      all[slot] = { meta: { pais: H.name(st), flag: H.country(st).flag, ano: st.year, tri: st.q, lider: st.leader.name, salvo: new Date().toLocaleString('pt-BR') }, state: st };
      try { localStorage.setItem(this.key, JSON.stringify(all)); return true; } catch (e) {
        // sem espaço: remove saves antigos exceto o atual
        for (const k of Object.keys(all)) if (k !== slot) delete all[k];
        try { localStorage.setItem(this.key, JSON.stringify(all)); return true; } catch (e2) { return false; }
      }
    },
    load(slot) { const s = this.list()[slot]; return s ? s.state : null; },
    del(slot) { const all = this.list(); delete all[slot]; try { localStorage.setItem(this.key, JSON.stringify(all)); } catch (e) { /* */ } },
    download(name, obj) {
      const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };
  UI.STORE = STORE;

  function registerCustom(st) {
    for (const c of st.customActions || []) {
      if (S.ACTIONS.byId[c.id]) continue;
      const a = { id: c.id, cat: 'livre', name: c.name, desc: c.desc, cost: c.cost || 2, congress: c.congress || 0, ideo: c.ideo, eff: c.eff, groups: c.groups, custom: true, composed: !!c.composed, once: true };
      S.ACTIONS.list.push(a); S.ACTIONS.byId[a.id] = a;
    }
  }

  UI.start = function (st) {
    UI.st = st;
    registerCustom(st);
    st.budgetStart = st.budgetStart || U.deepClone(st.e.budget);
    UI.page = 'painel';
    document.body.classList.add('in-game');
    UI.render();
    if (st.pendingEvents.length) UI.openEvents();
  };

  // ======================= RENDER GERAL =======================
  UI.render = function () {
    const st = UI.st;
    const root = $('#app');
    if (!st) { S.SETUP.render(root); return; }
    const c = H.country(st);
    const queued = st.queue.reduce((s, q) => s + q.cost, 0);
    const capLeft = st.pol.capital - queued;
    let dots = '';
    for (let i = 0; i < Math.max(st.pol.capital, 0); i++) dots += `<i class="${i < capLeft ? 'on' : ''}"></i>`;
    root.innerHTML = `
      <header class="topbar">
        <div class="brand"><span class="dot"></span><span>${c.flag} ${esc(H.name(st))}</span></div>
        <nav class="tabs" id="tabs">${PAGES.map(([id, n]) => `<button class="tab ${UI.page === id ? 'active' : ''}" data-a="page" data-v="${id}">${n}${id === 'decisoes' && st.queue.length ? ` <b class="badge">${st.queue.length}</b>` : ''}${id === 'painel' && st.pendingEvents.length ? ' <b class="badge red">!</b>' : ''}</button>`).join('')}</nav>
        <div class="turnbox">
          <div class="date">${st.q}º tri/${st.year}</div>
          <div class="capital" title="Capital político disponível neste trimestre">${dots || '<small>sem capital</small>'}</div>
          <button class="btn primary" data-a="endturn" ${st.over ? 'disabled' : ''}>Encerrar trimestre ▸</button>
        </div>
      </header>
      <main class="page" id="page">${UI.renderPage()}</main>
      <div id="modal"></div>`;
    CH.bind(root);
    const act = root.querySelector('.tab.active');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
  };

  UI.renderPage = function () {
    const f = PAGE_RENDER[UI.page] || PAGE_RENDER.painel;
    return f(UI.st);
  };

  function pageHead(title, sub) {
    return `<div class="page-head"><h1>${title}</h1><p>${sub || ''}</p></div>
      <div class="winbar"><span>Janela:</span>${WINDOWS.map(([m, l]) => `<button class="chip ${UI.months === m ? 'on' : ''}" data-a="win" data-v="${m}">${l}</button>`).join('')}</div>`;
  }

  let cardNum = 0;
  // def: {key|keys, title, sub, dec, log, zero, pillUnit, unitBig, extra, refLine, refLabel, fmt, pct, note, controls}
  function metric(def) {
    const st = UI.st;
    cardNum++;
    const key = def.key || def.keys[0].key;
    const arr = st.hist.series[key] || [];
    const last = arr[arr.length - 1];
    const fmt = def.fmt || ((v) => U.fmt(v, def.dec));
    const opts = Object.assign({ months: UI.months }, def);
    const ins = CH.insights(st, key, opts);
    return `<section class="card metric">
      <div class="m-left">
        <div class="m-title"><span class="num">${String(cardNum).padStart(2, '0')}</span><div><h3>${def.title}</h3><small>${def.sub || 'Fonte: simulação SOBERANIA'}</small></div></div>
        ${CH.render(st, Object.assign({ title: def.title }, opts))}
        ${def.controls || ''}
      </div>
      <aside class="m-right">
        <div class="m-date">${U.MONTHS[(st.month - 1 + 12) % 12].toUpperCase()}/${Math.floor((st.month - 1) / 12)}</div>
        <div class="m-big">${last === null || last === undefined ? '—' : fmt(last)}<span>${def.unitBig || ''}</span></div>
        <ul class="bul">${ins.map((x) => `<li>${x}</li>`).join('')}</ul>
        ${def.note ? `<div class="m-note">${def.note}</div>` : ''}
      </aside></section>`;
  }

  // ======================= PÁGINAS =======================
  const PAGE_RENDER = {};

  PAGE_RENDER.painel = function (st) {
    cardNum = 0;
    const c = H.country(st), R = P.regimes[st.regime], I = P.ideologies[st.leader.ideoId];
    const rep = st.reports[st.reports.length - 1];
    const prev = rep ? rep.before : null;
    const kpi = (lab, v, dec, unit, k, inv) => {
      let d = '';
      if (prev && prev[k] !== undefined) {
        const dv = v - prev[k];
        const good = inv ? dv < 0 : dv > 0;
        if (Math.abs(dv) > 0.05) d = `<span class="${good ? 'up' : 'down'}">${dv > 0 ? '▲' : '▼'} ${U.fmt(Math.abs(dv), dec)}</span>`;
      }
      return `<div class="kpi"><small>${lab}</small><b>${U.fmt(v, dec)}<i>${unit}</i></b>${d}</div>`;
    };
    const e = st.e, p = st.pol;
    const diag = AI.ADVISOR.diagnose(st).slice(0, 5);
    const groups = Object.keys(p.groups).sort((a, b) => p.weights[b] - p.weights[a]);
    const mLeft = p.nextElection ? p.nextElection - st.month : null;
    return `<div class="page-head"><h1>${c.flag} ${esc(H.name(st))}</h1><p>${esc(st.leader.name)} · ${esc(st.leader.party)} · ${I.name}<br>${R.name}${st.regime !== p.histRegime ? ' <span class="tag warn">linha do tempo alternativa</span>' : ''}</p></div>
      ${st.over ? `<div class="card over"><h2>Fim do governo</h2><p>${esc(st.gameOver.text)}</p><button class="btn primary" data-a="gameover">Opções</button></div>` : ''}
      ${st.pendingEvents.length ? `<div class="card alert-ev"><b>⚠️ ${st.pendingEvents.length} acontecimento(s) exigem sua decisão.</b> <button class="btn primary" data-a="events">Decidir agora</button></div>` : ''}
      <div class="kpis">
        ${kpi('Aprovação', p.approval, 0, '%', 'approval')}
        ${kpi('PIB (12 meses)', e.growthYoY, 1, '%', 'growth')}
        ${kpi('Inflação', e.infl, e.infl > 100 ? 0 : 1, '%', 'infl', true)}
        ${kpi('Juro básico', e.rate, e.rate > 100 ? 0 : 2, '%', 'rate')}
        ${kpi('Desemprego', e.unemp, 1, '%', 'unemp', true)}
        ${kpi('Dívida/PIB', e.debt, 0, '%', 'debt', true)}
        ${kpi('Reservas', e.reserves, 1, ' meses', 'reserves')}
        ${kpi('Pobreza', e.poverty, 1, '%', 'poverty', true)}
      </div>
      <div class="grid2">
        <section class="card"><h3>Diagnóstico do gabinete</h3><ul class="diag">${diag.map((d) => `<li class="sev${d.sev}">${esc(d.t)}</li>`).join('')}</ul></section>
        <section class="card"><h3>Humor dos grupos</h3>
          ${groups.map((g) => `<div class="gbar"><span>${P.groups[g].name}</span><div class="bar"><i style="width:${p.groups[g]}%;background:${barColor(p.groups[g])}"></i></div><b>${Math.round(p.groups[g])}</b><small>${Math.round(p.weights[g] * 100)}%</small></div>`).join('')}
          <p class="muted small">Número à direita = peso eleitoral do grupo.</p></section>
      </div>
      <div class="grid3">
        <section class="card"><h3>Poder</h3>
          ${statRow('Legitimidade', p.legit)}${statRow('Estabilidade', p.stability)}${statRow('Lealdade militar', p.militaryLoyalty)}${R.democracy || R.parliament ? statRow('Apoio no Congresso', p.congress) : ''}${statRow('Coerência ideológica', p.coherence)}${statRow('Protestos', p.protests, true)}
          <p class="muted small">${mLeft !== null ? (mLeft > 0 ? `Próxima eleição em ${Math.ceil(mLeft / 3)} trimestre(s) (${U.monthLabel(p.nextElection)}).` : 'Eleição neste trimestre.') : 'Sem eleições previstas neste regime.'} Mandato nº ${p.termsServed}; limite: ${S.POL.termLimit(st) >= 99 ? 'sem limite' : S.POL.termLimit(st)}.</p></section>
        <section class="card"><h3>Situação externa</h3>
          <p>Mundo: crescimento ${U.fmt(st.world.gEff, 1)}% · petróleo US$ ${U.fmt(st.world.oilEff, 0)} · juros EUA ${U.fmt(st.world.rateEff, 2)}%</p>
          <p>Câmbio: <b>${fxName(st.fxRegime)}</b> · BC ${st.cbIndep ? 'autônomo' : 'subordinado ao governo'}${st.inflTarget != null ? ' · meta ' + U.fmt(st.inflTarget, 1) + '%' : ''}</p>
          ${st.mil.wars.length ? st.mil.wars.map((w) => `<p class="warn">⚔️ Guerra contra ${esc(H.cname(w.target, st))} — placar ${U.fmt(w.score, 0)}</p>`).join('') : '<p class="muted">Em paz.</p>'}
          ${st.dip.sanctionedBy.length ? `<p class="warn">Sob sanções: ${st.dip.sanctionedBy.join(', ')}</p>` : ''}
          ${Object.keys(st.dip.orgs).length ? `<p class="muted small">Membro de: ${Object.keys(st.dip.orgs).map((o) => S.WORLD.orgs[o] ? S.WORLD.orgs[o].name : o).join(', ')}</p>` : ''}</section>
        <section class="card"><h3>Último relatório</h3>${rep ? `<p class="muted small">${rep.q}º tri/${rep.y}</p><ul class="bul">${rep.summary.slice(0, 5).map((l) => `<li>${esc(l)}</li>`).join('')}</ul><button class="btn" data-a="showreport" data-v="${st.reports.length - 1}">Abrir relatório</button>` : '<p class="muted">Tome suas primeiras decisões na aba <b>Decisões</b> e encerre o trimestre.</p>'}
          ${(c.special || []).map((s) => `<p class="muted small">📌 ${esc(s)}</p>`).join('')}</section>
      </div>`;
  };
  function statRow(lab, v, inv) { return `<div class="gbar"><span>${lab}</span><div class="bar"><i style="width:${U.clamp(v, 0, 100)}%;background:${barColor(inv ? 100 - v : v)}"></i></div><b>${Math.round(v)}</b></div>`; }
  function barColor(v) { return v > 60 ? '#6fbf8a' : v > 40 ? '#f4c34f' : v > 25 ? '#e0904f' : '#e06c6c'; }
  function fxName(r) { return { flutuante: 'flutuante', fixo: 'fixo', banda: 'bandas/minidesvalorizações', ouro: 'padrão-ouro', conversibilidade: 'conversibilidade (currency board)', euro: 'euro', dolarizado: 'dolarizado', controle: 'controlado (com controle de capitais)' }[r] || r; }

  PAGE_RENDER.aprovacao = function (st) {
    cardNum = 0;
    const p = st.pol;
    const gkeys = Object.keys(p.groups);
    return pageHead('Aprovação e poder', 'Como cada grupo social reage às suas decisões, à economia e à coerência com o que você prometeu.') +
      metric({ key: 'approval', title: 'Aprovação do governo', sub: '% ponderado pelos grupos sociais', dec: 1, unitBig: '%', pillUnit: '%', refLine: 50, refLabel: '50%' }) +
      `<section class="card"><h3>Grupos sociais</h3><table class="tbl"><thead><tr><th>Grupo</th><th>Aprovação</th><th>Peso eleitoral</th><th>Poder (estabilidade)</th><th>Posição ideológica</th></tr></thead><tbody>
      ${gkeys.sort((a, b) => p.groups[b] - p.groups[a]).map((g) => `<tr><td>${P.groups[g].name}</td><td><div class="bar sm"><i style="width:${p.groups[g]}%;background:${barColor(p.groups[g])}"></i></div> ${Math.round(p.groups[g])}</td><td>${U.fmt(p.weights[g] * 100, 0)}%</td><td>${U.fmt(P.groups[g].power, 1)}</td><td class="muted small">${P.groups[g].e < -20 ? 'esquerda' : P.groups[g].e > 20 ? 'direita' : 'centro'} econ. · ${P.groups[g].s < -20 ? 'progressista' : P.groups[g].s > 20 ? 'conservador' : 'moderado'}</td></tr>`).join('')}
      </tbody></table><p class="muted small">Coerência ideológica: <b>${Math.round(p.coherence)}</b>/100. Medidas contrárias ao seu programa (${P.ideologies[st.leader.ideoId].name}) geram sensação de traição na sua base — mesmo que agradem outros grupos.</p></section>` +
      metric({ key: 'stability', title: 'Estabilidade do regime', dec: 0, unitBig: '/100' }) +
      metric({ key: 'protests', title: 'Intensidade dos protestos', dec: 0, unitBig: '/100' }) +
      metric({ key: 'legit', title: 'Legitimidade', dec: 0, unitBig: '/100' }) +
      metric({ key: 'congress', title: 'Apoio no Congresso', sub: '% da base parlamentar', dec: 0, unitBig: '%', pillUnit: '%' }) +
      metric({ key: 'militaryLoyalty', title: 'Lealdade das Forças Armadas', dec: 0, unitBig: '/100', note: `Risco de tentativa de golpe neste trimestre: ${U.fmt(S.POL.coupProb(st) * 100, 1)}%.` });
  };

  PAGE_RENDER.atividade = function (st) {
    cardNum = 0;
    return pageHead('Atividade econômica', 'Crescimento, renda e produção.') +
      metric({ key: 'growth', title: 'PIB — crescimento em 12 meses', sub: '% sobre o mesmo mês do ano anterior', dec: 1, unitBig: '%', pillUnit: '%', zero: true, extra: (s) => [`Crescimento potencial estimado: <b>${U.fmt(s.e.gpot, 1)}%</b> a.a.`, `Hiato do produto: <b>${U.fmtSigned(s.e.gap, 1)}%</b>`] }) +
      metric({ key: 'gdppc', title: 'PIB per capita', sub: 'US$ PPC de 2011 (padrão Maddison)', dec: 0, unitBig: ' US$', pct: true }) +
      metric({ key: 'gdp', title: 'PIB total', sub: 'US$ bilhões PPC de 2011', dec: 0, unitBig: ' bi', pct: true }) +
      metric({ key: 'confidence', title: 'Confiança de empresários e mercados', dec: 0, unitBig: '/100' }) +
      metric({ key: 'invest', title: 'Taxa de investimento', sub: '% do PIB', dec: 1, unitBig: '%', pillUnit: '%' });
  };

  function rateWarn(st) {
    const w = [];
    if ((st.e.flight || 0) > 5) w.push(`Juro real de ${U.fmt(st.e.realRate, 1)}%: fuga da moeda (dolarização, compra de estoques, saída de capitais).`);
    if ((st.e.negRate || 0) > 0) w.push('Juro nominal negativo: bancos perdem margem e o crédito trava; o estímulo é cada vez menor.');
    if ((st.e.dovMem || 0) > 0.03) w.push('O mercado vê o juro como político: credibilidade do BC em queda e expectativas desancoradas.');
    return w.length ? `<div class="down small">${w.map(esc).join('<br>')}</div>` : '';
  }

  PAGE_RENDER.moeda = function (st) {
    cardNum = 0;
    const neutral = H.trait(st, 'neutralReal', 2.5);
    const canSet = !st.cbIndep && !['euro', 'dolarizado'].includes(st.fxRegime);
    const taylor = st.e.taylor != null ? st.e.taylor : neutral + st.e.inflExp + 0.5 * (st.e.infl - (st.inflTarget != null ? st.inflTarget : Math.min(st.e.infl, 4))) + 0.5 * st.e.gap;
    const controls = `<div class="controls">
      ${canSet ? `<label>Política de juros: <select data-a="ratemode"><option value="auto" ${st.rateMode === 'auto' ? 'selected' : ''}>Técnica (BC segue regra de Taylor)</option><option value="manual" ${st.rateMode === 'manual' ? 'selected' : ''}>Definida pelo governo</option></select></label>
        ${st.rateMode === 'manual' ? `<label>Taxa alvo: <input type="number" step="0.25" min="-50" value="${(+st.e.rateManual).toFixed(2)}" data-a="rateset" style="width:110px"> %</label>` : ''}
        <span class="muted small">Regra técnica sugere ~${U.fmt(taylor, 2)}%. Juros abaixo disso estimulam no curto prazo, mas derrubam a credibilidade; juro real muito negativo provoca fuga da moeda e juro nominal negativo trava os bancos.</span>
        ${rateWarn(st)}`
        : `<span class="muted small">${st.cbIndep ? 'Banco Central autônomo: decide os juros sozinho (regra de Taylor). Você pode pressioná-lo ou retirar a autonomia em Decisões.' : 'Sem moeda própria: os juros acompanham a autoridade monetária externa.'}</span>`}
    </div>`;
    return pageHead('Moeda e preços', 'Juros, inflação, câmbio e emissão de moeda.') +
      metric({ key: 'infl', title: 'Inflação ao consumidor', sub: '% em 12 meses', dec: st.e.infl > 100 ? 0 : 1, unitBig: '%', pillUnit: '%', zero: true, log: st.e.infl > 200, refLine: st.inflTarget, refLabel: 'meta', extra: (s) => [`Expectativa de inflação: <b>${U.fmt(s.e.inflExp, 1)}%</b>`, `Credibilidade da política monetária: <b>${Math.round(s.e.cred * 100)}%</b>`] }) +
      metric({ key: 'rate', title: 'Juro básico (taxa de política monetária)', sub: '% a.a.', dec: 2, unitBig: '% a.a.', pillUnit: '%', controls: controls, log: st.e.rate > 200 }) +
      metric({ key: 'realRate', title: 'Juro real (descontada a expectativa de inflação)', sub: '% a.a.', dec: 1, unitBig: '% a.a.', pillUnit: '%', zero: true, refLine: neutral, refLabel: 'neutro', note: `Juro neutro estimado para ${esc(H.name(st))}: ${U.fmt(neutral, 1)}% real. Acima dele a política freia a economia; abaixo, estimula.` }) +
      metric({ key: 'fx', title: 'Câmbio — moeda local por dólar', sub: 'índice (escala log), início do jogo = 100', dec: 0, log: true, pct: true, unitBig: '', extra: (s) => [`Regime: <b>${fxName(s.fxRegime)}</b>`, `Câmbio real: <b>${U.fmt(s.e.rer, 0)}</b> (100 = equilíbrio)`] }) +
      metric({ key: 'money', title: 'Base monetária', sub: 'índice nominal (escala log)', dec: 0, log: true, pct: true, extra: (s) => (s.e.monEff > 0.05 ? ['<b>Tesouro financiado com emissão</b>'] : []) }) +
      metric({ key: 'prices', title: 'Nível de preços', sub: 'índice (escala log)', dec: 0, log: true, pct: true });
  };

  PAGE_RENDER.trabalho = function (st) {
    cardNum = 0;
    return pageHead('Trabalho e renda', 'Emprego, pobreza, desigualdade e salário.') +
      metric({ key: 'unemp', title: 'Taxa de desemprego', sub: '% da força de trabalho', dec: 1, unitBig: '%', pillUnit: '%' }) +
      metric({ key: 'poverty', title: 'Pobreza — pessoas abaixo da linha de pobreza', sub: '% da população', dec: 1, unitBig: '% das pessoas', pillUnit: '%' }) +
      metric({ key: 'gini', title: 'Desigualdade — índice de Gini', sub: '0 = igualdade total; 1 = desigualdade máxima', dec: 3, ppUnit: '' }) +
      metric({ key: 'minWage', title: 'Salário mínimo real', sub: 'índice, início do governo = 100', dec: 0, pct: true });
  };

  PAGE_RENDER.fiscal = function (st) {
    cardNum = 0;
    const b = st.e.budget, b0 = st.budgetStart || b;
    const NAMES = { previdencia: 'Previdência', saude: 'Saúde', educacao: 'Educação', social: 'Assistência social', infra: 'Infraestrutura', subsidios: 'Subsídios', admin: 'Administração e pessoal', militar: 'Defesa' };
    const total = U.sum(Object.values(b));
    const budgetCard = `<section class="card"><h3>Orçamento do próximo trimestre (% do PIB)</h3>
      <p class="muted small">Ajuste até ±1 p.p. por categoria a cada trimestre. Cortes desagradam quem depende do gasto; aumentos pioram o déficit. Impostos mudam via ações em Decisões → Impostos.</p>
      <div class="budget">${Object.keys(NAMES).map((k) => `<div class="brow"><span>${NAMES[k]}</span><button class="btn sm" data-a="bud" data-v="${k}" data-d="-0.1">−</button><b>${U.fmt(b[k], 1)}</b><button class="btn sm" data-a="bud" data-v="${k}" data-d="0.1">+</button><small class="${b[k] - b0[k] > 0.05 ? 'up' : b[k] - b0[k] < -0.05 ? 'down' : ''}">${Math.abs(b[k] - b0[k]) > 0.05 ? U.fmtSigned(b[k] - b0[k], 1) : ''}</small></div>`).join('')}</div>
      <div class="bsum">Gasto primário: <b>${U.fmt(total, 1)}%</b> · Receita: <b>${U.fmt(st.e.revenue, 1)}%</b> (carga ${U.fmt(st.e.tax, 1)}%) · Resultado primário: <b class="${st.e.primDef > 0 ? 'down' : 'up'}">${U.fmtSigned(-(total - st.e.revenue), 1)}%</b> · Juros nominais: ${U.fmt(st.e.interestNom, 1)}%</div>
      <div class="muted small">Impostos ativos: IR ${U.fmtSigned(st.e.taxes.renda, 0)} · consumo ${U.fmtSigned(st.e.taxes.consumo, 0)} · empresas ${U.fmtSigned(st.e.taxes.empresas, 0)} · tarifa média de importação ${U.fmt(st.e.taxes.comercio, 0)}% · imposto de exportação ${U.fmt(st.e.taxes.exportacao, 0)}%</div></section>`;
    return pageHead('Fiscal', 'Dívida, déficit, receitas e gastos do governo.') + budgetCard +
      metric({ key: 'debt', title: 'Dívida pública bruta', sub: '% do PIB', dec: 1, unitBig: '% do PIB', pillUnit: '%', extra: (s) => [`Prêmio de risco: <b>${U.fmt(s.e.riskPrem, 1)} p.p.</b>`, `Tolerância estimada do mercado: ~${U.fmt(s.e.debtTol, 0)}% do PIB`] }) +
      metric({ key: 'primDef', title: 'Resultado primário', sub: '% do PIB (positivo = superávit)', dec: 1, unitBig: '% do PIB', pillUnit: '%', zero: true }) +
      metric({ key: 'nominalDef', title: 'Resultado nominal (com juros)', sub: '% do PIB', dec: 1, unitBig: '% do PIB', pillUnit: '%', zero: true }) +
      metric({ keys: [{ key: 'revenue', color: '#6fbf8a', label: 'Receita' }, { key: 'spending', color: '#e06c6c', label: 'Gasto primário', pill: true }], title: 'Receita x gasto primário', sub: '% do PIB', dec: 1, unitBig: '% do PIB', pillUnit: '%' });
  };

  PAGE_RENDER.industria = function (st) {
    cardNum = 0;
    const secs = G.SECTORS;
    const tbl = `<section class="card"><h3>Setores estratégicos</h3><table class="tbl"><thead><tr><th>Setor</th><th>Controle</th><th></th></tr></thead><tbody>
      ${Object.keys(secs).map((s) => { const est = st.sectors[s] === 'estatal'; const a = S.ACTIONS.byId[(est ? 'privatizar_' : 'estatizar_') + s]; const ok = G.actionStatus(st, a); return `<tr><td>${secs[s].name}</td><td><span class="tag ${est ? 'warn' : ''}">${est ? 'Estatal' : 'Privado'}</span></td><td><button class="btn sm" data-a="queue" data-v="${a.id}" ${ok.ok ? '' : 'disabled title="' + esc(ok.why) + '"'}>${est ? 'Privatizar' : 'Estatizar'}</button></td></tr>`; }).join('')}
      </tbody></table><p class="muted small">Peso das estatais na economia: <b>${U.fmt(st.e.soe, 0)}</b>/100.</p></section>`;
    return pageHead('Indústria e empresas', 'Produção industrial, estatais e investimento.') + tbl +
      metric({ key: 'industry', title: 'Produção industrial', sub: 'índice, início do jogo = 100', dec: 0, pct: true }) +
      metric({ key: 'soe', title: 'Peso das estatais', sub: '0-100', dec: 0 }) +
      metric({ key: 'invest', title: 'Investimento', sub: '% do PIB', dec: 1, unitBig: '%', pillUnit: '%' });
  };

  PAGE_RENDER.externo = function (st) {
    cardNum = 0;
    return pageHead('Setor externo', 'Comércio, reservas e o cenário mundial.') +
      metric({ key: 'tb', title: 'Balança comercial', sub: '% do PIB', dec: 1, unitBig: '% do PIB', pillUnit: '%', zero: true, extra: (s) => [`Abertura comercial (índice): <b>${U.fmt(s.e.open * 100, 0)}</b>`, `Tarifa média: <b>${U.fmt(s.e.taxes.comercio, 0)}%</b>`] }) +
      metric({ key: 'reserves', title: 'Reservas internacionais', sub: 'meses de importação', dec: 1, unitBig: ' meses', refLine: 3, refLabel: 'mín.' }) +
      metric({ key: 'oil', title: 'Petróleo', sub: 'US$ de 2020 por barril', dec: 0, unitBig: ' US$', pct: true, note: H.oilExp(st) > 0.3 ? 'Seu país é exportador de petróleo: alta beneficia receitas.' : H.oilImp(st) > 0.3 ? 'Seu país importa petróleo: alta pressiona inflação e balança.' : '' }) +
      metric({ key: 'commod', title: 'Commodities não-petróleo', sub: 'índice 2010 = 100', dec: 0, pct: true }) +
      metric({ key: 'worldGrowth', title: 'Crescimento mundial', sub: '% a.a.', dec: 1, unitBig: '%', pillUnit: '%', zero: true }) +
      metric({ key: 'worldRate', title: 'Juros da potência âncora (EUA/Reino Unido)', sub: '% a.a.', dec: 2, unitBig: '%', pillUnit: '%' });
  };

  PAGE_RENDER.social = function (st) {
    cardNum = 0;
    return pageHead('Social', 'Saúde, educação, segurança, instituições e meio ambiente.') +
      metric({ key: 'health', title: 'Índice de saúde', sub: '0-100', dec: 0 }) +
      metric({ key: 'education', title: 'Índice de educação', sub: '0-100', dec: 0 }) +
      metric({ key: 'infraIdx', title: 'Infraestrutura', sub: '0-100', dec: 0 }) +
      metric({ key: 'security', title: 'Segurança pública', sub: '0-100 (maior = mais seguro)', dec: 0 }) +
      metric({ key: 'corruption', title: 'Corrupção percebida', sub: '0-100 (maior = pior)', dec: 0 }) +
      metric({ key: 'press', title: 'Liberdade de imprensa', sub: '0-100', dec: 0 }) +
      metric({ key: 'environment', title: 'Qualidade ambiental', sub: '0-100', dec: 0 }) +
      metric({ key: 'pop', title: 'População', sub: 'milhões', dec: 1, unitBig: ' mi', pct: true, extra: (s) => [`Mortes em guerras, desastres e epidemias no seu governo: <b>${U.fmtBig(s.stats.deaths * 1000)}</b>`] });
  };

  PAGE_RENDER.defesa = function (st) {
    cardNum = 0;
    const others = S.DIP.others(st).sort((a, b) => (st.dip.rel[b] || 0) - (st.dip.rel[a] || 0));
    const myPow = S.DIP.powerOf(st.cid, st);
    const rows = others.map((cid) => {
      const c = S.COUNTRIES.byId[cid], r = st.dip.rel[cid] || 0, pow = S.DIP.powerOf(cid, st);
      const war = st.mil.wars.find((w) => w.target === cid);
      const tags = [war ? '<span class="tag bad">em guerra</span>' : '', st.dip.alliances[cid] ? '<span class="tag good">aliado</span>' : '', st.dip.deals[cid] ? '<span class="tag">livre comércio</span>' : '', S.DIP.hasNukes(cid, st) ? '<span class="tag">nuclear</span>' : '', S.DIP.isNeighbor(st, cid) ? '<span class="tag">vizinho</span>' : ''].join('');
      return `<tr><td>${c.flag} ${esc(H.cname(cid, st))}</td><td><div class="relbar"><i style="left:50%;width:${Math.abs(r) / 2}%;${r < 0 ? 'transform:translateX(-100%);background:#e06c6c' : 'background:#6fbf8a'}"></i></div> ${Math.round(r)}</td><td class="muted small">${S.WORLD.blocOf(cid, H.t(st)).replace('_', '-')}</td><td>${U.fmt(pow / myPow, 1)}×</td><td>${tags}</td><td><button class="btn sm" data-a="dip" data-v="${cid}">Ações</button></td></tr>`;
    }).join('');
    const wars = st.mil.wars.map((w) => `<div class="war"><b>⚔️ ${esc(H.cname(w.target, st))}</b> ${esc(w.label)} — desde ${U.monthLabel(w.sinceMonth)}<div class="warbar"><i style="left:${50 + Math.min(0, w.score) / 2}%;width:${Math.abs(w.score) / 2}%;background:${w.score >= 0 ? '#6fbf8a' : '#e06c6c'}"></i></div><small class="muted">Derrota ← ${U.fmt(w.score, 0)} → Vitória · razão de forças ${U.fmt(S.DIP.warRatio(st, w), 2)}</small></div>`).join('');
    return pageHead('Defesa e diplomacia', 'Relações exteriores, alianças, guerras e poder militar.') +
      (wars ? `<section class="card">${wars}<p class="muted small">Cansaço de guerra: ${U.fmt(st.mil.warEx, 0)}/100</p></section>` : '') +
      `<section class="card"><h3>Relações exteriores</h3><p class="muted small">Seu bloco: <b>${H.myBloc(st).replace('_', '-')}</b> · Poder relativo = poder militar do país ÷ o seu. ${st.mil.nukes ? 'Você possui armas nucleares.' : ''}</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>País</th><th>Relação</th><th>Bloco</th><th>Poder</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>` +
      metric({ key: 'strength', title: 'Poder militar', sub: 'índice (PIB × gasto × tecnologia)', dec: 0, pct: true }) +
      metric({ key: 'milPct', title: 'Gasto militar', sub: '% do PIB', dec: 1, unitBig: '% do PIB', pillUnit: '%' });
  };

  // ---------- Decisões ----------
  function ideoFit(st, a) {
    if (!a.ideo || (!a.ideo.e && !a.ideo.s)) return '';
    const r = H.ideologyReaction(st, a.ideo, 1);
    if (r.betrayal > 0.15) return '<span class="tag bad" title="Sua base vai ver como traição">contradiz seu programa</span>';
    const L = st.leader;
    const align = (a.ideo.e * L.e + a.ideo.s * L.s) / 10000;
    if (align > 0.15) return '<span class="tag good">coerente com seu programa</span>';
    return '';
  }
  function outcomesPreview(st, a, target) {
    if (!a.outcomes) return '';
    let outs;
    try { outs = G.outcomesFor(st, a, target); } catch (e) { return ''; }
    if (!outs) return '';
    return `<div class="outs">${outs.map((o) => `<div><div class="pbar"><i style="width:${o.p * 100}%"></i></div><span>${Math.round(o.p * 100)}%</span> ${esc(o.label)}</div>`).join('')}</div>`;
  }
  function actionCard(st, a, target) {
    const s = G.actionStatus(st, a, target);
    const pp = G.congressPassProb(st, a);
    const cost = G.actionCost(st, a);
    return `<div class="acard ${s.ok ? '' : 'off'}">
      <div class="ahead"><h4>${esc(a.name)}</h4><span class="cost" title="Custo em capital político">${'●'.repeat(cost)}</span></div>
      <p>${esc(a.desc)}</p>
      <div class="atags">${pp < 1 ? `<span class="tag" title="Chance de aprovação no Congresso">Congresso ${Math.round(pp * 100)}%</span>` : ''}${ideoFit(st, a)}${a.custom ? `<span class="tag">${a.composed ? 'criada pela sua ordem' : 'criada por IA'}</span>` : ''}</div>
      ${outcomesPreview(st, a, target)}
      ${a.id === 'declarar_guerra' && target ? `<div class="outs">${S.DIP.warOdds(st, target).map((o) => `<div><div class="pbar"><i style="width:${o.p * 100}%"></i></div><span>${Math.round(o.p * 100)}%</span> ${esc(o.label)}</div>`).join('')}</div>` : ''}
      <div class="afoot">${s.ok ? `<button class="btn primary sm" data-a="queue" data-v="${a.id}" ${target ? `data-t="${target}"` : ''}>Adicionar à fila</button>` : `<small class="muted">${esc(s.why)}</small>`}</div></div>`;
  }

  PAGE_RENDER.decisoes = function (st) {
    const cats = Object.assign({ todas: 'Todas', disponiveis: 'Disponíveis agora' }, S.ACTION_CATS);
    const q = U.stripAccents(UI.decSearch.toLowerCase());
    let list = S.ACTIONS.list.filter((a) => !a.target && (!a.custom || UI.decCat === 'livre'));
    if (UI.decCat === 'disponiveis') list = list.filter((a) => G.actionStatus(st, a).ok);
    else if (UI.decCat !== 'todas') list = list.filter((a) => a.cat === UI.decCat);
    if (q) list = list.filter((a) => U.stripAccents((a.name + ' ' + a.desc + ' ' + (a.kw || []).join(' ')).toLowerCase()).includes(q));
    list.sort((a, b) => (G.actionStatus(st, b).ok ? 1 : 0) - (G.actionStatus(st, a).ok ? 1 : 0));
    const queued = st.queue.reduce((s, x) => s + x.cost, 0);
    const ir = UI.intentResults;
    return `<div class="page-head"><h1>Decisões do trimestre</h1><p>Escolha medidas até o limite do seu capital político. Ao encerrar o trimestre, elas são executadas e o país roda 3 meses.</p></div>
      <div class="dec-layout">
        <div class="dec-main">
          <div class="chips">${Object.keys(cats).map((k) => `<button class="chip ${UI.decCat === k ? 'on' : ''}" data-a="deccat" data-v="${k}">${cats[k]}</button>`).join('')}</div>
          <input class="search" placeholder="Buscar medida (ex.: privatizar, juros, saúde, reforma agrária)…" value="${esc(UI.decSearch)}" data-a="decsearch">
          <div class="alist">${list.map((a) => actionCard(st, a)).join('') || '<p class="muted">Nenhuma medida encontrada.</p>'}</div>
          <p class="muted small">Ações diplomáticas e militares (com país-alvo) ficam em <a href="#" data-a="page" data-v="defesa">Defesa e diplomacia</a>. Orçamento em <a href="#" data-a="page" data-v="fiscal">Fiscal</a>; juros em <a href="#" data-a="page" data-v="moeda">Moeda e preços</a>.</p>
        </div>
        <aside class="dec-side card">
          <h3>Fila do trimestre</h3>
          <p class="muted small">Capital político: ${st.pol.capital - queued} de ${st.pol.capital} disponível</p>
          ${st.queue.length ? st.queue.map((x, i) => { const a = S.ACTIONS.byId[x.id]; return `<div class="qitem"><span>${esc(a ? a.name : x.id)}${x.target ? ' — ' + esc(H.cname(x.target, st)) : ''}</span><button class="btn sm" data-a="unqueue" data-v="${i}">✕</button></div>`; }).join('') : '<p class="muted">Nenhuma medida na fila. Você pode encerrar o trimestre sem agir — o mundo segue.</p>'}
          <hr>
          <h3>Ordem livre</h3>
          <p class="muted small">Escreva o que quer fazer, com quantidade e prazo se quiser. Ex.: “congelar o salário mínimo por 3 meses sem repor a inflação”, “juros a -1%”, “cortar 20% do gasto militar”, “proibir importações por 1 ano”. ${AI.CONFIG.get().useAiOrders && AI.CONFIG.aiReady() ? 'Interpretação via Gemini (qualquer medida).' : 'Interpretação offline (sem IA).'}</p>
          ${AI.CONFIG.get().useAiOrders && AI.CONFIG.aiReady() ? '' : `<p class="warn small">⚠️ Sem IA, o jogo cria medidas novas só sobre: ${esc(S.COMPOSER.LEVER_NAMES.join('; '))}, além das cartas do catálogo. Para escrever <b>qualquer</b> coisa, ative a IA em <a href="#" data-a="page" data-v="config">Config</a> (chave gratuita do Gemini).</p>`}
          <textarea id="order" rows="3" placeholder="Sua ordem…"></textarea>
          <button class="btn" data-a="order">Interpretar ordem</button>
          ${ir ? `<div class="intent">${ir.html}</div>` : ''}
          <hr>
          <button class="btn primary wide" data-a="endturn" ${st.over ? 'disabled' : ''}>Encerrar trimestre ▸</button>
        </aside>
      </div>`;
  };

  PAGE_RENDER.relatorios = function (st) {
    const reps = st.reports.slice().reverse();
    return `<div class="page-head"><h1>Relatórios trimestrais</h1><p>O que suas decisões causaram, trimestre a trimestre.</p></div>` +
      (reps.length ? reps.map((r, i) => `<section class="card"><div class="rhead"><h3>${r.q}º tri/${r.y}</h3><button class="btn sm" data-a="showreport" data-v="${st.reports.length - 1 - i}">Abrir</button></div><ul class="bul">${r.summary.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${r.events.length ? `<p class="muted small">Eventos: ${r.events.map((e) => esc(e.title)).join(' · ')}</p>` : ''}</section>`).join('') : '<p class="muted">Nenhum relatório ainda.</p>');
  };

  PAGE_RENDER.historia = function (st) {
    const ICON = { hist: '📜', rand: '🎲', cond: '⚙️', futuro: '🔮', acao: '🏛️', escolha: '✍️', eleicao: '🗳️', guerra: '⚔️', regime: '⚖️', inicio: '⭐', fim: '🏁' };
    return `<div class="page-head"><h1>Linha do tempo</h1><p>Tudo o que aconteceu desde que você assumiu.</p></div><div class="timeline">` +
      st.timeline.slice().reverse().map((x) => `<div class="tl ${x.kind}"><div class="tl-d">${x.q}º/${x.y}</div><div class="tl-b"><b>${ICON[x.kind] || '•'} ${esc(x.title)}</b><p>${esc(x.text || '')}</p></div></div>`).join('') + '</div>';
  };

  PAGE_RENDER.conselheiro = function (st) {
    const diag = AI.ADVISOR.diagnose(st);
    const useAi = AI.CONFIG.get().useAiAdvisor && AI.CONFIG.aiReady();
    return `<div class="page-head"><h1>Conselheiro</h1><p>${useAi ? 'Conectado ao Gemini (com o diagnóstico do motor como contexto).' : 'Conselheiro offline: diagnóstico por regras do próprio simulador.'} Todas as conversas são salvas no log de dados.</p></div>
      <section class="card"><h3>Diagnóstico</h3><ul class="diag">${diag.map((d) => `<li class="sev${d.sev}">${esc(d.t)}</li>`).join('')}</ul></section>
      <section class="card chat"><div class="msgs" id="msgs">${(st.chat || []).map((m) => `<div class="msg ${m.role}"><b>${m.role === 'user' ? 'Você' : 'Conselheiro'}</b><p>${esc(m.text).replace(/\n/g, '<br>')}</p></div>`).join('') || '<p class="muted">Pergunte sobre inflação, juros, eleição, golpe, dívida, câmbio, guerra, privatizações…</p>'}</div>
      <div class="chatin"><input id="ask" placeholder="Pergunte ao conselheiro…" ${UI.chatBusy ? 'disabled' : ''}><button class="btn primary" data-a="ask" ${UI.chatBusy ? 'disabled' : ''}>${UI.chatBusy ? '…' : 'Enviar'}</button></div></section>`;
  };

  PAGE_RENDER.config = function (st) {
    const cfg = AI.CONFIG.get();
    const ds = AI.DATALOG.stats();
    const saves = STORE.list();
    return `<div class="page-head"><h1>Configurações</h1><p>IA opcional, dados coletados e saves.</p></div>
      <section class="card"><h3>IA opcional — Google Gemini</h3>
        <p class="muted small">O jogo funciona 100% sem IA. Se quiser, cole uma chave gratuita do Google AI Studio (aistudio.google.com → Get API key). A chave fica só no seu navegador (localStorage) e é enviada apenas para generativelanguage.googleapis.com.</p>
        <label class="row">Chave da API <input type="password" id="gkey" value="${esc(cfg.geminiKey)}" placeholder="AIza..."></label>
        <label class="row">Modelo <input id="gmodel" value="${esc(cfg.geminiModel)}"></label>
        <label class="chk"><input type="checkbox" id="useAiOrders" ${cfg.useAiOrders ? 'checked' : ''}> Usar IA para interpretar ordens livres (pode criar medidas novas, com efeitos limitados)</label>
        <label class="chk"><input type="checkbox" id="useAiAdvisor" ${cfg.useAiAdvisor ? 'checked' : ''}> Usar IA no Conselheiro</label>
        <label class="chk"><input type="checkbox" id="useAiReports" ${cfg.useAiReports ? 'checked' : ''}> Usar IA para narrar os relatórios trimestrais</label>
        <div class="row"><button class="btn primary" data-a="savecfg">Salvar configurações</button><button class="btn" data-a="testai">Testar conexão</button><span id="aitest" class="muted small"></span></div>
      </section>
      <section class="card"><h3>Dados coletados (para melhorar o modo sem IA)</h3>
        <label class="chk"><input type="checkbox" id="logData" ${cfg.logData ? 'checked' : ''}> Registrar ordens livres, conversas e relatórios</label>
        <p>${ds.total} registros · ${Object.keys(ds.by).map((k) => k + ': ' + ds.by[k]).join(' · ') || 'nenhum'} · <b>${ds.unmatched}</b> ordens que o interpretador offline não entendeu (ótimas candidatas a virar novas ações).</p>
        <div class="row"><button class="btn" data-a="exportlog">Exportar JSON</button><button class="btn" data-a="clearlog">Apagar log</button></div>
      </section>
      <section class="card"><h3>Partidas salvas</h3>
        ${st ? `<div class="row"><button class="btn primary" data-a="saveslot">Salvar partida atual</button><button class="btn" data-a="exportsave">Baixar arquivo do save</button></div>` : ''}
        <label class="row">Importar save <input type="file" id="importsave" accept=".json"></label>
        <table class="tbl"><tbody>${Object.keys(saves).map((k) => `<tr><td>${saves[k].meta.flag} ${esc(saves[k].meta.pais)} — ${saves[k].meta.tri}º/${saves[k].meta.ano}</td><td class="muted small">${esc(saves[k].meta.lider)} · ${esc(k)} · ${esc(saves[k].meta.salvo)}</td><td><button class="btn sm" data-a="loadslot" data-v="${esc(k)}">Carregar</button> <button class="btn sm" data-a="delslot" data-v="${esc(k)}">Apagar</button></td></tr>`).join('') || '<tr><td class="muted">Nenhum save.</td></tr>'}</tbody></table>
        <label class="chk"><input type="checkbox" id="autosave" ${cfg.autosave ? 'checked' : ''}> Salvar automaticamente a cada trimestre</label>
      </section>
      <section class="card"><h3>Partida</h3><button class="btn" data-a="newgame">Novo jogo</button></section>`;
  };

  // ======================= MODAIS =======================
  function modal(html, cls) {
    const m = $('#modal');
    m.innerHTML = `<div class="overlay"><div class="dialog ${cls || ''}">${html}</div></div>`;
    m.querySelector('.dialog').scrollTop = 0;
  }
  function closeModal() { const m = $('#modal'); if (m) m.innerHTML = ''; }

  UI.openEvents = function () {
    const st = UI.st;
    if (!st.pendingEvents.length) { closeModal(); UI.render(); return; }
    const pe = st.pendingEvents[0];
    const ev = S.EVENTS.byId[pe.id];
    const choices = ev.choices.map((ch, i) => {
      if (ch.req && !ch.req(st)) return '';
      const label = typeof ch.label === 'function' ? ch.label(st) : ch.label;
      let probs = '';
      if (ch.outcomes) { try { probs = `<div class="outs">${U.normalizeOutcomes(ch.outcomes(st)).map((o) => `<div><div class="pbar"><i style="width:${o.p * 100}%"></i></div><span>${Math.round(o.p * 100)}%</span> ${esc(o.label)}</div>`).join('')}</div>`; } catch (e) { /* */ } }
      const fit = ch.ideo ? ideoFit(st, { ideo: typeof ch.ideo === 'function' ? ch.ideo(st) : ch.ideo }) : '';
      return `<button class="choice" data-a="choose" data-v="${i}"><b>${esc(label)}</b>${fit}${probs}</button>`;
    }).join('');
    modal(`<div class="ev-kind">${{ hist: 'Evento histórico', rand: 'Acontecimento', cond: 'Consequência', futuro: 'Futuro' }[ev.kind] || ''} · ${st.q}º tri/${st.year}</div>
      <h2 class="sev-${ev.sev || 'info'}">${esc(pe.title)}</h2><p>${esc(pe.text)}</p><div class="choices">${choices}</div>
      <p class="muted small">${st.pendingEvents.length > 1 ? `Mais ${st.pendingEvents.length - 1} decisão(ões) na fila.` : ''}</p>`, 'event');
  };

  UI.showReport = function (idx) {
    const st = UI.st, r = st.reports[idx];
    if (!r) return;
    const b = r.before, a = r.after;
    const row = (lab, k, dec, unit, inv) => { const d = a[k] - b[k]; const good = inv ? d < 0 : d > 0; return `<div class="kpi sm"><small>${lab}</small><b>${U.fmt(a[k], dec)}<i>${unit}</i></b>${Math.abs(d) > 0.05 ? `<span class="${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${U.fmt(Math.abs(d), dec)}</span>` : ''}</div>`; };
    const acts = r.actions.map((x) => {
      const gs = Object.keys(x.groups || {}).filter((g) => Math.abs(x.groups[g]) >= 1).sort((p, q) => Math.abs(x.groups[q]) - Math.abs(x.groups[p])).slice(0, 5);
      return `<div class="ract ${x.failed ? 'failed' : ''}"><b>${esc(x.name)}</b>${x.lines.map((l) => `<p>${esc(l)}</p>`).join('')}${gs.length ? `<p class="small">Reação imediata: ${gs.map((g) => `<span class="${x.groups[g] > 0 ? 'up' : 'down'}">${P.groups[g].name} ${U.fmtSigned(x.groups[g], 0)}</span>`).join(' · ')}</p>` : ''}</div>`;
    }).join('') || '<p class="muted">Nenhuma medida tomada neste trimestre.</p>';
    const chs = (r.choices || []).map((c) => `<div class="ract"><b>${esc(c.title)}</b><p>Decisão: ${esc(c.choice)}${c.auto ? ' (automática)' : ''}</p>${c.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`).join('');
    const evs = r.events.map((e) => `<div class="rev sev-${e.sev}"><b>${esc(e.title)}</b><p>${esc(e.text)}</p>${(e.lines || []).map((l) => `<p>${esc(l)}</p>`).join('')}${e.hasChoices ? '<p class="small muted">Exige sua decisão.</p>' : ''}</div>`).join('');
    const pol = r.politics.map((e) => `<div class="rev sev-${e.sev}"><b>${esc(e.title)}</b><p>${esc(e.text)}</p></div>`).join('');
    modal(`<div class="ev-kind">Relatório trimestral</div><h2>${r.q}º trimestre de ${r.y}</h2>
      <div class="kpis small">${row('Aprovação', 'approval', 1, '%')}${row('PIB 12m', 'growth', 1, '%')}${row('Inflação', 'infl', 1, '%', true)}${row('Juros', 'rate', 2, '%')}${row('Desemprego', 'unemp', 1, '%', true)}${row('Dívida', 'debt', 1, '%', true)}${row('Câmbio', 'fx', 0, '', true)}${row('Reservas', 'reserves', 1, 'm')}</div>
      <h3>O que aconteceu</h3><ul class="bul">${r.summary.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <div id="narr">${r.narrative ? `<div class="narr">${esc(r.narrative)}</div>` : ''}</div>
      ${chs ? `<h3>Suas respostas aos acontecimentos</h3>${chs}` : ''}
      <h3>Suas decisões</h3>${acts}
      ${pol ? `<h3>Política</h3>${pol}` : ''}
      ${evs ? `<h3>Notícias do trimestre</h3>${evs}` : ''}
      <div class="row end"><button class="btn primary" data-a="closereport">${st.pendingEvents.length ? 'Responder aos acontecimentos ▸' : 'Continuar'}</button></div>`, 'report');
    const cfg = AI.CONFIG.get();
    if (cfg.useAiReports && AI.CONFIG.aiReady() && !r.narrative && idx === st.reports.length - 1) {
      $('#narr').innerHTML = '<div class="narr muted">Gerando narrativa com IA…</div>';
      AI.GEMINI.narrate(st, r).then((txt) => { r.narrative = txt; AI.DATALOG.add({ type: 'relatorio', source: 'gemini', input: r.summary, output: txt, ctx: AI.DATALOG.context(st) }); const n = $('#narr'); if (n) n.innerHTML = `<div class="narr">${esc(txt)}</div>`; })
        .catch((e) => { const n = $('#narr'); if (n) n.innerHTML = `<div class="narr muted">IA indisponível: ${esc(e.message)}</div>`; });
    }
  };

  UI.openDip = function (cid) {
    const st = UI.st;
    const acts = S.ACTIONS.list.filter((a) => a.target);
    const c = S.COUNTRIES.byId[cid];
    modal(`<div class="ev-kind">Diplomacia</div><h2>${c.flag} ${esc(H.cname(cid, st))}</h2>
      <p class="muted">Relação: ${Math.round(st.dip.rel[cid] || 0)} · Bloco: ${S.WORLD.blocOf(cid, H.t(st))} · Poder relativo: ${U.fmt(S.DIP.powerOf(cid, st) / S.DIP.powerOf(st.cid, st), 1)}× ${S.DIP.hasNukes(cid, st) ? '· potência nuclear' : ''}</p>
      <div class="alist">${acts.map((a) => actionCard(st, a, cid)).join('')}</div>
      <div class="row end"><button class="btn" data-a="close">Fechar</button></div>`, 'wide');
  };

  UI.gameOverDialog = function () {
    const st = UI.st;
    const yrs = (st.month - (st.startYear * 12 + (st.startQ - 1) * 3)) / 12;
    modal(`<div class="ev-kind">Fim do governo</div><h2>${esc(st.gameOver.text)}</h2>
      <p>Você governou ${esc(H.name(st))} por <b>${U.fmt(yrs, 1)} anos</b> (${st.startQ}º/${st.startYear} → ${st.q}º/${st.year}).</p>
      <ul class="bul"><li>Medidas tomadas: ${st.stats.actions}</li><li>Eleições: ${st.stats.elections.map((e) => (e.won ? 'vitória ' : 'derrota ') + U.fmt(e.share, 1) + '% (' + e.y + ')').join(', ') || 'nenhuma'}</li><li>Mortes em guerras/desastres: ${U.fmtBig(st.stats.deaths * 1000)}</li><li>Vezes em que contrariou o próprio programa: ${st.stats.betrayals}</li></ul>
      <h3>Continuar a história com um novo governo</h3>
      <p class="muted small">O país segue; você assume o próximo governante (escolha a ideologia de quem chega ao poder).</p>
      <div class="row"><select id="newideo">${Object.keys(P.ideologies).map((k) => `<option value="${k}">${P.ideologies[k].name}</option>`).join('')}</select><input id="newleader" placeholder="Nome do novo governante"></div>
      <div class="row end"><button class="btn" data-a="close">Ver o país</button><button class="btn" data-a="newgame">Novo jogo</button><button class="btn primary" data-a="continue">Continuar como novo governo</button></div>`);
  };

  UI.continueAsNew = function (ideoId, name) {
    const st = UI.st, I = P.ideologies[ideoId], reason = st.gameOver.reason;
    if (reason === 'golpe') H.setRegime(st, 'militar');
    else if (reason === 'revolucao' && !H.dem(st)) H.setRegime(st, ideoId === 'comunista' ? 'partido_unico' : ideoId === 'teocratico' ? 'teocracia' : 'presidencialista');
    else if (reason === 'intervencao') H.setRegime(st, 'partido_unico');
    else if (reason === 'derrota' && !H.dem(st)) H.setRegime(st, S.COUNTRIES.histRegime(H.country(st), H.t(st) + 1) || 'parlamentarista');
    st.leader = { name: name || 'Novo governante', party: I.name, ideoId: ideoId, e: I.e, s: I.s };
    const p = st.pol;
    for (const g of P.groupIds) { const a = P.initialGroupApproval(g, I) + (st.regime === 'militar' && g === 'militares' ? 18 : 0); p.base[g] = a; p.base0[g] = a; p.shock[g] = 0; }
    p.termsServed = 1; p.termStartMonth = st.month; p.coherence = 75; p.congressBase = 45; p.legitBonus = 5; p.capital = 4; p.protests *= 0.5;
    p.militaryLoyalty = Math.max(p.militaryLoyalty, 45);
    if (S.POLITICS.regimes[st.regime].elections) S.POL.scheduleElection(st); else p.nextElection = null;
    st.mil.wars = st.mil.wars.filter(() => reason !== 'derrota');
    st.over = false; st.gameOver = null; st.pendingGameOver = null; st.pendingEvents = []; st.queue = [];
    st.mandates.push({ start: st.month, label: st.leader.name });
    st.timeline.push({ y: st.year, q: st.q, kind: 'inicio', title: 'Novo governo', text: st.leader.name + ' (' + I.name + ') assume o poder.' });
    closeModal(); UI.page = 'painel'; UI.render();
  };

  // ======================= FLUXO DE TURNO =======================
  UI.endTurn = function () {
    const st = UI.st;
    if (st.over) { UI.gameOverDialog(); return; }
    if (st.pendingEvents.length) { UI.openEvents(); return; }
    const btns = document.querySelectorAll('[data-a="endturn"]');
    btns.forEach((b) => { b.disabled = true; b.textContent = 'Simulando…'; });
    setTimeout(() => {
      const rep = G.endTurn(st);
      st.budgetStart = U.deepClone(st.e.budget);
      if (AI.CONFIG.get().autosave) STORE.save('auto', st);
      if (AI.CONFIG.get().logData && rep) AI.DATALOG.add({ type: 'turno', input: { acoes: rep.actions.map((a) => a.id), escolhas: rep.choices.map((c) => c.title + ' → ' + c.choice) }, output: { resumo: rep.summary, eventos: rep.events.map((e) => e.id) }, ctx: AI.DATALOG.context(st) });
      UI.intentResults = null;
      UI.render();
      UI.showReport(st.reports.length - 1);
    }, 30);
  };

  // ======================= ORDENS LIVRES =======================
  UI.handleOrder = async function (text) {
    const st = UI.st;
    if (!text.trim()) return;
    const cfg = AI.CONFIG.get();
    if (cfg.useAiOrders && AI.CONFIG.aiReady()) {
      UI.intentResults = { html: '<p class="muted">Consultando Gemini…</p>' }; UI.render();
      try {
        const r = await AI.GEMINI.interpretOrder(st, text);
        let html = `<p class="small">${esc(r.explicacao || '')}</p>`;
        for (const id of r.acoes) html += intentRow({ type: 'action', id: id, label: S.ACTIONS.byId[id].name, target: r.alvo && S.COUNTRIES.byId[r.alvo] ? r.alvo : null });
        if (r.custom) {
          const cid = 'custom_' + Date.now();
          st.customActions = st.customActions || [];
          st.customActions.push({ id: cid, name: r.custom.nome, desc: r.custom.descricao, ideo: r.custom.ideo, eff: r.custom.eff, groups: r.custom.groups });
          registerCustom(st);
          html += intentRow({ type: 'action', id: cid, label: r.custom.nome + ' (nova medida)' });
        }
        if (!r.acoes.length && !r.custom) html += '<p class="muted">A IA não encontrou medida correspondente.</p>';
        UI.intentResults = { html: html };
      } catch (e) {
        UI.intentResults = { html: `<p class="down small">Erro na IA: ${esc(e.message)}. Usando interpretador offline.</p>` + offlineIntentHtml(st, text) };
      }
      UI.render();
      return;
    }
    UI.intentResults = { html: offlineIntentHtml(st, text) };
    UI.render();
  };
  // registra uma medida montada pelo compositor offline como ação personalizada (vai no save)
  function registerComposed(st, m) {
    st.customActions = st.customActions || [];
    const same = st.customActions.find((c) => c.composed && c.name === m.name && !st.flags['done_' + c.id] && !st.queue.some((q) => q.id === c.id));
    if (same) { same.eff = m.eff; same.desc = m.desc; const a = S.ACTIONS.byId[same.id]; if (a) { a.eff = m.eff; a.desc = m.desc; } return same.id; }
    const id = 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    st.customActions.push({ id: id, name: m.name, desc: m.desc, ideo: m.ideo, eff: m.eff, cost: m.cost, congress: m.congress, composed: true });
    registerCustom(st);
    return id;
  }
  function offlineIntentHtml(st, text) {
    const comp = S.COMPOSER.parse(st, text);
    let res = AI.INTENT.parse(st, text);
    const levers = comp.measures.map((m) => m.lever);
    if (levers.includes('gasto')) res = res.filter((r) => r.type !== 'budget'); // o compositor entende melhor quantidades de gasto
    AI.DATALOG.add({ type: 'ordem', source: 'offline', input: text, output: comp.measures.map((m) => m.name).concat(res.map((r) => r.label)), matched: comp.measures.length + res.length > 0, ctx: AI.DATALOG.context(st) });
    let html = '';
    if (comp.measures.length) {
      html += '<p class="small">Medida(s) criada(s) a partir da sua ordem:</p>';
      for (const m of comp.measures) {
        const id = registerComposed(st, m);
        html += intentRow({ type: 'action', id: id, label: m.name, composed: m });
      }
    }
    for (const f of comp.fails) html += `<p class="muted small">${esc(f)}</p>`;
    if (res.length) html += `<p class="small">${comp.measures.length ? 'Cartas parecidas do catálogo:' : 'Entendi (cartas do catálogo):'}</p>` + res.map(intentRow).join('');
    if (!comp.measures.length && !res.length) {
      return `<p class="warn small">⚠️ O interpretador offline não entendeu essa ordem. Para criar <b>qualquer</b> medida, ative a IA em <a href="#" data-a="page" data-v="config">Config</a>. A ordem foi registrada no log de dados.</p><p class="muted small">Sem IA dá para escrever sobre: ${esc(S.COMPOSER.LEVER_NAMES.join('; '))}, ou usar palavras das cartas (“privatizar”, “reforma agrária”…).</p>`;
    }
    if (!comp.measures.length && !(AI.CONFIG.get().useAiOrders && AI.CONFIG.aiReady())) html += '<p class="muted small">Não era isso? Medidas fora do catálogo precisam da IA (Config).</p>';
    return html;
  }
  function intentRow(r) {
    const st = UI.st;
    if (r.type === 'action') {
      const a = S.ACTIONS.byId[r.id];
      const s = G.actionStatus(st, a, r.target);
      const pp = G.congressPassProb(st, a);
      const extra = r.composed ? `<small class="muted">${esc(r.composed.desc)}${S.COMPOSER.preview(r.composed) ? '<br>Efeitos: ' + esc(S.COMPOSER.preview(r.composed)) : ''}<br>Custo ${'●'.repeat(G.actionCost(st, a))}${pp < 1 ? ' · Congresso ' + Math.round(pp * 100) + '%' : ''}</small>` : '';
      return `<div class="qitem"><span>${esc(r.label)}${r.target ? ' — ' + esc(H.cname(r.target, st)) : ''}${extra ? '<br>' + extra : ''}</span>${a.target && !r.target ? `<button class="btn sm" data-a="page" data-v="defesa">escolher país</button>` : s.ok ? `<button class="btn sm primary" data-a="queue" data-v="${r.id}" ${r.target ? `data-t="${r.target}"` : ''}>+ fila</button>` : `<small class="muted">${esc(s.why)}</small>`}</div>`;
    }
    if (r.type === 'rate' || r.type === 'rateDelta') {
      const ok = !st.cbIndep && !['euro', 'dolarizado'].includes(st.fxRegime);
      return `<div class="qitem"><span>${esc(r.label)}</span>${ok ? `<button class="btn sm primary" data-a="applyrate" data-v="${r.type === 'rate' ? r.value : st.e.rate + r.value}">aplicar</button>` : '<small class="muted">BC autônomo: use “Pressionar o BC” ou retire a autonomia</small>'}</div>`;
    }
    if (r.type === 'budget') return `<div class="qitem"><span>${esc(r.label)}</span><button class="btn sm primary" data-a="applybud" data-v="${r.cat}" data-d="${r.value}">aplicar</button></div>`;
    return '';
  }

  UI.ask = async function (q) {
    const st = UI.st;
    if (!q.trim()) return;
    st.chat = st.chat || [];
    st.chat.push({ role: 'user', text: q });
    const cfg = AI.CONFIG.get();
    let ans, source = 'offline';
    if (cfg.useAiAdvisor && AI.CONFIG.aiReady()) {
      UI.chatBusy = true; UI.render();
      try { ans = await AI.GEMINI.advise(st, q, st.chat.slice(0, -1)); source = 'gemini'; } catch (e) { ans = 'IA indisponível (' + e.message + '). Resposta offline:\n\n' + AI.ADVISOR.answer(st, q); }
      UI.chatBusy = false;
    } else ans = AI.ADVISOR.answer(st, q);
    st.chat.push({ role: 'model', text: ans });
    if (st.chat.length > 60) st.chat.splice(0, st.chat.length - 60);
    AI.DATALOG.add({ type: 'conselheiro', source: source, input: q, output: ans, ctx: AI.DATALOG.context(st) });
    UI.render();
    const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight;
  };

  // ======================= EVENTOS DO DOM =======================
  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-a]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT' && el.type !== 'button') return;
    const a = el.dataset.a, v = el.dataset.v, st = UI.st;
    if (S.SETUP && S.SETUP.handle(a, el, ev)) return;
    if (!st && !['newgame', 'loadslot', 'delslot', 'savecfg', 'testai', 'exportlog', 'clearlog'].includes(a)) return;
    switch (a) {
      case 'page': ev.preventDefault(); UI.page = v; closeModal(); UI.render(); window.scrollTo(0, 0); break;
      case 'win': UI.months = +v; UI.render(); break;
      case 'endturn': UI.endTurn(); break;
      case 'events': UI.openEvents(); break;
      case 'choose': {
        const r = G.resolveEventChoice(st, 0, +v, U.makeRng((st.rngState || 1) + st.turn * 7 + (+v) + st.pendingEvents.length));
        if (st.pendingGameOver) { st.over = true; st.gameOver = st.pendingGameOver; st.timeline.push({ y: st.year, q: st.q, kind: 'fim', title: 'Fim do governo', text: st.gameOver.text }); }
        if (r && r.lines.length) { modal(`<h2>${esc(r.title)}</h2><p><b>Decisão:</b> ${esc(r.choice)}</p>${r.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<div class="row end"><button class="btn primary" data-a="${st.over ? 'gameover' : 'events'}">Continuar</button></div>`, 'event'); }
        else if (st.over) UI.gameOverDialog();
        else UI.openEvents();
        break;
      }
      case 'closereport': closeModal(); if (st.over) UI.gameOverDialog(); else if (st.pendingEvents.length) UI.openEvents(); else UI.render(); break;
      case 'close': closeModal(); UI.render(); break;
      case 'showreport': UI.showReport(+v); break;
      case 'gameover': UI.gameOverDialog(); break;
      case 'continue': UI.continueAsNew($('#newideo').value, $('#newleader').value.trim()); break;
      case 'queue': { const act = S.ACTIONS.byId[v]; const r = G.queueAction(st, act, el.dataset.t || null); if (!r.ok) alert(r.why); closeModal(); UI.render(); break; }
      case 'unqueue': G.unqueue(st, +v); UI.render(); break;
      case 'deccat': UI.decCat = v; UI.render(); break;
      case 'dip': UI.openDip(v); break;
      case 'bud': {
        const d = +el.dataset.d, b0 = st.budgetStart || st.e.budget;
        const nv = Math.round((st.e.budget[v] + d) * 10) / 10;
        if (nv < 0 || Math.abs(nv - b0[v]) > 1.0001) return;
        st.e.budget[v] = nv; UI.render(); break;
      }
      case 'applyrate': st.rateMode = 'manual'; st.e.rateManual = U.clamp(+v, -50, 1e6); UI.intentResults = { html: '<p class="up small">Juro alvo definido em ' + U.fmt(+v, 2) + '%.</p>' }; UI.render(); break;
      case 'applybud': {
        const b0 = st.budgetStart || st.e.budget, d = +el.dataset.d;
        const nv = U.clamp(st.e.budget[v] + d, Math.max(0, b0[v] - 1), b0[v] + 1);
        st.e.budget[v] = Math.round(nv * 10) / 10;
        UI.intentResults = { html: `<p class="up small">Orçamento ajustado (limite de ±1 p.p. por trimestre).</p>` }; UI.render(); break;
      }
      case 'order': UI.handleOrder($('#order').value); break;
      case 'ask': { const i = $('#ask'); UI.ask(i.value); break; }
      case 'savecfg': AI.CONFIG.set({ geminiKey: $('#gkey').value.trim(), geminiModel: $('#gmodel').value.trim() || 'gemini-2.5-flash', useAiOrders: $('#useAiOrders').checked, useAiAdvisor: $('#useAiAdvisor').checked, useAiReports: $('#useAiReports').checked, logData: $('#logData').checked, autosave: $('#autosave') ? $('#autosave').checked : true }); UI.render(); break;
      case 'testai': { const out = $('#aitest'); out.textContent = 'Testando…'; AI.CONFIG.set({ geminiKey: $('#gkey').value.trim(), geminiModel: $('#gmodel').value.trim() || 'gemini-2.5-flash' }); AI.GEMINI.call('Responda apenas: OK', false).then((t) => { out.textContent = 'Conectado: ' + t.slice(0, 40); }).catch((e) => { out.textContent = 'Falhou: ' + e.message; }); break; }
      case 'exportlog': STORE.download('soberania-dados-' + Date.now() + '.json', AI.DATALOG.all()); break;
      case 'clearlog': if (confirm('Apagar todo o log de dados?')) { AI.DATALOG.clear(); UI.render(); } break;
      case 'saveslot': { const n = prompt('Nome do save:', H.name(st) + ' ' + st.year); if (n) { STORE.save(n, st) ? UI.render() : alert('Sem espaço no navegador. Baixe o arquivo do save.'); } break; }
      case 'exportsave': STORE.download('soberania-' + st.cid + '-' + st.year + '.json', st); break;
      case 'loadslot': { const s = STORE.load(v); if (s) { closeModal(); UI.start(s); } break; }
      case 'delslot': if (confirm('Apagar o save "' + v + '"?')) { STORE.del(v); UI.render(); } break;
      case 'newgame': if (!st || st.over || confirm('Abandonar a partida atual? (o autosave continua disponível)')) { UI.st = null; closeModal(); document.body.classList.remove('in-game'); UI.render(); } break;
    }
  });
  document.addEventListener('change', function (ev) {
    const el = ev.target;
    const st = UI.st;
    if (S.SETUP && S.SETUP.change && S.SETUP.change(el)) return;
    if (el.id === 'importsave') {
      const f = el.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { try { const s = JSON.parse(rd.result); if (!s.cid || !s.hist) throw new Error('arquivo inválido'); UI.start(s); } catch (e) { alert('Não foi possível importar: ' + e.message); } };
      rd.readAsText(f);
      return;
    }
    if (!st) return;
    if (el.dataset.a === 'ratemode') { st.rateMode = el.value; if (st.rateMode === 'manual') st.e.rateManual = Math.round(st.e.rate * 4) / 4; UI.render(); }
    if (el.dataset.a === 'rateset') { st.e.rateManual = U.clamp(parseFloat(el.value) || 0, -50, 1e6); UI.render(); }
  });
  document.addEventListener('input', function (ev) {
    const el = ev.target;
    if (el.dataset && el.dataset.a === 'decsearch') {
      UI.decSearch = el.value;
      const pos = el.selectionStart;
      UI.render();
      const n = document.querySelector('[data-a="decsearch"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
    }
    if (S.SETUP && S.SETUP.input) S.SETUP.input(el);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.id === 'ask') UI.ask(ev.target.value);
    if (ev.key === 'Enter' && ev.target.id === 'order' && !ev.shiftKey) { ev.preventDefault(); UI.handleOrder(ev.target.value); }
  });
})(globalThis.S = globalThis.S || {});
