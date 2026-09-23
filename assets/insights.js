/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
/* =============================================================
   INSIGHTS — lecture de la situation, pas un second modèle
   =============================================================

   CE QUE FAIT CE FICHIER, ET CE QU'IL NE FERA JAMAIS.

   Il ne calcule rien de financier. Pas une addition de patrimoine, pas un
   echeancier, pas une allocation, pas une projection. Tout cela existe deja
   dans `store.js`, et une seconde implementation finirait par dire autre chose
   que la premiere — c'est arrive assez de fois dans ce projet pour qu'on
   n'essaie pas. Chaque regle appelle un moteur existant et INTERPRETE ce qu'il
   rend : `runway()`, `rebalanceRows()`, `monthlyPace()`, `capitalisation()`,
   `savingsReconciliation()`.

   Il ne produit aucun texte. Une regle rend un identifiant, des nombres nus et
   une preuve. Ni phrase, ni signe monetaire, ni pourcentage formate : la
   presentation traduira et formatera plus tard, avec le formateur central et la
   devise du profil. C'est ce qui permet au meme insight de se lire en francais
   avec des euros et en anglais avec des dollars sans qu'une seule ligne d'ici
   ne connaisse ni langue ni devise.

   Il ne parle pas sans donnees. Chaque regle declare `eligible(ctx)`, et une
   regle qui n'a pas de quoi conclure ne rend RIEN. Une liste vide est un
   resultat normal, pas un echec : il vaut mieux se taire que remplir.

   OU IL S'ARRETE, ET POURQUOI. Il decrit, il compare, il situe. Il ne
   recommande pas. « Les actions pesent 72 % pour une cible de 65 % » est un
   constat ; « reduis ton exposition » serait un conseil, et un conseil
   financier ne se donne pas depuis un tableau de bord.

   CE QU'IL N'EST PAS : LE FRERE DE `healthChecks()`. La cloche surveille
   l'INTEGRITE des donnees — un cours perime, un capital restant du a
   reverifier, un releve manquant, une incoherence. Elle demande un geste de
   saisie. Ce moteur-ci lit des donnees SUPPOSEES SAINES et en tire une lecture
   financiere. Les deux ne partagent ni declencheur ni surface, et une donnee
   manquante n'est pas un insight : elle rend simplement la regle non eligible,
   et c'est la cloche qui la reclame, si c'est son role. */

/* --- Seuils : ce sont des filtres d'affichage, jamais des normes -----------

   LIRE CECI AVANT D'EN AJOUTER UN.

   Ces nombres existent pour qu'un ecart d'un demi-point ne prenne pas la place
   d'un ecart de dix. Ils ne disent rien de ce qui est prudent, sain ou
   souhaitable, et aucun ne doit jamais s'afficher comme une regle : « 5 points
   d'ecart » n'est pas une limite recommandee, c'est le moment ou l'application
   juge que ca vaut la peine d'etre dit.

   La convention de comparaison est `>=`, et elle est volontairement inclusive :
   un ecart de exactement 5,0 points produit l'insight. Un test la fige, parce
   que la frontiere est le seul endroit ou deux lecteurs peuvent differer.

   ET QUAND C'EST POSSIBLE, LE SEUIL VIENT DE LA PERSONNE. « Un mois de depenses
   inhabituel » n'a pas de definition generale : trois cents euros de plus sont
   enormes chez l'un et invisibles chez l'autre. Deux regles plus bas se passent
   donc de tout nombre pose et se comparent a la dispersion propre du detenteur,
   ou a la forme de son propre portefeuille. */
const SEUIL_AFFICHAGE_ALLOCATION_PP = 5;

/* Le rythme change-t-il assez pour qu'on le dise ? Vingt pour cent d'ecart
   relatif entre les deux fenetres. « Mille quarante contre mille » est exact et
   n'apprend rien ; ce filtre le laisse dehors, et il ne dit rien de ce qui
   serait un bon rythme.

   TROIS CONDITIONS, ET AUCUNE N'EST INVENTEE POUR L'OCCASION.

   La fenetre precedente doit etre STRICTEMENT POSITIVE. C'est la regle que ce
   projet applique deja partout : un pourcentage n'existe que sur une base
   positive, et `deltas()` rend `pct: null` sur une base nulle ou negative.
   Diviser par un rythme precedent proche de zero fabriquerait un « +900 % » qui
   ne mesure rien. Le prix a payer est connu et assume : quelqu'un dont le
   patrimoine reculait et qui remonte ne verra pas cet insight-la. Mieux vaut
   ce silence qu'un pourcentage que personne ne peut interpreter.

   Les deux montants doivent DIFFERER UNE FOIS ARRONDIS comme ils seront
   affiches. Ce n'est pas un seuil, c'est une coherence : la phrase ne peut pas
   dire « 1 240 contre 1 240 ».

   Et l'ecart relatif doit atteindre le filtre, borne INCLUSIVE comme celle de
   l'allocation. Un test la fige. */
const SEUIL_AFFICHAGE_RYTHME_PCT = 20;

const SEUIL_AFFICHAGE_RESERVE_MOIS = 1;

const SEUIL_AFFICHAGE_POCHE_PP = 5;

const SEUIL_AFFICHAGE_DEPENSES_PCT = 10;

const SEUIL_AFFICHAGE_POSTE_PCT = 15;
const POIDS_MINIMAL_DU_POSTE_PCT = 5;

const SEUIL_DEPASSEMENT_PROJETE_PCT = 10;

const AVANCEMENT_MINIMAL_DU_MOIS = 1 / 3;

const SEUIL_AFFICHAGE_OBJECTIF_MOIS = 2;

const MOIS_CREDIT_BIENTOT_SOLDE = 12;

const MOIS_MINIMUM_FENETRE_RYTHME = 6;

const MOIS_MINIMUM_FENETRE_DEPENSES = 3;

const INSIGHT_PRIORITE = { HAUTE: 300, MOYENNE: 200, BASSE: 100 };
const amplitude = (valeur, seuil) => {
  if (!(seuil > 0)) return 0;
  return Math.max(0, Math.min(20, Math.round((Math.abs(num(valeur)) / seuil - 1) * 10)));
};

const insightsVus = () => (Store.state && Store.state.meta && Store.state.meta.insightsVus) || {};

const reserveSousCible = m => num(m.runway.reserve) < num(m.runway.targetLow);
/* De combien de mois la reserve est en dessous de ce repere, zero au-dessus.
   Les deux seules lignes du moteur qui nomment un palier de `runway()` sont
   ici : aucune regle du catalogue n'y touche, et un test le verifie. */
const moisManquants = m => Math.max(0,
  (num(m.runway.targetLow) - num(m.runway.reserve)) / num(m.runway.burn));

function joursEntre(depuis, jusqua) {
  return Math.round((new Date(String(jusqua) + 'T12:00:00')
    - new Date(String(depuis) + 'T12:00:00')) / 86400000);
}

function auRepos(regle, valeur, aujourdhui) {
  const vu = insightsVus()[regle.id];
  if (!vu || !vu.date) return false;
  const jours = joursEntre(vu.date, aujourdhui);
  if (jours <= 0) return false;
  if (jours >= num(regle.reposJours)) return false;
  return Math.abs(num(valeur) - num(vu.valeur)) < num(regle.materialite);
}

function contexteInsights(ctx) {
  const c = ctx || {};
  return { aujourdhui: c.aujourdhui || todayISO() };
}

/* L'horizon de projection choisi, en annees.

   `app.js` l'expose sous le nom `projHorizon`, mais ce fichier doit tourner
   sans lui : le harnais de tests ne charge pas la vue. Meme derivation, mot
   pour mot, et un test la compare aux deux endroits pour qu'elles ne puissent
   pas diverger. */
function horizonProjection() {
  return num(Store.state && Store.state.meta ? Store.state.meta.projHorizon : 0) || 20;
}

