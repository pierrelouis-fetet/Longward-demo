partieDeTests('tests/13-changer-perimetre-se-voit.tests.js');
/* ------------------------------------------------------------------
   La transition d'un perimetre a l'autre
   ------------------------------------------------------------------ */
suite('Changer de périmètre se voit, sans se rejouer tout seul', () => {

  /* Le harnais ne charge pas `charts.js` : le mouvement lui-meme se mesure dans
     un navigateur, et il l'a ete. Relevé image par image sur un patrimoine de
     30 000 EUR de financier plus un appartement de 300 000 :

       Financier -> Global   le repère 200 k EUR entre par le haut, y = -1010
                             puis -173, -38, 2, et se pose a 14 vers 520 ms.
       Global -> Financier   le repère 40 k EUR remonte, y = 219 -> 184 -> 125
                             -> 56 -> 18 -> 14, et la bande d'immobilier reste
                             tracée jusqu'a 447 ms avant d'etre retiree.
       Mouvement refusé      41 images, UNE seule position d'axe : rien ne bouge.

     Ce que ces controles gardent, c'est la mecanique qui rend ces mesures
     possibles — et surtout les deux pieges qui l'ont fait echouer en silence. */

  test('la courbe arrondit ses angles, jamais sa trajectoire', () => {
    /* Un releve par mois, et rien entre deux. Une spline ou une Bezier non
       monotone inventerait des sommets et des creux que personne n'a mesures,
       depasserait les valeurs relevees, et laisserait croire que l'application
       connait la trajectoire quotidienne. Ce qui s'adoucit est le RENDU des
       jonctions, pas le chemin : les segments restent rectilignes et passent
       exactement par leurs points.

       Le controle porte donc sur les deux moities de la regle. */
    const src = lireSource('assets/charts.js');
    vrai(src, 'assets/charts.js doit être lisible pour ce contrôle');
    const i = src.indexOf('function stackedArea');
    const aire = src.slice(i, src.indexOf('function donut', i));
    vrai(aire.length > 2000, 'la fonction doit être trouvable');

    /* 1. Aucun chemin courbe. `<polyline>` et `<polygon>` ne relient leurs
       points que par des droites : le seul moyen d'introduire une courbe serait
       un `<path>` avec un C, un S ou un Q. */
    /* Commentaires retires : celui qui explique pourquoi il n'y a pas de spline
       contient le mot, et un controle qui crie sur sa propre explication finit
       par etre desactive. */
    const codeAire = aire.replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/<path\b/.test(codeAire),
      'la pile se trace en polylignes : un <path> ouvrirait la porte aux courbes');
    for (const mot of ['curve', 'spline', 'basis', 'ezier', 'monotone']) {
      vrai(!codeAire.includes(mot),
        `« ${mot} » n’a rien à faire ici : la trajectoire ne se recalcule pas`);
    }

    /* 2. Les trois traits de la pile portent la meme jonction. Le lisere de fond
       ne l'avait pas : en `miter`, un angle aigu produit une pointe qui peut
       depasser de plusieurs pixels, et comme il est plus epais (2 px) que le
       trait de couleur qu'il souligne (1,75), cette pointe sortait du dessin sur
       les renversements francs. Deux traits arrondis et un troisieme anguleux se
       voient. */
    const traits = [...aire.matchAll(/<polyline[\s\S]*?\/>/g)].map(m => m[0])
      /* Ceux de la PILE : les deux traits de chaque bande, qui portent leur
         poche, et la ligne du total. Les pointilles de l'option `bande` ne sont
         pas de la partie — ils appartiennent aux scenarios de la Projection,
         qui trace un intervalle et non une trajectoire relevee. */
      .filter(t => /data-trait=/.test(t) || t.includes('${totalLine}'));
    vrai(traits.length >= 3, `trois traits attendus, ${traits.length} trouvés`);
    for (const t of traits) {
      vrai(/stroke-linejoin="round"/.test(t) && /stroke-linecap="round"/.test(t),
        'chaque trait de la pile arrondit ses jonctions : ' + t.slice(0, 60));
    }

    /* 3. Et la geometrie reste celle des points. `empiler()` ne fabrique que des
       couples « x,y » a partir des valeurs recues : aucun point intermediaire,
       aucune moyenne, aucun lissage. */
    const pile = src.slice(src.indexOf('function empiler(valeur, topC, cles'),
                           src.indexOf('const valeurDuPoint'));
    vrai(/\$\{x\(i\)\},\$\{yC\(v\)\}/.test(pile),
      'chaque sommet est un point reçu, placé tel quel');
    vrai(!/\/ 2|moyenne|lissage/.test(pile),
      'rien n’y interpole entre deux relevés');

    /* 4. Preuve par les nombres : autant de sommets que de points, ni plus. Le
       fixture porte un releve et la photo du jour, donc deux. */
    Fixture.poser();
    const pts = pointsEvolution({ net: true });
    vrai(pts.length >= 2, 'la série doit porter au moins deux points');
    /* `stackedArea` vit dans charts.js, que le harnais ne charge pas : on
       verifie que la source construit un sommet PAR point, sans en ajouter. */
    vrai(/haut: bas\.map\(\(v, i\) => `\$\{x\(i\)\},\$\{yC\(v\)\}`\)\.join\(' '\)/.test(pile),
      'un sommet par point de la série, et rien d’autre');
  });

  test('le souvenir du dessin se range par identifiant, jamais par nœud', () => {
    /* Le piege, et il ne levait aucune erreur. Une `WeakMap` clefee sur
       l'element etait le premier reflexe : `render()` reecrit le `innerHTML` de
       la vue entiere, donc le conteneur du rendu suivant est un AUTRE nœud, la
       clef n'existe plus, `get()` rend `undefined`, et la transition se pose
       d'un coup. Mesuree a l'image pres : deja arrivee a 13 ms. */
    const src = lireSource('assets/charts.js');
    vrai(src, 'assets/charts.js doit être lisible pour ce contrôle');
    vrai(/const dernierTrace = new Map\(\);/.test(src),
      'le souvenir est une Map de clefs stables');
    vrai(/const cleTrace = el => el\.id \|\| null;/.test(src),
      'et la clef est l’identifiant du conteneur');
    vrai(!/dernierTrace = new WeakMap/.test(src),
      'une WeakMap sur le nœud ne retiendrait rien d’un rendu à l’autre');
    /* Un conteneur sans identifiant ne se souvient de rien : la lecture ET
       l'ecriture sont gardees. */
    vrai(/if \(anime && cle && !mouvementRefuse\(\)\) animerDepuis/.test(src),
      'sans clef, pas de transition');
    vrai(/if \(cle\) dernierTrace\.set\(cle,/.test(src),
      'et rien à retenir non plus');
  });

  test('la transition ne se rejoue ni au redimensionnement ni à la frappe', () => {
    /* Deux gardes, a deux etages, et il faut les deux.

       Cote graphique : le registre rejoue le rendu a chaque redimensionnement,
       avec les mêmes options. Un drapeau lu dans `opts` a chaque fois aurait
       rejoue la transition en tirant sur le coin de la fenetre.

       Cote vue : `render()` remonte le graphique a chaque frappe et a chaque
       changement de plage. Le drapeau se leve sur le seul geste qui change le
       cadrage, et le montage le consomme. C'est la regle deja posee pour le
       balayage d'arrivee, qui ne joue que sous `.vue-entre`. */
    const charts = lireSource('assets/charts.js');
    vrai(/let anime = !!opts\.anime;/.test(charts),
      'le drapeau est copié hors du rendu');
    vrai(/\n      anime = false;/.test(charts),
      'et éteint après le premier, sinon un redimensionnement le rejouerait');

    const app = lireSource('assets/app.js');
    /* La fenetre s'arrete a la fin de la fonction, jamais a un nombre de
       caracteres : un commentaire ajoute au milieu pousse l'appel dehors, et le
       test devient rouge sans qu'aucun comportement n'ait change. */
    const debutMontage = app.indexOf('function monterEvolution()');
    const montage = app.slice(debutMontage, app.indexOf('\n}', debutMontage));
    vrai(/const anime = evoTransition;\s*\n\s*evoTransition = false;/.test(montage),
      'le montage consomme le drapeau, il ne le lit pas');
    vrai(/Charts\.stackedArea\(cible, \{ points, height: 300, series, anime, parts: true \}\)/.test(montage),
      'et le passe au graphique, avec les parts que l’infobulle affiche');
    /* DEUX gestes le levent, et ils se nomment ici. Cette barriere a fait son
       travail le jour ou le second est arrive : elle a refuse le changement
       jusqu'a ce qu'il soit declare. Un troisieme devra passer par la meme
       porte — c'est ce qui empeche « on anime aussi ce cas-la » de se glisser
       sans qu'on ait pese la fatigue que ca ajoute.

       Les deux changent ce que la COURBE montre : le perimetre change les
       poches empilees, net/brut change ce qu'on en retranche. Un geste qui ne
       toucherait pas a la courbe n'a rien a faire dans cette liste. */
    const sansCom = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    /* TROIS, ET LE TROISIEME A DU SE DECLARER ICI POUR PASSER — c'est le role de
       cette barriere, et elle l'a joue. La plage change ce que la courbe montre
       autant que les deux autres : elle en change la PERIODE. Ce qu'elle
       declenche n'est pas la meme chose pour autant — les abscisses changent,
       donc le dessin se redecouvre au lieu de se deformer, et c'est le graphique
       qui en decide. */
    eq((sansCom.match(/evoTransition = true/g) || []).length, 3,
      'trois gestes déclenchent une transition de la courbe');
    for (const geste of ["'evo-perimetre'(btn) {", "'hero-base'(btn) {", "'evo-range'(btn) {"]) {
      const i = sansCom.indexOf(geste);
      vrai(i > 0, `${geste} doit être trouvable`);
      vrai(/evoTransition = true/.test(sansCom.slice(i, i + 400)),
        `${geste} lève le drapeau de la courbe`);
    }
  });

  test('recliquer le bouton déjà allumé n’anime rien', () => {
    /* Une transition de zéro vers zéro est un clignotement, et le bouton actif
       reste cliquable — rien dans le balisage ne l'en empêche. */
    const app = lireSource('assets/app.js');
    const action = membreAction(app, 'evo-perimetre');
    vrai(/if \(voulu === evoFinancier\) return;/.test(action),
      'le même périmètre ressort tout de suite');
    vrai(action.indexOf('return;') < action.indexOf('evoTransition = true'),
      'et avant de lever le drapeau');
  });

  test('le mouvement refusé est respecté, et relu à chaque fois', () => {
    /* Le reglage se change sans recharger la page : une valeur figee au
       chargement aurait continue d'animer chez quelqu'un qui vient de demander
       l'arret. */
    const src = lireSource('assets/charts.js');
    vrai(/const mouvementRefuse = \(\) =>/.test(src),
      'c’est une fonction, donc relue à chaque appel');
    vrai(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(src),
      'et elle lit la préférence du système');
    /* La feuille de style tient la même règle pour le balayage d'arrivee : les
       deux mouvements du graphique s'arretent ensemble. */
    const css = lireSource('assets/styles.css');
    /* Les DEUX balayages s'arretent ensemble : celui de l'arrivee sur la vue et
       celui qu'un changement de plage rejoue. Ils partagent la meme regle, donc
       ils ne peuvent pas diverger. */
    vrai(/@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.vue-entre \.chart-trace,\s*\n\s*\.chart-trace\.chart-rejoue \{ animation: none; \}/.test(css),
      'les deux balayages du graphique s’arrêtent aussi');
    /* Et la garde JavaScript vaut pour les deux : elle entoure le choix entre
       deformer et redecouvrir, pas seulement le premier. */
    vrai(/!mouvementRefuse\(\)\s*\n?\s*&& !animerDepuis\(dernierTrace\.get\(cle\)\)\) balayer\(\);/.test(src),
      'et aucun des deux ne part si le système refuse le mouvement');
  });

  test('un seul empilement sert le dessin et chacune de ses images', () => {
    /* Le dessin etait empile une fois, en ligne, ce qui suffisait tant qu'il ne
       bougeait plus apres sa pose. L'animation en redemande une image par frame,
       avec d'autres valeurs et une autre echelle. Deux ecritures du meme
       empilement auraient fini par ne plus empiler pareil, et l'ecart ne se
       verrait que pendant la demi-seconde de la transition — donc jamais. */
    const src = lireSource('assets/charts.js');
    vrai(/function empiler\(valeur, topC, cles/.test(src),
      'la géométrie des bandes vit dans une fonction');
    vrai((src.match(/empiler\(/g) || []).length >= 3,
      'et le rendu comme les images de la transition l’appellent');
    /* Les crochets que la transition attrape. Sans eux elle compterait les
       enfants, ce qu'un trait absent fausse — une bande trop mince en pose deux
       de moins que sa voisine. */
    vrai(/data-bande="\$\{esc\(sr\.key\)\}"/.test(src),
      'chaque bande porte sa poche');
    vrai(/data-trait="\$\{esc\(sr\.key\)\}"/.test(src),
      'et ses traits aussi');
    vrai(/data-tick="\$\{t\}"/.test(src),
      'chaque repère d’axe porte sa valeur, pour se replacer à l’échelle du moment');
  });

  test('une bande qui s’en va reste tracée le temps de partir', () => {
    /* Elle n'existe pas dans le dessin d'arrivee : sans ce rattrapage,
       l'immobilier disparaitrait au premier instant et la moitie du mouvement
       ne se verrait pas. Mesure : la bande tient jusqu'a 447 ms puis part. */
    const src = lireSource('assets/charts.js');
    const fn = src.slice(src.indexOf('function animerDepuis(avant) {'),
                         src.indexOf('const tip = ensureTip(el);'));
    vrai(fn.length > 500, 'animerDepuis doit être trouvable');
    vrai(/const partantes = cles\.filter\(k => !ordre\.includes\(k\)\);/.test(fn),
      'les poches qui quittent la pile sont nommées');
    vrai(/trace\.insertBefore\(poly, apres\)/.test(fn),
      'et reposées à leur rang : l’ordre de peinture est l’ordre d’empilement');
    vrai(/for \(const t of temporaires\) t\.remove\(\);/.test(fn),
      'puis retirées à l’arrivée');
    /* L'arrivee est le dessin exact, pas la derniere image calculee : une image
       a 0,999 laisse des demi-pixels d'ecart, et c'est ce dessin-la qui reste a
       l'ecran jusqu'au prochain montage. */
    vrai(/const finir = \(\) => \{/.test(fn) && /geo\.bandes\.forEach/.test(fn),
      'la dernière image est le dessin d’arrivée, recalculé et non interpolé');
  });

  test('la transition s’interrompt au premier geste', () => {
    /* Le curseur lit les valeurs d'arrivee des le premier instant : une
       animation qui continue sous le doigt fait mentir l'infobulle. */
    const src = lireSource('assets/charts.js');
    vrai(/svgEl\.addEventListener\('pointerdown', finir, \{ once: true \}\)/.test(src),
      'un appui la termine');
    vrai(/svgEl\.addEventListener\('pointermove', finir, \{ once: true \}\)/.test(src),
      'un survol aussi');
  });

  test('deux dessins qui ne parlent pas des mêmes mois ne se fondent pas', () => {
    /* Changer de plage en même temps que de périmètre glisserait une courbe sur
       une autre abscisse : un mouvement qui ne veut rien dire. */
    const src = lireSource('assets/charts.js');
    vrai(/if \(avant\.dates !== points\.map\(p => p\.date \|\| p\.label\)\.join\('\|'\)\) return false;/.test(src),
      'la fonte se refuse quand les abscisses diffèrent');
    /* ET ELLE LE DIT, AU LIEU DE SE TAIRE. Elle rendait `undefined` et
       l'appelant n'en faisait rien : le dessin se posait d'un coup. Elle rend
       maintenant un booleen, et un refus declenche le balayage — qui, lui, ne
       pretend rien sur les valeurs, il decouvre une periode. */
    vrai(/return true;/.test(src), 'une fonte reussie se déclare');
    vrai(/function balayer\(\) \{/.test(src) && /classList\.add\('chart-rejoue'\)/.test(src),
      'et un refus redécouvre le dessin de gauche à droite');
    /* La classe se retire d'elle-meme : sans cela, un second changement de plage
       ne rejouerait rien, la classe etant deja posee. */
    vrai(/trace\.addEventListener\('animationend', oter, \{ once: true \}\);/.test(src),
      'la classe se retire à la fin, sinon le geste suivant ne rejouerait rien');
    /* ET PAR UN MINUTEUR AUSSI : un onglet en arriere-plan ne fait pas avancer
       ses animations, donc `animationend` n'arrive jamais. Mesure dans un
       panneau masque — la classe restait posee. */
    vrai(/setTimeout\(oter, 900\);/.test(src),
      'et un minuteur la retire même si l’animation n’a jamais couru');
    /* Sans `backwards`, le pire qui arrive est un dessin pose d'un coup. Avec,
       c'etait un graphique decoupe a zero, donc invisible. */
    const css2 = lireSource('assets/styles.css');
    vrai(!/\.chart-trace\.chart-rejoue \{[^}]*backwards/.test(css2),
      'et le dessin ne part jamais découpé à zéro');
    /* Et le registre est partage par tous les graphiques, clefe par
       identifiant : la pile refuse de partir d'un etat qu'un autre genre de
       dessin y aurait laisse. */
    vrai(/if \(!avant \|\| avant\.genre !== 'aire'\) return false;/.test(src),
      'la pile ne se fond que depuis une pile');
  });
});

/* ------------------------------------------------------------------
   Ce qu'on accumule en ce moment
   ------------------------------------------------------------------ */
suite('La synthèse d’accumulation a changé d’écran, pas de calcul', () => {

  /* Une carte qui agregerait revenus, charges, depenses, capacite d'epargne,
     capital rembourse, accumulation, taux, objectif d'investissement,
     croissance constatee et ecart au budget n'aurait pas sa place sous Budget >
     Charges fixes, un onglet qui doit dire quelles sont les charges fixes. La
     synthese vit sur l'accueil, reduite a la question qu'on s'y pose.

     Ces controles gardent la seule chose qui compte dans un demenagement : que
     rien n'ait ete recalcule en route. */

  /* La fonction entiere, bornee sur sa fin reelle et non sur un nombre de
     caracteres : la tranche etait fixee a 4 000, la carte a grossi, et les
     controles ont commence a chercher dans le vide en annonçant « absent » ce
     qui etait simplement au-dela du couperet. Une borne arbitraire ment en
     silence des que le code bouge. */
  const carte = () => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function carteAccumulation()');
    if (i < 0) return '';
    const fin = src.indexOf('\n}\n', i);
    return src.slice(i, fin < 0 ? src.length : fin + 3);
  };

  test('Charges fixes ne répond plus qu’à sa question', () => {
    const src = lireSource('assets/app.js');
    vrai(!/Épargne et croissance/.test(src), 'la carte a quitté l’onglet');
    /* Ce qui doit y rester, et qui y est : le total, sa part du revenu, la
       repartition par poste, le tableau et son edition. */
    vrai(/trad\('Ce qui sort chaque mois'\)/.test(src), 'le total mensuel reste');
    vrai(/trad\('des revenus'\)/.test(src), 'sa part du revenu reste');
    vrai(/data-apercu="chargesFixes"/.test(src), 'la répartition par poste reste');
    vrai(/data-anchor="charges"/.test(src) && /data-action="edit-charge"/.test(src),
      'le tableau et son édition restent');
    /* Et plus aucun bilan patrimonial : les trois notions qui n'ont rien a
       faire dans cet onglet ont disparu de la source. */
    /* Le controle porte sur LA VUE, pas sur le fichier. « Croissance observee »
       et « Ce qui ne vient pas du budget » sont revenues, mais sur l'accueil, ou
       elles confrontent l'equation a ce que le patrimoine a fait. Chercher leur
       absence dans tout `app.js` reviendrait a interdire qu'elles existent
       quelque part, ce qui n'est pas la regle : la regle est que l'onglet
       « Charges fixes » ne porte pas de bilan patrimonial. */
    const vueBudget2 = src.slice(src.indexOf('function viewBudget(section'),
                                 src.indexOf('function paliersCible('));
    vrai(vueBudget2.length > 1000, 'la vue Budget doit être trouvable');
    for (const parti of ['Croissance observée du patrimoine', 'Ce qui ne vient pas du budget',
                         'Voir le rapprochement dans Budget', '= Accumulation patrimoniale']) {
      vrai(!vueBudget2.includes(`trad('${parti}')`),
        `« ${parti} » n’a plus rien à faire dans cet onglet`);
    }
  });

  test('l’équation vit dans Budget, l’accueil en garde le résultat', () => {
    const src = lireSource('assets/app.js');
    vrai(/function carteAccumulation\(\)/.test(src), 'la carte existe');
    /* Une definition, un appel dans Budget, et le repli du resume quand il n'y a
       rien a resumer : aucun balisage recopie. */
    eq((src.match(/carteAccumulation\(\)/g) || []).length, 3,
      'sa définition, Budget, et le repli du résumé');
    const budget = src.slice(src.indexOf('function viewBudget(section'), src.indexOf('function paliersCible('));
    /* Dans la seconde pile du haut de Budget, a l'interieur du bloc que
       l'ecran des charges fixes ne rend pas. */
    const debutPiles = budget.indexOf('<div class="grid g-hero budget-duo">');
    const blocCadre = budget.lastIndexOf("${cadre ? '' : `", debutPiles);
    const appel = budget.indexOf('${carteAccumulation()}', debutPiles);
    vrai(debutPiles > 0 && blocCadre > 0 && debutPiles - blocCadre < 1200 && appel > debutPiles
      && appel < budget.indexOf('\n  </div>`}', debutPiles),
      'Budget la porte, sur l’écran des revenus et des dépenses et non sur Charges fixes');
    const resume = src.slice(src.indexOf('function carteAccumulationResume()'),
                             src.indexOf('\n}\n', src.indexOf('function carteAccumulationResume()')));
    vrai(/data-action="goto" data-view="budget"\s+data-anchor="accumulation"/.test(resume),
      'le résumé mène au calcul');
    vrai(/rec\.theoretical/.test(resume) && /rec\.spendObserved/.test(resume),
      'et il dit son résultat et d’où viennent les dépenses');
    /* L'ordre de lecture : le patrimoine, sa repartition, la courbe, puis
       l'accumulation, puis son rythme. Le controle porte sur les positions
       relatives dans la vue, pas sur un numero de ligne. */
    const vue = src.slice(src.indexOf('function viewOverview()'),
                          src.indexOf('function mountOverview()'));
    /* La carte du haut ne porte plus de couverture cliquable : elle se lit.
       L'ancre porte donc sur la carte elle-meme, pas sur son ancien geste. */
    /* L'ordre des cartes est une donnee depuis qu'il se personnalise : le
       controle porte sur l'ordre par defaut, et sur le patrimoine qui reste
       rendu avant toutes les cartes. */
    const iHero = vue.indexOf('<div class="hero">');
    const iCartes = vue.indexOf('${cartes.suite}');
    const iEvo = CARTES_APERCU.indexOf('evolution');
    const iAcc = CARTES_APERCU.indexOf('accumulation');
    vrai(iHero > 0 && iCartes > 0 && iEvo >= 0 && iAcc >= 0, 'les trois repères existent');
    vrai(iHero < iCartes, 'le patrimoine principal vient avant');
    vrai(iEvo < iAcc, 'la courbe aussi');
    vrai(!vue.includes('${carteAccumulation()}'), 'l’équation entière n’est plus sur l’accueil');
    vrai(!vue.includes("trad('Rythme d\\'accumulation')") && !vue.includes('carteRythme()'),
      'ni le rythme, parti dans l’Historique');
  });

  test('une seule source de vérité, et aucun calcul refait dans la vue', () => {
    /* Le risque d'un demenagement : recopier la formule a l'arrivee « pour
       simplifier », et se retrouver avec deux additions qui derivent. */
    const src = lireSource('assets/app.js');
    const c = carte();
    vrai(/const rec = savingsReconciliation\(\);/.test(c),
      'la carte lit le modèle');
    /* Aucune arithmetique sur ces grandeurs dans la vue : ni soustraction de
       revenus, ni addition du capital. */
    vrai(!/investable\s*\+\s*/.test(c) && !/income\s*-\s*/.test(c),
      'et elle n’en refait aucune : le total vient de rec.theoretical');
    /* `=[^=]` et non `=` seul : la vue COMPARE desormais le taux a `null` pour
       ne pas imprimer un pourcentage sans denominateur, et `==` tombait sous un
       motif qui cherche une affectation. */
    vrai(!/theoreticalRate\s*=[^=]/.test(c), 'le taux non plus ne se recalcule pas');
    /* Le modele n'a pas ete touche : la formule est toujours celle-la. */
    Fixture.poser();
    const rec = savingsReconciliation();
    pres(rec.investable, rec.income - rec.fixed - rec.spend,
      'capacité d’épargne = revenus − charges fixes − dépenses');
    pres(rec.theoretical, rec.investable + rec.capitalRembourse,
      'accumulation = capacité d’épargne + capital remboursé');
  });

  test('la capacité plus le capital remboursé font le total, et le taux suit', () => {
    /* Un budget fictif qui laisse 700 EUR, et un credit qui rembourse du capital. */
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 3000 }];
      s.budget.fixedCharges = [{ id: 'c1', label: 'Loyer', amount: 1300, periode: 'mois' }];
      s.budget.expenses = [{ month: todayISO().slice(0, 4) + '-01', v: { Courses: 1000 }, note: '' }];
      s.etabs.find(e => e.id === 'e_bien').dettes = [
        { id: 'd', libelle: 'Prêt', montant: 150000, taux: 2, mensualite: 900, note: '' }];
    });
    const rec = savingsReconciliation();
    pres(rec.investable, 700, 'capacité d’épargne');
    /* 150 000 EUR a 2 % : 250 EUR d'interets le premier mois, donc 650 EUR de
       capital sur une mensualite de 900. */
    pres(rec.capitalRembourse, 650, 'le capital remboursé du mois');
    pres(rec.theoretical, 1350, 'le total, 700 + 650');
    pres(rec.investable + rec.capitalRembourse, rec.theoretical,
      'et le total est bien la somme des deux lignes affichées au-dessus');
    /* Le taux se lit sur les revenus, et sur eux seuls. */
    pres(rec.theoreticalRate, 45, 'le taux : 1 350 sur 3 000 de revenus');
  });

  test('sans crédit, la ligne à zéro explique l’égalité au lieu de disparaître', () => {
    /* Elle disparaissait, au motif qu'afficher « 0 € » puis deux fois le meme
       montant sous deux intitules est ce que ce projet s'interdit. Le motif etait
       bon, la conclusion fausse : la ligne a zero n'est pas une redite, c'est
       elle qui EXPLIQUE pourquoi capacite et accumulation sont egales. Une phrase
       a la place — « sans credit en cours » — demandait de reconstituer
       mentalement ce que la formule montre d'un coup d'oeil.

       Les quatre lignes sont donc toujours rendues, dans tous les cas. */
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes = [];
    });
    const rec = savingsReconciliation();
    pres(rec.capitalRembourse, 0, 'aucun capital remboursé sans crédit');
    pres(rec.theoretical, rec.investable, 'l’accumulation vaut la capacité d’épargne');
    const c = carte();
    vrai(!/avecCredit/.test(c), 'plus de branche qui masque la décomposition');
    vrai(!/sans crédit en cours/.test(c), 'et plus de phrase à la place de la formule');
    /* Les sept intitules de la cascade, chacun rendu une seule fois, avec son
       operateur : la colonne se lit de haut en bas comme une addition posee. */
    /* Les operateurs sont des caracteres d'expression rationnelle : le « + » de
       « + Capital rembourse » vaut « un ou plus » et la recherche ne trouvait
       rien. On compte donc les occurrences de la chaine, sans motif. */
    const combien = (t, aiguille) => t.split(aiguille).length - 1;
    for (const ligne of ['Revenus fixes', '− Charges fixes', '= Capacité d’épargne',
                         '+ Capital remboursé', '= Accumulation patrimoniale',
                         'Taux d’accumulation']) {
      eq(combien(c, `trad('${ligne}')`), 1,
        `« ${ligne} » doit être rendu, une fois`);
    }
    /* Le troisieme terme porte le nom de la branche prise. */
    vrai(/trad\('− Dépenses observées'\)/.test(c) && /trad\('− Objectif de dépenses'\)/.test(c),
      'et la ligne des dépenses sait dire laquelle des deux bases a servi');

    /* Et zero s'ecrit « 0 € », jamais « +0 € » : un plus devant un zero se lit
       comme une addition qui n'a pas eu lieu. */
    eq(montantSigne(0), fmtEUR0(0), 'zéro ne porte pas de signe');
    eq(montantSigne(645).slice(0, 1), '+', 'un montant positif en porte un');
    eq(montantSigne(-300).slice(0, 1), '−', 'un négatif aussi, avec le vrai signe moins');
  });

  test('une capacité d’épargne négative ne casse pas la somme', () => {
    /* −300 de capacite et +500 de capital font +200, pas +500 et pas zero. */
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 1200 }];
      s.budget.fixedCharges = [{ id: 'c1', label: 'Loyer', amount: 900, periode: 'mois' }];
      s.budget.expenses = [{ month: todayISO().slice(0, 4) + '-01', v: { Courses: 600 }, note: '' }];
      s.etabs.find(e => e.id === 'e_bien').dettes = [
        { id: 'd', libelle: 'Prêt', montant: 150000, taux: 2, mensualite: 900, note: '' }];
    });
    const rec = savingsReconciliation();
    pres(rec.investable, -300, 'la capacité d’épargne est négative, et le reste');
    vrai(rec.capitalRembourse > 0.005, 'et un capital se rembourse quand même');
    pres(rec.theoretical, rec.investable + rec.capitalRembourse,
      'la somme se fait telle quelle, sans plancher à zéro');
    vrai(rec.theoretical > rec.investable,
      'le capital remonte le total sans effacer le déficit');
  });

  test('une accumulation négative s’affiche négative, jamais ramenée à zéro', () => {
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 1000 }];
      s.budget.fixedCharges = [{ id: 'c1', label: 'Loyer', amount: 900, periode: 'mois' }];
      s.budget.expenses = [{ month: todayISO().slice(0, 4) + '-01', v: { Courses: 900 }, note: '' }];
      s.etabs.find(e => e.id === 'e_bien').dettes = [];
    });
    const rec = savingsReconciliation();
    pres(rec.theoretical, -800, 'moins huit cents, et pas zéro');
    vrai(rec.theoreticalRate < 0, 'le taux suit le signe');
    /* Cote affichage : la convention negative du projet, et un signe toujours
       ecrit sur le total. */
    const c = carte();
    vrai(/cls\(rec\.theoretical\)/.test(c),
      'la couleur suit le signe, comme partout ailleurs');
    vrai(/aEcran\(rec\.theoretical\)/.test(c),
      'et le signe est toujours écrit : un total signé ne se lit pas comme un solde');
    /* Le vert reste significatif : dans l'equation, un seul montant porte une
       couleur — le total. Colorer aussi ses composantes en ferait une
       decoration. L'ecart hors budget, lui, vit sous le filet, dans la partie
       qui CONFRONTE l'equation, et il se lit dans les deux sens : sa couleur y
       porte un sens que le vert de l'accumulation ne dit pas. */
    const equation = c.slice(c.indexOf('<dl class="kv kv-accumul">'), c.indexOf('kv-filet'));
    /* Le resultat se lit d'abord, puis l'equation derriere « Voir le calcul » :
       le total n'y est colore qu'une fois, dans la synthese. */
    vrai(c.indexOf('<details class="data-view accumul-calcul">') > c.indexOf("trad('Accumulation patrimoniale')"),
      'le résultat vient avant la formule, qui s’ouvre à la demande');
    eq((equation.match(/cls\(/g) || []).length, 1,
      'une seule ligne de l’équation est colorée, sinon la couleur ne veut plus rien dire');
    vrai(/cls\(rec\.gap\)/.test(c.slice(c.indexOf('kv-filet'))),
      'et l’écart hors budget porte la sienne, sous le filet');
  });

  test('la carte ne suit pas Net / Brut, et rien ne l’y oblige', () => {
    /* Elle mesure un FLUX mensuel. `savingsReconciliation()` ne lit ni
       `patrimoine()` ni les dettes en stock : le commutateur du haut de page ne
       la traverse nulle part, et il n'y avait donc aucune convention a inventer.

       Le controle porte sur la cause : ni la carte ni la fonction ne mentionnent
       le commutateur. */
    const c = carte();
    vrai(!/evoNet/.test(c), 'la carte ne lit pas le commutateur');
    const store = lireSource('assets/store.js');
    const fn = store.slice(store.indexOf('function savingsReconciliation()'),
                           store.indexOf('function prochainJour('));
    vrai(fn.length > 200, 'la fonction doit être trouvable');
    vrai(!/patrimoine\(\)/.test(fn) && !/dettesTotal\(\)/.test(fn),
      'et son calcul ne touche pas au patrimoine en stock');
    /* Mesure : le même résultat quel que soit l'état du patrimoine. */
    Fixture.poser();
    const avant = savingsReconciliation().theoretical;
    Fixture.poser(s => {
      s.comptes.find(c2 => c2.id === 'c_immo').lignes = [];
    });
    pres(savingsReconciliation().theoretical, avant,
      'retirer 120 000 EUR de murs ne change pas d’un centime ce qu’on accumule ce mois-ci');
  });

  test('le filet du total ne se coupe pas dans la gouttière', () => {
    /* Le total porte un filet au-dessus : c'est le dessin d'une addition, et il
       dit sans un mot que les lignes du dessus s'y ajoutent. `.kv` est une
       GRILLE a deux colonnes, donc un `border-top` pose sur le libelle et sur le
       montant laisse la gouttiere non peinte : deux troncons et un trou au
       milieu. L'ecart passe en remplissage du libelle.

       Et il faut le poser DEUX FOIS. Le bloc telephone redeclare le `gap` de
       `.kv`, a la meme specificite et plus bas dans le fichier : c'est lui qui
       tranche sous 768 px. Sans la reprise, le filet etait continu sur grand
       ecran et coupe de dix pixels a 375 px — mesure, et invisible a qui ne
       regarde que son ordinateur. Le fichier documente deja ce piege pour
       `.kv-texte`, deux regles plus haut. */
    const css = lireSource('assets/styles.css');
    vrai(css, 'la feuille de style doit être lisible');
    const regles = (css.match(/\.kv-accumul \{ column-gap: 0; \}/g) || []).length;
    eq(regles, 2,
      'la règle doit être posée deux fois : une fois pour l’écran, une fois dans '
      + 'le bloc téléphone qui redéclare le gap de .kv');
    eq((css.match(/\.kv-accumul dt \{ padding-right: \d+px; \}/g) || []).length, 2,
      'et l’écart entre les colonnes est rendu par le remplissage, des deux côtés');
    /* La reprise vit bien DANS le bloc telephone, apres la redeclaration
       qu'elle doit battre : c'est l'ordre qui tranche, pas la specificite. */
    const iKvMobile = css.lastIndexOf('.kv { grid-template-columns');
    const iReprise = css.lastIndexOf('.kv-accumul { column-gap: 0; }');
    vrai(iKvMobile > 0 && iReprise > iKvMobile,
      'la reprise doit suivre la redéclaration mobile, sinon elle ne la bat pas');
  });

  test('chaque métrique calculée porte son aide', () => {
    /* Une cascade sans explication demande de faire confiance a sept nombres.
       Chaque ligne CALCULEE doit pouvoir dire d'ou elle vient, au doigt, sans
       quitter la page. Le composant est celui de toute l'application — `aide()`,
       une pastille « ? » que `monteAides` ouvre — et non un second style.

       Les deux premieres lignes n'en portent pas, et c'est voulu : « Revenus
       fixes » et « − Charges fixes » sont des montants SAISIS, pas des resultats.
       Une aide qui dirait « ce que tu as declare » n'apprendrait rien. */
    const c = carte();
    /* La ligne des depenses ne rend pas son intitule en clair : il se choisit
       au-dessus du gabarit, selon la branche prise par le moteur, et arrive dans
       le `<dt>` par une variable. On l'y cherche donc sous cette forme. */
    const rendu = { '− Dépenses observées': '${esc(nomDepenses)}' };
    for (const ligne of ['− Dépenses observées', '= Capacité d’épargne',
                         '+ Capital remboursé', '= Accumulation patrimoniale',
                         'Taux d’accumulation', 'Croissance observée du patrimoine',
                         'Ce qui ne vient pas du budget']) {
      const i = c.indexOf(rendu[ligne] || `trad('${ligne}')`);
      vrai(i > 0, `« ${ligne} » doit être rendu`);
      const fin = c.indexOf('</dt>', i);
      /* Une bulle OU un sous-titre : ce qui compte est que la ligne dise d'ou
         elle vient, pas le composant qui le dit. « Depenses observees » se
         contente de « moyenne de l'annee » sous son intitule — trois mots la ou
         une phrase demandait un geste. */
      vrai(fin > i && /\$\{aide\(|class="sub"/.test(c.slice(i, fin)),
        `« ${ligne} » doit dire d’où elle vient`);
    }
    /* Les deux montants saisis n'en portent pas. */
    const revenus = c.indexOf("trad('Revenus fixes')");
    vrai(!/\$\{aide\(/.test(c.slice(revenus, c.indexOf('</dt>', revenus))),
      'un montant saisi n’a rien à expliquer');
  });

  test('la carte ne réintroduit pas l’objectif d’investissement', () => {
    /* Il figurait dans l'ancienne carte de Budget et il n'est PAS une composante
       de l'accumulation : il se calcule sur l'OBJECTIF de depenses quand tout le
       reste se calcule sur les depenses constatees. Le poser au milieu de la
       cascade ferait une ligne qui ne s'additionne a rien. Il vit toujours dans
       la barre « Ou va ce que tu gagnes » de l'onglet Depenses. */
    const c = carte();
    vrai(!/Objectif d’investissement/.test(c),
      'il n’a pas sa place dans une cascade où chaque ligne s’additionne');
    vrai(!/targetSaving/.test(c), 'et son montant n’est pas lu ici');
    /* Il n'a pas disparu pour autant. */
    const src = lireSource('assets/app.js');
    eq((src.match(/trad\('Objectif d’investissement'\)/g) || []).length, 1,
      'la barre du budget le nomme, et elle est seule à le faire');
  });

  test('la confrontation vit sous un filet, jamais dans l’équation', () => {
    /* Deux natures. Au-dessus du filet, ce que le budget et les remboursements
       EXPLIQUENT, ligne a ligne. En dessous, ce que le patrimoine a REELLEMENT
       fait, et l'ecart entre les deux. Melangees, la croissance observee se
       lirait comme un terme de plus de l'addition, alors qu'elle n'en est pas
       un : elle contient les marches et les apports exterieurs. */
    const c = carte();
    const iFilet = c.indexOf('kv-filet');
    vrai(iFilet > 0, 'le filet doit séparer les deux parties');
    const equation = c.slice(0, iFilet), confrontation = c.slice(iFilet);
    for (const dans of ['Revenus fixes', '= Capacité d’épargne', '= Accumulation patrimoniale']) {
      vrai(equation.includes(`trad('${dans}')`), `« ${dans} » appartient à l’équation`);
      vrai(!confrontation.includes(`trad('${dans}')`), `« ${dans} » n’est pas sous le filet`);
    }
    for (const sous of ['Croissance observée du patrimoine', 'Ce qui ne vient pas du budget']) {
      vrai(confrontation.includes(`trad('${sous}')`), `« ${sous} » vit sous le filet`);
      vrai(!equation.includes(`trad('${sous}')`), `« ${sous} » n’entre pas dans l’addition`);
    }
    /* Sans historique, il n'y a rien a confronter : la partie entiere se tait
       plutot que d'afficher un ecart contre un vide. */
    vrai(/rec\.realPerMonth == null \? '' :/.test(c),
      'sans relevé, la confrontation ne s’affiche pas');
    /* Et sa base est nommee : « Rythme d'accumulation » montre la meme nature de
       chiffre sur la periode qu'on y choisit, celle-ci sur une fenetre fixe. */
    Fixture.poser();
    eq(PACE_WINDOW, 12, 'la fenêtre de la croissance observée est fixe');
    vrai(/douze derniers mois clos/.test(c),
      'et l’aide la nomme, sinon deux nombres proches se liraient comme une erreur');
    vrai(/rec\.monthsSpan/.test(c),
      'la note compte les mois réellement mesurés, elle n’annonce pas douze par principe');
  });


  test('les aides disent la formule que le moteur a jouée', () => {
    /* Une aide qui explique autre chose que le calcul fait est pire qu'aucune
       aide : elle donne raison de se fier a un chiffre pour de mauvaises
       raisons. Chacune se compose donc de la phrase ET des montants reels. */
    const c = carte();
    vrai(/Revenus − charges fixes − dépenses observées\./.test(c),
      'la capacité d’épargne annonce ses trois termes, avec le mot de la ligne du dessus');
    vrai(/fmtEUR0Texte\(rec\.income\)[\s\S]{0,80}fmtEUR0Texte\(rec\.fixed\)[\s\S]{0,80}fmtEUR0Texte\(rec\.spend\)/.test(c),
      'et les trois montants qui la composent, dans l’ordre de la formule');
    vrai(/Capacité d’épargne \+ capital remboursé\./.test(c),
      'le total annonce sa composition');
    vrai(/Accumulation patrimoniale ÷ revenus\./.test(c),
      'le taux annonce son rapport');

    /* Le troisieme terme se NOMME selon la branche prise. `savingsReconciliation`
       retombe sur l'objectif de depenses quand aucune depense n'est saisie :
       annoncer « depenses moyennes » dans ce cas dirait une formule que le
       moteur n'a pas jouee. */
    vrai(/rec\.spendObserved[\s\S]{0,200}objectif de dépenses/.test(c),
      'et il change de nom quand le moteur retombe sur l’objectif');
    Fixture.poser();
    vrai(savingsReconciliation().spendObserved,
      'le fixture porte des dépenses, donc la moyenne sert');
    Fixture.poser(s2 => { s2.budget.expenses = []; });
    const sans = savingsReconciliation();
    eq(sans.spendObserved, false, 'sans dépense saisie, c’est l’objectif qui sert');
    pres(sans.spend, budgetFrame().target, 'et c’est bien lui que le calcul retient');

    /* Aucun revenu : « ÷ 0 € » ne s'explique pas, l'aide dit ce qui manque. */
    vrai(/rec\.income[\s\S]{0,240}Aucun revenu déclaré/.test(c),
      'sans revenu déclaré, le taux dit ce qui lui manque au lieu de diviser par zéro');
  });

  test('un montant dans une aide se formate en texte, jamais en balisage', () => {
    /* `fmtEUR0` rend du BALISAGE quand les montants sont masques : un oeil barre
       en SVG. C'est ce qu'il faut a l'ecran, et c'est faux dans un ATTRIBUT —
       `aide()` range son texte dans `data-aide`, ou la balise s'imprimerait en
       clair, source SVG comprise. `fmtEUR0Texte` y rend « ••• € ».

       Le fichier des formateurs le dit deja, et c'est pour cette raison que
       `montantSigne` prend son formateur en argument plutot que d'exister en
       deux exemplaires. */
    const c = carte();
    vrai((c.match(/\$\{aide\(/g) || []).length >= 6,
      'les aides de la cascade et de la confrontation doivent être trouvables');
    /* Les aides composees vivent dans des constantes au-dessus du gabarit : on
       controle donc la carte entiere, hors du rendu des `<dd>`.

       La region part de `const aEcran` et non du debut de la fonction : la carte
       rend desormais un ecran vide AVANT ses constantes, quand rien n'est encore
       declare, et son `return` est le premier du corps. Prendre le premier
       laissait une region qui ne contient plus une seule aide, donc un controle
       qui passe sans rien controler. */
    const debut = c.indexOf('const aEcran');
    vrai(debut > 0, 'les formateurs d’aide doivent être trouvables');
    const composition = c.slice(debut, c.indexOf('return `', debut));
    vrai(!/fmtEUR0\((?!0\))/.test(composition.replace(/fmtEUR0Texte\(/g, '')),
      'aucune aide ne compose un montant avec le formateur qui rend du balisage');
    vrai(!/fmtSigned\(/.test(composition),
      'ni avec fmtSigned, qui s’appuie dessus');
    vrai(/const enTexte = v => montantSigne\(v, fmtEUR0Texte\);/.test(composition),
      'le signe des aides passe par le formateur texte');
    /* Dans une formule ECRITE, l'operateur porte le plus : un operande signe
       donnerait « +650 € + +450 € ». Seul le resultat est signe, faute
       d'operateur devant lui pour le dire. */
    vrai(!/enTexte\(rec\.investable\)[\s\S]{0,60}enTexte\(rec\.capitalRembourse\)/.test(composition),
      'les opérandes d’une addition ne portent pas leur propre plus');
    vrai(/= \$\{enTexte\(rec\.theoretical\)\}/.test(composition),
      'mais le résultat le porte : rien devant lui ne le dirait');
    /* Et le meme signe des deux cotes : une seule fonction, deux sorties. */
    eq(montantSigne(645, v => String(v)), '+645', 'le signe ne dépend pas du formateur');
    eq(montantSigne(0, v => String(v)), '0', 'et zéro n’en porte jamais');
  });

  test('les compteurs du rythme disent ce qu’ils comptent', () => {
    /* Ils comptent des ECARTS entre relevés, et un écart vaut un mois tant
       qu'aucun ne manque. Dès qu'il en manque un, les deux cessent de coïncider :
       « Meilleur mois : avr. 26 · +6 000 € » attribue à avril seul ce que trois
       mois ont mis à arriver. Le nombre ne change pas — le moteur divise déjà
       par les mois réels — c'est le mot qui suit. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function carteRythme()');
    const bloc = src.slice(i, src.indexOf('\n}\n', i));
    vrai(/const trou = num\(p\.mois\) > p\.count;/.test(bloc),
      'la carte sait si un mois manque sur la période affichée');
    for (const [normal, trou] of [['Mois en hausse', 'Variations en hausse'],
                                  ['Meilleur mois', 'Meilleure variation'],
                                  ['Pire mois', 'Pire variation']]) {
      vrai(bloc.includes(`trad(trou ? '${trou}' : '${normal}')`),
        `« ${normal} » devient « ${trou} » quand un mois manque`);
      vrai(I18N.en[trou], `« ${trou} » est traduite`);
    }
  });

  test('le préambule d’Allocation n’annonce pas un écart inexistant', () => {
    /* Le commutateur Financier / Tout se tait quand rien ne sort du périmètre :
       `horsFinancierExiste()` décide, et sans mur ni bien de valeur les deux
       lectures donnent la même page. Le préambule, lui, annonçait toujours
       « immobilier en direct et biens de valeur écartés ». L'écran retirait le
       choix parce qu'il n'y a rien à écarter, et disait dans la même respiration
       ce qu'il écarte. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewAllocation()'),
                          src.indexOf('function mountAllocation'));
    const i = vue.indexOf('perimetre-tete');
    const bloc = vue.slice(i, i + 1400);
    vrai(/horsFinancierExiste\(\)/.test(bloc),
      'la phrase demande si quelque chose sort vraiment du périmètre');
    vrai(/: trad\('tes avoirs'\)/.test(bloc),
      'et nomme simplement la base quand rien ne sort');
    vrai(/allocFinancier && !horsFinancierExiste\(\)/.test(bloc),
      'l’aide suit la même condition');
    /* La branche « Tout » ne bouge pas : sa base est le patrimoine net, et
       « tes crédits sont déduits » reste vrai avec ou sans mur. */
    vrai(/trad\('tes crédits sont déduits'\)/.test(bloc), 'le mode Tout garde sa phrase');
    eq(I18N.en['tes avoirs'], 'your holdings', 'la base se traduit');
    const aide = Object.keys(I18N.en).find(k => /Rien n’est écarté ici/.test(k));
    vrai(aide && /Nothing is set aside here/.test(I18N.en[aide]), 'l’aide courte aussi');
    /* Et le commutateur garde la même garde : les deux ne peuvent pas diverger. */
    vrai(/\$\{horsFinancierExiste\(\) \? barreCommutateur\(/.test(vue),
      'le commutateur lit le même prédicat');
  });

  test('le premier écran n’annonce pas un patrimoine de zéro', () => {
    /* Sans un seul compte, « PATRIMOINE 0,00 € » s'affichait en gros au-dessus
       de l'invitation à en créer un : le chiffre se lit comme une mesure alors
       qu'il est inconnu. La convention de cette base de code est déjà celle-là
       ailleurs — les écarts du hero ne s'affichent pas faute de relevé. */
    const src = lireSource('assets/app.js');
    const hero = src.slice(src.indexOf('<div class="hero">'),
                           src.indexOf("invitePremierPas('comptes')"));
    vrai(/\$\{!aUnComptePropre\(\) \? '' : `/.test(hero),
      'le montant et son intitulé attendent le premier compte');
    vrai(hero.indexOf('hero-value') > hero.indexOf('aUnComptePropre'),
      'la garde vient avant le montant');
    /* Et l'invitation, elle, reste : une seule, et toujours là. */
    vrai(/invitePremierPas\('comptes'\)/.test(src), 'l’invitation demeure');
  });

  test('un contenant qui n’a rien à proposer ne pose pas la question', () => {
    /* Le tout premier compte tombait sur « Dans quelle banque le tenir ? » avec
       une seule entrée : « + Nouvelle banque ou courtier… ». Une question posée
       à quelqu'un qui n'a pas le choix, au moment où il découvre l'application. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('const proposables = etablissementsProposables(t.id)');
    const bloc = src.slice(i, src.indexOf("if (etabId === '__nouveau')", i));
    vrai(/if \(!proposables\.length\) etabId = '__nouveau';/.test(bloc),
      'sans rien à proposer, on passe directement au nom');
    vrai(/else \{/.test(bloc), 'et la liste ne se pose que s’il y a un choix');
  });

  test('« + Ligne » des charges fixes n’est pas une ligne de titres', () => {
    /* Le bouton ouvre une charge fixe et se traduisait « + Holding », le mot que
       Marchés emploie pour un titre. Deux vocabulaires pour un seul mot français,
       et c'est celui de l'autre écran qui gagnait. */
    eq(I18N.en['+ Ligne'], '+ Cost', 'le bouton des charges parle de coûts');
    eq(I18N.en['+ Ajouter une ligne'], '+ Add a holding',
      'et celui de Marchés garde le sien');
  });

  test('« Rythme d’accumulation » garde ce qui lui appartient', () => {
    /* Il perd la ligne qui a demenage, et rien d'autre : sa courbe, sa plage,
       sa moyenne constatee, ses apports exceptionnels et ses trois compteurs. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function carteRythme()');
    vrai(i > 0, 'la carte existe toujours');
    const bloc = src.slice(i, src.indexOf('\n}\n', i));
    vrai(/trad\('Rythme d\\'accumulation'\)/.test(bloc), 'sous son nom');
    const hist = src.slice(src.indexOf('function viewHistory()'), src.indexOf('function mountHistory()'));
    vrai(/\$\{aUnComptePropre\(\) \? carteRythme\(\) : ''\}/.test(hist), 'et l’Historique la rend');
    const mh = src.slice(src.indexOf('function mountHistory()'), src.indexOf('\n}\n', src.indexOf('function mountHistory()')));
    vrai(/monterRythme\(\);/.test(mh), 'avec ses barres');
    /* Les trois compteurs se nomment desormais selon qu'un mois manque ou non
       — « Mois en hausse » ou « Variations en hausse » — donc on cherche le
       LIBELLE et non la forme exacte de l'appel. Ce que le controle protege est
       la presence de la ligne, pas la facon de la traduire. */
    for (const garde of ["rangeControl('pace-range', paceRange)", 'id="chartPace"',
                         "trad('Moyenne mensuelle du patrimoine')", "'Mois en hausse'",
                         "'Meilleur mois'", "'Pire mois'"]) {
      vrai(bloc.includes(garde), `« ${garde} » appartient au rythme et y reste`);
    }
    vrai(!/savingsReconciliation/.test(bloc),
      'et il ne lit plus le budget : c’est l’autre carte qui le fait');
  });
});

/* ------------------------------------------------------------------
   Le VIX : un contexte, jamais un conseil
   ------------------------------------------------------------------ */
suite('Le VIX dit un niveau, il ne recommande rien', () => {

  /* Il mesure la volatilite implicite attendue sur le S&P 500, c'est-a-dire
     l'amplitude que le marche anticipe. Sa variation du jour n'apprend presque
     rien — « +6,7 % » sur un indice de volatilite ne se lit pas — alors que son
     niveau se lit tout de suite, pour peu qu'on dise ce qu'il vaut.

     `niveauVix` et la tuile vivent dans app.js, que le harnais ne charge pas :
     les seuils se relisent dans la source, ce qui verifie du meme coup qu'ils y
     sont ecrits une seule fois. */
  const src = () => lireSource('assets/app.js');
  const table = () => {
    const t = src();
    return t.slice(t.indexOf('const NIVEAUX_VIX = ['), t.indexOf('const estVix'));
  };

  test('il rejoint le ruban des indices, sans carte a lui', () => {
    /* Marches est deja dense : le VIX y est une information secondaire, pas une
       section. Il passe donc par la meme table de reperes, la meme passerelle et
       le meme cache que les cinq autres indices. */
    const q = lireSource('assets/quotes.js');
    vrai(q, 'assets/quotes.js doit être lisible');
    const indices = q.slice(q.indexOf("['indices'"), q.indexOf("['metaux'"));
    vrai(/\['\^VIX',\s*'VIX'\]/.test(indices),
      'le VIX est un repère de la famille « Indices »');
    /* En DERNIER : il ferme la famille, il ne s'intercale pas entre deux
       indices de marche. */
    vrai(indices.indexOf("'^VIX'") > indices.indexOf("'^N225'"),
      'et il ferme la liste');
    /* Aucune carte, aucun conteneur, aucun montage a lui. */
    const app = src();
    for (const invente of ['carteVix', 'monterVix', 'id="vix"', 'chartVix']) {
      vrai(!app.includes(invente), `« ${invente} » : le VIX n’a pas de carte à lui`);
    }
    /* Et une seule requete : pas de systeme parallele pour un symbole. */
    vrai(!/fetch\([^)]*VIX/.test(app) && !/fetch\([^)]*VIX/.test(q),
      'il passe par la passerelle commune, pas par un appel dédié');
  });

  test('les quatre seuils nomment un état, et rien de plus', () => {
    const t = table();
    vrai(t.length > 100, 'la table des niveaux doit être trouvable');
    for (const [seuil, mot] of [[30, 'Très élevée'], [20, 'Élevée'],
                                [15, 'Modérée'], [0, 'Faible']]) {
      vrai(new RegExp(`\\[${seuil},\\s+'${mot}'\\]`).test(t),
        `le seuil ${seuil} doit nommer « ${mot} »`);
      vrai(I18N.en[mot], `« ${mot} » doit avoir sa traduction`);
    }
    /* La table se lit du plus haut au plus bas : `find` rend le premier seuil
       atteint, donc l'ordre EST la regle. A l'envers, tout serait « faible ». */
    const seuils = [...t.matchAll(/\[(\d+),/g)].map(m => Number(m[1]));
    eq(seuils.join(','), '30,20,15,0',
      'du plus haut au plus bas : le premier seuil atteint gagne');
  });

  test('le qualificatif tient dans une tuile, sans répéter « volatilité »', () => {
    /* Le mot n'apprenait rien a cet endroit — la tuile dit deja VIX, sa fiche
       dit « Volatilite du S&P 500 », son infobulle dit ce que l'indice mesure —
       et il coutait cher : « Moderate volatility » demandait 99 px la ou la
       tuile en offre 82, donc elle s'elargissait a 123 px contre 104 pour ses
       cinq voisines, et le ruban se lisait comme une rangee mal alignee.

       La borne est un majorant mesure : a 11,5 px, quatorze caracteres restent
       sous les 82 px utiles dans les deux langues. Ce n'est pas une limite de
       style, c'est la place qui existe. */
    const t = table();
    const mots = [...t.matchAll(/\[\d+,\s+'([^']+)'\]/g)].map(m => m[1]);
    eq(mots.length, 4, 'les quatre niveaux doivent être lisibles');
    for (const m of mots) {
      vrai(!/volatilit/i.test(m), `« ${m} » répète un mot que la tuile dit déjà`);
      vrai(m.length <= 14, `« ${m} » (${m.length} car.) ne tient pas dans la tuile`);
      const en = I18N.en[m] || '';
      vrai(en.length <= 14, `« ${en} » (${en.length} car.) ne tient pas dans la tuile`);
    }
  });

  test('toutes les tuiles du ruban font la même largeur', () => {
    /* `min-width` laissait chaque tuile grandir avec son contenu. Une largeur
       fixe les egalise, et elle ne coute rien : les cinq indices tiennent dans
       80 px de contenu pour 82 disponibles. */
    /* Le selecteur `.repere` porte PLUSIEURS regles — la geometrie et
       l'animation d'entree vivent separement. Prendre la premiere trouvee
       tombait sur l'animation et jugeait la mauvaise. On les reunit toutes. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const blocs = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(m => m[1].trim() === '.repere').map(m => m[2]);
    vrai(blocs.length >= 1, 'la règle de la tuile doit exister');
    const tout = blocs.join(' ');
    vrai(/width: 104px/.test(tout), 'la tuile a une largeur');
    vrai(!/min-width/.test(tout),
      'et pas un plancher : sinon un libellé long élargit sa tuile');
    vrai(/flex: none/.test(tout), 'et le flex ne la reprend pas');
  });

  test('la règle du VIX vient après celle qu’elle précise', () => {
    /* La tuile porte les DEUX classes, elles ont la meme specificite, et c'est
       l'ordre qui tranche. Ecrite avant, `.rp-vix` a longtemps declare une
       taille que `.rp-var` ecrasait sans que rien ne le dise : la couleur
       passait, la taille non, et seule une mesure du style calcule pouvait le
       montrer. C'est le meme defaut que `.seg-mini`, deux fois la meme faute. */
    const css = lireSource('assets/styles.css') || '';
    const iVar = css.indexOf('.rp-var {');
    const iVix = css.indexOf('.rp-vix {');
    vrai(iVar > 0 && iVix > 0, 'les deux règles doivent exister');
    vrai(iVix > iVar,
      '.rp-vix doit être déclarée après .rp-var, sinon elle est écrasée en silence');
    /* La taille reduite est partie avec sa raison d'etre : elle logeait un
       libelle long, qui n'existe plus. Le niveau se lit donc a la taille du
       pourcentage des voisines, ce qui est la meme ligne et la meme fonction. */
    const regle = css.slice(iVix, css.indexOf('}', iVix));
    vrai(!/font-size/.test(regle),
      'elle ne déclare plus de taille : celle de .rp-var vaut pour les deux');
    vrai(/color: var\(--text-secondary\)/.test(regle),
      'mais elle garde son encre : un contexte n’est pas une alerte');
  });

  test('aucun mot d’achat, de vente ni d’alarme', () => {
    /* Un chiffre de contexte qui se met a recommander cesse d'etre un chiffre de
       contexte. Le controle porte sur les chaines AFFICHEES du VIX — sa table,
       son aide, ses clefs anglaises — et non sur le fichier entier, ou
       « Vendre » est un bouton legitime de la page Positions. */
    const t = src();
    /* Commentaires retires : celui qui pose la regle ENUMERE les mots interdits,
       et un controle qui crie sur son propre enonce finit par etre desactive.
       C'est la troisieme fois aujourd'hui que ce motif se presente. */
    const bloc = t.slice(t.indexOf("const AIDE_VIX"), t.indexOf('const uniteRepere'))
      .replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(bloc.length > 200, 'le bloc du VIX doit être trouvable');
    const anglais = I18N.en['Le VIX mesure la volatilité implicite attendue sur le S&P 500. '
      + 'Plus il est élevé, plus le marché anticipe de fortes variations.'] || '';
    vrai(anglais, 'l’aide doit avoir sa traduction');
    const aSurveiller = (bloc + ' ' + anglais + ' '
      + Object.entries(I18N.en).filter(([k]) => k.startsWith('Volatilité'))
          .map(([k, v]) => k + ' ' + v).join(' ')).toLowerCase();
    for (const mot of ['acheter', 'vendre', 'opportunit', 'danger', 'suracha',
                       'surachet', 'survendu', 'bullish', 'bearish', 'signal',
                       'buy', 'sell', 'opportunity']) {
      vrai(!aSurveiller.includes(mot),
        `« ${mot} » n’a pas sa place : le VIX contextualise, il ne conseille pas`);
    }
  });

  test('sans valeur utilisable, il ne dit rien plutôt que zéro', () => {
    /* Un « 0 » afficherait une volatilite nulle, ce qui n'existe pas. La tuile
       retombe alors sur le meme mot que les autres reperes hors seance : une
       seule facon de dire « pas de donnee », comme pour les cinq voisins. */
    const t = src();
    const fn = t.slice(t.indexOf('function niveauVix(v)'), t.indexOf('const uniteRepere'));
    vrai(/if \(!Number\.isFinite\(n\) \|\| n <= 0\) return null;/.test(fn),
      'une valeur absente, non finie ou nulle ne donne aucun niveau');
    vrai(/niveauVix\(l\.prix\) \|\| trad\('hors séance'\)/.test(t),
      'et la tuile retombe sur le mot que les autres repères emploient déjà');
    /* La tuile n'est de toute facon rendue que pour les reperes utilisables :
       `utiles` filtre sur `l.ok`, comme pour les cinq autres. */
    vrai(/const utiles = lignes\.filter\(l => l\.ok\);/.test(t),
      'et le ruban ne rend que les repères que la passerelle a servis');
  });

  test('la tuile garde sa forme, et l’aide vit où elle peut être touchée', () => {
    const t = src();
    /* Le niveau prend la place de la variation : meme rangee, donc pas un pixel
       de plus sur une tuile de 90 px, et pas une rangee de plus dans la grille. */
    vrai(/\$\{estVix\(l\) \? `<span class="rp-var rp-vix">/.test(t),
      'le niveau occupe la troisième ligne, celle de la variation');
    const css = lireSource('assets/styles.css');
    const regle = css.slice(css.indexOf('.rp-vix {'), css.indexOf('}', css.indexOf('.rp-vix {')));
    vrai(/text-overflow: ellipsis/.test(regle) && /white-space: nowrap/.test(regle),
      'un libellé plus long qu’un pourcentage se coupe au lieu d’élargir la tuile');
    vrai(!/var\(--good\)|var\(--critical\)/.test(regle),
      'et il n’emprunte pas les couleurs d’alerte : c’est un contexte, pas une alarme');
    /* L'aide vit dans la fiche, qui est un panneau — dans la tuile, qui est un
       bouton, une pastille cliquable se disputerait le clic avec elle. C'est le
       defaut deja rencontre sur le montant du grand chiffre. */
    /* L'aide vit dans le slot HTML de la fiche, et surtout PAS dans la note sous
       le grand nombre. Celle-ci passe par `escMontant`, qui echappe tout sauf le
       fragment de l'oeil masque : une pastille posee la s'imprimait en clair,
       balise comprise, sous le nombre. Le defaut est parti en ligne avant d'etre
       vu — d'ou ce controle, qui garde le contrat des deux slots.

       Les bornes se prennent en repartant de l'index trouve : `vue: 'positions'`
       existe AILLEURS et plus haut dans le fichier, et une tranche dont la fin
       precede le debut est vide — donc verte pour de mauvaises raisons. */
    const iNote = t.indexOf('totalNote: estVix(l)');
    const iHtml = t.indexOf('html: `<dl class="kv">');
    vrai(iNote > 0 && iHtml > iNote, 'les deux slots de la fiche doivent être trouvables');
    vrai(/totalNote: estVix\(l\) \? \(niveauVix\(l\.prix\) \|\| ''\)/.test(t),
      'la note sous le nombre reste du texte nu');
    vrai(!/aide\(|<span/.test(t.slice(iNote, iHtml)),
      'aucun balisage dans un slot que le rendu échappe');
    const htmlFiche = t.slice(iHtml, t.indexOf('</dl>', iHtml))
      .replace(/<!--[\s\S]*?-->/g, '');
    vrai(/estVix\(l\)[\s\S]{0,160}aide\(trad\(AIDE_VIX\)\)/.test(htmlFiche),
      'et le composant d’aide vit dans le slot qui accepte du balisage');
    vrai(/title="\$\{esc\(l\.nom\)\}\$\{estVix\(l\) \? ` · \$\{esc\(trad\(AIDE_VIX\)\)\}`/.test(t),
      'et la tuile porte la même phrase dans son infobulle');
    /* Une seule ecriture du texte, pour les deux surfaces. */
    eq((t.match(/const AIDE_VIX/g) || []).length, 1,
      'le texte est écrit une fois : deux formulations finiraient par diverger');
  });

  test('le VIX n’est pas annoncé comme un indice boursier', () => {
    /* Il ne suit aucun panier d'actions : il mesure l'amplitude que le marche
       anticipe. Le sous-titre de sa fiche le dit. */
    const t = src();
    vrai(/sous: estVix\(l\) \? trad\('Volatilité du S&P 500'\)/.test(t),
      'sa fiche nomme ce qu’il mesure, pas ce qu’il n’est pas');
    vrai(I18N.en['Volatilité du S&P 500'], 'et la clef a sa traduction');
  });
});

suite('Un crédit dit ce qu’il reste à payer', () => {

  /* La formule fermee se verifie contre un amortissement mois par mois, calcule
     ici. C'est un controle plus fort qu'un tableau de banque recopie : il ne
     depend d'aucun chiffre venu d'ailleurs, il se rejoue sur n'importe quel
     credit, et il tombe si la formule derive d'un seul centime.

     La formule a par ailleurs ete confrontee a un vrai tableau d'amortissement
     bancaire — 228 echeances, capital, interets et assurance — et elle le
     reproduit au centime, premiere echeance comprise. Les chiffres de ce tableau
     ne sont pas ici : ce sont les termes du pret de quelqu'un. */
  const parMois = (capital, tauxAn, mens, assurance) => {
    const i = tauxAn / 100 / 12;
    let reste = capital, interets = 0, n = 0;
    while (reste > 0.005 && n < 10000) {
      const int = reste * i;
      interets += int;
      reste -= (mens - assurance) - int;
      n++;
    }
    return { mois: n, interets, assurance: assurance * n };
  };

  test('la durée restante se déduit, et elle est juste', () => {
    const d = { montant: 149731, taux: 1.55, tauxAssurance: 0.30, initial: 190000,
                mensualite: 811.85 };
    const r = resteAPayer(d);
    vrai(r, 'un crédit qui porte capital, taux et mensualité doit se projeter');
    const brut = parMois(149731, 1.55, 811.85, 190000 * 0.0030 / 12);
    /* Un mois d'ecart est tolere et pas davantage : la formule arrondit la
       derniere echeance au superieur, la boucle s'arrete quand le solde passe
       sous le centime. */
    vrai(Math.abs(r.mois - brut.mois) <= 1,
      `la formule donne ${r.mois} échéances, l’amortissement ${brut.mois}`);
    /* Les interets, eux, doivent coincider a l'euro. */
    vrai(Math.abs(r.interets - brut.interets) < 1,
      `intérêts : ${r.interets.toFixed(2)} contre ${brut.interets.toFixed(2)}`);
  });

  test('la mensualité se répartit, et la somme des parts la refait', () => {
    /* La regle cardinale, appliquee a une echeance : capital plus interets plus
       assurance font la mensualite, sinon l'un des trois est faux. */
    const d = { montant: 149731, taux: 1.55, tauxAssurance: 0.30, initial: 190000,
                mensualite: 811.85 };
    const r = resteAPayer(d);
    pres(r.capitalDuMois + r.interetsDuMois + r.assuranceDuMois, 811.85,
      'les trois parts de l’échéance doivent refaire la mensualité');
    vrai(r.capitalDuMois > r.interetsDuMois,
      'à 1,55 %, la part de capital dépasse largement celle des intérêts');
  });

  test('une mensualité qui ne couvre pas les intérêts ne promet aucune fin', () => {
    /* Le levier d'un courtier : il grossit tout seul, et annoncer une date de fin
       serait mentir. C'est le meme piege que la projection connait deja. */
    eq(resteAPayer({ montant: 100000, taux: 6, mensualite: 400 }), null,
      'à 6 %, 500 € d’intérêts mensuels : 400 € ne remboursent rien');
    eq(resteAPayer({ montant: 100000, taux: 6 }), null, 'ni sans mensualité');
    eq(resteAPayer({ montant: 100000, mensualite: 900 }), null,
      'ni sans taux : on ne devine pas la part d’intérêts');
  });

  test('rembourser un prêt compte comme de l’épargne', () => {
    /* L'epargne theorique retranchait la mensualite entiere, puis l'ecart avec la
       croissance reelle etait presente comme « ce qui ne vient pas de ton
       budget ». Il en venait, et par le chemin le plus direct. */
    Fixture.poser();
    const avant = savingsReconciliation();
    const e = Store.state.etabs[0];
    e.dettes = [{ id: 'dTest', libelle: 'Prêt', montant: 150000, taux: 1.55,
                  tauxAssurance: 0.30, initial: 200000, mensualite: 800 }];
    refreshAccounts();
    const apres = savingsReconciliation();
    const capital = capitalRembourseParMois();
    vrai(capital > 0, 'le capital remboursé doit être compté');
    /* La part de capital, et elle seule : les interets et l'assurance sortent
       pour de bon. */
    const assurance = 200000 * 0.0030 / 12;
    pres(capital, 800 - assurance - 150000 * 0.0155 / 12,
      'le capital est la mensualité moins l’assurance et les intérêts');
    pres(apres.theoretical - avant.theoretical, capital - (avant.fixed - apres.fixed),
      'l’épargne théorique monte de cette part, et de rien d’autre');
  });

  test('un levier de courtier ne produit aucune épargne', () => {
    /* Une mensualite plus petite que les interets ne rembourse rien : compter une
       part de capital negative gonflerait l'epargne d'un montant imaginaire. */
    Fixture.poser();
    Store.state.etabs[0].dettes = [{ id: 'dLev', libelle: 'Levier', montant: 100000,
                                     taux: 6, mensualite: 400 }];
    refreshAccounts();
    eq(capitalRembourseParMois(), 0,
      'aucune épargne : cette dette grossit au lieu de se rembourser');
  });
});


suite('La plus-value ne dit que ce qu’elle peut prouver', () => {

  test('un écart ne se calcule pas entre deux périmètres', () => {
    /* La courbe de plus-value latente retranchait un prix de revient de
       portefeuille d'une poche de releve. Les deux ne couvrent pas le meme
       ensemble : la poche « bourse » d'un releve porte la valeur entiere des
       comptes, especes du courtier comprises, quand le prix de revient ne
       couvre que les positions. L'ecart compte donc le cash comme du gain, et
       sur le fixture il le compte a l'euro pres. */
    Fixture.poser();
    const row = Store.state.monthly[0];
    const vrai0 = latentPnl().pnl;
    const faux = rowGroups(row).bourse - portfolioPnl().invested;
    pres(faux - vrai0, Fixture.CASH_A_INVESTIR,
      'le cash qui dort chez le courtier se lisait comme une plus-value');

    /* Le perimetre ne se rattrape pas apres coup : un releve ne dit pas quelle
       part d'un compte etait investie ce mois-la. Le calcul est donc parti, et
       avec lui le champ que plus personne ne lisait. */
    const store = lireSource('assets/store.js');
    const app = lireSource('assets/app.js');
    vrai(store && app, 'les deux sources doivent être lisibles');
    vrai(!/function latentSeries/.test(store),
      'aucun calcul ne mélange plus les deux périmètres');
    vrai(!/latentSeries\(/.test(app), 'et aucun écran ne l’appelle');
    vrai(!/\brow\.inv\s*=/.test(app),
      'plus d’écriture d’un champ que rien ne lit : un champ mort dérive en silence');
  });

  test('un pourcentage n’existe que sur une base positive', () => {
    /* « +0,00 % » s'affichait sur une plage sans une seule vente, ce qui affirme
       une performance nulle la ou il n'y a rien eu. Et `fmtSignedPct` ne peut pas
       s'en apercevoir : elle rend « +0,00 % » pour 0 comme pour null, le signe
       venant d'une comparaison que null passe. C'est donc au calcul de se taire. */
    eq(statsDesVentes([]).pct, null, 'aucune vente, aucune base, aucun pourcentage');

    Fixture.poser();
    declarerVente({ date: '2026-03-01', name: 'Cadeau', gross: 300, realised: 300 });
    const st = salesStats('all');
    pres(st.invested, 0, 'une ligne encaissee sans prix de revient');
    eq(st.pct, null, 'et son pourcentage se tait plutôt que de valoir l’infini');
    pres(st.realised, 300, 'l’euro, lui, reste dit');

    Fixture.poser(s => { for (const p of s.positions) p.buyPrice = 0; });
    const lat = latentPnl();
    pres(lat.invested, 0, 'des lignes sans prix de revient');
    eq(lat.pct, null, 'pas de base, pas de pourcentage');
    /* Cette assertion-ci affirmait le contraire, et elle avait tort : sans
       base, « valeur − 0 » rendait la valeur entiere du portefeuille et le
       controle exigeait qu'elle soit positive. Un controle peut graver un
       defaut a la place de la regle qu'il croit tenir. */
    pres(lat.pnl, 0, 'et l’euro se tait avec lui : sans base, rien à mesurer');
  });

  test('les écrans se taisent avec le calcul', () => {
    /* Une garde dans le calcul ne suffit pas : c'est l'ecran qui imprime. Sept
       surfaces affichaient ce pourcentage, dont deux apercus et un export. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* La garde peut tenir sur la meme ligne ou deux lignes plus haut, dans un
       ternaire etale : on la cherche dans ce qui precede immediatement, et sur
       la meme variable — une garde sur `lat` ne protege pas `tout`. */
    const restants = [...src.matchAll(/fmtSignedPct\((lat|tout|pnl|st|vus)\.pct/g)]
      .filter(m => !src.slice(Math.max(0, m.index - 220), m.index)
        .includes(`${m[1]}.pct == null`));
    eq(restants.length, 0,
      `un pourcentage imprimé sans garde : ${restants.map(m => m[0]).join(', ')}`);
    vrai(/st\.pct == null \? null : round2\(st\.pct\)/.test(src),
      'et l’export met une cellule vide, pas un zéro qui se moyennerait');
  });

  test('un seul calcul pour la plus-value du portefeuille', () => {
    /* `portfolioPnl` et `latentPnl` sommaient les memes positions chacun de son
       cote. Deux exemplaires d'une meme somme finissent par dire deux choses :
       celui-ci rendait encore 0 % sur une base nulle quand l'autre se taisait. */
    Fixture.poser();
    const a = portfolioPnl(), b = latentPnl();
    for (const cle of ['value', 'invested', 'pnl']) pres(a[cle], b[cle], `${cle} doit être unique`);
    eq(a.pct, b.pct, 'le pourcentage aussi, y compris quand il est nul');
    const store = lireSource('assets/store.js');
    vrai(/function portfolioPnl\(\) \{ return latentPnl\(\); \}/.test(store),
      'un nom de plus, pas un calcul de plus');
  });

  test('un chiffre de marché dit de quand il date', () => {
    /* La plus-value latente vaut ce que les cours disent : « +950 € » sans une
       date, ou « depuis le debut » qui ne date rien, ne dirait pas de quand est
       ce chiffre. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai(/function barreEtatCours\(\)/.test(src),
      'la barre est une fonction : deux exemplaires porteraient deux boutons');
    /* Un seul endroit declare le bouton, deux l'appellent. La verification porte
       sur l'identifiant, qui doit rester unique dans la page rendue. */
    eq((src.match(/id="btnQuotes"/g) || []).length, 1,
      'un seul btnQuotes déclaré, sinon deux nœuds partagent un identifiant');
    /* Deux appels avant, un seul depuis que Performance est partie : la barre
       n'est plus appelee que par Positions. Le compte reste verifie plutot
       qu'efface — c'est lui qui interdit un second exemplaire du bouton. */
    eq((src.match(/barreEtatCours\(\)/g) || []).length, 2,
      'une définition et un appel : Positions');

  });

  test('chaque vente s’ouvre, et son détail porte ce que les tuiles disaient', () => {
    /* Trois tuiles annoncaient le produit encaisse, le prix de revient cede et le
       taux de reussite : trois totaux de page pour des faits qui appartiennent a
       chaque vente, et dont deux se relisaient en tete de page. Elles sont parties,
       le detail de la vente les porte, et le tableau de dix colonnes est devenu la
       liste cliquable que la regle de la maison impose au-dela de trois. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/function salesCard\(\) \{[\s\S]*?\nfunction lignesJournalVentes\([\s\S]*?\n\}/)[0];
    vrai(/ligneListe\(\{/.test(bloc) && /action: 'open-sale'/.test(bloc),
      'chaque vente est une ligne cliquable, le nom lu est le bouton cliqué');
    /* `.liste-mobile` est le repli d'une grille : elle est en `display: none`
       au-dela de 768 px. Une liste qui remplace un tableau au lieu de le doubler
       doit porter `.liste-principale`, sinon elle est invisible sur un ecran
       large — le depliant s'ouvrait sur du vide, et rien dans le balisage ne le
       disait. */
    vrai(/class="liste-principale"/.test(bloc + src.slice(src.indexOf('function htmlJournal('), src.indexOf('function remplirJournal('))) && !/class="liste-mobile"/.test(bloc),
      'la liste est la lecture principale, pas le repli d’une grille qui n’existe plus');
    const css = lireSource('assets/styles.css');
    vrai(/\.liste-principale \{ display: block; \}/.test(css),
      'et cette classe s’affiche à toutes les largeurs');
    vrai(!/liste-releves/.test(css) && !/liste-releves/.test(src),
      'un seul nom pour cette idée : celui qui nommait la première carte a été généralisé');
    vrai(!/<table>/.test(bloc),
      'plus de tableau de dix colonnes, qui débordait latéralement sous 768 px');
    vrai(!/Produit des ventes|Prix de revient vendu', st\.invested|Ventes gagnantes/.test(bloc),
      'ni les trois tuiles, dont deux redisaient la tête de page');
    vrai(!/data-action="del-sale"/.test(bloc),
      'l’annulation quitte la liste : un geste irréversible collé au geste de lecture');

    /* Deux lectures du journal, et le tri par montant est signe : la plus grosse
       plus-value en tete, les pertes en queue. Trier sur la valeur absolue aurait
       mis la pire perte au sommet du classement des gains. */
    vrai(/data-action="tri-ventes" data-tri="date"/.test(bloc)
      && /data-action="tri-ventes" data-tri="montant"/.test(bloc),
      'le journal se lit par date ou par montant');
    /* Le tri vit desormais dans `journalVentes`, cote modele, avec un departage
       stable par la place dans l'etat. */
    vrai(/const cle = v => \{ const r = resultatVente\(v\); return r\.fiable \? r\.montant : -Infinity; \};/.test(lireSource('assets/store.js')),
      'et le tri par montant est signé, du plus gros gain à la pire perte');
    vrai(/let triVentes = 'date';/.test(src),
      'la date reste le défaut : un journal est un récit avant d’être un classement');

    const ap = src.slice(src.indexOf('vente: (i) =>'), src.indexOf('vente: (i) =>') + 3600);
    vrai(ap.length > 500, 'l’aperçu d’une vente doit être trouvable');
    for (const champ of ['Produit encaissé', 'Prix de revient vendu', 'Plus-value']) {
      vrai(ap.includes(champ), `le détail porte « ${champ} », que la tuile disait pour la page`);
    }
    vrai(/data-action="del-sale" data-i="\$\{idx\}"/.test(ap),
      'et l’annulation, là où le geste a la place de dire ce qu’il emporte');
    vrai(!/ventesRealisees/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
      'l’aperçu de la tuile disparue est parti avec elle : une fonction sans appelant '
      + 'est la moitié qu’on oublie');

    /* Un panneau ne survit pas a ce qu'il decrit : il porte le bouton qui retire
       la vente, et son rafraichissement sortirait en silence faute de la
       retrouver — donc un ecran fige sur des montants qui n'existent plus. */
    /* Modifier une vente : la frontiere est celle des consequences. Date, nom et
       note ne touchent a rien d'autre. Les montants d'une vraie vente ont credite
       un compte et reduit une ligne : les corriger apres coup ferait dire au
       journal 900 EUR quand 944 sont arrives, sans que rien ne le signale. */
    const ed = src.slice(src.indexOf("async 'edit-sale'"), src.indexOf("async 'edit-sale'") + 3000);
    vrai(ed.length > 500, 'l’édition d’une vente doit être trouvable');
    for (const champ of ['date', 'name', 'note']) {
      vrai(new RegExp(`cle: '${champ}'`).test(ed), `« ${champ} » se modifie sur toute vente`);
    }
    vrai(/\.\.\.\(v\.declaree \? \[/.test(ed),
      'les montants ne s’offrent que sur une vente déclarée, qui n’a rien écrit d’autre');
    vrai(/lecture: true/.test(ed),
      'et sur une vraie vente ils s’affichent en lecture, pas en champ grisé');
    vrai(/annuler cette vente, puis la ressaisir/.test(ed),
      'la fenêtre dit le chemin exact au lieu de laisser chercher');
    vrai(/if \(v\.declaree\) \{[\s\S]{0,400}?v\.invested = round2\(v\.gross - v\.realised\)/.test(ed),
      'le prix de revient se dérive : trois champs pour deux libertés se contrediraient');

    vrai(/function fermerApercuSi\(cle\)/.test(src), 'la fermeture existe');
    eq((src.match(/fermerApercuSi\('vente'\)/g) || []).length, 3,
      'et elle est appelée par chaque annulation : déclarée, de titres, d’un bien');
  });

  
  
  
  
  test('la carte du journal n’a plus de phrase hors traduction', () => {
    /* La reserve fiscale etait posee sans `trad()` : elle s'affichait en francais
       dans les deux langues, et le rattrapage de traduction ne pouvait pas la
       voir, faute d'appel a chercher. C'etait la derniere de cette carte.

       Le controle porte sur la carte entiere plutot que sur cette phrase : toute
       ligne de texte affiche qui porte un accent doit passer par `trad()`, sans
       quoi la suivante repassera par le meme trou. */
    const src = lireSource('assets/app.js');
    const carte = src.match(/function salesCard\(\) \{[\s\S]*?\n\}/)[0];
    const nu = carte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    const dehors = nu.split('\n').filter(l =>
      /[àâéèêëîïôùûç]/i.test(l) && !/trad\(/.test(l) && !/^\s*\+ '/.test(l));
    eq(dehors.join(' | ').trim(), '',
      'ces lignes affichent du français sans passer par trad()');
    vrai(I18N.en['Résultat brut, avant frais et fiscalité : le traitement fiscal dépend de '
      + 'l’enveloppe (PEA, CTO) et de ta situation.'],
      'et la réserve fiscale a son anglais');

    /* « 7 ventes sur 11 » compte une part d'un ensemble : « of ». La clef
       `sur.investis` rend « on », juste devant un montant investi, et le journal
       affichait « 7 sales on 11 ». Un homographe, une clef par sens. */
    vrai(/trad\('sur\.total', 'sur'\)/.test(carte),
      'le « sur » du décompte a sa propre clef');
    eq(I18N.en['sur.total'], 'of', 'qui rend « of » et non « on »');
    eq(I18N.en['sur.investis'], 'on', 'l’autre sens reste intact');
  });

  test('les libellés nouveaux ont leur anglais, les anciens sont partis', () => {
    for (const cle of ['Résultat de tes positions', 'latente et encaissée, depuis le début',
                       'Aller à Positions', 'prix de revient non renseigné',
                       'vente gagnante', 'vente gagnante sur', 'ligne détenue',
                       'aucune ligne détenue',
                       'Une plus-value se mesure sur des lignes que tu détiens : la latente vient '
                       + 'de leur prix de revient, l’encaissée du journal de tes ventes. Pose une '
                       + 'première ligne et cette page se remplit toute seule.']) {
      vrai(I18N.en[cle], `« ${cle} » doit avoir son anglais`);
    }
    for (const morte of ['Lignes en gain', 'Résultat total', 'Plus-value latente dans le temps',
                         'latente + réalisée depuis le début']) {
      vrai(!I18N.en[morte], `« ${morte} » ne s’affiche plus : sa clé n’a plus à vivre`);
    }
  });
});

/* ------------------------------------------------------------------
   Une categorie porte un total, et rien d'autre
   ------------------------------------------------------------------ */
suite('Une catégorie porte un total, et rien d’autre', () => {

  test('le détail par catégorie est parti, code et données', () => {
    const app = lireSource('assets/app.js');
    const store = lireSource('assets/store.js');
    const css = lireSource('assets/styles.css');
    vrai(app && store && css, 'les trois sources doivent être lisibles');

    /* Le detail vivait dans `d`, a cote du total : deux surfaces d'edition pour
       une seule valeur, et tout le mal venait de les reconcilier. Retaper le total
       effacait les libelles, le champ principal ne pouvait etre a la fois un total
       et une porte, et la somme tapee au clavier n'existait pas sur un pave
       numerique. Qui veut suivre deux choses separement fait deux categories. */
    for (const mort of ['recalerDetail', 'setExpenseDetail', 'clearExpenseDetail',
                        'expenseDetail', 'libellesConnus']) {
      eq(store.split(mort).length - 1, 0, `${mort} est parti de store.js`);
    }
    for (const mort of ['majPastille', 'rendreDetail', 'ajouterLigne', 'majPorte',
                        'NOM_DETAIL_MAX', 'sheetExpenseDetail', 'aDuDetailDepenses']) {
      eq(app.split(mort).length - 1, 0, `${mort} est parti d’app.js`);
    }
    for (const mort of ['dep-dl', 'dep-detail', 'dep-plus', 'dep-chev', 'champ-porte']) {
      eq(css.split(mort).length - 1, 0, `la classe ${mort} est partie du CSS`);
    }
  });

  test('la purge du champ est jouée une fois, et deux fois donne le même état', () => {
    /* Un champ que plus aucun ecran ne lit deviendrait invisible sans disparaitre,
       et il sortirait encore dans les sauvegardes. La migration l'efface, et la
       rejouer ne change rien — c'est la regle de toutes les migrations ici. */
    Fixture.poser(s => {
      s.budget.expenses[0].d = { Courses: [{ montant: 10, libelle: 'Marché' }, { montant: 20, libelle: '' }] };
      delete s.meta.detailRetire;
    });
    Store.migrate();
    eq(Store.state.budget.expenses[0].d, undefined, 'le champ est effacé');
    eq(Store.state.meta.detailRetire, true, 'et la migration se marque');
    const apres = JSON.stringify(Store.state.budget.expenses);
    Store.migrate();
    eq(JSON.stringify(Store.state.budget.expenses), apres, 'la rejouer ne change rien');
    /* Le total du mois, lui, n'a pas bouge : `v` a toujours ete la seule verite,
       et c'est ce qui rend cette suppression sans consequence sur les chiffres. */
    Fixture.poser();
    const avant = expenseRowTotal(Store.state.budget.expenses[0]);
    Store.migrate();
    pres(expenseRowTotal(Store.state.budget.expenses[0]), avant,
      'et aucun total de mois ne change');
  });

  test('le champ accepte une somme, et le « + » l’écrit', () => {
    /* La somme tapee reste, elle : c'est desormais le seul moyen de mettre deux
       depenses dans une categorie, et le pave numerique d'un telephone n'a pas la
       touche. Le bouton est le seul « + » de la fenetre, donc sans ambiguite. */
    pres(parseSomme('100+50+70')?.total, 220, 'trois termes font leur somme');
    eq(parseSomme('157+'), null, 'une somme inachevée reste invalide');

    const app = lireSource('assets/app.js');
    const corps = app.slice(app.indexOf('function askExpenseMonth'), app.indexOf('id="depNote"'));
    /* Le compte se fait sur `champSomme`, pas sur le corps de la fenetre. Le
       premier exemplaire de ce controle comptait « >+< » dans la fenetre et
       trouvait 1 : c'etait le « + » en gras du paragraphe d'aide, le bouton etant
       ecrit ailleurs. Il serait passe au vert sans aucun bouton. */
    const cs = app.slice(app.indexOf('function champSomme'), app.indexOf('function insererPlus'));
    eq((cs.match(/>\+</g) || []).length, 1, 'le champ porte un « + », et un seul');
    eq((corps.match(/champSomme\(/g) || []).length, 1,
      'posé une seule fois, sur le champ de montant');
    eq((corps.match(/>\+</g) || []).length, 0,
      'et la fenêtre n’en décore aucun autre : deux « + » de sens différents ne se distinguaient par rien');
    vrai(/champSomme\(`<input type="text" inputmode="decimal" data-cat=/.test(corps),
      'il est dans le champ, là où la place est libre à gauche des montants');
    const f = app.slice(app.indexOf('function insererPlus'), app.indexOf('function cablerSommePlus'));
    vrai(/champ\.value = `\$\{texte\}\+`;/.test(f), 'il s’ajoute à la suite');
    /* La garde s'ecrit avec un antislash, donc ce controle aussi : un document en
       ligne en mange un niveau, et l'assertion cherchait un chiffre la ou la source
       porte « \d ». Elle passait a cote sans rien dire de faux. */
    vrai(f.includes("if (!/\\d$/.test(texte)) { champ.focus(); return; }"),
      'jamais sur un champ vide ni deux fois de suite');
    vrai(/b\.onmousedown = e => e\.preventDefault\(\);/.test(app),
      'et il ne prend pas le focus, sinon le champ entier se resélectionne');

    /* L'aide dit un geste possible sur telephone, ce qui n'etait plus vrai entre
       le retrait du bouton et son retour. Elle se replie dans un « ? » : quatre
       lignes de texte occupaient le tiers d'un ecran de telephone et repoussaient
       le champ de note hors du cadre, pour une phrase qu'on lit une fois. */
    eq((corps.match(/class="hint"/g) || []).length, 0,
      'aucun pavé de texte dans la fenêtre');
    vrai(/\$\{aide\(trad\('Plusieurs dépenses dans une catégorie/.test(corps),
      'l’explication est une bulle, à côté du geste qu’elle concerne');
    /* La phrase est coupee sur trois lignes dans la source : on cherche un fragment
       qui tient d'un seul tenant, pas la phrase entiere. */
    vrai(/du champ écrit le signe, que le pavé /.test(corps),
      'l’aide nomme le bouton et dit pourquoi il existe');
    vrai(/fais deux catégories/.test(corps),
      'et donne la sortie pour qui veut vraiment séparer deux choses');
  });
});

suite('Un mois se corrige au doigt, ou dans un tableau', () => {

  test('la paire de boutons passe à la ligne d’un seul bloc', () => {
    /* En-tete de carte souple, les deux boutons tombaient un par un : « + Rentree »
       restait en haut a droite contre le selecteur d'annee, « + Depense » descendait
       seul a gauche sous le sous-titre. Deux entrees de la meme paire lues comme
       deux commandes sans rapport. Un seul element de flex, donc un seul point de
       rupture. */
    const src = lireSource('assets/app.js');
    const css = lireSource('assets/styles.css');
    /* Il en reste une, celle du journal des apports : les deux entrees du journal
       des ventes ont fusionne en un seul bouton, la nature se choisissant dans le
       menu de la fenetre. La regle vaut pour toute paire, pas pour celle-la :
       chacune porte exactement deux boutons — trois ne seraient plus une paire, et
       la grille leur donnerait trois colonnes. */
    const paires = [...src.matchAll(/class="paire-btn">([\s\S]*?)<\/span>/g)].map(m => m[1]);
    vrai(paires.length >= 1, `au moins une paire doit être trouvable, ${paires.length} trouvée(s)`);
    paires.forEach((p, n) => {
      eq((p.match(/<button/g) || []).length, 2,
        `la paire ${n + 1} porte deux boutons, et ils sont dans le même élément`);
    });
    const regle = (css.match(/\.paire-btn \{[^}]*\}/) || [''])[0];
    vrai(/display: grid/.test(regle),
      'la paire est une grille : en flex, la longueur du libellé décidait de la largeur');
    vrai(/grid-auto-flow: column/.test(regle), 'ses boutons se suivent en colonnes');
    vrai(/grid-auto-columns: 1fr/.test(regle),
      'de largeur égale, celle du libellé le plus long');
    vrai(!/wrap/.test(regle),
      'et rien n’y passe à la ligne : c’est tout le point de la mettre ensemble');
  });

  test('un tableau défile en largeur, jamais en hauteur', () => {
    /* Le detail mensuel enfermait douze mois dans 60 vh : sur un ecran de 900 px,
       on faisait defiler un tableau a l'interieur d'une page qui defile deja, et la
       barre du conteneur se confondait avec celle du navigateur. La largeur garde
       son defilement — onze categories ne rentrent dans aucun ecran — la hauteur
       n'a que le nombre de mois, et le selecteur d'annee la borne. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('<div class="table-wrap large-seulement"');
    vrai(i > 0, 'le conteneur du détail mensuel doit être trouvable');
    const balise = src.slice(i, src.indexOf('>', i) + 1);
    vrai(!/max-height/.test(balise),
      'aucun plafond de hauteur : le tableau s’affiche en entier');
    vrai(!/overflow-y/.test(balise),
      'et aucun défilement vertical posé à la main');
    /* Ancre en debut de ligne : `.table-wrap` apparait aussi au milieu d'un
       selecteur groupe, `.grid > *, .card, .table-wrap { min-width: 0 }`, et la
       recherche tombait dessus — une regle vraie, mais pas celle qu'on verifie. */
    const css = lireSource('assets/styles.css');
    const regle = (css.match(/^\.table-wrap \{[^}]*\}/m) || [''])[0];
    vrai(/overflow-x: auto/.test(regle),
      `la largeur, elle, garde le sien ; règle lue : « ${regle || 'aucune'} »`);
  });

  test('le tableau de correction n’existe plus du tout', () => {
    /* Il ne se proposait deja plus sous 767 px : quinze colonnes dans un
       conteneur qui defile, quand la liste juste au-dessus ouvrait le meme mois
       dans une fenetre qui tient dans l'ecran. Deux surfaces pour la meme
       saisie, dont une inutilisable au doigt.

       Le reserver aux grands ecrans etait un demi-geste. La fenetre du mois
       fait tout ce que le tableau faisait — la reprise des montants actuels, la
       correction compte par compte, la note, l'effacement — et elle le fait
       partout. Ce qui reste doit donc etre parti : le depliant, ses deux
       actions et le ⤒ de chaque ligne. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewHistory('),
                          src.indexOf('function mountHistory('));
    vrai(vue.length > 500, 'la vue doit être trouvable');
    vrai(!/<table/.test(vue),
      'plus un seul tableau dans le journal : la liste EST l’affichage');
    vrai(!/large-seulement/.test(vue),
      'et donc plus de bloc réservé aux grands écrans');
    for (const mort of ["'snapshot-row'", "'add-month'", "'del-month'"]) {
      vrai(!src.includes('  ' + mort + '('),
        `l’action ${mort} n’a plus de bouton pour l’appeler : elle doit partir`);
    }
    /* Ce que la fenetre doit porter en echange, sans quoi la suppression aurait
       retire des fonctions au lieu d'en deplacer. */
    vrai(/id="relPhoto"/.test(src), 'la reprise des montants actuels vit dans la fenêtre');
    vrai(/id="relVider"/.test(src), 'l’effacement du mois aussi');
    vrai(/id="relCloture"/.test(src), 'et l’option des comptes clôturés');
  });

  test('rien ne devient inatteignable : la fenêtre du mois efface aussi', () => {
    /* Le tableau portait le seul ✕ de l'application sur un releve. Le cacher sans
       rendre le geste ailleurs aurait retire d'un telephone la seule facon d'effacer
       un mois saisi par erreur. */
    const src = lireSource('assets/app.js');
    vrai(/id="relVider"/.test(src), 'la fenêtre porte le bouton');
    vrai(/\$\('#relVider'\)\.onclick/.test(src), 'et il est câblé');
    vrai(/class="fiche-danger"[\s\S]{0,200}id="relVider"/.test(src),
      'en bas, à part et rouge, comme sur la fiche d’une ligne');

    /* La question se regle a un seul endroit : deux portes, un seul texte. */
    eq((src.match(/trad\('Effacer les montants de \{m\} \?'\)/g) || []).length, 1,
      'la question ne s’écrit qu’une fois');
    /* Le ✕ du tableau de correction appelait la meme fonction. Le tableau est
       parti, donc il ne reste qu'une porte, et c'est le bouton rouge de la
       fenetre : une definition, un appelant. Le compte le garde — un second
       exemplaire de la question reviendrait par la. */
    eq((src.match(/viderOuSupprimerMois\(/g) || []).length, 2,
      'une définition et un seul appelant : le bouton rouge de la fenêtre');
    vrai(!/'del-month'/.test(src),
      'l’action du ✕ est partie avec son bouton, pas gardée au cas où');
  });

  test('« Ligne supprimée » ne dit pas « Holding deleted » pour un mois', () => {
    /* La clef-phrase etait deja prise par le portefeuille, ou une ligne est une
       position. Reutiliser la clef aurait fait dire « Holding deleted » a la
       suppression d'un releve ; changer sa traduction aurait casse l'autre. */
    enLangue('en', () => {
      eq(trad('releve.ligneSupprimee', 'Ligne supprimée'), 'Row deleted',
        'un relevé supprimé est une ligne, pas une position');
      eq(trad('releve.supprimerLigne', 'Supprimer cette ligne'), 'Delete this row',
        'et le bouton de même');
      eq(trad('Ligne supprimée'), 'Holding deleted',
        'la clef du portefeuille garde son sens');
    });
    enLangue('fr', () => eq(trad('releve.ligneSupprimee', 'Ligne supprimée'), 'Ligne supprimée',
      'et le français passe par le repli'));
  });
});

suite('Les fiches et les marchés parlent anglais en anglais', () => {

  /* Le releve de la panne : sur une application chargee en anglais, une fiche de
     compte disait « Compte courant », « Financement », « facultatif », et la page
     des marches « cours from yesterday at 22:00 » — la moitie francaise d'une
     phrase dont l'autre moitie etait traduite. Trois familles de causes, et une
     seule mesure honnete : lire le DOM d'une page vraiment chargee en anglais.
     Ce qui suit garde les trois portes fermees. */

  test('aucun attribut affiché ne porte du français en dur', () => {
    /* Un `title` ou un `aria-label` ecrit en clair dans le balisage ne passe par
       aucune fonction : il n'a aucune chance d'etre traduit un jour. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const nu = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    const fautes = [...nu.matchAll(/\b(placeholder|title|aria-label)="([^"${}<>]*[àâäéèêëîïôöùûüçœ][^"${}<>]*)"/g)]
      .map(m => `${m[1]}="${m[2]}"`);
    eq(fautes.join(' | '), '', 'ces attributs ne passeront jamais par trad()');
  });

  test('une bulle d’aide reçoit une phrase traduite, jamais une chaîne nue', () => {
    /* `aide()` pose son texte dans un attribut : elle ne traduit pas, elle
       transporte. Deux bulles longues sont restees francaises par ce chemin. */
    const src = lireSource('assets/app.js');
    const nu = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const nues = [...nu.matchAll(/\baide\(\s*['"]([^'"]{6,})/g)].map(m => m[1].slice(0, 45));
    eq(nues.join(' | '), '', 'aide() reçoit une chaîne nue : elle restera française');
  });

  test('les libellés statiques d’index.html ont tous leur anglais', () => {
    /* Douze titres et intitules vivaient dans le balisage statique, hors
       d'atteinte de `trad()`. `translateStatic()` les traduit desormais par leur
       valeur : le francais qui s'y trouve EST la clef, donc chacun doit en avoir
       une, sans quoi la traduction est un silence. */
    const html = lireSource('index.html');
    vrai(html, 'index.html doit être lisible pour ce contrôle');
    const corps = html.replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/g, ' ');
    const sans = [...corps.matchAll(/\b(title|aria-label|placeholder)="([^"]+)"/g)]
      .map(m => m[2])
      .filter(v => /[A-Za-zÀ-ÿ]{4}/.test(v) && !I18N.en[v]);
    eq([...new Set(sans)].join(' | '), '',
      'ces attributs statiques n’ont pas de traduction anglaise');
    vrai(/for \(const a of ATTRS_TRADUITS\)/.test(lireSource('assets/i18n.js')),
      'et translateStatic() parcourt bien les attributs');
  });

  test('l’ancienneté d’un cours se dit dans les deux langues', () => {
    /* Le nombre se place par gabarit : l'anglais met l'anciennete apres la
       duree, « 5 min ago », et deux fragments cousus dans l'ordre francais
       donneraient « ago 5 min ». */
    /* `fmtWhen()` vit dans app.js, que cette page ne charge pas : on lit son
       câblage dans la source et son vocabulaire dans le dictionnaire, et on
       compose comme elle le fait. */
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf('function fmtWhen'), src.indexOf('function fmtWhen') + 800);
    vrai(/return trad\('jamais'\)/.test(f), 'sans date, une phrase traduite');
    vrai(/trad\("à l'instant"\)/.test(f), 'et à l’instant aussi');
    vrai(/trad\('il y a \{n\} min'\)\.replace\('\{n\}', mins\)/.test(f),
      'les minutes passent par un gabarit, pas par une concaténation');
    enLangue('fr', () => {
      eq(trad('jamais'), 'jamais', 'le français passe par le repli');
      eq(trad('il y a {n} min').replace('{n}', 5), 'il y a 5 min', 'et l’ordre français');
    });
    enLangue('en', () => {
      eq(trad('jamais'), 'never', 'sans date, never');
      eq(trad('il y a {n} min').replace('{n}', 5), '5 min ago',
        'et l’ordre anglais, pas « ago 5 min »');
    });
  });

  test('le compte des lignes non cotées s’accorde, dans les deux langues', () => {
    /* Le francais a deux formes, « une ligne n'a pas cote » et « deux lignes
       n'ont pas cote », l'anglais une seule : le pluriel se choisit avant la
       traduction, jamais en cousant un « s » a la sortie. */
    for (const cle of ['{n} ligne sur {t} n’a pas encore coté aujourd’hui',
                       '{n} lignes sur {t} n’ont pas encore coté aujourd’hui']) {
      enLangue('en', () => {
        const dit = trad(cle);
        vrai(dit !== cle, `« ${cle.slice(0, 20)}… » a son anglais`);
        vrai(dit.includes('{n}') && dit.includes('{t}'),
          'et garde ses deux nombres, sinon le compte disparaît');
      });
    }
  });

  test('le préfixe d’un cours et l’heure qu’il porte parlent la même langue', () => {
    /* La faute d'origine, et la plus visible : « cours » en dur devant une heure
       que `fmtCoursQuand()` rendait deja en anglais. */
    const src = lireSource('assets/app.js');
    eq((src.match(/`cours \$\{/g) || []).length, 0, 'plus un seul préfixe « cours » en dur');
    enLangue('en', () => eq(trad('cours'), 'price', 'et le mot a son anglais'));
  });
});

suite('Aucun dialogue ne parle français en dur', () => {

  /* Un dialogue non traduit est un consentement qu'on n'a pas vraiment obtenu :
     c'est le moment ou l'on s'apprete a supprimer quelque chose, et ou il faut
     comprendre ce qui est demande. Vingt-huit confirmations et neuf avis etaient
     dans ce cas.

     Le controle se fait sur les appels, pas sur des mots-clefs : on isole
     l'argument par appariement de parentheses, on neutralise les `trad()` qui s'y
     trouvent, et ce qui reste ne doit plus porter d'accent. */

  const finAppel = (s, i) => {
    let prof = 0, chaine = null;
    while (i < s.length) {
      const c = s[i];
      if (chaine) {
        if (c === '\\') { i += 2; continue; }
        if (c === chaine) chaine = null;
        i++; continue;
      }
      if (c === '\'' || c === '"' || c === '`') chaine = c;
      else if (c === '(') prof++;
      else if (c === ')') { prof--; if (!prof) return i + 1; }
      i++;
    }
    return -1;
  };
  /* Un accent, et non l'apostrophe typographique : l'anglais de cette
     application ecrit « yesterday’s » avec la meme. Ni le ×, qui vit dans
     « quantity × price ». */
  const ACCENT = /[àâäéèêëîïôöùûüÿçœÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒ]/;

  const neutraliserTrad = (bloc) => {
    for (let tour = 0; tour < 6; tour++) {
      let change = false;
      const re = /\b(?:trad|t)\(/g;
      let m;
      while ((m = re.exec(bloc))) {
        const j = finAppel(bloc, m.index + m[0].length - 1);
        if (j < 0) continue;
        const dedans = bloc.slice(m.index, j);
        if (!ACCENT.test(dedans)) continue;
        bloc = bloc.slice(0, m.index) + ' '.repeat(j - m.index) + bloc.slice(j);
        change = true;
        re.lastIndex = 0;
      }
      if (!change) break;
    }
    return bloc;
  };

  const appelsFautifs = (src, nom) => {
    const out = [];
    let i = 0;
    while ((i = src.indexOf(nom + '(', i)) >= 0) {
      if (/[\w.$]/.test(src[i - 1] || ' ')) { i += nom.length + 1; continue; }
      const j = finAppel(src, i + nom.length);
      if (j < 0) break;
      const bloc = src.slice(i, j);
      /* Les interpolations sont des expressions, pas du texte. Et l'objet
         d'options en fin d'appel non plus : `askConfirm` traduit lui-meme les
         libelles `ok` et `refus`, donc leur français y est la clef. */
      const reste = neutraliserTrad(bloc)
        .replace(/\$\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, ' ')
        .replace(/,\s*\{[^{}]*\}\s*\)$/, ')');
      if (ACCENT.test(reste)) out.push(bloc.slice(0, 120).replace(/\s+/g, ' '));
      i = j;
    }
    return out;
  };

  test('chaque confirmation et chaque avis passent par trad()', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    for (const nom of ['askConfirm', 'toast']) {
      const fautifs = appelsFautifs(src, nom);
      eq(fautifs.join('\n  '), '', `${nom}() reçoit du français en dur`);
    }
  });

  test('la fenêtre à un champ traduit ses trois textes, une fois pour toutes', () => {
    /* `askText` recevait titre, message et exemple en français de dix appelants :
       traduire chez l'appelant demandait d'y penser dix fois. */
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf('function askText'), src.indexOf('function askForm'));
    vrai(/\$\('#modalTitle'\)\.textContent = trad\(titre\)/.test(f), 'le titre');
    vrai(/message \? trad\(message\) : ''/.test(f), 'le message');
    vrai(/placeholder="\$\{esc\(trad\(exemple\)\)\}"/.test(f), 'et l’exemple');
    const g = src.slice(src.indexOf('function askForm'), src.indexOf('function askForm') + 1200);
    vrai(/\$\('#modalTitle'\)\.textContent = trad\(titre\)/.test(g),
      'et la fenêtre à plusieurs champs traduit le sien');
  });

  test('un nombre entre dans une phrase par gabarit, pas par couture', () => {
    /* « il y a 5 min » et « 5 min ago » n'ont pas le meme ordre : coudre les
       fragments dans l'ordre francais donnerait « ago 5 min ». Les clefs a
       gabarit portent {n}, {m}, {v}, {d}, {t}, {p}, {c}, {ou} ou {types}, et
       leur anglais doit garder le meme. */
    const trous = /\{(?:n|m|v|d|t|p|c|ou|types)\}/g;
    const fautes = [];
    for (const [fr, en] of Object.entries(I18N.en)) {
      /* Une clef pointee n'est pas une phrase : son français vit dans `FR`, et
         comparer les gabarits de la clef a ceux de sa traduction n'a pas de sens. */
      if (/^[\w.]+$/.test(fr)) continue;
      const dans = (String(fr).match(trous) || []).sort().join('');
      const sort = (String(en).match(trous) || []).sort().join('');
      if (dans !== sort) fautes.push(`${fr.slice(0, 40)} → ${en.slice(0, 40)}`);
    }
    eq(fautes.join(' | '), '', 'un gabarit perdu en traduction fait disparaître un nombre');
  });
});

/* ------------------------------------------------------------------
   L'ordre des cartes d'un écran. Il ne se voit pas dans un calcul et
   aucun rendu ne le signale : un bloc déplacé à la main se remet en
   place au prochain coup d'éditeur, sans que rien ne casse.
   ------------------------------------------------------------------ */
suite('Une page s’ouvre sur son sujet, et se corrige à la fin', () => {

  const positions = (src, ...reperes) => reperes.map(r => src.indexOf(r));
  const croissant = (l) => l.every((n, i) => n > 0 && (i === 0 || n > l[i - 1]));

  test('Dépenses : lire d’abord, corriger ensuite', () => {
    /* Le tableau de correction, 880 px, s'intercalait entre la repartition, le
       graphique des mois et les categories : on traversait l'outil de saisie pour
       atteindre la lecture. C'est l'argument qui a deja range l'onglet voisin. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget('), src.indexOf('function viewData('));
    const l = positions(vue,
      "trad('Où va ce que tu gagnes')",
      "trad('Dépenses mensuelles')",
      "trad('Par catégorie')",
      'data-anchor="detail-mensuel"');
    vrai(croissant(l), `l’ordre attendu est répartition, graphique, catégories, détail : ${l.join(' < ')}`);
  });

  test('Données : ce qu’on vient y faire d’abord, le diagnostic replié, la destruction en dernier', () => {
    /* « Etat » comptait des lignes internes, des kilo-octets et un numero de
       version, au meme poids visuel que « Exporter » et « Sauvegardes » : ce sont
       des chiffres precieux le jour ou quelque chose cloche, et sans usage le
       reste du temps. Le premier niveau d'une page nommee « Donnees » appartient
       a ce qu'on vient y faire.

       L'ordre reste celui de la maison : ce qui fait lire, ce qui agit, puis ce
       qui detruit. Le diagnostic est passe derriere les actes, mais devant la
       remise a zero. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewData('), src.indexOf('function mountData('));
    const l = positions(vue,
      "trad('Contrôles de cohérence')",
      "trad('Sauvegarde et restauration')",
      "trad('Historique des sauvegardes')",
      "trad('Diagnostic')",
      'data-action="start-blank"');
    vrai(croissant(l),
      `l’ordre attendu est contrôles, transferts, sauvegardes, diagnostic, remise à zéro : ${l.join(' < ')}`);
    /* Et il est bien replie : une carte de plus l'aurait remis au premier plan
       sous un autre nom. */
    const i = vue.indexOf("trad('Diagnostic')");
    const ouverture = vue.lastIndexOf('<details', i);
    vrai(ouverture > 0 && i - ouverture < 200,
      'le diagnostic vit dans un dépliant, pas dans une carte');
    vrai(!/<h2>\$\{trad\('État'\)\}<\/h2>/.test(vue),
      'et la carte « État » n’existe plus sous ce nom');
  });

  test('Relevés : le journal qu’on vient remplir ouvre la page', () => {
    /* La carte « Notes de marche » reprenait, pour l'annee choisie, les
       commentaires des mois qui en portent un. Chaque ligne du journal affiche
       desormais sa note sous le mois, dans le meme ordre et sur la meme carte :
       la troisieme carte ne faisait plus que redire ce qui est a l'ecran, sans
       les montants qui donnent son sens a une note. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewHistory('), src.indexOf('function viewAccounts('));
    const l = positions(vue,
      "trad('Relevé mensuel du patrimoine')",
      "trad('Entrées et sorties exceptionnelles')");
    vrai(croissant(l), `l’ordre attendu est relevé puis apports : ${l.join(' < ')}`);
    vrai(!vue.includes('Notes de marché'),
      'et la carte des notes est partie : le journal les porte, ligne par ligne');
  });

  test('Aperçu : le patrimoine, un point, la répartition, la courbe, le suivi, puis l’objectif', () => {
    /* L'ordre de l'accueil est une donnee depuis qu'il se personnalise, et
       c'est l'ordre PAR DEFAUT que ce controle garde. La carte du portefeuille
       suit les poches, dont elle est le detail : elle porte le seul chiffre de
       la page qui bouge le jour meme. L'objectif ferme la page : c'est une
       affaire de mois, et sur telephone il ne doit plus occuper le premier
       ecran juste apres le point a retenir. */
    eq(CARTES_APERCU.join(' < '),
      'retenir < repartition < evolution < changements < titres < accumulation < reserve < objectif',
      'l’ordre par défaut');
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewOverview()'),
                          src.indexOf('function mountOverview()'));
    vrai(vue.length > 1000, 'la vue doit être trouvable');
    /* Le patrimoine n'est pas une carte de la liste : il se rend a part, avant
       toutes les autres, et rien ne peut le deplacer ni le masquer. */
    const l = positions(vue, 'class="hero"', '${cartes.tete}', '${cartes.suite}');
    vrai(croissant(l), `le patrimoine, puis les cartes dans l’ordre choisi : ${l.join(' < ')}`);
    vrai(!CARTES_APERCU.includes('patrimoine') && !CARTES_APERCU.includes('hero'), 'et le patrimoine n’est pas déplaçable');
    vrai(!vue.includes('chartPace'), 'et un seul graphique : le rythme est parti');
    /* Au quatrieme rang, un mur de zeros serait du bruit : la carte ne parait
       pas sans une seule ligne de titres. */
    const titres = src.slice(src.indexOf('function carteTitresResume()'), src.indexOf('class="pf-corps"'));
    vrai(/^function carteTitresResume\(\) \{\s*\n\s*if \(!aDesPositionsMarche\(\)\) return '';/.test(titres),
      'et sans une seule ligne de titres, elle ne paraît pas du tout');
  });

  test('Allocation : ce que c’est, où c’est posé, puis en combien de temps', () => {
    /* Trois axes sur la meme somme, et l'ordre dit lequel repond a la question
       qu'on se pose en ouvrant la page. « Par disponibilite » vient en dernier
       parce que c'est la lecture la moins familiere des trois — pas parce
       qu'elle vaut moins. Elle ne corrige rien et ne detruit rien, donc rien ne
       la tire plus bas que sa place. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewAllocation()'),
                          src.indexOf('function mountAllocation'));
    const l = positions(vue,
      'class="card repart"',
      "trad('Répartition.carte', 'Répartition')",
      'data-anchor="detention"',
      'data-anchor="disponibilite"');
    vrai(croissant(l),
      `l’ordre attendu est poches, répartition, emplacement, disponibilité : ${l.join(' < ')}`);

    /* ET LES INSIGHTS SE GLISSENT ENTRE LES POCHES ET LES RÉPARTITIONS.

       Ils avaient été posés tout en haut, donc avant le premier chiffre de la
       page : « 9,2 % de ton patrimoine sur Liquidités » s'annonçait à quelqu'un
       qui n'avait pas encore vu les poches, et la remarque suivante enchaînait
       sur une AUTRE base, la part investie. Deux bases avant d'avoir vu l'une ou
       l'autre — exactement ce que cette page s'interdit partout ailleurs.

       Un insight se lit après ce qui le fonde et avant ce qu'il fait regarder.
       Le contrôle l'exprime par un encadrement, et non par une position : la
       carte des poches d'un côté, la première répartition de l'autre. */
    const encadre = positions(vue,
      'class="card repart"',
      "trad('Répartition.carte', 'Répartition')",
      "carteInsights('allocation'");
    vrai(croissant(encadre),
      'les insights viennent après la carte des poches, qui porte la base, et '
      + `après la répartition, qu’ils commentent : ${encadre.join(' < ')}`);
  });
});

finDePartieDeTests('tests/13-changer-perimetre-se-voit.tests.js');
