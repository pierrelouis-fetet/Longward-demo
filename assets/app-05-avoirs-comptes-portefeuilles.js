/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
let compteVue = 'banque';            // banque | type
let allocFinancier = true;
/* Une transition a montrer au prochain montage des anneaux, et une seule.

   Meme mecanique que `evoTransition` pour la courbe, et pour la meme raison :
   `render()` remonte les graphiques a chaque frappe et a chaque retour sur la
   vue. Le drapeau se leve sur le seul geste qui change le perimetre, et le
   montage le consomme. */
let allocTransition = false;
/* L'angle de la repartition qu'on vient de choisir, le temps d'un rendu.

   Changer d'angle n'est pas arriver sur la vue : ni `.vue-entre` ni
   `.graphes-poussent` ne se posent sur #view, et le nouvel angle se posait
   d'un coup. Le drapeau fait porter les deux classes d'entree a la seule
   section de l'angle ; la carte des poches, au-dessus, ne bouge pas. Le geste
   le leve autour de son rendu et le baisse aussitot. */
let allocAngleEntre = false;
let relanceGraphes = false;

/* La base de cette page, en un seul endroit.

   Elle se recopiait a sept endroits sous la forme d'un ternaire, et le huitieme
   a ete oublie : le centre de l'anneau annonçait 354,6 k EUR « Tes avoirs » au
   milieu de parts qui totalisaient 66 551. Un total qui n'egale pas la somme de
   ses parts, sur la carte meme, et le pire des defauts de cette base de code
   puisqu'il rassure. Le preambule et la carte des usages avaient le meme.

   Une base qui se derive a huit endroits finit par en oublier un. Elles se
   nomment donc ici, toutes les deux, et un test interdit desormais d'ecrire
   `BASES.net`, `BASES.avoirs` ou `BASES.financier` ailleurs dans cette page :
   une carte prend sa base par l'une de ces deux fonctions, jamais a la main. */
const baseAlloc = () => (allocFinancier ? BASES.avoirsFinanciers : BASES.net);
const valeurBaseAlloc = () => (allocFinancier ? totalFinancier() : nowTotals().net);
const baseAvoirsAlloc = () => (allocFinancier ? BASES.avoirsFinanciers : BASES.avoirs);
const valeurAvoirsAlloc = () => (allocFinancier ? totalFinancier() : patrimoine().brut);
const partsAllocLisibles = () => valeurBaseAlloc() > 0.005;
let compteRecherche = '';
/* L'etat vit dans `meta`, pas dans une variable qui le recopie : le `Set`
   etait construit au chargement du script, donc avant que le store soit lu —
   il partait toujours vide et le repli memorise ne s'appliquait jamais. Une
   seule source, interrogee au moment du rendu. */
const cleLiqPli = aff => `liq:${aff}`;

const compteReplies = {
  liste: () => Store.state?.meta?.comptesReplies || [],
  has(cle) { return this.liste().includes(cle); },
  add(cle) { if (!this.has(cle)) Store.state.meta.comptesReplies = [...this.liste(), cle]; },
  delete(cle) { Store.state.meta.comptesReplies = this.liste().filter(c => c !== cle); },
};
let groupesRendus = [];
function memoriserReplies() { Store.save(); }

const MOBILISABLE_COURT = {
  immediat: 'Immédiat', differe: 'Quelques jours',
  lent: 'Quelques mois', bloque: 'Inaccessible',
};

function badgeMobilisable(niveau) {
  return `<span class="tag mob-${niveau}" title="${esc(trad(MOBILISABLE_LABEL[niveau]))}">${trad(MOBILISABLE_COURT[niveau])}</span>`;
}