/* Les depenses sont-elles OBSERVEES, ou seulement souhaitees ?

   `runway()` construit sa consommation mensuelle avec `stats.average || target`
   : sans aucun mois saisi, la moyenne vaut zero et c'est l'OBJECTIF de depenses
   qui prend sa place. Le chiffre reste utile a l'ecran du budget, ou l'on sait
   ce qu'on lit. Ici il serait un mensonge : annoncer « quatorze mois de
   depenses renseignees » quand rien n'a ete renseigne invente la moitie du
   rapport. La regle exige donc un mois observe au moins, et se tait sinon. */
function depensesObservees(annee) {
  const stats = expenseYearStats(annee);
  return { observees: num(stats.moisRetenus) > 0, moyenne: num(stats.average),
           mois: num(stats.moisRetenus) };
}

/* Les lignes du reequilibrage, mises a plat PUIS ramenees a la classe.

   `rebalanceRows()` ne rend pas un tableau mais un objet : `classes` porte une
   ligne par classe — dedoublee en core et satellite quand la cible l'est — et
   `cash` porte la tresorerie a placer, ou `null` quand elle a ete sortie du
   perimetre. Les deux se lisent de la meme facon, avec la meme base, et une
   regle qui n'aurait lu que `classes` aurait ignore une cible de tresorerie.

   POURQUOI ON REGROUPE. Une phrase doit nommer exactement ce qu'elle compare.
   « Actions core pese 46 % pour une cible de 46 % » est vrai et illisible : le
   role n'est pas une classe, et personne ne raisonne en « actions core » devant
   un tableau de bord. L'insight parle donc toujours de la classe entiere.

   L'AGREGATION NE RECALCULE RIEN. Elle additionne les lignes que le moteur
   vient de rendre, encours et cible, et c'est tout : les deux moities d'une
   classe decoupee ont ete construites sur la meme base, leur somme EST la
   classe. La part se redivise par cette meme base, jamais par une autre. Aucune
   cible, aucun encours, aucun denominateur n'est relu ailleurs, et la somme des
   parts continue de faire ce qu'elle faisait.

   Le detail par role n'est pas perdu : il se lit dans Allocation, ou la cible
   se regle. Ici, on nomme la classe. */
function lignesReequilibrage(r) {
  const plates = (r && r.classes) ? r.classes.slice() : [];
  if (r && r.cash) plates.push(r.cash);
  const base = num(r && r.base);
  const parClasse = new Map();
  for (const l of plates) {
    const cle = l.classeParente || l.cle;
    const label = l.labelClasse || l.label;
    const deja = parClasse.get(cle);
    if (!deja) {
      parClasse.set(cle, { cle, label, value: num(l.value), targetPct: num(l.targetPct),
                           targetVal: num(l.targetVal), roles: 1 });
      continue;
    }
    deja.value += num(l.value);
    deja.targetPct += num(l.targetPct);
    deja.targetVal += num(l.targetVal);
    deja.roles += 1;
  }
  return [...parClasse.values()].map(x => Object.assign(x, {
    pct: base ? x.value / base * 100 : 0,
  }));
}

/* --- Les fenetres du rythme -----------------------------------------------

   `monthlyPace()` rend un point par INTERVALLE entre deux releves, et chaque
   point sait combien de mois il couvre. On remonte donc depuis la fin en
   accumulant des mois, jamais des points : deux releves espaces de six mois
   font un seul point et six mois de couverture, et compter les points aurait
   compare un semestre a un trimestre en les appelant pareil.

   Rend deux fenetres, la recente et celle d'avant, ou `null` si l'historique
   n'en porte pas deux completes. */
function fenetresRythme(points, moisParFenetre) {
  const prendre = (reste, cible) => {
    const pris = [];
    let mois = 0;
    for (let i = reste.length - 1; i >= 0 && mois < cible; i--) {
      pris.unshift(reste[i]);
      mois += Math.max(1, num(reste[i].mois) || 1);
    }
    return { pris, mois, reste: reste.slice(0, reste.length - pris.length) };
  };
  const recente = prendre(points || [], moisParFenetre);
  if (recente.mois < moisParFenetre) return null;
  const avant = prendre(recente.reste, moisParFenetre);
  if (avant.mois < moisParFenetre) return null;
  return { recente: recente.pris, precedente: avant.pris };
}

/* --- UN RYTHME QUI RESISTE A UN MOIS EXCEPTIONNEL -------------------------

   LE DEFAUT, ET IL EST GRAVE. `statsRythme()` rend une MOYENNE, et c'est la
   bonne reponse a la question de l'historique : « de combien mon patrimoine
   a-t-il progresse sur cette periode ». Ce n'est pas la bonne reponse a la
   question de cette regle-ci : « quel rythme mensuel represente cette
   periode ». Une prime, un heritage, la vente d'un bien, et six mois a sept
   cents euros deviennent « mille neuf cent soixante-cinq euros par mois ».
   Le chiffre est exact et la phrase est fausse.

   CE QU'ON NE FAIT PAS. On ne retire aucun mois des donnees : l'historique
   continue de porter la progression reelle, prime comprise. On ne devine pas
   non plus la CAUSE — Longward voit un mouvement, pas une prime, et nommer
   une cause qu'il ignore serait inventer.

   LA MESURE : LA MEDIANE des variations mensuelles. Elle repond exactement a
   « a quoi ressemble un mois ordinaire ici », et un seul mois hors norme ne la
   deplace pas. Une moyenne tronquee aurait demande de choisir combien de mois
   jeter ; la mediane ne jette rien, elle se contente de regarder au milieu.

   Un point peut couvrir plusieurs mois quand un releve manque : on prend donc
   son rythme mensuel, `delta / mois`, et non son ecart brut. */
function rythmesMensuels(points) {
  return (points || []).map(p => num(p.delta) / Math.max(1, num(p.mois) || 1));
}

