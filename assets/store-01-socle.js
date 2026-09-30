/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const MODE_KEY   = 'wealth-dashboard:mode';

/* LA PORTEE DU STOCKAGE LOCAL, ET POURQUOI ELLE EXISTE.

   Une seule cle `wealth-dashboard:v1` par navigateur suffisait tant qu'un
   navigateur ne servait qu'une personne. Des que des comptes existent, la
   deuxieme qui se connecte ouvre le patrimoine de la premiere et l'ecrase en
   enregistrant. Ce n'est pas une gene d'affichage, c'est une fuite entre
   comptes.

   La portee est l'identifiant stable du compte, jamais l'adresse : changer
   d'adresse ne doit ni perdre ni reaffecter un patrimoine. Elle est filtree
   parce qu'elle entre dans un nom de clef.

   Vide, les clefs gardent leur nom d'origine : une instance a un seul
   proprietaire ne voit pas ses donnees demenager parce qu'on a deploye une
   version plus recente. */
let STORAGE_SCOPE = '';

function setStorageScope(scope) {
  STORAGE_SCOPE = String(scope || '').replace(/[^a-zA-Z0-9_-]/g, '');
}
const cleParUtilisateur = cle => STORAGE_SCOPE ? `${cle}:user:${STORAGE_SCOPE}` : cle;

const cleMode = () => cleParUtilisateur(MODE_KEY);
const CLE_REELLE = 'wealth-dashboard:v1';
const CLE_DEMO   = 'wealth-dashboard:demo';

function modeDemo() {
  try { return localStorage.getItem(cleMode()) === 'demo'; } catch (e) { return false; }
}
function setModeDemo(on) {
  try { on ? localStorage.setItem(cleMode(), 'demo') : localStorage.removeItem(cleMode()); }
  catch (e) {}
}
const cleStockage = () => cleParUtilisateur(modeDemo() ? CLE_DEMO : CLE_REELLE);

/* La demonstration a-t-elle vieilli chez ce visiteur ?

   La graine ne joue qu'au premier lancement, donc un visiteur revenu garde sa
   copie et ne voit jamais les corrections. On compare la version rangee dans
   son etat a celle du fichier.

   Ce depot EST la demonstration : la question ne se pose que pour lui, et le
   garde-fou est double. `SEED_VERSION` n'existe que dans la graine de ce
   fork, et rejouer une graine sur de vraies donnees serait une perte seche —
   d'ou le refus explicite si un mot de passe protege le site, signe qu'on
   n'est plus sur une demonstration. La proposition se fait par une banniere :
   on ne remplace jamais un etat sans le demander, la regle de la maison. */
function demoPerimee() {
  if (typeof SEED_VERSION === 'undefined') return false;
  const etat = Store.state;
  if (!etat || !estDeclare(etat.seedVersion)) return false;
  return num(etat.seedVersion) < SEED_VERSION;
}

function rechargerDemo() {
  Store.state = structuredClone(SEED);
  Store.migrate();
  refreshAccounts();
  Store.save();
}

/* --- LA DEMONSTRATION SE TIENT A JOUR --------------------------------------
   Le serveur calcule les mois ecoules depuis la graine (voir `DemoVivante`
   dans `_worker.js`) ; cette fonction les pose dans l'etat, pour qu'aucune
   saisie ne soit jamais reclamee au visiteur.

   Seule une copie de la graine est concernee, avec la meme garde que
   `demoPerimee` : `SEED_VERSION` n'existe que dans la graine de la
   demonstration, et un etat sans numero n'est pas ne d'elle. Le depot prive et
   la beta n'executent donc jamais ce chemin.

   CE QUE LE VISITEUR A TOUCHE RESTE A LUI. Un montant, un releve ou un mois de
   depenses n'est reecrit que s'il est encore celui que la demonstration avait
   pose : vide, identique a la graine, ou identique a ce qu'elle a ecrit la fois
   d'avant, dont elle garde la trace dans `auto`. Un solde corrige a la main
   perd cette egalite, et la demonstration ne le touche plus. Un releve, lui,
   ne se reecrit jamais : seul un mois vide se remplit. */
function estDemoVivante() {
  return typeof SEED_VERSION !== 'undefined' && !!Store.state
    && estDeclare(Store.state.seedVersion);
}

/* L'ETIQUETTE « EXEMPLE FICTIF » : sur la demonstration publique seulement,
   celle qui porte `SEED_VERSION` et un etat issu de sa graine. Le mode exemple
   d'une vraie instance a deja son bandeau, qui dit la meme chose avec une
   porte de sortie ; les deux ensemble se repeteraient. */
const etiquetteDemoVisible = () => estDemoVivante() && !modeDemo();

function appliquerDemoVivante(p) {
  if (!p || !Array.isArray(p.mois) || !Array.isArray(p.depenses) || !p.base) return null;
  const s = Store.state;
  const bilan = { soldes: 0, releves: 0, depenses: 0 };
  const intact = (valeur, auto, base) =>
    auto !== undefined ? num(valeur) === num(auto) : num(valeur) === num(base);

  if (p.soldes) {
    for (const [id, montant] of Object.entries(p.soldes)) {
      const c = compteById(id);
      const parts = (c && c.cash) || [];
      if (parts.length !== 1) continue;
      const e = parts[0];
      if (!intact(e.montant, e.auto, p.base.soldes[id])) continue;
      e.montant = montant;
      e.auto = montant;
      if (num(montant) !== 0) e.saisiLe = p.dates.saisiLe;
      bilan.soldes++;
    }
  }
  if (p.dette) {
    for (const et of s.etabs || []) {
      const d = (et.dettes || []).find(x => x.id === p.dette.id);
      if (!d || !intact(d.montant, d.auto, p.base.dette.montant)) continue;
      d.montant = p.dette.montant;
      d.auto = p.dette.montant;
      d.verifieLe = p.dates.verifieLe;
    }
  }
  for (const [id, date] of Object.entries(p.dates.estimeLe || {})) {
    for (const l of (compteById(id)?.lignes || [])) {
      if (l.estimeLe && l.estimeLe !== l.autoEstime) continue;
      l.estimeLe = date;
      l.autoEstime = date;
    }
  }

  const remplacable = r => !r || rowIsEmpty(r);
  const ancien = r => Object.values(p.anciennesPoches || {}).some(k => k in (r.v || {}));
  const aTitres = new Set((s.positions || []).map(x => x.account));
  const comptes = ACCOUNTS.filter(a => !a.legacy);
  const titresDe = id => holdingsValue(id);
  const aEcrire = p.mois.filter(m => remplacable(s.monthly.find(r => r.date === m.date)));
  const avant = s.monthly.filter(r => !rowIsEmpty(r) && aEcrire.length
    && r.date < aEcrire[0].date).pop();
  const titresAvant = id => {
    if (!avant) return titresDe(id);
    if (avant.autoTitres && avant.autoTitres[id] != null) return num(avant.autoTitres[id]);
    return ancien(avant) && avant.v[id] != null ? num(avant.v[id]) : titresDe(id);
  };
  aEcrire.forEach((m, i) => {
    const dernier = m === p.mois[p.mois.length - 1];
    const f = (i + 1) / aEcrire.length;
    const v = {}, autoTitres = {};
    for (const a of comptes) {
      const c = compteById(a.id);
      const ouvert = !c || c.statut !== 'archive';
      let montant;
      if (dernier) montant = nowValue(a.id);
      else {
        const cash = c ? cashCompte(c) : 0;
        const titres = aTitres.has(a.id)
          ? titresAvant(a.id) + (titresDe(a.id) - titresAvant(a.id)) * f : 0;
        const autres = nowValue(a.id) - cash - (aTitres.has(a.id) ? titresDe(a.id) : 0);
        montant = (m.soldes[a.id] != null ? num(m.soldes[a.id]) : cash) + autres + titres;
        if (aTitres.has(a.id)) autoTitres[a.id] = Math.round(titres);
      }
      if (aTitres.has(a.id) && dernier) autoTitres[a.id] = Math.round(titresDe(a.id));
      if (montant || ouvert) v[a.id] = Math.round(montant);
    }
    const ligne = { date: m.date, comment: m.commentaire || '',
      dettes: dernier ? Math.round(patrimoine().dettes) : m.dette, v, autoTitres };
    const j = s.monthly.findIndex(r => r.date === m.date);
    if (j >= 0) s.monthly[j] = ligne;
    else s.monthly.splice(indexTrie(s.monthly, m.date, r => r.date), 0, ligne);
    bilan.releves++;
  });

  const b = s.budget;
  const deLaGraine = k => (SEED.budget?.expenses || []).find(r => r.month === k);
  const signatureDep = r => JSON.stringify(r.v || {});
  for (const d of p.depenses) {
    const j = b.expenses.findIndex(r => r.month === d.month);
    const r = j >= 0 ? b.expenses[j] : null;
    const graine = deLaGraine(d.month);
    const libre = !r || !Object.values(r.v || {}).some(x => num(x) !== 0)
      || (!!r.auto && r.auto === signatureDep(r))
      || (!r.auto && graine && signatureDep(r) === signatureDep(graine));
    if (!libre) continue;
    const ligne = { month: d.month, note: d.note || '', v: { ...d.v } };
    ligne.auto = signatureDep(ligne);
    if (j >= 0) b.expenses[j] = ligne;
    else b.expenses.splice(indexTrie(b.expenses, d.month, x => x.month), 0, ligne);
    bilan.depenses++;
  }

  const [an, moisCourant] = p.jour.split('-').map(Number);
  for (let m = moisCourant + 1; m <= 12; m++) {
    const k = `${an}-${String(m).padStart(2, '0')}-01`;
    if (!s.monthly.some(r => r.date === k))
      s.monthly.splice(indexTrie(s.monthly, k, r => r.date), 0, { date: k, comment: '', v: {} });
    if (!b.expenses.some(r => r.month === k))
      b.expenses.splice(indexTrie(b.expenses, k, r => r.month), 0, { month: k, note: '', v: {} });
  }

  s.meta.demoAJour = p.jour;
  refreshAccounts();
  return bilan;
}

function indexTrie(table, cle, lire) {
  const i = table.findIndex(x => String(lire(x)) > cle);
  return i < 0 ? table.length : i;
}
/* La vue apprend que l'ecriture a echoue, ou qu'elle remarche.

   Une fonction plutot qu'un evenement : le modele ne connait pas le DOM, et
   `app.js` la remplace au chargement. Sans lui, le modele reste utilisable seul
   — c'est ce que fait le harnais de tests, qui ne charge pas la vue. */
let signalerEcriture = () => {};
const poserSignalEcriture = fn => { signalerEcriture = fn; };

const BACKUP_KEY = 'wealth-dashboard:backups';
const cleSauvegardes = () => cleParUtilisateur(BACKUP_KEY);
const UNDO_LIMIT = 40;
const BACKUP_LIMIT = 8;

let ACCOUNTS = SEED_ACCOUNTS;
let ACC = Object.fromEntries(ACCOUNTS.map(a => [a.id, a]));
let HOLDING_ACCOUNTS = ACCOUNTS.filter(a => a.holdings).map(a => a.id);

