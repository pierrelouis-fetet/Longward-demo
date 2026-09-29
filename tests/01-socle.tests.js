partieDeTests('tests/01-socle.tests.js');
/* Ce que ces tests protègent.

   Chacune des suites ci-dessous correspond à un défaut réellement trouvé dans
   l'application, à la main, en pilotant un navigateur. Aucun n'était exotique,
   et tous auraient été pris en une seconde par les assertions qui suivent.

   La règle qui les gouverne : **un total doit égaler la somme de ses parts**.
   Presque tous les bugs de calcul rencontrés étaient des violations de cette
   phrase, et aucun ne se voyait à l'écran — les chiffres avaient l'air justes,
   ils étaient simplement faux. */

const { suite, test, pres, eq, vrai, leve } = Tests;

/* CET ARBRE PORTE-T-IL LA GRAINE DE DEMONSTRATION ?

   Le projet a trois points de sortie : le depot prive, la demonstration
   publique avec son patrimoine fictif, et la beta, qui part a vide pour qu'un
   testeur pose ses propres chiffres sans faire le menage d'abord.

   LE SIGNAL EST LA GRAINE ELLE-MEME, et non un drapeau pose a cote. Une
   premiere version lisait `SEED_VERSION`, qui n'existe que dans la graine de la
   demonstration — mais le depot prive n'en porte pas non plus, et sa graine est
   pleine : le controle s'y serait cru sur un arbre vide et aurait exige d'une
   graine bien garnie qu'elle ne porte aucun compte. Un drapeau qui repond a
   cote de la question finit toujours par repondre faux.

   LES CONTROLES CONCERNES NE SE TAISENT PAS POUR AUTANT. « Le jeu porte deux
   comptes de titres » n'a pas d'objet sur un arbre vide ; « sa graine ne porte
   aucun compte » en a un, et c'est la verite de cet arbre-la. Un controle qui
   se tait est pire qu'absent : il compte pour un vert. */
function sansGraineDeDemo(quoi) {
  const garnie = (SEED.accounts || []).length || (SEED.positions || []).length;
  if (garnie) return false;
  eq((SEED.accounts || []).length, 0,
    quoi + ' : cet arbre part à vide, et sa graine ne porte aucun compte');
  return true;
}

/* Le texte d'un fichier du projet, en synchrone comme le harnais.

   Deux sortes de tests s'en servent. Les regles qui vivent dans `app.js` ne
   peuvent etre verifiees que comme du texte, puisque le harnais ne charge pas
   ce fichier — mais quand la fonction visee ne depend de rien, on la reconstruit
   depuis sa source et on l'execute pour de vrai : une assertion sur le
   comportement vaut mieux qu'une recherche de motif dans une chaine. */
/* Lue une fois par chargement de page, et retenue.

   Cinq cent douze appels partaient d'ici, dont trois cent quarante-six sur
   `app.js`, qui pese pres d'un mega-octet : trois cent quarante mega-octets
   relus en XHR SYNCHRONE, donc sur le fil principal, a chaque execution. Deux
   consequences, et la seconde etait prise pour une fatalite :

   - la suite mettait cent douze secondes, dont l'essentiel a relire les memes
     octets ;
   - une lecture tombait de temps en temps — « Failed to execute 'send' » — sur
     un test qui changeait a chaque fois, ce qui obligeait a relancer avant de
     pouvoir croire un rouge. Le defaut n'etait pas dans la suite, il etait dans
     le nombre de lectures.

   Le casse-cache reste, et il garde son role : au PREMIER appel, il interdit au
   navigateur de servir une copie d'avant la modification qu'on vient d'ecrire.
   Dans un meme chargement, en revanche, un fichier ne change pas — le relire ne
   peut rien apprendre. Recharger la page vide la memoire et relit tout.

   Un echec de lecture n'est pas retenu : il serait resservi a toutes les suites
   suivantes, transformant un incident en cascade. */
const SOURCES = new Map();

/* Le texte d'une action d'ACTIONS, de sa ligne de tete a sa virgule finale.
   Les actions vivent en plusieurs fichiers, rangees par domaine : borner une
   action par le nom de sa voisine donnerait une tranche qui change avec le
   rangement, ou qui court jusqu'a la fin si la voisine a change de forme. */
