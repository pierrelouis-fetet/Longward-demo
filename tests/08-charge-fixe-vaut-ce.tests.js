partieDeTests('tests/08-charge-fixe-vaut-ce.tests.js');
/* UNE CHARGE FIXE VAUT CE QUI EST DEBITE. La convention d'avant retranchait ce
   qu'une autre personne reverse, alors que cette somme arrive deja par les
   revenus : elle etait comptee deux fois, en plus a l'entree et en moins a la
   sortie. */
suite('Une charge fixe vaut ce qui sort du compte', () => {

  const poser = (charges, revenus) => Fixture.poser(e => {
    e.budget.income = revenus;
    e.budget.fixedCharges = charges;
  });

  test('un loyer partagé compte pour son montant entier', () => {
    /* Un loyer partage : 1 600 EUR sortent du compte ; la personne qui partage
       en reverse 800 separement, et ce versement est saisi en entree. */
    poser([{ label: 'Loyer', amount: 1600, period: 'mois', shares: { p1: 800 } }],
          [{ label: 'Salaire', amount: 4200, period: 'mois' },
           { label: 'Contribution', amount: 800, period: 'mois' }]);
    pres(fixedTotal(), 1600, 'la charge vaut ce qui est débité');
    pres(incomeTotal(), 5000, 'et la contribution entre du côté des entrées');
    pres(budgetFrame().available, 5000 - 1600, 'le solde tient les deux mouvements');
    pres(budgetFrame().available - 4200, -800, 'soit un impact net de −800 €');
  });

  test('trois charges se somment sans aucune réduction', () => {
    poser([{ label: 'Loyer', amount: 1600, period: 'mois', shares: { p1: 800 } },
           { label: 'Assurance', amount: 60, period: 'mois', shares: { p1: 30 } },
           { label: 'Abonnement', amount: 30, period: 'mois' }],
          [{ label: 'Salaire', amount: 4200, period: 'mois' }]);
    pres(fixedTotal(), 1690, '1 600 + 60 + 30');
    pres(budgetFrame().fixed, 1690, 'et le cadre du budget lit le même total');
    pres(budgetFrame().fixed * 12, 1690 * 12, 'les douze mois suivent');
  });

  test('une contribution ajoutée aux entrées ne touche pas aux charges', () => {
    poser([{ label: 'Loyer', amount: 1600, period: 'mois' }],
          [{ label: 'Salaire', amount: 4200, period: 'mois' }]);
    const avant = round2(fixedTotal());
    Store.state.budget.income.push({ label: 'Contribution', amount: 500, period: 'mois' });
    pres(incomeTotal(), 4700, 'les entrées montent de 500 €');
    pres(fixedTotal(), avant, 'et les charges ne bougent pas d’un centime');
  });

  test('rien ne déduit deux fois une contribution', () => {
    /* La preuve par la comparaison : avec et sans parts declarees sur la charge,
       le budget doit rendre exactement le meme solde. */
    const solde = () => round2(budgetFrame().available);
    poser([{ label: 'Loyer', amount: 1600, period: 'mois' }],
          [{ label: 'Salaire', amount: 4200, period: 'mois' },
           { label: 'Contribution', amount: 800, period: 'mois' }]);
    const sans = solde();
    poser([{ label: 'Loyer', amount: 1600, period: 'mois', shares: { p1: 800 } }],
          [{ label: 'Salaire', amount: 4200, period: 'mois' },
           { label: 'Contribution', amount: 800, period: 'mois' }]);
    pres(solde(), sans, 'des parts déclarées ne changent plus rien au solde');
    pres(sans, 3400, 'et il vaut 5 000 − 1 600');
  });

  test('les périodes se ramènent au mois, sans partage à retirer', () => {
    poser([{ label: 'Assurance', amount: 1200, period: 'an', shares: { p1: 480 } },
           { label: 'Copropriété', amount: 600, period: 'trimestre' }],
          [{ label: 'Salaire', amount: 4200, period: 'mois' }]);
    pres(fixedTotal(), 100 + 200, '1 200 € l’an et 600 € par trimestre, au mois');
  });

  test('la mensualité d’un crédit vaut le prélèvement entier', () => {
    Fixture.poser(e => {
      const d = e.etabs.find(x => x.id === 'e_bien').dettes[0];
      d.montant = 120000; d.taux = 2; d.mensualite = null;
      e.budget.fixedCharges = [{ label: 'Prêt', amount: 2000, period: 'mois',
                                 shares: { p1: 800 }, creditId: 'd_pret' }];
    });
    pres(mensualiteCredit(etabById('e_bien').dettes[0]), 2000,
      'c’est ce qui est prélevé, pas ce qui reste après remboursement');
    pres(num(etabById('e_bien').dettes[0].montant), 120000, 'et la dette ne bouge pas');
  });

  test('un bien compte ses charges et sa mensualité entières', () => {
    Fixture.poser(e => {
      const c = e.comptes.find(x => x.id === 'c_immo');
      for (const l of c.lignes) l.usage = 'locative';
      const d = e.etabs.find(x => x.id === 'e_bien').dettes[0];
      d.montant = 120000; d.taux = 2; d.mensualite = null;
      e.budget.income = [{ label: 'Loyer', amount: 900, period: 'mois', bienId: 'c_immo' }];
      e.budget.fixedCharges = [
        { label: 'Prêt', amount: 2000, period: 'mois', shares: { p1: 800 },
          creditId: 'd_pret', bienId: 'c_immo' },
        { label: 'Copropriété', amount: 300, period: 'mois', shares: { p1: 90 },
          bienId: 'c_immo' }];
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.charges, 300, 'la charge vaut ce qui est débité');
    pres(cf.mensualite, 2000, 'la mensualité aussi');
    pres(coutBien(compteById('c_immo')).totalSorties, 2300, 'et le coût du bien les additionne');
    pres(cf.cashFlow, 900 - 300 - 2000, 'le cash-flow s’en déduit');
  });

  test('le partage a quitté les calculs et l’écran', () => {
    const store = lireSource('assets/store.js');
    const app = lireSource('assets/app.js');
    const code = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
    /* CE QUI RESTE INTERDIT, ce sont les REDUCTEURS : les fonctions qui
       retranchaient une part d'une charge du budget. La repartition theorique,
       elle, est revenue comme information — `shareOf`, `sharedOn`,
       `shareMensuelle`, `sharedTotals` — et aucune n'entre dans un total du
       budget. La suite juste en dessous le prouve par les nombres. */
    for (const mort of ['chargeMensuellePersonnelle', 'myShareMensuelle', 'myShare(',
                        'partageExcessif', 'fixedSharePK']) {
      vrai(!code(store).includes(mort), `« ${mort} » n’est plus dans store.js`);
      vrai(!code(app).includes(mort), `ni dans app.js`);
    }
    /* Les personnes se gerent a nouveau, mais par d'autres actes : ceux d'avant
       retranchaient une part du budget, et c'est cette convention-la qui est
       partie, pas la possibilite de declarer quelqu'un. Les nouveaux ne touchent
       a aucun total, et la suite juste en dessous le prouve par les nombres. */
    vrai(!/add-contributor|del-contributor/.test(code(app)),
      'les actes qui réduisaient le budget ne reviennent pas sous leur ancien nom');
    vrai(/reduce\(\(s, c\) => s \+ chargeMensuelle\(c\), 0\)/.test(store),
      'le total des charges somme les montants débités');

    /* ET AUCUN LECTEUR NE SURVIT AU PRODUCTEUR RETIRE.

       Le contrôle ci-dessus nommait les fonctions supprimées, et il passait :
       le pied de la liste des charges ne les appelait pas, il lisait le RÉSULTAT
       de l'une d'elles à travers une variable locale. Ce reste levait une
       exception à chaque rendu, la carte entière disparaissait, et son bouton
       « + Ligne » avec elle. Rien ne l'a signalé : le harnais ne rend aucune vue,
       il lit `app.js` comme du texte.

       Les champs sont ceux que la table de partage produisait, donc la liste est
       close par construction : la fonction n'existe plus, elle n’en produira
       jamais un de plus. */
    /* A ma charge est le seul champ qui ne peut pas revenir : il nommait ce que
       le budget comptait a la place du facture, et c'est cette convention qui
       est retiree. Les autres -- la part de chacun, le total partage -- sont
       des informations, et se lisent. */
    vrai(!code(app).includes('st.mine') && !/\bmine\b/.test(corpsDe(code(store), 'sharedTotals')),
      'le reste à charge ne peut pas revenir : le budget compte le facturé');
    /* Et le pied de la liste somme ce qu'elle affiche, comme celui du tableau. */
    const carte = code(app).slice(code(app).indexOf('data-anchor="charges"'),
                                  code(app).indexOf('id="chargesTable"'));
    vrai(carte.length > 200, 'la carte des charges doit se relire depuis sa source');
    vrai(/<dt>\$\{trad\('Total \/ mois'\)\}<\/dt><dd>\$\{fmtEUR\(brut\)\}<\/dd>/.test(carte),
      'le pied de la liste totalise les lignes affichées, par la même variable '
      + 'que le pied du tableau');
    vrai(/const brut = b\.fixedCharges\.reduce/.test(carte),
      'et cette variable est bien déclarée dans la carte');
  });

  test('les données de partage ne sont pas effacées', () => {
    /* Personne ne peut savoir ce qu'elles voulaient dire : une donnee qu'on ne
       sait pas relire ne se detruit pas. Plus rien ne la lit, voila tout. */
    Fixture.poser(e => {
      e.budget.contributors = [{ id: 'p1', name: 'Autre' }];
      e.budget.fixedCharges = [{ label: 'Loyer', amount: 1600, period: 'mois',
                                 shares: { p1: 800 } }];
    });
    const avant = JSON.stringify(Store.state.budget);
    fixedTotal(); budgetFrame(); healthChecks();
    eq(JSON.stringify(Store.state.budget), avant, 'lire ne réécrit rien');
    eq(Store.state.budget.fixedCharges[0].shares.p1, 800, 'la part reste dans le fichier');
    eq(Store.state.budget.contributors.length, 1, 'et la personne aussi');
    const store = lireSource('assets/store.js');
    vrai(/if \(!Array\.isArray\(s\.budget\.contributors\)\)/.test(store),
      'la migration d’origine n’est pas défaite');
  });
});

suite('Les postes proposés suivent l’usage du bien', () => {

  const proposes = (usage) => {
    Fixture.poser(s => {
      for (const l of s.comptes.find(c => c.id === 'c_immo').lignes) l.usage = usage;
    });
    return chargesProposees(compteById('c_immo')).map(([l]) => l);
  };

  test('un locatif propose les charges qui restent au propriétaire', () => {
    const l = proposes('locative');
    for (const poste of ['Charges de copropriété non récupérables', 'Taxe foncière',
                         'Assurance propriétaire non occupant', 'Frais de gestion locative',
                         'Garantie loyers impayés', 'Entretien et réparations',
                         'Provision pour travaux', 'Autres charges propriétaire']) {
      vrai(l.includes(poste), `« ${poste} » est proposé`);
    }
  });

  test('un locatif ne propose plus la copropriété générique', () => {
    /* Le loyer se saisit hors charges : ce qui entre dans le cash-flow est la
       part qui RESTE au proprietaire, et le libelle doit le dire. */
    vrai(!proposes('locative').includes('Charges de copropriété'),
      'le libellé générique n’est plus une suggestion sur un locatif');
  });

  test('une résidence principale ne se voit pas proposer des postes de bailleur', () => {
    const l = proposes('principale');
    for (const poste of ['Charges de copropriété', 'Taxe foncière', 'Assurance habitation',
                         'Entretien et réparations', 'Provision pour travaux',
                         'Autres charges du logement']) {
      vrai(l.includes(poste), `« ${poste} » est proposé`);
    }
    for (const absent of ['Frais de gestion locative', 'Garantie loyers impayés',
                          'Assurance propriétaire non occupant',
                          'Charges de copropriété non récupérables']) {
      vrai(!l.includes(absent), `« ${absent} » n’a rien à faire sur un logement qu’on habite`);
    }
  });

  test('une résidence secondaire a sa propre liste', () => {
    const l = proposes('secondaire');
    for (const poste of ['Charges de copropriété', 'Taxe foncière', 'Assurance habitation',
                         'Taxe d’habitation', 'Entretien et réparations',
                         'Provision pour travaux', 'Autres charges du bien']) {
      vrai(l.includes(poste), `« ${poste} » est proposé`);
    }
    for (const absent of ['Frais de gestion locative', 'Garantie loyers impayés']) {
      vrai(!l.includes(absent), `« ${absent} » n’est pas proposé par défaut`);
    }
  });

  test('la pierre papier garde ses frais, et seulement ses frais', () => {
    /* La frontiere du modele ne bouge pas : une SCPI n'a ni copropriete, ni
       taxe fonciere de proprietaire direct, ni PNO. */
    Fixture.poser(s => {
      s.comptes.find(c => c.id === 'c_immo').type = 'scpi';
    });
    const l = chargesProposees(compteById('c_immo')).map(([x]) => x);
    eq(l.join(' | '), 'Frais de gestion | Frais de plateforme | Frais de financement | Autres frais',
      'ses quatre frais, dans cet ordre');
    for (const absent of ['Charges de copropriété', 'Taxe foncière',
                          'Assurance propriétaire non occupant', 'Assurance habitation',
                          'Charges de copropriété non récupérables']) {
      vrai(!l.includes(absent), `« ${absent} » n’entre pas chez un placement`);
    }
  });

  test('les anciennes charges ne se renomment pas toutes seules', () => {
    /* On ne sait pas ce que le detenteur avait saisi derriere « Charges de
       copropriete » sur un locatif : la part recuperable ou la totalite.
       Renommer sa ligne lui preterait une intention. */
    Fixture.poser(s => {
      for (const l of s.comptes.find(c => c.id === 'c_immo').lignes) l.usage = 'locative';
      s.budget.fixedCharges = [{ label: 'Charges de copropriété', amount: 300,
                                 period: 'mois', shares: {}, bienId: 'c_immo' }];
    });
    chargesProposees(compteById('c_immo'));
    cashFlowBien(compteById('c_immo'));
    eq(Store.state.budget.fixedCharges[0].label, 'Charges de copropriété',
      'la ligne existante garde son libellé');
    const store = lireSource('assets/store.js');
    vrai(!/\.label = .*non récupérables/.test(store), 'et rien ne le réécrit');
  });
});

suite('Les crédits en cours se lisent tous ensemble', () => {

  /* Une dette vit sur l'établissement qui l'a consentie, et se lisait donc un
     établissement à la fois. La carte de l'accueil les rassemble : son total doit
     être celui que le patrimoine net retranche, sinon deux écrans annonceraient
     deux dettes. */

  const DEUX = e => {
    /* Le studio du fixture porte déjà 40 000 € de prêt. On ajoute une marge chez
       le courtier, sans capital initial : le champ est facultatif. */
    e.etabs.find(x => x.id === 'e_courtier').dettes = [
      { id: 'd_marge', libelle: 'Marge', montant: 2000, taux: 5.8, mensualite: null },
    ];
    /* Et le prêt du studio reçoit son capital emprunté : c'est lui qui permet de
       dire ce qui est déjà remboursé. */
    const pret = e.etabs.find(x => x.id === 'e_bien').dettes[0];
    pret.initial = 50000;
    pret.mensualite = 320;
  };

  test('le total de la carte est celui que le net retranche', () => {
    Fixture.poser(DEUX);
    const cr = creditsEnCours();
    pres(cr.reste, dettesTotal(), 'un seul total de dettes dans l’application');
    pres(cr.reste, Fixture.DETTE + 2000, 'le prêt du studio et la marge');
    pres(cr.lignes.reduce((s, c) => s + c.reste, 0), cr.reste,
      'et la somme des lignes fait ce total');
    pres(patrimoine().net, patrimoine().brut - cr.reste,
      'net = avoirs − crédits, le même nombre que la carte affiche');
  });

  test('chaque crédit dit son établissement, le plus gros d’abord', () => {
    Fixture.poser(DEUX);
    const cr = creditsEnCours();
    eq(cr.lignes.length, 2, 'les deux crédits, quel que soit leur établissement');
    eq(cr.lignes[0].libelle, 'Prêt immobilier', 'le plus gros vient en tête');
    eq(cr.lignes[0].etabNom, 'Studio', 'et il nomme son établissement');
    eq(cr.lignes[1].etabNom, 'Courtier');
  });

  test('sans capital emprunté, aucune part n’est inventée', () => {
    Fixture.poser(DEUX);
    const cr = creditsEnCours();
    const marge = cr.lignes.find(c => c.libelle === 'Marge');
    eq(marge.initial, null, 'le champ est facultatif');
    eq(marge.part, null, 'et « 0 % remboursé » serait un mensonge, pas une valeur par défaut');
    eq(marge.rembourse, null);
    const pret = cr.lignes.find(c => c.libelle === 'Prêt immobilier');
    pres(pret.rembourse, 10000, '50 000 emprunté, 40 000 restant dû');
    pres(pret.part, 20, 'soit 20 % remboursé');
    /* Le cumul ne porte que sur les crédits mesurables : la marge n'entre ni au
       numérateur ni au dénominateur. */
    pres(cr.initial, 50000, 'un seul capital initial connu');
  });

  test('le prélèvement mensuel ne s’ajoute pas au budget', () => {
    /* La carte affiche la somme des mensualités, en lecture. Le budget, lui, ne
       doit pas la compter : ces mensualités sont déjà des charges fixes, et les
       additionner ferait mentir le reste à vivre. */
    Fixture.poser(DEUX);
    const cr = creditsEnCours();
    pres(cr.mensuel, 320, 'seule la mensualité renseignée compte');
    const avant = budgetFrame().fixed;
    pres(avant, fixedTotal(), 'les charges fixes ne connaissent pas les crédits');
    vrai(cr.mensuel > 0 && budgetFrame().fixed === avant,
      'déclarer une mensualité de crédit ne change aucun total de budget');
  });

  test('sans crédit, il n’y a pas de carte', () => {
    Fixture.poser(e => { e.etabs.forEach(x => { x.dettes = []; }); });
    const cr = creditsEnCours();
    eq(cr.lignes.length, 0, 'rien à afficher');
    pres(cr.reste, 0);
    pres(patrimoine().net, patrimoine().brut, 'et le net vaut le brut');
  });
});

/* ------------------------------------------------------------------
   Modifier un crédit
   ------------------------------------------------------------------ */
suite('Modifier un crédit vise la bonne ligne', () => {

  /* La carte de l'accueil trie les crédits par montant, alors que l'écriture se
     fait par position dans les dettes de l'établissement. Confondre les deux
     index corrigeait un crédit en croyant en toucher un autre, sans rien qui se
     voie : les deux montants existent, les deux sont plausibles. */

  const TROIS = e => {
    e.etabs.find(x => x.id === 'e_courtier').dettes = [
      { id: 'd_petit', libelle: 'Petit crédit', montant: 500 },
      { id: 'd_gros', libelle: 'Gros crédit', montant: 90000 },
    ];
  };

  test('l’index pointe la dette dans son établissement, pas dans la liste triée', () => {
    Fixture.poser(TROIS);
    const cr = creditsEnCours();
    /* Trié par montant : le gros crédit du courtier passe devant le prêt du
       studio (40 000) et devant le petit. */
    eq(cr.lignes.map(c => c.libelle).join(' | '),
      'Gros crédit | Prêt immobilier | Petit crédit', 'l’ordre affiché');
    const gros = cr.lignes[0];
    eq(gros.index, 1, 'mais il est en seconde position chez son établissement');
    /* Ce que fait l'action d'édition, avec ces deux clés. */
    const e = etabById(gros.etabId);
    eq(e.dettes[gros.index].id, 'd_gros', 'etabId + index désignent bien cette dette');
    const petit = cr.lignes.find(c => c.libelle === 'Petit crédit');
    eq(etabById(petit.etabId).dettes[petit.index].id, 'd_petit');
  });

  test('corriger un capital restant dû fait monter le patrimoine net d’autant', () => {
    Fixture.poser(TROIS);
    const avant = patrimoine().net;
    const cr = creditsEnCours();
    const gros = cr.lignes[0];
    /* Le geste de l'action : écrire le montant à l'index de l'établissement. */
    etabById(gros.etabId).dettes[gros.index].montant = 85000;
    pres(patrimoine().net, avant + 5000,
      'cinq mille remboursés, cinq mille de patrimoine net en plus');
    pres(creditsEnCours().reste, dettesTotal(), 'et le total reste unique');
  });

  test('le prêteur ne se recopie pas dans l’intitulé', () => {
    /* L'ajout collait « · Crédit Agricole » dans le libellé tout en gardant le
       prêteur dans son champ : la même information à deux endroits, dont une que
       l'édition ne pouvait plus corriger. */
    Fixture.poser();
    const e = etabById('e_courtier');
    e.dettes = [{ id: 'd1', libelle: 'Prêt auto', montant: 8000, preteur: 'Crédit Agricole' }];
    const c = creditsEnCours().lignes.find(x => x.id === 'd1');
    eq(c.libelle, 'Prêt auto', 'l’intitulé reste l’intitulé');
    eq(c.preteur, 'Crédit Agricole', 'et le prêteur son propre champ');
    vrai(!c.libelle.includes(c.preteur), 'aucun des deux ne contient l’autre');
  });
});

/* ------------------------------------------------------------------
   Ce que rembourse une mensualité
   ------------------------------------------------------------------ */
suite('Une mensualité rembourse du capital et paie des intérêts', () => {

  /* La carte des crédits mène avec ce que le remboursement rapporte, et non avec
     l'encours : c'est la lecture honnête d'une dette qui se rembourse. Encore
     faut-il que le partage soit juste — dire « +620 € de patrimoine net » quand
     272 € partent en intérêts serait une flatterie, pas une information. */

  const PRET = e => {
    e.etabs.find(x => x.id === 'e_bien').dettes = [
      { id: 'd_pret', libelle: 'Prêt immobilier', montant: 96000, initial: 120000,
        mensualite: 620, taux: 3.4 },
    ];
  };

  test('les intérêts du mois se calculent sur le capital restant', () => {
    Fixture.poser(PRET);
    const c = creditsEnCours().lignes[0];
    /* 96 000 × 3,4 % ÷ 12 = 272 € d'intérêts, donc 348 € de capital. */
    pres(c.interets, 272, 'le taux annuel divisé par douze');
    pres(c.capital, 348, 'la mensualité moins les intérêts');
    pres(c.interets + c.capital, c.mensualite, 'et les deux font la mensualité');
  });

  test('rembourser fait baisser les intérêts du mois suivant', () => {
    Fixture.poser(PRET);
    const avant = creditsEnCours().lignes[0];
    etabById('e_bien').dettes[0].montant = 48000;
    const apres = creditsEnCours().lignes[0];
    pres(apres.interets, 136, 'la moitié du capital, la moitié des intérêts');
    vrai(apres.capital > avant.capital,
      'à mensualité égale, la part de capital monte quand la dette baisse');
    pres(apres.interets + apres.capital, 620, 'la mensualité ne bouge pas');
  });

  test('sans taux, on ne prétend pas connaître le partage', () => {
    Fixture.poser(e => {
      e.etabs.find(x => x.id === 'e_bien').dettes = [
        { id: 'd_pret', libelle: 'Prêt', montant: 96000, mensualite: 620 },
      ];
    });
    const c = creditsEnCours().lignes[0];
    eq(c.interets, null, 'aucun taux, aucun intérêt inventé');
    eq(c.capital, null, 'et aucune part de capital devinée');
    pres(c.mensualite, 620, 'la mensualité, elle, reste connue');
  });

  test('un crédit sans mensualité ne pèse rien de mensuel', () => {
    Fixture.poser(e => {
      e.etabs.find(x => x.id === 'e_courtier').dettes = [
        { id: 'd_marge', libelle: 'Marge', montant: 2000, taux: 5.8 },
      ];
    });
    const cr = creditsEnCours();
    const marge = cr.lignes.find(c => c.libelle === 'Marge');
    pres(marge.interets, 2000 * 5.8 / 100 / 12, 'les intérêts courent quand même');
    eq(marge.capital, null, 'mais rien ne rembourse de capital sans mensualité');
    pres(cr.mensuel, 0, 'et le total mensuel de la carte reste à zéro');
  });
});

/* ------------------------------------------------------------------
   Un capital restant dû qui vieillit
   ------------------------------------------------------------------ */
suite('Un capital restant dû se projette au lieu de s’oublier', () => {

  /* Le capital restant du d'un credit est le seul champ de l'application qui
     devient faux sans que personne y touche, et compter sur la memoire d'une
     correction invisible a l'ecran ne marche pas.

     L'application projette donc l'amortissement depuis la derniere verification,
     reclame la mise a jour au bout de trois mois, et propose le montant. Elle
     n'ecrit rien d'office : un remboursement anticipe la dementirait. */

  const CREDIT = (verifieLe) => e => {
    e.etabs.find(x => x.id === 'e_bien').dettes = [
      { id: 'd_pret', libelle: 'Prêt immobilier', montant: 96000, initial: 120000,
        mensualite: 620, taux: 3.4, verifieLe },
    ];
  };

  test('un mois écoulé retire une part de capital', () => {
    Fixture.poser(CREDIT('2026-07-04'));
    auJour('2026-08-04', () => {
      const c = creditsEnCours().lignes[0];
      eq(c.moisDepuis, 1, 'un mois entier');
      /* 96 000 − (620 − 272) = 95 652 */
      pres(c.projete, 95652, 'la mensualité moins les intérêts du mois');
      pres(c.ecart, 348, 'soit la part de capital');
    });
  });

  test('un mois non échu ne se compte pas', () => {
    Fixture.poser(CREDIT('2026-07-20'));
    auJour('2026-08-04', () => {
      const c = creditsEnCours().lignes[0];
      eq(c.moisDepuis, 0, 'le 4 août, le mois commencé le 20 juillet n’est pas écoulé');
      eq(c.projete, null, 'donc rien à projeter');
    });
  });

  test('la projection suit l’amortissement, pas une règle de trois', () => {
    Fixture.poser(CREDIT('2026-02-04'));
    auJour('2026-08-04', () => {
      const c = creditsEnCours().lignes[0];
      eq(c.moisDepuis, 6, 'six mois');
      /* Six mensualités linéaires feraient 96 000 − 6 × 348 = 93 912. La vraie
         projection rembourse un peu plus chaque mois, puisque les intérêts
         baissent avec le capital : elle doit donc descendre plus bas. */
      vrai(c.projete < 93912, 'la part de capital monte à mesure que la dette baisse');
      vrai(c.projete > 93000, 'sans pour autant s’effondrer');
    });
  });

  test('sans mensualité ni date, aucune projection inventée', () => {
    Fixture.poser(e => {
      e.etabs.find(x => x.id === 'e_bien').dettes = [
        { id: 'd1', libelle: 'Marge', montant: 2000, verifieLe: '2025-01-01' },
      ];
    });
    auJour('2026-08-04', () => {
      const c = creditsEnCours().lignes[0];
      eq(c.projete, null, 'rien ne rembourse, rien ne se projette');
      eq(c.ecart, null);
    });
  });

  test('la cloche réclame la mise à jour, avec le montant', () => {
    Fixture.poser(CREDIT('2026-02-04'));
    auJour('2026-08-04', () => {
      const n = healthChecks().find(x => /Prêt immobilier/.test(x.title) && /jour/.test(x.title));
      vrai(n, 'une alerte existe après six mois');
      eq(n.level, 'action', 'c’est une saisie en attente, pas une erreur');
      vrai(/il devrait rester/.test(n.detail), 'et elle porte le montant projeté');
    });
  });

  test('elle se tait les trois premiers mois', () => {
    Fixture.poser(CREDIT('2026-07-04'));
    auJour('2026-08-04', () => {
      /* Le rappel de mise à jour, et lui seul : ce crédit porte une mensualité
         sans charge fixe rattachée, ce qui déclenche une autre alerte — celle
         d'une mensualité hors du budget. Elle est légitime, et vérifiée à part. */
      vrai(!healthChecks().some(x => /Prêt immobilier/.test(x.title) && /jour/.test(x.title)),
        'un mois d’écart ne mérite pas un rappel de mise à jour');
    });
  });

  test('un crédit sans date est signalé une fois', () => {
    Fixture.poser(CREDIT(null));
    auJour('2026-08-04', () => {
      const n = healthChecks().find(x => /jamais vérifié/.test(x.title));
      vrai(n, 'les crédits d’avant ce suivi se rattrapent');
      eq(n.level, 'action');
    });
  });
});

/* ------------------------------------------------------------------
   La charge fixe qui rembourse un crédit
   ------------------------------------------------------------------ */
suite('Une charge fixe rembourse un crédit, et la mensualité ne se saisit qu’une fois', () => {

  /* Le credit se rembourse par la charge fixe quand c'est possible. Sans ce
     lien, la mensualite se saisirait deux fois -- en charge fixe, parce que le
     budget doit la connaitre, et sur le credit, pour projeter l'amortissement.
     Deux endroits pour un fait, rien qui garantisse qu'ils s'accordent.

     La charge detient le montant, le credit le lit. Ce que ces controles
     interdisent : que le budget bouge en rattachant, que deux charges se
     partagent un credit, et que le montant du credit l'emporte sur celui de la
     charge. */

  const LIE = e => {
    e.etabs.find(x => x.id === 'e_bien').dettes = [
      { id: 'd_pret', libelle: 'Prêt immobilier', montant: 96000, initial: 120000,
        taux: 3.4, mensualite: 400, verifieLe: '2026-02-04' },
    ];
    e.budget.fixedCharges = [
      { label: 'Prêt maison', amount: 620, period: 'mois', creditId: 'd_pret' },
      { label: 'Internet', amount: 31, period: 'mois' },
    ];
  };

  test('la mensualité vient de la charge, pas du crédit', () => {
    Fixture.poser(LIE);
    const c = creditsEnCours().lignes[0];
    pres(c.mensualite, 620, 'celle de la charge fixe, et non les 400 notés sur le crédit');
    eq(c.charge.label, 'Prêt maison', 'et la ligne dit par quoi elle est remboursée');
  });

  test('rattacher ne change aucun total de budget', () => {
    /* Le budget somme ses charges, il ignore les crédits. Rattacher est une
       lecture de plus, jamais un montant de plus. */
    const sansLien = Fixture.poser(e => {
      LIE(e);
      e.budget.fixedCharges.forEach(c => { delete c.creditId; });
    });
    const avant = fixedTotal();
    Fixture.poser(LIE);
    pres(fixedTotal(), avant, 'les charges fixes valent la même chose, liées ou non');
    pres(fixedTotal(), 651, '620 de prêt + 31 d’internet');
    pres(budgetFrame().fixed, 651, 'et le cadre du budget aussi');
    vrai(sansLien.budget.fixedCharges.every(c => !c.creditId), 'le témoin est bien sans lien');
  });

  test('une charge annuelle rattachée se ramène au mois', () => {
    Fixture.poser(e => {
      LIE(e);
      e.budget.fixedCharges[0] = { label: 'Prêt', amount: 7440, period: 'an', creditId: 'd_pret' };
    });
    pres(creditsEnCours().lignes[0].mensualite, 620, '7 440 € par an font 620 € par mois');
  });

  test('deux charges ne peuvent pas rembourser le même crédit', () => {
    /* La liste de rattachement écarte les crédits déjà pris : sans cela, la
       mensualité lue dépendrait de l'ordre des charges. */
    Fixture.poser(LIE);
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible');
    vrai(/function creditsRattachables/.test(src), 'la liste est dérivée, pas écrite à la main');
    vrai(/pris\.has\(c\.id\)/.test(src), 'et elle écarte les crédits déjà rattachés');
  });

  test('la projection et le rappel suivent la charge', () => {
    Fixture.poser(LIE);
    auJour('2026-08-04', () => {
      const c = creditsEnCours().lignes[0];
      eq(c.moisDepuis, 6, 'six mois depuis la vérification');
      /* Avec 620 € et non 400 : la projection descend plus vite. */
      vrai(c.projete < 94000, 'la mensualité de la charge fait le remboursement');
      const n = healthChecks().find(x => /Prêt immobilier/.test(x.title) && /jour/.test(x.title));
      vrai(n, 'et la cloche réclame la mise à jour au bout de trois mois');
    });
  });

  test('sans charge rattachée, le crédit garde sa propre mensualité', () => {
    Fixture.poser(e => {
      LIE(e);
      e.budget.fixedCharges.forEach(c => { delete c.creditId; });
    });
    const c = creditsEnCours().lignes[0];
    pres(c.mensualite, 400, 'celle notée sur le crédit');
    eq(c.charge, null, 'et rien ne le rembourse');
  });
});

/* ------------------------------------------------------------------
   La charge fixe créée depuis le crédit
   ------------------------------------------------------------------ */
suite('Un crédit avec mensualité pose sa charge fixe', () => {

  /* Un credit cree avec des mensualites apparait dans les charges fixes :
     l'argent sort tous les mois, et le budget ne doit pas l'ignorer. La fenetre
     du credit porte donc une case, cochee d'avance, uniquement s'il y a une
     mensualite. */

  const CREDIT = (mensualite) => ({
    id: 'd_pret', libelle: 'Prêt immobilier', montant: 96000, mensualite,
    taux: 3.4, preteur: 'Crédit Agricole', verifieLe: '2026-08-04',
  });

  test('la charge naît avec le bon montant, et sous le bon nom', () => {
    Fixture.poser(e => {
      e.budget.fixedCharges = [];
      e.etabs.find(x => x.id === 'e_bien').dettes = [CREDIT(620)];
    });
    const d = etabById('e_bien').dettes[0];
    vrai(creerChargeDuCredit(d), 'la charge est créée');
    const ch = Store.state.budget.fixedCharges[0];
    eq(ch.label, 'Prêt immobilier', 'le nom du crédit');
    pres(ch.amount, 620, 'et sa mensualité');
    eq(ch.period, 'mois', 'mensuelle par construction');
    eq(ch.provider, 'Crédit Agricole', 'le prêteur devient l’organisme');
    eq(ch.creditId, 'd_pret', 'et elle sait quel crédit elle rembourse');
    pres(fixedTotal(), 620, 'le budget la connaît désormais');
  });

  test('la mensualité quitte le crédit : un seul porteur', () => {
    Fixture.poser(e => {
      e.budget.fixedCharges = [];
      e.etabs.find(x => x.id === 'e_bien').dettes = [CREDIT(620)];
    });
    const d = etabById('e_bien').dettes[0];
    creerChargeDuCredit(d);
    eq(d.mensualite, null, 'le champ du crédit est vidé');
    pres(creditsEnCours().lignes[0].mensualite, 620,
      'et la mensualité lue vient maintenant de la charge');
    eq(creditsEnCours().lignes[0].charge.label, 'Prêt immobilier');
  });

  test('sans mensualité, aucune charge n’est créée', () => {
    Fixture.poser(e => {
      e.budget.fixedCharges = [];
      e.etabs.find(x => x.id === 'e_bien').dettes = [CREDIT(null)];
    });
    const d = etabById('e_bien').dettes[0];
    vrai(!creerChargeDuCredit(d), 'rien à créer');
    eq(Store.state.budget.fixedCharges.length, 0, 'et le budget reste vide');
  });

  test('deux fois de suite ne crée pas deux charges', () => {
    Fixture.poser(e => {
      e.budget.fixedCharges = [];
      e.etabs.find(x => x.id === 'e_bien').dettes = [CREDIT(620)];
    });
    const d = etabById('e_bien').dettes[0];
    creerChargeDuCredit(d);
    d.mensualite = 620;                       // comme si on la ressaisissait
    vrai(!creerChargeDuCredit(d), 'une charge rembourse déjà ce crédit');
    eq(Store.state.budget.fixedCharges.length, 1, 'une seule ligne');
    pres(fixedTotal(), 620, 'et le budget ne double pas');
  });

  test('une mensualité hors du budget se signale', () => {
    Fixture.poser(e => {
      e.budget.fixedCharges = [];
      e.etabs.find(x => x.id === 'e_bien').dettes = [CREDIT(620)];
    });
    const n = healthChecks().find(x => /hors du budget/.test(x.title));
    vrai(n, 'l’alerte rattrape les crédits déclarés avant cette case');
    eq(n.level, 'action');
    creerChargeDuCredit(etabById('e_bien').dettes[0]);
    vrai(!healthChecks().some(x => /hors du budget/.test(x.title)),
      'et elle se tait dès que la charge existe');
  });
});

/* ------------------------------------------------------------------
   Les rentrées exceptionnelles
   ------------------------------------------------------------------ */
suite('Une rentrée exceptionnelle se garde en mémoire', () => {

  /* Une rentree ponctuelle -- un heritage, une donation -- n'a aucun endroit
     juste sans ce journal : les sources de revenus sont mensuelles, Rentree
     exceptionnelle est une prevision sans date, et monter le solde d'un compte
     ne dit pas d'ou vient l'argent.

     Ce que le journal doit tenir : la memoire, et la distinction entre ce qu'on
     a mis de cote et ce qui est tombe du ciel. Un heritage n'est pas de
     l'epargne, et la moyenne mensuelle du patrimoine le compterait comme tel. */

  const RECU = e => {
    e.budget.apports = [
      { id: 'a1', libelle: 'Succession', montant: 10000, date: '2026-03-15', note: 'grand-mère' },
      { id: 'a2', libelle: 'Prime', montant: 1500, date: '2026-06-01', note: '' },
      { id: 'a3', libelle: 'Vente vélo', montant: 300, date: '2025-11-20', note: '' },
    ];
  };

  test('le journal se lit du plus récent au plus ancien', () => {
    Fixture.poser(RECU);
    const l = apportsTries();
    eq(l.map(a => a.libelle).join(' | '), 'Prime | Succession | Vente vélo', 'ordre affiché');
    /* L'index d'origine voyage avec la ligne : c'est lui qui sert à écrire, et le
       tri ne doit pas faire modifier la mauvaise rentrée. */
    eq(l[0].index, 1, 'la prime est en seconde position dans l’état');
    eq(Store.state.budget.apports[l[0].index].id, 'a2');
  });

  test('le total ne dépend pas de l’ordre, et se borne aux dates', () => {
    Fixture.poser(RECU);
    pres(apportsTotal(), 11800, '10 000 + 1 500 + 300');
    pres(apportsTotal('2026-01-01'), 11500, 'l’année 2026 seule');
    pres(apportsTotal('2026-01-01', '2026-05-31'), 10000, 'et le premier trimestre');
    pres(apportsTotal('2027-01-01'), 0, 'rien après');
  });

  test('un apport ne change aucun total de patrimoine', () => {
    /* Le journal dit l'origine de l'argent, il ne le crée pas : ces euros sont
       déjà sur les comptes. Additionner les deux les compterait deux fois. */
    const sans = Fixture.poser();
    const brutSans = patrimoine().brut;
    Fixture.poser(RECU);
    pres(patrimoine().brut, brutSans, 'le brut ne bouge pas');
    pres(patrimoine().net, brutSans - Fixture.DETTE, 'ni le net');
    pres(fixedTotal(), 0, 'et ce n’est pas une charge');
    vrai(!sans.budget.apports.length, 'le témoin est bien vide');
  });

  test('le rythme distingue l’épargne des apports', () => {
    Fixture.poser(e => {
      RECU(e);
      /* Deux relevés à deux mois d'écart, +12 000 € entre les deux, dont 10 000
         reçus en héritage : le rythme propre est de 1 000 € par mois, pas 6 000. */
      e.monthly = [
        { date: '2026-02-28', comment: '', v: { c_courant: 3000, c_livret: 2000, c_pea: 10500,
          c_cto: 750, c_immo: 120000, c_pe: 2000 } },
        { date: '2026-04-30', comment: '', v: { c_courant: 15000, c_livret: 2000, c_pea: 10500,
          c_cto: 750, c_immo: 120000, c_pe: 2000 } },
      ];
    });
    refreshAccounts();
    const st = statsRythme(monthlyPace().points);
    pres(st.apports, 10000, 'la succession tombe dans la fenêtre affichée');
    vrai(st.average > st.averageHorsApports,
      'la moyenne brute est plus flatteuse que le rythme propre');
    /* LE COMMENTAIRE DE CE FIXTURE DISAIT DEJA LE BON CHIFFRE — « le rythme
       propre est de 1 000 EUR par mois, pas 6 000 » — et l'assertion divisait
       par le nombre d'ECARTS, qui vaut un pour deux mois. Elle rendait donc
       2 000. La prose avait raison, le calcul non. */
    eq(st.count, 1, 'un seul écart mesuré');
    eq(st.mois, 2, 'mais il couvre deux mois');
    pres(st.average, 6000, 'douze mille sur deux mois');
    pres(st.averageHorsApports, 1000, 'et mille par mois une fois l’héritage retiré');
    pres(st.average - st.averageHorsApports, st.apports / st.mois,
      'l’écart vaut les apports répartis sur les mois, pas sur les écarts');
  });

  test('sans apport, la ligne n’existe pas', () => {
    Fixture.poser();
    const st = statsRythme(monthlyPace().points);
    pres(st.apports, 0, 'rien reçu');
    pres(st.averageHorsApports, st.average, 'les deux moyennes se confondent');
  });

  test('le champ est posé sur un état qui ne l’avait pas', () => {
    /* Migration : `budget.apports` arrive par la graine, comme les autres
       tableaux du budget. Un état d'avant ne doit pas planter à la lecture. */
    Fixture.poser(e => { delete e.budget.apports; });
    eq(Store.state.budget.apports, undefined, 'le fixture ne l’a pas');
    pres(apportsTotal(), 0, 'et le total vaut zéro sans exploser');
    vrai(Array.isArray(Store.state.budget.apports), 'APPORTS() l’a posé au passage');
  });
});

/* ------------------------------------------------------------------
   Un patrimoine net négatif
   ------------------------------------------------------------------ */
suite('Un patrimoine net négatif se dit, et ne se divise pas', () => {

  /* Un credit saisi sans le bien qu'il finance peut faire passer le net sous
     zero, et un pourcentage de variation calcule sur cette base n'a plus de
     sens -- des centaines de pour cent negatifs sur un montant juste.

     Deux regles en sortent. Un pourcentage de variation n'existe que sur une
     base positive et sans changement de signe -- diviser par une base negative
     retourne le resultat, et une base qui traverse zero rend le rapport
     arbitrairement grand. Et l'application nomme la cause la plus probable au
     lieu de laisser un chiffre effondre sans explication. */

  const GROS_CREDIT = e => {
    e.etabs.find(x => x.id === 'e_bien').dettes = [
      { id: 'd_maison', libelle: 'Crédit maison', montant: 400000, verifieLe: '2026-08-04' },
    ];
  };

  test('le net reste ce qu’il est, sans être maquillé', () => {
    Fixture.poser(GROS_CREDIT);
    pres(patrimoine().net, Fixture.BRUT - 400000, 'avoirs moins crédits, sans plancher à zéro');
    vrai(patrimoine().net < 0, 'et il est bien négatif');
    pres(patrimoine().brut, Fixture.BRUT, 'le brut ne bouge pas');
  });

  test('l’application nomme la cause probable', () => {
    /* Ce credit-ci est porte par l'etablissement qui tient le studio : il a donc
       un bien en face, et la cause probable n'est pas un oubli mais un achat
       finance a credit. Le detail de la distinction est teste dans « Un
       patrimoine net négatif a deux causes » ; ici on verifie seulement qu'une
       cause est nommee et qu'elle vise la bonne. */
    Fixture.poser(GROS_CREDIT);
    const n = healthChecks().find(x => /net négatif/.test(x.title));
    vrai(n, 'une alerte existe');
    vrai(/après un achat/.test(n.title), 'et elle nomme la cause');
    vrai(!/déclare ce bien/.test(n.detail),
      'sans demander de déclarer un bien qui l’est déjà');
  });

  test('un crédit sans bien en face garde le ton de l’erreur', () => {
    Fixture.poser(e => {
      GROS_CREDIT(e);
      /* Le meme montant, mais chez le courtier : plus rien en face. */
      e.etabs.find(x => x.id === 'e_bien').dettes = [];
      e.etabs.find(x => x.id === 'e_courtier').dettes = [
        { id: 'd_maison', libelle: 'Crédit maison', montant: 400000, verifieLe: '2026-08-04' },
      ];
    });
    const n = healthChecks().find(x => /net négatif/.test(x.title));
    vrai(n, 'une alerte existe');
    eq(n.level, 'error', 'c’est une incohérence, pas une simple information');
    vrai(/Crédit maison/.test(n.detail), 'elle nomme le crédit');
    vrai(/déclare ce bien/.test(n.detail), 'et dit quoi faire');
  });

  test('elle se tait quand le net est positif', () => {
    Fixture.poser();
    vrai(patrimoine().net > 0);
    vrai(!healthChecks().some(x => /net négatif/.test(x.title)), 'rien à signaler');
  });

  test('aucun pourcentage sur une base qui traverse zéro', () => {
    Fixture.poser(e => {
      GROS_CREDIT(e);
      /* Un relevé d'avant le crédit : la base est positive, le net d'aujourd'hui
         négatif. Le rapport n'aurait aucun sens. */
      e.monthly = [{ date: '2026-01-31', comment: '',
        v: { c_courant: 3000, c_livret: 2000, c_pea: 10500, c_cto: 750,
             c_immo: 120000, c_pe: 2000 } }];
    });
    refreshAccounts();
    const d = deltas();
    vrai(d.all, 'la variation existe');
    pres(d.all.eur, patrimoine().net - Fixture.BRUT, 'l’euro reste exact');
    eq(d.all.pct, null, 'mais le pourcentage se tait');
  });

  test('et aucun non plus sur une base négative', () => {
    Fixture.poser(e => {
      GROS_CREDIT(e);
      e.monthly = [{ date: '2026-01-31', comment: '', dettes: 400000,
        v: { c_courant: 100, c_livret: 0, c_pea: 0, c_cto: 0, c_immo: 0, c_pe: 0 } }];
    });
    refreshAccounts();
    eq(deltas().all.pct, null, 'diviser par une base négative retournerait le signe');
  });

  test('un pourcentage reste là où il a un sens', () => {
    Fixture.poser(e => {
      e.monthly = [{ date: '2026-01-31', comment: '',
        v: { c_courant: 1500, c_livret: 1000, c_pea: 5250, c_cto: 375,
             c_immo: 60000, c_pe: 1000 } }];
    });
    refreshAccounts();
    const d = deltas().all;
    vrai(d.pct != null, 'base positive, patrimoine positif : le rapport existe');
    vrai(d.pct > 0, 'et il monte');
  });
});

/* ------------------------------------------------------------------
   Sans titre coté, l'application se tait sur les cours
   ------------------------------------------------------------------ */
suite('Un patrimoine sans titre coté ne réclame pas de cours', () => {

  /* Qui ne detient presque que du non cote n'a que faire des cours : une
     cloche qui lui reclamerait une actualisation, et l'avertirait que ses prix
     sont vieux de trois cents jours, parlerait d'une fonction qu'il n'utilise
     pas. La cloche doit montrer ce qui est faux chez celui qui la regarde. */

  const QUE_DU_NON_COTE = e => {
    e.positions = [];
    e.quotes = {};
    /* Il reste le studio, le crowdfunding, le courant et le livret : un
       patrimoine complet, sans une seule ligne cotée. */
    e.comptes = e.comptes.filter(c => !['c_pea', 'c_cto'].includes(c.id));
  };

  test('aucune alerte de cours sans position', () => {
    Fixture.poser(QUE_DU_NON_COTE);
    const n = healthChecks();
    vrai(!n.some(x => /[Cc]ours/.test(x.title)),
      'ni « jamais actualisés », ni « vieux de tant de jours »');
    /* Et le patrimoine tient debout : ce n'est pas un état dégradé. */
    vrai(patrimoine().brut > 0, 'le patrimoine existe toujours');
    pres(patrimoine().brut, 5000 + 122000, 'liquidités + studio + crowdfunding');
  });

  test('l’alerte revient dès qu’une ligne cotée existe', () => {
    Fixture.poser(e => { QUE_DU_NON_COTE(e); e.quotes = {}; });
    Store.state.positions.push({ id: 'p1', name: 'ETF', symbol: 'IWDA', currency: 'EUR',
      qty: 1, buyPrice: 90, price: 90, fx: 1, account: 'c_courant',
      assetClass: 'actions', role: 'core' });
    vrai(healthChecks().some(x => /Cours jamais actualisés/.test(x.title)),
      'un titre coté sans cours mérite bien qu’on le signale');
  });

  test('le non coté compte dans tout le reste', () => {
    /* Ce qui doit rester vrai pour lui : sa répartition, son autonomie, son
       objectif. Le non coté n'est pas un citoyen de seconde classe. */
    Fixture.poser(QUE_DU_NON_COTE);
    const parts = repartitionClasses();
    pres(parts.reduce((s, x) => s + x.value, 0), patrimoine().brut,
      'la répartition de l’accueil couvre tout');
    const m = poches().mobilisable;
    pres(m.immediat + m.differe + m.lent + m.bloque, patrimoine().brut,
      'et les paliers d’autonomie aussi');
    pres(m.lent, 122000, 'le studio et le crowdfunding se vendent en quelques mois');
    pres(objectiveStatus().total, patrimoine().net, 'l’objectif porte sur le net');
  });
});

/* ------------------------------------------------------------------
   Ce qu'un bien locatif rapporte
   ------------------------------------------------------------------ */
suite('Un bien locatif dit son cash-flow et son rendement', () => {

  /* Un bien locatif se lit par ce qu'il rapporte. Savoir qu'un studio vaut tant
     et qu'il reste tant a rembourser ne dit pas ce qu'il rapporte : un
     proprietaire vit sur le loyer moins la mensualite moins les charges, pas
     sur la valeur de son bien.

     Les pieces existent, separees : le loyer en source de revenus, la taxe
     fonciere en charge fixe, la mensualite en credit. Le `bienId` les relie au
     logement, comme le `creditId` avant lui. */

  const LOCATIF = e => {
    /* Le studio du fixture : 120 000 € de valeur, 110 000 € payés, 40 000 € de
       prêt sur son établissement. On lui rattache un loyer et deux charges. */
    e.budget.income = [
      { label: 'Salaire', amount: 3000 },
      { label: 'Loyer studio', amount: 700, bienId: 'c_immo' },
    ];
    e.budget.fixedCharges = [
      { label: 'Internet', amount: 31, period: 'mois' },
      { label: 'Taxe foncière', amount: 960, period: 'an', bienId: 'c_immo' },
      { label: 'Copropriété', amount: 60, period: 'mois', bienId: 'c_immo' },
    ];
    e.etabs.find(x => x.id === 'e_bien').dettes = [
      { id: 'd_pret', libelle: 'Prêt', montant: 40000, mensualite: 520,
        taux: 3, verifieLe: '2026-08-04' },
    ];
  };

  test('le cash-flow rassemble loyer, charges et mensualité', () => {
    Fixture.poser(LOCATIF);
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.loyers, 700, 'le loyer rattaché, et lui seul');
    pres(cf.charges, 140, '80 € de taxe foncière par mois + 60 € de copropriété');
    pres(cf.mensualite, 520, 'la mensualité du prêt de son établissement');
    pres(cf.cashFlow, 40, '700 − 140 − 520');
  });

  test('rien ne se mélange entre les biens et le reste', () => {
    Fixture.poser(LOCATIF);
    const cf = cashFlowBien(compteById('c_immo'));
    /* Le salaire et l'internet ne sont pas rattachés : ils ne doivent pas entrer
       dans le cash-flow du studio. Et le budget, lui, les compte tous. */
    pres(incomeTotal(), 3700, 'le budget somme toutes les sources');
    pres(fixedTotal(), 171, 'et toutes les charges, rattachées ou non');
    vrai(cf.loyers < incomeTotal(), 'le bien ne prend que ce qui le vise');
    const autre = cashFlowBien(compteById('c_pe'));
    pres(autre.loyers, 0, 'le crowdfunding n’a pas de loyer');
    pres(autre.charges, 0);
  });

  test('le rendement se calcule sur le prix payé, et le dit', () => {
    Fixture.poser(LOCATIF);
    const cf = cashFlowBien(compteById('c_immo'));
    vrai(cf.surAchat, 'le prix d’acquisition est connu');
    pres(cf.base, 110000, 'c’est lui qui sert de base');
    pres(cf.rendementBrut, 700 * 12 / 110000 * 100, 'loyer annuel sur prix payé');
    pres(cf.rendementNet, (700 - 140) * 12 / 110000 * 100, 'net de charges');
    /* Un rendement sur la valeur du jour serait plus flatteur ou plus sévère
       selon le marché : ce n'est pas le même chiffre, et la carte annonce lequel. */
    vrai(cf.rendementBrut !== 700 * 12 / 120000 * 100, 'et pas sur la valeur actuelle');
  });

  test('sans prix d’acquisition, la base est la valeur, et c’est dit', () => {
    Fixture.poser(e => {
      LOCATIF(e);
      e.comptes.find(c => c.id === 'c_immo').lignes[0].prixDeRevient = 0;
    });
    const cf = cashFlowBien(compteById('c_immo'));
    vrai(!cf.surAchat, 'le drapeau dit que la base a changé');
    pres(cf.base, 120000, 'faute de mieux, la valeur actuelle');
  });

  test('le rendement sur apport tient compte du levier', () => {
    /* La base est l'apport declare, et non le prix paye moins le capital restant
       du : ce dernier grossissait a chaque mensualite, et le rendement baissait
       tout seul pendant que l'operation s'ameliorait. */
    Fixture.poser(e => {
      LOCATIF(e);
      e.comptes.find(c => c.id === 'c_immo').apport = 25000;
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.apport, 25000, 'ce qui est sorti de la poche à l’achat');
    pres(cf.cashOnCash, 40 * 12 / 25000 * 100,
      'le cash-flow annuel sur ce qui est vraiment engagé');
  });

  test('sans prêt, le cash-flow monte de la mensualité entière', () => {
    Fixture.poser(e => {
      LOCATIF(e);
      e.etabs.find(x => x.id === 'e_bien').dettes = [];
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.mensualite, 0, 'aucune mensualité');
    pres(cf.cashFlow, 560, 'le cash-flow monte d’autant');
    eq(cf.capitalMois, null, 'et plus aucun capital ne se rembourse');
  });

  test('la liste des biens se dérive des types de compte', () => {
    Fixture.poser(LOCATIF);
    const ids = comptesBiens().map(c => c.id);
    eq(ids.join(','), 'c_immo', 'le studio, et pas le crowdfunding ni le PEA');
    /* Un type immobilier ajouté demain entre tout seul : la liste lit
       TYPES_COMPTE, elle ne se réécrit pas. */
    for (const t of TYPES_COMPTE.filter(x => x.bienImmo)) {
      vrai(['immo', 'scpi'].includes(t.id), `${t.label} est bien un type de bien`);
    }
    /* Le drapeau dit « est un bien », jamais « peut en porter ». La nuance
       n'existait pas, et « peut porter de l'immobilier » lui tenait lieu : le
       jour ou une assurance-vie accepte une SCPI, le contrat entier devenait un
       bien immobilier — vocabulaire compris, « Dans quel bien le ranger ? »
       pour un contrat d'assurance. */
    const porteurs = TYPES_COMPTE.filter(x => x.classes.includes('immobilier'));
    vrai(porteurs.length > 2,
      'une enveloppe peut porter de l’immobilier sans être un bien');
    for (const t of porteurs.filter(x => !x.bienImmo)) {
      vrai(!comptesBiens().some(c => c.type === t.id),
        `${t.label} porte de l’immobilier mais n’est pas un bien`);
      eq(contenantDuType(t.id).titre === 'Bien immobilier', false,
        `${t.label} ne demande pas « dans quel bien le ranger »`);
    }
  });
});

/* ------------------------------------------------------------------
   Les échéances du non coté
   ------------------------------------------------------------------ */
suite('Une échéance de crowdfunding se suit et se signale', () => {

  /* Un pret participatif a une date de fin, un taux annonce et un etat : en
     cours, en retard, en defaut, rembourse. Le retard et le defaut sont la
     realite de ce metier : sans ces champs, l'application ne pourrait ni dire
     qu'un montant arrive a echeance tel mois, ni signaler une ligne qui a passe
     sa date sans rien verser.

     Le statut est declare, jamais deduit : un virement arrive souvent avec
     quelques jours de decalage, et peindre la ligne en rouge le lendemain de
     l'echeance crierait au loup a chaque fois. L'application signale, le
     detenteur tranche. */

  const PRETS = e => {
    e.comptes.find(c => c.id === 'c_pe').lignes = [
      { id: 'l1', classe: 'nonCote', libelle: 'Projet Bordeaux', valeur: 2000,
        prixDeRevient: 2000, taux: 9, echeance: '2026-11-30' },
      { id: 'l2', classe: 'nonCote', libelle: 'Projet Lille', valeur: 1500,
        prixDeRevient: 1500, taux: 10, echeance: '2026-05-31' },
      { id: 'l3', classe: 'nonCote', libelle: 'Projet Nantes', valeur: 800,
        prixDeRevient: 800, taux: 8, echeance: '2026-03-31', statut: 'retard' },
      { id: 'l4', classe: 'nonCote', libelle: 'Projet Rouen', valeur: 1200,
        prixDeRevient: 1200, echeance: '2025-12-31', statut: 'defaut' },
      { id: 'l5', classe: 'nonCote', libelle: 'Projet Reims', valeur: 0,
        prixDeRevient: 900, echeance: '2026-01-31', statut: 'rembourse' },
    ];
  };

  test('les échéances se lisent de la plus proche à la plus lointaine', () => {
    Fixture.poser(PRETS);
    auJour('2026-08-04', () => {
      const e = echeances();
      eq(e.map(x => x.libelle).join(' | '),
        'Projet Rouen | Projet Nantes | Projet Lille | Projet Bordeaux',
        'triées par date, et le remboursé est sorti');
      eq(e[0].index, 3, 'le rang dans le compte voyage avec la ligne');
    });
  });

  test('une date dépassée n’est pas un retard', () => {
    Fixture.poser(PRETS);
    auJour('2026-08-04', () => {
      const lille = echeances().find(x => x.libelle === 'Projet Lille');
      eq(lille.statut, 'encours', 'rien n’a été déclaré');
      vrai(lille.depassee, 'mais la date est derrière nous');
      eq(lille.jours, -65, 'soixante-cinq jours de retard sur le calendrier');
      const bordeaux = echeances().find(x => x.libelle === 'Projet Bordeaux');
      vrai(!bordeaux.depassee, 'celle de novembre est devant');
      vrai(bordeaux.jours > 0);
    });
  });

  test('la cloche distingue les trois situations', () => {
    Fixture.poser(PRETS);
    auJour('2026-08-04', () => {
      const n = healthChecks();
      const passee = n.find(x => /a passé son échéance/.test(x.title));
      vrai(passee, 'une date dépassée sans déclaration est une saisie en attente');
      eq(passee.level, 'action');
      const retard = n.find(x => /en retard/.test(x.title));
      eq(retard.level, 'warn', 'un retard déclaré mérite un œil');
      const defaut = n.find(x => /en défaut/.test(x.title));
      eq(defaut.level, 'error', 'un défaut est un chiffre faux que rien ne trahit');
      vrai(/baisse le montant/.test(defaut.detail), 'et il dit quoi faire');
    });
  });

  test('l’encours à problème se totalise', () => {
    Fixture.poser(PRETS);
    auJour('2026-08-04', () => {
      const p = encoursAProbleme();
      pres(p.retard, 800, 'Nantes');
      pres(p.defaut, 1200, 'Rouen');
      eq(p.depassees.length, 1, 'Lille, seule dépassée sans déclaration');
    });
  });

  test('ces lignes comptent toujours dans le patrimoine', () => {
    /* Un défaut garde sa valeur déclarée : l'application ne décide pas à la place
       du détenteur qu'un projet est perdu. Elle le lui dit, et c'est lui qui
       baisse le montant. */
    Fixture.poser(PRETS);
    const somme = 2000 + 1500 + 800 + 1200 + 0;
    pres(poches().classes.nonCote, somme, 'y compris le retard et le défaut');
    /* Les cinq lignes remplacent celle de 2 000 € du fixture : le non coté vaut
       donc 5 500 € et non 2 000, et le brut monte d'autant. */
    pres(patrimoine().brut, 5000 + 1500 + 9750 + 120000 + somme,
      'liquidités + cash du PEA + titres + studio + les cinq prêts');
  });

  test('un statut inconnu retombe sur « en cours »', () => {
    Fixture.poser(e => {
      PRETS(e);
      e.comptes.find(c => c.id === 'c_pe').lignes[0].statut = 'bizarre';
    });
    eq(statutLigne({ statut: 'bizarre' }), 'encours', 'aucun état inventé');
    eq(statutLigne({}), 'encours', 'ni pour une ligne sans statut');
  });
});

/* ------------------------------------------------------------------
   Un relevé porte sur un mois qui a eu lieu
   ------------------------------------------------------------------ */
suite('Un relevé porte sur un mois qui a eu lieu', () => {

  /* Le calendrier ouvre douze mois d'avance, et chaque ligne à venir portait le
     même bouton ⤒ que les autres. « Enregistrer décembre en août » écrivait la
     photo du jour dans un mois qui n'a pas eu lieu, et rien ne le rattrapait
     ensuite : la courbe reliait le point à ses voisins, l'écart mois par mois le
     comparait, l'alerte des trous le comptait comme rempli.

     Le jour se passe en argument : sans cela le contrôle ne pourrait vérifier
     qu'un seul côté de la frontière, celui où l'horloge se trouve. */

  test('le mois en cours est ouvert, le suivant non', () => {
    vrai(moisRevolu('2026-08-31', '2026-08-05'),
      'le mois en cours attend sa photo, c’est même sa raison d’exister');
    vrai(moisRevolu('2026-07-31', '2026-08-05'), 'et tous ceux d’avant');
    vrai(!moisRevolu('2026-09-30', '2026-08-05'), 'le mois suivant, non');
    vrai(!moisRevolu('2026-12-31', '2026-08-05'),
      'ni décembre depuis août : c’est le piège que tend un calendrier ouvert '
      + 'douze mois d’avance');
  });

  test('le dernier jour du mois ne fait pas basculer', () => {
    vrai(moisRevolu('2026-08-31', '2026-08-01'),
      'le 1er août, août est déjà ouvert : on compare des mois, pas des jours');
    vrai(!moisRevolu('2026-09-01', '2026-08-31'),
      'et le 31 août ne donne pas accès à septembre');
  });

  test('une année suivante ne passe pas pour un mois plus petit', () => {
    /* La comparaison est textuelle : '2027-01' contre '2026-12'. Un test sur les
       seuls numéros de mois aurait laissé passer janvier de l'année d'après. */
    vrai(!moisRevolu('2027-01-31', '2026-12-15'),
      'janvier 2027 vu de décembre 2026 est bien à venir');
    vrai(moisRevolu('2026-12-01', '2027-01-15'), 'et l’inverse est échu');
  });

  test('une ligne sans date ne se refuse pas', () => {
    vrai(moisRevolu('', '2026-08-05'),
      'une ligne sans date n’est pas un mois à venir : on ne la bloque pas');
    vrai(moisRevolu(null, '2026-08-05'), 'ni quand le champ manque');
  });
});

/* ------------------------------------------------------------------
   Une vente à découvert ne s'affiche pas gagnante
   ------------------------------------------------------------------ */
suite('Une vente à découvert ne s’affiche pas gagnante', () => {

  /* Un short porte une quantité négative, donc une valeur et un prix de revient
     négatifs : on a reçu l'argent en vendant, on le rendra en rachetant.
     Diviser la performance par ce revient negatif retournerait le signe :
     800 EUR de perte s'annonceraient « +80,00 % », en vert, a cote du
     « -800 EUR » en rouge de la meme ligne. Le pourcentage et l'euro disent
     donc la meme chose. */

  const short = (qte, revient, cours) => ({
    id: 'p_short', name: 'Titre vendu à découvert', isin: '', symbol: 'XXX',
    currency: 'EUR', qty: qte, buyPrice: revient, price: cours,
    fx: 1, fxBuy: 1, account: 'c_cto', assetClass: 'actions', role: 'satellite',
    manual: false,
  });

  test('le cours qui monte fait perdre, et le pourcentage le dit', () => {
    const p = short(-10, 100, 212);
    eq(round2(posInvested(p)), -1000, 'vendre 10 titres à 100 € encaisse 1 000 €');
    eq(round2(posValue(p)), -2120, 'les racheter à 212 € en coûte 2 120');
    eq(round2(posPerfEur(p)), -1120, 'donc 1 120 € de perte');
    vrai(posPerfPct(p) < 0,
      'et un pourcentage négatif : c’est le signe de l’euro qui commande');
    eq(round2(posPerfPct(p)), -112,
      'la base est ce qu’on a encaissé, en valeur absolue');
  });

  test('le cours qui baisse fait gagner', () => {
    const p = short(-10, 100, 60);
    eq(round2(posPerfEur(p)), 400, 'racheter à 60 € ce qu’on a vendu à 100 rapporte');
    eq(round2(posPerfPct(p)), 40, 'et le pourcentage suit, positif');
  });

  test('une position longue ne change pas de valeur', () => {
    /* La correction ne doit toucher que le short : pour un revient positif,
       `perf / revient` vaut exactement l'ancien `valeur / revient - 1`. */
    for (const [qte, revient, cours, attendu] of [
      [10, 100, 120, 20], [10, 100, 80, -20], [3, 604, 587.94, -2.66], [1, 50, 50, 0],
    ]) {
      const p = short(qte, revient, cours);
      eq(round2(posPerfPct(p)), attendu,
        `${qte} × ${revient} € valant ${cours} € fait ${attendu} %`);
    }
  });

  test('sans prix de revient, ni pourcentage ni euro inventés', () => {
    /* Le controle disait deja « il n'y a pas de base » et acceptait pourtant un
       zero, qui est un chiffre. Un zero se lit « pas de mouvement », pas « on ne
       sait pas », et l'ecran l'imprimait tel quel a cote d'un euro non nul. */
    const p = short(-10, 0, 212);
    eq(posPerfPct(p), null,
      'diviser par zéro ne donne pas un pourcentage, il n’y a pas de base');
    eq(posPerfEur(p), null,
      'et « valeur − 0 » n’est pas un gain : ce serait la ligne entière');
  });
});

/* ------------------------------------------------------------------
   Un compte dit chez qui il est
   ------------------------------------------------------------------ */
suite('Un compte dit chez qui il est', () => {

  /* Un compte porte exactement un établissement, donc ce fait existe toujours,
     et il s'affiche partout où le nom du compte s'affiche : la fenêtre d'un
     relevé, les colonnes du tableau. Un compte sans nom propre n'avait que le
     libellé de son type pour se nommer — « Livret » ne dit ni lequel ni chez
     qui, et une assurance-vie de 80 000 € est apparue sous ce mot-là. */

  test('la projection porte l’établissement de chaque compte', () => {
    Fixture.poser();
    eq(ACC['c_livret'].broker, 'Banque', 'le livret est tenu par la Banque');
    eq(ACC['c_pea'].broker, 'Courtier', 'le PEA par le Courtier');
    eq(ACC['c_immo'].broker, 'Studio', 'et un bien porte le nom du bien');
    for (const c of Store.state.comptes) {
      eq(typeof ACC[c.id].broker, 'string',
        `${c.id} doit porter un établissement, quitte à ce qu’il soit vide`);
    }
  });

  test('un compte sans nom prend le libellé de son type, et garde sa banque', () => {
    Fixture.poser(e => {
      e.comptes.push({ id: 'c_av', etabId: 'e_banque', type: 'av', statut: 'ouvert',
        ouvertLe: '', numero: '', notes: '', libelle: '', court: '', alloc: '',
        cash: [{ montant: 80000, affectation: 'precaution' }], lignes: [] });
    });
    eq(ACC['c_av'].label, 'Assurance-vie',
      'le type nomme le compte à défaut de nom propre');
    eq(ACC['c_av'].broker, 'Banque',
      'et l’établissement le distingue d’un autre contrat du même type');
  });

  test('l’établissement s’affiche même quand le nom le répète', () => {
    /* Le libelle n'est pas masque dans ce cas, meme au prix d'une repetition du
       nom de la plateforme : dans une liste de douze champs, un blanc ne dirait
       pas s'il signifie aucun etablissement ou deja ecrit dans le nom, et la
       regle cesserait d'etre lisible depuis l'ecran, le seul endroit ou elle
       compte. */
    Fixture.poser(e => {
      e.comptes.find(c => c.id === 'c_livret').libelle = 'Livret A Banque';
    });
    eq(ACC['c_livret'].label, 'Livret A Banque', 'le nom reste celui du compte');
    eq(ACC['c_livret'].broker, 'Banque',
      'et la banque reste nommée, même si le nom du compte la porte déjà');
  });
});

/* ------------------------------------------------------------------
   La vue des comptes suit sa source
   ------------------------------------------------------------------ */
suite('La vue des comptes suit sa source', () => {

  /* `ACCOUNTS` est une projection de `comptes` : le nom, le type, la poche.
     Huit endroits appelaient `refreshAccounts()` avant d'enregistrer, deux
     l'oubliaient — « Modifier le compte » et le menu de type. Une assurance-vie
     renommée s'affichait donc sous son ancien nom et son ancien type jusqu'au
     prochain rechargement de la page, et comptait dans l'ancienne poche. */

  test('renommer et retyper un compte change ce qui s’affiche', () => {
    Fixture.poser();
    eq(ACC['c_livret'].group, 'cash', 'un livret compte dans la poche cash');
    vrai(!ACC['c_livret'].holdings, 'et ne porte pas de titres');

    const c = Store.state.comptes.find(x => x.id === 'c_livret');
    c.libelle = 'MON CONTRAT';
    c.type = 'av';
    refreshAccounts();

    eq(ACC['c_livret'].label, 'MON CONTRAT', 'le nom suit');
    eq(ACC['c_livret'].type, 'av', 'le type aussi');
    eq(ACC['c_livret'].group, 'bourse', 'et la poche qui en découle');
    vrai(ACC['c_livret'].holdings, 'une assurance-vie peut porter des titres');
    eq(ACC['c_livret'].broker, 'Banque', 'la banque ne change pas pour autant');
  });

  test('Store.save() refait la projection', () => {
    /* Aucun test n’appelle `Store.save()` : elle écrit dans `localStorage`, que
       le harnais ne touche jamais. Le contrôle porte donc sur le source. C’est
       exactement l’assertion qui manquait : la règle ne vit pas dans un calcul
       qu’on peut interroger, elle vit dans l’ordre des appels. */
    const src = lireSource('assets/store.js');
    vrai(src, 'le source doit être lisible');
    const debut = src.indexOf('  save(opts = {}) {');
    vrai(debut > 0, 'save() doit être trouvable');
    /* La fenêtre s’arrête au membre suivant, pas à un nombre de caractères :
       une borne en longueur se serait cassée à la première ligne de
       commentaire ajoutée dans la méthode. */
    const fin = src.indexOf('canUndo()', debut);
    vrai(fin > debut, 'canUndo() doit suivre save()');
    const corps = src.slice(debut, fin);
    vrai(corps.includes('localStorage.setItem'),
      'la fenêtre doit bien contenir le corps de save(), sinon elle ne prouve rien');
    vrai(corps.includes('refreshAccounts()'),
      'sans cet appel, renommer un compte ou changer son type ne se voit qu’au '
      + 'prochain rechargement de la page');
  });
});

/* ------------------------------------------------------------------
   Les classes posées par le JavaScript existent dans la feuille
   ------------------------------------------------------------------ */
suite('Les classes posées par le JavaScript existent', () => {

  /* Trois fois la même erreur en une journée : un nom de classe inventé au
     moment d'écrire le balisage et jamais défini. « legende » pour « legend »,
     et la légende s'est affichée sans puces ni couleurs. « btn bloc » pour un
     bouton pleine largeur qui est resté à sa taille. Rien ne casse, rien ne
     s'affiche en rouge : l'élément est simplement rendu nu.

     On ne peut pas tout vérifier — beaucoup de classes se composent en
     gabarit, et certaines n'ont légitimement pas de style. Celles de ce lot
     sont épinglées, dans les deux sens : définie dans la feuille, et posée
     quelque part dans le JavaScript. Une règle morte est l'autre moitié du
     même défaut. */

  test('définies dans styles.css, et posées dans app.js', () => {
    const css = lireSource('assets/styles.css');
    const js = lireSource('assets/app.js');
    vrai(css && js, 'les deux sources doivent être lisibles');
    const paires = [
      ['.toast-action', 'toast-action'],
      ['.f-etab',       'f-etab'],
      ['.avert',        'class="avert"'],
      /* `.th-etab` et `.snap-avenir` sont parties avec le tableau de correction
         du journal patrimonial : la premiere posait l'etablissement sous
         l'intitule d'une colonne, la seconde eteignait le ⤒ d'un mois a venir.
         Retirees de la feuille en meme temps que leur balisage, elles ont quitte
         cette liste par le meme geste : c'est exactement ce que ce controle
         garde, dans les deux sens. */
      ['.f-etab',        'f-etab'],
      ['.champ-lecture', 'champ-lecture'],
      ['.lien-nu',       'lien-nu'],
      ['.btn.pleine',   'btn pleine'],
    ];
    for (const [enCss, enJs] of paires) {
      vrai(css.includes(enCss), `${enCss} doit être définie dans styles.css`);
      vrai(js.includes(enJs), `${enCss} doit être posée quelque part dans app.js`);
    }
  });

  test('aucun pan de la feuille n’est écrit deux fois', () => {
    /* Trois copies mortes trouvées le 5 août dans la même région de la feuille :
       un pan de 68 lignes, un autre de 31, et le bloc `.snap` que le fichier
       signalait déjà. Le commentaire d'une règle voisine le disait sans le
       chercher — « ces règles étaient dupliquées à l'identique un peu plus
       haut » — donc c'est arrivé au moins deux fois.

       Ça ne se voit pas à l'écran : les copies sont identiques, la dernière
       gagne, tout s'affiche juste. Ça se voit le jour où l'on retouche une des
       deux. Une règle corrigée dans la copie du haut n'a aucun effet, et on
       cherche ailleurs.

       Le seuil : la plus longue répétition légitime du fichier fait 4 lignes
       (deux blocs de mise en page qui partagent trois déclarations). Six laisse
       cette marge et attrape tout ce qui ressemble à un collage. */
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const lignes = css.split('\n').map(s => s.trimEnd());
    const vus = new Map();
    let pire = null;
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!l.trim()) continue;
      if (!vus.has(l)) { vus.set(l, i); continue; }
      const a = vus.get(l);
      let n = 0;
      while (i + n < lignes.length && lignes[a + n] === lignes[i + n]) n++;
      if (!pire || n > pire.n) pire = { n, a: a + 1, b: i + 1, texte: l.trim().slice(0, 70) };
    }
    vrai(!pire || pire.n < 6,
      pire && `${pire.n} lignes identiques aux lignes ${pire.a} et ${pire.b} : « ${pire.texte} ». `
      + 'Une des deux copies est morte, et c’est celle du haut, puisque la dernière gagne.');
  });
});

