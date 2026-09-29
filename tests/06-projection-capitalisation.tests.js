partieDeTests('tests/06-projection-capitalisation.tests.js');
/* ------------------------------------------------------------------
   8. La projection
   ------------------------------------------------------------------ */
suite('Projection de capitalisation', () => {

  test('départ + versements + rendement font le total', () => {
    /* La carte d'Objectif repose entièrement sur cette égalité, et sur le fait
       que `contributed` contient le capital de départ. */
    Fixture.poser();
    const p = capitalisation({ years: 10 });
    const d = p.points[p.points.length - 1];
    pres(d.contributed + d.gains, d.total, 'contributed + gains = total');
    vrai(d.contributed >= patrimoine().net,
      'contributed inclut le capital de départ, il ne peut pas lui être inférieur');
  });

  test('les trois poches font le patrimoine net', () => {
    /* La propriete qui garantit qu'aucun euro ne se perd ni ne se dedouble en
       changeant de poche. Si elle casse, la courbe entiere est fausse sans que
       rien ne le signale a l'ecran : les trois montants sont plausibles
       separement. */
    Fixture.poser();
    const q = pochesProjection();
    pres(q.placees + q.plat, patrimoine().net,
      'ce qui capitalise, plus ce qui est porté à plat, fait le patrimoine net');
    pres(q.placees, q.marche + q.autres + q.garanti + q.liquidites + q.projet,
      'et « placees » est bien la somme des poches, non un second calcul');
    /* Et le cash « à investir » est du côté des liquidités, pas du marché.

       Cette assertion disait exactement l'inverse, et elle passait : elle
       vérifiait `q.marche >= 1500` alors que le fixture porte 9 750 € de titres,
       donc elle aurait passé quelle que soit la poche du cash. Un test vert qui
       lit autre chose que ce qu'il croit lire est un test absent — c'est la
       leçon du 5 août, réapprise ici. Elle est écrite au montant exact,
       maintenant, et sur les deux poches à la fois : le cash à investir ne peut
       plus changer de côté sans qu'une des deux tombe. */
    pres(q.liquidites, nowTotals().cash,
      'les liquidités de la projection sont celles de l’accueil, cash à investir compris');
    pres(q.marche, num(nowTotals().bourse) - valeurMetaux(),
      'et la poche de marché porte le portefeuille coté, les métaux mis à part');
    vrai(q.liquidites >= Fixture.CASH_A_INVESTIR,
      'le cash à investir est dans les liquidités : tant qu’il n’est pas placé, '
      + 'il ne rapporte rien');
  });

  test('un rendement des autres actifs à zéro les porte à plat', () => {
    Fixture.poser(s => { s.meta.projRateAutres = 0; });
    const d = capitalisation({ years: 10 }).points.at(-1);
    pres(d.contributed + d.gains, d.total, 'l’égalité fondatrice tient');
    pres(d.gainsAutres, 0, 'aucun gain sur les autres actifs');
    pres(d.gains, d.gainsMarche, 'tout le rendement vient du marché');
  });

  test('les deux taux au même niveau reproduisent le taux unique', () => {
    /* Le test de non-regression, et le plus important du lot. Il dit
       exactement ce qui doit etre vrai, et c'est ce que la migration garantit :
       un etat qui herite de son propre taux garde ses chiffres au centime.

       J'avais d'abord ecrit que « zero par defaut ne change rien ». C'etait
       faux, et ce test l'a attrape : avant, un seul taux s'appliquait aussi au
       non cote et aux liquidites, donc les porter a plat faisait baisser la
       projection de 4 402 EUR sur ce fixture. La valeur neutre n'est pas zero,
       c'est le taux du marche. */
    /* La propriete se verifie sur les deux poches qui capitalisent au meme
       taux quand on les y met — marche et autres actifs. Le garanti a le sien,
       les liquidites sont plates par construction : on les met de cote pour
       comparer ce qui est comparable. */
    Fixture.poser(s => {
      s.meta.projRate = 5; s.meta.projRateAutres = 5; s.meta.projRateGaranti = 0;
    });
    const q = pochesProjection();
    const deuxTaux = capitalisation({ years: 10 }).points.at(-1);
    /* Le meme calcul en forçant les deux poches dans une seule, ce qui reproduit
       l'ancien modele a un seul taux. */
    const unTaux = capitalisation({ years: 10, start: q.marche + q.autres }).points.at(-1);
    pres(deuxTaux.total - q.liquidites - q.garanti - q.projet, unTaux.total,
      'même total qu’avec un taux unique, les poches plates mises à part');
    pres(deuxTaux.gains, unTaux.gains, 'et les mêmes gains');
  });

  test('le cash à investir est du cash sur tous les écrans', () => {
    /* Il etait compte dans les actifs de marche de la projection, au motif qu'il
       leur est destine. Sur l'accueil, le meme argent compte dans
       « Liquidites ». La meme somme portait donc deux classements selon l'ecran
       — le defaut que ce projet corrige partout ailleurs — et l'application
       affirmait au passage un rendement sur de l'argent qui n'en produit aucun,
       ce qu'elle refuse de faire pour le non cote.

       Le test compare les deux lectures du meme euro. Il aurait attrape le
       defaut le jour ou il a ete introduit : il suffit de demander a la poche de
       liquidites de la projection si elle contient bien le cash a investir que
       l'accueil y met. */
    Fixture.poser();
    const p = patrimoine();
    const investir = num(p.investir);
    vrai(investir > 0, 'le fixture porte du cash à investir');

    const q = pochesProjection();
    /* L'accueil compte les quatre poches de cash dans les liquidites. La
       projection doit compter les memes. */
    pres(q.liquidites, num(nowTotals().cash),
      'la poche de liquidités de la projection est celle de l’accueil, cash à investir compris');
    vrai(q.liquidites >= investir,
      'elle contient donc au moins le cash à investir');

    /* Et il ne capitalise pas : porter le taux de marche a 20 % ne doit rien
       ajouter aux liquidites. */
    Fixture.poser(s => { s.meta.projRate = 20; s.meta.projRateAutres = 0; s.meta.projMonthly = 0; });
    const d = capitalisation({ years: 10 }).points.at(-1);
    pres(d.gainsLiquidites, 0,
      'un taux de marché à 20 % ne fait rien gagner au cash à investir');

    /* Rien ne s'est perdu dans le deplacement : les poches font toujours le
       net, et c'est ce qui garantit qu'on a deplace au lieu de retrancher. */
    const r = pochesProjection();
    pres(r.placees + num(r.plat), patrimoine().net,
      'les poches et la part plate font le patrimoine net');
  });

  test('les liquidités ne capitalisent jamais', () => {
    /* Le taux autres actifs ne couvre pas les liquidites : deux choses sans
       rapport sous un seul pourcentage forceraient a choisir entre sous-estimer
       un livret et inventer un rendement a des parts non cotees.

       Et les liquidites n'ont pas leur propre selecteur : elles ne capitalisent
       pas dans cette application, livret ou non, donc il n'y a rien a regler
       pour elles. Une constante n'a pas besoin d'un menu.

       Ce que le test verrouille : le taux touche la poche des autres actifs et
       elle seule, les liquidites traversent la projection telles quelles. */
    Fixture.poser(s => { s.meta.projRateAutres = 0; });
    const q = pochesProjection();
    vrai(q.autres > 0 && q.liquidites > 0, 'le fixture porte les deux poches');
    vrai(q.autres !== q.autres + q.liquidites,
      'et les liquidités ne sont pas dans « autres actifs »');

    Fixture.poser(s => { s.meta.projRateAutres = 4; });
    const d = capitalisation({ years: 10 }).points.at(-1);
    pres(d.gainsAutres, q.autres * Math.pow(1.04, 10) - q.autres,
      'les autres actifs croissent de leur taux');
    pres(d.gainsLiquidites, 0, 'les liquidités ne bougent pas d’un centime');
    pres(d.gains, d.gainsMarche + d.gainsAutres + d.gainsGaranti + d.gainsLiquidites,
      'le total des gains est la somme des quatre poches, sans reste');
    pres(d.total, d.contributed + d.gains, 'total = apporté + gains, toujours');

    /* Meme a taux eleve sur les autres actifs, les liquidites restent a leur
       montant : le test attraperait un branchement accidentel des deux poches. */
    Fixture.poser(s => { s.meta.projRateAutres = 15; });
    pres(capitalisation({ years: 30 }).points.at(-1).gainsLiquidites, 0,
      'trente ans plus tard, toujours zéro');
  });

  test('un rendement des autres actifs ajoute exactement sa croissance', () => {
    /* Et rien de plus : le marche ne doit pas bouger, ni la part plate. */
    Fixture.poser(s => { s.meta.projRateAutres = 0; });
    const q = pochesProjection();
    const sans = capitalisation({ years: 10 }).points.at(-1);

    Fixture.poser(s => { s.meta.projRateAutres = 4; });
    const avec = capitalisation({ years: 10 }).points.at(-1);

    pres(avec.gainsMarche, sans.gainsMarche, 'le marché est inchangé');
    /* La poche capitalise seule, sans versement : sa croissance est exactement
       celle des interets composes sur dix ans. */
    const attendu = q.autres * Math.pow(1.04, 10) - q.autres;
    pres(avec.gainsAutres, attendu, 'la croissance des autres actifs est celle de son taux');
    pres(avec.total - sans.total, attendu, 'le total monte de ce seul montant');
    pres(avec.contributed, sans.contributed, 'ce qui est acquis ne change pas');
  });

  test('le rendement des autres actifs vaut zéro par défaut', () => {
    /* L'application n'affirme aucun rendement sur des parts non cotees, y
       compris pour un etat qui n'a jamais connu ce champ. J'avais d'abord fait
       heriter ces etats de leur ancien taux unique pour ne deplacer aucun
       chiffre ; c'etait appliquer deux standards a la meme ignorance, puisque
       l'immobilier est gele pour cette exacte raison.
       Et un taux choisi a la main doit survivre a la migration, jouee deux fois
       comme une seule. */
    Fixture.poser(s => { s.meta.projRate = 7; delete s.meta.projRateAutres; });
    Store.migrate();
    eq(projectionSettings().rateAutres, 0,
      'un état d’avant le second champ part de zéro, il n’hérite pas de 7 %');

    Store.state.meta.projRateAutres = 3;
    Store.migrate();
    eq(projectionSettings().rateAutres, 3, 'un taux réglé à la main survit');
    Store.migrate();
    eq(Store.state.meta.projRateAutres, 3, 'et deux passes donnent le même état');

    /* Le taux effectif et non la clé enregistrée : SEED.meta ne plante plus
       `projRateAutres`, parce que la même fusion planterait aussi un scénario
       chez qui n'en a jamais choisi -- et un scénario planté écraserait ses taux
       en silence, ce que cette page ne fait jamais. L'absence vaut zéro, et le
       scénario par défaut se décide dans le code. */
    Fixture.poser(s => { s.meta.projRate = 8; delete s.meta.projScenario; });
    Store.migrate();
    eq(Store.state.meta.projScenario, undefined,
      'la migration ne pose aucun scénario sur un état qui a déjà des taux');
    eq(sourceDesTaux(), 'perso', 'ses taux viennent donc de l’état, pas d’une table');
    pres(projectionSettings().rate, 8, 'et son taux survit intact');
  });

  test('la projection part du patrimoine net, immobilier compris', () => {
    /* La part immobiliere est portee a plat, pas exclue : elle doit rester
       dans le total, sinon la courbe demarrerait sous le patrimoine reel. */
    Fixture.poser();
    const p = capitalisation({ years: 10 });
    pres(p.points[0].total, patrimoine().net,
      'le premier point vaut le patrimoine net d’aujourd’hui');
    pres(p.plat, 120000 - Fixture.DETTE, 'la part plate vaut le bien moins le prêt');
  });

  test('l’immobilier ne capitalise pas', () => {
    /* Le coeur du modele. La base qui capitalise vaut le brut moins le bien,
       donc ni la valeur du bien ni le pret qui le finance ne peuvent changer
       les gains : eux seuls bougent le total, et exactement de leur montant.

       Avant, un seul taux s'appliquait au patrimoine net entier : l'apport du
       studio capitalisait a 5 % par an comme un ETF. Doubler la valeur du bien
       augmentait donc les « gains », ce qu'aucun bien ne produit. */
    const gains = (modifier) => {
      Fixture.poser(modifier);
      const p = capitalisation({ years: 10 });
      const d = p.points[p.points.length - 1];
      return { gains: d.gains, total: d.total, plat: p.plat };
    };

    const base = gains();

    /* Le bien vaut 80 000 EUR de plus : le total suit, les gains ne bougent pas. */
    const bienPlusCher = gains(s => {
      s.comptes.find(c => c.id === 'c_immo').lignes[0].valeur = 200000;
    });
    pres(bienPlusCher.gains, base.gains, 'un bien plus cher ne produit aucun gain de marché');
    pres(bienPlusCher.total, base.total + 80000, 'il ajoute sa valeur, rien de plus');

    /* Le pret grossit de 60 000 EUR : meme raisonnement en sens inverse. */
    const pretPlusGros = gains(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes[0].montant = Fixture.DETTE + 60000;
    });
    pres(pretPlusGros.gains, base.gains, 'un prêt plus gros ne réduit aucun gain de marché');
    pres(pretPlusGros.total, base.total - 60000, 'il retire son montant, rien de plus');

    /* Et l'egalite fondatrice tient dans les trois cas. */
    for (const [nom, r] of [['base', base], ['bien', bienPlusCher], ['prêt', pretPlusGros]]) {
      Fixture.poser();
      vrai(Number.isFinite(r.gains), nom + ' : les gains doivent être un nombre');
    }
  });

  test('une part plate négative reste une dette, elle ne fond pas', () => {
    /* Un credit a la consommation sans bien en face : la part plate est
       negative. Elle doit rester constante, pas se resorber au rythme des
       marches, ce qui arriverait si on la faisait capitaliser. */
    Fixture.poser(s => {
      s.comptes = s.comptes.filter(c => c.id !== 'c_immo');
      s.monthly[0].v.c_immo = 0;
    });
    const p = capitalisation({ years: 10 });
    vrai(p.plat < 0, 'sans bien mais avec un prêt, la part plate est négative');
    pres(p.plat, -Fixture.DETTE, 'elle vaut exactement le capital restant dû');
    const d = p.points[p.points.length - 1];
    pres(d.contributed + d.gains, d.total, 'l’égalité tient aussi en négatif');
    /* La dette pese autant a la fin qu'au debut : le total hors gains et hors
       versements ne bouge pas. */
    pres(d.total - d.gains - (d.contributed - p.plat), p.plat,
      'la dette est portée telle quelle jusqu’au bout');
  });

  test('la bande de scénarios encadre la courbe, à chaque point', () => {
    /* La Projection dessine le meme calcul a ±2 points de rendement. Si la
       bande croise la courbe, le graphique raconte n'importe quoi : la
       capitalisation doit etre monotone dans le taux, point par point. */
    Fixture.poser();
    const s = projectionSettings();
    const base = capitalisation({ years: 10 });
    const bas = capitalisation({ years: 10, rate: s.rate - 2 });
    const haut = capitalisation({ years: 10, rate: s.rate + 2 });
    base.points.forEach((pt, i) => {
      vrai(haut.points[i].total >= pt.total - 0.01,
        `an ${i} : le scénario haut ne peut pas passer sous la courbe`);
      vrai(bas.points[i].total <= pt.total + 0.01,
        `an ${i} : le scénario bas ne peut pas passer au-dessus`);
    });
    /* Et les trois partagent le meme point de depart : l'incertitude porte
       sur l'avenir, pas sur ce qu'on possede aujourd'hui. */
    pres(bas.points[0].total, base.points[0].total, 'même départ en bas');
    pres(haut.points[0].total, base.points[0].total, 'même départ en haut');
  });

  test('sans rendement, il ne se crée pas d’argent', () => {
    Fixture.poser(s => { s.meta.projRate = 0; s.meta.projMonthly = 100; });
    const p = capitalisation({ years: 10 });
    const d = p.points[p.points.length - 1];
    pres(d.gains, 0, 'zéro pour cent de rendement ne produit aucun gain');
    pres(d.total, patrimoine().net + 100 * 12 * 10, 'départ + 120 versements');
  });
});