function membreAction(src, nom) {
  const echappe = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^  (?:async )?'${echappe}'\\s*([(:])`, 'm').exec(src);
  if (!m) return '';
  if (m[1] === ':') return src.slice(m.index, src.indexOf('\n', m.index) + 1);
  const fin = src.indexOf('\n  },\n', m.index);
  return fin < 0 ? '' : src.slice(m.index, fin + '\n  },\n'.length);
}

function lireSource(fichier) {
  if (SOURCES.has(fichier)) return SOURCES.get(fichier);
  /* Un fichier decoupe se lit comme avant : ses parties, dans l'ordre du
     manifeste et privees de leurs lignes de marqueur, rendent le texte
     d'origine. Les controles qui cherchent une fonction dans `assets/app.js`
     ne savent pas en combien de fichiers elle vit. */
  const parties = partiesDuGroupe(fichier);
  let texte;
  if (parties) {
    const morceaux = parties.map(lireSource);
    texte = morceaux.includes(null) ? null
      : morceaux.map((t, k) => k ? t.replace(ENTETE_DE_LICENCE, '') : t).join('').replace(LIGNE_MARQUEUR, '');
  } else {
    const r = new XMLHttpRequest();
    r.open('GET', fichier + '?lint=' + Date.now(), false);
    r.send();
    texte = r.status === 200 ? r.responseText : null;
  }
  if (texte !== null) SOURCES.set(fichier, texte);
  return texte;
}

/* Jouer un controle a une date choisie.

   `todayISO` est une declaration de fonction, donc remplacable -- un `const`
   lexical ne le serait pas. Le retablissement est dans un `finally` : un
   echec au milieu laisserait sinon toutes les suites suivantes a la date
   choisie.

   Une seule definition, en haut, pour toutes les suites qui en ont besoin. */
function auJour(iso, faire) {
  const vrai0 = window.todayISO;
  window.todayISO = () => iso;
  try { faire(); } finally { window.todayISO = vrai0; }
}

/* Jouer un controle dans une langue choisie, masque leve.

   Meme `finally` que ci-dessus, et pour une raison plus grave : cette page
   partage son origine avec l'application, donc son `localStorage`. La langue
   qu'on deplace ici est la vraie, celle du detenteur — un echec au milieu
   laisserait son application en anglais. Le masque suit la meme regle : un
   montant masque rend un oeil barre, sur lequel aucun format ne se lit. */
/* La langue dans laquelle l'application s'ouvre, lue dans `i18n.js`.

   C'est la seule divergence entre les deux depots — la demonstration ouvre en
   anglais, l'instance privee en francais — et plusieurs controles en dependent.
   La recopier dans chacun d'eux aurait fait deux tests a editer pour un depot,
   et un test faux pour l'autre. */
/* LA LANGUE PAR DEFAUT N'EST PLUS UNE CONSTANTE, C'EST UN REPLI.

   L'application ouvrait en anglais pour tout le monde ; elle suit desormais
   les langues annoncees par le navigateur, et ne retombe sur une valeur fixe
   que si aucune n'est reconnue. C'est cette valeur-la que les fichiers servis
   declarent — un fichier statique ne peut pas deviner qui le lit — et c'est
   donc elle que les controles doivent comparer.

   Elle se lit dans `langueDuNavigateur()`, sur son dernier `return` : le seul
   chemin qui ne depend ni du stockage ni du navigateur. */
function langueParDefaut() {
  const src = lireSource('assets/i18n.js');
  vrai(/getItem\(LANG_KEY\) \|\| langueDuNavigateur\(\)/.test(src),
    'la langue doit s’hériter du navigateur faute de choix enregistré');
  const fn = src.slice(src.indexOf('function langueDuNavigateur()'),
                       src.indexOf('function currentLang()'));
  const m = fn.match(/return '(\w+)';\s*\}\s*$/);
  vrai(m, 'le repli ultime doit se lire dans langueDuNavigateur');
  return m[1];
}

function enLangue(code, faire) {
  const lang0 = currentLang();
  const masque0 = masqueActif();
  setLang(code);
  setMasque(false);
  try { faire(); } finally { setLang(lang0); setMasque(masque0); }
}

/* ------------------------------------------------------------------
   1. Les totaux ne mentent pas
   ------------------------------------------------------------------ */
/* Le corps d'une fonction, de sa declaration a son accolade de fin en colonne
   zero.

   Deux controles de la page Allocation lisaient une fenetre de taille fixe,
   2000 et 1400 caracteres. Ajouter six lignes de commentaire a pousse le
   troisieme anneau hors de la fenetre : le controle a cesse de le voir et a
   continue de passer sur ce qui restait. Un test qui rapetisse en silence est
   pire qu'un test absent, parce qu'il rassure. Une borne comptee en caracteres
   n'est pas une borne. */
function corpsDe(src, nom) {
  const d = src.indexOf('function ' + nom);
  if (d < 0) return '';
  const f = src.indexOf('\n}\n', d);
  return src.slice(d, f < 0 ? undefined : f + 3);
}

suite('Les totaux égalent la somme de leurs parts', () => {

  test('un premier lancement rend un état complet, pas une coquille', () => {
    if (sansGraineDeDemo('le premier lancement')) return;
    /* `load()` ne migrait que l'etat relu du stockage. Sur une machine vierge
       elle posait la graine telle quelle, dans l'ancien modele, et rendait la
       main : `comptes` n'existait pas, et tout ce qui en descend valait zero.
       L'accueil affichait « 0 € » sous ses huit cartes.

       Le defaut ne durait qu'un instant — la premiere sauvegarde repassait par
       la migration — donc il etait invisible en developpement, ou le stockage
       est toujours deja rempli. Il ne se voyait qu'a la premiere visite, la
       seule qui compte pour une demonstration publique.

       Le controle rejoue ce chemin sans toucher au stockage. Le harnais ne lit
       ni n'ecrit jamais `localStorage` — `tests.html` l'annonce — et un test qui
       effacerait la cle effacerait les donnees de qui lance les tests. On pose
       donc la graine a la main, exactement comme `load()` le fait, et on la
       passe par la migration. Que `load()` appelle bien cette migration est
       verifie a part, sur le source. */
    Store.state = structuredClone(SEED);
    Store.migrate();
    refreshAccounts();
    vrai(Array.isArray(Store.state.comptes),
      'la graine doit traverser la migration : les comptes existent');
    eq(Store.state.schemaVersion, 2, 'et le schéma est à jour');
    vrai(patrimoine().brut > 0,
      'le patrimoine d’un premier lancement ne vaut pas zéro');
    vrai(Store.state.comptes.length > 0, 'au moins un compte en est sorti');
    /* Et l'operation est idempotente : la rejouer ne doit rien doubler. */
    const avant = Store.state.comptes.length;
    Store.migrate();
    eq(Store.state.comptes.length, avant, 'rejouer la migration ne double rien');
  });

  test('le brut vaut la somme des poches', () => {
    Fixture.poser();
    const p = poches();
    const somme = p.courant + p.precaution + p.projet + p.investir
      + p.classes.actions + p.classes.obligations + p.classes.crypto
      + p.classes.nonCote + p.classes.immobilier;
    pres(patrimoine().brut, somme, 'patrimoine().brut doit valoir la somme de poches()');
    pres(patrimoine().brut, Fixture.BRUT, 'le fixture vaut 138 250 €');
  });

  test('le net retranche les crédits, une seule fois', () => {
    Fixture.poser();
    pres(patrimoine().net, Fixture.BRUT - Fixture.DETTE, 'net = brut − dettes');
    pres(nowTotals().net, Fixture.BRUT - Fixture.DETTE, 'nowTotals().net');
  });

  test('les cinq poches d’affichage refont le brut', () => {
    Fixture.poser();
    const g = nowByGroup();
    pres(g.cash + g.bourse + g.crypto + g.pe + g.immo, Fixture.BRUT,
      'nowByGroup() doit couvrir tout le patrimoine, crypto et immobilier compris');
  });

  test('investi + à investir + disponible refont le brut', () => {
    /* La carte du haut d'Allocation : ses parts doivent refaire le brut. Trois
       tuiles qui laisseraient le cash a investir hors de tout annonceraient
       moins de 100 % d'un patrimoine, et `invested` ne doit pas le retrancher
       une seconde fois. */
    Fixture.poser();
    const t = nowTotals();
    pres(t.invested + t.toInvest + (t.cash - t.toInvest), t.brut,
      'les trois parts de la carte « disponibilité » doivent faire le brut');
    vrai(t.cash >= t.toInvest, 'le cash total contient le cash à investir');
  });

  test('la répartition par classe refait le brut', () => {
    Fixture.poser();
    const somme = repartitionClasses().reduce((s, x) => s + x.value, 0);
    pres(somme, Fixture.BRUT, 'repartitionClasses() — la liste de l’accueil');
  });

  test('l’allocation par actif refait le patrimoine net', () => {
    /* Net et non brut : la liste porte une ligne « Crédits en cours »
       négative. Sans dette dans les données, les deux coïncident et le test
       ne prouverait rien — le fixture en a une. */
    Fixture.poser();
    const somme = allocationByAsset().reduce((s, x) => s + x.value, 0);
    pres(somme, nowTotals().total, 'allocationByAsset()');
    pres(somme, Fixture.BRUT - Fixture.DETTE, 'soit le net');

    /* Sans la ligne des credits, la meme liste se totalise aux avoirs, et ses
       parts font 100 % de cette base-la. C'est ce que demande la carte de
       repartition, dont le camembert compte deja en brut : deux granularites
       d'un meme axe ne peuvent pas s'annoncer sous deux bases differentes. */
    const brut = allocationByAsset({ credits: false });
    pres(brut.reduce((s, x) => s + x.value, 0), Fixture.BRUT,
      'sans les crédits, la somme fait les avoirs');
    pres(brut.reduce((s, x) => s + x.pct, 0), 100,
      'et les parts se rapportent bien à cette base');
    vrai(!brut.some(x => x.value < 0),
      'plus aucune part négative : un crédit n’est pas un endroit où l’argent est');
  });

  test('le portefeuille de titres refait son total', () => {
    Fixture.poser();
    const s = stockTotals();
    pres(s.invested + s.cashToInvest, s.balance,
      'titres + à investir = total chez les courtiers');
    pres(s.balance, 11250, '9 000 d’ETF + 750 d’or + 1 500 de cash');
  });
});

suite('Comptes séparés et authentification', () => {
  test('le stockage local porte l’identifiant stable du compte', () => {
    const store = lireSource('assets/store.js');
    vrai(/function setStorageScope\(scope\)/.test(store), 'le compte définit sa portée locale');
    vrai(/cleParUtilisateur\(modeDemo\(\) \? CLE_DEMO : CLE_REELLE\)/.test(store),
      'les données sont rangées dans cette portée');
    vrai(/localStorage\.getItem\(cleSauvegardes\(\)\)/.test(store),
      'les sauvegardes suivent la même portée');
    const app = lireSource('assets/app.js');
    const init = app.slice(app.indexOf('(async function init()'), app.indexOf("if (location.protocol === 'file:')"));
    vrai(init.indexOf('await CloudSync.probe();') < init.indexOf('Store.load();'),
      'l’identité est établie avant de charger des données locales');
  });

  test('un ancien onglet ne peut pas écrire sous le compte suivant', () => {
    const sync = lireSource('assets/cloudsync.js');
    vrai(/'X-Longward-User': userId \|\| ''/.test(sync),
      'chaque requête nomme le compte qui a produit son état');
    vrai(/user=\$\{encodeURIComponent\(userId \|\| ''\)\}/.test(sync),
      'le dernier envoi de fermeture nomme aussi ce compte');
    const worker = lireSource('_worker.js');
    vrai(/claimedOwner !== owner/.test(worker),
      'le serveur refuse une requête produite avant un changement de session');
  });

  test('les comptes et patrimoines sont reliés dans D1', () => {
    const schema = lireSource('schema.sql');
    vrai(/CREATE TABLE IF NOT EXISTS users/.test(schema), 'les utilisateurs existent');
    vrai(/owner_id TEXT PRIMARY KEY REFERENCES users\(id\)/.test(schema),
      'un patrimoine appartient à un utilisateur');
    vrai(/token_hash TEXT PRIMARY KEY/.test(schema), 'les jetons de session ne sont pas stockés en clair');
    const worker = lireSource('_worker.js');
    vrai(/email_confirmed_at/.test(worker), 'une adresse non confirmée ne crée pas de session');
    /* Le controle d'origine accepte deux preuves, et c'est voulu : `Origin`,
       et `Sec-Fetch-Site` que le navigateur pose lui-meme et qu'aucun script
       de page ne peut ecrire. Un POST venu d'un autre site porte
       `cross-site` ; un client hors navigateur peut forger l'en-tete mais n'a
       pas le cookie de la victime, donc ne gagne rien. */
    vrai(/Origin'\) === url\.origin/.test(worker),
      'l’origine de la requête est comparée à celle du site');
    vrai(/includes\(request\.method\) && !memeOrigine/.test(worker),
      'les formulaires et écritures venant d’un autre site sont refusés');
    vrai(/DELETE FROM sessions WHERE token_hash/.test(worker), 'la déconnexion révoque la session');
    vrai(/WHERE owner_id = \? AND revision = \?/.test(worker),
      'une écriture concurrente ne peut pas écraser une révision différente');
  });

  test('demander un code coûte quelque chose à qui en abuse', () => {
    /* L'endpoint est ouvert par nature, prend une adresse quelconque et fait
       partir du courrier signe du domaine. Le plafond du fournisseur vaut pour
       le PROJET : quelqu'un qui le sature bloque les vrais testeurs. Le
       compteur doit donc vivre ici. */
    const worker = lireSource('_worker.js');
    const schema = lireSource('schema.sql');
    vrai(/CREATE TABLE IF NOT EXISTS auth_throttle/.test(schema), 'le compteur a sa table');
    vrai(/ON CONFLICT\(bucket\) DO UPDATE SET/.test(worker),
      'le compteur s’incrémente en une seule instruction, pas en lecture puis écriture');
    vrai(/otp:ip:\$\{clientIp\(request\)\}/.test(worker), 'le débit est compté par adresse IP');
    vrai(/otp:mail:\$\{email\}/.test(worker), 'et par adresse e-mail visée');
    vrai(/code:mail:\$\{email\}/.test(worker),
      'les essais de code sont comptés : six chiffres se devinent sans limite');

    /* L'ordre compte : les compteurs avant l'appel sortant, sinon on paie
       l'envoi avant de decider qu'on le refusait. */
    const envoi = worker.indexOf("path === '/api/auth/request-code'");
    const bloc = worker.slice(envoi, worker.indexOf("path === '/api/auth/verify-code'"));
    vrai(bloc.indexOf('otp:ip:') < bloc.indexOf("'/auth/v1/otp'"),
      'le compteur passe avant l’envoi du courrier');
  });

  test('le contrôle anti-robot dort tant qu’il n’est pas configuré', () => {
    const worker = lireSource('_worker.js');
    vrai(/if \(!env\.TURNSTILE_SECRET_KEY\) return true;/.test(worker),
      'sans clef secrète, la porte laisse passer comme avant');
    vrai(/siteKey \? '' :/.test(worker),
      'sans clef publique, aucun widget n’est affiché');
    vrai(/turnstile\/v0\/siteverify/.test(worker),
      'le jeton se vérifie côté serveur, sinon le widget n’est qu’une image');
    vrai(/env\.TURNSTILE_SITE_KEY \? ' https:\/\/challenges\.cloudflare\.com' : ''/.test(worker),
      'la CSP ne s’ouvre au script tiers que si le widget existe');
    /* Le motif vise la chaîne construite, pas le commentaire qui la décrit :
       une première version cherchait « script-src … unsafe-inline » partout et
       tombait sur la prose qui explique justement qu’il n’y en a pas. */
    vrai(/"default-src 'self'; script-src 'self'"/.test(worker),
      'et elle ne s’ouvre jamais aux scripts en ligne');
  });

  test('l’ancienne porte se ferme dès que les comptes servent', () => {
    /* Le mot de passe unique ne porte aucune identite : sa session retombe sur
       `state:default`, partage par tous ceux qui le connaissent. La consigne
       de ne pas le definir vivait dans un document ; elle vit maintenant dans
       le code, ou personne n'a besoin de se la rappeler. */
    const worker = lireSource('_worker.js');
    vrai(/const motDePasseAdmis = !!pwd && !emailAuthReady;/.test(worker),
      'le mot de passe partagé cesse d’ouvrir quand les comptes existent');
    vrai(/env\.ALLOW_PUBLIC === '1' && !emailAuthReady/.test(worker),
      'et l’ouverture publique ne peut plus contourner les comptes');
  });

  test('se déconnecter marche même sans JavaScript', () => {
    /* Le lien est une ancre : si le script qui intercepte le clic n'a pas pris,
       elle part en GET. La route ne repondait qu'au POST, donc le bouton de
       sortie affichait « route inconnue » et laissait la session ouverte. */
    const worker = lireSource('_worker.js');
    vrai(/path === '\/api\/logout' && \(request\.method === 'POST' \|\| request\.method === 'GET'\)/
      .test(worker), 'la déconnexion répond aussi à une simple navigation');
    vrai(/wd_session=; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=0/.test(worker),
      'et elle efface aussi le cookie de l’ancienne porte');
  });

  test('une adresse revenue sous un nouvel identifiant retrouve son patrimoine', () => {
    /* `ON CONFLICT(id)` ne couvre pas l'index unique de l'adresse : un compte
       supprime puis recree chez le fournisseur faisait lever l'instruction,
       annulait le lot, et la personne ne pouvait plus entrer. */
    const worker = lireSource('_worker.js');
    const schema = lireSource('schema.sql');
    vrai(/UPDATE users SET id = \?1, updated_at = unixepoch\(\) WHERE email = \?2 AND id <> \?1/
      .test(worker), 'la ligne existante est réaffectée avant l’insertion');
    /* Les deux lignes de table, pas un compte d’occurrences : le commentaire
       qui explique la cascade en portait une troisième. */
    vrai(/user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE ON UPDATE CASCADE/
      .test(schema), 'les sessions suivent le nouvel identifiant');
    vrai(/owner_id TEXT PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE ON UPDATE CASCADE/
      .test(schema), 'le patrimoine aussi');
  });

  test('ce qui n’est pas le site ne part pas en ligne', () => {
    /* `wrangler.json` sert la racine du depot : sans liste d'exclusion, le mode
       d'emploi de l'authentification et le schema de la base s'obtiennent a
       l'adresse qui porte leur nom. La porte les protege, mais l'inscription
       est libre : tout inscrit les lit. */
    const ignore = lireSource('.assetsignore');
    vrai(ignore, '.assetsignore doit être lisible pour ce contrôle');
    for (const motif of ['*.md', '*.py', '*.sql', 'wrangler.json', 'tests/']) {
      vrai(ignore.includes(motif), `${motif} ne doit pas être servi`);
    }
  });

  test('deux actions ne portent jamais le même nom', () => {
    /* UNE CLEF EN DOUBLE NE SE SIGNALE PAS, ET LA DERNIERE GAGNE. Un ecran du
       compte a pose `supprimer-compte` sans voir que le nom etait pris : dans
       cette application un compte est un compte BANCAIRE, et l'action existante
       en supprime un. Le bouton d'effacement du compte et des donnees appelait
       donc la suppression d'une ligne d'actifs, sans qu'aucune erreur ne le
       dise. C'est le meme defaut que deux clefs identiques dans le
       dictionnaire, et il merite le meme garde-fou.

       Le motif vise les methodes posees a deux espaces d'indentation : c'est la
       forme des entrees d'`ACTIONS`. */
    const src = lireSource('assets/app.js');
    /* La tranche s'arrête à la première accolade fermante en colonne zéro :
       hors d'`ACTIONS`, deux objets peuvent légitimement porter la même clef. */
    const debut = src.indexOf('const ACTIONS = {');
    vrai(debut >= 0, 'ACTIONS doit être trouvable');
    /* ACTIONS vit en plusieurs fichiers : le litteral, puis un Object.assign
       par domaine. Un nom repete d'un fichier a l'autre gagnerait en silence,
       comme dans un seul litteral : tous les segments se lisent ensemble. */
    const table = [src.slice(debut, src.indexOf('\n};', debut)),
      ...[...src.matchAll(/^Object\.assign\(ACTIONS, \{\n([\s\S]*?)^\}\);$/gm)].map(m => m[1])].join('\n');
    const vus = new Map();
    const doubles = [];
    /* Les deux formes coexistent : la méthode abrégée `'nom'() {` et la
       propriété `'nom': makeDeleter(...)`. N'en chercher qu'une laissait
       passer la moitié des actions. */
    for (const m of table.matchAll(/^ {2}(?:async )?'([a-z0-9-]+)'\s*[:(]/gm)) {
      if (vus.has(m[1])) doubles.push(m[1]);
      else vus.set(m[1], true);
    }
    vrai(vus.size > 40, `${vus.size} actions relevées : le motif ne les voit plus`);
    eq(doubles.length, 0, 'noms déclarés deux fois : ' + doubles.join(', '));

    /* Et tout bouton doit désigner une action qui existe : un nom mal recopié
       donne un bouton muet, ce qui ne se voit qu'en cliquant. */
    const manquantes = [];
    for (const m of src.matchAll(/data-action="([a-z0-9-]+)"/g)) {
      if (!vus.has(m[1])) manquantes.push(m[1]);
    }
    eq(manquantes.length, 0, 'boutons sans action : ' + [...new Set(manquantes)].join(', '));
  });

  test('la connexion parle la langue de l’application', () => {
    /* `currentLang()` rend 'en' en dur quand rien n'est stocké : l'application
       est anglaise par défaut, par décision et non par détection. Les pages du
       worker étaient les seules chaînes françaises codées en dur du projet, et
       le parcours basculait de langue au milieu — connexion française, courriel
       français, puis application anglaise.

       Ces pages ne peuvent pas appeler `trad()` : le worker les construit sans
       le dictionnaire. Une seule langue est donc possible, et c'est celle de
       l'application. Le contrôle porte sur cet accord, pas sur l'anglais. */
    const i18n = lireSource('assets/i18n.js');
    vrai(/navigator\.languages/.test(i18n),
      'le navigateur annonce une liste ordonnée, et c’est elle qu’on lit');
    vrai(/localStorage\.getItem\(LANG_KEY\) \|\| langueDuNavigateur\(\)/.test(i18n),
      'le choix enregistré prime toujours sur la détection');

    const worker = lireSource('_worker.js');
    /* Le serveur fait le meme calcul que le navigateur, sur `Accept-Language`.
       Cet en-tete est une liste PONDEREE : « en-US,en;q=0.9,fr;q=0.8 » annonce
       un anglophone qui comprend le francais. Chercher « fr » dedans le
       prendrait pour un francophone, d'ou la lecture des poids. */
    vrai(/function langueDemandee\(request, url\)/.test(worker),
      'le worker déduit la langue de l’en-tête du navigateur, à défaut de choix explicite');
    vrai(/q=\(\[\\d\.\]\+\)/.test(worker) || /q=\(\[\\d.\]\+\)/.test(worker),
      'et il lit les pondérations plutôt que de chercher un code au hasard');

    /* Les deux tables portent les memes clefs : une clef presente d'un seul
       cote rendrait `undefined` dans la page, sans erreur et sans que rien ne
       le dise. */
    const table = worker.slice(worker.indexOf('const AUTH_TEXTES = {'),
                               worker.indexOf('function langueDemandee'));
    const clefsDe = code => {
      const debut = table.indexOf(`  ${code}: {`);
      const bloc = table.slice(debut, table.indexOf('\n  },', debut));
      return [...bloc.matchAll(/^\s{4}(\w+):/gm)].map(m => m[1]).sort();
    };
    const en = clefsDe('en');
    const fr = clefsDe('fr');
    vrai(en.length > 15, `${en.length} clefs relevées : le motif ne les voit plus`);
    eq(fr.join(','), en.join(','), 'les deux langues doivent porter les mêmes clefs');

    /* Et aucune page ne reçoit une chaîne écrite à la main : elle échapperait
       à la traduction sans que personne s'en aperçoive. C'est arrivé deux fois
       au même message, resté français dans une page anglaise. */
    for (const m of worker.matchAll(/page(?:Connexion|Code)\(([^)]*)\)/g)) {
      vrai(!/'[A-Za-zÀ-ÿ]/.test(m[1]),
        `« ${m[1]} » : un message doit passer par la table, pas par une chaîne`);
    }
  });

  test('le témoin d’enregistrement ne promet que ce qui est fait', () => {
    /* Il annonçait « Sauvegardé localement » en toutes circonstances, ce qui
       était vrai tant que rien ne partait ailleurs. Depuis que les comptes
       rangent le patrimoine en base, la phrase est fausse la moitié du temps,
       et fausse dans le mauvais sens : elle laisse croire qu'un changement
       n'a pas quitté l'appareil. L'inverse serait pire — annoncer le cloud
       avant l'aboutissement ferait fermer l'onglet trop tôt. */
    const app = lireSource('assets/app.js');
    vrai(/function libelleEnregistrement\(\)/.test(app),
      'le libellé se dérive de l’état de synchronisation');
    const fn = app.slice(app.indexOf('function libelleEnregistrement()'),
                         app.indexOf('function majTemoinEnregistrement()'));
    vrai(/s\.pushing/.test(fn), 'un envoi en cours se dit en cours');
    vrai(/s\.error \|\| s\.conflict/.test(fn),
      'un envoi échoué retombe sur le local, qui est alors la vérité');
    /* LA QUESTION EST CE QUI RESTE A ENVOYER, PAS CE QUI A DEJA ETE ENVOYE.
       `lastPush` ne vaut que pour la page en cours : arriver sur une
       application deja synchronisee ne declenche aucun envoi, et un temoin
       qui le lirait annoncerait localement alors que tout est en ligne. */
    /* Les commentaires partent avant le contrôle : celui qui explique cette
       erreur-là cite justement `lastPush`, et le motif tombait dessus. Un test
       qui lit de la prose finit par accuser une explication. */
    const code = fn.replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/lastPush/.test(code),
      'le libellé ne se fie pas à un envoi fait pendant cette page');
    vrai(/CloudSync\.aJour\(\)/.test(fn),
      'il compare le repère de synchronisation à l’état en mémoire');
    const sync = lireSource('assets/cloudsync.js');
    vrai(/const aJour = \(\) => \{/.test(sync) && /lastSyncedAt\(\) === local/.test(sync),
      'et ce repère survit au rechargement, contrairement à un compteur de page');
    vrai(/modeDemo\(\) \|\| !CloudSync\.isAvailable\(\)/.test(fn),
      'sans cloud, ou en démonstration, rien ne prétend au cloud');

    /* Le repos apres le flash ne doit pas retomber sur la chaine figee. */
    const flash = app.slice(app.indexOf('function flashSaved()'),
                            app.indexOf('function flashSaved()') + 500);
    vrai(/textContent = libelleEnregistrement\(\)/.test(flash),
      'et le témoin retombe sur l’état réel après le flash');
    vrai(/majTemoinEnregistrement\(\);\n    if \(currentView\(\) === 'data'\)/.test(app),
      'chaque fin d’envoi rafraîchit le témoin');

    const i18n = lireSource('assets/i18n.js');
    for (const clef of ['Envoi au cloud…', 'Sauvegardé dans le cloud']) {
      vrai(i18n.includes(`'${clef}'`), `« ${clef} » doit porter sa traduction`);
    }
  });

  test('la politique de confidentialité se lit avant de donner son adresse', () => {
    /* Cloudflare Pages redirige `/confidentialite.html` vers `/confidentialite`
       par un 308, avant le worker. Seule la première écriture était déclarée
       publique : la redirection tombait sur le garde-fou et la page renvoyait
       l'écran de connexion. Mesuré en ligne, pas déduit — le formulaire
       d'inscription y renvoie, et l'information doit précéder la collecte. */
    const worker = lireSource('_worker.js');
    const publics = worker.slice(worker.indexOf('const PUBLIC = ['),
                                 worker.indexOf('];', worker.indexOf('const PUBLIC = [')));
    /* Les deux langues et les deux écritures de chacune : Pages redirige la
       forme `.html` vers la forme nue, et la redirection doit atterrir sur une
       adresse publique elle aussi. */
    for (const chemin of ["'/confidentialite.html'", "'/confidentialite'",
                          "'/privacy.html'", "'/privacy'"]) {
      vrai(publics.includes(chemin), `${chemin} doit être lisible sans session`);
    }
    /* Le motif tient l'adresse, pas le libellé : une première version citait
       « politique », et la traduction de la page l'a fait tomber sur un lien
       pourtant juste. Ce qui compte ici est le chemin.

       Il pointe l'anglais, comme tout ce que le worker construit ; le français
       est à un clic depuis la page. */
    vrai(/href="\$\{T\.confidentialite\}"/.test(worker),
      'le formulaire pointe l’adresse canonique, sans saut de redirection');
    /* Une adresse par langue, et les deux sont publiques : un francophone ne
       doit pas atterrir sur la version anglaise pour lire ses droits. */
    vrai(/confidentialite: '\/privacy'/.test(worker)
      && /confidentialite: '\/confidentialite'/.test(worker),
      'chaque langue renvoie vers sa propre version');
    const index = lireSource('index.html');
    vrai(/href="\/privacy" data-i18n="account.privacy"/.test(index),
      'et le lien de la barre latérale aussi');

    /* Chaque version renvoie vers l'autre : une page qui ne dit pas que sa
       jumelle existe est une impasse pour qui ne lit pas cette langue. */
    const fr = lireSource('confidentialite.html');
    const en = lireSource('privacy.html');
    vrai(/href="\/privacy">English<\/a>/.test(fr), 'la version française mène à l’anglaise');
    vrai(/href="\/confidentialite">Français<\/a>/.test(en), 'et réciproquement');
    vrai(/<html lang="fr"/.test(fr) && /<html lang="en"/.test(en),
      'chacune déclare sa langue');
    /* Les deux textes doivent nommer les mêmes destinataires : une version qui
       en oublie un dit autre chose que l'autre, et c'est un document
       juridique. */
    for (const tiers of ['Cloudflare', 'Supabase', 'Resend', 'CNIL']) {
      vrai(fr.includes(tiers) && en.includes(tiers),
        `« ${tiers} » doit être nommé dans les deux versions`);
    }
  });

  test('la session glisse, sous un plafond qui ne glisse pas', () => {
    /* Une duree fixe est le pire des deux mondes : a trente jours, qui ouvre
       l'application tous les jours se fait redemander un code au trentieme, et
       l'ordinateur oublie dans un train garde l'acces trente jours. L'un est
       gene sans raison, l'autre protege trop tard. */
    const worker = lireSource('_worker.js');
    vrai(/const SESSION_GLISSE = 14;/.test(worker), 'la fenêtre glissante fait deux semaines');
    vrai(/const SESSION_PLAFOND = 90;/.test(worker), 'le plafond absolu fait trois mois');

    const fn = worker.slice(worker.indexOf('async function sessionIdentity'),
                            worker.indexOf('async function supabaseAuth'));
    /* Le plafond part de la CREATION : lu sur `expires_at`, il glisserait avec
       la fenêtre et ne plafonnerait plus rien. */
    vrai(/s\.created_at \+ \? > unixepoch\(\)/.test(fn),
      'le plafond se compte depuis la création, jamais depuis la dernière visite');
    vrai(/UPDATE sessions SET expires_at/.test(fn), 'chaque visite repousse la fenêtre');
    vrai(/Math\.min\(maintenant \+ SESSION_GLISSE \* 86400,/.test(fn),
      'et la prolongation ne dépasse jamais le plafond');
    /* L'ecriture coute : elle ne doit pas partir a chaque requete. */
    vrai(/vise > row\.expires_at \+ 86400/.test(fn),
      'la base n’est réécrite qu’une fois par jour et par session');

    /* Le cookie porte le PLAFOND, pas la fenêtre : le renvoyer a chaque
       prolongation demanderait de toucher toutes les réponses. Il ne donne
       aucun droit, c'est la base qui tranche. */
    vrai(/lw_session=\$\{session\}[^`]*Max-Age=\$\{SESSION_PLAFOND \* 86400\}/.test(worker),
      'le cookie vit aussi longtemps que le plafond, et pas plus');
  });

  test('effacer un compte se revérifie, le reste non', () => {
    /* Une session ouverte suffit pour tout lire, et c'est le prix assumé de ne
       pas redemander un code a chaque visite. Mais lire se répare, effacer non :
       la seule action irréversible redemande la preuve de la boîte e-mail. */
    const worker = lireSource('_worker.js');
    vrai(/path === '\/api\/account\/delete-code' && request\.method === 'POST'/.test(worker),
      'un code se demande avant d’effacer');
    const bloc = worker.slice(worker.indexOf("path === '/api/account/delete'"),
                              worker.indexOf("path === '/api/health'"));
    vrai(/\/auth\/v1\/verify/.test(bloc), 'le code se vérifie chez le fournisseur');
    /* Et son résultat doit désigner LA MEME personne : un code valide pour une
       autre adresse ne peut pas ouvrir cette suppression-ci. */
    vrai(/verifie\.data\?\.user\?\.id !== appIdentity\.id/.test(bloc),
      'le code vérifié doit désigner le compte qu’on efface');
    vrai(/code:mail:\$\{appIdentity\.email\}/.test(bloc),
      'les essais sont comptés, comme à la connexion');
    /* La demande de code passe par les mêmes freins : une porte de suppression
       sans limite serait un moyen commode de faire partir du courrier. */
    const envoi = worker.slice(worker.indexOf("path === '/api/account/delete-code'"),
                               worker.indexOf("path === '/api/account/delete'"));
    vrai(/otp:ip:/.test(envoi) && /otp:mail:/.test(envoi),
      'et la demande de code est freinée par IP et par adresse');
  });

  test('le diagnostic rend l’adresse du compte, pas seulement celle du portail', () => {
    /* `/api/health` est la seule source d'identite du navigateur : l'ecran du
       profil affiche ce qu'elle renvoie. La ligne ne lisait que l'adresse
       fournie par un portail d'entreprise, qui n'existe pas quand on se
       connecte par code — le serveur rendait donc un identifiant SANS adresse,
       et le profil s'affichait vide sur une session pourtant valide.

       Vu a l'ecran, puis confirme en interrogeant la route : `userId` etait
       renseigne et `user` nul. La base, elle, portait bien l'adresse. */
    const worker = lireSource('_worker.js');
    const sante = worker.slice(worker.indexOf("if (path === '/api/health')"),
                               worker.indexOf("if (path === '/api/quotes')"));
    vrai(/user: appIdentity\?\.email \|\| email \|\| null/.test(sante),
      'l’adresse du compte passe devant celle du portail');
    vrai(/userId: appIdentity\?\.id \|\| null/.test(sante),
      'et l’identifiant stable l’accompagne');
    /* Les deux doivent venir de la meme source : un identifiant sans adresse,
       ou l'inverse, laisse l'interface incapable de dire qui est connecte. */
    vrai(sante.indexOf('appIdentity?.id') > 0 && sante.indexOf('appIdentity?.email') > 0,
      'les deux se lisent sur la session vérifiée');
  });

  test('sans identité sur un site à comptes, aucun patrimoine ne s’ouvre', () => {
    const sync = lireSource('assets/cloudsync.js');
    vrai(/comptesActifs: \(\) => comptes/.test(sync),
      'le client sait si ce site tient des comptes');
    vrai(/localStorage\.setItem\(COMPTES_KEY/.test(sync),
      'et il s’en souvient, sinon une panne réseau le lui fait oublier');

    const app = lireSource('assets/app.js');
    const init = app.slice(app.indexOf('(async function init()'), app.indexOf("if (location.protocol === 'file:')"));
    vrai(/CloudSync\.comptesActifs\(\)/.test(init) && /ecranIdentiteManquante\(\)/.test(init),
      'une identité manquante affiche un écran plutôt que d’ouvrir la clef partagée');
    vrai(init.indexOf('ecranIdentiteManquante();') < init.indexOf('Store.load();'),
      'et ce refus tombe avant toute lecture locale');
  });

  test('le mode et le masque suivent le compte, le thème reste au navigateur', () => {
    const store = lireSource('assets/store.js');
    vrai(/const cleMode = \(\) => cleParUtilisateur\(MODE_KEY\)/.test(store),
      'le mode démonstration ne se lègue pas au compte suivant');
    vrai(/const cleMasque = \(\) => cleParUtilisateur\(MASK_KEY\)/.test(store),
      'le mode discret non plus');
    vrai(/function relireMasque\(\)/.test(store),
      'le masque se relit une fois la portée connue, sa première lecture étant trop tôt');
  });
});

