/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

function posValue(p) {
  return p.manual ? num(p.value) : num(p.qty) * num(p.price) * num(p.fx || 1);
}
/* Le taux auquel convertir le prix de revient d'une ligne : celui du jour, pour
   les deux jambes.

   Il s'est fige au jour de l'achat pendant longtemps, par `fxBuy`, et le
   raisonnement se tenait : sans ca, le montant investi bougerait a chaque
   variation de l'EUR/USD, et la plus-value d'une ligne qu'on n'a pas touchee
   changerait toute seule.

   Ce qui le fait tomber : une ligne se construit souvent en plusieurs achats, a
   des dates et donc a des taux differents. Il n'y a pas UN taux d'achat a geler,
   et un `fxBuy` unique n'est donc pas une approximation mais un chiffre
   arbitraire presente comme une date.

   Pire, il ne se figeait meme pas a un achat : `quotes.js` le posait au PREMIER
   RAFRAICHISSEMENT des cours de la ligne. Deux titres achetes a des mois d'ecart
   portaient le meme taux, celui du jour ou l'application les a vus pour la
   premiere fois. L'ecart de change affiche mesurait le temps ecoule depuis
   l'installation de l'app, pas une detention.

   Les deux jambes au taux du jour, donc — la convention du courtier. La
   plus-value en euros devient « ce que cette ligne a gagne ou perdu, exprime en
   euros d'aujourd'hui », et elle coincide avec ce que le courtier affiche. Le patrimoine
   ne bouge pas d'un centime : il a toujours ete calcule au taux du jour.

   Ce qu'on perd est reel et assume : l'application ne dit plus combien d'euros
   sont reellement sortis du compte. Elle ne le savait pas — elle le devinait.
   Le dire vraiment demanderait un taux par achat, donc un carnet de lots, et ce
   n'est pas ce projet.

   Une ligne en euros vaut 1 sans discussion : c'est sa devise qui le dit. */
function tauxAchat(p) {
  if ((p.currency || deviseBase()) === deviseBase()) return 1;
  return num(p.fx) || 1;
}
function posInvested(p) {
  if (p.manual) return num(p.invested);
  return num(p.qty) * num(p.buyPrice) * tauxAchat(p);
}
/* La base est la valeur absolue du prix de revient.

   C'est la regle de la maison, deja posee dans `deltas()` : un pourcentage
   n'existe que sur une base positive. Ici la base a un sens — ce qu'on a encaisse
   — donc on la redresse au lieu de se taire, et le signe vient de l'euro.

   Rien ne change pour une position longue : `perf / inv` vaut exactement
   `value / inv - 1` quand `inv` est positif. Seul le short est corrige.

   Une base NULLE, elle, ne se redresse pas : il n'y a rien a redresser. Zero
   n'est pas une base, c'est une absence. */
function posPerfPct(p) {
  const inv = posInvested(p);
  return inv === 0 ? null : posPerfEur(p) / Math.abs(inv) * 100;
}
/* Et l'euro se tait avec lui.

   `posValue - 0` rend la valeur entiere de la ligne. Un titre a 520 EUR sans
   prix de revient saisi s'affichait donc en « +520 EUR de plus-value », soit
   pres de la moitie du resultat annonce pour tout le portefeuille, avec un
   « +0,0 % » a cote qui venait de la fonction du dessus. Un pourcentage muet et
   un euro bavard sur le meme fait ne peuvent pas etre justes tous les deux. */
function posPerfEur(p) {
  const inv = posInvested(p);
  return inv === 0 ? null : posValue(p) - inv;
}

/* Le cours retenu date-t-il d'aujourd'hui ?

   `quoteTime` est l'heure de la derniere transaction reguliere, telle que la
   place la publie. Comparee au jour local, elle dit si une seance a eu lieu
   depuis minuit — ce qui est faux tous les matins avant l'ouverture, et tout le
   week-end.

   Sans cette heure, on ne peut rien affirmer : Stooq ne la donne pas. On garde
   alors l'ecart, faute de pouvoir prouver qu'il est perime. */
function coteAujourdhui(p) {
  const t = num(p.quoteTime);
  if (t) return isoLocal(new Date(t * 1000)) === todayISO();
  const etat = marketStatus(p);
  return etat ? etat.cle !== 'close' : true;
}

function acheteAujourdhui(p) {
  return !!p?.dateAchat && p.dateAchat === todayISO() && posInvested(p) > 0;
}

function posDayChange(p) {
  const prev = num(p.prevClose);
  if (p.manual || !num(p.price)) return null;

  if (acheteAujourdhui(p)) {
    return { pct: posPerfPct(p), eur: posPerfEur(p), prev: prev || null,
             price: num(p.price), depuisAchat: true };
  }

  if (!prev) return null;
  const fx = num(p.fx) || 1, q = num(p.qty);
  if (!coteAujourdhui(p)) return { pct: 0, eur: 0, prev, price: num(p.price), horsSeance: true };
  return {
    pct: (num(p.price) / prev - 1) * 100,
    eur: (num(p.price) - prev) * q * fx,
    prev, price: num(p.price),
  };
}

const MARKET_STATES = {
  REGULAR:    { cle: 'open',  label: trad('ouvert') },
  PRE:        { cle: 'pre',   label: trad('pré-ouverture') },
  PREPRE:     { cle: 'pre',   label: trad('avant pré-ouverture') },
  POST:       { cle: 'post',  label: trad('après clôture') },
  POSTPOST:   { cle: 'close', label: trad('fermé') },
  CLOSED:     { cle: 'close', label: trad('fermé') },
};

const COURS_FRAIS_S = 30 * 60;

function marketStatus(p) {
  const direct = MARKET_STATES[String(p.marketState || '').toUpperCase()];
  if (direct) return direct;

  const s = p.session;
  if (!s) return null;
  const t = Math.floor(Date.now() / 1000);
  const dans = b => Array.isArray(b) && b[0] != null && t >= b[0] && t < b[1];

  const fenetre = Array.isArray(s.regular) && s.regular[0] != null
    ? s.regular[1] - s.regular[0] : 0;
  if (fenetre >= 23 * 3600) {
    const age = num(p.quoteTime) ? t - num(p.quoteTime) : null;
    if (age == null) return null;
    return age <= COURS_FRAIS_S ? MARKET_STATES.REGULAR : MARKET_STATES.CLOSED;
  }

  if (dans(s.regular)) return MARKET_STATES.REGULAR;
  if (dans(s.pre)) return MARKET_STATES.PRE;
  if (dans(s.post)) return MARKET_STATES.POST;
  return MARKET_STATES.CLOSED;
}

const ISSUERS = [
  'iShares', 'Amundi', 'Xtrackers', 'Vanguard', 'Lyxor', 'BNP Paribas', 'SPDR',
  'Invesco', 'HANetf', 'VanEck', 'WisdomTree', 'Franklin', 'Fidelity', 'UBS',
  'HSBC', 'JPMorgan', 'Legal & General', 'L&G', 'First Trust', 'Global X',
  'Ossiam', 'Rize', 'Tabula', '21Shares', 'CoinShares', 'BlackRock', 'State Street',
];

function issuerOf(p) {
  const nom = p.longName || p.name || '';
  return ISSUERS.find(m => nom.toLowerCase().includes(m.toLowerCase())) || null;
}

const ISIN_PAYS = {
  FR: 'France', IE: 'Irlande', LU: 'Luxembourg', DE: 'Allemagne', NL: 'Pays-Bas',
  GB: 'Royaume-Uni', US: 'États-Unis', CH: 'Suisse', BE: 'Belgique', ES: 'Espagne',
  IT: 'Italie', AT: 'Autriche', SE: 'Suède', DK: 'Danemark', NO: 'Norvège',
  FI: 'Finlande', PT: 'Portugal', CA: 'Canada', JP: 'Japon', JE: 'Jersey',
  KY: 'Îles Caïmans', BM: 'Bermudes', AU: 'Australie',
};

function isinCountry(isin) {
  const code = String(isin || '').trim().toUpperCase().slice(0, 2);
  return code ? (ISIN_PAYS[code] || code) : null;
}

function rangePosition(p) {
  const bas = num(p.low52), haut = num(p.high52), c = num(p.price);
  if (!bas || !haut || haut <= bas) return null;
  return { bas, haut, pct: Math.max(0, Math.min(100, (c - bas) / (haut - bas) * 100)) };
}

/* L'heure du marche portee par les cours en memoire : le plus recent des
   `quoteTime`, en secondes.

   `lastRun` dit si la passerelle repond ; celle-ci dit de quand datent les
   chiffres affiches. C'est la seconde question qu'on se pose devant un ecart
   du jour, et rien ne la posait. */
function coursAsOf() {
  const heures = Store.state.positions
    .filter(p => !p.manual)
    .map(p => num(p.quoteTime))
    .filter(Boolean);
  return heures.length ? Math.max(...heures) : null;
}

function dayPerformance() {
  const lignes = [];
  let eur = 0, baseCotees = 0, sansDonnee = 0;
  for (const p of Store.state.positions) {
    const d = posDayChange(p);
    if (!d) { sansDonnee++; continue; }
    eur += d.eur;
    baseCotees += posValue(p) - d.eur;    // valeur d'hier, au change du jour
    lignes.push({
      index: Store.state.positions.indexOf(p),
      name: p.name, currency: p.currency || 'EUR', value: posValue(p),
      symbol: p.symbol || '', exchange: p.exchange || '',
      market: marketStatus(p), quoteTime: p.quoteTime || null,
      ...d,
    });
  }
  lignes.sort((a, b) => b.eur - a.eur);
  /* Deux comptes distincts, et il ne faut pas les confondre :
     `sansDonnee` = aucune cloture de reference, la ligne n'est pas dans la liste.
     `horsSeance` = on a la reference, mais notre cours ne date pas d'aujourd'hui.
     La seconde est dans la liste, avec un ecart nul — d'ou l'obligation de
     l'annoncer, faute de quoi elle se lit comme une seance atone. */
  const horsSeance = lignes.filter(l => l.horsSeance).length;
  const base = basePortefeuilleMarches() - eur;
  return {
    lignes, eur, sansDonnee, horsSeance,
    base, baseCotees,
    pct: base ? eur / base * 100 : 0,
    hausse: lignes.filter(l => l.eur > 0).length,
    baisse: lignes.filter(l => l.eur < 0).length,
    toutHorsSeance: lignes.length > 0 && horsSeance === lignes.length,
    asOfMarche: coursAsOf(),                      // de quand datent les prix
    asOf: Store.state.quotes?.lastRun || null,    // de quand date la requete
  };
}

