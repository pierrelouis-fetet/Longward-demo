partieDeTests('tests/07-application-s-adresse-toujours.tests.js');
/* ------------------------------------------------------------------
   L'application s'adresse toujours de la même façon
   ------------------------------------------------------------------ */
suite('L’application s’adresse toujours de la même façon', () => {

  /* Deux fautes de ton qui ne se voient qu'a l'ecran, cote a cote : un vouvoiement
     sous Comptes, et une phrase sans majuscule sous Allocation.

     Aucune des deux ne se voit en relisant le code : elles ne sautent aux yeux
     que cote a cote, a l'ecran, et rien ne met deux ecrans cote a cote. D'ou
     ces deux controles, qui derivent la liste au lieu de la recopier. */

  const blanc = m => m.replace(/[^\n]/g, ' ');
  const sansCommentaires = s => s
    .replace(/\/\*[\s\S]*?\*\//g, blanc)
    .replace(/^[ \t]*\/\/.*$/gm, blanc)
    .replace(/<!--[\s\S]*?-->/g, blanc);

  test('un sous-titre de vue commence par une majuscule', () => {
    /* Ils vivent tous dans la meme table, dans les deux langues : la liste se
       derive de `i18n.js` et ne peut donc pas oublier la vue ajoutee demain. */
    const src = sansCommentaires(lireSource('assets/i18n.js') || '');
    vrai(src, 'assets/i18n.js doit être lisible pour ce contrôle');

    const fautifs = [];
    for (const m of src.matchAll(/'(view\.[a-z.]*\.sub)':\s*(['"])([\s\S]*?)\2/g)) {
      const premiere = m[3].trim().charAt(0);
      /* `toLocaleUpperCase` et non une comparaison a A-Z : « Écart » et « Où »
         commencent par une lettre accentuee, qui est bien une majuscule. */
      if (premiere && premiere !== premiere.toLocaleUpperCase('fr'))
        fautifs.push(`${m[1]} = « ${m[3].slice(0, 40)} »`);
    }
    eq(fautifs.length, 0,
      'sous-titre en minuscule : ' + fautifs.join(' ; ')
      + ' — il s’affiche seul sous le titre de la page, viewSub() ne le colle à rien');
  });

  test('le texte affiché tutoie, bulles d’aide comprises', () => {
    /* L'application tutoie partout, bulles d'aide comprises.

       Une regle a deux regimes -- vouvoiement dans les bulles, tutoiement
       ailleurs -- rend le defaut invisible, puisque chaque exemplaire peut se
       reclamer d'une moitie de la regle. Un seul regime, et plus de zone ou le
       vouvoiement soit permis, donc plus de zone ou il puisse revenir sans
       qu'on le voie. */
    const fautifs = [];
    for (const f of ['assets/app.js', 'assets/store.js', 'assets/i18n.js']) {
      const src = sansCommentaires(lireSource(f) || '');
      vrai(src, f + ' doit être lisible pour ce contrôle');
      /* « votres » manquait a la liste, et c'est une phrase de la demonstration
         qui l'a montre : « sans toucher aux votres ». Le mot suivant s'ajoute
         ici quand il se presente, comme le veut la regle de la maison. */
      for (const m of src.matchAll(/\b(vous|vos|votre|v\u00f4tre|v\u00f4tres|Vous|Vos|Votre|V\u00f4tre|V\u00f4tres)\b/g))
        fautifs.push(`${f}:${src.slice(0, m.index).split('\n').length} (${m[1]})`);
    }
    eq(fautifs.length, 0,
      'vouvoiement dans le texte affiché : ' + fautifs.join(', ')
      + ' — l’application tutoie partout, bulles d’aide comprises');
  });

  test('un crédit s’appelle un crédit sur tous les boutons qui en créent un', () => {
    /* Un seul mot pour un seul objet. Deux boutons Pret et deux boutons Credit,
       sous une section Financement, creeraient le meme objet -- le meme
       `ajouter-credit` ecrivant dans `etab.dettes` -- et poseraient une question
       legitime : quelle difference ?

       Credit nomme l'objet, Financement reste le titre de la section sur la
       fiche d'un bien. Le titre dit le sujet, le bouton dit l'objet.

       La liste se derive des boutons : celui qu'on ajoutera demain est couvert
       sans que personne ait a y penser. */
    const src = sansCommentaires(lireSource('assets/app.js') || '');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    const fautifs = [];
    for (const m of src.matchAll(/data-action="ajouter-credit"/g)) {
      const fin = src.indexOf('</button>', m.index);
      if (fin < 0) continue;
      const libelle = src.slice(m.index, fin);
      if (/[Pp]rêt/.test(libelle))
        fautifs.push('ligne ' + src.slice(0, m.index).split('\n').length);
    }
    eq(fautifs.length, 0,
      'un bouton qui crée un crédit l’appelle « prêt » (' + fautifs.join(', ')
      + ') : deux mots pour le même objet, et plus personne ne sait s’il y a une différence');
  });
});

/* ------------------------------------------------------------------
   Un champ qui se répète propose ce qu'on y a déjà mis
   ------------------------------------------------------------------ */
suite('Un champ qui se répète propose ce qu’on y a déjà mis', () => {

  /* Trois champs libres se retapaient a chaque fois : le preteur d'un credit,
     l'organisme d'une charge fixe, la source d'un revenu. Deux orthographes du
     meme nom ne se regroupent jamais, et personne ne s'en apercoit — ce sont
     des champs qu'on relit rarement.

     Les valeurs se derivent des donnees. Une table tenue a la main aurait vieilli
     des le premier organisme ajoute, et c'est exactement le defaut que ce projet
     rencontre le plus souvent : deux listes pour une seule verite. */

  test('les valeurs proposées sortent des données, dédoublonnées et triées', () => {
    Fixture.poser(e => {
      e.budget.fixedCharges = [
        { label: 'Assurance', amount: 40, period: 'mois', provider: 'MAIF' },
        { label: 'Habitation', amount: 20, period: 'mois', provider: 'maif' },
        { label: 'Électricité', amount: 90, period: 'mois', provider: 'Engie' },
        { label: 'Sans organisme', amount: 10, period: 'mois', provider: '' },
      ];
    });
    const v = valeursConnues('organisme');
    eq(v.length, 2, 'deux organismes distincts, la casse ne fait pas un doublon');
    /* La derniere ecriture rencontree gagne.
       Peu importe laquelle : ce qui compte est qu'il n'y en ait qu'une, et que
       la regle soit la meme dans tout le fichier. */
    eq(v.join('|'), 'Engie|maif', 'triés, une seule écriture par organisme');
  });

  test('un prêteur connu peut être l’établissement lui-même', () => {
    /* Quand la banque qui prete est celle qui tient le compte, son nom est deja
       dans l'application : le retaper serait absurde. */
    Fixture.poser(e => {
      e.etabs = [{ id: 'e1', nom: 'Banque', dettes: [{ id: 'd1', preteur: 'Un prêteur', montant: 100 }] }];
    });
    const v = valeursConnues('preteur');
    vrai(v.includes('Un prêteur'), 'le prêteur déjà saisi est proposé');
    vrai(v.includes('Banque'), 'et le nom de l’établissement aussi');
  });

  test('un champ sans valeur connue ne propose rien', () => {
    /* Une liste vide ne doit pas produire un `datalist` vide : la vue teste la
       longueur, et un `list=` qui pointe sur rien vaut mieux absent. */
    Fixture.poser(e => { e.budget.income = []; });
    eq(valeursConnues('source').length, 0, 'aucune source connue');
    eq(valeursConnues('champ-inexistant').length, 0, 'et une clé inconnue ne lève pas');
  });

  test('la fenêtre ne pose une liste que s’il y a quelque chose à proposer', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const debut = src.indexOf('function askForm');
    const fin = src.indexOf('\nfunction ', debut + 1);
    const fn = src.slice(debut, fin > 0 ? fin : debut + 6000);
    vrai(/\(c\.suggestions \|\| \[\]\)\.length/.test(fn),
      'le datalist ne doit exister que si des valeurs sont proposées');
    vrai(/<datalist id="\$\{dl\}">/.test(fn),
      'et la liste doit être posée par la fenêtre elle-même, pas par chaque appelant');
  });
});

/* ------------------------------------------------------------------
   Un indice de ligne peut valoir zéro
   ------------------------------------------------------------------ */
suite('Un indice de ligne peut valoir zéro', () => {

  /* Le montant d'un placement non cote se modifie depuis sa ligne, y compris
     quand c'est la premiere de son compte.

     `lignesDe()` pose `ref: i`, l'indice de la ligne dans son compte. Rendre le
     nom cliquable sous condition `(editable && !l.marche && l.ref)` serait une
     verite booleenne sur un indice : zero est faux, donc la PREMIERE ligne de
     chaque compte ne serait pas cliquable, et un compte non cote qui n'en porte
     qu'une n'aurait aucun chemin d'edition -- ni son montant, ni son echeance,
     ni son intitule.

     Rien ne se verrait : la ligne s'affiche normalement, elle ne repondrait
     simplement pas au clic. C'est le genre de defaut qu'aucune relecture
     n'attrape et qu'un test de presence attrape tout de suite. */

  test('la première ligne d’un compte porte bien l’indice 0', () => {
    /* Le fait du modele, sans lequel la regle de vue ci-dessous n'aurait pas
       de raison d'etre. */
    Fixture.poser(e => {
      e.comptes = [{ id: 'pe1', type: 'pe', libelle: 'Non coté', lignes: [
        { libelle: 'Part A', valeur: 1000, classe: 'noncote' },
        { libelle: 'Part B', valeur: 500, classe: 'noncote' },
      ] }];
    });
    const lignes = lignesDe(Store.state.comptes[0]);
    eq(lignes.length, 2, 'les deux lignes remontent');
    eq(lignes[0].ref, 0, 'la première porte l’indice 0');
    eq(lignes[1].ref, 1, 'la seconde l’indice 1');
    vrai(!lignes[0].ref, 'et 0 est faux en vérité booléenne : c’est tout le piège');
  });

  test('la vue teste l’existence de l’indice, pas sa vérité', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const debut = src.indexOf('function lignePlacement');
    vrai(debut > 0, 'lignePlacement doit être trouvable');
    /* Jusqu'a la fonction suivante, pas un nombre de caracteres : une borne en
       dur se fait depasser des qu'on ajoute un commentaire, et le test passe
       alors au vert en ne regardant rien. C'est arrive en ecrivant celui-ci. */
    const fin = src.indexOf('\nfunction ', debut + 1);
    const fn = src.slice(debut, fin > 0 ? fin : debut + 4000);
    vrai(fn.includes('editer-placement'), 'la découpe doit contenir le corps de la fonction');

    vrai(/l\.ref != null/.test(fn),
      'le nom doit devenir un bouton dès que l’indice existe, y compris 0');
    vrai(!/&&\s*l\.ref\s*\)/.test(fn),
      'un indice testé en vérité booléenne rendrait la première ligne de chaque '
      + 'compte non modifiable, sans que rien ne se voie à l’écran');
  });
});

/* ------------------------------------------------------------------
   Retirer une catégorie n'efface rien
   ------------------------------------------------------------------ */
suite('Retirer une catégorie n’efface rien', () => {

  /* Retirer une categorie d'un mois ne supprime pas l'historique des mois
     precedents.

     `removeExpenseCategory` efface les montants de tous les mois. Il reste,
     parce qu'une colonne creee par erreur doit pouvoir partir en entier.
     Retirer est l'autre geste, et le piege est evident une fois nomme : treize
     endroits parcourent `expenseCategories()` pour sommer, dont
     `expenseRowTotal`. Filtrer cette liste ferait baisser des totaux passes en
     silence.

     Le premier test est donc le seul qui compte vraiment : retirer ne change
     aucun chiffre. */

  const troisMois = e => {
    e.budget.categories = ['Courses', 'Sport', 'Transports'];
    e.budget.retirees = [];
    e.budget.expenses = [
      { month: '2026-01-01', v: { Courses: 400, Sport: 60, Transports: 40 }, note: '' },
      { month: '2026-02-01', v: { Courses: 500, Sport: 60 }, note: '' },
      { month: '2026-03-01', v: { Courses: 300, Transports: 90 }, note: '' },
    ];
  };

  test('retirer ne change aucun total, ni du mois ni de la catégorie', () => {
    Fixture.poser(troisMois);
    const avant = Store.state.budget.expenses.map(expenseRowTotal);
    const totalSport = expenseCategoryTotal('Sport');
    pres(avant[0], 500, 'janvier vaut bien la somme de ses trois postes');
    pres(totalSport, 120, 'Sport a reçu 120 € en tout');

    vrai(retirerCategorie('Sport'), 'le retrait doit être accepté');

    const apres = Store.state.budget.expenses.map(expenseRowTotal);
    for (let i = 0; i < avant.length; i++)
      pres(apres[i], avant[i], `le total du mois ${i + 1} ne bouge pas d’un centime`);
    pres(expenseCategoryTotal('Sport'), totalSport,
      'et les montants de la catégorie retirée sont toujours là');
  });

  test('une catégorie retirée quitte la saisie et rien d’autre', () => {
    Fixture.poser(troisMois);
    retirerCategorie('Sport');
    vrai(expenseCategories().includes('Sport'),
      'elle reste dans la liste qui sert aux totaux, aux colonnes et aux exports');
    vrai(!categoriesSaisie().includes('Sport'),
      'et sort de ce qu’on propose de remplir ce mois-ci');
    vrai(categorieRetiree('Sport'), 'elle se déclare retirée');
    vrai(categoriesSaisie().includes('Courses'), 'les autres ne bougent pas');
  });

  test('reprendre défait exactement le retrait', () => {
    Fixture.poser(troisMois);
    const depart = categoriesSaisie().join('|');
    retirerCategorie('Sport');
    vrai(reprendreCategorie('Sport'), 'la reprise doit être acceptée');
    eq(categoriesSaisie().join('|'), depart,
      'la liste de saisie revient à l’identique, dans le même ordre');
    vrai(!categorieRetiree('Sport'), 'et la catégorie n’est plus retirée');
  });

  test('retirer deux fois ne fait rien de plus', () => {
    /* Les migrations et les gestes repetes doivent etre idempotents : un double
       clic ne doit pas inscrire deux fois le meme nom, sinon « Reprendre » ne
       l'enleverait qu'a moitie. */
    Fixture.poser(troisMois);
    retirerCategorie('Sport');
    vrai(!retirerCategorie('Sport'), 'le second retrait est refusé');
    eq(Store.state.budget.retirees.filter(c => c === 'Sport').length, 1,
      'le nom n’est inscrit qu’une fois');
    reprendreCategorie('Sport');
    vrai(!categorieRetiree('Sport'), 'et une seule reprise suffit à la rendre');
  });

  test('renommer une catégorie retirée garde le retrait sur le nouveau nom', () => {
    /* Sinon le nom d'avant resterait retire a vie, et le nouveau reviendrait
       dans la saisie sans qu'on l'ait demande. */
    Fixture.poser(troisMois);
    retirerCategorie('Sport');
    vrai(renameExpenseCategory('Sport', 'Salle de sport'), 'le renommage doit passer');
    vrai(categorieRetiree('Salle de sport'), 'le nouveau nom est retiré');
    vrai(!categorieRetiree('Sport'), 'et l’ancien ne l’est plus');
    pres(expenseCategoryTotal('Salle de sport'), 120, 'les montants ont suivi le nom');
  });

  test('supprimer une catégorie retirée la sort aussi des retirées', () => {
    /* Le defaut qu'on ne verrait qu'un mois plus tard : recreer une categorie
       du meme nom la ferait naitre deja retiree, absente de la saisie, sans que
       rien ne l'explique. */
    Fixture.poser(troisMois);
    retirerCategorie('Sport');
    removeExpenseCategory('Sport');
    vrai(!categorieRetiree('Sport'), 'le nom ne traîne plus dans les retirées');
    addExpenseCategory('Sport');
    vrai(categoriesSaisie().includes('Sport'),
      'une catégorie recréée sous le même nom revient dans la saisie');
  });

  test('un état sans liste de retirées se comporte comme une liste vide', () => {
    /* Aucune migration n'a ete ecrite pour ce champ : les etats existants n'ont
       pas `budget.retirees`, et c'est voulu — un champ absent doit se lire, pas
       se rattraper. */
    Fixture.poser(e => { troisMois(e); delete e.budget.retirees; });
    vrai(!categorieRetiree('Sport'), 'rien n’est retiré');
    eq(categoriesSaisie().length, expenseCategories().length,
      'et la saisie propose toutes les catégories');
    vrai(retirerCategorie('Sport'), 'le premier retrait crée la liste au passage');
    vrai(categorieRetiree('Sport'), 'et prend effet');
  });

  test('regrouper le mois en cours ne perd pas un centime', () => {
    /* La fenetre du mois garde les categories qui portent deja un montant : la
       regle protege les totaux passes, mais elle faisait afficher cinq cases a
       qui venait d'en demander une. Mesure sur la demonstration : 205 + 145 + 60
       + 35, cinq cases pour un reglage qui en promet une.

       Le mois qu'on saisit n'est pas de l'histoire : ses montants se somment sur
       la case qui reste. La propriete a garder est celle de la maison, un total
       egale la somme de ses parts -- avant comme apres. */
    const src = lireSource('assets/app.js');
    /* La borne de fin se cherche APRES le debut : « const fermer = v => »
       existe sept fois dans le fichier, et le premier vient bien avant. */
    const d = src.indexOf('async function regrouperCeMois()');
    const bloc = src.slice(d, src.indexOf('const fermer = v =>', d));
    vrai(bloc, 'la porte de la fenetre doit etre trouvable');
    /* Le geste lui-meme vit dans nePlusDetaillerPartout(), pour que les deux
       portes n'en aient qu'un. La fenetre ne fait que lui passer le mois ouvert
       et ce qui y est saisi. */
    vrai(bloc.includes('nePlusDetaillerPartout({ index, saisie: etat })'),
      'la fenetre delegue au geste commun, en lui passant le mois et la saisie');
    const geste = src.slice(src.indexOf('async function nePlusDetaillerPartout'),
                            src.indexOf('function remettreLeDetail'));
    vrai(geste.includes('saisie ? saisie.v :'),
      'le total se somme sur ce qui est SAISI quand la fenetre est ouverte');
    vrai(geste.includes('regrouperMois(ligne, garde)'),
      'et il s ecrit sur la seule case qui reste');
    vrai(geste.includes('Store.addBackup'),
      'une sauvegarde precede : c est le seul endroit du geste qui touche des montants');
    vrai(geste.includes('askConfirm'),
      'et il demande, parce que le decoupage de ce mois-la disparait');
    /* Les DEUX etats dans la fenetre : une fois replie, il faut pouvoir revenir. */
    vrai(src.includes('id="depRemettreDetail"'),
      'la fenetre offre le retour quand une seule case est proposee');
    vrai(src.includes('id="depSansDetail"'),
      'et le geste aller quand elles sont detaillees');
    vrai(src.includes('${sansDistinction()'),
      'les deux etats se decident sur sansDistinction(), pas sur un drapeau');
  });

  test('aucun réglage d’affichage ne double le choix de saisie', () => {
    /* Un commutateur « Synthetique | Detaille » a vecu en tete de page, avec sa
       preference dans `meta`. C'etait un second systeme pour une question deja
       tranchee : l'ecran pouvait proposer de detailler ce que la saisie ne
       detaillait plus, et rien ne garantissait que les deux s'accordent. Deux
       portes sur un meme champ sont saines, deux champs pour la meme valeur ne
       le sont pas.

       Il ne reste donc qu'un etat, `sansDistinction()`, lu par la saisie comme
       par l'affichage. */
    const src = lireSource('assets/app.js');
    const store = lireSource('assets/store.js');
    const dico = lireSource('assets/i18n.js');
    for (const mort of ['budgetDetail', 'budgetSynthese', 'BUDGET_DETAIL',
                        'budget-detail', 'pliCats', 'pliDetailMois']) {
      vrai(!src.includes(mort), `« ${mort} » n’a plus rien à faire dans app.js`);
    }
    /* store.js ne le mentionne que dans le commentaire qui dit pourquoi il n'y
       est plus : on interdit la declaration, pas le souvenir. */
    vrai(!/const BUDGET_DETAIL|function budgetDetail/.test(store),
      'ni de définition dans store.js');
    for (const clef of ['"Synthétique"', '"Détaillé"', '"Afficher les catégories"',
                        '"Afficher le détail par catégorie"']) {
      vrai(!dico.includes(clef), `la clef ${clef} est morte avec le commutateur`);
    }

    /* Les commandes de categories restent dans la carte du detail : elles
       agissent sur les categories, pas sur la page. */
    const carte = src.slice(src.indexOf('data-anchor="detail-mensuel"'));
    const rangee = carte.slice(carte.indexOf('<div class="row"'),
                               carte.indexOf('${(() => {'));
    for (const action of ['sans-distinction', 'add-category']) {
      vrai(rangee.includes(action),
        `« ${action} » appartient à la rangée des commandes de catégories`);
    }
    /* « + Ouvrir l'annee suivante » n'y est plus, et son action non plus : une
       annee apparait quand des donnees existent, pas parce qu'on a appuye.
       Douze lignes vides precreees n'etaient pas une annee ouverte, c'etaient
       douze mois a zero euro dans le tableau et dans le store. */
    /* Commentaires retires : celui qui dit pourquoi l'action n'est plus la
       nomme forcement, comme celui de « add-month » a cote. */
    vrai(!src.replace(/\/\*[\s\S]*?\*\//g, '').includes('add-expense-month'),
      'ni le bouton qui ouvrait douze mois vides, ni son action');
    vrai(!(lireSource('assets/i18n.js') || '').includes('Ouvrir l’année suivante'),
      'et sa clef de traduction est partie avec');
  });

  test('ne plus détailler ne laisse qu’une case, et n’efface rien', () => {
    Fixture.poser(troisMois);
    const totaux = Store.state.budget.expenses.map(expenseRowTotal);
    const listeAvant = expenseCategories().join('|');

    const garde = neePlusDetailler();
    vrai(garde, 'le geste doit rendre la case qui reste');
    eq(categoriesSaisie().length, 1, 'une seule case reste à remplir');
    eq(categoriesSaisie()[0], garde, 'et c’est celle qu’il annonce');
    vrai(sansDistinction(), 'l’état se lit sur la liste, sans drapeau');

    /* Le point qui compte : c'est la saisie qui se restreint, jamais l'histoire. */
    Store.state.budget.expenses.forEach((r, i) =>
      pres(expenseRowTotal(r), totaux[i], `le total du mois ${i + 1} ne bouge pas`));
    pres(expenseCategoryTotal('Sport'), 120, 'les montants passés sont intacts');
    vrai(expenseCategories().join('|').startsWith(listeAvant),
      'et aucune catégorie ne disparaît de la liste qui sert aux totaux');
  });

  test('le fourre-tout naît dans la langue en vigueur, et se reconnaît dans les deux', () => {
    /* La cle « Tout confondu » vivait dans le dictionnaire sans que personne ne
       la traverse : le nom partait tel quel dans les donnees, donc un lecteur
       anglophone recevait une categorie francaise.

       Le nom ne se traduit pas a l'affichage -- c'est une donnee, elle part dans
       les cles de `v` et dans les exports, et la traduire renommerait une colonne
       au changement de langue. C'est a la creation que la langue compte. */
    vrai(NOMS_TOUT().includes(CATEGORIE_TOUT),
      'la graphie française reste reconnue, quelle que soit la langue');
    const src = lireSource('assets/store.js');
    vrai(/addExpenseCategory\(nom\)/.test(src) && /const nom = trad\(CATEGORIE_TOUT\)/.test(src),
      'la catégorie se crée avec le nom traduit, pas avec la constante');
    vrai(/expenseCategories\(\)\.find\(c => NOMS_TOUT\(\)\.includes\(c\)\)/.test(src),
      'et les deux graphies sont reconnues : sinon changer de langue créerait une seconde case');
  });

  test('le fourre-tout n’est pas « Autres »', () => {
    /* Les deux mots se ressemblent et ne disent pas la meme chose. Autres est
       le reste, ce qui n'entrait pas ailleurs, et il porte deja des montants
       chez qui detaille ses depenses. Y verser tout ferait une serie qui change
       de sens au milieu de son historique, sans que rien ne le signale. */
    Fixture.poser(e => {
      troisMois(e);
      e.budget.categories = ['Courses', 'Autres'];
      e.budget.expenses = [{ month: '2026-01-01', v: { Courses: 400, Autres: 50 }, note: '' }];
    });
    const garde = neePlusDetailler();
    vrai(garde !== 'Autres',
      '« Autres » est le reste, pas le tout : le fourre-tout doit porter un autre nom');
    pres(expenseCategoryTotal('Autres'), 50, 'et ses 50 € restent les siens');
  });

  test('le geste est idempotent, et ne crée pas deux fourre-tout', () => {
    /* Un double clic ne doit pas laisser deux cases du meme nom : la regle des
       migrations vaut pour les actes repetables. */
    Fixture.poser(troisMois);
    const a = neePlusDetailler();
    const listeA = expenseCategories().join('|');
    const b = neePlusDetailler();
    eq(b, a, 'le second appel garde la même case');
    eq(expenseCategories().join('|'), listeA, 'et n’ajoute aucune catégorie');
    eq(categoriesSaisie().length, 1, 'il en reste toujours exactement une');
  });

  test('une seule catégorie déjà proposée est celle qu’on garde', () => {
    /* Sinon le geste creerait un fourre-tout a cote de la case unique, et en
       laisserait deux la ou l'on en demandait une. */
    Fixture.poser(e => {
      troisMois(e);
      /* La liste se pose ici, et non par `retirerCategorie` : la callback
         travaille sur le brouillon, l'etat n'est installe qu'apres. */
      e.budget.retirees = ['Sport', 'Transports'];
    });
    eq(categoriesSaisie().length, 1, 'la fixture part bien d’une seule case');
    eq(neePlusDetailler(), 'Courses', 'c’est elle qu’on garde, telle quelle');
    vrai(!expenseCategories().includes(CATEGORIE_TOUT),
      'et aucun fourre-tout n’est créé pour rien');
  });

  test('le decoupage d un mois regroupe se garde, et se rend', () => {
    /* « Ne plus detailler » sommait les montants du mois sur une seule case, et
       revenir rendait les categories sans les montants : tout restait sur la
       case unique. Ctrl+Z les rendait, mais il defait aussi tout le reste, et
       personne n'y pense. */
    Fixture.poser(s => {
      s.budget.categories = ['Courses', 'Restos', 'Transports'];
      s.budget.expenses = [{ month: '2026-01', note: '',
                             v: { Courses: 205, Restos: 145, Transports: 35 } }];
    });
    const ligne = Store.state.budget.expenses[0];
    const garde = neePlusDetailler();
    const total = regrouperMois(ligne, garde);
    pres(total, 385, 'le total du mois ne bouge pas d un centime');
    eq(Object.keys(ligne.v).length, 1, 'une seule case reste');
    pres(ligne.v[garde], 385, 'et elle porte la somme');
    vrai(ligne.avantRegroupement, 'le decoupage d avant est garde');
    pres(ligne.avantRegroupement.total, 385, 'avec le total qu il faisait');

    const fait = reprendreLeDetail();
    eq(fait.mois, 1, 'le retour rend le decoupage d un mois');
    pres(ligne.v.Courses, 205, 'Courses revient a son montant');
    pres(ligne.v.Restos, 145, 'Restos aussi');
    pres(ligne.v.Transports, 35, 'et Transports');
    eq(ligne.avantRegroupement, undefined, 'la memoire s efface : elle a servi');
  });

  test('une case modifiee depuis refuse la memoire, et le montant reste', () => {
    /* La condition du retour est le total. Remettre un decoupage qui ne fait
       plus le total afficherait un mois different de celui qu'on a saisi, et le
       total cesserait d egaler la somme de ses parts. */
    Fixture.poser(s => {
      s.budget.categories = ['Courses', 'Restos'];
      s.budget.expenses = [{ month: '2026-01', note: '', v: { Tout: 500 },
                             avantRegroupement: { v: { Courses: 300, Restos: 145 }, total: 445 } }];
    });
    const ligne = Store.state.budget.expenses[0];
    eq(defaireRegroupement(ligne), false, 'la memoire est refusee');
    pres(ligne.v.Tout, 500, 'le montant saisi depuis reste intact');
    eq(ligne.avantRegroupement, undefined,
      'et la memoire s efface : elle ne decrit plus ce mois');
  });

  test('regrouper une seule case ne garde rien : il n y a rien a defaire', () => {
    Fixture.poser(s => {
      s.budget.categories = ['Courses'];
      s.budget.expenses = [{ month: '2026-01', note: '', v: { Courses: 205 } }];
    });
    const ligne = Store.state.budget.expenses[0];
    regrouperMois(ligne, neePlusDetailler());
    eq(ligne.avantRegroupement, undefined,
      'un seul montant regroupe ne perd aucun decoupage');
  });

  test('reprendre le détail remet tout, et le dit', () => {
    /* Il remet AUSSI ce qui avait ete retire a la main avant : l'application ne
       sait pas les distinguer, et retenir un avant demanderait un second etat
       qui se contredirait au premier retrait suivant. C'est assume, le libelle
       du bouton le dit, et rien n'est perdu — re-retirer coute un clic. */
    Fixture.poser(troisMois);
    neePlusDetailler();
    const fait = reprendreLeDetail();
    vrai(fait.categories >= 2,
      `au moins deux catégories reviennent, obtenu ${fait.categories}`);
    eq(categoriesSaisie().length, expenseCategories().length,
      'plus rien n’est retiré');
    vrai(!sansDistinction(), 'et l’état se relit à l’envers, toujours sans drapeau');
  });
});

/* ------------------------------------------------------------------
   Ce qu'on règle une fois ne reste pas ouvert
   ------------------------------------------------------------------ */
suite('Ce qu’on règle une fois ne reste pas ouvert', () => {

  /* La frequence commande la forme. Le nom d'un etablissement, d'un compte et
     son type s'ecrivent en grand avec un petit bouton Modifier, pas dans un
     champ qui reste ouvert : on ne les touche qu'une fois.

     Un champ qu'on revient corriger chaque mois -- le montant des liquidites,
     une note -- reste en saisie directe, parce qu'un bouton de plus a chaque
     fois serait un geste de plus a chaque fois. Un champ qu'on regle a la
     creation et qu'on ne rouvre jamais passe derriere Modifier : ouvert, il
     donne a une page de consultation l'allure d'un formulaire.

     Ces controles gardent la liste des chemins interdits dans la fiche. Ils
     sont textuels -- le harnais ne rend pas de page -- mais ils portent sur le
     seul endroit ou ces champs pourraient revenir. */

  const ficheCompte = () => {
    const s = lireSource('assets/app.js') || '';
    return s.slice(s.indexOf('function viewFicheCompte'), s.indexOf('function viewFicheEtab'));
  };

  test('aucun champ d’identité n’est ouvert dans la fiche d’un compte', () => {
    const fiche = ficheCompte();
    vrai(fiche.length > 1000, 'la fiche de compte doit être trouvable');
    for (const cle of ['libelle', 'numero', 'ouvertLe', 'plafond']) {
      vrai(!new RegExp('data-path="comptes\\.\\$\\{idx\\}\\.' + cle + '"').test(fiche),
        `le champ « ${cle} » est resté en saisie directe dans la fiche : il se règle `
        + 'une fois, il doit passer derrière « Modifier »');
    }
    vrai(!/data-action-change="changer-type-compte"/.test(fiche),
      'le type de compte est resté un menu ouvert dans la fiche');
    vrai(/data-action="modifier-compte"/.test(fiche),
      'la fiche doit porter le bouton « Modifier » qui ouvre ces champs');
  });

  test('la note reste en saisie directe', () => {
    /* Le complement, et il compte autant : passer les notes derriere le bouton
       aurait ete « plus coherent » et faux. Une note s'ecrit au moment ou l'on
       y pense, souvent parce qu'on vient de penser a quelque chose. */
    const fiche = ficheCompte();
    vrai(/data-path="comptes\.\$\{idx\}\.notes"/.test(fiche),
      'la note doit rester en saisie directe : elle s’ajoute à n’importe quel moment');
  });

  test('le nom d’un établissement s’affiche ailleurs que dans son champ', () => {
    /* Le defaut trouve en appliquant la regle : sur cette page, le titre de la
       barre du haut dit « Comptes ». Le seul endroit ou le nom de
       l'etablissement se lisait etait donc l'interieur de son champ de saisie.
       Retirer le champ sans poser le nom aurait fait disparaitre de la page le
       nom de ce dont elle parle. */
    const s = lireSource('assets/app.js') || '';
    const fiche = s.slice(s.indexOf('function viewFicheEtab'),
                          s.indexOf('function viewFicheEtab') + 3000);
    vrai(fiche.length > 500, 'la fiche d’établissement doit être trouvable');
    vrai(!/data-path="etabs\.\$\{idx\}\.nom"/.test(fiche),
      'le nom de l’établissement est resté un champ ouvert');
    vrai(/class="fiche-nom"/.test(fiche),
      'le nom doit être affiché en titre, sinon la page ne dit plus de quoi elle parle');
    vrai(/data-action="modifier-etab"/.test(fiche),
      'la fiche doit porter le bouton « Modifier »');
  });

  test('la fiche d’un établissement porte la teinte de son groupe', () => {
    /* Le code couleur reste en haut de la fiche. Le point qui compte n'est pas
       qu'il y ait une couleur, c'est que ce soit la meme : elle vient de
       teinteDominante(), la fonction qui colore deja le groupe dans la liste.
       Une seconde facon de la calculer donnerait deux couleurs pour un seul
       etablissement, sans que rien ne dise laquelle a raison. */
    const s = lireSource('assets/app.js') || '';
    const fiche = s.slice(s.indexOf('function viewFicheEtab'),
                          s.indexOf('function viewFicheEtab') + 3000);
    vrai(/--teinte:\$\{teinteEtab\(e\)\}/.test(fiche),
      'la fiche doit tirer sa teinte de teinteEtab(), la même source que la liste');
    vrai(/class="cpt-pastille"/.test(fiche),
      'et l’afficher avec la pastille de la liste, pas une autre forme');
  });
});

/* ------------------------------------------------------------------
   La police des titres ne descend pas sur les chiffres
   ------------------------------------------------------------------ */
suite('La police des titres ne descend pas sur les chiffres', () => {

  /* Manrope habille les titres et le logotype, jamais un montant.

     La raison n'est pas esthetique. Toute la feuille repose sur
     `tabular-nums` pour que les colonnes de montants s'alignent, et beaucoup
     de polices d'affichage n'embarquent pas de chiffres tabulaires : la
     largeur d'un total changerait alors a chaque frappe, sous les yeux de
     celui qui le saisit. Un chiffre qui danse pendant qu'on l'ecrit se lit
     comme une erreur.

     Ces controles sont textuels — le harnais ne rend aucune page. Ils
     attrapent le geste qui casse la regle, pas son effet a l'ecran. */

  const cssBrut = () => lireSource('assets/styles.css');
  /* Sans les commentaires : celui de l'@font-face cite `--font-titre` en
     prose, et compterait pour une declaration. */
  const cssNu = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const blocFontFace = s => (cssNu(s).match(/@font-face\s*\{[\s\S]*?\}/) || [])[0];

  test('la police d’affichage ne s’applique qu’aux titres et au logotype', () => {
    const css = cssBrut();
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');

    /* Une regle par bloc : ce qui precede le `{` est le selecteur. */
    const usages = cssNu(css).split('}').filter(b => b.includes('var(--font-titre)'));
    eq(usages.length, 1,
      `var(--font-titre) est posée à ${usages.length} endroits : elle doit l’être `
      + 'une seule fois, sinon personne ne peut dire ce qui porte la police');

    const parts = usages[0].split('{')[0]
      .split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).sort();
    eq(parts.join(' | '), '.brand-text strong | .lancement-marque span | h1 | h2 | h3',
      'la police des titres a débordé de sa cible : ' + parts.join(', ')
      + ' — un sélecteur de montant lui ferait perdre ses chiffres tabulaires');
  });

  test('le nom de l’application s’écrit partout dans la même police', () => {
    /* Le mot-marque est ecrit a deux endroits : l'ecran de lancement, une
       seconde, et la barre laterale, en permanence. La premiere version de
       cette regle n'avait pris que le premier — celui qu'on ne voit
       pratiquement jamais — et « Longward » s'affichait en deux polices selon
       l'ecran. Ce controle part du balisage : il trouve ou le nom est ecrit,
       et exige que chaque endroit soit couvert. */
    const idx = (lireSource('index.html') || '').replace(/<!--[\s\S]*?-->/g, ' ');
    vrai(idx, 'index.html doit être lisible pour ce contrôle');

    const porteurs = [...idx.matchAll(/<(span|strong|b)\b[^>]*>\s*Longward\s*<\/\1>/g)];
    vrai(porteurs.length >= 2,
      `le nom devrait être écrit à au moins deux endroits, ${porteurs.length} trouvé(s) : `
      + 'si le balisage a changé, ce contrôle ne prouve plus rien');

    const css = cssBrut();
    const regle = cssNu(css).split('}').find(b => b.includes('var(--font-titre)')) || '';
    const cibles = regle.split('{')[0];
    /* Chaque porteur du nom doit tomber sous un selecteur de la regle : soit
       par son element (`strong`, `span` seuls ne suffisent pas), soit par la
       classe de son conteneur, qu'on retrouve dans le selecteur. */
    for (const p of porteurs) {
      const avant = idx.slice(0, p.index);
      const conteneur = (avant.match(/class="([^"]*)"(?![\s\S]*class=")/) || [])[1] || '';
      const couvert = conteneur.split(/\s+/).filter(Boolean)
        .some(c => cibles.includes('.' + c));
      vrai(couvert,
        `« Longward » écrit dans « ${conteneur || '(sans classe)'} » n’est visé par aucun `
        + 'sélecteur de la police des titres : le nom s’afficherait en deux polices '
        + 'selon l’écran');
    }
  });

  test('les montants gardent la police du système', () => {
    const css = cssBrut();
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const corps = cssNu(css).split('}').find(b => b.split('{')[0].trim() === 'body');
    vrai(corps, 'la règle « body » doit exister');
    vrai(corps.includes('font-family: var(--font);'),
      'body ne déclare plus var(--font) : les montants suivraient la police des titres');
    vrai(corps.includes('tabular-nums'),
      'body ne déclare plus tabular-nums : les colonnes de montants cesseraient de s’aligner');
  });

  test('aucun titre n’affiche de montant', () => {
    /* Le controle qui protege la decision, et non son application. Tant
       qu'aucun `h` ne porte de montant, poser une police d'affichage dessus
       est sans danger. Le jour ou un titre afficherait un total, il faudrait
       soit l'en sortir, soit verifier que Manrope porte bien `tnum`.

       Les commentaires sont remplaces par des espaces de meme longueur, sauts
       de ligne conserves : sinon le numero signale ne designe aucune ligne
       reelle du fichier. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const blanc = m => m.replace(/[^\n]/g, ' ');
    const nu = src.replace(/\/\*[\s\S]*?\*\//g, blanc).replace(/<!--[\s\S]*?-->/g, blanc);

    /* `aide(...)` rend un `<span data-aide="…">?</span>` : son texte part dans
       un attribut, jamais dans le titre rendu. Un montant cite dans une bulle
       d'explication est de la prose, il ne s'aligne en colonne nulle part —
       la premiere version de ce test signalait « Allocation par classe » pour
       cette raison, a tort.

       Le comptage de parentheses suppose que la prose d'aide les equilibre,
       ce qu'elle fait partout ici. Une parenthese orpheline dans un texte
       d'aide ferait signaler son titre a tort : le message dit ou regarder. */
    const sansAide = s => {
      let sortie = '', i = 0;
      for (;;) {
        const j = s.indexOf('aide(', i);
        if (j < 0) return sortie + s.slice(i);
        if (j > 0 && /[A-Za-z0-9_$]/.test(s[j - 1])) { sortie += s.slice(i, j + 5); i = j + 5; continue; }
        sortie += s.slice(i, j);
        let k = j + 5, prof = 1;
        while (k < s.length && prof > 0) {
          if (s[k] === '(') prof++;
          else if (s[k] === ')') prof--;
          k++;
        }
        i = k;
      }
    };

    const fautifs = [];
    for (const m of nu.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g))
      if (/fmtCur|fmtEUR|fmtCurEur|fmtPct|fmtSigned|fmtNombre/.test(sansAide(m[2])))
        fautifs.push('ligne ' + nu.slice(0, m.index).split('\n').length);
    eq(fautifs.length, 0,
      'un titre porte un montant formaté (' + fautifs.join(', ') + ') : il hérite '
      + 'de Manrope, dont rien ne garantit les chiffres tabulaires');
  });

  test('le préchargement et la feuille désignent le même fichier', () => {
    /* Deux URL qui different d'un octet — une balise `?v=` posee d'un cote
       seulement — font telecharger la police deux fois : le prechargement ne
       sert alors a rien, et il coute une requete. Rien ne le signale, sinon
       l'onglet reseau. */
    const css = cssBrut(), idx = lireSource('index.html');
    vrai(css && idx, 'styles.css et index.html doivent être lisibles');

    const face = blocFontFace(css);
    vrai(face, 'la déclaration @font-face doit exister dans styles.css');
    const u = face.match(/url\(([^)]+)\)/);
    vrai(u, 'l’@font-face doit porter une url()');
    const fichier = u[1].replace(/['"]/g, '').trim();

    const p = idx.replace(/<!--[\s\S]*?-->/g, ' ').match(/<link[^>]+rel="preload"[^>]*>/);
    vrai(p, 'index.html doit précharger la police des titres');
    const href = (p[0].match(/href="([^"]+)"/) || [])[1];

    eq(href, 'assets/' + fichier,
      `le préchargement vise ${href} quand la feuille charge ${fichier} : `
      + 'la police serait téléchargée deux fois');
    vrai(!href.includes('?'),
      'aucune balise de version sur la police : l’url() de la feuille n’en porte pas, '
      + 'et les deux doivent coïncider');
    vrai(/crossorigin/.test(p[0]),
      '« crossorigin » manque au préchargement : une police se récupère en mode CORS, '
      + 'et sans l’attribut le fichier est téléchargé une seconde fois');
    vrai(/as="font"/.test(p[0]),
      '« as="font" » manque : sans lui le navigateur ne sait pas quoi prioriser');
  });

  test('le fichier de police est bien servi', () => {
    /* Une url() qui ne resout pas ne leve rien : le titre retombe sur la
       police du systeme et tout a l'air normal. C'est exactement le genre de
       panne qu'un oeil ne voit pas. */
    const brut = lireSource('assets/manrope-latin.woff2');
    vrai(brut, 'assets/manrope-latin.woff2 doit être servi : sans lui les titres '
      + 'retombent en silence sur la police du système');
    eq(brut.slice(0, 4), 'wOF2',
      'le fichier ne commence pas par la signature woff2 : ce n’est pas une police');
  });

  test('le sous-ensemble latin couvre le français et l’euro', () => {
    /* Un sous-ensemble mal choisi ne casse rien de visible non plus : les
       accents tombent simplement sur la police du systeme, et « Repartition »
       s'affiche en deux polices dans le meme mot. */
    const face = blocFontFace(cssBrut() || '');
    vrai(face, 'la déclaration @font-face doit exister dans styles.css');
    for (const plage of ['U+0000-00FF', 'U+2000-206F', 'U+20AC'])
      vrai(face.includes(plage),
        `l’unicode-range doit porter ${plage}, sinon un titre mêle deux polices `
        + '(accents, apostrophe typographique, euro)');
  });
});

