/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
/* `financier` : la meme boucle, sans les murs ni les objets.

   Le filtre porte sur le CONTENANT, et il portait sur la classe de la ligne.
   « Cette ligne est-elle de classe immobilier ? » n'est pas la question :
   `immobilier` couvre l'appartement et la SCPI, et la seconde est un placement
   qu'on arbitre. Un compte detenu en direct sort donc tout entier, cash compris,
   et rien d'autre ne sort — voir `estHorsPerimetreFinancier`.

   C'est aussi ce qui fait disparaitre le palier « le logement que tu habites »
   tout seul, sans qu'une seule ligne le nomme ici. */
function poches({ financier = false } = {}) {
  const p = { courant: 0, precaution: 0, projet: 0, investir: 0,
              classes: Object.fromEntries(Object.keys(CLASSES_ACTIFS).map(k => [k, 0])),
              /* Derive de la table des paliers : en ecrire la liste ici a la
                 main laissait un palier ajoute a `undefined`, et le total
                 cessait d'egaler la somme de ses parts sans un mot. */
              mobilisable: Object.fromEntries(
                Object.keys(MOBILISABLE_LABEL).map(k => [k, 0])) };
  for (const c of comptesOuverts()) {
    if (financier && estHorsPerimetreFinancier(c)) continue;
    for (const e of (c.cash || [])) {
      const m = num(e.montant);
      p[e.affectation] = (p[e.affectation] || 0) + m;
      p.classes.liquidites += m;
      p.mobilisable[mobilisabilite('liquidites', c.type)] += m;
    }
    for (const l of lignesDe(c)) {
      p.classes[l.classe] = (p.classes[l.classe] || 0) + l.valeur;
      p.mobilisable[mobiliteLigne(l, c)] += l.valeur;
    }
  }
  return p;
}

function dettesTotal() {
  return ETABS().reduce((s, e) => s + (e.dettes || []).reduce((x, d) => x + num(d.montant), 0), 0);
}

/* --- ce qu'un credit saisi doit respecter -------------------------------

   UN CAPITAL RESTANT DU NEGATIF ENRICHIT. La dette s'additionne en negatif dans
   le patrimoine net : moins mille euros de dette font mille euros de plus. Le
   nombre est faux, et il est faux dans le bon sens, donc rien ne le trahit.

   La tentation est de le redresser a la lecture, par un plancher a zero dans le
   total. Ce serait cacher la saisie au lieu de l'empecher : le chiffre reste
   faux dans le fichier, l'export l'emporte, et chaque nouvelle lecture doit se
   souvenir de le redresser — une regle qui vit a N endroits en oublie un.

   La regle vit donc a l'ENTREE, une seule fois, et les trois portes qui
   saisissent un credit l'appellent : la creation d'un bien finance, l'ajout
   depuis un etablissement, et l'edition. Elle rend la clef du champ fautif et
   sa phrase, ou `null` si tout va bien : la forme exacte qu'attend `valide`.

   Les noms de champs different d'une porte a l'autre — la creation appelle
   `credit` ce que les deux autres appellent `montant` — donc la table des clefs
   se passe en argument plutot que de dupliquer la regle.

   Ce qui existe deja dans les fichiers ne s'efface pas pour autant : une regle
   neuve ne repare pas un etat deja ecrit, et un controle de sante le signale. */
const CLES_CREDIT = { montant: 'montant', initial: 'initial', mensualite: 'mensualite',
                      taux: 'taux', tauxAssurance: 'tauxAssurance' };

function validerCreditSaisi(v, cles) {
  const c = { ...CLES_CREDIT, ...(cles || {}) };
  const lu = k => (v || {})[c[k]];
  if (estDeclare(lu('montant')) && num(lu('montant')) < 0) {
    return { cle: c.montant, message: trad('Le capital restant dû ne peut pas être '
      + 'négatif : une dette négative ferait monter ton patrimoine net au lieu de le baisser.') };
  }
  for (const k of ['initial', 'mensualite', 'taux', 'tauxAssurance']) {
    if (estDeclare(lu(k)) && num(lu(k)) < 0) {
      return { cle: c[k], message: trad('Un montant négatif ne peut pas être enregistré.') };
    }
  }
  if (num(lu('montant')) > 0 && estDeclare(lu('initial')) && num(lu('initial')) === 0) {
    return { cle: c.initial, message: trad('Le capital emprunté au départ doit être '
      + 'supérieur à 0 lorsqu’un capital restant dû est renseigné.') };
  }
  return null;
}

/* --- la charge fixe qui rembourse un credit ------------------------------
   Une mensualite de pret etait saisie deux fois : en charge fixe, parce que
   c'est de l'argent qui sort tous les mois et que le budget doit le savoir, et
   sur le credit, « pour memoire », pour projeter l'amortissement. Deux endroits
   pour un seul fait, et rien qui garantisse qu'ils s'accordent — le defaut que
   ce projet corrige sans arret.

   La charge porte donc `creditId`, et c'est elle qui detient le montant : le
   budget ne change pas d'un octet, il continue de sommer ses charges. Le credit,
   lui, lit la mensualite de la charge rattachee. Un seul champ, deux lectures.

   Sens du lien choisi a dessein : une charge peut exister sans credit, un credit
   peut exister sans charge — on ne rembourse pas une marge de courtier par
   mensualites — mais une mensualite ne peut pas exister sans sortir du budget.
   C'est donc la charge qui est la source. */
function chargeDuCredit(id) {
  if (!id) return null;
  const i = B().fixedCharges.findIndex(c => c.creditId === id);
  return i < 0 ? null : { charge: B().fixedCharges[i], index: i };
}

function mensualiteCredit(d) {
  const lien = chargeDuCredit(d.id);
  return lien ? chargeMensuelle(lien.charge) : num(d.mensualite) || 0;
}

function creerChargeDuCredit(d) {
  if (!num(d.mensualite) || chargeDuCredit(d.id)) return false;
  Store.state.budget.fixedCharges.push({
    label: d.libelle, amount: num(d.mensualite), period: 'mois',
    provider: d.preteur || '', shares: {}, creditId: d.id,
  });
  d.mensualite = null;
  return true;
}

function progressionCredit(d) {
  const initial = estDeclare(d?.initial) ? num(d.initial) : null;
  const reste = num(d?.montant);
  const muet = { initial: null, reste, rembourse: null, pct: null,
                 incoherent: false, invalide: false };
  if (initial === null) return muet;
  /* Un capital emprunte declare a ZERO alors qu'il reste une dette n'est pas une
     absence : c'est une saisie impossible, et la ranger parmi les inconnus par
     `|| null` la ferait disparaitre sans un mot. Elle se signale. */
  if (initial === 0) return { ...muet, invalide: reste > 0 };
  if (initial < 0) return { ...muet, invalide: true };
  const rembourse = initial - reste;
  if (rembourse < -0.005) return { ...muet, initial, incoherent: true };
  return { initial, reste, rembourse: round2(rembourse),
           pct: round2(rembourse / initial * 100), incoherent: false };
}

/* L'apport declare, et rien d'autre.

   `num(compte.apport) || null` confondait deux reponses opposees : un apport
   NUL, qui est un financement a cent pour cent et une vraie information, et un
   apport NON DIT, qui n'en est pas une. Le premier merite d'etre affiche, le
   second de se taire. */
const apportDeclare = compte => estDeclare(compte?.apport) ? num(compte.apport) : null;

/* --- un capital restant dû se calcule, il ne se retient pas -------------
   Le seul champ d'un crédit qui vieillit tout seul. Personne n'ouvre son
   application pour corriger de 348 EUR une ligne qui n'a pas bouge a l'ecran, et
   un capital restant du fige pendant huit mois fausse le patrimoine net de
   plusieurs milliers d'euros, silencieusement — le pire genre d'erreur.

   Plutot que de compter sur la memoire, on projette. La mensualite et le taux
   sont deja connus : le tableau d'amortissement se rejoue mois par mois depuis la
   derniere verification. Le resultat n'ecrit rien — il se propose, et c'est le
   detenteur qui tranche, parce qu'un remboursement anticipe ou une renegociation
   invalide la projection sans que l'application puisse le savoir.

   `moisDepuis` compte les mois entiers ecoules, pas les jours : une mensualite
   tombe une fois par mois, et une projection au prorata d'un demi-mois donnerait
   une precision qui n'existe pas. */
function projectionCredit(d) {
  const reste = num(d.montant);
  const mens = mensualiteCredit(d);
  const tauxAn = tauxCreditDeclare(d);
  const taux = (tauxAn || 0) / 100 / 12;
  const depuis = d.verifieLe || null;
  const rien = { moisDepuis: null, projete: null, ecart: null, sens: null };
  if (!reste || !depuis) return rien;
  const a = new Date(depuis + 'T12:00:00'), b = new Date(todayISO() + 'T12:00:00');
  let mois = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) mois--;               // le mois n'est pas echu
  if (!(mois > 0)) return { ...rien, moisDepuis: Math.max(0, mois) };
  if (tauxAn === null || (!mens && !taux)) return { ...rien, moisDepuis: mois };
  /* Un seul calcul pour les deux sens.
     `capital + interets - mensualite` : avec une mensualite plus grosse que les
     interets, la dette descend, c'est un pret qui s'amortit. Sans mensualite, il
     ne reste que les interets et elle monte — c'est le levier d'un courtier, qui
     ne se rembourse pas par echeances et grossit tout seul. Le meme piege que le
     rappel du releve mensuel : le chiffre le plus faux est celui qu'on croit
     stable. */
  const assurance = assuranceMensuelleCredit(d);
  const rembourse = Math.max(0, mens - assurance);
  let capital = reste;
  for (let i = 0; i < mois && capital > 0; i++) {
    capital = Math.max(0, capital + capital * taux - rembourse);
  }
  return { moisDepuis: mois, projete: capital, ecart: reste - capital,
           sens: capital > reste ? 'monte' : capital < reste ? 'baisse' : 'stable' };
}

function baseAssuranceCredit(d) {
  const initial = estDeclare(d?.initial) ? num(d.initial) : null;
  return initial > 0
    ? { base: initial, sur: 'initial' }
    : { base: num(d?.montant), sur: 'restant' };
}

function assuranceMensuelleCredit(d) {
  const taux = num(d?.tauxAssurance);
  return taux ? baseAssuranceCredit(d).base * taux / 100 / 12 : 0;
}

/* L'echeancier d'un credit : LA source, et la seule.

   Deux moteurs ne vivent pas cote a cote. Amortir mois par mois avec la
   mensualite ENTIERE compterait l'assurance comme du remboursement, quand une
   formule fermee la retranche d'abord. Sur un pret de 149 731 EUR a 1,55 %
   avec 47,50 EUR d'assurance, l'un amortirait 811,85 par mois et l'autre
   764,35 : plus d'un an d'ecart sur la date de fin, deux dates sur une fiche.

   La convention, une fois pour toutes :

     mensualite totale = capital + interets + assurance

   Ce qui rembourse est donc `mensualite - assurance - interets`, dans Budget,
   dans la fiche du bien et dans la carte des credits : oublier l'assurance
   dans l'un d'eux lui ferait dire un autre capital que les deux autres.

   Une boucle et non une formule fermee : elle traverse le taux zero sans
   logarithme, elle donne la derniere echeance reduite sans arrondi a rattraper,
   et elle est le tableau d'amortissement lui-meme -- ce qui rend la verification
   possible ligne par ligne.

   `amortissable: false` quand ce qui reste apres l'assurance ne couvre pas les
   interets du mois : la dette ne s'eteint jamais, et annoncer une date de fin
   serait mentir. La decomposition du mois reste rendue -- elle est vraie, elle. */