/* CE QUI A LE PLUS FAIT BOUGER LE PORTEFEUILLE AUJOURD'HUI.

   La carte du jour deballait l'inventaire entier, et l'inventaire est deja en
   bas de page sous « Lignes de titres ». Neuf titres relus deux fois a trois
   cents pixels d'intervalle : les deux cartes repondent a deux questions, et
   elles se lisaient comme un doublon. Celle-ci garde la sienne — qu'est-ce qui
   a bouge, et de combien — et n'en montre que la reponse courte.

   TRIE PAR L'EFFET EN EUROS, en valeur absolue, et non par la variation. Une
   ligne a +1 % qui pese la moitie du portefeuille deplace plus d'argent qu'une
   ligne a +10 % qui en pese trois pour cent : c'est le premier qu'on veut lire.
   La valeur absolue parce que la question est « ce qui a bouge », pas « ce qui
   a monte » — une chute de cent euros passe devant une hausse de vingt.

   L'EFFET N'EST PAS RECALCULE : c'est `d.eur` de `posDayChange`, celui-la meme
   que la colonne « Effet » affiche. Une seconde formule aurait fini par classer
   dans un ordre que le tableau ne montre pas.

   `horsSeance` ecarte : la ligne a une cloture de reference mais notre cours
   date d'avant minuit, donc son ecart est nul par ignorance et non par
   constat. La faire entrer ici la rangerait derniere avec « 0,00 % · 0 € », ce
   qui est exactement le zero invente que cette carte refuse ailleurs. Elle
   reste comptee dans l'en-tete, sous « sans cours du jour ».

   Le tri se fait sur une COPIE : `filter` en rend une, et `dayPerformance()`
   garde son propre ordre pour le tableau complet. */
const MOUVEMENTS_JOUR = 3;
const MOUVEMENTS_JOUR_LARGE = 6;
function mouvementsDuJour(j = dayPerformance(), n = MOUVEMENTS_JOUR) {
  return j.lignes
    .filter(l => !l.horsSeance)
    .sort((a, b) => Math.abs(num(b.eur)) - Math.abs(num(a.eur)))
    .slice(0, n);
}

function holdingsOf(accountId) {
  return Store.state.positions.filter(p => p.account === accountId);
}
function holdingsValue(accountId) {
  return holdingsOf(accountId).reduce((s, p) => s + posValue(p), 0);
}

function nowValue(accountId) {
  const c = compteById(accountId);
  if (c) return valeurCompte(c);
  if (HOLDING_ACCOUNTS.includes(accountId)) return holdingsValue(accountId);
  return num(Store.state.now[accountId]);
}

/*   Une réserve à connaître : l'historique ne peut pas suivre. Un relevé porte
   la valeur totale d'un compte, et la poche vient du compte (`rowGroups` →
   `a.gAff`) — le cash qui dort dans un PEA y reste donc rangé en bourse, sans
   moyen de l'en extraire après coup. La courbe d'évolution montre par
   conséquent un décalage au dernier point, entre le dernier mois enregistré
   et « Auj. ». Il vaut le montant à investir, et le total ne bouge pas. */
function nowByGroup() {
  const p = patrimoine();
  return {
    cash: p.courant + p.precaution + p.projet + p.investir,
    bourse: p.classes.actions + p.classes.obligations,
    crypto: p.classes.crypto,
    pe: p.classes.nonCote,
    immo: p.classes.immobilier,
    biens: p.classes.bienValeur,
    garanti: p.classes.garanti,
  };
}

/* L'immobilier coupe en deux par son mode de detention.

   La classe `immobilier` porte le mur et le papier, et deux lecteurs ont besoin
   de les separer : la projection, qui gele les murs et ne gele pas un placement,
   et la carte des poids, qui garde la pierre papier en vue financiere.

   UNE POCHE DE PLUS dans `POCHES_EVOLUTION` aurait paru plus propre et aurait
   coute cher : les releves deja enregistres portent leur ventilation, aucun ne
   sait dire quelle part de son immobilier etait du papier, et on aurait gagne
   une bande vide sur tout le passe avec une couture au dernier releve. Deux
   champs a cote, calcules sur l'etat du jour, ne touchent a aucun releve.

   Les positions de marche n'y entrent pas d'elles-memes : un REIT cote a la
   classe `actions` par `POCHE_DE_CLASSE`, et il garde son chemin de position.
   Rien ici ne regarde un nom, un ticker ni un ISIN. */
function immobilierParDetention() {
  let direct = 0, papier = 0;
  for (const c of comptesOuverts()) {
    const hors = estHorsPerimetreFinancier(c);
    for (const l of lignesDe(c)) {
      if (l.classe !== 'immobilier') continue;
      if (hors) direct += num(l.valeur); else papier += num(l.valeur);
    }
  }
  return { direct, papier };
}

/* Ce qui est reserve a un projet, et depuis quelle poche de projection.

   Une ligne marquee quitte la poche qui la portait pour etre portee a plat :
   il faut donc savoir de laquelle elle vient, sinon la soustraction se ferait
   au hasard et un total cesserait d'egaler la somme de ses parts.

   L'immobilier et les biens n'y entrent pas. Pour un mur et une montre c'est
   qu'ils sont deja portes a plat par `partPlate()`, et les marquer ne changerait
   rien qu'un double comptage. Pour la pierre papier, qui rejoint desormais la
   poche « autres actifs », c'est que cette poche vaut zero par defaut : la
   reserver la laisserait plate de toute facon. Le jour ou quelqu'un affirme un
   rendement sur ses autres actifs, une SCPI marquee « projet » suivrait ce taux
   — connu, et laisse tel quel plutot que corrige a moitie. */
function reserveProjet() {
  /* Les poches sont celles de `nowByGroup`, une par une, et non la poche
     « marche » de la projection qui en fusionne deux : la fenetre de la base
     affiche une ligne pour la bourse et une pour la crypto, et chacune doit
     pouvoir retrancher ce qui lui a ete reserve. Fusionner ici obligeait a
     defusionner la-bas, et la somme des lignes cessait de faire le total. */
  const out = { total: 0, bourse: 0, crypto: 0, nonCote: 0, garanti: 0 };
  for (const c of comptesOuverts()) {
    for (const l of lignesDe(c)) {
      if (!l.projet) continue;
      const poche = l.classe === 'nonCote' ? 'nonCote'
                  : l.classe === 'garanti' ? 'garanti'
                  : l.classe === 'crypto' ? 'crypto'
                  : (l.classe === 'actions' || l.classe === 'obligations') ? 'bourse'
                  : null;
      if (!poche) continue;
      out[poche] += num(l.valeur);
      out.total += num(l.valeur);
    }
  }
  return out;
}

function nowTotals() {
  const p = patrimoine();
  const g = nowByGroup();
  const reserve = reserveProjet();
  const immo = immobilierParDetention();
  const brut = p.brut;
  return { ...g, brut, dettes: p.dettes, net: brut - p.dettes,
           total: brut - p.dettes,          // « total » = patrimoine net, partout
           toInvest: p.investir,
           /* `g.cash` couvre désormais toutes les liquidités, cash à investir
              compris. Retrancher `p.investir` en plus le compterait deux fois :
              « Investi » perdrait le cash a investir, qui reapparaitrait sur
              deux lignes de la carte du haut d'Allocation, « A investir » et
              « Argent disponible ». Les trois parts feraient quand meme le brut
              (la double soustraction compense la double addition), donc rien
              ne le signalerait. */
           /* Deux formes du meme fait : le total pour l'afficher, le detail par
              poche pour que `pochesProjection` sache ou soustraire. */
           projet: reserve.total, projetParPoche: reserve,
           /* Le perimetre, en trois faits, calcules une fois pour les six
              lecteurs qui les demandaient chacun a sa facon. `immo` garde son
              sens de CLASSE — c'est la somme de POCHES_EVOLUTION qui doit faire
              le brut, et un test l'exige. */
           horsFinancier: horsFinancierTotal(),
           immoDirect: immo.direct, immoPapier: immo.papier,
           invested: brut - g.cash };
}

/* La poche du graphique d'evolution, pour chaque classe d'actif.

   Une seule table, et un controle exige qu'elle s'accorde avec `nowByGroup()`
   sur le fixture : deux listes ecrites a la main pour une meme verite finissent
   toujours par se contredire, et c'est le defaut qui revient le plus souvent
   ici. Toute classe connue y a sa poche, et toute poche citee existe dans
   POCHES_EVOLUTION. */
const POCHE_EVOLUTION_DE_CLASSE = {
  liquidites: 'cash',
  actions: 'bourse',
  obligations: 'bourse',
  garanti: 'garanti',
  crypto: 'crypto',
  nonCote: 'pe',
  immobilier: 'immo',
  bienValeur: 'biens',
};

function partsDuReleve(v) {
  const parts = {};
  for (const a of ACCOUNTS) {
    const total = num(v[a.id]);
    if (!total) continue;
    const defaut = a.gAff || a.group;
    /* Un compte fantome n'a pas de compte derriere lui : c'est une entree de
       l'ancien modele, qui ne porte ni lignes ni liquidites. Sans cette sortie,
       `cashCompte(undefined)` levait une exception des qu'un releve portait un
       montant sur l'un d'eux. */
    if (!a.compte) { parts[a.id] = { [defaut]: round2(total) }; continue; }
    const brut = {};
    const ajoute = (poche, montant) => {
      if (montant) brut[poche] = (brut[poche] || 0) + montant;
    };
    ajoute('cash', cashCompte(a.compte));
    for (const l of lignesDe(a.compte))
      ajoute(POCHE_EVOLUTION_DE_CLASSE[l.classe] || defaut, num(l.valeur));
    const somme = Object.values(brut).reduce((s, x) => s + x, 0);
    const part = {};
    if (somme > 0.005)
      for (const k of Object.keys(brut)) part[k] = round2(total * brut[k] / somme);
    else part[defaut] = round2(total);
    parts[a.id] = part;
  }
  return parts;
}

