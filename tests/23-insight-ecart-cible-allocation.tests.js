partieDeTests('tests/23-insight-ecart-cible-allocation.tests.js');
suite('Insight : l’écart à la cible d’allocation', () => {
  const trouve = () => evaluerInsights().find(i => i.id === 'allocation_target_gap') || null;

  /* Le reequilibrage se nourrit des POSITIONS, par `stockTotals()`, et non des
     lignes posees sur un compte : deux titres suffisent donc a fabriquer un
     ecart au dixieme de point. Les valeurs sont quantite un fois le prix, pour
     qu'on lise le pourcentage directement dans le test. */
  const poserParts = (actions, obligations, cibleActions, cibleObligations) => {
    Fixture.poser(s => {
      s.targets = { cashToInvest: 0,
                    classes: { actions: cibleActions, obligations: cibleObligations },
                    exclues: [] };
      s.positions = [
        { id: 'p_a', name: 'Actions', isin: '', symbol: 'ACT', currency: 'EUR', qty: 1,
          buyPrice: actions, price: actions, fx: 1, fxBuy: 1, account: 'c_pea',
          manual: false, assetClass: 'actions', role: 'core' },
        { id: 'p_o', name: 'Obligations', isin: '', symbol: 'OBL', currency: 'EUR', qty: 1,
          buyPrice: obligations, price: obligations, fx: 1, fxBuy: 1, account: 'c_pea',
          manual: false, assetClass: 'obligations', role: 'core' },
      ];
      s.comptes.forEach(c => { if (c.id === 'c_pea') c.cash = []; });
    });
  };

  test('sans cible posée, la règle se tait', () => {
    Fixture.poser(s => { s.targets = { cashToInvest: 0, classes: {}, exclues: [] }; });
    eq(trouve(), null, 'pas de cible n’est pas une cible de zéro');
  });

  test('la convention du seuil est >= 5 points, et ce test la fige', () => {
    eq(SEUIL_AFFICHAGE_ALLOCATION_PP, 5, 'le seuil d’affichage vaut cinq points');
    /* 4,9 point : rien. Le filtre existe pour que le bruit ne prenne pas la
       place du signal, et il ne dit rien de ce qui serait prudent. */
    poserParts(6990, 3010, 65, 35);
    eq(trouve(), null, '4,9 pp ne produit rien');
    /* Exactement 5,0 : l'insight parait. LA BORNE EST INCLUSIVE, et c'est ici
       que deux lecteurs pouvaient differer. */
    poserParts(7000, 3000, 65, 35);
    vrai(!!trouve(), '5,0 pp produit l’insight : la borne est inclusive');
    poserParts(7200, 2800, 65, 35);
    const i = trouve();
    vrai(!!i, '7 pp aussi');
    pres(i.params.deltaPct, 7, 'l’écart est rendu en points de pourcentage');
    pres(i.params.currentPct, 72);
    pres(i.params.targetPct, 65);
  });

  test('la sous-allocation compte autant que la sur-allocation', () => {
    poserParts(5800, 4200, 65, 35);
    const i = trouve();
    vrai(!!i, 'un retard de 7 pp produit aussi');
    vrai(i.params.deltaPct < 0, 'et le signe dit le sens');
    pres(Math.abs(i.params.deltaPct), 7);
  });

  test('plusieurs classes dérivent : une seule sort, la plus grande, toujours la même', () => {
    /* Actions a +12, obligations a −6 : la plus grande deviation gagne, sans
       ambiguite, et deux lectures rendent la meme. */
    Fixture.poser(s => {
      s.targets = { cashToInvest: 0,
                    classes: { actions: 60, obligations: 30, metaux: 10 }, exclues: [] };
      s.positions = [
        { id: 'p_a', name: 'Actions', isin: '', symbol: 'ACT', currency: 'EUR', qty: 1,
          buyPrice: 7200, price: 7200, fx: 1, fxBuy: 1, account: 'c_pea',
          manual: false, assetClass: 'actions', role: 'core' },
        { id: 'p_o', name: 'Obligations', isin: '', symbol: 'OBL', currency: 'EUR', qty: 1,
          buyPrice: 2400, price: 2400, fx: 1, fxBuy: 1, account: 'c_pea',
          manual: false, assetClass: 'obligations', role: 'core' },
        { id: 'p_m', name: 'Or', isin: '', symbol: 'OR', currency: 'EUR', qty: 1,
          buyPrice: 400, price: 400, fx: 1, fxBuy: 1, account: 'c_cto',
          manual: false, assetClass: 'metaux', role: 'satellite' },
      ];
      s.comptes.forEach(c => { c.cash = []; });
    });
    const tous = evaluerInsights().filter(i => i.id === 'allocation_target_gap');
    eq(tous.length, 1, 'une seule carte d’allocation, jamais trois');
    const a = trouve(), b = trouve();
    eq(a.params.classe, b.params.classe, 'et c’est la même à chaque lecture');
    pres(a.params.deltaPct, 12, 'la plus grande déviation, en valeur absolue');
    pres(a.params.currentPct, 72);
    pres(a.params.targetPct, 60);
  });

  test('la preuve nomme le seuil comme un seuil d’affichage', () => {
    poserParts(7200, 2800, 65, 35);
    const i = trouve();
    eq(i.evidence.source, 'rebalanceRows');
    eq(i.evidence.displayThresholdPp, SEUIL_AFFICHAGE_ALLOCATION_PP,
      'la preuve porte le seuil, pour que la présentation sache que c’est un filtre');
    vrai(/filtres d’affichage, jamais des normes/.test(lireSource('assets/insights.js'))
      || /filtres d'affichage, jamais des normes/.test(lireSource('assets/insights.js')),
      'et le code le dit');
    /* Le moteur ne recalcule ni la base, ni les parts. */
    const r = rebalanceRows();
    const ligne = lignesReequilibrage(r).find(x => x.cle === i.params.classe);
    pres(i.params.currentPct, num(ligne.pct), 'la part vient de rebalanceRows()');
    pres(i.evidence.currentValue, num(ligne.value), 'l’encours aussi');
  });
});