function echeancierCredit(d) {
  const reste = num(d.montant);
  if (!(reste > 0)) return null;
  const mens = mensualiteCredit(d);
  const assurance = assuranceMensuelleCredit(d);
  /* Un taux ABSENT n'est pas un taux nul. Sans taux on ne sait pas departager le
     capital des interets, et annoncer « zero de capital » sur une mensualite de
     620 EUR serait faux dans l'autre sens : `capitalDuMois` vaut alors `null`,
     et les lecteurs se taisent plutot que d'inventer.

     Un taux DECLARE a zero, lui, s'amortit tout droit : c'est le pret familial ou
     le differe sans interets. L'ancienne formule fermee rendait `null` des que le
     taux valait zero -- un logarithme n'aime pas ce cas -- et privait de reponse
     le pret le plus simple. La boucle le traverse sans y penser. */
  const tauxAn = tauxCreditDeclare(d);
  const declare = tauxAn !== null;
  const taux = (tauxAn || 0) / 100 / 12;
  const interetsDuMois = declare ? reste * taux : null;
  const dispo = mens - assurance;
  const mois0 = {
    assuranceDuMois: assurance, interetsDuMois,
    capitalDuMois: (declare && mens > 0) ? Math.max(0, dispo - interetsDuMois) : null,
    amortissable: false,
    mois: null, fin: null, finLe: null, interets: null,
    assurance: null, derniere: null,
  };
  if (!declare || !(mens > 0) || dispo <= interetsDuMois) return mois0;

  let capital = reste, mois = 0, interets = 0;
  while (capital > 0.005 && mois < 1200) {
    const i = capital * taux;
    interets += i;
    capital = capital + i - dispo;
    mois++;
  }
  if (capital > 0.005) return mois0;

  let derniere = mens + capital;
  if (mois > 1 && derniere < mens / 100) {
    mois--;
    derniere += mens;
  }

  /* Le premier du mois avant d'ajouter les mois : `setMonth` sur un 31 janvier
     saute en mars. L'un des deux moteurs le faisait, l'autre non -- une
     troisieme facon de ne pas tomber sur la meme date. */
  const fin = new Date();
  fin.setDate(1);
  fin.setMonth(fin.getMonth() + mois);
  const cle = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}`;
  return {
    ...mois0,
    amortissable: true,
    mois, interets,
    assurance: assurance * mois,
    /* La derniere echeance solde le reliquat : `capital` est negatif ou nul en
       sortie de boucle, donc elle est plus petite que les autres -- sauf quand
       elle a absorbe un reste d'arrondi, et elle depasse alors de peu. */
    derniere,
    fin: cle, finLe: cle,
  };
}

/* Deux noms, un seul calcul. `finCredit` et `resteAPayer` avaient chacun le
   leur et ne tombaient pas sur la meme date ; ils delegent desormais, et leur
   contrat ne change pas -- `null` quand le credit ne s'amortit pas, pour que les
   vues qui testent `if (!f)` continuent de se taire. */
function finCredit(d) {
  const e = echeancierCredit(d);
  if (!e || !e.amortissable) return null;
  const { mois, interets, derniere, finLe } = e;
  return { mois, interets, derniere, finLe };
}

/* --- les crédits, tous ensemble ----------------------------------------
   Une dette vit sur l'etablissement qui l'a consentie, et se lisait donc un
   etablissement a la fois : la fiche du bien, celle du courtier, le groupe de la
   page Comptes. Personne ne les voyait toutes, et le patrimoine net soustrayait
   un total qui ne s'affichait nulle part en detail.

   `rembourse` et `part` n'existent que si le capital emprunte est connu : il est
   facultatif, et deduire « rien de rembourse » d'un champ vide serait faux — un
   vieux pret dont on a oublie le montant initial est presque paye.

   Le total est celui de `dettesTotal()`, pas un second calcul : c'est le meme
   nombre que le patrimoine net retranche, et il ne peut pas en diverger. */
function creditsEnCours() {
  const lignes = [];
  for (const e of ETABS()) {
    (e.dettes || []).forEach((d, index) => {
      const reste = num(d.montant);
      const initial = num(d.initial);
      lignes.push({
        /* `index` est la position dans les dettes de l'etablissement, et non dans
           cette liste-ci : elle est triee par montant, et c'est l'autre qui sert
           a ecrire. Sans lui, modifier le plus gros credit en corrigeait un
           autre des que deux etablissements en portaient. */
        etabId: e.id, etabNom: e.nom, id: d.id, index,
        libelle: d.libelle || 'Crédit', preteur: d.preteur || '',
        reste, initial: initial || null,
        /* `tauxCreditDeclare` et non `num(d.taux) || null` : un pret familial a
           0 % perdait son taux et s'affichait comme un pret dont on ignore le
           taux — deux etats tres differents a l'ecran. */
        mensualite: mensualiteCredit(d) || null, taux: tauxCreditDeclare(d),
        charge: (() => {
          const lien = chargeDuCredit(d.id);
          return lien ? { index: lien.index, label: lien.charge.label || 'Charge fixe',
                          periode: chargePeriode(lien.charge) } : null;
        })(),
        rembourse: initial > 0 ? Math.max(0, initial - reste) : null,
        part: initial > 0 ? Math.min(100, Math.max(0, (initial - reste) / initial * 100)) : null,
        /* L'echeancier porte deja toute la regle : il rend `null` sans taux
           declare, et des nombres justes avec — zero pour cent compris. Le
           filtre `num(d.taux) &&` qui gardait ces deux lignes ecartait donc le
           pret a 0 %, dont la mensualite rembourse pourtant du capital. */
        interets: echeancierCredit(d)?.interetsDuMois ?? null,
        capital: echeancierCredit(d)?.capitalDuMois ?? null,
        verifieLe: d.verifieLe || null,
        ...projectionCredit(d),
        fin: finCredit(d),
      });
    });
  }
  lignes.sort((a, b) => b.reste - a.reste);
  return {
    lignes,
    reste: dettesTotal(),
    mensuel: lignes.reduce((s, x) => s + (x.mensualite || 0), 0),
    initial: lignes.reduce((s, x) => s + (x.initial || 0), 0),
  };
}

function patrimoine() {
  const p = poches();
  /* Le brut est la somme de ses parts, litteralement.

     Les quatre poches de cash n'ont pas a figurer ici : chaque euro de cash est
     deja compte dans `classes.liquidites`, par la meme boucle. Les additionner
     separement etait un doublon qui ne se voyait pas parce que les deux termes
     etaient egaux. */
  const brut = Object.values(p.classes).reduce((s, v) => s + num(v), 0);
  const dettes = dettesTotal();
  return { ...p, brut, dettes, net: brut - dettes };
}

/* Dérivée de la même table que `couleurClasse` : deux listes écrites à la
   main finissent par diverger, et une couleur qui change de sens d'un écran à
   l'autre ne veut plus rien dire. */
const CLASSE_COULEURS = new Proxy({}, {
  /* Une clé inconnue rend `undefined` et non une couleur par défaut : le
     `|| CLASSE_COULEURS.nonCote` des appelants doit pouvoir jouer. */
  get: (_, k) => (typeof k === 'string' && (CLASSES_ALIAS[k] || k) in TEINTE_CLASSE)
    ? couleurClasse(k) : undefined,
  has: (_, k) => typeof k === 'string' && (CLASSES_ALIAS[k] || k) in TEINTE_CLASSE,
});
/* `net` : les credits se retranchent de la classe qu'ils financent, et la base
   devient le patrimoine net.

   Le commutateur Net / Brut gouvernait le grand chiffre et la courbe, pas cette
   carte. On lisait donc, sur un seul ecran, un patrimoine net annonce en tete et
   une repartition qui totalisait le brut juste dessous : les parties ne faisaient
   pas le tout, ce que ce projet s'interdit partout ailleurs.

   Une dette ne se retranche que de la classe que son lien designe, voir
   `classeFinanceeParDette`. Celle dont la destination est inconnue ne va a
   aucune classe : elle a sa ligne, `DETTES_NON_AFFECTEES`, negative. Une classe
   peut aussi devenir negative quand ce qui la finance depasse sa valeur, et la
   carte le montre plutot que de le masquer.

   Allocation ne change pas : elle n'a pas de commutateur et declare une base
   unique. Deux pages, deux bases, chacune nommee — c'est le motif autorise ici,
   celui qu'un total muet violait. */
/* Le patrimoine financier : tout sauf les murs et les objets.

   Un appartement ecrase le reste. Mesure sur le jeu de demonstration : 81,2 % du
   brut, et quatre classes sur six tombent sous 2 % — des traits invisibles sur un
   camembert. La page cesse alors de montrer ce qu'on pilote, alors que c'est sa
   seule raison d'exister : personne ne reequilibre un mur.

   Ce qui sort, c'est ce qu'on detient EN DIRECT : le mur qu'on habite ou qu'on
   loue, la montre, la voiture. Une liste de CLASSES a exclure vivait ici, et
   elle disait autre chose : `['immobilier', 'bienValeur']` sortait aussi la
   pierre papier et le support immobilier d'une assurance-vie, qui sont du
   placement. Le non cote restait, lui, par la meme logique qu'on lui refusait —
   on choisit d'y remettre ou non, alors qu'on ne vend pas trois metres carres de
   salon. La constante est partie plutot que d'etre corrigee : elle repondait a
   la mauvaise question, et une constante qui ment coute plus qu'elle ne sert.

   Les cinq sources de la page Allocation appellent donc toutes
   `estHorsPerimetreFinancier`, sur le compte.

   Les DETTES de cette vue se choisissent, elles aussi, et par le lien qu'elles
   portent : voir `detteLieeBienDirect`. Un credit rattache a un mur part avec le
   mur ; toute autre dette reste — celle d'une SCPI comme celle d'une marge —
   et le net financier la retranche. */

/* Les poches que la COURBE D'HISTORIQUE ecarte, et elles ne recouvrent pas
   exactement le perimetre d'aujourd'hui.

   `estHorsPerimetreFinancier` tranche sur le compte, et un releve n'a pas de
   compte : il porte une ventilation par poche, calculee le jour ou il a ete
   enregistre. Aucun releve deja ecrit ne sait dire quelle part de son
   immobilier etait de la pierre papier, et rien ne permet de le decouper apres
   coup. La poche `immo` de l'historique melange donc les deux, et la vue
   financiere de la courbe la retire entiere.

   Le present, lui, sait : `poidsPoches()` lit l'etat du jour et garde `immo`
   reduite a sa pierre papier. Les deux lectures different parce que les deux
   questions different, et c'est dit ici plutot que devine. */
const SERIES_HORS_FINANCIER = ['immo', 'biens'];
const serieHorsFinancier = cle => SERIES_HORS_FINANCIER.includes(cle);

/* Les poches du graphique d'evolution, dans l'ordre ou la pile les empile.

   `SERIES_PATRIMOINE()` leur donne une couleur et le nom de leur classe ;
   l'ensemble et l'ordre viennent d'ici. Sans ca, le calcul des points et le
   dessin porteraient deux listes ecrites a la main, et c'est exactement la faute
   que ce depot corrige sans arret : la poche ajoutee d'un seul cote compte dans
   un total sans avoir de bande, ou l'inverse. */
const POCHES_EVOLUTION = ['cash', 'bourse', 'crypto', 'pe', 'immo', 'biens', 'garanti'];

const CASCADE_DETTES = ['immo', 'biens', 'pe', 'crypto', 'bourse', 'garanti', 'cash'];

function pochesEvolution({ financier = false } = {}) {
  return POCHES_EVOLUTION.filter(cle => !financier || !serieHorsFinancier(cle));
}

/* La part financiere d'un compte : tout, ou rien.

   Elle retranchait ligne a ligne ce qui etait de classe `immobilier`, et vidait
   ainsi une assurance-vie de son support pierre. Un compte EST dedans ou dehors :
   ce qui sort, c'est le bien detenu en direct, et un bien detenu en direct ne
   porte rien d'autre que lui-meme. */
function valeurFinanciere(compte) {
  return estHorsPerimetreFinancier(compte) ? 0 : valeurCompte(compte);
}

function horsFinancierExiste() {
  return comptesOuverts().some(c => estHorsPerimetreFinancier(c)
    && Math.abs(valeurCompte(c)) > 0.005);
}

function totalFinancier() {
  const p = poches({ financier: true });
  return Object.values(p.classes).reduce((s, v) => s + num(v), 0);
}

/* Ce que la vue financiere retire, en un nombre. `totalFinancier()` dit ce qui
   reste ; celui-ci dit ce qui part. Les deux existent parce que « place » ne se
   filtre pas par classe : il vaut le brut moins le cash, et sa version
   financiere est donc une soustraction, pas un filtre.

   DEUX CALCULS INDEPENDANTS, et non l'un moins l'autre : celui-ci somme la
   valeur des comptes qui sortent, `totalFinancier()` somme les classes des
   comptes qui restent, et un test exige que les deux fassent le brut. Une
   soustraction ne prouverait rien — elle serait vraie meme si les deux cotes
   s'accordaient sur un perimetre faux. */
function horsFinancierTotal() {
  return comptesOuverts()
    .filter(c => estHorsPerimetreFinancier(c))
    .reduce((s, c) => s + valeurCompte(c), 0);
}

/* --- quelles dettes sortent du perimetre financier ? --------------------

   La vue financiere ecarte les murs et les objets de valeur. Elle ecartait AUSSI
   toutes les dettes, sous un raisonnement juste sur un seul cas : le pret finance
   le bien, le bien est deja dehors, donc retrancher le pret retirerait deux fois
   la meme chose. Vrai d'un credit immobilier. Faux de tout le reste — une marge
   de courtier, un pret personnel, un emprunt pris pour investir : ceux-la ne
   financent aucun mur, et ils disparaissaient entierement de la lecture
   financiere. Une dette qui ne se voit nulle part est le pire des chiffres faux.

   LA PREUVE DU LIEN EST LE LIEN, jamais un libelle. Ni « pret immobilier », ni le
   nom du preteur, ni le montant, ni la presence d'un appartement quelque part :
   `bienId` existe pour ca, et lui seul dit ce qu'un credit finance.

   `estBienEnDirect` et non `bienImmo` : une SCPI porte le premier drapeau et pas
   le second. Elle reste dans le perimetre financier — on choisit d'y remettre ou
   non, alors qu'on ne vend pas trois metres carres de salon — donc un credit qui
   la financerait reste avec elle.

   Un `bienId` qui ne designe plus rien ne fait pas sortir la dette : elle ne
   s'efface pas parce que sa cible a ete supprimee. Le controle de sante des
   credits non rattaches, lui, continue de le signaler. */
function detteLieeBienDirect(d) {
  if (!d || !d.bienId) return false;
  const bien = compteById(d.bienId);
  return !!bien && estBienEnDirect(bien);
}

/* Les dettes que le perimetre financier porte : toutes celles qui ne sont pas
   parties avec un mur.

   Une dette ambigue — sans `bienId`, chez quelqu'un qui possede deux
   appartements — en fait partie, et c'est volontairement conservateur : une
   dette reelle ne s'efface pas parce que sa destination est inconnue. Rien ne la
   devine ici, et rien ne la migre. */
function dettesFinancieresTotal() {
  return ETABS().reduce((s, e) => s + (e.dettes || [])
    .filter(d => !detteLieeBienDirect(d))
    .reduce((x, d) => x + num(d.montant), 0), 0);
}

/* --- ce qu'une dette finance -------------------------------------------

   Le compte se lit comme la fiche le lit (`creditsDuBien`) : le lien `bienId`,
   ou le seul compte de l'etablissement qui porte la dette. Rien d'autre ne le
   designe, ni le nom du preteur, ni le type de l'etablissement, ni la presence
   d'un appartement ailleurs. Un lien mort, un compte d'un autre etablissement ou
   un compte archive ne financent plus rien de ce qui est compte aujourd'hui. */
function compteFinanceParDette(d, e) {
  if (!d || !e) return null;
  const miens = (Store.state.comptes || []).filter(x => x.etabId === e.id);
  const c = d.bienId ? compteById(d.bienId) : (miens.length === 1 ? miens[0] : null);
  if (!c || c.etabId !== e.id || c.statut === 'archive') return null;
  return c;
}

function classeFinanceeParDette(d, e) {
  const c = compteFinanceParDette(d, e);
  if (!c) return null;
  const classes = (typeCompte(c.type).classes || []).filter(k => k !== 'liquidites');
  return classes.length === 1 ? classes[0] : null;
}

/* Les dettes rangees par ce qu'elles financent. `nonAffectees` porte tout le
   reste, et la somme des deux fait `dettesTotal()` : aucune dette ne disparait
   parce que sa destination est inconnue. */
const DETTES_NON_AFFECTEES = 'dettesNonAffectees';
function dettesParDestination() {
  const classes = {};
  let nonAffectees = 0;
  for (const e of ETABS()) {
    for (const d of (e.dettes || [])) {
      const m = num(d.montant);
      if (!m) continue;
      const k = classeFinanceeParDette(d, e);
      if (k) classes[k] = (classes[k] || 0) + m;
      else nonAffectees += m;
    }
  }
  return { classes, nonAffectees };
}

function dettesDesBiensDirects() {
  let s = 0;
  for (const e of ETABS()) {
    for (const d of (e.dettes || [])) {
      const c = compteFinanceParDette(d, e);
      if (c && estHorsPerimetreFinancier(c)) s += num(d.montant);
    }
  }
  return s;
}

/* DEUX GRANDEURS, DEUX QUESTIONS, ET LES CONFONDRE EST LA FAUTE.

   `totalFinancier()` dit ce qu'on possede et qu'on peut piloter. C'est la base de
   toutes les repartitions, et elle le reste : une dette ne se range dans aucun
   compte, dans aucune classe d'actif, dans aucun palier de disponibilite. La
   ventiler au prorata inventerait un endroit ou elle n'est pas, et ferait bouger
   la quantite d'actions qu'on « devrait » posseder.

   `netFinancier()` dit ce que ce perimetre vaut une fois ses dettes payees. Il
   peut etre negatif — trente mille de marge sur vingt mille d'avoirs — et il le
   reste : un plancher a zero cacherait exactement la situation qu'il faut voir. */
function netFinancier() {
  return totalFinancier() - dettesFinancieresTotal();
}

function repartitionClasses({ net = false, financier = false } = {}) {
  const p = patrimoine();
  const avecDettes = net && !financier;
  const base = financier ? totalFinancier() : num(p.brut) - (avecDettes ? num(p.dettes) : 0);
  const dest = avecDettes ? dettesParDestination() : { classes: {}, nonAffectees: 0 };
  const classes = financier ? poches({ financier: true }).classes : p.classes;
  /* `brut` et `dettes` voyagent avec la part : la vue dit « apres tant de
     credit » sans refaire le calcul. Une classe reste tant qu'elle a une valeur
     OU une dette : un bien a zero finance par un pret est une part negative, pas
     une absence. */
  const lignes = Object.entries(CLASSES_ACTIFS)
    .map(([classe, label]) => {
      const brut = num(classes[classe]);
      const dettes = num(dest.classes[classe]);
      const value = brut - dettes;
      return { classe, label, couleur: CLASSE_COULEURS[classe], value, brut, dettes,
               pct: poidsDansTotal(value, base) };
    })
    .filter(x => Math.abs(x.brut) > 0.005 || Math.abs(x.dettes) > 0.005);
  if (dest.nonAffectees > 0.005) {
    lignes.push({ classe: DETTES_NON_AFFECTEES, label: 'Dettes non affectées',
                  couleur: 'var(--muted)', value: -dest.nonAffectees, brut: 0,
                  dettes: dest.nonAffectees, pct: poidsDansTotal(-dest.nonAffectees, base) });
  }
  return lignes;
}

function segmentsBarre(parts) {
  const positives = (parts || []).filter(x => num(x.value) > 0.005);
  const somme = positives.reduce((s, x) => s + num(x.value), 0);
  return positives.map(x => ({ ...x, largeur: somme > 0 ? num(x.value) / somme * 100 : 0 }));
}

const CATEGORIES_EN_TETE = 3;
function syntheseRepartition(parts, n = CATEGORIES_EN_TETE) {
  const positives = (parts || []).filter(x => num(x.value) > 0.005)
    .sort((a, b) => num(b.value) - num(a.value));
  const negatives = (parts || []).filter(x => !(num(x.value) > 0.005));
  const enTete = positives.length === n + 1 ? n + 1 : n;
  const reste = positives.slice(enTete);
  const autres = reste.length ? {
    nb: reste.length, labels: reste.map(x => x.label), lignes: reste,
    value: round2(reste.reduce((s, x) => s + num(x.value), 0)),
    pct: reste.every(x => x.pct != null) ? reste.reduce((s, x) => s + x.pct, 0) : null,
  } : null;
  return { tete: positives.slice(0, enTete), autres, negatives };
}

/* --- La disposition de l'accueil -----------------------------------------

   Les cartes de l'Apercu qui se deplacent et se masquent, dans leur ordre par
   defaut. Le patrimoine n'y figure pas : il ouvre toujours la page. Les
   rappels de saisie et les alertes non plus : ils demandent un geste, ils ne
   se lisent pas, et un rappel qu'on aurait range en bas de page ne rappelle
   plus rien. L'objectif ferme la page : c'est une affaire de mois, lue apres
   la situation, la courbe et les cartes de suivi.

   L'ETAT NE PORTE QUE L'ECART AU DEFAUT. Rien n'est ecrit tant que personne
   n'a rien change, et revenir a l'ordre par defaut efface la clef : un profil
   qui n'a rien personnalise suit donc le defaut, y compris celui de demain.

   « A retenir » se masquait deja, par son menu et par les Preferences, sur
   `meta.retenirMasquee`. Sa visibilite reste sur cette clef : trois portes, un
   seul fait, et aucune ne peut contredire les autres. */
const CARTES_APERCU = ['retenir', 'repartition', 'evolution', 'changements', 'titres',
                       'accumulation', 'reserve', 'objectif'];

function dispositionApercu(meta = Store.state && Store.state.meta) {
  const { ordre, cachees } = lireDisposition(meta && meta.apercu, CARTES_APERCU, ['retenir']);
  if (meta && meta.retenirMasquee) cachees.add('retenir');
  const masquees = ordre.filter(id => cachees.has(id));
  return { ordre, masquees,
           parDefaut: !masquees.length && estOrdreParDefaut(ordre, CARTES_APERCU) };
}

function ecrireDispositionApercu(ordre, masquees) {
  const meta = Store.state.meta;
  const autres = masquees.filter(id => id !== 'retenir');
  if (ordre.every((id, i) => id === CARTES_APERCU[i]) && !autres.length) delete meta.apercu;
  else meta.apercu = { ordre: [...ordre], masquees: autres };
  if (masquees.includes('retenir')) meta.retenirMasquee = true;
  else delete meta.retenirMasquee;
}

function deplacerCarteApercu(id, sens) {
  const d = dispositionApercu();
  const ordre = echangerAvecVoisine(d.ordre, id, sens);
  if (!ordre) return false;
  ecrireDispositionApercu(ordre, d.masquees);
  return true;
}

function basculerCarteApercu(id) {
  const d = dispositionApercu();
  if (!d.ordre.includes(id)) return false;
  const masquees = d.masquees.includes(id) ? d.masquees.filter(x => x !== id) : [...d.masquees, id];
  ecrireDispositionApercu(d.ordre, masquees);
  return true;
}

function retablirDispositionApercu() {
  ecrireDispositionApercu(CARTES_APERCU, []);
}

/* --- LE NOYAU COMMUN DES DISPOSITIONS DE PAGE ------------------------------
   L'Apercu et Marches se rangent de la meme facon : un ordre par defaut, un
   ordre enregistre qui ne porte que l'ecart, des cartes masquees. La lecture et
   l'echange avec la voisine vivent ici une fois ; chaque page garde ses propres
   fonctions publiques, sa clef et ses cas particuliers.

   La lecture est toujours complete et toujours valide. Un fichier importe peut
   porter n'importe quoi sous la clef, ou venir d'une version qui avait d'autres
   cartes : un identifiant inconnu s'ignore, un doublon aussi, et une carte
   absente de l'ordre enregistre reprend sa place par defaut, juste apres la
   carte qui la precede dans l'ordre par defaut. `exclues` nomme les cartes dont
   la visibilite vit ailleurs. */
function lireDisposition(brut, liste, exclues = []) {
  const d = brut && typeof brut === 'object' ? brut : {};
  const ordre = (Array.isArray(d.ordre) ? d.ordre : [])
    .filter((id, i, t) => liste.includes(id) && t.indexOf(id) === i);
  liste.forEach((id, i) => {
    if (ordre.includes(id)) return;
    const avant = liste.slice(0, i).reverse().find(x => ordre.includes(x));
    ordre.splice(avant ? ordre.indexOf(avant) + 1 : 0, 0, id);
  });
  const cachees = new Set((Array.isArray(d.masquees) ? d.masquees : [])
    .filter(id => !exclues.includes(id) && liste.includes(id)));
  return { ordre, cachees };
}
const estOrdreParDefaut = (ordre, liste) => ordre.every((id, i) => id === liste[i]);
function echangerAvecVoisine(ordre, id, sens) {
  const i = ordre.indexOf(id), j = i + (sens < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= ordre.length) return null;
  const neuf = [...ordre];
  [neuf[i], neuf[j]] = [neuf[j], neuf[i]];
  return neuf;
}

/* --- LA PAGE MARCHES SE RANGE COMME L'APERCU -------------------------------
   Le portefeuille, la barre des cours, les titres archives et la recherche d'un
   titre restent fixes : ce sont la situation et les outils de la page, pas des
   lectures. Le reste se deplace et se masque.

   LE RESULTAT DES VENTES VIT DANS LEUR JOURNAL. Les graphiques « Realisee » et
   « Cumul » sont partis : le journal dit chaque resultat et le total net de la
   periode, et le selecteur de periode se pose au-dessus de lui.

   Les deux journaux ferment la page : ce sont des archives d'operations, lues
   apres les resultats. Ils arrivent replies.

   Le sous-onglet Cible n'est pas concerne, et la clef `meta.marches` ne porte,
   comme celle de l'Apercu, que l'ecart au defaut. */
const CARTES_MARCHES = ['titres', 'retenir', 'reperes', 'ventes', 'achats'];
/* La disposition enregistree se lit telle quelle, quel que soit son format :
   `lireDisposition` ignore les identifiants qu'elle ne connait plus. */
function normaliserMarches(brut) {
  return brut;
}
function dispositionMarches(meta = Store.state && Store.state.meta) {
  const { ordre, cachees } = lireDisposition(normaliserMarches(meta && meta.marches), CARTES_MARCHES);
  const masquees = ordre.filter(id => cachees.has(id));
  return { ordre, masquees,
           parDefaut: !masquees.length && estOrdreParDefaut(ordre, CARTES_MARCHES) };
}
function ecrireDispositionMarches(ordre, masquees) {
  const meta = Store.state.meta;
  if (estOrdreParDefaut(ordre, CARTES_MARCHES) && !masquees.length) delete meta.marches;
  else meta.marches = { version: 2, ordre: [...ordre], masquees: [...masquees] };
}
function deplacerCarteMarches(id, sens) {
  const d = dispositionMarches();
  const ordre = echangerAvecVoisine(d.ordre, id, sens);
  if (!ordre) return false;
  ecrireDispositionMarches(ordre, d.masquees);
  return true;
}
function basculerCarteMarches(id) {
  const d = dispositionMarches();
  if (!d.ordre.includes(id)) return false;
  ecrireDispositionMarches(d.ordre,
    d.masquees.includes(id) ? d.masquees.filter(x => x !== id) : [...d.masquees, id]);
  return true;
}
function retablirDispositionMarches() {
  ecrireDispositionMarches(CARTES_MARCHES, []);
}
const carteMarchesVisible = id => !dispositionMarches().masquees.includes(id);

const DEVISES_ACHAT = ['EUR', 'USD'];
const montantAchat = a => round2(num(a.qty) * num(a.price));
function erreurAchat(v) {
  const date = String(v && v.date || '');
  const jour = new Date(date + 'T00:00:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(jour) || isoLocal(jour) !== date)
    return trad('La date doit être une date valide');
  if (date > todayISO()) return trad('Un achat noté a déjà eu lieu : la date ne peut pas être future');
  if (!String(v.name || '').trim()) return trad('Le titre acheté doit être nommé');
  for (const cle of ['qty', 'price']) {
    const x = Number(v[cle]);
    if (v[cle] === '' || v[cle] == null || !isFinite(x) || x <= 0)
      return cle === 'qty' ? trad('La quantité doit être positive') : trad('Le prix doit être positif');
  }
  if (!DEVISES_ACHAT.includes(v.currency)) return trad('Devise non prise en charge');
  return null;
}
const achatNettoye = (v, id) => ({
  id, date: v.date, name: String(v.name).trim(), qty: Number(v.qty), price: Number(v.price),
  currency: v.currency, note: String(v.note || '').trim(), declaree: true,
});
function declarerAchat(v) {
  const erreur = erreurAchat(v);
  if (erreur) return { erreur };
  const s = Store.state;
  s.purchases = Array.isArray(s.purchases) ? s.purchases : [];
  let id = 'a' + Date.now().toString(36), n = 2;
  while (s.purchases.some(a => a.id === id)) id = 'a' + Date.now().toString(36) + '_' + (n++);
  const achat = achatNettoye(v, id);
  s.purchases.push(achat);
  return { achat };
}
function modifierAchat(id, v) {
  const a = (Store.state.purchases || []).find(x => x.id === id);
  if (!a) return { erreur: trad('Cet achat n’est plus dans le journal') };
  const erreur = erreurAchat(v);
  if (erreur) return { erreur };
  Object.assign(a, achatNettoye(v, id));
  return { achat: a };
}
function retirerAchat(id) {
  const liste = Store.state.purchases || [];
  const i = liste.findIndex(x => x.id === id);
  if (i < 0) return null;
  return liste.splice(i, 1)[0];
}
const achatsTries = () => [...(Store.state.purchases || [])]
  .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
/* Les achats d'une plage, bornes comprises, avec la regle de `salesStats` :
   ventes et achats se lisent sur la meme periode, et une seule. */
function achatsSurPlage(range) {
  const { debut, fin } = rangeBornes(range);
  return achatsTries().filter(a => {
    const d = String(a.date || '');
    return (!debut || d >= debut) && (!fin || d <= fin);
  });
}

function refreshAccounts() {
  const s = Store.state;
  if (s && Array.isArray(s.comptes)) {
    const ids = new Set(s.comptes.map(c => c.id));
    const projetes = s.comptes.map(c => {
      const t = typeCompte(c.type);
      /* `group` pilote les calculs, `gAff` l'affichage : l'immobilier partage
         la poche « non cote » pour les regles metier, mais merite sa propre
         bande dans le graphique — 150 000 EUR de studio noyes dans du
         crowdfunding ne se lisent pas. */
      /* `bienImmo` et non « peut porter de l'immobilier ». La nuance decide de
         la bande du graphique et de la poche de projection : une enveloppe qui
         accepte une SCPI parmi cinq classes s'affichait entierement en
         immobilier, ETF compris, et sa valeur quittait la poche « marche » pour
         celle des biens. Un contrat de 50 000 EUR d'ETF monde comptait comme de
         la pierre sur toute la page d'accueil.
         C'est le meme drapeau que `comptesBiens()` et `estBien()` : ce type EST
         de l'immobilier, il ne fait pas qu'en porter. */
      const gAff = t.bienImmo ? 'immo'
                 : t.classes.includes('crypto') ? 'crypto'
                 /* Une montre n'est pas du non cote : la ranger dans la poche
                    `pe` ferait porter au libelle « Non coté » un objet qui n'a
                    ni emetteur ni parts — le mensonge que CLASSES_ACTIFS
                    refuse deja. Sa poche d'affichage lui appartient. */
                 : t.classes.includes('bienValeur') ? 'biens'
                 : t.groupe;
      const nom = nomCompteV2(c), etab = nomEtabDe(c);
      /* UN SEUL NOM, ET C'EST CELUI QU'ON A TAPE.

         La projection en portait deux : `label`, le nom du compte, et `short`,
         un nom court herite des anciennes donnees — `c.court`, que AUCUN ecran
         ne permet de modifier depuis le passage au modele actuel. Treize
         endroits affichaient le second, et il gagnait des qu'il existait : un
         portefeuille nomme « Crypto wallet TR » se lisait « Crypto » sous
         chacune de ses lignes de titres, ce qui ne dit meme pas de quel compte
         il s'agit quand il y en a deux.

         La decision avait deja ete prise pour le menu de choix d'un compte, avec
         ce motif exact — « Crypto ne dit pas si c'est le portefeuille de
         cryptomonnaies ou autre chose ». Elle n'avait ete appliquee qu'a un
         endroit. Deux champs pour un meme fait finissent toujours par diverger ;
         il n'en reste qu'un.

         `c.court` reste dans le modele : les pierres tombales des comptes
         supprimes le portent, et une donnee ne se jette pas parce qu'elle a
         cesse de s'afficher. */
      return { id: c.id, label: nom,
               broker: etab, type: c.type, group: t.groupe, gAff,
               holdings: !!t.titres, role: '', alloc: c.alloc,
               legacy: c.statut === 'archive', compte: c };
    });
    const tombales = (s.accounts || [])
      .filter(a => !ids.has(a.id))
      .map(a => ({ ...a, legacy: true, fantome: true }));
    ACCOUNTS = [...projetes, ...tombales];
  } else {
    ACCOUNTS = s ? s.accounts : SEED_ACCOUNTS;
  }
  ACC = Object.fromEntries(ACCOUNTS.map(a => [a.id, a]));
  HOLDING_ACCOUNTS = ACCOUNTS.filter(a => a.holdings).map(a => a.id);
}

/* Les comptes clos, tries entre ceux que rien ne retient et ceux qu'un releve
   reclame.

   La garde n'est pas une precaution de style : `rowTotal` se derive de
   `rowGroups`, qui parcourt ACCOUNTS. Retirer un compte qu'un releve mentionne
   retrancherait donc son montant du TOTAL de ce mois-la, sans que rien ne le
   dise — et les mois suivants se compareraient a un passe qui a maigri.

   Deux sortes de comptes clos, et la meme regle vaut pour les deux : un compte
   archive, qui vit dans `comptes` avec `statut: 'archive'`, et une entree
   orpheline de l'ancien modele, qui vit dans `accounts` sans compte
   correspondant. Le premier peut encore porter de la valeur aujourd'hui, ce qui
   le retient au meme titre.

   Un montant nul ne retient rien : un champ laisse vide n'est pas de l'argent. */
function comptesClosDetaches() {
  const libres = [], retenus = [];
  for (const a of ACCOUNTS) {
    if (!a.legacy) continue;
    const mois = (Store.state.monthly || [])
      .filter(r => Math.abs(num(r.v && r.v[a.id])) > 0.005)
      .map(r => ({ date: r.date, montant: round2(num(r.v[a.id])) }));
    const aujourdhui = a.compte ? round2(valeurCompte(a.compte)) : 0;
    if (mois.length || Math.abs(aujourdhui) > 0.005)
      retenus.push({ id: a.id, label: a.label, mois, aujourdhui });
    else libres.push({ id: a.id, label: a.label, fantome: !!a.fantome });
  }
  return { libres, retenus };
}

/* Les anciens comptes, ranges selon CE QU'ON PEUT EN FAIRE.

   Le modele en connait deux sortes, et elles ne s'equivalent pas :

     ARCHIVE  un compte qui vit dans `comptes` avec `statut: 'archive'`. Il a
              une fiche, il garde tout ce qu'il portait, et il se ROUVRE.
     CLOS     une entree orpheline de l'ancien modele, qui vit dans `accounts`
              sans compte correspondant. Il n'y a pas de fiche a rouvrir : il
              n'existe plus que comme un nom dans d'anciens releves.

   Les deux sont hors de tous les totaux, les deux se suppriment. Seul le
   premier se restaure, et c'est la seule difference que l'ecran ait a montrer.

   Chaque entree porte ce qui la retient — les mois qui la nomment, la valeur
   qu'elle porte encore — parce que la confirmation de suppression doit pouvoir
   le dire avant de detruire quoi que ce soit. */
const MOTIFS_ARCHIVE = [
  ['transfert', 'Transfert vers un autre compte suivi'],
  ['sortie', 'Sortie du patrimoine suivi'],
  ['correction', 'Correction d’une saisie erronée'],
];

function enTransaction(operation, verifie = () => true) {
  const original = Store.state;
  Store.state = structuredClone(original);
  try {
    refreshAccounts();
    const r = operation(Store.state);
    refreshAccounts();
    if (r === false || !verifie(r)) throw new Error('verification');
    return { ok: true, r };
  } catch (e) {
    Store.state = original;
    refreshAccounts();
    return { ok: false, erreur: e && e.message };
  }
}

function soldeTransferable(c) {
  if (!c || c.statut === 'archive') return null;
  const lignes = (c.lignes || []).some(l => estDeclare(l.valeur) && num(l.valeur) !== 0);
  const titres = (Store.state.positions || []).some(p => p.account === c.id);
  if (lignes || titres) return null;
  const solde = round2((c.cash || []).reduce((s, e) => s + num(e.montant), 0));
  return solde > 0.005 ? solde : null;
}

function destinationsTransfert(sourceId) {
  const ok = cashTargets().filter(c => c.id !== sourceId);
  return [...ok.filter(c => !typeCompte(c.type).titres), ...ok.filter(c => typeCompte(c.type).titres)];
}

function pocheDArrivee(c) {
  const t = typeCompte(c.type) || {};
  c.cash = c.cash || [];
  let e = c.cash.find(x => x.affectation === t.defaut) || c.cash[0];
  if (!e) { e = { montant: 0, affectation: t.defaut || 'courant' }; c.cash.push(e); }
  return e;
}

function archiverParTransfert({ source, destination, partie, montant, clotureLe = todayISO() }) {
  const c = compteById(source);
  const solde = soldeTransferable(c);
  if (solde == null) return { ok: false, erreur: 'pasDEspeces' };
  if (!destinationsTransfert(source).some(x => x.id === destination)) return { ok: false, erreur: 'destination' };
  const m = round2(num(montant));
  if (!(m > 0.005) || m > solde + 0.005) return { ok: false, erreur: 'montant' };
  const cible = (partie || '').replace(/\+$/, '');
  if (!cible || verifierMouvement(destination, m, partie)) return { ok: false, erreur: 'partie' };
  const netAvant = patrimoine().net;
  const t = enTransaction(() => {
    const src = compteById(source), dst = compteById(destination);
    for (const e of (src.cash || [])) e.montant = 0;
    dst.cash = dst.cash || [];
    let e = dst.cash.find(x => x.affectation === cible);
    if (!e) { e = { montant: 0, affectation: cible }; dst.cash.push(e); }
    e.montant = round2(num(e.montant) + m);
    src.statut = 'archive';
    src.archiveMotif = 'transfert';
    src.archiveVers = destination;
    if (clotureLe) src.clotureLe = clotureLe; else delete src.clotureLe;
    return true;
  }, () => Math.abs(patrimoine().net - (netAvant - (solde - m))) < 0.005);
  return t.ok ? { ok: true, solde, montant: m, ecartNet: round2(m - solde) } : { ok: false, erreur: t.erreur };
}

function archivesAvecTitres() {
  return COMPTES().filter(c => c.statut === 'archive').map(c => {
    const lignes = (Store.state.positions || []).filter(p => p.account === c.id);
    return { compte: c, lignes, valeur: round2(lignes.reduce((s, p) => s + posValue(p), 0)) };
  }).filter(x => x.lignes.length);
}

const destinationsLignes = sourceId =>
  comptesOuverts().filter(c => c.id !== sourceId && typeCompte(c.type).titres);

function deplacerLignesArchivees(sourceId, destId) {
  if (!destinationsLignes(sourceId).some(c => c.id === destId)) return { ok: false, erreur: 'destination' };
  const lignes = (Store.state.positions || []).filter(p => p.account === sourceId);
  if (!lignes.length) return { ok: false, erreur: 'rien' };
  const valeur = round2(lignes.reduce((s, p) => s + posValue(p), 0));
  const netAvant = patrimoine().net, marchesAvant = stockTotals().balance;
  const t = enTransaction(() => {
    for (const p of Store.state.positions) if (p.account === sourceId) p.account = destId;
    return true;
  }, () => Math.abs(patrimoine().net - (netAvant + valeur)) < 0.005
        && Math.abs(stockTotals().balance - marchesAvant) < 0.005);
  return t.ok ? { ok: true, lignes: lignes.length, valeur } : { ok: false, erreur: t.erreur };
}

function impactArchivage(id) {
  const c = compteById(id);
  if (!c || c.statut === 'archive') return null;
  const avant = patrimoine();
  const statut = c.statut;
  c.statut = 'archive';
  refreshAccounts();
  const apres = patrimoine();
  c.statut = statut;
  refreshAccounts();
  const lignes = (Store.state.positions || []).filter(p => p.account === id);
  return {
    valeur: round2(valeurCompte(c)),
    brutAvant: round2(avant.brut), brutApres: round2(apres.brut),
    netAvant: round2(avant.net), netApres: round2(apres.net),
    ecartNet: round2(apres.net - avant.net),
    lignesTitres: lignes.length,
    valeurTitres: round2(lignes.reduce((s, p) => s + posValue(p), 0)),
    creditRestant: round2(creditsDuBien(c).reduce((s, d) => s + num(d.montant), 0)),
  };
}

function comptesAnciens() {
  const clos = comptesClosDetaches();
  const retient = new Map(clos.retenus.map(x => [x.id, x]));
  const out = { archives: [], clos: [] };
  for (const a of ACCOUNTS) {
    if (!a.legacy) continue;
    const r = retient.get(a.id);
    const x = { id: a.id, label: a.label, etab: a.broker || '',
                compte: a.compte || null, restaurable: !!a.compte,
                mois: r ? r.mois : [], aujourdhui: r ? r.aujourdhui : 0 };
    (x.restaurable ? out.archives : out.clos).push(x);
  }
  return out;
}

/* Retire des comptes clos, des deux listes ou ils peuvent vivre, et rend leur
   nombre. Ne sauvegarde pas : l'appelant prend une sauvegarde avant et ecrit
   apres, comme la remise a zero.

   Les identifiants sont OBLIGATOIRES, et c'est un garde-fou : la suppression se
   demande compte par compte, depuis la ligne de ce compte. Un appel sans
   argument aurait un sens — « tous ceux que rien ne retient » — et c'est
   justement le geste global qu'on ne veut plus offrir.

   ON FIGE AVANT DE RETIRER. Un releve ancien ne porte que des montants par
   compte, `v`, et son total se recompose en parcourant ACCOUNTS : retirer un
   compte que ce releve mentionne retranchait donc son montant du total du mois,
   sans un mot, et les mois suivants se comparaient a un passe qui avait maigri.
   C'etait la raison pour laquelle ces comptes-la ne se retiraient pas.

   `rowGroups` lit `parts`, puis `poches`, puis seulement ACCOUNTS. Ecrire
   `poches` sur le releve AVANT la suppression y grave la ventilation telle
   qu'elle est aujourd'hui : le total du mois cesse alors de dependre de la
   liste des comptes, et il ne bouge pas d'un centime quand elle change.

   Seuls les releves concernes sont figes, et seulement ceux qui n'ont ni
   `parts` ni `poches` : un releve moderne porte deja sa ventilation, il n'y a
   rien a graver.

   LE MONTANT PAR COMPTE RESTE. Il ne designe plus un compte que l'application
   connaisse, mais c'est ce qui a ete saisi ce mois-la, et rien n'oblige a le
   detruire pour retirer une fiche. Les ecrans ne montrent que les comptes qui
   existent : il ne se lit plus nulle part, il n'est pas efface pour autant. */
function retirerComptesClos(ids) {
  const clos = comptesClosDetaches();
  const tous = [...clos.libres, ...clos.retenus];
  const cibles = new Set(tous.filter(x => (ids || []).includes(x.id)).map(x => x.id));
  if (!cibles.size) return 0;
  for (const r of (Store.state.monthly || [])) {
    if (r.parts || r.poches) continue;
    if (![...cibles].some(id => r.v && r.v[id] != null)) continue;
    r.poches = rowGroups(r);
  }
  Store.state.comptes = (Store.state.comptes || []).filter(c => !cibles.has(c.id));
  Store.state.accounts = (Store.state.accounts || []).filter(a => !cibles.has(a.id));
  refreshAccounts();
  return cibles.size;
}

/* Supprimer UN compte clos, et seulement un compte clos.

   `retirerComptesClos` retire ce qu'on lui nomme parmi les comptes hors totaux,
   sans distinguer celui qui a encore une fiche de celui qui n'en a plus. C'est
   la bonne definition pour elle : elle nettoie une liste.

   Ce n'est pas la bonne porte pour un geste d'ecran. Un compte ARCHIVE est mis
   de cote pour etre garde, et il se rouvre ; un compte CLOS est fini, et il ne
   se rouvre pas. Offrir la suppression sur le premier revient a proposer de
   detruire ce qu'on a justement choisi de conserver — et le garde-fou ne peut
   pas etre l'absence d'un bouton, qui ne protege que ce qu'on voit.

   La condition est `restaurable`, la donnee du modele : elle dit s'il reste une
   fiche a rouvrir, jamais dans quelle section un ecran range la ligne. */
function supprimerCompteClos(id) {
  if (!comptesAnciens().clos.some(x => x.id === id)) return 0;
  return retirerComptesClos([id]);
}

function accountTypes() { return Store.state.accountTypes; }
function accountType(id) {
  return accountTypes().find(t => t.id === id)
      || { id, label: id || 'Autre', group: 'bourse' };
}

function accountsWhere(pred) { return ACCOUNTS.filter(a => !a.legacy && pred(a)); }
function brokerCashAccounts() { return accountsWhere(a => a.role === 'cash'); }
function marginAccounts() { return accountsWhere(a => a.role === 'margin'); }
function sumNow(comptes) { return comptes.reduce((s, a) => s + nowValue(a.id), 0); }

function cashOf() { return 0; }

function allocLabel(a) { return a.alloc || a.label; }

function defaultHoldingAccount() {
  return (accountsWhere(a => a.holdings)[0] || ACCOUNTS[0] || {}).id || '';
}

const num = v => (v === '' || v === null || v === undefined || isNaN(v)) ? 0 : Number(v);
const round2 = v => Math.round(v * 100) / 100;
const round4 = v => Math.round(v * 10000) / 10000;
const roundQty = v => Math.round(v * 1e8) / 1e8;

const MASK_KEY = 'wealth-dashboard:discret';
const cleMasque = () => cleParUtilisateur(MASK_KEY);

function lireMasque() {
  try { return localStorage.getItem(cleMasque()) === '1'; } catch (e) { return false; }
}

/* CETTE VALEUR SE LIT DEUX FOIS, ET LA SECONDE EST LA BONNE. Le fichier
   s'evalue avant que l'identite soit connue, donc la premiere lecture porte sur
   la clef sans portee. `relireMasque()` est rappele des que le compte est
   etabli : sans lui, le reglage du compte precedent restait a l'ecran. */
function relireMasque() { montantsMasques = lireMasque(); }
let montantsMasques = lireMasque();

function setMasque(on) {
  montantsMasques = !!on;
  try { localStorage.setItem(cleMasque(), on ? '1' : '0'); } catch (e) {}
}
const masqueActif = () => montantsMasques;

const SIGNES = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', JPY: '¥' };
const symboleDevise = devise => SIGNES[devise || 'EUR']
  || String(devise ?? '').replace(/[&<>"']/g, '');
const OEIL_MASQUE = '<svg class="oeil-masque" viewBox="0 0 24 24" role="img"'
  + ` aria-label="${trad('montant masqué')}">`
  + '<path d="M1.9 12S5.9 5.6 12 5.6 22.1 12 22.1 12 18.1 18.4 12 18.4 1.9 12 1.9 12Z"/>'
  + '<line x1="4.5" y1="19.5" x2="19.5" y2="4.5"/></svg>';

/* --- UNE DEVISE PRINCIPALE PAR PROFIL ------------------------------------

   Un profil Longward, une devise. Elle dit dans quelle monnaie se lisent TOUS
   les montants saisis : un solde, une mensualite, un budget, un objectif.

   CE QU'ELLE N'EST PAS. Ce n'est pas un moteur multi-devises. Changer de
   devise ne convertit rien, et c'est deliberе : convertir demanderait un taux
   et une date, donc inventer deux nombres que personne n'a declares. Cent
   mille euros deviennent cent mille dollars, le nombre ne bouge pas, seule son
   unite change. L'interface le dit avant de le faire.

   La langue ne la decide pas. Un francais peut compter en dollars, un
   anglophone vivant en France en euros : `locale()` gouverne le format des
   nombres, la devise gouverne le signe. Les deux sont independants, et un test
   croise les quatre combinaisons.

   Deux devises pour cette passe, et la table reste extensible. */
const DEVISES_BASE = [['EUR', 'Euro (€)'], ['USD', 'Dollar américain ($)']];

function deviseBase() {
  const d = Store && Store.state && Store.state.meta ? Store.state.meta.devise : null;
  return DEVISES_BASE.some(([id]) => id === d) ? d : 'EUR';
}
const signeDeviseBase = () => symboleDevise(deviseBase());
const NOMS_DEVISE = { EUR: 'Euro', USD: 'Dollar américain' };
/* LA DEVISE EST-ELLE ENCORE A CHOISIR ?

   Deux situations qu'il faut distinguer, et rien d'autre ne les separe :

   Un profil deja servi, cree quand seul l'euro existait. Ses montants SONT des
   euros, personne n'a besoin de le lui demander, et l'interrompre pour une
   question dont la reponse est ecrite dans ses donnees serait absurde. La
   migration tranche pour lui, une fois, et l'enregistre comme un fait.

   Un profil vierge. Il n'a aucun montant, donc aucune reponse implicite : la
   question se pose, avant la premiere saisie, et c'est lui qui repond.

   Le choix se DECLARE, il ne se devine pas : `deviseChoisie` est un fait pose,
   jamais deduit a chaque rendu. Sans quoi saisir puis effacer son premier
   compte reposerait la question. */
const deviseAChoisir = () => !Store.state?.meta?.deviseChoisie;

function aDesMontantsSaisis() {
  const s = Store.state;
  if (!s) return false;
  const b = s.budget || {};
  return (s.comptes || []).some(c => (c.lignes || []).some(l => num(l.montant) || num(l.valeur)))
    || Object.values(s.now || {}).some(v => num(v) !== 0)
    || (s.positions || []).length > 0
    || (b.income || []).some(r => num(r.amount))
    || (b.fixedCharges || []).some(r => num(r.amount))
    || aDesDepensesSaisies()
    || num(s.meta && s.meta.objective) > 0;
}

const masque = devise => `${OEIL_MASQUE} ${symboleDevise(devise)}`;

/* Le meme masque en texte pur. Deux endroits l'exigent, et pour la meme
   raison : une balise n'y est pas du balisage.

   Dans un `<text>` SVG — etiquettes d'axe, valeurs posees sur les barres —
   elle s'imprimerait telle quelle. Dans un ATTRIBUT — `title`, `aria-label` —
   c'est pire : le masque porte lui-meme un `aria-label="montant masqué"`, dont
   le guillemet ferme l'attribut hote, et la fin de la balise se deverse en
   texte visible dans la page. C'est ce qui affichait un `€">` nu a cote de
   l'objectif mensuel. Tout montant pose dans un attribut passe donc par ici. */
