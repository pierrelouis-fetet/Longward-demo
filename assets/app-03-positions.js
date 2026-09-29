/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
const POINTEUR_TACTILE = matchMedia('(pointer: coarse)').matches;
function focusChamp(el) {
  if (!el || POINTEUR_TACTILE) return;
  el.focus();
  el.select?.();
}

const OPTIONS_CLASSE = Object.entries(ASSET_CLASSES);
const OPTIONS_ROLE = Object.entries(ROLES);

/* `poidsLigne` a vecu ici : elle divisait par la somme des titres cotes seuls,
   quand les quatre autres surfaces divisaient par le portefeuille Marches
   entier. Une meme ligne valait donc 66,8 % dans le tableau du jour et 53,89 %
   sur sa fiche. `poidsPortefeuille()`, dans store.js, porte la seule
   definition ; la ligne recue porte deja sa valeur, calculee par
   dayPerformance, donc rien ne se cherche par nom. */

const classeDuType = t => {
  const s = String(t || '').toLowerCase();
  if (/crypto/.test(s)) return 'crypto';
  if (/bond|obligation/.test(s)) return 'obligations';
  if (/currency|devise/.test(s)) return 'monetaire';
  return 'actions';
};

const comptesPourListe = cat => comptesPourCategorie(cat)
  .map(c => [c.id, sousNom('', nomCompteV2(c), nomEtabDe(c))]);
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'CAD', 'JPY'];

const EXCHANGES = [
  [trad('Par défaut'), [
    ['auto', trad('Automatique')],
  ]],
  [trad('Europe'), [
    ['.PA', 'Euronext Paris'], ['.AS', 'Amsterdam'], ['.BR', trad('Bruxelles')], ['.LS', trad('Lisbonne')],
    ['.DE', 'Xetra'], ['.F', trad('Francfort')], ['.MU', 'Munich'], ['.SG', 'Stuttgart'], ['.BE', 'Berlin'],
    ['.MI', 'Milan'], ['.MC', 'Madrid'], ['.SW', trad('SIX Suisse')], ['.VI', trad('Vienne')],
    ['.L', trad('Londres (LSE)')], ['.IL', trad('Londres (cotations en devises)')], ['.IR', 'Dublin'],
    ['.ST', 'Stockholm'], ['.OL', 'Oslo'], ['.CO', trad('Copenhague')], ['.HE', 'Helsinki'],
    ['.WA', trad('Varsovie')], ['.PR', 'Prague'], ['.AT', trad('Athènes')], ['.IS', 'Istanbul'],
  ]],
  [trad('Amériques'), [
    ['', trad('États-Unis (NYSE / Nasdaq)')], ['.TO', 'Toronto'], ['.V', 'TSX Venture'],
    ['.NE', 'Cboe Canada'], ['.MX', 'Mexico'], ['.SA', 'São Paulo'],
  ]],
  [trad('Asie · Pacifique'), [
    ['.T', 'Tokyo'], ['.HK', 'Hong Kong'], ['.SS', 'Shanghai'], ['.SZ', 'Shenzhen'],
    ['.KS', trad('Séoul (KOSPI)')], ['.TW', trad('Taïwan')], ['.NS', trad('Inde (NSE)')], ['.BO', trad('Inde (BSE)')],
    ['.SI', trad('Singapour')], ['.AX', trad('Australie')], ['.NZ', trad('Nouvelle-Zélande')],
  ]],
  [trad('Afrique · Moyen-Orient'), [
    ['.JO', 'Johannesburg'], ['.TA', 'Tel Aviv'],
  ]],
];

const CURRENCY_SIGNS = { EUR: '€', USD: '$', GBP: '£', CHF: 'Fr', SEK: 'kr', CAD: 'C$', JPY: '¥' };
const currencySign = c => CURRENCY_SIGNS[c] || c || '€';

/* `prixCell` vivait ici : une cellule de prix avec sa conversion en euros en
   dessous, pour le PRU et le cours du tableau des lignes. Ces deux colonnes sont
   parties avec les neuf autres que la fiche portait deja, et la fonction n'avait
   plus d'appelant. */

let evoRange = '1y';
/* Net ou brut : une seule notion, un seul réglage, et désormais un seul
   commutateur.

   Le grand chiffre et la courbe ont d'abord eu chacun le leur, et deux états :
   on pouvait afficher le titre en brut au-dessus d'une courbe tracée en net, sur
   le même écran, sans que rien ne le signale. Ils ont ensuite commandé la même
   variable, ce qui réglait le mensonge sans régler la question posée — deux
   boutons identiques à deux endroits laissent croire qu'ils font deux choses.

   Il n'en reste qu'un, dans la grande carte, et il gouverne toute la page. La
   place libérée sous le graphique porte le seul réglage qui lui appartienne en
   propre : le périmètre, `evoFinancier` juste dessous. Deux questions, deux
   commandes, chacune à un seul endroit. */
let evoNet = true;    // valorisation de toute la page Aujourd'hui
/* Le perimetre de la seule courbe d'evolution, et rien d'autre sur la page.

   Financier par defaut, et c'est le point de tout le reglage : l'immobilier
   physique pese 60 a 80 % d'un patrimoine ordinaire, sa bande ecrase l'echelle,
   et les mouvements de placements -- la seule chose qu'on pilote vraiment --
   deviennent un trait plat. La vue globale reste a un clic pour qui veut le
   patrimoine entier dans le temps.

   Il ne s'enregistre pas, comme le commutateur d'Allocation : un reglage de
   lecture vit le temps d'une session. La difference avec lui est le defaut, et
   elle est assumee dans les deux sens -- Allocation compte tout par defaut parce
   que quelqu'un qui a oublie son reglage y lirait un patrimoine amoindri, alors
   qu'ici le grand chiffre juste au-dessus continue d'annoncer le patrimoine
   complet : la courbe ne peut donc tromper personne sur ce qu'il possede.

   Independant de `evoNet`, qui dit comment on valorise et non ce qu'on regarde.
   Les quatre combinaisons ont un sens, et le net financier vaut le brut financier
   tant qu'aucune dette ne declare l'actif qu'elle finance : voir
   `pointsEvolution()`. */
let evoFinancier = true;
/* Une transition a montrer au prochain montage de la courbe, et une seule.

   `render()` remonte le graphique a chaque frappe, a chaque changement de plage
   et a chaque retour sur la vue : animer a chaque montage rejouerait une demi
   seconde de mouvement pour un rafraichissement que personne n'a demande. C'est
   la regle deja posee pour le balayage d'arrivee, qui ne joue que sous
   `.vue-entre`. Le drapeau se leve sur le seul geste qui change le cadrage, et
   le montage de la courbe le consomme. */
let evoTransition = false;
let paceRange = '1y';        // rythme d'accumulation
let journalOuvert = false;
/* La ligne « Revenus » de la carte « Ou va ce que tu gagnes » ouvre ses sources.
   L'etat vit ici, comme les autres replis de vue : un `details` natif se
   refermerait a chaque rendu, et le rendu suit chaque frappe dans un champ. */
let revenusOuvert = false;
const rafraichirRevenus = () => { if (revenusOuvert) fenetreRevenus(); };
/* La periode commune des ventes et des achats, sur Marches : une annee, ou
   'all'. Rien de choisi vaut null, et c'est `periodeTransactions()` qui dit la
   periode effective : un choix devenu invalide -- la derniere operation de
   l'annee supprimee -- se lit au defaut sans etre efface, et revient s'il
   redevient valide pendant la visite. */
let salesRange = null;
function periodeTransactions() {
  const r = salesRange;
  if (r === 'all') return 'all';
  if (r != null && estAnnee(r) && anneesDesTransactions().map(String).includes(String(r))) return String(r);
  return anneeParDefautTransactions();
}
/* « Toutes les annees » pour 'all' : sur cette barre, on choisit des annees.
   `rangeLabel` garde son « Tout » pour les autres plages. */
const libellePeriodeTransactions = p => (p === 'all' ? trad('Toutes les années') : String(p));
/* L'annee du journal des ventes, distincte de la plage glissante ci-dessus.

   Une annee et non une duree glissante, parce que ce journal se consulte comme
   un releve : ce qu'on a vendu en une annee civile a une reponse qu'on retient,
   ce qu'on a vendu ces douze derniers mois n'en a pas. C'est le choix deja fait
   pour le journal des apports, qui vit dans Releves.

   `null` = l'annee courante, decidee au rendu : la figer ici la rendrait fausse
   au 1er janvier. */
/* `salesYear` est parti : le journal se borne comme les graphiques, par
   `salesRange`, qui accepte desormais une annee civile autant qu'une duree. */

let triVentes = 'date';

/* Le depliant du journal se souvient. Un `<details>` est recree a chaque rendu,
   et cette page se rend a chaque arrivee de cours : sans memoire, il se refermait
   sous les yeux de qui venait de l'ouvrir. REPLIE PAR DEFAUT : un journal ne se
   consulte pas a chaque visite, et son resume dit deja le nombre de ventes et
   leur resultat. La memoire ne dure que la visite. */
let journalDeroule = false;
/* LE TRI DES LIGNES EST UNE PREFERENCE, PAS UN DRAPEAU DE SESSION. Il vivait
   dans une variable de module : changer d'onglet le gardait, recharger la page
   le perdait, et on retrouvait l'ordre de saisie sans avoir rien demande. Range
   dans `meta`, il suit l'etat partout ou il va, synchronisation comprise.

   ET SON DEFAUT EST LA VALEUR DECROISSANTE. L'ordre de saisie ne repond a
   aucune question ; « qu'est-ce qui pese le plus » est la premiere qu'on se
   pose devant une liste de positions. */