function variationCompte(id) {
  const releves = Store.state.monthly
    .filter(r => r.v && r.v[id] != null && num(r.v[id]) !== 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const dernier = releves[releves.length - 1];
  if (!dernier) return null;
  const avant = num(dernier.v[id]);
  const maintenant = nowValue(id);
  if (!avant) return null;
  return { eur: maintenant - avant, pct: (maintenant / avant - 1) * 100, depuis: fmtMonth(dernier.date) };
}

/* Une teinte neutre, et non plus une couleur tiree du nom.

   Elle etait un hachage du nom du groupe vers les huit teintes de serie. Trois
   choses en decoulaient, toutes mauvaises.

   Le hachage collisionne : « t-courant » et « t-cto » tombaient tous deux sur
   `series-6`, soit deux groupes de la meme couleur dans la meme liste, ce qui est
   exactement ce que la couleur etait censee eviter.

   Il pioche dans un vocabulaire qui veut dire autre chose. Dans toute
   l'application, `series-1` est le bleu des liquidites et `series-2` le vert des
   actifs de marche — c'est teste, « un actif porte la meme couleur partout ».
   Un etablissement de banque heritait donc du vert des actifs de marche, un
   courtier du bleu des liquidites : un faux signal, dans une langue que le reste de l'app s'applique a
   tenir juste. Pire que pas de couleur du tout.

   Et il n'apportait rien : le role de la pastille est de rattacher une ligne a
   son groupe quand l'en-tete collant a quitte l'ecran. Une teinte unique le fait
   aussi bien, sans rien affirmer.

   Le regroupement par placement garde ses vraies couleurs : la, le groupe *est*
   une classe d'actif, et il recoit `CLASSE_COULEURS` en argument. Sur Comptes,
   une couleur veut donc dire une classe d'actif, ou rien. */
function teinteGroupe() {
  return 'var(--border-strong)';
}

/* `avecEtab` : quand la liste est deja groupee par etablissement, le repeter
   sur chaque ligne n'apprend rien et pousse le type du compte sur deux
   lignes. « le courtier · Portefeuille de cryptomonnaies » devient
   « Portefeuille de cryptomonnaies ». */
function sousTitreCompte(c, avecEtab = true) {
  const nom = nomCompteV2(c);
  return [avecEtab ? nomEtabDe(c) : '', trad(typeCompte(c.type).label)]
    .filter(x => x && x !== nom).join(' · ');
}

/* La date d'une valeur, dite avec les mots de sa nature, ou son absence. Une
   seule table pour la liste d'Actifs et l'en-tete des fiches : deux redactions
   diraient deux choses du meme montant. Les natures et leurs dates viennent de
   `datesDuCompte()`. */
function phraseDateValeur(x) {
  const d = x.date ? fmtDate(x.date) : '';
  if (x.genre === 'solde') return d ? trad('solde vérifié le {d}').replace('{d}', d) : trad('solde jamais vérifié');
  if (x.genre === 'estimation') return d ? trad('estimée le {d}').replace('{d}', d) : trad('estimation sans date');
  if (x.genre === 'vl') return d ? trad('VL du {d}').replace('{d}', d) : trad('sans date de VL');
  if (x.genre === 'cours') return d ? trad('cours du {d}').replace('{d}', d) : trad('cours jamais actualisés');
  return '';
}

function ligneCompte(c, avecEtab = true, nomRepete = false) {
  const estimee = estValeurEstimee(typeCompte(c.type));
  const dateEstimee = estimee
    ? phraseDateValeur(datesDuCompte(c).find(x => x.genre === 'estimation') || { genre: '' }) : '';
  const v = estimee ? null : variationCompte(c.id);
  /* « +0 € depuis aout » : un changement nul n'apprend rien, et il prenait la
     place d'une information sur chaque ligne d'un compte qui n'a pas bouge —
     un livret, un compte courant releve au meme montant. Une variation ne
     s'ecrit que si elle en est une ; sinon la place reste, vide, pour que les
     rangees gardent leur hauteur. Le seuil suit ce que le format montre :
     `fmtSigned` arrondit a l'euro, et −0,30 € s'ecrivait « −0 € ». */
  const bouge = v && Math.abs(v.eur) >= 0.5;
  const idx = Store.state.comptes.indexOf(c);
  return `
  <div class="cpt-swipe" data-compte="${esc(c.id)}">
    <div class="cpt-actions" aria-hidden="true">
      <button class="btn sm" data-action="fiche-compte" data-id="${esc(c.id)}">${trad('Modifier')}</button>
      <button class="btn sm ghost" data-action="archiver-compte" data-id="${esc(c.id)}">${trad('Archiver')}</button>
    </div>
    <button type="button" class="cpt-ligne" data-action="fiche-compte" data-id="${esc(c.id)}">
      <span class="cpt-nom">${esc(nomRepete ? trad(typeCompte(c.type).label) : nomCompteV2(c))}
        ${nomRepete ? '' : `<span class="sub">${esc(sousTitreCompte(c, avecEtab))}</span>`}</span>
      <span class="cpt-val">${fmtEUR(valeurCompte(c))}
        ${estimee ? `<span class="sub">${dateEstimee || '&nbsp;'}</span>`
          : bouge ? `<span class="sub" title="${esc(trad('Écart entre la valeur de ce compte aujourd’hui et celle de ton dernier relevé, {m}. Versements et retraits compris : ce n’est pas une plus-value.').replace('{m}', v.depuis))}">${
              fmtSigned(v.eur)} ${trad('par rapport à')} ${esc(v.depuis)}</span>`
            : `<span class="sub">&nbsp;</span>`}</span>
      <span class="cpt-chev">›</span>
    </button>
  </div>`;
}

function espaceTerminal(c, idx, t, seule) {
  if (!seule) return '';
  /* LA MEME CARTE POUR LES QUATRE, ET C'EST LA LIGNE QUI S'EFFACE, PAS LA CARTE.

     Deux presentations cohabitaient. Les actifs comptes en parts avaient une
     liste cle-valeur ; les autres — pret participatif, bien de valeur —
     recevaient `lignePlacement`, qui est une LIGNE DE LISTE promue carte : un
     nom, une pastille, un montant et un gain colles en rangee, avec les faits du
     pret entasses dans un sous-titre en gris. Cote a cote, deux placements non
     cotes du meme portefeuille ne se lisaient pas de la meme façon, et l'un
     n'avait ni « Prix d'achat », ni « Valeur actuelle », ni « Plus-value »
     nommes.

     Le motif qui justifiait la separation — « ils n'ont ni parts ni prix
     unitaire » — n'en etait pas un : le gabarit ne rend deja QUE les lignes qui
     ont un objet. Un pret sans parts n'affiche pas « Parts detenues », il
     affiche son prix d'achat en totalite ; un actif en parts fait l'inverse.
     Une seule carte, et chacun y trouve ses lignes. */
  return detailsPlacement(c, idx, t, seule);
}

/* UNE SEULE CARTE POUR CE QU'ON DETIENT EXACTEMENT.

   La fiche d'une participation ne pose pas la question deux fois : une carte Le
   placement qui redirait la classe et le montant du bandeau, et une carte
   Informations qui redirait le nom et le type, feraient le meme nom trois fois,
   le meme montant deux fois, et deux boutons Modifier que rien ne distingue.
   Sur un telephone, c'est un ecran de defilement pour zero information de plus.

   Ce qu'on vient reellement verifier sur un placement en parts : combien on en
   a, ce que vaut une part aujourd'hui, ce qu'on l'a payee, et ce que cela fait.
   Les trois premiers vivent dans le modele et s'affichent cote a cote.

   TOUT EST DERIVE. `parts`, `valeur` et `prixDeRevient` sont les seules donnees
   saisies ; les prix unitaires et la plus-value se recalculent a chaque rendu.
   Rien de nouveau n'est persiste, et le total reste la valeur saisie -- le
   reconstruire depuis un prix unitaire arrondi ferait un ecart de centimes. */
function detailsPlacement(c, idx, t, l) {
  const u = prixParPart(l);
  const perf = perfLigne(l);
  const nonRenseigne = `<span class="muted">${trad('à renseigner')}</span>`;
  const ligne = (dt, dd) => (dd == null || dd === '' ? ''
    : `<dt>${dt}</dt><dd>${dd}</dd>`);
  const plusValue = perf.pnl == null ? null
    : `<span class="${cls(perf.pnl)}">${fmtSigned(perf.pnl)}</span>`
      + (perf.pct == null ? '' : ` <span class="muted">·</span> `
         + `<span class="${cls(perf.pnl)}">${fmtSignedPct(perf.pct)}</span>`);

  return `
  <div class="card" data-anchor="estimation">
    <div class="card-head"><h2>${trad(titreActif(t))}</h2>
      <div class="tete-actes">
        <button class="btn sm ghost" data-action="editer-placement"
                data-id="${esc(c.id)}" data-i="${l.ref}"
                >${trad(t.parts ? 'Parts et valeur' : 'Valeur et prix d’achat')}</button>
        <button class="btn sm ghost" data-action="ceder-placement"
                data-id="${esc(c.id)}" data-i="${l.ref}"
                >${trad(t.prete ? 'Remboursement' : 'Céder')}</button>
      </div></div>
    <dl class="kv">
      ${ligne(trad('Parts détenues'), u ? fmtNombre(u.parts) : null)}
      ${ligne(trad('Valeur estimée / part') + aide(trad('La valeur que tu as déclarée, divisée par le nombre de parts. Ce placement n’est pas coté : c’est une estimation, pas un cours.')),
              u && u.valeur != null ? fmtPart(u.valeur) : null)}
      ${ligne(trad('Prix d’achat / part'),
              u && u.revient != null ? fmtPart(u.revient)
                : (u ? nonRenseigne : null))}
      ${ligne(trad('Prix d’achat'), u ? null
              : (l.prixDeRevient ? fmtEUR(l.prixDeRevient) : nonRenseigne))}
      ${ligne(estValeurEstimee(t)
          ? trad('Valeur estimée') + aide(trad('Ton estimation, pas un prix de vente : ce que tu encaisserais vraiment ne se connaît qu’à la cession, et « Céder » l’enregistre.'))
          : trad('Valeur actuelle'),
        fmtEUR(l.valeur) + (!estValeurEstimee(t) ? '' : ` <span class="muted">·</span> <span class="muted">${
          l.estimeLe ? trad('estimée le {d}').replace('{d}', esc(fmtDate(l.estimeLe))) : trad('estimation sans date')}</span>`))}
      ${ligne(t.prete
          ? trad('Écart depuis le prêt') + aide(trad('La valeur d’aujourd’hui moins ce que tu as prêté. Sur un prêt, l’écart vient des intérêts courus ou d’une révision de la valeur : il ne s’encaisse qu’au remboursement, et un défaut peut le ramener à zéro.'))
          : trad('Plus-value latente') + aide(trad('La valeur d’aujourd’hui moins ce que tu as payé. Latente : elle n’est encaissée qu’à la revente, et la valeur d’un placement non coté est une estimation. Aucun impôt n’en est déduit : l’application ne modélise aucun régime fiscal, ici pas plus qu’ailleurs.')),
              plusValue)}
      ${ligne(trad('Taux annoncé'), l.taux ? `${fmtNombre(num(l.taux))} %` : null)}
      ${ligne(trad('Échéance'), l.echeance ? fmtJourMois(l.echeance) : null)}
      ${ligne(trad('Statut'), statutLigne(l) === 'encours'
              ? null : trad(STATUTS_LIGNE[statutLigne(l)]))}
      ${ligne(trad('Liquidité'), champMobilite(l, c, true))}
    </dl>
  </div>`;
}

/* La disponibilite, reglable, et A UN SEUL ENDROIT.

   Deux cartes la posent : celle d'un placement en parts (`detailsPlacement`) et
   celle des autres actifs terminaux (`lignePlacement`). Seule la seconde offrait
   le menu, donc une part de societe affichait « Bloque » sans qu'aucun ecran ne
   permette de le dementir — et c'est precisement le cas que le reglage existe
   pour couvrir : un non cote qui se revend sur un marche secondaire n'est pas
   bloque, et c'est le placement qui sait, pas le type.

   Un helper plutot qu'une seconde copie du menu : deux listes d'options ecrites
   a la main pour une seule verite finissent par diverger, et celle qu'on oublie
   de changer dit le contraire de l'autre.

   Le menu reste un vrai `<select>` : il porte l'accessibilite et le clavier, ce
   qu'un faux menu reconstruit aurait fallu refaire. */
function champMobilite(l, compte, editable) {
  const badge = badgeMobilisable(mobiliteLigne(l, compte));
  if (!editable || !l.refMobilite) return badge;
  return `
    <span class="dispo-reglable">
      ${badge}
      <select data-path="${esc(l.refMobilite)}"
              aria-label="${trad('Disponibilité de')} ${esc(l.libelle)}">
        <option value="auto" ${!l.mobilite || l.mobilite === 'auto' ? 'selected' : ''}>
          ${trad('Auto,')} ${esc(trad(MOBILISABLE_COURT[mobilisabilite(l.classe, compte.type)]))}</option>
        ${Object.entries(MOBILISABLE_COURT).map(([v, lib]) =>
          `<option value="${v}" ${l.mobilite === v ? 'selected' : ''}>${esc(trad(lib))}</option>`).join('')}
      </select>
    </span>`;
}

/* `sansNom` A DISPARU AVEC SON SEUL APPELANT. Ce quatrieme argument servait a
   promouvoir une ligne de liste en carte, sur la fiche d'un actif terminal :
   elle y taisait son nom — deja ecrit deux fois plus haut — et prenait celui de
   sa classe. Ces fiches rendent maintenant la meme carte cle-valeur que les
   actifs en parts, donc plus rien ne demande ce mode, et un mode d'affichage que
   personne n'exerce finit par mentir sans qu'on le sache. */
function lignePlacement(l, compte, editable = false) {
  const gain = l.prixDeRevient ? l.valeur - l.prixDeRevient : null;
  /* La disponibilite se lit comme une pastille, pas comme un menu deroulant.

     Elle en etait un, large, sur chaque ligne : la moitie de la largeur utile
     pour un reglage qu'on touche une fois dans la vie de l'application — la
     regle du type de compte est juste presque toujours. Et « Auto, Quelques
     jours » est une valeur, pas un intitule : rien ne disait de quoi il
     s'agissait.

     C'est donc la pastille compacte, la meme que partout ailleurs, avec le menu
     natif rendu invisible par-dessus. Un seul appui, le selecteur du systeme
     s'ouvre, et la ligne ne paie plus une colonne entiere pour cela. Le menu
     reste un vrai `<select>` : il porte l'accessibilite et le clavier, ce qu'un
     faux menu reconstruit aurait fallu refaire. */
  const dispo = champMobilite(l, compte, editable);
  const st = statutLigne(l);
  const libelle = nomLignePlacement(l, compte);
  const replie = x => String(x || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pareil = (a, b) => {
    const x = replie(a), y = replie(b);
    return !!x && (x === y || x === y + 's' || x + 's' === y);
  };
  /*    Le repli `sansClasse` vivait ici : dans la vue groupee par classe,
   l'en-tete du groupe portait deja le mot, et le repeter sous chaque ligne
   remplissait la colonne de ce que le titre venait de dire.*/
  const u = prixParPart(l);
  const parPart = !u ? '' : (() => {
    const combien = `${fmtNombre(u.parts)} ${trad('parts')}`;
    if (u.revient != null && u.valeur != null
        && Math.abs(u.valeur - u.revient) > u.revient * 0.005) {
      return `${combien} · ${fmtPart(u.revient)} ${trad('payées,')} `
           + `${fmtPart(u.valeur)} ${trad('aujourd’hui')}`;
    }
    const seul = u.valeur != null ? u.valeur : u.revient;
    return seul == null ? combien : `${combien} · ${fmtPart(seul)} ${trad('la part')}`;
  })();

  const sousTitre = [CLASSES_ACTIFS[l.classe] || l.classe, nomCompteV2(compte),
    parPart,
    l.taux ? `${fmtNombre(num(l.taux))} % ${trad('annoncé')}` : '',
    l.echeance ? `${trad('échéance')} ${fmtJourMois(l.echeance)}` : '',
    st !== 'encours' ? STATUTS_LIGNE[st] : '']
    .filter((x, i, t) => x && !pareil(x, libelle)
                           && t.indexOf(t.find(y => y && pareil(y, x))) === i)
    .join(' · ');
  /* L'edition se prend par un bouton, plus par le nom.

     Toute la ligne ne peut pas devenir le bouton : elle porte deja un `<select>`
     pour la disponibilite, et un bouton dans un bouton n'existe pas. C'est donc
     un « Modifier » explicite au bout de la rangee, la ou la fiche du compte pose
     deja le sien pour la carte « Informations ». Le meme mot au meme endroit. */
  const modifiable = editable && !l.marche && l.ref != null;
  const corps = `
    <span class="cpt-nom">${esc(libelle)}
      <span class="sub">${esc(sousTitre)}</span></span>
    <span class="plc-dispo">${dispo}</span>
    <span class="cpt-val">${fmtEUR(l.valeur)}
      ${gain != null && Math.abs(gain) > 0.005
        ? `<span class="sub ${cls(gain)}">${fmtSigned(gain)}</span>` : '<span class="sub">&nbsp;</span>'}</span>
    ${modifiable ? `<button type="button" class="btn sm ghost plc-modif"
        data-action="editer-placement" data-id="${esc(compte.id)}" data-i="${l.ref}"
        title="${trad('Modifier')} ${esc(libelle)}">${trad('Modifier')}</button>` : ''}`;

  if (editable) return `<div class="plc-ligne plc-placement">${corps}</div>`;

  const cible = l.marche
    ? `data-action="open-position" data-i="${Store.state.positions.indexOf(l.marche)}"`
    : `data-action="fiche-compte" data-id="${esc(compte.id)}"`;
  return `
  <button type="button" class="plc-ligne plc-placement plc-lien" ${cible}
          title="${l.marche ? `Voir la fiche de ${esc(libelle)}`
                            : `Ouvrir ${esc(nomCompteV2(compte))}`}">
    ${corps}<span class="cpt-chev">›</span>
  </button>`;
}

/*    `enteteePlacements()` et `ligneEspeces()` vivaient ici. Une fonction sans
   appelant se garde sans se maintenir, et finit par decrire un ecran qui
   n'existe plus.*/

/* Deux listes, une par pays de contexte (`paysContexte()`, cote store : la
   devise choisie, la langue avant ce choix). Tout type reste accessible par
   « Autre… » ; il s'agit de mettre en premier ce qu'un lecteur de ce pays a le
   plus de chances de posseder. Un Americain ouvre un 401(k) et un Roth IRA
   plus souvent qu'un PEA. */
const FAMILLES_EN_VUE = {
  fr: ['courant', 'livret', 'pea', 'av', 'cto', 'immo', 'crypto'],
  us: ['courant', 'livret', 'cto', 'us401k', 'rothIra', 'immo', 'crypto'],
};
const famillesEnVue = () => FAMILLES_EN_VUE[paysContexte()];
function famillesDActifs() {
  const choix = typesCompteChoix();
  const dispo = famillesEnVue().map(id => choix.find(t => t.id === id)).filter(Boolean);
  if (!dispo.length) return '';
  const reste = choix.length > dispo.length;
  return `
      <p class="familles-titre">${trad('Ce que Longward sait suivre')}</p>
      <div class="familles">
        ${dispo.map(t => `
        <button type="button" class="famille" data-action="ajouter-compte" data-type="${esc(t.id)}">
          <span class="famille-nom">${esc(trad(t.label))}</span>
          <span class="famille-plus" aria-hidden="true">+</span>
        </button>`).join('')}
        ${!reste ? '' : `
        <button type="button" class="famille" data-action="ajouter-compte">
          <span class="famille-nom">${trad('Autre…')}</span>
          <span class="famille-plus" aria-hidden="true">+</span>
        </button>`}
      </div>`;
}

/* CE QUI SE MET A JOUR A LA MAIN, EN TETE DE LA LISTE D'ACTIFS.

   La liste vient de `valeursARevoir()` (store.js) : des soldes, des estimations
   et des capitaux restant dus qui datent ou n'ont pas de date. Les cours n'y
   sont pas, ils s'actualisent. Chaque ligne mene a la fiche ET au champ, par
   `aller-fiche` avec son ancre et le curseur ; « sans date » se lit en toutes
   lettres, ce n'est pas la meme chose qu'un chiffre vieux. Trois lignes, le
   reste derriere un bouton qui ne re-rend pas la page (`revoir-tout`), et le
   depli survit aux rendus suivants le temps de la session. */
const REVOIR_VISIBLES = 3;
let revoirToutOuvert = false;
function carteValeursARevoir() {
  const liste = valeursARevoir();
  if (!liste.length) return '';
  const phrase = x => {
    const d = x.date ? esc(fmtDate(x.date)) : '';
    if (x.genre === 'solde') return d ? trad('solde vérifié le {d}').replace('{d}', d) : trad('solde jamais vérifié');
    if (x.genre === 'credit') return d ? trad('capital restant dû vérifié le {d}').replace('{d}', d)
                                       : trad('capital restant dû jamais vérifié');
    if (x.publiee) return d ? trad('VL du {d}').replace('{d}', d) : trad('sans date de VL');
    return d ? trad('estimée le {d}').replace('{d}', d) : trad('estimation sans date');
  };
  const contexte = x => {
    const c = x.compteId ? compteById(x.compteId) : null;
    if (x.genre === 'solde') return c ? sousTitreCompte(c) : '';
    if (x.genre === 'credit') { const e = etabById(x.etabId); return e ? e.nom : ''; }
    return c && nomCompteV2(c) !== x.nom ? nomCompteV2(c) : '';
  };
  const montrer = revoirToutOuvert ? liste.length : REVOIR_VISIBLES;
  return `
  <div class="card revoir${revoirToutOuvert ? ' ouvert' : ''}">
    <div class="card-head"><h2>${trad('À mettre à jour')}${aide(trad('Des soldes, des estimations et des capitaux restant dus qui datent ou n’ont pas de date. Touche une ligne pour ouvrir le champ.'))}</h2>
      <span class="hint">${trad(liste.length > 1 ? '{n} valeurs saisies à la main' : '{n} valeur saisie à la main')
        .replace('{n}', liste.length)}</span></div>
    <div class="mlist-groupe">
      ${liste.map((x, k) => `
      <button type="button" class="mlist${k >= REVOIR_VISIBLES ? ' revoir-surplus' : ''}"
              data-action="aller-fiche" data-route="${esc(x.route)}" data-anchor="${esc(x.ancre)}" data-focus="1">
        <span class="ml-nom">${esc(x.nom)}${contexte(x) ? `<span class="sub">${esc(contexte(x))}</span>` : ''}</span>
        <span class="ml-chiffres"><span class="${x.date ? 'muted' : ''}">${phrase(x)}</span></span>
        <span class="ml-chev" aria-hidden="true">›</span>
      </button>`).join('')}
    </div>
    ${liste.length > montrer ? `<button type="button" class="btn sm ghost" data-action="revoir-tout"
        style="margin-top:8px">${trad('Voir les {n} autres').replace('{n}', liste.length - montrer)}</button>` : ''}
  </div>`;
}

function viewAccounts() {
  const pat = patrimoine();
  const d = deltas();
  groupesRendus = [];                  // rempli par `groupe()` au fil du rendu
  const filtre = compteRecherche.trim().toLowerCase();
  const correspond = texte => !filtre || texte.toLowerCase().includes(filtre);

  const correspondAuCompte = c =>
    correspond(nomCompteV2(c)) || correspond(nomEtabDe(c)) ||
    lignesDe(c).some(l => correspond(l.libelle));

  const ouverts = comptesOuverts().filter(correspondAuCompte);
  const archives = COMPTES().filter(c => c.statut === 'archive' && correspondAuCompte(c));

  /* `teinte` : la couleur d'un groupe n'est tirée de son nom que faute de
     mieux. Quand le groupe *est* une classe d'actif, il porte la couleur que
     la classe a déjà partout ailleurs — le camembert de l'accueil, la légende
     de la courbe, la répartition. Liquidités bleu, actifs de marché vert,
     immobilier jaune : la même chose se reconnaît à la même couleur d'un écran
     à l'autre, sinon la couleur ne veut plus rien dire. */
  const enveloppeGroupes = html => html.trim() ? `<div class="cpt-groupes">${html}</div>` : '';
  const groupe = (cle, titre, sousTitre, corps, total, lien = '', teinte = null) => {
    if (!corps.trim()) return '';
    const replie = compteReplies.has(cle);
    groupesRendus.push(cle);
    return `
    <section class="cpt-groupe ${replie ? 'replie' : ''}" style="--teinte:${teinte || teinteGroupe()}">
      <div class="cpt-gtitre">
        <button type="button" class="cpt-gplier" data-action="replier-groupe" data-cle="${esc(cle)}"
                aria-expanded="${!replie}">
          <span class="cpt-pastille" aria-hidden="true"></span>
          <span class="cpt-gnom">${esc(trad(titre))}${sousTitre ? `<span class="sub">${esc(trad(sousTitre))}</span>` : ''}</span>
          <span class="cpt-gtotal">${total == null ? '' : fmtEUR(total)}</span>
          <span class="cpt-chev">${replie ? '›' : '⌄'}</span>
        </button>
        ${lien}
      </div>
      <div class="cpt-pli${replie ? '' : ' ouvert'}"><div class="cpt-corps">${corps}</div></div>
    </section>`;
  };

  let sectionsAffichees = false;
  const titreSection = (t, sous) => `
      <h3 class="cpt-section">${esc(trad(t))}<span class="sub">${esc(trad(sous))}</span></h3>`;

  const sansCompte = !ouverts.some(c => !typeCompte(c.type).interne);

  let corps = '';
  if (sansCompte && !filtre) {
    corps = `<div class="card">${invitePremierPas('comptes')
      || `<p class="empty">${trad('Tes comptes et tes biens vivront ici.')}</p>`}
      ${famillesDActifs()}</div>`;
  } else if (!ouverts.length && !archives.length) {
    corps = `<div class="card"><p class="empty">${trad('Rien ne correspond à {q}.').replace('{q}', guill(esc(compteRecherche)))}
      Essaie avec le nom de la banque ou du placement.</p></div>`;
  } else if (compteVue === 'banque') {
    /* Deux sections, et la frontiere se derive des comptes.

       Cette vue distingue deux choses de nature differente : les banques et les
       courtiers, qui tiennent de l'argent pour toi, et les biens, ou le
       contenant EST la chose. Un appartement ne s'affiche pas comme un
       etablissement d'un compte au milieu des banques : sans cette seconde
       etagere, ranger l'immobilier n'aurait pas de bonne reponse.

       Un etablissement passe dans la seconde section quand tous ses comptes sont
       detenus en direct -- `estDetenuEnDirect()`, pose sur la classe et non sur le
       type. `estUnBien()` ne convient pas : il dit si un compte se saisit par une
       valeur et un prix d'achat, le non cote dit oui, et les plateformes de
       financement se retrouveraient sous Biens et especes alors qu'elles
       tiennent des parts pour toi. Un etablissement sans compte reste dans la
       premiere : il ne subsiste que pour un credit, et un credit se doit a un
       preteur.

       Les titres ne paraissent que si les deux sections existent. Un seul titre
       ne range rien, il ajoute une ligne. */
    const sansContenant = ouverts.filter(c => !c.etabId || !etabById(c.etabId));
    const groupeEtab = e => {
      const siens = ouverts.filter(c => c.etabId === e.id);
      const doitEncore = (e.dettes || []).reduce((s, x) => s + num(x.montant), 0);
      if (!siens.length && !doitEncore) return '';
      const totalE = siens.reduce((s, c) => s + valeurCompte(c), 0);
      const credits = (e.dettes || []).reduce((s, x) => s + num(x.montant), 0);
      const lignes = siens.map(c => ligneCompte(c, false, siens.length === 1 && nomCompteV2(c) === e.nom)).join('');
      const dette = credits ? `
        <div class="plc-ligne">
          <span class="cpt-nom">${trad('Crédits en cours')}
            <span class="sub">${esc((e.dettes || []).map(x => x.libelle).join(', '))}</span></span>
          <span class="cpt-val down">−${fmtEUR(credits)}</span>
        </div>
        <div class="plc-ligne">
          <span class="cpt-nom"><b>${trad('Valeur nette')}</b></span>
          <span class="cpt-val"><b>${fmtEUR(totalE - credits)}</b></span>
        </div>` : '';
      const orphelin = !siens.length && doitEncore ? `
        <div class="note note-relance" style="margin:0">⚠ <span>
          <b>${trad('Ce crédit ne finance plus rien.')}</b> Le compte qu'il accompagnait a été
          supprimé, mais ${fmtEUR0(doitEncore)} continuent de se soustraire de ton
          patrimoine net. Ouvre la fiche pour le retirer.</span>
          <button class="btn sm" data-action="fiche-etab" data-id="${esc(e.id)}">${trad('Ouvrir la fiche')}</button>
        </div>` : '';
      return groupe(`e-${e.id}`, e.nom,
        siens.length ? `${siens.length} ${motContenu(e.id, siens.length)}`
                     : `${trad('plus aucun')} ${motContenu(e.id, 1)}`, orphelin + lignes + dette, totalE,
        `<button type="button" class="btn sm ghost" data-action="fiche-etab" data-id="${esc(e.id)}"
                 title="${trad('Ouvrir la fiche')} · ${esc(e.nom)}">${trad('Fiche')} ›</button>`,
        teinteEtab(e));
    };

    const chezUnTiers = ETABS().filter(e => !estEtabDeBiens(e)).map(groupeEtab).join('');
    const especesSeules = sansContenant.length > 0
      && sansContenant.every(c => typeCompte(c.type).interne && !valeurCompte(c));
    const enDirect = ETABS().filter(estEtabDeBiens).map(groupeEtab).join('')
      + (sansContenant.length && !especesSeules
        ? groupe('e-sans', trad('Sans intermédiaire'), trad('espèces et objets de valeur'),
            sansContenant.map(c => ligneCompte(c, false)).join(''),
            sansContenant.reduce((s, c) => s + valeurCompte(c), 0), '',
            teinteDominante(sansContenant))
        : '');
    const especesVides = !especesSeules ? '' : `
      <p class="hint cpt-sans-rien"><b>${trad('Espèces')}</b>${deuxPoints()} ${trad('rien de déclaré')} ·
        <button type="button" class="lien-nu" data-action="fiche-compte"
                data-id="${esc(sansContenant[0].id)}">${trad('Déclarer des espèces')} ›</button></p>`;

    sectionsAffichees = !!chezUnTiers.trim() && !!enDirect.trim();
    corps = (sectionsAffichees ? titreSection('Comptes', 'chez une banque ou un courtier') : '')
          + enveloppeGroupes(chezUnTiers)
          + (sectionsAffichees ? titreSection('Biens et espèces', 'ce que tu détiens en direct') : '')
          + enveloppeGroupes(enDirect) + especesVides;
  } else if (compteVue === 'type') {
    /* Les groupes viennent de `groupesParEnveloppe()`, cote store : un compte
       dont le type ne figure pas dans TYPES_COMPTE y garde un groupe au lieu de
       disparaitre de la page sans quitter son total. Un test somme la fonction. */
    corps = enveloppeGroupes(groupesParEnveloppe(ouverts).map(g =>
      groupe(`t-${g.id}`, trad(g.label), '', g.comptes.map(c => ligneCompte(c)).join(''),
             g.total, '', teinteDominante(g.comptes))).join(''));
  }

  return `
  ${barreCommutateur([
    ['banque', 'Comptes et avoirs'], ['type', 'Type'],
  ], compteVue, 'compte-vue', 'vue')}

  ${sansCompte && !filtre ? '' : `<dl class="kv cpt-resume">
    <dt>${BASES.avoirs.nom}${aide(trad("La somme des comptes ouverts de cette page. Le même nombre que sur l’accueil : si les deux diffèrent, c’est qu’un compte est archivé ou qu’un montant vient d’être corrigé."))}</dt><dd>${fmtEUR(pat.brut)}</dd>
    ${pat.dettes ? `
    <dt>${trad('Crédits en cours')}${aide(trad("Le capital qu’il te reste à rembourser. Les comptes archivés ne comptent pas."))}</dt>
      <dd class="dette">−${fmtEUR(pat.dettes)}</dd>
    <dt><b>${trad('Patrimoine net')}</b></dt><dd><b>${fmtEUR(pat.net)}</b></dd>` : ''}
  </dl>`}

  ${sansCompte || filtre ? '' : carteValeursARevoir()}

  ${sansCompte && !filtre ? '' : `<div class="card" style="padding:12px 16px">
    <div class="row" style="gap:10px">
      <input id="chercheCompte" type="search" placeholder="${trad('Rechercher…')}" value="${esc(compteRecherche)}"
             style="max-width:12em; text-align:left" aria-label="${trad('Rechercher un compte ou un placement')}">
      <span class="spacer"></span>
      ${groupesRendus.length > 1 ? `<button class="btn sm ghost" data-action="plier-tout"
        title="${groupesRendus.every(c => compteReplies.has(c))
          ? trad('Rouvrir tous les groupes') : trad('Ne garder que les totaux')}"
        >${groupesRendus.every(c => compteReplies.has(c)) ? trad('Tout déplier') : trad('Tout replier')}</button>` : ''}
      <button class="btn sm" data-action="ajouter-compte">${trad('+ Ajouter')}</button>
    </div>
  </div>`}

  <div class="cpt-liste">${corps}</div>
  ${sansCompte && !filtre ? '' : carteInsights('accounts', 'À retenir')}

  ${(() => {
    const anciens = comptesAnciens();
    const vus = [...anciens.archives.filter(x => x.compte && correspondAuCompte(x.compte)),
                 ...anciens.clos.filter(x => correspond(x.label) || correspond(x.etab))];
    if (!vus.length) return '';
    /* Aucun montant sur un compte archivé, ni ici ni dans sa fiche.

       Le total du groupe affichait « 0,00 € », et c'était pire qu'un vide :
       `valeurCompte` rend zéro sur un compte sorti des totaux, donc le chiffre
       ne disait pas ce que le compte contient — il disait ce qu'il pèse, c'est
       à dire rien. « Compte archivé, il n'y a pas de montant, enlever tout
       montant y compris dans la fiche. Là c'est écrit 0. »

       Un zéro affiché se lit comme un solde. Le sous-titre dit déjà que ces
       comptes sont hors totaux ; il n'y a pas de somme à en tirer. */
    return (sectionsAffichees ? titreSection('Archivés', 'hors de tous les totaux') : '')
      + `
    <section class="cpt-groupe" style="--teinte:${teinteGroupe()}">
      <div class="cpt-gtitre">
        <button type="button" class="cpt-gplier" data-action="goto"
                data-view="comptes-archives" data-anchor="">
          <span class="cpt-pastille" aria-hidden="true"></span>
          <span class="cpt-gnom">${trad('Comptes archivés')}<span class="sub">${
            trad('hors totaux, conservés pour l’historique')}</span></span>
          <span class="cpt-gtotal">${vus.length}</span>
          <span class="cpt-chev">›</span>
        </button>
      </div>
    </section>`;
  })()}`;
}

/* --- les comptes qui ne comptent plus -----------------------------------

   Ils avaient deux domiciles : un groupe repliable au bas d'Actifs, qui les
   MONTRAIT, et une carte de Donnees, qui les GERAIT. Un seul sujet, deux
   endroits, et le second range parmi les diagnostics.

   Ici, une ligne par compte, jamais une carte par compte : douze cartes
   empilees sur 375 px font une page qu'on ne parcourt plus, et l'action se perd
   dans le cadre. Le nom a gauche, l'etablissement dessous en gris, l'action a
   droite, un filet entre deux lignes.

   Le chevron de l'en-tete remonte a Actifs sans qu'on l'ecrive ici : la cle de
   vue est `accounts`, et le registre en tire le retour, comme pour les fiches.
   Le bouton en tete de page fait le meme trajet, pour le pouce. */
function viewComptesArchives() {
  const { archives, clos } = comptesAnciens();

  /* UN ETAT, UNE ACTION.

     La poubelle se posait sur toutes les lignes, et la restauration seulement
     sur celles qui l'acceptent : un compte archive portait donc les deux. Or
     « Restaurer » a cote d'une poubelle demande de choisir entre garder et
     detruire au meme endroit, sur un compte qu'on a justement mis de cote pour
     le garder. Les deux etats cessent de se distinguer des qu'ils partagent
     leurs gestes.

     Le partage se fait sur `restaurable`, la donnee du modele — jamais sur le
     titre de la section, qui est un intitule et non un etat.

     La poubelle porte un nom lisible a la voix : « Supprimer » seul, repete
     douze fois, ne dit pas lequel des douze. */
  const motif = x => {
    const c = x.compte;
    const vers = c?.archiveMotif === 'transfert' && c.archiveVers && compteById(c.archiveVers);
    const m = MOTIFS_ARCHIVE.find(([k]) => k === c?.archiveMotif);
    return [vers ? `${trad('Transféré vers')} ${guill(nomCompteV2(vers))}` : m ? trad(m[1]) : '',
            c?.clotureLe ? `${trad('au')} ${fmtDate(c.clotureLe)}` : ''].filter(Boolean).join(' ');
  };
  const titres = new Map(archivesAvecTitres().map(a => [a.compte.id, a]));
  const ligne = x => `
      <div class="arch-ligne">
        <span class="arch-nom"><b>${esc(x.label)}</b>${
          x.etab || motif(x) ? `<span class="sub">${esc([x.etab, motif(x)].filter(Boolean).join(' · '))}</span>` : ''}${
          titres.has(x.id) ? `<span class="sub">${trad(titres.get(x.id).lignes.length > 1
            ? '{k} lignes de titres · {v}' : '{k} ligne de titres · {v}')
            .replace('{k}', titres.get(x.id).lignes.length).replace('{v}', fmtEUR0(titres.get(x.id).valeur))}</span>` : ''}</span>
        <span class="arch-actes">
          ${titres.has(x.id) ? `<button class="btn sm arch-agir" data-action="resoudre-titres-archives"
                data-id="${esc(x.id)}">${trad('Résoudre')}</button>` : ''}
          ${x.restaurable ? `<button class="btn sm ghost arch-agir" data-action="restaurer-compte"
                data-id="${esc(x.id)}">${trad('Restaurer')}</button>`
            : `<button class="btn icon arch-jeter arch-agir" data-action="supprimer-compte-clos"
                data-id="${esc(x.id)}" title="${trad('Supprimer définitivement')}"
                aria-label="${esc(trad('Supprimer définitivement {n}').replace('{n}', x.label))}">🗑</button>`}
        </span>
      </div>`;

  const section = (titre, sous, liste) => !liste.length ? '' : `
  <div class="card">
    <div class="card-head"><h2>${trad(titre)}</h2>
      <span class="hint">${liste.length}</span></div>
    <p class="small muted" style="margin:0 0 4px">${trad(sous)}</p>
    <div class="arch-liste">${liste.map(ligne).join('')}</div>
  </div>`;

  return `
  <button type="button" class="btn sm ghost retour-page" data-action="goto" data-view="accounts" data-anchor="">‹ ${trad('Actifs')}</button>

  <h3 class="cpt-section arch-titre">${trad('Comptes archivés')}<span class="sub">${
    trad('hors de tous les totaux, conservés pour l’historique')}</span></h3>
  ${archives.length || clos.length ? '' : `<div class="card"><p class="empty">${
    trad('Les comptes que tu clôtures se rangeront ici.')}</p></div>`}
  ${section('Archivés',
    'Ils gardent leur fiche et tout ce qu’ils portaient. Les restaurer les remet dans tes totaux.',
    archives)}
  ${section('Clos',
    'D’un ancien format, sans fiche à rouvrir : ils n’existent plus que comme un nom dans d’anciens relevés.',
    clos)}`;
}

function mountAccounts() {
  const cherche = $('#chercheCompte');
  if (cherche) {
    cherche.addEventListener('input', () => {
      compteRecherche = cherche.value;
      const pos = cherche.selectionStart;
      render();
      const encore = $('#chercheCompte');
      if (encore) { encore.focus(); encore.setSelectionRange(pos, pos); }
    });
  }
  monteSwipeComptes();
}

const estBien = t => !!t.bienImmo;

/* Les crédits qui financent ce compte. Le modèle les range sur l'établissement
   qui porte le bien — c'est là que la valeur nette se lit — donc on remonte à
   lui, avec les index dont `data-path` a besoin pour les rendre modifiables. */
function creditsDuCompte(c) {
  const idxEtab = ETABS().findIndex(e => e.id === c.etabId);
  const etab = ETABS()[idxEtab];
  if (!etab) return { idxEtab: -1, etab: null, dettes: [], total: 0 };
  /* Les credits de CE bien, pas ceux de l'etablissement : deux biens chez la
     meme banque se partageaient chaque credit. Le rang, lui, reste celui du
     tableau des dettes de l'etablissement — c'est par lui qu'on ecrit, et un
     rang pris dans la liste filtree modifierait le credit du voisin.
     Comparaison par identite plutot que par `id` : un credit d'un etat ancien
     peut ne pas en porter. */
  const miens = new Set(creditsDuBien(c));
  const dettes = (etab.dettes || []).map((d, i) => ({ d, i }))
    .filter(({ d }) => miens.has(d));
  return { idxEtab, etab, dettes, total: dettes.reduce((s, x) => s + num(x.d.montant), 0) };
}

/* L'invite d'un premier pas : un bouton, et la phrase qui dit pourquoi.

   La forme vient de la carte des flux, qui portait deja « Déclarer tes revenus »
   suivi d'une ligne d'explication. Elle est reprise telle quelle plutot
   qu'inventee a cote : trois invites de trois formes differentes auraient donne
   trois apprentissages au lieu d'un.

   Le texte et l'action viennent de `PREMIERS_PAS`, pas de l'appelant : les
   ecrans vides de cette application se sont deja contredits pour avoir ete
   ecrits chacun de son cote. */
/* LE CHEMIN EN ENTIER, ET NON SEULEMENT LE PAS SUIVANT.

   Chaque ecran dit deja ce qui lui manque, et cette guidance-la reste : un
   ecran qui ne peut rien montrer doit dire ce qui le remplirait. Mais elle ne
   dit que pourquoi une page est vide, jamais par ou commencer ni combien il y a
   d'etapes. Quelqu'un qui arrive voit une carte et sept entrees de menu toutes
   vides : il n'a aucune carte du territoire.

   Cette carte-ci montre les quatre pas d'un coup, dit lequel est fait, et
   n'ouvre QUE le premier qui reste. Quatre paragraphes cote a cote feraient un
   mur ; la liste donne la carte, le pas courant donne la consigne.

   Elle se derive de `PREMIERS_PAS` et ne recopie rien : des ecrans vides ecrits
   chacun de son cote finissent par se contredire. Et elle disparait
   entierement des que tout est fait, sans que rien ne l'eteigne. */
let pasDeplie = null;
let guideDeplie = false;

/* LE RENVOI SUIT CE QU'IL Y A A VOIR, PAS LA BRANCHE QUI L'AFFICHE.

   Il n'a d'abord existe que sous la question « as-tu tout mis ? ». Or un pas
   franchi qu'on rouvre pour verifier montre sa consigne et son bouton d'ajout,
   dans l'AUTRE branche du rendu : il perdait donc le seul chemin vers la liste
   au moment precis ou l'on venait la relire. Deux branches, un seul besoin.

   La condition est desormais la meme des deux cotes, et c'est la bonne : des
   qu'un premier element existe, il y a quelque chose a regarder. Tant qu'il n'y
   en a aucun, la liste serait vide et le lien n'apprendrait rien — c'est
   exactement la question a laquelle `pasAFaire` repond deja, on ne lui en
   ecrit pas une seconde.

   Deux formes, une seule intention : une VUE quand la liste est une page, une
   ACTION quand elle est une fenetre qui liste et ajoute a la fois. */
function renvoiPas(p) {
  const v = p.declare && p.declare.voir;
  if (!v || pasAFaire(p.cle)) return '';
  const ou = v.vue ? `data-action="goto" data-view="${esc(v.vue)}" data-anchor=""`
                   : `data-action="${esc(v.action)}"`;
  return `
          <button type="button" class="lien-nu pas-voir" ${ou}>${trad(v.libelle)}</button>`;
}

function carteBienvenue({ faits, total, premier, acquis }) {
  const exemple = typeof SEED_VERSION !== 'undefined' && typeof modeDemo === 'function' && !modeDemo();
  return `
  <section class="card bienvenue">
    <p class="surtitre">${trad('Bienvenue dans Longward')}</p>
    <h2 class="bienvenue-accroche">${trad('Tout ton patrimoine. Une seule trajectoire.')}</h2>
    <p class="bienvenue-texte">${trad('Construis ton tableau de bord personnel en quelques minutes.')}</p>
    <ol class="bienvenue-pas" aria-label="${trad('{n} sur {t}').replace('{n}', faits).replace('{t}', total)}">
      ${PREMIERS_PAS.map(p => `
      <li class="${acquis(p) ? 'fait' : ''}${premier && p.cle === premier.cle ? ' courant' : ''}">
        <span class="bienvenue-point" aria-hidden="true"></span>${esc(motCourtPas(p))}</li>`).join('')}
    </ol>
    <div class="bienvenue-actes">
      ${premier ? `<button type="button" class="btn" data-action="${esc(premier.action)}">${trad('Construire mon Longward')}</button>` : ''}
      ${exemple ? `<button type="button" class="btn ghost" data-action="charger-demo">${trad('Voir un exemple')}</button>` : ''}
    </div>
  </section>`;
}

/* UN APERCU VERROUILLE : ce que la page montrera, sans rien inventer. Un titre,
   une phrase qui dit quelle donnee le debloque, et une silhouette — des traits,
   pas des chiffres. Aucun montant, aucun pourcentage, aucune courbe pretendument
   calculee : une donnee inconnue reste inconnue. La carte disparait avec
   l'accueil vierge, des le premier compte, remplacee par les vraies cartes et
   leurs propres etats vides. Le premier apercu, le patrimoine net, est marque
   `principal` : c'est la premiere valeur qui apparaitra, et la feuille de style
   le dit d'un filet et d'un fond a peine releves, sans changer sa taille. */
const SILHOUETTES = {
  barre:  '<rect x="0" y="4" width="64" height="10" rx="3"/><rect x="0" y="24" width="120" height="7" rx="3" opacity=".55"/>',
  anneau: '<circle cx="18" cy="18" r="13" fill="none" stroke-width="5" stroke-dasharray="26 56" opacity=".9"/><rect x="44" y="9" width="60" height="6" rx="3" opacity=".55"/><rect x="44" y="22" width="40" height="6" rx="3" opacity=".35"/>',
  jauge:  '<rect x="0" y="6" width="120" height="7" rx="3" opacity=".35"/><rect x="0" y="6" width="58" height="7" rx="3"/><rect x="0" y="23" width="120" height="7" rx="3" opacity=".35"/><rect x="0" y="23" width="88" height="7" rx="3" opacity=".7"/>',
  courbe: '<path d="M0 31 C 24 30, 48 25, 72 17 S 104 8, 120 5" fill="none" stroke-width="2" stroke-dasharray="3 4"/>',
};
function apercuVerrou(titre, sous, forme, principal) {
  return `
    <div class="card apercu-verrou${principal ? ' principal' : ''}">
      <svg class="silhouette" viewBox="0 0 120 36" aria-hidden="true" focusable="false">${SILHOUETTES[forme] || ''}</svg>
      <b>${esc(titre)}</b>
      <span class="sub">${esc(sous)}</span>
    </div>`;
}

function carteDemarrage() {
  /* `acquis` quand il existe, `fait` sinon : voir la note du pas des releves.
     La liste demande si un pas est FRANCHI, pas s'il faut encore le reclamer,
     et les deux divergent la ou un pas depend d'un autre. */
  const acquis = p => (pasDeplie === p.cle && p.declare ? false
    : p.acquis ? p.acquis() : (!pasAFaire(p.cle) && pasDeclare(p)));
  if (demarrageMasque() || demarrageDepasse()) return '';
  const restants = PREMIERS_PAS.filter(p => !acquis(p));
  const fini = !restants.length;
  const premier = fini ? null : (restants.find(p => !p.ouvrable || p.ouvrable()) || restants[0]);
  const faits = PREMIERS_PAS.length - restants.length;
  const vierge = !aUnComptePropre();
  if (vierge) return carteBienvenue({ faits, total: PREMIERS_PAS.length, premier, acquis });
  if (!vierge && !fini && !guideDeplie) {
    return `
  <div class="card demarrage demarrage-barre card-cliquable">
    <button type="button" class="card-couvre" data-action="basculer-demarrage"
            aria-expanded="false" aria-label="${trad('Ton Longward prend forme')}"></button>
    <span class="demarrage-texte"><b>${trad('Ton Longward prend forme')}</b>
      <span class="sub">${faits ? `${trad('{n} sur {t}').replace('{n}', faits).replace('{t}', PREMIERS_PAS.length)} · ` : ''}${
        premier ? `${trad('Prochaine étape')}${deuxPoints()} ${esc(motProchainPas(premier))}` : ''}</span></span>
    <span class="demarrage-chevron" aria-hidden="true">›</span>
  </div>`;
  }
  if (fini) {
    return `
  <div class="card demarrage demarrage-barre demarrage-fini">
    <b>✓ ${trad('Tout est en place')}</b>
    <span class="muted">·</span>
    <button type="button" class="lien-nu" data-action="fermer-demarrage">${trad('Refermer')}</button>
  </div>`;
  }
  return `
  <div class="card demarrage">
    <div class="card-head">
      <h2>${trad('Commence ici')}</h2>
      <span class="muted">${faits ? `${trad('{n} sur {t}').replace('{n}', faits).replace('{t}', PREMIERS_PAS.length)} · ` : ''}${
        vierge ? '' : `<button type="button" class="lien-nu" data-action="basculer-demarrage">${trad('Replier')}</button>`}</span>
    </div>
    <ol class="pas-liste">
      ${PREMIERS_PAS.map((p, i) => {
        const fait = acquis(p);
        const courant = !!premier && p.cle === premier.cle;
        return `
      <li class="pas${fait ? ' fait' : ''}${courant ? ' courant' : ''}">
        <span class="pas-marque">${fait ? '✓' : i + 1}</span>
        <div class="pas-corps">
          ${!fait ? `<b>${
            trad(courant && p.declare && !pasAFaire(p.cle) ? p.declare.question : p.titre)}</b>` : `
          <button type="button" class="pas-retour" data-action="deplier-pas" data-cle="${esc(p.cle)}">
            <b>${trad(p.titre)}</b>
            <span class="pas-modifier">${trad(pasDeplie === p.cle ? 'Fermer' : 'Modifier')}</span>
          </button>`}
          ${!(courant || pasDeplie === p.cle) ? '' : (
          courant && p.declare && !pasAFaire(p.cle) ? `
          <p class="small muted">${trad(p.declare.detail)}</p>
          <span class="pas-actes">
            <button type="button" class="btn sm" data-action="declarer-pas"
                    data-cle="${esc(p.declare.cle)}">${trad(p.declare.oui)}</button>
            <button type="button" class="btn sm ghost" data-action="${esc(p.action)}">${trad(p.declare.ajouter)}</button>
          </span>${renvoiPas(p)}` : `
          <p class="small muted">${trad(p.quoi)}</p>
          <span class="pas-actes">
            <button type="button" class="btn sm" data-action="${esc(p.action)}">${trad(p.bouton)}</button>
          </span>${renvoiPas(p)}`)}
        </div>
      </li>`;
      }).join('')}
    </ol>
  </div>`;
}

/* `secondaire` : le meme bouton, en fantome. Une page vierge ne porte qu'une
   action pleine ; quand deux invites se suivent — les depenses puis les
   revenus, sur Budget — la seconde le dit par sa forme. */
function invitePremierPas(cle, { secondaire = false } = {}) {
  const p = PAS_PAR_CLE[cle];
  if (!p || !pasAFaire(cle)) return '';
  return `
      <button type="button" class="btn sm${secondaire ? ' ghost' : ''}" data-action="${esc(p.action)}"
              style="margin:4px 0 0">${trad(p.bouton)}</button>
      <p class="small muted" style="margin:12px 0 0">${trad(p.quoi)}</p>`;
}

function pageAvantDonnees(phrase, cle = 'comptes') {
  return `
  <div class="card">
    <p class="empty" style="margin:0 0 4px">${trad(phrase)}</p>
    ${invitePremierPas(cle)}
  </div>`;
}

function reglagesExploitation(c, idx) {
  return `
    <p class="sous-titre-carte" style="margin-top:12px">${trad('Paramètres locatifs')}</p>
    <div class="grid g-3">
      <div class="field"><label>${trad('Mois loués par an')}${aide(trad("Douze si le locataire ne part jamais. Un mois de vacance entre deux baux coûte 8 % du loyer annuel, et le rendement calculé sur douze mois pleins ne le voit pas."))}</label>
        <input type="number" step="1" min="0" max="12" class="champ-large"
               data-path="comptes.${idx}.moisLoues" value="${estDeclare(c.moisLoues) ? num(c.moisLoues) : ''}"
               placeholder="12"></div>
      <div class="field"><label>${trad('Fiscalité estimée ({dev} / an)')}${aide(trad("Ce que ce bien te coûte en impôt sur une année, tel que tu le lis sur ta déclaration. L'application ne modélise aucun régime : micro-foncier, réel, meublé, SCI, les règles changent et une estimation automatique finirait par mentir. Laisse vide tant que tu ne le sais pas : la carte écrira « non estimée » plutôt qu'un zéro qui passerait pour un calcul."))}</label>
        <input type="number" step="1" min="0" class="champ-large"
               data-path="comptes.${idx}.fiscaliteEstimeeAnnuelle"
               value="${estDeclare(c.fiscaliteEstimeeAnnuelle) ? num(c.fiscaliteEstimeeAnnuelle) : ''}"
               placeholder="${trad('facultatif')}"></div>
      ${!(num(c.tauxImpot) > 0) ? '' : `
      <div class="field"><label>${trad('Impôt sur ce loyer (%)')}${aide(trad("Une estimation simplifiée, saisie avant que le montant annuel existe : ton taux appliqué au loyer moins les charges. Le montant annuel, au-dessus, la remplace dès qu'il est renseigné. Vide ce champ pour ne plus la voir."))}</label>
        <input type="number" step="0.1" min="0" max="100" class="champ-large"
               data-path="comptes.${idx}.tauxImpot" value="${num(c.tauxImpot) || ''}"
               placeholder="${trad('facultatif')}"></div>`}
    </div>`;
}

const periodeDite = p => p !== 'mois' ? trad(CHARGE_PERIODE_LABEL[p]) : '';

/* Les deux boutons d'un placement immobilier.

   Une fonction a part plutot qu'un parametre de plus sur `boutonsRattachement` :
   les deux mondes ne proposent pas les memes gestes, et un helper qui prend le
   libelle du revenu, celui de la charge et le mode devient plus long a lire que
   les six lignes qu'il economise.

   « Frais » et non « Charge » : le mot du bouton decide de ce qu'on croit devoir
   saisir, et la liste qu'il ouvre ne connait aucun poste de logement. */
function boutonsPierrePapier(c) {
  return `
      <button class="btn sm ghost" data-action="ajouter-loyer" data-id="${esc(c.id)}"
              title="${trad('Créer un revenu déjà rattaché à ce bien')}">+ ${
        trad('Distribution')}</button>
      <button class="btn sm ghost" data-action="ajouter-charge-bien" data-id="${esc(c.id)}"
              title="${esc(chargesProposees(c).map(([l]) => trad(l)).join(', '))}">${
        trad('+ Frais')}</button>`;
}

function boutonsRattachement(c, usage) {
  return `
      ${usage !== 'locative' ? '' : `<button class="btn sm ghost" data-action="ajouter-loyer" data-id="${esc(c.id)}"
              title="${trad('Créer un revenu déjà rattaché à ce bien')}">+ ${trad('Loyer')}</button>`}
      <button class="btn sm ghost" data-action="ajouter-charge-bien" data-id="${esc(c.id)}"
              title="${esc(chargesProposees(c).map(([l]) => trad(l)).join(', '))}">${trad('+ Charge')}</button>`;
}

/* Une ligne de montant, avec la porte vers sa source.

   Le nom porte l'action plutot qu'un crayon a cote : c'est le nom qu'on lit et
   qu'on veut corriger, et un second element a viser sur un telephone est un
   second element a manquer. `.lien-nu` existe pour ca — un vrai bouton, puisque
   ce n'est pas une navigation, qui n'en garde que le souligne.

   Un montant qui s'affiche sans porte pour le corriger oblige a chercher sa
   source ailleurs, et rien a l'ecran ne dit ou : le loyer vit dans les revenus
   du budget, la taxe fonciere dans les charges fixes, la mensualite chez le
   preteur.

   `signe: 0` pour une sortie qu'il n'y a pas a juger. La mensualite d'une
   residence principale n'est pas une perte, c'est le prix du logement : la
   peindre en rouge moraliserait une depense choisie. La couleur reste pour ce
   qui a un sens — un cash-flow, un gain, une alerte. */
function ligneSource({ nom, montant, signe, action, donnees, sub = '', aideTxt = '' }) {
  const attrs = Object.entries(donnees).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(' ');
  const teinte = signe > 0 ? 'up' : signe < 0 ? 'dette' : '';
  const devant = signe > 0 ? '+' : signe < 0 ? '−' : '';
  return `
      <dt><button type="button" class="lien-nu" data-action="${esc(action)}" ${attrs}
                  title="${trad('Modifier ou supprimer')}">${esc(nom)}</button>${aideTxt ? aide(aideTxt) : ''}
        ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</dt>
        <dd class="${teinte}">${devant}${fmtEUR(Math.abs(montant))} ${trad('/ mois')}</dd>`;
}

/* `aideSuite` arrive DEJA TRADUITE, et c'est la raison de son existence :
   concatener deux phrases avant `trad()` ferait chercher une clef qui n'existe
   pas, et l'anglais afficherait du francais. */
function ligneTotal({ nom, montant, signe, aideTxt, sub = '', aideSuite = '' }) {
  const teinte = signe > 0 ? 'up' : signe < 0 ? 'dette' : '';
  const devant = signe > 0 ? '+' : signe < 0 ? '−' : '';
  return `
      <dt>${trad(nom)}${aide(trad(aideTxt) + (aideSuite ? ` ${aideSuite}` : ''))}${sub ? `
        <span class="sub">${sub}</span>` : ''}</dt>
        <dd class="${teinte}">${devant}${fmtEUR(Math.abs(montant))} ${trad('/ mois')}</dd>`;
}

function ligneCharges(cf, signe, nom = 'Charges propriétaire') {
  if (!cf.postesCharge.length) return '';
  if (cf.postesCharge.length === 1) {
    const p = cf.postesCharge[0];
    return ligneSource({ nom: p.label, montant: p.mensuel, signe,
      action: 'edit-charge', donnees: { i: p.i },
      sub: p.periode !== 'mois' ? `${fmtEUR0(p.montant)} ${periodeDite(p.periode)}` : '' });
  }
  return ligneTotal({ nom, montant: cf.charges, signe,
    aideTxt: 'Le total des charges rattachées à ce bien. Chacune se corrige dans le budget, où elle porte son nom.',
    sub: trad('{n} charges').replace('{n}', cf.postesCharge.length) });
}

function ligneMensualite(cf, signe) {
  const avec = cf.creditsListe.filter(x => x.mensualite > 0.005);
  if (!avec.length) return '';
  const total = avec.reduce((s, x) => s + x.mensualite, 0);
  if (avec.length > 1)
    return ligneTotal({ nom: 'Mensualités', montant: total, signe,
      aideTxt: 'Le total des mensualités des crédits rattachés à ce bien. Chaque prêt se lit séparément dans « Financement », plus bas.',
      sub: trad('{n} crédits').replace('{n}', avec.length) });
  const x = avec[0];
  return ligneSource({ nom: trad('Mensualité'), montant: total, signe,
    action: x.chargeIndex != null ? 'edit-charge' : 'editer-credit',
    donnees: x.chargeIndex != null ? { i: x.chargeIndex } : { etab: x.etabId, i: x.index } });
}

function blocCapitalRembourse(co) {
  /* `== null` et non une simple verite JS : ZERO EST UNE REPONSE ici.

     Un credit dont la mensualite ne couvre meme pas ses interets ne rembourse
     rien du tout — c'est le levier d'un courtier, ou un differe — et c'est
     precisement ce qu'il faut dire. Faire disparaitre le bloc laissait croire
     que la question ne se posait pas, alors que la reponse etait connue et
     valait zero. Inconnu et nul ne se confondent pas. */
  if (co.capitalMois == null) return '';
  const nul = co.capitalMois < 0.005;
  return `
    <dl class="kv" style="margin-top:12px">
      <dt><b>${trad('Capital remboursé ce mois')}</b></dt>
        <dd class="${nul ? '' : 'up'}"><b>${nul ? fmtEUR(0) : `+${fmtEUR(co.capitalMois)}`}</b></dd>
      ${/* A zero, le cout hors capital vaut le total paye, deja affiche juste
            au-dessus : une ligne de plus qui ne dit rien de plus. */
        nul || co.horsCapital == null ? '' : `<dt>${trad('Coût hors remboursement de capital')}${
        aide(trad('Ce que ce mois te coûte vraiment : tout ce qui sort du compte, moins la part qui rembourse du capital. C’est le total payé diminué de la ligne au-dessus.'))}${
        (() => {
          const i = co.interetsMois, a = co.assuranceMois;
          if (!i && !a) return '';
          const txt = a > 0.005
            ? trad('dont {i} d’intérêts et {a} d’assurance')
                .replace('{i}', fmtEUR0(i)).replace('{a}', fmtEUR0(a))
            : trad('dont {i} d’intérêts').replace('{i}', fmtEUR0(i));
          return `
        <span class="sub">${txt}</span>`;
        })()}</dt>
        <dd>${fmtEUR(co.horsCapital)}</dd>`}
    </dl>
    <p class="hint" style="margin:8px 0 0">${nul
      ? trad('La mensualité actuelle ne réduit pas le capital : elle ne couvre que les '
        + 'intérêts et l’assurance. La dette ne baissera pas tant que ce sera le cas.')
      : trad('Cette somme réduit ta dette et augmente ton patrimoine net. '
        + 'Elle ne rentre sur aucun compte : elle ne fait pas partie de ce que tu peux '
        + 'dépenser.')}</p>`;
}

function noteVentilation(co) {
  if (!co.nbCredits || co.ventilation === 'complete') return '';
  return `<p class="hint" style="margin:8px 0 0">${co.ventilation === 'aucune'
    ? trad('Renseigne le taux du crédit pour distinguer capital et intérêts.')
    : trad('{n} crédit sur {t} n’a pas de taux renseigné : la part de capital ci-dessus ne compte que les autres.')
        .replace('{n}', co.nbCredits - co.nbVentiles).replace('{t}', co.nbCredits)}</p>`;
}

function ligneRendement({ nom, valeur, aideTxt = '', sub = '' }) {
  const inconnu = valeur == null;
  return `
      <dt>${trad(nom)}${aideTxt ? aide(trad(aideTxt)) : ''}${sub && !inconnu ? `
        <span class="sub">${sub}</span>` : ''}</dt>
        <dd>${inconnu ? `<span class="muted">${trad('Base à renseigner')}</span>`
                      : fmtPct(valeur, 2)}</dd>`;
}

function carteResidence(c, idx, cf, usage) {
  const co = coutBien(c);
  const revenus = cf.loyersPleins;
  const titre = usage === 'principale' ? 'Coût mensuel du logement' : 'Coût mensuel du bien';
  const tete = `
    <div class="card-head"><h2>${trad(titre)}</h2>
      <span class="hint">${esc(trad(USAGE_BIEN_LABEL[usage]).toLowerCase())}</span>
      ${boutonsRattachement(c, usage)}</div>`;
  if (co.totalSorties < 0.005 && revenus < 0.005) return `
  <div class="card">
    ${tete}
    <p class="empty" style="margin:0">${trad('Aucune charge ni crédit rattaché à ce bien. '
      + '« + Charge » en crée une déjà rattachée : taxe foncière, assurance, copropriété. '
      + 'Le crédit se déclare dans « Financement », juste en dessous. Le coût mensuel se '
      + 'calcule alors tout seul.')}</p>
  </div>`;
  return `
  <div class="card">
    ${tete}
    <dl class="kv">
      <dt><b>${trad('À ta charge')}</b>${aide(trad('Ce que ce bien fait sortir de ton compte chaque mois : la mensualité des crédits rattachés, plus les charges que tu paies en tant que propriétaire.'))}</dt>
        <dd><b>${fmtEUR(co.totalSorties)} ${trad('/ mois')}</b></dd>
      ${ligneMensualite(cf, 0)}
      ${/* « Autres charges » et non « Charges proprietaire » : sur un logement
            qu'on habite, le mot designe un statut qui n'apprend rien — on est
            proprietaire de tout ce qui est sur cette fiche. Il garde son sens
            sur un locatif, ou il distingue ce qui reste au bailleur de ce que
            le locataire rembourse. */ ''}
      ${ligneCharges(cf, 0, 'Autres charges')}
    </dl>
    ${blocCapitalRembourse(co)}
    ${noteVentilation(co)}
    ${revenus < 0.005 ? '' : `
    <dl class="kv" style="margin-top:12px">
      ${cf.sourcesLoyer.length === 1 ? ligneSource({
        nom: trad('Revenus liés au bien'), montant: revenus, signe: 1,
        action: 'edit-income', donnees: { i: cf.sourcesLoyer[0].i },
      }) : ligneTotal({ nom: 'Revenus liés au bien', montant: revenus, signe: 1,
        aideTxt: 'Des revenus sont rattachés à ce bien, que tu as déclaré habité. Ce peut être parfaitement volontaire : une chambre louée, une location saisonnière. La fiche ne le requalifie pas pour autant.' })}
    </dl>`}
  </div>`;
}

function carteLocatif(c, idx, cf) {
  const co = coutBien(c);
  const loue = cf.loyersPleins > 0.005;
  const baseDite = cf.surAchat ? trad('le prix payé') : trad('la valeur actuelle');
  if (!loue) return `
  <div class="card">
    <div class="card-head"><h2>${trad('Performance locative')}</h2>
      ${boutonsRattachement(c, 'locative')}</div>
    <div class="empty">
      <p style="margin:0 0 12px">${trad('Aucun loyer renseigné.')} ${co.totalSorties < 0.005
        ? trad('Ce bien est déclaré mis en location : ajoute le loyer pour voir son cash-flow et son rendement.')
        : trad('Ce bien est déclaré mis en location et coûte déjà {v} par mois. Ajoute le loyer pour voir son cash-flow et son rendement.')
            .replace('{v}', fmtEUR0(co.totalSorties))}</p>
      <button class="btn sm" data-action="ajouter-loyer" data-id="${esc(c.id)}">${
        trad('+ Ajouter un loyer')}</button>
    </div>
    ${blocCapitalRembourse(co)}
  </div>`;
  return `
  <div class="card">
    <div class="card-head"><h2>${trad('Performance locative')}</h2>
      <span class="hint">${fmtEUR0(cf.loyersPleins)} ${trad('de loyer par mois')}</span>
      ${boutonsRattachement(c, 'locative')}</div>
    <dl class="kv">
      ${lignesDuMois(cf)}
      <dt><b>${cf.fiscalite.source === 'inconnue'
        ? trad('Cash-flow avant fiscalité') : trad('Cash-flow après fiscalité')}</b>${aide(trad("Ce qui reste sur ton compte en fin de mois, une fois le crédit payé. La somme des lignes au-dessus, chacune ouvrable par son nom. Négatif les premières années d’un crédit, c’est fréquent et ce n’est pas une erreur : tu rembourses du capital, donc ton patrimoine monte pendant que ta trésorerie baisse. Les deux chiffres sont vrais."))}</dt>
        <dd class="${cls(cf.cashFlow)}"><b>${fmtSigned(cf.cashFlow)} ${trad('/ mois')}</b></dd>
    </dl>
    ${blocCapitalRembourse(co)}
    ${noteVentilation(co)}
    <dl class="kv" style="margin-top:12px">
      ${ligneRendement({ nom: 'Rendement brut', valeur: cf.rendementBrut,
        aideTxt: 'Loyer annuel rapporté à la base indiquée. C’est la convention du marché : un rendement calculé sur une estimation du jour n’est pas le même chiffre, et il baisse quand le bien prend de la valeur.',
        sub: `${trad('sur')} ${baseDite}, ${fmtEUR0(cf.base)}` })}
      ${!cf.charges ? '' : ligneRendement({ nom: 'Rendement net de charges',
        valeur: cf.rendementNet })}
      ${/* TROIS RENDEMENTS, ET PAS UN DE PLUS.

            Le rendement sur apport a quitte cette carte. Il etait juste, et il
            reste calcule par le modele — mais quatre pourcentages sous une
            cascade de sept lignes font une carte qu'on ne parcourt plus, et
            celui-la repondait a une question d'INVESTISSEUR quand les trois
            autres decrivent le bien. L'apport se lit dans « Financement », ou il
            se saisit.

            L'aide du troisieme est partie aussi : elle decrivait un taux
            applique au loyer moins les charges, ce qui n'est plus vrai depuis
            que la fiscalite peut etre un montant annuel declare — et la ligne
            « Fiscalite estimee » de la cascade porte deja ce concept, une fois,
            au bon endroit. */ ''}
      ${cf.rendementNetNet == null ? '' : ligneRendement({
        nom: 'Rendement après fiscalité', valeur: cf.rendementNetNet })}
    </dl>
    ${reglagesExploitation(c, idx)}
  </div>`;
}

function lignesDuMois(cf) {
  const vacance = cf.vacanceEuros > 0.005;
  const unSeul = cf.sourcesLoyer.length === 1;
  return [
    ...(!vacance ? cf.sourcesLoyer.map(s => ligneSource({
      nom: s.label, montant: s.mensuel, signe: 1,
      action: 'edit-income', donnees: { i: s.i },
      sub: [s.periode !== 'mois' ? `${fmtEUR0(s.montant)} ${periodeDite(s.periode)}` : '',
            s.estime ? trad('estimé') : ''].filter(Boolean).join(' · '),
    })) : [
      unSeul ? ligneSource({ nom: trad('Loyer potentiel'), montant: cf.loyersPleins, signe: 1,
        action: 'edit-income', donnees: { i: cf.sourcesLoyer[0].i } })
        : ligneTotal({ nom: 'Loyer potentiel', montant: cf.loyersPleins, signe: 1,
            aideTxt: 'Ce que le bien rapporterait loué douze mois sur douze. Chaque loyer se corrige dans le budget, où il porte son nom.' }),
      `
      <dt>${trad('Vacance moyenne')}${aide(trad("Les mois où le bien n'est pas loué, lissés sur l'année. Se règle par « Mois loués par an », au bas de cette carte."))}
        <span class="sub">${fmtNombre(cf.moisLoues)} ${trad('mois loués sur 12')}</span></dt>
        <dd class="dette">−${fmtEUR(cf.vacanceEuros)} ${trad('/ mois')}</dd>`,
      `
      <dt class="kv-sous">${trad('Loyer retenu')}${aide(trad('Le loyer potentiel moins la vacance. C’est lui qui entre dans le cash-flow et dans les rendements : la vacance est déjà déduite ici, elle ne se retranche pas une seconde fois plus bas.'))}</dt>
        <dd>${fmtEUR(cf.loyers)} ${trad('/ mois')}</dd>`,
    ]),
    ligneCharges(cf, -1),
    ligneMensualite(cf, -1),
    ...(cf.fiscalite.source === 'inconnue' ? [] : [`
      <dt class="kv-sous">${trad('Cash-flow avant fiscalité')}${aide(trad('Le loyer retenu, moins les charges du propriétaire et la mensualité. La fiscalité se retire juste en dessous.'))}</dt>
        <dd>${fmtSigned(cf.cashFlowAvantImpot)} ${trad('/ mois')}</dd>`]),
    ligneFiscalite(cf),
  ].filter(Boolean).join('');
}

function ligneFiscalite(cf) {
  const f = cf.fiscalite;
  const aideTxt = trad("Ce que ce bien te coûte en impôt sur un mois. Elle vient de toi : l'application ne modélise ni micro-foncier, ni réel, ni meublé, et ne devine donc aucun montant. Se règle par « Fiscalité estimée », au bas de cette carte.");
  if (f.source === 'inconnue') return `
      <dt>${trad('Fiscalité estimée')}${aide(aideTxt)}</dt>
        <dd class="muted">${trad('non estimée')}</dd>`;
  const sous = f.source === 'legacy'
    ? `${fmtPct(f.taux, 1)} · ${trad('estimation simplifiée à confirmer')}`
    : `${fmtEUR0(f.annuel)} ${trad('par an')}`;
  return `
      <dt>${trad('Fiscalité estimée')}${aide(aideTxt)}
        <span class="sub">${sous}</span></dt>
        <dd class="dette">−${fmtEUR(f.mensuel)} ${trad('/ mois')}</dd>`;
}

partieChargee('assets/app-05-avoirs-comptes-portefeuilles.js');