const masqueTexte = devise => '••• ' + symboleDevise(devise);

/* --- un seul signe moins dans toute l'application -----------------------
   `Intl` rend « -13 500,00 € » avec un trait d'union ASCII, alors que
   l'application ecrit ses negatifs a la main avec le vrai signe moins :
   « −96 000,00 € » pour une dette, « −1 250 € » pour un ecart. Sans ce
   remplacement, le meme ecran porterait les deux, le grand chiffre en tete avec
   le trait d'union et les lignes en dessous avec le signe. L'ecart se voit : le
   trait d'union est plus
   court, plus haut, et il ne s'aligne pas sur la barre du plus.

   Le remplacement ne s'applique qu'aux formateurs de nombres, ou aucun tiret
   n'est legitime — une date ou un identifiant passe par d'autres chemins. */
/* LE SEPARATEUR DES MILLIERS SE VOIT. `Intl` groupe le francais par une
   espace fine insecable (U+202F) ; Segoe UI, sous Windows, la dessine sur un
   ou deux pixels, et l'approche serree des grands chiffres l'efface : « 1639 »
   au lieu de « 1 639 ». L'espace insecable ordinaire garde le groupe sur une
   ligne et se voit a toutes les tailles. Les deux corrections vivent ensemble
   parce que tous les formateurs de nombres passent par ici. */