function sommerParts(parts) {
  const g = Object.fromEntries(POCHES_EVOLUTION.map(k => [k, 0]));
  for (const part of Object.values(parts || {}))
    for (const [k, m] of Object.entries(part)) if (k in g) g[k] += num(m);
  for (const k of Object.keys(g)) g[k] = round2(g[k]);
  return g;
}

function pochesDuReleve(v) { return sommerParts(partsDuReleve(v)); }

function cashDuReleve(row, id) {
  const p = row && row.parts && row.parts[id];
  return p && p.cash != null ? round2(num(p.cash)) : null;
}

function rowGroups(row) {
  if (row.parts) return sommerParts(row.parts);
  const g = Object.fromEntries(POCHES_EVOLUTION.map(k => [k, 0]));
  if (row.poches) {
    for (const k of Object.keys(g)) g[k] += num(row.poches[k]);
    return g;
  }
  /* Sinon, le repli d'avant : la poche vient du type du compte. La cle
     `garanti` existe desormais dans l'objet, sans quoi un compte range la y
     ajoutait un nombre a `undefined`. */
  for (const a of ACCOUNTS) g[a.gAff || a.group] += num(row.v[a.id]);
  return g;
}
function rowTotal(row) {
  /* La somme se derive des poches, quelle que soit leur liste : la version
     ecrite a la main a laisse `biens` dehors une fois deja. */
  return Object.values(rowGroups(row)).reduce((s, v) => s + v, 0);
}
function rowNet(row) {
  return rowTotal(row) - num(row.dettes);
}
/* Un releve est vide quand il ne porte NI avoir NI dette.

   Le test ne regardait que `v`, les montants par compte : un releve a 0 EUR
   d'avoirs et 20 000 EUR de dette passait donc pour vide, et disparaissait de
   tout ce qui derive de cette notion -- le journal, les annees offertes au
   selecteur, la courbe, les variations, le rythme. Son patrimoine net vaut
   -20 000 EUR, ce qui est un fait, et le taire etait le seul moyen d'afficher
   zero a la place.

   VIDE N'EST PAS ZERO, et la nuance se lisait a l'envers. Le test valait
   `every(x => !num(x))` : un releve ou chaque compte est declare a zero passait
   donc pour vide lui aussi. Le cas est reel — on vide un compte, on solde un
   livret — et c'est meme le seul moment ou la photo compte vraiment. Janvier
   1 000, fevrier 0 : fevrier disparaissait du journal, de la courbe et des
   variations, et l'ecart de -1 000 avec lui. La photo declarait un compte a
   zero, l'application y lisait une absence de reponse.

   La presence de la CLEF tranche desormais, et non la valeur : un champ jamais
   rempli n'ecrit rien, un champ rempli ecrit ce qu'on y a mis, zero compris.
   Les deux formes vides d'un ancien etat — `null` et la chaine vide — comptent
   pour absentes, ce qu'elles ont toujours voulu dire. */
function rowIsEmpty(row) {
  const v = row.v || {};
  return !Object.keys(v).some(k => v[k] != null && v[k] !== '') && !num(row.dettes);
}

const moisRevolu = (date, aujourdhui = todayISO()) =>
  String(date || '').slice(0, 7) <= String(aujourdhui).slice(0, 7);

function historyYears() {
  const ans = new Set([todayISO().slice(0, 4)]);
  for (const r of Store.state.monthly || []) {
    if (!rowIsEmpty(r)) ans.add(String(r.date).slice(0, 4));
  }
  for (const a of apportsTries()) {
    if (a.date) ans.add(String(a.date).slice(0, 4));
  }
  return [...ans].sort();
}

const HISTORY_RANGES = [
  { id: 'ytd', label: 'YTD' },
  { id: '1y',  label: trad('1 an') },
  { id: '3y',  label: trad('3 ans') },
  { id: '5y',  label: trad('5 ans') },
  { id: 'all', label: trad('Tout') },
];

const estAnnee = id => /^\d{4}$/.test(String(id || ''));

function anneesPresentes(dates) {
  return [...new Set(dates.map(d => String(d || '').slice(0, 4)).filter(a => /^\d{4}$/.test(a)))]
    .sort().reverse();
}

function rangeLabel(id) {
  if (estAnnee(id)) return String(id);
  const fixe = HISTORY_RANGES.find(r => r.id === id);
  if (fixe) return fixe.label;
  if (id === 'ytd') return 'YTD';
  const m = String(id || '').match(/^(\d+)y$/);
  return m ? (m[1] === '1' ? trad('1 an') : `${m[1]} ${trad('ans')}`) : trad('Tout');
}

function rangeBornes(range) {
  if (estAnnee(range)) return { debut: `${range}-01-01`, fin: `${range}-12-31` };
  return { debut: rangeStart(range), fin: null };
}

/* `ecarts` : la serie porte des variations et non des valeurs.
   La difference tient a un cran. Pour tracer une annee de courbe il faut
   treize points, qui donnent douze intervalles : le seuil les garde tous, et
   c'est juste. Mais la carte du rythme filtre les ecarts eux-memes, chacun
   date du mois d'arrivee : celui date d'aout 2025 mesure la variation de
   juillet a aout 2025, soit treize mois avant aujourd'hui. « 1 an » comptait
   donc treize mois.
   Seules les fenetres en annees sont concernees. « Depuis le 1er janvier »
   garde bien la variation de decembre a janvier : elle appartient a janvier,
   donc a l'annee en cours. */
function limitRange(points, range, { ecarts = false } = {}) {
  if (range === 'all' || !range) return points;
  const now = new Date();
  let depuis;
  if (range === 'ytd') {
    depuis = new Date(now.getFullYear(), 0, 1);
  } else {
    const ans = parseInt(range, 10) || 1;
    depuis = new Date(now.getFullYear() - ans, now.getMonth() + (ecarts ? 1 : 0), 1);
  }
  /* `toISOString()` convertit en UTC : a Paris, le 1er janvier local devient
     le 31 decembre a 23 h, et le seuil « depuis le debut de l'annee » laissait
     passer la cloture du 31/12 de l'annee precedente. On assemble la date a
     partir de ses composantes locales. */
  const seuil = `${depuis.getFullYear()}-${String(depuis.getMonth() + 1).padStart(2, '0')}`
              + `-${String(depuis.getDate()).padStart(2, '0')}`;
  const gardes = points.filter(p => p.date >= seuil);
  return gardes.length >= 2 ? gardes : points.slice(-2);
}

/* `dettes` : le capital restant dû du mois, tel que la photo l'a noté.
   Sans lui, la courbe nette ne pouvait déduire les crédits que du dernier
   point — le patrimoine net semblait plat pendant des années puis
   chutait d'un coup au bout. */
/* `net` est rendu a cote du brut : les deux se lisent, et aucun appelant
   n'a plus a refaire la soustraction -- c'est en la refaisant que le journal
   avait fini par ne plus la faire du tout. */
const pointDuReleve = r => ({ label: fmtMonth(r.date), date: r.date, ...rowGroups(r),
                              total: rowTotal(r), dettes: num(r.dettes), net: rowNet(r),
                              comment: r.comment });

function historySeries({ includeNow = true } = {}) {
  const pts = Store.state.monthly
    .filter(r => !rowIsEmpty(r))
    .map(pointDuReleve);
  if (includeNow) {
    const t = nowTotals();
    /* `total` doit egaler la somme des trois poches, comme pour un releve
       passe : la courbe suit la valeur des avoirs, les credits se lisent
       dans le patrimoine net du bandeau. */
    pts.push({ label: trad('Auj.'), date: todayISO(), cash: t.cash, bourse: t.bourse,
               garanti: t.garanti,
               crypto: t.crypto, pe: t.pe, immo: t.immo, biens: t.biens,
               total: t.brut, comment: 'Photo actuelle' });
  }
  return pts;
}

/* --- les points de la courbe d'evolution, tels que le graphique les trace ---

   Deux reglages, deux questions, et ils ne se croisent jamais dans le meme sens :

     `net`       comment le patrimoine est valorise -- avoirs moins credits, ou
                 avoirs seuls. C'est le choix fait en tete de la page Aujourd'hui,
                 sur le grand chiffre, et la courbe en herite. Elle a porte sa
                 propre bascule Net / Brut pendant des mois : deux commutateurs
                 pour une seule notion, dont on pouvait croire qu'ils reglaient
                 des choses differentes.
     `financier` quel perimetre la courbe montre. L'immobilier physique pese 60 a
                 80 % d'un patrimoine ordinaire : sa bande ecrase l'echelle et les
                 placements deviennent un trait plat. La vue financiere l'ecarte,
                 avec les biens de valeur, pour rendre lisible ce qui bouge.

   En net, les credits se retranchent de la poche qui porte le bien -- l'immobilier
   d'abord, puis les biens, puis le non cote : c'est la que vivent les prets.
   Chaque releve porte le capital restant du du mois (`dettes`), note par la photo
   au meme titre que les montants par compte. La bande d'immobilier monte donc
   doucement d'un mois sur l'autre, a mesure que le pret se rembourse -- c'est
   exactement ce que le net veut montrer. Seul le dernier point utilise la dette
   d'aujourd'hui. Les mois anterieurs a ce champ n'ont pas la donnee : ils restent
   traces bruts plutot que de se voir appliquer une dette d'aujourd'hui qui n'etait
   pas la leur. La courbe se corrige d'elle-meme, un releve par mois.

   **En vue financiere, aucune dette ne se retranche de la COURBE, et la raison a
   change.** Le modele porte desormais le lien : une dette declare le bien qu'elle
   finance, et `detteLieeBienDirect` sait donc laquelle appartient au perimetre
   financier. Ce que la courbe ne peut pas faire, c'est appliquer la dette
   D'AUJOURD'HUI aux points d'HIER : un mois clos ne portait pas la marge ouverte
   la semaine derniere, et la retrancher de son point ferait descendre un passe
   qui n'a pas eu lieu. Seul le dernier point connait la dette du jour, et c'est
   deja la regle de la vue globale — les mois anterieurs restent bruts.

   La lecture d'AUJOURD'HUI, elle, retranche bien : la synthese de la page
   Allocation annonce les avoirs financiers, les dettes du perimetre et le net.
   Deux endroits, deux questions, et aucun des deux ne ment sur ce qu'il montre.

   La vue et le montage appellent tous deux cette fonction : la legende ne peut
   donc pas annoncer une serie que la courbe ne trace pas. */