const AFFECTATIONS = [
  ['courant',    trad('Cash disponible')],
  ['precaution', trad('Épargne de précaution')],
  ['projet',     trad('Projet prévu')],
  ['investir',   trad('Cash à investir')],
];
const AFFECTATION_LABEL = Object.fromEntries(AFFECTATIONS);

/* ============================================================
   LES BASES DE CALCUL, NOMMEES UNE FOIS
   ============================================================
   Sept montants differents circulaient sous des noms flottants : « Investi »
   designait deux grandeurs (le brut moins le cash, et le prix de revient du
   portefeuille), « Total investi » et « Total investissements » designaient la
   meme, et « Total de vos avoirs » cotoyait « patrimoine brut » et
   « patrimoine net » pour deux montants distincts. Un lecteur ne pouvait pas
   savoir si deux chiffres parlaient de la meme chose.

   Un montant, un nom, partout. `de` porte la forme grammaticale des mentions
   « en % de … », que le francais ne deduit pas du nom.

   AVOIRS et NET restent deux entrees : ils ne coincident que sans credit.
   Les fondre en un seul mot est exactement la faute que ce projet a payee
   d'une demi-journee, « Patrimoine total » affichant le net.

   LE CASH N'A QU'UNE HISTOIRE, ET ELLE EST HIERARCHIQUE.
   « Liquidites » nomme le tout ; dedans, les quatre affectations, et rien
   d'autre. Aucun agregat intermediaire n'a de nom, parce qu'aucun n'a besoin
   d'exister : chaque ecran montre soit le tout, soit les poches. C'est ce qui
   garantit que trois ecrans racontent la meme chose — avant, Allocation
   agregeait courant + precaution + projet sous « Argent disponible », un
   montant que l'accueil ne connaissait pas et qui portait presque le nom
   d'une de ses propres parts.
   Les noms des poches viennent d'AFFECTATIONS : une seule source, un seul
   endroit a modifier. */
const BASES = {
  avoirs:      { nom: trad('Tes avoirs'),         de: trad('de tes avoirs') },          // brut
  net:         { nom: trad('Patrimoine net'),     de: trad('de ton patrimoine net') },   // brut - dettes
  avoirsFinanciers: { nom: trad('Avoirs financiers'),
                      de: trad('de tes avoirs financiers') },
  netFinancier:     { nom: trad('Patrimoine financier net'),
                      de: trad('de ton patrimoine financier net') },
  place:       { nom: trad('Placements'),         de: trad('de tes placements') },  // nowTotals().invested
  placeBourse: { nom: trad('Placé en bourse'),    de: trad('de ce qui est placé en bourse') },
  baseCibles:  { nom: trad('Base de tes cibles'), de: trad('de la base de tes cibles') },
  liquidites:  { nom: trad('Liquidités'),         de: trad('de tes liquidités') },      // la classe : quatre poches et supports monetaires
  cashDispo:   { nom: AFFECTATION_LABEL.courant,    de: trad('du cash disponible') },
  precaution:  { nom: AFFECTATION_LABEL.precaution, de: trad('de l’épargne de précaution') },
  projet:      { nom: AFFECTATION_LABEL.projet,     de: trad('du cash de projet') },
  cashPlacer:  { nom: AFFECTATION_LABEL.investir,   de: trad('du cash à investir') },
};

const mentionBase = (base, montant) => `${trad('en %')} ${base.de} · ${fmtEUR0(montant)}`;

/* Les quatre poches de liquidites, dans l'ordre d'AFFECTATIONS, avec leur
   montant. Une seule fonction pour les trois ecrans qui les affichent. Leur
   somme plus `liquiditesEnLignes()` fait `nowByGroup().cash` — c'est teste. */
function pochesLiquidites() {
  const p = patrimoine();
  return AFFECTATIONS.map(([cle, nom]) => ({ cle, nom, value: num(p[cle]) }));
}

/* Les liquidites qui ne sont pas des especes : les lignes de classe
   `liquidites`, un ETF monetaire ou un support de tresorerie. Elles n'ont pas
   d'affectation, donc aucune des quatre poches ne les porte ; la classe, si.
   Ce qui separe les deux est ce nombre, et un ecran qui detaille "Liquidites"
   par ses poches l'ajoute comme une ligne a part, sinon ses parts ne refont
   pas son total. */
const LIBELLE_LIQUIDITES_EN_LIGNES = 'Supports monétaires';
function liquiditesEnLignes(p = patrimoine()) {
  const reste = num(p.classes.liquidites)
    - AFFECTATIONS.reduce((s, [cle]) => s + num(p[cle]), 0);
  return Math.abs(reste) > 0.005 ? round2(reste) : 0;
}

const CLASSES_ACTIFS = {
  liquidites:  trad('Liquidités'),
  actions:     trad('Actifs de marché'),
  obligations: trad('Obligations'),
  garanti:     trad('Capital garanti'),
  crypto:      trad('Cryptomonnaies'),
  nonCote:     trad('Non coté'),
  immobilier:  trad('Immobilier'),
  bienValeur:  trad('Bien de valeur'),
};

const MOBILISABLE_LABEL = {
  immediat: 'Disponible immédiatement',
  differe:  'Disponible sous quelques jours',
  lent:     'Disponible en quelques mois',
  habite:   'Le logement que tu habites',
  bloque:   'Inaccessible avant l’échéance',
};

/* Le type de compte déduit les classes ajoutables et pré-remplit
   l'affectation du cash — il ne contraint jamais l'utilisateur, et les
   poches ne se calculent jamais dessus. `dateSensible` : la date
   d'ouverture donne l'anciennete de l'enveloppe, dont dependent des seuils
   fiscaux (cinq ans pour un PEA, huit pour une assurance-vie) ; elle est donc
   demandee des la creation pour ces types-la. Elle ne change jamais le delai
   de vente d'une ligne : `mobilisabilite()` ne la lit pas.

   DEUX QUESTIONS QUI NE SE CONFONDENT PAS. Le delai de vente est celui de
   l'actif -- une action se vend en seance, un studio en quelques mois -- et
   `disponibilite` ne le rallonge que pour une enveloppe qui bloque vraiment
   l'argent (le PER jusqu'a la retraite). `retrait` dit les conditions de
   retrait de l'enveloppe, qui sont fiscales la plupart du temps : la fiche les
   ecrit en toutes lettres, a part du delai. `pretSurTitres` : un courtier peut
   y preter sur les titres detenus, et la fiche propose alors de declarer ce
   credit ; nulle part ailleurs ce discours n'a de raison d'etre. */
