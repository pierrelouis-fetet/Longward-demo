/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

function runway() {
  const f = budgetFrame();
  const stats = expenseYearStats(todayISO().slice(0, 4));
  const burn = f.fixed + (stats.average || f.target);

  const p = poches();
  const immediate  = p.mobilisable.immediat;
  const differe    = p.mobilisable.differe;
  const lent       = p.mobilisable.lent;
  const habite     = p.mobilisable.habite;
  const bloque     = p.mobilisable.bloque;

  const contenants = trad('comptes courants, livrets, espèces');
  /* Les libelles viennent de `MOBILISABLE_LABEL`, ils ne se reecrivent pas ici.

     Cette carte et « Par disponibilite » decoupent le meme argent selon les
     memes cinq paliers, et chacune avait sa propre liste de mots : « En
     quelques jours » d'un cote, « Disponible sous quelques jours » de l'autre,
     pour la meme poche. Deux ecrans qu'on ne regarde pas en meme temps, donc
     personne ne pouvait le voir. Une liste se derive, elle ne se recopie pas.

     Les notes, elles, appartiennent a cette carte : elles disent ce que le
     palier contient chez celui qui lit, ce que l'autre carte n'a pas a faire. */
  const tiers = [
    { label: trad(MOBILISABLE_LABEL.immediat), value: immediate,
      note: p.projet > 0.005 ? `${contenants}${trad(' ; projets compris')}` : contenants },
    { label: trad(MOBILISABLE_LABEL.differe), value: differe,
      note: trad('liquidités chez un courtier ; un titre se vend en séance, le virement prend 2 à 3 jours') },
    { label: trad(MOBILISABLE_LABEL.lent), value: lent, note: trad('immobilier, non coté, à vendre avec décote si pressé') },
    ...(habite > 0.005 ? [{ label: trad(MOBILISABLE_LABEL.habite), value: habite,
        note: trad('le vendre veut dire te reloger'), horsCumul: true }] : []),
    { label: trad(MOBILISABLE_LABEL.bloque), value: bloque, note: trad('bloqué jusqu’à son échéance'), horsCumul: true },
  ];
  let cum = 0;
  for (const t of tiers) {
    if (t.horsCumul) { t.cumulative = null; t.months = null; continue; }
    cum += t.value; t.cumulative = cum; t.months = burn ? cum / burn : 0;
  }

  /* --- LA RESERVE DE SECURITE, ET POURQUOI ELLE N'EST NI L'UNE NI L'AUTRE ---

     Trois chiffres coexistent, et deux ne doivent pas s'afficher sans dire
     lequel repond a quelle question :

       `immediate`    tout le cash pose sur un contenant mobilisable tout de
                      suite, projets et argent a investir compris ;
       `liquidMonths` celui-la plus ce qui se vend chez un courtier ;
       et le coussin reel, calcule ici.

     Ce dernier est le seul qui dise de quoi on vivrait demain : l'epargne de
     precaution plus le cash des depenses courantes. L'argent flechevers un
     projet ou vers un investissement a deja un travail, et le compter
     promettrait une reserve qui n'existe pas.

     Il vit donc ici, ou il se teste, et la carte comme l'insight le lisent au
     meme endroit. Sans cela, la carte pourrait annoncer une petite reserve
     pendant que la lecture de l'accueil en annoncerait une grande, et les deux
     diraient vrai. */
  const reserve = p.precaution + p.courant;

  return {
    burn, tiers, immediate,
    reserve,
    reserveMois: burn ? reserve / burn : 0,
    immediateMonths: burn ? immediate / burn : 0,
    liquidMonths: burn ? (immediate + differe) / burn : 0,
    targetLow: burn * 3, targetHigh: burn * 6,
  };
}

/* LA MOYENNE SE DIVISE PAR DES MOIS, PAS PAR DES ECARTS.

   Elle valait `somme / n`, ou `n` compte les INTERVALLES entre releves. Tant
   qu'on saisit tous les mois les deux coincident, et c'est pour ca que le
   defaut a tenu. Un mois saute, et ils divergent : un releve de janvier a
   100 000 et un d'avril a 106 000 font UN intervalle de +6 000, donc une
   « moyenne mensuelle » de 6 000 EUR pour un rythme reel de 2 000. Le chiffre
   sert de rythme d'accumulation, il nourrit la trajectoire vers l'objectif et
   l'ecart au budget : trois lectures triplees d'un coup, du cote flatteur.

   Chaque point porte donc le nombre de MOIS que son ecart couvre, et la moyenne
   les additionne. Le mois, et non le jour : les releves sont des photos
   mensuelles, datees du premier du mois, et compter en jours donnerait une
   precision que la donnee n'a pas. Un intervalle vaut au moins un mois.

   `count` reste le nombre d'ecarts mesures : c'est lui que « mois en hausse »
   compte, et deux releves separes de trois mois ne donnent qu'une hausse
   observee — les deux mois du milieu, personne ne sait. */
function statsRythme(points) {
  const n = points.length;
  const somme = points.reduce((s, p) => s + p.delta, 0);
  const mois = points.reduce((s, p) => s + Math.max(1, num(p.mois) || 1), 0);
  /* Ce qui est entre du dehors sur la periode affichee. Un heritage fait monter
     le patrimoine sans que personne ait mis de cote : la moyenne mensuelle le
     compte, et elle doit pouvoir le dire.

     Un point porte l'ecart entre deux releves, et sa date est celle du second :
     l'intervalle qu'il couvre commence donc au releve d'avant. Borner la fenetre
     a la date du premier point laissait dehors tout ce qui etait entre pendant
     son propre intervalle — une succession du 15 mars ne comptait pas dans le
     point du 30 avril, et le rythme continuait de la prendre pour de l'epargne.
     C'est `depuis` que chaque point porte pour cela. */
  const debut = n ? String(points[0].depuis || points[0].date) : null;
  const fin = n ? String(points[n - 1].date) : null;
  const apports = n ? apportsTotal(debut, fin) : 0;
  return {
    points, count: n,
    mois,
    average: mois ? somme / mois : 0,
    apports,
    averageHorsApports: mois ? (somme - apports) / mois : 0,
    positive: points.filter(p => p.delta > 0).length,
    best: points.reduce((a, o) => (!a || o.delta > a.delta) ? o : a, null),
    worst: points.reduce((a, o) => (!a || o.delta < a.delta) ? o : a, null),
  };
}

/* Combien de mois separent deux releves, au sens du calendrier.

   Les dates sont des clefs de mois — le premier du mois pour une ligne du
   calendrier — et la difference se lit donc sur l'annee et le mois. Compter les
   jours donnerait 89 ou 92 selon les mois traverses pour la meme reponse
   « trois mois », une precision que la donnee n'a pas.

   Un minimum d'un mois : deux photos du meme mois — une cloture au 31/12 a cote
   du releve de decembre — ne doivent pas diviser par zero. `monthlyPace` ecarte
   deja ce doublon, la borne est une ceinture. */
function moisEntre(a, b) {
  const [ya, ma] = String(a).slice(0, 7).split('-').map(Number);
  const [yb, mb] = String(b).slice(0, 7).split('-').map(Number);
  const n = (yb - ya) * 12 + (mb - ma);
  return Number.isFinite(n) ? Math.max(1, n) : 1;
}

const sansDoublonDeCloture = pts => pts.filter(p => !(Number(String(p.date).slice(8, 10)) > 20
  && pts.some(q => q !== p && String(q.date).slice(0, 7) === String(p.date).slice(0, 7))));

function monthlyPace() {
  const pts = sansDoublonDeCloture(historySeries({ includeNow: false }));
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    out.push({ label: pts[i].label, date: pts[i].date, note: pts[i].comment,
               depuis: prochainJour(pts[i - 1].date),
               mois: moisEntre(pts[i - 1].date, pts[i].date),
               delta: num(pts[i].net) - num(pts[i - 1].net), total: pts[i].total });
  }
  return statsRythme(out);
}

const PACE_WINDOW = 12;
function paceRecent() {
  return statsRythme(monthlyPace().points.slice(-PACE_WINDOW));
}

/* --- UNE CESSION, QUEL QUE SOIT L'ACTIF ------------------------------------

   ACTIF CEDE -> PRODUIT -> DESTINATION -> EFFET SUR LE PATRIMOINE, et la meme
   mecanique pour une action, un bitcoin, des parts de societe ou une montre.
   Ce qui change d'un actif a l'autre est la facon de reduire SA ligne -- une
   quantite pour une ligne cotee, un prorata pour un placement saisi -- et la
   fenetre qui le demande. Ce qui ne change jamais vit ici : ou le produit peut
   aller, comment il y entre, et ce que l'enregistrement en garde.

   UNE VENTE NE CREE NI NE DETRUIT DE PATRIMOINE A ELLE SEULE. L'actif sort a
   sa valeur, le produit entre en cash : si les deux se valent, le patrimoine
   n'a pas bouge, seule sa forme a change. La plus-value latente etait deja
   dans la valeur ; la realiser ne l'ajoute pas une seconde fois. L'effet d'une
   cession sur le patrimoine suivi vaut donc ce qui est credite moins ce qui
   sort, et rien d'autre.

   TROIS DESTINATIONS, ET L'ENREGISTREMENT DIT LAQUELLE.
     `auto`     le compte de courtage qui portait l'actif, quand il a une
                vraie poche de cash : le produit d'une vente y reste.
     `choisie`  un compte de liquidites que le detenteur designe : des parts de
                societe n'ont pas de cash a elles.
     `hors`     aucun compte suivi n'est alimente. L'actif sort, rien n'entre :
                le patrimoine suivi baisse, ce qui n'est pas une perte mais une
                sortie du perimetre, et l'historique le garde comme telle. */

/* Un compte a-t-il une vraie poche de liquidites ? Son type le dit, sauf pour
   un contrat qui n'en tient pas (`sansCash`) ; et un compte dont le modele
   represente deja le cash -- un portefeuille crypto qui garde des euros -- en a
   une, quel que soit son type. Jamais une ligne, jamais une participation. */
function peutPorterCash(c) {
  if (!c) return false;
  const t = typeCompte(c.type) || {};
  if (t.sansCash) return false;
  return (t.classes || []).includes('liquidites') || (c.cash || []).length > 0;
}

/* Les comptes qui paient un achat pose sur `id` : lui-meme s'il tient du cash,
   sinon -- un contrat sans poche de liquidites -- les comptes suivis qui en
   tiennent, d'ou part le versement. */
const contratSansCash = id => !!(typeCompte(compteById(id)?.type) || {}).sansCash;
const comptesQuiPaient = id => contratSansCash(id) ? cashTargets() : [compteById(id)];
const aideDebitAjout = id => contratSansCash(id)
  ? trad('coche si tu viens de verser cet argent depuis un compte suivi')
  : trad('décoche si tu déclares une ligne que tu détiens déjà');

function cashTargets() {
  const ouverts = comptesOuverts().filter(peutPorterCash);
  return [
    ...ouverts.filter(c => typeCompte(c.type).titres),
    ...ouverts.filter(c => !typeCompte(c.type).titres),
  ];
}

/* La destination qui ne se demande pas : le compte de courtage de l'actif,
   s'il porte du cash. `null` quand il faut la choisir. */
function destinationAuto(accountId) {
  const c = compteById(accountId);
  return c && c.statut !== 'archive' && (typeCompte(c.type) || {}).titres && peutPorterCash(c) ? c.id : null;
}

function defaultCashTarget(accountId) {
  const auto = destinationAuto(accountId);
  if (auto) return auto;
  const cibles = cashTargets();
  return (cibles.find(c => c.type === 'courant') || cibles.find(c => !typeCompte(c.type).titres)
          || cibles[0] || {}).id || '';
}

/* =============================================================
   LES PARTS D'ESPECES, DESIGNEES ET JAMAIS DEDUITES
   =============================================================

   Un mouvement d'especes vise toujours une PART : { compteId, partie }, ou
   `partie` est l'affectation d'une part existante du compte. Un ancien compte
   du modele `now` n'a qu'une part, 'solde'. Rien ne cree une part au passage :
   un achat paye depuis un compte courant debitait une part "a investir"
   creee a zero, et le solde devenait negatif alors que le compte avait
   l'argent.

   Une affectation est unique dans un compte. Un compte ou deux parts la
   partagent est ambigu : il ne sert ni de source ni de destination tant que
   la fiche n'est pas corrigee. */
const PARTIE_ANCIENNE = 'solde';

function partiesDeCash(compteId) {
  const c = compteById(compteId);
  if (c) {
    const cash = c.cash || [];
    const nb = {};
    for (const e of cash) nb[e.affectation] = (nb[e.affectation] || 0) + 1;
    const ambigu = Object.values(nb).some(n => n > 1);
    return cash.map(e => ({ compteId: c.id, partie: e.affectation, montant: round2(num(e.montant)),
                            ambigue: ambigu, archive: c.statut === 'archive' }));
  }
  if (ACC[compteId] && !ACC[compteId].holdings)
    return [{ compteId, partie: PARTIE_ANCIENNE, montant: round2(num(Store.state.now[compteId])),
              ambigue: false, archive: false }];
  return [];
}
const partieDe = (compteId, partie) => partiesDeCash(compteId).find(x => x.partie === partie) || null;

/* La part proposee par defaut : celle de l'affectation naturelle du type de
   compte, sinon la seule part s'il n'y en a qu'une. Sinon `null`, et il faut
   choisir : une preselection n'est pas une autorisation. */