function pointsEvolution({ net = true, financier = false } = {}) {
  const poches = pochesEvolution({ financier });
  const pts = historySeries();
  const retrancher = net && !financier;
  const dettesAuj = retrancher ? patrimoine().dettes : 0;
  return pts.map((p, i) => {
    /* Une copie, jamais le point d'origine : `historySeries()` sert aussi les
       variations et le rythme, qui comptent tout. */
    const q = { ...p };
    for (const cle of POCHES_EVOLUTION) if (!poches.includes(cle)) delete q[cle];
    const dettes = retrancher ? (i === pts.length - 1 ? dettesAuj : num(p.dettes)) : 0;
    if (dettes) {
      let reste = dettes;
      for (const cle of CASCADE_DETTES) {
        const pris = Math.min(reste, q[cle] || 0);
        q[cle] = (q[cle] || 0) - pris;
        reste -= pris;
      }
      if (reste > 0.005) q.immo = (q.immo || 0) - reste;
    }
    q.total = poches.reduce((s, cle) => s + (q[cle] || 0), 0);
    return q;
  });
}

/* --- Une bascule qui ne change rien ne se montre pas --------------------

   La question n'est PAS « ce detenteur a-t-il un appartement » ni « a-t-il un
   credit ». Ces drapeaux repondent a cote, et l'un d'eux se trompe : quelqu'un
   sans aucun bien physique mais avec une dette de courtier voit deja Financier
   et Global diverger, parce que la vue financiere ne retranche aucune dette la
   ou la vue globale nette les retranche. `aUnBien` aurait masque une bascule
   utile, et personne ne l'aurait vu.

   On compare donc les deux vues REELLEMENT calculees, sur la plage reellement
   affichee. C'est la seule formulation qui ne peut pas se tromper, et elle ne
   recopie aucune regle : le jour ou le perimetre change de definition, ces
   fonctions suivent sans etre touchees.

   Corollaire assume : le perimetre se juge a la lecture courante. Sans bien
   physique, Financier et Global donnent la meme courbe BRUTE et deux courbes
   NETTES differentes des qu'une dette existe — la bascule apparait donc en Net
   et disparait en Brut. C'est ce que la regle demande, et c'est vrai. */
function memeCourbe(a, b) {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i] || {};
    /* L'union des clefs, parce que la vue financiere SUPPRIME les poches hors
       perimetre au lieu de les mettre a zero : comparer les seules clefs de
       l'une raterait une poche que l'autre porte. `num(undefined)` vaut zero,
       donc une poche absente et une poche nulle se valent, ce qui est
       exactement ce qu'on veut dire. */
    const cles = new Set([...Object.keys(p), ...Object.keys(q)]);
    for (const k of cles) {
      if (k === 'date' || k === 'label') continue;
      if (Math.abs(num(p[k]) - num(q[k])) > 0.005) return false;
    }
    return true;
  });
}

function basculesEvolution({ net = true, financier = false, range = 'all' } = {}) {
  const courbe = (n, f) => limitRange(pointsEvolution({ net: n, financier: f }), range);
  const p = patrimoine();
  return {
    netBrut: Math.abs(num(p.net) - num(p.brut)) > 0.005
      || !memeCourbe(courbe(true, financier), courbe(false, financier)),
    perimetre: !memeCourbe(courbe(net, true), courbe(net, false)),
  };
}

function classesDeMarche() {
  const groupes = new Map();
  for (const c of comptesOuverts()) {
    for (const l of lignesDe(c)) {
      if (l.classe !== 'actions') continue;
      const cle = l.marche ? assetClassDe(l.marche) : 'actions';
      const g = groupes.get(cle) || { cle, valeur: 0, n: 0 };
      g.valeur += num(l.valeur);
      g.n += 1;
      groupes.set(cle, g);
    }
  }
  return [...groupes.values()]
    .map(g => ({ ...g, label: ASSET_CLASSES[g.cle] || g.cle }))
    .sort((a, b) => b.valeur - a.valeur);
}

/* Le prix d'une part, quand on sait combien on en detient.

   Rien de neuf n'est stocke : le montant investi et la valeur sont deja la, le
   nombre de parts s'ajoute, et les deux prix s'en deduisent. Un champ « prix de
   revient unitaire » serait une seconde ecriture du meme fait, que personne ne
   pourrait verifier accordee a la premiere — c'est la faute que cette base de
   code corrige le plus souvent.

   Deux prix et non un seul, parce que c'est leur ECART qui sert. Un prix de
   revient isole ne se compare a rien : une part payee 1,33 EUR n'est ni chere ni
   bon marche. Rapporte au prix d'aujourd'hui — celui d'une levee, d'un pacte,
   d'une offre de rachat — il dit enfin quelque chose.

   `null` plutot que zero partout ou le calcul n'a pas de sens : sans nombre de
   parts il n'y a pas de prix unitaire, et un « 0,00 EUR la part » se lirait
   comme une mesure alors que c'est une absence de mesure. */
function prixParPart(ligne) {
  const parts = num(ligne && ligne.parts);
  if (!(parts > 0)) return null;
  const revient = num(ligne.prixDeRevient);
  const valeur = num(ligne.valeur);
  const u = {
    parts,
    revient: revient > 0.005 ? revient / parts : null,
    valeur: valeur > 0.005 ? valeur / parts : null,
  };
  u.multiple = u.revient > 0 && u.valeur != null ? u.valeur / u.revient : null;
  return u;
}

/* CE QU'UN PLACEMENT A GAGNE OU PERDU DEPUIS SON ACHAT.

   Deux montants, une seule source : la valeur d'aujourd'hui et le cout
   d'acquisition, tous deux saisis. Rien n'est deduit d'ailleurs — surtout pas
   des notes, qui sont du texte libre et le restent.

   `null` PLUTOT QUE ZERO, et la distinction porte tout le sens de cette
   fonction. Sans cout d'acquisition, la plus-value n'est pas nulle : elle est
   inconnue, et « 0 EUR » se lirait comme un placement qui n'a rien fait. Deux
   montants connus et egaux, eux, font un vrai zero, qui s'affiche.

   MAIS LA QUESTION NE SE POSE PAS AUX CHAMPS DE LA LIGNE. `lignesDe` rend
   `valeur` et `prixDeRevient` toujours numeriques — `num(l.valeur) * q` et
   `(acq.total || 0) * q` — donc un cout jamais renseigne arrive ici en zero,
   indiscernable d'un cout nul. Tester la presence de ces deux champs ne pouvait
   rien attraper. C'est `acquisitionLigne` qui detient la reponse : elle seule
   separe un zero tape d'un champ vide, et elle rend `total: null` quand le cout
   n'est pas connu.

   Le MONTANT employe reste celui de la ligne, deja ramene a la quote-part
   comme l'est `valeur`. Comparer un cout de bien entier a une valeur en
   quote-part donnerait une moins-value a qui n'a rien perdu. Et une quote-part
   invalide ecarte la ligne entierement : ses deux montants valent alors zero
   pour ne pas polluer les totaux, et zero moins zero ferait un placement
   parfaitement plat.

   LA VALEUR se lit au meme seuil que `prixParPart`, qui remplit la ligne juste
   au-dessus dans la meme carte. Le modele ramene a zero un champ vide comme un
   zero saisi, et rien ne les separe. Un placement reellement tombe a zero ne
   verra donc pas son moins cent pour cent s'afficher — mais un placement dont
   la valeur n'est pas encore saisie ne s'entendra pas dire qu'il a tout perdu,
   et des deux erreurs c'est la seconde qui coute. Le prix d'achat reste ecrit
   au-dessus : la perte se lit, elle n'est simplement pas chiffree a la place du
   proprietaire.

   Le POURCENTAGE se separe du montant, et pas par gout : un cout nul declare —
   une part recue, une attribution gratuite — donne une plus-value en euros
   parfaitement calculable et un pourcentage qui ne l'est pas. Diviser rendrait
   `Infinity`, que rien n'affiche correctement. Les deux champs sont donc
   independants, et chacun se tait quand il ne sait pas. */
/* Le resume d'un etablissement : ce qui y est investi, ce que cela vaut, et
   l'ecart. Dans le modele et non dans la vue, pour la raison habituelle — le
   harnais ne charge pas `app.js`, et l'invariant qui compte ici est qu'un total
   egale la somme de ses parts.

   IL NE COMPTE QUE CE QUI A UNE BASE, et c'est tout l'enjeu. `perfLigne()`
   decide seule si le cout d'une ligne est connu ; on l'interroge plutot que
   d'ecrire une seconde regle, qui finirait par dire le contraire. Additionner
   la valeur d'une ligne dont le prix de revient manque gonflerait l'ecart du
   montant entier de cette ligne — une plus-value inventee, du cote flatteur.
   Les especes n'ont aucun cout d'acquisition et ne comptent donc jamais.

   CE QUI EST LAISSE DE COTE SE DIT. Sans `horsBase`, le resume aurait l'air de
   parler de tout le solde affiche en tete, et personne ne pourrait voir que
   deux nombres ne se rapportent pas au meme perimetre.

   `pct` reste nul sur une base qui n'est pas strictement positive : un rapport
   a zero n'existe pas, et une base negative retourne le signe.

   Rend `null` quand aucune ligne n'a de base : une banque qui ne porte que des
   especes n'a pas de plus-value, et une carte de zeros ne dirait rien. */