const TYPES_COMPTE = [
  { id: 'courant', label: 'Compte courant', classes: ['liquidites'], defaut: 'courant',    groupe: 'cash' },
  { id: 'livret',  label: 'Livret',         classes: ['liquidites'], defaut: 'precaution', groupe: 'cash' },
  { id: 'pea',     label: 'PEA',            classes: ['liquidites', 'actions'], defaut: 'investir', groupe: 'bourse', titres: true, dateSensible: true, pays: 'fr',
    retrait: 'Avant 5 ans, un retrait clôture le plan, sauf exceptions prévues par la loi ; après 5 ans, tu peux retirer sans le clôturer. Vendre une ligne du plan, elle, se fait en séance.' },
  { id: 'cto',     label: 'Compte-titres (CTO)', classes: ['liquidites', 'actions', 'obligations'], defaut: 'investir', groupe: 'bourse', titres: true, pretSurTitres: true },
  /* Une enveloppe, et non un compte-titres. Ces deux-la portent tout ce que le
     contrat propose : un ETF monde qui cote, un fonds euros qui ne cote nulle
     part, une SCPI, un fonds maison sans ISIN. D'ou deux differences avec un
     CTO.

     La liste des classes va donc jusqu'a l'immobilier et au non cote : sans
     `immobilier`, `comptesPourCategorie()` n'offrait jamais l'assurance-vie a
     qui ajoute une SCPI, et la part restait sans domicile.

     `melange` dit que `titres` n'est pas exclusif ici. Ailleurs, un compte qui
     porte des titres ne porte que des titres, et sa fiche renvoie a Marches ou
     les cours arrivent seuls. Sur un contrat, la moitie des supports n'a pas de
     cours a aller chercher : il faut les deux portes sur la meme fiche.

     `sansCash` : il n'y a pas de « cash a investir » sur un contrat. L'argent
     verse est sur un support des son arrivee, au pire le fonds euros, et
     proposer les quatre affectations y inventait une poche qui n'existe pas —
     comptee ensuite dans les liquidites de l'accueil et dans les paliers
     d'autonomie. Le drapeau ne touche pas a `classes` : « liquidites » y sert
     aussi a accepter un support monetaire, qui est un placement et non du cash.
     Deux choses sous un seul mot, d'ou deux reglages. */
  { id: 'av',      label: 'Assurance-vie',  classes: ['liquidites', 'garanti', 'actions', 'obligations', 'immobilier', 'nonCote'], defaut: 'investir', groupe: 'bourse', titres: true, melange: true, sansCash: true, dateSensible: true, pays: 'fr',
    retrait: 'Un rachat est possible à tout moment et arrive en quelques jours à quelques semaines ; le seuil des 8 ans ne change que l’impôt sur les gains.' },
  { id: 'per',     label: 'Plan d’épargne retraite (PER)', classes: ['liquidites', 'garanti', 'actions', 'obligations', 'immobilier', 'nonCote'], defaut: 'investir', groupe: 'bourse', titres: true, melange: true, sansCash: true, disponibilite: 'bloque', rubrique: 'retraite', pays: 'fr',
    retrait: 'Bloqué jusqu’à la retraite, sauf cas de déblocage anticipé prévus par la loi, comme l’achat de ta résidence principale. Sa valeur s’entend avant l’impôt éventuel dû à la sortie.' },
  /* ENVELOPPES AMERICAINES. Quatre contenants, pas une fiscalite : aucun seuil
     d'age, aucun plafond, aucune penalite, aucun abondement n'entre ici. Ce
     sont des enveloppes de placement comme celles qui existent, et elles
     reutilisent leurs classes.

     Le 401(k) est un plan de fonds : on y choisit des supports, il n'y a pas
     de poche de cash a investir, et un fonds stable y tient lieu de garanti,
     d'ou la forme du PER (`melange`, `sansCash`). Il est chez un teneur de
     compte, pas chez un assureur : `contenant` le declare, sinon `melange`
     l'aurait envoye chez un « assureur ou courtier ».

     Les deux IRA sont des comptes de courtage : la forme du CTO. Le HSA aussi,
     avec son cash en reserve par defaut : c'est une epargne de sante avant
     d'etre un placement, et son affectation reste modifiable.

     `disponibilite: 'lent'` sur les trois enveloppes de retraite dit ce qui est
     vrai sans modeler la regle : cet argent se casse, en quelques semaines et
     avec une decote. Un PER, lui, est ferme (`bloque`). Le HSA suit ses classes.
     `rubrique` ne sert qu'au selecteur : elle range, elle ne calcule rien. */
  { id: 'us401k',  label: '401(k)',          classes: ['liquidites', 'garanti', 'actions', 'obligations'], defaut: 'investir', groupe: 'bourse', titres: true, melange: true, sansCash: true, disponibilite: 'lent', contenant: 'banque', rubrique: 'retraite', pays: 'us' },
  { id: 'traditionalIra', label: 'Traditional IRA', classes: ['liquidites', 'actions', 'obligations'], defaut: 'investir', groupe: 'bourse', titres: true, disponibilite: 'lent', rubrique: 'retraite', pays: 'us' },
  { id: 'rothIra', label: 'Roth IRA',        classes: ['liquidites', 'actions', 'obligations'], defaut: 'investir', groupe: 'bourse', titres: true, disponibilite: 'lent', rubrique: 'retraite', pays: 'us' },
  { id: 'hsa',     label: 'HSA',             classes: ['liquidites', 'actions', 'obligations'], defaut: 'precaution', groupe: 'bourse', titres: true, rubrique: 'retraite', pays: 'us' },
  { id: 'crypto',  label: 'Portefeuille de cryptomonnaies', classes: ['crypto'], defaut: 'investir', groupe: 'bourse', titres: true, pretSurTitres: true },
  /* Deux metiers que le mot crowdfunding melange, et qui n'ont pas les memes
     champs. On prete, ou on prend des parts.

     Placements non cotes : on achete une part de societe. Plateforme A, Plateforme B
     en capital, un pacte d'associes, des parts de SAS. Pas d'echeance, pas de
     taux : on sort le jour d'un rachat, d'une introduction en bourse, ou jamais.

     Pret participatif : on prete a un taux, avec une date de remboursement. Les
     plateformes de pret, la promotion immobiliere. Ce sont ces lignes-la qui
     portent une echeance, un taux annonce et un etat -- en cours, en retard, en
     defaut -- et c'est `prete: true` qui le dit, plutot qu'une liste de types
     ecrite dans la vue.

     Financement participatif serait un nom trompeur : au sens courant, des
     actions achetees sur une plateforme de crowdfunding en relevent aussi. Le
     mot couvre les deux metiers et n'en nomme qu'un, si bien que des parts
     sembleraient devoir aller la -- ou l'application reclamerait une echeance
     et un taux qui n'existent pas, et pourrait declarer en retard une ligne qui
     n'a rien a rembourser.

     L'anglais dit Crowdlending, precis. Parts contre pret : la distinction se lit
     en un coup d'oeil, et l'axe du modele apparait -- Longward ne separe pas par
     plateforme mais par ce qu'on detient. */
  /* « Parts de société » et non « Placements non cotés » : ce dernier est le nom
     de la CLASSE `nonCote`, et un type de compte qui le reprenait faisait porter
     le meme libelle a deux montants differents sur le meme ecran. La carte
     « Par enveloppe » lisait 11 100 EUR sous ce nom, la carte des classes
     11 600 EUR sous le meme — l'ecart etant le compte de financement
     participatif, qui est du non cote lui aussi.

     Le calcul etait juste des deux cotes. C'est le nom du contenant qui mentait,
     et c'est exactement ce que ce projet s'interdit : un libelle, un montant.

     Un type nomme donc ce qu'on ouvre, une classe ce qu'on detient. « Parts de
     societe » fait la paire avec « Pret participatif » : l'un est du capital,
     l'autre du pret, et tous deux se rangent dans le non cote. */
  /* `parts` : ce qu'on y detient se compte en titres, pas seulement en euros.
     Le drapeau vit sur le type plutot que dans la vue, comme `prete` et
     `titres` : un autre type qui se diviserait en parts le declarera ici. */
  /* `terminal` : le compte EST le placement, il n'en contient pas d'autres.

     Sans ce drapeau, la fiche d'une participation portait une carte
     « Placements detenus » ou figurait la participation elle-meme, sous son
     propre nom : un actif qui se contient lui-meme, et un « + Placement » qui
     invitait a en ranger un second dedans. `direct` dit la meme chose pour ce
     qu'on detient physiquement ; celui-ci le dit pour ce qui est detenu par un
     tiers mais ne se subdivise pas. */
  { id: 'pe',      label: 'Parts de société', classes: ['nonCote'], defaut: 'investir', groupe: 'pe', parts: true, terminal: true, estimee: true },
  /* `vl` : sa valeur ne s'estime pas, elle se PUBLIE. C'est la difference qui
     vaut un type a part plutot qu'un rangement dans « Parts de societe ».

     Une part de societe, on la valorise soi-meme — une levee, un pacte, une
     offre de rachat — et l'application rappelle d'y revenir une fois l'an, comme
     pour une montre. Un fonds publie une valeur liquidative a sa cadence, et
     celle-ci se perime au rythme de cette cadence : une VL mensuelle a un an est
     douze fois depassee. Le rappel suit donc la cadence declaree, et c'est tout
     l'objet du drapeau.

     Le nom dit la STRUCTURE et non le theme. « Private equity » aurait ete plus
     reconnaissable et plus faux : ces fonds vont du capital-risque a
     l'infrastructure, et le meme contenant les porte tous. */
  { id: 'fondsNonCote', label: 'Fonds non coté', classes: ['nonCote'],
    defaut: 'investir', groupe: 'pe', parts: true, terminal: true, vl: true },
  { id: 'crowdfunding', label: 'Prêt participatif', classes: ['nonCote'],
    defaut: 'investir', groupe: 'pe', prete: true, terminal: true },
  /* `direct` : on le detient soi-meme, le contenant EST la chose.

     `bienImmo` : ce type EST un bien immobilier, il ne fait pas qu'en porter.
     La distinction manquait, et « peut porter de l'immobilier » lui servait de
     tenant-lieu : le jour ou une assurance-vie accepte une SCPI, le contrat
     entier devenait un bien, avec le vocabulaire qui va avec — « Dans quel bien
     le ranger ? » pour un contrat d'assurance. Un fait qui commande trois
     ecrans se declare, il ne se devine pas d'un effet de bord. */
  /* « Bien immobilier » et non « Immobilier » : ce dernier est le nom de la
     CLASSE `immobilier`, que ce type partage avec les SCPI. Deux enveloppes pour
     une classe, et l'une portait le nom de la classe : la carte « Par enveloppe »
     aurait affiche le seul bien sous un intitule que la carte des classes
     employait pour le bien ET les SCPI. Le meme defaut que « Placements non
     cotes », trouve par le test qui interdisait le premier. */
  { id: 'immo',    label: 'Bien immobilier', classes: ['immobilier'], defaut: 'investir',
    groupe: 'pe', direct: true, bienImmo: true },
  { id: 'scpi',    label: 'SCPI',           classes: ['immobilier'], defaut: 'investir', groupe: 'pe', bienImmo: true, pays: 'fr' },
  /* Les billets dans un portefeuille. C'est le seul argent que personne ne
     tient pour vous : pour le noter, il fallait inventer une banque appelee
     « Espèces », et se demander pourquoi l'application reclamait un
     etablissement pour un billet de cinquante.

     `sansEtab` dit qu'il n'a pas de contenant, `interne` qu'on ne le choisit
     pas dans une liste : il existe pour tout le monde, une fois, pose par
     `poserEspeces()`. Dernier de la liste, donc dernier groupe a l'ecran —
     c'est la plus petite ligne d'un patrimoine, elle occupait la place
     d'honneur. */
  /* Un bien de valeur ne se tient nulle part : il est chez soi.

     `sansEtab` comme les especes — il fallait sinon inventer un etablissement
     appele d'apres l'objet lui-meme, et se demander pourquoi l'application reclame une
     banque pour un objet pose sur une etagere. Mais pas `interne` : les especes
     existent une fois pour tout le monde, la ou l'on ajoute autant de biens
     qu'on en possede. Il se choisit donc dans la liste des types.

     Groupe `pe` : c'est ce qui n'est ni du cash ni de la bourse. Le groupe
     commande les regroupements d'ecran, pas les calculs. */
  { id: 'bienValeur', label: 'Bien de valeur', classes: ['bienValeur'],
    defaut: 'investir', groupe: 'pe', sansEtab: true, direct: true },
  { id: 'especes', label: 'Espèces',        classes: ['liquidites'], defaut: 'courant', groupe: 'cash',
    sansEtab: true, interne: true },
];

function typeCompte(id) {
  return TYPES_COMPTE.find(t => t.id === id)
      || typesPerso().find(t => t.id === id)
      || { id, label: id || 'Autre', classes: ['nonCote'], defaut: 'investir', groupe: 'pe' };
}

/* Un type que la table ne connait pas : cree par son detenteur, il vit dans
   l'etat et non dans TYPES_COMPTE — la table dit le modele, `typesPerso` dit
   ce qu'un patrimoine particulier a eu besoin d'ajouter. Sa forme se derive
   de la poche, parce que c'est elle qui commande calculs et regroupements ;
   le nom ne fait que nommer. */
function typesPerso() { return Store.state?.typesPerso || []; }

const FORME_POCHE = {
  cash:   { classes: ['liquidites'], defaut: 'courant' },
  bourse: { classes: ['liquidites', 'actions', 'obligations'], defaut: 'investir', titres: true },
  pe:     { classes: ['nonCote'], defaut: 'investir' },
};

function typesCompteChoix() {
  return [...TYPES_COMPTE.filter(t => !t.interne), ...typesPerso()];
}

/* LE SELECTEUR SE LIT PAR RUBRIQUES. Dix-sept types en une seule liste, c'est
   une liste qu'on ne lit plus. Quatre rubriques les rangent, dans l'ordre ou
   un patrimoine se construit : la banque, les placements, la retraite et
   l'epargne avantagee, les biens. La rubrique se derive du groupe, sauf la ou
   le type la declare (`rubrique`) : un PER ou un 401(k) est du groupe des
   placements, mais on le cherche a la retraite. Un type personnel suit son
   groupe. Rien ici ne calcule : c'est un rangement d'ecran. */
const RUBRIQUES_TYPE = [
  ['banque',     'Comptes bancaires'],
  ['placements', 'Investissements'],
  ['retraite',   'Retraite et épargne avantagée'],
  ['biens',      'Biens et autres'],
];
const rubriqueDuType = t => t.rubrique
  || (t.groupe === 'cash' ? 'banque' : t.groupe === 'bourse' ? 'placements' : 'biens');

/* LE PAYS DU CONTEXTE, pour ranger les enveloppes nationales. Un PEA, une
   assurance-vie, un PER ou une SCPI n'existent qu'en France ; un 401(k), un
   IRA ou un HSA qu'aux Etats-Unis. Les types le disent (`pays`), et les autres
   sont de partout. Le contexte se lit sur la devise des que le detenteur l'a
   choisie -- c'est le fait le plus proche du pays que l'application connaisse
   -- et sur la langue avant ce choix, quand rien d'autre ne le dit. Rien ici
   n'interdit un type etranger : il descend dans une rubrique a part. */