const TRI_POSITIONS_DEFAUT = { key: 'value', dir: 'desc' };
const TRI_POSITIONS_CHOIX = [
  ['value',   'Valeur'],
  ['perfEur', 'Plus-value €'],
  ['perfPct', 'Plus-value %'],
  ['name',    'Nom'],
];
function triPositions() {
  const t = Store.state?.meta?.triPositions;
  return t && POS_SORT_KEYS[t.key] && (t.dir === 'asc' || t.dir === 'desc')
    ? t : TRI_POSITIONS_DEFAUT;
}
function poserTriPositions(key, dir) {
  Store.state.meta.triPositions = { key, dir };
  Store.save();
}
let posRole = 'tous';
let posCompte = 'tous';

const passeFiltresLignes = p => passeFiltresTitres(p, posRole, posCompte);

function filtresLignes() {
  const ids = [...new Set(Store.state.positions.map(p => p.account))];
  return `
        <div class="segmented seg-mini" role="group" aria-label="${trad('Filtrer par rôle')}">
          ${[['tous', trad('Tous')], ['core', 'Core'], ['satellite', 'Satellite']].map(([v, l]) =>
            `<button type="button" data-action="filtrer-role" data-role="${v}"
                     class="${posRole === v ? 'on' : ''}" aria-pressed="${posRole === v}">${l}</button>`).join('')}
        </div>
        ${ids.length < 2 ? '' : `<select data-action-change="filtrer-compte-titres" class="annee"
                          title="${trad('Ne montrer que les lignes d’un compte')}">
            <option value="tous" ${posCompte === 'tous' ? 'selected' : ''}>${trad('Tous les comptes')}</option>
            ${ids.map(id => `<option value="${esc(id)}" ${posCompte === id ? 'selected' : ''}>${
              esc(ACC[id]?.label || id)}</option>`).join('')}
          </select>`}`;
}

const compteLignes = (montrees, total) => `${montrees} ${montrees > 1 ? trad('lignes') : trad('ligne')}${
  total > montrees ? ` · ${total - montrees} ${total - montrees > 1 ? trad('masquées') : trad('masquée')}` : ''}`;

function notePiedTitres(t) {
  if (!t.sansBase) return '';
  const phrase = !t.avecBase
    ? trad(t.count > 1 ? 'Aucune de ces lignes n’a de prix de revient : pas de perf à calculer.'
                       : 'Cette ligne n’a pas de prix de revient : pas de perf à calculer.')
    : trad(t.sansBase > 1 ? 'La perf ne compte pas {n} lignes sans prix de revient, qui valent {v}.'
                          : 'La perf ne compte pas {n} ligne sans prix de revient, qui vaut {v}.')
        .replace('{n}', t.sansBase).replace('{v}', fmtEUR(t.valeurSansBase));
  return `<tr class="pied-note"><td colspan="9">${phrase}</td></tr>`;
}
const POS_SORT_KEYS = {
  name:     p => p.name?.toLowerCase() || '',
  value:    p => posValue(p),
  invested: p => posInvested(p),
  perfEur:  p => posPerfEur(p),
  perfPct:  p => posPerfPct(p),
  qty:      p => num(p.qty),
  pru:      p => num(p.avgPrice),
  cours:    p => num(p.price),
  poids:    p => posValue(p),
  assetClass: p => ASSET_CLASSES[assetClassDe(p)],
  role:       p => ROLES[roleDe(p)],
  account:  p => ACC[p.account]?.label || '',
};

function sortPositions(entries) {
  const tri = triPositions();
  const get = POS_SORT_KEYS[tri.key];
  if (!get) return entries;
  const dir = tri.dir === 'asc' ? 1 : -1;
  const nom = p => p.name?.toLowerCase() || '';
  return [...entries].sort((a, b) => {
    const va = get(a.p), vb = get(b.p);
    /* UNE DONNEE ABSENTE PASSE DERNIERE, DANS LES DEUX SENS. `posPerfEur()` et
       `posPerfPct()` rendent null quand la ligne n'a pas de prix de revient, et
       c'est voulu : une plus-value sans base n'existe pas. Mais `null - 5` vaut
       -5, donc le tri les rangeait comme des zeros — au milieu des pertes en
       decroissant, en tete en croissant. Une ligne sans mesure n'est ni la
       meilleure ni la pire, elle est hors classement. */
    const aVide = va == null, bVide = vb == null;
    if (aVide || bVide) return aVide && bVide ? nom(a.p).localeCompare(nom(b.p), 'fr')
                                              : (aVide ? 1 : -1);
    if (typeof va === 'string') {
      const c = va.localeCompare(vb, 'fr') * dir;
      return c || nom(a.p).localeCompare(nom(b.p), 'fr');
    }
    return (va - vb) * dir || nom(a.p).localeCompare(nom(b.p), 'fr');
  });
}

/* --- listes de telephone ------------------------------------------------
   Un tableau de plus de trois colonnes est un piege a defilement sur un
   ecran de 375 px : dans « Lignes de titres », on voyait Nom, ISIN et
   Symbole, pendant que la valeur, la performance et le poids restaient hors
   champ. Or la fenetre de detail existe deja pour chacun de ces tableaux :
   le tableau ne faisait que dupliquer ce qu'un clic ouvre en entier.

   La liste montre donc les deux ou trois chiffres qu'on vient chercher, et
   toute la ligne s'ouvre — la ligne entiere plutot qu'un bouton « details » :
   la cible est vingt fois plus grande au pouce.

   Les deux rendus coexistent, le CSS montre l'un ou l'autre selon la largeur.
   La liste ne porte aucun champ de saisie : deux elements partageant le meme
   `data-path` embrouilleraient le re-rendu qui suit une modification. */
/* `ancre` et `classe` : la liste doit pouvoir porter les memes reperes que la
   ligne de tableau qu'elle remplace — l'ancre visee par « Aller a la ligne »,
   et le fond du mois en cours. */
/* `barre` a vecu ici : un dessin pose sous la ligne, qui empilait les poches du
   mois sous chaque releve. Le journal patrimonial n'en veut plus — douze barres
   dont l'immobilier occupe les quatre cinquiemes se ressemblent toutes, et la
   composition d'un mois se lit dans la fenetre de ce mois. Un parametre sans
   appelant est la moitie qu'on oublie : il part avec ses trois regles CSS. */
/* `jauge` : une fraction signee de la piste, entre -1 et +1, ou `null`, et
   `jaugeZero` la place du zero sur la piste, entre 0 et 1. Elle vit dans l'espace
   laisse libre entre le nom du mois et les montants, et elle ne dit rien de plus
   que la variation deja ecrite a droite -- d'ou `aria-hidden` : un lecteur
   d'ecran lit le nombre, il n'a que faire du dessin.

   La barre part du zero, sa longueur vaut l'amplitude, son cote vaut le signe.
   Un mois sans variation -- ou le premier de la serie, qui n'a rien avant lui --
   pose un point neutre sur le zero plutot que rien : une case vide se lit comme
   une donnee manquante, un point se lit comme un mois plat. Le point reste dans
   la piste quand le zero est a son bord.

   L'appelant fournit la fraction et le zero, jamais le montant : la geometrie
   est commune aux lignes affichees (`geometrieJauges`), et une ligne ne peut
   pas la calculer pour elle seule.

   La ligne porte `avec-jauge` : c'est cette classe qui deplace la croissance du
   nom du mois vers la piste, et elle seule. `ligneListe` sert a six ecrans, et
   les cinq autres gardent leur mise en page. */
/* L'ORDRE DE LECTURE DES CHARGES FIXES A DISPARU, avec le geste qui l'entretenait.

   Vivaient ici : `ordreCharges`, un reglage de vue a deux valeurs ; le
   glissement d'une ligne a la poignee, avec son animation FLIP ; et l'ecriture
   du nouvel ordre dans les donnees. La liste se range desormais du plus cher au
   moins cher, toujours, et `chargesOrdonnees()` porte la regle a elle seule.

   Le glissement ne servait que cette liste-la : personne d'autre ne posait
   l'attribut de rang qu'il lisait. Il part donc en entier, plutot que de rester
   arme sur un ordre que plus rien n'affiche. */
/* --- la part theorique, a l'ecran -------------------------------------

   Une information, jamais un montant du budget. Elle ne change ni la valeur
   affichee a droite de la ligne, ni la barre, ni le pourcentage, ni le total :
   ce qui sort du compte sort en entier, et ce qu'on te reverse entre par les
   revenus, une seule fois.

   Les champs se nomment `part_<id>` : c'est la convention que `validerPartsSaisies`
   et `ecrirePartsSaisies` connaissent, et les deux fenetres de charge la
   partagent. Sans personne declaree, la section n'existe pas. */
