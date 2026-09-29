partieDeTests('tests/04-centre-anneau-sait-passer.tests.js');
suite('Le centre d’un anneau sait passer à la ligne', () => {

  const src = () => lireSource('assets/charts.js');

  test('un libellé plus large que le trou se coupe en deux', () => {
    /* UN `<text>` SVG NE SE REPLIE PAS. « Tes investissements de marché »
       débordait de l'anneau des deux côtés et se lisait par-dessus les tranches.
       Vu à l'écran. */
    const f = src();
    vrai(/function lignesCentre\(texte, largeur\)/.test(f), 'le découpage existe');
    vrai(/const etiquette = lignesCentre\(centerLabel \|\| 'Total', 2 \* r \* 0\.92\)/.test(f),
      'et il reçoit la largeur du trou, marge comprise');
    vrai(/\$\{etiquette\.map\(\(l, i\) =>/.test(f), 'chaque ligne a son texte');
  });

  test('la coupe vise le milieu, jamais le premier espace qui déborde', () => {
    /* Couper au premier espace qui dépasse laisserait « Tes » seul sur une
       ligne au-dessus de tout le reste. */
    const f = src();
    vrai(/Math\.abs\(i - milieu\) < Math\.abs\(coupe - milieu\)/.test(f),
      'l’espace le plus proche du milieu l’emporte');
    vrai(/return coupe < 0 \? \[t\] : \[t\.slice\(0, coupe\), t\.slice\(coupe \+ 1\)\]/.test(f),
      'et deux lignes au plus');
  });

  test('aucun mot n’est coupé en deux', () => {
    /* Un nom tronqué ne dit plus ce qu'il nomme : mieux vaut une ligne un peu
       large qu'un mot en morceaux. Sans espace, le libellé reste entier. */
    const f = src();
    vrai(!/slice\(0, parMax\)|substring\(0, parMax\)/.test(f),
      'jamais de coupe au caractère');
    vrai(/if \(coupe < 0\) return \[t\];|coupe < 0 \? \[t\]/.test(f),
      'un libellé d’un seul mot reste entier');
  });

  test('le bloc reste centré dans le trou', () => {
    /* Le montant monte d'autant que l'étiquette descend : sinon deux lignes
       pousseraient le tout vers le bas et le montant sortirait par le haut. */
    const f = src();
    vrai(/cy - \(etiquette\.length > 1 \? 10 : 4\)/.test(f),
      'le montant remonte quand l’étiquette prend deux lignes');
    vrai(/cy \+ \(etiquette\.length > 1 \? 8 \+ i \* 13 : 16\)/.test(f),
      'et les lignes se posent sous lui');
  });
});

suite('Créer une rentrée offre les mêmes champs que la corriger', () => {

  const fenetre = () => {
    const app = lireSource('assets/app.js');
    const d = app.indexOf("trad('Nouvelle source de revenu')");
    return app.slice(d, app.indexOf('ajoutée aux revenus', d));
  };

  test('la période se choisit à la création, pas après', () => {
    /* LA FENETRE IMPOSAIT « mensuel ». Quelqu'un qui saisit une prime annuelle
       devait la déclarer mensuelle, valider, puis la corriger dans la liste — et
       une prime laissée mensuelle par mégarde multiplie un budget par douze.
       Vu à l'écran. */
    const f = fenetre();
    vrai(/cle: 'period', label: trad\('Période'\), type: 'liste'/.test(f),
      'la période est un champ');
    vrai(/options: CHARGE_PERIODES\.map/.test(f),
      'et ses options viennent de la même table que la liste des revenus');
    /* Le motif vise le CODE et non la prose : le commentaire juste au-dessus
       du champ nomme l'ancien libellé pour dire pourquoi il est parti, et un
       contrôle qui attrape un commentaire passe au rouge sans rien protéger. */
    vrai(!/label: trad\('Montant mensuel \({dev}\)'\)/.test(f),
      '« Montant mensuel » ne répond plus à la place de la période');
  });

  test('la case « montant estimé » ne se découvre plus après coup', () => {
    /* Un formulaire de création qui cache des champs que la correction montre
       apprend à se méfier de ce qu'on vient de valider. */
    const f = fenetre();
    vrai(/cle: 'estime', label: trad\(' montant estimé'\), type: 'case'/.test(f),
      'la case est offerte dès la création');
    /* Le meme libelle et la meme aide que dans la liste : deux formulations pour
       une meme case feraient douter qu'il s'agisse de la meme chose. */
    const app = lireSource('assets/app.js');
    eq((app.match(/' montant estimé'/g) || []).length, 3,
      'un seul libellé, aux trois endroits qui la posent');
  });

  test('ce qui est saisi est ce qui est écrit', () => {
    const f = fenetre();
    vrai(/period: v\.period \|\| 'mois'/.test(f), 'la période choisie part dans l’état');
    /* `estime` ne s'écrit que s'il est vrai : un faux posé partout alourdirait
       l'état sans rien dire de plus que son absence. */
    vrai(/\.\.\.\(v\.estime \? \{ estime: true \} : \{\}\)/.test(f),
      'et la case ne laisse rien derrière elle quand elle est fausse');
  });

  test('une période inconnue retombe sur le mois', () => {
    /* C'est déjà la règle de `chargePeriode()`, et la création ne s'en écarte
       pas : un montant mensuel est son propre équivalent mensuel. */
    Fixture.poser();
    eq(chargePeriode({ period: 'trimestre' }), 'trimestre', 'une période connue tient');
    eq(chargePeriode({ period: 'bricole' }), 'mois', 'une inconnue retombe');
    eq(chargePeriode({}), 'mois', 'et une absente aussi');
  });
});

suite('Le type proposé à la création suit l’établissement', () => {

  const chez = (types, etab = 'e_x') => {
    Fixture.poser();
    Store.state.etabs = [{ id: etab, nom: 'X', notes: '', dettes: [] }];
    Store.state.comptes = types.map((t, i) => ({
      id: 'c' + i, etabId: etab, type: typeof t === 'string' ? t : t.type,
      statut: typeof t === 'string' ? undefined : t.statut,
      cash: [], lignes: [],
    }));
    return typeParDefautChez(etab);
  };

  test('chez une société qui ne porte que des parts, il propose des parts', () => {
    /* LE DEFAUT ETAIT POSE EN DUR. La fenêtre proposait d'ouvrir un compte
       courant chez une société non cotée dont on ne détient que des parts, et
       chez un courtier qui n'en tient aucun : un défaut qui ne peut pas être le
       bon fait relire la liste entière à chaque ajout. Vu à l'écran. */
    eq(chez(['pe', 'pe']), 'pe', 'deux parts de société, donc une troisième');
    eq(chez(['pea', 'cto', 'pea']), 'pea', 'celui qui revient le plus l’emporte');
  });

  test('il se dérive, il ne se recopie pas', () => {
    /* Jamais une table « société -> parts de société » : une seconde liste
       écrite à la main aurait fini par contredire celle des types, et c'est le
       défaut qui revient le plus souvent ici. */
    const st = lireSource('assets/store.js');
    const f = st.slice(st.indexOf('function typeParDefautChez('),
                       st.indexOf('\n}', st.indexOf('function typeParDefautChez(')));
    vrai(/typesCompteChoix\(\)/.test(f), 'les types viennent de la liste des types');
    vrai(!/'pe'|'pea'|'cto'/.test(f), 'et aucun identifiant n’est écrit dans la règle');
  });

  test('le dernier arrivé départage les ex æquo', () => {
    /* C'est le geste qu'on vient de refaire, donc le plus probable. */
    eq(chez(['pea', 'pe']), 'pe', 'un de chaque : le dernier ouvert');
    eq(chez(['pe', 'pea']), 'pea', 'et l’ordre compte');
  });

  test('un compte archivé ne dit plus ce qu’on ouvre', () => {
    eq(chez([{ type: 'pe', statut: 'archive' }, 'pea']), 'pea',
      'l’archive ne pèse pas');
    eq(chez([{ type: 'pe', statut: 'archive' }]), 'courant',
      'et sans rien de vivant, le repli');
  });

  test('sans établissement, ou chez un établissement vide, « courant »', () => {
    /* C'est le premier compte que la plupart des gens saisissent. */
    Fixture.poser();
    eq(typeParDefautChez(null), 'courant', 'aucun établissement');
    eq(chez([]), 'courant', 'établissement vide');
  });

  test('la fenêtre de création s’en sert', () => {
    const app = lireSource('assets/app.js');
    /* Une porte d’entrée d’Actifs peut présélectionner sa famille ; le défaut
       reste demandé à la même fonction dès qu’aucune n’est imposée. */
    vrai(/: typeParDefautChez\(etabImpose\) \}\]/.test(app),
      'l’assistant demande le défaut plutôt que de l’écrire');
    vrai(!/\], valeur: 'courant' \}\]/.test(app), 'et plus rien n’est posé en dur');
  });
});

