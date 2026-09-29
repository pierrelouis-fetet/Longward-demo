partieDeTests('tests/15-personnalise-est-case-pas.tests.js');
/* ------------------------------------------------------------------
   Projection : quatre poches, et pas une hypothese par classe d'actif
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   Le scenario affiche se deduit des taux
   ------------------------------------------------------------------ */
suite('Personnalisé est une case, pas un quatrième scénario', () => {

  /* Deux questions vivaient sous un seul nom. « D'ou viennent les taux ? » --
     de la table d'un scenario nomme, ou de l'etat -- et « a quoi ces taux
     ressemblent-ils ? ». La premiere decide du calcul, la seconde de ce que
     l'ecran allume, et les confondre rendait le retour impossible : remettre
     6 % sur le marche laissait « personnalise » enfonce alors que les quatre
     valeurs etaient exactement celles de Central.

     `sourceDesTaux()` repond a la premiere, `detecteScenario()` a la seconde, et
     c'est la seconde que la vue lit. */

  /* Les taux d'un scenario, pris dans la table : les recopier ici ferait deux
     verites pour une, et c'est celle du test qui finirait par mentir. */
  const tauxDe = cle => TAUX_SCENARIO[cle];

  /* Poser les taux d'un scenario a la main, comme le fait le gel du depliant :
     l'etat porte les trois chemins et `projScenario` vaut « perso », donc les
     taux viennent de l'etat et non d'une table. */
  const poserAlaMain = (marche, autres, garanti) => Fixture.poser(s => {
    s.meta.projScenario = 'perso';
    s.meta.projRate = marche;
    s.meta.projRateAutres = autres;
    s.meta.projRateGaranti = garanti;
  });

  test('un état neuf montre Central actif, et Personnalisé éteint', () => {
    Fixture.poser(s => {
      delete s.meta.projScenario;
      delete s.meta.projRate; delete s.meta.projRateAutres; delete s.meta.projRateGaranti;
    });
    eq(projectionSettings().scenario, 'central', 'Central est le scénario montré');
    eq(sourceDesTaux(), 'central', 'et ses taux viennent de la table');
    /* La case existe et n'est pas allumee : c'est tout ce qu'on attend d'elle au
       depart. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function choixHypothese'),
                           src.indexOf('function barreSousOnglets'));
    vrai(/\['perso', 'Personnalisé'/.test(bloc), 'la quatrième case est déclarée');
    vrai(/class="\$\{cle === actif \? 'on' : ''\}"/.test(bloc),
      'et elle s’allume par la même règle que les trois autres');
  });

  test('les quatre cases descendent d’une seule liste', () => {
    /* Trois paves derives de la table plus un ecrit a cote auraient donne deux
       balisages a tenir d'accord. Une seule liste, un seul gabarit de bouton, et
       « Personnalise » herite donc de tout : hauteur, coins, etat retenu, focus,
       aria-pressed. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function choixHypothese'),
                           src.indexOf('function barreSousOnglets'));
    eq((bloc.match(/<button/g) || []).length, 1,
      'un seul gabarit de bouton pour les quatre cases');
    vrai(/aria-pressed="\$\{cle === actif\}"/.test(bloc),
      'et le même état accessible sur les quatre');
    /* Les trois presets d'abord, la case libre en dernier. */
    const iTable = bloc.indexOf('SCENARIOS_PROJECTION.map');
    const iPerso = bloc.indexOf("['perso'");
    vrai(iTable > 0 && iPerso > iTable, 'les trois presets viennent avant elle');
  });

  test('Personnalisé n’affiche aucun taux, parce qu’elle n’en a aucun', () => {
    /* Un jeu personnalise peut changer plusieurs rendements a la fois : en
       montrer un seul designerait le mauvais. Les trois autres n'annoncent que
       celui du marche parce que c'est le seul que leur scenario fait varier. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function choixHypothese'),
                           src.indexOf('function barreSousOnglets'));
    vrai(/\['perso', 'Personnalisé', trad\('tes hypothèses'\)\]/.test(bloc),
      'sa ligne du dessous dit « tes hypothèses », pas un pourcentage');
    vrai(!/perso[^\n]*fmtPct/.test(bloc), 'aucun taux calculé sous cette case');
    /* Et aucune entree dans la table des scenarios : pas de preset cache. */
    vrai(!SCENARIOS_PROJECTION.some(([c]) => c === 'perso'),
      '« perso » n’est pas un scénario de la table');
    eq(TAUX_SCENARIO.perso, undefined, 'et il n’a aucun jeu de taux à lui');
  });

  test('cliquer sur Personnalisé n’écrit rien et ouvre le dépliant', () => {
    /* Le clic est un raccourci vers les reglages, pas une selection. Lui faire
       enregistrer `projScenario = 'perso'` aurait fige les taux du scenario en
       cours sous un autre nom, sans qu'un seul chiffre change a l'ecran : un
       etat qui ne veut rien dire, et un pave enfonce que personne n'a choisi. */
    const src = lireSource('assets/app.js');
    const action = src.slice(src.indexOf("'proj-scenario'(btn) {"),
                             src.indexOf("'hero-base'(btn)"));
    const tot = action.indexOf("if (btn.dataset.scenario === 'perso')");
    vrai(tot > 0, 'le cas « perso » se traite avant tout le reste');
    const branche = action.slice(tot, action.indexOf('return;', tot));
    vrai(!/Store\.save|projScenario/.test(branche),
      'cette branche n’enregistre rien et ne pose aucun scénario');
    vrai(/avanceOuvert = true/.test(branche), 'elle ouvre le dépliant des taux');
    vrai(/hypoOuvert = true/.test(branche),
      'et la carte qui le contient, sinon le dépliant s’ouvrirait dans un pli fermé');
    /* Le depliant deja ouvert le reste : poser un drapeau a vrai deux fois ne
       ferme rien. Aucun `= false` dans cette branche. */
    vrai(!/= false/.test(branche), 'rien ne se referme ici');
  });

  test('le dépliant reste ouvert quand les taux redeviennent ceux d’un preset', () => {
    /* Son ouverture venait de `scenario === 'perso'`. Depuis que le scenario se
       deduit, remettre 6 % rallume Central — et le depliant se serait referme
       sous le doigt de celui qui venait de regler le champ. Un drapeau de
       session porte le geste, et il n'est jamais enregistre : aucune preference
       de plus dans le stockage pour une chose qui ne survit pas a l'onglet. */
    const src = lireSource('assets/app.js');
    vrai(/let avanceOuvert = false;/.test(src), 'le drapeau existe');
    vrai(/avanceOuvert \|\| s\.scenario === 'perso' \? 'open' : ''/.test(src),
      'le dépliant s’ouvre sur le geste OU sur des taux personnalisés');
    vrai(/av\.addEventListener\('toggle'/.test(src),
      'et le refermer à la main se retient aussi');
    vrai(!/avanceOuvert/.test(lireSource('assets/store.js') || ''),
      'ce drapeau ne touche pas au modèle : il ne s’enregistre pas');
  });

  test('changer un taux allume Personnalisé', () => {
    /* Central plus un marche a 7 % : la combinaison ne correspond plus a aucun
       preset, donc la case libre s'allume. Le reste des hypotheses n'a pas
       bouge. */
    const c = tauxDe('central');
    poserAlaMain(7, c.autres, c.garanti);
    eq(projectionSettings().scenario, 'perso', 'la case libre s’allume');
    pres(projectionSettings().rate, 7, 'et le taux choisi est bien celui qui s’applique');
    pres(projectionSettings().rateGaranti, c.garanti, 'le garanti reste celui de Central');
  });

  test('remettre exactement les valeurs d’un preset le rallume', () => {
    /* Le retour, pour les trois. Aucun enregistrement ne le declenche : c'est la
       comparaison des taux qui rend la reponse, donc l'etat ne peut pas se
       contredire avec les chiffres qu'il decrit. */
    for (const [cle] of SCENARIOS_PROJECTION) {
      const p = tauxDe(cle);
      poserAlaMain(p.marche, p.autres, p.garanti);
      eq(projectionSettings().scenario, cle,
        `des taux égaux à « ${cle} » rallument « ${cle} »`);
      eq(sourceDesTaux(), 'perso',
        'alors même que les taux viennent de l’état et non de la table');
    }
    /* Un seul chiffre a cote suffit a en sortir, et sur n'importe quelle poche. */
    const c = tauxDe('central');
    poserAlaMain(c.marche, c.autres + 1, c.garanti);
    eq(projectionSettings().scenario, 'perso', 'un demi-point sur une autre poche suffit');
    poserAlaMain(c.marche, c.autres, c.garanti + 0.5);
    eq(projectionSettings().scenario, 'perso', 'le garanti aussi');
  });

  test('cliquer sur un preset depuis Personnalisé applique ses valeurs', () => {
    /* Le comportement existant, inchange : le clic pose `projScenario`, et les
       taux viennent alors de la table — les chiffres personnalises restent dans
       l'etat, ignores, prets a revenir si l'on repasse par le depliant. */
    poserAlaMain(7, 1, 3.5);
    eq(projectionSettings().scenario, 'perso', 'on part de personnalisé');
    for (const [cle] of SCENARIOS_PROJECTION) {
      Store.state.meta.projScenario = cle;      // ce que fait le clic
      const s = projectionSettings(), p = tauxDe(cle);
      eq(s.scenario, cle, `« ${cle} » devient le scénario montré`);
      pres(s.rate, p.marche, 'et ses taux s’appliquent');
      pres(s.rateAutres, p.autres, 'sur toutes les poches');
      pres(s.rateGaranti, p.garanti, 'sans exception');
    }
    /* Les chiffres personnalises n'ont pas ete effaces. */
    pres(num(Store.state.meta.projRate), 7, 'le taux personnalisé dort dans l’état');
  });

  test('des hypothèses personnalisées d’avant cette case allument Personnalisé', () => {
    /* La migration, et il n'y en a pas : un etat ecrit avant la quatrieme case
       porte ses taux et pas de scenario. `sourceDesTaux()` le lit comme
       personnalise, `detecteScenario()` classe ses valeurs, et rien n'est
       reecrit. Un etat deduit n'a pas besoin d'etre converti. */
    Fixture.poser(s => {
      delete s.meta.projScenario;
      s.meta.projRate = 7; s.meta.projRateAutres = 1; s.meta.projRateGaranti = 3;
    });
    eq(projectionSettings().scenario, 'perso', 'ses valeurs ne sont celles d’aucun preset');
    eq(Store.state.meta.projScenario, undefined, 'et rien n’a été écrit pour le dire');
    pres(projectionSettings().rate, 7, 'ses chiffres sont intacts');

    /* Et si ses valeurs tombent pile sur un preset, c'est ce preset qui
       s'allume : personne n'a « choisi » Central, mais c'est bien Central que
       ses chiffres decrivent. */
    const c = tauxDe('central');
    Fixture.poser(s => {
      delete s.meta.projScenario;
      s.meta.projRate = c.marche; s.meta.projRateAutres = c.autres;
      s.meta.projRateGaranti = c.garanti;
    });
    eq(projectionSettings().scenario, 'central',
      'des taux égaux à Central allument Central, même sans scénario enregistré');
  });

  test('l’inflation ne fait pas basculer en personnalisé', () => {
    /* Elle n'est pas dans les presets : aucune entree de SCENARIOS_PROJECTION ne
       la porte. La regler ne quitte donc aucun scenario, et c'est la logique
       actuelle du produit — pas une decision prise au passage. */
    vrai(!POCHES_SCENARIO.includes('inflation'),
      'l’inflation n’est pas une hypothèse de scénario');
    for (const [cle] of SCENARIOS_PROJECTION) {
      Fixture.poser(s => { s.meta.projScenario = cle; s.meta.projInflation = 5; });
      eq(projectionSettings().scenario, cle,
        `« ${cle} » survit à une inflation réglée à 5 %`);
      pres(projectionSettings().inflation, 5, 'et l’inflation choisie s’applique');
    }
    /* Le versement et la cible non plus : ils ne sont pas des hypotheses de
       rendement. */
    Fixture.poser(s => {
      s.meta.projScenario = 'central'; s.meta.projMonthly = 999; s.meta.projTarget = 500000;
      s.meta.projVersementVers = 'garanti';
    });
    eq(projectionSettings().scenario, 'central',
      'ni le versement, ni sa destination, ni la cible ne changent le scénario');
  });

  test('les quatre poches du scénario se dérivent de la table', () => {
    /* La liste qui sert a comparer descend de la table : l'ecrire a la main
       aurait menti le jour ou une poche s'ajoute, et la comparaison aurait
       declare « Central » deux jeux de taux differents. */
    eq(POCHES_SCENARIO.join(' '), Object.keys(TAUX_SCENARIO.central).join(' '),
      'les poches comparées sont exactement celles que la table déclare');
    const src = lireSource('assets/store.js');
    vrai(/const POCHES_SCENARIO = Object\.keys\(SCENARIOS_PROJECTION\[0\]\[2\]\)/.test(src),
      'et elle est dérivée, non recopiée');
    /* Une seule fonction repond a la question, pour tout l'ecran. */
    /* La vue ne rappelle pas la detection : elle lit `settings.scenario`. Les
       commentaires ont le droit de la nommer pour dire d'ou vient l'etat retenu,
       donc ils sortent avant le controle. */
    const app = (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/detecteScenario/.test(app),
      'la vue ne refait pas la détection : elle lit `settings.scenario`');
    eq((src.match(/function detecteScenario/g) || []).length, 1,
      'une seule définition de la détection');
  });

  test('le résumé replié nomme personnalisé quand c’est le cas, et pas avant', () => {
    /* Le resume dit « 1 653 EUR / mois · scenario personnalise ». Il lit le meme
       `s.scenario` que les paves : deux lectures de cette question finiraient par
       se contredire, et l'une des deux allumerait un pave que l'autre eteint. */
    const src = lireSource('assets/app.js');
    vrai(/\$\{trad\('scénario'\)\} \$\{trad\(nomScenario\(s\.scenario\)\)\.toLowerCase\(\)\}/
      .test(src), 'le résumé nomme le scénario montré');
    eq(nomScenario('perso'), 'Personnalisé', 'et « perso » se dit « Personnalisé »');
    const c = tauxDe('central');
    poserAlaMain(7, c.autres, c.garanti);
    eq(nomScenario(projectionSettings().scenario), 'Personnalisé',
      'des taux hors preset donnent « personnalisé » dans le résumé');
    poserAlaMain(c.marche, c.autres, c.garanti);
    eq(nomScenario(projectionSettings().scenario), 'Central',
      'et des taux égaux à Central y écrivent « central »');
    /* La cible reste dans le resume si elle est posee. */
    vrai(/num\(s\.target\) \? ` · \$\{trad\('cible'\)\}/.test(src),
      'la cible garde sa place dans le résumé');
  });

  test('le chevron d’un dépliant imbriqué suit son propre pli', () => {
    /* Le depliant des taux vit A L'INTERIEUR de la carte des hypotheses, et les
       deux portent `pli-reglages`. La regle qui retourne le chevron visait un
       DESCENDANT : la carte ouverte retournait donc aussi le chevron de son
       enfant ferme, et l'on lisait « Ouvrir ^ » sur un pli qui ne montrait
       rien -- une fleche qui annonce l'inverse de ce que le clic va faire.

       Mesure en DOM plutot qu'en lecture de CSS : c'est la cascade qui se
       trompait, pas le texte de la regle. */
    const css = lireSource('assets/styles.css');
    vrai(/details\.pli-reglages\[open\] > summary \.pli-action::after/.test(css),
      'la rotation porte sur le sommaire du dépliant lui-même');

    const style = document.createElement('style');
    /* La transition est neutralisee : `getComputedStyle` rendue pendant les
       150 ms d'animation donne la valeur interpolee, soit la matrice identite au
       premier instant. Un controle qui se contente de « different de none »
       passerait donc sans qu'aucune rotation n'ait lieu -- il l'a fait. */
    style.textContent = css + ' .pli-action::after { transition: none !important; }';
    const boite = document.createElement('div');
    boite.innerHTML = `
      <details class="pli-reglages" open>
        <summary><span class="pli-valeurs">Carte</span
          ><span class="pli-action" id="chevDehors">Régler</span></summary>
        <details class="pli-reglages pli-avance">
          <summary><span class="pli-valeurs">Taux</span
            ><span class="pli-action" id="chevDedans">Ouvrir</span></summary>
          <p>des champs</p>
        </details>
      </details>`;
    document.body.append(style, boite);
    try {
      const rotation = id => getComputedStyle(boite.querySelector('#' + id), '::after').transform;
      /* La carte est ouverte : son chevron pointe vers le haut. */
      const RETOURNE = 'matrix(-1, 0, 0, -1, 0, 0)';
      eq(rotation('chevDehors'), RETOURNE,
        'le chevron de la carte ouverte est retourné d’un demi-tour');
      /* Le pli interieur est ferme : le sien pointe vers le bas, donc aucune
         rotation. */
      eq(rotation('chevDedans'), 'none',
        'et celui du pli fermé qu’elle contient ne l’est pas : sa flèche montre '
        + 'vers le bas, comme ce que son clic va faire');
      /* Et il se retourne quand c'est LUI qu'on ouvre. */
      boite.querySelector('.pli-avance').open = true;
      eq(rotation('chevDedans'), RETOURNE,
        'ouvert à son tour, il se retourne du même demi-tour');
    } finally {
      style.remove();
      boite.remove();
    }
  });

  test('la case libre garde le style des trois autres, en clair comme en sombre', () => {
    /* Aucune couleur « custom » : l'etat retenu est celui de tout le monde, un
       lavis d'accent et un bord accentue, et les deux themes le tiennent parce
       que la regle passe par les variables. */
    const css = lireSource('assets/styles.css');
    const on = (css.match(/\.choix-hypothese button\.on \{[^}]*\}/) || [''])[0];
    vrai(/var\(--accent\)/.test(on) && /color-mix/.test(on),
      'l’état retenu vient des variables du thème');
    vrai(!/choix-hypothese button\[data-scenario="perso"\]/.test(css),
      'et aucune règle ne singularise la case libre');
    /* La cible du doigt ne depend pas de la longueur du mot : colonnes egales,
       et deux par deux sous 768 px. */
    vrai(/\.choix-hypothese \{[\s\S]{0,240}grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
      .test(css), 'quatre colonnes égales');
    const petit = css.slice(css.indexOf('@media (max-width: 767px)'));
    vrai(/\.choix-hypothese \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/
      .test(petit), 'deux par deux sur téléphone');
    /* Et l'anneau de l'application au clavier, comme tout ce qui se focalise. */
    const focus = (css.match(/\.choix-hypothese button:focus-visible \{[^}]*\}/) || [''])[0];
    vrai(/outline: 2px solid var\(--accent\)/.test(focus),
      'les quatre cases portent l’anneau d’accent au clavier');
  });
});

/* ------------------------------------------------------------------
   Une seule convention : le patrimoine NET
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   Budget : l'interface suit le mode choisi
   ------------------------------------------------------------------ */
suite('Sans catégories, aucune commande de catégorie', () => {

  /* Trois postes et trois mois : le fixture de cette suite, pose ici pour
     qu'elle ne depende pas de celui d'une autre. */
  const troisPostes = e => {
    e.budget.categories = ['Courses', 'Sport', 'Transports'];
    e.budget.retirees = [];
    e.budget.expenses = [
      { month: '2026-01-01', v: { Courses: 400, Sport: 60, Transports: 40 }, note: '' },
      { month: '2026-02-01', v: { Courses: 500, Sport: 60 }, note: '' },
      { month: '2026-03-01', v: { Courses: 300, Transports: 90 }, note: '' },
    ];
  };

  test('les gestes qui créent une catégorie disparaissent avec elles', () => {
    /* Le geste et son inverse cote a cote : « Une seule case a remplir » et
       « + Ajouter une categorie ». Le second defaisait le premier en silence --
       une categorie ajoutee est une categorie active, donc la page repassait en
       saisie detaillee sans qu'un mot le dise.

       Le seul retour offert est celui qui l'annonce : « Remettre toutes les
       categories ». */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget(section'),
                          src.indexOf('function mountBudget('));
    const i = vue.indexOf("data-action=\"add-category\"");
    vrai(i > 0, 'le bouton existe encore, pour qui détaille');
    vrai(/\$\{sansDistinction\(\) \? ''\s*$/m.test(vue.slice(Math.max(0, i - 420), i))
      || /sansDistinction\(\) \? ''/.test(vue.slice(Math.max(0, i - 420), i)),
      'et il ne se rend que si les catégories servent encore');
    /* La fenetre du mois porte le meme geste, et la meme garde. */
    const fen = src.slice(src.indexOf('function askExpenseMonth'), src.indexOf('id="depNote"'));
    const j = fen.indexOf('id="depNouvelleCat"');
    vrai(j > 0, 'la fenêtre a son bouton');
    vrai(/sansDistinction\(\) \? ''/.test(fen.slice(Math.max(0, j - 400), j)),
      'gardé de la même façon : créer une case pendant qu’on en demande une seule '
      + 'ferait repasser la fenêtre en douze cases au rendu suivant');
    /* Et son cablage se garde aussi : sans quoi le premier rendu du mode
       « une seule case » levait sur un `null`. */
    vrai(/if \(\$\('#depNouvelleCat'\)\) \$\('#depNouvelleCat'\)\.onclick/.test(src),
      'le câblage vérifie que le bouton est là');
  });

  test('le retour au détail fait revenir les commandes', () => {
    /* Binaire, et rien d'autre : la liste des categories de saisie decide. */
    Fixture.poser(troisPostes);
    vrai(!sansDistinction(), 'on part en saisie détaillée');
    vrai(categoriesSaisie().length > 1, 'plusieurs cases à remplir');
    neePlusDetailler();
    vrai(sansDistinction(), 'une seule case, et l’état se lit sur la liste');
    /* Le geste inverse existe et se nomme : c'est lui qui rallume tout. */
    const src = lireSource('assets/app.js');
    vrai(/data-action="reprendre-detail"/.test(src)
      && /trad\('Remettre toutes les catégories'\)/.test(src),
      'le retour est offert, et il dit ce qu’il fait');
    reprendreLeDetail();
    vrai(!sansDistinction(), 'les catégories reviennent');
    vrai(categoriesSaisie().length > 1, 'et la saisie redevient détaillée');
  });

  test('les anciennes données catégorisées survivent au mode', () => {
    /* Le point qui compte : l'interface suit le choix courant, le stockage garde
       l'histoire. Retirer les categories ne touche aucun montant. */
    Fixture.poser(troisPostes);
    const avant = Store.state.budget.expenses.map(r => JSON.stringify(r.v));
    const totaux = Store.state.budget.expenses.map(expenseRowTotal);
    const cats = expenseCategories().join('|');
    neePlusDetailler();
    Store.state.budget.expenses.forEach((r, i) => {
      eq(JSON.stringify(r.v), avant[i], `le mois ${i + 1} garde sa ventilation, à l’octet`);
      pres(expenseRowTotal(r), totaux[i], 'et son total');
    });
    /* Aucune ne disparait. Le regroupement peut en AJOUTER une -- la case
       unique porte un nom -- et c'est la disparition qu'on interdit, pas
       l'ajout : treize endroits parcourent cette liste pour sommer. */
    for (const c of cats.split('|')) {
      vrai(expenseCategories().includes(c),
        `« ${c} » est toujours dans la liste qui sert aux totaux et aux exports`);
    }
    /* Et les retrouver suffit a les revoir. */
    reprendreLeDetail();
    for (const c of cats.split('|')) {
      vrai(categoriesSaisie().includes(c), `« ${c} » revient à la saisie`);
    }
  });

  test('aucun mois futur n’entre dans une statistique', () => {
    /* Un mois a venir n'est pas un mois a zero euro. Il ne doit peser ni sur la
       moyenne, ni sur le compte des mois sous ou au-dessus de l'objectif, ni sur
       le meilleur et le pire -- et le mois EN COURS non plus, qui n'est pas
       fini. */
    auJour('2026-06-15', () => {
      Fixture.poser(e => {
        e.budget.monthlyTarget = 1000;
        e.budget.categories = ['Tout confondu'];
        e.budget.expenses = [
          { month: '2026-04-01', note: '', v: { 'Tout confondu': 900 } },
          { month: '2026-05-01', note: '', v: { 'Tout confondu': 1100 } },
          { month: '2026-06-01', note: '', v: { 'Tout confondu': 200 } },
          { month: '2026-07-01', note: '', v: {} },
          { month: '2026-12-01', note: '', v: {} },
        ];
      });
      const st = expenseYearStats('2026');
      pres(st.average, (900 + 1100) / 2,
        'la moyenne ne retient qu’avril et mai : juin court, juillet et décembre n’existent pas encore');
      eq(st.under, 1, 'un seul mois sous l’objectif');
      eq(st.over, 1, 'un seul au-dessus');
      eq(st.moisRetenus, 2, 'deux mois comparables');
      pres(st.total, 900 + 1100 + 200, 'le total de l’année compte ce qui a été dépensé');
      /* Et le graphique ne trace pas les mois vides a venir. */
      const vus = expenseSeriesVisible('2026').map(r => r.month);
      vrai(!vus.includes('2026-07-01') && !vus.includes('2026-12-01'),
        'les mois à venir ne sont pas des barres à zéro');
      vrai(vus.includes('2026-06-01'), 'le mois en cours, lui, se trace');
    });
  });

  test('aucune année de relevés ne se précrée', () => {
    /* Douze lignes vides par an dans le stockage : ce n'etait pas une annee
       ouverte, c'etaient douze mois a zero. Le journal n'affiche que les mois
       renseignes, et « Ajouter un releve » cree la ligne du mois demande.

       Le calendrier des DEPENSES reste : le tableau du detail mensuel est la
       seule porte vers un mois passe, et le retirer sans lui donner un
       remplaçant fermerait cette porte. */
    const src = lireSource('assets/store.js');
    const mig = src.slice(src.indexOf('ensureCalendarMonths(s.budget.expenses') - 1200,
                          src.indexOf('ensureCalendarMonths(s.budget.expenses') + 80);
    vrai(!/ensureCalendarMonths\(s\.monthly/.test(src),
      'les relevés ne se précréent plus');
    vrai(/ensureCalendarMonths\(s\.budget\.expenses/.test(mig),
      'les dépenses gardent leur calendrier, seule porte vers un mois passé');

    /* La preuve par les donnees : un etat sans releve reste sans releve apres
       migration, et le mois demande se cree a la demande. */
    Fixture.poser(e => { e.monthly = []; });
    Store.migrate();
    eq(Store.state.monthly.length, 0, 'aucune ligne inventée au chargement');
    const i = indexReleveTest('2026-03-01');
    eq(Store.state.monthly.length, 1, 'et une seule quand on en demande une');
    eq(Store.state.monthly[i].date, '2026-03-01', 'celle du mois visé');
  });

  /* `indexReleve` vit dans app.js, que le harnais ne charge pas : on rejoue sa
     regle, qui est d'ajouter la ligne manquante et de rendre son rang. */
  function indexReleveTest(cle) {
    let i = Store.state.monthly.findIndex(r => r.date === cle);
    if (i < 0) {
      Store.state.monthly.push({ date: cle, comment: '', v: {} });
      Store.state.monthly.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      i = Store.state.monthly.findIndex(r => r.date === cle);
    }
    return i;
  }
});

/* ------------------------------------------------------------------
   Projection : les textes disent ce que le moteur fait
   ------------------------------------------------------------------ */
suite('Les textes de Projection suivent les presets', () => {

  test('le capital garanti n’est plus annoncé à zéro par défaut', () => {
    /* Les trois scenarios lui donnent 2, 2,5 ou 3 %, et l'infobulle disait
       encore « zero par defaut, c'est a toi de l'affirmer ». Un texte qui
       decrit un etat du moteur disparu fait douter d'un chiffre juste. */
    for (const [cle, , taux] of SCENARIOS_PROJECTION) {
      vrai(taux.garanti > 0, `« ${cle} » applique bien un taux au capital garanti`);
    }
    const src = lireSource('assets/app.js');
    const champ = src.slice(src.indexOf("champ('Rendement du capital garanti'"),
                            src.indexOf("champ('Rendement du capital garanti'") + 700);
    vrai(!/Zéro par défaut/.test(champ), 'l’infobulle ne l’annonce plus à zéro');
    vrai(!/c’est à toi de l’affirmer/.test(champ),
      'ni ne renvoie l’hypothèse à l’utilisateur, puisque le scénario en pose une');
    vrai(/hypothèse prudente/.test(champ), 'elle dit ce que le scénario applique');
    vrai(/que tu peux changer ici/.test(champ), 'et qu’elle reste modifiable');
  });

  test('la bande de la courbe nomme le taux qu’elle fait varier', () => {
    /* Les deux courbes pointillees sont `capitalisation({ rate: s.rate ± 2 })` :
       seul le taux des actifs de marche bouge, le garanti et les autres actifs
       gardent le leur. « Si le rendement fait deux points de plus ou de moins »
       ne designait plus rien de precis depuis que chaque poche a le sien. */
    const src = lireSource('assets/app.js');
    vrai(/rate: num\(s\.rate\) - 2/.test(src) && /rate: num\(s\.rate\) \+ 2/.test(src),
      'les deux bandes ne font varier que le taux du marché');
    vrai(/Avec ±2 points sur le rendement des actifs de marché/.test(src),
      'et la légende le dit');
    vrai(!/Si le rendement fait deux points/.test(src), 'l’ancienne formulation est partie');
  });

  test('« Par horizon » annonce un scénario, pas un taux global', () => {
    /* L'en-tete n'annonce pas un seul taux par an sous un versement mensuel : il
       se lirait comme si tout le patrimoine progressait a ce taux. Les poches
       ont chacune leur hypothese : le garanti suit la sienne, les autres actifs
       et les liquidites ne bougent pas, l'immobilier est porte a plat. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf("trad('Par horizon')");
    vrai(i > 0, 'la carte doit être trouvable');
    const tete = src.slice(i, src.indexOf('</div>', i));
    vrai(!/fmtPct\(s\.rate\)/.test(tete), 'aucun taux global dans l’en-tête');
    vrai(/trad\(nomScenario\(s\.scenario\)\)/.test(tete),
      'elle nomme le scénario, qui vaut « personnalisé » hors preset');
    /* Et le resume replie de la carte des hypotheses dit la meme chose : une
       seule facon de nommer l'etat. */
    eq((src.match(/trad\(nomScenario\(s\.scenario\)\)\.toLowerCase\(\)/g) || []).length, 2,
      'le résumé replié et cet en-tête, par le même chemin');
  });

  test('le levier du rendement nomme la poche qu’il fait bouger', () => {
    /* `targetRequirements` rejoue le moteur avec `rate` modifie, et lui seul :
       « obtenir 8,4 % par an » se lisait comme un rendement du patrimoine
       entier, et personne ne savait quel réglage bouger. */
    const store = lireSource('assets/store.js');
    /* La borne haute est la fonction SUIVANTE : `capitalisation` vit plus haut
       dans le fichier, donc s'y fier rendait une tranche vide -- et un controle
       sur une chaine vide passe pour de mauvaises raisons. */
    const iT = store.indexOf('function targetRequirements');
    const fn = store.slice(iT, store.indexOf('function monthsToObjective', iT));
    vrai(fn.length > 500, 'targetRequirements doit être trouvable');
    vrai(/atteint\(\{ rate: /.test(fn),
      'le levier ne modifie que `rate`, le taux des actifs de marché');
    vrai(!/rateAutres:|rateGaranti:/.test(fn),
      'et laisse les autres poches telles quelles');
    const app = lireSource('assets/app.js');
    vrai(/sur les actifs de marché, au lieu de/.test(app),
      'la phrase nomme donc les actifs de marché');
  });

  test('aucun texte de Projection ne décrit une poche disparue', () => {
    /* Le balayage : les mots des moteurs precedents, dans ce que l'ecran
       affiche. Les commentaires sont ecartes -- ils ont le droit de raconter ce
       qui n'est plus, c'est meme leur usage ici. */
    const src = (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const vue = src.slice(src.indexOf('function viewObjective'),
                          src.indexOf('function mountObjective'));
    for (const mort of ['Rendement du non coté', 'Rendement de la crypto',
                        'tout ce qui se vend sur un marché',
                        'ont leur propre hypothèse',
                        'Si le rendement fait deux points']) {
      vrai(!vue.includes(mort), `« ${mort} » ne décrit plus le moteur`);
    }
  });
});

/* ------------------------------------------------------------------
   Un patrimoine net peut etre negatif
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   Un seul echeancier de credit
   ------------------------------------------------------------------ */
suite('Un crédit ne s’amortit que d’une seule façon', () => {

  /* Deux moteurs vivaient cote a cote. `finCredit` bouclait mois par mois en
     amortissant avec la mensualite ENTIERE, donc en comptant l'assurance comme
     du remboursement ; `resteAPayer` appliquait une formule fermee apres l'avoir
     retranchee. La meme fiche affichait les deux dates.

     La convention, une fois pour toutes :
       mensualite totale = capital + interets + assurance */

  /* Le pret de reference : 157 362 EUR a 1,45 %, mensualite totale 894,44 EUR,
     assurance 59,50 EUR par mois -- soit 0,34 % l'an sur 210 000 EUR empruntes. */
  const PRET = { id: 'd_ref', libelle: 'Prêt immobilier', montant: 157362,
                 taux: 1.45, mensualite: 894.44, tauxAssurance: 0.34, initial: 210000 };
  const poserPret = (modif = {}) => Fixture.poser(e => {
    e.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '',
                 dettes: [{ ...PRET, ...modif }] }];
    e.comptes = [];
    e.monthly = [];
    e.budget.fixedCharges = [];
  });

  test('l’assurance se calcule une fois, sur le capital emprunté', () => {
    poserPret();
    const d = Store.state.etabs[0].dettes[0];
    pres(assuranceMensuelleCredit(d), 210000 * 0.34 / 100 / 12,
      'la prime porte sur le capital emprunté, pas sur le restant dû');
    pres(assuranceMensuelleCredit(d), 59.5, 'soit 59,50 € par mois');
    /* Sans capital initial connu, le restant du sert de base : la prime est
       sous-estimee, ce qui est le bon sens de l'erreur. */
    pres(assuranceMensuelleCredit({ montant: 157362, tauxAssurance: 0.34 }),
      157362 * 0.34 / 100 / 12, 'à défaut, le restant dû sert de base');
    pres(assuranceMensuelleCredit({ montant: 157362 }), 0, 'et sans taux, aucune prime');
  });

  test('capital + intérêts + assurance font la mensualité totale', () => {
    /* La convention, verifiee au centime sur le mois en cours. */
    poserPret();
    const d = Store.state.etabs[0].dettes[0];
    const e = echeancierCredit(d);
    pres(e.interetsDuMois, 157362 * 1.45 / 100 / 12, 'les intérêts du mois');
    pres(e.assuranceDuMois, 59.5, 'l’assurance du mois');
    pres(e.capitalDuMois, 894.44 - 59.5 - 157362 * 1.45 / 100 / 12,
      'et le capital, soit ce qui reste');
    pres(e.capitalDuMois + e.interetsDuMois + e.assuranceDuMois, 894.44,
      'les trois font la mensualité totale, au centime');
    /* Les chiffres attendus, arrondis comme l'ecran les montre. */
    eq(Math.round(e.interetsDuMois * 100) / 100, 190.15, '190,15 € d’intérêts');
    eq(Math.round(e.capitalDuMois * 100) / 100, 644.79, '644,79 € de capital');
  });

  test('une seule durée, une seule date, un seul total d’intérêts', () => {
    /* Le defaut : `finCredit` amortissait avec 894,44 par mois et `resteAPayer`
       avec 834,94. Plus d'un an d'ecart, et les deux dates s'affichaient. */
    poserPret();
    const d = Store.state.etabs[0].dettes[0];
    const e = echeancierCredit(d), f = finCredit(d), r = resteAPayer(d);
    vrai(e.amortissable, 'le prêt s’amortit');
    eq(f.mois, e.mois, 'finCredit rend la durée de l’échéancier');
    eq(r.mois, e.mois, 'resteAPayer aussi');
    eq(f.finLe, e.finLe, 'et la même date de fin');
    eq(r.fin, e.finLe, 'des deux côtés');
    pres(f.interets, e.interets, 'les mêmes intérêts restants');
    pres(r.interets, e.interets, 'sans exception');
    /* La duree se verifie a la main : l'amortissement porte sur 834,94 EUR par
       mois, assurance retiree. */
    const dispo = 894.44 - 59.5, taux = 1.45 / 100 / 12;
    let capital = 157362, mois = 0;
    while (capital > 0.005 && mois < 1200) { capital += capital * taux - dispo; mois++; }
    eq(e.mois, mois, 'la durée est celle qu’on obtient en rejouant le tableau');
    vrai(e.mois > 200, 'soit plus de dix-sept ans, et non les seize d’avant');
  });

  test('la durée tombe sur celle du tableau de la banque, à chaque étape', () => {
    /* Le cas reel qui a fait trouver le defaut : un appartement finance sur vingt
       ans, et l'emprunteur a le tableau de sa banque sous les yeux.

       210 000 EUR sur 240 mois a 1,45 % donnent une mensualite de 1 008,52 EUR --
       arrondie au centime, comme toute mensualite de contrat. Cet arrondi laisse
       0,99 EUR apres la 240e echeance, que la banque absorbe dans la derniere.
       La boucle, elle, comptait un mois de plus pour ces quelques centimes et
       annonçait une 193e echeance de 1,00 EUR : un mois d'ecart avec un papier
       que l'emprunteur peut lire.

       Le seuil du repli est relatif a la mensualite, un pour cent, et non en
       euros : ce qui reste apres la penultieme echeance n'est un reste d'arrondi
       que s'il est negligeable devant une echeance normale. */
    const C = 210000, n = 240, r = 1.45 / 100 / 12;
    const mens = Math.round(C * r / (1 - Math.pow(1 + r, -n)) * 100) / 100;
    pres(mens, 1008.52, 'la mensualité du contrat, arrondie au centime');

    /* Le tableau de la banque, mois par mois. */
    const crdApres = [];
    let cap = C;
    for (let i = 1; i <= n; i++) {
      cap -= Math.min(cap, mens - cap * r);
      crdApres.push(Math.round(cap * 100) / 100);
    }
    vrai(crdApres[n - 1] > 0 && crdApres[n - 1] < 2,
      'l’arrondi laisse bien un reliquat de moins de deux euros');

    /* A chaque etape du pret, la duree deduite est celle qui reste au tableau. */
    for (const payees of [1, 12, 48, 120, 200, 239]) {
      poserPret({ montant: crdApres[payees - 1], mensualite: mens,
                  taux: 1.45, tauxAssurance: null, initial: null });
      const e = echeancierCredit(Store.state.etabs[0].dettes[0]);
      eq(e.mois, n - payees,
        `${payees} échéances payées : il en reste ${n - payees}, pas une de plus`);
    }
  });

  test('une vraie dernière échéance réduite reste une échéance', () => {
    /* L'autre moitie du repli : il ne doit avaler que l'arrondi. Une derniere
       echeance qui vaut la moitie des autres est un vrai prelevement, et la
       compter en moins ferait finir le pret un mois trop tot. */
    poserPret({ montant: 1500, mensualite: 1000, taux: 0,
                tauxAssurance: null, initial: null });
    const e = echeancierCredit(Store.state.etabs[0].dettes[0]);
    eq(e.mois, 2, 'mille cinq cents à mille par mois font deux échéances');
    pres(e.derniere, 500, 'la seconde vaut cinq cents, et elle compte');
    /* Et le repli se voit dans la source : relatif, jamais en euros. */
    const src = lireSource('assets/store.js');
    vrai(/derniere < mens \/ 100/.test(src),
      'le seuil est un pour cent de la mensualité, pas un montant absolu');
  });

  test('la dernière mensualité solde le reliquat', () => {
    poserPret();
    const e = echeancierCredit(Store.state.etabs[0].dettes[0]);
    vrai(e.derniere > 0, 'elle existe');
    vrai(e.derniere <= 894.44 + 0.005, 'elle n’est jamais plus grosse que les autres');
    /* Et l'assurance comptee est celle des echeances reellement payees. */
    pres(e.assurance, 59.5 * e.mois, 'une prime par échéance');
  });

  test('un taux à zéro s’amortit tout droit', () => {
    /* La formule fermee rendait `null` : un logarithme n'aime pas ce cas, et le
       pret le plus simple restait sans reponse. */
    poserPret({ montant: 12000, taux: 0, mensualite: 1000, tauxAssurance: null, initial: null });
    const d = Store.state.etabs[0].dettes[0];
    const e = echeancierCredit(d);
    vrai(e.amortissable, 'douze mille à mille euros par mois s’amortissent');
    eq(e.mois, 12, 'douze échéances, pas une de plus');
    pres(e.interets, 0, 'aucun intérêt');
    pres(e.capitalDuMois, 1000, 'et tout le versement rembourse');
    vrai(resteAPayer(d) !== null, 'les deux lecteurs répondent');
    vrai(finCredit(d) !== null, 'et non plus null parce que le taux vaut zéro');
  });

  test('un taux absent n’est pas un taux nul', () => {
    /* Sans taux on ne sait pas departager capital et interets : annoncer « zero
       de capital » sur une mensualite de 900 EUR serait faux dans l'autre sens,
       et l'annoncer entier le serait aussi. On se tait. */
    poserPret({ taux: undefined, tauxAssurance: null, initial: null });
    const d = Store.state.etabs[0].dettes[0];
    const e = echeancierCredit(d);
    vrai(!e.amortissable, 'aucune date de fin');
    eq(e.capitalDuMois, null, 'aucune part de capital annoncée');
    eq(e.interetsDuMois, null, 'aucune part d’intérêts non plus');
    eq(resteAPayer(d), null, 'et les deux lecteurs se taisent');
    eq(finCredit(d), null, 'des deux côtés');
  });

  test('une mensualité insuffisante ne promet aucune fin', () => {
    /* Le levier d'un courtier : il grossit tout seul. Et le seuil tient compte
       de l'assurance -- 500 EUR d'interets plus 60 d'assurance ne se couvrent
       pas avec 540. */
    poserPret({ montant: 100000, taux: 6, mensualite: 400, tauxAssurance: null, initial: null });
    let d = Store.state.etabs[0].dettes[0];
    eq(finCredit(d), null, '400 € ne remboursent pas 500 € d’intérêts');
    eq(resteAPayer(d), null, 'les deux se taisent');
    vrai(!echeancierCredit(d).amortissable, 'et l’échéancier le dit');
    pres(echeancierCredit(d).capitalDuMois, 0, 'aucun capital remboursé, jamais négatif');

    /* Le cas que l'assurance seule fait basculer : 540 EUR couvriraient les
       interets, mais 60 EUR partent en prime. */
    poserPret({ montant: 100000, taux: 6, mensualite: 540,
                tauxAssurance: 0.72, initial: 100000 });
    d = Store.state.etabs[0].dettes[0];
    pres(assuranceMensuelleCredit(d), 60, 'soixante euros de prime');
    eq(finCredit(d), null, 'donc 480 € face à 500 € d’intérêts : rien ne s’amortit');
  });

  test('une dette soldée n’invente aucune échéance', () => {
    poserPret({ montant: 0 });
    const d = Store.state.etabs[0].dettes[0];
    eq(echeancierCredit(d), null, 'plus rien à amortir');
    eq(finCredit(d), null, 'aucune date');
    eq(resteAPayer(d), null, 'aucune échéance');
    pres(capitalRembourseParMois(), 0, 'et aucun capital remboursé ce mois-ci');
  });

  test('une dette sans mensualité garde ses intérêts', () => {
    /* Le levier d'un courtier : aucun remboursement, mais les interets courent.
       Les deux faits sont rendus, et ils ne se confondent pas. */
    poserPret({ montant: 2000, taux: 5.8, mensualite: 0,
                tauxAssurance: null, initial: null });
    const d = Store.state.etabs[0].dettes[0];
    const e = echeancierCredit(d);
    pres(e.interetsDuMois, 2000 * 5.8 / 100 / 12, 'les intérêts du mois existent');
    eq(e.capitalDuMois, null, 'aucun capital remboursé : il n’y a pas de mensualité');
    vrai(!e.amortissable, 'et aucune fin promise');
    pres(capitalRembourseParMois(), 0, 'Budget ne compte rien pour cette dette');
  });

  test('le même capital remboursé, dans les trois écrans', () => {
    /* Le defaut : Budget comptait 644,79 EUR, la carte des credits et la fiche du
       bien 704,29 -- toutes deux oubliaient l'assurance. */
    Fixture.poser(e => {
      e.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ ...PRET }] }];
      e.comptes = [{ id: 'c_appt', etabId: 'e_bq', type: 'immobilier', statut: 'ouvert',
        libelle: 'Appartement', court: 'Appt', numero: '', notes: '', alloc: '',
        ouvertLe: '2019-01-01', cash: [],
        lignes: [{ id: 'l_appt', classe: 'immobilier', libelle: 'Appartement',
                   valeur: 288000, prixDeRevient: 280000, quantite: 1,
                   dateAcquisition: '2019-01-01' }] }];
      e.monthly = [];
      e.budget.fixedCharges = [];
    });
    const d = Store.state.etabs[0].dettes[0];
    const attendu = echeancierCredit(d).capitalDuMois;
    eq(Math.round(attendu * 100) / 100, 644.79, 'le moteur dit 644,79 €');
    pres(capitalRembourseParMois(), attendu, 'Budget compte le même');
    const carte = creditsEnCours().lignes.find(l => l.libelle === 'Prêt immobilier');
    pres(carte.capital, attendu, 'la carte des crédits aussi');
    pres(carte.interets, echeancierCredit(d).interetsDuMois, 'et les mêmes intérêts');
    const cf = cashFlowBien(Store.state.comptes[0]);
    pres(cf.capitalMois, attendu, 'et la fiche du bien, qui l’oubliait');
  });

  test('la projection du capital restant dû suit les mêmes règles', () => {
    /* Elle propose une mise a jour du solde depuis la derniere verification, et
       elle doit rembourser exactement ce que l'echeancier rembourse. */
    auJour('2026-07-15', () => {
      poserPret({ verifieLe: '2026-01-15' });
      const d = Store.state.etabs[0].dettes[0];
      const p = projectionCredit(d);
      eq(p.moisDepuis, 6, 'six mois écoulés');
      /* Six mois de l'echeancier, rejoues : le meme disponible, la meme
         assurance. */
      const dispo = 894.44 - assuranceMensuelleCredit(d), taux = 1.45 / 100 / 12;
      let capital = 157362;
      for (let i = 0; i < 6; i++) capital = Math.max(0, capital + capital * taux - dispo);
      pres(p.projete, capital, 'et le solde projeté est celui du tableau');
      vrai(p.projete < 157362, 'la dette a baissé');
    });
  });

  test('les deux anciens moteurs délèguent, ils ne calculent plus', () => {
    /* Si l'un des deux reprend un calcul a lui, les dates se remettront a
       diverger sans qu'un ecran le signale. */
    const src = lireSource('assets/store.js');
    for (const nom of ['finCredit', 'resteAPayer']) {
      const i = src.indexOf(`function ${nom}(d) {`);
      vrai(i > 0, `${nom} doit être trouvable`);
      const corps = src.slice(i, src.indexOf('\n}', i));
      vrai(/echeancierCredit\(d\)/.test(corps), `${nom} passe par l’échéancier`);
      vrai(!/Math\.log|while \(/.test(corps), `${nom} ne calcule plus rien lui-même`);
    }
    /* Et une seule boucle d'amortissement dans tout le fichier. */
    eq((src.match(/function echeancierCredit/g) || []).length, 1,
      'un seul échéancier');
    /* Le taux d'assurance d'un credit ne se lit plus que dans la definition :
       les quatre copies sont parties. Le controle compte les lectures HORS de
       cette fonction, pour ne pas dependre du nombre de fois qu'elle s'y
       reference elle-meme. */
    const iA = src.indexOf('function assuranceMensuelleCredit');
    const defA = src.slice(iA, src.indexOf('\n}', iA));
    const dehors = src.replace(defA, '');
    eq((dehors.match(/num\(d\.tauxAssurance\)/g) || []).length, 0,
      'aucune lecture du taux d’assurance en dehors de sa définition');
    eq((src.match(/function assuranceMensuelleCredit/g) || []).length, 1,
      'elle a une définition, et une seule');
  });

  test('la banque du crédit vit dans une seule propriété', () => {
    /* La fiche d'un etablissement editait « organisme » quand tout le reste lit
       « preteur » : taper le nom de la banque depuis cet ecran partait dans une
       clef que personne ne relisait. */
    const src = lireSource('assets/app.js');
    vrai(!/dettes\.\$\{i\}\.organisme/.test(src),
      'aucun champ n’écrit plus la clef abandonnée');
    vrai(/dettes\.\$\{i\}\.preteur/.test(src), 'le champ écrit la clef canonique');
    vrai(!/d\.organisme/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
      'et plus personne ne la lit');

    /* La migration : `preteur` gagne, sinon `organisme` la prend. Idempotente. */
    Fixture.poser(e => {
      e.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [
        { id: 'd1', libelle: 'A', montant: 1000, organisme: 'Crédit Agricole' },
        { id: 'd2', libelle: 'B', montant: 1000, preteur: 'BNP', organisme: 'Autre' },
        { id: 'd3', libelle: 'C', montant: 1000, organisme: '' },
      ] }];
    });
    Store.migrate();
    const [a, b, c] = Store.state.etabs.find(x => x.id === 'e_bq').dettes;
    eq(a.preteur, 'Crédit Agricole', 'la valeur orpheline devient le prêteur');
    eq(b.preteur, 'BNP', 'un prêteur déjà là n’est pas écrasé');
    eq(c.preteur, undefined, 'une valeur vide n’invente rien');
    for (const d of [a, b, c]) {
      eq(d.organisme, undefined, 'et la clef abandonnée disparaît');
    }
    Store.migrate();
    eq(Store.state.etabs.find(x => x.id === 'e_bq').dettes[0].preteur, 'Crédit Agricole',
      'deux passes donnent le même état');
  });

  test('le loyer se déclare avant les charges du propriétaire', () => {
    /* Le texte disait « charges deduites si tu les paies », et `cashFlowBien`
       retranche ensuite les charges rattachees : qui avait compris « net de
       charges » les voyait retirees deux fois. Le libelle change, les montants
       deja saisis ne bougent pas -- personne ne peut savoir comment un ancien
       texte a ete lu. */
    const src = lireSource('assets/app.js');
    vrai(!/charges déduites si tu les paies/.test(src),
      'la formulation qui invitait au double comptage est partie');
    vrai(/hors charges récupérables/.test(src), 'la convention est nommée');
    vrai(/déduites une seule fois/.test(src), 'et l’aide dit qu’elles ne le sont qu’une fois');

    /* La preuve par les chiffres : loyer 1 000, charge 100, mensualite 700. */
    Fixture.poser(e => {
      e.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [
        { id: 'd_loc', libelle: 'Prêt locatif', montant: 100000, taux: 2,
          mensualite: 700 }] }];
      e.comptes = [{ id: 'c_loc', etabId: 'e_bq', type: 'immobilier', statut: 'ouvert',
        libelle: 'Studio', court: 'Studio', numero: '', notes: '', alloc: '',
        ouvertLe: '2020-01-01', cash: [], moisLoues: 12, tauxImpot: 0,
        lignes: [{ id: 'l_loc', classe: 'immobilier', libelle: 'Studio',
                   valeur: 150000, prixDeRevient: 140000, quantite: 1,
                   dateAcquisition: '2020-01-01' }] }];
      e.monthly = [];
      e.budget.income = [{ label: 'Loyer Studio', amount: 1000, period: 'mois',
                            bienId: 'c_loc' }];
      e.budget.fixedCharges = [{ label: 'Taxe foncière', amount: 100, period: 'mois',
                                 bienId: 'c_loc' }];
    });
    const cf = cashFlowBien(Store.state.comptes[0]);
    pres(cf.loyers, 1000, 'le loyer est celui du budget');
    pres(cf.charges, 100, 'la charge est comptée une fois');
    pres(cf.loyers - cf.charges, 900, 'avant crédit, le bien dégage 900 €');
    pres(cf.cashFlow, 200, 'et 200 € après la mensualité, jamais 800 ni 100');
  });

  test('plusieurs charges se soustraient chacune une fois', () => {
    Fixture.poser(e => {
      e.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
      e.comptes = [{ id: 'c_loc', etabId: 'e_bq', type: 'immobilier', statut: 'ouvert',
        libelle: 'Studio', court: 'Studio', numero: '', notes: '', alloc: '',
        ouvertLe: '2020-01-01', cash: [], moisLoues: 12, tauxImpot: 0,
        lignes: [{ id: 'l_loc', classe: 'immobilier', libelle: 'Studio',
                   valeur: 150000, prixDeRevient: 140000, quantite: 1,
                   dateAcquisition: '2020-01-01' }] }];
      e.monthly = [];
      e.budget.income = [{ label: 'Loyer', amount: 1000, period: 'mois', bienId: 'c_loc' }];
      e.budget.fixedCharges = [
        { label: 'Taxe foncière', amount: 100, period: 'mois', bienId: 'c_loc' },
        { label: 'Copropriété', amount: 80, period: 'mois', bienId: 'c_loc' },
        { label: 'PNO', amount: 20, period: 'mois', bienId: 'c_loc' },
        { label: 'Sans rapport', amount: 500, period: 'mois' },
      ];
    });
    const cf = cashFlowBien(Store.state.comptes[0]);
    pres(cf.charges, 200, 'les trois charges du bien, et elles seules');
    pres(cf.cashFlow, 800, 'donc 800 € de cash-flow, sans crédit');
  });
});

/* ------------------------------------------------------------------
   La jauge de variation du journal
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   « Impact mensuel » montre ce qui a un sens, et rien d'autre
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   Le francais ecrit hors de trad()
   ------------------------------------------------------------------ */
suite('Aucun français ne s’affiche hors du dictionnaire', () => {

  /* Les autres controles d'i18n inspectent les APPELS `trad('...')` et exigent
     qu'une clef existe. Ils sont aveugles a ce qui ne passe pas par `trad()` du
     tout, et c'est la que le francais se cache :

       <label>Prix d'acquisition ({dev})${aide(...)}</label>
       aria-label="Variation mensuelle du patrimoine"
       ? 'Rouvrir tous les groupes' : 'Ne garder que les totaux'
       btn.setAttribute('title', 'Vider le champ')
       titre: `Charge de ${nomCompteV2(c)}`

     Onze chaines s'affichaient ainsi en francais dans l'interface anglaise, et
     seule une lecture du texte REELLEMENT rendu par le navigateur les a
     trouvees. Ce controle-ci les cherche dans la source, ou il peut tourner.

     La methode : effacer d'abord tout ce qui est deja traduit -- le contenu de
     chaque `trad(...)`, les commentaires -- puis chercher une lettre accentuee
     dans ce qui reste. L'accent est le signal le plus sur : il ne se trouve ni
     dans un identifiant, ni dans une classe CSS, ni dans un mot anglais. */

  /* Ce qui reste apres nettoyage, fichier par fichier. */
  const nettoyer = src => src
    /* les commentaires : ils ont le droit d'etre en francais, et ils le sont */
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^[ \t]*\/\/[^\n]*$/gm, ' ')
    /* le contenu de chaque trad(), concatenations comprises */
    .replace(/trad\(\s*'(?:[^'\\]|\\.)*'(?:\s*\+\s*'(?:[^'\\]|\\.)*')*/g, "trad('')")
    .replace(/trad\(\s*"(?:[^"\\]|\\.)*"(?:\s*\+\s*"(?:[^"\\]|\\.)*")*/g, 'trad("")')
    /* une clef pointee porte son repli en second argument */
    .replace(/trad\('[\w.]+',\s*'(?:[^'\\]|\\.)*'\)/g, "trad('k','')");

  const ACCENT = /[àâäéèêëîïôöùûüÿçœÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇŒ]/;

  /* Un second controle a ete essaye ici, puis retire : il cherchait toute lettre
     accentuee vivant hors d'un `trad(...)` dans app.js. Il a rendu 147
     trouvailles dont presque toutes fausses -- le nettoyage prealable ne sait pas
     suivre un `trad('...' + '...')` etale sur cinq lignes, ni les chaines qu'un
     appelant traduit pour son compte (`aide()`, les libelles d'`askForm`). Un
     controle qui crie sur du code juste finit par ne plus etre lu.

     La methode qui marche est ailleurs, et elle a trouve les onze : lire le
     texte REELLEMENT affiche par le navigateur en anglais, sur chaque vue et
     chaque fiche. Elle demande un navigateur, donc elle ne tient pas dans cette
     suite ; elle se refait a la main quand un ecran change. */

  test('les tables de données ont toutes leur traduction', () => {
    /* L'autre moitie du meme defaut, et l'audit ne la voit pas non plus : quand
       la clef se calcule -- `trad(typeCompte(c.type).label)` -- rien dans la
       source ne dit quelle chaine sera demandee. On interroge donc les tables
       elles-memes.

       « Bien immobilier » manquait ici, et s'ecrivait en toutes lettres en tete
       de la carte d'un bien dans l'interface anglaise. */
    const dico = lireSource('assets/i18n.js') || '';
    const manque = [];
    const verifier = (source, valeurs) => {
      for (const v of valeurs) {
        if (typeof v !== 'string' || !v.trim() || !ACCENT.test(v)) continue;
        /* Les deux ecritures : ce dictionnaire declare ses clefs tantot entre
         guillemets, tantot entre apostrophes. N'en chercher qu'une signalait
         trois clefs qui existaient -- et les ajouter aurait fait trois doublons,
         que le controle voisin a immediatement vus. */
      if (!dico.includes(`"${v}"`) && !dico.includes(`'${v}'`)) {
        manque.push(`${source} → ${v}`);
      }
      }
    };
    verifier('TYPES_COMPTE', TYPES_COMPTE.map(x => x.label));
    verifier('CLASSES_ACTIFS', Object.values(CLASSES_ACTIFS));
    verifier('ASSET_CLASSES', Object.values(ASSET_CLASSES));
    verifier('CHARGE_PERIODES', CHARGE_PERIODES.map(x => x[1]));
    verifier('USAGES_BIEN', USAGES_BIEN.map(x => x[1]));
    verifier('VERSEMENT_VERS', VERSEMENT_VERS.map(x => x[1]));
    verifier('SCENARIOS_PROJECTION', SCENARIOS_PROJECTION.map(x => x[1]));
    eq(manque.length, 0,
      `une table porte un libellé que le dictionnaire ignore :\n      ${manque.join('\n      ')}`);
  });
});

suite('La fiche d’un logement habité parle de coût, pas de rendement', () => {

  /* Elle couvrait tous les cas a la fois : mensualite, cash-flow, patrimoine,
     rendement, apport, mois loues, fiscalite. Sur une residence principale, la
     moitie n'a aucun sens -- « Rendement brut 0,00 % » laisse croire qu'un calcul
     locatif s'applique, « Mois loues par an : 12 » repond a une question que ce
     bien ne pose pas.

     Un logement qu'on habite pose UNE question : combien il fait sortir chaque
     mois. Et elle a deux reponses qu'il ne faut jamais additionner -- ce qui sort
     du compte, et ce qui s'en va vraiment. */

  const PRET = { id: 'd1', libelle: 'Prêt', montant: 200000, initial: 240000,
                 taux: 2, mensualite: 1000, tauxAssurance: 0.3 };
  const PETIT = { id: 'd2', libelle: 'Prêt travaux', montant: 100000, initial: 100000,
                  taux: 2, mensualite: 500 };
  const TAXE = { label: 'Taxe foncière', amount: 250, period: 'mois', shares: {}, bienId: 'c_b' };

  const bien = (opts = {}) => Fixture.poser(e => {
    e.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: opts.credits || [] }];
    e.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', court: 'Appt', numero: '', notes: '', alloc: '',
      ouvertLe: '2019-01-01', cash: [],
      moisLoues: opts.moisLoues == null ? 12 : opts.moisLoues,
      tauxImpot: opts.tauxImpot || 0, apport: opts.apport || null,
      lignes: (opts.lots || [{ usage: opts.usage }]).map((l, i) => ({
        id: 'l' + i, classe: 'immobilier', libelle: l.libelle || 'Appartement',
        valeur: l.valeur == null ? 300000 : l.valeur,
        prixDeRevient: l.prixDeRevient == null ? 255000 : l.prixDeRevient,
        quantite: 1, dateAcquisition: '2019-01-01',
        ...(l.usage ? { usage: l.usage } : {}) })) }];
    e.positions = []; e.monthly = [];
    e.budget.income = opts.loyer
      ? [{ label: 'Loyer', amount: opts.loyer, period: 'mois', bienId: 'c_b' }] : [];
    e.budget.fixedCharges = opts.charges || [];
  });

  const co = () => coutBien(compteById('c_b'));
  /* La carte d'un logement habite, dans la source : le harnais ne charge pas
     app.js, donc les faits de vue se lisent sur le CODE -- jamais sur un
     commentaire, que le filtre de publication retire. */
  const carte = (nom) => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf(`function ${nom}(`);
    vrai(i > 0, `${nom} doit être trouvable`);
    const suivante = Math.min(...[src.indexOf('\nfunction ', i + 1),
                                  src.indexOf('\nconst ', i + 1)]
      .filter(x => x > 0).concat([src.length]));
    return src.slice(i, suivante);
  };

  test('une résidence principale avec crédit : le total est ce qui sort', () => {
    bien({ usage: 'principale', credits: [{ ...PRET }] });
    pres(co().mensualite, 1000, 'la mensualité, telle que le crédit la porte');
    pres(co().autresCharges, 0, 'aucune charge');
    pres(co().totalSorties, 1000, 'le total est la mensualité seule');
  });

  test('sans crédit, le coût est celui des charges — et rien ne s’affiche à zéro', () => {
    bien({ usage: 'principale', charges: [{ ...TAXE }] });
    pres(co().mensualite, 0, 'aucune mensualité');
    pres(co().totalSorties, 250, 'le total est la charge seule');
    eq(co().capitalMois, null, 'et aucun capital ne se rembourse');
    eq(co().ventilation, 'aucune', 'il n’y a pas de crédit à ventiler');
    /* La section se tait quand le capital est INCONNU, et non quand il est nul :
       un credit qui ne rembourse rien vaut zero, et zero est une reponse. Sans
       credit du tout, il n'y a rien a savoir. */
    vrai(/if \(co\.capitalMois == null\) return '';/.test(carte('blocCapitalRembourse')),
      'la section du capital ne s’écrit pas quand rien n’est connu');
    /* Et sans credit NI charge, la carte invite au lieu d'aligner des zeros. */
    bien({ usage: 'principale' });
    pres(co().totalSorties, 0, 'rien ne sort');
    vrai(/co\.totalSorties < 0\.005 && revenus < 0\.005/.test(carte('carteResidence')),
      'la carte reconnaît ce cas et dit comment en sortir');
  });

  test('charges et mensualité s’additionnent une fois chacune', () => {
    bien({ usage: 'principale', credits: [{ ...PRET }], charges: [{ ...TAXE }] });
    pres(co().totalSorties, 1250, 'mille de crédit et deux cent cinquante de charges');
    /* La charge qui REMBOURSE le credit ne compte pas deux fois : son montant EST
       la mensualite, et la compter des deux cotes la ferait sortir deux fois. */
    bien({ usage: 'principale',
           credits: [{ ...PRET, mensualite: null }],
           charges: [{ label: 'Mensualité', amount: 1000, period: 'mois', shares: {},
                       creditId: 'd1', bienId: 'c_b' }, { ...TAXE }] });
    pres(co().mensualite, 1000, 'la mensualité vient de la charge qui rembourse');
    pres(co().autresCharges, 250, 'et cette charge ne compte plus parmi les autres');
    pres(co().totalSorties, 1250, 'le total ne double pas');
  });

  test('avec un taux connu, capital et coût consommé refont le total', () => {
    bien({ usage: 'principale', credits: [{ ...PRET }], charges: [{ ...TAXE }] });
    const x = co();
    eq(x.ventilation, 'complete', 'la ventilation est entière');
    pres(x.interetsMois, 200000 * 0.02 / 12, 'les intérêts du mois');
    pres(x.assuranceMois, 240000 * 0.003 / 12, 'la prime, sur le capital emprunté');
    pres(x.capitalMois, 1000 - x.assuranceMois - x.interetsMois,
      'et le capital est ce qui reste de la mensualité');
    /* L'invariant qui compte : les deux lignes affichees refont le total payé. */
    pres(x.capitalMois + x.horsCapital, x.totalSorties,
      'capital remboursé et coût hors capital font exactement le total');
    pres(x.horsCapital, x.interetsMois + x.assuranceMois + x.autresCharges,
      'et le coût hors capital est bien intérêts, assurance et charges');
  });

  test('sans taux, la ventilation ne s’invente pas : elle se demande', () => {
    bien({ usage: 'principale', credits: [{ ...PRET, taux: null }] });
    const x = co();
    eq(x.capitalMois, null, 'aucun capital annoncé');
    eq(x.horsCapital, null, 'aucun coût consommé non plus');
    eq(x.ventilation, 'aucune', 'et la vue sait pourquoi');
    pres(x.totalSorties, 1000, 'ce qui sort du compte, lui, reste connu');
    vrai(/Renseigne le taux du crédit pour distinguer capital et intérêts/
      .test(carte('noteVentilation')), 'la carte dit quoi remplir');
    /* Un taux DECLARE a zero n'est pas un taux absent : le pret familial
       s'amortit tout droit. */
    bien({ usage: 'principale', credits: [{ ...PRET, taux: 0, tauxAssurance: 0 }] });
    eq(co().ventilation, 'complete', 'un prêt à 0 % se ventile parfaitement');
    pres(co().capitalMois, 1000, 'et rembourse du capital pour toute sa mensualité');
  });

  test('deux crédits se somment, et un seul sans taux fait taire la ventilation globale', () => {
    bien({ usage: 'principale', credits: [{ ...PRET }, { ...PETIT }] });
    const deux = co();
    pres(deux.mensualite, 1500, 'les deux mensualités');
    eq(deux.ventilation, 'complete', 'les deux portent un taux');
    pres(deux.capitalMois, (1000 - 240000 * 0.003 / 12 - 200000 * 0.02 / 12)
                         + (500 - 100000 * 0.02 / 12), 'les deux parts de capital');
    pres(deux.capitalMois + deux.horsCapital, deux.totalSorties, 'et le total tient');

    bien({ usage: 'principale', credits: [{ ...PRET }, { ...PETIT, taux: null }] });
    const boiteux = co();
    eq(boiteux.ventilation, 'partielle', 'un crédit sur deux ne dit pas son taux');
    eq(boiteux.nbCredits, 2, 'sur deux crédits');
    eq(boiteux.nbVentiles, 1, 'un seul se ventile');
    eq(boiteux.horsCapital, null,
      'le coût consommé se tait : il compterait les intérêts d’un seul prêt');
    vrai(boiteux.capitalMois > 0,
      'mais le capital connu reste dit : c’est un minorant vrai, pas une invention');
    vrai(/ne compte que les autres/.test(carte('noteVentilation')),
      'et la carte dit ce que ce chiffre ne couvre pas');
  });

  test('aucun rendement, aucune vacance, aucun bouton « + Loyer »', () => {
    const residence = carte('carteResidence');
    for (const locatif of ['Rendement', 'Vacance', 'Cash-flow', 'rendementBrut',
                           'cashOnCash', 'moisLoues', 'reglagesExploitation']) {
      vrai(!new RegExp(locatif).test(residence.replace(/\/\*[\s\S]*?\*\//g, '')),
        `« ${locatif} » n’a rien à faire sur le logement qu’on habite`);
    }
    /* Le bouton se tient a la garde de l'usage, et non a une liste ecrite deux
       fois : c'est la meme fonction qui sert aux trois usages DIRECTS. La pierre
       papier a la sienne, parce qu'elle ne propose pas les memes gestes. */
    const boutons = carte('boutonsRattachement');
    vrai(/usage !== 'locative' \? '' :/.test(boutons),
      '« + Loyer » n’apparaît que sur un bien mis en location');
    vrai(/function boutonsRattachement\(c, usage\) \{/.test(lireSource('assets/app.js')),
      'et la fonction n’a que ce dont elle a besoin : le bien et son usage');
    vrai(/data-action="ajouter-charge-bien"/.test(boutons),
      '« + Charge » vaut pour tous : une résidence principale a une taxe foncière');
    vrai(/boutonsRattachement\(c, usage\)/.test(residence),
      'et la carte du logement lui passe son usage');
  });

  test('le capital remboursé ne grossit jamais ce qui reste à dépenser', () => {
    bien({ usage: 'principale', credits: [{ ...PRET }], charges: [{ ...TAXE }] });
    const x = co();
    vrai(x.capitalMois > 0, 'du capital se rembourse bien ce mois-ci');
    pres(x.totalSorties, x.mensualite + x.autresCharges,
      'le total payé ne le retranche pas : cet argent sort bel et bien du compte');
    /* Et nulle part il ne s'ajoute a un solde. */
    const src = lireSource('assets/app.js');
    vrai(!/capitalMois \+ [^;]*cashFlow|cashFlow \+ [^;]*capitalMois/.test(src),
      'et il ne s’additionne à aucun cash-flow');
    vrai(!/totalSorties - co\.capitalMois/.test(carte('carteResidence')),
      'le total payé n’est pas allégé de sa part de capital');
  });

  test('le budget ne bouge pas d’un centime, quel que soit l’usage', () => {
    for (const usage of ['principale', 'secondaire', 'locative']) {
      bien({ usage, credits: [{ ...PRET }], charges: [{ ...TAXE }], loyer: 900 });
      pres(round2(budgetFrame().fixed), 250, `${usage} : les charges fixes du budget`);
      pres(round2(budgetFrame().income), 900, `${usage} : les revenus du budget`);
      eq(Store.state.budget.income.length, 1, `${usage} : le loyer est toujours là`);
      eq(Store.state.budget.fixedCharges.length, 1, `${usage} : la charge aussi`);
    }
  });

  test('une résidence secondaire coûte, elle ne rapporte pas — même avec un revenu', () => {
    /* Un revenu rattache ne requalifie rien : l'usage declare gagne. C'est le cas
       reel de la location saisonniere, et transformer la fiche en investissement
       locatif repondrait a une question que son detenteur n'a pas posee. */
    bien({ usage: 'secondaire', credits: [{ ...PRET }], charges: [{ ...TAXE }], loyer: 400 });
    const u = usageEffectifBien(compteById('c_b'));
    eq(u.usage, 'secondaire', 'l’usage tient face au revenu');
    eq(u.source, 'declare', 'et il vient d’une déclaration');
    eq(u.action, null, 'rien n’est demandé');
    pres(co().totalSorties, 1250, 'le coût reste le coût : le revenu ne s’en retranche pas');
    eq(Store.state.budget.income.length, 1, 'et le revenu n’est pas supprimé');
    /* Il reste VISIBLE et modifiable, dans sa propre section. */
    const residence = carte('carteResidence');
    vrai(/Revenus liés au bien/.test(residence), 'les revenus liés au bien s’affichent');
    vrai(/action: 'edit-income'/.test(residence), 'et gardent leur porte vers le budget');
    /* Le controle de coherence le signale, sans trancher. */
    const dits = healthChecks().filter(x => /résidence secondaire/.test(x.title || ''));
    eq(dits.length, 1, 'l’incohérence se dit');
    eq(dits[0].level, 'info', 'en information : ce peut être parfaitement volontaire');
  });

  test('les deux logements posent la même question, à deux mots près', () => {
    const residence = carte('carteResidence');
    vrai(/usage === 'principale' \? 'Coût mensuel du logement' : 'Coût mensuel du bien'/
      .test(residence), 'le titre suit l’usage, et lui seul');
    vrai(/trad\('À ta charge'\)/.test(residence),
      'les deux affichent ce qui reste à ta charge');
    /* « Autres charges » et non « Charges proprietaire » : sur un logement qu'on
       habite, le mot designe un statut qui n'apprend rien. */
    vrai(/ligneCharges\(cf, 0, 'Autres charges'\)/.test(residence),
      'et le mot du locatif ne deborde pas sur le logement');
    /* Et une seule fonction les sert : deux jumelles de quatre-vingts lignes
       auraient diverge au premier correctif applique a une seule. */
    const src = lireSource('assets/app.js');
    vrai(!/function carteResidencePrincipale|function carteResidenceSecondaire/.test(src),
      'une seule fonction, parce que la question est la même');
    /* Les deux traductions existent. */
    vrai(I18N.en['Coût mensuel du logement'] && I18N.en['Coût mensuel du bien'],
      'et les deux titres ont leur anglais');
  });
});

suite('Une jauge dit le rythme sans rien ajouter au chiffre', () => {

  /* L'espace entre le mois et les montants porte une barre : elle part d'un
     zero commun aux lignes, sa longueur suit la variation du mois et son cote le
     signe. Elle ne dit rien de plus que le nombre deja ecrit a droite -- c'est
     pour ca qu'elle est `aria-hidden` et qu'elle n'a ni axe, ni etiquette, ni
     infobulle. */

  /* La geometrie vient de l'application, `geometrieJauges`, cote modele : le
     test l'exerce sur des nombres choisis au lieu d'en recopier la regle. */
  const longueurs = variations => {
    const g = geometrieJauges(variations);
    return variations.map(v => g.longueur(v));
  };

  test('la jauge sort du même calcul que le nombre affiché', () => {
    /* Une seule source : la vue passe `jauge: jauges.longueur(dlt)`, et `dlt` est
       exactement la variation ecrite dans la colonne de droite. Aucun second
       calcul, aucune performance recalculee. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewHistory('),
                          src.indexOf('function mountHistory('));
    vrai(/second: dlt \? fmtSigned\(dlt\) : ''/.test(vue),
      'la colonne de droite affiche dlt');
    vrai(/jauge: jauges\.longueur\(dlt\), jaugeZero: jauges\.zero/.test(vue),
      'et la jauge dessine le même dlt, depuis le zéro commun');
    /* Et la geometrie est commune aux lignes affichees, non recalculee par ligne. */
    vrai(/const jauges = geometrieJauges\(lignes\.map\(x => x\.dlt\)\);/.test(vue),
      'la géométrie se construit une fois, sur les lignes affichées');
  });

  test('positif à droite du zéro, négatif à gauche, plat sur le zéro', () => {
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function ligneListe('), src.indexOf('\n}',
      src.indexOf('function ligneListe(')));
    vrai(/part > 0 \? 'up' : 'down'/.test(fn), 'le signe décide de la couleur');
    vrai(/left:\$\{zero\.toFixed\(1\)\}%` : `right:\$\{\(100 - zero\)\.toFixed\(1\)\}%`/.test(fn),
      'et du côté : la barre part du zéro, à droite ou à gauche');
    vrai(/Math\.abs\(part\) < 0\.005/.test(fn), 'un mois plat est reconnu');
    vrai(/<i class="plat" style="left:clamp\(3px, \$\{zero\.toFixed\(1\)\}%, calc\(100% - 3px\)\)"><\/i>/.test(fn),
      'et pose un point neutre sur le zéro, qui reste dans la piste à ses bords');
    /* La longueur est une fraction de la piste entiere : le zero se place, la
       barre ne se borne plus a une moitie. */
    vrai(/Math\.abs\(part\) \* 100/.test(fn),
      'une fraction pleine occupe toute la piste');
  });

  test('l’échelle est commune, donc les longueurs se comparent', () => {
    /* Des variations fictives : le plus gros mois fait la barre la plus longue,
       et les autres gardent des longueurs distinctes. */
    const v = [4800, 2100, 600, -400];
    const l = longueurs(v);
    vrai(l[1] > l[2] && l[2] > 0,
      '+2 100 € fait plus long que +600 €, et les deux se voient');
    vrai(l[3] < 0, '−400 € part de l’autre côté');
    vrai(Math.abs(l[3]) > 0.05, 'et reste visible malgré sa petitesse');
    /* Aucune normalisation par ligne : sous la saturation, deux mois differents
       donnent deux longueurs differentes. */
    vrai(l[1] !== l[2], 'deux mois différents, non saturés, donnent deux longueurs');
  });

  test('le zéro se place pour que la piste serve', () => {
    /* La plus grosse hausse touche le bord droit, la plus grosse baisse le bord
       gauche, et le zero les separe : une annee presque toute en hausse donne
       presque toute la piste a ses hausses. */
    const v = [4800, 2100, 600, -400];
    const g = geometrieJauges(v);
    const l = v.map(x => g.longueur(x));
    pres(l[0] + Math.abs(l[3]), 1, 'la plus grosse hausse et la plus grosse baisse remplissent la piste');
    pres(g.zero, Math.abs(l[3]), 'le zéro est au bout de la plus grosse baisse');
    vrai(g.zero > 0 && g.zero < 0.2, 'et une petite baisse ne prend qu’une petite part de la piste');
    /* Un euro a la meme longueur des deux cotes, tant qu'aucun ne sature. */
    pres(l[2] / Math.abs(l[3]), 600 / 400, 'un euro a la même longueur en hausse et en baisse');

    const hausses = geometrieJauges([3000, 1200, 800]);
    eq(hausses.zero, 0, 'sans baisse, le zéro est au bord gauche');
    eq(hausses.longueur(3000), 1, 'et la plus grosse hausse a toute la piste');
    const baisses = geometrieJauges([-3000, -1200]);
    eq(baisses.zero, 1, 'sans hausse, le zéro est au bord droit');
    eq(baisses.longueur(-3000), -1, 'et la plus grosse baisse a toute la piste');
  });

  test('un mois exceptionnel n’écrase pas les autres', () => {
    /* Le cas nomme : +50 000 EUR au milieu de mois a 500 - 2 000. Avec le maximum
       pour echelle, +500 ferait un pour cent de la barre -- invisible. La mediane
       ignore l'exception. */
    const v = [50000, 2000, 1500, 900, 500];
    const l = longueurs(v);
    eq(l[0], 1, 'le mois exceptionnel sature');
    vrai(l[1] > 0.3, 'et +2 000 € garde une barre franche');
    vrai(l[4] > 0.08, 'même +500 € reste visible');
    /* Contre-epreuve : avec le maximum seul, le plus petit serait invisible. */
    vrai(500 / 50000 < 0.02, 'là où l’échelle par le maximum le rendrait invisible');
  });

  test('un seul relevé, ou un mois plat, ne casse pas l’échelle', () => {
    eq(geometrieJauges([3000]).longueur(3000), 1, 'un mois seul occupe la barre entière');
    eq(geometrieJauges([0]).longueur(0), 0, 'un mois plat ne divise par rien');
    eq(geometrieJauges([]).longueur(0), 0, 'et une liste vide non plus');
    eq(geometrieJauges([0, 0]).zero, 0.5, 'sans échelle, le zéro reste au milieu');
    /* Le premier releve de la serie n'a pas de variation : la vue lui passe
       zero, donc l'etat neutre, et non une barre inventee. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewHistory('),
                          src.indexOf('function mountHistory('));
    vrai(/dlt: avant \? net - avant\.net : 0/.test(vue),
      'le premier relevé a une variation nulle, donc une jauge neutre');
  });

  test('la jauge est décorative, et la ligne reste un seul bouton', () => {
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function ligneListe('), src.indexOf('\n}',
      src.indexOf('function ligneListe(')));
    vrai(/class="ml-jauge" aria-hidden="true"/.test(fn),
      'un lecteur d’écran l’ignore : le nombre est déjà lu');
    /* Aucun controle dans la jauge : pas de bouton, pas de lien, pas de title. */
    const i = fn.indexOf('ml-jauge');
    const bloc = fn.slice(i, fn.indexOf('</span>`}', i));
    vrai(!/<button|<a |title=|data-action/.test(bloc),
      'elle ne devient pas un contrôle : la ligne entière ouvre le relevé');
    /* Et la ligne est toujours un seul bouton. */
    eq((fn.match(/<button/g) || []).length, 1, 'un seul bouton par ligne');
  });

  test('la jauge cède la place au texte, jamais l’inverse', () => {
    /* Elle vit dans l'espace laisse libre, et c'est elle qui grandit sur ces
       lignes, pas le nom du mois, dont la colonne est fixe. Sous 360 px elle
       disparait : le mois, le montant et la variation passent avant. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const regle = (css.match(/\.ml-jauge \{[^}]*\}/) || [''])[0];
    /* C'est la piste qui prend le vide entre le mois et les montants. */
    vrai(/flex: 1 1 auto/.test(regle), 'la piste prend l’espace laissé libre');
    vrai(/min-width: 24px/.test(regle), 'sans jamais disparaître tout à fait');
    /* La colonne du mois est FIXE sur ces lignes, et c'est ce qui aligne les
       axes : deux largeurs de colonne donneraient deux pistes qui ne commencent
       pas au meme endroit, et le zero implicite disparaitrait. */
    vrai(/\.mlist\.avec-jauge \.ml-nom \{[^}]*flex: 0 0 6\.5em/.test(css),
      'la colonne du mois est fixe, donc les axes s’alignent d’une ligne à l’autre');
    vrai(/\.ml-chiffres \{[^}]*flex: none/.test(css), 'les montants ne se compriment pas');
    /* Et les cinq autres ecrans qui utilisent `ligneListe` gardent leur mise en
       page : la regle porte sur `.avec-jauge`, jamais sur `.mlist` en general. */
    vrai(/\.ml-nom \{[^}]*flex: 1 1 auto/.test(css),
      'ailleurs, le nom garde la croissance');
    const petit = css.slice(css.indexOf('@media (max-width: 359px)'));
    vrai(/\.ml-jauge \{ display: none; \}/.test(petit),
      'sous 360 px, le texte passe avant');
  });

  test('aucune couleur nouvelle, aucune légende', () => {
    /* Les teintes sont celles de l'application : `--good`, `--critical`,
       `--muted`. Pas de palette de plus, pas d'axe, pas d'etiquette. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const bloc = css.slice(css.indexOf('.ml-jauge'), css.indexOf('.ml-chev'));
    for (const teinte of ['var(--good)', 'var(--critical)', 'var(--muted)']) {
      vrai(bloc.includes(teinte), `${teinte} vient du thème`);
    }
    vrai(!/#[0-9a-fA-F]{3,6}/.test(bloc), 'aucune couleur écrite en dur');
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function ligneListe('), src.indexOf('\n}',
      src.indexOf('function ligneListe(')));
    vrai(!/legend|trad\(/.test(fn.slice(fn.indexOf('ml-jauge'))),
      'et aucun texte : rien à traduire, rien à lire');
  });

  test('le dépliant « Voir les données » de la courbe est parti, et son attirail', () => {
    /* Il rendait les memes nombres que la courbe trace juste au-dessus, sous une
       autre forme, derriere un pli. Le journal des releves donne deja mois par
       mois ce qu'il montrait, avec la porte pour corriger chaque ligne. */
    const src = lireSource('assets/app.js');
    const sansCom = src.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const mort of ['detailEvolution', 'evoDetail', 'evoYear', 'evo-year']) {
      vrai(!sansCom.includes(mort), `« ${mort} » est parti avec le dépliant`);
    }
    /* Les deux ecrans rendent donc la meme carte, sans drapeau. */
    vrai(/function carteEvolution\(\) \{/.test(src),
      'carteEvolution n’a plus de paramètre');
    /* Et la classe CSS qui n'avait que ce tableau pour cliente. */
    const css = lireSource('assets/styles.css') || '';
    vrai(!css.includes('sticky-fin'), 'la règle qui épinglait son total est partie avec');
    vrai(css.includes('sticky-col'), 'celle des autres tableaux reste');
  });
});

suite('Le net dit la vérité, même sous zéro', () => {

  const releve = (avoirs, dettes, mois) => ({
    date: mois, comment: '', dettes, v: { c_courant: avoirs },
  });
  const poser = (...lignes) => Fixture.poser(e => {
    e.comptes = [{ id: 'c_courant', etabId: 'e_b', type: 'courant', statut: 'ouvert',
      libelle: 'Courant', court: 'Courant', numero: '', notes: '', alloc: '',
      ouvertLe: '2019-01-01', cash: [{ montant: 0, affectation: 'courant' }], lignes: [] }];
    e.etabs = [{ id: 'e_b', nom: 'Banque', notes: '', dettes: [] }];
    e.monthly = lignes;
  });

  test('cinquante mille d’avoirs et soixante-dix mille de dette font moins vingt mille', () => {
    poser(releve(50000, 70000, '2026-01-01'));
    const r = Store.state.monthly[0];
    pres(rowTotal(r), 50000, 'les avoirs valent cinquante mille');
    pres(rowNet(r), -20000, 'et le net vaut moins vingt mille, jamais zéro');
    /* La serie publie le meme nombre : c'est elle que la courbe et les
       variations lisent. */
    const pt = historySeries({ includeNow: false })[0];
    pres(pt.net, -20000, 'la série le publie tel quel');
  });

  test('la pile de la courbe nette ne perd pas le reliquat de dette', () => {
    /* Le defaut, precisement : la dette se retranchait poche par poche en
       s'arretant a zero sur chacune, donc tout ce qui depassait les avoirs
       disparaissait. La courbe se posait a zero au lieu de descendre sous
       l'axe, et un patrimoine negatif n'apparaissait jamais.

       Ce controle REJOUAIT la regle sur ses propres donnees, parce que
       `pointsEvolution` vivait dans app.js, que le harnais ne charge pas : une
       copie du calcul servait a verifier le calcul. Elle ne pouvait rien
       prouver — les deux pouvaient se tromper de la meme facon, et le seul
       ancrage sur le vrai code etait une expression rationnelle sur sa source.

       La fonction vit dans `store.js` : on l'appelle. */
    poser(releve(50000, 70000, '2026-01-01'));
    /* Sans le point d'aujourd'hui : le fixture de cette suite n'a qu'un compte
       de cash a zero, et la photo actuelle ecraserait le releve qu'on teste. */
    const pt = pointsEvolution({ net: true }).find(p => p.date === '2026-01-01');
    vrai(pt, 'le relevé de janvier doit être dans la série');
    pres(pt.total, -20000, 'les avoirs moins les dettes, jamais zéro');
    pres(POCHES_EVOLUTION.reduce((s, c) => s + num(pt[c]), 0), -20000,
      'la somme des poches vaut le total : la pile fait son total');
    pres(pt.immo, -20000, 'et le reliquat se voit, sur la poche des prêts');
  });

  test('en brut, la même courbe ne retranche rien', () => {
    /* La bascule du haut de page gouverne la courbe depuis qu'elle n'a plus la
       sienne. Le brut doit donc rendre les avoirs tels quels, dette comprise
       nulle part. */
    poser(releve(50000, 70000, '2026-01-01'));
    const pt = pointsEvolution({ net: false }).find(p => p.date === '2026-01-01');
    pres(pt.total, 50000, 'les avoirs seuls');
    pres(num(pt.immo), 0, 'et rien n’est allé chercher la dette sur une poche');
  });

  test('un mois sans relevé compte pour le temps qu’il a pris', () => {
    /* LE DEFAUT. La moyenne valait `somme / nombre d'ecarts`. Tant qu'on saisit
       tous les mois les deux coincident, et c'est pour ca qu'il a tenu. Un mois
       saute, et ils divergent : janvier 100 000, avril 106 000, un seul ecart de
       +6 000, donc « 6 000 EUR par mois » pour un rythme reel de 2 000. Le
       chiffre nourrit le rythme d'accumulation, la trajectoire vers l'objectif
       et l'ecart au budget : trois lectures triplees d'un coup, du cote
       flatteur. */
    poser(releve(100000, 0, '2026-01-01'), releve(106000, 0, '2026-04-01'));
    const p = monthlyPace();
    eq(p.count, 1, 'deux relevés, un seul écart');
    eq(p.mois, 3, 'mais trois mois se sont écoulés');
    eq(p.points[0].mois, 3, 'et l’écart le porte lui-même');
    pres(p.points[0].delta, 6000, 'le delta brut reste le delta brut');
    pres(p.average, 2000, 'la moyenne mensuelle vaut deux mille, pas six');
    /* Février et mars ne sont pas inventés pour autant. */
    eq(historySeries({ includeNow: false }).length, 2, 'deux points, et deux seulement');
    eq(p.positive, 1, 'une hausse observée');
  });

  test('sans mois manqué, la moyenne ne bouge pas d’un centime', () => {
    /* La correction ne doit rien changer au cas ordinaire : douze relevés
       mensuels, douze écarts, douze mois. */
    const lignes = [];
    for (let m = 1; m <= 12; m++)
      lignes.push(releve(100000 + m * 500, 0, `2026-${String(m).padStart(2, '0')}-01`));
    poser(...lignes);
    const p = monthlyPace();
    eq(p.count, 11, 'onze écarts');
    eq(p.mois, 11, 'et onze mois : les deux coïncident');
    pres(p.average, 500, 'cinq cents par mois');
    pres(p.average, p.points.reduce((s, x) => s + x.delta, 0) / p.count,
      'la moyenne par écart et la moyenne par mois donnent le même nombre');
  });

  test('le journal dit quand un écart couvre plusieurs mois', () => {
    /* Le chiffre de droite ne change pas : c'est le delta brut entre deux
       relevés. Mais « +2 850 EUR » sous « juil. 26 » se lit comme un mois
       exceptionnel quand mai et juin manquent, et trois mois ordinaires
       l'expliquent. La mention se tait dans le cas ordinaire. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('const lignes = tous.filter'),
                          src.indexOf('Entrées et sorties exceptionnelles'));
    vrai(/mois: avant \? moisEntre\(avant\.r\.date, r\.date\) : 0/.test(src),
      'chaque ligne du journal sait sur combien de mois porte son écart');
    vrai(/trad\('écart sur \{n\} mois'\)/.test(vue),
      'la ligne du journal porte la mention');
    vrai(/mois > 1/.test(vue), 'et ne la pose qu’au-dessus d’un mois');
    vrai(I18N.en['écart sur {n} mois'], 'la mention est traduite');
  });

  test('la moyenne se divise par des mois, jusque dans la réconciliation', () => {
    /* `savingsReconciliation` annonce « N derniers mois clos » : elle lisait le
       nombre d'écarts, donc « 1 dernier mois clos » pour une période de trois. */
    poser(releve(100000, 0, '2026-01-01'), releve(106000, 0, '2026-04-01'));
    const rec = savingsReconciliation();
    eq(rec.monthsSpan, 3, 'trois mois clos, et non un écart');
    pres(rec.realPerMonth, 2000, 'et le rythme réel suit la même division');
  });

  test('deux relevés du même mois ne divisent pas par zéro', () => {
    /* Une clôture au 31/12 est une deuxième photo de décembre. `monthlyPace`
       l'écarte déjà ; la borne à un mois est la ceinture. */
    eq(moisEntre('2026-12-01', '2026-12-31'), 1, 'le même mois vaut un');
    eq(moisEntre('2026-12-01', '2027-01-01'), 1, 'décembre à janvier vaut un');
    eq(moisEntre('2026-01-01', '2027-01-01'), 12, 'et une année en vaut douze');
    eq(moisEntre('2026-04-01', '2026-01-01'), 1, 'un ordre inversé ne rend jamais zéro');
  });

  test('le passé ne se recalcule pas avec les comptes d’aujourd’hui', () => {
    /* Trois faits d'un coup, et ils tiennent tous : un compte créé plus tard
       n'apparaît pas dans le passé, un compte archivé n'efface pas le passé, et
       un compte renommé garde son montant parce que la clef est son identifiant. */
    Fixture.poser(e => {
      e.comptes = [
        { id: 'c_a', etabId: 'e_b', type: 'courant', statut: 'ouvert', libelle: 'Mon compte',
          court: 'Mon compte', numero: '', notes: '', alloc: '', ouvertLe: '2019-01-01',
          cash: [{ montant: 0, affectation: 'courant' }], lignes: [] },
        { id: 'c_b', etabId: 'e_b', type: 'livret', statut: 'ouvert', libelle: 'Livret',
          court: 'Livret', numero: '', notes: '', alloc: '', ouvertLe: '2019-01-01',
          cash: [{ montant: 0, affectation: 'precaution' }], lignes: [] },
      ];
      e.etabs = [{ id: 'e_b', nom: 'Banque', notes: '', dettes: [] }];
      e.monthly = [{ date: '2026-01-01', comment: '', dettes: 0, v: { c_a: 10000, c_b: 20000 } }];
    });
    refreshAccounts();
    const janvier = () => historySeries({ includeNow: false })[0].total;
    pres(janvier(), 30000, 'janvier vaut trente mille');
    /* Archivage : le passé ne bouge pas. */
    compteById('c_b').statut = 'archive';
    refreshAccounts();
    pres(janvier(), 30000, 'archiver le livret n’efface pas les vingt mille de janvier');
    /* Renommage : le montant suit l'identifiant, jamais le libellé. */
    compteById('c_a').libelle = 'Compte courant principal';
    compteById('c_a').court = 'Compte courant principal';
    refreshAccounts();
    pres(janvier(), 30000, 'renommer un compte ne casse pas son historique');
    pres(num(Store.state.monthly[0].v.c_a), 10000, 'le montant reste rattaché à son identifiant');
  });

  test('un compte créé plus tard n’apparaît pas dans le passé', () => {
    /* Les deux comptes existent aujourd'hui ; seul le relevé de février porte le
       second. C'est la question posée : le passé connaît-il un compte ouvert
       après lui ? */
    Fixture.poser(e => {
      e.comptes = [
        { id: 'c_courant', etabId: 'e_b', type: 'courant', statut: 'ouvert', libelle: 'Courant',
          court: 'Courant', numero: '', notes: '', alloc: '', ouvertLe: '2019-01-01',
          cash: [{ montant: 0, affectation: 'courant' }], lignes: [] },
        { id: 'c_pea', etabId: 'e_b', type: 'pea', statut: 'ouvert', libelle: 'PEA',
          court: 'PEA', numero: '', notes: '', alloc: '', ouvertLe: '2026-02-01',
          cash: [], lignes: [] },
      ];
      e.etabs = [{ id: 'e_b', nom: 'Banque', notes: '', dettes: [] }];
      e.monthly = [
        { date: '2026-01-01', comment: '', dettes: 0, v: { c_courant: 10000 } },
        { date: '2026-02-01', comment: '', dettes: 0, v: { c_courant: 7000, c_pea: 5000 } },
      ];
    });
    refreshAccounts();
    const pts = historySeries({ includeNow: false });
    pres(pts[0].total, 10000, 'janvier ne connaît pas le PEA');
    pres(pts[1].total, 12000, 'février le connaît');
    pres(monthlyPace().points[0].delta, 2000, 'et l’écart vaut deux mille');
    vrai(!('c_pea' in Store.state.monthly[0].v), 'aucun PEA rétroactif n’a été posé');
  });

  test('supprimer un compte laisse une pierre tombale, et le passé avec', () => {
    /* Un relevé ancien n'a pas de ventilation `parts` : son total se recompose
       en parcourant les comptes CONNUS. Un compte retiré de la liste emporterait
       donc ses montants passés. L'application ne le retire pas vraiment : elle
       pose d'abord une pierre tombale dans `accounts`, invisible partout, et
       c'est elle qui garde son sens à la colonne du relevé. */
    Fixture.poser(e => {
      e.comptes = [
        { id: 'c_a', etabId: 'e_b', type: 'courant', statut: 'ouvert', libelle: 'A', court: 'A',
          numero: '', notes: '', alloc: '', ouvertLe: '2019-01-01',
          cash: [{ montant: 0, affectation: 'courant' }], lignes: [] },
        { id: 'c_b', etabId: 'e_b', type: 'livret', statut: 'ouvert', libelle: 'B', court: 'B',
          numero: '', notes: '', alloc: '', ouvertLe: '2019-01-01',
          cash: [{ montant: 0, affectation: 'precaution' }], lignes: [] },
      ];
      e.etabs = [{ id: 'e_b', nom: 'Banque', notes: '', dettes: [] }];
      /* Sans `parts` : la forme des relevés écrits avant qu'elle existe. */
      e.monthly = [{ date: '2026-01-01', comment: '', dettes: 0, v: { c_a: 10000, c_b: 20000 } }];
    });
    refreshAccounts();
    pres(historySeries({ includeNow: false })[0].total, 30000, 'janvier vaut trente mille');
    const c = compteById('c_b');
    Store.state.accounts.push({ id: c.id, label: nomCompteV2(c), short: c.court || '',
      broker: nomEtabDe(c), type: c.type, group: typeCompte(c.type).groupe, legacy: true });
    Store.state.comptes = Store.state.comptes.filter(x => x.id !== c.id);
    refreshAccounts();
    pres(historySeries({ includeNow: false })[0].total, 30000,
      'et il les vaut toujours une fois le livret supprimé');
    vrai(ACCOUNTS.some(a => a.id === 'c_b' && a.legacy),
      'la pierre tombale porte le drapeau qui la rend invisible ailleurs');
  });

  test('corriger un mois ne touche aucun autre', () => {
    poser(releve(100000, 0, '2026-01-01'), releve(103000, 0, '2026-02-01'),
          releve(105000, 0, '2026-03-01'));
    Store.state.monthly[0].v.c_courant = 101000;
    eq(Store.state.monthly.map(r => num(r.v.c_courant)).join(','), '101000,103000,105000',
      'seule la valeur corrigée a changé');
    eq(monthlyPace().points.map(p => p.delta).join(','), '2000,2000',
      'et les écarts se recalculent des deux côtés');
  });

  test('supprimer le dernier relevé rouvre l’état vide', () => {
    poser(releve(100000, 0, '2026-01-01'));
    vrai(aUnRelevePatrimonial(), 'un relevé existe');
    clearMonthRow(Store.state.monthly[0], 'comment');
    eq(aUnRelevePatrimonial(), false, 'il n’en reste aucun');
    eq(historySeries({ includeNow: false }).length, 0, 'la série est vide');
    const p = monthlyPace();
    eq(p.count, 0, 'aucun écart');
    eq(p.average, 0, 'et aucune moyenne inventée');
    vrai(Number.isFinite(p.average) && Number.isFinite(p.averageHorsApports),
      'rien ne rend NaN');
  });

  test('dépenses et relevé ne se valident jamais l’un l’autre', () => {
    /* Deux notions, deux questions : un flux du mois et un stock à une date. */
    poser();
    Store.state.budget.expenses = [{ date: '2026-09-01', v: { courses: 600 } }];
    eq(aUnRelevePatrimonial(), false, 'des dépenses ne font pas un relevé');
    eq(aDesDepensesSaisies(), true, 'mais elles se comptent comme dépenses');
    eq(historySeries({ includeNow: false }).length, 0, 'et l’historique n’invente pas septembre');
    poser(releve(5000, 0, '2026-09-01'));
    Store.state.budget.expenses = [];
    eq(aUnRelevePatrimonial(), true, 'un relevé se compte comme relevé');
    eq(aDesDepensesSaisies(), false, 'et ne ferme pas l’étape des dépenses');
  });

  test('la performance de marché n’est pas une capacité d’épargne', () => {
    /* Non-regression : dix mille de hausse entre deux relevés ne deviennent ni
       du budget investissable, ni un versement suggéré. */
    poser(releve(100000, 0, '2026-01-01'), releve(110000, 0, '2026-02-01'));
    Store.state.budget.income = []; Store.state.budget.fixedCharges = [];
    pres(monthlyPace().points[0].delta, 10000, 'le patrimoine a bien monté de dix mille');
    pres(suggestedMonthly(), 0, 'et le versement suggéré reste à zéro');
    const rec = savingsReconciliation();
    vrai(rec.investable <= 0, 'aucun euro investissable n’est né de la hausse');
  });

  test('un relevé qui ne porte qu’une dette n’est pas vide', () => {
    /* Zero avoir, vingt mille de dette : `rowIsEmpty` ne regardait que les
       montants par compte, donc ce relevé disparaissait du journal, des années
       offertes au sélecteur, de la courbe et de toutes les statistiques. Son
       patrimoine net vaut -20 000 EUR, ce qui est un fait. */
    poser(releve(0, 20000, '2026-01-01'));
    const r = Store.state.monthly[0];
    vrai(!rowIsEmpty(r), 'il porte une dette, donc il porte quelque chose');
    pres(rowNet(r), -20000, 'et son net vaut moins vingt mille');
    /* Tout ce qui derive de cette notion le voit. */
    eq(historySeries({ includeNow: false }).length, 1, 'la série le compte');
    vrai(historyYears().includes('2026'), 'et son année est offerte au sélecteur');
  });

  test('une ligne du calendrier reste vide', () => {
    /* L'autre moitie : la definition ne s'est pas seulement elargie, elle est
       restee juste. Une ligne du calendrier ne devient pas un releve.

       Le fixture disait `v: { c_courant: 0 }`, ce qui n'est PAS une ligne de
       calendrier mais un zero declare — et un zero declare est desormais un
       fait. Une ligne du calendrier ne porte aucune clef : c'est ce que
       `clearMonthRow` ecrit, et ce que le calendrier ouvre. */
    poser({ date: '2026-01-01', comment: '', v: {}, dettes: 0 });
    vrai(rowIsEmpty(Store.state.monthly[0]), 'aucun champ rempli : vide');
    Store.state.monthly[0].dettes = undefined;
    vrai(rowIsEmpty(Store.state.monthly[0]), 'et une dette absente vaut une dette nulle');
    eq(historySeries({ includeNow: false }).length, 0, 'la série ne le compte pas');
    /* Les deux formes vides d'un ancien etat comptent pour absentes. */
    for (const rien of [null, '']) {
      Store.state.monthly[0].v = { c_courant: rien };
      vrai(rowIsEmpty(Store.state.monthly[0]),
        `un champ à ${JSON.stringify(rien)} n’est pas une réponse`);
    }
  });

  test('un compte déclaré à zéro est un relevé, et un vrai', () => {
    /* LE DEFAUT. Un releve ne se lit pas vide par `every(x => !num(x))` : un
       releve ou chaque compte est declare a zero passerait pour vide. Le cas est
       reel -- on vide un compte, on solde un livret -- et c'est meme le moment
       ou la photo compte le plus. Janvier 1 000, fevrier 0 : fevrier
       disparaitrait du journal, de la courbe et des variations, et l'ecart de
       -1 000 avec lui. La photo dit que le compte est vide, l'application
       comprendrait qu'on n'a pas repondu. */
    poser(releve(1000, 0, '2026-01-01'), releve(0, 0, '2026-02-01'));
    vrai(!rowIsEmpty(Store.state.monthly[1]), 'février porte une réponse : zéro');
    eq(historySeries({ includeNow: false }).length, 2, 'la série compte les deux mois');
    pres(rowNet(Store.state.monthly[1]), 0, 'et février vaut zéro, ce qui est un fait');
    const pace = monthlyPace();
    eq(pace.count, 1, 'un écart mesuré');
    pres(pace.points[0].delta, -1000, 'et il vaut moins mille, jamais rien');
  });

  test('effacer un relevé le fait vraiment quitter le journal', () => {
    /* La consequence de l'elargissement, et elle se serait vue tout de suite :
       `clearMonthRow` videt les montants et laissait la dette, donc le relevé
       qu'on vient d'effacer restait au journal avec son seul capital restant dû.
       Le geste aurait dit l'inverse de ce qu'il fait. */
    poser(releve(50000, 70000, '2026-01-01'));
    vrai(!rowIsEmpty(Store.state.monthly[0]), 'le relevé existe');
    clearMonthRow(Store.state.monthly[0], 'comment');
    vrai(rowIsEmpty(Store.state.monthly[0]), 'effacé, il est vide');
    eq(Store.state.monthly[0].dettes, undefined, 'sa dette est partie avec ses montants');
    eq(historySeries({ includeNow: false }).length, 0, 'et il quitte la série');
    /* Le texte du geste ne promet plus une liste de douze mois : cette liste
       n'existe plus pour les relevés. */
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('async function viderOuSupprimerMois'),
                         src.indexOf('function askMonthlySnapshot'));
    vrai(!/douze mois/.test(fn), 'le texte ne parle plus de douze mois affichés');
    vrai(/quittera le journal/.test(fn), 'il dit que le mois quitte le journal');
    vrai(/remettra à sa place/.test(fn), 'et qu’on peut le recréer');
  });

  test('la confirmation d’enregistrement annonce le net', () => {
    /* Elle annonçait le brut : « 354 151 EUR enregistré », puis le journal
       affichait 198 151 EUR. Deux chiffres pour un seul geste. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf("${trad('enregistré')}`);", src.indexOf('function askMonthlySnapshot'));
    const bloc = src.slice(i - 500, i + 40);
    vrai(/const brut = rowTotal\(ligne\), net = rowNet\(ligne\)/.test(bloc),
      'la confirmation calcule les deux');
    vrai(/fmtEUR0\(brut\)\} \$\{trad\('brut'\)\} · \$\{fmtEUR0\(net\)\} \$\{trad\('net'\)\}/.test(bloc),
      'et les dit tous les deux quand ils diffèrent');
    vrai(/: fmtEUR0\(net\)/.test(bloc),
      'un seul montant quand il n’y a pas de crédit, et c’est le net');
    vrai(!/fmtEUR0\(rowTotal\(Store\.state\.monthly\[index\]\)\)/.test(bloc),
      'le brut seul ne s’annonce plus');
  });

  test('la carte du jour dit quand son pourcentage est partiel', () => {
    /* La convention ne change pas : le denominateur reste le portefeuille
       entier, et une ligne sans cloture de reference y figure sans entrer dans
       la variation. C'est justement pourquoi il faut le dire a cote du chiffre,
       et non seulement en haut de la carte. Aucune variation inventee. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf("${trad('sur ton portefeuille Marchés depuis la clôture d’hier')}");
    vrai(i > 0, 'la note doit être trouvable');
    const note = src.slice(src.indexOf('function sectionJour()'), src.indexOf('\n}\n', src.indexOf('function sectionJour()')));
    vrai(/j\.sansDonnee \?/.test(note),
      'la mention n’apparaît que s’il manque une clôture de référence');
    vrai(/sans clôture de référence n’y (est|sont) pas compt/.test(note),
      'et elle dit que ces lignes ne sont pas dans le pourcentage');
    /* Le moteur, lui, ne les compte ni au numerateur ni dans la liste. */
    Fixture.poser(e => {
      e.positions = [{ id: 'p1', name: 'Sans cours', isin: '', symbol: 'Y',
        currency: 'EUR', qty: 10, buyPrice: 100, price: 100, fx: 1, fxBuy: 1,
        account: 'c_cto', manual: false, assetClass: 'actions', role: 'core' }];
      e.comptes = [{ id: 'c_cto', etabId: 'e_c', type: 'cto', statut: 'ouvert',
        libelle: 'CTO', court: 'CTO', numero: '', notes: '', alloc: '',
        ouvertLe: '2020-01-01', lignes: [], cash: [] }];
      e.etabs = [{ id: 'e_c', nom: 'Courtier', notes: '', dettes: [] }];
      e.monthly = [];
    });
    const j = dayPerformance();
    eq(j.sansDonnee, 1, 'la ligne se compte à part');
    pres(j.eur, 0, 'aucune variation inventée pour elle');
    eq(j.lignes.length, 0, 'et elle ne figure pas dans la liste');
  });

  test('le dépliant qui renomme et supprime suit le mode de saisie', () => {
    /* Renommer, retirer, supprimer : trois gestes sur des categories, sans objet
       quand on a demande a ne plus en avoir. Le seul geste qui reste offert est
       celui qui annonce ce qu'il fait. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget(section'),
                          src.indexOf('function mountBudget('));
    const i = vue.indexOf("trad('Renommer, retirer ou supprimer une catégorie')");
    vrai(i > 0, 'le dépliant existe, pour qui détaille');
    vrai(/\$\{sansDistinction\(\) \? '' : `/.test(vue.slice(Math.max(0, i - 900), i)),
      'et il ne se rend que si les catégories servent encore');
    /* Les trois actions vivent dedans, donc elles disparaissent avec lui. */
    const fin = vue.indexOf('</details>', i);
    const bloc = vue.slice(i, fin);
    for (const action of ['rename-category', 'retirer', 'del-category']) {
      vrai(bloc.includes(action), `« ${action} » vit dans ce dépliant`);
    }
    /* Et le retour reste offert dans les deux modes. */
    vrai(/data-action="reprendre-detail"/.test(vue),
      '« Remettre toutes les catégories » reste, c’est la seule sortie');
  });

  test('les données catégorisées survivent au mode, une fois de plus', () => {
    /* Deja verifie, et re-verifie ici parce que c'est la promesse que cette
       passe ne doit pas casser : masquer des commandes ne touche a aucun
       montant. */
    Fixture.poser(e => {
      e.budget.categories = ['Courses', 'Sport'];
      e.budget.retirees = [];
      e.budget.expenses = [
        { month: '2026-01-01', v: { Courses: 400, Sport: 60 }, note: '' },
      ];
    });
    const avant = JSON.stringify(Store.state.budget.expenses[0].v);
    const total = expenseRowTotal(Store.state.budget.expenses[0]);
    neePlusDetailler();
    vrai(sansDistinction(), 'le mode est actif');
    eq(JSON.stringify(Store.state.budget.expenses[0].v), avant,
      'la ventilation du mois est intacte, à l’octet');
    pres(expenseRowTotal(Store.state.budget.expenses[0]), total, 'et son total');
    pres(expenseCategoryTotal('Sport'), 60, 'les montants par catégorie sont là');
    reprendreLeDetail();
    for (const c of ['Courses', 'Sport']) {
      vrai(categoriesSaisie().includes(c), `« ${c} » revient à la saisie`);
    }
  });
});

suite('Un relevé se lit en net, partout', () => {

  /* « Aujourd'hui » annonce un net, les variations se comptent en net, le rythme
     d'accumulation aussi -- et le journal des releves montrait le brut. Le meme
     mois valait donc deux montants selon la carte qui le lisait, et l'ecart
     valait un pret immobilier entier. */

  /* Un patrimoine rond : un compte courant, et une dette qu'on fait varier. */
  const releve = (avoirs, dettes, mois) => ({
    date: mois, comment: '', dettes, v: { c_courant: avoirs },
  });
  const poserReleves = (...lignes) => Fixture.poser(e => {
    e.comptes = [{ id: 'c_courant', etabId: 'e_b', type: 'courant', statut: 'ouvert',
      libelle: 'Courant', court: 'Courant', numero: '', notes: '', alloc: '',
      ouvertLe: '2019-01-01', cash: [{ montant: 0, affectation: 'courant' }], lignes: [] }];
    e.etabs = [{ id: 'e_b', nom: 'Banque', notes: '', dettes: [] }];
    e.monthly = lignes;
  });

  test('sans dette, le net vaut le brut', () => {
    poserReleves(releve(100000, 0, '2026-01-31'));
    const r = Store.state.monthly[0];
    pres(rowTotal(r), 100000, 'les avoirs font cent mille');
    pres(rowNet(r), 100000, 'et le net les vaut, faute de dette à retirer');
  });

  test('avec dette, le net retire le capital restant dû', () => {
    poserReleves(releve(300000, 150000, '2026-01-31'));
    const r = Store.state.monthly[0];
    pres(rowTotal(r), 300000, 'les avoirs restent les avoirs');
    pres(rowNet(r), 150000, 'et le net en retire la dette du mois');
  });

  test('la variation se compte de net à net', () => {
    poserReleves(releve(200000, 50000, '2026-01-31'),
                 releve(202000, 49500, '2026-02-28'));
    const [a, b] = Store.state.monthly;
    pres(rowNet(a), 150000, 'janvier, en net');
    pres(rowNet(b), 152500, 'février, en net');
    pres(rowNet(b) - rowNet(a), 2500, 'la variation vaut deux mille cinq cents');
    /* Sur le brut elle n'aurait valu que 2 000 : les 500 EUR de capital
       rembourses ont fait monter le patrimoine sans toucher aux avoirs. */
    pres(rowTotal(b) - rowTotal(a), 2000,
      'là où le brut n’en voit que deux mille, ignorant le remboursement');
  });

  test('rembourser sans rien gagner fait monter le net', () => {
    /* Le cas qui rend la convention necessaire : les avoirs ne bougent pas d'un
       centime, la dette baisse de mille, et le patrimoine a monte de mille. Un
       journal en brut affichait deux fois le meme montant et une variation nulle. */
    poserReleves(releve(300000, 150000, '2026-01-31'),
                 releve(300000, 149000, '2026-02-28'));
    const [a, b] = Store.state.monthly;
    pres(rowTotal(a), rowTotal(b), 'les avoirs sont identiques');
    pres(rowNet(b) - rowNet(a), 1000, 'et le net a monté de ce qui a été remboursé');
    vrai(rowNet(b) > rowNet(a), 'réduire une dette enrichit');
  });

  test('la série, les variations et le rythme lisent la même définition', () => {
    /* La soustraction s'ecrivait a trois endroits. Elle s'ecrit dans `rowNet`, et
       `historySeries` la publie : un quatrieme lecteur ne pourra pas la refaire
       de travers. */
    poserReleves(releve(300000, 150000, '2026-01-31'),
                 releve(302000, 149000, '2026-02-28'));
    const pts = historySeries({ includeNow: false });
    eq(pts.length, 2, 'deux points');
    for (const pt of pts) {
      const r = Store.state.monthly.find(x => x.date === pt.date);
      pres(pt.net, rowNet(r), `${pt.label} : la série publie le net du relevé`);
      pres(pt.net, pt.total - pt.dettes, 'et il vaut bien brut moins dettes');
    }
    const src = lireSource('assets/store.js');
    eq((src.match(/function rowNet/g) || []).length, 1,
      'une seule définition du net d’un relevé');
    /* Aucun lecteur ne refait la soustraction a la main. */
    vrai(!/num\(p\.total\) - num\(p\.dettes\)/.test(src),
      'et plus personne ne la réécrit à côté');
  });

  test('le journal et la fiche du relevé montrent le même montant', () => {
    /* La ligne qu'on touche doit retrouver le meme chiffre dans la fenetre qui
       s'ouvre. Le journal affichait le brut, la fiche le brut en tete et le net
       en note : trois lectures pour un mois. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewHistory('),
                          src.indexOf('function mountHistory('));
    vrai(/const net = rowNet\(r\), total = rowTotal\(r\)/.test(vue),
      'le journal calcule le net du relevé');
    vrai(/valeur: fmtEUR0\(net\)/.test(vue), 'et c’est lui qu’il affiche');
    /* La borne haute est la fiche suivante : « /* --- Budget » existe plus haut
       dans le fichier, donc la tranche partait vide. */
    /* La borne haute est la fiche suivante d'APERCUS. « /* --- Budget » existe
       aussi plus haut dans le fichier, donc s'y fier rendait une tranche vide. */
    const iF = src.indexOf('releveMois: (arg)');
    const fiche = src.slice(iF, src.indexOf('moisObjectif: (sens)', iF));
    vrai(fiche.length > 500, 'la fiche du relevé doit être trouvable');
    vrai(/total: net,/.test(fiche), 'la fiche annonce le même net en tête');
    vrai(/const dlt = avant \? net - rowNet\(avant\) : 0/.test(fiche),
      'et sa variation se compte aussi de net à net');
    /* Le brut reste lisible, avec sa dette en face, et la somme des lignes fait
       le total annonce : les poches sont brutes, donc la dette a sa ligne. */
    vrai(/trad\('Crédits restants'\)/.test(fiche),
      'la dette a sa ligne dans le tableau des poches');
    vrai(/fmtEUR0\(-dettes\)/.test(fiche), 'en négatif, pour que la somme fasse le total');
    vrai(/trad\('avoirs'\)\} \$\{fmtEUR0\(total\)/.test(fiche),
      'et les avoirs bruts se lisent sous le total');
  });

  test('le montant annoncé avant l’enregistrement est celui de la liste', () => {
    /* Le bandeau du mois en attente promet « tous les montants actuels ({v}) ».
       `nowTotals().total` est le patrimoine NET -- il l'a toujours ete -- donc
       promettre un net puis afficher un brut dans la liste faisait deux chiffres
       pour un seul geste. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewHistory('),
                          src.indexOf('function mountHistory('));
    vrai(/tous les montants actuels \(\{v\}\)/.test(vue), 'la promesse est là');
    vrai(/fmtEUR0\(nowTotals\(\)\.total\)/.test(vue),
      'et elle porte le total de nowTotals, qui est le net');
    /* La preuve par les donnees : un releve pris aujourd'hui, avec la dette du
       jour, redonne exactement le chiffre promis. */
    Fixture.poser();
    const t = nowTotals();
    const faux = { date: currentMonthKey(), comment: '', dettes: t.dettes, v: {} };
    for (const a of ACCOUNTS) faux.v[a.id] = nowValue(a.id);
    pres(rowNet(faux), num(t.total),
      'le relevé du mois vaut le patrimoine net annoncé, au centime');
  });
});

finDePartieDeTests('tests/15-personnalise-est-case-pas.tests.js');
