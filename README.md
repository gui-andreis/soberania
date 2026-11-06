# SOBERANIA — Simulador Geopolítico

Simulador geopolítico por turnos (trimestres), sem IA obrigatória. Você escolhe **país**, **ano** (1920–2025, sem limite de fim), **regime** e **ideologia**, decide medidas, e o motor roda 3 meses de economia e política, gera um relatório do que suas decisões causaram e dispara eventos históricos (crash de 1929, choques do petróleo, crise de 2008, COVID...), aleatórios e consequências do estado do país.

## Como jogar

Abra `index.html` no navegador (Chrome/Edge/Firefox). Não precisa de instalação nem de build.

Se o navegador bloquear algo por estar em `file://`, sirva a pasta:

```
python -m http.server 8000
```

e acesse http://localhost:8000.

## O que tem

| Item | Quantidade |
|---|---|
| Países | 26, com dados de 1920 a 2025 (população, PIB per capita, inflação, dívida, desemprego, Gini, regimes e líderes históricos) |
| Ações do governo | 233 (moeda, fiscal, impostos, privatizar/estatizar 10 setores, agro, infraestrutura, social, trabalho, segurança, instituições, defesa, diplomacia com alvo, organizações, meio ambiente) |
| Eventos | 263: 134 históricos datados, 65 aleatórios, 45 condicionais e 19 do futuro (pós-2025) |
| Abas | Painel, Aprovação, Atividade, Moeda e preços, Trabalho, Fiscal, Indústria, Setor externo, Social, Defesa e diplomacia, Decisões, Relatórios, Linha do tempo, Conselheiro, Config |

## Como o motor funciona (sem IA)

- **Economia mensal** (`js/engine/sim.js`): hiato do produto (curva IS), inflação com inércia e expectativas (Phillips, em log para lidar com hiperinflação), regra de Taylor com **juro neutro específico de cada país e época** (por exemplo, o Brasil precisa de juro real mais alto), câmbio por regime (ouro, fixo, banda, flutuante, conversibilidade, euro, dolarizado), dívida pela dinâmica r−g, prêmio de risco, reservas, emissão de moeda e convergência de renda (Solow).
- **Juros sem almoço grátis:** com BC subordinado você fixa o juro por decreto, inclusive **zero ou negativo**. Juro abaixo da regra técnica derruba a credibilidade e desancora expectativas; juro real muito negativo provoca **fuga da moeda** (dolarização, depreciação, perda de reservas, inflação); juro nominal abaixo de −0,5% trava os bancos (o estímulo encolhe). Inflação e dívida/PIB **não têm teto**.
- **Calibração histórica:** sem nenhuma ação do jogador, o crescimento de 10 anos fica próximo do real. Rode `node tools/calib.js` para comparar.
- **Política** (`js/engine/politics.js`): 11 grupos sociais com posição ideológica e peso eleitoral (que muda com a urbanização). Cada medida tem código ideológico; quando contraria o programa do governante, a **base sente traição** e a coerência cai. Exemplo: um governo de esquerda que privatiza perde apoio de sindicatos e servidores; um liberal que faz o mesmo, quase nada.
- **Desfechos probabilísticos:** ultimatos, guerras, planos de estabilização, golpes, impeachment, adesões e outros mostram as chances **antes** de você decidir (por exemplo, "guerra 72% · mediação 14% · sanções 12% · cede 2%").
- **Eventos** (`js/engine/events.js`): os históricos disparam na data real e se adaptam ao seu país. Quando o evento foi decisão de um governante (invadir a Polônia, Malvinas, Crimeia), ele vira escolha sua. Os aleatórios dependem da geografia, das instituições e da época. Os condicionais nascem do estado do país (hiperinflação, ataque especulativo, golpe, revolução, moratória...).

## IA opcional (Gemini)

Na aba **Config**, cole uma chave gratuita do Google AI Studio e marque o que quer usar:

- **Ordens livres:** a IA mapeia o texto para ações do catálogo ou cria qualquer medida nova (com efeitos sobre demanda, inflação, salário mínimo, orçamento, impostos, duração etc., limitados por código).
- **Conselheiro.**
- **Narrativa dos relatórios.**

Sem chave, tudo funciona offline: o conselheiro usa regras e as ordens livres passam pelo **compositor** (`js/ai/composer.js`), que entende *alavanca + verbo + quantidade + prazo* e cria a medida com efeitos calculados a partir do estado do país. Ex.: “congelar o salário mínimo por 3 meses sem repor a inflação”, “cortar 20% do gasto militar”, “proibir importações por 1 ano”, “juros a -1%”. Alavancas offline: salário mínimo, salário dos servidores, preços (gerais e alimentos), aluguéis, combustíveis/energia, impostos, gastos do orçamento, importações/exportações e juros. Fora disso, a interface avisa que é preciso ativar a IA.

## Dados para melhorar o modo sem IA

Ordens livres, conversas com o conselheiro, relatórios e decisões de cada turno ficam gravados em `localStorage`. Em **Config → Exportar JSON** você baixa tudo. As ordens que o interpretador offline não entendeu aparecem contadas, prontas para virar novas ações em `js/data/actions.js`.

## Estrutura

```
index.html, css/style.css
js/core/util.js            utilidades, RNG determinístico, formatação pt-BR
js/data/world.js           séries mundiais 1920-2025, blocos, organizações, rivalidades
js/data/countries.js       26 países (âncoras históricas + traços estruturais)
js/data/politics.js        regimes, ideologias, grupos sociais
js/data/actions.js         catálogo de ações
js/data/events_*.js        eventos históricos / aleatórios / condicionais + futuro
js/engine/*.js             motor (efeitos, economia, política, diplomacia, eventos, turnos)
js/ai/ai.js                interpretador offline, conselheiro, Gemini, log de dados
js/ai/composer.js          compositor offline de ordens livres (cria medidas novas)
js/ui/*.js                 gráficos SVG, interface e tela inicial
tools/                     testes headless em Node (test.js, calib.js, stress.js)
```

### Adicionar uma ação

Em `js/data/actions.js`:

```js
act('minha_acao', 'social', 'Nome', 'Descrição', {
  cost: 1, congress: 0.4, ideo: { e: -30, s: 0 }, kw: ['palavras', 'chave'],
  eff: { budget: { social: 0.3 }, poverty: -1, groups: { pobres: 8 } },
  lag: [{ turns: 8, eff: { gpot: 0.1 }, note: 'Efeito de longo prazo.' }]
});
```

### Adicionar um evento

Em `js/data/events_*.js`, use `prob` (chance por trimestre), `cond(st)`, `date: [ano, tri]` ou `window: [ini, fim]`, `eff` e `choices`. Cada escolha pode ter `outcomes(st) => [{ p, label, eff }]`.

## Testes

```
node tools/test.js            # simula vários cenários e imprime a trajetória
node tools/calib.js           # crescimento simulado x histórico
node tools/stress.js          # 60 partidas aleatórias, checa NaN e exceções
```
