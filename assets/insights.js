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

const INSIGHT_PRIORITE = { HAUTE: 1, MOYENNE: 2, BASSE: 3 };

/* --- Seuils : ce sont des filtres d'affichage, jamais des normes -----------

   LIRE CECI AVANT D'EN AJOUTER UN.

   Ces nombres existent pour qu'un ecart d'un demi-point ne prenne pas la place
   d'un ecart de dix. Ils ne disent rien de ce qui est prudent, sain ou
   souhaitable, et aucun ne doit jamais s'afficher comme une regle : « 5 points
   d'ecart » n'est pas une limite recommandee, c'est le moment ou l'application
   juge que ca vaut la peine d'etre dit.

   La convention de comparaison est `>=`, et elle est volontairement inclusive :
   un ecart de exactement 5,0 points produit l'insight. Un test la fige, parce
   que la frontiere est le seul endroit ou deux lecteurs peuvent differer. */
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

const MOIS_MINIMUM_FENETRE_RYTHME = 6;

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
   LES REGLES
   =============================================================

   Chacune porte son identifiant, sa categorie, son rang, son groupe de
   deduplication, la question a laquelle elle repond, et deux fonctions pures.
   `eligible` dit si les donnees permettent de conclure ; `evaluer` rend
   l'insight ou `null`. L'ordre de declaration sert de depart au classement :
   il est stable, et c'est lui qui departage deux rangs egaux. */