/* ------------------------------------------------------------------
   Un courtier qui prête sur marge
   ------------------------------------------------------------------ */
suite('Un courtier qui prête sur marge', () => {

  /* Un levier de courtier se saisit comme un credit sur l'etablissement, comme
     un pret immobilier. Les titres achetes avec cet argent restent comptes en
     entier -- on les possede -- et le montant prete se retranche du patrimoine
     net, une seule fois.

     Ce que ces controles interdisent : que la marge change la valeur des avoirs,
     qu'elle soit deduite une fois par compte au lieu d'une fois par credit, ou
     qu'elle vienne se ranger parmi les enveloppes. Le levier est une dette, pas
     une enveloppe, et `byAccountType()` le dit en ecartant les comptes de role
     `margin` ; ce test le tient. */
  const MARGE = 3000;
  const surMarge = e => {
    const courtier = e.etabs.find(x => x.id === 'e_courtier');
    courtier.dettes = [{ id: 'd_marge', libelle: 'Marge', montant: MARGE,
                         taux: 5.8, mensualite: null, note: '' }];
  };

  test('la marge ne change pas ce que valent les avoirs', () => {
    Fixture.poser(surMarge);
    pres(patrimoine().brut, Fixture.BRUT,
      'les titres achetés à crédit restent comptés en entier : on les possède');
    pres(nowTotals().invested + nowTotals().cash, Fixture.BRUT,
      'et les parts refont toujours le brut');
  });

  test('elle se retranche du net, une seule fois', () => {
    Fixture.poser(surMarge);
    /* L'établissement « Courtier » tient deux comptes, le PEA et le CTO : c'est
       le cas qui ferait compter la dette deux fois si elle était attribuée aux
       comptes plutôt qu'à l'établissement. */
    const chez = Store.state.comptes.filter(c => c.etabId === 'e_courtier');
    eq(chez.length, 2, 'le courtier tient bien deux comptes dans le fixture');
    pres(dettesTotal(), Fixture.DETTE + MARGE, 'le prêt du studio et la marge');
    pres(patrimoine().net, Fixture.BRUT - Fixture.DETTE - MARGE,
      'net = avoirs − crédits, la marge comptée une fois');
  });

  test('elle ne devient pas une enveloppe', () => {
    /* L'invariant se compare a lui-meme plutot qu'a un montant ecrit en dur :
       la repartition par enveloppe doit etre identique avec et sans la marge.
       Epingler un montant reviendrait a epingler la base de la carte, et le
       test tomberait le jour ou cette base change, alors que la regle qu'il
       defend, elle, n'a pas bouge d'un centime. */
    Fixture.poser();
    const sansMarge = byAccountType().reduce((s, x) => s + x.value, 0);
    Fixture.poser(surMarge);
    const avecMarge = byAccountType().reduce((s, x) => s + x.value, 0);
    pres(avecMarge, sansMarge,
      'une dette de levier ne change rien à la répartition par enveloppe');
    vrai(!byAccountType().some(x => /levier|marge/i.test(x.label)),
      'et n’y apparaît sous aucun nom');
    pres(groupesParEnveloppe().reduce((s, g) => s + g.total, 0), patrimoine().brut,
      'et les groupes de la page Comptes somment toujours les avoirs');
  });

  test('l’effet de levier se lit sur les capitaux propres', () => {
    /* Le chiffre que la fiche du compte affiche : ce qu'on contrôle rapporté à
       ce qui est vraiment à soi. Il vit dans la vue, mais son arithmétique doit
       être dite une fois quelque part, sinon personne ne saura si « 195 % » est
       la bonne façon de le dire. */
    Fixture.poser(surMarge);
    const cto = Store.state.comptes.find(c => c.id === 'c_cto');
    const valeur = valeurCompte(cto);          // 750 d’or
    const propre = valeur - MARGE;
    vrai(propre < 0, 'ici la marge dépasse ce que le compte porte : pas de levier à afficher');
    const pea = Store.state.comptes.find(c => c.id === 'c_pea');
    const v = valeurCompte(pea);               // 1 500 de cash + 9 000 d’ETF
    pres(v, 10500, 'le PEA du fixture vaut 10 500 €');
    pres(v / (v - MARGE) * 100, 140,
      '10 500 € contrôlés pour 7 500 € à soi : 140 % de tes capitaux propres');
  });
});