/* CE QUI SORT DU CALCUL SE DIT EN DEUX PARTS. Une seule phrase pour le cash des
   comptes et les lignes sans prix de revient, « faute de prix de revient »,
   accuserait, chez un courtier ou 1 600 EUR de liquidites attendent d'etre
   investis, des titres qui n'existent pas. Le cash n'a
   pas de prix de revient par nature ; une ligne sans le sien, par oubli. Les
   deux se lisent separement, et `horsBase` reste leur somme. */
function perfEtab(etabId) {
  let investi = 0, valeur = 0, cash = 0, sansBase = 0, lignes = 0;
  for (const c of COMPTES().filter(x => x.etabId === etabId && x.statut !== 'archive')) {
    cash += cashCompte(c);
    for (const l of lignesDe(c)) {
      if (perfLigne(l).pnl == null) { sansBase += num(l.valeur); continue; }
      investi += num(l.prixDeRevient);
      valeur += num(l.valeur);
      lignes++;
    }
  }
  if (!lignes) return null;
  const pnl = round2(valeur - investi);
  return { investi: round2(investi), valeur: round2(valeur), pnl,
           pct: investi > 0 ? (pnl / investi) * 100 : null,
           horsBase: round2(cash + sansBase), cash: round2(cash), sansBase: round2(sansBase), lignes };
}

function perfLigne(ligne) {
  if (!ligne || ligne.partInvalide) return { pnl: null, pct: null };
  const coutConnu = ligne.acquisition ? ligne.acquisition.total != null
                                      : num(ligne.prixDeRevient) > 0;
  const valeur = num(ligne.valeur);
  if (!coutConnu || !(valeur > 0.005)) return { pnl: null, pct: null };
  const revient = num(ligne.prixDeRevient);
  const pnl = round2(valeur - revient);
  return { pnl, pct: revient > 0 ? (pnl / revient) * 100 : null };
}

/* Le poids de chaque poche du patrimoine, et la base qui les rapporte a cent.

   Ce calcul vivait dans la vue, avec les couleurs et les libelles. Il n'y etait
   pas testable : le harnais ne charge pas `app.js`, si bien que l'invariant qui
   compte — la somme des parts fait la base — ne se verifiait que par expression
   rationnelle sur la source. Le meme deplacement a deja ete fait pour les points
   de la courbe, et pour la meme raison.

   La vue garde ce qui est a elle : la couleur d'une poche, son nom traduit, la
   note « dont tant a investir ». Le modele rend des nombres.

   La dette se retranche de la poche qu'elle FINANCE, une seule fois ; celle dont
   la destination est inconnue a sa propre ligne, `DETTES_NON_AFFECTEES`. En vue
   financiere, rien ne se retranche : la synthese de la page le fait, une fois.

   Une poche financee est gardee meme a zero : un bien dont la dette depasse la
   valeur rend une part negative, et la faire disparaitre ferait mentir le total. */
function poidsPoches({ financier = false, net = false } = {}) {
  const t = nowTotals();
  const dettes = net && !financier ? num(t.dettes) : 0;
  /* Chaque dette retranchee de la poche de la classe qu'elle finance, la
     meme regle que `repartitionClasses` : deux cartes du meme patrimoine net ne
     peuvent pas ranger le meme pret a deux endroits. */
  const dest = dettes ? dettesParDestination() : { classes: {}, nonAffectees: 0 };
  const dettesDe = k => Object.entries(dest.classes)
    .filter(([classe]) => POCHE_EVOLUTION_DE_CLASSE[classe] === k)
    .reduce((s, [, m]) => s + m, 0);
  /* En vue financiere, `immo` se reduit a sa pierre papier : une SCPI et le
     support immobilier d'une assurance-vie sont des avoirs financiers, et la
     carte doit les montrer sous le nom de leur classe. Le mur, lui, est parti
     avec le compte. La lecture d'aujourd'hui peut faire ce partage ; la courbe
     d'historique ne le peut pas — voir `SERIES_HORS_FINANCIER`. */
  const valeur = k => (financier && k === 'immo' ? num(t.immoPapier) : num(t[k]))
    - dettesDe(k);
  const base = financier ? totalFinancier() : num(t.brut) - dettes;
  const parts = POCHES_EVOLUTION
    .filter(k => Math.abs(valeur(k)) > 0.005 || dettesDe(k) > 0.005)
    .filter(k => !financier || k === 'immo' || !serieHorsFinancier(k))
    /* `null` et non zero quand la base ne se divise pas : un patrimoine net
       negatif retournerait tous les signes. */
    .map(k => ({ key: k, value: valeur(k), dettes: dettesDe(k),
                 pct: poidsDansTotal(valeur(k), base) }));
  if (dest.nonAffectees > 0.005) {
    parts.push({ key: DETTES_NON_AFFECTEES, value: -dest.nonAffectees, dettes: dest.nonAffectees,
                 pct: poidsDansTotal(-dest.nonAffectees, base) });
  }
  return parts;
}

function currentMonthKey() {
  return todayISO().slice(0, 7) + '-01';
}

const isCalendarMonth = date => /^\d{4}-\d{2}-01$/.test(String(date));

function ensureCalendarMonths(rows, cle, champTexte) {
  const annees = new Set(rows.map(r => String(r[cle]).slice(0, 4)));
  annees.add(String(new Date().getFullYear()));
  const presents = new Set(rows.map(r => r[cle]));
  for (const an of annees) {
    for (let m = 1; m <= 12; m++) {
      const date = `${an}-${String(m).padStart(2, '0')}-01`;
      if (!presents.has(date)) rows.push({ [cle]: date, v: {}, [champTexte]: '' });
    }
  }
  rows.sort((a, b) => String(a[cle]).localeCompare(String(b[cle])));
  return rows;
}

function clearMonthRow(row, champTexte) {
  row.v = {};
  row[champTexte] = '';
  /* La dette part avec les montants, sans quoi le releve qu'on vient d'effacer
     resterait au journal : il porte encore un capital restant du, donc il n'est
     plus vide au sens de `rowIsEmpty`. La ligne des depenses n'a pas ce champ,
     et `delete` sur une clef absente ne fait rien. */
  delete row.dettes;
}

const REPORT_JOURS = 7;
const PREFIXE_REPORT = 'jusquau:';

function rappelMasque(genre, key) {
  const v = String((Store.state.meta?.rappelsMasques || {})[genre] || '');
  if (!v) return false;
  if (v.startsWith(PREFIXE_REPORT)) return todayISO() < v.slice(PREFIXE_REPORT.length);
  return v === key;
}
function masquerRappel(genre, key) {
  Store.state.meta.rappelsMasques = { ...(Store.state.meta.rappelsMasques || {}), [genre]: key };
}
/* Repousse de sept jours a partir d'aujourd'hui. Le calcul reste en heure
   locale d'un bout a l'autre : voir `isoLocal`. */
function reporterRappel(genre, jours = REPORT_JOURS) {
  const [y, m, j] = todayISO().split('-').map(Number);
  const quand = isoLocal(new Date(y, m - 1, j + jours));
  Store.state.meta.rappelsMasques = {
    ...(Store.state.meta.rappelsMasques || {}), [genre]: PREFIXE_REPORT + quand };
  return quand;
}

const JOUR_RAPPEL_DEFAUT = 1;
function jourRappel() {
  const j = Math.round(num(Store.state.meta?.jourRappel)) || JOUR_RAPPEL_DEFAUT;
  return Math.min(28, Math.max(1, j));
}
function jourRappelAtteint() {
  return Number(todayISO().slice(8, 10)) >= jourRappel();
}

const aUnComptePropre = () =>
  comptesOuverts().some(c => !typeCompte(c.type).interne);

/* L'INVENTAIRE EST-IL DECLARE COMPLET ?

   Avoir un compte ne veut pas dire les avoir tous. Quelqu'un qui en saisit un
   puis s'interrompt a un patrimoine vrai pour ce compte et faux pour le reste,
   et rien dans les donnees ne distingue les deux etats : seule la personne le
   sait. La cloche pose donc la question, et sa reponse se range ici.

   La clef est posee a la main et non derivee du titre : `cleNotif` derive la
   sienne du titre TRADUIT, donc repondre en francais n'aurait pas repondu en
   anglais. Une clef qui commande autre chose que son propre affichage ne peut
   pas dependre de la langue. */
const CLE_INVENTAIRE = 'inventaire-comptes';
const CLE_RENTREES = 'inventaire-rentrees';
const CLE_CHARGES = 'inventaire-charges';

const pasDeclare = p => !p.declare || notifsMasquees().includes(p.declare.cle);

const CLE_DEMARRAGE = 'demarrage-fini';
const demarrageMasque = () => notifsMasquees().includes(CLE_DEMARRAGE);
const demarrageDepasse = () => aUnComptePropre() && relevesRenseignes() >= 2;

const inventaireDeclareComplet = () =>
  aUnRelevePatrimonial() || notifsMasquees().includes(CLE_INVENTAIRE);

/* Existe-t-il au moins un RELEVE PATRIMONIAL ? Une question, une fonction.

   Elle etait posee par `aDejaServi`, qui en pose une autre — l'application
   a-t-elle deja servi — et repond oui des le premier mois de depenses saisi.
   Le premier pas « enregistre ton premier releve » s'en servait, et se declarait
   donc franchi par quelqu'un qui avait rempli son budget sans jamais
   photographier ses comptes. Un releve et un mois de depenses sont deux objets
   differents : la courbe, le rythme d'accumulation et l'autonomie sortent du
   premier, jamais du second.

   La definition d'un releve rempli ne se reinvente pas ici : `rowIsEmpty` la
   porte deja, et c'est elle que la page des releves emploie. */
const aUnRelevePatrimonial = () =>
  (Store.state.monthly || []).some(r => !rowIsEmpty(r));
const relevesRenseignes = () =>
  (Store.state.monthly || []).filter(r => !rowIsEmpty(r)).length;

const aDesDepensesSaisies = () =>
  (B().expenses || []).some(r => Object.values(r.v || {}).some(v => num(v) !== 0));

const chargesInconnues = () =>
  !(B().fixedCharges || []).length && !aDesDepensesSaisies()
  && !notifsMasquees().includes(CLE_CHARGES);