function partieSuggeree(compteId, { credit = false } = {}) {
  const ps = partiesDeCash(compteId).filter(x => !x.ambigue);
  const c = compteById(compteId);
  const defaut = c && (typeCompte(c.type) || {}).defaut;
  const x = ps.find(y => y.partie === defaut) || (ps.length === 1 ? ps[0] : null);
  if (x) return x.partie;
  if (credit && c && !partiesDeCash(compteId).length && defaut && peutPorterCash(c)) return defaut + '+';
  return null;
}

function partieDeVente(v) {
  if (v.cashPart) return v.cashPart;
  return compteById(v.cashAccount) ? 'investir' : PARTIE_ANCIENNE;
}

/* Pourquoi un mouvement ne peut pas se faire, ou `null`. Un montant nul ne
   bouge rien et passe toujours. */
function verifierMouvement(compteId, montant, partie) {
  const m = round2(num(montant));
  if (!m) return null;
  if (/\+$/.test(partie || '')) {
    const c = compteById(compteId), aff = partie.slice(0, -1);
    if (!c || !peutPorterCash(c) || (c.cash || []).length || aff !== (typeCompte(c.type) || {}).defaut)
      return trad('Cette part d’espèces n’existe pas sur ce compte.');
    if (c.statut === 'archive') return trad('Ce compte est archivé : restaure-le d’abord.');
    if (m < 0) return trad('Il n’y a que {m} sur cette part.').replace('{m}', fmtEUR(0));
    if (!nombreValide(m, 'montant')) return trad('Ce montant dépasserait ce qu’un solde peut porter.');
    return null;
  }
  const x = compteId ? partieDe(compteId, partie) : null;
  if (!x) return trad('Cette part d’espèces n’existe pas sur ce compte.');
  if (x.archive) return trad('Ce compte est archivé : restaure-le d’abord.');
  if (x.ambigue) return trad('Deux parts de ce compte portent la même affectation : corrige la fiche du compte.');
  const apres = round2(x.montant + m);
  if (apres < -0.005) return trad('Il n’y a que {m} sur cette part.').replace('{m}', fmtEUR(x.montant));
  if (!nombreValide(apres, 'montant')) return trad('Ce montant dépasserait ce qu’un solde peut porter.');
  return null;
}

function mouvementCash(compteId, montant, partie) {
  const m = round2(num(montant));
  if (!compteId || !m) return false;
  if (verifierMouvement(compteId, m, partie)) return false;
  const c = compteById(compteId);
  if (c) {
    const aff = String(partie).replace(/\+$/, '');
    c.cash = c.cash || [];
    let e = c.cash.find(x => x.affectation === aff);
    if (!e) { e = { montant: 0, affectation: aff }; c.cash.push(e); }
    e.montant = round2(num(e.montant) + m);
    return true;
  }
  Store.state.now[compteId] = round2(num(Store.state.now[compteId]) + m);
  return true;
}

/* Le taux qui convertit une devise vers la devise de base, ou `null` s'il n'est
   pas connu de facon fiable : recu au dernier rafraichissement, pour CETTE
   devise de base. Le 1 pose a la creation d'une ligne n'est jamais un taux. */
function tauxDeChange(devise) {
  const base = deviseBase();
  if (!devise || devise === base) return 1;
  const q = Store.state.quotes || {};
  if (q.fxBase !== base) return null;
  const t = num(q.fx && q.fx[devise]);
  return t > 0 ? t : null;
}

const dateISOValide = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
  && isoDeDate(new Date(s + 'T00:00:00')) === s;

/* Un achat sur une ligne detenue : tout se verifie, puis tout s'ecrit.
   `source` vaut { compteId, partie } ou null, quand on ne touche pas aux
   especes. Rend { erreur, cle } ou ce que l'achat ecrira. */
function verifierAchat({ index, qty, price, base, source }) {
  const p = Store.state.positions[index];
  if (!p) return { erreur: trad('Cette ligne n’existe plus.') };
  const q = num(qty), pu = num(price);
  if (!(q > 0) || !nombreValide(qty, 'quantite')) return { cle: 'qty', erreur: trad('Indique une quantité achetée.') };
  if (!(pu > 0) || !nombreValide(price, 'prix')) return { cle: 'price', erreur: trad('Indique un prix unitaire.') };
  const anciennes = num(p.qty);
  const pruAvant = num(p.buyPrice) || num(base);
  if (anciennes > 0 && !(pruAvant > 0)) return { cle: 'basePrice', erreur: trad('Indique le prix de revient des titres déjà détenus.') };
  const qtyFinale = roundQty(anciennes + q);
  if (!nombreValide(qtyFinale, 'quantite')) return { cle: 'qty', erreur: trad('La quantité détenue dépasserait ce qu’une ligne peut porter.') };
  const cout = q * pu;
  const pru = round4((anciennes * pruAvant + cout) / qtyFinale);
  if (!nombreValide(cout, 'montant') || !nombreValide(pru, 'prix'))
    return { cle: 'qty', erreur: trad('Ce montant dépasse ce qu’un achat peut porter.') };
  if (!nombreValide(round2(qtyFinale * pru), 'montant')
      || !nombreValide(round2(qtyFinale * pru * (tauxAchat(p) || 1)), 'montant'))
    return { cle: 'qty', erreur: trad('Le capital investi dépasserait ce qu’un montant peut porter.') };
  let coutBase = null;
  if (source) {
    const fx = tauxDeChange(p.currency || deviseBase());
    if (fx === null) return { cle: 'cash', erreur: trad('Le taux de change de ce titre n’est pas connu : actualise les cours, ou ne touche pas aux espèces.') };
    coutBase = round2(cout * fx);
    if (!(coutBase >= 0.01)) return { cle: 'cash', erreur: trad('Ce montant est trop petit pour être débité : ne touche pas aux espèces.') };
    const e = verifierMouvement(source.compteId, -coutBase, source.partie);
    if (e) return { cle: 'cash', erreur: e };
  }
  return { qtyFinale, pru, cout, coutBase };
}
function acheterTitres(args) {
  const r = verifierAchat(args);
  if (r.erreur) return r;
  const p = Store.state.positions[args.index];
  if (args.source && !mouvementCash(args.source.compteId, -r.coutBase, args.source.partie))
    return { erreur: trad('Rien n’a été modifié.') };
  p.buyPrice = r.pru;
  p.qty = r.qtyFinale;
  return { ...r, debite: !!args.source };
}

function verifierAjout({ qty, buyPrice, brouillon, debit }) {
  if (!brouillon || !brouillon.devise || !(num(brouillon.fx) > 0) || !nombreValide(brouillon.fx, 'change'))
    return { erreur: trad('La cotation de ce titre est indisponible pour l’instant : réessaie dans un moment.') };
  if (!nombreValide(qty, 'quantite') || !nombreValide(buyPrice, 'prix'))
    return { erreur: trad('Quantité ou prix impossible.') };
  const cout = num(qty) * num(buyPrice);
  if (!nombreValide(cout, 'montant')) return { erreur: trad('Ce montant dépasse ce qu’un achat peut porter.') };
  const coutBase = round2(cout * num(brouillon.fx));
  if (!nombreValide(coutBase, 'montant')) return { erreur: trad('Ce montant dépasse ce qu’un achat peut porter.') };
  if (debit && cout > 0) {
    if (!(coutBase >= 0.01)) return { erreur: trad('Ce montant est trop petit pour être débité : ne touche pas aux espèces.'), debit: true };
    const e = verifierMouvement(debit.compteId, -coutBase, debit.partie);
    if (e) return { erreur: e, debit: true };
  }
  return { coutBase };
}
function creerLigneAchetee({ ligne, brouillon, debit }) {
  const r = verifierAjout({ qty: ligne.qty, buyPrice: ligne.buyPrice, brouillon, debit });
  if (r.erreur) return r;
  const etranger = brouillon.devise !== deviseBase();
  const aDebiter = !!(debit && r.coutBase > 0);
  if (aDebiter && !mouvementCash(debit.compteId, -r.coutBase, debit.partie)) return { erreur: trad('Rien n’a été modifié.') };
  Store.state.positions.push({
    ...ligne, currency: brouillon.devise, fx: num(brouillon.fx),
    fxBuy: etranger ? num(brouillon.fx) : 1,
    price: num(brouillon.cours) || 0,
  });
  return { index: Store.state.positions.length - 1, coutBase: r.coutBase, debite: aDebiter };
}

/* Une vente de titres : pourquoi elle ne peut pas se faire, ou `null`. */
function verifierVente({ index, qty, price, fxSell, cashAccount, cashPart, date }) {
  const p = Store.state.positions[index];
  if (!p) return trad('Cette ligne n’existe plus.');
  if (!dateISOValide(date)) return trad('Indique la date de la vente.');
  const q = num(qty);
  if (!(q > 0) || q > num(p.qty) + 1e-9 || !nombreValide(qty, 'quantite')) return trad('Quantité impossible.');
  if (price === '' || price == null) return trad('Indique le prix de vente.');
  if (!(num(price) >= 0) || !nombreValide(price, 'prix')) return trad('Prix de vente impossible.');
  if ((p.currency || deviseBase()) !== deviseBase() && !(num(fxSell) > 0 && nombreValide(fxSell, 'change')))
    return trad('Indique le taux de change de la vente.');
  const ap = salePreview(p, qty, price, fxSell);
  if (!nombreValide(ap.gross, 'montant')) return trad('Le produit de cette vente dépasse ce qu’un montant peut porter.');
  if (ap.realised != null && !nombreValide(ap.realised, 'signe')) return trad('Le résultat de cette vente dépasse ce qu’un montant peut porter.');
  if (!nombreValide(round2(ap.invested), 'montant')) return trad('Le capital investi de cette vente dépasse ce qu’un montant peut porter.');
  if (cashAccount) {
    const e = verifierMouvement(cashAccount, ap.gross, cashPart);
    if (e) return e;
  }
  return null;
}

/* Une cession de non cote : pourquoi elle ne peut pas se faire, ou `null`. */
function verifierCession({ compteId, index, parts, produit, capital, cashAccount, cashPart, date }) {
  const c = compteById(compteId);
  const l = c && (c.lignes || [])[index];
  if (!l) return trad('Ce placement n’existe plus.');
  if (!dateISOValide(date)) return trad('Indique la date de la cession.');
  if (produit === '' || produit == null) return trad('Indique le montant reçu, zéro s’il n’y en a pas.');
  if (!(num(produit) >= 0) || !nombreValide(produit, 'montant')) return trad('Montant reçu impossible.');
  if (capital != null && capital !== '' && !nombreValide(capital, 'montant')) return trad('Capital remboursé impossible.');
  const t = typeCompte(c.type) || {};
  const partsTotal = num(l.parts);
  if (t.parts && partsTotal > 0 && parts != null && parts !== ''
      && !(num(parts) > 0 && num(parts) <= partsTotal + 1e-9))
    return trad('Tu ne peux céder qu’entre une part et les {n} détenues.').replace('{n}', String(partsTotal));
  if (capital != null && capital !== '' && num(l.valeur) > 0 && num(capital) > num(l.valeur) + 0.005)
    return trad('Le capital remboursé dépasse la valeur du placement.');
  const a = apercuCession(l, t, { parts, produit, capital });
  if (!a.partOk || !(a.fraction > 0)) return trad('Rien à enregistrer');
  if (a.realised != null && !nombreValide(a.realised, 'signe')) return trad('Le résultat de cette cession dépasse ce qu’un montant peut porter.');
  if (cashAccount && num(a.produit)) {
    const e = verifierMouvement(cashAccount, a.produit, cashPart);
    if (e) return e;
  }
  return null;
}

function verifierDeclaration({ date, name, gross, realised }) {
  if (!String(name || '').trim()) return trad('Indique ce qui a été vendu.');
  if (!dateISOValide(date)) return trad('Indique la date de la vente.');
  if (gross === '' || gross == null) return trad('Indique le montant encaissé.');
  if (realised === '' || realised == null) return trad('Indique le résultat de la vente.');
  const g = num(gross), r = num(realised);
  if (!(g >= 0) || !nombreValide(gross, 'montant')) return trad('Montant encaissé impossible.');
  if (!nombreValide(realised, 'signe')) return trad('Résultat impossible.');
  if (!nombreValide(round2(g - r), 'montant')) return trad('Ce résultat supposerait un prix de revient impossible.');
  return null;
}

/* Une annulation : pourquoi elle ne peut pas se faire, ou `null`. Un produit
   nul n'avait rien credite, il n'y a rien a reprendre. */
function verifierAnnulation(i) {
  const v = (Store.state.sales || [])[i];
  if (!v) return trad('Cette vente n’existe plus.');
  if (v.declaree) return null;
  const src = compteById(v.account);
  if (v.cession) {
    if (!src) return trad('Le compte de ce placement n’existe plus : la cession ne peut pas s’annuler.');
    if (src.statut === 'archive' && !v.compteArchive) return trad('Le compte de ce placement est archivé : restaure-le d’abord.');
    if (!v.ligne) {
      const l = (src.lignes || [])[num(v.ligneIndex)];
      if (!l || (v.actifId && l.id !== v.actifId) || (v.ligneApres && ligneAChange(l, v.ligneApres)))
        return trad('Le placement cédé en partie a changé depuis : la cession ne peut pas s’annuler.');
    }
  } else {
    if (!src) return trad('Le compte qui portait cette ligne n’existe plus : la vente ne peut pas s’annuler.');
    if (src.statut === 'archive') return trad('Le compte qui portait cette ligne est archivé : restaure-le d’abord.');
    const p = ligneDeLaVente(v);
    if (p) {
      const q = roundQty(num(p.qty) + num(v.qty));
      if (!nombreValide(q, 'quantite') || !nombreValide(round2(q * pruApresAnnulation(p, v) * (tauxAchat(p) || 1)), 'montant'))
        return trad('Annuler cette vente ferait dépasser à la ligne ce qu’elle peut porter.');
    }
  }
  if (perimetreDeVente(v) === 'interne' && round2(num(v.gross))) {
    const e = verifierMouvement(v.cashAccount, -round2(num(v.gross)), partieDeVente(v));
    if (e) return `${trad('Annuler cette vente reprendrait {m} au compte qui les a reçus.').replace('{m}', fmtEUR(num(v.gross)))} ${e}`;
  }
  return null;
}

