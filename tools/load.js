// Carrega o motor no Node (sem DOM) para testes headless.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const FILES = ['js/core/util.js', 'js/data/world.js', 'js/data/countries.js', 'js/data/politics.js', 'js/engine/core.js', 'js/engine/sim.js',
  'js/engine/politics.js', 'js/engine/diplomacy.js', 'js/engine/game.js', 'js/engine/events.js', 'js/data/actions.js',
  'js/data/events_hist.js', 'js/data/events_rand.js', 'js/data/events_cond.js', 'js/ai/composer.js'];
module.exports = function load() {
  const ctx = { console, Math, Date, JSON };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.S;
};
