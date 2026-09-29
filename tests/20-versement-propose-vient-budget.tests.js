partieDeTests('tests/20-versement-propose-vient-budget.tests.js');
/* P0.4 : UNE CROISSANCE DE PATRIMOINE N'EST PAS UNE CAPACITE D'EPARGNE. Le
   versement propose se repliait sur le rythme observe des releves quand le
   budget ne laissait rien : une hausse de marche de 900 EUR devenait 900 EUR
   verses chaque mois, qui produisaient a leur tour du rendement. */
suite('Le versement proposé vient du budget, ou de rien', () => {

  const RELEVES = [{ date: '2026-01-31', comment: '', v: { c_courant: 1000 } },
                   { date: '2026-02-28', comment: '', v: { c_courant: 2000 } },
                   { date: '2026-03-31', comment: '', v: { c_courant: 3000 } }];

  /* Un patrimoine qui monte de mille euros par mois, et un budget muet. */
  const sansBudget = () => Fixture.poser(s => {
    s.budget.income = []; s.budget.fixedCharges = []; s.budget.expenses = [];
    s.monthly = RELEVES.map(r => ({ ...r, v: { ...r.v } }));
  });

  test('la suggestion est l’épargne investissable, et rien d’autre', () => {
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 3850, period: 'mois' }];
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 1200, period: 'mois' }];
      s.budget.expenses = [{ month: '2026-01', v: { Courses: 900 }, note: '' }];
    });
    const rec = savingsReconciliation();
    vrai(rec.investable > 0, 'le jeu d’essai laisse de quoi investir');
    eq(suggestedMonthly(), Math.round(rec.investable), 'exactement cette somme');
  });

  test('une croissance de patrimoine n’est pas une capacité d’épargne', () => {
    sansBudget();
    const rec = savingsReconciliation();
    vrai(rec.realPerMonth > 0,
      `le rythme observé doit être positif, vu ${rec.realPerMonth} : sans lui ce contrôle ne prouve rien`);
    vrai(!(rec.investable > 0), 'et le budget ne laisse rien à investir');
    eq(suggestedMonthly(), 0,
      'la suggestion vaut donc zéro : elle ne reprend pas la croissance du patrimoine');
  });

  test('le rythme observé reste rendu, là où il décrit ce qu’il est', () => {
    /* Il ne disparait pas du modele : la carte du budget le montre comme rythme
       observe et le compare a l'epargne theorique. C'est sa nature, et c'est le
       seul endroit ou il est juste. */
    sansBudget();
    const rec = savingsReconciliation();
    vrai(rec.realPerMonth != null, 'le rythme observé est toujours calculé');
    pres(rec.gap, rec.realPerMonth - rec.theoretical, 'et l’écart s’en déduit');
    const corps = corpsDe(lireSource('assets/store.js'), 'suggestedMonthly');
    vrai(corps.length > 30, 'la fonction doit se relire depuis sa source');
    vrai(!/realPerMonth/.test(corps), 'mais la suggestion de versement ne le lit plus');
    vrai(/investable/.test(corps), 'elle ne lit que l’épargne investissable');
  });

  test('sans capacité d’épargne, la projection ne verse rien', () => {
    sansBudget();
    Store.state.meta.projScenario = 'central';
    delete Store.state.meta.projMonthly;
    const s = projectionSettings();
    eq(s.monthlyAuto, true, 'aucune valeur réglée : le budget décide');
    eq(s.monthly, 0, 'et il ne décide rien de positif');
    const p = capitalisation({ years: 10 });
    pres(p.points[10].contributed, p.points[0].contributed,
      'aucun euro versé en dix ans : la courbe ne s’emballe plus toute seule');
  });

  test('l’écran ne dit pas « repris » quand rien n’a été repris', () => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf('const suggere = suggestedMonthly();');
    vrai(i > 0, 'la mention sous le champ interroge la suggestion');
    const bloc = src.slice(i, i + 1800);
    vrai(/suggere > 0 \? trad\('Repris de ta capacité d’épargne dans Budget'\)/.test(bloc),
      '« Repris de » ne se dit que si un montant a été repris');
    vrai(/Aucune capacité d’épargne positive connue dans Budget/.test(bloc),
      'sinon la phrase dit qu’il n’y a rien à reprendre');
    /* Un versement fige reste fige, meme a zero : c'est un choix. */
    const j = bloc.indexOf('if (!(suggere > 0))');
    vrai(j > 0, 'le cas figé sans capacité connue est traité à part');
    const branche = bloc.slice(j, bloc.indexOf('\n', j));
    vrai(/trad\('Valeur figée\.'\)/.test(branche), 'et la phrase le nomme');
    vrai(!/proj-use-budget/.test(branche), 'sans proposer de reprendre zéro');
    for (const cle of ['Aucune capacité d’épargne positive connue dans Budget',
                       'Valeur figée.']) {
      vrai(I18N.en[cle], `« ${cle} » doit avoir sa traduction`);
    }
  });
});

/* P0.5 : ZERO EST UNE REPONSE, ET IL NE DIT JAMAIS L'ABSENCE DE REPONSE.
   « 0 % de tes revenus » sous 900 EUR de charges fixes se lit comme une mesure :
   il dit que ces charges ne pesent rien. C'est l'inverse — elles pesent tout,
   puisque rien n'entre. */
suite('Un pourcentage sans dénominateur n’existe pas', () => {

  const sansRevenu = () => Fixture.poser(s => {
    s.budget.income = [];
    s.budget.fixedCharges = [{ label: 'Loyer', amount: 900, period: 'mois' }];
  });

  test('les quatre parts du budget valent null, jamais zéro', () => {
    sansRevenu();
    const f = budgetFrame();
    eq(f.income, 0, 'aucun revenu déclaré');
    pres(f.fixed, 900, 'et pourtant 900 € de charges fixes');
    for (const cle of ['fixedPct', 'availablePct', 'targetPct', 'investTargetPct']) {
      eq(f[cle], null, `« ${cle} » : l’absence de mesure, pas une mesure à zéro`);
    }
    /* Les montants, eux, restent vrais : on ne force rien a zero. */
    pres(f.available, -900, 'le solde dit la vérité, aussi désagréable soit-elle');
    pres(f.investTarget, f.available - f.target, 'et l’objectif d’investissement aussi');
  });

  test('avec un revenu, les quatre parts se calculent comme avant', () => {
    Fixture.poser(s => {
      s.budget.monthlyTarget = 600;
      s.budget.income = [{ label: 'Salaire', amount: 3000, period: 'mois' }];
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 900, period: 'mois' }];
    });
    const f = budgetFrame();
    pres(f.fixedPct, 30, '900 sur 3 000');
    pres(f.availablePct, 70, 'et le reste');
    pres(f.targetPct, 20, '600 sur 3 000');
    pres(f.investTargetPct, 50, 'et ce qui reste une fois l’objectif retiré');
  });

  test('le taux d’accumulation suit la même règle', () => {
    sansRevenu();
    eq(savingsReconciliation().theoreticalRate, null,
      'un taux sans revenu au dénominateur n’est pas un taux à zéro');
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 3000, period: 'mois' }];
    });
    const rec = savingsReconciliation();
    vrai(rec.theoreticalRate != null, 'il redevient un nombre dès qu’un revenu existe');
    pres(rec.theoreticalRate, rec.theoretical / rec.income * 100, 'et vaut le rapport annoncé');
  });

  test('aucune vue n’imprime « 0 % » à la place d’une absence', () => {
    /* `fmtPct(null)` rendrait « 0,00 % », parce que `num(null)` vaut zero :
       le mensonge qu'on vient de retirer du modele reviendrait par l'affichage
       si une vue oubliait sa condition. Le controle porte sur les six lectures
       de ces cinq champs, nommees une a une — `targetPct` existe aussi sur les
       cibles d'Allocation, ou il a toujours un denominateur. */
    const src = lireSource('assets/app.js');
    const echappe = s => s.replace(/[.()]/g, '\\$&');
    const cibles = ['f.fixedPct', 'f.availablePct', 'f.targetPct', 'f.investTargetPct',
                    'budgetFrame().fixedPct', 'rec.theoreticalRate'];
    let vues = 0;
    for (const cible of cibles) {
      const motif = new RegExp('fmtPct\\(\\s*' + echappe(cible), 'g');
      for (const m of [...src.matchAll(motif)]) {
        vues++;
        const autour = src.slice(Math.max(0, m.index - 500), m.index + 60);
        vrai(/== null|income\s*\?|!f\.income/.test(autour),
          `« ${cible} » s’imprime sans garde : fmtPct(null) rendrait « 0,00 % »`);
      }
    }
    vrai(vues >= 3, `au moins trois lectures attendues, vu ${vues}`);
  });

  test('la vue nomme l’absence au lieu de la chiffrer', () => {
    const src = lireSource('assets/app.js');
    vrai(/rec\.theoreticalRate == null[\s\S]{0,120}trad\('aucun revenu déclaré'\)/.test(src),
      'le taux d’accumulation dit ce qui manque');
    vrai(/budgetFrame\(\)\.fixedPct == null \? trad\('aucun revenu déclaré'\)/.test(src),
      'et le panneau des charges fixes aussi');
    vrai(I18N.en['aucun revenu déclaré'], 'la phrase a sa traduction');
    /* Les deux mentions en ligne, elles, retirent la clause : « 900 € par mois »
       se suffit, la ou « 900 € par mois, 0 % de tes revenus » ment. */
    vrai(/f\.fixedPct == null \? '' :/.test(src),
      'et les mentions en ligne se taisent plutôt que de chiffrer zéro');
  });
});

/* LA REPARTITION THEORIQUE EST UNE INFORMATION, JAMAIS UN MONTANT DU BUDGET.

   Trois notions, et les fondre est le defaut deja commis ici : le montant
   FACTURE, la part THEORIQUE d'un autre, et la contribution REELLEMENT RECUE,
   qui est une entree saisie dans les revenus. Le budget compte la premiere et la
   troisieme, jamais la deuxieme. */