function perimetreDeVente(v) {
  if (!v) return null;
  if (v.perimetre) return v.perimetre;
  if (v.declaree) return 'memoire';
  return v.cashAccount ? 'interne' : 'sortie';
}
function destinationDeVente(v) {
  if (!v || v.declaree) return null;
  if (v.destination) return v.destination;
  if (!v.cashAccount) return 'hors';
  return v.cashAccount === v.account ? 'auto' : 'choisie';
}

/* Les champs communs a toute cession, ecrits au meme endroit : identite de
   l'actif, destination, et ce qui a quitte le patrimoine. `credite` dit si le
   produit est bien entre dans un compte suivi ; un produit nul n'a rien fait
   sortir. */
function champsCession({ actifId, typeActif, source, destination, credite, produit, sortie }) {
  return {
    actifId: actifId || '', typeActif,
    destination: !destination ? 'hors' : destination === destinationAuto(source) ? 'auto' : 'choisie',
    perimetre: credite || !num(produit) ? 'interne' : 'sortie',
    sortie: round2(num(sortie)),
  };
}

function salePreview(p, qty, price, fxSell) {
  const q = num(qty), pu = num(price), fx = num(fxSell) || 1;
  const brut = round2(q * pu * fx);
  /* Le meme taux que la plus-value latente, et par la meme fonction : une vente
     calculee sur un `fxBuy` de 1 aurait realise une perte de change inexistante. */
  const pruUnitaire = num(p.buyPrice) * tauxAchat(p);
  const investi = q * pruUnitaire;
  /* Sans prix de revient, le resultat n'existe pas : il valait tout le produit.
     `invested` reste le calcul, l'annulation d'une vente n'en depend pas. */
  const connu = num(p.buyPrice) > 0;
  return {
    qty: q, gross: brut, invested: investi,
    realised: connu ? round2(brut - investi) : null,
    pct: connu && investi ? (brut / investi - 1) * 100 : null,
    remaining: num(p.qty) - q,
    full: q >= num(p.qty),
  };
}

function sellPosition({ index, qty, price, fxSell, cashAccount, cashPart, date, note }) {
  const erreur = verifierVente({ index, qty, price, fxSell, cashAccount, cashPart, date });
  if (erreur) return { erreur };
  const p = Store.state.positions[index];
  const ap = salePreview(p, qty, price, fxSell);

  const sortie = num(p.qty) > 0 ? posValue(p) * ap.qty / num(p.qty) : 0;
  const credite = mouvementCash(cashAccount, ap.gross, cashPart);
  if (cashAccount && round2(ap.gross) !== 0 && !credite) return { erreur: trad('Rien n’a été modifié.') };

  Store.state.sales = Store.state.sales || [];
  Store.state.sales.unshift({
    id: 's' + Date.now(),
    date,
    name: p.name, isin: p.isin || '', symbol: p.symbol || '',
    assetClass: assetClassDe(p), role: roleDe(p), account: p.account, cashAccount: cashAccount || '',
    ...(cashAccount ? { cashPart: String(cashPart || '').replace(/\+$/, '') } : {}),
    qty: ap.qty, price: num(price), currency: p.currency || 'EUR',
    fxSell: num(fxSell) || 1, buyPrice: num(p.buyPrice), fxBuy: tauxAchat(p),
    gross: round2(ap.gross), invested: ap.invested,
    realised: ap.realised == null ? null : round2(round2(ap.gross) - ap.invested),
    note: note || '',
    ...champsCession({ actifId: p.id, typeActif: 'titre', source: p.account,
                       destination: cashAccount, credite, produit: ap.gross, sortie }),
  });

  if (ap.full) Store.state.positions.splice(index, 1);
  else p.qty = roundQty(num(p.qty) - ap.qty);

  return ap;
}

/* --- CEDER UN PLACEMENT NON COTE ----------------------------------------

   POURQUOI CETTE PORTE EXISTE. Une ligne cotee se vendait ; tout le reste ne
   pouvait que s'archiver, et archiver ne dit rien de l'argent. La valeur
   quittait le patrimoine, le produit encaisse se retapait a la main en rentree,
   et la plus-value realisee n'entrait nulle part — ni au journal, ni dans la
   performance. Sur la courbe, la baisse tombait dans « ce qui ne vient pas du
   budget », c'est-a-dire dans la case de ce qu'on n'explique pas. Un total
   egale la somme de ses parts, et une sortie de quinze mille euros ne peut pas
   etre une difference inexpliquee.

   L'asymetrie etait a l'envers du besoin : une ligne cotee se revend tous les
   jours et avait tout le mecanisme ; un non cote se cede une fois en cinq ans,
   c'est l'evenement dont on veut le plus garder la trace, et il n'avait rien.

   TROIS NATURES, UNE SEULE MECANIQUE. Ce qui change est le mot et ce que le
   detenteur sait dire ; le calcul, lui, ne change jamais — un produit encaisse,
   un investi qui s'en va, la difference au journal.

     `vente`         des parts de societe, un fonds non cote, un bien detenu en
                     direct. Totale ou partielle.
     `remboursement` un financement participatif qui rend du capital, et des
                     interets par-dessus.
     `defaut`        le meme, qui ne rend que ce qu'il a pu. Le produit peut
                     etre nul, et la moins-value est alors tout l'investi.

   LE PRORATA EST LA SEULE FACON HONNETE DE COUPER UNE LIGNE EN DEUX. Ceder
   deux mille parts sur quatre mille sort la moitie de l'investi et la moitie de
   la valeur : le prix de revient unitaire ne bouge pas, exactement comme pour
   une ligne cotee, et la ligne qui reste vaut ce qu'elle valait par part.

   ET C'EST LE MEME JOURNAL QUE LES VENTES DE TITRES. Deux journaux auraient
   demande deux ecrans, deux totaux annuels et deux facons de compter une
   plus-value — donc, tot ou tard, deux chiffres qui se contredisent. La
   difference se dit par un mot porte sur l'enregistrement, pas par une seconde
   liste. */
function apercuCession(l, t, { parts, produit, capital } = {}) {
  const q = partDetention(l);
  /* Une quote-part invalide interdit le calcul plutot que de l'inventer : c'est
     deja ce que `lignesDe()` fait des montants d'une telle ligne. */
  const partOk = q !== null;
  const valeurEntiere = num(l && l.valeur);
  /* `null` quand le cout n'est pas connu, et il le reste jusqu'au bout : un
     `|| 0` en faisait un cout nul, et la cession de parts dont personne n'a
     jamais saisi le prix d'achat inscrivait tout le produit en plus-value. Un
     cout nul DECLARE (prix, frais et travaux a zero) vaut zero, lui. */
  const coutEntier = coutAcquisition(l);
  const partsTotal = num(l && l.parts);
  const aParts = !!(t && t.parts) && partsTotal > 0;

  let fraction = 1;
  if (aParts) fraction = num(parts) / partsTotal;
  else if (capital != null && valeurEntiere > 0) fraction = num(capital) / valeurEntiere;
  fraction = Math.min(1, Math.max(0, fraction));

  const g = round2(num(produit));
  const investi = coutEntier === null ? null : partOk ? round2(coutEntier * q * fraction) : 0;
  const sortie = partOk ? round2(valeurEntiere * q * fraction) : 0;
  return {
    fraction, partOk,
    parts: aParts ? num(parts) : null,
    partsRestantes: aParts ? roundQty(partsTotal - num(parts)) : null,
    produit: g,
    investi,
    sortie,
    realised: investi === null ? null : round2(g - investi),
    pct: investi > 0 ? (g / investi - 1) * 100 : null,
    totale: fraction >= 0.9999,
  };
}

/* Applique la cession : journalise, credite le cash, reduit ou retire la ligne.

   L'ORDRE N'EST PAS LIBRE. On lit la ligne AVANT de la reduire, et le journal
   emporte de quoi tout defaire — pour une cession totale, la ligne elle-meme.
   C'est ce que fait deja `sellPosition()` avec la quantite et le prix de
   revient : un enregistrement qui ne porte pas de quoi s'annuler oblige a
   deviner, et deviner un patrimoine ne se fait pas. */
function cederPlacement({ compteId, index, nature = 'vente', parts, produit,
                          capital, cashAccount, cashPart, date, note } = {}) {
  const c = compteById(compteId);
  if (!c) return null;
  const l = (c.lignes || [])[index];
  if (!l) return null;
  const t = typeCompte(c.type);
  const a = apercuCession(l, t, { parts, produit, capital });
  if (!a.partOk) return null;
  if (!(a.fraction > 0)) return null;
  const erreur = verifierCession({ compteId, index, parts, produit, capital, cashAccount, cashPart, date });
  if (erreur) return { erreur };

  const credite = mouvementCash(cashAccount, a.produit, cashPart);
  if (cashAccount && round2(a.produit) !== 0 && !credite) return { erreur: trad('Rien n’a été modifié.') };

  Store.state.sales = Store.state.sales || [];
  Store.state.sales.unshift({
    id: 's' + Date.now(),
    date,
    name: l.libelle || nomCompteV2(c),
    isin: '', symbol: '',
    assetClass: l.classe || 'nonCote', role: '',
    account: c.id, cashAccount: cashAccount || '',
    ...(cashAccount ? { cashPart: String(cashPart || '').replace(/\+$/, '') } : {}),
    /* Les parts tiennent lieu de quantite, et les deux prix unitaires s'en
       derivent : le journal les affiche deja, et une cession de parts est une
       vente de quantite comme une autre. Sans parts, les trois restent nuls —
       `declarerVente()` a ouvert cette voie, le journal sait la lire. */
    qty: a.parts, currency: 'EUR', fxSell: 1, fxBuy: 1,
    price: a.parts ? round2(a.produit / a.parts) : null,
    buyPrice: a.parts && a.investi !== null ? round2(a.investi / a.parts) : null,
    gross: round2(a.produit), invested: a.investi,
    realised: a.realised === null ? null : round2(round2(a.produit) - a.investi),
    note: note || '',
    /* Ce qui distingue cette ligne d'une vente de titres, et ce qu'il faut pour
       la defaire. `sortie` n'est pas `gross` : c'est la valeur retiree du
       patrimoine, et l'annulation la rend telle quelle. */
    cession: nature, ligneIndex: index,
    ...champsCession({ actifId: l.id, typeActif: 'placement', source: c.id,
                       destination: cashAccount, credite, produit: a.produit, sortie: a.sortie }),
    ...(a.totale ? { ligne: structuredClone(l) } : {}),
  });

  if (a.totale) {
    c.lignes.splice(index, 1);
    const vide = !(c.lignes || []).length
      && !(c.cash || []).some(e => num(e.montant));
    if (estActifTerminal(t) && vide) {
      c.statut = 'archive';
      c.clotureLe = date;
      Store.state.sales[0].compteArchive = true;
    }
  } else {
    const avantCession = photoLigne(l);
    const reste = 1 - a.fraction;
    l.valeur = round2(num(l.valeur) * reste);
    if (estDeclare(l.prixDeRevient)) l.prixDeRevient = round2(num(l.prixDeRevient) * reste);
    for (const cle of ['prixAchat', 'fraisAcquisition', 'travauxInitiaux']) {
      if (estDeclare(l[cle])) l[cle] = round2(num(l[cle]) * reste);
    }
    if (a.parts != null) l.parts = roundQty(num(l.parts) - a.parts);
    Store.state.sales[0].ligneAvant = avantCession;
    Store.state.sales[0].ligneApres = photoLigne(l);
  }

  return a;
}

/*   C'est la reponse au chantier note dans ETAT.md : noter une vente sur un
   PEA cloture demandait de recreer le compte, la ligne, de vendre, puis
   d'archiver — quatre gestes pour fabriquer un fait passe. Ici la vente
   entre au journal telle qu'on s'en souvient, et n'ecrit RIEN d'autre :
   pas de position reduite (on ne la detient plus), pas de cash credite
   (il est arrive sur le compte il y a des annees), pas un euro de
   patrimoine — un test le verifie.

   Elle porte `declaree: true` : l'ecran la marque, et l'annulation sait
   qu'elle n'a rien a rendre. Deux montants saisis — l'encaisse et le
   resultat — et le prix de revient s'en derive : c'est ce qu'on sait
   encore d'une vente d'il y a trois ans. */
function declarerVente({ date, name, gross, realised, note }) {
  const erreur = verifierDeclaration({ date, name, gross, realised });
  if (erreur) return { erreur };
  Store.state.sales = Store.state.sales || [];
  const g = num(gross), r = num(realised);
  Store.state.sales.unshift({
    id: 's' + Date.now(),
    date,
    name: String(name || '').trim(), isin: '', symbol: '',
    assetClass: '', role: '', account: '', cashAccount: '',
    qty: null, price: null, currency: 'EUR',
    fxSell: 1, buyPrice: null, fxBuy: 1,
    gross: g, invested: round2(g - r), realised: r,
    note: note || '',
    declaree: true,
  });
  return Store.state.sales[0];
}

