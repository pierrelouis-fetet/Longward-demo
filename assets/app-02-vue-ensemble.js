/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function carteAVerifier() {
  const liste = aVerifier();
  if (!liste.length) return '';
  const plusieurs = liste.length > 1;
  const ou = e => {
    const m = /^positions\.(\d+)\./.exec(e.chemin);
    if (m) return { action: 'open-position', attrs: `data-i="${m[1]}"`, libelle: trad('Voir la ligne') };
    const k = /^comptes\.(\d+)\./.exec(e.chemin);
    const compte = k && (Store.state.comptes || [])[Number(k[1])];
    if (compte) return { action: 'fiche-compte', attrs: `data-id="${esc(compte.id)}"`, libelle: trad('Voir le compte') };
    return { action: 'goto', attrs: 'data-view="accounts"', libelle: trad('Voir les actifs') };
  };
  const quoi = e => {
    const solde = /\.cash\.\d+\.montant$/.test(e.chemin);
    const n = Number(e.valeur);
    const chiffre = e.genre === 'montant' && Number.isFinite(n);
    const montant = chiffre && n < 0 ? fmtEUR(n) : String(e.valeur);
    const raison = chiffre && n < 0
      ? trad(solde ? 'un solde ne peut pas être négatif' : 'ce montant ne peut pas être négatif') : '';
    return [solde ? trad('Liquidités') : '', montant, raison].filter(Boolean).join(' · ');
  };
  return `
  <section class="card averifier" aria-labelledby="averifierTitre">
    <div class="card-head">
      <h2 id="averifierTitre">${trad(plusieurs ? 'Des valeurs semblent incorrectes' : 'Une valeur semble incorrecte')}</h2>
    </div>
    <p class="hint" style="margin:0 0 10px">${trad(plusieurs
      ? 'Tant qu’elles ne sont pas corrigées, les totaux qui les comptent sont à vérifier.'
      : 'Tant qu’elle n’est pas corrigée, les totaux qui la comptent sont à vérifier.')}</p>
    <ul class="retenir-liste">${liste.slice(0, 5).map(e => { const o = ou(e); return `
      <li class="retenir-item">
        <b class="retenir-titre">${esc(String(e.nom))}</b>
        <p class="retenir-texte">${esc(quoi(e))}</p>
        <button type="button" class="lien-vue retenir-lien" data-action="${o.action}" ${o.attrs}
          >${o.libelle} <span aria-hidden="true">→</span></button>
      </li>`; }).join('')}
    </ul>
  </section>`;
}
function ligneInsight(i, p, precedent, destinationsVues) {
  const oeil = EYEBROW_INSIGHT[i.categorie] === precedent
    ? null : EYEBROW_INSIGHT[i.categorie];
  const cta = p.cta && !(destinationsVues || []).includes(destinationInsight(p))
    && !renvoiVersCarteMasquee(p) ? p.cta : null;
  return `
      <li class="retenir-item">
        ${!oeil ? '' : `<span class="retenir-oeil">${trad(oeil)}</span>`}
        <b class="retenir-titre">${esc(typeof p.titre === 'function'
          ? p.titre(i.params) : trad(p.titre))}</b>
        ${p.valeur ? `
        <p class="retenir-mesure"><b class="retenir-valeur"
          >${escMontant(p.valeur(i.params))}</b> <span class="retenir-texte"
          >${p.phrase(i.params)}</span></p>`
        : `<p class="retenir-texte">${p.phrase(i.params)}</p>`}
        ${(() => {
          const s = p.secondaire && p.secondaire(i.params);
          return s ? `<p class="retenir-second">${s}</p>` : '';
        })()}
        ${!cta ? '' : cta.ancre
          /* Une ancre vise un endroit DANS une vue : c'est `goto` qui sait
             faire les deux, changer d'ecran s'il le faut puis defiler jusqu'a
             la carte. Une adresse ne le pourrait pas, elle s'arrete en haut de
             page. Le bouton porte la meme allure que le lien : la difference
             est dans ce qu'il fait, pas dans ce qu'il montre. */
          ? `<button type="button" class="lien-vue retenir-lien" data-action="goto"
                data-view="${esc(cta.vue)}" data-anchor="${esc(cta.ancre)}"
                >${esc(trad(cta.libelle))} <span aria-hidden="true">→</span></button>`
          : `<a class="lien-vue retenir-lien" href="#/${cta.vue}"
             >${esc(trad(cta.libelle))} <span aria-hidden="true">→</span></a>`}
      </li>`;
}

function viewOverview() {
  if (enEditionApercu()) return editeurApercu();
  const t = nowTotals();
  const d = deltas();
  const g = objectiveStatus();
  const alloc = allocationByAsset();

  /* Le pourcentage ne s'affiche que s'il veut dire quelque chose : `deltas()`
     rend `null` quand la base de comparaison est nulle, negative, ou que le
     patrimoine a traverse zero entre les deux dates. L'euro, lui, reste exact
     dans tous les cas. */
  /* --- « SUR {n} MOIS GLISSANTS », ET LE NOMBRE EST LE VRAI -----------------

     La fenetre est bien GLISSANTE : elle se termine aujourd'hui et remonte vers
     le releve le plus proche d'il y a douze mois, jamais vers un 1er janvier.
     C'est ce que « glissants » dit, et c'est ce qui la distingue d'une annee
     civile.

     MAIS ELLE NE FAIT PAS TOUJOURS DOUZE MOIS, et le libelle ne le pretend
     jamais. `variationAn()` retient le releve le plus proche de douze mois dans
     une tolerance de trois, et rend l'AGE REEL du point retenu. Ecrire « 12 »
     sous une comparaison qui en couvre quinze serait le meme mensonge que
     l'ecrire sous quatre. Le releve de depart se nomme donc par son mois, et
     le nombre de mois reste interpole depuis le moteur : « depuis le releve
     de sept. 25 · 12 mois », ou quinze quand il en a quinze.

     CE N'EST PAS UN RENDEMENT, et la bulle le dit en toutes lettres. Un
     « +127,7 % » se lit spontanement comme une performance de placement ; celui
     -ci contient les versements, les retraits et le capital rembourse sur les
     credits. Le pourcentage ne change pas, son nom non plus : c'est la bulle
     qui porte la distinction, parce qu'un second intitule dans la carte
     encombrerait le seul chiffre qu'on vient lire.

     ET LE GRAND CHIFFRE PERD SES CENTIMES, comme la carte de composition juste
     dessous. Trente-quatre centimes sous un patrimoine de cinquante mille euros
     n'ajoutent aucune information et coutent deux caracteres au plus grand
     nombre de l'application. Rien n'est arrondi dans les donnees : `nowTotals()`
     rend ce qu'il rendait, et les ecrans qui ont besoin du centime le gardent.
     La variation, elle, n'en a jamais porte — `fmtSigned` formate deja a zero
     decimale — et le pourcentage garde la sienne. */
  const varAn = variationAn(todayISO(), evoNet);
  const blocVariation = !varAn ? '' : `
    <div class="hero-deltas">
      <div class="hero-delta">
        <b class="${cls(varAn.eur)}">${fmtSigned(varAn.eur)}${varAn.pct == null ? ''
          : `<span class="hero-pct">· ${fmtSignedPct(varAn.pct, 1)}</span>`}</b>
        <span>${eliderDe(trad('depuis le relevé de {m}').replace('{m}', esc(fmtMonth(varAn.depuis))))} · ${
          varAn.mois} ${trad('mois')}${aide(trad(evoNet
            ? 'Variation de ton patrimoine net entre aujourd’hui et le relevé le plus proche d’il y a un an. Elle inclut les versements, les retraits, le remboursement du capital des crédits et l’évolution de la valeur des actifs : ce n’est pas la performance de tes placements.'
            : 'Variation de ton patrimoine brut entre aujourd’hui et le relevé le plus proche d’il y a un an. Elle inclut les versements, les retraits et l’évolution de la valeur des actifs : ce n’est pas la performance de tes placements.'))}</span>
      </div>
    </div>`;

  /* --- LA COURBE DU VIDE DE DROITE --------------------------------------

     Cette courbe ne double pas la carte Evolution du patrimoine, deux cents
     pixels plus bas. Elle part du releve que `variationAn()` a retenu, celui
     de la variation posee a sa gauche, trace les releves puis finit sur le
     patrimoine du jour : ses deux bouts font cette variation. Ses points
     s'espacent selon leur date, si bien que les quelques jours entre le
     dernier releve et aujourd'hui ne prennent que leur largeur. La carte du
     dessous, elle, ne trace que des releves et porte sa propre plage -- YTD,
     un an, trois ans, tout -- et son axe.

     Deux points au moins et une duree entre eux, sinon rien
     (`courbeAnTracable`) : le releve de la variation et la photo du jour font
     deja une vraie lecture. Aucun mois manquant n'est comble.

     Elle ne porte ni chiffre permanent, ni axe, ni plage, ni selection de
     periode : ce qui s'y ajoute est une infobulle au doigt, qui dit ce qu'on
     avait a ce moment-la sans quitter l'apercu. Le trace reste `aria-hidden` :
     le montant, la variation et la periode sont ecrits en toutes lettres trois
     lignes plus haut, et l'onglet Historique donne l'acces detaille. */
  const pointsHero = varAn ? pointsAn(varAn.depuis, evoNet) : [];
  const blocSpark = !courbeAnTracable(pointsHero) ? ''
    : `<div class="hero-spark" id="heroSpark"></div>`;

  const moisEnAttente = currentMonthPending();
  const depEnAttente = depensesEnAttente();
  const guide = carteDemarrage();
  const guideDevant = !aUnComptePropre();
  const sansComptes = pasAFaire('comptes');
  const cartes = cartesApercu({ sansComptes });

  return `
  ${guideDevant ? guide : ''}
  ${carteAVerifier()}

  ${!aUnComptePropre() ? '' : `
  <div class="hero">
    ${!aUnComptePropre() ? '' : `
    <div class="hero-label">
      <span>${trad(evoNet ? 'Patrimoine net' : 'Patrimoine brut')}</span>${
        aVerifier().length ? `<span class="muted">· ${trad('à vérifier')}</span>` : ''}
      ${basculesAffichees().netBrut ? `<span class="segmented seg-mini">
        <button data-action="hero-base" data-net="1" class="${evoNet ? 'on' : ''}"
                title="${trad('Tes avoirs moins tes crédits')}">${trad('Net')}</button>
        <button data-action="hero-base" data-net="" class="${evoNet ? '' : 'on'}"
                title="${trad('La valeur de tes avoirs, crédits non déduits')}">${trad('Brut')}</button>
      </span>` : ''}
    </div>`}
    <div class="hero-haut">
    <div class="hero-gauche">
    <div>
      ${!aUnComptePropre() ? '' : `
      <div class="hero-value">${fmtEUR0(evoNet ? t.total : t.brut)}</div>`}
    </div>
    ${blocVariation}
    </div>
    ${blocSpark}
    </div>
    ${(() => {
      const parts = repartitionClasses({ net: evoNet });
      const segments = segmentsBarre(parts);
      if (!segments.length) return '';
      return `
      <div class="hero-barre" role="img"
           aria-label="${trad('Répartition')}${deuxPoints()} ${parts.map(x => `${trad(x.label)} ${
             x.pct == null ? fmtEUR0(x.value) : fmtPct(x.pct, 0)}`).join(', ')}">
        ${segments.map(x => `<i style="width:${x.largeur.toFixed(2)}%;background:${x.couleur}"></i>`).join('')}
      </div>`;
    })()}
  </div>`}

  ${guideDevant ? '' : guide}

  ${cartes.tete}

  ${(moisEnAttente.missing || depEnAttente.missing) && !guide ? `
  <section class="rappels" aria-label="${esc(trad('À faire'))}">
  ${moisEnAttente.missing && !guide ? `
  <div class="rappel card-cliquable">
    <button type="button" class="card-couvre" data-action="ajouter-releve"
            aria-label="${trad('Enregistrer le relevé de')} ${esc(moisEnAttente.label)}"></button>
    <span class="rappel-pastille"></span>
    <span class="rappel-texte"><b>${trad('Enregistrer le relevé de')} <span class="rappel-mois">${esc(moisEnAttente.label)} ›</span></b><br>
      <span class="muted">${trad('Ajoute ce mois à ta courbe de patrimoine · {v} aujourd’hui').replace('{v}', fmtEUR0(nowTotals().total))}</span></span>
    ${sortiesRappel('releve', moisEnAttente.label)}
  </div>` : ''}

  ${depEnAttente.missing && !guide ? `
  <div class="rappel card-cliquable">
    <button type="button" class="card-couvre" data-action="saisir-mois-en-attente"
            aria-label="${trad('Saisir les dépenses de')} ${esc(depEnAttente.label)}"></button>
    <span class="rappel-pastille"></span>
    <span class="rappel-texte"><b>${trad('Saisir les dépenses de')} <span class="rappel-mois">${esc(depEnAttente.label)} ›</span></b><br>
      <span class="muted">${trad('Le mois est clos, ce qu’il a coûté reste à enregistrer')}</span></span>
    ${sortiesRappel('depenses', depEnAttente.label)}
  </div>` : ''}
  </section>` : ''}

  ${cartes.suite}

  ${sansComptes ? `
  <p class="apercus-legende">${trad('Ton tableau de bord s’enrichit à mesure que tu ajoutes tes données.')}</p>
  <div class="apercus-verrous">
    ${apercuVerrou(trad('Patrimoine net'), trad('Ajoute au moins un compte pour commencer.'), 'barre', true)}
    ${apercuVerrou(trad('Répartition de ton patrimoine'), trad('Disponible après tes premiers actifs.'), 'anneau')}
    ${apercuVerrou(trad('Capacité d’épargne'), trad('Ajoute tes revenus et tes dépenses.'), 'jauge')}
    ${apercuVerrou(trad('Projection'), trad('Disponible quand ta situation est suffisamment renseignée.'), 'courbe')}
  </div>` : piedApercu()}

`;
}