suite('Modifier les parts ne change jamais le total des charges', () => {

  /* Le scenario du brief, celui qui a coute mille euros par mois de reste pour
     vivre : la contribution comptee en entree ET retranchee des charges. */
  const scenario = (parts = { loyer: 945, elec: 100, net: 50 }) => Fixture.poser(s => {
    s.budget.contributors = [{ id: 'pk', name: 'PK' }];
    s.budget.income = [{ label: 'Salaire', amount: 3200 },
                       { label: 'Complément', amount: 900 }];
    s.budget.fixedCharges = [
      { label: 'Loyer', amount: 1890, period: 'mois', shares: { pk: parts.loyer } },
      { label: 'Électricité', amount: 200, period: 'mois', shares: { pk: parts.elec } },
      { label: 'Internet', amount: 100, period: 'mois', shares: { pk: parts.net } },
    ];
  });

  test('le contrôle central : la part n’est jamais comptée deux fois', () => {
    scenario();
    pres(incomeTotal(), 4100, '3 200 de salaire et 900 de complément');
    pres(fixedTotal(), 2190, '1 890 + 200 + 100, les montants facturés');
    pres(budgetFrame().fixed, 2190, 'et le cadre du budget lit le même total');
    pres(budgetFrame().available, 1910, '4 100 − 2 190');
    pres(partTheoriqueMensuelle('pk'), 1095, 'la part théorique vaut 1 095 €');
    vrai(Math.abs(fixedTotal() - 1095) > 1,
      'le total des charges n’est PAS la part théorique');
    vrai(Math.abs(budgetFrame().available - 3005) > 1,
      'et le reste pour vivre n’est pas gonflé de la part, comptée une seconde fois');
  });

  test('trois parts différentes, un seul et même total', () => {
    /* Zero, la moitie, la totalite : le budget ne bouge pas d'un centime. */
    const totaux = new Set();
    for (const part of [0, 945, 1890]) {
      Fixture.poser(s => {
        s.budget.contributors = [{ id: 'pk', name: 'PK' }];
        s.budget.income = [{ label: 'Salaire', amount: 3200 }];
        s.budget.fixedCharges = [{ label: 'Loyer', amount: 1890, period: 'mois',
                                   shares: { pk: part } }];
      });
      pres(fixedTotal(), 1890, `part de ${part} € : la charge vaut son montant facturé`);
      totaux.add(round2(budgetFrame().available));
    }
    eq(totaux.size, 1, 'et le reste pour vivre est le même dans les trois cas');
  });

  test('tous les lecteurs du budget voient le même chiffre brut', () => {
    /* Un seul chiffre partout : le total des charges, le cadre, la
       reconciliation d'epargne, le versement propose, l'autonomie. */
    const lire = () => ({
      fixed: round2(fixedTotal()),
      cadre: round2(budgetFrame().fixed),
      reco: round2(savingsReconciliation().fixed),
      verse: suggestedMonthly(),
      mois: round2(runway().months),
    });
    scenario({ loyer: 0, elec: 0, net: 0 });
    const sans = lire();
    scenario();
    const avec = lire();
    eq(JSON.stringify(avec), JSON.stringify(sans),
      `déclarer des parts a changé un montant du budget : ${JSON.stringify(sans)} `
      + `puis ${JSON.stringify(avec)}`);
    pres(avec.fixed, 2190, 'et ce montant est bien le facturé');
  });

  test('aucun calcul du budget ne lit une part', () => {
    /* Sur le CODE, jamais sur un commentaire : l'arbre publie les retire. */
    const code = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const f of ['fixedTotal', 'budgetFrame', 'incomeTotal', 'savingsReconciliation',
                     'suggestedMonthly']) {
      const corps = corpsDe(code, f);
      vrai(corps.length > 20, `${f} doit se relire depuis sa source`);
      vrai(!/share|contributor/i.test(corps),
        `« ${f} » lit une part : le budget compte le facturé, et lui seul`);
    }
    vrai(/return B\(\)\.fixedCharges\.reduce\(\(s, c\) => s \+ chargeMensuelle\(c\), 0\);/
      .test(code), 'le total des charges somme les montants facturés');
  });

  test('plusieurs personnes se partagent une charge sans la réduire', () => {
    Fixture.poser(s => {
      s.budget.contributors = [{ id: 'pk', name: 'PK' }, { id: 'alex', name: 'Alex' }];
      s.budget.income = [{ label: 'Salaire', amount: 3200 }];
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 2000, period: 'mois',
                                 shares: { pk: 600, alex: 400 } }];
    });
    pres(fixedTotal(), 2000, 'le budget compte les 2 000 € facturés');
    pres(partTheoriqueMensuelle('pk'), 600, 'la part de la première');
    pres(partTheoriqueMensuelle('alex'), 400, 'celle de la seconde');
    const st = sharedTotals();
    pres(st.total, 2000, 'le facturé');
    pres(st.partage, 1000, 'la part théorique totale');
    pres(st.resteTheorique, 1000, 'et ce qui resterait après partage');
    eq(st.parPersonne.length, 2, 'les deux personnes sont nommées');
    eq(st.parPersonne.map(x => x.nom).join(' | '), 'PK | Alex', 'dans l’ordre déclaré');
    /* Et ce « reste theorique » n'alimente aucun calcul du budget. */
    pres(budgetFrame().fixed, 2000, 'le cadre du budget ignore le partage');
  });

  test('une part suit la périodicité de sa charge', () => {
    for (const [periode, mensuel, part] of [['an', 100, 50], ['semestre', 200, 100],
                                            ['trimestre', 400, 200], ['mois', 1200, 600]]) {
      Fixture.poser(s => {
        s.budget.contributors = [{ id: 'pk', name: 'PK' }];
        s.budget.fixedCharges = [{ label: 'Assurance', amount: 1200, period: periode,
                                   shares: { pk: 600 } }];
      });
      pres(chargeMensuelle(Store.state.budget.fixedCharges[0]), mensuel,
        `1 200 € ${periode} pèsent ${mensuel} € par mois`);
      pres(partTheoriqueMensuelle('pk'), part, `et la part théorique ${part} €`);
      pres(fixedTotal(), mensuel, 'le budget compte le facturé ramené au mois');
    }
    /* La semaine vaut 52/12 mois, comme le montant qu'elle partage. */
    Fixture.poser(s => {
      s.budget.contributors = [{ id: 'pk', name: 'PK' }];
      s.budget.fixedCharges = [{ label: 'Courses', amount: 52, period: 'semaine',
                                 shares: { pk: 26 } }];
    });
    pres(fixedTotal(), 52 * 52 / 12, 'cinquante-deux semaines dans l’année');
    pres(partTheoriqueMensuelle('pk'), 26 * 52 / 12, 'et la part suit le même facteur');
  });

  test('une part vide, nulle ou absente vaut zéro, jamais NaN', () => {
    Fixture.poser(s => {
      s.budget.contributors = [{ id: 'pk', name: 'PK' }];
      s.budget.fixedCharges = [
        { label: 'A', amount: 100, period: 'mois', shares: { pk: '' } },
        { label: 'B', amount: 100, period: 'mois', shares: { pk: 0 } },
        { label: 'C', amount: 100, period: 'mois', shares: {} },
        { label: 'D', amount: 100, period: 'mois' },
      ];
    });
    for (const c of Store.state.budget.fixedCharges) {
      eq(shareOf(c, 'pk'), 0, `« ${c.label} » : aucune part déclarée vaut zéro`);
      vrai(Number.isFinite(shareMensuelle(c, 'pk')), 'et le mensuel reste un nombre');
    }
    eq(partTheoriqueMensuelle('pk'), 0, 'le total des parts est zéro, pas NaN');
    pres(fixedTotal(), 400, 'et les quatre charges comptent entières');
    eq(partTheoriqueMensuelle('inconnu'), 0, 'une personne inconnue ne casse rien');
  });

  test('les parts se valident à la saisie, sans toucher au calcul', () => {
    const ids = ['pk'];
    eq(validerPartsSaisies({ part_pk: 945 }, 1890, ids), null, '945 sur 1 890 : valide');
    eq(validerPartsSaisies({ part_pk: 1890 }, 1890, ids), null, 'la totalité aussi');
    eq(validerPartsSaisies({ part_pk: 0 }, 1890, ids), null, 'zéro est une réponse');
    eq(validerPartsSaisies({ part_pk: '' }, 1890, ids), null, 'et le vide n’est pas une faute');
    eq(validerPartsSaisies({}, 1890, ids), null, 'ni l’absence de champ');
    const trop = validerPartsSaisies({ part_pk: 2000 }, 1890, ids);
    vrai(trop, '2 000 sur 1 890 : refusé');
    eq(trop.cle, 'part_pk', 'et la fenêtre désigne le champ');
    vrai(/dépasser le montant facturé/.test(trop.message), `« ${trop.message} »`);
    const moins = validerPartsSaisies({ part_pk: -1 }, 1890, ids);
    vrai(moins && moins.cle === 'part_pk', 'un négatif est refusé aussi');
    /* A deux, c'est la SOMME qui est bornee. */
    const deux = validerPartsSaisies({ part_pk: 1200, part_alex: 900 }, 2000, ['pk', 'alex']);
    vrai(deux, '1 200 + 900 dépassent 2 000');
    eq(validerPartsSaisies({ part_pk: 1200, part_alex: 800 }, 2000, ['pk', 'alex']), null,
      'et 1 200 + 800 tiennent exactement');
    for (const cle of ['Une part théorique ne peut pas être négative.',
                       'Les parts théoriques ne peuvent pas dépasser le montant facturé.',
                       'Part de {n} ({dev})', 'Part théorique de {n}',
                       'Part théorique de {n} sur cette charge. Elle sert au suivi de la '
                       + 'répartition et ne réduit pas le montant compté dans ton budget.']) {
      vrai(I18N.en[cle], `« ${cle} » doit avoir sa traduction`);
    }
  });

  test('écrire une part ne touche qu’aux personnes déclarées', () => {
    const c = { label: 'Loyer', amount: 1890, period: 'mois', shares: { parti: 300 } };
    ecrirePartsSaisies(c, { part_pk: 945 }, ['pk']);
    eq(c.shares.pk, 945, 'la part saisie s’écrit');
    eq(c.shares.parti, 300,
      'et celle d’une personne qui n’est plus déclarée reste dans le fichier');
    ecrirePartsSaisies(c, { part_pk: '' }, ['pk']);
    eq(c.shares.pk, undefined, 'un champ vidé retire la part');
    eq(c.shares.parti, 300, 'sans toucher au reste');
    ecrirePartsSaisies(c, { part_pk: 0 }, ['pk']);
    eq(c.shares.pk, 0, 'un zéro tapé est une déclaration, et il s’écrit');
  });

  test('la fiche d’une charge porte le champ, et il lit `shares`', () => {
    const app = lireSource('assets/app.js');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ');
    vrai(/cle: CLE_PART\(g\.id\)/.test(code),
      'le champ se nomme par la même porte que la règle et l’écriture');
    vrai(/valeur: estDeclare\(\(\(charge \|\| \{\}\)\.shares \|\| \{\}\)\[g\.id\]\)/.test(code),
      'et il lit charge.shares[id], sans champ parallèle');
    vrai(/label: 'Partage', type: 'section'/.test(code), 'sous une section « Partage »');
    /* Les deux portes de saisie l'appellent, et valident. */
    const porte = (nom, fin) => {
      const d = code.indexOf(nom);
      vrai(d > 0, `la porte « ${nom} » doit exister`);
      return code.slice(d, code.indexOf(fin, d));
    };
    for (const [nom, fin] of [["async 'add-charge'", "'del-charge'"],
                              ["async 'edit-charge'", "async 'add-income'"]]) {
      const bloc = porte(nom, fin);
      vrai(/champsPartage\(/.test(bloc), `« ${nom} » n’offre pas la section Partage`);
      vrai(/validerPartsSaisies\(/.test(bloc), `« ${nom} » ne valide pas les parts`);
      vrai(/ecrirePartsSaisies\(/.test(bloc), `« ${nom} » n’écrit pas les parts`);
    }
    /* Et aucun champ parallele n'est ne. */
    for (const invente of ['partPK', 'partTheorique:', 'shareInfo', 'contributionDue']) {
      vrai(!code.includes(invente) && !lireSource('assets/store.js').includes(invente),
        `« ${invente} » : la répartition a déjà sa source, c’est shares`);
    }
  });

  test('la carte montre le facturé, la part seulement en second', () => {
    const app = lireSource('assets/app.js');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const carte = code.slice(code.indexOf('data-anchor="charges"'),
                             code.indexOf('id="chargesTable"'));
    vrai(carte.length > 200, 'la carte des charges doit se relire depuis sa source');
    vrai(/valeur: `\$\{fmtEUR\(chargeMensuelle\(c\)\)\}/.test(carte),
      'le montant de la ligne est le facturé ramené au mois');
    /* Et la ligne ne porte QUE ca : la mention grise a deja quatre choses a
       dire, et la part y arrivait tronquee sur un telephone. Elle se lit au
       pied, une ligne par personne, et dans la fiche ou on la saisit. */
    const avantPied = carte.slice(0, carte.indexOf('repart-pied'));
    vrai(!/partsLisibles|Part théorique/.test(avantPied),
      'la ligne d’une charge ne porte pas la part : elle est déjà au pied et dans la fiche');
    vrai(/<dt>\$\{trad\('Total \/ mois'\)\}<\/dt><dd>\$\{fmtEUR\(brut\)\}<\/dd>/.test(carte),
      'le total reste celui des montants facturés');
    vrai(/Part théorique de \{n\}/.test(carte),
      'la part de chacun se lit sous ce total, nommée comme théorique');
    /* Et le calcul, lui, ne bouge pas. */
    scenario();
    pres(fixedTotal(), 2190, 'la carte annonce 2 190 €, pas 1 095 €');
    pres(chargeMensuelle(Store.state.budget.fixedCharges[0]), 1890,
      'et la ligne du loyer 1 890 €, pas 945 €');
  });

  test('l’export donne au facturé et à la part deux colonnes distinctes', () => {
    /* Le harnais ne charge pas `app.js` : la feuille se lit donc dans sa source,
       et les nombres qu'elle produira se vérifient par le modèle qu'elle appelle. */
    const feuille = corpsDe(lireSource('assets/app.js').replace(/\/\*[\s\S]*?\*\//g, ' '),
                            'sheetFixedCharges');
    vrai(feuille.length > 200, 'la feuille doit se relire depuis sa source');
    vrai(!/à ma charge/i.test(feuille),
      'aucune colonne ne prétend dire ce que le budget compte à la place du facturé');
    const iPct = feuille.indexOf("'% des charges'");
    const iPart = feuille.indexOf('Part théorique de ${g.name} / mois');
    const iOrg = feuille.indexOf("{ h: 'Organisme'");
    vrai(iPct > 0 && iPart > iPct && iOrg > iPart,
      'la part théorique a sa propre colonne, entre le poids et l’organisme');
    vrai(/round2\(chargeMensuelle\(c\)\), poids\(c\),/.test(feuille),
      'la colonne mensuelle porte le facturé, et le poids s’y rapporte');
    vrai(/\.\.\.gens\.map\(g => round2\(shareMensuelle\(c, g\.id\)\)\)/.test(feuille),
      'la part de chacun est mensuelle, dans sa propre colonne');
    vrai(/total: \['Total', null, '', round2\(brut\)/.test(feuille),
      'le total de la colonne mensuelle est le brut');
    vrai(/\.\.\.gens\.map\(g => round2\(partTheoriqueMensuelle\(g\.id\)\)\), ''\]/.test(feuille),
      'et celui des parts est à part');
    vrai(/const brut = Store\.state\.budget\.fixedCharges\s*\.reduce\(\(s, c\) => s \+ chargeMensuelle\(c\), 0\)/
      .test(feuille), 'le total de la feuille somme les montants facturés');

    /* Et les nombres qu'elle rendra sur ce jeu d'essai. */
    Fixture.poser(s => {
      s.budget.contributors = [{ id: 'pk', name: 'PK' }];
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 1890, period: 'mois',
                                 shares: { pk: 945 } }];
    });
    const c = Store.state.budget.fixedCharges[0];
    pres(num(c.amount), 1890, 'Montant : le facturé');
    pres(chargeMensuelle(c), 1890, '{dev} / mois : le facturé ramené au mois');
    pres(shareMensuelle(c, 'pk'), 945, 'et la part théorique à côté');
    pres(fixedTotal(), 1890, 'le total des charges est 1 890 €, pas 945 €');
    pres(partTheoriqueMensuelle('pk'), 945, 'la part totale vit dans sa colonne');
  });

  test('le crédit et le bien ne connaissent pas les parts', () => {
    /* Une mensualite facturee 1 600 EUR sort pour 1 600 EUR, part ou pas, et le
       capital restant du ne se divise jamais. E2 a E5 ne sont pas rouverts. */
    Fixture.poser(s => {
      s.budget.contributors = [{ id: 'pk', name: 'PK' }];
      const c = s.comptes.find(x => x.id === 'c_immo');
      for (const l of c.lignes) l.usage = 'locative';
      const d = s.etabs.find(x => x.id === 'e_bien').dettes[0];
      d.montant = 120000; d.taux = 2; d.mensualite = null;
      s.budget.income = [{ label: 'Loyer', amount: 900, bienId: 'c_immo' }];
      s.budget.fixedCharges = [
        { label: 'Prêt', amount: 1600, period: 'mois', shares: { pk: 600 },
          creditId: 'd_pret', bienId: 'c_immo' },
        { label: 'Copropriété', amount: 300, period: 'mois', shares: { pk: 150 },
          bienId: 'c_immo' }];
    });
    const d = etabById('e_bien').dettes[0];
    pres(mensualiteCredit(d), 1600, 'la mensualité vaut le prélèvement entier');
    pres(num(d.montant), 120000, 'et le capital restant dû ne se divise jamais');
    pres(dettesTotal(), 120000, 'ni le total des dettes');
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.mensualite, 1600, 'le cash-flow du bien lit la mensualité entière');
    pres(cf.charges, 300, 'et la charge entière');
    pres(coutBien(compteById('c_immo')).totalSorties, 1900, '1 600 + 300');
    const store = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    vrai(!/share/i.test(corpsDe(store, 'cashFlowBien')),
      'le cash-flow d’un bien ne lit aucune part');
    vrai(!/share/i.test(corpsDe(store, 'dettesTotal')),
      'ni le total des dettes');
  });

  test('déclarer ou retirer une personne ne bouge aucun total du budget', () => {
    scenario();
    const lire = () => JSON.stringify({
      fixed: round2(fixedTotal()), dispo: round2(budgetFrame().available),
      entrees: round2(incomeTotal()), verse: suggestedMonthly() });
    const avant = lire();
    Store.state.budget.contributors.push(
      { id: identifiantPersonne('Camille'), name: 'Camille' });
    eq(lire(), avant, 'déclarer quelqu’un ne change rien');
    eq(retirerPersonne('pk', { effacerParts: true }), 3, 'ses trois parts partent avec elle');
    eq(contributors().map(g => g.name).join(' | '), 'Camille', 'et elle n’est plus déclarée');
    eq(lire(), avant, 'le budget ne bouge toujours pas');
    eq(partTheoriqueMensuelle('pk'), 0, 'seule la part théorique tombe à zéro');
    pres(fixedTotal(), 2190, 'les charges valent toujours ce qui est facturé');
  });

  test('retirer quelqu’un peut garder ses parts, et son identifiant ne revient jamais', () => {
    /* LE PIEGE. Garder les parts d'une personne retiree, puis redeclarer le meme
       nom : l'identifiant se derive du nom, donc il serait le meme, et ses
       anciennes parts ressusciteraient sans un mot. Un montant qui revient tout
       seul est exactement ce que ce fichier traque. */
    scenario();
    eq(retirerPersonne('pk', { effacerParts: false }), 0, 'aucune charge touchée');
    eq(Store.state.budget.fixedCharges[0].shares.pk, 945, 'la part reste dans le fichier');
    eq(contributors().length, 0, 'la personne, elle, est partie');
    const id = identifiantPersonne('PK');
    vrai(id !== 'pk',
      `« ${id} » : un identifiant qui traîne encore dans les parts ne se redonne pas`);
    Store.state.budget.contributors.push({ id, name: 'PK' });
    eq(partTheoriqueMensuelle(id), 0, 'la personne redéclarée part de zéro');
    pres(fixedTotal(), 2190, 'et le budget n’a pas bougé d’un centime');
  });

  test('un identifiant se lit, et il ne se donne jamais deux fois', () => {
    Fixture.poser(s => { s.budget.contributors = []; s.budget.fixedCharges = []; });
    eq(identifiantPersonne('Camille'), 'camille', 'il vient du nom');
    eq(identifiantPersonne('Élodie Martin'), 'elodiemartin', 'sans accent ni espace');
    eq(identifiantPersonne('   '), 'personne', 'un nom vide en a quand même un');
    eq(identifiantPersonne('Jean-Baptiste de la Tour'), 'jeanbaptiste', 'et il est borné à douze signes');
    Store.state.budget.contributors = [{ id: 'camille', name: 'Camille' }];
    eq(identifiantPersonne('Camille'), 'camille2', 'le second prend un rang');
  });

  test('ce qu’une personne porte se dit avant de la retirer', () => {
    scenario();
    const p = partsDePersonne('pk');
    eq(p.lignes, 3, 'trois charges portent une part');
    pres(p.mensuel, 1095, 'pour 1 095 € par mois');
    eq(partsDePersonne('inconnu').lignes, 0, 'et personne d’autre n’en porte');
    /* Une part a zero est declaree : elle compte comme une ligne portee, et
       c'est juste — la fenetre en parle avant de l'effacer. */
    scenario({ loyer: 0, elec: 0, net: 0 });
    eq(partsDePersonne('pk').lignes, 3, 'un zéro déclaré est une part, et il se dit');
    pres(partsDePersonne('pk').mensuel, 0, 'pour zéro euro');
  });

  test('les deux portes existent, et aucune ne touche au budget', () => {
    const code = lireSource('assets/app.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    vrai(/data-action="ajouter-personne"/.test(code), 'un bouton déclare une personne');
    vrai(/data-action="editer-personne"/.test(code), 'et son nom ouvre sa fiche');
    vrai(/async 'ajouter-personne'\(\)/.test(code), 'l’acte qui déclare existe');
    vrai(/async 'editer-personne'\(btn\)/.test(code), 'celui qui renomme et retire aussi');
    vrai(/retirerPersonne\(id, \{ effacerParts: !!v\.effacerParts \}\)/.test(code),
      'le retrait passe par le modèle, et la question des parts est posée');
    vrai(/porteDeSortie\(\)/.test(code.slice(code.indexOf("async 'editer-personne'"),
                                             code.indexOf("async 'add-income'"))),
      'et il s’annule');
    /* Le pied nomme TOUTE personne declaree : filtrer sur un total positif
       laissait sans porte celui qu'on venait de declarer. */
    vrai(/sharedTotals\(\)\.parPersonne\.map\(/.test(code),
      'toute personne déclarée a son nom au pied de la carte, même à zéro');
    const actes = code.slice(code.indexOf("async 'ajouter-personne'"),
                             code.indexOf("async 'add-income'"));
    vrai(!/fixedTotal|budgetFrame|chargeMensuelle/.test(actes),
      'et rien dans ces deux actes ne touche à un total de charges');
    for (const cle of ['+ Personne', 'Nouvelle personne', 'Retirer du partage',
                       'Cette personne est déjà déclarée.', 'entre dans le partage',
                       'retiré du partage']) {
      vrai(I18N.en[cle], `« ${cle} » doit avoir sa traduction`);
    }
  });
});

/* DES DEPENSES NE SONT PAS UN RELEVE. Le premier pas « enregistre ton premier
   releve » se declarait franchi des qu'un mois de depenses etait saisi : il
   interrogeait `aDejaServi`, qui repond a une question plus large — l'application
   a-t-elle deja servi. Quelqu'un pouvait creer ses comptes, declarer son salaire,
   remplir son budget, ne jamais photographier ses comptes, et Longward considerait
   le releve comme fait. La courbe, le rythme d'accumulation et l'autonomie
   sortent pourtant du releve, jamais des depenses. */
suite('Le premier relevé se demande jusqu’à ce qu’un relevé existe', () => {

  const COMPTE = { id: 'c1', etabId: null, type: 'courant', statut: 'ouvert',
                   libelle: 'Courant', court: 'Courant', ouvertLe: '2026-01-01',
                   numero: '', notes: '', alloc: '',
                   cash: [{ montant: 500, affectation: 'courant' }], lignes: [] };
  const DEPENSES = [{ month: '2026-01', v: { Courses: 400 }, note: '' }];
  const RELEVE = d => ({ date: d, comment: '', v: { c1: 500 } });
  const VIDE = d => ({ date: d, comment: '', v: {} });

  /* Un etat nu, un compte que quelqu'un a cree, et rien d'autre que ce qu'on
     pose. `refreshAccounts` parce que la vue des comptes se derive. */
  const poser = ({ compte = true, monthly = [], expenses = [] } = {}) => {
    Fixture.poser(s => {
      s.comptes = compte ? [{ ...COMPTE }] : [];
      s.etabs = []; s.positions = [];
      s.monthly = monthly.map(r => ({ ...r, v: { ...r.v } }));
      s.budget.income = []; s.budget.fixedCharges = [];
      s.budget.expenses = expenses.map(r => ({ ...r, v: { ...r.v } }));
    });
    refreshAccounts();
  };

  test('sans compte, le relevé ne se réclame pas', () => {
    /* Rien a photographier : l'annoncer enverrait vers un geste impossible. */
    poser({ compte: false, expenses: DEPENSES });
    vrai(!aUnComptePropre(), 'aucun compte que quelqu’un a créé');
    vrai(!pasAFaire('releves'), 'le pas attend qu’un compte existe');
  });

  test('un compte créé, aucun relevé : le pas reste à faire', () => {
    poser();
    vrai(aUnComptePropre(), 'un compte existe');
    eq(aUnRelevePatrimonial(), false, 'et aucun relevé');
    vrai(pasAFaire('releves'), 'le relevé devient le pas suivant');
  });

  test('LE DÉFAUT : des dépenses saisies ne valident plus le relevé', () => {
    poser({ expenses: DEPENSES });
    vrai(aDejaServi(), 'l’application a bien servi : un mois de dépenses est saisi');
    eq(aUnRelevePatrimonial(), false, 'mais aucune photo des comptes n’existe');
    vrai(pasAFaire('releves'),
      'et le pas reste donc à faire : des dépenses ne sont pas un relevé');
  });

  test('une ligne de relevé vide n’est pas un relevé', () => {
    /* Le calendrier ouvre des lignes vides toutes seules : les compter aurait
       declare le pas franchi avant le premier montant. */
    poser({ monthly: [VIDE('2026-08-01')], expenses: DEPENSES });
    eq(aUnRelevePatrimonial(), false, 'une ligne technique vide ne compte pas');
    vrai(pasAFaire('releves'), 'le pas reste à faire');
  });

  test('un seul relevé réel suffit, avec ou sans dépenses', () => {
    /* Le texte dit qu'il en faut deux pour une pente ; le PAS n'en demande
       qu'un, sans quoi il resterait ouvert un mois de plus. */
    poser({ monthly: [RELEVE('2026-08-01')] });
    eq(aUnRelevePatrimonial(), true, 'un relevé non vide existe');
    vrai(!pasAFaire('releves'), 'le pas est franchi, sans une seule dépense saisie');
    poser({ monthly: [RELEVE('2026-08-01')], expenses: DEPENSES });
    vrai(!pasAFaire('releves'), 'et avec des dépenses aussi');
  });

  test('un relevé vide et un relevé rempli : il suffit d’un', () => {
    poser({ monthly: [VIDE('2026-07-01'), RELEVE('2026-08-01')] });
    vrai(!pasAFaire('releves'), 'la ligne remplie franchit le pas');
    poser({ monthly: [RELEVE('2026-07-01'), RELEVE('2026-08-01')] });
    vrai(!pasAFaire('releves'), 'deux relevés le franchissent aussi');
  });

  test('les dépenses ne touchent jamais au statut du relevé', () => {
    /* Dans les deux sens : elles ne le valident pas, et elles ne le defont pas. */
    poser({ expenses: DEPENSES });
    vrai(pasAFaire('releves'), 'des dépenses seules ne valident rien');
    Store.state.budget.expenses.push({ month: '2026-02', v: { Courses: 900 }, note: '' });
    vrai(pasAFaire('releves'), 'en ajouter une non plus');
    Store.state.budget.expenses[0].v.Courses = 1200;
    vrai(pasAFaire('releves'), 'en modifier une non plus');

    poser({ monthly: [RELEVE('2026-08-01')], expenses: DEPENSES });
    vrai(!pasAFaire('releves'), 'un relevé existe : le pas est franchi');
    Store.state.budget.expenses = [];
    vrai(!pasAFaire('releves'), 'effacer toutes les dépenses ne le défait pas');
    /* Et retirer le seul vrai releve le rouvre : le pas se derive des donnees,
       il ne se souvient de rien. */
    Store.state.monthly = [];
    vrai(pasAFaire('releves'), 'retirer le seul relevé rouvre le pas');
  });

  test('deux questions, deux fonctions', () => {
    /* `aDejaServi` garde son sens large et son seul appelant : le rappel du mois
       clos, qui ne se reclame qu'a qui a deja saisi quelque chose. */
    const code = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    vrai(/const aUnRelevePatrimonial = \(\) =>\s*\(Store\.state\.monthly \|\| \[\]\)\.some\(r => !rowIsEmpty\(r\)\);/
      .test(code), 'la question du relevé a sa propre fonction');
    vrai(/fait: \(\) => !aUnComptePropre\(\) \|\| aUnRelevePatrimonial\(\)/.test(code),
      'et c’est elle que le premier pas interroge');
    const pas = code.slice(code.indexOf("cle: 'releves'"), code.indexOf("cle: 'depenses'"));
    vrai(!/aDejaServi/.test(pas), 'le pas ne lit plus la question large');
    /* La question large ne se recopie pas : elle se compose de la petite. */
    vrai(/\|\| aUnRelevePatrimonial\(\);/.test(code),
      'et la question large réutilise la petite au lieu de la refaire');
    /* Son appelant reste, avec son sens : ici n'importe quelle activite suffit. */
    vrai(/missing: vide && aDejaServi\(\)/.test(code),
      'le rappel du mois clos garde la question large');
    poser({ expenses: DEPENSES });
    eq(aDejaServi(), true, 'des dépenses suffisent à dire que l’application a servi');
    eq(aUnRelevePatrimonial(), false, 'mais pas à dire qu’un relevé existe');
  });

  test('le texte du pas reste celui du métier', () => {
    const pas = PAS_PAR_CLE.releves;
    vrai(/premier relevé mensuel/.test(pas.quoi), 'il demande le premier relevé');
    vrai(/photo de tes comptes/.test(pas.quoi), 'et dit ce que c’est');
    vrai(/deux/.test(pas.quoi), 'en expliquant qu’il en faudra deux pour une pente');
    /* Le libelle tient dans la demi-carte que la rangee lui donne : 150 px a
       375 px, et « Enregistrer ton premier releve » en demandait 194. Le mot
       « premier » vit dans le titre du pas et dans sa consigne. */
    eq(pas.bouton, 'Enregistrer ton premier relevé', 'le bouton dit le premier');
    eq(pas.action, 'ajouter-releve', 'ni la porte qu’il ouvre');
  });
});

/* Le wording des credits suivait encore la convention d'avant : il annoncait que
   « c'est ta part qui sert au budget ». Une charge fixe vaut ce qui est DEBITE
   depuis, et le capital restant du n'a jamais eu de part. */
suite('Le wording des crédits dit la convention du montant facturé', () => {

  test('plus un texte ne dit que le budget compte une part', () => {
    for (const f of ['assets/app.js', 'assets/i18n.js', 'assets/store.js']) {
      const s = lireSource(f);
      for (const mort of ['ta part qui sert au budget', 'your share that feeds the budget',
                          'la dette qui se divise']) {
        vrai(!s.includes(mort), `« ${mort} » vit encore dans ${f}`);
      }
    }
  });

  test('le capital restant dû se dit personnel, et jamais divisé', () => {
    const app = lireSource('assets/app.js');
    const aide = 'La dette qui reste personnellement à ta charge. Elle se déduit de ton '
      + 'patrimoine net et n’est jamais divisée par une quote-part de bien ou une '
      + 'répartition de charge.';
    vrai(app.includes('La dette qui reste personnellement à ta charge.'),
      'la fiche générique d’un crédit le dit');
    vrai(I18N.en[aide], 'et la phrase entière a sa traduction');
    vrai(/never divided by a property ownership share or a cost split/.test(I18N.en[aide]),
      'qui dit la même chose');
  });

  test('la mensualité ajoutée aux charges compte le montant facturé', () => {
    const app = lireSource('assets/app.js');
    for (const debut of ['seulement si tu renseignes une mensualité. Si cette mensualité est ',
                         'seulement si une mensualité est renseignée. Si cette mensualité est ']) {
      const cle = debut + 'ajoutée aux charges fixes, Longward compte le montant facturé ; '
        + 'une éventuelle répartition avec une autre personne reste informative.';
      vrai(app.includes(debut), `« ${debut.slice(0, 40)}… » doit être dans la fiche`);
      vrai(I18N.en[cle], 'et la phrase entière doit avoir sa traduction');
      vrai(/counts the billed amount/.test(I18N.en[cle]), 'qui dit le montant facturé');
    }
  });

  test('et le calcul, lui, n’a pas bougé', () => {
    /* Le scenario du partage, inchange : 1 890 EUR sortent du compte, la part
       theorique de 945 EUR n'en retranche rien, et les 900 EUR reellement recus
       entrent par les revenus. */
    Fixture.poser(s => {
      s.budget.contributors = [{ id: 'pk', name: 'PK' }];
      s.budget.income = [{ label: 'Salaire', amount: 3200 },
                         { label: 'Complément', amount: 900 }];
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 1890, period: 'mois',
                                 shares: { pk: 945 } }];
    });
    pres(incomeTotal(), 4100, 'les entrées');
    pres(fixedTotal(), 1890, 'la charge vaut ce qui est débité');
    pres(budgetFrame().available, 2210, '4 100 − 1 890');
    pres(partTheoriqueMensuelle('pk'), 945, 'et la part reste informative');
    vrai(Math.abs(fixedTotal() - 945) > 1, 'jamais 945 de charges');
    vrai(Math.abs(budgetFrame().available - 3155) > 1, 'jamais 3 155 de reste');
  });

  test('les correctifs P0 tiennent toujours', () => {
    const app = lireSource('assets/app.js');
    const store = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    /* P0.1 : Allocation ouvre sur Financier, et chaque carte garde sa base. */
    vrai(/let allocFinancier = true;/.test(app), 'Allocation ouvre sur Financier');
    vrai(/const baseAvoirsAlloc = \(\) => \(allocFinancier \? BASES\.avoirsFinanciers : BASES\.avoirs\);/
      .test(app), 'et les cartes des avoirs gardent leur base');
    /* P0.2 : un capital restant du negatif se refuse toujours. */
    const f = validerCreditSaisi({ montant: -1000 });
    vrai(f && f.cle === 'montant', 'un CRD négatif est refusé');
    /* P0.3 : un pret a 0 % declare s'amortit toujours. */
    Fixture.poser(s => {
      const e = s.etabs.find(x => (x.dettes || []).length);
      e.dettes = [{ id: 'd0', libelle: 'Prêt', montant: 12000, taux: 0, mensualite: 500 }];
    });
    eq(dettesAmortissables().length, 1, 'un prêt à 0 % reste amortissable');
    /* P0.4 : le versement propose ne lit que l'epargne investissable. */
    vrai(!/realPerMonth/.test(corpsDe(store, 'suggestedMonthly')),
      'le versement proposé ne lit pas le rythme patrimonial');
    /* P0.5 : sans revenu, les rapports valent null. */
    Fixture.poser(s => { s.budget.income = []; });
    eq(budgetFrame().fixedPct, null, 'un rapport sans dénominateur vaut null');
    eq(savingsReconciliation().theoreticalRate, null, 'le taux d’accumulation aussi');
  });
});

/* QUELLES DETTES LE PERIMETRE FINANCIER PORTE-T-IL ?

   Il ecarte les murs et les objets de valeur. Il ecartait AUSSI toutes les
   dettes, sous un raisonnement juste sur un seul cas : le pret finance le bien,
   le bien est deja dehors. Vrai d'un credit immobilier, faux d'une marge de
   courtier ou d'un pret personnel — ceux-la disparaissaient entierement de la
   lecture financiere, et une dette qui ne se voit nulle part est le pire des
   chiffres faux. */
suite('Le périmètre financier porte les dettes qui ne sont pas parties avec un mur', () => {

  /* Un appartement detenu en direct, son credit, et de quoi piloter a cote. */
  const patrimoine50k = (dettes) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes }];
    s.comptes = [
      { id: 'c_appt', etabId: 'e_bq', type: 'immo', statut: 'ouvert', libelle: 'Appartement',
        court: 'Appartement', ouvertLe: '2020-01-01', numero: '', notes: '', alloc: '',
        cash: [], lignes: [{ id: 'l_a', classe: 'immobilier', libelle: 'Appartement',
                             valeur: 300000, prixDeRevient: 300000, quantite: 1,
                             dateAcquisition: '', usage: 'principale' }] },
      { id: 'c_cto', etabId: 'e_bq', type: 'cto', statut: 'ouvert', libelle: 'CTO',
        court: 'CTO', ouvertLe: '2021-01-01', numero: '', notes: '', alloc: '',
        cash: [{ montant: 10000, affectation: 'courant' }],
        lignes: [{ id: 'l_e', classe: 'actions', libelle: 'ETF', valeur: 40000,
                   prixDeRevient: 40000, quantite: 1, dateAcquisition: '' }] },
    ];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });

  const MORTGAGE = { id: 'd_immo', libelle: 'Prêt', montant: 200000, bienId: 'c_appt' };
  const PERSO = { id: 'd_perso', libelle: 'Prêt personnel', montant: 10000 };

  test('une dette sans lien appartient au périmètre financier', () => {
    patrimoine50k([{ ...PERSO }]);
    eq(detteLieeBienDirect(etabById('e_bq').dettes[0]), false, 'aucun bien déclaré');
    pres(dettesFinancieresTotal(), 10000, 'elle compte donc dans le périmètre');
  });

  test('une dette rattachée à un logement direct en sort, quel que soit son usage', () => {
    for (const usage of ['principale', 'secondaire', 'locative']) {
      patrimoine50k([{ ...MORTGAGE }]);
      compteById('c_appt').lignes[0].usage = usage;
      eq(detteLieeBienDirect(etabById('e_bq').dettes[0]), true,
        `un crédit rattaché à un bien « ${usage} » part avec lui`);
      pres(dettesFinancieresTotal(), 0, 'et le périmètre financier n’en porte aucune');
    }
  });

  test('un lien mort ne fait pas disparaître une dette', () => {
    /* Une dette reelle ne s'efface pas parce que sa cible a ete supprimee : ce
       serait un chiffre faux du cote qui rassure. */
    patrimoine50k([{ ...MORTGAGE, bienId: 'c_disparu' }]);
    eq(detteLieeBienDirect(etabById('e_bq').dettes[0]), false, 'le bien n’existe plus');
    pres(dettesFinancieresTotal(), 200000, 'la dette reste comptée');
  });

  test('une SCPI n’est pas un logement : sa dette reste dans le périmètre', () => {
    /* `estBienEnDirect` et non `bienImmo` : la pierre papier se pilote, on choisit
       d'y remettre ou non. La frontiere E / C.2 ne bouge pas. */
    patrimoine50k([{ ...MORTGAGE, bienId: 'c_scpi' }]);
    Store.state.comptes.push({ id: 'c_scpi', etabId: 'e_bq', type: 'scpi', statut: 'ouvert',
      libelle: 'SCPI', court: 'SCPI', ouvertLe: '2022-01-01', numero: '', notes: '',
      alloc: '', cash: [], lignes: [] });
    refreshAccounts();
    eq(estBienEnDirect(compteById('c_scpi')), false, 'une SCPI n’est pas détenue en direct');
    eq(detteLieeBienDirect(etabById('e_bq').dettes[0]), false, 'sa dette ne sort donc pas');
    pres(dettesFinancieresTotal(), 200000, 'elle reste dans le périmètre financier');
  });

  test('SCÉNARIO A — un appartement, son crédit, et 50 k de financier', () => {
    patrimoine50k([{ ...MORTGAGE }]);
    pres(patrimoine().brut, 350000, 'les avoirs globaux');
    pres(dettesTotal(), 200000, 'les dettes globales, toutes comptées une fois');
    pres(patrimoine().net, 150000, 'le patrimoine net global');
    pres(totalFinancier(), 50000, 'les avoirs financiers');
    pres(dettesFinancieresTotal(), 0, 'aucune dette dans le périmètre financier');
    pres(netFinancier(), 50000, 'le net financier vaut donc le brut');
  });

  test('SCÉNARIO B — le même, plus un crédit personnel de 10 k', () => {
    patrimoine50k([{ ...MORTGAGE }, { ...PERSO }]);
    pres(patrimoine().brut, 350000, 'les avoirs globaux ne bougent pas');
    pres(dettesTotal(), 210000, 'les dettes globales les comptent toutes les deux');
    pres(patrimoine().net, 140000, 'le patrimoine net global');
    pres(totalFinancier(), 50000, 'les avoirs financiers non plus');
    pres(dettesFinancieresTotal(), 10000, 'seul le prêt personnel y entre');
    pres(netFinancier(), 40000, '50 000 − 10 000');
  });

  test('SCÉNARIO C — une marge, et rien à répartir dedans', () => {
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_ct', nom: 'Courtier', notes: '',
                   dettes: [{ id: 'd_m', libelle: 'Marge', montant: 20000 }] }];
      s.comptes = [{ id: 'c_cto', etabId: 'e_ct', type: 'cto', statut: 'ouvert',
        libelle: 'CTO', court: 'CTO', ouvertLe: '2021-01-01', numero: '', notes: '',
        alloc: '', cash: [], lignes: [{ id: 'l_e', classe: 'actions', libelle: 'ETF',
          valeur: 100000, prixDeRevient: 100000, quantite: 1, dateAcquisition: '' }] }];
      s.positions = []; s.monthly = [];
    });
    pres(totalFinancier(), 100000, 'les avoirs financiers');
    pres(netFinancier(), 80000, 'et le net, une fois la marge retranchée');
    /* AUCUNE REPARTITION NE CONNAIT LA DETTE. La ventiler au prorata inventerait
       un endroit ou elle n'est pas, et ferait bouger la quantite d'actions qu'on
       « devrait » posseder. */
    const somme = l => round2(l.reduce((s, x) => s + num(x.value), 0));
    pres(somme(repartitionClasses({ financier: true })), 100000, 'par classe d’actif');
    pres(somme(allocationByAccount({ financier: true })), 100000, 'par compte');
    pres(somme(byAccountType({ financier: true })), 100000, 'par type de détention');
    if (typeof allocationParDisponibilite === 'function') {
      pres(somme(allocationParDisponibilite({ financier: true })), 100000, 'par disponibilité');
    }
    pres(somme(poidsPoches({ financier: true, net: true })), 100000, 'et la répartition');
    /* Et la base des cibles reste celle des actifs pilotables. */
    vrai(rebalanceRows().base > 0.005, 'la base des cibles existe');
    vrai(Math.abs(rebalanceRows().base - 80000) > 1,
      'une dette ne change pas la quantité d’actions qu’on devrait posséder');
  });

  test('SCÉNARIO D — une dette plus grosse que les avoirs, et aucun plancher', () => {
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_ct', nom: 'Courtier', notes: '',
                   dettes: [{ id: 'd_m', libelle: 'Marge', montant: 30000 }] }];
      s.comptes = [{ id: 'c_cto', etabId: 'e_ct', type: 'cto', statut: 'ouvert',
        libelle: 'CTO', court: 'CTO', ouvertLe: '2021-01-01', numero: '', notes: '',
        alloc: '', cash: [], lignes: [{ id: 'l_e', classe: 'actions', libelle: 'ETF',
          valeur: 20000, prixDeRevient: 20000, quantite: 1, dateAcquisition: '' }] }];
      s.positions = []; s.monthly = [];
    });
    pres(totalFinancier(), 20000, 'les avoirs financiers');
    pres(netFinancier(), -10000, 'le net est négatif, et il le reste');
    vrai(netFinancier() < 0, 'aucun plancher à zéro ne cache la situation');
    const somme = l => round2(l.reduce((s, x) => s + num(x.value), 0));
    pres(somme(byAccountType({ financier: true })), 20000,
      'et les répartitions portent toujours sur les 20 000 € d’avoirs');
  });

  test('la page annonce les avoirs sur ses cartes, le net dans sa synthèse', () => {
    const app = lireSource('assets/app.js');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const vue = code.slice(code.indexOf('function viewAllocation()'),
                           code.indexOf('function mountAllocation'));
    const entete = vue.slice(0, vue.indexOf('<div class="card'));
    const cartes = vue.slice(vue.indexOf('<div class="card'));
    /* Les cartes : la base des avoirs financiers, par les deux fonctions. */
    vrai(/const baseAlloc = \(\) => \(allocFinancier \? BASES\.avoirsFinanciers : BASES\.net\);/
      .test(code), 'la base de la page nomme les avoirs financiers');
    vrai(/const valeurBaseAlloc = \(\) => \(allocFinancier \? totalFinancier\(\) : nowTotals\(\)\.net\);/
      .test(code), 'et elle vaut le brut financier');
    vrai(!/netFinancier\(\)/.test(cartes),
      'aucune carte ne montre le net : ses parts totalisent les avoirs');
    /* L'entete : la soustraction posee, ses trois termes nommes. */
    vrai(/dettesFinancieresTotal\(\) > 0\.005/.test(entete),
      'la synthèse ne paraît que s’il y a quelque chose à soustraire');
    for (const terme of ['BASES.avoirsFinanciers.nom', 'BASES.netFinancier.nom',
                         'dettesFinancieresTotal()', 'netFinancier()']) {
      vrai(entete.includes(terme), `la synthèse doit nommer « ${terme} »`);
    }
    /* Et aucune dette ne se ventile : le mot ne doit apparaitre dans aucune
       source de repartition de la page. */
    const store = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const f of ['repartitionClasses', 'allocationByAccount', 'byAccountType',
                     'poidsPoches']) {
      vrai(!/dettesFinancieres/.test(corpsDe(store, f)),
        `« ${f} » ne connaît pas les dettes du périmètre : elle répartit des avoirs`);
    }
  });

  test('les mots disent la convention, en français et en anglais', () => {
    const app = lireSource('assets/app.js');
    vrai(!/le prêt finance le bien, qui est déjà écarté/.test(app),
      'l’ancienne promesse — aucun crédit retiré — est partie');
    for (const f of ['assets/app.js', 'assets/i18n.js']) {
      vrai(!lireSource(f).includes('the loan finances the asset, which is already set aside'),
        `et sa traduction aussi, dans ${f}`);
    }
    for (const cle of ['Avoirs financiers', 'Patrimoine financier net',
                       'Dettes hors biens immobiliers directs',
                       'de tes avoirs financiers', 'de ton patrimoine financier net']) {
      vrai(I18N.en[cle], `« ${cle} » doit avoir sa traduction`);
    }
    /* Les deux bases existent et pointent chacune sur SA clef. On lit la clef,
       pas le rendu : `BASES` se construit au chargement du script, donc dans la
       langue du navigateur, et cette page-ci bascule en francais apres. */
    const store = lireSource('assets/store.js');
    vrai(/avoirsFinanciers: \{ nom: trad\('Avoirs financiers'\)/.test(store),
      'un montant, un nom');
    vrai(/netFinancier:\s+\{ nom: trad\('Patrimoine financier net'\)/.test(store),
      'et le net a le sien');
    vrai(!I18N.en['Patrimoine financier'],
      'l’ancien nom, qui valait le brut sous un mot de net, est parti');
  });

  test('ce qui ne bouge pas', () => {
    /* Le net GLOBAL retranche toujours toutes les dettes, une fois. */
    patrimoine50k([{ ...MORTGAGE }, { ...PERSO }]);
    pres(patrimoine().net, patrimoine().brut - dettesTotal(),
      'le patrimoine net global reste avoirs moins toutes les dettes');
    pres(dettesTotal(), 210000, 'et `dettesTotal` les somme toutes');
    /* Le CRD ne se divise pas, la validation refuse toujours un negatif. */
    const f = validerCreditSaisi({ montant: -1 });
    vrai(f && f.cle === 'montant', 'un capital restant dû négatif est toujours refusé');
    /* Le Budget ne connait pas ces grandeurs. */
    const store = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const f2 of ['fixedTotal', 'budgetFrame', 'savingsReconciliation',
                      'suggestedMonthly', 'cashFlowBien', 'dettesAmortissables']) {
      vrai(!/netFinancier|dettesFinancieresTotal/.test(corpsDe(store, f2)),
        `« ${f2} » ne lit pas le périmètre financier`);
    }
    /* Et aucun champ de dette n'a ete invente. */
    for (const invente of ['natureDette', 'typeDette', 'detteFinanciere', 'isMargin',
                           'isMortgage', 'usageDette', 'assetId', 'linkedAccountId']) {
      vrai(!store.includes(invente), `« ${invente} » : le modèle a déjà bienId`);
    }
  });
});

/* DEUX CARTES, DEUX ROLES. Six barres nommaient les six plus gros postes, et la
   carte juste en dessous nommait les treize, montant compris : deux
   representations detaillees des memes depenses sur un seul ecran. On lisait
   « Loyer 1 890 » deux fois en faisant defiler, et rien ne disait laquelle des
   deux repondait a la question qu'on se posait. */
suite('Charges fixes : une carte pèse, l’autre gère', () => {

  const regions = () => {
    const src = lireSource('assets/app.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const i = src.indexOf("trad('Ce qui sort chaque mois')");
    const j = src.indexOf('data-anchor="charges"', i);
    vrai(i > 0 && j > i, 'les deux cartes doivent se relire depuis leur source');
    return { resume: src.slice(i, j), liste: src.slice(j, src.indexOf('id="chargesTable"', j)) };
  };

  test('la carte du haut ne détaille plus les postes', () => {
    const { resume } = regions();
    vrai(resume.length > 200, 'la carte doit se relire depuis sa source');
    vrai(!/flow-row/.test(resume),
      'les six barres nommaient des postes que la carte du dessous liste déjà');
    vrai(!/x\.nom/.test(resume), 'et plus aucun libellé de charge n’y paraît');
    /* Ce qu'elle garde : les trois nombres du poids, le mensuel en tete. */
    vrai(/fmtEUR\(f\.fixed\)/.test(resume), 'le total mensuel reste');
    vrai(/ct-chiffre/.test(resume), 'et il reste le chiffre dominant de la carte');
    vrai(/f\.fixedPct == null \? '' :/.test(resume),
      'sa part du revenu reste, gardée comme au jour où elle est devenue nulle');
    vrai(/fmtEUR0\(f\.fixed \* 12\)/.test(resume), 'et le total à l’année');
    /* La porte vers le detail par poste reste : le panneau a la place de montrer
       les treize la ou la carte n'en montrait que six. */
    vrai(/data-apercu="chargesFixes"/.test(resume), 'le détail par poste reste à un appui');
  });

  test('chaque ligne dit son mensuel et son annuel', () => {
    const { liste } = regions();
    vrai(/valeur: `\$\{fmtEUR\(chargeMensuelle\(c\)\)\} \$\{trad\('\/ mois'\)\}`/.test(liste),
      'le mensuel est l’information principale, à droite');
    vrai(/second: `\$\{fmtEUR0\(chargeMensuelle\(c\) \* 12\)\} \$\{trad\('\/ an'\)\}`/.test(liste),
      'et l’annuel la suit, en second et plus discret');
    vrai(/action: 'edit-charge'/.test(liste), 'le chevron ouvre toujours la ligne');
    vrai(I18N.en['/ an'], 'le mot a sa traduction');
    /* Douze fois le mensuel, et non une seconde conversion de periodicite :
       `chargeMensuelle` a deja ramene la charge au mois, quelle qu'elle soit. */
    Fixture.poser(s => {
      s.budget.fixedCharges = [{ label: 'Assurance', amount: 1200, period: 'an' },
                               { label: 'Loyer', amount: 1890, period: 'mois' }];
    });
    const [a, l] = Store.state.budget.fixedCharges;
    pres(chargeMensuelle(a), 100, 'une charge annuelle pèse cent euros par mois');
    pres(chargeMensuelle(a) * 12, 1200, 'et retrouve son montant à l’année');
    pres(chargeMensuelle(l) * 12, 22680, 'un loyer de 1 890 € fait 22 680 € par an');
  });

  test('les deux cartes lisent le même total, et le budget aussi', () => {
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 4500 }];
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 1890, period: 'mois' },
                               { label: 'Internet', amount: 30, period: 'mois' }];
    });
    pres(fixedTotal(), 1920, 'le total des charges');
    pres(budgetFrame().fixed, 1920, 'la carte du haut le lit par le cadre du budget');
    pres(Store.state.budget.fixedCharges.reduce((s, c) => s + chargeMensuelle(c), 0), 1920,
      'et le pied de la liste somme exactement les mêmes lignes');
    pres(fixedTotal() * 12, 23040, 'le total à l’année suit le même chemin');
  });
});

/* PREMIER USAGE. Un compte, un montant, et rien d'autre : l'accueil affichait
   huit zeros repartis sur trois cartes, dont « 0,0 mois d'autonomie » en rouge
   au-dessus de 3 000 EUR de liquidites. Une carte qui ne peut rien mesurer dit ce
   qui la remplirait, elle n'imprime pas un zero a la place. */
suite('Un premier compte ne remplit pas l’accueil de zéros', () => {

  /* Un compte courant que quelqu'un a cree, et rien d'autre au monde. */
  const premierCompte = (extra) => {
    Fixture.poser(s => {
      s.comptes = [{ id: 'c1', etabId: null, type: 'courant', statut: 'ouvert',
        libelle: 'Compte courant', court: 'Compte courant', ouvertLe: '2026-01-01',
        numero: '', notes: '', alloc: '',
        cash: [{ montant: 3000, affectation: 'courant' }], lignes: [] }];
      s.etabs = []; s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = []; s.budget.expenses = [];
      s.budget.monthlyTarget = 0;
      if (extra) extra(s);
    });
    refreshAccounts();
  };

  test('sans coût de la vie, l’autonomie ne vaut pas zéro mois', () => {
    /* LE DEFAUT. `cover = r.burn ? ep / r.burn : 0` rendait zero faute de
       denominateur, et la carte peignait « 0,0 mois » en rouge sur un coussin de
       3 000 EUR : l'inverse exact de la situation, le premier jour. */
    premierCompte();
    const p = poches();
    pres(p.courant + p.precaution, 3000, 'le coussin existe');
    eq(runway().burn, 0, 'et le coût de la vie est inconnu');
    const src = lireSource('assets/app.js');
    vrai(/\$\{!r\.burn \? `/.test(src.slice(src.indexOf('function carteReserveResume()'))),
      'la carte se tait dès que le dénominateur manque, quel que soit le coussin');
    vrai(!/const cover = r\.burn \? ep \/ r\.burn : 0;/.test(src),
      'le rapport ne se replie plus sur zéro');
    /* Et elle dit ce qui lui manque, precisement : les charges seules ici. */
    const cle = 'Ce chiffre compare ton argent disponible à ce que te coûte un mois. '
      + 'Il attend donc tes charges fixes.';
    vrai(src.includes(cle), 'avec un coussin, elle n’attend plus que les charges');
    vrai(I18N.en[cle], 'et la phrase a sa traduction');
  });

  test('l’autonomie revient dès qu’une charge existe', () => {
    premierCompte(s => {
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 1000, period: 'mois' }];
    });
    pres(runway().burn, 1000, 'le coût de la vie est connu');
    pres(poches().courant / runway().burn, 3, 'et le coussin vaut trois mois');
  });

  test('l’accumulation ne s’affiche pas comme une équation à zéro', () => {
    premierCompte();
    const rec = savingsReconciliation();
    eq(rec.income, 0, 'aucun revenu');
    eq(rec.fixed, 0, 'aucune charge');
    eq(rec.spend, 0, 'aucune dépense');
    const src = lireSource('assets/app.js');
    vrai(/if \(!\(rec\.income > 0\) && !\(rec\.fixed > 0\) && !\(rec\.spend > 0\)\) return/.test(src),
      'les trois termes absents, la carte dit ce qui la remplirait');
    /* Elle parle par la TABLE, d'une seule voix : sa propre phrase plus celle du
       pas en aurait fait deux, dont l'une ecrite pour une autre carte. */
    vrai(/<h2>\$\{trad\('Accumulation ce mois-ci'\)\}<\/h2><\/div>\s*\$\{invitePremierPas\('revenus'\)\}/
      .test(src), 'la carte vide porte l’invite de la table, et rien d’autre');
    /* LA PHRASE NE SE RECOPIE PAS ICI, SA PROPRIETE SE VERIFIE. Une copie mot
       pour mot faisait tomber ce controle a la premiere retouche du texte — un
       seul mot ajoute, et il criait sans qu'aucun defaut existe. Ce qu'il veut
       dire tient en deux regles : le pas annonce ce qu'il APPORTE, et jamais ce
       qui manque a l'ecran qui l'affiche. */
    const quoi = PAS_PAR_CLE.revenus.quoi;
    vrai(/capacité d’épargne/.test(quoi), 'le pas dit ce qu’il apporte');
    vrai(!/cette carte|cet écran|cette page/.test(quoi),
      'et non ce qui manque à l’écran qui le montre');
    vrai(I18N.en[quoi], 'et il a sa traduction');
    vrai(!/Sans revenu déclaré, cette carte/.test(src),
      'l’ancien texte, écrit pour la barre du budget, ne s’affiche plus sur celle-ci');
    /* Un seul des trois suffit a la reveiller : declarer ses charges avant son
       salaire donne bien un mouvement a suivre, et un solde negatif est un fait. */
    premierCompte(s => {
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 1000, period: 'mois' }];
    });
    vrai(savingsReconciliation().fixed > 0, 'une charge seule réveille la carte');
    pres(savingsReconciliation().investable, -1000, 'et le solde négatif est un résultat');
  });

  test('le rythme ne chiffre pas une série vide', () => {
    premierCompte();
    const p = statsRythme(limitRange(monthlyPace().points, 'ytd', { ecarts: true }));
    eq(p.count, 0, 'aucun mois clos à comparer');
    vrai(/if \(!p\.count\) return '';/.test(lireSource('assets/app.js')),
      '« +0 € » et « 0 / 0 » ne contredisent plus le « pas assez d’historique » du graphique');
  });

  test('l’objectif ne se réclame pas avant le premier compte, et il se traduit', () => {
    const src = lireSource('assets/app.js');
    vrai(/if \(!\(num\(g\.obj\) > 0\)\) return aUnComptePropre\(\) \?/.test(src),
      'rien à viser tant qu’il n’y a rien à compter');
    vrai(!/<span>Aucun objectif fixé pour \$\{esc\(an\)\}<\/span>/.test(src),
      'la phrase n’est plus écrite en français dans le balisage');
    vrai(/trad\('Aucun objectif fixé pour \{a\}'\)/.test(src), 'elle passe par le dictionnaire');
    eq(I18N.en['Aucun objectif fixé pour {a}'], 'No target set for {a}',
      'et un lecteur anglais ne lit plus du français');
  });

  test('des cibles jamais choisies ne reprochent rien au premier jour', () => {
    /* Les cibles par defaut somment 98 %. Le controle se gardait sur le BRUT,
       qui compte le cash : declarer son compte courant suffisait donc a recevoir
       un avertissement sur un reglage qu'on n'avait jamais ouvert. */
    premierCompte(s => {
      s.targets = { cashToInvest: 5, classes: { actions: 60, obligations: 33 }, exclues: [] };
    });
    pres(sommeCibles(), 98, 'la somme des cibles par défaut');
    pres(patrimoine().brut, 3000, 'et le patrimoine brut compte le cash');
    eq(rebalanceRows().base, 0, 'mais rien n’est encore placé');
    vrai(!healthChecks().some(h => /Cibles d’allocation/.test(h.title)),
      'aucun avertissement sur des cibles qui ne répartissent rien');
    /* Des qu'un euro est place, le controle reprend son sens. */
    premierCompte(s => {
      s.targets = { cashToInvest: 5, classes: { actions: 60, obligations: 33 }, exclues: [] };
      s.comptes.push({ id: 'c2', etabId: null, type: 'cto', statut: 'ouvert',
        libelle: 'CTO', court: 'CTO', ouvertLe: '2026-01-01', numero: '', notes: '',
        alloc: '', cash: [], lignes: [{ id: 'l1', classe: 'actions', libelle: 'ETF',
          valeur: 10000, prixDeRevient: 10000, quantite: 1, dateAcquisition: '' }] });
    });
    vrai(rebalanceRows().base > 0.005, 'il y a désormais matière à répartir');
    vrai(healthChecks().some(h => /Cibles d’allocation/.test(h.title)),
      'et l’avertissement reprend son sens');
  });

  test('les premiers pas suivent l’état, un par un', () => {
    /* L'ordre est un ordre de faisabilite : le releve n'a de sens qu'apres un
       compte, et il ne se valide que par une vraie photo. */
    Fixture.poser(s => {
      s.comptes = []; s.etabs = []; s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = []; s.budget.expenses = [];
    });
    refreshAccounts();
    eq(['comptes', 'revenus', 'depenses'].map(c => pasAFaire(c)).join(','), 'true,true,true',
      'tout reste à faire sur un état vierge');
    eq(pasAFaire('releves'), false, 'sauf le relevé, qui attend un compte');

    premierCompte();
    eq(pasAFaire('comptes'), false, 'le premier compte franchit le premier pas');
    eq(pasAFaire('releves'), true, 'et rend le relevé demandable');

    premierCompte(s => { s.budget.income = [{ label: 'Salaire', amount: 3500 }]; });
    eq(pasAFaire('revenus'), false, 'le salaire franchit le sien');

    premierCompte(s => {
      s.budget.fixedCharges = [{ label: 'Loyer', amount: 1200, period: 'mois' }];
    });
    eq(pasAFaire('depenses'), false, 'une charge fixe franchit celui des dépenses');

    premierCompte(s => {
      s.monthly = [{ date: '2026-08-01', comment: '', v: { c1: 3000 } }];
    });
    eq(pasAFaire('releves'), false, 'et un vrai relevé franchit le dernier');
  });
});