const memeNom = (a, b) => String(a || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  === String(b || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function champsPartage(charge) {
  const gens = contributors();
  if (!gens.length) return [];
  return [
    { cle: 'section_partage', label: 'Partage', type: 'section' },
    ...gens.map(g => ({
      cle: CLE_PART(g.id),
      label: trad('Part de {n} ({dev})').replace('{n}', g.name),
      type: 'nombre', exemple: '0',
      valeur: estDeclare(((charge || {}).shares || {})[g.id])
        ? num(charge.shares[g.id]) : '',
      aide: trad('Part théorique de {n} sur cette charge. Elle sert au suivi de '
        + 'la répartition et ne réduit pas le montant compté dans ton budget.')
        .replace('{n}', g.name),
    })),
  ];
}

function ligneListe({ action, index, titre, sous, valeur, second, classeSecond, marque, ancre, classe, jauge, jaugeZero = 0.5 }) {
  const part = jauge == null ? null : Math.max(-1, Math.min(1, num(jauge)));
  const zero = Math.max(0, Math.min(1, num(jaugeZero))) * 100;
  return `
  <button type="button" class="mlist${part == null ? '' : ' avec-jauge'}${classe ? ` ${classe}` : ''}"
          data-action="${action}" data-i="${index}"${ancre ? ` data-anchor="${esc(ancre)}"` : ''}>
    <span class="ml-nom">${esc(titre)}${marque || ''}${sous ? `<span class="sub">${esc(sous)}</span>` : ''}</span>
    ${part == null ? '' : `<span class="ml-jauge" aria-hidden="true">${
      Math.abs(part) < 0.005
        ? `<i class="plat" style="left:clamp(3px, ${zero.toFixed(1)}%, calc(100% - 3px))"></i>`
        : `<i class="${part > 0 ? 'up' : 'down'}" style="${part > 0
            ? `left:${zero.toFixed(1)}%` : `right:${(100 - zero).toFixed(1)}%`}; width:${
            (Math.abs(part) * 100).toFixed(1)}%"></i>`
    }</span>`}
    <span class="ml-chiffres">
      <b>${valeur}</b>
      ${second ? `<span class="${classeSecond || 'muted'}">${second}</span>` : ''}
    </span>
    <span class="ml-chev" aria-hidden="true">›</span>
  </button>`;
}

/* Une en-tete triable, et sa bulle d'aide a cote plutot que dessus.

   `suffixe` porte l'unite (« dev. »), qui fait partie de l'intitule et reste
   donc dans la zone cliquable. */
/* Repliee par defaut, et sur tous les ecrans. Le doublon avec « Lignes de
   titres » existe aussi sur grand ecran : y derouler neuf lignes parce qu'il y
   a la place ne repond a aucune question.

   Une variable de vue et rien d'autre : l'etat ne va pas dans `Store`, il ne se
   migre pas, et un rechargement retrouve la carte courte. C'est le meme choix
   que `evoNet` juste a cote. */
let jourDeplie = false;

function sectionJour() {
  const j = dayPerformance();
  const tete = `<p class="ptf-pv-lab">${trad('Aujourd\'hui')}</p>`;
  if (!j.lignes.length) {
    return `
    <div class="ptf-pv ptf-jour" data-anchor="jour">
      ${tete}
      <p class="ptf-pv-sec">${trad('Pas encore de clôture de la veille en mémoire.')}
        <button type="button" class="lien-nu" data-action="refresh-quotes">${trad('Actualiser les cours')}</button></p>
    </div>`;
  }
  if (j.toutHorsSeance) {
    return `
    <div class="ptf-pv ptf-jour" data-anchor="jour">
      ${tete}
      <p class="ptf-pv-sec">${trad('Aucune ligne n’a coté aujourd’hui')}${j.asOfMarche
        ? ` · ${trad('derniers cours')} ${esc(fmtCoursQuand(j.asOfMarche))}` : ''}</p>
    </div>`;
  }
  const poidsBase = basePortefeuilleMarches();
  const reserves = [
    `${j.hausse} ${trad('en hausse')} · ${j.baisse} ${trad('en baisse')}`,
    j.horsSeance ? `${j.horsSeance} ${trad('sans cours du jour')}` : '',
    j.sansDonnee ? (j.sansDonnee > 1 ? trad('{n} lignes sans clôture de référence n’y sont pas comptées')
                                     : trad('{n} ligne sans clôture de référence n’y est pas comptée'))
                     .replace('{n}', j.sansDonnee) : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="ptf-pv ptf-jour" data-anchor="jour">
      ${tete}
      <p class="ptf-pv-val ${cls(j.eur)}">${fmtSigned(j.eur)} (${fmtSignedPct(j.pct)})</p>
      <p class="ptf-pv-sec">${trad('sur ton portefeuille Marchés depuis la clôture d’hier')}${
        j.lignes.some(l => l.depuisAchat) ? `, ${trad('ou depuis ton achat du jour')}` : ''}</p>
      <p class="ptf-pv-sec">${reserves}</p>
      <button type="button" class="jour-plus" data-action="jour-detail"
              aria-expanded="${jourDeplie ? 'true' : 'false'}">${jourDeplie
        ? trad('Réduire')
        : (j.lignes.length > 1 ? trad('Voir les {n} lignes') : trad('Voir la ligne')).replace('{n}', j.lignes.length)}</button>
      <div class="jour-lignes">
        ${!jourDeplie ? '' : enteteLignesJour()}
        ${(jourDeplie ? trierJour(j.lignes) : []).map(l => `
          <div class="jour-ligne">
            <span class="jl-nom"><button type="button" class="mois-lien"
              data-action="open-position" data-i="${l.index}"
              title="${esc(l.name)} · ${trad('voir la fiche complète')}">${
                esc(l.name)}</button></span>
            <span class="jl-poids muted">${fmtPct(poidsPortefeuille(l.value, poidsBase), 1)}</span>
            <span class="jl-pct ${l.horsSeance ? '' : cls(l.pct)}">${
              l.horsSeance ? '' : fmtSignedPct(l.pct, 2)}</span>
            <span class="jl-eur ${l.horsSeance ? '' : cls(l.eur)}">${
              l.horsSeance ? '' : fmtSigned(l.eur)}</span>
              <span class="jl-mouv">${l.market
                ? `<i class="pastille ${l.market.cle}" title="${esc(
                    (GLYPHES_SEANCE[l.market.cle] || {}).titre || l.market.label)}"></i>`
                : ''}<!--
                Un seul prix, et sa couleur dit s'il vit encore.

                Reste ce qu'elles ne disent pas : le niveau, et sa fraicheur. En
                blanc, le prix est celui qui bouge en ce moment ; en gris, c'est
                une cloture, figee jusqu'a la prochaine seance. Une couleur au
                lieu d'un second montant. -->${`<b class="jl-prix${
                l.market && l.market.cle === 'open' ? '' : ' jl-fige'}${
                coursFraichis.has(l.symbol) ? ' valeur-maj' : ''}">${
                fmtCur(l.price, l.currency)}</b>`}<!--
                Ce que la ligne dit d'elle-meme, faute de quoi son ecart
                paraitrait faux : elle se compare a ton prix d'achat, pas a une
                cloture que tu n'as pas vecue. C'est ici et non dans une colonne
                a part, parce que sous 460 px il ne reste que le nom, le poids,
                la variation et l'effet.
             -->${l.depuisAchat ? `<span class="jl-quand">${trad('acheté aujourd’hui')}</span>` : ''}<!--
                Les deux faits sont vrais, et cote a cote ils se contredisent
                — sans cette mention, « ouvert · +0,00 % » se lit « le titre
                ne bouge pas ».-->${l.horsSeance ? `<span class="jl-quand">${l.quoteTime
                 ? `${trad('cours')} ${esc(fmtCoursQuand(l.quoteTime))}`
                 : trad('pas coté aujourd’hui')}</span>` : ''}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

/* LE DEPLIEMENT SE VOIT, PARCE QUE LA CARTE CHANGE DE TAILLE SOUS LE DOIGT.

   Trois lignes deviennent vingt d'un coup, et tout ce qui suit dans la page
   descend d'un bloc dans la meme image. L'oeil n'a rien pour relier l'avant et
   l'apres : on ne voit pas la carte s'ouvrir, on voit une autre page. Le pouce
   est encore sur le bouton, et le bouton a change de place.

   LA HAUTEUR EST MESUREE DES DEUX COTES, et c'est le seul moyen ici. La vue se
   redessine entierement a chaque geste : l'element d'avant n'existe plus, donc
   aucune transition CSS ne peut le suivre — elle a besoin d'un meme noeud qui
   change de valeur. On releve donc la hauteur AVANT le rendu, on pose celle
   d'apres, et la transition relie les deux sur un noeud neuf.

   `auto` NE S'ANIME PAS. C'est la raison du detour par deux nombres, et de la
   hauteur en ligne effacee a la fin : la laisser figerait la carte a la taille
   qu'elle avait, et un cours qui rallonge une ligne serait rogne.

   POURQUOI L'API D'ANIMATION ET NON UNE TRANSITION CSS. La vue se redessine en
   entier a chaque geste : il n'y a pas d'element qui persiste d'un etat a
   l'autre, seulement un noeud neuf portant deja sa hauteur d'arrivee. Une
   transition a besoin d'une valeur d'avant que le moteur ait resolue ; ici elle
   n'existe pas, et c'est le trou que `@starting-style` a ete invente pour
   combler. L'API, elle, recoit ses deux bornes en argument : rien a deduire
   d'un etat anterieur.

   Elle rend aussi une promesse, ce qui remplace le guetteur d'evenement, son
   filet de securite et le drapeau qui empechait de nettoyer deux fois. Et son
   deroulement se pilote (`currentTime`), donc il se verifie autrement qu'a
   l'oeil.

   Les LIGNES, elles, gardent leurs images-clefs CSS : une animation, au
   contraire d'une transition, joue sur un element qui vient d'apparaitre —
   c'est deja ce que fait l'entree des reperes.

   ANIMER LA HAUTEUR COUTE PEU, ET C'EST MESURE. A 375 px, sur la vue
   Positions (quelque 600 noeuds), imposer une hauteur a `.jour-lignes` puis
   forcer la mise en page prend 0,01 a 0,02 ms par image, autant qu'ecrire un
   `transform` : le moteur ne refait que la boite qui change et replace ses
   voisines. Une ouverture par masque et translation ferait sauter d'un bloc
   tout ce qui suit la carte, le bouton sous le pouce compris, et laisserait a
   la fermeture un vide entre la carte repliee et la suivante. La peinture de
   ce qui descend, elle, n'a pas ete mesuree. */
const JOUR_DEROULE_MS = 340;
const JOUR_DEROULE_COURBE = 'cubic-bezier(.22, .61, .36, 1)';

function hauteurJourLignes() {
  const box = $('.jour-lignes');
  return box ? box.getBoundingClientRect().height : null;
}

function deroulerJour(hAvant) {
  const box = $('.jour-lignes');
  if (!box || hAvant == null || typeof box.animate !== 'function') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hApres = box.getBoundingClientRect().height;
  if (Math.abs(hApres - hAvant) < 1) return;

  box.classList.add('jl-deroule');
  const anim = box.animate(
    [{ height: `${hAvant}px` }, { height: `${hApres}px` }],
    { duration: JOUR_DEROULE_MS, easing: JOUR_DEROULE_COURBE });
  /* `finished` rejette quand l'animation est annulee — un second clic pendant
     le mouvement, ou la vue qui change. Dans les deux cas le nettoyage doit
     avoir lieu quand meme, sans quoi la carte resterait rognee. */
  anim.finished.catch(() => {}).then(() => box.classList.remove('jl-deroule'));
}

function enteteJour(label, explication = '') {
  return `<span class="jour-col">${esc(trad(label))}${explication
    ? ` <i class="col-aide" data-aide="${esc(trad(explication))}" tabindex="0" role="button">?</i>` : ''}</span>`;
}

function enteteLignesJour() {
  return `
        <div class="jour-ligne entete">
          ${enteteJour('Ligne')}
          ${enteteJour('Poids')}
          ${enteteJour('Var.')}
          ${enteteJour('Effet', 'Contribution de cette ligne à la variation de ton portefeuille aujourd’hui.')}
        </div>`;
}

function trierJour(lignes) {
  return lignes.slice().sort((a, b) => ((a.horsSeance ? 1 : 0) - (b.horsSeance ? 1 : 0))
    || (Math.abs(num(b.eur)) - Math.abs(num(a.eur))));
}

function sortableTh(key, label, extraClass = '', explication = '', suffixe = '') {
  const tri = triPositions();
  const on = tri.key === key;
  const sens = !on || tri.dir === 'asc' ? trad('décroissant') : trad('croissant');
  return `<th class="sortable ${on ? tri.dir : ''} ${extraClass}">`
       + `<button type="button" class="th-tri" data-action="sort-positions" data-key="${key}"`
       + ` title="${trad('Trier par')} ${esc(trad(label))}, ${trad('ordre')} ${sens}">${esc(trad(label))}${suffixe}</button>`
       + (explication ? aide(trad(explication)) : '')
       + `</th>`;
}

function optionsCompte(comptes, choisi) {
  const paretab = new Map();
  comptes.forEach(c => {
    const e = nomEtabDe(c) || 'Sans établissement';
    if (!paretab.has(e)) paretab.set(e, []);
    paretab.get(e).push(c);
  });
  const opt = c => `<option value="${c.id}" ${c.id === choisi ? 'selected' : ''}>${esc(nomCompteV2(c))}</option>`;
  return [...paretab].map(([e, liste]) =>
    `<optgroup label="${esc(e)}">${liste.map(opt).join('')}</optgroup>`).join('');
}

function carteTitresArchives() {
  const liste = archivesAvecTitres();
  if (!liste.length) return '';
  const total = liste.reduce((s, x) => s + x.valeur, 0);
  return `
  <div class="card">
    <p class="avert" style="margin:0 0 8px"><b>${trad('Marchés compte des titres que ton patrimoine ne compte pas')}</b>
      ${trad('{v} de lignes sont rattachées à un compte archivé : la valeur du portefeuille les inclut, ton patrimoine non.')
        .replace('{v}', fmtEUR0(total))}</p>
    ${liste.map(x => `
    <div class="arch-ligne">
      <span class="arch-nom"><b>${esc(nomCompteV2(x.compte))}</b><span class="sub">${
        trad(x.lignes.length > 1 ? '{k} lignes de titres · {v}' : '{k} ligne de titres · {v}')
          .replace('{k}', x.lignes.length).replace('{v}', fmtEUR0(x.valeur))}</span></span>
      <span class="arch-actes"><button class="btn sm arch-agir" data-action="resoudre-titres-archives"
        data-id="${esc(x.compte.id)}">${trad('Résoudre')}</button></span>
    </div>`).join('')}
  </div>`;
}

const NOMS_CARTES_MARCHES = {
  retenir: () => trad('À retenir'),
  titres: () => trad('Lignes de titres'),
  reperes: () => trad('Repères de marché'),
  ventes: () => trad('Journal des ventes'),
  achats: () => trad('Journal des achats'),
};
const CARTES_VENTES = ['ventes'];
const periodeAdmissible = id => (CARTES_VENTES.includes(id) && (Store.state.sales || []).length > 0)
  || (id === 'achats' && (Store.state.purchases || []).length > 0);
/* `seulement` restreint la page a quelques cartes : c'est le cas d'un
   portefeuille sans titre, ou la recherche vit deja dans l'invitation. */
function composerMarches(blocs, { seulement = null } = {}) {
  const d = dispositionMarches();
  const visibles = d.ordre.filter(id => !d.masquees.includes(id) && (!seulement || seulement.includes(id)));
  const journalPlein = id => (id === 'ventes' && (Store.state.sales || []).length > 0)
    || (id === 'achats' && (Store.state.purchases || []).length > 0);
  const premiere = visibles.find(journalPlein) || visibles.find(periodeAdmissible);
  const recherche = seulement ? '' : symbolSearchCard();
  return visibles.map(id => (id === premiere ? barrePeriodeTransactions() : '')
      + blocs[id]() + (id === 'titres' ? recherche : '')).join('')
    + (seulement || visibles.includes('titres') ? '' : recherche);
}
function barrePeriodeTransactions() {
  return `
  <div class="periode-ventes" role="group" aria-label="${esc(trad('Période des transactions'))}">
    <span class="periode-ventes-titre">${trad('Période des transactions')}</span>
    <div class="carte-filtres">${selecteurAnneeTransactions()}</div>
  </div>`;
}
function selecteurAnneeTransactions() {
  const p = periodeTransactions();
  const annees = anneesDesTransactions().map(String);
  return `
    <div class="plage">
      <select data-action-change="sales-range" class="annee on"
              aria-label="${esc(trad('Année affichée'))}" title="${esc(trad('Année affichée'))}">
        ${annees.map(y => `<option value="${esc(y)}"${y === p ? ' selected' : ''}>${esc(y)}</option>`).join('')}
        <option value="all"${p === 'all' ? ' selected' : ''}>${trad('Toutes les années')}</option>
      </select>
    </div>`;
}
const piedMarches = () => `
  <p class="apercu-pied">
    <button type="button" class="lien-vue" data-action="marches-editer">${trad('Personnaliser Marchés')}</button>
  </p>`;

const JOURNAUX = { ventes: { requete: '', cache: null }, achats: { requete: '', cache: null }, focus: null };
function listeJournal(cle) {
  return cle === 'ventes'
    ? journalVentes({ range: periodeTransactions(), tri: triVentes, requete: JOURNAUX.ventes.requete })
    : journalAchats({ range: periodeTransactions(), requete: JOURNAUX.achats.requete });
}
function signatureJournal(cle, j) {
  const ligne = cle === 'ventes'
    ? v => [j.rang.get(v), v.id, v.date, v.name, v.realised, v.invested, v.gross, v.qty, v.price, v.currency, v.declaree,
            v.buyPrice, v.cession]
    : a => [a.id, a.date, a.name, a.qty, a.price, a.currency, a.note];
  return JSON.stringify([cle, periodeTransactions(), cle === 'ventes' ? triVentes : '', JOURNAUX[cle].requete,
    currentLang(), masqueActif(), j.total, j.lignes.map(ligne)]);
}
const libelleMois = mois => {
  const [a, m] = String(mois).split('-').map(Number);
  return a && m ? moisEtAnnee(a, m) : trad('Sans date');
};
function htmlJournal(cle, j) {
  const q = JOURNAUX[cle].requete.trim();
  const tete = !q ? '' : `
    <p class="journal-recherche"><span>${trad('Recherche : {n} sur {t}')
      .replace('{n}', j.lignes.length).replace('{t}', j.total)}</span>
      <button type="button" class="lien-vue" data-action="journal-effacer" data-journal="${cle}"
              >${trad('Effacer le filtre')}</button></p>`;
  if (!j.lignes.length) return tete + `<p class="empty">${trad('Aucun résultat pour ce nom.')}</p>`;
  const ligne = cle === 'ventes' ? lignesJournalVentes(j) : ligneJournalAchat;
  if (!j.groupes) return tete + `<div class="liste-principale">${j.lignes.map(ligne).join('')}</div>`;
  return tete + j.groupes.map(g => {
    const n = g.lignes.length;
    const compte = cle === 'ventes' ? `${n} ${n > 1 ? trad('ventes') : trad('vente')}`
      : (n > 1 ? trad('{n} achats notés') : trad('{n} achat noté')).replace('{n}', n);
    return `
    <section class="journal-mois">
      <div class="journal-mois-tete"><h3 class="journal-mois-nom">${esc(libelleMois(g.mois))}</h3><span
        class="journal-mois-chiffres">${compte}${cle !== 'ventes' ? '' : ` · ${trad(g.partiel ? 'Sous-total partiel' : 'Sous-total du mois')} ${
        g.sousTotal == null ? trad('non calculable') : `<b class="${cls(g.sousTotal)}">${fmtSigned(g.sousTotal)}</b>`}`}</span></div>
      <div class="liste-principale">${g.lignes.map(ligne).join('')}</div>
    </section>`;
  }).join('');
}
function remplirJournal(cle) {
  const corps = document.querySelector(`.journal-corps[data-journal="${cle}"]`);
  if (!corps) return;
  const j = listeJournal(cle);
  const signature = signatureJournal(cle, j);
  const c = JOURNAUX[cle].cache;
  if (c && c.signature === signature) {
    if (c.noeud.parentNode !== corps) corps.replaceChildren(c.noeud);
    return;
  }
  const noeud = document.createElement('div');
  noeud.className = 'journal-lignes';
  noeud.innerHTML = htmlJournal(cle, j);
  corps.replaceChildren(noeud);
  JOURNAUX[cle].cache = { signature, noeud };
}
const champFiltreJournal = cle => `
      <div class="journal-filtre">
        <input type="search" class="journal-filtre-champ" data-journal="${cle}" value="${esc(JOURNAUX[cle].requete)}"
               placeholder="${esc(trad('Filtrer par nom'))}" aria-label="${esc(trad('Filtrer par nom'))}"
               autocomplete="off" enterkeyhint="search">
      </div>`;
function monterJournal(cle, pli, noterOuverture) {
  if (!pli) return;
  pli.ontoggle = () => { noterOuverture(pli.open); if (pli.open) remplirJournal(cle); };
  if (pli.open) remplirJournal(cle);
  const champ = pli.querySelector('.journal-filtre-champ');
  if (!champ) return;
  champ.oninput = () => { JOURNAUX[cle].requete = champ.value; JOURNAUX.focus = cle; remplirJournal(cle); };
  champ.onfocus = () => { JOURNAUX.focus = cle; };
  champ.onblur = () => { if (champ.isConnected && JOURNAUX.focus === cle) JOURNAUX.focus = null; };
  if (JOURNAUX.focus === cle && pli.open) {
    champ.focus({ preventScroll: true });
    const n = champ.value.length;
    champ.setSelectionRange(n, n);
  }
}
const ligneJournalAchat = a => ligneListe({
  action: 'achat-modifier', index: esc(a.id), titre: a.name,
  sous: [fmtDate(a.date), `${fmtNombre(a.qty)} × ${fmtCur(a.price, a.currency)}`, a.note]
    .filter(Boolean).join(' · '),
  valeur: fmtCur(montantAchat(a), a.currency),
});

const AIDE_JOURNAL_ACHATS = 'Garde ici une trace de certains achats uniquement, ceux dont tu veux te souvenir, avec leur raison si tu le souhaites. Ce n’est pas un relevé complet : il ne modifie ni tes lignes de titres, ni leur prix de revient, ni tes espèces.';
function carteAchats() {
  const tous = achatsTries();
  const achats = achatsSurPlage(periodeTransactions());
  if (!tous.length) return `
  <p class="hint journal-vide" data-anchor="achats"><b>${trad('Journal des achats')}</b>${aide(trad(AIDE_JOURNAL_ACHATS))}${deuxPoints()}
    ${trad('aucun achat noté')} · <button type="button" class="lien-nu" data-action="achat-noter">${trad('Noter un achat passé')}</button></p>`;
  const compte = achats.length < tous.length
    ? (achats.length > 1 ? trad('{n} achats sur {t}') : trad('{n} achat sur {t}'))
    : (achats.length > 1 ? trad('{n} achats notés') : trad('{n} achat noté'));
  return `
  <div class="card" data-anchor="achats">
    <div class="card-head"><h2>${trad('Journal des achats')}${aide(trad(AIDE_JOURNAL_ACHATS))}</h2>
      <button type="button" class="btn sm" data-action="achat-noter">${trad('Noter un achat passé')}</button></div>
    ${achats.length ? `
    <details class="data-view pli-journal" id="pliAchats" ${achatsDeroules ? 'open' : ''}>
      <summary><span class="pli-compte">${compte.replace('{n}', achats.length).replace('{t}', tous.length)
        }</span><span class="pli-detail">${
        trad('Dernier achat le {date}').replace('{date}', fmtDate(achats[0].date))}</span></summary>
      ${champFiltreJournal('achats')}
      <div class="journal-corps" data-journal="achats"></div>
    </details>` : tous.length ? `
    <p class="hint" style="margin:0">${trad('Aucun achat sur cette période.')}</p>` : ''}
  </div>`;
}
function champsAchat(a = null) {
  return [
    { cle: 'date', label: trad('Date'), type: 'date', requis: true, valeur: a ? a.date : todayISO() },
    { cle: 'name', label: trad('Nom'), type: 'texte', requis: true, max: NOM_LIGNE_MAX,
      valeur: a ? a.name : '', exemple: 'ex. MSCI World',
      suggestions: [...new Set((Store.state.positions || []).map(p => p.name).filter(Boolean))] },
    { cle: 'qty', label: trad('Quantité achetée'), type: 'nombre', requis: true, valeur: a ? a.qty : '', exemple: '0' },
    { cle: 'price', label: trad('Prix d’achat unitaire'), type: 'nombre', requis: true,
      valeur: a ? a.price : '', exemple: '0' },
    { cle: 'currency', label: trad('Devise'), type: 'liste', valeur: a ? a.currency : 'EUR',
      options: DEVISES_ACHAT.map(d => [d, d]) },
    { cle: 'note', label: trad('Pourquoi cet achat ?'), type: 'texte', valeur: a ? a.note : '' },
  ];
}

let achatsDeroules = false;

let marchesEdition = false;
let marchesFocus = null;
let marchesAnnonce = '';
const enEditionMarches = () => marchesEdition && sousOngletActif.positions !== 'cible';
function editeurMarches() {
  const d = dispositionMarches();
  const fleche = haut => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${
          haut ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}"/></svg>`;
  const ligne = (id, i) => {
    const nom = esc(NOMS_CARTES_MARCHES[id]());
    const cachee = d.masquees.includes(id);
    const pour = libelle => `${trad(libelle)}${deuxPoints()} ${nom}`;
    return `
      <li class="apercu-ligne${cachee ? ' masquee' : ''}" data-carte="${id}">
        <span class="apercu-nom">${nom}${cachee ? `<span class="sub">${trad('Masquée')}</span>` : ''}</span>
        <span class="apercu-commandes">
          <button type="button" class="btn ghost apercu-fleche" data-action="marches-monter" data-carte="${id}"
                  aria-label="${pour('Monter')}" title="${trad('Monter')}"${i === 0 ? ' disabled' : ''}>${fleche(true)}</button>
          <button type="button" class="btn ghost apercu-fleche" data-action="marches-descendre" data-carte="${id}"
                  aria-label="${pour('Descendre')}" title="${trad('Descendre')}"${
                  i === d.ordre.length - 1 ? ' disabled' : ''}>${fleche(false)}</button>
          <button type="button" class="bascule apercu-vu${cachee ? '' : ' on'}" data-action="marches-visibilite"
                  data-carte="${id}" role="switch" aria-checked="${cachee ? 'false' : 'true'}"
                  aria-label="${pour('Afficher sur Marchés')}" title="${trad(cachee ? 'Afficher' : 'Masquer')}">
            <span class="bascule-piste" aria-hidden="true"><i></i></span></button>
        </span>
      </li>`;
  };
  return `
  <header class="page-tete apercu-edition-tete">
    <div>
      <h2 id="marchesEditionTitre" tabindex="-1">${trad('Personnaliser Marchés')}</h2>
      <p>${trad('Choisis l’ordre des cartes de Marchés et celles que tu veux voir. Le portefeuille et les outils restent à leur place.')}</p>
    </div>
    <button type="button" class="btn" data-action="marches-terminer">${trad('Terminé')}</button>
  </header>
  <section class="card apercu-edition marches-edition" aria-labelledby="marchesEditionTitre">
    <ol class="apercu-liste">
      <li class="apercu-ligne apercu-fixe">
        <span class="apercu-nom">${trad('Portefeuille')}<span class="sub">${trad('Toujours en premier')}</span></span>
      </li>
      ${d.ordre.map(ligne).join('')}
    </ol>
    <div class="apercu-edition-pied">
      <button type="button" class="btn sm ghost" data-action="marches-retablir"${d.parDefaut ? ' disabled' : ''}
              >${trad('Rétablir la disposition par défaut')}</button>
    </div>
    <p class="hors-ecran" role="status" id="marchesAnnonce"></p>
  </section>`;
}
function reprendreFocusMarches() {
  const f = marchesFocus, annonce = marchesAnnonce;
  marchesFocus = null; marchesAnnonce = '';
  let cible = null;
  if (f && f.titre) cible = $('#marchesEditionTitre');
  else if (f && f.carte) {
    const ligne = $(`.marches-edition .apercu-ligne[data-carte="${f.carte}"]`);
    const voulu = ligne && ligne.querySelector(`[data-action="${f.action}"]`);
    cible = voulu && !voulu.disabled ? voulu : ligne && ligne.querySelector('button:not([disabled])');
  }
  if (cible) cible.focus({ preventScroll: true });
  const zone = $('#marchesAnnonce');
  if (zone && annonce) zone.textContent = annonce;
}
function deplacerSurMarches(id, sens) {
  if (!deplacerCarteMarches(id, sens)) return;
  Store.save();
  const d = dispositionMarches();
  marchesAnnonce = trad('{c}, position {n} sur {t}').replace('{c}', NOMS_CARTES_MARCHES[id]())
    .replace('{n}', d.ordre.indexOf(id) + 2).replace('{t}', d.ordre.length + 1);
  marchesFocus = { carte: id, action: sens < 0 ? 'marches-monter' : 'marches-descendre' };
  render(); retourHaptique();
}