/* ------------------------------------------------------------------
   Les paliers d'autonomie
   ------------------------------------------------------------------ */
suite('Les paliers d’autonomie couvrent tout, dans le bon ordre', () => {

  /* La jauge du coussin et le palier Disponible tout de suite comptent les
     especes de la meme facon. Une liste de deux types ecrite a la main --
     courant ou livret -- laisserait les especes dehors : des billets dans un
     portefeuille tomberaient derriere un virement bancaire, en quelques jours,
     et les deux chiffres differeraient exactement des especes.
     `mobilisabilite()` lit donc le groupe du type de compte, qui dit deja que
     c'est du cash. */

  test('la jauge plus les projets font le disponible immédiat', () => {
    /* Une marche plus loin : la jauge et Disponible tout de suite peuvent differer
       exactement de l'argent reserve a un projet, et l'ecran doit dire
       pourquoi.

       Les deux chiffres sont justes. La jauge est le coussin -- precaution plus
       cash disponible, ce que la regle des 3 a 6 mois vise -- et le palier est
       tout le cash immediatement mobilisable, projets compris : cet argent
       existe, on y toucherait avant de manquer.

       L'addition est donc ecrite sur la carte, et ce controle la verifie :
       coussin + projets = disponible tout de suite. Une troisieme affectation
       qui arriverait dans immediat sans rejoindre l'un des deux ferait echouer
       ce test, ce qui est le but. */
    Fixture.poser(e => {
      e.comptes = [{ id: 'c_b', type: 'courant', libelle: 'Compte', cash: [
        { montant: 3000, affectation: 'courant' },
        { montant: 500, affectation: 'precaution' },
        { montant: 2020, affectation: 'projet' },
      ] }];
    });
    const p = poches(), r = runway();
    pres(p.projet, 2020, 'l’argent du projet est bien rangé');
    pres(p.precaution + p.courant, 3500, 'le coussin ne compte pas le projet');
    pres(r.immediate, 5520, 'le palier immédiat, lui, porte tout le cash mobilisable');
    pres(p.precaution + p.courant + p.projet, r.immediate,
      'coussin + projets = disponible tout de suite : les deux montants de la '
      + 'carte doivent s’additionner, sinon l’écart reste inexpliqué');

    /* Et le palier le dit. La note nommait les contenants — comptes courants,
       livrets, especes — sans dire ce qui y est deja promis : quelqu'un qui
       vient de lire « + 2 020 EUR reserves a un projet » les cherchait ici sans
       les trouver. Les deux lignes se laissaient rapprocher sans se rejoindre. */
    vrai(/projets/i.test(r.tiers[0].note),
      'le palier immédiat doit dire qu’il comprend les projets');
  });

  test('sans projet, la note n’en parle pas', () => {
    /* Une note qui parle de projets a quelqu'un qui n'en a pas est du bruit :
       elle nomme une poche vide et fait chercher un montant qui n'existe pas. */
    Fixture.poser(e => {
      e.comptes = [{ id: 'c_b', type: 'courant', libelle: 'Compte', cash: [
        { montant: 3000, affectation: 'courant' },
      ] }];
    });
    vrai(!/projets/i.test(runway().tiers[0].note),
      'aucune mention de projets quand il n’y en a aucun');
  });

  test('des billets sont disponibles tout de suite', () => {
    eq(mobilisabilite('liquidites', 'especes'), 'immediat',
      'des espèces ne peuvent pas être moins disponibles qu’un virement');
    eq(mobilisabilite('liquidites', 'courant'), 'immediat');
    eq(mobilisabilite('liquidites', 'livret'), 'immediat');
    /* Le cash posé chez un courtier garde son délai : son compte est du groupe
       bourse, l'argent doit d'abord être viré. */
    eq(mobilisabilite('liquidites', 'pea'), 'differe');
    eq(mobilisabilite('liquidites', 'cto'), 'differe');
  });

  test('le groupe du type décide, pas une liste recopiée', () => {
    /* Ce qui protège du prochain type de compte de cash : la règle se lit dans
       TYPES_COMPTE, elle ne se réécrit pas ici.

       Une seule exception, et elle est devant : le PER est fermé jusqu'à la
       retraite, y compris pour le cash qui y dort. Ce n'est pas une question de
       délai de virement, c'est une question de droit d'y toucher. */
    for (const t of TYPES_COMPTE) {
      /* Un type peut déclarer sa disponibilité (PER fermé, enveloppes de
         retraite américaines lentes) ; sinon le groupe décide. Le test lit la
         même propriété que le code, il ne recopie plus un identifiant. */
      const attendu = t.disponibilite || (t.groupe === 'cash' ? 'immediat' : 'differe');
      eq(mobilisabilite('liquidites', t.id), attendu,
        `${t.label} : liquidités ${attendu}`);
    }
  });

  test('les quatre paliers font le patrimoine brut', () => {
    Fixture.poser();
    const p = poches();
    const m = p.mobilisable;
    pres(m.immediat + m.differe + m.lent + m.bloque, patrimoine().brut,
      'chaque euro tombe dans un palier, et dans un seul');
    /* Le fixture, palier par palier : 3 000 de courant + 2 000 de livret font
       l'immédiat ; le cash du PEA et les titres font le différé ; le studio et
       le crowdfunding sont lents ; rien n'est bloqué. */
    pres(m.immediat, 5000, 'courant + livret');
    pres(m.differe, Fixture.CASH_A_INVESTIR + 9750, 'cash du PEA + ETF + or');
    pres(m.lent, 122000, 'studio + crowdfunding');
    pres(m.bloque, 0, 'aucun PER dans le fixture');
  });

  test('les espèces montent d’un palier sans changer le total', () => {
    /* Le contrôle qui aurait attrapé le bug : poser des espèces et vérifier
       qu'elles sont dans l'immédiat, le total ne bougeant pas. */
    const avant = Fixture.poser().comptes.length;
    poserEspeces(Store.state);
    refreshAccounts();
    const especes = Store.state.comptes.find(c => c.type === 'especes');
    vrai(especes, 'poserEspeces() a bien posé le compte');
    especes.cash = [{ montant: 650, affectation: 'courant' }];
    const p = poches();
    pres(p.mobilisable.immediat, 5650, 'les 650 € de billets sont dans l’immédiat');
    pres(p.mobilisable.immediat + p.mobilisable.differe + p.mobilisable.lent
       + p.mobilisable.bloque, patrimoine().brut, 'et le total suit');
    vrai(Store.state.comptes.length >= avant, 'aucun compte perdu au passage');
  });

  test('le cumul des paliers laisse l’inaccessible dehors', () => {
    Fixture.poser(e => {
      /* Un PER : de l'argent qui n'arrivera pas, quoi qu'il se passe demain. */
      e.comptes.push({ id: 'c_per', etabId: 'e_courtier', type: 'per', statut: 'ouvert',
        ouvertLe: '2022-01-01', numero: '', notes: '', libelle: 'PER', court: 'PER',
        alloc: '', cash: [], lignes: [{ id: 'l_per', classe: 'actions', libelle: 'Fonds',
          valeur: 8000, prixDeRevient: 8000, quantite: 1, dateAcquisition: '' }] });
    });
    const r = runway();
    const cumules = r.tiers.filter(t => !t.horsCumul);
    const hors = r.tiers.filter(t => t.horsCumul);
    pres(hors.reduce((s, t) => s + t.value, 0), 8000, 'le PER est hors cumul');
    pres(cumules[cumules.length - 1].cumulative,
      cumules.reduce((s, t) => s + t.value, 0),
      'le dernier cumul vaut la somme des paliers cumulables');
    pres(cumules.reduce((s, t) => s + t.value, 0) + 8000, patrimoine().brut,
      'cumulables + hors cumul = patrimoine brut');
    for (const t of hors) eq(t.months, null, 'un palier hors cumul n’annonce pas de mois');
  });
});

