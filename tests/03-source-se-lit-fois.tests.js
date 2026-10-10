partieDeTests('tests/03-source-se-lit-fois.tests.js');
/* ------------------------------------------------------------------
   7 bis. Le source lui-même
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   Le harnais : lire une source une fois, et savoir dire « partiel »
   ------------------------------------------------------------------ */
suite('Une source se lit une fois, et un vert partiel se dit', () => {

  test('un fichier lu deux fois ne part qu’une fois sur le réseau', () => {
    /* Cinq cent douze lectures partaient d'ici, dont trois cent quarante-six
       sur `app.js`, qui pese pres d'un mega-octet : trois cent quarante
       mega-octets relus en XHR synchrone a chaque execution. La suite mettait
       cent douze secondes, et une lecture tombait de temps en temps — « Failed
       to execute 'send' » — sur un test qui changeait a chaque fois.

       Le defaut n'etait pas dans un controle, il etait dans le NOMBRE de
       lectures. Retenues, la suite tient en trois secondes et demie et le rouge
       transitoire perd sa cause. */
    const avant = SOURCES.size;
    const un = lireSource('assets/i18n.js');
    vrai(un && SOURCES.has('assets/i18n.js'), 'la première lecture remplit la mémoire');
    const taille = SOURCES.size;
    const deux = lireSource('assets/i18n.js');
    eq(deux, un, 'la seconde lecture rend exactement le même texte');
    eq(SOURCES.size, taille, 'et n’ajoute rien : elle n’est pas partie sur le réseau');
    vrai(taille >= avant, 'la mémoire ne se vide pas en cours de route');
  });

  test('un échec de lecture ne se retient pas', () => {
    /* Retenir un `null` le resservirait a toutes les suites suivantes : un
       incident de reseau deviendrait une cascade, et le vrai defaut serait
       introuvable sous les degats derives. */
    const t = lireSource('tests/store.tests.js');
    vrai(t, 'le fichier de suites doit être lisible');
    vrai(/if \(texte !== null\) SOURCES\.set\(fichier, texte\);/.test(t),
      'seul un texte obtenu entre en mémoire');
    vrai(/r\.open\('GET', fichier \+ '\?lint=' \+ Date\.now\(\), false\);/.test(t),
      'le casse-cache reste : la PREMIÈRE lecture ne doit pas servir une copie d’avant');
  });

  test('une sélection par nom réduit, une sélection vide se refuse', () => {
    /* `choisir` ne joue rien : il rend la liste. On peut donc l'interroger
       depuis un test sans relancer la suite dans la suite. */
    const tout = Tests.choisir();
    vrai(tout.length > 100, 'la suite complète compte plus de cent suites');
    const credit = Tests.choisir({ nom: 'crédit' });
    vrai(credit.length > 0 && credit.length < tout.length,
      'un motif désigne un sous-ensemble, ni vide ni total');
    for (const s of credit) {
      vrai(/crédit/i.test(s.nom), `« ${s.nom} » ne porte pas le motif`);
    }
    eq(Tests.choisir({ nom: 'zzzinexistant' }).length, 0,
      'un motif qui ne matche rien rend zéro, et la page en fait une erreur');
  });

  test('« touche » se dérive du corps des suites, il ne se recopie pas', () => {
    /* Une liste ecrite a la main de « quelles suites lisent app.js » aurait
       menti au premier test deplace. Le corps de chaque suite est retenu sous
       forme de texte, et la question se pose au texte. */
    const tout = Tests.choisir();
    const app = Tests.choisir({ touche: 'assets/app.js' });
    vrai(app.length > 0 && app.length < tout.length,
      'un fichier désigne les suites qui le lisent');
    for (const s of app) {
      vrai(s.source.includes("lireSource('assets/app.js'"),
        `« ${s.nom} » ne lit pas app.js`);
    }

    /* `calcul` est le COMPLEMENT : ce qui ne lit aucune source, donc ce qui
       fait tourner le modele sur des nombres. Aucun nom de fichier ne le
       designe, et c'est pourtant la moitie qui compte quand un calcul change. */
    const calcul = Tests.choisir({ touche: 'calcul' });
    vrai(calcul.length > 0, 'le modèle a ses suites');
    for (const s of calcul) {
      vrai(!s.source.includes('lireSource('),
        `« ${s.nom} » lit une source : elle n’est pas du calcul pur`);
    }
    /* Les deux familles ne se recouvrent pas, et aucune suite n'est perdue :
       une suite lit une source, ou elle n'en lit pas. */
    const noms = new Set(calcul.map(s => s.nom));
    vrai(!app.some(s => noms.has(s.nom)), 'les deux familles sont disjointes');
    const lisant = tout.filter(s => s.source.includes('lireSource('));
    eq(lisant.length + calcul.length, tout.length,
      'et ensemble elles couvrent toute la suite');
  });

  test('un vert partiel se dit partiel, et ne peut pas garder un envoi', () => {
    /* Le point entier du mecanisme. Le lanceur ne lit que le titre de
       l'onglet : un vert partiel presente comme un vert autoriserait un envoi
       sur du code que rien n'a verifie. Trois pieces, et il faut les trois. */
    const page = lireSource('tests.html');
    vrai(page, 'tests.html doit être lisible');
    vrai(/Tests\.run\(selection\)/.test(page),
      'la page passe la sélection au harnais');
    vrai(/r\.partiel \? ' \(PARTIEL\)' : ''/.test(page),
      'et le titre porte le mot quand l’exécution est ciblée');

    const h = lireSource('tests/harness.js');
    vrai(/const partiel = !!\(selection\.nom \|\| selection\.touche\);/.test(h),
      'le harnais sait qu’il a été ciblé');
    vrai(/total: ok \+ ko, partiel/.test(h),
      'et il le fait voyager avec le résultat');

    /* Cote lanceur : le mot devient un code de sortie qui n'est pas zero, donc
       le `&&` d'un push ne passe pas. La regle cesse d'etre une promesse. */
    const lanceur = lireSource('executer-tests.py');
    vrai(lanceur, 'executer-tests.py doit être lisible');
    vrai(/PARTIEL = "\(PARTIEL\)"/.test(lanceur),
      'le lanceur cherche le même mot que celui que la page écrit');
    const bloc = lanceur.slice(lanceur.indexOf('elif titre.startswith(OK) and PARTIEL in titre:'),
                               lanceur.indexOf('elif titre.startswith(OK):'));
    vrai(bloc.length > 50, 'la branche du partiel doit être trouvable');
    vrai(/code = 2/.test(bloc), 'un vert partiel sort en 2, jamais en 0');
    /* Et le zero reste reserve au vert complet : c'est la branche d'apres. */
    const complet = lanceur.slice(lanceur.indexOf('elif titre.startswith(OK):'),
                                  lanceur.indexOf('else:', lanceur.indexOf('elif titre.startswith(OK):')));
    vrai(/code = 0/.test(complet), 'et le zéro reste réservé au vert complet');
  });

  test('une suite verte et complète joue aussi les parcours de la vue', () => {
    /* La suite ne charge pas la vue : seuls les parcours de `parcours.py`
       cliquent pour de vrai. Ils ne jouent qu'apres un vert complet et des
       routes saines, et leur echec rend le code 1 : un geste casse ne passe
       pas un push. */
    const t = lireSource('executer-tests.py');
    vrai(/^import parcours$/m.test(t), 'le lanceur charge les parcours');
    const i = t.indexOf('routes rendues sans erreur');
    const suite = t.slice(i, t.indexOf('finally:', i));
    vrai(/parcours\.jouer\(/.test(suite), 'il les joue après des routes saines');
    vrai(/if fautes:[\s\S]*?code = 1/.test(suite), 'et leur échec rend le code 1');
    const p = lireSource('parcours.py');
    vrai(p, 'parcours.py doit être lisible');
    const n = (p.match(/^    \(\n        "/gm) || []).length;
    vrai(n >= 4, `au moins quatre gestes sont joués, ${n} le sont`);
    vrai(/for langue in \("fr", "en"\)/.test(p) && /_charger\(onglet, base, route, vue, 390\)/.test(p),
      'et chaque route se mesure à 390 px, dans les deux langues');
  });

  test('une option mal orthographiée se refuse au lieu de tout jouer', () => {
    /* Un `--touch` ignore en silence ferait tourner la suite entiere en
       laissant croire a un ciblage, ou l'inverse. Et il se refuse AVANT le
       serveur : une faute de frappe ne doit pas couter un demarrage. */
    const t = lireSource('executer-tests.py');
    vrai(/sys\.exit\(f"option inconnue : \{drapeau\}/.test(t),
      'un drapeau inconnu arrête le script');
    vrai(/sys\.exit\(f"\{drapeau\} attend une valeur"\)/.test(t),
      'et un drapeau sans valeur aussi');
    const corps = t.slice(t.indexOf('def main():'));
    vrai(corps.indexOf('cible = selection()') < corps.indexOf('serveur = None'),
      'les arguments se lisent avant que quoi que ce soit ne démarre');
  });
});

/* ------------------------------------------------------------------
   Changer de périmètre transforme les anneaux, il ne les remplace pas
   ------------------------------------------------------------------ */
suite('Les anneaux d’Allocation se transforment quand le périmètre change', () => {

  const ch = () => lireSource('assets/charts.js');
  const anneau = () => {
    const t = ch();
    return t.slice(t.indexOf('function donut(el, opts)'), t.indexOf('function rankedBars'));
  };

  test('la transition part des montants, pas des angles', () => {
    /* Interpoler les angles serait plus court et faux : une part qui garde son
       montant verrait quand meme son arc bouger, puisque le total change. En
       partant des montants, chaque part suit ce qu'elle vaut a chaque image et
       la somme des arcs fait toujours le tour complet. */
    const t = anneau();
    vrai(t.length > 1000, 'la fonction doit être trouvable');
    vrai(/valeur: valeur\(avant\.parts, k\)\s*\+ \(valeur\(parts, k\) - valeur\(avant\.parts, k\)\) \* e/.test(t),
      'chaque image interpole un montant');
    /* Une seule ecriture de la geometrie, pour le dessin ET pour la transition :
       deux copies auraient fini par se decaler d'un demi degre. */
    /* L'ancrage porte sur le NOM, pas sur la liste des parametres : celle-ci
       s'est elargie le jour ou le remplissage d'arrivee a eu besoin d'un tour
       partiel, et le controle est tombe pour une signature, pas pour un defaut. */
    eq((t.match(/const tracer = \(/g) || []).length, 1,
      'la géométrie est écrite une fois');
    /* Trois sites d'appel : le dessin d'arrivee, chaque image de la transition
       de perimetre, chaque image du remplissage. Le repose de la fin rejoue les
       arcs deja calcules plutot que de retracer. */
    eq((t.match(/tracer\(/g) || []).length, 3,
      'et elle sert au dessin comme à chaque image des deux mouvements');
  });

  test('l’anneau se remplit à l’arrivée, comme les jauges poussent', () => {
    /* Les jauges de la page poussent deja de zero sous `.vue-entre` ; l'anneau
       etait le seul a se poser d'un coup au milieu de barres qui grandissent.

       L'arrivee se lit sur le DOM et non sur un second drapeau : `render()`
       pose la classe sur le conteneur de la vue avant d'y ecrire les cartes. */
    const t = anneau();
    vrai(/if \(entree === null\) entree = !!\(el\.closest && el\.closest\('\.vue-entre, \.angle-entre'\)\);/.test(t),
      'l’arrivée se lit sur la classe que render() pose déjà, ou sur celle de l’angle choisi');
    /* Decide au PREMIER rendu puis consomme : `mount` rejoue la fonction a
       chaque redimensionnement, et se remplir a nouveau parce qu'on a tourne le
       telephone serait un clignotement. */
    vrai(/let entree = null;/.test(t) && /\n      entree = false;/.test(t),
      'décidé au premier rendu, puis consommé');
    vrai(/if \(entree && !anime && !mouvementRefuse\(\)\) remplir\(\);/.test(t),
      'jamais en même temps que la transition de périmètre, et jamais si le système refuse le mouvement');
  });

  test('le remplissage garde les proportions, et le grand arc suit ce qui est tracé', () => {
    const t = anneau();
    /* Les parts gardent leurs proportions definitives pendant tout le
       remplissage : les faire grandir ensemble aurait donne un anneau dont les
       parts changent de taille en se remplissant, donc une repartition qui
       bouge alors que rien ne bouge. C'est le FRONT qui avance, et chaque part
       est coupee dessus. */
    vrai(/const front = DEBUT \+ Math\.min\(1, Math\.max\(0, avance\)\) \* Math\.PI \* 2;/.test(t),
      'un front avance sur le tour');
    vrai(/const d0 = Math\.min\(a0, front\), d1 = Math\.min\(a1, front\);/.test(t),
      'et chaque part est coupée dessus');

    /* Le drapeau du grand arc se lit sur la portion REELLEMENT tracee. Sur la
       part entiere — l'ancienne ecriture, `frac > 0.5` — une grosse part coupee
       a moins d'un demi-tour aurait peint son complementaire : l'anneau se
       serait rempli a l'envers pendant quelques images. */
    vrai(/const large = \(d1 - d0\) > Math\.PI \? 1 : 0;/.test(t),
      'le grand arc se lit sur la portion tracée, pas sur la part entière');
    vrai(!/const large = frac > 0\.5/.test(t),
      'et surtout pas sur la part entière, qui peindrait le complémentaire');

    /* Vide des le temps de calcul qui ecrit le SVG : sans cette premiere pose,
       l'anneau complet s'afficherait une image avant de disparaitre. */
    /* La tranche s'arrete a `animerDepuis` : les deux mouvements finissent par
       la meme paire d'appels, et une tranche plus large aurait pu la trouver
       chez le voisin. */
    const bloc = t.slice(t.indexOf('function remplir()'), t.indexOf('function animerDepuis(avant)'));
    vrai(bloc.length > 300, 'la fonction de remplissage doit être trouvable');
    /* Les deux appels ADJACENTS, dans cet ordre. Chercher le premier
       `requestAnimationFrame(pas)` trouvait l'appel recursif ecrit dans `pas`
       lui-meme, qui precede la pose : le controle tombait sur une lecture, pas
       sur un defaut. */
    vrai(/poser\(0\);\s+requestAnimationFrame\(pas\);/.test(bloc),
      'la première pose précède la boucle : pas d’image d’anneau plein');
  });

  test('l’anneau part avec les jauges, et ne peut pas dériver d’elles', () => {
    /* Deux fichiers doivent s'accorder : le CSS fait pousser les barres de la
       page, le JavaScript remplit l'anneau. Des valeurs differentes donneraient
       une arrivee ou l'anneau part avant ou apres ses voisines, et rien ne le
       dirait. Le controle les confronte. */
    const t = anneau();
    const m = t.match(/const RETARD = (\d+), DUREE = (\d+);/);
    vrai(m, 'le retard et la durée du remplissage doivent être trouvables');
    const css = lireSource('assets/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const regle = css.slice(css.indexOf('@keyframes barre-pousse'),
                            css.indexOf('@keyframes barre-pousse') + 400);
    const j = regle.match(/animation: barre-pousse ([\d.]+)s [^;]*?([\d.]+)s backwards/);
    vrai(j, 'la règle des jauges doit être trouvable');
    eq(Number(m[2]) / 1000, Number(j[1]), 'même durée que les jauges');
    eq(Number(m[1]) / 1000, Number(j[2]), 'même retard que les jauges');
  });

  test('le nombre au centre ne s’anime pas', () => {
    /* Un montant intermediaire, qui n'a jamais ete vrai, resterait lisible une
       demi seconde. C'est la meme regle que les graduations de la pile, qui se
       deplacent sans que leur libelle change. */
    const t = anneau();
    const boucle = t.slice(t.indexOf('const poser = (frac)'), t.indexOf('const finir = ()'));
    vrai(boucle.length > 100, 'la boucle d’images doit être trouvable');
    vrai(!/donut-val|centerValue|kEur/.test(boucle),
      'aucune image ne réécrit le montant du centre');
  });

  test('« rien n’a bougé » compare les longueurs, et c’est le cœur du contrôle', () => {
    /* Le defaut, trouve a la mesure et pas a l'oeil. La garde parcourait la
       liste de DEPART et s'arretait a sa fin. Au retour vers le perimetre
       large, les poches financieres gardent leurs montants au centime pres et
       une poche s'AJOUTE : les anciennes s'accordaient donc toutes, la garde
       concluait « identique », et la part qui apparaissait se posait d'un coup.

       Mesure a l'appui : une seule forme distincte sur quatre-vingt-onze
       images, la ou l'aller en montrait cinquante-trois. Deux anneaux sur trois
       etaient muets au retour, et le troisieme animait seulement parce que son
       classement change d'ordre. */
    const t = anneau();
    const garde = t.slice(t.indexOf('if (avant.parts.length === parts.length'),
                          t.indexOf('const valeur = (liste, k)'));
    vrai(garde.length > 50, 'la garde doit être trouvable');
    vrai(/avant\.parts\.length === parts\.length/.test(garde),
      'les deux listes doivent d’abord avoir la même longueur');
    /* Et la comparaison parcourt la liste d'ARRIVEE : parcourir celle de depart
       est exactement la faute ci-dessus. */
    vrai(/parts\.every\(\(p, i\) => avant\.parts\[i\]/.test(garde),
      'la comparaison parcourt la liste d’arrivée');
    vrai(!/avant\.parts\.every/.test(garde),
      'et surtout pas celle de départ, qui s’arrête avant la part qui s’ajoute');
  });

  test('une part qui s’en va est tenue, puis retirée, et ne répond à rien', () => {
    /* Elle garde son rang le temps du mouvement : posee en fin de liste, une
       grosse part qui disparait sauterait d'un quart de tour a la premiere
       image avant de se retracter, et on lirait une rotation la ou il n'y en a
       pas. */
    const t = anneau();
    vrai(/const suivante = cles\.slice\(cles\.indexOf\(k\) \+ 1\)\.find\(x => noeud\.has\(x\)\)/.test(t),
      'elle se replace derrière la survivante qui la précédait');
    vrai(/for \(const t of temporaires\) t\.remove\(\);/.test(t),
      'et elle est retirée à la fin du mouvement');
    /* Sans classe `slice` ni `data-i` : les infobulles sont branchees sur les
       parts d'arrivee, et une part fantome qui repondrait au survol annoncerait
       un montant qui n'existe plus. */
    const pose = t.slice(t.indexOf('const temporaires = [];'), t.indexOf('const DUREE = 520;'));
    vrai(pose.length > 100, 'la pose des parts temporaires doit être trouvable');
    vrai(!/setAttribute\('class'|classList\.add|data-i/.test(pose),
      'une part temporaire ne porte ni la classe ni l’indice des parts vivantes');
  });

  test('le registre est partagé, donc il dit de quel genre il se souvient', () => {
    /* `dernierTrace` est clefe par identifiant et sert a tous les graphiques.
       Deux dessins de natures differentes qui porteraient le meme identifiant
       se liraient l'un l'autre, et l'animation partirait de nombres qui ne
       veulent rien dire a cet endroit. */
    const t = ch();
    vrai(/genre: 'aire'/.test(t) && /genre: 'donut'/.test(t),
      'les deux genres s’écrivent avec l’état');
    vrai(/if \(!avant \|\| avant\.genre !== 'aire'\) return false;/.test(t),
      'la pile ne part que d’une pile');
    vrai(/if \(!avant \|\| avant\.genre !== 'donut'\) return;/.test(t),
      'et l’anneau que d’un anneau');
  });

  test('le mouvement se refuse quand le système le demande', () => {
    const t = anneau();
    vrai(/if \(anime && cle && !mouvementRefuse\(\)\) animerDepuis/.test(t),
      'l’anneau consulte le même réglage que la pile');
    /* Et le drapeau s'eteint apres le premier rendu : `mount` peut rappeler la
       fonction, et une transition rejouee a chaque redimensionnement serait un
       clignotement. */
    vrai(/let anime = !!opts\.anime;/.test(t) && /anime = false;/.test(t),
      'le drapeau vit hors du rendu et s’éteint après le premier');
  });

  test('les trois anneaux partagent le drapeau, et il s’éteint après le dernier', () => {
    /* L'eteindre au premier aurait anime le camembert du haut et fait sauter
       les deux autres, alors qu'ils changent tous ensemble. */
    const t = lireSource('assets/app.js');
    const bloc = t.slice(t.indexOf('const animAlloc = allocTransition;'),
                         t.indexOf('allocTransition = false;',
                                   t.indexOf('const animAlloc = allocTransition;')));
    vrai(bloc.length > 200, 'le montage des anneaux doit être trouvable');
    /* Ils sont QUATRE depuis que le portefeuille de marché a le sien. Il ne
       se monte que chez qui détient des titres, mais son appel est écrit au
       même endroit que les autres et reçoit donc le même drapeau : les
       animer ensemble ou pas du tout. */
    eq((bloc.match(/anime: animAlloc/g) || []).length, 4,
      'les quatre anneaux reçoivent le même drapeau');
    for (const id of ['#aMacro', '#aType', '#aDispo', '#aPortefeuille']) {
      vrai(bloc.includes(id), `${id} est dans le bloc que le drapeau couvre`);
    }
  });

  test('Allocation s’ouvre sur « Financier »', () => {
    /* Elle ouvrait sur « Tout », et le premier ecran etait celui qu'elle ne sait
       pas rendre utile : un appartement y pese l'essentiel du net, les autres
       poches se serrent sous deux pour cent et leurs traits deviennent
       invisibles. On ne reequilibre pas un logement, et cette page existe pour
       montrer ce qui se pilote. */
    const app = lireSource('assets/app.js');
    vrai(/let allocFinancier = true;/.test(app), 'le périmètre financier est le défaut');
    vrai(!/let allocFinancier = false;/.test(app), 'et l’ancien défaut est parti');
    /* « Tout » reste a un geste : rien n'est retire, seule la porte d'entree
       change. */
    vrai(/\['financier', 'Financier'\], \['tout', 'Tout'\]/.test(app),
      '« Financier » ouvre la barre, « Tout » reste à côté');
    vrai(/allocFinancier \? 'financier' : 'tout'/.test(app),
      'et l’actif suit la variable, jamais une valeur écrite à côté');
    /* Sans actif hors perimetre, les deux lectures se confondent et la barre ne
       s'affiche meme pas : ce defaut ne change alors rien. */
    vrai(/horsFinancierExiste\(\) \? barreCommutateur\(/.test(app),
      'la barre ne paraît que si les deux lectures diffèrent');
  });

  test('recliquer le périmètre déjà allumé n’anime rien', () => {
    /* Une transition de zero vers zero est un clignotement. Meme garde que la
       bascule de la courbe, et pour la meme raison. */
    const t = lireSource('assets/app.js');
    const action = t.slice(t.indexOf("'alloc-base'(btn) {"),
                           t.indexOf("'alloc-base'(btn) {") + 400);
    vrai(/if \(voulu === allocFinancier\) return;/.test(action),
      'le même périmètre ne relance ni rendu ni transition');
    vrai(/allocTransition = true;/.test(action),
      'et un changement réel lève le drapeau');
  });
});

/* ------------------------------------------------------------------
   La base d'un pourcentage se lit sous le titre, pas à côté
   ------------------------------------------------------------------ */
suite('La mention de base est une légende, pas une commande', () => {

  test('aucune mention ne vit plus dans un en-tête de carte', () => {
    /* L'en-tete de carte est une ligne a deux bords : le titre a gauche, une
       COMMANDE a droite. La mention y etait donc traitee comme un bouton, et
       `space-between` poussait deux textes de longueurs tres differentes vers
       les deux bords. En francais, « en % de ton patrimoine financier · 66 182
       EUR » rejoignait « Repartition globale » au milieu et se chevauchait sur
       un telephone.

       Le controle est DERIVE : il refuse le motif partout, plutot que de tenir
       la liste des cinq cartes qui le portaient. Une sixieme ecrite demain
       tomberait dessus. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible');
    eq((src.match(/<span class="hint">\$\{mentionBase\(/g) || []).length, 0,
      'une mention de base ne se pose plus dans un en-tête');
    const posees = (src.match(/<p class="tete-legende">\$\{mentionBase\(/g) || []).length;
    eq(posees, (src.match(/\$\{mentionBase\(/g) || []).length - 1,
      'toutes les mentions sauf celle de l’accueil sont des légendes de carte');
    vrai(posees >= 5, 'les cinq cartes à pourcentages en portent une');
  });

  test('la légende se serre sous son titre, et la règle le dit dans ce sens', () => {
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/\.card-head:has\(\+ \.tete-legende\) \{ margin-bottom: 2px; \}/.test(css),
      'c’est la présence de la légende qui resserre le titre');
    const i = css.indexOf('.tete-legende {');
    vrai(i > 0, 'la légende doit avoir sa règle');
    const regle = css.slice(i, css.indexOf('}', i));
    vrai(/font-size: var\(--font-sm\)/.test(regle) && /color: var\(--muted\)/.test(regle),
      'elle garde l’encre et la taille qu’elle avait dans l’en-tête');
  });

  test('« Répartition » porte deux sens, et une clef pointée les sépare', () => {
    /* « Repartition » vaut deja « Breakdown » : c'est l'etiquette vocale de tous
       les anneaux. Une clef-phrase ne porte qu'un seul sens, donc le titre de
       la carte passe par une clef pointee avec son francais en repli — la
       convention deja posee pour « sur.objectif ». */
    const src = lireSource('assets/app.js');
    vrai(/<h2>\$\{trad\('Répartition\.carte', 'Répartition'\)\}<\/h2>/.test(src),
      'le titre s’affiche « Répartition » et se traduit par sa clef');
    eq(I18N.en['Répartition.carte'], 'Allocation', 'la carte se dit « Allocation »');
    eq(I18N.en['Répartition'], 'Breakdown', 'et l’étiquette vocale garde son mot');
    /* « globale » contredisait la bascule des qu'on passait en Financier : un
       titre qui annonce « global » au-dessus d'une base restreinte ment. */
    vrai(!src.includes("trad('Répartition globale')"),
      'plus rien n’annonce « globale » au-dessus d’une base qui peut être restreinte');
    vrai(!I18N.en['Répartition globale'], 'et la clef morte est partie avec');
  });
});

/* ------------------------------------------------------------------
   Les barres poussent de zéro, et pas n'importe quand
   ------------------------------------------------------------------ */
suite('Les barres des graphiques poussent, à l’arrivée et au changement de périmètre', () => {

  const css = () => (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');

  test('seules les barres visibles portent la classe, jamais les zones de survol', () => {
    /* Chaque groupe porte un rect TRANSPARENT qui sert de cible au doigt, plus
       la ou les barres peintes. Animer la cible ferait clignoter la zone
       cliquable sans que rien ne se voie, et la retrecirait pendant le
       mouvement : on viserait une barre qui n'est pas encore la. */
    const t = lireSource('assets/charts.js');
    vrai(t, 'assets/charts.js doit être lisible');
    for (const [classe, combien] of [['rb-barre', 1], ['vb-barre', 2], ['gb-barre', 2]]) {
      eq((t.match(new RegExp(`class="${classe}"`, 'g')) || []).length, combien,
        `« ${classe} » se pose ${combien} fois`);
    }
    /* Les rects transparents restent nus. Le controle les cherche par leur
       remplissage plutot que par leur position : c'est ce qui les definit. */
    for (const m of t.match(/<rect[^>]*fill="transparent"[^>]*\/>/g) || []) {
      vrai(!/class="(rb|vb|gb)-barre"/.test(m),
        'une zone de survol ne s’anime pas');
    }
  });

  test('la boîte de transformation est celle du dessin, pas celle de la vue', () => {
    /* En SVG, sans `fill-box`, l'origine se calcule sur la boite de vue
       entiere : une barre du bas grandirait depuis un point situe hors d'elle,
       en traversant le graphique. La regle ne peut pas s'en passer. */
    const c = css();
    const i = c.indexOf('.graphes-poussent :is(.rb-barre, .vb-barre, .gb-barre)');
    vrai(i > 0, 'la règle commune des barres doit exister');
    vrai(/transform-box: fill-box/.test(c.slice(i, c.indexOf('}', i))),
      'la transformation se calcule sur la barre elle-même');
    vrai(/\.graphes-poussent \.rb-barre \{[\s\S]{0,120}transform-origin: left center/.test(c),
      'une barre horizontale pousse depuis la gauche');
    vrai(/\.graphes-poussent :is\(\.vb-barre, \.gb-barre\) \{[\s\S]{0,120}transform-origin: bottom center/.test(c),
      'une barre verticale pousse depuis sa base');
  });

  test('une variation négative pousse vers le bas', () => {
    /* Elle pend sous la ligne du zero : son bord HAUT est le zero, et c'est de
       la qu'elle doit partir. Depuis sa pointe, elle remonterait, ce qui
       donnerait a lire un mouvement inverse a son signe. */
    const t = lireSource('assets/charts.js');
    vrai(/class="vb-barre"\$\{it\.value < 0 \? ' data-sous="1"' : ''\}/.test(t),
      'la barre qui pend se marque');
    /* Et elle ne se marque que la ou une valeur peut etre negative : les mois
       de depenses ne descendent jamais sous zero. */
    vrai(/const top = it\.value >= 0 \? y\(it\.value\) : zero;/.test(t),
      'c’est bien le graphique des variations qui peut pendre');
    vrai(/\.graphes-poussent \.vb-barre\[data-sous\] \{ transform-origin: top center; \}/.test(css()),
      'et la règle la fait pousser vers le bas');
  });

  test('les barres repoussent au changement de périmètre, la page ne clignote pas', () => {
    /* Deux classes et non une, et c'est tout l'interet : `vue-entre` fait aussi
       monter les cartes en cascade. Rejouer cette cascade a chaque clic sur une
       bascule ferait clignoter la page entiere pour un chiffre qui change.
       Mesure : au clic, vingt barres repartent et aucune carte ne bouge. */
    const c = css();
    vrai(/\.view\.vue-entre > \* \{[\s\S]{0,80}animation: carte-entre/.test(c),
      'la cascade des cartes reste attachée à l’arrivée seule');
    vrai(/\.graphes-poussent :is\(\.repart-barre/.test(c),
      'les jauges suivent la classe des graphiques');
    vrai(!/\.vue-entre :is\(\.repart-barre/.test(c),
      'et ne sont plus attachées à l’arrivée seule');

    const app = lireSource('assets/app.js');
    const sansCom = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    vrai(/if \(arrivee \|\| relanceGraphes\) \{\s*\n\s*host\.classList\.add\('graphes-poussent'\);/.test(sansCom),
      'la classe se pose à l’arrivée ou sur demande');
    /* Consomme, comme les deux autres drapeaux : sans ca, une frappe dans un
       champ ferait repousser toutes les barres de la page. */
    vrai(/relanceGraphes = false;/.test(sansCom),
      'et le drapeau se consomme');
    /* TROIS gestes le levent, et ils se nomment ici. Chacun remplace les
       chiffres que les barres dessinent : le perimetre d'Allocation, la lecture
       net / brut, et l'annee des releves. Un quatrieme devra passer par la meme
       porte — c'est ce qui empeche « on anime aussi ce cas-la » de se glisser
       sans qu'on ait pese la fatigue que ca ajoute. */
    for (const geste of ["'alloc-base'(btn) {", "'hero-base'(btn) {",
                         "'history-year'(btn) {"]) {
      const i = sansCom.indexOf(geste);
      vrai(i > 0, `${geste} doit être trouvable`);
      vrai(/relanceGraphes = true/.test(sansCom.slice(i, i + 400)),
        `${geste} fait repousser les barres`);
    }
    eq((sansCom.match(/relanceGraphes = true/g) || []).length, 3,
      'trois gestes remplacent les chiffres que les barres dessinent');
    /* UN CHEMIN A PART, ET UN SEUL : le changement d'angle d'Allocation. Il ne
       change aucun chiffre, il montre un autre angle, et la classe se pose sur
       SA section plutot que sur la vue : les jauges des poches, au-dessus, ne
       changent pas et ne doivent pas repousser. Il se nomme ici pour la meme
       raison que les trois autres. */
    const angle = sansCom.indexOf("'alloc-angle'(btn) {");
    vrai(angle > 0, 'le geste du changement d’angle doit être trouvable');
    vrai(/allocAngleEntre = true;\s*\n\s*render\(\);\s*\n\s*allocAngleEntre = false;/.test(sansCom.slice(angle, angle + 500)),
      'il lève son drapeau le temps de son rendu, et le baisse aussitôt');
    eq((sansCom.match(/allocAngleEntre = true/g) || []).length, 1,
      'un seul geste fait entrer un angle');
    vrai(/const entreeAngle = allocAngleEntre \? ' angle-entre graphes-poussent' : '';/.test(sansCom),
      'et la classe des barres va à la section de l’angle, pas à la vue');
    eq((sansCom.match(/classList\.add\('graphes-poussent'\)/g) || []).length, 1,
      'la vue entière ne la reçoit que de render()');
  });

  test('les barres partent avec les jauges, et rien ne bouge si le système le refuse', () => {
    /* Elles se lisent ensemble sur une meme page : deux rythmes s'y verraient
       comme un defaut. Les valeurs se confrontent plutot que de se recopier. */
    const c = css();
    const i = c.indexOf('.graphes-poussent :is(.rb-barre, .vb-barre, .gb-barre)');
    const commune = c.slice(i, c.indexOf('}', i));
    const jauge = c.match(/animation: barre-pousse ([\d.]+)s [^;]*?([\d.]+)s backwards/);
    vrai(jauge, 'la règle des jauges doit être trouvable');
    vrai(commune.includes(`animation-duration: ${jauge[1]}s`), 'même durée que les jauges');
    vrai(commune.includes(`animation-delay: ${jauge[2]}s`), 'même retard que les jauges');

    /* Les trois familles d'arrivee se taisent ensemble. La cascade des cartes
       et la pousse des jauges l'ignoraient, alors que le balayage de la courbe
       le respectait : trois animations d'arrivee, deux regimes. */
    /* Le bloc se trouve par son CONTENU : le fichier en compte une dizaine, un
       par fonctionnalité, et « le dernier » n'est pas une adresse stable. */
    const blocs = c.split('@media (prefers-reduced-motion: reduce)').slice(1);
    const bloc = blocs.find(x => x.slice(0, 500).includes('.rb-barre'));
    vrai(bloc, 'le garde-fou des animations d’arrivée doit exister');
    for (const cible of ['.view.vue-entre > *', '.repart-barre', '.rb-barre, .vb-barre, .gb-barre']) {
      vrai(bloc.includes(cible), `« ${cible} » se tait aussi`);
    }
  });
});

/* ------------------------------------------------------------------
   Une bascule ne se montre que si ses deux positions donnent deux vues
   ------------------------------------------------------------------ */
suite('Une bascule qui ne change rien ne se montre pas', () => {

  /* Le fixture porte les deux : un studio a 120 000 hors perimetre financier,
     et un credit de 40 000. Chaque cas ci-dessous en retire un, ou les deux. */
  const sansDette = s => { for (const e of s.etabs) e.dettes = []; };
  const sansBien = (s) => {
    s.comptes = s.comptes.filter(c => c.id !== 'c_immo');
    for (const m of s.monthly) delete m.v.c_immo;
  };
  /* Une dette qui ne finance aucun bien physique : c'est le cas qu'un drapeau
     « a-t-il un appartement » traiterait a l'envers. */
  const detteDeCourtier = (s) => {
    sansDette(s);
    s.etabs.find(e => e.id === 'e_courtier').dettes =
      [{ id: 'd_marge', libelle: 'Marge', montant: 10000, note: '' }];
  };

  test('les deux existent quand les deux changent quelque chose', () => {
    Fixture.poser();
    const p = patrimoine();
    pres(p.brut, Fixture.BRUT, 'le brut du fixture');
    pres(p.net, Fixture.BRUT - Fixture.DETTE, 'le net du fixture');
    const b = basculesEvolution({ net: true, financier: false, range: 'all' });
    vrai(b.netBrut, 'une dette de 40 000 sépare le net du brut');
    vrai(b.perimetre, 'un studio de 120 000 sépare le financier du global');
  });

  test('sans dette, Net et Brut disent la même chose : pas de bascule', () => {
    Fixture.poser(sansDette);
    const p = patrimoine();
    pres(p.dettes, 0, 'plus aucune dette');
    pres(p.net, p.brut, 'le net vaut le brut');
    const b = basculesEvolution({ net: true, financier: false, range: 'all' });
    vrai(!b.netBrut, 'la bascule Net / Brut n’a rien à proposer');
    /* Le studio est toujours la : l'autre bascule ne bouge pas. Deux reglages,
       deux questions, et l'un ne repond pas pour l'autre. */
    vrai(b.perimetre, 'celle du périmètre reste, elle a toujours sa raison');
  });

  test('sans actif hors périmètre, Financier et Global tracent la même courbe', () => {
    Fixture.poser(s => { sansBien(s); sansDette(s); });
    pres(totalFinancier(), patrimoine().brut,
      'tout le patrimoine tient dans le périmètre financier');
    for (const net of [true, false]) {
      const b = basculesEvolution({ net, financier: false, range: 'all' });
      vrai(!b.perimetre, `la bascule du périmètre disparaît (net : ${net})`);
      vrai(!b.netBrut, `et celle de Net / Brut aussi (net : ${net})`);
    }
  });

  test('une dette sans bien physique fait quand même diverger les deux périmètres', () => {
    /* Le cas qui condamne le drapeau `aUnBien`. Aucun bien physique, donc les
       deux courbes BRUTES sont identiques ; mais la vue financiere ne retranche
       aucune dette la ou la vue globale nette les retranche, donc les deux
       courbes NETTES different. La bascule doit apparaitre en Net et disparaitre
       en Brut : c'est vrai des deux cotes, et c'est la regle. */
    Fixture.poser(s => { sansBien(s); detteDeCourtier(s); });
    pres(totalFinancier(), patrimoine().brut, 'aucun actif hors périmètre');
    pres(patrimoine().dettes, 10000, 'une dette de courtier');

    const enNet = basculesEvolution({ net: true, financier: false, range: 'all' });
    vrai(enNet.perimetre,
      'en Net, la dette retranchée d’un côté seulement sépare les deux courbes');
    vrai(enNet.netBrut, 'et Net / Brut a évidemment sa raison');

    const enBrut = basculesEvolution({ net: false, financier: false, range: 'all' });
    vrai(!enBrut.perimetre,
      'en Brut, aucune dette n’est retranchée nulle part : les deux courbes se confondent');
  });

  test('ajouter puis retirer un bien fait apparaître et disparaître la bascule', () => {
    /* Le meme etat, joue dans les deux sens : rien n'est memorise, la reponse
       vient des donnees du moment. */
    const sansRien = s => { sansBien(s); sansDette(s); };
    Fixture.poser(sansRien);
    vrai(!basculesEvolution({ net: true, financier: false, range: 'all' }).perimetre,
      'sans bien : absente');

    Fixture.poser(s => { sansDette(s); });        // le studio revient
    vrai(basculesEvolution({ net: true, financier: false, range: 'all' }).perimetre,
      'le bien revient : la bascule revient');

    Fixture.poser(sansRien);
    vrai(!basculesEvolution({ net: true, financier: false, range: 'all' }).perimetre,
      'et elle repart quand il repart');
  });

  test('la comparaison lit les vues, elle ne lit pas un drapeau', () => {
    /* Ce que la regle interdit : deduire la reponse d'une propriete du
       patrimoine plutot que des deux vues calculees. Un drapeau se trompe des
       que la definition d'un perimetre bouge, et personne ne le voit. */
    const src = lireSource('assets/store.js');
    /* La borne de fin est du CODE, jamais un commentaire : le depot public est
       servi sans commentaires, `indexOf` y rend -1, et `slice(a, -1)` prend tout
       le reste du fichier au lieu de rien. Le controle passait ici et tombait
       la-bas, sur une tranche qui contenait la moitie du modele. */
    /* La borne de fin est la fin de CETTE fonction, pas le debut d'une autre :
       une fonction glissee entre les deux etirait la tranche a la moitie du
       modele, et le controle de longueur tombait sans rien dire de son vrai
       sujet. L'accolade en colonne zero ferme la fonction, et elle seule. */
    const deb = src.indexOf('function basculesEvolution');
    const fn = src.slice(deb, src.indexOf('\n}', deb) + 2);
    vrai(fn.length > 200 && fn.length < 3000, 'la fonction doit être trouvable, et elle seule');
    vrai(/const courbe = \(n, f\) => limitRange\(pointsEvolution\(\{ net: n, financier: f, aujourdhui \}\), range\);/.test(fn),
      'les deux vues se calculent vraiment');
    vrai(/!memeCourbe\(courbe\(net, true\), courbe\(net, false\)\)/.test(fn),
      'et le périmètre se juge en les comparant');
    vrai(!/CLASSES_HORS_FINANCIER|horsFinancier\(|SERIES_HORS_FINANCIER/.test(fn),
      'aucune règle de périmètre n’est recopiée ici');
    /* La plage compte : deux courbes qui ne different qu'avant la fenetre
       affichee se confondent a l'ecran, et la bascule serait morte. */
    vrai(/range/.test(fn), 'la comparaison porte sur la plage affichée');
  });

  test('une poche absente et une poche nulle sont la même chose', () => {
    /* La vue financiere SUPPRIME les poches hors perimetre au lieu de les
       mettre a zero. Comparer les seules clefs de l'une raterait une poche que
       l'autre porte, et deux courbes differentes passeraient pour identiques. */
    const src = lireSource('assets/store.js');
    const fn = src.slice(src.indexOf('function memeCourbe'),
                         src.indexOf('function basculesEvolution'));
    vrai(/const cles = new Set\(\[\.\.\.Object\.keys\(p\), \.\.\.Object\.keys\(q\)\]\);/.test(fn),
      'la comparaison porte sur l’union des clefs');
    /* Et la reponse se verifie sur de vrais nombres : sans bien, la vue globale
       porte une poche `immo` a zero que la vue financiere n'a pas du tout. */
    Fixture.poser(s => { sansBien(s); sansDette(s); });
    const g = pointsEvolution({ net: true, financier: false });
    const f = pointsEvolution({ net: true, financier: true });
    vrai(g.length && g.length === f.length, 'les deux vues ont le même nombre de points');
    vrai(memeCourbe(g, f), 'et elles se confondent malgré des clefs différentes');
  });

  test('le rendu n’émet rien plutôt que de masquer', () => {
    /* Masquer laisserait les boutons dans l'ordre de tabulation et dans ce que
       lit une synthese vocale, pour un choix qui n'existe pas. */
    const app = lireSource('assets/app.js');
    const tete = app.slice(app.indexOf('<div class="hero-label">'),
                           app.indexOf('<div class="hero-value">'));
    vrai(/\$\{basculesAffichees\(\)\.netBrut \? `<span class="segmented seg-mini">/.test(tete),
      'le grand chiffre n’émet sa bascule que si elle sert');
    vrai(!/opacity: ?0|visibility: ?hidden|display: ?none/.test(tete),
      'et il ne la masque pas');

    const carte = app.slice(app.indexOf('function carteEvolution()'),
                            app.indexOf('function monterEvolution()'));
    vrai(/const perimetreUtile = courbeTracable\(\) && basculesAffichees\(\)\.perimetre;/.test(carte),
      'la carte lit l’état une seule fois');
    vrai(/perimetreUtile \? `\s*\n\s*<span class="segmented seg-mini">/.test(carte),
      'et n’émet la bascule du périmètre que si elle sert');
    /* L'aide part avec elle : une pastille qui explique la difference entre
       deux vues n'a rien a dire quand une seule existe. */
    vrai(/perimetreUtile \? aide\(trad\(AIDE_PERIMETRE\)\) : ''/.test(carte),
      'et son aide disparaît avec elle');
  });
});


/* ------------------------------------------------------------------
   Les barres des relevés, et la teinte d'un contenant
   ------------------------------------------------------------------ */
suite('La piste d’un relevé pousse depuis son zéro', () => {

  const css = () => (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');

  test('elle rejoint la famille des jauges', () => {
    /* Elle n'y etait pas, et c'est tout ce qui lui manquait : les barres de
       variation de chaque releve se posaient d'un coup au milieu d'une page ou
       tout le reste pousse. */
    const c = css();
    const i = c.indexOf('.graphes-poussent :is(.repart-barre');
    vrai(i > 0, 'la règle de la famille doit exister');
    const sel = c.slice(i, c.indexOf('{', i));
    vrai(sel.includes('.ml-jauge'), 'la piste des relevés est dans la famille');
    /* Et le garde-fou du mouvement suit la MEME liste : deux listes ecrites a
       la main auraient fini par diverger, et une barre aurait continue de
       bouger chez quelqu'un qui demande l'arret. */
    const blocs = c.split('@media (prefers-reduced-motion: reduce)').slice(1);
    const garde = blocs.find(x => x.slice(0, 500).includes('.rb-barre'));
    vrai(garde && garde.includes('.ml-jauge'),
      'le garde-fou du mouvement porte la même liste');
  });

  test('un mois négatif pousse vers la gauche, pas vers la droite', () => {
    /* Le zero est SUR la piste, a la place que lui donne `geometrieJauges` : un
       mois positif s'etend a sa droite, un negatif a sa gauche. L'origine commune
       de la famille est le bord gauche, ce qui convient a `i.up` -- son `left`
       fait de son bord gauche le zero -- et ferait partir `i.down` du mauvais
       cote, en s'eloignant du zero au lieu d'en sortir. */
    const c = css();
    vrai(/\.graphes-poussent \.ml-jauge > i\.down \{ transform-origin: right center; \}/.test(c),
      'la barre qui descend pousse depuis son bord droit');
    /* La geometrie que cette regle suppose se verifie, elle ne se suppose pas. */
    const i = c.indexOf('.ml-jauge i.up');
    vrai(i > 0, 'les deux sens doivent être déclarés');
    vrai(/\.ml-jauge i \{[\s\S]{0,120}position: absolute/.test(c),
      'les barres sont positionnées dans la piste');
    const app = lireSource('assets/app.js');
    vrai(/part > 0\s+\? `left:\$\{zero\.toFixed\(1\)\}%` : `right:\$\{\(100 - zero\)\.toFixed\(1\)\}%`/.test(app),
      'et c’est bien le signe qui décide du bord ancré au zéro');
  });

  test('un mois plat ne pousse pas', () => {
    /* Ce n'est pas une barre mais un point de six pixels, pose sur le zero pour
       dire « rien ne s'est passe » plutot que « pas de donnee » : il n'a aucune
       longueur a parcourir, et l'etirer depuis un bord le ferait glisser. */
    vrai(/\.graphes-poussent \.ml-jauge > i\.plat \{ animation: none; \}/.test(css()),
      'le point d’un mois plat reste immobile');
    const app = lireSource('assets/app.js');
    vrai(/Math\.abs\(part\) < 0\.005[\s\S]{0,80}<i class="plat" style="left:/.test(app),
      'et c’est bien un point, pas une barre de longueur nulle');
  });
});

/* ------------------------------------------------------------------
   La couleur d'un établissement vient de sa famille
   ------------------------------------------------------------------ */
suite('Un établissement porte la couleur de sa famille, pas de son contenu', () => {

  test('la teinte se lit sur l’établissement, jamais sur la valeur de ses lignes', () => {
    /* Le defaut : la couleur venait de la classe d'actif dominante EN VALEUR.
       Une minorite pouvait donc peindre le tout — un courtier dont la plus
       grosse ligne est du non cote se lisait « societe » alors que sa propre
       fiche annoncait « Banque ou courtier » deux centimetres plus haut. Les
       mots et la couleur se contredisaient dans la meme carte.

       Pire : la couleur bougeait avec le marche. La ligne qui passe devant
       repeignait l'etablissement, sans que rien n'ait change chez lui. */
    const st = lireSource('assets/store.js');
    const fn = st.slice(st.indexOf('function teinteEtab(e)'),
                        st.indexOf('function teinteDominante'));
    vrai(fn.length > 40, 'la fonction doit être trouvable');
    vrai(/contenantDeLEtab\(e\.id\)\.teinte/.test(fn),
      'elle lit la famille de l’établissement');
    vrai(!/valeur|montant|teinteDominante|lignesDe/.test(fn),
      'et jamais un montant : une couleur qui suit le marché ne dit plus rien');
  });

  test('les quatre familles ont une teinte, et elle vit avec leur nom', () => {
    /* Un fait, un endroit : le titre affiche et la couleur qui l'accompagne
       sont deux faces de la meme decision, elles se posent sur la meme ligne. */
    for (const cle of ['bien', 'societe', 'banque', 'assureur']) {
      const f = CONTENANTS[cle];
      vrai(f && f.titre, `la famille « ${cle} » doit exister`);
      vrai(/^var\(--series-\d+\)$/.test(f.teinte || ''),
        `la famille « ${cle} » doit porter une teinte`);
    }
    /* Quatre familles, quatre couleurs : deux qui se partagent une teinte ne se
       distingueraient plus dans la liste. */
    const teintes = ['bien', 'societe', 'banque', 'assureur'].map(k => CONTENANTS[k].teinte);
    eq(new Set(teintes).size, 4, 'les quatre familles se distinguent');
  });

  test('la couleur d’un établissement ne bouge pas quand ses lignes bougent', () => {
    /* La preuve sur de vrais nombres : le studio du fixture vaut 120 000 et sa
       dette 40 000. On fait varier ce qu'il contient, la famille ne bouge pas.
       C'est tout l'interet du changement. */
    Fixture.poser();
    const bien = ETABS().find(e => e.id === 'e_bien');
    vrai(bien, 'l’établissement du bien doit exister');
    const avant = teinteEtab(bien);
    eq(avant, CONTENANTS.bien.teinte, 'un bien immobilier porte la teinte des biens');

    /* On multiplie la valeur de la ligne par dix : rien ne doit changer. */
    Fixture.poser(s => {
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.lignes[0].valeur = c.lignes[0].valeur * 10;
    });
    eq(teinteEtab(ETABS().find(e => e.id === 'e_bien')), avant,
      'la teinte ne suit pas la valeur');

    /* Et un etablissement de comptes garde la sienne, quoi qu'il porte. */
    Fixture.poser();
    const courtier = ETABS().find(e => e.id === 'e_courtier');
    eq(teinteEtab(courtier), CONTENANTS.banque.teinte,
      'un courtier porte la teinte « banque ou courtier »');
  });

  test('la couleur dit la même chose que le mot écrit au-dessus', () => {
    /* C'est le point entier. La fiche affiche le titre de la famille juste
       au-dessus du nom, et la pastille juste a cote : les deux doivent venir de
       la meme decision, sinon la carte se contredit elle-meme. */
    Fixture.poser();
    for (const e of ETABS()) {
      const famille = contenantDeLEtab(e.id);
      eq(teinteEtab(e), famille.teinte,
        `« ${e.nom} » : la pastille doit dire « ${famille.titre} » comme le texte`);
    }
  });
});

/* ------------------------------------------------------------------
   Le ruban des indices se rafraîchit vraiment
   ------------------------------------------------------------------ */
suite('Les cours du marché se remettent à jour, pas seulement ceux qu’on détient', () => {

  const q = () => lireSource('assets/quotes.js');
  const app = () => lireSource('assets/app.js');

  test('le ruban n’a qu’une seule façon d’être redemandé', () => {
    /* Il en avait deux, dont une fermee : `reperes()` acceptait
       `{ force: true }` et personne ne le lui passait. Un drapeau mort donne a
       lire un cablage qui n'existe pas, et c'est ce qui a retarde le diagnostic
       quand le ruban restait fige. */
    const t = q();
    vrai(t, 'assets/quotes.js doit être lisible');
    vrai(/function oublierReperes\(\) \{\s*\n\s*cacheReperes\.clear\(\);/.test(t),
      'jeter le cache est la seule porte');
    vrai(/oublierReperes,/.test(t), 'et elle est exportée');
    vrai(!/force/.test(t.slice(t.indexOf('async function reperes'),
                               t.indexOf('cacheReperes.set'))),
      'plus aucun drapeau mort dans la lecture du cache');
  });

  test('un appui sur la pastille rafraîchit aussi ce qu’on voit', () => {
    /* Elle annoncait « 6 cours mis a jour » au-dessus d'un S&P 500 vieux de
       quatre minutes : deux signaux qui se contredisent dans la meme seconde.
       Le geste couvre ce qu'on voit, pas seulement ce qu'on detient. */
    const t = app();
    const action = membreAction(t, 'refresh-quotes');
    vrai(action.length > 300, 'l’action doit être trouvable');
    vrai(/Quotes\.oublierReperes\(\);/.test(action),
      'le ruban part avec les lignes détenues');
    /* Et avant le rendu, sinon le rendu resservirait le cache. */
    vrai(action.indexOf('Quotes.oublierReperes();') < action.indexOf('render();'),
      'et il est jeté AVANT le rendu qui le relit');
  });

  test('le ruban se juge sur ses propres places, pas sur celles qu’on détient', () => {
    /* Le coeur du defaut. Le passage periodique sortait des qu'aucune ligne
       DETENUE ne cotait : un portefeuille europeen a dix-huit heures voyait le
       S&P 500 fige pour la soiree, Wall Street ouverte. Le ruban ne parle pas de
       ce qu'on detient, il parle du marche. */
    const t = app();
    vrai(/const repereOuvert = \(\) => REPERES_AFFICHES\.some\(ouverte\);/.test(t),
      'le ruban a sa propre garde, sur ses propres lignes');
    vrai(/const placeOuverte = \(\) => Store\.state\.positions\.some\(ouverte\);/.test(t),
      'les positions gardent la leur');
    /* Un seul predicat d'ouverture pour les deux : deux copies auraient fini
       par accepter deux etats differents. */
    eq((t.match(/s\.cle === 'open' \|\| s\.cle === 'pre' \|\| s\.cle === 'post'/g) || []).length, 1,
      'et « ouverte » ne s’écrit qu’une fois');

    const fn = t.slice(t.indexOf('async function rafraichirSiUtile()'),
                       t.indexOf('setInterval(rafraichirSiUtile'));
    vrai(fn.length > 200, 'le passage périodique doit être trouvable');
    /* Il ne sort plus tot quand les positions sont fermees : il continue vers le
       ruban. C'est la ligne qui a change le comportement. */
    vrai(!/if \(!placeOuverte\(\)\) return;/.test(fn),
      'plus de sortie anticipée qui emporterait le ruban avec les positions');
    vrai(/if \(repereOuvert\(\)\) \{ Quotes\.oublierReperes\(\); aBouge = true; \}/.test(fn),
      'le ruban se redemande dès qu’une de ses places est ouverte');
    /* Un seul rendu pour les deux, et aucun rendu si rien n'a bouge : un rendu
       toutes les cinq minutes sans raison ferait clignoter la page. */
    eq((fn.match(/render\(\);/g) || []).length, 1, 'un seul rendu');
    vrai(/if \(aBouge\) render\(\);/.test(fn), 'et aucun si rien n’a bougé');
  });
});

/* ------------------------------------------------------------------
   Un texte long a la place qu'il lui faut, un champ court celle qu'il mérite
   ------------------------------------------------------------------ */
suite('Les champs prennent la place de ce qu’ils portent', () => {

  const css = () => (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const app = () => lireSource('assets/app.js');

  test('une valeur en phrase sort de la colonne qu’elle affamait', () => {
    /* La colonne des valeurs est en `auto` : elle se dimensionne sur ce que la
       phrase demande, meme repliee. Mesure a 375 px sur le bloc d'un credit :
       80 px pour les libelles contre 221 pour les valeurs, et les CINQ intitules
       replies sur deux lignes — dont trois qui n'ont qu'un montant en face.
       Sortie de la colonne, la phrase cesse de la dimensionner : 252 px pour les
       libelles, aucun replie, et le bloc raccourcit de 193 a 169 px. */
    const c = css();
    vrai(/\.kv dd\.phrase \{ grid-column: 1 \/ -1; text-align: left; \}/.test(c),
      'la phrase prend sa propre ligne');
    /* Le seuil est MESURE : la famine cesse quand la carte atteint 520 px, soit
       une fenetre d'environ 585. Au-dela, la phrase reste sur la ligne de son
       libelle, ou elle a la place. */
    const i = c.indexOf('.kv dd.phrase { grid-column');
    const avant = c.slice(0, i);
    vrai(/@media \(max-width: 640px\) \{\s*$/.test(avant.slice(-40)),
      'et seulement en dessous de 640 px');
    /* La permission de se replier reste : sans elle, un nowrap sur une phrase
       reduisait deja la colonne des libelles a zero. Les deux regles se
       completent, elles ne se remplacent pas. */
    vrai(/\.kv dd\.phrase \{ white-space: normal; \}/.test(c),
      'la phrase garde le droit de se replier');
  });

  test('deux champs courts restent côte à côte sur un téléphone', () => {
    /* `.g-2` passe a une colonne sous 900 px, et c'est juste pour deux champs
       qui portent une phrase. Pour deux nombres, c'est du gachis : mesure sur la
       fiche d'un bien, les trois grilles passent de 398 px de haut a 191, sans
       debordement, avec un seul libelle sur deux lignes.

       La classe se pose au cas par cas : la meme mesure sur Preferences donne un
       champ a 76 px, ou deux colonnes ne sont plus une economie. */
    const c = css();
    vrai(/\.grid\.g-paire \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/.test(c),
      'la paire serrée existe');
    /* Deux classes contre une : la specificite decide, pas l'ordre. C'est ce qui
       la rend sure a poser n'importe ou. */
    const iCollapse = c.indexOf('.g-2, .g-3, .g-4 { grid-template-columns: minmax(0, 1fr); }');
    const iPaire = c.indexOf('.grid.g-paire {');
    vrai(iCollapse > 0 && iPaire > iCollapse,
      'elle vit dans la même règle mobile, après le repli qu’elle corrige');

    /* Et elle est posee la ou la mesure l'a justifiee : les trois grilles de la
       fiche d'un bien, qui ne portent que des nombres et un menu. */
    const t = app();
    const bloc = t.slice(t.indexOf("<div class=\"field\"><label>${trad(pierre ? 'Nom du placement' : 'Nom du bien')}</label>"),
                         t.indexOf('<div class="field"><label>${trad(\'Adresse\')}</label>'));
    vrai(bloc.length > 500, 'le bloc du bien doit être trouvable');
    /* Deux ici, depuis que la valeur estimee et sa date vivent dans la carte
       « Mettre a jour », en tete de fiche : ses deux grilles la portent aussi. */
    eq((bloc.match(/<div class="grid g-2 g-paire">/g) || []).length, 2,
      'les deux grilles restantes du bien la portent');
    vrai(!/<div class="grid g-2">/.test(bloc),
      'et aucune n’est restée en arrière');
    const maj = t.slice(t.indexOf("<h2>${trad('Mettre à jour')}</h2>"),
                        t.indexOf("<div class=\"field\"><label>${trad(pierre ? 'Nom du placement' : 'Nom du bien')}</label>"));
    vrai(maj.length > 500, 'la carte « Mettre à jour » doit être trouvable, avant le bien');
    eq((maj.match(/<div class="grid g-2 g-paire(?: |")/g) || []).length, 2,
      'la valeur et sa date, le capital et sa date : deux paires serrées');
  });

  test('une adresse et une note du mois tiennent sur trois lignes', () => {
    /* Une ligne les coupait en plein milieu sans le dire : l'adresse du jeu
       d'essai demande 359 px pour les 311 d'une carte a 375. */
    const t = app();
    for (const [quoi, motif] of [
      ['adresse', /<textarea rows="3" data-path="comptes\.\$\{idx\}\.lignes\.\$\{i\}\.adresse"/],
      ['note du mois', /<textarea id="depNote" rows="3"/],
    ]) {
      vrai(motif.test(t), `« ${quoi} » doit être un textarea de trois lignes`);
    }
    /* Le piege du `textarea` : sa valeur vit dans son CORPS, pas dans un
       attribut `value`. Ecrite en attribut, elle serait silencieusement perdue —
       le champ s'afficherait vide et la sauvegarde ecraserait le texte. */
    for (const bout of ['style="text-align:left">${esc(l.adresse || \'\')}</textarea>',
                        '\')}">${esc(r.note || \'\')}</textarea>']) {
      vrai(t.includes(bout), 'la valeur est écrite dans le corps du textarea');
    }
    vrai(!/<textarea[^>]*value=/.test(t),
      'et jamais dans un attribut value, qu’un textarea ignore');

    /* Le premier `textarea` de l'application a besoin de sa regle : sans elle il
       se redimensionne dans les deux sens, et l'elargir le ferait sortir de sa
       carte. */
    vrai(/textarea \{ resize: vertical; line-height: 1\.45; \}/.test(css()),
      'il ne se redimensionne qu’en hauteur');
  });

  test('l’écouteur d’écriture voit les textarea comme les input', () => {
    /* Il cherche `closest('[data-path]')`, donc la balise ne compte pas — mais
       c'est la condition pour que l'adresse s'enregistre a la frappe comme le
       reste de la fiche. Un champ qui ne s'ecrit pas est pire qu'un champ
       absent : on croit avoir saisi. */
    const t = app();
    eq((t.match(/const f = e\.target\.closest\('\[data-path\]'\);/g) || []).length, 2,
      'les deux écouteurs passent par le même sélecteur');
    /* Et le style de base couvre deja les trois balises. */
    vrai(/input, select, textarea \{/.test(css()),
      'le textarea hérite du même habillage');
  });
});

/* ------------------------------------------------------------------
   L'apport dit le financement de l'achat, jamais le patrimoine d'aujourd'hui
   ------------------------------------------------------------------ */
suite('Apport, capital restant et valeur nette ne se mélangent jamais', () => {

  /* Le fixture : un studio a 120 000, un credit de 40 000 chez l'etablissement
     qui le tient. Ce qu'on possede vaut donc 80 000, et aucun apport n'est
     saisi. Les trois notions se lisent sur ces nombres-la. */
  const bien = () => COMPTES().find(c => c.id === 'c_immo');
  const avecApport = (montant) => Fixture.poser(s => {
    s.comptes.find(c => c.id === 'c_immo').apport = montant;
  });

  test('modifier l’apport ne bouge pas d’un euro le patrimoine', () => {
    /* Le point entier. L'apport a ete verse dans le passe, et il est deja
       dedans : la valeur du bien le contient depuis le premier jour. L'ajouter
       aujourd'hui le compterait deux fois. */
    Fixture.poser();
    const sansApport = { brut: patrimoine().brut, net: patrimoine().net,
                         bien: valeurCompte(bien()) };
    pres(sansApport.brut, Fixture.BRUT, 'le brut du fixture');
    pres(sansApport.net, Fixture.BRUT - Fixture.DETTE, 'et son net');

    /* Un apport enorme, bien plus gros que le bien lui-meme : si le patrimoine
       bougeait d'un centime, il le ferait ici. */
    for (const montant of [1, 30000, 500000]) {
      avecApport(montant);
      pres(patrimoine().brut, sansApport.brut, `brut inchangé (apport ${montant})`);
      pres(patrimoine().net, sansApport.net, `net inchangé (apport ${montant})`);
      pres(valeurCompte(bien()), sansApport.bien, `valeur du bien inchangée (apport ${montant})`);
    }
  });

  test('ce qu’on possède reste la valeur moins ce qu’on doit encore', () => {
    /* La troisieme notion, et elle ne lit ni l'apport ni le prix paye. */
    avecApport(90000);
    const c = bien();
    const dette = (etabById(c.etabId).dettes || []).reduce((s, d) => s + num(d.montant), 0);
    pres(valeurCompte(c), 120000, 'la valeur du studio');
    pres(dette, Fixture.DETTE, 'ce qu’il reste à devoir');
    pres(valeurCompte(c) - dette, 80000,
      'ce qu’on possède : la valeur moins la dette, et rien d’autre');
  });

  test('modifier l’apport ne touche pas un crédit existant', () => {
    /* Un credit est sa propre source de verite. Rien ne doit le recalculer
       depuis l'apport : ni son capital initial, ni son restant du, ni sa
       mensualite, ni sa duree. */
    Fixture.poser(s => {
      const e = s.etabs.find(x => (x.dettes || []).length);
      e.dettes[0].initial = 100000;
      e.dettes[0].taux = 2;
    });
    const avant = JSON.stringify(etabById('e_bien').dettes);
    for (const montant of [50000, 250000]) {
      Fixture.poser(s => {
        const e = s.etabs.find(x => (x.dettes || []).length);
        e.dettes[0].initial = 100000;
        e.dettes[0].taux = 2;
        s.comptes.find(c => c.id === 'c_immo').apport = montant;
      });
      eq(JSON.stringify(etabById('e_bien').dettes), avant,
        `le crédit est intact (apport ${montant})`);
    }
    /* Et aucune fonction du modele ne lit l'apport pour ecrire un credit : le
       controle porte sur la source, parce qu'un jour quelqu'un sera tente. */
    const st = lireSource('assets/store.js');
    vrai(!/dettes?\[[^\]]*\][^;]*=[^;]*apport|\.initial\s*=[^;]*apport/.test(st),
      'rien n’écrit un crédit depuis l’apport');
  });

  test('prix moins apport donne le financement à couvrir, tant qu’aucun crédit n’existe', () => {
    /* Un montant indicatif, et rien de plus : Longward ne cree aucun credit. */
    Fixture.poser(s => {
      /* On retire le credit du bien pour se placer avant son existence. */
      s.etabs.find(x => x.id === 'e_bien').dettes = [];
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.lignes[0].prixDeRevient = 300000;
      c.apport = 60000;
    });
    pres(financementIndicatif(bien()), 240000, 'trois cent mille moins soixante mille');

    /* Des qu'un credit existe, la phrase se tait : c'est lui la source de
       verite, et un montant indicatif a cote se lirait comme une consigne de le
       corriger. */
    Fixture.poser(s => {
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.lignes[0].prixDeRevient = 300000;
      c.apport = 60000;
    });
    eq(financementIndicatif(bien()), null, 'un crédit existe : plus d’indication');

    /* Sans prix ou sans apport DECLARE, rien non plus : un montant calcule sur
       une donnee absente serait invente. */
    Fixture.poser(s => {
      s.etabs.find(x => x.id === 'e_bien').dettes = [];
      delete s.comptes.find(x => x.id === 'c_immo').apport;
    });
    eq(financementIndicatif(bien()), null, 'sans apport renseigné, aucune indication');

    /* Un apport declare a ZERO, lui, est une reponse : le financement a couvrir
       est le cout entier. `num(apport) || null` confondait les deux, et taisait
       le cas le plus net — un achat finance a cent pour cent. */
    Fixture.poser(s => {
      s.etabs.find(x => x.id === 'e_bien').dettes = [];
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.lignes[0].prixDeRevient = 300000;
      c.apport = 0;
    });
    pres(financementIndicatif(bien()), 300000,
      'un apport nul déclaré laisse tout le coût à financer');
  });

  test('le financement se détaille au lieu de rendre un verdict', () => {
    /* La version d'avant rendait un booleen `coherent`, vrai tant que l'ecart
       tenait sous QUINZE POUR CENT DU PRIX. Sur un bien a 255 000 EUR, cela
       laissait passer 38 000 EUR d'ecart sans un mot — c'est-a-dire tout ce
       qu'on voudrait justement voir. Et quand il criait, il ne disait pas sur
       quoi. Le detail remplace le verdict. */
    const poser = (prix, apport, initial) => Fixture.poser(s => {
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.lignes[0].prixDeRevient = prix;
      c.apport = apport;
      s.etabs.find(x => x.id === 'e_bien').dettes[0].initial = initial;
    });

    poser(255000, 200000, 210000);
    const p = planFinancement(bien());
    pres(p.cout, 255000, 'le coût d’acquisition');
    pres(p.apport, 200000, 'l’apport');
    pres(p.emprunte, 210000, 'le capital emprunté');
    pres(p.finance, 410000, 'leur somme, nommée');
    pres(p.ecart, 155000, 'et l’écart, chiffré');
    vrai(p.complet, 'les trois pièces sont là');
    vrai(ecartAExpliquer(p), 'un écart de cette taille se dit');
    /* Rien n'est corrige : les trois montants restent tels qu'ils ont ete
       saisis. C'est au detenteur de dire lequel est faux. */
    pres(num(bien().apport), 200000, 'l’apport n’a pas été retouché');
    pres(lignesDe(bien())[0].prixDeRevient, 255000, 'ni le coût');
    pres(num(etabById('e_bien').dettes[0].initial), 210000, 'ni le capital initial');

    /* Ce que l'ancien seuil laissait passer se dit desormais : 20 000 EUR
       d'ecart sur 255 000, c'est un pret travaux ou des frais finances — une
       information, pas un silence. */
    poser(255000, 30000, 245000);
    pres(planFinancement(bien()).ecart, 20000, 'vingt mille euros d’écart');
    vrai(ecartAExpliquer(planFinancement(bien())),
      'et ils se disent, là où quinze pour cent les taisaient');

    /* La tolerance qui reste n'absorbe que l'arrondi. */
    poser(255000, 255000.4, 0.2);
    vrai(!ecartAExpliquer(planFinancement(bien())), 'un arrondi ne se signale pas');
    const st = lireSource('assets/store.js');
    vrai(!/prix \* 0\.15|0\.15 \* prix/.test(st), 'et aucun seuil caché à quinze pour cent');
    vrai(/Math\.abs\(plan\.ecart\) > 1/.test(st), 'la tolérance vaut un euro, et se lit');
  });

  test('une donnée absente laisse le plan incomplet, sans rien inventer', () => {
    /* Traiter une donnee absente comme un zero inventerait un ecart de la taille
       du cout, et crierait sur tous les biens dont le capital initial n'a jamais
       ete saisi. Le plan dit ce qui lui manque au lieu de se taire tout a fait :
       la vue peut alors demander la bonne piece. */
    Fixture.poser(s => {
      delete s.comptes.find(x => x.id === 'c_immo').apport;
      s.etabs.find(x => x.id === 'e_bien').dettes[0].initial = 0;
    });
    const sansRien = planFinancement(bien());
    eq(sansRien.complet, false, 'le plan n’est pas complet');
    eq(sansRien.manque, 'apport', 'et nomme ce qui manque en premier');
    eq(sansRien.ecart, null, 'aucun écart inventé');

    Fixture.poser(s => {
      s.comptes.find(x => x.id === 'c_immo').apport = 50000;
      s.etabs.find(x => x.id === 'e_bien').dettes[0].initial = 0;
    });
    const sansCapital = planFinancement(bien());
    eq(sansCapital.complet, false, 'sans capital initial non plus');
    eq(sansCapital.manque, 'capital', 'et il est nommé');
    /* Un capital emprunte declare a ZERO n'est pas un montant de pret : le
       compter ferait apparaitre un ecart de la taille du cout. */
    eq(sansCapital.emprunte, null, 'un capital emprunté nul ne compte pas comme déclaré');

    /* Et le rendement sur apport n'existe pas sans apport : `null`, jamais un
       zero ni un infini. */
    Fixture.poser();
    const cf = cashFlowBien(bien());
    eq(cf.apport, null, 'aucun apport saisi');
    eq(cf.cashOnCash, null, 'donc aucun rendement sur apport');
  });

  test('l’aide dit ce que l’apport ne fait pas', () => {
    /* Le mot qui manquait : l'aide expliquait a quoi il sert, jamais ce qu'il
       ne change pas. C'est pourtant la seule chose qu'on peut croire a tort. */
    const app = lireSource('assets/app.js');
    const bloc = app.slice(app.indexOf("trad('Apport initial ({dev})')"),
                           app.indexOf("data-path=\"comptes.${idx}.apport\""));
    vrai(bloc.length > 100, 'le champ doit être trouvable');
    /* Trois choses qu'il ne fait pas, et c'est tout le sujet : un apport est un
       fait historique, pas un mouvement d'aujourd'hui. */
    vrai(/il ne s’ajoute pas à ton patrimoine aujourd’hui/.test(bloc),
      'l’aide dit qu’il ne s’ajoute pas au patrimoine');
    vrai(/il ne se retire pas de ton cash/.test(bloc), 'ni ne sort du cash');
    vrai(/il ne change pas la valeur nette du bien/.test(bloc),
      'ni ne change la valeur nette');
    vrai(/rendement sur apport/.test(bloc), 'et à quoi il sert');
    const cle = "Ce que tu as sorti de ta poche le jour de l’achat. C’est un fait historique :"
      + " il ne s’ajoute pas à ton patrimoine aujourd’hui, il ne se retire pas de ton cash, et"
      + " il ne change pas la valeur nette du bien. Il sert à lire le financement, et le"
      + " rendement sur apport d’un locatif.";
    vrai(I18N.en[cle], 'et elle a sa traduction');
  });

  test('l’apport reste dans la zone d’acquisition', () => {
    /* C'est une donnee d'achat, pas une metrique mensuelle : il n'a rien a faire
       dans l'impact mensuel, le financement courant ou le cash-flow. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('data-path="comptes.${idx}.apport"');
    vrai(i > 0, 'le champ doit exister');
    const finZone = app.indexOf('${carteUsageBien(c, idx)}');
    vrai(finZone > i, 'le champ vit avant la carte d’exploitation');
    const financement = app.indexOf("<h2>${trad('Financement')}</h2>");
    vrai(financement > i, 'et avant la carte du financement courant');
  });
});

/* ------------------------------------------------------------------
   Une phrase ne redit pas ce que la carte montre déjà
   ------------------------------------------------------------------ */
suite('Le diagnostic des rôles ne dit que ce qui n’est pas déjà à l’écran', () => {

  test('la part du socle n’est plus récitée : la barre la porte', () => {
    /* Elle l'annoncait en toutes lettres — « le core represente 55,0 % de la
       base de tes cibles » — trente pixels au-dessus d'une barre qui affiche
       « Core · 55,0 % » avec son montant, sous un en-tete qui nomme deja la
       base. Trois exemplaires du meme fait sur un ecran de telephone. */
    const app = lireSource('assets/app.js');
    const fn = app.slice(app.indexOf('function diagnosticRoles(rr)'),
                         app.indexOf('function viewRebalance()'));
    vrai(fn.length > 300, 'la fonction doit être trouvable');
    vrai(!/trad\('représente'\)/.test(fn),
      'la part du socle ne se récite plus');
    vrai(!/BASES\.baseCibles\.de/.test(fn),
      'et la base non plus : l’en-tête de la carte la nomme');
    /* Ce que la carte ne montre nulle part, en revanche, reste dit. */
    vrai(/de ta part arbitrable est en/.test(fn),
      'la composition de la part arbitrable reste, elle');
  });

  test('sans concentration, la phrase disparaît au lieu de meubler', () => {
    /* Une part arbitrable repartie sur trois classes n'a rien a signaler. La
       carte garde ses barres ; une phrase qui les paraphrase serait du bruit.
       C'est le meme principe que les bascules : ce qui n'apprend rien ne
       s'affiche pas. */
    const app = lireSource('assets/app.js');
    const fn = app.slice(app.indexOf('function diagnosticRoles(rr)'),
                         app.indexOf('function viewRebalance()'));
    vrai(/if \(!gros \|\| partGros < 50\) return '';/.test(fn),
      'en dessous du seuil, rien ne se rend');
    /* Et le seuil ne s'ecrit qu'une fois : deux valeurs auraient fini par
       diverger entre la garde et la phrase. */
    eq((fn.match(/partGros/g) || []).length, 3,
      'le seuil, la garde et l’affichage lisent la même variable');
  });

  test('la classe nommée pèse bien la classe entière', () => {
    /* Regle deja acquise, et qu'il ne faut pas perdre en simplifiant : la
       composition est indexee par classe ET par nature, si bien qu'« actions en
       direct » et « actions en fonds » y sont deux entrees. Prendre la premiere
       annoncerait un pourcentage juste sous un intitule qui ment. */
    const app = lireSource('assets/app.js');
    const fn = app.slice(app.indexOf('function diagnosticRoles(rr)'),
                         app.indexOf('function viewRebalance()'));
    vrai(/parClasse\.set\(p\.classe, \(parClasse\.get\(p\.classe\) \|\| 0\) \+ p\.value\)/.test(fn),
      'la composition s’agrège par classe avant qu’on cherche la plus grosse');
    vrai(/const gros = \[\.\.\.parClasse\]\.sort/.test(fn),
      'et c’est bien la table agrégée qui se trie');
  });
});

/* ------------------------------------------------------------------
   Allocation compte ce qu'on possède, pas ce qu'on posséderait sans dette
   ------------------------------------------------------------------ */
suite('Une seule base par mode, et la somme des parts la redonne', () => {

  /* Le fixture : 138 250 de brut, 40 000 de dette sur le studio de 120 000.
     Le net vaut donc 98 250, et le studio ne pèse plus que 80 000. */
  const NET = Fixture.BRUT - Fixture.DETTE;

  test('un bien financé pèse sa valeur moins son crédit, une seule fois', () => {
    Fixture.poser();
    const p = poidsPoches({ net: true }).find(x => x.key === 'immo');
    vrai(p, 'la poche immobilière doit exister');
    pres(p.value, 120000 - Fixture.DETTE, 'cent vingt mille moins quarante mille');
    /* Une seule fois : aucune autre poche ne paie la dette. */
    for (const x of poidsPoches({ net: true })) {
      if (x.key === 'immo') continue;
      pres(x.value, num(nowTotals()[x.key]),
        `« ${x.key} » n’a rien perdu : la dette ne se déduit pas deux fois`);
    }
  });

  test('la somme des poches fait exactement la base nette', () => {
    /* La règle qui gouverne tout ici : un total égale la somme de ses parts. */
    Fixture.poser();
    const parts = poidsPoches({ net: true });
    pres(parts.reduce((s, x) => s + x.value, 0), NET,
      'les poches font le patrimoine net');
    pres(parts.reduce((s, x) => s + x.pct, 0), 100, 'et leurs parts font cent');
  });

  test('les quatre catégories de la carte font aussi la base nette', () => {
    /* « Investi moins les dettes » plus les trois poches de cash. C'est
       l'égalité que le changement de base devait préserver, et la seule qui
       empêche la carte de mentir. */
    Fixture.poser();
    const t = nowTotals();
    const investi = t.invested - num(t.dettes);
    const cash = pochesLiquidites().reduce((s, p) => s + num(p.value), 0);
    pres(investi + cash, t.net, 'les quatre catégories font le patrimoine net');
    pres(t.net, NET, 'qui est bien le net du fixture');
  });

  test('sans dette, le net vaut le brut et rien ne change', () => {
    Fixture.poser(s => { for (const e of s.etabs) e.dettes = []; });
    const t = nowTotals();
    pres(t.dettes, 0, 'aucune dette');
    pres(t.net, t.brut, 'le net vaut le brut');
    const parts = poidsPoches({ net: true });
    pres(parts.reduce((s, x) => s + x.value, 0), t.brut, 'et les poches le redonnent');
    /* Et la poche immobilière retrouve sa valeur pleine. */
    pres(parts.find(x => x.key === 'immo').value, 120000, 'le studio pèse ce qu’il vaut');
  });

  test('Financier écarte les murs et ne retranche aucun crédit', () => {
    /* La règle déjà posée, et qu'il ne fallait surtout pas défaire en passant
       « Tout » au net : le prêt finance le bien, qui est écarté de cette vue.
       Retrancher un crédit immobilier d'un périmètre qui exclut l'immobilier
       serait une double faute. */
    Fixture.poser();
    const parts = poidsPoches({ financier: true, net: true });
    vrai(!parts.some(x => serieHorsFinancier(x.key)),
      'aucune poche hors périmètre financier');
    pres(parts.reduce((s, x) => s + x.value, 0), totalFinancier(),
      'la somme fait le patrimoine financier');
    /* Le point qui compte : la dette n'a ete retranchee de rien. */
    for (const x of parts) {
      pres(x.value, num(nowTotals()[x.key]),
        `« ${x.key} » garde sa valeur : aucun crédit immobilier ne s’y déduit`);
    }
    pres(parts.reduce((s, x) => s + x.pct, 0), 100, 'et les parts font cent');
  });

  test('une base qui ne se divise pas ne fabrique aucun pourcentage', () => {
    /* Un patrimoine net négatif est possible — un achat récent financé à
       crédit — et diviser par lui retournerait tous les signes. */
    Fixture.poser(s => {
      s.etabs.find(e => (e.dettes || []).length).dettes[0].montant = Fixture.BRUT * 2;
    });
    vrai(nowTotals().net < 0, 'le net est négatif');
    for (const x of poidsPoches({ net: true })) {
      eq(x.pct, null, `« ${x.key} » : aucun pourcentage sur une base négative`);
    }
    /* Les montants, eux, restent vrais : on ne force rien à zéro. */
    pres(poidsPoches({ net: true }).reduce((s, x) => s + x.value, 0), nowTotals().net,
      'et les montants disent la vérité, aussi désagréable soit-elle');
  });

  test('la carte, le camembert et le pied lisent la même base', () => {
    /* Le défaut d'origine : la carte comptait en brut et son pied annonçait un
       net, sans que rien ne dise lequel portait les pourcentages. Une base par
       mode, lue par une seule fonction. */
    const app = lireSource('assets/app.js');
    vrai(/const valeurBaseAlloc = \(\) => \(allocFinancier \? totalFinancier\(\) : nowTotals\(\)\.net\);/.test(app),
      'la base de « Tout » est le patrimoine net');
    vrai(/const baseAlloc = \(\) => \(allocFinancier \? BASES\.avoirsFinanciers : BASES\.net\);/.test(app),
      'et elle se nomme comme telle');
    /* Et la base des cartes qui decrivent des AVOIRS. Elle n'existait pas :
       trois cartes annonçaient le net, deux le totalisaient. */
    vrai(/const valeurAvoirsAlloc = \(\) => \(allocFinancier \? totalFinancier\(\) : patrimoine\(\)\.brut\);/.test(app),
      'la base des avoirs vaut le brut en vue globale');
    vrai(/const baseAvoirsAlloc = \(\) => \(allocFinancier \? BASES\.avoirsFinanciers : BASES\.avoirs\);/.test(app),
      'et elle se nomme « Tes avoirs »');
    /* Les deux lectures des poches passent le même mode, et le net avec. */
    eq((app.match(/pochesPatrimoine\(\{ financier: allocFinancier, net: true \}\)/g) || []).length, 2,
      'le tableau et le camembert lisent la même chose');
    /* Le pied ne dit plus qu'une ligne : trois montants sous une carte dont les
       pourcentages portaient sur le premier, personne ne pouvait dire lequel
       était la base. */
    /* Quatre cartes portent un « repart-pied » : celui d'Allocation se cherche
       depuis la carte, pas depuis le debut du fichier. Une ancre prise trop tot
       lit une autre carte et rend un vert qui ne parle pas du bon endroit. */
    const dep = app.indexOf('<dl class="kv repart-pied">', app.indexOf('${disponibilite.map('));
    const pied = app.slice(dep, app.indexOf('</dl>', dep));
    vrai(!/Patrimoine net<\/b>/.test(pied),
      'le net ne s’écrit plus deux fois dans le même pied');
    vrai(/de dettes déjà déduites/.test(pied),
      'la dette descend en sous-titre, où elle explique au lieu de concurrencer');
  });

  test('le classement ligne par ligne compte sur la base de sa carte', () => {
    /* Le defaut que ce controle attrape : passer la carte du haut en net sans
       son classement, qui continuait a compter en brut. Le meme appartement
       pesait alors 130 638 € dans la tranche « Immobilier » et 288 000 € dans
       la barre juste en dessous, dans la meme carte, sous une seule base
       annoncee. Et la carte promet explicitement que la barre la plus longue du
       bas est une part de la plus grosse tranche du haut. */
    Fixture.poser();
    const lignes = allocationByAsset({ credits: false, net: true });
    pres(lignes.reduce((s, l) => s + l.value, 0), nowTotals().net,
      'les lignes font le patrimoine net');
    pres(lignes.reduce((s, l) => s + l.pct, 0), 100, 'et leurs parts font cent');
    /* La ligne du bien porte sa quote-part de credit, donc exactement ce que la
       tranche du haut annonce. */
    const bien = lignes.find(l => l.label === 'Studio');
    const immo = poidsPoches({ net: true }).find(p => p.key === 'immo');
    pres(bien.value, immo.value, 'la barre du bas est la tranche du haut');
    pres(bien.value, 120000 - Fixture.DETTE, 'soit la valeur moins le credit');
  });

  test('une dette sans ligne a laquelle se rattacher reste comptée', () => {
    /* Une marge de courtier n'est adossee a aucune ligne : la retrancher au
       prorata de rien la ferait disparaitre, et la somme des parts cesserait
       d'egaler la base sans que rien ne le dise. Elle reste donc une ligne du
       classement. */
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_courtier').dettes =
        [{ id: 'd_marge', libelle: 'Marge', montant: 5000, note: '' }];
    });
    const lignes = allocationByAsset({ credits: false, net: true });
    pres(lignes.reduce((s, l) => s + l.value, 0), nowTotals().net,
      'la somme fait toujours le net');
    vrai(lignes.some(l => l.value < -0.005 || /Crédits/.test(l.label)),
      'la dette orpheline se voit plutôt qu’elle ne s’évapore');
  });

  test('deux prêts se rangent chacun sous leur bien', () => {
    /* Le prorata plutot qu'une poche unique : deux appartements finances par
       deux prets doivent chacun porter le leur, sinon le premier trouve paie
       pour les deux et les deux barres mentent. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_bien2', nom: 'Maison', notes: '',
        dettes: [{ id: 'd_pret2', libelle: 'Prêt', montant: 30000, note: '' }] });
      s.comptes.push({ id: 'c_immo2', etabId: 'e_bien2', type: 'immo',
        statut: 'ouvert', ouvertLe: '2024-01-01', numero: '', notes: '',
        libelle: 'Maison', court: 'Maison', alloc: '', cash: [],
        lignes: [{ id: 'l_immo2', classe: 'immobilier', libelle: 'Maison',
                   valeur: 80000, prixDeRevient: 80000, quantite: 1,
                   dateAcquisition: '' }] });
    });
    const lignes = allocationByAsset({ credits: false, net: true });
    pres(lignes.find(l => l.label === 'Studio').value, 120000 - Fixture.DETTE,
      'le studio porte son prêt, et lui seul');
    pres(lignes.find(l => l.label === 'Maison').value, 80000 - 30000,
      'la maison porte le sien');
    pres(lignes.reduce((s, l) => s + l.value, 0), nowTotals().net,
      'et les deux ensemble font le net');
  });

  test('la phrase de concentration nomme la base qu’elle divise', () => {
    /* Elle a menti deux fois pour l'avoir oublie : « de tes avoirs » sous un
       pourcentage financier, puis « de ton patrimoine net » sous un pourcentage
       brut. Le libelle et le diviseur viennent donc du meme endroit.

       Une concentration mesure une exposition : elle divise par les avoirs, en
       brut, et le studio finance a credit y pese sa valeur entiere. */
    Fixture.poser();
    const c = concentration();
    const lignes = allocationByAsset({ credits: false, parSociete: true })
      .filter(l => l.value > 0.005);
    pres(c.premiere.pct, lignes[0].value / nowTotals().brut * 100,
      'le pourcentage se divise par les avoirs');
    pres(c.premiere.value, 120000, 'le bien financé à crédit pèse sa valeur entière');
    pres(c.premiere.pct, lignes[0].pct, 'et c’est celui de la barre commentée');
    /* En financier, le diviseur change et le libelle avec lui. */
    const f = concentration({ financier: true });
    const lf = allocationByAsset({ credits: false, financier: true, parSociete: true })
      .filter(l => l.value > 0.005);
    pres(f.premiere.pct, lf[0].pct, 'même accord en périmètre financier');
    const src = lireSource('assets/app.js');
    const phrase = src.slice(src.indexOf('function phraseConcentration'),
                             src.indexOf('\n}\n', src.indexOf('function phraseConcentration')));
    vrai(/baseAvoirsAlloc\(\)\.de/.test(phrase) && !/baseAlloc\(\)\.de/.test(phrase),
      'la phrase nomme la base des avoirs, celle qu’elle divise');
  });

  test('la carte Répartition ne retranche pas la dette une seconde fois', () => {
    /* Un pied « Crédits en cours / Patrimoine net » sous deux tableaux qui
       comptent deja en net soustrairait la dette deux fois, et le total annonce
       ne serait plus celui que composent les parts juste au-dessus. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('data-anchor="actifs"');
    const carte = app.slice(i, app.indexOf('<div class="card"', i + 10));
    /* Le classement se monte hors du gabarit, donc hors de cette tranche. Il
       compte l'exposition, en brut, et l'annonce sous son titre. */
    vrai(/allocationByAsset\(\{ credits: false, financier: allocFinancier, parSociete: true \}\)/.test(app),
      'le classement de cette carte compte en brut, par société');
    vrai(!/trad\('Crédits en cours'\)/.test(carte),
      'et aucun pied ne retranche la dette une seconde fois');
  });

  test('« Investi » est devenu « Placements », partout à la fois', () => {
    /* Trois montants voisins sous trois noms voisins : « Tes titres », « Investi »,
       « Ton portefeuille ». Celui-ci est tout ce qui n'est pas des liquidites, et
       « investi » disait aussi le prix de revient d'une ligne. */
    const st = lireSource('assets/store.js');
    vrai(/place:\s+\{ nom: trad\('Placements'\),\s+de: trad\('de tes placements'\) \}/.test(st),
      'le mot se change à un seul endroit');
    vrai(!/trad\('Placé'\)/.test(st) && !/nom: trad\('Investi'\)/.test(st), 'et les anciens ne subsistent pas');
    eq(I18N.en['Placements'], 'Investments', 'la traduction suit');
    eq(I18N.en['de tes placements'], 'of your investments', 'et sa forme grammaticale');
    vrai(!I18N.en['de ce qui est investi'], 'la clef morte est partie');
  });
});

/* ------------------------------------------------------------------
   Le tirage vers le bas s'arme la ou quelque chose peut changer
   ------------------------------------------------------------------ */
suite('Tirer pour rafraîchir : les vues armées et celles qui se taisent', () => {

  test('les trois vues qui dépendent des cours sont armées', () => {
    const app = lireSource('assets/app.js');
    const m = app.match(/const VUES_TIRER = new Set\(\[([^\]]*)\]\);/);
    vrai(m, 'la liste des vues armées doit être trouvable');
    const vues = m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
    /* Allocation s'y ajoute : chacune de ses parts est un rapport dont les deux
       termes bougent avec les cours, le montant d'une poche et la base qui la
       divise. C'est la page ou l'on reste le plus longtemps a comparer. */
    for (const v of ['positions', 'overview', 'allocation']) {
      vrai(vues.includes(v), `« ${v} » doit répondre au tirage`);
    }
  });

  test('une vue armée est une vue qui existe', () => {
    /* Une clef mal orthographiee ne casse rien : le geste ne s'arme jamais, en
       silence, et personne ne sait dire pourquoi la page ne repond pas. */
    const app = lireSource('assets/app.js');
    const vues = app.match(/const VUES_TIRER = new Set\(\[([^\]]*)\]\);/)[1]
      .split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
    const connues = app.slice(app.indexOf('const VIEWS = {'),
                              app.indexOf('const VUES_TIRER'));
    for (const v of vues) {
      vrai(new RegExp(`\\n  ${v}:`).test(connues), `« ${v} » doit être une vue de VIEWS`);
    }
  });

  test('le budget ne s’arme pas, et c’est voulu', () => {
    /* Le geste confisque le rebond natif de la page : l'armer la ou rien ne
       vient du reseau prendrait un geste du navigateur pour ne rien rendre. */
    const app = lireSource('assets/app.js');
    const vues = app.match(/const VUES_TIRER = new Set\(\[([^\]]*)\]\);/)[1];
    for (const v of ['budget', 'depenses', 'donnees', 'preferences']) {
      vrai(!vues.includes(`'${v}'`), `« ${v} » ne vient pas du réseau`);
    }
  });

  test('le geste se monte au point commun, pas vue par vue', () => {
    /* Le defaut que ce controle attrape, et il ne se voyait pas : la liste des
       vues armees vit dans `VUES_TIRER`, mais les ecouteurs se posaient depuis
       deux fonctions de montage. Deux listes pour une seule verite. Ajouter une
       vue a `VUES_TIRER` sans ajouter son appel donnait un geste mort, sans
       erreur nulle part et avec la suite au vert.

       Pire, le defaut etait intermittent : `.view` est le meme noeud pour toutes
       les vues, donc des ecouteurs poses sur l'accueil vivaient ensuite partout.
       Passer par l'accueil armait la page suivante ; y arriver directement, par
       un signet ou un rechargement, ne l'armait pas. Le meme ecran repondait ou
       non selon le chemin qu'on avait pris pour y venir. */
    const app = lireSource('assets/app.js');
    const appels = (app.match(/^\s*monteTirerRafraichir\(\);/gm) || []);
    eq(appels.length, 1, 'un seul appel, sinon la liste se recopie');
    /* Et il se pose au montage commun, celui que toute vue traverse. */
    const i = app.indexOf("MOUNTS[key]?.();");
    vrai(i > 0, 'le point de montage commun doit être trouvable');
    const apres = app.slice(i, app.indexOf('renderSidebar();', i));
    vrai(/monteTirerRafraichir\(\);/.test(apres),
      'le geste se monte juste après le montage de la vue');
    /* Aucune vue ne le monte pour son compte. */
    for (const f of ['function mountOverview()', 'function mountPositions()',
                     'function mountAllocation()']) {
      const j = app.indexOf(f);
      if (j < 0) continue;
      const corps = app.slice(j, app.indexOf('\n}', j));
      vrai(!/monteTirerRafraichir\(\)/.test(corps),
        `« ${f} » ne monte plus le geste pour son compte`);
    }
  });

  test('le tirage ne relance qu’une seule action, celle des cours', () => {
    /* Deux chemins vers la meme actualisation finiraient par diverger : la
       pastille de Marches et le tirage doivent appeler le meme code, sinon
       l'un oublierait un jour d'oublier les reperes du ruban. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('function monteTirerRafraichir()');
    const bloc = app.slice(i, app.indexOf('\n}', app.indexOf('touchcancel', i)));
    eq((bloc.match(/ACTIONS\['refresh-quotes'\]\(\)/g) || []).length, 1,
      'le geste passe par l’action des cours, et par elle seule');
    vrai(!/Quotes\.refresh\(/.test(bloc),
      'et jamais par un second chemin qui doublerait cette action');
  });
});

/* ------------------------------------------------------------------
   Le prix d'une part se deduit, il ne se saisit pas
   ------------------------------------------------------------------ */
suite('Parts de société : un nombre saisi, deux prix déduits', () => {

  test('le prix de revient d’une part est le montant divisé par leur nombre', () => {
    /* Cinq cents parts pour deux mille euros font quatre euros la part. Ce
       chiffre existe deja dans les donnees : rien de neuf ne se stocke. */
    const u = prixParPart({ parts: 500, prixDeRevient: 2000, valeur: 2000 });
    pres(u.parts, 500, 'le nombre de parts');
    pres(u.revient, 4, 'quatre euros la part');
    pres(u.valeur, 4, 'et elle en vaut toujours quatre');
    pres(u.multiple, 1, 'donc le multiple vaut un');
  });

  test('c’est l’écart entre les deux prix qui sert', () => {
    /* Un prix de revient isole ne se compare a rien. Rapporte au prix
       d'aujourd'hui — celui d'une levee, d'un pacte — il dit enfin quelque
       chose : la part payee quatre euros en vaut six, soit une fois et demie. */
    const u = prixParPart({ parts: 500, prixDeRevient: 2000, valeur: 3000 });
    pres(u.revient, 4, 'quatre euros payés');
    pres(u.valeur, 6, 'six euros aujourd’hui');
    pres(u.multiple, 1.5, 'une fois et demie');
  });

  test('sans nombre de parts, aucun prix unitaire n’est inventé', () => {
    /* `null` et non zero : « 0,00 € la part » se lirait comme une mesure alors
       que c'est une absence de mesure. */
    eq(prixParPart({ prixDeRevient: 2000, valeur: 2000 }), null, 'aucune part déclarée');
    eq(prixParPart({ parts: 0, prixDeRevient: 2000 }), null, 'zéro part');
    eq(prixParPart({ parts: -10, valeur: 500 }), null, 'un nombre négatif');
    eq(prixParPart(null), null, 'aucune ligne');
  });

  test('un montant manquant tait son prix, l’autre reste dit', () => {
    const sansRevient = prixParPart({ parts: 500, valeur: 3000 });
    eq(sansRevient.revient, null, 'pas de prix de revient sans montant investi');
    pres(sansRevient.valeur, 6, 'la valeur du jour, elle, se divise');
    eq(sansRevient.multiple, null, 'et aucun multiple ne se calcule sur rien');
  });

  test('une part à moins d’un centime garde ses décimales', () => {
    /* Une part peut valoir 0,0012 €, et « 0,00 € » se lirait comme zero. Les
       decimales suivent l'ordre de grandeur, et seulement quand il le faut. */
    const u = prixParPart({ parts: 2000000, prixDeRevient: 2400, valeur: 2400 });
    pres(u.revient, 0.0012, 'un peu plus d’un millieme d’euro');
    vrai(/0[.,]0012/.test(fmtPart(u.revient)), 'écrit avec quatre décimales : ' + fmtPart(u.revient));
    vrai(/^4[.,]00/.test(fmtPart(4).replace(/\s/g, '')), 'au-dessus du centime, deux : ' + fmtPart(4));
  });

  test('le type déclare qu’il se divise en parts, la vue ne le devine pas', () => {
    /* Le drapeau vit sur le type comme `prete` et `titres` : un `id === 'pe'`
       ecrit dans la vue aurait ete une seconde liste a tenir. */
    const pe = TYPES_COMPTE.find(t => t.id === 'pe');
    vrai(pe.parts, '« Parts de société » se divise en parts');
    const pret = TYPES_COMPTE.find(t => t.id === 'crowdfunding');
    vrai(!pret.parts, 'un prêt participatif n’a pas de parts');
    const app = lireSource('assets/app.js');
    vrai(/type && type\.parts \? \[\{ cle: 'parts'/.test(app),
      'le champ suit le drapeau du type, pas un identifiant écrit dans la vue');
    vrai(!/id === 'pe'/.test(app), 'et aucun test d’identifiant ne le double');
  });

  test('le nombre de parts se conserve, le prix unitaire jamais', () => {
    /* Deux champs pour la meme valeur ne se verifient pas accordes : c'est la
       faute que cette base de code corrige le plus souvent. */
    const app = lireSource('assets/app.js');
    const lit = app.slice(app.indexOf('function litPlacement'),
                          app.indexOf('\n}', app.indexOf('function litPlacement')));
    vrai(/parts: num\(v\.parts\) \|\| null/.test(lit), 'le nombre de parts s’écrit');
    vrai(!/revientParPart|prixUnitaire|pru/i.test(lit),
      'et aucun prix unitaire ne se stocke à côté');
  });
});

/* ------------------------------------------------------------------
   Le prix d'une part se saisit, et le total reste la verite
   ------------------------------------------------------------------ */
suite('Le premier relevé : une seule porte, et une question avant', () => {

  const app = () => lireSource('assets/app.js');

  test('une page vide n’offre qu’un chemin vers le relevé', () => {
    /* TROIS PORTES VERS LE MEME GESTE, C'EST DEUX DE TROP. Sur une page encore
       vide, le rappel du mois en cours, le bouton de l'en-tête et celui de
       l'état vide ouvraient tous la même fenêtre. L'état vide garde le sien :
       il est le seul des trois à expliquer ce qu'est un relevé. Vu à l'écran. */
    const src = app();
    const vue = src.slice(src.indexOf('const vide = pasAFaire(\'comptes\')'),
                          src.indexOf('Entrées et sorties exceptionnelles'));
    vrai(/const vide = pasAFaire\('comptes'\) \|\| !tous\.length \|\| !lignes\.length;/.test(src),
      'la page sait quand elle n’a rien à montrer');
    vrai(/\$\{vide \? '' : `<button class="btn sm" data-action="ajouter-releve">/.test(vue),
      'l’en-tête ne propose plus le geste quand il n’y a rien');
    vrai(/if \(!attente\.missing \|\| !tous\.length\) return '';/.test(vue),
      'et le rappel du mois se tait tant qu’aucun relevé n’existe');
    /* Le bouton de l'etat vide, lui, reste : c'est celui qu'on garde. */
    vrai(/Enregistrer ton premier relevé/.test(vue), 'l’état vide garde le sien');
  });

  test('le bouton dit que c’est le premier', () => {
    /* Il disait « Enregistrer un relevé » sous un texte qui parle du premier :
       le libellé doit dire le geste qu'on vient faire, et ce pas ne s'affiche
       que tant qu'aucun relevé n'existe. */
    const pas = PREMIERS_PAS.find(p => p.cle === 'releves');
    /* IL EST REVENU A « un relevé », et la raison est une mesure : la rangée
       d'un pas donne à son bouton une demi-carte, soit 150 px à 375 px, et
       « Enregistrer ton premier relevé » en demande 194. Il s'y plierait en
       deux lignes à côté d'un bouton d'une seule. « Premier » n'est pas perdu
       pour autant : le titre du pas le dit, et la consigne juste au-dessus
       aussi. */
    eq(pas.bouton, 'Enregistrer ton premier relevé', 'le pas le dit');
    vrai(!!I18N.en[pas.bouton], 'et il existe en anglais');
    vrai(/premier relevé/.test(pas.titre + ' ' + pas.quoi),
      'et « premier » se lit dans le titre et la consigne');
  });

  test('déclarer l’inventaire depuis le relevé éteint la question du guide', () => {
    /* Le controle porte sur le MODELE : une seule clef pour un seul fait. */
    Fixture.poser();
    Store.state.monthly = [];
    Store.state.meta = { ...(Store.state.meta || {}), notifsMasquees: [] };
    vrai(!inventaireDeclareComplet(), 'au départ, rien n’est déclaré');
    masquerNotif(CLE_INVENTAIRE);
    vrai(inventaireDeclareComplet(), 'la déclaration prend');
    /* `pasDeclare` dit que la déclaration du pas est faite : le guide cesse
       alors de poser la question, puisqu'elle vient d'être répondue ailleurs. */
    vrai(pasDeclare(PAS_PAR_CLE['comptes']),
      'et le pas du guide tient sa réponse, sans la reposer');
  });
});

suite('On ne répond pas « tout y est » sans pouvoir regarder', () => {

  test('chaque pas qui pose la question offre d’aller voir la liste', () => {
    /* LE GESTE QUI MANQUAIT. Le pas demande une déclaration que l'application
       ne peut pas déduire, et il n'offrait que deux réponses : oui, ou ajouter.
       Quelqu'un qui ne se souvient plus de ce qu'il a saisi n'avait donc le
       choix qu'entre affirmer au hasard et rajouter un doublon. */
    for (const p of PREMIERS_PAS.filter(x => x.declare)) {
      vrai(!!p.declare.voir, '« ' + p.cle + ' » sait où envoyer regarder');
      vrai(!!p.declare.voir.libelle, 'et le renvoi porte un libellé');
      vrai(!!(p.declare.voir.vue || p.declare.voir.action),
        'et une destination, page ou fenêtre');
      vrai(!!I18N.en[p.declare.voir.libelle],
        '« ' + p.declare.voir.libelle + ' » existe en anglais');
    }
  });

  test('le relevé n’en a pas, et c’est voulu', () => {
    /* UN SEUL RELEVE SUFFIT : rien n'est à vérifier, donc aucune question n'est
       posée, donc aucun renvoi. Une liste vide n'apprendrait rien à qui n'en a
       pas encore pris. Le renvoi suit la question, pas le pas. */
    const r = PREMIERS_PAS.find(p => p.cle === 'releves');
    vrai(!r.declare, 'le relevé ne demande pas si tout y est');
    for (const p of PREMIERS_PAS) {
      if (!p.declare) vrai(!p.voir, '« ' + p.cle + ' » ne porte pas de renvoi hors question');
    }
  });

  test('les destinations existent, et portent déjà de quoi ajouter', () => {
    /* Un renvoi qui mènerait sur une page inconnue ferait pire que rien. Les
       vues se lisent dans la table des routes, jamais dans une seconde liste
       écrite à côté. Et la destination doit porter son propre bouton d'ajout,
       sinon quelqu'un qui découvre un oubli en la lisant s'y retrouve coincé. */
    const app = lireSource('assets/app.js');
    const routes = app.slice(app.indexOf('const ROUTES'), app.indexOf('const ROUTES') + 1500);
    for (const p of PREMIERS_PAS.filter(x => x.declare && x.declare.voir.vue)) {
      vrai(routes.includes(`'${p.declare.voir.vue}'`) || app.includes(`data-view="${p.declare.voir.vue}"`),
        '« ' + p.declare.voir.vue + ' » est une route connue');
    }
    for (const p of PREMIERS_PAS.filter(x => x.declare && x.declare.voir.action)) {
      vrai(new RegExp(`'${p.declare.voir.action}'\\(`).test(app),
        '« ' + p.declare.voir.action + ' » est une action déclarée');
    }
  });

  test('le patrimoine passe avant le guide dès la première donnée', () => {
    /* LA CARTE ENTIÈRE OCCUPAIT TOUT LE PREMIER ÉCRAN D'UN TÉLÉPHONE, y compris
       chez quelqu'un qui avait quatre établissements et quarante relevés : son
       patrimoine passait sous la ligne de flottaison, derrière un tutoriel. Sur
       une application de patrimoine, c'est l'inverse de la hiérarchie. Mesuré à
       375 px : le hero finissait à 1 150 px.

       Dès qu'un premier compte existe, le guide se replie en une barre d'une
       ligne, cliquable, posée SOUS le patrimoine. Sur un état vierge il garde
       sa pleine taille et sa place devant : il est alors la seule chose à lire.
       Le guide n'est pas supprimé — c'est sa taille après le début qui l'était. */
    const app = lireSource('assets/app.js');
    const carte = app.slice(app.indexOf('function carteDemarrage()'),
                            app.indexOf('function ', app.indexOf('function carteDemarrage()') + 10));
    vrai(/const vierge = !aUnComptePropre\(\);/.test(carte), 'le premier compte fait basculer');
    vrai(/if \(!vierge && !fini && !guideDeplie\) \{/.test(carte),
      'la barre ne se rend que repliée, hors état vierge, hors fin');
    vrai(/class="card demarrage demarrage-barre card-cliquable"/.test(carte),
      'et c’est une carte, pour qu’on la reconnaisse');
    vrai(/data-action="basculer-demarrage"/.test(carte), 'elle se déplie d’un geste');
    /* La vue place le guide devant SEULEMENT sur un etat vierge, et derriere le
       hero sinon : deux emplacements, un seul drapeau, jamais les deux a la fois. */
    /* La tranche court jusqu'a la fonction suivante : bornee a un nombre de
       caracteres, elle s'arretait avant le second emplacement du guide et
       le controle passait au rouge sur du code juste. */
    const dv = app.indexOf('function viewOverview()');
    const vue = app.slice(dv, app.indexOf('\nfunction ', dv + 10));
    const devant = vue.indexOf("${guideDevant ? guide : ''}");
    const hero = vue.indexOf('<div class="hero">');
    const derriere = vue.indexOf("${guideDevant ? '' : guide}");
    vrai(devant > 0 && hero > devant && derriere > hero,
      'devant le hero sur un état vierge, derrière lui dès qu’il y a un patrimoine');
    vrai(/const guideDevant = !aUnComptePropre\(\);/.test(vue),
      'et la même condition décide des deux');
    /* Les bandeaux d'exploitation attendent toujours que le guide ait fini :
       replie, il existe encore, et le rappel du releve redoublerait son pas 3. */
    vrai(/moisEnAttente\.missing && !guide/.test(vue), 'les bandeaux attendent, barre ou carte');
    vrai(/'basculer-demarrage'\(\) \{\s*\n\s*guideDeplie = !guideDeplie;/.test(app),
      'la bascule est un état de lecture, rien ne s’enregistre');
    vrai(!!I18N.en['Replier'], '« Replier » existe en anglais');
  });

  test('rouvrir un pas, c’est redémander sa question', () => {
    /* IL RÉPONDAIT PAR LE MODE D'EMPLOI. Un pas franchi qu'on rouvrait montrait
       sa consigne et son bouton d'ajout, en gardant sa coche : on y revenait
       pour vérifier, et l'application ne reposait jamais la seule chose qu'elle
       ne sait pas déduire. Vu à l'écran, sur le pas des comptes.

       UN SEUL MOT LE DIT, ET TOUT EN DÉCOULE : le marqueur repasse au numéro, le
       compteur recule, le pas redevient courant, et sa question s'affiche. Une
       seconde condition posée à côté de chacun aurait fini par en contredire
       une autre. */
    const app = lireSource('assets/app.js');
    const carte = app.slice(app.indexOf('function carteDemarrage()'),
                            app.indexOf('function ', app.indexOf('function carteDemarrage()') + 10));
    vrai(/const acquis = p => \(pasDeplie === p\.cle && p\.declare \? false/.test(carte),
      'un pas rouvert n’est plus acquis');
    /* Seuls les pas qui POSENT une question reculent : le releve n'en a pas,
       il n'y a rien a re-declarer, et lui retirer sa coche ne dirait rien. */
    vrai(/pasDeplie === p\.cle && p\.declare/.test(carte),
      'et seulement ceux qui posent une question');
    const act = app.slice(app.indexOf("'declarer-pas'(btn) {"),
                          app.indexOf("'declarer-pas'(btn) {") + 700);
    vrai(/pasDeplie = null;/.test(act),
      'répondre referme le pas qu’on venait de rouvrir');
  });

  test('tous les boutons d’un pas ont la même taille', () => {
    /* DEUX MESURES, DEUX DÉFAUTS. Un pas qui n'offre que son geste laissait sa
       largeur suivre la longueur de son libellé : « Entrer tes comptes » faisait
       130 px là où « Oui, tout y est », juste dessous, en faisait 134. Et deux
       colonnes à 375 px n'en laissent que 134, où « Ajouter une rentrée » et
       « Entrer ton salaire net » se plient en deux lignes : 46 px de haut à
       côté d'un voisin de 30, ce qui est le défaut qu'on venait corriger.

       La grille décide de la largeur, le bouton l'occupe ; et sous 768 px elle
       s'empile, comme les rangées des fiches et pour la même mesure. Tous les
       boutons du guide font alors exactement la même largeur, un ou deux, et
       aucun libellé ne se replie. */
    const app = lireSource('assets/app.js');
    const carte = app.slice(app.indexOf('function carteDemarrage()'),
                            app.indexOf('function ', app.indexOf('function carteDemarrage()') + 10));
    eq((carte.match(/<span class="pas-actes">/g) || []).length, 2,
      'les deux branches posent la même rangée');
    vrai(!/<span class="paire-btn">/.test(carte),
      'et plus aucune ne garde l’ancienne');
    const css = lireSource('assets/styles.css');
    const regle = css.slice(css.indexOf('.pas-actes {'), css.indexOf('.pas-voir {'));
    vrai(/grid-template-columns: 1fr 1fr/.test(regle), 'deux colonnes de même fraction');
    vrai(/@media \(max-width: 767px\) \{\s*\.pas-actes \{ grid-template-columns: 1fr; \}/
      .test(regle), 'et une seule sous 768 px');
  });

  test('c’est un lien, pas un troisième bouton', () => {
    /* Trois boutons sur une rangee font 107 px chacun a 375 px, et le libelle du
       lien vers les charges fixes s'y plierait en trois lignes. Trois niveaux,
       trois traitements : plein pour la reponse, fantome pour l'ajout, lien
       pour aller lire. La hierarchie se dit par le remplissage, jamais par la
       taille. */
    const app = lireSource('assets/app.js');
    const f = app.slice(app.indexOf('function renvoiPas(p) {'),
                        app.indexOf('function carteDemarrage()'));
    vrai(/class="lien-nu pas-voir"/.test(f), 'le renvoi porte le style de lien');
    const carte = app.slice(app.indexOf('function carteDemarrage()'),
                            app.indexOf('function ', app.indexOf('function carteDemarrage()') + 10));
    vrai(!/<span class="paire-btn">[\s\S]{0,500}pas-voir/.test(carte),
      'et vit hors de la rangée de boutons');
    const css = lireSource('assets/styles.css');
    vrai(/\.pas-voir \{/.test(css), 'il a sa règle');
    /* IL PASSE A LA LIGNE DE LUI-MEME. Les deux branches du pas n'ont pas la
       même forme : celle de la question pose une rangée de deux boutons, qui
       occupe sa ligne, et le renvoi tombait dessous ; celle d'un pas rouvert
       n'a qu'un bouton, reste en ligne, et le renvoi venait se coller à sa
       droite. Deux places pour un même élément selon l'écran, sans que rien ne
       le décide. Vu à l'écran, sur les pas 1 et 2 l'un au-dessus de l'autre. */
    const regle = css.slice(css.indexOf('.pas-voir {'),
                            css.indexOf('}', css.indexOf('.pas-voir {')));
    vrai(/display: block/.test(regle), 'il occupe sa propre ligne, dans les deux branches');
    /* `width: fit-content` garde le souligné sous le seul texte : un bouton en
       bloc s'étendrait sur toute la largeur et centrerait son libellé, ce qui en
       ferait un troisième bouton à l'œil. */
    vrai(/width: fit-content/.test(regle), 'sans s’étendre sur toute la largeur');
    vrai(!/display: inline/.test(regle), 'et plus rien ne le remet en ligne');
  });

  test('un pas qu’on rouvre garde son chemin vers la liste', () => {
    /* DEUX BRANCHES, UN SEUL BESOIN. Le renvoi n'a d'abord existé que sous la
       question « as-tu tout mis ? ». Or un pas franchi qu'on rouvre pour
       vérifier montre sa consigne et son bouton d'ajout, dans l'AUTRE branche du
       rendu : il perdait donc le seul chemin vers la liste au moment précis où
       l'on venait la relire. Vu à l'écran, sur le pas des comptes rouvert.

       La condition est la même des deux côtés, et c'est `pasAFaire` qui la
       porte — dès qu'un premier élément existe, il y a quelque chose à
       regarder. On ne lui écrit pas une seconde règle à côté. */
    const app = lireSource('assets/app.js');
    const carte = app.slice(app.indexOf('function carteDemarrage()'),
                            app.indexOf('function ', app.indexOf('function carteDemarrage()') + 10));
    eq((carte.match(/\$\{renvoiPas\(p\)\}/g) || []).length, 2,
      'les deux branches posent le renvoi');
    const f = app.slice(app.indexOf('function renvoiPas(p) {'),
                        app.indexOf('function carteDemarrage()'));
    vrai(/if \(!v \|\| pasAFaire\(p\.cle\)\) return '';/.test(f),
      'et rien tant qu’il n’y a rien à voir');
  });
});

suite('Une valeur qu’on apprécie porte la date où on l’a établie', () => {

  const champs = () => {
    const app = lireSource('assets/app.js');
    return app.slice(app.indexOf('function champsPlacement'),
                     app.indexOf('function litPlacement'));
  };

  test('les parts de société y ont droit, comme une montre', () => {
    /* La question « depuis quand ce chiffre tient-il ? » ne se posait pas là où
       elle se pose le plus : une valeur de part vieillit entre deux levées, et
       rien à l'écran ne disait depuis quand. Vu à l'écran. */
    vrai(/const estime = estValeurEstimee\(type\);/.test(champs()),
      'le champ suit le même prédicat que le mot « estimation »');
    vrai(estValeurEstimee(TYPES_COMPTE.find(t => t.id === 'pe')),
      'et une part de société en est une');
    /* UN SEUL PREDICAT POUR UN SEUL FAIT : celui qui décide du mot décide aussi
       de la date qui l'accompagne. Deux règles auraient fini par se contredire,
       et l'écran aurait dit « estimation actuelle » sans jamais la dater. */
    vrai(!/const estime = estDetenuEnDirect\(type\)/.test(champs()),
      'et l’ancienne règle ne subsiste pas à côté');
  });

  test('la bulle ne promet plus un rappel qui n’existe pas', () => {
    /* `valeurPerimee()` existe, `aRevoir` se calcule, et AUCUN écran ne les lit
       — ni la cloche, ni une carte. Le texte annonçait pourtant que la cloche
       réclamerait cette valeur au bout d'un an. Une bulle qui promet ce que
       l'application ne fait pas est un mensonge de la même famille qu'un
       commentaire périmé, et celui-là se serait propagé à chaque type ajouté. */
    const app = lireSource('assets/app.js');
    vrai(!/la cloche te rappellera de la revoir/.test(app),
      'la promesse est retirée');
    vrai(/'le jour où tu as établi ce chiffre'/.test(app),
      'et la bulle dit ce que la date est');
    vrai(!!I18N.en['le jour où tu as établi ce chiffre'], 'en anglais aussi');
    /* Le controle qui garde la reparation : le jour ou la cloche saura le
       reclamer, `valeurPerimee` sera lue quelque part. Tant qu'elle ne l'est
       pas, aucun texte ne doit le pretendre. */
    const st = lireSource('assets/store.js');
    vrai(/function valeurPerimee\(/.test(st), 'la mécanique attend, elle');
  });

  test('« Nom, dates et notes » porte enfin une note', () => {
    /* LE LIEN PROMETTAIT UNE NOTE, ET LA FENÊTRE N'EN AVAIT PAS. Sur la fiche
       d'un placement en parts, la note se LIT et ce lien est le seul chemin vers
       son écriture : sans ce champ, elle n'était modifiable nulle part. Le
       commentaire de la carte l'annonçait déjà — « le nom, les dates et la note
       vivent dans l'autre formulaire » — il ne restait qu'à le rendre vrai. */
    const app = lireSource('assets/app.js');
    const f = membreAction(app, 'modifier-compte');
    vrai(/cle: 'notes', label: 'Notes', type: 'texte'/.test(f),
      'la fenêtre offre la note');
    vrai(/valeur\('notes', c\.notes \|\| ''\)/.test(f),
      'pré-remplie avec celle du compte');
    vrai(/if \('notes' in v\) pose\('notes', String\(v\.notes \|\| ''\)\.trim\(\)\);/.test(f),
      'et la réécrit, un champ vide effaçant plutôt qu’écrivant du vide');
    /* DEUX PORTES SUR LE MEME CHAMP, ce qui est sain ; deux champs pour une
       même valeur ne le serait pas. Les autres fiches gardent leur saisie à
       découvert, et c'est bien le même `comptes.N.notes`. */
    vrai(/data-path="comptes\.\$\{idx\}\.notes"/.test(app),
      'la saisie à découvert reste, sur le même chemin');
    /* ET C'EST DESORMAIS LE SEUL REGIME : le lien « Nom, dates et notes » a
       disparu avec la carte fusionnee qui le portait. Un actif en parts a la
       meme carte « Informations » que les autres, donc la meme note ouverte. */
    vrai(!/trad\('Nom, dates et notes'\)/.test(app),
      'et le lien de contournement n’a plus lieu d’être');
  });
});

finDePartieDeTests('tests/03-source-se-lit-fois.tests.js');