function viewPositions() {
  if (enEditionMarches()) return editeurMarches();
  const pnl = portfolioPnl();
  const stockBase = stockTotals().balance;
  const brokerAccounts = ACCOUNTS.filter(a => a.holdings);

  if (posCompte !== 'tous' && !Store.state.positions.some(p => p.account === posCompte)) {
    posCompte = 'tous';
  }

  const retenues = Store.state.positions
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => passeFiltresLignes(p));
  const ps = sortPositions(retenues)
    .map(({ p, i }) => Object.assign(Object.create(Object.getPrototypeOf(p)), p, { __i: i }));
  /* LE TOTAL DE LA CARTE EST CELUI DE SES LIGNES. Le sous-total du telephone et
     le pied du tableau lisent les lignes que les filtres retiennent, par le
     calcul de la plus-value du portefeuille : filtrer sur un compte donne la
     somme de ce compte-la, pas celle de tout le portefeuille sous ses lignes.
     `pnl`, lui, reste celui de tout le portefeuille, pour la carte du haut.

     « Positions » et non « compte » : le cash d'un compte n'est pas une ligne,
     et ce total ne se compare pas a la valeur du compte, qui l'inclut. */
  const vus = latentPnl(ps);
  const libelleVus = `${trad('Total des positions affichées')}${aide(trad(
    'La somme des lignes affichées, filtres compris. Le cash de tes comptes n’y est pas : ce n’est pas la valeur d’un compte.'))}`;

  const dev = q => q.currency || 'EUR';
  const rows = ps.map((p) => {
    const i = p.__i;
    const v = posValue(p), inv = posInvested(p), pe = posPerfEur(p), pp = posPerfPct(p);
    return `<tr>
      <td class="name sticky-col"><button type="button" class="mois-lien"
            data-action="open-position" data-i="${i}"
            title="${trad('Ouvrir la fiche : quantité, prix de revient, ISIN, compte…')}"
            >${esc(p.name || 'Sans nom')}<span class="sub">${
              esc([ASSET_CLASSES[assetClassDe(p)], ROLES[roleDe(p)],
                   ACC[p.account]?.label || ''].filter(Boolean).join(' · '))
            }</span></button></td>
      <td class="muted">${p.qty != null && p.qty !== '' ? num(p.qty).toLocaleString(locale()) : ''}</td>
      <td class="muted">${num(p.buyPrice) ? fmtCur(p.buyPrice, dev(p)) : ''}</td>
      <td class="muted">${num(p.price) ? fmtCur(p.price, dev(p)) : ''}</td>
      <td>${p.manual
            ? `<input type="number" step="any" data-path="positions.${i}.value" value="${p.value ?? ''}">`
            : `<b>${fmtEUR(v)}</b>`}</td>
      <td>${p.manual
            ? `<input type="number" step="any" data-path="positions.${i}.invested" value="${p.invested ?? ''}">`
            : fmtEUR(inv)}</td>
      <td class="${cls(pe)}">${pe == null ? '' : fmtSigned(pe)}</td>
      <td class="${cls(pp)}">${pp == null ? '' : `${arrow(pp)} ${fmtSignedPct(pp)}`}</td>
      <td class="muted">${fmtPct(poidsPortefeuille(v, stockBase))}</td>
    </tr>`;
  }).join('');

  /* Les cartes qui se rangent, chacune dans sa fonction : l'ordre et la
     visibilite viennent de `dispositionMarches()`. */
  const blocsMarches = {
    retenir: () => `

  ${carteInsights('positions', 'À retenir')}
`,
    titres: () => `
  <div class="card" data-anchor="titres">
    <div class="card-head">
      <h2>${trad('Lignes de titres')}</h2>
      <button class="btn sm" data-action="ajouter-ligne"
              title="${trad('Ajouter une ligne de titres')}">${trad('+ Ajouter')}</button>
    </div>
    <div class="carte-filtres">${filtresLignes()}</div>
    <div class="carte-meta">
        <span class="hint">${compteLignes(ps.length, Store.state.positions.length)}</span>
        ${(() => {
          const tri = triPositions();
          const nom = (TRI_POSITIONS_CHOIX.find(([k]) => k === tri.key) || [])[1] || '';
          return `<button type="button" class="btn sm ghost tri-lignes" data-action="trier-positions"
                  title="${trad('Changer le tri des lignes')}"
            >${trad(nom)} ${tri.dir === 'desc' ? '↓' : '↑'}</button>`;
        })()}
    </div>
    ${!ps.length ? '' : `<p class="total-vus">
      <span>${libelleVus}</span><b>${fmtEUR(vus.value)}</b>
    </p>`}
    <div class="liste-mobile">
      ${ps.map(p => {
        const i = p.__i, v = posValue(p), pp = posPerfPct(p), pe = posPerfEur(p);
        return ligneListe({
          action: 'open-position', index: i,
          titre: p.name || 'Sans nom',
          sous: `${ASSET_CLASSES[assetClassDe(p)]} · ${ROLES[roleDe(p)]} · ${ACC[p.account]?.label || ''}`,
          valeur: fmtEURCompact(v),
          second: pe == null ? trad('prix de revient manquant')
            : `${fmtSigned(pe)} <span class="muted">·</span> ${fmtSignedPct(pp, 1)}`,
          classeSecond: pe == null ? 'muted' : cls(pe),
        });
      }).join('') || `<p class="empty">${trad('Aucune ligne.')}</p>`}
    </div>
    <div class="table-wrap large-seulement">
      <table class="editable">
        <thead><tr>
          ${sortableTh('name', 'Nom', 'sticky-col')}
          ${sortableTh('qty', 'Qté')}
          ${sortableTh('pru', 'PRU', '',
            'Prix de revient unitaire, dans la devise de cotation.', ` <span class="u">${trad('dev.')}</span>`)}
          ${sortableTh('cours', 'Cours', '',
            'Dernier cours connu, dans la devise de cotation.', ` <span class="u">${trad('dev.')}</span>`)}
          ${sortableTh('value', 'Valeur {dev}')}${sortableTh('invested', 'Investi {dev}')}
          ${sortableTh('perfEur', 'Perf {dev}')}${sortableTh('perfPct', 'Perf %')}
          ${sortableTh('poids', '% portef.', '',
            'Part de cette ligne dans l’ensemble de ton portefeuille Marchés, cash à '
            + 'investir inclus. Le même calcul que la colonne « Poids » de la carte du jour '
            + 'et que la fiche de la ligne.')}
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="9" class="empty">${trad('Aucune position')}</td></tr>`}</tbody>
        ${!ps.length ? '' : `<tfoot><tr>
          <td class="sticky-col">${libelleVus}</td><td colspan="3"></td>
          <td>${fmtEUR(vus.value)}</td><td>${fmtEUR(vus.invested)}</td>
          <td class="${vus.avecBase ? cls(vus.pnl) : ''}">${vus.avecBase ? fmtSigned(vus.pnl) : ''}</td>
          <td class="${cls(vus.pnl)}">${vus.pct == null ? '' : fmtSignedPct(vus.pct)}</td>
          <td></td>
        </tr>${notePiedTitres(vus)}</tfoot>`}
      </table>
    </div>
  </div>`,
    reperes: () => `
  <div class="reperes-familles" id="reperesFamilles" role="tablist"
       aria-label="${trad('Familles de repères')}" hidden></div>
  <div class="reperes" id="reperes" aria-label="${trad('Marchés')}" hidden></div>`,
    achats: () => carteAchats(),
    ventes: () => `

  ${salesCard()}
