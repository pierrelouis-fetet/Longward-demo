partieDeTests('tests/18-releve-note-sa-propre.tests.js');
/* Un releve note sa propre ventilation en poches. Sans elle, la poche se
   deduisait du TYPE du compte, et le cash qui dort chez un courtier comptait en
   actifs de marche dans l'historique quand l'ecran d'aujourd'hui le range en
   liquidites : le meme argent dans deux poches selon le point de la courbe. */
suite('Un relevé note sa propre ventilation', () => {

  /* Ce que « prendre la photo » inscrit : un montant par compte, tel que
     `nowValue` le rend. */
  const photo = () => Object.fromEntries(
    ACCOUNTS.map(a => [a.id, round2(nowValue(a.id))]));
  const somme = o => Object.values(o).reduce((s, x) => s + num(x), 0);

  test('l’export dit un total qui est vraiment le total', () => {
    /* « Total net worth » valait `cash + bourse + pe` : trois poches sur sept.
       La crypto, l'immobilier, les biens de valeur et le capital garanti en
       etaient absents, et il n'etait pas net non plus. Un fichier qu'on ouvre
       justement pour verifier ne peut pas se tromper sur sa colonne de total. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const f = src.slice(src.indexOf('function sheetHistory()'),
                        src.indexOf('function sheetSales()'));
    vrai(f.length > 400, 'la feuille doit être trouvable');
    vrai(!/g\.cash \+ g\.bourse \+ g\.pe/.test(f),
      'plus de total écrit à la main sur trois poches');
    vrai(/round2\(rowTotal\(r\)\)/.test(f) && /round2\(rowNet\(r\)\)/.test(f),
      'le brut et le net sont deux colonnes, chacune nommée par ce qu’elle contient');
    vrai(/poches\.map\(s => \(\{ h: s\.label/.test(f),
      'et les poches se dérivent de la table, sans en citer trois à la main');
    vrai(/cashDuReleve\(r, a\.id\)/.test(f),
      'une colonne « dont cash » pour les comptes qui portent les deux');
  });

  test('la somme des poches fait le total du relevé', () => {
    /* La regle cardinale de la maison, et c'est elle qui attrape une poche
       oubliee : un montant range nulle part disparait d'une bande sans quitter
       le total, ou l'inverse. */
    Fixture.poser();
    const v = photo();
    pres(somme(pochesDuReleve(v)), somme(v), 'sur une photo de l’état courant');

    /* Et sur des montants saisis a la main, qui ne sont pas ceux du jour. */
    const saisi = Object.fromEntries(Object.entries(v).map(([k, m]) => [k, num(m) * 1.5]));
    pres(somme(pochesDuReleve(saisi)), somme(saisi), 'sur des montants saisis');
  });

  test('le cash qui dort chez un courtier ne compte pas en actifs de marché', () => {
    /* Le defaut, sur des nombres. Un compte-titres qui porte une ligne et du
       cash a investir : la poche du compte les rangeait tous les deux en
       bourse, puisqu'elle se deduisait du type. */
    Fixture.poser();
    const cpt = Store.state.comptes.find(c => typeCompte(c.type).titres);
    vrai(!!cpt, 'le fixture doit porter un compte à titres');
    Store.state.positions = [{ id: 'p_x', name: 'ETF', symbol: 'X', qty: 10, price: 100,
      buyPrice: 90, currency: 'EUR', fx: 1, account: cpt.id,
      assetClass: 'actions', manual: false }];
    cpt.cash = [{ montant: 400, affectation: 'investir' }];
    Store.state.comptes = [cpt];
    refreshAccounts();

    const g = pochesDuReleve(photo());
    pres(g.bourse, 1000, 'la ligne cotée compte en actifs de marché');
    pres(g.cash, 400, 'et le cash à investir en liquidités, pas avec elle');
  });

  test('un relevé pris aujourd’hui s’accorde avec « Auj. », poche par poche', () => {
    /* C'est la couture, et c'est ce que le detenteur voit : le dernier point
       enregistre et le point du jour doivent parler le meme langage. Ils
       differaient exactement du montant a investir. */
    Fixture.poser();
    const g = pochesDuReleve(photo());
    const now = nowByGroup();
    for (const poche of POCHES_EVOLUTION)
      pres(g[poche], round2(num(now[poche])), `la poche « ${poche} » s’accorde`);
  });

  test('la table des poches se dérive, et n’oublie personne', () => {
    /* Deux listes ecrites a la main pour une meme verite finissent par se
       contredire : celle-ci doit couvrir toutes les classes connues, et ne
       citer que des poches que le graphique trace. */
    for (const classe of Object.keys(CLASSES_ACTIFS))
      vrai(POCHE_EVOLUTION_DE_CLASSE[classe],
        `la classe « ${classe} » doit avoir une poche`);
    for (const poche of Object.values(POCHE_EVOLUTION_DE_CLASSE))
      vrai(POCHES_EVOLUTION.includes(poche),
        `la poche « ${poche} » doit être tracée par le graphique`);
  });

  test('un relevé qui porte sa ventilation la donne ; les anciens gardent l’ancienne', () => {
    Fixture.poser();
    const v = photo();
    const notee = pochesDuReleve(v);

    /* Le releve porte son champ : c'est lui qu'on lit, mot pour mot. */
    const g = rowGroups({ date: '2026-01-31', v, poches: notee });
    for (const poche of POCHES_EVOLUTION)
      pres(g[poche], notee[poche], `« ${poche} » vient du relevé lui-même`);

    /* Sans le champ, le repli d'avant : la poche vient du type du compte. Il
       reste juste sur le total, et c'est tout ce qu'on peut lui demander. */
    const ancien = rowGroups({ date: '2025-01-31', v });
    pres(somme(ancien), somme(v), 'un ancien relevé totalise encore juste');
    for (const poche of POCHES_EVOLUTION)
      vrai(typeof ancien[poche] === 'number' && !Number.isNaN(ancien[poche]),
        `« ${poche} » vaut un nombre, jamais undefined`);
  });

  test('l’enregistrement note la ventilation avec les montants', () => {
    /* Elle ne peut se calculer qu'a cet instant : apres coup, la ligne ne garde
       qu'un total par compte et rien ne dit plus ce qui dormait en liquidites. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const f = src.slice(src.indexOf('function appliquerReleve('),
                        src.indexOf('async function viderOuSupprimerMois'));
    vrai(/row\.parts = partsDuReleve\(saisi\.v\);/.test(f),
      'la ventilation se note au moment où le relevé s’écrit');
    vrai(f.indexOf('row.v = saisi.v') < f.indexOf('row.parts ='),
      'après les montants dont elle se calcule');
    /* Une seule verite stockee : le total se derive du detail. */
    vrai(/delete row\.poches;/.test(f),
      'et le total global part, pour qu’il ne puisse pas contredire le détail');
  });

  test('la ventilation se garde compte par compte', () => {
    /* « Combien de cash sur le PEA en mars ? » ne se repond que si la ligne
       garde le detail. Le total global s'en derive ; l'inverse est perdu. */
    Fixture.poser();
    const cpt = Store.state.comptes.find(c => typeCompte(c.type).titres);
    Store.state.positions = [{ id: 'p_y', name: 'ETF', symbol: 'Y', qty: 6, price: 100,
      buyPrice: 90, currency: 'EUR', fx: 1, account: cpt.id,
      assetClass: 'actions', manual: false }];
    cpt.cash = [{ montant: 400, affectation: 'investir' }];
    Store.state.comptes = [cpt];
    refreshAccounts();

    const v = Object.fromEntries(ACCOUNTS.map(a => [a.id, round2(nowValue(a.id))]));
    const parts = partsDuReleve(v);
    pres(parts[cpt.id].cash, 400, 'le cash du compte est noté à part');
    pres(parts[cpt.id].bourse, 600, 'et les titres avec les titres');
    pres(cashDuReleve({ parts }, cpt.id), 400, 'et se relit compte par compte');
    eq(cashDuReleve({ parts }, 'inconnu'), null, 'un compte sans détail ne ment pas');

    /* Le global n'est plus qu'une somme du detail. */
    const g = sommerParts(parts);
    for (const poche of POCHES_EVOLUTION)
      pres(g[poche], pochesDuReleve(v)[poche], `« ${poche} » se dérive du détail`);
  });

  test('un compte de l’ancien modèle ne fait pas tomber le calcul', () => {
    /* Une entree orpheline n'a pas de compte derriere elle : `cashCompte` y
       levait une exception des qu'un releve portait un montant dessus. Ce
       chemin-la existe vraiment — des releves de 2025 en portent. */
    Fixture.poser();
    Store.state.accounts = [{ id: 'c_vieux', label: 'TR PEA (2025)', group: 'bourse' }];
    refreshAccounts();
    const parts = partsDuReleve({ c_vieux: 1500 });
    pres(parts.c_vieux.bourse, 1500,
      'il se range dans la poche de son type, sans exception levée');
  });

  test('rowGroups lit le détail, puis le global, puis le type de compte', () => {
    /* Trois generations de releves coexistent, et la cascade doit les rendre
       toutes les trois lisibles. */
    Fixture.poser();
    const detail = rowGroups({ v: {}, parts: { x: { cash: 10, bourse: 90 } } });
    pres(detail.cash, 10, 'le détail d’abord');
    pres(detail.bourse, 90, 'poche par poche');
    const global = rowGroups({ v: {}, poches: { cash: 5, bourse: 15 } });
    pres(global.cash, 5, 'puis le global, pour les relevés écrits entre les deux');
    const vieux = rowGroups({ v: {} });
    pres(Object.values(vieux).reduce((s, x) => s + x, 0), 0,
      'et un relevé sans rien retombe sur la déduction, sans NaN');
  });
});

/* Retirer un compte clos, c'est effacer une donnee : la suite porte surtout sur
   ce qu'on ne retire PAS. */