suite('L’anneau du portefeuille : un total qui égale ses parts', () => {

  /* Un état contrôlé : la graine porte ses propres positions et son propre cash
     à investir, et la forme du fixture changerait les réponses sans changer la
     règle. On vide donc les comptes de marché avant de poser les lignes. */
  const poser = (valeurs, cash = 0) => {
    Fixture.poser();
    Store.state.positions = valeurs.map((v, i) => ({
      id: 'p' + i, name: 'L' + i, account: 'a', manual: true, value: v,
    }));
    for (const c of COMPTES()) {
      if (typeCompte(c.type).groupe === 'bourse') { c.lignes = []; c.cash = []; }
    }
    if (cash) {
      const bourse = COMPTES().find(c => typeCompte(c.type).groupe === 'bourse');
      bourse.cash = [{ montant: cash, affectation: 'investir' }];
    }
    return repartitionPortefeuille();
  };

  test('le total égale la somme de ses parts, et les parts font cent', () => {
    /* C'est l'invariant de la maison, et c'est pour lui que ce calcul vit dans
       le modèle : le harnais ne charge pas `app.js`, et un anneau dont les
       tranches ne composent pas son centre ne se verrait nulle part. */
    const pf = poser([1000, 500, 250, 250]);
    pres(pf.total, 2000, 'le total est celui des parts');
    pres(pf.anneau.reduce((s, x) => s + x.value, 0), pf.total, 'l’anneau l’égale exactement');
    pres(pf.anneau.reduce((s, x) => s + x.pct, 0), 100, 'et ses parts font cent');
    pres(pf.tableau.lignes.reduce((s, x) => s + x.value, 0), pf.total, 'le tableau aussi');
    eq(pf.tableau.lignes[0].value, 1000, 'la plus grosse ligne ouvre le classement');
  });

  test('il couvre exactement la base du portefeuille', () => {
    /* LE MEME NOM NE PEUT PAS PORTER DEUX MONTANTS. `basePortefeuilleMarches()`
       est la base dont se sert tout le reste de l'application pour peser une
       ligne ; si l'anneau en couvrait une autre, deux écrans donneraient deux
       parts différentes pour la même ligne. C'est le défaut que ce projet traque
       partout : « Liquidités » a déjà valu deux choses sur deux pages. */
    const pf = poser([1000, 500], 400);
    pres(pf.total, basePortefeuilleMarches(), 'l’anneau couvre toute la base');
    pres(pf.total, 1900, 'positions et cash compris');
  });

  test('le cash qui attend est une part, jamais un oubli', () => {
    /* Quelqu'un dont un cinquième du portefeuille dort en attendant un point
       d'entrée doit le VOIR : c'est une allocation, pas un détail comptable. */
    const pf = poser([1600], 400);
    const cash = pf.tableau.cash;
    vrai(!!cash && cash.attente, 'il a sa ligne');
    pres(cash.value, 400, 'qui vaut ce qui attend');
    pres(cash.pct, 20, 'et pèse ce qu’il pèse');
    vrai(pf.anneau.some(x => x.attente), 'et sa tranche');
    /* IL NE SE FAIT PAS ABSORBER PAR « AUTRES » : il n'est pas une ligne plus
       petite que les autres, c'est la part qui n'est pas investie. */
    const gros = poser([1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 30, 20], 5);
    vrai(gros.tableau.cash && gros.tableau.cash.value === 5, 'même minuscule, il reste une ligne à part');
    vrai(!(gros.tableau.autres?.lignes || []).some(x => x.attente), 'jamais dans le groupe du tableau');
    vrai(gros.anneau[gros.anneau.length - 1].attente, 'et il garde sa tranche');
    vrai(gros.anneau.length <= TRANCHES_ANNEAU_PORTEFEUILLE, 'l’anneau reste sous son plafond, lui compris');
  });

  test('toute ligne d’au moins 1 % se voit, une à une', () => {
    /* Un plafond de huit parts cachait des positions de plusieurs pour cent
       sous « Autres ». Le seuil porte sur le total des comptes de marché, cash à
       investir compris : c'est la base du pied du tableau. */
    const pf = poser([700, 160, 100, 20, 8, 7, 5]);     // total 1 000
    eq(pf.tableau.lignes.length, 4, 'les quatre lignes à 2 % ou plus');
    eq(pf.tableau.autres.lignes.length, 3, 'les trois sous le seuil se regroupent');
    pres(pf.tableau.autres.value, 20, 'le groupe vaut la somme de ce qu’il déplie');
    pres(pf.tableau.autres.pct, 2, 'et sa part, celle de ses lignes');
    pres(pf.tableau.autres.lignes.reduce((s, x) => s + x.pct, 0), pf.tableau.autres.pct,
      'les parts dépliées refont celle du groupe');
    const borne = poser([990, 10, 5, 5]);                 // 10 vaut 0,99 %
    const juste = poser([980, 10, 5, 5]);                 // 10 vaut 1 % tout rond
    vrai(juste.tableau.lignes.some(x => x.value === 10), 'la borne est incluse');
    vrai(!borne.tableau.lignes.some(x => x.value === 10), 'et tient au centième');
  });

  test('une seule petite ligne ne fait pas un groupe', () => {
    const pf = poser([600, 395, 5]);
    eq(pf.tableau.autres, null, 'pas de groupe pour une ligne');
    eq(pf.tableau.lignes.length, 3, 'elle reste à sa place');
  });

  test('la situation de la capture : plus aucune position de plusieurs pour cent cachée', () => {
    /* Onze lignes et du cash : le plafond de huit parts en rangeait cinq, toutes
       au-dessus de 1 %, sous un « Autres » de près de 10 %. Montants fictifs. */
    const pf = poser([30000, 18000, 13000, 10000, 8000, 6400, 2600, 2100, 1900, 1700, 1300], 5000);
    pres(pf.total, 100000, 'le total ne change pas');
    eq(pf.tableau.lignes.length, 11, 'les onze lignes sont dans le tableau, une à une');
    eq(pf.tableau.autres, null, 'aucune n’est sous le seuil');
    eq(pf.tableau.repliees, null, 'et rien n’est replié');
    eq(pf.anneau.length, TRANCHES_ANNEAU_PORTEFEUILLE, 'l’anneau garde ses huit tranches');
    const reste = pf.resteAnneau;
    eq(reste.nb, 5, 'sa tranche du reste réunit les cinq plus petites');
    eq(reste.label, trad('Reste du portefeuille'), 'sous un autre nom que le groupe du tableau');
    const sansTranche = pf.tableau.lignes.filter(x => x.tranche == null);
    eq(sansTranche.length, 5, 'ces cinq lignes savent qu’elles n’ont pas de tranche à elles');
    pres(sansTranche.reduce((s, x) => s + x.value, 0), reste.value,
      'et leur somme est la tranche du reste, au centime');
    pres(pf.tableau.lignes.reduce((s, x) => s + x.value, 0) + pf.tableau.cash.value, pf.total,
      'le tableau fait le total du pied');
    pres(pf.anneau.reduce((s, x) => s + x.value, 0), pf.total, 'l’anneau aussi');
  });

  test('trois lignes : tout se voit, sans groupe ni repli', () => {
    const pf = poser([6000, 3000, 1000], 500);
    eq(pf.tableau.lignes.length, 3, 'trois lignes');
    eq(pf.tableau.autres, null, 'pas de groupe');
    eq(pf.tableau.repliees, null, 'pas de repli');
    eq(pf.resteAnneau, null, 'et pas de tranche du reste');
    eq(pf.anneau.length, 4, 'trois tranches et le cash');
    vrai(pf.anneau.every(x => x.tranche != null), 'chacune a la sienne');
  });

  test('trente lignes : un tableau maîtrisable, et aucune ligne perdue', () => {
    const grosses = [9000, 8000, 7000, 6000, 5500, 5000, 4500, 4000, 3600, 3200, 2900, 2600,
                     2300, 2100, 1900, 1700, 1500, 1300];
    const petites = [700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150];
    const pf = poser([...grosses, ...petites], 2800);
    pres(pf.total, 80000, 'le total ne change pas');
    const t = pf.tableau;
    eq(t.lignes.length, grosses.length, 'toutes les lignes d’au moins 1 % sont des rangées');
    eq(t.lignes.filter(x => !x.replie).length, LIGNES_TABLEAU_REPLIEES, 'les premières se voient d’emblée');
    eq(t.repliees.nb, grosses.length - LIGNES_TABLEAU_REPLIEES, 'les suivantes attendent « Voir toutes les lignes »');
    pres(t.repliees.value, t.lignes.filter(x => x.replie).reduce((s, x) => s + x.value, 0),
      'la rangée de repli porte leur somme');
    eq(t.autres.lignes.length, petites.length, 'les douze sous le seuil sont dans le groupe');
    eq(t.lignes.length + t.autres.lignes.length, grosses.length + petites.length,
      'les trente lignes sont toutes dans le tableau');
    pres(t.lignes.filter(x => !x.replie).reduce((s, x) => s + x.value, 0) + t.repliees.value
         + t.autres.value + t.cash.value, pf.total,
      'replié, ce qui se voit fait le total du pied');
    pres(t.lignes.reduce((s, x) => s + x.value, 0) + t.autres.value + t.cash.value, pf.total,
      'déplié aussi');
    vrai(pf.anneau.length <= TRANCHES_ANNEAU_PORTEFEUILLE, 'l’anneau reste lisible');
    eq(pf.resteAnneau.nb, grosses.length - pf.anneau.filter(x => x.tranche != null && !x.attente).length
      + petites.length, 'sa tranche du reste réunit tout ce qui n’a pas la sienne');
    vrai(t.autres.lignes.every(x => x.tranche == null), 'une ligne du groupe n’a jamais de tranche');
  });

  test('la tranche du reste garde le nom « Autres » quand elle vaut le groupe', () => {
    /* Deux « Autres » de deux montants se liraient sur la même carte : le nom ne
       se partage que si le montant se partage. */
    const pf = poser([700, 160, 100, 20, 8, 7, 5]);
    eq(pf.resteAnneau.label, trad('Autres'), 'même nom');
    pres(pf.resteAnneau.value, pf.tableau.autres.value, 'même montant');
  });

  test('une valeur non positive sort, et se compte', () => {
    /* Une part négative n'existe pas sur un anneau. Ce qui est écarté se compte
       plutôt que de laisser un total qui ne se retrouve pas — c'est déjà ce que
       fait `latentPnl()` pour les lignes sans prix de revient. */
    const pf = poser([1000, 0, -50, 500]);
    eq(pf.anneau.length, 2, 'deux parts seulement');
    eq(pf.tableau.lignes.length, 2, 'et deux rangées');
    eq(pf.ecartees, 2, 'et les deux autres se comptent');
    pres(pf.total, 1500, 'le total ne porte que ce qui est dessiné');
  });

  test('sans titre ni cash, pas d’anneau du tout', () => {
    /* Un anneau vide sous un titre qui parle de portefeuille apprendrait à
       quelqu'un qu'il lui manque quelque chose qui ne lui manque pas. Même
       règle que la cloche, qui ne réclame pas d'actualiser des cours à qui n'a
       aucun titre. */
    eq(poser([]), null, 'aucune position');
    eq(poser([0, -10]), null, 'aucune valeur positive non plus');
    vrai(poser([], 300) !== null, 'mais du cash seul suffit à dire quelque chose');
    const app = lireSource('assets/app.js');
    vrai(/const pf = repartitionPortefeuille\(\);\s*\n\s*if \(!pf\) return '';/.test(app),
      'et la carte ne se rend pas');
    vrai(/if \(pf\) \{\s*\n\s*Charts\.donut\(\$\('#aPortefeuille'\)/.test(app),
      'ni l’anneau');
  });

  test('la carte annonce sa base, et la réserve qui va avec', () => {
    /* SA BASE N'EST PAS CELLE DE LA PAGE : les parts se rapportent au
       portefeuille de marché, pas aux avoirs. Et la réserve qui compte : un
       fonds est UNE ligne. Deux camemberts de cette page sont morts d'avoir
       laissé croire l'inverse. */
    const app = lireSource('assets/app.js');
    /* Le centre prend son nom d'une FONCTION, jamais d'une chaîne écrite là :
       un centre qui porte un libellé à la main peut dériver de ce que ses parts
       totalisent, et cette page a déjà payé ce défaut. */
    vrai(/centerLabel: nomPortefeuille\(\), centerValue: pf\.total/.test(app),
      'le centre dit sur quoi elle compte, et vaut ses parts');
    vrai(/const nomPortefeuille = \(\) => trad\(/.test(app),
      'et ce nom vit à un seul endroit');
    vrai(/Un fonds compte pour UNE ligne/.test(app), 'et ce qu’elle ne sait pas lire');
    for (const cle of ['de tes comptes de marché', 'Comptes de marché',
                       'Autres', 'À investir']) {
      vrai(!!I18N.en[cle], '« ' + cle + ' » existe en anglais');
    }
    /* Les pastilles du tableau et les tranches de l'anneau partent de la MEME
       fonction, `couleurTranche`, sur le rang de tranche que le modele pose :
       elles ne peuvent pas diverger. */
    vrai(/pastilleTeinte\(couleurTranche\(x\)\)/.test(app), 'le tableau teinte par tranche');
    vrai(/items: pf\.anneau\.map\(p => \(\{ label: p\.label, value: p\.value, color: couleurTranche\(p\) \}\)\)/.test(app),
      'et l’anneau aussi');
  });

  test('le tableau déplie sur place, et une ligne du reste n’a pas de couleur à elle', () => {
    const app = lireSource('assets/app.js');
    const store = lireSource('assets/store.js');
    const css = lireSource('assets/styles.css');
    const fn = app.slice(app.indexOf('function tableauPortefeuille(pf) {'),
                         app.indexOf('\n}', app.indexOf('function tableauPortefeuille(pf) {')));
    vrai(fn.length > 0, 'le tableau doit être trouvable');
    vrai(/const couleurTranche = x => \(x\.tranche == null\s*\n?\s*\? COULEUR_RESTE_PORTEFEUILLE/.test(app),
      'sans tranche à soi, le gris de la tranche du reste');
    const sous = fn.slice(fn.indexOf('class="pf-sous"'), fn.indexOf('</tr>', fn.indexOf('class="pf-sous"')));
    vrai(sous.length > 0 && !/pastilleTeinte/.test(sous), 'une ligne dépliée du groupe ne porte aucune pastille');
    vrai(/data-action="pf-autres" aria-expanded="\$\{pfAutresOuvert\}"/.test(fn), 'le groupe se déplie, et le dit');
    vrai(/data-action="pf-toutes" aria-expanded="\$\{pfToutesOuvert\}"/.test(fn), 'la liste longue aussi');
    vrai(/\$\{tableauPortefeuille\(pf\)\}/.test(app), 'la carte rend ce tableau');
    for (const a of ["'pf-autres'(btn)", "'pf-toutes'(btn)"]) {
      const corps = app.slice(app.indexOf(a), app.indexOf('\n  },', app.indexOf(a)));
      vrai(corps.length > 0 && !/render\(\)/.test(corps), `${a} déplie sans rendre la page`);
    }
    for (const r of ['.table-portefeuille.tout-voir .pf-replie,', '.table-portefeuille.autres-ouvert .pf-sous { display: table-row; }',
                     '.table-portefeuille.tout-voir .pf-somme { display: none; }']) {
      vrai(css.includes(r), `la feuille porte « ${r} »`);
    }
    for (const c of ['Reste du portefeuille', 'Voir toutes les lignes', 'Voir moins', '{n} lignes de plus',
                     '{n} lignes de moins de {s}',
                     'L’anneau résume : « {l} » réunit ce qui porte une pastille grise dans le tableau, {n} lignes pour {v}, soit {p}.']) {
      vrai(!!I18N.en[c], `« ${c.slice(0, 40)} » a sa traduction`);
      vrai(app.includes(`trad('${c}')`) || store.includes(`trad('${c}')`), `« ${c.slice(0, 40)} » passe par trad()`);
    }
    vrai(!app.includes('« Autres » regroupe {n} lignes plus petites.'), 'l’ancienne phrase du plafond est partie');
    /* Mesure a 375 px : « 1 » et « % » tombaient sur deux lignes sous « Autres ». */
    vrai(fn.includes("fmtPct(SEUIL_LIGNE_PORTEFEUILLE_PCT, 0).replace(' ', '\\u00a0')"),
      'le seuil garde son signe sur sa ligne');
    vrai(css.includes('.table-portefeuille .pf-bascule .sub { overflow-wrap: normal; }'),
      'et la règle qui coupe partout est levée là');
    vrai(css.includes('.table-portefeuille .pf-plus .btn { margin: 0; white-space: nowrap; }'),
      '« Voir toutes les lignes » tient sur une ligne');
  });
});

suite('Le résumé d’un établissement compte ce qui a une base', () => {

  test('le total égale la somme de ses parts', () => {
    const p = poserDeux(2000);
    vrai(p != null, 'un établissement qui porte des lignes rend un résumé');
    pres(p.investi + p.pnl, p.valeur, 'investi plus écart font la valeur');
    if (p.investi > 0) pres(p.pct, (p.pnl / p.investi) * 100, 'et le pourcentage part de l’investi');
  });

  /* Un établissement à nous, plutôt que celui de la graine : ces contrôles
     portent sur ce qui entre et sort du calcul, et la forme du fixture
     changerait la réponse sans changer la règle. `prixDeRevient` absent vaut
     coût inconnu — zéro y vaudrait « non renseigné » aussi, c'est
     `acquisitionLigne()` qui le dit, un vrai coût nul se déclare par
     `prixAchat: 0`. */
  const poserDeux = (revientDeLaSeconde) => {
    Fixture.poser();
    Store.state.etabs.push({ id: 'e_essai', nom: 'Essai', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_essai', etabId: 'e_essai', type: 'pe', cash: [],
      lignes: [
        { id: 'la', classe: 'nonCote', libelle: 'a', valeur: 5000, prixDeRevient: 4000 },
        { id: 'lb', classe: 'nonCote', libelle: 'b', valeur: 3000,
          ...(revientDeLaSeconde == null ? {} : { prixDeRevient: revientDeLaSeconde }) },
      ] });
    return perfEtab('e_essai');
  };

  test('une ligne sans prix de revient sort du calcul, et se dit', () => {
    /* ELLE NE PEUT PAS Y ENTRER A ZERO. Compter sa valeur sans son coût
       gonflerait l'écart du montant entier de cette ligne — une plus-value
       inventée, et toujours du côté flatteur. Elle part donc dans `horsBase`,
       qui s'affiche : sans lui, le résumé aurait l'air de parler de tout le
       solde annoncé en tête. */
    const avec = poserDeux(2000);
    pres(avec.investi, 6000, 'les deux coûts sont comptés');
    pres(avec.valeur, 8000, 'et les deux valeurs');
    pres(avec.horsBase, 0, 'rien ne sort du calcul');

    const sans = poserDeux(null);
    pres(sans.investi, 4000, 'le coût manquant quitte l’investi');
    pres(sans.valeur, 5000, 'et sa valeur quitte la valeur');
    pres(sans.horsBase, 3000, 'elle se retrouve entièrement hors base');
    pres(sans.sansBase, 3000, 'et le résumé dit que c’est une ligne sans prix de revient');
    pres(sans.cash, 0, 'pas du cash');
    /* LE PIEGE QUE CE CONTROLE GARDE : comptée à zéro, la seconde ligne aurait
       fait « +4 000 » d'écart au lieu de « +1 000 ». */
    pres(sans.pnl, 1000, 'l’écart ne gonfle pas du montant de la ligne écartée');
  });

  test('les espèces ne sont jamais une plus-value', () => {
    /* Elles n'ont aucun coût d'acquisition : un solde de compte courant n'a pas
       été acheté. Les compter dans la valeur sans les compter dans l'investi
       ferait exactement la même plus-value inventée. */
    const avant = poserDeux(2000);
    const c = compteById('c_essai');
    c.cash = [{ montant: 1234, libelle: 'test' }];
    const apres = perfEtab('e_essai');
    pres(apres.investi, avant.investi, 'l’investi ne bouge pas');
    pres(apres.valeur, avant.valeur, 'la valeur non plus');
    pres(apres.horsBase - avant.horsBase, 1234, 'et le liquide passe hors base');
    pres(apres.cash, 1234, 'nommé pour ce qu’il est : du cash');
    pres(apres.sansBase, avant.sansBase, 'sans être confondu avec une ligne sans prix de revient');
    pres(apres.horsBase, apres.cash + apres.sansBase, 'les deux parts font le total écarté');
  });

  test('aucune base, aucun résumé', () => {
    /* Une banque qui ne porte que des espèces n'a pas de plus-value, et une
       carte de trois zéros ne dirait rien. */
    poserDeux(2000);
    compteById('c_essai').lignes = [];
    eq(perfEtab('e_essai'), null, 'le résumé se tait');
  });

  test('un pourcentage n’existe que sur une base positive', () => {
    /* Diviser par zéro n'existe pas, et une base négative retournerait le
       signe : c'est la règle que `deltas()` tient déjà ailleurs. */
    poserDeux(2000);
    compteById('c_essai').lignes =
      [{ id: 'lz', classe: 'nonCote', libelle: 'z', valeur: 900, prixDeRevient: 0 }];
    const p = perfEtab('e_essai');
    vrai(p == null || p.pct === null, 'sans coût saisi, aucun pourcentage n’est rendu');
  });

  test('la carte vit sur la fiche, et se tait quand le modèle se tait', () => {
    const src = lireSource('assets/app.js');
    const fiche = src.slice(src.indexOf('function viewFicheEtab('),
                            src.indexOf("trad('Crédits en cours')", src.indexOf('function viewFicheEtab(')));
    vrai(/const p = perfEtab\(e\.id\);/.test(fiche), 'elle demande le résumé au modèle');
    vrai(/if \(!p\) return '';/.test(fiche), 'et ne rend rien quand il n’y a pas de base');
    vrai(/trad\('Investi et plus-value'\)/.test(fiche), 'la carte porte son titre');
    vrai(/trad\('sur les lignes dont le prix de revient est saisi'\)/.test(fiche),
      'et annonce sa base, comme toute carte qui en a une');
    vrai(/p\.pct == null \? ''/.test(fiche), 'un pourcentage absent ne s’écrit pas');
    vrai(/p\.horsBase < 0\.005 \? ''/.test(fiche),
      'et ce qui sort du calcul ne se dit que s’il y en a');
    /* Elle se lit AVANT la liste des comptes : le grand chiffre, ce qu'il a
       coûté, puis le détail qui le compose. */
    vrai(fiche.indexOf("trad('Investi et plus-value')")
       < fiche.indexOf("<h2>${majuscule(motContenu(e.id, 2))}</h2>"),
      'elle complète le grand chiffre avant d’ouvrir le détail');
    for (const cle of ['Investi et plus-value',
                       'sur les lignes dont le prix de revient est saisi',
                       '{v} hors de ce calcul : du cash, qui n’a pas de prix de revient',
                       '{v} hors de ce calcul : des lignes sans prix de revient saisi',
                       '{v} hors de ce calcul : {c} de cash et {l} de lignes sans prix de revient saisi']) {
      vrai(!!I18N.en[cle], '« ' + cle + ' » existe en anglais');
    }
    /* Trois phrases pour trois cas : le cash seul, les lignes seules, les deux.
       « Faute de prix de revient » accusait des titres la ou il n'y avait que du
       cash en attente chez le courtier. */
    vrai(!I18N.en['hors de ce calcul, faute de prix de revient'], 'la phrase qui accusait des titres est partie');
    vrai(/p\.sansBase < 0\.005\s*\? trad\('\{v\} hors de ce calcul : du cash/.test(fiche)
      && /p\.cash < 0\.005\s*\? trad\('\{v\} hors de ce calcul : des lignes/.test(fiche),
      'la vue choisit la phrase selon ce qui est écarté');
  });
});

suite('Une valeur estimée ne se compare pas au relevé du mois dernier', () => {

  const st = () => lireSource('assets/store.js');
  const app = () => lireSource('assets/app.js');

  test('le drapeau distingue ce qu’on apprécie de ce qu’un tiers établit', () => {
    /* TROIS NATURES, ET LES CONFONDRE S'EST DEJA PAYE. Une valeur qu'on
       apprecie soi-meme (une montre, une participation), une valeur qu'un tiers
       PUBLIE (la VL d'un fonds), un solde qu'on LIT chez un teneur de compte.
       Seule la premiere est une opinion. */
    vrai(typeof estValeurEstimee === 'function', 'le prédicat existe');
    vrai(estValeurEstimee(TYPES_COMPTE.find(t => t.id === 'pe')),
      'une part de société se valorise soi-même');
    vrai(!estValeurEstimee(TYPES_COMPTE.find(t => t.id === 'fondsNonCote')),
      'une VL publiée est établie par un tiers, ce n’est pas une opinion');
    vrai(!estValeurEstimee(TYPES_COMPTE.find(t => t.id === 'crowdfunding')),
      'le nominal d’un prêt ne bouge pas tant qu’il n’est pas remboursé');
    /* Et tout ce qui se detient en direct l'est sans avoir a le redeclarer :
       le drapeau se DERIVE de `direct`, il ne recopie pas sa liste. */
    for (const t of TYPES_COMPTE.filter(x => x.direct)) {
      vrai(estValeurEstimee(t), `« ${t.id} » se détient en direct, donc il s’estime`);
    }
    vrai(/const estValeurEstimee = t => !!t && \(!!t\.direct \|\| !!t\.estimee\);/.test(st()),
      'et la dérivation est écrite une fois');
  });

  test('la ligne dit ce que le montant est, au lieu d’un écart trompeur', () => {
    /* LE DEFAUT VU A L'ECRAN : « +5 000 EUR depuis sept. » sous une
       participation. L'ecart comparait la valeur du jour au dernier releve, or
       les deux sont des chiffres que le detenteur a poses lui-meme : le nombre
       affiche mesurait la revision de sa propre estimation et se lisait comme
       une plus-value. Deux choses tres differentes sous la meme forme. */
    const src = app();
    const ligne = src.slice(src.indexOf('function ligneCompte('),
                            src.indexOf('function ', src.indexOf('function ligneCompte(') + 10));
    vrai(/const estimee = estValeurEstimee\(typeCompte\(c\.type\)\);/.test(ligne),
      'la ligne sait si son montant est une estimation');
    vrai(/const v = estimee \? null : variationCompte\(c\.id\);/.test(ligne),
      'et l’écart ne se calcule alors pas');
    vrai(/estimee \? `<span class="sub">\$\{dateEstimee \|\| '&nbsp;'\}<\/span>`/.test(ligne),
      'la place sous le montant dit de quand date l’estimation');
    vrai(/datesDuCompte\(c\)\.find\(x => x\.genre === 'estimation'\)/.test(ligne),
      'et cette date vient du modèle, pas de la ligne');
    /* La phrase remplace l'ecart, elle ne s'y ajoute pas : deux sous-titres sous
       un meme montant se disputeraient la meme ligne. */
    eq((ligne.match(/class="sub/g) || []).length, 4,
      'un seul sous-titre à la fois sous le montant');
    vrai(!!I18N.en['estimée le {d}'] && !!I18N.en['estimation sans date'],
      'et les deux phrases existent en anglais');
    vrai(!/'estimation actuelle'/.test(src), 'plus aucune estimation ne se dit « actuelle » sans date');
  });

  test('un actif terminal porte UN nom, et les deux portes l’écrivent', () => {
    /* DEUX PORTES SUR LE MEME FAIT, CE QUI EST SAIN — deux copies qui
       divergent, non. Sur un actif terminal le compte EST le placement : la
       fenetre du compte et celle du placement offrent toutes deux « Intitule »,
       et seule la premiere propageait. Renommer par la seconde laissait
       l'en-tete afficher l'ancien nom au-dessus du nouveau, sans que rien ne
       dise lequel comptait. Vu a l'ecran, sur une part de societe.

       La garde est terminale et non directe : une participation est tenue par
       un tiers et n'est pas davantage divisible qu'un appartement. */
    const src = app();
    const dc = src.indexOf("async 'modifier-compte'(btn)");
    const compte = src.slice(dc, src.indexOf("if (v.type) c.type = v.type;", dc));
    vrai(/if \(estActifTerminal\(typeCompte\(c\.type\)\)\n\s*&& \(c\.lignes \|\| \[\]\)\.length === 1 && !\(c\.cash \|\| \[\]\)\.length/
      .test(compte), 'renommer le compte renomme sa ligne unique');
    vrai(/c\.lignes\[0\]\.libelle = String\(v\.libelle\)\.trim\(\);/.test(compte),
      'et c’est bien le nom saisi qui descend');
    const place = src.slice(src.indexOf("async 'editer-placement'(btn)"),
                            src.indexOf("async 'editer-placement'(btn)") + 3000);
    vrai(/if \(estActifTerminal\(typeCompte\(c\.type\)\)[\s\S]{0,160}c\.libelle = String\(v\.libelle\)\.trim\(\);/
      .test(place), 'et renommer la ligne renomme le compte');
    /* CE QUI NE REMONTE PAS : le nom de l'etablissement. Un bien detenu en
       direct EST son contenant, une participation est tenue par un courtier qui
       en porte d'autres. Renommer la part renommerait le courtier. */
    vrai(/const etab = estDetenuEnDirect\(typeCompte\(c\.type\)\) \? etabById\(c\.etabId\) : null;/
      .test(compte),
      'le contenant, lui, ne suit que pour ce qu’on détient en direct');
    vrai(/COMPTES\(\)\.filter\(x => x\.etabId === etab\.id\)\.length === 1/.test(compte),
      'et seulement s’il ne porte que ce compte');
  });

  test('la date d’entrée se voit, et les deux portes l’écrivent aussi', () => {
    /* LA LIGNE DISPARAISSAIT QUAND ELLE ETAIT VIDE, donc rien ne disait qu'un
       placement n'avait pas de date ni ou la poser. Ses deux voisines de la
       meme liste, « Prix d'achat / part » et « Date de clôture », affichent
       depuis toujours une mention quand le champ manque : une carte de lecture
       qui escamote ses lignes vides se lit comme une carte complete.

       Et la date vivait aux MEMES deux endroits que le nom : la fiche lit
       `c.ouvertLe`, la fenêtre du placement écrit `l.dateAcquisition`. Sur un
       actif terminal ce sont deux écritures d'un seul fait, donc la date
       saisie ne s'affichait pas. Vu à l'écran, sur une part de société. */
    const src = app();
    /* LA DATE A CHANGE DE CARTE, PAS DE COMPORTEMENT. Elle vivait sur la carte
       de valeur, seule de son espece ; elle est revenue dans « Informations »
       avec le nom, le type et le numero, comme sur toutes les autres fiches.
       Ce qu'elle garde, c'est d'INVITER : sur un actif terminal, une date
       absente affiche sa ligne au lieu de disparaitre. */
    const infos = src.slice(src.indexOf("trad('Informations')"),
                            src.indexOf("trad('actions.fiche'"));
    vrai(/\(c\.ouvertLe \|\| estActifTerminal\(t\)\)/.test(infos),
      'un actif terminal montre sa ligne de date même vide');
    vrai(/trad\('à renseigner'\)/.test(infos),
      'et elle invite à la renseigner');

    const dp = src.indexOf("async 'editer-placement'(btn)");
    const place = src.slice(dp, dp + 3200);
    vrai(/if \('dateAcquisition' in v\) \{/.test(place)
      && /c\.ouvertLe = v\.dateAcquisition;/.test(place),
      'dater le placement date le compte');
    /* Une date effacee s'efface, elle ne devient pas une chaine vide : c'est ce
       que fait `pose()` de l'autre cote, et deux regimes d'effacement sur le
       meme champ finiraient par se contredire. */
    vrai(/else delete c\.ouvertLe;/.test(place),
      'et l’effacer l’efface, au lieu d’écrire une chaîne vide');

    const dc2 = src.indexOf("async 'modifier-compte'(btn)");
    const compte2 = src.slice(dc2, src.indexOf("async 'ajouter-compte'", dc2));
    vrai(/if \('ouvertLe' in v && estActifTerminal\(typeCompte\(c\.type\)\)/.test(compte2)
      && /c\.lignes\[0\]\.dateAcquisition = v\.ouvertLe \|\| '';/.test(compte2),
      'et dater le compte date sa ligne unique');
  });
});

suite('Saisie par part : le montant et le prix par part donnent les parts', () => {

  const vue = () => lireSource('assets/app.js');
  /* Le bloc de cablage, isole par son entete. Les regles se lisent la, et non
     dans le commentaire qui les annonce. */
  /* La tranche part de l'assemblage des paires et court jusqu'a la sortie du
     bloc. Elle s'arretait au premier `}` de colonne quatre, ce qui suffisait
     quand tout tenait dans une boucle : depuis que les paires s'assemblent
     avant d'etre cablees, ce `}` ferme la PREMIERE boucle et les ecouteurs
     tombaient hors du champ de lecture. Trois controles sont passes au vert
     sur un bloc qui ne contenait plus ce qu'ils cherchaient. */
  const cablage = () => {
    const app = vue();
    const d = app.indexOf('const paires = [];');
    return app.slice(d, app.indexOf("const premier = $('#modalBody')", d));
  };
  const champs = () => {
    const app = vue();
    return app.slice(app.indexOf('function champsPlacement'),
                     app.indexOf('function litPlacement'));
  };

  test('taper un prix par part écrit le total', () => {
    /* C'est le geste qui manquait : une société qui lève annonce un prix par
       part, pas la valeur d'un bloc. */
    const c = cablage();
    /* L'ecouteur passe d'abord par la deduction du nombre de parts, qui rend
       faux quand elle n'a pas lieu : le motif tient donc l'appel, pas la forme
       exacte de l'ecouteur. */
    vrai(/unite\.addEventListener\('input',[\s\S]{0,1400}versTotal\(\);/.test(c),
      'le champ unitaire écrit le total');
    vrai(/total\.value = String\(round2\(num\(unite\.value\) \* n\(\)\)\)/.test(c),
      'et le total vaut le prix multiplié par la quantité');
  });

  test('taper un total recalcule le prix par part', () => {
    vrai(/total\.addEventListener\('input',[\s\S]{0,160}versUnite\(\);/.test(cablage()),
      'les deux sens fonctionnent');
  });

  test('changer le nombre de parts ne touche JAMAIS au total', () => {
    /* LA REGLE QUI COMPTE. Recalculer le total ferait bouger un montant qu'on
       n'a pas touché, au moment précis où l'on corrige une quantité — et ce
       montant est celui que le patrimoine additionne. */
    const c = cablage();
    vrai(/combien\.addEventListener\('input', versUnite\)/.test(c),
      'corriger la quantité recalcule le prix par part');
    vrai(!/combien\.addEventListener\('input', versTotal\)/.test(c),
      'et surtout pas le total');
  });

  test('le prix par part ne se stocke pas', () => {
    /* Deux champs pour une même valeur finissent toujours par diverger. Le
       champ unitaire n'a pas de `cle`, il n'entre donc pas dans `champs`, et
       `valeurs()` ne parcourt que les champs déclarés. */
    vrai(!/cle: 'parPart'/.test(champs()), 'ce n’est pas un champ déclaré');
    vrai(/id="\$\{id\}_part"/.test(vue()), 'il vit sous un identifiant dérivé');
    const app = vue();
    const lit = app.slice(app.indexOf('function litPlacement'),
                          app.indexOf('\n}', app.indexOf('function litPlacement')));
    vrai(!/parPart|_part|prixUnitaire/.test(lit), 'et rien de tel n’est enregistré');
  });

  test('un total arrondi ne se reconstruit pas depuis un prix arrondi', () => {
    /* Quatre décimales au prix par part, deux au total : 7 529 fois 1,33 fait
       10 013 et non les 10 000 saisis, et c'est le total qui fait foi. */
    vrai(/\* 10000\) \/ 10000/.test(cablage()), 'le prix par part garde quatre décimales');
    pres(Math.round((10000 / 7529) * 10000) / 10000, 1.3282, 'le prix affiché à l’ouverture');
    pres(round2(2 * 7529), 15058, 'et deux euros la part refont le total');
  });

  test('seuls les types qui se divisent en parts ont ce champ', () => {
    const c = champs();
    eq((c.match(/parPart: 'parts'/g) || []).length, 2,
      'la valeur du jour et le montant investi, pas un de plus');
    vrai(/type && type\.parts\n?\s*\? \{ parPart: 'parts'/.test(c),
      'le champ suit le drapeau du type');
    const pret = TYPES_COMPTE.find(t => t.id === 'crowdfunding');
    vrai(!pret.parts, 'un prêt participatif n’en a donc pas');
  });

  test('le nombre de parts passe devant les montants qu’il divise', () => {
    /* Il commandait deux prix unitaires depuis le bas du formulaire : les
       champs qui le divisent se remplissaient avant que la quantité existe. */
    const c = champs();
    const parts = c.indexOf("cle: 'parts'");
    const valeur = c.indexOf("cle: 'valeur'");
    const revient = c.indexOf("cle: 'prixDeRevient'");
    vrai(parts > 0 && valeur > 0 && revient > 0, 'les trois champs sont là');
    vrai(parts < valeur && parts < revient, 'et la quantité vient en premier');
  });

  test('le bloc unitaire ne reprend pas un nom de classe déjà pris', () => {
    /* `champ-unite` porte deja le petit « € » colle a droite d'un montant : un
       div qui reprend ce nom hérite de sa couleur grisée et de sa taille. */
    const css = lireSource('assets/styles.css');
    vrai(/\.champ-par-part \{/.test(css), 'le bloc a son propre style');
    vrai(/\.champ-unite \{/.test(css), 'et l’ancien nom reste ce qu’il était');
    vrai(/class="champ-par-part"/.test(vue()), 'la vue emploie le nouveau');
  });
});

/* ------------------------------------------------------------------
   Un intitule compose se traduit comme les autres
   ------------------------------------------------------------------ */
suite('Formulaire de placement : les intitulés composés sont traduits aussi', () => {

  test('le montant et ses trois aides existent dans le dictionnaire', () => {
    /* CE QUE LE TEST DE COMPLETUDE NE PEUT PAS VOIR. Il cherche des appels
       `trad('...')` litteraux dans la vue. Ces cinq chaines-la n'existent
       qu'apres evaluation — un gabarit dont le debut depend d'un ternaire, et
       les trois branches d'un autre — donc elles lui sont invisibles, et elles
       s'affichaient en francais a un lecteur anglophone.

       Elles se verifient ici une par une, en clair. Une liste ecrite a la main
       est ce qu'on peut faire de mieux tant que la vue compose ses intitules :
       c'est aussi le rappel que composer un intitule le sort du filet. */
    /* Les deux styles de guillemets, parce que le dictionnaire emploie les
       deux. Ne chercher que le double donne une clef presente pour absente, et
       la declarer une seconde fois la ferait gagner en silence sur la
       premiere — exactement ce que le controle des doublons interdit. */
    const dico = lireSource('assets/i18n.js');
    const declaree = cle => dico.includes('"' + cle + '":')
      || dico.includes("'" + cle + "':");
    for (const cle of ['Valeur aujourd’hui ({dev})', 'Valeur estimée ({dev})',
                       'ce que la ligne vaut, capital et intérêts courus compris',
                       'ton estimation du jour : ce n’est pas un prix de vente, le produit réel se saisit à la cession',
                       'la dernière valeur liquidative publiée, pour les parts que tu détiens'])
      vrai(declaree(cle), 'traduit : ' + cle.slice(0, 40));
  });

  test('les deux intitulés composés sont bien ceux que la vue fabrique', () => {
    /* Une clef recopiee de travers ne casse rien de visible : elle rend juste
       le francais en anglais. Le test relit donc la vue plutot que sa memoire. */
    const app = lireSource('assets/app.js');
    vrai(app.includes("${estime ? 'Valeur estimée' : 'Valeur aujourd’hui'} ({dev})"),
      'le gabarit du montant n’a pas changé de forme');
  });
});

/* ------------------------------------------------------------------
   La carte du jour se deroule, elle ne saute pas
   ------------------------------------------------------------------ */
suite('Carte du jour : le dépliement se voit', () => {

  const vue = () => lireSource('assets/app.js');
  const corps = () => {
    const app = vue();
    return app.slice(app.indexOf('function deroulerJour'),
                     app.indexOf('\n}', app.indexOf('function deroulerJour')));
  };

  test('la hauteur d’avant se relève avant le rendu, jamais après', () => {
    /* C'EST TOUT LE PROBLEME. La vue se redessine en entier a chaque geste :
       l'element mesure disparait avec elle. Relever la hauteur apres le rendu
       ne rendrait que celle d'arrivee, et il n'y aurait plus rien a relier. */
    const app = vue();
    const i = app.indexOf("'jour-detail'()");
    const act = app.slice(i, app.indexOf('\n  },', i));
    const iMesure = act.indexOf('hauteurJourLignes()');
    const iBascule = act.indexOf('jourDeplie = !jourDeplie');
    const iRendu = act.indexOf('render()');
    const iAnim = act.indexOf('deroulerJour(avant)');
    vrai(iMesure > 0, 'la hauteur se relève');
    vrai(iMesure < iBascule, 'avant que l’état ne bascule');
    vrai(iBascule < iRendu && iRendu < iAnim, 'puis on rend, puis on anime');
  });

  test('le mouvement passe par l’API d’animation, pas par une transition', () => {
    /* La vue se redessine en entier a chaque geste : aucun element ne persiste
       d'un etat a l'autre, et une transition a besoin d'une valeur d'avant que
       le moteur ait resolue. L'API recoit ses deux bornes en argument, et son
       deroulement se pilote — c'est ainsi qu'il a ete verifie, en posant
       `currentTime` plutot qu'en regardant passer. */
    const c = corps();
    vrai(/box\.animate\(/.test(c), 'la vue anime elle-même');
    vrai(/height: `\$\{hAvant\}px`/.test(c) && /height: `\$\{hApres\}px`/.test(c),
      'entre deux hauteurs mesurées');
    const css = lireSource('assets/styles.css');
    const regle = css.slice(css.indexOf('.jour-lignes.jl-deroule'));
    vrai(!/^\s*\.jour-lignes\.jl-deroule \{[^}]*transition/m.test(regle),
      'et aucune transition de hauteur ne prétend le faire à sa place');
  });

  test('le réglage système du mouvement réduit arrête tout', () => {
    const c = corps();
    vrai(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/.test(c),
      'la vue le consulte');
    /* Elle sort AVANT de poser la classe : sans mouvement, pas de rognage ni
       de cascade non plus. */
    const iMedia = c.indexOf('prefers-reduced-motion');
    const iClasse = c.indexOf("classList.add('jl-deroule')");
    vrai(iMedia > 0 && iClasse > iMedia, 'et sort avant de poser la classe');
    const css = lireSource('assets/styles.css');
    vrai(/@media \(prefers-reduced-motion: reduce\) \{\s*\.jour-lignes\.jl-deroule > \* \{ animation: none; \}/.test(css),
      'la feuille de style le dit aussi, pour l’entrée des lignes');
  });

  test('la carte est remise d’aplomb même si l’animation est annulée', () => {
    /* Un second clic pendant le mouvement annule le premier, et `finished`
       rejette. Sans le rattrapage, la classe resterait — donc `overflow:
       hidden` sur une carte a hauteur libre, c'est-a-dire rognee. */
    const c = corps();
    vrai(/anim\.finished\.catch\(\(\) => \{\}\)\.then\(/.test(c),
      'le rejet est rattrapé, et le nettoyage a lieu quand même');
    vrai(/classList\.remove\('jl-deroule'\)/.test(c), 'la classe part');
  });

  test('le rognage ne vit que pendant le mouvement', () => {
    /* En permanence, `overflow: hidden` couperait l'infobulle d'une colonne qui
       deborde du cadre. Il est donc sur la classe, que la vue retire. */
    const css = lireSource('assets/styles.css');
    vrai(/\.jour-lignes\.jl-deroule \{ overflow: hidden; \}/.test(css),
      'le rognage est porté par la classe');
    const base = css.match(/\.jour-lignes \{[^}]*\}/);
    vrai(base && !/overflow/.test(base[0]), 'et pas par la règle de base');
  });

  test('la cascade des lignes s’arrête, elle ne suit pas les vingt lignes', () => {
    /* Un decalage par ligne sur vingt lignes durerait plus longtemps que le
       depliement qu'il accompagne : les dernieres arriveraient apres que le
       bord s'est arrete. */
    const css = lireSource('assets/styles.css');
    vrai(/:nth-child\(n\+4\) \{ animation-delay: 110ms; \}/.test(css),
      'au-delà de la troisième, toutes partagent le même retard');
    vrai(/@keyframes jour-entre/.test(css), 'et l’entrée existe');
  });

  test('rien ne bouge quand la hauteur ne change pas', () => {
    /* Le bouton reste affiche meme quand tout est deja montre : le detail
       porte des colonnes que la version compacte n'a pas. Si les deux hauteurs
       se valent, animer de x a x poserait la classe pour rien. */
    vrai(/Math\.abs\(hApres - hAvant\) < 1\) return;/.test(corps()),
      'un écart nul ne déclenche pas d’animation');
    vrai(/typeof box\.animate !== 'function'/.test(corps()),
      'et un navigateur sans l’API se contente du saut');
  });
});

/* ------------------------------------------------------------------
   Une plus-value se calcule sur deux montants connus, ou ne se dit pas
   ------------------------------------------------------------------ */
suite('Plus-value latente : deux montants connus, ou rien', () => {

  /* Le fixture ne porte pas de participation : celle-ci est montee ici, avec
     des montants inventes pour l'occasion. */
  const placement = ligne => {
    Fixture.poser();
    const c = { id: 'pe_test', etabId: Store.state.etabs[0].id, type: 'pe',
      statut: 'ouvert', libelle: 'Participation', court: 'Participation',
      ouvertLe: '2025-01-01', numero: '', notes: '', alloc: '', cash: [],
      lignes: [Object.assign({ id: 'lg', classe: 'nonCote',
                               libelle: 'Parts' }, ligne)] };
    Store.state.comptes.push(c);
    return lignesDe(c)[0];
  };

  test('un gain se dit en euros et en pourcentage', () => {
    const p = perfLigne(placement({ parts: 7529, valeur: 10000, prixDeRevient: 9000 }));
    pres(p.pnl, 1000, 'mille euros de plus qu’à l’achat');
    pres(p.pct, 11.1111, 'soit onze pour cent');
  });

  test('une perte garde son signe, des deux côtés', () => {
    const p = perfLigne(placement({ parts: 7529, valeur: 10000, prixDeRevient: 12000 }));
    pres(p.pnl, -2000, 'deux mille euros de moins');
    pres(p.pct, -16.6667, 'et le pourcentage est négatif lui aussi');
  });

  test('un coût jamais renseigné ne fait pas un gain égal à toute la valeur', () => {
    /* LA REGRESSION QUE CE TEST TIENT. Le garde d'origine cherchait `null` et
       chaine vide sur les champs de la ligne. Or `lignesDe` les rend toujours
       numeriques : un cout absent arrive ici en zero, et la soustraction
       annoncait dix mille euros de plus-value sur un placement dont personne
       n'a dit ce qu'il avait coute. */
    const l = placement({ parts: 7529, valeur: 10000 });
    eq(num(l.prixDeRevient), 0, 'le modèle rend bien zéro, et non une absence');
    eq(l.acquisition.total, null, 'mais l’acquisition, elle, dit que le coût est inconnu');
    const p = perfLigne(l);
    eq(p.pnl, null, 'aucune plus-value ne s’affiche');
    eq(p.pct, null, 'ni aucun pourcentage');
  });

  test('une valeur pas encore saisie ne s’entend pas dire qu’elle a tout perdu', () => {
    /* Meme cause, autre sens : zero en valeur donnerait moins cent pour cent. */
    const p = perfLigne(placement({ parts: 7529, prixDeRevient: 9000 }));
    eq(p.pnl, null, 'rien tant que la valeur du jour n’est pas connue');
    eq(p.pct, null, 'et surtout pas −100 %');
  });

  test('deux montants connus et égaux font un vrai zéro, qui s’affiche', () => {
    const p = perfLigne(placement({ parts: 7529, valeur: 9000, prixDeRevient: 9000 }));
    eq(p.pnl, 0, 'zéro se dit, parce qu’il est mesuré');
    eq(p.pct, 0, 'et le pourcentage aussi');
  });

  test('un coût nul déclaré donne un montant, jamais un pourcentage', () => {
    /* Une part recue, une attribution gratuite : la plus-value en euros est
       parfaitement calculable, le pourcentage ne l'est pas. Diviser rendrait
       `Infinity`, que rien n'affiche. */
    const p = perfLigne({ acquisition: { total: 0 }, prixDeRevient: 0, valeur: 5000 });
    pres(p.pnl, 5000, 'cinq mille euros gagnés sur une part reçue');
    eq(p.pct, null, 'et aucun pourcentage inventé');
    vrai(Number.isFinite(p.pnl), 'le montant reste un nombre fini');
  });

  test('une quote-part invalide écarte la ligne au lieu de l’aplatir', () => {
    /* Hors de [0, 100], la part detenue n'est pas connue : `lignesDe` met
       alors valeur et cout a zero pour ne pas polluer les totaux, et zero moins
       zero ferait un placement parfaitement plat. */
    const l = placement({ parts: 7529, valeur: 10000, prixDeRevient: 9000, part: 150 });
    vrai(l.partInvalide, 'la quote-part n’est pas lisible');
    eq(perfLigne(l).pnl, null, 'donc aucune plus-value ne se calcule');
  });

  test('une ligne de marché se juge sur le coût rendu par le courtier', () => {
    /* Ces lignes-la n'ont pas de detail d'acquisition : zero y vaut absence. */
    pres(perfLigne({ prixDeRevient: 800, valeur: 1000 }).pnl, 200, 'deux cents de plus');
    eq(perfLigne({ prixDeRevient: 0, valeur: 1000 }).pnl, null, 'et sans coût, rien');
    eq(perfLigne(null).pnl, null, 'aucune ligne, aucune plus-value');
  });

  test('le calcul vit dans le modèle, la vue ne le refait pas', () => {
    const app = lireSource('assets/app.js');
    const d = app.slice(app.indexOf('function detailsPlacement'),
                        app.indexOf('\n}', app.indexOf('function detailsPlacement')));
    eq((d.match(/perfLigne\(l\)/g) || []).length, 1, 'la vue demande, une fois');
    vrai(!/valeur\s*-\s*.*prixDeRevient/.test(d), 'et ne soustrait rien elle-même');
  });
});

/* ------------------------------------------------------------------
   Le prix d'une part s'affiche arrondi, le total reste celui qui est saisi
   ------------------------------------------------------------------ */
suite('Parts de société : le total saisi ne se reconstruit jamais', () => {

  test('les deux prix unitaires se déduisent du même nombre de parts', () => {
    const u = prixParPart({ parts: 7529, valeur: 10000, prixDeRevient: 9000 });
    pres(u.parts, 7529, 'le nombre de parts');
    pres(u.valeur, 1.3282, 'un peu plus d’un euro trente la part');
    pres(u.revient, 1.1954, 'contre un euro dix-neuf payés');
  });

  test('le prix unitaire s’écrit au centime, comme partout ailleurs', () => {
    /* `fmtPart` est la regle deja en place : deux decimales au-dessus du
       centime, quatre en dessous. Une part a 1,3282 EUR s'ecrit donc 1,33 EUR,
       et c'est precisement pourquoi le total ne se reconstruit pas depuis
       elle : 7 529 fois 1,33 fait 10 013 EUR, et non les 10 000 saisis. */
    const u = prixParPart({ parts: 7529, valeur: 10000, prixDeRevient: 9000 });
    vrai(/1[.,]33/.test(fmtPart(u.valeur)), 'arrondi au centime : ' + fmtPart(u.valeur));
    vrai(Math.abs(7529 * 1.33 - 10000) > 10, 'le produit arrondi s’écarte du montant saisi');
  });

  test('la carte affiche le montant saisi, pas le produit du prix unitaire', () => {
    const app = lireSource('assets/app.js');
    const d = app.slice(app.indexOf('function detailsPlacement'),
                        app.indexOf('\n}', app.indexOf('function detailsPlacement')));
    vrai(/fmtEUR\(l\.valeur\)/.test(d), '« Valeur actuelle » rend la valeur de la ligne');
    vrai(!/u\.valeur\s*\*|u\.parts\s*\*/.test(d), 'et rien ne multiplie un prix unitaire');
  });

  test('zéro part ne produit ni division ni ligne vide', () => {
    eq(prixParPart({ parts: 0, valeur: 10000, prixDeRevient: 9000 }), null,
      'aucun prix unitaire sans parts');
    const p = perfLigne({ acquisition: { total: 9000 }, prixDeRevient: 9000, valeur: 10000 });
    pres(p.pnl, 1000, 'la plus-value, elle, n’a pas besoin des parts');
  });

  test('une part à moins d’un centime garde ses quatre décimales dans la carte', () => {
    const u = prixParPart({ parts: 2000000, valeur: 2400, prixDeRevient: 2400 });
    vrai(/0[.,]0012/.test(fmtPart(u.valeur)), 'lisible au dix-millième : ' + fmtPart(u.valeur));
  });
});

/* ------------------------------------------------------------------
   Une seule carte pose la question de ce qu'on detient
   ------------------------------------------------------------------ */
suite('Fiche d’une participation : la valeur d’un côté, l’identité de l’autre', () => {

  const vue = () => lireSource('assets/app.js');
  const corps = () => {
    const app = vue();
    return app.slice(app.indexOf('function detailsPlacement'),
                     app.indexOf('\n}', app.indexOf('function detailsPlacement')));
  };

  test('le type décide, pas un identifiant écrit dans la vue', () => {
    /* Deux types portent le drapeau, et la carte les sert tous les deux. */
    const avecParts = TYPES_COMPTE.filter(t => t.parts).map(t => t.id).sort();
    eq(avecParts.join(','), 'fondsNonCote,pe', 'les deux types qui se divisent en parts');
    /* IL N'Y A PLUS D'AIGUILLAGE : les quatre actifs terminaux rendent la meme
       carte, et c'est la LIGNE qui s'efface quand elle n'a pas d'objet. Un
       branchement sur `t.parts` avait donne deux presentations a la meme
       question, et deux placements non cotes du meme portefeuille ne se lisaient
       pas de la meme façon. */
    vrai(/return detailsPlacement\(c, idx, t, seule\);/.test(vue()),
      'la carte est la même pour tous');
    vrai(!/if \(t\.parts\) return/.test(vue()),
      'et le drapeau des parts ne choisit plus une présentation');
  });

  test('un actif sans parts trouve ses lignes, et pas celles des autres', () => {
    /* Un pret participatif n'a ni parts ni prix unitaire ; il a un prix d'achat,
       une valeur, un ecart, un taux, une echeance et un statut. Il avait une
       ligne de liste en guise de carte, et aucun de ces intitules. */
    const app = vue();
    const carte = app.slice(app.indexOf('function detailsPlacement'),
                            app.indexOf('\n}', app.indexOf('function detailsPlacement')));
    /* SANS PARTS, LE PRIX SE LIT EN TOTALITE ; avec des parts, les deux lignes
       a l'unite le disent deja et un total serait la meme chose deux fois. */
    vrai(/ligne\(trad\('Prix d’achat'\), u \? null/.test(carte),
      'le prix total ne paraît que faute de parts');
    vrai(/ligne\(trad\('Parts détenues'\), u \? fmtNombre\(u\.parts\) : null\)/.test(carte),
      'et les parts ne paraissent que s’il y en a');
    /* Les faits d'un pret prennent chacun leur ligne, au lieu d'un sous-titre. */
    for (const fait of ['Taux annoncé', 'Échéance', 'Statut']) {
      vrai(carte.includes(`trad('${fait}')`), `« ${fait} » a sa ligne`);
    }
    vrai(/statutLigne\(l\) === 'encours'\s*\n?\s*\? null/.test(carte),
      'et un prêt en cours ne dit pas son statut, qui n’apprendrait rien');
    const pret = TYPES_COMPTE.find(t => t.id === 'crowdfunding');
    vrai(pret.terminal && !pret.parts, 'et un prêt participatif est bien de ceux-là');
  });

  test('« Informations » paraît sur toutes les fiches, sans exception', () => {
    /* ELLE SE TAISAIT SUR UN ACTIF EN PARTS, ou la carte de valeur avait absorbe
       ses lignes. Deux consequences, vues a l'ecran : le nom et le type d'une
       part de societe ne se lisaient nulle part, et son bouton « Modifier » se
       trouvait sur une autre carte que partout ailleurs. Un geste qui change de
       place d'un ecran a l'autre se cherche a chaque fois. */
    vrai(!/\$\{t\.parts && seule \? '' : `/.test(vue()),
      'plus aucune condition ne la fait disparaître');
    const v = vue();
    const i = v.indexOf("trad('Informations')");
    vrai(i > 0 && /data-action="modifier-compte"/.test(v.slice(i, i + 400)),
      'et c’est elle qui porte « Modifier », sur toutes les fiches');
  });

  test('chaque bouton dit ce qu’il ouvre, et aucun ne redit l’autre', () => {
    /* Deux boutons identiques que rien ne distinguait, c'etait le defaut de
       depart ; le nommer suffit a le lever, et c'est ce qui permet a
       « Informations » de reprendre le sien.

       LA REGLE EST « AUCUN NE REDIT L'AUTRE », ET NON « IL N'Y EN A QU'UN ». Ce
       controle comptait les boutons, ce qui revenait a interdire le second
       quelle que soit sa raison d'etre. La sortie du placement en est un, et il
       ne ressemble a rien de ce qui existait : l'un corrige ce que le placement
       vaut, l'autre l'enleve du patrimoine. */
    const d = corps();
    eq((d.match(/data-action="editer-placement"/g) || []).length, 1,
      'qui ouvre les parts et la valeur');
    eq((d.match(/data-action="ceder-placement"/g) || []).length, 1,
      'et une seule porte de sortie, qui n’est pas la même chose');
    /* Un acte se nomme par son acte, et le mot suit la nature : un pret ne se
       vend pas, il se rembourse. */
    vrai(/trad\(t\.prete \? 'Remboursement' : 'Céder'\)/.test(d),
      'la sortie porte le nom de ce qu’elle fait, dans les mots du type');
    /* Et son nom suit le type : « Parts et valeur » n'aurait rien voulu dire
       sur un pret participatif, qui n'a pas de parts. */
    vrai(/trad\(t\.parts \? 'Parts et valeur' : 'Valeur et prix d’achat'\)/.test(d),
      'et il le dit, dans les mots du type');
    vrai(!/trad\('Modifier'\)/.test(d),
      'il ne s’appelle plus « Modifier », qui ne disait pas quoi');
    /* L'identite a la sienne : ce chemin-ci ne double plus l'autre. */
    eq((d.match(/data-action="modifier-compte"/g) || []).length, 0,
      'et le nom, le type et les dates ne se modifient plus depuis ici');
  });

  test('le nom, le type et la classe ne se répètent pas sous le bandeau', () => {
    const d = corps();
    vrai(!/c\.libelle|c\.court/.test(d), 'le nom du compte n’est pas réécrit');
    vrai(!/trad\(t\.label\)/.test(d), 'ni son type');
  });

  test('la carte de valeur ne dit plus que ce que l’actif vaut', () => {
    /* Elle portait aussi la note, le numero et les deux dates : tout ce qui fait
       l'identite d'un compte, absorbe le jour ou elle remplaçait deux cartes
       redondantes. Ces lignes sont revenues dans « Informations », ou elles
       vivent pour tous les autres types. */
    const d = corps();
    vrai(!/<input|<textarea/.test(d), 'aucun champ de saisie dans la carte');
    for (const parti of ['c.notes', 'c.numero', 'c.clotureLe', 'motDateCompte']) {
      vrai(!d.includes(parti), `« ${parti} » a rejoint la carte d’identité`);
    }
    /* Ce qui reste est ce qu'on vient y chercher : combien j'en ai, ce que ça
       vaut, ce que je l'ai paye, et ce que cela fait. */
    for (const reste of ['Parts détenues', 'Valeur estimée / part', 'Valeur actuelle',
                         'Plus-value latente']) {
      vrai(d.includes(reste), `« ${reste} » y reste`);
    }
  });

  test('une ligne sans réponse ne se rend pas', () => {
    /* « 0 EUR la part » sur un placement sans parts serait une mesure
       inventee ; l'absence de ligne, elle, ne dit rien de faux. */
    const d = corps();
    vrai(/const ligne = \(dt, dd\) => \(dd == null \|\| dd === '' \? ''/.test(d),
      'le rendu d’une ligne dépend de sa valeur');
  });

  test('le coût inconnu se dit, il ne s’affiche pas en zéro', () => {
    const d = corps();
    vrai(/trad\('à renseigner'\)/.test(d), 'le prix d’achat manquant s’annonce');
    vrai(!/fmtEUR\(0\)|fmtPart\(0\)/.test(d), 'et aucun zéro n’est écrit à la place');
  });

  test('les deux mesures déduites disent qu’elles sont des estimations', () => {
    /* Ce placement n'est pas cote : un prix unitaire y est une division, pas
       un cours, et une plus-value latente n'est pas encaissee. */
    const d = corps();
    /* Trois maintenant : la troisieme est celle d'un pret, ou l ecart n est pas
       une plus-value — il vient des interets courus, il s encaisse au
       remboursement, et un defaut peut le ramener a zero. Le calcul est le meme,
       le fait ne l est pas, et le mot suit le fait. */
    /* Quatre : la valeur estimee porte la sienne depuis qu'elle se nomme ainsi,
       une estimation n'etant pas un prix de vente. */
    eq((d.match(/aide\(trad\(/g) || []).length, 4, 'quatre bulles, trois mesures déduites et une estimation');
    vrai(/pas un prix de vente/.test(d), 'l’estimation dit qu’elle n’est pas un prix de vente');
    vrai(/n’est pas coté/.test(d), 'la première rappelle que rien n’est coté');
    vrai(/à la revente/.test(d), 'la seconde, que rien n’est encaissé');
    vrai(/au remboursement/.test(d), 'et celle d’un prêt, qu’il faut être remboursé');
    vrai(/t\.prete/.test(d), 'le mot se choisit sur le drapeau du type, pas sur son nom');
  });

  test('la réserve d’impôt se dit là où le chiffre imposable se lit', () => {
    /* AUCUN CALCUL, UNE MENTION. L'application ne modélise aucun régime fiscal
       — elle le dit déjà pour l'immobilier, « micro-foncier, réel, meublé, SCI,
       les règles changent et une estimation automatique finirait par mentir ».
       Tout ce qu'elle affiche est donc avant impôt.

       D'où la place choisie : la PLUS-VALUE, qui est le chiffre que l'impôt
       mordrait, et non le montant du compte. Écrite sous un seul montant, la
       mention laisserait croire que les autres en sont nets — c'est la faute
       que ce projet a déjà payée ailleurs, un même libellé qui ne compte pas
       la même chose selon l'écran. */
    const d2 = corps();
    vrai(/Aucun impôt n’en est déduit/.test(d2),
      'la bulle de la plus-value latente le dit');
    vrai(/aucun régime fiscal/.test(d2), 'et dit pourquoi : rien n’est modélisé');
    /* Le meme chiffre s'examine ailleurs pour les lignes cotees : l'apercu de la
       plus-value latente porte la meme reserve, en trois mots. */
    const app = vue();
    const dp = app.indexOf('pnlLatent: () => {');
    vrai(/trad\('avant impôt'\)/.test(app.slice(dp, app.indexOf('cta:', dp))),
      'et l’aperçu de la plus-value latente aussi');
    vrai(!!I18N.en['avant impôt'], 'la mention existe en anglais');
    /* ET AUCUN CALCUL N'EST NE AVEC ELLE : pas de taux, pas d'abattement, pas de
       montant d'impot. Une mention qui deviendrait une estimation serait pire
       que le silence, parce qu'elle aurait l'air d'un chiffre verifie. */
    vrai(!/flatTax|prelevementsSociaux|impotLatent|\b0\.3 \* pnl/.test(app),
      'aucun taux, aucun montant d’impôt n’est calculé');
  });

  test('le financement reste une carte à part', () => {
    /* Une dette n'est pas un detail du placement : elle se lit et se saisit
       ailleurs, et la fusion ne l'a pas absorbee. */
    const app = vue();
    vrai(!/Financement/.test(corps()), 'la carte fusionnée ne parle pas de crédit');
    vrai(/trad\('Financement'\)/.test(app), 'mais la fiche, elle, en parle toujours');
  });

  test('la liquidité et les dates viennent du modèle, sans être recalculées', () => {
    const d = corps();
    /* ELLE SE REGLE, ET PAS SEULEMENT SUR L'AUTRE CARTE. Un placement en
       parts rend `detailsPlacement`, les autres actifs terminaux rendent
       `lignePlacement` : seule la seconde portait le menu, donc une part de
       société affichait « Bloqué » sans qu'aucun écran ne permette de le
       démentir — et c'est précisément le cas que le réglage existe pour
       couvrir : un non coté qui se revend sur un marché secondaire n'est pas
       bloqué. Vu à l'écran. */
    vrai(/champMobilite\(l, c, true\)/.test(d), 'la liquidité est demandée, et réglable');
    /* La date, elle, a rejoint « Informations » avec le reste de l'identite :
       elle est verifiee la-bas, y compris son invitation a se remplir. */
    vrai(!/motDateCompte\(t\)/.test(d),
      'la date ne vit plus sur la carte de valeur');
  });

  test('le menu de disponibilité n’existe qu’une fois', () => {
    /* Deux listes d'options écrites à la main pour une seule vérité finissent
       par diverger, et celle qu'on oublie de changer dit le contraire de
       l'autre. Les deux cartes appellent donc le même helper. */
    const app = vue();
    eq((app.match(/<select data-path="\$\{esc\(l\.refMobilite\)\}"/g) || []).length, 1,
      'un seul menu dans toute l’application');
    eq((app.match(/function champMobilite\(/g) || []).length, 1,
      'et un seul helper qui le pose');
    const h = app.slice(app.indexOf('function champMobilite('),
                        app.indexOf('function lignePlacement('));
    vrai(/if \(!editable \|\| !l\.refMobilite\) return badge;/.test(h),
      'sans droit d’écrire, il ne rend que la pastille');
    vrai(/data-path="\$\{esc\(l\.refMobilite\)\}"/.test(h),
      'et le réglage s’écrit à la frappe, par son chemin');
  });


  test('tout ce qui s’affiche est traduit', () => {
    /* La regle de la maison : une chaine nait dans `trad()`. */
    const d = corps();
    const nus = d.match(/<dt>(?!\$\{)[^<]+<\/dt>/g) || [];
    eq(nus.length, 0, 'aucun intitulé écrit en dur : ' + nus.join(' | '));
  });
});

/* ------------------------------------------------------------------
   Les fiches d'Apercu disent la categorie, pas l'inventaire
   ------------------------------------------------------------------ */
suite('Fiches d’Aperçu : une catégorie se lit sans dérouler son inventaire', () => {

  test('les actifs de marché se groupent, et les groupes font le total', () => {
    /* La regle de la maison : un total egale la somme de ses parts. Le fixture
       porte un ETF et une ligne d'or, donc deux classes. */
    Fixture.poser();
    const g = classesDeMarche();
    pres(g.reduce((s, x) => s + x.valeur, 0), patrimoine().classes.actions,
      'les groupes font la poche « Actifs de marché »');
    eq(g.length, 2, 'deux classes présentes');
    eq(g[0].label, ASSET_CLASSES.actions, 'la plus grosse en tête');
    eq(g[1].cle, 'metaux', 'puis les métaux précieux');
    /* Et le compte de lignes est celui des lignes, pas des groupes. */
    pres(g.reduce((s, x) => s + x.n, 0), 2, 'deux lignes en tout');
  });

  test('une classe absente ne paraît pas, une classe ajoutée paraît seule', () => {
    /* Les groupes se derivent des lignes : aucune liste ecrite a la main. */
    Fixture.poser(s => { s.positions = s.positions.filter(p => p.id !== 'p_or'); });
    const g = classesDeMarche();
    eq(g.length, 1, 'plus d’or, plus de groupe « Métaux précieux »');
    vrai(!g.some(x => x.cle === 'metaux'), 'et il ne reste pas à zéro');
    pres(g.reduce((s, x) => s + x.valeur, 0), patrimoine().classes.actions,
      'la somme suit');
  });

  test('une ligne saisie à la main se range en actions', () => {
    /* Elle n'a pas de classe de marche parce qu'elle n'a pas de cotation. La
       laisser sans groupe la ferait disparaitre du detail sans quitter le
       total, exactement le defaut que cette base corrige ailleurs. */
    Fixture.poser(s => {
      s.comptes.find(c => c.id === 'c_cto').lignes = [{ id: 'l_manuel',
        classe: 'actions', libelle: 'Titre non coté en direct', valeur: 1500,
        prixDeRevient: 1500, quantite: 1, dateAcquisition: '' }];
    });
    const g = classesDeMarche();
    pres(g.reduce((s, x) => s + x.valeur, 0), patrimoine().classes.actions,
      'la ligne manuelle reste dans la somme');
    pres(g.find(x => x.cle === 'actions').valeur, 9000 + 1500,
      'et elle se range avec les actions');
  });

  test('la fiche des actifs de marché ne liste plus les titres un par un', () => {
    /* Le detail existe en entier sur Marches, avec le tri, la performance et
       les cours. Le redire ici en moins bien noyait le total. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf("if (classe === 'actions') {");
    const bloc = app.slice(i, app.indexOf('\n    }', i));
    vrai(/classesDeMarche\(\)/.test(bloc), 'la fiche lit les groupes du modèle');
    vrai(!/open-position/.test(bloc), 'aucune ligne ne mène à un titre');
    vrai(/cta: trad\('Ouvrir Marchés'\)/.test(bloc),
      'et le renvoi mène là où le détail se trouve');
  });

  test('liquidités, crypto et non coté gardent leur détail', () => {
    /* Ce que la demande conserve explicitement : les liquidites modifiables sur
       place, la crypto piece par piece, le non cote participation par
       participation. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('  classe: (classe) => {');
    const bloc = app.slice(i, app.indexOf('\n  cible:', i));
    vrai(/if \(classe === 'liquidites'\)/.test(bloc), 'les liquidités gardent leur branche');
    vrai(/data-path="comptes\.\$\{x\.ic\}\.cash\.\$\{x\.j\}\.montant"/.test(bloc),
      'et leur édition sur place');
    /* Ni la crypto ni le non cote n'ont de branche a eux : ils tombent dans le
       cas general, celui qui liste ligne par ligne. C'est ce qu'on veut, et le
       controle le dit plutot que de le supposer. */
    vrai(!/if \(classe === 'crypto'\)/.test(bloc), 'la crypto reste au détail commun');
    vrai(!/if \(classe === 'nonCote'\)/.test(bloc), 'le non coté aussi');
    /* Le detail commun liste bien ligne par ligne, avec le nom de chacune. */
    vrai(/lignes\.push\(\{ label: nomL,/.test(bloc),
      'et ce détail nomme chaque placement');
  });

  test('une liste longue se replie, et seulement si ça vaut la peine', () => {
    /* Cacher une ligne sur neuf pour offrir un bouton « voir l'autre » serait un
       geste de plus pour rien : trois lignes masquees au minimum. */
    const app = lireSource('assets/app.js');
    vrai(/const MONTREES = 8;/.test(app), 'huit lignes montrées');
    vrai(/const montrer = lignes\.length > MONTREES \+ 2 \? MONTREES : 0;/.test(app),
      'et le repli ne s’arme qu’au-delà de dix lignes');
    /* Les placements d'une categorie sont des rangees de liste, pas un tableau :
       le meme repli, porte par le gabarit des actifs. */
    vrai(/html: lignesActifs\(lignes, montrer\)/.test(app), 'la fenêtre d’une catégorie le passe à sa liste');
    vrai(/class="mlist\$\{montrer && i >= montrer \? ' apercu-surplus' : ''\}"/.test(app), 'qui masque le même surplus');
    /* Le surplus est dans le DOM, pas jete : le bouton le deplie sur place. */
    vrai(/a\.montrer && i >= a\.montrer \? ' class="apercu-surplus"' : ''/.test(app),
      'le surplus se rend, masqué');
    vrai(/data-action="apercu-voir-tout"/.test(app), 'et un bouton le déplie');
    const css = lireSource('assets/styles.css');
    vrai(/#modalBody \.apercu-surplus \{ display: none; \}/.test(css),
      'masqué par le style, pas retiré du balisage');
    vrai(/#modalBody\.tout-voir \.apercu-surplus \{ display: table-row; \}/.test(css),
      'et rendu visible par la classe du corps');
  });

  test('le repli repart fermé à chaque ouverture', () => {
    /* La classe vit sur le corps de la fenetre, qui est le meme noeud d'une
       fiche a l'autre : sans remise a zero, une fiche depliee laissait la
       suivante grande ouverte. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('function openApercu(');
    const bloc = app.slice(i, app.indexOf("$('#modalBody').innerHTML", i));
    vrai(/classList\.remove\('tout-voir'\)/.test(bloc),
      'l’ouverture referme le pli');
  });

  test('chaque fiche annonce son total et son poids', () => {
    /* Un pourcentage dit sur quelle base il est calcule. La note vit dans le
       rendu commun : toutes les fiches la portent, aucune ne peut l'oublier. */
    const app = lireSource('assets/app.js');
    vrai(/const noteApercu = a => a\.totalNote/.test(app), 'la note se compose une fois');
    vrai(/a\.total \/ patrimoine\(\)\.brut \* 100/.test(app),
      'et le poids se rapporte aux avoirs');
    const i = app.indexOf('function openApercu(');
    const bloc = app.slice(i, app.indexOf('modal-champs', i));
    vrai(/<div class="modal-total"><b>\$\{a\.totalTexte \|\| fmtEUR\(a\.total\)\}<\/b>/.test(bloc),
      'le total est en tête de chaque fiche');
    vrai(/escMontant\(noteApercu\(a\)\)/.test(bloc), 'et son poids juste à côté');
  });
});

/* ------------------------------------------------------------------
   Le bandeau mesure la grandeur qu'il affiche, et rien d'autre
   ------------------------------------------------------------------ */
suite('Bandeau de l’Aperçu : net ou brut, jusqu’au bout', () => {

  const AUJ = '2026-08-30';
  /* Une scene entierement maitrisee : un compte, une dette d'etablissement,
     des releves. Les montants sont inventes pour l'occasion. */
  const scene = ({ brut, dette = 0, releves = [] }) => Fixture.poser(s => {
    s.etabs = [{ id: 'e', nom: 'Banque', notes: '',
      dettes: dette ? [{ id: 'd', libelle: 'Prêt', montant: dette, note: '' }] : [] }];
    s.comptes = [{ id: 'c', etabId: 'e', type: 'courant', statut: 'ouvert',
      ouvertLe: '2020-01-01', numero: '', notes: '', libelle: 'Compte',
      court: 'Compte', alloc: '', cash: [{ montant: brut, affectation: 'courant' }],
      lignes: [] }];
    s.positions = [];
    s.monthly = releves.map(([date, avoirs, d]) =>
      ({ date, comment: '', dettes: d || 0, v: { c: avoirs } }));
  });

  const vue = () => lireSource('assets/app.js');
  const bandeau = () => {
    const app = vue();
    return app.slice(app.indexOf('<div class="hero">'),
                     app.indexOf('${blocVariation}'));
  };

  test('A. en brut, l’intitulé dit « patrimoine brut » et rien ne parle de dette', () => {
    const h = bandeau();
    vrai(/trad\(evoNet \? 'Patrimoine net' : 'Patrimoine brut'\)/.test(h),
      'les deux intitulés sont là, commandés par la bascule');
    /* UN FAIT, UN ENDROIT. Une ligne « dont X de credits a rembourser » vivait
       sous le grand chiffre en mode brut. Elle disait vrai, et la carte de
       repartition juste dessous le disait deja. */
    vrai(!/crédits à rembourser|hero-sous/.test(h), 'aucune dette sous le grand chiffre');
    vrai(!/patrimoine\(\)\.dettes/.test(h), 'et le bandeau ne va même plus la chercher');
    const dico = lireSource('assets/i18n.js');
    vrai(dico.includes('"Patrimoine brut": "Total assets"'),
      'l’anglais dit « Total assets », pas « wealth »');
  });

  test('B. en net, l’intitulé dit « patrimoine net »', () => {
    const dico = lireSource('assets/i18n.js');
    vrai(dico.includes('"Patrimoine net": "Net worth"'), 'et l’anglais dit « Net worth »');
    /* Sans centimes, comme la carte de composition juste dessous : le formateur
       change, la source non. */
    vrai(/hero-value">\$\{fmtEUR0\(evoNet \? t\.total : t\.brut\)\}/.test(bandeau()),
      'le grand chiffre reste celui qui existait, sans recalcul');
  });

  test('C. le delta brut se compte sur les avoirs, et son pourcentage avec', () => {
    scene({ brut: 453770, releves: [['2025-08-01', 390656]] });
    const v = variationAn(AUJ, false);
    pres(v.eur, 63114, 'la variation des avoirs');
    pres(v.avant, 390656, 'depuis les avoirs de l’époque');
    pres(v.pct, 16.1556, 'et le pourcentage suit la même base');
    eq(v.mois, 12, 'douze mois pleins');
  });

  test('D. le delta net diffère du delta brut dès qu’un crédit se rembourse', () => {
    /* 50 000 d'avoirs en plus et 40 000 de capital rembourse : le brut monte de
       ce que valent les actifs, le net monte aussi de ce qu'on ne doit plus.
       Reutiliser le meme nombre pour les deux attribuerait aux marches ce que
       le remboursement a fait. */
    scene({ brut: 453770, dette: 60000, releves: [['2025-08-01', 390656, 100000]] });
    const brut = variationAn(AUJ, false);
    const net = variationAn(AUJ, true);
    pres(brut.eur, 63114, 'le brut ne voit que les avoirs');
    pres(net.eur, 103114, 'le net y ajoute les 40 000 de capital remboursé');
    vrai(Math.abs(net.eur - brut.eur) > 1, 'les deux ne se confondent pas');
    pres(net.avant, 290656, 'la base nette est celle du relevé, crédits déduits');
    vrai(/variationAn\(todayISO\(\), evoNet\)/.test(vue()),
      'et la vue demande bien celle de la grandeur affichée');
  });

  test('E. une base à zéro donne un montant, jamais un pourcentage', () => {
    /* Diviser par zero rendrait l'infini, que rien n'affiche. Le montant, lui,
       est parfaitement mesure. */
    scene({ brut: 10000, releves: [['2025-08-01', 0]] });
    const v = variationAn(AUJ, false);
    pres(v.eur, 10000, 'le montant se dit');
    eq(v.pct, null, 'le pourcentage se tait');
  });

  test('F. une base négative ne produit pas de pourcentage trompeur', () => {
    /* Un patrimoine net sous l'eau apres un achat a credit : le rapport change
       de signe, et un redressement s'afficherait comme une baisse. */
    scene({ brut: 200000, releves: [['2025-08-01', 100000, 150000]] });
    const v = variationAn(AUJ, true);
    pres(v.avant, -50000, 'la base nette était négative');
    pres(v.eur, 250000, 'le redressement se dit en euros');
    eq(v.pct, null, 'et aucun pourcentage ne vient le contredire');
  });

  test('G. moins de douze mois d’historique : la période réelle s’affiche', () => {
    /* « 12 derniers mois » sous une comparaison qui en couvre six serait le
       meme mensonge que sous quatre. L'age du releve retenu est ce qui
       s'ecrit, et la tolerance de plus ou moins trois mois le rend necessaire :
       un point de quinze mois ne s'annonce pas comme douze. */
    scene({ brut: 10000, releves: [['2026-02-01', 8000]] });
    eq(variationAn(AUJ, false).mois, 6, 'six mois, et l’intitulé le dira');
    scene({ brut: 10000, releves: [['2025-05-01', 8000]] });
    eq(variationAn(AUJ, false).mois, 15, 'quinze mois retenus dans la tolérance');
    const app = vue();
    /* LE NOMBRE RESTE CELUI DU MOTEUR. « Glissants » dit que la fenêtre se
       termine aujourd'hui, pas qu'elle fait douze mois : écrire « 12 » sous une
       comparaison qui en couvre quinze serait le même mensonge que l'écrire
       sous quatre. */
    /* ET LA PERIODE SE DATE : le releve de depart se nomme par son mois, puis
       le nombre de mois suit, celui du moteur. */
    vrai(/trad\('depuis le relevé de \{m\}'\)\.replace\('\{m\}', esc\(fmtMonth\(varAn\.depuis\)\)\)/.test(app),
      'la vue date la variation par son relevé de départ');
    vrai(/varAn\.mois\} \$\{trad\('mois'\)\}/.test(app), 'et écrit le nombre de mois qu’on lui donne');
    const dico = lireSource('assets/i18n.js');
    vrai(dico.includes('"depuis le relevé de {m}": "since the {m} statement"'),
      'l’anglais dit la date à sa façon, sans calquer le français');
  });

  test('H. aucun historique exploitable, aucun faux zéro', () => {
    scene({ brut: 10000, releves: [] });
    eq(variationAn(AUJ, false), null, 'rien à comparer');
    eq(variationAn(AUJ, true), null, 'dans les deux modes');
    scene({ brut: 10000, releves: [['2026-08-01', 9000]] });
    eq(variationAn(AUJ, false), null, 'un relevé du mois en cours ne mesure rien');
  });

  test('I et J. la couleur vient du signe, et le zéro est neutre', () => {
    scene({ brut: 8000, releves: [['2025-08-01', 10000]] });
    vrai(variationAn(AUJ, false).eur < 0, 'une baisse est négative');
    scene({ brut: 10000, releves: [['2025-08-01', 10000]] });
    eq(variationAn(AUJ, false).eur, 0, 'et un patrimoine stable rend zéro');
    /* `cls` vit dans la vue, que le harnais ne charge pas : la regle se lit
       donc a la source, et la palette dans la feuille de style. */
    const app = vue();
    vrai(/<b class="\$\{cls\(varAn\.eur\)\}">/.test(app), 'le signe commande la classe');
    const css = lireSource('assets/styles.css');
    for (const r of [/^\.up \{ color: var\(--good-text\); \}/m,
                     /^\.down \{ color: var\(--critical\); \}/m,
                     /^\.flat \{ color: var\(--muted\); \}/m])
      vrai(r.test(css), 'la palette existante sert : ' + r.source.slice(0, 12));
  });

  test('K. les quatre chaînes du bandeau se traduisent', () => {
    const dico = lireSource('assets/i18n.js');
    const declaree = cle => dico.includes('"' + cle + '":') || dico.includes("'" + cle + "':");
    for (const cle of ['depuis le relevé de {m}', 'mois',
                       'Patrimoine net', 'Patrimoine brut'])
      vrai(declaree(cle), 'traduit : ' + cle);
    /* L'anglais dit la même chose sans calquer le français : « since the Sep 25
       statement », et non « since the statement of Sep 25 ». */
    eq(I18N.en['depuis le relevé de {m}'], 'since the {m} statement',
      'et la date anglaise se lit naturellement');
    vrai(I18N.en['depuis le relevé de {m}'].includes('{m}'), 'en gardant sa marque');
    /* L'infobulle nomme ce qui fait bouger le chiffre, et le mot qui ne doit
       pas y etre n'y est pas : ce nombre n'est pas une performance. */
    const app = vue();
    const i = app.indexOf('const blocVariation = !varAn');
    const bloc = app.slice(i, app.indexOf('`;', app.indexOf('</div>`', i)));
    vrai(/remboursement du capital des crédits/.test(bloc),
      'le net cite le remboursement du capital');
    const iBrut = bloc.indexOf('Variation de ton patrimoine brut');
    vrai(iBrut > 0, 'le texte du brut existe');
    vrai(!/remboursement du capital/.test(bloc.slice(iBrut)),
      'le brut ne le cite pas : il ne le mesure pas');
    for (const en of ['Change in your net worth between today',
                      'Change in your total assets between today'])
      vrai(dico.includes(en), 'et l’anglais existe : ' + en.slice(0, 22));
  });

  test('le moteur patrimonial n’a pas bougé', () => {
    /* Cette passe touche a l'affichage. La convention reste celle de toute
       l'application : net = brut moins les dettes, sans fiscalite latente. */
    scene({ brut: 453770, dette: 60000, releves: [] });
    const p = patrimoine();
    pres(p.brut, 453770, 'le brut est la valeur des avoirs');
    pres(p.dettes, 60000, 'les dettes sont celles des établissements');
    pres(p.net, 393770, 'et le net est leur différence, rien de plus');
    pres(nowTotals().total, p.net, '« total » reste le patrimoine net partout');
    pres(nowTotals().brut, p.brut, 'et « brut » la valeur des avoirs');
  });
});

/* ------------------------------------------------------------------
   Une seule variation, sur douze mois glissants
   ------------------------------------------------------------------ */
suite('Variation du patrimoine : douze mois glissants, ou rien', () => {

  const idc = () => Store.state.comptes[0].id;
  const poserReleves = (paires) => {
    Fixture.poser();
    const id = idc();
    Store.state.monthly = paires.map(([d, v]) =>
      ({ date: d, comment: '', dettes: 0, v: { [id]: v } }));
  };
  const AUJ = '2026-08-30';

  test('le relevé retenu est le plus proche de douze mois', () => {
    /* « Depuis le 1er janvier » disait une chose differente en janvier et en
       decembre : trois semaines d'un cote, onze mois de l'autre. Un intitule
       dont la fenetre s'allonge toute l'annee ne se compare pas a lui-meme. */
    poserReleves([['2025-06-01', 500], ['2025-08-01', 1000], ['2026-07-01', 9000]]);
    const v = variationAn(AUJ);
    eq(v.sur, 'an', 'la fenêtre est l’année glissante');
    eq(v.depuis, '2025-08-01', 'et le relevé retenu est celui d’il y a douze mois');
    pres(v.eur, nowTotals().total - 1000, 'l’écart se compte depuis celui-là');
  });

  test('moins de douze mois d’historique : depuis le début', () => {
    poserReleves([['2026-02-01', 1000], ['2026-07-01', 9000]]);
    const v = variationAn(AUJ);
    eq(v.sur, 'debut', 'l’intitulé le dit');
    eq(v.depuis, '2026-02-01', 'et part du plus ancien');
    pres(v.eur, nowTotals().total - 1000, 'l’écart aussi');
  });

  test('un historique troué ne fabrique pas une année', () => {
    /* Un releve d'il y a trente mois, le suivant d'il y a un mois : aucun point
       a douze mois. Sans tolerance, « sur 1 an » aurait qualifie une variation
       d'un mois — le plus proche de douze parmi ce qui existe. */
    poserReleves([['2024-02-01', 500], ['2026-07-01', 9000]]);
    const v = variationAn(AUJ);
    eq(v.sur, 'debut', 'le repli est honnête');
    eq(v.depuis, '2024-02-01', 'et porte sur toute la période connue');
  });

  test('la tolérance encadre douze mois, elle ne s’étire pas', () => {
    /* Trois mois d'ecart admis de part et d'autre, bornes comprises : neuf et
       quinze mois passent, huit et seize retombent sur « depuis le debut ». */
    for (const [date, attendu] of [['2025-09-01', 'an'], ['2025-05-01', 'an'],
                                   ['2025-11-01', 'an'],
                                   ['2025-04-01', 'debut'], ['2025-12-01', 'debut']]) {
      poserReleves([[date, 1000]]);
      eq(variationAn(AUJ).sur, attendu,
        `un relevé du ${date} donne « ${attendu} »`);
    }
  });

  test('rien à comparer, rien d’affiché', () => {
    /* Un patrimoine sans historique n'a pas varie de zero : il n'a pas de
       variation connue, et « +0 € » serait une mesure inventee. */
    poserReleves([]);
    eq(variationAn(AUJ), null, 'aucun relevé');
    poserReleves([['2026-08-01', 1000]]);
    eq(variationAn(AUJ), null, 'un seul relevé, du mois en cours');
    const app = lireSource('assets/app.js');
    vrai(/const blocVariation = !varAn \? '' :/.test(app),
      'et la carte ne rend alors aucun bloc');
  });

  test('le pourcentage suit le montant, et la pastille explique', () => {
    /* La face portait « +63 114 € sur 1 an, apports inclus » : un montant, une
       fenetre et une reserve se partageaient la meme ligne. La reserve descend
       dans l'infobulle, ou elle se lit en entier quand on se la demande, au
       lieu d'etre servie a tout le monde en permanence. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('const blocVariation = !varAn');
    const bloc = app.slice(i, app.indexOf('`;', app.indexOf('</div>`', i)));
    vrai(/fmtSignedPct\(varAn\.pct, 1\)/.test(bloc), 'le pourcentage est là, à une décimale');
    vrai(/varAn\.pct == null \? ''/.test(bloc), 'et il s’efface quand il ne veut rien dire');
    vrai(/aide\(trad\(evoNet/.test(bloc), 'la pastille suit la grandeur choisie');
    vrai(!/apports inclus/.test(bloc), 'la réserve n’est plus sur la face');
    /* Ce nombre melange ce qu'on a verse et ce que les marches ont fait : le
       nommer performance serait promettre une mesure que rien ne calcule. */
    /* LE MOT « PERFORMANCE » N'EST PAS INTERDIT, IL EST RETOURNE. Le nombre
       mélange ce qu'on a versé et ce que les marchés ont fait : le NOMMER
       performance promettrait une mesure que rien ne calcule, mais dire qu'il
       n'en est pas une est exactement ce qui lève la confusion. Un « +127,7 % »
       se lit spontanément comme un rendement de placement.
       La distinction vit dans la bulle, jamais sur la face de la carte : un
       second intitulé encombrerait le seul chiffre qu'on vient lire. */
    const face = bloc.slice(0, bloc.indexOf('aide('));
    vrai(!/performance|rendement/i.test(face), 'la face ne nomme aucune performance');
    vrai(/ce n’est pas la performance de tes placements/.test(bloc),
      'et la bulle dit explicitement que ce n’en est pas une');
    vrai(/it is not your investment performance/.test(lireSource('assets/i18n.js')),
      'dans les deux langues');
  });

  test('deux lignes, et le montant tient la première', () => {
    /* Le montant d'abord parce que c'est lui qu'on lit ; le pourcentage colle a
       lui parce qu'il le qualifie ; la fenetre dessous en gris parce qu'elle ne
       se lit qu'une fois. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('const blocVariation = !varAn');
    const bloc = app.slice(i, app.indexOf('`;', app.indexOf('</div>`', i)));
    const iMontant = bloc.indexOf('fmtSigned(varAn.eur)');
    const iPct = bloc.indexOf('fmtSignedPct(varAn.pct');
    const iFenetre = bloc.indexOf("trad('depuis le relevé de {m}')");
    vrai(iMontant > 0 && iPct > iMontant, 'le pourcentage suit le montant');
    vrai(iFenetre > iPct, 'et la fenêtre vient après les deux');
    /* Le pourcentage vit DANS le `b`, et pas a cote : `.hero-delta span` grise
       ce qui suit le montant, et un pourcentage gris contre un montant vert
       dirait deux choses du meme mouvement. */
    vrai(/<b class="\$\{cls\(varAn\.eur\)\}">[\s\S]*hero-pct[\s\S]*<\/b>/.test(bloc),
      'le pourcentage est dans le montant, donc de sa couleur');
    const css = lireSource('assets/styles.css');
    vrai(/\.hero-delta b \.hero-pct \{[^}]*color: inherit/.test(css),
      'et la règle le dit explicitement');
    eq((bloc.match(/<span>/g) || []).length, 1, 'la fenêtre est le seul span de second rang');
  });

  test('une seule écriture, et les deux fenêtres se traduisent', () => {
    const app = lireSource('assets/app.js');
    vrai(!/deltaBlock/.test(app), 'plus de bloc à deux exemplaires');
    /* Le motif porte sur du CODE : la phrase survit dans le commentaire qui
       explique pourquoi elle est partie, et c'est sa place. */
    vrai(!/trad\('depuis le 1er janvier'\)/.test(app),
      'ni la fenêtre qui changeait de sens');
    eq(I18N.en['sur 1 an'], 'over 1 year', 'l’année glissante');
    vrai(I18N.en['depuis le début'], 'et le repli');
    eq(I18N.en['apports inclus'], 'contributions included', 'la réserve');
  });

  test('le modèle continue de calculer le reste', () => {
    /* `deltas()` rend toujours ses trois horizons : la page Actifs et la barre
       laterale les lisent. C'est l'affichage de l'accueil qui se resserre, pas
       le modele qui se vide. */
    Fixture.poser();
    const d = deltas();
    for (const k of ['month', 'ytd', 'all']) vrai(k in d, `deltas() garde « ${k} »`);
  });
});

/* ------------------------------------------------------------------
   La carte Patrimoine se lit, elle ne se touche pas
   ------------------------------------------------------------------ */
suite('Carte Patrimoine : une synthèse, sans porte cachée', () => {

  const carte = () => {
    const app = lireSource('assets/app.js');
    const i = app.indexOf('<div class="hero">');
    /* Jusqu'au guide replie, pas jusqu'a la carte de repartition : les bandeaux
       d'exploitation vivent desormais entre les deux, et ils portent, eux, une
       couverture cliquable — c'est leur nature, pas celle du hero. */
    return app.slice(i, app.indexOf("${guideDevant ? '' : guide}", i));
  };

  test('aucune couverture cliquable ne recouvre la carte', () => {
    /* Elle ouvrait la repartition par actif sans que rien ne l'annonce : ni
       chevron, ni intitule, ni bordure. Un ecran entier qui reagit au doigt sans
       le dire est une navigation cachee, et le premier appui d'un lecteur tombe
       justement sur le grand chiffre. */
    const c = carte();
    vrai(c.length > 500, 'la carte doit être trouvable : ' + c.length);
    vrai(!/card-couvre/.test(c), 'aucun bouton de couverture');
    vrai(!/card-cliquable/.test(c), 'ni la classe qui l’accompagnait');
    /* Le controle porte sur CETTE carte : une autre vue porte aussi une carte
       « hero », qui elle ouvre vraiment quelque chose et l'annonce. */
    const app = lireSource('assets/app.js');
    vrai(/<div class="hero">/.test(app), 'la carte d’Aperçu se rend sans elle');
  });

  test('ni le montant, ni la barre, ni les écarts ne portent d’action', () => {
    const c = carte();
    /* Le grand chiffre. */
    const val = c.slice(c.indexOf('<div class="hero-value">'),
                        c.indexOf('</div>', c.indexOf('<div class="hero-value">')));
    vrai(!/data-action/.test(val), 'le montant ne répond pas');
    /* Les deux ecarts : leur balisage vient de deltaBlock, hors de cette
       tranche, donc on le juge la ou il vit. */
    const app = lireSource('assets/app.js');
    const bloc = app.slice(app.indexOf('const deltaBlock = (label, x)'),
                           app.indexOf("` : '';", app.indexOf('const deltaBlock = (label, x)')));
    vrai(!/data-action/.test(bloc), 'les écarts ne répondent pas');
    vrai(!/<button/.test(bloc), 'et ne sont pas des boutons');
    /* La barre de repartition. */
    const barre = c.slice(c.indexOf('<div class="hero-barre"'),
                          c.indexOf('</div>', c.indexOf('<div class="hero-barre"')));
    vrai(!/data-action/.test(barre), 'la barre ne répond pas');
    vrai(/role="img"/.test(barre), 'elle s’annonce comme une image');
  });

  test('les pastilles d’aide restent, et elles seules', () => {
    /* La seule exception voulue : expliquer un chiffre sans naviguer. La
       bascule Net / Brut reste elle aussi, mais c'est un reglage de lecture
       affiche comme tel, pas une porte vers un autre ecran. */
    const c = carte();
    const actions = (c.match(/data-action="([^"]+)"/g) || [])
      .map(x => x.replace(/.*="|"$/g, ''));
    for (const a of actions) {
      vrai(a === 'hero-base', `« ${a} » n’a rien à faire dans cette carte`);
    }
    /* Les ecarts ont perdu la leur : leur reserve tient dans l'intitule. La
       carte ne porte donc plus une seule pastille, ce qui est le bout du chemin
       pour une carte qui doit se lire sans rien ouvrir. */
    vrai(!/aide\(/.test(c), 'et la carte n’en porte plus aucune');
  });

  test('la fiche que plus rien n’ouvrait s’en est allée', () => {
    /* Une fonction sans appelant se garde sans se maintenir, et finit par
       decrire un ecran qui n'existe plus. */
    const app = lireSource('assets/app.js');
    vrai(!/patrimoineTotal/.test(app),
      'ni la fiche « patrimoineTotal », ni un appel vers elle');
  });
});

/* ------------------------------------------------------------------
   Un actif terminal ne se contient pas lui-meme
   ------------------------------------------------------------------ */
suite('Actifs terminaux : pas de placement dans un placement', () => {

  test('un contenant contient, un actif terminal non', () => {
    /* La question est la meme pour les deux familles : ce compte porte-t-il
       plusieurs lignes, ou EST-il la ligne ? */
    for (const id of ['pe', 'crowdfunding', 'immo', 'bienValeur']) {
      vrai(estActifTerminal(typeCompte(id)), `« ${id} » est un actif terminal`);
    }
    for (const id of ['cto', 'pea', 'av', 'per', 'crypto']) {
      vrai(!estActifTerminal(typeCompte(id)), `« ${id} » est un contenant`);
    }
  });

  test('le drapeau vit sur le type, pas dans la vue', () => {
    /* Un identifiant ecrit dans la vue aurait ete une seconde liste a tenir :
       le jour ou un type devient terminal, il le declare ici et tous les ecrans
       suivent. */
    const st = lireSource('assets/store.js');
    vrai(/const estActifTerminal = t => !!t && \(!!t\.direct \|\| !!t\.terminal\);/.test(st),
      'les deux façons de l’être se lisent au même endroit');
    vrai(/id: 'pe',[^\n]*terminal: true/.test(st), '« Parts de société » le déclare');
    vrai(/prete: true, terminal: true/.test(st), '« Prêt participatif » aussi');
    const app = lireSource('assets/app.js');
    vrai(!/type\.id === 'pe'|t\.id === 'pe'/.test(app),
      'et aucune vue ne teste un identifiant à la main');
  });

  test('la fiche d’un actif terminal n’offre pas de sous-placement', () => {
    /* Le defaut : la fiche d'une participation portait une carte « Placements
       detenus » ou figurait cette meme participation, sous son propre nom. Un
       actif qui se contient lui-meme, et un « + Placement » qui invitait a en
       ranger un second dedans. */
    const app = lireSource('assets/app.js');
    vrai(/const seule = estActifTerminal\(t\) && !estBien\(t\) && lignes\.length === 1/.test(app),
      'la fiche repère son placement unique');
    vrai(/\$\{estBien\(t\) \|\| seule \|\|/.test(app),
      'et la carte « Placements détenus » se tait alors');
    /* Le bouton d'ajout vit dans cette carte : il part avec elle. */
    const i = app.indexOf("${estBien(t) || seule ||");
    const bloc = app.slice(i, app.indexOf('</div>`}', i));
    vrai(/ajouter-placement/.test(bloc),
      'le bouton d’ajout vit bien dans la carte qui se tait');
  });

  test('une seule condition décide, pas deux écritures', () => {
    /* Deux conditions ecrites a la main auraient fini par diverger, et l'ecran
       aurait montre les deux cartes ou aucune. */
    const app = lireSource('assets/app.js');
    /* Deux emplois, et ils ne decident pas de la meme chose : l'un aiguille la
       carte de l'actif, l'autre decide qu'une date absente s'affiche quand meme.
       Ce que le controle interdit, c'est de RECRIRE la condition — `t.direct ||
       t.terminal` a la main — pas de s'en servir deux fois. */
    eq((app.match(/estActifTerminal\(t\)/g) || []).length, 2,
      'la condition se lit, elle ne se réécrit pas');
    vrai(!/t\.direct \|\| t\.terminal/.test(app),
      'et personne ne la recopie à la main dans la vue');
    vrai(/espaceTerminal\(c, idx, t, seule\)/.test(app),
      'et la carte reçoit son résultat plutôt que de le recalculer');
  });

  test('un actif terminal à plusieurs lignes garde sa liste', () => {
    /* Masquer la liste rendrait ces lignes injoignables : retirer un ecran ne
       doit jamais emporter ce que quelqu'un y a saisi. */
    const app = lireSource('assets/app.js');
    vrai(/lignes\.length === 1\s*\n?\s*\? lignes\[0\] : null/.test(app),
      'le repli ne vaut que pour le cas d’une ligne unique');
    const i = app.indexOf('function espaceTerminal');
    const fn = app.slice(i, app.indexOf('\n}', i));
    vrai(/if \(!seule\) return '';/.test(fn),
      'et la carte se tait quand il n’y a pas de ligne unique');
  });

  test('la ligne unique ne redit pas le nom de sa fiche', () => {
    /* Le nom du compte est celui de la fiche, ecrit deux fois plus haut. La
       ligne prend celui de sa classe, qui dit quelque chose de neuf. */
    const app = lireSource('assets/app.js');
    vrai(/function lignePlacement\(l, compte, editable = false\)/.test(app),
      'la ligne se rend d’une seule façon');
    vrai(/const libelle = nomLignePlacement\(l, compte\);/.test(app),
      'elle tire son nom de la fonction qui en décide, une seule fois');
    /* ET LE MODE « SANS NOM » A DISPARU AVEC SON SEUL APPELANT : la fiche d'un
       actif terminal ne promeut plus une ligne de liste en carte, elle rend la
       meme carte cle-valeur que les autres. Un mode que personne n'exerce finit
       par mentir sans qu'on le sache. */
    vrai(!/sansNom/.test(app.replace(/\/\*[\s\S]*?\*\//g, '')),
      'et le mode « sans nom » n’a plus lieu d’être');
  });

  test('l’architecture ne bouge pas : établissement, puis compte', () => {
    /* C'est le niveau de trop qui part, pas un niveau reel. Un compte terminal
       reste un compte, rattache a son etablissement, et sa valeur reste celle
       de sa ligne. */
    Fixture.poser();
    const c = COMPTES().find(x => x.type === 'crowdfunding');
    vrai(c, 'le fixture porte un prêt participatif');
    vrai(estActifTerminal(typeCompte(c.type)), 'qui est terminal');
    vrai(c.etabId, 'et qui garde son établissement');
    pres(valeurCompte(c), 2000, 'sa valeur reste celle de sa ligne');
    eq(lignesDe(c).length, 1, 'une ligne, une seule');
  });
});

/* ------------------------------------------------------------------
   La version en ligne est reprise, sans question et sans perte seche
   ------------------------------------------------------------------ */
suite('Synchronisation : c’est toujours la version en ligne', () => {

  const adoption = () => {
    const app = lireSource('assets/app.js');
    const i = app.indexOf('async function prendreVersionEnLigne(');
    return app.slice(i, app.indexOf('\n  }', i));
  };

  test('l’application ne demande plus quelle version garder', () => {
    /* La regle : c'est toujours celle en ligne qui gagne. La seule question qui
       reste vit au demarrage, quand cet appareil porte des modifications
       jamais envoyees et que le cloud a bouge. */
    const app = lireSource('assets/app.js');
    vrai(!/Deux versions différentes de tes données/.test(app),
      'la fenêtre d’arbitrage a disparu du code');
    vrai(!/Charger celle en ligne/.test(app), 'et son bouton avec elle');
    const st = lireSource('assets/store.js');
    vrai(!/Choisis laquelle garder/.test(st),
      'la cloche ne réclame plus d’arbitrage non plus');
    vrai(/Elle sera reprise dès que le réseau reviendra/.test(st),
      'elle annonce ce qui va se passer');
  });

  test('les trois chemins passent par la même porte', () => {
    /* L'appareil simplement en retard, celui qui portait une modification, et
       l'ecriture refusee : trois chemins, une seule facon d'adopter. Trois
       ecritures a la main auraient fini par diverger, et c'est deja arrive ici
       — l'une d'elles sauvegardait sous un autre nom que les autres. */
    const app = lireSource('assets/app.js');
    eq((app.match(/prendreVersionEnLigne\(/g) || []).length, 4,
      'une définition et trois appels');
    vrai(!/Store\.addBackup\('avant chargement cloud'\)/.test(app),
      'plus de seconde écriture de la même adoption');
  });

  test('la sauvegarde précède le remplacement, jamais l’inverse', () => {
    /* C'est tout ce qui rend le geste reversible. Prendre la version en ligne
       efface la modification locale qui n'etait pas partie : sans point de
       retour, elle n'aurait jamais existe. L'ordre n'est pas un detail — une
       sauvegarde posee apres le remplacement copierait la version en ligne. */
    const fn = adoption();
    const iSauve = fn.indexOf("Store.addBackup('avant adoption de la version en ligne')");
    const iEtat = fn.indexOf('Store.state = donnees;');
    vrai(iSauve > 0, 'la sauvegarde existe');
    vrai(iEtat > 0, 'le remplacement aussi');
    vrai(iSauve < iEtat, 'et la sauvegarde vient avant');
  });

  test('la version prise devient la base des écritures suivantes', () => {
    /* Sans ce reperage, la sauvegarde suivante declarerait avoir lu une version
       qui n'est plus en place, et le serveur la refuserait sans raison. */
    const fn = adoption();
    vrai(/CloudSync\.noterVersionLue\(quand\);/.test(fn),
      'la version lue se note');
    const cs = lireSource('assets/cloudsync.js');
    vrai(/const noterVersionLue = at => \{ markSynced\(at\); status\.conflict = null; \};/.test(cs),
      'et noter la version lue clôt le conflit : il n’y a plus rien à arbitrer');
  });

  test('le message dit où retrouver ce qui a été remplacé', () => {
    /* Une sauvegarde que personne ne sait chercher ne repare rien. */
    const app = lireSource('assets/app.js');
    eq((app.match(/'Version en ligne reprise\. Ta saisie est dans les sauvegardes\.'/g) || []).length, 2,
      'les deux cas qui coûtent quelque chose le disent');
    const cle = 'Version en ligne reprise. Ta saisie est dans les sauvegardes.';
    vrai(I18N.en[cle], 'la clef se traduit');
    vrai(/backups/.test(I18N.en[cle]), 'et l’anglais nomme aussi les sauvegardes : ' + I18N.en[cle]);
  });

  test('une écriture refusée va chercher ce qui est en ligne', () => {
    /* Un refus veut dire qu'un autre appareil a enregistre depuis. Le corps du
       409 ne porte que des dates, pas les donnees : il faut donc les lire. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('CloudSync.setOnConflit(');
    const bloc = app.slice(i, app.indexOf('\n  });', i));
    vrai(/await CloudSync\.pull\(\)/.test(bloc), 'elle lit la version en ligne');
    vrai(/prendreVersionEnLigne\(distant,/.test(bloc), 'et la prend');
    /* Le repli, qui compte autant : hors ligne, une lecture n'aboutit pas, et
       c'est justement le cas courant quand une ecriture vient d'echouer. */
    vrai(/catch \(e\) \{/.test(bloc), 'un échec de lecture est rattrapé');
    vrai(/Modification gardée ici/.test(bloc),
      'et l’on garde alors ce qu’on a plutôt que de le perdre');
  });

  test('le serveur garde son garde-fou : rien n’est écrasé à l’aveugle', () => {
    /* Prendre la version en ligne est un choix de LECTURE, cote client. Le
       serveur, lui, continue de refuser une ecriture qui declare avoir lu une
       version qui n'est plus en place — sinon un onglet ouvert depuis des
       heures ecraserait ce qu'un autre appareil vient d'enregistrer. */
    const w = lireSource('_worker.js');
    vrai(/if \(prevAt && base !== prevAt\)/.test(w),
      'le serveur compare toujours la version lue à celle en place');
    vrai(/error: 'conflit'/.test(w), 'et refuse quand elles diffèrent');
  });
});

finDePartieDeTests('tests/04-centre-anneau-sait-passer.tests.js');