`,
  };
  if (!Store.state.positions.length) {
    return `
  <div class="card">
    <div class="card-head"><h2>${trad('Suis tes placements cotés')}</h2>
      <span class="hint">${trad('actions, ETF, obligations, crypto')}</span></div>
    <p class="empty" style="margin:0 0 12px">${trad('Cette page suit les placements '
      + 'dont le cours arrive tout seul, du marché. Tes placements non cotés, ton '
      + 'immobilier et tes liquidités se déclarent dans Actifs, où c’est toi qui en '
      + 'donnes la valeur : ils comptent dans ton patrimoine, ta répartition et ta '
      + 'réserve exactement comme le reste.')}</p>
    ${(() => {
      const porteurs = TYPES_COMPTE.filter(t =>
        (t.classes || []).some(c => ['actions', 'obligations', 'crypto'].includes(c)));
      const eligibles = comptesOuverts().filter(c =>
        porteurs.some(t => t.id === c.type));
      if (eligibles.length) return `
    <div class="row" style="gap:8px">
      <button class="btn" data-action="ajouter-ligne">${trad('+ Un titre coté')}</button>
      <button class="btn ghost" data-action="goto" data-view="accounts" data-anchor="">${trad('Aller à Actifs')}</button>
    </div>`;
      return `
    <div class="row" style="gap:8px">
      <button class="btn" data-action="ajouter-compte">${trad('Créer un compte-titres')}</button>
      <button class="btn ghost" data-action="goto" data-view="accounts" data-anchor="">${trad('Aller à Actifs')}</button>
    </div>
    <p class="small muted" style="margin:12px 0 0">${trad('Un titre se pose sur le compte qui le détient : commence par en créer un.')}
      ${trad('Ceux qui peuvent en porter :')} ${esc(porteurs.map(t => trad(t.label)).join(', '))}.</p>`;
    })()}
  </div>
  ${(() => {
    const porteurs = TYPES_COMPTE.filter(t =>
      (t.classes || []).some(c => ['actions', 'obligations', 'crypto'].includes(c)));
    return comptesOuverts().some(c => porteurs.some(t => t.id === c.type))
      ? symbolSearchCard() : '';
  })()}
  ${composerMarches(blocsMarches, { seulement: (Store.state.sales || []).length
    ? ['ventes', 'achats'] : ['achats'] })}
  ${piedMarches()}`;
  }

  return `
  ${barreEtatCours()}
  ${carteTitresArchives()}

  ${(() => {
    const st = stockTotals();
    const parts = [
      { label: 'Placements', value: st.invested, apercu: 'portefeuille' },
      { label: 'Espèces disponibles', value: st.cashToInvest, apercu: 'cashInvestir' },
      /* LE TROISIEME TERME, sans quoi le total en tete ne serait pas la somme de
         ses parts. `balance` vaut `invested + cashToInvest + autres`, et ce
         dernier porte les lignes saisies a la main sur un compte de bourse. Il
         vaut zero chez presque tout le monde, donc il ne paraissait pas ; le
         jour ou il ne vaut pas zero, deux parts qui totalisent 96 % sous un
         total qui s'annonce entier est exactement le defaut que cette carte
         doit eviter. */
      { label: 'Autres lignes', value: st.balance - st.invested - st.cashToInvest,
        couleur: 'var(--series-6)', apercu: 'portefeuille' },
    ].filter(x => Math.abs(num(x.value)) > 0.005)
     .map(x => ({ ...x, pct: st.balance ? num(x.value) / st.balance * 100 : 0 }));
    /* Le partage des roles, pris au modele et jamais recalcule ici.
       `cashToInvest` est un role comme les autres pour `rebalanceRoles()`, mais
       il a deja son segment au-dessus : le redire en pourcentage ferait lire
       deux fois le meme fait dans la meme carte.

       LA CONCENTRATION A QUITTE CETTE CARTE, et c'est une question de base.
       `concentration()` compte sur les actifs financiers, le patrimoine net ou
       le patrimoine brut selon ses options, jamais sur le portefeuille de
       marche : mesure, 66 551 euros contre 52 177 pour tout le reste de la
       carte. Deux pourcentages qui se touchent sans se comparer valent moins
       que pas de pourcentage du tout. La lecture vit sur Actifs, ou elle
       nomme sa base. */
    /* LA PLUS-VALUE NE COUVRE QUE LES LIGNES QUI ONT UN PRIX D'ACHAT, et le
       modele le dit lui-meme : `latentPnl()` rend `sansBase` et son pourcentage
       vaut null quand aucune base n'existe. Une base absente ne se remplace
       jamais par zero — elle rendrait une plus-value egale a la valeur entiere,
       et le chiffre le plus faux de l'application serait aussi le plus gros.
       La garde s'ecrit contre l'impression, et non plus haut : un controle
       cherche `pnl.pct == null` dans les deux cents caracteres qui precedent
       chaque pourcentage imprime, parce qu'une garde posee loin finit par etre
       contournee par le gabarit qu'on ecrit six mois plus tard. */
    const pvVal = pnl.pct == null ? null
      : `${fmtSigned(pnl.pnl)} (${fmtSignedPct(pnl.pct)})`;
    if (!parts.length) return '';
    return `
  <div class="card repart ptf">
    <div class="card-head"><h2>${trad('Portefeuille')}</h2></div>
    <p class="ptf-lab">${trad('Valeur du portefeuille')}</p>
    <p class="ptf-total">${fmtEUR(st.balance)}</p>
    <dl class="ptf-compo">${parts.map(x => `
      <dt><button type="button" class="ptf-compo-lien" data-action="apercu"
                  data-apercu="${esc(x.apercu)}"
                  title="${esc(`${trad('Voir le détail de')} ${trad(x.label)}`)}"
            >${esc(trad(x.label))}</button></dt>
      <dd>${fmtEUR(x.value)}</dd>`).join('')}
    </dl>
    <div class="ptf-pv">
      <p class="ptf-pv-lab">${trad('Plus-value latente')}${aide(trad(
        'Écart entre la valeur actuelle et le coût d’achat des positions que tu détiens encore. Les plus-values déjà réalisées lors de ventes n’y sont pas, et Longward ne suit aucun dividende.'))}</p>
      ${pvVal == null ? `
      <p class="ptf-pv-val muted">${trad('Indisponible')}</p>
      <p class="ptf-pv-sec">${trad('Aucun prix d’achat renseigné sur tes placements')}</p>`
      : `
      <p class="ptf-pv-val ${cls(pnl.pnl)}">${pvVal}</p>
      <p class="ptf-pv-sec">${!pnl.sansBase ? trad('sur les positions détenues')
        : trad('sur les positions détenues, hors {n} sans prix d’achat')
            .replace('{n}', pnl.sansBase)}</p>`}
    </div>
    ${sectionJour()}
  </div>`;
  })()}

  ${composerMarches(blocsMarches)}
  ${piedMarches()}`;
}

function salesCard() {
  const toutes = Store.state.sales || [];
  const aVendre = (Store.state.positions || []).length;

  const st = salesStats(periodeTransactions());

  /* La carte porte le bouton qui l'alimente, et elle se rend même vide.

     « Ajouter une vente plus facilement. » Le seul chemin était le bouton
     « − Vendre » de la carte « Lignes de titres », dans Marchés — si loin que
     cette page l'écrivait noir sur blanc : « Le bouton "Vendre une ligne" se
     trouve dans Marchés ». Quand une page doit donner l'itinéraire vers son
     propre geste, c'est le geste qui est mal placé.

     C'est une deuxième porte sur la même action, pas un deuxième mécanisme :
     les deux appellent `sell-position`, qui demande la ligne. Ce qui serait
     fautif, ce serait deux saisies de vente.

     Et la carte ne disparaît plus faute de ventes : elle se rendait seulement
     s'il y en avait déjà, donc le bouton n'aurait jamais été là pour la
     première. C'est le cas qu'on ne voit pas en développant sur un jeu de
     données bien rempli. */
  return `
  <div class="card" data-anchor="ventes">
    <div class="card-head">
      <h2>${trad('Journal des ventes')}${aide(trad('Résultat brut, avant frais et fiscalité : '
        + 'le traitement fiscal dépend de l’enveloppe (PEA, CTO) et de ta situation.'))}</h2>
      <button class="btn sm ghost" data-action="sell-position"
              title="${trad('Enregistrer une vente et sa plus-value, ou en déclarer une passée')}">− ${trad('Vendre')}</button>
    </div>
    ${!toutes.length ? `<p class="empty">${trad('Aucune vente enregistrée.')} ${aVendre
      ? trad('Le bouton « Vendre » enregistre la vente, sa plus-value, et crédite le compte de ton choix.')
      : trad('Il faut une ligne de titres avant de pouvoir en vendre une.')}</p>` : `
    ${st.count ? `<details class="data-view pli-journal" id="pliVentes" ${journalDeroule ? 'open' : ''}>
      <summary><span class="pli-compte">${st.count} ${st.count > 1 ? trad('ventes') : trad('vente')}${
        st.count === toutes.length ? '' : ` ${trad('sur.total', 'sur')} ${toutes.length}`}</span><span
        class="pli-detail">${!st.fiables ? trad('Aucun résultat calculable')
          : `${trad(st.partiel ? 'Résultat net partiel' : 'Résultat net des ventes')} <b class="${cls(st.realised)}">${
          fmtSigned(st.realised)}</b>`}<span class="pli-note">${[trad('avant frais et fiscalité'),
          !st.nonFiables ? '' : (st.nonFiables > 1 ? trad('{n} ventes exclues') : trad('1 vente exclue'))
            .replace('{n}', st.nonFiables)].filter(Boolean).join(' · ')}</span></span></summary>
      <div class="segmented seg-mini" style="margin:4px 0 8px">
        <button data-action="tri-ventes" data-tri="date" class="${triVentes === 'date' ? 'on' : ''}"
                aria-pressed="${triVentes === 'date'}">${trad('Par date')}</button>
        <button data-action="tri-ventes" data-tri="montant" class="${triVentes === 'montant' ? 'on' : ''}"
                aria-pressed="${triVentes === 'montant'}">${trad('Par montant')}</button>
      </div>
${champFiltreJournal('ventes')}
      <div class="journal-corps" data-journal="ventes"></div>
    </details>` : `<p class="empty">${trad('Aucune vente sur cette période.')}</p>`}`}
  </div>`;
}

/* Les lignes du journal des ventes, pour le journal que `journalVentes` a
   retenu : chaque vente, sa porte, et la barre de son ampleur. */
const MOTIFS_VENTE = {
  prixDeRevient: 'prix de revient non renseigné',
  resultat: 'résultat non enregistré',
  historique: 'montants incomplets',
  incoherent: 'montants incohérents',
};
const motifVente = r => trad(MOTIFS_VENTE[r.raison] || MOTIFS_VENTE.resultat);
function lignesJournalVentes(j) {
  /* Barres et pourcentages sur les seules ventes fiables, la regle de
     `resultatVente` : une vente sans base n'a ni ampleur ni taux. */
  const plusGrand = j.lignes.reduce((m, v) => {
    const r = resultatVente(v);
    return r.fiable ? Math.max(m, Math.abs(r.montant)) : m;
  }, 0);
  return v => {
    const dev = v.currency || 'EUR';
    const r = resultatVente(v);
    const pct = r.fiable && num(v.invested) ? r.montant / num(v.invested) * 100 : null;
    const part = r.fiable && plusGrand ? Math.abs(r.montant) / plusGrand * 100 : 0;
    const teinte = r.fiable && r.montant >= 0 ? 'var(--good)' : 'var(--critical)';
    /* Une vente declaree n'a ni quantite ni prix : son sous-titre dit d'ou
       elle vient plutot que d'afficher « 0 × 0 € ».

       ET LA QUESTION SE POSE A LA DONNEE, PAS AU DRAPEAU. Elle se posait
       a `declaree`, ce qui revenait a supposer que tout le reste se
       compte en titres. La cession d'un placement non cote sans parts —
       un fonds, un pret, un bien — n'en a pas davantage, et le journal
       affichait « 0 × 0,00 € » sous son nom : deux zeros qui se lisent
       comme des faits alors qu'ils ne sont que des cases vides. */
    return ligneListe({
      action: 'open-sale', index: j.rang.get(v),
      titre: v.name,
      sous: [fmtDate(v.date), v.declaree ? trad('déclarée, pour mémoire')
               : num(v.qty) ? `${num(v.qty)} × ${fmtCur(v.price, dev)}`
               : trad('{m} reçus').replace('{m}', fmtEUR(num(v.gross))),
             r.fiable ? '' : motifVente(r)].filter(Boolean).join(' · '),
      valeur: r.fiable ? `<span class="${cls(r.montant)}">${fmtSigned(r.montant)}</span>`
        : `<span class="muted">${trad('non calculable')}</span>`,
      second: pct == null ? '' : fmtSignedPct(pct),
      classeSecond: r.fiable ? cls(r.montant) : 'muted',
      barre: r.fiable && plusGrand ? `<span class="repart-barre"><i style="width:${
        Math.max(2, part).toFixed(1)}%;background:${teinte}"></i></span>` : '',
    });
  };
}

