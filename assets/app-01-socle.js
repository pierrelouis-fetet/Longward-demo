/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const escMontant = s => {
  const t = esc(s);
  return t.includes('oeil-masque') ? t.split(esc(OEIL_MASQUE)).join(OEIL_MASQUE) : t;
};

const S1 = () => Charts.cssv('--series-1');
const S2 = () => Charts.cssv('--series-2');
const S3 = () => Charts.cssv('--series-3');
const S4 = () => Charts.cssv('--series-4');
const S5 = () => Charts.cssv('--series-5');

function cls(v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }
const monthsLeftInYear = () => monthsToObjective();
function arrow(v) { return v > 0 ? '▲' : v < 0 ? '▼' : '•'; }

let savedTimer = null;
function libelleEnregistrement() {
  if (modeDemo() || !CloudSync.isAvailable()) return trad('Sauvegardé localement');
  const s = CloudSync.status();
  if (s.error || s.conflict) return trad('Sauvegardé localement');
  /* LA QUESTION EST CE QUI RESTE A ENVOYER, PAS CE QUI A DEJA ETE ENVOYE.
     `lastPush` ne vaut que pour la page en cours : arriver sur une application
     deja synchronisee ne declenche aucun envoi, et un temoin qui le lirait
     annoncerait localement alors que tout est en ligne. `aJour()` compare le
     repere de synchronisation a l'etat en memoire, et ce repere-la survit au
     rechargement. */
  if (s.pushing || !CloudSync.aJour()) return trad('Envoi au cloud…');
  return trad('Sauvegardé dans le cloud');
}

function majTemoinEnregistrement() {
  const f = $('#savedFlag');
  if (f && !f.classList.contains('ko') && !f.classList.contains('flash')) {
    f.textContent = libelleEnregistrement();
  }
}

function signalerEcritureVue(ok, premierEchec) {
  const f = $('#savedFlag');
  if (f) {
    f.classList.toggle('ko', !ok);
    if (!ok) f.textContent = trad('Non enregistré');
    else f.textContent = libelleEnregistrement();
  }
  if (!ok && premierEchec) {
    toast(trad('Impossible d’enregistrer sur cet appareil. Exporte une sauvegarde.'));
  } else if (ok) {
    toast(trad('Enregistrement rétabli.'));
  }
}
if (typeof poserSignalEcriture === 'function') poserSignalEcriture(signalerEcritureVue);

function flashSaved() {
  const f = $('#savedFlag');
  if (!f) return;
  f.textContent = trad('Sauvegardé ✓');
  f.classList.add('flash');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { f.classList.remove('flash'); f.textContent = libelleEnregistrement(); }, 1400);
}

let champsEcrits = new WeakMap();
function marquerEcrit(champ) {
  if (!champ) return;
  champ.classList.remove('champ-ecrit');
  clearTimeout(champsEcrits.get(champ));
  requestAnimationFrame(() => {
    champ.classList.add('champ-ecrit');
    champsEcrits.set(champ, setTimeout(() => champ.classList.remove('champ-ecrit'), 900));
  });
}

function toast(msg, action) {
  msg = ponct(msg);
  const t = $('#toast');
  t.innerHTML = escMontant(msg); t.hidden = false;
  /* Un vrai bouton, pose apres le texte : la reecriture vient d'effacer les
     enfants du message precedent, donc rien a nettoyer. On l'assemble en DOM
     plutot qu'en HTML parce que `msg` porte des noms de comptes. */
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = action.label;
    b.onclick = () => {
      t.hidden = true; t.classList.remove('toast-sort');
      clearTimeout(t._t); clearTimeout(t._s);
      action.run();
    };
    t.append(b);
  }
  t.classList.remove('toast-sort');
  clearTimeout(t._t); clearTimeout(t._s);
  const vie = action ? 6000 : 2300;
  t._s = setTimeout(() => t.classList.add('toast-sort'), vie);
  t._t = setTimeout(() => { t.hidden = true; t.classList.remove('toast-sort'); }, vie + 350);
}

/* UNE SEULE PORTE VERS LE PRESSE-PAPIERS, ET ELLE DIT CE QU'ELLE A FAIT.

   L'interface entiere est non selectionnable : un appui maintenu n'ouvre plus
   ni loupe, ni poignees, ni menu Copier / Chercher / Traduire. Le prix de cette
   regle, c'est qu'une donnee qu'on recopie vraiment ailleurs — un numero de
   compte dans un virement, un ISIN dans la recherche d'un courtier — n'a plus
   aucun chemin. Elle en recoit un explicite, en un appui, et lui seul.

   `navigator.clipboard` n'existe pas hors contexte securise, et il refuse aussi
   quand l'appui ne vient pas d'un geste : les deux cas passent par le meme
   `catch`, et AUCUN des deux ne fait croire que la copie a eu lieu. Le canal est
   le toast de la maison — 2 300 ms, la duree deja retenue pour un message qui
   n'attend pas de reponse — et non une nouvelle infrastructure.

   Le texte affiche est ici le texte complet : rien n'est masque dans ces deux
   endroits, donc rien n'est reconstitue pour l'occasion. */
async function copierDansLePressePapiers(valeur) {
  const texte = String(valeur ?? '').trim();
  if (!texte) return false;
  try {
    await navigator.clipboard.writeText(texte);
    toast(trad('Copié'));
    return true;
  } catch (err) {
    toast(trad('Impossible de copier'));
    return false;
  }
}

/* LE BOUTON RESTE UNE ICONE, ET IL PORTE SON NOM.

   Secondaire par le dessin — pas de fond, pas de bordure, l'encre en retrait —
   et precis par le nom : « Copier le numéro de compte », jamais « Copier » seul,
   qui ne dirait pas quoi a qui lit l'ecran a l'oreille. `title` porte le meme
   mot pour la souris.

   Il ne s'ecrit pas si la valeur est vide : une ligne absente n'a rien a rendre,
   et une icone morte se cliquerait quand meme. */
const boutonCopier = (valeur, libelle) => {
  const v = String(valeur ?? '').trim();
  if (!v) return '';
  const nom = esc(trad(libelle));
  return `<button type="button" class="btn-copie" data-action="copier"
     data-copie="${esc(v)}" aria-label="${nom}" title="${nom}"
     ><svg viewBox="0 0 24 24" aria-hidden="true"
       ><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg></button>`;
};

/* La porte de sortie d'une ecriture, a passer en second argument de `toast`.

   Elle n'existe que si la pile a de quoi revenir. Offrir « Annuler » sur une
   pile vide serait la pire des promesses : le bouton ne rendrait pas l'etat
   d'avant, il en remonterait un plus ancien, ou rien du tout. */
const porteDeSortie = (label = 'Annuler') =>
  Store.canUndo() ? { label, run: () => ACTIONS['undo']() } : null;

function sauvegardeAvantEcrasement(row) {
  if (!row || rowIsEmpty(row)) return;
  Store.addBackup(`avant écrasement du relevé de ${fmtMonth(row.date)}`);
}

/* Ouverture et fermeture de la fenetre, animees dans les deux sens.

   L'entree etait deja animee — retirer `hidden` fait rejouer les keyframes du
   panneau — mais la fermeture posait `hidden = true` d'un coup : la feuille qui
   glisse depuis le bas du telephone disparaissait sans le geste inverse, et
   c'est precisement la sortie qui donne la sensation de fluidite, parce qu'on
   la regarde toujours.

   La logique des appelants ne change pas : `masquerModal` rend la main tout de
   suite — les `resolve()` qui suivent partent sans attendre — seul le voile
   visuel s'attarde 170 ms. Le compteur de generation protege le cas reel ou
   une fenetre se rouvre pendant la sortie de la precedente (« Nouvelle
   categorie » ferme la saisie puis la rouvre) : la fermeture perimee ne doit
   pas eteindre la fenetre fraiche.

   Le compteur est par fenetre, et il a d'abord ete global — ce qui donnait
   l'inverse du but recherche. Deux fenetres existent, `#modal` et `#confirm`,
   et elles se ferment souvent l'une apres l'autre : « Annuler » sur la saisie
   d'un mois ferme la confirmation puis la saisie. La seconde fermeture faisait
   avancer le compteur, la sortie differee de la premiere se croyait perimee et
   rendait la main sans rien eteindre : `#confirm` restait avec `hidden = false`
   pour le reste de la session. Invisible — `pointer-events: none` et opacite
   nulle — donc jamais signale, mais present dans l'arbre d'accessibilite, et
   une seule regle de style en aurait fait un voile mort sur la page.

   Une `WeakMap` plutot qu'un champ sur l'element : rien a nettoyer, et aucun
   attribut de plus dans le DOM. */
const generationModal = new WeakMap();
const generationSuivante = m => {
  const g = (generationModal.get(m) || 0) + 1;
  generationModal.set(m, g);
  return g;
};
/* --- geler le fond pendant qu'une fenetre est ouverte ---------------------
   `overflow: hidden` sur le corps empeche bien la page de defiler derriere, et
   c'est ce que faisaient dix endroits, chacun a la main. Mais il ne garde pas la
   position : la page revenait tout en haut a l'ouverture, et on la retrouvait au
   sommet en fermant. Le defaut valait pour toutes les fenetres de
   l'application — aperçus, fiches, confirmations, formulaires.

   On fige donc le corps la ou il est : `position: fixed` avec un decalage
   negatif egal au defilement, puis on le rend et on remet le defilement a la
   fermeture. Les bords a zero, sinon un corps fixe se reduit a la largeur de son
   contenu.

   Le compteur sert aux fenetres empilees : une fiche ouvre une confirmation, et
   degeler a la premiere fermeture rendrait la page mobile sous la seconde. */
