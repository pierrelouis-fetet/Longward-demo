/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function majBoutonLiqTout(fenetre) {
  const btn = fenetre && $('[data-action="liq-plier-tout"]', fenetre);
  if (!btn) return;
  const reste = $$('.liq-groupe .cpt-pli', fenetre).some(p => p.classList.contains('ouvert'));
  btn.textContent = reste ? trad('Tout replier') : trad('Tout déplier');
  btn.setAttribute('aria-expanded', String(reste));
}

function appliquerDiffere(bloc = $('#modalBody')) {
  if (!bloc) return false;
  $$('[data-path]', bloc).forEach(applyField);
  if (bloc.dataset.differe !== undefined) bloc.dataset.differe = 'propre';
  return true;
}

/* La note sous le grand total d'un apercu : ce que la ligne pese dans le brut,
   sauf si le panneau donne la sienne.

   Une seule fonction pour l'ouverture du panneau et pour chaque mise a jour
   `live` : deux copies d'une meme phrase finissent par diverger, et la note
   dirait une chose a l'ouverture et une autre a la premiere frappe. */
/* `calcule` : le total est la somme des lignes de la fenetre, et la note le dit,
   pour qu'on ne le prenne pas pour un montant a corriger. */
const noteApercu = a => a.totalNote
  || `${a.calcule ? `${trad('Total calculé')} · ` : ''}${
    fmtPct(patrimoine().brut ? a.total / patrimoine().brut * 100 : 0, 1)} ${trad('de tes avoirs')}`;

function openApercu(cle, arg) {
  const a = APERCUS[cle]?.(arg);
  if (!a) return;
  apercuOuvert = cle;
  apercuArg = arg;
  $('#modalTitle').textContent = a.titre;
  /* `sousAction` : une commande de lecture posee au bout du sous-titre. Elle
     n'est pas echappee -- c'est du balisage que le panneau fournit, comme `html`
     juste en dessous -- et le sous-titre, lui, l'est toujours. */
  $('#modalSub').innerHTML = escMontant(a.sous) + (a.sousAction || '');
  $('#modalSub').classList.toggle('avec-action', !!a.sousAction);
  $('#modalBody').classList.remove('tout-voir');
  $('#modalBody').innerHTML = collerAides(`
    <div class="modal-total"><b>${a.totalTexte || fmtEUR(a.total)}</b>
      <span>${escMontant(noteApercu(a))}</span></div>
    ${a.avant || ''}

    ${a.champs ? `<div class="modal-champs">${a.champs.map(c => `
      <div class="field">
        <label>${esc(c.label)}</label>
        ${c.options
          ? `<select data-path="${esc(c.path)}" data-type="num">${c.options.map(([v, l]) =>
              `<option value="${v}" ${String(v) === String(getPath(c.path)) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
          : `<input type="number" step="${c.step || 1}" data-path="${esc(c.path)}" value="${getPath(c.path) ?? ''}">`}
      </div>`).join('')}</div>` : ''}

    ${a.html || `<table><tbody>${(a.lignes || []).map((l, i) => `<tr${
      a.montrer && i >= a.montrer ? ' class="apercu-surplus"' : ''}>
      <td class="name">${nomLigneApercu(l)}${l.meta ? `<span class="sub">${escMontant(l.meta)}</span>` : ''}</td>
      <td class="${l.perf != null ? cls(l.perf) : 'muted'}">${l.perf != null ? fmtSignedPct(l.perf, 1) : ''}</td>
      <td>${l.champ
        ? `<input type="number" step="any" data-path="${esc(l.champ)}" value="${getPath(l.champ) ?? 0}" class="champ-inline">`
        : l.valeur == null
          ? `<span class="muted petit">${trad('prix de revient manquant')}</span>`
          : `<b>${fmtEUR(l.valeur)}</b>`}</td>
    </tr>`).join('')}${a.montrer && (a.lignes || []).length > a.montrer ? `
    <tr class="apercu-plus"><td colspan="3">
      <button type="button" class="btn sm ghost" data-action="apercu-voir-tout">${
        trad('Voir les {n} autres').replace('{n}', a.lignes.length - a.montrer)}</button>
    </td></tr>` : ''}</tbody></table>`}`);
  /* Une fenetre ou l'on saisit porte "Enregistrer", et rien n'entre dans
     l'etat avant le clic.

     Le mecanisme est celui de la fiche d'une ligne : `data-differe` sur le corps,
     les deux ecouteurs de champs le respectent, `appliquerDiffere()` applique tout
     au clic. Le bouton "aller ailleurs" ne s'affiche donc pas quand il y a des
     champs : deux boutons pleins cote a cote, l'un qui enregistre et l'autre qui
     s'en va, se disputeraient le meme geste.

     Un panneau sans champ garde son renvoi : il n'y a rien a enregistrer. */
  /* On demande au DOM, pas a la description du panneau : un apercu peut poser ses
     champs par `champs`, par `lignes[].champ`, ou dans son propre `html` -- c'est
     le cas des liquidites. Un test sur les deux premiers seuls rendrait faux, et
     "Enregistrer" n'apparaitrait pas. Le balisage est la seule source qui
     connaisse les trois. */
  const saisissable = $$('#modalBody [data-path]').length > 0;
  $('#modalBody').dataset.differe = saisissable ? 'propre' : '';
  if (!saisissable) delete $('#modalBody').dataset.differe;
  const ailleurs = a.vue && a.vue !== currentView() && !saisissable;
  $('#modalFoot').innerHTML =
    `<button class="btn ghost" data-action="modal-close">${trad('Fermer')}</button>
     ${saisissable ? `<button class="btn" data-action="apercu-enregistrer">${trad('Enregistrer')}</button>` : ''}
     ${ailleurs ? `<button class="btn" data-action="goto" data-view="${a.vue}" data-anchor="${a.ancre}">${esc(a.cta)} →</button>` : ''}`;
  /* `montrerModal` et non `hidden = false` : c'est elle qui gele le fond. Sans
     elle, la page derriere resterait libre de defiler, et le `focus()`
     ci-dessous la ramenerait en haut -- un panneau fixe qui prend le focus fait
     remonter le document.

     `preventScroll` en plus, ceinture et bretelles : le focus reste utile au
     clavier, il n'a pas a deplacer quoi que ce soit. */
  montrerModal($('#modal'));
  if (!a.champs && !a.html && !(a.lignes || []).some(l => l.champ)) {
    $('#modalClose').focus({ preventScroll: true });
  }
}

function ficheDeBarre(d) {
  if (!d) return null;
  const base = rebalanceRows().base;
  const lignes = d.lignes.map(l => ({
    label: l.nom,
    meta: [d.classe ? null : ASSET_CLASSES[l.classe],
           d.role ? null : ROLES[l.role],
           l.compte, l.etab].filter(Boolean).join(' · '),
    valeur: l.valeur,
    ouvre: { action: 'open-position', i: l.i },
  }));
  return {
    titre: d.label,
    sous: lignes.length ? `${lignes.length} ligne${lignes.length > 1 ? 's' : ''}`
                        : 'aucune ligne ici',
    total: d.total,
    totalNote: `${fmtPct(base ? d.total / base * 100 : 0, 1)} ${BASES.baseCibles.de}`,
    lignes,
    vue: 'positions', ancre: '', cta: trad('Ouvrir Marchés'),
  };
}

/* L'intitule d'une ligne d'apercu, cliquable ou non.

   `route` mene a une page -- la fiche d'un compte, celle d'un etablissement.
   `ouvre` declenche une action, parce que tout ce qui s'ouvre n'est pas une
   page : la fiche d'une ligne de titres est une fenetre. Sans ce second
   chemin, cliquer un titre dans les actifs de marche menerait au compte qui
   l'heberge, pas a la ligne. */
function nomLigneApercu(l) {
  if (l.ouvre) {
    /* `donnees` : les attributs que l'action attend, quels qu'ils soient. Une
       position se designe par son index, `data-i`, qui reste le defaut ; un
       credit, lui, se designe par son etablissement ET son rang chez lui. Une
       action qui a besoin de deux cles ne doit pas demander qu'on en invente une
       troisieme. */
    const donnees = Object.entries(l.ouvre.donnees || { i: l.ouvre.i })
      .map(([k, v]) => `data-${esc(k)}="${esc(String(v))}"`).join(' ');
    return `<button type="button" class="mois-lien" data-action="${esc(l.ouvre.action)}"
                    ${donnees}>${esc(l.label)}</button>`;
  }
  if (l.route) {
    return `<button type="button" class="mois-lien" data-action="aller-fiche"
                    data-route="${esc(l.route)}">${esc(l.label)}</button>`;
  }
  return esc(l.label);
}

function majApercu() {
  if (!apercuOuvert || $('#modal').hidden) return;
  const a = APERCUS[apercuOuvert]?.(apercuArg);
  if (!a) return;
  const total = $('#modalBody .modal-total b');
  if (total) total.innerHTML = fmtEUR(a.total);
  const note = $('#modalBody .modal-total span');
  if (note) note.innerHTML = escMontant(noteApercu(a));
  $('#modalTitle').textContent = a.titre;
  $('#modalSub').innerHTML = escMontant(a.sous || '');
  if (a.live) {
    const L = a.live();
    for (const el of $$('#modalBody [data-live]')) {
      if (L[el.dataset.live] != null) el.innerHTML = escMontant(L[el.dataset.live]);
    }
  }
  const cellules = $$('#modalBody table tbody tr');
  (a.lignes || []).forEach((l, i) => {
    const tr = cellules[i];
    if (!tr) return;
    const nom = tr.querySelector('.name');
    if (nom) nom.innerHTML = `${nomLigneApercu(l)}${l.meta ? `<span class="sub">${escMontant(l.meta)}</span>` : ''}`;
    const val = tr.querySelector('td:last-child b');
    if (val) val.innerHTML = fmtEUR(l.valeur);
  });
}

function closeApercu() {
  /* `masquerModal` degele le fond et remet le defilement ou il etait. Fermer en
     posant `hidden` a la main laisserait le corps fige, donc la page bloquee. */
  masquerModal($('#modal'));
  apercuOuvert = null;
}

/* Ancre demandee par une tuile, consommee au prochain rendu. `pendingFocus`
   l'accompagne quand la tuile vient corriger une valeur : le champ marque
   `data-anchor-focus` de la cible prend alors le curseur, sans second geste. */
let pendingAnchor = null;
let pendingFocus = false;

function focusAnchor() {
  if (!pendingAnchor) return;
  /* `data-anchor` sert a deux choses : dire ou aller, sur le bouton qui
     declenche `goto`, et marquer la destination. Un bouton porte donc la meme
     valeur que sa cible, et il viendrait en premier : on "defilerait" vers
     un element deja sous les yeux, sans que rien ne bouge. Une destination
     n'est jamais un declencheur. */
  const cibles = $$(`[data-anchor="${CSS.escape(pendingAnchor)}"]`)
    .filter(x => x.dataset.action !== 'goto');
  const el = cibles.find(x => x.offsetParent !== null) || cibles[0];
  pendingAnchor = null;
  if (!el) { pendingFocus = false; return; }
  /* La marge vient de la feuille de style : `scroll-padding-top` sur `html` y
     dit, pour l'ecran courant, ce qui reste cloue en haut -- barre du haut,
     sous-onglets compris sur telephone. Un nombre ecrit ici approcherait ces
     bandes sans les lire, et l'ancre se poserait a cote des qu'une barre
     change de hauteur. */
  const bar = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - bar);
  const depart = window.scrollY;
  window.scrollTo({ top: y, behavior: 'smooth' });
  /* Filet : certains navigateurs ignorent purement `behavior: smooth` et ne
     bougent pas du tout. Une ancre qui ne fait rien est pire qu'une ancre qui
     saute : si rien n'a demarre au bout de deux images, on y va sans
     animation. Aucun effet la ou le defilement doux fonctionne, puisqu'il a
     deja commence. */
  if (Math.abs(y - depart) > 4) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - depart) < 2) window.scrollTo(0, y);
    }));
  }
  el.classList.remove('flash-target');
  void el.offsetWidth;                       // relance l'animation
  el.classList.add('flash-target');
  setTimeout(() => el.classList.remove('flash-target'), 1600);
  if (pendingFocus) {
    pendingFocus = false;
    const champ = el.querySelector('[data-anchor-focus]');
    if (champ) setTimeout(() => champ.focus({ preventScroll: true }), 60);
  }
}