/* ------------------------------------------------------------------
   9. Les variations
   ------------------------------------------------------------------ */
suite('Variation du patrimoine', () => {

  test('la variation compare deux nets, jamais un net a un brut', () => {
    /* Le bug : `deltas()` retranchait le brut d'un mois passe du net
       d'aujourd'hui. Sans credit les deux coincident et rien ne se voit ;
       avec un pret immobilier, « depuis le 1er janvier » annoncait la dette
       entiere en moins. Le fixture porte une dette, donc ce test mord. */
    const s = Fixture.poser(e => {
      e.monthly = [
        { date: '2026-01-31', comment: '', dettes: Fixture.DETTE,
          v: { c_courant: 3000, c_livret: 2000, c_pea: 10500, c_cto: 750,
               c_immo: 120000, c_pe: 2000 } },
      ];
    });
    const pts = historySeries({ includeNow: false });
    eq(pts.length, 1, 'un seul point dans l historique du fixture');
    const janvier = pts[0];
    pres(janvier.total, Fixture.BRUT, 'le point porte le brut du mois');
    pres(janvier.dettes, Fixture.DETTE, 'et le capital restant du');

    const d = deltas();
    pres(d.ytd.eur, nowTotals().total - (Fixture.BRUT - Fixture.DETTE),
      'la variation vaut net d aujourd hui moins net du mois de reference');
    /* Le fixture ne bouge pas entre le releve et aujourd hui : la variation
       doit donc etre nulle. Avec l ancien calcul elle valait -40 000. */
    pres(d.ytd.eur, 0, 'patrimoine inchange, variation nulle');
  });

  test('sans dette, rien ne change', () => {
    Fixture.poser(e => {
      e.etabs.find(x => x.id === 'e_bien').dettes = [];
      e.monthly = [{ date: '2026-01-31', comment: '', dettes: 0,
        v: { c_courant: 3000, c_livret: 2000, c_pea: 10500, c_cto: 750,
             c_immo: 120000, c_pe: 2000 } }];
    });
    pres(deltas().ytd.eur, 0, 'brut et net coincident, la variation reste nulle');
  });
});

/* ------------------------------------------------------------------
   10. La moyenne mensuelle
   ------------------------------------------------------------------ */
suite('Moyenne des dépenses', () => {

  const moisCourant = () => currentMonthKey();

  test('le mois en cours ne tire pas la moyenne vers le bas', () => {
    /* Le bug : la moyenne divisait par tous les mois saisis, celui en cours
       compris. Le 2 du mois elle plongeait, puis remontait jusqu au 31 : huit
       mois dont un a 250 EUR donnaient 1 339 EUR contre 1 464 EUR la veille,
       sans qu aucune depense n ait disparu. */
    Fixture.poser(e => {
      e.budget.expenses = [
        { month: '2026-01-01', v: { Courses: 1000 }, note: '' },
        { month: '2026-02-01', v: { Courses: 2000 }, note: '' },
        { month: moisCourant(), v: { Courses: 100 }, note: '' },
      ];
    });
    const st = expenseYearStats(moisCourant().slice(0, 4));
    pres(st.average, 1500, 'moyenne des deux mois clos, pas des trois');
    eq(st.moisRetenus, 2, 'deux mois retenus');
    eq(st.moisEnCoursExclu, true, 'et l ecran doit pouvoir le dire');
  });

  test('sous et au-dessus de l’objectif partagent les mois clos, sans reste', () => {
    /* Les tuiles publient under/over et leurs fiches listent sousObjectif et
       surObjectif : les listes doivent etre exactement la partition des mois
       retenus. Deux filtres paralleles avaient deja diverge — la fiche commune
       comptait le mois en cours vide comme « sous l objectif ». */
    Fixture.poser(e => {
      e.budget.monthlyTarget = 1000;
      e.budget.expenses = [
        { month: '2026-01-01', v: { Courses: 800 }, note: '' },
        { month: '2026-02-01', v: { Courses: 1000 }, note: '' },   // egal = sous
        { month: '2026-03-01', v: { Courses: 1500 }, note: '' },
        { month: moisCourant(), v: { Courses: 1 }, note: '' },
      ];
    });
    const st = expenseYearStats(moisCourant().slice(0, 4));
    eq(st.sousObjectif.length, st.under, 'la liste « sous » porte le compte de sa tuile');
    eq(st.surObjectif.length, st.over, 'la liste « au-dessus » aussi');
    eq(st.under, 2, 'janvier et fevrier, l egalite compte comme tenue');
    eq(st.over, 1, 'mars seulement');
    eq(st.sousObjectif.length + st.surObjectif.length, st.moisRetenus,
      'partition exacte des mois retenus, le mois en cours dehors');
    vrai(!st.sousObjectif.some(r => r.month === moisCourant()),
      'le mois en cours ne peut pas etre « sous l objectif » : il n est pas fini');
  });

  test('le total de l’année garde le mois en cours', () => {
    /* Une moyenne compare des mois entre eux, un total additionne ce qui a
       ete depense. Le second n a aucune raison d ecarter quoi que ce soit. */
    Fixture.poser(e => {
      e.budget.expenses = [
        { month: '2026-01-01', v: { Courses: 1000 }, note: '' },
        { month: moisCourant(), v: { Courses: 100 }, note: '' },
      ];
    });
    const st = expenseYearStats(moisCourant().slice(0, 4));
    pres(st.total, 1100, 'le total additionne tout');
    eq(st.months, 2, 'et compte les deux mois saisis');
  });

  test('le meilleur mois n’est pas un mois a peine commence', () => {
    Fixture.poser(e => {
      e.budget.expenses = [
        { month: '2026-01-01', v: { Courses: 900 }, note: '' },
        { month: '2026-02-01', v: { Courses: 1400 }, note: '' },
        { month: moisCourant(), v: { Courses: 60 }, note: '' },
      ];
    });
    const st = expenseYearStats(moisCourant().slice(0, 4));
    pres(st.best.total, 900, 'le mois en cours ne remporte pas le titre');
    pres(st.worst.total, 1400);
  });

  test('un mois en cours seul reste compte, faute de mieux', () => {
    /* Zero serait pire qu approximatif : le premier mois d utilisation
       n afficherait aucune moyenne. */
    Fixture.poser(e => {
      e.budget.expenses = [{ month: moisCourant(), v: { Courses: 320 }, note: '' }];
    });
    const st = expenseYearStats(moisCourant().slice(0, 4));
    pres(st.average, 320, 'on retombe sur le seul mois disponible');
    eq(st.moisEnCoursExclu, false, 'et on ne pretend pas l avoir ecarte');
  });

  test('une annee passee n’a pas de mois en cours a ecarter', () => {
    Fixture.poser(e => {
      e.budget.expenses = [
        { month: '2025-01-01', v: { Courses: 800 }, note: '' },
        { month: '2025-02-01', v: { Courses: 1200 }, note: '' },
      ];
    });
    const st = expenseYearStats('2025');
    pres(st.average, 1000);
    eq(st.moisEnCoursExclu, false);
  });
});

/* ------------------------------------------------------------------
   11. Le rythme d'accumulation
   ------------------------------------------------------------------ */
suite('Rythme d’accumulation', () => {

  test('rembourser un crédit compte comme de l’accumulation', () => {
    /* Le bug : l ecart se calculait sur le brut, quand l aide de la carte
       annonce « variations du patrimoine net ». Rembourser 400 EUR de capital
       fait monter le net d autant sans toucher au brut : tout le
       desendettement disparaissait du rythme. */
    Fixture.poser(e => {
      e.monthly = [
        { date: '2026-01-31', comment: '', dettes: 40000,
          v: { c_courant: 3000, c_livret: 2000, c_pea: 10500, c_cto: 750,
               c_immo: 120000, c_pe: 2000 } },
        /* Mois suivant : rien ne bouge, sauf 400 EUR de capital rembourses. */
        { date: '2026-02-28', comment: '', dettes: 39600,
          v: { c_courant: 3000, c_livret: 2000, c_pea: 10500, c_cto: 750,
               c_immo: 120000, c_pe: 2000 } },
      ];
    });
    const pts = monthlyPace().points;
    eq(pts.length, 1, 'deux relevés donnent un écart');
    pres(pts[0].delta, 400, 'le capital remboursé est de l’accumulation');
  });

  test('sans crédit, le rythme suit la valeur des avoirs', () => {
    Fixture.poser(e => {
      e.etabs.find(x => x.id === 'e_bien').dettes = [];
      e.monthly = [
        { date: '2026-01-31', comment: '', dettes: 0,
          v: { c_courant: 3000, c_livret: 2000, c_pea: 10500, c_cto: 750,
               c_immo: 120000, c_pe: 2000 } },
        { date: '2026-02-28', comment: '', dettes: 0,
          v: { c_courant: 3500, c_livret: 2000, c_pea: 10500, c_cto: 750,
               c_immo: 120000, c_pe: 2000 } },
      ];
    });
    pres(monthlyPace().points[0].delta, 500, '500 EUR de plus sur le compte courant');
  });
});

/* ------------------------------------------------------------------
   12. La fenetre temporelle
   ------------------------------------------------------------------ */