let fondGele = 0, modalesOuvertes = 0;

function gelerFond() {
  if (modalesOuvertes++ > 0) return;
  fondGele = window.scrollY || document.documentElement.scrollTop || 0;
  const b = document.body;
  b.style.position = 'fixed';
  b.style.top = `-${fondGele}px`;
  b.style.left = '0';
  b.style.right = '0';
  /* Pas d'`overflow: hidden` ici, et c'est un correctif, pas un oubli.

     Il rendait le fond noir des qu'on ouvrait une fenetre depuis une page
     defilee. `overflow: hidden` fait du corps une boite de rognage, et un corps
     en `position: fixed` sans hauteur prend alors celle de l'ecran : 812 px au
     lieu de 2 937. Pose a `top: -1833px`, ce bloc couvre la bande -1833 a
     -1021 — donc rien de ce qui est visible n'est peint, et on voit le vide.

     Il etait de toute façon inutile : `position: fixed` sort le corps du flux,
     `html` n'a plus de contenu, donc plus rien a faire defiler. C'est le
     positionnement qui gele la page, pas le rognage. */

  /* Le retrait de l'`overflow` n'a pourtant pas suffi, et voici l'autre moitie du
     meme defaut : `html, body { height: 100% }` donne au corps la hauteur de
     l'ecran, 812 px, quelle que soit la longueur de la page. Pose a `top: -700px`,
     il couvre la bande -700 a 112 : sous 112 px, plus rien n'est peint, et le
     voile de la fenetre — noir a 55 %, floute a 3 px — se pose alors sur du vide.
     « En bas c'est tout noir, on voit pas en flou l'ecran de derriere. »

     Mesure sur une fiche ouverte depuis un defilement de 700 px : 700 px d'ecran
     nus sur 812. La hauteur rendue au corps additionne donc l'ecran et le
     decalage, ce qui garantit qu'il couvre la zone visible d'un bord a l'autre,
     quel que soit l'endroit d'ou l'on ouvre. */
  b.style.height = `${window.innerHeight + fondGele}px`;
}

function degelerFond() {
  modalesOuvertes = Math.max(0, modalesOuvertes - 1);
  if (modalesOuvertes > 0) return;
  const b = document.body;
  b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = '';
  b.style.height = '';
  /* Plus d'`overflow` a remettre : `gelerFond()` n'en pose plus. Le laisser ici
     ferait croire que ce reglage est gere a cet endroit, et le prochain qui
     cherche pourquoi la page ne defile pas le lirait comme une piste. */
  window.scrollTo(0, fondGele);
}

/* Le gel s'apparie a la fenetre, pas a l'appel.

   La cause est un compteur desynchronise. `apercu-enregistrer` rouvre le panneau
   apres avoir enregistre — c'est voulu, on veut voir le total bouger — mais il le
   rouvrait **alors qu'il etait deja ouvert**. Le compteur passait donc a deux, et
   la fermeture suivante le ramenait a un : le fond restait gele pour toujours.

   Compter les appels supposait qu'ils vont par paires, ce que rien ne garantit.
   On marque donc la fenetre elle-meme : elle gele une fois, elle degele une fois,
   quel que soit le nombre d'appels et leur ordre. Le compteur garde son role — les
   fenetres empilees, une fiche qui ouvre une confirmation — mais il ne peut plus
   compter deux fois la meme. */
/* Rejouer un accuse d'appui : une classe qui porte une animation courte.

   Le delai de retrait est propre a chaque element. Un second appui annule
   celui du premier, sans quoi l'ancien delai retirerait la classe au milieu
   de la nouvelle animation. On retire la classe avant de la reposer, et la
   lecture de `offsetWidth` entre les deux fait rejouer l'animation. */
const minuteursAccuse = new WeakMap();
function rejouerClasse(el, classe, duree) {
  clearTimeout(minuteursAccuse.get(el));
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
  minuteursAccuse.set(el, setTimeout(() => el.classList.remove(classe), duree));
}

/* La fin d'un geste retire ce qu'il a pose en ligne : la transition du retour
   et `will-change`.

   Elle attend la fin de LA transition de `transform` de cet element : un
   enfant qui finit la sienne remonte jusqu'ici et ne compte pas. Sans
   transition, un simple toucher par exemple, l'evenement n'arrive jamais : un
   repli s'en charge. Le nettoyage retire son ecouteur et annule son repli,
   quel que soit celui qui le declenche, et il rend une fonction qui l'execute
   tout de suite, pour un nouveau geste qui arrive avant. */
function nettoyerApres(el, repli, apres) {
  let fait = false, minuteur = 0;
  const nettoyer = () => {
    if (fait) return;
    fait = true;
    el.removeEventListener('transitionend', surFin);
    clearTimeout(minuteur);
    el.style.transition = '';
    el.style.willChange = '';
    if (apres) apres();
  };
  const surFin = e => { if (e.target === el && e.propertyName === 'transform') nettoyer(); };
  el.addEventListener('transitionend', surFin);
  minuteur = setTimeout(nettoyer, repli);
  return nettoyer;
}

/* On gele le fond AVANT de montrer la fenetre, jamais apres.

   L'ordre etait inverse : la fenetre apparaissait, son animation demarrait, puis
   `gelerFond()` posait `position: fixed` et une hauteur calculee sur le corps.
   Or ça invalide la mise en page du document entier — trois mille pixels de
   cartes et de graphiques — au moment precis de la premiere image. L'animation
   partait donc avec une trame de retard, et sur un telephone ce retard se voit.

   Geler d'abord coute exactement la meme chose, mais avant que quoi que ce soit
   ne bouge a l'ecran : le recalcul se fait pendant que la page est encore
   immobile, et l'animation demarre sur une mise en page stable. */
function montrerModal(m) {
  generationSuivante(m);
  const panneau = m.querySelector('.modal-panel');
  if (panneau) for (const p of ['transition', 'transform', 'opacity', 'willChange']) panneau.style[p] = '';
  const dejaGelee = m.dataset.gele === '1';
  if (!dejaGelee) {
    m.dataset.gele = '1';
    gelerFond();
    void document.body.offsetHeight;
  }
  m.classList.remove('modal-ferme');
  m.hidden = false;
}
/* Combien de temps la fenetre met a partir, lu sur la feuille de style.

   Ce delai valait 170 en dur, la meme valeur que l'animation de sortie ecrite
   a deux endroits du CSS. Ralentir l'animation sans toucher a ce nombre aurait
   masque la fenetre au milieu de son mouvement : elle aurait disparu d'un coup
   apres un debut de glissement, ce qui est pire que pas d'animation du tout.

   La duree se declare donc une fois, en variable CSS, et le JavaScript la lit
   la ou elle est. `parseFloat` sur « .26s » rend 0,26 ; le repli couvre le cas
   d'une variable absente, sur un navigateur qui n'aurait pas encore la feuille.
   La marge de 30 ms laisse la derniere image se peindre. */
function dureeSortieModal() {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--duree-fenetre-sortie').trim();
  const s = parseFloat(v);
  return (Number.isFinite(s) && s > 0 ? s * 1000 : 260) + 30;
}
function fermerApercuSi(cle) {
  if (apercuOuvert !== cle) return;
  apercuOuvert = null;
  masquerModal($('#modal'));
}

function masquerModal(m) {
  if (m.dataset.gele === '1') { delete m.dataset.gele; degelerFond(); }
  const gen = generationSuivante(m);
  m.classList.add('modal-ferme');
  setTimeout(() => {
    if (gen !== generationModal.get(m)) return;   // cette fenetre a rouvert entre-temps
    m.classList.remove('modal-ferme');
    m.hidden = true;
  }, dureeSortieModal());
}

function setPath(path, value) {
  const parts = path.split('.');
  let o = Store.state;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] === undefined) o[parts[i]] = {};
    o = o[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (value === '' || value === null) delete o[last];
  else o[last] = value;
}
function getPath(path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), Store.state);
}

const VIEWS = {
  overview:   { cle: 'overview', render: () => (enEditionApercu() ? '' : barreSousOnglets('overview')) + (
    sousOngletActif.overview === 'historique' ? viewHistory()
    : sousOngletActif.overview === 'projection' ? viewObjective()
    : viewOverview()) },
  /* Budget porte trois sous-onglets, sur le meme motif que Marches et
     Allocation : une seule vue, qui choisit quoi rendre. Les routes
     `history` et `budget-cadre` sont des redirections, elles n'ont pas
     d'entree ici. Le titre suit l'onglet, sinon « Relevés mensuels »
     s'annoncerait « Budget ». */
  budget:     { cle: 'budget',      render: () => barreSousOnglets('budget') + (
    sousOngletActif.budget === 'cadre' ? viewBudgetCadre() : viewBudget()) },
  positions:  { cle: 'positions',   render: () =>
    (enEditionMarches() ? '' : barreSousOnglets('positions')) + (
      sousOngletActif.positions === 'cible' ? viewRebalance()
      : viewPositions()) },
  allocation: { cle: 'allocation',  render: () =>
    barreSousOnglets('allocation') + viewAllocation() },
  accounts:   { cle: 'accounts',    render: () => viewAccounts() },
  data:       { cle: 'data',        render: () => viewData() },
  settings:   { cle: 'settings',    render: () => viewSettings() },
  profil:     { cle: 'profil',      render: () => viewProfil() },
  /* La cle de vue est `accounts` : c'est elle qui donne a l'ecran son chevron
     de retour vers Actifs, exactement comme aux fiches. */
  'comptes-archives': { cle: 'accounts', render: () => viewComptesArchives() },
  ficheCompte:{ cle: 'accounts',    render: () => viewFicheCompte(routeParam()?.id) },
  ficheEtab:  { cle: 'accounts',    render: () => viewFicheEtab(routeParam()?.id) },
};