/* ------------------------------------------------------------------
   Les deux axes de la page Cible
   ------------------------------------------------------------------ */
suite('Les deux axes de la page Cible ne se mélangent pas', () => {

  /* Le classeur Excel les mélangeait dans une feuille : « Actions core » et
     « Actions satellite » voisinaient avec « Métaux précieux », puis deux lignes
     d'agrégat fermaient le tableau — « Cash à investir » et « Placé en bourse »,
     cette dernière valant la somme des précédentes. Dans un tableur, une ligne de
     somme posée au milieu de ses membres passe dans les filtres et les
     graphiques comme si elle était une part.

     Ce que ces contrôles tiennent : chaque axe somme sa base, la base est la
     même pour les deux — sinon les deux feuilles ne se recouperaient pas — et
     l'agrégat reste identifiable comme tel. */

  test('les classes somment la base, sans ligne d’agrégat', () => {
    Fixture.poser();
    const r = rebalanceRows();
    const membres = [...r.classes, ...(r.cash ? [r.cash] : [])];
    pres(membres.reduce((s, x) => s + x.value, 0), r.base,
      'les classes et la trésorerie font la base des cibles');
    pres(membres.reduce((s, x) => s + x.pct, 0), 100, 'et leurs parts font 100 %');
    /* `invested` est un sous-total : la base moins la trésorerie. Il a sa place
       en synthèse, pas dans la liste des membres. */
    pres(r.invested.value, r.base - (r.cash ? r.cash.value : 0),
      'l’agrégat vaut la base moins la trésorerie');
    vrai(!r.classes.some(c => c.label === r.invested.label),
      'et il ne figure pas parmi les classes');
  });

  test('les rôles somment la même base', () => {
    Fixture.poser();
    const rr = rebalanceRoles();
    pres(rr.base, rebalanceRows().base,
      'une seule base pour les deux axes, sinon les deux feuilles ne se recoupent pas');
    pres(rr.roles.reduce((s, x) => s + x.value, 0), rr.base, 'socle + satellites + trésorerie');
    pres(rr.roles.reduce((s, x) => s + x.pct, 0), 100, 'et leurs parts font 100 %');
    /* Le fixture : 9 000 d’ETF au socle, 750 d’or en satellite, 1 500 à investir. */
    const val = cle => rr.roles.find(x => x.cle === cle).value;
    pres(val('core'), 9000, 'le MSCI World est au socle');
    pres(val('satellite'), 750, 'l’or est en satellite');
    pres(val('cashToInvest'), Fixture.CASH_A_INVESTIR, 'et le cash du PEA attend');
  });

  test('la composition d’un rôle fait le montant du rôle', () => {
    Fixture.poser();
    const rr = rebalanceRoles();
    for (const cle of ['core', 'satellite']) {
      const parts = rr.composition[cle] || [];
      const role = rr.roles.find(x => x.cle === cle);
      pres(parts.reduce((s, x) => s + x.value, 0), role.value,
        `la composition du ${role.label.toLowerCase()} fait son montant`);
    }
  });

  test('le partage par classe recoupe les rôles', () => {
    /* `parClasse` sert la colonne qui dit, dans une classe, quelle part est du
       socle. Sa somme doit valoir le socle plus les satellites, la tresorerie
       exceptee : elle n'a pas de role. */
    Fixture.poser();
    const rr = rebalanceRoles();
    const somme = rr.parClasse.reduce((s, x) => s + x.total, 0);
    const roles = rr.roles.filter(x => x.cle !== 'cashToInvest')
      .reduce((s, x) => s + x.value, 0);
    pres(somme, roles, 'le détail par classe couvre exactement les deux rôles');
  });
});