function render() {
  const key = currentView();
  const v = VIEWS[key];
  if (key !== 'overview' || sousOngletActif.overview !== 'aujourdhui') apercuEdition = false;
  if (ficheAvant && ficheAvant.cle !== cleFicheCourante(key)) ficheAvant = null;
  if (key !== 'positions' || sousOngletActif.positions === 'cible') marchesEdition = false;
  const cleOnglet = SOUS_ONGLETS[v.cle] && sousOngletActif[v.cle]
    ? `${v.cle}.${sousOngletActif[v.cle]}` : null;
  const propre = suffixe => {
    const k = `view.${cleOnglet}${suffixe}`;
    return cleOnglet && t(k) !== k ? t(k) : null;
  };
  const titre = viewTitle(v.cle);
  $('#viewTitle').textContent = titre;
  $('#viewSub').textContent = propre('.sub') || viewSub(v.cle);
  $('#brandView').textContent = titre;              // barre fixe, ecran replie
  document.body.dataset.vue = key;
  const bandeau = $('#bandeauDemo');
  if (bandeau) bandeau.hidden = !modeDemo();
  /* L'etiquette de la demonstration publique, dans la barre du haut et dans la
     barre fixe du telephone : voir `etiquetteDemoVisible`. */
  for (const e of $$('.etiquette-demo')) e.hidden = !etiquetteDemoVisible();
  const compte = !!(typeof CloudSync !== 'undefined' && CloudSync.getUserId());
  for (const lien of $$('#nav a[data-view="profil"]')) lien.hidden = !compte;
  const sortie = $('#btnLogout');
  if (sortie) sortie.hidden = !compte;
  /* Une graine plus recente que la copie du visiteur se propose, elle ne
     s'impose pas : la copie porte peut-etre ses essais, et rien ne permet de
     savoir s'il en a fait. Le bandeau ne se montre que sur la demonstration,
     la seule ou `SEED_VERSION` existe. */
  const graine = $('#bandeauGraine');
  if (graine) graine.hidden = !demoPerimee();

  /* Le retour de l'en-tete. Deux sortes d'ecrans le portent, et leur retour n'est
     pas le meme.

     Une fiche a un parent : sa cle designe une autre vue -- `ficheCompte` porte
     `cle: 'accounts'`. La regle vit donc dans le registre et non dans une liste
     de routes tenue a cote : une fiche ajoutee demain aura son retour sans qu'on
     y pense. Son chevron remonte a ce parent, toujours au meme endroit.

     Les pages du tiroir -- Donnees, Preferences, Notifications -- n'ont pas de
     parent : elles ne sont dans aucun onglet, et le tiroir qui les ouvre n'est
     pas un ecran. Leur chevron revient donc d'ou l'on vient, ce qui est la seule
     reponse juste : on y entre depuis n'importe quelle page.

     L'accueil, lui, n'en porte pas : c'est le premier onglet de la barre, il n'y
     a rien au-dessus. */
  const retour = $('#btnRetour');
  if (retour) {
    const dansBarre = $$('#tabbar a:not([hidden])').map(a => a.dataset.view);
    const parent = key !== v.cle && VIEWS[v.cle] ? v.cle : null;
    const orpheline = !parent && v.cle !== 'overview' && !dansBarre.includes(v.cle);
    retour.hidden = !parent && !orpheline;
    if (parent) {
      retour.dataset.action = 'goto';
      retour.dataset.view = parent;
      retour.dataset.anchor = '';
      retour.setAttribute('aria-label',
        trad('Retour à {v}').replace('{v}', viewTitle(parent)));
    } else if (orpheline) {
      retour.dataset.action = 'retour-arriere';
      delete retour.dataset.view;
      retour.setAttribute('aria-label', trad('Revenir à l’écran précédent'));
    }
    document.body.classList.toggle('sous-page', !retour.hidden);
  }
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === key));
  majOnglets();
  const host = $('#view');
  const scroll = window.scrollY;
  const signatureVue = cleOnglet || key;
  /* Arriver sur une vue, ou la redessiner : les deux ne veulent pas la meme
     position de defilement.

     Un re-rendu garde la position, evidemment -- `render()` tourne a chaque frappe
     dans un champ. Une arrivee qui la garderait aussi appliquerait la position
     de l'ecran qu'on quitte a celui qu'on ouvre : descendu au bas d'Allocation,
     on arriverait au bas de Budget. Aucun systeme ne fait ca -- iOS garde une
     position par onglet, Android remet en haut -- et appliquer celle du voisin
     n'est ni l'un ni l'autre.

     Chaque vue retient donc la sienne, et la retrouve en y revenant. Une vue
     jamais visitee s'ouvre en haut, ce qui est le seul defaut acceptable. La
     memoire vit en memoire vive : un rechargement de page la vide, et c'est
     voulu -- on rouvre l'application en haut de l'ecran d'accueil. */
  const arrivee = signatureVue !== derniereVueRendue;
  const changeOnglet = arrivee && derniereCleRendue === key;
  if (arrivee) {
    if (derniereVueRendue) positionsVues.set(derniereVueRendue, scroll);
    derniereVueRendue = signatureVue;
    derniereCleRendue = key;
    host.classList.add('vue-entre');
    clearTimeout(render._finEntree);
    render._finEntree = setTimeout(() => host.classList.remove('vue-entre'), 700);
  } else {
    host.classList.remove('vue-entre');
  }
  /* Les barres poussent de zero a l'arrivee sur une vue ET au changement de
     perimetre. Deux classes et non une : `vue-entre` fait aussi monter les
     cartes en cascade, et rejouer cette cascade a chaque clic sur une bascule
     ferait clignoter la page entiere pour un chiffre qui change. */
  if (arrivee || relanceGraphes) {
    host.classList.add('graphes-poussent');
    clearTimeout(render._finPousse);
    render._finPousse = setTimeout(() => host.classList.remove('graphes-poussent'), 750);
  } else {
    host.classList.remove('graphes-poussent');
  }
  relanceGraphes = false;
  /* Ou se trouvait le lavis des sous-onglets avant ce rendu.

     Il glisse d'un onglet a l'autre par une transition CSS, et une transition
     demande que l'element survive au changement. Or la barre de sous-onglets
     vit dans `#view`, que la ligne suivante remplace en entier : le lavis
     repart donc d'un element neuf, deja en place, et ne glisse pas.

     On note sa position avant, on la force sur l'element neuf, puis on la
     relache a l'image suivante. Le style en ligne bat les regles `:has()` le
     temps d'une image, le temps de donner un point de depart a la transition.

     Sortir cette barre de `#view`, comme la barre du bas et le bandeau de
     demonstration, serait plus juste sur le fond -- une barre de navigation
     n'est pas du contenu -- mais toucherait le routage et les vues qui
     l'appellent. */
  const lavisAvant = (() => {
    const seg = $('.sous-onglets .segmented');
    if (!seg) return null;
    const i = [...seg.children].findIndex(b => b.classList.contains('on'));
    return i >= 0 ? i : null;
  })();

  /* UNE PAGE QUI ECHOUE LE DIT. Sans cette garde, une exception dans le rendu
     d'une vue remonterait jusqu'au gestionnaire de `hashchange` et s'y perdrait :
     l'ecran precedent resterait en place, l'adresse aurait change, et rien ne
     dirait pourquoi -- sur un telephone, sans console, le bouton paraitrait
     simplement en panne. Le message s'affiche la ou l'on est, et la page reste
     utilisable. */
  let html;
  try { html = collerAides(v.render()); }
  catch (e) {
    console.error(e);
    signalerErreur(e);
    toast(`${trad('Cette page n’a pas pu s’afficher')}${deuxPoints()} ${e && e.message ? e.message : e}`);
    return;
  }
  host.innerHTML = html;

  if (lavisAvant !== null) {
    const seg = $('.sous-onglets .segmented');
    const i = seg && [...seg.children].findIndex(b => b.classList.contains('on'));
    if (seg && i >= 0 && i !== lavisAvant) {
      seg.style.setProperty('--onglet', lavisAvant);
      requestAnimationFrame(() => requestAnimationFrame(() =>
        seg.style.removeProperty('--onglet')));
    }
  }
  if (tapeSousOnglets) {
    tapeSousOnglets = false;
    const seg = $('.sous-onglets .segmented');
    if (seg) {
      seg.classList.add('tape');
      setTimeout(() => seg.classList.remove('tape'), 400);
    }
    const host = $('#view');
    if (host) {
      host.classList.add('barre-immobile');
      setTimeout(() => host.classList.remove('barre-immobile'), 700);
    }
  }

  MOUNTS[key]?.();
  /* Le tirage se monte ici, et nulle part ailleurs.

     La liste des vues qui s'arment vit dans `VUES_TIRER` : un montage dans
     chaque vue en ferait une seconde liste, et celle qu'on oublierait de changer
     deciderait en silence -- une vue ajoutee a `VUES_TIRER` sans son appel
     donnerait un geste mort, sans erreur nulle part.

     Et `.view` est le meme noeud pour toutes les vues : des ecouteurs poses
     depuis une vue vivraient ensuite partout, et le meme ecran repondrait ou
     non selon le chemin pris pour y venir.

     Le garde interne empeche de les empiler, l'arme se decide au `touchstart`
     contre `VUES_TIRER`, et cette ligne garantit seulement que les ecouteurs
     existent. */
  monteTirerRafraichir();
  monteAides();
  renderSidebar();
  coursFraichis = new Set();
  if (pendingAnchor) focusAnchor();
  else if (retourHautDemande || changeOnglet) { retourHautDemande = false; window.scrollTo(0, 0); }
  else window.scrollTo(0, arrivee ? (positionsVues.get(signatureVue) || 0) : scroll);
}
let retourHautDemande = false;
/* La vue rendue, sous-onglet exclu -- `derniereVueRendue` porte la signature
   complete. Les deux sont necessaires : c'est leur difference qui distingue un
   changement d'onglet du bas d'un changement de sous-onglet. */