function annulerVente(i) {
  const v = (Store.state.sales || [])[i];
  if (!v) return null;

  if (v.declaree) {
    Store.state.sales.splice(i, 1);
    return v;
  }

  /* Une cession de non cote ne rend pas des titres : elle rend une ligne de
     placement, ou une part de celle-ci. Derouler la suite pousserait une
     position fantome dans `positions` — un actif non cote apparaissant comme
     une ligne de titres cotee, avec un prix et un cours. */
  const erreur = verifierAnnulation(i);
  if (erreur) return { erreur };
  const t = enTransaction(() => annulerSansVerifier(i) !== false);
  return t.ok ? v : { erreur: trad('Rien n’a été modifié.') };
}

const CHAMPS_CEDES = ['valeur', 'prixDeRevient', 'prixAchat', 'fraisAcquisition', 'travauxInitiaux', 'parts'];
const photoLigne = l => Object.fromEntries(CHAMPS_CEDES.filter(k => l[k] !== undefined).map(k => [k, l[k]]));
function ligneAChange(l, photo) {
  return CHAMPS_CEDES.some(k => {
    const a = l[k] !== undefined, b = photo[k] !== undefined;
    if (a !== b) return true;
    if (!a) return false;
    if ((l[k] === null) !== (photo[k] === null)) return true;
    if (estDeclare(l[k]) !== estDeclare(photo[k])) return true;
    return Math.abs(num(l[k]) - num(photo[k])) > (k === 'parts' ? 1e-9 : 0.005);
  });
}

function ligneDeLaVente(v) {
  return Store.state.positions.find(q => q.account === v.account
    && ((v.isin && q.isin === v.isin)
        || (!v.isin && v.symbol && q.symbol === v.symbol)
        || (!v.isin && !v.symbol && q.name === v.name)));
}
function pruApresAnnulation(p, v) {
  const q0 = num(p.qty), q1 = num(v.qty), b0 = num(p.buyPrice), b1 = num(v.buyPrice);
  if (!(q0 + q1 > 0) || !(b0 > 0) || !(b1 > 0)) return p.buyPrice;
  return round4((q0 * b0 + q1 * b1) / (q0 + q1));
}

function annulerSansVerifier(i) {
  const v = Store.state.sales[i];
  if (v.cession) return annulerCessionSansVerifier(i, v);

  if (perimetreDeVente(v) === 'interne' && round2(num(v.gross))
      && !mouvementCash(v.cashAccount, -round2(num(v.gross)), partieDeVente(v))) return false;

  const p = ligneDeLaVente(v);
  if (p) {
    p.buyPrice = pruApresAnnulation(p, v);
    p.qty = roundQty(num(p.qty) + num(v.qty));
  } else {
    Store.state.positions.push({
      id: 'p' + Date.now(), name: v.name, isin: v.isin || '', symbol: v.symbol || '',
      currency: v.currency || 'EUR', qty: num(v.qty),
      buyPrice: num(v.buyPrice), price: num(v.price),
      fx: num(v.fxSell) || 1, fxBuy: num(v.fxBuy) || 1,
      account: v.account, manual: false,
      assetClass: v.assetClass || '', role: v.role || '',
    });
  }

  Store.state.sales.splice(i, 1);
  return v;
}

function annulerCession(i, v) {
  const erreur = verifierAnnulation(i);
  if (erreur) return { erreur };
  const t = enTransaction(() => annulerCessionSansVerifier(i, Store.state.sales[i]) !== false);
  return t.ok ? v : { erreur: trad('Rien n’a été modifié.') };
}
function annulerCessionSansVerifier(i, v) {
  if (perimetreDeVente(v) === 'interne' && round2(num(v.gross))
      && !mouvementCash(v.cashAccount, -round2(num(v.gross)), partieDeVente(v))) return false;

  const c = compteById(v.account);
  if (c) {
    c.lignes = c.lignes || [];
    if (v.ligne) {
      c.lignes.splice(Math.min(num(v.ligneIndex), c.lignes.length), 0, structuredClone(v.ligne));
    } else {
      const l = c.lignes[num(v.ligneIndex)];
      if (l && v.ligneAvant) {
        for (const k of CHAMPS_CEDES) {
          if (v.ligneAvant[k] !== undefined) l[k] = v.ligneAvant[k]; else delete l[k];
        }
      } else if (l) {
        const q = partDetention(l) || 1;
        l.valeur = round2(num(l.valeur) + num(v.sortie) / q);
        if (estDeclare(l.prixDeRevient)) {
          l.prixDeRevient = round2(num(l.prixDeRevient) + num(v.invested) / q);
        }
        if (num(v.qty)) l.parts = roundQty(num(l.parts) + num(v.qty));
      }
    }
    if (v.compteArchive) { c.statut = 'ouvert'; delete c.clotureLe; }
  }

  Store.state.sales.splice(i, 1);
  return v;
}

function rangeStart(range) {
  if (!range || range === 'all') return null;
  /* Une annee vaut son 1er janvier. La garde est ici et pas seulement chez
     l'appelant : sans elle, `parseInt('2025')` faisait remonter de deux mille ans
     et la plage rendait tout, sans erreur nulle part. */
  if (estAnnee(range)) return `${range}-01-01`;
  const now = new Date();
  const d = range === 'ytd'
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear() - (parseInt(range, 10) || 1), now.getMonth(), now.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Les totaux d'une liste de ventes, quelle qu'elle soit.

   Extrait de `salesStats`, qui commençait par choisir ses ventes sur une plage
   glissante. Le journal les choisit désormais par année, et refaire ces cinq
   sommes à côté aurait donné deux façons de compter la même chose — celle qu'on
   oublie de corriger finit par contredire l'autre. Le filtre reste à l'appelant,
   le calcul est ici. */
const estNombre = x => x !== null && x !== undefined && x !== '' && isFinite(Number(x));
function resultatVente(v) {
  const non = raison => ({ montant: null, fiable: false, raison });
  if (!v) return non('resultat');
  const sansCout = !v.declaree && (v.cession ? v.invested == null : !(num(v.buyPrice) > 0));
  if (sansCout) return non('prixDeRevient');
  if (!estNombre(v.realised)) return non('resultat');
  const r = Number(v.realised);
  if (!v.declaree) {
    if (!estNombre(v.gross) || !estNombre(v.invested)) return non('historique');
    const attendu = Number(v.gross) - Number(v.invested);
    if (Math.abs(r - attendu) > 0.05) return non('incoherent');
  }
  return { montant: r, fiable: true, raison: null };
}

function statsDesVentes(ventes) {
  /* Les sommes ne portent que sur les ventes fiables : une vente sans base ne
     compte ni pour zero ni pour son produit. `partiel` le dit. */
  const fiables = ventes.filter(v => resultatVente(v).fiable);
  const realised = fiables.reduce((s, v) => s + Number(v.realised), 0);
  const invested = fiables.reduce((s, v) => s + num(v.invested), 0);
  const grossFiables = fiables.reduce((s, v) => s + num(v.gross), 0);
  return {
    sales: ventes, count: ventes.length,
    realised, invested,
    fiables: fiables.length, nonFiables: ventes.length - fiables.length, grossFiables,
    partiel: fiables.length < ventes.length,
    gross: ventes.reduce((s, v) => s + num(v.gross), 0),
    /* `null` et non 0 : sans vente, ou sans prix de revient sur celles qui
       existent, il n'y a pas de base. Le zero s'affichait « +0,00 % » sur une
       plage vide, ce qui affirme une performance nulle la ou il n'y a rien eu.
       La regle de la maison, deja tenue par `deltas()` : un pourcentage
       n'existe que sur une base positive, et l'ecran se contente de l'euro. */
    pct: invested > 0 ? realised / invested * 100 : null,
    wins: fiables.filter(v => Number(v.realised) > 0).length,
  };
}

function salesStats(range) {
  const { debut, fin } = rangeBornes(range);
  const ventes = (Store.state.sales || []).filter(v => {
    const d = String(v.date || '');
    return (!debut || d >= debut) && (!fin || d <= fin);
  });
  return statsDesVentes(ventes);
}

const anneesDesVentes = () => anneesPresentes((Store.state.sales || []).map(v => v.date));
const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomCorrespond = (nom, requete) => {
  const q = sansAccents(String(requete || '').trim());
  return !q || sansAccents(nom).includes(q);
};
function grouperParMois(lignes, lireDate) {
  const groupes = [];
  for (const x of lignes) {
    const mois = String(lireDate(x) || '').slice(0, 7);
    const g = groupes[groupes.length - 1];
    if (g && g.mois === mois) g.lignes.push(x);
    else groupes.push({ mois, lignes: [x] });
  }
  return groupes;
}
/* Le journal des ventes d'une plage. Par date, du plus recent au plus ancien,
   groupe par mois avec le sous-total du resultat ; par montant, un classement
   global, pertes en fin, sans mois : grouper detruirait le classement. `rang`
   est la place de chaque vente dans l'etat, celle que la fiche d'une vente lit. */
function journalVentes({ range, tri = 'date', requete = '' } = {}) {
  const toutes = Store.state.sales || [];
  const rang = new Map(toutes.map((v, i) => [v, i]));
  const periode = salesStats(range).sales;
  const retenues = periode.filter(v => nomCorrespond(v.name, requete));
  const cle = v => { const r = resultatVente(v); return r.fiable ? r.montant : -Infinity; };
  const lignes = tri === 'montant'
    ? retenues.slice().sort((a, b) => (cle(b) - cle(a)) || rang.get(a) - rang.get(b))
    : retenues.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))
                                      || rang.get(a) - rang.get(b));
  const groupes = tri === 'montant' ? null : grouperParMois(lignes, v => v.date).map(g => {
    const fiables = g.lignes.filter(v => resultatVente(v).fiable);
    return { ...g, partiel: fiables.length < g.lignes.length,
             sousTotal: fiables.length ? round2(fiables.reduce((s, v) => s + Number(v.realised), 0)) : null };
  });
  return { lignes, groupes, total: periode.length, rang };
}
function journalAchats({ range, requete = '' } = {}) {
  const periode = achatsSurPlage(range);
  const lignes = periode.filter(a => nomCorrespond(a.name, requete));
  return { lignes, groupes: grouperParMois(lignes, a => a.date), total: periode.length };
}
const anneesDesTransactions = () => anneesPresentes([
  ...(Store.state.sales || []).map(v => v.date), ...(Store.state.purchases || []).map(a => a.date)]);
function anneeParDefautTransactions(aujourdhui = todayISO()) {
  const annees = anneesDesTransactions().map(String);
  if (!annees.length) return 'all';
  const courante = String(aujourdhui).slice(0, 4);
  return annees.includes(courante) ? courante : annees[0];
}

/* Y a-t-il au moins une position de marche ?

   Une position de marche, c'est une ligne de `Store.state.positions` : celle
   dont le cours arrive du marche, par opposition aux placements dont c'est le
   detenteur qui donne la valeur et qui vivent dans `compte.lignes`.

   Le TYPE DE COMPTE ne dit rien, et c'est le piege a eviter : un PEA qui porte
   un ETF monde en a une, un compte-titres vide n'en a aucune. Un compte a
   titres ouvert se voit poser une entree de liquidites a investir, mais dans
   `compte.cash` et jamais dans `positions` : un compte vide reste vide.

   La CLASSE non plus : actions, obligations, foncieres cotees, metaux par ETC,
   fonds cotes, crypto vivent toutes dans cette liste, et la vue Marches les
   rend toutes sans distinction. Filtrer par classe reviendrait a tenir une
   seconde liste a cote de la premiere, et c'est le defaut qui revient le plus
   souvent ici.

   Une fonction plutot qu'un `positions.length` recopie : la condition se lit a
   cinq endroits, et cinq variantes finissent par ne plus dire la meme chose. */
function aDesPositionsMarche() {
  return (Store.state.positions || []).length > 0;
}

/* LA REPARTITION DU PORTEFEUILLE DE MARCHE, LIGNE PAR LIGNE.

   La page dit ou est l'argent, toutes poches confondues. Celui qui detient des
   titres a une seconde question, qu'aucune carte ne pose : a quoi ressemble son
   portefeuille. C'est celle-la qu'on lit partout ailleurs, et c'est un anneau
   qu'on attend pour y repondre.

   ELLE N'EXISTE QUE CHEZ QUI EN A. Rend `null` sans position : un anneau vide
   sous un titre qui parle de portefeuille apprendrait a quelqu'un qu'il lui
   manque quelque chose qui ne lui manque pas. Meme regle que la cloche, qui ne
   reclame pas d'actualiser des cours a qui n'a aucun titre.

   CE QU'ELLE NE DIT PAS, ET C'EST LA RESERVE QUI COMPTE : un fonds est UNE
   ligne. Un portefeuille d'un seul ETF monde donne une part de 100 % et n'est
   pas concentre pour autant. Une repartition par zone geographique ou par
   secteur, agregee a partir de classements devines du libelle, laisserait
   croire l'inverse. Celle-ci ne devine rien : elle repartit des montants connus,
   et sa bulle dit ce qu'elle compte.

   DEUX LECTURES, ET CHACUNE A SA REGLE. Le TABLEAU montre une a une toutes les
   lignes qui pesent au moins `SEUIL_LIGNE_PORTEFEUILLE_PCT` du total : un
   plafond en nombre cacherait des positions de plusieurs pour cent sous Autres.
   Seules les lignes sous le seuil se regroupent, et le groupe se deplie. Au-dela
   de `LIGNES_TABLEAU_PORTEFEUILLE` lignes, les suivantes se replient derriere
   Voir toutes les lignes, sans jamais quitter le tableau. L'ANNEAU, lui, est
   une synthese : au plus `TRANCHES_ANNEAU_PORTEFEUILLE` tranches, et ce qui n'en
   a pas une a soi rejoint la tranche du reste. Chaque ligne dit si elle a sa
   tranche (`tranche`), pour que la vue ne lui prete pas une couleur qu'elle n'a
   pas sur l'anneau.

   LES NON POSITIVES SORTENT, ET SE COMPTENT. Une part negative n'existe pas sur
   un anneau. Ce qui est ecarte se compte plutot que de laisser un total qui ne
   se retrouve pas, comme le fait deja `latentPnl()`.

   Et le total rendu est la SOMME DES PARTS RENDUES, pas un second calcul : les
   pourcentages tombent donc toujours a cent, et le pied du tableau redonne
   exactement ce que l'anneau dessine. */