/* ------------------------------------------------------------------
   La tête de l'onglet Charges fixes
   ------------------------------------------------------------------ */
suite('Ce qui sort chaque mois', () => {

  /* Trois chiffres nouveaux s'affichent au-dessus du tableau des charges : le
     total mensuel, le même sur douze mois, et ce qui reste vraiment à ta charge.
     Les deux derniers dérivent du premier, et c'est justement ce qu'il faut
     tenir : un total annuel qui ne vaudrait pas douze fois le mensuel, ou une
     part personnelle qui ne complèterait pas la part partagée, mentiraient sans
     que rien ne se voie. */

  const CHARGES = e => {
    e.budget.contributors = [{ id: 'p1', name: 'Colocataire' }];
    e.budget.fixedCharges = [
      { label: 'Loyer', amount: 900, period: 'mois', shares: { p1: 450 } },
      { label: 'Assurance', amount: 120, period: 'an' },
      { label: 'Abonnement', amount: 30, period: 'mois' },
    ];
  };

  test('une charge annuelle se ramène au mois', () => {
    Fixture.poser(CHARGES);
    pres(chargeMensuelle({ amount: 120, period: 'an' }), 10, '120 € par an font 10 € par mois');
    pres(chargeMensuelle({ amount: 30, period: 'mois' }), 30, 'un mensuel ne bouge pas');
    /* 940, et non 490 : les 900 EUR de loyer sortent du compte en entier, meme
       si le colocataire en reverse la moitie. Ce versement-la est une ENTREE, et
       le retrancher ici en plus le compterait deux fois. */
    pres(fixedTotal(), 940, '900 de loyer + 10 d’assurance + 30 d’abonnement');
  });

  test('le total sur douze mois vaut douze fois le mois', () => {
    Fixture.poser(CHARGES);
    /* Le chiffre affiché est `f.fixed * 12`. Il doit valoir la somme des charges
       ramenées à l'année, sinon l'annuel et le mensuel de la même carte se
       contrediraient. */
    pres(budgetFrame().fixed * 12, 940 * 12, '11 280 € par an');
    pres(budgetFrame().fixed, fixedTotal(), 'et le cadre du budget lit le même total');
  });

  test('la liste des postes somme le total affiché', () => {
    /* La carte ne montre que les six plus gros postes et annonce « et N autres ».
       La somme de tous les postes, elle, doit valoir le total en gros
       caractères — c'est ce que la mention promet. */
    Fixture.poser(CHARGES);
    const postes = Store.state.budget.fixedCharges
      .map(c => chargeMensuelle(c)).filter(v => v > 0);
    pres(postes.reduce((s, v) => s + v, 0), budgetFrame().fixed,
      'aucun poste hors du total, aucun compté deux fois');
    eq(postes.length, 3, 'trois postes dans ce jeu d’essai');
  });
});

/* ------------------------------------------------------------------
   Les crédits en cours
   ------------------------------------------------------------------ */