/* Soleil ou lune, selon que la place cote ou dort. Le cours d'un marche ferme
   est celui de la derniere cloture : sans ce signe, « +0,70 % » se lit comme
   un mouvement en cours alors qu'il est fige depuis des heures.

   Rien du tout quand l'etat est inconnu — `marketStatus()` rend `null` plutot
   que de supposer, et une lune posee a tort serait pire que pas de lune. Les
   seances etendues gardent le soleil, en ambre : ca cote, mais hors de la
   seance principale. */
const GLYPHES_SEANCE = {
  open:  { icone: 'soleil', titre: trad('Marché ouvert') },
  pre:   { icone: 'soleil', titre: trad('Pré-ouverture') },
  post:  { icone: 'soleil', titre: trad('Après clôture') },
  close: { icone: 'lune',   titre: trad('Marché fermé · dernier cours de clôture') },
};
function glypheSeance(etat) {
  const g = etat && GLYPHES_SEANCE[etat.cle];
  if (!g) return '';
  const dessin = g.icone === 'soleil'
    ? `<circle cx="12" cy="12" r="4.4"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3
        M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M19.2 4.8l-2.1 2.1M6.9 17.1l-2.1 2.1"/>`
    : `<path d="M20.5 14.6A8.8 8.8 0 0 1 9.4 3.5a8.8 8.8 0 1 0 11.1 11.1Z"/>`;
  return `<svg class="rp-seance ${esc(etat.cle)}" viewBox="0 0 24 24" role="img"
               aria-label="${esc(g.titre)}"><title>${esc(g.titre)}</title>${dessin}</svg>`;
}