const moinsTypographique = s => String(s).replace(/-/g, '−').replace(/\u202f/g, '\u00a0');

const fmtEUR = (v, dec = 2) => montantsMasques ? masque(deviseBase())
  : moinsTypographique(new Intl.NumberFormat(locale(), {
      style: 'currency', currency: deviseBase(), currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: dec, maximumFractionDigits: dec,
    }).format(num(v)));

const fmtEUR0 = v => fmtEUR(v, 0);

/* DES PARTS A L'EURO QUI REFONT LEUR TOTAL A L'EURO.

   Arrondir chaque part pour elle-meme peut laisser la somme des arrondis a un
   euro ou deux du total arrondi, et un tableau dont le pied ne vaut pas la
   somme des lignes est ce que ce projet s'interdit. On part donc des arrondis
   individuels, a la convention de `fmtEUR0` (le demi-euro s'eloigne de zero),
   puis chaque euro qui manque ou qui deborde va a la part ou il augmente le
   moins l'erreur ; a egalite, la premiere de la liste. Deux parts de +0,49 et
   -0,49 restent donc a zero l'une et l'autre, et leur total aussi.

   `total` : le total AFFICHE, quand l'ecran masque des parts negligeables
   (moins d'un demi-centime) qu'il compte pourtant dedans. Les parts visibles
   visent alors son arrondi. Il ne sert que si l'ecart avec leur somme reste
   sous l'euro : au-dela, ce ne serait plus un arrondi mais une part qui
   manque, et la maquiller cacherait le defaut au lieu de le montrer.

   Une fonction d'AFFICHAGE : elle rend des entiers, ne touche a aucune valeur,
   et les pourcentages se calculent toujours sur les montants exacts. */
