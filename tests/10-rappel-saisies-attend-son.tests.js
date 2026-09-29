partieDeTests('tests/10-rappel-saisies-attend-son.tests.js');
/* ------------------------------------------------------------------
   La cloche réclame le jour où l'on fait ses comptes
   ------------------------------------------------------------------ */
suite('Le rappel des saisies attend son jour', () => {

  /* Le releve se reclame au jour choisi, pas le 1er du mois : qui est paye en
     milieu de mois releve a ce moment-la.

     Une cloche qui reclamerait le releve des le 1er laisserait la pastille
     allumee quinze jours pour rien chez quelqu'un paye le 15 -- et une alerte
     qu'on apprend a ignorer ne sert plus a rien le jour ou elle a raison. */

  test('avant le jour dit, rien n’est réclamé', () => {
    Fixture.poser();
    auJour('2026-03-05', () => {
      Store.state.meta.jourRappel = 15;
      eq(currentMonthPending().missing, false,
        'le relevé n’est pas réclamé avant le 15');
      eq(depensesEnAttente().missing, false, 'les dépenses non plus');
      const dits = notifications().filter(n => /Relevé|dépenses/i.test(n.title));
      eq(dits.length, 0, `la cloche parle quand même : ${dits.map(n => n.title).join(', ')}`);
    });
  });

  test('à partir du jour dit, les deux sont réclamées', () => {
    Fixture.poser();
    auJour('2026-03-15', () => {
      Store.state.meta.jourRappel = 15;
      eq(currentMonthPending().missing, true, 'le jour venu, le relevé se réclame');
      eq(depensesEnAttente().missing, true, 'les dépenses du mois clos aussi');
    });
    auJour('2026-03-28', () => {
      Store.state.meta.jourRappel = 15;
      eq(currentMonthPending().missing, true, 'et les jours suivants, jusqu’à la saisie');
    });
  });

  test('le défaut ne change rien au comportement d’avant', () => {
    /* Le test de non-régression : sans réglage, la cloche réclame du 1er au 31,
       comme elle l'a toujours fait. */
    Fixture.poser();
    auJour('2026-03-01', () => {
      delete Store.state.meta.jourRappel;
      eq(jourRappel(), 1, 'le premier du mois par défaut');
      eq(currentMonthPending().missing, true, 'et le 1er, tout est déjà réclamé');
    });
  });

  test('le jour se borne à 28, parce que février existe', () => {
    Fixture.poser();
    Store.state.meta.jourRappel = 31;
    eq(jourRappel(), 28,
      'un jour 31 ne serait jamais atteint sept mois par an, et le rappel se '
      + 'tairait sans raison lisible');
    Store.state.meta.jourRappel = 0;
    eq(jourRappel(), 1, 'et zéro n’est pas un jour du mois');
  });

  test('« vide » reste vrai avant le jour dit', () => {
    /* Le fait sur les données et la décision de le dire sont deux choses : la
       page des relevés marque la ligne du mois en cours quoi qu'il arrive, seul
       le rappel attend. Les confondre aurait fait disparaître le repère visuel
       de la ligne à remplir. */
    Fixture.poser();
    auJour('2026-03-05', () => {
      Store.state.meta.jourRappel = 15;
      eq(currentMonthPending().vide, true, 'le mois est bien vide, et la page le dit');
      eq(currentMonthPending().missing, false, 'mais la cloche attend');
    });
  });
});

/* ------------------------------------------------------------------
   Un mois sauté ne disparaît pas des radars
   ------------------------------------------------------------------ */
suite('Un mois resté vide se signale', () => {

  /* « Si un mois entier n'est pas rempli alors qu'on est au mois suivant, on
     fait quoi ? » Presque rien, jusqu'ici.

     Le rappel du relevé ne regarde que le mois en cours, celui des dépenses que
     le mois clos : un mois sauté sortait du champ des deux le 1er du mois
     suivant. Un contrôle de cohérence rattrapait une partie du cas, mais
     seulement les trous **encadrés** par deux mois remplis — sauter juillet et
     août en septembre n'en est pas un, rien ne suit.

     Ce n'est pas une saisie en retard, c'est un trou qui ne se voit pas : les
     moyennes continuent de se calculer, sur moins de points. Le coût de la vie,
     l'autonomie financière et le rythme d'accumulation sortent de ces tables. */

  test('un mois vide derrière soi est signalé, dans les deux tables', () => {
    auJour('2026-06-10', () => {
      /* Des dates au 1er : `isCalendarMonth` ne reconnaît qu'elles. Une ligne
         au 31 est une clôture ponctuelle, pas un mois du calendrier, et elle est
         écartée à dessein — on ne réclame pas un mois que personne n'a ouvert. */
      Fixture.poser(s => {
        s.monthly = [
          { date: '2026-01-01', comment: '', v: { c_courant: 3000 } },
          { date: '2026-02-01', comment: '', v: {} },
          { date: '2026-03-01', comment: '', v: { c_courant: 3100 } },
        ];
        s.budget.expenses = [
          { month: '2026-01-01', v: { Courses: 400 }, note: '' },
          { month: '2026-02-01', v: {}, note: '' },
          { month: '2026-03-01', v: { Courses: 420 }, note: '' },
        ];
      });
      eq(trousReleves().length, 1, 'février manque au relevé');
      eq(trousDepenses().length, 1, 'et aux dépenses');
      const dits = healthChecks().filter(c => /Trou dans l/.test(c.title));
      eq(dits.length, 2, `les deux tables doivent être signalées, ${dits.length} l’est`);
    });
  });

  test('un trou en fin d’historique compte aussi', () => {
    /* Le cas exact de la question, et celui que l'ancien contrôle laissait
       passer : les mois vides ne sont suivis de rien. */
    auJour('2026-06-10', () => {
      Fixture.poser(s => {
        s.monthly = [
          { date: '2026-03-01', comment: '', v: { c_courant: 3000 } },
          { date: '2026-04-01', comment: '', v: {} },
          { date: '2026-05-01', comment: '', v: {} },
        ];
      });
      eq(trousReleves().length, 2, 'avril et mai manquent, et rien ne les suit');
    });
  });

  test('les mois d’avant le premier rempli ne comptent pas', () => {
    /* Le calendrier ouvre douze mois d'avance. Sans cette garde, une
       installation neuve annoncerait « onze mois vides » le jour de son premier
       relevé — le contrôle serait faux dès la première utilisation. */
    auJour('2026-06-10', () => {
      Fixture.poser(s => {
        s.monthly = [
          { date: '2026-01-01', comment: '', v: {} },
          { date: '2026-02-01', comment: '', v: {} },
          { date: '2026-03-01', comment: '', v: { c_courant: 3000 } },
        ];
      });
      eq(trousReleves().length, 0,
        'on ne signale que les trous à l’intérieur de ce qu’on a commencé à tenir');
    });
  });

  test('le mois en cours n’est pas un trou', () => {
    /* Il a déjà son rappel, et il n'est pas en retard tant qu'il n'est pas
       fini. Le compter ici ferait dire deux choses du même mois. */
    auJour('2026-06-10', () => {
      Fixture.poser(s => {
        s.monthly = [
          { date: '2026-05-01', comment: '', v: { c_courant: 3000 } },
          { date: '2026-06-01', comment: '', v: {} },
        ];
      });
      eq(trousReleves().length, 0, 'juin est en cours, pas manquant');
    });
  });

  test('les deux tables partagent le même parcours', () => {
    /* Deux copies de ce calcul auraient fini par ne plus dire la même chose :
       les relevés et les dépenses vivent dans des tables de formes différentes,
       et c'est exactement le genre d'écart qui ne se voit pas. */
    const src = lireSource('assets/store.js');
    vrai(src, 'assets/store.js doit être lisible pour ce contrôle');
    vrai(/const trousReleves = \(\) => moisVides\(/.test(src)
      && /const trousDepenses = \(\) => moisVides\(/.test(src),
      'les deux doivent dériver de moisVides()');
  });
});

/* ------------------------------------------------------------------
   Un onglet du bas ramène toujours à sa page d'accueil
   ------------------------------------------------------------------ */
suite('Un onglet du bas ramène à son premier sous-onglet', () => {

  /* L'onglet Apercu ramene a l'onglet Aujourd'hui, meme depuis un autre
     sous-onglet.

     Un onglet qui retiendrait le clic quand on est deja dessus, pour se
     contenter de remonter en haut de page, jugerait deja dessus sur la vue,
     pas sur l'adresse -- et ces deux choses different des qu'une vue a des
     sous-onglets : sur Projection, l'adresse est `#/objective` et la vue reste
     `overview`. L'onglet se croirait donc actif, retiendrait le clic, et
     l'adresse ne changerait jamais. */

  test('« déjà sur place » se juge sur l’adresse, pas sur la vue', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/\$\('#tabbar'\)\?\.addEventListener\('click'[\s\S]*?\n  \}\);/);
    vrai(bloc, 'l’écouteur de la barre du bas doit être trouvable');
    vrai(/lien\.getAttribute\('href'\) !== location\.hash/.test(bloc[0]),
      'le clic ne doit être retenu que si l’adresse est identique : sinon un '
      + 'sous-onglet ouvert empêche de revenir au premier');
    vrai(!/lien\.dataset\.view !== currentView\(\)/.test(bloc[0]),
      'comparer la vue laissait « Aperçu » inerte depuis Projection');
  });

  test('et l’adresse de base remet le premier sous-onglet', () => {
    /* L'autre moitié : laisser le lien naviguer ne suffirait pas si la vue
       gardait le dernier sous-onglet choisi. Cette règle existait déjà pour le
       menu latéral, elle sert aux deux. */
    const src = lireSource('assets/app.js');
    vrai(/if \(SOUS_ONGLETS\[v\]\) sousOngletActif\[v\] = SOUS_ONGLETS\[v\]\[0\]\[0\];/.test(src),
      'arriver sur l’adresse de base doit rouvrir le premier sous-onglet');
  });
});

/* ------------------------------------------------------------------
   Une fiche de ligne dit toujours la même chose au même endroit
   ------------------------------------------------------------------ */
