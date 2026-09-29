partieDeTests('tests/14-boutons-fiche-ont-geometrie.tests.js');
suite('Les boutons d’une fiche ont une géométrie et une place', () => {

  /* Le signalement tenait en une phrase : « il y a pas un bouton pareil ». La
     carte « Actions » portait quatre boutons en deux rangees, deux qui validaient
     la visite entiere et deux qui decidaient de la vie du compte, au meme poids
     visuel sous un titre qui ne decrivait ni l'un ni l'autre. Un en-tete melangeait
     un lien souligne et des boutons. Et a 375 px un bouton qui passait a la ligne
     partait a gauche pendant que son voisin restait a droite.

     Trois regles en sortent, et ce sont elles que ces controles gardent. */

  test('la validation ferme la carte des champs, et rien d’autre', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* Rassembles avec Archiver et Cloturer-supprimer, les quatre boutons formaient
       un mur : quatre rectangles de meme taille sous un seul titre, sans ordre de
       lecture. La validation appartient au formulaire qu'elle valide. */
    const barre = src.slice(src.indexOf('function barreValiderFiche'),
                            src.indexOf('function barreValiderFiche') + 2400);
    vrai(/<div class="fiche-actes apres-champs">/.test(barre),
      'elle porte la géométrie commune, et le filet qui la sépare des champs');
    vrai(!/class="card"/.test(barre), 'et ne fabrique pas sa propre carte');
    /* Dans la fiche d'un compte, elle ferme la carte du solde quand la fiche en
       a une (c'est le champ qu'on revient corriger chaque mois), la carte
       « Mettre a jour » d'un bien, et sinon la carte des notes, ou elle suit le
       champ et reste dans la carte : la balise de fermeture vient apres elle.
       Jamais deux barres sur une meme fiche. */
    vrai(/data-path="comptes\.\$\{idx\}\.notes"[\s\S]{0,420}\$\{carteSolde \|\| estBien\(t\) \? '' : barreValiderFiche\(\)\}[\s\S]{0,12}<\/div>/.test(src),
      'dans la fiche d’un compte sans solde ni bien, au bas de la carte « Informations »');
    vrai(/<div class="card" data-anchor="solde">[\s\S]{0,6000}\$\{barreValiderFiche\('accounts', \(c\.cash \|\| \[\]\)\.length \? 'solde' : '', \{ parts: \(c\.cash \|\| \[\]\)\.length \}\)\}\s*<\/div>`\}/.test(src),
      'et au bas de la carte du solde quand la fiche en porte une');
    vrai(/<h2>\$\{trad\('Mettre à jour'\)\}<\/h2>[\s\S]{0,4000}\$\{barreValiderFiche\('accounts', 'bien', \{ credits: dettes\.length \}\)\}\s*<\/div>/.test(src),
      'et au bas de la carte « Mettre à jour » d’un bien');
    /* La fiche d'un etablissement n'a pas de carte « Actions » : rien ne s'y
       archive. Sa carte de champs est celle des notes. */
    vrai(/data-path="etabs\.\$\{idx\}\.notes"[\s\S]{0,220}\$\{barreValiderFiche\(\)\}[\s\S]{0,12}<\/div>/.test(src),
      'et dans celle d’un établissement, au bas de la carte « Notes »');
    /* La carte « Actions » ne garde que la vie du compte, et son titre le dit. */
    const i = src.indexOf("trad('actions.fiche', 'Actions')");
    const carte = src.slice(i, i + 1400);
    vrai(/data-action="(archiver|restaurer)-compte"/.test(carte), 'archiver y reste');
    vrai(/data-action="supprimer-compte"/.test(carte), 'supprimer aussi');
    vrai(!/enregistrer-fiche|annuler-fiche|barreValiderFiche/.test(carte),
      'mais pas la validation : quatre boutons de même taille sous un seul titre '
      + 'ne se lisent plus dans aucun ordre');
  });

  test('la validation vient avant ce qui détruit, et c’est une règle de pouce', () => {
    /* Les cartes se suivent : le doigt descendrait sur « Clôturer et supprimer »
       pour atteindre « Enregistrer ». */
    const src = lireSource('assets/app.js');
    const iBarre = src.indexOf("${barreValiderFiche('accounts', (c.cash || []).length ? 'solde' : ''");
    const iActions = src.indexOf("trad('actions.fiche', 'Actions')");
    vrai(iBarre > 0 && iActions > 0, 'les deux blocs doivent être trouvables');
    vrai(iBarre < iActions,
      'la validation se rend avant la carte qui décide de la vie du compte');
  });

  test('un en-tête de carte ne mélange pas un lien et des boutons', () => {
    const src = lireSource('assets/app.js');
    const css = lireSource('assets/styles.css');
    /* Le renvoi vers Marches etait un lien souligne au milieu de boutons. Il
       n'est plus un renvoi du tout : la fiche porte le geste, un bouton qui
       ouvre la recherche en visant ce compte. Une page qui doit donner
       l'itineraire vers son propre geste dit que le geste est mal place, et
       habiller le lien en bouton ne reglait que la geometrie. */
    vrai(!/<a class="hint lien-vue" href="#\/positions">\$\{trad\('Gérer dans Marchés'\)\}/.test(src),
      'le renvoi vers Marchés n’est plus un lien nu');
    /* Borne a la fiche : l'accueil garde un vrai renvoi de navigation vers
       Marches, dans un en-tete qui ne porte aucun bouton. Ce n'est pas le meme
       objet, et l'interdire partout aurait interdit la navigation. */
    const fiche = src.slice(src.indexOf('function viewFicheCompte('),
                            src.indexOf('function viewFicheEtab('));
    vrai(fiche.length > 1000, 'la fiche d’un compte se relit depuis sa source');
    vrai(!/href="#\/positions"/.test(fiche),
      'la fiche d’un compte ne renvoie plus vers Marchés : elle porte le geste');
    vrai(/data-action="ajouter-ligne" data-compte=/.test(fiche),
      'et ce geste emporte le compte d’où il part');
    /* Et un lien qui porte la classe d'un bouton ne se souligne pas. */
    const regle = (css.match(/^\.btn \{[^}]*\}/m) || [''])[0];
    vrai(/text-decoration: none/.test(regle), 'la classe .btn retire le soulignement');
  });

  test('un bouton seul qui passe à la ligne reste à droite, une paire va à gauche', () => {
    /* `space-between` distribue ligne par ligne : seul sur la seconde, un bouton
       partait a gauche, et la carte voisine gardait le sien a droite.

       Une paire suit l'autre regle : un bouton seul est un accessoire du titre et
       en suit le bord, une paire est un bloc, et elle s'aligne sur les blocs
       replies au-dessus d'elle — plages, selecteur d'annee — tous a gauche. */
    const css = lireSource('assets/styles.css');
    vrai(/\.card-head > \.btn:last-child \{ margin-left: auto; \}/.test(css),
      'le dernier bouton seul d’un en-tête porte margin-left: auto sous 900 px');
    vrai(!/\.card-head > \.paire-btn:last-child \{ margin-left: auto/.test(css),
      'et la paire ne le porte pas : elle reste au départ de sa ligne');
  });

  test('une seule géométrie pour les rangées de boutons d’une fiche', () => {
    /* Deux classes pour une meme rangee donnaient deux largeurs et deux hauteurs
       dans une meme carte. Une seule classe, et une grille : c'est elle qui decide
       de la largeur, jamais la longueur du libelle. */
    const css = lireSource('assets/styles.css');
    const src = lireSource('assets/app.js');
    vrai(!/fiche-pied|fiche-valider/.test(css + src),
      'plus de seconde classe : « Archiver » faisait 79 px quand « Clôturer et supprimer » en faisait 157');
    const base = (css.match(/\.fiche-actes \{[^}]*\}/) || [''])[0];
    vrai(/display: grid/.test(base), 'une grille, et non un flex');
    vrai(/grid-template-columns: minmax\(0, 1fr\)/.test(base),
      'une seule colonne par défaut : à 375 px, deux colonnes plient « Clôturer et supprimer » en deux lignes');
    const grand = (css.match(/@media \(min-width: 768px\) \{\s*\n\s*\.fiche-actes \{[^}]*\}/) || [''])[0];
    vrai(/repeat\(2, minmax\(0, 14em\)\)/.test(grand),
      'deux colonnes égales au-delà, sur tablette comme sur écran, plafonnées : '
      + 'sinon un bouton prend les 928 px de la carte');
    vrai(/justify-content: end/.test(grand) && !/max-width/.test(grand),
      'le plafond porte sur les colonnes, pas sur la rangée : réduite, elle emporte '
      + 'son filet avec elle et le trait cesse de traverser la carte');
    vrai(/\.fiche-actes \+ \.fiche-actes \{ margin-top: 8px; \}/.test(css),
      'et l’écart entre deux rangées voisines est celui de la grille');
    /* La rangee qui ferme une carte de champs n'ajoute qu'un filet : aucun
       remplissage lateral, la carte le donne deja. */
    const pied = (css.match(/\.fiche-actes\.apres-champs \{[^}]*\}/) || [''])[0];
    vrai(/border-top: 1px solid var\(--grid\)/.test(pied),
      'un filet sépare la saisie de sa validation, comme le pied d’une fenêtre');
    vrai(/padding-top: 14px/.test(pied) && !/padding: /.test(pied),
      'et aucun remplissage latéral, qui la décalerait de ses voisines');
  });

  test('les quatre boutons d’une fiche ont la même taille et le même bord', () => {
    /* Mesure, et non lecture du CSS : c'est la largeur rendue qui se voyait
       fausse. Les deux rangees vivent dans deux cartes differentes, et c'est
       precisement ce que la sonde doit reproduire — la bordure d'une carte ne
       dispense pas deux rangees voisines de s'accorder. La sonde vaut pour la
       largeur ou tourne la page de tests ; les deux regimes de colonnes sont
       gardes par le controle precedent. */
    const boite = document.createElement('div');
    boite.style.width = '600px';
    boite.innerHTML = '<div class="card"><div class="card-head"><h2>Informations</h2></div>'
      + '<div class="fiche-actes apres-champs">'
      + '<button class="btn ghost">Annuler</button>'
      + '<button class="btn primary">Enregistrer</button></div></div>'
      + '<div class="card"><div class="card-head"><h2>Actions</h2></div>'
      + '<div class="fiche-actes">'
      + '<button class="btn ghost">Archiver</button>'
      + '<button class="btn ghost danger">Clôturer et supprimer</button></div></div>';
    document.body.appendChild(boite);
    try {
      const btns = [...boite.querySelectorAll('.btn')].map(b => b.getBoundingClientRect());
      const larg = btns.map(r => Math.round(r.width));
      const haut = btns.map(r => Math.round(r.height));
      eq(new Set(larg).size, 1, 'une seule largeur pour les quatre : ' + larg.join(' / '));
      eq(new Set(haut).size, 1, 'une seule hauteur pour les quatre : ' + haut.join(' / '));
      const rangees = [...boite.querySelectorAll('.fiche-actes')];
      const bords = rangees.map(r => Math.round(r.getBoundingClientRect().right));
      eq(bords[0], bords[1],
        'et les deux rangées partagent leur bord droit, d’une carte à l’autre');
      /* Le filet est dessine sur la rangee : si elle est plafonnee, il ne traverse
         plus la carte et flotte au-dessus des deux boutons. La rangee doit donc
         faire la largeur du contenu de sa carte, boutons poussees a droite. */
      const pied = rangees[0];
      const carte = pied.closest('.card');
      const dedans = getComputedStyle(carte);
      const attendu = Math.round(carte.getBoundingClientRect().width
        - parseFloat(dedans.paddingLeft) - parseFloat(dedans.paddingRight)
        - parseFloat(dedans.borderLeftWidth) - parseFloat(dedans.borderRightWidth));
      eq(Math.round(pied.getBoundingClientRect().width), attendu,
        'le filet traverse la carte : la rangée fait la largeur de son contenu');
      /* Sous 768 px les boutons occupent toute la rangee, il n'y a rien a pousser. */
      if (matchMedia('(min-width: 768px)').matches) {
        vrai(Math.round(pied.firstElementChild.getBoundingClientRect().left)
               > Math.round(pied.getBoundingClientRect().left),
          'et ses boutons restent poussés à droite');
      }
    } finally {
      boite.remove();
    }
  });
});

suite('Un menu déroulant a la largeur de ce qu’il montre', () => {

  /* Deux defauts opposes sur la meme page : « Français » dans une boite de
     442 px, et « Oui, chercher les cours automatiquement » coupe en plein mot. */

  test('une cellule de grille est un enfant, pas un descendant', () => {
    const css = lireSource('assets/styles.css');
    vrai(!/\.grid \.field :is\(input, select, textarea\)/.test(css),
      'le combinateur descendant étirait le moindre champ posé dans une carte posée dans une grille');
    vrai(/\.grid > \.field :is\(input, select, textarea\) \{/.test(css),
      'un champ n’est étiré que s’il est lui-même la cellule');
  });

  test('un menu garde la largeur de sa plus longue option, sans se couper', () => {
    const css = lireSource('assets/styles.css');
    const regle = (css.match(/\.field select \{[^}]*\}/) || [''])[0];
    vrai(/width: auto/.test(regle) && /align-self: start/.test(regle),
      'hors grille, un menu sait déjà quelle largeur il lui faut');
    vrai(/max-width: min\(28em, 100%\)/.test(regle),
      'le plafond laisse entrer « Automatique (place de référence du titre) », 22,5 em, '
      + 'mais jamais au-delà du conteneur : 28 em valent 364 px quand la carte en offre 311');
    vrai(/text-overflow: ellipsis/.test(regle),
      'et si le conteneur le resserre, une ellipse le dit au lieu de trancher un mot');
  });

  test('un menu ne sort jamais de sa carte', () => {
    /* Un menu prend la largeur de sa plus longue option sans regarder ou il est
       pose : a 375 px il sortait de l'ecran, ou les pixels sont perdus. La sonde
       reproduit une carte etroite et une option a rallonge. */
    const boite = document.createElement('div');
    boite.className = 'card';
    boite.style.width = '311px';
    boite.innerHTML = '<div class="field"><label>Place privilégiée</label>'
      + '<select><option>Automatique (place de référence du titre)</option></select></div>';
    document.body.appendChild(boite);
    try {
      const s = boite.querySelector('select');
      const l = Math.round(s.getBoundingClientRect().width);
      const dispo = Math.round(s.parentElement.getBoundingClientRect().width);
      vrai(l <= dispo, 'le menu fait ' + l + ' px pour ' + dispo + ' px offerts');
    } finally {
      boite.remove();
    }
  });

  test('deux mots ne prennent pas la carte entière', () => {
    /* La sonde reproduit la page Preferences : une carte dans une grille, et un
       champ dedans. Le menu ne porte que « Français » et « English ». */
    const boite = document.createElement('div');
    boite.className = 'grid g-2';
    boite.style.width = '900px';
    boite.innerHTML = '<div class="card"><div class="modal-champs"><div class="field">'
      + '<label>Langue de l’interface</label>'
      + '<select><option>Français</option><option>English</option></select>'
      + '</div></div></div>';
    document.body.appendChild(boite);
    try {
      const l = Math.round(boite.querySelector('select').getBoundingClientRect().width);
      vrai(l < 200, 'le menu fait ' + l + ' px, il devrait tenir dans le mot qu’il montre');
    } finally {
      boite.remove();
    }
  });
});

/* ------------------------------------------------------------------
   Ce qu'un audit de l'interface a trouve, et ce qui l'empechera de
   revenir. Dix defauts, du contraste aux glyphes : chacun avait ceci de
   commun qu'aucun test ne le regardait, et que rien a l'ecran ne criait.
   ------------------------------------------------------------------ */
suite('L’interface tient ses seuils', () => {

  /* -- Le contraste, calcule et non estime --------------------------- */

  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const rgbDe = v => {
    const s = String(v).trim();
    const h = s.match(/^#([0-9a-f]{6})$/i);
    if (h) return [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16));
    const m = s.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  };
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const jeton = nom => rgbDe(getComputedStyle(document.documentElement).getPropertyValue(nom));

  test('le texte le plus petit franchit 4,5:1 sur les trois fonds, dans les deux thèmes', () => {
    /* Le troisieme gris portait les intitules de colonnes a 11 px, les bulles
       d'aide a 12 et les etiquettes de tuiles a 10,5 : 3,61:1 sur une carte,
       3,32 sur `--surface-2`. Sous le seuil precisement la ou les caracteres
       sont les plus fins, et dans les deux thèmes a la fois. Un contrôle qui
       calcule vaut mieux qu'un oeil : personne ne voit la difference entre
       4,3 et 4,6, et c'est pourtant la frontiere.

       L'orange s'y est ajoute : il ecrit les ecarts au budget, il n'est pas
       qu'un aplat. L'accent aussi : il ecrit l'horizon retenu de la projection,
       donc il change de seuil. */
    const memoire = document.documentElement.dataset.theme;
    const fautes = [];
    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.dataset.theme = theme;
        const fonds = ['--surface-1', '--surface-2', '--page'].map(n => [n, jeton(n)]);
        for (const encre of ['--muted', '--text-secondary', '--serious', '--accent']) {
          const c = jeton(encre);
          vrai(c, `${encre} doit être lisible en ${theme}`);
          for (const [nom, fond] of fonds) {
            const r = contraste(c, fond);
            if (r < 4.5) fautes.push(`${theme} : ${encre} sur ${nom} = ${r.toFixed(2)}:1`);
          }
        }
      }
    } finally {
      if (memoire) document.documentElement.dataset.theme = memoire;
      else delete document.documentElement.dataset.theme;
    }
    eq(fautes.join(' | '), '', 'du texte de 11 px sous 4,5:1 ne se lit pas');
  });

  test('les trois gris restent trois, et dans cet ordre', () => {
    /* Remonter `--muted` pour le contraste ne doit pas l'amener au niveau de
       `--text-secondary` : la hierarchie des trois encres est ce qui distingue
       un intitule d'une valeur. */
    const memoire = document.documentElement.dataset.theme;
    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.dataset.theme = theme;
        const fond = jeton('--surface-1');
        const [muet, second, premier] = ['--muted', '--text-secondary', '--text-primary']
          .map(n => contraste(jeton(n), fond));
        vrai(muet < second - 0.5, `${theme} : --muted doit rester en retrait de --text-secondary`);
        vrai(second < premier - 0.5, `${theme} : --text-secondary doit rester en retrait de --text-primary`);
      }
    } finally {
      if (memoire) document.documentElement.dataset.theme = memoire;
      else delete document.documentElement.dataset.theme;
    }
  });

  /* -- La cible du doigt -------------------------------------------- */

  test('un bouton-icône se vise, même quand son dessin fait 22 px', () => {
    /* Les croix mesuraient 22 a 29 px selon l'endroit, le minimum tenable au
       doigt etant 24 : sous cette taille on atteint le voisin. Le dessin ne
       grandit pas — ce serait un aplat la ou il faut un signe discret — c'est
       la boite cliquable qui s'etend au-dela, sans rien deplacer. */
    const boite = document.createElement('div');
    boite.className = 'card';
    boite.innerHTML = '<button class="btn icon xs">✕</button>'
      + '<span class="aide" role="button" tabindex="0">?</span>';
    document.body.appendChild(boite);
    try {
      for (const sel of ['.btn.icon.xs', '.aide']) {
        const el = boite.querySelector(sel);
        const ap = getComputedStyle(el, '::after');
        eq(ap.content, '""', `${sel} doit porter une cible étendue`);
        eq(ap.position, 'absolute', `${sel} : la cible ne doit pas pousser ses voisins`);
        const px = p => parseFloat(p) || 0;
        const r = el.getBoundingClientRect();
        const L = r.width - px(ap.left) - px(ap.right);
        const H = r.height - px(ap.top) - px(ap.bottom);
        vrai(L >= 24 && H >= 24, `${sel} : cible de ${Math.round(L)}x${Math.round(H)} px, il en faut 24`);
        /* Pas de fond : c'est une surface a viser, pas a voir. */
        const fond = rgbDe(ap.backgroundColor);
        vrai(!fond || ap.backgroundColor === 'rgba(0, 0, 0, 0)',
          `${sel} : la cible étendue ne doit rien peindre`);
      }
    } finally {
      boite.remove();
    }
  });

  test('une cible étendue n’empiète pas sur sa voisine', () => {
    /* A huit pixels d'extension, la croix de la carte de rappel mordait de deux
       pixels sur « Plus tard », son voisin a six pixels d'ecart. Une action
       destructive qui gagne du terrain sur celle qui reporte, c'est le mauvais
       sens. La sonde reproduit l'ecart le plus serre de l'application. */
    const boite = document.createElement('div');
    boite.className = 'card';
    boite.innerHTML = '<span style="display:flex; gap:6px; align-items:center">'
      + '<button class="btn sm ghost">Plus tard</button>'
      + '<button class="btn icon xs">✕</button></span>';
    document.body.appendChild(boite);
    try {
      const [voisin, croix] = [...boite.querySelectorAll('button')];
      const ap = getComputedStyle(croix, '::after');
      const px = p => parseFloat(p) || 0;
      const bordGauche = croix.getBoundingClientRect().left + px(ap.left);
      const bordVoisin = voisin.getBoundingClientRect().right;
      vrai(bordGauche >= bordVoisin - 0.5,
        `la cible de la croix commence à ${Math.round(bordGauche)}, le voisin finit à ${Math.round(bordVoisin)}`);
    } finally {
      boite.remove();
    }
  });

  /* -- Le focus au clavier ------------------------------------------ */

  test('tout ce qui se focalise porte l’anneau de l’application', () => {
    /* Vingt-cinq composants declaraient leur `:focus-visible` en accent, et les
       deux plus courants s'en remettaient au navigateur : `.btn`, dont l'anneau
       par defaut ne se voit presque pas sur un bouton plein clair, et `.aide`,
       qui posait `outline: none` et changeait la couleur d'un filet de 1 px. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const sel of ['\\.btn:focus-visible', '\\.aide:focus-visible']) {
      const bloc = (css.match(new RegExp(sel + ' \\{[^}]*\\}')) || [''])[0];
      vrai(/outline: 2px solid var\(--accent\)/.test(bloc),
        `${sel.replace(/\\/g, '')} doit poser l’anneau d’accent, il porte « ${bloc.slice(0, 60)} »`);
    }
  });

  /* -- Le rouge ne sert qu'a ce qui est faux ------------------------ */

  test('une saisie en attente s’annonce en ambre, jamais en rouge', () => {
    /* La pastille de la barre du bas etait peinte en `--critical` pour dire
       qu'un releve mensuel restait a prendre. Chaque debut de mois, une alerte
       rouge pour de la routine — et une alerte qui revient tous les mois cesse
       d'etre lue. Sa jumelle de la barre laterale, `.badge`, etait deja en
       ambre : deux couleurs pour le meme signal selon la taille de l'ecran. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const bloc = (css.match(/\.tab-pastille \{[^}]*\}/) || [''])[0];
    vrai(/background: var\(--warning\)/.test(bloc),
      'la pastille de l’onglet est ambre comme celle du menu');
    vrai(!/critical/.test(bloc), 'et le rouge reste au chiffre faux');
    const jumelle = (css.match(/\.badge \{[^}]*\}/) || [''])[0];
    vrai(/var\(--warning\)/.test(jumelle),
      'les deux pastilles du même signal gardent la même couleur');
  });

  /* -- Un total ne sort pas de l'ecran ------------------------------ */

  /* Le controle du total epingle a droite est parti avec son sujet : le tableau
     « Voir les donnees » de la courbe n'existe plus, et `.sticky-fin` etait sa
     seule cliente -- la regle CSS est partie avec. La lecon qu'il portait, elle,
     vaut toujours pour les autres tableaux larges, et `.sticky-col` la garde :
     voir « la colonne des noms ne s'epingle pas sous 768 px ». */

  /* -- Un chiffre dit sur quelle base il se calcule ------------------ */

  test('la base d’un chiffre ne disparaît pas sur téléphone', () => {
    /* `font-size: 0` masquait « sur 7 mois clos, hors charges fixes » sous la
       tuile qui affiche 1 400 €. Un dividende sans diviseur n'est pas un chiffre
       plus court, c'est un chiffre faux. Les deux raisons du masquage sont
       tombees : le texte ne se tronque plus, et `grid-auto-rows: 1fr` egalise
       les hauteurs. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const bloc = (css.match(/\.g-tuiles \.t-meta \{[^}]*\}/) || [''])[0];
    vrai(bloc, 'la règle mobile de la base doit être trouvable');
    vrai(!/font-size: 0/.test(bloc), 'la base n’est plus masquée');
    vrai(/font-size: var\(--font-xs\)/.test(bloc), 'elle se serre au lieu de disparaître');
    vrai(/grid-auto-rows: 1fr/.test(css),
      'et les hauteurs de tuiles restent égalisées, sinon chacune prend la sienne');
  });

  /* -- Une page suit les gabarits de la maison ----------------------- */

  test('la page Données ne porte que deux gabarits de bouton', () => {
    /* Quatre hauteurs sur une seule page : 30, 31, 36 et 43 px. La regle de la
       maison est qu'un bouton d'en-tete ou de rangee est `sm`, un bouton de
       corps de carte est pleine taille, et que la hierarchie se dit par le
       remplissage — jamais par la taille. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function viewData');
    vrai(i > 0, 'viewData doit être trouvable');
    const vue = src.slice(i, src.indexOf('function mountData'));
    vrai(!/class="btn pleine" data-action="undo"/.test(vue),
      'le bouton d’annulation prend la taille des autres');
    /* Sobre, desormais : une securite pratique dans sa section, pas l'action
       principale de la page. Le remplissage dit la hierarchie. */
    vrai(/class="btn sm ghost" data-action="undo"/.test(vue), 'et se fait discret : une sécurité pratique, pas l’acte principal');
    /* `pleine` garde son unique emploi documente : la photo du releve. */
    vrai(/class="btn pleine" id="relPhoto"/.test(src),
      'la classe pleine reste réservée à l’action qui remplace douze saisies');
  });

  test('l’acte le plus destructeur a sa propre carte, et elle vient en dernier', () => {
    /* « Repartir de zero » vivait sous le titre « Importer », en petit bouton
       fantome derriere un filet : le titre n'annoncait rien de ce qu'il fait, et
       les boutons d'une carte portent sur le sujet de cette carte. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewData'), src.indexOf('function mountData'));
    const iImport = vue.indexOf("trad('Importer une sauvegarde')");
    const iBouton = vue.indexOf('data-action="start-blank"');
    const iTitre = vue.indexOf("trad('Réinitialiser Longward')");
    vrai(iBouton > 0 && iTitre > 0, 'la carte doit être trouvable');
    vrai(iTitre < iBouton, 'son titre annonce ce que son bouton fait');
    vrai(iBouton > iImport + 2000,
      'elle ne vit plus dans la carte « Importer », qui ne l’annonçait pas');
    vrai(/class="btn ghost danger" data-action="start-blank"/.test(vue),
      'et le bouton porte le rouge de ce qu’il détruit');
    /* Dernier de la page : le doigt ne traverse pas le rouge pour atteindre le
       reste, comme sur la fiche d'un compte. */
    vrai(iBouton > vue.indexOf("trad('Historique des sauvegardes')"),
      'elle se rend après les sauvegardes : ce qui répare vient avant ce qui détruit');
  });

  /* -- Un glyphe ne dit qu'une chose ------------------------------- */

  test('le glyphe de l’actualisation ne sert pas à effacer', () => {
    /* ↻ veut dire « actualiser » a quatre endroits : les cours, la
       synchronisation, le symbole depuis l'ISIN, l'etat du chargement. Le meme
       signe annoncait « effacer seize mois de releves ». */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('data-action="start-blank"');
    const ligne = src.slice(src.lastIndexOf('<button', i), src.indexOf('</button>', i));
    vrai(!/↻/.test(ligne), 'le bouton qui efface tout ne porte plus le signe de l’actualisation');
    vrai(/↻/.test(src), 'le signe reste, pour ce qu’il veut dire');
  });

  test('l’acte qui retire un montant se nomme', () => {
    /* Un ✕ gris est le signe le plus discret de l'ecran pour l'action qui efface
       un montant : on ne le trouve que par accident. Le meme defaut sur les
       credits avait deja ete corrige en bouton nomme et rouge. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('data-action="retirer-cash"');
    const bouton = src.slice(src.lastIndexOf('<button', i), src.indexOf('</button>', i));
    vrai(!/>✕/.test(bouton), 'le bouton ne se réduit plus à une croix');
    vrai(/trad\('Retirer'\)/.test(bouton), 'il porte son verbe');
    vrai(/ghost danger/.test(bouton),
      'rouge en liseré et non en aplat : un compte peut déclarer trois parts');
  });

  /* -- La hierarchie typographique --------------------------------- */

  test('deux boutons du même geste mesurent pareil', () => {
    /* « − Vendre » et « + Vente passee » tombaient une par une dans l'en-tete
       souple, a 77 et 120 px, l'une au-dessus de l'autre : deux commandes de la
       meme paire lues comme deux commandes sans rapport. La paire en fait un seul
       element de flex — donc un seul point de rupture — et une grille a colonnes
       egales leur donne la meme largeur, celle du libelle le plus long. */
    const boite = document.createElement('div');
    boite.className = 'card';
    /* Largeur posee, comme les autres sondes : le corps de la page de tests est
       la meme grille que l'application, et une sonde sans largeur atterrit dans
       la colonne de 244 px de la barre laterale. Les deux boutons s'y serrent a
       62 px, leurs libelles se replient, et le controle mesure alors le pire des
       cas plutot que celui qu'il croit regarder. */
    boite.style.width = '600px';
    /* Deux libelles de longueurs franchement inegales, comme la paire des apports
       — « + Rentrée » contre « + Dépense ». C'est l'ecart qui rend le defaut
       visible : en flex, le plus long imposait sa largeur a lui seul. */
    boite.innerHTML = '<div class="card-head"><h2>Journal</h2>'
      + '<span class="paire-btn">'
      + '<button class="btn sm ghost">+ Rentrée</button>'
      + '<button class="btn sm ghost">+ Dépense exceptionnelle</button>'
      + '</span></div>';
    document.body.appendChild(boite);
    try {
      const paire = boite.querySelector('.paire-btn');
      const b = [...paire.children].map(x => x.getBoundingClientRect());
      eq(new Set(b.map(r => Math.round(r.width))).size, 1,
        'une seule largeur : ' + b.map(r => Math.round(r.width)).join(' / '));
      eq(new Set(b.map(r => Math.round(r.top))).size, 1,
        'et une seule ligne : la paire tombe d’un bloc ou pas du tout');
      /* La largeur commune est celle du plus long, pas la moyenne : un libelle
         qui se replie ferait deux hauteurs. */
      eq(new Set(b.map(r => Math.round(r.height))).size, 1, 'donc une seule hauteur');
      vrai(Math.round(b[1].right) === Math.round(paire.getBoundingClientRect().right),
        'et la paire finit là où finit son dernier bouton');
    } finally {
      boite.remove();
    }
  });

  test('le thème se change en rechargeant, comme la langue', () => {
    /* Changer l'attribut repeint tout sauf le fond du corps, qui reste a la
       couleur de l'ancien theme jusqu'au rechargement suivant : des cartes
       claires posees sur une page noire. Mesure a l'appui dans le commentaire
       d'`applyTheme`. Le selecteur de langue recharge depuis toujours. */
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function applyTheme'), src.indexOf('function applyTheme') + 400);
    vrai(/location\.reload\(\)/.test(fn), 'applyTheme sait recharger');
    vrai(/recharger = false/.test(fn),
      'mais pas au démarrage, sinon la page se recharge en boucle');
    for (const appel of ['applyTheme\\(currentTheme\\(\\) === .dark. \\? .light. : .dark., true\\)',
                         'applyTheme\\(v, true\\)']) {
      vrai(new RegExp(appel).test(src),
        `les deux commandes de thème demandent le rechargement (${appel.slice(0, 24)}…)`);
    }
    vrai(!/applyTheme\(theme\.value\); render\(\)/.test(src),
      'et aucune ne se contente d’un render, qui laissait le fond du corps en arrière');
  });

  test('les tailles viennent de l’échelle', () => {
    /* Vingt-sept tailles vivaient dans la feuille : 10, 10,5, 11, 11,5, 12,
       12,5, 13, 13,5... Un demi-pixel entre deux indices n'est pas une nuance,
       c'est une occasion de diverger, et chaque écran finissait par avoir l'air
       dessiné à part. Huit paliers, chacun un rôle, déclarés une fois ; les
       glyphes qui servent d'icônes — chevrons, « ? », flèches de tri — gardent
       leur taille optique, qui n'est pas de la typographie. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const jetons = ['--font-xs', '--font-sm', '--font-md', '--font-base',
                    '--font-lg', '--font-xl', '--font-2xl', '--font-hero'];
    const valeurs = jetons.map(j => {
      const m = css.match(new RegExp(j + ':\\s*([\\d.]+)px'));
      return m ? +m[1] : null;
    });
    vrai(valeurs.every(v => v), 'les huit paliers sont déclarés : ' + valeurs.join(', '));
    vrai(css.indexOf('--font-xs:') < css.indexOf('@media'), 'et hors de toute requête média');
    for (let i = 1; i < valeurs.length; i++) {
      vrai(valeurs[i] > valeurs[i - 1], 'l’échelle monte d’un palier à l’autre');
    }
    const glyphe = /(\.|-)ic\b|svg|chev|\.aide(?![\w-])|::after|::before|\.badge\b/;
    const ecrites = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (glyphe.test(m[1])) continue;
      for (const d of m[2].matchAll(/font-size:\s*([\d.]+)px(?!\s*!important)/g)) {
        ecrites.push(`${m[1].trim().slice(0, 40)} → ${d[1]}px`);
      }
    }
    eq(ecrites.join(' ; '), '', 'aucune taille de texte écrite en pixels hors de l’échelle');
  });

  test('un titre de carte se distingue du texte qu’il annonce', () => {
    /* A 15 px contre un corps a 13,5, la hierarchie ne tenait que par la
       graisse, et une graisse ne se lit pas de loin. Trois paliers : 20 pour le
       titre de page, 16 pour celui d'une carte, 13 pour le texte. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const taille = sel => {
      const bloc = (css.match(new RegExp(sel.replace(/[.]/g, '\\.') + ' \\{[^}]*\\}')) || [''])[0];
      /* Une taille se lit en pixels ou par son palier : le palier se résout
         dans la déclaration de `:root`, seul endroit qui porte le nombre. */
      const m = bloc.match(/font-size: (?:([\d.]+)px|var\((--font-[\w]+)\))/);
      if (!m) return null;
      if (m[1]) return +m[1];
      const jeton = css.match(new RegExp(m[2] + ':\\s*([\\d.]+)px'));
      return jeton ? +jeton[1] : null;
    };
    const h1 = taille('.topbar h1'), h2 = taille('.card-head h2');
    vrai(h1 && h2, 'les deux règles doivent être trouvables');
    vrai(h2 >= 16, `un titre de carte fait ${h2} px, il en faut 16 pour se détacher du corps`);
    vrai(h1 > h2 + 2, `le titre de page (${h1}) doit rester au-dessus de celui d’une carte (${h2})`);
  });
});

suite('La vitrine dit vrai, et se laisse trouver', () => {

  /* Ce depot-ci est la demonstration publique : elle doit se trouver. Le
     `robots.txt` portait `Disallow: /`, herite de l'instance privee, donc la
     page que le README annonce comme « Live demo » et que le profil GitHub
     pointe etait invisible pour les moteurs. Un lien qu'on distribue et qu'aucun
     moteur ne connait est un lien qui n'existe qu'une fois.

     Ce controle vit dans ce depot et pas dans l'autre, et c'est voulu :
     l'instance privee garde `Disallow: /`. Rien dans l'arbre ne distingue les
     deux depots, donc le test ne peut pas se deriver — il se declare. */
  test('la démonstration se laisse indexer', () => {
    const robots = lireSource('robots.txt');
    vrai(robots !== null, 'robots.txt doit se lire');
    const regles = robots.split('\n')
      .map(l => l.replace(/#.*/, '').trim())
      .filter(Boolean);
    const interdits = regles.filter(l => /^Disallow:\s*\/\s*$/i.test(l));
    eq(interdits.length, 0,
      'robots.txt interdit la racine : la démonstration publique redevient '
      + 'introuvable, et le lien du README ne mène plus nulle part pour un moteur');
    vrai(regles.some(l => /^Allow:\s*\//i.test(l)),
      'robots.txt doit autoriser explicitement la racine');
  });

  test('la page de connexion reste, elle, hors des moteurs', () => {
    /* Ouvrir robots.txt ne doit pas ouvrir la page de connexion. Elle porte son
       propre en-tete, qui prime sur ce fichier : c'est ce qui rend le geste
       precedent sans danger, et c'est donc ce qu'il faut garder. */
    const worker = lireSource('_worker.js');
    vrai(/X-Robots-Tag['"]?\s*:\s*['"]noindex/.test(worker),
      'les réponses HTML du worker doivent porter noindex');
    const pages = [...worker.matchAll(/headers: htmlHeaders/g)];
    vrai(pages.length >= 2,
      'les pages de connexion et de verrouillage doivent utiliser ces en-têtes');
  });

  test('la preuve de propriété du site ne disparaît pas', () => {
    /* Les trois liens GitHub vers la demonstration portent rel="nofollow" :
       README, image cliquable et encart About, GitHub les marque tous. Rien ne
       conduit donc un moteur jusqu'a la page, et ouvrir robots.txt ne suffisait
       pas — le site etait autorise et inconnu. La declaration dans Search
       Console est le seul chemin qui ne depende d'aucun lien externe, et cette
       balise est ce qui la tient.

       La retirer ne casse rien de visible : le site continue de fonctionner,
       Search Console cesse simplement de rendre compte de l'indexation. C'est
       exactement le genre de chose qui se perd sans un controle. */
    const html = lireSource('index.html');
    vrai(/name="google-site-verification"\s+content="[\w-]{20,}"/.test(html),
      'la balise de validation Google doit rester dans la page d’accueil');
  });

  test('les deux descriptions annoncent le même nombre de tests, et il est vrai', () => {
    /* Deux compteurs pour un seul fait, dans le meme fichier : « 600+ tests »
       sous le lien Google et « ~500 tests » sur les reseaux sociaux. Les deux
       etaient faux, et surtout ils se contredisaient — un lecteur qui voit les
       deux extraits n'a aucune raison de croire le troisieme chiffre.

       Sans etape de construction, la valeur se recopie forcement dans une balise
       meta. Ce qui se corrige, c'est qu'elle soit UNIQUE et tenue : le controle
       exige que les deux disent la meme chose, et que ce plancher soit vrai. */
    const html = lireSource('index.html');
    const dits = [...html.matchAll(/([\d~+]+)\s+tests\./g)].map(m => m[1]);
    vrai(dits.length >= 2, 'la page annonce un nombre de tests dans ses deux descriptions');
    eq(new Set(dits).size, 1,
      'les descriptions annoncent ' + dits.join(' et ') + ' : deux chiffres pour un seul fait');
    const plancher = Number(dits[0].replace(/[^\d]/g, ''));
    const reels = (lireSource('tests/store.tests.js').match(/^  test\(/gm) || []).length;
    vrai(plancher <= reels,
      `la page annonce ${dits[0]} tests, le fichier en déclare ${reels}`);
  });
});

suite('Le README ne promet que ce qui est mesurable', () => {

  /* Le README se vante que « beaucoup de tests lisent la source elle-meme »,
     et deriver la regle du fichier plutot que d'en recopier la valeur. Ses
     propres chiffres ne le faisaient pas : il annonçait un harnais de 74 lignes
     quand il en fait 79, quatre paliers de liquidite quand il y en a cinq, et
     25 000 lignes de JavaScript alors que ce depot les publie sans leurs
     commentaires — un lecteur qui compte en trouve vingt mille.

     Un chiffre invérifiable dans un README qui prétend que les chiffres se
     vérifient est le pire des deux mondes. Ils se contrôlent donc ici. */

  const readme = () => lireSource('README.md');

  test('le nombre de lignes du harnais est celui du fichier', () => {
    const md = readme();
    vrai(md !== null, 'README.md doit se lire');
    /* Le saut de ligne final ne fait pas une ligne de plus : GitHub, que le
       lecteur regarde, en affiche 79 pour un fichier qui se termine par un
       retour. Compter sans l'enlever donnait 80 et accusait le README. */
    const vraies = lireSource('tests/harness.js')
      .replace(/\n$/, '').split('\n').length;
    const dits = [...md.matchAll(/(\d+)[- ]lines?\]?\(?tests\/harness\.js|(\d+)-line harness/g)]
      .map(m => Number(m[1] || m[2]));
    vrai(dits.length >= 2,
      'le README annonce la taille du harnais à deux endroits, les deux doivent être trouvés');
    for (const d of dits) {
      eq(d, vraies, `le README annonce ${d} lignes de harnais, le fichier en a ${vraies}`);
    }
  });

  test('le nombre de paliers de liquidité est celui de la table', () => {
    const md = readme();
    const mots = { four: 4, five: 5, six: 6, seven: 7, three: 3 };
    const m = md.match(/(\w+) liquidity tiers/);
    vrai(m, 'le README doit annoncer un nombre de paliers');
    eq(mots[m[1]], Object.keys(MOBILISABLE_LABEL).length,
      `le README annonce « ${m[1]} » paliers, la table en porte `
      + Object.keys(MOBILISABLE_LABEL).length);
  });

  test('les compteurs de tests ne dépassent pas la réalité', () => {
    /* « 740+ » doit rester vrai : un plancher qu'on annonce ne peut pas passer
       au-dessus de ce qui existe. Le controle laisse la marge vers le haut, il
       ne ferme que le sens ou le README exagererait. */
    const md = readme();
    const src = lireSource('tests/store.tests.js');
    const suites = (src.match(/^suite\(/gm) || []).length;
    const cas = (src.match(/^  test\(/gm) || []).length;
    const m = md.match(/\| Test cases \| ([\d,]+)\+, in (\d+)\+ suites \|/);
    vrai(m, 'le tableau des chiffres doit annoncer les tests et les suites');
    const casDits = Number(m[1].replace(/,/g, ''));
    vrai(casDits <= cas,
      `le README annonce ${casDits}+ cas, le fichier en déclare ${cas}`);
    vrai(Number(m[2]) <= suites,
      `le README annonce ${m[2]}+ suites, le fichier en déclare ${suites}`);
  });

  test('chaque image du README existe', () => {
    /* Une capture renommee laisse un cadre vide sur la page d'accueil du depot,
       et personne ne le voit depuis un editeur. */
    const md = readme();
    const images = [...md.matchAll(/(?:src="|\]\()(docs\/[\w.-]+\.png)/g)].map(m => m[1]);
    vrai(images.length >= 4, 'le README montre au moins quatre captures');
    for (const img of new Set(images)) {
      vrai(lireSource(img) !== null, `${img} est référencée par le README et absente`);
    }
  });
});

suite('La graine de la démonstration parle une seule langue', () => {

  /* La graine de la demonstration est anglaise, jusqu'aux noms de ses comptes.

     Les donnees d'un detenteur ne se traduisent jamais : ses noms de comptes
     restent les siens dans les deux langues, et c'est la regle. La graine de
     cette demonstration n'est pas un detenteur : c'est le jeu d'exemples qui
     porte la demonstration, et la demonstration est anglaise -- son README, ses
     captures, son manifeste, sa langue au premier chargement.

     Une graine melangee ferait lire a un visiteur anglophone des noms de fonds
     en francais a cote de Brokerage cash. Une demonstration a moitie traduite
     dit d'elle-meme que la traduction n'est pas tenue.

     Ce controle vit dans ce depot seul : la graine de l'instance privee porte de
     vraies donnees, en francais, et n'a rien a faire en anglais. */
  test('aucun libellé de la graine ne porte d’accent', () => {
    if (sansGraineDeDemo('les libellés de la graine')) return;
    const fautifs = [];
    for (const f of ['assets/seed.js', 'assets/seed-budget.js']) {
      const src = lireSource(f);
      vrai(src, f + ' doit se lire');
      /* Les valeurs de champs affiches, pas les commentaires : ceux-la
         s'ecrivent en francais et le resteront. */
      const champs = [...src.matchAll(
        /(?:label|nom|libelle|short|alloc|broker|name|note|vehicles|categorie)\s*:\s*'([^'\n]{2,60})'/g)]
        .map(m => m[1]);
      vrai(champs.length > 30, `${f} doit porter ses libellés`);
      for (const v of champs) {
        if (/[\u00c0-\u00ff\u0152\u0153]/.test(v)) fautifs.push(`${f} : ${v}`);
      }
    }
    eq(fautifs.length, 0,
      'libellé(s) français dans la graine d’une démonstration anglaise : '
      + fautifs.join(' | '));
  });
});

/* ------------------------------------------------------------------
   Le journal patrimonial
   ------------------------------------------------------------------ */
suite('Le journal patrimonial ne montre que des relevés', () => {

  /* La page etait un calendrier : douze lignes existaient des le premier
     lancement, chacune surmontee d'une barre de composition, et un tableau de
     quinze colonnes se depliait dessous pour la correction. Un journal ne
     s'ouvre pas sur onze mois qui n'ont pas eu lieu. */

  test('les années proposées sont celles où quelque chose s’est passé', () => {
    /* `historyYears()` listait les annees PRESENTES dans la table, et le
       calendrier en ouvre douze mois d'avance : une annee existait des qu'on
       l'avait ouverte, sans porter un seul releve, et le selecteur proposait de
       consulter du vide. */
    auJour('2026-08-10', () => {
      Fixture.poser(s => {
        s.monthly = [
          { date: '2024-06-01', comment: '', v: { c_courant: 3000 } },
          { date: '2027-01-01', comment: '', v: {} },
          { date: '2027-02-01', comment: '', v: {} },
        ];
        s.budget.apports = [{ date: '2021-05-04', montant: 12000, libelle: 'Prime' }];
      });
      const ans = historyYears();
      vrai(ans.includes('2024'), 'l’année d’un relevé renseigné y est');
      vrai(ans.includes('2026'), 'l’année en cours y est toujours : elle doit pouvoir recevoir le relevé du mois');
      vrai(ans.includes('2021'), 'et celle d’un mouvement exceptionnel, qui partage ce sélecteur');
      vrai(!ans.includes('2027'),
        'mais pas une année dont les douze lignes sont vides : le menu proposerait du vide');
      /* Triee, et c'est ce que le selecteur affiche de haut en bas. */
      eq(ans.join(','), [...ans].sort().join(','), 'la liste est triée');
    });
  });

  test('une année entièrement vide disparaît du sélecteur', () => {
    /* Le cas exact de « + Ouvrir l'annee suivante », dont les lignes survivent
       dans le localStorage de qui a appuye dessus. */
    auJour('2026-08-10', () => {
      Fixture.poser(s => {
        s.monthly = [{ date: '2026-08-01', comment: '', v: { c_courant: 3000 } }];
        s.apports = [];
      });
      eq(historyYears().join(','), '2026', 'une seule année, celle du relevé');
    });
  });

  test('la vue ne garde que les mois renseignés, du plus récent au plus ancien', () => {
    const vue = lireSource('assets/app.js');
    const bloc = vue.slice(vue.indexOf('function viewHistory('),
                           vue.indexOf('function mountHistory('));
    vrai(bloc.length > 500, 'la vue doit être trouvable');
    vrai(/if \(rowIsEmpty\(r\)\) continue;/.test(bloc),
      'un mois sans montant ne fait pas une ligne de journal');
    vrai(/\.reverse\(\)/.test(bloc),
      'du plus récent au plus ancien : c’est la dernière entrée qu’on vient lire');
    vrai(/action: 'voir-releve'/.test(bloc),
      'et la ligne entière ouvre le détail du mois');
  });

  test('la variation se compte depuis le relevé précédent, pas depuis la ligne du dessus', () => {
    /* Le calendrier ouvrait douze mois d'avance : la ligne au-dessus de
       septembre etait presque toujours un aout vide, donc l'ecart valait zero et
       la colonne se taisait. La fenetre du mois, elle, cherchait deja le dernier
       mois RENSEIGNE — deux facons de dire « le releve d'avant » dans une meme
       page, et c'est celle qui s'affichait qui avait tort. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function viewHistory('),
                           src.indexOf('function mountHistory('));
    vrai(!/monthly\[i - 1\]/.test(bloc),
      'la ligne du dessus n’est plus la référence');
    vrai(/avant \? net - avant\.net : 0/.test(bloc),
      'c’est le relevé renseigné juste avant qui l’est, et de net à net');
    /* Et la fenetre de detail dit la meme chose, par le meme chemin : trois
       endroits, une seule definition. */
    for (const ou of ['releveMois: (arg)', 'function askMonthlySnapshot']) {
      const i = src.indexOf(ou);
      vrai(i > 0, `${ou} doit être trouvable`);
      vrai(/filter\(x => !rowIsEmpty\(x\)\)\.pop\(\)/.test(src.slice(i, i + 1600)),
        `${ou} cherche aussi le dernier mois renseigné`);
    }
  });

  test('les grosses barres de composition sont parties, et leur CSS avec', () => {
    /* Douze barres dont l'immobilier occupe les quatre cinquiemes se ressemblent
       toutes : on lisait la repartition, jamais la taille, sur un ecran et demi
       de defilement. Une regle CSS morte est l'autre moitie du meme defaut. */
    const src = lireSource('assets/app.js');
    const css = lireSource('assets/styles.css');
    for (const mort of ['ml-poches', 'ml-part', 'mlist-empile', 'ml-haut']) {
      vrai(!src.includes(mort), `${mort} n’est plus posé dans app.js`);
      vrai(!css.includes(mort), `ni défini dans styles.css`);
    }
    /* Et le parametre de `ligneListe` qui les portait : un parametre sans
       appelant est la moitie qu'on oublie. */
    const i = src.indexOf('function ligneListe(');
    vrai(i > 0, 'ligneListe doit être trouvable');
    vrai(!/barre/.test(src.slice(i, src.indexOf('\n}', i))),
      'ligneListe n’a plus de paramètre « barre »');
  });

  test('le compte parle de relevés, pas de mois du calendrier', () => {
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function viewHistory('),
                           src.indexOf('function mountHistory('));
    vrai(/\{n\} relevés en \{a\}/.test(bloc) && /\{n\} relevé en \{a\}/.test(bloc),
      '« 12 mois affichés » comptait les lignes du calendrier, remplies ou non');
    vrai(!/mois affich/.test(bloc), 'et cette formule a quitté le journal');
  });

  test('trois états vides, et ils ne disent pas la même chose', () => {
    /* Aucun releve du tout, aucun releve dans l'annee regardee, ou un mois en
       cours qui attend le sien : « rien pour l'instant » devant douze releves
       ranges dans l'annee d'a cote serait faux, et enverrait chercher un
       defaut. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function viewHistory('),
                           src.indexOf('function mountHistory('));
    for (const phrase of ['Aucun relevé mensuel pour le moment.',
                          'Aucun relevé en {a}.',
                          'Aucun relevé pour {m}.']) {
      vrai(bloc.includes(phrase), `l’état vide « ${phrase} » doit exister`);
    }
    /* Le mois en cours se tait quand le bandeau du haut porte deja le rappel :
       le meme fait annonce deux fois sur un ecran, c'est un de trop. */
    vrai(/attente\.vide && !attente\.missing/.test(bloc),
      'l’invitation du mois en cours cède le pas au bandeau de rappel');
  });

  test('« Enregistrer un relevé » ouvre la saisie du mois en cours', () => {
    /* L'action posait une ancre et faisait defiler la page jusqu'a la ligne du
       mois, ou un ⤒ attendait un second clic. Le journal n'a plus de ligne pour
       un mois vide, donc plus d'ancre a viser — et la jumelle des depenses ouvre
       depuis toujours sa fenetre directement. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf("async 'ajouter-releve'()");
    vrai(i > 0, 'l’action doit exister');
    const action = src.slice(i, src.indexOf('},', i));
    vrai(/askMonthlySnapshot\(indexReleve\(currentMonthKey\(\)\)\)/.test(action),
      'le mois en cours par défaut, sa ligne créée si elle manque, et la fenêtre s’ouvre');
    vrai(!/pendingAnchor/.test(action), 'plus d’ancre à viser');
    vrai(!src.includes("'go-snapshot'"), 'l’ancien nom ne survit nulle part');
    /* Les quatre portes du meme geste pointent sur la meme action. */
    vrai((src.match(/data-action="ajouter-releve"/g) || []).length >= 3,
      'les bandeaux et la carte appellent tous cette action');
    vrai(lireSource('assets/store.js').includes("action: 'ajouter-releve'"),
      'et le premier pas aussi');
  });

  test('la ligne du mois se crée triée, à un seul endroit', () => {
    /* Une ligne poussee en fin de table fausserait la variation de son voisin :
       le journal lit le releve d'avant dans l'ordre de la table. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function indexReleve(');
    vrai(i > 0, 'indexReleve doit être trouvable');
    const f = src.slice(i, src.indexOf('\n}', i));
    vrai(/\.sort\(\(a, b\) => String\(a\.date\)\.localeCompare\(String\(b\.date\)\)\)/.test(f),
      'la table reste triée par date');
    /* Deux endroits creaient cette ligne, avec deux tris ecrits a la main.
       Un fait se regle a un seul endroit. */
    eq((src.match(/monthly\.push\(\{ date:/g) || []).length, 1,
      'une seule fabrique de ligne de relevé');
  });

  test('le détail du mois porte la composition, et elle fait le total', () => {
    /* La liste ne porte que trois chiffres : la composition se lit dans la
       fenetre du mois. Les poches nulles en sortent, donc la somme des lignes
       affichees egale le total en tete — la regle de la maison. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('releveMois: (arg)');
    vrai(i > 0, 'le panneau doit exister');
    const panneau = src.slice(i, src.indexOf('\n  },', i));
    vrai(/rowGroups\(r\)/.test(panneau) && /rowTotal\(r\)/.test(panneau),
      'les poches et le total viennent des mêmes fonctions que la courbe');
    vrai(/seriesUtiles\(\[g\]\)/.test(panneau),
      'mêmes libellés et même ordre que la légende du graphique d’évolution');
    vrai(/Math\.abs\(num\(g\[p\.key\]\)\) > 0\.005/.test(panneau),
      'une poche nulle ne prend pas de ligne : le total doit égaler la somme des parts');
    vrai(/trad\('Compte par compte'\)/.test(panneau),
      'et les montants compte par compte y sont');
    vrai(/data-action="edit-month"/.test(panneau),
      'un clic montre, un second modifie');
    /* La note par defaut compare la ligne au patrimoine d'aujourd'hui, ce qui ne
       veut rien dire pour un mois passe. */
    vrai(/totalNote:/.test(panneau),
      'le panneau donne sa propre note : « % de tes avoirs » daterait d’aujourd’hui');
  });

  test('la fenêtre du relevé laisse choisir son mois', () => {
    /* « Ajouter un releve » propose le mois en cours, et le choix sert aux trois
       usages nommes : rattraper un mois oublie, importer un ancien historique,
       corriger une periode passee. Il vit DANS la fenetre : une etape avant elle
       aurait fait payer un clic au cas courant. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function askMonthlySnapshot(');
    const f = src.slice(i, src.indexOf('\n/* ====', i));
    vrai(/id="relMois"/.test(f) && /id="relAn"/.test(f), 'deux menus, mois et année');
    vrai(!/type="month"/.test(f),
      'et non un champ natif « month », que Safari de bureau rend en texte libre');
    vrai(/const choixMois = isCalendarMonth\(r\.date\)/.test(f),
      'une ligne de clôture hors calendrier n’a pas de mois à choisir');
    vrai(/async function allerAuMois\(\)/.test(f),
      'une fonction déclarée : le câblage la nomme plus bas, une const y serait dans sa zone morte');
    vrai(/if \(sale\)/.test(f.slice(f.indexOf('async function allerAuMois'))),
      'changer de mois avec une saisie non enregistrée pose la question');
  });

  test('les comptes clôturés se révèlent sans perdre la saisie', () => {
    /* L'option vivait en tete de la page des releves, ou elle elargissait le
       tableau de correction. Le tableau est parti : une case qui ne change rien
       a l'ecran se lit comme une panne. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function askMonthlySnapshot(');
    const f = src.slice(i, src.indexOf('\n/* ====', i));
    vrai(/const comptes = ACCOUNTS\.slice\(\);/.test(f),
      'tous les champs sont rendus, puis masqués : les reconstruire jetterait la saisie');
    vrai(/data-cloture/.test(f), 'les champs masqués sont marqués');
    vrai(/style="display:none"/.test(f),
      'style en ligne, parce que .field déclare son display et l’emporterait sur « hidden »');
    vrai(/const masque = a => a\.legacy && !num\(r\.v\?\.\[a\.id\]\)/.test(f),
      'un compte clôturé qui portait un montant ce mois-là reste visible');
    /* Et la photo ne cache pas un euro : elle parcourt tous les comptes, et le
       grand total les compte. */
    vrai(/closest\('\[data-cloture\]'\)/.test(f),
      'un champ masqué qui reçoit un montant se montre');
  });
});

/* ------------------------------------------------------------------
   La passe corrective : vocabulaire, langues, textes de developpement
   ------------------------------------------------------------------ */
suite('Rien de ce qui s’affiche n’échappe au dictionnaire', () => {

  /* `trad()` rend sa clef inchangee quand le dictionnaire ne la connait pas :
     une chaine oubliee s'affiche donc en francais a qui a choisi l'anglais, et
     rien ne le signale. Le defaut a deux moities, et il faut les deux tests. */

  test('aucun puits du DOM ne reçoit du français en dur', () => {
    /* La premiere moitie : une chaine ecrite directement dans un `textContent`
       ou un `title`, donc invisible au dictionnaire. Sept l'etaient, dont trois
       sur la pastille des cours. */
    const src = lireSource('assets/app.js');
    const accents = /[àâéèêëîïôöùûüç]/;
    const trouves = [];
    const motif = /\.(?:textContent|title|placeholder)\s*=\s*'([^'\\\n]{6,})'/g;
    for (const m of src.matchAll(motif)) {
      if (accents.test(m[1]) && / /.test(m[1])) trouves.push(m[1]);
    }
    eq(trouves.join(' | '), '',
      'ces textes s’affichent sans passer par trad(), donc en français en anglais');
  });

  test('les états vides des graphiques passent par le dictionnaire', () => {
    /* charts.js posait « Pas de donnees » deux fois en clair, et l'etiquette
       d'accessibilite du graphique reel/cible avec. */
    const src = lireSource('assets/charts.js');
    vrai(!/'<p class="empty">Pas de données<\/p>'/.test(src),
      'l’état vide d’un graphique se traduit comme le reste');
    vrai(/trad\('Pas de données'\)/.test(src), 'et il passe bien par trad()');
    vrai(!/aria-label="Réel contre cible"/.test(src),
      'l’étiquette d’accessibilité aussi : elle est lue à voix haute');
  });

  test('aucune consigne de développement dans un texte affiché', () => {
    /* Une infobulle et un toast disaient « lance Lancer-Dashboard.cmd » : le nom
       d'un fichier a lancer, dans une application. Ce que l'utilisateur a besoin
       de savoir tient dans le fait, pas dans la manoeuvre.

       Le bandeau du mode fichier garde son nom de lanceur, et c'est le seul :
       il ne parait que si l'application est ouverte comme un document local,
       ou nommer le raccourci EST la reponse utile. */
    const src = lireSource('assets/app.js');
    for (const mot of ['serve.py', 'localhost', '127.0.0.1', 'console.log', 'DevTools']) {
      const dans = [...src.matchAll(/trad\(\s*['"]([^'"]{4,})['"]/g)]
        .map(m => m[1]).filter(s => s.includes(mot));
      eq(dans.join(' | '), '', `« ${mot} » n’a rien à faire dans un texte affiché`);
    }
    /* Un seul message pour un seul fait : les deux exemplaires disaient la meme
       chose de deux facons, dont une qui donnait une consigne. */
    vrai(!/Passerelle non détectée/.test(src),
      'le mot « passerelle » est du vocabulaire d’implémentation');
    eq((src.match(/trad\('Impossible de mettre à jour les cours pour le moment'\)/g) || []).length, 3,
      'un seul texte, à ses trois portes : les deux toasts et l’infobulle de la pastille');
    /* Le bandeau du mode fichier est l'exception, et elle est assumee : il ne
       parait que si l'application est ouverte comme un document local, ou
       nommer le raccourci EST la reponse utile. Chaque depot nomme le sien --
       un script Windows ici, une commande Python la -- donc le controle porte
       sur la PLACE, pas sur le nom : toute mention d'un lanceur doit vivre dans
       ce bandeau, et nulle part ailleurs. */
    const banniere = src.indexOf("el.className = 'file-banner'");
    vrai(banniere > 0, 'le bandeau du mode fichier doit être trouvable');
    for (const m of src.matchAll(/Lancer-Dashboard\.cmd|python serve\.py/g)) {
      vrai(m.index > banniere && m.index - banniere < 900,
        `un lanceur est nommé hors du bandeau du mode fichier : « ${m[0]} »`);
    }
  });
});

suite('Un montant, un nom, partout', () => {

  test('« capacité d’épargne » et « objectif d’investissement » ne se confondent plus', () => {
    /* Deux montants differents qui se liraient tous les deux comme ce qu'on peut
       investir : l'un se calcule sur l'OBJECTIF de depenses, l'autre sur les
       depenses constatees, et c'est le second que Projection reprend. La barre
       du budget ne donne pas au premier un troisieme nom, Reste a investir /
       epargner, pour un chiffre qui en a deja un. */
    const src = lireSource('assets/app.js');
    vrai(!/Reste à investir/.test(src),
      'ce libellé entrait en concurrence avec « Capacité d’épargne »');
    /* Un seul endroit l'affiche depuis que « Epargne et croissance » a quitte
       l'onglet Charges fixes : la barre « Ou va ce que tu gagnes », dans l'onglet
       Depenses. Le libelle et l'aide y etaient deja repris de cette carte, mot
       pour mot, ce que son commentaire dit encore — le fait ne s'est donc pas
       perdu en route, il a cesse d'etre ecrit deux fois. */
    eq((src.match(/trad\('Objectif d’investissement'\)/g) || []).length, 1,
      'la barre du budget le nomme, et elle est seule à le faire');
    /* Et les deux grandeurs viennent bien de deux sources distinctes. */
    Fixture.poser();
    const rec = savingsReconciliation();
    vrai(rec.investable !== undefined && rec.targetSaving !== undefined,
      'les deux montants existent séparément dans le modèle');
    const f = budgetFrame();
    pres(rec.targetSaving, f.investTarget, 'l’objectif suit l’objectif de dépenses');
    pres(rec.investable, rec.income - rec.fixed - rec.spend,
      'la capacité d’épargne suit les dépenses constatées');
  });

  test('aucune croissance ne se dit « réelle »', () => {
    /* « Reel » veut dire « corrige de l'inflation » en finance, et Projection
       emploie deja cette notion sous le nom d'euros d'aujourd'hui. Le chiffre
       qui s'appelait « Croissance reelle du patrimoine » a d'abord ete renomme
       « Croissance observee », puis il a disparu avec la carte « Epargne et
       croissance » : il redisait le rythme observe d'Apercu > Aujourd'hui, ce
       que sa propre aide affirmait mot pour mot.

       Ce qui reste a garder est la regle de nommage, pas le libelle : aucune
       variation constatee ne doit se dire « reelle », et celle qui survit doit
       continuer de dire ce qu'elle contient. */
    const src = lireSource('assets/app.js');
    vrai(!/Croissance réelle du patrimoine/.test(src),
      'le mot « réelle » promettait une correction de l’inflation qui n’a pas lieu');
    /* La ligne survivante, dans « Rythme d'accumulation ». Les longues aides sont
       concatenees sur plusieurs lignes : on recolle avant de chercher, sinon le
       test depend de la mise en page. */
    const recolle = t => t.replace(/'\s*\+\s*'/g, '');
    const i = src.indexOf("trad('Moyenne mensuelle du patrimoine')");
    vrai(i > 0, 'la variation constatée du patrimoine garde sa ligne');
    const aide = recolle(src.slice(i, i + 900));
    vrai(/mouvements de marché et les apports/.test(aide),
      'et son aide dit ce qu’elle contient, marchés et apports compris');
    vrai(/Le mois en cours reste dehors/.test(aide),
      'ainsi que ce qu’elle laisse dehors');
  });

  test('aucune comparaison à une moyenne sans base', () => {
    /* « Au-dessus de 20 %, tu mets de cote nettement plus que la moyenne » : la
       moyenne de quel pays, a quel age, a quels revenus, mesuree comment ? Une
       comparaison sans base n'informe pas, elle rassure au hasard. */
    const src = lireSource('assets/app.js') + lireSource('assets/i18n.js');
    for (const motif of ['que la moyenne', 'Au-dessus de 20', 'above 20', 'Above 20']) {
      vrai(!src.includes(motif),
        `« ${motif} » compare à une moyenne que rien ne définit`);
    }
  });
});

suite('Projection dit ce que son moteur fait', () => {

  test('l’aide n’apprend plus à maquiller un taux', () => {
    /* « Garde un seul choix et ajuste le taux : moitie a 8 %, moitie sans
       rendement, cela fait 4 % sur le tout. » L'approximation tient dans un cas
       simplifie, se defait des qu'une autre poche porte quelque chose, et surtout
       melange allocation et rendement. Une V1 assume sa limite. */
    const src = lireSource('assets/app.js') + lireSource('assets/i18n.js');
    for (const m of ['cela fait 4 %', 'moitié à 8 %', 'half at 8%']) {
      vrai(!src.includes(m), `« ${m} » invite à bricoler le modèle`);
    }
    const app = lireSource('assets/app.js').replace(/'\s*\+\s*'/g, '');
    vrai(/la projection verse tout dans la poche sélectionnée/.test(app),
      'la limite est dite à la place, là où le choix se fait');
  });

  test('la note sous la courbe ne contredit pas l’amortissement', () => {
    /* La note affirmait que le capital rembourse chaque mois « n'est pas
       projete ». C'etait vrai d'une version anterieure du moteur : depuis,
       `moteurProjection` amortit les credits et ajoute le capital rendu a la part
       plate. Un texte qui dit le contraire du calcul fait douter du chiffre
       juste, et c'est le pire des deux defauts. */
    const store = lireSource('assets/store.js');
    vrai(/dettes: \(impose \|\| opts\.plat != null\) \? \[\] : dettesAmortissables\(\)/.test(store),
      'le moteur reçoit bien les dettes amortissables');
    vrai(/d\.reste -= capital;/.test(store), 'et il les amortit mois par mois');
    vrai(/const plat = c\.plat \+ capitalRendu;/.test(store),
      'le capital rendu rejoint la part plate, qui monte donc');

    const app = lireSource('assets/app.js');
    const i = app.indexOf('const amortis = dettesAmortissables().length;');
    vrai(i > 0, 'la note interroge le moteur au lieu de supposer');
    const note = app.slice(i, i + 1400);
    vrai(/Le capital que tes mensualités remboursent est projeté/.test(note),
      'et elle le dit quand il l’est');
    vrai(/leur remboursement ne peut pas être projeté/.test(note),
      'et dit l’inverse quand aucun crédit n’est amortissable, ce qui arrive');
    vrai(!/le capital que tes mensualités remboursent chaque mois, ni la fin du prêt ne sont projetés/.test(app),
      'l’ancienne phrase, qui contredisait le calcul, est partie');

    /* La preuve par le calcul : deux horizons, et la part plate monte. */
    Fixture.poser(s => {
      s.etabs = (s.etabs || []).map(e => ({ ...e }));
      const e = s.etabs[0];
      if (e) e.dettes = [{ montant: 100000, taux: 2, mensualite: 600, initial: 120000 }];
    });
    if (dettesAmortissables().length) {
      const a = moteurProjection(configProjection({ years: 1 }));
      const b = moteurProjection(configProjection({ years: 5 }));
      vrai(b.final.plat > a.final.plat,
        'la part plate monte avec le temps : c’est le capital remboursé');
    }
  });

  test('« Reprendre depuis le budget » vit sous le champ qu’il change', () => {
    /* Le bouton concernait « Versement mensuel » et vivait au bas du depliant,
       apres les trois taux, l'inflation et la cible : une action a six reglages
       du seul champ qu'elle modifie. */
    const src = lireSource('assets/app.js');
    vrai(/trad\('Reprendre ce montant'\)/.test(src), 'le bouton existe');
    const iBouton = src.indexOf("data-action=\"proj-use-budget\"");
    const iChamp = src.indexOf("trad('Valeur figée. Ta capacité d’épargne est de')");
    vrai(iChamp > 0 && iBouton > iChamp && iBouton - iChamp < 700,
      'il suit immédiatement la ligne qui annonce la capacité d’épargne');
    vrai(!/Reprendre'\)\} \$\{fmtEUR0\(suggestedMonthly\(\)\)\} \$\{trad\('\/ mois'\)/.test(src),
      'et l’ancien bouton du bas de page est parti, pas dupliqué');
  });
});

suite('Un intitulé dit exactement ce qu’il regroupe', () => {

  test('« Par enveloppe » regroupait aussi ce qui n’en est pas une', () => {
    /* Le regroupement part de la table des types de compte, qui porte un bien
       immobilier, une SCPI, un bien de valeur et des especes. Une enveloppe est
       un contenant fiscal ; un appartement n'en est pas un. */
    const src = lireSource('assets/app.js');
    vrai(!/trad\('Par enveloppe'\)/.test(src),
      'le libellé promettait des enveloppes et livrait des murs');
    vrai(/trad\('Type de détention'\)/.test(src),
      'et le nouveau est vrai de chaque ligne du groupe');
    /* La preuve par les donnees : le groupement porte bien des types qui ne sont
       pas des enveloppes. */
    Fixture.poser();
    const ids = new Set(TYPES_COMPTE.map(x => x.id));
    for (const horsEnveloppe of ['immo', 'bienValeur', 'especes']) {
      vrai(ids.has(horsEnveloppe),
        `${horsEnveloppe} est un type de compte, donc un groupe possible`);
    }
  });

  test('Données garde le diagnostic, sans l’imposer', () => {
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewData('), src.indexOf('function mountData('));
    /* Rien n'est retire : les cinq mesures sont toutes la, dans le depliant. */
    for (const mesure of ['Positions', "trad('Relevés enregistrés')", "trad('Comptes suivis')",
                          "trad('Taille du stockage')", "trad('Version')"]) {
      vrai(vue.includes(mesure), `${mesure} reste disponible`);
    }
    /* Et le compte des releves ne compte plus les mois vides du calendrier :
       « 25 » pour huit releves n'apprenait rien a personne. */
    vrai(/monthly\.filter\(r => !rowIsEmpty\(r\)\)\.length/.test(vue),
      'le compte porte sur les relevés renseignés');
    /* Le sous-titre de la page decrit la page. */
    const dico = lireSource('assets/i18n.js');
    vrai(!/'view\.data\.sub': 'Export, import/.test(dico),
      'le sous-titre ne se limite plus à trois des sept gestes');
    vrai(/'view\.data\.sub': 'Sauvegarde, synchronisation et contrôle de tes données'/.test(dico)
      && /'view\.data\.sub': 'Backup, sync and control of your data'/.test(dico),
      'et il est traduit dans les deux langues');
  });

  test('Positions ouvre sur le portefeuille, pas sur le marché', () => {
    /* La barre des reperes ouvrait la page : l'ecran commencait par le marche en
       general, avant les chiffres du detenteur. Le portefeuille ouvre la page,
       le jour vit dans sa carte, les lignes de titres suivent. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewPositions('),
                          src.indexOf('function mountPositions('));
    const l = [`trad('Portefeuille')`, '${sectionJour()}', '${composerMarches(blocsMarches)}'].map(r => vue.indexOf(r));
    vrai(l.every((n, k) => n > 0 && (k === 0 || n > l[k - 1])),
      `le portefeuille, son jour, puis les cartes rangées : ${l.join(' < ')}`);
    vrai(vue.indexOf('id="reperesFamilles"') > 0 && vue.indexOf('id="reperes"') > 0, 'les repères restent là');
    vrai(/\$\('#reperes'\)/.test(src), 'le ruban est toujours monté');
  });
});

suite('Aucune branche morte gardée à côté de celle qui décide', () => {

  test('aucune condition toujours vraie ni toujours fausse', () => {
    /* `if (!l.marche || true)` : une moitie morte a cote de celle qui decidait,
       et le lecteur suivant aurait cherche ce que `!l.marche` filtre. */
    for (const f of ['assets/app.js', 'assets/store.js', 'assets/charts.js']) {
      const src = lireSource(f);
      for (const motif of ['|| true', '&& false', 'if (true)', 'if (false)']) {
        vrai(!src.includes(motif), `${f} porte « ${motif} », une branche morte`);
      }
    }
  });

  test('la décomposition d’un compte compte toutes ses lignes', () => {
    /* Ce que la moitie morte proposait d'ecarter : les lignes cotees. Un
       compte-titres se serait decompose en rien du tout, sous sa propre valeur.
       Un total egale la somme de ses parts. */
    const src = lireSource('assets/app.js');
    vrai(/for \(const l of lignes\) parClasse\.set\(l\.classe/.test(src),
      'toutes les lignes entrent dans la décomposition par classe');
  });
});

/* ------------------------------------------------------------------
   Le poids d'une position : une seule convention
   ------------------------------------------------------------------ */
suite('Un poids de portefeuille, une seule définition', () => {

  /* Il y en avait deux, et la fiche d'une ligne le disait en toutes lettres :
     « d'ou deux pourcentages differents pour une meme ligne, et tous les deux
     justes ». Chacun se defendait, mais la meme position s'affichait a 66,8 %
     dans le tableau du jour et a 53,89 % sur sa fiche, a un clic d'ecart. Deux
     nombres justes qui se contredisent a l'ecran font douter des deux.

     Le fixture porte 9 000 EUR d'ETF, 750 d'or et 1 500 de cash a investir :
     11 250 de base, donc des parts rondes a verifier de tete. */

  test('le poids se calcule sur les titres ET le cash à investir', () => {
    Fixture.poser();
    const st = stockTotals();
    pres(st.balance, 11250, 'la base : 9 000 d’ETF + 750 d’or + 1 500 de cash');
    const etf = Store.state.positions.find(p => p.symbol === 'IWDA');
    pres(poidsPortefeuille(posValue(etf)), 80,
      '9 000 sur 11 250 font 80 %, et non 92,3 % sur les titres seuls');
  });

  test('sans cash, le résultat retombe sur l’ancien calcul', () => {
    /* La convention n'invente rien quand il n'y a pas de tresorerie : elle
       redonne exactement la part dans les titres. C'est ce qui rend le
       changement lisible pour qui place tout le jour meme. */
    Fixture.poser(s => {
      const pea = s.comptes.find(c => c.id === 'c_pea');
      pea.cash = [];
    });
    const st = stockTotals();
    pres(st.cashToInvest, 0, 'plus de cash à investir');
    pres(st.balance, st.invested, 'la base se réduit aux titres');
    const etf = Store.state.positions.find(p => p.symbol === 'IWDA');
    const surTitresSeuls = posValue(etf) / st.invested * 100;
    pres(poidsPortefeuille(posValue(etf)), surTitresSeuls,
      'les deux formules coïncident dès que le cash vaut zéro');
  });

  test('la somme des positions fait la part des titres', () => {
    /* C'est l'invariant qui rend la colonne lisible : les poids ne totalisent
       pas 100 %, ils totalisent la part investie, et le cash complete. */
    Fixture.poser();
    const st = stockTotals();
    const base = basePortefeuilleMarches();
    const somme = Store.state.positions
      .reduce((s, p) => s + poidsPortefeuille(posValue(p), base), 0);
    pres(somme, st.invested / st.balance * 100,
      'la somme des poids EST la part des titres');
    pres(somme, 86.6667, 'soit 9 750 sur 11 250');
  });

  test('positions et cash font 100 %', () => {
    Fixture.poser();
    const base = basePortefeuilleMarches();
    const somme = Store.state.positions
      .reduce((s, p) => s + poidsPortefeuille(posValue(p), base), 0);
    const cash = poidsPortefeuille(stockTotals().cashToInvest, base);
    pres(somme + cash, 100, 'aux arrondis près, le portefeuille est entier');
    pres(cash, 13.3333, 'et le cash pèse 1 500 sur 11 250');
  });

  test('un portefeuille vide ne rend ni NaN ni Infinity', () => {
    /* Une division par zero affichee est un defaut ; « 0 % » est la reponse
       juste quand il n'y a rien a repartir. Deux cas : rien du tout, et du cash
       sans une seule position. */
    Fixture.poser(s => { s.positions = []; s.comptes.find(c => c.id === 'c_pea').cash = []; });
    eq(poidsPortefeuille(0), 0, 'portefeuille entièrement vide');
    vrai(Number.isFinite(poidsPortefeuille(1000)), 'et jamais Infinity');

    Fixture.poser(s => { s.positions = []; });
    const st = stockTotals();
    vrai(st.cashToInvest > 0 && st.invested === 0, 'du cash, aucune position');
    eq(poidsPortefeuille(0), 0, 'aucun poids de position à donner');
    pres(poidsPortefeuille(st.cashToInvest), 100, 'le cash fait tout le portefeuille');
  });

  test('tableau, fiche et export passent par la même fonction', () => {
    /* Le calcul etait recopie a cinq endroits, et c'est le quatrieme qui a
       diverge. Une fonction, cinq appelants : la prochaine divergence demande
       de modifier la fonction, donc de le voir. */
    const src = lireSource('assets/app.js');
    const store = lireSource('assets/store.js');
    vrai(/function poidsPortefeuille\(valeur, base = basePortefeuilleMarches\(\)\)/.test(store),
      'la définition vit dans store.js, avec la base');
    vrai(!/poidsLigne\(/.test(src),
      'l’ancienne fonction, qui divisait par les titres seuls, n’a plus d’appelant');
    /* Aucun calcul de poids ecrit a la main ne subsiste : ni sur `balance`, ni
       sur une somme de positions refaite sur place. */
    for (const motif of [
      /stockTotals\(\)\.balance \? /,
      /\/ stockTotals\(\)\.balance \* 100/,
      /positions\.reduce\(\(s, p\) => s \+ posValue\(p\)\)/,
    ]) {
      vrai(!motif.test(src),
        `un poids se calcule encore à la main dans app.js : ${motif}`);
    }
    /* Et les cinq surfaces l'appellent bien. */
    /* Un argument, donc un appel : la mention `poidsPortefeuille()` du
       commentaire qui raconte la fusion ne compte pas. */
    eq((src.match(/poidsPortefeuille\([^)]/g) || []).length, 6,
      'le détail du jour, le tableau des lignes, la fiche, '
      + 'les deux cellules de l’export et l’aperçu du cash');
  });

  test('les trois libellés disent la même base', () => {
    const src = lireSource('assets/app.js').replace(/'\s*\+\s*'/g, '');
    /* L'intitule « Poids » de la carte du jour n'a plus d'aide : c'est la
       colonne du tableau des lignes et la fiche qui nomment la base. */
    vrai(/\$\{enteteJour\('Poids'\)\}/.test(src), 'la carte du jour dit « Poids », sans aide');
    for (const ou of ["sortableTh('poids', '% portef.'"]) {
      const i = src.indexOf(ou);
      vrai(i > 0, `${ou} doit être trouvable`);
      vrai(/cash à investir inclus/.test(src.slice(i, i + 500)),
        `l’aide de ${ou} nomme la base`);
    }
    const j = src.indexOf("trad('Part du portefeuille')");
    vrai(j > 0 && /cash à investir inclus/.test(src.slice(j, j + 400)),
      'et la fiche aussi, avec les mêmes mots');
    vrai(!/tous les deux justes/.test(src),
      'la phrase qui expliquait la divergence n’a plus rien à expliquer');

    /* Et les trois textes ont leur clef anglaise. Ils passent par un helper qui
       les traduit lui-meme, donc le balayage des `trad('...')` litteraux ne les
       voit pas : ils s'epinglent ici, ou l'on sait lequel est un libelle. */
    for (const s of [
      'Part de cette ligne dans l’ensemble de ton portefeuille Marchés, cash à investir '
        + 'inclus. Elle dit laquelle compte vraiment quand elle bouge : 1 % sur une ligne '
        + 'qui pèse la moitié du portefeuille déplace plus d’argent que 10 % sur une ligne '
        + 'à 3 %.',
      'Part de cette ligne dans l’ensemble de ton portefeuille Marchés, cash à investir '
        + 'inclus. Le même calcul que la colonne « Poids » de la carte du jour et que la '
        + 'fiche de la ligne.',
      'Calculé sur la valeur totale de ton portefeuille Marchés, cash à investir inclus. '
        + 'Le même calcul que la colonne « Poids » de la carte du jour et que le tableau '
        + 'des lignes.',
    ]) {
      vrai(I18N.en[s] !== undefined,
        `cette aide s’afficherait en français en anglais : « ${s.slice(0, 50)}… »`);
    }
  });

  test('Cible garde sa base, et elle la nomme', () => {
    /* Cible pouvait demander un autre denominateur : verification faite, elle
       raisonne deja sur titres + tresorerie, donc la meme convention. Ce qui
       lui est propre, c'est qu'une classe peut etre mise hors jeu : sa base
       tombe alors d'autant, les pourcentages continuent de totaliser 100 %, et
       le retrait est annonce. Une exception declaree n'est pas une divergence. */
    Fixture.poser(s => { s.targets = { ...(s.targets || {}), exclues: [] }; });
    const r = rebalanceRows();
    pres(r.base, stockTotals().balance,
      'sans exclusion, Cible et Positions partagent exactement la base');

    Fixture.poser(s => {
      s.targets = { ...(s.targets || {}), exclues: [CLE_TRESORERIE] };
    });
    const r2 = rebalanceRows();
    pres(r2.base, stockTotals().balance - stockTotals().cashToInvest,
      'la trésorerie retirée quitte la base, comme une classe sortie');
    vrai(r2.cashSorti, 'et la page le sait, pour le dire');

    /* Le perimetre est ecrit a l'ecran, ce qui est la condition pour que la
       difference ne soit pas une contradiction. */
    const src = lireSource('assets/app.js');
    vrai(/trad\('Ces cibles ne portent que sur'\)/.test(src),
      'la carte nomme son périmètre en tête');
    vrai(/base des pourcentages ci-dessus/.test(src),
      'et son pied nomme la base des pourcentages');
  });
});

/* ------------------------------------------------------------------
   Un mouvement exceptionnel appartient a une date
   ------------------------------------------------------------------ */
suite('Un mouvement exceptionnel dit à quel mois il appartient', () => {

  test('un champ obligatoire vide n’est plus « zéro »', () => {
    /* `String(0).trim()` vaut « 0 », donc non vide : un montant declare
       obligatoire passait la garde a zero, et la ligne s'enregistrait sans
       montant. La regle vit dans askForm, une fois, parce qu'une dizaine de
       fenetres en dependent et que la onzieme l'aurait oubliee. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('const vide = c => {');
    vrai(i > 0, 'askForm doit dire ce qu’est un champ vide, par type');
    const bloc = src.slice(i, i + 320);
    vrai(/if \(c\.type === 'nombre'\) return !num\(v\);/.test(bloc),
      'un nombre obligatoire à zéro est vide');
    vrai(/champs\.find\(c => estRequis\(c\) && vide\(c\)\)/.test(src),
      'et la garde passe par cette définition, pas par String()');
    /* `estRequis` lit un booleen ou appelle une fonction des valeurs saisies :
       un champ peut dependre d'un autre. La definition du vide, elle, ne change
       pas -- c'est toujours elle qui fait mordre l'obligation a zero. */
    vrai(/const estRequis = c => typeof c\.requis === 'function' \? c\.requis\(out\) : c\.requis;/
      .test(src), 'et un champ obligatoire peut dépendre d’un autre');
  });

  test('date, montant et motif sont obligatoires, à la création comme à la correction', () => {
    /* Un mouvement sans motif est une ligne muette dans un journal dont tout
       l'objet est de dire d'ou vient l'argent ; sans montant il ne corrige rien
       au rythme d'accumulation, la seule chose qu'il alimente ; sans date il
       n'appartient a aucun mois, donc n'ecarte aucun mois du calcul. */
    const src = lireSource('assets/app.js');
    const bornes = [
      ["async 'ajouter-apport'", "async 'editer-apport'"],
      ["async 'editer-apport'", "async 'add-charge'"],
    ];
    for (const [debut, fin] of bornes) {
      const i = src.indexOf(debut);
      vrai(i > 0, `${debut} doit être trouvable`);
      const bloc = src.slice(i, src.indexOf(fin, i + 5));
      for (const cle of ['libelle', 'montant', 'date']) {
        const champ = bloc.slice(bloc.indexOf(`cle: '${cle}'`));
        vrai(/requis: true/.test(champ.slice(0, 200)),
          `${debut} : le champ « ${cle} » doit être obligatoire`);
      }
      vrai(/cle: 'date'[\s\S]{0,200}mois: true/.test(bloc),
        `${debut} : la date doit nommer son mois`);
    }
  });

  test('le mois écrit sous la date suit la frappe', () => {
    /* Ecrit une fois a l'ouverture, il aurait menti des la premiere correction :
       c'est justement en changeant la date qu'on se demande dans quel mois ça
       tombe. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf("for (const c of champs.filter(x => x.mois && x.type === 'date'))");
    vrai(i > 0, 'le câblage du miroir doit être trouvable');
    const bloc = src.slice(i, i + 700);
    vrai(/addEventListener\('input', maj\)/.test(bloc)
      && /addEventListener\('change', maj\)/.test(bloc),
      'la frappe et le calendrier mettent tous deux le mois à jour');
    vrai(/maj\(\);/.test(bloc), 'et il est juste dès l’ouverture');
    vrai(/fmtMoisAn\(champ\.value\)/.test(bloc),
      'le mois s’écrit en lettres, avec son année entière');
    vrai(/Sans date, ce mouvement ne compte dans aucun mois/.test(bloc),
      'une date effacée le dit, au lieu d’afficher un mois faux');
  });
});

suite('Un en-tête de carte ne laisse pas flotter son compte', () => {

  test('le compte des relevés se lit sous le titre', () => {
    /* Entre le titre et les commandes, il n'appartenait ni a l'un ni aux autres,
       et l'oeil le prenait pour une troisieme commande. */
    const src = lireSource('assets/app.js');
    const css = lireSource('assets/styles.css');
    const vue = src.slice(src.indexOf('function viewHistory('),
                          src.indexOf('function mountHistory('));
    const i = vue.indexOf('<div class="tete-titre">');
    vrai(i > 0, 'le titre et son compte vivent dans un même bloc');
    const bloc = vue.slice(i, vue.indexOf('</div>', i));
    vrai(/<h2>/.test(bloc) && /\{n\} relevés en \{a\}/.test(bloc),
      'le titre puis le compte, dans cet ordre');
    /* Les commandes restent a droite, donc apres le bloc. On cherche a partir
       du bloc et non depuis le debut de la vue : le bandeau de rappel, tout en
       haut, porte deja un bouton « ajouter un releve », et c'est lui que la
       recherche trouvait. */
    const apres = vue.slice(i);
    const l = ["yearControl('history-year'", 'data-action="ajouter-releve"']
      .map(r => apres.indexOf(r));
    vrai(l.every((n, k) => n > 0 && (k === 0 || n > l[k - 1])),
      `après le titre viennent l’année puis le bouton : ${l.join(' < ')}`);
    vrai(/\.card-head \.tete-titre \{/.test(css),
      'et la classe est définie dans la feuille');
  });

  test('le sous-titre d’Historique dit ce que la page raconte', () => {
    /* « Mois par mois, compte par compte » decrivait l'editeur que la page
       etait : un tableau de quinze colonnes. Elle raconte maintenant une suite
       de releves. */
    const dico = lireSource('assets/i18n.js');
    vrai(!/'view\.overview\.historique\.sub': 'Mois par mois/.test(dico),
      'l’ancien sous-titre décrivait un tableau qui n’existe plus');
    vrai(/'view\.overview\.historique\.sub': 'Ton patrimoine, mois après mois'/.test(dico)
      && /'view\.overview\.historique\.sub': 'Your wealth, month after month'/.test(dico),
      'et le nouveau est traduit dans les deux langues');
  });
});

/* ------------------------------------------------------------------
   Le dictionnaire couvre tout ce qui s'affiche
   ------------------------------------------------------------------ */
suite('Chaque chaîne affichée a sa clef anglaise', () => {

  /* `trad()` rend sa clef inchangee quand le dictionnaire ne la connait pas.
     Une chaine sans clef s'affiche donc en francais a qui a choisi l'anglais,
     et rien ne le signale : ni erreur, ni trace, ni difference visible pour qui
     travaille en francais. C'est le defaut le plus discret de cette base.

     Le controle vivait dans un script lance a la main. Un script qu'on oublie
     de lancer ne proteste pas, et c'est exactement ce qui est arrive : un motif
     de suppression trop large a emporte la voisine de la clef visee, deux fois,
     et il a fallu un rejet de portage pour le voir. La verification est donc
     ici, avec celles qui tournent a chaque fois. */

  /* Un appel a trad(), avec ses concatenations et les commentaires qui peuvent
     s'y glisser : les longues aides s'ecrivent sur plusieurs lignes, parfois
     coupees par un bloc de prose qui explique le choix des mots. Reconstruire
     la chaine entiere est la seule facon de la chercher dans le dictionnaire. */
  /* Un litteral, jamais `new RegExp` depuis une chaine : ce depot y a deja
     perdu une demi-journee, une classe de caracteres etant arrivee amputee d'un
     niveau d'echappement. Elle excluait alors la lettre « s » au lieu des
     espaces, sans erreur ni message, et trente-six badges d'aide ne se
     collaient plus. Un niveau d'echappement, pas trois. */
  const APPEL = /trad\(\s*((?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")(?:\s*(?:\/\*[\s\S]*?\*\/)?\s*\+\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"))*)/g;

  /* Les litteraux d'une concatenation, recolles et desechappes. */
  const recoller = (bout) => {
    const morceaux = bout.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) || [];
    return morceaux
      .map(s => s.slice(1, -1))
      .join('')
      .replace(/\\'/g, "'").replace(/\\"/g, '"')
      .replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  };

  const FICHIERS = ['assets/app.js', 'assets/store.js', 'assets/charts.js',
                    'assets/quotes.js', 'assets/cloudsync.js'];

  test('aucune chaîne ne s’affiche sans traduction', () => {
    const manquantes = [];
    let vues = 0;
    for (const f of FICHIERS) {
      const src = lireSource(f);
      if (!src) continue;
      for (const m of src.matchAll(APPEL)) {
        const s = recoller(m[1]);
        if (!s) continue;
        vues++;
        /* Le dictionnaire est charge : on l'interroge, plutot que de reparser
           le fichier et de risquer un motif qui mente. */
        if (I18N.en[s] === undefined) manquantes.push(`${f} — ${s.slice(0, 70)}`);
      }
    }
    vrai(vues > 1200, `les appels doivent être trouvables (${vues} vus)`);
    eq(manquantes.slice(0, 6).join('\n'), '',
      `${manquantes.length} chaîne(s) s’afficheraient en français en anglais`);
  });

  /* Un controle general des libelles passes par un helper a ete essaye, puis
     retire. `sortableTh(cle, libelle, classe, explication, suffixe)` porte cinq
     arguments dont deux ne sont pas du texte affiche : sans recopier sa
     signature dans le test, on ne sait pas lequel est lequel, et le controle
     criait sur une classe CSS et sur un suffixe de colonne. Recopier une
     signature, c'est en tenir deux d'accord.

     Ce qui garde ce terrain : les libelles des colonnes dont la base a change
     sont epingles nommement, dans la suite du poids de portefeuille, et le
     rendu anglais des onze ecrans a ete releve a la main. Le trou automatique
     restant est nomme : un libelle passe par un helper et jamais par un
     `trad('...')` litteral n'est pas balaye. */

  test('une clef ne se déclare qu’une fois par langue', () => {
    /* Deux declarations, et la derniere gagne, en silence. Le cas se presente
       quand on ajoute une clef qui existait sous une autre traduction : quatre
       l'ont fait lors d'un portage. */
    const src = lireSource('assets/i18n.js');
    const debut = src.indexOf('const I18N = {');
    /* Le bloc anglais seul : le bloc francais porte les memes clefs pointees,
       et une clef presente dans les deux n'est pas un doublon. */
    /* Le dictionnaire anglais vit en plusieurs segments : le litteral
       d'origine, puis chaque Object.assign. Une clef repetee d'un segment a
       l'autre gagnerait aussi en silence, donc tous se lisent ensemble. */
    const bloc = [src.slice(debut, src.indexOf('\n  },', debut)),
      ...[...src.matchAll(/^Object\.assign\(I18N\.en, \{\n([\s\S]*?)^\}\);$/gm)].map(m => m[1])].join('\n');
    const CLEF = /^\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*:\s*['"]/gm;
    const vues = new Set(), doubles = [];
    for (const m of bloc.matchAll(CLEF)) {
      const k = (m[1] !== undefined ? m[1] : m[2]);
      if (vues.has(k)) doubles.push(k.slice(0, 60));
      vues.add(k);
    }
    vrai(vues.size > 1500, `le dictionnaire doit être lisible (${vues.size} clefs)`);
    eq(doubles.join(' | '), '', 'une clef déclarée deux fois : la dernière gagnerait');
  });
});

/* ------------------------------------------------------------------
   Budget : le niveau de detail, le mois courant, les mois futurs
   ------------------------------------------------------------------ */
suite('Deux états, et l’affichage suit la saisie', () => {

  /* Trois mois repartis entre trois categories, dont deux mois incomplets : de
     quoi verifier qu'un total tient quand ses parts changent de place. Le
     `troisMois` d'une autre suite lui est local, et deux fixtures identiques
     finiraient par diverger -- celui-ci porte son propre nom. */
  const troisMoisRepartis = e => {
    e.budget.categories = ['Courses', 'Sport', 'Transports'];
    e.budget.retirees = [];
    e.budget.expenses = [
      { month: '2026-01-01', v: { Courses: 400, Sport: 60, Transports: 40 }, note: '' },
      { month: '2026-02-01', v: { Courses: 500, Sport: 60 }, note: '' },
      { month: '2026-03-01', v: { Courses: 300, Transports: 90 }, note: '' },
    ];
  };

  /* Ou l'on repartit ses depenses entre des categories, ou l'on ne remplit
     qu'une case. Il n'y a pas de troisieme cas, et pas de reglage d'affichage a
     cote : `sansDistinction()` est la seule source de verite. */

  test('l’état se lit sur la saisie, sans drapeau ni préférence', () => {
    Fixture.poser();
    vrai(!sansDistinction(), 'le fixture répartit ses dépenses');
    neePlusDetailler();
    vrai(sansDistinction(), 'après le geste, une seule case reste à remplir');
    vrai(Store.state.meta.budgetDetail === undefined,
      'et aucune préférence d’affichage n’est écrite à côté');
  });

  test('catégories actives : la page montre les analyses catégorielles', () => {
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget(section'),
                          src.indexOf('function mountBudget('));
    /* La carte et les colonnes sont sous condition, et la condition est la
       bonne : une seule, lue partout de la meme facon. */
    const i = vue.indexOf("trad('Par catégorie')");
    vrai(i > 0, 'la carte doit exister dans la source');
    vrai(/\$\{sansDistinction\(\) \? '' : `/.test(vue.slice(Math.max(0, i - 900), i)),
      'elle ne se rend que si les catégories sont actives');
    eq((vue.match(/sansDistinction\(\)/g) || []).length, 9,
      'la carte, ses trois rangées de colonnes, le compte de l’en-tête, la fiche '
      + 'de la tuile de la moyenne, le bouton qui ajoute une catégorie, le '
      + 'dépliant qui les renomme et les supprime, et le commentaire qui dit '
      + 'pourquoi il n’y a pas de réglage de plus');
  });

  test('aucune ventilation par catégorie ne survit, tuiles et fiches comprises', () => {
    /* La carte et les colonnes avaient ete conditionnees, la FICHE d'une tuile
       non : « Moyenne par mois » ouvrait encore la moyenne ventilee sur neuf
       categories. Un balayage vaut mieux qu'un souvenir -- on liste les surfaces
       qui appellent `expenseByCategory` et on exige que chacune soit gardee. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget(section'),
                          src.indexOf('function mountBudget('));
    /* La tuile n'ouvre sa fiche que si les categories servent encore. */
    vrai(/sansDistinction\(\) \? null : 'depensesCategories'/.test(vue),
      'la tuile de la moyenne n’ouvre plus la ventilation par catégorie');
    /* Le montage verifie que son conteneur existe : la carte peut ne pas etre
       rendue du tout. */
    const mont = src.slice(src.indexOf('function mountBudget('));
    vrai(/if \(\$\('#bCats'\)\) Charts\.rankedBars/.test(mont),
      'et le graphique ne se monte que si sa carte est là');
    /* Toutes les surfaces qui ventilent sont recensees : trois, et chacune est
       gardee. Une quatrieme qui apparaitrait ferait tomber ce compte. */
    eq((src.match(/expenseByCategory\(/g) || []).length, 3,
      'la carte, son graphique et la fiche de la tuile : pas une de plus');
  });

  test('catégories désactivées : rien n’est affiché, rien n’est perdu', () => {
    /* Le point le plus important : l'affichage suit le choix courant, le
       stockage garde l'histoire. */
    Fixture.poser(troisMoisRepartis);
    const avant = JSON.stringify(Store.state.budget.expenses);
    const detailles = Store.state.budget.expenses
      .filter(r => Object.keys(r.v || {}).length > 1).length;
    vrai(detailles > 0, 'le fixture porte des mois répartis entre catégories');

    neePlusDetailler();
    vrai(sansDistinction(), 'les catégories sont désactivées');
    eq(JSON.stringify(Store.state.budget.expenses), avant,
      'et aucun montant n’a bougé : le geste ne touche qu’à la liste proposée');
    /* Les categories elles-memes restent dans la liste : c'est elle que
       l'export et la fenetre du mois parcourent. */
    vrai(expenseCategories().length > 1,
      'les catégories restent dans le stockage, pour l’export et le retour');
  });

  test('dans un mois déjà réparti, les cases retirées se replient', () => {
    /* Le mode « une seule case » ne changeait rien a la fenetre d'un mois passe :
       sept cases s'y presentaient encore, parce qu'une categorie retiree garde la
       sienne des qu'elle porte un montant. La raison etait bonne -- sans elle, le
       total du mois n'aurait aucune part visible et deviendrait incorrigible --
       mais en ouvrir sept sur un mois deja reparti ne respecte pas le geste.

       Elles passent derriere un pli. Rien ne quitte le document, donc
       l'enregistrement les relit comme avant : c'est le motif des comptes
       clotures dans la fenetre d'un releve. */
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf('function askExpenseMonth'), src.indexOf('id="depNote"'));
    vrai(/const repliees = sansDistinction\(\)/.test(f),
      'le pli ne se forme que si les catégories sont désactivées');
    vrai(/categorieRetiree\(c\) && num\(r\.v\?\.\[c\]\)/.test(f),
      'et ne prend que les catégories retirées qui portent un montant');
    vrai(/const ouvertes = cats\.filter\(c => !repliees\.includes\(c\)\)/.test(f),
      'les autres restent ouvertes : les deux listes partagent une seule source');
    /* Le sommaire dit ce qu'il contient : un pli muet se lit comme une option,
       pas comme un montant. Compte ET somme, pour que le total du mois se
       retrouve a l'oeil -- la case ouverte plus le pli. */
    vrai(/\{n\} montants déjà répartis, \{v\}/.test(f)
      && /\{n\} montant déjà réparti, \{v\}/.test(f),
      'le sommaire porte le compte et la somme, au singulier comme au pluriel');
    vrai(/const somme = repliees\.reduce/.test(f),
      'et cette somme est celle des cases repliées');
    /* Aucun pave de texte : cette fenetre a deja paye une fois le champ de note
       repousse hors du cadre sur telephone. */
    eq((f.match(/class="hint"/g) || []).length, 0,
      'le sommaire suffit, aucun paragraphe de plus');

    /* Et la preuve par les donnees : replier ne retire aucun montant, donc le
       total du mois ne bouge pas. */
    Fixture.poser(troisMoisRepartis);
    const totaux = Store.state.budget.expenses.map(expenseRowTotal);
    neePlusDetailler();
    vrai(sansDistinction(), 'les catégories sont désactivées');
    const apres = Store.state.budget.expenses.map(expenseRowTotal);
    for (let i = 0; i < totaux.length; i++) {
      pres(apres[i], totaux[i], `le total du mois ${i + 1} n’a pas bougé`);
    }
  });

  test('la fenêtre du mois montre encore une case retirée qui porte un montant', () => {
    /* Sans cela, un mois deja reparti deviendrait incorrigible : le total
       resterait, ses parts seraient invisibles. */
    const src = lireSource('assets/app.js');
    vrai(/\.filter\(c => !categorieRetiree\(c\) \|\| num\(r\.v\?\.\[c\]\)\)/.test(src),
      'la saisie propose les catégories actives, plus celles qui portent déjà un montant');
  });

  test('remettre les catégories les fait réapparaître, sans rien redistribuer', () => {
    Fixture.poser(troisMoisRepartis);
    neePlusDetailler();
    const apresRegroupement = JSON.stringify(Store.state.budget.expenses);

    const fait = reprendreLeDetail();
    vrai(fait.categories > 0, 'les catégories retirées reviennent');
    vrai(!sansDistinction(), 'la saisie répartit de nouveau');

    /* Un mois saisi en une seule case le reste : aucun montant n'est reparti
       entre des categories par une regle inventee. Seuls les mois dont le
       decoupage etait garde ET dont le total n'a pas bouge le retrouvent. */
    const apres = Store.state.budget.expenses;
    for (const r of apres) {
      const cles = Object.keys(r.v || {}).filter(k => num(r.v[k]));
      vrai(cles.length !== 1 || !r.avantRegroupement,
        'une case unique conservée n’a pas été éclatée au hasard');
    }
    vrai(apresRegroupement.length > 0, 'l’état intermédiaire était bien lisible');
  });

  test('le choix survit au rechargement, et il n’a rien à migrer', () => {
    /* Il vit dans `budget.retirees`, qui est deja enregistre : aucune clef
       nouvelle, donc aucune migration, donc rien a jouer deux fois. */
    Fixture.poser(troisMoisRepartis);
    neePlusDetailler();
    const brut = JSON.stringify(Store.state);
    const relu = JSON.parse(brut);
    Store.state = relu;
    vrai(sansDistinction(), 'après un aller-retour par le stockage, le choix tient');
    eq(JSON.stringify(Store.state.budget.expenses),
       JSON.stringify(JSON.parse(brut).budget.expenses),
       'et aucune donnée historique ne s’est perdue en route');
  });

  test('le graphique global vit dans les deux états', () => {
    /* Il repose sur le total mensuel, jamais sur les categories : il n'a aucune
       raison de dependre du choix. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget(section'),
                          src.indexOf('function mountBudget('));
    const i = vue.indexOf('id="bChart"');
    vrai(i > 0, 'le graphique annuel doit exister');
    vrai(!/sansDistinction/.test(vue.slice(Math.max(0, i - 400), i)),
      'et ne pas être conditionné par le niveau de détail');
    const mont = src.slice(src.indexOf('function mountBudget('));
    vrai(/if \(\$\('#bCats'\)\) Charts\.rankedBars/.test(mont),
      'le montage des catégories, lui, vérifie que son conteneur existe');
  });
});

suite('Le mois en cours dit ce qui reste, pas ce qui est gagné', () => {

  test('la carte du mois annonce le reste, sans couleur de performance', () => {
    /* « Ecart ▼ -700 EUR » en vert, au 12 du mois : le mois n'est pas fini, et
       700 EUR ne sont pas gagnes, ils sont disponibles. La couleur d'alerte ne
       reste que sur la moitie qui alerte vraiment, le depassement. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget(section'),
                          src.indexOf('function mountBudget('));
    vrai(/const resteObjectif = f\.target - \(cur \? cur\.total : 0\)/.test(vue),
      'le reste se calcule sur l’objectif et le dépensé du mois');
    vrai(/trad\('Reste sur l’objectif'\)/.test(vue) && /trad\('Dépassement'\)/.test(vue),
      'le libellé change avec le signe');
    const i = vue.indexOf("trad('Reste sur l’objectif')");
    const bloc = vue.slice(i, i + 400);
    vrai(/resteObjectif >= 0 \? '' : classeDepassement/.test(bloc),
      'sous l’objectif, aucune classe : la couleur ne promet pas une performance');
    vrai(!/curDiff/.test(vue),
      'l’ancien écart du mois en cours n’a plus d’appelant');
    /* Budget consomme reste : c'est lui qui dit ou l'on en est du chemin, et il
       est juste en cours de mois. */
    vrai(/trad\('Budget consommé'\)/.test(vue), 'le pourcentage consommé est conservé');
  });

  test('un mois clos garde son écart final', () => {
    /* Les deux notions ne se melangent pas : le mois en cours dit un reste, un
       mois clos dit un ecart. Le tableau et le pied du graphique le portent. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewBudget(section'),
                          src.indexOf('function mountBudget('));
    eq((vue.match(/trad\('vs objectif'\)/g) || []).length, 2,
      'le pied du graphique et le tableau des mois gardent l’écart');
    vrai(/classeDepassement\(r\.total, f\.target\)/.test(vue),
      'et sa couleur, qui a un sens sur un mois terminé');
  });
});

suite('Un mois à venir n’est pas un mois à zéro euro', () => {

  test('l’année en cours s’arrête au mois courant', () => {
    auJour('2026-08-12', () => {
      Fixture.poser(s => {
        s.budget.expenses = [];
        for (let m = 1; m <= 12; m++) {
          s.budget.expenses.push({ month: `2026-${String(m).padStart(2, '0')}-01`,
            note: '', v: m <= 8 ? { Courses: 100 * m } : {} });
        }
      });
      eq(expenseSeries('2026').length, 12, 'la table porte bien les douze mois');
      const vus = expenseSeriesVisible('2026').map(r => r.month);
      eq(vus.length, 8, 'seuls janvier à août se montrent');
      eq(vus[vus.length - 1], '2026-08-01', 'et le dernier est le mois en cours');
    });
  });

  test('une année passée garde ses douze mois, un vide y étant un vrai zéro', () => {
    auJour('2026-08-12', () => {
      Fixture.poser(s => {
        s.budget.expenses = [];
        for (let m = 1; m <= 12; m++) {
          s.budget.expenses.push({ month: `2025-${String(m).padStart(2, '0')}-01`,
            note: '', v: m === 7 ? {} : { Courses: 200 } });
        }
      });
      eq(expenseSeriesVisible('2025').length, 12,
        'juillet 2025 sans dépense est une information, pas un mois à venir');
    });
  });

  test('une année à venir ne montre que ce qui est déjà saisi', () => {
    auJour('2026-08-12', () => {
      Fixture.poser(s => {
        s.budget.expenses = [
          { month: '2027-01-01', note: '', v: { Courses: 300 } },
          { month: '2027-02-01', note: '', v: {} },
        ];
      });
      const vus = expenseSeriesVisible('2027').map(r => r.month);
      eq(vus.join(','), '2027-01-01',
        'janvier préparé d’avance se montre, février vide non');
    });
  });

  test('le graphique et son tableau lisent la même série', () => {
    /* Deux appels paralleles, un dans la vue et un dans le montage, avaient deja
       diverge ailleurs sur cette base de code. */
    const src = lireSource('assets/app.js');
    eq((src.match(/expenseSeriesVisible\(year\)/g) || []).length, 2,
      'le graphique et le tableau replié, et personne d’autre');
    vrai(!/expenseSeries\(year\)/.test(src),
      'plus aucun appel direct qui rendrait les mois à venir');
  });

  test('les statistiques ignoraient déjà les mois vides', () => {
    /* Verification et non correction : `expenseYearStats` filtre sur
       `total > 0`, donc « 9 mois sous objectif sur 12 » ne peut pas se produire.
       Le mois en cours quitte en plus les comparaisons, sa moyenne plongeant le
       2 du mois pour remonter jusqu'au 31. */
    auJour('2026-08-12', () => {
      Fixture.poser(s => {
        s.budget.monthlyTarget = 1000;
        s.budget.expenses = [];
        for (let m = 1; m <= 12; m++) {
          s.budget.expenses.push({ month: `2026-${String(m).padStart(2, '0')}-01`,
            note: '', v: m <= 7 ? { Courses: 800 } : {} });
        }
      });
      const st = expenseYearStats('2026');
      eq(st.months, 7, 'sept mois portent une saisie');
      eq(st.under + st.over, 7, 'et les comparaisons ne portent que sur eux');
      eq(st.under, 7, 'les sept sont sous l’objectif');
      pres(st.average, 800, 'la moyenne ne se dilue pas dans cinq zéros');
    });
  });
});