/* Le deplacement lui-meme : Donnees n'en parle plus, Actifs porte tout. */
suite('Les anciens comptes se gèrent depuis Actifs, et nulle part ailleurs', () => {

  /* Deux comptes archives — ils ont une fiche, donc ils se restaurent — et une
     entree de l'ancien modele, qu'un releve mentionne. */
  const poser = () => {
    Fixture.poser();
    Store.state.comptes = [
      { id: 'c_ouvert', type: 'courant', label: 'Courant', statut: 'ouvert',
        cash: [{ montant: 1000, affectation: 'courant' }], lignes: [] },
      { id: 'c_a', type: 'courant', label: 'Ancien A', statut: 'archive', cash: [], lignes: [] },
      { id: 'c_b', type: 'courant', label: 'Ancien B', statut: 'archive', cash: [], lignes: [] },
    ];
    Store.state.accounts = [{ id: 'c_vieux', label: 'Vieux format', group: 'cash' }];
    Store.state.positions = [];
    Store.state.monthly = [{ date: '2026-01-31', v: { c_ouvert: 1000, c_vieux: 250 },
                             comment: '', dettes: 0 }];
    refreshAccounts();
  };
  const app = () => lireSource('assets/app.js');
  /* Les bornes sont du CODE : une fenetre en caracteres se defait des que les
     commentaires partent, et l'arbre publie n'en a aucun. */
  const tranche = (debut, fin) => { const s = app(); return s.slice(s.indexOf(debut), s.indexOf(fin)); };
  const ecran = () => tranche('function viewComptesArchives()', '\nfunction mountAccounts()');
  const donnees = () => tranche('function viewData()', '\nfunction mountData()');
  const ids = l => l.map(x => x.id).sort().join(',');

  test('Données ne montre plus aucune gestion des comptes clos', () => {
    const d = donnees();
    vrai(d.length > 1000, 'la vue Données doit être trouvable');
    vrai(!/Comptes clos/.test(d), 'plus de carte « Comptes clos »');
    vrai(!/à retirer/.test(d), 'plus de compteur « X à retirer »');
    vrai(!/comptesClosDetaches\(/.test(d) && !/comptesAnciens\(/.test(d),
      'plus de liste des anciens comptes');
    vrai(!/retirerComptesClos\(/.test(d), 'et plus aucune suppression');
    const s = app();
    vrai(!/'retirer-comptes-clos'/.test(s) && !/'supprimer-comptes-retenus'/.test(s),
      'les deux actes globaux ont quitté le fichier');
  });

  test('un compte clos n’est pas une anomalie', () => {
    /* « Ce compte est clos et peut etre supprime » n'est pas un defaut : c'est
       la fin normale de la vie d'un compte. Une page de controles qui liste du
       normal apprend a etre ignoree.

       Le controle nomme les comptes de la fixture plutot que de chercher le mot
       « clos » : un MOIS clos en est un aussi, et le diagnostic a bien le droit
       de le reclamer. */
    poser();
    const dits = JSON.stringify(healthChecks() || []);
    for (const nom of ['Ancien A', 'Ancien B', 'Vieux format']) {
      vrai(!dits.includes(nom), `aucun contrôle ne signale « ${nom} »`);
    }
    const src = lireSource('assets/store.js');
    const f = src.slice(src.indexOf('function healthChecks()'),
                        src.indexOf('function fmtDureeMois('));
    vrai(f.length > 2000, 'le diagnostic doit être trouvable');
    vrai(!/comptesClosDetaches|comptesAnciens/.test(f),
      'et il ne lit même pas la liste des anciens comptes');
  });

  test('aucun bouton ne supprime plusieurs comptes d’un coup', () => {
    const s = app();
    vrai(!/Retirer les \{n\} comptes/.test(s), 'plus de « Retirer les {n} comptes »');
    vrai(!/Supprimer définitivement les \{n\} comptes/.test(s),
      'ni « Supprimer définitivement les {n} comptes »');
    vrai(/supprimerCompteClos\(x\.id\)/.test(s),
      'la suppression ne vise qu’un identifiant, celui de la ligne');
  });

  test('Actifs garde son entrée, et elle mène à l’écran', () => {
    const s = app();
    const entree = s.match(/const anciens = comptesAnciens\(\);[\s\S]*?\n  \}\)\(\)\}/);
    vrai(entree, 'l’entrée doit être trouvable');
    vrai(/Comptes archivés/.test(entree[0]), 'elle porte son nom');
    vrai(/hors totaux, conservés pour l’historique/.test(entree[0]), 'et son sous-titre');
    vrai(/data-action="goto"[\s\S]{0,80}data-view="comptes-archives"/.test(entree[0]),
      'un clic mène à l’écran dédié');
  });

  test('le retour ramène à Actifs, pas à Données', () => {
    const s = app();
    vrai(/'comptes-archives': \{ cle: 'accounts', render: \(\) => viewComptesArchives\(\) \}/.test(s),
      'la clé de vue est « accounts » : le chevron de l’en-tête remonte à Actifs');
    vrai(/data-action="goto" data-view="accounts"/.test(ecran()),
      'et l’écran porte lui-même son retour vers Actifs');
    vrai(!/data-view="data"/.test(ecran()), 'jamais vers Données');
  });

  test('une ligne par compte, jamais des noms collés par des virgules', () => {
    const e = ecran();
    vrai(e.length > 800, 'l’écran doit être trouvable');
    vrai(/liste\.map\(ligne\)\.join\(''\)/.test(e),
      'la liste rend une ligne par compte');
    vrai(!/join\(', '\)/.test(e), 'aucun nom n’est concaténé dans une phrase');
    vrai(/class="arch-ligne"/.test(e), 'chaque compte a sa propre rangée');
    const css = lireSource('assets/styles.css');
    vrai(/\.arch-ligne \{[^}]*display: flex/.test(css),
      'la rangée est une ligne : le nom à gauche, l’action à droite');
    vrai(/\.arch-ligne \{[^}]*border-top: 1px solid var\(--border\)/.test(css),
      'avec un filet fin entre deux, et pas une carte par compte');
    vrai(/\.arch-ligne \.arch-agir \{[^}]*min-height: 40px/.test(css),
      'et une cible tactile confortable');
  });

  test('un compte archivé se restaure, une entrée d’ancien format ne se restaure pas', () => {
    /* La seule difference que l'ecran ait a montrer : l'un a une fiche a
       rouvrir, l'autre n'existe plus que comme un nom dans d'anciens releves. */
    poser();
    const { archives, clos } = comptesAnciens();
    eq(ids(archives), 'c_a,c_b', 'les deux comptes archivés sont là');
    eq(ids(clos), 'c_vieux', 'et l’entrée d’ancien format à part');
    vrai(archives.every(x => x.restaurable), 'les premiers se restaurent');
    vrai(clos.every(x => !x.restaurable), 'le second n’a pas de fiche à rouvrir');
    vrai(!archives.some(x => x.id === 'c_ouvert') && !clos.some(x => x.id === 'c_ouvert'),
      'et un compte ouvert n’entre dans aucune des deux listes');
    /* UN ETAT, UNE ACTION. Un archive ne porte que « Restaurer », un clos que
       la poubelle : « Restaurer » a cote d'une poubelle demanderait de choisir
       entre garder et detruire sur un compte qu'on a mis de cote pour le
       garder, et les deux etats cesseraient de se distinguer. */
    const l = tranche('const ligne = x => `', 'const section = (titre');
    const i = l.indexOf('${x.restaurable ?');
    vrai(i > 0, 'l’affichage se décide sur « restaurable », la donnée du modèle');
    const sep = l.indexOf(': `', i);
    const r = l.indexOf('data-action="restaurer-compte"');
    const p = l.indexOf('data-action="supprimer-compte-clos"');
    vrai(i < r && r < sep, '« Restaurer » vit dans la branche restaurable, seul');
    vrai(sep < p, 'et la poubelle dans l’autre, seule');
    eq(l.split('data-action="restaurer-compte"').length - 1, 1,
      'un seul bouton de restauration dans la ligne');
    eq(l.split('data-action="supprimer-compte-clos"').length - 1, 1,
      'et une seule poubelle');
    vrai(!/Archivés|Clos/.test(l),
      'et la ligne ne lit jamais le titre de sa section : un intitulé n’est pas un état');
  });

  test('supprimer A ne supprime pas B', () => {
    poser();
    eq(retirerComptesClos(['c_a']), 1, 'un seul part');
    vrai(!(Store.state.comptes || []).some(c => c.id === 'c_a'), 'A est parti');
    vrai((Store.state.comptes || []).some(c => c.id === 'c_b'), 'B est toujours là');
    vrai((Store.state.accounts || []).some(a => a.id === 'c_vieux'),
      'et l’entrée d’ancien format aussi');
  });

  test('un archivé ne se supprime pas, même en visant son identifiant', () => {
    /* LE GARDE-FOU NE PEUT PAS ETRE L'ABSENCE D'UN BOUTON : elle ne protege que
       ce qu'on voit. Un compte archive est mis de cote pour etre GARDE, et il se
       rouvre ; le supprimer detruirait ce qu'on a choisi de conserver. La regle
       vit donc dans le modele, et l'ecran ne fait que la refleter. */
    poser();
    const totalAvant = round2(rowTotal(Store.state.monthly[0]));
    const brutAvant = round2(patrimoine().brut);

    eq(supprimerCompteClos('c_a'), 0, 'un compte restaurable n’est pas un compte clos');
    eq(supprimerCompteClos('c_inconnu'), 0, 'ni un identifiant qui ne désigne rien');
    vrai((Store.state.comptes || []).some(c => c.id === 'c_a'), 'A est toujours là');
    eq(ids(comptesAnciens().archives), 'c_a,c_b', 'et les deux archivés avec lui');

    eq(supprimerCompteClos('c_vieux'), 1, 'l’entrée d’ancien format, elle, part');
    vrai(!(Store.state.accounts || []).some(a => a.id === 'c_vieux'), 'et elle seule');
    eq(ids(comptesAnciens().archives), 'c_a,c_b', 'les archivés n’ont pas bougé');
    pres(round2(rowTotal(Store.state.monthly[0])), totalAvant,
      'le total du mois ne bouge pas d’un centime');
    pres(round2(patrimoine().brut), brutAvant, 'ni le patrimoine du jour');
  });

  test('restaurer vise un seul compte', () => {
    const acte = app().match(/async 'restaurer-compte'\(btn\) \{[\s\S]*?\n  \},/);
    vrai(acte, 'la restauration doit être trouvable');
    vrai(/const c = compteById\(btn\.dataset\.id\);/.test(acte[0]),
      'elle lit l’identifiant de la ligne cliquée');
    vrai(!/for \(|\.forEach\(|COMPTES\(\)\.filter/.test(acte[0]),
      'et ne parcourt aucune liste : ce compte-là, pas les autres');
    vrai(/c\.statut = 'ouvert'/.test(acte[0]), 'elle le rouvre');
    vrai(/refreshAccounts\(\); Store\.save\(\); render\(\);/.test(acte[0]),
      'et l’écran se refait aussitôt');
  });

  test('la suppression se confirme, et l’écran se refait aussitôt', () => {
    const f = tranche("async 'supprimer-compte-clos'(btn)", "async 'start-blank'()");
    vrai(/Supprimer définitivement ce compte clos \?/.test(f),
      'la question est celle qu’on attend');
    vrai(/ok: 'Supprimer', danger: true/.test(f),
      'et le dialogue s’annonce comme destructeur');
    vrai(/Store\.save\(\);[\s\S]{0,40}render\(\);/.test(f),
      'la liste se refait après la suppression');
  });

  test('un compte que rien ne rend supprimable ne le devient pas', () => {
    /* Le garde-fou ne change pas : seuls les comptes CLOS entrent dans la
       liste, et nommer autre chose ne retire rien. */
    poser();
    const brut = round2(patrimoine().brut);
    eq(retirerComptesClos(['c_ouvert']), 0, 'un compte ouvert ne se supprime pas');
    eq(retirerComptesClos(['c_inexistant']), 0, 'ni un identifiant qui ne désigne rien');
    vrai(Store.state.comptes.some(c => c.id === 'c_ouvert'), 'il est toujours là');
    pres(round2(patrimoine().brut), brut, 'et le patrimoine n’a pas bougé');
  });

  test('l’historique passé survit, et les totaux du jour se recalculent', () => {
    poser();
    const totalAvant = round2(rowTotal(Store.state.monthly[0]));
    const brutAvant = round2(patrimoine().brut);
    eq(retirerComptesClos(['c_vieux']), 1, 'l’entrée d’ancien format part');
    pres(round2(rowTotal(Store.state.monthly[0])), totalAvant,
      'le total du mois ne bouge pas d’un centime');
    pres(round2(patrimoine().brut), brutAvant,
      'et le patrimoine du jour non plus : ces comptes en étaient déjà sortis');
    eq(ids(comptesAnciens().clos), '', 'la liste se met à jour, sans lui');
    eq(ids(comptesAnciens().archives), 'c_a,c_b', 'les autres sont intacts');
  });

  test('la liste suit la restauration, elle ne la devine pas', () => {
    poser();
    compteById('c_a').statut = 'ouvert';
    refreshAccounts();
    eq(ids(comptesAnciens().archives), 'c_b', 'A a quitté les archivés');
    vrai(comptesOuverts().some(c => c.id === 'c_a'), 'et il est revenu chez les ouverts');
    vrai(comptesOuverts().every(c => c.id !== 'c_b'), 'B, lui, n’a pas bougé');
  });

  test('sans aucun ancien compte, l’entrée disparaît d’Actifs', () => {
    /* Pas d'ecran vide : l'entree ne s'affiche que s'il y a quelque chose
       derriere elle, comme le groupe qu'elle remplace. */
    Fixture.poser();
    Store.state.comptes = [{ id: 'c_ouvert', type: 'courant', label: 'Courant',
      statut: 'ouvert', cash: [], lignes: [] }];
    Store.state.accounts = [];
    Store.state.positions = [];
    refreshAccounts();
    const a = comptesAnciens();
    eq(a.archives.length + a.clos.length, 0, 'il n’y a rien à montrer');
    const entree = app().match(/const anciens = comptesAnciens\(\);[\s\S]*?\n  \}\)\(\)\}/);
    vrai(/if \(!vus\.length\) return '';/.test(entree[0]),
      'et l’entrée ne se rend pas');
    vrai(/Les comptes que tu clôtures se rangeront ici\./.test(ecran()),
      'quant à l’écran, il le dit plutôt que de rester vide');
  });
});