const RUBRIQUE_AUTRES_PAYS = 'Autres pays';
function paysContexte() {
  const m = (Store.state && Store.state.meta) || {};
  if (m.deviseChoisie) return deviseBase() === 'USD' ? 'us' : 'fr';
  return typeof currentLang === 'function' && String(currentLang() || '').toLowerCase().startsWith('fr')
    ? 'fr' : 'us';
}
const typeDuContexte = (t, pays = paysContexte()) => !t.pays || t.pays === pays;
function typesCompteParRubrique() {
  const choix = typesCompteChoix();
  const pays = paysContexte();
  const rub = RUBRIQUES_TYPE
    .map(([cle, titre]) => [titre, choix.filter(t => typeDuContexte(t, pays) && rubriqueDuType(t) === cle)
      .map(t => [t.id, t.label])]);
  rub.push([RUBRIQUE_AUTRES_PAYS, choix.filter(t => !typeDuContexte(t, pays)).map(t => [t.id, t.label])]);
  return rub.filter(([, liste]) => liste.length);
}

function typeParDefautChez(etabId) {
  const dispo = new Set(typesCompteChoix().map(t => t.id));
  const repli = dispo.has('courant') ? 'courant' : (typesCompteChoix()[0]?.id || 'courant');
  if (!etabId) return repli;
  const vus = new Map();
  for (const c of COMPTES()) {
    if (c.etabId !== etabId || c.statut === 'archive' || !dispo.has(c.type)) continue;
    vus.set(c.type, (vus.get(c.type) || 0) + 1);
  }
  let meilleur = null;
  for (const [id, n] of vus) if (!meilleur || n >= meilleur[1]) meilleur = [id, n];
  return meilleur ? meilleur[0] : repli;
}

/* Rend l'identifiant du type, existant ou cree. Un nom deja porte est repris
   au lieu d'etre dedouble : deux types « Plan épargne logement » seraient deux
   poches pour le meme fait. Le prefixe `t_` garantit qu'un identifiant cree
   ici n'entrera jamais en collision avec un type que la table ajouterait
   plus tard. Pas de Store.save() : l'ecriture appartient a l'appelant,
   comme partout — c'est aussi ce qui rend cette fonction testable. */
function creerTypePerso(label, groupe) {
  const nom = String(label || '').trim();
  if (!nom) return null;
  const poche = FORME_POCHE[groupe] ? groupe : 'pe';
  const deja = [...TYPES_COMPTE, ...typesPerso()]
    .find(t => t.label.toLowerCase() === nom.toLowerCase());
  if (deja) return deja.id;
  const slug = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'type';
  const pris = x => TYPES_COMPTE.some(t => t.id === x) || typesPerso().some(t => t.id === x);
  let id = 't_' + slug, n = 2;
  while (pris(id)) id = 't_' + slug + '-' + (n++);
  Store.state.typesPerso = Store.state.typesPerso || [];
  Store.state.typesPerso.push({ id, label: nom, groupe: poche, ...FORME_POCHE[poche] });
  return id;
}

const estUnBien = t => !!t && !t.titres && t.groupe === 'pe';

/* Ce qu'on detient en direct : le contenant EST la chose.

   La frontiere s'est d'abord posee sur la classe, et c'etait faux : `immobilier`
   couvre a la fois un appartement et une SCPI, qui est du papier tenu par une
   societe de gestion. Deux types partagent une classe sans partager le mode de
   detention. Le drapeau `direct` vit donc sur le type, declare une fois dans
   `TYPES_COMPTE`, la ou vivent deja `sansEtab`, `prete` et `interne`. */
const estDetenuEnDirect = t => !!t && !!t.direct;
/* Une valeur que PERSONNE ne confirme : c'est le detenteur qui l'apprecie, et
   rien d'exterieur ne dit s'il a raison. Un bien detenu en direct (`direct`) et
   une participation non cotee (`estimee`) sont dans ce cas.

   Ce que ce drapeau n'est pas, et les trois s'etaient deja melanges : une VL
   publiee par une societe de gestion (`vl`) est un chiffre etabli par un tiers,
   pas une opinion ; un solde lu chez un teneur de compte est un fait ; le
   nominal d'un pret ne bouge pas tant qu'il n'est pas rembourse.

   Ce qui en depend : l'ecart affiche sous le montant. « +5 000 EUR depuis
   sept. » se lit comme une plus-value alors que c'est le detenteur qui a revu
   son propre chiffre entre deux releves, et les deux ne veulent pas dire la
   meme chose. La ligne annonce donc ce que le montant EST plutot que de
   comparer deux estimations. */
const estValeurEstimee = t => !!t && (!!t.direct || !!t.estimee);
/* Un actif terminal : le contenant EST la chose, il ne porte pas de sous-lignes.

   Deux facons de l'etre, et une seule question : ce qu'on detient soi-meme
   (`direct`, un appartement, une montre) et ce qu'un tiers detient pour nous
   sans que cela se subdivise (`terminal`, une participation, un pret). Un CTO
   ou une assurance-vie, eux, sont des contenants : plusieurs lignes y vivent, et
   c'est tout leur objet. */
const estActifTerminal = t => !!t && (!!t.direct || !!t.terminal);
const motDateCompte = t => trad(estUnBien(t) ? 'Date d’achat' : 'Date d’ouverture');

/* Le mot de ce dont on parle : bien, placement, compte, contrat ou plan.

   Il se derive des drapeaux du type (`direct`, `terminal`, `melange`) et
   de son contenant, pour qu'un type ajoute demain n'ait qu'une chose a
   declarer. */
const motCompte = t => trad(estDetenuEnDirect(t) ? 'bien'
  : estActifTerminal(t) ? 'placement'
  : t && t.melange ? (enContrat(t) ? 'contrat' : 'plan') : 'compte');

const titreActif = t => estDetenuEnDirect(t) ? 'Le bien' : 'Le placement';

/* `contenu` : le mot pour ce que le contenant abrite.

   Il vit dans cette table et nulle part ailleurs, avec les autres mots du
   contenant : la vue les lit tous les deux au meme endroit, donc ils ne peuvent
   pas se contredire. Une plateforme de financement participatif garde
   « compte » — Plateforme A en ouvre bien un. */
const CONTENANTS = {
  /* `teinte` : la couleur d'un etablissement vient de sa FAMILLE, pas de ce
     qu'il contient le mois ou on le regarde.

     Elle venait de la classe d'actif dominante en valeur, et une minorite
     pouvait peindre le tout : un courtier dont la plus grosse ligne est du non
     cote se lisait « societe » alors que sa propre fiche annoncait « Banque ou
     courtier » deux centimetres plus haut. Les mots et la couleur se
     contredisaient dans la meme carte. Pire, la couleur bougeait avec le
     marche : la ligne qui passe devant repeint l'etablissement.

     La famille, elle, se derive des TYPES de compte. Elle ne bouge pas quand un
     cours monte, et elle est deja ecrite au-dessus du nom.

     Le choix des teintes suit ce que chaque famille tient d'habitude, ce qui
     est demande : une banque garde l'azur des liquidites, une societe le rose
     du non cote, un bien le mauve de l'immobilier. Un contrat d'assurance prend
     le vert des multi-actifs, parce que c'est litteralement ce qu'il est : la
     famille n'existe que pour les enveloppes qui melangent. */
  bien:   { titre: 'Bien immobilier',    teinte: 'var(--series-4)',
            question: 'À quel bien le rattacher ?',
            aide: 'Un bien déjà enregistré, ou un nouveau.',
            exemple: 'ex. Studio Lyon 3e', nouveau: 'Nouveau bien',
            contenu: 'bien' },
  societe:{ titre: 'Société ou plateforme', teinte: 'var(--series-3)',
            question: 'À quelle société le rattacher ?',
            aide: 'Une société ou plateforme déjà enregistrée, ou une nouvelle.',
            exemple: 'ex. Plateforme A', nouveau: 'Nouvelle société ou plateforme',
            contenu: 'placement' },
  banque: { titre: 'Banque ou courtier', teinte: 'var(--series-1)',
            question: 'Dans quelle banque le tenir ?',
            aide: 'Une banque déjà enregistrée, ou une nouvelle.',
            exemple: 'ex. Ma banque en ligne', nouveau: 'Nouvelle banque ou courtier',
            contenu: 'compte' },
  /* Une assurance-vie ou un PER ne se tiennent pas « dans une banque ». Le
     contrat est chez un assureur, distribue par un courtier, parfois par une
     banque qui n'en est que le guichet : le nom qu'on reconnait et qu'on saisit
     ici est l'un des trois, et « banque » n'est pas le mot qui les couvre.
     `contenu` dit « contrat » pour la meme raison : on n'ouvre pas un compte
     chez un assureur, on souscrit. */
  assureur:{ titre: 'Assureur ou courtier', teinte: 'var(--series-8)',
            question: 'Chez qui le contrat est-il tenu ?',
            aide: 'Un organisme déjà enregistré, ou un nouveau.',
            exemple: 'ex. Linxea', nouveau: 'Nouvel assureur ou courtier',
            contenu: 'contrat' },
};

const majuscule = m => String(m || '').charAt(0).toUpperCase() + String(m || '').slice(1);

function motContenu(etabId, n) {
  const mot = contenantDeLEtab(etabId).contenu || 'compte';
  return trad(`${mot}${n > 1 ? 's' : ''}`);
}

const enContrat = t => contenantDuType(t.id).contenu === 'contrat';
const contenantDuType = typeId => {
  const t = typeCompte(typeId);
  if (t.contenant && CONTENANTS[t.contenant]) return CONTENANTS[t.contenant];
  return t.bienImmo ? CONTENANTS.bien
    : (typeId === 'pe' || typeId === 'crowdfunding') ? CONTENANTS.societe
    : t.melange ? CONTENANTS.assureur
    : CONTENANTS.banque;
};

function contenantDeLEtab(etabId) {
  const types = [...new Set(COMPTES().filter(c => c.etabId === etabId).map(c => c.type))];
  if (!types.length) return CONTENANTS.banque;
  const mots = [...new Set(types.map(t => contenantDuType(t).titre))];
  return mots.length === 1 ? contenantDuType(types[0]) : CONTENANTS.banque;
}

function ETABS() { return Store.state.etabs || []; }
function COMPTES() { return Store.state.comptes || []; }
const etabById = id => ETABS().find(e => e.id === id);
const compteById = id => COMPTES().find(c => c.id === id);
const comptesOuverts = () => COMPTES().filter(c => c.statut !== 'archive');

const CHAMPS_POSITION_FICHE = ['mobilite'];

function familleDeFiche(cle) {
  const [quoi, id] = String(cle).split(':');
  let etabId = null, seul = null;
  if (quoi === 'compte') {
    seul = compteById(id);
    if (!seul) return null;
    etabId = seul.etabId || null;
  } else if (quoi === 'etab') {
    if (!etabById(id)) return null;
    etabId = id;
  } else return null;
  const comptes = COMPTES().filter(c => c === seul || (etabId != null && c.etabId === etabId));
  const ids = new Set(comptes.map(c => c.id));
  return {
    etabs: etabId == null ? [] : ETABS().filter(e => e.id === etabId),
    comptes,
    positions: (Store.state.positions || []).filter(p => ids.has(p.account)),
  };
}