let derniereCleRendue = null;
let derniereVueRendue = null;
const positionsVues = new Map();
let navsInternes = 0;
let tapeSousOnglets = false;

const ICONE_NOTIF = { action: '●', error: '⛔', warn: '⚠', info: 'ℹ' };

function rendNotifs() {
  const n = notifications();
  const panneau = $('#panneauNotifs');
  if (!panneau) return;
  panneau.innerHTML = `
    <div class="notif-tete">
      <b>${trad('À faire')}</b>
      <span>${n.length ? `${n.length} point${n.length > 1 ? 's' : ''}` : 'rien à signaler'}</span>
      <button type="button" class="btn icon xs notif-reglages"
              data-action="goto" data-view="notifications" data-anchor=""
              title="${trad('Réglages des notifications')}" aria-label="${trad('Réglages des notifications')}">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">
          <circle cx="5.6" cy="12" r="1.75"/>
          <circle cx="12" cy="12" r="1.75"/>
          <circle cx="18.4" cy="12" r="1.75"/>
        </svg>
      </button>
    </div>
    ${n.length ? n.map(x => `
      <div class="notif-ligne n-${esc(x.level)}">
        <button type="button" class="notif-corps"
                data-action="goto" data-view="${esc(x.view)}" data-anchor="">
          <span class="notif-ic" aria-hidden="true">${ICONE_NOTIF[x.level] || '•'}</span>
          <span class="notif-txt"><b>${esc(x.title)}</b><span>${escMontant(x.detail)}</span></span>
        </button>
        ${x.cle === CLE_INVENTAIRE ? `
        <button type="button" class="btn sm notif-oui" data-action="declarer-pas"
                data-cle="${esc(x.cle)}">${trad('Oui, tout y est')}</button>` : `
        <button type="button" class="btn icon xs notif-x" data-action="masquer-notif"
                data-cle="${esc(x.cle)}" title="${trad('Ne plus signaler')}"
                aria-label="Ne plus signaler : ${esc(x.title)}">✕</button>`}
      </div>`).join('')
    : `<p class="notif-vide">${trad('✓ Rien à signaler.')}</p>`}
    <button type="button" class="notif-fermer" data-action="fermer-notifs"
            aria-label="Fermer">
      <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6,14.5 12,8.5 18,14.5"/></svg>
    </button>`;
}

function fermeNotifs() {
  const p = $('#panneauNotifs');
  if (p) p.hidden = true;
  $('#btnCloche')?.setAttribute('aria-expanded', 'false');
}

function basculeNotifs() {
  const p = $('#panneauNotifs');
  if (!p) return;
  const ouvrir = p.hidden;
  if (ouvrir) rendNotifs();
  p.hidden = !ouvrir;
  const cloche = $('#btnCloche');
  cloche?.setAttribute('aria-expanded', String(ouvrir));
  /* LE PANNEAU SORT DE LA BARRE LATERALE, DONC IL SE PLACE A L'OUVERTURE.

     La barre porte `overflow-y: auto`, et une seule valeur d'overflow suffit a
     rogner les DEUX axes : un panneau plus large qu'elle y serait coupe net. Il
     passe donc en position fixe sur grand ecran, ce qui l'affranchit de ce
     cadre -- mais une position fixe ne suit plus son bouton, et la barre peut
     defiler sous lui.

     Sa hauteur se lit donc sur la cloche au moment ou l'on ouvre, pas une fois
     pour toutes dans la feuille. C'est la seule mesure que le CSS ne peut pas
     faire seul. */
  if (ouvrir && cloche) {
    p.style.setProperty('--notif-haut', `${Math.round(cloche.getBoundingClientRect().bottom + 10)}px`);
  }
}

/* MARCHES EST UN ONGLET PERMANENT, meme pour qui n'a aucune ligne cotee.

   Un onglet absent ne s'explique pas, et il ne se cherche pas non plus -- on ne
   peut pas vouloir ce dont on ignore l'existence. Quelqu'un qui ouvre un tableau
   de bord de patrimoine cherche justement ou poser ses titres ; lui retirer
   l'entree repondrait qu'il n'y a pas d'endroit.

   Une page de zeros n'est pas un resultat pour autant : la vue sort par un
   `return` des que `positions` est vide, sur une carte qui explique la
   frontiere avec Actifs et propose de creer le compte quand aucun ne peut
   porter un titre. */

function majOnglets() {
  const barre = $('#tabbar');
  if (!barre) return;
  const key = currentView();
  /* `:not([hidden])` : aucune entree n'est masquee aujourd'hui, mais la barre
     ne doit compter que ce qu'elle rend. */
  const directs = [...barre.querySelectorAll('a:not([hidden])')].map(a => a.dataset.view);
  const ouvert = document.body.classList.contains('nav-open');

  for (const a of barre.querySelectorAll('a')) {
    a.classList.toggle('on', !ouvert && a.dataset.view === key);
    a.setAttribute('aria-current', (!ouvert && a.dataset.view === key) ? 'page' : 'false');
  }
  let titre = null, restants = 0;
  const trancher = () => titre && titre.classList.toggle('sans-suite', restants === 0);
  for (const el of $$('#nav > *')) {
    if (el.classList.contains('nav-groupe')) { trancher(); titre = el; restants = 0; continue; }
    if (!el.matches('a[data-view]') || el.hidden) continue;
    const double = directs.includes(el.dataset.view);
    el.classList.toggle('dans-barre', double);
    if (!double) restants++;
  }
  trancher();

  const dep = depensesEnAttente();
  const rel = currentMonthPending();

  const pastille = (id, actif, texte) => {
    const p = $(id);
    if (!p) return;
    p.hidden = !actif;
    p.title = actif ? texte : '';
  };
  pastille('#tabBadgeBudget', dep.missing,
    dep.missing ? `${dep.label} : ${trad('dépenses pas encore saisies')}` : '');
  pastille('#tabBadgeOverview', rel.missing,
    rel.missing ? `${rel.label} : ${trad('relevé pas encore enregistré')}` : '');

  /* La cloche s'allume pour tout ce qui demande une action ou signale un chiffre
     faux -- les saisies en attente comme les controles de coherence. Un rappel
     repousse n'en fait pas partie : `notifications()` s'appuie sur `missing`. */
  const n = notifications();
  pastille('#pastilleCloche', n.length,
    n.length === 1 ? n[0].title : trad('{n} points à regarder').replace('{n}', n.length));
}

function renderSidebar() {
  const t = nowTotals();
  const d = deltas();

  const pastille = (id, p, texte) => {
    const b = $(id);
    if (!b) return;
    b.hidden = !p.missing;
    b.title = p.missing ? `${p.label}, ${texte}` : '';
  };
  const dep = depensesEnAttente();
  const rel = currentMonthPending();
  pastille('#badgeBudget', dep, trad('dépenses pas encore saisies'));
  pastille('#badgeOverview', rel, trad('relevé pas encore enregistré'));

  const netWorth = $('#sbNetWorth');
  const montant = fmtEUR0(t.total);
  if (netWorth.innerHTML && netWorth.innerHTML !== montant) {
    netWorth.classList.remove('valeur-maj');
    void netWorth.offsetWidth;
    netWorth.classList.add('valeur-maj');
  }
  /* `innerHTML` et non `textContent` : masque, un montant n'est pas du texte
     mais l'oeil barre, une balise <svg> que nous produisons nous-memes.
     Posee en texte, elle s'imprimerait en clair -- le patrimoine deviendrait un
     pave de balisage au milieu du menu. Rien d'exterieur ne passe ici :
     `fmtEUR0` rend soit un nombre formate, soit cette icone. */
  netWorth.innerHTML = montant;
  const netTiroir = $('#navNetWorth');
  if (netTiroir) netTiroir.innerHTML = montant;
  const el = $('#sbDelta');
  const ytdBouge = d.ytd && Math.abs(d.ytd.eur) >= 0.5;
  const deltaHtml = ytdBouge ? `${arrow(d.ytd.eur)} ${fmtSigned(d.ytd.eur)} ${trad('depuis janvier')}` : '';
  const deltaCls = 'sb-delta ' + (ytdBouge ? cls(d.ytd.eur) : '');
  el.innerHTML = deltaHtml;
  el.className = deltaCls;
  const dTiroir = $('#navDelta');
  if (dTiroir) { dTiroir.innerHTML = deltaHtml; dTiroir.className = deltaCls; }

  majEtatCours();

  const on = masqueActif();
  document.body.classList.toggle('discret', on);
  for (const oeil of $$('[data-action="toggle-masque"]')) {
    oeil.setAttribute('aria-pressed', on ? 'true' : 'false');
    oeil.title = (on ? trad('Afficher les montants') : trad('Masquer les montants')) + ' ' + trad('(touche h)');
    oeil.setAttribute('aria-label', on ? trad('Afficher les montants') : trad('Masquer les montants'));
  }
  const nw = $('#sbNetWorth');
  if (nw) nw.title = (masqueActif() ? trad('Afficher les montants') : trad('Masquer les montants'))
    + ' ' + trad('(touche h)');
}