suite('Un compte clos ne part que si rien ne le retient', () => {

  /* Un etat minimal : un compte ouvert, un compte archive, et une entree
     orpheline de l'ancien modele. */
  const poser = ({ archiveValeur = 0, dansReleve = {} } = {}) => {
    Fixture.poser();
    Store.state.comptes = [
      { id: 'c_ouvert', type: 'courant', label: 'Courant', statut: 'ouvert',
        cash: [{ montant: 1000, affectation: 'courant' }], lignes: [] },
      { id: 'c_clos', type: 'courant', label: 'Ancien livret', statut: 'archive',
        cash: archiveValeur ? [{ montant: archiveValeur, affectation: 'courant' }] : [],
        lignes: [] },
    ];
    Store.state.accounts = [{ id: 'c_fantome', label: 'aaa', group: 'cash' }];
    Store.state.positions = [];
    Store.state.monthly = [{ date: '2026-01-31', v: { c_ouvert: 1000, ...dansReleve },
                             comment: '', dettes: 0 }];
    refreshAccounts();
  };
  const noms = l => l.map(x => x.id).sort().join(',');

  test('un compte clos qu’aucun relevé ne mentionne est libre', () => {
    poser();
    const { libres, retenus } = comptesClosDetaches();
    eq(noms(libres), 'c_clos,c_fantome', 'les deux sortes de comptes clos sont libres');
    eq(retenus.length, 0, 'rien ne les retient');
  });

  test('un relevé qui porte un montant le retient', () => {
    /* La garde, et la raison d'etre de tout ce qui precede : `rowTotal` se
       derive de `rowGroups`, qui parcourt ACCOUNTS. Retirer ce compte-la ferait
       maigrir le total du mois, en silence. */
    poser({ dansReleve: { c_fantome: 250 } });
    const { libres, retenus } = comptesClosDetaches();
    eq(noms(libres), 'c_clos', 'l’autre reste libre');
    eq(noms(retenus), 'c_fantome', 'celui du relevé est retenu');
    eq(retenus[0].mois.length, 1, 'et le mois qui le retient se nomme');
    pres(retenus[0].mois[0].montant, 250, 'avec son montant');
  });

  test('un montant nul ne retient rien', () => {
    /* Un champ laisse vide n'est pas de l'argent : sans cette nuance, un compte
       cite une fois a zero resterait pour toujours. */
    poser({ dansReleve: { c_fantome: 0 } });
    eq(noms(comptesClosDetaches().libres), 'c_clos,c_fantome',
      'zéro n’est pas un montant');
  });

  test('un compte archivé qui porte encore de la valeur est retenu', () => {
    /* Archive ne veut pas dire vide : celui-la compte dans le patrimoine du
       jour, et le retirer changerait le grand chiffre. */
    poser({ archiveValeur: 400 });
    const { libres, retenus } = comptesClosDetaches();
    eq(noms(libres), 'c_fantome', 'le fantôme part');
    eq(noms(retenus), 'c_clos', 'le compte archivé garni reste');
    pres(retenus[0].aujourdhui, 400, 'et sa valeur du jour se dit');
  });

  test('aucun total de relevé ne bouge après le retrait', () => {
    /* L'invariant qui compte, et celui que le detenteur redoutait : « laisse le
       champ s'il a ete enregistre dans un historique, sinon ça degage les mois
       suivants ». On mesure avant et apres. */
    poser({ dansReleve: { c_fantome: 250 }, archiveValeur: 400 });
    const avant = Store.state.monthly.map(r => round2(rowTotal(r)));
    const brutAvant = round2(patrimoine().brut);

    const n = retirerComptesClos([]);
    eq(n, 0, 'sans identifiant, rien ne part');

    poser({ dansReleve: { c_fantome: 250 } });
    const avant2 = Store.state.monthly.map(r => round2(rowTotal(r)));
    const brut2 = round2(patrimoine().brut);
    eq(retirerComptesClos(['c_clos']), 1, 'le compte archivé vide part quand on le nomme');
    pres(Store.state.monthly.map(r => round2(rowTotal(r)))[0], avant2[0],
      'le total du mois ne bouge pas d’un centime');
    pres(round2(patrimoine().brut), brut2, 'ni le patrimoine du jour');
    vrai(avant.length && brutAvant >= 0, 'les deux mesures ont bien été prises');
  });

  test('un compte ouvert n’est jamais candidat', () => {
    poser();
    const tous = [...comptesClosDetaches().libres, ...comptesClosDetaches().retenus];
    vrai(!tous.some(x => x.id === 'c_ouvert'),
      'seuls les comptes clos entrent dans le tri');
    retirerComptesClos(['c_ouvert']);
    vrai(Store.state.comptes.some(c => c.id === 'c_ouvert'),
      'et il survit, même nommé');
  });

  test('le retrait vide les deux listes où un compte clos peut vivre', () => {
    /* Un compte archive vit dans `comptes`, une entree de l'ancien modele dans
       `accounts` : n'en nettoyer qu'une laisserait l'autre reparaitre. */
    poser();
    eq(retirerComptesClos(['c_clos', 'c_fantome']), 2, 'les deux partent');
    vrai(!(Store.state.comptes || []).some(c => c.id === 'c_clos'),
      'le compte archivé quitte comptes');
    vrai(!(Store.state.accounts || []).some(a => a.id === 'c_fantome'),
      'et le fantôme quitte accounts');
    eq(comptesClosDetaches().libres.length, 0, 'il ne reste plus rien à retirer');
  });

  test('le geste prend une sauvegarde et nomme ce qui part', () => {
    /* La meme ceinture que la remise a zero : rien de ce qu'on retire ne se
       redemande, donc le dialogue doit dire quoi, et Ctrl+Z doit pouvoir. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const f = membreAction(src, 'supprimer-compte-clos');
    vrai(f.length > 300, 'l’action doit être trouvable');
    vrai(/askConfirm\(/.test(f), 'elle demande avant');
    vrai(/\+ x\.label \+/.test(f), 'et nomme le compte qui part');
    vrai(/Store\.addBackup\(/.test(f), 'une sauvegarde est prise avant');
    vrai(f.indexOf('Store.addBackup(') < f.indexOf('supprimerCompteClos('),
      'avant le retrait, pas après');
    vrai(/danger: true/.test(f), 'et le dialogue s’annonce comme destructeur');
  });
});

/* Un champ vide dit qu'on ne sait pas, un zero dit zero. Quatre endroits
   pourraient les confondre, parce que `num(x) || defaut` traite zero comme
   absent. */

/* Et celui qu'un releve retient, qui ne partait pas du tout. */
suite('Un compte clos que des relevés portent se supprime aussi', () => {

  const poser = ({ dansReleve = {}, forme = 'v' } = {}) => {
    Fixture.poser();
    Store.state.comptes = [
      { id: 'c_ouvert', type: 'courant', label: 'Courant', statut: 'ouvert',
        cash: [{ montant: 1000, affectation: 'courant' }], lignes: [] },
    ];
    Store.state.accounts = [{ id: 'c_fantome', label: 'aaa', group: 'cash' }];
    Store.state.positions = [];
    const r = { date: '2026-01-31', v: { c_ouvert: 1000, ...dansReleve },
                comment: '', dettes: 0 };
    if (forme === 'poches') r.poches = { cash: 1250 };
    if (forme === 'parts') r.parts = { c_ouvert: { cash: 1000 }, c_fantome: { cash: 250 } };
    Store.state.monthly = [r];
    refreshAccounts();
  };
  const mois = () => Store.state.monthly[0];

  test('il part, et le total du mois ne bouge pas d’un centime', () => {
    poser({ dansReleve: { c_fantome: 250 } });
    const avant = round2(rowTotal(mois()));
    const netAvant = round2(rowNet(mois()));
    eq(comptesClosDetaches().retenus.length, 1, 'le relevé le retient');
    eq(retirerComptesClos(['c_fantome']), 1, 'et il se retire quand on le nomme');
    vrai(!(Store.state.accounts || []).some(a => a.id === 'c_fantome'), 'la fiche est partie');
    pres(round2(rowTotal(mois())), avant, 'le total du mois est le même');
    pres(round2(rowNet(mois())), netAvant, 'le net aussi');
    eq(comptesClosDetaches().retenus.length, 0, 'et plus rien ne le retient');
  });

  test('la ventilation du mois est gravée avant, pas après', () => {
    /* C'est elle qui fait tenir le total : sans elle `rowGroups` retomberait sur
       ACCOUNTS, ou le compte n'est plus, et le mois maigrirait en silence. */
    poser({ dansReleve: { c_fantome: 250 } });
    vrai(!mois().poches, 'le relevé ancien n’en portait pas');
    retirerComptesClos(['c_fantome']);
    const p = mois().poches;
    vrai(p, 'le relevé porte désormais sa ventilation');
    pres(Object.values(p).reduce((s, v) => s + v, 0), 1250,
      'et elle vaut ce que le mois valait, le compte parti compris');
  });

  test('le montant saisi reste dans le relevé', () => {
    /* Retirer une fiche n'oblige pas a detruire ce qui a ete saisi ce mois-la.
       Plus rien ne le lit — les ecrans ne montrent que les comptes qui existent
       — et il n'est pas efface pour autant. */
    poser({ dansReleve: { c_fantome: 250 } });
    retirerComptesClos(['c_fantome']);
    pres(num(mois().v.c_fantome), 250, 'ce qui a été saisi ce mois-là est toujours là');
  });

  test('un relevé qui porte déjà sa ventilation n’est pas regravé', () => {
    poser({ dansReleve: { c_fantome: 250 }, forme: 'poches' });
    const avant = JSON.stringify(mois().poches);
    const total = round2(rowTotal(mois()));
    retirerComptesClos(['c_fantome']);
    eq(JSON.stringify(mois().poches), avant, 'sa ventilation ne se réécrit pas');
    pres(round2(rowTotal(mois())), total, 'et son total ne bouge pas');
  });

  test('un relevé détaillé par compte garde son détail', () => {
    /* `parts` est la forme complète : le total s'en dérive, et y toucher
       changerait le mois. La suppression ne l'approche pas. */
    poser({ dansReleve: { c_fantome: 250 }, forme: 'parts' });
    const total = round2(rowTotal(mois()));
    retirerComptesClos(['c_fantome']);
    vrai(!mois().poches, 'rien n’est gravé par-dessus');
    vrai(mois().parts.c_fantome, 'le détail du mois est intact');
    pres(round2(rowTotal(mois())), total, 'et le total avec lui');
  });

  test('sans identifiant, rien ne part', () => {
    /* Les identifiants sont OBLIGATOIRES, et c'est le garde-fou du geste : la
       suppression se demande depuis la ligne d'un compte, jamais en bloc. Un
       appel qui n'en nomme aucun ne peut pas se replier sur « tous ceux que
       rien ne retient » — ce serait exactement le bouton global retire. */
    poser({ dansReleve: { c_fantome: 250 } });
    Store.state.comptes.push({ id: 'c_clos', type: 'courant', label: 'Vieux livret',
      statut: 'archive', cash: [], lignes: [] });
    refreshAccounts();
    for (const rien of [undefined, null, []]) {
      eq(retirerComptesClos(rien), 0, 'aucun compte nommé, aucun compte retiré');
    }
    eq(comptesClosDetaches().libres.length + comptesClosDetaches().retenus.length, 2,
      'les deux comptes clos sont toujours là');
  });

  test('un compte ouvert ne se supprime pas, même nommé', () => {
    poser({ dansReleve: { c_fantome: 250 } });
    eq(retirerComptesClos(['c_ouvert', 'c_inconnu']), 0,
      'la liste ne s’ouvre qu’aux comptes clos');
    vrai(Store.state.comptes.some(c => c.id === 'c_ouvert'), 'et il survit');
  });

  test('l’écran propose le geste, et dit ce qu’il protège', () => {
    const src = lireSource('assets/app.js');
    const f = membreAction(src, 'supprimer-compte-clos');
    vrai(/askConfirm\(/.test(f), 'il demande avant');
    vrai(/Store\.addBackup\(/.test(f), 'il prend une sauvegarde');
    vrai(/relevés qui le mentionnent gardent leur total/.test(f),
      'et dit ce que les relevés gardent');
    vrai(/supprimerCompteClos\(x\.id\)/.test(f),
      'il ne retire que le compte visé');
    vrai(/comptesAnciens\(\)\.clos\.find/.test(f),
      'et il ne lit que les comptes clos : un archivé n’ouvre même pas le dialogue');
    vrai(/data-action="supprimer-compte-clos"/.test(src), 'le bouton existe');
  });

  test('les comptes clos sortent des feuilles Excel', () => {
    /* Quatorze comptes clos ouvraient quatorze colonnes vides sur toute la
       hauteur du fichier. Celui qu'un releve porte garde la sienne, sinon le
       detail cesserait d'expliquer sa propre somme. */
    const src = lireSource('assets/app.js');
    const acc = src.slice(src.indexOf('function sheetAccounts'),
                          src.indexOf('function sheetHistory'));
    vrai(/ACCOUNTS\.filter\(a => !a\.legacy\)/.test(acc),
      'la feuille des comptes ne liste que les comptes ouverts');
    const hist = src.slice(src.indexOf('function sheetHistory'),
                           src.indexOf('function sheetSales'));
    vrai(/const colonnes = ACCOUNTS\.filter\(a => !a\.legacy/.test(hist),
      'la feuille des relevés dérive ses colonnes');
    vrai(!/\.\.\.ACCOUNTS\.map\(/.test(hist),
      'et plus une seule ne vient d’ACCOUNTS en entier');
  });
});

suite('Un zéro saisi n’est pas un champ vide', () => {

  const credit = (extra = {}) => ({ id: 'd_test', libelle: 'Prêt', montant: 100000,
    initial: 120000, mensualite: 600, ...extra });

  test('les mois loués : vide vaut douze, zéro vaut zéro', () => {
    /* `num(compte.moisLoues) || 12` rendait douze sur un zero saisi : un bien
       vide toute l'annee se voyait prêter douze mois de loyer, et son rendement
       affichait le plein. Le pire sens de l'erreur — il flatte. */
    for (const [saisi, attendu, quoi] of [
      [undefined, 12, 'absent'], ['', 12, 'vide'], [null, 12, 'nul'],
      [0, 0, 'zéro reste zéro'], ['0', 0, 'zéro en texte aussi'],
      [1, 1, 'un mois'], [6, 6, 'six mois'], [11, 11, 'onze mois'],
      [12, 12, 'douze mois'],
      [-1, 0, 'négatif : borné à zéro'], [13, 12, 'au-delà de douze : borné'],
      [6.4, 6, 'arrondi au mois'],
    ]) eq(moisLouesDeclares({ moisLoues: saisi }), attendu, quoi);
  });

  test('un bien vide toute l’année ne rapporte rien', () => {
    /* Le defaut, sur des nombres : le rendement se lisait comme si le bien
       etait loue, alors qu'il ne l'a pas ete un seul mois. */
    Fixture.poser();
    const c = Store.state.comptes.find(x => typeCompte(x.type).bienImmo);
    vrai(!!c, 'le fixture doit porter un bien');
    Store.state.budget.income = [{ label: 'Loyer', amount: 900, period: 'mois',
                                   bienId: c.id }];
    c.moisLoues = 0;
    const cf = cashFlowBien(c);
    pres(cf.moisLoues, 0, 'zéro mois loué');
    pres(cf.loyers, 0, 'donc aucun loyer retenu');
    pres(cf.loyersPleins, 900, 'le loyer plein reste dit, pour la lecture');
    pres(cf.vacanceEuros, 900, 'et la vacance porte l’écart en entier');
    pres(cf.rendementBrut, 0, 'le rendement brut est nul, pas plein');
  });

  test('la part détenue : vide vaut le tout, zéro vaut zéro, hors bornes ne vaut rien', () => {
    for (const [saisi, attendu, quoi] of [
      [undefined, 1, 'absente'], ['', 1, 'vide'], [null, 1, 'nulle'],
      [0, 0, 'zéro veut dire zéro'], ['0', 0, 'zéro en texte aussi'],
      [50, 0.5, 'la moitié'], [100, 1, 'le tout'], [33.5, 0.335, 'décimale'],
    ]) pres(partDetention({ part: saisi }), attendu, quoi);
    /* Hors bornes : aucune valeur, et surtout pas une substitution. */
    for (const [saisi, quoi] of [
      [-20, 'négative : une faute de frappe, pas une déclaration'],
      [140, 'au-delà de cent : rien, jamais le bien entier'],
    ]) eq(partDetention({ part: saisi }), null, quoi);
  });

  test('le taux : absent, zéro et positif sont trois états', () => {
    eq(tauxCreditDeclare({}), null, 'absent');
    eq(tauxCreditDeclare({ taux: '' }), null, 'vide');
    eq(tauxCreditDeclare({ taux: null }), null, 'nul');
    eq(tauxCreditDeclare({ taux: 0 }), 0, 'zéro est un taux, pas une absence');
    eq(tauxCreditDeclare({ taux: '0' }), 0, 'zéro en texte aussi');
    eq(tauxCreditDeclare({ taux: 1.45 }), 1.45, 'et un taux se lit tel quel');
  });

  test('un prêt familial à 0 % s’amortit tout droit', () => {
    /* `num(d.taux) &&` ecartait ce pret de deux lignes de la carte des credits :
       il perdait son taux et sa part de capital, alors que sa mensualite
       rembourse du capital — toute sa mensualite, meme. */
    Fixture.poser();
    const d = credit({ taux: 0, mensualite: 500, montant: 10000, initial: 12000 });
    const e = echeancierCredit(d);
    vrai(e.amortissable, 'il s’amortit');
    pres(e.interetsDuMois, 0, 'aucun intérêt, et c’est un zéro vrai');
    pres(e.capitalDuMois, 500, 'toute la mensualité rembourse du capital');
    eq(e.mois, 20, 'dix mille euros à cinq cents par mois font vingt mois');
    pres(e.interets, 0, 'et zéro intérêt sur toute la durée');
  });

  test('sans taux déclaré, ni l’échéancier ni la projection n’inventent', () => {
    /* Les deux moteurs se contredisaient : l'echeancier se taisait, la
       projection traitait l'absence comme un zero et faisait donc descendre la
       dette en ligne droite, plus vite que la realite. */
    Fixture.poser();
    const d = credit({ mensualite: 600, verifieLe: '2026-01-01' });
    const e = echeancierCredit(d);
    eq(e.interetsDuMois, null, 'aucune part d’intérêts inventée');
    eq(e.capitalDuMois, null, 'aucune part de capital inventée');
    eq(e.amortissable, false, 'et aucune date de fin');
    eq(finCredit(d), null, 'finCredit se tait');
    eq(resteAPayer(d), null, 'resteAPayer aussi');

    const p = projectionCredit(d);
    eq(p.projete, null, 'la projection se tait au lieu d’amortir tout droit');
    vrai(p.moisDepuis > 0, 'mais elle compte les mois : c’est le rappel qui les lit');
  });

  test('avec un taux déclaré à zéro, la projection projette', () => {
    /* Le pendant du controle precedent : zero est un taux, et un pret a zero se
       projette parfaitement — c'est meme le cas le plus simple. */
    Fixture.poser();
    const d = credit({ taux: 0, mensualite: 500, montant: 10000,
                       verifieLe: '2026-01-01' });
    const p = projectionCredit(d);
    vrai(p.projete != null, 'elle rend un montant');
    pres(p.projete, Math.max(0, 10000 - 500 * p.moisDepuis),
      'et il descend d’une mensualité par mois, sans intérêts');
  });

  test('les deux moteurs répondent la même chose sur le même crédit', () => {
    /* La regle qui gouverne tout ce chantier : jamais deux moteurs pour une
       meme donnee. Sur chacun de ces trois etats du taux, l'echeancier et la
       projection doivent etre d'accord sur la question « sait-on amortir ? ». */
    Fixture.poser();
    for (const [taux, quoi] of [[undefined, 'taux absent'], [0, 'taux à zéro'],
                                [1.45, 'taux positif']]) {
      const d = credit({ taux, mensualite: 600, verifieLe: '2026-01-01' });
      const sait = echeancierCredit(d).capitalDuMois != null;
      const projette = projectionCredit(d).projete != null;
      eq(projette, sait, `${quoi} : les deux moteurs s’accordent`);
    }
  });
});

/* Une dette vit sur l'etablissement qui l'a consentie. La fiche d'un bien lisait
   donc toutes les dettes de sa banque, et deux biens chez la meme banque se
   partageaient chaque credit. */
suite('Un crédit sait quel bien il finance', () => {

  const PRET = (extra = {}) => ({ id: 'd_appt', libelle: 'Prêt appartement',
    montant: 180000, initial: 210000, taux: 1.45, mensualite: 894.44,
    tauxAssurance: 0.34, ...extra });

  /* Un etablissement, deux biens : l'appartement finance, le parking non. */
  const deuxBiens = (credits) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: credits }];
    s.comptes = [
      { id: 'c_appt', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Appartement', cash: [], lignes: [
          { id: 'l1', classe: 'immobilier', libelle: 'Appartement', valeur: 300000 }] },
      { id: 'c_park', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Parking', cash: [], lignes: [
          { id: 'l2', classe: 'immobilier', libelle: 'Parking', valeur: 20000 }] },
    ];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });

  test('le parking n’hérite pas du crédit de l’appartement', () => {
    /* Le defaut, sur des nombres : sans lien, la fiche du parking annonçait
       180 000 EUR de dette, 894 EUR de mensualite et un cash-flow a -894 —
       pour un bien qui n'a jamais rien emprunte. */
    deuxBiens([PRET({ bienId: 'c_appt' })]);
    const appt = cashFlowBien(compteById('c_appt'));
    const park = cashFlowBien(compteById('c_park'));
    pres(appt.reste, 180000, 'l’appartement porte sa dette');
    pres(appt.mensualite, 894.44, 'et sa mensualité');
    pres(park.reste, 0, 'le parking n’en porte aucune');
    pres(park.mensualite, 0, 'ni mensualité');
    pres(park.cashFlow, 0, 'et son cash-flow est nul, pas négatif');
    eq(park.capitalMois, null, 'il ne constitue aucun capital');
  });

  test('sans lien et avec deux biens, rien ne se rattache au hasard', () => {
    /* Mieux vaut une fiche qui ne montre pas son credit qu'une fiche qui montre
       celui du voisin : le premier manque se voit, le second se croit. */
    deuxBiens([PRET()]);
    pres(cashFlowBien(compteById('c_appt')).reste, 0, 'l’appartement attend');
    pres(cashFlowBien(compteById('c_park')).reste, 0, 'le parking aussi');
    const attente = creditsAClarifier();
    eq(attente.length, 1, 'et le crédit est signalé comme à clarifier');
    eq(attente[0].id, 'd_appt', 'nommément');
    eq(attente[0].quoi, 'ambigu', 'pour ambiguïté');
    eq(attente[0].comptes.length, 2, 'avec les candidats à choisir');
  });

  test('un lien mort ou dépaysé se signale, et la dette reste comptée', () => {
    /* Trois defauts, aucun ne se devine. Dans les trois cas la dette reste dans
       le patrimoine net — c'est de l'argent qu'on doit, quel que soit l'etat du
       lien — mais elle n'est attribuee a aucun bien. */
    deuxBiens([PRET({ bienId: 'c_efface' })]);
    const morts = creditsAClarifier();
    eq(morts.length, 1, 'le lien vers un compte disparu se voit');
    eq(morts[0].quoi, 'mort', 'et se nomme');
    pres(round2(dettesTotal()), 180000, 'la dette reste entière malgré le lien cassé');

    /* Un lien vers un compte d'un AUTRE etablissement : deplacer un compte de
       contenant suffit a le produire. */
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [PRET({ bienId: 'c_autre' })] },
                 { id: 'e_bq2', nom: 'Autre banque', notes: '', dettes: [] }];
      s.comptes = [
        { id: 'c_ici', etabId: 'e_bq', type: 'immo', statut: 'ouvert', libelle: 'Ici',
          cash: [], lignes: [] },
        { id: 'c_autre', etabId: 'e_bq2', type: 'immo', statut: 'ouvert', libelle: 'Ailleurs',
          cash: [], lignes: [] }];
      s.positions = []; s.monthly = [];
    });
    const depayses = creditsAClarifier();
    eq(depayses.length, 1, 'le lien vers un autre établissement se voit');
    eq(depayses[0].quoi, 'ailleurs', 'et se nomme');
    eq(creditsDuBien(compteById('c_autre')).length, 0,
      'et le compte visé ne le récupère pas pour autant : il n’est pas chez ce prêteur');
  });

  test('un lien qui pointe ailleurs ne déborde jamais', () => {
    deuxBiens([PRET({ bienId: 'c_appt' })]);
    eq(creditsDuBien(compteById('c_park')).length, 0,
      'le parking ne récupère pas un crédit explicitement rattaché ailleurs');
    /* Et un lien devenu obsolete ne retombe pas dans le repli. */
    deuxBiens([PRET({ bienId: 'c_disparu' })]);
    eq(creditsDuBien(compteById('c_appt')).length, 0, 'ni un lien périmé');
    eq(creditsDuBien(compteById('c_park')).length, 0, 'd’aucun côté');
  });

  test('un seul compte chez le prêteur : ses crédits le financent', () => {
    /* Le repli des donnees d'avant, et il n'est pas une supposition : c'est la
       seule lecture possible. Plusieurs credits sur un meme bien sont normaux —
       un pret principal et un pret travaux. */
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [
        PRET(), { id: 'd_trav', libelle: 'Prêt travaux', montant: 20000,
                  initial: 25000, taux: 2, mensualite: 300 }] }];
      s.comptes = [{ id: 'c_appt', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Appartement', cash: [], lignes: [
          { id: 'l1', classe: 'immobilier', libelle: 'Appartement', valeur: 300000 }] }];
      s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = [];
    });
    const cf = cashFlowBien(compteById('c_appt'));
    pres(cf.reste, 200000, 'les deux crédits comptent');
    pres(cf.mensualite, 1194.44, 'et les deux mensualités');
    eq(creditsAClarifier().length, 0, 'rien à clarifier : il n’y a pas d’ambiguïté');
  });

  test('la migration pose le lien quand il ne fait aucun doute, et jamais sinon', () => {
    /* Elle ne change aucun chiffre dans le cas simple — c'est deja ce que le
       repli rend — mais elle fige le lien avant qu'un second bien n'arrive et
       ne rende la lecture ambigue. */
    deuxBiens([PRET()]);
    Store.migrate();
    eq(Store.state.etabs[0].dettes[0].bienId, undefined,
      'deux biens : le lien reste vide, on ne devine pas');

    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [PRET()] }];
      s.comptes = [{ id: 'c_appt', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Appartement', cash: [], lignes: [] }];
      s.positions = []; s.monthly = [];
    });
    Store.migrate();
    eq(Store.state.etabs[0].dettes[0].bienId, 'c_appt', 'un seul compte : le lien se pose');
    /* Idempotente : la rejouer ne change rien. */
    Store.migrate();
    eq(Store.state.etabs[0].dettes[0].bienId, 'c_appt', 'et un second passage ne bouge pas');
  });

  test('la fiche ouvre le bon crédit, malgré le filtre', () => {
    /* Le rang d'un credit sert a l'ecrire. Filtrer la liste sans retrouver le
       rang dans les dettes de l'ETABLISSEMENT ferait modifier le credit du
       voisin — le defaut classique d'un index pris dans une liste derivee. */
    deuxBiens([{ id: 'd_park', libelle: 'Prêt parking', montant: 5000,
                 mensualite: 80, bienId: 'c_park' }, PRET({ bienId: 'c_appt' })]);
    const cf = cashFlowBien(compteById('c_appt'));
    eq(cf.creditsListe.length, 1, 'un seul crédit sur cette fiche');
    eq(cf.creditsListe[0].id, 'd_appt', 'le bon');
    eq(cf.creditsListe[0].index, 1,
      'et son rang est celui des dettes de l’établissement, pas de la liste filtrée');
  });

  test('un crédit mal rattaché déclenche une alerte de cohérence', () => {
    /* Une fonction qui ne sert nulle part ne protege de rien : le controle doit
       parler, sinon la dette reste invisible sur toutes les fiches sans que rien
       ne le signale — le pire genre d'erreur, un chiffre faux que rien ne
       trahit. */
    deuxBiens([PRET()]);
    const dits = healthChecks().filter(c => /non rattaché/.test(c.title || ''));
    eq(dits.length, 1, 'l’ambiguïté se dit');
    deuxBiens([PRET({ bienId: 'c_efface' })]);
    eq(healthChecks().filter(c => /non rattaché/.test(c.title || '')).length, 1,
      'le lien mort aussi');
    /* Et un credit correctement rattache ne declenche rien. */
    deuxBiens([PRET({ bienId: 'c_appt' })]);
    eq(healthChecks().filter(c => /non rattaché/.test(c.title || '')).length, 0,
      'un lien sain se tait');
  });

  test('le patrimoine net ne bouge pas d’un euro', () => {
    /* La regle qui gouverne tout : le rattachement change QUI affiche la dette,
       jamais combien elle vaut. `dettesTotal()` somme les etablissements et ne
       connait pas les biens. */
    deuxBiens([PRET()]);
    const avant = round2(patrimoine().net);
    Store.state.etabs[0].dettes[0].bienId = 'c_appt';
    refreshAccounts();
    pres(round2(patrimoine().net), avant, 'rattacher un crédit ne déplace aucun total');
    pres(round2(dettesTotal()), 180000, 'et la dette reste entière');
  });
});