/* AUDIT MATHEMATIQUE DE PROJECTION.

   Le moteur est mensuel. Un taux annonce est un taux ANNUEL EFFECTIF, converti
   par (1+r)^(1/12)-1 : douze mois de rendement redonnent donc exactement le taux
   affiche. Les versements arrivent en FIN de mois — annuite ordinaire, la plus
   prudente des deux conventions — et il y en a exactement douze par an.

   La reference de ces controles n'est pas le moteur : c'est la formule fermee de
   l'annuite, ecrite ici, differente par construction. Un test qui appelle deux
   fois la meme fonction ne protege rien. */
suite('Projection : le moteur se réconcilie', () => {

  /* La reference independante : capital compose, plus une annuite ordinaire. */
  const vfFormule = (capital, versement, tauxAnnuel, mois) => {
    const r = Math.pow(1 + tauxAnnuel / 100, 1 / 12) - 1;
    if (Math.abs(r) < 1e-12) return capital + versement * mois;
    return capital * Math.pow(1 + r, mois)
         + versement * (Math.pow(1 + r, mois) - 1) / r;
  };

  const CTO = (lignes, cash) => ({ id: 'c_ct', etabId: 'e', type: 'cto', statut: 'ouvert',
    libelle: 'CTO', court: 'CTO', ouvertLe: '2020-01-01', numero: '', notes: '', alloc: '',
    cash: cash || [], lignes: (lignes || []).map((l, i) => ({ id: 'l' + i, classe: l.classe,
      libelle: l.classe, valeur: l.valeur, prixDeRevient: l.valeur, quantite: 1,
      dateAcquisition: '', ...(l.projet ? { projet: true } : {}) })) });

  const BIEN = (valeur, extra) => ({ id: 'c_immo', etabId: 'e', type: 'immo', statut: 'ouvert',
    libelle: 'Appartement', court: 'Appartement', ouvertLe: '2020-01-01', numero: '',
    notes: '', alloc: '', cash: [], lignes: [{ id: 'lb', classe: 'immobilier',
      libelle: 'Appartement', valeur, prixDeRevient: valeur, quantite: 1,
      dateAcquisition: '', usage: 'principale', ...(extra || {}) }] });

  const SCPI = valeur => ({ id: 'c_scpi', etabId: 'e', type: 'scpi', statut: 'ouvert',
    libelle: 'SCPI', court: 'SCPI', ouvertLe: '2020-01-01', numero: '', notes: '', alloc: '',
    cash: [], lignes: [{ id: 'ls', classe: 'immobilier', libelle: 'SCPI', valeur,
      prixDeRevient: valeur, quantite: 1, dateAcquisition: '' }] });

  /* Un etat nu, entierement decrit par ses arguments. Les reglages de projection
     partent tous a zero : c'est le seul moyen d'isoler ce qu'on mesure. */
  const etat = ({ comptes = [], dettes = [], meta = {}, budget = {} } = {}) => {
    Fixture.poser(s => {
      s.etabs = [{ id: 'e', nom: 'Banque', notes: '', dettes }];
      s.comptes = comptes;
      s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = []; s.budget.expenses = [];
      Object.assign(s.meta, { projScenario: 'central', projInflation: 0, projTarget: 0,
        projHorizon: 20, projMonthly: 0, projMonthlyZeroLu: true }, meta);
      Object.assign(s.budget, budget);
    });
    refreshAccounts();
  };

  /* --- 1. le point de depart -------------------------------------------- */

  test('t0 vaut exactement le patrimoine net, dans cinq configurations', () => {
    const cas = [
      ['cash seul', { comptes: [CTO([], [{ montant: 10000, affectation: 'courant' }])] }, 10000],
      ['titres et cash', { comptes: [CTO([{ classe: 'actions', valeur: 20000 }],
        [{ montant: 10000, affectation: 'courant' }])] }, 30000],
      ['bien financé', { comptes: [BIEN(300000),
        CTO([], [{ montant: 20000, affectation: 'courant' }])],
        dettes: [{ id: 'd1', libelle: 'Prêt', montant: 200000, taux: 2, mensualite: 1000 }] }, 120000],
      ['dette plus grosse que les avoirs', {
        comptes: [CTO([], [{ montant: 20000, affectation: 'courant' }])],
        dettes: [{ id: 'd1', libelle: 'Perso', montant: 30000 }] }, -10000],
    ];
    for (const [nom, cfg, attendu] of cas) {
      etat(cfg);
      pres(patrimoine().net, attendu, `${nom} : le patrimoine net`);
      const p = capitalisation({ years: 10 });
      pres(p.points[0].total, attendu, `${nom} : le premier point de la projection`);
      /* Et la somme des poches redonne ce meme nombre : aucun euro ne se perd
         ni ne se dedouble en changeant de poche. */
      const q = pochesProjection();
      pres(q.placees + q.plat, attendu, `${nom} : la somme des poches`);
    }
  });

  test('une quote-part ne divise jamais la dette', () => {
    etat({ comptes: [BIEN(300000, { part: 50 }),
                     CTO([], [{ montant: 20000, affectation: 'courant' }])],
           dettes: [{ id: 'd1', libelle: 'Prêt', montant: 100000, taux: 2, mensualite: 800 }] });
    pres(patrimoine().brut, 170000, 'la moitié du bien, plus le cash');
    pres(dettesTotal(), 100000, 'la dette reste entière');
    pres(patrimoine().net, 70000, '150 000 + 20 000 − 100 000');
    pres(capitalisation({ years: 10 }).points[0].total, 70000,
      'et la projection part de la valeur personnelle, jamais de la valeur totale');
  });

  /* --- 2. le rendement --------------------------------------------------- */

  test('le fil électrique : 100 k, aucun taux, aucun versement, ligne plate', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0 } });
    const p = capitalisation({ years: 20 });
    for (const i of [0, 1, 5, 10, 20]) {
      pres(p.points[i].total, 100000, `année ${i} : rien ne bouge`);
    }
  });

  test('douze mois de rendement redonnent le taux annuel affiché', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: null, projRate: 10, projRateAutres: 0, projRateGaranti: 0 } });
    const p = capitalisation({ years: 20 });
    pres(p.points[1].total, 110000, 'après un an, +10 %');
    pres(p.points[2].total, 121000, 'après deux ans, la composition');
    pres(p.points[20].total, vfFormule(100000, 0, 10, 240),
      'et vingt ans suivent la formule fermée');
  });

  test('douze mois de versement font douze versements, pas onze ni treize', () => {
    etat({ comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: 1000, projVersementVers: 'marche' } });
    const p = capitalisation({ years: 10 });
    pres(p.points[1].total, 12000, 'un an');
    pres(p.points[10].total, 120000, 'dix ans');
    eq(projectionSettings().monthly, 1000, 'le versement est bien celui qu’on a réglé');
  });

  test('capital, versement et rendement suivent la formule fermée', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 10000 }])],
           meta: { projScenario: null, projRate: 6, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: 500, projVersementVers: 'marche' } });
    const p = capitalisation({ years: 10 });
    for (const an of [1, 5, 10]) {
      pres(p.points[an].total, vfFormule(10000, 500, 6, an * 12),
        `année ${an} : le moteur et l’annuité ordinaire disent la même chose`);
    }
  });

  test('le versement arrive en fin de mois, et le premier ne rapporte rien', () => {
    etat({ comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])],
           meta: { projScenario: null, projRate: 12, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: 100, projVersementVers: 'marche' } });
    const un = moteurProjection(Object.assign(configProjection({ years: 1 }), { mois: 1 }));
    pres(un.final.total, 100, 'un mois, un versement, aucun rendement dessus');
  });

  /* --- 3. les poches ----------------------------------------------------- */

  test('chaque euro est dans une poche et une seule', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 10000 },
                          { classe: 'obligations', valeur: 5000 },
                          { classe: 'crypto', valeur: 3000 },
                          { classe: 'nonCote', valeur: 4000 },
                          { classe: 'garanti', valeur: 6000 },
                          { classe: 'garanti', valeur: 8000, projet: true }],
                         [{ montant: 2000, affectation: 'courant' },
                          { montant: 1000, affectation: 'investir' }]),
                     BIEN(300000)],
           dettes: [{ id: 'd1', libelle: 'Prêt', montant: 100000 }] });
    const q = pochesProjection();
    pres(q.marche, 15000, 'actions et obligations');
    pres(q.autres, 7000, 'crypto et non coté');
    pres(q.garanti, 6000, 'le garanti, sa réserve retirée');
    pres(q.projet, 8000, 'et la réserve, à part');
    pres(q.liquidites, 3000, 'le cash, courant et à investir');
    pres(q.plat, 200000, 'le bien moins la dette');
    pres(q.placees + q.plat, patrimoine().net, 'la somme fait le patrimoine net');
  });

  test('l’argent réservé à un projet ne capitalise pas, et ne disparaît pas', () => {
    etat({ comptes: [CTO([{ classe: 'garanti', valeur: 15000, projet: true }],
                         [{ montant: 5000, affectation: 'investir' }])],
           meta: { projScenario: 'dynamique' } });
    const q = pochesProjection();
    pres(q.projet, 15000, 'la réserve est nommée');
    pres(q.liquidites, 5000, 'et le cash à investir reste du cash');
    const p = capitalisation({ years: 10 });
    pres(p.points[0].total, 20000, 'les vingt mille sont là au départ');
    pres(p.points[10].total, 20000,
      'et dix ans de scénario dynamique n’en font pas bouger un centime');
  });

  test('l’immobilier physique ne reçoit aucun rendement inventé', () => {
    etat({ comptes: [BIEN(300000)], meta: { projScenario: null, projRate: 10,
      projRateAutres: 0, projRateGaranti: 0 } });
    const p = capitalisation({ years: 20 });
    pres(p.points[20].total, 300000, 'vingt ans plus tard, le mur vaut toujours 300 000 €');
  });

  test('une SCPI est un placement, et reste constante faute d’hypothèse', () => {
    /* Elle etait rangee dans la poche PLATE, avec les murs, parce qu'elle
       partage leur classe. Le resultat chiffre etait le meme — cent mille euros
       constants — et le sens etait faux : la part plate est « ton immobilier
       net », une fiche qui la deballe ligne a ligne, et la projection annoncait
       donc une SCPI comme un bien gele. Elle est desormais dans « autres
       actifs », la poche de ce dont Longward ne sait rien : crypto, metaux, non
       cote. Zero par defaut, donc constante — mais du bon cote de la frontiere,
       et prete a recevoir une hypothese le jour ou il en existe une. */
    etat({ comptes: [SCPI(100000)], meta: { projScenario: 'dynamique' } });
    eq(estBienEnDirect(compteById('c_scpi')), false, 'une SCPI n’est pas détenue en direct');
    const q = pochesProjection();
    pres(q.plat, 0, 'aucune valeur n’est gelée comme un mur');
    pres(q.autres, 100000, 'elle est dans la poche des actifs sans hypothèse');
    pres(q.marche, 0, 'et ne reçoit pas le taux du marché');
    pres(q.placees + q.plat, patrimoine().net, 'elle est comptée une fois, et une seule');
    pres(capitalisation({ years: 20 }).points[20].total, 100000,
      'vingt ans de scénario dynamique n’inventent aucun rendement');
  });

  test('un mur reste plat, une SCPI ne l’est pas pour la même raison', () => {
    /* Le test qui compte : les deux valent cent mille, les deux sont de classe
       `immobilier`, et ils ne prennent pas le meme chemin. */
    etat({ comptes: [BIEN(100000)], meta: { projScenario: 'dynamique' } });
    pres(pochesProjection().plat, 100000, 'le mur est gelé');
    pres(pochesProjection().autres, 0, 'et n’entre dans aucune poche financière');
    etat({ comptes: [SCPI(100000)], meta: { projScenario: 'dynamique' } });
    pres(pochesProjection().plat, 0, 'la SCPI n’est pas gelée comme un mur');
    pres(pochesProjection().autres, 100000, 'elle est un avoir financier');
  });

  /* --- 4. les dettes ----------------------------------------------------- */

  test('un prêt à 0 % déclaré s’amortit, et s’arrête à zéro', () => {
    etat({ comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])],
           dettes: [{ id: 'd0', libelle: 'Prêt', montant: 12000, taux: 0, mensualite: 1000 }] });
    pres(patrimoine().net, -12000, 'on part de moins douze mille');
    const c = configProjection({ years: 3 });
    const un = moteurProjection(Object.assign({}, c, { mois: 1 }));
    pres(un.final.total, -11000, 'après un mois');
    const douze = moteurProjection(Object.assign({}, c, { mois: 12 }));
    pres(douze.final.total, 0, 'après douze mois, la dette est éteinte');
    const trente = moteurProjection(Object.assign({}, c, { mois: 36 }));
    pres(trente.final.total, 0, 'et rien ne continue à « rembourser » après');
    pres(trente.capitalRendu, 12000, 'le capital rendu vaut exactement la dette');
  });

  test('un taux absent n’est pas un taux de zéro', () => {
    etat({ comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])],
           dettes: [{ id: 'd0', libelle: 'Prêt', montant: 12000, mensualite: 1000 }] });
    eq(tauxCreditDeclare(etabById('e').dettes[0]), null, 'le taux est inconnu');
    eq(dettesAmortissables().length, 0, 'la dette n’est pas projetable');
    const p = capitalisation({ years: 10 });
    pres(p.points[10].total, -12000, 'elle reste donc constante : rien n’est inventé');
  });

  test('l’assurance ne rembourse pas de capital', () => {
    etat({ comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])],
           dettes: [{ id: 'd0', libelle: 'Prêt', montant: 100000, taux: 0,
                      mensualite: 1000, initial: 100000, tauxAssurance: 1.2 }] });
    const a = assuranceMensuelleCredit(etabById('e').dettes[0]);
    pres(a, 100, '1,2 % du capital emprunté, au mois');
    const d = dettesAmortissables()[0];
    pres(d.mens, 900, 'la part qui rembourse vaut la mensualité moins l’assurance');
    const c = configProjection({ years: 1 });
    pres(moteurProjection(Object.assign({}, c, { mois: 1 })).capitalRendu, 900,
      'et le premier mois rend neuf cents euros de capital, pas mille');
  });

  test('la dernière mensualité ne rembourse que ce qui reste', () => {
    etat({ comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])],
           dettes: [{ id: 'd0', libelle: 'Prêt', montant: 500, taux: 0, mensualite: 1000 }] });
    const c = configProjection({ years: 1 });
    const un = moteurProjection(Object.assign({}, c, { mois: 1 }));
    pres(un.capitalRendu, 500, 'cinq cents, pas mille');
    pres(un.final.total, 0, 'le patrimoine net remonte à zéro');
    const douze = moteurProjection(Object.assign({}, c, { mois: 12 }));
    pres(douze.final.total, 0, 'et n’est jamais positif du fait d’une dette éteinte');
  });

  test('la mensualité libérée ne devient pas un versement', () => {
    /* Sinon la projection inventerait : « a la fin du pret, tu investiras
       automatiquement toute ta mensualite ». Ce n'est pas une donnee declaree. */
    etat({ comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])],
           dettes: [{ id: 'd0', libelle: 'Prêt', montant: 12000, taux: 0, mensualite: 1000 }] });
    const p = capitalisation({ years: 10 });
    pres(p.points[1].total, 0, 'la dette est éteinte au bout d’un an');
    pres(p.points[10].total, 0, 'et neuf ans plus tard, rien n’a été investi à sa place');
  });

  test('plusieurs dettes s’additionnent, aucune n’en écrase une autre', () => {
    etat({ comptes: [BIEN(300000), CTO([], [{ montant: 10000, affectation: 'courant' }])],
           dettes: [
             { id: 'd1', libelle: 'Prêt immobilier', montant: 100000, taux: 2,
               mensualite: 1000, bienId: 'c_immo' },
             { id: 'd2', libelle: 'Perso', montant: 10000, taux: 0, mensualite: 500 },
             { id: 'd3', libelle: 'Sans taux', montant: 5000, mensualite: 200 }] });
    pres(dettesTotal(), 115000, 'les trois dettes comptent');
    pres(patrimoine().net, 195000, '310 000 − 115 000');
    pres(capitalisation({ years: 10 }).points[0].total, 195000,
      'et la projection part de là : un bienId ne retire aucune dette d’ici');
    eq(dettesAmortissables().length, 2, 'deux sont projetables, celle sans taux ne l’est pas');
  });

  test('un bien financé monte par sa seule dette qui descend', () => {
    etat({ comptes: [BIEN(300000), CTO([], [{ montant: 20000, affectation: 'courant' }])],
           dettes: [{ id: 'd1', libelle: 'Prêt', montant: 200000, taux: 0, mensualite: 2000 }],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0 } });
    const p = capitalisation({ years: 20 });
    pres(p.points[0].total, 120000, 'au départ');
    pres(p.points[10].total, 320000, 'dette éteinte au bout de cent mois : 300 000 + 20 000');
    pres(p.points[20].total, 320000, 'et pas un euro de plus ensuite');
  });

  /* --- 5. l'inflation ---------------------------------------------------- */

  test('l’inflation ne touche pas le nominal, et se retire une seule fois', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0,
                   projInflation: 2 } });
    const p = capitalisation({ years: 10 });
    pres(p.points[1].total, 100000, 'le nominal ne bouge pas');
    pres(p.points[1].real, 100000 / 1.02, 'et le réel se déflate d’une seule année');
    pres(p.points[10].real, 100000 / Math.pow(1.02, 10), 'de dix, dix ans plus tard');
  });

  test('rendement et inflation se composent, ils ne se soustraient pas', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: null, projRate: 5, projRateAutres: 0, projRateGaranti: 0,
                   projInflation: 2 } });
    const p = capitalisation({ years: 10 });
    pres(p.points[1].total, 105000, 'nominal');
    pres(p.points[1].real, 105000 / 1.02, 'réel');
    vrai(Math.abs(p.points[1].real - 103000) > 50,
      'et non le nominal moins trois pour cent, qui serait une approximation');
  });

  test('l’inflation à zéro est une valeur, et ne fait pas basculer le scénario', () => {
    etat({ meta: { projScenario: 'central', projInflation: 0 } });
    eq(projectionSettings().inflation, 0, 'zéro se lit tel quel');
    eq(projectionSettings().scenario, 'central', 'et le scénario reste central');
    etat({ meta: { projScenario: 'central', projInflation: 3 } });
    eq(projectionSettings().scenario, 'central',
      'changer l’inflation ne quitte pas le scénario : elle n’en fait pas partie');
    vrai(!POCHES_SCENARIO.includes('inflation'),
      'et la table des scénarios ne la porte pas');
  });

  /* --- 6. les scenarios -------------------------------------------------- */

  test('chaque scénario applique ses propres taux, lus dans la table', () => {
    for (const [cle, , preset] of SCENARIOS_PROJECTION) {
      etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
             meta: { projScenario: cle } });
      const s = projectionSettings();
      eq(s.scenario, cle, `« ${cle} » se relit comme lui-même`);
      pres(s.rate, preset.marche, `le taux du marché de « ${cle} »`);
      pres(s.rateGaranti, preset.garanti, `celui du garanti`);
      pres(capitalisation({ years: 1 }).points[1].total,
        100000 * (1 + preset.marche / 100),
        `et un an de « ${cle} » donne son taux annoncé`);
    }
  });

  test('le scénario ne s’accumule pas : aller et retour donnent la même série', () => {
    const serie = () => capitalisation({ years: 10 }).points.map(p => round2(p.total)).join('|');
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: 'prudent' } });
    const depart = serie();
    for (const cle of ['central', 'dynamique', 'prudent']) {
      Store.state.meta.projScenario = cle;
      capitalisation({ years: 10 });
    }
    eq(serie(), depart, 'le même état et le même scénario reproduisent la même courbe');
  });

  /* --- 7. le versement, sa source et son mode ---------------------------- */

  test('le versement automatique vient du budget, et de rien d’autre', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projMonthly: undefined },
           budget: { income: [{ label: 'Salaire', amount: 4000 }],
                     fixedCharges: [{ label: 'Loyer', amount: 1500, period: 'mois' }],
                     expenses: [{ month: '2026-01', v: { Courses: 1500 }, note: '' }],
                     monthlyTarget: 1500 } });
    delete Store.state.meta.projMonthly;
    eq(suggestedMonthly(), 1000, '4 000 − 1 500 − 1 500');
    eq(projectionSettings().monthly, 1000, 'et la projection le reprend');
    eq(projectionSettings().monthlyAuto, true, 'en mode automatique');
  });

  test('un historique patrimonial ne devient jamais un versement', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projMonthly: undefined } });
    delete Store.state.meta.projMonthly;
    Store.state.monthly = [{ date: '2026-01-31', comment: '', v: { c_ct: 100000 } },
                           { date: '2026-02-28', comment: '', v: { c_ct: 105000 } },
                           { date: '2026-03-31', comment: '', v: { c_ct: 110000 } }];
    vrai(savingsReconciliation().realPerMonth > 0, 'le patrimoine monte vraiment');
    eq(suggestedMonthly(), 0, 'et le versement proposé reste nul : le budget ne laisse rien');
  });

  test('zéro figé, zéro automatique et cinq cents sont trois états distincts', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])], meta: {} });
    delete Store.state.meta.projMonthly;
    eq(projectionSettings().monthlyAuto, true, 'clef absente : automatique');
    Store.state.meta.projMonthly = 0;
    eq(projectionSettings().monthlyAuto, false, 'zéro réglé : un choix');
    eq(projectionSettings().monthly, 0, 'et il vaut zéro');
    Store.state.meta.projMonthly = 500;
    eq(projectionSettings().monthly, 500, 'cinq cents se lit tel quel');
    eq(projectionSettings().monthlyAuto, false, 'et reste un choix');
  });

  test('le capital remboursé n’est jamais un versement', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 0 }])],
           dettes: [{ id: 'd0', libelle: 'Prêt', montant: 120000, taux: 0, mensualite: 800 }],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: undefined },
           budget: { income: [{ label: 'Salaire', amount: 2000 }],
                     fixedCharges: [{ label: 'Prêt', amount: 800, period: 'mois' }],
                     expenses: [{ month: '2026-01', v: { Courses: 700 }, note: '' }],
                     monthlyTarget: 700 } });
    delete Store.state.meta.projMonthly;
    eq(suggestedMonthly(), 500, '2 000 − 800 − 700 : le capital remboursé n’y entre pas');
    const c = configProjection({ years: 1 });
    pres(c.monthly, 500, 'et le moteur reçoit cinq cents, pas mille trois cents');
    const un = moteurProjection(Object.assign({}, c, { mois: 12 }));
    pres(un.capitalRendu, 9600, 'le capital rendu vit à part, 800 × 12');
    pres(un.final.total - c.marche - c.autres - c.garanti - c.liquidites - c.plat,
      500 * 12 + 9600, 'les deux effets s’additionnent une fois chacun');
  });

  /* --- 8. la decomposition ----------------------------------------------- */

  test('la hausse se décompose : versements plus désendettement', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           dettes: [{ id: 'd0', libelle: 'Prêt', montant: 60000, taux: 0, mensualite: 5000 / 12 }],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: 1000, projVersementVers: 'marche' } });
    const p = capitalisation({ years: 1 });
    pres(p.points[1].total - p.points[0].total, 12000 + 5000,
      'douze mille de versements et cinq mille de passif disparu');
    vrai(Math.abs(p.points[1].total - p.points[0].total - 22000) > 100,
      'et non les deux comptés deux fois');
    pres(p.points[1].contributed + p.points[1].gains, p.points[1].total,
      'versé plus gains font le total, à chaque point');
  });

  /* --- 9. l'horizon, la cible, la bande ---------------------------------- */

  test('un horizon de N années donne 12N périodes, sans off-by-one', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: null, projRate: 10, projRateAutres: 0, projRateGaranti: 0 } });
    for (const n of [1, 5, 10, 20]) {
      const p = capitalisation({ years: n });
      eq(p.points.length, n + 1, `${n} ans : ${n} points annuels plus le départ`);
      pres(p.points[n].total, vfFormule(100000, 0, 10, 12 * n),
        `${n} ans : exactement ${12 * n} mois de rendement`);
    }
  });

  test('la bande encadre la courbe, et part du même point', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: 'central' } });
    const s = projectionSettings();
    const c = capitalisation({ years: 20 });
    const bas = capitalisation({ years: 20, rate: num(s.rate) - 2 });
    const haut = capitalisation({ years: 20, rate: num(s.rate) + 2 });
    eq(bas.points.length, c.points.length, 'les trois séries ont la même longueur');
    for (let i = 0; i < c.points.length; i++) {
      vrai(bas.points[i].total <= c.points[i].total + 0.005
        && c.points[i].total <= haut.points[i].total + 0.005,
        `année ${i} : bas ≤ central ≤ haut`);
    }
    pres(bas.points[0].total, c.points[0].total, 'et le départ est le même');
    pres(haut.points[0].total, c.points[0].total, 'des trois côtés');
  });

  test('l’année d’atteinte vient de la série, et une cible nulle n’en est pas une', () => {
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: 1000, projVersementVers: 'marche', projTarget: 112000 } });
    const p = capitalisation({ years: 10 });
    vrai(p.targetReached, 'la cible est atteinte');
    eq(p.targetReached.monthsFromNow, 12, 'au douzième mois, comme la série le montre');
    pres(p.points[1].total, 112000, 'et le point de l’année vaut exactement la cible');
    Store.state.meta.projTarget = 0;
    eq(projectionSettings().target, 0, 'zéro veut dire « pas de cible »');
    eq(capitalisation({ years: 10 }).targetReached, null, 'et rien ne se déclare atteint');
  });

  /* --- 10. robustesse ---------------------------------------------------- */

  test('aucun NaN, aucun infini, dans les cas limites', () => {
    const cas = [
      ['tout à zéro', { comptes: [CTO([], [{ montant: 0, affectation: 'courant' }])] }],
      ['sans aucun compte', {}],
      ['net négatif', { comptes: [CTO([], [{ montant: 20000, affectation: 'courant' }])],
        dettes: [{ id: 'd', libelle: 'Perso', montant: 30000, taux: 0, mensualite: 1000 }] }],
      ['dette sans mensualité', { comptes: [CTO([{ classe: 'actions', valeur: 1000 }])],
        dettes: [{ id: 'd', libelle: 'Perso', montant: 5000, taux: 3 }] }],
    ];
    for (const [nom, cfg] of cas) {
      etat(cfg);
      for (const an of [1, 20]) {
        const p = capitalisation({ years: an });
        for (const pt of p.points) {
          for (const k of ['total', 'contributed', 'gains', 'real', 'plat', 'mois']) {
            vrai(Number.isFinite(pt[k]), `${nom} · ${an} ans : « ${k} » doit être fini`);
          }
        }
      }
    }
  });

  test('un patrimoine net négatif reste négatif, et franchit zéro proprement', () => {
    etat({ comptes: [CTO([], [{ montant: 20000, affectation: 'courant' }])],
           dettes: [{ id: 'd', libelle: 'Perso', montant: 30000, taux: 0, mensualite: 1000 }],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: 1000, projVersementVers: 'liquidites' } });
    const p = capitalisation({ years: 5 });
    pres(p.points[0].total, -10000, 'on part de moins dix mille, sans plancher');
    const c = configProjection({ years: 5 });
    /* Mille de versement et mille de capital rembourse par mois : le net monte
       de deux mille par mois, donc zero se franchit au cinquieme. */
    for (const [mois, attendu] of [[1, -8000], [5, 0], [12, 14000]]) {
      pres(moteurProjection(Object.assign({}, c, { mois })).final.total, attendu,
        `au mois ${mois}`);
    }
  });

  /* --- 11. la composition ------------------------------------------------ */

  test('« ce que tu verses » ne compte que ce qu’on verse', () => {
    /* LE DEFAUT. Le montant valait `contributed - patrimoine net`, et
       `contributed` porte la part plate, qui MONTE quand le credit s'amortit.
       Sur un appartement finance, avec « 0 {dev} / mois » ecrit deux lignes plus
       bas, la carte annoncait donc « Ce que tu verses : 196 531 € ». */
    etat({ comptes: [BIEN(300000), CTO([], [{ montant: 20000, affectation: 'courant' }])],
           dettes: [{ id: 'd', libelle: 'Prêt', montant: 200000, taux: 2, mensualite: 1000 }],
           meta: { projScenario: null, projRate: 0, projRateAutres: 0, projRateGaranti: 0,
                   projMonthly: 0, projHorizon: 20 } });
    const p = capitalisation({ years: 20 });
    const d = p.points[20];
    eq(projectionSettings().monthly, 0, 'aucun versement n’est réglé');
    pres(d.mois * projectionSettings().monthly, 0, 'donc rien n’est versé');
    vrai(d.capitalRendu > 190000, `et le crédit a remboursé ${Math.round(d.capitalRendu)} €`);
    /* Les quatre parts de la carte, et leur somme exacte. */
    const base = patrimoine().net - p.plat;
    const parts = base + p.plat + d.mois * projectionSettings().monthly + d.capitalRendu + d.gains;
    pres(parts, d.total, 'départ, versements, capital remboursé et rendement font le total');
    const src = lireSource('assets/app.js');
    vrai(/const verses = num\(dernier\.mois\) \* num\(s\.monthly\);/.test(src),
      'le montant versé se compte en mois de versement');
    vrai(/const rembourse = num\(dernier\.capitalRendu\);/.test(src),
      'et le désendettement a sa propre part');
    vrai(!/const verses = Math\.max\(0, dernier\.contributed - g\.total\);/.test(src),
      'l’ancien calcul, qui mélangeait les deux, est parti');
    vrai(/Ce que ton crédit rembourse/.test(src), 'et elle porte son nom');
    vrai(I18N.en['Ce que ton crédit rembourse'], 'traduit');
  });

  test('chaque point porte la même forme, y compris le premier', () => {
    /* Une serie dont le point zero n'a pas les champs de ses voisins est un
       piege : une infobulle qui ventile la composition ne trouve rien a
       l'annee zero, et rien ne le dit avant l'ecran. */
    etat({ comptes: [CTO([{ classe: 'actions', valeur: 100000 }])] });
    const p = capitalisation({ years: 5 });
    const champs = Object.keys(p.points[5]).sort().join(',');
    for (let i = 0; i < p.points.length; i++) {
      eq(Object.keys(p.points[i]).sort().join(','), champs,
        `le point ${i} porte les mêmes champs que les autres`);
    }
    eq(p.points[0].mois, 0, 'et le premier est à zéro mois');
    pres(p.points[0].capitalRendu, 0, 'sans capital remboursé');
    pres(p.points[0].poches.marche + p.points[0].poches.autres + p.points[0].poches.garanti
       + p.points[0].poches.liquidites + p.points[0].poches.plat, p.points[0].total,
      'ses poches font déjà son total');
  });

  test('l’aire empilée sait descendre sous zéro', () => {
    /* Le cadre partait toujours de zero : une courbe negative se dessinait sous
       lui, invisible, et l'axe annoncait « 0 € » au-dessus d'elle. */
    const src = lireSource('assets/charts.js');
    vrai(/function niceTicksSignes\(min, max, count = 4\)/.test(src),
      'les graduations savent encadrer un intervalle signé');
    vrai(/if \(min >= 0\) return niceTicks\(max, count\);/.test(src),
      'et rendent exactement les anciennes quand rien n’est négatif');
    vrai(/const minV = Math\.min\(0, \.\.\.totals,/.test(src),
      'le bas du cadre vient de la série, bande comprise');
    vrai(/const y = v => m\.t \+ ih - \(\(v - bas\) \/ etendue\) \* ih;/.test(src),
      'et l’échelle part de ce bas');
    /* L'empilement et l'animation suivent la meme echelle : trois formules
       pour un seul cadre finiraient par ne plus empiler pareil. */
    vrai(/function empiler\(valeur, topC, cles, basC = bas\)/.test(src),
      'l’empilement reçoit le bas du cadre');
    vrai(/const basC = num\(avant\.bas\) \+ \(bas - num\(avant\.bas\)\) \* e;/.test(src),
      'et l’animation l’interpole comme le haut');
    vrai(/^\s+bas,$/m.test(src), 'la mémoire du dessin précédent le garde');
  });

  /* --- 12. le fixture de reference --------------------------------------- */

  test('le scénario complet se réconcilie à t0, 1, 5 et 10 ans', () => {
    etat({ comptes: [
             CTO([{ classe: 'actions', valeur: 50000 }],
                 [{ montant: 10000, affectation: 'investir' }]),
             BIEN(300000)],
           dettes: [{ id: 'd1', libelle: 'Prêt', montant: 180000, taux: 2,
                      mensualite: 1000, bienId: 'c_immo' }],
           meta: { projScenario: 'central', projInflation: 2, projMonthly: 500,
                   projVersementVers: 'marche', projHorizon: 10 } });
    /* Le cash de projet vit sur une ligne, pas sur du cash : on le pose ici. */
    Store.state.comptes[0].lignes.push({ id: 'lp', classe: 'garanti', libelle: 'Projet',
      valeur: 10000, prixDeRevient: 10000, quantite: 1, dateAcquisition: '', projet: true });
    refreshAccounts();

    const q = pochesProjection();
    pres(q.marche, 50000, 'les actifs de marché');
    pres(q.liquidites, 10000, 'le cash');
    pres(q.projet, 10000, 'la réserve de projet');
    pres(q.plat, 120000, 'le bien moins sa dette');
    pres(q.placees + q.plat, patrimoine().net, 'et la somme fait le net : 190 000');
    pres(patrimoine().net, 190000, 'qui vaut bien 360 000 − 180 000 + 10 000');

    const p = capitalisation({ years: 10 });
    pres(p.points[0].total, 190000, 't0 = patrimoine net');
    for (const an of [1, 5, 10]) {
      const pt = p.points[an];
      pres(pt.poches.marche + pt.poches.autres + pt.poches.garanti
         + pt.poches.liquidites + pt.poches.plat, pt.total,
        `année ${an} : la somme des poches fait le total`);
      pres(pt.contributed + pt.gains, pt.total, `année ${an} : versé plus gains`);
      pres(pt.real, pt.total / Math.pow(1.02, an), `année ${an} : le réel se déduit du nominal`);
      pres(pt.poches.marche, vfFormule(50000, 500, 6, an * 12),
        `année ${an} : la poche de marché suit la formule`);
      /* La reserve de projet traverse la projection DANS la poche des
         liquidites : `configProjection` les additionne, parce que toutes deux
         sont portees a plat. Les dix mille de cash et les dix mille reserves y
         sont donc ensemble, et aucun euro ne se perd. */
      pres(pt.poches.liquidites, 20000,
        `année ${an} : le cash et la réserve traversent à plat, ensemble`);
      vrai(pt.plat >= 120000 && pt.plat <= 300000,
        `année ${an} : la part plate monte avec le désendettement, sans dépasser le bien`);
    }
    pres(p.points[10].plat, 120000 + moteurProjection(configProjection({ years: 10 })).capitalRendu,
      'et la part plate vaut le départ plus le capital rendu');
  });
});