const SEUIL_LIGNE_PORTEFEUILLE_PCT = 1;
const TRANCHES_ANNEAU_PORTEFEUILLE = 8;
/* Jusqu'a ce nombre de lignes, le tableau les montre toutes ; au-dela, il en
   montre `LIGNES_TABLEAU_REPLIEES` et replie le reste. L'ecart entre les deux
   evite de replier trois lignes pour offrir un bouton qui en montre trois. */
const LIGNES_TABLEAU_PORTEFEUILLE = 15;
const LIGNES_TABLEAU_REPLIEES = 10;
function repartitionPortefeuille() {
  /* CE QU'ELLE COUVRE EST EXACTEMENT LA BASE DU PORTEFEUILLE, ni plus ni moins.

     `basePortefeuilleMarches()` additionne trois choses : les positions cotees,
     les lignes manuelles des comptes de marche — un fonds d'assurance-vie n'a
     pas de cours, il n'en est pas moins detenu — et le cash qui attend d'etre
     investi. N'en prendre qu'une aurait donne au meme nom deux montants sur
     deux ecrans, ce que ce projet traque partout ailleurs : « Liquidites » a
     deja valu deux choses sur deux pages, les deux totaux justes.

     LE CASH EST UNE PART, PAS UN OUBLI. Quelqu'un dont un cinquieme du
     portefeuille dort en attendant un point d'entree doit le VOIR sur son
     anneau : c'est une allocation, pas un detail comptable. Et il ne se fait
     jamais absorber par « Autres » — il n'est pas une ligne plus petite que les
     autres, c'est la part qui n'est pas investie. */
  const lignes = [
    ...Store.state.positions.map(p => ({
      label: String(p.name || '').trim() || trad('Sans nom'), value: posValue(p) })),
    ...comptesOuverts()
      .filter(c => typeCompte(c.type).groupe === 'bourse')
      .flatMap(c => (c.lignes || []).map(l => ({
        label: String(l.libelle || '').trim() || trad('Sans nom'), value: num(l.valeur) }))),
  ].filter(x => Number.isFinite(x.value));

  const gardees = lignes.filter(x => x.value > 0.005).sort((a, b) => b.value - a.value);
  const attente = round2(poches().investir);
  const aPart = attente > 0.005
    ? [{ label: trad('À investir'), value: attente, attente: true }] : [];
  if (!gardees.length && !aPart.length) return null;

  const detail = gardees.map(x => ({ label: x.label, value: round2(x.value) }));
  const somme = xs => round2(xs.reduce((s, x) => s + x.value, 0));
  const total = round2(somme(detail) + somme(aPart));
  const pct = v => (total > 0 ? (v / total) * 100 : null);
  const avecPct = x => ({ ...x, pct: pct(x.value) });

  const auSeuil = x => x.value / total * 100 + 1e-9 >= SEUIL_LIGNE_PORTEFEUILLE_PCT;
  let visibles = detail.filter(auSeuil);
  let petites = detail.filter(x => !auSeuil(x));
  if (petites.length === 1) { visibles = detail; petites = []; }

  const places = TRANCHES_ANNEAU_PORTEFEUILLE - aPart.length;
  const aSoi = visibles.length + (petites.length ? 1 : 0) <= places
    ? visibles.length : places - 1;
  const reste = [...visibles.slice(aSoi), ...petites];
  const cash = aPart.length ? { ...avecPct(aPart[0]), tranche: aSoi } : null;
  const lignesTableau = visibles.map((x, i) => ({
    ...avecPct(x), tranche: i < aSoi ? i : null,
    replie: visibles.length > LIGNES_TABLEAU_PORTEFEUILLE && i >= LIGNES_TABLEAU_REPLIEES,
  }));
  const repliees = lignesTableau.filter(x => x.replie);
  const autres = petites.length
    ? { label: trad('Autres'), reste: true, tranche: null, ...avecPct({ value: somme(petites) }),
        lignes: petites.map(x => ({ ...avecPct(x), tranche: null })) }
    : null;
  const resteAnneau = reste.length
    ? { label: reste.length === petites.length ? trad('Autres') : trad('Reste du portefeuille'),
        reste: true, tranche: null, nb: reste.length, ...avecPct({ value: somme(reste) }) }
    : null;
  return {
    total,
    tableau: {
      lignes: lignesTableau,
      repliees: repliees.length ? { nb: repliees.length, ...avecPct({ value: somme(repliees) }) } : null,
      autres, cash,
    },
    anneau: [...lignesTableau.slice(0, aSoi), ...(resteAnneau ? [resteAnneau] : []), ...(cash ? [cash] : [])],
    resteAnneau,
    /* Ce qui est ecarte se compte plutot que de laisser un total qui ne se
       retrouve pas, comme le fait deja `latentPnl()`. Une part negative
       n'existe pas sur un anneau. */
    ecartees: lignes.length - gardees.length,
  };
}

function latentPnl(ps = Store.state.positions) {
  /* La valeur est connue de toutes les lignes ; le resultat, non.

     Le total soustrayait un prix de revient partiel d'une valeur complete : une
     ligne sans base entrait dans `value` et pour zero dans `invested`, donc sa
     valeur entiere ressortait en plus-value. Une seule ligne pesait la moitie
     du resultat affiche.

     Le resultat se calcule donc sur les lignes qui ont une base, des deux
     cotes. `value` ne bouge pas : c'est le portefeuille, il est connu, et c'est
     lui qu'affichent la carte d'accueil et le panneau de la valeur. Ce qui est
     ecarte se compte, pour que l'ecran puisse le dire au lieu de laisser une
     somme qui ne se retrouve pas. */
  const value = ps.reduce((s, p) => s + posValue(p), 0);
  const avecBase = ps.filter(p => posInvested(p) !== 0);
  const invested = avecBase.reduce((s, p) => s + posInvested(p), 0);
  const valeurAvecBase = avecBase.reduce((s, p) => s + posValue(p), 0);
  return { value, invested, pnl: valeurAvecBase - invested,
           pct: invested > 0 ? (valeurAvecBase / invested - 1) * 100 : null,
           winners: avecBase.filter(p => posPerfEur(p) > 0).length,
           count: ps.length, avecBase: avecBase.length,
           sansBase: ps.length - avecBase.length,
           valeurSansBase: value - valeurAvecBase };
}

/* --- l'ecart du non cote, tenu a part -----------------------------------
   `latentPnl()` ne lit que `positions` : le non cote, l'immobilier et les biens
   n'apparaissaient donc nulle part dans la page Performance, alors qu'ils
   portent souvent la moitie d'un patrimoine et qu'un prix de revient y est
   saisi.

   Une carte a part, et jamais un total commun avec les titres cotes. La raison
   n'est pas la prudence, c'est la nature du chiffre : une plus-value cotee est
   **constatee** — un cours l'a fixee, un tiers la publie — tandis qu'une
   plus-value non cotee est **declaree**, c'est le detenteur qui a ecrit la valeur
   du jour. Les additionner produirait une performance dont une part est une
   opinion, sans que rien ne le signale, et le jour ou une valorisation bouge de
   5 000 EUR le total sauterait comme si un marche avait bouge.

   D'ou `estimeLe` remonte ici : l'age de la valeur fait partie du chiffre. Une
   plus-value declaree il y a trois ans ne vaut pas celle d'hier, et c'est la
   seule difference que la carte peut montrer honnetement. */
function latentNonCote() {
  const lignes = [];
  for (const c of comptesOuverts()) {
    for (const l of lignesDe(c)) {
      /* Les lignes de marche ont leur propre carte : `marche` les designe, et non
         une liste de classes ecrite ici — un ETF immobilier est cote. */
      if (l.marche) continue;
      const invested = num(l.prixDeRevient);
      if (!(invested > 0)) continue;          // sans prix paye, aucun ecart a dire
      lignes.push({
        nom: nomLignePlacement(l, c), compte: c, compteId: c.id, classe: l.classe,
        value: num(l.valeur), invested,
        pnl: num(l.valeur) - invested,
        pct: (num(l.valeur) / invested - 1) * 100,
        estimeLe: l.estimeLe || null,
        vieille: valeurPerimee(l, typeCompte(c.type)),
      });
    }
  }
  lignes.sort((a, b) => b.value - a.value);
  const value = lignes.reduce((s, x) => s + x.value, 0);
  const invested = lignes.reduce((s, x) => s + x.invested, 0);
  return {
    lignes, value, invested, pnl: value - invested,
    pct: invested > 0 ? (value / invested - 1) * 100 : null,
    aRevoir: lignes.filter(x => x.vieille).length,
  };
}

function salesYears() {
  const ans = [...new Set((Store.state.sales || []).map(v => String(v.date).slice(0, 4)))];
  return ans.sort();
}

const PROJECTION_HORIZONS = [3, 5, 10, 15, 20];

/* Horizons proposés dans la liste déroulante : les repères du tableau, puis des
   paliers de cinq ans jusqu'à 80 — de quoi couvrir une vie d'épargne entière.

   Les cinq repères en étaient exclus, au motif qu'ils figuraient déjà dans le
   tableau. Le raisonnement se tenait sur la redondance et ratait l'essentiel :
   choisir un horizon ne désigne pas une ligne, il change toute la page — le
   total en tête, la courbe, et la ligne mise en avant, qui suit `projHorizon`.
   Le menu commençait donc à vingt-cinq ans, et tout le monde n'a pas
   vingt-cinq ans devant soi.

   La liste se dérive des repères, elle ne les recopie pas : deux listes écrites
   à la main pour une seule vérité finissent par se contredire, et c'est celle
   qu'on oublie de changer qui ment. */
const PROJECTION_CHOICES = [...new Set([
  ...PROJECTION_HORIZONS,
  ...Array.from({ length: 16 }, (_, i) => (i + 1) * 5),
])].sort((a, b) => a - b);

/* Trois jeux d'hypotheses nommes, et un quatrieme qui n'en est pas un.

   Personne ne sait quel rendement la bourse fera. Demander « quel rendement
   annuel pour les actifs de marche ? » a quelqu'un qui ouvre l'application, c'est
   lui demander de deviner a notre place : il repondra au hasard, et lira ensuite
   sa reponse comme une prevision. Un scenario nomme dit exactement ce que c'est
   — une hypothese de travail, prudente, centrale ou dynamique — et deplace la
   question de « combien ? » a « plutot prudent ou plutot optimiste ? », a
   laquelle tout le monde peut repondre.

   Les valeurs sont NOMINALES et annuelles. L'inflation se retire ensuite, une
   fois, sur le total : c'est le champ `real` de chaque point.

   Le non cote reste a zero dans les trois. Une participation dans une societe ne
   progresse pas de 8 % par an parce que la bourse le fait ; sa valeur ne bouge
   qu'au prochain tour de table ou a la revente, dates qu'aucun calcul ne connait.
   Zero ne veut pas dire « ça ne vaudra rien de plus », mais « l'application ne
   suppose rien ». C'est le seul cote ou se tromper est sans consequence.

   Les liquidites aussi : un livret non declare remunere ne rapporte rien, et le
   supposer gonflerait un patrimoine sans qu'on l'ait demande.

   Le capital garanti, lui, rapporte quelque chose de connu d'avance a un ordre
   de grandeur pres — un fonds euros, un livret regemente. Il suit donc le
   scenario, plus prudemment que le marche.

   Ces valeurs se modifient ici, et nulle part ailleurs. */
const SCENARIOS_PROJECTION = [
  ['prudent',   'Prudent',   { marche: 4, autres: 0, garanti: 2,   liquidites: 0 }],
  ['central',   'Central',   { marche: 6, autres: 0, garanti: 2.5, liquidites: 0 }],
  ['dynamique', 'Dynamique', { marche: 8, autres: 0, garanti: 3,   liquidites: 0 }],
];
const TAUX_SCENARIO = Object.fromEntries(SCENARIOS_PROJECTION.map(([c, , r]) => [c, r]));
const SCENARIO_DEFAUT = 'central';

/* Les hypotheses qu'un scenario gouverne, derivees de la table elle-meme.

   L'inflation n'en fait pas partie, et ce n'est pas un oubli : aucune entree de
   SCENARIOS_PROJECTION ne la porte, elle vit dans `meta.projInflation` et se
   regle seule. La regler ne doit donc pas faire basculer en personnalise --
   sinon quelqu'un qui passe l'inflation a 3 % quitterait « Central » sans avoir
   touche a un seul rendement.

   Ecrire la liste a la main aurait suffi aujourd'hui, et aurait menti le jour ou
   une poche s'ajoute : c'est le defaut que ce fichier traque partout. */