const clePositionFiche = p => p.id ? `id:${p.id}` : `rang:${Store.state.positions.indexOf(p)}`;

function instantaneFiche(cle) {
  const f = familleDeFiche(cle);
  if (!f) return null;
  const champs = p => Object.fromEntries(CHAMPS_POSITION_FICHE.map(k => [k, p[k] ?? null]));
  return {
    cle,
    etabs: Object.fromEntries(f.etabs.map(e => [e.id, JSON.stringify(e)])),
    comptes: Object.fromEntries(f.comptes.map(c => [c.id, JSON.stringify(c)])),
    positions: Object.fromEntries(f.positions.map(p => [clePositionFiche(p), champs(p)])),
  };
}

function ficheDiffere(inst) {
  if (!inst) return false;
  const maintenant = instantaneFiche(inst.cle);
  if (!maintenant) return false;
  return JSON.stringify([inst.etabs, inst.comptes, inst.positions])
    !== JSON.stringify([maintenant.etabs, maintenant.comptes, maintenant.positions]);
}

function retablirInstantane(inst) {
  if (!inst) return false;
  let fait = false;
  const remettre = (liste, copies) => {
    for (const [id, json] of Object.entries(copies)) {
      const i = liste.findIndex(x => x.id === id);
      if (i >= 0) { liste[i] = JSON.parse(json); fait = true; }
    }
  };
  remettre(ETABS(), inst.etabs);
  remettre(COMPTES(), inst.comptes);
  for (const [cle, champs] of Object.entries(inst.positions)) {
    const p = cle.startsWith('id:')
      ? Store.state.positions.find(x => x.id === cle.slice(3))
      : Store.state.positions[+cle.slice(5)];
    if (!p) continue;
    for (const [k, v] of Object.entries(champs)) {
      if (v == null) delete p[k]; else p[k] = v;
    }
    fait = true;
  }
  return fait;
}

function compteDeLInstantane(inst, id) {
  const json = inst && inst.comptes[id];
  if (!json) return null;
  try { return JSON.parse(json); } catch (e) { return null; }
}

const nomCompteV2 = c => c.libelle
  || (((c.lignes || []).length === 1 && !(c.cash || []).length
       && String(c.lignes[0].libelle || '').trim()) || '')
  || trad(typeCompte(c.type).label);
const nomEtabDe = c => etabById(c.etabId)?.nom || '';

const nomLignePlacement = (l, compte) =>
  String(l.libelle || '').trim() === typeCompte(compte.type).label
    ? nomCompteV2(compte) : l.libelle;

const sousNom = (nom, ...parts) => {
  const cle = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const vus = new Set([cle(nom)]);
  return parts.filter(p => {
    const k = cle(p);
    if (!k || vus.has(k)) return false;
    vus.add(k);
    return true;
  }).join(' · ');
};

/* --- classe d'actif et role -------------------------------------------
   L'ancien champ « category » melangeait trois questions : le role
   strategique (ETF Core contre satellite), la nature de l'instrument (ETF,
   action, option) et la classe d'actif (or, crypto, cash). Trier dessus
   revenait a trier sur trois choses a la fois, et une action detenue en
   coeur de portefeuille n'avait pas de case.

   Deux champs orthogonaux le remplacent : `assetClass` dit dans quoi on est
   investi, `role` dit pourquoi. On peut desormais avoir des obligations en
   coeur, une action en satellite, ou de l'or dans les deux. */
const ASSET_CLASSES = {
  actions:        trad('Actions'),
  obligations:    trad('Obligations'),
  immobilierCote: trad('Immobilier coté'),
  diversifie:     trad('Multi-actifs'),
  metaux:         trad('Métaux précieux'),
  crypto:         'Crypto',
  monetaire:      trad('Monétaire'),
};
/* Pas de « capital garanti » ici, et le test l'a rappele avant moi : cette
   table est le vocabulaire des lignes COTEES, et chacune de ses classes doit
   tomber dans une poche rapide a vendre. Un fonds euros ne cote pas et ne se
   vend pas en seance — il vit dans `CLASSES_ACTIFS`, la table des poches, ou
   les lignes saisies a la main puisent leur classe. */
/* Pas de « non coté » ici, et c'est volontaire.
   `assetClass` qualifie une ligne de marché — une ligne cotée, par
   construction. Lui proposer « non coté » était une contradiction dans les
   termes, et cela dédoublait un suivi qui existe déjà ailleurs : les parts non
   cotées sont des lignes de compte, sur des comptes de private equity, et
   apparaissent dans Allocation et dans la répartition de la vue d'ensemble.
   Une ligne qui porterait encore cette valeur retombe sur « actions » par la
   lecture tolérante d'assetClassDe(). */
const CLASSES_ALIAS = { or: 'metaux' };
const ROLES = { core: 'Core', satellite: 'Satellite' };
const ROLE_DEFAUT = 'satellite';

const SCHEMA_VERSION = 2;

const CATEGORIE_VERS_SCHEMA = {
  'ETF Core': { assetClass: 'actions',   role: 'core' },
  'ETF':      { assetClass: 'actions',   role: 'satellite' },
  'STOCK':    { assetClass: 'actions',   role: 'satellite' },
  'GOLD':     { assetClass: 'metaux',    role: 'satellite' },
  'CRYPTO':   { assetClass: 'crypto',    role: 'satellite' },
  'CASH':     { assetClass: 'monetaire', role: 'satellite' },
  'OPTION':   { assetClass: 'actions',   role: 'satellite' },
};

const assetClassDe = p => {
  const v = CLASSES_ALIAS[p.assetClass] || p.assetClass;
  return ASSET_CLASSES[v] ? v : 'actions';
};
const roleDe       = p => ROLES[p.role] ? p.role : ROLE_DEFAUT;

function passeFiltresTitres(p, role = 'tous', compte = 'tous') {
  return !!p && (role === 'tous' || roleDe(p) === role)
    && (compte === 'tous' || p.account === compte);
}

const POCHE_DE_CLASSE = {
  actions:        'actions',
  obligations:    'obligations',
  immobilierCote: 'actions',
  diversifie:     'actions',
  metaux:         'actions',
  crypto:         'crypto',
  monetaire:      'liquidites',
};
/* Une poche du patrimoine passee ici se rend elle-meme : `comptesPourCategorie`
   appelle cette fonction avec ce que le menu des supports lui donne, et le menu
   parle en poches. Sans ce renvoi, « capital garanti » retombait sur le defaut
   « actions » et l'application proposait un PEA pour y ranger un fonds euros. */
const pocheDeClasse = ac => {
  const cle = CLASSES_ALIAS[ac] || ac;
  return POCHE_DE_CLASSE[cle] || (cle in CLASSES_ACTIFS ? cle : 'actions');
};

const CLASSE_DE_POCHE = {
  liquidites: 'monetaire',
  actions: 'actions',
  obligations: 'obligations',
  crypto: 'crypto',
  garanti: 'garanti',
};
const classeDePoche = poche => CLASSE_DE_POCHE[poche] || null;

/* Un nombre DECLARE, et le zero en est un.

   C'est la convention qui manquait, et quatre endroits la violaient chacun a sa
   facon : `num(x) || defaut` transforme un zero saisi en valeur par defaut,
   parce que zero est faux en JavaScript. Un champ vide dit l'ignorance, un zero
   dit zero. Les confondre fait afficher un bien a
   100 % quand on a saisi 0 %, et douze mois loues quand on en a saisi zero.

   `v !== ''` d'abord : `Number('')` vaut zero et passerait pour un nombre. */
const estDeclare = v => v !== undefined && v !== null && v !== ''
  && Number.isFinite(Number(v));

const partEstValide = v => !estDeclare(v) || (num(v) >= 0 && num(v) <= 100);

/* --- Robustesse numerique : ce qui peut entrer, et ce qu'on en dit ----------

   UN NOMBRE SAISI A UN PLAFOND, ET C'EST UNE BORNE DE VRAISEMBLANCE, pas une
   limite technique. Un champ `type="number"` refuse les lettres mais accepte la
   notation savante : « 5e26 » passe, `Number()` le lit sans broncher, et une
   quantite de titres a 4,99 × 10^26 a fait naitre une ligne a 499 280 000 000
   000 570 000 000 000 euros. Le montant a traverse neuf couches sans rencontrer
   une question : total, allocation, plus-value, insights, graphiques, jusqu'a
   repousser le nom de la ligne sur trois lignes de telephone.

   `Number.MAX_SAFE_INTEGER` n'est pas une reponse : neuf millions de milliards
   sont representables et absurdes. Les bornes ci-dessous sont METIER, et
   genereuses par construction : la plus basse, un milliard l'unite pour un prix,
   reste mille fois au-dessus du titre le plus cher du monde. Elles attrapent les
   vingt-cinq chiffres, la puissance de dix parasite et le separateur qui a saute,
   jamais un patrimoine reel.

   Le zero et le negatif se decident par genre, parce que « une dette negative »
   et « une rentree negative » ne sont pas la meme faute : la seconde est une
   depense, la premiere un doigt qui a glisse. */
const BORNES_NOMBRE = {
  montant:  { min: 0,     max: 1e12, decimales: 2 },   // solde, valeur, dette, estimation
  signe:    { min: -1e12, max: 1e12, decimales: 2 },   // flux du budget, plus-value realisee
  quantite: { min: 0,     max: 1e12, decimales: 8 },   // parts, titres, crypto
  prix:     { min: 0,     max: 1e9,  decimales: 8 },   // prix unitaire, prix de revient, cours
  taux:     { min: 0,     max: 50,   decimales: 4 },   // taux annuel, assurance : 50 % l'an est une faute
  pct:      { min: 0,     max: 100,  decimales: 2 },   // part, cible, plafond, reserve
  flux:     { min: 0,     max: 1e9,  decimales: 2 },   // mensualite, revenu, versement mensuel
  change:   { min: 0,     max: 1e6,  decimales: 8 },   // taux de conversion vers la devise de base
};
const MONTANT_MAX = BORNES_NOMBRE.montant.max;

/* LIRE UN NOMBRE COMME UN HUMAIN L'A TAPE, pas comme JavaScript le devine.
   `Number('1e30')` vaut dix puissance trente, `Number(' 12 ')` vaut douze et
   `Number('12,5')` vaut NaN : trois surprises pour qui saisit en francais.
   Ici : espaces ordinaires et insecables retirees, virgule acceptee comme point,
   et la notation savante REFUSEE — personne ne tape « e » dans un montant, un
   collage l'apporte. Rend null pour tout ce qui n'est pas un nombre fini, et
   c'est null qu'il faut rendre : zero est une reponse, pas une absence. */