/* ------------------------------------------------------------------
   Une animation ne laisse pas sa trace, et elle joue là où on la touche
   ------------------------------------------------------------------ */
suite('Une plus-value se calcule dans une seule monnaie', () => {

  /* Un titre achete au cours du jour ne doit pas annoncer de perte. Si la valeur
     recoit le change (10 x 50,00 $ x 0,90 = 450,00 EUR) et que le prix de revient
     ne le recoit pas (10 x 50,00 = 500,00, des dollars comptes en euros),
     l'ecart entre les deux se lit comme une moins-value de 10 %.

     La cause possible : une creation de ligne qui poserait `fxBuy: 1` en dur,
     avant qu'on sache de quel titre il s'agit. La devise arriverait ensuite,
     `fx` serait mis a jour, et ce 1 resterait. Un total qui n'egale pas la somme
     de ses parts, une fois de plus, et invisible : les deux nombres sont justes,
     dans deux monnaies. */

  const ligne = (extra = {}) => ({
    id: 'pTest', name: 'Test', currency: 'USD', qty: 10,
    buyPrice: 50, price: 50.4, fx: 0.9, manual: false, ...extra,
  });

  test('un prix de revient en devise passe par le change', () => {
    const p = ligne({ fxBuy: 0.9 });
    pres(posInvested(p), 10 * 50 * 0.9, 'l’investi se convertit');
    pres(posValue(p), 10 * 50.4 * 0.9, 'la valeur aussi');
    /* Les deux dans la meme monnaie : l'ecart est celui des cours, 40 centimes de
       dollar par titre, et non la conversion de 500,00 $. */
    pres(posPerfEur(p), 10 * (50.4 - 50) * 0.9, 'et l’écart ne porte que les cours');
    vrai(Math.abs(posPerfPct(p)) < 1,
      `un achat au cours du jour ne perd pas 12 % : ${posPerfPct(p).toFixed(2)} %`);
  });

  test('le 1 d’une ligne en devise n’est pas un taux', () => {
    /* C'est l'assertion qui manquait. `fxBuy: 1` sur une ligne en dollars ne peut
       venir que de la valeur par défaut jamais remplacée : le retenir compte des
       dollars comme des euros. */
    const casse = ligne({ fxBuy: 1 });
    const sain = ligne({ fxBuy: 0.9 });
    pres(posInvested(casse), posInvested(sain),
      'un fxBuy de 1 sur une ligne en devise doit céder au taux courant');
    vrai(Math.abs(posPerfPct(casse)) < 1,
      `et la ligne ne doit plus annoncer de perte de change : ${posPerfPct(casse).toFixed(2)} %`);

    /* Sans aucun taux d'achat, même règle. */
    pres(posInvested(ligne({ fxBuy: null })), posInvested(sain),
      'un taux d’achat absent prend le taux courant');

    /* Une ligne en euros, elle, vaut 1 par sa devise et non par son champ. */
    const euro = ligne({ currency: 'EUR', fx: 1, fxBuy: null, buyPrice: 10, price: 11, qty: 100 });
    pres(posInvested(euro), 1000, 'une ligne en euros ne se convertit pas');
    pres(posPerfEur(euro), 100, 'et sa plus-value est celle des cours');
  });

  test('un taux d’achat enregistré est ignoré, et c’est voulu', () => {
    /* Une ligne construite en plusieurs fois n'a pas UN taux d'achat, et la
       plupart le sont : un achat en mai et un autre en juillet n'ont pas le meme
       change.

       Un `fxBuy` unique ne serait donc pas une approximation, mais un chiffre
       arbitraire presente comme une date. Pire, pose au PREMIER RAFRAICHISSEMENT
       des cours par `quotes.js`, il donnerait a deux titres achetes a des mois
       d'ecart le meme taux, celui du jour ou l'application les a vus pour la
       premiere fois : l'ecart de change mesurerait le temps depuis
       l'installation de l'app.

       Les deux jambes prennent donc le taux du jour, comme le fait le courtier.
       Ce qu'on perd est assume : l'application ne dit pas combien d'euros sont
       reellement sortis du compte. Elle ne le sait pas, elle le devinerait. */
    const avecTaux = ligne({ fxBuy: 0.92, fx: 0.9 });
    const sansTaux = ligne({ fx: 0.9 });
    pres(posInvested(avecTaux), posInvested(sansTaux),
      'un fxBuy enregistré ne doit plus changer le prix de revient');
    pres(posInvested(avecTaux), 10 * 50 * 0.9,
      'les deux jambes prennent le taux du jour');

    /* La consequence qui interesse le lecteur : le pourcentage devient celui du
       titre dans sa monnaie, donc celui que le courtier affiche. */
    pres(posPerfPct(avecTaux), (50.4 / 50 - 1) * 100,
      'la plus-value en pourcentage est celle du titre, comme chez le courtier');
  });

  test('la migration retire le taux d’achat des positions', () => {
    /* Le champ ne sert plus a convertir, et le garder inviterait a s'en resservir.
       Il reste sur les ventes enregistrees, ou il est un fait date de la
       transaction : le taux auquel cette vente-la s'est faite. */
    Fixture.poser();
    Store.state.positions[0].currency = 'USD';
    Store.state.positions[0].fxBuy = 0.92;
    Store.migrate();
    vrai(!('fxBuy' in Store.state.positions[0]),
      'une position ne porte plus de taux d’achat');
    const store = lireSource('assets/store.js');
    vrai(/fxBuy: tauxAchat\(p\)/.test(store),
      'mais une vente enregistrée garde le taux du jour où elle s’est faite');
  });

  test('la source dit la même règle que ces contrôles', () => {
    /* Trois endroits calculaient le prix de revient converti, avec trois copies de
       la même formule : la plus-value latente, l'aperçu d'une vente et la vente
       enregistrée. Deux d'entre elles gardaient le `|| 1`. Une seule fonction
       désormais, et ce contrôle refuse le retour des copies. */
    const src = lireSource('assets/store.js');
    vrai(src, 'le source doit être lisible');
    const copies = [...src.matchAll(/num\(p\.fxBuy\)\s*\|\|/g)];
    eq(copies.length, 0,
      'le taux d’achat se lit par tauxAchat() et nulle part à la main : '
      + `${copies.length} copie(s) de la formule subsiste(nt)`);
    vrai(/function tauxAchat/.test(src), 'tauxAchat() doit exister');

    /* Et la création d'une ligne ne fige plus 1. */
    const js = lireSource('assets/app.js') || '';
    vrai(!/fx:\s*1,\s*fxBuy:\s*1/.test(js),
      'la création d’une ligne ne doit plus poser fxBuy: 1 : la devise n’est pas '
      + 'encore choisie à ce moment-là');
  });
});