function monteGlissementFermeture(fenetre) {
  if (!fenetre) return;
  const panneau = fenetre.querySelector('.modal-panel');
  if (!panneau) return;

  let depart = null, delta = 0;
  const SEUIL = 90;          // en deca, la fenetre revient en place

  const fermable = () => {
    const croix = fenetre.querySelector('#modalClose, #confirmNo');
    return croix || null;
  };

  /* Le geste de fermeture doit se retirer devant le defilement. Ecrire
     `transform` et `opacity` a chaque evenement tactile, sans trame d'animation
     et sans verrou de direction, ferait accrocher la page : sur une fenetre
     longue -- les depenses du mois en portent une par categorie -- chaque doigt
     pose en haut de la liste tirerait le panneau au lieu de la faire defiler, et
     le moindre retour vers le haut le replaquerait d'un coup, sans transition.

     D'ou trois gardes. Le verrou de direction : on observe les huit premiers
     pixels sans rien bouger, et on tranche une fois pour toutes entre defiler
     et fermer. La trame : une seule ecriture de style par image, au lieu
     d'une par evenement. Et l'opacite dans la meme ecriture -- animee
     separement sur un panneau floute, elle repeindrait tout le fond. */
  let axe = null;                      // null = indecis, 'ferme' ou 'defile'
  let departX = 0, trame = 0;

  const peindre = () => {
    trame = 0;
    if (axe !== 'ferme') return;
    panneau.style.transform = `translateY(${delta * .7}px)`;
    panneau.style.opacity = String(Math.max(.4, 1 - delta / 600));
  };

  const SEUIL_INTENTION = 8;

  const ZONE_GLISSEMENT = '.modal-head';
  const corpsDefile = () => {
    const c = fenetre.querySelector('.modal-body');
    return !!c && c.scrollHeight - c.clientHeight > 2;
  };
  let corpsFige = false;
  let retourEnCours = false;

  panneau.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || retourEnCours) return;
    const surLaPoignee = e.target === panneau;
    corpsFige = !corpsDefile();
    if (!surLaPoignee && !corpsFige && !e.target.closest(ZONE_GLISSEMENT)) return;
    if (e.target.closest('input, textarea, select, button, a, select')) return;
    depart = e.touches[0].clientY;
    departX = e.touches[0].clientX;
    delta = 0; axe = null;
    panneau.style.transition = 'none';
    panneau.style.willChange = 'transform, opacity';
  }, { passive: true });

  /* Cet ecouteur n'est pas passif, et il ne doit pas le devenir.

     Un ecouteur passif ne peut pas appeler `preventDefault` : le navigateur
     garderait la main sur le geste et ferait glisser ce qu'il trouve derriere.
     `body { overflow: hidden }` ne suffit pas -- iOS laisse le document rebondir
     malgre lui -- et `overscroll-behavior: contain` sur le corps ne s'applique
     que s'il defile vraiment, ce qui est faux precisement quand la feuille ne
     defile pas.

     On confisque donc le geste dans deux situations, et seulement celles-la :
     la fermeture est engagee, ou la feuille ne defile pas et il n'y a rien
     d'autre a preserver. Un geste de defilement rend la main immediatement,
     avant meme d'etre qualifie, donc le cout en performance est nul la ou le
     defilement compte. */
  panneau.addEventListener('touchmove', e => {
    if (depart === null) return;
    if (corpsFige || axe === 'ferme') e.preventDefault();
    const dy = e.touches[0].clientY - depart;
    const dx = e.touches[0].clientX - departX;

    if (axe === null) {
      if (Math.abs(dy) < SEUIL_INTENTION && Math.abs(dx) < SEUIL_INTENTION) return;
      axe = (dy > 0 && Math.abs(dy) > Math.abs(dx)) ? 'ferme' : 'defile';
      if (axe === 'defile') { depart = null; panneau.style.transition = ''; panneau.style.willChange = ''; return; }
    }

    delta = Math.max(0, dy);
    if (!trame) trame = requestAnimationFrame(peindre);
  }, { passive: false });

  const relacher = () => {
    if (retourEnCours) return;
    if (trame) { cancelAnimationFrame(trame); trame = 0; }
    if (depart === null) { axe = null; panneau.style.transition = ''; panneau.style.willChange = ''; return; }
    const croix = axe === 'ferme' && delta > SEUIL ? fermable() : null;
    depart = null; delta = 0; axe = null;
    if (croix) {
      /* La feuille part d'ou le doigt l'a lachee. La remettre en place par une
         transition la ferait remonter pendant sa sortie : une transition
         l'emporte sur une animation dans la cascade, et la sortie n'a qu'une
         image d'arrivee, qui part de la valeur presente. `montrerModal`
         efface le reste a la reouverture. */
      panneau.style.transition = 'none';
      panneau.style.willChange = '';
      croix.click();
      return;
    }
    panneau.style.transition = 'transform .2s ease, opacity .2s ease';
    panneau.style.transform = '';
    panneau.style.opacity = '';
    retourEnCours = true;
    nettoyerApres(panneau, 260, () => { retourEnCours = false; });
  };
  panneau.addEventListener('touchend', relacher);
  panneau.addEventListener('touchcancel', relacher);
}

/* -------------------------------------------------------------
   Tirer vers le bas pour rafraichir les cours

   Un tirage qui menerait a une destination serait ambigu : au sommet d'une
   page, un doigt qui descend pourrait vouloir naviguer ou defiler, et aucun
   seuil ne leverait l'ambiguite. Celui-ci ne mene nulle part, il rafraichit.

   Ici il n'y a donc rien a arbitrer. A `scrollY === 0`, un glissement vers le
   bas ne peut pas defiler : il n'y a rien au-dessus. Le geste ne dispute aucune
   autre intention, exactement comme le glissement de fermeture d'une feuille qui
   ne defile pas. C'est la meme regle, et c'est elle qui rend le geste sain.

   Trois gardes tout de meme. Une fenetre ouverte prend la main, sinon on
   rafraichirait derriere elle. Un rafraichissement en cours ne se relance pas.
   Et le verrou de direction observe huit pixels avant de trancher : un
   glissement lateral, ou vers le haut, rend la main definitivement pour ce
   geste. */
let tirerMonte = null;
/* Les vues ou le geste a un sens, nommees une fois. Le test de la vue vit dans
   `touchstart` et non au montage : `.view` est le meme noeud pour toutes les
   vues, les ecouteurs y sont poses une seule fois et vivent ensuite partout. */
const VUES_TIRER = new Set(['positions', 'overview', 'allocation']);
function monteTirerRafraichir() {
  const hote = $('.view');
  if (!hote || tirerMonte === hote) return;
  tirerMonte = hote;

  /* La jauge vit en `fixed` : elle ne participe donc pas au flux et ne pousse
     rien. Recreee a chaque rendu de la vue, comme le reste. */
  let jauge = document.querySelector('.tirer');
  if (!jauge) {
    jauge = document.createElement('div');
    jauge.className = 'tirer';
    jauge.setAttribute('aria-hidden', 'true');
    jauge.innerHTML = '<i></i>';
    document.body.appendChild(jauge);
  }

  const SEUIL_RAFRAICHIR = 165;   // au-dela, on lache et ca part
  const INTENTION = 8;         // en deca, l'intention n'est pas lisible
  let depart = null, departX = 0, dy = 0, axe = null, enCours = false;

  /* La page descend avec le doigt, et c'est elle qui fait sentir le geste.

     Un disque qui bougerait seul, au-dessus d'un contenu rigide, paraitrait
     flotter devant une page qui ne participe pas. Un tirage se sent parce que la
     matiere resiste et revient -- c'est le meme principe que les feuilles de
     l'application, qui suivent le doigt avant de se remettre en place, et le
     meme que le geste natif du systeme.

     Seul `.view` bouge : la barre du haut et celle du bas sont en `fixed`, elles
     restent donc en place, comme il faut. */

  /* La resistance, et c'est tout le sujet.

     Un amortissement **lineaire** -- 60 % de la course du doigt, sans borne --
     laisserait tirer deux fois plus loin pour descendre deux fois plus bas,
     indefiniment : un ecran qui se tire beaucoup trop. Un ratio n'est pas une
     resistance : il se contente de ralentir, il ne s'oppose jamais.

     La loi est donc asymptotique, celle des elastiques du systeme et des
     applications bancaires : au depart la page suit le doigt presque au pixel,
     ce qui rend le geste vivant, puis elle donne de moins en moins et tend vers
     `COURSE_MAX` sans jamais l'atteindre. Pour 140 px de course maximale :
     50 px de doigt donnent 42, 100 en donnent 71, 200 en donnent 107, et 660 en
     donnent 139. On ne peut plus creuser un demi-ecran de vide, et surtout on
     **sent** que ca resiste, parce que la reponse s'aplatit sous le doigt.

     `1 - exp(-d / M)` et non `d / (1 + d / M)` : les deux ont la meme asymptote,
     la premiere a une pente initiale de 1 exactement, donc le premier centimetre
     colle au doigt. C'est ce premier centimetre qui dit que le geste est pris. */
  const COURSE_MAX = 140;
  const amorti = d => COURSE_MAX * (1 - Math.exp(-d / COURSE_MAX));

  const peindre = () => {
    const t = Math.min(1, dy / SEUIL_RAFRAICHIR);
    const y = amorti(dy);
    jauge.style.opacity = String(t);
    jauge.style.transform = `translate(-50%, ${y}px) rotate(${t * 300}deg)`;
    jauge.classList.toggle('prete', dy >= SEUIL_RAFRAICHIR);
    hote.style.transform = `translateY(${y}px)`;
  };
  const RESSORT = 'cubic-bezier(.22, 1.28, .42, 1)';
  const reposer = () => {
    jauge.style.transition = 'opacity .2s ease, transform .25s ease';
    jauge.style.opacity = '0';
    jauge.style.transform = 'translate(-50%, 0) rotate(0deg)';
    jauge.classList.remove('prete');
    hote.style.transition = `transform .34s ${RESSORT}`;
    hote.style.transform = '';
    setTimeout(() => {
      jauge.style.transition = '';
      hote.style.transition = '';
    }, 360);
  };

  hote.addEventListener('touchstart', e => {
    /* `.view` est le meme noeud pour toutes les vues : seul son contenu change
       d'un rendu a l'autre. Les ecouteurs sont donc poses une fois et vivent
       ensuite sous Budget comme sous Marches -- c'est ici qu'on decide, pas au
       montage. Le garde du montage ne fait qu'eviter de les empiler. */
    if (!VUES_TIRER.has(currentView())) return;
    if (enCours || e.touches.length !== 1) return;
    if (window.scrollY > 0) return;
    if (!$('#modal').hidden || !$('#confirm').hidden) return;
    if (e.target.closest('.reperes, .reperes-familles, .table-wrap, [data-defile-x]')) return;
    depart = e.touches[0].clientY; departX = e.touches[0].clientX; dy = 0; axe = null;
    jauge.style.transition = '';
  }, { passive: true });

  hote.addEventListener('touchmove', e => {
    if (depart === null) return;
    const y = e.touches[0].clientY - depart;
    const x = e.touches[0].clientX - departX;
    if (axe === null) {
      if (Math.abs(y) < INTENTION && Math.abs(x) < INTENTION) return;
      axe = (y > 0 && Math.abs(y) > Math.abs(x)) ? 'tirer' : 'autre';
      if (axe === 'autre') { depart = null; return; }
    }
    dy = Math.max(0, y);
    e.preventDefault();
    peindre();
  }, { passive: false });

  const relacher = async () => {
    if (depart === null || axe !== 'tirer') { depart = null; axe = null; return; }
    const assez = dy >= SEUIL_RAFRAICHIR;
    depart = null; axe = null;
    if (!assez) { dy = 0; reposer(); return; }
    dy = 0;
    enCours = true;
    retourHaptique();
    jauge.classList.remove('prete');
    jauge.classList.add('tourne');
    jauge.style.opacity = '1';
    jauge.style.transition = 'transform .2s ease';
    jauge.style.transform = 'translate(-50%, 34px)';
    hote.style.transition = 'transform .2s ease';
    hote.style.transform = 'translateY(44px)';
    try {
      await ACTIONS['refresh-quotes']();
    } finally {
      enCours = false;
      jauge.classList.remove('tourne');
      reposer();
    }
  };
  hote.addEventListener('touchend', relacher);
  hote.addEventListener('touchcancel', relacher);
}

/* -------------------------------------------------------------
   Le petit clic physique de l'appui

   Android seulement, et c'est tout ce qui existe.

   `navigator.vibrate()` est la voie normale, et elle n'est implementee que la.
   Huit millisecondes : c'est un clic, pas une alerte.

   Sur iOS, il n'y a rien, ni dans Safari ni en application installee sur
   l'ecran d'accueil : l'API de vibration n'y existe pas, et c'est le meme
   moteur de rendu. Le retour que le systeme donne au controle natif
   `<input type="checkbox" switch>` ne se declenche pas quand un script
   l'active : aucun contournement ne passe par la, et un contournement qui ne
   contourne rien laisserait croire que le sujet est traite.

   Ce qui porte l'appui sur iOS est donc entierement visuel -- le tassement de la
   barre, la pastille qui glisse, la page qui suit le doigt.
   ------------------------------------------------------------- */