/* Trois gestes qui effacent, et une seule regle : rien ne doit garder une
   reference vers ce qui n'existe plus. Une reference morte ne se voit nulle
   part — c'est le pire genre d'erreur, un chiffre faux que rien ne trahit. */
suite('Aucune référence ne survit à ce qu’elle désigne', () => {

  /* Un preteur, deux biens, un credit sur le premier, et sa charge. */
  const poser = () => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [
      { id: 'd_appt', libelle: 'Prêt appartement', montant: 180000, initial: 210000,
        taux: 1.45, tauxAssurance: 0.34, bienId: 'c_appt' }] }];
    s.comptes = [
      { id: 'c_appt', etabId: 'e_bq', type: 'immo', statut: 'ouvert', libelle: 'Appartement',
        cash: [], lignes: [{ id: 'l1', classe: 'immobilier', libelle: 'Appt', valeur: 300000 }] },
      { id: 'c_park', etabId: 'e_bq', type: 'immo', statut: 'ouvert', libelle: 'Parking',
        cash: [], lignes: [{ id: 'l2', classe: 'immobilier', libelle: 'Parking', valeur: 20000 }] },
    ];
    s.positions = []; s.monthly = [];
    s.budget.income = [{ label: 'Loyer', amount: 900, period: 'mois', bienId: 'c_appt' }];
    s.budget.fixedCharges = [
      { label: 'Mensualité', amount: 894.44, period: 'mois', creditId: 'd_appt',
        bienId: 'c_appt', shares: {} },
      { label: 'Taxe foncière', amount: 1200, period: 'an', bienId: 'c_appt', shares: {} },
    ];
  });
  const credit = () => Store.state.etabs[0].dettes.find(d => d.id === 'd_appt');
  const charge = (l) => Store.state.budget.fixedCharges.find(c => c.label === l);

  test('un crédit qui change de bien emmène sa charge', () => {
    /* Sans cette synchronisation, la mensualite resterait comptee dans le
       cash-flow d'un bien qui ne la paie plus, et manquerait a celui qui la
       paie. Deux fiches fausses d'un seul geste. */
    poser();
    rattacherCredit(credit(), 'c_park');
    eq(credit().bienId, 'c_park', 'le crédit suit');
    eq(charge('Mensualité').bienId, 'c_park', 'et sa charge avec lui');
    /* Une charge qui ne portait aucun lien ne s'en voit pas poser un dans son
       dos : elle n'a jamais dit appartenir a ce bien. */
    delete charge('Mensualité').bienId;
    rattacherCredit(credit(), 'c_appt');
    eq(charge('Mensualité').bienId, undefined, 'une charge sans lien n’en reçoit pas');
    /* Et la taxe fonciere, qui ne rembourse aucun credit, ne bouge pas. */
    eq(charge('Taxe foncière').bienId, 'c_appt', 'les autres charges restent où elles sont');
  });

  test('détacher un crédit détache aussi sa charge', () => {
    poser();
    rattacherCredit(credit(), null);
    eq(credit().bienId, null, 'le crédit n’est plus rattaché');
    eq(charge('Mensualité').bienId, undefined, 'sa charge non plus');
  });

  test('un crédit supprimé ne laisse pas de creditId mort', () => {
    /* Une charge qui garde un `creditId` vers une dette effacee continue de
       vivre dans le budget en pretant sa mensualite a un fantome. */
    poser();
    const nom = delierChargeDuCredit('d_appt');
    eq(nom, 'Mensualité', 'la charge est nommée, pour que le geste puisse le dire');
    eq(charge('Mensualité').creditId, undefined, 'le lien mort est retiré');
    pres(charge('Mensualité').amount, 894.44,
      'et elle garde son montant : il vivait déjà chez elle');
    eq(chargeDuCredit('d_appt'), null, 'plus rien ne remonte de ce crédit');
  });

  test('ou part avec lui, si on le demande', () => {
    poser();
    const avant = Store.state.budget.fixedCharges.length;
    delierChargeDuCredit('d_appt', { retirer: true });
    eq(Store.state.budget.fixedCharges.length, avant - 1, 'la charge est retirée');
    eq(charge('Mensualité'), undefined, 'nommément');
    eq(charge('Taxe foncière') != null, true, 'et les autres restent');
  });

  test('un bien supprimé ne laisse ni loyer ni charge rattachés au vide', () => {
    /* Les flux restent — ce sont de vrais mouvements du budget — mais ils
       cessent de designer un compte disparu. */
    poser();
    const n = delierDuBien('c_appt');
    eq(n, 3, 'le loyer et les deux charges sont déliés');
    eq(Store.state.budget.income[0].bienId, undefined, 'le loyer reste, sans lien');
    pres(Store.state.budget.income[0].amount, 900, 'et garde son montant');
    eq(charge('Taxe foncière').bienId, undefined, 'la charge aussi');
    pres(budgetFrame().fixed, chargeMensuelle(charge('Mensualité'))
       + chargeMensuelle(charge('Taxe foncière')),
      'le budget ne bouge pas d’un centime');
  });

  test('le geste de suppression appelle bien ces trois portes', () => {
    /* Le modele sait delier ; encore faut-il que l'ecran s'en serve. Les
       assertions portent sur du CODE, jamais sur un commentaire. */
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf("async 'supprimer-compte'(btn) {"),
                        src.indexOf("async 'supprimer-compte'(btn) {") + 6000);
    vrai(/creditsDuBien\(c\)/.test(f),
      'il regarde les crédits de CE bien, pas ceux de l’établissement');
    vrai(/delierChargeDuCredit\(d\.id\)/.test(f),
      'les charges des crédits effacés sont déliées');
    vrai(/rattacherCredit\(d, sort\)/.test(f),
      'ou les crédits suivent le bien choisi');
    vrai(/delierDuBien\(c\.id\)/.test(f),
      'et rien ne garde un bienId vers le compte supprimé');

    const g = src.slice(src.indexOf("async 'editer-credit'(btn) {"));
    vrai(/rattacherCredit\(d, v\.bienId\)/.test(g),
      'déplacer un crédit passe par la porte qui emmène sa charge');
    vrai(/delierChargeDuCredit\(d\.id, \{ retirer: !!v\.supprimerCharge \}\)/.test(g),
      'et le supprimer traite sa charge, sans jamais la laisser en l’air');
  });

  test('après une opération terminée, plus rien à clarifier', () => {
    /* L'invariant : le controle se tait quand tout est propre, sinon il devient un
       bruit qu'on cesse de lire. */
    poser();
    eq(creditsAClarifier().length, 0, 'au départ, tout est rattaché');
    /* On supprime le bien qui porte le credit, en le rattachant au parking. */
    rattacherCredit(credit(), 'c_park');
    delierDuBien('c_appt');
    Store.state.comptes = Store.state.comptes.filter(c => c.id !== 'c_appt');
    refreshAccounts();
    eq(creditsAClarifier().length, 0, 'après le rattachement, le contrôle se tait');
    pres(round2(dettesTotal()), 180000, 'et la dette globale n’a pas bougé');

    /* Le meme geste sans rattacher laisserait, lui, une reference morte. */
    poser();
    Store.state.comptes = Store.state.comptes.filter(c => c.id !== 'c_appt');
    refreshAccounts();
    eq(creditsAClarifier().length, 1, 'sans rattachement, le contrôle parle');
    eq(creditsAClarifier()[0].quoi, 'mort', 'et nomme le défaut');
    pres(round2(dettesTotal()), 180000, 'la dette reste comptée malgré tout');
  });
});

