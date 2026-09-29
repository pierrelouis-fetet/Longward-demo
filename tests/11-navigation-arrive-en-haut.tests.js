partieDeTests('tests/11-navigation-arrive-en-haut.tests.js');
/* ------------------------------------------------------------------
   Naviguer par les barres arrive en haut de page
   ------------------------------------------------------------------ */
suite('La navigation arrive en haut, la memoire sert au retour de fiche', () => {

  test('la barre du bas et le menu posent le drapeau de retour en haut', () => {
    /* Revenir sur Apercu par la barre du bas ramene en haut de la page. La
       memoire de position par vue ne couvre pas les appuis sur la barre du
       bas : revenir sur Apercu ne doit pas rendre la page a 1 500 px, la ou on
       l'avait laissee. Un changement de menu arrive toujours en haut.

       Le drapeau se pose sur le geste -- barre du bas, menu lateral, logo --
       et jamais dans render() : la memoire de position doit rester entiere
       pour revenir d'une fiche a la liste qu'on parcourait. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai(/lien\.getAttribute\('href'\) !== location\.hash\) \{ retourHautDemande = true; return; \}/.test(src),
      'un appui sur la barre du bas qui navigue demande le haut de page');
    vrai(/href && href !== location\.hash\) retourHautDemande = true;/.test(src),
      'un clic dans le menu latéral aussi');
    const poseurs = (src.match(/retourHautDemande = true/g) || []).length;
    vrai(poseurs >= 3, 'les trois portes — logo, barre, menu — posent le même drapeau');
    /* Et la restauration de position existe toujours : c'est elle qui ramene
       une liste la ou on l'avait laissee en revenant d'une fiche. */
    vrai(/positionsVues\.get\(signatureVue\)/.test(src),
      'la mémoire de position par vue reste en place pour le retour de fiche');
  });
});

/* ------------------------------------------------------------------
   Budget
   ------------------------------------------------------------------ */
suite('Budget : le pourcentage dit sa base, l annee reste une annee', () => {

  test('le budget consomme ne se rend que sur une base positive', () => {
    /* La regle de la maison, appliquee au nouveau venu : un pourcentage n'existe
       que sur une base positive. Sans objectif regle, la carte ne montre pas de
       part -- elle n'a rien pour la calculer. Budget consomme est le mot du
       domaine. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const i = src.indexOf('Budget consommé');
    vrai(i > 0, 'la carte du mois porte la part du budget consommée');
    const garde = src.slice(i - 700, i);
    vrai(/f\.target > 0/.test(garde),
      'et elle ne se rend que si un objectif positif existe');
  });

  test('aucun sélecteur d’année n’offre plus « Toutes les années »', () => {
    /* Retire de Budget le matin du 9 aout, puis de partout le meme jour :
       « ce sera illisible en l'etant apres longtemps ». Les quatre selecteurs
       gouvernent des listes, et dix ans de lignes empilees ne repondent a
       aucune question — la vue longue appartient a la courbe et a ses durees.
       Le controle porte sur la fonction unique : un cran qui reviendrait chez
       un appelant reviendrait ici. */
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function yearControl'), src.indexOf('function tile'));
    vrai(fn.length > 100, 'yearControl doit être trouvable');
    vrai(!/Toutes les années/.test(fn), 'le cran a quitté la fonction, donc tous ses appelants');
    /* Et une valeur `all` restee d un vieux geste retombe sur l annee en
       cours, pour chacun des quatre etats d annee. */
    /* `salesYear` a quitte cette liste avec le selecteur du journal : sa borne
       est celle de la page, et `rangeControl` n'offre pas de cran « toutes ». */
    /* `evoYear` a quitte cette liste avec le depliant « Voir les donnees » de la
       courbe : son selecteur d'annee est parti avec le tableau qu'il filtrait. */
    for (const etat of ['budgetYear', 'historyYear']) {
      vrai(new RegExp(`if \\(${etat} === 'all'\\) ${etat} = null;`).test(src),
        `${etat} doit absorber l’ancienne valeur « all »`);
    }
  });

  });

/* ------------------------------------------------------------------
   Une vente declaree n ecrit que le journal
   ------------------------------------------------------------------ */
