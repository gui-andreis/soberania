// Estresse: muitas partidas, ações e escolhas aleatórias, checando NaN/infinito e exceções.
const S = require('./load')();
const U = S.U;
const rng = U.makeRng(123);
const ideos = Object.keys(S.POLITICS.ideologies);
let games = 0, turns = 0, problems = 0, overs = {};
const t0 = Date.now();
for (let g = 0; g < 60; g++) {
  const year = 1920 + Math.floor(rng() * 106);
  const avail = S.COUNTRIES.list.filter((c) => S.COUNTRIES.available(c, year));
  const c = avail[Math.floor(rng() * avail.length)];
  const regs = Object.keys(S.POLITICS.regimes);
  const st = S.GAME.newGame({ cid: c.id, year, quarter: 1 + Math.floor(rng() * 4), ideology: ideos[Math.floor(rng() * ideos.length)], regime: rng() < 0.2 ? regs[Math.floor(rng() * regs.length)] : undefined, seed: g + 1 });
  games++;
  const maxT = 40 + Math.floor(rng() * 160);
  for (let i = 0; i < maxT; i++) {
    if (st.over) { overs[st.gameOver.reason] = (overs[st.gameOver.reason] || 0) + 1; break; }
    try {
      // ações aleatórias
      for (let k = 0; k < 3; k++) {
        const a = S.ACTIONS.list[Math.floor(rng() * S.ACTIONS.list.length)];
        const others = S.DIP.others(st);
        const tg = a.target ? others[Math.floor(rng() * others.length)] : null;
        if (a.id === 'declarar_guerra' && rng() < 0.8) continue;
        if (S.GAME.actionStatus(st, a, tg).ok) S.GAME.queueAction(st, a, tg);
      }
      while (st.pendingEvents.length) {
        const ev = S.EVENTS.byId[st.pendingEvents[0].id];
        S.GAME.resolveEventChoice(st, 0, Math.floor(rng() * ev.choices.length), rng);
      }
      S.GAME.endTurn(st); turns++;
    } catch (e) { problems++; console.log('EXCEÇÃO', c.id, st.year, e.stack.split('\n').slice(0, 4).join(' | ')); break; }
    const vals = { Y: st.e.Y, infl: st.e.infl, rate: st.e.rate, debt: st.e.debt, fx: st.e.fx, unemp: st.e.unemp, appr: st.pol.approval, pov: st.e.poverty, gini: st.e.gini, res: st.e.reserves, pop: st.e.pop, gap: st.e.gap, conf: st.e.confidence };
    const bad = Object.entries(vals).filter(([k, v]) => !isFinite(v));
    if (bad.length) { problems++; console.log('NaN/Inf', c.id, year, '->', st.year, bad.map((b) => b[0]).join(',')); break; }
    if (st.e.Y <= 0 || st.e.pop <= 0) { problems++; console.log('PIB/pop <= 0', c.id, st.year); break; }
  }
}
console.log('jogos', games, 'turnos', turns, 'problemas', problems, 'tempo', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'ms/turno', ((Date.now() - t0) / turns).toFixed(1));
console.log('fins de jogo:', JSON.stringify(overs));
const t = S.AI ? 1 : 0;