const REDIRECTIONS = {
  /* Projection est devenue un onglet de la vue d'ensemble. Son adresse reste
     `#/objective` : l'entree du menu la porte, elle est dans des signets, et
     c'est aussi la route de l'onglet. */
  notifications: ['settings', 'settings', null],
  objective:   ['overview', 'overview', 'projection'],
  rebalance:   ['positions', 'positions', 'cible'],
  /* `#/patrimoine` est la route de l'onglet, `#/allocation` l'adresse de base
     de la vue : les deux doivent mener au meme endroit, sinon un signet pose
     avant que Patrimoine ait sa propre adresse tomberait sur Objectifs sans
     explication. */
  patrimoine:  ['allocation', 'allocation', 'reel'],
  /* `#/performance` a survecu a sa page. Un signet dessus menait a une plus-value
     latente et a un journal de ventes ; le journal est desormais dans Positions,
     donc c'est la qu'on renvoie. Une adresse qui a existe ne doit pas rendre une
     page vide. */
  performance: ['positions',  'positions',  'portefeuille'],
  /* `settings` n'est plus une redirection : Preferences est une vue a part
     entiere, avec son entree de menu. Elle n'a plus rien a rediriger. */
  history:       ['overview', 'overview', 'historique'],
  'budget-cadre': ['budget', 'budget', 'cadre'],
};

/* Les symboles dont le cours vient de changer, le temps d'un rendu.

   Rempli par `refresh-quotes` a partir des `changes` que la passerelle renvoie
   deja, vide par `render()` juste apres. Le meme mecanisme que la cascade des
   reperes : l'intention vit dans le geste, la marque ne survit pas au rendu
   qu'elle decore. Sans ce vidage, chaque re-rendu ferait re-clignoter des
   cours qui n'ont pas bouge depuis dix minutes. */
let coursFraichis = new Set();

const viewTitle = k => t('view.' + k);
const viewSub   = k => t('view.' + k + '.sub');

/* --- sous-onglets -------------------------------------------------------
   Onze destinations dans la barre pour une application personnelle, dont
   trois paires qui parlaient du même sujet : « Allocation » et
   « Rééquilibrage » sont deux lectures du même argent — où il est, où il
   devrait être ; « Performance » ne parle que du portefeuille de titres, que
   « Marchés » porte déjà ; « Préférences » tenait en trois réglages et une
   carte qui renvoyait à « Données ».

   Elles deviennent des sous-onglets : le sujet garde une seule entrée dans la
   barre, et la seconde lecture est à un geste, sans quitter la page. Les
   anciennes adresses continuent de fonctionner et ouvrent le bon sous-onglet
   — un lien partagé ou un signet ne doit pas se casser sur un rangement.

   Chaque sous-onglet garde son adresse : basculer change le `#/`, donc le
   bouton retour du navigateur défait le geste, un rechargement retombe au
   même endroit, et un lien se partage. Un état d'affichage qui ne vit que
   dans une variable se perd au premier F5 — c'est ce qui distingue un
   sous-onglet d'un simple bouton. */
const SOUS_ONGLETS = {
  overview:   [['aujourdhui', 'Aujourd’hui', 'overview'],
               ['historique', 'Historique', 'history'],
               ['projection', 'Projection', 'objective']],
  positions:  [['portefeuille', 'Positions', 'positions'], ['cible', 'Cible', 'rebalance']],
  /* Allocation n'a plus qu'un onglet, et plus de barre : `barreSousOnglets`
     s'efface sous deux choix.

     Cible a rejoint Marches, et c'est son calcul qui l'y envoyait depuis le
     debut. `rebalanceRows()` part de `stockTotals()` : l'immobilier et le non
     cote sortent de sa base, comme toute classe qu'on met hors jeu. La page ne
     pilote que le portefeuille investissable, cash a investir compris.

     La paire « Patrimoine | Cible » avait donc l'air d'opposer le reel au vise
     alors qu'elle comparait deux perimetres differents : l'un montrait tout,
     l'autre les seuls titres. Deux bases sous une meme barre, ce que ce projet
     s'interdit ailleurs. Ce qui reste ici repond a une seule question — ou est
     l'argent — et une page a une question n'a pas besoin d'un selecteur.

     Le nom du menu ne bouge pas. « Allocation » nommait la paire, mais c'est
     aussi le mot que l'utilisateur emploie pour la chose elle-meme.

     « Cible » plutot que « Objectifs » : le mot « objectif » designe deja
     l'objectif mensuel de depenses et l'objectif de patrimoine a fin d'annee,
     et tout ce que la page contient s'appelle « cible » — la colonne, les
     menus, la base des pourcentages, jusqu'a sa route.

     Aucun onglet ne depend de l'adresse de base : `#/patrimoine`, `#/rebalance`
     et `#/positions` portent chacun la leur, donc l'ordre peut changer sans
     rendre un onglet inatteignable. Ce n'etait pas le cas avant. L'ancienne
     adresse de Cible reste servie par REDIRECTIONS, qui la mene desormais a
     Marches : un signet pose du temps d'Allocation continue d'ouvrir la bonne
     page. */
  allocation: [['reel', 'Allocation', 'patrimoine']],
  /* « Depenses » en premier : l'entree du menu s'appelle Budget, et c'est la
     qu'on arrive en la touchant. `currentView()` remet toujours l'adresse de
     base sur le premier onglet de cette liste, c'est donc l'ordre qui decide
     de l'atterrissage. La saisie devant, le reglage derriere — c'est deja ce
     que fait le menu de l'application, ou Donnees et Preferences sont en queue.

     « Charges fixes » et non « Charges » : dans la langue courante les deux
     mots disent la meme chose, de l'argent qui sort. C'est « fixes » qui porte
     l'opposition avec « Depenses », ce qui se repete contre ce qui varie.

     Cette barre en a porte trois, dont « Relevés ». La contrainte de largeur
     s'est donc relachee : a deux onglets ils font 168 px au lieu de 112, et
     « Charges fixes », mesure a 78 px de texte, y tient meme avec une pastille.
     L'invariant reste malgre tout — voir PASTILLE_SOUS_ONGLET — parce qu'il ne
     coute rien et qu'un troisieme onglet peut revenir. */
  budget:     [['depenses', 'Dépenses', 'budget'],
               ['cadre', 'Charges fixes', 'budget-cadre']],
};
/* L'onglet ouvert au depart, derive de la table et non recopie a cote.

   Cette ligne portait ses quatre valeurs en dur — dont `allocation: 'reel'`. En
   mettant Objectifs devant Patrimoine dans SOUS_ONGLETS, l'ordre affiche a bien
   change mais l'atterrissage est reste sur Patrimoine : deux listes ecrites a la
   main, et celle-ci disait le contraire de l'autre. C'est la faute que ce projet
   corrige sans arret, et elle vient de se rejouer sur trois lignes d'ecart.

   Desormais le premier onglet de chaque vue est, par construction, celui qui
   s'ouvre. Changer l'ordre suffit. */
const sousOngletActif = Object.fromEntries(
  Object.entries(SOUS_ONGLETS).map(([vue, onglets]) => [vue, onglets[0][0]]));

const PASTILLE_SOUS_ONGLET = {
  historique: () => currentMonthPending().missing,
  depenses: () => depensesEnAttente().missing,
};

/* Une barre de commutation qui n'est pas une navigation : elle ne change pas de
   page, elle change la façon de lire celle où l'on est. Même forme que les
   sous-onglets, parce que c'est le même geste et qu'un utilisateur n'a pas à
   apprendre deux fois le même bouton.

   Elle partage donc leur habillage — le lavis qui glisse, la couleur de la
   marque, le tassement d'appui — et n'en diffère que par l'action appelée.
   `aria-pressed` et non `aria-current` : ce sont des boutons d'état, pas des
   liens vers une autre page. */
function barreCommutateur(choix, actif, action, cle) {
  return `
  <div class="sous-onglets">
    <div class="segmented">
      ${choix.map(([v, label]) => `<button data-action="${esc(action)}"
        data-${esc(cle)}="${esc(v)}" class="${v === actif ? 'on' : ''}"
        aria-pressed="${v === actif}">${esc(trad(label))}</button>`).join('')}
    </div>
  </div>`;
}

/* Le choix d'un jeu d'hypotheses, et son habillage lui appartient.

   Les trois pilules d'un `.segmented` etaient exactement le dessin des onglets
   « Aujourd'hui | Historique | Projection » qui coiffent la meme page : deux
   controles identiques a l'oeil, l'un qui change d'ecran et l'autre qui change
   un calcul. Un pave borde ne se confond avec aucune navigation, et il a la
   place d'afficher ce qu'il suppose — c'est le taux qui distingue les trois
   choix, pas le mot.

   Le taux imprime est celui du scenario, une propriete de la table, jamais un
   reglage relu : ces trois valeurs ne dependent pas de l'etat. */