/* --- Les cartes de l'Apercu, et leur disposition --------------------------

   Une entree par carte de CARTES_APERCU (store.js), qui porte l'ordre et la
   visibilite ; ici vivent le nom que montre la liste de reglage et le rendu.
   Un test verifie que les deux listes nomment les memes cartes.

   `compacte` : la carte tient dans une demi-largeur sur ordinateur. Deux
   compactes qui se suivent partagent une rangee, la courbe suivie de ce qui a
   change partage la sienne en deux tiers et un tiers, et toute autre carte
   prend la largeur entiere. La regle ne regarde que les cartes REELLEMENT
   rendues : une carte masquee ou vide ne laisse aucun trou dans une rangee,
   quel que soit l'ordre choisi. Sur telephone, ces grilles passent deja a une
   colonne.

   `presente` repond sans rendre : la liste de reglage peut dire qu'une carte
   n'a rien a montrer pour l'instant sans appeler son rendu, qui noterait par
   exemple des points a retenir comme vus. Sans `presente`, la carte parait
   toujours. */
const CARTES_APERCU_VUE = {
  retenir:      { nom: () => trad('À retenir'), rendu: () => carteARetenir() },
  repartition:  { nom: () => trad('Répartition'), rendu: () => carteRepartitionResume() },
  evolution:    { nom: () => trad('Évolution du patrimoine'), rendu: () => carteEvolution() },
  changements:  { nom: () => trad('Ce qui a changé'), rendu: () => carteVariation(), compacte: true,
                  presente: () => !!derniereVariation() },
  titres:       { nom: () => trad('Tes titres'), rendu: () => carteTitresResume(), compacte: true,
                  presente: () => aDesPositionsMarche() },
  accumulation: { nom: () => trad('Accumulation ce mois-ci'), rendu: () => carteAccumulationResume(),
                  compacte: true },
  reserve:      { nom: () => trad('Réserve de sécurité'), rendu: () => carteReserveResume(), compacte: true },
  objectif:     { nom: () => trad('Objectif à fin') + ' ' + Store.state.meta.objectiveYear,
                  rendu: () => carteObjectif(), compacte: true },
};

const ANCRES_CARTES_APERCU = { evolution: 'evolution', variation: 'changements',
                               accumulation: 'accumulation', autonomie: 'reserve' };
const ancreApercuMasquee = ancre =>
  !!ANCRES_CARTES_APERCU[ancre] && dispositionApercu().masquees.includes(ANCRES_CARTES_APERCU[ancre]);
const renvoiVersCarteMasquee = p => {
  const [vue, ancre] = destinationInsight(p).split(':');
  return vue === 'overview' && ancreApercuMasquee(ancre);
};

const CARTES_AVANT_COMPTE = ['repartition', 'objectif'];

function cartesApercu({ sansComptes = false } = {}) {
  const d = dispositionApercu();
  const rendues = d.ordre
    .filter(id => !d.masquees.includes(id) && (!sansComptes || CARTES_AVANT_COMPTE.includes(id)))
    .map(id => ({ id, html: CARTES_APERCU_VUE[id].rendu() }))
    .filter(c => c.html.trim());
  const tete = rendues[0] && rendues[0].id === 'retenir' ? rendues.shift().html : '';
  return { tete, suite: rangeesApercu(rendues) };
}

function rangeesApercu(rendues) {
  const compacte = c => !!(c && CARTES_APERCU_VUE[c.id].compacte);
  let html = '';
  for (let i = 0; i < rendues.length; i++) {
    const a = rendues[i], b = rendues[i + 1];
    if (b && a.id === 'evolution' && b.id === 'changements') {
      html += `
  <div class="grid g-2-1">${a.html}${b.html}</div>`;
      i++;
    } else if (compacte(a) && compacte(b)) {
      html += `
  <div class="grid g-2" data-paire>${a.html}${b.html}</div>`;
      i++;
    } else html += a.html;
  }
  return html;
}

function piedApercu() {
  return `
  <p class="apercu-pied">
    <button type="button" class="lien-vue" data-action="apercu-editer">${trad('Personnaliser l’aperçu')}</button>
  </p>`;
}

function editeurApercu() {
  const d = dispositionApercu();
  const fleche = haut => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${
          haut ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}"/></svg>`;
  const ligne = (id, i) => {
    const c = CARTES_APERCU_VUE[id];
    const nom = esc(c.nom());
    const cachee = d.masquees.includes(id);
    const etat = cachee ? trad('Masquée')
      : c.presente && !c.presente() ? trad('Rien à montrer pour l’instant') : '';
    const pour = libelle => `${trad(libelle)}${deuxPoints()} ${nom}`;
    return `
      <li class="apercu-ligne${cachee ? ' masquee' : ''}" data-carte="${id}">
        <span class="apercu-nom">${nom}${etat ? `<span class="sub">${etat}</span>` : ''}</span>
        <span class="apercu-commandes">
          <button type="button" class="btn ghost apercu-fleche" data-action="apercu-monter" data-carte="${id}"
                  aria-label="${pour('Monter')}" title="${trad('Monter')}"${i === 0 ? ' disabled' : ''}>${fleche(true)}</button>
          <button type="button" class="btn ghost apercu-fleche" data-action="apercu-descendre" data-carte="${id}"
                  aria-label="${pour('Descendre')}" title="${trad('Descendre')}"${
                  i === d.ordre.length - 1 ? ' disabled' : ''}>${fleche(false)}</button>
          <button type="button" class="bascule apercu-vu${cachee ? '' : ' on'}" data-action="apercu-visibilite"
                  data-carte="${id}" role="switch" aria-checked="${cachee ? 'false' : 'true'}"
                  aria-label="${pour('Afficher sur l’aperçu')}" title="${trad(cachee ? 'Afficher' : 'Masquer')}">
            <span class="bascule-piste" aria-hidden="true"><i></i></span></button>
        </span>
      </li>`;
  };
  return `
  <header class="page-tete apercu-edition-tete">
    <div>
      <h2 id="apercuEditionTitre" tabindex="-1">${trad('Personnaliser Aujourd’hui')}</h2>
      <p>${trad('Choisis l’ordre des cartes d’Aujourd’hui et celles que tu veux voir. Les rappels de saisie gardent leur place.')}</p>
    </div>
    <button type="button" class="btn" data-action="apercu-terminer">${trad('Terminé')}</button>
  </header>
  <section class="card apercu-edition" aria-labelledby="apercuEditionTitre">
    <ol class="apercu-liste">
      <li class="apercu-ligne apercu-fixe">
        <span class="apercu-nom">${trad(evoNet ? 'Patrimoine net' : 'Patrimoine brut')}<span class="sub">${
          trad('Toujours en premier')}</span></span>
      </li>
      ${d.ordre.map(ligne).join('')}
    </ol>
    <div class="apercu-edition-pied">
      <button type="button" class="btn sm ghost" data-action="apercu-retablir"${d.parDefaut ? ' disabled' : ''}
              >${trad('Rétablir la disposition par défaut')}</button>
    </div>
    <p class="hors-ecran" role="status" id="apercuAnnonce"></p>
  </section>`;
}

let apercuEdition = false;
let apercuFocus = null;
let apercuAnnonce = '';
const enEditionApercu = () =>
  apercuEdition && sousOngletActif.overview === 'aujourdhui' && !pasAFaire('comptes');
function deplacerSurApercu(id, sens) {
  if (!deplacerCarteApercu(id, sens)) return;
  Store.save();
  const d = dispositionApercu();
  apercuAnnonce = trad('{c}, position {n} sur {t}').replace('{c}', CARTES_APERCU_VUE[id].nom())
    .replace('{n}', d.ordre.indexOf(id) + 2).replace('{t}', d.ordre.length + 1);
  apercuFocus = { carte: id, action: sens < 0 ? 'apercu-monter' : 'apercu-descendre' };
  render(); retourHaptique();
}
function reprendreFocusApercu() {
  const f = apercuFocus, annonce = apercuAnnonce;
  apercuFocus = null; apercuAnnonce = '';
  let cible = null;
  if (f && f.titre) cible = $('#apercuEditionTitre');
  else if (f && f.carte) {
    const ligne = $(`.apercu-ligne[data-carte="${f.carte}"]`);
    const voulu = ligne && ligne.querySelector(`[data-action="${f.action}"]`);
    cible = voulu && !voulu.disabled ? voulu : ligne && ligne.querySelector('button:not([disabled])');
  }
  if (cible) {
    cible.focus({ preventScroll: true });
    if (!f.titre) setTimeout(() => cible.scrollIntoView({ block: 'nearest' }), 0);
  }
  if (annonce) setTimeout(() => { const r = $('#apercuAnnonce'); if (r) r.textContent = annonce; }, 60);
}

/* Ce raisonnement vit hors du gabarit, et c'est voulu. Un commentaire HTML
   dans un litteral part jusqu'au DOM du visiteur. La regle tient en deux mots :
   dans le gabarit, `<!-- -->` ; dans le code, un commentaire de bloc. */
