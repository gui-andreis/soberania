const S = require('./load')();
const U = S.U;
console.log('Eventos:', S.EVENTS.list.length, ' (hist', S.EVENTS.list.filter(e=>e.kind==='hist').length, 'rand', S.EVENTS.list.filter(e=>e.kind==='rand').length, 'cond', S.EVENTS.list.filter(e=>e.kind==='cond').length, 'futuro', S.EVENTS.list.filter(e=>e.kind==='futuro').length, ')');
console.log('Ações:', S.ACTIONS.list.length, ' Países:', S.COUNTRIES.list.length);
const scen = (process.argv[2] || 'BR:1995:centro,AR:1985:populista,US:1929:conservador,DE:1925:centro,BR:2023:socialista,CN:1980:comunista,RU:1992:liberal,UK:1979:liberal,VE:2010:populista,JP:1990:conservador,IN:1950:socdem,BR:1950:populista').split(',');
const years = +(process.argv[3] || 12);
for (const sc of scen) {
  const [cid, y, ideo] = sc.split(':');
  const st = S.GAME.newGame({ cid, year: +y, quarter: 1, ideology: ideo, seed: 42 });
  const row = (lab) => console.log(lab.padEnd(8), st.year + 'Q' + st.q, 'g', U.fmt(st.e.growthYoY,1).padStart(6), 'pi', U.fmt(st.e.infl,1).padStart(8), 'i', U.fmt(st.e.rate,1).padStart(7), 'u', U.fmt(st.e.unemp,1).padStart(5), 'div', U.fmt(st.e.debt,0).padStart(4), 'pd', U.fmt(st.e.primDef,1).padStart(5), 'fx', U.fmt(st.e.fx,0).padStart(6), 'res', U.fmt(st.e.reserves,1).padStart(5), 'pov', U.fmt(st.e.poverty,1).padStart(5), 'apr', U.fmt(st.pol.approval,0).padStart(3), 'pib/hab', Math.round(S.H.gdppc(st)), 'conf', Math.round(st.e.confidence), 'prot', Math.round(st.pol.protests));
  console.log('\n=== ' + cid + ' ' + y + ' ' + ideo + ' regime=' + st.regime + ' fx=' + st.fxRegime + ' cb=' + st.cbIndep);
  row('inicio');
  let evs = 0;
  for (let i = 0; i < years * 4 && !st.over; i++) {
    const r = S.GAME.endTurn(st);
    evs += r.events.length;
    if (i % 4 === 3) row('ano');
    for (const e of r.events) if (e.sev === 'crise') console.log('   ! ' + e.title);
    for (const p of r.politics) console.log('   * ' + p.title + ' — ' + p.text);
  }
  if (st.over) console.log('   FIM:', st.gameOver.text);
  console.log('   eventos:', evs, 'mortes(mil):', Math.round(st.stats.deaths));
}