suite('Fenêtre temporelle', () => {

  /* Vingt-cinq mois d'ecarts, un par mois, jusqu'au mois courant inclus. */
  const ecarts = () => {
    const out = [];
    const d = new Date();
    for (let i = 24; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ date: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`,
                 label: 'm', delta: 100 });
    }
    return out;
  };

  test('« 1 an » compte douze variations, pas treize', () => {
    /* Le bug : le seuil gardait l ecart du mois de depart, qui mesure la
       variation du mois d avant. « 1 an » affichait « 12 / 13 ». Sur une
       serie de valeurs le meme seuil est juste : treize points donnent douze
       intervalles. C est la meme fonction pour deux usages. */
    eq(limitRange(ecarts(), '1y', { ecarts: true }).length, 12);
    eq(limitRange(ecarts(), '2y', { ecarts: true }).length, 24);
  });

  test('une série de valeurs garde son point de départ', () => {
    eq(limitRange(ecarts(), '1y').length, 13, 'treize points pour douze intervalles');
  });

  test('« depuis le 1er janvier » garde la variation de janvier', () => {
    /* Elle appartient a janvier, donc a l annee en cours, meme si elle mesure
       le passage de decembre a janvier. Pas de decalage ici. */
    const attendu = new Date().getMonth() + 1;
    eq(limitRange(ecarts(), 'ytd', { ecarts: true }).length, attendu);
    eq(limitRange(ecarts(), 'ytd').length, attendu);
  });

  test('« Tout » ne coupe rien', () => {
    eq(limitRange(ecarts(), 'all', { ecarts: true }).length, 25);
  });

  test('l’échelle des plages est fixe, quelle que soit la profondeur', () => {
    /* Elle etait calculee depuis l'anciennete des relevés : on voyait
       « 2 ans », qui n'est un cran nulle part, et le contrôle changeait de
       forme a mesure que les donnees vieillissaient. Le test lit l'echelle
       avec deux mois d'historique puis avec quinze ans : les memes crans, dans
       le meme ordre, sinon le calcul est revenu. */
      const echelle = () => HISTORY_RANGES.map(r => r.id);

    const avant = echelle();
    const garde = Store.state.monthly;
    try {
      Store.state.monthly = [{ date: '2026-07-01', v: { a: 1 } },
                             { date: '2026-08-01', v: { a: 2 } }];
      const courte = echelle();
      Store.state.monthly = [{ date: '2011-01-01', v: { a: 1 } },
                             { date: '2026-08-01', v: { a: 2 } }];
      const longue = echelle();
      eq(courte.join(' '), longue.join(' '),
        'deux mois et quinze ans doivent proposer les mêmes plages');
      eq(courte.join(' '), avant.join(' '), 'et les mêmes qu’au repos');
    } finally {
      Store.state.monthly = garde;
    }

    eq(echelle().includes('2y'), false, '« 2 ans » n’est un cran sur aucune place');
    eq(echelle().length <= 5, true, 'cinq boutons au plus, sinon ça déborde à 375 px');
    eq(echelle()[0], 'ytd', 'du plus court au plus long');
    eq(echelle()[echelle().length - 1], 'all', '« Tout » ferme la série');
  });

  test('chaque cran de l’échelle sait se nommer et se découper', () => {
    /* Un cran ajoute sans libelle afficherait « undefined » dans un bouton, et
       un cran que limitRange ne sait pas lire ne couperait rien du tout, donc
       donnerait « Tout » sous un autre nom. */
    for (const r of HISTORY_RANGES) {
      vrai(rangeLabel(r.id), r.id + ' doit avoir un libellé');
      eq(rangeLabel(r.id), r.label, r.id + ' : le libellé doit venir de l’échelle');
      const gardes = limitRange(ecarts(), r.id);
      vrai(gardes.length >= 2, r.id + ' doit garder de quoi tracer une courbe');
      vrai(gardes.length <= 25, r.id + ' ne peut pas inventer de points');
    }
    /* Sur vingt-cinq mois, « 3 ans » et « Tout » couvrent tout ; « 1 an » non.
       C'est ce qui prouve que les crans coupent vraiment. */
    eq(limitRange(ecarts(), 'all').length, 25);
    eq(limitRange(ecarts(), '3y').length, 25);
    eq(limitRange(ecarts(), '1y').length, 13);
    vrai(rangeLabel('15y'), 'un identifiant d’une session précédente doit se nommer');
  });
});

/* ------------------------------------------------------------------
   11 ter. Annuler une vente
   ------------------------------------------------------------------ */
suite('Annuler une vente rend les titres et l’argent', () => {

  /* Une vente de 40 titres sur les 100 du fixture, encaissée sur le PEA. */
  const vendre = (qty = 40, prix = 95) => {
    Fixture.poser();
    const i = Store.state.positions.findIndex(p => p.id === 'p_etf');
    return { i, vente: sellPosition({ index: i, qty, price: prix, fxSell: 1,
                                      cashAccount: 'c_pea', cashPart: partieSuggeree('c_pea', { credit: true }), date: '2026-08-04', note: '' }) };
  };

  const cashDe = id => (compteById(id).cash || [])
    .reduce((t, e) => t + num(e.montant), 0);

  test('la vente puis son annulation rendent la quantité et le cash', () => {
    Fixture.poser();
    const avantQty = num(Store.state.positions.find(p => p.id === 'p_etf').qty);
    const avantCash = cashDe('c_pea');

    vendre();
    const apresVente = Store.state.positions.find(p => p.id === 'p_etf');
    eq(num(apresVente.qty), avantQty - 40, 'la vente retire les titres');
    pres(cashDe('c_pea'), avantCash + 40 * 95, 'et encaisse le produit');
    eq(Store.state.sales.length, 1, 'le journal porte la vente');

    annulerVente(0);
    eq(num(Store.state.positions.find(p => p.id === 'p_etf').qty), avantQty,
      'l’annulation rend les titres');
    pres(cashDe('c_pea'), avantCash, 'et reprend l’argent');
    eq(Store.state.sales.length, 0, 'et la vente quitte le journal');
  });

  test('une vente totale annulée fait renaître la ligne', () => {
    /* Le cas qui casse une annulation naive : la ligne n'existe plus, il faut la
       recreer avec son prix de revient, sa classe et son role — sinon les titres
       reviennent sans identite et sortent de toute cible. */
    Fixture.poser();
    const p0 = { ...Store.state.positions.find(p => p.id === 'p_etf') };
    vendre(num(p0.qty), 95);
    eq(Store.state.positions.some(p => p.name === p0.name), false, 'la ligne a disparu');

    annulerVente(0);
    const rendue = Store.state.positions.find(p => p.name === p0.name);
    vrai(rendue, 'la ligne est de retour');
    eq(num(rendue.qty), num(p0.qty), 'avec sa quantité');
    eq(num(rendue.buyPrice), num(p0.buyPrice), 'et son prix de revient d’alors');
    eq(rendue.account, p0.account, 'sur le même compte');
    eq(assetClassDe(rendue), assetClassDe(p0), 'sa classe d’actif');
    eq(roleDe(rendue), roleDe(p0), 'et son rôle');
  });

  test('l’annulation ne touche que la vente visée', () => {
    Fixture.poser();
    const i = Store.state.positions.findIndex(p => p.id === 'p_etf');
    sellPosition({ index: i, qty: 10, price: 95, fxSell: 1, cashAccount: 'c_pea', cashPart: partieSuggeree('c_pea', { credit: true }), date: '2026-08-01' });
    sellPosition({ index: i, qty: 20, price: 96, fxSell: 1, cashAccount: 'c_pea', cashPart: partieSuggeree('c_pea', { credit: true }), date: '2026-08-02' });
    eq(Store.state.sales.length, 2);
    /* `unshift` : la plus recente est en tete. On annule celle de 20. */
    const qtyAvant = num(Store.state.positions.find(p => p.id === 'p_etf').qty);
    annulerVente(0);
    eq(Store.state.sales.length, 1, 'une seule vente retirée');
    eq(num(Store.state.sales[0].qty), 10, 'et c’est l’autre qui reste');
    eq(num(Store.state.positions.find(p => p.id === 'p_etf').qty), qtyAvant + 20,
      'seuls les titres de la vente annulée reviennent');
  });

  test('un index inconnu ne casse rien', () => {
    Fixture.poser();
    eq(annulerVente(0), null, 'aucune vente à annuler');
    eq(annulerVente(7), null);
  });

  test('le bouton du journal annule, il ne cache pas', () => {
    /* Il retirait la ligne du journal en annonçant que ni les titres ni le cash
       ne bougeaient : un geste qui ressemble à une annulation sans en être une.
       Le rendu vit dans app.js, que le harnais ne charge pas : on lit sa source. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const m = src.match(/'del-sale'\(btn\) \{[\s\S]*?\n  \},/);
    vrai(m, 'l’action del-sale doit être trouvable');
    vrai(/annulerVente\(/.test(m[0]),
      'elle doit appeler l’annulation, pas seulement retirer la ligne');
    vrai(!/sales\.splice/.test(m[0]),
      'et ne plus toucher au journal elle-même : c’est annulerVente qui le fait');
  });
});

/* ------------------------------------------------------------------
   Le journal des mouvements exceptionnels, dans les deux sens
   ------------------------------------------------------------------ */
suite('Une sortie exceptionnelle n’est pas une épargne ratée', () => {

  /* Le journal ne portait que les entrées. Un héritage de 10 000 € y trouvait sa
     place, une voiture à 15 000 € n'en avait aucune — et les deux posent pourtant
     le même problème : ils déplacent le patrimoine sans rien dire de l'épargne.

     Mesuré sur les données réelles avant d'écrire une ligne. Une voiture payée en
     avril, sans le journal : la moyenne mensuelle du patrimoine passe de +789 € à
     −283 €, et elle y reste, une moyenne portant sur quatorze mois. Le budget, lui,
     n'a pas bougé d'un euro. Avec la ligne au journal, la courbe garde son trou —
     l'argent est bien parti — mais le rythme propre reste à +789 €.

     Pourquoi pas dans les dépenses du mois, qui semblait l'endroit naturel :
     mesuré aussi. La moyenne des dépenses passait de 1 404 à 3 547 €, et comme
     elle sert de coût de la vie, l'autonomie financière tombait de 0,8 à 0,5 mois
     et la cible d'épargne de précaution montait de 11 545 à 17 974 €. Pour une
     voiture achetée une fois, l'application aurait réclamé 6 000 € de réserve en
     plus, toute l'année. */

  const journal = lignes => Fixture.poser(e => {
    e.budget.apports = lignes;
  });

  test('le signe porte le sens, et les deux parts font le net', () => {
    journal([
      { id: 'a1', libelle: 'Succession', montant: 10000, date: '2026-03-10' },
      { id: 'a2', libelle: 'Voiture', montant: -15000, date: '2026-04-15' },
    ]);
    const d = apportsDetail();
    eq(d.entrees, 10000, 'ce qui est entré');
    eq(d.sorties, -15000, 'ce qui est sorti, en négatif');
    eq(d.net, -5000, 'et le net est la somme des deux');
    eq(apportsTotal(), d.net,
      'le total et le net sont le même nombre : deux sommes sur la même liste finiraient '
      + 'par diverger, et c’est le total qui se tromperait');
  });

  test('les bornes de dates valent pour les deux sens', () => {
    journal([
      { id: 'a1', libelle: 'Prime', montant: 3000, date: '2026-01-10' },
      { id: 'a2', libelle: 'Travaux', montant: -8000, date: '2026-06-20' },
    ]);
    eq(apportsDetail('2026-01-01', '2026-03-31').net, 3000, 'la fenêtre ne retient que la prime');
    eq(apportsDetail('2026-05-01', '2026-12-31').net, -8000, 'l’autre ne retient que les travaux');
    eq(apportsDetail('2026-06-20', '2026-06-20').sorties, -8000, 'les bornes sont comprises');
  });

  test('une sortie exceptionnelle ne compte pas comme une épargne manquée', () => {
    /* Le coeur du sujet. On fabrique deux relevés, le second amputé de 15 000 € :
       c'est la voiture. Sans le journal, cet écart est imputé au rythme ; avec lui,
       il en sort. */
    Fixture.poser(e => {
      e.budget.apports = [{ id: 'a1', libelle: 'Voiture', montant: -15000, date: '2026-02-10' }];
    });
    const pts = [
      { date: '2026-01-31', depuis: '2025-12-31', delta: 800 },
      { date: '2026-02-28', depuis: '2026-01-31', delta: -14200 },
    ];
    const s = statsRythme(pts);
    pres(s.average, (800 - 14200) / 2, 'la moyenne brute encaisse la voiture');
    vrai(s.average < 0, 'et elle est négative, ce qui est vrai du patrimoine');
    eq(s.apports, -15000, 'le journal la retrouve dans la fenêtre des deux points');
    pres(s.averageHorsApports, (800 - 14200 + 15000) / 2,
      'hors mouvements exceptionnels, le rythme propre remonte');
    vrai(s.averageHorsApports > 0,
      'une voiture achetée une fois ne doit pas faire dire à l’application que tu '
      + 'n’épargnes plus rien');
  });

  test('les deux boutons déclarent leur sens, et la modification le corrige', () => {
    /* Le montant se saisit toujours positif : demander « moins quinze mille »
       offrirait une faute de frappe qui inverse un fait. Le signe se pose à partir
       d'une déclaration — le bouton à la création, la liste à la modification, et
       jamais les deux à la fois. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    for (const sens of ['entree', 'sortie']) {
      vrai(new RegExp(`data-action="ajouter-apport" data-sens="${sens}"`).test(src),
        `le journal doit offrir un bouton « ${sens} »`);
    }
    /* Les bornes sont les actions voisines, jamais un nombre de caracteres :
       un commentaire ajoute dans la fonction faisait sortir la ligne cherchee
       d'une fenetre fixe, et le test tombait sur un changement de prose. */
    const ajout = src.indexOf(`async 'ajouter-apport'`);
    vrai(ajout > 0, 'l’action d’ajout doit être trouvable');
    const fnAjout = src.slice(ajout, src.indexOf(`async 'editer-apport'`));
    vrai(/btn\?\.dataset\.sens === 'sortie'/.test(fnAjout),
      'elle prend son sens du bouton, pas d’une question posée deux fois');
    vrai(/-Math\.abs\(num\(v\.montant\)\)/.test(fnAjout),
      'et pose le signe elle-même, à partir d’un montant saisi positif');

    const edit = src.indexOf(`async 'editer-apport'`);
    vrai(edit > 0, 'l’action de modification doit être trouvable');
    const fnEdit = src.slice(edit, src.indexOf(`async 'add-charge'`, edit));
    vrai(/cle: 'sens'/.test(fnEdit),
      'la modification propose la nature : c’est le seul endroit où l’on peut s’être '
      + 'trompé de bouton');
    vrai(/Math\.abs\(num\(a\.montant\)\)/.test(fnEdit),
      'et le champ montre le montant sans son signe, qui vit dans la liste');
  });
});

/* ------------------------------------------------------------------
   11 bis. L'écart du jour
   ------------------------------------------------------------------ */
suite('L’écart du jour ne compte qu’aujourd’hui', () => {

  /* Une ligne cotée, avec l'heure de sa dernière transaction. `quoteTime` est en
     secondes depuis 1970, comme la place le publie. */
  const secondes = iso => Math.floor(new Date(iso + 'T14:00:00').getTime() / 1000);

  const avecCours = (quandISO, prix, veille) => Fixture.poser(e => {
    e.positions = [{
      id: 'p_x', name: 'ETF Monde', isin: '', symbol: 'EWLD.PA', currency: 'EUR',
      qty: 100, buyPrice: 5, price: prix, fx: 1, fxBuy: 1, account: 'c_pea',
      manual: false, assetClass: 'actions', role: 'core',
      prevClose: veille, quoteTime: quandISO ? secondes(quandISO) : null,
    }];
  });

  test('un cours du jour donne l’écart du jour', () => {
    avecCours(todayISO(), 6.161, 6.121);
    const d = posDayChange(Store.state.positions[0]);
    pres(d.pct, (6.161 / 6.121 - 1) * 100, 'l’écart de la séance en cours');
    pres(d.eur, (6.161 - 6.121) * 100, 'et son montant, quantité comprise');
    eq(!!d.horsSeance, false, 'la séance a bien eu lieu');
  });

  test('un cours d’hier ne fait pas l’écart d’aujourd’hui', () => {
    /* Le defaut corrige : avant l'ouverture, et toute la nuit, l'ecran affichait
       le mouvement de la derniere seance comme s'il etait celui du jour. « depuis
       la cloture d'hier » est alors exactement zero : le cours n'a pas ete
       echange depuis cette cloture. */
    const hier = new Date(todayISO() + 'T12:00:00');
    hier.setDate(hier.getDate() - 1);
    avecCours(isoLocal(hier), 6.161, 6.121);
    const d = posDayChange(Store.state.positions[0]);
    eq(d.pct, 0, 'aucun mouvement depuis la clôture d’hier');
    eq(d.eur, 0, 'donc aucun euro');
    eq(d.horsSeance, true, 'et la ligne dit pourquoi');
    eq(dayPerformance().eur, 0, 'le total du jour est nul, pas la veille rejouée');
    eq(dayPerformance().pct, 0);
  });

  test('sans heure de cotation, on garde l’écart', () => {
    /* Stooq ne publie pas l'heure. On ne peut donc pas prouver que le cours est
       perime : le taire par principe effacerait un ecart juste, tous les jours
       de seance et pour toujours. */
    avecCours(null, 6.161, 6.121);
    const d = posDayChange(Store.state.positions[0]);
    vrai(d.pct > 0, 'l’écart reste calculé');
  });

  test('sans heure mais place fermée, l’écart n’est pas celui du jour', () => {
    /* La troisieme branche. Sans heure on ne sait pas, et on garde l'ecart --
       sauf si la place se declare fermee, auquel cas on sait, et l'ecart
       affiche serait celui de la derniere seance.

       Sans elle, la garde s'ouvrirait des qu'une source muette repond un
       dimanche. */
    avecCours(null, 6.161, 6.121);
    Store.state.positions[0].marketState = 'CLOSED';
    const d = posDayChange(Store.state.positions[0]);
    eq(d.eur, 0, 'aucun euro attribué au jour');
    eq(d.horsSeance, true, 'et la ligne dit pourquoi');
  });

  test('sans heure et place ouverte, l’écart compte', () => {
    /* Le complement : une place qui cote et une source muette, c'est bien le
       mouvement du jour. Sans ce cas, la branche precedente aurait pu se
       contenter de tout taire. */
    avecCours(null, 6.161, 6.121);
    Store.state.positions[0].marketState = 'REGULAR';
    vrai(posDayChange(Store.state.positions[0]).pct > 0, 'l’écart est retenu');
  });

  test('sans clôture de référence, il n’y a pas d’écart du jour', () => {
    /* Elle n'etait ecrite que si la reponse en portait une : celle qu'on gardait
       vieillissait d'un jour a chaque rafraichissement muet, et l'ecart du jour
       comptait plusieurs seances. Mieux vaut ne rien dire. */
    avecCours(todayISO(), 6.161, 0);
    eq(posDayChange(Store.state.positions[0]), null, 'aucun écart calculable');
    eq(dayPerformance().sansDonnee, 1, 'et la ligne est comptée comme sans donnée');
  });

  /* --- une ligne achetée aujourd'hui n'a pas de veille -------------------
     Une ligne achetee dans la journee, apres une baisse du titre de 5 %, ne
     doit pas compter cette baisse au patrimoine : on ne la detenait pas a la
     cloture de la veille. Si elle ne perd que 1 % depuis l'achat, c'est 1 %
     que l'ecran doit dire.

     Le mouvement du titre est juste. C'est l'effet sur le patrimoine qui serait
     faux : il suppose qu'on detenait la ligne a la cloture de la veille. */

  test('une ligne achetée aujourd’hui ne porte pas la baisse d’avant l’achat', () => {
    auJour('2026-08-05', () => {
      avecCours('2026-08-05', 6.00, 7.00);      // le titre a perdu 1 EUR dans la journée
      const p = Store.state.positions[0];
      p.buyPrice = 6.10;                        // acheté après la baisse
      p.dateAchat = '2026-08-05';
      const d = posDayChange(p);
      eq(d.depuisAchat, true, 'la ligne dit sur quelle base elle se compare');
      pres(d.eur, (6.00 - 6.10) * 100, 'l’écart part du prix payé, pas de la veille');
      pres(d.eur, posPerfEur(p),
        'tout ce qui est arrivé à cette ligne est arrivé aujourd’hui : '
        + 'son effet du jour vaut exactement sa plus-value latente');
      pres(d.pct, posPerfPct(p), 'et le pourcentage suit la même base');
      vrai(d.eur > (6.00 - 7.00) * 100,
        'la perte comptée est bien moindre que celle du titre sur la séance');
    });
  });

  test('sur une ligne en devise, le taux d’achat est du jour lui aussi', () => {
    /* Sur une ligne achetee aujourd'hui, l'ecart du jour EST la plus-value
       latente : la borne basse est l'achat, pas la cloture de la veille. La fiche
       afficherait sinon deux montants voisins et differents pour un seul et meme
       fait, a deux lignes d'ecart.

       Le taux ne complique rien : les deux bornes prennent celui du jour depuis
       que `fxBuy` a quitte les positions, puisqu'une ligne achetee en plusieurs
       fois n'a pas un seul taux d'achat. L'invariant, lui, n'a pas bouge, et
       c'est lui que ce test garde. */
    auJour('2026-08-05', () => {
      avecCours('2026-08-05', 49, 55);
      const p = Store.state.positions[0];
      Object.assign(p, { currency: 'USD', qty: 20, buyPrice: 50,
                         fx: 0.90, dateAchat: '2026-08-05' });
      const d = posDayChange(p);
      pres(d.eur, 20 * (49 - 50) * 0.90, 'valeur du jour moins prix de revient, au même taux');
      pres(d.eur, posValue(p) - posInvested(p), 'ce qui est la plus-value latente');
    });
  });

  test('une ligne achetée hier retrouve la clôture de la veille', () => {
    /* Le complement : la garde ne doit pas deborder d'un jour. Detenue depuis
       hier soir, la ligne a bien vecu la seance entiere. */
    auJour('2026-08-05', () => {
      avecCours('2026-08-05', 6.00, 7.00);
      const p = Store.state.positions[0];
      p.buyPrice = 6.10;
      p.dateAchat = '2026-08-04';
      const d = posDayChange(p);
      eq(!!d.depuisAchat, false, 'la base redevient celle de tout le monde');
      pres(d.eur, (6.00 - 7.00) * 100, 'soit la séance entière');
    });
  });

  test('une date du jour sans prix de revient ne fait pas un écart nul', () => {
    /* Le piege de la bascule : une ligne creee ce matin porte la date du jour
       avant qu'on ait saisi la quantite et le prix. Prendre alors le prix paye
       comme reference donnerait zero pour reference, donc zero d'ecart, et la
       ligne disparaitrait du total sans que rien ne le dise. */
    auJour('2026-08-05', () => {
      avecCours('2026-08-05', 6.00, 7.00);
      const p = Store.state.positions[0];
      p.buyPrice = 0;
      p.dateAchat = '2026-08-05';
      const d = posDayChange(p);
      eq(!!d.depuisAchat, false, 'rien n’est investi : la bascule ne s’arme pas');
      pres(d.eur, (6.00 - 7.00) * 100, 'et la veille sert, comme avant');
    });
  });

  test('le total du jour reste la somme de ses lignes, bases mêlées', () => {
    /* La regle de la maison, appliquee au cas ou deux lignes ne se comparent pas
       a la meme chose. Le total ne doit rien y perdre. */
    auJour('2026-08-05', () => {
      avecCours('2026-08-05', 6.00, 7.00);
      const ancienne = Store.state.positions[0];
      ancienne.dateAchat = '2025-01-10';
      Store.state.positions.push({
        ...ancienne, id: 'p_y', name: 'Titre pris ce matin',
        qty: 50, buyPrice: 6.10, dateAchat: '2026-08-05',
      });
      const j = dayPerformance();
      eq(j.lignes.length, 2, 'les deux lignes comptent');
      pres(j.eur, j.lignes.reduce((s, l) => s + l.eur, 0), 'le total est la somme de ses parts');
      pres(j.eur, (6.00 - 7.00) * 100 + (6.00 - 6.10) * 50,
        'la séance entière pour l’une, l’écart depuis l’achat pour l’autre');
      eq(j.lignes.filter(l => l.depuisAchat).length, 1,
        'et une seule des deux annonce l’autre base');
    });
  });

  test('la date d’achat se demande à la création, et s’explique en un seul endroit', () => {
    /* Deux moitiés du même correctif.

       La date était facultative et n'était offerte que sur la fiche, après coup :
       personne ne la remplissait — l'écran Performance affiche même « n lignes
       n'ont pas de date d'achat ». Un calcul qui en dépend se serait donc trompé
       le jour même, pour tout le monde. Les deux fenêtres qui créent une ligne la
       demandent maintenant, proposée au jour et changeable, parce qu'on crée une
       ligne le jour où l'on achète — sauf en installant l'application sur un
       portefeuille déjà constitué, et c'est pour ça qu'elle se change.

       Et son explication vit une fois. Trois copies auraient divergé dès la
       première retouche : c'est exactement ce qui est arrivé à la formule du taux
       d'achat, retrouvée en trois exemplaires dont deux fausses. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    eq((src.match(/const DATE_ACHAT_AIDE\b/g) || []).length, 1,
      'une seule déclaration du texte d’aide');
    /* Chaque champ « Date d'achat » doit renvoyer a cette constante, y compris
       celui que quelqu'un ajoutera demain : le controle se derive du balisage et
       ne nomme aucun des trois appelants. */
    const champs = [...src.matchAll(/Date d’achat/g)];
    vrai(champs.length >= 3, 'les deux créations et la fiche demandent la date');
    for (const m of champs) {
      vrai(/DATE_ACHAT_AIDE/.test(src.slice(m.index, m.index + 160)),
        'chaque champ « Date d’achat » doit renvoyer à l’aide commune, jamais à sa propre copie');
    }

    /* Et ce que la creation ecrit arrive bien dans la ligne : le champ pouvait
       exister dans la fenetre sans que personne ne lise sa reponse. */
    eq((src.match(/dateAchat: v\.dateAchat \|\| ''/g) || []).length, 2,
      'les deux chemins de création reportent la date sur la ligne créée');
  });

  test('la passerelle prend une clôture d’un autre jour, pas la ligne d’avant', () => {
    /* Le repli du worker prenait l'avant-derniere bougie de la serie. Avant
       l'ouverture il n'y a pas de bougie du jour : la derniere est celle d'hier
       et l'avant-derniere celle d'avant-veille, donc l'ecart annonçait deux
       seances pour une. Le repli doit choisir sur la date, pas sur l'index.

       `_worker.js` tourne chez Cloudflare, le harnais ne l'execute pas : on lit
       sa source, bornee a la fonction concernee. */
    const src = lireSource('_worker.js');
    vrai(src, '_worker.js doit être lisible pour ce contrôle');
    const m = src.match(/async function yahooQuote[\s\S]*?\n\}/);
    vrai(m, 'yahooQuote() doit être trouvable');
    vrai(/result\.timestamp/.test(m[0]),
      'le repli doit lire les horodatages des bougies');
    vrai(/jour\(horodatages\[i\]\) < jourDuCours/.test(m[0]),
      'et ne retenir qu’une clôture d’un jour antérieur à celui du cours');

    /* La bougie de la veille passe avant `meta.previousClose`. Celui-ci peut
       valoir `null` alors que la serie porte un horodatage pour la veille sans
       aucune cloture : Yahoo sait qu'il y a eu seance, il n'en a pas le cours.
       Enjamber ce trou remonterait a l'avant-veille, et l'ecart du jour
       compterait deux seances -- un chiffre trois fois trop grand, par exemple
       +1,9 % quand le courtier dit +0,6 %.

       La bougie de la veille fait donc foi, et son absence aussi : quand elle
       manque, aucune cloture n'est publiee et la ligne n'a pas d'ecart du jour.
       Se taire vaut mieux qu'un chiffre faux d'un facteur trois. */
    vrai(!/if \(closes\[i\] == null\) continue;/.test(m[0]),
      'la bougie de la veille ne s’enjambe pas : sauter une clôture manquante '
      + 'fait compter deux séances');
    vrai(/veilleTrouvee/.test(m[0]),
      'la fonction doit distinguer « la veille est dans la série » de « elle en '
      + 'est absente » — les replis ne valent que pour le second cas');
    const choix = m[0].match(/let prev = [\s\S]*?;/);
    vrai(choix, 'le choix de la clôture doit être trouvable');
    vrai(choix[0].indexOf('veilleTrouvee') < choix[0].indexOf('meta.previousClose'),
      'la bougie de la veille passe avant le champ publié par la place');
  });

  test('les deux passerelles suivent la même règle', () => {
    /* `_worker.js` tourne chez Cloudflare, `serve.py` sert le local : deux
       exemplaires de la meme regle, dans deux langages. Ils avaient deja
       diverge — le raffinement sur la date du cours n'existait que cote
       worker — et un ecart entre les deux se lit comme un bug de l'application
       alors qu'il vient du serveur qu'on interroge. */
    const py = lireSource('serve.py');
    vrai(py, 'serve.py doit être lisible pour ce contrôle');
    const fn = py.slice(py.indexOf('def yahoo_quote'), py.indexOf('def stooq_quote'));
    vrai(fn.length > 500, 'yahoo_quote() doit être trouvable');
    vrai(/timestamp/.test(fn), 'le local doit lire les horodatages des bougies');
    vrai(/jour\(horodatages\[i\]\) < jour_du_cours/.test(fn),
      'et choisir sur la date, pas sur l’index');
    vrai(/trouvee/.test(fn),
      'et distinguer une veille absente d’une veille sans clôture, comme le worker');
    vrai(/_cloture_veille_horaire/.test(fn),
      'et retrouver la clôture en pas horaire quand la série journalière a un trou');
  });

  test('un trou dans la série journalière se comble, il ne se saute pas', () => {
    /* Il arrive que Yahoo n'ait aucune cloture pour la veille, sur plusieurs
       titres et devises a la fois : une panne de donnees, pas un jour sans
       seance.

       Trois comportements possibles, et deux sont mauvais. Enjamber le trou
       prend l'avant-veille et fait compter deux seances. Refuser de publier
       supprime l'ecart du jour partout a la fois, et l'ecran annonce des lignes
       sans cours de veille. La serie horaire comble : sa derniere barre de la
       veille tombe a un millieme pres sur la cloture reelle.

       Les deux passerelles doivent le faire, et de la meme facon. */
    const js = lireSource('_worker.js') || '';
    vrai(/async function clotureVeilleHoraire/.test(js),
      'le worker doit savoir lire la série horaire');
    vrai(/interval=1h/.test(js), 'et la demander en pas horaire');
    vrai(/await clotureVeilleHoraire\(symbol, jourDuCours\)/.test(js),
      'et s’en servir quand la clôture de la veille manque');
    /* Le repli ne doit jamais remonter plus haut que la veille : c'est tout
       l'interet de ne pas enjamber. */
    vrai(/jour\(ts\[i\]\) < jourDuCours/.test(js),
      'la barre retenue précède strictement le jour du cours');
  });
});

/* ------------------------------------------------------------------
   11 ter. L'heure d'un cours n'est pas l'heure de la requete

   Un marche ouvert et des positions qui ne bougent pas : la passerelle peut
   repondre en seance en portant des prix imprimes la veille au soir. Sans
   l'heure du cours, l'application afficherait trois certificats de fraicheur
   pour une donnee vieille de dix-huit heures -- la pastille de la derniere
   actualisation, l'apercu a l'heure de la requete, la ligne ouverte a +0,00 %.

   Aucun chiffre n'est faux. `posDayChange()` rend bien `horsSeance: true` et
   un ecart nul, ce qui est la reponse exacte a l'ecart depuis la cloture
   d'hier. Ce qui doit se voir, c'est que rien d'autre ne s'est passe :
   `horsSeance` atteint l'ecran, et `quoteTime` s'affiche.
   ------------------------------------------------------------------ */
suite('Un cours dit de quand il date', () => {

  const secondes = (iso, heure = '14:00:00') =>
    Math.floor(new Date(`${iso}T${heure}`).getTime() / 1000);

  const veilleDe = iso => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return isoLocal(d);
  };

  /* Des lignes cotées, chacune avec l'heure de sa dernière transaction. La
     requête, elle, vient d'avoir lieu : c'est tout l'objet de la suite. */
  const avecCours = lignes => Fixture.poser(e => {
    e.positions = lignes.map((l, i) => ({
      id: `p_${i}`, name: l.nom || `Ligne ${i}`, isin: '', symbol: `SYM${i}`,
      currency: 'EUR', qty: 100, buyPrice: 5, price: l.prix, fx: 1, fxBuy: 1,
      account: 'c_pea', manual: !!l.manuel, assetClass: 'actions', role: 'core',
      prevClose: l.veille, quoteTime: l.quand || null,
    }));
    e.quotes = { lastRun: new Date().toISOString(), fx: {}, changes: [] };
  });

  test('l’heure retenue est celle du marché, jamais celle de la requête', () => {
    /* Le coeur du defaut. Les deux horloges etaient confondues partout, et
       c'est la fraiche qui gagnait : rafraichir ne changeait que l'heure
       affichee, jamais les chiffres, et rien ne permettait de s'en apercevoir. */
    auJour('2026-08-06', () => {
      const hier = veilleDe('2026-08-06');
      avecCours([{ prix: 6.16, veille: 6.12, quand: secondes(hier, '22:00:00') },
                 { prix: 9.00, veille: 9.00, quand: secondes(hier, '20:00:00') }]);
      eq(coursAsOf(), secondes(hier, '22:00:00'),
        'le plus récent des cours en mémoire, et il date d’hier');
      const requete = new Date(Store.state.quotes.lastRun).getTime();
      vrai(requete - coursAsOf() * 1000 > 3600 * 1000,
        'la requête est fraîche et les prix ne le sont pas : c’est exactement '
        + 'l’écart que l’application effaçait en datant les cours de lastRun');
    });
  });

  test('une ligne saisie à la main ne date aucun cours', () => {
    /* Elle n'a pas de marche : lui laisser dater la pastille ferait dependre la
       fraicheur affichee d'une valeur que personne ne rafraichit. */
    auJour('2026-08-06', () => {
      avecCours([{ prix: 6.16, veille: 6.12, quand: secondes('2026-08-06', '11:00:00') },
                 { prix: 100, veille: 100, quand: secondes('2026-08-06', '17:00:00'), manuel: true }]);
      eq(coursAsOf(), secondes('2026-08-06', '11:00:00'),
        'la ligne manuelle est écartée, même si son heure est la plus récente');
    });
  });

  test('sans aucun cours horodaté, il n’y a pas d’heure de marché à donner', () => {
    /* Stooq ne publie pas l'heure. On ne peut alors rien affirmer, et inventer
       une heure serait pire que n'en montrer aucune. */
    auJour('2026-08-06', () => {
      avecCours([{ prix: 6.16, veille: 6.12, quand: null }]);
      eq(coursAsOf(), null, 'aucune heure, et on le dit');
    });
  });

  test('les lignes qui n’ont pas coté aujourd’hui se comptent', () => {
    /* `horsSeance` existait ligne a ligne depuis le 5 aout et ne remontait pas
       au total : aucun ecran ne pouvait donc dire combien de lignes se taisent. */
    auJour('2026-08-06', () => {
      const hier = veilleDe('2026-08-06');
      avecCours([{ prix: 6.16, veille: 6.12, quand: secondes('2026-08-06', '11:00:00') },
                 { prix: 9.50, veille: 9.00, quand: secondes(hier, '22:00:00') }]);
      const j = dayPerformance();
      eq(j.lignes.length, 2, 'les deux lignes restent listées');
      eq(j.horsSeance, 1, 'une seule n’a pas coté depuis minuit');
      eq(j.toutHorsSeance, false, 'l’autre a bien coté');
      pres(j.eur, (6.16 - 6.12) * 100,
        'et le total ne porte que la ligne qui a coté : celle d’hier vaut zéro, '
        + 'ce qui est exact, mais elle ne doit pas passer pour une séance atone');
      pres(j.eur, j.lignes.reduce((s, l) => s + l.eur, 0),
        'le total reste la somme de ses parts');
    });
  });

  test('quand rien n’a coté, le total nul se déclare au lieu de s’afficher', () => {
    /* Le symptome exact du 6 aout : toutes les lignes figees, un total de
       « +0 € · +0,00 % », et un ecran qui se lit « journee sans mouvement ».
       Le drapeau existe pour que l'ecran puisse choisir une phrase plutot qu'un
       montant — un zero calcule et un zero faute de donnee s'ecrivent pareil. */
    auJour('2026-08-06', () => {
      const hier = veilleDe('2026-08-06');
      avecCours([{ prix: 6.16, veille: 6.12, quand: secondes(hier, '22:00:00') },
                 { prix: 9.50, veille: 9.00, quand: secondes(hier, '21:00:00') }]);
      const j = dayPerformance();
      eq(j.horsSeance, 2, 'les deux se taisent');
      eq(j.toutHorsSeance, true, 'et l’écran a de quoi le dire d’un mot');
      eq(j.eur, 0, 'le total est nul, ce qui est juste');
      eq(j.asOfMarche, secondes(hier, '22:00:00'),
        'et il peut nommer la date du cours le plus récent');
    });
  });

  test('« sans cours de veille » et « sans cours du jour » comptent deux choses', () => {
    /* Deux manques distincts, et les confondre effacerait l'un des deux :
       l'un sort la ligne de la liste faute de reference, l'autre l'y laisse
       avec un ecart nul. L'apercu appelait « sans cours du jour » le premier,
       ce qui rendait le second inexprimable. */
    auJour('2026-08-06', () => {
      const hier = veilleDe('2026-08-06');
      avecCours([{ prix: 6.16, veille: 0, quand: secondes('2026-08-06', '11:00:00') },
                 { prix: 9.50, veille: 9.00, quand: secondes(hier, '22:00:00') }]);
      const j = dayPerformance();
      eq(j.sansDonnee, 1, 'une ligne sans clôture de référence');
      eq(j.horsSeance, 1, 'une ligne dont le cours date d’avant minuit');
      eq(j.lignes.length, 1, 'et une seule des deux est listée');
      eq(j.toutHorsSeance, true, 'la seule listée se tait');
    });
  });

  test('la date d’un cours se dit comme on la dit à voix haute', () => {
    /* La preposition vient avec, et les trois branches n'ont pas la meme. La
       laisser aux appelants a donne « cours de hier à 22:00 » a l'ecran des la
       premiere version : cinq endroits ecrivent cette phrase, il y avait cinq
       occasions d'oublier l'elision. */
    auJour('2026-08-06', () => {
      eq(fmtCoursQuand(secondes('2026-08-06', '11:05:00')), 'de 11:05',
        'aujourd’hui, la date n’apprend rien : l’heure seule');
      eq(fmtCoursQuand(secondes(veilleDe('2026-08-06'), '22:00:00')), 'd’hier à 22:00',
        'la veille se nomme, elle ne se date pas');
      eq(fmtCoursQuand(secondes('2026-08-01', '17:30:00')), 'du 1 août à 17:30',
        'au-delà, le jour et le mois');
      eq(fmtCoursQuand(null), '', 'et rien à dire quand on ne sait pas');
    });
  });

  /* --- ce que les écrans en font ------------------------------------
     `app.js` ne se charge pas ici : on lit sa source. Les contrôles se
     dérivent du balisage plutôt que de nommer les appelants, pour que l'écran
     qu'on écrira demain soit déjà couvert. */

  test('aucun écran ne date un cours de l’heure de la requête', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    /* La regle, derivee : partout ou l'application ecrit « cours de … », elle
       doit lire une heure de marche. `lastRun` et le `asOf` qui le recopie
       datent la requete, et les coller a un prix est precisement le mensonge
       qu'on corrige. */
    for (const m of src.matchAll(/cours \$\{|date \$\{/g)) {
      const expr = src.slice(m.index, m.index + 120);
      vrai(/fmtCoursQuand|quoteTime|asOfMarche/.test(expr),
        'un « cours de … » doit se dater sur l’heure du marché, pas sur celle '
        + `de la requête : ${expr.slice(0, 80)}`);
      vrai(!/\bj\.asOf\b|lastRun/.test(expr),
        `« cours de … » ne peut pas venir de lastRun : ${expr.slice(0, 80)}`);
    }

    /* Et la pastille du haut, qui est le seul repere de fraicheur visible sur
       toutes les pages. */
    const fn = src.slice(src.indexOf('function majEtatCours'),
                         src.indexOf('function symbolSearchCard'));
    vrai(fn.length > 400, 'majEtatCours() doit être trouvable');
    vrai(/coursAsOf\(\)/.test(fn),
      'la pastille doit lire l’heure du marché');
    vrai(fn.indexOf('marche ? fmtWhen') < fn.indexOf(': last ? fmtWhen(last)'),
      'et ne retomber sur l’heure de la requête qu’à défaut d’heure de marché');
  });

  test('une ligne qui n’a pas coté ne s’affiche pas à zéro, et dit pourquoi', () => {
    /* Le raisonnement existait deja, ecrit noir sur blanc au-dessus de
       `jourTitres` : « un titre qui n'a pas cote ne fait pas 0 EUR de
       variation, il ne dit rien ». Il n'etait applique qu'aux lignes sans
       cloture de reference — l'autre moitie du probleme s'affichait bien a
       plat, avec « ouvert » a cote. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    /* Chaque colonne se lit bornee a son propre `</span>`, jamais sur un
       nombre de caracteres : une fenetre de 200 caracteres depuis `jl-pct`
       mordait sur `jl-eur`, et le controle passait en ne lisant que la
       colonne d'a cote. Verifie en recassant — c'est ainsi qu'on l'a su. */
    for (const colonne of ['jl-pct', 'jl-eur']) {
      const i = src.indexOf(`<span class="${colonne}`);
      vrai(i > 0, `la colonne ${colonne} doit être trouvable`);
      const cellule = src.slice(i, src.indexOf('</span>', i));
      vrai(/l\.horsSeance/.test(cellule),
        `la colonne ${colonne} doit se taire hors séance plutôt qu’afficher zéro`);
    }
    /* Et la ligne porte la raison, sans quoi une colonne vide se lirait comme
       une donnee manquante de plus. */
    vrai(/l\.horsSeance \? \(l\.quoteTime/.test(src),
      'la ligne doit nommer la date de son cours, ou dire qu’elle n’a pas coté');
  });

  test('le ruban d’indices suit la même règle que les lignes de titres', () => {
    /* La meme regle vaut pour le ruban au-dessus de la carte du jour : un indice
       sous un soleil ne doit pas porter le mouvement de la veille.

       Une regle ecrite pour un cas s'applique a tous ceux qui lui ressemblent,
       et s'arreter au symptome revient a attendre le suivant. Le repere porte
       deja `quoteTime`, `marketState` et `session` -- tout ce que
       `coteAujourdhui()` demande -- et c'est eux qu'il lit. */
    const q = lireSource('assets/quotes.js');
    vrai(q, 'assets/quotes.js doit être lisible pour ce contrôle');
    const fn = q.slice(q.indexOf('async function reperes'), q.indexOf('cacheReperes.set'));
    vrai(fn.length > 400, 'reperes() doit être trouvable');
    vrai(/coteAujourdhui\(/.test(fn),
      'le ruban doit vérifier que le cours date d’aujourd’hui, comme une ligne de titres');
    vrai(/pct: utilisable && !horsSeance/.test(fn),
      'et ne publier de variation du jour que si une séance a eu lieu');

    /* Et les deux ecrans qui rendent ce `pct` doivent survivre a son absence :
       `fmtSignedPct(null)` ecrirait « +0,00 % », soit exactement le chiffre
       qu'on refuse de publier. */
    const src = lireSource('assets/app.js');
    for (const ancre of ['rp-var', 'Variation du jour']) {
      const i = src.indexOf(ancre);
      vrai(i > 0, `« ${ancre} » doit être trouvable`);
      vrai(/l\.pct == null/.test(src.slice(i, i + 400)),
        `« ${ancre} » doit se taire quand la variation du jour n’existe pas`);
    }
  });

  test('les deux libellés de manque ne se croisent jamais', () => {
    /* « Le même libellé donne le même montant sur tous les écrans. » Ici c'est
       l'inverse qui menaçait : deux comptes différents sous un seul libellé,
       et l'apercu appelait « sans cours du jour » ce que la carte appelait
       « sans cours de veille » — pour le meme `sansDonnee`. */
    /* Sur le code seul : la regle porte sur les libelles affiches, et un
       commentaire qui emploie la phrase ne compte rien. Il doit tout de meme
       dire vrai, mais c'est la relecture qui s'en charge, pas ce controle. */
    const src = (lireSource('assets/app.js') || '')
      .replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    const paires = [['sans cours du jour', 'horsSeance', 'sansDonnee'],
                    ['sans cours de veille', 'sansDonnee', 'horsSeance']];
    for (const [phrase, attendu, interdit] of paires) {
      const trouvees = [...src.matchAll(new RegExp(phrase, 'g'))];
      vrai(trouvees.length >= 1, `« ${phrase} » doit s’afficher`);
      for (const m of trouvees) {
        const avant = src.slice(Math.max(0, m.index - 160), m.index);
        vrai(avant.includes(attendu),
          `« ${phrase} » doit compter ${attendu}`);
        vrai(!new RegExp(`${interdit}[^]{0,60}$`).test(avant),
          `« ${phrase} » ne doit jamais compter ${interdit}`);
      }
    }
  });
});

/* ------------------------------------------------------------------
   12 bis. La cloche
   ------------------------------------------------------------------ */
suite('Ce que la cloche annonce', () => {

  /* Un état qui réclame les deux saisies : aucun relevé, aucune dépense. */
  /* L'historique du fixture reste : il s'arrete en fevrier, donc le mois courant
     et le mois clos manquent deja et les deux rappels s'allument d'eux-memes.
     Le vider serait simuler un premier lancement — et depuis que les rappels se
     taisent sur une application qui n'a jamais servi, c'est ce qui se passait :
     ces trois controles-ci portent sur le report et l'expiration, pas sur
     l'accueil d'un nouveau venu. */
  const enRetard = () => Fixture.poser(e => {
    e.meta.rappelsMasques = {};
    e.meta.notifsMasquees = [];
    e.meta.notifsReglages = {};
  });

  const titres = () => notifications().map(n => n.title);

  test('les saisies en attente viennent en tête', () => {
    /* Elles sont les seules sur lesquelles on peut agir tout de suite ; le
       reste demande de comprendre un chiffre avant de le corriger. */
    enRetard();
    const n = notifications();
    vrai(n.length >= 2, 'les deux saisies doivent être annoncées');
    eq(n[0].level, 'action');
    eq(n[1].level, 'action');
    vrai(n.every((x, i) => i === 0 || RANG_NOTIF[x.level] >= RANG_NOTIF[n[i - 1].level]),
      'du plus pressant au moins pressant, sans exception');
  });

  test('« Plus tard » éteint aussi la cloche', () => {
    /* Le défaut que ce contrôle protège : `healthChecks` lisait l'état brut, donc
       le report éteignait le bandeau et la pastille de la barre du bas, mais pas
       cette ligne. La cloche rallumait ce qu'on venait d'éteindre. */
    enRetard();
    const avant = titres().length;
    reporterRappel('releve');
    reporterRappel('depenses');
    const apres = titres();
    eq(apres.length, avant - 2, 'les deux lignes de saisie s’en vont');
    vrai(!apres.some(t => /à enregistrer|à saisir/.test(t)),
      'et aucune ne parle plus d’une saisie en attente');
  });

  test('une notification masquée ne revient pas, ses chiffres changent ou non', () => {
    /* La clé se moque des nombres : « 0,7 mois » devient « 3,1 mois » le mois
       suivant, et une clé qui les garderait ferait réapparaître la même alerte à
       chaque centième. */
    enRetard();
    const cible = notifications()[0];
    vrai(cible, 'il faut au moins une notification pour ce contrôle');
    masquerNotif(cible.cle);
    vrai(!titres().includes(cible.title), 'masquée, elle sort de la liste');

    const memeAutresChiffres = { ...cible, title: cible.title.replace(/\d+/g, '9') };
    eq(cleNotif(memeAutresChiffres), cible.cle,
      'les mêmes mots avec d’autres chiffres donnent la même clé');

    rendreNotifs();
    vrai(titres().includes(cible.title), '« Tout réafficher » la ramène');
  });

  test('une famille ignorée ne compte plus', () => {
    /* La famille est un SUJET, plus une gravite. */
    enRetard();
    const avant = notifications().filter(n => n.sujet === 'saisies').length;
    vrai(avant > 0, 'il faut des saisies en attente pour ce contrôle');
    Store.state.meta.notifsReglages = { saisies: false };
    eq(notifications().filter(n => n.sujet === 'saisies').length, 0,
      'plus une seule ligne de cette famille');
    eq(reglagesNotifs().cours, true, 'les autres familles restent allumées');
    Store.state.meta.notifsReglages = {};
    eq(notifications().filter(n => n.sujet === 'saisies').length, avant, 'et se rallument');
  });

  test('éteindre un sujet ne fait pas taire ses voisins', () => {
    /* Le defaut que ce changement d'axe corrige, et le seul qui compte : quatre
       interrupteurs par gravite ne disent pas quelle notification on arrete
       selon le message.

       Avec la gravite, faire taire Cours vieux de 12 jours -- un avertissement --
       emporterait Epargne de precaution : 0,8 mois, qui en est un aussi et n'a
       rien a voir. Le controle prend donc deux sujets differents et verifie
       qu'eteindre l'un laisse l'autre intact. */
    Fixture.poser(e => {
      e.positions = [{ id: 'p1', name: 'Sans identifiant', qty: 1, price: 10,
                       currency: 'EUR', fx: 1, account: 'c_pea', assetClass: 'actions' }];
      e.quotes = { lastRun: null };
      e.meta.notifsReglages = {};
    });
    const sujets = n => [...new Set(notifications().map(x => x.sujet))].sort();
    vrai(sujets().includes('cours'), 'le fixture doit produire au moins une alerte de cours');

    const avant = notifications().length;
    Store.state.meta.notifsReglages = { cours: false };
    const apres = notifications();
    eq(apres.filter(n => n.sujet === 'cours').length, 0, 'le sujet éteint se tait');
    vrai(apres.length < avant, 'et il a bien retiré quelque chose');
    /* Rien d'autre n'a bouge : c'est toute la difference avec l'axe d'avant. */
    for (const s of sujets()) eq(s === 'cours', false, 'aucun autre sujet ne doit rester filtré');
  });

  test('le menu des réglages couvre toutes les familles', () => {
    /* Deux listes du même fait finissent par diverger. Le menu se construit sur
       FAMILLES_NOTIF, et chaque contrôle déclare son sujet dans healthChecks :
       les deux doivent porter exactement les mêmes clés, sinon un contrôle devient
       inextinguible — son sujet n'a pas d'interrupteur — ou un interrupteur ne
       commande rien.

       La liste se dérive du calcul, elle ne se recopie pas : on lit les sujets
       réellement émis plutôt que d'en tenir une seconde table. RANG_NOTIF, lui,
       garde les gravités : elles trient toujours le panneau, elles ont juste
       cessé d'être ce qu'on éteint. */
    const dansMenu = FAMILLES_NOTIF.map(f => f[0]).sort();
    for (const [cle, nom, quoi] of FAMILLES_NOTIF) {
      vrai(nom && quoi, cle + ' doit porter un nom et une explication');
      eq(reglagesNotifs()[cle] !== undefined, true, cle + ' doit avoir un réglage');
    }
    /* Tout sujet emis par un controle doit exister au menu. On force un etat qui
       en produit beaucoup, pour couvrir large. */
    Fixture.poser(e => { e.meta.notifsReglages = {}; e.meta.notifsMasquees = []; });
    for (const n of healthChecks()) {
      vrai(n.sujet, `« ${n.title} » doit déclarer son sujet`);
      vrai(dansMenu.includes(n.sujet),
        `« ${n.title} » porte le sujet « ${n.sujet} », absent du menu : il serait inextinguible`);
    }
    /* Et la gravite reste une gravite connue, pour le tri et l'icone. */
    for (const n of healthChecks()) {
      vrai(RANG_NOTIF[n.level] !== undefined,
        `« ${n.title} » porte une gravité inconnue : le panneau ne saurait pas la classer`);
    }
  });

  test('un état sans ces champs signale quand même', () => {
    /* Aucune migration : `notifsMasquees` et `notifsReglages` peuvent ne pas
       exister. Tout est allumé par défaut — une notification jamais vue ne peut
       pas avoir été refusée. */
    Fixture.poser(e => {
      e.monthly = []; e.budget.expenses = [];
      delete e.meta.notifsMasquees; delete e.meta.notifsReglages;
    });
    vrai(notifications().length >= 2, 'les deux saisies sont annoncées');
    eq(notifsMasquees().length, 0);
    for (const [cle] of FAMILLES_NOTIF) eq(reglagesNotifs()[cle], true, cle);
  });
});

/* ------------------------------------------------------------------
   13. Les rappels de saisie
   ------------------------------------------------------------------ */
/* Vider `monthly` fait d'un etat installe un nouveau venu, et le rappel mensuel
   attend desormais que l'inventaire des comptes soit declare complet. Les
   controles qui suivent portent sur la MECANIQUE du rappel — report,
   expiration, jour dit — et non sur l'accueil : ils declarent donc la reponse
   en meme temps qu'ils vident le mois. */
const sansReleves = e => {
  e.monthly = [];
  e.meta.notifsMasquees = [CLE_INVENTAIRE];
};

suite('Rappels de saisie', () => {

  const moisCourant = () => currentMonthKey();

  test('un mois sans relevé réclame une saisie', () => {
    Fixture.poser(sansReleves);
    const p = currentMonthPending();
    eq(p.vide, true, 'le mois est bien vide');
    eq(p.missing, true, 'donc le rappel s allume');
  });

  test('la croix éteint le rappel du mois en cours', () => {
    /* Attendre une rentree d argent est une raison legitime de ne pas vouloir
       saisir maintenant. Un rappel qu on ne peut pas eteindre finit par ne
       plus etre lu. */
    Fixture.poser(e => { e.monthly = []; });
    masquerRappel('releve', moisCourant());
    const p = currentMonthPending();
    eq(p.vide, true, 'le mois reste vide, on ne fait pas semblant');
    eq(p.missing, false, 'mais le rappel se tait');
  });

  test('le report expire au mois suivant, sans rien faire', () => {
    /* Il porte une cle de mois : rien a lever a la main, et on ne peut pas
       taire un rappel pour toujours par accident. */
    Fixture.poser(e => {
      sansReleves(e);
      e.meta.rappelsMasques = { releve: '2020-01-01' };
    });
    eq(currentMonthPending().missing, true,
      'un report vieux d un autre mois ne protege plus rien');
  });

  test('les deux rappels sont indépendants', () => {
    Fixture.poser();
    masquerRappel('releve', moisCourant());
    eq(currentMonthPending().missing, false, 'le relevé se tait');
    eq(depensesEnAttente().missing, true, 'les dépenses continuent de réclamer');
  });

  test('un état sans ce champ se comporte comme avant', () => {
    /* Aucune migration : `rappelsMasques` peut ne pas exister. */
    Fixture.poser(e => { sansReleves(e); delete e.meta.rappelsMasques; });
    eq(currentMonthPending().missing, true);
  });

  /* `auJour()` est en tête de fichier : sans ce levier, l'expiration d'un report
     ne se vérifierait qu'en attendant sept jours. */

  test('« Plus tard » repousse de sept jours, pas du mois', () => {
    Fixture.poser(sansReleves);
    auJour('2026-07-25', () => {
      eq(reporterRappel('releve'), '2026-08-01', 'sept jours apres le 25 juillet');
      eq(currentMonthPending().missing, false, 'le rappel se tait aujourd’hui');
    });
    auJour('2026-07-31', () =>
      eq(currentMonthPending().missing, false, 'et la veille encore'));
    auJour('2026-08-01', () =>
      eq(currentMonthPending().missing, true, 'au septieme jour il revient'));
  });

  test('un report qui tombe un 1er n’efface pas le mois entier', () => {
    /* Le piege : une cle de mois est « 2026-08-01 », soit une date ISO elle
       aussi. Sans le prefixe, ce report se lirait comme un masquage d'aout,
       et le rappel disparaitrait trente jours au lieu de sept. */
    Fixture.poser(sansReleves);
    auJour('2026-07-25', () => reporterRappel('releve'));
    vrai(String(Store.state.meta.rappelsMasques.releve).startsWith('jusquau:'),
      'un report doit se distinguer d’une clé de mois');
    auJour('2026-08-04', () =>
      eq(currentMonthPending().missing, true,
        'le 4 aout, le report du 1er est expire : aout reclame sa saisie'));
  });

  test('les deux formes cohabitent dans le même champ', () => {
    /* Un etat ecrit avant le report ne porte que des cles de mois : il doit
       continuer de se taire, sinon la mise a jour rallume tous les rappels
       que l'on avait eteints. */
    /* Le mois se masque SOUS la date simulee, pas sous celle de l'horloge.

       `currentMonthKey()` lu hors du `auJour` rend le mois reel : un premier
       septembre, il masquait « 2026-09 » puis le controle verifiait « 2026-08 »,
       et le rappel se rallumait. Le test tombait donc a chaque changement de
       mois, sans que rien n'ait bouge dans le code. C'est la meme faute qu'un
       `setMonth()` sur un 31, deja notee ici : une date lue a un endroit et
       employee a un autre. */
    Fixture.poser();
    auJour('2026-08-04', () => {
      masquerRappel('releve', currentMonthKey());
      reporterRappel('depenses');
    });
    auJour('2026-08-04', () => {
      eq(currentMonthPending().missing, false, 'la clé de mois tait toujours');
      eq(depensesEnAttente().missing, false, 'le report tait aussi');
    });
    auJour('2026-08-12', () =>
      eq(depensesEnAttente().missing, true, 'mais lui seul expire au bout de sept jours'));
  });

  test('un report se lit à la journée, pas à l’heure', () => {
    /* `todayISO` est en heure locale, la date du report vient d'un
       `toISOString`, qui est en UTC. Un report pose le soir a Paris ne doit
       pas perdre un jour au passage. */
    Fixture.poser(e => { e.monthly = []; });
    for (const jour of ['2026-01-15', '2026-03-29', '2026-06-30', '2026-12-31']) {
      auJour(jour, () => {
        const quand = reporterRappel('releve');
        const attendu = new Date(jour + 'T12:00:00');
        attendu.setDate(attendu.getDate() + 7);
        eq(quand, attendu.toISOString().slice(0, 10), jour + ' + 7 jours');
      });
    }
  });

  test('« Plus tard » veut dire sept jours partout', () => {
    /* Trois bandeaux portent ce rappel : l'accueil, les depenses, les releves.
       Celui des releves disait deja « Plus tard » en taisant le mois entier,
       pendant que le nouveau ne repoussait que d'une semaine — deux gestes
       differents sous le meme mot. Le libelle et l'action doivent rester
       lies, et ce controle est le seul qui puisse le dire : le rendu vit dans
       app.js, que le harnais ne charge pas. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    /* Chaque <button> du fichier, decoupe grossierement : on ne veut que le
       couple (action, libelle). */
    const boutons = src.match(/<button[\s\S]{0,400}?<\/button>/g) || [];
    vrai(boutons.length > 20, 'la source doit contenir des boutons');

    for (const b of boutons) {
      const action = (b.match(/data-action="([^"]+)"/) || [])[1] || '';
      const dit = b.includes('Plus tard');
      if (dit) eq(action, 'reporter-rappel',
        '« Plus tard » ne peut appeler que le report de sept jours');
      if (action === 'taire-rappel') vrai(!dit,
        'taire le mois entier ne peut pas s’appeler « Plus tard »');
    }
    vrai(boutons.some(b => b.includes('Plus tard')),
      'et le bouton doit toujours exister, sinon ce contrôle ne prouve rien');
  });

  test('« Plus tard » ne laisse rien à l’écran', () => {
    /* Le report a porté un temps une note calme, avec la date du prochain
       rappel et une croix pour la fermer : deux gestes pour se débarrasser d'un
       rappel, un de trop. La date se dit dans le toast, au moment du clic.

       Ce qui doit rester vrai : le report éteint le rappel, il ne dépose rien
       d'autre dans l'état que sa propre date, et rien ne le remplace à
       l'écran. */
    Fixture.poser(e => { e.monthly = []; });
    auJour('2026-08-04', () => {
      eq(reporterRappel('releve'), '2026-08-11', 'la date que le toast annonce');
      eq(currentMonthPending().missing, false, 'et le bandeau se tait');
      eq(Object.keys(Store.state.meta.rappelsMasques).join(','), 'releve',
        'un seul champ touché, celui du genre reporté');
    });
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai(!/note-calme/.test(src),
      'aucune note ne doit survivre au report : l’écran doit rester propre');
  });

  test('« 11 août » se dit sans son année', () => {
    eq(fmtJourMois('2026-08-11'), '11 août');
    eq(fmtJourMois('2026-01-01'), '1 janv.');
    eq(fmtJourMois(''), '', 'et une date absente ne dit rien');
  });
});

/* ------------------------------------------------------------------
   Les trois lectures « par enveloppe »
   ------------------------------------------------------------------ */
suite('Les trois lectures par enveloppe s’accordent', () => {

  /* Trois écrans rangent l'argent par enveloppe fiscale, et chacun annonce une
     base différente : la page Comptes compte tout ce qu'on possède, « Type de
     compte » ne compte que ce qui est placé en bourse, « Comptes & enveloppes »
     tout ce qui est placé. Trois nombres, donc, et c'est voulu — ce que ces
     contrôles vérifient, c'est que chacun égale bien la base qu'il affiche, et
     que les trois s'emboîtent au lieu de se contredire. */

  test('l’onglet Enveloppe de Comptes somme tous les avoirs', () => {
    Fixture.poser();
    const g = groupesParEnveloppe();
    pres(g.reduce((s, x) => s + x.total, 0), patrimoine().brut,
      'les groupes de la page Comptes doivent refaire le total qu’elle affiche');
    /* Et chaque compte dans un seul groupe : deux groupes le compteraient deux
       fois, et la somme tomberait juste par hasard un jour sur deux. */
    const vus = g.flatMap(x => x.comptes.map(c => c.id));
    eq(vus.length, new Set(vus).size, 'aucun compte ne paraît deux fois');
    eq(vus.length, comptesOuverts().length, 'et aucun ne manque');
  });

  test('un type inconnu garde son groupe au lieu de s’évaporer', () => {
    /* Le regroupement parcourait TYPES_COMPTE et gardait les comptes de chaque
       type. Un état venu de l'ancien modèle peut porter un type que cette liste
       ne connaît pas — `levier`, par exemple : le compte disparaissait alors de
       la page tout en restant dans le total affiché en tête, et la règle du
       projet tombait sans un mot à l'écran. */
    Fixture.poser(e => {
      e.comptes.push({ id: 'c_levier', etabId: 'e_courtier', type: 'levier',
        statut: 'ouvert', ouvertLe: '2025-01-01', numero: '', notes: '',
        libelle: 'Compte à levier', court: 'Levier', alloc: '', cash: [],
        lignes: [{ id: 'l_lev', classe: 'actions', libelle: 'Position à levier',
                   valeur: 4000, prixDeRevient: 4000, quantite: 1, dateAcquisition: '' }] });
    });
    const g = groupesParEnveloppe();
    pres(g.reduce((s, x) => s + x.total, 0), patrimoine().brut,
      'le total de la page vaut toujours la somme de ses groupes');
    const sien = g.find(x => x.comptes.some(c => c.id === 'c_levier'));
    vrai(sien, 'le compte au type inconnu a bien un groupe');
    pres(sien.total, 4000, 'et son groupe porte son montant');
    /* Les types connus gardent leur ordre, l'inconnu passe en queue. */
    eq(g[g.length - 1].id, 'levier', 'un type que la liste ignore vient à la fin');
  });

  test('« Type de compte » et « Comptes & enveloppes » comptent le même argent', () => {
    /* Les deux cartes de la page Patrimoine sont deux granularites d'un seul
       total : le type d'enveloppe, puis le compte. Leurs sommes doivent donc
       etre egales, et c'est un invariant plus fort qu'une base nommee.

       Une carte qui ne porterait que la bourse, sur une page ou tout le reste se
       rapporte aux avoirs ou a ce qui est place, afficherait un denominateur
       different de ses voisines : quatre cartes, quatre denominateurs. Chacun
       serait nomme, donc aucun ne mentirait, mais nommer une base ne dispense
       pas de prendre celle de ses voisines quand rien ne justifie d'en
       changer. */
    Fixture.poser();
    const parType = byAccountType().reduce((s, x) => s + x.value, 0);
    const parCompte = allocationByAccount().reduce((s, x) => s + x.value, 0);
    pres(parType, parCompte,
      'le même argent vu par type et vu par compte doit faire le même total');
    /* La base est desormais les avoirs, liquidites comprises. Elle excluait le
       cash deux fois — les comptes du groupe `cash` etaient ecartes, et
       `lignesDe()` ne voit pas le cash pose sur un compte-titres — et une page
       qui s'appelle « Allocation » cachait ainsi quinze mille euros. Le cash est
       une classe d'actif, celle qu'on choisit quand on ne choisit pas. */
    pres(parType, nowTotals().brut, 'et c’est « Tes avoirs », la base annoncée');
    pres(byAccountType().reduce((s, x) => s + x.pct, 0), 100, 'les parts font 100 %');
  });

  test('le levier ne devient pas une enveloppe', () => {
    /* Le piege de l'elargissement, attrape par ce test lors d'une premiere
       tentative : `levier` ne figure pas dans TYPES_COMPTE — il vient de
       l'ancien modele — donc `typeCompte('levier').groupe` ne vaut rien et le
       filtre sur le groupe ne l'ecarte pas. Une dette serait apparue comme une
       enveloppe, avec ses 4 000 EUR comptes comme un placement. */
    Fixture.poser(e => {
      e.comptes.push({ id: 'c_levier', etabId: 'e_courtier', type: 'levier',
        statut: 'ouvert', ouvertLe: '2025-01-01', numero: '', notes: '',
        libelle: 'Compte à levier', court: 'Levier', alloc: '', cash: [],
        lignes: [{ id: 'l_lev', classe: 'actions', libelle: 'Position à levier',
                   valeur: 4000, prixDeRevient: 4000, quantite: 1, dateAcquisition: '' }] });
    });
    vrai(!byAccountType().some(x => /levier/i.test(x.label)),
      'aucune enveloppe « levier » dans la répartition');
  });

  test('« Par compte » vaut tous les avoirs, liquidités comprises', () => {
    Fixture.poser();
    const lignes = allocationByAccount();
    pres(lignes.reduce((s, x) => s + x.value, 0), nowTotals().brut,
      'la base annoncée est « Tes avoirs » : c’est le brut');
    pres(lignes.reduce((s, x) => s + x.pct, 0), 100, 'les parts font 100 %');
    /* Le liquide y figure vraiment, et des deux endroits ou il se pose : un
       compte de cash entier, et la poche de cash d'un compte-titres. */
    const cash = comptesOuverts().filter(c => typeCompte(c.type).groupe === 'cash');
    vrai(cash.length, 'la fixture porte bien des comptes de liquidités');
    for (const c of cash) {
      if (!valeurCompte(c)) continue;
      vrai(lignes.some(l => l.label === nomCompteV2(c)),
        `${nomCompteV2(c)} doit apparaître dans la répartition`);
    }
  });

  test('la concentration se dit sur la liste qu’on regarde', () => {
    /* La phrase se pose sous les barres du classement par poids : elle doit donc
       compter la meme liste, `allocationByAsset`, et non une somme refaite a
       cote. Deux additions du meme fait finissent par diverger, et celle-ci
       serait invisible — les deux nombres restant plausibles. */
    Fixture.poser();
    const c = concentration();
    vrai(c, 'la fixture doit produire une concentration');
    const lignes = allocationByAsset({ credits: false }).filter(l => l.value > 0.005);
    eq(c.premiere.label, lignes[0].label,
      'la ligne citée est la première du classement affiché');
    pres(c.premiere.pct, lignes[0].value / nowTotals().brut * 100,
      'et son pourcentage est pris sur « Tes avoirs », la base de la page');
    pres(c.top3.value, lignes.slice(0, 3).reduce((s, l) => s + l.value, 0),
      'les trois premières sont les trois premières de cette même liste');
  });

  test('la concentration se tait quand elle n’apprend rien', () => {
    /* Deux gardes, et chacune evite une phrase vraie mais vide. Une seule ligne
       pese 100 % par construction : le dire est du bruit. Et a trois lignes, les
       « trois premieres » sont le patrimoine entier. */
    Fixture.poser(e => {
      e.comptes = [e.comptes[0]];
      e.comptes[0].cash = [];
      e.comptes[0].lignes = [{ id: 'l_seule', classe: 'actions', libelle: 'Une seule',
                               valeur: 5000, prixDeRevient: 5000, quantite: 1,
                               dateAcquisition: '' }];
      e.positions = [];
    });
    eq(concentration(), null, 'une ligne unique ne se commente pas');

    Fixture.poser(e => {
      e.comptes = [e.comptes[0]];
      e.comptes[0].cash = [];
      e.comptes[0].lignes = ['a', 'b', 'c'].map((n, i) => ({
        id: 'l_' + n, classe: 'actions', libelle: 'Ligne ' + n,
        valeur: 1000 * (i + 1), prixDeRevient: 1000, quantite: 1, dateAcquisition: '' }));
      e.positions = [];
    });
    const c3 = concentration();
    vrai(c3, 'trois lignes se commentent encore, pour la plus grosse');
    eq(c3.top3, null, 'mais « les trois premières » y valent 100 % : la phrase se tait');
  });

  test('« Par disponibilité » somme les avoirs, comme ses deux voisines', () => {
    /* Le troisieme axe de la page. Ses parts doivent faire la meme base que les
       deux autres cartes, sans quoi la page reprendrait les trois denominateurs
       dont elle s'est debarrassee le 13 aout. */
    Fixture.poser();
    const d = allocationParDisponibilite();
    vrai(d.length, 'la fixture doit produire au moins un palier');
    pres(d.reduce((s, x) => s + x.value, 0), nowTotals().brut,
      'la somme des paliers fait « Tes avoirs »');
    pres(d.reduce((s, x) => s + x.pct, 0), 100, 'les parts font 100 %');
  });

  test('les deux lectures de la carte partagent leur base', () => {
    /* Par enveloppe et par compte sont deux granularites d'un seul total : deux
       bases differentes en feraient deux cartes qui se contredisent sous un
       meme titre. Il y avait trois bases sur cette page, il n'en reste qu'une. */
    Fixture.poser();
    const parType = byAccountType().reduce((s, x) => s + x.value, 0);
    const parCompte = allocationByAccount().reduce((s, x) => s + x.value, 0);
    pres(parType, parCompte, 'les deux lectures partagent leur base');
    pres(parType, patrimoine().brut, 'et cette base est le brut');
  });


  test('les cinq paliers y sont, le toit et le bloqué compris', () => {
    /* Le piege de cette carte, et il aurait ete silencieux : l'autonomie
       financiere ecarte `habite` et `bloque` de son cumul, a dessein. Cette
       regle appartient a l'autonomie — elle compte ce sur quoi on peut vivre.
       Une repartition compte ce qu'on possede : reprendre l'exclusion ici
       donnerait une carte dont le total ne vaut pas la base annoncee, et
       l'ecart serait exactement le logement du detenteur. */
    Fixture.poser(e => {
      const etab = e.etabs[0];
      e.comptes.push({ id: 'c_toit', etabId: etab.id, type: 'immo', statut: 'ouvert',
        ouvertLe: '2020-01-01', numero: '', notes: '', libelle: 'Maison',
        court: 'Maison', alloc: '', cash: [],
        lignes: [{ id: 'l_toit', classe: 'immobilier', libelle: 'Maison',
                   valeur: 250000, usage: 'principale', prixDeRevient: 250000,
                   quantite: 1, dateAcquisition: '2020-01-01' }] });
      e.comptes.push({ id: 'c_per', etabId: etab.id, type: 'per', statut: 'ouvert',
        ouvertLe: '2021-01-01', numero: '', notes: '', libelle: 'PER',
        court: 'PER', alloc: '', cash: [],
        lignes: [{ id: 'l_per', classe: 'actions', libelle: 'Fonds PER',
                   valeur: 12000, prixDeRevient: 12000, quantite: 1,
                   dateAcquisition: '2021-01-01' }] });
    });

    const d = allocationParDisponibilite();
    const parCle = Object.fromEntries(d.map(x => [x.cle, x.value]));
    pres(parCle.habite, 250000, 'le logement habité a sa part');
    vrai(num(parCle.bloque) > 0, 'et le PER la sienne : il est fermé jusqu’à la retraite');
    pres(d.reduce((s, x) => s + x.value, 0), nowTotals().brut,
      'et le total vaut toujours les avoirs, les deux compris');

    /* Ce qui reste vrai a cote, et qu'on ne casse pas en passant : l'autonomie,
       elle, continue de les exclure. Les deux lectures coexistent parce que
       chacune nomme ce qu'elle compte. */
    const mob = poches().mobilisable;
    pres(mob.habite, 250000, 'la source porte bien le palier');
  });

  test('les deux cartes des délais disent les mêmes mots', () => {
    /* « Il faut que les termes collent entre les 2 cartes. » L'autonomie
       financiere de l'accueil et « Par disponibilite » decoupent le meme argent
       selon les memes paliers, et chacune avait sa liste de mots ecrite a la
       main : « En quelques jours » d'un cote, « Disponible rapidement » de
       l'autre, pour la meme poche. Deux ecrans qu'on ne regarde jamais en meme
       temps, donc le desaccord etait invisible.

       Le controle compare les libelles rendus, et non la source : c'est ce que
       lit quelqu'un, et c'est la seule chose qui doit s'accorder. */
    Fixture.poser();
    const dansLaCarte = new Map(
      allocationParDisponibilite().map(x => [x.cle, x.label]));
    for (const t of runway().tiers) {
      const cle = Object.keys(MOBILISABLE_LABEL)
        .find(k => trad(MOBILISABLE_LABEL[k]) === t.label);
      vrai(cle,
        `« ${t.label} » de l’autonomie ne vient pas de MOBILISABLE_LABEL : `
        + 'deux listes pour les mêmes paliers finissent par se contredire');
      if (dansLaCarte.has(cle))
        eq(t.label, dansLaCarte.get(cle),
          `le palier « ${cle} » doit porter le même mot sur les deux cartes`);
    }
  });

  test('les paliers gardent l’ordre du délai, pas celui des montants', () => {
    /* Les deux autres cartes classent par poids decroissant. Ici le rang porte
       du sens — du plus liquide au moins — et trier par montant melangerait un
       palier de trois jours avec un palier de trois mois selon les hasards du
       patrimoine. Un axe ordonne se lit dans son ordre. */
    Fixture.poser();
    const attendu = Object.keys(MOBILISABLE_LABEL);
    const obtenu = allocationParDisponibilite().map(x => x.cle);
    const rangs = obtenu.map(c => attendu.indexOf(c));
    vrai(rangs.every((r, i) => r >= 0 && (i === 0 || r > rangs[i - 1])),
      `l’ordre doit suivre celui de MOBILISABLE_LABEL, obtenu : ${obtenu.join(' < ')}`);
  });
});

/* ------------------------------------------------------------------
   Le texte affiché porte ses accents
   ------------------------------------------------------------------ */
suite('Le texte affiché porte ses accents', () => {

  /* Les commentaires de ce projet s'écrivent sans accents, volontairement : ils
     ont déjà porté des octets invisibles, et l'ASCII y coupe court. Le texte
     affiché, lui, est lu par quelqu'un — « sur la periode affichee » n'est pas
     une variante, c'est une faute, et neuf bulles d'aide en portaient.

     La règle ne peut pas être « aucun mot sans accent » : « revenus », « place »
     ou « cote » sont du français juste. Ce contrôle liste donc des mots qui, nus,
     sont toujours faux, et les cherche dans ce qui s'affiche. */
  const NUS = ['periode', 'affichee', 'affiches?', 'epargne', 'depense', 'depenses',
    'marche', 'marches', 'ecart', 'deja', 'apres', 'meme', 'memes', 'ete',
    'tresorerie', 'reequilibrage', 'strategie', 'strategique', 'premiere',
    'derniere', 'decision', 'resultat', 'interieur', 'ramenent', 'merite',
    'releve', 'releves', 'etablissement', 'etablissements', 'annee', 'annees',
    'calculee', 'constatee', 'prevision', 'detaille', 'tiree', 'immediat',
    'mensualite', 'propriete', 'realisee', 'necessaire', 'verifie', 'exonere'];
  /* Les bornes du mot s'écrivent en clair, sans `\w` : la classe de mot de
     JavaScript s'arrête à l'ASCII, si bien que « déjà » aurait vu son « ja »
     final compter comme un mot entier. */
  const LETTRE = '0-9A-Za-zÀ-ÿ_';
  const motifNu = new RegExp('(?:^|[^' + LETTRE + '])(' + NUS.join('|')
    + ')(?![' + LETTRE + '])', 'i');

  /* Les commentaires partent d'abord. Sans cela, le premier « aide( » cité dans
     un commentaire ouvrait une capture qui courait jusqu'au prochain guillemet
     suivi d'une parenthèse : elle avalait des lignes de prose sans accents, et
     le contrôle échouait sur du texte que personne n'affiche. */
  const sansCommentaires = src => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');

  /* Le texte de chaque appel `aide(…)` du fichier, guillemets simples, doubles
     ou gabarit. Les `${…}` sortent : ce sont des identifiants, pas de la prose.
     Les bulles passent par `aide(trad("…"))` depuis que l'application se
     traduit : l'enveloppe est admise, et le contrôle vaut alors pour la clef
     française, qui est ce que le lecteur français lit. */
  function textesAide(src) {
    const out = [];
    const re = /aide\(\s*(?:trad\(\s*)?(['"`])([\s\S]*?)\1/g;
    let m;
    while ((m = re.exec(sansCommentaires(src)))) out.push(m[2].replace(/\$\{[^}]*\}/g, ' '));
    return out;
  }

  test('aucune bulle d’aide n’a perdu ses accents', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const textes = textesAide(src);
    vrai(textes.length > 20, `au moins vingt bulles d’aide attendues, ${textes.length} trouvées`);
    for (const t of textes) {
      const faute = t.match(motifNu);
      vrai(!faute, faute
        ? `« ${faute[1]} » sans accent dans une bulle d’aide :\n  ${t.slice(0, 120)}…`
        : '');
    }
  });

  test('les familles de notifications aussi', () => {
    /* « Le releve du mois, les depenses du mois clos » s'affichait dans les
       réglages des notifications. Ces libellés vivent dans une constante du
       store, donc le contrôle les lit directement. */
    for (const [, nom, quoi] of FAMILLES_NOTIF) {
      for (const t of [nom, quoi]) {
        const faute = t.match(motifNu);
        vrai(!faute, faute ? `« ${faute[1] }» sans accent : « ${t} »` : '');
      }
    }
  });

  test('et le contrôle attrape bien une faute', () => {
    /* Sans ce cas, un motif cassé rendrait les deux tests du dessus verts pour
       toujours : ils ne prouveraient plus que la regex compile. */
    vrai(motifNu.test('sur la periode affichee'), 'la faute type doit être vue');
    vrai(motifNu.test('Le releve du mois'), 'même en tête de phrase');
    vrai(!motifNu.test('Part de tes revenus mise de côté, selon ton budget.'),
      'et le français juste doit passer');
    vrai(!motifNu.test('la place de référence du titre'), '« place » est un mot');
  });
});

/* ------------------------------------------------------------------
   Les balises de version ne mentent pas
   ------------------------------------------------------------------ */
suite('Les balises de version ne mentent pas', () => {

  /* La consigne du projet demande de changer la version des `?v=` dès qu'un
     fichier d'`assets/` change, dans `index.html` ET dans `tests.html`. Oublier
     le second est le pire des deux oublis : la page de tests resert alors
     l'ancien JavaScript et rend un vert mensonger — elle affirmerait que le
     correctif passe alors qu'elle ne l'a pas chargé.

     Ce contrôle est le seul du lot qui se vérifie lui-même : il tourne dans la
     page dont il parle. Aucun regard humain ne l'aurait attrapé, c'est
     précisément un oubli. */

  /* Sans expression rationnelle : les valeurs vivent entre `?v=` et le
     guillemet qui ferme l'attribut. */
  const versions = src => src.split('?v=').slice(1).map(b => b.split('"')[0]);

  test('effacer rend un tableau de bord complet, pas une coquille', () => {
    /* La graine est ecrite dans l'ancien modele, un compte par ligne de releve.
       C'est la migration qui en tire les etablissements, les comptes et leurs
       poches — posee telle quelle, elle rend `comptes` absent et tout ce qui en
       descend a zero. « Tout effacer » la posait crument : l'ecran affichait
       0 EUR sur huit cartes, et le premier enregistrement figeait ce vide pour
       les visites suivantes. Le meme piege est deja documente dans `load()`,
       corrige la et jamais ici. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf("async 'wipe'()");
    vrai(debut > 0, 'l’action doit exister');
    const bloc = src.slice(debut, src.indexOf("'snapshot-row'", debut));
    vrai(/Store\.migrate\(\)/.test(bloc) && /refreshAccounts\(\)/.test(bloc),
      'la graine passe par la migration, sinon l’écran affiche 0 € sur tout');

    /* Et la preuve par le calcul : la graine migree porte des comptes et un
       patrimoine, la graine crue n'en porte aucun. */
    Fixture.poser();
    vrai(comptesOuverts().length > 0 && patrimoine().brut > 0,
      'un état construit porte des comptes et un patrimoine');
  });

  test('le HTML se revalide, les assets versionnés se gardent', () => {
    /* Le numero dans l'URL ne suffit pas seul. Il rend chaque version des
       assets unique — une adresse jamais vue est une adresse retelechargee —
       mais le HTML, lui, se demande a l'adresse nue : c'est le seul maillon qui
       peut servir un vieux document, lequel reclamerait alors les vieux `?v=`
       et figerait toute la chaine. On a deploye et regarde une version d'avant
       plus d'une fois.

       Les deux regles vont ensemble et n'ont de sens qu'ensemble : le HTML se
       revalide toujours, les assets ne se revalident jamais. */
    const h = lireSource('_headers');
    vrai(h, '_headers doit être lisible pour ce contrôle');

    const bloc = cle => {
      const i = h.indexOf('\n' + cle + '\n');
      return i < 0 ? '' : h.slice(i, h.indexOf('\n/', i + 1) + 1 || undefined);
    };
    vrai(/max-age=31536000/.test(bloc('/assets/*')) && /immutable/.test(bloc('/assets/*')),
      'les assets portent leur version dans l’URL : ils peuvent être gardés un an');
    for (const page of ['/', '/index.html', '/tests.html']) {
      vrai(/no-cache/.test(bloc(page)),
        `${page} doit se revalider : c’est lui qui porte les numéros de version`);
    }
    /* Le service worker decide quand les autres fichiers sont remplaces : le
       mettre en cache confierait la mise a jour a la version qu'on remplace. */
    vrai(/no-cache/.test(bloc('/sw.js')),
      'le service worker ne se met pas en cache, il est ce qui met à jour');
  });

  test('l’application dit quelle version elle exécute', () => {
    /* Savoir si l'on regarde bien la version deployee ne doit pas couter une
       demi-heure, et sur un telephone il n'y a pas d'outils de developpement
       pour trancher.

       La version s'affiche donc dans la carte Etat de Donnees. Et elle se
       DERIVE de la balise du script : un numero ecrit une seconde fois a la
       main finirait par mentir, ce qui serait le comble pour un numero de
       version. C'est la regle du projet, appliquee a elle-meme. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    const decl = src.match(/const VERSION_APP = \(\(\) => \{[\s\S]{0,400}?\}\)\(\)/);
    vrai(decl, 'la version doit être calculée au démarrage');
    vrai(/document\.scripts/.test(decl[0]) && /searchParams\.get\('v'\)/.test(decl[0]),
      'et lue sur la balise du script : c’est la seule source, celle que la consigne '
      + 'de déploiement impose déjà de changer');
    vrai(!/VERSION_APP = ['"]/.test(src),
      'jamais un littéral : un second endroit à mettre à jour finirait par mentir');

    /* Et elle s'affiche. Une constante juste que personne ne montre ne repond a
       aucune des deux demi-heures perdues. */
    vrai(/<dt>\$\{trad\('Version'\)\}\$\{aide\(/.test(src) && /esc\(VERSION_APP\)/.test(src),
      'la carte « État » doit la montrer');

    /* Enfin, elle vaut quelque chose ici meme : ce test tourne dans une page qui
       porte les memes balises, donc l'evaluation est reelle et non simulee. */
    vrai(typeof VERSION_APP === 'undefined' || /^[0-9a-z.-]+$/i.test(VERSION_APP),
      'et si app.js est chargé, elle doit ressembler à une version');
  });

  /* Les cibles de `src="…"` et `href="…"`, sans les commentaires qui citeraient
     un chemin en prose. */
  function referencees(src) {
    const out = [];
    for (const marque of ['src="', 'href="']) {
      const bouts = src.split(marque).slice(1);
      for (const b of bouts) out.push(b.split('"')[0]);
    }
    return out;
  }

  test('les deux pages portent la même version, une seule', () => {
    const idx = lireSource('index.html');
    const tst = lireSource('tests.html');
    vrai(idx && tst, 'les deux pages doivent être lisibles');

    const vIdx = versions(idx), vTst = versions(tst);
    vrai(vIdx.length > 5, `index.html doit porter des balises de version (${vIdx.length})`);
    vrai(vTst.length > 3, `tests.html aussi (${vTst.length})`);
    eq(new Set(vIdx).size, 1, `index.html mélange des versions : ${[...new Set(vIdx)].join(', ')}`);
    eq(new Set(vTst).size, 1, `tests.html mélange des versions : ${[...new Set(vTst)].join(', ')}`);
    eq(vTst[0], vIdx[0],
      `tests.html sert la version ${vTst[0]} quand index.html sert ${vIdx[0]} : `
      + 'la page de tests ne teste pas ce que l’application exécute');
  });

  test('aucun fichier d’assets n’est servi sans version', () => {
    for (const page of ['index.html', 'tests.html']) {
      const src = lireSource(page);
      vrai(src, `${page} doit être lisible`);
      for (const cible of referencees(src)) {
        const nu = cible.split('?')[0];
        if (!nu.includes('assets/')) continue;
        if (!(nu.endsWith('.js') || nu.endsWith('.css'))) continue;
        vrai(cible.includes('?v='),
          `${page} sert ${nu} sans balise de version : un navigateur qui a déjà `
          + 'vu le site en resservira l’ancienne copie');
      }
    }
  });
});

finDePartieDeTests('tests/06-projection-capitalisation.tests.js');
