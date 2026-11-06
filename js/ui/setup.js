// Tela de criação de partida: país, ano (1920-2025), regime, ideologia, nomes e opções.
(function (S) {
  'use strict';
  const U = S.U, C = S.COUNTRIES, P = S.POLITICS;
  const esc = S.CHARTS.esc;
  const SETUP = {};
  const st = { year: 2003, q: 1, cid: 'BR', regime: '', ideology: 'centro', leader: '', party: '', cb: '', difficulty: 'normal', seed: '' };

  function t() { return st.year + (st.q - 1) / 4; }
  function avail() { return C.list.filter((c) => C.available(c, t())); }

  SETUP.render = function (root) {
    const list = avail();
    if (!list.find((c) => c.id === st.cid)) st.cid = list[0].id;
    const c = C.byId[st.cid];
    const hr = C.histRegime(c, t());
    const hl = C.histLeader(c, t());
    const regime = st.regime || hr;
    const saves = S.UI.STORE.list();
    const auto = saves.auto;
    const hlIdeo = hl ? hl[2] : null;
    const cbHist = !!C.stepTrait(c, 'cbIndep', t(), false);
    root.innerHTML = `<div class="setup">
      <div class="hero"><div class="logo"><span class="dot"></span> SOBERANIA</div><p>Simulador geopolítico por turnos · 1920 em diante · sem limite de ano</p>
        ${auto ? `<button class="btn primary" data-a="loadslot" data-v="auto">Continuar: ${auto.meta.flag} ${esc(auto.meta.pais)} — ${auto.meta.tri}º/${auto.meta.ano}</button>` : ''}
        ${Object.keys(saves).filter((k) => k !== 'auto').length ? `<button class="btn" data-a="s_saves">Partidas salvas (${Object.keys(saves).filter((k) => k !== 'auto').length})</button>` : ''}
      </div>
      <div class="setup-grid">
        <section class="card">
          <h3>1 · Quando você assume</h3>
          <div class="row"><input type="range" min="1920" max="2025" value="${st.year}" data-s="year" class="range"><input type="number" min="1920" max="2025" value="${st.year}" data-s="year" class="yearnum">
          <select data-s="q">${[1, 2, 3, 4].map((q) => `<option value="${q}" ${st.q === q ? 'selected' : ''}>${q}º trimestre</option>`).join('')}</select></div>
          <p class="muted small">${eraText(st.year)}</p>
          <h3>2 · Qual país</h3>
          <div class="cgrid">${list.map((x) => { const L = C.histLeader(x, t()); return `<button class="ccard ${x.id === st.cid ? 'on' : ''}" data-a="s_country" data-v="${x.id}"><span class="flag">${x.flag}</span><b>${esc(C.nameAt(x, t()))}</b><small>${P.regimes[C.histRegime(x, t())].name}${L ? ' · ' + esc(L[1]) : ''}</small></button>`; }).join('')}</div>
          <p class="muted small">${C.list.length - list.length} país(es) indisponível(is) nesta data (ainda não independentes ou sob ocupação).</p>
        </section>
        <section class="card">
          <h3>3 · O cenário</h3>
          <div class="sel-country"><span class="flag big">${c.flag}</span><div><b>${esc(C.nameAt(c, t()))}</b> em ${st.q}º tri/${st.year}<br><small class="muted">Regime histórico: ${P.regimes[hr].name}${hl ? ' · governante histórico: ' + esc(hl[1]) : ''}</small></div></div>
          ${(c.special || []).map((s) => `<p class="muted small">📌 ${esc(s)}</p>`).join('')}
          <label class="row">Regime <select data-s="regime">${Object.keys(P.regimes).map((k) => `<option value="${k}" ${regime === k ? 'selected' : ''}>${P.regimes[k].name}${k === hr ? ' (histórico)' : ''}</option>`).join('')}</select></label>
          <p class="muted small">${esc(P.regimes[regime].desc)}${regime !== hr ? ' <span class="tag warn">Linha do tempo alternativa: legitimidade inicial menor.</span>' : ''}</p>
          <h3>4 · Sua ideologia / partido</h3>
          <div class="igrid">${Object.keys(P.ideologies).map((k) => `<button class="icard ${st.ideology === k ? 'on' : ''}" data-a="s_ideo" data-v="${k}"><b>${P.ideologies[k].name}${k === hlIdeo ? ' ★' : ''}</b><small>${esc(P.ideologies[k].desc)}</small></button>`).join('')}</div>
          ${hlIdeo ? '<p class="muted small">★ = linha do governante histórico nesta data.</p>' : ''}
          <div class="row"><label>Seu nome <input data-s="leader" value="${esc(st.leader)}" placeholder="Presidente / Primeiro-ministro"></label><label>Partido <input data-s="party" value="${esc(st.party)}" placeholder="Nome do partido"></label></div>
          <div class="row"><label>Banco Central <select data-s="cb"><option value="" ${st.cb === '' ? 'selected' : ''}>Histórico (${cbHist ? 'autônomo' : 'subordinado'})</option><option value="1" ${st.cb === '1' ? 'selected' : ''}>Autônomo</option><option value="0" ${st.cb === '0' ? 'selected' : ''}>Subordinado ao governo</option></select></label>
          <label>Dificuldade <select data-s="difficulty"><option value="facil" ${st.difficulty === 'facil' ? 'selected' : ''}>Fácil (menos crises)</option><option value="normal" ${st.difficulty === 'normal' ? 'selected' : ''}>Normal</option><option value="dificil" ${st.difficulty === 'dificil' ? 'selected' : ''}>Difícil (mais crises)</option></select></label>
          <label>Semente <input data-s="seed" value="${esc(st.seed)}" placeholder="aleatória" style="width:110px"></label></div>
          <button class="btn primary wide big" data-a="s_start">Assumir o governo ▸</button>
        </section>
      </div>
      <p class="muted small center">Dados históricos aproximados (Maddison Project, ONU, FMI, Banco Mundial). A partir de 2026 o mundo segue processos probabilísticos.</p>
    </div><div id="modal"></div>`;
  };

  function eraText(y) {
    if (y < 1929) return 'Anos 20: padrão-ouro, pós-Primeira Guerra, gripe espanhola recente. Crash de 1929 no horizonte.';
    if (y < 1939) return 'Grande Depressão: deflação, desemprego em massa, protecionismo, ascensão de regimes autoritários.';
    if (y < 1946) return 'Segunda Guerra Mundial: economia de guerra, racionamento, alianças decisivas.';
    if (y < 1973) return 'Era de ouro: Bretton Woods (câmbio fixo), crescimento acelerado, Guerra Fria e descolonização.';
    if (y < 1983) return 'Estagflação: choques do petróleo, juros altíssimos (Volcker), crise da dívida.';
    if (y < 1992) return 'Década perdida na América Latina, hiperinflações, fim da Guerra Fria.';
    if (y < 2008) return 'Globalização: Consenso de Washington, metas de inflação, crises emergentes, ascensão da China.';
    if (y < 2020) return 'Pós-crise de 2008: juros zero, crise do euro, fim do superciclo de commodities, polarização.';
    return 'Pós-pandemia: inflação global, guerra na Ucrânia, tarifas, IA. Depois de 2025 o futuro é aberto.';
  }

  SETUP.handle = function (a, el) {
    if (S.UI.st) return false;
    const root = document.getElementById('app');
    switch (a) {
      case 's_country': st.cid = el.dataset.v; st.regime = ''; SETUP.render(root); return true;
      case 's_ideo': st.ideology = el.dataset.v; SETUP.render(root); return true;
      case 's_saves': S.UI.st = null; renderSaves(); return true;
      case 's_start': {
        const c = C.byId[st.cid];
        const game = S.GAME.newGame({ cid: st.cid, year: st.year, quarter: st.q, regime: st.regime || C.histRegime(c, t()), ideology: st.ideology,
          leaderName: st.leader || 'Você', partyName: st.party || ('Partido ' + P.ideologies[st.ideology].name), cbIndep: st.cb === '' ? undefined : st.cb === '1',
          difficulty: st.difficulty, seed: st.seed ? (parseInt(st.seed, 10) || hash(st.seed)) : undefined });
        S.UI.start(game);
        return true;
      }
    }
    return false;
  };
  function hash(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
  function renderSaves() {
    const saves = S.UI.STORE.list();
    const m = document.getElementById('modal');
    m.innerHTML = `<div class="overlay"><div class="dialog"><h2>Partidas salvas</h2><table class="tbl"><tbody>${Object.keys(saves).map((k) => `<tr><td>${saves[k].meta.flag} ${esc(saves[k].meta.pais)} — ${saves[k].meta.tri}º/${saves[k].meta.ano}</td><td class="muted small">${esc(k)}</td><td><button class="btn sm" data-a="loadslot" data-v="${esc(k)}">Carregar</button></td></tr>`).join('')}</tbody></table>
      <label class="row">Importar arquivo <input type="file" id="importsave" accept=".json"></label><div class="row end"><button class="btn" data-a="s_close">Fechar</button></div></div></div>`;
  }
  SETUP.change = function (el) {
    if (S.UI.st || !el.dataset || !el.dataset.s) return false;
    const k = el.dataset.s;
    if (k === 'year') st.year = U.clamp(parseInt(el.value, 10) || 2003, 1920, 2025);
    else if (k === 'q') st.q = parseInt(el.value, 10);
    else st[k] = el.value;
    if (k === 'year' || k === 'q' || k === 'regime') SETUP.render(document.getElementById('app'));
    return true;
  };
  SETUP.input = function (el) {
    if (S.UI.st || !el.dataset || !el.dataset.s) return;
    const k = el.dataset.s;
    if (k === 'year' && el.type === 'range') { st.year = parseInt(el.value, 10); const n = document.querySelector('.yearnum'); if (n) n.value = st.year; }
    else if (k === 'leader' || k === 'party' || k === 'seed') st[k] = el.value;
  };
  document.addEventListener('click', (ev) => { const el = ev.target.closest('[data-a="s_close"]'); if (el) document.getElementById('modal').innerHTML = ''; });
  S.SETUP = SETUP;
})(globalThis.S = globalThis.S || {});