const TAUX_DESTINATION = {
  marche: s => s.rate,
  autres: s => s.rateAutres,
  garanti: s => s.rateGaranti,
  liquidites: () => 0,
};
/* Le repli sur le marche est celui de `repartitionVersement()` : une valeur qui
   ne nomme aucune poche verse sur les actifs de marche. */
const tauxDeDestination = s => (TAUX_DESTINATION[s.versementVers] || TAUX_DESTINATION.marche)(s);

function choixHypothese(actif) {
  /* La quatrieme case n'est pas un quatrieme scenario : elle n'a ni taux ni
     valeurs a elle, elle dit seulement que les hypotheses en vigueur ne sont
     plus exactement celles d'un preset. Elle s'allume donc toute seule, par
     `detecteScenario()`, et jamais par un enregistrement.

     Ce qui manquait sans elle : rien ne montrait qu'on peut sortir des trois
     paves. Le depliant existait, mais il faut le chercher, et personne ne
     cherche un reglage dont il ne sait pas qu'il existe.

     Aucun taux affiche dessous, et c'est voulu : un jeu personnalise peut
     changer plusieurs rendements a la fois, donc en montrer un seul designerait
     le mauvais. Les trois autres n'annoncent que celui du marche parce que c'est
     celui qui change le plus d'un scenario a l'autre -- le capital garanti varie
     aussi, de 2 a 3 %, et la ligne sous les paves le dit. */
  const cases = [
    ...SCENARIOS_PROJECTION.map(([cle, nom, taux]) =>
      [cle, nom, `${trad('marché')} ${fmtPct(taux.marche, 0)}`]),
    ['perso', 'Personnalisé', trad('tes hypothèses')],
  ];
  return `
    <div class="choix-hypothese" role="group">
      ${cases.map(([cle, nom, sous]) => `<button
        data-action="proj-scenario" data-scenario="${esc(cle)}"
        class="${cle === actif ? 'on' : ''}" aria-pressed="${cle === actif}">
        <b>${esc(trad(nom))}</b>
        <span>${sous}</span>
      </button>`).join('')}
    </div>`;
}

function barreSousOnglets(vue) {
  const choix = SOUS_ONGLETS[vue];
  if (!choix) return '';
  if (choix.length < 2) return '';
  const on = sousOngletActif[vue];
  return `
  <div class="sous-onglets">
    <div class="segmented">
      ${choix.map(([cle, label, route]) => `<button data-action="sous-onglet"
        data-route="${route}" class="${cle === on ? 'on' : ''}"
        aria-pressed="${cle === on}">${esc(trad(label))}${
          PASTILLE_SOUS_ONGLET[cle]?.() ? '<i class="pastille-onglet" aria-hidden="true"></i>' : ''
        }</button>`).join('')}
    </div>
  </div>`;
}

/* Le nom d'une poche est celui de sa classe, et il se derive.

   Sept poches declaraient leur libelle a la main, a cote de `CLASSES_ACTIFS`
   qui les nomme deja. Deux avaient divergé : la poche `pe` disait « Non coté »
   quand sa classe dit « Placements non cotés », et la poche `biens` disait
   « Biens de valeur » au pluriel quand sa classe le dit au singulier.

   En anglais, ça donnait le meme argent sous deux noms sur deux cartes du meme
   ecran : « Private assets » dans le tableau des classes, « Private
   investments » dans l'infobulle et sur l'accueil. Signale sur une capture de
   telephone, pas par un test — parce qu'aucun test ne peut voir qu'un mot juste
   et un autre mot juste designent la meme chose.

   Une liste se derive, elle ne se recopie pas. La table ci-dessous ne dit plus
   que le rattachement, et un controle exige qu'elle couvre chaque poche. */
const POCHE_CLASSE = {
  cash: 'liquidites', bourse: 'actions', crypto: 'crypto', pe: 'nonCote',
  immo: 'immobilier', biens: 'bienValeur', garanti: 'garanti',
};
const SERIES_PATRIMOINE = () => [
  { key: 'cash',   color: S1() },
  { key: 'bourse', color: S2() },
  { key: 'crypto', color: S5() },
  { key: 'pe',     color: S3() },
  { key: 'immo',   color: S4() },
  { key: 'biens',  color: Charts.cssv('--series-9') },
  { key: 'garanti', color: Charts.cssv('--series-8') },
].map(s => ({ ...s, label: trad(CLASSES_ACTIFS[POCHE_CLASSE[s.key]]) }));
/* Les bandes que la courbe trace vraiment, donc celles que la legende annonce.

   Deux filtres, et le premier est nouveau : le perimetre. Il se derive de
   `pochesEvolution()`, la meme fonction dont `pointsEvolution()` tire ses points
   -- une seconde liste de poches a ecarter aurait fini par annoncer en legende
   une bande absente du dessin, ou l'inverse.

   Le second n'a pas change : une poche qui ne porte rien sur la periode affichee
   n'ajouterait qu'une pastille de legende et une ligne « 0 EUR » dans la bulle.
   Les liquidites restent toujours, sinon un patrimoine tout juste ouvert n'aurait
   plus de graphique du tout. */
function seriesUtiles(points, { financier = false } = {}) {
  const gardees = pochesEvolution({ financier });
  return SERIES_PATRIMOINE()
    .filter(s => gardees.includes(s.key))
    .filter(s => s.key === 'cash'
      || points.some(p => Math.abs(Number(p[s.key]) || 0) > 0.005));
}
function legendeSeries(series, avecTotal = false) {
  return series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')
    + (avecTotal ? `<span><i style="background:var(--text-secondary)"></i>${trad('Total')}</span>` : '');
}

/* `pointsEvolution()` a quitte ce fichier pour `store.js`.

   Il y calculait la courbe -- imputation des dettes poche par poche, total
   derive des bandes -- et le harnais de tests ne charge pas `app.js` : le
   controle le plus important de cette fonction, « la pile fait son total »,
   etait donc une expression rationnelle sur la source, doublee d'un test qui
   REJOUAIT la regle sur ses propres donnees. Deux ecritures d'un seul calcul,
   dont l'une servait a verifier l'autre : la copie ne pouvait rien prouver.

   Le calcul est du modele, pas de la vue. Depuis `store.js` il se lit avec de
   vrais nombres, sur le meme fixture que le reste, et le perimetre Financier /
   Global y rejoint les autres regles d'exclusion, qui y vivaient deja.

   Ce qui reste ici : le dessin, les couleurs, et le choix de l'utilisateur. */

function basculesAffichees() {
  return basculesEvolution({ net: evoNet, financier: evoFinancier, range: evoRange });
}

function evolutionAffichee() {
  const points = limitRange(
    pointsEvolution({ net: evoNet, financier: evoFinancier }), evoRange);
  return { points, series: seriesUtiles(points, { financier: evoFinancier }) };
}

function carteEvolution() {
  const { series } = evolutionAffichee();
  const perimetreUtile = basculesAffichees().perimetre;
  return `
    <div class="card" data-anchor="evolution">
      <div class="card-head"><h2>${trad('Évolution du patrimoine')}${
        perimetreUtile ? aide(trad(AIDE_PERIMETRE)) : ''}</h2>${
        perimetreUtile ? `
        <span class="segmented seg-mini">
          <button data-action="evo-perimetre" data-perimetre="financier"
                  class="${evoFinancier ? 'on' : ''}" aria-pressed="${evoFinancier}"
                  title="${trad('Tes placements et tes liquidités, hors immobilier physique')}"
                  >${trad('Financier')}</button>
          <button data-action="evo-perimetre" data-perimetre="global"
                  class="${evoFinancier ? '' : 'on'}" aria-pressed="${!evoFinancier}"
                  title="${trad('Tout ton patrimoine')}">${trad('Global')}</button>
        </span>` : ''}</div>
      ${!aUnRelevePatrimonial() ? '' : `
      <div class="evo-commandes">${rangeControl('evo-range', evoRange)}</div>
      <div class="chart" id="chartEvo"></div>`}
      ${invitePremierPas('releves')}
      ${!aUnRelevePatrimonial() ? '' : `<div class="legend">${legendeSeries(series, true)}</div>`}
    </div>`;
}

/* Le depliant « Voir les donnees » sous la courbe est parti. Il rendait le
   tableau des points par annee : les memes nombres que la courbe trace juste
   au-dessus, sous une autre forme, derriere un pli que personne n'ouvrait. Le
   journal des releves donne deja mois par mois ce qu'il montrait, avec la porte
   pour corriger chaque ligne -- ce que le tableau n'avait pas.

   Sont partis avec lui : son selecteur d'annee (`evo-year`), les deux drapeaux
   de session qui portaient son annee et son ouverture, et son ecouteur de pli.
   Un depliant sans lecteur est du poids mort, et son etat en memoire vive
   l'etait deux fois. */
function monterEvolution() {
  const { points, series } = evolutionAffichee();
  const cible = $('#chartEvo');
  const anime = evoTransition;
  evoTransition = false;
  /* L'echelle verticale se recalcule toute seule sur les bandes passees :
     `Charts.stackedArea` somme `series` point par point pour son maximum et pour
     sa ligne Total. Retirer l'immobilier de la liste suffit donc a rendre l'axe
     aux placements, sans qu'un seul chiffre soit force ici. */
  /* `parts` : l'infobulle ajoute le poids de chaque poche dans le total de la
     date. Une option, et non le defaut du graphique empile, parce que la
     Projection emploie le meme dessin pour deux series qui ne composent pas un
     patrimoine — « Depart et versements » et « Rendement » — ou une part n'a pas
     le meme sens. */
  if (cible) Charts.stackedArea(cible, { points, height: 300, series, anime, parts: true });
}