function arrondirParts(valeurs, total = null) {
  const v = (valeurs || []).map(x => num(x));
  if (!v.length) return [];
  const arrondi = x => (Math.sign(x) * Math.round(Math.abs(x))) || 0;
  const out = v.map(arrondi);
  const somme = v.reduce((s, x) => s + x, 0);
  const cible = arrondi(total !== null && Math.abs(num(total) - somme) < 1 ? num(total) : somme);
  let ecart = cible - out.reduce((s, x) => s + x, 0);
  while (ecart !== 0) {
    const pas = Math.sign(ecart);
    let meilleur = 0, cout = Infinity;
    for (let i = 0; i < v.length; i++) {
      const c = Math.abs(out[i] + pas - v[i]) - Math.abs(out[i] - v[i]);
      if (c < cout - 1e-9) { cout = c; meilleur = i; }
    }
    out[meilleur] += pas;
    ecart -= pas;
  }
  return out;
}

/* Un nombre de mois suit les separateurs de la langue. `toFixed(1)` ecrivait
   « 0.8 mois » au milieu d'une interface qui met des virgules partout. */
const fmtMois = v => new Intl.NumberFormat(locale(),
  { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(num(v));
const fmtEUR0Texte = v => montantsMasques ? masqueTexte(deviseBase()) : fmtEUR0(v);

const fmtCur = (v, devise = 'EUR', dec = 2) => montantsMasques ? masque(devise)
  : moinsTypographique(new Intl.NumberFormat(locale(), {
      style: 'currency', currency: devise || 'EUR',
      minimumFractionDigits: dec, maximumFractionDigits: dec,
    }).format(num(v)));

const fmtPart = v => fmtEUR(v,
  Math.abs(num(v)) > 0 && Math.abs(num(v)) < 0.01 ? 4 : 2);

function fmtCurEur(v, devise, taux) {
  if (!devise || devise === deviseBase()) return fmtEUR(v);
  return `${fmtCur(v, devise)} <span class="muted">≈ ${fmtEUR(num(v) * (num(taux) || 1))}</span>`;
}

const fmtPct = (v, dec = 2) => moinsTypographique(new Intl.NumberFormat(locale(), {
  minimumFractionDigits: dec, maximumFractionDigits: dec,
}).format(num(v))) + (enAnglais() ? '%' : ' %');

const fmtNombre = v => moinsTypographique(num(v).toLocaleString(locale(), { maximumFractionDigits: 2 }));

/* --- La part d'une valeur dans un total -----------------------------------

   UN POURCENTAGE N'EXISTE QUE SUR UNE BASE STRICTEMENT POSITIVE. C'est la regle
   que `deltas()` et `poidsPoches()` appliquent deja, et elle a deux raisons
   qu'aucun garde-fou local ne remplace : un total nul divise par zero, et une
   base negative retourne tous les signes -- un patrimoine net de -20 000 EUR
   ferait afficher « -43 % » a une poche qui pese pourtant quelque chose.
   `null` et non zero : la part n'est pas nulle, elle n'existe pas.

   UNE VALEUR NEGATIVE SUR UNE BASE POSITIVE GARDE SON SIGNE. Le trace net impute
   le reliquat de dette sur la poche qui porte les prets, qui devient negative ;
   la carte de repartition montre deja cette part telle quelle. La masquer ferait
   un total qui ne vaudrait plus la somme de ses parts.

   Ces trois lignes vivent ici et non dans le dessin, parce que le harnais de
   tests ne charge pas `charts.js` : une regle posee la-bas ne se verifierait que
   des yeux, et c'est exactement ce que ce projet a appris a ne plus faire. */
const baseDivisible = base => num(base) > 0.005;
const poidsDansTotal = (valeur, base) =>
  baseDivisible(base) ? num(valeur) / num(base) * 100 : null;
const fmtPoids = (valeur, base) => {
  const p = poidsDansTotal(valeur, base);
  return p == null ? '' : fmtPct(p, 1);
};
const fmtDelaiMois = v => {
  const n = Math.max(0, Math.round(num(v)));
  const ans = Math.floor(n / 12), mois = n % 12;
  const partAns = ans ? `${ans} ${ans > 1 ? trad('ans') : trad('an')}` : '';
  const partMois = mois ? `${mois} ${trad('mois')}` : '';
  if (partAns && partMois) return `${partAns} ${trad('et')} ${partMois}`;
  return partAns || partMois || trad('moins d’un mois');
};

/* --- LA LARGEUR D'UNE BARRE DE PART, ET SON PLANCHER ------------------------

   Une poche a trois dixiemes de pourcent rend une barre de moins d'un pixel :
   0,3 % de 311 px font 0,93 px, que l'arrondi du navigateur et le rayon de la
   pastille effacent tout a fait. La ligne porte alors un nom, un montant, un
   pourcentage, et une barre vide — le dessin dement le chiffre.

   LE PLANCHER EST EN PIXELS, ET C'EST VOULU. C'est une question de dessin et
   non de comptabilite : ce qui compte est qu'il reste quelque chose a voir, et
   trois pixels restent trois pixels que la carte fasse 311 px de large ou 700.
   Un plancher en pourcentage aurait grossi avec elle.

   IL NE VAUT QUE POUR UNE PART STRICTEMENT POSITIVE. Une poche a zero garde une
   barre vide, et c'est une information : zero n'est pas trois dixiemes.

   ET IL NE TOUCHE PAS AU CHIFFRE. La ligne continue d'afficher « 0,3 % ». Le
   plancher est graphique, il ne remonte nulle part, et il ne rend pas une part
   de 0,3 % comparable a une part de 5 % : au-dela d'environ un pour cent, c'est
   la proportion qui l'emporte, exactement comme avant.

   Il vit avec les formateurs, et non dans la vue : le harnais de tests ne
   charge pas `app.js`, et une regle posee la-bas ne se verifierait que des
   yeux. Ce qu'il rend est une longueur CSS, comme `fmtEUR0` rend un montant. */
const largeurPart = pct => num(pct) > 0 ? `max(3px, ${Math.min(100, num(pct)).toFixed(1)}%)` : '0%';

const fmtSigned = v => (v >= 0 ? '+' : '−') + fmtEUR(Math.abs(v), 0);
/* Un montant signe, sauf a zero : « +250 € », « −300 € », et « 0 € » plutot que
   « +0 € ». Un plus devant un zero se lit comme une addition qui n'a pas eu
   lieu ; il fait douter de la ligne au lieu de l'expliquer.

   Le formateur se passe en argument parce qu'il y a deux sorties pour un meme
   montant : `fmtEUR0` rend du BALISAGE quand les montants sont masques — un
   oeil barre en SVG — et c'est ce qu'il faut a l'ecran. Dans un ATTRIBUT, celui
   d'une aide par exemple, ce balisage s'affiche en clair : `fmtEUR0Texte` y rend
   « ••• € ». Deux fonctions jumelles ecrites a la main auraient fini par ne plus
   signer pareil. */
const montantSigne = (v, f = fmtEUR0) =>
  Math.abs(v) < 0.005 ? f(0) : (v >= 0 ? '+' : '−') + f(Math.abs(v));
const fmtSignedPct = (v, dec = 2) => (v >= 0 ? '+' : '−') + fmtPct(Math.abs(v), dec);

const MOIS_COURTS = {
  fr: ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
};
const moisCourts = () => MOIS_COURTS[currentLang()] || MOIS_COURTS.fr;

const eliderDe = s => (enAnglais() ? String(s)
  : String(s).replace(/(^|[\s(])de (?=[aeiouyàâäéèêëîïôöûüh])/gi, '$1d’'));

function fmtMonth(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  if (d > 20) return enAnglais() ? `End ${y}` : `Fin ${y}`;   // ligne de cloture
  return `${moisCourts()[m - 1]} ${String(y).slice(2)}`;
}

function fmtMoisAn(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return `${moisCourts()[m - 1]} ${y}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (enAnglais()) return `${Number(d)} ${moisCourts()[Number(m) - 1]} ${y}`;
  return `${d}/${m}/${y}`;
}
function fmtJourMois(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-').map(Number);
  const jourMois = `${d} ${moisCourts()[m - 1] || ''}`.trim();
  return a && a !== new Date().getFullYear() ? `${jourMois} ${a}` : jourMois;
}

/* Quand ce cours a-t-il ete imprime par la place ? En secondes, comme
   `quoteTime` l'arrive de la passerelle.

   Elle vit ici et non dans `app.js` parce que quatre ecrans la posent — la
   pastille du haut, la carte du jour, son apercu et la fiche d'une ligne — et
   qu'une phrase recopiee quatre fois finit par dire quatre choses. Le harnais
   de tests peut aussi l'appeler : il ne charge que `store.js`.

   Elle rend sa preposition avec elle — « de 11:05 », « d'hier a 22:00 »,
   « du 1 août a 17:30 » — parce que les trois branches n'appellent pas la
   meme, et que ses appelants ecrivent tous « cours … » ou « date … ». Sans
   ça, chacun d'eux porterait sa propre elision, et le premier oubli donnerait
   « cours de hier ». C'est ce qu'affichait la premiere version, vue a
   l'ecran. */
function fmtCoursQuand(secondes) {
  const t = num(secondes);
  if (!t) return '';
  const d = new Date(t * 1000);
  const heure = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const jour = isoLocal(d);
  if (jour === todayISO()) return enAnglais() ? `from ${heure}` : `de ${heure}`;
  /* La veille se derive de `todayISO()` et non de `new Date()` : c'est le seul
     repere que le harnais peut deplacer, et « hier » doit suivre le jour
     suppose, sans quoi un test joue a une date et lit une phrase calee sur une
     autre. Midi, pour ne pas glisser d'un jour au changement d'heure. */
  const veille = new Date(todayISO() + 'T12:00:00');
  veille.setDate(veille.getDate() - 1);
  if (jour === isoLocal(veille)) return enAnglais() ? `from yesterday at ${heure}` : `d’hier à ${heure}`;
  return enAnglais() ? `from ${fmtJourMois(jour)} at ${heure}` : `du ${fmtJourMois(jour)} à ${heure}`;
}

function cleIsin(code) {
  const corps = String(code || '').trim().toUpperCase().slice(0, 11);
  if (!/^[A-Z]{2}[A-Z0-9]{9}$/.test(corps)) return null;
  const expanded = [...corps].map(ch => parseInt(ch, 36)).join('');
  let total = 0, double = true;
  for (let i = expanded.length - 1; i >= 0; i--) {
    let d = +expanded[i];
    if (double) { d *= 2; if (d > 9) d -= 9; }
    total += d;
    double = !double;
  }
  return String((10 - total % 10) % 10);
}

function isinCorrige(code) {
  const brut = String(code || '').trim().toUpperCase();
  const cle = cleIsin(brut);
  if (!cle) return null;
  const attendu = brut.slice(0, 11) + cle;
  return attendu === brut ? null : attendu;
}

function isinIsValid(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(c)) return false;
  return cleIsin(c) === c[11];
}

const EXCHANGE_SUFFIX = {
  EPA: '.PA', EPAR: '.PA', ETR: '.DE', FRA: '.F', LON: '.L', AMS: '.AS',
  EBR: '.BR', BIT: '.MI', BME: '.MC', SWX: '.SW', VIE: '.VI',
  NASDAQ: '', NYSE: '', NYSEARCA: '', BATS: '',
};
function guessSymbol(ticker) {
  if (!ticker) return '';
  const t = String(ticker).trim();
  const m = t.match(/^([A-Za-z]+):(.+)$/);
  if (!m) return t.toUpperCase();
  const suffix = EXCHANGE_SUFFIX[m[1].toUpperCase()];
  return suffix === undefined ? m[2].toUpperCase() : m[2].toUpperCase() + suffix;
}

const Store = {
  state: null,

  load() {
    let raw = null;
    try { raw = localStorage.getItem(cleStockage()); } catch (e) { /* file:// restreint */ }
    if (raw) {
      try {
        this.state = JSON.parse(raw);
        this.migrate();
        this._prev = structuredClone(this.state);
        return this.state;
      } catch (e) { console.warn('État illisible, retour au seed.', e); }
    }
    /* La graine passe par la migration comme un etat relu, et pour la meme
       raison : elle est ecrite dans l'ancien modele, un compte par ligne de
       relevé. C'est la migration qui en tire les etablissements, les comptes,
       leurs poches de cash et leurs credits.

       Elle ne l'etait pas, et le premier lancement rendait donc un etat a
       moitie construit : `comptes` absent, et tout ce qui en descend a zero.
       Le patrimoine s'affichait a 0 EUR sur une page qui portait pourtant ses
       huit cartes. Le defaut ne se voyait qu'une fois — la sauvegarde qui
       suivait le premier geste passait l'etat par la migration — donc jamais
       pendant qu'on developpe, avec un stockage deja rempli. Il ne se voyait
       qu'a la seule visite qui compte pour une demonstration : la premiere. */
    this.state = structuredClone(SEED);
    this.migrate();
    this._prev = structuredClone(this.state);
    refreshAccounts();
    return this.state;
  },

  migrate() {
    const s = this.state;

    s.meta = Object.assign(structuredClone(SEED.meta), s.meta || {});
    s.targets = Object.assign(structuredClone(SEED.targets), s.targets || {});
    s.strategy = Object.assign(structuredClone(SEED.strategy), s.strategy || {});
    s.accountInfo = Object.assign(structuredClone(SEED.accountInfo), s.accountInfo || {});
    s.now = s.now || structuredClone(SEED.now);
    s.monthly = s.monthly || structuredClone(SEED.monthly);
    s.positions = s.positions || structuredClone(SEED.positions);
    s.quotes = s.quotes || { lastRun: null, fx: {}, changes: [] };
    s.sales = s.sales || [];
    if (!Array.isArray(s.purchases)) s.purchases = [];
    if (!s.meta.exchangeAutoDone) {
      s.meta.preferredExchange = 'auto';
      s.meta.exchangeAutoDone = true;
    }

    if (!Array.isArray(s.budget.contributors)) {
      const partage = s.budget.fixedCharges.some(c => num(c.sharePK));
      s.budget.contributors = partage ? [{ id: 'pk', name: 'PK' }] : [];
      for (const c of s.budget.fixedCharges) {
        if (!c.shares) c.shares = {};
        if (num(c.sharePK)) c.shares.pk = num(c.sharePK);
        delete c.sharePK;
      }
    }

    if (!s.meta.classementRevu) {
      if (!s.accountTypes.some(t => t.id === 'levier')) {
        s.accountTypes.push({ id: 'levier', label: 'Levier / dette', group: 'bourse' });
      }
      for (const a of s.accounts) {
        if (a.role === 'margin') a.type = 'levier';
        if (a.holdings && s.accountInfo[a.id]?.liquidity === 'illiquid') {
          s.accountInfo[a.id].liquidity = 'liquid';
        }
      }
      s.meta.classementRevu = true;
    }

    for (const r of (s.budget?.supplements || [])) {
      if (r.amount !== undefined || r.annual === undefined) continue;
      r.amount = num(r.annual);
      r.period = 'an';
      r.note = [r.perDay, r.perYear].filter(Boolean).join(' · ');
      delete r.annual; delete r.perDay; delete r.perYear;
    }

    s.budget = Object.assign(structuredClone(SEED.budget), s.budget || {});
    if (!Array.isArray(s.budget.categories) || !s.budget.categories.length) {
      s.budget.categories = categoriesParDefaut();
    }
    /* Le calendrier des DÉPENSES, et lui seul.

       Il reste parce qu'il est la seule porte vers un mois passé : le tableau du
       détail mensuel affiche ses douze lignes, et c'est en cliquant l'une d'elles
       qu'on saisit février de l'an dernier. Le retirer sans lui donner un
       remplaçant — un sélecteur de mois dans la fenêtre de saisie, comme celui du
       relevé — fermerait cette porte.

       Les RELEVÉS n'en ont plus besoin : le journal n'affiche que les mois
       renseignés, et « Ajouter un relevé » choisit son mois et son année, en
       créant la ligne à la demande (`indexReleve`). Douze lignes vides par an
       dans le stockage ne servaient plus rien, et le point 19 les refuse.

       Les lignes vides déjà créées restent : elles ne portent aucun montant,
       mais elles peuvent porter une note, et rien ici ne supprime ce que
       quelqu'un a écrit. */
    ensureCalendarMonths(s.budget.expenses, 'month', 'note');
    s.accountTypes = s.accountTypes || structuredClone(SEED.accountTypes);
    s.accounts = s.accounts || structuredClone(SEED.accounts);
    s.typesPerso = s.typesPerso || [];

    /* Le détail d'une catégorie de dépenses est retiré, et son champ avec.

       Il vivait dans `d`, à côté du total : « Restos 146, dont TR 110 et Bourso
       36 ». Deux surfaces d'édition pour une seule valeur, et tout le mal venait
       de les réconcilier — retaper le total effaçait les libellés, et le champ
       principal ne pouvait pas être à la fois un total et une porte. Quelqu'un qui
       veut suivre deux choses séparément fait deux catégories : c'est ce que les
       catégories sont.

       La purge est ici et non à l'enregistrement d'un mois : un champ que plus
       aucun écran ne lit deviendrait invisible sans disparaître, et il sortirait
       encore dans les sauvegardes. Idempotente par construction — elle supprime
       une clé absente au second passage. */
    /* Le zero qui voulait dire « automatique ».

       `projMonthly: 0` etait le sentinelle de la graine : zero etant faux en
       JavaScript, la projection retombait sur l'epargne du budget. Maintenant
       que zero veut dire zero, ces etats-la verraient leur courbe s'aplatir
       sans que personne l'ait demande. La clef s'en va donc, ce qui redonne
       exactement le comportement d'avant — et la clef absente est desormais le
       seul moyen de dire « automatique ».

       A un coup, et c'est necessaire : sans le drapeau, un utilisateur qui
       choisit vraiment 0 verrait son choix efface au chargement suivant. */
    if (!s.meta.projMonthlyZeroLu) {
      if (num(s.meta.projMonthly) === 0) delete s.meta.projMonthly;
      s.meta.projMonthlyZeroLu = true;
    }

    /* La banque d'un credit : une seule clef.

       `preteur` est la clef que la fenetre de creation ecrit et que la carte des
       credits, la fiche et l'export lisent. La fiche d'un etablissement, elle,
       editait `organisme` -- donc taper le nom de la banque depuis cet ecran
       partait dans une clef que personne ne relisait.

       La regle : `preteur` gagne quand il porte quelque chose, sinon `organisme`
       la prend. Aucune valeur inventee, aucune ecrasee. Idempotente sans
       drapeau -- la clef effacee ne peut plus se reecrire. */
    for (const e of (s.etabs || [])) {
      for (const d of (e.dettes || [])) {
        if (d.organisme === undefined) continue;
        if (!d.preteur && d.organisme) d.preteur = d.organisme;
        delete d.organisme;
      }
    }

    if (s.meta.projRateCrypto !== undefined) {
      if (!num(s.meta.projRateAutres) && num(s.meta.projRateCrypto)) {
        s.meta.projRateAutres = num(s.meta.projRateCrypto);
      }
      delete s.meta.projRateCrypto;
    }
    if (s.meta.projVersementVers === 'crypto'
        || s.meta.projVersementVers === 'nonCote') {
      s.meta.projVersementVers = 'autres';
    }

    if (!s.meta.detailRetire) {
      for (const r of (s.budget?.expenses || [])) delete r.d;
      s.meta.detailRetire = true;
    }

    for (const c of (s.comptes || [])) {
      if (!Array.isArray(c.cash) || !c.cash.length) continue;
      if (!typeCompte(c.type).sansCash) continue;
      c.cash = c.cash.filter(e => num(e.montant) || e.affectation);
    }

    if (!s.meta.typesEnrichis) {
      const nouveaux = [
        { id: 'av',      label: 'Assurance vie',       group: 'bourse' },
        { id: 'per',     label: 'PER',                 group: 'bourse' },
        { id: 'immo',    label: 'Immobilier',          group: 'pe' },
        { id: 'scpi',    label: 'SCPI',                group: 'pe' },
        { id: 'metaux',  label: 'Métaux précieux',     group: 'bourse' },
        { id: 'epargne', label: 'Épargne réglementée', group: 'cash' },
      ];
      for (const t of nouveaux) {
        if (!s.accountTypes.some(x => x.id === t.id)) s.accountTypes.push(t);
      }
      s.meta.typesEnrichis = true;
    }

    if (!DEVISES_BASE.some(([id]) => id === s.meta.devise)) {
      s.meta.devise = 'EUR';
    }

    if (typeof s.meta.deviseChoisie !== 'boolean') {
      const b = s.budget || {};
      s.meta.deviseChoisie = (s.comptes || []).length > 0
        || (s.positions || []).length > 0
        || Object.values(s.now || {}).some(v => num(v) !== 0)
        || (b.income || []).length > 0 || (b.fixedCharges || []).length > 0
        || (s.history || []).length > 0;
    }
    const parDefaut = Object.fromEntries(SEED_ACCOUNTS.map(a => [a.id, a]));
    for (const a of s.accounts) {
      if (!a.type) a.type = accountTypes().find(t => t.group === a.group)?.id || 'banque';
      if (a.role === undefined) a.role = parDefaut[a.id]?.role || '';
      if (a.alloc === undefined && parDefaut[a.id]?.alloc) a.alloc = parDefaut[a.id].alloc;
    }
    refreshAccounts();

    for (const p of s.positions) {
      if (p.symbol === undefined) p.symbol = guessSymbol(p.ticker);
      if (p.currency === undefined) p.currency = (num(p.fx) && num(p.fx) !== 1) ? 'USD' : 'EUR';
      if (p.isin === undefined) p.isin = '';
      /* Fige le PRU au taux d'achat — mais jamais a 1 sur une ligne en devise :
         ce 1 est la valeur par defaut de la creation, pas un taux, et il faisait
         compter des dollars comme des euros. Remis a vide, il sera figé au premier
         taux connu ; d'ici la, `tauxAchat()` prend le taux courant. Idempotent :
         rejouer la migration sur un etat deja repare ne change rien. */
      /* `fxBuy` ne sert plus a convertir : les deux jambes prennent le taux du
         jour. Le champ part des positions — il portait le taux du premier
         rafraichissement, pas celui d'un achat — mais reste sur les ventes
         enregistrees, ou il est un fait date de la transaction. */
      if (p.fxBuy !== undefined) delete p.fxBuy;
    }

    this.migrerModele(s);
    poserEspeces(s);
    this.migrerClassesActifs(s);
    this.migrerCibles(s);
    /* --- les contenants restés vides d'avant le correctif -------------------
       Supprimer le dernier compte d'un établissement emporte désormais
       l'établissement (`supprimer-compte`), parce qu'un contenant sans compte
       n'apparaît plus sur aucun écran : la liste des comptes saute les
       établissements vides. Il ne ressortait qu'à l'étape 2 d'un ajout, où la
       règle propose les vides sous n'importe quel type — d'où l'impression
       d'une mémoire résiduelle, un bien supprimé qui revient proposer de s'y
       rattacher, y compris dans la fenêtre « Assureur ou courtier ».

       Le correctif ne valait que pour les suppressions à venir. Les contenants
       déjà orphelins sont restés dans les données, invisibles et
       indéboulonnables : aucun écran ne les montre, donc aucun écran ne permet
       de les retirer. Un correctif qui ne regarde que l'avenir laisse le défaut
       en place chez ceux qui l'ont déjà subi.

       Un établissement qui porte une dette reste, lui, même sans compte : le
       contrôle de cohérence « Crédit sans bien » a besoin de le nommer, et
       cette dette se soustrait toujours du patrimoine net. La supprimer ici
       effacerait un chiffre au lieu de le signaler.

       Idempotente : au second passage il n'y a plus rien d'orphelin. */
    s.etabs = (s.etabs || []).filter(e =>
      (s.comptes || []).some(c => c.etabId === e.id)
      || (e.dettes || []).some(d => num(d.montant)));

    /* Le lien credit -> bien, pour les etats d'avant.

       Un etablissement qui ne tient qu'UN bien ne laisse aucun doute : tous ses
       credits le financent, et poser le lien ne change aucun chiffre — c'est
       deja ce que le repli de lecture rend. Des qu'il en tient deux, on ne
       devine pas : le lien reste vide, `creditsARattacher()` les nomme, et
       l'ecran demande. Rattacher au hasard mettrait 180 000 EUR de dette sur un
       parking, et personne ne verrait d'ou vient le chiffre.

       Idempotente : un credit deja lie n'est pas relu, et un second passage sur
       un etablissement ambigu ne pose toujours rien. */
    for (const e of (s.etabs || [])) {
      const miens = (s.comptes || []).filter(c => c.etabId === e.id);
      if (miens.length !== 1) continue;
      for (const d of (e.dettes || [])) if (!d.bienId) d.bienId = miens[0].id;
    }
    /* Les societes sous-jacentes : une cle durable par ligne de parts
       (`cleSociete`), liens orphelins retires. Aucune valeur ni aucun
       identifiant de ligne ne bouge, voir `migrerSocietes`. */
    migrerSocietes(s);
    s.meta = s.meta || {};
    s.meta.aVerifier = signalerInvalides(s);
    refreshAccounts();
  },

  
  /* --- migration du champ « category » vers classe d'actif + role -------
     Idempotente de deux facons : elle sort tout de suite si le JSON porte
     deja la bonne version de schema, et la conversion ligne par ligne ne
     s'applique qu'aux lignes qui portent encore l'ancien champ. Relancer la
     fonction sur un etat deja converti ne change rien.

     Les lignes sans ancien champ ni nouveau, une ligne creee entre deux
     versions, recoivent le defaut plutot que d'etre laissees vides : un
     calcul qui lit `assetClassDe()` ne doit jamais tomber sur `undefined`.

     La sauvegarde du JSON d'origine est prise cote serveur, au moment ou
     l'etat converti remonte : le Worker ecrit l'ancien objet sous une cle
     horodatee des qu'il voit la version de schema changer. */
  migrerClassesActifs(s) {
    const positions = Array.isArray(s.positions) ? s.positions : [];
    const dejaAJour = s.schemaVersion >= SCHEMA_VERSION;
    const restes = positions.filter(p => p.category !== undefined || p.categorie !== undefined);
    if (dejaAJour && !restes.length) return { converties: 0, deja: true };

    let converties = 0;
    for (const p of positions) {
      const ancienne = p.category ?? p.categorie;
      if (ancienne !== undefined) {
        const cible = CATEGORIE_VERS_SCHEMA[ancienne];
        if (cible) {
          if (!ASSET_CLASSES[p.assetClass]) p.assetClass = cible.assetClass;
          if (!ROLES[p.role]) p.role = cible.role;
          converties++;
        }
        delete p.category;
        delete p.categorie;
      }
      if (!ASSET_CLASSES[p.assetClass]) p.assetClass = 'actions';
      if (!ROLES[p.role]) p.role = ROLE_DEFAUT;
    }
    for (const v of (Array.isArray(s.sales) ? s.sales : [])) {
      const ancienne = v.category ?? v.categorie;
      if (ancienne === undefined) continue;
      const cible = CATEGORIE_VERS_SCHEMA[ancienne];
      if (cible && !ASSET_CLASSES[v.assetClass]) v.assetClass = cible.assetClass;
      if (cible && !ROLES[v.role]) v.role = cible.role;
      delete v.category;
      delete v.categorie;
    }
    s.schemaVersion = SCHEMA_VERSION;
    return { converties, deja: false };
  },

  migrerCibles(s) {
    const tg = s.targets || (s.targets = {});
    const purge = () => {
      delete tg.coreEtf; delete tg.satellites; delete tg.gold;
      delete tg.roles;
      if (tg.classes) delete tg.classes.private_market;
      tg.exclues = (tg.exclues || []).filter(k => k !== 'private_market');
    };
    if (tg.classes) { purge(); return; }
    const core = num(tg.coreEtf), sat = num(tg.satellites);
    const actions = core + sat;
    tg.classes = {
      actions,
      obligations: 0,
      metaux: num(tg.gold),
      crypto: 0,
      monetaire: 0,
    };
    tg.cashToInvest = num(tg.cashToInvest);
    purge();
  },

  migrerModele(s) {
    if (Array.isArray(s.comptes)) return;        // déjà migré
    s.etabs = [];
    s.comptes = [];
    const slug = nom => String(nom).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'etab';
    const etabDe = nom => {
      nom = (nom || '').trim() || 'Sans établissement';
      let e = s.etabs.find(x => x.nom === nom);
      if (!e) { e = { id: 'e_' + slug(nom), nom, notes: '', dettes: [] }; s.etabs.push(e); }
      return e;
    };
    const infos = s.accountInfo || {};

    for (const a of s.accounts) {
      if (a.role === 'cash' || a.role === 'margin') continue;   // absorbés plus bas
      const e = etabDe(a.broker);
      const i = infos[a.id] || {};
      let type = a.type;
      if (type === 'banque')  type = /livret|ldds|lep/i.test(a.label) ? 'livret' : 'courant';
      if (type === 'epargne') type = 'livret';
      if (type === 'metaux')  type = 'cto';
      const t = typeCompte(type);
      const compte = {
        id: a.id, etabId: e.id, type, statut: a.legacy ? 'archive' : 'ouvert',
        ouvertLe: i.opened || '', numero: '', notes: i.notes || '',
        libelle: a.label, court: a.short || '', alloc: a.alloc,
        cash: [], lignes: [],
      };
      const montant = num(s.now[a.id]);
      if (t.groupe === 'cash') {
        compte.cash.push({ montant, affectation: type === 'livret' ? 'precaution' : 'courant' });
      } else if (!a.holdings && (montant || num(i.deposit))) {
        compte.lignes.push({
          id: 'l_' + a.id, classe: t.classes.find(c => c !== 'liquidites') || 'nonCote',
          libelle: a.label, valeur: montant,
          prixDeRevient: (num(i.deposit) - num(i.withdrawal)) || montant,
          quantite: i.shares ?? null, dateAcquisition: i.opened || '',
          ...(i.usage ? { usage: i.usage } : {}),
          ...(num(i.surface) ? { surface: num(i.surface) } : {}),
          ...(i.adresse ? { adresse: i.adresse } : {}),
        });
      }
      delete s.now[a.id];
      s.comptes.push(compte);
    }

    for (const a of s.accounts.filter(x => x.role === 'cash')) {
      const montant = num(s.now[a.id]);
      const memeEtab = etabDe(a.broker).id;
      const cible = s.comptes.find(c => c.etabId === memeEtab && c.type === a.type && c.statut === 'ouvert');
      if (cible && montant) cible.cash.push({ montant, affectation: 'investir' });
      s.now[a.id] = 0;                          // l'argent a déménagé
    }

    for (const a of s.accounts.filter(x => x.role === 'margin')) {
      const du = -num(s.now[a.id]);
      /* `verifieLe` des la naissance : un capital restant du est le seul champ
         qui devient faux sans que personne y touche, et la cloche le reclame au
         bout de trois mois. Sans date de depart, elle le reclamait des la
         premiere ouverture — une demonstration accueillait son visiteur par un
         reproche. Le jour de la migration EST le jour ou l'on a lu ce montant. */
      /* Le taux, l'assurance et le capital emprunte suivent quand le compte les
         declare. Sans eux, un pret migre n'avait aucun taux : la projection ne
         pouvait pas rejouer son amortissement, et la cloche ne pouvait pas
         proposer un capital restant du a jour — les deux mecanismes existaient
         et ne servaient a rien sur la seule dette du jeu de demonstration.

         Copies un a un et non par etalement : une dette ne doit pas heriter des
         champs d'affichage d'un compte (`group`, `short`, `broker`), qui n'ont
         aucun sens sur elle et que rien ne lirait. */
      if (du > 0) etabDe(a.broker).dettes.push({ id: 'd_' + a.id, libelle: a.label,
        montant: du, note: '', verifieLe: todayISO(),
        ...(num(a.taux) ? { taux: num(a.taux) } : {}),
        ...(num(a.tauxAssurance) ? { tauxAssurance: num(a.tauxAssurance) } : {}),
        ...(num(a.initial) ? { initial: num(a.initial) } : {}) });
      s.now[a.id] = 0;
    }

    for (const c of s.comptes) {
      if (typeCompte(c.type).titres && c.statut === 'ouvert') cashInvestirEntree(c, true);
    }
  },

  _undo: [],
  _prev: null,
  _lastPush: 0,

  /* `differe` : regrouper l'envoi au cloud au lieu de le faire tout de suite.
     Reserve a la frappe, ou cinq caracteres valent cinq appels. */
  save(opts = {}) {
    /* La projection des comptes se refait ici, et non chez l'appelant.

       Une vue ne se rafraichit pas a la main a huit endroits : la source
       change, la vue suit. Les appels qui subsistent chez les appelants sont
       desormais sans effet, sauf `undo()`, qui ne passe pas par ici. */
    refreshAccounts();
    this.state.meta = this.state.meta || {};
    this.state.meta.aVerifier = signalerInvalides(this.state);
    const now = Date.now();
    if (this._prev && now - this._lastPush > 900) {
      this._undo.push(this._prev);
      if (this._undo.length > UNDO_LIMIT) this._undo.shift();
      this._lastPush = now;
    }
    /* L'HORODATAGE DIT « QUELQU'UN A DECIDE QUELQUE CHOSE ICI », ET RIEN
       D'AUTRE. Il arbitre les conflits de synchro : le poser, c'est affirmer
       que cet appareil porte une intention que les autres n'ont pas.

       Un cours rafraichi n'en est pas une. `Quotes.refresh()` passe par ici
       toutes les cinq minutes sur un onglet ouvert, et a chaque ouverture de
       l'application ; il datait donc l'etat d'un patrimoine que personne n'avait
       touche. Un ordinateur qu'on rouvre apres plusieurs jours se retrouvait
       avec l'estampille la plus fraiche et le contenu le plus vieux, et il
       l'imposait au telephone qui, lui, avait vraiment saisi quelque chose.

       `derive` marque ces ecritures-la : la donnee est enregistree et envoyee
       comme les autres, mais elle ne pretend pas dater l'etat. */
    if (!opts.derive) this.state.meta.savedAt = new Date().toISOString();
    this._prev = structuredClone(this.state);
    /* UN ECHEC D'ECRITURE NE PEUT PAS RESTER SILENCIEUX.

       Il ne l'etait qu'a moitie : `flashSaved()` vit dans le `try`, donc
       « Sauvegardé ✓ » ne s'affichait pas a tort. Mais rien ne s'affichait non
       plus. Quota plein, navigation privee restrictive, stockage refuse par le
       navigateur : la modification vivait en memoire, l'ecran ne disait rien, et
       elle disparaissait au rechargement. Le pire des silences est celui qui
       ressemble a un succes.

       Le signal passe par la vue, qui sait le montrer sans repeter : un temoin
       permanent tant que l'ecriture echoue, et un seul message au moment ou la
       situation change. `console.warn` reste, pour la trace technique. */
    try {
      localStorage.setItem(cleStockage(), JSON.stringify(this.state));
      if (this._ecritureKo) { this._ecritureKo = false; signalerEcriture(true); }
      flashSaved();
    } catch (e) {
      console.warn('Sauvegarde impossible', e && e.name);
      const nouveau = !this._ecritureKo;
      this._ecritureKo = true;
      signalerEcriture(false, nouveau);
    }

    /* Le cloud reçoit tout de suite, sauf pendant une frappe.

       C'était l'inverse : chaque `save()` armait un minuteur, donc un clic sur
       « Enregistrer » attendait deux secondes et demie avant de partir. Le geste
       le plus explicite de l'application — celui par lequel on dit « c'est
       bon » — était traité comme une frappe au clavier, et c'est pendant cette
       attente que l'écran se verrouillait.

       Le regroupement garde sa raison, mais elle ne vaut que pour la saisie
       caractère par caractère : taper « 12500 » produit cinq écritures, et
       Cloudflare KV n'accepte qu'une écriture par seconde sur une même clé. Les
       deux écouteurs de frappe passent donc `differe`, et eux seuls.

       Le défaut est ainsi le comportement sûr, et le regroupement devient une
       exception qu'on demande là où elle se justifie. */
    if (typeof CloudSync !== 'undefined' && !modeDemo()) {
      if (opts.differe) CloudSync.schedulePush(); else CloudSync.push();
    }
  },

  canUndo() { return this._undo.length > 0; },

  undoCount() { return this._undo.length; },

  undo() {
    const prev = this._undo.pop();
    if (!prev) return false;
    this.state = prev;
    this._prev = structuredClone(prev);
    refreshAccounts();               // sinon la liste des comptes reste celle d'avant
    try { localStorage.setItem(cleStockage(), JSON.stringify(this.state)); } catch (e) {}
    return true;
  },

  backups() {
    try { return JSON.parse(localStorage.getItem(cleSauvegardes())) || []; }
    catch (e) { return []; }
  },

  /* `etat` permet de sauvegarder l'etat d'AVANT un geste qui ne s'ecrit
     qu'une fois valide : l'action le capture, applique l'operation, et ne
     garde la capture qu'en cas de succes. */
  addBackup(reason = 'auto', etat = this.state) {
    const list = this.backups();
    list.unshift({ at: new Date().toISOString(), reason, data: etat });
    try {
      localStorage.setItem(cleSauvegardes(), JSON.stringify(list.slice(0, BACKUP_LIMIT)));
      return true;
    } catch (e) {
      try { localStorage.setItem(cleSauvegardes(), JSON.stringify(list.slice(0, 2))); return true; }
      catch (e2) { console.warn('Sauvegarde auto impossible', e2); return false; }
    }
  },

  autoBackup() {
    const list = this.backups();
    const lastAt = list[0] && new Date(list[0].at);
    if (!lastAt || (Date.now() - lastAt) > 20 * 3600 * 1000) this.addBackup('quotidienne');
  },

  restoreBackup(index) {
    const b = this.backups()[index];
    if (!b) return false;
    this.addBackup('avant restauration');
    this.state = structuredClone(b.data);
    this.migrate();
    this.save();
    return true;
  },

  reset() {
    this.addBackup('avant réinitialisation');
    this.state = structuredClone(SEED);
    refreshAccounts();
    this.save();
  },
};

partieChargee('assets/store-02-bases-calcul-nommees.js');