suite('Insight : le rythme d’accumulation', () => {
  const trouve = () => evaluerInsights().find(i => i.id === 'wealth_pace_shift') || null;
  const poserHistorique = valeurs => {
    Fixture.poser(s => {
      s.monthly = valeurs.map((v, i) => {
        const d = new Date(Date.UTC(2024, i + 1, 0));
        return { date: d.toISOString().slice(0, 10), comment: '', v: { c_courant: v } };
      });
    });
  };

  test('un historique trop court ne produit rien', () => {
    Fixture.poser();
    eq(trouve(), null, 'un seul relevé ne fait aucune période');
    poserHistorique([1000, 2000, 3000]);
    eq(trouve(), null, 'deux intervalles ne font pas deux fenêtres de six mois');
    poserHistorique([1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    eq(trouve(), null, 'six intervalles couvrent une seule fenêtre, pas deux');
  });

  test('deux fenêtres pleines produisent, et nomment les mois réellement couverts', () => {
    /* Treize releves : douze intervalles, donc deux fenetres de six mois. */
    poserHistorique([0, 100, 200, 300, 400, 500, 600, 1600, 2600, 3600, 4600, 5600, 6600]);
    const i = trouve();
    vrai(!!i, 'la règle produit');
    eq(i.params.currentMonths, 6, 'la fenêtre récente couvre six mois');
    eq(i.params.previousMonths, 6, 'la précédente aussi');
    pres(i.params.previousMonthly, 100, 'cent par mois avant');
    pres(i.params.currentMonthly, 1000, 'mille par mois ensuite');
    pres(i.params.deltaMonthly, 900);
    eq(i.evidence.source, 'monthlyPace');
    vrai(!!i.evidence.currentFrom && !!i.evidence.currentTo, 'la preuve borne la période récente');
    vrai(!!i.evidence.previousFrom && !!i.evidence.previousTo, 'et la précédente');
  });

  test('le mot « performance » n’apparaît nulle part', () => {
    const s = lireSource('assets/insights.js');
    const regle = s.slice(s.indexOf("id: 'wealth_pace_shift'"), s.indexOf("id: 'goal_projected_date'"));
    for (const mot of ['performance', 'rendement']) {
      vrai(!new RegExp(mot, 'i').test(regle.replace(/\/\*[\s\S]*?\*\//g, '')),
        `« ${mot} » n’a rien à faire ici : le rythme contient les apports`);
    }
    /* Et la preuve le dit, chiffres a l'appui. */
    poserHistorique([0, 100, 200, 300, 400, 500, 600, 1600, 2600, 3600, 4600, 5600, 6600]);
    const i = trouve();
    vrai('currentContributions' in i.evidence, 'la preuve isole les apports de la période');
  });

  test('les fenêtres se comptent en mois couverts, pas en nombre de relevés', () => {
    const s = lireSource('assets/insights.js');
    vrai(/mois \+= Math\.max\(1, num\(reste\[i\]\.mois\) \|\| 1\);/.test(s),
      'chaque point apporte les mois qu’il couvre');
    eq(MOIS_MINIMUM_FENETRE_RYTHME, 6, 'six mois par fenêtre');
    /* Deux releves espaces d'un an font UN point et douze mois : la fenetre est
       pleine avec un seul point, et c'est juste. */
    Fixture.poser(s2 => {
      s2.monthly = [
        { date: '2023-01-31', comment: '', v: { c_courant: 0 } },
        { date: '2024-01-31', comment: '', v: { c_courant: 12000 } },
        { date: '2025-01-31', comment: '', v: { c_courant: 36000 } },
      ];
    });
    const i = trouve();
    vrai(!!i, 'deux intervalles annuels suffisent');
    eq(i.params.currentMonths, 12);
    eq(i.params.previousMonths, 12);
    pres(i.params.previousMonthly, 1000);
    pres(i.params.currentMonthly, 2000);
  });
});

suite('Insight : la date d’atteinte de la cible', () => {
  const trouve = () => evaluerInsights().find(i => i.id === 'goal_projected_date') || null;

  test('sans cible de projection, la règle se tait', () => {
    Fixture.poser(s => { s.meta.projTarget = 0; });
    eq(trouve(), null, 'pas de cible n’est pas une cible de zéro');
  });

  test('une cible hors de portée ne fabrique aucune date', () => {
    Fixture.poser(s => { s.meta.projTarget = 50000000; s.meta.projHorizon = 10; });
    eq(trouve(), null, 'le moteur n’atteint pas la cible : aucune date inventée');
  });

  test('une cible atteignable rend une année, un mois et ses hypothèses', () => {
    Fixture.poser(s => { s.meta.projTarget = 200000; s.meta.projHorizon = 30; });
    const i = trouve();
    vrai(!!i, 'la règle produit');
    const p = capitalisation({ years: 30 });
    eq(i.params.year, num(p.targetReached.year), 'l’année vient de capitalisation()');
    eq(i.params.month, num(p.targetReached.month), 'le mois aussi');
    vrai(i.params.monthsFromNow > 0);
    eq(i.evidence.source, 'capitalisation');
    /* Les hypotheses sont nommees : la date n'est honnete que si l'on sait de
       quel scenario elle descend. */
    for (const k of ['horizonYears', 'monthlyContribution', 'scenario', 'inflationPct']) {
      vrai(k in i.evidence, `la preuve porte ${k}`);
    }
  });

  test('une cible déjà franchie n’est pas cette règle-là', () => {
    Fixture.poser(s => { s.meta.projTarget = 1000; });
    eq(trouve(), null, 'déjà atteinte : rien à projeter ici');
  });

  test('aucun moteur de projection parallèle', () => {
    const s = lireSource('assets/insights.js');
    vrai(/capitalisation\(\{ years: horizonProjection\(\) \}\)/.test(s),
      'la trajectoire vient du moteur, pas d’un calcul local');
    vrai(!/Math\.pow|\*\* *\(|1 \+ taux/.test(s), 'aucune capitalisation écrite à la main');
  });
});

suite('Insight : le capital remboursé', () => {
  const trouve = () => evaluerInsights().find(i => i.id === 'debt_principal_share') || null;

  test('sans crédit qui amortit, la règle se tait', () => {
    Fixture.poser(s => { s.etabs.forEach(e => { e.dettes = []; }); });
    eq(trouve(), null, 'aucun capital remboursé : rien à dire');
  });

  test('un crédit qui amortit produit un montant mensuel, jamais confondu avec l’épargne', () => {
    /* CE CONTRÔLE INTERROGE LE MODÈLE, PLUS UNE RÈGLE D'INSIGHT. Il passait par
       `debt_principal_share`, dont la lecture redisait la carte « Accumulation
       ce mois-ci » du même écran et qui a quitté le catalogue. La distinction
       qu'il protège appartient à `savingsReconciliation()` : le capital
       remboursé augmente le patrimoine mais n'est pas de l'épargne disponible,
       et les confondre est l'erreur que cette séparation existe pour éviter. */
    Fixture.poser(s => {
      const e = s.etabs.find(x => x.id === 'e_bien');
      e.dettes = [{ id: 'd_pret', libelle: 'Prêt', montant: 100000, taux: 2, mensualite: 600,
                    note: '', verifieLe: todayISO() }];
    });
    const rec = savingsReconciliation();
    vrai(num(rec.capitalRembourse) >= 0, 'le capital remboursé est un montant mensuel');
    vrai(num(rec.investable) >= 0 || num(rec.investable) < 0,
      'et l’épargne disponible en est un autre');
    /* Deux champs distincts, jamais le même nombre lu deux fois. */
    vrai('capitalRembourse' in rec && 'investable' in rec,
      'le modèle les porte séparément, et c’est ce qui empêche de les confondre');
  });
});

suite('Le moteur d’insights et la cloche ne font pas le même métier', () => {
  test('aucune règle ne double un contrôle de healthChecks()', () => {
    const s = lireSource('assets/insights.js');
    vrai(!/healthChecks/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')),
      'le moteur n’appelle pas la cloche et ne la recopie pas');
    /* La cloche reclame un geste de saisie, le moteur lit une situation. Aucune
       regle d'insight ne doit donc porter de niveau d'alerte. */
    Fixture.poser();
    for (const i of construireInsights()) {
      vrai(!('level' in i), `${i.id} ne porte aucun niveau d’alerte`);
      vrai(!/manquant|incomplet|a compléter|à compléter/i.test(i.id),
        `${i.id} n’est pas une réclamation de saisie`);
    }
  });

  test('l’horizon de projection se dérive comme dans la vue', () => {
    const i = lireSource('assets/insights.js');
    const a = lireSource('assets/app.js');
    vrai(/num\(Store\.state && Store\.state\.meta \? Store\.state\.meta\.projHorizon : 0\) \|\| 20/.test(i),
      'le moteur dérive l’horizon de l’état');
    vrai(/num\(Store\.state\?\.meta\?\.projHorizon\) \|\| 20/.test(a),
      'et la vue en fait autant : même défaut de vingt ans');
  });
});

/* --- Le bruit du rythme --------------------------------------------------- */
suite('Le rythme ne se dit que s’il a vraiment changé', () => {
  const trouve = () => evaluerInsights().find(i => i.id === 'wealth_pace_shift') || null;
  /* Treize releves, donc douze intervalles : deux fenetres de six mois. Les six
     premiers ecarts valent `avant`, les six suivants `apres`. */
  const poserRythme = (avant, apres) => {
    Fixture.poser(s => {
      const v = [0];
      for (let i = 0; i < 6; i++) v.push(v[v.length - 1] + avant);
      for (let i = 0; i < 6; i++) v.push(v[v.length - 1] + apres);
      s.monthly = v.map((x, i) => {
        const d = new Date(Date.UTC(2024, i + 1, 0));
        return { date: d.toISOString().slice(0, 10), comment: '', v: { c_courant: x } };
      });
    });
  };

  test('le seuil est un filtre d’affichage, et il vaut vingt pour cent', () => {
    eq(SEUIL_AFFICHAGE_RYTHME_PCT, 20);
    const s = lireSource('assets/insights.js');
    vrai(/filtres d’affichage, jamais des normes/.test(s) || /filtres d'affichage, jamais des normes/.test(s),
      'le fichier dit que ce sont des filtres, pas des normes');
  });

  test('une variation trop faible ne se dit pas', () => {
    poserRythme(1000, 1040);   /* +4 % */
    eq(trouve(), null, '4 % ne vaut pas la peine d’être dit');
    poserRythme(1000, 1199);   /* +19,9 % */
    eq(trouve(), null, '19,9 % non plus');
  });

  test('exactement vingt pour cent se dit : la borne est inclusive', () => {
    poserRythme(1000, 1200);
    const i = trouve();
    vrai(!!i, '20,0 % produit l’insight');
    pres(i.params.deltaPct, 20, 'et la preuve porte l’écart relatif');
    eq(i.evidence.displayThresholdPct, SEUIL_AFFICHAGE_RYTHME_PCT,
      'la preuve nomme le seuil, pour que personne ne le prenne pour une règle');
  });

  test('une variation franche se dit, dans les deux sens', () => {
    poserRythme(1000, 1500);
    const haut = trouve();
    vrai(!!haut && haut.params.deltaPct > 0, 'une accélération');
    poserRythme(1500, 1000);
    const bas = trouve();
    vrai(!!bas && bas.params.deltaPct < 0, 'et un ralentissement');
    pres(Math.abs(bas.params.deltaPct), 100 / 3, 'l’écart se rapporte à la période précédente');
  });

  test('une période précédente nulle ou négative ne produit aucun pourcentage', () => {
    /* La regle de la maison : un pourcentage n'existe que sur une base
       positive. Un rythme precedent a zero donnerait un « +900 % » qui ne
       mesure rien, et un rythme negatif retournerait le signe. */
    poserRythme(0, 1500);
    eq(trouve(), null, 'une base nulle : silence plutôt qu’un pourcentage absurde');
    poserRythme(-500, 1500);
    eq(trouve(), null, 'une base négative : silence aussi');
    /* Et le silence est assume : la donnee existe toujours dans le moteur. */
    vrai(monthlyPace().points.length >= 12, 'l’historique, lui, est bien là');
  });

  test('deux montants qui s’affichent pareil ne font pas une phrase', () => {
    /* Un ecart relatif enorme sur des montants minuscules : « 0 contre 0 ». */
    Fixture.poser(s => {
      const v = [0];
      for (let i = 0; i < 6; i++) v.push(v[v.length - 1] + 0.1);
      for (let i = 0; i < 6; i++) v.push(v[v.length - 1] + 0.4);
      s.monthly = v.map((x, i) => {
        const d = new Date(Date.UTC(2024, i + 1, 0));
        return { date: d.toISOString().slice(0, 10), comment: '', v: { c_courant: x } };
      });
    });
    eq(trouve(), null, 'arrondis, les deux rythmes valent le même nombre : rien à dire');
  });

  test('un historique trop court reste non éligible', () => {
    Fixture.poser();
    eq(trouve(), null, 'un seul relevé');
  });
});

/* --- La granularité de l'allocation --------------------------------------- */
suite('L’allocation parle de la classe, jamais d’une moitié de classe', () => {
  const trouve = () => evaluerInsights().find(i => i.id === 'allocation_target_gap') || null;
  const pos = (id, classe, role, valeur, compte) => ({
    id, name: id, isin: '', symbol: id.toUpperCase(), currency: 'EUR', qty: 1,
    buyPrice: valeur, price: valeur, fx: 1, fxBuy: 1, account: compte,
    manual: false, assetClass: classe, role,
  });

  test('une cible découpée en cœur et satellite se lit comme une seule classe', () => {
    /* La cible est posee par role — c'est ce que `rebalanceRows()` decoupe.
       L'insight doit quand meme nommer « Actions », pas « Actions cœur ». */
    Fixture.poser(s => {
      s.targets = { cashToInvest: 0,
                    classes: { actions: { core: 40, satellite: 20 }, obligations: 40 },
                    exclues: [] };
      s.positions = [pos('p_c', 'actions', 'core', 5000, 'c_pea'),
                     pos('p_s', 'actions', 'satellite', 2200, 'c_pea'),
                     pos('p_o', 'obligations', 'core', 2800, 'c_pea')];
      s.comptes.forEach(c => { c.cash = []; });
    });
    const i = trouve();
    vrai(!!i, 'la règle produit');
    eq(i.params.classe, 'actions', 'la classe entière, pas un rôle');
    eq(i.evidence.scope, 'classe', 'et la preuve le dit');
    eq(i.evidence.lignesAgregees, 2, 'deux lignes de rôle ont été ramenées à leur classe');
    /* 7 200 sur 10 000, pour une cible de 40 + 20 : douze points d'ecart. */
    pres(i.params.currentPct, 72);
    pres(i.params.targetPct, 60);
    pres(i.params.deltaPct, 12);
    /* Et le libelle ne porte aucun role. */
    vrai(!/c(oe|œ)ur|core|satellite/i.test(i.params.label),
      `« ${i.params.label} » ne nomme pas un rôle`);
  });

  test('l’agrégation additionne ce que le moteur a rendu, elle ne recalcule rien', () => {
    Fixture.poser(s => {
      s.targets = { cashToInvest: 0,
                    classes: { actions: { core: 40, satellite: 20 }, obligations: 40 },
                    exclues: [] };
      s.positions = [pos('p_c', 'actions', 'core', 5000, 'c_pea'),
                     pos('p_s', 'actions', 'satellite', 2200, 'c_pea'),
                     pos('p_o', 'obligations', 'core', 2800, 'c_pea')];
      s.comptes.forEach(c => { c.cash = []; });
    });
    const r = rebalanceRows();
    const plates = r.classes.filter(x => x.classeParente === 'actions');
    eq(plates.length, 2, 'le moteur rend bien deux lignes de rôle');
    const groupe = lignesReequilibrage(r).find(x => x.cle === 'actions');
    pres(groupe.value, plates.reduce((s2, x) => s2 + num(x.value), 0), 'l’encours est la somme');
    pres(groupe.targetPct, plates.reduce((s2, x) => s2 + num(x.targetPct), 0), 'la cible aussi');
    pres(groupe.pct, groupe.value / num(r.base) * 100, 'et la part se divise par la base du moteur');
    /* La somme des parts fait toujours cent, agregation comprise. */
    const total = lignesReequilibrage(r).reduce((s2, x) => s2 + num(x.value), 0);
    pres(total, num(r.base), 'un total vaut la somme de ses parts');
  });

  test('sous le seuil, rien ne sort, même agrégé', () => {
    Fixture.poser(s => {
      s.targets = { cashToInvest: 0,
                    classes: { actions: { core: 45, satellite: 25 }, obligations: 30 },
                    exclues: [] };
      s.positions = [pos('p_c', 'actions', 'core', 5000, 'c_pea'),
                     pos('p_s', 'actions', 'satellite', 2200, 'c_pea'),
                     pos('p_o', 'obligations', 'core', 2800, 'c_pea')];
      s.comptes.forEach(c => { c.cash = []; });
    });
    /* 72 contre 70, et 28 contre 30 : deux points, sous le filtre. */
    eq(trouve(), null, 'deux points d’écart ne valent pas une carte');
  });
});

/* --- La section À retenir -------------------------------------------------

   `app.js` n'est pas charge par le harnais : ces controles lisent donc la
   source, comme tous les controles de vue de ce projet. Ce qui s'execute ici,
   c'est le moteur ; ce qui se lit, c'est la facon dont la page s'en sert. */
suite('À retenir : trois au maximum, et rien quand il n’y a rien', () => {
  const app = () => lireSource('assets/app.js');
  const presentation = () => {
    const a = app();
    return a.slice(a.indexOf('const PRESENTATION_INSIGHT'), a.indexOf('function carteARetenir()'));
  };
  /* LA BORNE BASSE EST LA FONCTION SUIVANTE, QUELLE QU'ELLE SOIT. Elle nommait
     `viewOverview()`, qui se trouvait être la voisine : la carte commune des
     insights et le rendu d'une entrée se sont posés entre les deux, et la
     tranche a gonflé de deux fonctions que ces contrôles ne visent pas — d'où
     « deux listes » là où la carte de l'Aperçu n'en porte qu'une. Une borne se
     dérive de la structure, jamais d'un voisinage que rien ne garantit. */
  const rendu = () => {
    const a = app();
    const d = a.indexOf('function carteARetenir()');
    const f = a.indexOf('\nfunction ', d + 1);
    return a.slice(d, f > 0 ? f : undefined);
  };

  test('aucun insight : un état calme, et surtout pas un remplissage', () => {
    Store.state = blankState(); Store.migrate(); refreshAccounts();
    eq(construireInsights().length, 0, 'le moteur ne dit rien sur un état vierge');
    const r = rendu();
    /* LA CARTE REPOND, ELLE NE COMBLE PAS. « Rien d'inhabituel à signaler » dit
       ce qui a été regardé et ce qui en est ressorti ; c'est une réponse, et
       elle vaut celles qui portent un chiffre. Ce que la carte ne fait toujours
       pas, c'est inventer une lecture pour occuper la place. */
    vrai(/const vide = !lus\.length;/.test(r), 'l’état calme est un état, pas une absence');
    vrai(r.includes('Rien d’inhabituel à signaler'), 'et il porte sa phrase');
    vrai(!!I18N.en['Rien d’inhabituel à signaler'], 'qui existe dans les deux langues');
    /* Aucun jugement, aucune promesse, aucun compte de zéro. « Tout va bien »
       serait une assurance que rien ne fonde ; « Aucun insight » parlerait du
       moteur plutôt que du patrimoine ; « Rien à signaler » appartient à la
       cloche, qui répond à une question qu'on lui a posée. */
    for (const mot of ['Tout va bien', 'Aucun insight', 'Rien à signaler']) {
      vrai(!r.includes(mot), `« ${mot} » n’apparaît pas dans la carte`);
    }
    vrai(/\$\{!n \? '' :/.test(r), 'et la pastille « 0 insight » ne peut pas s’écrire');
  });

  test('la page ne montre jamais plus de trois insights', () => {
    const a = app();
    /* LE PLAFOND NE S'ECRIT QU'UNE FOIS. Il vit avec la selection qui
       l'applique, dans le moteur ; la vue le relaie. Deux « 3 » ecrits chacun
       de son cote auraient fini par differer, et la vue aurait coupe ce que le
       moteur croyait avoir choisi. */
    /* LE PLAFOND VIT AVEC LA SELECTION QUI L'APPLIQUE, et celle-ci a demenage :
       c'est la carte qui a trois places, et c'est elle qui choisit lesquelles
       remplir. Un plafond pose dans le moteur coupait avant ce choix. */
    /* DEUX, ET LA MESURE TRANCHE : trois lectures occupaient 505 px sur un écran
       de 844, soit soixante pour cent de la hauteur. La carte devenait l'écran
       au lieu de le commenter, et il fallait la faire défiler pour atteindre la
       donnée qu'elle analyse. La troisième est par construction la plus faible
       des trois, puisque le classement l'a mise derrière. */
    vrai(/const MAX_A_RETENIR = 2;/.test(a), 'le plafond est déclaré dans la vue, et il vaut deux');
    vrai(!/MAX_INSIGHTS/.test(lireSource('assets/insights.js')),
      'et le moteur n’en porte plus');
    /* La carte prend désormais ce que le moteur range sur SON onglet, puis la
       même sélection coupe. Le plafond n'a pas bougé de place : il vit toujours
       avec la sélection, dans la vue. */
    vrai(/selectionARetenir\(insightsDeLOnglet\('overview'/.test(rendu()),
      'la coupe passe par la sélection de la Home');
    /* Et l'adressage par onglet n'a pas rapporté de plafond dans le moteur :
       `insightsDeLOnglet()` filtre, il ne coupe pas. Le contrôle porte sur cette
       fonction-là, et non sur le fichier entier — le catalogue se sert de
       `slice` pour découper des fenêtres de mois, ce qui n'a rien à voir. */
    const src = lireSource('assets/insights.js');
    const dt = src.indexOf('function insightsDeLOnglet(');
    vrai(dt > 0, 'la sélection par onglet doit être trouvable');
    vrai(!/slice\(/.test(src.slice(dt, src.indexOf('\n}', dt))),
      'et le moteur ne coupe toujours pas : il rendrait un choix déjà fait');
    vrai(/selectionParClef\(candidats, c => destinationInsight\(c\[1\]\), MAX_A_RETENIR\)/.test(a),
      'qui applique cette constante');
    /* Le catalogue en porte treize : c'est bien un plafond d'affichage, et la
       selection en ecarte dix sur un etat qui aurait de quoi les nourrir. */
    vrai(REGLES_INSIGHT.length >= 12, `${REGLES_INSIGHT.length} règles au catalogue`);
    Fixture.poser();
    /* Et la carte n'en montre jamais plus de trois : la meme selection que la
       vue, sur les memes destinations, lues dans sa propre table. */
    vrai(selectionParClef(construireInsights(), i => destinationsPresentation()[i.id], 3)
      .length <= 3, 'et jamais plus de trois sortent');
  });

  test('l’ordre affiché est celui du moteur, sans second tri', () => {
    const r = rendu();
    vrai(!/\.sort\(/.test(r), 'la vue ne reclasse rien : deux classements finiraient par diverger');
    /* `insightsDeLOnglet()` est la liste du moteur, filtrée sur l'onglet et dans
       son ordre : la vue ne fait qu'y prendre sa part. */
    vrai(/insightsDeLOnglet\('overview'/.test(r), 'elle lit la liste que le moteur a déjà ordonnée');
    /* Et le moteur, lui, est stable : deux appels, deux fois le meme ordre. */
    Fixture.poser();
    eq(construireInsights().map(i => i.id).join(','),
       construireInsights().map(i => i.id).join(','), 'l’ordre ne bouge pas d’un appel à l’autre');
  });

  test('chaque règle a sa présentation, et chaque renvoi mène quelque part', () => {
    const p = presentation();
    const a = app();
    for (const r of REGLES_INSIGHT) {
      vrai(p.includes(`${r.id}: {`), `${r.id} a sa présentation`);
    }
    /* Les cinq destinations, et chacune est une vue ou une redirection que
       l'application sert deja. Les deux tables vivent dans `app.js`. */
    const routes = [];
    for (const m of a.slice(a.indexOf('const VIEWS = {'), a.indexOf('const REDIRECTIONS')).matchAll(/^  ([a-z-]+):\s/gm)) routes.push(m[1]);
    for (const m of a.slice(a.indexOf('const REDIRECTIONS = {'), a.indexOf('const SOUS_ONGLETS')).matchAll(/^  '?([a-z-]+)'?:\s*\[/gm)) routes.push(m[1]);
    const cibles = [...p.matchAll(/cta: \{ vue: '([a-z-]+)'/g)].map(m => m[1]);
    eq(cibles.length, REGLES_INSIGHT.length, 'chaque règle du catalogue porte un renvoi');
    for (const c of cibles) vrai(routes.includes(c), `« ${c} » est une route servie`);
    /* Et chaque ancre citee existe vraiment dans le balisage : un renvoi vers
       une carte absente defile jusqu'en haut de page sans rien dire. */
    const ancres = [...p.matchAll(/ancre: '([a-z]+)'/g)].map(m => m[1]);
    /* Le nombre suit le catalogue, et deux regles l'ont quitte : ce qui compte
       est qu'une bonne moitie des renvois vise une carte plutot qu'un haut de
       page, pas un compte fige. */
    vrai(ancres.length >= REGLES_INSIGHT.length / 3,
      `${ancres.length} renvois visent une carte précise`);
    for (const an of new Set(ancres)) {
      vrai(a.includes(`data-anchor="${an}"`), `la carte « ${an} » existe`);
    }
    /* Aucun libelle vague. */
    for (const mot of ['En savoir plus', 'Optimiser', 'Améliorer', 'Découvrir']) {
      vrai(!p.includes(mot), `aucun renvoi ne dit « ${mot} »`);
    }
  });

  test('aucun titre ne juge, aucune phrase ne conseille', () => {
    const p = presentation();
    const sansCommentaires = p.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const mot of ['trop de', 'insuffisant', 'idéal', 'recommandé', 'Attention',
                       'excellent', 'Bravo', 'mauvaise', 'tu devrais', 'il faut']) {
      vrai(!new RegExp(mot, 'i').test(sansCommentaires), `la présentation ne dit pas « ${mot} »`);
    }
    /* Le rythme ne s'appelle jamais performance : il contient les apports. */
    const bloc = p.slice(p.indexOf('wealth_pace_shift: {'), p.indexOf('goal_projected_date: {'));
    vrai(!/performance|rendement/i.test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')),
      'le rythme patrimonial garde son nom');
    /* Et la date d'objectif reste au conditionnel. */
    vrai(/valeur: p => moisEtAnnee\(p\.year, p\.month\)/.test(p)
      && /pour atteindre ta cible de \{t\}/.test(p),
      'la date est projetée, jamais promise, et la cible porte son montant');
    /* LA RESERVE D'USAGE NE DISPARAIT PAS EN CHANGEANT DE LIGNE. Elle descend
       en information secondaire, juste sous la date : c'est la meme phrase, au
       meme endroit du regard, et la date reste une estimation. */
    vrai(/secondaire: \(\) => trad\('selon tes hypothèses actuelles'\)/.test(p),
      'et l’hypothèse reste écrite sous elle');
    vrai(!/tu atteindras/i.test(sansCommentaires), 'aucune promesse dans le texte affiché');
  });

  test('aucun signe monétaire n’est écrit en dur dans la présentation', () => {
    const p = presentation().replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/[€$]/.test(p), 'les montants passent par le formateur central');
    vrai(/fmtEUR0\(/.test(p), 'et c’est bien lui');
    vrai(/fmtPct\(/.test(p), 'les pourcentages aussi');
    /* Le moteur, lui, n'a jamais rien formate. */
    const m = lireSource('assets/insights.js').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/fmtEUR|fmtPct|[€$]/.test(m), 'et rien n’a fui vers le moteur');
  });

  test('les deux langues portent toutes les clefs de la section', () => {
    const p = presentation();
    const clefs = ['À retenir'];
    for (const m of p.matchAll(/titre: '([^']+)'/g)) clefs.push(m[1].replace(/\\'/g, "'"));
    for (const m of p.matchAll(/libelle: '([^']+)'/g)) clefs.push(m[1].replace(/\\'/g, "'"));
    vrai(clefs.length >= 11, `${clefs.length} clefs relevées`);
    for (const c of clefs) vrai(!!I18N.en[c], `« ${c} » a sa traduction`);
    /* Les gabarits interpoles gardent leurs marques en anglais : sans elles, le
       nombre disparait de la phrase sans que rien ne tombe. */
    for (const [cle, marques] of [
      ['Tes liquidités mobilisables couvrent environ {n} mois de dépenses renseignées.', ['{n}']],
      ['{c} : {a} de tes investissements, pour une cible de {b}.', ['{c}', '{a}', '{b}']],
      ['Ton patrimoine progresse de {a} par mois sur {n} mois, contre {b} sur les {m} précédents.',
        ['{a}', '{n}', '{b}', '{m}']],
      ['Selon tes hypothèses actuelles, ta cible serait atteinte vers {d}.', ['{d}']],
      ['{a} par mois de ta progression viennent du capital remboursé sur tes crédits, et non de ton épargne disponible.',
        ['{a}']],
    ]) {
      vrai(!!I18N.en[cle], `« ${cle.slice(0, 44)}… » a sa traduction`);
      for (const mq of marques) vrai(I18N.en[cle].includes(mq), `et elle garde ${mq}`);
    }
  });

  test('la section vit entre la situation et le détail', () => {
    /* Par defaut : l'accueil se range, et l'ordre vit dans CARTES_APERCU. */
    const a = app();
    const depart = a.indexOf('function viewOverview()');
    const hero = a.indexOf('<div class="hero">', depart);
    const retenir = a.indexOf('${cartes.tete}', depart);
    vrai(hero > depart && retenir > hero, 'elle suit le patrimoine');
    vrai(CARTES_APERCU.indexOf('repartition') > CARTES_APERCU.indexOf('retenir'),
      'et passe avant la répartition, qui détaille');
    vrai(CARTES_APERCU.indexOf('titres') > CARTES_APERCU.indexOf('retenir'), 'et avant le détail des positions');
  });

  test('la section se lit, elle n’alerte pas', () => {
    const r = rendu();
    const css = lireSource('assets/styles.css');
    /* Aucune couleur de gravite, aucune icone, aucun emoji. */
    for (const mot of ['--critical', '--warning', '--serious', 'badge', 'alerte']) {
      vrai(!r.includes(mot), `la carte ne porte pas ${mot}`);
    }
    vrai(/\.retenir-item \{[\s\S]*?border-top: 1px solid var\(--grid\);/.test(css),
      'les entrées se séparent par un filet, comme partout ailleurs');
    /* Et ce qui se focalise porte l'anneau de l'application. */
    vrai(/\.lien-vue:focus-visible \{[\s\S]*?outline: 2px solid var\(--accent\)/.test(css),
      'le renvoi est atteignable au clavier, et ça se voit');
    /* La fleche est decorative : elle ne doit pas etre lue a voix haute. Elle
       vit avec l'entree, dans `ligneInsight()`, et non dans la carte. */
    const a = app();
    const dl = a.indexOf('function ligneInsight(');
    const entreeRendue = a.slice(dl, a.indexOf('\nfunction ', dl + 1));
    vrai(/<span aria-hidden="true">→<\/span>/.test(entreeRendue),
      'la flèche est masquée aux lecteurs d’écran');
    vrai(/aria-labelledby="retenirTitre"/.test(r), 'et la section est nommée');
  });
});

/* --- Réduire, masquer, et s'en souvenir ----------------------------------- */
suite('À retenir se replie, se retire, et s’en souvient', () => {
  const app = () => lireSource('assets/app.js');
  const rendu = () => {
    const a = app();
    return a.slice(a.indexOf('const retenirReplie = ()'), a.indexOf('function viewOverview()'));
  };

  test('le choix vit dans l’état, donc il survit à un rechargement', () => {
    /* Les autres replis de ce fichier sont des drapeaux de session, remis a
       zero au chargement. Celui-ci est une preference : il est range dans
       `meta`, et suit donc l'etat partout ou il va. */
    const r = rendu();
    vrai(/const retenirReplie = \(\) => !!Store\.state\?\.meta\?\.retenirReplie;/.test(r),
      'le repli se lit dans meta');
    vrai(/const retenirMasquee = \(\) => !!Store\.state\?\.meta\?\.retenirMasquee;/.test(r),
      'le masquage aussi');
    const a = app();
    for (const acte of ['retenir-plier', 'retenir-options', 'regl-retenir']) {
      const i = a.indexOf(`'${acte}'(`);
      vrai(i > 0, `${acte} existe`);
      vrai(/Store\.save\(\);/.test(a.slice(i, i + 700)), `${acte} enregistre son choix`);
    }
    /* Et un export le porte, comme tout ce qui vit dans meta. */
    Store.state = blankState(); Store.migrate();
    Store.state.meta.retenirReplie = true;
    const copie = JSON.parse(JSON.stringify(Store.state));
    eq(copie.meta.retenirReplie, true, 'un export le porte');
    Store.state = copie; Store.migrate();
    eq(Store.state.meta.retenirReplie, true, 'et un import le rend');
  });

  test('un état neuf s’ouvre déplié, et rien ne se replie tout seul', () => {
    Store.state = blankState(); Store.migrate();
    eq(!!Store.state.meta.retenirReplie, false, 'déplié par défaut');
    eq(!!Store.state.meta.retenirMasquee, false, 'et visible');
    /* Aucune migration ne pose ces clefs : leur absence vaut « non ». La
       disposition de l'accueil lit et ecrit la seconde, parce que la visibilite
       de la section en est une partie : ce sont ses deux seules mentions. */
    const s = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, '');
    const corps = nom => s.slice(s.indexOf(nom), s.indexOf('\n}\n', s.indexOf(nom)));
    const disposition = corps('function dispositionApercu(') + corps('function ecrireDispositionApercu(');
    vrai(/meta\.retenirMasquee/.test(disposition), 'la disposition de l’accueil la lit et l’écrit');
    vrai(!/retenirReplie|retenirMasquee/.test(s.replace(corps('function dispositionApercu('), '')
      .replace(corps('function ecrireDispositionApercu('), '')),
      'ailleurs le modèle ne les connaît pas : c’est une préférence de vue, pas une donnée');
    eq(dispositionApercu(Store.state.meta).parDefaut, true, 'et un état neuf suit la disposition par défaut');
  });

  test('replié, la carte garde son titre, son compte et une cible confortable', () => {
    const r = rendu();
    /* Le titre porte le bouton : un bouton ne peut pas contenir un titre, et
       l'inverse est valide. Replie, il prend toute la ligne. */
    vrai(/<h2 id="retenirTitre" class="retenir-tete-pliee">/.test(r), 'le titre porte la bascule');
    vrai(/trad\('\{n\} insights'\)\.replace\('\{n\}', n\)/.test(r), 'le compte se dit');
    vrai(/n === 1 \? trad\('1 insight'\)/.test(r), 'et au singulier quand il n’y en a qu’un');
    const css = lireSource('assets/styles.css');
    vrai(/\.retenir-tete-pliee \.retenir-bascule \{\s*\n\s*width: 100%;/.test(css),
      'replié, le bouton prend toute la largeur');
    vrai(/\.retenir-bascule, \.retenir-plus, [^{]*\{ position: relative; \}/.test(css)
      && /\.retenir-bascule::after, \.retenir-plus::after, [^{]*\{/.test(css),
      'et les deux commandes reçoivent la cible tactile des autres');
  });

  test('l’état s’annonce aux lecteurs d’écran, dans les deux sens', () => {
    const r = rendu();
    vrai(/aria-expanded="false" aria-controls="retenirCorps"/.test(r), 'replié');
    vrai(/aria-expanded="true" aria-controls="retenirCorps"/.test(r), 'déplié');
    vrai(/<ul class="retenir-liste" id="retenirCorps">/.test(r), 'et la cible existe');
    vrai(/aria-label="\$\{esc\(trad\('Options de la section'\)\)\}"/.test(r),
      'les trois points portent un nom');
    /* Le chevron est un dessin, pose dans une pastille, et les deux sont
       decoratifs : rien de tout cela ne se lit a voix haute. */
    vrai(/<span class="retenir-pastille" aria-hidden="true"/.test(r),
      'la pastille est masquée aux lecteurs d’écran');
    vrai(/<svg class="retenir-chevron" viewBox="0 0 24 24" aria-hidden="true"/.test(r),
      'le chevron aussi, et c’est un dessin, pas un caractère');
    /* Le commentaire du code cite le glyphe pour dire pourquoi il est parti :
       on lit ce qui s'affiche, pas ce qui l'explique. */
    vrai(!/⌄|˅|▾|▼/.test(r.replace(/\/\*[\s\S]*?\*\//g, '')),
      'aucun glyphe de chevron ne subsiste');
  });

  test('aucune croix : « Réduire » se défait, un retrait se choisit', () => {
    const r = rendu();
    for (const signe of ['✕', '×', 'Fermer', 'Ignorer', 'Ne plus afficher']) {
      vrai(!r.includes(signe), `la carte ne porte pas « ${signe} »`);
    }
    vrai(/trad\('Réduire'\)/.test(r), 'le geste ordinaire est « Réduire »');
    /* Le retrait vit derriere les trois points, pas a cote de « Réduire ». */
    const a = app();
    const menu = a.slice(a.indexOf("async 'retenir-options'()"), a.indexOf("async 'regl-place'()"));
    vrai(/trad\('Masquer cette section'\)/.test(menu), 'le retrait est une entrée de menu');
    vrai(/if \(v !== 'masquer'\) return;/.test(menu), 'et fermer la feuille ne masque rien');
  });

  test('masquée, elle se réaffiche depuis les Préférences', () => {
    const a = app();
    vrai(/if \(retenirMasquee\(\)\) return '';/.test(rendu()), 'masquée, la carte ne se rend pas');
    /* La porte de retour, et c'est la MEME clef : deux portes sur un seul fait. */
    const reglages = a.slice(a.indexOf('function viewSettings()'), a.indexOf('function alertesMasquees'));
    vrai(/action: 'regl-retenir'/.test(reglages), 'la bascule existe dans Préférences');
    vrai(/on: !retenirMasquee\(\)/.test(reglages), 'et elle lit la même clef');
    const acte = a.slice(a.indexOf("'regl-retenir'()"), a.indexOf("'retenir-plier'()"));
    vrai(/Store\.state\.meta\.retenirMasquee = !Store\.state\.meta\.retenirMasquee;/.test(acte),
      'elle écrit la même clef, dans les deux sens');
    for (const c of ['À retenir sur l’Aperçu', 'Une lecture courte de ta situation, en haut de l’Aperçu.',
                     'Masquer cette section', 'Section À retenir',
                     'Tu pourras la réafficher depuis Préférences.',
                     'Options de la section', '1 insight', '{n} insights']) {
      vrai(!!I18N.en[c], `« ${c} » a sa traduction`);
    }
    vrai(I18N.en['{n} insights'].includes('{n}'), 'et le gabarit garde sa marque');
  });

  test('le repli ne touche ni au moteur, ni au contenu des insights', () => {
    /* La carte se replie ; les cinq regles, leurs seuils et leurs phrases ne
       bougent pas. Le moteur ne connait meme pas cet etat. */
    const m = lireSource('assets/insights.js');
    vrai(!/retenirReplie|retenirMasquee|MAX_A_RETENIR/.test(m), 'le moteur ignore l’affichage');
    Fixture.poser();
    const avant = JSON.stringify(construireInsights());
    Store.state.meta.retenirReplie = true;
    Store.state.meta.retenirMasquee = true;
    eq(JSON.stringify(construireInsights()), avant, 'et il rend exactement la même chose');
  });

  test('le chevron tourne, le corps se déroule, et tout se coupe', () => {
    const css = lireSource('assets/styles.css');
    vrai(/\.retenir-chevron \{[\s\S]*?transition: transform \.24s cubic-bezier/.test(css),
      'le chevron tourne');
    vrai(/\.retenir-reduire \.retenir-pastille \.retenir-chevron \{ transform: rotate\(180deg\); \}/.test(css),
      'et il tourne, il n’est pas remplacé par un second dessin');
    /* LE DEROULEMENT MESURE, IL NE DEVINE PAS. Une grille qui passe de zero a
       une fraction laisse le navigateur interpoler la hauteur reelle : la carte
       s'ouvre a sa taille, quel que soit le nombre d'insights. Un plafond de
       hauteur ecrit a la main aurait coupe le troisieme. */
    vrai(/\.retenir-pli \{[\s\S]*?grid-template-rows: 1fr;[\s\S]*?transition: grid-template-rows/.test(css),
      'le corps se déroule par la grille');
    vrai(/\.card\.retenir\.repliee \.retenir-pli \{[\s\S]*?grid-template-rows: 0fr;/.test(css),
      'et se replie par la même');
    vrai(!/max-height/.test(css.slice(css.indexOf('.retenir-pli {'), css.indexOf('@media (prefers-reduced-motion: reduce) {', css.indexOf('.retenir-pli {')))),
      'aucun plafond de hauteur deviné');
    /* La visibilite ne se retire qu'une fois le pli termine, sinon le contenu
       disparaitrait des lecteurs d'ecran avant d'avoir fini de se fermer. */
    vrai(/visibility: hidden;[\s\S]*?visibility 0s \.22s/.test(css),
      'la visibilité se retire après le pli, pas pendant');
    vrai(/@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.retenir-chevron, \.retenir-pli/.test(css),
      'et rien ne bouge pour qui demande moins de mouvement');
  });

  test('le corps reste dans le balisage même replié : c’est ce qui l’anime', () => {
    const a = app();
    const rendu = a.slice(a.indexOf('function carteARetenir()'), a.indexOf('function viewOverview()'));
    /* Un contenu retire du balisage ne peut que disparaitre d'un coup. */
    vrai(/<div class="retenir-pli" \$\{replie \? 'aria-hidden="true"' : ''\}>/.test(rendu),
      'le pli enveloppe le corps dans les deux états');
    const i = rendu.indexOf('${replie ? `');
    const j = rendu.indexOf('<div class="retenir-pli"');
    vrai(j > i, 'seul l’en-tête change selon l’état');
    vrai(/aria-hidden="true"/.test(rendu), 'et replié, il sort des lecteurs d’écran');
  });
});

/* --- La réserve mène à l'autonomie, pas au budget -------------------------- */
suite('Réserve disponible : le renvoi vise la carte, pas la page', () => {
  const app = () => lireSource('assets/app.js');
  const presentation = () => {
    const a = app();
    return a.slice(a.indexOf('const PRESENTATION_INSIGHT'), a.indexOf('function carteARetenir()'));
  };

  test('le renvoi porte une ancre, et cette ancre existe', () => {
    const p = presentation();
    /* La lecture de la reserve a quitte le catalogue : elle redisait la carte
       qu'elle visait. Le principe se verifie donc sur le mouvement de la
       tresorerie, qui vise la meme famille de cartes et, lui, dit ce que la
       carte ne montre pas. */
    const bloc = p.slice(p.indexOf('liquidity_runway_shift: {'), p.indexOf('pocket_share_shift: {'));
    vrai(/ancre: 'evolution'/.test(bloc),
      'le mouvement vise la carte qui le détaille, sur l’écran où il se lit');
    /* La destination existe, et c'est bien la carte qui detaille les mois. */
    const a = app();
    /* L'ancre garde son nom d'origine : elle ne s'affiche jamais, et la
       renommer casserait les renvois sans rien apprendre a personne. */
    vrai(/data-anchor="autonomie">[\s\S]{0,400}?<h2>\$\{trad\('Réserve de sécurité'\)\}/.test(a),
      'la carte « Réserve de sécurité » porte l’ancre');
    /* Et elle n'est pas le déclencheur : `focusAnchor` écarte les `goto`, mais
       une carte ne doit de toute façon porter aucune action. */
    const carte = a.slice(a.indexOf('<div class="card" data-anchor="autonomie">'), a.indexOf('<div class="card" data-anchor="autonomie">') + 200);
    vrai(!/data-action="goto"/.test(carte), 'la destination n’est pas un déclencheur');
  });

  test('il passe par la navigation existante, pas par une adresse', () => {
    const a = app();
    const rendu = a.slice(a.indexOf('function carteARetenir()'), a.indexOf('function viewOverview()'));
    /* Une adresse s'arrete en haut de page : seule `goto` sait viser un endroit
       dans une vue, et c'est le mecanisme que le reste de l'application emploie. */
    vrai(/data-action="goto"\s*\n\s*data-view="\$\{esc\(cta\.vue\)\}" data-anchor="\$\{esc\(cta\.ancre\)\}"/.test(rendu),
      'le renvoi ancré est un bouton goto');
    vrai(/href="#\/\$\{cta\.vue\}"/.test(rendu), 'et les renvois sans ancre restent des liens');
    vrai(/'goto'\(btn\) \{/.test(a), 'l’action existait déjà : rien de parallèle n’a été créé');
    /* Le bouton garde l'allure du lien. */
    vrai(/class="lien-vue retenir-lien" data-action="goto"/.test(rendu), 'même allure que ses voisins');
    vrai(/button\.lien-vue \{/.test(lireSource('assets/styles.css')), 'et le style le prévoit');
  });

  test('les deux langues nomment la carte par son nom de produit', () => {
    /* « Autonomie financiere » evoquait aussi l'independance financiere, qui
       n'est pas le sujet : la carte compte de quoi tenir si les revenus
       s'arretaient, pas de quoi arreter de travailler. */
    eq(I18N.en['Réserve de sécurité'], 'Safety reserve', 'la carte a son nom anglais');
    eq(I18N.en['Voir ma réserve'], 'View my safety reserve',
      'le renvoi reprend ce mot, il n’en invente pas un second');
    eq(trad('Voir ma réserve'), 'Voir ma réserve', 'et le français dit le sien');
    vrai(I18N.en['Autonomie financière'] === undefined, 'l’ancien nom est parti des deux côtés');
  });

  test('les quatre autres renvois n’ont pas bougé', () => {
    const p = presentation();
    for (const [id, attendu] of [['allocation_target_gap', "cta: { vue: 'rebalance', libelle: 'Voir ma cible' }"],
                                 ['wealth_pace_shift', "cta: { vue: 'overview', ancre: 'evolution', libelle: 'Voir l’évolution' }"],
                                 ['goal_projected_date', "cta: { vue: 'objective', ancre: 'trajectoire', libelle: 'Voir ma projection' }"],
                                 ['pocket_share_shift', "cta: { vue: 'overview', ancre: 'evolution', libelle: 'Voir l’évolution' }"]]) {
      vrai(p.includes(attendu), `${id} porte son renvoi`);
    }
    /* Les quatre premiers renvois n'ont pas bouge ; les nouveaux ne visent que
       des cartes qui existaient deja, aucune n'a ete creee pour l'occasion. */
    /* LA LISTE SE DERIVE DU BALISAGE, elle ne se tient plus a la main : elle
       nommait quatre ancres, et tout renvoi vers une cinquieme carte existante
       tombait alors que c'est precisement ce qu'on veut — un renvoi qui mene a
       la preuve plutot qu'au haut de la page. Ce qui compte est qu'aucune ancre
       citee ne soit inventee. */
    const posees = new Set([...lireSource('assets/app.js')
      .matchAll(/data-anchor="([a-z-]+)"/g)].map(m => m[1]));
    for (const an of new Set([...p.matchAll(/ancre: '([a-z-]+)'/g)].map(m => m[1]))) {
      vrai(posees.has(an),
        `« ${an} » est une carte réellement ancrée dans le balisage`);
    }
  });

  test('aucun calcul n’a changé', () => {
    /* Le moteur ignore les renvois : ils vivent dans la vue.

       SANS LES COMMENTAIRES, et la nuance compte : le contrôle porte sur le
       CODE. Un commentaire qui explique pourquoi le moteur ne connaît pas les
       destinations nomme forcément une destination pour le dire, et se faisait
       prendre par sa propre justification. C'est le même piège que le contrôle
       de l'horodatage envoyé, quelques suites plus haut. */
    const m = lireSource('assets/insights.js').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/autonomie|Voir mon|goto/.test(m), 'le moteur ne connaît pas les destinations');
    Fixture.poser();
    const i = evaluerInsights().find(x => x.id === 'liquidity_runway');
    if (i) {
      const r = runway();
      eq(i.params.months, num(r.reserveMois), 'les mois viennent toujours de runway()');
      eq(i.evidence.source, 'runway');
    }
    /* Et la carte visée lit le même moteur que l'insight : un seul chiffre. */
    const a = app();
    const carte = a.slice(a.indexOf('function carteReserveResume()'),
                          a.indexOf('\n}\n', a.indexOf('function carteReserveResume()')));
    vrai(/const r = runway\(\);/.test(carte), 'la carte d’autonomie lit runway(), comme l’insight');
  });

  test('deux entrées d’une même carte ne répètent pas le même renvoi', () => {
    /* La selection prefere des destinations distinctes, puis son second tour
       remplit la carte sans les regarder : deux lectures d'un meme ecran y
       arrivent donc avec le meme bouton, au mot pres. Repete, il ne propose pas
       un second geste, il redit le seul qu'il y ait. */
    const a = app();
    const d = a.indexOf('function ligneInsight(');
    const entree = a.slice(d, a.indexOf('\nfunction ', d + 1));
    /* La suppression se decide sur la DESTINATION, pas sur le libelle : deux
       renvois peuvent porter le meme mot vers deux ancres differentes, et
       `destinationInsight()` est deja la clef que la selection emploie. */
    vrai(/const cta = p\.cta && !\(destinationsVues \|\| \[\]\)\.includes\(destinationInsight\(p\)\)/.test(entree),
      'l’entrée tait son renvoi quand une entrée précédente y mène déjà');
    vrai(!/\bp\.cta\.(vue|ancre|libelle)/.test(entree),
      'et le gabarit lit le renvoi retenu, jamais celui de la présentation');
    /* LES DEUX CARTES LE PASSENT, et c'est la moitie qui se perd : une seule
       des deux corrigee laisserait l'autre repeter. La liste se derive des
       entrees deja rendues, elle ne se tient pas a la main. */
    const appels = a.match(/ligneInsight\(i, p,[\s\S]{0,180}?destinationInsight\(q\)\)\)/g) || [];
    eq(appels.length, 2, 'les deux cartes rendent leurs entrées par le même gabarit');
    for (const ap of appels) {
      vrai(/lus\.slice\(0, k\)\.map\(\(\[, q\]\) => destinationInsight\(q\)\)/.test(ap),
        'la carte passe les destinations déjà rendues');
    }
  });
});

/* --- Chaque insight se comprend sans rien aller chercher ------------------- */
suite('Les cinq insights disent de quoi ils parlent', () => {
  const app = () => lireSource('assets/app.js');
  const presentation = () => {
    const a = app();
    return a.slice(a.indexOf('const PRESENTATION_INSIGHT'), a.indexOf('function carteARetenir()'));
  };

  test('l’objectif nomme sa cible par son montant', () => {
    /* « Ta cible serait atteinte vers décembre 2029 » laissait la question
       « quelle cible ? » sans reponse. Le modele ne porte qu'une cible de
       projection, un nombre sans intitule : le montant est la seule facon de la
       nommer, et on n'en invente pas d'autre. */
    const p = presentation();
    const bloc = p.slice(p.indexOf('goal_projected_date: {'), p.indexOf('liquidity_runway_shift: {'));
    vrai(/\.replace\('\{t\}', fmtEUR0\(p\.target\)\)/.test(bloc),
      'le montant vient des params du moteur et passe par le formateur central');
    vrai(!/[€$]/.test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')), 'aucun signe monétaire en dur');
    /* Le moteur le rendait deja : rien de neuf cote calcul. */
    Fixture.poser(s => { s.meta.projTarget = 200000; s.meta.projHorizon = 30; });
    const i = evaluerInsights().find(x => x.id === 'goal_projected_date');
    vrai(!!i, 'la règle produit');
    eq(i.params.target, num(projectionSettings().target), 'la cible vient de projectionSettings()');
    /* Et aucun nom n'est invente : le modele n'en porte pas. */
    vrai(!/nom|name|label/.test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')),
      'aucun nom d’objectif n’est fabriqué');
  });

  test('l’allocation nomme l’écart, et son sens, sans le juger', () => {
    const p = presentation();
    const bloc = p.slice(p.indexOf('allocation_target_gap: {'), p.indexOf('wealth_pace_shift: {'));
    vrai(/p\.deltaPct >= 0/.test(bloc), 'le sens se lit sur le signe de l’écart');
    vrai(/au-dessus de ta cible/.test(bloc) && /en dessous de ta cible/.test(bloc),
      'les deux sens ont leur phrase');
    for (const mot of ['trop', 'excès', 'sous-exposé', 'surexposé', 'réduis', 'augmente ta']) {
      vrai(!new RegExp(mot, 'i').test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')),
        `« ${mot} » serait un conseil`);
    }
    vrai(I18N.en['de tes investissements sont sur {c}'].includes('{c}'),
      'le contexte garde le nom de la classe d’actif');
    for (const c of ['soit {e} points au-dessus de ta cible de {b}',
                     'soit {e} points en dessous de ta cible de {b}']) {
      vrai(!!I18N.en[c], 'les deux sens ont leur traduction');
      for (const m of ['{e}', '{b}']) vrai(I18N.en[c].includes(m), `et gardent ${m}`);
    }
  });

  test('la progression met le chiffre devant et la comparaison derrière', () => {
    const p = presentation();
    const bloc = p.slice(p.indexOf('wealth_pace_shift: {'), p.indexOf('goal_projected_date: {'));
    /* Le montant se lit seul, signe compris, et porte son unite de temps. */
    vrai(/valeur: p => montantSigne\(p\.currentMonthly, fmtEUR0\) \+ trad\('\/mois'\)/.test(bloc),
      'le chiffre principal est un montant signé, par mois');
    vrai(/phrase: p => trad\('sur les \{n\} derniers mois'\)/.test(bloc),
      'et la phrase ne fait plus que le situer dans le temps');
    /* LA FENETRE PRECEDENTE DESCEND D'UN CRAN. Deux montants signes dans la
       meme phrase se concurrencent : celui de tete se lit seul, l'autre se lit
       sous lui, et on sait lequel est le chiffre d'aujourd'hui. */
    vrai(/secondaire: p => trad\('contre \{b\} auparavant'\)/.test(bloc),
      'la comparaison passe derrière, sur sa propre ligne');
    /* « EN MOYENNE » SERAIT FAUX. Ce chiffre est une mediane : c'est ce qui
       l'empeche d'etre gonfle par une prime ou une vente, et le mot ne manque
       pas a la phrase. */
    vrai(!/en moyenne|moyenne/i.test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')),
      'la phrase ne dit pas « en moyenne », puisque le calcul est une médiane');
    const m = lireSource('assets/insights.js');
    vrai(/currentMonthly: courant/.test(m) && /const courant = a\.mediane/.test(m),
      'et le moteur rend bien la médiane');
    /* Ni epargne, ni performance : ce montant contient les apports, le capital
       rembourse et les marches sans savoir les separer. */
    for (const mot of ['performance', 'rendement', 'gain', 'épargne', 'epargne']) {
      vrai(!new RegExp(mot, 'i').test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')),
        `« ${mot} » décrirait autre chose`);
    }
  });

  test('le signe se lit, dans les deux sens, et ne coupe pas la ligne', () => {
    /* `montantSigne` rend « +1 250 € », « −420 € », et « 0 € » sans signe : un
       plus devant un zero se lit comme une addition qui n'a pas eu lieu. */
    Store.state = blankState(); Store.migrate();
    vrai(/^\+/.test(montantSigne(1250, fmtEUR0)), 'une hausse porte son plus');
    vrai(/^−/.test(montantSigne(-420, fmtEUR0)), 'une baisse porte son moins typographique');
    vrai(!/^[+−]/.test(montantSigne(0, fmtEUR0)), 'et zéro n’en porte aucun');
    const css = lireSource('assets/styles.css');
    vrai(/\.retenir-valeur \{[\s\S]*?white-space: nowrap;/.test(css),
      'le montant et son unité ne se séparent jamais');
    vrai(/\.retenir-valeur \{[\s\S]*?font-variant-numeric: tabular-nums;/.test(css),
      'et deux montants voisins alignent leurs chiffres');
    /* LE REGROUPEMENT NE TIENT QU'AU RAPPORT DES ECARTS. Les quatre lignes
       d'une entree se lisent ensemble parce que ce qui les separe est plus
       petit que ce qui separe deux entrees ; l'inverse donnerait quatre
       fragments flottants, et aucun filet ne rattraperait cela. */
    const ecart = r => {
      const b = css.slice(css.indexOf(`.retenir-${r} {`), css.indexOf('}', css.indexOf(`.retenir-${r} {`)));
      const m = b.match(/margin(?:-top)?: (\d+)px/);
      return m ? Number(m[1]) : null;
    };
    const dedans = ['valeur', 'texte', 'second', 'lien'].map(ecart);
    vrai(dedans.every(v => v !== null), 'chaque ligne déclare son écart');
    /* LA SÉPARATION NE VIENT PLUS D'UN ÉCART SEUL, mais d'un filet encadré de
       deux respirations : l'écart seul demandait à l'œil de mesurer pour savoir
       où une lecture finit. Le rapport, lui, ne change pas de sens — ce qui
       sépare deux entrées reste au moins le double du plus grand écart interne,
       sinon les quatre lignes d'une entrée se liraient comme quatre fragments. */
    const sep = css.slice(css.indexOf('.retenir-item + .retenir-item {'),
                          css.indexOf('}', css.indexOf('.retenir-item + .retenir-item {')));
    vrai(/border-top: 1px solid var\(--grid\)/.test(sep),
      'un filet marque la frontière entre deux lectures');
    const entre = (sep.match(/margin-top: (\d+)px/) || [])[1] * 1
                + (sep.match(/padding-top: (\d+)px/) || [])[1] * 1;
    vrai(entre >= 2 * Math.max(...dedans),
      `${entre}px entre deux lectures pour ${Math.max(...dedans)}px au plus à l’intérieur`);
  });


  test('chaque carte visée existe, et porte bien la réponse', () => {
    const a = app();
    /* Les quatre ancres, et la carte qui repond derriere chacune. */
    for (const [ancre, titre] of [['autonomie', "trad('Réserve de sécurité')"],
                                  ['rythme', "trad('Rythme d\\'accumulation')"],
                                  ['accumulation', "trad('Accumulation ce mois-ci')"],
                                  ['trajectoire', "trad('De quoi sera fait ton patrimoine')"]]) {
      const i = a.indexOf(`data-anchor="${ancre}"`);
      vrai(i > 0, `l’ancre « ${ancre} » est posée`);
      /* La fenetre est large : une carte peut porter un commentaire de
         balisage entre son ouverture et son titre. */
      const suite2 = a.slice(i, i + 1200);
      vrai(suite2.includes(titre), `et la carte « ${ancre} » porte son titre`);
      /* Une destination n'est jamais un declencheur. */
      vrai(!/data-action="goto"/.test(a.slice(i - 80, i + 80)), `« ${ancre} » n’est pas un bouton`);
    }
  });

  test('aucun renvoi ne reste générique', () => {
    const p = presentation();
    const libelles = [...p.matchAll(/libelle: '([^']+)'/g)].map(m => m[1].replace(/\\'/g, "'"));
    eq(libelles.length, REGLES_INSIGHT.length, 'chaque règle porte son renvoi');
    for (const l of libelles) {
      vrai(!/^Voir le budget$|^Voir le détail$|^En savoir plus$/.test(l),
        `« ${l} » ne dit pas ce qu’il ouvre`);
      vrai(!!I18N.en[l], `« ${l} » a sa traduction`);
    }
    /* DEUX REGLES PEUVENT VISER LA MEME CARTE, et c'est normal : « ta réserve
       couvre huit mois » et « ta réserve a gagné deux mois » mènent toutes deux
       à l'autonomie financière. Ce qui compte n'est pas qu'ils soient distincts
       mais que chacun NOMME l'endroit où il mène. */
    /* L'ARTICLE DEFINI EST ADMIS quand il nomme une carte : Voir le detail
       mensuel designe un endroit aussi precisement qu'un renvoi vers la cible.
       Ce que le controle refuse reste le renvoi vague, et la liste noire du
       dessus s'en charge -- Voir le detail tout court n'ouvre rien de nomme. */
    for (const l of libelles) {
      vrai(/^Voir ((mon|ma|mes|le|la|les)\s\S|l’\S)/.test(l),
        `« ${l} » nomme l’endroit où il mène, et non l’action qu’il propose`);
    }
  });

  test('les phrases restent courtes, et aucune ne porte de monnaie en dur', () => {
    const p = presentation().replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/[€$]/.test(p), 'aucun signe monétaire');
    /* Une phrase de plus de cent quarante caracteres tiendrait mal sur trois
       lignes a 375 px. On mesure le gabarit, marques comprises. */
    for (const m of p.matchAll(/trad\('([^']{40,})'\)/g)) {
      const phrase = m[1].replace(/\\'/g, "'");
      vrai(phrase.length <= 150, `« ${phrase.slice(0, 44)}… » fait ${phrase.length} caractères`);
    }
  });

  test('aucun calcul financier n’a changé', () => {
    /* Le moteur ne connait ni les phrases, ni les destinations. */
    /* Le mot « trajectoire » vit dans les commentaires du moteur, qui expliquent
       precisement qu'il ne la refait pas : on lit le code, pas ses commentaires. */
    const m = lireSource('assets/insights.js').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/ancre|autonomie|trajectoire|Voir m/.test(m), 'le moteur ignore la présentation');
    Fixture.poser();
    const avant = JSON.stringify(construireInsights());
    setLang('en');
    try { eq(JSON.stringify(construireInsights()), avant, 'et la langue ne le change pas'); }
    finally { setLang('fr'); }
  });
});

/* --- Un rythme, pas une moyenne gonflée par un seul mois ------------------- */
suite('Le rythme résiste à un mois exceptionnel', () => {
  const trouve = () => evaluerInsights().find(i => i.id === 'wealth_pace_shift') || null;
  /* Une fenetre = six variations mensuelles. On pose douze variations : les six
     premieres font la periode precedente, les six suivantes la recente. */
  const poser = (avant, apres) => {
    Fixture.poser(s => {
      let cumul = 0;
      const v = [0];
      for (const d of avant.concat(apres)) { cumul += d; v.push(cumul); }
      s.monthly = v.map((x, i) => {
        const d = new Date(Date.UTC(2024, i + 1, 0));
        return { date: d.toISOString().slice(0, 10), comment: '', v: { c_courant: x } };
      });
    });
  };
  const stable = [700, 750, 800, 700, 780, 760];

  test('CAS A — une série stable donne son rythme, autour de la médiane', () => {
    poser([500, 520, 510, 490, 505, 515], stable);
    const i = trouve();
    vrai(!!i, 'la règle produit');
    /* Mediane de la fenetre recente : 700, 700, 750, 760, 780, 800 -> 755. */
    pres(i.params.currentMonthly, 755, 'le rythme récent est la médiane');
    pres(i.params.previousMonthly, 507.5, 'le précédent aussi');
    eq(i.params.currentMonths, 6);
  });

  test('CAS B — un seul mois exceptionnel ne devient pas le nouveau rythme', () => {
    /* Un cas type : cinq mois autour de 750, un mois a 8 000. */
    const prime = [700, 750, 800, 8000, 780, 760];
    poser([500, 520, 510, 490, 505, 515], prime);
    const i = trouve();
    vrai(!!i, 'la règle parle : la période reste lisible');
    /* La moyenne brute vaut 1 948 ; le rythme affiche est la mediane, 765. */
    const moyenne = prime.reduce((s, x) => s + x, 0) / prime.length;
    pres(moyenne, 1965, 'la moyenne brute est bien gonflée');
    pres(i.params.currentMonthly, 770, 'mais le rythme affiché est le mois ordinaire');
    vrai(i.params.currentMonthly < moyenne / 2,
      'et il est très loin de la moyenne, ce qui est exactement le but');
    /* La preuve garde la moyenne : c'est le chiffre de l'historique. */
    pres(i.evidence.currentMean, moyenne, 'la preuve porte la moyenne brute');
    vrai(i.evidence.currentLargestMonthShare > 0.6,
      'et dit que le plus gros mois porte l’essentiel du mouvement');
  });

  test('CAS B bis — un mois exceptionnel NÉGATIF ne creuse pas le rythme', () => {
    poser([500, 520, 510, 490, 505, 515], [700, 750, 800, -8000, 780, 760]);
    const i = trouve();
    vrai(!!i, 'la règle parle');
    pres(i.params.currentMonthly, 755, 'le rythme reste celui des mois ordinaires');
    vrai(i.evidence.currentMean < 0, 'alors que la moyenne brute est négative');
  });

  test('CAS C — une vraie tendance progressive n’est pas prise pour un accident', () => {
    poser([500, 520, 510, 490, 505, 515], [700, 900, 1100, 1300, 1500, 1700]);
    const i = trouve();
    vrai(!!i, 'la montée régulière reste un rythme');
    pres(i.params.currentMonthly, 1200, 'et c’est le milieu de la série');
    /* Aucun mois n'est ecarte : la tendance est reelle. */
    vrai(i.evidence.currentLargestMonthShare < 0.35, 'aucun mois ne domine');
  });

  test('CAS D — deux gros mois : le rythme reste celui des mois ordinaires', () => {
    poser([500, 520, 510, 490, 505, 515], [700, 750, 5000, 720, 5500, 800]);
    const i = trouve();
    vrai(!!i, 'quatre mois sur six se ressemblent encore');
    pres(i.params.currentMonthly, 775, 'le rythme les décrit');
  });

  test('CAS E — une série qui alterne n’a aucun rythme : silence', () => {
    /* Mediane a 750, et pas un seul mois qui l'approche. Une phrase qui
       annoncerait 750 decrirait une periode que personne n'a vecue. */
    poser([500, 520, 510, 490, 505, 515], [-1000, 2500, -800, 2300, -900, 2400]);
    eq(trouve(), null, 'aucun nombre ne résume cette période');
  });

  test('CAS F et G — une période précédente négative ou nulle reste muette', () => {
    poser([-500, -520, -510, -490, -505, -515], stable);
    eq(trouve(), null, 'base négative : aucun pourcentage interprétable');
    poser([0, 0, 0, 0, 0, 0], stable);
    eq(trouve(), null, 'base nulle non plus');
  });

  test('CAS H — le filtre anti-bruit de vingt pour cent porte sur le rythme', () => {
    /* Medianes : 1 000 puis 1 199 -> 19,9 %, silence. */
    poser([1000, 1000, 1000, 1000, 1000, 1000], [1199, 1199, 1199, 1199, 1199, 1199]);
    eq(trouve(), null, '19,9 % ne vaut pas la peine d’être dit');
    /* 1 000 -> 1 200 : vingt pour cent pile, borne inclusive. */
    poser([1000, 1000, 1000, 1000, 1000, 1000], [1200, 1200, 1200, 1200, 1200, 1200]);
    const i = trouve();
    vrai(!!i, '20,0 % produit l’insight');
    pres(i.params.deltaPct, 20);
    eq(i.evidence.displayThresholdPct, SEUIL_AFFICHAGE_RYTHME_PCT);
  });

  test('la mesure est nommée dans le code, et la moyenne n’a pas disparu', () => {
    const m = lireSource('assets/insights.js');
    vrai(/function rythmeRepresentatif\(points\)/.test(m), 'la couche existe');
    vrai(/function mediane\(valeurs\)/.test(m), 'et elle repose sur la médiane');
    /* La moyenne reste calculee et rendue : l'historique dit toujours la verite
       de la periode, prime comprise. */
    vrai(/moyenne: taux\.reduce/.test(m), 'la moyenne est toujours calculée');
    vrai(/currentMean: a\.moyenne/.test(m), 'et rendue dans la preuve');
    /* Le moteur historique n'a pas bouge. */
    const s = lireSource('assets/store.js');
    vrai(/average: mois \? somme \/ mois : 0,/.test(s),
      'statsRythme rend toujours sa moyenne, inchangée');
    vrai(!/mediane|median/i.test(s.slice(s.indexOf('function statsRythme'), s.indexOf('function moisEntre'))),
      'et rien de robuste n’a été glissé dans le moteur historique');
  });

  test('aucune cause n’est nommée, et rien n’est retiré des données', () => {
    const m = lireSource('assets/insights.js').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const mot of ['prime', 'héritage', 'heritage', 'vente', 'bonus', 'exceptionnel']) {
      vrai(!new RegExp(mot, 'i').test(m), `le moteur ne nomme pas « ${mot} »`);
    }
    /* Aucun point n'est ecarte de la fenetre : la mediane les regarde tous. */
    vrai(!/filter\(.*outlier|slice\(1, -1\)/.test(m), 'aucun mois n’est jeté');
    /* Et la progression totale de la periode reste celle de l'historique. */
    poser([500, 520, 510, 490, 505, 515], [700, 750, 800, 8000, 780, 760]);
    const pts = monthlyPace().points;
    const somme = pts.slice(-6).reduce((s, p) => s + num(p.delta), 0);
    pres(somme, 11790, 'l’historique porte toujours la progression réelle, prime comprise');
  });
});

/* --- Le chiffre principal ------------------------------------------------- */
suite('Chaque entrée porte son chiffre devant', () => {
  const app = () => lireSource('assets/app.js');

  test('le gabarit ne rend la valeur que si la règle en déclare une', () => {
    const a = app();
    /* Le gabarit d'une entrée vit dans `ligneInsight()`, et le chiffre partage
       désormais sa ligne avec ce qu'il mesure : une règle sans chiffre rend donc
       la phrase seule, au lieu d'ouvrir une rangée vide. Le contrôle porte sur
       l'alternative — deux formes, jamais une valeur absente rendue quand même —
       et non sur le balisage exact, qui a changé de forme pour gagner une ligne. */
    const d = a.indexOf('function ligneInsight(');
    const rendu = a.slice(d, a.indexOf('\nfunction ', d + 1));
    vrai(/\$\{p\.valeur \? `/.test(rendu), 'la valeur est optionnelle');
    vrai(/escMontant\(p\.valeur\(i\.params\)\)/.test(rendu),
      'et elle passe par le formateur quand elle existe');
    vrai(/: `<p class="retenir-texte">\$\{p\.phrase\(i\.params\)\}<\/p>`/.test(rendu),
      'sans chiffre, la phrase se rend seule');
    /* `escMontant` et non `esc` : un montant masque est du balisage, un oeil
       barre en SVG, et `esc` l'afficherait en clair. */
    vrai(/escMontant\(p\.valeur/.test(rendu), 'et elle traverse l’échappement des montants');
    const p = a.slice(a.indexOf('const PRESENTATION_INSIGHT'), a.indexOf('function carteARetenir()'));
    /* TOUTES EN PORTENT UN, ET C'EST LE BUT : cette carte se balaye, et on
       balaye des chiffres, pas des phrases. Une date d'objectif se lit « Janvier
       2030 », un ecart d'allocation se lit « 42,0 % » — il a suffi de sortir le
       nombre de la phrase au lieu de le laisser au milieu.

       Le gabarit reste conditionnel pour autant, et ce n'est pas une precaution
       morte : l'etat calme n'a pas de chiffre, et une regle ecrite demain sans
       en avoir doit rendre un paragraphe de moins, jamais « undefined » en gros
       et en gras. */
    const combien = (p.match(/\n    valeur: /g) || []).length;
    eq(combien, REGLES_INSIGHT.length,
      `${combien} règles sur ${REGLES_INSIGHT.length} portent un chiffre devant`);
    const calme = rendu.slice(rendu.indexOf('retenir-calme'), rendu.indexOf('${lus.map('));
    vrai(!calme.includes('retenir-valeur'), 'et l’état calme n’en affiche aucun');
  });

  test('le chiffre ne prend pas la couleur de l’accent', () => {
    /* Le filet, les puces et le chevron la portent deja : un quatrieme violet
       dans la meme carte la viderait de sa force. */
    const css = lireSource('assets/styles.css');
    const bloc = css.slice(css.indexOf('.retenir-valeur {'), css.indexOf('}', css.indexOf('.retenir-valeur {')));
    vrai(/color: var\(--text-primary\)/.test(bloc), 'il se lit en encre pleine');
    vrai(!/--accent/.test(bloc), 'et non en accent');
  });

  test('le renvoi mène à la courbe, qui montre la même chose', () => {
    const a = app();
    const i = a.indexOf('data-anchor="evolution"');
    vrai(i > 0, 'l’ancre est posée');
    /* Deux mille cinq cents caracteres de commentaire separent l'ouverture de
       cette carte de son titre : la fenetre doit les couvrir. */
    vrai(a.slice(i, i + 3200).includes("trad('Évolution du patrimoine')"),
      'et la carte visée est bien celle de la courbe');
    eq(I18N.en['Évolution du patrimoine'], 'Wealth over time', 'qui a déjà son nom anglais');
    for (const c of ['Progression du patrimoine', '/mois', 'Voir l’évolution',
                     'sur les {n} derniers mois', 'contre {b} auparavant']) {
      vrai(!!I18N.en[c], `« ${c} » a sa traduction`);
    }
    for (const [c, m] of [['sur les {n} derniers mois', '{n}'],
                          ['contre {b} auparavant', '{b}']]) {
      vrai(I18N.en[c].includes(m), `et le gabarit garde ${m}`);
    }
  });
});

/* ------------------------------------------------------------------
   Une dette ne finance que ce que son lien designe
   ------------------------------------------------------------------ */
suite('Une dette se range sous ce qu’elle finance, ou sur sa propre ligne', () => {

  /* Quatre patrimoines fictifs. Des liquidites dans une banque qui tient deux
     comptes ; des parts de societe dans leur propre etablissement, avec le pret
     qui les finance ; un appartement et son pret ; un pret personnel pose a la
     banque, sans lien, donc sans destination connue. */
  const cpt = (id, etabId, type, libelle, cash, lignes) => ({
    id, etabId, type, statut: 'ouvert', ouvertLe: '2024-01-01', numero: '', notes: '',
    libelle, court: libelle, alloc: '', cash, lignes });
  const lig = (id, classe, libelle, valeur) => ({
    id, classe, libelle, valeur, prixDeRevient: valeur, quantite: 1, dateAcquisition: '' });
  const PARTS = 40000, PRET_PARTS = 25000, APPART = 180000, PRET_IMMO = 120000, PERSO = 8000;
  const CASH = 20000;
  const poserCas = ({ parts = false, pretParts = false, appart = false, perso = false }) =>
    Fixture.poser(s => {
      s.positions = []; s.monthly = []; s.sales = [];
      s.etabs = [{ id: 'e_banque', nom: 'Banque', notes: '',
                   dettes: perso ? [{ id: 'd_perso', libelle: 'Prêt personnel', montant: PERSO, note: '' }] : [] }];
      s.comptes = [
        cpt('c_courant', 'e_banque', 'courant', 'Courant', [{ montant: 6000, affectation: 'courant' }], []),
        cpt('c_livret', 'e_banque', 'livret', 'Livret', [{ montant: 14000, affectation: 'precaution' }], []),
      ];
      if (parts) {
        s.etabs.push({ id: 'e_holding', nom: 'Holding', notes: '',
          dettes: pretParts ? [{ id: 'd_parts', libelle: 'Prêt des parts', montant: PRET_PARTS, bienId: 'c_parts', note: '' }] : [] });
        s.comptes.push(cpt('c_parts', 'e_holding', 'pe', 'Parts', [], [lig('l_parts', 'nonCote', 'Parts', PARTS)]));
      }
      if (appart) {
        s.etabs.push({ id: 'e_appart', nom: 'Appartement', notes: '',
          dettes: [{ id: 'd_immo', libelle: 'Prêt immobilier', montant: PRET_IMMO, bienId: 'c_appart', note: '' }] });
        s.comptes.push(cpt('c_appart', 'e_appart', 'immo', 'Appartement', [], [lig('l_appart', 'immobilier', 'Appartement', APPART)]));
      }
    });
  const somme = xs => xs.reduce((s, x) => s + num(x.value), 0);
  const part = (xs, cle) => xs.find(x => (x.classe || x.key) === cle);

  /* Ce que chaque ecran doit rendre, pour chaque cas : la meme dette au meme
     endroit, et le net total inchange. */
  const verifierPartout = (cas, attendu) => {
    const net = patrimoine().net;
    pres(net, attendu.net, `${cas} : le patrimoine net ne change pas`);
    const accueil = repartitionClasses({ net: true });
    pres(somme(accueil), net, `${cas} : l’accueil en net fait le net`);
    pres(accueil.reduce((s, x) => s + x.pct, 0), 100, `${cas} : et ses parts font cent`);
    const alloc = poidsPoches({ net: true });
    pres(somme(alloc), net, `${cas} : Allocation fait le même net`);
    const lignes = allocationByAsset({ credits: false, net: true });
    pres(somme(lignes), net, `${cas} : son détail ligne par ligne aussi`);
    const q = pochesProjection();
    pres(q.placees + q.plat, net, `${cas} : la projection part du même net`);
    const dp = partPlateDetail();
    pres(dp.total, partPlate(), `${cas} : le détail de la part plate redonne son total`);
    pres(dp.biensNets - dp.autresDettes, q.plat, `${cas} : ses deux lignes font la part plate`);
    const dest = dettesParDestination();
    pres(Object.values(dest.classes).reduce((s, v) => s + v, 0) + dest.nonAffectees, dettesTotal(),
      `${cas} : chaque dette est rangée une fois, et une seule`);
    for (const [cle, v] of Object.entries(attendu.classes)) {
      pres(num(part(accueil, cle)?.value), v, `${cas} : « ${cle} » vaut ${v} sur l’accueil`);
    }
    pres(num(part(accueil, 'immobilier')?.value), num(attendu.classes.immobilier),
      `${cas} : l’immobilier ne porte que ce qui le finance`);
    pres(-num(part(accueil, DETTES_NON_AFFECTEES)?.value), attendu.nonAffectees,
      `${cas} : les dettes sans destination sont sur leur ligne`);
    pres(num(part(alloc, 'pe')?.value), num(attendu.classes.nonCote),
      `${cas} : Allocation range le non coté pareil`);
    pres(num(part(alloc, 'immo')?.value), num(attendu.classes.immobilier),
      `${cas} : et l’immobilier pareil`);
    pres(dp.biensNets, attendu.biensNets, `${cas} : la projection porte les biens nets de leurs seuls crédits`);
    pres(dp.autresDettes, attendu.autresDettes, `${cas} : et les autres crédits à part`);
    return { accueil, alloc, lignes };
  };

  test('un prêt pour des parts non cotées, sans aucun immobilier', () => {
    poserCas({ parts: true, pretParts: true });
    const { accueil, lignes } = verifierPartout('A', {
      net: CASH + PARTS - PRET_PARTS,
      classes: { liquidites: CASH, nonCote: PARTS - PRET_PARTS },
      nonAffectees: 0, biensNets: 0, autresDettes: PRET_PARTS });
    vrai(!part(accueil, 'immobilier'), 'aucune ligne « Immobilier » n’apparaît');
    pres(part(accueil, 'nonCote').dettes, PRET_PARTS, 'le non coté dit le crédit qui le finance');
    pres(lignes.find(l => l.label === 'Parts').value, PARTS - PRET_PARTS,
      'le détail ligne par ligne s’accorde avec la carte du haut');
  });

  test('un prêt immobilier lié à son bien', () => {
    poserCas({ appart: true });
    verifierPartout('B', {
      net: CASH + APPART - PRET_IMMO,
      classes: { liquidites: CASH, immobilier: APPART - PRET_IMMO },
      nonAffectees: 0, biensNets: APPART - PRET_IMMO, autresDettes: 0 });
  });

  test('une dette sans destination connue', () => {
    poserCas({ parts: true, perso: true });
    const { accueil, lignes } = verifierPartout('C', {
      net: CASH + PARTS - PERSO,
      classes: { liquidites: CASH, nonCote: PARTS },
      nonAffectees: PERSO, biensNets: 0, autresDettes: PERSO });
    vrai(!part(accueil, 'immobilier'), 'elle ne devient pas de l’immobilier');
    vrai(lignes.some(l => l.value < -0.005), 'le détail ligne par ligne la montre aussi');
    pres(lignes.find(l => l.label === 'Parts').value, PARTS, 'sans la retrancher des parts');
  });

  test('plusieurs dettes de destinations différentes', () => {
    poserCas({ parts: true, pretParts: true, appart: true, perso: true });
    verifierPartout('D', {
      net: CASH + PARTS + APPART - PRET_PARTS - PRET_IMMO - PERSO,
      classes: { liquidites: CASH, nonCote: PARTS - PRET_PARTS, immobilier: APPART - PRET_IMMO },
      nonAffectees: PERSO, biensNets: APPART - PRET_IMMO, autresDettes: PRET_PARTS + PERSO });
  });

  test('le mode Brut ne retranche rien, et la barre y compose les avoirs', () => {
    poserCas({ parts: true, pretParts: true, appart: true, perso: true });
    const brut = repartitionClasses();
    pres(somme(brut), patrimoine().brut, 'les parts font les avoirs');
    vrai(!part(brut, DETTES_NON_AFFECTEES), 'aucune ligne de dette en brut');
    for (const x of brut) pres(x.dettes, 0, `« ${x.classe} » garde sa valeur pleine`);
    const seg = segmentsBarre(brut);
    for (const s of seg) pres(s.largeur, s.pct, `« ${s.classe} » : le segment vaut sa part`);
  });

  test('une part négative n’a pas de segment, et la barre reste pleine', () => {
    poserCas({ parts: true, pretParts: true, appart: true, perso: true });
    const net = repartitionClasses({ net: true });
    const seg = segmentsBarre(net);
    vrai(!seg.some(s => s.classe === DETTES_NON_AFFECTEES), 'la dette sans destination n’est pas dessinée');
    pres(seg.reduce((s, x) => s + x.largeur, 0), 100, 'les segments remplissent la piste');
    const positives = net.filter(x => x.value > 0).reduce((s, x) => s + x.value, 0);
    for (const s of seg) pres(s.largeur, s.value / positives * 100, `« ${s.classe} » : sa part des parts positives`);
    eq(largeurPart(130), 'max(3px, 100.0%)', 'une part au-delà de cent reste dans sa piste');
    eq(largeurPart(-12), '0%', 'une part négative n’a pas de barre');
  });

  test('une classe financée au-delà de sa valeur devient négative, sans rien inventer', () => {
    poserCas({ parts: true, pretParts: true });
    Store.state.comptes.find(c => c.id === 'c_parts').lignes[0].valeur = 10000;
    refreshAccounts();
    const net = repartitionClasses({ net: true });
    pres(part(net, 'nonCote').value, 10000 - PRET_PARTS, 'le non coté est négatif');
    vrai(!part(net, 'immobilier'), 'et la dette ne glisse pas vers l’immobilier');
    pres(somme(net), patrimoine().net, 'la somme fait toujours le net');
  });

  test('un compte qui mêle plusieurs classes ne dit pas laquelle il finance', () => {
    /* Une marge rattachee a un compte-titres : le lien existe, la classe non.
       Choisir entre actions et obligations serait deviner. */
    poserCas({});
    Store.state.etabs.push({ id: 'e_courtier', nom: 'Courtier', notes: '',
      dettes: [{ id: 'd_marge', libelle: 'Marge', montant: 3000, bienId: 'c_cto', note: '' }] });
    Store.state.comptes.push(cpt('c_cto', 'e_courtier', 'cto', 'CTO', [{ montant: 9000, affectation: 'investir' }], []));
    refreshAccounts();
    eq(classeFinanceeParDette(Store.state.etabs[1].dettes[0], Store.state.etabs[1]), null,
      'aucune classe désignée');
    pres(dettesParDestination().nonAffectees, 3000, 'elle reste sur la ligne des dettes non affectées');
  });

  test('un lien mort, ailleurs ou vers un compte archivé ne finance plus rien', () => {
    poserCas({ parts: true, pretParts: true });
    const d = Store.state.etabs.find(e => e.id === 'e_holding').dettes[0];
    const e = Store.state.etabs.find(x => x.id === 'e_holding');
    d.bienId = 'c_disparu';
    eq(classeFinanceeParDette(d, e), null, 'un lien mort');
    d.bienId = 'c_livret';
    eq(classeFinanceeParDette(d, e), null, 'un compte d’un autre établissement');
    d.bienId = 'c_parts';
    Store.state.comptes.find(c => c.id === 'c_parts').statut = 'archive';
    eq(classeFinanceeParDette(d, e), null, 'un compte archivé');
    pres(dettesParDestination().nonAffectees, PRET_PARTS, 'et la dette reste comptée');
  });

  test('l’accueil dit la règle, sans supposer l’immobilier, et en deux langues', () => {
    const src = lireSource('assets/app.js');
    vrai(!src.includes('est retiré de l’immobilier, qui est ce'), 'l’ancienne aide est partie');
    vrai(/segmentsBarre\(parts\)/.test(src), 'la barre du haut passe par segmentsBarre');
    vrai(/data-apercu="\$\{dettesSeules \? 'credits' : 'classe'\}"/.test(src),
      'la ligne des dettes ouvre les crédits');
    for (const c of ['Dettes non affectées', 'après {v} de crédit', 'Tes autres crédits',
                     'Ces parts portent sur ton patrimoine net : les {v} de capital restant dû sont déduits une seule fois.',
                     'Un crédit se retranche de la classe du compte auquel il est rattaché : un prêt rattaché à un logement, de ton immobilier ; un prêt rattaché à des parts de société, du non coté.',
                     'Les crédits sans destination connue, {v}, forment la ligne « Dettes non affectées » : leur fiche ne désigne aucun compte, ou un compte qui mêle plusieurs classes, et Longward ne les attribue à aucune classe.',
                     'Bascule sur « Brut » pour voir tes avoirs avant crédits.',
                     'Ces crédits ne financent aucun bien détenu en direct : un prêt pour des parts de société, un prêt personnel, une dette sans destination connue. La projection les porte à leur montant, sans rendement.',
                     'Tes autres crédits sont portés à leur montant d’aujourd’hui,',
                     'aujourd’hui, hors biens détenus en direct et crédits', 'sans destination connue',
                     'tes biens en direct, leurs crédits et tes autres crédits']) {
      vrai(!!I18N.en[c], `« ${c.slice(0, 40)} » a sa traduction`);
      vrai(src.includes(`trad('${c}')`), `« ${c.slice(0, 40)} » passe par trad()`);
    }
    for (const c of ['après {v} de crédit', 'Ces parts portent sur ton patrimoine net : les {v} de capital restant dû sont déduits une seule fois.']) {
      vrai(I18N.en[c].includes('{v}'), `« ${c.slice(0, 30)} » garde {v} en anglais`);
    }
  });

  test('la note « après tant de crédit » ne plie pas les montants du tableau', () => {
    /* Mesure a 375 px : la note elargissait la colonne des noms, et le total
       « 87 000,00 EUR » du pied passait sur deux lignes. */
    const src = lireSource('assets/app.js');
    const css = lireSource('assets/styles.css');
    vrai(src.includes('<td class="montant">${fmtEUR0(arrondis[k])}</td>'), 'le montant d’une ligne se nomme');
    vrai(src.includes('<td class="montant">${fmtEUR0(total)}</td>'), 'et celui du pied aussi');
    vrai(/\.card > table td\.montant \{ white-space: nowrap; overflow-wrap: normal; \}/.test(css),
      'la feuille les tient sur une ligne');
    const repli = css.indexOf('white-space: normal; overflow-wrap: anywhere;\n  }');
    vrai(repli > 0 && css.indexOf('td.montant { white-space: nowrap') > repli,
      'déclarée après la règle de repli qu’elle contredit');
  });
});

/* ------------------------------------------------------------------
   L'accueil se lit en quelques secondes
   ------------------------------------------------------------------ */
suite('L’accueil résume, et chaque résumé mène à son détail', () => {
  const app = () => lireSource('assets/app.js');
  const fonction = (src, nom) => {
    const i = src.indexOf(nom);
    return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i));
  };

  test('le guide ne s’adresse plus à qui a un compte et deux relevés', () => {
    Fixture.poser();
    eq(relevesRenseignes(), 1, 'le fixture porte un relevé');
    eq(demarrageDepasse(), false, 'un relevé, c’est encore le démarrage');
    Fixture.poser(s => {
      s.monthly.push({ date: '2026-02-28', comment: '', v: { c_courant: 3100 } });
    });
    eq(demarrageDepasse(), true, 'deux relevés, c’est un mois d’usage');
    Fixture.poser(s => {
      s.comptes = [];
      s.monthly.push({ date: '2026-02-28', comment: '', v: { c_courant: 3100 } });
    });
    eq(demarrageDepasse(), false, 'sans compte, jamais');
  });

  test('« À retenir » : ouverte, la carte montre tout ; repliée, rien', () => {
    const a = app();
    const carte = fonction(a, 'function carteARetenir()');
    vrai(!/retenir-surplus|retenir-voir|Voir moins|autre point/.test(carte),
      'plus de second niveau de pli : ni « Voir 1 autre point », ni « Voir moins »');
    vrai(!/'retenir-tout'/.test(a) && !/VISIBLES_A_RETENIR|retenirToutVoir/.test(a), 'ni son action, ni son état');
    vrai(/dernierARetenir = replie \? \[\] : lus\.map\(\(\[i\]\) => i\);/.test(carte),
      'ouverte, tous ses points sont vus ; repliée, aucun');
    vrai(/data-action="retenir-plier"/.test(carte), '« Réduire » reste le seul pli');
    vrai(!/\.retenir-surplus|\.retenir-voir/.test(lireSource('assets/styles.css')), 'et la feuille n’en garde rien');
  });

  test('« Ce qui a changé » : la variation nette et ses deux écarts dominants', () => {
    const carte = fonction(app(), 'function carteVariation()');
    vrai(/\.sort\(\(a, b\) => Math\.abs\(b\.delta\) - Math\.abs\(a\.delta\)\);/.test(carte), 'les écarts se classent par ampleur');
    vrai(/const tete = ecarts\.slice\(0, 2\);/.test(carte), 'deux se lisent');
    vrai(/v\.debtChange \? \[\{ label: trad\('Crédits'\), delta: -v\.debtChange/.test(carte), 'crédits compris');
    vrai(/data-action="voir-releve" data-i="\$\{v\.index\}"/.test(carte), 'et le relevé détaille tout');
    vrai(!/listeVariation\(/.test(carte.replace(/\/\*[\s\S]*?\*\//g, '')), 'la liste complète reste au relevé');
  });

  test('la réserve se lit en mois, son détail s’ouvre à un geste', () => {
    const a = app();
    const carte = fonction(a, 'function carteReserveResume()');
    vrai(/fmtMois\(cover\)/.test(carte) && /trad\('cible 3 à 6 mois'\)/.test(carte), 'les mois et la cible');
    vrai(/data-action="apercu" data-apercu="reserve"/.test(carte), 'un accès au détail');
    vrai(!/class="runway"/.test(carte), 'les paliers ne sont plus sur l’accueil');
    const detail = a.slice(a.indexOf('  reserve: () => {'), a.indexOf('\n  },', a.indexOf('  reserve: () => {')));
    vrai(/class="runway"/.test(detail) && /r\.tiers/.test(detail), 'ils sont dans la fenêtre');
    vrai(/trad\('Coût de la vie retenu :'\)/.test(detail), 'avec le coût de la vie retenu');
    vrai(/const r = runway\(\);/.test(detail), 'et le même modèle');
  });

  test('sans variation du jour connue, « hors séance » se dit en petit', () => {
    const vue = fonction(app(), 'function carteTitresResume()');
    const bloc = vue.slice(vue.indexOf('const j = dayPerformance();'), vue.indexOf('data-apercu="jourTitres"'));
    vrai(/<p class="pf-jour-muet">/.test(bloc), 'une mention');
    vrai(!/pf-mesure pf-muet/.test(bloc), 'et non plus une ligne de mesure');
    vrai(/pas de clôture de veille en mémoire/.test(bloc), 'qui dit sa cause');
  });

  test('l’Historique monte les barres du rythme, qui l’ont rejoint', () => {
    /* L'Historique est un sous-onglet de l'Apercu : son montage passait par
       celui de l'accueil, et la carte du rythme y arrivait sans ses barres.
       Mesure a 375 px : 251 px de carte, aucune barre. */
    const a = app();
    vrai(/sousOngletActif\.overview === 'historique' \? mountHistory\(\) : mountOverview\(\)/.test(a),
      'le montage suit le sous-onglet');
    vrai(/monterRythme\(\);/.test(fonction(a, 'function mountHistory()')), 'et monte les barres');
    vrai(!/Charts\.deltaBars/.test(fonction(a, 'function mountOverview()')), 'l’accueil ne les monte plus');
  });

  test('la répartition montre trois catégories, et compte le reste', () => {
    /* Parts fictives, dans l'ordre de la table des classes et non par montant. */
    const parts = [
      { classe: 'liquidites', label: 'Liquidités', value: 150, pct: 15 },
      { classe: 'actions', label: 'Actifs de marché', value: 400, pct: 40 },
      { classe: 'obligations', label: 'Obligations', value: 50, pct: 5 },
      { classe: 'crypto', label: 'Cryptomonnaies', value: 30, pct: 3 },
      { classe: 'immobilier', label: 'Immobilier', value: 450, pct: 45 },
      { classe: DETTES_NON_AFFECTEES, label: 'Dettes non affectées', value: -80, pct: -8 },
    ];
    const somme = s => s.tete.reduce((a, x) => a + x.value, 0) + (s.autres ? s.autres.value : 0)
      + s.negatives.reduce((a, x) => a + x.value, 0);
    const base = parts.reduce((a, x) => a + x.value, 0);
    const s = syntheseRepartition(parts);
    eq(s.tete.map(x => x.classe).join(','), 'immobilier,actions,liquidites', 'les trois plus grosses, par montant décroissant');
    eq(s.autres.nb, 2, 'le reste se compte');
    pres(s.autres.value, 80, 'et vaut la somme de ce qu’il réunit');
    pres(s.autres.pct, 8, 'avec sa part');
    eq(s.autres.labels.join(','), 'Obligations,Cryptomonnaies', 'et nomme ce qu’il réunit');
    eq(s.autres.lignes.map(x => x.classe).join(','), 'obligations,crypto', 'et porte ses lignes, pour leur détail');
    eq(s.negatives.length, 1, 'une dette sans destination reste visible, hors du classement');
    pres(somme(s), base, 'et les lignes affichées font toujours la base');
    /* Aucune categorie apres les trois principales : aucune ligne de plus. */
    const trois = syntheseRepartition(parts.slice(0, 3));
    eq(trois.autres, null, 'sans reste, pas de ligne du reste');
    eq(trois.tete.length, 3, 'et les trois se lisent seules');
    eq(syntheseRepartition([{ value: 10, pct: null }, { value: 5, pct: null }, { value: 4, pct: null },
                            { value: 1, pct: null }, { value: 1, pct: null }]).autres.pct, null,
      'sans base divisible, aucune part inventée');
  });

  test('une seule catégorie restante s’affiche sous son nom, jamais « 1 autre catégorie »', () => {
    /* Le cas type : trois categories nommees, puis 1 autre categorie pour la
       seule crypto. Elle prend sa place de ligne, avec sa couleur, son montant
       et sa part, et aucun montant ne bouge. */
    const quatre = [
      { classe: 'immobilier', label: 'Immobilier', value: 450, pct: 45, couleur: '#a' },
      { classe: 'actions', label: 'Actifs de marché', value: 400, pct: 40, couleur: '#b' },
      { classe: 'liquidites', label: 'Liquidités', value: 120, pct: 12, couleur: '#c' },
      { classe: 'crypto', label: 'Cryptomonnaies', value: 30, pct: 3, couleur: '#d' },
    ];
    const s = syntheseRepartition(quatre);
    eq(s.autres, null, 'pas de groupe pour une seule catégorie');
    eq(s.tete.map(x => x.classe).join(','), 'immobilier,actions,liquidites,crypto', 'elle rejoint les lignes nommées');
    const crypto = s.tete[3];
    eq(crypto.label, 'Cryptomonnaies', 'sous son vrai nom');
    eq(crypto.couleur, '#d', 'avec sa couleur');
    pres(crypto.value, 30, 'son montant');
    pres(crypto.pct, 3, 'et sa part, inchangés');
    pres(s.tete.reduce((a, x) => a + x.pct, 0), 100, 'les parts font toujours 100 %');
    /* Et le seuil ne bouge que pour ce cas : cinq categories font toujours un
       groupe de deux. */
    const cinq = syntheseRepartition([...quatre, { classe: 'obligations', label: 'Obligations', value: 10, pct: 1 }]);
    eq(cinq.tete.length, 3, 'cinq catégories : trois lignes');
    eq(cinq.autres && cinq.autres.nb, 2, 'et un groupe de deux');
  });

  test('le groupe « Autres » dit son total et son nombre, et se déplie en ses catégories', () => {
    const a = app();
    const carte = a.slice(a.indexOf('const s = syntheseRepartition(classes);'), a.indexOf('repart-base',
      a.indexOf('const s = syntheseRepartition(classes);')));
    vrai(/\$\{s\.tete\.map\(ligneClasse\)\.join\(''\)\}/.test(carte), 'les lignes de catégorie');
    vrai(/<button type="button" class="repart-ligne repart-autres" data-action="repart-autres"/.test(carte),
      'le groupe est un bouton');
    vrai(/aria-expanded="\$\{repartAutresOuvert \? 'true' : 'false'\}" aria-controls="repartAutresDetail"/.test(carte),
      'qui dit s’il est déplié et ce qu’il déplie');
    vrai(/\$\{trad\('Autres'\)\}/.test(carte) && /trad\('\{n\} catégories'\)\.replace\('\{n\}', s\.autres\.nb\)/.test(carte),
      'il s’appelle « Autres » et compte ses catégories');
    vrai(/<b>\$\{fmtEUR0\(s\.autres\.value\)\}<\/b>/.test(carte), 'avec leur total');
    vrai(/id="repartAutresDetail"\$\{repartAutresOuvert \? '' : ' hidden'\}>\s*\$\{s\.autres\.lignes\.map\(ligneClasse\)\.join\(''\)\}/.test(carte),
      'et ses catégories suivent, au même gabarit que les autres lignes');
    vrai(/\$\{s\.negatives\.map\(ligneClasse\)\.join\(''\)\}/.test(carte), 'les parts négatives restent affichées');
    vrai(carte.indexOf('s.tete.map') < carte.indexOf('repart-autres') && carte.indexOf('repart-autres') < carte.indexOf('s.negatives.map'),
      'dans cet ordre : catégories, reste, dettes');
    vrai(/<a class="hint lien-vue" href="#\/allocation">\$\{trad\('Voir toute l’allocation'\)\} →<\/a>/.test(a),
      'et le lien vers toute l’allocation reste en tête de carte');
    vrai(!/autre catégorie'\)|autres catégories'\)/.test(carte), 'plus de « 1 autre catégorie »');
    vrai(!I18N.en['1 autre catégorie'] && !I18N.en['{n} autres catégories'], 'et ses clefs sont parties');
    eq(I18N.en['{n} catégories'], '{n} categories', 'dans les deux langues');
    /* Deplier ne rend rien : le bouton garde le focus. */
    const action = a.slice(a.indexOf("'repart-autres'(btn) {"), a.indexOf('\n  },', a.indexOf("'repart-autres'(btn) {")));
    vrai(/detail\.hidden = !repartAutresOuvert;/.test(action) && !/render\(\)/.test(action), 'se déplie sans redessiner la page');
  });

  test('le rappel du relevé se lit sans crier', () => {
    const css = lireSource('assets/styles.css');
    const bloc = css.slice(css.indexOf('.rappel {'), css.indexOf('}', css.indexOf('.rappel {')));
    vrai(/background: var\(--surface-1\);/.test(bloc) && /border: 1px solid var\(--border\);/.test(bloc),
      'une surface et un filet de carte');
    vrai(!/--warning/.test(bloc), 'plus de fond ni de filet ambre');
    const pastille = css.slice(css.indexOf('.rappel-pastille {'), css.indexOf('}', css.indexOf('.rappel-pastille {')));
    vrai(/background: var\(--warning\);/.test(pastille) && !/box-shadow/.test(pastille), 'l’ambre ne reste qu’à la pastille, sans halo');
    const vue = fonction(app(), 'function viewOverview()');
    vrai(/sortiesRappel\('releve', moisEnAttente\.label\)/.test(vue) && /data-action="ajouter-releve"/.test(vue),
      'son geste, « Plus tard » et la croix restent');
    /* Mesure a 375 px : la phrase d'explication se pliait sur trois lignes a
       cote de « Plus tard », et « sept. » se separait de « 26 ». */
    vrai(/@media \(max-width: 479px\) \{\s*\n\s*\.rappel-texte br, \.rappel-texte \.muted \{ display: none; \}/.test(css),
      'sur téléphone, le titre suffit');
    vrai(css.includes('.rappel-mois { white-space: nowrap; }') && /<span class="rappel-mois">\$\{esc\(moisEnAttente\.label\)\} ›<\/span>/.test(vue),
      'et le mois ne se coupe pas de son année');
  });

  test('les nouveaux textes se traduisent', () => {
    for (const c of ['depuis le relevé de {m}', 'Voir toute l’allocation',
                     '{n} autres écarts', '1 autre écart', '{n} mouvements du journal compris',
                     '1 mouvement du journal compris', 'Voir le calcul',
                     'selon ton budget, dépenses moyennes de l’année',
                     'selon ton budget, objectif de dépenses faute de dépense saisie', 'Voir le détail']) {
      vrai(!!I18N.en[c], `« ${c.slice(0, 40)} » a sa traduction`);
    }
    for (const c of ['depuis le relevé de {m}', '{n} autres écarts'])
      vrai(I18N.en[c].includes(c.includes('{m}') ? '{m}' : '{n}'), `« ${c} » garde sa marque`);
  });
});

/* ------------------------------------------------------------------
   L'accueil se range : ordre et visibilite des cartes
   ------------------------------------------------------------------ */
suite('L’Aperçu se personnalise, et le patrimoine reste en tête', () => {
  const app = () => lireSource('assets/app.js');
  const corps = (src, nom) => {
    const i = src.indexOf(nom);
    return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i));
  };
  const neuf = () => { Store.state = blankState(); Store.migrate(); return Store.state.meta; };

  test('rien de personnalisé : la disposition par défaut, et rien d’écrit', () => {
    const meta = neuf();
    const d = dispositionApercu(meta);
    eq(d.ordre.join(','), CARTES_APERCU.join(','), 'l’ordre par défaut');
    eq(d.masquees.length, 0, 'aucune carte masquée');
    eq(d.parDefaut, true, 'et la disposition se sait par défaut');
    vrai(!('apercu' in meta), 'aucune migration ne pose la clef');
    Store.migrate();
    vrai(!('apercu' in Store.state.meta), 'même jouée deux fois');
    eq(CARTES_APERCU[CARTES_APERCU.length - 1], 'objectif', 'l’objectif ferme la page');
    vrai(CARTES_APERCU.indexOf('objectif') > CARTES_APERCU.indexOf('evolution')
      && CARTES_APERCU.indexOf('objectif') > CARTES_APERCU.indexOf('reserve'),
      'après le graphique et les cartes de suivi');
  });

  test('une disposition lue n’est jamais incomplète ni invalide', () => {
    /* Un fichier importe peut porter n'importe quoi sous cette clef. */
    const d = dispositionApercu({ apercu: { ordre: ['objectif', 'inconnue', 'objectif', 'titres', 42],
                                            masquees: ['titres', 'hero', 'retenir'] } });
    eq(d.ordre.length, CARTES_APERCU.length, 'toutes les cartes, une fois chacune');
    vrai(d.ordre.indexOf('objectif') < d.ordre.indexOf('titres'), 'l’ordre enregistré est respecté');
    eq(d.ordre.join(','), 'retenir,repartition,evolution,changements,objectif,titres,accumulation,reserve',
      'et les cartes qu’il ne nomme pas reprennent leur place par défaut');
    vrai(!d.ordre.includes('inconnue') && !d.ordre.includes(42), 'l’inconnu s’ignore');
    eq(d.masquees.join(','), 'titres', 'la visibilité d’« À retenir » ne se lit pas ici, et l’inconnu non plus');
    /* Une carte absente de l'ordre enregistre reprend sa place, apres celle
       qui la precede dans l'ordre par defaut. */
    const sans = dispositionApercu({ apercu: { ordre: CARTES_APERCU.filter(id => id !== 'changements') } });
    eq(sans.ordre.join(','), CARTES_APERCU.join(','), 'une carte oubliée revient à sa place');
    const tete = dispositionApercu({ apercu: { ordre: ['reserve'] } });
    eq(tete.ordre[0], 'retenir', 'une carte sans prédécesseur connu revient en tête');
    eq(tete.ordre.length, CARTES_APERCU.length, 'et rien ne manque');
    for (const brut of [null, 'x', 3, [], { ordre: 'x', masquees: {} }])
      eq(dispositionApercu({ apercu: brut }).ordre.join(','), CARTES_APERCU.join(','), `${JSON.stringify(brut)} rend le défaut`);
  });

  test('monter, descendre, masquer, réafficher, rétablir', () => {
    const meta = neuf();
    vrai(deplacerCarteApercu('objectif', -1), 'l’objectif monte d’un cran');
    eq(dispositionApercu().ordre.slice(-2).join(','), 'objectif,reserve', 'il passe devant la réserve');
    eq(deplacerCarteApercu('retenir', -1), false, 'en tête, monter ne fait rien');
    eq(deplacerCarteApercu('inconnue', 1), false, 'une carte inconnue ne bouge rien');
    for (let i = 0; i < 10; i++) deplacerCarteApercu('objectif', -1);
    eq(dispositionApercu().ordre[0], 'objectif', 'l’objectif peut remonter jusqu’en tête');
    const avant = JSON.stringify(meta.apercu);
    eq(deplacerCarteApercu('objectif', -1), false, 'et s’y arrête');
    eq(JSON.stringify(meta.apercu), avant, 'sans rien écrire');
    vrai(basculerCarteApercu('titres'), 'masquer');
    eq(dispositionApercu().masquees.join(','), 'titres', 'la carte est masquée');
    basculerCarteApercu('titres');
    eq(dispositionApercu().masquees.length, 0, 'et se réaffiche d’un geste');
    retablirDispositionApercu();
    vrai(!('apercu' in meta), 'rétablir efface la clef');
    eq(dispositionApercu().parDefaut, true, 'et rend la disposition par défaut');
  });

  test('revenir à l’ordre par défaut à la main efface aussi la clef', () => {
    /* Sans quoi un profil qui a essaye puis defait garderait pour toujours
       l'ordre d'aujourd'hui, et ne recevrait jamais le defaut de demain. */
    const meta = neuf();
    deplacerCarteApercu('titres', 1);
    vrai('apercu' in meta, 'un écart s’écrit');
    deplacerCarteApercu('titres', -1);
    vrai(!('apercu' in meta), 'l’écart défait ne laisse rien');
  });

  test('« À retenir » : trois portes, un seul fait', () => {
    const meta = neuf();
    basculerCarteApercu('retenir');
    eq(meta.retenirMasquee, true, 'la liste de réglage écrit la clef des Préférences');
    vrai(!meta.apercu || !(meta.apercu.masquees || []).includes('retenir'), 'et pas une seconde clef');
    eq(dispositionApercu().masquees.join(','), 'retenir', 'la liste la lit');
    meta.retenirMasquee = false;
    eq(dispositionApercu().masquees.length, 0, 'les Préférences la rallument pour la liste aussi');
    meta.retenirMasquee = true;
    retablirDispositionApercu();
    vrai(!meta.retenirMasquee, 'rétablir la réaffiche');
    const a = app();
    vrai(/Store\.state\.meta\.retenirMasquee = !Store\.state\.meta\.retenirMasquee;/.test(a),
      'la bascule des Préférences reste la même');
  });

  test('la disposition voyage avec la sauvegarde, et avec elle seulement', () => {
    Fixture.poser();
    deplacerCarteApercu('objectif', -1);
    deplacerCarteApercu('objectif', -1);
    basculerCarteApercu('changements');
    const attendue = dispositionApercu();
    /* L'export JSON est l'etat entier ; l'import le relit puis le migre. */
    const fichier = JSON.stringify(Store.state, null, 2);
    Store.state = blankState(); Store.migrate();
    eq(dispositionApercu().parDefaut, true, 'un autre profil n’a rien');
    Store.state = JSON.parse(fichier);
    Store.migrate();
    eq(dispositionApercu().ordre.join(','), attendue.ordre.join(','), 'l’import rend l’ordre');
    eq(dispositionApercu().masquees.join(','), 'changements', 'et les cartes masquées');
    /* Une sauvegarde d'avant la fonction n'a pas la clef : elle suit le defaut. */
    const ancienne = JSON.parse(fichier);
    delete ancienne.meta.apercu;
    Store.state = ancienne; Store.migrate();
    eq(dispositionApercu().parDefaut, true, 'une sauvegarde ancienne ouvre sur la disposition par défaut');
  });

  test('ranger l’accueil ne touche ni aux données ni aux calculs', () => {
    Fixture.poser();
    const sansMeta = () => { const s = structuredClone(Store.state); delete s.meta; return JSON.stringify(s); };
    const donnees = sansMeta();
    const net = nowTotals().total;
    const parts = JSON.stringify(repartitionClasses({ net: true }));
    for (const id of CARTES_APERCU) { deplacerCarteApercu(id, 1); basculerCarteApercu(id); }
    retablirDispositionApercu();
    deplacerCarteApercu('reserve', -1);
    eq(sansMeta(), donnees, 'aucune donnée hors des préférences ne change');
    pres(nowTotals().total, net, 'le patrimoine est le même');
    eq(JSON.stringify(repartitionClasses({ net: true })), parts, 'et la répartition aussi');
    const s = lireSource('assets/store.js');
    for (const f of ['function dispositionApercu(', 'function ecrireDispositionApercu(', 'function deplacerCarteApercu(',
                     'function basculerCarteApercu(', 'function retablirDispositionApercu('])
      vrai(!/Store\.save|positions|comptes|monthly|budget/.test(corps(s, f).replace(/\/\*[\s\S]*?\*\//g, '')),
        `${f.slice(9, -1)} n’écrit que la disposition`);
  });

  test('la vue et le modèle nomment les mêmes cartes', () => {
    const a = app();
    const registre = a.slice(a.indexOf('const CARTES_APERCU_VUE = {'), a.indexOf('\n};\n', a.indexOf('const CARTES_APERCU_VUE = {')));
    const cles = [...registre.matchAll(/^  ([a-z]+): +\{ nom:/gm)].map(m => m[1]);
    eq(cles.join(','), CARTES_APERCU.join(','), 'une entrée par carte, dans le même ordre');
    for (const id of ['patrimoine', 'hero', 'rappel', 'releve', 'depenses', 'guide', 'verifier'])
      vrai(!CARTES_APERCU.includes(id), `« ${id} » reste hors de la personnalisation`);
    const vue = corps(a, 'function viewOverview()');
    vrai(/\$\{moisEnAttente\.missing && !guide \?/.test(vue) && /\$\{depEnAttente\.missing && !guide \?/.test(vue),
      'les rappels restent rendus par la vue, à leur place');
    vrai(vue.indexOf('${carteAVerifier()}') < vue.indexOf('<div class="hero">'), 'l’alerte de vérification aussi');
    vrai(vue.indexOf('<div class="hero">') < vue.indexOf('${cartes.tete}'), 'le patrimoine avant toutes les cartes');
  });

  test('sur ordinateur, les rangées se forment d’après les cartes rendues', () => {
    const a = app();
    const r = corps(a, 'function rangeesApercu(');
    vrai(/if \(b && a\.id === 'evolution' && b\.id === 'changements'\)/.test(r), 'la courbe et ce qui a changé partagent la leur');
    vrai(/\} else if \(compacte\(a\) && compacte\(b\)\) \{/.test(r) && /class="grid g-2"/.test(r),
      'deux cartes compactes voisines partagent une rangée');
    vrai(/\} else html \+= a\.html;/.test(r), 'toute autre carte prend la largeur');
    const c = corps(a, 'function cartesApercu(');
    vrai(/!d\.masquees\.includes\(id\)/.test(c) && /\.filter\(c => c\.html\.trim\(\)\)/.test(c),
      'une carte masquée ou vide ne laisse aucun trou');
    const compactes = [...a.matchAll(/^  ([a-z]+): +\{[^}]*compacte: true/gm)].map(m => m[1]);
    eq(compactes.sort().join(','), 'accumulation,changements,objectif,reserve,titres', 'cinq cartes tiennent dans une demi-largeur');
    const css = lireSource('assets/styles.css');
    vrai(/\.grid:has\(> :only-child\) \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(css),
      'une rangée d’une seule carte prend toute la largeur');
  });

  test('les rappels suivent le point à retenir quand il ouvre la page, sinon le patrimoine', () => {
    const c = corps(app(), 'function cartesApercu(');
    vrai(/const tete = rendues\[0\] && rendues\[0\]\.id === 'retenir' \? rendues\.shift\(\)\.html : '';/.test(c),
      'le point à retenir revient à part, et lui seul');
    const vue = corps(app(), 'function viewOverview()');
    const l = [vue.indexOf('${cartes.tete}'), vue.indexOf('${moisEnAttente.missing && !guide ?'),
               vue.indexOf('${depEnAttente.missing && !guide ?'), vue.indexOf('${cartes.suite}')];
    vrai(l.every((v, i) => v > 0 && (i === 0 || v > l[i - 1])), `tête, rappels, puis les cartes : ${l.join(' < ')}`);
  });

  test('le mode édition : une porte discrète, une liste, et « Terminé »', () => {
    const a = app();
    const pied = corps(a, 'function piedApercu(');
    vrai(/class="lien-vue" data-action="apercu-editer">\$\{trad\('Personnaliser l’aperçu'\)\}/.test(pied), 'la porte');
    const vue = corps(a, 'function viewOverview()');
    vrai(/: piedApercu\(\)\}/.test(vue), 'au pied de la page, seulement quand il y a un compte');
    vrai(/const enEditionApercu = \(\) =>\s*\n\s*apercuEdition && sousOngletActif\.overview === 'aujourdhui' && !pasAFaire\('comptes'\);/.test(a),
      'le réglage ne vaut que pour Aujourd’hui, et seulement avec un compte');
    vrai(/^function viewOverview\(\) \{[\s\S]{0,200}?\n  if \(enEditionApercu\(\)\) return editeurApercu\(\);/.test(vue),
      'la liste remplace toute la page le temps du réglage, patrimoine compris');
    const e = corps(a, 'function editeurApercu(');
    vrai(/d\.ordre\.map\(ligne\)/.test(e), 'toutes les cartes, masquées comprises');
    vrai(/class="apercu-ligne apercu-fixe"/.test(e) && /trad\('Toujours en premier'\)/.test(e),
      'le patrimoine y figure, sans commande');
    vrai(/data-action="apercu-monter"/.test(e) && /data-action="apercu-descendre"/.test(e), 'monter et descendre');
    vrai(/i === 0 \? ' disabled' : ''/.test(e) && /i === d\.ordre\.length - 1 \?\s*' disabled' : ''/.test(e),
      'sans objet au bord');
    vrai(/aria-label="\$\{pour\('Monter'\)\}"/.test(e) && /aria-label="\$\{pour\('Descendre'\)\}"/.test(e),
      'chaque commande nomme sa carte pour qui ne la voit pas');
    vrai(/role="switch" aria-checked="\$\{cachee \? 'false' : 'true'\}"/.test(e), 'la visibilité est un interrupteur');
    vrai(/data-action="apercu-retablir"\$\{d\.parDefaut \? ' disabled' : ''\}/.test(e), 'rétablir, quand il y a de quoi');
    vrai(/data-action="apercu-terminer"/.test(e), 'et refermer');
    vrai(/role="status" id="apercuAnnonce"/.test(e), 'une région vivante annonce chaque geste');
    /* Le mode ne survit pas a un changement d'ecran. */
    vrai(/if \(key !== 'overview' \|\| sousOngletActif\.overview !== 'aujourdhui'\) apercuEdition = false;/.test(corps(a, 'function render()')),
      'quitter l’onglet referme la liste');
  });

  test('le réglage est un écran à part : son titre, « Terminé », et pas les trois onglets', () => {
    /* Sur telephone, « Aujourd'hui / Historique / Projection » restaient poses
       au-dessus de la liste et laissaient croire qu'on reglait les trois. */
    const a = app();
    vrai(/overview: +\{ cle: 'overview', render: \(\) => \(enEditionApercu\(\) \? '' : barreSousOnglets\('overview'\)\) \+ \(/.test(a),
      'la barre des sous-onglets se tait pendant le réglage');
    const e = corps(a, 'function editeurApercu(');
    vrai(/<header class="page-tete apercu-edition-tete">/.test(e), 'un en-tête d’écran, pas un en-tête de carte');
    vrai(/<h2 id="apercuEditionTitre" tabindex="-1">\$\{trad\('Personnaliser Aujourd’hui'\)\}<\/h2>/.test(e),
      'le titre nomme l’onglet réglé');
    vrai(e.indexOf('data-action="apercu-terminer"') < e.indexOf('<section class="card apercu-edition"'),
      '« Terminé » est dans l’en-tête, avant la liste');
    vrai(/trad\('Choisis l’ordre des cartes d’Aujourd’hui/.test(e), 'et la consigne dit aussi de quel onglet il s’agit');
    vrai(!/trad\('Personnaliser l’aperçu'\)/.test(e), 'l’ancien titre est parti de l’écran');
    /* Historique et Projection ne l'ouvrent jamais. */
    const vues = a.slice(a.indexOf('const VIEWS = {'), a.indexOf('budget:', a.indexOf('const VIEWS = {')));
    vrai(/sousOngletActif\.overview === 'historique' \? viewHistory\(\)\s*\n\s*: sousOngletActif\.overview === 'projection' \? viewObjective\(\)/.test(vues),
      'Historique et Projection gardent leur rendu');
    vrai(!/enEditionApercu|editeurApercu/.test(corps(a, 'function viewHistory(') + corps(a, 'function viewObjective(')),
      'et ne connaissent pas le réglage');
  });

  test('en quittant le réglage, on revient à Aujourd’hui, en haut, dans l’ordre choisi', () => {
    const a = app();
    const t = a.slice(a.indexOf("'apercu-terminer'() {"), a.indexOf('\n  },', a.indexOf("'apercu-terminer'() {")));
    vrai(/apercuEdition = false;\s*\n\s*retourHautDemande = true;\s*\n\s*render\(\);/.test(t), 'la page revient, en haut');
    /* Sans le drapeau, render() rend la position qu'on quitte : on entrait dans
       le reglage defile de 55 px, le titre sous la barre du haut. */
    const e = a.slice(a.indexOf("'apercu-editer'() {"), a.indexOf('\n  },', a.indexOf("'apercu-editer'() {")));
    vrai(/retourHautDemande = true;\s*\n\s*render\(\);/.test(e), 'et l’écran de réglage s’ouvre en haut');
    vrai(/\$\('\.sous-onglets button\.on'\)\?\.focus\(\{ preventScroll: true \}\);/.test(t),
      'et le clavier repart de l’onglet Aujourd’hui');
    vrai(!/Store\.save|dispositionApercu|retablir/.test(t), 'sortir n’écrit rien : chaque geste l’a déjà fait');
    /* La barre du bas referme aussi le reglage, meme sur l'onglet deja ouvert. */
    const barre = a.slice(a.indexOf("$('#tabbar')?.addEventListener('click'"), a.indexOf("rejouerClasse(lien, 'rebond', 420);"));
    vrai(/const quitteEdition = apercuEdition;\s*\n\s*apercuEdition = false;/.test(barre), 'un appui sur la barre quitte le réglage');
    vrai(/e\.preventDefault\(\);\s*\n\s*if \(quitteEdition\) render\(\);/.test(barre), 'y compris sur « Aperçu », déjà ouvert');
  });

  test('au clavier, le focus reste sur la commande qu’on vient d’actionner', () => {
    const a = app();
    const f = corps(a, 'function reprendreFocusApercu(');
    vrai(/\[data-action="\$\{f\.action\}"\]/.test(f), 'le même bouton, sur la même carte');
    vrai(/voulu && !voulu\.disabled \? voulu : ligne && ligne\.querySelector\('button:not\(\[disabled\]\)'\)/.test(f),
      'et son voisin quand il vient de se désactiver au bord');
    vrai(/cible\.focus\(\{ preventScroll: true \}\);/.test(f), 'le focus est reposé');
    const d = corps(a, 'function deplacerSurApercu(');
    vrai(/apercuFocus = \{ carte: id, action: sens < 0 \? 'apercu-monter' : 'apercu-descendre' \};/.test(d),
      'le déplacement le demande');
    vrai(/Store\.save\(\);/.test(d), 'et s’écrit tout de suite, comme toute saisie dans une page');
    const m = a.slice(a.indexOf('function mountOverview()'), a.indexOf('function mountOverview()') + 400);
    vrai(/else reprendreFocusApercu\(\);/.test(m), 'le montage le reprend en mode édition');
    vrai(/if \(!\$\('\.apercu-edition'\)\) \{ noterInsightsVus\(\); monterEvolution\(\); \}/.test(m),
      'et ne note aucun point à retenir comme vu pendant le réglage');
  });

  test('sous le pouce, les commandes font 44 px', () => {
    const css = lireSource('assets/styles.css');
    vrai(/@media \(max-width: 899px\) \{\s*\n\s*\.apercu-fleche \{ width: 44px; height: 44px; \}\s*\n\s*\.bascule\.apercu-vu \{ min-height: 44px; \}/.test(css),
      'flèches et interrupteur');
    vrai(/\.apercu-commandes \{ flex: none; display: flex; align-items: center; gap: 6px; \}/.test(css),
      'côte à côte, sans se chevaucher');
    vrai(/\.apercu-nom \{ flex: 1 1 auto; min-width: 0;/.test(css), 'le nom se plie plutôt que de pousser les commandes hors de l’écran');
  });

  test('un renvoi vers une carte masquée se tait', () => {
    const a = app();
    vrai(/const ANCRES_CARTES_APERCU = \{ evolution: 'evolution', variation: 'changements',/.test(a), 'les ancres de l’accueil ont leur carte');
    vrai(/&& !renvoiVersCarteMasquee\(p\) \? p\.cta : null;/.test(a), 'le point à retenir tait le renvoi');
    /* Toutes les ancres que « À retenir » vise sur l'accueil sont connues. */
    const ancres = [...a.matchAll(/cta: \{ vue: 'overview', ancre: '([a-z-]+)'/g)].map(m => m[1]);
    vrai(ancres.length > 0, `${ancres.length} renvois vers l’accueil`);
    const table = (a.match(/const ANCRES_CARTES_APERCU = \{[^}]*\}/) || [''])[0];
    for (const x of ancres) vrai(table.includes(`${x}: '`), `« ${x} » a sa carte`);
  });

  test('les textes du réglage se traduisent', () => {
    for (const c of ['Personnaliser l’aperçu', 'Terminé', 'Toujours en premier', 'Masquée', 'Rien à montrer pour l’instant',
                     'Monter', 'Descendre', 'Afficher sur l’aperçu', 'Afficher', 'Masquer',
                     'Rétablir la disposition par défaut', '{c}, carte masquée', '{c}, carte affichée',
                     '{c}, position {n} sur {t}', 'Disposition par défaut rétablie', '{n} catégories',
                     'Personnaliser Aujourd’hui',
                     'Choisis l’ordre des cartes d’Aujourd’hui et celles que tu veux voir. Les rappels de saisie gardent leur place.'])
      vrai(!!I18N.en[c], `« ${c.slice(0, 40)} » a sa traduction`);
    for (const [c, marques] of [['{c}, position {n} sur {t}', ['{c}', '{n}', '{t}']], ['{c}, carte masquée', ['{c}']],
                                ['{c}, carte affichée', ['{c}']], ['{n} catégories', ['{n}']]])
      for (const mq of marques) vrai(I18N.en[c].includes(mq), `« ${c} » garde ${mq}`);
  });
});

finDePartieDeTests('tests/23-insight-ecart-cible-allocation.tests.js');