suite('Chaque écran dit son nom', () => {
  test('toute entrée de menu porte son titre et son sous-titre, dans les deux langues', () => {
    /* L'en-tete compose ses clefs : `view.<vue>` et `view.<vue>.sub`. Une vue
       ajoutee sans elles n'echoue pas — `t()` rend la clef quand elle manque,
       donc l'ecran affiche « view.profil » en gros titre. C'est arrive, et
       seule une capture d'ecran l'a dit.

       La liste se DERIVE du menu plutot que de se recopier : une entree
       ajoutee demain entre dans ce controle sans qu'on y pense. */
    const html = lireSource('index.html');
    const vues = [...new Set([...html.matchAll(/data-view="([\w-]+)"/g)].map(m => m[1]))];
    vrai(vues.length >= 7, `${vues.length} vues relevées : le motif ne les voit plus`);

    for (const langue of ['fr', 'en']) {
      enLangue(langue, () => {
        for (const vue of vues) {
          for (const clef of [`view.${vue}`, `view.${vue}.sub`]) {
            vrai(t(clef) !== clef, `« ${clef} » manque en ${langue}`);
          }
        }
      });
    }
  });
});

/* ------------------------------------------------------------------
   2. Le cash « à investir » est rangé d'un seul côté
   ------------------------------------------------------------------ */
suite('Le cash à investir est rangé d’un seul côté', () => {

  test('accueil et Allocation comptent les mêmes liquidités', () => {
    /* `poches().classes.liquidites` et `nowByGroup().cash` doivent ranger le
       cash pose chez un courtier au meme endroit. Sinon deux ecrans, le mot
       « Liquidites », un ecart de ce cash, et deux totaux justes : rien pour
       le signaler. */
    Fixture.poser();
    pres(nowByGroup().cash, poches().classes.liquidites,
      'la poche « Liquidités » doit valoir la même chose des deux côtés');
  });

  test('accueil et Allocation comptent les mêmes actifs de marché', () => {
    Fixture.poser();
    const p = poches();
    pres(nowByGroup().bourse, p.classes.actions + p.classes.obligations,
      'la poche « Actifs de marché » doit valoir la même chose des deux côtés');
  });

  test('il est compté une fois et une seule', () => {
    Fixture.poser();
    pres(nowTotals().toInvest, 1500, 'le fixture pose 1 500 € en attente');
    pres(nowTotals().cash - nowTotals().toInvest, 5000, 'reste le cash de vie');
    pres(nowTotals().invested, Fixture.BRUT - 6500,
      '« Investi » exclut toutes les liquidités, une seule fois');
  });

  test('le cash raconte la même histoire partout', () => {
    /* Trois ecrans affichent les liquidites, et ils doivent concorder. Une
       carte qui agregerait courant + precaution + projet sous « Argent
       disponible » (3 300 EUR) porterait un montant que l'accueil ne connait
       pas, sous presque le nom d'une de ses propres parts, « Cash disponible »
       (3 250 EUR) : cinquante euros d'ecart, invisibles tant que la precaution
       reste petite.

       La regle desormais : « Liquidites » nomme le tout, les quatre
       affectations le composent, aucun agregat intermediaire n'existe. Ce test
       verrouille les deux egalites qui le garantissent. */
    Fixture.poser();
    /* `poches` est deja une fonction globale : la liste s'appelle autrement,
       sinon elle l'occulte et l'assertion suivante leve. */
    const liste = pochesLiquidites();
    pres(liste.reduce((s, p) => s + p.value, 0), nowByGroup().cash,
      'les quatre poches font les liquidités, sans reste');
    pres(nowByGroup().cash, poches().classes.liquidites,
      'et les liquidités valent la même chose des deux côtés');
    /* Chaque poche porte le nom d'AFFECTATIONS, source unique : un nom change
       la et il change sur les trois ecrans. */
    eq(liste.map(p => p.nom).join(' · '),
      AFFECTATIONS.map(([, nom]) => nom).join(' · '),
      'les noms viennent d’AFFECTATIONS, pas d’une liste parallèle');
    /* Et le cash a investir est la meme grandeur des deux sources qui le
       calculent : nowTotals et stockTotals. */
    pres(nowTotals().toInvest, stockTotals().cashToInvest,
      'le cash à investir vaut la même chose depuis ses deux sources');
  });

  test('l’épargne de précaution ignore le cash posé chez un courtier', () => {
    /* Un autre axe : la disponibilité. Ce cash est bien liquide, mais il n'est
       pas mobilisable dans la seconde, et il est déjà destiné. Le compter en
       réserve d'urgence gonflerait l'autonomie à tort. */
    Fixture.poser();
    pres(runway().immediate, 5000,
      'seuls le compte courant et le livret comptent comme disponibles tout de suite');
  });
});

/* ------------------------------------------------------------------
   3. Les relevés mensuels couvrent toutes les poches
   ------------------------------------------------------------------ */
suite('Un relevé mensuel couvre toutes les poches', () => {

  test('le total d’une ligne additionne les cinq poches', () => {
    /* Le bug d'origine : la colonne « Total » n'additionnait que cash, bourse
       et non coté. La crypto et l'immobilier disparaissaient — 120 000 € de
       studio absents d'un total nommé « total ». */
    const s = Fixture.poser();
    pres(rowTotal(s.monthly[0]), Fixture.BRUT,
      'rowTotal() doit couvrir cash, bourse, crypto, non coté et immobilier');
  });

  test('chaque compte tombe dans une poche connue', () => {
    const s = Fixture.poser();
    const g = rowGroups(s.monthly[0]);
    pres(g.cash + g.bourse + g.crypto + g.pe + g.immo, Fixture.BRUT,
      'aucun montant ne doit se perdre entre les poches');
    pres(g.immo, 120000, 'l’immobilier a sa propre bande');
    pres(g.pe, 2000, 'le crowdfunding reste en non coté');
  });
});

