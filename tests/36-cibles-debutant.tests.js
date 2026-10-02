partieDeTests('tests/36-cibles-debutant.tests.js');
/* ------------------------------------------------------------------
   L'onglet Cible : sans cible, partir d'un modele ; incompletes, aucun
   mouvement ; completes, un plan qui s'equilibre, une marge de tolerance et
   la repartition d'un versement sans rien vendre. Montants fictifs.
   ------------------------------------------------------------------ */
suite('Cibles : modèles, marge, versement', () => {
  const app = () => (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const cibles = (classes, cash = 0, extra = {}) => Fixture.poser(s => {
    s.targets = { classes, cashToInvest: cash, exclues: [], ...extra };
  });
  /* Une ligne de plan construite a la main, sur une base donnee. */
  const ligne = (cle, value, targetPct, base, extra = {}) => ({
    label: cle, cle: `classes.${cle}`, value, pct: value / base * 100, targetPct,
    targetVal: base * targetPct / 100, delta: base * targetPct / 100 - value, ...extra });

  test('trois états, lus sur la somme brute', () => {
    cibles({});
    eq(etatCibles(), 'aucune', 'rien de posé');
    cibles({ actions: 0, obligations: 0 });
    eq(etatCibles(), 'aucune', 'tout à zéro, ce n’est pas une cible');
    cibles({ actions: 60, obligations: 38 });
    eq(etatCibles(), 'incomplete', '98 %');
    cibles({ actions: 60, obligations: 43 });
    eq(etatCibles(), 'incomplete', '103 %');
    cibles({ actions: 60, obligations: 35 }, 5);
    eq(etatCibles(), 'complete', '100 % avec la trésorerie');
    cibles({ actions: 60, obligations: 39.996 });
    eq(sommeCibles(), 100, 'l’affichage arrondit à 100 %');
    eq(etatCibles(), 'incomplete', 'mais la somme brute ne les fait pas');
  });

  test('un plan ne se présente comme financé que si son résidu est nul', () => {
    cibles({ actions: 100.0000008 });
    eq(etatCibles(), 'complete', 'dans la tolérance de l’état');
    vrai(!planEquilibre({ base: 1e8, classes: [{ delta: 0.8 }], cash: null }), '0,80 € sans cible : pas de plan');
    vrai(planEquilibre({ base: 1e8, classes: [{ delta: 0.4 }], cash: null }), '0,40 € s’arrondit à zéro');
  });

  test('l’arrondi garde l’équilibre', () => {
    const r = arrondirEnEquilibre([2.6, -1.3, -1.3]);
    eq(r.reduce((s, v) => s + v, 0), 0, 'la somme arrondie vaut l’arrondi de la somme');
    vrai(r.every((v, i) => Math.abs(v - [2.6, -1.3, -1.3][i]) < 1), 'chaque part reste à moins d’un euro');
    eq(arrondirEnEquilibre([33.4, 33.3, 33.3]).join(','), '34,33,33', 'plus grands restes, ordre stable');
  });

  test('la somme affichée est l’arrondi de la brute, calculée une fois', () => {
    const s = lireSource('assets/store.js') || '';
    vrai(/function sommeCibles\(\) \{\s*return round2\(sommeCiblesBrute\(\)\);\s*\}/.test(s), 'un seul calcul');
    eq((s.match(/function sommeCiblesBrute\(/g) || []).length, 1, 'une seule définition');
  });

  test('la marge : un quart de la cible, entre 1 et 5 points', () => {
    eq(margeCible(0), 1, 'cible 0 : 1 point');
    eq(margeCible(4), 1, 'cible 4 : 1 point');
    eq(margeCible(8), 2, 'cible 8 : 2 points');
    eq(margeCible(20), 5, 'cible 20 : 5 points');
    eq(margeCible(60), 5, 'cible 60 : 5 points');
    vrai(!horsMarge({ pct: 62, targetPct: 60 }), '2 points sur 60 : dans la marge');
    vrai(horsMarge({ pct: 65, targetPct: 60 }), '5 points : hors marge dès l’égalité');
    vrai(horsMarge({ pct: 6.5, targetPct: 5 }), '1,5 point sur 5 : hors marge');
    vrai(!horsMarge({ pct: 0.5, targetPct: 0 }), 'un reliquat infime sur une cible nulle : dans la marge');
    vrai(horsMarge({ pct: 2, targetPct: 0 }), '2 points sur une cible nulle : hors marge');
  });

  test('une classe découpée déclenche le plan quand ses rôles dérivent ensemble', () => {
    /* Core et satellite a +2,5 points chacun, dans leur marge ; la classe
       agregee a +5 points, hors marge ; la compensation est repartie. */
    cibles({ actions: { core: 46, satellite: 14 }, obligations: 20, metaux: 20 });
    const base = 1000;
    const r = { base, cash: null, classes: [
      ligne('actions.core', 485, 46, base, { classeParente: 'actions', labelClasse: 'Actions' }),
      ligne('actions.satellite', 165, 14, base, { classeParente: 'actions', labelClasse: 'Actions' }),
      ligne('obligations', 175, 20, base), ligne('metaux', 175, 20, base)] };
    vrai(r.classes.every(l => !horsMarge(l)), 'aucune ligne n’est hors marge');
    vrai(planDeclenche(r), 'la classe agrégée l’est, et le plan se déclenche');
    const m = mouvementsDuPlan(r);
    eq(m.length, 4, 'le plan complet');
    eq(m.reduce((s, x) => s + x.montant, 0), 0, 'qui s’équilibre');
    vrai(m.every(x => x.dansLaMarge), 'chaque jambe dit qu’elle était dans sa marge');
  });

  test('une marge franchie sans jambe d’un euro entier ne se dit pas « dans la marge »', () => {
    /* Base de 1 EUR, tout en actions pour une cible 60/40 : 40 points hors
       marge, mais les jambes de 0,40 EUR s'arrondissent a zero. */
    cibles({ actions: 60, obligations: 40 });
    const base = 1;
    const r = { base, cash: null, classes: [ligne('actions', 1, 60, base), ligne('obligations', 0, 40, base)] };
    vrai(planDeclenche(r), 'la marge est franchie');
    eq(mouvementsDuPlan(r).length, 0, 'mais aucune jambe ne fait un euro');
    const s = app();
    vrai(/: !mouvements\.length \? `<p class="empty">\$\{declenche\s*\? trad\('Les écarts font moins d’un euro : rien à arbitrer\.'\)/.test(s),
      'la page le distingue de la marge');
    vrai(!!I18N.en['Les écarts font moins d’un euro : rien à arbitrer.'], 'et le traduit');
  });

  test('le plan complet s’équilibre à l’euro, même avec une jambe de 0,50 €', () => {
    cibles({ actions: 60, obligations: 35, metaux: 5 });
    const base = 1000;
    const r = { base, cash: null, classes: [ligne('actions', 540, 60, base), ligne('obligations', 409.5, 35, base),
                                           ligne('metaux', 50.5, 5, base)] };
    const m = mouvementsDuPlan(r);
    const ventes = -m.filter(x => x.montant < 0).reduce((s, x) => s + x.montant, 0);
    const achats = m.filter(x => x.montant > 0).reduce((s, x) => s + x.montant, 0);
    eq(ventes, achats, 'les ventes affichées financent exactement les achats');
    cibles({ actions: 60, obligations: 38 });
    eq(mouvementsDuPlan(r).length, 0, 'à 98 %, aucun mouvement');
    cibles({});
    eq(mouvementsDuPlan(r).length, 0, 'sans cible, aucun mouvement');
  });

  test('un versement va à ce qui est sous sa cible, au prorata, sans rien vendre', () => {
    cibles({ actions: 50, obligations: 30, metaux: 20 });
    const base = 1000;
    const r = { base, cash: null, classes: [ligne('actions', 400, 50, base), ligne('obligations', 300, 30, base),
                                           ligne('metaux', 300, 20, base)] };
    const p = repartirVersement(r, 101);
    eq(p.reduce((s, x) => s + x.montant, 0), 101, 'la somme fait exactement le montant');
    vrai(p.every(x => x.montant > 0), 'rien de négatif');
    vrai(!p.some(x => x.cle === 'classes.metaux'), 'rien pour ce qui dépasse sa cible');
    eq(p.map(x => x.montant).join(','), '84,17', 'au prorata des déficits, plus grands restes');
    eq(repartirVersement(r, 0).length, 0, 'sans montant, rien');
    eq(repartirVersement(r, 10.9).reduce((s, x) => s + x.montant, 0), 10, '10,90 : dix euros répartis');
    const avant = JSON.stringify(repartirVersement(r, 101));
    cibles({ actions: 50, obligations: 30, metaux: 18 });
    eq(JSON.stringify(repartirVersement(r, 101)), avant, 'mêmes arguments, même répartition, quel que soit l’état');
    vrai(/const parts = planEquilibre\(r\) \? repartirVersement\(r, montant\) : \[\];/.test(app()),
      'c’est la page qui demande un plan possible');
  });

  test('les centimes d’un versement se disent, le montant de la Projection se garde', () => {
    const s = app();
    vrai(/const montant = Math\.max\(0, round2\(num\(projectionSettings\(\)\.monthly\)\)\);/.test(s),
      'le champ part du montant de la Projection, centimes compris');
    vrai(/id="versementCible"/.test(s) && /step="0\.01"[^>]*id="versementCible"/.test(s), 'et les accepte');
    vrai(/const centimes = num\(montant\) - entier > 0\.004;[\s\S]{0,400}if \(!parts\.length\) return avis \|\|/.test(s),
      'moins d’un euro saisi : l’avis, pas « indique un montant »');
    vrai(/const centimes = num\(montant\) - entier > 0\.004;/.test(s)
      && /trad\('En euros entiers : \{v\} répartis, les centimes restent de côté\.'\)/.test(s),
      'la carte dit quand des centimes restent de côté');
    vrai(!!I18N.en['En euros entiers : {v} répartis, les centimes restent de côté.'], 'traduit');
  });

  test('tant que le plan ne s’écrit pas, une ligne constate sans consigne', () => {
    const s = app();
    vrai(/const constat = !sansCible && !equilibre;/.test(s), 'le constat suit la garde du plan');
    vrai(/: constat \? \(Math\.round\(row\.delta\) === 0 \? trad\('à la cible'\)[\s\S]{0,200}trad\('sous la cible'\) : trad\('au-dessus de la cible'\)/.test(s),
      'sans verbe d’action');
    vrai(/sansCible \|\| constat \? 'neutre'/.test(s), 'et une jauge grise');
    for (const k of ['sous la cible', 'au-dessus de la cible', 'à la cible']) vrai(!!I18N.en[k], `« ${k} » traduit`);
  });

  test('quatre modèles neutres, qui font 100 %', () => {
    eq(MODELES_CIBLES.map(m => m.id).join(','), 'actions100,actions80,actions60,actions30', 'dans l’ordre');
    for (const m of MODELES_CIBLES) {
      eq(Object.values(m.classes).reduce((s, v) => s + v, 0), 100, `${m.nom} fait 100 %`);
      vrai(Object.keys(m.classes).every(k => k in ASSET_CLASSES), `${m.nom} ne cible que des classes connues`);
      vrai(!!I18N.en[m.nom] && !!I18N.en[m.phrase], `${m.nom} se traduit`);
      vrai(!/prudent|dynamique|équilibré|adapté|recommand/i.test(m.nom + m.phrase), `${m.nom} ne promet aucune adéquation`);
      vrai(!/\d/.test(m.phrase), `${m.nom} n’avance aucun chiffre de rendement ni de baisse`);
    }
  });

  test('appliquer un modèle résout les exclusions qu’il touche, et garde les autres', () => {
    Fixture.poser(s => {
      s.targets = { classes: { actions: { core: 46, satellite: 14 }, obligations: 0, crypto: 0 }, cashToInvest: 5,
                    exclues: ['obligations', 'crypto'], ciblesRetirees: { obligations: 10, crypto: 5 } };
    });
    const effet = effetModeleCibles('actions80');
    eq(effet.regroupees.join(','), 'actions', 'le découpage regroupé se nomme');
    eq(effet.effacees.length, 0, 'rien d’effacé : le modèle cible les actions');
    eq(effet.reintegrees.join(','), 'obligations', 'la classe remise aussi');
    appliquerModeleCibles('actions80');
    const tg = Store.state.targets;
    eq(JSON.stringify(tg.classes), JSON.stringify({ actions: 80, obligations: 20 }), 'les cibles du modèle');
    eq(tg.exclues.join(','), 'crypto', 'la crypto reste exclue');
    eq(JSON.stringify(tg.ciblesRetirees), JSON.stringify({ crypto: 5 }), 'avec sa cible mémorisée');
    pres(sommeCiblesBrute(), 100, 'la somme active fait 100 %');
    eq(etatCibles(), 'complete', 'et le plan peut s’écrire');
    vrai(tg.origineRevue, 'les cibles d’origine ne se signalent plus');
  });

  test('un découpage que le modèle ne cible pas se dit effacé', () => {
    cibles({ actions: 70, obligations: { core: 20, satellite: 10 } });
    const effet = effetModeleCibles('actions100');
    eq(effet.regroupees.length, 0, 'rien à regrouper');
    eq(effet.effacees.join(','), 'obligations', 'les obligations perdent leur cible et leur partage');
    vrai(/effet\.effacees\.length \? trad\('\{c\} n’a plus de cible, ni de partage core et satellite\.'\)/.test(app()),
      'la confirmation le nomme');
    vrai(!!I18N.en['{c} n’a plus de cible, ni de partage core et satellite.'], 'traduit');
  });

  test('les cibles d’origine se signalent, sans être effacées', () => {
    const origine = { classes: { actions: 90, obligations: 0, metaux: 5, crypto: 0, monetaire: 0 }, cashToInvest: 5, exclues: [] };
    Fixture.poser(s => { s.targets = structuredClone(origine); });
    vrai(ciblesDOrigine(), 'détectées');
    eq(JSON.stringify(Store.state.targets.classes), JSON.stringify(origine.classes), 'et conservées');
    Store.state.targets.origineRevue = true;
    vrai(!ciblesDOrigine(), 'gardées : plus signalées');
    Fixture.poser(s => { s.targets = { ...structuredClone(origine), classes: { actions: 85, metaux: 10 } }; });
    vrai(!ciblesDOrigine(), 'modifiées : ce ne sont plus celles d’origine');
    const neuf = blankState().targets;
    eq(JSON.stringify(neuf.classes), '{}', 'un profil neuf n’a pas de cible');
    eq(neuf.cashToInvest, 0, 'pas même de trésorerie');
  });

  test('l’insight ne signale un écart que si le plan peut s’écrire', () => {
    const regle = REGLES_INSIGHT.find(x => x.id === 'allocation_target_gap');
    cibles({ actions: 60, obligations: 38 });
    vrai(!regle.eligible(), 'à 98 %, il se tait');
    /* Cent millions a 70/30 pour une cible 65/35 : 5 points d'ecart. A
       100,0000008 %, l'etat est complet mais le plan laisse 0,80 EUR sans
       cible et refuse de s'ecrire ; l'insight suit la meme garde. */
    const poser = cibleActions => Fixture.poser(s => {
      s.targets = { cashToInvest: 0, classes: { actions: cibleActions, obligations: 35 }, exclues: [] };
      s.positions = [
        { id: 'p_a', name: 'Actions', isin: '', symbol: 'ACT', currency: 'EUR', qty: 1, buyPrice: 7e7, price: 7e7,
          fx: 1, fxBuy: 1, account: 'c_pea', manual: false, assetClass: 'actions', role: 'core' },
        { id: 'p_o', name: 'Obligations', isin: '', symbol: 'OBL', currency: 'EUR', qty: 1, buyPrice: 3e7, price: 3e7,
          fx: 1, fxBuy: 1, account: 'c_pea', manual: false, assetClass: 'obligations', role: 'core' },
      ];
      s.comptes.forEach(c => { c.cash = []; });
    });
    poser(65);
    vrai(regle.eligible(), 'à 100 %, l’écart de 5 points se signale');
    poser(65.0000008);
    eq(etatCibles(), 'complete', 'dans la tolérance de l’état');
    vrai(!planEquilibre(), 'mais le plan refuse son résidu');
    vrai(!regle.eligible(), 'et l’insight se tait avec lui');
  });

  test('la raison d’une sauvegarde se lit dans la langue de l’écran', () => {
    vrai(/majuscule\(trad\(b\.reason\)\)/.test(app()), 'traduite à l’affichage');
    vrai(!!I18N.en['avant un modèle de cibles'], 'celle d’un modèle de cibles a sa clef');
  });

  test('la page : modèles sans cible, plan, versement, total, gestes', () => {
    const s = app();
    vrai(/\$\{etat === 'aucune' \? choixModelesCible\(true\)/.test(s), 'sans cible, les modèles');
    vrai(/\$\{!equilibre \? '' : carteVersementCible\(r\)\}/.test(s), 'le versement seulement avec un plan possible');
    vrai(/const mouvements = mouvementsDuPlan\(r\);/.test(s), 'le plan vient du modèle');
    vrai(/trad\('Total des cibles : \{v\} % · il en manque \{x\}'\)/.test(s), 'le total au pied des menus');
    vrai(/data-action="choisir-modele-cible"/.test(s) && /async 'appliquer-modele-cible'\(btn\)/.test(s)
      && /'garder-cibles-origine'\(\)/.test(s), 'les gestes existent');
    vrai(/if \(etatCibles\(\) !== 'aucune'\) \{[\s\S]{0,700}askConfirm\(/.test(s),
      'sur des cibles posées, un modèle se confirme');
    for (const k of ['Choisis un point de départ', 'Partir d’un modèle', 'Ton prochain versement', 'dans la marge',
                     'La marge vaut un quart de la cible, avec un minimum de 1 point et un maximum de 5 points.',
                     'Des exemples courants, pas un conseil : tu choisis, et chaque pourcentage reste modifiable.'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
  });
});

finDePartieDeTests('tests/36-cibles-debutant.tests.js');