suite('Le Budget avant la première dépense', () => {
  test('la brique du mois dit ce qu’elle permet, au lieu de quatre zéros', () => {
    /* Sur un profil vierge, l'onglet Dépenses ouvrait sur « 0 € », puis
       « Objectif mensuel 0 € », « Reste sur l'objectif 0 € », « Moyenne 2026
       0 € ». Quatre nombres qui disent tous la même chose — rien n'est saisi —
       et qui font croire à un tableau cassé plutôt qu'à un produit qui
       accompagne. Les tuiles et le graphique avaient déjà leur garde ; la
       brique du haut la reçoit, avec la phrase des autres états vides : ce que
       la section permet, et le geste qui la remplit. */
    const app = lireSource('assets/app.js');
    const dv = app.indexOf('function viewBudget(');
    const vue = app.slice(dv, app.indexOf('\nfunction ', dv + 10));
    vrai(/\$\{aDesDepensesSaisies\(\) \? `\s*<div class="hero card-cliquable">/.test(vue),
      'la brique pleine ne se rend qu’après une première dépense');
    vrai(/: briqueDepensesVide\(f\)\}/.test(vue),
      'et la brique vide la remplace, avec le cadre du budget');
    const db = app.indexOf('function briqueDepensesVide(');
    const brique = app.slice(db, app.indexOf('\nfunction ', db + 10)).replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/data-action="saisir-mois-courant"/.test(brique),
      'le geste est celui de la brique pleine : saisir le mois');
    vrai(/Suis ce que tu dépenses chaque mois/.test(brique), 'et elle dit à quoi sert la section');
    vrai(!/fmtEUR0\(0\)|0 €/.test(brique), 'sans un seul zéro');
    vrai(/f\.target > 0/.test(brique),
      'un objectif déjà réglé se lit ; sinon on propose de le régler, jamais « 0 € »');
    for (const cle of ['Suis ce que tu dépenses chaque mois. Saisis un premier mois pour découvrir ta moyenne mensuelle et ce qu’il te reste réellement.',
                       'Régler un objectif mensuel', 'Saisir les dépenses du mois']) {
      vrai(!!I18N.en[cle], '« ' + cle.slice(0, 40) + ' » existe en anglais');
    }
  });
});


suite('Le bruit informatif', () => {
  test('une variation nulle ne prend pas de place', () => {
    /* « +0 € depuis août 26 » sous un livret qui n'a pas bougé : un changement
       nul n'apprend rien, et il occupait la place d'une information sur chaque
       ligne stable. Positive ou négative, la variation s'écrit ; nulle, la
       place reste vide pour que les rangées gardent leur hauteur. */
    const app = lireSource('assets/app.js');
    const dl = app.indexOf('function ligneCompte(');
    const ligne = app.slice(dl, app.indexOf('\nfunction ', dl + 10));
    vrai(/const bouge = v && Math\.abs\(v\.eur\) >= 0\.5;/.test(ligne),
      'la ligne décide sur l’euro affiché : le format arrondit à l’euro, et −0,30 € s’écrivait « −0 € »');
    vrai(/: bouge \? `<span class="sub" title=/.test(ligne), 'et n’écrit la variation que si elle bouge');
    /* Un ecart entre deux valeurs du compte comprend les versements : il ne se
       peint ni en vert ni en rouge, il ne se lit pas comme une plus-value. */
    vrai(!/cls\(v\.eur\)/.test(ligne), 'à l’encre neutre');
    vrai(/trad\('par rapport à'\)/.test(ligne) && /Versements et retraits compris : ce n’est pas une plus-value/.test(ligne),
      'en écart, et l’infobulle dit ce qu’il contient');
    vrai(/: `<span class="sub">&nbsp;<\/span>`/.test(ligne), 'sinon la place reste, vide');
    vrai(/const ytdBouge = d\.ytd && Math\.abs\(d\.ytd\.eur\) >= 0\.5;/.test(app),
      'le pied du menu suit la même règle pour « depuis janvier »');
  });

  test('la moyenne des dépenses se lit dans sa tuile, pas trois fois', () => {
    /* La brique du mois disait « Moyenne 2026 1 166 € » pendant que la tuile
       donnait « 1 166,25 € » et le pied du graphique « 1 166 {dev} / mois ».
       Même métrique, deux précisions : on se demandait si c'était la même
       chose. La tuile la porte avec sa base et sa fiche ; le pied du graphique
       la garde parce qu'il la met face à l'objectif. La brique parle du mois. */
    const app = lireSource('assets/app.js');
    const dv = app.indexOf('function viewBudget(');
    const vue = app.slice(dv, app.indexOf('\nfunction ', dv + 10)).replace(/<!--[\s\S]*?-->/g, '');
    const brique = vue.slice(vue.indexOf('<div class="hero card-cliquable">'), vue.indexOf('<!-- Le second champ') > 0 ? vue.indexOf('<!-- Le second champ') : vue.indexOf('class="grid g-4 g-tuiles"'));
    vrai(brique.length > 500, 'la brique du mois doit être trouvable');
    vrai(!/trad\('Moyenne'\)/.test(brique), 'la brique du mois ne porte plus la moyenne');
    eq((vue.match(/\$\{trad\('Moyenne'\)\} \$\{esc\(year\)\}/g) || []).length, 1,
      '« Moyenne {année} » ne s’écrit plus qu’une fois, sous le graphique, face à l’objectif');
    vrai(/tile\('Moyenne par mois', stats\.average/.test(vue), 'et la tuile reste la porteuse du chiffre exact');
  });

  test('un rappel, une couleur', () => {
    /* Les pastilles des onglets et des sous-onglets sont orange ; celle de la
       cloche, qui annonce les mêmes rappels, était rouge. Deux couleurs pour un
       même signal se lisent comme deux signaux. Le rouge reste au critique. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const regle = sel => (css.match(new RegExp(sel + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
    for (const sel of ['\\.badge', '\\.sous-onglets \\.pastille-onglet', '\\.pastille-ronde']) {
      vrai(/background:\s*var\(--warning\)/.test(regle(sel)), `${sel} porte la couleur du rappel`);
    }
  });
});


suite('Le relevé mensuel se comprend en dix secondes', () => {
  /* Le formulaire s'ouvrait a nu — douze poches, douze champs — et rien ne
     disait pourquoi on les remplit, pourquoi les comptes viennent avant, ce
     que l'application en fait, ni pourquoi revenir le mois prochain. Le modele
     tient en une ligne : creer ses poches → en renseigner la valeur chaque
     mois → Longward les additionne → la courbe se dessine. Ces controles
     gardent les endroits ou cette ligne se lit. Aucun calcul ne bouge. */
  const app = () => lireSource('assets/app.js');

  test('avant le premier relevé, une étape dit le modèle — sans bloquer', () => {
    const src = app();
    const d = src.indexOf("async 'ajouter-releve'()");
    const a = src.slice(d, src.indexOf('\n  },\n', d));
    vrai(/if \(!aUnRelevePatrimonial\(\)\) \{/.test(a), 'l’étape ne paraît qu’avant le premier relevé');
    vrai(/trad\('Avant ton premier relevé'\)/.test(a), 'et elle s’annonce comme telle');
    /* Le bouton plein fait ce qu'on a touche ; verifier ses poches reste
       propose, en second. L'inverse repondait « non » au geste demande. */
    vrai(/ok: trad\('Enregistrer mon relevé'\)/.test(a), 'le geste principal enregistre le relevé');
    vrai(/refus: trad\('Vérifier mes comptes et actifs'\)/.test(a), 'le second mène aux poches');
    vrai(/if \(enregistrer === false\) \{ location\.hash = '#\/accounts'; return; \}/.test(a),
      'vérifier, c’est aller voir la liste');
    vrai(/if \(!enregistrer\) return;/.test(a), 'et fermer la fenêtre, c’est rester');
    vrai(!/As-tu bien rentré/.test(a), 'la question fermée est partie : on explique, on ne quizze pas');
    vrai(/await askMonthlySnapshot\(indexReleve\(currentMonthKey\(\)\)\);/.test(a),
      'et la fenêtre s’ouvre toujours sur le mois en cours');
  });

  test('la fenêtre du premier relevé dit ce qu’elle photographie, les suivantes vont droit au but', () => {
    const src = app();
    const d = src.indexOf('function askMonthlySnapshot(');
    const f = src.slice(d, src.indexOf('\nfunction ', d + 10));
    vrai(/const premier = !Store\.state\.monthly\.some\(\(x, i\) => i !== index && !rowIsEmpty\(x\)\);/.test(f),
      '« premier » : aucun AUTRE mois ne porte de montants');
    vrai(/trad\('La photo de ton patrimoine pour \{m\}\.'\)/.test(f)
      && /trad\('Chaque poche est préremplie avec sa valeur d’aujourd’hui : vérifie, corrige si besoin, puis enregistre\.'\)/.test(f),
      'le premier relevé se présente en deux phrases');
    vrai(/trad\('Mets à jour la valeur de chaque poche pour enregistrer ton patrimoine de \{m\}\.'\)/.test(f),
      'les suivants en une');
    vrai(!/Aucun relevé avant celui-ci/.test(f) && !/valeurs brutes, crédits à part/.test(f),
      'le sous-titre technique a disparu');
    vrai(/<span class="dep-libelle">\$\{trad\('Total du relevé'\)\}/.test(f), 'le total porte son nom');
    vrai(/trad\('Préremplir avec les montants actuels'\)/.test(f), 'le préremplissage se nomme');
    vrai(!/Remplir tous les champs/.test(f), 'et n’est plus redit avec d’autres mots');
    vrai(/premier && !notifsMasquees\(\)\.includes\(CLE_INVENTAIRE\) \? `/.test(f),
      'la note de complétude ne paraît qu’au premier relevé, hors inventaire déclaré');
    vrai(/trad\('Ton patrimoine est-il complet \?'\)/.test(f) && /id="relVerifier"/.test(f),
      'elle informe et offre d’aller vérifier, sans bloquer');
  });

  test('le premier relevé enregistré se raconte ; les suivants gardent leur toast', () => {
    const src = app();
    const d = src.indexOf('function askMonthlySnapshot(');
    const f = src.slice(d, src.indexOf('\nfunction ', d + 10));
    const e = f.indexOf('const enregistrer = async () => {');
    const enr = f.slice(e, f.indexOf('$(\'#relOk\').onclick', e));
    vrai(/if \(premier\) \{/.test(enr), 'un mot au premier enregistrement');
    vrai(/trad\('Ton patrimoine de \{m\} est de \{v\}\.'\)/.test(enr), 'qui dit ce que le mois enregistre');
    vrai(/ok: trad\('Voir mon historique'\)/.test(enr) && /location\.hash = '#\/history'/.test(enr),
      'et mène là où le point vient de s’inscrire');
    vrai(enr.indexOf('if (premier) {') < enr.indexOf('toast(`${fmtMonth(r.date)} · '),
      'le toast reste pour les mois suivants');
    vrai(/if \(!ouverte\) return;/.test(f), 'fermer deux fois ne ferme qu’une fois');
  });

  test('« snapshot » a quitté l’interface, le bandeau parle de courbe', () => {
    const src = app();
    vrai(!/trad\('[^']*snapshot/i.test(src), 'aucun libellé français ne dit snapshot');
    vrai(!Object.keys(I18N.en).some(k => /snapshot/i.test(k)), 'ni aucune clef');
    vrai(/trad\('Enregistrer le relevé de'\)/.test(src), 'le bandeau enregistre un relevé');
    vrai(/trad\('Ajoute ce mois à ta courbe de patrimoine · \{v\} aujourd’hui'\)/.test(src),
      'et dit ce qu’il ajoute : un point sur la courbe');
    const pas = PREMIERS_PAS.find(p => p.cle === 'releves');
    vrai(/poches additionnées en un patrimoine total/.test(pas.quoi) && /chaque mois/.test(pas.quoi),
      'le pas du guide raconte le même modèle');
  });

  test('chaque phrase neuve a son anglais, et les mortes sont parties', () => {
    for (const cle of ['Avant ton premier relevé', 'Vérifier mes comptes et actifs', 'Enregistrer mon relevé',
                       'La photo de ton patrimoine pour {m}.', 'Total du relevé',
                       'Préremplir avec les montants actuels', 'Ton patrimoine est-il complet ?',
                       'Vérifier mes poches', 'Ton patrimoine de {m} est de {v}.', 'Voir mon historique',
                       'Enregistrer le relevé de', 'Tu pourras toujours ajouter d’autres poches plus tard.']) {
      vrai(!!I18N.en[cle], '« ' + cle + ' » existe en anglais');
    }
    for (const morte of ['Prendre le snapshot de', 'Reprendre les montants actuels,',
                         'Remplir tous les champs automatiquement', 'Aucun relevé avant celui-ci',
                         'As-tu bien rentré tous tes comptes ?']) {
      vrai(!I18N.en[morte], '« ' + morte + ' » n’a plus d’appelant');
    }
  });
});

finDePartieDeTests('tests/20-versement-propose-vient-budget.tests.js');