/* Trois questions vivaient eparpillees dans les vues — l'usage est-il rempli, y
   a-t-il un loyer, que montrer sinon — et chacune repondait a sa facon.
   `usageEffectifBien` les rejoint, et dit toujours d'ou vient sa reponse. */
suite('L’usage d’un bien dit toujours d’où il vient', () => {

  const bien = ({ usages = [], loyer = 0, type = 'immo' } = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type, statut: 'ouvert', libelle: 'Appartement',
      cash: [], lignes: usages.map((u, i) => ({ id: 'l' + i, classe: 'immobilier',
        libelle: 'Lot ' + i, valeur: 100000, ...(u ? { usage: u } : {}) })) }];
    s.positions = []; s.monthly = [];
    s.budget.income = loyer
      ? [{ label: 'Loyer', amount: loyer, period: 'mois', bienId: 'c_b' }] : [];
    s.budget.fixedCharges = [];
  });
  const u = () => usageEffectifBien(compteById('c_b'));

  test('un usage déclaré gagne toujours, même contre un loyer', () => {
    /* Une chambre louee dans sa residence principale est un cas reel : l'ecran
       n'a pas a requalifier le logement de son detenteur. */
    for (const [dit, loyer, quoi] of [
      ['principale', 900, 'principale avec un loyer'],
      ['secondaire', 900, 'secondaire avec un loyer'],
      ['locative', 0, 'locative sans loyer'],
      ['principale', 0, 'principale sans loyer'],
    ]) {
      bien({ usages: [dit], loyer });
      eq(u().usage, dit, quoi);
      eq(u().source, 'declare', 'et la source est la déclaration');
      eq(u().action, null, 'rien à demander');
    }
  });

  test('sans usage, un loyer fait pencher — mais ça reste une déduction', () => {
    bien({ usages: [''], loyer: 900 });
    eq(u().usage, 'locative', 'le comportement historique est préservé');
    eq(u().source, 'loyer', 'mais la source dit que c’est déduit');
    eq(u().action, 'confirmer', 'donc l’écran demandera confirmation');
    /* Et rien n'est ecrit dans les donnees : le jour ou le detenteur confirme,
       alors seulement. Sinon on perdrait a jamais l'information que c'etait une
       deduction. */
    eq(compteById('c_b').lignes[0].usage, undefined,
      'aucune migration silencieuse : la donnée reste vide');
  });

  test('un loyer nul ne déduit rien', () => {
    /* Une ligne de revenu a zero n'est pas un loyer : c'est un champ qu'on n'a
       pas rempli. */
    bien({ usages: [''], loyer: 0 });
    eq(u().usage, '', 'aucun usage');
    eq(u().source, 'inconnu', 'et rien n’est inventé');
    eq(u().usage === 'principale', false,
      'surtout pas « résidence principale » par défaut : le bien sortirait des '
      + 'avoirs mobilisables sans que personne l’ait dit');
  });

  test('des lots aux usages différents ne se tranchent pas', () => {
    /* Un appartement habite et un studio loue dans le meme compte : choisir l'un
       des deux en silence serait inventer. */
    bien({ usages: ['principale', 'locative'] });
    eq(u().usage, '', 'le compte n’a pas d’usage');
    eq(u().source, 'mixte', 'et le dit');
    eq(u().mixte, true, 'nommément');
    eq(u().action, 'lots', 'et la fiche renverra vers chaque lot, sans bouton global');
    /* Deux lots du MEME usage s'accordent, eux. */
    bien({ usages: ['principale', 'principale'] });
    eq(u().usage, 'principale', 'deux lots d’accord donnent l’usage');
    eq(u().source, 'declare', 'sans rien demander');
  });

  test('un bien détenu en direct se reconnaît au modèle, pas à son libellé', () => {
    /* La classe `immobilier` couvre aussi la SCPI, a qui l'on demandait donc si
       elle etait une residence principale. Le drapeau `direct` du type tranche. */
    bien({ type: 'immo' });
    eq(estBienEnDirect(compteById('c_b')), true, 'un bien immobilier en direct');
    bien({ type: 'scpi' });
    eq(estBienEnDirect(compteById('c_b')), false, 'une SCPI, non');
    bien({ type: 'bienValeur' });
    eq(estBienEnDirect(compteById('c_b')), false,
      'un bien de valeur non plus : il est détenu en direct mais ne s’habite pas');
  });

  test('la création réclame l’usage, et seulement au bien en direct', () => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf("cle: 'usageBien'");
    vrai(i > 0, 'le champ doit être trouvable');
    const bloc = src.slice(src.lastIndexOf('...(', i), src.indexOf('}] : []),', i));
    vrai(/immoDirect/.test(bloc),
      'la condition passe par les drapeaux du type (bienImmo et direct), pas par la classe');
    vrai(!/classeDuBien === 'immobilier'/.test(bloc),
      'et plus par la classe, qui couvre la SCPI');
    vrai(/requis: true/.test(bloc), 'le choix est obligatoire');
    vrai(!/\['', trad\('à préciser'\)\]/.test(bloc), 'et il n’y a plus d’option vide');
  });

  test('changer d’usage ne touche à rien d’autre', () => {
    /* L'invariant demande : l'usage ne fait que qualifier. */
    bien({ usages: ['locative'], loyer: 900 });
    Store.state.etabs[0].dettes = [{ id: 'd1', libelle: 'Prêt', montant: 100000,
                                     mensualite: 500, taux: 1.5, bienId: 'c_b' }];
    Store.state.budget.fixedCharges = [{ label: 'Taxe', amount: 1200, period: 'an',
                                         bienId: 'c_b', shares: {} }];
    refreshAccounts();
    const avant = { brut: round2(patrimoine().brut), net: round2(patrimoine().net),
      dettes: round2(dettesTotal()), fixe: round2(budgetFrame().fixed),
      revenus: round2(budgetFrame().income), cash: round2(cashFlowBien(compteById('c_b')).cashFlow) };

    for (const l of compteById('c_b').lignes) l.usage = 'principale';
    refreshAccounts();

    eq(u().usage, 'principale', 'l’usage a changé');
    pres(round2(patrimoine().brut), avant.brut, 'le patrimoine brut ne bouge pas');
    pres(round2(patrimoine().net), avant.net, 'le net non plus');
    pres(round2(dettesTotal()), avant.dettes, 'ni les dettes');
    pres(round2(budgetFrame().fixed), avant.fixe, 'ni les charges fixes');
    pres(round2(budgetFrame().income), avant.revenus, 'ni les revenus');
    pres(round2(cashFlowBien(compteById('c_b')).cashFlow), avant.cash,
      'ni le cash-flow, tant que l’UX n’est pas refaite');
    eq(Store.state.budget.income.length, 1, 'le loyer est toujours là');
    eq(Store.state.etabs[0].dettes.length, 1, 'le crédit aussi');
  });

  test('un loyer sur un logement déclaré habité se signale, sans requalifier', () => {
    bien({ usages: ['principale'], loyer: 900 });
    const dits = healthChecks().filter(x => /résidence principale/.test(x.title || ''));
    eq(dits.length, 1, 'l’incohérence se dit');
    eq(dits[0].level, 'info', 'en information : ce peut être parfaitement volontaire');
    eq(u().usage, 'principale', 'et le bien n’est pas requalifié pour autant');

    bien({ usages: ['secondaire'], loyer: 900 });
    eq(healthChecks().filter(x => /résidence secondaire/.test(x.title || '')).length, 1,
      'même chose pour une résidence secondaire');

    /* Un bien locatif avec un loyer n'a rien d'incoherent, et un legacy deduit
       non plus : il n'a rien declare. */
    bien({ usages: ['locative'], loyer: 900 });
    eq(healthChecks().filter(x => /Un loyer est rattaché/.test(x.title || '')).length, 0,
      'un locatif avec loyer ne déclenche rien');
    bien({ usages: [''], loyer: 900 });
    eq(healthChecks().filter(x => /Un loyer est rattaché/.test(x.title || '')).length, 0,
      'un legacy déduit non plus : il n’a rien déclaré');
  });

  test('les suggestions de charges suivent la même source', () => {
    /* `chargesProposees` lisait `usageBien`, qui delegue desormais au helper :
       un legacy locatif recoit donc les suggestions du bailleur. */
    bien({ usages: ['locative'] });
    const locatives = chargesProposees(compteById('c_b'));
    bien({ usages: [''], loyer: 900 });
    eq(JSON.stringify(chargesProposees(compteById('c_b'))), JSON.stringify(locatives),
      'un legacy déduit locatif reçoit les suggestions locatives');
    bien({ usages: [''] });
    const generiques = chargesProposees(compteById('c_b'));
    vrai(generiques.length <= locatives.length,
      'un usage inconnu ne reçoit que le générique');
  });
});

/* Trois trous de l'etape B, et le meme fil : une invite qui n'invite a rien, un
   silence la ou il fallait demander, et un bouton qui ecrase. */
suite('Le choix de l’usage doit être un vrai choix', () => {

  const bien = ({ usages = [], loyer = 0, type = 'immo' } = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type, statut: 'ouvert', libelle: 'Appartement',
      cash: [], lignes: usages.map((u, i) => ({ id: 'l' + i, classe: 'immobilier',
        libelle: 'Lot ' + i, valeur: 100000, ...(u ? { usage: u } : {}) })) }];
    s.positions = []; s.monthly = [];
    s.budget.income = loyer
      ? [{ label: 'Loyer', amount: loyer, period: 'mois', bienId: 'c_b' }] : [];
    s.budget.fixedCharges = [];
  });
  const u = () => usageEffectifBien(compteById('c_b'));

  test('le select de création ne choisit pas à la place du détenteur', () => {
    /* `requis: true` sans option vide ne protege de rien : un select rend son
       premier choix des l'ouverture, et USAGES_BIEN commence par « Mis en
       location ». Un bien cree sans toucher au champ naissait donc locatif. */
    eq(USAGES_BIEN[0][0], 'locative',
      'la liste commence par le locatif : c’est ce que le select aurait rendu');
    const src = lireSource('assets/app.js');
    const i = src.indexOf("cle: 'usageBien'");
    vrai(i > 0, 'le champ doit être trouvable');
    const bloc = src.slice(i, src.indexOf('}] : []),', i));
    vrai(/requis: true/.test(bloc), 'le champ reste obligatoire');
    vrai(/valeur: ''/.test(bloc), 'et part d’une valeur vide');
    vrai(/\['', trad\('Choisir…'\)\], \.\.\.USAGES_BIEN/.test(bloc),
      'avec une option vide en tête, sans quoi « requis » ne mord jamais');
    /* Et la garde du formulaire refuse bien une chaine vide : c'est elle qui
       transforme l'option vide en obligation reelle. */
    vrai(/champs\.find\(c => estRequis\(c\) && vide\(c\)\)/.test(src),
      'le formulaire refuse un champ requis laissé vide');
  });

  test('choisir l’usage ne présélectionne rien quand rien n’est connu', () => {
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf("async 'choisir-usage'(btn) {"),
                        src.indexOf("async 'supprimer-compte'(btn) {"));
    vrai(/\['', trad\('Choisir…'\)\], \.\.\.USAGES_BIEN/.test(f),
      'la liste porte une option vide');
    vrai(/valeur: u\.usage \|\| ''/.test(f),
      'et la valeur de départ est celle qu’on connaît, vide quand on ne sait pas');
    bien({ usages: [''] });
    eq(u().usage, '', 'sur un usage inconnu, rien n’est proposé');
  });

  test('un bien sans usage et sans loyer demande qu’on choisisse', () => {
    /* Il ne demandait rien : `aConfirmer` valait faux, et le bandeau se taisait.
       Un bien dont personne n'a jamais dit l'usage doit pourtant inviter. */
    bien({ usages: [''] });
    eq(u().source, 'inconnu', 'rien n’est déduit');
    eq(u().action, 'choisir', 'mais l’écran doit demander');
    eq(u().usage, '', 'et surtout rien n’est inventé');
  });

  test('les trois demandes ont chacune leur phrase, et une seule n’a pas de bouton', () => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf('const DEMANDES = {');
    vrai(i > 0, 'la table des demandes doit être trouvable');
    const bloc = src.slice(i, src.indexOf('};', i));
    for (const [cle, titre] of [['confirmer', 'Usage à confirmer'],
                                ['choisir', 'Usage à préciser'],
                                ['lots', 'Usages différents selon les lots']])
      vrai(bloc.indexOf(cle) > 0 && bloc.indexOf(titre) > 0, `${cle} a sa phrase`);
    /* Le cas des lots n'offre PAS de bouton : c'est tout le sujet. */
    const lots = bloc.slice(bloc.indexOf('lots:'));
    vrai(/bouton: null/.test(lots), 'et le cas des lots n’offre aucun bouton global');
  });

  test('un compte aux lots différents ne se fait jamais écraser', () => {
    /* Un appartement habite et un studio loue peuvent etre parfaitement voulus.
       Un bouton global les ramenerait au meme usage : le geste le plus
       destructeur de la fiche, sous le libelle le plus anodin. */
    bien({ usages: ['principale', 'locative'] });
    const avant = compteById('c_b').lignes.map(l => l.usage);
    eq(u().action, 'lots', 'la fiche renvoie vers les lots');

    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf("async 'choisir-usage'(btn) {"),
                        src.indexOf("async 'supprimer-compte'(btn) {"));
    vrai(/if \(u\.action === 'lots'\) return;/.test(f),
      'et le geste refuse de s’exécuter, même appelé directement');
    eq(JSON.stringify(compteById('c_b').lignes.map(l => l.usage)), JSON.stringify(avant),
      'les usages des lots restent intacts');
  });

  test('une SCPI ne se voit jamais demander si on l’habite', () => {
    /* Le bandeau se poserait sinon sur toute la pierre papier : `bienImmo` sans
       `direct`. */
    bien({ type: 'scpi' });
    eq(u().action, null, 'aucune demande');
    bien({ type: 'scpi', loyer: 900 });
    eq(u().action, null, 'même avec un revenu rattaché');
  });

  test('un usage explicite reste explicite, loyer ou pas', () => {
    for (const dit of ['principale', 'secondaire', 'locative']) {
      bien({ usages: [dit], loyer: 900 });
      eq(u().usage, dit, `${dit} tient face à un loyer`);
      eq(u().action, null, 'et rien n’est demandé');
    }
  });
});

/* Une cascade se lit ; un cash-flow isole se subit. « −15 EUR » tout seul ne se
   verifie contre rien, et personne ne sait s'il faut s'en inquieter. */