function mediane(valeurs) {
  const v = (valeurs || []).slice().sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function rythmeRepresentatif(points) {
  const taux = rythmesMensuels(points);
  if (!taux.length) return null;
  const med = mediane(taux);
  const ecart = mediane(taux.map(t => Math.abs(t - med)));
  const total = taux.reduce((s, t) => s + Math.abs(t), 0);
  const plusGros = taux.reduce((s, t) => Math.max(s, Math.abs(t)), 0);
  return {
    mediane: med,
    moyenne: taux.reduce((s, t) => s + t, 0) / taux.length,
    ecartMedian: ecart,
    partDuPlusGrosMois: total > 0 ? plusGros / total : 0,
    representatif: Math.abs(med) > 0 && ecart <= Math.abs(med),
    mois: (points || []).reduce((s, p) => s + Math.max(1, num(p.mois) || 1), 0),
  };
}

/* =============================================================
   COUCHE 1 — LES MESURES
   =============================================================

   Un seul passage sur les moteurs, un seul objet, et toutes les regles y
   puisent. Deux raisons, et la seconde compte plus que la premiere : la
   projection et le reequilibrage coutent cher, et surtout deux regles qui
   liraient le meme chiffre a deux moments differents finiraient par ne plus
   dire la meme chose.

   RIEN N'EST CALCULE ICI QUI EXISTE AILLEURS. Chaque champ est la sortie d'un
   moteur de `store.js`, parfois divisee par une autre sortie du meme fichier.
   Aucune formule financiere nouvelle, aucun seuil, aucune interpretation : la
   couche des mesures ne fait que rassembler. */
function mesuresInsights(ctx) {
  const annee = String(ctx.aujourdhui).slice(0, 4);
  const dep = depensesObservees(annee);
  const r = runway();
  const t = nowTotals();
  const p = patrimoine();
  const rec = savingsReconciliation();
  const pace = monthlyPace();
  const proj = projectionSettings();
  const releves = historySeries({ includeNow: false });

  const moisCourant = String(ctx.aujourdhui).slice(0, 7);
  const depenses = expenseSeries('all')
    .filter(x => x.month < moisCourant && x.total > 0)
    .sort((a, b) => a.month.localeCompare(b.month));

  /* LE MOIS EN COURS, A PART, ET NOMME COMME TEL. La serie ci-dessus l'ecarte
     expres : un mois de huit jours compare a des mois entiers ferait croire a
     un effondrement des depenses. Mais une regle a le droit de le regarder SI
     elle dit qu'il est en cours — c'est le cas du rythme, dont c'est tout le
     sujet. Deux objets distincts, donc, plutot qu'un drapeau sur un seul : une
     regle qui lit `depenses` ne peut pas se tromper de mois par inadvertance. */
  const ligneCourante = expenseSeries('all').find(x => x.month.startsWith(moisCourant));
  const jour = new Date(String(ctx.aujourdhui) + 'T12:00:00');
  const joursDuMois = new Date(jour.getFullYear(), jour.getMonth() + 1, 0).getDate();
  const encours = {
    month: moisCourant,
    total: ligneCourante ? num(ligneCourante.total) : 0,
    v: (ligneCourante && ligneCourante.v) || {},
    joursEcoules: jour.getDate(),
    joursDuMois,
    avancement: jour.getDate() / joursDuMois,
  };

  return {
    encours,
    budget: budgetFrame(),
    aujourdhui: ctx.aujourdhui,
    depensesObservees: dep,
    runway: r,
    totaux: t,
    patrimoine: p,
    epargne: rec,
    pace,
    releves,
    depenses,
    projection: proj,
    /* Le poids de la dette dans le patrimoine, quand la base est positive.
       `null` et non zero : sans patrimoine brut, il n'y a pas de rapport. */
    poidsDette: num(p.brut) > 0 ? num(p.dettes) / num(p.brut) * 100 : null,
  };
}

/* La moyenne d'une tranche de la serie des depenses. Rend `null` si la tranche
   n'est pas pleine : comparer trois mois a deux n'a pas de sens, et la
   difference se lirait comme un changement de comportement. */
function moyenneDepenses(serie, debut, combien) {
  const t = (serie || []).slice(debut, debut + combien);
  if (t.length < combien) return null;
  return t.reduce((s, x) => s + num(x.total), 0) / combien;
}

function partDesApports(points) {
  if (!points || !points.length) return null;
  const debut = String(points[0].depuis || points[0].date);
  const fin = String(points[points.length - 1].date);
  const total = points.reduce((s, x) => s + num(x.delta), 0);
  if (!(total > 0)) return null;
  const apports = num(apportsDetail(debut, fin).net);
  if (!(apports > 0)) return null;
  return { total, apports, reste: total - apports, part: apports / total * 100, debut, fin };
}

function reserveIlYA(m, moisEnArriere) {
  const pts = m.releves;
  if (!pts.length || !(num(m.runway.burn) > 0)) return null;
  const cible = decalerMois(String(m.aujourdhui), -moisEnArriere);
  const avant = pts.filter(x => String(x.date) <= cible);
  if (!avant.length) return null;
  const p = avant[avant.length - 1];
  if (moisEntre(String(p.date), String(m.aujourdhui)) < moisEnArriere) return null;
  return { date: String(p.date), cash: num(p.cash), mois: num(p.cash) / num(m.runway.burn) };
}

function decalerMois(iso, n) {
  const y = Number(String(iso).slice(0, 4));
  const mo = Number(String(iso).slice(5, 7));
  const total = (mo - 1) + n;
  const an = y + Math.floor(total / 12);
  const mois = ((total % 12) + 12) % 12 + 1;
  /* Concatene plutot qu'un gabarit : le moteur s'interdit tout signe
     monetaire, et un test le verifie sur le dollar, que `${}` porte aussi. */
  return an + '-' + String(mois).padStart(2, '0') + '-28';
}

function selectionParClef(liste, clefDe, combien) {
  const vues = new Set(), choisis = [];
  for (const x of (liste || [])) {
    if (choisis.length >= combien) break;
    const k = clefDe(x);
    if (k && vues.has(k)) continue;
    vues.add(k); choisis.push(x);
  }
  for (const x of (liste || [])) {
    if (choisis.length >= combien) break;
    if (choisis.includes(x)) continue;
    choisis.push(x);
  }
  return choisis;
}

/* =============================================================
   COUCHE 2 — LE CATALOGUE DES REGLES
   =============================================================

   Chacune porte son identifiant, sa FAMILLE, son rang, son groupe de
   deduplication, son repos, sa materialite, la question a laquelle elle repond,
   et deux fonctions pures. `eligible` dit si les donnees permettent de
   conclure ; `evaluer` rend l'insight ou `null`. Les deux recoivent les mesures
   deja calculees et le contexte, jamais l'etat brut.

   CE QUE VAUT UN RANG, ET IL NE S'ATTRIBUE PLUS AU jugé. `HAUTE` est reserve a
   ce qui se compare a une intention DECLAREE par le detenteur — une cible
   d'allocation, un objectif de depenses, une date visee. `MOYENNE` va a ce qui
   se compare a son propre passe, `BASSE` a ce qui se constate sans reference.

   L'ordre n'est pas esthetique : une cible est une phrase que quelqu'un a
   ecrite, et un ecart a cette phrase vaut plus qu'une variation que personne
   n'a demandee. Deux regles historiques portaient `HAUTE` et passaient donc
   devant des ecarts a une cible ; elles sont redescendues.

   ET `BASSE` PORTE AUSSI LA VERSION GENERALE D'UNE LECTURE PLUS PRECISE. « Tes
   depenses ont monte de 40 % » et « tes sorties passent de 100 a 300 EUR »
   partagent un groupe : elles disent le meme fait, la seconde en disant ou. La
   generale ne doit donc gagner que lorsque l'autre n'a rien trouve — c'est-a-dire
   quand la hausse est diffuse et qu'aucun poste ne l'explique. Son rang le dit,
   et c'est ce qui la garde utile sans la laisser passer devant.

   LA FAMILLE N'EST PAS LA CATEGORIE. La categorie nomme le sujet ; la famille
   sert a la selection, et c'est elle qui empeche trois entrees de raconter la
   meme histoire sous trois angles.

   CE QUI N'EST PAS DANS CE CATALOGUE, ET POURQUOI. Une regle n'y vit que si un
   moteur existant porte deja sa donnee. Trois manquent, et leur absence est un
   choix, pas un oubli :

     — « il te reste 1 850 € au-dela de ta reserve cible » demanderait une
       reserve cible DECLAREE. `runway()` porte bien un `targetLow` a trois mois,
       mais c'est une heuristique d'affichage, pas une decision du detenteur ; la
       prendre pour telle ferait passer une phrase qui circule pour un arbitrage
       que personne n'a rendu.
     — « 70 % de ta progression vient de la hausse de tes placements »
       demanderait de separer la valorisation du capital rembourse et de la
       revalorisation d'un bien. Rien ne sait le faire ici. La regle qui existe
       parle donc d'apports et « du reste », et ne nomme jamais le reste.
     — « ta premiere ligne pesait 10 % il y a six mois » demanderait un
       historique des POSITIONS. Les releves mensuels notent des montants par
       compte, jamais par ligne. La concentration ne se compare donc qu'a la
       forme actuelle du portefeuille.

     — « ta reserve couvre 0,8 mois » et « 645 EUR par mois viennent de tes
       credits » ont ete RETIREES, et c'est le meme motif : la carte « Reserve de
       securite » et la carte « Accumulation ce mois-ci » vivent sur l'ecran ou
       ces lectures s'affichaient, et disent deja le chiffre, sa base et son
       repere. Un insight qui redit une carte du meme ecran ne fait que la
       repousser plus bas. Ce qui reste du sujet est le MOUVEMENT — la reserve
       couvre plus ou moins de mois qu'il y a trois mois — qui, lui, ne se lit
       nulle part ailleurs.

   Ces trois-la reviendront le jour ou la donnee existera, pas avant. */
const REGLES_INSIGHT = [
  {
    id: 'liquidity_runway_shift',
    onglet: 'overview',
    famille: 'liquidite',
    categorie: 'liquidity',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'liquidity_shift',
    reposJours: 30,
    materialite: SEUIL_AFFICHAGE_RESERVE_MOIS,
    question: 'Ma réserve s’est-elle étoffée ou érodée ?',
    titleKey: 'insight.liquidity_runway_shift.title',
    descriptionKey: 'insight.liquidity_runway_shift.description',
    eligible: m => !reserveSousCible(m) && !!reserveIlYA(m, 3),
    evaluer(m) {
      const avant = reserveIlYA(m, 3);
      if (!avant) return null;
      /* LE MEME PERIMETRE DES DEUX COTES, ET C'EST TOUT L'ENJEU. Un releve
         mensuel ne note qu'une poche de TRESORERIE : il ne sait pas ce qui
         etait mobilisable sous huit jours ni ce qui dormait dans une assurance
         vie. Repondre avec `liquidMonths`, qui ajoute le differe, aurait compare
         une poche a trois, et l'ecart aurait annonce une progression de la
         tresorerie qui n'aurait ete qu'un changement de definition.
         La regle voisine, elle, parle bien de liquidites mobilisables : les deux
         chiffres different, et les deux phrases nomment ce qu'elles comptent. */
      const maintenant = num(m.totaux.cash) / num(m.runway.burn);
      const ecart = maintenant - avant.mois;
      if (Math.abs(ecart) + 1e-9 < SEUIL_AFFICHAGE_RESERVE_MOIS) return null;
      return {
        valeur: ecart,
        poids: amplitude(ecart, SEUIL_AFFICHAGE_RESERVE_MOIS),
        params: { months: maintenant, previousMonths: avant.mois, deltaMonths: ecart },
        evidence: {
          source: 'nowTotals+historySeries',
          scope: 'cash',
          monthlyBurn: num(m.runway.burn),
          burnConstant: true,
          previousDate: avant.date,
          previousCash: avant.cash,
          currentCash: num(m.totaux.cash),
          displayThresholdMonths: SEUIL_AFFICHAGE_RESERVE_MOIS,
        },
        action: { vue: 'overview' },
      };
    },
  },

  /* --- L'ecart a la cible que le detenteur a posee ------------------------

     La seule comparaison qui vaille ici est avec SA cible, jamais avec une
     repartition reputee bonne. `rebalanceRows()` la calcule deja, sur une base
     explicite dont les classes mises hors jeu sont retirees : on ne refait donc
     ni le denominateur ni les parts.

     Une seule sortie par regle, la deviation la plus grande en valeur absolue.
     Cinq classes qui derivent ne font pas cinq cartes : elles font une carte,
     celle qui derive le plus, et le detail se lit dans Allocation. */
  {
    id: 'allocation_target_gap',
    onglet: 'allocation',
    famille: 'allocation',
    categorie: 'allocation',
    priorite: INSIGHT_PRIORITE.HAUTE,
    dedupeGroup: 'allocation',
    reposJours: 21,
    materialite: SEUIL_AFFICHAGE_ALLOCATION_PP,
    question: 'Est-ce que mon allocation s’éloigne de ce que j’avais décidé ?',
    titleKey: 'insight.allocation_target_gap.title',
    descriptionKey: 'insight.allocation_target_gap.description',
    eligible() {
      const r = rebalanceRows();
      if (!(num(r.base) > 0)) return false;
      return lignesReequilibrage(r).some(x => num(x.targetPct) > 0);
    },
    evaluer() {
      const rows = lignesReequilibrage(rebalanceRows());
      let tete = null;
      for (const r of rows) {
        if (!(num(r.targetPct) > 0)) continue;
        const ecart = num(r.pct) - num(r.targetPct);
        if (Math.abs(ecart) < SEUIL_AFFICHAGE_ALLOCATION_PP) continue;
        if (!tete || Math.abs(ecart) > Math.abs(tete.ecart)) tete = { r, ecart };
      }
      if (!tete) return null;
      return {
        valeur: tete.ecart,
        poids: amplitude(tete.ecart, SEUIL_AFFICHAGE_ALLOCATION_PP),
        params: {
          classe: tete.r.cle, label: tete.r.label,
          currentPct: num(tete.r.pct), targetPct: num(tete.r.targetPct), deltaPct: tete.ecart,
        },
        evidence: {
          source: 'rebalanceRows',
          classe: tete.r.cle,
          scope: 'classe', lignesAgregees: num(tete.r.roles),
          currentPct: num(tete.r.pct), targetPct: num(tete.r.targetPct), deltaPct: tete.ecart,
          currentValue: num(tete.r.value), targetValue: num(tete.r.targetVal),
          displayThresholdPp: SEUIL_AFFICHAGE_ALLOCATION_PP,
        },
        action: { vue: 'rebalance' },
      };
    },
  },

  {
    id: 'pocket_share_shift',
    onglet: 'allocation',
    famille: 'allocation',
    categorie: 'allocation',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'pocket',
    reposJours: 45,
    materialite: SEUIL_AFFICHAGE_POCHE_PP,
    question: 'Une part de mon patrimoine a-t-elle changé de poids ?',
    titleKey: 'insight.pocket_share_shift.title',
    descriptionKey: 'insight.pocket_share_shift.description',
    eligible: m => !!partsDesPoches(m, 6),
    evaluer(m) {
      const p = partsDesPoches(m, 6);
      if (!p) return null;
      let tete = null;
      for (const x of p.lignes) {
        if (Math.abs(x.ecart) + 1e-9 < SEUIL_AFFICHAGE_POCHE_PP) continue;
        if (!tete || Math.abs(x.ecart) > Math.abs(tete.ecart)) tete = x;
      }
      if (!tete) return null;
      return {
        valeur: tete.ecart,
        poids: amplitude(tete.ecart, SEUIL_AFFICHAGE_POCHE_PP),
        params: { poche: tete.cle, currentPct: tete.maintenant,
                  previousPct: tete.avant, deltaPct: tete.ecart, months: p.mois },
        evidence: {
          source: 'historySeries', poche: tete.cle, previousDate: p.date,
          currentPct: tete.maintenant, previousPct: tete.avant, deltaPct: tete.ecart,
          observedMonths: p.mois, displayThresholdPp: SEUIL_AFFICHAGE_POCHE_PP,
        },
        action: { vue: 'overview' },
      };
    },
  },

  /* --- Le rythme de progression, compare a lui-meme -----------------------

     RYTHME, ET JAMAIS PERFORMANCE. Ce que `monthlyPace()` mesure est la
     variation du patrimoine NET entre deux releves : elle contient l'epargne,
     les apports exterieurs, le capital rembourse sur les credits et le mouvement
     des marches, sans savoir les separer. L'appeler rendement serait attribuer
     aux marches ce qu'on a mis de sa poche.

     LE RYTHME EST UNE MEDIANE, PAS UNE MOYENNE. Un seul mois exceptionnel suffit
     a faire dire a une moyenne que sept cents euros par mois en valent deux
     mille. La moyenne reste dans la preuve : c'est elle que l'historique
     affiche, et l'ecart entre les deux se lit. */
  {
    id: 'wealth_pace_shift',
    onglet: 'overview',
    famille: 'progression',
    categorie: 'wealth_pace',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'wealth_pace',
    reposJours: 30,
    materialite: SEUIL_AFFICHAGE_RYTHME_PCT,
    question: 'Mon patrimoine progresse-t-il plus vite qu’avant ?',
    titleKey: 'insight.wealth_pace_shift.title',
    descriptionKey: 'insight.wealth_pace_shift.description',
    eligible: m => !!fenetresRythme(m.pace.points, MOIS_MINIMUM_FENETRE_RYTHME),
    evaluer(m) {
      const f = fenetresRythme(m.pace.points, MOIS_MINIMUM_FENETRE_RYTHME);
      if (!f) return null;
      const a = rythmeRepresentatif(f.recente);
      const b = rythmeRepresentatif(f.precedente);
      if (!a || !b) return null;
      if (!a.representatif || !b.representatif) return null;
      const courant = a.mediane, precedent = b.mediane;
      if (!(precedent > 0)) return null;
      if (Math.round(courant) === Math.round(precedent)) return null;
      const ecartPct = (courant / precedent - 1) * 100;
      /* L'EPSILON N'EST PAS UNE COQUETTERIE. `1200 / 1000 - 1` vaut
         0,19999999999999996 en virgule flottante : sans cette marge, un ecart
         d'exactement vingt pour cent tomberait du mauvais cote de sa propre
         borne, et le test qui la fige echouerait pour une raison qui n'a rien a
         voir avec la finance. */
      if (Math.abs(ecartPct) + 1e-9 < SEUIL_AFFICHAGE_RYTHME_PCT) return null;
      const apA = statsRythme(f.recente), apB = statsRythme(f.precedente);
      return {
        valeur: ecartPct,
        poids: amplitude(ecartPct, SEUIL_AFFICHAGE_RYTHME_PCT),
        params: {
          currentMonthly: courant, currentMonths: num(a.mois),
          previousMonthly: precedent, previousMonths: num(b.mois),
          deltaMonthly: courant - precedent, deltaPct: ecartPct,
        },
        evidence: {
          source: 'monthlyPace',
          currentFrom: f.recente[0] ? f.recente[0].depuis || f.recente[0].date : null,
          currentTo: f.recente[f.recente.length - 1].date,
          currentMonths: num(a.mois), currentMonthly: courant,
          currentMean: a.moyenne, currentDeviation: a.ecartMedian,
          currentLargestMonthShare: a.partDuPlusGrosMois,
          previousFrom: f.precedente[0] ? f.precedente[0].depuis || f.precedente[0].date : null,
          previousTo: f.precedente[f.precedente.length - 1].date,
          previousMonths: num(b.mois), previousMonthly: precedent,
          previousMean: b.moyenne, previousDeviation: b.ecartMedian,
          previousLargestMonthShare: b.partDuPlusGrosMois,
          deltaPct: ecartPct, displayThresholdPct: SEUIL_AFFICHAGE_RYTHME_PCT,
          currentContributions: num(apA.apports), previousContributions: num(apB.apports),
        },
        action: { vue: 'overview' },
      };
    },
  },

  /* --- D'ou vient la progression ------------------------------------------

     LA SEULE ATTRIBUTION DE CAUSE QUE LES DONNEES AUTORISENT, et elle s'arrete a
     mi-chemin. `apportsDetail()` sait ce qui est ENTRE du dehors sur la periode.
     Le complement, lui, melange la valorisation des placements, le capital
     rembourse sur les credits et la revalorisation d'un bien : on le nomme « le
     reste », et jamais « les marches ». */
  {
    id: 'wealth_growth_origin',
    onglet: 'overview',
    famille: 'progression',
    categorie: 'wealth_pace',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'origine',
    reposJours: 45,
    materialite: 10,
    question: 'Ma progression vient-elle de ce que je verse ou du reste ?',
    titleKey: 'insight.wealth_growth_origin.title',
    descriptionKey: 'insight.wealth_growth_origin.description',
    eligible(m) {
      const f = fenetresRythme(m.pace.points, MOIS_MINIMUM_FENETRE_RYTHME);
      return !!(f && partDesApports(f.recente));
    },
    evaluer(m) {
      const f = fenetresRythme(m.pace.points, MOIS_MINIMUM_FENETRE_RYTHME);
      const o = f && partDesApports(f.recente);
      if (!o) return null;
      if (o.part < 10 || o.part > 90) return null;
      return {
        valeur: o.part,
        params: {
          contributionsPct: o.part, restPct: 100 - o.part,
          contributions: o.apports, rest: o.reste, total: o.total,
          months: num(rythmeRepresentatif(f.recente).mois),
        },
        evidence: {
          source: 'apportsDetail+monthlyPace',
          from: o.debut, to: o.fin, total: o.total, contributions: o.apports,
          rest: o.reste, restIsNotOnlyMarkets: true,
        },
        action: { vue: 'overview' },
      };
    },
  },

  /* --- Quand la cible serait atteinte -------------------------------------

     Le seul moteur de projection est `capitalisation()`. On ne refait pas de
     trajectoire ici, on lit l'annee et le mois qu'il a notes au passage.

     « Selon tes hypotheses actuelles » et non « au rythme actuel » : la
     trajectoire depend d'un scenario de rendement, d'un versement mensuel et
     d'une inflation, tous poses par le detenteur. Les nommer dans la preuve est
     ce qui rend la date honnete. */
  {
    id: 'goal_projected_date',
    onglet: 'overview',
    famille: 'objectif',
    categorie: 'goal',
    priorite: INSIGHT_PRIORITE.HAUTE,
    dedupeGroup: 'goal',
    reposJours: 30,
    materialite: SEUIL_AFFICHAGE_OBJECTIF_MOIS,
    question: 'Quand ma cible serait-elle atteinte ?',
    titleKey: 'insight.goal_projected_date.title',
    descriptionKey: 'insight.goal_projected_date.description',
    eligible(m) {
      if (!(num(m.projection.target) > 0)) return false;
      const a = capitalisation({ years: horizonProjection() }).targetReached;
      return !!a && !a.dejaAtteinte && num(a.monthsFromNow) > 0;
    },
    evaluer(m) {
      const a = capitalisation({ years: horizonProjection() }).targetReached;
      if (!a || a.dejaAtteinte) return null;
      return {
        valeur: num(a.monthsFromNow),
        params: {
          target: num(m.projection.target), year: num(a.year), month: num(a.month),
          monthsFromNow: num(a.monthsFromNow),
        },
        evidence: {
          source: 'capitalisation',
          target: num(m.projection.target), horizonYears: horizonProjection(),
          monthlyContribution: num(m.projection.monthly), scenario: m.projection.scenario,
          inflationPct: num(m.projection.inflation),
          reachedYear: num(a.year), reachedMonth: num(a.month),
          monthsFromNow: num(a.monthsFromNow),
        },
        action: { vue: 'objective' },
      };
    },
  },

  {
    id: 'goal_date_shift',
    onglet: 'overview',
    famille: 'objectif',
    categorie: 'goal',
    priorite: INSIGHT_PRIORITE.HAUTE,
    dedupeGroup: 'goal_shift',
    reposJours: 30,
    materialite: SEUIL_AFFICHAGE_OBJECTIF_MOIS,
    question: 'Ma cible se rapproche-t-elle ou s’éloigne-t-elle ?',
    titleKey: 'insight.goal_date_shift.title',
    descriptionKey: 'insight.goal_date_shift.description',
    eligible(m) {
      if (!(num(m.projection.target) > 0)) return false;
      const vu = insightsVus().goal_projected_date;
      if (!vu || !vu.date || !(num(vu.valeur) > 0)) return false;
      const a = capitalisation({ years: horizonProjection() }).targetReached;
      return !!a && !a.dejaAtteinte && num(a.monthsFromNow) > 0;
    },
    evaluer(m) {
      const a = capitalisation({ years: horizonProjection() }).targetReached;
      const vu = insightsVus().goal_projected_date;
      if (!a || a.dejaAtteinte || !vu) return null;
      const jours = joursEntre(vu.date, m.aujourdhui);
      const attendu = num(vu.valeur) - jours / 30.44;
      const gagne = attendu - num(a.monthsFromNow);
      if (Math.abs(gagne) + 1e-9 < SEUIL_AFFICHAGE_OBJECTIF_MOIS) return null;
      return {
        valeur: num(a.monthsFromNow),
        poids: amplitude(gagne, SEUIL_AFFICHAGE_OBJECTIF_MOIS),
        params: {
          target: num(m.projection.target), year: num(a.year), month: num(a.month),
          monthsEarlier: gagne, sinceDays: jours,
        },
        evidence: {
          source: 'capitalisation+insightsVus',
          previousEstimateMonths: num(vu.valeur), previousDate: vu.date,
          currentEstimateMonths: num(a.monthsFromNow), expectedIfUnchanged: attendu,
          monthsEarlier: gagne, displayThresholdMonths: SEUIL_AFFICHAGE_OBJECTIF_MOIS,
        },
        action: { vue: 'objective' },
      };
    },
  },

  {
    id: 'debt_soon_free',
    onglet: 'overview',
    famille: 'dette',
    categorie: 'debt',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'debt_free',
    reposJours: 60,
    materialite: 1,
    question: 'Une mensualité va-t-elle bientôt se libérer ?',
    titleKey: 'insight.debt_soon_free.title',
    descriptionKey: 'insight.debt_soon_free.description',
    eligible: () => !!creditBientotSolde(),
    evaluer() {
      const c = creditBientotSolde();
      if (!c) return null;
      return {
        valeur: c.mois,
        poids: amplitude(MOIS_CREDIT_BIENTOT_SOLDE - c.mois + 3, 3),
        params: { months: c.mois, monthly: c.mensualite },
        evidence: {
          source: 'echeancierCredit', months: c.mois, monthlyPayment: c.mensualite,
          remaining: c.montant, horizonMonths: MOIS_CREDIT_BIENTOT_SOLDE,
        },
        action: { vue: 'accounts' },
      };
    },
  },

  /* --- Le poste qui a bouge, et lui seul ----------------------------------

     LA REGLE QUI MANQUAIT, et c'est la plus utile de l'onglet. `spending_shift`
     dit que le total a change de niveau ; il ne dit pas ou. « Tes depenses ont
     augmente de douze pour cent » laisse le lecteur ouvrir le tableau et
     comparer douze colonnes a la main, ce qui est exactement le travail qu'une
     application doit faire a sa place.

     UN SEUL POSTE SORT, LE PLUS GROS MOUVEMENT EN EUROS. Les nommer tous
     rendrait la carte illisible et ferait de l'insight un second tableau. Le
     mouvement se mesure en euros et non en pourcentage parce que c'est l'euro
     qui decide de ce qui compte dans un budget ; le pourcentage sert de filtre,
     pas de classement.

     Elle ne conseille rien. « Restaurants en hausse » est un constat ; « tu
     devrais reduire » serait un jugement sur une vie que l'application ne
     connait pas. */
  {
    id: 'spending_category_shift',
    onglet: 'budget',
    famille: 'budget',
    categorie: 'budget',
    /* HAUTE, ET C'EST CE QUI LA FAIT PASSER DEVANT `spending_shift`. Les deux
       partagent un groupe : elles racontent le meme fait, l'une en disant ou.
       A rang egal, les deux amplitudes saturent des qu'un mouvement est franc,
       et c'est alors l'ordre de declaration qui tranchait — donc le total, qui
       est declare avant. On lisait « tes depenses ont monte de 40 % » la ou
       « tes sorties passent de 100 a 300 € » etait disponible.
       Le rang dit la regle : quand un poste explique le mouvement, c'est lui
       qu'on veut lire ; quand aucun ne l'explique, cette regle ne sort pas et le
       total reprend sa place tout seul. */
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'spending',
    reposJours: 30,
    materialite: SEUIL_AFFICHAGE_POSTE_PCT,
    question: 'Quel poste a change, et de combien ?',
    titleKey: 'insight.spending_category_shift.title',
    descriptionKey: 'insight.spending_category_shift.description',
    eligible: m => m.depenses.length >= MOIS_MINIMUM_FENETRE_DEPENSES * 2,
    evaluer(m) {
      const n = m.depenses.length, N = MOIS_MINIMUM_FENETRE_DEPENSES;
      const recents = m.depenses.slice(n - N);
      const avants = m.depenses.slice(n - 2 * N, n - N);
      const postes = [...new Set([...recents, ...avants]
        .flatMap(x => Object.keys(x.v || {})))];
      const moyenne = (tranche, poste) =>
        tranche.reduce((s, x) => s + num((x.v || {})[poste]), 0) / tranche.length;
      const budgetMensuel = recents.reduce((s, x) => s + num(x.total), 0) / N;
      if (!(budgetMensuel > 0)) return null;

      let meilleur = null;
      for (const poste of postes) {
        const recent = moyenne(recents, poste);
        const avant = moyenne(avants, poste);
        const delta = recent - avant;
        const pct = avant > 0 ? (recent / avant - 1) * 100 : null;
        const poidsPct = Math.abs(delta) / budgetMensuel * 100;
        if (!(recent > 0)) continue;
        if (poidsPct + 1e-9 < POIDS_MINIMAL_DU_POSTE_PCT) continue;
        if (pct !== null && Math.abs(pct) + 1e-9 < SEUIL_AFFICHAGE_POSTE_PCT) continue;
        if (!meilleur || Math.abs(delta) > Math.abs(meilleur.delta)) {
          meilleur = { poste, recent, avant, delta, pct, poidsPct, nouveau: !(avant > 0) };
        }
      }
      if (!meilleur) return null;
      return {
        valeur: meilleur.pct === null ? meilleur.poidsPct : meilleur.pct,
        poids: amplitude(meilleur.pct === null ? meilleur.poidsPct : meilleur.pct,
                         SEUIL_AFFICHAGE_POSTE_PCT),
        params: { category: meilleur.poste, current: meilleur.recent,
                  previous: meilleur.avant, delta: meilleur.delta,
                  deltaPct: meilleur.pct, months: N, isNew: meilleur.nouveau },
        evidence: {
          source: 'expenseSeries.v',
          category: meilleur.poste,
          currentFrom: recents[0].month, currentTo: recents[N - 1].month,
          previousFrom: avants[0].month, previousTo: avants[N - 1].month,
          current: meilleur.recent, previous: meilleur.avant,
          deltaPct: meilleur.pct, shareOfBudgetPct: meilleur.poidsPct,
          displayThresholdPct: SEUIL_AFFICHAGE_POSTE_PCT,
          weightThresholdPct: POIDS_MINIMAL_DU_POSTE_PCT,
          rule: 'le plus gros mouvement en euros parmi les postes qui passent les deux seuils',
        },
        action: { vue: 'budget' },
      };
    },
  },

  {
    id: 'spending_shift',
    onglet: 'budget',
    famille: 'budget',
    categorie: 'budget',
    priorite: INSIGHT_PRIORITE.BASSE,
    dedupeGroup: 'spending',
    reposJours: 30,
    materialite: SEUIL_AFFICHAGE_DEPENSES_PCT,
    question: 'Mes dépenses ont-elles changé de niveau ?',
    titleKey: 'insight.spending_shift.title',
    descriptionKey: 'insight.spending_shift.description',
    eligible: m => m.depenses.length >= MOIS_MINIMUM_FENETRE_DEPENSES * 2,
    evaluer(m) {
      const n = m.depenses.length, N = MOIS_MINIMUM_FENETRE_DEPENSES;
      const recent = moyenneDepenses(m.depenses, n - N, N);
      const avant = moyenneDepenses(m.depenses, n - 2 * N, N);
      if (recent == null || avant == null || !(avant > 0)) return null;
      if (Math.round(recent) === Math.round(avant)) return null;
      const ecartPct = (recent / avant - 1) * 100;
      if (Math.abs(ecartPct) + 1e-9 < SEUIL_AFFICHAGE_DEPENSES_PCT) return null;
      return {
        valeur: ecartPct,
        poids: amplitude(ecartPct, SEUIL_AFFICHAGE_DEPENSES_PCT),
        params: { current: recent, previous: avant, delta: recent - avant,
                  deltaPct: ecartPct, months: N },
        evidence: {
          source: 'expenseSeries',
          currentFrom: m.depenses[n - N].month, currentTo: m.depenses[n - 1].month,
          previousFrom: m.depenses[n - 2 * N].month, previousTo: m.depenses[n - N - 1].month,
          current: recent, previous: avant, deltaPct: ecartPct,
          displayThresholdPct: SEUIL_AFFICHAGE_DEPENSES_PCT,
        },
        action: { vue: 'budget' },
      };
    },
  },

  {
    id: 'spending_month_anomaly',
    onglet: 'budget',
    famille: 'budget',
    categorie: 'budget',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'spending_month',
    reposJours: 30,
    materialite: 1,
    question: 'Le dernier mois clos sort-il de l’ordinaire ?',
    titleKey: 'insight.spending_month_anomaly.title',
    descriptionKey: 'insight.spending_month_anomaly.description',
    eligible: m => m.depenses.length >= 6,
    evaluer(m) {
      const serie = m.depenses;
      const dernier = serie[serie.length - 1];
      const avant = serie.slice(0, -1).map(x => num(x.total));
      const med = mediane(avant);
      const dispersion = mediane(avant.map(x => Math.abs(x - med)));
      if (!(dispersion > 0) || !(med > 0)) return null;
      const ecart = num(dernier.total) - med;
      if (Math.abs(ecart) < 2 * dispersion) return null;

      const usuel = poste => mediane(serie.slice(0, -1).map(x => num((x.v || {})[poste])));
      const postes = [...new Set(serie.flatMap(x => Object.keys(x.v || {})))]
        .map(poste => ({ poste, delta: num((dernier.v || {})[poste]) - usuel(poste) }))
        .filter(x => Math.sign(x.delta) === Math.sign(ecart) && x.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 2);
      const explique = postes.reduce((s, x) => s + x.delta, 0);
      const nommables = Math.abs(explique) >= Math.abs(ecart) / 2 ? postes : [];

      return {
        valeur: ecart,
        poids: amplitude(ecart, 2 * dispersion),
        params: { month: dernier.month, total: num(dernier.total), usual: med,
                  delta: ecart, deltaPct: ecart / med * 100,
                  /* Les chiffres ne survivent pas au refus de nommer : donner
                     un montant et une part pour des postes qu'on a decide de
                     taire les ferait lire comme la cause, alors qu'ils sont
                     precisement ce dont on a juge qu'ils n'expliquaient pas
                     assez. Rien a dire se dit `null`, pas par un nombre. */
                  drivers: nommables.map(x => x.poste),
                  driversDelta: nommables.length ? explique : null,
                  driversShare: nommables.length && ecart ? explique / ecart * 100 : null },
        evidence: {
          source: 'expenseSeries', month: dernier.month, total: num(dernier.total),
          usualMedian: med, usualDeviation: dispersion, observedMonths: avant.length,
          drivers: nommables.map(x => ({ category: x.poste, delta: x.delta })),
          driversExplain: nommables.length ? explique / ecart * 100 : null,
          rule: 'ecart superieur au double de la dispersion habituelle ; postes cites '
              + 'seulement s’ils expliquent la moitie de l’ecart',
        },
        action: { vue: 'budget' },
      };
    },
  },

  {
    id: 'spending_target_pace',
    onglet: 'budget',
    famille: 'budget_objectif',
    categorie: 'budget',
    priorite: INSIGHT_PRIORITE.HAUTE,
    dedupeGroup: 'spending_pace',
    reposJours: 10,
    materialite: SEUIL_DEPASSEMENT_PROJETE_PCT,
    question: 'Le rythme du mois en cours mene-t-il au-dela de l’objectif ?',
    titleKey: 'insight.spending_target_pace.title',
    descriptionKey: 'insight.spending_target_pace.description',
    eligible: (m, c) => num(m.budget.target) > 0
      && m.encours.avancement >= AVANCEMENT_MINIMAL_DU_MOIS
      && num(m.encours.total) > 0,
    evaluer(m) {
      const objectif = num(m.budget.target);
      const projete = num(m.encours.total) / m.encours.avancement;
      const ecartPct = (projete / objectif - 1) * 100;
      if (ecartPct + 1e-9 < SEUIL_DEPASSEMENT_PROJETE_PCT) return null;
      return {
        valeur: ecartPct,
        poids: amplitude(ecartPct, SEUIL_DEPASSEMENT_PROJETE_PCT),
        params: { spent: num(m.encours.total), projected: projete, target: objectif,
                  overPct: ecartPct, over: projete - objectif,
                  daysIn: m.encours.joursEcoules, daysInMonth: m.encours.joursDuMois },
        evidence: {
          source: 'expenseSeries + budgetFrame',
          month: m.encours.month, spent: num(m.encours.total),
          daysIn: m.encours.joursEcoules, daysInMonth: m.encours.joursDuMois,
          projected: projete, target: objectif, overPct: ecartPct,
          minimumProgress: AVANCEMENT_MINIMAL_DU_MOIS,
          displayThresholdPct: SEUIL_DEPASSEMENT_PROJETE_PCT,
          rule: 'depense a ce jour ramenee au mois entier, comparee a l’objectif declare',
        },
        action: { vue: 'budget' },
      };
    },
  },

  {
    id: 'budget_history_thin',
    onglet: 'budget',
    famille: 'budget_donnees',
    categorie: 'data_quality',
    priorite: INSIGHT_PRIORITE.BASSE,
    dedupeGroup: 'budget_data',
    reposJours: 45,
    materialite: 1,
    question: 'Y a-t-il de quoi comparer ce mois a une moyenne ?',
    titleKey: 'insight.budget_history_thin.title',
    descriptionKey: 'insight.budget_history_thin.description',
    eligible: m => m.depenses.length > 0
      && m.depenses.length < MOIS_MINIMUM_FENETRE_DEPENSES * 2,
    evaluer(m) {
      const manquants = MOIS_MINIMUM_FENETRE_DEPENSES * 2 - m.depenses.length;
      return {
        valeur: m.depenses.length,
        poids: 0,
        params: { months: m.depenses.length, missing: manquants,
                  needed: MOIS_MINIMUM_FENETRE_DEPENSES * 2 },
        evidence: {
          source: 'expenseSeries',
          observedMonths: m.depenses.length,
          neededMonths: MOIS_MINIMUM_FENETRE_DEPENSES * 2,
          rule: 'comparer trois mois clos aux trois precedents demande six mois',
        },
        action: { vue: 'budget' },
      };
    },
  },

  {
    id: 'concentration_top_line',
    onglet: 'accounts',
    famille: 'concentration',
    categorie: 'concentration',
    priorite: INSIGHT_PRIORITE.BASSE,
    dedupeGroup: 'concentration',
    reposJours: 60,
    materialite: 3,
    question: 'Une seule ligne porte-t-elle une part inhabituelle de mes actifs ?',
    titleKey: 'insight.concentration_top_line.title',
    descriptionKey: 'insight.concentration_top_line.description',
    eligible() {
      const c = concentration({ financier: true });
      return !!(c && c.top3);
    },
    evaluer() {
      const c = concentration({ financier: true });
      if (!c || !c.top3) return null;
      const deuxSuivantes = num(c.top3.value) - num(c.premiere.value);
      if (!(deuxSuivantes > 0) || num(c.premiere.value) < deuxSuivantes) return null;
      return {
        valeur: num(c.premiere.pct),
        poids: amplitude(num(c.premiere.value) / deuxSuivantes, 1),
        params: { label: c.premiere.label, pct: num(c.premiere.pct), lignes: num(c.n) },
        evidence: {
          source: 'concentration', scope: 'financier',
          firstValue: num(c.premiere.value), firstPct: num(c.premiere.pct),
          nextTwoValue: deuxSuivantes, lines: num(c.n),
          rule: 'la premiere ligne pese au moins autant que les deux suivantes reunies',
        },
        action: { vue: 'positions' },
      };
    },
  },
];

/* Le credit dont l'echeancier s'eteint le plus tot dans l'horizon retenu, avec
   la mensualite qui se liberera. Rend `null` s'il n'y en a aucun, ou si aucune
   charge ne porte la mensualite : sans elle, on ne saurait pas dire combien. */
function creditBientotSolde() {
  let tete = null;
  for (const e of ETABS()) {
    for (const d of (e.dettes || [])) {
      const ech = echeancierCredit(d);
      if (!ech || !ech.amortissable || !(num(ech.mois) > 0)) continue;
      if (num(ech.mois) > MOIS_CREDIT_BIENTOT_SOLDE) continue;
      const mensualite = num(mensualiteCredit(d));
      if (!(mensualite > 0)) continue;
      if (!tete || num(ech.mois) < tete.mois) {
        tete = { mois: num(ech.mois), mensualite, montant: num(d.montant) };
      }
    }
  }
  return tete;
}

/* La part de chaque poche dans le patrimoine, aujourd'hui et au dernier releve
   d'il y a au moins N mois. `historySeries` range chaque releve par poche :
   c'est la seule decomposition dont le passe dispose, et elle ne descend pas
   jusqu'a la ligne.

   Les deux parts se calculent sur la somme des MEMES poches de chaque cote. Un
   denominateur pris ailleurs — le brut d'un bandeau, le net d'une carte — aurait
   compare deux pourcentages qui ne parlent pas de la meme chose. */
function partsDesPoches(m, moisEnArriere) {
  const pts = m.releves;
  if (!pts.length) return null;
  const cible = decalerMois(String(m.aujourdhui), -moisEnArriere);
  const avant = pts.filter(x => String(x.date) <= cible);
  if (!avant.length) return null;
  const p = avant[avant.length - 1];
  const mois = moisEntre(String(p.date), String(m.aujourdhui));
  if (mois < moisEnArriere) return null;
  const totalAvant = POCHES_EVOLUTION.reduce((s, k) => s + num(p[k]), 0);
  const totalMaintenant = POCHES_EVOLUTION.reduce((s, k) => s + num(m.totaux[k]), 0);
  if (!(totalAvant > 0) || !(totalMaintenant > 0)) return null;
  return {
    date: String(p.date), mois,
    lignes: POCHES_EVOLUTION.map(k => {
      const a = num(p[k]) / totalAvant * 100;
      const b = num(m.totaux[k]) / totalMaintenant * 100;
      return { cle: k, avant: a, maintenant: b, ecart: b - a };
    }),
  };
}

/* =============================================================
   COUCHES 3 A 5 — POIDS, DEDUPLICATION, SELECTION
   =============================================================

   Parcourt le catalogue dans l'ordre declare, ecarte les regles qui n'ont pas de
   quoi conclure, ecarte celles qui se reposent, classe ce qui reste par poids,
   puis choisit au plus trois entrees en evitant de raconter trois fois la meme
   histoire.

   RIEN NE S'AFFICHE PARCE QUE C'EST CALCULABLE. Une regle eligible qui ne
   franchit pas son propre seuil rend `null`, et une liste vide est un resultat
   comme un autre.

   Ni DOM, ni ecriture, ni reseau, ni traduction, ni formatage. */
function evaluerInsights(ctx) {
  if (typeof aVerifier === 'function' && aVerifier().length) return [];
  const c = contexteInsights(ctx);
  const m = mesuresInsights(c);
  const sortis = [];
  REGLES_INSIGHT.forEach((regle, rang) => {
    if (!regle.eligible(m, c)) return;
    const brut = regle.evaluer(m, c);
    if (!brut) return;
    /* Deja dit recemment, et le chiffre n'a pas bouge : il attend son tour.

       IL L'ATTEND, IL NE SE TAIT PAS. Cette ligne rendait `return` : l'insight
       disparaissait de la liste au lieu de reculer dedans. Sur un patrimoine
       calme, ou trois regles seulement ont quelque chose a dire, les trois
       partaient au repos le lendemain de leur premiere lecture — vingt et un a
       quarante-cinq jours — et la carte affichait alors « Rien d'inhabituel a
       signaler ». C'etait faux : trois choses avaient ete trouvees, aucune
       n'avait cesse d'etre vraie, et la carte annoncait le calme. L'etat calme
       est une reponse, et il doit garder son sens ; il ne peut pas servir a dire
       « tout dort ».

       Le repos CLASSE donc, comme son commentaire l'a toujours dit : ce qui a
       deja ete lu passe derriere tout ce qui est neuf. Il disparait quand
       quelque chose de plus frais prend sa place, jamais parce qu'il est seul. */
    const repos = auRepos(regle, brut.valeur, c.aujourdhui);
    sortis.push({
      repos,
      id: regle.id,
      /* L'ONGLET OU L'INSIGHT EST CHEZ LUI, et ce n'est pas sa destination.
         `action.vue` dit ou l'on va en cliquant ; `onglet` dit ou la carte se
         pose. Les deux coincident souvent et divergent parfois : la reserve de
         securite se lit sur l'Apercu et renvoie a la carte d'autonomie, qui y
         vit aussi, tandis qu'un poste de depenses se lit dans Budget. Un seul
         champ pour les deux aurait force a choisir entre poser la carte au bon
         endroit et l'y faire renvoyer a elle-meme. */
      onglet: regle.onglet,
      famille: regle.famille,
      categorie: regle.categorie,
      priorite: regle.priorite,
      dedupeGroup: regle.dedupeGroup || regle.id,
      titleKey: regle.titleKey,
      descriptionKey: regle.descriptionKey,
      poids: num(regle.priorite) + num(brut.poids),
      valeur: num(brut.valeur),
      params: brut.params,
      evidence: brut.evidence,
      action: brut.action || null,
      rang,
    });
  });

  sortis.sort((a, b) => (Number(a.repos) - Number(b.repos))
    || (b.poids - a.poids) || (a.rang - b.rang));
  return sortis;
}

/* COUCHE 5 — LA SELECTION, SEPAREE DE LA DETECTION.

   Elle l'est pour une raison pratique autant que propre : une regle se teste sur
   ce qu'elle DETECTE, pas sur sa place dans un classement a treize. Un test qui
   passait par la liste finale cessait de parler de sa regle des qu'une
   quatorzieme entrait, et c'est un faux rouge a chaque ajout.

   `evaluerInsights()` rend tout ce qui a quelque chose a dire, classe.
   `construireInsights()` en garde au plus trois, et c'est lui que la vue lit. */
function construireInsights(ctx) {
  const sortis = evaluerInsights(ctx);

  const groupes = new Set(), familles = new Set(), choisis = [];
  for (const i of sortis) {
    if (groupes.has(i.dedupeGroup) || familles.has(i.famille)) continue;
    groupes.add(i.dedupeGroup); familles.add(i.famille); choisis.push(i);
  }
  for (const i of sortis) {
    if (groupes.has(i.dedupeGroup)) continue;
    groupes.add(i.dedupeGroup); choisis.push(i);
  }
  return choisis.map(({ rang, ...i }) => i);
}

function insightsDeLOnglet(vue, ctx) {
  if (!vue) return [];
  return construireInsights(ctx).filter(i => i.onglet === vue);
}