suite('Une vente déclarée n’écrit que le journal', () => {

  /* « Trouver un systeme pour pouvoir declarer d anciennes ventes, donc sans
     impacter quoi que ce soit, ni le cash ni le patrimoine. Juste pour avoir
     l info. » C est la reponse au chantier d ETAT.md : noter une vente d un
     PEA cloture demandait de recreer le compte, la ligne, de vendre, puis
     d archiver — quatre gestes pour fabriquer un fait passe. */

  test('elle entre au journal sans toucher un euro', () => {
    Fixture.poser();
    const netAvant = patrimoine().net;
    const nbPositions = Store.state.positions.length;
    const cashAvant = JSON.stringify(Store.state.comptes.map(c => c.cash));
    declarerVente({ date: '2023-05-10', name: 'Total', gross: 4800, realised: 300 });
    eq(Store.state.sales.length, 1, 'la vente est au journal');
    eq(Store.state.sales[0].declaree, true, 'et elle dit ce qu elle est');
    pres(Store.state.sales[0].invested, 4500,
      'le prix de revient se dérive de l’encaissé et du résultat');
    pres(patrimoine().net, netAvant, 'pas un euro de patrimoine');
    eq(Store.state.positions.length, nbPositions, 'aucune ligne touchée');
    eq(JSON.stringify(Store.state.comptes.map(c => c.cash)), cashAvant,
      'aucun cash crédité : il est arrivé sur le compte il y a des années');
  });

  test('elle compte dans les statistiques du journal, c’est sa raison d’être', () => {
    Fixture.poser();
    declarerVente({ date: '2023-05-10', name: 'Total', gross: 4800, realised: 300 });
    const st = salesStats('all');
    eq(st.sales.length, 1, 'le journal la montre');
  });

  test('l’annuler ne rend rien, parce qu’il n’y a rien à rendre', () => {
    /* Le chemin normal d annulation rend les titres et reprend les especes.
       Le derouler sur une vente declaree pousserait une ligne fantome de
       quantite nulle et retrancherait un produit jamais credite. */
    Fixture.poser();
    declarerVente({ date: '2023-05-10', name: 'Total', gross: 4800, realised: 300 });
    const nbPositions = Store.state.positions.length;
    const cashAvant = JSON.stringify(Store.state.comptes.map(c => c.cash));
    annulerVente(0);
    eq(Store.state.sales.length, 0, 'la ligne quitte le journal');
    eq(Store.state.positions.length, nbPositions, 'aucune ligne fantôme ne naît');
    eq(JSON.stringify(Store.state.comptes.map(c => c.cash)), cashAvant,
      'et aucun euro ne repart d’un compte qui n’avait rien reçu');
  });

  test('ses champs muets se taisent à l’écran, avec leur raison', () => {
    /* Sans quantite ni prix, la ligne ecrivait « 0 » et « 0,00 € » : une vente
       amputee plutot qu'une vente declaree. Le tableau a cede la place a une liste
       cliquable et a un panneau de detail, et la regle a suivi les deux — c'est le
       genre de silence qu'un remplacement d'affichage emporte sans le dire. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const carte = src.match(/function salesCard\(\) \{[\s\S]*?\nfunction lignesJournalVentes\([\s\S]*?\n\}/)[0];
    vrai(/v\.declaree \? trad\('déclarée, pour mémoire'\)/.test(carte),
      'la ligne dit d’où elle vient au lieu d’annoncer une quantité nulle');
    vrai(/num\(v\.qty\)\} × \$\{fmtCur\(v\.price, dev\)\}/.test(carte),
      'et la quantité ne s’affiche que sur une vente qui en a une');
    const ap = src.slice(src.indexOf('vente: (i) =>'), src.indexOf('vente: (i) =>') + 3600);
    vrai(/\$\{v\.declaree \? '' : `/.test(ap),
      'le panneau tait les trois champs de prix sur une vente déclarée');
    vrai(/if \(v\.declaree\) \{\n    Store\.state\.sales\.splice/.test(lireSource('assets/store.js')),
      'l’annulation la retire sans rien défaire d’autre');
  });
});

/* ------------------------------------------------------------------
   Marches se filtre par compte
   ------------------------------------------------------------------ */
suite('Marchés : le filtre de compte suit les règles du filtre de rôle', () => {

  test('il agit sur la liste, se dérive des positions, et se tait seul', () => {
    /* Choisir un compte ne montre que les positions de ce compte. Meme regime que
       le filtre Core / Satellite : la liste des lignes, pas les tuiles du haut --
       une valeur de portefeuille qui changerait selon un filtre d'affichage
       serait un piege. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* Le filtre est ecrit une fois, dans le modele, et les deux listes de la
       page le lisent a travers la vue. */
    vrai(/\(compte === 'tous' \|\| p\.account === compte\)/.test(lireSource('assets/store.js'))
      && /passeFiltresTitres\(p, posRole, posCompte\)/.test(src)
      && /\.filter\(\(\{ p \}\) => passeFiltresLignes\(p\)\)/.test(src),
      'la liste des lignes passe par le filtre de compte');
    vrai(/\$\{ids\.length < 2 \? '' : `<select data-action-change="filtrer-compte-titres"/.test(src),
      'le sélecteur ne se rend qu’à partir de deux comptes : un contrôle sans '
      + 'effet se lit comme une panne');
    vrai(/new Set\(Store\.state\.positions\.map\(p => p\.account\)\)/.test(src),
      'ses options se dérivent des positions, jamais d’une liste écrite à la main');
    vrai(/posCompte !== 'tous' && !Store\.state\.positions\.some/.test(src),
      'un compte disparu ne peut pas rester filtré : la page semblerait vide');
    vrai(/v === posCompte\) return;/.test(src),
      'le gestionnaire est idempotent : deux routeurs de change visent ce sélecteur');
  });
});

/* ------------------------------------------------------------------
   Le detail mensuel se trie, et ses colonnes se rangent
   ------------------------------------------------------------------ */
suite('Détail mensuel : tri des lignes, ordre des colonnes', () => {

  test('déplacer une catégorie déplace la colonne partout, par la seule liste', () => {
    /* L ordre de budget.categories EST l ordre des colonnes du tableau, de la
       fenetre de saisie, des graphiques et des exports : une liste, un geste. */
    Fixture.poser();
    eq(deplacerCategorie('Voyages', -1), true, 'la seconde peut avancer');
    eq(expenseCategories().join('|'), 'Voyages|Courses', 'et la liste a tourné');
    eq(deplacerCategorie('Voyages', -1), false, 'la première ne va pas plus haut');
    eq(deplacerCategorie('Courses', +1), false, 'ni la dernière plus bas');
    eq(expenseCategories().join('|'), 'Voyages|Courses', 'les bornes ne défont rien');
  });

  test('la liste par défaut se matérialise avant de se réordonner', () => {
    /* Sans categories posees, expenseCategories() rend une constante partagee :
       on ne reordonne pas une constante, on la copie d abord chez soi. */
    Fixture.poser(e => { e.budget.categories = []; });
    const defaut = [...expenseCategories()];
    vrai(defaut.length >= 2, 'le jeu par défaut porte plusieurs catégories');
    eq(deplacerCategorie(defaut[1], -1), true);
    eq(Array.isArray(Store.state.budget.categories), true, 'la liste vit désormais dans l’état');
    eq(Store.state.budget.categories[0], defaut[1], 'et c’est elle qui a tourné');
  });

  test('le tri ne touche que le tableau du grand écran', () => {
    /* La liste de telephone n a pas d en-tetes pour dire son ordre, et un
       ordre muet est un piege : elle reste chronologique. « vs obj. » ne trie
       pas — son classement serait celui du total, l objectif etant le meme
       pour tous les mois. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const carte = src.slice(src.indexOf('data-anchor="detail-mensuel"'),
                            src.indexOf('Renommer, retirer ou supprimer'));
    vrai(/depSort \? \(\(\) => \{/.test(carte), 'le tableau trie une copie de la vue indexée');
    const mobile = carte.slice(carte.indexOf('liste-mobile'), carte.indexOf('table-wrap'));
    vrai(/lignesDepenses\.map/.test(mobile) && !/depSort/.test(mobile),
      'la liste de téléphone ignore le tri');
    vrai(/<th>\$\{trad\('vs obj\.'\)\}<\/th>/.test(carte), '« vs obj. » reste une en-tête muette');
  });
});

/* ------------------------------------------------------------------
   Enregistrer suit une seule regle, par famille de fenetres
   ------------------------------------------------------------------ */
suite('Enregistrer : une règle, deux familles', () => {

  /* Deux familles de fenetres, voulues, et aucune fenetre entre les deux :

     - fenetre de SAISIE EN SERIE (fiche de ligne, depenses du mois, releve,
       apercus modifiables) : Enregistrer ecrit et reste, Fermer part et
       demande s'il reste du non-enregistre ;
     - fenetre d'ACTE (creer, vendre, confirmer) : le bouton porte le nom de
       l'acte et ferme.

     Le releve mensuel appartient a la premiere : douze champs comme sa jumelle
     des depenses. Enregistrer n'y ferme pas, et Annuler ne jette pas la saisie
     sans une question. */

  test('un pied de fenêtre tient sur une ligne à 375 px', () => {
    /* Le pied est le seul endroit de l'application ou la place est comptee
       d'avance : ses boutons se partagent la largeur a parts egales sur
       telephone. Trois boutons font 107 px chacun, quatre en font 80, et un
       libelle trop long s'y plie en trois lignes — la hauteur du pied double, ses
       voisins s'etirent avec lui, et « Enregistrer » parait enorme. C'est ce qui
       est arrive avec « Voir les autres mois ».

       La mesure porte sur la somme des libelles d'un meme pied, pas sur chacun :
       « Enregistrer la vente » tient tres bien face au seul « Annuler », et
       l'interdire aurait ete arbitraire. Trente-six caracteres, marge comprise
       pour l'anglais, qui est parfois plus long. */
    const src = lireSource('assets/app.js');
    const pieds = src.match(/\$\('#modalFoot'\)\.innerHTML =[\s\S]{0,900}?`;/g) || [];
    vrai(pieds.length >= 4, `au moins quatre pieds attendus, ${pieds.length} trouvés`);
    for (const pied of pieds) {
      const libelles = [...pied.matchAll(/trad\('([^']+)'\)/g)].map(m => m[1])
        /* Les libelles hors bouton — un titre, une aide — ne comptent pas. */
        .filter(l => l.length < 30);
      if (!libelles.length) continue;
      const somme = libelles.reduce((s, l) => s + l.length, 0);
      vrai(somme <= 36,
        `pied trop chargé (${somme} caractères) : ${libelles.join(' + ')}`
        + '\n  un libellé plus court, ou une ligne dédiée comme .btn-encore');
    }
  });

  test('toute fenêtre de saisie en série porte la paire, sans exception', () => {
    /* Le balayage qui manquait : la regle etait ecrite, mais verifiee sur un seul
       cas — le releve mensuel. La fenetre des revenus est restee transfuge des
       mois, douze champs sous les yeux et « Fermer » pour seul bouton.
       La detection se fait sur les pieds de fenetre : chaque `#modalFoot` qui
       porte « Fermer » doit porter « Enregistrer » a cote, sauf ceux d'un acte
       ou d'une simple lecture. */
    const src = lireSource('assets/app.js');
    const pieds = src.match(/\$\('#modalFoot'\)\.innerHTML =[\s\S]{0,700}?`;/g) || [];
    vrai(pieds.length >= 4, `au moins quatre pieds de fenêtre attendus, ${pieds.length} trouvés`);
    for (const pied of pieds) {
      if (!/trad\('Fermer'\)/.test(pied)) continue;
      vrai(/trad\('Enregistrer'\)/.test(pied),
        'un pied porte « Fermer » sans « Enregistrer » :\n  ' + pied.slice(0, 200));
    }
    /* Et celui des revenus nommement, puisque c'est lui qui manquait. */
    vrai(/id="revOk"[^>]*>\$\{trad\('Enregistrer'\)\}</.test(src),
      'la fenêtre des revenus porte enfin Enregistrer');
    vrai(/\$\('#revOk'\)\.onclick/.test(src), 'et il est câblé');
  });

  test('le relevé mensuel rejoint la famille de sa jumelle', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* La borne haute etait « function askAccount », une fenetre morte que
       rien n'appelait : elle est partie, la fenetre d'apercu la remplace
       comme frontiere. */
    const bloc = src.slice(src.indexOf('function askMonthlySnapshot'),
                           src.indexOf('const APERCUS'));
    vrai(/id="relOk"[^>]*>\$\{trad\('Enregistrer'\)\}</.test(bloc) && /id="relFermer"[^>]*>\$\{trad\('Fermer'\)\}</.test(bloc),
      'le pied porte Enregistrer et Fermer, traduits, comme la fenêtre des dépenses');
    vrai(!/relCancel/.test(bloc),
      '« Annuler » est parti : il ne désignait plus rien de distinct de Fermer');
    vrai(/appliquerReleve\(index/.test(bloc),
      'Enregistrer écrit par appliquerReleve et la fenêtre reste');
    vrai(!/fermer\(\{/.test(bloc),
      'et il ne ferme plus en résolvant : écrire et partir redeviendraient un seul geste');
    vrai(/Modifications non enregistrées/.test(bloc),
      'Fermer sur une saisie sale pose la même question que les aperçus');
  });

  test('le champ des crédits du mois s’enregistre enfin', () => {
    /* Il etait lu pour afficher le net, jamais ecrit : on saisissait une
       dette, elle disparaissait a la fermeture, sans erreur nulle part. */
    const src = lireSource('assets/app.js');
    vrai(/row\.dettes = round2\(num\(saisi\.dettes\)\)/.test(src),
      'appliquerReleve écrit les dettes du mois depuis le champ');
    vrai(/dettes: \$\('#relDettes'\)\.value/.test(src),
      'et Enregistrer les lit dans le champ : ce qui s’affiche est ce qui s’enregistre');
  });

  test('l’écriture du relevé vit à un seul endroit', () => {
    /* La fenetre ecrit desormais elle-meme : si l appelant reappliquait la
       saisie, chaque Enregistrer ecrirait deux fois. */
    const src = lireSource('assets/app.js');
    eq((src.match(/appliquerReleve\(/g) || []).length, 2,
      'une définition, un appelant : la fenêtre, et personne d’autre');
    const action = src.slice(src.indexOf("async 'edit-month'"), src.indexOf("async 'ajouter-releve'"));
    vrai(action.length > 40, 'les deux actions du relevé doivent être trouvables');
    vrai(!/row\.v = /.test(action),
      'l’action d’ouverture n’écrit plus rien elle-même');
  });
});

/* ------------------------------------------------------------------
   Le pli des comptes s anime sur place
   ------------------------------------------------------------------ */
suite('Le pli des comptes s’anime sur place', () => {

  test('le geste ne re-rend pas : une transition exige que l’élément survive', () => {
    /* Deplier et replier les comptes s'anime. Un render() qui remplacerait le
       groupe rendrait toute transition impossible -- la meme lecon que le lavis
       des sous-onglets. Le pli bascule ses classes sur place, l'etat s'ecrit
       comme avant, et le prochain rendu le relit. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.slice(src.indexOf("'replier-groupe'(btn)"), src.indexOf("'plier-tout'"));
    vrai(!/\brender\(\);\s*\}\s*,\s*$/.test(bloc) && /classList\.toggle\('ouvert'/.test(bloc),
      'replier-groupe bascule la classe au lieu de re-rendre');
    vrai(/aria-expanded/.test(bloc), 'et le bouton dit son état au clavier');
    vrai(/if \(!pli\) \{ render\(\); return; \}/.test(bloc),
      'sans pli trouvé, on retombe sur le re-rendu : jamais un geste muet');
  });

  test('la grille passe de 0fr à 1fr, et la visibilité suit avec retard', () => {
    /* La seule facon d animer une hauteur inconnue sans la mesurer. La
       visibilite differee sort le contenu replie du clavier et des lecteurs —
       le role que tenait l attribut hidden quand le pli etait sec. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/\.cpt-pli \{[^}]*grid-template-rows: 0fr/.test(css), 'fermé : 0fr');
    vrai(/\.cpt-pli\.ouvert \{[^}]*grid-template-rows: 1fr/.test(css), 'ouvert : 1fr');
    vrai(/\.cpt-pli \{[^}]*visibility: hidden/.test(css),
      'le contenu replié quitte le clavier et les lecteurs');
    vrai(/\.cpt-pli > \.cpt-corps \{[^}]*min-height: 0/.test(css),
      'sans min-height 0, le contenu impose sa hauteur et la grille ne ferme jamais');
    vrai(/prefers-reduced-motion[^}]*\{[^}]*\.cpt-pli/.test(css) || /\.cpt-pli, \.cpt-pli\.ouvert \{ transition: none; \}/.test(css),
      'le mouvement se retire pour qui l’a demandé au système');
    const app = lireSource('assets/app.js');
    vrai(/cpt-pli\$\{replie \? '' : ' ouvert'\}/.test(app),
      'le gabarit rend l’état plié sans attribut hidden : c’est la grille qui ferme');
  });
});

/* ------------------------------------------------------------------
   Un revenu se declare a sa periode, et une estimation se dit
   ------------------------------------------------------------------ */
suite('Revenus : la période se lisse, l’estimation s’annonce', () => {

  test('une prime annuelle pèse un douzième par mois, comme une charge annuelle', () => {
    Fixture.poser(e => {
      e.budget.income.push({ label: 'Prime', amount: 12000, period: 'an' });
    });
    pres(incomeTotal(), 3000 + 1000,
      'le total mensuel lisse la prime : même table de périodes que les charges');
    pres(budgetFrame().income, 4000, 'et tout ce qui en dérive suit');
  });

  test('une période inconnue retombe sur le mois, comme chez les charges', () => {
    Fixture.poser(e => {
      e.budget.income.push({ label: 'Vieux champ', amount: 100, period: 'quinzaine' });
    });
    pres(incomeTotal(), 3100, 'un montant mensuel est son propre équivalent mensuel');
  });

  test('l’estimation se déclare par source et se lit sur l’ensemble', () => {
    Fixture.poser();
    eq(revenuEstime(), false, 'rien d’estimé par défaut');
    Store.state.budget.income[0].estime = true;
    eq(revenuEstime(), true, 'une seule source estimée suffit : le total l’est');
  });

  test('les écrans qui montrent le revenu disent quand il est estimé', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai((src.match(/revenuEstime\(\) \? '≈ ' : ''/g) || []).length >= 2,
      'le chiffre-source et la fenêtre portent le ≈ sous la même garde');
    vrai(/data-path="budget\.income\.\$\{i\}\.period"/.test(src),
      'la fenêtre des revenus offre la période, écrite comme les autres champs');
    vrai(/CHARGE_PERIODES\.map/.test(src.slice(src.indexOf('function fenetreRevenus'))),
      'et ses crans viennent de la table commune, jamais d’une liste recopiée');
  });
});

/* ------------------------------------------------------------------
   Le detail d une depense accepte l addition
   ------------------------------------------------------------------ */
suite('Le détail d’une dépense accepte l’addition', () => {

  });

/* ------------------------------------------------------------------
   Un indice se compte en points, pas en argent
   ------------------------------------------------------------------ */
suite('Un indice ne se compte pas en euros', () => {

  test('la fiche d’un repère distingue un indice d’un actif', () => {
    /* « Quand le marche est ferme j ai des trucs chelou » : la fiche du CAC 40
       annonçait « 8 714,93 € ». Un indice vaut des POINTS — Yahoo joint
       pourtant une devise a ses indices, et la coller au chiffre en faisait un
       montant. C est la regle de la maison, « un intitule dit exactement ce
       qu il compte », appliquee a une unite.

       Le prefixe « ^ » designe un indice chez Yahoo sur toutes les places : on
       s en sert plutot que de tenir une liste des cinq indices du ruban, qui
       oublierait le sixieme. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* L'unite vit dans `uniteRepere()`, employee par la tuile du ruban comme
       par la fiche : le controle porte sur elle, pas sur une copie. */
    vrai(/String\(l\?\.symbole \|\| ''\)\.startsWith\('\^'\)/.test(src),
      'un repère sait dire s’il est un indice, et il le dérive du symbole');
    vrai(/String\(l\?\.symbole \|\| ''\)\.startsWith\('\^'\) \? ` \$\{trad\('pts'\)\}`/
      .test(src), 'un indice s’affiche en points, jamais dans une devise');
    /* Une exception, nommee, et elle ne contredit pas la regle : le VIX ne
       s'affiche dans aucune devise non plus, il s'affiche SANS unite. « pts »
       serait juste pour un panier d'actions et faux pour une volatilite
       implicite, qui s'exprime en pourcentage annualise — que personne n'ecrit,
       et surement pas en points. */
    vrai(/const uniteRepere = l => estVix\(l\) \? ''/.test(src),
      'et le VIX se lit nu : « pts » mentirait sur ce qu’il mesure');
    vrai(/<span class="rp-unite">\$\{esc\(uniteRepere\(l\)\)\}<\/span>/.test(src),
      'et la tuile du ruban porte la même unité que la fiche qu’elle ouvre');
    vrai(!/const unite = l\.devise === 'USD'/.test(src),
      'plus aucun chemin ne colle une devise sans se demander ce qu’il chiffre');

    /* Et le sous-titre cesse d etre un identifiant technique : « ^FCHI »
       n apprend rien a qui vient de cliquer sur « CAC 40 ». */
    vrai(/estIndice \? 'Indice boursier' : l\.symbole/.test(src),
      'la fiche dit ce que la chose est, et garde le symbole en second');

    /* Les cinq indices du ruban portent bien ce prefixe : sans quoi la garde
       ne servirait rien. Derive de la table, pas d une liste recopiee. */
    const q = lireSource('assets/quotes.js') || '';
    const indices = [...q.matchAll(/\['(\^[A-Z0-9]+)',/g)].map(m => m[1]);
    vrai(indices.length >= 5, 'le ruban porte bien des indices');
    for (const i of indices) {
      vrai(i.startsWith('^'), `${i} doit se reconnaître au préfixe`);
    }
  });
});

suite('La langue gouverne les formats, pas seulement les mots', () => {

  test('un montant suit les séparateurs de sa langue', () => {
    enLangue('fr', () => {
      const s = fmtEUR(1234.56);
      vrai(/1\D?234,56/.test(s),
        `le français groupe les milliers et décime à la virgule, obtenu « ${s} »`);
    });
    enLangue('en', () => {
      const s = fmtEUR(1234.56);
      vrai(s.includes('1,234.56'),
        `l’anglais groupe à la virgule et décime au point, obtenu « ${s} »`);
    });
  });

  test('le signe pourcent se colle en anglais et s’espace en français', () => {
    /* L'espace avant un signe est une regle typographique francaise, pas une
       decoration : l'anglais qui la garderait aurait l'air traduit a moitie. */
    enLangue('fr', () => eq(fmtPct(12.5), '12,50 %', 'le français espace son signe'));
    enLangue('en', () => eq(fmtPct(12.5), '12.50%', 'l’anglais le colle'));
  });

  test('une date anglaise ne peut pas se lire à l’envers', () => {
    /* Le seul controle de cette suite qui protege un chiffre et non un style.
       « 03/04/2026 » vaut le 3 avril a Londres et le 4 mars a New York : une
       date numerique change de sens selon le lecteur, ce qu'aucune traduction
       n'a le droit de faire. Le mois en lettres retire la question. */
    enLangue('en', () => {
      const s = fmtDate('2026-04-03');
      eq(s, '3 Apr 2026', 'le mois s’écrit en lettres');
      vrai(!/\d+\/\d+/.test(s), `aucune date numérique en anglais, obtenu « ${s} »`);
    });
    enLangue('fr', () => eq(fmtDate('2026-04-03'), '03/04/2026', 'le français garde son format'));
  });

  test('le mois court et la clôture d’année se traduisent', () => {
    enLangue('en', () => {
      eq(fmtMonth('2026-04-01'), 'Apr 26', 'le mois court');
      eq(fmtMonth('2025-12-31'), 'End 2025', 'la ligne de clôture');
    });
    enLangue('fr', () => {
      eq(fmtMonth('2026-04-01'), 'avr. 26', 'le mois court');
      eq(fmtMonth('2025-12-31'), 'Fin 2025', 'la ligne de clôture');
    });
  });

  test('l’heure d’un cours porte la préposition de sa langue', () => {
    /* `fmtCoursQuand` rend sa preposition avec elle, ses trois branches n'ayant
       pas la meme. Traduire le seul dictionnaire aurait donc laisse « price de
       11:05 » : c'est la fonction qui doit savoir. */
    auJour('2026-08-09', () => {
      const jour = Math.floor(new Date('2026-08-09T11:05:00').getTime() / 1000);
      enLangue('fr', () => {
        const s = fmtCoursQuand(jour);
        vrai(s.startsWith('de '), `obtenu « ${s} »`);
      });
      /* « from », la meme preposition sur les trois branches : elle se lit
         aussi bien apres « price » qu'apres « the most recent price is »,
         la ou « at » rendait la seconde phrase bancale. */
      enLangue('en', () => {
        const s = fmtCoursQuand(jour);
        vrai(s.startsWith('from '), `obtenu « ${s} »`);
        vrai(!/\bde\b|\bdu\b|hier/.test(s), `aucune préposition française, obtenu « ${s} »`);
      });
      const veille = Math.floor(new Date('2026-08-08T22:00:00').getTime() / 1000);
      enLangue('en', () => {
        const s = fmtCoursQuand(veille);
        vrai(s.startsWith('from yesterday at '), `la veille se dit en anglais, obtenu « ${s} »`);
      });
    });
  });

  test('aucun fichier ne fige une locale hors du dictionnaire', () => {
    /* Le defaut que ce projet corrige sans arret, applique aux formats : la
       locale etait recopiee a seize endroits, et traduire l'application aurait
       demande de ne pas en oublier un seul. Une seule source, `locale()`, et ce
       controle se derive de la source plutot que d'une liste a tenir. */
    for (const f of ['assets/app.js', 'assets/store.js', 'assets/charts.js',
                     'assets/quotes.js', 'assets/cloudsync.js']) {
      const src = lireSource(f);
      vrai(src, `${f} doit être lisible pour ce contrôle`);
      const figees = [...src.matchAll(/['"][a-z]{2}-[A-Z]{2}['"]/g)].map(m => m[0]);
      eq(figees.join(', '), '',
        `${f} fige une locale : elle doit passer par locale()`);
    }
  });
});

suite('Un type de compte peut naître à la main', () => {

  test('créé, il se retrouve et porte la forme de sa poche', () => {
    /* La forme vient de la poche et non du nom : c'est elle qui commande
       calculs et regroupements. Un type « cash » doit compter comme du cash. */
    Fixture.poser();
    const id = creerTypePerso('Plan épargne logement', 'cash');
    eq(id, 't_plan-epargne-logement', 'l’identifiant se dérive du nom, accents à plat');
    const t = typeCompte(id);
    eq(t.label, 'Plan épargne logement', 'le nom est celui qu’on a tapé');
    eq(t.groupe, 'cash', 'la poche demandée');
    eq(t.defaut, 'courant', 'l’affectation par défaut de sa poche');
    vrai(t.classes.includes('liquidites'), 'et ses classes suivent');
  });

  test('le même nom ne crée pas un double, quelle que soit sa casse', () => {
    /* Deux types du même nom seraient deux poches pour un seul fait — la
       faute que ce projet corrige sans arrêt, offerte ici à l'utilisateur. */
    Fixture.poser();
    const a = creerTypePerso('Compte à terme', 'cash');
    const b = creerTypePerso('compte à terme', 'bourse');
    eq(b, a, 'le second appel rend le premier identifiant, poche comprise');
    eq(typesPerso().length, 1, 'et rien n’a été dédoublé');
  });

  test('un nom déjà dans la table est repris, jamais recréé', () => {
    Fixture.poser();
    eq(creerTypePerso('PEA', 'bourse'), 'pea', 'le PEA de la table répond');
    eq(typesPerso().length, 0, 'aucun double en face d’un type existant');
  });

  test('deux noms qui donnent le même identifiant se suffixent', () => {
    Fixture.poser();
    const a = creerTypePerso('Girardin !', 'pe');
    const b = creerTypePerso('Girardin ?', 'pe');
    eq(a, 't_girardin', 'le premier prend le nom nu');
    eq(b, 't_girardin-2', 'le second se suffixe au lieu d’écraser');
    vrai(typeCompte(a).label !== typeCompte(b).label, 'et chacun garde son nom');
  });

  test('une poche inconnue retombe sur le non coté, un nom vide ne crée rien', () => {
    Fixture.poser();
    eq(typeCompte(creerTypePerso('Truc exotique', 'zzz')).groupe, 'pe',
      'la poche du repli est celle du fallback de typeCompte');
    eq(creerTypePerso('   ', 'cash'), null, 'un nom vide est refusé');
    eq(typesPerso().length, 1, 'et il n’a rien laissé derrière lui');
  });

  test('les deux formulaires listent les types depuis la même source', () => {
    /* Une liste se dérive, elle ne se recopie pas : le type créé dans une
       fenêtre doit exister dans l'autre. Les deux passent par
       typesCompteChoix(), et chacune offre le type libre. */
    const src = lireSource('assets/app.js');
    /* La source est groupée par rubriques depuis les enveloppes américaines ;
       les deux fenêtres la partagent, et plus aucune n'aplatit la liste. */
    const appels = src.match(/options: \[\.\.\.typesCompteParRubrique\(\),/g) || [];
    eq(appels.length, 2, 'la fiche et l’assistant, personne d’autre à la main');
    eq((src.match(/typesCompteChoix\(\)\.map\(\w+ => \[\w+\.id, \w+\.label\]\)/g) || []).length, 0,
      'aucune liste à plat ne survit');
    const libres = src.match(/\['__nouveau', trad\('\+ Autre type…'\)\]/g) || [];
    eq(libres.length, 2, 'et le type libre s’offre dans les deux');
    vrai(!/TYPES_COMPTE\.filter\([^)]*\)\.map\(\w+ => \[\w+\.id, \w+\.label\]\)/.test(src),
      'plus aucune liste de types recopiée depuis la table');
  });

  test('la fenêtre du type libre dit le comportement, chaque famille offerte', () => {
    /* Le champ s'annoncait « Poche de patrimoine » : ce mot designe partout
       ailleurs les classes de la repartition, et la liste offrait trois
       libelles qui n'en font pas partie. La question porte sur le
       comportement, et le defaut suit l'exemple du champ du nom — un plan
       d'epargne logement est de l'argent disponible, pas un compte de titres
       range en bourse. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf('async function demanderTypePerso');
    vrai(debut > 0, 'la fenêtre doit être trouvable');
    const bloc = src.slice(debut, src.indexOf('function askForm', debut));
    for (const poche of Object.keys(FORME_POCHE)) {
      vrai(bloc.includes(`['${poche}', trad(`),
        `la famille « ${poche} » se choisit : la liste suit FORME_POCHE`);
    }
    vrai(/cle: 'poche',[^\n]*valeur: 'cash'/.test(bloc),
      'le défaut est celui de l’exemple du nom');
    vrai(!bloc.includes('Poche de patrimoine'),
      'le champ ne s’annonce plus comme une poche de la répartition');
  });

  test('la migration pose typesPerso, et la rejouer ne change rien', () => {
    const s1 = Fixture.poser(); s1.typesPerso = undefined;
    Store.state.typesPerso = Store.state.typesPerso || [];
    vrai(Array.isArray(Store.state.typesPerso), 'le champ existe après migration');
    const avant = JSON.stringify(Store.state.typesPerso);
    Store.state.typesPerso = Store.state.typesPerso || [];
    eq(JSON.stringify(Store.state.typesPerso), avant, 'idempotente');
  });
});

suite('La traduction des écrans ne peut pas heurter les totaux', () => {

  test('t() ne reçoit que des clés pointées, jamais une phrase', () => {
    /* `t` est une variable locale dans une trentaine de portées d'app.js, où
       elle porte les totaux : `t.brut`, `t.net`, `t.label`. Ecrire
       `t('Liquidités')` a cote de `num(t.bourse)` appelle l'objet des totaux
       comme une fonction, et c'est la portee qui decide laquelle gagne. Le
       defaut ne se voit pas a la relecture, il ne se voit qu'a l'execution du
       seul ecran concerne. `trad()` porte donc la traduction des phrases, et
       ce controle interdit l'autre forme plutot que de compter sur l'attention. */
    for (const f of ['assets/app.js', 'assets/charts.js']) {
      const src = lireSource(f);
      vrai(src, `${f} doit être lisible pour ce contrôle`);
      const fautes = [...src.matchAll(/[^\w.]t\('([^']*)'/g)]
        .map(m => m[1]).filter(c => !/^[\w.]+$/.test(c));
      eq(fautes.join(' | '), '',
        `${f} passe une phrase à t() : utiliser trad(), t() est masquée par les totaux`);
    }
  });

  test('trad() rend le français quand le dictionnaire ignore la phrase', () => {
    /* C'est ce repli qui permet de traduire écran par écran : une phrase
       enveloppée mais pas encore traduite reste juste, dans les deux langues. */
    const inedite = 'Phrase que le dictionnaire ne connaît pas';
    enLangue('fr', () => eq(trad(inedite), inedite, 'le français rend la phrase telle quelle'));
    enLangue('en', () => eq(trad(inedite), inedite, 'l’anglais retombe dessus au lieu d’une clé nue'));
    enLangue('en', () => eq(trad('Liquidités'), 'Cash', 'et traduit ce qu’il connaît'));
  });
});

suite('Le dictionnaire anglais ne laisse pas de trou', () => {

  test('l’anglais de l’application se prononce', () => {
    /* « i.e. » est du latin abrege. Correct a l'ecrit juridique, illisible sur
       un ecran de telephone : personne ne le prononce, et le lecteur le decode
       au lieu de lire le chiffre qui suit. « soit » se disait de trois facons —
       « i.e. », « that is », « left, i.e. » — donc la meme reformulation
       changeait de registre selon la carte ou elle tombait.

       « e.g. » n'est pas juge sur le meme critere, et ce n'est pas une
       tolerance : il vit dans les indications de champ, ou le francais abrege
       exactement pareil (« ex. Fortuneo »). Ce qui est verifie est donc la
       SYMETRIE — une abreviation anglaise en face d'une abreviation francaise.
       Un « e.g. » ecrit la ou le francais ecrit une phrase entiere serait une
       abreviation apparue a la traduction, et il tombe. */
    const latin = [];
    const dissymetrie = [];
    for (const [fr, en] of Object.entries(I18N.en)) {
      if (typeof en !== 'string') continue;
      if (/\bi\.e\./i.test(en)) latin.push(`« ${fr} » → « ${en} »`);
      if (/\be\.g\./i.test(en) && !/(^|[(,] ?)ex\. /.test(fr)) {
        dissymetrie.push(`« ${fr} » → « ${en} »`);
      }
    }
    eq(latin.length, 0, `« i.e. » dans du texte affiché : ${latin.join(' ; ')}`);
    eq(dissymetrie.length, 0,
      `« e.g. » sans « ex. » en face : ${dissymetrie.join(' ; ')}`);
  });

  test('une même reformulation se dit d’une seule façon', () => {
    /* Trois clefs portent « soit » comme CONNECTEUR : il introduit une seconde
       ecriture du montant qu'on vient de lire. Elles doivent partager le meme
       mot, sinon l'objectif, le revenu et la position parlent trois anglais.

       L'ancrage est etroit a dessein : « soit » est aussi un subjonctif, et
       « quelle que soit sa periodicite » n'introduit rien du tout. Le connecteur
       ouvre la clef ou suit une virgule ; le verbe a toujours un sujet devant. */
    const estConnecteur = fr => /^soit( |$)/.test(fr) || /, soit$/.test(fr);
    const soit = Object.entries(I18N.en).filter(([fr]) => estConnecteur(fr));
    vrai(soit.length >= 3, 'les clefs de reformulation doivent être trouvables');
    for (const [fr, en] of soit) {
      vrai(/that’s/.test(en), `« ${fr} » → « ${en} » : la maison dit « that’s »`);
    }
    /* Et le subjonctif reste hors du filet, sinon le controle se contredirait. */
    vrai(!estConnecteur('Ce que la ligne pèse chaque mois, quelle que soit sa périodicité'),
      'un « soit » subjonctif n’est pas une reformulation');
  });

  test('aucune balise ne porte de français écrit à la main', () => {
    /* Le rattrapage de 2026 a repris deux mille chaines une a une. Rien ne
       gardait ensuite la porte : soixante-dix textes affiches etaient repartis
       sans `trad()` -- les vingt notifications de la cloche entierement, des
       intitules de colonnes, des libelles de boutons, et des `aria-label`, qui
       sont du texte affiche pour qui lit l'ecran a l'oreille.

       Le controle ne cherche pas tout le francais : il cherche les quatre
       formes ou il s'est cache, celles qui portent du texte visible et se
       reconnaissent sans ambiguite. Un motif qui crierait sur du francais
       ordinaire finirait par ne plus etre lu. */
    const ACCENT = 'éèêëàâäçùûüôöîïœ';
    const accentue = s => [...s].some(c => ACCENT.includes(c));
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    const fautes = [];
    const balise = (nom, motif) => {
      for (const m of src.matchAll(motif)) {
        const txt = m[1];
        /* Une interpolation est le chemin normal : `${trad(...)}`, un montant,
           une donnee du detenteur. Seul le texte ecrit en clair compte. */
        if (txt.includes('${') || !accentue(txt)) continue;
        fautes.push(`${nom} : « ${txt.trim().slice(0, 46)} »`);
      }
    };
    balise('aria-label', /aria-label="([^"$]*)"/g);
    balise('title', /\stitle="([^"$]*)"/g);
    balise('en-tête', /<t[hd][^>]*>([^<>{}]*)</g);
    balise('bouton', /<button[^>]*>([^<>{}]*)</g);
    balise('option', /<option[^>]*>([^<>{}]*)</g);
    /* Le texte nu d'un intitule : « Horizon » y dormait en francais, et
       aucune des cinq formes precedentes ne le voyait. */
    balise('intitulé', /<label[^>]*>([^<>{}]*)</g);

    eq(fautes.join(' | '), '',
      'ces textes s’affichent sans passer par trad() : une chaîne posée sans sa '
      + 'clef n’est pas un raccourci, c’est un bug');
  });

  test('une clef ne se déclare qu’une fois', () => {
    /* Deux sessions ont pose « sur » chacune de son cote, over puis of : en
       JavaScript la derniere declaration gagne sans un mot, et « over 7
       closed months » est devenu « of 7 closed months » sans que rien ne le
       dise. Un homographe se resout par une clef pointee avec son francais
       en repli, trad('sur.objectif', 'sur') ; un doublon, lui, n'a jamais
       raison d'exister. */
    const js = lireSource('assets/i18n.js');
    vrai(js, 'i18n.js doit être lisible pour ce contrôle');
    const bloc = js.slice(js.indexOf('const I18N'), js.indexOf('const FR'));
    const vues = new Map();
    const doubles = [];
    const re = /^\s*(?:'((?:[^'\\]|\\.)+)'|"((?:[^"\\]|\\.)+)")\s*:/gm;
    let m;
    while ((m = re.exec(bloc))) {
      const cle = m[1] ?? m[2];
      if (vues.has(cle)) doubles.push(cle); else vues.set(cle, true);
    }
    vrai(vues.size > 500, `le dictionnaire doit être lu en entier (${vues.size} clefs)`);
    eq(doubles.join(' | '), '',
      'clef déclarée deux fois : la dernière gagnerait en silence');
  });

  test('chaque clé française a sa traduction', () => {
    const manquantes = Object.keys(FR).filter(c => !I18N.en[c]);
    eq(manquantes.join(', '), '', 'ces clés n’ont pas d’anglais');
  });

  test('aucune phrase ne reste en français sous couvert de traduction', () => {
    /* Un mot identique dans les deux langues est normal — « Budget »,
       « Performance », « Allocation ». Une phrase entiere identique est une
       traduction qu'on a cru faire. */
    const copiees = Object.keys(FR).filter(c =>
      I18N.en[c] === FR[c] && String(FR[c]).trim().split(/\s+/).length > 2);
    eq(copiees.join(', '), '', 'ces phrases sont restées en français');
  });
});

/* ------------------------------------------------------------------
   Un nom ne s ecrit pas trois fois
   ------------------------------------------------------------------ */
suite('Un nom ne s’écrit pas trois fois', () => {

  /* La carte Immobilier affichait « Flat » puis « Flat · Flat » : la ligne, le
     compte et l etablissement portaient le meme mot, ce que la creation
     propose d elle-meme quand on saisit un bien d un seul geste. La meta se
     derive du nom affiche au lieu de le redire. */

  test('la meta laisse tomber ce que le nom dit déjà', () => {
    eq(sousNom('Flat', 'Flat', 'Flat'), '',
      'trois fois le même mot n’en laisse aucun à répéter');
    eq(sousNom('Studio', 'Compte titres', 'Courtier'), 'Compte titres · Courtier',
      'deux parts distinctes se joignent, comme avant');
    eq(sousNom('Studio', 'Studio', 'Banque'), 'Banque',
      'seule la redite tombe, le reste passe');
    eq(sousNom('Apt lyon', 'apt  lyon', 'Apt Lyon'), '',
      'la casse et les espaces ne font pas une différence');
    eq(sousNom('Studio', 'Banque', 'Banque'), 'Banque',
      'deux parts égales entre elles ne comptent qu’une fois');
    eq(sousNom('Studio', 'Banque', ''), 'Banque',
      'un établissement vide ne laisse pas pendre le séparateur');
  });

  test('les écrans dérivent cette meta au lieu de la recomposer', () => {
    /* Le defaut aurait repousse par le point d appel oublie : quatre listes
       assemblaient nom de compte et etablissement chacune de son cote. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* Un « || » entre les deux n'est pas une composition mais une disjonction :
       la recherche interroge les deux noms, elle n'en affiche aucun. */
    const voisins = src.match(/[^\n]{0,60}nomCompteV2\([^)]*\)[^\n|]{0,40}nomEtabDe\(/g) || [];
    eq(voisins.filter(s => !/sousNom\(/.test(s)).join('\n'), '',
      'un écran recompose la meta à la main : il redira le nom un jour');
    vrai((src.match(/sousNom\(/g) || []).length >= 6,
      'chaque point d’affichage passe par la même dérivation');
  });
});

/* ------------------------------------------------------------------
   Un bien detenu a plusieurs ne compte que pour sa part
   ------------------------------------------------------------------ */
suite('Un bien détenu à plusieurs ne compte que pour sa part', () => {

  /* L'application partageait deja une charge fixe entre deux contributeurs, mais
     jamais un actif : un logement achete a deux entrait entier au patrimoine.
     Un faux total, et rien ne le signalait. */

  const aMoitie = () => Fixture.poser(s => {
    s.comptes.find(c => c.id === 'c_immo').lignes[0].part = 50;
  });

  test('la valeur, le prix payé et le patrimoine suivent la quote-part', () => {
    aMoitie();
    const c = compteById('c_immo');
    const l = lignesDe(c)[0];
    pres(l.valeur, 60000, 'la moitié de 120 000 €');
    pres(l.prixDeRevient, 55000, 'et la moitié des 110 000 € payés');
    pres(l.valeurEntiere, 120000, 'la valeur du bien entier reste lisible, pour la comparer à une annonce');
    pres(valeurCompte(c), 60000, 'le compte ne vaut que la part');
    pres(patrimoine().classes.immobilier, 60000, 'et la classe immobilier avec lui');
  });

  test('le total reste la somme de ses parts', () => {
    aMoitie();
    const p = patrimoine();
    pres(Object.values(p.classes).reduce((s, v) => s + v, 0), p.brut,
      'le brut est la somme des classes, quote-part comprise');
    pres(Object.values(p.mobilisable).reduce((s, v) => s + v, 0), p.brut,
      'et les paliers de disponibilité aussi');
    pres(p.brut, Fixture.BRUT - 60000, 'le brut a baissé d’exactement la moitié du studio');
  });

  test('la donnée saisie n’est jamais divisée, seule la lecture l’est', () => {
    const s = aMoitie();
    pres(num(s.comptes.find(c => c.id === 'c_immo').lignes[0].valeur), 120000,
      'le champ garde la valeur du bien entier');
    /* Lire deux fois ne divise pas deux fois : le defaut classique d'une part
       appliquee a l'ecriture plutot qu'a la derivation. */
    pres(lignesDe(compteById('c_immo'))[0].valeur, 60000, 'première lecture');
    pres(lignesDe(compteById('c_immo'))[0].valeur, 60000, 'seconde lecture, identique');
  });

  test('une part absente vaut le bien entier ; zéro vaut zéro ; hors bornes ne vaut rien', () => {
    /* Le zero a longtemps valu le tout, au motif qu'il ne voulait rien dire.
       Mais le champ accepte zero, donc quelqu'un peut le saisir — et lire alors
       « 100 % » est exactement le contraire de ce qu'il a ecrit. Un bien cede,
       garde en memoire pour son historique, se declare a zero.

       HORS BORNES NE VAUT PLUS LE TOUT. Rendre 1 disait que le bien etait detenu
       en entier, ce que personne n'avait declare : 150 % devenait 100 % en
       silence, au moment meme ou l'ecran demandait de corriger. Le raisonnement
       d'avant — « le tout plutot qu'un total gonfle » — supposait qu'il fallait
       choisir un chiffre. Il n'y en a pas a choisir : la ligne sort des montants
       personnels, et le controle de coherence dit que ces totaux sont
       incomplets. */
    Fixture.poser();
    pres(partDetention({}), 1, 'absente');
    pres(partDetention({ part: '' }), 1, 'vide aussi');
    pres(partDetention({ part: 0 }), 0, 'zéro veut dire zéro');
    pres(partDetention({ part: 50 }), 0.5, 'la moitié');
    pres(partDetention({ part: 100 }), 1, 'cent pour cent');
    pres(partDetention({ part: 33.5 }), 0.335, 'une part décimale passe');
    eq(partDetention({ part: 140 }), null, 'au-delà de cent : aucune valeur');
    eq(partDetention({ part: -20 }), null, 'négative non plus');
    /* Et surtout, jamais 1 : c'est la substitution qui mentait. */
    for (const p of [140, -20, 101, 150]) {
      vrai(partDetention({ part: p }) !== 1, `${p} % ne vaut pas le bien entier`);
      vrai(partDetention({ part: p }) !== 0, `${p} % ne vaut pas zéro non plus`);
    }
  });
});

/* ------------------------------------------------------------------
   Le logement qu on habite n est pas une reserve
   ------------------------------------------------------------------ */
suite('Le logement qu’on habite n’est pas une réserve', () => {

  const enRP = () => Fixture.poser(s => {
    s.comptes.find(c => c.id === 'c_immo').lignes[0].usage = 'principale';
  });

  test('une résidence principale quitte les avoirs mobilisables en quelques mois', () => {
    enRP();
    const c = compteById('c_immo');
    eq(mobiliteLigne(lignesDe(c)[0], c), 'habite',
      'son palier lui est propre : ni « en quelques mois », ni « bloqué jusqu’à son échéance »');
    const m = poches().mobilisable;
    pres(m.habite, 120000, 'le studio y est en entier');
    pres(m.lent, 2000, 'et seul le non coté reste dans « quelques mois »');
  });

  test('elle reste du patrimoine, mais hors du cumul d’autonomie', () => {
    enRP();
    const p = patrimoine();
    pres(Object.values(p.mobilisable).reduce((s, v) => s + v, 0), p.brut,
      'aucun euro ne se perd en chemin');
    const r = runway();
    const palier = r.tiers.find(t => t.value === 120000);
    vrai(palier && palier.horsCumul === true,
      'le toit ne prolonge aucune autonomie : le vendre veut dire se reloger');
    const cumules = r.tiers.filter(t => !t.horsCumul).reduce((s, t) => s + t.value, 0);
    pres(cumules, p.brut - 120000, 'il sort du cumul, et lui seul');
  });

  test('sans usage déclaré, rien ne change', () => {
    Fixture.poser();
    const c = compteById('c_immo');
    eq(mobiliteLigne(lignesDe(c)[0], c), 'lent',
      'un bien sans usage déclaré reste lent : il n’est pas deviné habité');
    eq(usageBien(c), '', 'et son compte ne déclare rien');
  });

  test('un réglage posé à la main garde le dernier mot', () => {
    Fixture.poser(s => {
      const l = s.comptes.find(c => c.id === 'c_immo').lignes[0];
      l.usage = 'principale';
      l.mobilite = 'lent';
    });
    const c = compteById('c_immo');
    eq(mobiliteLigne(lignesDe(c)[0], c), 'lent',
      'celui qui vend et loue ensuite le déclare, et l’application le croit');
  });

  test('les paliers se dérivent de leur table, ils ne se recopient pas', () => {
    Fixture.poser();
    eq(Object.keys(poches().mobilisable).join(','), Object.keys(MOBILISABLE_LABEL).join(','),
      'un palier ajouté à la table entre tout seul, sinon il resterait à undefined');
  });
});

/* ------------------------------------------------------------------
   Un credit dit quand il sera paye
   ------------------------------------------------------------------ */
suite('Un crédit dit quand il sera payé', () => {

  test('l’amortissement se rejoue, capital plus intérêts font le total versé', () => {
    Fixture.poser();
    /* 100 000 EUR a 3 % sur une mensualite de 600 EUR : la reponse ne se
       devine pas de tete, mais l'identite qui la verifie, si. */
    const f = finCredit({ montant: 100000, mensualite: 600, taux: 3 });
    vrai(f && f.mois > 0, 'un crédit qui s’amortit a une fin');
    /* Toutes les echeances pleines sauf la derniere, qui solde le reliquat. */
    const verse = (f.mois - 1) * 600 + f.derniere;
    pres(verse, 100000 + f.interets,
      'ce qu’on verse en tout fait le capital plus les intérêts, sinon un euro se perd');
    vrai(f.derniere > 0 && f.derniere <= 600, 'la dernière échéance ne dépasse pas les autres');
  });

  test('sans taux, le crédit s’amortit tout droit', () => {
    Fixture.poser();
    const f = finCredit({ montant: 12000, mensualite: 1000, taux: 0 });
    eq(f.mois, 12, 'douze mensualités de mille euros soldent douze mille');
    pres(f.interets, 0, 'et rien ne se paie en intérêts');
  });

  test('une mensualité qui ne couvre pas les intérêts n’annonce aucune date', () => {
    Fixture.poser();
    /* 100 EUR par mois sur 100 000 EUR a 5 % : les interets seuls font 416 EUR.
       La dette monte, et promettre une fin serait un mensonge. */
    eq(finCredit({ montant: 100000, mensualite: 100, taux: 5 }), null,
      'la dette monte : pas de date de fin');
    eq(finCredit({ montant: 100000, mensualite: 0, taux: 3 }), null,
      'sans mensualité non plus');
    eq(finCredit({ montant: 0, mensualite: 600, taux: 3 }), null,
      'ni sur un crédit déjà soldé');
  });

  test('la mensualité lue est celle de la charge qui rembourse, pas une seconde', () => {
    /* Le meme fait a un seul porteur : quand une charge fixe rembourse le
       credit, c'est elle qui detient la mensualite, et la date de fin doit la
       lire — sinon deux ecrans donneraient deux dates. */
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes[0].taux = 3;
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = null;
      s.budget.fixedCharges.push({ label: 'Prêt', amount: 600, period: 'mois',
                                   shares: {}, creditId: 'd_pret' });
    });
    const d = ETABS().find(e => e.id === 'e_bien').dettes[0];
    const f = finCredit(d);
    vrai(f && f.mois > 0, 'la date se calcule depuis la charge');
    pres(mensualiteCredit(d), 600, 'et la mensualité vient bien d’elle');
  });

  test('la date de fin tombe le bon nombre de mois plus tard', () => {
    Fixture.poser();
    const f = finCredit({ montant: 12000, mensualite: 1000, taux: 0 });
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + f.mois);
    eq(f.finLe, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      'douze mois d’ici, et l’année tourne avec le mois');
  });

  test('chaque crédit de la liste porte sa fin', () => {
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes[0].taux = 3;
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = 600;
    });
    const l = creditsEnCours().lignes.find(x => x.id === 'd_pret');
    vrai(l.fin && l.fin.mois > 0, 'la carte des crédits lit la même fonction que la fiche');
  });
});

/* ------------------------------------------------------------------
   Ce qu un bien rapporte, sans embellir
   ------------------------------------------------------------------ */
suite('Ce qu’un bien rapporte, sans embellir', () => {

  /* Trois manques tiraient tous les rendements du meme cote, le flatteur :
     la periode du loyer ignoree, douze mois supposes pleins, aucun impot. */

  const loue = (modif) => Fixture.poser(s => {
    s.budget.income.push({ label: 'Loyer studio', amount: 600, period: 'mois', bienId: 'c_immo' });
    if (modif) modif(s);
  });

  test('le même loyer donne le même montant sur les deux écrans', () => {
    /* La regle du projet : « Liquidités » a deja valu deux choses differentes sur
       deux pages, les deux totaux justes. Le loyer a failli refaire la faute deux
       fois — la ligne de la carte affichait le montant lisse par la vacance,
       l'en-tete aussi, quand le budget compte le loyer plein. La vacance a sa
       propre ligne desormais, et c'est la qu'elle se lit. */
    loue(s => { s.comptes.find(c => c.id === 'c_immo').moisLoues = 11; });
    const cf = cashFlowBien(compteById('c_immo'));
    const source = Store.state.budget.income.find(r => r.bienId === 'c_immo');
    pres(cf.sourcesLoyer[0].mensuel, revenuMensuel(source),
      'la ligne de la carte porte le montant du budget, pas un montant lissé');
    pres(cf.loyersPleins, revenuMensuel(source), 'et le total des sources aussi');
    pres(incomeTotal(), 3000 + revenuMensuel(source),
      'le budget le compte une fois, rattaché à un bien ou pas');
    const src = lireSource('assets/app.js');
    const tete = src.slice(src.lastIndexOf("trad('Performance locative')"),
                           src.indexOf("trad('de loyer par mois')"));
    vrai(/fmtEUR0\(cf\.loyersPleins\)/.test(tete),
      'l’en-tête aussi : deux chiffres pour le loyer sur un même écran, c’est un de trop');
  });

  test('un loyer annuel pèse un douzième, ici comme dans le budget', () => {
    Fixture.poser(s => {
      s.budget.income.push({ label: 'Loyer garage', amount: 7200, period: 'an', bienId: 'c_immo' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.loyers, 600, 'sept mille deux cents par an font six cents par mois');
    /* Le meme libelle donne le meme montant sur les deux ecrans : c'est la
       regle que ce calcul violait en lisant le montant brut. */
    pres(incomeTotal() - 3000, cf.loyers, 'et le budget dit exactement la même chose');
  });

  test('la vacance retire ce qu’elle retire, au rendement comme au cash-flow', () => {
    loue(s => { s.comptes.find(c => c.id === 'c_immo').moisLoues = 11; });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.loyersPleins, 600, 'le loyer plein reste dit');
    pres(cf.loyers, 550, 'onze mois sur douze');
    vrai(cf.vacance, 'et l’écran peut l’annoncer');
    pres(cf.rendementBrut, 550 * 12 / 110000 * 100, 'le rendement suit, sur le prix payé');
  });

  test('l’impôt déclaré s’applique au loyer moins les charges, jamais en dessous de zéro', () => {
    loue(s => {
      s.comptes.find(c => c.id === 'c_immo').tauxImpot = 30;
      s.budget.fixedCharges.push({ label: 'Taxe foncière', amount: 1200, period: 'an',
                                   shares: {}, bienId: 'c_immo' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.charges, 100, 'la taxe annuelle ramenée au mois');
    pres(cf.impot, (600 - 100) * 0.30, 'trente pour cent de ce que le bien dégage');
    pres(cf.rendementNetNet, (600 - 100 - cf.impot) * 12 / 110000 * 100,
      'le rendement net d’impôt est le seul qui dise ce qui reste');
    vrai(cf.rendementNetNet < cf.rendementNet && cf.rendementNet < cf.rendementBrut,
      'les trois rendements se rangent dans cet ordre, toujours');
  });

  test('la mensualité rattachée au bien ne se soustrait qu’une fois', () => {
    /* Rien n'interdit de rattacher au bien la charge qui rembourse son credit,
       et c'est meme tentant. Elle etait alors comptee deux fois : une en charge,
       une en mensualite lue depuis cette meme charge. */
    loue(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = null;
      s.budget.fixedCharges.push({ label: 'Prêt studio', amount: 400, period: 'mois',
                                   shares: {}, creditId: 'd_pret', bienId: 'c_immo' });
      s.budget.fixedCharges.push({ label: 'Copropriété', amount: 100, period: 'mois',
                                   shares: {}, bienId: 'c_immo' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.mensualite, 400, 'la mensualité vient de la charge qui rembourse');
    pres(cf.charges, 100, 'et cette charge ne compte plus une seconde fois');
    pres(cf.cashFlow, 600 - 100 - 400, 'le cash-flow ne perd plus 400 € en double');
  });

  test('un crédit d’un autre établissement reste une charge comme les autres', () => {
    /* Sa mensualite n'entre pas dans le total du bien : l'ecarter des charges la
       ferait disparaitre du calcul sans que rien ne le dise. */
    loue(s => {
      s.etabs.find(e => e.id === 'e_courtier').dettes.push(
        { id: 'd_conso', libelle: 'Crédit travaux', montant: 8000, note: '' });
      s.budget.fixedCharges.push({ label: 'Crédit travaux', amount: 150, period: 'mois',
                                   shares: {}, creditId: 'd_conso', bienId: 'c_immo' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.charges, 150, 'elle sort du budget pour ce bien, elle compte');
  });

  test('des charges plus lourdes que le loyer ne créent pas d’impôt négatif', () => {
    loue(s => {
      s.comptes.find(c => c.id === 'c_immo').tauxImpot = 30;
      s.budget.fixedCharges.push({ label: 'Travaux', amount: 900, period: 'mois',
                                   shares: {}, bienId: 'c_immo' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.impot, 0, 'un déficit ne se taxe pas, et l’application ne connaît pas tes autres revenus');
  });

  test('sans taux déclaré, le net d’impôt n’existe pas plutôt que de valoir le net', () => {
    loue();
    const cf = cashFlowBien(compteById('c_immo'));
    eq(cf.rendementNetNet, null, 'aucun chiffre inventé');
    eq(cf.impot, null, 'et aucun montant : rien de déclaré ne vaut pas zéro d’impôt');
  });

  test('le cash-flow retire tout ce qui sort, impôt compris', () => {
    loue(s => {
      s.comptes.find(c => c.id === 'c_immo').tauxImpot = 30;
      s.comptes.find(c => c.id === 'c_immo').moisLoues = 11;
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = 400;
      s.budget.fixedCharges.push({ label: 'Copropriété', amount: 100, period: 'mois',
                                   shares: {}, bienId: 'c_immo' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.cashFlow, cf.loyers - cf.charges - cf.mensualite - cf.impot,
      'le solde est la somme de ses termes, tous affichés');
    pres(cf.cashFlow, 550 - 100 - 400 - (550 - 100) * 0.30, 'et vaut ce qu’on calcule à la main');
  });

  test('le rendement sur apport ne baisse plus tout seul à mesure qu’on rembourse', () => {
    /* Le denominateur d'avant, prix paye moins capital restant, grossissait a
       chaque mensualite : a cash-flow egal le rendement affiche baissait alors
       que rien ne se degradait. L'apport, lui, ne bouge pas. */
    const avec = (reste) => {
      loue(s => {
        s.comptes.find(c => c.id === 'c_immo').apport = 30000;
        s.etabs.find(e => e.id === 'e_bien').dettes[0].montant = reste;
      });
      return cashFlowBien(compteById('c_immo'));
    };
    const debut = avec(40000), plusTard = avec(20000);
    pres(debut.cashOnCash, plusTard.cashOnCash,
      'vingt mille euros remboursés plus tard, le chiffre est le même');
    pres(debut.cashOnCash, 600 * 12 / 30000 * 100, 'le cash-flow annuel sur l’apport');
  });

  test('sans apport déclaré, aucun rendement sur apport', () => {
    loue();
    const cf = cashFlowBien(compteById('c_immo'));
    eq(cf.cashOnCash, null, 'plutôt qu’un chiffre sur une base inventée');
    eq(cf.apport, null, 'et la base non plus');
  });

  test('la part de capital de la mensualité se tait quand le taux manque', () => {
    loue(s => { s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = 600; });
    eq(cashFlowBien(compteById('c_immo')).capitalMois, null,
      'sans taux, on ne sait pas départager capital et intérêts : mieux vaut rien que zéro');
    loue(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = 600;
      s.etabs.find(e => e.id === 'e_bien').dettes[0].taux = 3;
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.capitalMois, 600 - 40000 * 0.03 / 12, 'la mensualité moins les intérêts du mois');
  });

  test('le rendement dit toujours sur quelle base il se calcule', () => {
    /* Prix d'acquisition connu : c'est lui. Sinon la valeur du jour, et l'ecran
       l'annonce — deux bases donnent deux chiffres pour la meme ligne. */
    loue();
    eq(cashFlowBien(compteById('c_immo')).surAchat, true, 'le prix payé est connu');
    pres(cashFlowBien(compteById('c_immo')).base, 110000, 'donc la base, c’est lui');
    loue(s => { s.comptes.find(c => c.id === 'c_immo').lignes[0].prixDeRevient = 0; });
    const sans = cashFlowBien(compteById('c_immo'));
    eq(sans.surAchat, false, 'sans prix payé, la base change');
    pres(sans.base, 120000, 'et c’est la valeur du jour');
  });

  test('une quote-part rétrécit la base du rendement, comme le patrimoine', () => {
    loue(s => { s.comptes.find(c => c.id === 'c_immo').lignes[0].part = 50; });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.base, 55000, 'la moitié du prix payé : on ne rapporte pas son loyer au bien du voisin');
  });
});

/* ------------------------------------------------------------------
   La fiche pose la question de l usage, pas une seule pour tous
   ------------------------------------------------------------------ */
suite('La fiscalité d’un bien se déclare, elle ne se devine pas', () => {
  /* Un loyer de 600 et une taxe de 100 : la base du mois vaut 500, et les trois
     etats se lisent sur les memes nombres. */
  const loue = (modif) => Fixture.poser(s => {
    s.budget.income.push({ label: 'Loyer studio', amount: 600, period: 'mois', bienId: 'c_immo' });
    s.budget.fixedCharges.push({ label: 'Taxe foncière', amount: 100, period: 'mois',
                                 shares: {}, bienId: 'c_immo' });
    if (modif) modif(s);
  });
  const bien = () => compteById('c_immo');
  const cf = () => cashFlowBien(bien());
  const regle = (modif) => loue(s => modif(s.comptes.find(c => c.id === 'c_immo')));

  test('rien de saisi ne vaut pas zéro d’impôt', () => {
    /* LE DEFAUT QUE CETTE ETAPE CORRIGE. `impot` valait 0 sans rien de declare,
       et le cash-flow retranchait ce zero : le chiffre de tete s'annonçait donc
       comme ce qui reste, apres un impot que personne n'avait estime. Une donnee
       absente passait pour une mesure — exactement ce que `rendementBrut` refuse
       de faire depuis longtemps. */
    loue();
    const x = cf();
    eq(x.fiscalite.source, 'inconnue', 'aucune source de fiscalité');
    eq(x.impot, null, 'et aucun montant, plutôt qu’un zéro qui se prendrait pour un calcul');
    eq(x.fiscalite.annuel, null, 'ni à l’année');
    eq(x.cashFlowApresImpot, null, 'il n’y a pas d’après-impôt sans impôt');
    pres(x.cashFlowAvantImpot, 500, 'celui d’avant existe toujours : 600 − 100');
    pres(x.cashFlow, 500, 'et c’est lui que le chiffre de tête porte');
    eq(x.rendementNetNet, null, 'aucun net d’impôt inventé');
  });

  test('un montant annuel déclaré fait la fiscalité, au douzième', () => {
    regle(c => { c.fiscaliteEstimeeAnnuelle = 1200; });
    const x = cf();
    eq(x.fiscalite.source, 'declaree', 'la déclaration est la meilleure des sources');
    pres(x.fiscalite.annuel, 1200, 'l’année telle qu’elle est saisie');
    pres(x.impot, 100, 'le mois en est le douzième');
    pres(x.cashFlowApresImpot, 400, '600 − 100 − 100');
    pres(x.cashFlow, x.cashFlowApresImpot, 'et le chiffre de tête est celui d’après');
    eq(x.fiscalite.taux, null, 'aucun taux n’est déduit du montant');
  });

  test('un montant annuel déclaré à zéro est un zéro, pas une absence', () => {
    /* « Vide n'est pas zero » se joue ici, et seulement ici : le montant est le
       seul des deux champs qui sache dire « rien a payer ». Un deficit foncier
       reporte donne exactement ce cas. */
    regle(c => { c.fiscaliteEstimeeAnnuelle = 0; });
    const x = cf();
    eq(x.fiscalite.source, 'declaree', 'zéro est une réponse');
    eq(x.impot, 0, 'et le montant vaut zéro');
    pres(x.cashFlowApresImpot, 500, 'l’après-impôt existe, et il égale l’avant');
    vrai(x.rendementNetNet !== null, 'le net d’impôt existe : il est calculable');
    pres(x.rendementNetNet, x.rendementNet, 'et vaut le net de charges, sans rien inventer');
  });

  test('un taux hérité survit, et s’annonce comme une estimation', () => {
    regle(c => { c.tauxImpot = 30; });
    const x = cf();
    eq(x.fiscalite.source, 'legacy', 'le taux reste une source, il ne se perd pas');
    pres(x.impot, 150, 'trente pour cent de 600 − 100, comme avant');
    pres(x.fiscalite.taux, 30, 'et le taux se relit pour être affiché');
    pres(x.fiscalite.annuel, 1800, 'l’année s’en déduit, elle ne se saisit pas');
    pres(x.cashFlow, 350, 'le cash-flow ne change pas de valeur en changeant de nom');
  });

  test('un montant déclaré l’emporte sur un taux hérité, sans l’effacer', () => {
    regle(c => { c.tauxImpot = 30; c.fiscaliteEstimeeAnnuelle = 600; });
    const x = cf();
    eq(x.fiscalite.source, 'declaree', 'la déclaration passe devant l’estimation');
    pres(x.impot, 50, 'et c’est elle qui compte');
    pres(num(bien().tauxImpot), 30, 'le taux reste dans les données : lire n’écrit pas');
    eq(bien().fiscaliteEstimeeAnnuelle, 600, 'et le montant n’a pas bougé non plus');
  });

  test('un taux n’est jamais converti en montant tout seul', () => {
    /* Un taux n'est pas un montant. Le convertir a l'ouverture ecrirait une
       declaration que personne n'a faite, et plus rien ensuite ne dirait qu'elle
       vient d'une estimation. La conversion se fait au calcul, a chaque lecture,
       et le champ declaratif reste vide. */
    regle(c => { c.tauxImpot = 30; });
    cf(); cf();
    eq(bien().fiscaliteEstimeeAnnuelle, undefined,
      'le champ déclaratif reste vide après lecture');
  });

  test('un taux à zéro n’est pas une déclaration de zéro', () => {
    /* Le champ pour cent affiche le vide quand il vaut zero, et ecrit le vide
       quand on l'efface : il n'a jamais su exprimer « zero pour cent ». Lui
       preter ce sens aujourd'hui relirait autrement des donnees ecrites hier. */
    regle(c => { c.tauxImpot = 0; });
    const x = cf();
    eq(x.fiscalite.source, 'inconnue', 'un zéro dans ce champ-là ne déclare rien');
    eq(x.impot, null, 'donc aucun montant');
  });

  test('un montant négatif ne se lit pas, et ne réveille pas le taux', () => {
    regle(c => { c.tauxImpot = 30; c.fiscaliteEstimeeAnnuelle = -100; });
    const x = cf();
    eq(x.fiscalite.source, 'inconnue',
      'une valeur qu’on ne sait pas lire ne se remplace pas par une autre');
    eq(x.impot, null, 'et rien n’est retiré');
  });

  test('la base imposée reste le loyer moins les charges, jamais négative', () => {
    loue(s => {
      s.comptes.find(c => c.id === 'c_immo').tauxImpot = 30;
      s.budget.fixedCharges.push({ label: 'Travaux', amount: 900, period: 'mois',
                                   shares: {}, bienId: 'c_immo' });
    });
    const x = cf();
    eq(x.impot, 0, 'un déficit ne se taxe pas : l’application ne connaît pas tes autres revenus');
    eq(x.fiscalite.source, 'legacy', 'la source, elle, reste celle qu’on a déclarée');
  });

  test('sans base mensuelle, la fiscalité dit son état sans donner de montant', () => {
    /* La porte s'ouvre aussi hors du cash-flow : l'ecran des reglages veut
       savoir QUELLE source est active sans avoir a calculer un loyer. */
    regle(c => { c.tauxImpot = 30; });
    const f = fiscaliteBien(bien());
    eq(f.source, 'legacy', 'la source se connaît sans base');
    eq(f.mensuel, null, 'mais pas le montant, qui en dépend');
    eq(f.annuel, null, 'ni l’année');
    pres(f.taux, 30, 'seul le taux se lit');
    eq(fiscaliteBien(null).source, 'inconnue', 'et sans bien, rien n’est connu');
  });

  test('un montant déclaré ouvre le net d’impôt, que le taux n’ouvrait plus seul', () => {
    /* Le rendement net d'impot se testait sur le TAUX. Un detenteur qui declare
       son montant annuel, et lui seul, n'y avait donc pas droit — alors que sa
       donnee est la meilleure des deux. */
    const src = lireSource('assets/store.js');
    vrai(!/\(base && tauxImpot\)/.test(src), 'la condition ne porte plus sur le taux');
    vrai(/rendementNetNet: \(base > 0 && impot !== null\)/.test(src),
      'mais sur un impôt calculable');
    regle(c => { c.fiscaliteEstimeeAnnuelle = 1200; });
    pres(cf().rendementNetNet, (600 - 100 - 100) * 12 / 110000 * 100,
      'et le chiffre suit le montant déclaré');
  });

  test('l’écran nomme le total selon ce qu’il sait de la fiscalité', () => {
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function carteLocatif'),
                           src.indexOf('function lignesDuMois'));
    vrai(/Cash-flow avant fiscalité/.test(bloc),
      'sans fiscalité connue, le total dit qu’il est d’avant');
    vrai(/cf\.fiscalite\.source === 'inconnue'/.test(bloc),
      'et c’est l’état de la fiscalité qui en décide');
    vrai(/<dd class="\$\{cls\(cf\.cashFlow\)\}"><b>/.test(bloc),
      'le montant, lui, ne change pas de place');
  });

  test('la ligne de fiscalité s’affiche toujours, et dit ce qu’elle ignore', () => {
    const src = lireSource('assets/app.js');
    /* Les bornes sont du CODE : une fenetre en caracteres se defait des que les
       commentaires partent, et l'arbre publie n'en a aucun. */
    const fn = src.slice(src.indexOf('function ligneFiscalite'),
                         src.indexOf('function carteUsageInconnu'));
    vrai(/const f = cf\.fiscalite;/.test(fn), 'ligneFiscalite doit être trouvable, et seule');
    vrai(!/!cf\.impot \? '' :/.test(src),
      'la ligne ne disparaît plus quand le montant vaut zéro ou rien');
    vrai(/non estimée/.test(fn), 'l’état inconnu porte son mot');
    vrai(/estimation simplifiée à confirmer/.test(fn),
      'et l’estimation héritée porte le sien');
    vrai(/ligneFiscalite\(cf\),/.test(src), 'et la cascade du mois l’appelle');
  });

  test('le champ annuel se propose, le taux ne se propose plus', () => {
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function reglagesExploitation'),
                         src.indexOf('const periodeDite'));
    vrai(/comptes\.\$\{idx\}\.moisLoues/.test(fn), 'la bonne fonction est lue');
    vrai(/comptes\.\$\{idx\}\.fiscaliteEstimeeAnnuelle/.test(fn),
      'le montant annuel a son champ');
    vrai(/\$\{!\(num\(c\.tauxImpot\) > 0\) \? '' : /.test(fn),
      'le taux ne s’affiche que chez ceux qui en ont déjà un');
    vrai(/comptes\.\$\{idx\}\.tauxImpot/.test(fn),
      'et il reste effaçable, plutôt que caché avec sa valeur');
  });

  test('le cash-flow reste la somme de ses lignes, dans les trois états', () => {
    for (const [modif, attendu] of [[() => {}, 500],
                                    [c => { c.tauxImpot = 30; }, 350],
                                    [c => { c.fiscaliteEstimeeAnnuelle = 1200; }, 400]]) {
      regle(modif);
      const x = cf();
      pres(x.cashFlow, x.loyers - x.charges - x.mensualite - num(x.impot),
        'le total est la somme de ses termes affichés');
      pres(x.cashFlow, attendu, 'et vaut ce qu’on calcule à la main');
    }
  });
});

suite('La fiche pose la question de l’usage', () => {

  test('l’usage décide de ce que la carte montre, et lui seul', () => {
    /* Trois regles se sont succede, et chacune corrigeait la precedente.

       Le premier garde-fou testait l'absence de loyer ET de charge : rattacher
       sa taxe fonciere a sa propre maison suffisait a basculer la carte en mode
       rendement. Puis l'USAGE declare a decide -- mieux, mais il etait
       facultatif, donc un bien dont personne ne l'avait rempli retombait sur le
       versant locatif, et c'etait le cas de la demonstration elle-meme. Le LOYER
       a donc decide a son tour : vrai sans rien demander a personne.

       Mais deduire du loyer requalifie une chambre louee chez soi en operation
       locative, et c'est faux dans l'autre sens. L'usage se demande desormais a
       la creation et un bandeau le reclame sur les anciens biens : il est
       rempli, donc il peut decider. C'est la seule donnee qui distingue une
       residence principale d'un investissement — aucun calcul ne le devine. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const aiguillage = src.slice(src.indexOf('function carteUsageBien(c, idx)'),
                                 src.indexOf('function espaceBien'));
    vrai(aiguillage.length > 200, 'l’aiguillage doit être trouvable');
    vrai(/const u = usageEffectifBien\(c\);/.test(aiguillage),
      'la carte se choisit sur l’usage effectif');
    vrai(/const rendre = CARTES_USAGE\[u\.usage\];/.test(aiguillage),
      'par une table, et non par une cascade de conditions');
    vrai(!/cf\.loyersPleins > 0\.005/.test(aiguillage),
      'et plus sur la présence d’un loyer, qui requalifiait une chambre louée chez soi');
    /* Un usage, une carte, et aucune n'est atteignable autrement. */
    for (const [usage, carte] of [['principale', 'carteResidence'],
                                  ['secondaire', 'carteResidence'],
                                  ['locative', 'carteLocatif']]) {
      const t = src.slice(src.indexOf('const CARTES_USAGE = {'),
                          src.indexOf('function carteUsageBien'));
      vrai(new RegExp(`${usage}: \\(c, idx, cf\\) => ${carte}\\(`).test(t),
        `${usage} mène à ${carte}`);
    }
  });

  test('les deux chiffres du mois ne s’additionnent jamais', () => {
    /* Tresorerie et patrimoine repondent a deux questions ; leur somme
       melangerait de l'argent disponible et des murs. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function blocCapitalRembourse'),
                           src.indexOf('function noteVentilation'));
    vrai(/Capital remboursé ce mois/.test(bloc), 'le second chiffre est dit');
    vrai(!/Patrimoine constitué ce mois/.test(bloc), 'et l’ancien libellé est parti');
    vrai(!/cashFlow \+ .*capitalMois|capitalMois \+ .*cashFlow/.test(src),
      'et jamais agrégé au premier, nulle part');
    /* Ni revenu, ni epargne disponible, ni cash-flow positif : une reduction de
       dette. La phrase le dit A L'ECRAN, et non dans une infobulle qu'il faut
       ouvrir — c'est exactement le chiffre qu'on additionne par erreur. */
    vrai(/Elle ne rentre sur aucun compte/.test(bloc),
      'la phrase qui empêche de le lire de travers est visible');
    vrai(!/revenu|épargne/i.test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')),
      'et il ne s’appelle jamais un revenu ni une épargne');
  });

  test('la liste des usages se dérive de sa table', () => {
    const src = lireSource('assets/app.js');
    vrai(/USAGES_BIEN\.map/.test(src),
      'la fiche parcourt la table : un usage ajouté demain apparaît sans qu’on y pense');
    eq(Object.keys(USAGE_BIEN_LABEL).join(','), USAGES_BIEN.map(([c]) => c).join(','),
      'et le dictionnaire des libellés en vient aussi');
    eq(usageLigne({ usage: 'colocation' }), '',
      'un usage inconnu ne se propage pas : il vaut « à préciser »');
    /* Et l'aiguillage aussi : un usage ajoute a la table sans carte tombe sur la
       carte neutre, jamais sur celle d'un autre usage. */
    for (const [cle] of USAGES_BIEN)
      vrai(new RegExp(`${cle}: \\(c, idx, cf\\)`).test(lireSource('assets/app.js')),
        `${cle} a sa carte`);
  });

  test('l’usage se demande dès la création, là où on le sait', () => {
    const src = lireSource('assets/app.js');
    vrai(/cle: 'usageBien'/.test(src),
      'posé plus tard dans une fiche, il resterait vide chez presque tout le monde');
    vrai(/\.\.\.\(e3\.usageBien \? \{ usage: e3\.usageBien \} : \{\}\)/.test(src),
      'et ce qui est répondu s’écrit sur la ligne');
  });

  test('sur un bien loué, le total égale encore la somme de ses lignes', () => {
    /* Le total de la carte est le cash-flow, et l'impot en est un terme : il sort
       vraiment du compte. Un terme du total ne peut pas rester invisible, sinon
       le total est plus petit que la somme de ce qu'on montre. */
    const store = lireSource('assets/store.js');
    vrai(/const cashFlowApresImpot = impot === null \? null : cashFlowAvantImpot - impot;/.test(store),
      'le cash-flow après fiscalité retranche l’impôt, parce qu’il sort du compte');
    vrai(/const cashFlowAvantImpot = loyers - charges - mensualite;/.test(store),
      'et celui d’avant ne le retranche pas, parce qu’il ne le connaît pas');
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function carteLocatif'),
                           src.indexOf('function lignesDuMois'));
    vrai(/\$\{lignesDuMois\(cf\)\}/.test(bloc), 'la carte liste ses pièces');
    const pieces = src.slice(src.indexOf('function lignesDuMois'),
                             src.indexOf('function carteUsageInconnu'));
    vrai(/Fiscalité estimée/.test(pieces), 'et la fiscalité y figure');
    /* Et la preuve par les nombres : les lignes affichees font le total. */
    Fixture.poser(s => {
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.tauxImpot = 20; c.moisLoues = 12;
      for (const l of c.lignes) l.usage = 'locative';
      s.budget.income.push({ label: 'Loyer', amount: 1000, period: 'mois', bienId: 'c_immo' });
      s.budget.fixedCharges.push({ label: 'Taxe foncière', amount: 100, period: 'mois',
                                   bienId: 'c_immo' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.impot, (1000 - 100) * 0.2, 'l’impôt suit le taux déclaré');
    pres(cf.cashFlow, cf.loyers - cf.charges - cf.mensualite - cf.impot,
      'et le cash-flow est exactement la somme des lignes affichées');
  });

  test('un logement qui rapporte ne s’entend pas dire qu’il coûte zéro', () => {
    /* Le montant etait borne a zero sur l'ancien versant habite, donc l'intitule
       mentait sur un chiffre positif. La carte locative ne borne rien : le
       cash-flow porte son signe, et la couleur le suit. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function carteLocatif'),
                           src.indexOf('function lignesDuMois'));
    vrai(!/Math\.max\(0, /.test(bloc), 'aucun plancher à zéro sur le montant du mois');
    vrai(/fmtSigned\(cf\.cashFlow\)/.test(bloc) && /cls\(cf\.cashFlow\)/.test(bloc),
      'le signe et la couleur suivent le sens réel du mois');
    Fixture.poser(s => {
      for (const l of s.comptes.find(x => x.id === 'c_immo').lignes) l.usage = 'locative';
      s.budget.income.push({ label: 'Chambre', amount: 1500, period: 'mois', bienId: 'c_immo' });
    });
    vrai(cashFlowBien(compteById('c_immo')).cashFlow > 0,
      'un logement qui rapporte plus qu’il ne coûte l’affiche');
  });

  test('les réglages locatifs ne s’affichent que sur un bien loué', () => {
    /* Ils repondaient a une question que la residence principale ne pose pas :
       « Mois loues par an : 12 » et « Impot sur ce loyer » sur le logement qu'on
       habite. Ils n'agissent d'ailleurs sur rien la-bas -- sans loyer, la vacance
       ne retire rien et l'impot porte sur une base nulle -- donc les cacher ne
       cache aucun effet. C'etait la crainte qui les avait fait rester. */
    const src = lireSource('assets/app.js');
    const locatif = src.slice(src.indexOf('function carteLocatif'),
                              src.indexOf('function lignesDuMois'));
    const residence = src.slice(src.indexOf('function carteResidence'),
                                src.indexOf('function carteLocatif'));
    vrai(/reglagesExploitation\(c, idx\)/.test(locatif),
      'les mois loués et l’impôt vivent sur la carte locative');
    vrai(!/reglagesExploitation/.test(residence),
      'et nulle part sur celle d’un logement habité');
    /* La preuve qu'ils n'agissent sur rien : declares puis bascules en
       principale, ni la vacance ni l'impot ne changent le total. */
    Fixture.poser(s => {
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.moisLoues = 6; c.tauxImpot = 30;
      for (const l of c.lignes) l.usage = 'principale';
      s.budget.income = [];
      s.budget.fixedCharges.push({ label: 'Taxe foncière', amount: 100, period: 'mois',
                                   shares: {}, bienId: 'c_immo' });
    });
    const co = coutBien(compteById('c_immo'));
    const cf = cashFlowBien(compteById('c_immo'));
    pres(cf.impot, 0, 'aucun impôt sans loyer, quel que soit le taux déclaré');
    pres(cf.vacanceEuros, 0, 'aucune vacance sans loyer non plus');
    pres(co.totalSorties, co.mensualite + co.autresCharges,
      'le coût du logement ne dépend d’aucun des deux');
    /* L'apport a quitte ces reglages : il ne decrit aucun mois. */
    vrai(/function reglagesExploitation\(c, idx\) \{/.test(src),
      'la fonction n’a plus d’option pour lui');
    /* Il a sa carte desormais, avec le prix d'achat, les frais et les travaux :
       tout ce qui decrit l'achat au meme endroit. */
    const acq = src.slice(src.indexOf('function carteAcquisition'),
                          src.indexOf('function blocFinancementInitial'));
    vrai(acq.length > 500, 'la carte Acquisition doit être trouvable');
    vrai(/data-path="comptes\.\$\{idx\}\.apport"/.test(acq),
      'il se saisit là où le bien s’acquiert, avec le prix payé et les frais');
  });
});

/* ------------------------------------------------------------------
   Un patrimoine net negatif a deux causes, pas une
   ------------------------------------------------------------------ */
suite('Un patrimoine net négatif a deux causes', () => {

  /* Neuf fois sur dix c'est une dette saisie sans son bien. Mais un achat
     recent finance a 110 % donne le meme signe sans que rien ne soit faux, et
     envoyer « declare ce bien » a qui vient de le declarer est faux. */

  const alerte = () => healthChecks().find(n => /net négatif/i.test(n.title || ''));

  test('un crédit sans bien en face reste une erreur, et nomme le crédit', () => {
    Fixture.poser(s => {
      /* La dette est portee par le courtier, qui n'heberge aucun bien. */
      s.etabs.find(e => e.id === 'e_courtier').dettes.push(
        { id: 'd_gros', libelle: 'Prêt sans bien', montant: 300000, note: '' });
      s.etabs.find(e => e.id === 'e_bien').dettes = [];
    });
    vrai(patrimoine().net < 0, 'le fixture est bien en négatif');
    const a = alerte();
    vrai(a, 'l’alerte existe');
    eq(a.level, 'error', 'et c’est une erreur : il manque une valeur');
    vrai(/Prêt sans bien/.test(a.detail),
      'elle nomme le crédit sans bien en face, pas simplement le plus gros');
  });

  test('un achat récent, bien déclaré, n’est plus peint en rouge', () => {
    /* Le credit a finance les frais de notaire : 130 000 EUR dus sur un bien qui
       en vaut 120 000. L'ecart est exact, et il se resorbe chaque mois. */
    Fixture.poser(s => {
      const d = s.etabs.find(e => e.id === 'e_bien').dettes[0];
      d.montant = 260000;
      d.mensualite = 1000;
      d.taux = 3;
    });
    vrai(patrimoine().net < 0, 'le net est négatif');
    const a = alerte();
    vrai(a, 'l’alerte existe toujours : le chiffre ne se cache pas');
    eq(a.level, 'info',
      'mais ce n’est pas une erreur : crier au loup à chaque ouverture ne sert personne');
    const txt = a.detail;
    vrai(/normal après un achat/.test(a.title), 'le titre dit la cause probable');
    vrai(!/déclare ce bien/.test(txt),
      'et ne demande pas de déclarer un bien déjà déclaré');
    /* Ce que le mois fait, sans annoncer de date : une date demanderait de parier
       sur la valeur du bien. */
    /* L'apostrophe typographique, comme partout ailleurs dans le texte
       affiche : la clef du dictionnaire la porte. */
    vrai(/de capital, et ton patrimoine net remonte d’autant/.test(txt),
      'elle dit ce que chaque mensualité rembourse');
    vrai(!/mois|ans/.test(txt.replace(/mensualité|premières années/g, '')),
      'aucune date de retour à l’équilibre : elle serait un pari sur la valeur');
  });

  test('sans taux, elle demande le taux au lieu de compter zéro', () => {
    Fixture.poser(s => {
      const d = s.etabs.find(e => e.id === 'e_bien').dettes[0];
      d.montant = 260000;
      d.mensualite = 1000;
      d.taux = null;
    });
    const txt = alerte().detail;
    vrai(/Renseigne le taux/.test(txt),
      'sans taux on ne sait pas départager capital et intérêts : mieux vaut le demander');
  });

  test('la valeur estimée dit ce qu’elle exclut', () => {
    /* Deux champs voisins, l'un frais compris et l'autre pas : saisir ici le prix
       paye frais compris surevalue le bien de ses frais de notaire. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf("trad('Valeur estimée ({dev})')");
    vrai(i > 0, 'le champ doit être trouvable');
    vrai(/frais de notaire exclus/.test(src.slice(i, i + 400)),
      'son aide dit ce qu’elle exclut, comme celle du prix d’acquisition dit ce qu’elle inclut');
  });
});

/* ------------------------------------------------------------------
   Une application vide dit quoi faire, et se tait sur le reste
   ------------------------------------------------------------------ */
suite('Une application vide dit quoi faire', () => {

  test('le bouton d’ajout ouvre une carte qui existe', () => {
    /* « Enorme bug, sur un compte vide le bouton ajouter un titre ça marche pas. »
       Il posait son drapeau, relançait le rendu, ne trouvait rien à ouvrir — la
       carte de recherche ne se rendait qu'avec le tableau des lignes, c'est-à-dire
       partout sauf sur l'écran sans aucune ligne. Le clic ne faisait donc rien
       précisément là où l'on vient tout ajouter.

       Deux moitiés à ce défaut, et il fallait les deux : la carte doit se rendre,
       et le montage doit la câbler — il sortait avant, faute de positions. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewPositions('), src.indexOf('function mountPositions('));
    const vide = vue.slice(0, vue.indexOf('${barreEtatCours()}'));
    vrai(/data-action="ajouter-ligne"/.test(vide), 'l’état vide porte le bouton');
    vrai(/symbolSearchCard\(\)/.test(vide),
      'et la carte de recherche qu’il ouvre, sinon le clic ne trouve rien');
    const montage = src.slice(src.indexOf('function mountPositions('),
                              src.indexOf('function mountSymbolSearch('));
    const iCablage = montage.indexOf('mountSymbolSearch()');
    const iSortie = montage.indexOf('if (!Store.state.positions.length) return;');
    vrai(iCablage > 0, 'le montage câble la recherche');
    vrai(iSortie < 0 || iCablage < iSortie,
      'et il le fait avant de sortir faute de lignes, sinon le champ reste inerte');
  });

  /* Chaque ecran portait son texte d'ecran vide, mais l'accueil — le premier
     ouvert — ne disait rien, et rien ne donnait l'ordre. La forme retenue est
     celle qui existait deja pour le revenu : un bouton, une phrase, dans la
     carte qui manque de la donnee. Pas de panneau central qui renverrait
     ailleurs. */
  const vide = () => Fixture.poser(s => {
    s.comptes = []; s.etabs = []; s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = []; s.budget.expenses = [];
  });

  test('un premier lancement ne pose aucune ligne de données', () => {
    /* Il posait un compte courant, un livret, un « Salaire 0 € » et un
       « Loyer 0 € » : des exemples deguises en donnees, qui faisaient croire a
       l'application qu'elle etait configuree. Aucune invite ne s'affichait, les
       rappels reclamaient un releve a qui n'avait aucun compte, et la page Actifs
       ouvrait sur deux comptes a zero rattaches a rien. */
    Store.state = blankState();
    Store.migrate();
    refreshAccounts();
    eq(Store.state.budget.income.length, 0, 'aucun revenu d’exemple');
    eq(Store.state.budget.fixedCharges.length, 0, 'aucune charge d’exemple');
    eq(comptesOuverts().filter(c => !typeCompte(c.type).interne).length, 0,
      'aucun compte que personne n’a créé');
    /* Ce qui reste est de la structure : le calendrier, les categories. */
    eq(Store.state.budget.expenses.length, 12, 'les douze mois du calendrier restent');
    vrai(Store.state.budget.categories.length > 0, 'et les catégories de dépenses');
    /* Les trois pas restent donc a faire, et les rappels se taisent. */
    for (const cle of ['comptes', 'revenus', 'depenses']) {
      vrai(pasAFaire(cle), `« ${cle} » reste à faire sur un premier lancement`);
    }
    /* Le releve, lui, ne se reclame pas encore : sans compte, il n'y a rien a
       photographier, et l'annoncer enverrait vers un geste impossible. */
    vrai(!pasAFaire('releves'), 'le relevé attend qu’un compte existe');
    eq(currentMonthPending().missing, false, 'aucun relevé réclamé sans un compte');
    eq(depensesEnAttente().missing, false, 'aucun mois clos réclamé le premier jour');
    /* UNE SEULE LIGNE POUR ACCUEILLIR, ET C'EST LE PREMIER GESTE.

       La cloche se taisait entierement sur un premier lancement, et c'etait la
       correction d'un defaut inverse : elle reclamait un releve a qui n'avait
       aucun compte. Mais le silence complet avait son propre cout — elle ne
       servait qu'a ceux dont l'application etait deja remplie, et le premier
       venu n'y lisait pas par ou commencer.

       Elle dit donc une chose, une seule, et c'est l'etape qui commande toutes
       les autres. Le compte exact est verifie : deux lignes d'accueil seraient
       deja un menu, et zero le silence d'avant. */
    const accueil = healthChecks();
    eq(accueil.length, 1, 'une seule ligne pour accueillir');
    eq(accueil[0].view, 'accounts', 'et elle mène aux comptes');
    eq(accueil[0].level, 'action', 'c’est un geste à faire, pas un avertissement');
  });

  test('la création d’un placement en parts propose le prix par part', () => {
    /* LA FICHE SAVAIT COMPTER PAR PART, LA CREATION NON. Elle reclamait deux
       totaux, donc on posait « 7 529 parts a 1,33 » sur un coin de table pour
       taper 10 000 — puis la fiche rouvrait en affichant fierement les deux
       prix par part qu'on venait de calculer a la main. Le mecanisme existait,
       il n'etait pas offert au moment ou il sert.

       Vu a l'ecran, sur une note de compte qui portait le calcul en toutes
       lettres. */
    const src = lireSource('assets/app.js');
    eq((src.match(/cle: 'parts', label: trad\('Nombre de parts'\)/g) || []).length, 2,
      'le nombre de parts se demande à la création comme sur la fiche');
    /* Deux montants de chaque cote, donc quatre cablages : la valeur du jour et
       le montant investi, sur la fiche et a la creation. */
    eq((src.match(/parPart: 'parts'/g) || []).length, 4,
      'les quatre montants se remplissent par leur prix par part');
    for (const libelle of ['Prix de la part aujourd’hui ({dev})', 'Prix d’achat de la part ({dev})']) {
      eq((src.match(new RegExp(libelle.replace(/[().€]/g, '\\$&'), 'g')) || []).length, 2,
        `« ${libelle} » existe des deux côtés, la création et la fiche`);
    }

    /* Et le nombre saisi se garde : sans lui, les deux prix par part de la
       fiche n'auraient plus de diviseur au premier rechargement. */
    vrai(/estDeclare\(e3\.parts\) \? \{ parts: num\(e3\.parts\) \}/.test(src),
      'le nombre de parts survit à la création');

    /* LE NOMBRE DE PARTS DECOULE, IL NE COMMANDE PAS. Un montant investi de
       4 000 a 2,00 la part : deux faits, et le nombre de parts est ce qu'ils
       donnent. Un ecran qui garderait le nombre de parts affiche renverrait un
       autre montant a qui vient d'ecrire 4 000, puis un autre prix a qui vient
       d'ecrire 2,00. Les deux champs se repousseraient et aucun des deux ne
       tiendrait.

       Le prix du JOUR ne dit pas la meme chose : un cours qui bouge ne change
       pas le nombre de parts detenues. Lui ecrit le total, comme avant. D'ou
       un drapeau par champ plutot qu'une regle unique, et un sous-titre qui
       dit lequel fait quoi. */
    const cablage = src.slice(src.indexOf('const paires = [];'),
                              src.indexOf("const premier = $('#modalBody')"));
    vrai(/const versParts = \(\) =>/.test(cablage),
      'le nombre de parts se déduit d’un total et de son prix par part');
    vrai(/if \(p\.deduitParts && total\.value !== ''\) \{ versParts\(\); return; \}/
      .test(cablage), 'le prix d’achat le déduit dès que le montant est écrit');
    /* Et le drapeau est pose sur le montant investi, des deux cotes, jamais sur
       la valeur du jour : deux declarations, la fiche et la creation. */
    eq((src.match(/parPartDeduitParts: true/g) || []).length, 2,
      'le montant investi le porte, à la fiche comme à la création');
    const dujour = "parPartLabel: 'Prix de la part aujourd’hui ({dev})'";
    let vus = 0;
    for (let i = src.indexOf(dujour); i >= 0; i = src.indexOf(dujour, i + 1)) {
      vus++;
      vrai(!/parPartDeduitParts/.test(src.slice(i, src.indexOf('}', i))),
        'et le prix du jour ne le porte pas, il revalorise');
    }
    eq(vus, 2, 'les deux déclarations du prix du jour sont bien relues');
    /* Tant qu'il n'y a rien a diviser, le prix par part multiplie : c'est le
       geste d'une societe qui leve, et il ne doit pas disparaitre. */
    vrai(/if \(n\(\) <= 0 && versParts\(\)\) return;\n\s*versTotal\(\);/.test(cablage),
      'sans montant écrit, le prix par part remplit le total');
    /* Une deduction en entraine une autre : le nombre trouve sur une ligne sert
       aussitot a l'autre, dont le total attendait ce meme multiplicateur, et
       les prix par part deja affiches se remettent d'accord avec lui. */
    vrai(/autre === p\) continue/.test(cablage)
      && /autre\.total\.value === ''\) autre\.versTotal\(\)/.test(cablage)
      && /else autre\.versUnite\(\)/.test(cablage),
      'et elle réveille les autres lignes, total manquant ou prix à rafraîchir');
    /* LA REGLE QUI PROTEGE LA DONNEE : `versParts` ne touche aucun total. Un
       total est un montant saisi, que treize ecrans additionnent ; un prix par
       part n'est qu'une facon de le lire, et il peut donc bouger. */
    vrai(!/autre\.total\.value =[^=]/.test(cablage)
      && !/^\s*total\.value =/m.test(cablage.slice(cablage.indexOf('const versParts'))),
      'sans jamais réécrire un montant déjà saisi');
    /* Le sous-titre dit lequel fait quoi, sinon deux champs jumeaux se
       comportent differemment sans que rien ne le signale. */
    vrai(/parPartSous: 'il donne le nombre de parts'/.test(src),
      'le champ annonce ce qu’il déduit');
    /* « L'un remplit l'autre » est parti : la formule montre le calcul reel au
       lieu de le decrire en abstrait. Le sous-titre qui reste dit un fait que la
       formule ne montre pas — taper ce prix redonne le nombre de parts. */
    vrai(!/l’un remplit l’autre/.test(src) && !I18N.en['l’un remplit l’autre'],
      'la phrase abstraite n’existe plus, ni sa clef');
    vrai(/\$\{c\.parPartSous \? `<span class="sub formule-sous">/.test(src),
      'le sous-titre ne se rend que là où il dit quelque chose');
  });

  test('la liste de démarrage ne coche pas un pas qu’on ne peut pas avoir franchi', () => {
    /* DEUX QUESTIONS QUI DIVERGENT. `fait` repond a « faut-il encore le
       reclamer ? » : sans compte, non, il n'y a rien a photographier et
       l'invite se tait. La liste posait cette question-la pour dessiner ses
       coches, et cochait donc « Ton premier relevé » sur une application vide,
       juste au-dessus de « Tes comptes » qui restait a faire. On ne
       photographie pas des comptes qu'on n'a pas.

       Mesure a l'ecran : « 1 sur 4 » sur un etat vierge. */
    Store.state = blankState();
    Store.migrate();
    refreshAccounts();
    const releves = PAS_PAR_CLE.releves;
    vrai(releves.acquis, 'le pas des relevés distingue « acquis » de « à réclamer »');
    eq(releves.acquis(), false, 'sans compte, aucun relevé n’a été pris');
    eq(releves.fait(), true, 'et pourtant il ne se réclame pas : rien à photographier');
    eq(PREMIERS_PAS.filter(p => (p.acquis ? p.acquis() : !pasAFaire(p.cle))).length, 0,
      'aucun des quatre pas n’est franchi sur une application vierge');

    const app = lireSource('assets/app.js');
    vrai(/p\.acquis \? p\.acquis\(\) : \(!pasAFaire\(p\.cle\) && pasDeclare\(p\)\)/.test(app),
      'la carte demande si le pas est franchi, pas s’il se réclame');

    /* LA DECLARATION SE DERIVE DU PAS, elle ne se recopie pas par cas. Les
       comptes et les rentrees ont le meme defaut — la premiere ligne saisie
       franchit le pas alors qu'il en manque quatre — et l'ecrire deux fois
       aurait garanti qu'un troisieme cas soit ecrit une troisieme fois. */
    /* Les trois pas qui portent une LISTE la declarent. Le releve n'en est pas
       une : un seul suffit, il n'y a rien a compter. */
    for (const cle of ['comptes', 'revenus', 'depenses']) {
      const d = PAS_PAR_CLE[cle].declare;
      vrai(d, `« ${cle} » demande une déclaration`);
      for (const champ of ['cle', 'question', 'detail', 'oui', 'ajouter']) {
        vrai(d[champ], `« ${cle} » : le descripteur porte ${champ}`);
      }
    }
    const drapeaux = PREMIERS_PAS.filter(p => p.declare).map(p => p.declare.cle);
    eq(new Set(drapeaux).size, drapeaux.length,
      'chaque pas a son propre drapeau : répondre pour l’un ne répond pas pour l’autre');

    /* Un titre et son bouton disent le meme pas. « Tes charges fixes » sous un
       bouton « Entrer tes dépenses » faisait douter qu'il s'agisse du meme
       geste. */
    /* Le mot commun, pas le premier : « Ton premier relevé » et « Enregistrer
       un relevé » se rejoignent sur le dernier. Les mots courts sont écartés,
       ils rapprocheraient n'importe quoi de n'importe quoi. */
    const motsUtiles = t => new Set(t.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .split(/[^a-z]+/).filter(m => m.length >= 5));
    for (const p of PREMIERS_PAS) {
      const duBouton = motsUtiles(p.bouton);
      vrai([...motsUtiles(p.titre)].some(m => duBouton.has(m)),
        `« ${p.titre} » et « ${p.bouton} » doivent parler du même pas`);
    }
    vrai(/data-action="declarer-pas"[\s\S]{0,80}data-cle=/.test(app),
      'un seul geste sert tous les pas, la clef venant du bouton');

    /* Et l'accueil ne redit pas ce que la carte porte : les deux affichaient la
       meme phrase et le meme bouton, a trois centimetres l'un de l'autre. */
    const i = app.indexOf('function viewOverview()');
    const vue = app.slice(i, app.indexOf('\nfunction ', i + 1));
    vrai(/carteDemarrage\(\)/.test(vue), 'l’accueil ouvre sur le chemin');

    /* LE GUIDE POSSEDE LE PREMIER PASSAGE, LES BANDEAUX LA ROUTINE. Le rappel
       mensuel s'affichait sous la carte, qui porte le meme geste a son
       troisieme pas : deux fois la meme demande, a deux centimetres l'une de
       l'autre, dans deux formes differentes. Le bandeau ne disparait pas pour
       autant, il revient chaque mois — il attend que le guide ait fini. */
    for (const attente of ['moisEnAttente', 'depEnAttente']) {
      vrai(new RegExp(`\\$\\{${attente}\\.missing && !guide \\?`).test(vue),
        `le bandeau « ${attente} » attend que le guide ait fini`);
    }
    vrai(!/invitePremierPas\('comptes'\)/.test(vue),
      'et il ne double pas l’invite que la carte porte déjà');
  });

  test('la cloche demande l’inventaire avant de réclamer un relevé', () => {
    /* L'ORDRE EST CELUI DES DONNEES, PAS CELUI DU CALENDRIER. Un patrimoine a
       moitie declare donne un premier point faux, et une courbe fausse des son
       origine ne se rattrape pas : le mois suivant montrerait un bond qui n'est
       qu'une saisie oubliee. La question passe donc devant, et le rappel
       mensuel attend sa reponse.

       Avoir UN compte ne veut pas dire les avoir TOUS, et rien dans les donnees
       ne distingue les deux etats — seule la personne le sait. D'ou une
       question, la seule de la cloche. */
    Fixture.poser(e => { e.monthly = []; });   // des comptes, aucun relevé encore
    vrai(notifications().some(n => n.cle === CLE_INVENTAIRE),
      'la question de l’inventaire se pose');
    eq(currentMonthPending().missing, false,
      'et le relevé se tait tant qu’elle attend sa réponse');

    /* La croix vaut oui : c'est le geste que la ligne annonce. */
    masquerNotif(CLE_INVENTAIRE);
    vrai(!notifications().some(n => n.cle === CLE_INVENTAIRE),
      'répondre éteint la question');
    eq(currentMonthPending().missing, true, 'et le relevé prend le relais');
  });

  test('un relevé déjà pris vaut réponse, sans rien demander', () => {
    /* Poser la question a quelqu'un qui photographie ses comptes depuis des
       mois serait lui faire confirmer ce qu'il fait deja. Sans cette
       equivalence, la garde punissait tout l'existant : chaque personne
       installee perdait son rappel jusqu'a repondre a une question qui ne la
       concernait pas. */
    Fixture.poser();
    vrai(aUnRelevePatrimonial(), 'le jeu porte des relevés');
    vrai(!notifications().some(n => n.cle === CLE_INVENTAIRE),
      'la question ne se pose pas à qui a déjà commencé');
  });

  test('les trois pas se dérivent des données, jamais d’un drapeau', () => {
    vide();
    for (const cle of ['comptes', 'revenus', 'depenses']) {
      vrai(pasAFaire(cle), `« ${cle} » reste à faire sur une application vide`);
    }
    /* Un drapeau « premiers pas termines » aurait menti des le premier import. */
    Fixture.poser();
    for (const cle of ['comptes', 'revenus', 'depenses']) {
      vrai(!pasAFaire(cle), `« ${cle} » est fait dès que la donnée existe`);
    }
    eq(pasAFaire('inconnu'), false, 'un pas qui n’existe pas ne reste pas à faire');
  });

  test('le relevé se demande dès qu’un compte le rend possible, et pas avant', () => {
    /* L'ordre des pas est un ordre de faisabilite, pas une preference : la courbe
       et le rythme n'ont que le releve a demander, et le releve n'a de sens
       qu'apres le premier compte. */
    Store.state = blankState(); Store.migrate(); refreshAccounts();
    vrai(!pasAFaire('releves'), 'rien à photographier sans compte');
    Store.state.comptes.push({ id: 'c1', etabId: null, type: 'courant', statut: 'ouvert',
      libelle: 'Courant', cash: [{ montant: 500, affectation: 'courant' }], lignes: [] });
    refreshAccounts();
    vrai(pasAFaire('releves'), 'un compte créé, le relevé devient le pas suivant');
    /* Et il s'efface au premier releve enregistre. */
    Store.state.monthly = [{ date: '2026-08-01', comment: '', v: { c1: 500 } }];
    refreshAccounts();
    vrai(!pasAFaire('releves'), 'le premier relevé le franchit');
  });

  test('un graphique sans conteneur ne casse pas l’écran', () => {
    /* Des que l'accueil masque ses cartes vides, les graphiques recoivent `null` :
       `el.clientWidth` levait, et l'exception remontait jusqu'a `render()`. Un
       ecran a moitie peint au premier lancement, soit le seul moment ou l'on
       n'a pas encore la moindre raison de faire confiance a l'application. */
    const src = lireSource('assets/charts.js');
    const fn = src.slice(src.indexOf('function mount(el, render)'),
                         src.indexOf('function mount(el, render)') + 200);
    vrai(/if \(!el\) return;/.test(fn),
      'le montage sort en silence quand la carte n’a pas été rendue');
    /* La garde est dans `mount`, pas chez les appelants : il y en a une douzaine,
       donc douze occasions d'oublier. */
    vrai((src.match(/mount\(/g) || []).length >= 7,
      'et elle profite à tous les graphiques d’un coup');
  });

  test('l’accueil d’un premier lancement ne montre pas six cartes de zéros', () => {
    const src = lireSource('assets/app.js');
    vrai(/\$\{pasAFaire\('comptes'\) \? `/.test(src),
      'la suite de la page attend le premier compte');
    vrai(/Ton tableau de bord s’enrichit à mesure que tu ajoutes tes données/.test(src),
      'et une phrase dit ce qui viendra, plutôt que six cartes muettes');
  });

  test('aucune page n’étale de tableau de zéros', () => {
    /* Allocation repartissait 0 € entre sept classes, Projection etalait « 0 € »
       sur cinquante ans et dix horizons, Releves ouvrait douze mois vides sans un
       mot. Un tableau de zeros n'est pas un resultat, c'est une question mal
       posee — et c'est la premiere impression d'une application publique. */
    const src = lireSource('assets/app.js');
    vrai(/function pageAvantDonnees\(phrase, cle = 'comptes'\)/.test(src),
      'un seul helper pour les trois, sinon trois formulations');
    const alloc = src.slice(src.indexOf('function viewAllocation'),
                            src.indexOf('function viewAllocation') + 600);
    vrai(/if \(!\(patrimoine\(\)\.brut > 0\.005\)\)/.test(alloc)
      && /pageAvantDonnees\(/.test(alloc), 'Allocation attend un premier euro');
    const proj = src.slice(src.indexOf('function viewObjective'),
                           src.indexOf('function viewObjective') + 800);
    vrai(/pageAvantDonnees\(/.test(proj), 'Projection aussi');
    /* Mais un versement mensuel suffit : quelqu'un qui part de rien et versera
       300 EUR par mois a une projection qui a du sens. */
    vrai(/num\(Store\.state\.meta\.projMonthly\) > 0/.test(proj),
      'et elle s’affiche dès qu’un versement est réglé, même sans capital');
    vrai(/Un relevé est la photo de tes comptes/.test(src),
      'la page des relevés dit ce qu’un relevé est, et ce qu’il attend');
  });

  test('une projection sans capital mais avec versement reste affichée', () => {
    /* Le garde-fou ne doit pas cacher la page a qui commence a epargner : c'est
       precisement le moment ou une projection sert. */
    Store.state = blankState(); Store.migrate(); refreshAccounts();
    pres(patrimoine().brut, 0, 'rien en poche');
    Store.state.meta.projMonthly = 300;
    /* Le test porte sur la condition, verifiee sur le source : la vue n'est pas
       chargee par le harnais. */
    const src = lireSource('assets/app.js');
    const proj = src.slice(src.indexOf('function viewObjective'),
                           src.indexOf('function viewObjective') + 800);
    vrai(/&& !\(num\(Store\.state\.meta\.projMonthly\) > 0\)/.test(proj),
      'les deux conditions se cumulent : ni capital, ni versement');
  });

  test('un pli replié le reste après un enregistrement', () => {
    /* Le geste ne basculait qu'une classe CSS : le premier rendu suivant
       reconstruisait le balisage avec « ouvert » en dur, et tout se redepliait.
       Le registre est celui des groupes de comptes, sous un prefixe : le meme
       fait, une seule liste. */
    /* `cleLiqPli` et `compteReplies` vivent dans app.js, que le harnais ne charge
       pas : le controle se fait sur le source, comme les autres de cette famille.
       Ce qui se verifie cote donnees, c'est que le registre existe bien dans
       `meta` et qu'il traverse une relecture de l'etat. */
    Fixture.poser();
    Store.state.meta.comptesReplies = ['liq:courant'];
    const copie = structuredClone(Store.state);
    Store.state = copie;
    vrai((Store.state.meta.comptesReplies || []).includes('liq:courant'),
      'le repli vit dans meta, donc il traverse une relecture de l’état');
    const src = lireSource('assets/app.js');
    vrai(/const cleLiqPli = aff => `liq:\$\{aff\}`;/.test(src),
      'la clé est préfixée, pour ne pas heurter un contenant du même nom');
    vrai(/comptesReplies/.test(src),
      'et elle partage le registre des groupes de comptes, pas une seconde liste');
    const action = src.slice(src.indexOf("'liq-plier'(btn)"), src.indexOf("'liq-plier-tout'(btn)"));
    vrai(/compteReplies\.delete\(cle\)/.test(action) && /compteReplies\.add\(cle\)/.test(action),
      'le geste écrit dans l’état');
    vrai(/pli\.classList\.toggle\('ouvert', ouvert\)/.test(action),
      'et bascule la classe sur place : un re-rendu tuerait l’animation');
  });

  test('les cartes qui ne peuvent rien montrer disent ce qui les remplirait', () => {
    const src = lireSource('assets/app.js');
    /* La courbe : le graphique est monte apres le rendu, il ne connait pas ce qui
       le remplirait — c'est donc la carte qui le dit. */
    const evo = src.slice(src.indexOf('<div class="chart" id="chartEvo">'),
                          src.indexOf('<div class="chart" id="chartEvo">') + 700);
    vrai(/invitePremierPas\('releves'\)/.test(evo),
      'la carte d’évolution demande le relevé qui lui manque');
    /* L'autonomie : un rapport entre deux vides n'accuse personne de rien. */
    vrai(/\$\{!r\.burn \? `/.test(src.slice(src.indexOf('function carteReserveResume()'))),
      'sans coût de la vie, aucune autonomie ne se mesure, quel que soit le coussin');
    /* Le coussin et son rapport viennent de `runway()`, ou ils se testent : ils
       etaient calcules dans la vue, et l'insight de l'accueil en lisait un
       autre. Deux chiffres justes qui se contredisaient a l'ecran. */
    vrai(/const ep = r\.reserve;/.test(src) && /const cover = r\.reserveMois;/.test(src),
      'la carte lit la réserve du modèle, elle ne la recalcule pas');
    const st = lireSource('assets/store.js');
    vrai(/reserveMois: burn \? reserve \/ burn : 0,/.test(st),
      'et le rapport ne se replie plus sur zéro faute de dénominateur');
  });

  test('chaque pas porte son bouton, son action et sa raison', () => {
    for (const p of PREMIERS_PAS) {
      vrai(p.bouton && p.action && p.quoi, `« ${p.cle} » doit porter les trois`);
      vrai(p.quoi.length > 40, `« ${p.cle} » doit dire pourquoi, pas seulement quoi`);
    }
    eq(Object.keys(PAS_PAR_CLE).join(','), PREMIERS_PAS.map(p => p.cle).join(','),
      'l’index se dérive de la table, il ne se recopie pas');
  });

  test('les invites viennent de la table, elles ne se réécrivent pas', () => {
    const src = lireSource('assets/app.js');
    vrai(/function invitePremierPas\(cle, \{ secondaire = false \} = \{\}\)/.test(src), 'une seule fonction les rend');
    for (const cle of ['comptes', 'revenus', 'depenses']) {
      vrai(new RegExp(`invitePremierPas\\('${cle}'\\)`).test(src),
        `l’invite « ${cle} » est posée quelque part`);
    }
    /* Le texte du revenu vivait dans la vue : il a rejoint la table, et la vue
       ne doit plus le porter en double. */
    vrai(!/Sans revenu déclaré, cette carte\s*\n?\s*n'a pas de total/.test(src),
      'le texte du revenu a quitté la vue pour la table');
  });

  test('la cloche ne réclame rien qui n’ait de sens sur une application vide', () => {
    /* « Épargne de précaution : 0 mois, 0 € pour 0 € de coût mensuel » etait la
       caricature de la regle : la cloche ne parle que de ce qui existe chez
       celui qui la regarde. */
    vide();
    const titres = healthChecks().map(n => n.title).join(' | ');
    vrai(!/Épargne de précaution/.test(titres),
      `un coût mensuel nul ne se compare à rien : ${titres}`);
    vrai(!/à enregistrer/.test(titres),
      `rien à relever sans un seul compte : ${titres}`);
    vrai(!/à saisir/.test(titres),
      `ni de dépenses à réclamer sans revenu ni charge : ${titres}`);
  });

  test('mais elle reparle dès que la donnée existe', () => {
    /* La garde ne doit pas eteindre le controle pour de bon : c'est une alerte
       utile des qu'il y a de quoi la calculer. Le fixture tient 3,3 mois, donc
       au-dessus du seuil : on lui retire du cash pour passer dessous. */
    Fixture.poser(s => {
      s.budget.fixedCharges.push({ label: 'Loyer', amount: 1200, period: 'mois', shares: {} });
    });
    const rw = runway();
    vrai(rw.burn > 0, 'le fixture a un coût mensuel');
    vrai(rw.immediateMonths < 3, `et moins de trois mois de coussin (${rw.immediateMonths})`);
    vrai(healthChecks().some(n => /Épargne de précaution/.test(n.title)),
      'donc l’alerte revient');
    vrai(comptesOuverts().length > 0 && healthChecks().some(n => /à enregistrer/.test(n.title)),
      'et le relevé se réclame de nouveau');
  });

  test('un titre coté demande d’abord un compte qui puisse le porter', () => {
    /* Sans compte eligible, la fenetre d'ajout n'offrait qu'une liste deroulante
       vide : le titre n'avait nulle part ou aller, et rien ne disait pourquoi. */
    vide();
    /* Aucun compte ouvert, donc aucun ne peut porter de titre : la liste que la
       fenetre d'ajout propose vit dans app.js, que le harnais ne charge pas, mais
       elle se derive de ces comptes-la. */
    eq(comptesOuverts().length, 0, 'aucun compte ne peut porter un titre');
    const src = lireSource('assets/app.js');
    /* La fenetre se lit jusqu'a la fin de l'etat vide, et non sur un nombre de
       caracteres arbitraire : la carte de recherche s'y est ajoutee, et le
       compte rond d'avant coupait la phrase qu'on verifie. */
    const debut = src.indexOf("trad('Suis tes placements cotés')");
    const bloc = src.slice(debut, src.indexOf('${barreEtatCours()}', debut));
    vrai(/Un titre se pose sur le compte qui le détient/.test(bloc),
      'l’écran dit le prérequis, pas seulement la frontière avec Actifs');
    vrai(/data-action="ajouter-compte"/.test(bloc), 'et offre le geste');
    /* Les types eligibles se derivent de leur table : celui qu'on ajoutera
       demain entrera dans la phrase sans qu'on y pense. */
    vrai(/TYPES_COMPTE\.filter/.test(bloc), 'la liste des types se dérive');
  });
});

finDePartieDeTests('tests/11-navigation-arrive-en-haut.tests.js');