suite('Les animations s’éteignent, et se déclenchent au doigt', () => {

  /* Le bloc d'une règle CSS, accolades équilibrées. Une recherche de la première
     accolade fermante suffit pour une règle plate, pas pour un `@media` ni pour
     un `@keyframes`, dont le corps en contient d'autres. */
  function blocDe(css, depuis) {
    const ouvre = css.indexOf('{', depuis);
    if (ouvre < 0) return '';
    let n = 0;
    for (let i = ouvre; i < css.length; i++) {
      if (css[i] === '{') n++;
      else if (css[i] === '}' && --n === 0) return css.slice(ouvre + 1, i);
    }
    return css.slice(ouvre + 1);
  }

  test('un lavis qui finit transparent est éteint au repos', () => {
    /* Le défaut, signalé trois fois avant d'être compris. Le patrimoine de la
       barre latérale portait un aplat violet qui ne s'éteignait plus. On l'a pris
       pour une sélection de texte, puis pour un survol collé, et deux correctifs
       ont visé à côté. C'était le lavis de « valeur mise à jour » :
       `valeur-lavis` finit à `opacity: 0`, mais une animation sans `fill-mode`
       rend à l'élément la valeur de sa règle dès qu'elle s'achève — donc 1,
       l'opacité par défaut. Mesuré sur place : animation terminée, opacité du
       pseudo-élément à 1. La classe `valeur-maj` n'étant jamais retirée, l'aplat
       restait peint pour toujours.

       Le contrôle ne nomme pas `valeur-lavis` : il dérive la liste des animations
       concernées des `@keyframes` eux-mêmes — celles qui commencent et finissent
       transparentes, donc celles qui sont censées passer et non arriver. Le
       prochain lavis écrit de la même façon sera pris sans qu'on y pense. */
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const nu = css.replace(/\/\*[\s\S]*?\*\//g, '');

    const passagers = [];
    for (const m of nu.matchAll(/@keyframes\s+([\w-]+)/g)) {
      const corps = blocDe(nu, m.index + m[0].length);
      const etapes = [...corps.matchAll(/(from|to|[\d.]+%)\s*\{([^}]*)\}/g)];
      if (!etapes.length) continue;
      const eteint = e => /opacity:\s*0\b/.test(e[2]);
      const premier = etapes[0], dernier = etapes[etapes.length - 1];
      const finit = /^(to|100%)$/.test(dernier[1].trim()) && eteint(dernier);
      const part = /^(from|0%)$/.test(premier[1].trim()) && eteint(premier);
      if (finit && part) passagers.push(m[1]);
    }
    vrai(passagers.length,
      'le contrôle doit trouver au moins une animation passagère, sinon il ne '
      + 'vérifie rien : valeur-lavis en est une');

    for (const nom of passagers) {
      /* Toutes les règles qui appellent cette animation, `@media` comprises. */
      const appels = [...nu.matchAll(new RegExp('animation(-name)?:[^;}]*\\b' + nom + '\\b[^;}]*', 'g'))];
      vrai(appels.length, `${nom} est déclarée et jamais utilisée`);
      for (const appel of appels) {
        /* La règle qui contient l'appel : on remonte à l'accolade ouvrante qui
           la précède, et on lit jusqu'à la fermante. */
        const ouvre = nu.lastIndexOf('{', appel.index);
        const regle = nu.slice(ouvre + 1, nu.indexOf('}', appel.index));
        const tenue = /\b(forwards|both)\b/.test(appel[0]);
        vrai(tenue || /opacity:\s*0\b/.test(regle),
          `${nom} commence et finit transparente, donc elle passe : sa règle doit `
          + `porter « opacity: 0 » au repos, ou « forwards ». Sans l’un des deux, `
          + `la fin de l’animation rend l’opacité de la règle — 1 — et le lavis `
          + `reste peint pour toujours`);
      }
    }
  });

  
  test('le fond gelé couvre l’écran, d’où qu’on ouvre', () => {
    /* Deuxième moitié d'un défaut dont la première a déjà été corrigée. Geler la
       page met le corps en `position: fixed; top: -Ypx` — mais
       `html, body { height: 100% }` lui donne la hauteur de l'écran, pas celle de
       la page. Décalé, il ne couvre alors que de −Y à (écran − Y), et sous cette
       limite plus rien n'est peint : le voile de la fenêtre, noir à 55 % et flouté,
       se pose sur du vide. « En bas c'est tout noir, on voit pas en flou l'écran de
       derrière. » Mesuré depuis un défilement de 700 px : 700 px d'écran nus sur 812.

       Le premier correctif avait retiré un `overflow: hidden`, en le croyant seul
       coupable. Il l'était pour le cas `top: 0`, pas pour celui-ci. D'où ce
       contrôle, qui porte sur la hauteur et non sur l'overflow. */
    const js = lireSource('assets/app.js');
    vrai(js, 'assets/app.js doit être lisible pour ce contrôle');
    const debut = js.indexOf('function gelerFond');
    const gel = js.slice(debut, js.indexOf('function degelerFond'));
    vrai(/style\.height\s*=\s*`\$\{window\.innerHeight \+ fondGele\}px`/.test(gel),
      'le gel doit rendre au corps une hauteur qui additionne l’écran et le '
      + 'décalage, sinon la zone visible n’est pas couverte');
    vrai(!/overflow/.test(gel.replace(/\/\*[\s\S]*?\*\//g, '')),
      'et toujours pas d’overflow : c’est le positionnement qui gèle, pas le rognage');
    const degel = js.slice(js.indexOf('function degelerFond'), js.indexOf('function montrerModal'));
    vrai(/style\.height\s*=\s*''/.test(degel),
      'et le dégel doit la retirer, sinon la page reste bornée à un écran');
  });

  test('une ligne qui ouvre sa fenêtre ne porte pas de champ', () => {
    /* Deux tableaux du bureau ouvrent une fenetre au clic sur la ligne : les mois
       de depenses, puis les charges fixes. Les deux fonctionnent de la meme
       facon, et aucun n'edite ses cases en place.

       L'invariant est le meme dans les deux sens. Un champ dans une ligne
       cliquable ne se laisse pas remplir -- le clic part a la fenetre avant
       d'arriver au champ -- et il ouvrirait une deuxieme surface d'edition pour un
       sous-ensemble des champs, celle qui perd toujours puisqu'elle ne peut pas
       tout dire. Ici, ni le rattachement a un credit ni celui a un bien n'ont de
       colonne.

       Le controle se derive du balisage : toute ligne portant la classe est
       verifiee, y compris celle que quelqu'un ajoutera demain. */
    const js = lireSource('assets/app.js');
    vrai(js, 'assets/app.js doit être lisible pour ce contrôle');
    const lignes = [...js.matchAll(/class="ligne-ouvre/g)];
    vrai(lignes.length >= 2,
      'les deux tableaux du bureau doivent partager cette classe : les mois de '
      + 'dépenses et les charges fixes');
    for (const m of lignes) {
      const fin = js.indexOf('</tr>', m.index);
      vrai(fin > m.index, 'la ligne doit se fermer');
      const corps = js.slice(m.index, fin);
      vrai(!/data-path=/.test(corps),
        'une ligne qui ouvre une fenêtre ne peut pas contenir de champ lié : le clic '
        + 'ouvrirait la fenêtre au lieu de laisser saisir, et la même donnée aurait '
        + 'deux surfaces d’édition');
      vrai(/data-action="[a-z-]+"/.test(corps),
        'et elle doit dire quelle fenêtre elle ouvre');
    }
    /* La classe existe dans la feuille, sinon rien ne signale qu'on peut cliquer. */
    const css = lireSource('assets/styles.css') || '';
    vrai(/tr\.ligne-ouvre\s*\{[^}]*cursor:\s*pointer/.test(css),
      'la feuille doit donner le curseur du clic à ces lignes : une affordance qu’on '
      + 'ne voit pas n’existe pas');
  });

  test('un bandeau d’établissement ne se translate pas, il se gare plus haut', () => {
    /* « Énorme bug en défilant comptes vers le bas sur mobile, les titres de
       banque disparaissent. » Toutes les bandes étaient vides, sur toutes les
       cartes.

       La cause tenait à ce que deux choses de natures différentes partageaient
       une règle. Les sous-onglets sont une bande unique, en haut de l'écran,
       toujours collée : quand la barre du haut se retire, la translater est
       exactement ce qu'il faut. Les bandeaux d'établissement sont six, chacun
       dans sa carte, et la plupart sont encore dans le flux de leur groupe
       pendant que la barre se retire. Les translater tous de 54 px sortait chaque
       titre de sa carte.

       Et `.cpt-groupe` porte `overflow: clip` : le titre ne réapparaissait donc
       même pas au-dessus de la carte précédente, il était découpé. La bande
       restait, vide, parce que la place d'un élément collé reste dans le flux.
       C'est ce qui a rendu le défaut si spectaculaire — et si difficile à lire,
       puisqu'il ne restait rien à voir.

       Ce qui doit suivre la barre n'est pas le bandeau, c'est l'endroit où il se
       gare : `top`, jamais `transform`. Hors collage, `top` ne fait rien du tout,
       et c'est la garantie qui manquait. Mesuré : garé à 107 px, 53 px quand la
       barre est retirée, et dans sa carte dans les deux cas. */
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const nu = css.replace(/\/\*[\s\S]*?\*\//g, '');

    /* Aucune regle de retrait ne doit translater le bandeau. On cherche le
       selecteur dans les regles qui portent une translation, plutot qu'un
       exemplaire precis du texte : c'est la propriete qui est interdite ici, pas
       une ligne. */
    for (const m of nu.matchAll(/([^{}]*)\{([^}]*translate3d[^}]*)\}/g)) {
      vrai(!/\.cpt-gtitre/.test(m[1]),
        'le bandeau d’établissement ne doit apparaître dans aucune règle qui '
        + `translate : « ${m[1].trim().slice(0, 80)} ». Ses cartes sont en `
        + '« overflow: clip », le titre en sortirait découpé');
    }

    /* Et il doit bien suivre la barre, par sa position de collage. Sans cette
       moitie, on aurait un bandeau qui ne disparaît plus mais qui laisse 54 px de
       vide entre lui et les sous-onglets remontes. */
    vrai(/body\.haut-cache[^{]*\.cpt-gtitre\s*\{[^}]*top:/.test(nu),
      'le retrait de la barre doit remonter l’endroit où le bandeau se gare');
    vrai(/body\.haut-cache[^{]*\.cpt-gtitre\s*\{[^}]*var\(--h-barre-dessin\)/.test(nu),
      'et de la hauteur de dessin de la barre, pas d’un nombre écrit à la main : '
      + 'c’est ce qui laisse l’encoche par construction');
  });

  test('la barre du haut de l’ordinateur a une hauteur déclarée, et ce qui se colle dessous la lit', () => {
    /* LE BANDEAU D'ÉTABLISSEMENT SE GARAIT 19 PX SOUS LA BARRE DU HAUT. Sur
       ordinateur, `.topbar` mesurait 91 px — remplissage et texte, une hauteur
       subie que rien ne déclarait — et le bandeau collant portait `top: 72px`,
       un nombre écrit à la main. Mesuré sur Actifs à 1 440 px : bandeau collé
       sur [72, 134], barre sur [0, 91], son titre coupé en deux.

       La hauteur se déclare une fois, `--h-entete` ; la barre la tient par
       `min-height` ; le bandeau et le défilement vers une ancre la lisent. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const decl = css.indexOf('--h-entete:');
    vrai(decl > 0 && decl < css.indexOf('@media'),
      '--h-entete est déclarée, hors de toute requête média');
    const topbar = css.match(/\.topbar\s*\{([^}]*)\}/);
    vrai(topbar && /min-height:\s*var\(--h-entete\)/.test(topbar[1])
      && /box-sizing:\s*border-box/.test(topbar[1]), 'la barre tient la hauteur qu’elle déclare');
    const banderole = css.match(/\.cpt-gtitre\s*\{[^}]*top:\s*([^;]+);/);
    eq(banderole && banderole[1].trim(), 'var(--h-entete)',
      'le bandeau se gare sous la barre en la lisant, jamais par un nombre écrit à la main');
    /* Le défilement vers une ancre — `scrollIntoView`, `focusAnchor` — s'arrête
       sous les bandes de l'écran courant : `scroll-padding-top` sur `html`, une
       valeur par barre, et `app.js` la lit au lieu de porter 70 et 90. */
    vrai(/html\s*\{\s*scroll-padding-top:\s*calc\(var\(--h-entete\)/.test(css),
      'sur ordinateur, la marge d’ancre vaut la barre du haut');
    vrai(/html\s*\{\s*scroll-padding-top:\s*calc\(var\(--h-barre\)/.test(css),
      'sur téléphone, la barre du haut');
    vrai(/html:has\(\.sous-onglets\)\s*\{\s*scroll-padding-top:\s*calc\(var\(--h-barre\)\s*\+\s*var\(--h-sous-onglets\)/.test(css),
      'plus les sous-onglets quand la page en a');
    const app = lireSource('assets/app.js');
    const dfa = app.indexOf('function focusAnchor()');
    const fa = app.slice(dfa, app.indexOf('\nfunction ', dfa + 10));
    vrai(/scrollPaddingTop/.test(fa), 'focusAnchor lit la marge dans la feuille de style');
    vrai(!/\? 70 : 90/.test(fa), 'et ne porte plus ses deux nombres');
  });

  test('sous le doigt, 44 px : les halos tactiles du téléphone', () => {
    /* Trente-trois cibles mesuraient moins de 40 px à 375 px de large : boutons
       compacts à 30, icônes de la barre à 38, « ? » à 27 avec son halo, lien
       « Voir les positions » à 16, mesures du portefeuille à 18, liens du tiroir
       à 35. Le pouce ne lit pas le dessin. La zone tactile déborde du dessin par
       un pseudo-élément transparent : rien ne grossit à l'œil, et le halo reste
       vertical là où les boutons vont par paires. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const tel = css.slice(css.indexOf('@media (max-width: 900px)'));
    vrai(tel.length > 1000, 'le bloc du téléphone doit être trouvable');
    vrai(/\.btn, \.segmented button, \.lien-vue, \.lien-nu, \.mois-lien, \.ptf-compo-lien,\s*\n\s*\.data-view summary, \.retenir-bascule, \.retenir-plus, \.rp-famille, \.etat-cours,\s*\n\s*\.col-aide \{ position: relative; \}/.test(tel),
      'les cibles compactes portent leur halo');
    vrai(/\.btn, \.segmented button, \.rp-famille, \.etat-cours, \.retenir-plus \{ min-height: 36px; \}/.test(tel),
      'boutons, segments et puces : 36 px de dessin');
    const halo = tel.match(/\.btn::after, \.segmented button::after, \.data-view summary::after,\s*\n\s*\.retenir-bascule::after, \.retenir-plus::after, \.rp-famille::after, \.etat-cours::after \{([^}]*)\}/);
    vrai(halo && /left: 0; right: 0;\s*top: min\(0px, calc\(50% - 22px\)\); bottom: min\(0px, calc\(50% - 22px\)\)/.test(halo[1]),
      'un halo vertical jusqu’à 44 : 36 + 8, et deux boutons en colonne à 8 px d’écart se touchent sans se recouvrir');
    vrai(/\.btn\.icon::after, \.col-aide::after,\s*\n\s*\.lien-vue::after, \.lien-nu::after, \.mois-lien::after, \.ptf-compo-lien::after \{[^}]*inset: min\(0px, calc\(50% - 22px\)\);/.test(tel),
      'les petites commandes isolées : 44 dans les deux sens');
    vrai(/\.btn-rond::after \{[^}]*inset: -3px/.test(tel), 'la cloche, l’œil et le profil : 38 + 6 = 44');
    vrai(/\.aide::after \{ inset: -6px min\(0px, calc\(50% - 22px\)\); \}/.test(tel), 'le « ? » : 44 de large, 15 + 10 = 25 de haut');
    vrai(/\.pf-mesure \{ padding: 8px 0; \}/.test(tel), 'une mesure du portefeuille est une rangée : 34 px');
    vrai(/\.nav a \{ min-height: 40px; \}/.test(tel), 'un lien du tiroir : 40 px');
    /* Et le halo ne mord pas : les paires de boutons gardent leurs 8 px d'écart,
       que deux halos de 4 remplissent exactement. */
    vrai(/\.pas-actes \{[^}]*gap: 8px/.test(css) && /\.paire-btn \{[^}]*gap: 8px/.test(css),
      'les paires de boutons sont à 8 px : deux halos de 4 les remplissent exactement');
  });

  test('la sonde de santé rend la main au bout de 2,5 s', () => {
    /* `init()` attend `CloudSync.probe()` avant de lire le stockage local, et
       la sonde était un `fetch` sans limite : un réseau qui pend — portail
       captif, tunnel, serveur muet — laissait l'écran de lancement à l'infini,
       avec toutes les données locales sous la main. Au-delà de 2,5 s la sonde
       répond « pas de serveur », le chemin que la panne empruntait déjà :
       ouverture sur le local, pied du menu « Sauvegardé localement », écran
       « Session à revérifier » sur une instance à comptes. Aucune course : la
       synchronisation ne se rejoue pas après l'ouverture. */
    const q = lireSource('assets/quotes.js');
    vrai(q, 'assets/quotes.js doit être lisible pour ce contrôle');
    const d = q.indexOf('function healthData()');
    const sonde = q.slice(d, q.indexOf('\n  }\n', d) + 5);
    vrai(/const DELAI_SONDE_MS = 2500;/.test(q), 'le délai est nommé, et vaut 2,5 s');
    vrai(/new AbortController\(\)/.test(sonde) && /signal: garde\.signal/.test(sonde),
      'la requête porte un signal d’abandon');
    vrai(/setTimeout\(\(\) => garde\.abort\(\), DELAI_SONDE_MS\)/.test(sonde), 'armé sur le délai');
    vrai(/\.catch\(\(\) => null\)/.test(sonde), 'et l’abandon rend null, comme la panne');
    vrai(/garde\.signal\.aborted\) healthPromise = null/.test(sonde),
      'une réponse tardive ne se garde pas : le prochain appel resonde');
    /* L'ordre du démarrage ne bouge pas : l'identité précède la lecture. */
    const app = lireSource('assets/app.js');
    const di = app.indexOf('(async function init()');
    const boot = app.slice(di, di + 6000);
    vrai(boot.indexOf('await CloudSync.probe()') > 0
      && boot.indexOf('await CloudSync.probe()') < boot.indexOf('Store.load();'),
      'la sonde précède toujours la lecture locale : c’est elle qui dit qui regarde');
  });

  test('deux bandes collantes ne se posent pas à la même hauteur', () => {
    /* Le bandeau d'un établissement recouvrait la navigation de la page. Les deux
       sont collants sur téléphone, les deux portaient `top: calc(54px + …)` — la
       même valeur, écrite à deux endroits sans que rien ne les relie — et le
       bandeau gagnait par son z-index. Mesuré au défilement : sous-onglets sur la
       bande [54, 107], bandeau sur [54, 116].

       Le contrôle porte sur la cause et non sur le symptôme : la hauteur de la
       barre du haut était recopiée dans quatre règles indépendantes. Elle se
       déclare maintenant une fois, et ce test refuse qu'un `top` de bande
       collante reparte d'un nombre écrit à la main. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');

    for (const nom of ['--h-barre', '--h-sous-onglets']) {
      const decl = css.indexOf(nom + ':');
      vrai(decl > 0, `${nom} doit être déclarée`);
      vrai(decl < css.indexOf('@media'),
        `${nom} doit vivre hors de toute requête média : une variable posée sous un `
        + 'point de rupture ne vaut rien pour les règles écrites sous un autre');
    }
    /* Ce qui est interdit, c'est le nombre magique : la hauteur de la barre
       additionnée à l'encoche, écrite à la main. Le `padding-top` interne de la
       barre, lui, ajoute légitimement l'encoche à son propre retrait — il décale
       un contenu, il ne redit pas une hauteur. */
    /* La déclaration de `--h-barre` est le seul endroit qui a le droit de porter
       ce nombre : c'est elle qui le définit. On la retire avant de chercher. */
    const recopies = [...css.replace(/--h-barre:[^;]+;/g, '')
      .matchAll(/calc\(\s*(\d+)px\s*\+\s*env\(safe-area-inset-top/g)]
      .map(m => m[1]).filter(px => px !== '8');
    eq(recopies.join(', '), '',
      'la hauteur de la barre du haut ne se recopie plus : elle vient de --h-barre, '
      + 'sinon deux règles finissent par la dire différemment');

    /* Le bandeau se pose sous les sous-onglets, donc son décalage additionne les
       deux bandes. Le lire en toutes lettres est la seule façon de vérifier qu'il
       ne repart pas de la seule barre du haut, comme avant. */
    const banderole = css.match(/\.cpt-gtitre\s*\{[^}]*top:\s*([^;]+);/);
    const empile = css.match(/:has\(\.sous-onglets\)\s*\.cpt-gtitre\s*\{\s*top:\s*([^;]+);/);
    vrai(empile, 'une règle doit décaler le bandeau quand la page porte des sous-onglets');
    vrai(/var\(--h-barre\)/.test(empile[1]) && /var\(--h-sous-onglets\)/.test(empile[1]),
      'et ce décalage additionne les deux bandes : la barre du haut plus les '
      + 'sous-onglets, sinon le bandeau se recolle sur la navigation');
    vrai(banderole, 'le bandeau doit garder un collage par défaut, hors téléphone');

    /* `--h-colle` et non `--h-barre` : la barre du haut se retire au défilement,
       et les collants doivent remonter avec elle. Une valeur figée à sa hauteur
       laisserait une bande vide de 54 px au-dessus des sous-onglets dès qu'elle
       est partie. La variable a donc deux états, et un seul endroit les dit. */
    /* Retirée, la barre ne parcourt que son dessin, jamais sa hauteur totale :
       l'encoche reste. C'est structurel depuis que la course vaut
       `--h-barre-dessin` — un décalage exprimé sur `--h-barre` remonterait les
       sous-onglets sous l'heure et la caméra, ce qui est arrivé. */
    const course = css.match(/body\.haut-cache\s+\.sous-onglets[^{]*\{[^}]*transform:\s*([^;]+);/);
    vrai(course, 'les bandes collantes doivent dire de combien elles remontent');
    vrai(/var\(--h-barre-dessin\)/.test(course[1]) && !/var\(--h-barre\)/.test(course[1]),
      'la course vaut le dessin de la barre et non sa hauteur totale : sinon elles '
      + 'remontent derrière l’heure et la caméra de l’iPhone');
    vrai(/--h-barre:\s*calc\(\s*var\(--h-barre-dessin\)\s*\+\s*env\(safe-area-inset-top/.test(css),
      'et la hauteur totale se dérive du dessin plus l’encoche, en un seul endroit');

    /* La barre ne doit pas devenir le bloc conteneur de ses descendants fixes. Le
       tiroir des réglages est l'un d'eux : `will-change: transform` sur elle le
       recalait sur une boîte de 54 px en haut de l'écran, et il s'ouvrait hors
       champ. Le `transform` du retrait fait pareil, mais seulement le temps qu'il
       est appliqué — et `app.js` rend la barre avant d'ouvrir le tiroir. */
    /* La bonne règle `.sidebar` se reconnaît à sa hauteur, et non à son rang : il y
       en a trois dans la feuille — la base, celle du téléphone, et celle qui porte
       les transitions en fin de fichier. `lastIndexOf` tombait sur la dernière, qui
       n'a jamais eu de `will-change` : le contrôle passait pour la mauvaise raison. */
    const regles = [...css.matchAll(/\.sidebar\s*\{([^}]*)\}/g)].map(m => m[1]);
    const regleBarre = regles.find(r => /height:\s*var\(--h-barre\)/.test(r));
    vrai(regleBarre, 'la règle de la barre du haut sur téléphone doit être trouvable');
    vrai(!/will-change/.test(regleBarre),
      'pas de will-change sur la barre du haut : il crée un bloc conteneur pour ses '
      + 'descendants en position fixe, et le tiroir des réglages en est un');
    /* Le fond est celui de la page : ni celui du rail (#050506 contre #08090b, une
       bande en haut de l'écran), ni rien (les cartes traversaient le titre et les
       icônes sur toute une remontée, puisque la barre revient au premier geste vers
       le haut et y reste tant qu'on remonte). */
    vrai(/background:\s*var\(--page\)/.test(regleBarre),
      'la barre du haut porte la couleur de la page, opaque : ni le noir du rail, '
      + 'qui dessine une bande, ni transparent, qui laisse les cartes traverser le titre');
    vrai(!/background:\s*transparent/.test(regleBarre),
      'transparente, elle a été essayée : les lignes des cartes traversaient le titre '
      + 'et les deux icônes à chaque remontée');
    vrai(/border-bottom:\s*none/.test(regleBarre),
      'ni de filet sous elle, qui la redessinerait aussitôt');

    /* Même endroit de l'écran, même choix : les sous-onglets. Sans fond, la bande
       est collante et les cartes défilaient à travers, entre les pastilles et
       au-dessus d'elles ; avec un flou, elle dessinait une bande. La couleur de la
       page, opaque, est invisible en haut de page et masque ce qui passe dessous
       partout ailleurs. */
    const regleOnglets = css.match(/\.sous-onglets\s*\{([^}]*)\}/);
    vrai(regleOnglets, 'la règle des sous-onglets doit être trouvable');
    vrai(/background:\s*linear-gradient\(to bottom, var\(--page\) calc\(100% - 10px\), transparent\)/.test(regleOnglets[1]),
      'le conteneur des sous-onglets porte la couleur de la page, opaque sauf un fondu '
      + 'de dix pixels en bas : sans lui, les cartes défilent à travers la navigation ; '
      + 'sans le fondu, elles sont tranchées net sous les pastilles');
    vrai(!/background:\s*transparent/.test(regleOnglets[1]),
      'et pas transparent : c’est l’état qui laissait passer le contenu');
    /* Pas de filet : essaye, il flottait au repos entre les pastilles et la
       premiere carte. Le fondu ne se voit que quand une carte passe dessous. */
    vrai(!/border-bottom/.test(regleOnglets[1]), 'aucun trait sous la bande : au repos il flottait dans le vide');
    /* L'encoche : barre partie, la bande ne remonte que du dessin de la barre et
       la zone sous l'heure n'avait plus de fond. Le contenu y defilait a travers,
       en application installee. Un pseudo-element de la hauteur de l'encoche,
       plus large que l'ecran, la peint depuis la bande. */
    const encoche = css.match(/\.sous-onglets::before\s*\{([^}]*)\}/);
    vrai(encoche, 'la bande porte un pseudo-élément au-dessus d’elle');
    vrai(/bottom:\s*100%/.test(encoche[1]) && /height:\s*env\(safe-area-inset-top, 0px\)/.test(encoche[1]),
      'posé juste au-dessus, de la hauteur de l’encoche, et nul hors application installée');
    vrai(/background:\s*var\(--page\)/.test(encoche[1]), 'de la couleur de la page, comme la bande');
    vrai(/left:\s*-50vw/.test(encoche[1]) && /right:\s*-50vw/.test(encoche[1]),
      'et plus large que l’écran : les gouttières aussi laissaient passer');
    /* Barre en place, il cacherait le bandeau de la demonstration pose entre
       la barre et les sous-onglets : il ne se dessine que barre partie. */
    vrai(/content:\s*none/.test(encoche[1])
      && /body\.haut-cache \.sous-onglets::before\s*\{\s*content:\s*''\s*;?\s*\}/.test(css),
      'il ne se dessine que barre partie, sinon il cache ce qui se pose au-dessus des sous-onglets');
    vrai(!/backdrop-filter/.test(regleOnglets[1]),
      'ni de flou, qui dessine une bande aussi sûrement qu’une couleur — c’est '
      + 'l’étape intermédiaire qui n’a pas suffi. Seules les pastilles ont une surface');
    /* Et elles en ont bien une : c'est elle qui rend les libellés lisibles quand une
       carte passe sous la bande. */
    vrai(/\.sous-onglets \.segmented\s*\{[^}]*background:\s*var\(--surface-1\)/.test(css),
      'les pastilles gardent leur propre surface, sinon plus rien ne porte les libellés');
    const js2 = lireSource('assets/app.js') || '';
    const nav = js2.indexOf('const setNav = open =>');
    vrai(nav > 0, 'setNav doit être trouvable');
    vrai(/classList\.remove\('haut-cache'\)/.test(js2.slice(nav, nav + 700)),
      'et ouvrir le tiroir doit rendre la barre : sinon un retrait en cours '
      + 'décrocherait de l’écran le tiroir qu’elle contient');
    vrai(/body\.haut-cache\s+\.sidebar\s*\{[^}]*transform:\s*translate3d\(0,\s*-100%/.test(css),
      'et c’est un retrait par translate3d : animer la hauteur ou le `top` de la barre '
      + 'ferait sauter la page sous le doigt, et une translation plate peut rester sur '
      + 'le fil principal');
    /* Le remplissage du contenu ne suit pas le retrait : s'il suivait, la page se
       déplacerait de 54 px à chaque aller-retour et l'on perdrait sa ligne. */
    vrai(!/body\.haut-cache\s+\.main\s*\{[^}]*padding-top/.test(css),
      'le remplissage du contenu ne doit pas suivre le retrait, sinon la page bouge '
      + 'sous le doigt à chaque changement de sens');

    /* Et quand ils se croisent, c'est la navigation qui passe devant. */
    const zDe = sel => {
      const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*z-index:\\s*(\\d+)'));
      return m ? Number(m[1]) : null;
    };
    const zOnglets = zDe('.sous-onglets'), zBandeau = zDe('.cpt-gtitre');
    vrai(zOnglets !== null && zBandeau !== null, 'les deux bandes doivent déclarer leur plan');
    vrai(zOnglets > zBandeau,
      `la barre des sous-onglets (${zOnglets}) doit passer devant le bandeau `
      + `(${zBandeau}) : pendant qu'ils se croisent, c'est la navigation qu'on doit voir`);
  });

  test('barre en place, le bandeau posé au-dessus des sous-onglets reste visible', () => {
    /* La zone de l'encoche vaut zero hors application installee : une feuille
       injectee lui donne la hauteur d'un iPhone, et le doigt pose au centre du
       bandeau doit le toucher, pas la bande qui peint l'encoche. */
    const feuille = document.createElement('style');
    feuille.textContent = '.sous-onglets::before { height: 50px !important; }';
    const boite = document.createElement('div');
    boite.style.cssText = 'position:fixed; left:0; top:0; width:360px; z-index:99999; background:#000';
    boite.innerHTML = '<div class="bandeau-demo" style="margin:0; height:40px">x</div>'
      + '<div class="sous-onglets" style="position:relative">y</div>';
    document.head.appendChild(feuille);
    document.body.appendChild(boite);
    const sonde = () => {
      const r = boite.firstChild.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    };
    try {
      /* D'abord la preuve que la sonde voit un recouvrement : barre partie, la
         bande peint l'encoche par-dessus ce qui la precede. */
      document.body.classList.add('haut-cache');
      const partie = sonde();
      vrai(partie && partie.closest('.sous-onglets'), 'barre partie, la bande peint l’encoche au-dessus d’elle');
      document.body.classList.remove('haut-cache');
      const enPlace = sonde();
      vrai(enPlace && enPlace.closest('.bandeau-demo'), 'barre en place, le bandeau répond, rien ne le recouvre');
    } finally {
      document.body.classList.remove('haut-cache');
      boite.remove();
      feuille.remove();
    }
  });

  test('chaque vue retrouve sa position, et jamais celle de sa voisine', () => {
    /* Chaque vue retient sa propre position de defilement. `render()` qui lirait
       `window.scrollY` au debut et le restaurerait a la fin, sans distinguer un
       re-rendu d'une arrivee, appliquerait a l'ecran qu'on ouvre la position de
       celui qu'on quitte : descendu au bas d'Allocation, on arriverait au bas de
       Budget. Un re-rendu, lui, garde la position -- il y en a un a chaque
       frappe dans un champ.

       Aucun systeme ne fait ca : iOS garde une position par onglet, Android remet
       en haut. Appliquer celle du voisin n'est ni l'un ni l'autre.

       Le controle porte sur la source : la regle vit dans l'ordre des lectures et
       des ecritures, et le harnais ne rend pas de DOM. */
    const js = lireSource('assets/app.js');
    vrai(js, 'assets/app.js doit être lisible pour ce contrôle');

    vrai(/const positionsVues = new Map\(\)/.test(js),
      'les positions doivent se retenir par vue');
    vrai(/const arrivee = signatureVue !== derniereVueRendue/.test(js),
      'et une arrivée doit se distinguer d’un re-rendu : c’est la distinction qui '
      + 'manquait');
    vrai(/positionsVues\.set\(derniereVueRendue, scroll\)/.test(js),
      'en quittant une vue, sa position se retient');
    vrai(/scrollTo\(0, arrivee \? \(positionsVues\.get\(signatureVue\) \|\| 0\) : scroll\)/.test(js),
      'à l’arrivée on restaure la position de la vue ouverte, et un re-rendu ne '
      + 'bouge pas d’un pixel');

    /* Et l'action des sous-onglets ne remet plus à zéro avant de router : elle
       faisait retenir zéro pour l'onglet qu'on quitte, donc lui faisait perdre sa
       place au moment même où on la mémorise. */
    const so = js.indexOf(`'sous-onglet'(btn)`);
    vrai(so > 0, 'l’action des sous-onglets doit être trouvable');
    vrai(!/window\.scrollTo\(0, 0\)/.test(js.slice(so, so + 500)),
      'le changement de sous-onglet ne remet plus la position à zéro lui-même : la '
      + 'mémoire par vue s’en charge, et zéro écraserait la place de l’onglet quitté');
  });

  test('un sous-onglet ramène en haut, un onglet du bas garde sa place', () => {
    /* La question posée le 5 août : « c'est quoi le standard ? » Elle n'a pas la
       même réponse aux deux niveaux, et c'est pour ça qu'un seul mécanisme les
       traitait mal tous les deux.

       Les cinq onglets du bas sont des destinations : iOS garde une position par
       onglet, Material 3 demande de restaurer l'état d'une destination. Deux
       sous-onglets sont deux contenus de la même page, de longueurs différentes —
       un sélecteur segmenté, pas une destination. Rester à 1 500 px en passant de
       Dépenses à Relevés ne désigne rien du tout.

       La distinction tient à une comparaison, et il faut donc les deux mémoires :
       la signature complète pour retrouver sa place, la clé de vue seule pour
       savoir si l'on a seulement changé d'onglet. Le contrôle exige les deux — avec
       la seule signature, un changement de sous-onglet est indiscernable d'un
       changement de page. */
    const js = lireSource('assets/app.js');
    vrai(js, 'assets/app.js doit être lisible pour ce contrôle');

    vrai(/let derniereCleRendue/.test(js),
      'la vue rendue se retient sous-onglet exclu, à côté de la signature complète');
    vrai(/const changeOnglet = arrivee && derniereCleRendue === key/.test(js),
      'changer de sous-onglet, c’est arriver ailleurs sans changer de vue');
    vrai(/\(retourHautDemande \|\| changeOnglet\)[^\n]*scrollTo\(0, 0\)/.test(js),
      'et cette arrivée-là ramène en haut, comme le geste du logo');

    /* La borne de l'autre cote : la memoire de position ne doit pas disparaitre
       pour autant. C'est elle qui rend sa place a un onglet du bas. */
    vrai(/positionsVues\.get\(signatureVue\)/.test(js),
      'les cinq onglets du bas gardent leur place, c’est l’autre moitié de la règle');
  });

  test('le logo ramène en haut, et la mémoire de position ne le contredit pas', () => {
    /* La rancon de la memoire par vue : le logo n'est pas une navigation d'onglet,
       c'est le geste du retour au depart, et il ramene tout en haut de l'accueil.

       Deux issues a ce geste, et il faut les deux. Depuis un autre ecran il
       navigue, donc un rendu suit et c'est lui qui doit ignorer la position
       retenue. Depuis l'accueil lui-meme l'adresse ne change pas, donc rien ne se
       rend, et il faut remonter dans l'ecouteur. Une seule des deux laisserait la
       moitie du defaut en place -- et c'est la moitie deja sur l'accueil qui ne
       se verrait jamais en testant depuis une autre page. */
    const js = lireSource('assets/app.js');
    vrai(js, 'assets/app.js doit être lisible pour ce contrôle');

    const i = js.indexOf(`marque.addEventListener('click'`);
    vrai(i > 0, 'le logo doit porter un écouteur de clic');
    const ecouteur = js.slice(i, i + 700);
    vrai(/retourHautDemande = true/.test(ecouteur),
      'venant d’ailleurs, le logo demande le sommet au rendu qui suit');
    vrai(/scrollTo\(\{\s*top: 0/.test(ecouteur),
      'et déjà sur place, il remonte lui-même : aucun rendu ne viendra le faire');

    /* L'ordre tranche, comme partout ici : le drapeau doit etre examine avant la
       position retenue, sinon il ne sert a rien. On vise des reperes uniques et
       non un rang — c'est la leçon des deux tests qui passaient pour la mauvaise
       raison, l'un cherchant sa regle par `lastIndexOf` parmi trois homonymes. */
    const consomme = js.indexOf('retourHautDemande = false');
    const restaure = js.indexOf('positionsVues.get(');
    vrai(consomme > 0 && restaure > 0, 'les deux branches doivent exister');
    vrai(consomme < restaure,
      'le retour au sommet passe devant la position retenue, comme une ancre demandée');
    eq((js.match(/positionsVues\.get\(/g) || []).length, 1,
      'une seule lecture de la mémoire de position, sinon cet ordre ne prouve rien');
  });

  test('la barre du haut revient au geste, et jamais sur une sous-page', () => {
    /* Le retrait de la barre du haut n'est un standard qu'à trois conditions, et
       chacune répare un défaut qu'on obtient sans elle.

       Elle revient au premier geste vers le haut. Une barre qui ne reviendrait
       qu'en haut de page ferait payer la cloche et le profil d'un retour au
       sommet : ce ne serait plus le motif d'Instagram ou de Material 3, ce serait
       une perte.

       Elle ne joue pas sur du bruit. Un doigt posé tremble de deux ou trois
       pixels, et sans pas minimum la barre clignote.

       Elle ne bouge pas quand une fenêtre s'ouvre. `gelerFond()` met le corps en
       `position: fixed`, ce qui émet un événement de défilement à l'ouverture et un
       autre à la fermeture — la barre se retirait donc derrière la fenêtre, pour
       un geste que personne n'a fait.

       Et une sous-page garde la sienne : c'est là qu'un « retour » vit, et iOS
       fait la même exception. */
    const js = lireSource('assets/app.js');
    vrai(js, 'assets/app.js doit être lisible pour ce contrôle');
    const i = js.indexOf(`classList.toggle('haut-cache'`);
    vrai(i > 0, 'un écouteur doit poser la classe du retrait');
    const bloc = js.slice(Math.max(0, i - 900), i + 400);
    vrai(/addEventListener\('scroll'/.test(bloc),
      'et suivre le défilement pour ça');
    vrai(/delta > 0/.test(bloc) && /Math\.abs\(delta\) < PAS/.test(bloc),
      'le sens du geste doit commander, et un pas minimum filtrer le tremblement');
    vrai(/modalesOuvertes > 0/.test(bloc),
      'une fenêtre ouverte ne doit pas commander la barre : geler le fond émet un '
      + 'événement de défilement qui n’est pas un geste');
    vrai(/sous-page/.test(bloc),
      'et une sous-page ne cache jamais sa barre, qui porte le retour');

    /* Changer d'ecran rend la barre, sans condition : on arrive en haut d'une page
       neuve, meme sur un changement de menu. Conditionner ce retour a la
       position, pour qu'un changement de sous-onglet garde la barre retiree,
       laisserait une page neuve s'ouvrir sans sa barre.

       La recherche part de `i` et non en arriere : le routeur ecoute lui aussi
       `hashchange`, plus haut dans le fichier, et remonter tomberait sur le sien. */
    const surHash = js.slice(js.indexOf(`addEventListener('hashchange'`, i), i + 1400);
    vrai(/classList\.remove\('haut-cache'\)/.test(surHash),
      'au changement d’écran, la barre revient : une barre restée cachée depuis '
      + 'l’écran précédent se lirait comme une bande manquante');
    vrai(/passive: true/.test(bloc),
      'l’écouteur doit être passif : un écouteur de défilement bloquant fait tressauter '
      + 'le geste sur téléphone');

    /* Le mouvement est asymétrique, comme celui des barres natives : la barre
       s'échappe vite et revient en se posant. Une seule courbe pour les deux sens
       donne le va-et-vient mécanique d'un tiroir — « sinon c'est moche ».

       Et ce qui colle sous elle suit aux mêmes durées : deux vitesses feraient
       décrocher les sous-onglets de la barre qu'ils accompagnent. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    /* Le retour se déclare avec les couleurs, en fin de feuille : la règle de
       bascule de thème y nomme `.sidebar` et écraserait une transition posée plus
       haut, `transform` compris — c'est ce qui rendait le retrait instantané. La
       durée se cherche donc dans une liste de propriétés, pas seule. */
    const retour = css.match(/\.sidebar\s*\{[^}]*transform\s+([\d.]+)s\s+cubic-bezier\(([^)]+)\)/);
    const depart = css.match(/body\.haut-cache\s+\.sidebar\s*\{[^}]*transition-duration:\s*([\d.]+)s[^}]*transition-timing-function:\s*cubic-bezier\(([^)]+)\)/);
    vrai(retour && depart, 'les deux sens doivent régler leur propre mouvement');
    /* Et le mouvement passe par une translation composee, pas par une propriété de
       mise en page : `translate3d` force le compositeur, y compris sur iOS. */
    vrai(/translate3d/.test(css.match(/body\.haut-cache\s+\.sidebar\s*\{[^}]*/)[0]),
      'le retrait doit passer par translate3d : une translation simple peut rester '
      + 'sur le fil principal, et le mouvement accroche');
    vrai(Number(depart[1]) < Number(retour[1]),
      `le départ doit être plus court que le retour (${depart[1]}s contre ${retour[1]}s) : `
      + 'ce qui s’en va peut aller vite, ce qui revient doit se poser');
    vrai(retour[2].replace(/\s/g, '') !== depart[2].replace(/\s/g, ''),
      'et les courbes doivent différer, sinon le mouvement est le même dans les deux '
      + 'sens et se lit comme un tiroir');
    /* Les sous-onglets seuls, et plus le bandeau d'etablissement : celui-ci a
       quitte la translation le 5 aout au soir, parce qu'elle sortait chaque titre
       de sa carte, qui le decoupait. Il suit desormais la barre par sa position de
       collage, qui n'a rien a animer. Voir « un bandeau d'etablissement ne se
       translate pas ». */
    for (const [regle, attendu] of [
      [/\.sous-onglets\s*\{[^}]*transition:\s*transform\s+([\d.]+)s/, retour[1]],
      [/body\.haut-cache\s+\.sous-onglets[^{]*\{[^}]*transition-duration:\s*([\d.]+)s/, depart[1]],
    ]) {
      const m = css.match(regle);
      vrai(m, 'les collants doivent régler leur mouvement dans les deux sens');
      eq(m[1], attendu,
        'et à la même durée que la barre : deux vitesses les font décrocher d’elle');
    }
  });

  test('le retour de la barre ne se joue pas dans son premier quart', () => {
    /* Le bandeau entre en glissant, pas d'un coup. Une duree de 300 ms ne suffit
       pas a le garantir : c'est la courbe qui decide.

       `cubic-bezier(.17, .84, .44, 1)` a une pente de 4,9 a l'origine : sur 54 px
       de course elle en fait 43 en 100 ms. La barre est arrivee, et les deux
       tiers du temps restant ne servent qu'a parcourir cinq pixels. On ne voit
       pas un glissement, on voit une apparition suivie d'une attente.

       Le controle ne fige pas des valeurs, il tient la propriete : au quart du
       temps, la barre ne doit pas avoir fait plus des deux tiers du chemin. Ca
       laisse la place au reglage -- c'est un gout, et il se retouchera -- mais ca
       interdit le retour d'une courbe qui finit avant qu'on l'ait vue.

       La borne de duree sert l'autre moitie : une courbe douce sur 150 ms serait
       douce et invisible. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = css.match(/\.sidebar\s*\{[^}]*transform\s+([\d.]+)s\s+cubic-bezier\(([^)]+)\)/);
    vrai(m, 'le retour de la barre doit déclarer sa durée et sa courbe');

    const duree = Number(m[1]);
    vrai(duree >= 0.35,
      `le retour dure ${duree}s : sous 0,35 s, aucune courbe ne le rend visible`);

    const [x1, y1, x2, y2] = m[2].split(',').map(v => Number(v.trim()));
    /* La courbe de Bézier de CSS : x est le temps, y l'avancement. On cherche le
       t qui donne x = 0,25, puis on lit son y. Dichotomie, la fonction etant
       strictement croissante sur [0, 1]. */
    const cx = t => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const cy = t => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    let lo = 0, hi = 1, t = 0;
    for (let i = 0; i < 50; i++) { t = (lo + hi) / 2; if (cx(t) < 0.25) lo = t; else hi = t; }
    const avancement = cy(t);

    vrai(avancement < 0.67,
      `au quart du temps la barre a déjà fait ${Math.round(avancement * 100)} % du chemin `
      + '(54 px de course) : c’est ce qui se lit comme une apparition, pas comme un '
      + 'glissement. L’ancienne courbe .17,.84,.44,1 en faisait 80 %.');
  });

  test('l’appui sur le logo se voit au doigt', () => {
    /* Deux corrections successives sur le même geste, la seconde née de la
       première. Le halo du logo venait de `:hover`, que l'appui laisse collé sur
       un écran tactile : il est passé sous `@media (hover: hover)`, et le
       téléphone a perdu son seul retour. `:active` a pris le relais — sauf que
       Safari sur iOS ne l'applique pas au toucher tant qu'aucun écouteur tactile
       ne vit sur l'élément. La règle était juste et inerte là où elle comptait.

       D'où les trois assertions : le survol reste réservé aux pointeurs, l'appui
       a un relais en classe, et cette classe est bien posée sur le logo par un
       écouteur tactile. */
    const css = lireSource('assets/styles.css');
    const js = lireSource('assets/app.js');
    vrai(css && js, 'les deux sources doivent être lisibles');
    const nu = css.replace(/\/\*[\s\S]*?\*\//g, '');

    const media = nu.indexOf('@media (hover: hover)');
    vrai(media > 0, 'le garde-fou du survol doit exister');
    vrai(blocDe(nu, media + 21).includes('.brand:hover'),
      'le halo de survol du logo doit rester sous « hover: hover » : au doigt, un '
      + 'survol ne se lève pas, il reste allumé après l’appui');
    vrai(/\.brand\.tape\s+\.brand-mark/.test(nu),
      'l’appui doit avoir un relais en classe : « :active » ne se déclenche pas au '
      + 'toucher sur iOS');

    /* Le câblage se lit depuis le logo, et non depuis le premier `pointerdown`
       du fichier : app.js en compte plusieurs — le glissement d'une fenêtre, les
       infobulles des graphiques — et partir du premier faisait échouer le
       contrôle sur du code étranger. */
    const pose = js.indexOf(`$('.brand')`);
    vrai(pose > 0, 'app.js doit chercher le logo pour lui poser ce relais');
    const autour = js.slice(pose, pose + 900);
    vrai(/pointerdown/.test(autour),
      'et écouter le toucher sur lui : c’est l’écouteur tactile qui manquait');
    vrai(/classList\.add\('tape'\)/.test(autour),
      'pour poser « tape » à ce moment-là, sinon la règle d’appui ne joue jamais '
      + 'sur un téléphone');
  });
});

finDePartieDeTests('tests/08-charge-fixe-vaut-ce.tests.js');
