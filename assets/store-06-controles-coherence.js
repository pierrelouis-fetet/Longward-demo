/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function aideReleveEnAttente() {
  return aUnRelevePatrimonial()
    ? trad('« Enregistrer le relevé » y reprend d’un coup tous les montants actuels')
    : trad('« Enregistrer ton premier relevé » y reprend d’un coup tous les montants actuels');
}

function healthChecks() {
  const out = [];
  let sujet = 'coherence';
  const add = (level, title, detail, view, cle) =>
    out.push({ level, sujet, title, detail, view, cle });

  const illisible = Store.illisibleActif();
  if (illisible) {
    add('error', trad('Données de cet appareil illisibles'),
      illisible.garde
        ? trad('Une copie brute est gardée : télécharge-la, puis supprime-la depuis Données.')
        : trad('Rien n’est écrit sur cet appareil tant que la copie brute n’est pas téléchargée.'),
      'data');
  }

  /* --- LES PREMIERS PAS PASSENT DEVANT TOUT LE RESTE ---------------------

     La cloche ne disait que des rappels d'exploitation : actualiser des cours,
     enregistrer un releve, saisir des depenses. Elle s'adressait donc a
     quelqu'un dont l'application est deja remplie, et le premier venu la
     trouvait en train de reclamer « le releve de septembre » avant meme
     d'avoir declare un compte. Un rappel qui suppose ce qui manque envoie vers
     un geste impossible.

     L'ORDRE DES ETAPES EST CELUI DES DONNEES, et non celui du calendrier :
     sans compte il n'y a rien a photographier, et sans inventaire complet la
     photo est fausse. Ces deux lignes se posent donc AVANT tous les autres
     controles, la ou le tri par gravite les laissera en tete.

     `PREMIERS_PAS` porte deja cette progression pour les ecrans vides. On ne la
     recopie pas : la cloche pose la meme question, et la seule chose qui lui
     appartient est le moment ou elle la pose. */
  sujet = 'saisies';
  if (!aUnComptePropre()) {
    add('action', trad('Commence par tes comptes'),
      trad('Une banque, un livret, un compte de courtage ou un bien : tout part de là.'),
      'accounts', CLE_INVENTAIRE);
  } else if (!inventaireDeclareComplet()) {
    add('action', trad('As-tu enregistré tous tes comptes et avoirs ?'),
      trad('Quand tout y est, dis-le ici : le relevé mensuel prendra le relais. Sinon, touche la ligne pour compléter dans Actifs.'),
      'accounts', CLE_INVENTAIRE);
  }
  sujet = 'coherence';

  for (const x of archivesAvecTitres()) {
    add('warn', trad('{n} est archivé mais porte encore des titres').replace('{n}', guill(nomCompteV2(x.compte))),
      trad(x.lignes.length > 1
        ? '{k} lignes, {v} : Marchés les compte, ton patrimoine non. Déplace-les, enregistre leur vente ou restaure le compte.'
        : '{k} ligne, {v} : Marchés la compte, ton patrimoine non. Déplace-la, enregistre sa vente ou restaure le compte.')
        .replace('{k}', x.lignes.length).replace('{v}', fmtEUR0(x.valeur)),
      'positions', `archive-titres:${x.compte.id}`);
  }

  sujet = 'cours';
  for (const p of Store.state.positions) {
    if ((p.isin || '').trim() && !isinIsValid(p.isin))
      add('error', trad('ISIN invalide sur {n}').replace('{n}', guill(p.name)),
        trad('{v}, clé de contrôle incorrecte').replace('{v}', p.isin), 'positions');
    if (!p.manual && !(p.symbol || '').trim() && !(p.isin || '').trim())
      add('warn', trad('{n} sans identifiant').replace('{n}', guill(p.name)),
        trad('Ni ISIN ni symbole : le cours ne peut pas être récupéré'), 'positions');
    if (!p.manual && !num(p.qty))
      add('warn', trad('{n} a une quantité nulle').replace('{n}', guill(p.name)),
        trad('La ligne compte pour 0 {dev} dans le portefeuille'), 'positions');
    if (!p.manual && !num(p.price))
      add('warn', trad('{n} n’a pas de cours').replace('{n}', guill(p.name)),
        trad('Valeur calculée à 0 {dev}'), 'positions');
  }

  if (Store.state.positions.length && !coursEnRoute()) {
    const last = Store.state.quotes?.lastRun;
    if (!last) add('info', trad('Cours jamais actualisés'),
      trad('Les prix affichés ne viennent pas encore du marché'), 'positions');
    else {
      const days = (Date.now() - new Date(last)) / 86400000;
      if (days > COURS_VIEUX_JOURS) add('warn',
        trad('Cours vieux de {n} jours').replace('{n}', Math.round(days)),
        trad('Valorisation et allocation sont décalées du marché'), 'positions');
    }
  }

  /* --- une ecriture refusee par le cloud ---
     Le serveur n'accepte une ecriture que de l'appareil qui a lu la version en
     place. Un refus veut donc dire : ce que tu viens d'enregistrer est ici, et
     nulle part ailleurs. C'est la seule situation ou fermer l'application fait
     perdre quelque chose, et elle ne se disait que sur la page Donnees.

     `typeof` et non un simple test : `store.js` se charge avant `cloudsync.js`,
     et un controle qui leve une exception emporterait toute la cloche. */
  sujet = 'synchro';
  if (typeof CloudSync !== 'undefined' && CloudSync.isAvailable()) {
    const c = CloudSync.status().conflict;
    if (c) add('error', trad('Ta dernière modification n’est pas partie'),
      trad('Une autre version existe en ligne. Elle sera reprise dès que le réseau reviendra.'), 'data');
  }

  sujet = 'credits';
  /* --- un capital restant dû négatif ---
     Il ne peut plus se saisir : les trois portes passent par
     `validerCreditSaisi`. Mais une regle neuve ne repare pas un fichier deja
     ecrit, et celui-ci compte a l'envers — la dette s'additionne en negatif,
     donc elle AJOUTE au patrimoine net. Rien ne le trahit, puisque le total
     penche du bon cote.

     Il ne se corrige pas tout seul : personne ne peut savoir si « −12 000 »
     voulait dire 12 000 ou zero, et choisir a la place du detenteur ecrirait
     un chiffre invente. Le controle le montre, la fiche le corrige. */
  for (const e of ETABS()) {
    for (const d of (e.dettes || [])) {
      if (num(d.montant) >= 0) continue;
      add('error', trad('Capital restant dû invalide : {l}')
          .replace('{l}', d.libelle || trad('Crédit')),
        trad('{v} chez {e}. Un capital restant dû négatif fait monter ton patrimoine '
          + 'net au lieu de le baisser. Ouvre la fiche du crédit pour le corriger.')
          .replace('{v}', fmtEUR0(num(d.montant))).replace('{e}', e.nom),
        'accounts');
    }
  }

  for (const e of ETABS()) {
    const du = (e.dettes || []).reduce((s, d) => s + num(d.montant), 0);
    if (!du) continue;
    if (COMPTES().some(c => c.etabId === e.id)) continue;
    add('error', trad('Crédit sans bien chez {e}').replace('{e}', e.nom),
      trad('{v} de capital restant dû se soustraient encore de ton patrimoine net, '
        + 'alors que plus aucun compte n’est rattaché. Ouvre la fiche pour retirer le crédit.')
        .replace('{v}', fmtEUR0(du)),
      'accounts');
  }

  for (const { compte, ligne } of lotsPartInvalide()) {
    add('warn', trad('Quote-part à corriger'),
      `${guill(nomCompteV2(compte))} · ${
        trad('{v} % n’est pas une quote-part valide.').replace('{v}', fmtNombre(num(ligne.part)))} `
      + trad('Ce bien n’est pas inclus dans les montants personnels qui dépendent de ta part '
        + 'tant que la valeur n’est pas corrigée.'),
      'accounts');
  }

  for (const c of comptesBiens()) {
    const u = usageEffectifBien(c);
    if (u.source !== 'declare' || u.usage === 'locative') continue;
    const loyers = (B().income || []).filter(r => r.bienId === c.id && num(r.amount));
    if (!loyers.length) continue;
    add('info', u.usage === 'principale'
        ? trad('Un loyer est rattaché à ta résidence principale.')
        : trad('Un loyer est rattaché à ta résidence secondaire.'),
      `${guill(nomCompteV2(c))} · ${trad('Vérifie l’usage du bien ou le rattachement '
        + 'du revenu. Ce peut être volontaire : une chambre louée, une location '
        + 'saisonnière.')}`,
      'accounts');
  }

  const POURQUOI = {
    ambigu: 'Ce prêteur tient plusieurs comptes : personne ne peut savoir lequel porte cette dette.',
    mort: 'Le bien qu’il finançait a été supprimé.',
    ailleurs: 'Le bien qu’il désigne appartient à un autre contenant.',
  };
  for (const d of creditsAClarifier()) {
    if (!d.montant) continue;
    add('warn', trad('Crédit non rattaché : {l}').replace('{l}', d.libelle),
      `${trad(POURQUOI[d.quoi])} ${trad('{v} de capital restant dû comptent dans ton '
        + 'patrimoine net sans apparaître sur aucune fiche de bien. Ouvre le crédit '
        + 'pour choisir le bien qu’il finance.').replace('{v}', fmtEUR0(d.montant))}`,
      'accounts');
  }

  sujet = 'echeances';
  for (const e of echeances()) {
    if (e.depassee) {
      add('action', trad('{l} a passé son échéance').replace('{l}', guill(e.libelle)),
        trad('Échéance au {d}, il y a {n} jours, et la ligne est toujours en cours pour '
          + '{v}. Si l’argent est rentré, enregistre-le avec « Remboursement » sur sa fiche ; '
          + 'sinon marque-la en retard.')
          .replace('{d}', fmtDate(e.echeance)).replace('{n}', Math.abs(e.jours))
          .replace('{v}', fmtEUR0(e.valeur)),
        'accounts');
    } else if (e.statut === 'retard') {
      add('warn', trad('{l} en retard').replace('{l}', guill(e.libelle)),
        trad('{v} chez {e}, échéance du {d}.')
          .replace('{v}', fmtEUR0(e.valeur)).replace('{e}', e.etab)
          .replace('{d}', fmtDate(e.echeance)), 'accounts');
    } else if (e.statut === 'defaut') {
      add('error', trad('{l} en défaut').replace('{l}', guill(e.libelle)),
        trad('{v} comptent encore en entier dans ton patrimoine. Si tu n’espères plus '
          + 'rien, baisse le montant : c’est la seule façon que ton patrimoine net '
          + 'dise la vérité.').replace('{v}', fmtEUR0(e.valeur)), 'accounts');
    }
  }

  sujet = 'coherence';
  {
    const p = patrimoine();
    if (p.net < 0 && p.dettes > 0) {
      const lignes = creditsEnCours().lignes.slice().sort((a, b) => b.reste - a.reste);
      const adosse = cr => comptesBiens().some(c => c.etabId === cr.etabId);
      const orphelins = lignes.filter(cr => !adosse(cr));
      if (orphelins.length) {
        const cr = orphelins[0];
        add('error', trad('Patrimoine net négatif'),
          trad('Tes crédits ({d}) dépassent tes avoirs ({b}) de {e}. Si l’un d’eux '
            + 'finance un bien (le plus gros sans bien en face est {l}, {r}), déclare '
            + 'ce bien : sa valeur doit figurer dans tes avoirs, sinon seule la dette '
            + 'compte. Un crédit immobilier sans son logement fait plonger le net.')
            .replace('{d}', fmtEUR0(p.dettes)).replace('{b}', fmtEUR0(p.brut))
            .replace('{e}', fmtEUR0(-p.net)).replace('{l}', guill(cr.libelle))
            .replace('{r}', fmtEUR0(cr.reste)),
          'accounts');
      } else {
        /* Somme des parts de capital des prochaines echeances : ce que le mois
           ajoute vraiment au net. `capital` vaut null sans taux connu, et le
           message le dit alors autrement plutot que de compter zero. */
        const capital = lignes.reduce((s, cr) => s + (cr.capital || 0), 0);
        add('info', trad('Patrimoine net négatif, et c’est normal après un achat'),
          trad('Tes biens valent {b} et il te reste {d} à rembourser : l’écart fait '
            + '{e}. C’est l’état ordinaire des premières années d’un achat à crédit, '
            + 'surtout quand le prêt a financé les frais de notaire, qui ne se '
            + 'revendent pas.')
            .replace('{b}', fmtEUR0(p.brut)).replace('{d}', fmtEUR0(p.dettes))
            .replace('{e}', fmtEUR0(-p.net))
          + ' ' + (capital > 0.005
            ? trad('Chaque mensualité rembourse {c} de capital, et ton patrimoine net '
              + 'remonte d’autant.').replace('{c}', fmtEUR0(capital))
            : trad('Renseigne le taux de tes crédits pour voir ce que chaque mensualité '
              + 'rembourse en capital : c’est ce montant qui fait remonter ton net.')),
          'accounts');
      }
    }
  }

  sujet = 'credits';
  for (const c of creditsEnCours().lignes) {
    if (!c.mensualite || c.charge) continue;
    add('action', trad('Mensualité de {l} hors du budget').replace('{l}', guill(c.libelle)),
      trad('{v} par mois sortent de ton compte sans figurer dans tes charges fixes. '
        + 'Ouvre le crédit pour créer la ligne, ou rattache-lui la charge existante '
        + 'si elle y est déjà sous un autre nom.')
        .replace('{v}', fmtEUR0(c.mensualite)), 'accounts');
  }

  sujet = 'credits';
  for (const c of creditsEnCours().lignes) {
    if (!c.verifieLe) {
      add('action', trad('Crédit {l} jamais vérifié').replace('{l}', guill(c.libelle)),
        trad('{v} de capital restant dû, sans date de dernière vérification. Ouvre-le '
          + 'une fois : l’application saura ensuite suivre son évolution.')
          .replace('{v}', fmtEUR0(c.reste)), 'accounts');
      continue;
    }
    if (c.moisDepuis < RAPPEL_CREDIT_MOIS) continue;
    if (c.projete == null) {
      add('action', trad('Crédit {l} à relever').replace('{l}', guill(c.libelle)),
        trad('Vérifié il y a {n} mois, et rien ne permet d’en déduire le solde '
          + 'd’aujourd’hui : ni échéances, ni taux. Va lire le montant chez {e} et '
          + 'corrige-le, c’est {v} qui pèsent sur ton patrimoine net.')
          .replace('{n}', c.moisDepuis).replace('{e}', c.etabNom)
          .replace('{v}', fmtEUR0(c.reste)),
        'accounts');
      continue;
    }
    if (Math.abs(c.ecart) < 1) continue;
    add('action', trad('Crédit {l} à mettre à jour').replace('{l}', guill(c.libelle)),
      c.sens === 'monte'
        ? trad('Vérifié il y a {n} mois. Sans échéances, les intérêts le font grossir : '
            + 'à {t} % l’an il devrait atteindre {p} au lieu de {r}. Relève le solde '
            + 'chez {e} : ton patrimoine net est surestimé de {x}.')
            .replace('{n}', c.moisDepuis).replace('{t}', fmtNombre(c.taux))
            .replace('{p}', fmtEUR0(c.projete)).replace('{r}', fmtEUR0(c.reste))
            .replace('{e}', c.etabNom).replace('{x}', fmtEUR0(-c.ecart))
        : trad('Vérifié il y a {n} mois. D’après ta mensualité, il devrait rester {p} '
            + 'au lieu de {r} : {x} de patrimoine net que l’application ne compte pas '
            + 'encore.')
            .replace('{n}', c.moisDepuis).replace('{p}', fmtEUR0(c.projete))
            .replace('{r}', fmtEUR0(c.reste)).replace('{x}', fmtEUR0(c.ecart)),
      'accounts');
  }

  sujet = 'coherence';
  /* Les cibles vivent dans `targets.classes` depuis que le rééquilibrage
     raisonne par classe d'actif. Ce contrôle additionnait encore `coreEtf`,
     `satellites` et `gold`, disparus à la migration : trois `undefined` font
     un NaN, et l'alerte réclamait donc 100 % en permanence à quelqu'un qui les
     avait déjà. Même définition que `rebalanceRows()` — une classe mise hors
     jeu ne compte pas, son encours a quitté la base. */
  const sum = sommeCibles();
  /* `rebalanceRows().base` et non le brut : le commentaire ci-dessus dit « tant
     qu'aucun euro n'est place », et le brut compte le cash. Quelqu'un qui venait
     de declarer son compte courant recevait donc un avertissement sur des cibles
     par defaut qu'il n'avait jamais choisies, le premier jour. La base des cibles
     est ce que ces cibles repartissent : c'est elle qui dit s'il y a matiere. */
  if (sum > 0 && Math.abs(sum - 100) > 0.05 && rebalanceRows().base > 0.005)
    add('warn', trad('Cibles d’allocation à {v}').replace('{v}', fmtPct(sum, 1)),
      trad('La somme devrait faire 100 % pour que les montants cibles aient un sens'),
      'rebalance');

  sujet = 'coherence';
  /* --- trous dans les deux historiques ---

     Ce contrôle ne cherchait que les trous **encadrés** par deux mois remplis :
     il parcourait les index des lignes non vides et signalait les écarts. Sauter
     juillet et août alors qu'on est en septembre n'en produit aucun — rien ne
     suit — donc le cas le plus courant passait au travers. `moisVides()` part de
     l'autre bout : tous les mois passés vides depuis le premier rempli.

     Les dépenses ont désormais le leur. Elles n'en avaient pas, alors que la
     moyenne des dépenses sert de coût de la vie à l'autonomie financière et à la
     cible d'épargne de précaution : un mois manquant y pèse deux fois. */
  for (const [trous, quoi, vue] of [
    [trousReleves(), 'Trou dans l’historique des relevés', 'history'],
    [trousDepenses(), 'Trou dans l’historique des dépenses', 'budget'],
  ]) {
    if (!trous.length) continue;
    const noms = trous.map(fmtMonth);
    const cite = noms.length > 3 ? `${noms.slice(0, 3).join(', ')}…` : noms.join(', ');
    add('warn', trad(quoi),
      trad('{n} mois sans donnée : {c}. Les moyennes se calculent sur ce qui reste.')
        .replace('{n}', noms.length).replace('{c}', cite),
      vue);
  }

  sujet = 'saisies';
  /* Le releve du mois en cours, et il passe par `currentMonthPending` : un
     rappel repousse ou tu pour le mois ne doit pas ressortir ici. Ce controle
     lisait l'etat brut, donc « Plus tard » eteignait le bandeau et la pastille
     de la barre du bas, mais pas cette ligne — ni la cloche qui la reprend.
     Un seul endroit decide qu'une saisie reclame quelque chose.

     L'aide nomme le bouton que l'Historique montre : voir
     `aideReleveEnAttente`. */
  /* La garde vit dans `currentMonthPending()`, avec les bandeaux de l'accueil :
     la poser ici aussi l'aurait laissee diverger de l'autre. */
  const relEnAttente = currentMonthPending();
  if (relEnAttente.missing) {
    add('action', `${trad('Relevé de')} ${relEnAttente.label} ${trad('à enregistrer')}`,
      aideReleveEnAttente(), 'history');
  }

  sujet = 'budget';
  const b = Store.state.budget;
  /* Les depenses reclamees sont celles du mois clos, pas du mois en cours : le
     2 aout, personne ne sait ce qu'aout coutera. `depensesEnAttente` porte cette
     regle, et le report avec. Ce controle visait le mois courant, et allumait
     donc une alerte du 1er au 31 sur un mois qu'on ne peut pas encore saisir. */
  /* Meme raison : la garde est dans `depensesEnAttente()`, partagee avec le
     bandeau de l'accueil et la pastille du menu. */
  const depEnAttente = depensesEnAttente();
  if (depEnAttente.missing)
    add('action', trad('Dépenses de {m} à saisir').replace('{m}', depEnAttente.label),
      trad('Le mois est clos, ce qu’il a coûté reste à enregistrer'), 'budget');

  const f = budgetFrame();
  if (f.income > 0 && f.available < f.target)
    add('error', trad('Objectif de dépenses au-dessus du reste pour vivre'),
      trad('{t} visés pour {a} disponibles')
        .replace('{t}', fmtEUR0(f.target)).replace('{a}', fmtEUR0(f.available)), 'budget');

  sujet = 'budget';
  /* « 0 mois d'autonomie, 0 € pour 0 € de coût mensuel » etait la caricature de
     la regle que ce projet s'est donnee : la cloche ne parle que de ce qui existe
     chez celui qui la regarde.

     La garde ne porte pas sur `burn` : celui-ci retombe sur l'objectif de
     depenses, pose par defaut, et vaut donc 1 000 EUR chez quelqu'un qui n'a
     rien saisi. Elle porte sur le revenu declare, comme le rappel des depenses
     et pour la meme raison — c'est lui qui donne un cadre aux mois. */
  const rw = runway();
  if (!pasAFaire('revenus') && rw.burn > 0.005 && rw.immediateMonths < 3)
    /* Le montant cité est celui qui sert au calcul — le palier « disponible
       tout de suite ». Le message affichait `nowByGroup().cash`, qui compte
       aussi le cash posé chez un courtier : il annonçait donc une somme dont
       les mois affichés ne tenaient pas compte, et l'écart s'est creusé le
       jour où ce cash a rejoint les liquidités.
       Et `toFixed(1)` écrivait « 0.7 mois », seul point décimal d'une
       application qui met des virgules partout ailleurs. */
    add('warn', `${trad('Épargne de précaution')}${deuxPoints()} ${fmtNombre(Math.round(rw.immediateMonths * 10) / 10)} ${trad('mois')}`,
      `${trad('Disponible tout de suite')} ${fmtEUR0(rw.immediate)} ${trad('pour')} ${fmtEUR0(rw.burn)} ${trad('de coût mensuel, la règle courante est 3 à 6 mois')}`, 'overview');

  return out;
}