suite('Une fiche de ligne garde son ordre', () => {

  /* Toutes les fiches de titre suivent le meme ordre, que la ligne ait un ISIN
     ou non.

     Un titre sans ISIN, sans pays d'emission ni nom officiel ne doit pas
     perdre ces lignes : si elles ne se rendaient qu'avec une valeur, tout ce
     qui suit -- aujourd'hui, plus-value, cloture de la veille, part du
     portefeuille -- remonterait de trois crans d'une fiche a l'autre. On ne
     peut apprendre ou vit un chiffre que s'il est toujours au meme endroit, et
     cette fiche s'ouvre plusieurs fois par jour.

     Une valeur absente se dit donc, elle ne fait pas disparaitre sa ligne.
     C'est deja ce que fait le plafond d'un livret, pour la meme raison. */

  /* Les six intitulés, dans l'ordre, tels que la fiche doit les rendre. */
  const ATTENDUS = ['Nature', 'ISIN', 'Pays d’émission', 'Place',
                    'Nom officiel', 'Émetteur'];

  function blocIdentite() {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const m = src.match(/<dl class="kv kv-texte">[\s\S]*?<\/dl>/);
    vrai(m, 'le bloc d’identité de la fiche doit être trouvable');
    return m[0];
  }

  test('les six lignes se rendent toujours, dans le même ordre', () => {
    const bloc = blocIdentite();
    /* Les intitules passent par trad() depuis le chantier des deux langues :
       la clef reste la phrase francaise, c'est elle que ce test compare. */
    const rendus = [...bloc.matchAll(/ligne\((?:trad\()?'([^']+)'/g)].map(x => x[1]);
    eq(rendus.join(' | '), ATTENDUS.join(' | '),
      'les intitulés doivent tous être là, dans cet ordre : c’est ce qui permet '
      + 'de savoir où regarder sans lire');
  });

  test('aucune ligne n’est conditionnée à sa valeur', () => {
    /* Le défaut exact : `${p.isin ? ligne(…) : ''}`. Un seul survivant suffirait
       à décaler tout le bloc des chiffres sur les fiches qui en manquent. */
    const bloc = blocIdentite();
    vrai(!/\?\s*ligne\(/.test(bloc),
      'une ligne rendue seulement si elle a une valeur décale tout ce qui la '
      + 'suit dès qu’elle manque');
    const conditionnees = (bloc.match(/\$\{[a-zA-Z.]+\s*(&&|\?)[^}]*ligne\(/g) || []);
    eq(conditionnees.length, 0,
      `${conditionnees.length} ligne(s) encore conditionnelle(s) : ${conditionnees.join(', ')}`);
  });

  test('une valeur absente dit pourquoi, elle ne dit pas « vide »', () => {
    /* La différence entre un trou et une réponse : « identique au nom de la
       ligne » règle la question, « se déduit de l'ISIN » dit où la remplir.
       Un tiret n'aurait rien appris, et le tiret cadratin est proscrit du texte
       affiché. */
    const bloc = blocIdentite();
    /* « Non renseigné » a disparu de l'ISIN le 6 août : il désignait un défaut
       là où il n'y en a pas — une cryptomonnaie n'a pas d'ISIN, une ligne saisie
       à la main non plus. Ces cas disent « sans objet », et le vrai manque dit
       où le trouver. */
    for (const mot of ['sans objet', 'à copier depuis ton courtier', 'se déduit de l’ISIN',
                       'identique au nom de la ligne', 'se déduit du nom d’un fonds']) {
      vrai(bloc.includes(mot), `l’état vide « ${mot} » doit exister`);
    }
    vrai(!/—/.test(bloc), 'aucun tiret cadratin dans le texte affiché');
  });
});

/* ------------------------------------------------------------------
   La barre du haut ne découpe pas ce qui en sort
   ------------------------------------------------------------------ */
suite('Le panneau des notifications n’est pas rogné par sa barre', () => {

  /* Le panneau des notifications s'affiche sur telephone, sans etre rogne.

     La barre laterale porte `overflow-y: auto` pour qu'un ecran court ne rende
     pas son pied inatteignable -- pour le rail vertical de l'ordinateur. Or sous
     768 px, ce meme selecteur est la bande de 54 px du haut, et `overflow: auto`
     en fait un conteneur qui decoupe tout ce qui depasse.

     Le panneau vit dedans, en absolu, et descend a 306 px : il serait donc
     entierement rogne -- sa boite irait de 56 a 306, mais au milieu de cette
     boite c'est la page qui repondrait au doigt.

     C'est le cas qu'on ne voit jamais sur un grand ecran, ou la barre fait toute
     la hauteur et n'a rien a decouper. */

  function reglesSidebar() {
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  test('le panneau vit bien à l’intérieur de la barre', () => {
    /* Sans ça, ce contrôle ne protège rien : c'est la raison pour laquelle le
       découpage compte. */
    const html = lireSource('index.html');
    vrai(html, 'index.html doit être lisible pour ce contrôle');
    const barre = html.slice(html.indexOf('<aside class="sidebar">'), html.indexOf('</aside>'));
    vrai(barre.includes('id="panneauNotifs"'),
      'le panneau des notifications doit vivre dans la barre : c’est ce qui rend '
      + 'son découpage possible, et ce qui rend ce test nécessaire');
    vrai(barre.includes('id="btnCloche"'), 'la cloche qui l’ouvre aussi');
  });

  test('la barre du téléphone ne découpe rien', () => {
    const nu = reglesSidebar();
    /* La règle du téléphone : celle qui cloue la barre en haut de l'écran. */
    const mobile = nu.split('}').find(b =>
      b.split('{')[0].trim().endsWith('.sidebar') && /position:\s*fixed/.test(b));
    vrai(mobile, 'la règle qui fixe la barre en haut de l’écran doit être trouvable');
    vrai(/overflow:\s*visible/.test(mobile),
      'la bande du haut ne doit rien découper : le panneau des notifications en '
      + 'sort de 250 px, et un conteneur de défilement le rognerait entièrement');
  });

  test('le rail de l’ordinateur, lui, se laisse parcourir', () => {
    /* L'autre moitié, qu'il ne faut pas perdre en corrigeant celle-ci : dans une
       fenêtre de 560 px de haut, le contenu de la barre en fait 675, et son pied
       porte le patrimoine net. */
    const nu = reglesSidebar();
    const base = nu.split('}').find(b =>
      b.split('{')[0].trim() === '.sidebar' && /position:\s*sticky/.test(b));
    vrai(base, 'la règle du rail vertical doit être trouvable');
    vrai(/overflow-y:\s*auto/.test(base),
      'le rail garde son défilement interne : sinon son pied redevient '
      + 'inatteignable sur un écran court');
  });
});

/* ------------------------------------------------------------------
   Le journal des ventes tient la charge
   ------------------------------------------------------------------ */
suite('Le journal des ventes se borne par année', () => {

  /* Le journal des ventes se filtre par annee : cinq cents ventes ne font pas
     cinq cents lignes deroulees.

     Une carte sans commande deroulerait tout ce que la plage glissante retient,
     et cette plage se regle deux cartes plus haut, sur les graphiques.

     Deux bornes, et elles ne font pas double emploi : L'ANNEE BORNE COMBIEN DE
     LIGNES EXISTENT, LE DEPLIANT BORNE QUAND ON LES VOIT. Le depliant seul
     cacherait cinq cents lignes derriere un bouton sans en reduire une ; le
     selecteur seul montrerait une annee de ventes en permanence. */

  const vente = (date, n) => ({
    date, name: `Titre ${n}`, qty: 3, price: 100, buyPrice: 90, currency: 'EUR',
    fxSell: 1, fxBuy: 1, gross: 300, invested: 270, realised: 30, note: '',
  });

  test('les totaux portent sur ce que la carte montre', () => {
    /* La règle du projet : un total égale la somme de ses parts. Calculer les
       tuiles sur la plage glissante pendant que le tableau liste une année
       aurait donné trois totaux qui ne sont la somme d'aucune ligne visible. */
    Fixture.poser();
    const deux = [vente('2025-03-10', 1), vente('2025-07-04', 2), vente('2026-02-11', 3)];
    const de2025 = deux.filter(v => v.date.startsWith('2025'));
    const st = statsDesVentes(de2025);
    eq(st.count, 2, 'deux ventes en 2025');
    pres(st.gross, 600, 'le produit est celui des deux lignes montrées');
    pres(st.realised, 60, 'la plus-value aussi');
    pres(st.sales.reduce((s, v) => s + v.gross, 0), st.gross,
      'et le total égale la somme de ses parts');
  });

  test('le calcul des totaux ne vit qu’à un endroit', () => {
    /* `salesStats` filtrait puis sommait. Le journal filtre autrement : refaire
       les cinq sommes à côté aurait donné deux façons de compter la même chose,
       et celle qu'on oublie de corriger finit par contredire l'autre. */
    const src = lireSource('assets/store.js');
    vrai(src, 'assets/store.js doit être lisible pour ce contrôle');
    vrai(/function statsDesVentes\(ventes\)/.test(src),
      'le calcul doit être extrait du filtre');
    const anciennes = src.match(/function salesStats\(range\) \{[\s\S]*?\n\}/);
    vrai(anciennes && /return statsDesVentes\(ventes\)/.test(anciennes[0]),
      'la plage glissante doit passer par le même calcul');
  });

  test('une seule borne de temps sur la page, et le dépliant reste', () => {
    /* Il y en avait deux : la plage glissante reglait les courbes, un menu
       d'annee reglait le journal, et rien n'empechait l'un de dire 2025 et
       l'autre 2026. Le menu a rejoint les crans, dans un contrôle unique. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/function salesCard\(\) \{[\s\S]*?\n\}/);
    vrai(bloc, 'la carte du journal doit être trouvable');
    vrai(/const st = salesStats\(periodeTransactions\(\)\);/.test(bloc[0]),
      'le journal se borne comme les graphiques, par la plage de la page');
    vrai(!/yearControl\(/.test(bloc[0]),
      'et n’a plus de sélecteur propre : deux menus d’année jumeaux pouvaient se contredire');
    /* Sur la source sans ses commentaires : le fichier explique pourquoi cet etat
       a disparu, et cette explication doit pouvoir citer son nom. */
    vrai(!/salesYear/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
      'l’état séparé est parti, sinon la borne existerait encore en double');
    vrai(/<details class="data-view pli-journal"/.test(bloc[0]),
      'le dépliant reste : la borne dit combien de lignes existent, lui dit quand '
      + 'on les voit');
  });

  test('une année est une plage, fermée des deux côtés', () => {
    /* Filtrer une annee sur son seul debut aurait montre 2025 et tout ce qui a
       suivi : une duree glissante n'a pas de fin, une annee civile en a une. */
    eq(estAnnee('2025'), true, 'quatre chiffres font une année');
    eq(estAnnee('5y'), false, 'un cran de durée n’en est pas une');
    const b = rangeBornes('2025');
    eq(b.debut, '2025-01-01', 'elle ouvre au 1er janvier');
    eq(b.fin, '2025-12-31', 'et se ferme au 31 décembre');
    eq(rangeBornes('all').fin, null, 'une durée n’a pas de fin');
    eq(rangeLabel('2025'), '2025', 'et son libellé est son nom');

    Fixture.poser();
    declarerVente({ date: '2025-03-10', name: 'En 2025', gross: 1000, realised: 200 });
    declarerVente({ date: '2026-06-20', name: 'En 2026', gross: 300, realised: 50 });
    eq(salesStats('2025').count, 1, 'la plage 2025 ne retient que 2025');
    pres(salesStats('2025').realised, 200, 'et son total est celui de cette année');
    eq(salesStats('2026').count, 1, '2026 de son côté');
    eq(salesStats('all').count, 2, 'et « Tout » les garde toutes les deux');
    eq(anneesDesVentes().join(','), '2026,2025',
      'les années offertes sont celles où une vente existe, la plus récente devant');
  });
});

/* ------------------------------------------------------------------
   La carte Objectif dit ce qu'elle seule sait
   ------------------------------------------------------------------ */
suite('La carte Objectif met en avant l’écart, pas le patrimoine', () => {

  /* Le montant deja detenu ne se met pas en avant ici : il serait trois fois
     sur le meme ecran -- en grand dans cette carte, vingt pixels plus bas comme
     premiere barre de Ce que tu as deja, et en chiffre de tete de l'onglet
     Aujourd'hui.

     Ce que la carte apporte en propre, personne d'autre ne le dit : la cible, ce
     qui manque, et le rythme qu'il faudrait tenir. C'est cela qui passe en
     grand. */

  test('le grand chiffre est l’écart, pas le patrimoine', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/const carteObjectif = \(\) => \{[\s\S]*?\n  \};/);
    vrai(bloc, 'la carte de l’objectif doit être trouvable');
    const haut = bloc[0].match(/<div class="goal-top">[\s\S]*?<\/div>/);
    vrai(haut, 'le bloc de tête doit être trouvable');
    vrai(/g\.remaining/.test(haut[0]),
      'le chiffre de tête doit être l’écart à l’objectif');
    vrai(!/fmtEUR\(g\.total\)/.test(haut[0]),
      'et surtout pas le patrimoine, qui est déjà le héros de deux autres écrans');
  });

  test('le patrimoine reste, en note', () => {
    /* Il donne son sens au reste : « il te manque 3 800 € » ne se lit pas sans
       savoir sur quoi. Il ne se lit simplement plus en premier. */
    const src = lireSource('assets/app.js');
    const bloc = src.match(/const carteObjectif = \(\) => \{[\s\S]*?\n  \};/);
    const pied = bloc[0].match(/<div class="goal-foot">[\s\S]*?<\/div>/);
    vrai(pied, 'le pied doit être trouvable');
    /* Sans centimes, comme tout l'accueil : la fenetre garde les montants exacts. */
    vrai(/fmtEUR0\(g\.total\)/.test(pied[0]) && /fmtEUR0\(g\.obj\)/.test(pied[0]),
      'le pied doit porter le patrimoine et la cible');
  });

  test('le rythme nécessaire accompagne l’écart', () => {
    /* C'est la seule des trois informations qui dise quoi faire. */
    const src = lireSource('assets/app.js');
    const bloc = src.match(/const carteObjectif = \(\) => \{[\s\S]*?\n  \};/);
    const haut = bloc[0].match(/<div class="goal-top">[\s\S]*?<\/div>/);
    vrai(/-g\.remaining \/ mois/.test(haut[0]),
      'le rythme mensuel doit être dit avec l’écart, pas relégué plus bas');
  });

  test('un objectif dépassé se dit autrement', () => {
    /* Un écart négatif n'est pas « il te manque −500 € ». */
    const src = lireSource('assets/app.js');
    const bloc = src.match(/const carteObjectif = \(\) => \{[\s\S]*?\n  \};/);
    vrai(/de dépassement/.test(bloc[0]), 'le cas du dépassement doit être nommé');
    vrai(/Objectif atteint/.test(bloc[0]), 'et fêté');
  });
});

/* ------------------------------------------------------------------
   La carte Objectif porte les couleurs de sa page
   ------------------------------------------------------------------ */
suite('L’objectif ne se peint pas d’une couleur qui ne dit rien', () => {

  /* La barre de l'objectif parle la couleur de la page, pas celle d'une autre.

     `--degrade-budget`, bleu vers rose, accorde la jauge de l'accueil et les
     barres de categories du Budget. Sur Projection, aucun autre element ne le
     porte : le graphique en dessous parle en azur et en turquoise. Les deux ne
     partageraient litteralement aucune couleur, et un degrade qui ne represente
     aucune quantite se lit comme de l'ornement.

     L'accent plutot qu'une teinte de serie, parce que c'est un objectif
     personnel : une couleur de serie dirait que c'est une categorie de donnees
     parmi d'autres, le violet dit que c'est un reglage. */

  function regle(nom) {
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    return css.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}').find(b => b.split('{')[0].trim() === nom);
  }

  test('la jauge porte l’accent, pas le dégradé du budget', () => {
    const r = regle('.goal-fill');
    vrai(r, 'la règle de la jauge doit être trouvable');
    vrai(/background:\s*var\(--accent\)/.test(r),
      'la jauge d’un objectif personnel porte l’accent : c’est un réglage, pas '
      + 'une catégorie de données');
    vrai(!/degrade-budget/.test(r),
      'le dégradé du budget n’appartient pas à cette page, aucun autre élément '
      + 'ne le porte ici');
  });

  test('le montant et sa légende ne partent pas aux deux bouts', () => {
    /* `space-between` marchait à 343 px et jetait le chiffre et la phrase aux
       deux bords d'une carte de 1 280 px, avec neuf cents pixels de vide. */
    for (const nom of ['.goal-top', '.goal-foot']) {
      const r = regle(nom);
      vrai(r, `la règle ${nom} doit être trouvable`);
      vrai(!/justify-content:\s*space-between/.test(r),
        `${nom} écartèle son contenu sur un grand écran : deux îlots au lieu `
        + 'd’une lecture');
      vrai(/gap:/.test(r), `${nom} doit poser un écart explicite entre ses parts`);
    }
  });

  test('sans objectif déclaré, la carte ne se félicite pas', () => {
    /* « Si quelqu'un n'aime pas cette barre, il fait comment ? » Il mettait la
       cible à zéro, et zéro donne `remaining = total` — donc un montant positif.
       La carte annonçait « de dépassement · Objectif atteint » sur un cap que
       personne n'avait fixé. */
    Fixture.poser(s => { s.meta.objective = 0; });
    const g = objectiveStatus();
    eq(g.obj, 0, 'aucune cible');
    vrai(g.remaining > 0,
      'et l’écart devient positif : c’est ce qui faisait croire à un dépassement');

    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/const carteObjectif = \(\) => \{[\s\S]*?\n  \};/);
    vrai(bloc, 'la carte de l’objectif doit être trouvable');
    vrai(/if \(!\(num\(g\.obj\) > 0\)\) return/.test(bloc[0]),
      'sans cible positive, la carte doit céder la place plutôt que de célébrer '
      + 'un objectif inexistant');
  });

  test('et elle ne s’enferme pas dehors', () => {
    /* La carte est la seule porte vers ce réglage : la faire disparaître
       entièrement enfermerait dehors quiconque change d'avis. Il reste une
       ligne, qui ouvre la même fenêtre. */
    const src = lireSource('assets/app.js');
    const bloc = src.match(/const carteObjectif = \(\) => \{[\s\S]*?\n  \};/);
    const vide = bloc[0].match(/goal-vide[\s\S]*?<\/button>/);
    vrai(vide, 'la ligne de remplacement doit exister');
    vrai(/data-apercu="objectif"/.test(bloc[0].slice(0, bloc[0].indexOf('goal-vide') + 400)),
      'et ouvrir le même réglage que la carte pleine');
    vrai(!/goal-bar/.test(vide[0]), 'sans jauge : il n’y a rien à jauger');
  });
});

/* ------------------------------------------------------------------
   Une colonne réservée à rien laisse un couloir vide
   ------------------------------------------------------------------ */
suite('Une grille ne réserve pas de place à ce qu’elle ne montre pas', () => {

  /* Pas d'espace vide a droite des lignes sur iPhone : le vide longerait le bord
     de la carte, et pas seulement les montants.

     `.flow-row` sert deux cartes : les charges fixes, qui montrent la part de
     chaque poste, et les depenses du mois, qui ne la montrent pas. Quatre
     colonnes declarees pour les deux laisseraient a la seconde 42 px reserves a
     rien, plus 10 px d'ecart, soit un couloir de 52 px : a 375 px, le montant
     finirait a 291, la ligne a 343.

     Le defaut ne se verrait pas sur la carte des charges fixes, qui remplit sa
     quatrieme colonne. La moitie des cartes concernees paraitrait donc juste,
     ce qui est exactement ce qui rend ce genre de defaut long a trouver. */

  function reglesFlow() {
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    return css.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}').filter(b => /\.flow-row\b/.test(b.split('{')[0]));
  }

  test('la quatrième colonne n’existe que si un pourcentage l’occupe', () => {
    const blocs = reglesFlow().filter(b => /grid-template-columns/.test(b));
    vrai(blocs.length >= 2,
      'la grille doit être déclarée au moins deux fois : la base et le cas du '
      + 'pourcentage');
    for (const b of blocs) {
      const sel = b.split('{')[0].trim();
      const colonnes = (b.match(/grid-template-columns:([^;]*)/) || [])[1] || '';
      const quatre = colonnes.trim().split(/\s+(?![^(]*\))/).length >= 4;
      if (quatre) {
        vrai(/:has\(\.flow-pct\)/.test(sel),
          `« ${sel} » réserve quatre colonnes sans exiger de pourcentage : les `
          + 'lignes qui n’en portent pas gardent un couloir vide à droite');
      }
    }
  });

  test('les deux largeurs d’écran sont traitées', () => {
    /* Le défaut vivait dans la règle du téléphone, pas dans celle du bureau :
       corriger la première seule aurait laissé le couloir là où il gênait. */
    const avecHas = reglesFlow().filter(b => /:has\(\.flow-pct\)/.test(b.split('{')[0]));
    vrai(avecHas.length >= 2,
      `la variante à pourcentage doit exister aux deux largeurs (${avecHas.length} trouvée·s) : `
      + 'la règle du téléphone redéclare la grille, et c’est celle qui comptait');
  });
});


suite('Un bien de valeur se tient tout seul, et se nomme une fois', () => {
  test('la classe existe partout où une classe doit exister', () => {
    /* Une classe d'actifs n'est pas qu'une entree de table : elle doit porter un
       nom affichable, une couleur, une disponibilite et un type de compte qui la
       produise. Ce test verifie les quatre, pour que le prochain qui ajoute une
       classe ne decouvre pas au navigateur ce qui lui manque. */
    vrai(CLASSES_ACTIFS.bienValeur, 'la classe est nommée');
    /* Le meme mot que le type de compte, au singulier : « Biens de valeur » en
       en-tete au-dessus de « Bien de valeur » en ligne se lisait comme deux
       choses differentes. */
    /* On compare les CLEFS, pas les formes affichees. La classe porte son
       libelle deja traduit au chargement, un type de compte le fait traduire au
       rendu : comparer les deux rendus depend de la langue courante, et la suite
       en change pour d'autres controles. La regle, elle, ne depend d'aucune
       langue — les deux nomment le meme mot francais. */
    const cleClasse = (lireSource('assets/store.js')
      .match(/bienValeur:\s*trad\('([^']+)'\)/) || [])[1];
    vrai(cleClasse, 'la classe doit nommer son libellé par une clef');
    eq(cleClasse, typeCompte('bienValeur').label,
      'la classe et le type portent exactement le même mot');
    vrai(TEINTE_CLASSE.bienValeur != null, 'elle a une teinte à elle');
    const t = typeCompte('bienValeur');
    eq(t.id, 'bienValeur', 'le type de compte existe');
    vrai(t.classes.includes('bienValeur'), 'et il produit cette classe');
    vrai(t.sansEtab, 'il ne se rattache à aucun établissement');
    eq(mobilisabilite('bienValeur', 'bienValeur', ''), 'lent',
      'une montre se vend, mais pas dans la journée');
  });

  test('le brut se dérive des classes au lieu de les recompter', () => {
    /* La faute que ce test empeche : `patrimoine()` tenant deux listes ecrites a
       la main, l'une pour `classes`, l'autre pour la somme du brut. Une classe
       ajoutee dans la premiere et oubliee dans la seconde donnerait un total
       plus petit que la somme de ses parts, sans que rien a l'ecran ne le dise.
       C'est la regle cardinale du projet, violee par un doublon de liste. */
    Fixture.poser();
    Store.state.comptes.push({ id: 'c_bv', etabId: null, type: 'bienValeur',
      statut: 'ouvert', libelle: 'Moto', ouvertLe: '2023-04-10', cash: [],
      lignes: [{ id: 'l_bv', classe: 'bienValeur', libelle: 'Moto',
                 valeur: 4200, prixDeRevient: 3000, estimeLe: '2026-08-06' }] });
    const p = patrimoine();
    eq(round2(p.classes.bienValeur), 4200, 'la classe porte la valeur du bien');
    eq(round2(Object.values(p.classes).reduce((s, v) => s + num(v), 0)), round2(p.brut),
      'le brut égale la somme de ses classes, celle-ci comprise');

    /* Et le controle vaut pour n'importe quelle classe a venir : la somme se
       derive de `CLASSES_ACTIFS`, donc aucune ne peut manquer a l'appel. */
    for (const k of Object.keys(CLASSES_ACTIFS)) {
      vrai(k in p.classes, `${k} a sa case dans le detail par classe`);
    }
  });

  test('le parcours de création ne demande pas de banque et demande un nom', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const debut = src.indexOf("async 'ajouter-compte'");
    vrai(debut > 0, 'le parcours de création doit exister');
    /* La borne haute est l'action SUIVANTE, pas une longueur : une fenetre en
       caracteres se defait au premier champ ajoute, et c'est arrive — le nom de
       la ligne est sorti des dix-sept mille caracteres le jour ou l'acquisition
       s'est decomposee en trois champs. */
    const parcours = src.slice(debut, src.indexOf("'fiche-compte'(btn)", debut));

    /* L'etape du contenant saute sur le drapeau du modele, pas sur l'identifiant
       du type : un second type sans contenant en heriterait sans rien ecrire. */
    vrai(/if \(t\.sansEtab\) \{ etabId = null; etapes--; \}/.test(parcours),
      'l’étape de la banque saute sur `sansEtab`, et le compte des étapes suit');
    vrai(!/t\.id === 'bienValeur'/.test(parcours),
      'et elle saute sur le drapeau, pas sur le nom du type');

    /* Sans contenant, plus rien ne nomme le bien : le champ le remplace. */
    vrai(/t\.sansEtab \? \[\{ cle: 'nom'/.test(parcours),
      'un bien sans contenant demande son nom, puisque l’étape 2 ne le nomme plus');
    vrai(/libelle: String\(e3\.nom \|\| ''\)\.trim\(\) \|\| nomContenant\(\)/.test(parcours),
      'et ce nom devient celui de la ligne');

    /* Le contenant se nomme avant le dernier ecran mais ne se cree qu'apres :
       un parcours qu'on abandonne ne doit rien laisser derriere lui. Il etait
       pousse dans l'etat des la saisie du nom, et fermer l'ecran des montants
       laissait un etablissement vide que plus aucune page ne montre — sauf la
       liste de ce meme parcours, ou il ressemble a une memoire residuelle. */
    vrai(/nomNouveauContenant = nom;\s*\n\s*etabId = null;/.test(parcours),
      'la saisie du nom ne crée rien');
    const posE3 = parcours.indexOf('if (!e3) return;');
    const posPush = parcours.indexOf('Store.state.etabs.push(');
    vrai(posE3 > 0 && posPush > posE3,
      'l’établissement naît après le dernier écran, jamais avant');
    /* Et les ecrans d'avant lisent le nom par une seule porte, qui repond que
       l'etablissement existe deja ou qu'il vienne d'etre tape. */
    vrai(/const nomContenant = \(\) => etabById\(etabId\)\?\.nom \|\| nomNouveauContenant \|\| '';/
      .test(parcours), 'un seul accesseur pour le nom du contenant');

    /* Une dette se pose sur un etablissement : sans contenant, le champ n'aurait
       nulle part ou atterrir, et `etabById(null)` aurait leve. */
    /* L'intitule de l'etape s'intercale desormais : la garde est la meme, elle
       porte seulement sur davantage de lignes. */
    vrai(/\.\.\.\(t\.sansEtab \? \[\] : \(\(\) => \{/.test(parcours),
      'le crédit ne s’offre que là où une dette peut se poser');
    vrai(/cle: 'aCredit'/.test(parcours),
      'et la question se pose avant les champs du prêt');
    vrai(/\{ cle: 'section_fin', label: 'Financement', type: 'section' \}/.test(parcours),
      'et l’étape du financement se nomme, plutôt que d’enchaîner huit champs de plus');
  });

  test('la valeur d’un bien se dit estimée, et porte sa date', () => {
    const src = lireSource('assets/app.js');
    vrai(/Valeur estimée/.test(src), 'l’intitulé existe');
    vrai(/cle: 'estimeLe'/.test(src), 'la date de l’estimation se saisit');
    /* Deux portes sur le meme champ, la creation et la fenetre de la ligne :
       c'est sain, elles ecrivent le meme fait. Deux champs pour la meme valeur
       ne le serait pas. */
    eq((src.match(/cle: 'estimeLe'/g) || []).length, 2,
      'deux portes — la création et la modification — sur un seul champ');
    vrai(/estimeLe: e3\.estimeLe \|\| todayISO\(\)/.test(src),
      'à la création elle est posée, pour que le rappel ait un point de départ');
  });

  test('un sous-titre ne répète pas le titre au-dessus de lui', () => {
    /* Trois fois le meme mot sur trois lignes : le groupe « Biens de valeur », la
       ligne « Bien de valeur », le sous-titre « Biens de valeur · Bien de
       valeur ». Le nom du compte et celui de la ligne sont un seul fait, et la
       classe est deja dite par l'en-tete du groupe. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf('function lignePlacement');
    vrai(debut > 0, 'la fonction doit exister');
    const fn = src.slice(debut, debut + 5000);
    vrai(/nomLignePlacement\(l, compte\)/.test(fn),
      'la ligne tire son nom de la fonction qui en décide, une seule fois');
    /* Le quatrieme parametre ne dit plus « tais la classe » mais « tais le
       nom » : sur la fiche d'un actif terminal, le nom de la ligne EST celui de
       la fiche, et la classe devient au contraire ce qu'elle apporte. Un
       parametre d'affichage se juge donc sur ce qu'il tait, jamais sur le
       nombre d'arguments. */
    vrai(/function lignePlacement\(l, compte, editable = false\) \{/.test(src),
      'trois arguments, et plus de mode d’affichage caché dans un quatrième');
    eq((src.match(/[^m]lignePlacement\(/g) || []).length, 2,
      'une déclaration et un appelant : la liste des placements d’un compte');

    /* Le repli vit cote store, et les vues le partagent : la liste, la fenetre
       d'apercu d'une classe, et tout ce qui viendra. Une seule des deux le
       portait, et la fenetre affichait encore « Bien de valeur ». */
    const cpt = { id: 'c1', type: 'bienValeur', libelle: 'Moto', lignes: [] };
    eq(nomLignePlacement({ libelle: 'Bien de valeur' }, cpt), 'Moto',
      'un libellé égal au type se replie sur le nom du compte');
    eq(nomLignePlacement({ libelle: 'Rolex' }, cpt), 'Rolex',
      'un nom vraiment saisi n’est jamais écrasé');
    vrai(/const nomL = nomLignePlacement\(l, c\);/.test(src),
      'la fenêtre d’aperçu s’en sert aussi');
    vrai(/meta: sousNom\(nomL, /.test(src),
      'et son sous-titre ne répète ni le nom au-dessus ni un point médian '
      + 'suivi de rien : « Moto / Moto » se lisait deux fois');

    /* Le repli joue aussi dans l'autre sens : un compte sans nom prend celui de
       sa ligne unique, pour que la fiche ne titre pas « Bien de valeur ». */
    eq(nomCompteV2({ type: 'bienValeur', lignes: [{ libelle: 'moto' }] }), 'moto',
      'un compte anonyme d’une seule ligne prend le nom de celle-ci');
    eq(nomCompteV2({ type: 'bienValeur', libelle: 'Moto', lignes: [{ libelle: 'x' }] }), 'Moto',
      'et son propre nom reste prioritaire');
    eq(nomCompteV2({ type: 'courant', cash: [{ montant: 10 }], lignes: [{ libelle: 'x' }] }),
      'Compte courant',
      'un compte qui porte aussi des espèces n’est pas réductible à sa ligne');
  });

  test('la fiche porte un bouton qui enregistre et reste', () => {
    /* Tout y est deja ecrit a la frappe : ce bouton apporte la confirmation, pas
       l'ecriture. Il ne doit donc surtout pas remplacer l'ecriture continue —
       un champ saisi puis quitte sans clic serait perdu, et c'est precisement
       ce que la regle du projet interdit.
       Il reste sur place, comme dans une fenetre de saisie en serie : on vient
       relire les comptes que la saisie vient de changer, et « Enregistrer et
       fermer » emportait l'ecran avant qu'on ait pu les lire. */
    const src = lireSource('assets/app.js');
    vrai(/function barreValiderFiche/.test(src), 'la barre a une seule source');
    const fn = src.slice(src.indexOf('function barreValiderFiche'),
                         src.indexOf("/* L'etat d'une fiche a son ouverture"));
    vrai(/data-action="enregistrer-fiche"\$\{dater \? `[^`]*` : ''\}>\$\{trad\(libelle\)\}/.test(fn),
      'il dit ce qu’il fait, et ne promet plus de fermer');
    vrai(/dater === 'solde' \? \(parts > 1 \? 'Confirmer les soldes' : 'Confirmer le solde'\)/.test(fn)
      && /: 'Enregistrer';/.test(fn), 'il confirme un montant qu’il date, il enregistre sinon');
    vrai(/trad\('Annuler les modifications'\)/.test(fn), '« Annuler » dit ce qu’il annule');
    const action = src.slice(src.indexOf("'enregistrer-fiche'(btn)"),
                             src.indexOf("async 'supprimer-compte'"));
    vrai(action.length > 200, 'l’action doit être trouvable');
    vrai(!/ACTIONS\.goto/.test(action),
      'elle ne renvoie plus ailleurs : la navigation s’en charge, et elle ne perd rien');
    vrai(/ficheAvant = null/.test(action),
      '« Annuler » ne peut pas défaire ce qui vient d’être enregistré');
    vrai(/window\.scrollY[\s\S]{0,120}window\.scrollTo\(0, y\)/.test(action),
      'et la position dans la page est gardée : la fiche est longue');
    /* Quatre appels : la carte du solde et celle des informations d'un compte
       (l'une ou l'autre, jamais les deux), la carte « Mettre a jour » d'un
       bien, et la carte des notes d'un etablissement. */
    eq((src.match(/barreValiderFiche\(/g) || []).length, 5,
      'une déclaration et quatre appels : solde, bien, informations d’un compte, notes d’un établissement');
    /* Elle ferme la carte des champs : une rangee posee hors des cartes flotte
       dans une page ou tout est encadre, et le filet la separe de la saisie. */
    vrai(/<div class="fiche-actes apres-champs">/.test(fn),
      'et elle porte la géométrie commune, plus le filet du bas de carte');
    /* L'ecriture a la frappe reste la regle : l'ecouteur `input` continue
       d'appeler `applyField` et `Store.save` hors des blocs differes. */
    /* L'ancre est le selecteur des champs, pas l'evenement : `input` est ecoute
       a plusieurs endroits, et le premier trouve n'etait pas celui-ci. */
    const ancre = src.indexOf("const f = e.target.closest('[data-path]')");
    vrai(ancre > 0, 'l’écouteur des champs doit être trouvable');
    const ecouteur = src.slice(ancre, ancre + 800);
    vrai(/applyField\(f\);[\s\S]{0,450}?Store\.save\(/.test(ecouteur),
      'la fiche continue d’écrire à la frappe : le bouton confirme, il ne conditionne pas');
  });

  test('un bien s’achète, un compte s’ouvre', () => {
    /* Le predicat vit cote store pour que la question posee a la creation et
       l'intitule affiche sur la fiche ne puissent pas diverger. */
    vrai(estUnBien(typeCompte('bienValeur')), 'un bien de valeur est un bien');
    vrai(estUnBien(typeCompte('immo')), 'un bien immobilier aussi');
    vrai(!estUnBien(typeCompte('courant')), 'un compte courant n’en est pas un');
    vrai(!estUnBien(typeCompte('cto')), 'un compte-titres non plus');
  });
});

suite('Une fiche se valide ou s’annule, et rien ne se saisit sans borne', () => {
  test('la dernière porte de saisie libre porte enfin une limite', () => {
    /* `askForm` borne ses champs par `max`, les pages par `maxlength`, et
       `askText` n'avait rien : c'est par la que passent la nouvelle categorie de
       depenses, le nom d'une charge partagee et celui d'une banque. Trois
       intitules qui s'affichent ensuite dans des colonnes etroites. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai(/function askText\(titre, message, exemple = '', valeur = '', max = NOM_LIGNE_MAX\)/.test(src),
      'askText prend une borne, par défaut celle des intitulés');
    vrai(/id="txtValeur"[\s\S]{0,120}?maxlength="\$\{max\}"/.test(src),
      'et son champ la porte');
    /* La borne se derive de la constante commune : deux nombres ecrits a la main
       auraient diverge a la premiere retouche. `tests.html` ne charge pas
       `app.js`, la constante se lit donc dans la source. */
    eq((src.match(/const NOM_LIGNE_MAX = (\d+);/) || [])[1], '30',
      'la borne des intitulés');
  });

  test('toutes les colonnes des positions se trient, et le « ? » ne vole plus le clic', () => {
    /* Quatre colonnes ne se triaient pas — quantite, prix de revient, cours,
       poids — et deux portaient leur explication sur la cellule entiere, donc
       sur la zone qui trie. Expliquer et trier etaient le meme geste. */
    const src = lireSource('assets/app.js');
    /* `tests.html` ne charge que `store.js` : la table se lit dans la source. */
    const table = src.slice(src.indexOf('const POS_SORT_KEYS'),
                            src.indexOf('function sortPositions'));
    vrai(table.length > 100, 'la table des clés de tri doit être trouvable');
    const cles = ['name', 'qty', 'pru', 'cours', 'value', 'invested', 'perfEur', 'perfPct', 'poids'];
    for (const k of cles) {
      vrai(new RegExp(`\\b${k}:\\s*p =>`).test(table), `la colonne ${k} a une clé de tri`);
      vrai(new RegExp(`sortableTh\\('${k}'`).test(src), `et l’en-tête ${k} l’utilise`);
    }
    /* Le tri vit dans un bouton a l'interieur de la cellule, et l'aide a cote. */
    vrai(/<button type="button" class="th-tri" data-action="sort-positions"/.test(src),
      'le tri est porté par un bouton, pas par la cellule entière');
    /* `trad()` autour de l'explication : elle arrive d'un appelant qui l'écrit en
       français, et une bulle d'aide se traduit comme le reste. */
    vrai(/\+ \(explication \? aide\(trad\(explication\)\) : ''\)/.test(src),
      'et l’explication se pose à côté de ce bouton, traduite');
    vrai(!/<th title="Prix de revient unitaire/.test(src),
      'plus aucune explication sur la cellule elle-même');

    /* Le tri par poids classe comme le tri par valeur : le denominateur est
       commun a toutes les lignes, donc l'ordre est le meme. Deux clefs qui
       donneraient deux ordres pour la meme colonne seraient un piege. */
    eq((table.match(/poids:\s*p => (.+),/) || [])[1],
       (table.match(/value:\s*p => (.+),/) || [])[1],
      'le poids se classe exactement comme la valeur : le dénominateur est le '
      + 'même pour toutes les lignes, donc l’ordre aussi');
  });

  test('« Annuler » rétablit la fiche, il n’empêche pas d’écrire', () => {
    /* La regle du projet : une page ecrit a la frappe, parce qu'un bouton qui
       conditionne l'ecriture jette tout ce qu'on a tape si l'on quitte sans le
       voir. Annuler ne peut donc pas vouloir dire ne rien ecrire. Il veut dire
       remettre cette fiche comme on l'a trouvee : une action reelle, qui defait
       un travail, et qui merite sa confirmation. */
    const src = lireSource('assets/app.js');
    vrai(/'annuler-fiche'\(btn\)/.test(src), 'l’action existe');
    vrai(/await askConfirm\(\s*\n?\s*trad\('Annuler tes modifications \?'\)/.test(src),
      'et elle demande confirmation, dans les deux langues');
    /* La confirmation ne se pose que s'il y a quelque chose a defaire : un
       avertissement systematique cesse d'etre lu. */
    vrai(/if \(!ficheModifiee\(\)\) \{[^}]*retour\(\); return; \}/.test(src),
      'une fiche non modifiée se ferme sans rien demander');
    /* L'ecriture continue reste la regle. */
    const ancre = src.indexOf("const f = e.target.closest('[data-path]')");
    vrai(/applyField\(f\);[\s\S]{0,450}?Store\.save\(/.test(src.slice(ancre, ancre + 800)),
      'la fiche continue d’écrire à chaque frappe');
    /* L'instantane se prend au premier rendu d'une route, sinon la fiche se
       re-rend a chaque frappe et la photo serait toujours identique. */
    vrai(/if \(!ficheAvant \|\| ficheAvant\.cle !== cle\)/.test(src),
      'l’instantané ne se reprend pas à chaque rendu');
    vrai(/memoriserFiche\(`compte:\$\{c\.id\}`\)/.test(src),
      'la fiche d’un compte le pose');
    vrai(/memoriserFiche\(`etab:\$\{e\.id\}`\)/.test(src),
      'celle d’un établissement aussi');
  });

  test('Marchés ne renvoie plus vers le journal des ventes', () => {
    /* Marches est la page des lignes qu'on detient : une vente n'en est plus
       une, et la barre d'onglets mene a Performance en un geste. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf('function viewPositions');
    const fin = src.indexOf('function salesCard');
    vrai(debut > 0 && fin > debut, 'les deux fonctions doivent être trouvables');
    const vue = src.slice(debut, fin);
    vrai(!/vente\$\{st\.count > 1 \? 's' : ''\} enregistrée/.test(vue),
      'le renvoi « n ventes enregistrées » a quitté cette page');
    vrai(!/data-action="go-performance"/.test(vue),
      'et son bouton avec lui');
    /* Le journal lui-meme n'a pas bouge : c'est le renvoi qui partait. */
    vrai(/Journal des ventes/.test(src), 'le journal existe toujours, dans Performance');
  });
});

suite('Le balisage et le dictionnaire disent le même mot', () => {
  test('aucun libellé d’index.html ne contredit sa traduction française', () => {
    /* Le defaut que ce test empeche.

       Un onglet renomme dans `index.html`, aux deux endroits ou il s'ecrit,
       continuerait d'afficher l'ancien nom dans le menu de gauche : au
       chargement, `translateStatic()` remplace le texte de tout element
       `data-i18n` par la valeur du dictionnaire. Le mot vit donc a deux
       endroits -- le balisage et `i18n.js` -- et c'est le second qui gagne,
       silencieusement. Corriger le premier ne se voit nulle part.

       C'est la faute que ce projet corrige sans arret, sous une forme nouvelle :
       une liste se derive, elle ne se recopie pas. Ici on ne peut pas deriver --
       le balisage doit rester lisible sans JavaScript, et le dictionnaire doit
       porter l'anglais -- mais on peut refuser qu'ils divergent. */
    const html = lireSource('index.html');
    vrai(html, 'index.html doit être lisible');

    /* La reference n'est plus le dictionnaire francais lu a la regex, mais
       `t()` lui-meme, dans la langue ou l'application s'ouvre : c'est
       exactement ce que `translateStatic()` ecrira dans l'element. Comparer au
       resolveur plutot qu'a une copie de sa table supprime vingt lignes
       d'analyse fragile — et rend le controle juste dans les deux depots, dont
       l'un ouvre en anglais.

       Le contrat de repli est inchange : une clef pointee (`nav.*`) se resout
       par la table, une clef-phrase EST son propre texte francais. */

    /* Chaque libelle statique du balisage, avec sa clef. Le texte peut porter
       des elements freres — le badge « ✎ » de Budget vit hors du span — donc on
       ne lit que le contenu direct de l'element marque. */
    /* Deux familles de clefs coexistent : les clefs pointees (nav.*), dont le
       francais vit dans le dictionnaire FR, et les clefs-phrases, dont le
       contrat de repli est que la clef EST le texte francais. Pour celles-ci,
       la coherence exigible est l'egalite du balisage et de la clef. */
    const paires = [...html.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)];
    vrai(paires.length > 8, 'index.html doit porter ses libellés balisés');

    const fautes = [];
    enLangue(langueParDefaut(), () => {
      for (const [, cle, texte] of paires) {
        const attendu = t(cle);
        /* Une clef pointee que rien ne resout se rend elle-meme : c'est le
           signe qu'elle manque au dictionnaire. Une clef-phrase, elle, se rend
           legitimement elle-meme en francais. */
        const pointee = /^[a-z]\w*(\.\w+)+$/i.test(cle);
        if (pointee && attendu === cle) {
          fautes.push(`${cle} : absente du dictionnaire`);
          continue;
        }
        const dit = texte.trim();
        if (dit && dit !== attendu) {
          fautes.push(`${cle} : « ${dit} » dans le balisage, « ${attendu} » attendu`);
        }
      }
    });
    eq(fautes.join(' | '), '',
      'le mot affiché vient du dictionnaire : un balisage qui dit autre chose est '
      + 'une correction qui ne se verra jamais');
  });

  test('l’onglet s’appelle Actifs dans les trois endroits qui le nomment', () => {
    /* Le balisage du menu, celui de la barre d'onglets, et les deux
       dictionnaires. Le mot attendu dans le balisage est celui de la langue par
       defaut, pas le francais : ce depot peut s'ouvrir en anglais. */
    const html = lireSource('index.html');
    const js = lireSource('assets/i18n.js');
    let attendu;
    enLangue(langueParDefaut(), () => { attendu = t('nav.accounts'); });

    const marques = [...html.matchAll(/data-i18n="nav\.accounts"[^>]*>([^<]*)</g)]
      .map(m => m[1].trim());
    eq(marques.length, 2,
      'cet onglet se nomme au menu de gauche et dans la barre du téléphone');
    for (const dit of marques) {
      eq(dit, attendu, `le balisage dit « ${dit} », l’application écrira « ${attendu} »`);
    }
    vrai(/'nav\.accounts': 'Actifs',/.test(js), 'le dictionnaire français');
    vrai(/'nav\.accounts': 'Assets',/.test(js), 'et l’anglais suit');
    vrai(!marques.includes('Comptes'),
      'plus aucun « Comptes » dans le balisage de cet onglet');
  });
});

suite('La page Actifs range ce qu’on tient chez un tiers et ce qu’on tient soi-même', () => {
  test('« détenu en direct » se pose sur la classe, pas sur le type', () => {
    /* Deux predicats voisins qu'il ne faut surtout pas confondre.

       `estUnBien()` dit si ce compte se saisit par une valeur et un prix
       d'achat. Le non cote dit oui : c'est le parcours de creation qui s'en
       sert. `estDetenuEnDirect()` dit si le contenant est la chose elle-meme,
       et le non cote dit non -- une part de societe a un emetteur en face, et
       une plateforme la tient pour toi.

       Une page qui lirait `estUnBien()` rangerait les plateformes de
       financement participatif sous Biens et especes, alors que ce sont des
       plateformes. */
    vrai(estDetenuEnDirect(typeCompte('immo')), 'un appartement se tient soi-même');
    vrai(estDetenuEnDirect(typeCompte('bienValeur')), 'une montre aussi');
    vrai(!estDetenuEnDirect(typeCompte('nonCote')),
      'une part de société non cotée est tenue par une plateforme');
    vrai(!estDetenuEnDirect(typeCompte('cto')), 'un compte-titres par un courtier');
    vrai(!estDetenuEnDirect(typeCompte('courant')), 'un compte courant par une banque');

    /* Et la difference avec l'autre predicat est verifiee, pas supposee : c'est
       elle qui a coute la mesure. */
    vrai(estUnBien(typeCompte('nonCote')),
      'le non coté se saisit bien comme un bien : les deux prédicats diffèrent, '
      + 'et c’est exactement le piège');

    /* Et le controle qui aurait attrape le defaut : lequel des deux la vue
       emploie pour partager ses sections. Les assertions ci-dessus decrivent le
       modele et restaient vertes pendant que la page se trompait. */
    const src = lireSource('assets/app.js');
    /* La règle vit dans le MODÈLE et non dans la vue : trois écrans en dépendent
       — la liste des comptes et les deux fiches — et la copie locale se fermait
       de surcroît sur les comptes filtrés par la recherche, si bien que taper
       trois lettres pouvait faire changer un groupe de section. */
    vrai(/siens\.every\(c => estDetenuEnDirect\(typeCompte\(c\.type\)\)\)/
      .test(lireSource('assets/store.js')),
      'le partage en sections se décide sur « détenu en direct »');
    vrai(!/const estEtabDeBiens = /.test(src),
      'et la vue n’en garde pas une seconde écriture');
    vrai(!/siens\.every\(c => estUnBien\(/.test(src),
      'et surtout pas sur « se saisit comme un bien », qui range les plateformes '
      + 'de financement participatif du mauvais côté');
  });

  test('une SCPI n’est pas un appartement, malgré la classe commune', () => {
    /* Le drapeau a demenage : il etait pose sur la classe `immobilier`, ce qui
       rangeait les SCPI avec les appartements. Une SCPI est du papier, tenu par
       une societe de gestion exactement comme un courtier tient des actions.

       Deux types partagent une classe sans partager le mode de detention : la
       classe dit de quoi c'est fait, le type dit qui le tient. C'est donc le
       type qui porte `direct`, avec `sansEtab`, `prete` et `interne`. */
    eq(typeCompte('immo').classes.join(), typeCompte('scpi').classes.join(),
      'les deux portent bien la même classe : c’est ce qui rendait le piège invisible');
    vrai(estDetenuEnDirect(typeCompte('immo')), 'un appartement se tient soi-même');
    vrai(!estDetenuEnDirect(typeCompte('scpi')),
      'une SCPI est tenue par une société de gestion');
    vrai(estDetenuEnDirect(typeCompte('bienValeur')), 'une montre se tient soi-même');

    /* Et rien d'autre n'est direct : le test parcourt le modele au lieu de
       nommer une liste, pour qu'un type ajoute demain ne passe pas au travers. */
    const directs = TYPES_COMPTE.filter(t => t.direct).map(t => t.id).sort().join(',');
    eq(directs, 'bienValeur,immo',
      'deux types seulement se détiennent en direct');
  });

  test('les trois intertitres se posent ensemble ou pas du tout', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    /* Un seul titre ne range rien, il ajoute une ligne : les intertitres ne
       paraissent que si les deux sections existent vraiment. */
    vrai(/sectionsAffichees = !!chezUnTiers\.trim\(\) && !!enDirect\.trim\(\)/.test(src),
      'les titres se décident sur le contenu réel des deux sections');
    eq((src.match(/sectionsAffichees \? titreSection\(/g) || []).length, 3,
      'et les trois disparaissent ensemble, sous le même drapeau');

    /* Le groupe des comptes archives se rend hors du if/else, tout en bas :
       sans son propre titre il tombait sous « Biens et especes », qui ne le
       contient pas. Un titre pose une etagere pour tout ce qui suit. */
    vrai(/sectionsAffichees \? titreSection\('Archivés'/.test(src),
      'les archivés portent leur propre étiquette, sous le même drapeau');

    for (const mot of ['Comptes', 'Biens et espèces', 'Archivés']) {
      vrai(new RegExp(`titreSection\\('${mot}'`).test(src), `l’intertitre « ${mot} »`);
    }
    /* Le groupe sans contenant a change de nom en meme temps : « Hors
       etablissement » decrivait une absence, sous un titre qui dit deja
       laquelle. */
    vrai(!/'Hors établissement'/.test(src),
      'plus de groupe nommé par ce qui lui manque');
    /* Le titre porte le seul fait commun a ces lignes — personne ne les tient
       pour toi — et le sous-titre ce qu'on y trouve. « Chez toi » affirmait un
       lieu que l'application ne connait pas : une voiture n'est pas chez toi,
       une montre peut dormir dans un coffre en banque. */
    vrai(/trad\('Sans intermédiaire'\), trad\('espèces et objets de valeur'\)/.test(src),
      'il se nomme par ce qui est vrai de toutes ses lignes');
    vrai(!/'Chez toi'/.test(src),
      'et jamais par un lieu que rien dans les données ne dit');
  });

  test('la page reste la somme de ses parts, quelle que soit la section', () => {
    /* La regle cardinale, appliquee au decoupage : deplacer un groupe d'une
       section a l'autre ne doit rien retirer ni rien compter deux fois. Le
       controle porte sur le partage lui-meme — chaque etablissement tombe dans
       une section et une seule, et aucun compte ouvert n'echappe aux deux. */
    Fixture.poser();
    Store.state.etabs.push({ id: 'e_immo', nom: 'Appartement', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_immo', etabId: 'e_immo', type: 'immo',
      statut: 'ouvert', cash: [], lignes: [{ id: 'l', classe: 'immobilier',
      libelle: 'Appartement', valeur: 180000, prixDeRevient: 150000 }] });
    Store.state.comptes.push({ id: 'c_bv', etabId: null, type: 'bienValeur',
      statut: 'ouvert', libelle: 'Rolex', cash: [], lignes: [{ id: 'l2',
      classe: 'bienValeur', libelle: 'Rolex', valeur: 9000, prixDeRevient: 7000 }] });

    const ouverts = comptesOuverts();
    const enDirect = e => {
      const siens = ouverts.filter(c => c.etabId === e.id);
      return siens.length > 0 && siens.every(c => estDetenuEnDirect(typeCompte(c.type)));
    };
    const tiers = Store.state.etabs.filter(e => !enDirect(e));
    const chezSoi = Store.state.etabs.filter(enDirect);
    eq(tiers.length + chezSoi.length, Store.state.etabs.length,
      'chaque établissement tombe dans une section et une seule');

    const sansContenant = ouverts.filter(c => !c.etabId || !etabById(c.etabId));
    const dansUnEtab = ouverts.filter(c => c.etabId && etabById(c.etabId));
    eq(sansContenant.length + dansUnEtab.length, ouverts.length,
      'aucun compte ouvert n’échappe aux deux sections');

    const somme = Store.state.etabs.reduce((s, e) =>
      s + ouverts.filter(c => c.etabId === e.id).reduce((t, c) => t + valeurCompte(c), 0), 0)
      + sansContenant.reduce((s, c) => s + valeurCompte(c), 0);
    eq(round2(somme), round2(patrimoine().brut),
      'et la somme des deux sections fait le total affiché en tête de page');
  });
});

suite('Un contenant dit ce qu’il contient avec le mot juste', () => {
  test('on n’a pas de compte dans un studio', () => {
    /* La page annoncait « studio lyon, 2 comptes ». Le mot venait de la banque,
       ou il est juste, et suivait sans le savoir jusqu'aux biens. Il vit
       desormais dans `CONTENANTS`, avec les autres mots du contenant, de sorte
       que la vue les lise tous au meme endroit. */
    Fixture.poser();
    Store.state.etabs.push({ id: 'e_studio', nom: 'Studio Lyon', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_s1', etabId: 'e_studio', type: 'immo',
      statut: 'ouvert', cash: [], lignes: [{ id: 'l1', classe: 'immobilier',
      libelle: 'Studio Lyon', valeur: 150000 }] });
    eq(motContenu('e_studio', 1), 'bien', 'un bien immobilier est un bien');
    Store.state.comptes.push({ id: 'c_s2', etabId: 'e_studio', type: 'immo',
      statut: 'ouvert', cash: [], lignes: [{ id: 'l2', classe: 'immobilier',
      libelle: 'Parking', valeur: 15000 }] });
    eq(motContenu('e_studio', 2), 'biens', 'et deux font des biens');

    /* Une banque garde le sien, une plateforme aussi : Plateforme A ouvre bien un
       compte. Le mot ne change que la ou il etait faux. */
    Store.state.etabs.push({ id: 'e_bq', nom: 'Fortuneo', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_b1', etabId: 'e_bq', type: 'courant',
      statut: 'ouvert', cash: [{ montant: 100, affectation: 'courant' }], lignes: [] });
    eq(motContenu('e_bq', 1), 'compte', 'une banque tient des comptes');
    eq(motContenu('e_bq', 3), 'comptes', 'et le pluriel s’accorde');

    /* Un contenant vide retombe sur le terme le plus large : il ne survit que
       pour un credit, et un credit se doit a un preteur. */
    Store.state.etabs.push({ id: 'e_vide', nom: 'Ancienne banque', notes: '', dettes: [] });
    eq(motContenu('e_vide', 1), 'compte', 'un contenant vide n’invente pas un mot');
  });

  test('le mot du contenu vit là où vivent les autres mots du contenant', () => {
    /* La regle du projet : un fait se regle a un seul endroit. Le mot du
       contenant et celui du contenu se lisent dans la meme table, donc ils ne
       peuvent pas se contredire — « Bien immobilier » en titre au-dessus de
       « 2 comptes » etait exactement cette contradiction. */
    for (const [cle, c] of Object.entries(CONTENANTS)) {
      vrai(typeof c.contenu === 'string' && c.contenu,
        `le contenant « ${cle} » dit ce qu’il contient`);
      vrai(c.contenu === c.contenu.toLowerCase(),
        `« ${cle} » garde son mot en minuscules : il s’emploie au milieu d’une phrase`);
    }
    eq(CONTENANTS.bien.contenu, 'bien', 'un bien immobilier contient des biens');

    /* Et les vues le tirent de la, jamais en dur. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const vue = src.slice(src.indexOf('function viewAccounts'),
                          src.indexOf('function mountAccounts'));
    vrai(!/compte\$\{siens\.length > 1 \? 's' : ''\}/.test(vue),
      'la page ne compose plus le mot à la main');
    vrai(/motContenu\(e\.id, siens\.length\)/.test(vue),
      'elle le demande à la table');
    const fiche = src.slice(src.indexOf('function viewFicheEtab'));
    vrai(/motContenu\(e\.id/.test(fiche), 'la fiche aussi');
    vrai(!/<h2>Comptes rattachés<\/h2>/.test(src),
      'et son titre de carte ne dit plus « Comptes » au-dessus de deux appartements');
  });

  test('la majuscule ne se pose qu’en tête, et ne casse rien', () => {
    /* Un mot de table s'ecrit en minuscules ; les titres et les boutons le
       relevent. La fonction doit survivre a une chaine vide, puisqu'elle recoit
       le resultat d'une table qu'on peut completer de travers. */
    eq(majuscule('bien'), 'Bien');
    eq(majuscule('comptes'), 'Comptes');
    eq(majuscule(''), '', 'une chaîne vide reste vide');
    eq(majuscule(null), '', 'et une absence ne lève pas');
    eq(majuscule('É'), 'É', 'une capitale accentuée se laisse tranquille');
  });
});

suite('Un bien se crée seul, s’estime, et se modifie par un bouton', () => {
  test('on ne rattache pas un appartement à un autre appartement', () => {
    /* Le parcours proposait « à quel bien le rattacher ? » avec les biens déjà
       enregistrés. Or le contenant EST le bien : rattacher un studio à un autre
       studio ne veut rien dire, et la ligne prenait ensuite le nom du contenant
       — deux « studio lyon » dans la même fiche, à 10 000 et 15 000 EUR.

       Le contenant ne disparaît pas pour autant, contrairement au bien de
       valeur : c'est lui qui porte le crédit. Il se crée sans qu'on ait à le
       choisir. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai(/else if \(!etabId && estDetenuEnDirect\(t\)\) etabId = '__nouveau';/.test(src),
      'un bien détenu en direct crée toujours son propre contenant');

    /* L'ordre des branches est l'invariant : `etabImpose` doit passer avant.
       Le bouton « + Bien » de la fiche le pose, et c'est le chemin délibéré pour
       ajouter un parking sous l'appartement qu'il accompagne. Si la garde
       `!etabId` sautait, ce chemin serait mort. */
    const bloc = src.slice(src.indexOf('let etabId = etabImpose;'),
                           src.indexOf("if (etabId === '__nouveau')"));
    const posImpose = bloc.indexOf('estDetenuEnDirect(t)');
    vrai(/!etabId && estDetenuEnDirect/.test(bloc) && posImpose > 0,
      'la branche ne se déclenche pas quand l’établissement est imposé');
    vrai(/data-action="ajouter-compte" data-etab=/.test(src),
      'et le bouton de la fiche continue d’imposer le sien');
  });

  test('ce qu’on détient soi-même, personne ne le cote', () => {
    /* « Il faut marquer prix estime » vaut pour l'immobilier autant que pour un
       bien de valeur. La classe seule ne pouvait pas le dire : `immobilier`
       couvre un appartement, dont la valeur est une appreciation, et une SCPI,
       dont le prix de part est publie. C'est le meme drapeau `direct` qui tranche,
       parce que c'est la meme question. */
    const src = lireSource('assets/app.js');
    vrai(/function champsPlacement\(classe, l = null, prete = false, type = null\)/.test(src),
      'la fenêtre d’un placement reçoit le type, pas seulement la classe');
    /* Le drapeau a grandi sans changer de question : `estValeurEstimee` se
       dérive de `direct` et ajoute ce qui se valorise soi-même sans être
       détenu en direct — une part de société est tenue par un tiers et n'en
       est pas moins une appréciation. */
    vrai(/const estime = estValeurEstimee\(type\);/.test(src),
      'et c’est le drapeau qui décide de l’intitulé');
    for (const t of TYPES_COMPTE.filter(x => x.direct)) {
      vrai(estValeurEstimee(t), '« ' + t.id + ' » reste couvert');
    }
    /* Le parcours de creation dit la meme chose, et un mot de plus : la valeur
       saisie est celle du bien ENTIER, ce qui compte des qu'une quote-part
       existe. Les deux intitules passent par le dictionnaire. */
    vrai(/estDetenuEnDirect\(t\) \? trad\('Valeur estimée du bien entier \({dev}\)'\)/.test(src),
      'le parcours de création parle de valeur estimée, du bien entier');
    vrai(/: trad\('Valeur actuelle \({dev}\)'\)/.test(src), 'et de valeur actuelle sinon');
    vrai(!/t\.classes\.includes\('bienValeur'\) \? 'Valeur estimée'/.test(src),
      'plus de test sur une classe en particulier');

    /* Et la date suit, parce que c'est elle qui rend l'intitule honnete : un
       chiffre estime sans date ne dit pas de quand.

       La condition s'est elargie sans rien perdre. Une valeur DATEE couvre deux
       natures — celle qu'on estime soi-meme et celle qu'un tiers publie — et
       `datee` contient `estime` par construction, ce que la ligne suivante
       exige. Un chiffre estime porte donc toujours sa date, comme avant. */
    vrai(/const datee = estime \|\| publiee;/.test(src),
      'une valeur datée, c’est une valeur estimée ou une valeur publiée');
    vrai(/\.\.\.\(datee \? \[\{ cle: 'estimeLe'/.test(src),
      'la date accompagne toujours la valeur estimée');
  });

  test('un compte n’a qu’un nom, et c’est celui qu’on a tapé', () => {
    /* « Crypto · Satellite · Crypto » : le troisieme mot d'un sous-titre de
       ligne de titres est le nom du COMPTE, et il affichait un nom court herite
       des anciennes donnees. Un portefeuille nomme « Crypto wallet TR » se
       lisait « Crypto » sous chacune de ses lignes — ce qui ne dit meme pas
       duquel il s'agit quand il y en a deux. Vu a l'ecran.

       `c.court` n'est modifiable par AUCUN ecran depuis le passage au modele
       actuel : il ne pouvait donc que vieillir, et il gagnait. */
    Fixture.poser();
    refreshAccounts();
    const projetes = Object.values(ACC).filter(a => !a.fantome);
    vrai(projetes.length > 0, 'la fixture projette des comptes');
    for (const a of projetes) {
      vrai(!('short' in a), `« ${a.label} » ne porte plus de nom court`);
      eq(a.label, nomCompteV2(a.compte), `« ${a.label} » porte le nom du compte`);
    }
    /* ET AUCUN ECRAN NE PEUT PLUS EN LIRE UN SECOND. Treize endroits affichaient
       `short` ; la decision avait pourtant deja ete prise pour le menu de choix
       d'un compte, avec ce motif exact. Elle n'avait ete appliquee qu'a un
       endroit, et deux champs pour un meme fait finissent par diverger. */
    const app = lireSource('assets/app.js');
    vrai(!/\?\.short/.test(app), 'aucune vue ne lit de nom court');
    /* La donnee, elle, reste : une pierre tombale de compte supprime la porte,
       et on ne jette pas une donnee parce qu'elle a cesse de s'afficher. */
    const store = lireSource('assets/store.js');
    vrai(/court: a\.short \|\| ''/.test(store),
      'la migration continue de la conserver');
  });

  test('la fiche appelle un bien un bien', () => {
    /* « Nom du compte », « Type de compte », « Compte » en etiquette de tete : on
       n'a pas de compte dans une montre. Le mot se derive du meme drapeau que
       tout le reste. */
    eq(motCompte(typeCompte('bienValeur')), 'bien');
    eq(motCompte(typeCompte('immo')), 'bien');
    eq(motCompte(typeCompte('scpi')), 'compte', 'une SCPI est bien un compte');
    eq(motCompte(typeCompte('courant')), 'compte');
    eq(motCompte(typeCompte('pea')), 'compte');

    const src = lireSource('assets/app.js');
    /* Les intitules passent par trad() depuis le chantier des deux langues :
       le fragment francais est la clef, le mot du compte reste derive. */
    for (const motif of ["trad\\('Nom du'\\)\\} \\$\\{motCompte", "trad\\('Type de'\\)\\} \\$\\{motCompte",
                         "trad\\('Valeur du'\\)\\} \\$\\{motCompte"]) {
      vrai(new RegExp(motif).test(src), `la fiche dérive « ${motif} »`);
    }
    vrai(/hero-label">\$\{majuscule\(motCompte\(t\)\)\}/.test(src),
      'l’étiquette de tête aussi');
    vrai(!/<dt>Nom du compte<\/dt>/.test(src), 'plus aucun intitulé écrit en dur');
  });

  test('un mot par nature, et la fiche ne se contredit plus', () => {
    /* TROIS ECRANS SE CONTREDISAIENT EUX-MEMES, et c'est ce que ce controle
       interdit : un pret participatif titrait « Le placement » et demandait le
       « Nom du compte » ; un bien de valeur titrait « Le placement » et demandait
       le « Nom du bien ». Le titre et les champs se derivent maintenant du meme
       drapeau, donc ils ne peuvent plus diverger. */
    for (const [id, mot] of [['pe', 'placement'], ['fondsNonCote', 'placement'],
                             ['crowdfunding', 'placement'],
                             ['immo', 'bien'], ['bienValeur', 'bien'],
                             ['scpi', 'compte'], ['courant', 'compte'], ['pea', 'compte']]) {
      eq(motCompte(typeCompte(id)), mot, `« ${id} » s’annonce « ${mot} »`);
    }
    /* Une SCPI reste un compte : on y detient des parts, et le compte porte des
       lignes. Ce n'est pas un bien detenu en direct, quoi qu'en dise la carte de
       ses lots. */
    vrai(!estActifTerminal(typeCompte('scpi')), 'une SCPI n’est pas un actif terminal');
    /* Et le titre de la carte suit le meme drapeau, mot pour mot. */
    for (const [id, titre] of [['pe', 'Le placement'], ['fondsNonCote', 'Le placement'],
                               ['crowdfunding', 'Le placement'],
                               ['immo', 'Le bien'], ['bienValeur', 'Le bien']]) {
      eq(titreActif(typeCompte(id)), titre, `« ${id} » se titre « ${titre} »`);
    }
    /* LES DEUX SE DERIVENT DU MEME FAIT : un actif detenu en direct est un bien,
       partout. Un controle qui recopierait la liste des types aurait laisse le
       prochain type diverger en silence. */
    for (const t of TYPES_COMPTE) {
      if (!estActifTerminal(t)) continue;
      eq(titreActif(t) === 'Le bien', motCompte(t) === 'bien',
        `« ${t.id} » dit la même chose dans son titre et dans ses champs`);
    }
  });

  test('les deux langues portent les trois mots', () => {
    /* « compte » et « bien » vivaient deja dans le dictionnaire ; « placement »
       aussi, ecrit avec des guillemets doubles plus bas dans le fichier — c'est
       le piege de la maison, une clef presente qui se donne pour absente. */
    for (const mot of ['compte', 'bien', 'placement']) {
      vrai(!!I18N.en[mot], `« ${mot} » a sa traduction`);
    }
    const src = lireSource('assets/i18n.js');
    for (const mot of ['compte', 'bien', 'placement']) {
      const fois = (src.match(new RegExp(`['"]${mot}['"]:`, 'g')) || []).length;
      eq(fois, 1, `« ${mot} » ne se déclare qu’une fois (${fois})`);
    }
  });

  test('l’édition d’un placement se prend par un bouton, pas par son nom', () => {
    /* Le nom etait un lien pointille et personne ne le voyait : « on ne comprend
       pas qu'on doit cliquer sur le nom ». Un intitule qui ouvre une fenetre est
       un savoir qui se transmet, pas une affordance.

       Toute la ligne ne peut pas devenir le bouton : elle porte deja un `select`
       pour la disponibilite, et un bouton dans un bouton n'existe pas. */
    const src = lireSource('assets/app.js');
    /* Bornée par la fonction suivante et non par un nombre de caractères : une
       tranche fixe rate ce qui vient après le prochain commentaire ajouté. */
    const debut = src.indexOf('function lignePlacement');
    const fn = src.slice(debut, src.indexOf('function viewAccounts', debut));
    vrai(fn.length > 1000, 'la fonction doit être trouvable');
    vrai(/class="btn sm ghost plc-modif"[\s\S]{0,120}?data-action="editer-placement"/.test(fn),
      'un bouton « Modifier » explicite au bout de la rangée');
    vrai(/>\$\{trad\('Modifier'\)\}<\/button>/.test(fn), 'et il porte le mot, traduit');
    vrai(!/class="mois-lien" data-action="editer-placement"/.test(fn),
      'le nom n’est plus un lien déguisé');
    /* `l.ref != null` : l'indice de la premiere ligne vaut zero, et le tester en
       verite booleenne rendait le premier placement de chaque compte non
       modifiable. Le piege est reste, la condition doit rester explicite. */
    vrai(/l\.ref != null/.test(fn),
      'un indice se compare à null : zéro est un indice valide');

    /* La grille cede sa derniere colonne quand le bouton est la : elle etait
       taillee pour un chevron de 0.9em. */
    const css = lireSource('assets/styles.css');
    vrai(/\.plc-placement:has\(\.plc-modif\)/.test(css),
      'la grille dépend de son contenu au lieu de réserver une largeur');
  });
});

suite('Un bien change de contenant, et garde un seul nom', () => {
  test('un crédit se pose sur le contenant, et une seule fois', () => {
    /* Le cas qui fonde ce test : trois studios ranges dans un meme contenant, et
       un credit ajoute a l'un ne doit pas s'attacher aux trois.

       Le calcul, lui, est juste : le credit compte une fois, et brut moins
       dettes egale net a l'euro pres. Ce test fige cette moitie de la reponse,
       pour qu'un futur reglage du rattachement ne se mette pas a compter la
       dette autant de fois qu'elle a de biens en face. */
    Fixture.poser();
    /* L'ecart, pas la valeur absolue : le fixture porte deja ses propres
       credits, et figer un total ici ferait echouer ce test au prochain
       enrichissement du jeu synthetique pour une raison sans rapport. */
    const avant = nowTotals().dettes;
    Store.state.etabs.push({ id: 'e_lyon', nom: 'Studio Lyon', notes: '',
      dettes: [{ id: 'd1', libelle: 'prêt', montant: 12000, preteur: '' }] });
    for (const [id, v] of [['c_a', 10000], ['c_b', 15000], ['c_c', 12]]) {
      Store.state.comptes.push({ id, etabId: 'e_lyon', type: 'immo', statut: 'ouvert',
        cash: [], lignes: [{ id: 'l' + id, classe: 'immobilier',
        libelle: 'Studio Lyon', valeur: v }] });
    }
    const t = nowTotals();
    eq(round2(t.dettes - avant), 12000,
      'la dette compte une fois, pas une fois par bien qu’elle accompagne');
    eq(round2(t.brut - t.dettes), round2(t.net),
      'et le net reste le brut moins les dettes');

    /* Le contenant porte bien les trois, ce qui est le fait que l'ecran montre :
       l'affichage ne se trompe pas, c'est le rangement qui ne convient pas. */
    eq(comptesOuverts().filter(c => c.etabId === 'e_lyon').length, 3,
      'les trois biens partagent un contenant');
  });

  test('un bien peut rejoindre son propre contenant', () => {
    /* Un compte naissait dans son contenant et y restait pour toujours : aucun
       ecran ne proposait de le deplacer. Le manque ne se voyait pas sur une
       banque — on ne demenage pas un PEA — et devenait bloquant sur les biens,
       ou le contenant decide qui partage un credit. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const debut = src.indexOf("async 'modifier-compte'");
    vrai(debut > 0, 'l’action doit exister');
    const handler = src.slice(debut, src.indexOf("async 'ajouter-compte'"));
    vrai(handler.length > 500, 'et être trouvable en entier');

    vrai(/cle: 'etab', label: trad\(mot\.titre\)/.test(handler),
      'la fenêtre propose le rattachement');
    /* Le mot du contenant se traduit a l'affichage : la clef reste la phrase
       francaise que porte CONTENANTS, l'option compose le « + … » autour. */
    vrai(/'__nouveau', `\+ \$\{trad\(mot\.nouveau\)\}…`/.test(handler),
      'et « nouveau », qui est justement le geste qui sépare');
    /* Les especes et les comptes internes n'ont pas de contenant a choisir. */
    vrai(/if \(!t\.interne && !t\.sansEtab\) \{/.test(handler),
      'sauf là où il n’y a pas de contenant');
    /* Le sien reste dans la liste : sans lui, ouvrir la fenetre pour changer
       autre chose deplacerait le compte au premier contenant venu. */
    vrai(/e\.id === c\.etabId\s*\n?\s*\|\|/.test(handler),
      'son contenant actuel reste choisissable');
    /* Et l'ecriture se fait avant le reste, pour qu'un nom abandonne ne laisse
       pas la moitie des modifications posees. */
    const posEtab = handler.indexOf("c.etabId = cible;");
    const posLib = handler.indexOf("pose('libelle'");
    vrai(posEtab > 0 && posLib > posEtab,
      'le contenant se règle avant le reste : fermer la fenêtre du nom '
      + 'n’a alors rien modifié');
  });

  test('renommer un bien renomme sa ligne', () => {
    /* Le compte et sa ligne unique sont la meme chose : la creation les ecrit
       ensemble, l'affichage se replie de l'un sur l'autre. Renommer par la
       fenetre ne touchait que le compte, et la fiche montrait deux noms. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf("async 'modifier-compte'");
    const handler = src.slice(debut, src.indexOf("async 'ajouter-compte'"));
    /* La garde s'est elargie du DIRECT au TERMINAL : une participation non
       cotee est tenue par un tiers et n'est pas davantage divisible qu'un
       appartement. Restreinte au direct, elle laissait une part de societe
       porter deux noms qui divergeaient en silence. */
    vrai(/estActifTerminal\(typeCompte\(c\.type\)\)\s*\n?\s*&& \(c\.lignes \|\| \[\]\)\.length === 1/
      .test(handler), 'le renommage suit, sous garde');
    vrai(/&& !\(c\.cash \|\| \[\]\)\.length/.test(handler),
      'et jamais sur un compte qui porte aussi des espèces');
    vrai(/c\.lignes\[0\]\.libelle = String\(v\.libelle\)\.trim\(\);/.test(handler),
      'la ligne prend le nom du bien');

    /* La garde compte : un compte a deux placements garde deux noms propres.
       Le controle est fait sur la condition, pas sur une execution, parce que
       `modifier-compte` ouvre une fenetre et ne se rejoue pas ici. */
    vrai(!/c\.lignes\.forEach\(l => l\.libelle/.test(handler),
      'aucun renommage en masse');

    /* Le nom d'un bien detenu en direct vit en trois exemplaires : compte,
       ligne, contenant. La carte de la liste des actifs affiche `etab.nom` :
       sans ce troisieme renommage, elle gardait l'ancien nom au-dessus d'une
       ligne qui portait le nouveau. */
    vrai(/etab\.nom = String\(v\.libelle\)\.trim\(\);/.test(handler),
      'le contenant prend aussi le nom du bien');
    /* Et LUI reste reserve au direct : le contenant d'une participation est le
       courtier qui la tient, le renommer du nom de la part serait faux. */
    vrai(/const etab = estDetenuEnDirect\(typeCompte\(c\.type\)\) \? etabById\(c\.etabId\) : null;/
      .test(handler), 'mais seulement pour ce qu’on détient en direct');
    vrai(/COMPTES\(\)\.filter\(x => x\.etabId === etab\.id\)\.length === 1/.test(handler),
      'seulement quand l’établissement n’a que ce compte : un parking '
      + 'rattaché au même contenant garde son nom propre');
  });

  test('aucun montant masqué ne se pose dans un attribut', () => {
    /* Le masque est une balise SVG qui porte son propre `aria-label="montant
       masqué"`. Injectee dans un attribut, son guillemet ferme l'attribut hote
       et la fin de la balise se deverse en texte : la carte des depenses
       affichait un `€">` nu a cote de l'objectif mensuel.

       `fmtEUR0Texte` existe pour ca — il rend « ••• € », sans balise. La regle
       vaut pour tout attribut, pas seulement celui qui a casse. */
    const src = lireSource('assets/app.js');
    const fautifs = [];
    for (const m of src.matchAll(/(title|aria-label|placeholder|data-aide)="[^"\n]*/g)) {
      if (/\$\{[^}]*\bfmt(EUR|Cur|Signed)\b(?!\w*Texte)/.test(m[0])) {
        fautifs.push(src.slice(0, m.index).split('\n').length + ' : ' + m[0].slice(0, 60));
      }
    }
    eq(fautifs.length, 0,
      'un montant masquable dans un attribut : passer par fmtEUR0Texte — ' + fautifs.join(' | '));

    /* Et le masque doit bien porter le guillemet qui rend le piege reel :
       si un jour il n'en portait plus, ce controle protegerait un fantome. */
    vrai(/aria-label="montant masqué"/.test(lireSource('assets/store.js')),
      'le masque porte un attribut, c’est ce qui interdit de l’imbriquer');
  });

  test('les usages de liquidités se plient comme les groupes de comptes', () => {
    /* Un `<details>` ne s'anime pas et n'offre aucune prise pour un geste
       collectif. Le panneau reprend donc le pli en grille de la page Actifs et
       son bouton « Tout replier », qui bascule dans les deux sens. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf("if (classe === 'liquidites')");
    const bloc = src.slice(debut, src.indexOf("if (classe === 'immobilier')", debut));
    vrai(bloc.length > 500, 'le panneau des liquidités doit être trouvable');
    vrai(!/<details class="liq-groupe"/.test(bloc),
      'plus de <details> : il ne s’anime pas');
    /* « ouvert » ne s'ecrit plus en dur : le pli se relit dans l'etat, sinon le
       premier rendu suivant — celui d'« Enregistrer » — redepliait tout. */
    vrai(/<div class="cpt-pli \$\{compteReplies\.has\(cleLiqPli\(g\.aff\)\) \? '' : 'ouvert'\}"><div class="liq-corps">/.test(bloc),
      'le pli animé est celui des groupes de comptes, et son état se relit');
    vrai(/data-cle="\$\{esc\(cleLiqPli\(g\.aff\)\)\}"/.test(bloc),
      'chaque groupe porte la clé sous laquelle son pli se mémorise');
    vrai(/data-action="liq-plier-tout"/.test(bloc) && /data-action="liq-plier"/.test(bloc),
      'un geste par groupe, et un pour les mener tous');
    /* Le bouton collectif vit sur la ligne du sous-titre, deja a moitie vide :
       une rangee a lui pousserait le contenu vers le bas dans une fenetre qui
       defile. Il sort donc de `html` et passe par `sousAction`. */
    vrai(/sousAction:/.test(bloc) && !/liq-barre/.test(bloc),
      'et il ne prend pas une ligne à lui : il se pose au bout du sous-titre');

    /* Le geste collectif ne passe pas par render() : le panneau porte des
       champs de saisie, et le reconstruire perdrait la frappe en cours. */
    const acts = src.slice(src.indexOf("'liq-plier'(btn)"), src.indexOf("'ajouter-compte'"));
    vrai(!/render\(\)/.test(acts),
      'aucun rendu global : il emporterait le focus et la saisie en cours');
    vrai(/majBoutonLiqTout/.test(acts),
      'et le libellé du bouton suit l’état après chaque geste, seul ou collectif');
  });

  test('renommer le contenant d’un bien renomme le bien', () => {
    /* Cas miroir : « Modifier l'etablissement » ne touchait que `e.nom`, meme
       quand le contenant est un bien — la carte disait « Credit immobilier »
       au-dessus d'une ligne « Appartement ». */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf("async 'modifier-etab'");
    const handler = src.slice(debut, src.indexOf("async 'modifier-compte'"));
    vrai(/tous\.length === 1 && estDetenuEnDirect\(typeCompte\(tous\[0\]\.type\)\)/
      .test(handler), 'sous garde : un seul compte, détenu en direct');
    vrai(/&& !\(tous\[0\]\.cash \|\| \[\]\)\.length/.test(handler),
      'et jamais sur un compte qui porte aussi des espèces');
    vrai(/tous\[0\]\.lignes\[0\]\.libelle = e\.nom;/.test(handler),
      'la ligne prend le nom du contenant');
  });
});

suite('La pastille des cours ne certifie que ce qu’elle sait', () => {
  test('elle date le prix, jamais la requête', () => {
    /* L'invariant fondateur : la pastille ne dit pas `lastRun`, l'heure a
       laquelle on a interroge la passerelle, sinon elle dirait il y a 2 min sur
       des cours imprimes la veille a 22 h. Le seul repere de fraicheur de
       l'application certifierait precisement ce qui est faux.

       Marquer actualise a l'instant reviendrait a retablir ce defaut. Ce test
       est la pour qu'aucune demande future ne le fasse par inadvertance. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const debut = src.indexOf('const marche = coursAsOf();');
    vrai(debut > 0, 'la pastille doit être trouvable');
    /* Borne par la fin de la fonction : une tranche fixe ratait la derniere
       branche des que le commentaire au-dessus s'allongeait. */
    const bloc = src.slice(debut, src.indexOf('function symbolSearchCard', debut));
    vrai(!bloc.includes('quand.textContent = ' + String.fromCharCode(39) + 'à l'),
      'jamais « à l’instant » écrit en dur : ce serait dater la requête');
    vrai(/fmtWhen\(new Date\(marche \* 1000\)\)/.test(bloc),
      'l’âge affiché est celui du cours');

    /* `coursAsOf()` prend le plus recent, ce qui est le bon choix pour une seule
       place et le mauvais des qu'il y en a deux. C'est pour cela que l'age ne
       s'affiche que lorsque tout a cote. */
    Fixture.poser();
    const t = Math.floor(Date.now() / 1000);
    Store.state.positions.forEach((p, i) => { p.manual = false; p.quoteTime = t - i * 3600; });
    eq(coursAsOf(), t, 'coursAsOf donne le cours le plus récent, pas le plus vieux');
  });

  test('trois états, parce qu’un portefeuille tient sur deux places', () => {
    /* Paris ouvre a 9 h, New York a 15 h 30 : entre les deux, la moitie des
       lignes a cote et l'autre non. Un age serait alors celui de la moitie
       fraiche, et le point vert dirait que tout va bien au-dessus d'un
       portefeuille a moitie perime. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf('const marche = coursAsOf();');
    /* Borne par la fin de la fonction : une tranche fixe ratait la derniere
       branche des que le commentaire au-dessus s'allongeait. */
    const bloc = src.slice(debut, src.indexOf('function symbolSearchCard', debut));

    vrai(/const partiel = !ferme && j\.horsSeance > 0;/.test(bloc),
      'l’état intermédiaire existe');
    vrai(/ferme \? trad\('hors séance'\)/.test(bloc),
      'tout fermé se dit « hors séance »');
    vrai(/partiel \? `\$\{j\.horsSeance\} \$\{trad\('hors séance'\)\}`/.test(bloc),
      'à moitié ouvert, le compte de ce qui n’a pas bougé');
    /* La pastille ne peut pas rester verte quand une part du portefeuille date
       de la veille : le point est le seul signal qu'on lit sans s'arreter. */
    vrai(/if \(partiel\) \{ btn\.classList\.remove\('frais'\); btn\.classList\.add\('tiede'\); \}/
      .test(bloc), 'et le point reste tiède, jamais frais');

    /* L'ordre des trois branches est l'invariant : « hors seance » doit passer
       avant « partiel », sinon un portefeuille entierement ferme afficherait le
       compte de ses lignes au lieu de sa raison. */
    const posFerme = bloc.indexOf("ferme ? trad('hors séance')");
    const posPartiel = bloc.indexOf('partiel ? `${j.horsSeance}');
    const posAge = bloc.indexOf('marche ? fmtWhen(new Date(marche * 1000))');
    vrai(posFerme > 0 && posPartiel > posFerme && posAge > posPartiel,
      'du plus fermé au plus ouvert : l’âge ne s’affiche qu’en dernier recours');
  });

  test('« tout hors séance » et « une partie » se dérivent des lignes détenues', () => {
    /* Pas d'une table d'horaires : les places n'ouvrent pas aux memes heures, et
       un ETF europeen dans un portefeuille americain ferait mentir n'importe
       quelle table. Ce qui compte n'est pas l'heure qu'il est, c'est qu'aucune
       ligne detenue n'ait bouge. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf('const marche = coursAsOf();');
    /* Borne par la fin de la fonction : une tranche fixe ratait la derniere
       branche des que le commentaire au-dessus s'allongeait. */
    const bloc = src.slice(debut, src.indexOf('function symbolSearchCard', debut));
    vrai(/const j = dayPerformance\(\);/.test(bloc),
      'l’état vient des lignes, pas d’un calendrier');
    vrai(!/getHours\(\)|09:00|15:30/.test(bloc),
      'aucune heure d’ouverture écrite en dur');

    /* Et le modele rend bien les deux quantites dont la pastille a besoin. */
    Fixture.poser();
    const j = dayPerformance();
    vrai('toutHorsSeance' in j, 'le total');
    vrai(typeof j.horsSeance === 'number', 'et le compte');
    /* Les deux quantites se recoupent : « tout hors seance » ne peut etre vrai
       que si le compte egale le nombre de lignes suivies. */
    eq(j.toutHorsSeance, j.lignes.length > 0 && j.horsSeance === j.lignes.length,
      '« tout hors séance » est exactement « chaque ligne hors séance »');
  });
});

suite('Le contenu de la page tient sur un très grand écran', () => {




  test('le contenu cesse de s’étirer sur un écran très large', () => {
    /* Sur 2 000 px, la colonne en faisait 1 750, et une courbe a douze points s'y
       etirait sur toute la largeur : des pixels depenses a eloigner les reperes,
       pas a montrer davantage. La borne ne joue qu'au-dela des tailles courantes
       — 1 440, 1 512 — pour ne rien changer a ceux qui les utilisent. */
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    /* Le corps d'une regle se borne a son accolade de fermeture, jamais a un
       nombre de caracteres. Une fenetre de 400 caracteres apres `body {`
       s'arretait au milieu du fichier reel, mais atteignait la regle SUIVANTE
       une fois les commentaires retires — et cette voisine porte un `max-width`.
       Le controle passait donc au vert ou au rouge selon la longueur des
       commentaires alentour, ce qui n'est pas son sujet. */
    const regle = (source, selecteur) => {
      const d = source.indexOf(selecteur);
      if (d < 0) return '';
      const f = source.indexOf('}', d);
      return f < 0 ? source.slice(d) : source.slice(d, f + 1);
    };
    const bloc = regle(css, '.view {');
    vrai(bloc, 'la règle .view doit être trouvable');
    /* 1 100 px, et le chiffre vient d'une mesure : le tableau le plus large de
       l'application demande 891 px, il en reçoit 1 002. À 1 480, un intitulé
       et son montant étaient séparés de 1 328 px sur un écran de 1 680, pour
       un tableau de trois colonnes. */
    vrai(/max-width: 1100px/.test(bloc), 'la colonne de contenu est bornée');
    vrai(/margin: 0 auto/.test(bloc), 'et centrée au-delà');
    vrai(/width: 100%/.test(bloc),
      'sans quoi une colonne flex se rétrécirait sur son contenu');
    /* Sur `.view` et non sur `body` : la barre laterale garde son bord d'ecran,
       qui est ce qui la fait lire comme une barre. */
    const corps = regle(css, 'body {');
    vrai(corps, 'la règle body doit être trouvable');
    vrai(!/max-width/.test(corps), 'la grille de page n’est pas bornée, elle');
  });
});

suite('Un loyer se rattache depuis le bien, pas depuis une liste', () => {
  test('deux boutons qui font, là où il y en avait un qui renvoyait', () => {
    /* Rattacher un loyer se fait depuis le bien, en un geste. La fenetre generique
       des revenus fixes demanderait de retrouver la bonne ligne et de changer sa
       liste de aucun vers ce bien : trois gestes, dans un ecran qui ne parle pas
       du bien, et dont l'intitule -- Revenus fixes -- ne ressemble pas au bouton
       clique.

       La carte Financement juste en dessous montre la bonne forme : + Credit
       cree le credit rattache, sans detour. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai(/data-action="ajouter-loyer" data-id="\$\{esc\(c\.id\)\}"/.test(src),
      'le bouton porte le bien sur lequel on se trouve');
    vrai(/data-action="ajouter-charge-bien" data-id="\$\{esc\(c\.id\)\}"/.test(src),
      'la charge aussi : taxe foncière, copropriété');
    vrai(!/data-action="toggle-revenus"[\s\S]{0,80}?>Loyers</.test(src),
      'le bouton qui renvoyait vers la liste générique a disparu de cette carte');

    /* Le rattachement n'est pas un champ de ces formulaires : il est leur raison
       d'etre. Un menu ou l'on pourrait choisir « aucun » redonnerait le geste
       qu'on vient d'eviter. */
    const loyer = src.slice(src.indexOf("async 'ajouter-loyer'"),
                            src.indexOf("async 'ajouter-charge-bien'"));
    vrai(loyer.length > 200, 'l’action doit être trouvable');
    vrai(!/cle: 'bienId'/.test(loyer),
      'aucun menu de rattachement : on part du bien');
    vrai(/bienId: c\.id/.test(loyer), 'il se pose d’office');
  });

  test('le loyer et la charge créés depuis la fiche entrent dans le cash-flow', () => {
    /* Le controle qui compte : un loyer pose par ce bouton doit se retrouver dans
       `cashFlowBien()`, sinon le geste ne sert a rien. Sur le cas du test :
       650 EUR de loyer, 1 200 EUR de taxe fonciere par an, cash-flow 550 EUR. */
    Fixture.poser();
    Store.state.etabs.push({ id: 'e_m', nom: 'Studio Marseille', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_m', etabId: 'e_m', type: 'immo', statut: 'ouvert',
      libelle: 'Studio Marseille', cash: [],
      lignes: [{ id: 'l_m', classe: 'immobilier', libelle: 'Studio Marseille',
                 valeur: 120000, prixDeRevient: 100000 }] });

    Store.state.budget.income.push({ label: 'Loyer Studio Marseille', amount: 650, bienId: 'c_m' });
    Store.state.budget.fixedCharges.push({ label: 'Taxe foncière', amount: 1200,
      period: 'an', provider: '', shares: {}, creditId: null, bienId: 'c_m' });

    const cf = cashFlowBien(compteById('c_m'));
    vrai(cf, 'le bien a un cash-flow');
    eq(round2(cf.loyers), 650, 'le loyer est ramené au mois');
    eq(round2(cf.charges), 100, '1 200 € par an font 100 € par mois');
    /* La regle cardinale : le cash-flow egale la somme de ses parts. */
    eq(round2(cf.loyers - cf.charges), 550,
      'le cash-flow est le loyer moins les charges, sans rien d’autre');

    /* Et le rattachement ne double pas le budget : la meme somme ne doit pas
       compter deux fois parce qu'elle est aussi rangee sous un bien. */
    const avant = Store.state.budget.income.reduce((s, r) => s + num(r.amount), 0);
    eq(round2(avant), round2(Store.state.budget.income
      .reduce((s, r) => s + num(r.amount), 0)),
      'le loyer entre une fois dans les revenus');
  });

  test('la période d’une charge de bien part sur l’année', () => {
    /* Une taxe fonciere se paie une fois l'an, une copropriete par trimestre :
       c'est ce qu'on lit sur l'avis, et le budget ramene au mois tout seul.
       Proposer « mois » par defaut ferait saisir 1 200 la ou il faut 100. */
    Fixture.poser();
    const src = lireSource('assets/app.js');
    const charge = src.slice(src.indexOf("async 'ajouter-charge-bien'"),
                             src.indexOf("async 'ajouter-credit'"));
    vrai(charge.length > 200, 'l’action doit être trouvable');
    /* Elle se derive du premier poste propose au lieu d'etre ecrite ici : la
       table dit deja qu'une taxe fonciere se paie a l'annee, et le redire en dur
       laisserait les deux diverger. */
    vrai(/cle: 'period'[\s\S]{0,160}?valeur: proposes\[0\]\[1\]/.test(charge),
      'la période vient du premier poste proposé');
    eq(chargesProposees(compteById('c_immo'))[0][1], 'an',
      'et ce premier poste, la taxe foncière, se facture à l’année');
    vrai(/options: CHARGE_PERIODES/.test(charge),
      'et les autres restent offertes, dérivées de la même table qu’ailleurs');

    /* La conversion au mois vient de la fonction commune, pas d'un calcul refait
       ici : deux facons de ramener au mois finiraient par diverger. */
    eq(round2(chargeMensuelle({ amount: 1200, period: 'an' })), 100);
    eq(round2(chargeMensuelle({ amount: 300, period: 'trimestre' })), 100);
  });
});

/* ------------------------------------------------------------------
   Un bien de valeur compte partout ou l'argent compte

   Une montre ajoutee doit augmenter le patrimoine net et apparaitre dans
   Allocation. patrimoine() la compte, son brut se derivant de toutes les
   classes. Mais un nowByGroup() qui sommerait cinq poches ecrites a la main,
   sans `biens`, laisserait tout ce qui lit nowTotals() (pied de barre,
   allocation, courbe d'evolution, projection) l'ignorer. Deux bruts dans
   l'application, un seul juste, aucun ecran pour le dire.
   ------------------------------------------------------------------ */
suite('Un bien de valeur compte partout', () => {

  const MONTRE = 10000;
  const avecMontre = () => Fixture.poser(e => {
    e.comptes.push({ id: 'c_montre', etabId: null, type: 'bienValeur',
      statut: 'ouvert', libelle: 'Montre', ouvertLe: '', numero: '', notes: '',
      cash: [],
      lignes: [{ id: 'l_montre', classe: 'bienValeur', libelle: 'Montre',
                 valeur: MONTRE, prixDeRevient: 9000, dateAcquisition: '',
                 estimeLe: '2026-08-01' }] });
  });

  test('le brut des écrans est celui du modèle, montre comprise', () => {
    avecMontre();
    eq(nowTotals().brut, Fixture.BRUT + MONTRE,
      'nowTotals() doit porter le même brut que patrimoine()');
    eq(nowTotals().net, Fixture.BRUT + MONTRE - Fixture.DETTE,
      'et le net qui va avec : c’est lui qui s’affiche au pied de la barre');
  });

  test('la somme des poches d’écran fait le brut, quelle que soit la classe', () => {
    /* C'est l'assertion qui manquait : elle echoue d'elle-meme le jour ou une
       classe entre dans CLASSES_ACTIFS sans sa poche d'ecran. */
    avecMontre();
    pres(Object.values(nowByGroup()).reduce((s, v) => s + v, 0), patrimoine().brut,
      'une poche écrite à la main a déjà oublié les biens de valeur');
  });

  test('la photo du jour et l’historique portent la sixième poche', () => {
    avecMontre();
    const auj = historySeries().at(-1);
    eq(auj.biens, MONTRE, 'le point « Auj. » de la courbe trace la montre');
    pres(auj.total, patrimoine().brut, 'et son total reste la somme des bandes');

    Store.state.monthly.push({ date: '2026-02-28', comment: '',
      v: { c_montre: 9000 } });
    const g = rowGroups(Store.state.monthly.at(-1));
    eq(g.biens, 9000, 'un relevé passé range la montre dans sa poche');
    pres(rowTotal(Store.state.monthly.at(-1)), 9000,
      'et le total du relevé se dérive des poches, il ne les recopie pas');
  });

  test('la projection pose la montre à plat, et ses poches font le net', () => {
    /* Une montre ne capitalise pas : elle rejoint l'immobilier net dans la
       part plate. La faire fructifier au taux du non cote serait le mensonge
       que la projection refuse deja au compte courant. */
    avecMontre();
    const t = nowTotals();
    pres(partPlate(t), 120000 + MONTRE - Fixture.DETTE,
      'la part plate porte l’immobilier et la montre, nets du crédit');
    const po = pochesProjection(t);
    pres(po.placees + po.plat, t.net,
      'aucun euro ne se perd ni ne se dédouble en changeant de poche');
  });

  test('le graphique d’évolution connaît chaque poche d’écran', () => {
    /* Derive : chaque cle de nowByGroup() doit figurer dans POCHES_EVOLUTION,
       sinon la pile cesse de faire le total — sans erreur, sans ecran pour le
       dire. Le controle couvre la poche de demain.

       Il lisait la source d'app.js a la regex, faute de pouvoir charger le
       fichier. La liste vit desormais dans store.js, que le harnais charge :
       c'est la vraie valeur qu'on interroge. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    Fixture.poser();
    /* Chaque poche a sa bande, sans exception. Le capital garanti en a été
       privé un temps, replié dans la bourse au motif que le passé ne se découpe
       pas par classe : le motif était bon, la conclusion fausse. Les obligations
       SONT des actifs de marché, donc les fondre dans cette bande dit vrai ; un
       fonds euros n'en est pas un, et un patrimoine entièrement en fonds euros
       s'affichait à 100 % d'actifs de marché. Une étiquette juste sur un début
       tardif vaut mieux qu'une étiquette fausse sur toute la courbe. */
    for (const cle of Object.keys(nowByGroup())) {
      vrai(POCHES_EVOLUTION.includes(cle),
        `la poche « ${cle} » n’est pas dans POCHES_EVOLUTION`);
      vrai(new RegExp(`key: '${cle}'`).test(src),
        `la poche « ${cle} » n’a pas de bande dans SERIES_PATRIMOINE`);
    }
    eq(POCHES_EVOLUTION.length, Object.keys(nowByGroup()).length,
      'et aucune bande de plus : une poche que le patrimoine ne connaît pas '
      + 'tracerait une bande vide sous une entrée de légende');
    /* La cascade des dettes du tracé net visite CHAQUE bande, du moins liquide
       au plus liquide : une poche oubliée là, et la dette cesse d'être
       entièrement retranchée dès qu'elle dépasse les poches visitées. Dérivée
       plutôt qu'écrite en dur, sinon la poche suivante manquera aussi — c'est
       exactement ce qui est arrivé au capital garanti.

       Les deux listes ne sont pas dans le même ordre, et ce n'est pas une
       négligence : on empile en partant du disponible, on rembourse en partant
       de ce qui se vend le plus mal. Ce sont les mêmes poches, jamais le même
       rang. */
    eq([...CASCADE_DETTES].sort().join(','), [...POCHES_EVOLUTION].sort().join(','),
      'la cascade des dettes et la pile doivent porter exactement les mêmes poches');
    vrai(CASCADE_DETTES.join(',') !== POCHES_EVOLUTION.join(','),
      'et pas dans le même ordre : la dette part du moins liquide');
  });

  test('la fenêtre du non coté ne liste que du non coté', () => {
    /* Elle listait tous les comptes du groupe d'ecran `pe` — immobilier et
       biens compris — sur un total qui ne compte que la classe nonCote : un
       studio a 120 000 EUR sous un titre « Placements non cotés », et un
       total plus petit que la somme de ses lignes. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('  pe: () => {'), src.indexOf('  investi: () =>'));
    vrai(bloc.length > 100, 'l’aperçu du non coté doit être trouvable');
    vrai(/l\.classe === 'nonCote'/.test(bloc),
      'les lignes se filtrent sur la classe du total, pas sur le groupe d’écran');
    vrai(!/groupe === 'pe'/.test(bloc),
      'le groupe d’écran rassemble aussi l’immobilier et les biens : il ment ici');
  });
});

finDePartieDeTests('tests/10-rappel-saisies-attend-son.tests.js');