let REPERES_AFFICHES = [];

const AIDE_VIX = 'Le VIX mesure la volatilité implicite attendue sur le S&P 500. '
  + 'Plus il est élevé, plus le marché anticipe de fortes variations.';

const NIVEAUX_VIX = [
  [30, 'Très élevée'],
  [20, 'Élevée'],
  [15, 'Modérée'],
  [0,  'Faible'],
];
/* Ce que les deux perimetres contiennent, et la consequence qu'on observe :
   en Financier, la bascule net/brut ne bouge pas la courbe. Ce n'est pas une
   approximation, c'est la regle de `pointsEvolution` dite a l'endroit ou on
   la constate. */
const AIDE_PERIMETRE = 'Financier : tes placements et tes liquidités. Global : tout, immobilier et biens compris. En Financier, la courbe ne retranche aucun crédit, pas même ceux qui financent un placement : un relevé passé ne dit pas ce que chaque dette finançait, donc net et brut y donnent la même courbe. Les dettes de ce périmètre se lisent sur la page Allocation.';

const estVix = l => String(l?.symbole || '') === '^VIX';
/* `null` plutot qu'un libelle par defaut : sans valeur utilisable, la tuile ne
   doit rien affirmer. C'est la meme regle que le « hors seance » des autres
   reperes, qui se tait plutot que d'afficher la variation de la veille. */