/*   `perfAnnualisee()` et `perfAnnualiseePortefeuille()` vivaient ici. Elles
   étalaient la plus-value d'une ligne sur la durée depuis sa date d'achat, ce
   qui ne tient que si l'argent est arrivé d'un coup.

   Une case « alimentée régulièrement » a été envisagée puis écartée : elle
   aurait demandé du travail pour que l'application cesse de mentir, et sur un
   portefeuille où les grosses lignes sont justement celles qu'on alimente, elle
   aurait éteint le chiffre là où il portait la valeur.

   Ce qui reste dit vrai : l'écart en euros et en pourcentage, qui ne dépend pas
   de la façon dont la ligne s'est constituée. Une durée de détention l'a
   remplacé sur la fiche, comme un fait plutôt que comme un taux, puis elle est
   partie aussi : elle n'apportait pas de quoi payer sa place.

   `dateAchat` reste, et sert toujours : c'est elle qui empêche l'écart du jour
   de compter une baisse d'avant l'achat. Un champ qui pilote un calcul n'a pas
   besoin de s'afficher. */

function fmtDureeMois(mois) {
  const n = Math.max(0, Math.round(mois));
  const a = Math.floor(n / 12), m = n % 12;
  const lesMois = `${m} ${trad('mois')}`;
  if (!a) return lesMois;
  const lesAns = `${a} ${a > 1 ? trad('ans') : trad('an')}`;
  return m ? `${lesAns} ${trad('et')} ${lesMois}` : lesAns;
}

/* Le meme calcul que `latentPnl()`, au mot pres : valeur des positions, prix de
   revient, ecart, pourcentage. Deux exemplaires d'une meme somme finissent par
   dire deux choses — celui-ci rendait encore 0 % sur une base nulle quand
   l'autre se taisait, et le meme ecran pouvait porter les deux. Le nom reste,
   huit appelants le connaissent, mais il n'y a plus qu'un calcul.

   Declaration de fonction et non `const` : une liaison lexicale ne se hisse pas
   et ne se pose pas sur `window`, deux pieges que ce depot connait deja. */
function portfolioPnl() { return latentPnl(); }
partieChargee('assets/store-06-controles-coherence.js');