function lireNombre(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '' || /[eE]/.test(t) || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* Vrai si la valeur est un nombre VRAISEMBLABLE pour son genre. Le vide passe :
   il dit l'ignorance, et c'est `requis` qui decide s'il est admis. Rend un
   booleen et jamais une valeur corrigee — ramener 10^26 au plafond en silence
   serait inventer un patrimoine, exactement ce que la borne veut empecher. */
function nombreValide(v, genre = 'montant') {
  if (v === '' || v === null || v === undefined) return true;
  const b = BORNES_NOMBRE[genre] || BORNES_NOMBRE.montant;
  const n = typeof v === 'number' ? v : lireNombre(v);
  return n !== null && Number.isFinite(n) && n >= b.min && n <= b.max;
}
const nombreEstVraisemblable = v => nombreValide(v, 'montant');

function genreDeCle(cle) {
  const c = String(cle || '');
  if (/^(qty|parts)$/.test(c)) return 'quantite';
  if (/^(buyPrice|basePrice|price|prixAchat|prixDeRevient|revient)$/.test(c)) return 'prix';
  if (/^(taux|tauxAssurance)$/.test(c)) return 'taux';
  if (/^(part|plafond|cible|reservePct)$/.test(c)) return 'pct';
  if (/^(mensualite|reserveMonthly)$/.test(c)) return 'flux';
  if (/^(amount|realised)$/.test(c)) return 'signe';
  return 'montant';
}
function genreDuChemin(path) {
  const fin = String(path || '').split('.').pop();
  if (/^budget\.income\./.test(path)) return 'signe';
  return genreDeCle(fin);
}

function signalerInvalides(s) {
  const out = [];
  const voir = (chemin, v, genre, nom) => {
    if (v === '' || v === null || v === undefined) return;
    if (!nombreValide(v, genre)) out.push({ chemin, valeur: v, genre, nom: nom || chemin });
  };
  (s.positions || []).forEach((p, i) => {
    voir(`positions.${i}.qty`, p.qty, 'quantite', p.name);
    voir(`positions.${i}.price`, p.price, 'prix', p.name);
    voir(`positions.${i}.buyPrice`, p.buyPrice, 'prix', p.name);
    voir(`positions.${i}.value`, p.value, 'montant', p.name);
    voir(`positions.${i}.invested`, p.invested, 'montant', p.name);
  });
  (s.comptes || []).forEach((c, i) => {
    /* Le nom affiche, jamais l'identifiant : un compte, une ligne et une dette
       portent le leur dans `libelle`, et `nomCompteV2` est la meme lecture que
       la liste d'Actifs. */
    (c.cash || []).forEach((e, j) => voir(`comptes.${i}.cash.${j}.montant`, e.montant, 'montant', nomCompteV2(c)));
    (c.lignes || []).forEach((l, j) => voir(`comptes.${i}.lignes.${j}.valeur`, l.valeur, 'montant', l.libelle || nomCompteV2(c)));
  });
  (s.etabs || []).forEach((e, i) => (e.dettes || []).forEach((d, j) =>
    voir(`etabs.${i}.dettes.${j}.montant`, d.montant, 'montant', d.libelle || e.nom)));
  Object.entries(s.now || {}).forEach(([k, v]) => voir(`now.${k}`, v, 'montant', k));
  return out;
}
const aVerifier = () => (Store.state?.meta?.aVerifier) || [];

function fmtEURCompact(v) {
  const n = num(v);
  if (Math.abs(n) < 1e6) return fmtEUR(n);
  return moinsTypographique(new Intl.NumberFormat(locale(), {
    style: 'currency', currency: deviseBase(), currencyDisplay: 'narrowSymbol',
    notation: 'compact', maximumFractionDigits: 2,
  }).format(n));
}

const partDetention = l => {
  if (!estDeclare(l?.part)) return 1;
  const p = num(l.part);
  /* Hors de [0, 100] : `null`, et surtout pas un pourcentage invente.

     Le garde-fou d'avant rendait 1, au motif que les totaux devaient rester
     calculables. Mais rendre 1 DIT que le bien est detenu en entier, ce que
     personne n'a declare : 150 % devenait 100 % en silence, au moment meme ou
     l'ecran demandait de corriger la valeur. Un total calculable au prix d'une
     detention inventee n'est pas un service.

     Les appelants ECARTENT la ligne des montants personnels, ils ne substituent
     pas 1. Le patrimoine est alors incomplet, et le controle de coherence le
     dit — un total qui manque un bien vaut mieux qu'un total qui en invente la
     detention. */
  if (p < 0 || p > 100) return null;
  return p / 100;
};

function lotsPartInvalide() {
  const out = [];
  for (const c of comptesOuverts())
    for (const l of (c.lignes || []))
      if (!partEstValide(l.part)) out.push({ compte: c, ligne: l });
  return out;
}

const moisLouesDeclares = compte => estDeclare(compte?.moisLoues)
  ? Math.min(12, Math.max(0, Math.round(num(compte.moisLoues)))) : 12;

/* Le taux d'un credit, en pourcentage annuel, ou `null` s'il n'est pas declare.

   Un taux ABSENT n'est pas un taux nul : sans lui on ne sait pas departager le
   capital des interets. Un taux DECLARE a zero, lui, est un vrai taux — le pret
   familial, le differe sans interets — et s'amortit tout droit.

   L'echeancier appliquait deja cette distinction ; la projection du capital
   restant du, non. Les deux moteurs repondaient donc differemment sur le meme
   credit. Une seule porte desormais. */
const tauxCreditDeclare = d => estDeclare(d?.taux) ? num(d.taux) : null;

const USAGES_BIEN = [
  ['locative',   'Mis en location'],
  ['principale', 'Résidence principale'],
  ['secondaire', 'Résidence secondaire'],
];
const USAGE_BIEN_LABEL = Object.fromEntries(USAGES_BIEN);
const usageLigne = l => USAGE_BIEN_LABEL[l?.usage] ? l.usage : '';

/* Un bien immobilier DETENU EN DIRECT : celui qui s'habite ou se loue.

   La distinction est dans le modele, pas dans un libelle : `bienImmo` dit « ceci
   pese comme de la pierre », `direct` dit « on le detient soi-meme ». Une SCPI
   porte le premier drapeau et pas le second — demander a son detenteur s'il y a
   sa residence principale n'aurait aucun sens. Un REIT, un fonds, un support
   loge dans une enveloppe : meme raison. */
/* La meme question posee au TYPE, pour les ecrans qui n'ont pas encore de
   compte : le parcours de creation choisit ses champs avant que le compte
   existe. `direct` seul ne suffit pas — un bien de valeur le porte aussi, et
   une montre n'a ni frais de notaire, ni travaux, ni usage de logement. */
const estImmoEnDirect = t => !!t && !!t.bienImmo && estDetenuEnDirect(t);
function estBienEnDirect(compte) {
  return estImmoEnDirect(typeCompte(compte?.type));
}

/* Ce que le perimetre financier ecarte, et la SEULE question qui le decide.

   Elle ne porte pas sur la classe. `immobilier` couvre a la fois un appartement
   et une SCPI, et la question posee ici n'est pas « de quoi est-ce fait » mais
   « est-ce un mur qu'on detient soi-meme ». Le filtre par classe repondait donc
   faux deux fois : il sortait la pierre papier des avoirs financiers, et avec
   elle le support immobilier d'une assurance-vie — cinquante mille euros
   quittaient Allocation parce qu'un contrat propose ce support, alors que
   l'argent y est aussi pilotable que le fonds actions d'a cote.

   `estDetenuEnDirect` et rien d'autre : le contenant EST la chose. Un
   appartement et une montre le sont ; une SCPI ne l'est pas, ni une enveloppe
   qui accepte de l'immobilier — elle ne devient pas un mur pour autant.

   Une question metier, une fonction. La frontiere ne se redecrit nulle part
   ailleurs, et surtout pas par un `type === 'scpi'` recopie : le principe est
   NON DIRECT et non « SCPI », et le prochain support de pierre papier tombera
   du bon cote sans qu'on y pense. */
function estHorsPerimetreFinancier(compte) {
  return estDetenuEnDirect(typeCompte(compte?.type));
}

/* L'usage d'un bien, et D'OU IL VIENT. La seule porte.

   Trois questions vivaient eparpillees dans les vues — « l'usage est-il
   rempli ? », « y a-t-il un loyer ? », « que montrer sinon ? » — et chacune
   repondait a sa facon. Elles se rejoignent ici, et le resultat dit toujours sa
   provenance : c'est elle qui decide si l'ecran doit demander confirmation.

     source: 'declare'   quelqu'un l'a choisi. Il gagne toujours, meme contre un
                         loyer qui dirait le contraire : une chambre louee dans
                         sa residence principale est un cas reel, et l'ecran n'a
                         pas a requalifier le logement de son detenteur.
     source: 'loyer'     rien n'est declare, mais un loyer est rattache. On penche
                         vers le locatif pour ne pas changer ce que les anciens
                         etats affichaient — c'est une DEDUCTION, et
                         `aConfirmer` le dit. Rien n'est ecrit dans les donnees :
                         le jour ou le detenteur confirme, alors seulement.
     source: 'mixte'     les lots ne s'accordent pas. Un appartement habite et un
                         studio loue dans le meme compte : choisir l'un des deux
                         en silence serait inventer. Le compte n'a pas d'usage.
     source: 'partiel'   un lot dit son usage, un autre se tait. Meme reponse
                         que le mixte : pas d'usage de compte, et le lot muet a
                         preciser dans sa ligne.
     source: 'inconnu'   rien de rien. On n'invente pas, et surtout pas
                         « residence principale » : ce serait sortir le bien des
                         avoirs mobilisables sans que personne l'ait dit. */
function usageEffectifBien(compte) {
  const muet = { usage: '', source: 'inconnu', mixte: false, action: null };
  /* Seul un bien DETENU EN DIRECT a un usage a declarer. Une SCPI porte le
     drapeau `bienImmo` sans le drapeau `direct` : lui demander si on l'habite
     n'aurait aucun sens, et le bandeau se poserait sur toute la pierre papier. */
  if (!compte || !estBienEnDirect(compte)) return muet;
  const usages = (compte.lignes || [])
    .filter(l => (l.classe || 'immobilier') === 'immobilier')
    .map(usageLigne);
  const dits = [...new Set(usages.filter(Boolean))];
  const muets = usages.filter(u => !u).length;
  if (dits.length > 1)
    return { usage: '', source: 'mixte', mixte: true, action: 'lots' };
  /* Un lot declare et un lot muet ne font pas un usage de compte. Le filtre
     `Boolean` effacait le lot muet avant de compter, et un appartement habite
     accompagne d'un parking sans usage devenait « residence principale » en
     entier, sans que personne l'ait dit pour le parking. Le compte n'a pas
     d'usage tant qu'un lot n'a pas le sien, et la fiche renvoie vers ce lot. */
  if (dits.length && muets)
    return { usage: '', source: 'partiel', mixte: false, action: 'lots', aPreciser: muets };
  if (dits.length === 1)
    return { usage: dits[0], source: 'declare', mixte: false, action: null };
  const loue = (B().income || []).some(r => r.bienId === compte.id && num(r.amount));
  return loue
    ? { usage: 'locative', source: 'loyer', mixte: false, action: 'confirmer' }
    : { ...muet, action: 'choisir' };
}

function usageBien(compte) { return usageEffectifBien(compte).usage; }

/* Ce qu'un lot a COUTE, et d'ou vient la reponse.

   Trois montants, et le total ne se saisit pas : le prix, les frais, les travaux
   du depart. « Prix d'acquisition » nommait jusqu'ici tantot l'un, tantot leur
   somme, selon qui remplissait le champ — et l'ecart entre les deux vaut les
   frais de notaire, sept a huit pour cent du prix. Un intitule qui peut vouloir
   dire deux choses finit par vouloir dire la mauvaise.

   VIDE N'EST PAS ZERO. `estDeclare` tranche : un champ jamais rempli est
   inconnu, un zero tape est une declaration. Des travaux a zero disent « il n'y
   en a pas eu » ; des travaux absents ne disent rien. Le total additionne donc
   ce qui est declare et signale, par `complet`, s'il manque une piece — un
   « cout total » ampute des frais serait plus trompeur qu'une absence.

   LE LEGACY N'EST PAS DEVINE. `prixDeRevient` porte, chez les anciens biens, une
   somme dont personne ne sait ce qu'elle contient. Elle vaut donc le cout total
   et rien de plus : aucune decomposition ne s'en deduit, et l'ecran dit « detail
   non renseigne » plutot que d'inventer un prix d'achat.

   Une seule source a la lecture : des qu'un composant est declare, le detail
   gagne et le champ legacy cesse d'etre lu. Il n'est jamais efface — personne ne
   peut savoir ce qu'il contenait. */
function acquisitionLigne(l) {
  const dit = cle => estDeclare(l?.[cle]) ? num(l[cle]) : null;
  const prixAchat = dit('prixAchat');
  const frais = dit('fraisAcquisition');
  const travaux = dit('travauxInitiaux');
  const complet = prixAchat !== null && frais !== null && travaux !== null;
  const dits = [prixAchat, frais, travaux].filter(v => v !== null);
  const sousTotal = dits.length ? round2(dits.reduce((s, v) => s + v, 0)) : null;
  /* Le legacy ne distingue pas un zero d'une absence : il n'a jamais eu de quoi.
     Zero y vaut donc « non renseigne », et un vrai cout nul se declare
     desormais par `prixAchat: 0`. */
  const legacy = num(l?.prixDeRevient) || null;
  const socle = { prixAchat, frais, travaux, sousTotal, legacy };

  if (complet)
    return { ...socle, total: sousTotal, source: 'detail', complet: true };
  if (legacy !== null)
    return { ...socle, total: round2(legacy), source: 'legacy', complet: false };
  return { ...socle, total: null, source: dits.length ? 'partiel' : 'inconnu',
           complet: false };
}

const coutAcquisition = l => acquisitionLigne(l).total;

function acquisitionCompte(compte) {
  const lots = (compte?.lignes || [])
    .filter(l => (l.classe || 'immobilier') === 'immobilier');
  let entier = 0, detenu = 0, connus = 0, complets = 0, legacy = 0;
  let sousTotal = 0, partiels = 0, partsInvalides = 0;
  for (const l of lots) {
    const a = acquisitionLigne(l);
    if (a.sousTotal != null) { sousTotal += a.sousTotal; }
    if (a.source === 'partiel') partiels++;
    if (a.total == null) continue;
    connus++;
    if (a.complet) complets++;
    if (a.source === 'legacy') legacy++;
    entier += a.total;
    const q = partDetention(l);
    if (q === null) partsInvalides++; else detenu += a.total * q;
  }
  return { entier: round2(entier), detenu: round2(detenu),
           connus, lots: lots.length, partInvalide: partsInvalides > 0,
           /* `null` quand aucun lot ne dit son cout : zero serait un cout. Et
              des qu'UN lot n'a pas le sien — detail partiel sans legacy, ou rien
              du tout — le compte n'en a pas non plus : un total qui
              n'additionnerait que les lots connus se ferait passer pour celui du
              bien. `!partiels` ne gardait que le premier cas, et deux lots dont
              un seul avait un prix affichaient ce prix en « cout total ». */
           total: connus && connus === lots.length ? round2(entier) : null,
           sansCout: lots.length - connus,
           sousTotal: sousTotal ? round2(sousTotal) : null,
           partiel: partiels > 0,
           complet: connus > 0 && complets === lots.length,
           legacy: legacy > 0 && complets === 0 };
}

function lignesDe(compte) {
  const marche = Store.state.positions
    .filter(p => p.account === compte.id)
    .map(p => ({ id: p.id, classe: pocheDeClasse(assetClassDe(p)), libelle: p.name,
                 valeur: posValue(p), prixDeRevient: posInvested(p),
                 quantite: num(p.qty), marche: p, mobilite: p.mobilite,
                 refMobilite: `positions.${Store.state.positions.indexOf(p)}.mobilite` }));
  /* `ref` : le rang de la ligne dans son compte. La vue en a besoin pour ouvrir
     la bonne fenetre d'edition, et l'index de cette liste-ci ne le donne pas —
     les lignes de marche passent devant. */
  const manuelles = (compte.lignes || []).map((l, i) => {
    const q = partDetention(l);
    /* Une quote-part invalide ECARTE la ligne des montants personnels : la part
       detenue n'est pas connue, et l'inventer ferait entrer un montant faux
       dans les treize ecrans qui lisent cette fonction. La valeur du bien
       ENTIER reste lisible — c'est elle qu'on vient corriger — et `partInvalide`
       permet a la fiche de dire pourquoi le montant personnel manque. */
    const partInvalide = q === null;
    /* `prixDeRevient` rendu ici est desormais le COUT TOTAL d'acquisition, pas
       le seul champ du meme nom : les treize lecteurs de cette fonction — dont
       la base des rendements — parlent tous du meme montant, et un bien dont le
       detail n'est pas rempli continue de rendre exactement sa valeur legacy.
       Aucun ecran ne change de denominateur en silence. */
    const acq = acquisitionLigne(l);
    return { ...l, ref: i, partInvalide,
             part: partInvalide ? num(l.part) : (q < 1 ? num(l.part) : null),
             valeur: partInvalide ? 0 : num(l.valeur) * q,
             prixDeRevient: partInvalide ? 0 : (acq.total || 0) * q,
             valeurEntiere: num(l.valeur), prixEntier: acq.total || 0,
             acquisition: acq,
             refMobilite: `comptes.${Store.state.comptes.indexOf(compte)}.lignes.${i}.mobilite` };
  });
  return [...marche, ...manuelles];
}

function mobiliteLigne(l, compte) {
  if (l.mobilite && l.mobilite !== 'auto') return l.mobilite;
  if (usageLigne(l) === 'principale') return 'habite';
  return mobilisabilite(l.classe, compte.type);
}

const cashCompte = c => (c.cash || []).reduce((s, e) => s + num(e.montant), 0);
const valeurCompte = c => cashCompte(c) + lignesDe(c).reduce((s, l) => s + l.valeur, 0);

/* --- les comptes groupes par enveloppe ----------------------------------
   Le regroupement « Enveloppe » de la page Comptes, ici et non dans la vue,
   pour qu'un test puisse le sommer : le harnais ne charge pas `app.js`.

   Il parcourait `TYPES_COMPTE` et gardait les comptes de chaque type. Un compte
   portant un type absent de cette liste n'apparaissait alors dans aucun groupe,
   tout en restant compte dans le total de la page : le total cessait d'egaler la
   somme de ses parts, silencieusement. Ce n'est pas theorique — un etat migre
   depuis l'ancien modele peut porter `levier`, que la liste ne connait pas, et
   `typeCompte()` prevoit deja un type inconnu en lui rendant une definition de
   secours.

   On part donc des comptes, pas de la liste : chaque compte tombe forcement dans
   le groupe de son type. La liste ne sert plus qu'a ordonner, les types qu'elle
   ne connait pas venant a la fin, dans l'ordre ou ils se presentent. */
function groupesParEnveloppe(comptes = comptesOuverts()) {
  const rang = new Map(TYPES_COMPTE.map((t, i) => [t.id, i]));
  const inconnu = TYPES_COMPTE.length;
  const parType = new Map();
  for (const c of comptes) {
    if (!parType.has(c.type)) parType.set(c.type, []);
    parType.get(c.type).push(c);
  }
  return [...parType.entries()]
    .sort((a, b) => (rang.has(a[0]) ? rang.get(a[0]) : inconnu)
                  - (rang.has(b[0]) ? rang.get(b[0]) : inconnu))
    .map(([id, siens]) => ({
      id, label: typeCompte(id).label, comptes: siens,
      total: siens.reduce((s, c) => s + valeurCompte(c), 0),
    }));
}

function cashInvestirEntree(compte, creer = false) {
  let e = (compte.cash || []).find(x => x.affectation === 'investir');
  if (!e && creer) { compte.cash = compte.cash || []; e = { montant: 0, affectation: 'investir' }; compte.cash.push(e); }
  return e || null;
}

/* --- les espèces, toujours là -------------------------------------------
   Personne ne tient les billets d'un portefeuille : les noter demandait
   d'inventer un etablissement, et celui qu'on inventait remontait en tete de
   liste. Un compte d'especes existe donc pour tout le monde, sans contenant,
   pose une fois ici.

   Deux chemins, et le meme resultat : on adopte le compte bricole s'il
   existe, sinon on en cree un a zero. Adopter et non ajouter, sinon le meme
   argent serait compte deux fois — et l'identifiant est conserve, parce que
   les releves mensuels sont indexes dessus : en changer perdrait l'historique.

   Idempotente par construction : elle sort si un compte d'especes existe
   deja, sans drapeau a poser dans `meta`. */
const ID_ESPECES = 'especes';
const compteEspeces = () => COMPTES().find(c => c.type === 'especes') || null;

function poserEspeces(s) {
  if (!Array.isArray(s.comptes)) return;
  if (s.comptes.some(c => c.type === 'especes')) return;

  const etabs = s.etabs || [];
  const seulEspeces = /^esp[eè]ces?$/i;
  const bricole = s.comptes.find(c => {
    if (typeCompte(c.type).groupe !== 'cash') return false;
    const nomE = (etabs.find(e => e.id === c.etabId) || {}).nom || '';
    return seulEspeces.test(nomE.trim()) || seulEspeces.test(String(c.libelle || '').trim());
  });

  if (bricole) {
    const ancien = bricole.etabId;
    bricole.type = 'especes';
    bricole.etabId = null;
    if (/^(real )?cash$/i.test(String(bricole.libelle || '').trim())
        || seulEspeces.test(String(bricole.libelle || '').trim())) bricole.libelle = '';
    const vide = e => !s.comptes.some(c => c.etabId === e.id)
                   && !(e.dettes || []).some(d => num(d.montant));
    const e = etabs.find(x => x.id === ancien);
    if (e && vide(e)) s.etabs = etabs.filter(x => x !== e);
  } else {
    const libre = s.comptes.some(c => c.id === ID_ESPECES) ? ID_ESPECES + '_' + Date.now() : ID_ESPECES;
    s.comptes.push({
      id: libre, etabId: null, type: 'especes', statut: 'ouvert',
      ouvertLe: '', numero: '', notes: '', libelle: '', court: 'Espèces',
      cash: [{ montant: 0, affectation: 'courant' }], lignes: [],
    });
  }
}

function comptesPourCategorie(cat, compteActuel = null) {
  const classe = pocheDeClasse(cat);
  const ok = comptesOuverts().filter(c => typeCompte(c.type).classes.includes(classe));
  const actuel = compteActuel && compteById(compteActuel);
  if (actuel && !ok.includes(actuel)) ok.push(actuel);
  return ok;
}

function entreesInvestir() {
  const out = [];
  Store.state.comptes?.forEach((c, idxCompte) => {
    if (c.statut === 'archive') return;
    (c.cash || []).forEach((e, idxCash) => {
      if (e.affectation === 'investir') out.push({ compte: c, idxCompte, idxCash, montant: num(e.montant) });
    });
  });
  return out;
}

const VL_PERIODES = [['mois', 'Mensuelle'], ['trimestre', 'Trimestrielle'],
                     ['semestre', 'Semestrielle'], ['an', 'Annuelle']];
const VL_JOURS = { mois: 45, trimestre: 105, semestre: 200, an: 400 };

function joursDepuis(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso)) / (24 * 3600e3);
}