function retourHaptique() {
  try { navigator.vibrate?.(8); } catch (e) {}
}

/* -------------------------------------------------------------
   Vider un champ d'un geste

   Sans aide, corriger un montant demande de selectionner son contenu puis de
   l'effacer, ou de reculer chiffre par chiffre. Une croix apparait donc dans
   le champ actif des qu'il porte quelque chose : elle le vide et y laisse le
   curseur, pret a recevoir le nouveau montant.

   Un seul bouton pour toute l'application, pose au-dessus du champ actif
   plutot que place dans les gabarits : les champs a `data-path` sont
   soixante-treize, repartis dans une vingtaine de gabarits, et les fenetres
   en creent d'autres a la volee. Flottant, il ne touche a aucune largeur de
   colonne.
   ------------------------------------------------------------- */
function monteVideChamp() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'champ-vider';
  btn.hidden = true;
  btn.setAttribute('aria-label', trad('Vider le champ'));
  btn.setAttribute('title', trad('Vider le champ'));
  btn.textContent = '×';
  document.body.appendChild(btn);

  let cible = null;

  /* Ce que couvre ce mecanisme -- la croix qui vide, et la selection a l'arrivee.

     Les champs a `data-path` ne suffisent pas : les depenses d'un mois se
     saisissent dans des champs a `data-cat`, et les fenetres de vente et d'achat
     dans des champs a identifiant, alors que ce sont exactement ceux qu'on
     retape le plus.

     Trois portes, donc : le chemin d'etat, la categorie de depense, et
     l'appartenance a une fenetre. La troisieme est la plus large et la plus
     juste : dans une fenetre, un champ de texte ou de nombre est toujours une
     valeur qu'on vient poser ou remplacer. Les champs de date en sont exclus
     par leur type -- on n'y tape pas par-dessus, le navigateur y met son propre
     selecteur. */
  const eligible = el => el instanceof HTMLInputElement
    && (el.type === 'text' || el.type === 'number')
    && !el.readOnly && !el.disabled
    && (el.dataset.path !== undefined || el.dataset.cat !== undefined
        || !!el.closest('#modalBody'));

  /* La reserve a droite se pose en style direct plutot que par une classe :
     `table.editable input` fixe deja un `padding`, et une regle de feuille
     de style aurait demande de surenchierir en specificite a chaque endroit
     ou un champ est habille autrement. */
  /* Le cote de la croix : celui ou le texte n'est pas. Un montant s'aligne a
     droite, donc sa place libre est a gauche -- la ou `champ-somme` pose deja
     son "+". Posee a droite, elle couvrirait le dernier chiffre sur iOS, qui ne
     reporte pas sur le texte la reserve ajoutee a un champ deja actif : placee
     du cote vide, elle ne depend pas de cette reserve. Un champ qui porte deja
     le "+" a gauche garde la croix a droite. */
  let padAvant = null, cote = 'Right';
  const coteLibre = el => /right|end/.test(getComputedStyle(el).textAlign)
    && !el.closest('.champ-somme') ? 'Left' : 'Right';
  const cacher = () => {
    if (cible) {
      cible.classList.remove('champ-vidable');
      cible.style['padding' + cote] = padAvant || '';
    }
    padAvant = null;
    cible = null;
    btn.hidden = true;
  };

  const placer = () => {
    if (!cible || !cible.isConnected) return cacher();
    const r = cible.getBoundingClientRect();
    if (!r.width || r.bottom < 4 || r.top > innerHeight - 4) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.style.left = `${cote === 'Left' ? r.left + 3 : r.right - 23}px`;
    btn.style.top  = `${r.top + r.height / 2 - 10}px`;
  };

  const suivre = () => {
    if (!cible) return;
    if (String(cible.value).length) placer(); else btn.hidden = true;
  };

  document.addEventListener('focusin', e => {
    if (!eligible(e.target)) return cacher();
    cacher();
    cible = e.target;
    /* Le contenu se selectionne a l'arrivee : taper remplace, sans effacer.

       Le geste demande tient en un appui, et il n'a besoin d'aucun bouton : ce
       qu'on veut n'est pas un champ vide, c'est de ne pas avoir a effacer. Un
       contenu selectionne disparait au premier caractere tape -- c'est la meme
       chose, en un geste au lieu de deux, et sans rien poser a droite de
       soixante-treize champs.

       La croix reste pour le cas qu'elle seule couvre : vider et regarder le
       total avant de retaper. Elle rend un champ vide, la selection rend un
       champ qu'on remplace.

       `select()` differe d'une image : sur iOS, appeler la selection dans le
       gestionnaire de focus se fait ecraser par le placement du curseur que le
       navigateur execute juste apres, et le champ se retrouve avec un simple
       point d'insertion. */
    const champ = cible;
    requestAnimationFrame(() => {
      if (document.activeElement === champ && String(champ.value).length) {
        try { champ.select(); } catch (err) { /* type de champ sans selection */ }
      }
    });
    cible.classList.add('champ-vidable');
    cote = coteLibre(cible);
    padAvant = cible.style['padding' + cote];
    cible.style['padding' + cote] = '28px';
    suivre();
  });

  document.addEventListener('focusout', e => {
    if (e.target !== cible) return;
    setTimeout(() => { if (document.activeElement !== cible) cacher(); }, 0);
  });

  document.addEventListener('input', e => { if (e.target === cible) suivre(); });
  addEventListener('scroll', suivre, { passive: true, capture: true });
  addEventListener('resize', suivre);

  /* `pointerdown` plutot que `click` : un clic commence par retirer le focus
     du champ, ce qui declenche le re-rendu du blur et remplace le noeud sous
     le doigt. En prenant la main avant, et en empechant le deplacement du
     focus, le champ reste celui qu'on vise. */
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!cible) return;
    const champ = cible;
    champ.value = '';
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    champ.focus();
    btn.hidden = true;
  });
}