/* --- CE QUI A CHANGE ENTRE DEUX RELEVES ------------------------------------

   La liste que la carte de l'accueil et la fiche du mois partagent : une seule
   ecriture, donc les deux ecrans disent le meme ecart avec les memes mots.

   UN ECART DE VALEUR, JAMAIS UN GAIN. Chaque ligne dit ce qu'une poche vaut de
   plus ou de moins qu'au releve d'avant. Elle ne dit pas pourquoi : un DCA,
   une hausse des cours et un virement entre deux comptes y font le meme
   mouvement, et `variationPatrimoine()` ne lit aucun flux.

   SEUL LE TOTAL EST COLORE. Une poche qui baisse n'est pas une erreur -- des
   liquidites qu'on vient d'investir baissent, et c'est voulu. Le vert et le
   rouge sur chaque ligne jugeraient des mouvements que l'application ne sait
   pas expliquer ; le signe suffit a dire le sens.

   LA DETTE SE LIT PAR SON EFFET SUR LE NET, et le dit. Un encours qui baisse
   fait monter le net d'autant : la ligne porte un montant positif, et la
   phrase dessous nomme l'encours pour que personne ne lise une dette qui monte.
   C'est ce qui fait que les lignes s'additionnent en total.

   Les lignes vont du plus gros ecart au plus petit : l'ordre dit deja ce qui a
   le plus bouge, et une phrase qui le redirait serait de trop. */
function listeVariation(v, { avecTotal = true } = {}) {
  const bougent = v.changesByPocket.filter(x => x.delta)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const stables = v.changesByPocket.filter(x => !x.delta).map(x => libellePoche(x.pocket));
  const ligneDette = v.debtChange ? `
      <dt>${trad('Crédits')}<span class="sub">${trad(v.debtChange < 0 ? 'encours en baisse de {v}' : 'encours en hausse de {v}')
        .replace('{v}', fmtEUR0(Math.abs(v.debtChange)))}</span></dt>
        <dd>${fmtSigned(-v.debtChange)}</dd>` : '';
  const ev = v.explicitEvents;
  const evTexte = ev.slice(0, 3)
    .map(e => `${e.genre === 'sortie' ? `${trad('Sortie de Longward')}${deuxPoints()} ` : ''}${esc(e.libelle || trad('Sans intitulé'))} ${fmtSigned(e.montant)} (${fmtDate(e.date)})`).join(', ')
    + (ev.length > 3 ? ` ${trad('et {n} autres').replace('{n}', ev.length - 3)}` : '');
  return `
    ${avecTotal ? `
    <dl class="kv kv-accumul">
      <dt class="cle"><b>${trad('Patrimoine net')}</b></dt>
        <dd class="cle"><b class="${cls(v.totalChange)}">${fmtSigned(v.totalChange)}</b></dd>
    </dl>
    <div class="kv-filet"></div>` : ''}
    ${bougent.length || ligneDette ? `
    <dl class="kv">
      ${bougent.map(x => `
      <dt>${esc(libellePoche(x.pocket))}<span class="sub">${fmtEUR0(x.previousValue)} → ${fmtEUR0(x.currentValue)}</span></dt>
        <dd>${fmtSigned(x.delta)}</dd>`).join('')}
      ${ligneDette}
    </dl>` : `<p class="small muted" style="margin:0">${trad('Aucune poche n’a bougé entre ces deux relevés.')}</p>`}
    ${stables.length && (bougent.length || ligneDette) ? `
    <p class="small muted" style="margin:8px 0 0">${trad('Inchangé')}${deuxPoints()} ${stables.map(esc).join(', ')}</p>` : ''}
    ${ev.length ? `
    <p class="hint" style="margin:8px 0 0">${trad('Ton journal porte sur cette période')}${deuxPoints()} ${evTexte}.
      ${trad('Ces montants sont déjà compris dans les écarts ci-dessus.')}</p>` : ''}`;
}

/* L'accueil n'en garde que la reponse courte : la variation nette et les deux
   ecarts qui la font surtout, credits compris. Le reste se compte et se lit
   dans le releve, ou `listeVariation()` donne toutes les poches, les poches
   inchangees et le journal de la periode. */
