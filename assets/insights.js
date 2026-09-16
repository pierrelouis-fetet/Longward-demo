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

/* Les lignes du reequilibrage, mises a plat.

   `rebalanceRows()` ne rend pas un tableau mais un objet : `classes` porte une
   ligne par classe — dedoublee en core et satellite quand la cible l'est — et
   `cash` porte la tresorerie a placer, ou `null` quand elle a ete sortie du
   perimetre. Les deux se lisent de la meme facon, avec la meme base, et une
   regle qui n'aurait lu que `classes` aurait ignore une cible de tresorerie
   sans que rien ne le dise. */
function lignesReequilibrage(r) {
  const base = (r && r.classes) ? r.classes.slice() : [];
  if (r && r.cash) base.push(r.cash);
  return base;
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

     Aucun seuil de variation en V1, volontairement. En poser un demanderait de
     decider a partir de quel ecart un rythme « change », et rien dans les
     donnees ne le dit. La priorisation tranchera, avec du recul. */
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
      const a = statsRythme(f.recente);
      const b = statsRythme(f.precedente);
      return {
        params: {
          currentMonthly: num(a.average),
          currentMonths: num(a.mois),
          previousMonthly: num(b.average),
          previousMonths: num(b.mois),
          deltaMonthly: num(a.average) - num(b.average),
        },
        evidence: {
          source: 'monthlyPace',
          currentFrom: f.recente[0] ? f.recente[0].depuis || f.recente[0].date : null,
          currentTo: f.recente[f.recente.length - 1].date,
          currentMonths: num(a.mois),
          currentMonthly: num(a.average),
          previousFrom: f.precedente[0] ? f.precedente[0].depuis || f.precedente[0].date : null,
          previousTo: f.precedente[f.precedente.length - 1].date,
          previousMonths: num(b.mois),
          previousMonthly: num(b.average),
          currentContributions: num(a.apports),
          previousContributions: num(b.apports),
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