function valeurPerimee(ligne, type) {
  if (!ligne || !ligne.estimeLe) return true;    // sans date, on ne sait pas : a revoir
  const jours = type && type.vl
    ? (VL_JOURS[ligne.vlPeriode] || VL_JOURS.trimestre)
    : VL_JOURS.an;
  return joursDepuis(ligne.estimeLe) > jours;
}

/* --- DE QUAND DATE UNE VALEUR ---------------------------------------------

   Chaque montant porte sa date sur l'objet qui le porte : `saisiLe` sur une part
   de cash (le jour ou le detenteur a tape ce solde), `estimeLe` sur une ligne
   (le jour d'une estimation, ou celui de la VL publiee), `verifieLe` sur un
   credit (le jour ou le capital a ete lu), et `quotes.lastRun` pour les cours.

   LA DATE SUIT LE MONTANT, ET L'ACTE DE VERIFICATION. Elle bouge quand le
   montant change sous la main du detenteur, quand il la pose lui-meme, et
   quand il appuie sur « Enregistrer » dans LE FORMULAIRE DE CE MONTANT : la
   carte du solde, la carte « Mettre a jour » d'un bien, la fenetre d'un
   placement en parts, celle d'un credit. Appuyer la, montant change ou non,
   dit « ce chiffre est bon aujourd'hui », et un solde se dit donc « verifie
   le ». Enregistrer le nom, les notes ou un autre champ, depuis un autre
   formulaire, ne la touche pas ; « Annuler » ne date rien. Un montant que
   l'application ecrit elle-meme -- le produit d'une vente credite sur un
   compte, un releve qui recopie les valeurs du jour -- ne date rien non plus :
   ce n'est pas une lecture chez la banque.

   La clef `saisiLe` garde son nom : elle date de l'epoque ou seule la frappe
   datait un solde, et la renommer ferait une migration pour un mot. */