function carteVariation() {
  const v = derniereVariation();
  if (!v) return '';
  const ecarts = [
    ...v.changesByPocket.filter(x => x.delta).map(x => ({
      label: libellePoche(x.pocket), delta: x.delta,
      sous: `${fmtEUR0(x.previousValue)} → ${fmtEUR0(x.currentValue)}` })),
    ...(v.debtChange ? [{ label: trad('Crédits'), delta: -v.debtChange,
      sous: trad(v.debtChange < 0 ? 'encours en baisse de {v}' : 'encours en hausse de {v}')
        .replace('{v}', fmtEUR0(Math.abs(v.debtChange))) }] : []),
  ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const tete = ecarts.slice(0, 2);
  const autres = ecarts.length - tete.length;
  const ev = v.explicitEvents.length;
  return `
    <div class="card" data-anchor="variation">
      <div class="card-head"><h2>${trad('Ce qui a changé')}${aide(trad('Les écarts de valeur entre tes deux derniers relevés, poche par poche. Ce ne sont pas des rendements : un versement, une hausse des cours ou un virement entre deux comptes font bouger une poche de la même façon, et un relevé ne dit pas lequel a eu lieu.'))}</h2></div>
      <p class="hint" style="margin:0 0 12px">${trad('Entre tes relevés de {a} et de {b}')
        .replace('{a}', esc(fmtMonth(v.depuis))).replace('{b}', esc(fmtMonth(v.jusqua)))}${v.mois > 1
        ? ` · ${trad('écart sur {n} mois').replace('{n}', v.mois)}` : ''}</p>
      <dl class="kv kv-accumul">
        <dt class="cle"><b>${trad('Patrimoine net')}</b></dt>
          <dd class="cle"><b class="${cls(v.totalChange)}">${fmtSigned(v.totalChange)}</b></dd>
      </dl>
      ${tete.length ? `
      <div class="kv-filet"></div>
      <dl class="kv">
        ${tete.map(x => `
        <dt>${esc(x.label)}<span class="sub">${x.sous}</span></dt>
          <dd>${fmtSigned(x.delta)}</dd>`).join('')}
      </dl>` : `<p class="small muted" style="margin:8px 0 0">${trad('Aucune poche n’a bougé entre ces deux relevés.')}</p>`}
      ${autres || ev ? `<p class="small muted" style="margin:8px 0 0">${[
        autres ? (autres > 1 ? trad('{n} autres écarts') : trad('1 autre écart')).replace('{n}', autres) : '',
        ev ? (ev > 1 ? trad('{n} mouvements du journal compris') : trad('1 mouvement du journal compris')).replace('{n}', ev) : '',
      ].filter(Boolean).join(' · ')}</p>` : ''}
      <button type="button" class="lien-nu" style="margin-top:12px" data-action="voir-releve" data-i="${v.index}"
              >${trad('Voir le relevé de {m}').replace('{m}', esc(fmtMonth(v.jusqua)))}</button>
    </div>`;
}

/* Ce qu'on accumule en ce moment.

   La reponse n'a pas sa place dans Budget > Charges fixes : revenus, charges,
   depenses, capacite d'epargne, capital rembourse, accumulation, taux, plus la
   croissance constatee du patrimoine et son ecart au budget depassent de loin
   un onglet qui doit dire quelles sont les charges fixes.

   Ici la carte ne garde que la question qu'on se pose sur l'accueil, et le
   chiffre qui y repond est le total, pas ses parts. Les deux lignes au-dessus
   ne sont la que pour dire de quoi il est fait.

   Rien n'est recalcule : `savingsReconciliation()` est la seule source. Le
   detail -- revenus, charges, depenses moyennes -- reste dans Budget et dans le
   panneau `capaciteEpargne`, ou la premiere ligne mene. Une synthese qui refait
   le detail cesse d'etre une synthese.

   Elle ne suit pas Net / Brut : cette carte mesure un FLUX mensuel,
   `savingsReconciliation()` ne lit ni `patrimoine()` ni les dettes en stock,
   donc le commutateur du haut de page ne la traverse nulle part. Un test le
   tient. */
function carteAccumulation() {
  const rec = savingsReconciliation();
  /* La carte se lit comme une equation, et c'est tout son interet.

     Quatre chiffres seuls -- capacite, capital, accumulation, taux -- seraient
     trop peu : un resultat sans les trois lignes qui le fabriquent affiche un
     chiffre au lieu d'expliquer une mecanique, et cette carte existe pour dire
     comment les revenus deviennent du patrimoine. Les operateurs vivent dans
     les intitules pour que la colonne se lise de haut en bas comme une addition
     posee.

     L'objectif d'investissement n'y figure pas : il n'est pas une composante de
     l'accumulation, et il vit deja dans la barre Ou va ce que tu gagnes. La
     note de methode tient en une ligne.

     Rien n'est recalcule ici : `savingsReconciliation()` reste la seule source
     des sept montants. */
  /* Un montant dans une AIDE ne se formate pas comme a l'ecran : l'aide range
     son texte dans un attribut, ou le masque des montants s'imprimerait en
     clair, balise SVG comprise. `fmtEUR0Texte` y rend « ••• € ». */
  if (!(rec.income > 0) && !(rec.fixed > 0) && !(rec.spend > 0)) return `
  <div class="card" data-anchor="accumulation">
    <div class="card-head"><h2>${trad('Accumulation ce mois-ci')}</h2></div>
    ${invitePremierPas('revenus')}
  </div>`;
  const ligneRevenus = `<dt>${trad('Revenus fixes')}</dt><dd>${fmtEUR0(rec.income)}</dd>`;
  if (chargesInconnues()) return `
  <div class="card" data-anchor="accumulation">
    <div class="card-head"><h2>${trad('Accumulation ce mois-ci')}</h2>
      <span class="hint">${trad('Comment tes revenus se transforment en patrimoine')}</span></div>
    <dl class="kv kv-accumul">
      ${ligneRevenus}
    </dl>
    <p class="empty" style="margin:12px 0 0">${trad('Ta capacité d’épargne se calculera dès que tes charges fixes seront connues.')}</p>
    ${invitePremierPas('depenses', { secondaire: true })}
  </div>`;
  const aEcran = v => montantSigne(v);
  const enTexte = v => montantSigne(v, fmtEUR0Texte);
  /* Le troisieme terme porte le nom de la branche prise : `savingsReconciliation`
     retombe sur l'objectif de depenses quand aucune depense n'est saisie, et
     l'annoncer « observees » dirait une formule que le moteur n'a pas jouee. */
  const nomDepenses = rec.spendObserved
    ? trad('− Dépenses observées') : trad('− Objectif de dépenses');
  const sousDepenses = trad(rec.spendObserved
    ? 'moyenne de l’année' : 'aucune dépense saisie');
  const aideCapacite = trad(rec.spendObserved
      ? 'Revenus − charges fixes − dépenses observées.'
      : 'Revenus − charges fixes − objectif de dépenses.')
    + ` ${fmtEUR0Texte(rec.income)} − ${fmtEUR0Texte(rec.fixed)} − ${fmtEUR0Texte(rec.spend)}`
    + ` = ${enTexte(rec.investable)}`;
  const aideTotal = trad('Capacité d’épargne + capital remboursé.')
    + ` ${fmtEUR0Texte(rec.investable)} + ${fmtEUR0Texte(rec.capitalRembourse)}`
    + ` = ${enTexte(rec.theoretical)}`;
  const aideTaux = trad('Accumulation patrimoniale ÷ revenus.') + ' ' + (rec.income
    ? `${fmtEUR0Texte(rec.theoretical)} ÷ ${fmtEUR0Texte(rec.income)} = ${fmtPct(rec.theoreticalRate, 1)}`
    : trad('Aucun revenu déclaré pour l’instant.'));
  return `
  <div class="card" data-anchor="accumulation">
    <div class="card-head"><h2>${trad('Accumulation ce mois-ci')}</h2>
      <span class="hint">${trad('Comment tes revenus se transforment en patrimoine')}</span></div>
    <dl class="kv kv-accumul">
      <dt class="somme cle"><b>${trad('Accumulation patrimoniale')}</b>${aide(aideTotal)}</dt>
        <dd class="somme cle"><b class="${cls(rec.theoretical)}">${aEcran(rec.theoretical)}</b></dd>
      <dt>${trad('Capacité d’épargne')}${aide(aideCapacite)}</dt><dd>${aEcran(rec.investable)}</dd>
      <dt>${trad('Capital remboursé')}</dt><dd>${aEcran(rec.capitalRembourse)}</dd>
    </dl>
    <details class="data-view accumul-calcul">
      <summary>${trad('Voir le calcul')}</summary>
    <dl class="kv kv-accumul">
      ${ligneRevenus}
      <dt>${trad('− Charges fixes')}</dt><dd>${aEcran(-rec.fixed)}</dd>
      <dt>${esc(nomDepenses)}<span class="sub">${esc(sousDepenses)}</span></dt>
        <dd>${aEcran(-rec.spend)}</dd>
      <dt class="somme"><b>${trad('= Capacité d’épargne')}</b>${aide(aideCapacite)}</dt>
        <dd class="somme">${aEcran(rec.investable)}</dd>
      <dt>${trad('+ Capital remboursé')}${aide(trad('La part de tes mensualités qui rembourse le capital de tes crédits. Elle réduit ta dette, donc elle augmente ton patrimoine net.'))}</dt>
        <dd>${aEcran(rec.capitalRembourse)}</dd>
      <dt class="somme cle"><b>${trad('= Accumulation patrimoniale')}</b>${aide(aideTotal)}</dt>
        <dd class="somme cle"><b>${aEcran(rec.theoretical)}</b></dd>
      <dt class="sobre">${trad('Taux d’accumulation')}${aide(aideTaux)}</dt>
        <dd class="sobre">${rec.theoreticalRate == null
          ? `<span class="muted">${trad('aucun revenu déclaré')}</span>`
          : fmtPct(rec.theoreticalRate, 1)}</dd>
    </dl>
    </details>
    ${rec.realPerMonth == null ? '' : `
    <div class="kv-filet"></div>
    <dl class="kv kv-accumul">
      <dt>${trad('Croissance observée du patrimoine')}${aide(trad('Moyenne des variations de ton patrimoine net d’un mois sur l’autre, marchés et apports extérieurs compris. Elle porte toujours sur les douze derniers mois clos, là où la carte « Rythme d’accumulation » suit la période que tu y choisis.'))}</dt>
        <dd>${aEcran(rec.realPerMonth)} ${trad('/ mois')}</dd>
      <dt>${trad('Ce qui ne vient pas du budget')}${aide(trad('L’écart entre la croissance réellement observée de ton patrimoine et ce que ton budget et tes remboursements expliquent : les marchés, un apport extérieur, la valeur d’un bien qui bouge. Rien de tout cela ne passe par tes revenus et tes dépenses, donc rien de tout cela n’est une erreur de budget.'))}</dt>
        <dd class="${cls(rec.gap)}">${aEcran(rec.gap)}</dd>
    </dl>
    <p class="small muted" style="margin:12px 0 0">${trad('Croissance observée calculée sur les')}
      ${rec.monthsSpan} ${rec.monthsSpan > 1 ? trad('derniers mois clos') : trad('dernier mois clos')}</p>`}
  </div>`;
}

function carteAccumulationResume() {
  const rec = savingsReconciliation();
  if ((!(rec.income > 0) && !(rec.fixed > 0) && !(rec.spend > 0)) || chargesInconnues()) {
    return carteAccumulation();
  }
  return `
  <div class="card" data-anchor="accumulation">
    <div class="card-head"><h2>${trad('Accumulation ce mois-ci')}</h2>
      <button type="button" class="hint lien-vue" data-action="goto" data-view="budget"
              data-anchor="accumulation">${trad('Voir le calcul')} →</button></div>
    <div class="goal-top goal-top-empile">
      <b class="${cls(rec.theoretical)}">${montantSigne(rec.theoretical)} ${trad('/ mois')}</b>
      <span class="muted">${trad(rec.spendObserved
        ? 'selon ton budget, dépenses moyennes de l’année'
        : 'selon ton budget, objectif de dépenses faute de dépense saisie')}${rec.theoreticalRate == null ? ''
        : ` · ${fmtPct(rec.theoreticalRate, 1)} ${trad('de tes revenus')}`}</span>
    </div>
  </div>`;
}

/* La reserve de securite, reduite a ce qui se lit d'un coup d'oeil : le nombre
   de mois, la jauge et sa cible. Les paliers mobilisables, l'argent des projets
   et le cout de la vie retenu passent dans la fenetre `reserve`, a un geste.
   L'ancre garde son nom d'origine : elle ne s'affiche jamais, et la renommer
   casserait les renvois sans rien apprendre a personne.
   SANS COUT DE LA VIE, IL N'Y A PAS DE RESERVE A COMPTER, quel que soit le
   coussin : le rapport vaudrait zero faute de denominateur, et la carte
   annoncerait « 0,0 mois » en rouge a quelqu'un qui vient de declarer son cash.
   Elle dit ce qui lui manque, precisement. */
function carteReserveResume() {
  const r = runway();
  const ep = r.reserve;
  const cover = r.reserveMois;
  const state = cover >= 3 ? 'up' : cover >= 1.5 ? '' : 'down';
  return `
  <div class="card" data-anchor="autonomie">
    <div class="card-head"><h2>${trad('Réserve de sécurité')}${aide(trad("Combien de mois tu tiendrais si tes revenus s'arrêtaient demain. La jauge compte ton épargne de précaution ; la liste ajoute ce qui pourrait être mobilisé ensuite, du plus accessible au plus lent, en mois cumulés. L'immobilier et le non coté se vendent, mais en quelques mois et avec une décote si tu es pressé. Ce qui est bloqué jusqu'à son échéance reste affiché mais sort du cumul : cet argent n'arrivera pas, quoi qu'il se passe demain. Un titre coté se vend en séance, mais le virement met deux à trois jours ouvrés à arriver : c'est ce délai, pas la liquidité, qui le range en « quelques jours ». Casser un PEA de moins de cinq ans lui coûte son avantage fiscal, pas son accès. Coût mensuel retenu : charges fixes plus dépenses moyennes."))}</h2>
      ${r.burn ? `<button type="button" class="hint lien-vue" data-action="apercu" data-apercu="reserve"
              >${trad('Voir le détail')} →</button>` : `<span class="hint">${trad('si les revenus s\'arrêtaient')}</span>`}</div>
    ${!r.burn ? `
    <p class="empty" style="margin:0 0 4px">${trad(ep
      ? 'Ce chiffre compare ton argent disponible à ce que te coûte un mois. Il attend donc tes charges fixes.'
      : 'Ce chiffre compare ton argent disponible '
        + 'à ce que te coûte un mois. Il attend donc deux choses : un compte avec du '
        + 'cash, et tes charges fixes.')}</p>` : `
    <div class="goal-top goal-top-empile" style="margin-bottom:8px">
      <b class="${state}">${fmtMois(cover)} ${trad('mois')}</b>
      <span class="muted">${trad('si les revenus s\'arrêtaient')} · ${trad('épargne de précaution + cash disponible')} · ${fmtEUR0(ep)}</span>
    </div>
    <div class="goal-bar"><div class="goal-fill" style="width:${Math.min(100, cover / 6 * 100).toFixed(0)}%;
      background:${cover >= 3 ? 'var(--good)' : cover >= 1.5 ? 'var(--warning)' : 'var(--critical)'}"></div></div>
    <div class="goal-foot"><span></span><span>${trad('cible 3 à 6 mois')}</span></div>`}
  </div>`;
}

function sortiesRappel(genre, label, avant = '') {
  return `<span class="rappel-sorties">
    ${avant}
    <button type="button" class="btn sm ghost" data-action="reporter-rappel" data-genre="${esc(genre)}"
            title="${esc(trad('Repousse ce rappel de {n} jours').replace('{n}', REPORT_JOURS))}">${trad('Plus tard')}</button>
    <button type="button" class="btn icon xs" data-action="taire-rappel" data-genre="${esc(genre)}"
            aria-label="Ne plus demander ${esc(label)} ce mois-ci"
            title="${trad('Ne plus le demander ce mois-ci')}">✕</button>
  </span>`;
}

const MAX_A_RETENIR = 2;

/* --- OU MENE CET INSIGHT, ET POURQUOI CA SE DERIVE ------------------------

   La destination se DERIVE du renvoi, elle ne se recopie pas dans un troisieme
   champ. Une metadonnee ecrite a la main a cote du bouton finit par le
   contredire : on change l'ancre du renvoi, on oublie l'autre, et la selection
   croit separer deux entrees qui ouvrent desormais la meme carte. C'est la faute
   que ce depot corrige sans arret, et elle ne coute rien a eviter ici.

   VUE ET ANCRE, PAS LA VUE SEULE. Trois insights pointent vers `overview`, et
   ils y visent trois cartes qui repondent a trois questions differentes :
   « Autonomie financiere », « Evolution du patrimoine », « Accumulation ce
   mois-ci ». Les confondre sous la meme destination en ecarterait deux pour une
   ressemblance qui n'existe que dans l'URL.

   ET SURTOUT PAS LE LIBELLE. « Voir l'evolution » est du texte traduit : la
   selection changerait de comportement entre le francais et l'anglais. */
const destinationInsight = p => (p && p.cta) ? `${p.cta.vue}:${p.cta.ancre || ''}` : '';

/* L'algorithme des deux tours vit dans le moteur, ou il se teste : le harnais ne
   charge pas `app.js`, et une selection ecrite ici ne se verifierait que des
   yeux. Ce qui reste ici est ce que la vue seule sait — l'endroit ou chaque
   renvoi mene. */
const selectionARetenir = candidats =>
  selectionParClef(candidats, c => destinationInsight(c[1]), MAX_A_RETENIR);

const libellePoche = cle => trad(CLASSES_ACTIFS[POCHE_CLASSE[cle]] || cle);

const moisEtAnnee = (annee, mois) => new Intl.DateTimeFormat(locale(),
  { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(annee, mois - 1, 1)));

const EYEBROW_INSIGHT = {
  liquidity: 'Réserve',
  allocation: 'Structure',
  wealth_pace: 'Progression',
  goal: 'Objectif',
  debt: 'Dette',
  budget: 'Dépenses',
  concentration: 'Concentration',
  data_quality: 'À compléter',
};

const PRESENTATION_INSIGHT = {
  allocation_target_gap: {
    titre: p => trad(p.deltaPct >= 0 ? 'Ta part en {c} dépasse ta cible'
                                    : 'Ta part en {c} reste sous ta cible')
      .replace('{c}', trad(p.label)),
    valeur: p => fmtPct(p.currentPct, 1),
    phrase: () => trad('de tes investissements'),
    secondaire: p => trad(p.deltaPct >= 0
      ? 'soit {e} points au-dessus de ta cible de {b}'
      : 'soit {e} points en dessous de ta cible de {b}')
      /* Une decimale suffit : `fmtNombre` en rend deux, on arrondit avant
         plutot que d'ajouter un formateur de plus pour un seul appel. */
      .replace('{e}', fmtNombre(Math.round(Math.abs(p.deltaPct) * 10) / 10))
      .replace('{b}', fmtPct(p.targetPct, 1)),
    cta: { vue: 'rebalance', libelle: 'Voir ma cible' },
  },
  wealth_pace_shift: {
    titre: p => trad(p.currentMonthly >= p.previousMonthly
      ? 'Ton patrimoine avance plus vite qu’avant'
      : 'Ton patrimoine avance moins vite qu’avant'),
    valeur: p => montantSigne(p.currentMonthly, fmtEUR0) + trad('/mois'),
    phrase: p => trad('sur les {n} derniers mois').replace('{n}', p.currentMonths),
    secondaire: p => trad('contre {b} auparavant')
      .replace('{b}', montantSigne(p.previousMonthly, fmtEUR0) + trad('/mois')),
    cta: { vue: 'overview', ancre: 'evolution', libelle: 'Voir l’évolution' },
  },
  goal_projected_date: {
    titre: 'Quand tu atteindrais ta cible',
    valeur: p => moisEtAnnee(p.year, p.month),
    phrase: p => trad('pour atteindre ta cible de {t}').replace('{t}', fmtEUR0(p.target)),
    secondaire: () => trad('selon tes hypothèses actuelles'),
    cta: { vue: 'objective', ancre: 'trajectoire', libelle: 'Voir ma projection' },
  },
  liquidity_runway_shift: {
    titre: p => trad(p.deltaMonths >= 0
      ? 'Ta trésorerie couvre plus de mois qu’avant'
      : 'Ta trésorerie couvre moins de mois qu’avant'),
    valeur: p => fmtMois(p.months) + ' ' + trad('mois'),
    phrase: () => trad('de dépenses couvertes'),
    secondaire: p => trad('contre {b} il y a trois mois, à dépenses constantes')
      .replace('{b}', fmtMois(p.previousMonths) + ' ' + trad('mois')),
    cta: { vue: 'overview', ancre: 'evolution', libelle: 'Voir l’évolution' },
  },
  pocket_share_shift: {
    titre: p => trad(p.deltaPct >= 0 ? 'Ta part en {c} a augmenté'
                                    : 'Ta part en {c} a diminué')
      .replace('{c}', libellePoche(p.poche)),
    valeur: p => fmtPct(p.currentPct, 1),
    phrase: () => trad('de ton patrimoine aujourd’hui'),
    secondaire: p => trad('contre {b} il y a {m} mois')
      .replace('{b}', fmtPct(p.previousPct, 1)).replace('{m}', p.months),
    cta: { vue: 'overview', ancre: 'evolution', libelle: 'Voir l’évolution' },
  },
  wealth_growth_origin: {
    titre: p => trad(p.contributionsPct >= 50
      ? 'Ta progression vient surtout de tes versements'
      : 'Ta progression vient en partie de tes versements'),
    valeur: p => fmtPct(p.contributionsPct, 0),
    phrase: p => trad('de ta progression sur {m} mois vient de tes versements')
      .replace('{m}', p.months),
    secondaire: () => trad('le reste mêle valorisation, capital remboursé et réévaluation'),
    cta: { vue: 'overview', ancre: 'evolution', libelle: 'Voir l’évolution' },
  },
  goal_date_shift: {
    titre: 'Ta cible a bougé',
    valeur: p => moisEtAnnee(p.year, p.month),
    phrase: p => trad('pour atteindre ta cible de {t}').replace('{t}', fmtEUR0(p.target)),
    secondaire: p => trad(p.monthsEarlier >= 0
      ? 'soit {n} mois plus tôt qu’à la dernière lecture'
      : 'soit {n} mois plus tard qu’à la dernière lecture')
      .replace('{n}', fmtMois(Math.abs(p.monthsEarlier))),
    cta: { vue: 'objective', ancre: 'trajectoire', libelle: 'Voir ma projection' },
  },
  debt_soon_free: {
    titre: 'Mensualité bientôt libérée',
    valeur: p => fmtEUR0(p.monthly) + trad('/mois'),
    phrase: p => trad('se libèrent dans {n} mois').replace('{n}', p.months),
    secondaire: () => trad('à la dernière échéance de ce crédit'),
    cta: { vue: 'accounts', libelle: 'Voir mes crédits' },
  },
  debt_balance_shift: {
    titre: p => trad(p.delta < 0 ? 'Ton encours de crédit a baissé'
                                 : 'Ton encours de crédit a augmenté'),
    valeur: p => fmtEUR0(Math.abs(p.delta)),
    phrase: p => trad('de relevé à relevé, en {m} mois').replace('{m}', p.months),
    secondaire: p => trad('{a} restant dû, contre {b}')
      .replace('{a}', fmtEUR0(p.current)).replace('{b}', fmtEUR0(p.previous)),
    cta: { vue: 'accounts', libelle: 'Voir mes crédits' },
  },
  spending_shift: {
    titre: p => trad(p.delta > 0 ? 'Tes dépenses ont monté'
                                : 'Tes dépenses ont baissé'),
    valeur: p => fmtEUR0(p.current) + trad('/mois'),
    phrase: p => trad('sur les {n} derniers mois clos').replace('{n}', p.months),
    secondaire: p => trad('contre {b} auparavant')
      .replace('{b}', fmtEUR0(p.previous) + trad('/mois')),
    cta: { vue: 'budget', ancre: 'detail-mensuel', libelle: 'Voir le détail mensuel' },
  },
  spending_category_shift: {
    titre: p => trad(p.delta > 0 ? 'Tes dépenses {c} augmentent'
                                 : 'Tes dépenses {c} reculent')
      .replace('{c}', guill(p.category)),
    valeur: p => fmtEUR0(p.current) + trad('/mois'),
    phrase: p => trad('sur les {n} derniers mois clos').replace('{n}', p.months),
    secondaire: p => p.deltaPct == null
      ? trad('un poste qui n’apparaissait pas auparavant')
      : trad('contre {b} auparavant, soit {p}')
        .replace('{b}', fmtEUR0(p.previous) + trad('/mois'))
        .replace('{p}', fmtSignedPct(p.deltaPct, 0)),
    cta: { vue: 'budget', ancre: 'detail-mensuel', libelle: 'Voir le détail mensuel' },
  },
  spending_target_pace: {
    titre: 'À ce rythme, ton objectif est dépassé',
    valeur: p => fmtEUR0(p.projected),
    phrase: p => trad('projetés sur le mois, au rythme des {n} premiers jours')
      .replace('{n}', p.daysIn),
    secondaire: p => trad('soit {o} au-dessus de ton objectif de {t}')
      .replace('{o}', fmtEUR0(p.over)).replace('{t}', fmtEUR0(p.target)),
    cta: { vue: 'budget', ancre: 'mois-courant', libelle: 'Voir le mois en cours' },
  },
  budget_history_thin: {
    titre: 'Pas encore de quoi comparer',
    valeur: p => p.months + ' ' + trad(p.months > 1 ? 'mois saisis' : 'mois saisi'),
    phrase: p => trad('il en faut {n} pour comparer un trimestre au précédent')
      .replace('{n}', p.needed),
    secondaire: () => trad('d’ici là, les écarts affichés seraient du bruit'),
    cta: { vue: 'budget', ancre: 'detail-mensuel', libelle: 'Voir le détail mensuel' },
  },
  spending_month_anomaly: {
    titre: 'Un mois à part',
    valeur: p => fmtEUR0(p.total),
    phrase: p => trad('en {d}')
      .replace('{d}', esc(fmtMoisAn(p.month.slice(0, 7) + '-15'))),
    secondaire: p => {
      const base = trad('contre {b} pour un mois ordinaire chez toi')
        .replace('{b}', fmtEUR0(p.usual));
      if (!p.drivers || !p.drivers.length) return base;
      return base + trad(', surtout') + ' ' + p.drivers.map(c => esc(c)).join(trad(' et '));
    },
    cta: { vue: 'budget', ancre: 'detail-mensuel', libelle: 'Voir le détail mensuel' },
  },
  concentration_top_line: {
    titre: 'Une ligne concentre tes actifs',
    valeur: p => fmtPct(p.pct, 1),
    phrase: () => trad('de tes actifs financiers'),
    secondaire: p => trad('{c}, autant que les deux lignes suivantes réunies')
      .replace('{c}', esc(trad(p.label))),
    cta: { vue: 'positions', ancre: 'titres', libelle: 'Voir mes lignes' },
  },
};

let dernierARetenir = [];

function noterInsightsVus() {
  if (!dernierARetenir.length) return;
  const jour = todayISO();
  const memoire = Store.state.meta.insightsVus || {};
  let change = false;
  for (const i of dernierARetenir) {
    const vu = memoire[i.id];
    if (vu && vu.date === jour && num(vu.valeur) === num(i.valeur)) continue;
    memoire[i.id] = { date: jour, valeur: num(i.valeur) };
    change = true;
  }
  if (!change) return;
  Store.state.meta.insightsVus = memoire;
  Store.save();
}

/* --- Repliee, masquee : deux etats, et ils se souviennent ------------------

   Trois lectures et leurs renvois occupent presque un ecran de telephone, et
   repoussent les cartes qui suivent. La section se replie donc, et peut se
   retirer tout a fait.

   LE CHOIX VIT DANS `meta`, PAS EN MEMOIRE VIVE. Les autres replis de ce
   fichier sont des drapeaux de session : un depliant qu'on vient d'ouvrir ne
   doit pas se refermer au rendu suivant, mais un rechargement le remet a sa
   place. Celui-ci est l'inverse — c'est une preference, pas une position de
   lecture. Range dans `meta`, il suit l'etat partout ou il va : le stockage
   local, la sauvegarde en ligne, l'export. Rouvrir la section a chaque
   lancement reviendrait a ne pas avoir ecoute.

   PAS DE CROIX. Une croix dit « notification » et promet la disparition d'un
   objet passager ; cette section est une piece du tableau de bord. Le geste
   ordinaire est donc « Réduire », et le retrait complet vit un cran plus loin,
   derriere les trois points, avec sa porte de retour dans les Preferences. */
const retenirReplie = () => !!Store.state?.meta?.retenirReplie;
const retenirMasquee = () => !!Store.state?.meta?.retenirMasquee;

function carteARetenir() {
  if (retenirMasquee()) return '';
  const lus = selectionARetenir(insightsDeLOnglet('overview', {})
    .map(i => [i, PRESENTATION_INSIGHT[i.id]])
    .filter(([, p]) => !!p));
  const vide = !lus.length;
  const n = lus.length;
  const replie = retenirReplie();
  dernierARetenir = replie ? [] : lus.map(([i]) => i);
  /* Le meme bouton dans les deux etats, donc le meme `aria-controls` et le meme
     `aria-expanded` : un lecteur d'ecran annonce l'etat, pas une couleur. */
  const options = `<button type="button" class="retenir-plus" data-action="retenir-options"
        aria-label="${esc(trad('Options de la section'))}" title="${esc(trad('Options de la section'))}"
        >···</button>`;
  const chevron = `<span class="retenir-pastille" aria-hidden="true"
        ><svg class="retenir-chevron" viewBox="0 0 24 24" aria-hidden="true"
        focusable="false"><path d="M6 9.5 12 15.5 18 9.5"/></svg></span>`;
  return `
  <section class="card retenir${replie ? ' repliee' : ''}" aria-labelledby="retenirTitre">
    ${replie ? `
    <div class="card-head retenir-tete">
      <h2 id="retenirTitre" class="retenir-tete-pliee">
        <button type="button" class="retenir-bascule" data-action="retenir-plier"
                aria-expanded="false" aria-controls="retenirCorps">
          <span>${trad('À retenir')}</span>
          ${!n ? '' : `<span class="retenir-compte">· ${n === 1 ? trad('1 insight')
            : trad('{n} insights').replace('{n}', n)}</span>`}
          ${chevron}
        </button>
      </h2>
      ${options}
    </div>` : `
    <div class="card-head retenir-tete">
      <h2 id="retenirTitre">${trad('À retenir')}</h2>
      <div class="retenir-actes">
        <button type="button" class="retenir-bascule retenir-reduire" data-action="retenir-plier"
                aria-expanded="true" aria-controls="retenirCorps">
          <span>${trad('Réduire')}</span>
          ${chevron}
        </button>
        ${options}
      </div>
    </div>`}
    <div class="retenir-pli" ${replie ? 'aria-hidden="true"' : ''}>
    <ul class="retenir-liste" id="retenirCorps">
      ${!vide ? '' : `
      <li class="retenir-item retenir-calme">
        <b class="retenir-titre">${esc(trad('Rien d’inhabituel à signaler'))}</b>
        <p class="retenir-texte">${esc(trad('Ton patrimoine reste proche de ses tendances récentes.'))}</p>
      </li>`}
      ${lus.map(([i, p], k) => ligneInsight(i, p,
          k ? EYEBROW_INSIGHT[lus[k - 1][0].categorie] : null,
          lus.slice(0, k).map(([, q]) => destinationInsight(q)))).join('')}
    </ul>
    </div>
  </section>`;
}

function carteInsights(vue, titre) {
  const lus = selectionARetenir(insightsDeLOnglet(vue, {})
    .map(i => [i, PRESENTATION_INSIGHT[i.id]])
    .filter(([, p]) => !!p));
  if (!lus.length) return '';
  dernierARetenir = lus.map(([i]) => i);
  return `
  <section class="card retenir" aria-labelledby="insightsTitre-${esc(vue)}">
    <div class="card-head">
      <h2 id="insightsTitre-${esc(vue)}">${trad(titre)}</h2>
    </div>
    <ul class="retenir-liste">
      ${lus.map(([i, p], k) => ligneInsight(i, p,
        k ? EYEBROW_INSIGHT[lus[k - 1][0].categorie] : null,
        lus.slice(0, k).map(([, q]) => destinationInsight(q)))).join('')}
    </ul>
  </section>`;
}

partieChargee('assets/app-01-socle.js');
