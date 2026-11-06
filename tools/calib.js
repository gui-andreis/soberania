// Compara crescimento médio simulado (10 anos, sem ações do jogador) com o histórico.
const S = require('./load')();
const U = S.U, C = S.COUNTRIES;
const cases = process.argv[2] ? process.argv[2].split(',') : ['BR:1950','BR:1980','BR:2000','AR:1960','US:1950','US:1990','CN:1980','IN:1950','IN:1995','JP:1960','KR:1965','DE:1950','UK:1950','MX:1980','RU:2000','TR:2003','NG:1990','BR:2015','CL:1985','EG:1990'];
for (const cs of cases) {
  const [cid, y] = cs.split(':');
  let gs = [], pis = [], fin = [];
  for (let seed = 1; seed <= 5; seed++) {
    const st = S.GAME.newGame({ cid, year: +y, quarter: 1, ideology: 'centro', seed });
    const y0 = S.H.gdppc(st) * st.e.pop;
    let n = 0, piSum = 0;
    for (let i = 0; i < 40 && !st.over; i++) { S.GAME.endTurn(st); n++; piSum += st.e.infl; }
    const yrs = n / 4;
    gs.push((Math.pow(S.H.gdppc(st) * st.e.pop / y0, 1 / yrs) - 1) * 100);
    pis.push(piSum / n); fin.push(st.over ? 'X' : '.');
  }
  const c = C.byId[cid], y0 = +y, y1 = Math.min(y0 + 10, 2025);
  const hist = (Math.pow(U.interp(c.gdppc, y1) * U.interp(c.pop, y1) / (U.interp(c.gdppc, y0) * U.interp(c.pop, y0)), 1 / (y1 - y0)) - 1) * 100;
  console.log(cs.padEnd(8), 'sim', U.fmt(U.avg(gs), 1).padStart(5), ' hist', U.fmt(hist, 1).padStart(5), '  infl média', U.fmt(U.avg(pis), 1).padStart(7), ' ', fin.join(''));
}
