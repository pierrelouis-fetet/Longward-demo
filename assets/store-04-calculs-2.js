/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
/* La couleur d'un etablissement. Elle se lit sur LUI, pas sur ses comptes : la
   famille est deja celle que sa fiche affiche au-dessus de son nom, et la
   couleur cesse donc de contredire les mots qui la surplombent.

   `teinteDominante`, juste dessous, garde son role la ou le groupe EST une
   classe d'actif : l'onglet par type, et le groupe des lignes sans contenant.
   La ou l'on regarde un contenant, c'est le contenant qui parle ; la ou l'on
   regarde une classe, c'est la classe. */
function teinteEtab(e) {
  return e ? contenantDeLEtab(e.id).teinte : 'var(--border-strong)';
}

function teinteDominante(comptes) {
  const parClasse = new Map();
  for (const c of comptes || []) {
    for (const e of (c.cash || [])) {
      parClasse.set('liquidites', (parClasse.get('liquidites') || 0) + num(e.montant));
    }
    for (const l of lignesDe(c)) {
      parClasse.set(l.classe, (parClasse.get(l.classe) || 0) + num(l.valeur));
    }
  }
  const dominante = [...parClasse.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  return dominante ? CLASSE_COULEURS[dominante] || 'var(--border-strong)'
                   : 'var(--border-strong)';
}

function changementDeTypePossible(compte, cibleId) {
  const cible = TYPES_COMPTE.find(t => t.id === cibleId);
  if (!cible) return { ok: false, raison: 'Ce type de compte n’existe pas.' };
  if (!compte) return { ok: false, raison: 'Ce compte n’existe plus.' };
  if (compte.type === cibleId) return { ok: true, sansChangement: true };

  const permises = new Set(cible.classes);
  const cash = (compte.cash || []).filter(e => num(e.montant) !== 0).length;
  if (cash && !permises.has('liquidites')) {
    return { ok: false, raison: `${cible.label} ne peut pas porter d’espèces. `
      + `Ce compte en déclare ${cash > 1 ? `${cash} parts` : 'une part'} : `
      + `remets-la à zéro, ou choisis un type qui accepte des liquidités.` };
  }

  const bloquantes = lignesDe(compte).filter(l => !permises.has(l.classe));
  if (bloquantes.length) {
    const noms = bloquantes.slice(0, 3).map(l => l.libelle).join(', ');
    return { ok: false, raison: `${cible.label} ne peut pas porter `
      + `${bloquantes.length > 1 ? 'ces placements' : 'ce placement'} : ${noms}`
      + `${bloquantes.length > 3 ? `, et ${bloquantes.length - 3} de plus` : ''}. `
      + `Déplace-${bloquantes.length > 1 ? 'les' : 'le'} d’abord, ou choisis un `
      + `type qui ${bloquantes.length > 1 ? 'les' : 'l’'}accepte.` };
  }
  return { ok: true };
}

/* Ce qu'on peut encore verser sur un livret plafonne.

   Un Livret A s'arrete a 22 950 EUR, un LDDS a 12 000, un LEP a 10 000. Le
   modele ne connait que le type « livret » et non le produit : le plafond est
   donc saisi, pas deduit. Une constante par produit aurait demande une liste a
   tenir a jour a chaque revalorisation reglementaire, pour une information que
   le detenteur a sous les yeux.

   Rend `null` quand aucun plafond n'est pose, ce qui est le cas par defaut et
   celui de tous les autres types de compte : l'ecran n'a alors rien a dire.
   Jamais de reste negatif — un livret peut depasser son plafond par le seul jeu
   des interets, c'est legal, et annoncer « il reste −40 EUR a verser » serait
   une facon absurde de dire qu'il est plein. */
function resteAVerser(compte) {
  const plafond = num(compte?.plafond);
  if (!plafond) return null;
  const verse = (compte.cash || []).reduce((s, e) => s + num(e.montant), 0);
  return {
    plafond, verse,
    reste: Math.max(0, round2(plafond - verse)),
    part: plafond ? Math.min(100, verse / plafond * 100) : 0,
    plein: verse >= plafond - 0.005,
  };
}

function partageDeCible(cible, parRole) {
  const core = num(parRole?.core), satellite = num(parRole?.satellite);
  const total = core + satellite;
  const c = num(cible);
  const sat = total ? Math.round(c * satellite / total) : 0;
  return { core: Math.max(0, c - sat), satellite: Math.min(c, sat) };
}

function positionsFiltrees(garde) {
  return Store.state.positions
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => garde(p))
    .map(({ p, i }) => {
      const c = Store.state.comptes.find(x => x.id === p.account);
      return {
        i, nom: p.name, valeur: posValue(p),
        role: roleDe(p), classe: assetClassDe(p),
        compte: c ? nomCompteV2(c) : '',
        etab: c ? nomEtabDe(c) : '',
      };
    })
    .sort((a, b) => b.valeur - a.valeur);
}

const ficheDePositions = (label, lignes) => ({
  label, lignes, total: round2(lignes.reduce((s, l) => s + l.valeur, 0)),
});

function positionsDeCible(cle) {
  const [, classe, role] = String(cle || '').split('.');
  if (!classe || !ASSET_CLASSES[classe]) return null;
  if (role && !ROLES[role]) return null;
  return {
    classe, role: role || null,
    ...ficheDePositions(
      role ? `${ASSET_CLASSES[classe]} ${ROLES[role].toLowerCase()}`
           : ASSET_CLASSES[classe],
      positionsFiltrees(p => assetClassDe(p) === classe
                          && (!role || roleDe(p) === role))),
  };
}

function positionsDeRole(role) {
  if (!ROLES[role]) return null;
  return {
    classe: null, role,
    ...ficheDePositions(ROLES[role], positionsFiltrees(p => roleDe(p) === role)),
  };
}