const aDejaServi = () => aDesDepensesSaisies() || aUnRelevePatrimonial();

function currentMonthPending() {
  const key = currentMonthKey();
  const i = Store.state.monthly.findIndex(r => r.date === key);
  const row = i >= 0 ? Store.state.monthly[i] : null;
  const vide = !row || rowIsEmpty(row);
  return { key, index: i, label: fmtMonth(key), vide,
           /* `vide` reste vrai avant le jour dit : c'est un fait sur les
              donnees, et la page des releves s'en sert pour marquer la ligne.
              Seul `missing`, qui commande la cloche et les bandeaux, attend. */
           missing: vide && aUnComptePropre() && inventaireDeclareComplet()
                    && jourRappelAtteint() && !rappelMasque('releve', key) };
}

function moisPrecedentKey() {
  const [a, m] = todayISO().split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
function depensesEnAttente() {
  const key = moisPrecedentKey();
  const i = Store.state.budget.expenses.findIndex(r => r.month === key);
  const row = i >= 0 ? Store.state.budget.expenses[i] : null;
  const vide = !row || !Object.values(row.v || {}).some(v => num(v) !== 0);
  return { key, index: i, label: fmtMonth(key), vide,
           missing: vide && aDejaServi()
                    && jourRappelAtteint() && !rappelMasque('depenses', key) };
}

function moisVides(lignes, estVide) {
  const encours = currentMonthKey();
  const passes = (lignes || [])
    .filter(r => r.date && isCalendarMonth(r.date) && String(r.date) < encours)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const premier = passes.findIndex(r => !estVide(r));
  if (premier < 0) return [];
  return passes.slice(premier + 1).filter(estVide).map(r => r.date);
}

const trousReleves = () => moisVides(Store.state.monthly, rowIsEmpty);
const trousDepenses = () => moisVides(
  (Store.state.budget?.expenses || []).map(r => ({ date: r.month, v: r.v })),
  r => !Object.values(r.v || {}).some(v => num(v) !== 0));

/* La date d'un `Date`, lue en heure locale.

   `toISOString()` convertit d'abord en UTC : a Paris, minuit local est la
   veille a 22 h, et « aujourd'hui plus sept jours » en rendait six. Tout
   calcul de jour dans ce fichier passe donc par ici. */
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayISO() { return isoLocal(new Date()); }

const ZONES = {
  monde:     'Monde',
  amnord:    'Amérique du Nord',
  europe:    'Europe',
  france:    'France',
  asie:      'Asie-Pacifique',
  emergents: 'Émergents',
  autre:     'Non classé',
};
const SECTEURS = {
  diversifie: 'Diversifié',
  tech:       'Technologie',
  sante:      'Santé',
  finance:    'Finance',
  energie:    'Énergie',
  industrie:  'Industrie & défense',
  conso:      'Consommation',
  immobilier: 'Immobilier',
  matieres:   'Matières premières',
  crypto:     'Cryptomonnaies',
  autre:      'Non classé',
};

function devineZone(p) {
  const s = `${p.name || ''} ${p.longName || ''} ${p.symbol || ''}`.toLowerCase();
  const ac = assetClassDe(p);
  if (ac === 'crypto' || ac === 'metaux') return 'monde';
  if (/\bgold\b|silver|uranium|copper|commodit/.test(s)) return 'monde';
  if (/emerg|emmk|eimi|emim/.test(s)) return 'emergents';
  if (/\bworld\b|acwi|global|monde|all-?country/.test(s)) return 'monde';
  if (/japan|asia|asie|china|chine|india|inde|pacific|topix|nikkei|hang seng/.test(s)) return 'asie';
  if (/\bcac\b|france|français/.test(s)) return 'france';
  if (/stoxx|europe|europ|\bdax\b|\bftse\b|\bsmi\b|\bibex\b|\bmib\b/.test(s)) return 'europe';
  if (/s&p|sp ?500|nasdaq|\busa?\b|russell|dow jones|amerique|american/.test(s)) return 'amnord';
  if (p.currency === 'USD') return 'amnord';
  if (p.currency === 'EUR') return 'europe';
  return 'autre';
}

function devineSecteur(p) {
  const s = `${p.name || ''} ${p.longName || ''} ${p.symbol || ''}`.toLowerCase();
  const ac = assetClassDe(p);
  if (ac === 'crypto') return 'crypto';
  if (ac === 'obligations') return 'finance';
  if (ac === 'metaux' || /\bgold\b|\bor\b|silver|argent métal|uranium|copper|commodit/.test(s)) return 'matieres';
  if (/defen[cs]e|aerospace|armement|nato/.test(s)) return 'industrie';
  if (/health|santé|pharma|biotech|medical/.test(s)) return 'sante';
  if (/bank|banque|financ|assur|insur/.test(s)) return 'finance';
  if (/energy|énergie|energie|oil|pétrole|petrol|renewab/.test(s)) return 'energie';
  if (/reit|immobili|real estate/.test(s)) return 'immobilier';
  if (/consum|consommation|retail|luxe|luxury/.test(s)) return 'conso';
  if (/tech|nasdaq|semi|software|logiciel|nvidia|meta|apple|microsoft|amazon|alphabet|google|tesla/.test(s)) return 'tech';
  if (/\bworld\b|acwi|global|s&p|stoxx|\bcac\b|msci|core|500|emerg/.test(s)) return 'diversifie';
  return 'autre';
}

const zoneDe    = p => ZONES[p.zone]       ? p.zone    : devineZone(p);
const secteurDe = p => SECTEURS[p.secteur] ? p.secteur : devineSecteur(p);

function allocationParCle(cle, libelles) {
  const par = new Map();
  let total = 0;
  for (const p of Store.state.positions) {
    const v = posValue(p);
    if (!v) continue;
    const k = cle(p);
    par.set(k, (par.get(k) || 0) + v);
    total += v;
  }
  return [...par]
    .map(([k, value]) => ({ cle: k, label: libelles[k] || k, value,
                            pct: total ? value / total * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}
const allocationParZone    = () => allocationParCle(zoneDe, ZONES);
const allocationParSecteur = () => allocationParCle(secteurDe, SECTEURS);

const libelleAlloc = p => {
  const ac = assetClassDe(p);
  const cl = ASSET_CLASSES[ac];
  return ac === 'actions' ? `${cl} · ${ROLES[roleDe(p)]}` : cl;
};

/* `credits` : la ligne negative du capital restant du, et avec elle la base.

   Avec, la liste se totalise au patrimoine net — c'est ce que veulent l'accueil,
   l'export et la fiche. Sans, elle se totalise aux avoirs, et c'est ce que veut
   la carte de repartition, dont le camembert compte deja en brut : deux
   granularites d'un meme axe sous une seule base, plutot que deux cartes qui
   affichent le meme montant sous deux noms tant qu'aucun credit n'existe.
   La base suit le drapeau au lieu d'etre choisie par l'appelant : c'est le seul
   moyen que la somme des parts fasse toujours le total annonce. */
/* `parSociete` : les participations rattachees a une meme societe sous-jacente
   se somment sous le nom de la societe, et une participation qui n'en a pas
   compte pour elle-meme, sous la clef de sa ligne et jamais sous son libelle.
   Deux lignes sans lien portent parfois le meme nom ; seule une declaration les
   reunit. Voir `store-07-societes.js`. Seule l'analyse de concentration s'en
   sert : l'accueil, l'export et les fiches gardent chaque ligne. */
function allocationByAsset({ credits = true, financier = false, net = false, parSociete = false } = {}) {
  const map = new Map();
  const teintes = new Map();
  const poches = new Map();
  const lignes = new Map();
  /* La clef regroupe, le libelle s'affiche. Ils se confondent partout sauf
     pour les participations de `parSociete`. */
  const libelles = new Map();
  const comptesDeCle = new Map();
  const add = (label, v, couleur, poche, cle = label) => {
    map.set(cle, (map.get(cle) || 0) + v);
    if (!libelles.has(cle)) libelles.set(cle, label);
    if (couleur && !teintes.has(cle)) teintes.set(cle, couleur);
    lignes.set(cle, (lignes.get(cle) || 0) + 1);
    if (poche) {
      const vue = poches.get(cle);
      poches.set(cle, vue === undefined || vue === poche ? poche : null);
    }
  };

  /* La dette se retranche des lignes du compte qu'elle finance, au prorata de
     leur valeur, et le classement partage alors la base de la carte qui le
     porte : la plus longue barre du bas est une part de la plus grosse tranche
     du haut, ce que cette carte promet explicitement. Le compte est celui que
     `classeFinanceeParDette` reconnait, pas l'etablissement entier : un pret
     personnel pris chez un courtier ne se retranche pas de ses ETF.

     Compter les lignes en brut sous une base nette donnait un appartement a
     178,7 % du tout. L'autre issue — poser le credit en ligne du classement,
     ce que fait `credits` — donne la meme barre a 178,7 %, rattrapee par une
     barre a moins 97,6 % : deux fois illisible dans un classement dont chaque
     barre se compare a la plus longue.

     Le prorata plutot qu'une poche choisie : ici l'axe est la ligne, et deux
     appartements finances par deux prets doivent chacun porter le leur.

     Une dette dont la destination est inconnue — une marge de courtier sans
     lien, un pret personnel — ne peut rien se voir retrancher : elle reste une
     ligne du classement, « Dettes non affectees », sinon la somme des parts
     cesserait d'egaler la base sans que rien ne le dise. */
  const netLignes = net && !financier;
  const dus = new Map();
  let nonAffectees = 0;
  if (netLignes) {
    for (const e of ETABS()) {
      for (const d of (e.dettes || [])) {
        const m = num(d.montant);
        if (!m) continue;
        const c = classeFinanceeParDette(d, e) ? compteFinanceParDette(d, e) : null;
        if (c) dus.set(c.id, (dus.get(c.id) || 0) + m);
        else nonAffectees += m;
      }
    }
  }
  /* Les lignes manuelles telles que `lignesDe()` les rend, quote-part
     appliquee : c'est ce que le total compte. Lue sur la saisie, une ligne
     detenue a moitie pesait ici sa valeur entiere, et les parts depassaient la
     base. */
  const manuelles = c => lignesDe(c).filter(l => !l.marche);
  const assiette = c => manuelles(c).reduce((s, l) => s + num(l.valeur), 0);
  const valeurNette = (c, l) => {
    const du = dus.get(c.id) || 0;
    const a = assiette(c);
    if (!du || !(a > 0.005)) return num(l.valeur);
    return num(l.valeur) - du * (num(l.valeur) / a);
  };

  for (const p of Store.state.positions) {
    const ac = assetClassDe(p);
    add(libelleAlloc(p), posValue(p), couleurClasse(ac), pocheDeClasse(ac));
  }
  for (const poche of pochesLiquidites()) {
    if (poche.value) add(poche.nom, poche.value, CLASSE_COULEURS.liquidites, 'liquidites');
  }
  const parts = parSociete
    ? new Map(participations({ financier }).map(p => [`${p.compte.id}#${p.ref}`, p])) : null;
  for (const c of comptesOuverts()) {
    if (financier && estHorsPerimetreFinancier(c)) continue;
    for (const l of manuelles(c)) {
      const couleur = CLASSE_COULEURS[l.classe] || CLASSE_COULEURS.nonCote;
      const poche = pocheDeClasse(l.classe || 'nonCote');
      const p = parts && parts.get(`${c.id}#${l.ref}`);
      if (p) {
        const s = societeParId(p.societeId);
        const cle = s ? `societe:${s.id}` : `ligne:${p.cle}`;
        add(s ? s.nom : (l.libelle || nomCompteV2(c)), valeurNette(c, l), couleur, poche, cle);
        if (!s) comptesDeCle.set(cle, c);
        continue;
      }
      add(c.alloc || l.libelle, valeurNette(c, l), couleur, poche);
    }
  }
  if (credits && dettesTotal()) add(trad('Crédits en cours'), -dettesTotal(), 'var(--critical)');
  if (netLignes) {
    /* Un compte finance dont les lignes ne valent rien garde sa dette sous son
       nom et dans sa classe : c'est la que `poidsPoches` la range aussi. */
    for (const [id, du] of dus) {
      const c = compteById(id);
      if (assiette(c) > 0.005) continue;
      const classe = classeFinanceeParDette({ bienId: id }, etabById(c.etabId));
      add(c.alloc || c.libelle, -du, CLASSE_COULEURS[classe], pocheDeClasse(classe));
    }
    if (nonAffectees > 0.005) add(trad('Dettes non affectées'), -nonAffectees, 'var(--muted)');
  }

  const total = financier ? totalFinancier()
    : credits || net ? nowTotals().total : nowTotals().brut;
  const vus = new Map();
  for (const l of libelles.values()) vus.set(l, (vus.get(l) || 0) + 1);
  const sousTitre = cle => {
    const poche = poches.get(cle);
    const n = lignes.get(cle) || 0;
    const bouts = [];
    if (poche && CLASSES_ACTIFS[poche]) bouts.push(CLASSES_ACTIFS[poche]);
    else if (poche === null) bouts.push(trad('plusieurs classes'));
    if (String(cle).startsWith('societe:')) {
      bouts.push(`${n} ${trad(n > 1 ? 'participations' : 'participation')}`);
    } else if (n > 1) bouts.push(`${n} ${trad('lignes')}`);
    const c = comptesDeCle.get(cle);
    if (c && vus.get(libelles.get(cle)) > 1) bouts.push(nomCompteV2(c));
    return bouts.join(' · ');
  };
  return [...map.entries()]
    .map(([cle, value]) => ({ cle, label: libelles.get(cle), value, couleur: teintes.get(cle),
                              sous: sousTitre(cle),
                              pct: total ? value / total * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

/* Le liquide entre dans cette repartition, et la base devient les avoirs.

   Elle l'excluait deux fois : les comptes du groupe `cash` etaient ecartes, et
   `lignesDe()` ne voit pas le cash pose sur un compte-titres. Une page qui
   s'appelle « Allocation » et qui cache quinze mille euros de liquidites ne
   montre pas une allocation, elle montre un portefeuille — et le cash est une
   classe d'actif, celle qu'on choisit quand on ne choisit pas.

   La base suit : `invested` valait le brut moins le cash, donc y ajouter le cash
   aurait fait des parts qui depassent cent pour cent. C'est `valeurCompte()` qui
   somme desormais, cash compris, et le total est le brut. */
function allocationByAccount({ financier = false } = {}) {
  const base = financier ? totalFinancier() : nowTotals().brut;
  return comptesOuverts()
    .map(c => {
      const lignes = lignesDe(c);
      const parClasse = new Map([['liquidites', cashCompte(c)]]);
      for (const l of lignes) parClasse.set(l.classe, (parClasse.get(l.classe) || 0) + l.valeur);
      const dominante = [...parClasse.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
            return { id: c.id, label: nomCompteV2(c),
               value: financier ? valeurFinanciere(c) : valeurCompte(c),
               etab: nomEtabDe(c), type: trad(typeCompte(c.type).label),
               couleur: CLASSE_COULEURS[dominante] || CLASSE_COULEURS.nonCote };
    })
    .filter(r => r.value)
    .map(r => ({ ...r, pct: base ? r.value / base * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

/* Ce qui est investi, compte par compte.

   `net` retranche les dettes, comme la carte qui ouvre cette fiche. Sans lui,
   l'en-tete annoncerait « investi moins les dettes » au-dessus de lignes qui
   les ignorent : avec un pret de 150 000 EUR, le total dirait 155 000 EUR et
   ses parts en feraient 305 000. Un total egale la somme de ses parts, et cet
   ecart-la ne se voit pas chez qui n'a pas de credit.

   La dette se retranche des comptes de l'etablissement qui la porte, au prorata
   de leur valeur investie — meme regle que le classement ligne par ligne, et
   volontairement la meme ecriture.

   Un etablissement qui doit sans porter aucun compte investi — une marge de
   courtier adossee a du cash — ne peut rien se voir retrancher : son emprunt
   reste une ligne, sinon la somme cesserait d'egaler le total sans que rien ne
   le dise. */

/* Le troisieme axe de la meme somme : apres « ce que c'est » et « ou c'est
   pose », en combien de temps ça sort.

   Le calcul existait deja, `poches().mobilisable`, mais il ne se lisait que par
   l'autonomie financiere, qui en tire un nombre de mois. Un nombre de mois
   repond a une autre question et ecrase la composition : savoir qu'un tiers du
   patrimoine met des mois a se vendre ne se disait nulle part.

   Deux precautions, et la seconde a failli manquer.

   L'ordre est celui de la table, du plus liquide au moins, et non le
   decroissant des deux autres cartes : ici le rang porte du sens, et trier par
   montant melangerait un palier de trois jours avec un palier de trois mois
   selon les hasards du patrimoine.

   Et les cinq paliers y sont, `habite` et `bloque` compris. L'autonomie les
   exclut de son cumul, a dessein — l'un n'arrive pas avant son terme, l'autre
   demande un demenagement — mais cette regle appartient a l'autonomie. Ici ils
   font partie des avoirs : les retirer donnerait une carte dont le total ne
   vaut pas la base annoncee par ses voisines. */
function allocationParDisponibilite({ financier = false } = {}) {
  const base = financier ? totalFinancier() : patrimoine().brut;
  const m = poches({ financier }).mobilisable;
  return Object.entries(MOBILISABLE_LABEL)
    .map(([cle, label]) => ({ cle, label: trad(label), value: num(m[cle]) }))
    .filter(x => Math.abs(x.value) > 0.005)
    .map(x => ({ ...x, pct: base ? x.value / base * 100 : 0 }));
}

/* Ce que le classement par poids montre sans jamais le dire.

   La carte range les lignes de la plus grosse a la plus petite, et s'arrete la.
   Le fait qui en decoule — une seule ligne pese un tiers de tout — demande de
   lire l'axe, de retenir un pourcentage et de le rapporter au total. Il se dit
   en une phrase.

   C'est un fait, jamais un avis : aucun seuil, aucune couleur, aucune alerte.
   Un rappel qui se declenche a chaque ouverture cesse d'etre lu, et « trop
   concentre » depend d'un projet que l'application ne connait pas.

   La liste est celle que la carte affiche, `allocationByAsset`, et non une
   somme refaite ici : une seconde addition du meme fait finit par diverger de
   la premiere.

   Deux gardes. Une seule ligne fait 100 % par construction, l'annoncer
   n'apprend rien. Et les trois premieres ne se disent qu'a partir de quatre :
   a trois, elles sont le patrimoine entier. */
function concentration({ financier = false } = {}) {
  const base = financier ? totalFinancier() : nowTotals().brut;
  if (!(base > 0.005)) return null;
  const lignes = allocationByAsset({ credits: false, financier, parSociete: true })
    .filter(l => l.value > 0.005);
  if (lignes.length < 2) return null;
  const tete = lignes[0];
  const trois = lignes.slice(0, 3).reduce((s, l) => s + l.value, 0);
  return {
    n: lignes.length,
    premiere: { cle: tete.cle, label: tete.label, value: tete.value, pct: tete.value / base * 100 },
    top3: lignes.length > 3
      ? { value: trois, pct: trois / base * 100 }
      : null,
  };
}

function stockTotals() {
  const somme = f => Store.state.positions.filter(f).reduce((s, p) => s + posValue(p), 0);
  const est = ac => p => assetClassDe(p) === ac;
  const parClasseRole = {};
  for (const cle of Object.keys(ASSET_CLASSES)) {
    parClasseRole[cle] = {
      core:      somme(p => est(cle)(p) && roleDe(p) === 'core'),
      satellite: somme(p => est(cle)(p) && roleDe(p) !== 'core'),
    };
  }
  const parClasse = Object.fromEntries(Object.entries(parClasseRole)
    .map(([cle, r]) => [cle, r.core + r.satellite]));

  const coreEtf     = parClasseRole.actions.core;
  const satellites  = parClasseRole.actions.satellite;
  const gold        = parClasse.metaux;
  const cryptoPos   = parClasse.crypto;
  const obligations = parClasse.obligations;
  const monetaire   = parClasse.monetaire;
  const cashToInvest = poches().investir;
  /* `assetClassDe()` ramene toute valeur inconnue sur « actions » : chaque
     position tombe donc dans une classe et une seule, et cette somme vaut
     exactement la somme de toutes les positions. */
  const invested   = Object.values(parClasse).reduce((s, v) => s + v, 0);
  const autres = comptesOuverts()
    .filter(c => typeCompte(c.type).groupe === 'bourse')
    .reduce((s, c) => s + (c.lignes || []).reduce((x, l) => x + num(l.valeur), 0), 0);
  const balance    = invested + cashToInvest + autres;
  return { coreEtf, satellites, gold, cryptoPos, obligations, monetaire,
           cashToInvest, invested, balance, parClasseRole, parClasse };
}

/* La base des poids du portefeuille Marchés, et le poids lui-même.

   Il y en avait deux, et la fiche d'une ligne le disait en toutes lettres :
   « d'où deux pourcentages différents pour une même ligne, et tous les deux
   justes ». Chacun se défendait — l'un pour savoir si une variation du jour
   pèse, l'autre pour situer la ligne dans ce qu'on pilote — mais la même
   position s'affichait à 66,8 % dans le tableau du jour et à 53,89 % sur sa
   fiche, à un clic d'écart. Deux nombres justes qui se contredisent à l'écran
   ne renseignent pas : ils font douter des deux.

   Une seule convention, donc, celle qui répond à la question qu'on se pose
   devant un portefeuille : quelle part de l'argent que j'ai ici. Le
   dénominateur est `balance` — les titres, la trésorerie qui attend d'être
   placée, et les lignes manuelles des comptes de marché. La somme des poids
   des positions fait alors la part des titres, et le cash à investir complète
   à 100 %.

   Une fonction et non un calcul recopié : il l'était à cinq endroits, et c'est
   le quatrième qui a divergé. `base` se passe en argument quand l'appelant en
   affiche plusieurs, pour ne pas rappeler `stockTotals()` par ligne. */
const basePortefeuilleMarches = () => stockTotals().balance;

function poidsPortefeuille(valeur, base = basePortefeuilleMarches()) {
  const b = num(base);
  return b ? num(valeur) / b * 100 : 0;
}

function perimetreReequilibrage() {
  const r = rebalanceRows();
  const dedans = r.base;
  const brut = patrimoine().brut;
  const dehors = [];
  for (const c of comptesOuverts()) {
    if (typeCompte(c.type).groupe === 'bourse') continue;
    for (const l of (c.lignes || [])) {
      const k = classeDePoche(l.classe);
      if (k && num(l.valeur)) dehors.push({ classe: k, libelle: l.libelle || nomCompteV2(c), valeur: num(l.valeur) });
    }
    for (const e of (c.cash || [])) {
      if (e.affectation !== 'investir' && num(e.montant)) {
        dehors.push({ classe: 'monetaire', libelle: nomCompteV2(c), valeur: num(e.montant) });
      }
    }
  }
  const tg = Store.state.targets.classes || {};
  const horsAtteinte = [...new Set(dehors.map(d => d.classe))]
    .filter(k => cibleDeClasse(tg[k]) > 0)
    .map(k => ({ classe: k, label: ASSET_CLASSES[k] || k,
                 montant: dehors.filter(d => d.classe === k).reduce((s, d) => s + d.valeur, 0) }));
  const nonCote = comptesOuverts()
    .filter(c => typeCompte(c.type).groupe !== 'bourse')
    .reduce((s, c) => s + (c.lignes || [])
      .filter(l => l.classe === 'nonCote')
      .reduce((x, l) => x + num(l.valeur), 0), 0);
  return { dedans, brut, dehors, montantDehors: brut - dedans, horsAtteinte,
           exclues: r.exclues, nonCote };
}

/* La cible d'une classe, qu'elle soit decoupee par role ou non. Une classe
   decoupee porte un objet a deux entrees : `num({core:70, satellite:25})` vaut
   zero. Quatre endroits sommaient les cibles avec `num()`, et le bandeau
   annoncait « tes cibles totalisent 10 % » a qui en avait pose 105. */
function cibleDeClasse(v) {
  return (v !== null && typeof v === 'object')
    ? Object.values(v).reduce((s, x) => s + num(x), 0) : num(v);
}
const sommeCibleDe = cibleDeClasse;

const CLE_TRESORERIE = 'cashToInvest';

/* Le nom d'une ligne de cible, classe ou tresorerie. Les messages qui parlaient
   d'exclusion lisaient `ASSET_CLASSES[cle]` et rendaient donc « undefined sortie
   du reequilibrage » des que la cle etait celle de la tresorerie. */
const nomDeLaCible = cle =>
  cle === CLE_TRESORERIE ? AFFECTATION_LABEL.investir : (ASSET_CLASSES[cle] || cle);

function sommeCibles() {
  const tg = Store.state.targets || {};
  const horsJeu = new Set(tg.exclues || []);
  const cash = horsJeu.has(CLE_TRESORERIE) ? 0 : num(tg.cashToInvest);
  return round2(Object.entries(tg.classes || {})
    .filter(([k]) => !horsJeu.has(k))
    .reduce((s, [, v]) => s + cibleDeClasse(v), 0) + cash);
}

function rebalanceRows() {
  const t = stockTotals();
  const tg = Store.state.targets;
  const exclues = new Set(tg.exclues || []);
  const encoursDe = t.parClasse;
  const cashSorti = exclues.has(CLE_TRESORERIE);
  const horsBase = [...exclues].reduce((s, k) =>
    s + (k === CLE_TRESORERIE ? num(t.cashToInvest) : (encoursDe[k] || 0)), 0);
  const base = t.balance - horsBase;
  const mk = (label, value, targetPct, cle) => {
    const p = num(targetPct);
    const targetVal = base * p / 100;
    return { label, cle, value, pct: base ? value / base * 100 : 0,
             targetPct: p, targetVal, delta: targetVal - value };
  };
  const cibleDe = cle => tg.classes?.[cle];
  const estDecoupee = cle => cibleDe(cle) !== null && typeof cibleDe(cle) === 'object';

  const classes = [];
  for (const [cle, label] of Object.entries(ASSET_CLASSES)) {
    if (exclues.has(cle)) continue;
    if (!estDecoupee(cle)) {
      const ligne = mk(label, encoursDe[cle] || 0, cibleDe(cle), `classes.${cle}`);
      if (ligne.value || ligne.targetPct) classes.push(ligne);
      continue;
    }
    const parRole = t.parClasseRole?.[cle] || { core: 0, satellite: 0 };
    for (const role of ['core', 'satellite']) {
      const ligne = mk(`${label} ${ROLES[role].toLowerCase()}`, num(parRole[role]),
                       cibleDe(cle)?.[role], `classes.${cle}.${role}`);
      ligne.classeParente = cle;
      ligne.labelClasse = label;
      ligne.role = role;
      classes.push(ligne);
    }
  }
  return {
    base, classes, cashSorti,
    exclues: [...exclues].map(cle => ({
      cle,
      label: cle === CLE_TRESORERIE ? AFFECTATION_LABEL.investir
                                    : (ASSET_CLASSES[cle] || cle),
      value: cle === CLE_TRESORERIE ? num(t.cashToInvest) : (encoursDe[cle] || 0),
    })),
    invested: mk(BASES.placeBourse.nom, t.invested - horsBase,
      Object.entries(tg.classes || {}).filter(([k]) => !exclues.has(k))
        .reduce((s, [, v]) => s + cibleDeClasse(v), 0)),
    cash: cashSorti ? null
      : mk(AFFECTATION_LABEL.investir, t.cashToInvest, tg.cashToInvest, CLE_TRESORERIE),
  };
}

/* Les placements derriere une ligne de cible.

   « Actions core, 44,8 % » ne disait pas de quoi ce core etait fait. La
   question se pose exactement au moment ou l'on regle la cible — renforcer le
   core, oui, mais quelle ligne — et la reponse vivait deux ecrans plus loin,
   dans Marches, ou il fallait lire le role ligne par ligne.

   La cle est celle que `rebalanceRows()` pose sur la ligne : `classes.actions`
   pour une classe entiere, `classes.actions.core` pour une moitie de role. Une
   cle de tresorerie ou inconnue rend `null` : la tresorerie n'est pas faite de
   positions, elle a sa propre fiche.

   Le total descend des memes positions que les lignes, il en est donc la somme
   par construction. Relire `parClasse` aurait ete un second calcul, et deux
   calculs du meme nombre finissent toujours par diverger. Ce qui garantit
   l'egalite avec la ligne affichee, c'est que `stockTotals()` filtre sur les
   deux memes predicats, `assetClassDe` et `roleDe` — le test le verifie. */
/* La classe qui pese le plus dans un lot de comptes, et sa couleur.

   Un groupe d'etablissement ou d'enveloppe n'a pas de couleur intrinseque, mais
   il a un contenu, et ce contenu en a une. Un courtier majoritairement en
   titres se lit vert comme les actifs de marche partout ailleurs ; un livret se
   lit bleu comme les liquidites. La couleur dit donc quelque chose de vrai, et
   d'utile au premier regard : quelle banque porte les actions, laquelle garde le
   cash.

   Elle etait un hachage du nom du groupe, qui collisionnait et piochait au hasard
   dans le vocabulaire des classes — un etablissement de banque heritait du vert
   des actifs de marche sans rien detenir de tel. Puis une teinte neutre unique, exacte mais
   morte. Le contenu tranche mieux que les deux.

   Le precedent est dans `allocationByAccount`, qui colore deja un compte par sa
   classe dominante pour la meme raison : « le compte n'est qu'un contenant, c'est
   ce qu'il porte qui compte ». */
function estEtabDeBiens(e) {
  if (!e) return false;
  const siens = comptesOuverts().filter(c => c.etabId === e.id);
  return siens.length > 0 && siens.every(c => estDetenuEnDirect(typeCompte(c.type)));
}

partieChargee('assets/store-03-calculs-1.js');