function bindGlobal() {
  /* Chaque changement d'adresse compte : c'est ce qui permet au retour des pages
     sans parent de savoir s'il y a un "avant" dans l'application. Un signet
     ouvert directement n'en a pas, et `history.back()` sortirait du site. */
  window.addEventListener('hashchange', () => { navsInternes++; render(); });

  /* Le pincement n'est pas bloque, et c'est delibere.

     Refuser les evenements `gesturestart` de WebKit interdirait bien le zoom sur
     Safari, faute de quoi rien ne le fait -- le viewport est ignore depuis
     iOS 10 et `touch-action: manipulation` n'arrete que le double-tap. Mais une
     page n'a pas a empecher quelqu'un d'agrandir ce qu'il lit mal : c'est
     l'anti-motif que ce refus d'iOS existe pour empecher.

     Et ca ne reglerait pas le defaut : le zoom qui reste zoome est le recadrage
     automatique sur un champ sous 16px, qui ne se defait jamais, la ou un
     pincement se defait en pincant. Le correctif est dans la feuille de style,
     sur la taille des champs. Un blocage qui ne supprime pas le symptome est un
     blocage faux. */

  /* La barre du haut se retire quand on descend, et revient apres un battement.

     En lisant, on remonte sans arret de quelques dizaines de pixels -- pour
     relire une ligne, pour revoir un total qu'on vient de depasser. Sans
     battement, chacune de ces corrections ferait retomber la barre sur le
     contenu, et elle repartirait au geste suivant. Une barre qui entre et sort
     a ce rythme se remarque plus que ce qu'elle contient.

     Le battement est donc une distance **cumulee** vers le haut, un tiers de la
     hauteur de l'ecran, et toute reprise vers le bas la remet a zero. C'est ce
     qui distingue une correction de lecture d'une vraie intention de revenir en
     haut : la premiere fait quarante pixels et s'arrete, la seconde est un
     lancer. On garde donc l'essentiel de `enterAlways` -- la barre revient sans
     qu'on ait a atteindre le sommet, sans quoi la cloche et le profil se
     paieraient d'un retour complet -- sans suivre le bruit.

     Un tiers de l'ecran et non un nombre de pixels : sur un iPhone SE et sur une
     tablette, le meme geste couvre une fraction d'ecran comparable, pas une
     distance comparable. Relu a chaque evenement, donc juste apres une rotation.

     Les autres garde-fous valent chacun contre un defaut qu'on obtient sans
     lui.

     Le seuil : sous 64 px on est encore en haut de page, et la barre y reste.
     Sinon le moindre geste vers le bas la ferait disparaitre alors qu'on n'a rien
     gagne a la cacher -- la page n'a pas encore de contenu au-dessus. C'est aussi
     lui qui court-circuite le battement : arriver au sommet rend la barre sans
     rien avoir a cumuler, sinon la page du haut pourrait rester decapitee.

     Le pas : un doigt pose tremble de deux ou trois pixels, et une barre qui joue
     sur ce bruit clignote. Six pixels, c'est un geste.

     Les fenetres : `gelerFond()` met le corps en `position: fixed`, ce qui
     declenche un evenement de defilement au moment ou l'on ouvre et un autre a la
     fermeture. Ni l'un ni l'autre n'est un geste de lecture, et sans ce test la
     barre se retirerait a l'ouverture d'une fenetre pour rester cachee derriere
     elle.

     Une sous-page ne cache jamais la sienne : c'est la qu'un "retour" vit, et
     iOS fait la meme exception. */
  (() => {
    const SEUIL = 64, PAS = 6;
    const battement = () => Math.round(window.innerHeight / 3);
    let dernier = Math.max(0, window.scrollY);
    let remontee = 0;
    const suivre = () => {
      if (modalesOuvertes > 0 || document.body.classList.contains('nav-open')) return;
      const y = Math.max(0, window.scrollY);
      const delta = y - dernier;
      if (Math.abs(delta) < PAS) return;
      dernier = y;

      if (document.body.classList.contains('sous-page')) {
        document.body.classList.remove('haut-cache');
        remontee = 0;
        return;
      }
      if (delta > 0) {
        remontee = 0;
        document.body.classList.toggle('haut-cache', y > SEUIL);
        return;
      }
      remontee += -delta;
      if (y <= SEUIL || remontee >= battement()) {
        document.body.classList.remove('haut-cache');
        remontee = 0;
      }
    };
    window.addEventListener('scroll', suivre, { passive: true });
    window.addEventListener('hashchange', () => {
      dernier = 0;
      remontee = 0;
      document.body.classList.remove('haut-cache');
    });
  })();

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const fn = ACTIONS[btn.dataset.action];
    if (fn) { e.preventDefault(); suivreActeSurFiche(btn.dataset.action, () => fn(btn)); }
  });

  /* Ecrire a la frappe, sauf dans un bloc qui attend son bouton.

     Toute l'application ecrit a chaque frappe : c'est ce qui permet de corriger
     un montant sans rien valider, et la barre laterale suit. Une fiche de ligne
     de titres, elle, se relit avant de compter -- on y change une quantite apres
     un achat, et une ecriture a la frappe ne dirait pas si c'est pris en compte.
     Elle porte donc `data-differe`, et ses champs n'entrent dans l'etat qu'au
     clic sur "Enregistrer". Fermer sans enregistrer les abandonne, et le
     demande. */
  document.addEventListener('input', e => {
    const f = e.target.closest('[data-path]');
    if (!f) return;
    const bloc = f.closest('[data-differe]');
    if (bloc) { bloc.dataset.differe = 'sale'; return; }
    applyField(f);
    Store.save({ differe: true });
    marquerEcrit(f);
    renderSidebar();
    majApercu();                       // les totaux de la fenetre suivent
  });
  /* Un routeur pour les listes deroulantes, comme il en existe un pour les clics.

     `data-action` route vers ACTIONS depuis un seul ecouteur, et
     `data-action-change` fait de meme ici : une liste qui porte l'attribut
     declenche son action sans ecouteur ecrit a la main. Sans ce routeur, elle
     ne declencherait rien, ni changement ni message. */
  document.addEventListener('change', e => {
    const sel = e.target.closest('[data-action-change]');
    const nom = sel && sel.dataset.actionChange;
    if (nom && ACTIONS[nom]) ACTIONS[nom](sel);
  });

  document.addEventListener('change', e => {
    const sel = e.target.closest('[data-action-change="proj-horizon"]');
    if (!sel) return;
    projHorizon = +sel.value;
    Store.save(); render();
  });

  document.addEventListener('change', e => {
    const sel = e.target.closest('select.annee[data-action-change]');
    if (!sel || sel.dataset.actionChange === 'sales-range') return;
    const fn = ACTIONS[sel.dataset.actionChange];
    if (fn) fn({ dataset: { year: sel.value, type: sel.value } });
  });

  /* Renommer un bien renomme son contenant du meme coup : ils ne designent
     qu'une chose, ils ne doivent porter qu'un nom. Une SCPI, non : voir
     `nommerPlacementImmo`. */
  document.addEventListener('change', e => {
    const champ = e.target.closest('[data-action-change="renommer-bien"]');
    if (!champ) return;
    const nom = champ.value.trim();
    const c = compteById(champ.dataset.compte);
    if (!c || !nom) { render(); return; }
    nommerPlacementImmo(c, nom, champ.dataset.i === undefined ? null : +champ.dataset.i);
    Store.save(); render();
    toast(`${trad('Renommé en')} ${guill(nom)}`);
  });

  document.addEventListener('change', e => {
    const champ = e.target.closest('[data-action-change="rename-category"]');
    if (!champ) return;
    const ancien = champ.dataset.cat, nouveau = champ.value.trim();
    if (!nouveau || nouveau === ancien) { champ.value = ancien; return; }
    if (!renameExpenseCategory(ancien, nouveau)) {
      champ.value = ancien;
      toast(trad('Ce nom est déjà pris'));
      return;
    }
    Store.save(); render();
    toast(`${guill(ancien)} ${trad('renommée')} ${guill(nouveau)}`);
  });

  document.addEventListener('change', e => {
    const f = e.target.closest('[data-path]');
    if (!f) return;
    const bloc = f.closest('[data-differe]');
    if (bloc) { bloc.dataset.differe = 'sale'; return; }
    if (bloc) { bloc.dataset.differe = 'sale'; return; }
    const tauxAvant = TAUX_PROJECTION.includes(f.dataset.path)
      ? projectionSettings() : null;
    applyField(f);
    if (tauxAvant) {
      const m = Store.state.meta;
      if (f.dataset.path !== 'meta.projRate') m.projRate = tauxAvant.rate;
      if (f.dataset.path !== 'meta.projRateAutres') m.projRateAutres = tauxAvant.rateAutres;
      if (f.dataset.path !== 'meta.projRateGaranti') m.projRateGaranti = tauxAvant.rateGaranti;
      m.projScenario = 'perso';
    }
    /* `change` clot une saisie -- une liste choisie, un champ quitte -- donc rien a
       regrouper : l'envoi part tout de suite. Seul `input`, caractere par
       caractere, a besoin du delai. */
    Store.save();
    marquerEcrit(f);
    /* Une liste ne reprend pas le focus.

       Le rendu du focus existe pour les champs de texte : `render()` reconstruit
       le balisage a chaque frappe, et sans lui le curseur sauterait du champ des
       qu'on tape un chiffre. Sur une liste, il fait l'inverse de ce qu'on veut --
       on vient de choisir, le selecteur natif se referme, et lui rendre le focus
       le rouvre. Sur iPhone la liste resterait ouverte apres le choix, et il
       faudrait toucher deux fois.

       Le `blur()` avant le rendu est la seconde moitie : sans lui, le selecteur
       natif survit a la destruction du `<select>` qui le portait, et flotte
       au-dessus d'un element qui n'existe plus. */
    const estListe = f.tagName === 'SELECT';
    if (estListe) f.blur();
    const path = estListe ? null : document.activeElement?.dataset?.path;
    render();
    majApercu();
    if (path) {
      const again = $(`[data-path="${CSS.escape(path)}"]`);
      if (again && again.focus) again.focus();
    }
    const m = path && path.match(/^positions\.(\d+)\.symbol$/);
    if (m) lookupSymbol(+m[1]);
  });

  document.addEventListener('keydown', e => {
    const key = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
    if (!key) return;
    const el = document.activeElement;
    if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;  // laisse l'undo natif
    e.preventDefault();
    ACTIONS['undo']();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest?.('[role="button"][data-action]');
    if (!el) return;
    e.preventDefault();
    ACTIONS[el.dataset.action]?.(el);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'h' && e.key !== 'H') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable)) return;
    e.preventDefault();
    ACTIONS['toggle-masque']();
  });

  monteGlissementFermeture($('#modal'));
  monteGlissementFermeture($('#confirm'));
  monteVideChamp();

  /* La molette ne doit pas changer une liste deroulante.
     Chrome et Firefox font defiler les options d'un `select` survole ou
     actif : dans un tableau large ou l'on fait defiler beaucoup, un coup de
     molette suffit a changer la classe d'une ligne sans que rien ne le
     signale. La valeur est enregistree aussitot, et rien ne distingue ensuite
     l'accident d'un choix. On laisse la molette faire defiler la page. */
  document.addEventListener('wheel', e => {
    const sel = e.target.closest?.('select');
    if (sel && document.activeElement === sel) sel.blur();
  }, { passive: true, capture: true });

  /* --- tiroir : burger et bouton profil ---------------------------------------
     Deux portes pour le meme tiroir, et un seul etat : `setNav` pose
     `aria-expanded` et le libelle sur les deux a la fois. Le logo n'en est pas
     une : c'est un lien vers la vue d'ensemble, qui y mene meme sans
     JavaScript. */
  const burger = $('#burger'), backdrop = $('#navBackdrop'), profil = $('#btnProfil');
  const setNav = open => {
    document.body.classList.toggle('nav-open', open);
    /* Ouvrir le tiroir rend la barre du haut. Deux raisons, et la seconde est un
       garde-fou : le tiroir monte du bas de la fenetre, mais il est un enfant de
       cette barre -- un `transform` sur elle en ferait le bloc conteneur du tiroir,
       qui s'ouvrirait alors hors de l'ecran. Et sur le fond, un menu qu'on ouvre
       n'a pas de raison de cohabiter avec une barre a moitie partie. */
    if (open) document.body.classList.remove('haut-cache');
    for (const b of [burger, profil]) {
      if (!b) continue;
      b.setAttribute('aria-expanded', String(open));
      b.setAttribute('aria-label', trad(open ? 'Fermer le menu' : 'Ouvrir le menu'));
    }
    backdrop.hidden = !open;
    majOnglets();
  };
  const bascule = () => setNav(!document.body.classList.contains('nav-open'));
  burger.addEventListener('click', bascule);
  profil?.addEventListener('click', () => { retourHaptique(); fermeNotifs(); bascule(); });

  /* L'appui sur le logo se voit aussi au doigt.

     Safari sur iOS n'applique pas `:active` au toucher tant qu'aucun ecouteur
     tactile ne vit sur l'element : sans celui-ci, la regle d'appui ne jouerait
     jamais la ou elle compte. Le halo de survol, lui, vit sous
     `@media (hover: hover)` -- au doigt, il resterait allume apres un appui --
     et ne donne donc aucun retour au telephone.

     Le seuil de 160 ms est ce qui rend un tap visible : posee et retiree au
     rythme du doigt, la classe pourrait ne vivre que 40 ms, et l'animation ne
     se verrait pas. Au-dela du seuil, c'est la levee du doigt qui commande -- un
     appui long garde donc le logo enfonce, ce qui est le comportement d'une
     touche. */
  const marque = $('.brand');
  if (marque) {
    let debut = 0, fin = null;
    marque.addEventListener('pointerdown', () => {
      clearTimeout(fin);
      marque.classList.add('tape');
      debut = performance.now();
    });
    const lever = () => {
      clearTimeout(fin);
      fin = setTimeout(() => marque.classList.remove('tape'),
        Math.max(0, 160 - (performance.now() - debut)));
    };
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      marque.addEventListener(ev, lever);
    }

    /* Et il ramene a l'accueil, tout en haut -- c'est ce qu'on attend d'un logo,
       meme quand chaque vue retient sa position.

       Deux chemins, parce que le geste a deux issues. Depuis un autre ecran il
       navigue, et c'est le rendu qui suit qui doit ignorer la position retenue.
       Depuis l'accueil lui-meme l'adresse ne change pas, donc rien ne se rend, et
       il faut remonter ici : ce cas-la ne se voit jamais en essayant depuis une
       autre page. Meme glissement doux que le reappui sur un onglet du bas.

       Ce bloc reste apres le cablage tactile ci-dessus, et pas avant : un
       controle lit ce qui suit `$('.brand')` pour verifier que le `pointerdown`
       existe, et l'en eloigner le fait echouer. */
    marque.addEventListener('click', () => {
      if (location.hash !== marque.getAttribute('href')) { retourHautDemande = true; return; }
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0,
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  }
  backdrop.addEventListener('click', () => setNav(false));
  $('#nav').addEventListener('click', e => {
    const porte = e.target.closest('a, [data-action="goto"]');
    if (!porte) return;
    setNav(false);
    const href = porte.getAttribute?.('href');
    if (href && href !== location.hash) retourHautDemande = true;
  });
  $('#tabbar')?.addEventListener('click', e => {
    const lien = e.target.closest('a');
    if (!lien) return;
    retourHaptique();
    if (lien.getAttribute('href') !== location.hash) rejouerClasse(e.currentTarget, 'tape', 400);

    setNav(false);
    /* "Deja sur place" se juge sur l'adresse, pas sur la vue.

       Quand l'adresse change, laisser le lien naviguer suffit : `currentView()`
       remet le premier sous-onglet des qu'on arrive sur l'adresse de base, et
       c'est deja la regle ecrite pour le menu lateral. Le rebond et le retour en
       haut ne servent qu'a reappuyer sur l'onglet ou l'on est deja, ou l'adresse
       ne bouge pas et ou rien ne se produirait. */
    const quitteEdition = apercuEdition;
    apercuEdition = false;
    if (lien.getAttribute('href') !== location.hash) { retourHautDemande = true; return; }
    e.preventDefault();
    if (quitteEdition) render();
    rejouerClasse(lien, 'rebond', 420);
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });

  document.addEventListener('pointerdown', e => {
    const p = $('#panneauNotifs');
    if (!p || p.hidden) return;
    if (e.target.closest('#panneauNotifs, #btnCloche')) return;
    fermeNotifs();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fermeNotifs(); });
  /* Tout ce qui navigue depuis le panneau le referme : `goto` ferme les fenetres
     d'apercu, pas celui-ci. La croix, elle, le laisse ouvert -- on masque souvent
     deux lignes de suite. */
  $('#panneauNotifs')?.addEventListener('click', e => {
    if (e.target.closest('[data-action="goto"]')) fermeNotifs();
  });

  (() => {
    const nav = $('#nav');
    if (!nav) return;
    let y0 = null, x0 = 0, dy = 0, sens = null, trame = 0, vitesse = 0, dernierY = 0, dernierT = 0;

    const enHaut = () => nav.scrollTop <= 0;
    const poser = () => {
      trame = 0;
      const d = dy < 0 ? dy / 6 : dy;      // vers le haut : resistance forte
      nav.style.transform = 'translate3d(0, ' + d + 'px, 0)';
    };
    const relacher = () => {
      nav.style.transition = '';
      nav.style.transform = '';
      nav.style.willChange = '';
    };

    nav.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || !document.body.classList.contains('nav-open')) return;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
      dy = 0; sens = null; vitesse = 0;
      dernierY = y0; dernierT = performance.now();
      nav.style.transition = 'none';
      nav.style.willChange = 'transform';
    }, { passive: true });

    nav.addEventListener('touchmove', e => {
      if (y0 === null) return;
      const ey = e.touches[0].clientY - y0, ex = e.touches[0].clientX - x0;
      if (sens === null) {
        if (Math.abs(ex) < 8 && Math.abs(ey) < 8) return;
        sens = Math.abs(ey) > Math.abs(ex) * 1.2 ? 'vertical' : 'lateral';
        if (sens === 'lateral' || (ey > 0 && !enHaut())) { relacher(); y0 = null; return; }
      }
      const t = performance.now();
      const dt = Math.max(8, t - dernierT);
      vitesse = vitesse * 0.7 + ((e.touches[0].clientY - dernierY) / dt) * 0.3;
      dernierY = e.touches[0].clientY; dernierT = t;
      dy = ey;
      if (!trame) trame = requestAnimationFrame(poser);
    }, { passive: true });

    const fin = () => {
      if (y0 === null) return;
      if (trame) { cancelAnimationFrame(trame); trame = 0; }
      const hauteur = nav.getBoundingClientRect().height || innerHeight;
      const ferme = dy > hauteur * 0.3 || (vitesse > 0.6 && dy > 70);
      y0 = null; sens = null;
      if (!ferme) {
        nav.style.transition = 'transform .28s cubic-bezier(.16,1,.3,1)';
        nav.style.transform = '';
        setTimeout(() => { nav.style.transition = ''; nav.style.willChange = ''; }, 300);
        return;
      }
      nav.style.transition = 'transform .2s cubic-bezier(.3,0,.2,1)';
      nav.style.transform = 'translate3d(0, ' + hauteur + 'px, 0)';
      setNav(false);
      setTimeout(relacher, 210);
    };
    nav.addEventListener('touchend', fin);
    nav.addEventListener('touchcancel', fin);
  })();

  $('#modalClose').addEventListener('click', closeApercu);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeApercu(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeApercu();
  });

  /* Le rechargement remplace le `render()` : il repeint tout, y compris le fond
     du corps, que l'attribut seul ne suffit pas a repeindre. Voir applyTheme. */
  $('#themeToggle').addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
  });

  try {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (themeChoisi() === 'system') document.documentElement.dataset.theme = themeSysteme();
    });
  } catch (e) { /* pas de matchMedia */ }
}