const POCHES_SCENARIO = Object.keys(SCENARIOS_PROJECTION[0][2]);

function detecteScenario(taux) {
  const trouve = SCENARIOS_PROJECTION.find(([, , preset]) =>
    POCHES_SCENARIO.every(k => Math.abs(num(taux[k]) - num(preset[k])) < 1e-9));
  return trouve ? trouve[0] : 'perso';
}

const TAUX_PROJECTION = ['meta.projRate', 'meta.projRateAutres',
                         'meta.projRateGaranti'];

const nomScenario = cle => (Object.fromEntries(
  SCENARIOS_PROJECTION.map(([c, l]) => [c, l]))[cle] || 'Personnalisé');

const PHRASE_SCENARIO = {
  prudent: 'Hypothèses volontairement prudentes.',
  central: 'Hypothèses équilibrées pour une projection long terme.',
  dynamique: 'Hypothèses plus favorables, mais encore plausibles.',
  perso: 'Tes propres taux, posés plus bas.',
};

/* D'OU viennent les taux, et non a quoi ils ressemblent. Les deux questions ont
   vecu sous un seul nom, et c'est ce qui rendait le retour impossible : remettre
   6 % sur le marche laissait « personnalise » enfonce alors que les quatre
   valeurs etaient exactement celles de Central. `detecteScenario()` repond a la
   seconde question, celle que l'ecran pose.

   Celle-ci decide du calcul : la table d'un scenario nomme, ou l'etat. Et la
   migration silencieuse qu'il ne faut pas faire -- un etat qui porte deja des
   taux saisis a la main precede les scenarios. Lui appliquer « central »
   changerait sa courbe sans qu'il ait rien demande, et c'est exactement ce
   qu'une projection ne doit jamais faire. Ces etats-la lisent donc leurs propres
   chiffres, intacts. Les autres partent sur le scenario central. */
function sourceDesTaux() {
  const m = Store.state.meta;
  if (m.projScenario) return m.projScenario;
  const aDesTaux = [m.projRate, m.projRateGaranti, m.projRateAutres]
    .some(v => v !== undefined && v !== null && v !== '');
  return aDesTaux ? 'perso' : SCENARIO_DEFAUT;
}

/* --- L'AGE EXACT, PAR LE CALENDRIER --------------------------------------

   L'age qu'on aura a un point de la projection est la question qu'on se pose
   devant elle, et l'annee seule n'y repond pas. Il se calcule a partir d'une
   date de naissance et de la date REELLE du point projete, jamais d'une
   approximation en jours.

   CE QU'ON STOCKE EST LA DATE, PAS L'AGE. Un age range dans l'etat devient faux
   au premier anniversaire, en silence ; la date, elle, reste vraie pour
   toujours. C'est la meme regle que partout ici : on garde le fait, on derive
   l'affichage.

   La date de naissance est une donnee personnelle. Elle vit dans `meta`, sous la
   meme clef de stockage que le reste du patrimoine, et ne part vers rien
   d'autre : aucun calcul financier ne la lit, aucune adresse ne la porte. */
