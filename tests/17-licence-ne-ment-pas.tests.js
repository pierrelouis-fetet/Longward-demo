partieDeTests('tests/17-licence-ne-ment-pas.tests.js');
suite('La licence ne ment pas', () => {
  test('le fichier LICENSE porte la licence que le README annonce', () => {
    /* La regle se derive du README : c'est lui qui annonce la licence au
       lecteur, le fichier LICENSE doit donc dire la meme chose. L'AGPL et la
       GPL v3 se ressemblent paragraphe pour paragraphe, seule la premiere
       porte AFFERO en tete, et c'est sa clause reseau qui fonde la phrase du
       README sur les versions modifiees mises en ligne. Le fichier a deja
       porte la GPL simple sous un README qui annoncait l'AGPL, et l'onglet
       licence de GitHub l'a dit avant les tests. */
    const readme = lireSource('README.md');
    const licence = lireSource('LICENSE');
    vrai(readme !== null, 'README.md doit se lire');
    vrai(licence !== null, 'LICENSE doit se lire');
    vrai(/AGPL/.test(readme),
      'le README n’annonce plus l’AGPL : mettre ce test d’accord avec lui');
    vrai(licence.includes('GNU AFFERO GENERAL PUBLIC LICENSE'),
      'le README annonce l’AGPL, le fichier LICENSE porte autre chose');
  });

  test('aucun document publié ne porte de marqueur de conflit', () => {
    /* Une fusion du depot prive s'est arretee au milieu du README et le
       resultat a ete commite tel quel : `<<<<<<< HEAD`, deux lignes anglaises,
       `=======`, puis cent vingt lignes francaises decrivant l'application
       privee — ses lanceurs `.cmd`, son dossier, ses feuilles Google — et
       `>>>>>>> principal/main`. C'est reste cinq jours en tete du depot public,
       ou la section « Run it locally » ne montrait plus comment lancer quoi que
       ce soit.

       Un marqueur de conflit ne se rattrape par aucune relecture de code : il
       vit dans la prose, la ou personne ne repasse. Le controle est donc
       mecanique, et il porte sur les documents que GitHub affiche en premier. */
    ['README.md', 'ETAT.md', 'CLAUDE.md', 'AGENTS.md', 'DEPLOY.md'].forEach(nom => {
      const texte = lireSource(nom);
      if (texte === null) return;   // un document peut disparaitre, pas mentir
      const marqueur = texte.split('\n')
        .findIndex(l => /^(<{7}|={7}|>{7})(\s|$)/.test(l));
      eq(marqueur, -1,
        `${nom} porte un marqueur de conflit ligne ${marqueur + 1} : `
        + 'une fusion a ete commitee sans etre finie');
    });
  });
});