const THEME_KEY = 'wealth-dashboard:theme';
function currentTheme() {
  return document.documentElement.dataset.theme
    || (() => { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } })()
    || 'dark';
}
function themeChoisi() {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
}
const themeSysteme = () => {
  try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; }
};
const themeEffectif = choix => choix === 'system' ? themeSysteme() : (choix || 'dark');
/* Le theme s'ecrit, puis la page se recharge. Comme la langue, et pour une
   raison plus betement technique.

   Changer l'attribut suffit a repeindre la barre laterale, les cartes, les
   textes, les graphiques : tout suit les variables. Tout, sauf le fond du corps.
   Mesure sur ce navigateur, theme passe en clair sans rechargement :
   `getComputedStyle(document.documentElement)` rend bien #f7f9fb, la variable
   `--page` lue sur le corps rend #f7f9fb, un element cree a l'instant avec
   `background: var(--page)` rend #f7f9fb -- et le corps, lui, reste peint en
   #08090b jusqu'au rechargement suivant : des cartes claires posees sur une
   page noire.

   Ni `background-color` au lieu du raccourci `background`, ni une declaration
   unique sur le corps, ni un cycle de rendu force ne le repeignent. Le
   rechargement est la seule voie qui tienne, et il ne coute rien ici : l'etat
   est deja enregistre, aucune saisie ne se perd, et le selecteur de langue fait
   exactement ce geste.

   Le drapeau, enfin : appeler ceci au demarrage rechargerait en boucle. Il reste
   donc faux quand on applique le theme lu au chargement, et vrai quand c'est
   quelqu'un qui vient de le changer. */
function applyTheme(nom, recharger = false) {
  document.documentElement.dataset.theme = themeEffectif(nom);
  try { localStorage.setItem(THEME_KEY, nom); } catch (e) {}
  if (recharger) location.reload();
}

async function lookupSymbol(i) {
  const p = Store.state.positions[i];
  if (!p) return;
  const sym = (p.symbol || '').trim().toUpperCase();
  if (!sym) return;
  if (Quotes.isOnline() === null) await Quotes.health();
  if (Quotes.isOnline() === false) return;

  try {
    const r = await fetch(`${Quotes.BASE}/api/quotes?symbols=${encodeURIComponent(sym)}`, { cache: 'no-store' });
    const q = (await r.json()).quotes?.[0];
    if (!q || q.error || !q.price) {
      toast(`${trad('Symbole')} ${guill(sym)} ${trad('introuvable')}`);
      return;
    }
    p.symbol = q.symbol || sym;
    if (q.currency) p.currency = q.currency;
    if (!p.name || p.name === 'Nouvelle ligne') p.name = q.name || p.symbol;
    Store.save();
    await Quotes.refresh();          // cours et taux de change coherents
    render();
    toast(`${q.name || p.symbol} · ${q.price} ${q.currency || ''}`);
  } catch (e) {
    toast(trad('Recherche impossible :') + ' ' + e.message);
  }
}

function showFileModeBanner() {
  try { if (sessionStorage.getItem('wd:fileBannerSeen')) return; } catch (e) {}
  const el = document.createElement('div');
  el.className = 'file-banner';
  el.innerHTML = `
    <span>📄</span>
    <div><b>${trad('Mode fichier.')}</b> ${trad('Les cours de bourse ne peuvent pas être '
      + 'récupérés, et tes données sont enregistrées séparément de celles du mode serveur. '
      + 'Pour n’avoir qu’un seul jeu de données, lance plutôt')}
      <code>python serve.py</code>.</div>
    <button class="btn ghost sm" type="button">${trad('Compris')}</button>`;
  el.querySelector('button').addEventListener('click', () => {
    try { sessionStorage.setItem('wd:fileBannerSeen', '1'); } catch (e) {}
    el.remove();
  });
  $('.main').insertBefore(el, $('#view'));
}

function applyField(f) {
  const path = f.dataset.path;
  if (/\.part$/.test(path) && f.value !== '' && !partEstValide(f.value)) {
    f.dataset.invalide = '1';
    f.setAttribute('aria-invalid', 'true');
    return;
  }
  const aff = /^comptes\.(\d+)\.cash\.(\d+)\.affectation$/.exec(path);
  if (aff) {
    const c = Store.state.comptes[+aff[1]];
    if (c && (c.cash || []).some((e, j) => j !== +aff[2] && e.affectation === f.value)) {
      f.dataset.invalide = '1';
      f.setAttribute('aria-invalid', 'true');
      toast(trad('Une autre part de ce compte porte déjà cette affectation.'));
      return;
    }
  }
  delete f.dataset.invalide;
  f.removeAttribute('aria-invalid');
  if (f.type === 'checkbox') { setPath(path, f.checked); return; }
  if (f.type === 'number' && !nombreValide(f.value, genreDuChemin(path))) {
    f.dataset.invalide = '1';
    f.setAttribute('aria-invalid', 'true');
    return;
  }
  if (f.type === 'number') {
    const suivi = dateQuiSuit(path);
    const avant = suivi || path === 'meta.objective' ? getPath(path) : undefined;
    setPath(path, f.value === '' ? '' : Number(f.value));
    if (suivi && montantChange(avant, getPath(path))) setPath(suivi.chemin, dateApresChangement(suivi.genre));
    if (path === 'meta.objective') suivreCibleObjectif(avant, getPath(path));
    return;
  }
  if (f.dataset.type === 'num') { setPath(path, Number(f.value)); return; }
  if (f.dataset.type === 'bool') { setPath(path, f.value === 'true'); return; }

  const m = path.match(/^positions\.(\d+)\.isin$/);
  if (m) {
    const p = Store.state.positions[+m[1]];
    const next = f.value.trim().toUpperCase();
    if (p && next !== (p.isin || '')) p.symbol = '';
    setPath(path, next);
    return;
  }

  setPath(path, f.value);
}