let repartAutresOuvert = false;
function carteRepartitionResume() {
    const classes = repartitionClasses({ net: evoNet });
    if (!classes.length) return '';
    const s = syntheseRepartition(classes);
    const ligneClasse = x => {
      const dettesSeules = x.classe === DETTES_NON_AFFECTEES;
      return `
      <button type="button" class="repart-ligne" data-action="apercu"
              data-apercu="${dettesSeules ? 'credits' : 'classe'}" data-arg="${dettesSeules ? '' : esc(x.classe)}"
              title="${dettesSeules ? trad('Voir et mettre à jour tes crédits')
                : `${trad('Voir le détail de')} ${esc(trad(x.label))}`}">
        <span class="repart-haut">
          <span class="dot" style="background:${x.couleur}"></span>
          <span class="repart-nom">${esc(trad(x.label))}${!dettesSeules && x.dettes > 0.005
            ? `<span class="sub">${trad('après {v} de crédit').replace('{v}', fmtEUR0(x.dettes))}</span>` : ''}</span>
          <b${x.value < 0 ? ' class="dette"' : ''}>${fmtEUR0(x.value)}</b>
          <span class="repart-pct">${x.pct == null ? '' : fmtPct(x.pct, 1)}</span>
          <span class="ml-chev" aria-hidden="true">›</span>
        </span>
        <span class="hors-ecran">, ${dettesSeules ? trad('voir et mettre à jour tes crédits')
          : trad('voir ce qui compose cette catégorie et la mettre à jour')}</span>
      </button>`; };
    return `
  <div class="card repart repart-synthese">
    <div class="card-head"><h2>${trad('Répartition')}</h2>
      <a class="hint lien-vue" href="#/allocation">${trad('Voir toute l’allocation')} →</a></div>
    ${s.tete.map(ligneClasse).join('')}
    ${!s.autres ? '' : `
    <button type="button" class="repart-ligne repart-autres" data-action="repart-autres"
            aria-expanded="${repartAutresOuvert ? 'true' : 'false'}" aria-controls="repartAutresDetail">
      <span class="repart-haut">
        <span class="repart-nom">${trad('Autres')}<span class="sub">${
          trad('{n} catégories').replace('{n}', s.autres.nb)}</span></span>
        <b>${fmtEUR0(s.autres.value)}</b>
        <span class="repart-pct">${s.autres.pct == null ? '' : fmtPct(s.autres.pct, 1)}</span>
        <span class="ml-chev repart-chev" aria-hidden="true">›</span>
      </span>
    </button>
    <div class="repart-autres-detail" id="repartAutresDetail"${repartAutresOuvert ? '' : ' hidden'}>
      ${s.autres.lignes.map(ligneClasse).join('')}
    </div>`}
    ${s.negatives.map(ligneClasse).join('')}
    ${(() => {
      const p = patrimoine();
      if (!p.dettes) return '';
      const cr = creditsEnCours();
      const nonAffectees = dettesParDestination().nonAffectees;
      const aideNet = [
        trad('Ces parts portent sur ton patrimoine net : les {v} de capital restant dû sont déduits une seule fois.')
          .replace('{v}', fmtEUR0(p.dettes)),
        trad('Un crédit se retranche de la classe du compte auquel il est rattaché : un prêt rattaché à un logement, de ton immobilier ; un prêt rattaché à des parts de société, du non coté.'),
        nonAffectees > 0.005
          ? trad('Les crédits sans destination connue, {v}, forment la ligne « Dettes non affectées » : leur fiche ne désigne aucun compte, ou un compte qui mêle plusieurs classes, et Longward ne les attribue à aucune classe.')
              .replace('{v}', fmtEUR0(nonAffectees))
          : '',
        trad('Bascule sur « Brut » pour voir tes avoirs avant crédits.'),
      ].filter(Boolean).join(' ');
      const aideBrut = trad('Ces parts portent sur ce que tu possèdes, avant crédits. Ton patrimoine net, en haut de page, vaut {v} : la différence est le capital qu’il te reste à rembourser. Bascule sur « Net » pour voir chaque classe diminuée des crédits qui la financent.')
        .replace('{v}', fmtEUR0(p.net));
      return `
      <p class="perimetre repart-base">${mentionBase(
        evoNet ? BASES.net : BASES.avoirs, evoNet ? p.net : p.brut)}${aide(evoNet ? aideNet : aideBrut)}</p>
      <button type="button" class="repart-credits" data-action="apercu" data-apercu="credits"
              title="${trad('Voir et mettre à jour tes crédits')}">
        <span>${evoNet ? trad('Crédits déjà déduits') : trad('Crédits en cours')}</span>
        <b class="dette">${evoNet ? '' : '−'}${fmtEUR0(cr.reste)}</b>
        <span class="ml-chev" aria-hidden="true">›</span>
      </button>`;
    })()}
  </div>`;
}

function carteTitresResume() {
  if (!aDesPositionsMarche()) return '';
  const pnl = portfolioPnl();
  return `
  <div class="card">
    <div class="card-head"><h2>${trad('Tes titres')}</h2>
      <a class="hint lien-vue" href="#/positions">${trad('Voir les positions')} →</a></div>
    <div class="pf-corps">
      <button type="button" class="pf-total" data-action="apercu" data-apercu="portefeuille">
        <span class="pf-lab">${trad('Valeur actuelle')}</span>
        <b>${fmtEUR0(pnl.value)}</b>
        <span class="pf-sous">${Store.state.positions.length} ${
          Store.state.positions.length > 1 ? trad('lignes de titres') : trad('ligne de titres')}</span>
      </button>
      <div class="pf-mesures">
        ${(() => {
          const pct = pnl.pct == null ? null : fmtSignedPct(pnl.pct);
          if (pct == null) return `
        <div class="pf-mesure pf-muet">
          <span class="pf-lab">${trad('Plus-value latente')}</span>
          <span class="pf-val"><b>${trad('prix de revient manquant')}</b></span>
        </div>`;
          return `
        <button type="button" class="pf-mesure" data-action="apercu" data-apercu="pnlLatent">
          <span class="pf-lab">${trad('Plus-value latente')}</span>
          <span class="pf-val"><b class="${cls(pnl.pnl)}">${fmtSigned(pnl.pnl)}</b>
            <span class="pf-pct ${cls(pnl.pnl)}">${pct}</span></span>
        </button>`;
        })()}
        ${(() => {
          const j = dayPerformance();
          /* Deux situations pour une meme mesure muette. Aucune ligne ne se
             mesure : `causeSansVariation` dit pourquoi, faute de cours du
             marche ou faute de cloture de la veille. Ou toutes ont des cours
             d'avant minuit : "hors seance", et sans cette phrase la carte
             annoncait "+0 EUR, +0,00 %" sur une journee qui n'avait pas encore
             de cours. */
          if (!j.lignes.length || j.toutHorsSeance) return `
        <p class="pf-jour-muet">${trad('Aujourd’hui')}${deuxPoints()} ${j.lignes.length
              ? `${trad('hors séance')}, ${trad('aucune ligne n’a coté depuis minuit')}`
              : causeSansVariation(j)}</p>`;
          return `
        <button type="button" class="pf-mesure" data-action="apercu" data-apercu="jourTitres">
          <span class="pf-lab">${trad('Aujourd’hui')}</span>
          <span class="pf-val"><b class="${cls(j.eur)}">${fmtSigned(j.eur)}</b>
            <span class="pf-pct ${cls(j.eur)}">${fmtSignedPct(j.pct)}</span></span>
        </button>`;
        })()}
      </div>
    </div>
  </div>`;
}

const CLE_DEFILEMENT_HEROS = 'longward.heros-defile';
let herosDejaDefile = false;
function defilerHeros() {
  const el = $('#view .hero .hero-value');
  if (!el || herosDejaDefile || montantsMasques) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { if (sessionStorage.getItem(CLE_DEFILEMENT_HEROS) === '1') { herosDejaDefile = true; return; } }
  catch (e) { /* sans stockage de session, le drapeau en memoire suffit */ }
  const t = nowTotals();
  const fin = evoNet ? t.total : t.brut;
  const debut = departDefilementHeros(evoNet);
  if (debut === null || Math.abs(fin - debut) < 1) return;
  herosDejaDefile = true;
  try { sessionStorage.setItem(CLE_DEFILEMENT_HEROS, '1'); } catch (e) { /* idem */ }
  const final = fmtEUR0Texte(fin);
  el.innerHTML = `<span class="hero-defile" aria-hidden="true">${esc(fmtEUR0Texte(debut))}</span>`
    + `<span class="hors-ecran">${esc(final)}</span>`;
  const chiffre = el.firstElementChild;
  const DUREE = 700;
  const t0 = performance.now();
  const adoucir = k => 1 - Math.pow(1 - k, 3);
  const pas = maintenant => {
    if (!chiffre.isConnected) return;
    const k = Math.min(1, (maintenant - t0) / DUREE);
    if (k < 1) {
      chiffre.textContent = fmtEUR0Texte(debut + (fin - debut) * adoucir(k));
      requestAnimationFrame(pas);
    } else {
      el.textContent = final;
    }
  };
  requestAnimationFrame(pas);
}

function mountOverview() {
  if (!$('.apercu-edition')) { noterInsightsVus(); monterEvolution(); }
  else reprendreFocusApercu();
  /* La courbe du hero, sur la fenetre que la variation annonce. `mount()` sort
     en silence quand le conteneur n'est pas rendu, donc rien a garder ici. */
  (() => {
    const v = variationAn(todayISO(), evoNet);
    if (!v) return;
    /* `labels` ALLUME L'EXPLORATION, et c'est tout ce qu'il faut : `sparkline()`
       porte deja le curseur, l'infobulle, le choix du point le plus proche et
       le `touch-action: pan-y` qui laisse la page defiler. Le code dormait
       faute d'etiquettes a montrer.

       Le point retenu est un releve reel ou la photo du jour : le doigt prend
       le point d'abscisse la plus proche, aucun patrimoine intermediaire n'est
       calcule. Les abscisses suivent les jours (`positions`). */
    const pts = pointsAn(v.depuis, evoNet);
    /* `height` PLUS BASSE QUE LE DEFAUT DE QUARANTE-QUATRE, et elle se passe ici
       et nulle part ailleurs : posee en CSS sur le SVG, elle ne l'aplatirait pas
       — la `viewBox` se recentre et le trace retrecit EN LARGEUR. Trente-six
       pixels suffisent a lire une tendance, et rendent a la courbe son rang :
       elle soutient le chiffre, elle ne le concurrence pas. */
    Charts.sparkline($('#heroSpark'), pts.map(p => p.valeur),
      { labels: pts.map(p => p.label), height: 36, positions: pts.map(p => Date.parse(p.jour)) });
  })();
  if (!$('.apercu-edition')) defilerHeros();
}

function monterRythme() {
  const pace = monthlyPace();
  const barres = limitRange(pace.points, paceRange, { ecarts: true });
  const moyenne = barres.length
    ? barres.reduce((s, p) => s + p.delta, 0) / barres.length : pace.average;
  if ($('#chartPace')) Charts.deltaBars($('#chartPace'), {
    height: 220,
    items: barres.map(p => ({ label: p.label, value: p.delta, note: p.note })),
    average: moyenne,
  });
}

/* `goto` = "vue:ancre", rend la tuile cliquable et emmène à l'endroit
   où ce chiffre se modifie réellement. */

/* Les memes cinq boutons partout, dans le meme ordre, quelle que soit la
   profondeur des donnees. Trois graphiques s'en servent — l'evolution du
   patrimoine, le rythme d'accumulation et les ventes realisees — et ils
   passent tous par ici : le geste est le meme sur les trois.

   Un cran plus long que l'historique trace la meme courbe que « Tout ». On le
   laisse quand meme, comme le font les applications boursieres : une echelle
   dont les boutons apparaissent et disparaissent avec le temps ne s'apprend
   pas. `limitRange` elargit d'elle-meme quand une fenetre ne retient qu'un
   point, donc aucun cran ne peut donner un graphique vide.

   La liste deroulante « ⋯ » a disparu avec les durees calculees. Un selecteur
   ne se justifiait que pour des crans en nombre variable. */
function rangeControl(action, courant, annees = []) {
  const surAnnee = estAnnee(courant);
  const connu = HISTORY_RANGES.some(r => r.id === courant);
  return `
    <div class="plage">
      <div class="segmented seg-mini">
        ${HISTORY_RANGES.map(r => `<button data-action="${action}" data-range="${r.id}"
          class="${!surAnnee && (r.id === courant || (!connu && r.id === 'all')) ? 'on' : ''}"
          >${esc(r.label)}</button>`).join('')}
      </div>
      ${annees.length ? `
      <select data-action-change="${action}" class="annee${surAnnee ? ' on' : ''}"
              aria-label="${esc(trad('Année affichée'))}" title="${esc(trad('Année affichée'))}">
        <option value="" disabled${surAnnee ? '' : ' selected'}>${trad('Choisir une année')}</option>
        ${annees.map(y => `<option value="${esc(y)}" ${String(y) === String(courant) ? 'selected' : ''}
          >${esc(y)}</option>`).join('')}
      </select>` : ''}
    </div>`;
}

function nomCompte(a) {
  const i = Store.state.accounts.indexOf(a);
  return `<input class="acct-nom" data-path="accounts.${i}.label" value="${esc(a.label)}"
                 title="${trad('Renommer ce compte, le nom suit partout')}" autocomplete="off">`;
}