function dateNaissance() {
  const v = String(Store.state.meta?.naissance || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/* Annees completes et mois supplementaires entre deux dates.

   Le calcul se fait sur les composantes, jamais sur un ecart de millisecondes :
   « 365 jours = un an » se trompe d'un jour tous les quatre ans, et « 30 jours
   = un mois » se trompe tout le temps. On compare les annees, les mois, puis les
   jours, et on emprunte quand l'anniversaire du mois n'est pas encore passe.

   LE 29 FEVRIER. Quelqu'un ne d'un 29 fevrier a son anniversaire le 1er mars les
   annees non bissextiles : au 28 fevrier il lui manque un jour, donc un mois
   entier n'est pas revolu, et il a encore l'age de la veille. C'est la convention
   la plus repandue, et c'est celle qui tombe directement de la comparaison des
   jours — aucune regle speciale a ecrire.

   Rend `null` plutot que zero quand la date manque ou qu'elle est posterieure a
   la cible : un age inconnu n'est pas un age nul. */
function ageALaDate(naissance, cible) {
  const n = String(naissance || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const c = String(cible || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!n || !c) return null;
  let annees = +c[1] - +n[1];
  let mois = +c[2] - +n[2];
  if (+c[3] < +n[3]) mois -= 1;
  if (mois < 0) { annees -= 1; mois += 12; }
  if (annees < 0) return null;
  return { annees, mois };
}

function dateApresMois(depart, n) {
  const d = String(depart || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!d || !Number.isFinite(+n)) return null;
  const total = (+d[2] - 1) + Math.round(+n);
  const annee = +d[1] + Math.floor(total / 12);
  const mois = ((total % 12) + 12) % 12 + 1;
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const jour = Math.min(+d[3], dernier);
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/* L'age au point projete : la date de naissance declaree, la date que le moteur
   a reellement atteinte. `null` des que l'une des deux manque. */
function ageAuPoint(point) {
  const naissance = dateNaissance();
  if (!naissance || !point || !Number.isFinite(+point.mois)) return null;
  return ageALaDate(naissance, dateApresMois(todayISO(), point.mois));
}

function projectionSettings() {
  const m = Store.state.meta;
  const preset = TAUX_SCENARIO[sourceDesTaux()];
  const taux = (champ, cle) => (preset ? preset[cle] : num(m[champ]));
  const poches = Object.fromEntries(POCHES_SCENARIO.map(k => [k, 0]));
  poches.marche = taux('projRate', 'marche');
  poches.autres = taux('projRateAutres', 'autres');
  poches.garanti = taux('projRateGaranti', 'garanti');
  /* Zero veut dire zero.

     `num(m.projMonthly) || suggestedMonthly()` traiterait 0 comme une absence :
     en JavaScript zero est faux. Le menu offre pourtant 0 EUR / mois, et le
     choisir afficherait la suggestion du budget a la place -- un reglage qui
     refuse la valeur qu'il propose. Ce que devient le patrimoine sans plus rien
     investir est une question legitime, et c'est meme la plus utile de cette
     page.

     La distinction porte donc sur la presence de la clef, pas sur sa valeur.
     Une migration a un coup retire les zeros deja enregistres, qui voulaient
     dire automatique sous l'ancienne regle. */
  const regle = m.projMonthly !== undefined && m.projMonthly !== null
             && m.projMonthly !== '';
  return {
    scenario: detecteScenario(poches),
    monthly: regle ? num(m.projMonthly) : suggestedMonthly(),
    monthlyAuto: !regle,
    rate: poches.marche,
    /* Le rendement des « autres actifs » : crypto, metaux precieux, non cote.
       Zero par defaut, et c'est le pivot de tout le dispositif — personne ne
       voit ses chiffres bouger, l'application ne suggere aucun rendement sur ce
       qu'elle ne sait pas projeter, et le gel qu'on appliquait devient le cas
       particulier taux = 0. C'est a l'utilisateur de l'affirmer, pas a nous.

       Un seul champ pour les trois, et la clef ne change pas : `projRateAutres`
       porte ce nom depuis toujours et n'a jamais rien promis de plus fin. Un
       etat enregistre le retrouve donc tel quel. */
    rateAutres: poches.autres,
    rateGaranti: poches.garanti,
    versementVers: m.projVersementVers || 'marche',
    inflation: num(m.projInflation),
    target: num(m.projTarget),
  };
}

const VERSEMENT_VERS = [
  ['marche',     'Actifs de marché'],
  ['autres',     'Autres actifs'],
  ['garanti',    'Capital garanti'],
  ['liquidites', 'Liquidités'],
];

function repartitionVersement(s = projectionSettings()) {
  const nul = Object.fromEntries(VERSEMENT_VERS.map(([c]) => [c, 0]));
  const connue = VERSEMENT_VERS.some(([c]) => c === s.versementVers);
  return { ...nul, [connue ? s.versementVers : 'marche']: 1 };
}

/* Versement mensuel proposé par défaut : le cash que ton budget laisse
   vraiment, et rien d'autre.

   `investable` et non `theoretical` : le capital rembourse sur un credit
   augmente le patrimoine net, mais il n'est pas disponible pour investir. Le
   proposer comme versement mensuel le faisait capitaliser au taux des actifs de
   marche, alors qu'il est deja parti avec la mensualite. Le patrimoine en tenait
   compte deux fois : une fois par la dette qui baisse, une fois par un
   placement imaginaire.

   LE REPLI SUR LE RYTHME OBSERVE EST PARTI, et c'etait la meme faute d'un cran
   plus loin. `realPerMonth` mesure la VARIATION DU PATRIMOINE d'un mois sur
   l'autre : elle porte les gains de marche, la reevaluation d'un bien et le
   capital rembourse. La reinjecter comme versement mensuel faisait capitaliser
   la croissance sur elle-meme — une hausse de marche de 900 EUR devenait
   900 EUR verses chaque mois, qui produisaient a leur tour du rendement. La
   projection s'emballait d'autant plus que le patrimoine avait monte, ce qui est
   exactement l'inverse d'une prevision prudente.

   Sans budget, la suggestion vaut donc zero, et l'ecran le dit : « aucune
   capacite d'epargne positive connue ». Un zero annonce vaut mieux qu'un nombre
   dont personne ne peut dire d'ou il vient. `realPerMonth` reste rendu par
   `savingsReconciliation` : la carte du budget le montre comme rythme observe,
   ce qu'il est, et le compare a l'epargne theorique. */
function suggestedMonthly() {
  return Math.round(Math.max(0, savingsReconciliation().investable));
}

/* `plat` : la part du patrimoine que la projection porte sans lui appliquer de
   rendement, soit l'apport immobilier, la valeur du bien moins tout le capital
   restant du.

   Avant, un seul taux s'appliquait a l'ensemble du patrimoine net. L'apport
   d'un appartement capitalisait donc a 5 % par an comme un ETF, ce qu'un bien
   ne fait pas, et ce qui rendait fausse toute etiquette parlant de rendement
   boursier. Chaque poche a donc son taux -- actifs de marche, autres actifs,
   capital garanti, liquidites -- et un bien n'entre dans aucune : on ne prete un
   rendement qu'a ce qu'il decrit, et le reste est porte a plat.

   A plat et non exclu : l'apport reste dans le total, parce qu'il fait partie du
   patrimoine et qu'on veut le voir. On ne lui prete simplement aucune
   performance, ce qui est prudent et lisible, plutot qu'une performance
   inventee.

   L'amortissement du pret, lui, EST modelise : `moteurProjection` rembourse mois
   par mois et ajoute le capital rendu a cette part plate, qui monte donc toute
   seule. Ce commentaire disait le contraire, et un commentaire qui contredit le
   calcul fait douter du chiffre juste.

   La part plate peut etre negative : un credit a la consommation sans bien en
   face, ou un bien qui vaut moins que son pret. C'est honnete, et ca evite
   surtout de faire fondre une dette au rythme des marches. */
/* Les biens de valeur y rejoignent l'immobilier : une montre ne capitalise
   pas, elle est posee — la faire fructifier au taux du non cote serait le
   mensonge que cette poche refuse a un compte courant. Et sans elle nulle
   part, la somme des poches de projection cessait de faire le patrimoine
   net, la regle que ce fichier teste.

   LA PART GELEE EST EXACTEMENT CE QUE LE PERIMETRE FINANCIER ECARTE, moins
   toutes les dettes. Elle se lisait `immo + biens`, donc par les classes, et
   gelait ainsi une SCPI et le support immobilier d'une assurance-vie : cent
   mille euros de placement portes a plat pendant vingt ans, sans qu'un mot le
   dise. Les deux ecrans partagent un seul perimetre desormais, et la somme des
   poches fait le patrimoine net par construction plutot que par coincidence. */
function partPlate(t = nowTotals()) {
  return num(t.horsFinancier) - num(t.dettes);
}

/* La meme part, dite en deux lignes, et son total ne change pas d'un centime.

   Toutes les dettes restent a plat — les faire capitaliser avec l'actif
   qu'elles financent les ferait fondre au rythme des marches — mais elles ne
   sont pas toutes de l'immobilier. `biensNets` porte les biens detenus en
   direct moins les credits qui les financent, `autresDettes` tout le reste :
   un pret pour des parts de societe, un pret personnel, une dette sans
   destination connue. */
function partPlateDetail(t = nowTotals()) {
  const biens = num(t.horsFinancier);
  const dettesBiens = dettesDesBiensDirects();
  const autresDettes = num(t.dettes) - dettesBiens;
  return { biens, dettesBiens, biensNets: biens - dettesBiens, autresDettes,
           total: biens - dettesBiens - autresDettes };
}

/* Les trois poches de la projection, chacune avec son sort.

   Un seul taux s'appliquait a tout, et il ne decrivait qu'une partie de ce
   qu'il touchait : chez un patrimoine ou le non cote pese 38 % de la base,
   « rendement annuel attendu » faisait capitaliser au taux des actions des
   parts illiquides sans prix de marche, et un compte courant qui ne rapporte
   rien. Trois poches, et chacune dit ce qu'elle est.

   - `marche` : ce qui se cote. Les actifs de marche, la crypto, et le cash
     « a investir » — celui-la n'est pas encore place mais il va l'etre, c'est
     sa definition. Les versements mensuels le rejoignent, pour la meme raison.
   - `autres` : ce qui est pose sans se coter. Le non cote, le compte courant,
     l'epargne de precaution. Un taux propre, zero par defaut.
   - `plat` : les biens en direct nets de leurs credits, et les autres dettes,
     geles. Voir partPlate() et partPlateDetail().

   La propriete qui gouverne tout : la somme des trois fait le patrimoine net.
   Elle est testee, parce que c'est elle qui garantit qu'aucun euro ne se perd
   ni ne se dedouble en changeant de poche. */
/* La valeur des metaux precieux cotes, calculee a part et seulement pour ici.

   `POCHE_DE_CLASSE` fait `metaux -> actions`, donc `nowByGroup().bourse` les
   compte avec les actions. C'est juste partout ailleurs — un ETC or se vend en
   seance comme un ETF, et Allocation, l'autonomie financiere et l'historique en
   dependent — et faux dans la projection, ou cela revenait a supposer 6 % l'an
   sur de l'or parce qu'il se negocie sur un marche.

   Rien ne bouge dans les autres ecrans : cette fonction lit la classe fine, et
   Projection seule s'en sert pour deplacer la frontiere de ses poches.

   Les metaux n'existent qu'en position de marche : `CLASSES_ACTIFS`, la table
   des lignes saisies a la main, n'a pas cette classe. Le drapeau `projet` est
   teste quand meme — une position n'en porte pas aujourd'hui, et le jour ou elle
   en portera, `projetParPoche.bourse` retirerait ces euros une seconde fois. */
function valeurMetaux() {
  const ouverts = new Set(comptesOuverts().map(c => c.id));
  let v = 0;
  for (const pos of (Store.state.positions || [])) {
    if (!ouverts.has(pos.account) || pos.projet) continue;
    if (assetClassDe(pos) === 'metaux') v += posValue(pos);
  }
  return v;
}

function pochesProjection(t = nowTotals()) {
  const metaux = valeurMetaux();
  return {
    /* Chaque poche est amputee de ce qu'elle a de reserve : sans cela le total
       compterait ces euros deux fois, ici et dans `projet`. La regle de la
       maison, litteralement — un total egale la somme de ses parts. */
    marche: num(t.bourse) - num(t.projetParPoche?.bourse) - metaux,
    autres: num(t.crypto) - num(t.projetParPoche?.crypto)
          + num(t.pe) - num(t.projetParPoche?.nonCote)
          + num(t.immoPapier)
          + metaux,
    liquidites: num(t.cash),
    garanti: num(t.garanti) - num(t.projetParPoche?.garanti),
    projet: num(t.projet),
    get placees() {
      return this.marche + this.autres + this.garanti + this.liquidites + this.projet;
    },
    plat: partPlate(t),
  };
}

/* --- le moteur, et lui seul ---------------------------------------------

   Trois fonctions calculaient la meme courbe de trois facons. `capitalisation()`
   capitalisait poche par poche, mois par mois. `targetRequirements()` portait sa
   propre formule fermee d'annuite, qui faisait progresser TOUT le patrimoine
   financier au taux des actifs de marche : 10 000 EUR de non cote a 0 % et
   15 000 EUR de liquidites y rapportaient 6 % l'an. Elle annoncait donc un
   versement plus faible que celui qu'il faut vraiment, et la phrase « il
   faudrait verser X » contredisait la courbe affichee juste au-dessus.
   `targetReachedAt()` interpolait entre deux points annuels.

   Un seul noyau desormais, et les trois questions passent par lui. Une methode
   numerique coute quelques milliers d'operations flottantes — le prix d'un seul
   rendu — et supprime la seule chose qu'une formule fermee ne peut pas garantir
   ici : dire la meme chose que la courbe. */

function configProjection(opts = {}) {
  const s = Object.assign(projectionSettings(), opts);
  const t = nowTotals();
  const poches = pochesProjection(t);
  const plat = opts.plat != null ? num(opts.plat) : poches.plat;

  /* `start` est la base qui capitalise, entiere. Imposee, tout va au marche :
     c'est l'ancien comportement, et les appelants qui la forcent doivent
     continuer de le trouver. Sinon chaque poche part de sa propre valeur.

     Un prorata distribuait ce depart entre les poches quand `start` etait
     impose. Il n'est plus la : les poches sont connues une par une, et une
     repartition au prorata d'une somme qu'on possede deja n'apportait qu'un
     arrondi a rattraper. */
  const impose = opts.start != null;
  const start = impose ? num(opts.start) : poches.placees;
  const departMarche = impose ? start : poches.marche;
  const departAutres = impose ? 0 : poches.autres;
  const departGaranti = impose ? 0 : poches.garanti;
  const departLiquides = impose ? 0 : poches.liquidites + poches.projet;

  return {
    settings: s, start, plat, poches,
    marche: departMarche, autres: departAutres,
    garanti: departGaranti, liquidites: departLiquides,
    rate: s.rate, rateAutres: s.rateAutres, rateGaranti: s.rateGaranti,
    monthly: s.monthly, inflation: s.inflation, target: s.target,
    /* Quand `plat` ou `start` est impose, aucune dette n'est amortie : le
       patrimoine plat est alors une donnee d'entree, pas le solde d'un bien et
       d'un emprunt. */
    dettes: (impose || opts.plat != null) ? [] : dettesAmortissables(),
    fractions: impose
      ? { marche: 1, autres: 0, garanti: 0, liquidites: 0 }
      : repartitionVersement(s),
    mois: Math.round((opts.years || Math.max(...PROJECTION_HORIZONS)) * 12),
  };
}

/* Les dettes que la projection sait amortir, et leur echeancier mensuel.

   Le capital rembourse chaque mois augmente le patrimoine net : le bien ne
   bouge pas, la dette baisse. Ce n'est pas un versement financier — cet argent
   n'arrive sur aucun compte — donc il ne capitalise a aucun taux. Il entre dans
   `contributed`, comme un euro mis de cote, et jamais dans les gains.

   Une dette sans taux DECLARE ou sans mensualite reste constante : sans taux on
   ne sait pas separer capital et interets, et on ne devine pas. Meme regle que
   `capitalRembourseParMois()`, dont ceci est la version mois par mois.

   UN ZERO DECLARE EST UN TAUX. `num(d.taux)` rendait zero pour un pret familial
   a 0 % comme pour un pret dont personne n'a dit le taux, et le test `!taux`
   confondait les deux : le pret le plus simple a projeter — pas d'interets, la
   mensualite entiere en capital — etait le seul que la projection laissait
   constant. Sa dette ne descendait jamais, et le patrimoine net de dix ans
   plus tard etait faux de tout le capital rembourse.

   `tauxCreditDeclare` distingue le zero de l'ignorance, et c'est deja la porte
   qu'empruntent l'echeancier et la projection d'un credit : trois lecteurs, une
   seule convention. */
function dettesAmortissables() {
  const out = [];
  for (const e of ETABS()) {
    for (const d of (e.dettes || [])) {
      const reste = num(d.montant);
      const tauxAn = tauxCreditDeclare(d);
      const taux = (tauxAn || 0) / 100 / 12;
      const mens = mensualiteAmortissante(d);
      if (!reste || tauxAn === null || !mens) continue;
      const assurance = assuranceMensuelleCredit(d);
      if (mens - assurance <= reste * taux) continue;
      out.push({ reste, taux, mens: mens - assurance });
    }
  }
  return out;
}

function moteurProjection(c) {
  const parMois = taux => Math.pow(1 + num(taux) / 100, 1 / 12) - 1;
  const rMarche = parMois(c.rate);
  const rAutres = parMois(c.rateAutres);
  const rGaranti = parMois(c.rateGaranti);
  const f = c.fractions;
  const vm = c.monthly * f.marche, va = c.monthly * num(f.autres);
  const vg = c.monthly * f.garanti, vl = c.monthly * f.liquidites;

  let marche = c.marche, autres = num(c.autres);
  let garanti = c.garanti, liquidites = c.liquidites;
  const dettes = c.dettes.map(d => ({ ...d }));
  let capitalRendu = 0;

  const aujourdhui = new Date();
  const anneeDebut = aujourdhui.getFullYear();
  const moisDebut = aujourdhui.getMonth();
  const total0 = c.marche + num(c.autres) + c.garanti + c.liquidites + c.plat;
  /* Le point de depart passe par le MEME constructeur que les autres.

     Il etait ecrit a la main, et il portait donc quatre champs quand ses voisins
     en portent treize : ni `mois`, ni `plat`, ni `poches`, ni le detail des gains
     par poche. Une serie dont le premier point n'a pas la forme des suivants est
     un piege pose pour le prochain lecteur — une infobulle qui ventile la
     composition ne trouve rien a l'annee zero, et rien ne le dit avant l'ecran.

     `pointDe(0)` rend exactement les memes nombres : aucun mois n'a tourne, le
     capital rendu vaut zero, et les poches valent leur depart. */
  const points = [pointDe(0)];
  let atteinte = c.target > 0 && total0 >= c.target
    ? { dejaAtteinte: true, monthsFromNow: 0, yearsFromNow: 0,
        year: anneeDebut, month: moisDebut + 1 }
    : null;

  for (let mois = 1; mois <= c.mois; mois++) {
    marche = marche * (1 + rMarche) + vm;
    autres = autres * (1 + rAutres) + va;
    garanti = garanti * (1 + rGaranti) + vg;
    liquidites += vl;
    for (const d of dettes) {
      if (d.reste <= 0) continue;
      const capital = Math.min(d.reste, d.mens - d.reste * d.taux);
      d.reste -= capital;
      capitalRendu += capital;
    }

    const plat = c.plat + capitalRendu;
    const total = marche + autres + garanti + liquidites + plat;
    if (!atteinte && c.target > 0 && total >= c.target) {
      const date = new Date(anneeDebut, moisDebut + mois, 1);
      atteinte = { dejaAtteinte: false, monthsFromNow: mois,
                   yearsFromNow: mois / 12,
                   year: date.getFullYear(), month: date.getMonth() + 1 };
    }
    if (mois % 12 === 0) points.push(pointDe(mois));
  }

  /* Le point de sortie, toujours construit, meme quand l'horizon ne tombe pas
     sur une annee pleine : `points[points.length - 1]` rendait alors le point de
     DEPART, en silence, et `targetRequirements()` cherchait un versement contre
     un total qui n'avait pas bouge. Treize mois suffisaient a le declencher. */
  const final = c.mois > 0 && c.mois % 12 === 0
    ? points[points.length - 1] : pointDe(c.mois);

  return { points, atteinte, capitalRendu, final };

  function pointDe(mois) {
    const an = mois / 12;
    const plat = c.plat + capitalRendu;
    const total = marche + autres + garanti + liquidites + plat;
    const cumul = mois * c.monthly;
    const misMarche = c.marche + cumul * f.marche;
    const misAutres = num(c.autres) + cumul * num(f.autres);
    const misGaranti = c.garanti + cumul * f.garanti;
    const misLiquides = c.liquidites + cumul * f.liquidites;
    return {
      year: anneeDebut + Math.round(an), label: String(anneeDebut + Math.round(an)),
      mois,
      contributed: misMarche + misAutres + misGaranti + misLiquides + plat,
      gains: (marche - misMarche) + (autres - misAutres)
           + (garanti - misGaranti) + (liquidites - misLiquides),
      /* Un gain par poche, chacun sous le nom de sa poche. `gainsAutres`
         designait le non cote PLUS le garanti PLUS les liquidites, et la vue
         l'affichait sous l'intitule « Rendement du non cote » : le rendement
         d'un fonds euros se lisait donc comme celui de parts non cotees. Quatre
         noms exacts valent mieux qu'un raccourci qui se trompe. */
      gainsMarche: marche - misMarche,
      gainsAutres: autres - misAutres,
      gainsGaranti: garanti - misGaranti,
      gainsLiquidites: liquidites - misLiquides,
      poches: { marche, autres, garanti, liquidites, plat },
      capitalRendu, plat, total,
      real: total / Math.pow(1 + num(c.inflation) / 100, mois / 12),
    };
  }
}

function capitalisation(opts = {}) {
  const c = configProjection(opts);
  const r = moteurProjection(c);
  return { start: c.start, plat: c.plat, poches: c.poches,
           points: r.points, settings: c.settings,
           targetReached: r.atteinte,
           jalons: jalonsProjection(r.points, c.mois / 12) };
}

function jalonsProjection(points, annees) {
  const reperes = new Set(PROJECTION_HORIZONS.filter(h => h <= annees));
  for (let h = 30; h <= annees; h += 10) reperes.add(h);
  reperes.add(annees);
  return [...reperes].sort((a, b) => a - b)
    .filter(h => points[h])
    .map(h => Object.assign({ horizon: h }, points[h]));
}

const RECHERCHE_PAS = 40;          // 40 bissections : l'intervalle est divise par 2^40
const RECHERCHE_ANNEES_MAX = 60;   // au-dela, « attendre » n'est plus une reponse
const RECHERCHE_TAUX_MAX = 60;     // en % par an
const RECHERCHE_VERSEMENT_MAX = 1e7;

function targetRequirements({ target, years, opts = {} } = {}) {
  const base = configProjection(Object.assign({ years }, opts));
  const T = num(target != null ? target : base.target);
  const out = { reachable: false, years: null, monthly: null, rate: null };
  if (!(T > 0)) return out;

  const joue = modif => moteurProjection(Object.assign({}, base, modif));
  const atteint = modif => {
    const r = joue(modif);
    return r.final.total >= T;
  };

  /* Les poches de depart, nommees une par une : la somme du moteur, pas une
     seconde definition. Une poche renommee sans cette ligne rendait `undefined`,
     donc NaN, donc « cible non atteignable » sur un patrimoine qui la depasse
     deja — et rien a l'ecran pour le dire. */
  if (base.marche + base.autres + base.garanti + base.liquidites + base.plat >= T) {
    out.reachable = true;
    return out;
  }

  const long = joue({ mois: RECHERCHE_ANNEES_MAX * 12, target: T });
  if (long.atteinte) out.years = long.atteinte.monthsFromNow / 12;

  if (!atteint({ monthly: 0 })) {
    if (atteint({ monthly: RECHERCHE_VERSEMENT_MAX })) {
      let bas = 0, haut = RECHERCHE_VERSEMENT_MAX;
      for (let k = 0; k < RECHERCHE_PAS && haut - bas > 0.5; k++) {
        const milieu = (bas + haut) / 2;
        if (atteint({ monthly: milieu })) haut = milieu; else bas = milieu;
      }
      out.monthly = haut;
    }
  } else {
    out.monthly = 0;
  }

  if (base.marche > 0 || base.fractions.marche > 0) {
    if (atteint({ rate: RECHERCHE_TAUX_MAX })) {
      let bas = 0, haut = RECHERCHE_TAUX_MAX;
      for (let k = 0; k < RECHERCHE_PAS && haut - bas > 0.05; k++) {
        const milieu = (bas + haut) / 2;
        if (atteint({ rate: milieu })) haut = milieu; else bas = milieu;
      }
      out.rate = haut;
    }
  }
  return out;
}

function monthsToObjective() {
  const now = new Date();
  const y = num(Store.state.meta.objectiveYear) || now.getFullYear();
  return Math.max(0, (y - now.getFullYear()) * 12 + (11 - now.getMonth()));
}

function objectiveProjection() {
  const g = objectiveStatus();
  const pace = paceRecent();          // même fenêtre que la brique Épargne
  const rec = savingsReconciliation();
  const monthsLeft = monthsToObjective();

  const atPace = g.total + pace.average * monthsLeft;
  const atBudget = g.total + rec.theoretical * monthsLeft;
  const needed = monthsLeft ? (g.obj - g.total) / monthsLeft : 0;

  const pts = pace.points || [];
  return {
    monthsLeft, needed,
    atPace, atBudget,
    paceRate: pace.average, paceMonths: pace.count, budgetRate: rec.theoretical,
    paceMois: pace.mois || 0,
    paceDebut: pts.length ? String(pts[0].depuis || pts[0].date) : null,
    paceFin: pts.length ? String(pts[pts.length - 1].date) : null,
    onTrackPace: atPace >= g.obj,
    onTrackBudget: atBudget >= g.obj,
    gapAtPace: atPace - g.obj,
  };
}

/* --- ce que la cloche annonce -------------------------------------------
   Les contrôles de cohérence, rangés par ce qui presse. Ils vivaient enterrés
   au bas de la page Données, là où personne ne les cherchait.

   Une seule source, et c'est le point : j'ai d'abord ajouté ici les deux
   saisies en attente, avant de voir que `healthChecks` les portait déjà — deux
   listes du même fait, dont une seule respectait « Plus tard ». Les deux
   contrôles passent maintenant par `currentMonthPending` et
   `depensesEnAttente`, qui décident seuls qu'une saisie réclame quelque chose.

   `action` d'abord : ce sur quoi on peut agir tout de suite, avant les chiffres
   qu'il faut comprendre pour corriger. */
const RANG_NOTIF = { action: 0, error: 1, warn: 2, info: 3 };

const FAMILLES_NOTIF = [
  ['saisies',   trad('Saisies en attente'),    trad('Le relevé du mois, les dépenses du mois clos')],
  ['cours',     trad('Cours de bourse'),       trad('Prix périmés, ligne sans identifiant ou sans cours')],
  ['credits',   trad('Crédits'),               trad('Capital restant dû à vérifier, mensualité hors budget')],
  ['echeances', trad('Échéances du non coté'), trad('Remboursement attendu, retard, défaut')],
  ['budget',    'Budget',                trad('Objectif intenable, épargne de précaution')],
  ['coherence', trad('Cohérence des données'), trad('Un chiffre faux, ou impossible')],
  ['synchro',   trad('Synchronisation'),      trad('Une modification qui n’est pas partie')],
];

function cleNotif(n) {
  return String(n.level) + ':' + String(n.title)
    .toLowerCase()
    .replace(/[0-9][0-9\s.,%]*/g, ' ')
    .replace(/[^a-z\u00e0-\u00ff]+/g, '-')
    .replace(/^-|-$/g, '');
}

function reglagesNotifs() {
  const r = Store.state.meta?.notifsReglages || {};
  const out = {};
  for (const [cle] of FAMILLES_NOTIF) out[cle] = r[cle] !== false;
  return out;
}

function notifsMasquees() { return Store.state.meta?.notifsMasquees || []; }

function masquerNotif(cle) {
  const l = notifsMasquees();
  if (!l.includes(cle)) Store.state.meta.notifsMasquees = l.concat(cle);
}
function rendreNotifs() { Store.state.meta.notifsMasquees = []; }

function notifications() {
  const actives = reglagesNotifs();
  const masquees = notifsMasquees();
  return healthChecks()
    /* UNE CLEF PEUT ETRE DONNEE, ET C'EST PARFOIS NECESSAIRE. `cleNotif` derive
       la sienne du TITRE, qui est traduit : eteindre une ligne en francais ne
       l'eteignait pas en anglais, et un controle dont l'extinction commande
       autre chose ne peut pas reposer la-dessus. Une clef posee a la main ne
       depend d'aucune langue. */
    .filter(n => actives[n.sujet] !== false && !masquees.includes(n.cle || cleNotif(n)))
    .map(n => ({ ...n, cle: n.cle || cleNotif(n) }))
    .sort((a, b) => RANG_NOTIF[a.level] - RANG_NOTIF[b.level]);
}

const COURS_VIEUX_JOURS = 7;
const coursEnRoute = () => typeof Quotes !== 'undefined'
  && typeof Quotes.enCours === 'function' && Quotes.enCours();
const RAPPEL_CREDIT_MOIS = 3;
const SOLDE_VIEUX_JOURS = 31;

/* --- CE QUI MERITE D'ETRE RAFRAICHI AVANT UNE PHOTO -----------------------

   Un releve fige les montants du jour, et un montant perime y reste fige :
   une estimation d'il y a huit mois devient la valeur d'un mois qui n'a
   jamais eu ce chiffre. La liste se lit AVANT d'enregistrer, et elle ne
   bloque rien -- le detenteur sait peut-etre que sa montre n'a pas bouge.

   Cinq sources, chacune deja tenue ailleurs :
     `aVerifier()`      une valeur que la porte du modele a refusee ;
     `valeurPerimee()`  une estimation ou une VL plus vieille que sa cadence ;
     `saisiLe`          un solde saisi il y a plus d'un mois ; les soldes sans
                        date forment UNE entree, qui les nomme -- une ligne par
                        compte ferait une liste de tout ce qu'on n'a jamais date,
                        et le releve ne peut rien en dire de plus ;
     `verifieLe`        un capital restant du jamais vu, ou vu il y a trop
                        longtemps ;
     `quotes.lastRun`   des cours qui n'ont pas ete actualises.

   Le releve ne date rien de ce qu'il recopie : il fige, il ne verifie pas. */
/* --- CE QUI SE MET A JOUR A LA MAIN, ET DEPUIS QUAND ----------------------

   Une entree par valeur saisie a la main qui a vieilli ou qui n'a pas de date :
   un solde (plus de SOLDE_VIEUX_JOURS), une estimation ou une VL (la cadence de
   `valeurPerimee`), un capital restant du (jamais verifie, ou RAPPEL_CREDIT_MOIS).
   Les cours n'y sont pas : ils s'actualisent, ils ne se ressaisissent pas.

   Chaque entree dit ou aller : `route` mene a la fiche qui porte le champ, et
   `ancre` a la carte qui le porte dans cette fiche. Un capital restant du va
   sur la fiche du compte qu'il finance quand le lien existe, sur celle de
   l'etablissement sinon. `date` vaut null quand la valeur n'a pas de date, et
   c'est un etat a part entiere : « sans date » ne se confond pas avec « vieux ».
   Les sans date passent devant, une premiere saisie les datera ; les autres
   suivent, du plus ancien au plus recent.

   La liste d'avant releve (`aRafraichir`) se derive d'ici : deux listes ecrites
   a la main auraient fini par reclamer des choses differentes. */
function valeursARevoir() {
  const out = [];
  const routeCompte = c => `#/compte/${encodeURIComponent(c.id)}`;
  for (const c of comptesOuverts()) {
    const t = typeCompte(c.type);
    const s = datesDuCompte(c).find(x => x.genre === 'solde');
    if (s && (!s.date || joursDepuis(s.date) > SOLDE_VIEUX_JOURS)) {
      out.push({ genre: 'solde', nom: nomCompteV2(c), compteId: c.id, date: s.date || null,
                 route: routeCompte(c), ancre: 'solde' });
    }
    if (!(estValeurEstimee(t) || (t && t.vl))) continue;
    for (const l of (c.lignes || [])) {
      if (!estDeclare(l.valeur)) continue;
      if (!valeurPerimee(l, t)) continue;
      /* `publiee` : une VL se date du jour de sa publication, une estimation du
         jour ou on l'a etablie, et la phrase ne les nomme pas pareil. */
      out.push({ genre: 'estimation', nom: nomLignePlacement(l, c), compteId: c.id,
                 date: l.estimeLe || null, publiee: !!(t && t.vl),
                 route: routeCompte(c), ancre: 'estimation' });
    }
  }
  for (const d of creditsEnCours().lignes) {
    if (d.verifieLe && num(d.moisDepuis) < RAPPEL_CREDIT_MOIS) continue;
    const e = etabById(d.etabId);
    const dette = e && (e.dettes || [])[d.index];
    const c = e && dette ? compteFinanceParDette(dette, e) : null;
    out.push({ genre: 'credit', nom: d.libelle, etabId: d.etabId, compteId: c ? c.id : null,
               date: d.verifieLe || null,
               route: c ? routeCompte(c) : `#/etab/${encodeURIComponent(d.etabId)}`, ancre: 'credit' });
  }
  return out.sort((a, b) => (a.date ? 1 : 0) - (b.date ? 1 : 0)
    || String(a.date || '').localeCompare(String(b.date || '')));
}

function aRafraichir() {
  const out = [];
  for (const x of aVerifier()) out.push({ genre: 'aVerifier', nom: x.nom || x.chemin, depuis: null });
  const soldesSansDate = [];
  for (const x of valeursARevoir()) {
    if (x.genre === 'solde' && !x.date) { soldesSansDate.push(x.nom); continue; }
    if (x.genre === 'solde') out.push({ genre: 'solde', nom: x.nom, depuis: x.date, compteId: x.compteId });
    else if (x.genre === 'estimation') out.push({ genre: 'estimation', nom: x.nom, depuis: x.date,
                                                  compteId: x.compteId, publiee: x.publiee });
    else if (x.genre === 'credit') out.push({ genre: 'credit', nom: x.nom, depuis: x.date });
  }
  if (soldesSansDate.length) out.push({ genre: 'soldesSansDate', nom: '', noms: soldesSansDate, depuis: null });
  if (Store.state.positions.length && !coursEnRoute()) {
    const last = Store.state.quotes?.lastRun || null;
    if (!last || joursDepuis(last) > COURS_VIEUX_JOURS)
      out.push({ genre: 'cours', nom: '', depuis: last ? String(last).slice(0, 10) : null });
  }
  return out;
}

/* La geometrie des jauges du journal des releves, commune aux lignes affichees.

   L'echelle vaut trois fois la mediane des amplitudes, plafonnee par le
   maximum : un mois exceptionnel sature a pleine longueur au lieu de rendre
   tous les autres invisibles, et les mois ordinaires gardent des longueurs
   comparables. Le maximum borne la mediane pour une seule ligne ou une serie
   reguliere : un mois unique occupe toute sa longueur.

   Le zero n'est pas au milieu de la piste : il se place selon la plus grosse
   baisse et la plus grosse hausse affichees. La premiere touche le bord gauche,
   la seconde le bord droit, et un euro a la meme longueur des deux cotes
   jusqu'a la saturation. Sans baisse, le zero est au bord gauche et les hausses
   ont toute la piste ; un zero fixe au milieu n'en laisserait que la moitie a
   une annee presque toute en hausse. Le zero est le meme pour toutes les lignes,
   donc les barres se comparent d'une ligne a l'autre.

   `longueur` rend une fraction signee de la piste entiere. Une liste vide ou
   plate n'a pas d'echelle : longueurs nulles, zero au milieu, ou le point du
   mois plat se lit comme tel. */
function geometrieJauges(variations) {
  const amplitudes = (variations || []).map(v => Math.abs(num(v)))
    .filter(v => v > 0.005).sort((a, b) => a - b);
  const n = amplitudes.length;
  const mediane = !n ? 0
    : n % 2 ? amplitudes[(n - 1) / 2] : (amplitudes[n / 2 - 1] + amplitudes[n / 2]) / 2;
  const echelle = n ? Math.min(amplitudes[n - 1], 3 * mediane) : 0;
  const part = v => (echelle > 0 ? Math.max(-1, Math.min(1, num(v) / echelle)) : 0);
  const parts = (variations || []).map(part);
  const bas = Math.max(0, -Math.min(0, ...parts));
  const haut = Math.max(0, ...parts);
  const etendue = bas + haut;
  return {
    zero: etendue > 0 ? bas / etendue : 0.5,
    longueur: v => (etendue > 0 ? part(v) / etendue : 0),
  };
}

partieChargee('assets/store-05-analyses.js');