function ecranIdentiteManquante() {
  document.getElementById('lancement')?.remove();
  document.body.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center">
      <div style="max-width:26em">
        <img src="/icon-192.png" alt="" width="56" height="56" style="border-radius:12px">
        <h1 style="font-size:var(--font-xl);margin:18px 0 8px">${trad('Session à revérifier')}</h1>
        <p style="opacity:.75;line-height:1.55">${
          trad('Ton compte n’a pas pu être confirmé. Recharge la page pour te reconnecter.')}</p>
        <p style="margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="btn" href="/">${trad('Réessayer')}</a>
          <a class="btn ghost" href="/api/logout">${trad('Se déconnecter')}</a>
        </p>
      </div>
    </div>`;
}

const patienter = ms => new Promise(r => setTimeout(r, ms));
function demoAJour() {
  const mois = (async () => {
    try {
      const r = await fetch(`${Quotes.BASE}/api/demo?jour=${todayISO()}`, { cache: 'no-store' });
      if (!r.ok) return null;
      const bilan = appliquerDemoVivante(await r.json());
      if (bilan) Store.save({ derive: true });
      return bilan;
    } catch (e) { console.warn('Démonstration : mise à jour indisponible', e); return null; }
  })();
  const cours = Quotes.suivre((async () => {
    const last = Store.state.quotes?.lastRun;
    if (last && Date.now() - new Date(last) < 10 * 60 * 1000) return;
    if (!await Quotes.health()) return;
    try { await Quotes.refresh(); } catch (e) { console.warn('Cours indisponibles', e); }
  })());
  return { mois, cours };
}

partieChargee('assets/app-11-fenetre-apercu.js');
(async function init() {
  if (partiesManquantes().length) { signalerPartiesManquantes(); return; }
  try {
    document.documentElement.dataset.theme =
      themeEffectif(localStorage.getItem('wealth-dashboard:theme') || 'dark');
  } catch (e) { document.documentElement.dataset.theme = 'dark'; }
  const localDAbord = CloudSync.sansComptesConnu();
  if (!localDAbord) {
    await CloudSync.probe();
    const portee = CloudSync.getUserId();
    if (portee) {
      setStorageScope(portee);
      relireMasque();
    } else if (CloudSync.comptesActifs()) {
      /* Sans ce refus, la portee reste vide et `Store.load()` lit la clef sans
         suffixe, celle d'avant les comptes, que tout le monde partage sur ce
         navigateur. Une coupure reseau au demarrage suffirait a remettre deux
         personnes sur le meme patrimoine. */
      ecranIdentiteManquante();
      return;
    }
  }
  Store.load();
  const demoEnCours = estDemoVivante() ? demoAJour() : null;
  if (demoEnCours) await Promise.race([demoEnCours.mois, patienter(2500)]);
  Store.autoBackup();
  translateStatic();          // libelles du menu, avant le premier rendu
  bindGlobal();
  $('#btnLogout')?.addEventListener('click', async e => {
    e.preventDefault();
    const scope = CloudSync.getUserId();
    if (scope) {
      const suffix = `:user:${scope}`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.endsWith(suffix)) localStorage.removeItem(key);
      }
    }
    try { await fetch('/api/logout', { method: 'POST' }); } catch (err) { /* session deja vide */ }
    location.replace('/');
  });
  render();
  apresDeuxTrames(signalerRendu);

  const lancement = $('#lancement');
  if (lancement) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      lancement.classList.add('parti');
      setTimeout(() => lancement.remove(), 400);
    }));
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW non enregistré', e));
  }

  if (location.protocol === 'file:') showFileModeBanner();

  /* Prendre la version en ligne, et rien d'autre.

     Trois chemins y menent -- l'appareil simplement en retard, l'appareil en
     retard qui portait une modification, et l'ecriture refusee -- et ils font
     la meme chose : c'est toujours la version en ligne, sans demander.

     Ce que ce choix coute, et il faut l'ecrire ici : la modification locale qui
     n'etait pas partie disparait de l'ecran. La sauvegarde qui precede n'est
     donc pas une precaution de confort, c'est la seule chose qui rende le geste
     reversible -- Donnees, puis la liste des sauvegardes. Le message le dit, sans
     quoi personne ne saurait ou chercher.

     `noterVersionLue` fait deux choses et les deux comptent : la version prise
     devient la base des ecritures suivantes, sinon la prochaine sauvegarde se
     ferait refuser pour avoir declare une version qui n'est plus en place ; et
     le conflit se clot, sinon la cloche reclamerait un arbitrage deja rendu. */
  /* Le geste vit dans `Store.adopterVersionEnLigne`, porte commune avec
     "Recharger depuis le cloud" ; ici, l'ecran et le message. Un refus
     d'ecriture locale tait la reussite : le signal d'echec parle a sa place. */
  async function prendreVersionEnLigne(donnees, quand, mot, revision) {
    const ecrit = Store.adopterVersionEnLigne(donnees, quand, undefined, revision);
    render();
    if (ecrit) toast(trad(mot));
  }

  if (localDAbord) {
    await CloudSync.probe();
    const portee = CloudSync.getUserId();
    if (portee) {
      setStorageScope(portee);
      relireMasque();
      Store.load();
      render();
    }
  }

  /* `onChange` part du `finally` de chaque envoi, abouti ou non : c'est le seul
     moment ou l'on sait quoi promettre au temoin. */
  CloudSync.setOnChange(() => {
    majTemoinEnregistrement();
    if (currentView() === 'data') render();
  });
  async function brancherCloud(cloud) {
    if (cloud.bascule) {
      majTemoinEnregistrement();
      setTimeout(async () => {
        try { await brancherCloud(await CloudSync.init()); }
        catch (e) { console.warn('Synchro cloud indisponible', e); }
      }, Math.max(5, Number(cloud.attente) || 30) * 1000);
      return;
    }
    majTemoinEnregistrement();
    if (cloud.adopted) {
      /* Cet appareil est simplement en retard, sans modification locale :
         on prend la version en ligne sans rien demander, avec une sauvegarde.

         Cette branche remplace tout l'etat sur la foi d'un repere, et un repere
         peut se tromper -- voir `arbitrer()` dans cloudsync.js. Le remplacement
         se fait sans question par construction, donc la seule chose qui rende
         l'erreur reparable est un point de retour : Donnees -> sauvegardes. Elle
         ne coute rien. */
      await prendreVersionEnLigne(cloud.data, cloud.at, 'Données à jour depuis le cloud', cloud.revision);
    } else if (cloud.newer) {
      await prendreVersionEnLigne(cloud.data, cloud.at,
        'Version en ligne reprise. Ta saisie est dans les sauvegardes.', cloud.revision);
    } else if (cloud.aEnvoyer) {
      /* Cet appareil porte une modification jamais partie, et le cloud est
         reste exactement la ou il l'avait laisse. Elle part maintenant, sans
         attendre la prochaine frappe : l'application peut passer en veille avant
         l'envoi differe, et la modification se perdrait.

         SANS `force`. Une estampille plus fraiche ne prouve pas un contenu plus
         frais : un ordinateur rouvert apres plusieurs jours peut se croire en
         avance sur un telephone qui, lui, a vraiment saisi quelque chose.
         `force` dirait au serveur de sauter le garde-fou de filiation, et le
         contenu perime ecraserait le contenu reel, sans sauvegarde, sans
         question et sans message.

         `init()` ne renvoie `aEnvoyer` que lorsque la base connue EST la version
         en ligne. L'ecriture ordinaire passe donc, et si le cloud a bouge entre
         la lecture et l'envoi, le refus ramene a l'arbitrage plutot que de le
         supprimer. */
      await CloudSync.push();
    } else if (cloud.empty) {
      /* Premier envoi : rien en ligne, donc rien a perdre. Sans `force` non
         plus -- `init()` a efface le repere, l'ecriture part sans base, et c'est
         le serveur qui n'insere que s'il n'y a toujours rien. Si cette lecture
         a vide etait fausse, un refus vaut mieux qu'un patrimoine efface. Rien
         en ligne ne pouvant etre remplace, une suspension n'a plus d'objet. */
      Store.leverSuspension();
      await CloudSync.push();
    }
  }

  CloudSync.setOnConflit(async d => {
    try {
      const lu = await CloudSync.pull();
      if (lu) {
        await prendreVersionEnLigne(lu.donnees,
          lu.donnees?.meta?.savedAt || d.remoteSavedAt,
          'Version en ligne reprise. Ta saisie est dans les sauvegardes.', lu.revision);
        return;
      }
    } catch (e) { /* hors ligne : on garde ce qu'on a, et la cloche le dira */ }
    toast(trad('Modification gardée ici : une autre version existe en ligne'));
    render();
  });
  try {
    const cloud = modeDemo() ? { available: false } : await CloudSync.init();
    await brancherCloud(cloud);
    /* Deux evenements, et c'est le second qui repare la perte.

       `pagehide` ne suffit pas sur telephone : verrouiller l'ecran ou passer a
       une autre application ne decharge pas la page, elle est gelee puis
       restauree. L'evenement n'arrive donc jamais, le minuteur d'envoi differe ne
       tire pas non plus -- un onglet gele n'execute rien -- et la modification
       reste dans le seul `localStorage`. Elle se perd au premier appareil qui
       pousse ensuite.

       `visibilitychange` vers `hidden` est le seul signal fiable de ce
       passage-la, sur iOS comme sur Android. C'est le dernier moment ou du code
       tourne encore, donc le dernier ou l'on peut ecrire.

       Les deux restent branches : `pagehide` couvre la fermeture d'onglet sur
       ordinateur, ou la page peut disparaitre sans jamais devenir cachee.
       `flushOnUnload` ne fait rien quand le corps n'a pas change, donc le double
       appel est sans effet. */
    if (cloud.available) {
      window.addEventListener('pagehide', () => CloudSync.flushOnUnload());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) CloudSync.flushOnUnload();
        else CloudSync.reprendre();
      });
      /* Une page restauree du cache d'arriere-plan ne repasse pas toujours par
         `visibilitychange` : `pageshow` persiste couvre ce retour-la. */
      window.addEventListener('pageshow', e => { if (e.persisted) CloudSync.reprendre(); });
      window.addEventListener('online', () => CloudSync.push());
    }
  } catch (e) { console.warn('Synchro cloud indisponible', e); }

  const online = await Quotes.health();
  majEtatCours();
  if (!online) { if (currentView() === 'positions') render(); return; }

  const last = Store.state.quotes?.lastRun;
  const stale = !last || (Date.now() - new Date(last)) > 10 * 60 * 1000;
  if (demoEnCours) await Promise.all([demoEnCours.mois, demoEnCours.cours]);
  else if (Store.state.meta.autoRefresh && stale) {
    try { await Quotes.refresh(); } catch (e) { console.warn('Cours indisponibles', e); }
  }
  render();

  const ouverte = x => {
    const s = marketStatus(x);
    return !!s && (s.cle === 'open' || s.cle === 'pre' || s.cle === 'post');
  };
  const placeOuverte = () => Store.state.positions.some(ouverte);
  /* Le ruban a sa propre garde.

     Avec celle des positions, rien ne se redemanderait tant qu'aucune ligne
     DETENUE ne cote : un portefeuille europeen, a dix-huit heures, verrait le
     S&P 500 fige pour la soiree, Wall Street ouverte. Le ruban ne parle pas de
     ce qu'on detient, il parle du marche : il se juge sur SES lignes.

     Elles sont deja en main -- `REPERES_AFFICHES` porte celles du dernier rendu,
     avec l'etat de leur place. Aucune table d'horaires a tenir. */
  const repereOuvert = () => REPERES_AFFICHES.some(ouverte);

  async function rafraichirSiUtile() {
    if (!Store.state.meta.autoRefresh) return;
    if (document.hidden || !Quotes.isOnline()) return;
    let aBouge = false;
    const l = Store.state.quotes?.lastRun;
    const positionsFraiches = l && Date.now() - new Date(l) < 5 * 60 * 1000;
    if (!positionsFraiches && placeOuverte()) {
      try { await Quotes.refresh(); aBouge = true; }
      catch (e) { console.warn('Cours indisponibles', e); }
    }
    if (repereOuvert()) { Quotes.oublierReperes(); aBouge = true; }
    if (aBouge) render();
  }

  setInterval(rafraichirSiUtile, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rafraichirSiUtile(); });

  setInterval(() => majEtatCours(), 60 * 1000);
})();