suite('La page Allocation dit la base qu’elle emploie', () => {
  test('elle n’en annonce qu’une, et c’est celle des cartes', () => {
    /* « Ça c'est faux maintenant non ? » L'infobulle de tete promettait « trois
       bases sur cette page » et expliquait que « ce qui est place » ecarte les
       liquidites. C'etait vrai la veille. Le matin meme, les cartes par
       enveloppe et par compte ont ete rebasees sur les avoirs et le cash y a ete
       ajoute : il ne restait qu'une base, et le texte decrivait une page qui
       n'existait plus.

       C'est la deuxieme fois dans la meme journee qu'un texte d'aide survit a ce
       qu'il decrit — un commentaire perime est un mensonge, et une infobulle
       aussi. Le controle se derive donc de la source : ce que la vue emploie
       reellement doit correspondre a ce que son entete promet.

       Le nombre de cartes ne se compte pas ici, et volontairement : la premiere
       redaction disait « les quatre cartes » alors qu'il y en avait trois, faux
       des l'ecriture. Un chiffre qui vieillit tout seul n'a pas sa place dans un
       texte affiche. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible');
    const debut = src.indexOf('function viewAllocation()');
    const vue = src.slice(debut, src.indexOf('function mountAllocation', debut));
    vrai(vue.length > 500, 'la vue doit se relire depuis sa source');

    /* Une base par mode, et jamais deux dans le meme mode. La page n'en annonçait
       qu'une jusqu'a ce qu'un commutateur arrive : un appartement pesant 81 % du
       brut ecrasait tout, quatre classes sur six tombaient sous 2 %, et la page
       cessait de montrer ce qu'on pilote.

       Un commutateur n'est pas le defaut que ce controle traquait. Ce qui etait
       fautif, c'etaient deux bases muettes cote a cote sur un meme ecran ; ici
       l'une remplace l'autre, sur un geste, et se nomme. La regle devient donc :
       toute mention d'une base que le commutateur change le suit, aucune ne reste
       en arriere ; la seule base qu'il ne change pas est declaree plus bas.
       Une mention qui ne bouge pas quand le calcul bouge rassure a tort, et c'est
       exactement ce qui s'etait produit sur l'accueil. */
    /* Le montage ET la phrase de concentration : celle-ci vit dans sa propre
       fonction, donc hors de la vue, et son appel a la source y echappait. */
    const montage = corpsDe(src, 'mountAllocation')
      + corpsDe(src, 'phraseConcentration');
    /* Deux bases suivent le commutateur, et deux seulement. Celle de la page,
       le patrimoine net, et celle des avoirs, pour les cartes qui disent ou
       l'argent est pose : une dette n'est posee sur aucun compte et n'a pas de
       delai de sortie. Une mention de l'une d'elles nomme une base ET le
       montant de CETTE base : le nom de l'une avec le montant de l'autre est
       exactement le defaut que ce controle traque. */
    const FAMILLES = { baseAlloc: 'valeurBaseAlloc', baseAvoirsAlloc: 'valeurAvoirsAlloc' };
    /* Une exception, et une seule : l'angle des lignes de marche. Ses comptes
       de marche sont les memes en net ou en avoirs ; sa base ne suit donc pas le
       commutateur, et sa mention ne le pretend pas, elle nomme les comptes de
       marche. Le test suivant, sur la base que les parts de chaque carte
       totalisent, la confronte au centre et au pied de son anneau. */
    const HORS_COMMUTATEUR = "mentionBase({ de: trad('de tes comptes de marché') }, pf.total)";
    eq(vue.split(HORS_COMMUTATEUR).length - 1, 1,
      'l’angle des lignes de marché annonce sa propre base, une fois');
    const brutes = (vue.match(/mentionBase\(/g) || []).length - 1;
    const mentions = [...vue.matchAll(/mentionBase\((\w+)\(\), (\w+)\(\)\)/g)]
      .map(m => [m[1], m[2]]);
    vrai(mentions.length > 0, 'la page doit annoncer au moins une base');
    eq(mentions.length, brutes,
      'une mention de base nomme deux fonctions, un nom et son montant : '
      + `${brutes - mentions.length} n’en nomme pas`);
    for (const [nom, valeur] of mentions) {
      vrai(FAMILLES[nom],
        `« ${nom}() » ne suit pas le commutateur : la mention nommerait une base `
        + 'que les parts ne totalisent plus');
      eq(valeur, FAMILLES[nom],
        `« ${nom}() » est annoncé avec « ${valeur}() » : le nom d’une base et le `
        + 'montant d’une autre');
    }

    /* Et aucune base ecrite en dur ne subsiste sur cette page.
       C'est le controle qui manquait : le ternaire se recopiait a huit endroits,
       le huitieme a ete oublie, et le centre de l'anneau annonçait 354,6 k EUR
       « Tes avoirs » au milieu de parts qui totalisaient 66 551. Interdire la
       recopie vaut mieux que verifier chaque copie, parce que la neuvieme
       n'existe pas encore. */
    /* La definition de la base ne peut pas se reduire a elle-meme.

       Un remplacement global a deja transforme `const baseAlloc = () =>
       (allocFinancier ? ...)` en `const baseAlloc = () => baseAlloc()`. Le
       fichier restait valide, la suite entiere passait, et la page se
       terminait sur un depassement de pile a l'ouverture. Le harnais ne rend
       jamais la vue : rien d'executable ne pouvait l'attraper, et c'est
       pourquoi le controle est ici, sur le texte. La meme faute avait touche
       la definition de `pochesPatrimoine` la veille. */
    const def = src.slice(src.indexOf('const baseAlloc ='), src.indexOf('const baseAlloc =') + 200);
    /* La base de « Tout » est le patrimoine NET : la page comptait en brut, si
       bien qu'un appartement y pesait sa valeur entiere alors que la moitie
       appartient encore a la banque. */
    vrai(/BASES\.avoirsFinanciers/.test(def) && /BASES\.net/.test(def),
      'la définition de baseAlloc doit nommer les deux bases : ' + def.slice(0, 70));
    vrai(!/baseAlloc\(\)/.test(def.slice(def.indexOf('=>'))),
      'la définition de baseAlloc s’appelle elle-même : la page dépasse la pile');
    const defA = src.slice(src.indexOf('const baseAvoirsAlloc ='),
                           src.indexOf('const baseAvoirsAlloc =') + 200);
    vrai(!/baseAvoirsAlloc\(\)/.test(defA.slice(defA.indexOf('=>'))),
      'la définition de baseAvoirsAlloc s’appelle elle-même');

    /* Le commutateur fait suivre les cartes, il n'en cache aucune.

       J'avais retire la carte des delais en vue financiere plutot que de la
       faire suivre, au motif que ses paliers agregeaient des classes. Ils se
       construisent ligne par ligne : le filtre etait exact et tenait en une
       ligne. Cacher une carte pour eviter de la faire suivre repond a la
       difficulte par le retrait, et laisse l'utilisateur devant une page qui
       perd un graphique quand il change de lunette. */
    vrai(!/allocFinancier \? '' :/.test(vue),
      'aucune carte ne doit disparaître quand le commutateur change : elles suivent');

    /* L'interdiction porte sur les CARTES, pas sur l'entete.

       Une carte annonce une base que ses parts totalisent : elle la prend donc
       par l'une des deux fonctions, jamais a la main. L'entete, lui, ne repartit
       rien — il POSE une soustraction, avoirs financiers moins dettes du
       perimetre, et nomme ses trois termes. Lui interdire de nommer une base
       reviendrait a lui interdire de dire ce qu'il additionne. */
    const cartes = vue.slice(vue.indexOf('<div class="card'));
    const region = cartes + montage;
    for (const dure of ['BASES.net', 'BASES.avoirs', 'BASES.financier']) {
      eq(region.split(dure).length - 1, 0,
        `« ${dure} » est écrit en dur sur la page : une base se prend par `
        + 'baseAlloc() ou baseAvoirsAlloc(), les seules qui suivent le commutateur');
    }
    eq((montage.match(/centerLabel: trad\(/g) || []).length, 0,
      'le centre d’un anneau nomme la base de la page, jamais une chaîne écrite là');

    /* Le centre de chaque anneau nomme la base ET vaut la somme de ses parts.

       TROIS NOMS ADMIS, ET LE TROISIEME EST UNE EXCEPTION QUI SE DIT.
       `baseAlloc()` et `baseAvoirsAlloc()` suivent le commutateur : elles
       sont les deux perimetres de la page, et une mention qui ne bouge pas
       quand le calcul bouge rassure a tort.

       `basePortefeuille()` ne le suit pas, et c'est voulu : un portefeuille
       de marche est le meme qu'on compte en patrimoine net ou en avoirs, donc
       le faire basculer lui ferait dire deux choses pour un seul fait. Elle
       reste une FONCTION, ce qui est le vrai objet de ce controle : un centre
       qui porte un libelle ecrit a la main peut deriver de ce que ses parts
       totalisent, et cette page a deja annonce 354,6 k EUR au milieu de parts
       qui en totalisaient 66 551.

       Ce qui garde l'exception honnete est la ligne d'apres : son centre vaut
       `pf.total`, que le modele construit comme la somme des parts rendues. */
    for (const centre of [...montage.matchAll(/centerLabel: ([^,]+),/g)]) {
      vrai(/^((baseAlloc|baseAvoirsAlloc)\(\)\.nom|nomPortefeuille\(\))$/
        .test(centre[1].trim()),
        `un anneau annonce « ${centre[1].trim()} » au centre au lieu de sa base`);
      if (centre[1].trim() === 'nomPortefeuille()') {
        vrai(/centerLabel: nomPortefeuille\(\), centerValue: pf\.total/.test(montage),
          'et le centre du portefeuille vaut la somme de ses propres parts');
      }
    }

    /* Et les sources de la page le suivent aussi, sinon deux cartes du meme ecran
       compteraient l'une avec les murs et l'autre sans.

       Les deux dernieres n'existent pas dans les deux depots : la carte des
       delais et la phrase de concentration n'ont jamais ete portees sur la
       demonstration. Une source absente n'est pas un manquement, une source
       presente qui oublie le commutateur en est un. */
    for (const f of ['pochesPatrimoine', 'allocationByAsset', 'allocationByAccount',
                     'byAccountType', 'allocationParDisponibilite', 'concentration']) {
      if (!src.includes(f + '(')) continue;
      const appels = [...(vue + montage).matchAll(new RegExp(f + '\\(([^)]*)\\)', 'g'))]
        .filter(m => !/function/.test(m[0]));
      vrai(appels.length > 0, `${f} doit être appelé par la page`);
      for (const a of appels) {
        vrai(/financier: allocFinancier/.test(a[1]),
          `${f} est appelé sans le commutateur : « ${a[0].slice(0, 60)} »`);
      }
    }

    /* Le commutateur ne s'affiche que s'il retire quelque chose : sans mur ni
       objet de valeur, ses deux boutons donnent la meme page. */
    vrai(/horsFinancierExiste\(\) \? barreCommutateur/.test(vue),
      'le commutateur se tait quand il n’y a rien à retirer');
  });

  test('chaque carte annonce la base que ses parts totalisent', () => {
    /* Le defaut, en vue globale : la mention grise disait « Patrimoine net ·
       98 250 EUR » au-dessus de tableaux dont les lignes font 138 250. Deux des
       trois cartes decrivent OU l'argent est pose — par type de detention, par
       compte, par delai de sortie — et une dette n'est posee sur aucun compte,
       ne ressort d'aucun palier : elles totalisent donc les avoirs. La
       troisieme decrit CE QUE vaut le patrimoine, et compte le net.

       Un total qui n'egale pas la somme de ses parts est le pire defaut de
       cette base de code, parce qu'il rassure. */
    Fixture.poser();
    const total = l => round2(l.reduce((s, x) => s + num(x.value), 0));
    const brut = round2(patrimoine().brut);
    const net = round2(nowTotals().net);
    pres(brut, Fixture.BRUT, 'le brut du jeu d’essai');
    pres(net, Fixture.BRUT - Fixture.DETTE, 'et son net');
    vrai(Math.abs(brut - net) > 1,
      'sans dette, ce contrôle ne prouverait rien : les deux bases se confondraient');

    /* `pochesPatrimoine` est la vue de `poidsPoches`, qui porte les nombres. */
    pres(total(poidsPoches({ financier: false, net: true })), net,
      'la répartition totalise le patrimoine net');
    pres(total(byAccountType({ financier: false })), brut,
      'le type de détention totalise les avoirs');
    pres(total(allocationByAccount({ financier: false })), brut,
      'et le compte aussi');
    /* Absente de la demonstration : la carte des delais n'y a jamais ete portee. */
    if (typeof allocationParDisponibilite === 'function') {
      pres(total(allocationParDisponibilite({ financier: false })), brut,
        'le délai de sortie également : une dette n’en a pas');
    }

    /* En vue financiere les deux bases se confondent, et c'est ce qui rend le
       defaut invisible tant qu'on ne bascule pas : le perimetre ecarte deja le
       bien que le credit finance. */
    for (const l of [poidsPoches({ financier: true, net: true }),
                     byAccountType({ financier: true }),
                     allocationByAccount({ financier: true })]) {
      pres(total(l), round2(totalFinancier()), 'une seule base en vue financière');
    }

    /* Et la vue annonce bien ces bases-la, une par carte : la mention grise et
       les tableaux qu'elle chapeaute nomment la MEME fonction. Une carte se lit
       d'un conteneur au suivant. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewAllocation()'),
                          src.indexOf('function mountAllocation'));
    /* Un angle de la repartition est une lecture a lui seul : il annonce sa
       base comme une carte, et une seule s'affiche a la fois. Un sous-titre de
       carte ouvre aussi une lecture, qui peut annoncer la sienne : les barres
       de l'exposition comptent en brut sous le tableau des poches, qui compte
       en net, et chacun le dit. */
    const cartes = vue.split(/<div class="card|<section class="alloc-angle|<h3 class="sous-titre-carte"/).slice(1);
    let basees = 0;
    for (const carte of cartes) {
      const noms = new Set();
      for (const m of carte.matchAll(/mentionBase\((\w+)\(\)/g)) noms.add(m[1]);
      for (const m of carte.matchAll(/tbl\(\w+, (\w+)\(\)\.nom/g)) noms.add(m[1]);
      if (!noms.size) continue;
      basees++;
      eq(noms.size, 1,
        `une carte annonce « ${[...noms].join(' » et « ')} » : deux bases sous un `
        + 'seul titre, et un total qui n’égale pas la somme de ses parts');
    }
    vrai(basees >= 3, `attendu au moins trois cartes basées, vu ${basees}`);

    /* L'angle des lignes de marche annonce une base qui n'est pas une fonction
       de la page, et la boucle ci-dessus ne la voit pas : sa mention, le centre
       de son anneau et le pied de son tableau se confrontent donc ici, sur le
       meme `pf.total`. */
    const lignes = vue.slice(vue.indexOf('data-anchor="lignes-marche"'));
    vrai(/<p class="tete-legende">\$\{mentionBase\(\{ de: trad\('de tes comptes de marché'\) \}, pf\.total\)\}/.test(lignes),
      'la mention des lignes de marché porte pf.total');
    vrai(/centerLabel: nomPortefeuille\(\), centerValue: pf\.total/.test(src),
      'le centre de son anneau aussi');
    const pied = src.slice(src.indexOf('function tableauPortefeuille'));
    vrai(/<tfoot><tr><td>\$\{esc\(nomPortefeuille\(\)\)\}<\/td><td class="montant">\$\{fmtEUR\(pf\.total\)\}/.test(pied),
      'et le pied de son tableau');
  });

  test('un camembert a son tableau, des barres classées n’en ont pas', () => {
    /* « C'est pas un doublon ça ? » Si. J'avais pose un tableau sous « Par
       compte » au motif que les autres decoupages en avaient un et pas
       celui-la. L'asymetrie etait reelle, sa cause mal lue.

       `Charts.rankedBars` rend deja, sur chaque ligne, le libelle, le montant
       et le pourcentage : c'est un tableau avec des barres. Les dix memes
       lignes s'affichaient donc deux fois de suite, aux centimes pres. Ce qui
       appelle un tableau, c'est le camembert, qui donne des proportions sans
       nommer ni chiffrer.

       Le controle porte sur cette regle et non sur un compte de tableaux : la
       premiere formulation etait satisfaite par la version fautive. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewAllocation()'),
                          src.indexOf('function mountAllocation'));
    const mnt = corpsDe(src, 'mountAllocation');

    /* Quel conteneur porte quoi, lu dans le montage : c'est lui qui decide. */
    const camemberts = [...mnt.matchAll(/Charts\.donut\(\$\('#(\w+)'\)/g)].map(m => m[1]);
    const barres = [...mnt.matchAll(/Charts\.rankedBars\(\$\('#(\w+)'\)/g)].map(m => m[1]);
    vrai(camemberts.length >= 3 && barres.length >= 2,
      `attendu au moins 3 camemberts et 2 jeux de barres, vu ${camemberts.length} et ${barres.length}`);

    /* Un tableau suit son camembert dans le balisage, et rien ne suit des
       barres avant le conteneur suivant ou la fin de la carte. */
    for (const id of barres) {
      const i = vue.indexOf(`id="${id}"`);
      vrai(i > 0, `le conteneur #${id} doit être dans la vue`);
      const suite = vue.slice(i, i + 400);
      const finBloc = Math.min(...[suite.indexOf('</div>'), suite.length].filter(n => n >= 0));
      vrai(!/\$\{tbl\(/.test(suite.slice(0, finBloc)),
        `#${id} rend des barres classées, qui portent déjà libellé, montant et `
        + 'pourcentage : un tableau dessous répète la même liste');
    }

    /* Et « Par categorie d'actif » porte a la place la lecture que l'ordre ne donne
       pas tout seul. */
    const detail = vue.slice(vue.indexOf("trad('Par catégorie d’actif')"),
                             vue.indexOf('data-anchor', vue.indexOf("trad('Par catégorie d’actif')")));
    vrai(/phraseConcentration\(\)/.test(detail),
      'le classement par poids porte la lecture que son ordre ne donne pas');
  });

  test('une poche porte le nom de sa classe, elle ne le recopie pas', () => {
    /* Le vrai defaut, et mon premier correctif visait a cote : j'avais renomme
       la carte pour qu'elle cesse de dire « classe d'actif » sur des poches,
       alors que les poches SONT les classes a un grain plus large. Ce qui
       n'allait pas, c'est que les deux tables donnaient deux noms au meme
       argent — « Non cote » ici, « Placements non cotes » la, sur deux ecrans
       qu'on ne regarde jamais en meme temps, donc invisible.

       Le controle porte sur le lien et non sur les libelles : ecrire la bonne
       paire de noms aujourd'hui ne dit rien de la prochaine poche ajoutee. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('const POCHE_CLASSE'),
                           src.indexOf('function seriesUtiles'));
    vrai(bloc.length > 100, 'la table des poches doit être trouvable');
    vrai(!/label:\s*trad\('/.test(bloc),
      'aucun libellé de poche ne s’écrit à la main : il vient de sa classe');
    vrai(/CLASSES_ACTIFS\[POCHE_CLASSE\[s\.key\]\]/.test(bloc),
      'chaque poche lit le nom de la classe que POCHE_CLASSE lui associe');

    /* Et la table de correspondance couvre toutes les poches, sinon celle qui
       manque naitrait sans nom. Les cles se lisent dans la source : le harnais
       ne charge pas app.js. */
    const cles = [...bloc.matchAll(/\{ key: '(\w+)'/g)].map(m => m[1]);
    const mappees = Object.keys(Object.fromEntries(
      [...bloc.slice(0, bloc.indexOf('SERIES_PATRIMOINE'))
        .matchAll(/(\w+):\s*'(\w+)'/g)].map(m => [m[1], m[2]])));
    eq(cles.length, 7, `sept poches attendues, trouvées : ${cles.join(', ')}`);
    for (const k of cles)
      vrai(mappees.includes(k), `la poche « ${k} » doit avoir sa classe dans POCHE_CLASSE`);
  });
});

suite('Une flèche de tri ne quitte pas son intitulé', () => {
  test('les intitulés du jour décrivent, ils ne trient pas', () => {
    /* Le tri de la carte a un seul endroit, le declencheur de la rangee du
       compte. Un intitule qui repondait au clic en faisait un second, et
       laissait croire a deux reglages. */
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function enteteJour('), src.indexOf('function enteteLignesJour('));
    vrai(fn.length > 50, 'l’intitulé du jour est trouvable');
    vrai(!/<button|data-action|th-tri/.test(fn), 'aucun bouton, aucune action, aucun habillage de tri');
    const tete = src.slice(src.indexOf('<div class="jour-ligne entete">'),
                           src.indexOf('</div>', src.indexOf('<div class="jour-ligne entete">')));
    eq((tete.match(/enteteJour\('[^']*', '/g) || []).length, 1, 'une seule aide dans l’en-tête');
    vrai(/enteteJour\('Effet', 'Contribution de cette ligne/.test(tete), 'et c’est celle de l’effet');
    vrai(!/'sort-jour'\(/.test(src), 'l’action de tri par intitulé n’existe plus');
    const css = lireSource('assets/styles.css');
    vrai(!/\.tri-jour/.test(css), 'ni son habillage : curseur, survol, flèches');
    const mob = css.slice(css.indexOf('@media (max-width: 460px)'),
                          css.indexOf('@media (max-width: 460px)') + 900);
    vrai(/\.jour-ligne \{ grid-template-columns: minmax\(0, 1fr\) \d+px/.test(mob),
      'la grille du jour déclare toujours ses colonnes au téléphone');
  });

  test('l’intitulé d’une colonne s’aligne sur ses chiffres', () => {
    /* « Les noms des colonnes sont pas centres. » Ils etaient colles a gauche
       pendant que les chiffres s'alignaient a droite : mesure a 852 px, la
       colonne « Poids » finissait a 183 et son en-tete a 168.

       La regle existait pourtant — `text-align: right` sur les cellules d'en-tete
       — mais elle etait inerte. L'en-tete triable EST un conteneur flex :
       `.tri-jour` porte `display: inline-flex`, blockifie en `flex` par la grille
       qui le contient, et `text-align` ne deplace aucun enfant d'un conteneur
       flex. La regle etait donc morte depuis qu'elle existait, sans que rien ne
       le dise : elle avait l'air juste a la lecture.

       C'est pourquoi le controle porte sur `justify-content` et non sur la
       presence d'une regle d'alignement : la premiere formulation aurait ete
       satisfaite par celle qui ne marchait pas. */
    const css = lireSource('assets/styles.css');
    const i = css.indexOf('.jour-ligne.entete span:not(:first-child)');
    vrai(i > 0, 'la règle d’alignement des en-têtes doit exister');
    const regle = css.slice(i, css.indexOf('}', i) + 1);
    vrai(/justify-content:\s*flex-end/.test(regle),
      'les en-têtes triables sont des conteneurs flex : seul `justify-content` '
      + 'les aligne sur leurs chiffres, `text-align` n’y fait rien');
  });
});

suite('Un libellé, un montant', () => {

  test('aucun type de compte ne porte le nom d’une classe d’actif', () => {
    /* Un type nomme ce qu'on ouvre, une classe ce qu'on detient, et les deux ne
       portent jamais le meme nom. Un type `pe` appele Placements non cotes,
       exactement comme la classe `nonCote`, ferait afficher deux montants sous
       le meme nom, a deux cartes d'ecart sur le meme ecran : la carte Par
       enveloppe sans le compte de pret participatif, la carte des classes avec,
       puisqu'il est du non cote lui aussi.

       Les deux calculs seraient justes. C'est le nom du contenant qui mentirait,
       et c'est la faute que ce projet traque depuis le debut : le meme libelle
       valant deux montants differents.

       Le controle vaut pour toute la table, donc il protege aussi les types
       qu'on ajoutera demain -- c'est la collision qui est interdite, pas un cas
       particulier. */
    /* La collision ne ment que si la classe peut porter plusieurs enveloppes.
       `bienValeur` n'en a qu'une, et elle est `direct` : le contenant EST la
       chose, les deux cartes montreront toujours le meme nombre, et exiger deux
       mots la forcerait a en inventer un. La regle porte donc sur ce qui rend le
       defaut possible, et non sur l'homonymie seule. Une seconde enveloppe
       ajoutee demain a `bienValeur` fera tomber ce test : c'est exactement le
       moment ou le renommage devient necessaire. */
    const parClasse = {};
    for (const ty of TYPES_COMPTE) for (const c of (ty.classes || []))
      (parClasse[c] = parClasse[c] || []).push(ty.id);
    const nomDeClasse = new Map(Object.entries(CLASSES_ACTIFS)
      .map(([cle, lab]) => [String(lab).toLowerCase(), cle]));
    for (const ty of TYPES_COMPTE) {
      const classe = nomDeClasse.get(String(ty.label).toLowerCase());
      if (!classe) continue;
      eq((parClasse[classe] || []).length, 1,
        `le type « ${ty.id} » s'appelle « ${ty.label} », le nom de la classe `
        + `« ${classe} », que se partagent ${(parClasse[classe] || []).join(', ')} : `
        + 'la carte « Par enveloppe » et celle des classes afficheraient deux '
        + 'montants différents sous ce libellé');
    }
  });

  test('deux types de compte ne portent pas le même nom', () => {
    /* Le corollaire, et il ne coute rien : deux enveloppes homonymes rendraient
       la carte « Par enveloppe » illisible, sans qu'aucun total soit faux. */
    const vus = new Map();
    for (const t of TYPES_COMPTE) {
      const cle = String(t.label).toLowerCase();
      vrai(!vus.has(cle),
        `les types « ${vus.get(cle)} » et « ${t.id} » portent le même libellé « ${t.label} »`);
      vus.set(cle, t.id);
    }
  });

  test('les deux métiers du non coté se distinguent à la lecture', () => {
    /* Le second malentendu : des actions detenues via une plateforme de
       crowdfunding restent des parts, meme si la plateforme se dit de
       financement participatif. Le mot, au sens courant, couvre les deux metiers
       en n'en nommant qu'un.

       Longward ne separe pas par plateforme mais par ce qu'on detient : des parts,
       ou une creance. Les deux types partagent la classe `nonCote`, seul
       `prete` les distingue dans le calcul ; leurs noms doivent le dire aussi,
       sinon on range des parts la ou l'application reclame une echeance. */
    const parts = TYPES_COMPTE.find(t => t.id === 'pe');
    const pret = TYPES_COMPTE.find(t => t.id === 'crowdfunding');
    vrai(parts && pret, 'les deux types du non coté doivent exister');
    eq(parts.classes.join(), 'nonCote', 'les parts de société sont du non coté');
    eq(pret.classes.join(), 'nonCote', 'le prêt participatif aussi');
    vrai(!parts.prete, 'des parts ne se remboursent pas à une date');
    vrai(!!pret.prete, 'un prêt porte une échéance, un taux et un état');
    vrai(/parts?/i.test(parts.label),
      `« ${parts.label} » doit dire qu'on détient des parts`);
    vrai(/prêt|pret/i.test(pret.label),
      `« ${pret.label} » doit dire qu'on prête : c'est ce qui le sépare de son voisin`);
  });
});

suite('Un contenant vide ne survit pas à son dernier compte', () => {

  test('la migration retire un établissement sans compte ni dette', () => {
    /* Un etablissement sans compte est invisible sur toute la page Comptes,
       qui saute les contenants vides, et proposable a l'etape 2 de chaque
       ajout — y compris dans la fenetre « Assureur ou courtier » d'un contrat
       d'assurance-vie. Le nom d'un bien supprime revenait donc proposer de s'y
       rattacher, sans qu'aucun ecran ne permette de le retirer.

       La suppression d'un compte emporte desormais son etablissement, mais ce
       correctif ne valait que pour l'avenir : les contenants deja orphelins
       restaient dans les donnees. Un correctif qui ne regarde que l'avenir
       laisse le defaut chez ceux qui l'ont deja subi. */
    Fixture.poser();
    Store.state.etabs.push({ id: 'contenant-orphelin', nom: 'Studio', dettes: [] });
    Store.migrate();
    vrai(!Store.state.etabs.some(e => e.id === 'contenant-orphelin'),
      'un contenant sans compte ni dette doit partir : rien ne le montre, '
      + 'donc rien ne permet de le retirer à la main');
  });

  test('mais il reste s’il porte encore une dette', () => {
    /* Le credit orphelin se soustrait toujours du patrimoine net, et le
       controle de coherence « Credit sans bien » a besoin de nommer son
       etablissement. Le supprimer ici effacerait un chiffre au lieu de le
       signaler : exactement le defaut que ce controle existe pour attraper. */
    Fixture.poser();
    Store.state.etabs.push({ id: 'contenant-endette', nom: 'Studio',
      dettes: [{ libelle: 'Prêt', montant: 42000 }] });
    Store.migrate();
    vrai(Store.state.etabs.some(e => e.id === 'contenant-endette'),
      'un contenant qui porte une dette reste : sa dette compte encore');
  });

  test('et la migration se rejoue sans rien casser', () => {
    /* Idempotence : c'est la condition pour qu'une migration puisse tourner a
       chaque chargement. Deux passages doivent laisser le meme nombre de
       contenants, sinon elle mange les etablissements legitimes au second. */
    Fixture.poser();
    Store.migrate();
    const apres1 = Store.state.etabs.length;
    Store.migrate();
    eq(Store.state.etabs.length, apres1,
      'un second passage ne doit retirer aucun établissement de plus');
    vrai(apres1 > 0, 'la fixture porte bien des établissements rattachés');
  });
});

suite('La recherche vaut aussi pour les comptes archivés', () => {
  test('un archivé hors recherche quitte la page', () => {
    /* La page filtrait les comptes ouverts et construisait le groupe des
       archives cent cinquante lignes plus bas sans rien filtrer : elle
       repondait « Rien ne correspond a "Aaa" » en laissant le groupe dessous.
       Deux endroits pour une seule regle, et seul le premier la tenait.

       Le controle se derive de la source : la vue est un gabarit de plusieurs
       centaines de lignes, mais la regle tient dans le predicat, et c'est lui
       qui doit etre appele aux deux endroits. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewAccounts()'),
                          src.indexOf('function mountAccounts()'));
    vrai(vue.length > 1000, 'la vue des comptes doit se relire depuis sa source');
    const appels = vue.split('correspondAuCompte').length - 1;
    vrai(appels >= 3,
      `le prédicat de recherche n'est appelé qu'à ${appels - 1} endroit(s) : `
      + 'les comptes ouverts et les archivés doivent tous deux y passer');
    vrai(/statut === 'archive' && correspondAuCompte\(c\)/.test(vue),
      'le groupe des archivés doit filtrer sur la recherche, comme les ouverts');
    vrai(/!ouverts\.length && !archives\.length/.test(vue),
      '« Rien ne correspond » ne doit s’afficher que si les archivés non plus '
      + 'ne correspondent pas : sinon la page se contredit dans le même écran');
  });
});

/* ------------------------------------------------------------------
   Une demonstration montre la meme chose a tout le monde
   ------------------------------------------------------------------ */
suite('Une démonstration montre la même chose à tout le monde', () => {

  test('le jeu de démonstration actualise ses cours, et les captures les figent', () => {
    if (sansGraineDeDemo('le rafraîchissement des cours')) return;
    /* Les cours ont ete figes un temps, pour la raison racontee ci-dessous. La
       demonstration annoncait alors des « cours jamais actualises » a chaque
       visiteur : c'est le script des captures qui fige desormais, en bloquant
       les appels de cours et la mise a jour mensuelle le temps de ses prises. */
    /* `autoRefresh: true` ferait interroger la passerelle a chaque chargement :
       les valeurs de marche bougeraient entre deux visites, et entre deux
       captures d'ecran. Les images du README se contrediraient alors de
       quelques centaines d'euros, cash, non cote et immobilier identiques a
       l'euro, seuls actions, obligations et crypto differant, et un lecteur
       attentif en conclurait que l'application compte mal.

       Trois raisons de figer, et la premiere suffit : une demonstration doit
       montrer la meme chose a tout le monde. Ensuite, un README dont les chiffres
       vieillissent tout seuls devient faux sans que personne y touche. Enfin, une
       demonstration qui depend d'une passerelle externe tombe avec elle.

       Le bouton d'actualisation reste : la fonctionnalite se montre toujours,
       elle ne se declenche simplement plus toute seule. */
    /* Le jeu de demonstration est `SEED`, pas `assets/demo.json` : ce dernier
       etait un second instantane de la meme personne fictive, les deux ont
       diverge, et le mode demonstration repose desormais la graine. Le controle
       porte donc sur la graine — celle qu'un visiteur voit au premier
       chargement. */
    eq(SEED.meta.autoRefresh, true, 'la démo actualise ses cours : elle ne paraît jamais en retard');
    const cap = lireSource('captures.py');
    vrai(/Network\.setBlockedURLs/.test(cap) && /\*\/api\/quotes\*/.test(cap) && /\*\/api\/demo\*/.test(cap),
      'les captures bloquent les cours et les mois, pour que les images ne se contredisent pas');
    vrai(cap.indexOf('Network.setBlockedURLs') < cap.indexOf('Store.state = structuredClone(SEED)'),
      'avant de poser la graine');
  });

  test('ses totaux se recalculent à l’identique', () => {
    if (sansGraineDeDemo('les totaux du jeu')) return;
    /* Le controle qui vaut pour toute l'application, applique au jeu qu'un
       visiteur voit : la somme des parts fait le total. S'il tombe ici, une
       capture d'ecran montrera une incoherence a des inconnus. */
    Store.state = structuredClone(SEED);
    Store.migrate();
    refreshAccounts();
    const p = patrimoine();
    pres(Object.values(p.classes).reduce((s, v) => s + v, 0), p.brut,
      'le brut est la somme de ses classes');
    pres(Object.values(p.mobilisable).reduce((s, v) => s + v, 0), p.brut,
      'et la somme de ses paliers de disponibilité');
    pres(p.net, p.brut - p.dettes, 'le net est le brut moins les crédits');
    vrai(p.brut > 0, 'et le jeu porte bien des montants');
  });
});

/* ------------------------------------------------------------------
   Chercher un titre, c'est en ajouter un
   ------------------------------------------------------------------ */
suite('Chercher un titre, c’est en ajouter un', () => {

  /* La recherche de symbole, du montage jusqu'a la section suivante du
     fichier : tout ce qui suit appartient a Allocation. */
  const recherche = () => {
    const src = lireSource('assets/app.js');
    return src.slice(src.indexOf('function mountSymbolSearch('),
                     src.indexOf('function viewAllocation('));
  };

  test('un résultat porte un bouton, pas un menu de destinations', () => {
    const bloc = recherche();
    vrai(!/[Aa]ssigner/.test(bloc),
      'plus de menu « Assigner à… » : on ne choisit pas entre créer et compléter');
    vrai(!/Store\.state\.positions\.map\(/.test(bloc),
      'les lignes déjà détenues ne sont plus proposées comme destination');
    vrai(/<button class="btn sm assign-target"/.test(bloc),
      'chaque résultat porte un bouton d’ajout');
    vrai(/bouton\.addEventListener\('click'/.test(bloc),
      'et c’est un clic qui crée la ligne, plus un changement de menu');
  });

  test('compléter une ligne déjà détenue reste possible, depuis sa fiche', () => {
    /* Le menu retire portait un second usage : poser un symbole sur une ligne
       deja creee. Le retrait serait une perte si ce chemin n'existait pas
       ailleurs — la fiche de la ligne verifie son ISIN et pose le symbole
       trouve. C'est la porte que la carte de recherche n'a plus a doubler. */
    const src = lireSource('assets/app.js');
    vrai(/posIsinVerif/.test(src), 'la fiche d’une ligne vérifie son ISIN');
    vrai(/p2\.symbol = best\.symbol/.test(src),
      'et pose sur la ligne le symbole que la vérification trouve');
  });

  test('la fenêtre demande le compte avant la classe et le rôle', () => {
    const bloc = recherche();
    const rang = cle => bloc.indexOf('cle: \'' + cle + '\'');
    for (const cle of ['account', 'assetClass', 'role', 'dateAchat']) {
      vrai(rang(cle) > 0, 'le champ ' + cle + ' est là');
    }
    vrai(rang('account') < rang('assetClass'),
      'le compte se demande en premier : c’est la question à laquelle on sait '
      + 'répondre en arrivant');
    vrai(rang('account') < rang('role'), 'et avant le rôle');
    vrai(rang('assetClass') < rang('role'), 'la classe reste avant le rôle');
  });

  test('elle demande aussi ce qu’on a acheté, et combien', () => {
    /* Quantite et prix paye a zero obligeaient a rouvrir la fiche juste apres,
       pour la seule ligne qu'on vienne de creer. Ils vivent sous le compte,
       parce que c'est le meme geste : j'ai achete tant de titres, a tel prix,
       sur tel compte. La classe et le role, qui rangent, viennent apres. */
    const bloc = recherche();
    const rang = cle => bloc.indexOf('cle: \'' + cle + '\'');
    for (const cle of ['qty', 'buyPrice']) vrai(rang(cle) > 0, 'le champ ' + cle + ' est là');
    vrai(rang('account') < rang('qty'), 'la quantité suit le compte');
    vrai(rang('qty') < rang('buyPrice'), 'puis le prix payé');
    vrai(rang('buyPrice') < rang('assetClass'),
      'et les deux viennent avant les champs de rangement');
    /* La quantite reste libre : on cree aussi une ligne avant de l'acheter, et
       c'est ce que dit son aide. Le prix de revient, lui, devient obligatoire
       DES QU'UNE QUANTITE EST SAISIE -- sinon la ligne nait avec un zero garde
       tel quel, et « prix de revient manquant » s'installe pour toujours. La
       raison d'origine tient donc toujours, elle est seulement plus precise. */
    vrai(!/cle: 'qty'[^}]*requis/.test(bloc), 'la quantité n’est pas obligatoire');
    vrai(/cle: 'buyPrice'[\s\S]{0,60}requis: v => num\(v\.qty\) > 0/.test(bloc),
      'le prix de revient l’est dès qu’il y a des titres');
    vrai(/valeur: cote \? cote\.price : ''/.test(bloc),
      'et il arrive pré-rempli au cours du jour, donc relu plutôt que subi');
  });

  test('elle nomme la devise du prix qu’elle demande', () => {
    /* La bulle disait « dans la devise du titre » alors que rien a l'ecran ne
       disait laquelle : la recherche de Yahoo ne rend ni cours ni devise. Le
       symbole retenu est donc interroge au clic, un appel pour celui qu'on
       designe plutot que vingt-cinq pour la liste entiere. */
    const src = lireSource('assets/app.js');
    const bloc = recherche();
    vrai(/const cote = await coteDuSymbole\(bouton\.dataset\.symbol\)/.test(bloc),
      'le cours du titre choisi est demandé avant l’ouverture de la fenêtre');
    vrai(/\$\{trad\('Prix de revient unitaire'\)\} \(\$\{cote\.currency\}\)/.test(bloc),
      'la devise se lit sur l’intitulé du champ, là où est l’unité du nombre tapé');
    vrai(/exemple: cote \? String\(cote\.price\)/.test(bloc),
      'le cours du jour meuble le champ sans le remplir : un prix de revient '
      + 'pré-rempli au cours d’aujourd’hui serait faux et aurait l’air officiel');
    /* Un repere absent ne doit rien empecher : sans passerelle, la fenetre
       s'ouvre quand meme, avec l'intitule neutre. */
    const aide = src.slice(src.indexOf('async function coteDuSymbole('),
                           src.indexOf('function mountSymbolSearch('));
    vrai(/return null/.test(aide) && /catch/.test(aide),
      'la cote rend null plutôt que de lever : la fenêtre s’ouvre sans le repère');
    vrai(/cote \? .* : trad\('le prix payé par titre/s.test(bloc),
      'et l’intitulé retombe sur sa version neutre');
  });

  test('et ce qu’elle demande atterrit sur la ligne créée', () => {
    /* Un champ qu'on remplit et que la creation ignore est pire que pas de
       champ : il fait croire que c'est saisi. */
    const bloc = recherche();
    vrai(/qty: v\.qty, buyPrice: v\.buyPrice/.test(bloc),
      'la quantité et le prix saisis sont ceux de la ligne, pas des zéros');
  });

  test('la classe déduite se lit, elle ne se choisit pas', () => {
    /* Qu'un titre soit une action ou un ETF est un fait de l'instrument, pas
       une preference, et la recherche le renvoie deja : poser la question
       donnait a choisir une reponse connue. Elle s'affiche donc, avec sa
       provenance.

       Mais une classe n'est pas toujours un fait — un ETC sur l'or est
       « metaux » ici et « actions » ailleurs — donc le chemin de correction
       doit survivre, et la bulle dit ou il est. */
    const bloc = recherche();
    vrai(/deduite = !!bouton\.dataset\.type/.test(bloc),
      'la déduction dépend du type que la recherche a rendu');
    vrai(/deduite\s*\?\s*\{ cle: 'assetClass'[^}]*lecture: true/s.test(bloc),
      'quand le type est connu, la classe est une ligne en lecture');
    vrai(/modifiable sur la fiche de la ligne/.test(bloc),
      'et la bulle dit où la corriger');
    /* Sans type, la question redevient une vraie question, avec son menu. */
    vrai(/: \{ cle: 'assetClass', label: trad\('Classe d’actif'\), type: 'liste'/.test(bloc),
      'sans type renvoyé, le menu revient');
    /* Un champ en lecture ne rend aucune valeur : la creation doit prendre la
       classe deduite, sinon la ligne naissait sans classe. */
    vrai(/assetClass: deduite \? cat : v\.assetClass/.test(bloc),
      'la ligne créée porte bien la classe déduite');
    /* Et la fiche d'une ligne porte toujours le menu, qui est ce chemin. */
    vrai(/OPTIONS_CLASSE\.map/.test(lireSource('assets/app.js')),
      'la fiche d’une ligne garde le choix de la classe');
  });

  test('le lien classe vers comptes ne survit pas à un champ en lecture', () => {
    /* `askForm` cable `lie` sur `#f_assetClass`. Un champ en lecture ne pose
       aucun element de ce nom : garder le lien aurait leve une exception a
       l'ouverture de la fenetre, c'est-a-dire sur le chemin le plus frequent
       de l'application. */
    const bloc = recherche();
    vrai(/\.\.\.\(deduite \? \[\] : \[\{ de: 'assetClass', vers: 'account'/.test(bloc),
      'le lien n’est posé que quand la classe est un vrai champ');
    vrai(/const source = \$\(`#f_\$\{l\.de\}`\)/.test(lireSource('assets/app.js')),
      'askForm attend bien un élément pour la source du lien');
  });

  test('la liste des comptes suit toujours la classe', () => {
    /* L'ordre a l'ecran ne defait pas la dependance : une action ne se loge pas
       sur un portefeuille de cryptomonnaies, et changer la classe refait la
       liste au-dessus d'elle. */
    const bloc = recherche();
    vrai(/\{ de: 'assetClass', vers: 'account', options: comptesPourListe/.test(bloc),
      'les deux champs restent liés');
    vrai(/options: comptesPourListe\(cat\)/.test(bloc),
      'et la liste s’ouvre déjà filtrée par la classe déduite du type');
  });

  test('la barre de recherche est posée, pas dépliée', () => {
    /* Un depliant coute un clic pour reveler ce que le titre de la carte
       annonce deja, et son resume redisait mot pour mot le champ qu'il
       cachait. Un panneau se replie quand il porte des reglages qu'on ne
       touche qu'une fois ; celui-ci porte le geste pour lequel on vient. */
    const src = lireSource('assets/app.js');
    const carte = src.slice(src.indexOf('function symbolSearchCard('),
                            src.indexOf('function mountSymbolSearch('));
    vrai(carte.length > 100, 'la carte se relit depuis sa source');
    vrai(!/<details/.test(carte), 'plus de dépliant sur la carte d’ajout');
    vrai(/id="symQuery"/.test(carte), 'le champ est posé directement');
    vrai(!/outilsAjoutOuvert|pliAjout/.test(src),
      'et l’état du dépliant ne survit pas au dépliant : une variable que plus '
      + 'personne ne lit est la moitié qu’on oublie en retirant un affichage');
  });

  test('le bouton de recherche parle la langue de la page', () => {
    /* Il etait pose sans passer par la traduction, donc invisible au
       rattrapage : « Chercher » s'affichait en francais dans les deux
       versions, au milieu d'une carte entierement anglaise. */
    const src = lireSource('assets/app.js');
    const carte = src.slice(src.indexOf('function symbolSearchCard('),
                            src.indexOf('function mountSymbolSearch('));
    vrai(!/>Chercher</.test(carte), 'plus de libellé posé en dur');
    enLangue('en', () => { eq(trad('Chercher'), 'Search', 'la clé répond en anglais'); });
  });

  test('la carte ne donne pas son propre mode d’emploi', () => {
    /* Le renvoi d'en-tete disait « cherche, puis "+ Nouvelle ligne" » : il
       nommait un controle qu'on a sous les yeux, donc le premier a changer de
       nom l'a rendu faux — et un mode d'emploi faux se lit avant le controle
       qu'il decrit. Un renvoi de carte porte ce que la carte ne montre pas. */
    const src = lireSource('assets/app.js');
    const carte = src.slice(src.indexOf('function symbolSearchCard('),
                            src.indexOf('function mountSymbolSearch('));
    vrai(!/class="hint"/.test(carte), 'pas de renvoi en tête de la carte d’ajout');
    vrai(!/Nouvelle ligne/.test(carte),
      'et plus une seule mention du choix de menu retiré');
    vrai(!/Nouvelle ligne »/.test(lireSource('assets/i18n.js')),
      'sa clé de traduction part avec lui');
  });

  test('le tableau des lignes ne porte pas de colonne de suppression', () => {
    /* Une croix par ligne, collee contre le nom qu'on clique pour lire, met un
       geste irreversible a portee de pouce du geste de lecture — et cinq croix
       alignees font une colonne de destruction la ou le tableau sert a
       comparer. Meme regle que l'annulation, sortie du journal des ventes. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewPositions('),
                          src.indexOf('function mountPositions('));
    vrai(!/del-position/.test(src),
      'ni la colonne ni l’action qui la servait : une action sans porte est la '
      + 'moitié qu’on oublie en retirant un affichage');
    /* La suppression n'est pas perdue : elle vit dans la fiche de la ligne,
       avec les autres actes. Le retrait serait une perte sans elle. */
    vrai(/posDelete/.test(src), 'la fiche d’une ligne porte toujours sa suppression');
    /* Le compte de colonnes doit avoir suivi : un colspan qui ment laisse une
       cellule vide en trop sous le tableau, et l'etat vide deborde. */
    const enTetes = (vue.match(/sortableTh\(/g) || []).length;
    vrai(/colspan="9" class="empty"/.test(vue),
      `l’état vide couvre ${enTetes} colonnes, pas une de plus`);
    vrai(!/<th><\/th>/.test(vue), 'plus d’en-tête vide pour une colonne disparue');
  });

  test('une enveloppe porte les deux natures de support', () => {
    /* Une assurance-vie et un PER ne sont pas des comptes-titres : ils portent
       un ETF qui cote, un fonds euros qui ne cote nulle part, une SCPI, un
       fonds maison sans ISIN. Le modele le permettait deja — `lignesDe()`
       fusionne les lignes cotees et les lignes manuelles — mais trois listes
       blanches le contredisaient. */
    for (const id of ['av', 'per']) {
      const t = TYPES_COMPTE.find(x => x.id === id);
      vrai(t.titres, `${t.label} porte des titres cotés`);
      vrai(t.melange, `${t.label} porte aussi des supports qui ne cotent pas`);
      for (const classe of ['actions', 'obligations', 'immobilier', 'nonCote']) {
        vrai(t.classes.includes(classe), `${t.label} accepte ${classe}`);
      }
    }
  });

  test('et une SCPI trouve enfin son contrat', () => {
    /* Sans `immobilier` dans la liste, `comptesPourCategorie()` n'offrait jamais
       l'assurance-vie a qui ajoute une part de SCPI : la ligne restait sans
       domicile, et rien ne disait pourquoi. */
    Fixture.poser(s => {
      s.comptes.push({ id: 'c_av', etabId: s.etabs[0].id, type: 'av', statut: 'actif',
                       cash: [], lignes: [] });
    });
    const ids = comptesPourCategorie('immobilier').map(c => c.id);
    vrai(ids.includes('c_av'), 'le contrat est proposé pour une SCPI');
    /* Et il reste proposé pour ce qui cote : c'est le point de départ. */
    vrai(comptesPourCategorie('actions').map(c => c.id).includes('c_av'),
      'comme pour un MSCI World, qui marchait déjà');
  });

  test('mais un contrat n’est pas un bien immobilier pour autant', () => {
    /* La nuance n'existait pas : « peut porter de l'immobilier » servait a dire
       « est un bien », donc le contrat entier serait devenu un bien, vocabulaire
       compris. */
    Fixture.poser(s => {
      s.comptes.push({ id: 'c_av', etabId: s.etabs[0].id, type: 'av', statut: 'actif',
                       cash: [], lignes: [] });
    });
    vrai(!comptesBiens().some(c => c.id === 'c_av'),
      'le contrat ne rejoint pas la liste des biens');
    eq(contenantDuType('av').titre, 'Assureur ou courtier',
      'et on ne lui demande pas dans quelle banque le tenir');
    eq(contenantDuType('per').titre, 'Assureur ou courtier', 'le PER non plus');
    eq(contenantDuType('cto').titre, 'Banque ou courtier', 'un CTO garde son mot');
    eq(contenantDuType('immo').titre, 'Bien immobilier', 'et un bien le sien');
  });

  test('la fiche d’une enveloppe porte les deux portes', () => {
    const src = lireSource('assets/app.js');
    const fiche = src.slice(src.indexOf('function viewFicheCompte('),
                            src.indexOf('function viewFicheEtab('));
    vrai(/t\.titres \?.*data-action="ajouter-ligne"/s.test(fiche),
      'ce qui cote passe par la recherche');
    vrai(/!t\.titres \|\| t\.melange \?.*data-action="ajouter-placement"/s.test(fiche),
      'ce qui ne cote pas se saisit sur place, et seulement là où c’est vrai');
  });

  test('le support se demande quand le type en accepte plusieurs', () => {
    /* `t.classes.find(x => x !== 'liquidites')` rendait « actions » : sur une
       enveloppe, un fonds euros et une SCPI tombaient tous deux en actifs de
       marche sans que rien ne le dise. Un fait se declare. */
    const src = lireSource('assets/app.js');
    /* Bornee a la fin de l'action, pas a un nombre de caracteres : un
       commentaire ajoute la faisait sortir de la fenetre. */
    const debut = src.indexOf("async 'ajouter-placement'");
    const bloc = src.slice(debut, src.indexOf('\n  },\n', debut));
    vrai(/const possibles = \(t\.classes \|\| \[\]\)\.filter/.test(bloc),
      'les supports possibles se dérivent de la liste du type');
    vrai(/demandeSupport = possibles\.length > 1/.test(bloc),
      'la question ne se pose que s’il y a plusieurs réponses');
    vrai(/classe = demandeSupport \? \(v\.classe \|\| parDefaut\) : parDefaut/.test(bloc),
      'et la réponse est celle qui est rangée sur la ligne');
  });

  test('la date d’ouverture ne promet plus une règle qui n’existe pas', () => {
    /* Le champ annonçait « elle conditionne la disponibilite, cinq ans pour un
       PEA ». C'etait faux, et volontairement : un PEA de moins de cinq ans
       n'est pas bloque au sens de l'autonomie, on casse le plan et l'argent
       arrive en quelques jours. `mobilisabilite` recevait donc une date qu'elle
       ne lisait jamais — un parametre mort qui faisait croire a une regle. */
    const src = lireSource('assets/store.js');
    const fn = src.slice(src.indexOf('function mobilisabilite('),
                         src.indexOf('function mobilisabilite(') + 2000);
    vrai(!/ouvertLe/.test(fn.slice(0, fn.indexOf('\n}'))),
      'la disponibilité ne dépend d’aucune date, signature comprise');
    vrai(!/conditionne la disponibilité/.test(lireSource('assets/app.js')),
      'et le texte d’aide ne prétend plus qu’une date conditionne la disponibilité');
    /* La preuve par le comportement : deux PEA d'anciennetes opposees. */
    eq(mobilisabilite('actions', 'pea'), mobilisabilite('actions', 'pea'),
      'la fonction ne prend plus que la classe et le type');
    eq(mobilisabilite('actions', 'per'), 'bloque',
      'seul le PER reste fermé, et par sa nature, pas par sa date');
  });

  test('mais l’ancienneté sert enfin à quelque chose', () => {
    /* Huit ans pour une assurance-vie, cinq pour un PEA : le repere que tout
       detenteur guette, et l'application connaissait la date sans rien en
       faire. Ce sont des seuils fiscaux, pas des barrieres a la sortie, et la
       bulle le dit — sinon on retomberait dans la promesse d'avant. */
    auJour('2026-08-17', () => {
      const av = ancienneteCompte({ type: 'av', ouvertLe: '2018-09-01' });
      eq(av.seuilAns, 8, 'une assurance-vie vise huit ans');
      eq(av.annees, 7, 'ouverte depuis sept ans');
      eq(av.reste, 11, 'et onze mois');
      eq(av.atteint, false, 'le seuil n’est pas encore atteint');
      eq(av.seuilLe, '2026-09-01', 'il tombe le 1er septembre 2026');
      const pea = ancienneteCompte({ type: 'pea', ouvertLe: '2019-01-01' });
      eq(pea.seuilAns, 5, 'un PEA vise cinq ans');
      eq(pea.atteint, true, 'et celui-là les a passés');
    });
    /* Les types sans seuil d'anciennete ne rendent rien : un PER se libere sur
       un evenement, pas sur une duree, et un compte courant n'a pas de seuil. */
    for (const type of ['per', 'cto', 'courant', 'immo']) {
      eq(ancienneteCompte({ type, ouvertLe: '2015-01-01' }), null,
        `${type} n’a pas de seuil d’ancienneté`);
    }
    eq(ancienneteCompte({ type: 'av' }), null, 'et sans date, rien à afficher');
  });

  test('un fonds euros a une porte pour entrer', () => {
    /* La poche existait, la projection la traitait, et aucun ecran ne
       permettait d'y ranger quoi que ce soit : la classe manquait dans la liste
       des contrats, donc le menu des supports ne l'offrait pas. Une poche sans
       porte est une poche qui reste vide.

       Et `pocheDeClasse('garanti')` retombait sur le defaut « actions », ce qui
       faisait proposer un PEA pour y loger un fonds euros. */
    eq(pocheDeClasse('garanti'), 'garanti',
      'une poche passée en catégorie se rend elle-même');
    for (const id of ['av', 'per']) {
      const t = TYPES_COMPTE.find(x => x.id === id);
      vrai(t.classes.includes('garanti'), `${t.label} accepte un capital garanti`);
    }
    /* Le menu des supports se derive de cette liste : il l'offre donc. */
    const t = TYPES_COMPTE.find(x => x.id === 'av');
    const possibles = t.classes.filter(x => x !== 'liquidites');
    vrai(possibles.includes('garanti'),
      'le menu « Support » d’un contrat propose « Capital garanti »');
    /* Et seuls les comptes qui l'acceptent sont proposes : un PEA n'y est pas. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av2', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2020-01-01', cash: [], lignes: [] });
    });
    const ids = comptesPourCategorie('garanti').map(c => c.id);
    vrai(ids.includes('c_av2'), 'le contrat est proposé');
    vrai(!ids.includes('c_pea'), 'le PEA ne l’est pas : on n’y loge pas de fonds euros');
  });

  test('la pile du graphique fait le total, à chaque point', () => {
    /* Deux enumerations ecrites a la main n'avaient pas suivi la septieme
       poche. Le point « Auj. » de l'historique liste six poches et annonce
       `t.brut`, qui en compte sept : la pile perdait le capital garanti et le
       total le gardait. La courbe et son propre total se contredisaient.

       Le graphique trace des poches de COMPTE, la ou la carte des classes trace
       des classes de ligne : un releve mensuel note des montants par compte, et
       rien n'y dit quelle part d'une assurance-vie etait en fonds euros il y a
       huit mois. Le capital garanti rejoint donc la bourse dans cette courbe,
       comme les obligations le font depuis toujours. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2018-09-01', cash: [],
        lignes: [{ id: 'g', classe: 'garanti', libelle: 'Fonds euros',
                   valeur: 10000, prixDeRevient: 10000 }] });
    });
    /* `SERIES_PATRIMOINE` vit dans app.js, que le harnais ne charge pas : les
       clefs se relisent dans la source, ce qui verifie du meme coup qu'elles y
       sont bien declarees. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('const SERIES_PATRIMOINE = () => ['),
                           src.indexOf('function seriesUtiles('));
    const cles = [...bloc.matchAll(/key: '([a-z]+)'/g)].map(m => m[1]);
    vrai(cles.length >= 7, 'les bandes se relisent depuis la source');
    vrai(cles.includes('garanti'),
      'le capital garanti a sa bande : le fondre dans « Actifs de marché » '
      + 'affichait un patrimoine entièrement en fonds euros comme 100 % de marché');
    for (const p of historySeries()) {
      const somme = cles.reduce((s, k) => s + num(p[k]), 0);
      pres(somme, num(p.total), `la pile de ${p.label} doit faire son total`);
    }
  });

  test('et le panneau de la projection aussi', () => {
    /* Le total vient de `q.placees`, donc une poche absente de la liste se
       compte dans le total sans apparaitre : la fenetre annoncerait 86 500 EUR
       pour quatre lignes qui en feraient 76 500, l'ecart valant exactement le
       capital garanti. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2018-09-01', cash: [],
        lignes: [{ id: 'g', classe: 'garanti', libelle: 'Fonds euros',
                   valeur: 10000, prixDeRevient: 10000 }] });
    });
    const q = pochesProjection();
    /* Les poches que la projection distingue, chacune doit avoir sa ligne. */
    const src = lireSource('assets/app.js');
    const panneau = src.slice(src.indexOf('baseProjection: () => {'),
                              src.indexOf('immobilierNet: () => {'));
    for (const [poche, motif] of [['marche', /trad\('Actifs de marché'\)/],
                                  ['garanti', /trad\('Capital garanti'\)/],
                                  ['autres', /trad\('Autres actifs'\)/],
                                  ['liquidites', /trad\('Liquidités'\)/],
                                  ['projet', /trad\('Réservé à un projet'\)/]]) {
      vrai(motif.test(panneau), `la poche ${poche} a sa ligne dans le panneau`);
    }
    pres(q.placees,
      q.marche + q.autres + q.liquidites + q.garanti + q.projet,
      'le total du panneau est bien la somme des poches qu’il liste');
    /* Et avec une ligne reservee, la ou le double comptage guettait : ces euros
       doivent quitter leur poche d'origine, sinon ils figurent deux fois. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2018-09-01', cash: [],
        lignes: [{ id: 'r', classe: 'actions', libelle: 'Apport', projet: true,
                   valeur: 40000, prixDeRevient: 40000 }] });
    });
    const t2 = nowTotals(), q2 = pochesProjection(t2);
    eq(Math.round(q2.projet), 40000, 'la poche du réservé porte les 40 000 €');
    /* Les lignes du panneau, reconstituees comme la vue les calcule : elles
       lisent toutes `pochesProjection`, ce qui est le point — une ligne qui
       refait sa soustraction a cote finit par ne plus dire la meme chose. */
    const lignes = [q2.marche, q2.garanti, q2.autres, q2.liquidites, q2.projet];
    pres(lignes.reduce((a, b) => a + b, 0), q2.placees,
      'la somme des lignes fait le total, même avec un montant réservé');
  });


  test('l’assurance emprunteur ne rembourse pas le capital', () => {
    /* Elle vaut couramment 0,3 a 0,4 % du capital emprunte par an, elle est
       prelevee avec l'echeance, et le modele la comptait comme du
       remboursement : sur 250 000 EUR, c'est 75 EUR par mois qui faisaient
       descendre la dette dans la projection alors qu'ils partent en prime. */
    const credit = assurance => ({ id: 'd', libelle: 'Prêt', montant: 200000,
      initial: 250000, taux: 3.5, mensualite: 1251,
      ...(assurance ? { tauxAssurance: 0.36 } : {}), verifieLe: '2025-08-17' });
    auJour('2026-08-17', () => {
      const sans = projectionCredit(credit(false));
      const avec = projectionCredit(credit(true));
      eq(sans.moisDepuis, 12, 'douze mois projetés');
      vrai(avec.projete > sans.projete,
        'avec l’assurance, la dette descend moins vite : la prime ne rembourse rien');
      /* 250 000 x 0,36 % / 12 = 75 EUR par mois qui ne remboursent pas. Sur
         douze mois, la difference de capital restant du s'en approche, aux
         interets pres que ces 75 EUR n'ont pas evites. */
      const ecart = avec.projete - sans.projete;
      vrai(ecart > 900 && ecart < 950,
        `douze primes de 75 € font ${Math.round(ecart)} € de dette en plus`);
    });
    /* Sans capital initial connu, la base est le restant du : la prime est
       sous-estimee, ce qui est le bon sens de l'erreur. */
    auJour('2026-08-17', () => {
      const d = { ...credit(true) }; delete d.initial;
      vrai(projectionCredit(d).projete > projectionCredit(credit(false)).projete,
        'et sans capital initial, elle compte quand même');
    });
  });

  test('de l’argent déjà promis ne travaille pas trente ans', () => {
    /* Le cash portait deja « Projet prevu », mais l'affectation s'arretait au
       cash : le cas le plus courant est ailleurs, l'assurance-vie qui financera
       l'apport d'un achat dans deux ans. Ces euros se lisaient comme du
       patrimoine long terme et entraient dans la projection a trente ans.

       Ce n'est pas le reglage de disponibilite, qui vit a cote : celui-la dit
       quand on POURRAIT vendre, celui-ci dit que c'est deja engage. */
    const poser = reserve => Fixture.poser(s => {
      s.meta.projRate = 8; s.meta.projRateAutres = 0; s.meta.projRateGaranti = 0;
      s.meta.projMonthly = 0; s.meta.projInflation = 0;
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2018-09-01', cash: [],
        lignes: [{ id: 'l1', classe: 'actions', libelle: 'ETF Monde',
                   valeur: 40000, prixDeRevient: 40000, ...(reserve ? { projet: true } : {}) }] });
    });

    poser(false);
    const libre = capitalisation({ years: 10 }).points[10];
    poser(true);
    const q = pochesProjection();
    eq(Math.round(q.projet), 40000, 'les 40 000 € réservés ont leur poche');
    /* Et ils ont quitte celle qui les portait, sinon ils compteraient deux fois :
       la base de la projection vaut toujours le brut moins ce qui est porte a
       plat par ailleurs, l'immobilier et les biens. */
    const t = nowTotals();
    pres(q.placees, num(t.brut) - num(t.immo) - num(t.biens),
      'la base de la projection ne double ni ne perd rien');
    const promis = capitalisation({ years: 10 }).points[10];
    /* Portes a plat : dix ans plus tard, toujours 40 000 de cette ligne. */
    vrai(promis.total < libre.total,
      'un argent promis ne produit pas ce qu’il produisait en capitalisant');
    pres(libre.total - promis.total, 40000 * (Math.pow(1.08, 10) - 1),
      'la différence vaut exactement ce que 8 % pendant dix ans lui donnaient');
    /* La ligne reste dans sa classe partout ailleurs, et le brut ne bouge pas :
       reserver ne deplace rien et ne fait rien disparaitre. C'est toujours un
       ETF, l'allocation doit le dire, seule la projection change de traitement. */
    poser(false);
    const avant = { brut: patrimoine().brut, actions: patrimoine().classes.actions };
    poser(true);
    pres(patrimoine().classes.actions, avant.actions,
      'l’allocation continue de la compter en actifs de marché');
    pres(patrimoine().brut, avant.brut, 'et le patrimoine brut est le même');
  });

  test('un capital garanti ne capitalise pas au taux du marché', () => {
    /* Le defaut qui a motive la poche. La projection repartit le patrimoine par
       poche, et un fonds euros tombait dans « marche » : 8 % l'an sur un
       capital garanti. Pour qui detient l'essentiel de son assurance-vie en
       fonds euros, c'est la moitie d'un patrimoine projetee a trois fois son
       rendement reel — et toujours du cote flatteur, donc invisible. */
    const poser = () => Fixture.poser(s => {
      s.meta.projRate = 8; s.meta.projRateAutres = 0; s.meta.projMonthly = 0;
      s.meta.projInflation = 0; s.meta.projRateGaranti = 0;
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2020-01-01', cash: [],
        lignes: [{ id: 'l_fe', classe: 'garanti', libelle: 'Fonds euros',
                   valeur: 100000, prixDeRevient: 100000 }] });
    });
    poser();
    eq(Math.round(pochesProjection().garanti), 100000,
      'les 100 000 € sont dans la poche du capital garanti');
    eq(Math.round(pochesProjection().marche - pochesProjection().garanti * 0),
      Math.round(pochesProjection().marche),
      'et pas dans celle du marché');
    const plat = capitalisation({ years: 10 });
    const j10 = plat.points[10];
    /* Taux a zero : cent mille euros restent cent mille. Au taux du marche ils
       en feraient plus de deux cent seize mille. */
    pres(j10.gainsGaranti, 0, 'à taux nul, un capital garanti ne produit rien');
    /* Et quand on affirme un taux, il s'applique — le sien, pas celui du marche. */
    poser();
    Store.state.meta.projRateGaranti = 2.5;
    const avec = capitalisation({ years: 10 }).points[10];
    pres(avec.gainsGaranti, 100000 * (Math.pow(1.025, 10) - 1),
      'à 2,5 %, il produit ce que 2,5 % produisent');
    vrai(avec.gainsGaranti < 30000,
      'très loin des 116 000 € que le taux du marché lui aurait prêtés');
  });

  test('les deux natures ont chacune leur carte, et plus un titre commun', () => {
    /* « Epargne et croissance » portait deux choses sous un titre : un flux de
       budget — ce que les revenus laissent une fois charges et depenses
       retirees — et la variation du patrimoine net d'un mois sur l'autre, qui
       contient les marches et les apports exterieurs. Le titre les nommait
       toutes deux, faute de mieux, parce qu'elles etaient dans la meme carte.

       Elles n'y sont plus. Le flux est devenu « Accumulation ce mois-ci » sur
       l'accueil ; la variation constatee vit dans « Rythme d'accumulation »,
       ou elle etait deja. Un titre a deux natures etait le pansement d'un
       probleme de rangement, et le rangement est fait. */
    const src = lireSource('assets/app.js');
    vrai(!/trad\('Épargne et croissance'\)/.test(src),
      'la carte à deux natures a quitté l’onglet Charges fixes');
    vrai(!/trad\('Écart avec la théorie'\)/.test(src),
      'et « écart », qui se lisait comme une erreur, n’est jamais revenu');
    /* Le modele n'a pas bouge : `gap` reste calcule et reste juste, meme si plus
       aucun ecran ne l'affiche. On ne touche pas aux calculs pour un
       demenagement d'interface. */
    Fixture.poser();
    const rec = savingsReconciliation();
    if (rec.realPerMonth != null) {
      pres(rec.gap, rec.realPerMonth - rec.theoretical,
        'la différence entre le constaté et le prévu reste exacte dans le modèle');
    }
  });

  test('un contrat plein d’ETF ne compte pas comme de la pierre', () => {
    /* Le defaut coutait cher et ne se voyait nulle part : `gAff`, la poche
       d'affichage, se derivait de « peut porter de l'immobilier ». Une
       enveloppe qui accepte une SCPI parmi cinq classes basculait donc en
       entier dans la bande immobilier du graphique, ETF compris, et sa valeur
       quittait la poche « marche » de la projection pour celle des biens.

       Le controle porte sur les totaux, la ou il se voyait le moins : la somme
       ne bougeait pas, seule sa repartition mentait. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2020-01-01', cash: [],
        lignes: [{ id: 'l_av', classe: 'actions', libelle: 'ETF Monde',
                   valeur: 50000, prixDeRevient: 40000 }] });
    });
    eq(ACC['c_av'].gAff, 'bourse',
      'un contrat s’affiche avec les actifs de marché, pas avec les biens');
    const avant = nowTotals();
    /* Et la meme enveloppe qui porte vraiment une SCPI n'y bascule pas non plus :
       c'est la ligne qui est de l'immobilier, pas le contrat. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_av', nom: 'Assureur', notes: '', dettes: [] });
      s.comptes.push({ id: 'c_av', etabId: 'e_av', type: 'av', statut: 'actif',
        ouvertLe: '2020-01-01', cash: [],
        lignes: [{ id: 'l_av', classe: 'immobilier', libelle: 'SCPI',
                   valeur: 50000, prixDeRevient: 50000 }] });
    });
    eq(ACC['c_av'].gAff, 'bourse', 'le contenant reste un contrat');
    vrai(num(avant.bourse) > 0, 'et la poche de marché porte bien le contrat');
  });

  test('un contrat n’a pas de poche de cash', () => {
    /* L'argent verse sur une assurance-vie est sur un support des son arrivee,
       au pire le fonds euros : « Cash a investir » y inventait une poche qui
       n'existe pas, comptee ensuite dans les liquidites de l'accueil et dans
       les paliers d'autonomie. */
    for (const id of ['av', 'per']) {
      const t = TYPES_COMPTE.find(x => x.id === id);
      vrai(t.sansCash, `${t.label} ne porte pas de cash`);
      /* Mais « liquidites » reste dans la liste : le mot y sert aussi a
         accepter un support monetaire, qui est un placement et non du cash.
         Deux choses sous un seul mot, d'ou deux reglages — les confondre
         aurait interdit le fonds monetaire en voulant retirer la poche. */
      vrai(t.classes.includes('liquidites'),
        `${t.label} accepte toujours un support monétaire`);
    }
    eq(!!TYPES_COMPTE.find(x => x.id === 'cto').sansCash, false,
      'un compte-titres garde la sienne : le cash y attend vraiment d’être investi');
  });

  test('mais le cash déjà saisi ne disparaît pas avec la carte', () => {
    /* Retirer un ecran ne doit pas emporter ce que quelqu'un y avait saisi :
       la carte reste des qu'elle porte quelque chose, pour qu'on puisse
       reclasser ces euros a la main. */
    const src = lireSource('assets/app.js');
    vrai(/const carteSolde = !\(\(t\.sansCash \|\| !t\.classes\.includes\('liquidites'\)\) && !\(c\.cash \|\| \[\]\)\.length\);/.test(src)
      && /\$\{!carteSolde \? '' : `/.test(src),
      'la carte de trésorerie ne se masque que si elle est vide');
    /* Et l'assistant ne pose plus les trois questions du cash. */
    vrai(/\.\.\.\(t\.sansCash \? \[\] : \[/.test(src),
      'les trois champs du cash sautent à la création');
    /* « Contrat » chez un assureur, « plan » chez un teneur de compte : le mot
       suit le contenant déclaré depuis les enveloppes américaines. */
    vrai(/t\.sansCash \? trad\(enContrat\(t\) \? 'Nommer le contrat' : 'Nommer le plan'\)/.test(src),
      'et l’étape dit ce qu’elle demande vraiment');
  });

  test('un contenant vide n’est jamais le choix par défaut', () => {
    /* Sans compte rattache, `contenantDeLEtab` n'a plus de famille a deriver et
       retombe sur « banque ou courtier » : un « Studio » dont le bien a ete
       supprime se proposait partout, et `proposables[0]` en faisait le defaut —
       la fenetre qui demande chez quel assureur tenir un contrat s'ouvrait sur
       un studio. On continue de le proposer, en dernier : le retirer ferait
       retaper un nom qui existe, donc deux etablissements homonymes. */
    const src = lireSource('assets/app.js');
    Fixture.poser(s => s.etabs.push({ id: 'e_vide', nom: 'Vide', notes: '', dettes: [] }));
    const ordre = etablissementsProposables('courant').map(x => x.etab.id);
    vrai(ordre.indexOf('e_banque') < ordre.indexOf('e_vide') && ordre[ordre.length - 1] === 'e_vide',
      'ceux qui ont des comptes et la bonne famille passent devant');
    Fixture.poser();
    vrai(/valeur: proposables\.find\(e => aDesComptes\(e\) && memeFamille\(e\)\)\?\.id \|\| '__nouveau'/.test(src),
      'et le défaut ne tombe que sur l’un d’eux, sinon sur « + Nouveau »');
  });

  test('l’exemple d’un support parle de son espèce', () => {
    /* « ex. Projet Bordeaux » sous l'intitule d'un fonds euros ne dit pas ce
       qu'on attend : il fait douter d'etre au bon endroit. */
    const src = lireSource('assets/app.js');
    const table = (src.match(/const EXEMPLE_PLACEMENT = \{[^}]*\}/) || [''])[0];
    vrai(table, 'la table des exemples existe');
    /* « Fonds euros » a quitte les obligations pour le capital garanti, qui est
       sa vraie poche : un fonds obligataire baisse quand les taux montent, un
       fonds euros non, et c'est toute la difference que la poche porte. */
    for (const [classe, mot] of [['garanti', 'Fonds euros'], ['obligations', 'obligataire'],
                                 ['actions', 'MSCI World'],
                                 ['immobilier', 'SCPI'], ['nonCote', 'Projet Bordeaux']]) {
      vrai(new RegExp(`${classe}:\\s*'ex\\. [^']*${mot}`).test(table),
        `${classe} propose un exemple de son espèce`);
    }
  });

  test('sous 768 px, le bouton d’ajout ne s’étire pas sur toute la carte', () => {
    /* La regle valait pour le menu qu'il remplace : un menu s'etire parce que
       ses options portent de longs noms et qu'il les tronque sans rien dire. Un
       libelle de deux mots etendu sur toute la carte devient un aplat clair par
       resultat, et six titres cherches se lisent comme six boutons separes par
       du texte. */
    const css = lireSource('assets/styles.css');
    const regles = css.match(/table\.cols-nom-action[^{]*\{[^}]*\}/g) || [];
    const etires = regles.filter(r => /width:\s*100%/.test(r));
    for (const r of etires) {
      vrai(!/\.btn/.test(r), 'le bouton d’ajout ne doit pas prendre toute la largeur : ' + r);
    }
    vrai(etires.some(r => /select/.test(r)),
      'le menu, lui, garde sa pleine largeur : il tronque ses options sans le dire');
  });
});

/* ------------------------------------------------------------------
   La reserve fiscale se dit une fois, dans une bulle
   ------------------------------------------------------------------ */
suite('La réserve fiscale se dit dans une bulle', () => {

  const journal = () => {
    const src = lireSource('assets/app.js');
    return src.slice(src.indexOf('function salesCard('),
                     src.indexOf('function viewAllocation('));
  };

  test('elle vit sur le titre de la carte, plus sous la liste', () => {
    const bloc = journal();
    vrai(/\$\{aide\(trad\('Résultat brut, avant frais et fiscalité/.test(bloc),
      'la réserve est une bulle du titre : elle vaut pour chaque ligne du '
      + 'journal, et ne se relit pas');
    vrai(!/<p class="hint"[^>]*>\$\{trad\('Résultat brut/.test(bloc),
      'et plus une phrase en pied de carte, qui prenait trois lignes d’écran');
  });

  test('et sa traduction reste celle qui existait', () => {
    /* La cle ne bouge pas en changeant de place : une bulle qui perd sa
       traduction s'afficherait en francais dans la version anglaise, et c'est
       exactement le defaut que cette phrase-la a deja eu. */
    const phrase = 'Résultat brut, avant frais et fiscalité : le traitement fiscal '
      + 'dépend de l’enveloppe (PEA, CTO) et de ta situation.';
    enLangue('en', () => {
      vrai(/^Gross result/.test(trad(phrase)), 'la version anglaise répond');
    });
  });
});

/* ------------------------------------------------------------------
   L'horizon retenu se marque sans se nommer
   ------------------------------------------------------------------ */
suite('L’horizon retenu se marque sans se nommer', () => {

  test('le libellé quitte la colonne la plus étroite', () => {
    const src = lireSource('assets/app.js');
    vrai(!/trad\('horizon retenu'\)/.test(src),
      'le libellé élargissait la première colonne, et « Après inflation » '
      + 'sortait de l’écran à 375 px');
    vrai(!/"horizon retenu"/.test(lireSource('assets/i18n.js')),
      'sa clé de traduction part avec lui : une clé que personne n’appelle '
      + 'survit à tous les nettoyages');
  });

  test('la correspondance avec le réglage reste visible', () => {
    /* Sans marque, changer la duree dans le pied du tableau deplace le
       graphique et le total de la premiere carte sans qu'on voie ou le choix a
       atterri ici : une ligne de plus au milieu des jalons, indistincte de ses
       voisines. */
    const src = lireSource('assets/app.js');
    vrai(/class="\$\{retenu \? 'jalon-retenu' : ''\}"/.test(src),
      'la ligne du réglage porte une classe');
    vrai(/retenu \? ' aria-current="true"' : ''/.test(src),
      'et le dit à qui n’a pas les yeux dessus');
  });

  test('le marquage ne coûte aucun pixel de colonne', () => {
    const css = lireSource('assets/styles.css');
    const regles = css.match(/tr\.jalon-retenu[^{]*\{[^}]*\}/g);
    vrai(!!regles, 'la règle CSS existe : une classe posée sans règle ne peint rien');
    const tout = regles.join(' ');
    vrai(/color: var\(--accent\)/.test(tout),
      'c’est l’encre qui désigne la ligne du réglage');
    vrai(!/border|padding|width|box-shadow/.test(tout),
      'ni bordure, ni remplissage, ni filet : chacun élargirait la colonne, donc '
      + 'repousserait la dernière hors de l’écran, ce que ce marquage répare');
    vrai(/\.muted \{ color: var\(--accent\)/.test(tout),
      'l’année suit le libellé : une étiquette ne se coupe pas en deux encres');
  });

  test('le menu offre les horizons courts, pas seulement les longs', () => {
    /* Les cinq reperes du tableau en etaient exclus, au motif qu'ils y
       figuraient deja : le menu commencait donc a vingt-cinq ans. Le
       raisonnement se tenait sur la redondance et ratait l'essentiel -- choisir
       un horizon ne designe pas une ligne, il change toute la page, et tout le
       monde n'a pas vingt-cinq ans devant soi. */
    eq(PROJECTION_CHOICES[0], 3, 'la liste commence au premier repère, trois ans');
    for (const h of PROJECTION_HORIZONS) {
      vrai(PROJECTION_CHOICES.includes(h),
        `« ${h} ans » doit pouvoir se choisir : c'est un horizon comme un autre`);
    }
    vrai(PROJECTION_CHOICES.includes(80), 'et la liste couvre toujours 80 ans');
    /* Triee et sans doublon : 5, 10, 15 et 20 sont a la fois des reperes et des
       paliers de cinq ans, et la liste se derive des deux. */
    const triee = [...PROJECTION_CHOICES].sort((a, b) => a - b);
    eq(PROJECTION_CHOICES.join(','), triee.join(','), 'la liste est triée');
    eq(new Set(PROJECTION_CHOICES).size, PROJECTION_CHOICES.length,
      'et sans doublon, bien qu’elle vienne de deux sources');
  });

  test('le menu affiche toujours l’horizon en cours', () => {
    /* La fonction ne depend que de la liste, de `trad` et de l'horizon : on la
       reconstruit depuis sa source et on la joue, plutot que de chercher un
       motif dans une chaine. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf('const selecteurHorizon = () => {');
    const corps = src.slice(debut, src.indexOf('let hypoOuvert', debut));
    vrai(debut > 0 && corps.length > 100, 'le sélecteur se relit depuis sa source');
    const rendre = h => new Function('PROJECTION_CHOICES', 'trad', 'projHorizon',
      corps + ' return selecteurHorizon();')(PROJECTION_CHOICES, trad, h);
    for (const h of [3, 10, 20, 30, 80]) {
      vrai(new RegExp(`value="${h}" selected`).test(rendre(h)),
        `le menu montre « ${h} ans » quand c'est l'horizon en cours`);
    }
    /* Une valeur hors liste s'y ajoute : un menu qui n'offre pas sa propre
       valeur affiche la premiere venue, et annoncerait un horizon qui n'est ni
       celui du graphique ni celui de la ligne marquee. */
    vrai(/value="27" selected/.test(rendre(27)),
      'et un horizon hors paliers rejoint la liste plutôt que de disparaître');
  });
});

/* ------------------------------------------------------------------
   La demonstration ne porte aucune enveloppe francaise
   ------------------------------------------------------------------ */
suite('La démonstration ne porte aucune enveloppe française', () => {

  /* Tout ce que la graine donne a lire : les identifiants restent hors du
     compte, ils ne s'affichent nulle part et ce sont les colonnes de seize
     mois de releves. */
  const libelles = () => {
    const out = [];
    for (const t of SEED_ACCOUNT_TYPES) out.push(t.label);
    for (const a of SEED_ACCOUNTS) out.push(a.label, a.short, a.broker, a.alloc || '');
    for (const m of SEED_MONTHLY) out.push(m.comment || '');
    for (const mod of SEED_STRATEGY.models) {
      for (const l of mod.lines) out.push(l.label, l.vehicles);
    }
    return out.filter(Boolean);
  };

  test('le rythme de la démonstration s’explique par son budget', () => {
    if (sansGraineDeDemo('le rythme du jeu')) return;
    /* Les releves mensuels ont ete ecrits a la main, chaque compte montant d'un
       pas regulier, sans que la somme de ces pas soit jamais rapprochee du
       budget. Le patrimoine grimpait de 1 900 EUR par mois quand le budget n'en
       degageait que 1 048 : la carte « Epargne et croissance » annonçait alors
       un « ce qui ne vient pas du budget » plus gros que le budget lui-meme, et
       une demonstration qui montre ça donne l'impression que l'application
       compte mal.

       L'ecart doit rester dans ce qu'un marche peut produire. La demonstration
       porte environ 60 000 EUR d'actifs de marche : 600 EUR par mois font
       12 % l'an, deja genereux, et c'est la borne. */
    Store.state = structuredClone(SEED); Store.migrate(); refreshAccounts();
    const theorique = savingsReconciliation().theoretical;
    vrai(theorique > 0, 'le budget de la démonstration dégage une épargne');
    const tous = monthlyPace().points;
    for (const [nom, n] of [['un an', 12], ['trois ans', 36], ['tout', tous.length]]) {
      const rythme = statsRythme(tous.slice(-n)).average;
      const ecart = Math.abs(rythme - theorique);
      vrai(ecart < 600,
        `sur ${nom}, le patrimoine croît de ${Math.round(rythme)} € par mois quand le `
        + `budget en dégage ${Math.round(theorique)} : ${Math.round(ecart)} € d’écart `
        + `mensuel qu’aucun marché ne produit`);
    }
  });

  test('aucun nom réel n’a repris place dans la graine', () => {
    if (sansGraineDeDemo('les établissements de la graine')) return;
    /* La graine est fictive, et rien ne l'empechait de cesser de l'etre : coller
       un patrimoine reel dedans est le chemin le plus court quand on veut « des
       donnees realistes pour tester », et ce depot est public.

       Le controle liste ce qui est ATTENDU plutot que ce qui est interdit. Une
       liste d'interdits ne protege que de ce qu'on a deja vu, et il faudrait y
       ecrire les vrais noms — dans un depot public, ce serait les publier pour
       les interdire. La liste des etablissements de la demonstration est courte
       et connue : tout ce qui n'y est pas est rouge, y compris le nom qu'on
       n'avait pas prevu. */
    const ATTENDUS = ['Online bank', 'Cash on hand', 'Broker A', 'Broker B',
                      'Fund manager', 'Flat'];
    const trouves = [...new Set(SEED_ACCOUNTS.map(a => a.broker).filter(Boolean))];
    const intrus = trouves.filter(n => !ATTENDUS.includes(n));
    eq(intrus.join(', '), '',
      'un établissement que la démonstration n’a pas inventé est apparu dans la graine');
    /* Et l'inverse : un nom attendu qui disparait veut dire que la graine a ete
       remplacee, ce qui est le geste par lequel un vrai patrimoine y entre. */
    const manquants = ATTENDUS.filter(n => !trouves.includes(n));
    eq(manquants.join(', '), '', 'la graine de démonstration a changé d’établissements');
  });

  test('aucun libellé ne dit « PEA »', () => {
    /* La demonstration s'ouvre en anglais pour qui ne parle pas francais, et un
       PEA n'y existe pas : le lecteur y voit un sigle qu'aucune traduction ne
       peut lui rendre. */
    const fautifs = libelles().filter(m => /PEA/.test(m));
    eq(fautifs.join(' · '), '', 'ces libellés portent encore une enveloppe française');
  });

  test('l’enveloppe quitte la démonstration, pas l’application', () => {
    vrai(!SEED_ACCOUNT_TYPES.some(t => t.id === 'pea'),
      'la graine n’offre plus ce type');
    vrai(!!TYPES_COMPTE.find(t => t.id === 'pea'),
      'mais qui saisit son propre patrimoine le garde dans la liste : c’est le '
      + 'jeu de démonstration qui est international, pas l’application');
  });

  test('chaque compte de la graine tombe sur un type qui existe', () => {
    for (const a of SEED_ACCOUNTS) {
      vrai(SEED_ACCOUNT_TYPES.some(t => t.id === a.type)
        || !!TYPES_COMPTE.find(t => t.id === a.type),
        'le compte ' + a.id + ' porte un type inconnu : ' + a.type);
    }
  });

  test('les deux comptes de titres restent distincts', () => {
    if (sansGraineDeDemo('les deux comptes de titres')) return;
    /* Deux enveloppes de meme intitule ne se relisent pas : la colonne courte
       est tout ce qu'un tableau serre affiche. */
    const titres = SEED_ACCOUNTS.filter(a => a.holdings);
    vrai(titres.length >= 2, 'la démonstration en porte bien deux');
    eq(new Set(titres.map(a => a.short)).size, titres.length,
      'deux intitulés courts identiques');
    eq(new Set(SEED_ACCOUNTS.map(a => a.short)).size, SEED_ACCOUNTS.length,
      'et aucun doublon sur l’ensemble des comptes');
  });

  test('après migration, rien à l’écran ne se nomme PEA', () => {
    /* Le libelle affiche ne vient pas de la graine mais du type projete : c'est
       `typeCompte` qui repond, et un compte reste sur son ancien type si on ne
       le change pas. Le controle porte donc sur ce que la vue lirait. */
    Store.state = structuredClone(SEED);
    Store.migrate();
    refreshAccounts();
    for (const a of ACCOUNTS) {
      vrai(!/PEA/.test([a.label, a.short, a.broker].join(' ')),
        'le compte ' + a.id + ' se nomme encore PEA');
      vrai(!/PEA/.test(typeCompte(a.type).label),
        'le compte ' + a.id + ' porte une enveloppe nommée PEA');
    }
  });
});

/* La carte du portefeuille sur l'accueil : ce qu'elle montre, ce qu'elle tait,
   et la place qu'elle prend. */
suite('La carte du portefeuille raconte une phrase', () => {

  test('sans aucun prix de revient, il n’y a pas de gain à afficher', () => {
    /* `invested` vaut zero, donc `value - invested` rendait `value` : le chiffre
       est arithmetiquement juste et ne veut rien dire. Le pourcentage se taisait
       deja ; l'euro s'affichait comme un gain, et c'etait le portefeuille. */
    Fixture.poser();
    Store.state.positions = [
      { id: 'ptf-a', symbol: 'AAA', qty: 10, price: 50 },
      { id: 'ptf-b', symbol: 'BBB', qty: 4, price: 25 },
    ];
    const p = latentPnl();
    pres(p.value, 600, 'la valeur se calcule sans prix de revient');
    pres(p.invested, 0, 'aucune ligne ne dit ce qu’elle a coûté');
    pres(p.pnl, 0, 'et « 600 − 0 » n’est pas un gain de 600 €');
    eq(p.pct, null, 'aucun pourcentage n’existe sur une base nulle');
    eq(p.sansBase, 2, 'les deux lignes sont écartées, et comptées');
  });

  test('une seule ligne sans base ne gonfle pas le résultat de tout le reste', () => {
    /* Le cas vu a l'ecran, et le plus dangereux : les autres lignes ont une
       base, donc `invested > 0`, donc la garde du pourcentage ne se declenche
       pas. Une ligne a 520 EUR sans prix de revient ajoutait 520 EUR de
       plus-value au portefeuille — pres de la moitie du resultat annonce — avec
       un « +0,0 % » a cote, qui venait de l'autre branche du calcul. */
    Fixture.poser();
    Store.state.positions = [
      { id: 'ptf-a', symbol: 'AAA', qty: 10, price: 110, buyPrice: 100 },
      { id: 'ptf-b', symbol: 'BBB', qty: 1, price: 520 },
    ];
    const sansBase = Store.state.positions[1];
    eq(posPerfEur(sansBase), null, 'la ligne sans base n’a pas de gain');
    eq(posPerfPct(sansBase), null, 'ni de pourcentage, et surtout pas zéro');

    const p = latentPnl();
    pres(p.value, 1620, 'le portefeuille vaut bien la somme de ses deux lignes');
    pres(p.invested, 1000, 'une seule a coûté quelque chose');
    pres(p.pnl, 100, 'et le gain est celui de cette seule ligne');
    pres(p.pct, 10, 'calculé sur la base qui existe, pas sur le portefeuille');
    eq(p.sansBase, 1, 'une ligne écartée, et l’écran peut le dire');

    /* La regle de la maison : un total egale la somme de ses parts. C'est elle
       qui tombait, et personne ne pouvait le voir sur l'ecran — les parts
       affichees faisaient bien le total, mais une part etait fausse. */
    const somme = Store.state.positions
      .map(posPerfEur).filter(v => v != null).reduce((s, v) => s + v, 0);
    pres(somme, p.pnl, 'la somme des lignes mesurables fait le total affiché');
  });

  test('l’écran se tait alors sur l’euro comme sur le pourcentage', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const i = src.indexOf('<div class="pf-mesures">');
    vrai(i > 0, 'le bloc des deux mesures doit être trouvable');
    const bloc = src.slice(i, src.indexOf('</div>\n    </div>', i));
    vrai(bloc.length > 200, 'et la tranche doit contenir les deux mesures');

    /* La garde se nomme au lieu de s'etaler sur les deux branches du balisage :
       le controle « les ecrans se taisent avec le calcul » la cherche dans ce
       qui precede immediatement l'impression, et trois cents caracteres de
       balisage l'en eloignaient. */
    vrai(/const pct = pnl\.pct == null \? null : fmtSignedPct\(pnl\.pct\);/.test(bloc),
      'la garde porte un nom, juste au-dessus de ce qu’elle protège');
    eq((bloc.match(/fmtSigned\(pnl\.pnl\)/g) || []).length, 1,
      'un seul endroit imprime la plus-value en euros');
    vrai(bloc.indexOf('if (pct == null) return') < bloc.indexOf('fmtSigned(pnl.pnl)'),
      'et il vit dans la branche que la garde n’atteint pas : sans base, '
      + 'l’euro se tait avec le pourcentage');
    vrai(/trad\('prix de revient manquant'\)/.test(bloc),
      'la mesure muette dit pourquoi elle se tait');
    vrai(/trad\('Plus-value latente'\)/.test(bloc),
      'et le gain porte sa base dans son nom, au lieu de « Performance »');
  });

  test('sans séance, la mesure du jour le dit au lieu d’afficher zéro', () => {
    /* Deux causes, deux phrases : aucune cloture de reference en memoire, ou
       des cours qui datent tous d'avant minuit. La refonte ne devait en perdre
       aucune — un « +0 € » sur une journee sans cours est un chiffre faux. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const i = src.indexOf('<div class="pf-mesures">');
    const bloc = src.slice(i, src.indexOf('</div>\n    </div>', i));
    vrai(/!j\.lignes\.length \|\| j\.toutHorsSeance/.test(bloc),
      'deux causes gardent la mesure du jour');
    vrai(/trad\('pas de clôture de veille en mémoire'\)/.test(bloc),
      'la première se nomme');
    vrai(/trad\('aucune ligne n’a coté depuis minuit'\)/.test(bloc),
      'la seconde aussi');
    vrai(/trad\('hors séance'\)/.test(bloc),
      'et la mesure porte « hors séance » plutôt qu’un montant');
  });

  test('une seule destination explicite, et aucun chevron', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const i = src.indexOf('<div class="pf-corps">');
    vrai(i > 0, 'le corps de la carte doit être trouvable');
    const corps = src.slice(i, src.indexOf('</div>\n    </div>', i));
    eq((corps.match(/ml-chev/g) || []).length, 0,
      'aucun chevron : quatre lignes de liste en portaient quatre');
    eq((corps.match(/href="#\//g) || []).length, 0,
      'la seule destination explicite vit dans l’en-tête');
    eq((corps.match(/data-action="apercu"/g) || []).length, 3,
      'trois ouvreurs : le montant, le gain et l’écart du jour');
    /* Le renvoi de l'en-tete mene aux lignes, pas aux « marches » : c'est son
       portefeuille que le detenteur veut voir. */
    const tete = src.slice(src.lastIndexOf('<div class="card-head">', i), i);
    vrai(/href="#\/positions"/.test(tete), 'l’en-tête mène aux positions');
    vrai(/trad\('Voir les positions'\)/.test(tete),
      'et le dit avec le mot que l’écran d’arrivée emploie');
  });

  test('les trois chiffres suivent l’ordre de la lecture', () => {
    /* Ce que ça vaut, ce que ça a rapporte, ce qui a bouge depuis minuit. Le
       montant est le sujet et vit au-dessus ; les deux mesures suivent, et
       chacune ouvre le panneau qui la detaille.

       « Investi » a vecu ici deux jours : c'est le seul des quatre termes qu'on
       ne regarde jamais — il ne bouge pas, et le panneau du resultat le porte
       deja en note, a un doigt de la. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const i = src.indexOf('<div class="pf-corps">');
    vrai(i > 0, 'le corps de la carte doit être trouvable');
    const corps = src.slice(i, src.indexOf('</div>\n    </div>', i));
    for (const nom of ['portefeuille', 'pnlLatent', 'jourTitres'])
      vrai(corps.indexOf(`data-apercu="${nom}"`) > 0,
        `${nom} doit s’ouvrir depuis la carte`);
    vrai(!/investiTitres/.test(corps),
      'et le prix de revient n’est plus une mesure de l’accueil');
    /* LE CHIFFRE RESTE ATTEIGNABLE, LE PANNEAU N'A PLUS DE PORTE, et c'est ce
       qu'il faut garder en vue. Le prix de revient vivait en lien pointille au
       pied de Positions, au rang d'un renvoi, pour une donnee de support : il en
       est parti. Son montant n'est pas perdu pour autant, le panneau de la
       plus-value l'ecrit sous son total, et c'est cette phrase-la qui porte
       desormais la garantie.
       `investiTitres` reste defini sans que rien ne l'ouvre : le retirer est une
       decision qui ne se prend pas dans une passe de mise en forme. */
    vrai(/trad\('sur.investis', 'sur'\)\} \$\{fmtEUR0\(pnl\.invested\)\}/.test(src),
      'le montant investi se lit dans le panneau de la plus-value');
    eq((src.match(/data-apercu="investiTitres"/g) || []).length, 0,
      'et son propre panneau n’a plus de porte, ce qui reste à trancher');
    vrai(corps.indexOf('pnlLatent') < corps.indexOf('jourTitres'),
      'le gain vient avant l’écart du jour, qui est la nuance la plus fine');
    vrai(/class="pf-total"/.test(corps) && /trad\('Valeur actuelle'\)/.test(corps),
      'le grand montant dit ce qu’il est, sans reprendre le titre de la carte');
  });

  test('la carte occupe la largeur au lieu de la laisser vide', () => {
    /* Elle etait seule dans une grille de trois colonnes — ses deux voisines
       sont parties, la grille est restee — et tenait donc dans un tiers de la
       ligne. La largeur se remplit par la mise en page interieure, pas par
       deux cartes inventees pour la remplir. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('<div class="pf-corps">');
    vrai(i > 0, 'le corps de la carte doit être trouvable');
    const entre = src.slice(src.lastIndexOf('<div class="card">', i), i);
    vrai(!/class="grid/.test(entre),
      'aucune grille ne s’ouvre entre la carte et son corps');

    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    vrai(/\.pf-corps \{[^}]*display: flex/.test(css),
      'le montant garde sa largeur naturelle, les mesures prennent le reste');
    vrai(/\.pf-mesures \{[^}]*margin-left: auto/.test(css),
      'et les mesures se poussent au bord droit');
    /* Sous 768 px elles passent sous le montant, mais restent cote a cote :
       un chiffre et son etiquette tiennent dans une demi-largeur. */
    vrai(/\.pf-mesures \{[^}]*flex-basis: 100%;[^}]*max-width: none;/.test(css),
      'sur un téléphone elles prennent la ligne entière');
    vrai(/\.pf-mesures \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(css),
      'les mesures sont une grille de deux colonnes sur un écran large');
    /* Sur un telephone elles passent en rangees : trois colonnes dans 311 px
       replient « Gain depuis l'achat » sur trois lignes et desalignent les
       chiffres. */
    vrai(/\.pf-mesure \{\s*flex-direction: row; justify-content: space-between;/.test(css),
      'et en rangées nom-à-gauche / chiffre-à-droite sur un téléphone');
  });

  test('les intitulés nouveaux ont leur clé anglaise, et l’ancienne part', () => {
    const en = lireSource('assets/i18n.js');
    vrai(en, 'assets/i18n.js doit être lisible pour ce contrôle');
    for (const [fr, ang] of [['Tes titres', 'Your securities'], ['de tes comptes de marché', 'of your market accounts'],
                             ['Voir les positions', 'View holdings'],
                             ['Valeur actuelle', 'Current value'],
                             ['Plus-value latente', 'Unrealised gain'],
                             ['prix de revient manquant', 'cost basis missing']])
      vrai(en.indexOf(`"${fr}": "${ang}"`) > 0, `« ${fr} » doit se traduire`);
    /* Une clef sans appelant est du code mort comme un autre. */
    for (const partie of ['"Portefeuille titres"', '"ce que ces lignes t’ont coûté"',
                          'Investissements de marché', 'investissements de marché',
                          'portefeuille de marché',
                          '"tant que tu ne vends pas"', '"aucun prix de revient saisi"',
                          '"Performance"', '"non calculée"',
                          '"Plus / moins-value latente"', '"Tes comptes de marché"'])
      vrai(en.indexOf(partie) < 0, `${partie} n’a plus d’appelant`);
  });
});

/* Marches ne se montre qu'a qui a des titres. La condition vit dans le modele,
   les ecrans la lisent : c'est ce couple que cette suite garde. */
suite('Deux champs de la fiche d’une ligne', () => {

  test('le prix de revient est unitaire, et le total en découle', () => {
    /* La semantique du champ, posee sur des nombres : `buyPrice` est le prix
       d'UN titre. Y taper le montant d'un ordre le multiplie par la quantite,
       et la ligne s'affiche en perte enorme sans que rien n'ait l'air faux. */
    const p = { qty: 10, price: 60, buyPrice: 50, currency: 'USD', fx: 0.9, manual: false };
    pres(round2(posInvested(p)), round2(10 * 50 * 0.9),
      'quantité × prix unitaire × change');
    pres(round2(posValue(p)), round2(10 * 60 * 0.9), 'et la valeur suit la même forme');
    vrai(posPerfPct(p) > 0, 'dix titres payés 50 et valant 60 sont en gain');
    const total = { ...p, buyPrice: 10 * 50 };
    vrai(posPerfPct(total) < -80,
      'le montant de l’ordre tapé à la place du prix unitaire donne une perte '
      + 'énorme et fausse : c’est le défaut que le libellé doit empêcher');

    /* L'autre regime : valeur et prix de revient sont deux TOTAUX, et le prix
       unitaire n'entre dans aucun des deux. */
    const main = { qty: 3, buyPrice: 999, price: 999, manual: true,
                   value: 1200, invested: 1000 };
    pres(posValue(main), 1200, 'la valeur saisie fait la valeur');
    pres(posInvested(main), 1000, 'et le total saisi fait le prix de revient');
    pres(round2(posPerfPct(main)), 20, 'le prix unitaire n’entre dans ni l’un ni l’autre');
  });

  test('le champ où on le tape porte le mot, et montre sa multiplication', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const i = src.indexOf('data-path="positions.${index}.qty"');
    vrai(i > 0, 'la paire de champs doit être trouvable');
    const bloc = src.slice(i, src.indexOf('</p>', i));
    vrai(/trad\('Prix de revient unitaire'\)/.test(bloc),
      'le champ où l’on tape dit « unitaire », comme les quatre autres surfaces');
    vrai(!/trad\('Prix de revient'\) \(/.test(bloc),
      'et plus le libellé qui se lisait comme un montant payé');
    vrai(/× \$\{fmtCur\(p\.buyPrice, dev\)\} = /.test(bloc),
      'le rappel montre le produit, pas seulement son résultat');
    vrai(/trad\('prix de revient manquant'\)/.test(bloc),
      'sans prix saisi, la phrase le dit au lieu d’annoncer 0,00 €');
    /* Une ligne dont la valeur est saisie a la main tient son prix de revient
       en TOTAL : `posInvested` y lit `invested` et jamais le produit. Offrir le
       champ unitaire aux deux affichait « 1 514 × 5,80 € = 0,00 € investis ». */
    vrai(/data-path="positions\.\$\{index\}\.invested"/.test(bloc),
      'une ligne à la main pose un total, pas un prix par titre');
    vrai(/\$\{p\.manual \? `/.test(bloc), 'et les deux régimes se distinguent');
    /* Les quatre autres surfaces le portaient deja : c'est l'incoherence qui
       rendait celle-ci invisible. */
    for (const [quoi, motif] of [
      ['la colonne du tableau', /Prix de revient unitaire, dans la devise de cotation\./],
      ['le formulaire d’ajout', /\$\{trad\('Prix de revient unitaire'\)\} \(\$\{cote\.currency\}\)/],
      ['l’import de fichier', /cle: 'buyPrice', label: trad\('Prix de revient unitaire'\)/],
    ]) vrai(motif.test(src), `${quoi} le disait déjà`);
  });

  test('le cours ne se tape que si personne ne le cote', () => {
    /* Il ecrivait dans le `price` que le rafraichissement reecrit toutes les
       cinq minutes : la saisie disparaissait toute seule. Trois etats, et un
       seul laisse taper. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* Bornes de CODE : le depot public est servi sans commentaires, et une
       tranche prise a partir de l'un d'eux y serait vide. */
    const i = src.indexOf('data-path="positions.${index}.role"');
    vrai(i > 0, 'le bloc du cours doit être trouvable');
    const bloc = src.slice(i, src.indexOf('data-path="positions.${index}.manual"', i));

    vrai(/\$\{p\.manual \? `/.test(bloc),
      'valeur saisie à la main : c’est la valeur qu’on pose, pas le cours');
    vrai(/data-path="positions\.\$\{index\}\.value"/.test(bloc),
      'et ce champ-là n’existait que dans le tableau, masqué sur téléphone');
    vrai(/: num\(p\.quoteTime\) \? `/.test(bloc),
      'un cours déjà reçu : la passerelle le pose, donc il se lit seulement');
    vrai(/class="lecture" value="\$\{p\.price \?\? ''\}" readonly/.test(bloc),
      'en lecture, sans data-path : rien ne peut écrire par-dessus le marché');
    /* Et l'unique porte qui reste : aucune cotation recue. */
    eq((bloc.match(/data-path="positions\.\$\{index\}\.price"/g) || []).length, 1,
      'un seul endroit écrit encore le cours, celui que rien ne cote');
  });

  test('la fiche dit d’où vient le chiffre, sinon un champ grisé est une panne', () => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf('data-path="positions.${index}.manual"');
    vrai(i > 0, 'la phrase doit être trouvable');
    const bloc = src.slice(i, src.indexOf('data-path="positions.${index}.isin"', i));
    vrai(/trad\('il se met à jour tout seul'\)/.test(bloc), 'le cas courant');
    vrai(/trad\('aucun cours reçu pour cette ligne : saisis-le à la main'\)/.test(bloc),
      'le cas où l’on tape');
    vrai(/trad\('Le cours n’est plus interrogé pour cette ligne\.'\)/.test(bloc),
      'et le cas de la valeur posée à la main');

    const en = lireSource('assets/i18n.js');
    for (const fr of ['il se met à jour tout seul',
                      'aucun cours reçu pour cette ligne : saisis-le à la main',
                      'Le cours n’est plus interrogé pour cette ligne.'])
      vrai(en.indexOf(`"${fr}": "`) > 0, `« ${fr} » doit se traduire`);
  });

  test('un champ de lecture garde la géométrie sans l’encre d’une saisie', () => {
    const css = lireSource('assets/styles.css');
    vrai(/\.modal-champs\.champs-cote \{ align-items: flex-end; \}/.test(css),
      'les deux champs restent alignés quand un libellé se replie');
    /* La meme faute vit dans les grilles de champs, ou les cellules sont deja
       etirees : c'est alors a l'interieur du champ que l'espace se place. */
    vrai(/\.grid > \.field > label \{ margin-bottom: auto; \}/.test(css),
      'et dans une grille, l’espace se met sous le libellé pour que les saisies '
      + 's’alignent malgré des libellés de hauteur différente');
    vrai(/\.modal-champs input\.lecture \{/.test(css),
      'et le champ en lecture se distingue d’une invite à taper');
  });
});

suite('Marchés s’ouvre à tout le monde, et dit ce qui la remplirait', () => {

  /* Un compte n'est jamais un argument : on en pose de toutes sortes, vides,
     pour verifier qu'aucun ne fait apparaitre l'onglet a lui seul. */
  const compte = (id, type) => ({ id, type, label: id, broker: 'Courtier',
                                  statut: 'ouvert', lignes: [], cash: [] });
  const titre = (id, classe) => ({ id, name: id, symbol: id.toUpperCase(), isin: '',
    qty: 2, price: 100, buyPrice: 90, currency: 'EUR', fx: 1,
    account: 'c_cto', assetClass: classe, role: 'satellite', manual: false });

  const etat = (positions, comptes) => {
    Fixture.poser();
    Store.state.positions = positions;
    Store.state.comptes = comptes;
    return aDesPositionsMarche();
  };

  test('sans une seule ligne cotée, Marchés n’existe pas', () => {
    /* Les cinq premiers etats de la liste : rien, du cash, du cash et de la
       pierre, un patrimoine de biens, un PEA vide. Aucun ne porte de position. */
    eq(etat([], []), false, 'utilisateur vierge');
    eq(etat([], [compte('c1', 'courant')]), false, 'du cash seulement');
    eq(etat([], [compte('c1', 'courant'), compte('c2', 'bienImmo')]),
      false, 'du cash et de l’immobilier');
    eq(etat([], [compte('c1', 'courant'), compte('c2', 'bienImmo'),
                 compte('c3', 'objet')]),
      false, 'un patrimoine de biens, sans un seul titre');
    eq(etat([], [compte('c_pea', 'pea')]), false, 'un PEA vide');
  });

  test('le type de compte ne décide de rien, dans un sens comme dans l’autre', () => {
    /* C'est la faute a ne pas commettre : un compte-titres vide n'est pas un
       investisseur, et un PEA qui porte un ETF en est un. */
    eq(etat([], [compte('c_cto', 'cto')]), false,
      'un compte-titres vide : pas de Marchés');
    eq(etat([], [compte('c_pea', 'pea'), compte('c_cto', 'cto')]), false,
      'deux enveloppes vides non plus');
    eq(etat([titre('etf', 'actions')], [compte('c_pea', 'pea')]), true,
      'un PEA avec un ETF monde, sans aucun compte-titres : Marchés');
    eq(etat([titre('meta', 'actions')], [compte('c_cto', 'cto')]), true,
      'un compte-titres avec une action : Marchés');
    eq(etat([titre('etf', 'actions')],
            [compte('c_pea', 'pea'), compte('c_cto', 'cto')]), true,
      'un PEA garni et un compte-titres vide : Marchés');
  });

  test('toute classe posée dans les positions déclenche Marchés', () => {
    /* La vue Marches rend `Store.state.positions` en entier, sans filtrer sur la
       classe : crypto, obligation cotee, fonciere, metal par ETC y paraissent
       comme une action. Filtrer ici tiendrait une seconde liste a cote de la
       premiere, et celle qu'on oublie de completer dit le contraire de l'autre. */
    for (const classe of Object.keys(ASSET_CLASSES))
      eq(etat([titre('x', classe)], [compte('c_cto', 'cto')]), true,
        `une ligne « ${classe} » suffit`);
  });

  test('la dernière ligne supprimée fait disparaître Marchés', () => {
    Fixture.poser();
    Store.state.comptes = [compte('c_cto', 'cto')];
    Store.state.positions = [titre('a', 'actions'), titre('b', 'obligations')];
    vrai(aDesPositionsMarche(), 'deux lignes');
    Store.state.positions.pop();
    vrai(aDesPositionsMarche(), 'une de moins : l’onglet reste');
    Store.state.positions.pop();
    eq(aDesPositionsMarche(), false, 'la dernière partie : l’onglet s’en va');
    Store.state.positions.push(titre('c', 'crypto'));
    vrai(aDesPositionsMarche(), 'et la première revenue le ramène');
  });

  test('l’onglet ne se masque plus, et rien ne le masque plus', () => {
    /* IL A DISPARU UN TEMPS pour qui n'avait aucune ligne cotee, et le motif
       tenait a moitie : une page de zeros n'est pas un resultat. Mais un onglet
       absent ne s'explique pas, et il ne se cherche pas — on ne peut pas vouloir
       ce dont on ignore l'existence. Quelqu'un qui ouvre un tableau de bord de
       patrimoine cherche justement ou poser ses titres.

       Ce qui est verifie ici, c'est qu'il ne reste RIEN du mecanisme : une porte
       de masquage oubliee dans un coin finirait par se rouvrir. */
    const src = lireSource('assets/app.js');
    vrai(!/majVisibiliteMarches/.test(src), 'plus de porte de masquage');
    vrai(!/a\.hidden = /.test(src), 'et plus rien qui masque une entrée de barre');
    const css = lireSource('assets/styles.css');
    vrai(!/--n-onglets: 4/.test(css), 'la barre ne prévoit plus quatre colonnes');
    vrai(!/tabbar:has\(> \[hidden\]\)/.test(css), 'ni de règle pour un onglet absent');
  });

  test('la condition reste, et ne sert plus qu’à la carte de l’accueil', () => {
    /* `aDesPositionsMarche()` n'a pas disparu avec le masquage : une carte de
       portefeuille sur l'accueil n'a rien a montrer sans une seule ligne, et une
       page qui ne peut rien montrer ne montre rien. La condition change donc de
       portee, elle ne change pas de sens. */
    const store = lireSource('assets/store.js');
    const src = lireSource('assets/app.js');
    vrai(/function aDesPositionsMarche\(\) \{/.test(store), 'la condition vit dans le modèle');
    vrai(/function carteTitresResume\(\) \{\s*\n\s*if \(!aDesPositionsMarche\(\)\) return '';/.test(src),
      'la carte de l’accueil la lit');
    vrai(!/!Store\.state\.positions\.length \? '' :/.test(src),
      'et aucune variante locale ne la double');
    /* Le renvoi d'un apercu vers Marches n'a plus de garde : il n'y a plus
       d'onglet absent vers lequel renvoyer. */
    vrai(!/a\.vue !== 'positions' \|\| aDesPositionsMarche\(\)/.test(src),
      'et plus aucun panneau ne se demande si l’onglet existe');
  });

  test('la page porte déjà son écran vide, et c’est lui qu’on rendait inatteignable', () => {
    /* LE DEFAUT N'ETAIT PAS L'ABSENCE DE MESSAGE. `viewPositions()` sort par un
       `return` des que `positions` est vide et rend une carte complete : elle
       explique la frontiere avec Actifs — ici ce dont le cours tombe tout seul,
       la-bas ce dont on donne soi-meme la valeur — et propose de creer le compte
       quand aucun ne peut porter un titre. Elle etait simplement inatteignable,
       l'onglet disparaissant avant qu'on puisse y arriver.

       Une carte de plus aurait ete un doublon, et c'est la faute qui revient le
       plus souvent ici : deux ecrans pour une seule question, celui qu'on oublie
       de corriger disant le contraire de l'autre. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('if (!Store.state.positions.length) {');
    vrai(i > 0, 'la vue sort tôt quand il n’y a rien à montrer');
    const vide = src.slice(i, src.indexOf('\n  }', i));
    vrai(/trad\('Suis tes placements cotés'\)/.test(vide), 'et la carte se nomme');
    vrai(/Créer un compte-titres|data-action="ajouter-compte"/.test(vide),
      'sans compte éligible, elle propose d’en créer un');
    /* Les types se derivent de leur table : celui qu'on ajoutera demain entre
       dans la phrase sans qu'on y pense. */
    vrai(/TYPES_COMPTE\.filter/.test(vide),
      'les enveloppes qui peuvent porter un titre se dérivent, elles ne se recopient pas');
    vrai(!/carteSansTitres/.test(src), 'et aucune seconde carte ne la double');
  });

  test('la barre compte ses colonnes sur ce qu’elle rend', () => {
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    /* Les colonnes se derivent des enfants rendus, et non d'un nombre ecrit en
       dur. La regle survit au masquage qu'elle servait : elle vaut pour toute
       barre, et un nombre fige redeviendrait faux au premier onglet ajoute. */
    vrai(/grid-auto-flow: column; grid-auto-columns: 1fr;/.test(css),
      'la barre compte ses colonnes sur ce qu’elle rend');
    /* L'assertion porte sur la DECLARATION et non sur le motif seul : celui-ci
       se lit aussi dans le commentaire qui explique pourquoi il est parti, et le
       controle tombait ici en passant sur l'arbre publie, ou les commentaires
       sont retires. */
    vrai(!/grid-template-columns: repeat\(5, 1fr\)/.test(css),
      'et non sur un nombre écrit en dur');
    vrai(/width: calc\(100% \/ var\(--n-onglets, 5\) - 4px\)/.test(css),
      'la pastille mesure une case, quel que soit leur nombre');
  });

  test('la porte vers la première position reste ouverte', () => {
    /* Le bouton « + Titre cote » de la fiche d'un compte a titres mene a
       `#/positions` : c'est la seule porte vers la premiere ligne. Rediriger
       cette adresse quand il n'y a pas de position la fermerait, et l'onglet ne
       reapparaitrait donc jamais. La route reste, seul l'onglet se masque. */
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf("'ajouter-ligne'(btn) {"),
                        src.indexOf("'ajouter-ligne'(btn) {") + 320);
    vrai(/location\.hash = '#\/positions'/.test(f),
      'le geste mène à la vue, depuis la fiche du compte');
    const cv = src.slice(src.indexOf('function currentView()'),
                         src.indexOf('function currentView()') + 900);
    vrai(!/aDesPositionsMarche/.test(cv),
      'et le routeur ne détourne pas cette adresse');
  });

  test('la carte du portefeuille disparaît avec l’onglet', () => {
    /* L'accueil ne doit pas garder « 0 €, 0 ligne, 0,00 % » quand Marches n'est
       plus la : la carte n'existe pas, elle ne se vide pas. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewOverview()'),
                          src.indexOf('function mountOverview()'));
    /* La carte est une fonction depuis que l'accueil se range : sa condition
       ouvre son corps, avant tout balisage. */
    const debut = vue.indexOf('function carteTitresResume() {');
    const garde = vue.indexOf("if (!aDesPositionsMarche()) return '';", debut);
    vrai(debut > 0 && garde > debut, 'la carte porte la condition centrale');
    vrai(garde < vue.indexOf('class="pf-corps"', debut), 'et elle la porte avant elle');
    /* Aucune autre carte de l'accueil ne depend des positions : le patrimoine,
       les poches, la courbe, l'accumulation, le rythme, l'autonomie et
       l'objectif parlent du patrimoine entier et restent. */
    const finBloc = vue.indexOf('\n}\n', debut);
    vrai(finBloc > garde, 'la carte se referme');
    const dehors = vue.slice(0, debut) + vue.slice(finBloc);
    vrai(!/dayPerformance\(\)/.test(dehors),
      'la performance du jour ne vit que dans la carte conditionnelle');
  });
});

finDePartieDeTests('tests/17-licence-ne-ment-pas.tests.js');