const montantChange = (avant, apres) =>
  estDeclare(avant) !== estDeclare(apres) || num(avant) !== num(apres);

const dateApresChangement = (genre, jour = todayISO()) => (genre === 'vl' ? null : jour);

function dateQuiSuit(chemin) {
  let m = String(chemin).match(/^comptes\.(\d+)\.cash\.(\d+)\.montant$/);
  if (m) return { chemin: `comptes.${m[1]}.cash.${m[2]}.saisiLe`, genre: 'solde' };
  m = String(chemin).match(/^etabs\.(\d+)\.dettes\.(\d+)\.montant$/);
  if (m) return { chemin: `etabs.${m[1]}.dettes.${m[2]}.verifieLe`, genre: 'credit' };
  m = String(chemin).match(/^comptes\.(\d+)\.lignes\.(\d+)\.valeur$/);
  if (m) {
    const t = typeCompte((COMPTES()[+m[1]] || {}).type);
    if (estValeurEstimee(t)) return { chemin: `comptes.${m[1]}.lignes.${m[2]}.estimeLe`, genre: 'estimation' };
    if (t && t.vl) return { chemin: `comptes.${m[1]}.lignes.${m[2]}.estimeLe`, genre: 'vl' };
  }
  return null;
}

function dateApresSaisie({ avant, apres, dateAvant, dateSaisie, genre, jour = todayISO() }) {
  if ((dateSaisie || '') !== (dateAvant || '')) return dateSaisie || null;
  if (genre === 'vl') return montantChange(avant, apres) ? null : (dateAvant || null);
  return jour;
}

/* --- « ENREGISTRER » DANS LA CARTE D'UN MONTANT LE VERIFIE ----------------

   Les deux barres de fiche qui portent `data-dater` appellent ceci : la carte
   du solde date chaque part du jour ; la carte « Mettre a jour » d'un bien
   date ses estimations et les capitaux de ses credits. Une date posee a la
   main pendant la visite gagne : elle differe de l'instantane pris a
   l'ouverture (`compteDeLInstantane`, `etabs` de l'instantane), et on la
   laisse. Rien d'autre ne bouge : ni montant, ni releve, ni autre compte. */
function confirmerSolde(c, jour = todayISO()) {
  let n = 0;
  for (const e of (c.cash || [])) { e.saisiLe = jour; n++; }
  return n;
}
function confirmerBien(c, instantane = null, jour = todayISO()) {
  const avant = instantane ? compteDeLInstantane(instantane, c.id) : null;
  let n = 0;
  (c.lignes || []).forEach((l, i) => {
    if ((l.classe || 'immobilier') !== 'immobilier') return;
    const dAvant = avant && avant.lignes && avant.lignes[i] ? (avant.lignes[i].estimeLe || '') : (l.estimeLe || '');
    if ((l.estimeLe || '') !== dAvant) return;
    l.estimeLe = jour; n++;
  });
  const e = c.etabId ? etabById(c.etabId) : null;
  if (!e) return n;
  const eAvant = instantane && instantane.etabs && instantane.etabs[e.id] ? JSON.parse(instantane.etabs[e.id]) : null;
  const miens = new Set(creditsDuBien(c));
  (e.dettes || []).forEach((d, i) => {
    if (!miens.has(d)) return;
    const dAvant = eAvant && eAvant.dettes && eAvant.dettes[i] ? (eAvant.dettes[i].verifieLe || '') : (d.verifieLe || '');
    if ((d.verifieLe || '') !== dAvant) return;
    d.verifieLe = jour; n++;
  });
  return n;
}

function datesDuCompte(c) {
  const t = typeCompte(c.type);
  const plusAncienne = dates => (dates.some(d => !d) ? null : [...dates].sort()[0]);
  const out = [];
  const cash = (c.cash || []).filter(e => num(e.montant) !== 0);
  if (cash.length) out.push({ genre: 'solde', date: plusAncienne(cash.map(e => e.saisiLe || null)) });
  const lignes = (c.lignes || []).filter(l => estDeclare(l.valeur) && num(l.valeur) !== 0);
  if (lignes.length && (estValeurEstimee(t) || (t && t.vl))) {
    out.push({ genre: estValeurEstimee(t) ? 'estimation' : 'vl',
               date: plusAncienne(lignes.map(l => l.estimeLe || null)) });
  }
  if ((Store.state.positions || []).some(p => p.account === c.id && !p.manual)) {
    const last = Store.state.quotes?.lastRun;
    out.push({ genre: 'cours', date: last ? String(last).slice(0, 10) : null });
  }
  return out;
}

function ageAnnees(iso) {
  if (!iso) return Infinity;                    // sans date : pas de blocage
  return (Date.now() - new Date(iso)) / (365.25 * 24 * 3600e3);
}
/* L'anciennete d'une enveloppe, et le seuil qui la rend interessante.

   Cinq ans pour un PEA, huit pour une assurance-vie : ce sont des seuils
   FISCAUX, pas des barrieres a la sortie — d'ou leur absence de
   `mobilisabilite`. Mais c'est le repere que tout detenteur d'assurance-vie
   guette, et l'application connaissait la date sans rien en faire : elle la
   reclamait a la creation en promettant qu'elle « conditionne la
   disponibilite », ce qui etait faux, et ne l'affichait nulle part.

   Le PER n'a pas de seuil d'anciennete : ce qui le libere est un evenement, le
   depart en retraite, et non une duree ecoulee. Il porte donc une echeance
   declaree plutot qu'un compte a rebours calcule. */
const SEUIL_ANCIENNETE = { pea: 5, av: 8 };

function ancienneteCompte(c) {
  const debut = c && c.ouvertLe;
  const ans = SEUIL_ANCIENNETE[c && c.type];
  if (!debut || !ans) return null;
  const d = new Date(debut + 'T00:00:00');
  if (isNaN(d)) return null;
  const now = new Date(todayISO() + 'T00:00:00');
  let mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) mois--;
  if (mois < 0) mois = 0;
  const seuilLe = new Date(d); seuilLe.setFullYear(d.getFullYear() + ans);
  const moisRestants = Math.max(0, ans * 12 - mois);
  /* La date se recompose a la main, jamais par `toISOString()` : celui-ci
     convertit en UTC, et minuit heure locale a l'est de Greenwich retombe la
     veille. Le seuil des huit ans d'un contrat ouvert un 1er septembre
     s'affichait au 31 aout. */
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
                 + `-${String(x.getDate()).padStart(2, '0')}`;
  return { mois, annees: Math.floor(mois / 12), reste: mois % 12,
           seuilAns: ans, atteint: mois >= ans * 12, moisRestants,
           seuilLe: iso(seuilLe) };
}

function mobilisabilite(classe, typeId) {
  /* LA DISPONIBILITE SE DECLARE SUR LE TYPE quand elle ne se deduit pas de la
     classe : un PER est ferme jusqu'a la retraite (« bloque »), une enveloppe de
     retraite americaine se casse en quelques semaines avec une decote
     (« lent »). La regle vivait ici sous `typeId === 'per'` : un identifiant
     francais decidait d'une propriete generale. */
  const declaree = typeCompte(typeId).disponibilite;
  if (declaree) return declaree;
  if (classe === 'nonCote' || classe === 'immobilier') return 'lent';
  if (classe === 'bienValeur') return 'lent';
  /* Les liquidites sont immediates si le compte qui les porte est un compte de
     cash, et non selon une liste de deux types ecrite ici a la main.

     Cette liste disait « courant ou livret », et les especes sont arrivees
     apres : des billets dans un portefeuille tombaient donc en « quelques
     jours », derriere un virement bancaire. C'est l'argent le plus immediat qui
     existe. Sinon, la jauge de l'accueil annoncerait 6 000 EUR de coussin quand
     « Disponible tout de suite » en montrerait 5 350 : l'ecart vaudrait
     exactement les especes, et rien ne le dirait.

     `groupe === 'cash'` couvre courant, livret et especes, et couvrira le
     prochain type de compte de cash sans qu'on y pense. Le cash pose chez un
     courtier garde son delai : son compte est du groupe bourse. */
  if (classe === 'liquidites')
    return typeCompte(typeId).groupe === 'cash' ? 'immediat' : 'differe';
  return 'differe';
}

partieChargee('assets/store-01-socle.js');