function niveauVix(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return trad((NIVEAUX_VIX.find(([seuil]) => n >= seuil) || NIVEAUX_VIX[NIVEAUX_VIX.length - 1])[1]);
}

const uniteRepere = l => estVix(l) ? ''
  : String(l?.symbole || '').startsWith('^') ? ` ${trad('pts')}`
  : l?.devise === 'USD' ? ' $' : l?.devise === 'EUR' ? ' €'
  : l?.devise ? ` ${l.devise}` : '';

let familleReperes = null;
/* Vrai le temps d'un rendu, pose par le clic sur un onglet de famille. Le meme
   mecanisme que `tapeSousOnglets` : l'intention vit dans le geste, la classe
   est posee au rendu suivant puis retiree quand l'animation a fini. */
let reperesEntrent = false;
let reperesSens = 1;

async function mountReperes() {
  const box = $('#reperes');
  if (!box) return;
  familleReperes = familleReperes || Quotes.familleParDefaut;

  const familles = Quotes.famillesReperes();
  const onglets = $('#reperesFamilles');
  if (onglets) {
    if (!onglets.querySelector('[data-famille]')) {
      onglets.innerHTML = familles.map(([cle, nom]) => `
        <button type="button" class="rp-famille" data-famille="${esc(cle)}">${esc(nom)}</button>`).join('')
        + '<i class="rp-curseur" aria-hidden="true"></i>';
    }
    for (const b of onglets.querySelectorAll('[data-famille]')) {
      b.onclick = () => {
        if (b.dataset.famille === familleReperes) return;
        const cles = familles.map(f => f[0]);
        reperesSens = cles.indexOf(b.dataset.famille) >= cles.indexOf(familleReperes) ? 1 : -1;
        familleReperes = b.dataset.famille;
        retourHaptique();
        reperesEntrent = true;
        mountReperes();
      };
    }
    for (const b of onglets.querySelectorAll('[data-famille]'))
      b.classList.toggle('on', b.dataset.famille === familleReperes);
    const actif = onglets.querySelector('.rp-famille.on');
    const curseur = onglets.querySelector('.rp-curseur');
    if (actif && curseur) {
      curseur.style.width = `${actif.offsetWidth}px`;
      curseur.style.transform = `translateX(${actif.offsetLeft}px)`;
      if (!curseur.dataset.pose) {
        curseur.dataset.pose = '1';
        requestAnimationFrame(() => curseur.classList.add('glisse'));
      }
    }
    onglets.hidden = false;
  }

  let lignes;
  try { lignes = await Quotes.reperes(familleReperes); }
  catch (e) { box.hidden = true; return; }
  if (!box.isConnected) return;                 // la vue a change entre-temps
  const utiles = lignes.filter(l => l.ok);
  if (!utiles.length) { box.hidden = true; return; }
  REPERES_AFFICHES = utiles;
  const nb = (v, dec) => moinsTypographique(new Intl.NumberFormat(locale(),
    { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v));
  box.innerHTML = utiles.map(l => `
    <button type="button" class="repere" data-action="apercu"
            data-apercu="repere" data-arg="${esc(l.symbole)}"
            title="${esc(l.nom)}${estVix(l) ? ` · ${esc(trad(AIDE_VIX))}` : ''}${
              l.quoteTime ? ` · ${trad('cours')} ${fmtCoursQuand(l.quoteTime)}` : ''}">
      <span class="rp-tete">
        <span class="rp-nom">${esc(l.nom)}</span>
        ${glypheSeance(marketStatus(l))}
      </span>
      <span class="rp-prix">${nb(l.prix, estVix(l) ? 1 : l.prix < 10 ? 4 : 0)}<span class="rp-unite">${esc(uniteRepere(l))}</span></span>
      ${estVix(l) ? `<span class="rp-var rp-vix">${esc(niveauVix(l.prix) || trad('hors séance'))}</span>`
        : `<span class="rp-var ${l.pct == null ? 'muted' : cls(l.pct)}">${
        l.pct == null ? trad('hors séance') : fmtSignedPct(l.pct, 2)}</span>`}
    </button>`).join('');
  box.hidden = false;
  if (reperesEntrent) {
    reperesEntrent = false;
    box.style.setProperty('--sens', String(reperesSens));
    box.classList.add('rp-entre');
    setTimeout(() => box.classList.remove('rp-entre'), 700);
  }
  box.scrollLeft = 0;
}

/* Pose par l'action « ajouter une ligne », consomme par `render()` : la carte
   de recherche n'existe pas encore au moment du clic si l'on arrive d'une
   autre vue. */
let ouvrirRechercheApresRendu = false;
let compteVisePourAjout = null;

function mountPositions() {
  if ($('.marches-edition')) { reprendreFocusMarches(); return; }
  const pli = $('#pliVentes');
  if (pli) monterJournal('ventes', pli, ouvert => { journalDeroule = ouvert; });
  monterJournal('achats', $('#pliAchats'), ouvert => { achatsDeroules = ouvert; });

  /* La recherche se monte meme sans aucune ligne, et c'est le correctif : l'etat
     vide porte le bouton « + Un titre coté » et desormais la carte qu'il ouvre.
     Le montage sortait avant, donc le champ restait inerte au moment precis ou
     l'on n'a rien et ou l'on vient tout ajouter. `mountSymbolSearch()` se tait
     de lui-meme si la carte n'est pas la — c'est le cas sans compte capable de
     porter un titre. */
  mountSymbolSearch();
  /* La recherche demandee depuis l'en-tete du tableau : on s'y rend, on donne
     le focus. `focusChamp` se tait sur ecran tactile, ce qui est voulu — le
     clavier ne doit pas recouvrir la carte a laquelle on vient d'arriver. */
  if (ouvrirRechercheApresRendu) {
    ouvrirRechercheApresRendu = false;
    const champ = $('#symQuery');
    /* Le defilement attend la fin de l'animation d'entree de la vue. Celle-ci
       deplace `.view` par un `transform`, et `scrollIntoView` appele pendant
       calcule sa cible sur la position transformee : la carte finissait hors de
       l'ecran une fois l'animation retombee. Le focus, lui, peut partir tout de
       suite : il ne depend pas de la geometrie. */
    focusChamp(champ);
    const carte = champ && champ.closest('.card');
    if (carte) setTimeout(() => carte.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
  }

  if (!Store.state.positions.length) return;
  mountReperes();
}

partieChargee('assets/app-03-positions.js');