/* Pastille de couleur, à poser devant un libellé pour le relier à sa part dans
   le graphique voisin. Le filtre écarte tout ce qui n'est pas une couleur que
   l'application produit elle-même : ces valeurs finissent dans un attribut
   `style`, et une chaîne venue d'ailleurs y aurait sa place trop facilement.
   Rien à afficher s'il n'y a pas de couleur — pas de pastille grise inerte. */
const COULEUR_SURE = /^(var\(--[\w-]+\)|#[0-9a-f]{3,8}|rgba?\([\d.,\s%/]+\)|hsla?\([\d.,\s%/deg]+\))$/i;
function pastilleTeinte(couleur) {
  const c = String(couleur ?? '').trim();
  return COULEUR_SURE.test(c) ? `<i class="teinte" style="--c:${c}" aria-hidden="true"></i>` : '';
}

function aide(texte) {
  /* Un `<span>` et non un `<button>`, et c'est la correction d'un vrai defaut.

     Un `<label>` sans `for` designe le premier element etiquetable qu'il
     contient, et un `<button>` en est un. Le navigateur renvoyait donc au « ? »
     tout clic tombe sur l'intitule, et lui donnait le focus a la place du champ :
     la bulle s'ouvrait sur toute la ligne. Les treize intitules qui portent un
     « ? » etaient concernes, pas seulement celui qu'on a vu.

     Un `<span>` n'est pas etiquetable : le label ne le voit plus. `role` et
     `tabindex` lui rendent ce qu'un bouton donnait, et `monteAides` ecoute
     Entree et Espace, qu'un span ne convertit pas en clic tout seul. */
  return `<span class="aide" role="button" data-aide="${esc(texte)}"
                aria-label="Explication" tabindex="0">?</span>`;
}

/* Deux cas, et l'ordre compte : le texte nu d'abord, puis les intitules en gras.
   Le premier motif exclut « > » de son mot, donc il ne touche pas aux seconds ;
   l'inverse ferait envelopper deux fois. Le gras se traite a part parce qu'un
   groupe insecable ne peut pas ouvrir dedans et fermer dehors : il se pose donc a
   l'interieur du `<b>`, avec le badge, ce qui reste un emboitement valide.

   Des litterales, et non `new RegExp` depuis une chaine : celle-la demande trois
   niveaux d'echappement — le fichier, la chaine, la regex — et un niveau perdu
   donne `[^s<>]`, une classe qui exclut la lettre « s ». Elle ne matche rien
   d'utile et ne leve aucune erreur. */
const MOTIF_AIDE_COLLEE = /([^\s<>]+)(<span class="aide"[^>]*>\?<\/span>)/g;
const MOTIF_AIDE_GRAS = /<b>([^<]*?)(\S+)<\/b>(<span class="aide"[^>]*>\?<\/span>)/g;
const collerAides = html => String(html)
  .replace(MOTIF_AIDE_COLLEE, (m, mot, badge) => `<span class="aide-collee">${mot}${badge}</span>`)
  .replace(MOTIF_AIDE_GRAS, (m, debut, mot, badge) =>
    `<b>${debut}<span class="aide-collee">${mot}${badge}</span></b>`);

/* La version du code en cours d'execution, lue sur la balise du script.

   Elle se **derive**, elle ne se recopie pas : la seule source est le `?v=` que
   `AGENTS.md` impose de changer a chaque modification d'`assets/`, et un second
   endroit a mettre a jour finirait par mentir -- ce qui serait le comble pour
   un numero de version.

   Pourquoi elle existe : savoir si l'on regarde bien la version deployee ne
   doit pas couter une demi-heure, et sur un telephone il n'y a pas d'outils de
   developpement pour trancher. Trois lignes ici, et la question ne se repose
   plus. */
const VERSION_APP = (() => {
  const s = [...document.scripts].map(x => x.src).find(x => /assets\/[^?]+\.js\?v=/.test(x));
  if (!s) return 'inconnue';
  try { return new URL(s, location.href).searchParams.get('v') || 'sans balise'; }
  catch { return 'inconnue'; }
})();

const DATE_ACHAT_AIDE =
  'Facultative, mais deux chiffres en dépendent. Le rendement par an, qui ramène '
  + '« +36 % » à une échelle comparable, car sans date il ne dit pas s’il a fallu un '
  + 'an ou cinq. Et l’effet du jour : une ligne achetée aujourd’hui se compare à ton '
  + 'prix d’achat, pas à la clôture d’hier, que tu n’as pas vécue. Pour une ligne '
  + 'renforcée plusieurs fois, mets la date du premier achat.';

function monteAides() {
  if (monteAides.monte) return;
  monteAides.monte = true;

  const panneau = document.createElement('div');
  panneau.className = 'aide-panneau';
  panneau.hidden = true;
  document.body.appendChild(panneau);

  const montrer = btn => {
    panneau.textContent = btn.dataset.aide;
    panneau.hidden = false;                 // mesurable seulement une fois visible
    const r = btn.getBoundingClientRect();
    const largeur = panneau.offsetWidth;
    const place = window.innerWidth - r.right;
    const gauche = place < largeur + 20
      ? Math.max(8, r.left - largeur - 10)
      : r.right + 10;
    /* Plus de `window.scrollY` dans ce calcul, et c'est le deuxieme defaut du
       lot : le panneau est en `fixed`, donc en coordonnees de fenetre, comme
       `getBoundingClientRect()`. L'addition etait deja fausse des qu'une fenetre
       etait ouverte — `gelerFond()` met le corps en `position: fixed`, le
       document n'a plus rien a faire defiler, `scrollY` retombe a zero, et la
       bulle se serait posee la ou la page etait avant le gel.
       Et elle ne sort pas par le bas : dans une feuille qui monte du bas, le
       « ? » d'une derniere ligne est a quelques pixels du bord. */
    panneau.style.left = `${gauche}px`;
    panneau.style.top = `${Math.max(8,
      Math.min(r.top - 4, window.innerHeight - panneau.offsetHeight - 8))}px`;
  };
  const cacher = () => { panneau.hidden = true; };

  /* Tout porteur de `data-aide` declenche le panneau, pas seulement le « ? ».

     Un intitule de colonne n'a pas la place d'un bouton a cote de lui : sur un
     telephone, « Poids » occupe deja 40 des 48 pixels de sa colonne. C'est donc
     l'intitule lui-meme qui porte l'explication, souligne d'un pointille. Le
     « ? » rond reste partout ou il y a de la place, en tete de carte. */
  const vise = e => e.target.closest?.('[data-aide]');

  /* `mouseover` et `focusin`, non `mouseenter` et `focus` : seuls les premiers
     remontent jusqu'au document, et un ecouteur delegue ne voit que ce qui
     remonte jusqu'a lui. */
  document.addEventListener('mouseover', e => { const b = vise(e); if (b) montrer(b); });
  document.addEventListener('mouseout',  e => { if (vise(e)) cacher(); });
  document.addEventListener('focusin',   e => { const b = vise(e); if (b) montrer(b); });
  document.addEventListener('focusout',  e => { if (vise(e)) cacher(); });
  document.addEventListener('click', e => {
    const b = vise(e);
    if (b) { e.preventDefault(); montrer(b); }
  });
  document.addEventListener('keydown', e => {
    const b = vise(e);
    if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    montrer(b);
  });

  document.addEventListener('pointerdown', e => { if (!vise(e)) cacher(); }, true);
}

function yearControl(action, annees, courante) {
  return `
    <select data-action-change="${action}" class="annee" title="${trad('Année affichée')}">
      ${annees.map(y => `<option value="${y}" ${String(y) === String(courante) ? 'selected' : ''}>${y}</option>`).join('')}
    </select>`;
}

function tile(label, value, pct, color, meta, apercu, arg) {
  const inner = `
    <span class="t-label">${esc(trad(label))}</span>
    <span class="t-value">${fmtEUR0(value)}</span>
    <span class="t-meta">${pct == null ? '' : `<span class="tag">${fmtPct(pct)}</span>`}${escMontant(meta || '')}</span>`;
  if (!apercu) return `<div class="tile" style="--tile-color:${color}">${inner}</div>`;
  return `<button type="button" class="tile tile-link" style="--tile-color:${color}"
            data-action="apercu" data-apercu="${esc(apercu)}"${arg ? ` data-arg="${esc(arg)}"` : ''}
            title="${trad('Voir le détail de')} ${esc(trad(label))}">${inner}<span class="t-go">⋯</span></button>`;
}

function viewProfil() {
  const adresse = CloudSync.getUser();
  if (!adresse) {
    return `<div class="card"><div class="card-head"><h2>${trad('Ton compte')}</h2></div>
      <p class="muted">${trad('Cette instance ne tient pas de comptes séparés : il n’y a pas de profil à afficher.')}</p>
    </div>`;
  }
  return `
  <div class="card">
    <div class="card-head"><h2>${trad('Ton compte')}</h2></div>
    <div class="modal-champs">
      <div class="field">
        <label>${trad('Adresse de connexion')}</label>
        <div class="valeur-fixe">${esc(adresse)}</div>
      </div>
    </div>
    <p class="muted">${trad('Tu te connectes avec un code envoyé à cette adresse. Il n’y a pas de mot de passe à retenir.')}</p>
  </div>

  <div class="card">
    <div class="card-head"><h2>${trad('Tes données')}</h2></div>
    <p class="muted">${trad('Ton patrimoine est enregistré sous ton compte et te suit d’un appareil à l’autre. Les sauvegardes et l’export vivent dans Données.')}</p>
    <div class="fiche-actes centre">
      <a class="btn sm ghost" href="#/data">${trad('Aller à Données')}</a>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>${trad('Quitter Longward')}</h2></div>
    <p class="muted">${trad('La suppression efface ton compte, ton patrimoine et tes sessions. Elle est immédiate et ne s’annule pas. Exporte tes données avant si tu veux les garder.')}</p>
    <div class="fiche-actes centre">
      <button class="btn ghost danger" data-action="effacer-identite">${trad('Effacer mon compte et mes données')}</button>
    </div>
  </div>`;
}

function ligneReglage({ action, label, valeur, sous = '', titre = '' }) {
  return `
      <button type="button" class="regl-ligne" data-action="${action}"${titre ? ` title="${esc(titre)}"` : ''}>
        <span class="regl-txt"><b>${esc(label)}</b>${sous ? `<span class="sub">${esc(sous)}</span>` : ''}</span>
        <span class="regl-val">${esc(valeur)}</span>
        <span class="regl-chev" aria-hidden="true">›</span>
      </button>`;
}
function ligneBascule({ action, cle = '', label, sous = '', on, titre = '' }) {
  return `
      <button type="button" class="regl-ligne regl-bascule${on ? ' on' : ''}" data-action="${action}"${
        cle ? ` data-cle="${esc(cle)}"` : ''} role="switch" aria-checked="${on ? 'true' : 'false'}"${
        titre ? ` title="${esc(titre)}"` : ''}>
        <span class="regl-txt"><b>${esc(label)}</b>${sous ? `<span class="sub">${esc(sous)}</span>` : ''}</span>
        <span class="bascule-piste" aria-hidden="true"><i></i></span>
      </button>`;
}
function libellePlace(v) {
  for (const [, places] of EXCHANGES) for (const [val, l] of places) if (val === v) return l;
  return v;
}
const libelleJour = j => j === 1 ? trad('1er du mois') : trad('{j} du mois').replace('{j}', j);
const LIBELLES_THEME = () => ({ system: t('settings.theme.system'), light: t('settings.theme.light'), dark: t('settings.theme.dark') });

function viewSettings() {
  const m = Store.state.meta;
  const langue = (LANGS.find(([c]) => c === currentLang()) || LANGS[0])[1];
  return `
  <header class="page-tete">
    <h2>${t('view.settings')}</h2>
    <p>${trad('Personnalise ton expérience Longward.')}</p>
  </header>
  <div class="colonnes-bureau">
  <section class="regl-groupe">
    <h3 class="surtitre">${t('settings.general')}</h3>
    <div class="regl-liste">
      ${ligneReglage({ action: 'regl-theme', label: t('settings.theme'), valeur: LIBELLES_THEME()[themeChoisi()] || t('settings.theme.dark') })}
      ${ligneReglage({ action: 'regl-langue', label: t('settings.language'), valeur: langue, sous: t('settings.language.hint') })}
      ${ligneReglage({ action: 'regl-devise', label: trad('Devise principale'),
          valeur: trad((DEVISES_BASE.find(([id]) => id === deviseBase()) || DEVISES_BASE[0])[1]) })}
      ${ligneBascule({ action: 'regl-retenir', label: trad('À retenir sur l’Aperçu'),
          sous: trad('Une lecture courte de ta situation, en haut de l’Aperçu.'),
          on: !retenirMasquee() })}
    </div>
  </section>
  <section class="regl-groupe">
    <h3 class="surtitre">${t('settings.behaviour')}</h3>
    <div class="regl-liste">
      ${ligneBascule({ action: 'regl-autorefresh', label: trad('Actualisation automatique'),
          sous: trad('Actualise les cours à l’ouverture de Longward'), on: !!m.autoRefresh,
          titre: t('settings.autorefresh.hint') })}
      ${ligneReglage({ action: 'regl-place', label: trad('Marché privilégié'), valeur: libellePlace(m.preferredExchange ?? '.PA'),
          titre: trad('Départage un titre coté sur plusieurs marchés') })}
    </div>
  </section>
  ${viewNotifs()}`;
}

function alertesMasquees() {
  const cles = notifsMasquees();
  const toutes = healthChecks().map(n => ({ ...n, cle: n.cle || cleNotif(n) }));
  const visibles = toutes.filter(n => cles.includes(n.cle));
  return { visibles, perimees: cles.filter(c => !toutes.some(n => n.cle === c)).length };
}

const SOUS_FAMILLES = () => ({
  saisies:   trad('Relevés et dépenses à compléter'),
  cours:     trad('Cours manquant ou périmé'),
  credits:   trad('Capital restant dû ou mensualité incohérente'),
  echeances: trad('Remboursement attendu ou retard'),
  budget:    trad('Objectif ou épargne de précaution'),
  coherence: trad('Valeur impossible ou incohérente'),
  synchro:   trad('Modification non synchronisée'),
});
function viewNotifs() {
  const reg = reglagesNotifs();
  const actives = FAMILLES_NOTIF.filter(([c]) => reg[c]).length;
  const enCours = notifications().length;
  const masquees = alertesMasquees();
  const nbMasquees = masquees.visibles.length + masquees.perimees;
  const sous = SOUS_FAMILLES();
  return `
  <section class="regl-groupe regl-notifs">
    <div class="regl-tete">
      <h3 class="surtitre">${trad('Notifications')}</h3>
      <span class="regl-compte">${trad('{n} sur {t} activées').replace('{n}', actives).replace('{t}', FAMILLES_NOTIF.length)}</span>
    </div>
    <div class="regl-liste">
      ${FAMILLES_NOTIF.map(([cle, nom, quoi]) => ligneBascule({
        action: 'famille-notif', cle, label: nom, sous: sous[cle] || quoi, on: reg[cle] })).join('')}
    </div>
    <p class="regl-note">${trad('Une famille éteinte ne compte plus dans la pastille de la cloche.')}</p>
  </section>
  <section class="regl-groupe">
    <h3 class="surtitre">${trad('Rappels')}</h3>
    <div class="regl-liste">
      ${ligneReglage({ action: 'regl-jour', label: trad('Jour du rappel'), valeur: libelleJour(jourRappel()),
          sous: trad('Les saisies mensuelles sont rappelées à partir de cette date.') })}
    </div>
  </section>
  <section class="regl-groupe">
    <h3 class="surtitre">${trad('Alertes')}</h3>
    <div class="regl-liste">
      ${ligneReglage({ action: 'alertes-en-cours', label: trad('Alertes en cours'), valeur: String(enCours),
          sous: trad('Ce que la cloche affiche en ce moment') })}
      ${ligneReglage({ action: 'alertes-masquees', label: trad('Alertes masquées'), valeur: String(nbMasquees),
          sous: trad('Restent vraies, ne s’affichent plus') })}
    </div>
  </section>
  </div>`;
}

/* UNE FEUILLE DE CHOIX : la fenetre de la maison, sans champ ni bouton de
   validation. Chaque option est une ligne, la courante porte une coche, et
   toucher une ligne choisit et referme. `grille` range les options en sept
   colonnes : c'est la forme d'un jour du mois. `groupe` sur une option ouvre
   un surtitre au-dessus d'elle. Resout la valeur choisie, ou null. */
/* CONFIGURONS TON LONGWARD : LA DEVISE, AVANT LE PREMIER MONTANT.

   Une micro-etape, pas un cinquieme pas. Le guide en compte quatre et les
   garde : celle-ci n'est pas numerotee, ne s'affiche pas dans la liste et ne
   revient jamais. Deux cartes, un bouton, deux secondes.

   AUCUNE DES DEUX N'EST PRESELECTIONNEE. Un euro deja coche serait valide sans
   etre lu, et un americain repartirait avec la mauvaise unite sans l'avoir
   choisie. Le bouton attend donc un choix.

   LA LANGUE NE REPOND PAS A LA PLACE. Elle ordonne les cartes -- l'anglais voit
   le dollar en premier -- et s'arrete la. Un francais peut compter en dollars,
   un anglophone vivant en France en euros ; deduire l'un de l'autre serait se
   tromper sur une personne sur deux.

   Rend `true` si la suite peut s'ouvrir : devise deja connue, ou choisie a
   l'instant. `false` si la fenetre a ete fermee, et alors rien ne s'ouvre. */
function choixDevise() {
  return new Promise(resolve => {
    const m = $('#modal');
    apercuOuvert = null;
    $('#modalTitle').textContent = trad('Configurons ton Longward');
    $('#modalSub').textContent = trad('Tous les montants de ton Longward seront lus dans cette devise.');
    const ordre = enAnglais() ? ['USD', 'EUR'] : ['EUR', 'USD'];
    $('#modalBody').innerHTML = `
      <p class="devise-question">${trad('Quelle est ta devise principale ?')}</p>
      <div class="devise-choix" role="radiogroup"
           aria-label="${esc(trad('Quelle est ta devise principale ?'))}">
        ${ordre.map(id => `
        <button type="button" class="devise-carte" role="radio" aria-checked="false" data-v="${id}">
          <span class="devise-signe" aria-hidden="true">${symboleDevise(id)}</span>
          <span class="devise-txt"><b>${id}</b><span class="sub">${esc(trad(NOMS_DEVISE[id]))}</span></span>
        </button>`).join('')}
      </div>`;
    $('#modalFoot').innerHTML =
      `<button class="btn" id="devOk" type="button" disabled>${trad('Continuer')}</button>`;
    montrerModal(m);
    let choix = null;
    const fermer = v => {
      masquerModal(m);
      $('#modalClose').onclick = null; $('#modalBody').onclick = null;
      resolve(v);
    };
    $('#modalBody').onclick = e => {
      const b = e.target.closest('.devise-carte');
      if (!b) return;
      choix = b.dataset.v;
      $$('#modalBody .devise-carte').forEach(x => {
        const on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      $('#devOk').disabled = false;
      retourHaptique();
    };
    $('#devOk').onclick = () => {
      if (!choix) return;
      Store.state.meta.devise = choix;
      Store.state.meta.deviseChoisie = true;
      Store.save();
      majOnglets(); render();
      fermer(true);
    };
    $('#modalClose').onclick = () => fermer(false);
  });
}

async function devisePosee() {
  if (!deviseAChoisir()) return true;
  return await choixDevise();
}

function askOptions({ titre, sous = '', options, valeur, grille = false }) {
  return new Promise(resolve => {
    const m = $('#modal');
    apercuOuvert = null;
    $('#modalTitle').textContent = titre;
    $('#modalSub').textContent = sous;
    $('#modalBody').innerHTML = `
      <div class="choix-liste${grille ? ' choix-grille' : ''}" role="radiogroup">
        ${options.map(o => `${o.groupe ? `<span class="surtitre choix-groupe">${esc(o.groupe)}</span>` : ''}
        <button type="button" class="choix-ligne${String(o.v) === String(valeur) ? ' on' : ''}"
                role="radio" aria-checked="${String(o.v) === String(valeur)}" data-v="${esc(String(o.v))}">
          <span class="choix-txt"><b>${esc(o.l)}</b>${o.sous ? `<span class="sub">${esc(o.sous)}</span>` : ''}</span>
          <span class="choix-coche" aria-hidden="true">✓</span>
        </button>`).join('')}
      </div>`;
    $('#modalFoot').innerHTML = `<button class="btn ghost" id="chxCancel" type="button">${trad('Annuler')}</button>`;
    montrerModal(m);
    const courant = $('#modalBody .choix-ligne.on') || $('#modalBody .choix-ligne');
    if (courant) { courant.scrollIntoView({ block: 'nearest' }); focusChamp(courant); }
    const fermer = v => { masquerModal(m); $('#modalClose').onclick = null; $('#modalBody').onclick = null; resolve(v); };
    $('#chxCancel').onclick = () => fermer(null);
    $('#modalClose').onclick = () => fermer(null);
    $('#modalBody').onclick = e => { const b = e.target.closest('.choix-ligne'); if (b) { retourHaptique(); fermer(b.dataset.v); } };
  });
}

/* UNE FEUILLE D'ALERTES : la meme fenetre, avec un corps qui se REDESSINE. Les
   lignes portent des actions de la page (masquer, reafficher, tout reafficher),
   et ces actions changent ce que la feuille montre : elles rappellent
   `rafraichirFeuille()` apres coup, tant que la feuille est ouverte. */
let feuilleCourante = null;
function ouvrirFeuille({ titre, sous = '', corps, pied = '' }) {
  const m = $('#modal');
  apercuOuvert = null;
  $('#modalTitle').textContent = titre;
  $('#modalSub').textContent = sous;
  feuilleCourante = () => { $('#modalBody').innerHTML = corps(); const f = $('#modalFoot'); f.innerHTML = typeof pied === 'function' ? pied() : pied; };
  feuilleCourante();
  montrerModal(m);
  $('#modalClose').onclick = fermerFeuille;
}
function fermerFeuille() {
  feuilleCourante = null;
  const m = $('#modal');
  if (m) { masquerModal(m); $('#modalClose').onclick = null; }
}
function rafraichirFeuille() { if (feuilleCourante && !$('#modal').hidden) feuilleCourante(); }

function feuilleAlertesEnCours() {
  ouvrirFeuille({
    titre: trad('Alertes en cours'), sous: trad('Ce que la cloche affiche en ce moment'),
    corps: () => {
      const n = notifications();
      if (!n.length) return `<p class="empty">${trad('Aucune alerte en cours.')}</p>`;
      return `<div class="alertes">${n.map(x => `
        <div class="alerte-ligne">
          <span class="controle-ic" aria-hidden="true">${ICONE_NOTIF[x.level] || '•'}</span>
          <div class="controle-texte"><b>${esc(x.title)}</b><span class="sub">${escMontant(x.detail)}</span></div>
          <span class="alerte-actes">
            <button type="button" class="btn sm ghost" data-action="alerte-voir" data-view="${esc(x.view)}">${trad('Voir')}</button>
            <button type="button" class="btn icon xs" data-action="masquer-notif" data-cle="${esc(x.cle)}"
                    title="${trad('Ne plus signaler')}" aria-label="${trad('Ne plus signaler')} : ${esc(x.title)}">✕</button>
          </span>
        </div>`).join('')}</div>`;
    },
    pied: `<button class="btn ghost" type="button" data-action="fermer-feuille">${trad('Fermer')}</button>`,
  });
}
function feuilleAlertesMasquees() {
  ouvrirFeuille({
    titre: trad('Alertes masquées'), sous: trad('Ces alertes restent vraies mais ne sont plus affichées.'),
    corps: () => {
      const { visibles, perimees } = alertesMasquees();
      if (!visibles.length && !perimees) return `<p class="empty">${trad('Aucune alerte masquée.')}</p>`;
      return `<div class="alertes">${visibles.map(x => `
        <div class="alerte-ligne">
          <span class="controle-ic" aria-hidden="true">${ICONE_NOTIF[x.level] || '•'}</span>
          <div class="controle-texte"><b>${esc(x.title)}</b><span class="sub">${escMontant(x.detail)}</span></div>
          <button type="button" class="btn sm ghost" data-action="reafficher-notif" data-cle="${esc(x.cle)}">${trad('Réafficher')}</button>
        </div>`).join('')}</div>${perimees ? `<p class="regl-note">${
          trad(perimees > 1 ? '{n} alertes masquées ne correspondent plus à rien aujourd’hui.' : '{n} alerte masquée ne correspond plus à rien aujourd’hui.').replace('{n}', perimees)}</p>` : ''}`;
    },
    pied: () => (alertesMasquees().visibles.length || alertesMasquees().perimees)
      ? `<button class="btn ghost" type="button" data-action="fermer-feuille">${trad('Fermer')}</button>
         <button class="btn" type="button" data-action="rendre-notifs">${trad('Tout réafficher')}</button>`
      : `<button class="btn ghost" type="button" data-action="fermer-feuille">${trad('Fermer')}</button>`,
  });
}

const A_PLAT = trad('sans rendement');

const NOM_LIGNE_MAX = 30;

Object.defineProperty(window, 'projHorizon', {
  get: () => num(Store.state?.meta?.projHorizon) || 20,
  set: v => { Store.state.meta.projHorizon = num(v) || 20; },
});

/* Le sélecteur d'horizon, écrit une fois pour ses deux portes.

   Une seule valeur, donc, et deux endroits qui l'écrivent. C'est le motif déjà
   retenu pour l'année du journal : deux portes sur un même champ sont saines,
   puisqu'il n'y a qu'une valeur et que changer l'une déplace l'autre. Ce qui
   serait fautif, ce sont deux valeurs rangées séparément — et c'est ce qu'on
   vient de retirer.

   Rien n'est perdu de la ligne libre : `capitalisation()` ajoute toujours
   l'horizon courant à ses jalons, donc choisir 60 ans fait apparaître la ligne
   60 ans dans le tableau, à sa place chronologique, et le graphique et le total
   de la première carte y vont avec. */
const selecteurHorizon = () => {
  const choix = PROJECTION_CHOICES.includes(projHorizon)
    ? PROJECTION_CHOICES
    : [...PROJECTION_CHOICES, projHorizon].sort((a, b) => a - b);
  return `
  <select data-action-change="proj-horizon" style="width:auto">
    ${choix.map(h => `<option value="${h}" ${h === projHorizon ? 'selected' : ''}>
      ${h} ${trad('ans')}, ${new Date().getFullYear() + h}</option>`).join('')}
  </select>`;
};

let hypoOuvert = false;
let avanceOuvert = false;

const carteObjectif = () => {
  const g = objectiveStatus();
    const an = Store.state.meta.objectiveYear;
    const mois = monthsToObjective();

    /* Pas d'objectif déclaré, pas de carte : une ligne, et de quoi en poser un.

       Rendue avec un objectif a zero, la carte se tromperait : zero donne
       `remaining = total`, donc un montant positif, et elle annoncerait
       « +30 500 EUR de depassement · Objectif atteint » sur un cap que personne
       n'a fixe. Une carte qui se felicite d'un objectif inexistant est pire
       qu'une carte qu'on ne veut pas.

       Mettre la cible à zéro est donc la sortie, et c'est la bonne : un état se
       déclare. Pas d'interrupteur « masquer cette carte » — un réglage dont le
       seul effet est de cacher quelque chose double la question, puisqu'il
       faudrait ensuite se souvenir qu'on l'a caché.

       Mais elle ne se verrouille pas : la carte est la seule porte vers ce
       réglage, la faire disparaître entièrement enfermerait dehors quiconque
       change d'avis. Il reste donc une ligne, discrète, qui ouvre la même
       fenêtre. */
    if (!(num(g.obj) > 0)) return aUnComptePropre() ? `
  <button type="button" class="card goal card-link goal-vide" data-action="apercu"
          data-apercu="objectif" title="${trad('Fixer un objectif de patrimoine')}">
    <span>${trad('Aucun objectif fixé pour {a}').replace('{a}', esc(an))}</span>
    <span class="muted">${trad('En poser un →')}</span>
  </button>` : '';

    const p = progressionObjectif(g);
    const etatDit = p.etat === 'inconnu' ? trad('point de départ à définir')
      : p.etat === 'atteinteAuDepart' ? trad('cible déjà atteinte au départ')
      : p.etat === 'atteint' ? trad('objectif atteint')
      : p.etat === 'enBaisse' ? trad('sous le point de départ')
      : `${fmtPct(p.pct, 1)} ${trad('du chemin parcouru')}`;
    return `
  <button type="button" class="card goal card-link" data-action="apercu" data-apercu="objectif"
          title="${trad('Modifier l\'objectif')}">
    <div class="card-head">
      <h2>${trad('Objectif à fin')} ${esc(an)}</h2>
      <span class="hint">${mois
        ? `${mois} ${mois > 1 ? trad('mois restants') : trad('mois restant')}`
        : trad('dernier mois')} · ${etatDit}</span>
    </div>
    <div class="goal-top">
      <b class="${g.remaining >= 0 ? 'up' : ''}">${g.remaining >= 0
        ? `+${fmtEUR0(g.remaining)}` : fmtEUR0(Math.abs(g.remaining))}</b>
      <span class="muted">${g.remaining >= 0
        ? trad('de dépassement')
        : mois
          ? `${trad('restants, soit')} ${fmtEUR0(-g.remaining / mois)} ${trad('/ mois sur')} ${mois} ${trad('mois')}`
          : trad('restants avant la fin de l’année')}</span>
    </div>
    ${p.pct == null ? '' : `<div class="goal-bar"><div class="goal-fill" style="width:${p.barre.toFixed(2)}%"></div></div>`}
    <div class="goal-foot">
      <span>${fmtEUR0(g.total)} <span class="muted">${trad('sur.objectif', 'sur')} ${fmtEUR0(g.obj)}</span></span>
      <span>${g.remaining >= 0 ? `${trad('Objectif atteint')} 🎉` : ''}</span>
    </div>
    ${p.depart ? `<span class="goal-depart muted">${trad('Départ')}${deuxPoints()} ${trad('{v} le {d}')
      .replace('{v}', fmtEUR0(p.depart.valeur)).replace('{d}', esc(fmtDate(p.depart.date)))}</span>` : ''}
  </button>`;
};

const ageDetaille = a => !a ? '' : (a.mois === 0
  ? `${a.annees} ${trad('ans')}`
  : trad(a.mois === 1 ? '{a} ans et 1 mois' : '{a} ans et {m} mois')
      .replace('{a}', a.annees).replace('{m}', a.mois));
const ageCompact = a => !a ? '' : `${a.annees} ${trad('ans')}`;

function viewObjective() {
  if (!(patrimoine().brut > 0.005) && !(num(Store.state.meta.projMonthly) > 0)) {
    return pageAvantDonnees('Une projection part de ce que tu as et de ce que tu mets de '
      + 'côté chaque mois. Sans l’un ni l’autre, elle ne peut que multiplier zéro par les '
      + 'années. Déclare un compte, ou règle un versement mensuel dans tes hypothèses.');
  }
  const g = objectiveStatus();
  const s = projectionSettings();
  const versementInconnu = !(num(s.monthly) > 0) && pasAFaire('revenus');
  const ditVersement = versementInconnu
    ? trad('versement à définir') : `${fmtEUR0(s.monthly)} ${trad('/ mois')}`;
  const p = capitalisation({ years: projHorizon });
  const dernier = p.points[p.points.length - 1];
  const ageFin = ageAuPoint(dernier);
  const anneeAtteinte = p.targetReached;

  const listeChoix = (path, paliers, valeur, format) => {
    const v = valeur != null ? valeur : num(getPath(path));
    const options = paliers.includes(v) ? paliers : [...paliers, v].sort((a, b) => a - b);
    return options.map(o =>
      `<option value="${o}" ${o === v ? 'selected' : ''}>${format(o)}</option>`).join('');
  };
  /* L'explication passe dans l'info-bulle du libelle, plus sous le selecteur.

     Les cinq reglages portaient chacun une phrase en dessous, dont deux de
     trois lignes. Le depliant faisait donc quinze lignes de prose pour cinq
     menus : on ne voyait plus les reglages, seulement le texte qui les entoure.
     Et ces phrases se lisent une fois — la premiere — puis encombrent toutes
     les visites suivantes.

     Le « ? » les garde a portee sans les imposer. C'est le motif deja employe
     partout ailleurs sur les titres de cartes, et depuis peu sur les intitules
     de colonnes du tableau du jour.

     `aideTexte` et non `aide` en parametre : le second nom est celui de la
     fonction appelee juste dessous, et le masquer ici aurait rendu le champ
     muet sans qu'aucune erreur ne le signale. */
  /* `sous` : une ligne d'annotation sous le controle, pour dire d'ou vient une
     valeur que l'application a calculee. Le « ? » du libelle explique la notion,
     cette ligne dit la provenance — deux questions differentes, et celle de la
     provenance ne doit pas demander un survol. */
  const champ = (label, path, paliers, format, aideTexte, valeur, sous) => `
    <div class="field">
      <label>${esc(trad(label))}${aideTexte ? aide(aideTexte) : ''}</label>
      <select data-path="${path}" data-type="num">
        ${listeChoix(path, paliers, valeur, format)}
      </select>
      ${sous ? `<span class="hint">${sous}</span>` : ''}
    </div>`;

  /* Le meme champ, pour une valeur qui n'est pas un nombre. `champ()` pose
     `data-type="num"` et sa liste de paliers : une destination n'est ni l'un ni
     l'autre, et l'y forcer aurait converti « marche » en zero. */
  const champText = (label, path, options, valeur, aideTexte, sous) => `
    <div class="field">
      <label>${esc(trad(label))}${aideTexte ? aide(aideTexte) : ''}</label>
      <select data-path="${path}">
        ${options.map(([v, l]) => `<option value="${esc(v)}" ${v === valeur ? 'selected' : ''}
          >${esc(trad(l))}</option>`).join('')}
      </select>
      ${sous ? `<span class="hint">${sous}</span>` : ''}
    </div>`;

  const champDate = (label, path, valeur, aideTexte) => `
    <div class="field">
      <label>${esc(trad(label))}${aideTexte ? aide(aideTexte) : ''}</label>
      <input type="date" data-path="${path}" value="${esc(valeur || '')}" max="${todayISO()}">
    </div>`;
  const paliers = (max, pas, depuis = 0) =>
    Array.from({ length: Math.floor((max - depuis) / pas) + 1 }, (_, i) => depuis + i * pas);

  return `
  ${(() => {
    /* CE QUE TU VERSES, ET RIEN D'AUTRE.

       Ce montant ne vaut pas `contributed - g.total` : `contributed` porte aussi
       la part plate, qui MONTE a mesure que le credit s'amortit, et la
       difference melangerait les versements et le capital rembourse. Sur un
       appartement de 300 000 EUR finance a 200 000, avec « 0 € / mois » ecrit
       deux lignes plus bas, la carte annoncerait pres de 200 000 EUR verses.

       Les deux effets se separent, et ils s'additionnent toujours exactement au
       total : depart + versements + capital rembourse + rendement. */
    const verses = num(dernier.mois) * num(s.monthly);
    const rembourse = num(dernier.capitalRendu);
    const plat = num(p.plat);
    const detailPlat = partPlateDetail();
    const biensNets = num(detailPlat.biensNets);
    const aDesBiens = num(detailPlat.biens) > 0.005 || num(detailPlat.dettesBiens) > 0.005;
    const parts = [
      { label: trad('Ce que tu as déjà'), value: g.total - plat, couleur: 'var(--series-3)', apercu: 'baseProjection' },
      ...(aDesBiens ? [{ label: num(nowTotals().biens) > 0.005
               ? (num(nowTotals().immoDirect) > 0.005
                    ? trad('Ton immobilier et tes biens, nets')
                    : trad('Tes biens de valeur, nets'))
               : trad('Ton immobilier net'),
        value: biensNets, couleur: couleurClasse('immobilier'), apercu: 'immobilierNet', arg: 'biens',
        aide: trad('Aucun rendement ne lui est appliqué : la projection le porte tel quel') }] : []),
      { label: aDesBiens ? trad('Tes autres crédits') : trad('Tes crédits'),
        value: plat - (aDesBiens ? biensNets : 0), couleur: 'var(--muted)',
        apercu: 'immobilierNet', arg: 'autres',
        aide: trad('Ces crédits ne financent aucun bien détenu en direct : un prêt pour des parts de société, un prêt personnel, une dette sans destination connue. La projection les porte à leur montant, sans rendement.') },
      { label: trad('Ce que tu verses'), value: verses, couleur: S1(), apercu: 'horizon' },
      /* Le desendettement a sa part, sous son nom. Il ne se filtre pas quand il
         est nul : `filter` s'en charge deja pour toutes les parts. */
      { label: trad('Ce que ton crédit rembourse'), value: rembourse,
        couleur: 'var(--series-4)', apercu: 'immobilierNet',
        aide: trad('La part de tes mensualités qui efface du capital. Elle ne s’investit pas : elle fait monter ton patrimoine net en faisant baisser ta dette.') },
      /* Une seule ligne de rendement, et c'est un choix.

         Elle s'est coupee en deux, puis en trois, a mesure que les poches se
         multipliaient — et la ligne « Rendement du non cote » portait en fait le
         non cote PLUS le capital garanti PLUS les liquidites, parce qu'elle
         lisait `gainsAutres`. Un intitule qui nomme une poche et en somme trois
         est pire qu'un intitule general.

         Le detail par poche existe, et a sa place : le depliant des hypotheses
         donne un taux par poche, et « Ce que tu as deja » donne un montant par
         poche avec le taux qui lui est applique. Cette carte-ci repond a une
         autre question — depart, versements, rendement — et trois parts y
         suffisent. */
      { label: trad('Ce que le rendement ajoute'), value: dernier.gains,
        couleur: S2(), apercu: 'horizon',
        aide: trad('Chaque poche capitalise à son propre taux : déplie « Personnaliser les hypothèses » pour les voir') },
    ].filter(x => Math.abs(num(x.value)) > 0.005)
     .map(x => ({ ...x, pct: dernier.total ? num(x.value) / dernier.total * 100 : 0 }));
    /* Les parts a l'euro refont le total a l'euro : voir `arrondirParts`. */
    const partsArrondies = arrondirParts(parts.map(x => x.value), dernier.total);
    return `
  <div class="card repart" data-anchor="trajectoire">
    <div class="card-head">
      <h2>${trad('De quoi sera fait ton patrimoine')}</h2>
      <label class="row" style="gap:8px; font-size:var(--font-sm); color:var(--text-secondary)">
        ${trad('Horizon')}
        ${selecteurHorizon()}
      </label>
    </div>
    <div class="proj-tete">
      <span class="hero-label">${trad('Ton patrimoine en {a}').replace('{a}', dernier.year)}</span>
      <div class="hero-value">${fmtEUR0(dernier.total)}</div>
      ${s.inflation ? `<p class="hero-sous muted">${trad('soit {v} après inflation')
        .replace('{v}', fmtEUR0(dernier.real))}${
        aide(`${trad('Le même montant, une fois retirée une inflation de')} ${fmtPct(s.inflation, 0)} ${trad('par an pendant')} ${projHorizon} ${trad('ans. C’est ce que cette somme permettrait d’acheter aux prix que tu connais.')}`)
      }</p>` : ''}
    </div>
    <p class="small muted" style="margin:-6px 0 12px">${trad('Projette ton patrimoine '
      + 'selon ton épargne et différentes hypothèses de rendement.')}</p>
    ${parts.map((x, i) => `
      <button type="button" class="repart-ligne" data-action="apercu"
              data-apercu="${esc(x.apercu)}"${x.arg ? ` data-arg="${esc(x.arg)}"` : ''}
              title="${esc(x.aide || `${trad('Voir le détail de')} ${trad(x.label)}`)}">
        <span class="repart-haut">
          <span class="dot" style="background:${x.couleur}"></span>
          <span class="repart-nom">${esc(trad(x.label))}</span>
          <b${x.value < 0 ? ' class="dette"' : ''}>${fmtEUR0(partsArrondies[i])}</b>
          <span class="repart-pct">${fmtPct(x.pct, 1)}</span>
        </span>
        ${x.value > 0 ? `<span class="repart-barre"><i style="width:${largeurPart(x.pct)};background:${x.couleur}"></i></span>` : ''}
      </button>`).join('')}
    <!-- L'objectif de l'annee a sa propre carte en bas de page : il n'a rien a
         faire sous un total qui parle de ${dernier.year}, deux echeances, deux
         sujets. Le montant apres inflation se lit sous le total, en tete de
         carte, des que l'inflation est non nulle : un reglage sans effet visible
         serait un bouton mort, et sur vingt ans c'est le chiffre qu'on sait
         vraiment lire. -->
    ${s.target ? `<p class="ligne-cible">${trad('Cible de')} ${fmtEUR0(s.target)}${deuxPoints()}
      <b>${!anneeAtteinte ? trad('non atteinte sur l’horizon simulé')
        : anneeAtteinte.dejaAtteinte ? trad('déjà atteinte')
        : `${trad('vers')} ${moisEtAnnee(anneeAtteinte.year, anneeAtteinte.month)}`}</b>${
        !anneeAtteinte
        ? ` <span class="muted">(${trad('jusqu’en')} ${dernier.year})</span>`
        : anneeAtteinte.dejaAtteinte ? ''
        : ` <span class="muted">· ${trad('dans')} ${fmtDelaiMois(anneeAtteinte.monthsFromNow)}</span>`}</p>` : ''}
  </div>`;
  })()}

  <div class="grid g-1-2">
    <div class="card">
      <div class="card-head"><h2>${trad('Tes hypothèses')}</h2>
        <span class="hint">${trad('hypothèses de simulation, pas prévisions de marché')}</span></div>
      <details class="pli-reglages" ${hypoOuvert ? 'open' : ''} id="hypoDetail">
        <summary>
          <span class="pli-valeurs">${ditVersement} ·
            ${trad('scénario')} ${trad(nomScenario(s.scenario)).toLowerCase()}${
              num(s.target) ? ` · ${trad('cible')} ${fmtEUR0(s.target)}` : ''}</span>
          <span class="pli-action">${trad('Régler')}</span>
        </summary>
      <div class="modal-champs" style="margin-top:12px">
        ${champ('Versement mensuel', 'meta.projMonthly', paliers(10000, 50),
                v => `${fmtEUR0(v)} ${trad('/ mois')}`,
                trad('Le cash qui reste chaque mois : revenus moins charges fixes '
                  + 'moins dépenses moyennes. Le capital remboursé sur tes crédits '
                  + 'n’y est pas : il augmente ton patrimoine, mais il est déjà '
                  + 'parti avec la mensualité, donc il n’est pas disponible à '
                  + 'investir.'),
                s.monthly,
                /* La condition suit `monthlyAuto` et non la valeur : depuis que
                   zero veut dire zero, un versement fige a 0 est un choix. */
                (() => {
                  const suggere = suggestedMonthly();
                  const calcul = `<button type="button" class="mois-lien" data-action="apercu"
                             data-apercu="capaciteEpargne">${trad('Voir le calcul')}</button>`;
                  const rien = trad('Aucune capacité d’épargne positive connue dans Budget');
                  if (s.monthlyAuto) {
                    return `${suggere > 0 ? trad('Repris de ta capacité d’épargne dans Budget')
                                          : rien} ${calcul}`;
                  }
                  if (!(suggere > 0)) return `${trad('Valeur figée.')} ${rien} ${calcul}`;
                  return `${trad('Valeur figée. Ta capacité d’épargne est de')} ${fmtEUR0(suggere)}
                     ${calcul}
                     <button type="button" class="mois-lien" data-action="proj-use-budget"
                             >${trad('Reprendre ce montant')}</button>`;
                })())}
        ${champDate('Date de naissance', 'meta.naissance', Store.state.meta.naissance,
                trad('Elle ne sert qu’à afficher ton âge à chaque horizon. Elle reste dans ton '
                  + 'navigateur, comme le reste, et n’entre dans aucun calcul financier.'))}
        ${champText('Affectation des versements', 'meta.projVersementVers', VERSEMENT_VERS,
                s.versementVers,
                trad('Ces euros capitalisent au taux de la poche que tu choisis. '
                  + 'Sur les liquidités, ils s’accumulent sans rendement : c’est ce que fait '
                  + 'un livret que tu n’as pas déclaré rémunéré, et c’est le seul réglage '
                  + 'honnête si tu épargnes sans investir. '
                  + 'Un seul choix à la fois : la projection verse tout dans la poche '
                  + 'sélectionnée, elle ne répartit pas un versement entre plusieurs.'),
                trad('Où va ton épargne future.')
                  + (num(tauxDeDestination(s)) ? ''
                    : ' ' + trad('Cette poche ne produit aucun rendement dans les scénarios : '
                        + 'ce que tu y verses s’accumule sans grossir.')))}
        <div class="field">
          <label>${trad('Scénario de projection')}${aide(trad(
            'Ces valeurs sont des hypothèses de simulation, pas des prévisions de '
            + 'rendement. Les marchés peuvent évoluer très différemment. Le scénario '
            + 'fixe un rendement par poche ; tu peux les poser toi-même plus bas.'))}</label>
          ${choixHypothese(s.scenario)}
          <span class="hint">${trad(PHRASE_SCENARIO[s.scenario] || PHRASE_SCENARIO.perso)}</span>
          <span class="hint">${trad('Capital garanti')} ${fmtPct(s.rateGaranti, 1)} ${trad('par an')} ·
            ${trad('autres actifs')} ${num(s.rateAutres)
              ? `${fmtPct(s.rateAutres, 1)} ${trad('par an')}` : trad('valeur constante')} ·
            ${trad('liquidités')} ${trad('sans rendement')}</span>
        </div>
      <details class="pli-reglages pli-avance" id="hypoAvance"
               ${avanceOuvert || s.scenario === 'perso' ? 'open' : ''}>
        <summary>
          <span class="pli-valeurs">${trad('Personnaliser les hypothèses')}</span>
          <span class="pli-action">${s.scenario === 'perso'
            ? trad('personnalisé') : trad('Ouvrir')}</span>
        </summary>
        <div class="modal-champs" style="margin-top:8px">
        ${champ('Rendement des actifs de marché', 'meta.projRate', paliers(20, 1),
                v => `${fmtPct(v, 0)} ${trad('par an')}`,
                `${fmtEUR0(capitalisation({ years: 1 }).poches.marche)} ${trad('de portefeuille financier coté, auquel Longward applique le rendement du scénario. La crypto, les métaux précieux, le non coté et la pierre papier sont regroupés dans l’hypothèse « Autres actifs », juste en dessous.')} `
                + trad('C’est une hypothèse de travail : aucun rendement n’est garanti'),
                /* Le taux EN VIGUEUR, et non celui qui dort dans l'etat.
                   Ces trois champs lisaient `meta.projRate` et compagnie, alors
                   que c'est le scenario qui gouverne : « Dynamique » affichait
                   8 % sur son pave et « 0 % par an » dans le champ juste en
                   dessous. Un reglage qui montre autre chose que ce qu'il
                   commande n'est pas un reglage, c'est un piege. */
                s.rate)}
        ${champ('Rendement des autres actifs', 'meta.projRateAutres', paliers(20, 1),
                v => `${fmtPct(v, 0)} ${trad('par an')}`,
                `${fmtEUR0(capitalisation({ years: 1 }).poches.autres)} ${trad('de crypto, de métaux précieux, de non coté et de pierre papier. Valeur constante par défaut : trop incertains pour une hypothèse standard, et aucun rendement de SCPI ne s’invente ici')}`,
                s.rateAutres)}
        ${champ('Rendement du capital garanti', 'meta.projRateGaranti', paliers(8, 0.5),
                v => `${fmtPct(v, 1)} ${trad('par an')}`,
                `${fmtEUR0(capitalisation({ years: 1 }).poches.garanti)} ${trad('de fonds euros et de supports garantis. Le scénario y applique une hypothèse prudente, que tu peux changer ici')}`,
                s.rateGaranti)}

        <div class="field">
          <label>${trad('Rendement des liquidités')}${aide(
            `${fmtEUR0(capitalisation({ years: 1 }).poches.liquidites)} ${trad('de liquidités,')} `
            + trad('livret ou non, y compris le cash déjà chez ton courtier : tant qu’il '
            + 'n’est pas placé, il ne rapporte rien. Elles traversent donc la '
            + 'projection telles quelles, et il n’y a rien à régler.'))}</label>
          <p class="valeur-figee">0 % ${trad('par an')}</p>
        </div>
        ${champ('Inflation', 'meta.projInflation', paliers(20, 1),
                v => `${fmtPct(v, 0)} ${trad('par an')}`,
                trad('Les rendements des scénarios sont nominaux : l’inflation se retire '
                  + 'ensuite, une fois, sur le total. La ligne « Après inflation » donne '
                  + 'donc le résultat en euros d’aujourd’hui, c’est-à-dire ce que cette '
                  + 'somme permettrait d’acheter aux prix que tu connais.'))}
        </div>
      </details>
        ${champ('Cible', 'meta.projTarget',
                [0, 100000, 250000, 500000, 1000000],
                v => v ? fmtEUR0(v) : trad('Pas de cible'),
                trad('Optionnel. Si tu en poses une, la page dit en quelle année tu la franchis. '
                  + 'La cible se lit en euros courants, comme le total : elle se compare '
                  + 'au montant nominal, pas à sa valeur après inflation.'))}
      </div>
      </details>

      ${s.target && !anneeAtteinte ? `<div class="note" style="margin-top:12px">
        ${(() => {
            const req = targetRequirements({ target: s.target, years: projHorizon });
            const lignes = [];
            if (req.years) lignes.push(`${trad('attendre')} <b>${req.years.toFixed(1).replace('.', enAnglais() ? '.' : ',')} ${trad('ans')}</b> `
              + `(${trad('soit')} ${new Date().getFullYear() + Math.ceil(req.years)}) ${trad('sans rien changer')}`);
            if (req.monthly != null) lignes.push(`${trad('passer à')} <b>${fmtEUR0(req.monthly)} ${trad('par mois')}</b> `
              + `${trad('au lieu de')} ${fmtEUR0(s.monthly)}`);
            /* Le levier ne touche QUE le taux des actifs de marche :
               `targetRequirements` rejoue le moteur avec `rate` modifie et laisse
               les autres poches telles quelles. Sans le dire, « obtenir 8,4 %
               par an » se lisait comme un rendement du patrimoine entier, et
               personne n'aurait su quel reglage bouger. */
            if (req.rate != null) lignes.push(`${trad('obtenir')} <b>${fmtPct(req.rate, 1)} ${trad('par an')}</b> `
              + `${trad('sur les actifs de marché, au lieu de')} ${fmtPct(s.rate, 1)}`);
            return `⚠ <span>${trad('Avec ces hypothèses, la cible de')} <b>${fmtEUR0(s.target)}</b>
              ${trad('n’est pas atteinte en')} ${projHorizon} ${trad('ans : tu arrives à')} ${fmtEUR0(dernier.total)}.<br>
              ${trad('Pour y parvenir, il faudrait')} ${lignes.length ? '' : trad('revoir les hypothèses')}
              ${lignes.length ? `:<br>${lignes.map(l => `• ${l}`).join('<br>')}` : ''}
              ${req.rate == null && req.monthly != null
                ? `<br><span class="muted">${trad('Aucun rendement réaliste ne suffit à lui seul.')}</span>` : ''}</span>`;
        })()}
      </div>` : ''}

      <div class="note" style="margin-top:12px">
        ⓘ <span>${trad('Cette page applique une formule de capitalisation à')}
        <b>${trad('tes')}</b> ${trad('hypothèses. Ce n’est pas une prévision : un portefeuille réel '
        + 'ne progresse jamais de façon régulière, et une mauvaise séquence de '
        + 'marché en début de période change beaucoup le résultat.')}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>${trad('Trajectoire')}</h2>
        <span class="hint">${trad('Sur')} ${projHorizon} ${trad('ans, jusqu’en')} ${dernier.year}${
          ageFin ? ` · ${ageCompact(ageFin)}` : ''} · ${ditVersement}</span>
      </div>
      <div class="chart" id="chartProjection"></div>
      <div class="legend">
        <span><i style="background:${S1()}"></i>${trad('Ce que tu as déjà et ce que tu verses')}</span>
        <span><i style="background:${S2()}"></i>${trad('Ce que le rendement ajoute')}</span>
        <span><i class="legend-bande"></i>${trad('Avec ±2 points sur le rendement des actifs de marché')}</span>
      </div>
      <p class="small muted" style="margin:12px 0 0">
        ${fmtPct(s.rate)} ${trad('par an sur tes actifs de marché.')}
        ${num(pochesProjection().autres)
          ? (num(s.rateAutres) ? `${fmtPct(s.rateAutres)} ${trad('sur tes autres actifs.')}`
                               : trad('Tes autres actifs gardent leur valeur actuelle.'))
          : ''}
        ${trad('Tes liquidités gardent leur valeur, le cash qui attend chez ton courtier compris.')}
      </p>
      ${(() => {
        const t0 = nowTotals();
        const plat = num(p.plat), dettes = num(t0.dettes);
        /* La part plate porte l'immobilier ET les biens de valeur : la phrase
           doit nommer ce qu'elle couvre, sinon une montre seule ferait dire
           « ton immobilier » a quelqu'un qui n'en a pas.

           `immoDirect` et non `immo` : la classe couvre aussi la pierre papier,
           qui n'est plus gelee. Sans ca, quelqu'un dont tout l'immobilier est en
           SCPI lisait « Ton immobilier est porte a sa valeur d'aujourd'hui » sous
           une courbe ou cette SCPI n'a jamais ete portee a plat. */
        const aImmo = num(t0.immoDirect) > 0.005, aBiens = num(t0.biens) > 0.005;
        const sujet = aImmo && aBiens ? trad('Ton immobilier et tes biens sont portés à leur')
                    : aBiens ? trad('Tes biens de valeur sont portés à leur')
                    : trad('Ton immobilier est porté à sa');
        if (!plat && !dettes) return '';
        const note = txt => `<p class="small muted" style="margin:12px 0 0">${txt}</p>`;
        /* La note affirmait que « le capital que tes mensualites remboursent
           chaque mois » n'est pas projete. C'etait vrai d'une version anterieure
           du moteur, et c'est faux depuis : `moteurProjection` amortit les
           credits mois par mois et ajoute le capital rendu a la part plate, qui
           monte donc toute seule. Un texte qui dit le contraire de ce que le
           calcul fait est pire qu'un texte absent : il fait douter du chiffre
           juste.

           `dettesAmortissables()` decide, et il ne prend pas tout : un credit
           sans taux ni mensualite declares, ou dont la mensualite ne couvre pas
           ses interets, reste constant. La phrase suit donc ce que le moteur
           amortit reellement, et non ce qu'on aimerait qu'il amortisse. */
        const amortis = dettesAmortissables().length;
        const dette = !dettes ? ''
          : amortis
            ? ' ' + trad('Le capital que tes mensualités remboursent est projeté : cette part '
                + 'monte mois après mois, à mesure que la dette baisse. La mensualité libérée '
                + 'à la fin du prêt, elle, n’est pas réinvestie.')
            : ' ' + trad('Tes crédits restent à leur montant d’aujourd’hui : sans taux ni '
                + 'mensualité déclarés, leur remboursement ne peut pas être projeté, et la '
                + 'courbe sous-estime donc ton patrimoine.');
        const dp = partPlateDetail(t0);
        const biensNets = num(dp.biensNets), autres = num(dp.autresDettes);
        const aDesBiens = num(dp.biens) > 0.005 || num(dp.dettesBiens) > 0.005;
        const phraseBiens = !aDesBiens || Math.abs(biensNets) <= 0.005 ? ''
          : biensNets > 0
            ? `${sujet} ${trad('valeur d’aujourd’hui,')} ${fmtEUR0(biensNets)}${
                num(dp.dettesBiens) > 0.005 ? ' ' + trad('nets,') : ''}${trad(' du premier point au dernier : son prix '
                + 'ne monte ni ne baisse.')}`
            : `${trad('Tes crédits dépassent aujourd’hui la valeur de ton bien : cette part nette,')} ${
                fmtEUR0(biensNets)}${trad(', est portée telle quelle, le prix du bien ne bougeant pas.')}`;
        const phraseAutres = autres <= 0.005 ? ''
          : `${aDesBiens ? trad('Tes autres crédits sont portés à leur montant d’aujourd’hui,')
                         : trad('Tes crédits sont portés à leur montant d’aujourd’hui,')} ${fmtEUR0(autres)}.`;
        const tete = [phraseBiens, phraseAutres].filter(Boolean).join(' ');
        return note(tete ? `${tete}${dette}` : (dette || ' ').slice(1));
      })()}
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>${trad('Par horizon')}</h2>${dateNaissance() ? '' : `
      <span class="hint">${trad('Ajoute ta date de naissance pour voir ton âge dans la projection.')}</span>`}
      <span class="hint">${ditVersement} ·
        ${trad('scénario')} ${trad(nomScenario(s.scenario)).toLowerCase()}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>${trad('Horizon')}</th>
          <th class="large-seulement">${trad('Apports')}</th>
          <th class="large-seulement">${trad('Gains cumulés')}</th>
          <th>${trad('Patrimoine')}</th><th>${trad('Après inflation')}</th>
        </tr></thead>
        <tbody>${p.jalons.map(j => {
          const retenu = j.horizon === projHorizon;
          return `
          <tr class="${retenu ? 'jalon-retenu' : ''}"${retenu ? ' aria-current="true"' : ''}>
            <td class="name">${j.horizon} ${trad('ans')} <span class="muted">· ${j.year}</span>
              ${ageAuPoint(j) ? `<span class="sub">${ageDetaille(ageAuPoint(j))}</span>` : ''}</td>
            <td class="large-seulement">${fmtEUR0(j.contributed)}</td>
            <td class="up large-seulement">${fmtEUR0(j.gains)}</td>
            <td><b>${fmtEUR0(j.total)}</b></td>
            <td class="muted">${fmtEUR0(j.real)}</td>
          </tr>`;
        }).join('')}
        <tr class="ligne-libre">
          <td colspan="5">
            <label class="row" style="gap:8px">
              <span class="hint">${trad('Voir un autre horizon')}</span>
              ${selecteurHorizon()}
            </label>
          </td></tr></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:12px">
      ${trad('« Apports » : ce que tu as déjà,')} ${fmtEUR0(g.total)} ${trad('aujourd’hui, plus ce que tu verses. '
      + 'Chaque horizon est compté à partir d’aujourd’hui, donc à la même période de l’année.')}
    </p>
  </div>

  `;
}

function mountObjective() {
  const p = capitalisation({ years: projHorizon });
  const s = p.settings;
  const bas = capitalisation({ years: projHorizon, rate: num(s.rate) - 2 });
  const haut = capitalisation({ years: projHorizon, rate: num(s.rate) + 2 });
  const points = p.points.map((pt, i) => ({
    ...pt, bandeBas: bas.points[i].total, bandeHaut: haut.points[i].total,
  }));
  Charts.stackedArea($('#chartProjection'), {
    points, height: 320,
    bande: { min: 'bandeBas', max: 'bandeHaut' },
    series: [
      { key: 'contributed', label: trad('Départ et versements'), color: S1() },
      { key: 'gains', label: 'Rendement', color: S2() },
    ],
    guide: num(s.target) ? { value: num(s.target), label: 'Cible' } : null,
  });

  const hy = $('#hypoDetail');
  if (hy) hy.addEventListener('toggle', () => { hypoOuvert = hy.open; });
  const av = $('#hypoAvance');
  if (av) av.addEventListener('toggle', () => { avanceOuvert = av.open; });
}

partieChargee('assets/app-02-vue-ensemble.js');