const REGLES_INSIGHT = [

  /* --- 1. Combien de temps la reserve tient -------------------------------

     Le tableau de bord montre deja le cash. Ce qu'il ne montre pas, c'est le
     rapport entre ce cash et ce qui sort chaque mois — et c'est la seule forme
     sous laquelle un montant de liquidites veut dire quelque chose.

     Aucun seuil, aucun jugement : ni « trop », ni « pas assez ». `runway()`
     porte bien un `targetLow` et un `targetHigh` a trois et six mois, qui
     servent une jauge ailleurs ; ils ne sortent PAS d'ici. Trois mois n'est pas
     une verite, c'est une phrase qui circule. */
  {
    id: 'liquidity_runway',
    categorie: 'liquidity',
    priorite: INSIGHT_PRIORITE.HAUTE,
    dedupeGroup: 'liquidity',
    question: 'Combien de temps ma réserve couvre-t-elle mes dépenses ?',
    titleKey: 'insight.liquidity_runway.title',
    descriptionKey: 'insight.liquidity_runway.description',
    explainabilityKey: 'insight.liquidity_runway.explain',
    eligible(ctx) {
      const d = depensesObservees(String(ctx.aujourdhui).slice(0, 4));
      if (!d.observees) return false;
      const r = runway();
      return num(r.burn) > 0;
    },
    evaluer(ctx) {
      const d = depensesObservees(String(ctx.aujourdhui).slice(0, 4));
      const r = runway();
      return {
        params: {
          months: num(r.liquidMonths),
          /* `runway()` ne rend pas la somme mobilisable, il rend le nombre de
             mois qu'elle couvre. On la retrouve en multipliant par la
             consommation : c'est l'inverse exact de sa propre division, pas un
             second calcul de liquidites. */
          reserve: num(r.burn) * num(r.liquidMonths),
          monthlyBurn: num(r.burn),
        },
        evidence: {
          source: 'runway',
          immediate: num(r.immediate),
          monthlyBurn: num(r.burn),
          liquidMonths: num(r.liquidMonths),
          immediateMonths: num(r.immediateMonths),
          observedExpenseMonths: d.mois,
          observedMonthlyExpenses: d.moyenne,
        },
        action: { vue: 'budget' },
      };
    },
  },

  /* --- 2. L'ecart a la cible que l'utilisateur a posee --------------------

     La seule comparaison qui vaille ici est avec SA cible, jamais avec une
     repartition reputee bonne. `rebalanceRows()` la calcule deja, sur une base
     explicite dont les classes mises hors jeu sont retirees — on ne refait donc
     ni le denominateur ni les parts.

     Une seule sortie par regle, la deviation la plus grande en valeur absolue.
     Cinq classes qui derivent ne font pas cinq cartes : elles font une carte,
     celle qui derive le plus, et le detail se lit dans Allocation. A egalite
     parfaite, l'ordre rendu par le moteur tranche, et il est stable. */
  {
    id: 'allocation_target_gap',
    categorie: 'allocation',
    priorite: INSIGHT_PRIORITE.HAUTE,
    dedupeGroup: 'allocation',
    question: 'Est-ce que mon allocation s’éloigne de ce que j’avais décidé ?',
    titleKey: 'insight.allocation_target_gap.title',
    descriptionKey: 'insight.allocation_target_gap.description',
    explainabilityKey: 'insight.allocation_target_gap.explain',
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
        params: {
          classe: tete.r.cle,
          label: tete.r.label,
          currentPct: num(tete.r.pct),
          targetPct: num(tete.r.targetPct),
          deltaPct: tete.ecart,
        },
        evidence: {
          source: 'rebalanceRows',
          classe: tete.r.cle,
          scope: 'classe',
          lignesAgregees: num(tete.r.roles),
          currentPct: num(tete.r.pct),
          targetPct: num(tete.r.targetPct),
          deltaPct: tete.ecart,
          currentValue: num(tete.r.value),
          targetValue: num(tete.r.targetVal),
          displayThresholdPp: SEUIL_AFFICHAGE_ALLOCATION_PP,
        },
        action: { vue: 'rebalance' },
      };
    },
  },

  /* --- 3. Le rythme d'accumulation, compare a lui-meme --------------------

     RYTHME, ET JAMAIS PERFORMANCE. Ce que `monthlyPace()` mesure est la
     variation du patrimoine NET entre deux releves : elle contient l'epargne,
     les apports exterieurs, le capital rembourse sur les credits et le
     mouvement des marches, sans savoir les separer. L'appeler rendement serait
     attribuer aux marches ce qu'on a mis de sa poche.

     Les deux fenetres se nomment par les mois reellement couverts. Personne ne
     lira « douze mois contre les douze precedents » sur un historique qui n'en
     porte pas vingt-quatre : les nombres de mois sortent dans les parametres,
     et la phrase se construira avec eux.

     LE RYTHME EST UNE MEDIANE, PAS UNE MOYENNE. Un seul mois exceptionnel
     — prime, heritage, vente — suffit a faire dire a une moyenne que sept
     cents euros par mois en valent deux mille. La mediane repond a « a quoi
     ressemble un mois ordinaire ici », qui est la question posee. La moyenne
     reste dans la preuve : c'est elle que l'historique affiche, et l'ecart
     entre les deux se lit. */
  {
    id: 'wealth_pace_shift',
    categorie: 'wealth_pace',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'wealth_pace',
    question: 'Mon patrimoine progresse-t-il plus vite qu’avant ?',
    titleKey: 'insight.wealth_pace_shift.title',
    descriptionKey: 'insight.wealth_pace_shift.description',
    explainabilityKey: 'insight.wealth_pace_shift.explain',
    eligible() {
      return !!fenetresRythme(monthlyPace().points, MOIS_MINIMUM_FENETRE_RYTHME);
    },
    evaluer() {
      const f = fenetresRythme(monthlyPace().points, MOIS_MINIMUM_FENETRE_RYTHME);
      if (!f) return null;
      const a = rythmeRepresentatif(f.recente);
      const b = rythmeRepresentatif(f.precedente);
      const apA = statsRythme(f.recente), apB = statsRythme(f.precedente);
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
      return {
        params: {
          currentMonthly: courant,
          currentMonths: num(a.mois),
          previousMonthly: precedent,
          previousMonths: num(b.mois),
          deltaMonthly: courant - precedent,
          deltaPct: ecartPct,
        },
        evidence: {
          source: 'monthlyPace',
          currentFrom: f.recente[0] ? f.recente[0].depuis || f.recente[0].date : null,
          currentTo: f.recente[f.recente.length - 1].date,
          currentMonths: num(a.mois),
          currentMonthly: courant,
          currentMean: a.moyenne,
          currentDeviation: a.ecartMedian,
          currentLargestMonthShare: a.partDuPlusGrosMois,
          previousFrom: f.precedente[0] ? f.precedente[0].depuis || f.precedente[0].date : null,
          previousTo: f.precedente[f.precedente.length - 1].date,
          previousMonths: num(b.mois),
          previousMonthly: precedent,
          previousMean: b.moyenne,
          previousDeviation: b.ecartMedian,
          previousLargestMonthShare: b.partDuPlusGrosMois,
          deltaPct: ecartPct,
          displayThresholdPct: SEUIL_AFFICHAGE_RYTHME_PCT,
          currentContributions: num(apA.apports),
          previousContributions: num(apB.apports),
        },
        action: { vue: 'history' },
      };
    },
  },

  /* --- 4. Quand la cible serait atteinte ----------------------------------

     Le seul moteur de projection est `capitalisation()`. On ne refait pas de
     trajectoire ici, on lit l'annee et le mois qu'il a notes au passage.

     « Selon tes hypotheses actuelles » et non « au rythme actuel » : la
     trajectoire depend d'un scenario de rendement, d'un versement mensuel et
     d'une inflation, tous poses par l'utilisateur. Les nommer dans la preuve
     est ce qui rend la date honnete.

     Si le moteur n'atteint pas la cible dans l'horizon choisi, il n'y a pas de
     date : la regle se tait plutot que d'en fabriquer une. Une cible deja
     franchie n'est pas non plus cette regle-la. */
  {
    id: 'goal_projected_date',
    categorie: 'goal',
    priorite: INSIGHT_PRIORITE.HAUTE,
    dedupeGroup: 'goal',
    question: 'Quand ma cible serait-elle atteinte ?',
    titleKey: 'insight.goal_projected_date.title',
    descriptionKey: 'insight.goal_projected_date.description',
    explainabilityKey: 'insight.goal_projected_date.explain',
    eligible() {
      const s = projectionSettings();
      if (!(num(s.target) > 0)) return false;
      const p = capitalisation({ years: horizonProjection() });
      const a = p.targetReached;
      return !!a && !a.dejaAtteinte && num(a.monthsFromNow) > 0;
    },
    evaluer() {
      const s = projectionSettings();
      const p = capitalisation({ years: horizonProjection() });
      const a = p.targetReached;
      if (!a || a.dejaAtteinte) return null;
      return {
        params: {
          target: num(s.target),
          year: num(a.year),
          month: num(a.month),
          monthsFromNow: num(a.monthsFromNow),
        },
        evidence: {
          source: 'capitalisation',
          target: num(s.target),
          horizonYears: horizonProjection(),
          monthlyContribution: num(s.monthly),
          scenario: s.scenario,
          inflationPct: num(s.inflation),
          reachedYear: num(a.year),
          reachedMonth: num(a.month),
          monthsFromNow: num(a.monthsFromNow),
        },
        action: { vue: 'objective' },
      };
    },
  },

  /* --- 5. Ce qui monte sans passer par l'epargne --------------------------

     Une mensualite de credit sort du compte en entier, mais une partie
     reconstitue du patrimoine : le capital rembourse. Il fait grossir le
     patrimoine net sans jamais etre disponible a investir, et c'est
     exactement le genre de chose qu'un tableur ne dit pas tout seul.

     `savingsReconciliation()` fait deja cette separation et la nomme. On lit
     son `capitalRembourse`, et on ne le confond jamais avec `investable`. */
  {
    id: 'debt_principal_share',
    categorie: 'debt',
    priorite: INSIGHT_PRIORITE.MOYENNE,
    dedupeGroup: 'debt',
    question: 'Quelle part de ma progression vient du remboursement de mes crédits ?',
    titleKey: 'insight.debt_principal_share.title',
    descriptionKey: 'insight.debt_principal_share.description',
    explainabilityKey: 'insight.debt_principal_share.explain',
    eligible() {
      return num(savingsReconciliation().capitalRembourse) > 0.005;
    },
    evaluer() {
      const rec = savingsReconciliation();
      return {
        params: {
          monthlyPrincipalRepaid: num(rec.capitalRembourse),
          monthlyInvestable: num(rec.investable),
        },
        evidence: {
          source: 'savingsReconciliation',
          monthlyPrincipalRepaid: num(rec.capitalRembourse),
          monthlyInvestable: num(rec.investable),
          monthlyTheoretical: num(rec.theoretical),
          /* Les depenses retenues sont-elles observees ou est-ce l'objectif qui
             a servi ? La difference change ce que `investable` veut dire. */
          expensesObserved: !!rec.spendObserved,
        },
        action: { vue: 'budget' },
      };
    },
  },
];

function construireInsights(ctx) {
  const c = contexteInsights(ctx);
  const sortis = [];
  REGLES_INSIGHT.forEach((regle, rang) => {
    if (!regle.eligible(c)) return;
    const brut = regle.evaluer(c);
    if (!brut) return;
    sortis.push({
      id: regle.id,
      categorie: regle.categorie,
      priorite: regle.priorite,
      dedupeGroup: regle.dedupeGroup || regle.id,
      titleKey: regle.titleKey,
      descriptionKey: regle.descriptionKey,
      explainabilityKey: regle.explainabilityKey,
      params: brut.params,
      evidence: brut.evidence,
      action: brut.action || null,
      rang,
    });
  });

  sortis.sort((a, b) => (a.priorite - b.priorite) || (a.rang - b.rang));

  const vus = new Set();
  return sortis.filter(i => {
    if (vus.has(i.dedupeGroup)) return false;
    vus.add(i.dedupeGroup);
    return true;
  }).map(({ rang, ...i }) => i);
}