/* ------------------------------------------------------------------
   4. Le classement d'une ligne de marché
   ------------------------------------------------------------------ */
suite('Classement d’une ligne de marché', () => {

  test('une classe découpée laisse place à ses deux rôles, à plat', () => {
    /* « 90 % d'actions » ne disait pas si le prochain versement va au fonds
       mondial ou a une conviction, et viser un core a 70 % obligeait a regler
       les actions a 90 % en esperant tomber juste. Une classe detenue dans les
       deux roles peut donc porter deux cibles.

       A plat : « Actions core » et « Actions satellite » remplacent « Actions »
       dans la liste, sans ligne parente. Un seul axe de cibles, plus fin — pas
       deux series croisees, qui se contrediraient en silence.

       Le libelle porte la classe et pas seulement le role : « Core » seul
       promettrait tout le core du portefeuille alors que la ligne ne compte que
       les actions, et un metal precieux passe en core n'y figurerait jamais.

       Ce que le test verrouille : les deux lignes remplacent la classe sans en
       perdre un euro, leurs cibles font celle d'avant, et ni la base ni le total
       des cibles ne bougent. */
    const action = (id, role, qty) => ({
      id, name: role === 'core' ? 'ETF Monde' : 'Une conviction', isin: '',
      symbol: role === 'core' ? 'IWDA' : 'CONV', currency: 'EUR',
      qty, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_pea',
      manual: false, assetClass: 'actions', role,
    });
    const poser = cible => Fixture.poser(e => {
      e.positions = [action('a1', 'core', 70), action('a2', 'satellite', 30)];
      e.targets.classes = { actions: cible };
    });

    poser(90);
    const avant = rebalanceRows();
    const actions = avant.classes.find(c => c.cle === 'classes.actions');
    pres(actions.value, 10000, 'la classe entière vaut ses deux rôles');
    pres(actions.targetPct, 90, 'et porte la cible saisie');

    /* Decoupage au prorata, tel que l'action le calcule : 30 % de satellite sur
       10 000 EUR font 27 %, et le reste, 63, va au core. L'arrondi tombait sur
       le palier de 5 le plus proche — 25 et 65 — tant que la liste deroulante
       n'en proposait pas d'autres ; elle va de 1 en 1 depuis. */
    poser({ core: 63, satellite: 27 });
    const apres = rebalanceRows();
    vrai(!apres.classes.some(c => c.cle === 'classes.actions'),
      'la ligne de classe a disparu de la liste');
    const roles = apres.classes.filter(c => c.classeParente === 'actions');
    eq(roles.length, 2, 'remplacée par ses deux rôles');
    vrai(roles.every(l => !l.sousLignes), 'à plat, sans sous-lignes');
    eq(roles.map(l => l.label).join(' · '),
      `${ASSET_CLASSES.actions} ${ROLES.core.toLowerCase()} · ${ASSET_CLASSES.actions} ${ROLES.satellite.toLowerCase()}`,
      'le libellé porte la classe ET le rôle, sans liste parallèle');
    vrai(roles.every(l => l.label !== ROLES.core && l.label !== ROLES.satellite),
      'jamais « Core » seul : la ligne ne compte pas tout le core du portefeuille');
    pres(roles.reduce((s, l) => s + l.value, 0), actions.value,
      'les deux rôles font l’encours de la classe, sans reste');
    pres(roles.reduce((s, l) => s + l.targetPct, 0), 90,
      'et leurs cibles font celle d’avant le découpage');
    pres(apres.base, avant.base, 'le découpage ne déplace pas la base');
    pres(apres.invested.targetPct, avant.invested.targetPct,
      'ni le total des cibles : num({core:65}) valait zéro avant le correctif');

    const core = roles.find(l => l.role === 'core');
    pres(core.value, 7000, 'le core vaut ses 70 parts');
    pres(core.targetPct, 63, 'et sa propre cible');
    eq(core.cle, 'classes.actions.core', 'sa cible se saisit à trois niveaux de chemin');
  });

  test('la jauge d’une cible ouvre exactement les placements qu’elle compte', () => {
    /* « Actions core, +1 200 EUR a renforcer » ne disait pas laquelle renforcer.
       La barre s'ouvre donc sur ses placements. Ce que ce test verrouille est la
       regle cardinale du projet, appliquee a une fiche de plus : le total de la
       fiche egale la somme de ses lignes, et il egale le montant de la ligne
       affichee sur la page. Deux calculs du meme nombre finissent par diverger,
       et c'est arrive ici trois fois deja, sur trois ecrans differents. */
    const action = (id, role, qty) => ({
      id, name: `${role} ${qty}`, isin: '', symbol: id, currency: 'EUR',
      qty, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_pea',
      manual: false, assetClass: 'actions', role,
    });
    Fixture.poser(e => {
      e.positions = [action('a1', 'core', 70), action('a2', 'satellite', 20),
                     action('a3', 'core', 10)];
      e.targets.classes = { actions: { core: 60, satellite: 30 } };
    });

    const pr = stockTotals().parClasseRole.actions;
    const core = positionsDeCible('classes.actions.core');
    const sat  = positionsDeCible('classes.actions.satellite');
    const tout = positionsDeCible('classes.actions');

    /* Le total de chaque fiche est la somme de ses lignes. */
    for (const [nom, d] of [['core', core], ['satellite', sat], ['la classe', tout]])
      pres(d.total, d.lignes.reduce((s, l) => s + l.valeur, 0),
        `le total de la fiche ${nom} égale la somme de ses lignes`);

    /* Et il egale le montant de la ligne de la page : c'est ce que promet la
       barre sur laquelle on vient de cliquer. */
    pres(core.total, pr.core, 'la fiche core vaut ce que la page affiche en core');
    pres(sat.total, pr.satellite, 'la fiche satellite vaut la ligne satellite');
    pres(tout.total, pr.core + pr.satellite, 'la fiche de classe vaut les deux');
    pres(core.total + sat.total, tout.total,
      'les deux rôles font la classe : aucune position perdue ni comptée deux fois');

    /* Aucune position ne doit manquer ni figurer deux fois : le decoupage par
       role partage l'ensemble, il ne le filtre pas. */
    eq([...core.lignes, ...sat.lignes].map(l => l.i).sort().join(','),
       tout.lignes.map(l => l.i).sort().join(','),
       'les lignes des deux rôles sont exactement celles de la classe');
    eq(new Set(tout.lignes.map(l => l.i)).size, tout.lignes.length,
       'et aucune n’y figure deux fois');

    /* L'index doit pointer la position nommee : c'est lui qui ouvre la fiche, et
       un index decale ouvrirait tranquillement la fiche du voisin. */
    for (const l of tout.lignes)
      eq(Store.state.positions[l.i]?.name, l.nom,
        `l’index de « ${l.nom} » ouvre bien sa fiche`);

    /* Une classe entiere melange les deux roles : la fiche le dit ligne par
       ligne, sinon on ne saurait pas si la classe vaut d'etre decoupee. */
    eq(new Set(tout.lignes.map(l => l.role)).size, 2,
      'la fiche de classe porte le rôle de chaque ligne');

    /* Ce qui n'est pas fait de positions ne rend pas de fiche : la tresorerie a
       la sienne, poche par poche, et une cle inventee ne doit rien ouvrir. */
    for (const cle of [CLE_TRESORERIE, 'classes.inconnue', 'classes.actions.milieu', '', null])
      eq(positionsDeCible(cle), null, `« ${cle} » n’ouvre pas de fiche de placements`);
  });

  test('« Satellite » ne compte pas la même chose selon la barre qu’on ouvre', () => {
    /* Deux barres de la page Objectifs portent le mot « Satellite », et elles ne
       comptent pas le meme argent : la carte des roles compte tous les
       satellites, la ligne de cible ne compte que ceux d'une classe. L'ecart,
       c'est l'or, la crypto, tout ce qui n'est pas une action.

       C'est exactement le defaut que ce projet a corrige trois fois — un meme
       libelle pour deux montants — sauf qu'ici les deux sont voulus. Ce qui le
       rend supportable est que chaque fiche dise ce qu'elle compte, et c'est ce
       que ce test verrouille : la fiche de role nomme la classe de chaque ligne,
       et la somme des fiches de classe fait la fiche de role. */
    const pos = (id, classe, role, qty) => ({
      id, name: `${classe} ${role}`, isin: '', symbol: id, currency: 'EUR',
      qty, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_pea',
      manual: false, assetClass: classe, role,
    });
    Fixture.poser(e => {
      e.positions = [pos('a1', 'actions', 'core', 70), pos('a2', 'actions', 'satellite', 20),
                     pos('m1', 'metaux', 'satellite', 10)];
    });

    const roleSat = positionsDeRole('satellite');
    const cibleSat = positionsDeCible('classes.actions.satellite');

    pres(roleSat.total, 3000, 'le rôle compte les actions ET les métaux satellites');
    pres(cibleSat.total, 2000, 'la ligne de cible ne compte que les actions');
    vrai(roleSat.total !== cibleSat.total,
      'les deux « Satellite » de la page sont bien deux ensembles');

    /* La carte des roles affiche ce meme montant : la fiche ne doit pas dire
       autre chose que la barre sur laquelle on a clique. */
    const barre = rebalanceRoles().roles.find(r => r.cle === 'satellite');
    pres(roleSat.total, barre.value, 'la fiche vaut ce que la barre affiche');
    pres(roleSat.total, roleSat.lignes.reduce((s, l) => s + l.valeur, 0),
      'et ce total est la somme de ses lignes');

    /* Une fiche de role melange les classes : elle doit les nommer, sinon deux
       lignes de meme montant seraient indiscernables. */
    eq(new Set(roleSat.lignes.map(l => l.classe)).size, 2,
      'la fiche de rôle porte la classe de chaque ligne');
    eq(roleSat.label, ROLES.satellite,
      '« Satellite » tout court est juste ici : la barre compte bien tout le satellite');

    /* Les classes decoupent le role sans reste : c'est ce qui permet de passer
       d'une barre a l'autre sans perdre un euro. */
    const parClasse = Object.keys(ASSET_CLASSES)
      .map(c => positionsDeCible(`classes.${c}.satellite`).total)
      .reduce((s, v) => s + v, 0);
    pres(parClasse, roleSat.total,
      'la somme des satellites de chaque classe fait le satellite entier');

    /* Le core suit la meme regle, et la tresorerie n'a pas de role. */
    pres(positionsDeRole('core').total, 7000, 'le core se compte de la même façon');
    pres(positionsDeRole('core').total + roleSat.total,
      Store.state.positions.reduce((s, p) => s + posValue(p), 0),
      'les deux rôles couvrent toutes les positions, sans reste ni doublon');
    for (const cle of [CLE_TRESORERIE, 'classes.actions', 'milieu', '', null])
      eq(positionsDeRole(cle), null, `« ${cle} » n’est pas un rôle`);
  });

  test('toute classe d’actif ouvre sa fiche, sans exception à écrire', () => {
    /* Le meme piege que partout : une table de correspondance ecrite a la main
       aurait sorti en silence toute classe ajoutee a ASSET_CLASSES et pas
       recopiee. Le balayage vaut donc pour les classes futures. */
    Fixture.poser();
    const parClasse = stockTotals().parClasse;
    for (const cle of Object.keys(ASSET_CLASSES)) {
      const d = positionsDeCible(`classes.${cle}`);
      vrai(d, `${cle} doit rendre une fiche`);
      pres(d.total, parClasse[cle],
        `la fiche de ${cle} vaut son encours, pas un calcul parallèle`);
      pres(d.total, d.lignes.reduce((s, l) => s + l.valeur, 0),
        `et ce total est la somme de ses lignes`);
      eq(d.label, ASSET_CLASSES[cle], `et elle s’intitule comme la classe`);
      for (const role of ['core', 'satellite']) {
        const r = positionsDeCible(`classes.${cle}.${role}`);
        vrai(r.label.startsWith(ASSET_CLASSES[cle]),
          `« ${r.label} » doit nommer sa classe, pas seulement son rôle`);
      }
    }
  });

  test('une cible se règle de 1 en 1 : 92 % doit être proposé', () => {
    /* Le pas etait de 5, au motif que personne ne vise 63 % d'actions. C'etait
       faux : une cible se deduit souvent des autres. Qui pose 3 % d'or et 5 % de
       crypto a 92 % a repartir, et le pas de 5 lui refusait de l'ecrire — le
       total devait tomber juste a 100 avec un outil qui comptait de cinq en cinq.

       `paliersCible()` vit dans app.js, que le harnais ne charge pas. Elle ne
       depend que de `num`, donc on la reconstruit depuis la source et on
       l'execute pour de vrai, plutot que de chercher « v += 1 » dans du texte. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const m = src.match(/function paliersCible\(courant\) \{[\s\S]*?\n\}/);
    vrai(m, 'paliersCible() doit être trouvable dans la source');
    const paliersCible = new Function('num', `${m[0]}; return paliersCible;`)(num);

    const p = paliersCible(0);
    eq(p.length, 101, 'de 0 à 100 inclus, un palier par point');
    for (const v of [1, 3, 7, 47, 92, 99])
      vrai(p.includes(v), `${v} % doit pouvoir se choisir`);
    eq(p[0], 0, 'zéro est une décision, il reste dans la liste');
    eq(p[p.length - 1], 100, 'et cent aussi');

    /* Une valeur non entiere deja enregistree ne doit pas etre ecrasee par le
       premier rendu : la liste l'accueille telle quelle, a sa place. */
    const q = paliersCible(62.5);
    vrai(q.includes(62.5), 'une cible à 62,5 % survit à l’affichage');
    eq(q.indexOf(62.5), q.indexOf(62) + 1, 'et se range entre 62 et 63');
    eq(paliersCible(140).filter(v => v > 100).length, 0,
      'une valeur hors bornes ne crée pas de palier au-delà de 100');

    /* Et le decoupage d'une classe suit le meme pas : il arrondissait au palier
       de 5 tant que la liste n'en offrait pas d'autres. Une classe a 90 %
       detenue 70/30 se coupait en 65 et 25, la ou le prorata dit 63 et 27. */
    const p7030 = partageDeCible(90, { core: 7000, satellite: 3000 });
    eq(p7030.satellite, 27, 'le prorata donne 27, pas le palier de 5 le plus proche');
    eq(p7030.core, 63, 'et le reste va au core');
    eq(p7030.core + p7030.satellite, 90,
      'la somme vaut la cible d’avant : le total de la page ne bouge pas');

    /* La somme doit valoir la cible quelle que soit la repartition, sinon le
       decoupage deplacerait le total des cibles sans le dire. */
    for (const cible of [0, 1, 7, 33, 90, 100])
      for (const sat of [0, 1, 137, 4999, 10000])
        eq(partageDeCible(cible, { core: 10000 - sat, satellite: sat }).core
         + partageDeCible(cible, { core: 10000 - sat, satellite: sat }).satellite,
           cible, `${cible} % partagé sur ${sat} de satellite reste ${cible} %`);

    /* Une classe qu'on ne detient pas encore n'a pas de prorata : tout au core,
       plutot qu'une division par zero qui donnerait NaN dans les deux champs. */
    const vide = partageDeCible(40, { core: 0, satellite: 0 });
    eq(vide.core, 40, 'sans encours, la cible entière va au core');
    eq(vide.satellite, 0, 'et rien au satellite');
  });

  test('un nom de fonds se reconnaît, et l’utilisateur garde le dernier mot', () => {
    /* Une detection par `/\b(etf|ucits|msci|s&p|index|indice|world)\b/` fait
       passer sept noms de fonds courants sur quatorze pour des actions en
       direct, dont un fonds thematique au nom sans aucun de ces mots. Le champ
       Nature reste modifiable et non verrouille, parce qu'une regle sur un nom
       se trompe ; mais elle ne doit pas se tromper une fois sur deux.

       L'emetteur est le signal le plus fiable : personne n'appelle une action
       Amundi ni iShares. */
    const fonds = ['Amundi MSCI World', 'Lyxor Nasdaq-100', 'iShares Core S&P 500',
      'Vanguard FTSE All-World', 'SPDR Gold Shares', 'Amundi Euro Stoxx 50',
      'BNP Paribas Easy CAC 40', 'iShares Physical Gold',
      'Xtrackers DAX', 'Invesco EQQQ', 'VanEck Semiconductor UCITS ETF'];
    const titres = ['Meta', 'Nvidia', 'LVMH', 'Air Liquide', 'Berkshire Hathaway',
      'Accenture', 'Realty Income Real Estate Investment Trust'];

    for (const n of fonds)
      eq(natureDe({ name: n }), 'fonds', `« ${n} » doit se lire comme un fonds`);
    for (const n of titres)
      eq(natureDe({ name: n }), 'titre', `« ${n} » doit rester un titre en direct`);

    /* Et les indecidables, qui justifient le menu a eux seuls. Un ETF thematique
       nomme d'apres sa seule strategie ne porte ni emetteur, ni habillage
       juridique, ni indice : rien dans « Future of Defence » ne le distingue du
       nom d'une societe. Aucune regle sur un nom ne tranchera jamais ce cas, et
       c'est pourquoi le champ Nature reste ouvert au lieu d'etre verrouille.
       Le test ne demande donc pas le bon resultat : il demande que le repli soit
       le moins dommageable — « titre en direct », qui n'invente aucune
       diversification que la ligne n'aurait pas. */
    for (const n of ['Future of Defence', 'Global Clean Energy', 'Cybersecurity'])
      eq(natureDe({ name: n }), 'titre',
        `« ${n} » est indécidable : le repli prudent est « titre en direct »`);

    /* Les deux pieges que la table doit eviter : « Trust » figure dans le nom
       d'une fonciere americaine, et « Accenture » commence par « acc », suffixe
       de classe de parts. */
    eq(natureDe({ name: 'Realty Income Real Estate Investment Trust' }), 'titre',
      'un REIT est une action, malgré le mot Trust');
    eq(natureDe({ name: 'Accenture' }), 'titre', 'et Accenture n’est pas une part « acc »');

    /* La hierarchie des sources : ce que l'utilisateur declare gagne sur la
       passerelle, qui gagne sur la lecture du nom. C'est ce qui justifie de
       garder le menu ouvert. */
    eq(natureDe({ name: 'Amundi MSCI World', nature: 'titre' }), 'titre',
      'le choix de l’utilisateur passe devant tout');
    eq(natureDe({ name: 'Meta', kind: 'ETF' }), 'fonds',
      'la passerelle passe devant la lecture du nom');
    eq(natureDe({ name: 'Meta', kind: 'ETF', nature: 'titre' }), 'titre',
      'et l’utilisateur passe devant la passerelle');
  });

  test('une charge fixe se ramène au mois, quelle que soit sa périodicité', () => {
    /* Deux periodicites seulement, « mois » ou « an », obligeaient a diviser de
       tete un loyer de garage trimestriel puis a refaire le calcul a chaque
       changement de tarif — ce que cette table existe pour eviter.

       Le facteur est le nombre de mois que couvre un versement. La semaine vaut
       52/12 et non 4 : douze mois de quatre semaines feraient quarante-huit
       semaines, et une charge hebdomadaire serait sous-estimee de 8 % par an. */
    const mensuel = (montant, period) => auMois(montant, { period });
    pres(mensuel(100, 'mois'), 100, 'un montant mensuel est son propre équivalent');
    pres(mensuel(1200, 'an'), 100, 'annuel : divisé par douze');
    pres(mensuel(300, 'trimestre'), 100, 'trimestriel : divisé par trois');
    pres(mensuel(600, 'semestre'), 100, 'semestriel : divisé par six');
    pres(mensuel(30, 'semaine'), 130, 'hebdo : 30 EUR par semaine font 130 EUR par mois');

    /* 52/12 et non 4 : l'ecart se voit sur l'annee. */
    pres(mensuel(30, 'semaine') * 12, 1560, 'soit 52 semaines de 30 EUR sur l’année');

    /* Une periode inconnue — un etat d'avant, un export bricole — retombe sur le
       mois, la valeur qui ne deforme rien. */
    pres(mensuel(100, undefined), 100, 'périodicité absente : traitée au mois');
    pres(mensuel(100, 'lustre'), 100, 'périodicité inconnue : traitée au mois');
    eq(chargePeriode({ period: 'trimestre' }), 'trimestre', 'une période connue est gardée');
    eq(chargePeriode({ period: 'lustre' }), 'mois', 'une inconnue retombe sur le mois');

    /* Chaque periodicite proposee a son libelle et son facteur : une entree
       ajoutee a la liste sans facteur donnerait une division par `undefined`. */
    for (const [cle, label, mois] of CHARGE_PERIODES) {
      vrai(!!label, `${cle} porte un libellé`);
      vrai(mois > 0, `${cle} porte un nombre de mois couverts`);
      pres(CHARGE_MOIS_COUVERTS[cle], mois, `${cle} est dans la table de conversion`);
    }

    /* Le total des charges additionne des periodes differentes : il doit tout
       ramener au mois, sinon une assurance annuelle pese douze fois son poids. */
    Fixture.poser(e => {
      e.budget.fixedCharges = [
        { label: 'Loyer', amount: 800, period: 'mois' },
        { label: 'Assurance', amount: 1200, period: 'an' },
        { label: 'Garage', amount: 300, period: 'trimestre' },
      ];
    });
    pres(fixedTotal(), 1000, '800 + 100 + 100 par mois');
  });

  test('chaque poche de cash a sa propre définition', () => {
    /* Sur la carte du haut de Patrimoine, « Cash disponible » et « Épargne de
       précaution » ouvraient la même fiche sans argument : on cliquait une
       ligne de 20 EUR et on obtenait les 5 100 EUR des quatre poches. Le total
       était juste, la question posée n'était pas celle à laquelle on répondait.

       Le modèle porte déjà la découpe, `pochesLiquidites()`. Ce test verrouille
       ce dont la fiche a besoin : chaque poche est identifiable, nommée, et la
       somme des quatre fait les liquidités entières — donc filtrer sur l'une
       d'elles ne peut ni perdre ni compter deux fois un euro. */
    Fixture.poser();
    const poches = pochesLiquidites();
    eq(poches.length, AFFECTATIONS.length, 'une entrée par affectation déclarée');
    for (const p of poches) {
      vrai(!!AFFECTATION_LABEL[p.cle], `${p.cle} porte un libellé partagé`);
      eq(p.nom, AFFECTATION_LABEL[p.cle], 'et la fiche le nommera comme la carte');
    }
    /* La somme des poches égale les liquidités : c'est ce qui rend le filtrage
       honnête. Si une poche débordait sur une autre, une fiche restreinte
       afficherait un montant introuvable ailleurs. */
    const p = patrimoine();
    pres(poches.reduce((s, x) => s + x.value, 0), p.classes.liquidites,
      'les quatre poches font les liquidités, sans reste');

    /* Les clés sont distinctes : deux poches partageant une clé rendraient le
       filtre ambigu. */
    eq(new Set(poches.map(x => x.cle)).size, poches.length, 'quatre clés distinctes');
  });

  test('la trésorerie se retire comme une classe', () => {
    /* Quelqu'un qui place tout le jour meme garde une ligne « Cash a investir »
       a zero, sous un intitule de groupe, pour rien. Elle se retire donc, par la
       meme liste d'exclusions que les classes — un seul mecanisme, donc un seul
       chemin de retour.

       Ce que le test verrouille, et qui est le piege de ce genre d'ajout : sa
       cible ne vit pas dans `classes` mais a la racine, `targets.cashToInvest`.
       Si la somme des cibles continuait de la compter, les classes restantes ne
       pourraient plus jamais faire 100 %, et le bandeau aurait accuse
       l'utilisateur d'une erreur qui n'existe pas. */
    Fixture.poser(e => {
      e.targets.classes = { actions: 90, metaux: 5 };
      e.targets.cashToInvest = 5;
      e.targets.exclues = [];
    });
    const tg = Store.state.targets;
    pres(sommeCibles(), 100, 'départ à 100 %, trésorerie comprise');
    const baseAvant = rebalanceRows().base;
    vrai(!!rebalanceRows().cash, 'la ligne de trésorerie est là');

    /* Le retrait, tel que la vue l'appelle. */
    tg.exclues = [CLE_TRESORERIE];
    tg.ciblesRetirees = { [CLE_TRESORERIE]: tg.cashToInvest };
    tg.cashToInvest = 0;

    const r = rebalanceRows();
    eq(r.cash, null, 'plus de ligne à dessiner, donc plus d’intitulé de groupe');
    vrai(r.cashSorti, 'et la vue sait qu’elle est sortie');
    pres(sommeCibles(), 95, 'les 5 % de trésorerie quittent le total des cibles');
    pres(r.base, baseAvant - Fixture.CASH_A_INVESTIR,
      'son encours quitte la base, comme celui d’une classe sortie');
    eq(r.exclues.map(x => x.label).join(), AFFECTATION_LABEL.investir,
      'elle se nomme dans la phrase de périmètre, pas « undefined »');
    pres(r.exclues[0].value, Fixture.CASH_A_INVESTIR, 'avec son montant');

    /* Le retour restitue la cible mise de cote, a la racine et non dans
       `classes` — s'y tromper aurait cree une classe fantome « cashToInvest ». */
    tg.exclues = [];
    tg.cashToInvest = tg.ciblesRetirees[CLE_TRESORERIE];
    delete tg.ciblesRetirees[CLE_TRESORERIE];
    pres(num(Store.state.targets.cashToInvest), 5, 'la cible revient à sa place');
    vrai(!('cashToInvest' in Store.state.targets.classes),
      'et pas dans les classes, où elle serait devenue une classe d’actif');
    pres(sommeCibles(), 100, 'le total retrouve ses 100 %');
    pres(rebalanceRows().base, baseAvant, 'et la base son montant d’origine');

    /* Le libelle partage, pour que les messages ne disent pas « undefined ». */
    eq(nomDeLaCible(CLE_TRESORERIE), AFFECTATION_LABEL.investir,
      'la trésorerie porte son nom dans les messages');
    eq(nomDeLaCible('actions'), ASSET_CLASSES.actions, 'et une classe le sien');
  });

  test('retirer une classe ne détruit pas sa cible', () => {
    /* Retirer une classe ne remet pas sa cible a zero. Avec un decoupage par
       role, 70 % de core et 20 % de satellite deviendraient `0` -- un seul
       nombre -- et remettre la classe rendrait une ligne vide. Retirer par
       megarde doit rester reversible par le bouton qui parle d'ajouter une
       classe, pas par une phrase de prose.

       Un geste reversible ne doit rien detruire en chemin. La cible part dans
       `ciblesRetirees` et revient telle quelle, decoupage compris. */
    Fixture.poser(e => {
      e.targets.classes = { actions: { core: 70, satellite: 20 }, metaux: 5 };
      e.targets.cashToInvest = 5;
      e.targets.exclues = [];
    });
    const tg = Store.state.targets;
    pres(sommeCibles(), 100, 'départ à 100 %');

    /* Le retrait, tel que la vue l'appelle. */
    tg.exclues = ['actions'];
    tg.ciblesRetirees = { actions: tg.classes.actions };
    tg.classes.actions = 0;
    pres(sommeCibles(), 10, 'la classe sortie ne compte plus dans le total');
    vrai(!rebalanceRows().classes.some(c => c.cle === 'classes.actions'),
      'et sa ligne quitte la liste');

    /* Le retour. */
    tg.exclues = [];
    tg.classes.actions = tg.ciblesRetirees.actions;
    delete tg.ciblesRetirees.actions;
    eq(JSON.stringify(tg.classes.actions), '{"core":70,"satellite":20}',
      'le découpage par rôle revient tel quel');
    pres(sommeCibles(), 100, 'et le total retrouve ses 100 %');

    const roles = rebalanceRows().classes.filter(c => c.classeParente === 'actions');
    eq(roles.length, 2, 'les deux lignes de rôle sont de retour');
    pres(roles.reduce((s, l) => s + l.targetPct, 0), 90, 'avec leurs 90 % partagés');

    /* `sommeCibleDe` sert aux vues pour annoncer la cible gardee : elle doit
       descendre dans l'objet, sinon le toast annoncerait « cible 0 % ». */
    pres(sommeCibleDe({ core: 70, satellite: 20 }), 90, 'la cible gardée s’annonce entière');
    pres(sommeCibleDe(5), 5, 'et un nombre reste lui-même');
  });

  test('la somme des cibles descend dans une classe découpée', () => {
    /* Le bandeau annonçait « tes cibles totalisent 10 %, il en manque 90 » à
       quelqu'un qui venait d'en poser 105 : trois copies du calcul sommaient
       avec `num(v)`, et `num({core:70, satellite:25})` vaut zéro. La classe
       découpée disparaissait donc du total, et la seule copie juste était celle
       du pied de carte — deux totaux contradictoires sur le même écran.

       Une seule définition maintenant, `sommeCibles()`, que le bandeau, le pied
       de carte, la fenêtre « Suivre une classe » et le contrôle de cohérence
       partagent. Le test la compare au pied de carte, qui a toujours été juste :
       si une quatrième copie réapparaît, elle divergera ici. */
    const poser = cible => Fixture.poser(e => {
      e.positions = [
        { id: 'a1', name: 'ETF Monde', isin: '', symbol: 'IWDA', currency: 'EUR',
          qty: 70, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_pea',
          manual: false, assetClass: 'actions', role: 'core' },
        { id: 'a2', name: 'Une conviction', isin: '', symbol: 'CONV', currency: 'EUR',
          qty: 30, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_pea',
          manual: false, assetClass: 'actions', role: 'satellite' },
      ];
      e.targets.classes = { actions: cible, metaux: 5 };
      e.targets.cashToInvest = 5;
    });

    poser(90);
    pres(sommeCibles(), 100, 'cible entière : 90 + 5 + 5');

    poser({ core: 70, satellite: 25 });
    pres(sommeCibles(), 105, 'découpée : 70 + 25 + 5 + 5, et non 10');
    pres(sommeCibles(), rebalanceRows().invested.targetPct + num(Store.state.targets.cashToInvest),
      'même total que le pied de carte, à la définition près');

    /* Une classe sortie du rééquilibrage ne compte plus : son encours a quitté
       la base, lui réclamer une part de 100 % n'aurait pas de sens. */
    Store.state.targets.exclues = ['metaux'];
    pres(sommeCibles(), 100, 'la classe hors jeu quitte aussi le total des cibles');
  });

  test('chaque classe d’actif est câblée partout', () => {
    /* Trois tables suivaient ASSET_CLASSES en étant écrites à la main : la
       poche du patrimoine où la classe atterrit, sa teinte, et son encours dans
       le rééquilibrage. Ajouter une classe sans penser à l'une des trois la
       faisait disparaître en silence — sortie de la base, les pourcentages ne
       totalisaient plus 100 % et rien ne le disait.

       Ce test remplace la vigilance : il parcourt la table de référence, donc
       il tombera sur la classe qu'on ajoutera demain. */
    for (const [cle, label] of Object.entries(ASSET_CLASSES)) {
      vrai(!!label && !/^\s*$/.test(label), `${cle} porte un libellé`);
      const poche = pocheDeClasse(cle);
      vrai(['actions', 'obligations', 'crypto', 'liquidites'].includes(poche),
        `${cle} tombe dans une poche connue du patrimoine, pas ${poche}`);
      vrai(cle in TEINTE_CLASSE, `${cle} a une teinte, sinon sa barre serait grise`);
      vrai(/^var\(--series-\d\)$/.test(couleurClasse(cle)), `${cle} rend une couleur valide`);
      vrai(cle in stockTotals().parClasse, `${cle} a un encours dans le rééquilibrage`);
      /* Une classe cotée n'est jamais rangée dans la poche « immobilier » ni
         « nonCote » : celles-là sont réputées lentes à vendre, et y ranger un
         REIT aurait fait mentir l'autonomie financière de tout son montant. */
      vrai(poche !== 'immobilier' && poche !== 'nonCote',
        `${cle} est coté, il ne peut pas être rangé dans une poche lente`);
    }
  });

  test('la clé d’un ISIN se calcule, donc une faute se répare', () => {
    /* Un ISIN mal saisi : `US67066G104D`. Le douzieme caractere d'un
       ISIN est toujours un chiffre — un « D » y est impossible par construction —
       et il se calcule a partir des onze premiers. L'application acceptait le
       code avec un simple toast, puis le signalait comme une erreur dans les
       controles de coherence : elle se contredisait, et ne disait jamais quel
       code il fallait ecrire alors qu'elle pouvait le calculer.

       `isinIsValid` faisait deja ce calcul, pour le jeter aussitot. */
    eq(cleIsin('US67066G104'), '0', 'la clé de NVIDIA vaut zéro');
    eq(isinCorrige('US67066G104D'), 'US67066G1040', 'un D se répare en 0');
    eq(isinCorrige('us67066g104d'), 'US67066G1040', 'et la casse ne gêne pas');
    eq(isinCorrige('US67066G1040'), null, 'un code déjà juste n’a rien à corriger');
    vrai(isinIsValid('US67066G1040'), 'et il est valide');
    vrai(!isinIsValid('US67066G104D'), 'là où l’autre ne l’est pas');

    /* Onze caracteres : la cle manque, elle s'ajoute. C'est l'etat dans lequel
       une saisie interrompue laisse le champ. */
    eq(isinCorrige('US67066G104'), 'US67066G1040', 'un corps sans clé reçoit la sienne');

    /* Rien a proposer sur ce qui n'a pas la forme d'un ISIN : rendre un chiffre
       laisserait croire a une correction possible. */
    for (const nawak of ['', 'BONJOUR', '12', 'U567066G1040', null, undefined])
      eq(cleIsin(nawak), null, `${JSON.stringify(nawak)} n’a pas de clé`);
    eq(isinCorrige('BONJOUR'), null, 'et rien à corriger');

    /* La correction est idempotente : la rejouer ne bouge plus rien. Sinon un
       bouton clique deux fois aurait pu deriver. */
    const une = isinCorrige('US67066G104D');
    eq(isinCorrige(une), null, 'corriger deux fois donne le même code');
    vrai(isinIsValid(une), 'et le résultat est toujours valide');

    /* Sur quelques ISIN reels et bien formes, la cle calculee est celle qui y
       figure : c'est ce qui prouve que le calcul est le bon, et non seulement
       cohérent avec lui-même. */
    for (const bon of ['IE00B4L5Y983', 'FR0000120271', 'US0378331005', 'LU1681043599']) {
      eq(cleIsin(bon), bon[11], `la clé de ${bon} est retrouvée`);
      eq(isinCorrige(bon), null, `${bon} n’a rien à corriger`);
    }
  });

  test('un dépassement de budget se gradue en trois niveaux', () => {
    /* Le graphique peignait en rouge tout mois au-dessus de l'objectif. Sur les
       huit mois saisis, sept l'etaient : une couleur d'alerte qui s'allume
       presque toujours devient decorative, et le mois reellement mauvais ne se
       distinguait plus du mois a 20 EUR pres.

       Le seuil vit dans le modele, donc le graphique et les deux tableaux ne
       peuvent pas en avoir trois lectures. Ce que le test verrouille : les
       bornes exactes, et le fait qu'un mois vide n'ait aucun niveau — le
       compter comme « sous l'objectif » en ferait une reussite alors que rien
       n'est saisi. */
    eq(niveauDepassement(0, 1000), null, 'un mois vide n’a pas de niveau');
    eq(niveauDepassement(null, 1000), null, 'ni un mois absent');
    eq(niveauDepassement(900, 1000), 'sous', 'sous l’objectif');
    eq(niveauDepassement(1000, 1000), 'sous', 'pile dessus, c’est tenu');
    eq(niveauDepassement(1001, 1000), 'leger', 'un euro au-dessus reste léger');
    eq(niveauDepassement(1499, 1000), 'leger', 'juste avant le seuil');
    eq(niveauDepassement(1500, 1000), 'grave', 'le seuil est atteint, pas frôlé');
    eq(niveauDepassement(3000, 1000), 'grave', 'et au-delà');

    /* Sans objectif pose, rien n'est un depassement : reclamer moins que zero
       n'a pas de sens, et tout mois serait devenu grave. */
    eq(niveauDepassement(1200, 0), 'sous', 'pas d’objectif, pas de dépassement');

    /* Le seuil est bien celui qu'annonce la legende de la carte. */
    pres(SEUIL_DEPASSEMENT_GRAVE, 0.5, 'le seuil annoncé à l’écran est celui qui décide');

    /* Sur les vrais niveaux, le graphique et les tableaux partagent la table :
       trois niveaux, trois classes, et aucune n'est celle du vide. */
    for (const [total, attendu] of [[900, 'up'], [1100, 'tiede'], [2000, 'down'], [0, 'muted']])
      eq(classeDepassement(total, 1000), attendu, `${total} EUR doit se peindre en ${attendu}`);
  });


  test('aucun écran ne mélange une poche et une classe de ligne', () => {
    /* Deux paires de teintes reposent sur cette condition, et elle n'etait
       qu'une phrase dans un commentaire : immobilier partage sa couleur avec
       immobilier cote, capital garanti avec multi-actifs, et chaque fois parce
       que l'une est une poche du patrimoine et l'autre une classe de ligne
       cotee. Le jour ou un ecran les met cote a cote, deux choses sans rapport
       portent le meme vert et rien ne le dit.

       Le controle porte sur la source : une fonction qui lit la table des
       poches ne lit pas celle des classes fines, et reciproquement. */
    const src = lireSource('assets/app.js');
    /* Les deux tables ne se lisent jamais dans la meme expression de couleur ni
       dans la meme legende. On regarde ligne a ligne : c'est grossier, et c'est
       exactement ce qu'il faut — une seule ligne qui les nomme toutes les deux
       est le debut du melange. */
    const fautives = src.split('\n')
      .map((l, i) => ({ n: i + 1, l }))
      .filter(({ l }) => /CLASSES_ACTIFS\[/.test(l) && /ASSET_CLASSES\[/.test(l));
    eq(fautives.map(f => f.n).join(', '), '',
      'ces lignes nomment une poche et une classe fine ensemble : la paire de '
      + 'teintes cesse alors d’être sûre');
    /* Et les deux membres de chaque paire restent bien de vocabulaires
       differents : celui qui passerait de l'un a l'autre ferait tomber la
       garantie sans que rien d'autre ne bouge. */
    for (const [a, b] of [['immobilier', 'immobilierCote'], ['garanti', 'diversifie']]) {
      const poche = a in CLASSES_ACTIFS, fine = b in ASSET_CLASSES;
      vrai(poche && fine, `${a} doit rester une poche et ${b} une classe de ligne`);
      vrai(!(a in ASSET_CLASSES), `${a} ne peut pas être aussi une classe de ligne`);
      vrai(!(b in CLASSES_ACTIFS), `${b} ne peut pas être aussi une poche`);
    }
  });

  test('un actif porte la même couleur partout', () => {
    /* La couleur est le seul repère qui traverse les écrans sans être écrit :
       on reconnaît l'immobilier à sa teinte avant de lire son nom. Deux listes
       de teintes écrites à la main avaient déjà divergé — les obligations
       étaient `series-6` d'un côté et `series-7` de l'autre, et un studio se
       peignait de la couleur d'un ETC or dans « Allocation par actif », où les
       deux apparaissent côte à côte.

       Ce test verrouille trois choses : une seule table attribue les teintes,
       deux classes différentes ne partagent jamais une teinte sauf paire
       déclarée, et toute fonction qui distribue des couleurs passe par cette
       table. */

    /* 1. Les paires volontaires, et rien d'autre. Liquidités et monétaire sont
          le même argent vu de deux étages ; immobilier et immobilier coté ont
          le même sous-jacent. Toute autre collision est un accident. */
    /* La troisième paire suit le motif de la deuxième : une poche du patrimoine
       et une classe de ligne cotée, qui ne se rencontrent sur aucun graphique.
       Elle n'a pas été choisie, elle a été subie — mesuré en balayant teinte,
       saturation et clarté contre les neuf séries et les cinq couleurs de sens,
       le meilleur écart atteignable sur tout le cercle vaut 17,6° en thème
       clair et 19,1° en sombre, quand la règle en exige 20. Le cercle est
       plein, et le test qui suit garde la condition qui rend la paire sûre. */
    const paires = [['liquidites', 'monetaire'], ['immobilier', 'immobilierCote'],
                    ['garanti', 'diversifie']];
    const memeCouple = (a, b) => paires.some(p => p.includes(a) && p.includes(b));
    const cles = Object.keys(TEINTE_CLASSE);
    for (const a of cles) {
      for (const b of cles) {
        if (a >= b) continue;
        if (TEINTE_CLASSE[a] !== TEINTE_CLASSE[b]) continue;
        vrai(memeCouple(a, b), `${a} et ${b} partagent une teinte sans raison déclarée`);
      }
    }

    /* 2. Chaque teinte attribuée existe vraiment dans la feuille de style. Une
          classe pointant sur `--series-13` rendrait une couleur vide, donc une
          barre transparente : invisible au test, visible à l'écran. */
    for (const cle of cles) {
      const n = TEINTE_CLASSE[cle];
      vrai(n >= 1 && n <= TEINTES_DISPONIBLES,
        `${cle} pointe sur --series-${n}, hors des ${TEINTES_DISPONIBLES} teintes déclarées`);
      const resolue = getComputedStyle(document.documentElement)
        .getPropertyValue(`--series-${n}`).trim();
      vrai(/^#[0-9a-f]{6}$/i.test(resolue),
        `--series-${n} doit être une couleur, reçu « ${resolue} » pour ${cle}`);
    }

    /* 3. Une classe inconnue tombe sur la teinte « sans classe » et non sur
          celle d'une vraie classe : elle se lit comme non classée. */
    eq(couleurClasse('unePoubelleInconnue'), `var(--series-${TEINTE_SANS_CLASSE})`,
      'une classe sans attribution ne vole pas la couleur d’une autre');
    vrai(!Object.values(TEINTE_CLASSE).includes(TEINTE_SANS_CLASSE),
      'et cette teinte de repli n’est attribuée à aucune classe');

    /* 4. Le même libellé ne peut pas porter deux couleurs, à travers toutes les
          fonctions qui en distribuent. C'est la formulation exacte de la règle :
          un actif, une couleur, partout. */
    Fixture.poser();
    const vues = [];
    for (const x of repartitionClasses()) vues.push(['répartition', x.label, x.couleur]);
    for (const x of allocationByAsset()) vues.push(['par actif', x.label, x.couleur]);
    for (const x of stockTotals().parClasse ? [] : []) vues.push(x);
    const rr = rebalanceRoles();
    for (const r of rr.roles || []) {
      for (const c of (rr.composition && rr.composition[r.cle]) || [])
        vues.push(['composition', c.label || c.classe, c.couleur]);
    }
    const parLibelle = new Map();
    for (const [ou, label, couleur] of vues) {
      if (!couleur) continue;
      if (!parLibelle.has(label)) { parLibelle.set(label, { couleur, ou }); continue; }
      const vu = parLibelle.get(label);
      eq(couleur, vu.couleur,
        `« ${label} » est ${vu.couleur} dans ${vu.ou} et ${couleur} dans ${ou}`);
    }
    vrai(parLibelle.size > 3, 'le test doit avoir vu plusieurs libellés, sinon il ne prouve rien');
  });

  test('un REIT n’est plus compté comme une action', () => {
    /* Une foncière est cotée, vendable en séance, mais son risque est
       l'immobilier. Tout cela tombait dans « Actions » : 20 % de foncières se
       lisaient comme 20 % d'actions de plus, et l'écart affiché envoyait
       renforcer une classe déjà pleine. */
    const ligne = (id, classe, qty) => ({
      id, name: classe === 'immobilierCote' ? 'ETF Foncières' : 'ETF Monde',
      isin: '', symbol: classe === 'immobilierCote' ? 'REIT' : 'IWDA', currency: 'EUR',
      qty, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_cto',
      manual: false, assetClass: classe, role: 'core',
    });
    Fixture.poser(e => {
      e.positions = [ligne('a1', 'actions', 60), ligne('a2', 'immobilierCote', 20),
                     ligne('a3', 'diversifie', 20)];
      e.targets.classes = { actions: 60, immobilierCote: 20, diversifie: 20 };
      e.targets.cashToInvest = 0;
    });
    const t = stockTotals();
    pres(t.parClasse.actions, 6000, 'les actions ne comptent que les actions');
    pres(t.parClasse.immobilierCote, 2000, 'la foncière a sa propre ligne');
    pres(t.parClasse.diversifie, 2000, 'le fonds mixte aussi');
    pres(t.invested, 10000, 'et le total des classes fait toujours le total investi');

    const r = rebalanceRows();
    const parNom = Object.fromEntries(r.classes.map(c => [c.label, c]));
    pres(parNom[ASSET_CLASSES.immobilierCote].value, 2000, 'la ligne d’immobilier coté est là');
    pres(parNom[ASSET_CLASSES.diversifie].value, 2000, 'la ligne multi-actifs aussi');
    pres(r.classes.reduce((s, c) => s + c.value, 0), r.invested.value,
      'et la somme des lignes fait le placé en bourse, sans reste');
    pres(sommeCibles(), 100, 'les trois cibles font 100 %');
    /* Les écarts s'annulent sur la base entière, trésorerie comprise : le
       fixture porte du cash à investir, qui entre dans la base et tire les
       trois classes vers le bas. Sommer les seules classes laissait un reste
       égal à ce cash, et l'assertion accusait le calcul de ce qu'elle oubliait. */
    pres(r.classes.reduce((s, c) => s + c.delta, 0) + r.cash.delta, 0,
      'à cibles exactes, ce qu’il faut acheter finance exactement ce qu’il faut vendre');

    /* Le sous-jacent est de l'immobilier, mais la liquidité est celle d'un
       titre : la poche du patrimoine est « actifs de marché », pas
       « immobilier ». Sinon l'autonomie financière compterait ces 2 000 EUR
       comme vendables en quelques mois. */
    eq(pocheDeClasse('immobilierCote'), 'actions',
      'un REIT reste un actif de marché pour la disponibilité');
  });

  test('la composition d’un rôle sépare la classe de la nature', () => {
    /* Ce que la phrase de synthese doit pouvoir agreger. `composition` est
       indexee par classe ET par nature : une classe detenue a la fois en fonds
       et en direct y occupe deux entrees. La phrase prenait la premiere et
       l'annoncait comme la classe entiere — « 57 % actions » quand les actions
       faisaient 83 % des satellites. Le chiffre etait juste, son intitule
       mentait.

       Le fixture pose exactement ce cas : deux lignes d'actions satellites, un
       fonds et un titre en direct. */
    const ligne = (id, nature, qty) => ({
      id, name: nature === 'fonds' ? 'ETF Small Caps' : 'Une société',
      isin: '', symbol: nature === 'fonds' ? 'SMALL' : 'SOC', currency: 'EUR',
      qty, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_cto',
      manual: false, assetClass: 'actions', role: 'satellite', nature,
    });
    Fixture.poser(e => { e.positions = [ligne('s1', 'fonds', 11), ligne('s2', 'direct', 24)]; });
    const rr = rebalanceRoles();
    const sat = rr.composition.satellite || [];
    vrai(sat.length >= 2, 'la même classe en deux natures fait deux entrées');
    eq([...new Set(sat.map(x => x.classe))].length, 1, 'et une seule classe');
    /* L'agregation par classe vaut le total du role : c'est ce que la phrase
       annonce, et ce que la premiere entree seule ne valait pas. */
    const parClasse = new Map();
    for (const p of sat) parClasse.set(p.classe, (parClasse.get(p.classe) || 0) + p.value);
    const total = rr.roles.find(x => x.cle === 'satellite').value;
    pres([...parClasse.values()][0], total, 'la classe agrégée fait tout le rôle');
    vrai(sat[0].value < total,
      'alors que la première entrée seule en vaut moins : c’était le bug');
  });

  test('deux titres homonymes gardent chacun leur identité', () => {
    /* Le bug : l'ecran retrouvait une ligne du jour par son nom avec .find().
       Le meme titre sur deux comptes — un MSCI World au PEA et au CTO —
       recevait deux fois le poids et la fiche du premier. Le nom est un
       libelle, jamais une identite : dayPerformance porte l'indice reel. */
    const homonyme = (id, qty, compte) => ({
      id, name: 'MSCI World', isin: '', symbol: 'IWDA', currency: 'EUR',
      qty, buyPrice: 80, price: 90, prevClose: 88, fx: 1, fxBuy: 1,
      account: compte, manual: false, assetClass: 'actions', role: 'core',
    });
    Fixture.poser(e => {
      e.positions = [homonyme('h1', 10, 'c_pea'), homonyme('h2', 3, 'c_cto')];
    });
    const j = dayPerformance();
    eq(j.lignes.length, 2, 'deux lignes, pas une');
    const idx = j.lignes.map(l => l.index).sort();
    eq(String(idx), '0,1', 'chaque ligne pointe sa propre position');
    /* Et les valeurs different : 10 parts contre 3, si l'une ecrasait l'autre
       les deux vaudraient pareil. */
    const vals = j.lignes.map(l => Math.round(l.value)).sort((a, b) => a - b);
    eq(String(vals), '270,900', 'chaque ligne porte sa propre valeur');
  });

  test('une matière première n’a pas de pays', () => {
    /* Le bug : la regex portait deux vrais caractères « retour arrière »
       (0x08) là où `\b` était voulu. Elle ne pouvait plus reconnaître
       « gold », et un ETC or coté en dollars tombait sur la règle de repli
       `currency === 'USD'`, donc en « Amérique du Nord » — exactement ce que
       le commentaire au-dessus de la fonction interdit. */
    Fixture.poser();
    eq(devineZone({ name: 'Amundi Physical Gold ETC', symbol: 'GOLD.PA', currency: 'USD' }),
      'monde', 'un ETC or en dollars n’est pas un actif américain');
    eq(devineZone({ name: 'iShares Physical Silver', symbol: 'SLV', currency: 'USD' }),
      'monde', 'l’argent métal non plus');
  });

  test('les indices connus tombent sur leur zone', () => {
    Fixture.poser();
    eq(devineZone({ name: 'S&P 500 UCITS ETF', symbol: 'CSPX', currency: 'USD' }), 'amnord');
    eq(devineZone({ name: 'MSCI World UCITS ETF', symbol: 'IWDA', currency: 'EUR' }), 'monde');
    eq(devineZone({ name: 'Amundi CAC 40', symbol: 'C40', currency: 'EUR' }), 'france');
    eq(devineZone({ name: 'iShares Core MSCI EM', symbol: 'EIMI', currency: 'USD' }), 'emergents');
  });

  test('le secteur suit la même règle', () => {
    Fixture.poser();
    eq(devineSecteur({ name: 'Amundi Physical Gold ETC', symbol: 'GOLD.PA', currency: 'USD' }),
      'matieres', 'l’or est une matière première');
    eq(devineSecteur({ name: 'Future of Defence UCITS ETF', symbol: 'NATO', currency: 'EUR' }),
      'industrie');
  });
});

/* --- Acheter sort de l'argent du compte ou l'on achete -------------------- */
suite('Créer une ligne débite le compte choisi, sans le redemander', () => {
  const app = () => lireSource('assets/app.js');
  const fenetre = () => {
    const a = app();
    const d = a.indexOf("sous: trad('Où ranger cette ligne ?')");
    return a.slice(d, a.indexOf('catch (e)', d));
  };

  test('la question est une case cochée, plus une liste qui s’ouvre sur « ne rien faire »', () => {
    /* La liste demandait de quel compte l'argent sort alors que le compte est
       choisi deux champs plus haut, et son premier choix etait « aucun compte,
       ne pas toucher aux especes » : acheter ne debitait donc rien tant qu'on
       n'avait pas repondu, et le cash d'un compte-titres ne baissait jamais. */
    const f = fenetre();
    vrai(/cle: 'debiter', type: 'case', valeur: true/.test(f),
      'la case existe, et elle est cochée');
    vrai(!/cle: 'cash'/.test(f), 'la liste a quitté cette fenêtre');
    vrai(!/Aucun compte, ne pas toucher aux espèces/.test(f),
      'et son choix par défaut avec elle');
  });

  test('le débit vise le compte de la ligne, et n’invente pas d’espèces', () => {
    const f = fenetre();
    vrai(/let debit = v\.debiter && achete \? lirePart\(v\.partie\) : null;/.test(f), 'la case commande le débit, et désigne la part qui paie');
    vrai(/options: id => listeDeParts\(\[compteById\(id\)\], id\)\.options/.test(f),
      'le compte débité est celui de la ligne, et seules ses parts d’espèces paient');
    /* `cashInvestirEntree(compte, true)` cree une poche d'especes sur n'importe
       quel compte : sans le garde ci-dessus, un bien immobilier se mettrait a en
       afficher une. C'est donc a l'appelant de trancher, et il le fait. */
    vrai(/Garder la ligne sans toucher aux espèces \?/.test(f), 'et le cas qui ne débite rien se demande');
  });

  test('les chaînes neuves existent en anglais', () => {
    for (const k of ['Soustraire le cash du compte choisi',
                     'décoche si tu déclares une ligne que tu détiens déjà',
                     'Ce compte ne porte pas d’espèces, rien n’a été débité']) {
      vrai(!!I18N.en[k], `« ${k} » est traduite`);
    }
    /* « Paid since » annonçait une date pour un champ qui demande une
       provenance. La liste a quitté la création, pas la fenêtre d'achat. */
    eq(I18N.en['Payé depuis'], 'Paid from', 'et le champ restant ne parle plus de date');
  });

  test('le total se lit pendant la frappe, et il ne se saisit pas', () => {
    const a = app();
    /* `valeurs()` cherche `#f_<cle>` : un champ calcule porte un `c_`, il lui
       est donc invisible et ne peut pas devenir une seconde surface d'edition
       pour une valeur que deux champs portent deja. */
    vrai(/<p class="champ-lecture" id="c_\$\{c\.cle\}"><\/p>/.test(a),
      'le champ calculé porte un identifiant en c_, jamais en f_');
    vrai(/const el = \$\(`#f_\$\{c\.cle\}`\);/.test(a), 'et valeurs() ne lit que les f_');
    const f = fenetre();
    vrai(/calcul: v => num\(v\.qty\) > 0 && num\(v\.buyPrice\) > 0/.test(f),
      'le total est le produit des deux champs du dessus');
    /* DANS LA DEVISE DU TITRE, ET RIEN D'AUTRE : le taux de change n'est connu
       qu'apres la creation, donc un equivalent en euros serait invente. */
    vrai(/fmtCur\(num\(v\.qty\) \* num\(v\.buyPrice\), \(cote && cote\.currency\) \|\| deviseBase\(\)\)/.test(f),
      'et il s’affiche dans la devise du titre, sans conversion supposée');
    vrai(!!I18N.en['le débit se convertit au taux du jour'],
      'la bulle qui annonce la conversion est traduite');
  });

  test('une case et son libellé tiennent sur une ligne', () => {
    /* Le gabarit posait `field-case` sans qu'aucune regle ne la ramasse : la
       case tombait sur sa propre ligne, au-dessus du texte qu'elle commande. */
    const css = lireSource('assets/styles.css');
    const r = css.slice(css.indexOf('.field-case {'), css.indexOf('.field-case {') + 220);
    vrai(/display: flex;/.test(r), 'la classe du gabarit a une règle en face');
    vrai(/align-items: start;/.test(r),
      'et la case s’aligne sur la première ligne d’un libellé qui en fait deux');
    vrai(/class="field-case"/.test(app()), 'le gabarit la pose bien');
  });
});

/* --- Une carte qui se lit en cinq secondes -------------------------------- */
suite('La carte Portefeuille se lit de haut en bas', () => {
  const app = () => lireSource('assets/app.js');
  const carte = () => {
    const a = app();
    /* La borne de fin se cherche DEPUIS le debut de la carte : la carte du jour
       apparait plus haut dans le fichier, et un `indexOf` depuis zero rendait
       une tranche vide, donc des controles verts pour rien. */
    const d = a.indexOf('const st = stockTotals();');
    return a.slice(d, a.indexOf('const j = dayPerformance();', d));
  };

  test('le chiffre de tête est le total, et il porte son nom', () => {
    /* Ouvrir la carte sur « Titres 21 600 EUR · 94,7 % » presenterait une part
       comme si elle etait le sujet, sans meme dire de quoi elle est la part. */
    const c = carte();
    vrai(/<p class="ptf-lab">\$\{trad\('Valeur du portefeuille'\)\}<\/p>/.test(c),
      'le total est annoncé');
    vrai(/<p class="ptf-total">\$\{fmtEUR\(st\.balance\)\}<\/p>/.test(c),
      'et c’est bien le total du portefeuille');
    eq(I18N.en['Valeur du portefeuille'], 'Portfolio value', 'traduit');
  });

  test('la composition explique le total, sans le commenter', () => {
    const c = carte();
    vrai(/<dl class="ptf-compo">/.test(c), 'deux lignes sobres, intitulé puis montant');
    vrai(/label: 'Placements'/.test(c) && /label: 'Espèces disponibles'/.test(c),
      'les deux postes sont nommés');
    /* LA BARRE ET LES POURCENTAGES SONT PARTIS. Le rapport se lit deja sur deux
       montants alignes ; une jauge presque pleine au-dessus d'une jauge presque
       vide le redisait une troisieme fois pour trente pixels chacune. */
    vrai(!/ptf-barre|ptf-part\b/.test(c), 'la barre segmentée a disparu');
    vrai(!/fmtPct\(x\.pct/.test(c), 'et les pourcentages de composition avec elle');
    /* `balance` vaut `invested + cashToInvest + autres` : le troisieme terme
       porte les lignes saisies a la main sur un compte de bourse. Sans lui, la
       composition n'expliquerait pas le total qu'elle annonce. */
    vrai(/label: 'Autres lignes'/.test(c), 'le troisième terme a sa ligne');
    Fixture.poser();
    const st = stockTotals();
    pres(st.invested + st.cashToInvest + (st.balance - st.invested - st.cashToInvest),
      st.balance, 'et les trois font le total');
  });

  test('le gain est un bloc à part, avec son explication', () => {
    const c = carte();
    vrai(/<div class="ptf-pv">/.test(c), 'il ne rejoint pas les lignes de composition');
    vrai(/trad\('Plus-value latente'\)\}\$\{aide\(/.test(c),
      'son intitulé porte une aide');
    /* `aide()` rend un span avec `role` et `tabindex`, et `monteAides` l'ecoute :
       le clic, le toucher et le clavier y arrivent deja. Rien a reinventer. */
    const a = app();
    vrai(/role="button"[\s\S]{0,80}tabindex="0"/.test(a.slice(a.indexOf('function aide('))),
      'et cette aide est atteignable au clavier');
    /* L'AIDE NE DIT QUE CE QUI EST VRAI DU MOTEUR. Les ventes passees ont leur
       journal et n'entrent pas ici ; les dividendes ne sont suivis nulle part,
       et le taire laisserait croire a un rendement total. Rien sur les frais ni
       sur l'impot : le prix de revient est celui que le detenteur a saisi,
       frais compris ou non, et l'application n'en sait rien. */
    vrai(/Les plus-values déjà réalisées lors de ventes n’y sont pas/.test(c),
      'l’explication écarte les ventes passées');
    vrai(/Longward ne suit aucun dividende/.test(c), 'et nomme ce qu’il ne suit pas');
    /* La portee se lit dans le texte de l'aide, pas dans la tranche entiere :
       un commentaire de code qui explique pourquoi on ne parle pas des frais
       contient le mot « frais ». */
    const bulle = c.slice(c.indexOf('Écart entre la valeur actuelle'),
                          c.indexOf('aucun dividende.') + 16);
    vrai(!/frais|impôt|fiscal/.test(bulle), 'sans rien affirmer que le moteur ignore');
    /* LA PORTEE SE DIT SOUS LE CHIFFRE. Sans elle, la plus-value se lit comme
       la performance de tout le portefeuille depuis le debut, ventes comprises. */
    vrai(/trad\('sur les positions détenues'\)/.test(c), 'la portée est écrite sous le chiffre');
    /* ET LE COUT D'ACHAT N'EST PLUS UNE ACTION : il vivait en lien pointille au
       rang d'un renvoi. Le montant reste atteignable, le panneau de la
       plus-value l'ecrit sous son total. */
    vrai(!/data-apercu="investiTitres"/.test(c), 'le coût d’achat n’est plus un bouton');
    const a2 = app();
    vrai(/trad\('sur.investis', 'sur'\)\} \$\{fmtEUR0\(pnl\.invested\)\}/.test(a2),
      'et le panneau de la plus-value le porte toujours');
  });

  test('une base absente ne devient jamais zéro', () => {
    /* Sans prix d'achat, « valeur moins zero » rendrait la valeur entiere : le
       chiffre le plus faux de l'application serait aussi le plus gros. */
    const c = carte();
    vrai(/const pvVal = pnl\.pct == null \? null/.test(c), 'la garde précède le calcul');
    vrai(/trad\('Indisponible'\)/.test(c), 'et l’écran le dit');
    vrai(/hors \{n\} sans prix d’achat/.test(c),
      'une base partielle se déclare aussi');
    Fixture.poser();
    Store.state.positions.forEach(p => { p.buyPrice = 0; p.manual = false; });
    const lat = latentPnl();
    eq(lat.pct, null, 'sans base, pas de pourcentage');
    pres(lat.pnl, 0, 'et pas d’euro inventé');
  });

  test('l’allocation et la concentration ont quitté cette carte', () => {
    const c = carte();
    /* Un role n'est pas un composant du total, c'est une facon de le decouper :
       il vit sur Allocation, dont c'est le sujet. */
    vrai(!/ptf-roles|Core et satellite/.test(c), 'Core et Satellite sont partis');
    /* `concentration()` compte sur les actifs financiers, le patrimoine net ou
       le patrimoine brut, jamais sur le portefeuille de marche : mesure, 66 551
       contre 52 177 pour tout le reste de la carte. */
    vrai(!/trad\('Concentration'\)/.test(c), 'la concentration aussi');
    Fixture.poser();
    const st = stockTotals();
    const cc = concentration({ financier: true });
    vrai(!!cc && Math.abs(cc.premiere.value / cc.premiere.pct * 100 - st.balance) > 1,
      'et sa base diffère bien de celle de la carte');
  });
});

/* --- Trier ses lignes sans quitter le telephone --------------------------- */
suite('Le tri des lignes de titres', () => {
  const app = () => lireSource('assets/app.js');
  const comparateur = () => {
    const a = app();
    const d = a.indexOf('function sortPositions(');
    return a.slice(d, a.indexOf('\nfunction ', d + 1));
  };

  test('le défaut est la valeur décroissante, et il se mémorise', () => {
    /* L'ordre de saisie ne repond a aucune question ; « qu'est-ce qui pese le
       plus » est la premiere qu'on se pose devant une liste de positions. */
    const a = app();
    vrai(/const TRI_POSITIONS_DEFAUT = \{ key: 'value', dir: 'desc' \};/.test(a),
      'la valeur décroissante ouvre la carte');
    /* Une PREFERENCE, pas un drapeau de session : rangee dans `meta`, elle suit
       l'etat partout ou il va, synchronisation comprise. C'est le mecanisme
       deja en place, aucun second systeme. */
    vrai(/Store\.state\?\.meta\?\.triPositions/.test(a), 'elle se lit dans meta');
    vrai(/Store\.state\.meta\.triPositions = \{ key, dir \};\s*\n\s*Store\.save\(\);/.test(a),
      'et s’y écrit avec le reste de l’état');
    /* Une clef inconnue ne doit pas figer la carte sur un tri qui n'existe
       plus : la lecture retombe sur le defaut. */
    vrai(/POS_SORT_KEYS\[t\.key\] && \(t\.dir === 'asc' \|\| t\.dir === 'desc'\)/.test(a),
      'une préférence abîmée retombe sur le défaut');
  });

  test('une donnée absente passe dernière, dans les deux sens', () => {
    /* `posPerfEur()` et `posPerfPct()` rendent null sans prix de revient, et
       c'est voulu. Mais `null - 5` vaut -5 : le tri les rangeait comme des
       zeros, au milieu des pertes en decroissant et en tete en croissant. */
    const c = comparateur();
    vrai(/const aVide = va == null, bVide = vb == null;/.test(c), 'le vide se reconnaît');
    vrai(/\(aVide \? 1 : -1\)/.test(c), 'et il part au bout, quel que soit le sens');
    Fixture.poser();
    const p = Store.state.positions[0];
    p.buyPrice = 0; p.manual = false;
    eq(posPerfEur(p), null, 'le modèle ne fabrique pas d’euro');
    eq(posPerfPct(p), null, 'ni de pourcentage');
  });

  test('à égalité, le nom tranche, et toujours dans le même sens', () => {
    /* Sans ce depart, deux lignes de meme valeur changeaient de place d'un
       rendu a l'autre : l'ordre d'arrivee suit l'ordre de saisie, que le filtre
       par compte modifie sans prevenir. */
    const c = comparateur();
    vrai(/\(va - vb\) \* dir \|\| nom\(a\.p\)\.localeCompare\(nom\(b\.p\), 'fr'\)/.test(c),
      'le nom départage les nombres');
    vrai(/return c \|\| nom\(a\.p\)\.localeCompare\(nom\(b\.p\), 'fr'\);/.test(c),
      'et les chaînes aussi');
  });

  test('les quatre critères sont nommés comme on en parle', () => {
    const a = app();
    const bloc = a.slice(a.indexOf('const TRI_POSITIONS_CHOIX'), a.indexOf('function triPositions'));
    for (const [cle, mot] of [['value', 'Valeur'], ['perfEur', 'Plus-value €'],
                              ['perfPct', 'Plus-value %'], ['name', 'Nom']]) {
      vrai(bloc.includes(`'${cle}'`) && bloc.includes(`'${mot}'`), `${mot} est proposé`);
      vrai(!!POS_SORT_KEYS_PRESENT(cle, a), `${cle} existe dans le moteur de tri`);
    }
    /* Pas le vocabulaire d'un tableur : « montant total » et « performance
       relative » disent la meme chose et ne se retiennent pas. */
    vrai(!/Montant total|Performance absolue|Performance relative/.test(bloc),
      'et aucun mot de tableur');
    for (const k of ['Trier les lignes', 'Plus-value €', 'Plus-value %'])
      vrai(!!I18N.en[k], `« ${k} » est traduite`);
  });

  function POS_SORT_KEYS_PRESENT(cle, a) {
    const t = a.slice(a.indexOf('const POS_SORT_KEYS'), a.indexOf('function sortPositions'));
    return new RegExp(`\\b${cle}:\\s*p =>`).test(t);
  }

  test('le tri s’atteint au doigt, là où le tableau disparaît', () => {
    /* Sous 768 px, le tableau devient une liste et ses en-tetes triables
       partent avec lui : le classement n'etait plus ni lisible ni modifiable.
       Un declencheur, pas quatre boutons : une rangee de criteres prendrait
       toute la largeur et disputerait l'attention a « Positions | Cible ». */
    const a = app();
    vrai(/data-action="trier-positions"/.test(a), 'un déclencheur existe');
    vrai(/class="btn sm ghost tri-lignes"/.test(a), 'discret, comme ses voisins');
    /* Il porte l'etat courant, ce qui vaut mieux qu'un intitule generique. */
    vrai(/tri\.dir === 'desc' \? '↓' : '↑'/.test(a), 'et il dit le sens en cours');
    /* La feuille est le composant maison, celui des preferences : aucun menu
       neuf pour un besoin que l'application sait deja servir. */
    const h = a.slice(a.indexOf("async 'trier-positions'()"), a.indexOf("async 'trier-positions'()") + 700);
    vrai(/await askOptions\(\{/.test(h), 'la feuille est askOptions, pas un menu neuf');
    vrai(/v === tri\.key && tri\.dir === 'desc' \? 'asc' : 'desc'/.test(h),
      'rechoisir le critère actif inverse le sens');
  });
});

/* --- Une faute de frappe sur une ligne ne renverse pas Longward ----------- */
suite('Robustesse numérique : ce qui entre, et ce qu’on en dit', () => {
  const app = () => lireSource('assets/app.js');

  test('lireNombre lit comme un humain tape, et refuse le reste', () => {
    /* `Number('1e30')` vaut dix puissance trente, `Number('12,5')` vaut NaN :
       deux surprises pour qui saisit en francais. Ici la virgule passe, les
       espaces aussi, la notation savante non — personne ne la tape, un collage
       l'apporte. */
    eq(lireNombre('12,5'), 12.5, 'la virgule française est un point');
    eq(lireNombre('1 250 000'), 1250000, 'les espaces de milliers s’ignorent');
    eq(lireNombre('1 250'), 1250, 'l’insécable aussi');
    eq(lireNombre('0'), 0, 'zéro est un nombre');
    eq(lireNombre('-1'), -1, 'négatif aussi, c’est le genre qui tranche');
    eq(lireNombre('0,01'), 0.01, 'le centime passe');
    for (const s of ['1e30', '1,2e50', 'Infinity', '-Infinity', 'NaN', 'abc', '12abc', '', '1e3'])
      eq(lireNombre(s), null, `« ${s} » n’est pas un nombre saisi`);
  });

  test('nombreValide borne par genre, et le vide passe', () => {
    /* La borne est METIER, pas technique : MAX_SAFE_INTEGER laisse passer neuf
       millions de milliards. Chaque genre a la sienne, toutes genereuses. */
    for (const v of [0, 1, 999, 100000, 1000000, 1000000000, '12,5', '1 250 000'])
      vrai(nombreValide(v, 'montant'), `${v} est un montant plausible`);
    eq(nombreValide(-1, 'montant'), false, 'un montant négatif se refuse');
    eq(nombreValide(-1, 'signe'), true, 'une rentrée négative est une dépense');
    eq(nombreValide(1e12, 'montant'), true, 'mille milliards, la borne inclusive');
    eq(nombreValide(1e12 + 1, 'montant'), false, 'un euro de plus, non');
    eq(nombreValide(Number.MAX_SAFE_INTEGER, 'montant'), false, 'MAX_SAFE_INTEGER n’est pas un patrimoine');
    for (const v of [1e20, 1e100, Infinity, -Infinity, NaN, '1e30', 'abc'])
      eq(nombreValide(v, 'montant'), false, `${String(v)} ne passe pas`);
    eq(nombreValide('', 'montant'), true, 'le vide dit l’ignorance, c’est requis qui tranche');
    eq(nombreValide(0.00000001, 'quantite'), true, 'un satoshi de quantité passe');
    eq(nombreValide(1e9, 'prix'), true, 'un milliard l’unité, la borne des prix');
    eq(nombreValide(1e9 + 1, 'prix'), false, 'et pas plus');
    eq(nombreValide(50, 'taux'), true, 'cinquante pour cent l’an, dernier taux admis');
    eq(nombreValide(60, 'taux'), false, 'soixante est une faute de frappe');
    eq(nombreValide(100, 'pct'), true, 'cent pour cent');
    eq(nombreValide(101, 'pct'), false, 'cent un, non');
  });

  test('le genre se déduit de la clef ou du chemin, sans liste à tenir', () => {
    eq(genreDeCle('qty'), 'quantite'); eq(genreDeCle('buyPrice'), 'prix');
    eq(genreDeCle('taux'), 'taux'); eq(genreDeCle('part'), 'pct');
    eq(genreDeCle('mensualite'), 'flux'); eq(genreDeCle('amount'), 'signe');
    eq(genreDeCle('montant'), 'montant'); eq(genreDeCle('inconnu'), 'montant');
    eq(genreDuChemin('positions.3.qty'), 'quantite');
    eq(genreDuChemin('budget.income.2.amount'), 'signe');
    eq(genreDuChemin('etabs.0.dettes.1.montant'), 'montant');
  });

  test('une valeur aberrante déjà dans le modèle se marque, ne se corrige pas', () => {
    /* Le cas observe : une quantite a dix puissance vingt-six arrivee par la
       porte que rien ne bornait. Elle ne devient ni zero ni le plafond — l'un
       et l'autre seraient une donnee inventee — elle se nomme. */
    Fixture.poser();
    const s = structuredClone(Store.state);
    s.positions[0].qty = 4.9928e26;
    const marques = signalerInvalides(s);
    eq(marques.length, 1, 'une seule ligne est marquée');
    eq(marques[0].chemin, 'positions.0.qty', 'et c’est la bonne');
    eq(marques[0].valeur, 4.9928e26, 'avec sa valeur telle qu’elle est');
    eq(s.positions[0].qty, 4.9928e26, 'la donnée n’a pas bougé');
    eq(signalerInvalides(Fixture.etat()).length, 0, 'et la graine saine ne marque rien');
    /* La porte d'entree du modele l'appelle : chargement, import et cloud
       passent tous par migrate(). */
    const st = lireSource('assets/store.js');
    vrai(/s\.meta\.aVerifier = signalerInvalides\(s\);/.test(st), 'migrate() pose la liste');
  });

  test('les deux portes de saisie refusent avec calme, champ nommé', () => {
    const a = app();
    vrai(/!nombreValide\(\$\(`#f_\$\{c\.cle\}`\)\?\.value, c\.genre \|\| genreDeCle\(c\.cle\)\)/.test(a),
      'la fenêtre lit la valeur BRUTE, pas celle que num() a déjà mise à zéro');
    vrai(/cette valeur semble anormalement élevée, vérifie le montant saisi/.test(a),
      'et le message reste calme');
    vrai(/f\.type === 'number' && !nombreValide\(f\.value, genreDuChemin\(path\)\)/.test(a),
      'la page refuse de la même façon');
    vrai(/min="\$\{b\.min\}" max="\$\{b\.max\}"/.test(a), 'et le champ annonce ses bornes au navigateur');
    for (const k of ['cette valeur semble anormalement élevée, vérifie le montant saisi',
                     'Une valeur semble incorrecte', 'à vérifier'])
      vrai(!!I18N.en[k], `« ${k} » est traduite`);
  });

  test('graphiques et insights ne lisent pas une valeur à vérifier', () => {
    const ch = lireSource('assets/charts.js');
    vrai(/totals\.filter\(Number\.isFinite\)/.test(ch), 'l’échelle ignore ce qui n’est pas fini');
    const ins = lireSource('assets/insights.js');
    vrai(/if \(typeof aVerifier === 'function' && aVerifier\(\)\.length\) return \[\];/.test(ins),
      'zéro insight tant qu’une valeur est à vérifier');
    /* Un point non fini rend l'echelle infinie et ecrase toutes les autres
       valeurs sur l'axe : on refuse de le dessiner plutot que de le laisser
       dessiner les autres a zero. */
    vrai(/const fini = v => Number\.isFinite\(v\) \? v : 0;/.test(ch), 'et le point lui-même vaut zéro au dessin');
  });

  test('la carte de signalement mène là où l’on corrige', () => {
    const a = app();
    const d = a.indexOf('function carteAVerifier()');
    const c = a.slice(d, a.indexOf('\nfunction ', d + 1));
    vrai(/if \(!liste\.length\) return '';/.test(c), 'invisible quand tout est sain');
    vrai(/data-action="\$\{o\.action\}"/.test(c) && /open-position/.test(c),
      'une ligne de titres ouvre sa fiche');
    vrai(/\$\{carteAVerifier\(\)\}/.test(a), 'et la carte est posée sur l’Aperçu');
    vrai(/aVerifier\(\)\.length \? `<span class="muted">· \$\{trad\('à vérifier'\)\}<\/span>` : ''/.test(a),
      'le grand chiffre dit qu’il est à vérifier');
  });

  test('un grand montant tient dans une colonne étroite sans écraser le nom', () => {
    eq(fmtEURCompact(999999).length > 5, true, 'sous le million, la forme pleine');
    vrai(/M/.test(fmtEURCompact(1250000)), 'au-dessus, la forme compacte');
    const css = lireSource('assets/styles.css');
    vrai(/\.ml-chiffres \{\s*\n\s*flex: none; min-width: 0; max-width: 60%;/.test(css),
      'la colonne des chiffres ne prend jamais plus de soixante pour cent');
    vrai(/\.ml-chiffres b \{ overflow-wrap: anywhere;/.test(css), 'et un nombre long se replie');
    vrai(/valeur: fmtEURCompact\(v\),/.test(app()), 'la ligne de titres s’en sert');
  });
});

finDePartieDeTests('tests/01-socle.tests.js');