suite('Un dépliant ouvert est un dépliant fermé', () => {

  test('chaque vue équilibre ses balises <details>', () => {
    /* Le navigateur repare en silence un `<details>` jamais ferme : il ferme la
       balise au parent, donc le pli avale ce qui suit ou s'arrete trop tot. Rien
       ne leve d'erreur, le JavaScript reste valide -- une balise HTML dans un
       litteral de gabarit n'est qu'une chaine -- et la suite passe au vert.

       C'est arrive au portage du niveau de detail de Budget : la balise de
       fermeture etait le seul hunk rejete du lot, et dix-sept tests de Budget
       sont restes verts au-dessus d'une carte dont la moitie vivait dans un pli
       qu'on n'avait pas demande.

       Les commentaires sont retires avant de compter : ils citent des balises. */
    const src = lireSource('assets/app.js');
    const propre = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const bornes = [...propre.matchAll(/\nfunction (view[A-Za-z]\w*|[a-z]\w*Card)\(/g)]
      .map(m => ({ nom: m[1], i: m.index }));
    vrai(bornes.length > 10, `les vues doivent être trouvables (${bornes.length} vues)`);
    bornes.push({ nom: '(fin)', i: propre.length });

    const boiteux = [];
    for (let k = 0; k < bornes.length - 1; k++) {
      const bloc = propre.slice(bornes[k].i, bornes[k + 1].i);
      const o = (bloc.match(/<details\b/g) || []).length;
      const f = (bloc.match(/<\/details>/g) || []).length;
      if (o !== f) boiteux.push(`${bornes[k].nom} : ${o} ouverte(s), ${f} fermée(s)`);
    }
    eq(boiteux.join(' | '), '',
      'un dépliant non fermé avale le reste de sa carte, sans qu’aucune erreur ne le dise');
  });
});

finDePartieDeTests('tests/14-boutons-fiche-ont-geometrie.tests.js');