suite('Un bien loué montre ses flux en cascade', () => {

  const PRET = { id: 'd1', libelle: 'Prêt', montant: 200000, initial: 240000,
                 taux: 2, mensualite: 1000, tauxAssurance: 0.3 };
  const TAXE = { label: 'Taxe foncière', amount: 250, period: 'mois', shares: {}, bienId: 'c_b' };

  const bien = (opts = {}) => Fixture.poser(e => {
    e.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: opts.credits || [] }];
    e.comptes = [{ id: 'c_b', etabId: 'e_bq', type: opts.type || 'immo', statut: 'ouvert',
      libelle: 'Studio', court: 'Studio', numero: '', notes: '', alloc: '',
      ouvertLe: '2019-01-01', cash: [],
      moisLoues: opts.moisLoues == null ? 12 : opts.moisLoues,
      tauxImpot: opts.tauxImpot || 0, apport: opts.apport || null,
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Studio',
        valeur: 300000, prixDeRevient: opts.achat == null ? 240000 : opts.achat,
        quantite: 1, dateAcquisition: '2019-01-01',
        ...(opts.usage === undefined ? { usage: 'locative' }
                                     : (opts.usage ? { usage: opts.usage } : {})) }] }];
    e.positions = []; e.monthly = [];
    e.budget.income = opts.loyer
      ? [{ label: 'Loyer', amount: opts.loyer, period: 'mois', bienId: 'c_b' }] : [];
    e.budget.fixedCharges = opts.charges || [];
  });

  const cf = () => cashFlowBien(compteById('c_b'));
  const bloc = (nom) => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf(`function ${nom}(`);
    vrai(i > 0, `${nom} doit être trouvable`);
    const suivante = Math.min(...[src.indexOf('\nfunction ', i + 1),
                                  src.indexOf('\nconst ', i + 1)]
      .filter(x => x > 0).concat([src.length]));
    return src.slice(i, suivante);
  };

  test('avec loyer, crédit et charges, le cash-flow est la somme de ses lignes', () => {
    bien({ loyer: 1200, credits: [{ ...PRET }], charges: [{ ...TAXE }] });
    const x = cf();
    pres(x.loyersPleins, 1200, 'le loyer plein');
    pres(x.charges, 250, 'les charges');
    pres(x.mensualite, 1000, 'la mensualité');
    pres(x.cashFlow, 1200 - 250 - 1000, 'et le solde du mois, à l’euro');
  });

  test('sans crédit, aucune ligne de mensualité — et le cash-flow est le loyer net', () => {
    bien({ loyer: 1200, charges: [{ ...TAXE }] });
    pres(cf().mensualite, 0, 'aucune mensualité');
    eq(cf().capitalMois, null, 'et rien ne se constitue');
    pres(cf().cashFlow, 950, 'le loyer moins les charges');
    vrai(/filter\(x => x\.mensualite > 0\.005\)/.test(bloc('ligneMensualite')),
      'la ligne de mensualité ne s’écrit pas à zéro');
  });

  test('douze mois loués : aucune cascade, le loyer garde son nom', () => {
    bien({ loyer: 1200, moisLoues: 12 });
    pres(cf().vacanceEuros, 0, 'aucune vacance');
    pres(cf().loyers, cf().loyersPleins, 'le loyer retenu est le loyer plein');
    /* Trois lignes pour un seul fait seraient trois lignes de trop : la cascade
       n'existe que pour EXPLIQUER une vacance. */
    vrai(/const vacance = cf\.vacanceEuros > 0\.005;/.test(bloc('lignesDuMois')),
      'la cascade est gardée par l’existence d’une vacance');
    vrai(/!vacance \? cf\.sourcesLoyer\.map/.test(bloc('lignesDuMois')),
      'sans vacance, chaque loyer garde son nom et sa porte');
  });

  test('onze, six, zéro mois : la vacance retire ce qu’elle retire', () => {
    for (const [mois, retenu] of [[11, 1100], [6, 600], [0, 0]]) {
      bien({ loyer: 1200, moisLoues: mois });
      const x = cf();
      pres(x.loyersPleins, 1200, `${mois} mois : le loyer plein reste dit`);
      pres(x.loyers, retenu, `${mois} mois : le loyer retenu`);
      pres(x.vacanceEuros, 1200 - retenu, `${mois} mois : et la vacance est le reste`);
      pres(x.loyersPleins - x.vacanceEuros, x.loyers,
        `${mois} mois : les trois lignes affichées se referment`);
    }
  });

  test('la vacance ne se déduit qu’une fois, et l’écran le montre', () => {
    /* Le piege : le modele rend deja un loyer NET de vacance. L'afficher en
       cascade et repartir du loyer plein la compterait deux fois. La preuve tient
       en une egalite -- le cash-flow part du loyer RETENU. */
    bien({ loyer: 1200, moisLoues: 6, charges: [{ ...TAXE }], credits: [{ ...PRET }] });
    const x = cf();
    pres(x.cashFlow, x.loyers - x.charges - x.mensualite - x.impot,
      'le cash-flow part du loyer retenu');
    pres(x.cashFlow, x.loyersPleins - x.vacanceEuros - x.charges - x.mensualite - x.impot,
      'ce qui revient à retirer la vacance une seule fois');
    vrai(x.cashFlow !== x.loyers - x.vacanceEuros - x.charges - x.mensualite - x.impot,
      'et surtout pas deux : ce calcul-là donnerait un autre chiffre');
    /* A l'ecran : la vacance s'ecrit une fois, et le loyer retenu est un
       SOUS-TOTAL — il ferme les lignes du dessus au lieu de s'y ajouter. */
    const lignes = bloc('lignesDuMois');
    eq((lignes.match(/cf\.vacanceEuros/g) || []).length, 2,
      'la vacance n’apparaît qu’à sa garde et à sa ligne');
    vrai(/<dt class="kv-sous">\$\{trad\('Loyer retenu'\)\}/.test(lignes),
      'le loyer retenu porte la marque du sous-total');
    const css = lireSource('assets/styles.css');
    vrai(/\.kv \.kv-sous, \.kv \.kv-sous \+ dd \{[^}]*border-top/.test(css),
      'et la feuille lui donne le filet qui dit qu’il ferme, plutôt qu’il n’ajoute');
  });

  test('le capital remboursé vit hors du cash-flow, et le dit', () => {
    bien({ loyer: 1200, credits: [{ ...PRET }] });
    const x = cf(), co = coutBien(compteById('c_b'));
    vrai(co.capitalMois > 0, 'du capital se rembourse');
    pres(x.cashFlow, 1200 - 1000, 'le cash-flow l’ignore : cet argent est bien sorti');
    /* A l'ecran, il est dans son propre bloc, hors de la liste qui totalise. */
    const carte = bloc('carteLocatif');
    /* Ancre sur la MISE EN FORME du total et non sur son libelle : celui-ci dit
       « avant » ou « apres fiscalite » selon ce qu'on en sait. */
    const iTotal = carte.indexOf('${cls(cf.cashFlow)}');
    vrai(iTotal > 0, 'le cash-flow doit être trouvable');
    /* La mesure part du cash-flow et non du debut de la fonction : la branche
       sans loyer porte elle aussi le bloc du capital, et plus haut. Chercher sa
       PREMIERE occurrence lisait donc l'autre branche. */
    vrai(/<\/dl>[\s\S]{0,80}\$\{blocCapitalRembourse\(co\)\}/.test(carte.slice(iTotal)),
      'le capital vient après le cash-flow, dans une liste à part et refermée');
  });

  test('les trois rendements se rangent toujours dans le même ordre', () => {
    bien({ loyer: 1200, charges: [{ ...TAXE }], tauxImpot: 30, apport: 60000,
           credits: [{ ...PRET }] });
    const x = cf();
    pres(x.rendementBrut, 1200 * 12 / 240000 * 100, 'le brut, sur le prix payé');
    pres(x.rendementNet, (1200 - 250) * 12 / 240000 * 100, 'le net de charges');
    vrai(x.rendementNetNet < x.rendementNet && x.rendementNet < x.rendementBrut,
      'et l’estimation fiscale ferme la marche');
    pres(x.cashOnCash, x.cashFlow * 12 / 60000 * 100, 'le rendement sur apport');
    /* Sans apport, aucun chiffre sur une base inventee. */
    bien({ loyer: 1200 });
    eq(cf().cashOnCash, null, 'sans apport déclaré, il n’existe pas');
  });

  test('la hiérarchie est celle des questions : le cash-flow d’abord', () => {
    const carte = bloc('carteLocatif');
    const iCash = carte.indexOf('${cls(cf.cashFlow)}');
    /* Le libelle du rendement passe desormais par `ligneRendement`, qui traduit
       elle-meme : il s'ecrit en clair et non plus enveloppe de `trad`. */
    const iBrut = carte.indexOf("nom: 'Rendement brut'");
    vrai(iCash > 0 && iBrut > iCash, 'le cash-flow précède les rendements');
    vrai(/<dd class="\$\{cls\(cf\.cashFlow\)\}"><b>/.test(carte),
      'lui seul est en gras et coloré');
    /* « Net d'impot » annonçait une verite forte que la fiscalite actuelle ne
       porte pas : elle est declarative, pas modelisee. Le libelle le dit. */
    vrai(!/Net d'impôt/.test(carte), 'l’ancien libellé, trop affirmatif, est parti');
    vrai(/Rendement après fiscalité/.test(carte), 'le nouveau reste honnête, et court');
    vrai(!/<dd><b>\$\{fmtPct\(cf\.rendementNetNet/.test(carte),
      'et il n’est plus mis en gras comme une conclusion');
    /* La comparaison avec un livret a disparu : elle reduisait un montage a
       credit, avec son levier et son risque, a un placement sans risque. */
    vrai(!/livret/i.test(carte), 'plus de comparaison simpliste avec un livret');
    /* TROIS RENDEMENTS, ET PAS UN DE PLUS. Le rendement sur apport a quitte
       cette carte : quatre pourcentages sous une cascade de sept lignes font une
       carte qu'on ne parcourt plus, et celui-la repondait a une question
       d'investisseur quand les trois autres decrivent le bien. Le modele le
       calcule toujours, l'apport se lit dans « Financement ». */
    vrai(!/Rendement sur apport/.test(carte), 'le quatrième a quitté la carte');
    vrai(!/cashOnCash/.test(carte), 'et son calcul avec lui');
    eq((carte.match(/ligneRendement\(\{/g) || []).length, 3,
      'trois rendements, jamais quatre');
  });

  test('la base du rendement se dit, et ne change jamais en silence', () => {
    bien({ loyer: 1200 });
    eq(cf().surAchat, true, 'le prix payé est connu');
    pres(cf().base, 240000, 'donc la base, c’est lui');
    bien({ loyer: 1200, achat: 0 });
    eq(cf().surAchat, false, 'sans prix payé, la base change');
    pres(cf().base, 300000, 'et c’est la valeur du jour');
    const carte = bloc('carteLocatif');
    vrai(/cf\.surAchat \? trad\('le prix payé'\) : trad\('la valeur actuelle'\)/.test(carte),
      'et la carte annonce laquelle des deux');
    vrai(/\$\{trad\('sur'\)\} \$\{baseDite\}, \$\{fmtEUR0\(cf\.base\)\}/.test(carte),
      'avec son montant, pour qu’aucun doute ne subsiste');
  });

  test('un bien loué sans loyer réclame le loyer, il n’en invente pas un à zéro', () => {
    bien({ credits: [{ ...PRET }], charges: [{ ...TAXE }] });
    eq(usageBien(compteById('c_b')), 'locative', 'le bien reste déclaré mis en location');
    const carte = bloc('carteLocatif');
    vrai(/const loue = cf\.loyersPleins > 0\.005;/.test(carte), 'la carte voit qu’il n’y a pas de loyer');
    vrai(/Aucun loyer renseigné/.test(carte), 'et le dit');
    vrai(/data-action="ajouter-loyer"/.test(carte), 'avec le bouton qui le crée déjà rattaché');
    /* Ni cash-flow ni rendement : les deux supposeraient un loyer declare a zero,
       alors que la donnee manque simplement. */
    const iVide = carte.indexOf('Aucun loyer renseigné');
    const iCash = carte.indexOf('${cls(cf.cashFlow)}');
    vrai(iCash > iVide, 'le cash-flow vit sur l’autre branche');
    vrai(/if \(!loue\) return `/.test(carte), 'et cette branche rend tout de suite');
    /* Le cout, lui, reste vrai et reste dit. */
    pres(coutBien(compteById('c_b')).totalSorties, 1250, 'ce que le bien coûte est connu');
    vrai(/coûte déjà \{v\} par mois/.test(carte), 'et la carte le rappelle');
  });

  test('la pierre papier a sa propre fiche, et n’emprunte plus celle du locatif', () => {
    /* Elle prenait la carte du bien loue en direct : « Loyer potentiel »,
       « Vacance moyenne », « Mois loues par an » sur une SCPI. Or sa societe de
       gestion porte deja tout cela et distribue NET de sa propre vacance —
       saisir la sienne l'aurait retranchee une seconde fois. */
    bien({ type: 'scpi', usage: null, loyer: 900 });
    eq(estBienEnDirect(compteById('c_b')), false, 'une SCPI n’est pas détenue en direct');
    eq(usageEffectifBien(compteById('c_b')).action, null, 'et rien ne lui est demandé');
    const aiguillage = bloc('carteUsageBien');
    vrai(/if \(!estBienEnDirect\(c\)\) return cartePierrePapier\(c, idx, cf\);/
      .test(aiguillage), 'elle prend sa propre fiche');
    const i = aiguillage.indexOf('estBienEnDirect');
    const j = aiguillage.indexOf('usageEffectifBien');
    vrai(i > 0 && j > i, 'avant même que la question de l’usage se pose');
  });
});

/* Trois etats ou l'application ne SAIT pas, et ou elle a le choix entre se taire
   et inventer. Elle se tait, et elle dit ce qui lui manque. */
suite('Les usages qu’on ne peut pas trancher ne se tranchent pas', () => {

  const bien = ({ usages = [''], loyer = 0, type = 'immo' } = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [
      { id: 'd1', libelle: 'Prêt', montant: 200000, initial: 240000, taux: 2,
        mensualite: 1000, bienId: 'c_b' }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type, statut: 'ouvert', libelle: 'Immeuble',
      cash: [], lignes: usages.map((u, i) => ({ id: 'l' + i, classe: 'immobilier',
        libelle: ['Appartement', 'Studio'][i] || ('Lot ' + i), valeur: 200000,
        ...(u ? { usage: u } : {}) })) }];
    s.positions = []; s.monthly = [];
    s.budget.income = loyer
      ? [{ label: 'Loyer', amount: loyer, period: 'mois', bienId: 'c_b' }] : [];
    s.budget.fixedCharges = [{ label: 'Taxe foncière', amount: 250, period: 'mois',
                               shares: {}, bienId: 'c_b' }];
  });
  const bloc = (nom) => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf(`function ${nom}(`);
    vrai(i > 0, `${nom} doit être trouvable`);
    const suivante = Math.min(...[src.indexOf('\nfunction ', i + 1),
                                  src.indexOf('\nconst ', i + 1)]
      .filter(x => x > 0).concat([src.length]));
    return src.slice(i, suivante);
  };

  test('usage inconnu : la carte pose la question, et rien d’autre', () => {
    bien();
    const u = usageEffectifBien(compteById('c_b'));
    eq(u.source, 'inconnu', 'rien n’est déduit');
    eq(u.usage, '', 'et rien n’est inventé');
    /* L'aiguillage tombe sur la carte neutre : ni rendement, ni cout, ni
       vacance. Chacun de ces chiffres suppose une reponse qui n'a pas ete
       donnee, et les trois se contrediraient. */
    vrai(/return rendre \? rendre\(c, idx, cf\) : carteUsageInconnu\(c\);/
      .test(bloc('carteUsageBien')), 'un usage sans carte tombe sur la carte neutre');
    const neutre = bloc('carteUsageInconnu');
    vrai(/trad\('Usage du bien'\)/.test(neutre), 'elle se nomme');
    /* Et n'offre AUCUN bouton : le bandeau du haut porte deja « Choisir
       l'usage », et deux boutons identiques sur un meme ecran font douter qu'ils
       fassent la meme chose. */
    vrai(!/data-action="choisir-usage"/.test(neutre), 'sans reposer la question du bandeau');
    for (const mot of ['Rendement', 'Cash-flow', 'Total payé', 'Vacance', 'moisLoues'])
      vrai(!new RegExp(mot).test(neutre.replace(/\/\*[\s\S]*?\*\//g, '')),
        `« ${mot} » suppose une réponse qui n’a pas été donnée`);
    /* Rien ne disparait pour autant : la mensualite et les charges restent
       lisibles dans « Financement » et dans le budget. */
    pres(coutBien(compteById('c_b')).totalSorties, 1250, 'le coût reste calculable');
    pres(round2(budgetFrame().fixed), 250, 'et le budget est intact');
  });

  test('lots aux usages différents : la liste, et aucun calcul global', () => {
    bien({ usages: ['principale', 'locative'] });
    const u = usageEffectifBien(compteById('c_b'));
    eq(u.source, 'mixte', 'le compte n’a pas d’usage');
    eq(u.action, 'lots', 'et la fiche renvoie vers chaque lot');
    vrai(/if \(u\.action === 'lots'\) return carteUsageLots\(c\);/.test(bloc('carteUsageBien')),
      'l’aiguillage s’arrête là, avant toute carte financière');
    const lots = bloc('carteUsageLots');
    vrai(/c\.lignes \|\| \[\]\)\.filter/.test(lots), 'la carte liste les lots');
    vrai(/USAGE_BIEN_LABEL\[usageLigne\(l\)\]/.test(lots), 'avec l’usage de chacun');
    for (const mot of ['Rendement', 'Cash-flow', 'Total payé', 'cashFlowBien', 'coutBien'])
      vrai(!new RegExp(mot).test(lots.replace(/\/\*[\s\S]*?\*\//g, '')),
        `« ${mot} » mélangerait un logement habité et un studio loué`);
    /* Le patrimoine, lui, reste exact : il ne depend d'aucun usage. */
    pres(round2(patrimoine().brut), 400000, 'les deux lots comptent en entier');
    pres(round2(dettesTotal()), 200000, 'et la dette aussi');
  });

  test('un ancien bien déduit locatif garde son écran, et demande confirmation', () => {
    /* Le comportement historique est preserve — ces fiches affichaient un
       rendement, elles continuent — mais l'ecran dit que c'est une DEDUCTION, et
       rien n'est ecrit dans les donnees tant que personne n'a tranche. */
    bien({ usages: [''], loyer: 900 });
    const u = usageEffectifBien(compteById('c_b'));
    eq(u.usage, 'locative', 'l’écran locatif est conservé');
    eq(u.source, 'loyer', 'mais la source dit que c’est déduit');
    eq(u.action, 'confirmer', 'donc le bandeau demande confirmation');
    eq(compteById('c_b').lignes[0].usage, undefined,
      'et aucune migration silencieuse : la donnée reste vide');
    /* La carte est bien la locative, par la table des usages. */
    const table = lireSource('assets/app.js');
    vrai(/locative: \(c, idx, cf\) => carteLocatif\(c, idx, cf\)/.test(table),
      'un usage locatif, déduit ou déclaré, mène à la même carte');
    /* Et le bandeau de la fiche porte les trois demandes. */
    const espace = table.slice(table.indexOf('function espaceBien'));
    vrai(/const DEMANDES = \{/.test(espace), 'la table des demandes est sur la fiche');
    vrai(/if \(!u\.action\) return '';/.test(espace), 'et se tait quand rien n’est demandé');
  });

  test('un usage déclaré ne se laisse jamais requalifier par un loyer', () => {
    for (const [dit, carte] of [['principale', 'carteResidence'],
                                ['secondaire', 'carteResidence'],
                                ['locative', 'carteLocatif']]) {
      bien({ usages: [dit], loyer: 900 });
      const u = usageEffectifBien(compteById('c_b'));
      eq(u.usage, dit, `${dit} tient face à un loyer`);
      eq(u.source, 'declare', 'et reste une déclaration');
      const table = lireSource('assets/app.js');
      vrai(new RegExp(`${dit}: \\(c, idx, cf\\) => ${carte}\\(`).test(table),
        `${dit} mène à ${carte}, loyer ou pas`);
    }
  });
});

/* L'invariant que la refonte devait tenir : elle change ce que l'ecran montre,
   jamais ce que les donnees valent. */
suite('Changer la fiche d’un bien ne change pas le patrimoine', () => {

  const poser = (usage) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [
      { id: 'd1', libelle: 'Prêt', montant: 200000, initial: 240000, taux: 2,
        mensualite: null, tauxAssurance: 0.3, bienId: 'c_b' }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [], moisLoues: 11, tauxImpot: 30, apport: 60000,
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 300000,
                 prixDeRevient: 240000, ...(usage ? { usage } : {}) }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = [{ label: 'Loyer', amount: 1200, period: 'mois', bienId: 'c_b' }];
    s.budget.fixedCharges = [
      { label: 'Mensualité', amount: 1000, period: 'mois', shares: {},
        creditId: 'd1', bienId: 'c_b' },
      { label: 'Taxe foncière', amount: 250, period: 'mois', shares: {}, bienId: 'c_b' }];
  });

  const photo = () => ({
    brut: round2(patrimoine().brut), net: round2(patrimoine().net),
    dettes: round2(dettesTotal()),
    fixe: round2(budgetFrame().fixed), revenus: round2(budgetFrame().income),
    nRevenus: Store.state.budget.income.length,
    nCharges: Store.state.budget.fixedCharges.length,
    nCredits: Store.state.etabs[0].dettes.length,
  });

  test('les cinq usages donnent le même patrimoine, la même dette, le même budget', () => {
    const ref = (poser('locative'), photo());
    for (const usage of ['principale', 'secondaire', 'locative', '', null]) {
      poser(usage);
      const p = photo();
      for (const clef of Object.keys(ref))
        eq(p[clef], ref[clef], `${usage || 'sans usage'} : ${clef} ne bouge pas`);
    }
  });

  test('aucun revenu, aucune charge, aucun crédit n’est modifié par la refonte', () => {
    poser('principale');
    const revenus = JSON.stringify(Store.state.budget.income);
    const charges = JSON.stringify(Store.state.budget.fixedCharges);
    const credits = JSON.stringify(Store.state.etabs[0].dettes);
    /* Les trois lectures de la fiche, l'une apres l'autre. Aucune n'ecrit. */
    coutBien(compteById('c_b'));
    cashFlowBien(compteById('c_b'));
    usageEffectifBien(compteById('c_b'));
    chargesProposees(compteById('c_b'));
    eq(JSON.stringify(Store.state.budget.income), revenus, 'les revenus sont intacts');
    eq(JSON.stringify(Store.state.budget.fixedCharges), charges, 'les charges aussi');
    eq(JSON.stringify(Store.state.etabs[0].dettes), credits, 'et les crédits');
  });

  test('le coût du logement et le cash-flow lisent la même mensualité', () => {
    /* Deux portes sur un meme montant sont saines, deux montants ne le sont pas.
       La mensualite vit dans la charge qui rembourse le credit ; les deux cartes
       la lisent la, et la charge ne compte pas une seconde fois. */
    poser('principale');
    const co = coutBien(compteById('c_b')), cf = cashFlowBien(compteById('c_b'));
    pres(co.mensualite, cf.mensualite, 'une seule mensualité pour les deux cartes');
    pres(co.mensualite, 1000, 'celle de la charge qui rembourse');
    pres(co.autresCharges, 250, 'et la charge de remboursement n’est pas comptée deux fois');
    pres(co.totalSorties, 1250, 'donc le total sort une seule fois');
    /* Le budget, lui, compte bien les deux charges : ce sont deux sorties reelles. */
    pres(round2(budgetFrame().fixed), 1250, 'et le budget dit exactement la même chose');
  });
});

/* La pierre papier portait la fiche du locatif : « Loyer potentiel », « Vacance
   moyenne », « Mois loues par an » sur une SCPI. Or sa societe de gestion porte
   deja tout cela, et distribue NET de sa propre vacance : saisir la sienne
   l'aurait retranchee une seconde fois. */
suite('Un placement immobilier n’est pas un appartement', () => {

  const bloc = (nom) => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf(`function ${nom}(`);
    vrai(i > 0, `${nom} doit être trouvable`);
    const suivante = Math.min(...[src.indexOf('\nfunction ', i + 1),
                                  src.indexOf('\nconst ', i + 1)]
      .filter(x => x > 0).concat([src.length]));
    return src.slice(i, suivante).replace(/\/\*[\s\S]*?\*\//g, '');
  };

  const placement = ({ type = 'scpi', revenu = 900, charges = [], credits = [] } = {}) =>
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: credits }];
      s.comptes = [{ id: 'c_p', etabId: 'e_bq', type, statut: 'ouvert', libelle: 'SCPI',
        cash: [], lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Parts',
          valeur: 100000, prixDeRevient: 90000 }] }];
      s.positions = []; s.monthly = [];
      s.budget.income = revenu
        ? [{ label: 'Distribution', amount: revenu, period: 'mois', bienId: 'c_p' }] : [];
      s.budget.fixedCharges = charges;
    });

  test('elle ne passe plus par la fiche du locatif', () => {
    placement();
    eq(estBienEnDirect(compteById('c_p')), false, 'une SCPI n’est pas détenue en direct');
    const aiguillage = bloc('carteUsageBien');
    vrai(/if \(!estBienEnDirect\(c\)\) return cartePierrePapier\(c, idx, cf\);/.test(aiguillage),
      'elle prend sa propre fiche');
    vrai(!/carteLocatif/.test(aiguillage.slice(0, aiguillage.indexOf('usageEffectifBien'))),
      'et plus celle du bien loué en direct');
    /* La distinction vient du MODELE : `bienImmo` sans `direct`. Aucune liste de
       noms, aucun libelle — un support ajoute demain entre tout seul. */
    const src = lireSource('assets/store.js');
    vrai(/const estImmoEnDirect = t => !!t && !!t\.bienImmo && estDetenuEnDirect\(t\);/.test(src),
      'la frontière est celle des drapeaux du type');
  });

  test('elle ne montre ni loyer potentiel, ni vacance, ni mois loués', () => {
    const fiche = bloc('cartePierrePapier');
    for (const mot of ['Loyer potentiel', 'Vacance', 'vacanceEuros', 'moisLoues',
                       'mois loués', 'reglagesExploitation', 'Charges propriétaire',
                       'Résidence', 'usageEffectifBien']) {
      vrai(!new RegExp(mot).test(fiche),
        `« ${mot} » n’a pas de sens sur un placement : la gérance le porte déjà`);
    }
    /* Elle lit les distributions DECLAREES, et non le montant lisse par une
       vacance qui appartient au bien detenu en direct. */
    vrai(/const revenus = cf\.loyersPleins;/.test(fiche),
      'le revenu est celui qui est déclaré, sans lissage');
  });

  test('son bouton dit « Distribution », jamais « Loyer »', () => {
    const fiche = bloc('cartePierrePapier');
    vrai(/\$\{boutonsPierrePapier\(c\)\}/.test(fiche),
      'le placement a ses propres boutons');
    /* Le mot decide de ce qu'on croit devoir saisir, et « Loyer » reste au bien
       loue en direct. Deux fonctions plutot qu'un helper a trois libelles :
       chacune se lit d'un coup. */
    const pp = bloc('boutonsPierrePapier');
    vrai(/trad\('Distribution'\)/.test(pp) && /trad\('\+ Frais'\)/.test(pp),
      '« Distribution » et « Frais », les deux mots du placement');
    vrai(!/trad\('Loyer'\)/.test(pp) && !/\+ Charge/.test(pp),
      'et aucun mot de logement');
    const boutons = bloc('boutonsRattachement');
    vrai(/usage !== 'locative' \? '' :/.test(boutons),
      '« Loyer » reste réservé au bien loué en direct');
    /* La fenetre elle-meme suit le modele : on ne demande pas a une SCPI son
       « loyer hors charges recuperables ». */
    const src = lireSource('assets/app.js');
    const action = src.slice(src.indexOf("async 'ajouter-loyer'(btn) {"),
                             src.indexOf("async 'ajouter-charge-bien'(btn) {"));
    vrai(/const direct = estBienEnDirect\(c\);/.test(action), 'la fenêtre lit le modèle');
    vrai(/Revenu de \{v\}/.test(action), 'et propose le mot juste');
  });

  test('on ne lui demande jamais si on l’habite', () => {
    placement();
    eq(usageEffectifBien(compteById('c_p')).action, null, 'aucune demande d’usage');
    placement({ revenu: 900 });
    eq(usageEffectifBien(compteById('c_p')).action, null, 'même avec un revenu rattaché');
    /* Et le select d'usage disparait de ses lignes : il y etait pose sur chacune
       d'elles, proposant « Residence principale » a des parts de SCPI. */
    const src = lireSource('assets/app.js');
    const espace = src.slice(src.indexOf('function espaceBien'),
                             src.indexOf('function barreValiderFiche'));
    const i = espace.indexOf("trad('Usage')");
    vrai(i > 0, 'le champ d’usage doit être trouvable');
    vrai(/\$\{!estBienEnDirect\(c\) \? '' : `<div class="field"><label>\$\{trad\('Usage'\)\}/
      .test(espace), 'il ne s’écrit que pour un bien détenu en direct');
  });

  test('ses métriques de placement restent, et son crédit aussi', () => {
    /* La SCPI a credit est un montage courant : taire sa mensualite ferait
       disparaitre de l'argent qui sort vraiment. */
    placement({ revenu: 900, charges: [{ label: 'Frais de gestion', amount: 100,
      period: 'mois', shares: {}, bienId: 'c_p' }],
      credits: [{ id: 'd1', libelle: 'Prêt SCPI', montant: 80000, initial: 90000,
                  taux: 2, mensualite: 500, bienId: 'c_p' }] });
    const cf = cashFlowBien(compteById('c_p')), co = coutBien(compteById('c_p'));
    pres(cf.loyersPleins, 900, 'les distributions');
    pres(cf.charges, 100, 'les frais');
    pres(co.mensualite, 500, 'et la mensualité du crédit');
    vrai(co.capitalMois > 0, 'le capital remboursé se calcule comme ailleurs');
    const fiche = bloc('cartePierrePapier');
    vrai(/ligneMensualite\(cf, -1\)/.test(fiche), 'la mensualité s’affiche');
    vrai(/blocCapitalRembourse\(co\)/.test(fiche), 'et le capital remboursé aussi');
    vrai(/ligneCharges\(cf, -1, 'Frais'\)/.test(fiche), 'les charges s’appellent des frais');
    vrai(/Rendement brut/.test(fiche) && /Rendement net de frais/.test(fiche),
      'les rendements restent : c’est ce qu’on regarde sur un placement');
    /* Le net du mois est la somme de ses lignes, comme partout. */
    vrai(/const net = revenus - cf\.charges - cf\.mensualite;/.test(fiche),
      'et le net mensuel est exactement la somme des lignes affichées');
  });

  test('aucune SCPI n’est requalifiée, et le patrimoine ne bouge pas', () => {
    placement({ revenu: 900, credits: [{ id: 'd1', libelle: 'Prêt', montant: 80000,
      initial: 90000, taux: 2, mensualite: 500, bienId: 'c_p' }] });
    pres(round2(patrimoine().brut), 100000, 'la valeur des parts');
    pres(round2(dettesTotal()), 80000, 'la dette');
    pres(round2(patrimoine().net), 20000, 'et le net');
    pres(round2(budgetFrame().income), 900, 'le budget garde son revenu');
    eq(compteById('c_p').lignes[0].usage, undefined,
      'et rien n’a été écrit sur ses lignes : aucun usage inventé');
  });
});

/* Zero et l'inconnu s'ecrivaient pareil : « 0,00 % » sur un bien sans base, et
   rien du tout sur un capital rembourse reellement nul. Les deux erreurs sont
   symetriques — l'une invente une mesure, l'autre efface une reponse. */
suite('Zéro est une réponse, l’inconnu n’en est pas une', () => {

  const bloc = (nom) => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf(`function ${nom}(`);
    vrai(i > 0, `${nom} doit être trouvable`);
    const suivante = Math.min(...[src.indexOf('\nfunction ', i + 1),
                                  src.indexOf('\nconst ', i + 1)]
      .filter(x => x > 0).concat([src.length]));
    return src.slice(i, suivante);
  };

  const bien = ({ valeur = 300000, achat = 240000, loyer = 1200, moisLoues = 12,
                  credits = [], charges = [] } = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: credits }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Studio', cash: [], moisLoues, tauxImpot: 0,
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Studio', valeur,
                 prixDeRevient: achat, usage: 'locative' }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = loyer
      ? [{ label: 'Loyer', amount: loyer, period: 'mois', bienId: 'c_b' }] : [];
    s.budget.fixedCharges = charges;
  });
  const cf = () => cashFlowBien(compteById('c_b'));

  test('sans base, le rendement n’existe pas — il ne vaut pas zéro', () => {
    /* « 0,00 % » dit « le rendement est nul ». Sans valeur estimee ni prix paye,
       la verite est « on ne sait pas sur quoi le calculer », et ecrire zero fait
       passer une donnee absente pour une mesure : un chiffre s'affiche, donc
       personne ne cherche. */
    bien({ valeur: 0, achat: 0, charges: [{ label: 'Taxe', amount: 250,
      period: 'mois', shares: {}, bienId: 'c_b' }] });
    pres(cf().base, 0, 'aucune base');
    eq(cf().rendementBrut, null, 'donc aucun rendement brut');
    eq(cf().rendementNet, null, 'aucun rendement net non plus');
    eq(cf().rendementNetNet, null, 'ni après estimation fiscale');
    const src = lireSource('assets/store.js');
    vrai(/rendementBrut: base > 0 \? loyers \* 12 \/ base \* 100 : null,/.test(src),
      'la convention est écrite dans le modèle');
    vrai(/rendementNet: base > 0 \? \(loyers - charges\) \* 12 \/ base \* 100 : null,/.test(src),
      'pour les deux');
  });

  test('un vrai zéro reste possible, et reste montré', () => {
    /* Base connue, loyer nul : le rendement EST nul, et c'est une information.
       La convention ne doit pas faire disparaitre les vrais zeros. */
    bien({ moisLoues: 0 });
    pres(cf().base, 240000, 'la base est connue');
    pres(cf().loyers, 0, 'aucun loyer retenu : le bien n’a pas été loué');
    pres(cf().rendementBrut, 0, 'le rendement est nul, et il se dit');
    eq(cf().rendementBrut === null, false, 'ce n’est pas un inconnu');
  });

  test('l’écran n’écrit jamais 0,00 % à la place d’une base manquante', () => {
    const ligne = bloc('ligneRendement');
    vrai(/const inconnu = valeur == null;/.test(ligne),
      'la ligne distingue l’absence de la nullité');
    vrai(/Base à renseigner/.test(ligne), 'et dit ce qui manque');
    /* Le pourcentage ne s'ecrit que du cote connu. */
    vrai(/inconnu \? `<span class="muted">\$\{trad\('Base à renseigner'\)\}<\/span>`/.test(ligne),
      'aucun pourcentage du côté inconnu');
    vrai(/: fmtPct\(valeur, 2\)/.test(ligne), 'et le pourcentage du côté connu');
    /* Et les trois rendements de la fiche locative passent par elle. */
    const locatif = bloc('carteLocatif');
    for (const nom of ['Rendement brut', 'Rendement net de charges',
                       'Rendement après fiscalité']) {
      vrai(new RegExp(`ligneRendement\\(\\{[\\s\\S]{0,120}${nom}`).test(locatif),
        `« ${nom} » passe par la ligne qui sait se taire`);
    }
    vrai(!/fmtPct\(cf\.rendement/.test(locatif),
      'et aucun rendement ne s’écrit plus directement');
  });

  test('un capital remboursé inconnu ne s’invente pas', () => {
    bien({ credits: [{ id: 'd1', libelle: 'Prêt', montant: 200000, initial: 240000,
                       taux: null, mensualite: 1000 }] });
    const co = coutBien(compteById('c_b'));
    eq(co.capitalMois, null, 'sans taux, on ne sait pas départager');
    eq(co.horsCapital, null, 'et le coût consommé se tait aussi');
    eq(co.ventilation, 'aucune', 'la ventilation est absente');
    vrai(/if \(co\.capitalMois == null\) return '';/.test(bloc('blocCapitalRembourse')),
      'le bloc ne s’écrit pas : rien n’est connu');
  });

  test('un capital remboursé réellement nul s’affiche, et s’explique', () => {
    /* Une mensualite qui ne couvre pas ses interets ne rembourse rien : c'est
       CONNU, et ca vaut zero. Faire disparaitre le bloc laissait croire que la
       question ne se posait pas. */
    bien({ credits: [{ id: 'd1', libelle: 'Prêt', montant: 200000, initial: 200000,
                       taux: 12, mensualite: 500 }] });
    const co = coutBien(compteById('c_b'));
    const e = echeancierCredit(Store.state.etabs[0].dettes[0]);
    pres(e.interetsDuMois, 200000 * 0.12 / 12, 'les intérêts du mois dépassent la mensualité');
    eq(e.amortissable, false, 'la dette ne s’éteint jamais');
    eq(co.capitalMois, 0, 'et le capital remboursé vaut zéro — connu, pas inconnu');
    eq(co.capitalMois === null, false, 'surtout pas null : la réponse existe');
    const b = bloc('blocCapitalRembourse');
    vrai(/const nul = co\.capitalMois < 0\.005;/.test(b), 'l’écran reconnaît ce cas');
    vrai(/nul \? fmtEUR\(0\)/.test(b), 'et affiche zéro euro');
    vrai(/La mensualité actuelle ne réduit pas le capital/.test(b), 'avec ce qu’il faut en dire');
    /* Le cout hors capital vaudrait alors le total paye, deja affiche : une
       ligne de plus qui ne dit rien de plus. */
    vrai(/nul \|\| co\.horsCapital == null \? '' :/.test(b),
      'et la ligne du coût consommé se tait, puisqu’elle répéterait le total');
    pres(co.horsCapital, co.totalSorties, 'car tout ce qui sort est consommé');
  });

  test('un capital remboursé positif garde son comportement', () => {
    bien({ credits: [{ id: 'd1', libelle: 'Prêt', montant: 200000, initial: 240000,
                       taux: 2, mensualite: 1000, tauxAssurance: 0.3 }] });
    const co = coutBien(compteById('c_b'));
    vrai(co.capitalMois > 0, 'du capital se rembourse');
    pres(co.capitalMois + co.horsCapital, co.totalSorties, 'et les deux lignes font le total');
    const b = bloc('blocCapitalRembourse');
    vrai(/Cette somme réduit ta dette et augmente ton patrimoine net/.test(b),
      'la phrase qui empêche de le lire de travers est toujours là');
  });

  test('la ventilation partielle garde le capital connu et le dit', () => {
    /* Le comportement de C, verifie encore : un minorant vrai vaut mieux qu'un
       silence, et mieux qu'un total qui melangerait connu et inconnu. */
    bien({ credits: [
      { id: 'd1', libelle: 'Prêt', montant: 200000, initial: 240000, taux: 2,
        mensualite: 1000, tauxAssurance: 0.3 },
      { id: 'd2', libelle: 'Travaux', montant: 50000, initial: 50000, mensualite: 400 }] });
    const co = coutBien(compteById('c_b'));
    eq(co.ventilation, 'partielle', 'un crédit sur deux ne dit pas son taux');
    eq(co.nbCredits, 2, 'sur deux');
    eq(co.nbVentiles, 1, 'un seul se ventile');
    vrai(co.capitalMois > 0, 'le capital connu reste dit');
    eq(co.horsCapital, null, 'mais le coût consommé se tait');
    vrai(/ne compte que les autres/.test(bloc('noteVentilation')),
      'et l’écran dit ce que ce chiffre ne couvre pas');
  });
});

/* Deux boutons identiques sur un meme ecran font douter qu'ils fassent la meme
   chose, et on cherche la difference. Une seule porte par question. */
suite('La valeur nette et le choix de l’usage ne se disent qu’une fois', () => {

  const espace = () => {
    const src = lireSource('assets/app.js');
    return src.slice(src.indexOf('function espaceBien'),
                     src.indexOf('function barreValiderFiche'));
  };

  const bien = ({ usage = 'principale', credit = 0, part = null } = {}) =>
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: credit
        ? [{ id: 'd1', libelle: 'Prêt', montant: credit, initial: credit, taux: 2,
             mensualite: 1000, bienId: 'c_b' }] : [] }];
      s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Maison', cash: [], lignes: [{ id: 'l0', classe: 'immobilier',
          libelle: 'Maison', valeur: 350000, prixDeRevient: 300000,
          ...(part ? { part } : {}), ...(usage ? { usage } : {}) }] }];
      s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = [];
    });

  test('un bien sans dette a une valeur nette, et elle vaut sa valeur', () => {
    /* Elle ne s'affichait qu'avec un credit : la ligne la plus importante de la
       fiche disparaissait chez qui a fini de rembourser. La valeur nette d'un
       bien sans dette n'est pas « sans objet », elle vaut sa valeur. */
    bien({ credit: 0 });
    pres(round2(patrimoine().brut), 350000, 'le bien vaut trois cent cinquante mille');
    pres(round2(dettesTotal()), 0, 'et ne doit rien');
    const e = espace();
    vrai(/\$\{!credit && !estBienEnDirect\(c\) \? '' : `<dt><b>\$\{trad\('Valeur nette'\)\}/
      .test(e), 'la valeur nette s’affiche même sans crédit');
    vrai(/<dd><b>\$\{fmtEUR\(valeur - credit\)\}<\/b><\/dd>/.test(e),
      'et vaut la valeur détenue moins le capital restant, donc la valeur seule');
    /* La ligne du capital restant, elle, ne s'ecrit pas a zero : elle
       n'apprendrait rien que la suivante ne dise. */
    vrai(/\$\{!credit \? '' : `<dt>\$\{trad\('Capital restant dû'\)\}/.test(e),
      'aucune ligne « Capital restant dû : 0 € »');
  });

  test('la quote-part rétrécit la valeur nette, comme le reste du patrimoine', () => {
    bien({ credit: 0, part: 50 });
    pres(round2(patrimoine().brut), 175000, 'la moitié entre au patrimoine');
    /* Et la fiche lit `valeur`, la part detenue, non `entiere`. */
    vrai(/fmtEUR\(valeur - credit\)/.test(espace()), 'la valeur nette part de la part détenue');
  });

  test('un usage inconnu n’offre qu’un seul bouton dans toute la fiche', () => {
    const e = espace();
    /* Le bandeau du haut porte la demande et son bouton. */
    vrai(/const DEMANDES = \{/.test(e), 'le bandeau porte les trois demandes');
    vrai(/data-action="choisir-usage"/.test(e), 'et son bouton');
    /* La carte du bas ne le repete plus. */
    const src = lireSource('assets/app.js');
    const carte = src.slice(src.indexOf('function carteUsageInconnu'),
                            src.indexOf('function carteUsageLots'));
    vrai(!/data-action="choisir-usage"/.test(carte),
      'la carte du bas ne repose pas la même question');
    vrai(!/<button/.test(carte), 'elle ne porte aucun bouton du tout');
    vrai(/Les indicateurs mensuels apparaîtront une fois l’usage précisé/.test(carte),
      'elle dit seulement ce qui attend');
    vrai(/Le choix se fait en haut de cette fiche/.test(carte), 'et où le faire');
    /* Un seul « choisir-usage » sur toute la fiche d'un bien : le bandeau. */
    const fiche = src.slice(src.indexOf('function espaceBien'),
                            src.indexOf('function barreValiderFiche'))
      + src.slice(src.indexOf('function carteUsageInconnu'),
                  src.indexOf('function carteUsageLots'));
    eq((fiche.match(/data-action="choisir-usage"/g) || []).length, 1,
      'une seule porte, pas deux');
  });

  test('un usage à confirmer ne multiplie pas les CTA non plus', () => {
    /* Le legacy deduit locatif affiche la fiche locative, qui ne porte aucun
       bouton d'usage : le bandeau reste seul a demander. */
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
      s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Studio', cash: [], lignes: [{ id: 'l0', classe: 'immobilier',
          libelle: 'Studio', valeur: 200000, prixDeRevient: 180000 }] }];
      s.positions = []; s.monthly = [];
      s.budget.income = [{ label: 'Loyer', amount: 900, period: 'mois', bienId: 'c_b' }];
      s.budget.fixedCharges = [];
    });
    eq(usageEffectifBien(compteById('c_b')).action, 'confirmer', 'le bandeau demande');
    const src = lireSource('assets/app.js');
    const locatif = src.slice(src.indexOf('function carteLocatif'),
                              src.indexOf('function lignesDuMois'));
    vrai(!/choisir-usage/.test(locatif), 'et la carte locative ne redemande rien');
    /* Le cas des lots non plus : il n'a jamais eu de bouton, et n'en gagne pas. */
    const lots = src.slice(src.indexOf('function carteUsageLots'),
                           src.indexOf('const CARTES_USAGE'));
    vrai(!/<button/.test(lots), 'la carte des lots reste sans bouton');
  });

  test('rien de tout cela ne touche aux données', () => {
    bien({ usage: 'principale', credit: 150000 });
    const avant = { brut: round2(patrimoine().brut), net: round2(patrimoine().net),
      dettes: round2(dettesTotal()), fixe: round2(budgetFrame().fixed),
      revenus: round2(budgetFrame().income),
      credits: JSON.stringify(Store.state.etabs[0].dettes),
      lignes: JSON.stringify(compteById('c_b').lignes) };
    /* Les lectures de la fiche, l'une apres l'autre. */
    coutBien(compteById('c_b'));
    cashFlowBien(compteById('c_b'));
    usageEffectifBien(compteById('c_b'));
    chargesProposees(compteById('c_b'));
    pres(round2(patrimoine().brut), avant.brut, 'le patrimoine brut');
    pres(round2(patrimoine().net), avant.net, 'le net');
    pres(round2(dettesTotal()), avant.dettes, 'les dettes');
    pres(round2(budgetFrame().fixed), avant.fixe, 'les charges fixes');
    pres(round2(budgetFrame().income), avant.revenus, 'les revenus');
    eq(JSON.stringify(Store.state.etabs[0].dettes), avant.credits, 'aucun crédit modifié');
    eq(JSON.stringify(compteById('c_b').lignes), avant.lignes, 'aucune ligne modifiée');
  });
});

finDePartieDeTests('tests/18-releve-note-sa-propre.tests.js');