function rebalanceRoles() {
  const parRole = { core: 0, satellite: 0 };
  const parClasse = new Map();
  for (const p of Store.state.positions) {
    const v = posValue(p);
    if (!v) continue;
    const r = roleDe(p), ac = assetClassDe(p);
    parRole[r] += v;
    if (!parClasse.has(ac)) parClasse.set(ac, { core: 0, satellite: 0 });
    parClasse.get(ac)[r] += v;
  }
  const cash = num(stockTotals().cashToInvest);
  const base = rebalanceRows().base;
  const mk = (cle, label, valeur) => ({
    cle, label, value: valeur !== undefined ? valeur : parRole[cle],
    pct: base ? (valeur !== undefined ? valeur : parRole[cle]) / base * 100 : 0,
  });
  return {
    base,
    roles: [mk('core', ROLES.core), mk('satellite', ROLES.satellite),
            mk('cashToInvest', AFFECTATION_LABEL.investir, cash)],
    parClasse: [...parClasse]
      .map(([ac, v]) => ({ classe: ASSET_CLASSES[ac], ...v, total: v.core + v.satellite }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total),
    composition: ['core', 'satellite'].reduce((acc, r) => {
      const m = new Map();
      for (const p of Store.state.positions) {
        const v = posValue(p);
        if (!v || roleDe(p) !== r) continue;
        const ac = assetClassDe(p), nat = natureDe(p);
        const cle = `${ac}|${nat}`;
        if (!m.has(cle)) m.set(cle, {
          classe: ASSET_CLASSES[ac], nature: nat,
          label: `${ASSET_CLASSES[ac]} · ${nat === 'fonds' ? 'fonds' : 'en direct'}`,
          couleur: couleurClasse(ac), value: 0,
        });
        m.get(cle).value += v;
      }
      acc[r] = [...m.values()].filter(x => x.value > 0).sort((a, b) => b.value - a.value);
      return acc;
    }, {
      cashToInvest: num(cash) > 0.005 ? [{
        classe: AFFECTATION_LABEL.investir, nature: 'fonds',
        label: AFFECTATION_LABEL.investir,
        couleur: CLASSE_COULEURS.liquidites, value: num(cash),
      }] : [],
    }),
    parNature: (() => {
      const m = new Map();
      for (const p of Store.state.positions) {
        const v = posValue(p);
        if (!v) continue;
        const cle = `${assetClassDe(p)}|${natureDe(p)}`;
        if (!m.has(cle)) m.set(cle, { classe: ASSET_CLASSES[assetClassDe(p)],
                                      nature: NATURES[natureDe(p)],
                                      couleur: couleurClasse(assetClassDe(p)),
                                      core: 0, satellite: 0, lignes: 0 });
        const e = m.get(cle);
        e[roleDe(p)] += v;
        e.lignes++;
      }
      return [...m.values()]
        .map(e => ({ ...e, total: e.core + e.satellite }))
        .sort((a, b) => b.total - a.total);
    })(),
  };
}

/* --- fonds ou titre en direct -----------------------------------------
   « Actions » couvre un MSCI World et une ligne Meta, qui ne portent pas le
   même risque : l'un est mille sociétés, l'autre une seule. La distinction
   manquait à la lecture socle / satellite, où les deux se fondaient dans un
   même total.

   Ce n'est pas une classe d'actif pour autant. Un ETF est une enveloppe : un
   MSCI World *est* des actions, un ETF obligataire *est* de l'obligation, un
   ETC or *est* du métal. En faire une classe la mettrait en concurrence avec
   « Actions » pour le même argent et fausserait des cibles qui portent sur du
   risque, pas sur un emballage.

   C'est donc un second axe, orthogonal, et l'application le connaît déjà :
   Yahoo renvoie la nature de l'instrument dans `kind`. Un réglage manuel
   prend le pas quand la passerelle n'a rien pu dire. */
const NATURES = { fonds: 'Fonds', titre: 'Titre en direct' };
const KIND_VERS_NATURE = {
  ETF: 'fonds', MUTUALFUND: 'fonds', FUND: 'fonds',
  EQUITY: 'titre', CRYPTOCURRENCY: 'titre', CURRENCY: 'titre', INDEX: 'fonds',
};
const INDICES_FONDS = [
  /\b(amundi|ishares|lyxor|xtrackers|vanguard|spdr|invesco|vaneck|wisdomtree|blackrock)\b/i,
  /\b(bnp\s*paribas\s*easy|axa\s*im|ossiam|tabula|jpmorgan|jpm|fidelity|hsbc|schwab|ark\s*invest)\b/i,
  /\b(etf|etc|etn|ucits|sicav|fcp|opcvm|fonds|fund|index\s*fund|tracker)\b/i,
  /\b(msci|s&p|sp500|ftse|stoxx|cac\s*40|dax|mdax|nasdaq|nikkei|russell|topix|smi|sensex)\b/i,
  /\b(all[-\s]?world|world|emerging|indice|index)\b/i,
];
const nomSentLeFonds = nom => INDICES_FONDS.some(rx => rx.test(String(nom || '')));

function natureDe(p) {
  if (NATURES[p?.nature]) return p.nature;
  const auto = KIND_VERS_NATURE[p?.kind];
  if (auto) return auto;
  return nomSentLeFonds(p?.name) ? 'fonds' : 'titre';
}

/* Une seule table pour toutes les classes, poches comprises.
   Il y en avait deux — l'une pour les classes de marché, l'autre pour les
   poches de patrimoine — avec des valeurs qui divergeaient : les obligations
   étaient `series-6` d'un côté et `series-7` de l'autre, et surtout les
   métaux précieux partageaient `series-4` avec l'immobilier. Dans
   « Allocation par actif », où les deux apparaissent, un studio et un ETC or
   se peignaient de la même couleur. Sept clés, sept teintes, une table. */
const TEINTE_CLASSE = {
  liquidites: 1, monetaire: 1,
  actions: 2,
  nonCote: 3,
  immobilier: 4, immobilierCote: 4,
  crypto: 5,
  metaux: 6,
  obligations: 7,
  diversifie: 8,
  /* La teinte de « multi-actifs », et c'est une paire volontaire de plus.

     Aucune couleur neuve n'etait possible : mesure contre les neuf series et
     les cinq couleurs de sens, en balayant teinte, saturation et clarte, le
     meilleur ecart atteignable sur tout le cercle vaut 17,6 degres en theme
     clair et 19,1 en sombre, quand la regle en exige vingt. Le cercle est
     plein.

     La paire suit exactement le motif d'immobilier et immobilier cote : l'une
     est une poche du patrimoine, l'autre une classe de ligne cotee, et les deux
     vocabulaires ne se rencontrent sur aucun graphique — `repartitionClasses()`
     dessine les poches, les cibles et les listes de lignes dessinent les
     classes fines. Un controle le verifie desormais, pour que l'hypothese cesse
     d'en etre une. */
  garanti: 8,
  bienValeur: 9,
};
const TEINTES_DISPONIBLES = 12;
const TEINTE_SANS_CLASSE = 12;
const couleurClasse = ac =>
  `var(--series-${TEINTE_CLASSE[CLASSES_ALIAS[ac] || ac] || TEINTE_SANS_CLASSE})`;

/* Ce qui est place, groupe par type d'enveloppe.

   Meme argent que `allocationByAccount()`, meme perimetre, meme base : les deux
   cartes de la page Patrimoine sont deux granularites d'un seul total, le type
   puis le compte. Leurs sommes sont donc egales, et un test le verifie.

   Deux exclusions, et chacune a sa raison.

   Le cash, parce que les liquidites posees sur un PEA en attente d'un achat
   gonflaient la part de l'enveloppe sans qu'un euro soit place. Elles ont leur
   propre lecture, dans les poches de patrimoine et dans Comptes. Un type qui ne
   porte que du cash sort donc de la repartition.

   Le levier, parce que c'est une dette et non une enveloppe. Attention : le
   type `levier` ne figure pas dans `TYPES_COMPTE`, il vient de l'ancien modele,
   donc `typeCompte('levier').groupe` ne vaut rien et le filtre sur le groupe ne
   l'ecarte pas. Il faut le nommer. Une premiere version de cette fonction l'a
   oublie, et le test l'a rattrapee. */
/* Meme base et meme perimetre que `allocationByAccount()`, un cran au-dessus :
   les deux graphiques de la carte sont deux granularites d'un seul total, et
   deux bases differentes en auraient fait deux cartes qui se contredisent. */
function byAccountType({ financier = false } = {}) {
  const base = financier ? totalFinancier() : nowTotals().brut;
  const parType = new Map();
  for (const c of comptesOuverts()) {
    if (c.type === 'levier') continue;
    const v = financier ? valeurFinanciere(c) : valeurCompte(c);
    if (!v) continue;
    parType.set(c.type, (parType.get(c.type) || 0) + v);
  }
  return [...parType.entries()]
    .filter(([, value]) => Math.abs(value) > 0.005)
    .map(([type, value]) => ({
      label: trad(typeCompte(type).label),
      value, pct: base ? value / base * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/* Ou l'on en est, en euros. Le pourcentage n'est plus ici : « patrimoine sur
   cible » mesurait le chemin depuis zero, et un objectif de 30 000 pose a
   28 000 s'annoncait atteint a 93 % le jour meme. L'avancement vit dans
   `progressionObjectif()`, qui part du point de depart. */
function objectiveStatus() {
  const { total } = nowTotals();
  const obj = num(Store.state.meta.objective);
  return { total, obj, remaining: total - obj };
}

/* LE POINT DE DEPART D'UN OBJECTIF : une date, le patrimoine net ce jour-la, et
   d'ou vient ce chiffre (`creation` : l'objectif vient d'etre pose ; `releve` :
   un releve de cette date ; `jour` : la valeur du jour, choisie apres coup).

   Il se fige a la naissance de l'objectif et ne bouge plus : changer la cible ou
   l'annee ne le redefinit pas, sinon la barre repartirait de zero a chaque
   ajustement sans que personne l'ait demande. Il ne se change que par un geste
   qui le nomme. Retirer la cible retire l'objectif, et son depart avec lui.

   Un objectif pose avant que ce point existe n'en a pas, et il ne s'invente
   pas : ni zero, ni le 1er janvier. Sa barre attend qu'un depart soit choisi. */
function departObjectif() {
  const d = Store.state.meta?.objectifDepart;
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) || !Number.isFinite(Number(d.valeur))) return null;
  return { date: d.date, valeur: Number(d.valeur), source: d.source || 'jour', releve: d.releve || null };
}

function suivreCibleObjectif(avant, apres, jour = todayISO()) {
  const meta = Store.state.meta;
  if (!(num(apres) > 0)) { delete meta.objectifDepart; return; }
  if (!(num(avant) > 0)) {
    meta.objectifDepart = { date: jour, valeur: round2(nowTotals().total), source: 'creation' };
  }
}

function departsPossibles(jour = todayISO()) {
  const releves = (Store.state.monthly || [])
    .filter(r => !rowIsEmpty(r) && String(r.date) <= jour)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(r => ({ date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.clotureLe || '')) ? r.clotureLe : r.date,
                 valeur: round2(rowNet(r)), source: 'releve', releve: r.date }));
  return [{ date: jour, valeur: round2(nowTotals().total), source: 'jour', releve: null }, ...releves];
}

/* L'AVANCEMENT : (patrimoine actuel - depart) / (cible - depart).

   Cinq etats, parce que la formule ne vaut pas partout. Sans depart connu, il
   n'y a pas de chemin a mesurer (`inconnu`). Une cible deja atteinte au depart
   n'a pas de chemin non plus -- le diviseur est nul ou negatif, et le quotient
   ne voudrait rien dire (`atteinteAuDepart`). Sinon le pourcentage est vrai,
   meme negatif quand le patrimoine est passe sous son depart (`enBaisse`), et
   au-dela de cent quand la cible est depassee (`atteint`). La barre se borne
   entre zero et cent ; le chiffre, lui, ne se borne pas. */
function progressionObjectif(g = objectiveStatus(), d = departObjectif()) {
  if (!(num(g.obj) > 0)) return { etat: 'sansCible', pct: null, depart: null };
  if (!d) return { etat: 'inconnu', pct: null, depart: null };
  const chemin = num(g.obj) - d.valeur;
  if (!(chemin > 0.005)) return { etat: 'atteinteAuDepart', pct: null, depart: d, chemin };
  const ecart = num(g.total) - d.valeur;
  const parcouru = Math.abs(ecart) < 0.005 ? 0 : ecart;
  const pct = parcouru / chemin * 100;
  const etat = num(g.total) >= num(g.obj) ? 'atteint' : parcouru < 0 ? 'enBaisse' : 'enCours';
  return { etat, pct, depart: d, chemin, parcouru, barre: Math.min(100, Math.max(0, pct)) };
}

/*   Ce qu'elle faisait, pour memoire : le patrimoine du jour plus un nombre saisi
   a la main. Ni marches, ni epargne, ni charges — donc pas une projection, mais
   une addition. La vraie vit dans l'onglet Projection, avec ses hypotheses.

   `meta.expectedInflow` reste dans l'etat sans lecteur, comme `budget
   .supplements` : un export d'avant doit continuer de se relire. */

/* La variation sur douze mois glissants, et rien d'autre.

   « Depuis le 1er janvier » disait une chose differente en janvier et en
   decembre : en janvier elle mesurait trois semaines, en decembre onze mois. Un
   meme intitule pour une fenetre qui s'allonge toute l'annee ne se compare pas a
   lui-meme d'un mois sur l'autre, et c'est pourtant l'usage qu'on en fait. Douze
   mois glissants mesurent toujours douze mois.

   Le releve retenu est le plus proche de douze mois en arriere, avec une
   tolerance : au-dela de trois mois d'ecart, l'intitule mentirait. Un historique
   troue — un releve d'il y a un mois, le suivant d'il y a trente — n'a aucun
   point a douze mois, et « sur 1 an » y aurait qualifie une variation d'un mois.
   Ce cas retombe sur « depuis le debut », qui est vrai.

   Et rien ne s'invente : sans releve exploitable, la fonction rend `null` et la
   carte n'affiche pas de variation du tout. Un patrimoine sans historique n'a
   pas varie de zero, il n'a pas de variation connue. */
const TOLERANCE_AN = 3;                  // mois d'ecart admis autour de douze

/* LE POINT DE DEPART DU GRAND CHIFFRE QUAND IL DEFILE : le dernier releve
   enregistre, dans le perimetre du heros. Le `net` d'un releve face au net
   d'aujourd'hui, son `total` (les avoirs) face au brut : la meme inversion de
   mots que ci-dessous, et pour la meme raison. Le defilement raconte « depuis
   ton dernier releve », jamais « depuis zero » : un patrimoine qui monte de
   rien est une mise en scene, pas une mesure.

   `null` sans releve, ou quand il vaut zero : le montant s'affiche alors tel
   quel. Un net NEGATIF est une valeur connue, un achat recent finance a
   credit, et il sert de depart comme une autre. */
function departDefilementHeros(net = true) {
  let dernier = null;
  for (const p of historySeries({ includeNow: false })) {
    if (!dernier || String(p.date) > String(dernier.date)) dernier = p;
  }
  const v = dernier ? num(net ? dernier.net : dernier.total) : 0;
  return Number.isFinite(v) && Math.abs(v) > 0.005 ? v : null;
}

function variationAn(aujourdhui = todayISO(), net = true) {
  const pts = historySeries({ includeNow: false });
  if (!pts.length) return null;
  const enMois = iso => {
    const [a, m] = String(iso).split('-').map(Number);
    return a * 12 + m;
  };
  const maintenant = enMois(aujourdhui);
  const age = p => maintenant - enMois(p.date);
  const t = nowTotals();

  /* LA VARIATION MESURE LA GRANDEUR QUI EST AFFICHEE, pas une autre.

     Le bandeau bascule entre net et brut, et le chiffre du dessous ne suivait
     pas : il mesurait toujours le net. Les deux ne bougent pas ensemble des
     qu'un credit se rembourse — 50 000 EUR d'avoirs en plus et 10 000 EUR de
     capital rembourse font +50 000 au brut et +60 000 au net. Lire l'un sous
     l'autre, c'est attribuer aux actifs ce que le remboursement a fait.

     ATTENTION AU MOT `total`, QUI DESIGNE DEUX CHOSES. Sur un releve passe,
     `total` est la somme des avoirs et `net` en retranche les credits ; sur
     `nowTotals()`, c'est `brut` qui porte les avoirs et `total` qui vaut le
     net. Les deux paires sont ici cote a cote pour que l'inversion se voie.

     Aucune des deux valeurs ne se recalcule : elles viennent des memes sources
     que le grand chiffre et que la courbe. */
  const actuel = net ? t.total : t.brut;
  const avantDe = p => num(net ? p.net : p.total);

  let choisi = null;
  for (const p of pts) {
    if (Math.abs(age(p) - 12) > TOLERANCE_AN) continue;
    if (!choisi || Math.abs(age(p) - 12) < Math.abs(age(choisi) - 12)) choisi = p;
  }

  /* `mois` EST L'AGE REEL DU POINT RETENU, et c'est lui qui s'affiche.

     La tolerance admet neuf a quinze mois autour de douze : ecrire « 12 mois »
     sous une comparaison qui en couvre quinze serait le meme mensonge que
     l'ecrire sous quatre. Le repli sur le plus ancien releve n'a plus besoin
     d'un intitule a lui non plus — son age le dit.

     LE POURCENTAGE SE TAIT DES QUE SA BASE N'EN PORTE PAS UN. Base a zero :
     diviser rendrait l'infini. Base negative — un patrimoine net sous l'eau
     apres un achat a credit — : le rapport change de signe et un redressement
     s'afficherait en baisse. Le montant, lui, reste juste dans les deux cas et
     se suffit. */
  const depuisLe = (p, sur) => {
    const avant = avantDe(p);
    const eur = actuel - avant;
    return { eur, avant, pct: avant > 0 ? (eur / avant) * 100 : null,
             depuis: p.date, mois: age(p), sur };
  };
  if (choisi) return depuisLe(choisi, 'an');

  const premier = pts[0];
  if (age(premier) < 1) return null;
  return depuisLe(premier, 'debut');
}

/* --- LA SERIE DE LA FENETRE ANNUELLE ----------------------------------------

   ELLE NE CHOISIT RIEN. La fenetre a deja ete choisie par `variationAn()`, qui
   retient le releve le plus proche de douze mois dans sa tolerance et rend sa
   date. On la lui passe : deux selections cote a cote auraient fini par ne pas
   designer le meme releve, et la courbe aurait alors illustre une autre periode
   que le chiffre pose juste a cote.

   ET ELLE NE CALCULE RIEN. Les deux accesseurs sont mot pour mot ceux de
   `variationAn()` : `net` sur un releve passe, `total` de `nowTotals()` pour
   aujourd'hui — en se rappelant que le mot `total` designe le brut sur un
   releve et le net sur la photo du jour. Aucun mois n'est interpole, aucun trou
   n'est comble : ce sont les releves qui existent, et rien d'autre. */
function pointsAn(depuis, net = true) {
  if (!depuis) return [];
  const t = nowTotals();
  const pts = historySeries({ includeNow: false })
    .filter(p => String(p.date) >= String(depuis))
    /* L'ANNEE EN ENTIER, ET LE FORMATEUR QUI EXISTE DEJA POUR CA. Le ruban des
       releves abrege — « sept. 25 » — parce que ses colonnes sont etroites ;
       une bulle de deux lignes n'a pas cette contrainte, et « mars 26 » se lit
       moins bien que « mars 2026 » quand rien n'oblige a serrer. `fmtMoisAn()`
       est ecrit pour ce cas et sert deja aux echeances de credit : en poser un
       second ici aurait donne deux facons de nommer le meme mois. */
    .map(p => ({ valeur: num(net ? p.net : p.total), label: fmtMoisAn(p.date) }));
  pts.push({ valeur: num(net ? t.total : t.brut), label: trad('Auj.') });
  return pts;
}

const serieAn = (depuis, net = true) => pointsAn(depuis, net).map(p => p.valeur);

function deltas() {
  const pts = historySeries({ includeNow: false });
  const t = nowTotals();
  const last = pts[pts.length - 1];
  const firstOfYear = pts.find(p => p.date.startsWith(String(new Date().getFullYear()))) || pts[0];
  const first = pts[0];
  /* Comparer ce qui se compare. `t.total` est le patrimoine **net**, alors
     que `rowTotal()` rend le **brut** du mois : sans retrancher le capital
     restant du de ce mois-la, la variation vaudrait la dette entiere. Avec un
     pret immobilier de 200 000 EUR, « depuis le 1er janvier » annoncerait
     -195 000 EUR pour un patrimoine qui a monte de 5 000 EUR. L'ecart est
     invisible sans credit, ou brut et net coincident. */
  const d = (from) => {
    if (!from) return null;
    const base = num(from.net);
    /*       On rend donc `pct: null` dans ces cas, et l'affichage se contente de
       l'euro, qui reste exact. Trois situations : base nulle, base negative, et
       changement de signe entre les deux bornes. */
    const traverse = (base > 0 && t.total < 0) || (base < 0 && t.total > 0);
    const pct = (base > 0 && !traverse) ? (t.total / base - 1) * 100 : null;
    return { eur: t.total - base, pct, label: from.label };
  };
  return { month: d(last), ytd: d(firstOfYear), all: d(first) };
}

const B = () => Store.state.budget;

const revenuMensuel = r => auMois(r.amount, r);

const revenuEstime = () => (B().income || []).some(r => !!r.estime);

function incomeTotal() {
  return B().income.reduce((s, i) => s + revenuMensuel(i), 0);
}

const CHARGE_PERIODES = [
  ['semaine',  'hebdo',       12 / 52],
  ['mois',     'mensuel',     1],
  ['trimestre', 'trimestriel', 3],
  ['semestre', 'semestriel',  6],
  ['an',       'annuel',      12],
];
const CHARGE_MOIS_COUVERTS = Object.fromEntries(
  CHARGE_PERIODES.map(([cle, , mois]) => [cle, mois]));
const CHARGE_PERIODE_LABEL = Object.fromEntries(
  CHARGE_PERIODES.map(([cle, label]) => [cle, label]));

const chargePeriode = c => (c && CHARGE_MOIS_COUVERTS[c.period]) ? c.period : 'mois';
const auMois = (valeur, c) => num(valeur) / CHARGE_MOIS_COUVERTS[chargePeriode(c)];
const chargeMensuelle = c => auMois(c.amount, c);

/* --- la repartition theorique d'une charge, entre plusieurs personnes ----

   TROIS NOTIONS DISTINCTES, ET LES FONDRE EST LE DEFAUT DEJA COMMIS ICI.

     1. le MONTANT FACTURE : ce qui est debite du compte ;
     2. la PART THEORIQUE d'un autre : la repartition convenue entre vous ;
     3. la CONTRIBUTION REELLEMENT RECUE : une entree d'argent, saisie dans les
        revenus, la ou vivent le salaire et les autres rentrees.

   Le budget compte 1 et 3. Il ne compte JAMAIS 2. Retrancher la part theorique
   du total des charges, alors que la contribution arrive deja par les revenus,
   compterait la meme somme deux fois, en plus a l'entree et en moins a la
   sortie ; et les deux saisies, faites a deux endroits, ne s'accorderaient pas
   entre elles.

   Ces fonctions sont donc PUREMENT INFORMATIVES. Aucune n'est lue par
   `fixedTotal`, `budgetFrame`, `savingsReconciliation`, `suggestedMonthly`, ni
   par aucune carte de budget, ni par le cash-flow d'un bien. Un test l'exige, et
   il ne le lit pas dans la source : il compare des totaux avec et sans parts
   declarees, et ils doivent etre egaux au centime.

   `shares` reste la source unique de cette repartition : aucun champ parallele
   n'est cree, et rien ne se migre. */
const contributors = () => B().contributors || [];
const shareOf = (c, id) => num(((c && c.shares) || {})[id]);
const sharedOn = c => Object.values((c && c.shares) || {})
  .reduce((s, v) => s + num(v), 0);
const shareMensuelle = (c, id) => auMois(shareOf(c, id), c);

function partTheoriqueMensuelle(id) {
  return (B().fixedCharges || []).reduce((s, c) => s + shareMensuelle(c, id), 0);
}

/* Les trois montants d'un ecran de partage, tous mensuels.

   `resteTheorique` et non un nom de reste a charge : un tel nom laisserait
   entendre que le budget ne compte que le reliquat, ce qui serait le defaut
   meme. Le budget compte `total`, toujours. */
function sharedTotals() {
  const charges = B().fixedCharges || [];
  const total = charges.reduce((s, c) => s + chargeMensuelle(c), 0);
  const partage = charges.reduce((s, c) => s + auMois(sharedOn(c), c), 0);
  return {
    total, partage, resteTheorique: total - partage,
    parPersonne: contributors().map(g => ({
      id: g.id, nom: g.name, total: partTheoriqueMensuelle(g.id),
    })),
  };
}

/* --- ce qu'une part saisie doit respecter -------------------------------

   Meme forme que la regle des credits : la clef du champ fautif et sa phrase,
   ou `null`. Les fenetres nomment leurs champs `part_<id>`, la regle le sait, et
   les deux portes de saisie d'une charge l'appellent — une regle recopiee a deux
   endroits finit par diverger.

   Vide vaut zero, zero est une reponse, un negatif ne veut rien dire, et la
   somme des parts ne depasse pas ce qui est facture : au-dela, la repartition
   ne decrit plus la charge qu'elle pretend repartir.

   Elle ne change AUCUN calcul du budget : elle garde une saisie propre, voila
   tout. */
const CLE_PART = id => 'part_' + id;

function validerPartsSaisies(v, montant, ids) {
  let somme = 0;
  let premiere = null;
  for (const id of ids || []) {
    const saisi = (v || {})[CLE_PART(id)];
    if (!estDeclare(saisi)) continue;
    if (num(saisi) < 0) {
      return { cle: CLE_PART(id),
               message: trad('Une part théorique ne peut pas être négative.') };
    }
    if (premiere === null) premiere = id;
    somme += num(saisi);
  }
  if (premiere !== null && somme > num(montant) + 0.005) {
    return { cle: CLE_PART(premiere),
             message: trad('Les parts théoriques ne peuvent pas dépasser le montant facturé.') };
  }
  return null;
}

function ecrirePartsSaisies(charge, v, ids) {
  charge.shares = charge.shares || {};
  for (const id of ids || []) {
    const saisi = (v || {})[CLE_PART(id)];
    if (estDeclare(saisi)) charge.shares[id] = num(saisi);
    else delete charge.shares[id];
  }
  return charge;
}

/* --- declarer une personne, la renommer, la retirer ---------------------

   L'IDENTIFIANT SE DERIVE DU NOM, parce qu'il se lit : il vit dans le fichier et
   dans l'export, ou `shares: { camille: 800 }` se comprend d'un coup d'oeil la
   ou un compteur ne dit rien.

   Il doit etre unique contre DEUX listes, et la seconde n'est pas evidente : les
   personnes declarees, mais aussi tout identifiant qui traine encore dans les
   parts d'une charge. Sans elle, retirer quelqu'un en gardant ses parts puis
   redeclarer le meme nom redonnerait le meme identifiant, et ses anciennes parts
   ressusciteraient sans un mot — un montant qui revient tout seul est exactement
   ce que ce fichier traque. */
function identifiantPersonne(nom) {
  const base = String(nom || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'personne';
  const pris = new Set(contributors().map(g => g.id));
  for (const c of (B().fixedCharges || [])) {
    for (const id of Object.keys(c.shares || {})) pris.add(id);
  }
  if (!pris.has(base)) return base;
  let n = 2;
  while (pris.has(base + n)) n++;
  return base + n;
}

function partsDePersonne(id) {
  const lignes = (B().fixedCharges || []).filter(c => estDeclare((c.shares || {})[id]));
  return { lignes: lignes.length,
           mensuel: lignes.reduce((s, c) => s + shareMensuelle(c, id), 0) };
}

function retirerPersonne(id, { effacerParts = true } = {}) {
  const gens = B().contributors || [];
  const i = gens.findIndex(g => g.id === id);
  if (i < 0) return 0;
  gens.splice(i, 1);
  if (!effacerParts) return 0;
  let touchees = 0;
  for (const c of (B().fixedCharges || [])) {
    if (!c.shares || !(id in c.shares)) continue;
    delete c.shares[id];
    touchees++;
  }
  return touchees;
}

/* La date au format des cles, sans passer par l'UTC.

   `toISOString()` convertit en UTC : a Paris, une date construite a minuit local
   recule d'une ou deux heures et rend la veille pendant la moitie de l'annee.
   On lit donc les composantes locales, qui sont celles qu'on vient de poser. */
const isoDeDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  + `-${String(d.getDate()).padStart(2, '0')}`;

/* Ajouter des mois a une date sans la faire deborder.

   Le 31 janvier plus un mois n'est pas le 3 mars. `setMonth()` reporte le
   debordement sur le mois suivant en silence, et une charge trimestrielle
   partant d'un 31 derivait alors d'un jour a chaque saut. On borne au dernier
   jour du mois vise, ce que fait n'importe quel echeancier reel. */
function ajouterMois(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return null;
  const voulu = d.getDate();
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dernier = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(voulu, dernier));
  return r;
}

function prochaineEcheance(c, aujourdhui = todayISO()) {
  const depart = c && c.echeanceLe;
  if (!depart) return null;
  const jour = new Date(depart + 'T00:00:00');
  const cible = new Date(aujourdhui + 'T00:00:00');
  if (isNaN(jour) || isNaN(cible)) return null;
  if (jour >= cible) return depart;

  const per = chargePeriode(c);
  if (per === 'semaine') {
    const jours = Math.round((Date.UTC(cible.getFullYear(), cible.getMonth(), cible.getDate())
      - Date.UTC(jour.getFullYear(), jour.getMonth(), jour.getDate())) / 864e5);
    const d = new Date(jour);
    d.setDate(d.getDate() + Math.ceil(jours / 7) * 7);
    return isoDeDate(d);
  }
  const mois = CHARGE_MOIS_COUVERTS[per];
  const ecart = (cible.getFullYear() - jour.getFullYear()) * 12
              + (cible.getMonth() - jour.getMonth());
  let n = Math.max(0, Math.ceil(ecart / mois));
  let d = ajouterMois(depart, n * mois);
  if (d < cible) d = ajouterMois(depart, ++n * mois);
  return isoDeDate(d);
}

/* Le total des charges fixes du BUDGET : ce qui sort vraiment du compte.

   UN TOTAL « PERSONNEL » SERAIT UN DOUBLE COMPTAGE. Un prelevement de
   1 600 EUR sort du compte pour 1 600 EUR, meme si quelqu'un reverse la moitie
   separement. Retrancher cette moitie ici, alors qu'elle arrive deja par les
   revenus, la compterait deux fois : les entrees monteraient de ce qu'on recoit
   ET les sorties baisseraient d'autant, et le reste pour vivre serait surevalue
   de toute la part reversee.

   LA REGLE EST DONC : une charge fixe vaut ce qui est DEBITE. Ce que quelqu'un
   te reverse est une entree, saisie une fois, la ou vivent le salaire et les
   autres rentrees. Une entree de 800 EUR et une sortie de 1 600 EUR donnent
   deja le bon solde ; il n'y a rien a retrancher une seconde fois.

   LE PARTAGE A DONC QUITTE LES CALCULS ET L'ECRAN. Vivaient ici les
   contributeurs, la part de chacun sur une charge, ce qui restait a sa charge et
   les totaux de la page de partage. Deux endroits enregistraient le meme fait —
   la part sur la ligne et la contribution en revenu — et ils divergeaient. Un
   seul reste.

   `budget.contributors` et les `shares` de chaque charge NE SONT PAS EFFACES :
   personne ne peut savoir ce qu'ils voulaient dire, et une donnee qu'on ne sait
   pas relire ne se detruit pas. Plus rien ne les lit, voila tout. */
function fixedTotal() {
  return B().fixedCharges.reduce((s, c) => s + chargeMensuelle(c), 0);
}

function budgetFrame() {
  const income = incomeTotal();
  const fixed = fixedTotal();
  const available = income - fixed;
  const target = num(B().monthlyTarget);
  /* `null` et non zero quand il n'y a pas de revenu a diviser.

     « 0 % de tes revenus » sous 2 400 EUR de charges fixes se lit comme une
     mesure : il dit que ces charges ne pesent rien. C'est l'inverse — elles
     pesent tout, puisque rien n'entre. Zero est une reponse, et il ne doit
     jamais servir a dire l'absence de reponse : c'est la regle que ce fichier
     applique deja aux taux, aux quote-parts et aux poches d'Allocation.

     Les vues conditionnent leur affichage : aucune n'imprime « null % ». */
  return {
    income, fixed, available, target,
    fixedPct: income > 0 ? fixed / income * 100 : null,
    availablePct: income > 0 ? available / income * 100 : null,
    targetPct: income > 0 ? target / income * 100 : null,
    investTarget: available - target,
    investTargetPct: income > 0 ? (available - target) / income * 100 : null,
  };
}

function expenseRowTotal(row) {
  return expenseCategories().reduce((s, c) => s + num(row.v[c]), 0);
}

const VALEURS_CONNUES = {
  preteur: () => [
    ...(Store.state.etabs || []).flatMap(e => (e.dettes || []).map(d => d.preteur)),
    ...(Store.state.etabs || []).map(e => e.nom),
  ],
  organisme: () => (B().fixedCharges || []).map(c => c.provider),
  source: () => (B().income || []).map(r => r.label),
  posteBien: () => (B().fixedCharges || []).filter(c => c.bienId).map(c => c.label),
};

function valeursConnues(cle) {
  const vues = new Map();
  for (const v of (VALEURS_CONNUES[cle]?.() || [])) {
    const t = String(v || '').trim();
    if (t) vues.set(t.toLowerCase(), t);
  }
  return [...vues.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/* « 100+50+70 », « 12,50 + 8 » : la somme se tape dans le champ, ce qui evite
   d'ouvrir un panneau pour trois montants. Analyseur strict — pas d'`eval` sur
   une saisie — qui rend les termes autant que le total, puisque ce sont eux
   qu'on affichera ensuite en détail. Une saisie invalide ne rend rien, et le
   champ garde ce qu'il avait. */
function parseSomme(texte) {
  const brut = String(texte ?? '').trim();
  if (!brut) return { total: 0, termes: [] };
  if (!/^[\d\s+.,-]+$/.test(brut)) return null;
  const morceaux = brut.replace(/(\d)\s*([+-])/g, '$1\u0000$2').split('\u0000');
  const termes = [];
  for (const mc of morceaux) {
    const t = mc.replace(/\s+/g, '').replace(',', '.');
    if (!t) return null;
    const v = Number(t);
    if (!Number.isFinite(v)) return null;
    termes.push(round2(v));
  }
  return { total: round2(termes.reduce((s, v) => s + v, 0)), termes };
}

function expenseRowIsEmpty(row) {
  return expenseRowTotal(row) === 0;
}

function expenseSeries(year) {
  const all = !year || year === 'all';
  return B().expenses
    .filter(r => all || r.month.startsWith(String(year)))
    .map(r => ({
      month: r.month, label: fmtMonth(r.month), note: r.note,
      total: expenseRowTotal(r), v: r.v,
    }));
}

function expenseYears() {
  return [...new Set(B().expenses.map(r => r.month.slice(0, 4)))].sort();
}

/* De combien un mois depasse son objectif, en trois niveaux.

   Le graphique peignait en rouge tout mois au-dessus de l'objectif, sans
   graduation : sur huit mois, sept etaient rouges, et le rouge ne disait donc
   plus rien. Une couleur d'alerte qui s'allume presque toujours est une couleur
   decorative.

   Un tiers d'ecart est le seuil : en dessous, un mois se rattrape sur le
   suivant, c'est du bruit de la vie courante. Au-dela, il faut une decision.
   `SEUIL_DEPASSEMENT_GRAVE` le nomme pour que le graphique, le tableau et la
   liste ne puissent pas en avoir trois lectures.

   Rend 'sous', 'leger' ou 'grave'. Un mois vide n'a pas de niveau : rendre
   'sous' l'aurait compte comme une reussite alors que rien n'est saisi. */
const SEUIL_DEPASSEMENT_GRAVE = 0.5;
function niveauDepassement(total, objectif) {
  const t = num(total), o = num(objectif);
  if (!t) return null;
  if (!o || t <= o) return 'sous';
  return (t - o) / o >= SEUIL_DEPASSEMENT_GRAVE ? 'grave' : 'leger';
}

const CLASSE_DEPASSEMENT = { sous: 'up', leger: 'tiede', grave: 'down' };
const classeDepassement = (total, objectif) =>
  CLASSE_DEPASSEMENT[niveauDepassement(total, objectif)] || 'muted';

function expenseYearStats(year) {
  const rows = expenseSeries(year).filter(r => r.total > 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const target = num(B().monthlyTarget);

  /* Le mois en cours n'est pas fini : le compter dans la moyenne la fait
     plonger le 2 du mois, puis remonter jusqu'au 31. Un 3 du mois, huit mois
     dont un a 250 EUR donneraient 1 300 EUR de moyenne contre 1 450 EUR la
     veille, sans qu'aucune depense ait disparu.

     Il quitte donc tout ce qui compare des mois entre eux : la moyenne, le
     compte des mois sous et au-dessus de l'objectif, le meilleur et le pire.
     Il reste dans le `total` de l'annee, qui additionne ce qui a ete depense
     et n'a pas a mentir, et dans `months`, qui dit combien de mois portent
     une saisie. Si le mois courant est le seul renseigne, on le garde faute
     de mieux : une moyenne approximative vaut mieux que zero. */
  const enCours = currentMonthKey();
  const clos = rows.filter(r => r.month !== enCours);
  const base = clos.length ? clos : rows;

  const sousObjectif = base.filter(r => r.total <= target);
  const surObjectif = base.filter(r => r.total > target);

  return {
    year, months: rows.length, total,
    moisRetenus: base.length,
    moisEnCoursExclu: clos.length < rows.length && clos.length > 0,
    average: base.length ? base.reduce((s, r) => s + r.total, 0) / base.length : 0,
    sousObjectif, surObjectif,
    under: sousObjectif.length,
    over: surObjectif.length,
    best: base.reduce((a, r) => (!a || r.total < a.total) ? r : a, null),
    worst: base.reduce((a, r) => (!a || r.total > a.total) ? r : a, null),
  };
}

function expenseCategories() {
  const c = Store.state.budget.categories;
  return (Array.isArray(c) && c.length) ? c : EXPENSE_CATEGORIES;
}

/*    Deplace une categorie d'un cran. L'ordre de `budget.categories` EST l'ordre
   des colonnes du detail mensuel, de la fenetre de saisie, des graphiques et
   des exports : une seule liste, donc un seul geste pour tous ces ecrans.*/
/* --- LE LOYER QU'ON PAIE ENCORE ------------------------------------------

   Le jour ou l'on declare sa residence principale, le loyer d'avant reste dans
   les charges fixes. Rien ne l'y retient a tort — payer les deux pendant un
   preavis, des travaux ou un decalage de remise des cles est un cas reel et
   frequent — mais le budget additionne alors un loyer et une mensualite sans
   que personne ait tranche.

   LA DETECTION EST PRUDENTE, ET C'EST TOUT SON SUJET. Proposer de supprimer la
   mauvaise charge coute bien plus cher que ne rien proposer du tout : une
   absence de suggestion se corrige a la main, une suppression mal visee se
   decouvre un mois plus tard. Trois filtres, donc.

   LE MOT EN TETE, jamais n'importe ou dans le libelle. « Garantie loyers
   impayes » et « Assurance loyers impayes » sont des charges de proprietaire,
   et un `includes('loyer')` les proposerait. Le mot doit ouvrir le libelle et
   etre suivi de la fin de la chaine ou d'un separateur : « Loyer », « Loyer
   appartement », « Loyer - Paris » entrent, « Loyers impayes » et « Location »
   n'entrent pas. La casse et les accents sont normalises, comme partout
   ailleurs dans ce fichier.

   UN LIEN STRUCTUREL L'EMPORTE SUR LE LIBELLE. Une charge qui rembourse un
   credit est une mensualite, quel que soit son nom — c'est elle, justement, que
   la transition vient d'ajouter. Une charge rattachee a un bien est une charge
   de PROPRIETAIRE : taxe fonciere, copropriete, assurance. Ni l'une ni l'autre
   n'est un loyer qu'on paie.

   LE COUT PERSONNEL DECIDE. Un loyer de 1 500 EUR entierement verse par
   quelqu'un d'autre ne coute rien : il ne fait pas le double cout que cette
   etape cherche a prevenir, et deranger pour lui serait du bruit.

   Ce qui n'est PAS regarde : `budget.income`. Un revenu nomme « Loyer studio »
   est un loyer RECU, il n'a rien a voir avec ce qu'on paie. */
const DEBUT_LOYER = /^(loyer|monthly rent|rent)(?:[\s:,\-]|$)/;

const RENT_PROPRIETAIRE =
  /^(monthly )?rent[\s:,\-]+(guarantee|insurance|collection|management|protection|arrears)/;

function estLoyerProbable(c) {
  if (!c) return false;
  if (c.creditId) return false;          // une mensualite, pas un loyer
  if (c.bienId) return false;            // une charge de proprietaire
  const mot = String(c.label || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (RENT_PROPRIETAIRE.test(mot)) return false;
  return DEBUT_LOYER.test(mot);
}

function loyersCourantsProbables() {
  return (B().fixedCharges || [])
    .map((c, i) => ({ c, i, mensuel: chargeMensuelle(c) }))
    .filter(x => estLoyerProbable(x.c) && x.mensuel > 0.005);
}

/* Les charges fixes, de la plus lourde a la plus legere.

   IL Y AVAIT DEUX ORDRES, et un commutateur pour passer de l'un a l'autre : le
   rang du tableau, deplacable a la poignee, et un tri par montant calcule a
   l'affichage. Le tri reste, seul. Une liste de charges se lit pour savoir ce
   qui pese ; cette reponse-la ne depend d'aucun rangement personnel, et le
   commutateur demandait pourtant de choisir avant de lire.

   Le tri se fait sur l'equivalent MENSUEL, pas sur le montant saisi : une
   assurance a 600 EUR l'an pese 50 EUR par mois, et la ranger derriere un
   abonnement a 60 EUR mensuels dirait le contraire de ce que la colonne
   affiche juste a cote.

   Chaque entree garde `i`, son rang reel dans le tableau. La vue s'en sert pour
   ouvrir, modifier et supprimer : sans lui, trier par montant ferait porter un
   clic sur la ligne voisine, et le defaut ne se verrait qu'en supprimant la
   mauvaise charge. */
function chargesOrdonnees() {
  return (Store.state.budget.fixedCharges || [])
    .map((c, i) => ({ c, i }))
    .sort((a, b) => chargeMensuelle(b.c) - chargeMensuelle(a.c));
}

function deplacerCategorie(cat, delta) {
  if (!Array.isArray(Store.state.budget.categories) || !Store.state.budget.categories.length) {
    Store.state.budget.categories = [...expenseCategories()];
  }
  const arr = Store.state.budget.categories;
  const i = arr.indexOf(cat), j = i + (delta < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}

/* --- retirer une categorie, sans toucher au passe ----------------------

   Supprimer une categorie efface ses montants sur tous les mois :
   `removeExpenseCategory` le fait, et la confirmation le dit. C'est ce qu'il
   faut pour une colonne creee par erreur, et c'est exactement ce qu'il ne faut
   pas quand on a simplement cesse de depenser dans ce poste.

   Retirer est l'autre geste : la categorie quitte la saisie du mois, et ne
   quitte rien d'autre. Elle garde ses montants, ses colonnes dans le tableau,
   sa part dans les statistiques et dans les exports.

   Le point qui decide de tout : `expenseCategories()` n'est PAS filtree. Treize
   endroits la parcourent, dont le total d'un mois — `expenseRowTotal` somme
   `row.v[c]` pour chaque `c` de cette liste. En retirer une categorie qui porte
   encore de l'argent ferait baisser des totaux passes sans que rien ne le dise,
   et un total cesserait d'egaler la somme de ses parts. La liste des montants
   reste donc entiere, et c'est la saisie qui se restreint. */
const categorieRetiree = cat => (Store.state.budget.retirees || []).includes(cat);

function categoriesSaisie() {
  return expenseCategories().filter(c => !categorieRetiree(c));
}

function retirerCategorie(cat) {
  if (!expenseCategories().includes(cat) || categorieRetiree(cat)) return false;
  const b = Store.state.budget;
  b.retirees = b.retirees || [];
  b.retirees.push(cat);
  return true;
}

function reprendreCategorie(cat) {
  const b = Store.state.budget;
  if (!Array.isArray(b.retirees)) return false;
  const i = b.retirees.indexOf(cat);
  if (i < 0) return false;
  b.retirees.splice(i, 1);
  return true;
}

/* Ne pas detailler ses depenses, pour qui ne veut pas de neuf cases par mois.

   Aucun mecanisme nouveau, et c'est le point : `retirees` fait deja exactement
   ça, une categorie a la fois. Il manquait le geste d'un coup, et le nom qui dit
   ce qu'on fait. Un « total du mois » pose a cote de `v` aurait ete un second
   champ pour la meme valeur — treize endroits lisent `v`, dont `expenseRowTotal`,
   et le total aurait cesse d'egaler la somme de ses parts chez ceux-la.

   L'etat se derive, il ne se declare pas : ne rien detailler, c'est n'avoir plus
   qu'une case a remplir. Un drapeau `sansDistinction` aurait pu mentir des la
   premiere categorie reprise a la main.

   Le fourre-tout n'est pas « Autres ». Les deux mots se ressemblent et ne disent
   pas la meme chose : « Autres » est le reste, ce qui n'entrait pas ailleurs, et
   il porte deja des montants chez qui detaille. Le confondre avec « tout » ferait
   une serie qui change de sens au milieu de son historique.

   C'est une categorie ordinaire, sans garde ni statut : elle se renomme, elle se
   supprime, et quelqu'un qui prefere « Vie courante » a le droit. Un nom reserve
   aurait demande des exceptions dans le renommage et la suppression, pour un
   gain nul. */
const CATEGORIE_TOUT = 'Tout confondu';

/* Le nom de la categorie est une donnee : il part dans les cles de `v`, dans le
   tableau, dans les exports. Il ne se traduit donc jamais APRES coup -- traduire
   a l'affichage renommerait une colonne au changement de langue et le mois
   precedent porterait l'autre nom.
   Mais c'est l'application qui le cree, pas le detenteur : elle l'ecrit dans la
   langue en vigueur au moment du clic. Un anglophone recevait « Tout confondu ».
   La reconnaissance accepte les deux graphies, sinon changer de langue puis
   recliquer creerait une seconde case a cote de la premiere. */
const NOMS_TOUT = () => [CATEGORIE_TOUT, trad(CATEGORIE_TOUT)];

/* Les catégories sont-elles désactivées ? Deux états, pas trois.

   C'est LA source de vérité de Budget, et la seule : ou l'on répartit ses
   dépenses entre des catégories, ou l'on ne remplit qu'une case. Le choix se
   fait dans la saisie du mois, là où il a un sens, et l'affichage le suit.

   Une préférence d'affichage a été essayée à côté, `meta.budgetDetail`, avec
   deux crans en tête de page. C'était un second système pour une question déjà
   tranchée : rien ne garantissait que les deux s'accordent, et l'écran pouvait
   proposer de détailler ce que la saisie ne détaillait plus. Deux portes sur un
   même champ sont saines, deux champs pour la même valeur ne le sont pas.

   Ce que cet état ne touche pas : les montants. `retirerCategorie` n'efface
   rien, les mois passés gardent leur découpage, et l'export le porte toujours.
   L'affichage suit le choix courant, le stockage garde l'histoire. */
function sansDistinction() {
  return categoriesSaisie().length === 1;
}

/* Les mois d'une année qu'il y a lieu de montrer.

   Un mois à venir n'est pas un mois à zéro euro : il n'a pas eu lieu. Le
   calendrier ouvre les douze mois dès le premier lancement, donc le graphique
   annonçait « déc. 0 € » au mois d'août, et quatre barres plates se lisaient
   comme quatre mois sans dépenses.

   Une année passée garde ses douze mois : un mois vide y est un vrai zéro, et
   c'est une information. Une année à venir ne montre que ce qui est déjà saisi —
   quelqu'un peut préparer janvier en décembre, et cacher une saisie serait pire
   que montrer un vide.

   Les statistiques, elles, n'ont jamais eu besoin de cette fonction :
   `expenseYearStats` écarte déjà tout mois à zéro, et le mois en cours de ses
   comparaisons. */
function expenseSeriesVisible(year) {
  const s = expenseSeries(year);
  if (!year || year === 'all') return s;
  const encours = currentMonthKey();
  const an = String(year), anCourant = encours.slice(0, 4);
  if (an < anCourant) return s;
  if (an > anCourant) return s.filter(r => r.total);
  return s.filter(r => r.month <= encours || r.total);
}

/* Garde une seule case et retire les autres. Rend le nom de celle qui reste.

   Rien n'est efface : `retirerCategorie` ne touche a aucun montant, les mois
   passes gardent leur decoupage, et le tableau comme les exports continuent de
   le montrer. C'est la saisie du mois prochain qui se simplifie, pas l'histoire.

   Si une seule categorie est deja proposee, c'est elle qu'on garde : creer un
   fourre-tout a cote ferait deux cases la ou l'on en demandait une. */
function neePlusDetailler() {
  const proposees = categoriesSaisie();
  if (proposees.length === 1) return proposees[0];
  const nom = trad(CATEGORIE_TOUT);
  const garde = expenseCategories().find(c => NOMS_TOUT().includes(c))
    || addExpenseCategory(nom) || nom;
  reprendreCategorie(garde);
  for (const c of expenseCategories()) if (c !== garde) retirerCategorie(c);
  return garde;
}

function regrouperMois(ligne, garde) {
  const avant = { ...(ligne.v || {}) };
  const remplis = Object.keys(avant).filter(k => num(avant[k]));
  const total = round2(remplis.reduce((s, k) => s + num(avant[k]), 0));
  ligne.v = total ? { [garde]: total } : {};
  if (remplis.length > 1) ligne.avantRegroupement = { v: avant, total };
  else delete ligne.avantRegroupement;
  return total;
}

/* Rendre le decoupage garde, si et seulement si le total n'a pas bouge.

   Rend `true` quand il a ete rendu. Dans le cas contraire la memoire s'efface :
   elle ne decrit plus ce mois, et la garder ferait esperer un retour qui ne
   viendra pas. */
function defaireRegroupement(ligne) {
  const memoire = ligne && ligne.avantRegroupement;
  if (!memoire) return false;
  const total = Object.values(ligne.v || {}).reduce((s, x) => s + num(x), 0);
  delete ligne.avantRegroupement;
  if (Math.abs(total - num(memoire.total)) > 0.005) return false;
  ligne.v = memoire.v;
  return true;
}

function reprendreLeDetail() {
  const retirees = [...(Store.state.budget.retirees || [])];
  retirees.forEach(reprendreCategorie);
  let mois = 0;
  for (const ligne of (Store.state.budget.expenses || [])) {
    if (defaireRegroupement(ligne)) mois++;
  }
  return { categories: retirees.length, mois };
}

function addExpenseCategory(nom) {
  const propre = String(nom || '').trim();
  if (!propre) return null;
  const liste = Store.state.budget.categories;
  if (liste.some(c => c.toLowerCase() === propre.toLowerCase())) return null;  // pas de doublon
  liste.push(propre);
  return propre;
}

function renameExpenseCategory(ancien, nouveau) {
  const propre = String(nouveau || '').trim();
  const liste = Store.state.budget.categories;
  const i = liste.indexOf(ancien);
  if (i < 0 || !propre || propre === ancien) return false;
  if (liste.some(c => c.toLowerCase() === propre.toLowerCase())) return false;
  liste[i] = propre;
  for (const r of Store.state.budget.expenses) {
    if (r.v && r.v[ancien] !== undefined) { r.v[propre] = r.v[ancien]; delete r.v[ancien]; }
  }
  const ret = Store.state.budget.retirees;
  if (Array.isArray(ret)) {
    const j = ret.indexOf(ancien);
    if (j >= 0) ret[j] = propre;
  }
  return true;
}

function expenseCategoryTotal(cat) {
  return Store.state.budget.expenses.reduce((s, r) => s + num(r.v?.[cat]), 0);
}

function removeExpenseCategory(cat) {
  const liste = Store.state.budget.categories;
  const i = liste.indexOf(cat);
  if (i < 0) return false;
  liste.splice(i, 1);
  for (const r of Store.state.budget.expenses) if (r.v) delete r.v[cat];
  reprendreCategorie(cat);
  return true;
}

function expenseByCategory(year) {
  const rows = expenseSeries(year).filter(r => r.total > 0);
  const grand = rows.reduce((s, r) => s + r.total, 0);
  return expenseCategories()
    .map(c => {
      const value = rows.reduce((s, r) => s + num(r.v[c]), 0);
      return { label: c, value, pct: grand ? value / grand * 100 : 0,
               average: rows.length ? value / rows.length : 0 };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

function currentExpenseMonth() {
  const key = todayISO().slice(0, 7) + '-01';
  const exact = B().expenses.find(r => r.month === key);
  if (exact) {
    return { month: key, label: fmtMonth(key), total: expenseRowTotal(exact),
             note: exact.note, isCurrent: true };
  }
  const filled = expenseSeries().filter(r => r.total > 0);
  const last = filled[filled.length - 1];
  return last ? { ...last, isCurrent: false } : null;
}

function capitalRembourseParMois() {
  return ETABS().reduce((total, e) => total + (e.dettes || []).reduce((s, d) => {
    /* Le taux doit etre connu : sans lui on ne sait pas departager le capital
       des interets, et compter la mensualite entiere comme du remboursement
       gonflerait l'accumulation. L'echeancier, lui, rend `capitalDuMois: 0`
       quand la mensualite ne couvre pas les interets -- jamais de negatif. */
    const e2 = echeancierCredit(d);
    return s + (e2 && e2.capitalDuMois != null ? e2.capitalDuMois : 0);
  }, 0), 0);
}

/* Ce qu'il reste a payer, deduit et jamais saisi.

   Un tableau d'amortissement de banque tient en quatre grandeurs : capital
   emprunte, taux, nombre d'echeances, mensualite. Trois suffisent, la quatrieme
   s'en deduit. L'application declare le capital restant du, le taux et la
   mensualite — la duree se deduisait donc deja, sans etre affichee nulle part.
   Le commentaire de la fiche l'annoncait pourtant : « le taux sert a lire le
   contrat : date de fin, interets restants, part de capital ».

   Quatre champs saisissables pour trois faits seraient une faute : le jour ou ils
   se contredisent, aucun n'a raison. La duree se lit donc, elle ne s'ecrit pas.

   Rend `null` quand la mensualite ne couvre pas les interets : la dette ne
   s'eteint jamais, et annoncer une date de fin serait mentir. C'est le cas d'un
   levier de courtier, qui grossit tout seul. */
function resteAPayer(d) {
  const e = echeancierCredit(d);
  if (!e || !e.amortissable) return null;
  const { mois, fin, interets, assurance,
          capitalDuMois, interetsDuMois, assuranceDuMois } = e;
  return { mois, fin, interets, assurance,
           capitalDuMois, interetsDuMois, assuranceDuMois };
}

/* Deux grandeurs que rien ne separait, et elles ne veulent pas dire la meme
   chose.

   `investable` est le cash qui reste sur le compte : revenus moins charges
   fixes moins depenses. C'est lui, et lui seul, qu'on peut virer vers un
   compte-titres.

   `theoretical` y ajoute le capital rembourse sur les credits. Cette part
   augmente bien le patrimoine net — le bien ne bouge pas, la dette baisse — mais
   elle n'arrive sur aucun compte : elle est deja partie avec la mensualite. La
   confondre avec de l'epargne investissable faisait capitaliser a 6 % l'an un
   argent qui n'existe nulle part. Sur la demonstration, 645 EUR par mois.

   Les deux restent rendues : la croissance du patrimoine se lit avec le capital
   rembourse, le versement d'une projection sans lui. */
function savingsReconciliation() {
  const f = budgetFrame();
  const stats = expenseYearStats(todayISO().slice(0, 4));
  const spend = stats.average || f.target;
  /* Laquelle des deux, et non le montant seul. Le repli sur l'objectif est
     silencieux : sans un mot, l'ecran qui nomme le troisieme terme dit
     « depenses moyennes » alors qu'il affiche un objectif, et la formule
     annoncee cesse d'etre celle qui a servi. La fonction sait ; deviner depuis
     l'appelant en comparant `spend` a l'objectif serait ambigu le jour ou les
     deux sont egaux. Aucun calcul ne change : c'est la branche prise, dite. */
  const spendObserved = !!stats.average;
  const capital = capitalRembourseParMois();
  const investable = f.income - f.fixed - spend;
  const theoretical = investable + capital;

  const rythme = paceRecent();
  const monthsSpan = rythme.mois;
  const realPerMonth = rythme.count ? rythme.average : null;

  return {
    income: f.income, fixed: f.fixed, spend, spendObserved,
    capitalRembourse: capital,
    investable,
    theoretical,
    /* `null` et non zero : sans revenu, il n'y a pas de taux a mesurer, et
       « 0,0 % » se lirait comme un taux mesure a zero. */
    theoreticalRate: f.income > 0 ? theoretical / f.income * 100 : null,
    targetSaving: f.investTarget,
    realPerMonth, monthsSpan,
    gap: realPerMonth == null ? null : realPerMonth - theoretical,
  };
}

/* Le lendemain d'une date ISO, en local. Sert a borner un intervalle ouvert a
   gauche sans manipuler de fuseau : `new Date(iso)` puis +1 jour repasserait par
   UTC, et un 31 mars a Paris y devient un 30. */
function prochainJour(iso) {
  const d = new Date(String(iso) + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return isoLocal(d);
}

const STATUTS_LIGNE = {
  encours:   'En cours',
  retard:    'En retard',
  defaut:    'En défaut',
  rembourse: 'Remboursé',
};

function statutLigne(l) {
  return STATUTS_LIGNE[l.statut] ? l.statut : 'encours';
}

function echeances() {
  const out = [];
  for (const c of comptesOuverts()) {
    if (!typeCompte(c.type).prete) continue;
    (c.lignes || []).forEach((l, i) => {
      if (!l.echeance || l.marche) return;
      const st = statutLigne(l);
      if (st === 'rembourse') return;
      out.push({
        compteId: c.id, compte: nomCompteV2(c), etab: nomEtabDe(c), index: i,
        libelle: l.libelle || 'Placement', valeur: num(l.valeur),
        taux: num(l.taux) || null, echeance: l.echeance, statut: st,
        depassee: st === 'encours' && String(l.echeance) < todayISO(),
        jours: Math.round((new Date(String(l.echeance) + 'T12:00:00')
                         - new Date(todayISO() + 'T12:00:00')) / 86400000),
      });
    });
  }
  return out.sort((a, b) => String(a.echeance).localeCompare(String(b.echeance)));
}

function encoursAProbleme() {
  const l = echeances();
  return {
    retard: l.filter(x => x.statut === 'retard').reduce((s, x) => s + x.valeur, 0),
    defaut: l.filter(x => x.statut === 'defaut').reduce((s, x) => s + x.valeur, 0),
    depassees: l.filter(x => x.depassee),
  };
}

/* --- ce qu'un bien rapporte ---------------------------------------------
   L'application savait qu'un studio vaut 120 000 EUR et qu'il reste 96 000 EUR a
   rembourser. Elle ne savait pas ce qu'il rapporte — or un proprietaire ne vit pas
   sur la valeur de son bien, il vit sur le loyer moins la mensualite moins les
   charges. Un appartement a 150 000 EUR qui sort 120 EUR par mois et un autre qui
   en rentre 180 n'ont rien a voir, et l'ecran les affichait pareil.

   Les pieces existaient deja, mais separees : le loyer se declare en source de
   revenus, la taxe fonciere en charge fixe, la mensualite en credit. Rien ne les
   reliait au bien. C'est le meme chainon manquant que la charge fixe et le credit,
   resolu de la meme facon : un `bienId` sur une source de revenus et sur une
   charge, et le compte du bien devient le point de rassemblement.

   Le lien pointe le **compte** et non la ligne : un compte immobilier porte un
   bien dans le cas normal, la mensualite est deja rattachee a son etablissement,
   et c'est la fiche du compte qu'on ouvre pour regarder son bien.

   Le rendement se calcule sur le prix d'acquisition quand on le connait — c'est
   la convention, et c'est ce que la fiche annonce. A defaut, sur la valeur
   actuelle, en le disant : un rendement sur une estimation du jour n'est pas le
   meme chiffre, et le taire serait la faute que ce projet corrige sans arret.

   Trois manques rendaient tous les rendements trop beaux, et tous du meme cote :
   douze mois de loyer supposes pleins, aucun impot, et la periode du loyer
   ignoree. Un outil imprecis se trompe des deux cotes ; celui-la se trompait
   toujours du cote flatteur.

   La vacance et l'impot se **declarent**. L'application n'applique aucune regle
   fiscale : micro-foncier, reel, meuble, les regimes changent et le droit avec,
   et une application qui les devinerait mentirait un jour sans le savoir. Elle
   applique le taux que son detenteur annonce, sur une base qu'elle nomme. */
/* Les credits qui financent un bien donne.

   Une dette vit sur l'ETABLISSEMENT qui l'a consentie, et c'est juste : c'est la
   banque qui prete, pas le mur. Mais la fiche d'un bien lisait TOUTES les dettes
   de son etablissement, donc deux biens chez la meme banque se partageaient
   chaque credit : un parking de 20 000 EUR heritait des 180 000 EUR du credit de
   l'appartement, de sa mensualite et de son capital rembourse. Trois chiffres
   faux sur une fiche qui n'a jamais rien emprunte, et un cash-flow qui plonge
   sans raison.

   `d.bienId` porte donc le lien. Le motif existait deja dans cette base — une
   charge fixe porte `bienId`, un loyer aussi — il manquait au credit.

   Le repli, pour les etats d'avant la migration : un credit sans lien se
   rattache au bien de l'etablissement quand il n'y en a QU'UN. Ce n'est pas une
   supposition, c'est la seule lecture possible. Des qu'il y en a deux,
   l'ambiguite est reelle et rien ne se rattache — mieux vaut une fiche qui ne
   montre pas son credit qu'une fiche qui montre celui du voisin.

   Un lien qui pointe ailleurs n'entre jamais dans le repli : il est explicite,
   il a donc deja repondu. */
function creditsDuBien(compte) {
  if (!compte) return [];
  const dettes = etabById(compte.etabId)?.dettes || [];
  return dettes.filter(d => d.bienId ? d.bienId === compte.id
                                     : etabSansAmbiguite(compte.etabId, compte.id));
}

/* L'etablissement ne tient-il qu'un seul compte, et est-ce celui-la ?

   La question ne passe PAS par le type du compte. `typeCompte(id).bienImmo`
   semblait le bon filtre, mais un identifiant de type inconnu retombe sur un
   defaut generique qui ne porte pas le drapeau — et il suffit d'un type ecrit
   autrement pour qu'un bien cesse d'en etre un. Le nombre de comptes, lui, ne
   depend d'aucune table.

   Un seul compte chez ce preteur : ses credits ne peuvent financer que lui,
   quel que soit son type. Deux : on ne devine pas. */
function etabSansAmbiguite(etabId, compteId) {
  const miens = (Store.state.comptes || []).filter(c => c.etabId === etabId);
  return miens.length === 1 && miens[0].id === compteId;
}

function comptesDuPreteur(etabId) {
  return (Store.state.comptes || [])
    .filter(c => c.etabId === etabId)
    .map(c => [c.id, nomCompteV2(c)]);
}

/* Les credits dont le rattachement ne tient pas, et pourquoi.

   Trois defauts, et aucun ne se devine :

     `ambigu`    aucun lien, et l'etablissement tient plusieurs comptes. Le repli
                 ne peut pas trancher, donc aucune fiche ne montre ce credit.
     `mort`      le lien pointe vers un compte qui n'existe plus. Un bien
                 supprime laissait cette reference derriere lui.
     `ailleurs`  le lien pointe vers un compte d'un AUTRE etablissement. Deplacer
                 un compte de contenant suffit a le produire.

   Dans les trois cas la dette reste comptee dans le patrimoine net — c'est de
   l'argent qu'on doit, quel que soit l'etat du lien — mais elle n'est attribuee
   a aucun bien. La signaler vaut mieux que la ranger au hasard : un chiffre
   manquant se voit, un chiffre faux se croit. */
/* Delier la charge fixe qui remboursait un credit.

   Rien ne doit garder un `creditId` vers une dette disparue : la charge
   continuerait de vivre dans le budget en pretant sa mensualite a un credit qui
   n'existe plus, et `mensualiteCredit()` la lirait pour un fantome.

   Deux sorties, et c'est un choix qui appartient au detenteur : la charge part
   avec le credit — cet argent ne sort plus — ou elle reste et redevient une
   charge fixe ordinaire. Elle garde alors son montant, qui vivait deja chez
   elle : c'est le credit qui le lisait, jamais l'inverse. */
function delierChargeDuCredit(id, { retirer = false } = {}) {
  const lien = chargeDuCredit(id);
  if (!lien) return null;
  const nom = lien.charge.label || 'Charge fixe';
  if (retirer) B().fixedCharges.splice(lien.index, 1);
  else delete lien.charge.creditId;
  return nom;
}

/* Delier tout ce qui pointait vers un compte qu'on supprime.

   Les loyers et les charges restent : ce sont de vrais flux du budget, et les
   effacer changerait des totaux que personne n'a demande a changer. Ils
   redeviennent simplement independants. Ce qui ne peut pas rester, c'est le
   `bienId` : il designerait un compte disparu, et aucun ecran ne montrerait
   jamais l'incoherence. */
function delierDuBien(compteId) {
  let n = 0;
  for (const r of B().income) if (r.bienId === compteId) { delete r.bienId; n++; }
  for (const c of B().fixedCharges) if (c.bienId === compteId) { delete c.bienId; n++; }
  return n;
}

function rattacherCredit(d, bienId) {
  if (!d) return;
  d.bienId = bienId || null;
  const lien = chargeDuCredit(d.id);
  if (!lien || !lien.charge.bienId) return;
  if (bienId) lien.charge.bienId = bienId;
  else delete lien.charge.bienId;
}

function creditsAClarifier() {
  const dehors = [];
  for (const e of ETABS()) {
    const miens = (Store.state.comptes || []).filter(c => c.etabId === e.id);
    for (const d of (e.dettes || [])) {
      const cible = d.bienId ? compteById(d.bienId) : null;
      const quoi = !d.bienId ? (miens.length > 1 ? 'ambigu' : null)
                 : !cible ? 'mort'
                 : cible.etabId !== e.id ? 'ailleurs' : null;
      if (!quoi) continue;
      dehors.push({ etabId: e.id, etabNom: e.nom, id: d.id, quoi,
                    libelle: d.libelle || 'Crédit',
                    montant: num(d.montant), comptes: miens });
    }
  }
  return dehors;
}

/* --- la fiscalite du bien, et ce qu'on en sait --------------------------

   TROIS ETATS, jamais deux, et le troisieme n'est pas zero.

     DECLAREE   un montant annuel saisi. Le seul qui dise la verite : il sort
                d'une declaration, pas d'un modele. Zero compris, qui est la
                reponse juste d'un deficit foncier reporte.
     LEGACY     un taux saisi du temps ou le montant n'existait pas. Il
                s'applique comme avant -- au loyer moins les charges -- et
                l'ecran le nomme estimation simplifiee a confirmer. La donnee ne
                se migre JAMAIS : un taux n'est pas un montant, et le convertir
                tout seul ecrirait une declaration que personne n'a faite.
     INCONNUE   rien de saisi. Le mensuel vaut `null`, pas zero. « Zero euro
                d'impot » est une affirmation, et personne ne l'a faite ; ecrire
                zero ferait passer une donnee absente pour un calcul.

   Le taux legacy exige d'etre STRICTEMENT POSITIF. Le champ d'ou il vient
   affiche le vide pour un zero et ecrit le vide quand on l'efface : il n'a
   jamais su exprimer « zero pour cent », et lui preter ce sens aujourd'hui
   relirait autrement des donnees ecrites hier. Le montant annuel, lui, sait le
   dire — c'est la que « vide n'est pas zero » se joue.

   Un montant negatif ne se lit pas : ce serait un credit d'impot, que rien ici
   ne modelise. Il rend « inconnue » et non le taux d'a cote — une valeur qu'on
   ne sait pas lire ne se remplace pas par une autre.

   Cette fonction ne modelise aucun regime : ni micro-foncier, ni reel, ni LMNP,
   ni amortissement, ni prelevements sociaux. Elle porte ce qui est dit, et elle
   nomme ce qu'elle ignore. */
function fiscaliteBien(compte, baseMensuelle = null) {
  const rien = { source: 'inconnue', annuel: null, mensuel: null, taux: null };
  if (!compte) return rien;
  if (estDeclare(compte.fiscaliteEstimeeAnnuelle)) {
    const annuel = num(compte.fiscaliteEstimeeAnnuelle);
    return annuel < 0 ? rien
      : { source: 'declaree', annuel: round2(annuel),
          mensuel: round2(annuel / 12), taux: null };
  }
  const taux = estDeclare(compte.tauxImpot) ? Math.min(100, num(compte.tauxImpot)) : 0;
  if (taux <= 0) return rien;
  const base = baseMensuelle === null ? null : Math.max(0, num(baseMensuelle));
  const mensuel = base === null ? null : round2(base * taux / 100);
  return { source: 'legacy', taux, mensuel,
           annuel: mensuel === null ? null : round2(mensuel * 12) };
}

function cashFlowBien(compte) {
  if (!compte) return null;
  /* `revenuMensuel` et non le montant brut : la source porte sa periode, et un
     loyer saisi a l'annee valait douze fois trop ici pendant que le budget
     affichait le bon chiffre. Le meme libelle doit donner le meme montant sur
     tous les ecrans. */
  const sourcesLoyer = B().income
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.bienId === compte.id)
    .map(({ r, i }) => ({ i, label: r.label || trad('Loyer'), mensuel: revenuMensuel(r),
                          periode: chargePeriode(r), montant: num(r.amount), estime: !!r.estime }));
  const loyersPleins = sourcesLoyer.reduce((s, x) => s + x.mensuel, 0);
  const credits = creditsDuBien(compte);
  const rembourses = new Set(credits.map(d => d.id));
  const postesCharge = B().fixedCharges
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.bienId === compte.id && !rembourses.has(c.creditId))
    /* `mensuel` est l'equivalent MENSUEL de ce qui est debite, `montant` le
       montant tel qu'il est facture : le premier entre dans le cash-flow, le
       second se lit en sous-titre quand la periode n'est pas le mois. */
    .map(({ c, i }) => ({ i, label: c.label || trad('Charge fixe'),
                          mensuel: chargeMensuelle(c),
                          periode: chargePeriode(c), montant: num(c.amount) }));
  const charges = postesCharge.reduce((s, x) => s + x.mensuel, 0);
  const idxEtab = ETABS().findIndex(e => e.id === compte.etabId);
  const rangs = etabById(compte.etabId)?.dettes || [];
  const creditsListe = credits.map((d) => {
    const index = rangs.indexOf(d);
    const lien = chargeDuCredit(d.id);
    return { etabId: compte.etabId, idxEtab, index, id: d.id,
             libelle: d.libelle || trad('Crédit'), mensualite: mensualiteCredit(d),
             reste: num(d.montant), chargeIndex: lien ? lien.index : null };
  });
  const mensualite = credits.reduce((s, d) => s + mensualiteCredit(d), 0);
  const reste = credits.reduce((s, d) => s + num(d.montant), 0);
  /* `null` et non zero quand aucun taux n'est connu : sans taux on ne sait pas
     departager le capital des interets, et annoncer « zero de capital » sur une
     mensualite de 620 EUR serait faux dans l'autre sens. */
  /* `capitalDuMois != null` plutot que `num(d.taux)` : un pret declare a 0 %
     rembourse bien du capital, et le filtre par le taux l'ecartait. L'echeancier
     porte la regle -- sans taux DECLARE, il rend `null`. */
  const amortis = credits.filter(d => echeancierCredit(d)?.capitalDuMois != null);
  const capitalMois = amortis.length ? amortis.reduce((s, d) =>
    s + (echeancierCredit(d)?.capitalDuMois || 0), 0) : null;

  /* La ventilation du mois -- capital, interets, assurance -- et SON ETENDUE.

     Elle n'a de sens que si TOUS les credits du bien la donnent. Un credit sans
     taux declare ne dit ni son capital ni ses interets : sommer les autres et
     presenter le total comme la ventilation du mois annoncerait un cout hors
     capital plus petit que la verite, sans que rien ne le signale. La vue lit
     `ventilation` et se tait plutot que d'arrondir un silence a zero.

     `capitalMois` reste la somme de ce qui est CONNU, meme partielle : c'est un
     minorant vrai, et le taire ferait disparaitre du capital reellement
     rembourse. C'est son etendue qui se dit, pas sa valeur qui se corrige. */
  const interetsMois = amortis.length ? amortis.reduce((s, d) =>
    s + (echeancierCredit(d)?.interetsDuMois || 0), 0) : null;
  const assuranceMois = amortis.length
    ? amortis.reduce((s, d) => s + assuranceMensuelleCredit(d), 0) : null;
  const ventilation = !credits.length ? 'aucune'
    : amortis.length === credits.length ? 'complete'
    : amortis.length ? 'partielle' : 'aucune';

  const valeur = valeurCompte(compte);
  const achat = lignesDe(compte).reduce((s, l) => s + num(l.prixDeRevient), 0);
  const base = achat || valeur;
  const surAchat = achat > 0;

  const moisLoues = moisLouesDeclares(compte);
  const loyers = loyersPleins * moisLoues / 12;
  const vacance = moisLoues < 12;

  const fiscalite = fiscaliteBien(compte, Math.max(0, loyers - charges));
  const impot = fiscalite.mensuel;
  const tauxImpot = fiscalite.taux;

  /* DEUX cash-flows, parce qu'il y a deux questions. Celui d'avant la fiscalite
     existe toujours : il ne tient qu'a des montants saisis. Celui d'apres
     n'existe que si la fiscalite est connue — retirer zero d'un impot que
     personne n'a estime afficherait un « apres impot » jamais calcule.

     `cashFlow` reste le chiffre de tete, et c'est l'ecran qui dit lequel des
     deux il montre : apres fiscalite quand elle est connue, avant elle sinon.
     Le nombre ne change pas ; ce qui change est qu'il ne se fait plus passer
     pour un net d'impot. */
  const cashFlowAvantImpot = loyers - charges - mensualite;
  const cashFlowApresImpot = impot === null ? null : cashFlowAvantImpot - impot;
  const cashFlow = impot === null ? cashFlowAvantImpot : cashFlowApresImpot;
  const apport = apportDeclare(compte);
  return {
    loyers, loyersPleins, moisLoues, vacance, charges, mensualite, impot, tauxImpot,
    fiscalite, cashFlowAvantImpot, cashFlowApresImpot,
    reste, valeur, achat, base, surAchat, capitalMois,
    interetsMois, assuranceMois, ventilation,
    nbCredits: credits.length, nbVentiles: amortis.length,
    sourcesLoyer, postesCharge, creditsListe,
    vacanceEuros: loyersPleins - loyers,
    cashFlow,
    /* `null` et non zero quand la base manque. « 0,00 % » dit « le rendement
       est nul » ; sans valeur estimee ni prix paye, la verite est « on ne sait
       pas sur quoi le calculer ». Ecrire zero fait passer une donnee absente
       pour une mesure — un chiffre s'affiche, donc personne ne cherche.
       Un vrai zero reste possible : base connue, loyer nul. */
    rendementBrut: base > 0 ? loyers * 12 / base * 100 : null,
    rendementNet: base > 0 ? (loyers - charges) * 12 / base * 100 : null,
    rendementNetNet: (base > 0 && impot !== null)
      ? (loyers - charges - impot) * 12 / base * 100 : null,
    apport,
    sansApport: apport === 0,
    cashOnCash: apport > 0 ? cashFlow * 12 / apport * 100 : null,
  };
}

/* Ce qu'un bien fait sortir du compte chaque mois, et ce qui, dans cette sortie,
   ne se consomme pas.

   UNE SEULE PORTE POUR LES TROIS FICHES. Une residence principale, une residence
   secondaire et un bien loue posent la meme question de cout ; la calculer trois
   fois donnerait trois reponses le jour ou l'une des trois oublierait la regle du
   double comptage. Cette regle vit dans `cashFlowBien`, qui ecarte deja des
   charges celles qui remboursent un credit du bien : leur montant EST la
   mensualite, et la compter des deux cotes la ferait sortir deux fois du compte.

   `horsCapital` se calcule par SOUSTRACTION, et non en resommant interets,
   assurance et charges. Les deux donnent le meme nombre quand le pret s'amortit
   -- une mensualite est exactement capital + interets + assurance -- mais la
   soustraction garantit que les deux lignes affichees refont le total au centime,
   et elle reste vraie sur le pret dont la mensualite ne couvre meme pas ses
   interets, ou la somme des trois depasserait la mensualite.

   Et rien ici n'est un revenu : le capital rembourse reduit une dette, il ne
   rentre sur aucun compte. Il est rendu a part, jamais retranche du total. */
function coutBien(compte) {
  const cf = cashFlowBien(compte);
  if (!cf) return null;
  const totalSorties = cf.mensualite + cf.charges;
  const ventile = cf.ventilation === 'complete' && cf.capitalMois != null;
  return {
    mensualite: cf.mensualite, autresCharges: cf.charges, totalSorties,
    capitalMois: cf.capitalMois, interetsMois: cf.interetsMois,
    assuranceMois: cf.assuranceMois, ventilation: cf.ventilation,
    nbCredits: cf.nbCredits, nbVentiles: cf.nbVentiles,
    horsCapital: ventile ? totalSorties - cf.capitalMois : null,
  };
}

function financementIndicatif(compte) {
  if (!compte) return null;
  const credits = creditsDuBien(compte);
  if (credits.length) return null;
  const cout = acquisitionCompte(compte).total;
  /* `estDeclare` et non `> 0` : un apport declare a zero est un financement a
     cent pour cent, et « reste a financer : tout le cout » est alors la bonne
     reponse — pas un silence. */
  const apport = apportDeclare(compte);
  if (!(cout > 0) || apport === null) return null;
  return Math.max(0, round2(cout - apport));
}

/* Ce qui a paye l'acquisition, poste par poste — et non un verdict.

   La version d'avant rendait un booleen `coherent`, vrai tant que l'ecart tenait
   sous QUINZE POUR CENT DU PRIX. Un seuil de cette taille ne dit plus rien : sur
   un bien a trois cent mille euros il laisse passer quarante-cinq mille euros
   d'ecart sans un mot, c'est-a-dire tout ce qu'on voudrait justement voir. Et
   quand il criait, il ne disait pas sur quoi.

   Le detail remplace le verdict : le cout d'un cote, l'apport et le capital
   emprunte de l'autre, et l'ecart nomme. La tolerance qui reste n'absorbe que
   l'arrondi, un euro, parce qu'un centime d'ecart n'est pas une information.

   UN ECART N'EST PAS UNE ERREUR. Des frais payes autrement, un pret travaux, une
   aide familiale, des frais finances : toutes ces acquisitions sont normales et
   toutes laissent un ecart. La vue le dit doucement, et n'empeche rien.

   `null` tant qu'il manque une piece : un plan de financement dont on ignore
   l'apport n'a pas d'ecart, il a une inconnue. */
function planFinancement(compte) {
  if (!compte) return null;
  const acq = acquisitionCompte(compte);
  if (acq.total == null) return null;
  const apport = apportDeclare(compte);
  const credits = creditsDuBien(compte);
  /* `> 0` et non le seul `estDeclare` : zero est une declaration valide partout
     ailleurs, mais un capital EMPRUNTE nul n'est pas un montant de pret — c'est
     un champ qu'on a traverse. Le compter ferait apparaitre un ecart de la
     taille du cout, sur un credit dont on ignore simplement le montant initial.
     `progressionCredit` pose la meme borne, pour la meme raison. */
  const dits = credits.filter(d => estDeclare(d.initial) && num(d.initial) > 0);
  const emprunte = dits.reduce((s, d) => s + num(d.initial), 0);
  if (apport === null || !credits.length || dits.length !== credits.length) {
    return { cout: acq.total, apport, emprunte: dits.length ? round2(emprunte) : null,
             finance: null, ecart: null, complet: false,
             manque: apport === null ? 'apport' : 'capital' };
  }
  const finance = apport + emprunte;
  return { cout: acq.total, apport, emprunte: round2(emprunte),
           finance: round2(finance), ecart: round2(finance - acq.total),
           complet: true, manque: null };
}

const ecartAExpliquer = plan => plan?.complet && Math.abs(plan.ecart) > 1;

const PREMIERS_PAS = [
  { cle: 'comptes', titre: 'Tes comptes et avoirs divers',
    quoi: 'Chaque poche est un compte : dans une même banque, un compte courant, '
        + 'un PEA et un livret en font trois. C’est d’eux que viennent ton '
        + 'patrimoine, ta répartition et ton autonomie.',
    /* `aUnComptePropre` et non le simple compte des comptes : celui des especes
       est pose par le modele pour tout le monde, et un compte que personne n'a
       cree ne peut pas tenir lieu de premier pas. */
    bouton: 'Entrer tes comptes', action: 'ajouter-compte',
    /* UN COMPTE N'EST PAS TOUS LES COMPTES. `fait` ne bouge pas : il repond a
       « faut-il encore reclamer un PREMIER compte ? », et les invites des
       autres ecrans s'en servent pour se taire des qu'il y en a un. Les
       confondre ferait reapparaitre « Ajoute un compte pour commencer » sur une
       application qui en porte deja cinq. */
    declare: { cle: CLE_INVENTAIRE,
      question: 'As-tu enregistré tous tes comptes et avoirs ?',
      detail: 'Banques, livrets, comptes de courtage, biens et crédits : ton patrimoine n’est juste que s’ils y sont tous.',
      oui: 'Oui, je les ai tous',
      ajouter: 'Ajouter un compte',
      voir: { vue: 'accounts', libelle: 'Voir mes comptes' } },
    fait: () => aUnComptePropre() },
  { cle: 'revenus', titre: 'Ton salaire et tes rentrées d’argent',
    quoi: 'Déclare ton salaire net et tes autres rentrées : c’est d’elles que partent ta capacité d’épargne, ton budget et ce qu’il te reste à vivre.',
    bouton: 'Entrer ton salaire net', action: 'toggle-revenus',
    declare: { cle: CLE_RENTREES,
      question: 'As-tu enregistré toutes tes rentrées d’argent ?',
      detail: 'Salaire, primes, loyers perçus, pensions : ton budget se calcule sur leur somme.',
      oui: 'Oui, tout y est',
      ajouter: 'Ajouter une rentrée',
      voir: { action: 'toggle-revenus', libelle: 'Voir mes rentrées' } },
    fait: () => (B().income || []).length > 0 },
  /* Le releve arrive apres les comptes, et il n'est « a faire » que lorsqu'il
     devient faisable : sans un compte, il n'y a rien a photographier, et
     l'annoncer serait envoyer quelqu'un vers un geste impossible. Les cartes qui
     dependent d'une serie — l'evolution, le rythme — n'ont que lui a demander.

     `aUnRelevePatrimonial` et non `aDejaServi` : la seconde repond « oui » des le
     premier mois de depenses saisi, et ce pas se declarait franchi par quelqu'un
     qui avait rempli son budget sans jamais photographier ses comptes. Des
     depenses ne sont pas un releve, et elles ne l'ont jamais ete.

     UN SEUL releve suffit, et le texte dit pourquoi il en faudra deux : une
     pente demande deux points. Reclamer le second bloquerait le premier pas sur
     un geste qui ne se fait qu'un mois plus tard. */
  { cle: 'releves', titre: 'Ton premier relevé',
    quoi: 'Enregistre ton premier relevé mensuel : la photo de tes comptes à une date, '
        + 'toutes tes poches additionnées en un patrimoine total. Refais-le chaque mois, '
        + 'il en faut deux pour une pente, et Longward trace ton évolution.',
    bouton: 'Enregistrer ton premier relevé', action: 'ajouter-releve',
    /* DEUX QUESTIONS, ET ELLES DIFFERENT SUR CE PAS-LA.

       `fait` repond a « faut-il encore le reclamer ? », et sans compte la
       reponse est non : il n'y a rien a photographier, et l'invite se tait.
       `acquis` repond a « est-il franchi ? », et la reponse est non aussi —
       personne n'a pris de releve.

       La liste de demarrage pose la SECONDE : avec la premiere, elle cochait
       « Ton premier releve » sur une application vide, juste au-dessus de
       « Tes comptes » qui restait a faire. On ne photographie pas des comptes
       qu'on n'a pas, et l'annoncer fait douter du reste. */
    acquis: () => aUnRelevePatrimonial(),
    ouvrable: () => aUnComptePropre(),
    fait: () => !aUnComptePropre() || aUnRelevePatrimonial() },
  { cle: 'depenses', titre: 'Tes charges fixes',
    quoi: 'Ajoute tes loyers, assurances et abonnements : ce sont eux qui décident '
        + 'de ce qu’il te reste à vivre chaque mois.',
    bouton: 'Entrer tes charges fixes', action: 'add-charge',
    declare: { cle: CLE_CHARGES,
      question: 'As-tu enregistré toutes tes charges fixes ?',
      detail: 'Loyer, assurances, abonnements, mensualités de crédit : ce qui part tous les mois sans que tu y penses.',
      oui: 'Oui, tout y est',
      ajouter: 'Ajouter une charge',
      voir: { vue: 'budget-cadre', libelle: 'Voir mes charges fixes' } },
    fait: () => (B().fixedCharges || []).length > 0 || aDesDepensesSaisies() },
];
const PAS_PAR_CLE = Object.fromEntries(PREMIERS_PAS.map(p => [p.cle, p]));

const pasAFaire = cle => !!PAS_PAR_CLE[cle] && !PAS_PAR_CLE[cle].fait();

function etapesDemarrage() {
  const franchi = p => p.acquis ? p.acquis() : (!pasAFaire(p.cle) && pasDeclare(p));
  const restants = PREMIERS_PAS.filter(p => !franchi(p));
  const prochain = restants.find(p => !p.ouvrable || p.ouvrable()) || restants[0] || null;
  return { total: PREMIERS_PAS.length, faits: PREMIERS_PAS.length - restants.length,
           restants, prochain, vierge: !aUnComptePropre(), fini: !restants.length };
}
const MOTS_COURTS_PAS = { comptes: 'Comptes et patrimoine', revenus: 'Revenus', releves: 'Relevé mensuel', depenses: 'Charges fixes' };
const motCourtPas = p => trad(MOTS_COURTS_PAS[p.cle] || p.titre);
const motProchainPas = p => (p.cle === 'comptes' && aUnComptePropre())
  ? trad('Confirmer tes comptes') : motCourtPas(p);

/* --- ce qu'un bien coute, poste par poste --------------------------------
   La taxe fonciere est due par tout proprietaire, la copropriete par qui detient
   un lot, et la provision pour travaux est celle que tout le monde oublie — or
   c'est elle qui decide du vrai rendement. Les proposer evite la page blanche
   d'un champ « Poste » vide, sans rien imposer : un `datalist` suggere, il ne
   ferme pas la liste.

   Une liste par usage, parce que l'assurance ne porte pas le meme nom selon
   qu'on habite ou qu'on loue : proposer « proprietaire non occupant » a qui vit
   dans son logement serait du bruit. Ce qui vaut pour tous vient d'abord, dans
   l'ordre ou on y pense.

   La periode accompagne le poste : une taxe fonciere se paie a l'annee, des
   frais de gestion au mois. Le premier poste donne la periode par defaut de la
   fenetre, et c'est pour ca que la taxe fonciere ouvre la liste. */
const CHARGES_BIEN = {
  '':           [['Taxe foncière', 'an'], ['Provision pour travaux', 'an'],
                 ['Entretien et réparations', 'an']],
  locative:     [['Charges de copropriété non récupérables', 'trimestre'],
                 ['Assurance propriétaire non occupant', 'an'],
                 ['Frais de gestion locative', 'mois'],
                 ['Garantie loyers impayés', 'an'],
                 ['Autres charges propriétaire', 'an']],
  principale:   [['Charges de copropriété', 'trimestre'],
                 ['Assurance habitation', 'an'],
                 ['Autres charges du logement', 'an']],
  secondaire:   [['Charges de copropriété', 'trimestre'],
                 ['Assurance habitation', 'an'], ['Taxe d’habitation', 'an'],
                 ['Autres charges du bien', 'an']],
};

/* Les frais d'un placement immobilier — et rien d'un logement.

   DEUX MONDES, DEUX LISTES. Une SCPI n'a ni taxe fonciere, ni charges de
   copropriete, ni provision pour travaux : proposer ces postes a son detenteur
   l'invite a saisir des charges qui n'existent pas chez lui, et la gerance les
   porte deja dans ce qu'elle distribue. Les saisir une seconde fois amputerait
   le rendement de charges payees par quelqu'un d'autre.

   Une liste separee plutot qu'une entree de plus dans `CHARGES_BIEN` : cette
   table est indexee par l'usage residentiel, une notion que la pierre papier
   n'a pas. L'y faire entrer melangerait justement les deux mondes que la
   frontiere du modele separe. */
const FRAIS_PIERRE_PAPIER = [
  ['Frais de gestion', 'an'], ['Frais de plateforme', 'an'],
  ['Frais de financement', 'mois'], ['Autres frais', 'an'],
];

function chargesProposees(compte) {
  /* La meme frontiere que partout ailleurs : `bienImmo` sans `direct`. Un
     contexte, une liste — et aucune ne connait les postes de l'autre. */
  if (!estBienEnDirect(compte)) return FRAIS_PIERRE_PAPIER;
  /* `usage &&` : sans lui, un bien dont l'usage est inconnu lisait
     `CHARGES_BIEN['']`, qui est justement le socle commun — les trois memes
     charges etaient donc proposees deux fois dans la meme liste. Un usage
     inconnu ne recoit que le generique, et une seule fois. */
  const usage = usageBien(compte);
  const propres = (usage && CHARGES_BIEN[usage]) || [];
  return [...CHARGES_BIEN[''], ...propres];
}

function comptesBiens() {
  return comptesOuverts().filter(c => typeCompte(c.type).bienImmo);
}

/* --- les rentrees exceptionnelles ---------------------------------------
   Un heritage, une prime, la vente d'une voiture : de l'argent qui entre une
   fois. Il n'avait aucun endroit, et les trois qu'on pouvait croire bons etaient
   faux. Les sources de revenus sont mensuelles — 10 000 EUR y auraient valu
   10 000 EUR par mois, a vie. « Rentree exceptionnelle », dans « Mois a venir »,
   est une prevision : un seul nombre, ecrase a chaque saisie, sans date. Et
   monter le solde d'un compte marche pour le patrimoine mais ne dit pas d'ou
   vient l'argent, si bien que « Rythme d'accumulation » compte l'heritage comme
   de l'epargne.

   Ce dernier point est le vrai sujet : un apport n'est pas de l'epargne. Sans la
   distinction, la moyenne mensuelle bondit et la projection promet un rythme que
   le budget ne peut pas tenir. Le journal existe donc d'abord pour que le rythme
   puisse dire « dont tant d'apports exterieurs ».

   `budget.supplements` n'est pas recycle, bien qu'il traine vide dans l'etat : un
   champ qui a deja voulu dire autre chose — des « complements alimentaires »,
   puis des « autres depenses » — est un piege pour la migration. */
const APPORTS = () => (B().apports = B().apports || []);

function apportsTries() {
  return [...APPORTS()]
    .map((a, i) => ({ ...a, index: i, montant: num(a.montant) }))
    .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
}

function apportsDetail(debut = null, fin = null) {
  let entrees = 0, sorties = 0;
  for (const a of APPORTS()) {
    const d = String(a.date || '');
    if (debut && d < debut) continue;
    if (fin && d > fin) continue;
    const m = num(a.montant);
    if (m < 0) sorties += m; else entrees += m;
  }
  return { entrees, sorties, net: entrees + sorties };
}

function apportsTotal(debut = null, fin = null) {
  return apportsDetail(debut, fin).net;
}

/* --- CE QUI A CHANGE ENTRE DEUX RELEVES -----------------------------------

   UNE DIFFERENCE, ET RIEN D'AUTRE. Deux photos, poche par poche, et l'ecart
   entre les deux. Ce n'est ni un rendement ni un apport : un versement
   programme, une hausse des cours et un arbitrage entre deux comptes font
   bouger une poche de la meme facon, et un releve ne dit pas lequel a eu lieu.
   Aucun prix de revient historique n'est lu, aucun flux n'est reconstruit.

   LA SOMME TIENT PAR CONSTRUCTION. Le net d'un releve vaut la somme de ses
   poches moins sa dette, donc l'ecart de net vaut la somme des ecarts de poches
   moins l'ecart de dette. Rien ne reste a attribuer, et un test l'exige.

   LES EVENEMENTS VIENNENT DU JOURNAL, ET DE LUI SEUL. Une entree ou une sortie
   exceptionnelle y est ecrite avec sa date : elle se montre parce qu'elle
   existe. Elle n'est rangee dans aucune poche -- le journal ne dit pas quel
   compte elle a touche -- et elle ne se deduit jamais d'un ecart de solde.
   L'intervalle est celui du rythme : le jour du releve d'avant est exclu, ce
   qui est entre ce jour-la etait deja dans son solde.

   Les deux arguments sont des points de `pointDuReleve()`. */
function variationPatrimoine(avant, apres) {
  if (!avant || !apres) return null;
  const changesByPocket = POCHES_EVOLUTION
    .map(k => ({ pocket: k, previousValue: round2(num(avant[k])), currentValue: round2(num(apres[k])),
                 delta: round2(num(apres[k]) - num(avant[k])) }))
    .filter(x => x.previousValue || x.currentValue);
  const debut = prochainJour(avant.date), fin = String(apres.date);
  const dansIntervalle = d => String(d || '') >= debut && String(d || '') <= fin;
  const explicitEvents = [
    ...apportsTries()
      .filter(a => a.montant && dansIntervalle(a.date))
      .map(a => ({ genre: 'apport', libelle: a.libelle || '', date: a.date, montant: round2(a.montant) })),
    ...(Store.state.sales || [])
      .filter(v => perimetreDeVente(v) === 'sortie' && num(v.gross) && dansIntervalle(v.date))
      .map(v => ({ genre: 'sortie', libelle: v.name || '', date: v.date,
                   montant: -round2(num(v.sortie) || num(v.gross)) })),
  ];
  return {
    depuis: avant.date, jusqua: apres.date, mois: moisEntre(avant.date, apres.date),
    previousNet: round2(num(avant.net)), currentNet: round2(num(apres.net)),
    totalChange: round2(num(apres.net) - num(avant.net)),
    changesByPocket,
    previousDebt: round2(num(avant.dettes)), currentDebt: round2(num(apres.dettes)),
    debtChange: round2(num(apres.dettes) - num(avant.dettes)),
    explicitEvents,
  };
}

/* Le releve d'un mois compare a celui d'avant, avec la definition du journal
   et de la fiche du mois : le dernier mois RENSEIGNE, pas la ligne du dessus.
   `null` pour le premier releve de la serie, qui n'a rien a quoi se comparer. */
function variationDuReleve(index) {
  const lignes = Store.state.monthly || [];
  const r = lignes[index];
  if (!r || rowIsEmpty(r)) return null;
  const avant = lignes.slice(0, index).filter(x => !rowIsEmpty(x)).pop();
  return avant ? variationPatrimoine(pointDuReleve(avant), pointDuReleve(r)) : null;
}

/* Les deux derniers releves, ou `null` s'il n'y en a pas deux. Jamais le
   dernier releve face a « aujourd'hui » : un releve range le cash qui attend
   dans un compte-titres avec ses titres quand la photo du jour le compte en
   liquidites, et la comparaison inventerait un arbitrage qui n'a pas eu lieu. */
function derniereVariation() {
  const lignes = Store.state.monthly || [];
  for (let i = lignes.length - 1; i >= 0; i--) {
    if (rowIsEmpty(lignes[i])) continue;
    const v = variationDuReleve(i);
    /* `index` : la carte ouvre la fiche de ce mois-la. */
    return v ? { ...v, index: i } : null;
  }
  return null;
}

/* --- autres depenses : retire -------------------------------------------
   AUTRES_PERIODES, autreMensuelle() et supplementsTotal() vivaient ici pour
   une carte « Autres depenses » qui ne comptait ni dans les charges fixes ni
   dans le budget. Un memo chiffre a tenir a jour pour ne rien calculer : la
   carte est partie, et ces trois-la avec elle.

   Le champ `budget.supplements` reste dans l'etat, et la migration qui
   normalise ses anciennes lignes reste en place plus haut : retirer un ecran
   ne doit pas emporter ce que quelqu'un y avait saisi, et un export d'avant
   doit continuer de se relire. Ce qui s'y trouvait se saisit desormais dans
   les depenses du mois, ou ces euros comptent pour de vrai. */

partieChargee('assets/store-04-calculs-2.js');