/* E3 : un tableau de bord PERSONNEL compte ce qui sort vraiment du compte. */
suite('Créer un bien ne laisse plus passer une réponse sans suite', () => {

  const app = () => lireSource('assets/app.js');
  /* La borne est du CODE : la fenetre de creation se lit entre son ouverture et
     le premier champ, et la banniere de commentaire disparait sur l'arbre
     publie. */
  const regle = () => { const s = app(); const i = s.indexOf('valide: v => {');
    return s.slice(i, s.indexOf('champs: placementTiers ? champsTiers : bien ? [', i)); };

  test('répondre oui au crédit exige un capital restant dû', () => {
    /* LE DEFAUT. La dette n'etait posee que si le capital restant etait positif :
       repondre « oui », laisser le champ vide et saisir une mensualite creait un
       bien SANS credit, en silence, et le patrimoine net naissait faux. Une
       reponse qui n'a pas de suite est pire qu'une question qu'on n'a pas posee. */
    const r = regle();
    vrai(r.length > 200, 'la règle doit être trouvable');
    vrai(/if \(v\.aCredit === 'oui' && !\(num\(v\.credit\) > 0\)\)/.test(r),
      'vide, zéro et négatif sont refusés ensemble');
    vrai(/cle: 'credit'/.test(r), 'et le curseur revient sur le champ');
    vrai(/Le capital restant dû doit être supérieur à 0 si tu déclares avoir encore un crédit\./.test(r),
      'avec un message qui dit pourquoi');
    vrai(I18N.en['Le capital restant dû doit être supérieur à 0 si tu déclares avoir encore un crédit.'],
      'et il a sa traduction');
  });

  test('aucun montant négatif n’est enregistré, et aucun n’est ramené à zéro', () => {
    /* Une valeur qu'on ne sait pas lire se refuse ; elle ne se remplace pas.

       Les six montants du BIEN se controlent ici. Les cinq du CREDIT sont partis
       dans `validerCreditSaisi`, la regle que partagent les trois portes qui
       saisissent un credit : la meme chaine recopiee a trois endroits finit par
       diverger, et deux d'entre elles ne controlaient rien. */
    const r = regle();
    for (const cle of ['valeur', 'prixAchat', 'fraisAcquisition', 'travauxInitiaux',
                       'apport', 'revient']) {
      vrai(r.includes(`'${cle}'`), `« ${cle} » est contrôlé`);
    }
    vrai(/estDeclare\(v\[cle\]\) && num\(v\[cle\]\) < 0/.test(r),
      'le contrôle porte sur le déclaré, et sur le signe');
    vrai(/validerCreditSaisi\(v, \{ montant: 'credit' \}\)/.test(r),
      'et les cinq champs du crédit passent par la règle centrale');
    for (const cle of ['credit', 'initial', 'mensualite', 'taux', 'tauxAssurance']) {
      const f = validerCreditSaisi({ [cle]: -1 }, { montant: 'credit' });
      vrai(f && f.cle === cle, `« ${cle} » à −1 doit être refusé, et désigné`);
    }
    vrai(!/Math\.max\(0/.test(r) && !/\|\| 0/.test(r),
      'rien n’est corrigé en douce');
  });

  test('le zéro explicite reste une réponse', () => {
    /* Des frais nuls, des travaux nuls, un apport nul, un taux a zero : autant
       de reponses justes. Seul le capital emprunte a zero avec une dette qui
       reste decrit un pret impossible. */
    vrai(/validerCreditSaisi\(/.test(regle()),
      'le zéro du crédit se juge dans la règle centrale');
    const f = validerCreditSaisi({ credit: 120000, initial: 0 }, { montant: 'credit' });
    vrai(f && f.cle === 'initial',
      'le seul zéro refusé est celui du capital emprunté avec une dette');
    eq(validerCreditSaisi({ credit: 120000, initial: 150000, mensualite: 0,
                            taux: 0, tauxAssurance: 0 }, { montant: 'credit' }), null,
      'une mensualité, un taux et une assurance à zéro restent des réponses');
    eq(estDeclare(0), true, 'zéro est déclaré');
    eq(estDeclare(''), false, 'le vide ne l’est pas');
  });

  test('la quote-part se déclare à la création, et passe par la même porte', () => {
    const s = app();
    vrai(/cle: 'part', label: trad\('Ta part \(%\)'\)/.test(s), 'le champ existe');
    vrai(/exemple: '100'/.test(s), 'avec cent pour repère');
    vrai(/if \(!partEstValide\(v\.part\)\)/.test(s),
      'et la validation réutilise la porte de la fiche, jamais une seconde');
    vrai(/\.\.\.\(estDeclare\(e3\.part\) \? \{ part: num\(e3\.part\) \} : \{\}\)/.test(s),
      'vide ne s’écrit pas, déclaré s’écrit tel quel');
  });

  test('la quote-part écrite agit tout de suite, et ne déborde sur rien', () => {
    Fixture.poser(e => {
      const c = e.comptes.find(x => x.id === 'c_immo');
      for (const l of c.lignes) { l.usage = 'locative'; l.valeur = 400000; l.part = 50; }
      const d = e.etabs.find(x => x.id === 'e_bien').dettes[0];
      d.montant = 120000; d.mensualite = 800;
      e.budget.income = [{ label: 'Loyer', amount: 1000, period: 'mois', bienId: 'c_immo' }];
      e.budget.fixedCharges = [{ label: 'Taxe foncière', amount: 300, period: 'mois',
                                 bienId: 'c_immo' }];
    });
    const l = lignesDe(compteById('c_immo'))[0];
    pres(l.valeurEntiere, 400000, 'la valeur saisie est celle du bien entier');
    pres(l.valeur, 200000, 'et le patrimoine n’en compte que la moitié');
    pres(dettesTotal(), 120000, 'la dette n’est jamais divisée');
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.loyers, 1000, 'ni le loyer');
    pres(cf.charges, 300, 'ni les charges');
    pres(cf.mensualite, 800, 'ni la mensualité');
  });

  test('une part de zéro s’écrit, une part hors bornes se refuse', () => {
    eq(partDetention({ part: 0 }), 0, 'zéro pour cent est une réponse');
    eq(partDetention({ part: 100 }), 1, 'cent aussi');
    pres(partDetention({ part: 50 }), 0.5, 'et cinquante vaut la moitié');
    eq(partDetention({}), 1, 'absente, elle vaut le tout');
    eq(partEstValide(-1), false, 'négative, elle se refuse');
    eq(partEstValide(150), false, 'au-delà de cent aussi');
    eq(partDetention({ part: 150 }), null, 'et 150 ne devient jamais 100');
  });

  test('la valeur se dit du bien entier, la dette personnelle', () => {
    const s = app();
    vrai(/Sa valeur totale aujourd’hui\. Si tu n’en détiens qu’une part, renseigne ta quote-part séparément\./.test(s),
      'l’aide de la valeur dit qu’elle est entière');
    vrai(/Ce que tu dois encore personnellement aujourd’hui\. Cette dette se déduit de ton patrimoine net\./.test(s),
      'celle du capital restant dû dit qu’elle est personnelle');
    vrai(/Le capital emprunté à ta charge au départ, facultatif\./.test(s),
      'et celle du capital emprunté aussi');
  });

  test('la mensualité se saisit facturée, avant tout partage', () => {
    const s = app();
    vrai(/label: trad\('Mensualité facturée \({dev}\)'\)/.test(s), 'le mot le dit');
    vrai(/Assurance incluse\. Elle sera ajoutée aux charges fixes ; tu pourras ensuite indiquer la part payée par quelqu’un d’autre\./.test(s),
      'et l’aide dit ce qui vient après');
    /* Le modele ne bouge pas : la charge nait avec le montant facture et des
       parts vides. */
    const store = lireSource('assets/store.js');
    vrai(/amount: num\(d\.mensualite\), period: 'mois',/.test(store),
      'la charge du crédit porte le montant facturé');
    vrai(/shares: \{\}, creditId: d\.id,/.test(store), 'et des parts vides');
  });

  test('le sous-titre ne parle plus de plus-value', () => {
    const s = app();
    vrai(/la valeur actuelle se compare au coût d’acquisition/.test(s), 'le mot est sobre');
    vrai(!/la plus-value se calcule sur ces deux montants/.test(s), 'l’ancien est parti');
    vrai(!I18N.en['la plus-value se calcule sur ces deux montants'], 'sa clef aussi');
  });

  test('un loyer se saisit, il ne reste pas à zéro', () => {
    const s = app();
    const f = s.slice(s.indexOf("async 'ajouter-loyer'(btn)"),
                      s.indexOf("async 'ajouter-charge-bien'(btn)"));
    vrai(f.length > 400, 'la fenêtre doit être trouvable');
    vrai(/valide: v => num\(v\.amount\) > 0 \? null/.test(f),
      'vide, zéro et négatif sont refusés ensemble');
    vrai(/Le loyer mensuel doit être supérieur à 0\./.test(f), 'le message le dit');
    vrai(/cle: 'amount', label: trad\('Montant mensuel \({dev}\)'\), type: 'nombre',\s*\n\s*requis: true/.test(f),
      'et le champ est requis');
    vrai(/que tu perçois personnellement/.test(f),
      'la convention du loyer personnel est écrite');
  });

  test('la transition n’a plus qu’une porte, et elle suit le geste', () => {
    /* La fiche porte un select qui ecrit l'usage par `data-path` : changer un
       bien en residence principale par ce chemin-la ne posait pas la question de
       l'ancien loyer, alors que le petit atelier la posait. Deux chemins pour un
       meme fait metier, et un seul tenait la promesse. */
    const s = app();
    const f = s.slice(s.indexOf("async 'enregistrer-fiche'(btn)"),
                      s.indexOf("async 'choisir-usage'(btn)"));
    vrai(f.length > 400, 'l’action doit être trouvable');
    vrai(/const devientPrincipale = \(\(\) => \{/.test(f), 'la transition se décide sur l’état d’avant');
    vrai(/compteDeLInstantane\(ficheAvant, c\.id\)/.test(f), 'lu dans l’instantané de la fiche');
    vrai(/usageBien\(avant\) !== 'principale'/.test(f),
      'et rien ne se repose à qui réenregistre le même choix');
    vrai(/if \(devientPrincipale\) await proposerTransitionLoyer\(\);/.test(f),
      'la question vient après');
    const iSave = f.indexOf('Store.save();'), iAppel = f.indexOf('await proposerTransitionLoyer()');
    vrai(iSave > 0 && iAppel > iSave, 'sur un état enregistré');
    vrai(f.indexOf("toast(trad('Enregistré ✓'))") < iAppel,
      'et après le toast, pour que celui de la transition reste le dernier');
    /* Rien n'est branche sur un champ ni sur un rendu. */
    /* Sur le CODE seul : le commentaire de l'action NOMME l'ecriture de champ
       pour dire qu'elle n'y touche pas, et le controle s'y accrocherait. */
    vrai(!/applyField/.test(f.replace(/\/\*[\s\S]*?\*\//g, ' ')),
      'aucun branchement sur l’écriture d’un champ');
    const applique = s.slice(s.indexOf('function applyField'), s.indexOf('(async function init()'));
    vrai(!/proposerTransitionLoyer/.test(applique), 'ni dans l’écriture elle-même');
  });

  test('le texte de la transition est vrai dans les deux cas', () => {
    /* « Tu viens d'ajouter » etait faux des qu'on changeait l'usage d'un bien
       qu'on avait deja depuis des annees. */
    const s = app();
    vrai(/Ce bien est maintenant ta résidence principale\. Ce loyer est toujours compté dans tes charges fixes\./.test(s),
      'le texte vaut à la création comme au changement d’usage');
    vrai(!/Tu viens d’ajouter une résidence principale/.test(s), 'l’ancien est parti');
    vrai(I18N.en['Ce bien est maintenant ta résidence principale. Ce loyer est toujours compté dans tes charges fixes.'],
      'et le nouveau a sa traduction');
  });

  test('le moteur E1 à E5 n’a pas été refait', () => {
    /* Cette passe ne touche qu'au parcours de saisie : le modele est intact. */
    Fixture.poser(e => {
      e.budget.contributors = [{ id: 'p1', name: 'Autre' }];
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
    eq(cf.fiscalite.source, 'inconnue', 'E1');
    vrai(chargesProposees(compteById('c_immo')).map(([x]) => x)
      .includes('Charges de copropriété non récupérables'), 'E2');
    pres(cf.charges, 300, 'les charges valent ce qui est débité');
    pres(cf.mensualite, 2000, 'la mensualité aussi');
    pres(fixedTotal(), 2300, 'le total des charges fixes');
    eq(loyersCourantsProbables().length, 0, 'E4');
    pres(cf.cashFlowAvantImpot, 900 - 300 - 2000, 'E5, la cascade');
    pres(coutBien(compteById('c_immo')).totalSorties, 2300, 'et le coût du bien');
  });
});

suite('La fiche d’un bien se lit dans l’ordre où l’argent sort', () => {

  const app = () => lireSource('assets/app.js');
  /* Les bornes sont du CODE : une banniere de commentaire disparait sur l'arbre
     publie, et la tranche courrait bien au-dela. */
  const bloc = (nom, fin) => { const s = app(); const i = s.indexOf(`function ${nom}(`);
    return s.slice(i, s.indexOf(`function ${fin}(`, i)); };

  const bien = ({ loyer = 900, charges = 150, mensualite = 500,
                  moisLoues = 12, fisc = null, usage = 'locative' } = {}) =>
    Fixture.poser(e => {
      const c = e.comptes.find(x => x.id === 'c_immo');
      for (const l of c.lignes) l.usage = usage;
      c.moisLoues = moisLoues;
      if (fisc !== null) c.fiscaliteEstimeeAnnuelle = fisc;
      const d = e.etabs.find(x => x.id === 'e_bien').dettes[0];
      d.montant = 120000; d.taux = 2; d.mensualite = mensualite || null;
      e.budget.income = loyer
        ? [{ label: 'Loyer', amount: loyer, period: 'mois', bienId: 'c_immo' }] : [];
      e.budget.fixedCharges = charges
        ? [{ label: 'Taxe foncière', amount: charges, period: 'mois', bienId: 'c_immo' }] : [];
    });

  /* --- la cascade ------------------------------------------------------- */

  test('la cascade suit l’ordre où l’argent sort', () => {
    /* Loyer, charges, credit, puis l'impot. La fiscalite se posait AVANT la
       mensualite : elle s'y lisait comme une charge du bien, alors qu'elle porte
       sur ce que le bien degage — et le sous-total qui la precede n'existait
       nulle part. */
    const f = bloc('lignesDuMois', 'ligneFiscalite');
    const iCharges = f.indexOf('ligneCharges(cf, -1)');
    const iMens = f.indexOf('ligneMensualite(cf, -1)');
    const iFisc = f.indexOf('ligneFiscalite(cf)');
    vrai(iCharges > 0 && iMens > iCharges, 'les charges précèdent la mensualité');
    vrai(iFisc > iMens, 'et la fiscalité vient après le crédit, en dernier');
  });

  test('le sous-total d’avant fiscalité ne paraît que si elle est connue', () => {
    /* Sinon il EST le chiffre de tete deux lignes plus bas : l'ecrire deux fois
       est la meilleure facon de faire douter des deux. Meme regle que
       « Loyer retenu », qui ne parait qu'en presence d'une vacance. */
    const f = bloc('lignesDuMois', 'ligneFiscalite');
    vrai(/\.\.\.\(cf\.fiscalite\.source === 'inconnue' \? \[\] : \[`/.test(f),
      'la ligne est conditionnée à l’état de la fiscalité');
    vrai(/<dt class="kv-sous">\$\{trad\('Cash-flow avant fiscalité'\)\}/.test(f),
      'et c’est un sous-total, pas un terme de plus');
    vrai(/fmtSigned\(cf\.cashFlowAvantImpot\)/.test(f),
      'il lit le montant que le modèle calcule déjà');
  });

  test('le chiffre de tête dit s’il est avant ou après la fiscalité', () => {
    const carte = bloc('carteLocatif', 'lignesDuMois');
    vrai(/\? trad\('Cash-flow avant fiscalité'\) : trad\('Cash-flow après fiscalité'\)/.test(carte),
      'les deux noms existent, et l’état tranche');
    vrai(!/trad\('Cash-flow'\)/.test(carte), 'le nom nu, qui ne disait pas lequel, est parti');
    bien({ fisc: null });
    eq(cashFlowBien(compteById('c_immo')).fiscalite.source, 'inconnue',
      'sans fiscalité déclarée, l’état est inconnu');
    bien({ fisc: 1200 });
    eq(cashFlowBien(compteById('c_immo')).fiscalite.source, 'declaree',
      'et déclaré quand un montant annuel existe');
    bien({ fisc: 0 });
    eq(cashFlowBien(compteById('c_immo')).fiscalite.source, 'declaree',
      'zéro déclaré est une fiscalité connue, pas une absence');
  });

  test('la vacance ne s’affiche que si elle existe', () => {
    const f = bloc('lignesDuMois', 'ligneFiscalite');
    vrai(/const vacance = cf\.vacanceEuros > 0\.005;/.test(f), 'la cascade la mesure');
    vrai(/!vacance \? cf\.sourcesLoyer\.map/.test(f),
      'et se réduit à la seule ligne de loyer quand il n’y en a pas');
    bien({ moisLoues: 12 });
    pres(cashFlowBien(compteById('c_immo')).vacanceEuros, 0, 'douze mois loués : rien à retirer');
    bien({ moisLoues: 11 });
    vrai(cashFlowBien(compteById('c_immo')).vacanceEuros > 0, 'onze mois : la vacance existe');
  });

  /* --- les rendements --------------------------------------------------- */

  test('trois rendements, et le crédit n’entre dans aucun', () => {
    bien({ loyer: 900, charges: 150, mensualite: 500, fisc: 1200 });
    const x = cashFlowBien(compteById('c_immo'));
    pres(x.rendementBrut, x.loyers * 12 / x.base * 100, 'le brut : le loyer sur la base');
    pres(x.rendementNet, (x.loyers - x.charges) * 12 / x.base * 100,
      'le net : moins les charges, jamais moins le crédit');
    pres(x.rendementNetNet, (x.loyers - x.charges - x.impot) * 12 / x.base * 100,
      'et le troisième, moins la fiscalité');
    vrai(x.mensualite > 0, 'alors que la mensualité existe');
    vrai(x.cashFlow < x.loyers - x.charges, 'et pèse bien sur le cash-flow');
  });

  test('sans fiscalité connue, le troisième rendement n’existe pas', () => {
    bien({ fisc: null });
    eq(cashFlowBien(compteById('c_immo')).rendementNetNet, null, 'rien n’est inventé');
    const carte = bloc('carteLocatif', 'lignesDuMois');
    vrai(/cf\.rendementNetNet == null \? '' :/.test(carte), 'et la ligne ne se rend pas');
  });

  test('sans base, aucun pourcentage n’est écrit à sa place', () => {
    Fixture.poser(e => {
      const c = e.comptes.find(x => x.id === 'c_immo');
      for (const l of c.lignes) { l.usage = 'locative'; l.valeur = 0; delete l.prixDeRevient;
        delete l.prixAchat; delete l.fraisAcquisition; delete l.travauxInitiaux; }
      e.budget.income = [{ label: 'Loyer', amount: 900, period: 'mois', bienId: 'c_immo' }];
    });
    eq(cashFlowBien(compteById('c_immo')).rendementBrut, null, 'la base manque');
    const l = bloc('ligneRendement', 'carteResidence');
    vrai(/Base à renseigner/.test(l), 'et l’écran le dit au lieu d’écrire zéro');
  });

  /* --- le logement ------------------------------------------------------ */

  test('un logement dit ce qui sort, et rien d’une rentabilité', () => {
    const carte = bloc('carteResidence', 'carteLocatif');
    vrai(/trad\('À ta charge'\)/.test(carte), 'le montant central est ce qui reste à ta charge');
    vrai(/ligneCharges\(cf, 0, 'Autres charges'\)/.test(carte),
      'et ses charges ne se disent pas « propriétaire »');
    for (const absent of ['Rendement', 'Cash-flow', 'cashFlow', 'rendementBrut',
                          'Fiscalité estimée', 'ligneFiscalite']) {
      vrai(!carte.includes(absent), `« ${absent} » n’a rien à faire sur un logement`);
    }
    vrai(/blocCapitalRembourse\(co\)/.test(carte), 'le capital remboursé, lui, reste');
  });

  test('le capital remboursé reste séparé, sur les deux cartes', () => {
    bien({ usage: 'principale', mensualite: 500 });
    const co = coutBien(compteById('c_immo'));
    vrai(co.capitalMois > 0, 'du capital se rembourse');
    pres(co.totalSorties, co.mensualite + co.autresCharges,
      'et il n’entre pas dans ce qui sort du compte');
    const b = bloc('blocCapitalRembourse', 'noteVentilation');
    vrai(/Capital remboursé ce mois/.test(b), 'il porte son nom');
    vrai(!/Gain total|Profit|cashFlow \+/.test(b), 'et ne s’additionne à aucun flux');
  });

  /* --- ce que la finition a retire -------------------------------------- */

  test('le rendement sur apport a quitté la carte, pas le modèle', () => {
    /* Quatre pourcentages sous une cascade de sept lignes font une carte qu'on
       ne parcourt plus, et celui-la repondait a une question d'investisseur
       quand les trois autres decrivent le bien. */
    const carte = bloc('carteLocatif', 'lignesDuMois');
    vrai(!/Rendement sur apport/.test(carte), 'il n’est plus affiché');
    vrai(!/cashOnCash/.test(carte), 'ni calculé dans la vue');
    bien({ loyer: 900 });
    Store.state.comptes.find(c => c.id === 'c_immo').apport = 30000;
    vrai(cashFlowBien(compteById('c_immo')).cashOnCash !== undefined,
      'le modèle le calcule toujours : rien n’est perdu');
  });

  test('les réglages disent qu’ils sont des réglages', () => {
    const f = bloc('reglagesExploitation', 'boutonsRattachement');
    vrai(/Paramètres locatifs/.test(f), 'un intitulé les sépare des montants');
    vrai(/sous-titre-carte/.test(f), 'avec le style des sous-titres de carte');
    vrai(/comptes\.\$\{idx\}\.moisLoues/.test(f) && /fiscaliteEstimeeAnnuelle/.test(f),
      'et les champs sont toujours là');
  });

  test('la mensualité porte un nom court, le détail reste dans Financement', () => {
    const f = bloc('ligneMensualite', 'blocCapitalRembourse');
    vrai(/nom: 'Mensualités'/.test(f), 'au pluriel quand il y a plusieurs crédits');
    vrai(/trad\('Mensualité'\)/.test(f), 'au singulier sinon');
    vrai(/trad\('\{n\} crédits'\)/.test(f), 'et le sous-texte compte les prêts');
    vrai(!/détaillés dans Financement/.test(f),
      'sans redire où ils se lisent : l’aide le dit déjà');
  });

  /* --- ce qui ne bouge pas ---------------------------------------------- */

  test('les boutons suivent l’usage', () => {
    const f = bloc('boutonsRattachement', 'ligneSource');
    vrai(/usage !== 'locative' \? '' :/.test(f), '« + Loyer » n’existe que sur un locatif');
    vrai(/data-action="ajouter-charge-bien"/.test(f), '« + Charge » vaut pour tous');
    const src = app();
    /* La borne est la fonction SUIVANTE, `boutonsRattachement` : viser la carte
       faisait traverser les boutons du bien direct, ou le loyer vit legitimement. */
    const pp = src.slice(src.indexOf('function boutonsPierrePapier('),
                         src.indexOf('function boutonsRattachement('));
    /* L'action est la meme -- creer un revenu rattache au bien -- et c'est le
       LIBELLE qui separe les deux mondes : une SCPI distribue, elle ne loue
       pas. Le controle porte donc sur le mot, pas sur le geste. */
    vrai(/trad\('Distribution'\)/.test(pp), 'une SCPI propose une distribution');
    vrai(!/\+ \$\{trad\('Loyer'\)\}/.test(pp), 'et jamais un loyer');
  });

  test('aucune phrase entière ne se refuse à revenir à la ligne', () => {
    /* `sans-veuve` pose `white-space: nowrap` : elle sert a coller un dernier
       mot a ce qui le suit, jamais a tenir un paragraphe sur une ligne. Posee
       sur la phrase des lots mixtes, elle demandait 391 px dans une carte de
       341 et faisait defiler la fiche horizontalement a 375 px. */
    const src = app();
    const i = src.indexOf('const DEMANDES = {');
    const f = src.slice(i, src.indexOf("<h2>${trad('Le bien')}</h2>", i));
    vrai(f.length > 300, 'le bloc des demandes doit être trouvable');
    vrai(!/sans-veuve/.test(f), 'la phrase revient à la ligne comme n’importe quel texte');
    vrai(/\$\{trad\(q\.quoi\)\}/.test(f), 'et elle est toujours affichée');
    /* Et la classe garde son emploi legitime ailleurs : un mot, pas une phrase. */
    const css = lireSource('assets/styles.css');
    vrai(/\.sans-veuve \{ white-space: nowrap; \}/.test(css), 'la classe existe toujours');
    vrai(/<span class="sans-veuve">\$\{trad\('non coté compris'\)\}/.test(src),
      'et sert encore là où un mot doit rester collé à ce qui le suit');
  });

  test('la pierre papier garde sa frontière', () => {
    const carte = bloc('cartePierrePapier', 'carteUsageBien');
    for (const absent of ['Surface', 'm²', 'Adresse', 'Vacance', 'Loyer potentiel',
                          'Mois loués', 'Taxe foncière', 'Assurance habitation']) {
      vrai(!carte.includes(absent), `« ${absent} » n’entre pas chez un placement`);
    }
    vrai(/Distribution/.test(carte) && /Frais/.test(carte), 'ses deux notions sont là');
  });

  test('un usage inconnu ne fabrique aucune carte', () => {
    const src = app();
    const f = src.slice(src.indexOf('function carteUsageInconnu('),
                        src.indexOf('function carteUsageLots('));
    for (const absent of ['Rendement', 'Cash-flow', 'coutBien', 'cashFlowBien']) {
      vrai(!f.includes(absent), `« ${absent} » ne s’invente pas sans usage déclaré`);
    }
    vrai(/data-action="changer-usage"/.test(f) || /usage/i.test(f), 'et la question se pose');
    const lots = src.slice(src.indexOf('function carteUsageLots('),
                           src.indexOf('function cartePierrePapier('));
    vrai(!/Rendement|Cash-flow/.test(lots), 'un usage mixte n’en invente pas davantage');
  });

  test('E1 à E4.1 tiennent toujours', () => {
    Fixture.poser(e => {
      e.budget.contributors = [{ id: 'p1', name: 'Autre' }];
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
    eq(cf.fiscalite.source, 'inconnue', 'E1 : le troisième état');
    eq(cf.impot, null, 'et aucun impôt inventé');
    vrai(chargesProposees(compteById('c_immo')).map(([x]) => x)
      .includes('Charges de copropriété non récupérables'), 'E2 : les suggestions');
    pres(cf.charges, 300, 'les charges valent ce qui est débité');
    pres(cf.mensualite, 2000, 'la mensualité aussi');
    pres(num(etabById('e_bien').dettes[0].montant), 120000, 'la dette reste entière');
    pres(fixedTotal(), 2300, 'le total des charges fixes les additionne');
    eq(loyersCourantsProbables().length, 0, 'E4 : aucune de ces charges n’est un loyer');
    pres(coutBien(compteById('c_immo')).totalSorties, 2300, 'et le coût du bien aussi');
  });
});

suite('Un loyer qu’on paie encore se reconnaît, prudemment', () => {

  const poser = (charges, extra) => Fixture.poser(e => {
    e.budget.contributors = [{ id: 'p1', name: 'Autre' }];
    e.budget.fixedCharges = charges;
    if (extra) extra(e);
  });
  const noms = () => loyersCourantsProbables().map(x => x.c.label).join(' | ');

  test('le mot ouvre le libellé, dans les deux langues', () => {
    poser([{ label: 'Loyer', amount: 100, period: 'mois' },
           { label: 'loyer', amount: 100, period: 'mois' },
           { label: '  LOYER  ', amount: 100, period: 'mois' },
           { label: 'Loyer appartement', amount: 100, period: 'mois' },
           { label: 'Loyer - Paris', amount: 100, period: 'mois' },
           { label: 'Loyer: Paris', amount: 100, period: 'mois' },
           { label: 'Loyer maison', amount: 100, period: 'mois' },
           { label: 'Rent', amount: 100, period: 'mois' },
           { label: 'Rent apartment', amount: 100, period: 'mois' },
           { label: 'Monthly rent', amount: 100, period: 'mois' }]);
    eq(loyersCourantsProbables().length, 10, 'les dix libellés sont reconnus');
  });

  test('le mot au milieu ne fait pas un loyer', () => {
    /* La regle qui protege tout le reste : proposer de supprimer la mauvaise
       charge coute bien plus cher que ne rien proposer. */
    poser([{ label: 'Garantie loyers impayés', amount: 100, period: 'mois' },
           { label: 'Assurance loyers impayés', amount: 100, period: 'mois' },
           { label: 'Gestion locative', amount: 100, period: 'mois' },
           { label: 'Revenu locatif', amount: 100, period: 'mois' },
           { label: 'Location de box', amount: 100, period: 'mois' },
           { label: 'Loyers', amount: 100, period: 'mois' },
           { label: 'Agence Nexity', amount: 1500, period: 'mois' }]);
    eq(noms(), '', 'aucun n’est proposé, « Agence Nexity » compris');
  });

  test('un lien structurel l’emporte sur le libellé', () => {
    /* Une charge qui rembourse un credit est la mensualite que la transition
       vient d'ajouter ; une charge rattachee a un bien est une charge de
       proprietaire. Ni l'une ni l'autre n'est un loyer qu'on paie. */
    poser([{ label: 'Loyer', amount: 1000, period: 'mois', creditId: 'd_pret' },
           { label: 'Loyer du studio', amount: 1000, period: 'mois', bienId: 'c_immo' }]);
    eq(noms(), '', 'une mensualité et une charge de propriétaire n’en sont pas');
  });

  test('un loyer se présente pour ce qui est débité', () => {
    /* Les parts d'une autre personne ne le reduisent plus : ce sont bien
       2 000 EUR qui sortent du compte, et c'est ce double cout-la qu'on
       previent en changeant de logement. */
    poser([{ label: 'Loyer', amount: 2000, period: 'mois', shares: { p1: 800 } }]);
    const l = loyersCourantsProbables();
    eq(l.length, 1, 'il est proposé');
    pres(l[0].mensuel, 2000, 'pour 2 000 €, le prélèvement entier');
    pres(num(l[0].c.amount), 2000, 'qui est aussi son montant facturé');
  });

  test('un loyer à zéro ne se propose pas', () => {
    /* Une ligne a zero ne coute rien, et rien ne se propose pour elle. */
    poser([{ label: 'Loyer', amount: 0, period: 'mois' }]);
    eq(noms(), '', 'aucun candidat');
  });

  test('la quote-part d’un bien ne touche pas au montant du loyer', () => {
    poser([{ label: 'Loyer', amount: 1500, period: 'mois' }], e => {
      for (const l of e.comptes.find(c => c.id === 'c_immo').lignes) l.part = 50;
    });
    pres(loyersCourantsProbables()[0].mensuel, 1500,
      'elle découpe la valeur d’un bien, jamais une charge');
  });

  test('un revenu nommé « Loyer » est ignoré', () => {
    poser([], e => {
      e.budget.income = [{ label: 'Loyer studio Lyon', amount: 600, period: 'mois' }];
    });
    eq(noms(), '', 'un loyer reçu n’est pas un loyer payé');
    const src = lireSource('assets/store.js');
    const f = src.slice(src.indexOf('function loyersCourantsProbables()'),
                        src.indexOf('function chargesOrdonnees()'));
    vrai(f.length > 100, 'la fonction doit être trouvable');
    vrai(!/income/.test(f), 'et elle ne lit même pas les revenus');
  });

  test('le rang réel accompagne chaque candidat', () => {
    poser([{ label: 'Internet', amount: 30, period: 'mois' },
           { label: 'Loyer', amount: 1000, period: 'mois' }]);
    const l = loyersCourantsProbables();
    eq(l[0].i, 1, 'c’est le rang dans les charges fixes');
    eq(Store.state.budget.fixedCharges[l[0].i].label, 'Loyer', 'il désigne la bonne ligne');
  });

  test('plusieurs loyers se rendent tous, et lire n’en retire aucun', () => {
    poser([{ label: 'Loyer Paris', amount: 1500, period: 'mois' },
           { label: 'Loyer studio', amount: 500, period: 'mois' }]);
    eq(loyersCourantsProbables().length, 2, 'les deux sont candidats');
    loyersCourantsProbables(); loyersCourantsProbables();
    eq(Store.state.budget.fixedCharges.length, 2, 'et rien ne se retire tout seul');
  });

  test('les périodes se ramènent au mois', () => {
    poser([{ label: 'Loyer garage', amount: 1200, period: 'an' },
           { label: 'Loyer box', amount: 300, period: 'trimestre' }]);
    const l = loyersCourantsProbables();
    pres(l[0].mensuel, 100, '1 200 € l’an font 100 € par mois');
    pres(l[1].mensuel, 100, '300 € par trimestre aussi');
  });
});

suite('La transition vers la résidence principale demande, elle ne décide pas', () => {

  const app = () => lireSource('assets/app.js');
  /* Les bornes sont du CODE : la banniere de commentaire qui suit disparait sur
     l'arbre publie, et la tranche courrait alors bien au-dela. */
  const fenetre = () => { const s = app();
    const i = s.indexOf('async function proposerTransitionLoyer()');
    return s.slice(i, s.indexOf('function focusLast(', i)); };
  /* Le CODE seul : le commentaire de la fonction NOMME les collections qu'elle
     ne touche pas, et un controle pose sur le texte brut s'y accrocherait. */
  const codeSeul = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

  test('le bien est créé et enregistré AVANT la question', () => {
    /* Fermer la fenetre ne doit laisser aucun etat a moitie ecrit : le credit
       porte ses liens, la charge de mensualite existe, tout est sauvegarde. */
    const s = app();
    const i = s.indexOf("if (bien && e3.usageBien === 'principale') await proposerTransitionLoyer();");
    vrai(i > 0, 'la création d’un bien déclaré principale ouvre la transition');
    const avant = s.lastIndexOf('refreshAccounts(); Store.save(); render();', i);
    vrai(avant > 0 && avant < i, 'et l’état est rafraîchi, enregistré et rendu avant');
  });

  test('un changement explicite d’usage vers principale l’ouvre aussi', () => {
    const s = app();
    vrai(/if \(v\.usage === 'principale' && u\.usage !== 'principale'\)\s*\n\s*await proposerTransitionLoyer\(\);/.test(s),
      'le geste explicite ouvre la transition, et seulement s’il change l’usage');
  });

  test('rien d’autre ne l’ouvre', () => {
    /* Ni une valeur corrigee, ni un credit modifie, ni l'ouverture de la fiche,
       ni un rendu : le detenteur serait harcele a chaque saisie. */
    const s = app();
    /* TROIS PORTES, et pas une de plus : la creation d'un bien declare
       principale, le petit atelier « Choisir l'usage », et l'enregistrement de
       la fiche quand son select vient de changer l'usage. Chacune suit un geste
       explicite ; aucune ne suit un rendu. */
    eq(s.split('proposerTransitionLoyer()').length - 1, 4,
      'la fonction est définie une fois et appelée trois fois, pas davantage');
    const f = fenetre();
    vrai(/if \(!loyers\.length\) return;/.test(f),
      'et sans candidat, elle ne montre rien du tout');
  });

  test('la fenêtre dit ce qu’elle propose, et rien d’anxiogène', () => {
    const f = fenetre();
    vrai(/Tu as déjà un loyer dans ton budget/.test(f), 'le titre au singulier');
    vrai(/Tu as plusieurs loyers dans ton budget/.test(f), 'et au pluriel');
    vrai(/Ce loyer est toujours compté dans tes charges fixes/.test(f), 'le texte');
    vrai(/Que veux-tu en faire \?/.test(f), 'la question');
    for (const mot of ['Le conserver', 'Le terminer', 'Plus tard']) {
      vrai(f.includes(`trad('${mot}')`), `« ${mot} » est proposé`);
    }
    vrai(/Garde-le si tu paies encore ton ancien logement/.test(f), 'et l’aide rassure');
    vrai(!/Attention|Incohérence|Erreur|Double prélèvement/.test(f), 'aucun mot alarmant');
  });

  test('le défaut ne détruit rien', () => {
    const f = fenetre();
    vrai(/valeur: 'garder'/.test(f), '« Le conserver » est présélectionné');
    vrai(/if \(!v \|\| v\.quoi !== 'terminer'\) return;/.test(f),
      'fermer, conserver ou remettre à plus tard ne touchent à rien');
  });

  test('« Le terminer » ne retire qu’une ligne, et laisse une porte de sortie', () => {
    const f = fenetre();
    vrai(/const cible = plusieurs \? loyers\.find\(x => String\(x\.i\) === String\(v\.quel\)\) : loyers\[0\];/.test(f),
      'la cible est celle que le choix désigne');
    vrai(/if \(!cible\) return;/.test(f), '« Aucun » ne désigne rien, donc rien ne part');
    vrai(/fixedCharges\.splice\(cible\.i, 1\)/.test(f), 'une seule ligne est retirée');
    vrai(!/filter\(|forEach\(/.test(f.slice(f.indexOf('const cible'))),
      'jamais un retrait groupé');
    vrai(/Store\.save\(\); render\(\);/.test(f), 'l’état est enregistré et l’écran refait');
    vrai(/toast\(.*retiré du budget.*porteDeSortie\(\)\)/.test(f),
      'et « Annuler » rend la charge entière');
  });

  test('la transition ne touche qu’aux charges fixes courantes', () => {
    /* L'historique vit ailleurs : `budget.expenses` porte les mois saisis et
       `monthly` les releves. Aucune fausse chronologie n'est fabriquee. */
    /* Sur le CODE seul : le commentaire de la fonction NOMME les collections
       qu'elle ne touche pas, et le controle s'y serait accroche. */
    const f = codeSeul(fenetre());
    vrai(!/expenses|monthly|sales|positions|comptes|etabs|contributors/.test(f),
      'aucune autre collection n’est approchée');
    vrai(!/income/.test(f), 'les revenus non plus');
  });

  test('aucune date de fin n’a été inventée sur les charges', () => {
    /* Le modele n'en a pas, et cette etape n'en cree pas : « terminer » veut
       dire quitter le budget COURANT. `echeanceLe` reste la prochaine echeance,
       elle ne devient pas une fin. */
    const store = lireSource('assets/store.js');
    vrai(!/finLe: v\.|dateFin|debutLe|termineeLe/.test(store),
      'aucun champ de fin sur une charge fixe');
    Fixture.poser(e => {
      e.budget.fixedCharges = [{ label: 'Loyer', amount: 1000, period: 'mois' }];
    });
    const avant = JSON.stringify(Store.state.budget.fixedCharges[0]);
    loyersCourantsProbables();
    eq(JSON.stringify(Store.state.budget.fixedCharges[0]), avant,
      'et la charge n’est pas annotée au passage');
  });

  test('retirer la ligne courante ne réécrit aucun mois passé', () => {
    /* La preuve par les nombres : on retire comme la fenetre le fait, et on
       mesure l'historique des deux cotes. */
    Fixture.poser(e => {
      e.budget.fixedCharges = [{ label: 'Loyer Paris', amount: 1500, period: 'mois' },
                               { label: 'Internet', amount: 30, period: 'mois' }];
    });
    const moisAvant = JSON.stringify(Store.state.monthly);
    const depAvant = JSON.stringify(Store.state.budget.expenses || []);
    const brutAvant = round2(patrimoine().brut);
    const netAvant = round2(patrimoine().net);
    const detteAvant = round2(patrimoine().dettes);

    const cible = loyersCourantsProbables()[0];
    Store.state.budget.fixedCharges.splice(cible.i, 1);

    eq(JSON.stringify(Store.state.monthly), moisAvant, 'les relevés mensuels sont intacts');
    eq(JSON.stringify(Store.state.budget.expenses || []), depAvant,
      'les dépenses des mois passés aussi');
    pres(round2(patrimoine().brut), brutAvant, 'le patrimoine brut ne bouge pas');
    pres(round2(patrimoine().net), netAvant, 'ni le net');
    pres(round2(patrimoine().dettes), detteAvant, 'ni la dette');
    eq(Store.state.budget.fixedCharges.map(c => c.label).join(' | '), 'Internet',
      'seule la ligne visée est partie');
    pres(fixedTotal(), 30, 'et le budget courant se recalcule');
    pres(budgetFrame().fixed, fixedTotal(), 'le cadre lit le même total');
  });

  test('retirer un loyer ne touche à aucune autre ligne', () => {
    Fixture.poser(e => {
      e.budget.fixedCharges = [
        { label: 'Loyer', amount: 2000, period: 'mois' },
        { label: 'Internet', amount: 40, period: 'mois' }];
    });
    const cible = loyersCourantsProbables()[0];
    pres(cible.mensuel, 2000, 'la fenêtre annonce ce qui est débité');
    Store.state.budget.fixedCharges.splice(cible.i, 1);
    eq(Store.state.budget.fixedCharges.map(c => c.label).join(' | '), 'Internet',
      'seule la ligne visée est partie');
    pres(fixedTotal(), 40, 'et le budget ne compte plus que l’internet');
  });

  test('deux loyers : en retirer un laisse l’autre', () => {
    const dHabitude = () => Fixture.poser(e => {
      e.budget.fixedCharges = [{ label: 'Loyer Paris', amount: 1500, period: 'mois' },
                               { label: 'Loyer studio', amount: 500, period: 'mois' }];
    });
    for (const [choisi, reste] of [[0, 'Loyer studio'], [1, 'Loyer Paris']]) {
      dHabitude();
      const l = loyersCourantsProbables();
      Store.state.budget.fixedCharges.splice(l[choisi].i, 1);
      eq(Store.state.budget.fixedCharges.map(c => c.label).join(' | '), reste,
        `en retirant le ${choisi === 0 ? 'premier' : 'second'}, l’autre survit`);
    }
    dHabitude();
    eq(Store.state.budget.fixedCharges.length, 2, 'et ne rien choisir ne retire rien');
  });

  test('changer d’usage ne supprime ni revenu ni charge du bien', () => {
    /* Un locatif qui devient residence principale garde ses revenus, ses
       charges et son credit : le changement d'usage change la PRESENTATION. */
    Fixture.poser(e => {
      for (const l of e.comptes.find(c => c.id === 'c_immo').lignes) l.usage = 'locative';
      e.budget.income = [{ label: 'Loyer reçu', amount: 900, period: 'mois', bienId: 'c_immo' }];
      e.budget.fixedCharges = [{ label: 'Taxe foncière', amount: 1200, period: 'an',
                                 bienId: 'c_immo' }];
    });
    const revenus = JSON.stringify(Store.state.budget.income);
    const charges = JSON.stringify(Store.state.budget.fixedCharges);
    for (const l of compteById('c_immo').lignes) l.usage = 'principale';
    refreshAccounts();
    eq(JSON.stringify(Store.state.budget.income), revenus, 'les revenus liés restent');
    eq(JSON.stringify(Store.state.budget.fixedCharges), charges, 'les charges liées aussi');
    eq(usageBien(compteById('c_immo')), 'principale', 'et l’usage a bien changé');
    vrai(poches().mobilisable.habite > 0, 'le logement habité sort des actifs mobilisables');
  });

  test('les conventions E1 à E3.1 ne bougent pas', () => {
    Fixture.poser(e => {
      e.budget.contributors = [{ id: 'p1', name: 'Autre' }];
      const d = e.etabs.find(x => x.id === 'e_bien').dettes[0];
      d.montant = 120000; d.taux = 2; d.mensualite = null;
      for (const l of e.comptes.find(c => c.id === 'c_immo').lignes) l.usage = 'locative';
      e.budget.income = [{ label: 'Loyer', amount: 900, period: 'mois', bienId: 'c_immo' }];
      e.budget.fixedCharges = [
        { label: 'Prêt', amount: 2000, period: 'mois', shares: { p1: 800 },
          creditId: 'd_pret', bienId: 'c_immo' },
        { label: 'Copropriété', amount: 300, period: 'mois', shares: { p1: 90 },
          bienId: 'c_immo' }];
    });
    eq(loyersCourantsProbables().length, 0, 'aucune de ces deux charges n’est un loyer');
    pres(mensualiteCredit(etabById('e_bien').dettes[0]), 2000, 'la mensualité débitée');
    pres(num(etabById('e_bien').dettes[0].montant), 120000, 'la dette reste entière');
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.charges, 300, 'les charges débitées');
    pres(coutBien(compteById('c_immo')).totalSorties, 2300, 'et le coût du bien');
    eq(cf.fiscalite.source, 'inconnue', 'E1 : la fiscalité garde son troisième état');
    vrai(chargesProposees(compteById('c_immo')).map(([x]) => x)
      .includes('Charges de copropriété non récupérables'), 'E2 : les suggestions tiennent');
    pres(fixedTotal(), 2300, 'le total des charges fixes les additionne');
  });
});

/* E4.1 : deux fermetures avant de verrouiller E4. */
suite('Le geste qui offre un retour en arrière parle en dernier', () => {

  const app = () => lireSource('assets/app.js');

  test('le toast de création précède la question du loyer', () => {
    /* LE DEFAUT. Un toast remplace le precedent : annonce APRES la transition,
       celui de la creation effaçait « retire du budget » et son bouton
       « Annuler ». La pile d'annulation restait pleine, mais la porte de sortie
       disparaissait de l'ecran une fraction de seconde apres s'y etre posee. */
    const s = app();
    const i = s.indexOf("if (bien && e3.usageBien === 'principale') await proposerTransitionLoyer();");
    vrai(i > 0, 'la transition s’ouvre bien à la création');
    const t = s.lastIndexOf('toast([t.label, nomContenant()', i);
    vrai(t > 0 && t < i, 'et le toast de création parle avant elle');
  });

  test('rien ne parle après la transition, dans aucun des deux flux', () => {
    const s = app();
    eq(s.split('await proposerTransitionLoyer();\n  },').length - 1, 3,
      'les trois appels ferment leur action : plus aucun toast derrière');
  });

  test('l’ordre vient des appels, jamais d’une minuterie', () => {
    /* Un delai artificiel ferait dependre une regle d'un reglage de minuterie :
       elle tiendrait tant que les durees ne bougent pas, et se deferait en
       silence le jour ou l'une d'elles change. */
    const s = app();
    vrai(!/setTimeout\([^)]*toast/.test(s), 'aucun toast différé');
    vrai(!/setTimeout\([^)]*proposerTransitionLoyer/.test(s), 'ni transition différée');
  });

  test('le changement d’usage annonçait déjà dans le bon ordre', () => {
    const s = app();
    const i = s.indexOf("if (v.usage === 'principale' && u.usage !== 'principale')");
    vrai(i > 0, 'le second déclencheur est là');
    const t = s.lastIndexOf('toast(`${nomCompteV2(c)} · ${trad(USAGE_BIEN_LABEL[v.usage])}`);', i);
    vrai(t > 0 && t < i, 'et son toast parlait déjà avant la transition');
  });

  test('seul « Le terminer » retire quelque chose', () => {
    /* « Le conserver » et « Plus tard » sortent par la meme porte, et fermer la
       fenetre aussi : une seule branche touche aux donnees. */
    const s = app();
    const i = s.indexOf('async function proposerTransitionLoyer()');
    const f = s.slice(i, s.indexOf('function focusLast(', i));
    vrai(/if \(!v \|\| v\.quoi !== 'terminer'\) return;/.test(f),
      'les trois autres issues ne modifient rien');
    eq(f.split('fixedCharges.splice(').length - 1, 1, 'et un seul retrait existe');
    vrai(/toast\(`\$\{guill\(nom\)\} \$\{trad\('retiré du budget'\)\}`, porteDeSortie\(\)\)/.test(f),
      'qui annonce avec sa porte de sortie');
  });
});

suite('« Rent guarantee insurance » n’est pas un loyer', () => {

  const poser = (labels) => Fixture.poser(e => {
    e.budget.fixedCharges = labels.map(l => typeof l === 'string'
      ? { label: l, amount: 1000, period: 'mois' }
      : { amount: 1000, period: 'mois', ...l });
  });
  const noms = () => loyersCourantsProbables().map(x => x.c.label).join(' | ');

  test('l’anglais qui désigne un loyer payé passe', () => {
    const oui = ['Rent', 'Rent apartment', 'Rent house', 'Rent London',
                 'Rent - London', 'Rent: London', 'Monthly rent',
                 'Monthly rent apartment'];
    poser(oui);
    eq(loyersCourantsProbables().length, oui.length, 'les huit sont reconnus');
  });

  test('l’anglais qui désigne une prestation autour du loyer ne passe pas', () => {
    /* Toutes s'ouvrent par le mot, et la regle du mot en tete les laissait
       passer — puis proposait de supprimer la garantie loyers impayes. */
    poser(['Rent guarantee insurance', 'Rent guarantee', 'Rent insurance',
           'Rental management', 'Rent collection fee', 'Rent guarantee premium',
           'Rent protection', 'Rent arrears cover', 'Monthly rent guarantee']);
    eq(noms(), '', 'aucune n’est proposée');
  });

  test('le français n’est pas touché par ce durcissement', () => {
    poser(['Loyer', 'Loyer appartement', 'Loyer maison', 'Loyer Paris',
           'Loyer - Paris', 'Loyer : Paris']);
    eq(loyersCourantsProbables().length, 6, 'les six passent toujours');
    poser(['Garantie loyers impayés', 'Assurance loyers impayés', 'Gestion locative',
           'Frais de gestion locative', 'Revenus locatifs', 'Loyers impayés']);
    eq(noms(), '', 'et les six autres restent dehors');
  });

  test('la structure gagne toujours sur le texte', () => {
    poser([{ label: 'Rent', creditId: 'd_pret' },
           { label: 'Rent', bienId: 'c_immo' },
           { label: 'Loyer', creditId: 'd_pret' }]);
    eq(noms(), '', 'un lien vers un crédit ou un bien écarte, quel que soit le libellé');
  });

  test('le reste d’E4 ne bouge pas', () => {
    Fixture.poser(e => {
      e.budget.contributors = [{ id: 'p1', name: 'Autre' }];
      e.budget.fixedCharges = [
        { label: 'Loyer Paris', amount: 2000, period: 'mois', shares: { p1: 800 } },
        { label: 'Loyer studio', amount: 500, period: 'mois' },
        { label: 'Loyer payé par l’autre', amount: 900, period: 'mois', shares: { p1: 900 } },
        { label: 'Rent guarantee insurance', amount: 40, period: 'mois' }];
    });
    const l = loyersCourantsProbables();
    eq(l.map(x => x.c.label).join(' | '), 'Loyer Paris | Loyer studio | Loyer payé par l’autre',
      'trois candidats : la garantie reste dehors, les loyers entrent tous');
    pres(l[0].mensuel, 2000, 'et le premier s’annonce pour ce qui est débité');

    const moisAvant = JSON.stringify(Store.state.monthly);
    const depAvant = JSON.stringify(Store.state.budget.expenses || []);
    const brut = round2(patrimoine().brut), dette = round2(patrimoine().dettes);
    Store.state.budget.fixedCharges.splice(l[1].i, 1);          // on en cible UN
    eq(Store.state.budget.fixedCharges.map(c => c.label).join(' | '),
      'Loyer Paris | Loyer payé par l’autre | Rent guarantee insurance',
      'les autres lignes restent');
    eq((Store.state.budget.contributors || []).length, 1,
      'la donnee de partage n’est pas effacée pour autant');
    eq(JSON.stringify(Store.state.monthly), moisAvant, 'les relevés sont intacts');
    eq(JSON.stringify(Store.state.budget.expenses || []), depAvant, 'les dépenses aussi');
    pres(round2(patrimoine().brut), brut, 'le patrimoine ne bouge pas');
    pres(round2(patrimoine().dettes), dette, 'ni la dette');
  });
});

finDePartieDeTests('tests/07-application-s-adresse-toujours.tests.js');
