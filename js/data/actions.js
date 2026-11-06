// Catálogo de ações do governo. Cada ação tem:
//  ideo {e,s}: como a medida é codificada ideologicamente (gera aprovação/rejeição por grupo e "traição" da base)
//  eff: efeitos imediatos; mods: efeitos contínuos; lag: efeitos defasados; outcomes: desfechos probabilísticos
//  congress: dificuldade legislativa (0-1) em democracias; kw: palavras-chave para o interpretador de ordens livres.
(function (S) {
  'use strict';
  const U = S.U, H = S.H;
  const A = [];
  const act = (id, cat, name, desc, o) => A.push(Object.assign({ id: id, cat: cat, name: name, desc: desc }, o));
  const t = (st) => H.t(st);
  // programa com gasto temporário e legado permanente
  const project = (cat, pct, turns, legacy, note) => ({
    budget: { [cat]: pct }, demand: pct * 0.04,
    lag: [{ turns: turns, eff: Object.assign({ budget: { [cat]: -pct } }, legacy || {}), note: note }]
  });
  const phase = (name, eff, turns) => ({ name: name, turns: turns, per: eff });

  S.ACTION_CATS = {
    monetaria: 'Moeda e câmbio', fiscal: 'Fiscal e orçamento', tributos: 'Impostos', industria: 'Indústria e empresas',
    agro: 'Agro e terra', infra: 'Infraestrutura e energia', social: 'Social e direitos', trabalho: 'Trabalho',
    seguranca: 'Segurança e justiça', instituicoes: 'Instituições e poder', militar: 'Defesa', diplomacia: 'Diplomacia', ambiente: 'Meio ambiente',
    livre: 'Criadas por você'
  };

  // ======================= MOEDA E CÂMBIO =======================
  act('bc_autonomia', 'monetaria', 'Dar autonomia formal ao Banco Central', 'Mandatos fixos para a diretoria do BC, foco em inflação. Ancoragem de expectativas no médio prazo.', {
    cost: 2, congress: 0.5, ideo: { e: 40, s: 0 }, kw: ['autonomia', 'independencia', 'banco central'],
    req: (st) => (st.cbIndep ? 'O BC já é autônomo' : true), eff: { cbIndep: true, inflExp: -1.5, confidence: 8, groups: { financeiro: 10 } }
  });
  act('bc_intervir', 'monetaria', 'Acabar com a autonomia do Banco Central', 'O governo volta a controlar diretamente a política de juros.', {
    cost: 2, congress: 0.5, ideo: { e: -40, s: 10 }, kw: ['intervir', 'fim da autonomia', 'controlar banco central'],
    req: (st) => (!st.cbIndep ? 'O BC já é subordinado ao governo' : true), eff: { cbIndep: false, inflExp: 3, confidence: -12, fx: 6, groups: { financeiro: -15, sindicatos: 3 } }
  });
  act('pressionar_bc', 'monetaria', 'Pressionar publicamente o BC por juros menores', 'Discursos e indicações contra a "taxa de juros absurda". Ganha apoio popular, mas eleva prêmio de risco.', {
    cost: 1, ideo: { e: -25, s: 0 }, cooldown: 2, kw: ['pressionar', 'juros menores', 'baixar juros'],
    req: (st) => (!st.cbIndep ? 'Com BC subordinado, você define os juros diretamente na aba Moeda' : true),
    eff: { flags: { pressaoBC: true }, inflExp: 0.8, confidence: -4, fx: 2, groups: { trabalhadores: 2, empresarios: 2, financeiro: -6 } }
  });
  act('metas_inflacao', 'monetaria', 'Adotar o regime de metas de inflação', 'Meta anual pública, BC persegue a meta com a taxa de juros (padrão desde Nova Zelândia, 1990).', {
    cost: 1, minYear: 1990, ideo: { e: 30, s: 0 }, kw: ['meta de inflacao', 'metas'],
    req: (st) => (st.inflTarget != null ? 'Já existe meta' : true),
    eff: (st) => ({ target: H.advanced(st) ? 2 : (st.e.infl > 15 ? 8 : 4), inflExp: -1, confidence: 5, groups: { financeiro: 6 } })
  });
  act('emitir_moeda', 'monetaria', 'Financiar o déficit com emissão de moeda', 'O Banco Central compra títulos do Tesouro / imprime dinheiro. Alivia o caixa agora; historicamente, é a principal causa de hiperinflações (Alemanha 1923, Hungria 1946, Zimbábue 2008, Venezuela 2018).', {
    cost: 1, ideo: { e: -30, s: 0 }, kw: ['imprimir dinheiro', 'emitir moeda', 'emissao', 'rodar a maquina'],
    req: (st) => (st.e.monetize >= 0.5 ? 'Já está emitindo' : (st.fxRegime === 'euro' || st.fxRegime === 'dolarizado') ? 'Sem moeda própria' : true),
    eff: { monetize: 0.6, inflExp: 4, confidence: -14, fx: 8, groups: { financeiro: -15, servidores: 3 } }
  });
  act('parar_emissao', 'monetaria', 'Proibir o financiamento monetário do Tesouro', 'Fecha a torneira da emissão. Exige ajuste fiscal ou dívida para cobrir o déficit.', {
    cost: 1, ideo: { e: 35, s: 0 }, kw: ['parar de imprimir', 'fim da emissao'],
    req: (st) => (st.e.monetize <= 0 ? 'Não há emissão para cortar' : true), eff: { monetize: -1, inflExp: -3, confidence: 8, groups: { financeiro: 8 } }
  });
  act('desvalorizar', 'monetaria', 'Desvalorizar a moeda oficialmente', 'Reajuste do câmbio fixo/banda. Melhora a competitividade e a balança comercial, mas encarece importados e a dívida em dólar.', {
    cost: 1, ideo: { e: -10, s: 10 }, cooldown: 2, kw: ['desvalorizar', 'maxidesvalorizacao', 'desvalorizacao'],
    req: (st) => (['flutuante'].includes(st.fxRegime) ? 'Com câmbio flutuante o mercado define a taxa' : st.fxRegime === 'euro' || st.fxRegime === 'dolarizado' ? 'Sem moeda própria' : true),
    eff: (st) => ({ fx: st.e.rer < 85 ? 30 : 18, reserves: 1, infl: st.e.rer < 85 ? 3 : 5, confidence: st.e.reserves < 3 ? 6 : -3, groups: { agro: 8, empresarios: 3, classe_media: -6, trabalhadores: -4 } })
  });
  act('flutuar_cambio', 'monetaria', 'Adotar câmbio flutuante', 'O mercado passa a definir a taxa de câmbio; o BC deixa de queimar reservas para defender a paridade.', {
    cost: 1, ideo: { e: 30, s: 0 }, kw: ['cambio flutuante', 'deixar o cambio flutuar', 'flutuar'],
    req: (st) => (st.fxRegime === 'flutuante' ? 'Câmbio já flutua' : st.fxRegime === 'euro' ? 'Membro do euro' : st.fxRegime === 'dolarizado' ? 'Economia dolarizada' : true),
    eff: (st) => ({ fxRegime: 'flutuante', fx: Math.max(5, 100 - st.e.rer) * 0.9, unflag: 'controleCapitais', infl: 2, confidence: 3, groups: { financeiro: 5, agro: 4 } })
  });
  act('fixar_cambio', 'monetaria', 'Fixar o câmbio (âncora cambial)', 'Paridade fixa com o dólar para ancorar preços. Funciona contra inflação, mas valoriza o câmbio real e exige reservas (Brasil 1994-99, México 1994).', {
    cost: 2, ideo: { e: 15, s: 0 }, kw: ['fixar cambio', 'ancora cambial', 'cambio fixo', 'paridade'],
    req: (st) => (H.isFixed(st) || st.fxRegime === 'banda' ? 'Câmbio já é administrado' : true),
    eff: (st) => ({ fxRegime: 'banda', inflExp: -Math.min(12, st.e.infl * 0.2), confidence: 4, groups: { classe_media: 5 } })
  });
  act('conversibilidade', 'monetaria', 'Conversibilidade: 1 peso = 1 dólar (currency board)', 'Cada unidade de moeda emitida precisa de lastro em dólar. Mata a inflação, mas tira toda a política monetária (Argentina 1991-2001).', {
    cost: 3, congress: 0.4, minYear: 1960, ideo: { e: 50, s: 0 }, kw: ['conversibilidade', 'currency board', 'um para um'],
    req: (st) => (st.fxRegime === 'conversibilidade' ? 'Já em vigor' : st.e.reserves < 3 ? 'Reservas insuficientes para lastro (mín. 3 meses)' : true),
    eff: (st) => ({ fxRegime: 'conversibilidade', inflMult: 0.25, monetize: -1, confidence: 15, indexation: -0.2, groups: { classe_media: 12, financeiro: 15, sindicatos: -5 } })
  });
  act('dolarizar', 'monetaria', 'Dolarizar a economia', 'Abandonar a moeda nacional e adotar o dólar (Equador 2000, El Salvador 2001). Fim da inflação descontrolada e do câmbio — e da soberania monetária.', {
    cost: 3, congress: 0.6, minYear: 1990, ideo: { e: 70, s: 10 }, kw: ['dolarizar', 'dolarizacao', 'adotar o dolar'],
    req: (st) => (st.cid === 'US' ? 'Você emite o dólar' : st.fxRegime === 'dolarizado' ? 'Já dolarizado' : st.fxRegime === 'euro' ? 'Membro do euro' : st.e.reserves < 4 ? 'Reservas insuficientes (mín. 4 meses)' : true),
    eff: { fxRegime: 'dolarizado', inflMult: 0.15, monetize: -1, confidence: 10, reserves: -3, indexation: -0.3, legit: -5, groups: { financeiro: 15, classe_media: 8, militares: -6, sindicatos: -10, estudantes: -8 } }
  });
  act('controle_capitais', 'monetaria', 'Impor controle de capitais', 'Restringe saída de dólares e remessas. Segura reservas no curto prazo; afugenta investimento.', {
    cost: 1, ideo: { e: -45, s: 15 }, kw: ['controle de capitais', 'cepo', 'restringir dolar'],
    req: (st) => (st.flags.controleCapitais ? 'Já existe controle' : true),
    eff: { flags: { controleCapitais: true }, unflag: 'capitaisLivres', reserves: 1.5, confidence: -10, investShift: -1.5, groups: { financeiro: -14, classe_media: -6, empresarios: -4 } }
  });
  act('liberar_capitais', 'monetaria', 'Liberalizar a conta de capitais', 'Livre entrada e saída de capitais. Atrai investimento, mas expõe o país a paradas súbitas de financiamento.', {
    cost: 1, ideo: { e: 50, s: 0 }, kw: ['liberar capitais', 'fim do cepo', 'conta de capitais'],
    req: (st) => (st.flags.capitaisLivres ? 'Já liberalizado' : true),
    eff: { flags: { capitaisLivres: true }, unflag: 'controleCapitais', confidence: 7, investShift: 1, groups: { financeiro: 12, classe_media: 4 } }
  });
  act('congelar_precos', 'monetaria', 'Congelar preços (choque heterodoxo)', 'Tabelamento por decreto. A inflação cai na hora, mas sem ajuste fiscal volta com força e aparecem prateleiras vazias (Plano Cruzado 1986, Austral 1985, Nixon 1971).', {
    cost: 2, cooldown: 4, ideo: { e: -50, s: 20 }, kw: ['congelar precos', 'congelamento', 'tabelar precos', 'tabelamento'],
    req: (st) => (st.flags.congelamento ? 'Congelamento já em vigor' : true),
    eff: { flags: { congelamento: true }, inflMult: 0.25, groups: { pobres: 14, trabalhadores: 10, classe_media: 10, empresarios: -12, agro: -8, financeiro: -6 },
      lag: [{ turns: 3, eff: { unflag: 'congelamento', infl: 25, inflExp: 15, groups: { classe_media: -12, pobres: -10, trabalhadores: -8 }, confidence: -6 }, note: 'O congelamento acabou: a inflação reprimida voltou e a credibilidade caiu.' }] }
  });
  act('plano_ortodoxo', 'monetaria', 'Plano de estabilização ortodoxo (juros altos + corte de gastos)', 'Choque de juros e austeridade para derrubar a inflação. Recessão no curto prazo; funciona se houver credibilidade.', {
    cost: 2, cooldown: 6, ideo: { e: 50, s: 10 }, kw: ['plano ortodoxo', 'choque de juros', 'estabilizacao'],
    req: (st) => (st.e.infl < 12 ? 'Inflação não justifica um plano de choque' : true),
    outcomes: (st) => {
      const pr = U.clamp(0.3 + st.e.cred * 0.5 - Math.max(0, st.e.primDef) * 0.06 + (st.e.reserves > 6 ? 0.1 : 0), 0.08, 0.85);
      return [
        { p: pr, key: 'ok', label: 'Inflação cede de forma sustentada', eff: { inflMult: 0.4, budget: { admin: -0.8, infra: -0.6 }, gap: -3, confidence: 12, groups: { financeiro: 12, servidores: -10, sindicatos: -10 } } },
        { p: 1 - pr, key: 'falha', label: 'Recessão sem queda duradoura da inflação', eff: { inflMult: 0.8, budget: { admin: -0.8, infra: -0.6 }, gap: -4, confidence: -5, groups: { trabalhadores: -10, sindicatos: -12, servidores: -10 } } }
      ];
    }
  });
  act('plano_real', 'monetaria', 'Plano de desindexação com unidade de conta (estilo URV/Plano Real)', 'Converte gradualmente preços e salários para uma unidade estável e depois lança nova moeda. Exige ajuste fiscal prévio e reservas.', {
    cost: 3, cooldown: 8, minYear: 1960, ideo: { e: 15, s: 0 }, kw: ['plano real', 'urv', 'nova moeda', 'desindexacao', 'desindexar'],
    req: (st) => (st.e.infl < 40 ? 'Só faz sentido com inflação alta (>40%)' : true),
    outcomes: (st) => {
      const pr = U.clamp(0.25 + (st.e.primDef < 0 ? 0.25 : st.e.primDef < 1.5 ? 0.12 : -0.1) + (st.e.reserves > 6 ? 0.15 : st.e.reserves > 3 ? 0.05 : -0.05) + st.e.cred * 0.25 + (st.e.monetize > 0 ? -0.25 : 0), 0.05, 0.88);
      return [
        { p: pr, key: 'ok', label: 'Sucesso: a hiperinflação acaba', eff: { inflMult: 0.04, indexation: -0.35, confidence: 18, legit: 8, wageIndex: -0.2, groups: { pobres: 20, classe_media: 18, trabalhadores: 15, financeiro: 12 }, fxRegime: 'banda', fx: -10 } },
        { p: 1 - pr, key: 'falha', label: 'Fracasso: a inflação volta em meses', eff: { inflMult: 0.6, confidence: -10, legit: -5, groups: { classe_media: -10, pobres: -8 } } }
      ];
    }
  });
  act('confisco_poupanca', 'monetaria', 'Bloquear depósitos e poupanças (confisco)', 'Congela contas bancárias acima de um limite para enxugar a liquidez (Plano Collor 1990, Corralito 2001). Medida extrema e traumática.', {
    cost: 3, cooldown: 20, ideo: { e: -20, s: 40 }, kw: ['confisco', 'bloquear poupanca', 'corralito', 'congelar contas'],
    eff: { inflMult: 0.2, gap: -7, confidence: -25, legit: -12, protests: 20, groups: { classe_media: -35, empresarios: -20, financeiro: -20, pobres: -6, trabalhadores: -10 }, inflExp: -10,
      lag: [{ turns: 4, eff: { infl: 15 }, note: 'A liquidez bloqueada voltou à economia e a inflação recrudesceu.' }] }
  });
  act('vender_reservas', 'monetaria', 'Vender reservas para segurar o câmbio', 'O BC oferta dólares no mercado. Funciona enquanto houver munição.', {
    cost: 1, ideo: { e: 0, s: 0 }, kw: ['vender reservas', 'vender dolar', 'segurar o cambio'],
    req: (st) => (st.e.reserves < 2 ? 'Reservas esgotadas' : true), eff: { fx: -6, reserves: -2.5, infl: -0.5, groups: { classe_media: 3 } }
  });
  act('comprar_reservas', 'monetaria', 'Acumular reservas internacionais', 'Compras regulares de dólares pelo BC. Seguro contra crises; custa caro (carregamento) e desvaloriza a moeda.', {
    cost: 1, ideo: { e: 5, s: 0 }, kw: ['comprar reservas', 'acumular reservas', 'comprar dolar'],
    eff: { mods: [phase('Compra de reservas', { reserves: 0.35, fx: 0.4, debt: 0.08 }, 6)], groups: { agro: 3, empresarios: 2 } }
  });
  act('acordo_fmi', 'monetaria', 'Pedir socorro ao FMI', 'Empréstimo de emergência condicionado a ajuste fiscal e reformas. Recompõe reservas e confiança; é politicamente custoso.', {
    cost: 2, minYear: 1947, ideo: { e: 40, s: 0 }, kw: ['fmi', 'fundo monetario', 'socorro'],
    req: (st) => (!st.dip.orgs.fmi ? 'Não é membro do FMI' : st.flags.fmi ? 'Já há programa em vigor' : true),
    outcomes: (st) => {
      const pr = U.clamp(0.75 + (st.dip.rel.US || 0) / 300, 0.3, 0.95);
      return [
        { p: pr, key: 'ok', label: 'Acordo assinado', eff: { flags: { fmi: true }, reserves: 5, confidence: 12, unflag: 'default', budget: { admin: -0.6, subsidios: -0.5, infra: -0.4 }, groups: { financeiro: 10, sindicatos: -12, estudantes: -10, servidores: -8, pobres: -5 }, legit: -3,
          lag: [{ turns: 12, eff: { unflag: 'fmi' }, note: 'O programa com o FMI foi encerrado.' }] } },
        { p: 1 - pr, key: 'nao', label: 'FMI exige condições inaceitáveis; negociação travada', eff: { confidence: -5 } }
      ];
    }
  });
  act('romper_fmi', 'monetaria', 'Romper o programa com o FMI', 'Encerra as condicionalidades. Popular entre a esquerda e nacionalistas; os mercados reagem mal.', {
    cost: 1, ideo: { e: -40, s: 20 }, kw: ['romper com o fmi', 'sair do fmi', 'pagar o fmi'],
    req: (st) => (!st.flags.fmi ? 'Não há programa com o FMI' : true), eff: { unflag: 'fmi', confidence: -10, reserves: -2, groups: { sindicatos: 10, estudantes: 8, financeiro: -12 } }
  });
  act('moratoria', 'monetaria', 'Declarar moratória da dívida', 'Suspende pagamentos aos credores. Alívio de caixa imediato; perda de acesso ao crédito por anos (Brasil 1987, Argentina 2001, Rússia 1998).', {
    cost: 2, ideo: { e: -40, s: 20 }, kw: ['moratoria', 'calote', 'default', 'nao pagar a divida'],
    req: (st) => (st.flags.default ? 'Já está em moratória' : true),
    eff: (st) => ({ flags: { default: true }, debt: -st.e.debt * 0.08, confidence: -28, fx: st.fxRegime === 'flutuante' ? 25 : 0, reserves: 1.5, gap: -3, extShare: -0.1,
      rel: { 'bloc:ocidente': -12 }, groups: { financeiro: -30, empresarios: -10, sindicatos: 6, estudantes: 5, classe_media: -8 } })
  });
  act('renegociar_divida', 'monetaria', 'Renegociar a dívida com credores', 'Troca de títulos com alongamento e desconto (Plano Brady 1989, Argentina 2005).', {
    cost: 2, cooldown: 8, ideo: { e: 10, s: 0 }, kw: ['renegociar', 'reestruturar divida', 'reestruturacao'],
    req: (st) => (st.e.debt < 50 && !st.flags.default ? 'Dívida não justifica renegociação' : true),
    outcomes: (st) => {
      const pr = U.clamp(0.4 + (st.dip.rel.US || 0) / 250 + (st.flags.fmi ? 0.2 : 0) + (st.e.primDef < 0 ? 0.15 : 0), 0.1, 0.9);
      return [
        { p: pr, key: 'ok', label: 'Acordo com credores (desconto e prazo maiores)', eff: (s) => ({ debt: -s.e.debt * (s.flags.default ? 0.3 : 0.12), unflag: 'default', confidence: 12, groups: { financeiro: 6, empresarios: 5 } }) },
        { p: 1 - pr, key: 'nao', label: 'Credores rejeitam a proposta', eff: { confidence: -6 } }
      ];
    }
  });
  act('titulos_externos', 'monetaria', 'Emitir títulos no mercado internacional', 'Capta dólares com eurobônus. Reforça reservas, aumenta dívida em moeda forte.', {
    cost: 1, cooldown: 2, ideo: { e: 20, s: 0 }, kw: ['emitir titulos', 'captar no exterior', 'eurobonus'],
    req: (st) => (st.flags.default ? 'Sem acesso a mercado (moratória)' : st.e.riskPrem > 10 ? 'Prêmio de risco proibitivo' : true),
    eff: { reserves: 3, debt: 3, extShare: 0.04, fx: -3 }
  });
  act('cortar_zeros', 'monetaria', 'Cortar zeros e trocar o nome da moeda', 'Medida cosmética. Sem ajuste fiscal e desindexação, não muda nada (Brasil trocou de moeda 5 vezes entre 1967 e 1993).', {
    cost: 1, cooldown: 8, ideo: { e: 0, s: 10 }, kw: ['cortar zeros', 'nova moeda', 'trocar moeda'],
    req: (st) => (st.e.infl < 100 ? 'Só faz sentido com inflação muito alta' : true), eff: { inflExp: -2, confidence: 2, approval: 1, lag: [{ turns: 2, eff: { inflExp: 2 } }] }
  });
  act('indexacao', 'monetaria', 'Indexar salários e contratos à inflação', 'Correção monetária automática: protege a renda contra a inflação, mas perpetua a inflação passada (inércia).', {
    cost: 1, ideo: { e: -20, s: 0 }, kw: ['indexar', 'correcao monetaria', 'gatilho salarial'],
    req: (st) => (st.e.wageIndex > 0.8 ? 'Já indexado' : true), eff: { wageIndex: 0.6, indexation: 0.15, groups: { trabalhadores: 8, sindicatos: 10, servidores: 6, empresarios: -6 } }
  });
  act('desindexar', 'monetaria', 'Desindexar a economia', 'Proíbe reajustes automáticos. Quebra a inércia inflacionária; reduz poder de barganha salarial.', {
    cost: 1, ideo: { e: 30, s: 0 }, kw: ['desindexar', 'fim da indexacao'],
    req: (st) => (st.e.wageIndex < 0.15 && (st.e.indexation || 0) <= -0.2 ? 'Já desindexado' : true), eff: { wageIndex: -0.5, indexation: -0.12, groups: { trabalhadores: -6, sindicatos: -10, financeiro: 6 } }
  });

  // ======================= FISCAL =======================
  act('austeridade', 'fiscal', 'Pacote de austeridade (≈2% do PIB)', 'Corta custeio, investimentos e subsídios. Melhora o fiscal e a confiança; contrai a economia no curto prazo.', {
    cost: 2, congress: 0.35, cooldown: 3, ideo: { e: 50, s: 5 }, kw: ['austeridade', 'cortar gastos', 'corte de gastos', 'ajuste fiscal'],
    eff: { budget: { admin: -0.7, infra: -0.5, social: -0.4, subsidios: -0.4 }, confidence: 9, groups: { servidores: -10, sindicatos: -8, pobres: -6, financeiro: 12, empresarios: 4 } }
  });
  act('estimulo', 'fiscal', 'Pacote de estímulo fiscal (≈2% do PIB)', 'Obras, crédito e transferências para reaquecer a economia. Eficaz em recessão; com dívida alta, o mercado cobra.', {
    cost: 2, congress: 0.25, cooldown: 3, ideo: { e: -35, s: 0 }, kw: ['estimulo', 'pacote', 'gastar mais', 'aquecer a economia'],
    eff: (st) => ({ budget: { infra: 1, social: 0.6, subsidios: 0.4 }, demand: 0.8, confidence: st.e.debt > 80 ? -8 : -2, groups: { trabalhadores: 6, empresarios: 4, pobres: 5, financeiro: -7 },
      lag: [{ turns: 6, eff: { budget: { infra: -1, social: -0.6, subsidios: -0.4 } }, note: 'O pacote de estímulo expirou.' }] })
  });
  act('teto_gastos', 'fiscal', 'Aprovar regra fiscal / teto de gastos', 'Limita o crescimento das despesas. Âncora fiscal valorizada pelo mercado (Brasil 2016, Alemanha 2009).', {
    cost: 2, congress: 0.6, ideo: { e: 45, s: 0 }, kw: ['teto de gastos', 'regra fiscal', 'arcabouco'],
    req: (st) => (st.flags.regraFiscal ? 'Já existe regra fiscal' : true),
    eff: { flags: { regraFiscal: true }, confidence: 10, inflExp: -0.8, groups: { financeiro: 12, servidores: -8, sindicatos: -6, estudantes: -4 } }
  });
  act('revogar_teto', 'fiscal', 'Flexibilizar/revogar a regra fiscal', 'Mais espaço para gastar, menos credibilidade.', {
    cost: 1, congress: 0.4, ideo: { e: -40, s: 0 }, kw: ['revogar teto', 'flexibilizar regra fiscal', 'furar o teto'],
    req: (st) => (!st.flags.regraFiscal ? 'Não há regra fiscal' : true), eff: { unflag: 'regraFiscal', confidence: -9, inflExp: 0.8, groups: { financeiro: -10, servidores: 5 } }
  });
  act('reforma_previdencia', 'fiscal', 'Reforma da previdência (idade mínima, regras mais duras)', 'Reduz gasto previdenciário ao longo dos anos. Impopular, mas essencial com envelhecimento.', {
    cost: 3, congress: 0.7, cooldown: 16, ideo: { e: 45, s: 0 }, kw: ['reforma da previdencia', 'previdencia', 'aposentadoria', 'idade minima'],
    req: (st) => (st.e.budget.previdencia < 3 ? 'Gasto previdenciário ainda baixo' : true),
    eff: (st) => ({ mods: [phase('Reforma da previdência', { budget: { previdencia: -st.e.budget.previdencia * 0.15 / 24 } }, 8)], confidence: 10, groups: { servidores: -14, trabalhadores: -8, sindicatos: -14, financeiro: 12, empresarios: 6, pobres: -3 } })
  });
  act('ampliar_previdencia', 'fiscal', 'Ampliar aposentadorias e pensões', 'Reajustes acima da inflação e regras mais generosas.', {
    cost: 1, congress: 0.3, cooldown: 4, ideo: { e: -35, s: 0 }, kw: ['aumentar aposentadoria', 'ampliar previdencia'],
    eff: { budget: { previdencia: 0.8 }, povShift: -0.5, poverty: -0.8, confidence: -4, groups: { pobres: 6, trabalhadores: 4, servidores: 5, sindicatos: 4, financeiro: -6 } }
  });
  act('reajuste_servidores', 'fiscal', 'Reajuste salarial do funcionalismo', 'Recompõe salários de servidores públicos.', {
    cost: 1, cooldown: 4, ideo: { e: -25, s: 0 }, kw: ['reajuste servidores', 'aumento para servidores', 'funcionalismo'],
    eff: { budget: { admin: 0.5 }, groups: { servidores: 14, financeiro: -4 } }
  });
  act('congelar_servidores', 'fiscal', 'Congelar salários do funcionalismo', 'Sem reajustes nominais: a inflação corrói os salários.', {
    cost: 1, cooldown: 4, ideo: { e: 35, s: 0 }, kw: ['congelar salarios', 'congelar servidores'],
    eff: (st) => ({ budget: { admin: -Math.min(0.8, st.e.budget.admin * (0.02 + Math.min(0.15, st.e.infl / 300))) }, groups: { servidores: -14, financeiro: 5 } })
  });
  act('enxugar_maquina', 'fiscal', 'Enxugar a máquina pública (demissões e fusão de órgãos)', 'Corta ministérios, cargos e quadros.', {
    cost: 2, congress: 0.4, cooldown: 6, ideo: { e: 60, s: 10 }, kw: ['demitir servidores', 'enxugar', 'reduzir ministerios', 'motosserra'],
    eff: { budget: { admin: -1 }, unemp: 0.5, confidence: 7, groups: { servidores: -22, sindicatos: -8, financeiro: 10, empresarios: 5, classe_media: 3 } }
  });
  act('contratar_servidores', 'fiscal', 'Ampliar contratações no serviço público', 'Concursos e novas vagas em saúde, educação e administração.', {
    cost: 1, cooldown: 4, ideo: { e: -30, s: 0 }, kw: ['concurso', 'contratar servidores'],
    eff: { budget: { admin: 0.5, saude: 0.1, educacao: 0.1 }, unemp: -0.3, groups: { servidores: 6, estudantes: 5, classe_media: 2, financeiro: -4 } }
  });
  act('subsidio_combustivel', 'fiscal', 'Subsidiar combustíveis e energia', 'Segura preços na bomba e na conta de luz.', {
    cost: 1, cooldown: 3, ideo: { e: -25, s: 5 }, kw: ['subsidio', 'combustivel', 'gasolina', 'diesel', 'preco da gasolina'],
    eff: { budget: { subsidios: 1 }, infl: -1, groups: { classe_media: 6, trabalhadores: 5, agro: 4, pobres: 3, financeiro: -5 } }
  });
  act('cortar_subsidios', 'fiscal', 'Cortar subsídios de combustível e energia', 'Realinhamento de preços. Bom para o fiscal; pode detonar protestos (Caracazo 1989, Irã 2019, Equador 2019).', {
    cost: 1, cooldown: 3, ideo: { e: 45, s: 0 }, kw: ['cortar subsidios', 'realinhar precos', 'fim do subsidio'],
    req: (st) => (st.e.budget.subsidios < 0.3 ? 'Quase não há subsídios' : true),
    eff: (st) => ({ budget: { subsidios: -Math.min(st.e.budget.subsidios, 1) }, infl: 2, protests: 8 + st.e.poverty * 0.25, confidence: 6, groups: { pobres: -10, trabalhadores: -8, classe_media: -6, agro: -4, financeiro: 8 } })
  });
  act('emendas', 'fiscal', 'Liberar emendas e cargos para a base aliada', 'Compra apoio no Congresso com recursos do orçamento.', {
    cost: 1, cooldown: 2, dem: true, ideo: { e: 0, s: 0 }, kw: ['emendas', 'centrao', 'cargos', 'comprar apoio'],
    eff: { congress: 12, budget: { admin: 0.2 }, corruption: 2.5, groups: { classe_media: -3, estudantes: -2 } }
  });
  act('fundo_soberano', 'fiscal', 'Criar fundo soberano com receitas de commodities', 'Poupa a renda de petróleo/minérios para os tempos ruins (Noruega 1990, Chile 2007).', {
    cost: 1, once: true, minYear: 1950, ideo: { e: 25, s: 0 }, kw: ['fundo soberano'],
    req: (st) => (H.oilExp(st) < 0.3 && H.commodity(st) < 0.5 ? 'País não é grande exportador de commodities' : true),
    eff: { flags: { fundoSoberano: true }, confidence: 6, demand: -0.3, reserves: 2, groups: { financeiro: 6 } }
  });

  // ======================= IMPOSTOS =======================
  const taxAct = (id, name, desc, o) => act(id, 'tributos', name, desc, Object.assign({ cost: 1, cooldown: 2 }, o));
  taxAct('ir_subir', 'Aumentar o imposto de renda (mais progressivo)', 'Alíquotas maiores para as faixas de renda alta.', { congress: 0.45, ideo: { e: -40, s: 0 }, kw: ['aumentar imposto de renda', 'taxar ricos', 'taxar os ricos', 'imposto dos ricos', 'ir progressivo'], eff: { tax: 1, taxes: { renda: 3 }, gini: -0.6, demand: -0.15, groups: { classe_media: -8, financeiro: -8, empresarios: -4, pobres: 3, sindicatos: 4 } } });
  taxAct('ir_reduzir', 'Reduzir o imposto de renda', 'Corte de alíquotas e/ou isenção ampliada.', { congress: 0.3, ideo: { e: 40, s: 0 }, kw: ['reduzir imposto de renda', 'cortar ir', 'isencao'], eff: { tax: -1, taxes: { renda: -3 }, gini: 0.4, demand: 0.2, groups: { classe_media: 9, financeiro: 5, empresarios: 3 } } });
  taxAct('consumo_subir', 'Aumentar impostos sobre consumo (IVA/ICMS)', 'Arrecada rápido e é regressivo: pesa mais para os pobres.', { congress: 0.35, ideo: { e: 10, s: 0 }, kw: ['aumentar iva', 'imposto sobre consumo', 'aumentar icms'], eff: { tax: 1.3, taxes: { consumo: 3 }, infl: 1, gini: 0.4, demand: -0.2, groups: { pobres: -6, classe_media: -6, trabalhadores: -5, financeiro: 3 } } });
  taxAct('consumo_reduzir', 'Reduzir impostos sobre consumo', 'Alivia preços na ponta, custa receita.', { congress: 0.25, ideo: { e: 20, s: 0 }, kw: ['reduzir iva', 'reduzir imposto consumo', 'baixar icms'], eff: { tax: -1.3, taxes: { consumo: -3 }, infl: -0.8, gini: -0.2, demand: 0.2, groups: { pobres: 5, classe_media: 6, trabalhadores: 4, empresarios: 3 } } });
  taxAct('empresas_subir', 'Aumentar imposto sobre lucro das empresas', 'Mais receita; desestimula investimento.', { congress: 0.45, ideo: { e: -45, s: 0 }, kw: ['taxar empresas', 'imposto sobre lucro', 'aumentar imposto empresas'], eff: { tax: 0.8, taxes: { empresas: 4 }, investShift: -1, confidence: -4, groups: { empresarios: -12, financeiro: -6, sindicatos: 4 } } });
  taxAct('empresas_reduzir', 'Reduzir imposto sobre empresas', 'Estimula investimento; custa receita.', { congress: 0.3, ideo: { e: 50, s: 0 }, kw: ['reduzir imposto empresas', 'cortar imposto corporativo'], eff: { tax: -0.8, taxes: { empresas: -4 }, investShift: 1, confidence: 4, gini: 0.3, groups: { empresarios: 12, financeiro: 5, sindicatos: -4 } } });
  taxAct('tarifa_subir', 'Aumentar tarifas de importação (protecionismo)', 'Protege a indústria nacional; encarece produtos e reduz eficiência.', { ideo: { e: -25, s: 30 }, kw: ['tarifa', 'protecionismo', 'taxar importados', 'barreira'], eff: { taxes: { comercio: 10 }, open: -0.04, industry: 3, infl: 0.8, tb: 0.3, rel: { '*': -2 }, groups: { empresarios: 6, sindicatos: 4, classe_media: -5, agro: -2 } } });
  taxAct('tarifa_reduzir', 'Reduzir tarifas de importação (abertura)', 'Mais concorrência e produtos mais baratos; indústria protegida sofre.', { ideo: { e: 45, s: -10 }, kw: ['reduzir tarifa', 'abrir importacao', 'baixar tarifa'], req: (st) => (st.e.taxes.comercio < 4 ? 'Tarifas já são baixas' : true), eff: { taxes: { comercio: -8 }, open: 0.05, industry: -2.5, infl: -0.6, gpot: 0.06, rel: { '*': 2 }, groups: { empresarios: -6, classe_media: 6, sindicatos: -5, agro: 3 } } });
  taxAct('exportacao_subir', 'Criar/aumentar imposto sobre exportações (retenciones)', 'Captura parte da renda do agro exportador e segura preços internos de alimentos (Argentina).', { ideo: { e: -40, s: 0 }, kw: ['retenciones', 'imposto exportacao', 'taxar exportacao'], eff: { taxes: { exportacao: 10 }, infl: -0.5, groups: { agro: -18, pobres: 3, sindicatos: 3 } } });
  taxAct('exportacao_reduzir', 'Reduzir imposto sobre exportações', 'Estimula exportações e o agro.', { ideo: { e: 40, s: 0 }, kw: ['reduzir retenciones', 'zerar imposto exportacao'], req: (st) => (st.e.taxes.exportacao <= 0 ? 'Não há imposto de exportação' : true), eff: (st) => ({ taxes: { exportacao: -Math.min(10, st.e.taxes.exportacao) }, groups: { agro: 14 } }) });
  taxAct('fortunas', 'Imposto sobre grandes fortunas', 'Tributo anual sobre patrimônio muito alto. Arrecada pouco na prática e incentiva fuga de capital (França 1982-2017).', { congress: 0.65, once: true, ideo: { e: -60, s: -10 }, kw: ['grandes fortunas', 'imposto sobre fortuna', 'taxar bilionarios'], eff: { tax: 0.3, taxes: { fortunas: 1 }, gini: -0.4, confidence: -6, reserves: -0.8, groups: { financeiro: -14, empresarios: -10, sindicatos: 8, estudantes: 8, pobres: 4 } } });
  taxAct('transacoes', 'Imposto sobre transações financeiras (tipo CPMF/IOF)', 'Fácil de arrecadar, cumulativo e impopular.', { congress: 0.5, ideo: { e: -15, s: 0 }, kw: ['cpmf', 'iof', 'imposto transacoes'], eff: { tax: 1, taxes: { financeiro: 2 }, groups: { classe_media: -6, financeiro: -8, empresarios: -5 } } });
  taxAct('reforma_tributaria', 'Reforma tributária simplificadora (IVA único)', 'Unifica tributos sobre consumo, acaba com guerra fiscal. Ganho de produtividade a médio prazo.', { cost: 3, congress: 0.7, once: true, minYear: 1950, ideo: { e: 25, s: 0 }, kw: ['reforma tributaria', 'simplificar impostos', 'iva unico'], eff: { confidence: 8, lag: [{ turns: 8, eff: { gpot: 0.25 }, note: 'A reforma tributária começou a elevar a produtividade.' }], groups: { empresarios: 10, financeiro: 6, classe_media: 2 } } });
  taxAct('sonegacao', 'Combate à sonegação e paraísos fiscais', 'Fiscalização, cruzamento de dados, fim de brechas.', { cost: 1, cooldown: 4, ideo: { e: -15, s: 0 }, kw: ['sonegacao', 'fiscalizacao', 'evasao'], eff: { tax: 0.5, corruption: -1.5, groups: { empresarios: -5, classe_media: 2, pobres: 2 } } });
  taxAct('refis', 'Anistia/parcelamento de dívidas tributárias (Refis)', 'Receita rápida, mas premia o mau pagador e reduz arrecadação futura.', { cooldown: 6, ideo: { e: 20, s: 0 }, kw: ['refis', 'anistia fiscal', 'perdao de dividas'], eff: { debt: -0.6, tax: -0.2, confidence: -1, groups: { empresarios: 8, agro: 5 } } });

  // ======================= INDÚSTRIA E EMPRESAS (+ setores) =======================
  const SECT = S.GAME.SECTORS;
  for (const s in SECT) {
    const sec = SECT[s];
    act('privatizar_' + s, 'industria', 'Privatizar: ' + sec.name, 'Venda do controle estatal no setor de ' + sec.name.toLowerCase() + '. Gera receita, melhora eficiência no médio prazo; impopular entre sindicatos e eleitorado de esquerda.', {
      cost: 2, congress: 0.45, ideo: { e: 60, s: 0 }, kw: ['privatizar ' + s, 'privatizar ' + sec.name.toLowerCase(), 'vender ' + s, 'privatizacao ' + s],
      req: (st) => (st.sectors[s] !== 'estatal' ? 'Setor já é privado' : true),
      eff: (st) => ({ sector: { [s]: 'privado' }, soe: -sec.soe, debt: -sec.rev * (st.e.confidence / 60), confidence: 5, lag: [{ turns: 8, eff: { gpot: 0.05 } }],
        groups: { sindicatos: -10, servidores: -6, trabalhadores: -4, financeiro: 8, empresarios: 6 }, legit: s === 'petroleo' && ['BR', 'MX', 'VE', 'IR'].includes(st.cid) ? -4 : 0 })
    });
    act('estatizar_' + s, 'industria', 'Estatizar: ' + sec.name, 'Nacionalização do setor de ' + sec.name.toLowerCase() + '. Controle estratégico e de preços; custo de indenização e queda de confiança.', {
      cost: 2, congress: 0.45, ideo: { e: -60, s: 15 }, kw: ['estatizar ' + s, 'nacionalizar ' + s, 'estatizar ' + sec.name.toLowerCase(), 'nacionalizar ' + sec.name.toLowerCase()],
      req: (st) => (st.sectors[s] === 'estatal' ? 'Setor já é estatal' : true),
      eff: (st) => ({ sector: { [s]: 'estatal' }, soe: sec.soe, debt: sec.rev * 0.6, confidence: -7, investShift: -0.4, rel: { 'bloc:ocidente': -3 },
        groups: { sindicatos: 8, servidores: 4, trabalhadores: 3, financeiro: -10, empresarios: -8, militares: s === 'petroleo' ? 4 : 0 }, legit: 2 })
    });
  }
  act('politica_industrial', 'industria', 'Política industrial com crédito do banco de desenvolvimento', 'Crédito subsidiado e escolha de setores "campeões" (BNDES, MITI japonês, Coreia dos anos 70).', {
    cost: 2, cooldown: 8, ideo: { e: -30, s: 10 }, kw: ['politica industrial', 'bndes', 'campeoes nacionais', 'credito subsidiado'],
    eff: (st) => ({ budget: { subsidios: 0.6 }, industry: 6, investShift: 1.5, corruption: 1.5, lag: [{ turns: 12, eff: { budget: { subsidios: -0.6 }, gpot: st.soc.corruption < 45 ? 0.2 : 0.02 }, note: 'O ciclo de política industrial terminou.' }], groups: { empresarios: 10, sindicatos: 4, financeiro: -5 } })
  });
  act('substituicao_importacoes', 'industria', 'Industrialização por substituição de importações', 'Tarifas altas, câmbio múltiplo e estatais de base para produzir internamente o que se importa (modelo latino-americano 1930-1980).', {
    cost: 3, once: true, maxYear: 1995, ideo: { e: -40, s: 20 }, kw: ['substituicao de importacoes', 'industrializacao', 'isi', 'desenvolvimentismo'],
    eff: { taxes: { comercio: 15 }, open: -0.06, industry: 10, investShift: 2, soe: 5, gpot: 0.4, lag: [{ turns: 40, eff: { gpot: -0.5 }, note: 'O modelo fechado começou a mostrar baixa produtividade e ineficiência.' }],
      groups: { empresarios: 10, sindicatos: 6, militares: 5, agro: -8, classe_media: 2 } }
  });
  act('zonas_exportacao', 'industria', 'Criar zonas econômicas especiais para exportação', 'Áreas com impostos baixos e regras flexíveis para atrair multinacionais (Shenzhen 1980, maquiladoras).', {
    cost: 2, once: true, minYear: 1960, ideo: { e: 35, s: 0 }, kw: ['zona economica especial', 'zona franca', 'maquiladora'],
    eff: { open: 0.08, industry: 5, investShift: 2, tbShift: 0.6, lag: [{ turns: 8, eff: { gpot: 0.25 } }], groups: { empresarios: 8, trabalhadores: 4, sindicatos: -4 } }
  });
  act('abertura_comercial', 'industria', 'Abertura comercial ampla', 'Redução geral de tarifas e barreiras (Chile 1975, México 1986, Brasil 1990, Índia 1991).', {
    cost: 2, once: true, ideo: { e: 55, s: -5 }, kw: ['abertura comercial', 'abrir a economia', 'livre comercio'],
    eff: (st) => ({ taxes: { comercio: -Math.min(st.e.taxes.comercio - 5, 20) }, open: 0.15, industry: -7, infl: -1.5, unemp: 1, gpot: 0.15, lag: [{ turns: 8, eff: { gpot: 0.25 }, note: 'Os ganhos de produtividade da abertura começaram a aparecer.' }], rel: { '*': 4 },
      groups: { empresarios: -8, classe_media: 7, sindicatos: -8, trabalhadores: -4, financeiro: 8, agro: 5 } })
  });
  act('incentivo_pd', 'industria', 'Incentivos a pesquisa, desenvolvimento e inovação', 'Crédito tributário para P&D, fundos de inovação e parcerias universidade-empresa.', {
    cost: 1, cooldown: 8, minYear: 1945, ideo: { e: 10, s: -10 }, kw: ['inovacao', 'pesquisa', 'p&d', 'ciencia', 'tecnologia'],
    eff: { budget: { educacao: 0.2 }, tax: -0.1, lag: [{ turns: 10, eff: { gpot: 0.15 }, note: 'Investimentos em inovação elevaram a produtividade.' }], groups: { estudantes: 5, empresarios: 5, classe_media: 2 } }
  });
  act('conteudo_local', 'industria', 'Exigir conteúdo local nas compras e concessões', 'Força fornecedores nacionais em petróleo, defesa e infraestrutura.', {
    cost: 1, once: true, ideo: { e: -30, s: 15 }, kw: ['conteudo local', 'comprar nacional', 'compre nacional'],
    eff: { industry: 3, open: -0.02, gpot: -0.05, corruption: 1, groups: { empresarios: 5, sindicatos: 5, militares: 2, financeiro: -3 } }
  });
  act('nacionalizar_estrangeiras', 'industria', 'Nacionalizar empresas estrangeiras', 'Expropriação de multinacionais (México 1938, Irã 1951, Chile 1971, Venezuela 2007). Popular entre nacionalistas; gera retaliação.', {
    cost: 3, cooldown: 12, ideo: { e: -60, s: 30 }, kw: ['nacionalizar multinacionais', 'expropriar', 'expropriacao', 'nacionalizacao'],
    outcomes: (st) => [
      { p: 0.55, key: 'pressao', label: 'Retaliação diplomática e queda de investimento', eff: { soe: 6, confidence: -18, investShift: -3, rel: { 'bloc:ocidente': -20 }, legit: 6, groups: { sindicatos: 12, militares: 4, estudantes: 6, financeiro: -18, empresarios: -10 } } },
      { p: H.t(st) >= 1945 ? 0.3 : 0.2, key: 'sancoes', label: 'Potências impõem sanções econômicas', eff: { soe: 6, confidence: -22, rel: { 'bloc:ocidente': -30 }, sanctions: { by: 'ocidente', on: true }, legit: 8, groups: { sindicatos: 10, financeiro: -20, empresarios: -12 } } },
      { p: H.coldWar(st) ? 0.15 : 0.05, key: 'golpe', label: 'Serviços de inteligência estrangeiros passam a apoiar a oposição', eff: { soe: 6, confidence: -15, military: -18, rel: { US: -30 }, groups: { militares: -12, financeiro: -18 } } }
    ]
  });
  act('atrair_ide', 'industria', 'Incentivos e segurança jurídica para investimento estrangeiro', 'Acordos de proteção de investimentos, regras estáveis, isenções.', {
    cost: 1, cooldown: 6, ideo: { e: 40, s: 0 }, kw: ['investimento estrangeiro', 'atrair investimento', 'multinacionais'],
    eff: { confidence: 6, investShift: 1.5, reserves: 0.5, groups: { empresarios: 5, financeiro: 6, militares: -2, sindicatos: -3 } }
  });
  act('desregulamentar', 'industria', 'Desregulamentação e desburocratização', 'Simplifica abertura de empresas, licenças, normas setoriais.', {
    cost: 1, cooldown: 8, ideo: { e: 50, s: 0 }, kw: ['desregulamentar', 'desburocratizar', 'burocracia', 'liberdade economica'],
    eff: { confidence: 5, corruption: -1.5, lag: [{ turns: 6, eff: { gpot: 0.15 } }], groups: { empresarios: 8, servidores: -4, classe_media: 2 } }
  });
  act('antitruste', 'industria', 'Fortalecer defesa da concorrência (antitruste)', 'Combate a cartéis e monopólios.', {
    cost: 1, once: true, ideo: { e: -5, s: -5 }, kw: ['antitruste', 'cartel', 'monopolio', 'concorrencia'],
    eff: { infl: -0.3, lag: [{ turns: 6, eff: { gpot: 0.08 } }], groups: { empresarios: -5, classe_media: 4 } }
  });
  act('credito_bancos_publicos', 'industria', 'Expandir crédito via bancos públicos', 'Bancos estatais baixam juros e aumentam empréstimos para famílias e empresas.', {
    cost: 1, cooldown: 4, ideo: { e: -30, s: 0 }, kw: ['credito', 'bancos publicos', 'emprestimo barato'],
    req: (st) => (st.sectors.bancos !== 'estatal' ? 'Não há grandes bancos estatais' : true),
    eff: { demand: 0.6, infl: 0.6, debt: 0.8, lag: [{ turns: 8, eff: { confidence: -3, debt: 0.5 } }], groups: { classe_media: 6, empresarios: 5, financeiro: -6 } }
  });
  act('semicondutores', 'industria', 'Programa nacional de semicondutores e alta tecnologia', 'Subsídios para fábricas de chips, TI e eletrônica (Coreia, Taiwan, EUA CHIPS Act).', {
    cost: 2, once: true, minYear: 1975, ideo: { e: -10, s: 10 }, kw: ['semicondutores', 'chips', 'alta tecnologia'],
    eff: (st) => Object.assign(project('subsidios', 0.4, 16, { gpot: st.soc.education > 55 ? 0.3 : 0.08, industry: 4 }, 'O programa de alta tecnologia amadureceu.'), { groups: { empresarios: 6, estudantes: 5 } })
  });

  // ======================= AGRO E TERRA =======================
  act('reforma_agraria', 'agro', 'Reforma agrária (desapropriar latifúndios improdutivos)', 'Redistribui terras. Reduz desigualdade no longo prazo; enfrenta resistência feroz das elites rurais e, historicamente, dos militares (Brasil 1964, Chile 1973, Guatemala 1954).', {
    cost: 3, congress: 0.65, cooldown: 12, ideo: { e: -60, s: -10 }, kw: ['reforma agraria', 'desapropriar', 'latifundio', 'terra'],
    eff: (st) => ({ gini: -2, poverty: -2, gap: -0.8, confidence: -6, military: H.coldWar(st) ? -12 : -5, protests: 6,
      groups: { pobres: 14, sindicatos: 8, estudantes: 8, agro: -25, militares: H.coldWar(st) ? -12 : -5, religiosos: -2, financeiro: -6 } })
  });
  act('credito_rural', 'agro', 'Crédito rural subsidiado (Plano Safra)', 'Financiamento barato para custeio e investimento agropecuário.', {
    cost: 1, cooldown: 4, ideo: { e: 10, s: 20 }, kw: ['credito rural', 'plano safra', 'financiamento agricola'],
    eff: { budget: { subsidios: 0.3 }, tbShift: 0.3, groups: { agro: 10, pobres: 2 } }
  });
  act('pesquisa_agro', 'agro', 'Criar empresa pública de pesquisa agropecuária', 'Pesquisa em sementes, solos e técnicas (Embrapa 1973, Revolução Verde na Índia).', {
    cost: 2, once: true, minYear: 1945, ideo: { e: -10, s: 0 }, kw: ['embrapa', 'pesquisa agropecuaria', 'revolucao verde'],
    eff: { budget: { educacao: 0.1 }, lag: [{ turns: 16, eff: { gpot: 0.2, tbShift: 1, poverty: -1.5 }, note: 'A pesquisa agropecuária multiplicou a produtividade no campo.' }], groups: { agro: 8, estudantes: 3 } }
  });
  act('fronteira_agricola', 'agro', 'Expandir a fronteira agrícola sobre novas áreas', 'Abre cerrado/floresta para agricultura e pecuária. Cresce a produção; o meio ambiente paga a conta.', {
    cost: 1, cooldown: 6, ideo: { e: 30, s: 30 }, kw: ['fronteira agricola', 'abrir areas', 'expandir agro', 'abrir o cerrado'],
    eff: (st) => ({ tbShift: 0.5, gap: 0.3, environment: -9, rel: H.t(st) > 1990 ? { 'bloc:ocidente': -5 } : {}, groups: { agro: 10, estudantes: H.t(st) > 1985 ? -6 : 0 } })
  });
  act('precos_minimos', 'agro', 'Política de preços mínimos e estoques reguladores', 'Governo garante preço mínimo e compra excedentes.', {
    cost: 1, once: true, ideo: { e: -20, s: 10 }, kw: ['preco minimo', 'estoques reguladores'],
    eff: { budget: { subsidios: 0.2 }, groups: { agro: 7, pobres: 3 } }
  });
  act('coletivizacao', 'agro', 'Coletivização forçada da agricultura', 'Terras confiscadas e agrupadas em fazendas coletivas/estatais. Historicamente causou fomes catastróficas (URSS 1932-33, China 1959-61).', {
    cost: 3, once: true, auth: true, ideo: { e: -95, s: 50 }, kw: ['coletivizacao', 'coletivizar', 'fazendas coletivas', 'kolkhoz'],
    req: (st) => (!['comunista'].includes(st.leader.ideoId) ? 'Só um governo comunista tentaria isso' : true),
    outcomes: (st) => [
      { p: 0.6, key: 'fome', label: 'Colapso da produção e fome em massa', eff: (s) => ({ soe: 15, gap: -10, deaths: s.e.pop * 25, shortage: 40, poverty: 15, legit: -10, groups: { agro: -40, pobres: -30, trabalhadores: -10 } }) },
      { p: 0.4, key: 'queda', label: 'Queda forte da produção, sem fome generalizada', eff: { soe: 15, gap: -5, shortage: 20, groups: { agro: -40, pobres: -12 } } }
    ]
  });
  act('restringir_export_alimentos', 'agro', 'Restringir exportações de alimentos', 'Cotas e proibições para segurar preços internos (Argentina com a carne, Índia com o arroz).', {
    cost: 1, cooldown: 4, ideo: { e: -40, s: 10 }, kw: ['proibir exportacao', 'restringir exportacao', 'cota de exportacao'],
    eff: { infl: -1, tbShift: -0.6, groups: { agro: -14, pobres: 4, trabalhadores: 3 }, rel: { '*': -2 } }
  });

  // ======================= INFRAESTRUTURA E ENERGIA =======================
  act('ferrovias', 'infra', 'Programa nacional de ferrovias', 'Novas linhas de carga e passageiros. Obra longa; reduz custo logístico.', { cost: 2, cooldown: 12, ideo: { e: -15, s: 0 }, kw: ['ferrovia', 'trem', 'ferrovias'], eff: Object.assign(project('infra', 0.8, 16, { infra: 5, gpot: 0.15 }, 'As novas ferrovias entraram em operação.'), { groups: { empresarios: 5, agro: 6, trabalhadores: 4 } }) });
  act('rodovias', 'infra', 'Plano rodoviário nacional', 'Pavimentação e duplicação de estradas.', { cost: 2, cooldown: 8, ideo: { e: -10, s: 0 }, kw: ['rodovia', 'estrada', 'asfalto', 'rodovias'], eff: Object.assign(project('infra', 0.7, 10, { infra: 4, gpot: 0.1 }, 'O plano rodoviário foi concluído.'), { groups: { empresarios: 5, agro: 5, trabalhadores: 4, classe_media: 3 } }) });
  act('hidreletricas', 'infra', 'Grandes hidrelétricas', 'Usinas como Itaipu, Três Gargantas, Hoover. Energia barata e limpa; impacto social e ambiental local.', { cost: 2, cooldown: 16, ideo: { e: -15, s: 10 }, kw: ['hidreletrica', 'usina', 'barragem', 'energia'], eff: Object.assign(project('infra', 1.0, 20, { infra: 6, gpot: 0.2, environment: -2 }, 'As novas hidrelétricas começaram a gerar energia.'), { environment: -3, groups: { empresarios: 6, trabalhadores: 4, militares: 3 } }) });
  act('nuclear_civil', 'infra', 'Programa de usinas nucleares', 'Energia firme de baixa emissão; caro, demorado e com risco de acidentes.', { cost: 2, once: true, minYear: 1955, ideo: { e: -5, s: 15 }, kw: ['usina nuclear', 'energia nuclear', 'angra'],
    eff: Object.assign(project('infra', 0.7, 28, { infra: 4, gpot: 0.1, flags: { nuclearCivil: true } }, 'As usinas nucleares entraram em operação.'), { groups: { militares: 5, empresarios: 3, estudantes: -4 } }) });
  act('renovaveis', 'infra', 'Leilões de energia solar e eólica', 'Expansão de renováveis via contratos de longo prazo.', { cost: 1, cooldown: 8, minYear: 2005, ideo: { e: 0, s: -20 }, kw: ['solar', 'eolica', 'renovavel', 'energia limpa'], eff: { budget: { subsidios: 0.15 }, environment: 4, lag: [{ turns: 8, eff: { infra: 2, gpot: 0.05, environment: 3 } }], rel: { 'bloc:ocidente': 3 }, groups: { estudantes: 6, empresarios: 3 } } });
  act('saneamento', 'infra', 'Universalizar água e saneamento', 'Rede de água e esgoto. Enorme ganho de saúde pública.', { cost: 2, cooldown: 12, ideo: { e: -20, s: -5 }, kw: ['saneamento', 'esgoto', 'agua'], eff: Object.assign(project('infra', 0.5, 16, { health: 7, infra: 2, poverty: -1 }, 'As obras de saneamento reduziram doenças e mortalidade infantil.'), { groups: { pobres: 8, classe_media: 3 } }) });
  act('habitacao', 'infra', 'Programa de habitação popular', 'Construção subsidiada de moradias (BNH, Minha Casa Minha Vida). Gera empregos na construção.', { cost: 2, cooldown: 8, ideo: { e: -30, s: 0 }, kw: ['habitacao', 'moradia', 'casa propria', 'minha casa'], eff: Object.assign(project('social', 0.6, 10, { poverty: -1.5 }, 'O programa habitacional entregou as moradias.'), { unemp: -0.4, groups: { pobres: 10, trabalhadores: 6, empresarios: 3 } }) });
  act('portos', 'infra', 'Modernizar portos e aeroportos', 'Dragagem, terminais e concessões.', { cost: 1, cooldown: 8, ideo: { e: 10, s: 0 }, kw: ['porto', 'portos', 'aeroporto'], eff: Object.assign(project('infra', 0.4, 8, { infra: 2, open: 0.03, gpot: 0.06 }), { groups: { empresarios: 5, agro: 5 } }) });
  act('banda_larga', 'infra', 'Banda larga e inclusão digital', 'Internet rápida para escolas, cidades pequenas e zona rural.', { cost: 1, cooldown: 12, minYear: 1997, ideo: { e: -10, s: -10 }, kw: ['internet', 'banda larga', 'inclusao digital', 'fibra'], eff: Object.assign(project('infra', 0.3, 8, { infra: 2, education: 2, gpot: 0.08 }), { groups: { estudantes: 6, classe_media: 3, pobres: 2 } }) });
  act('rede_5g', 'infra', 'Leilão e implantação do 5G', 'Frequências para redes 5G.', { cost: 1, once: true, minYear: 2019, ideo: { e: 30, s: 0 }, kw: ['5g'], eff: (st) => ({ debt: -0.3, lag: [{ turns: 6, eff: { gpot: 0.05, infra: 1 } }], rel: st.dip.rel.CN > 20 ? { US: -5 } : {}, groups: { empresarios: 4, estudantes: 3 } }) });
  act('metro', 'infra', 'Metrô e transporte público nas grandes cidades', 'Linhas de metrô, BRT e trens urbanos.', { cost: 2, cooldown: 12, ideo: { e: -25, s: -10 }, kw: ['metro', 'transporte publico', 'onibus', 'mobilidade'], eff: Object.assign(project('infra', 0.5, 14, { infra: 3, environment: 2 }, 'Novas linhas de transporte público foram inauguradas.'), { groups: { trabalhadores: 6, classe_media: 5, estudantes: 5 } }) });
  act('eletrificacao_rural', 'infra', 'Eletrificação rural', 'Leva energia elétrica ao campo (Luz para Todos, REA americana de 1936).', { cost: 1, once: true, maxYear: 2015, ideo: { e: -30, s: 0 }, kw: ['eletrificacao', 'luz para todos', 'energia rural'], eff: Object.assign(project('infra', 0.4, 12, { poverty: -1.5, infra: 2 }), { groups: { pobres: 8, agro: 6 } }) });
  act('nova_capital', 'infra', 'Construir uma nova capital no interior', 'Megaprojeto para interiorizar o desenvolvimento (Brasília 1960, Abuja 1991, Nusantara 2024). Caro e inflacionário.', { cost: 3, once: true, ideo: { e: -20, s: 30 }, kw: ['nova capital', 'brasilia', 'mudar a capital'],
    eff: { budget: { infra: 2 }, demand: 0.6, infl: 2, legit: 4, lag: [{ turns: 16, eff: { budget: { infra: -2 }, infra: 2 }, note: 'A nova capital foi inaugurada.' }], groups: { empresarios: 6, trabalhadores: 5, militares: 4, financeiro: -8, classe_media: -2 } } });
  act('concessoes', 'infra', 'Concessões e PPPs de infraestrutura', 'Setor privado constrói e opera em troca de tarifas.', { cost: 1, cooldown: 6, minYear: 1985, ideo: { e: 45, s: 0 }, kw: ['concessao', 'ppp', 'parceria publico privada', 'concessoes'], eff: { confidence: 4, investShift: 1, lag: [{ turns: 8, eff: { infra: 3, gpot: 0.08 } }], groups: { empresarios: 8, financeiro: 5, sindicatos: -4 } } });
  act('irrigacao', 'infra', 'Grandes obras de irrigação e transposição de rios', 'Reduz vulnerabilidade a secas.', { cost: 2, once: true, ideo: { e: -20, s: 10 }, kw: ['irrigacao', 'transposicao', 'seca', 'acude'], eff: Object.assign(project('infra', 0.5, 16, { flags: { irrigacao: true }, poverty: -1 }, 'As obras contra a seca foram concluídas.'), { groups: { agro: 6, pobres: 5 } }) });
  act('biocombustiveis', 'infra', 'Programa de biocombustíveis (etanol/biodiesel)', 'Substitui petróleo importado por combustível agrícola (Proálcool 1975).', { cost: 2, once: true, minYear: 1973, ideo: { e: -15, s: 10 }, kw: ['etanol', 'alcool', 'biocombustivel', 'proalcool', 'biodiesel'],
    eff: { budget: { subsidios: 0.4 }, lag: [{ turns: 12, eff: { tbShift: 0.4, budget: { subsidios: -0.3 } }, note: 'Os biocombustíveis reduziram a dependência do petróleo importado.' }], groups: { agro: 10, empresarios: 4 } } });
  act('explorar_petroleo', 'infra', 'Programa de exploração de petróleo e gás', 'Pesquisa sísmica e perfuração (inclusive offshore). Descobertas dependem da geologia do país.', { cost: 2, cooldown: 12, minYear: 1920, ideo: { e: -5, s: 10 }, kw: ['explorar petroleo', 'perfurar', 'pre-sal', 'offshore', 'petroleo'],
    outcomes: (st) => {
      const geo = { BR: H.t(st) > 2005 ? 0.7 : H.t(st) > 1974 ? 0.45 : 0.15, MX: 0.5, VE: 0.6, NG: 0.5, RU: 0.6, IR: 0.55, US: 0.4, CA: 0.45, UK: H.t(st) > 1965 ? 0.5 : 0.05, CO: 0.35, AR: H.t(st) > 2010 ? 0.45 : 0.25, ID: 0.3, CN: 0.25, EG: 0.3, AU: 0.3 }[st.cid] || 0.1;
      return [
        { p: geo, key: 'achou', label: 'Grande descoberta de petróleo!', eff: { budget: { infra: 0.3 }, confidence: 8, lag: [{ turns: 12, eff: { budget: { infra: -0.3 }, tbShift: 2, gpot: 0.2, reserves: 2 }, note: 'A produção dos novos campos de petróleo começou.' }], groups: { militares: 5, empresarios: 6, sindicatos: 3 } } },
        { p: 1 - geo, key: 'seco', label: 'Poços secos / reservas pequenas', eff: { debt: 0.4 } }
      ];
    } });

  // ======================= SOCIAL E DIREITOS =======================
  act('transferencia_renda', 'social', 'Programa de transferência de renda condicionada', 'Pagamento mensal às famílias pobres com contrapartidas de escola e saúde (Bolsa Família, Progresa).', {
    cost: 2, once: true, minYear: 1990, ideo: { e: -35, s: -5 }, kw: ['bolsa familia', 'transferencia de renda', 'renda basica', 'auxilio'],
    eff: { budget: { social: 0.5 }, poverty: -2, gini: -0.8, lag: [{ turns: 8, eff: { education: 2, health: 2 } }], groups: { pobres: 16, classe_media: -3, financeiro: -3, religiosos: 2 } }
  });
  act('assistencia_social', 'social', 'Criar/ampliar rede de assistência social', 'Benefícios para idosos pobres, pessoas com deficiência e famílias vulneráveis.', {
    cost: 1, cooldown: 8, ideo: { e: -30, s: 0 }, kw: ['assistencia social', 'beneficio', 'ajuda aos pobres'],
    eff: { budget: { social: 0.4 }, poverty: -1.2, gini: -0.4, groups: { pobres: 9, financeiro: -2 } }
  });
  act('auxilio_emergencial', 'social', 'Auxílio emergencial temporário', 'Transferência ampla por alguns meses durante crise.', {
    cost: 1, cooldown: 4, ideo: { e: -30, s: 0 }, kw: ['auxilio emergencial', 'ajuda emergencial', 'coronavoucher'],
    eff: { budget: { social: 2 }, poverty: -4, demand: 0.6, lag: [{ turns: 3, eff: { budget: { social: -2 }, poverty: 2 }, note: 'O auxílio emergencial acabou.' }], groups: { pobres: 18, trabalhadores: 8, classe_media: 3, financeiro: -6 } }
  });
  act('salario_minimo_up', 'social', 'Aumento real do salário mínimo (+10%)', 'Ganho acima da inflação para o piso salarial.', {
    cost: 1, cooldown: 4, ideo: { e: -35, s: 0 }, kw: ['salario minimo', 'aumentar salario', 'aumento do minimo'],
    eff: (st) => ({ minWage: 10, infl: 0.6, unemp: st.e.unemp < 6 ? 0.5 : 0.2, budget: { previdencia: st.e.budget.previdencia * 0.03 }, groups: { trabalhadores: 8, sindicatos: 8, pobres: 6, empresarios: -8, financeiro: -4 } })
  });
  act('salario_minimo_congelar', 'social', 'Congelar o salário mínimo (só repor inflação parcial)', 'Contenção de custos para empresas e previdência.', {
    cost: 1, cooldown: 4, ideo: { e: 35, s: 0 }, kw: ['congelar salario minimo', 'nao aumentar salario'],
    eff: { minWage: -5, groups: { trabalhadores: -8, sindicatos: -10, pobres: -5, empresarios: 6 } }
  });
  act('saude_universal', 'social', 'Criar sistema universal e gratuito de saúde', 'Saúde como direito de todos (NHS 1948, SUS 1988).', {
    cost: 3, once: true, congress: 0.5, minYear: 1945, ideo: { e: -45, s: -15 }, kw: ['saude universal', 'sus', 'saude publica', 'nhs'],
    eff: { mods: [phase('Implantação da saúde universal', { budget: { saude: 1.8 / 36 } }, 12)], health: 3, legit: 4, groups: { pobres: 14, trabalhadores: 8, classe_media: 5, estudantes: 6, empresarios: -4, financeiro: -4 } }
  });
  act('saude_investir', 'social', 'Ampliar investimento em saúde (+0,5% do PIB)', 'Hospitais, médicos, remédios.', { cost: 1, cooldown: 4, ideo: { e: -25, s: 0 }, kw: ['saude', 'hospital', 'medicos', 'investir em saude'], eff: { budget: { saude: 0.5 }, groups: { pobres: 5, classe_media: 3, servidores: 2 } } });
  act('vacinacao', 'social', 'Campanha nacional de vacinação em massa', 'Varíola, pólio, sarampo... Barato e eficaz.', { cost: 1, cooldown: 8, ideo: { e: -10, s: -5 }, kw: ['vacina', 'vacinacao', 'imunizacao'], eff: { budget: { saude: 0.05 }, health: 3, flags: { vacinacao: true }, groups: { pobres: 4, classe_media: 3, religiosos: -1 } } });
  act('educacao_basica', 'social', 'Universalizar educação básica de qualidade', 'Mais escolas, professores e merenda. Retorno lento e enorme.', { cost: 2, cooldown: 12, ideo: { e: -25, s: -10 }, kw: ['educacao', 'escola', 'escolas', 'professores', 'ensino'],
    eff: { budget: { educacao: 0.8 }, lag: [{ turns: 20, eff: { gpot: 0.3, poverty: -1.5 }, note: 'Uma geração mais escolarizada chegou ao mercado de trabalho.' }], groups: { pobres: 6, estudantes: 8, classe_media: 4, servidores: 4 } } });
  act('universidades', 'social', 'Expandir universidades públicas', 'Novos campi, vagas e bolsas.', { cost: 1, cooldown: 8, ideo: { e: -30, s: -20 }, kw: ['universidade', 'faculdade', 'ensino superior'], eff: { budget: { educacao: 0.3 }, lag: [{ turns: 16, eff: { gpot: 0.1 } }], groups: { estudantes: 12, classe_media: 4 } } });
  act('ensino_tecnico', 'social', 'Programa nacional de ensino técnico', 'Escolas técnicas e qualificação profissional.', { cost: 1, cooldown: 8, ideo: { e: 0, s: 0 }, kw: ['ensino tecnico', 'qualificacao', 'escola tecnica'], eff: { budget: { educacao: 0.25 }, lag: [{ turns: 10, eff: { gpot: 0.12, uStar: -0.3 } }], groups: { trabalhadores: 6, estudantes: 5, empresarios: 5 } } });
  act('combate_fome', 'social', 'Programa de combate à fome', 'Restaurantes populares, cestas básicas, merenda.', { cost: 1, cooldown: 8, ideo: { e: -30, s: 0 }, kw: ['fome', 'combate a fome', 'cesta basica', 'comida'], eff: { budget: { social: 0.3 }, poverty: -1.5, health: 1, groups: { pobres: 10, religiosos: 4 } } });
  act('previdencia_rural', 'social', 'Previdência rural universal', 'Aposentadoria para trabalhadores rurais sem contribuição plena.', { cost: 2, once: true, ideo: { e: -40, s: 0 }, kw: ['previdencia rural', 'aposentadoria rural'], eff: { budget: { previdencia: 0.6 }, poverty: -2.5, gini: -0.6, groups: { pobres: 12, agro: 4, financeiro: -4 } } });
  act('voto_feminino', 'social', 'Instituir o voto feminino', 'Sufrágio universal para mulheres.', { cost: 1, once: true, ideo: { e: 0, s: -40 }, kw: ['voto feminino', 'sufragio', 'mulheres votarem'], req: (st) => (st.flags.votoFeminino ? 'Mulheres já votam' : true), eff: { flags: { votoFeminino: true }, legit: 8, rel: { 'bloc:ocidente': 3 }, groups: { estudantes: 8, classe_media: 4, religiosos: -4 } } });
  act('casamento_igualitario', 'social', 'Legalizar o casamento entre pessoas do mesmo sexo', 'Igualdade civil para casais homoafetivos.', { cost: 1, once: true, congress: 0.5, minYear: 1995, ideo: { e: 0, s: -60 }, kw: ['casamento gay', 'casamento igualitario', 'lgbt'], eff: { rel: { 'bloc:ocidente': 3 }, groups: { estudantes: 12, religiosos: -16, classe_media: 1 } } });
  act('aborto_legal', 'social', 'Legalizar o aborto', 'Interrupção voluntária da gravidez até 12-14 semanas.', { cost: 2, once: true, congress: 0.65, minYear: 1965, ideo: { e: 0, s: -65 }, kw: ['aborto', 'legalizar aborto'], eff: { health: 1, groups: { estudantes: 12, religiosos: -26, classe_media: -1 }, polarization: 10 } });
  act('cannabis', 'social', 'Legalizar e regular a cannabis', 'Mercado regulado e tributado (Uruguai 2013, Canadá 2018).', { cost: 1, once: true, congress: 0.55, minYear: 2010, ideo: { e: 10, s: -55 }, kw: ['maconha', 'cannabis', 'legalizar drogas'], eff: { tax: 0.05, secShift: 1, groups: { estudantes: 10, religiosos: -14, militares: -5, classe_media: -2 } } });
  act('valores_tradicionais', 'social', 'Agenda de valores tradicionais (família, religião, costumes)', 'Ensino religioso, restrições a conteúdos, discurso conservador.', { cost: 1, cooldown: 6, ideo: { e: 0, s: 65 }, kw: ['familia', 'valores', 'conservador', 'tradicao', 'costumes'], eff: { groups: { religiosos: 14, militares: 4, estudantes: -14 }, polarization: 6 } });
  act('estado_laico', 'social', 'Reforçar o Estado laico', 'Fim de privilégios religiosos e de ensino religioso obrigatório.', { cost: 1, once: true, ideo: { e: 0, s: -45 }, kw: ['estado laico', 'laicidade'], eff: { groups: { religiosos: -12, estudantes: 8 } } });
  act('cotas', 'social', 'Ações afirmativas e cotas raciais/sociais', 'Reserva de vagas em universidades e concursos.', { cost: 1, once: true, minYear: 1980, ideo: { e: -20, s: -45 }, kw: ['cotas', 'acoes afirmativas'], eff: { gini: -0.2, groups: { estudantes: 8, pobres: 5, classe_media: -6, religiosos: -2 } } });
  act('indigenas', 'social', 'Demarcar terras indígenas', 'Reconhecimento de territórios tradicionais.', { cost: 1, cooldown: 8, ideo: { e: -20, s: -40 }, kw: ['indigena', 'demarcacao', 'terras indigenas'], eff: (st) => ({ environment: 4, rel: H.t(st) > 1990 ? { 'bloc:ocidente': 3 } : {}, groups: { estudantes: 8, agro: -12, militares: -3 } }) });
  act('fim_apartheid', 'social', 'Desmontar o apartheid / segregação legal', 'Fim das leis de segregação racial, direitos civis plenos.', { cost: 3, once: true, ideo: { e: 0, s: -60 }, kw: ['apartheid', 'segregacao', 'direitos civis'], req: (st) => (!st.flags.apartheid ? 'Não há segregação legal' : true), eff: { unflag: 'apartheid', legit: 15, sanctions: { by: 'ocidente', on: false }, rel: { '*': 15 }, groups: { pobres: 20, estudantes: 15, militares: -10, religiosos: -2, agro: -8 } } });
  act('imigracao_abrir', 'social', 'Abrir a imigração para atrair mão de obra', 'Vistos de trabalho facilitados, regularização.', { cost: 1, cooldown: 8, ideo: { e: 30, s: -40 }, kw: ['imigracao', 'abrir fronteiras', 'imigrantes', 'vistos'], eff: { popAdj: 0.5, lag: [{ turns: 4, eff: { gpot: 0.1 } }], groups: { empresarios: 6, estudantes: 5, trabalhadores: -6, religiosos: -4, militares: -3 } } });
  act('imigracao_restringir', 'social', 'Restringir a imigração', 'Cotas menores, deportações, controle de fronteira.', { cost: 1, cooldown: 8, ideo: { e: -5, s: 55 }, kw: ['restringir imigracao', 'deportar', 'fechar fronteira', 'muro'], eff: { gpot: -0.05, groups: { trabalhadores: 5, religiosos: 4, militares: 5, empresarios: -5, estudantes: -10 }, rel: { neighbors: -4 } } });

  // ======================= TRABALHO =======================
  act('leis_trabalhistas', 'trabalho', 'Consolidar leis trabalhistas (jornada, férias, carteira)', 'Direitos formais para assalariados (CLT 1943, Lei Wagner 1935).', { cost: 2, once: true, congress: 0.45, ideo: { e: -40, s: 10 }, kw: ['clt', 'leis trabalhistas', 'direitos trabalhistas', 'ferias', 'carteira'], eff: { uStar: 0.5, legit: 5, groups: { trabalhadores: 14, sindicatos: 12, pobres: 4, empresarios: -10 } } });
  act('reforma_trabalhista', 'trabalho', 'Reforma trabalhista (flexibilização)', 'Negociado sobre o legislado, contratos flexíveis, menos encargos.', { cost: 2, cooldown: 16, congress: 0.55, ideo: { e: 55, s: 0 }, kw: ['reforma trabalhista', 'flexibilizar', 'flexibilizacao'], eff: { uStar: -0.7, confidence: 6, gini: 0.3, groups: { sindicatos: -16, trabalhadores: -7, empresarios: 12, financeiro: 6 } } });
  act('fortalecer_sindicatos', 'trabalho', 'Reconhecer e fortalecer sindicatos', 'Negociação coletiva, imposto sindical, proteção a dirigentes.', { cost: 1, once: true, ideo: { e: -45, s: 0 }, kw: ['sindicato', 'sindicatos', 'fortalecer sindicatos'], eff: { groups: { sindicatos: 16, trabalhadores: 5, empresarios: -8 }, uStar: 0.2 } });
  act('proibir_greves', 'trabalho', 'Proibir greves e intervir nos sindicatos', 'Repressão ao movimento sindical.', { cost: 1, cooldown: 8, ideo: { e: 30, s: 50 }, kw: ['proibir greve', 'intervir sindicato', 'reprimir greve'], eff: (st) => ({ protests: -8, legit: H.dem(st) ? -8 : -2, press: -5, groups: { sindicatos: -28, trabalhadores: -10, estudantes: -6, empresarios: 7, militares: 3 } }) });
  act('seguro_desemprego', 'trabalho', 'Criar seguro-desemprego', 'Renda temporária para quem perdeu o emprego.', { cost: 1, once: true, minYear: 1930, ideo: { e: -30, s: 0 }, kw: ['seguro desemprego', 'desempregados'], eff: { budget: { social: 0.4 }, poverty: -0.8, groups: { trabalhadores: 9, sindicatos: 6, pobres: 3 } } });
  act('jornada_40h', 'trabalho', 'Reduzir a jornada de trabalho', 'De 48/44 para 40 horas semanais sem redução salarial.', { cost: 2, once: true, congress: 0.55, minYear: 1930, ideo: { e: -40, s: -5 }, kw: ['jornada', '40 horas', 'reduzir jornada', 'escala 6x1'], eff: { gpot: -0.05, unemp: -0.2, groups: { trabalhadores: 12, sindicatos: 10, empresarios: -12 } } });
  act('desonerar_folha', 'trabalho', 'Desonerar a folha de pagamento', 'Menos encargos sobre salários para estimular emprego formal.', { cost: 1, cooldown: 8, ideo: { e: 35, s: 0 }, kw: ['desonerar', 'folha de pagamento', 'encargos'], eff: { tax: -0.4, uStar: -0.3, groups: { empresarios: 10, trabalhadores: 2 } } });
  act('frentes_trabalho', 'trabalho', 'Frentes de trabalho e obras públicas (estilo New Deal)', 'Governo contrata diretamente desempregados para obras.', { cost: 2, cooldown: 6, ideo: { e: -35, s: 0 }, kw: ['frentes de trabalho', 'new deal', 'obras publicas', 'emprego publico'], eff: Object.assign(project('infra', 0.9, 6, { infra: 1.5 }, 'As frentes de trabalho foram encerradas.'), { unemp: -1.5, groups: { trabalhadores: 9, pobres: 7, sindicatos: 4, financeiro: -5 } }) });

  // ======================= SEGURANÇA E JUSTIÇA =======================
  act('policia', 'seguranca', 'Ampliar efetivo policial e investimento em segurança', 'Mais policiais, viaturas, inteligência.', { cost: 1, cooldown: 4, ideo: { e: 10, s: 35 }, kw: ['policia', 'seguranca', 'policiais', 'violencia', 'crime'], eff: { budget: { admin: 0.2 }, secShift: 4, groups: { classe_media: 6, religiosos: 3, militares: 2, estudantes: -2 } } });
  act('guerra_drogas', 'seguranca', 'Guerra às drogas (ofensiva militarizada)', 'Operações em larga escala contra o tráfico.', { cost: 2, cooldown: 6, ideo: { e: 10, s: 55 }, kw: ['guerra as drogas', 'trafico', 'narcotrafico', 'faccao'],
    outcomes: () => [
      { p: 0.45, key: 'ok', label: 'Facções enfraquecidas, violência cai', eff: { secShift: 6, groups: { classe_media: 8, religiosos: 5, militares: 4, estudantes: -4 } } },
      { p: 0.4, key: 'efeito_balao', label: 'Violência migra e aumenta (efeito balão)', eff: { secShift: -3, deaths: 2, groups: { classe_media: 2, pobres: -6, estudantes: -6 } } },
      { p: 0.15, key: 'abuso', label: 'Massacres e denúncias de abusos', eff: { legit: -5, press: -3, groups: { estudantes: -12, pobres: -8, classe_media: -2 }, protests: 6 } }
    ] });
  act('reforma_policial', 'seguranca', 'Desmilitarizar e reformar as polícias', 'Polícia civil única, controle externo, câmeras corporais.', { cost: 1, once: true, congress: 0.5, ideo: { e: -10, s: -40 }, kw: ['desmilitarizar', 'reforma policial', 'cameras corporais'], eff: { lag: [{ turns: 8, eff: { secShift: 3, corruption: -2 } }], groups: { estudantes: 8, pobres: 4, militares: -8, classe_media: -2 } } });
  act('endurecer_penas', 'seguranca', 'Endurecer o código penal', 'Penas maiores, redução da maioridade penal, menos progressão de regime.', { cost: 1, once: true, congress: 0.35, ideo: { e: 0, s: 55 }, kw: ['endurecer penas', 'maioridade penal', 'penas maiores', 'lei e ordem'], eff: { secShift: 1, budget: { admin: 0.1 }, groups: { classe_media: 6, religiosos: 6, militares: 3, estudantes: -8 } } });
  act('prisoes', 'seguranca', 'Reforma do sistema prisional', 'Novas vagas, ressocialização, combate às facções nos presídios.', { cost: 1, cooldown: 8, ideo: { e: -5, s: 0 }, kw: ['presidio', 'prisao', 'sistema prisional', 'cadeia'], eff: { budget: { admin: 0.15 }, lag: [{ turns: 6, eff: { secShift: 3 } }], groups: { classe_media: 2, estudantes: 3 } } });
  act('anticorrupcao', 'seguranca', 'Grande operação anticorrupção (força-tarefa)', 'Polícia, MP e Judiciário com autonomia para investigar o alto escalão (Mãos Limpas, Lava Jato).', { cost: 2, cooldown: 12, ideo: { e: 10, s: 10 }, kw: ['corrupcao', 'anticorrupcao', 'lava jato', 'operacao', 'investigar'],
    outcomes: (st) => [
      { p: 0.55, key: 'ok', label: 'Esquemas desmontados; políticos de todos os lados presos', eff: { corruption: -8, congress: -8, confidence: -2, groups: { classe_media: 12, estudantes: 6, religiosos: 4 } } },
      { p: 0.3, key: 'aliados', label: 'Investigação atinge seu próprio governo e aliados', eff: { corruption: -6, congress: -14, legit: -6, approval: -4, groups: { classe_media: 4 } } },
      { p: 0.15, key: 'economia', label: 'Paralisa grandes empreiteiras e afeta a economia', eff: { corruption: -7, gap: -1.5, unemp: 0.6, groups: { classe_media: 8, empresarios: -8, trabalhadores: -4 } } }
    ] });
  act('desarmamento', 'seguranca', 'Controle rigoroso de armas', 'Restrição à posse e porte, recompra de armas.', { cost: 1, once: true, congress: 0.45, ideo: { e: -10, s: -30 }, kw: ['desarmamento', 'controle de armas', 'proibir armas'], eff: { secShift: 1.5, groups: { estudantes: 6, classe_media: 1, agro: -8, militares: -3, religiosos: -2 } } });
  act('liberar_armas', 'seguranca', 'Flexibilizar posse e porte de armas', 'Mais acesso a armas para civis.', { cost: 1, once: true, ideo: { e: 25, s: 50 }, kw: ['liberar armas', 'porte de armas', 'armar a populacao'], eff: { secShift: -1.5, groups: { agro: 10, militares: 3, classe_media: 2, estudantes: -10, religiosos: 1 } } });
  act('intervencao_seguranca', 'seguranca', 'Intervenção federal/militar na segurança de uma região', 'Forças Armadas assumem a segurança de um estado ou cidade.', { cost: 1, cooldown: 6, ideo: { e: 5, s: 45 }, kw: ['intervencao', 'exercito nas ruas', 'garantia da lei e da ordem', 'glo'], eff: { secShift: 3, military: 4, groups: { classe_media: 6, militares: 5, estudantes: -6, pobres: -2 }, lag: [{ turns: 4, eff: { secShift: -2 } }] } });

  // ======================= INSTITUIÇÕES E PODER =======================
  act('coalizao', 'instituicoes', 'Montar coalizão ampla (distribuir ministérios)', 'Entrega pastas a partidos de centro para garantir maioria.', { cost: 1, cooldown: 4, dem: true, ideo: { e: 0, s: 0 }, kw: ['coalizao', 'ministerios', 'base aliada', 'alianca politica'], eff: { congress: 16, coherence: -6, corruption: 1.5, groups: { classe_media: -2 } } });
  act('reforma_politica', 'instituicoes', 'Reforma política (cláusula de barreira, fim de coligações)', 'Reduz fragmentação partidária.', { cost: 2, once: true, dem: true, congress: 0.7, ideo: { e: 0, s: 0 }, kw: ['reforma politica', 'clausula de barreira', 'sistema eleitoral'], eff: { legit: 4, lag: [{ turns: 8, eff: { congress: 6 } }], groups: { classe_media: 4, estudantes: 3 } } });
  act('plebiscito', 'instituicoes', 'Convocar plebiscito sobre uma agenda do governo', 'Consulta direta à população. Se vencer, ganha legitimidade; se perder, sai enfraquecido.', { cost: 2, cooldown: 12, dem: true, ideo: { e: 0, s: 0 }, kw: ['plebiscito', 'referendo', 'consulta popular'],
    outcomes: (st) => { const p = U.clamp(0.2 + st.pol.approval / 100, 0.1, 0.9); return [
      { p: p, key: 'sim', label: 'A proposta do governo vence nas urnas', eff: { legit: 8, congress: 10, approval: 3 } },
      { p: 1 - p, key: 'nao', label: 'A proposta é derrotada', eff: { legit: -6, congress: -10, approval: -4 } }]; } });
  act('constituinte', 'instituicoes', 'Convocar Assembleia Nacional Constituinte', 'Nova Constituição. Grande mobilização; reorganiza o Estado.', { cost: 3, once: true, ideo: { e: 0, s: -10 }, kw: ['constituinte', 'nova constituicao'], eff: (st) => ({ legit: H.dem(st) ? 8 : 12, congress: -5, polarization: 5, budget: { social: 0.3, previdencia: 0.3 }, groups: { estudantes: 8, sindicatos: 6, militares: -4 } }) });
  act('eleicao_antecipada', 'instituicoes', 'Convocar eleições antecipadas', 'Dissolve o parlamento e vai às urnas para renovar a maioria.', { cost: 2, cooldown: 8, ideo: { e: 0, s: 0 }, kw: ['eleicao antecipada', 'dissolver parlamento'], req: (st) => (!S.POLITICS.regimes[st.regime].parliament || !H.dem(st) ? 'Só em regimes parlamentaristas/semipresidencialistas' : true), eff: { election: true } });
  act('censura', 'instituicoes', 'Censurar a imprensa', 'Censura prévia, fechamento de veículos, perseguição a jornalistas.', { cost: 1, cooldown: 4, ideo: { e: 0, s: 60 }, kw: ['censura', 'censurar', 'fechar jornal', 'controlar midia'], eff: (st) => ({ press: -25, protests: -6, legit: H.dem(st) ? -14 : -3, corruption: 3, rel: { 'bloc:ocidente': H.t(st) > 1945 ? -6 : 0 }, groups: { estudantes: -14, classe_media: -6, militares: 3 } }) });
  act('liberdade_imprensa', 'instituicoes', 'Garantir a liberdade de imprensa', 'Fim da censura, proteção a jornalistas.', { cost: 1, once: true, ideo: { e: 0, s: -45 }, kw: ['liberdade de imprensa', 'fim da censura'], eff: (st) => ({ press: 30, legit: 6, corruption: -2, protests: H.dem(st) ? 0 : 8, rel: { 'bloc:ocidente': 5 }, groups: { estudantes: 12, classe_media: 6, militares: -4 } }) });
  act('prender_opositores', 'instituicoes', 'Prender líderes da oposição', 'Detenções políticas, exílios e cassações.', { cost: 2, cooldown: 4, auth: true, ideo: { e: 0, s: 70 }, kw: ['prender opositores', 'cassar', 'perseguir oposicao', 'exilio'], eff: (st) => ({ protests: -10, legit: -10, press: -5, rel: { 'bloc:ocidente': H.t(st) > 1975 ? -12 : -4 }, groups: { estudantes: -16, sindicatos: -8, classe_media: -4, militares: 3 }, lag: [{ turns: 4, eff: { protests: 6 } }] }) });
  act('anistia', 'instituicoes', 'Anistia e libertação de presos políticos', 'Reconciliação nacional.', { cost: 2, once: true, ideo: { e: 0, s: -40 }, kw: ['anistia', 'libertar presos', 'presos politicos'], eff: { legit: 10, protests: 4, rel: { 'bloc:ocidente': 6 }, groups: { estudantes: 14, sindicatos: 8, militares: -10 } } });
  act('estado_sitio', 'instituicoes', 'Decretar estado de sítio', 'Suspende garantias, proíbe manifestações por alguns meses.', { cost: 2, cooldown: 8, ideo: { e: 0, s: 60 }, kw: ['estado de sitio', 'estado de emergencia', 'lei marcial'], eff: (st) => ({ protests: -22, press: -12, legit: H.dem(st) ? -14 : -4, military: 5, groups: { estudantes: -12, sindicatos: -8, militares: 6, classe_media: -3 }, lag: [{ turns: 3, eff: { protests: 8 } }] }) });
  act('autogolpe', 'instituicoes', 'Fechar o Congresso (autogolpe)', 'Dissolve o Legislativo e governa por decreto (Vargas 1937, Fujimori 1992; tentativa fracassada na Coreia do Sul em 2024).', { cost: 3, dem: true, ideo: { e: 0, s: 80 }, kw: ['fechar o congresso', 'autogolpe', 'dissolver congresso', 'golpe'],
    outcomes: (st) => { const p = U.clamp(0.1 + (st.pol.militaryLoyalty - 50) * 0.012 + (st.pol.approval - 40) * 0.008 - H.trait(st, 'inst', 50) * 0.004 + (H.t(st) < 1990 ? 0.15 : 0), 0.04, 0.85); return [
      { p: p, key: 'ok', label: 'O autogolpe é bem-sucedido', eff: (s) => ({ regime: 'autocracia', legit: -18, press: -25, congress: 40, rel: { 'bloc:ocidente': H.t(s) > 1975 ? -25 : -8 }, groups: { estudantes: -20, classe_media: -8, militares: 6 }, sanctions: H.t(s) > 1990 ? { by: 'ocidente', on: true } : undefined }) },
      { p: 1 - p, key: 'falha', label: 'Militares e Congresso resistem: você é deposto', eff: { gameOver: { reason: 'autogolpe', text: 'A tentativa de autogolpe fracassou. Você foi afastado e responde a processo.' } } }]; } });
  act('transicao_democratica', 'instituicoes', 'Transição democrática: convocar eleições livres', 'Abertura política negociada (Espanha 1977, Brasil 1985, Chile 1990, Coreia 1987).', { cost: 3, auth: true, once: true, ideo: { e: 0, s: -50 }, kw: ['eleicoes livres', 'democracia', 'abertura', 'redemocratizacao', 'transicao'],
    eff: (st) => ({ regime: S.POLITICS.regimes[st.regime].parliament || H.stepTrait(st, 'parl', false) === true ? 'parlamentarista' : 'presidencialista', legit: 25, press: 30, sanctions: { by: 'ocidente', on: false }, rel: { 'bloc:ocidente': 15 }, groups: { estudantes: 20, sindicatos: 10, classe_media: 10, militares: -15 } }) });
  act('expurgo_militar', 'instituicoes', 'Expurgar oficiais desleais', 'Troca de comandos e reformas compulsórias.', { cost: 2, cooldown: 8, ideo: { e: 0, s: 30 }, kw: ['expurgo', 'trocar comandantes', 'demitir generais'], outcomes: (st) => [
      { p: 0.7, key: 'ok', label: 'Comandos leais assumem', eff: { military: 18, strength: -6, groups: { militares: -8 } } },
      { p: 0.3, key: 'reacao', label: 'Reação na caserna: tensão militar aumenta', eff: { military: -10, groups: { militares: -15 } } }] });
  act('soldo', 'instituicoes', 'Reajuste do soldo e benefícios militares', 'Agrada a caserna.', { cost: 1, cooldown: 6, ideo: { e: 0, s: 20 }, kw: ['soldo', 'salario dos militares', 'militares'], eff: { budget: { militar: 0.15 }, military: 8, groups: { militares: 12 } } });
  act('propaganda', 'instituicoes', 'Campanha massiva de propaganda oficial', 'Publicidade, rede nacional, culto à imagem do líder.', { cost: 1, cooldown: 3, ideo: { e: 0, s: 30 }, kw: ['propaganda', 'publicidade', 'marketing', 'comunicacao'], eff: (st) => ({ approval: H.dem(st) ? 2 : 4, press: H.dem(st) ? 0 : -3, budget: { admin: 0.05 }, lag: [{ turns: 2, eff: { budget: { admin: -0.05 } } }] }) });
  act('fortalecer_judiciario', 'instituicoes', 'Fortalecer Judiciário e órgãos de controle', 'Autonomia de MP, tribunais de contas, agências reguladoras.', { cost: 1, once: true, ideo: { e: 10, s: -20 }, kw: ['judiciario', 'orgaos de controle', 'instituicoes'], eff: { corruption: -3, legit: 4, confidence: 3, congress: -3, flags: { judicForte: true } } });
  act('aparelhar_corte', 'instituicoes', 'Ampliar a Suprema Corte com aliados', 'Aumenta o número de ministros e nomeia aliados (Argentina 1990, Venezuela 2004, Hungria 2011).', { cost: 2, once: true, ideo: { e: 0, s: 40 }, kw: ['suprema corte', 'stf', 'aparelhar', 'ministros do supremo'], eff: { legit: -8, congress: 5, corruption: 3, confidence: -4, rel: { 'bloc:ocidente': -4 }, groups: { estudantes: -10, classe_media: -6 } } });
  act('reeleicao', 'instituicoes', 'Aprovar emenda da reeleição', 'Permite um segundo mandato consecutivo (Brasil 1997, Argentina 1994).', { cost: 2, once: true, dem: true, congress: 0.65, ideo: { e: 0, s: 10 }, kw: ['reeleicao', 'segundo mandato'], req: (st) => (S.POL.termLimit(st) >= 2 ? 'Reeleição já é permitida' : true), eff: { flags: { reeleicao: true }, corruption: 2, legit: -3 } });
  act('mandato_ilimitado', 'instituicoes', 'Abolir limites de mandato', 'Reeleição indefinida (Venezuela 2009, Nicarágua 2014, Rússia 2020 na prática).', { cost: 3, once: true, congress: 0.75, ideo: { e: 0, s: 50 }, kw: ['reeleicao indefinida', 'mandato ilimitado', 'terceiro mandato'], eff: { flags: { mandatoIlimitado: true }, legit: -12, rel: { 'bloc:ocidente': -8 }, groups: { estudantes: -12, classe_media: -8 } } });

  // ======================= DEFESA =======================
  act('modernizar_forcas', 'militar', 'Modernizar as Forças Armadas', 'Novos equipamentos, treinamento, doutrina.', { cost: 2, cooldown: 8, ideo: { e: 0, s: 30 }, kw: ['modernizar forcas', 'armamento', 'exercito', 'forcas armadas', 'defesa'], eff: { budget: { militar: 0.4 }, mods: [phase('Modernização militar', { strength: 1.2 }, 8)], groups: { militares: 12, estudantes: -3 } } });
  act('servico_obrigatorio', 'militar', 'Instituir serviço militar obrigatório amplo', 'Recrutamento universal.', { cost: 1, once: true, ideo: { e: 0, s: 45 }, kw: ['servico militar', 'alistamento', 'conscricao'], req: (st) => (st.flags.conscricao ? 'Já existe' : true), eff: { flags: { conscricao: true }, strength: 15, unemp: -0.4, groups: { militares: 8, estudantes: -14, religiosos: 2 } } });
  act('fim_conscricao', 'militar', 'Acabar com o serviço militar obrigatório', 'Forças profissionais e voluntárias.', { cost: 1, once: true, ideo: { e: 15, s: -40 }, kw: ['fim do servico militar', 'exercito profissional'], req: (st) => (!st.flags.conscricao ? 'Não há conscrição' : true), eff: { unflag: 'conscricao', strength: -12, groups: { estudantes: 12, militares: -8 } } });
  act('cortar_defesa', 'militar', 'Cortar o orçamento de defesa', 'Libera recursos para outras áreas.', { cost: 1, cooldown: 4, ideo: { e: -10, s: -30 }, kw: ['cortar defesa', 'reduzir gastos militares', 'desmilitarizar'], req: (st) => (st.e.budget.militar < 0.5 ? 'Orçamento militar já mínimo' : true), eff: (st) => ({ budget: { militar: -Math.min(st.e.budget.militar * 0.25, 1.5) }, military: -10, groups: { militares: -14, estudantes: 4 } }) });
  act('programa_nuclear', 'militar', 'Programa secreto de armas nucleares', 'Enriquecimento de urânio e desenvolvimento da bomba. Após 1970, viola o TNP e atrai sanções severas.', { cost: 3, once: true, minYear: 1942, ideo: { e: 0, s: 50 }, kw: ['bomba atomica', 'arma nuclear', 'programa nuclear', 'bomba'], req: (st) => (st.mil.nukes ? 'Já possui armas nucleares' : true),
    eff: (st) => ({ budget: { militar: 0.5 }, lag: [{ turns: Math.round(U.clamp(40 - st.soc.education * 0.25 - Math.log10(st.e.Y) * 3, 12, 40)), eff: { nukes: true, budget: { militar: -0.3 }, groups: { militares: 15 }, legit: 4 }, note: 'Seu país testou com sucesso uma arma nuclear.' }],
      rel: H.t(st) > 1968 ? { '*': -10 } : {}, sanctions: H.t(st) > 1974 && st.dip.orgs.tnp ? { by: 'ocidente', on: true } : undefined, groups: { militares: 10, estudantes: -6 } }) });
  act('programa_espacial', 'militar', 'Programa espacial nacional', 'Lançadores, satélites e prestígio internacional.', { cost: 2, once: true, minYear: 1957, ideo: { e: -10, s: 20 }, kw: ['programa espacial', 'foguete', 'satelite', 'espaco'], eff: Object.assign(project('educacao', 0.3, 20, { gpot: 0.1, strength: 5, legit: 3 }, 'O programa espacial colocou satélites em órbita.'), { groups: { militares: 6, estudantes: 5 } }) });
  act('industria_defesa', 'militar', 'Criar base industrial de defesa', 'Empresas nacionais de aviões, blindados e mísseis (Embraer, Avibras, Hanwha).', { cost: 2, once: true, minYear: 1940, ideo: { e: -15, s: 30 }, kw: ['industria de defesa', 'industria belica', 'fabricar armas'], eff: Object.assign(project('subsidios', 0.3, 16, { industry: 4, strength: 8, tbShift: 0.3 }, 'A indústria de defesa nacional começou a exportar.'), { groups: { militares: 10, empresarios: 5, sindicatos: 2 } }) });
  act('missao_paz', 'militar', 'Enviar tropas para missão de paz da ONU', 'Prestígio internacional e experiência para as tropas.', { cost: 1, cooldown: 12, minYear: 1948, ideo: { e: 0, s: 0 }, kw: ['missao de paz', 'capacetes azuis', 'onu'], req: (st) => (!st.dip.orgs.onu ? 'Não é membro da ONU' : true), eff: { rel: { '*': 3 }, strength: 2, groups: { militares: 5 } } });
  act('mobilizacao', 'militar', 'Mobilização geral', 'Convoca reservistas e coloca a economia em pé de guerra.', { cost: 2, cooldown: 8, ideo: { e: 0, s: 50 }, kw: ['mobilizacao', 'mobilizar', 'convocar reservistas'], req: (st) => (!H.atWar(st) ? 'Só em guerra' : st.flags.mobilizacao ? 'Já mobilizado' : true), eff: { flags: { mobilizacao: true }, budget: { militar: 3 }, unemp: -2, demand: 0.5, groups: { militares: 10, estudantes: -10, trabalhadores: -4 } } });
  act('desmobilizar', 'militar', 'Desmobilizar as tropas', 'Volta à economia de paz.', { cost: 1, ideo: { e: 0, s: -20 }, kw: ['desmobilizar'], req: (st) => (H.atWar(st) ? 'Ainda em guerra' : st.e.budget.militar < 4 ? 'Não há mobilização a desfazer' : true), eff: (st) => ({ unflag: 'mobilizacao', budget: { militar: -(st.e.budget.militar - U.interp(H.country(st).milPct, Math.min(H.t(st), 2025), 2)) * 0.6 }, unemp: 1, groups: { militares: -5, estudantes: 5 } }) });

  // ======================= DIPLOMACIA (alvo: país) =======================
  const dipReq = (fn) => (st, tg) => (!tg ? 'Escolha um país' : fn ? fn(st, tg) : true);
  act('visita_oficial', 'diplomacia', 'Visita de Estado', 'Encontro de chefes de Estado, acordos protocolares.', { target: true, cost: 1, ideo: { e: 0, s: 0 }, kw: ['visita', 'viagem', 'encontro com'], req: dipReq((st, tg) => (st.mil.wars.some((w) => w.target === tg) ? 'Em guerra com esse país' : true)), eff: (st, tg) => ({ rel: { [tg]: 8 } }) });
  act('acordo_comercial', 'diplomacia', 'Propor acordo de livre comércio', 'Redução tarifária recíproca.', { target: true, cost: 2, ideo: { e: 40, s: 0 }, kw: ['acordo comercial', 'livre comercio com', 'tratado comercial'], req: dipReq((st, tg) => (st.dip.deals[tg] ? 'Já existe acordo' : (st.dip.rel[tg] || 0) < -10 ? 'Relações ruins demais' : true)),
    outcomes: (st, tg) => { const p = S.DIP.acceptProb(st, tg, 'comercio'); return [
      { p: p, key: 'sim', label: 'Acordo assinado', eff: { rel: { [tg]: 10 }, open: 0.03, tbShift: 0.3, gpot: 0.03, groups: { agro: 4, empresarios: 2, financeiro: 4, sindicatos: -2 } }, after: (s) => { s.dip.deals[tg] = true; } },
      { p: 1 - p, key: 'nao', label: 'Proposta recusada', eff: { rel: { [tg]: -2 } } }]; } });
  act('alianca_militar', 'diplomacia', 'Propor aliança militar', 'Pacto de defesa mútua.', { target: true, cost: 2, ideo: { e: 0, s: 20 }, kw: ['alianca militar', 'pacto de defesa', 'aliar'], req: dipReq((st, tg) => (st.dip.alliances[tg] ? 'Já aliados' : (st.dip.rel[tg] || 0) < 30 ? 'Precisa de relações acima de 30' : true)),
    outcomes: (st, tg) => { const p = S.DIP.acceptProb(st, tg, 'alianca'); return [
      { p: p, key: 'sim', label: 'Aliança firmada', eff: { rel: { [tg]: 15 }, strength: 10, groups: { militares: 5 } }, after: (s) => { s.dip.alliances[tg] = true; } },
      { p: 1 - p, key: 'nao', label: 'Recusada', eff: { rel: { [tg]: -3 } } }]; } });
  act('sancoes', 'diplomacia', 'Impor sanções econômicas', 'Restrições comerciais e financeiras ao país-alvo.', { target: true, cost: 1, ideo: { e: 0, s: 30 }, kw: ['sancoes', 'sancionar', 'embargo'], req: dipReq(), eff: (st, tg) => ({ rel: { [tg]: -30 }, tbShift: -0.2, groups: { militares: 3 } }) });
  act('romper_relacoes', 'diplomacia', 'Romper relações diplomáticas', 'Retira embaixador e fecha embaixada.', { target: true, cost: 1, ideo: { e: 0, s: 30 }, kw: ['romper relacoes', 'expulsar embaixador'], req: dipReq(), eff: (st, tg) => ({ rel: { [tg]: -45 }, groups: { militares: 2 } }) });
  act('ajuda_externa', 'diplomacia', 'Enviar ajuda externa', 'Doação humanitária ou cooperação técnica.', { target: true, cost: 1, ideo: { e: -10, s: -10 }, kw: ['ajuda humanitaria', 'doacao', 'cooperacao'], req: dipReq(), eff: (st, tg) => ({ rel: { [tg]: 12 }, debt: 0.1 }) });
  act('emprestimo_bilateral', 'diplomacia', 'Pedir empréstimo a um governo amigo', 'Crédito bilateral (swap, empréstimo direto).', { target: true, cost: 1, cooldown: 8, ideo: { e: 0, s: 0 }, kw: ['emprestimo', 'swap', 'pedir dinheiro'], req: dipReq((st, tg) => ((st.dip.rel[tg] || 0) < 20 ? 'Relações insuficientes' : true)),
    outcomes: (st, tg) => { const p = S.DIP.acceptProb(st, tg, 'emprestimo') * (S.DIP.powerOf(tg, st) > 100 ? 1 : 0.5); return [
      { p: p, key: 'sim', label: 'Empréstimo concedido', eff: { reserves: 3, debt: 2, rel: { [tg]: 3 } } },
      { p: 1 - p, key: 'nao', label: 'Pedido negado', eff: {} }]; } });
  act('ultimato', 'diplomacia', 'Ultimato: exigir território/concessão disputada', 'Pressão máxima por uma disputa (fronteira, ilhas, recursos). Pode terminar em guerra.', { target: true, cost: 2, cooldown: 6, ideo: { e: 0, s: 60 }, kw: ['ultimato', 'exigir', 'reivindicar', 'territorio', 'malvinas', 'ilhas'],
    req: dipReq((st, tg) => (!S.DIP.canProject(st, tg) ? 'Sem capacidade de projetar poder até esse país' : st.mil.wars.some((w) => w.target === tg) ? 'Já em guerra' : true)),
    outcomes: (st, tg) => S.DIP.ultimatumOutcomes(st, tg).map((o) => Object.assign(o, {
      eff: o.key === 'capitula' ? { legit: 10, groups: { militares: 12, classe_media: 6, religiosos: 4 }, rel: { [tg]: -40 }, strength: 2 }
        : o.key === 'guerra' ? { war: { target: tg, aggressor: true, label: 'Guerra iniciada após ultimato' }, groups: { militares: 6 } }
          : o.key === 'mediacao' ? { rel: { [tg]: -15 }, legit: 2 }
            : { rel: { [tg]: -25, 'bloc:ocidente': -10 }, sanctions: { by: 'ocidente', on: true }, confidence: -8 }
    })) });
  act('declarar_guerra', 'diplomacia', 'Declarar guerra', 'Ação militar direta. Veja as chances estimadas antes de confirmar.', { target: true, cost: 3, ideo: { e: 0, s: 70 }, kw: ['declarar guerra', 'invadir', 'atacar', 'guerra contra'],
    req: dipReq((st, tg) => (!S.DIP.canProject(st, tg) ? 'Sem capacidade de projetar poder até esse país' : st.mil.wars.some((w) => w.target === tg) ? 'Já em guerra' : true)),
    eff: (st, tg) => ({ war: { target: tg, aggressor: true, label: 'Declaração de guerra' }, confidence: -10, gap: -1, groups: { militares: 8, estudantes: -12, financeiro: -10, religiosos: -2 } }),
    text: (st, tg) => { const o = S.DIP.warOdds(st, tg); return 'Estimativa do Estado-Maior: ' + o.map((x) => x.label + ' ' + Math.round(x.p * 100) + '%').join(' · ') + '.'; } });
  act('propor_paz', 'diplomacia', 'Propor paz / cessar-fogo', 'Negociação para encerrar a guerra.', { target: true, cost: 1, ideo: { e: 0, s: -20 }, kw: ['paz', 'cessar fogo', 'armisticio', 'negociar paz'], req: (st, tg) => (!tg ? 'Escolha um país' : !st.mil.wars.some((w) => w.target === tg) ? 'Não está em guerra com esse país' : true),
    outcomes: (st, tg) => { const w = st.mil.wars.find((x) => x.target === tg); const p = U.clamp(0.3 + (w ? -w.score / 200 + st.mil.warEx / 250 : 0) + (w && w.score > 40 ? 0.3 : 0), 0.08, 0.92); return [
      { p: p, key: 'sim', label: 'Acordo de paz assinado', eff: (s) => ({ peace: { target: tg, result: 'paz negociada' }, warEx: -20, approval: 4, groups: { estudantes: 6, militares: w && w.score < 0 ? -6 : -2 } }) },
      { p: 1 - p, key: 'nao', label: 'Negociações fracassam; a guerra continua', eff: { approval: -1 } }]; } });
  act('apoiar_rebeldes', 'diplomacia', 'Apoiar secretamente a oposição em outro país', 'Financiamento e armas para grupos opositores.', { target: true, cost: 2, cooldown: 8, ideo: { e: 0, s: 40 }, kw: ['apoiar rebeldes', 'derrubar governo', 'financiar oposicao'], req: dipReq(),
    outcomes: (st, tg) => [
      { p: 0.6, key: 'oculto', label: 'Operação permanece oculta e desestabiliza o alvo', eff: { rel: { [tg]: -5 } } },
      { p: 0.4, key: 'exposto', label: 'Operação é descoberta e vira escândalo internacional', eff: { rel: { [tg]: -40, '*': -5 }, legit: -4 } }] });
  act('alinhar_ocidente', 'diplomacia', 'Alinhamento com os EUA e o Ocidente', 'Política externa pró-americana.', { cost: 1, cooldown: 8, minYear: 1945, ideo: { e: 35, s: 10 }, kw: ['alinhar com eua', 'ocidente', 'pro americano'], eff: (st) => ({ rel: { 'bloc:ocidente': 12, 'bloc:socialista': -15, 'bloc:revisionista': -12 }, confidence: 3, after: null, groups: { financeiro: 5, militares: 4, estudantes: -5 } }), after: (st) => { st.dip.blocOverride = 'ocidente'; } });
  act('alinhar_leste', 'diplomacia', 'Alinhamento com URSS / China / Rússia', 'Aproximação com o bloco rival dos EUA.', { cost: 1, cooldown: 8, minYear: 1945, ideo: { e: -40, s: 10 }, kw: ['alinhar com russia', 'alinhar com china', 'uniao sovietica', 'urss'], eff: { rel: { 'bloc:ocidente': -15, 'bloc:socialista': 15, 'bloc:revisionista': 12 }, confidence: -4, groups: { estudantes: 3, sindicatos: 4, financeiro: -6, militares: -5 } }, after: (st) => { st.dip.blocOverride = H.coldWar(st) ? 'socialista' : 'revisionista'; } });
  act('nao_alinhamento', 'diplomacia', 'Política externa independente / não-alinhada', 'Equidistância entre as potências (Conferência de Bandung 1955).', { cost: 1, cooldown: 8, minYear: 1945, ideo: { e: -5, s: 0 }, kw: ['nao alinhado', 'independente', 'neutralidade'], eff: { rel: { 'bloc:nao_alinhado': 8 }, groups: { militares: 2, estudantes: 2 } }, after: (st) => { st.dip.blocOverride = 'nao_alinhado'; } });

  // Entrar/sair de organizações
  const ORG_ACT = [
    ['onu', 'ONU', 1945, {}], ['fmi', 'FMI', 1945, {}], ['gatt', 'GATT/OMC', 1948, { open: 0.05, gpot: 0.05 }], ['otan', 'OTAN', 1949, { strength: 15, rel: { 'bloc:ocidente': 10, RU: -20 } }],
    ['cee', 'Comunidade Europeia / UE', 1957, { open: 0.15, gpot: 0.25, confidence: 6 }], ['mercosul', 'Mercosul', 1991, { open: 0.05 }], ['brics', 'BRICS', 2009, { rel: { CN: 6, RU: 6, IN: 6, BR: 6, ZA: 6 } }],
    ['opep', 'OPEP', 1960, {}], ['asean', 'ASEAN', 1967, { open: 0.04 }], ['tnp', 'Tratado de Não Proliferação', 1968, { rel: { '*': 3 } }], ['nafta', 'NAFTA/USMCA', 1994, { open: 0.1, gpot: 0.1 }]
  ];
  const ORG_REGION = { otan: ['europa', 'america_norte'], cee: ['europa'], mercosul: ['latam'], asean: ['asia'], nafta: ['america_norte', 'latam'] };
  for (const [org, nm, y, eff] of ORG_ACT) {
    act('entrar_' + org, 'diplomacia', 'Aderir: ' + nm, 'Pedido de adesão a ' + nm + '.', { cost: 2, minYear: y, ideo: { e: org === 'brics' ? -20 : 15, s: 0 }, kw: ['entrar na ' + org, 'aderir ' + org, 'entrar no ' + org],
      req: (st) => (st.dip.orgs[org] ? 'Já é membro' : ORG_REGION[org] && !ORG_REGION[org].includes(H.region(st)) && !(org === 'otan' && st.cid === 'TR') ? 'Fora da região da organização' : org === 'opep' && H.oilExp(st) < 0.4 ? 'Não é grande exportador de petróleo' : org === 'nafta' && !['US', 'CA', 'MX'].includes(st.cid) ? 'Restrito à América do Norte' : org === 'cee' && (!H.dem(st)) ? 'Exige democracia' : true),
      outcomes: (st) => { const p = U.clamp(0.5 + (org === 'cee' || org === 'otan' ? -0.15 + (H.dem(st) ? 0.2 : -0.4) : 0.25), 0.05, 0.95); return [
        { p: p, key: 'sim', label: 'Adesão aprovada', eff: Object.assign({ org: { [org]: true } }, eff, { legit: 2 }) },
        { p: 1 - p, key: 'nao', label: 'Adesão vetada/adiada', eff: {} }]; } });
    act('sair_' + org, 'diplomacia', 'Sair: ' + nm, 'Retirada de ' + nm + '.', { cost: 2, minYear: y, ideo: { e: -10, s: 45 }, kw: ['sair da ' + org, 'sair do ' + org, org + 'xit'],
      req: (st) => (!st.dip.orgs[org] ? 'Não é membro' : true),
      eff: (st) => { const neg = {}; for (const k in eff) if (typeof eff[k] === 'number') neg[k] = -eff[k] * 0.8; return Object.assign({ org: { [org]: false }, confidence: org === 'cee' ? -10 : -3, groups: { militares: 3, religiosos: 2, estudantes: -6, financeiro: -6 } }, neg); } });
  }
  act('adotar_euro', 'diplomacia', 'Adotar o euro', 'Entra na união monetária: juros baixos, fim do risco cambial, sem política monetária própria.', { cost: 3, once: true, minYear: 1999, ideo: { e: 30, s: -10 }, kw: ['euro', 'adotar o euro', 'moeda unica'], req: (st) => (!st.dip.orgs.cee ? 'Precisa ser membro da UE' : st.fxRegime === 'euro' ? 'Já usa o euro' : st.e.infl > 4 || st.e.primDef > 3 ? 'Critérios de Maastricht não atendidos (inflação ≤4%, déficit ≤3%)' : true),
    eff: { fxRegime: 'euro', cbIndep: true, target: 2, org: { euro: true }, inflExp: -1, confidence: 8, groups: { financeiro: 8, classe_media: 4 } } });
  act('sair_euro', 'diplomacia', 'Abandonar o euro', 'Volta à moeda nacional. Corrida bancária e desvalorização quase certas.', { cost: 3, ideo: { e: -30, s: 40 }, kw: ['sair do euro'], req: (st) => (st.fxRegime !== 'euro' ? 'Não usa o euro' : true),
    eff: { fxRegime: 'flutuante', cbIndep: false, org: { euro: false }, fx: 35, infl: 8, confidence: -25, gap: -5, reserves: -2, groups: { financeiro: -25, classe_media: -15, sindicatos: 4 } } });

  // ======================= MEIO AMBIENTE =======================
  act('combate_desmatamento', 'ambiente', 'Combate ao desmatamento e fiscalização ambiental', 'Mais fiscais, satélites, multas.', { cost: 1, cooldown: 6, minYear: 1970, ideo: { e: -15, s: -25 }, kw: ['desmatamento', 'combater desmatamento', 'amazonia', 'floresta', 'fiscalizacao ambiental', 'meio ambiente'], eff: (st) => ({ environment: 10, budget: { admin: 0.05 }, rel: H.t(st) > 1990 ? { 'bloc:ocidente': 6 } : {}, groups: { estudantes: 8, agro: -8 } }) });
  act('flexibilizar_licenciamento', 'ambiente', 'Flexibilizar o licenciamento ambiental', 'Acelera obras e mineração com menos exigências.', { cost: 1, once: true, ideo: { e: 40, s: 15 }, kw: ['licenciamento', 'flexibilizar ambiental', 'passar a boiada'], eff: (st) => ({ environment: -10, investShift: 0.6, rel: H.t(st) > 1990 ? { 'bloc:ocidente': -5 } : {}, groups: { agro: 8, empresarios: 6, estudantes: -8 } }) });
  act('imposto_carbono', 'ambiente', 'Imposto sobre carbono', 'Precifica emissões de CO2.', { cost: 2, once: true, congress: 0.6, minYear: 1990, ideo: { e: 10, s: -30 }, kw: ['imposto carbono', 'carbono', 'emissoes'], eff: { tax: 0.4, environment: 6, infl: 0.5, industry: -1.5, rel: { 'bloc:ocidente': 4 }, groups: { estudantes: 6, empresarios: -8, agro: -6, trabalhadores: -2 } } });
  act('acordo_climatico', 'ambiente', 'Aderir a acordo climático internacional', 'Metas de redução de emissões (Kyoto 1997, Paris 2015).', { cost: 1, once: true, minYear: 1997, ideo: { e: -5, s: -25 }, kw: ['acordo de paris', 'clima', 'kyoto', 'acordo climatico'], eff: { environment: 3, rel: { '*': 4 }, groups: { estudantes: 6, agro: -3 } } });
  act('transicao_energetica', 'ambiente', 'Plano de transição energética', 'Eletrificação, descarbonização da indústria e transporte.', { cost: 2, once: true, minYear: 2008, ideo: { e: -15, s: -25 }, kw: ['transicao energetica', 'descarbonizar', 'carro eletrico'], eff: Object.assign(project('subsidios', 0.5, 16, { environment: 8, gpot: 0.05 }, 'A transição energética avançou.'), { groups: { estudantes: 8, empresarios: 2, trabalhadores: -2 } }) });

  // ======================= CARTAS ADICIONAIS =======================
  act('afrouxamento_quantitativo', 'monetaria', 'Afrouxamento quantitativo (BC compra títulos longos)', 'O Banco Central compra títulos públicos e privados para derrubar os juros longos quando o juro básico já está perto de zero (EUA 2008, Japão 2013, BCE 2015).', {
    cost: 1, cooldown: 4, minYear: 2001, ideo: { e: -5, s: 0 }, kw: ['afrouxamento quantitativo', 'quantitative easing', 'qe', 'comprar titulos'],
    req: (st) => (st.fxRegime === 'euro' || st.fxRegime === 'dolarizado' ? 'Sem banco central próprio' : st.e.rate > 3 ? 'Ainda há espaço para cortar o juro básico (juro > 3%)' : true),
    eff: (st) => ({ demand: st.e.gap < -1 ? 0.8 : 0.3, inflExp: st.e.gap < -1 ? 0.3 : 0.8, fx: 3, confidence: st.e.gap < -1 ? 3 : -2, mods: [phase('Compras de ativos pelo BC', { investShift: 0.05 }, 4)], groups: { financeiro: 6, empresarios: 4, classe_media: 1 } })
  });
  act('compulsorio_subir', 'monetaria', 'Aumentar o depósito compulsório dos bancos', 'Os bancos são obrigados a deixar mais dinheiro parado no Banco Central. Freia o crédito sem mexer nos juros (China e Brasil usam muito).', {
    cost: 1, cooldown: 3, ideo: { e: 0, s: 0 }, kw: ['compulsorio', 'aumentar compulsorio', 'deposito compulsorio', 'enxugar credito'],
    req: (st) => (st.fxRegime === 'euro' || st.fxRegime === 'dolarizado' ? 'Sem banco central próprio' : true),
    eff: { demand: -0.5, infl: -0.4, inflExp: -0.2, groups: { financeiro: -5, empresarios: -3 } }
  });
  act('compulsorio_reduzir', 'monetaria', 'Reduzir o depósito compulsório dos bancos', 'Libera dinheiro dos bancos para emprestar. Estimula o crédito rapidamente, com risco inflacionário.', {
    cost: 1, cooldown: 3, ideo: { e: 0, s: 0 }, kw: ['reduzir compulsorio', 'liberar compulsorio', 'liberar credito'],
    req: (st) => (st.fxRegime === 'euro' || st.fxRegime === 'dolarizado' ? 'Sem banco central próprio' : true),
    eff: { demand: 0.5, infl: 0.4, inflExp: 0.2, groups: { financeiro: 5, empresarios: 3, classe_media: 2 } }
  });
  taxAct('imposto_heranca', 'Aumentar o imposto sobre heranças', 'Alíquota maior e progressiva sobre grandes heranças. Arrecada pouco no curto prazo; reduz a desigualdade entre gerações.', { congress: 0.5, once: true, ideo: { e: -45, s: 0 }, kw: ['heranca', 'imposto sobre heranca', 'itcmd', 'imposto heranca'], eff: { tax: 0.2, taxes: { fortunas: 0.5 }, gini: -0.3, confidence: -2, groups: { financeiro: -6, classe_media: -4, empresarios: -4, sindicatos: 5, estudantes: 5 } } });
  taxAct('tributar_dividendos', 'Tributar lucros e dividendos', 'Fim da isenção sobre dividendos distribuídos aos acionistas.', { congress: 0.55, once: true, ideo: { e: -40, s: 0 }, kw: ['dividendos', 'lucros e dividendos', 'tributar dividendos', 'taxar dividendos'], eff: { tax: 0.5, taxes: { renda: 1.5 }, gini: -0.4, investShift: -0.3, confidence: -3, groups: { financeiro: -10, empresarios: -8, sindicatos: 5, pobres: 2 } } });
  act('renda_basica', 'social', 'Renda básica universal', 'Pagamento mensal a todos os cidadãos, sem condicionalidades. Reduz pobreza de forma radical; custa caro.', {
    cost: 3, once: true, congress: 0.7, minYear: 1960, ideo: { e: -50, s: -10 }, kw: ['renda basica universal', 'renda universal', 'renda cidada'],
    eff: (st) => ({ budget: { social: 3 }, demand: 0.8, poverty: -6, gini: -1.5, confidence: st.e.debt > st.e.debtTol ? -10 : -4, uStar: 0.2, groups: { pobres: 22, trabalhadores: 10, estudantes: 8, classe_media: -4, financeiro: -12, empresarios: -6 } })
  });
  act('congelar_alugueis', 'social', 'Congelar os aluguéis', 'Proíbe reajustes de aluguel. Alivia inquilinos agora; no médio prazo encolhe a oferta de imóveis para alugar (Berlim 2020, Argentina 2020).', {
    cost: 1, cooldown: 8, ideo: { e: -40, s: 0 }, kw: ['congelar alugueis', 'congelar aluguel', 'aluguel', 'alugueis', 'inquilinos'],
    eff: (st) => ({ infl: -Math.min(1.5, 0.3 + st.e.infl * 0.01), groups: { pobres: 8, trabalhadores: 5, estudantes: 6, classe_media: 2, empresarios: -6, financeiro: -4 },
      lag: [{ turns: 6, eff: { investShift: -0.4, poverty: 0.5, infl: 0.6, groups: { classe_media: -3, estudantes: -3 } }, note: 'Com aluguel congelado, proprietários tiraram imóveis do mercado: falta oferta.' }] })
  });
  act('cortar_privilegios', 'instituicoes', 'Cortar salários e privilégios de políticos e altos cargos', 'Teto real para supersalários, fim de auxílios e mordomias. Economia pequena; popular, mas irrita o Congresso e a elite do funcionalismo.', {
    cost: 1, once: true, ideo: { e: 10, s: 0 }, kw: ['privilegios', 'supersalarios', 'salario dos deputados', 'cortar mordomias', 'salario de politicos'],
    eff: (st) => ({ budget: { admin: -0.05 }, corruption: -1, approval: 2, congress: H.dem(st) ? -8 : 0, groups: { classe_media: 6, pobres: 3, trabalhadores: 3, servidores: -6 } })
  });

  S.ACTIONS = { list: A, byId: {} };
  for (const a of A) S.ACTIONS.byId[a.id] = a;
})(globalThis.S = globalThis.S || {});
