/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

/* Deux participations dans la meme societe s'ecrivent souvent sous deux noms :
   une premiere levee, puis une seconde, soit deux lignes « X shares » et
   « X shares 2 ». Chacune reste une ligne a part dans sa fiche, dans ses
   operations et dans les donnees enregistrees : elles n'ont ni le meme prix ni
   la meme date. Mais l'analyse de concentration mesure une exposition, et
   l'exposition a une societe est la somme de ce qu'on y detient.

   Le lien est une DECLARATION. `l.societeId` rattache une ligne a une entree de
   `Store.state.societes`, et rien ne le pose tout seul : une ressemblance de
   noms se PROPOSE, et ne regroupe qu'une fois confirmee. Deux societes aux noms
   voisins sont un cas courant, et les fondre en silence gonflerait une
   exposition sans que rien ne le dise.

   Absent vaut vide : un etat sans `societes` n'a aucune societe, et chaque
   participation compte pour elle-meme. */

const NOM_SOCIETE_MAX = 40;

const societesDeclarees = () => Store.state.societes || [];
const societeParId = id => (id && societesDeclarees().find(s => s.id === id)) || null;

/* UNE PARTICIPATION EST UNE PART DE CAPITAL, et seul le type « Parts de
   societe » en porte. La classe `nonCote` ne suffit pas : elle range aussi les
   fonds non cotes, dont la societe de gestion porte des dizaines de lignes, et
   les prets participatifs, qui sont une creance et non du capital. Leur donner
   une societe sous-jacente dirait une exposition qui n'existe pas. */
const estCompteDeParts = c => typeCompte(c?.type).id === 'pe';

const MOTS_DE_TITRE = new Set(['shares', 'share', 'parts', 'part', 'actions', 'action',
  'titres', 'titre', 'equity', 'stock', 'stocks', 'ordinary', 'ordinaires', 'preferred',
  'preference', 'sas', 'sasu', 'sa', 'sarl', 'sca', 'ltd', 'inc', 'gmbh', 'bv',
  'bsa', 'bspce', 'aga', 'obsa']);
const MOTS_DE_TRANCHE = new Set(['serie', 'series', 'tranche', 'round', 'lot', 'vague', 'levee']);
const MOTS_DE_LIAISON = new Set(['de', 'du', 'des', 'd', 'l', 'la', 'le', 'les', 'in', 'of', 'the']);
const NUMERO_DE_TRANCHE = /^(\d+|i|ii|iii|iv|v|vi|vii|viii|ix|x|bis|ter)$/;

function motsDeSociete(nom) {
  return String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

function normaliserNomSociete(nom) {
  const mots = motsDeSociete(nom);
  for (;;) {
    const n = mots.length;
    if (!n) break;
    const der = mots[n - 1];
    if (MOTS_DE_TITRE.has(der) || NUMERO_DE_TRANCHE.test(der) || MOTS_DE_TRANCHE.has(der)) {
      mots.pop(); continue;
    }
    if (n >= 2 && MOTS_DE_TRANCHE.has(mots[n - 2]) && der.length <= 2) { mots.splice(-2); continue; }
    break;
  }
  let tete = 0;
  while (tete < mots.length - 1 && MOTS_DE_TITRE.has(mots[tete])) {
    tete++;
    while (tete < mots.length - 1 && MOTS_DE_LIAISON.has(mots[tete])) tete++;
  }
  return mots.slice(tete).join(' ');
}

function nomSocietePropose(libelle) {
  const brut = String(libelle || '').trim().split(/\s+/).filter(Boolean);
  const cle = m => motsDeSociete(m).join(' ');
  while (brut.length > 1) {
    const der = cle(brut[brut.length - 1]);
    if (!der || MOTS_DE_TITRE.has(der) || NUMERO_DE_TRANCHE.test(der) || MOTS_DE_TRANCHE.has(der)) {
      brut.pop(); continue;
    }
    if (brut.length > 2 && MOTS_DE_TRANCHE.has(cle(brut[brut.length - 2])) && der.length <= 2) {
      brut.splice(-2); continue;
    }
    break;
  }
  return (brut.join(' ') || String(libelle || '').trim()).slice(0, NOM_SOCIETE_MAX);
}

/* --- les participations et leurs groupes --------------------------------

   La valeur est celle que `lignesDe()` rend, quote-part appliquee : c'est la
   part detenue qui fait l'exposition, pas la valeur de la societe entiere.

   `cle` designe la ligne sans ambiguite, et c'est `l.cleSociete`, un champ a
   part que la migration pose sur chaque ligne de parts. L'identifiant de ligne
   ne suffit pas : deux comptes, voire deux lignes d'un meme compte, peuvent le
   partager, et on ne le renomme jamais, parce que le journal des cessions y
   renvoie par `actifId`. Une cle tiree du rang changerait des qu'une homonyme
   disparait, et un refus enregistre designerait alors une autre ligne.

   Une ligne creee depuis le dernier chargement n'a pas encore la sienne : elle
   recoit une cle provisoire, un tableau JSON qu'aucune cle posee ne peut
   egaler, et `assurerCleSociete()` la rend durable avant qu'un refus la
   retienne. */
function clesDeLignes(c) {
  const vus = new Map();
  return (c.lignes || []).map((l, i) => {
    const id = l && l.id ? String(l.id) : null;
    const base = id === null ? `#${i}` : id;
    const n = (vus.get(base) || 0) + 1;
    vus.set(base, n);
    if (l && l.cleSociete) return String(l.cleSociete);
    return JSON.stringify([String(c.id), id, id === null ? i : n]);
  });
}

function clesSocietePrises(s = Store.state) {
  const prises = new Set();
  for (const c of (s.comptes || [])) for (const l of (c.lignes || [])) if (l && l.cleSociete) prises.add(String(l.cleSociete));
  for (const v of (s.sales || [])) if (v && v.ligne && v.ligne.cleSociete) prises.add(String(v.ligne.cleSociete));
  return prises;
}
function nouvelleCleSociete(prises) {
  let n = prises.size + 1;
  while (prises.has(`cs_${n}`)) n++;
  prises.add(`cs_${n}`);
  return `cs_${n}`;
}
function assurerCleSociete(compte, ref) {
  const l = (compte.lignes || [])[ref];
  if (!l) return null;
  if (!l.cleSociete) l.cleSociete = nouvelleCleSociete(clesSocietePrises());
  return String(l.cleSociete);
}

function participations({ financier = false } = {}) {
  const out = [];
  for (const c of comptesOuverts()) {
    if (!estCompteDeParts(c)) continue;
    if (financier && estHorsPerimetreFinancier(c)) continue;
    const cles = clesDeLignes(c);
    for (const l of lignesDe(c)) {
      if (l.marche || (l.classe || 'nonCote') !== 'nonCote') continue;
      const s = societeParId(l.societeId);
      out.push({ id: l.id || null, cle: cles[l.ref], compte: c, ref: l.ref,
                 libelle: l.libelle || '', valeur: num(l.valeur), societeId: s ? s.id : null });
    }
  }
  return out;
}

/* Le credit d'une participation vit sur son COMPTE, jamais sur la ligne :
   `creditsDuBien()` le rattache au compte qu'il finance. Il ne se retranche
   donc de la societe que si ce compte ne porte rien d'autre qu'elle, ni autre
   ligne ni liquidites. Sinon on ne sait pas quelle part du credit la finance,
   et le repartir serait une supposition : il se montre, pour information, sans
   rien reduire.

   L'exposition reste BRUTE dans tous les cas. Un credit ne change pas ce que
   vaut une part : il dit comment on l'a payee. */
function creditsDeSociete(g) {
  const comptes = [...new Set(g.participations.map(p => p.compte))];
  return comptes.map(c => {
    const du = round2(creditsDuBien(c).reduce((s, d) => s + num(d.montant), 0));
    if (!(du > 0.005)) return null;
    const autres = lignesDe(c).some(l => !g.participations.some(p => p.compte === c && p.ref === l.ref))
      || cashCompte(c) > 0.005;
    return { compte: c, du, exclusif: !autres };
  }).filter(Boolean);
}

function groupesSocietes({ financier = false } = {}) {
  const par = new Map();
  for (const p of participations({ financier })) {
    if (!p.societeId) continue;
    const g = par.get(p.societeId)
      || { id: p.societeId, nom: societeParId(p.societeId).nom, valeur: 0, participations: [] };
    g.valeur += p.valeur;
    g.participations.push(p);
    par.set(p.societeId, g);
  }
  return [...par.values()].map(g => {
    const credits = creditsDeSociete(g);
    const tousExclusifs = credits.length > 0 && credits.every(k => k.exclusif);
    return { ...g, valeur: round2(g.valeur), credits,
             netApresCredit: tousExclusifs
               ? round2(g.valeur - credits.reduce((s, k) => s + k.du, 0)) : null };
  }).sort((a, b) => b.valeur - a.valeur);
}

/* --- les rapprochements proposes ----------------------------------------

   On compare des ENTITES : une societe declaree, ou une participation qui n'en
   a pas. Une societe repond a son nom et a ceux de ses lignes ; une
   participation seule, au sien. Deux entites se proposent quand elles partagent
   une forme normalisee.

   Un refus porte sur des paires de lignes, designees par leur `cle`, et il
   tient pour toute la suite :
   deux entites qui en contiennent une paire refusee ne se proposent plus,
   meme apres qu'une troisieme ligne a rejoint l'une d'elles. Rapprocher par un
   detour ce qu'on a separe expressement serait passer outre la reponse.

   La paire se range en tableau trie, jamais en chaine jointe : un identifiant
   qui contiendrait le separateur rendrait deux paires indiscernables. */
const cleDePaire = (x, y) => JSON.stringify([String(x), String(y)].sort());

function rapprochementsEcartes() {
  const brut = Store.state.meta?.rapprochementsEcartes;
  return new Set((Array.isArray(brut) ? brut : [])
    .filter(p => Array.isArray(p) && p.length === 2).map(p => cleDePaire(p[0], p[1])));
}

function entitesDeSociete() {
  const entites = new Map();
  for (const p of participations()) {
    const cle = p.societeId ? `s:${p.societeId}` : `l:${p.cle}`;
    const e = entites.get(cle) || { cle, societe: societeParId(p.societeId), participations: [], noms: new Set() };
    e.participations.push(p);
    const n = normaliserNomSociete(p.libelle);
    if (n) e.noms.add(n);
    entites.set(cle, e);
  }
  for (const e of entites.values()) {
    const n = e.societe && normaliserNomSociete(e.societe.nom);
    if (n) e.noms.add(n);
  }
  return [...entites.values()];
}

function suggestionsRapprochement() {
  const ecartes = rapprochementsEcartes();
  const refusee = (a, b) => a.participations.some(x => b.participations.some(y =>
    ecartes.has(cleDePaire(x.cle, y.cle))));
  const liste = entitesDeSociete();
  const out = [];
  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i], b = liste[j];
      if (![...a.noms].some(n => b.noms.has(n))) continue;
      if (refusee(a, b)) continue;
      out.push({ a, b });
    }
  }
  return out;
}

const entiteParCle = cle => entitesDeSociete().find(e => e.cle === cle) || null;

function ligneParCle(cle) {
  for (const c of COMPTES()) {
    const i = clesDeLignes(c).indexOf(cle);
    if (i >= 0) return { compte: c, ligne: c.lignes[i], ref: i };
  }
  return null;
}

function societesTenues(s = Store.state) {
  const tenues = new Set();
  for (const c of (s.comptes || [])) for (const l of (c.lignes || [])) if (l && l.societeId) tenues.add(l.societeId);
  for (const v of (s.sales || [])) if (v && v.ligne && v.ligne.societeId) tenues.add(v.ligne.societeId);
  return tenues;
}

function nettoyerSocietes(s = Store.state) {
  if (!Array.isArray(s.societes)) return;
  const tenues = societesTenues(s);
  s.societes = s.societes.filter(x => x && tenues.has(x.id));
}

function creerSociete(nom) {
  const propre = String(nom || '').trim().slice(0, NOM_SOCIETE_MAX);
  if (!propre) return null;
  if (!Array.isArray(Store.state.societes)) Store.state.societes = [];
  const base = 'soc_' + Date.now().toString(36);
  let id = base, n = 1;
  while (societeParId(id)) id = `${base}_${n++}`;
  Store.state.societes.push({ id, nom: propre });
  return id;
}

function renommerSociete(id, nom) {
  const s = societeParId(id);
  const propre = String(nom || '').trim().slice(0, NOM_SOCIETE_MAX);
  if (!s || !propre) return false;
  s.nom = propre;
  return true;
}

function rattacherASociete(cles, societeId) {
  if (!societeParId(societeId)) return 0;
  let n = 0;
  for (const cle of cles) {
    const t = ligneParCle(cle);
    if (!t || !estCompteDeParts(t.compte)) continue;
    t.ligne.societeId = societeId;
    n++;
  }
  nettoyerSocietes();
  return n;
}

function dissocierParticipation(cle) {
  const t = ligneParCle(cle);
  if (!t || !t.ligne.societeId) return false;
  delete t.ligne.societeId;
  nettoyerSocietes();
  return true;
}

/* « Meme societe » sur deux entites. Deux lignes seules forment une societe
   nouvelle, sous le nom donne ; une ligne rejoint la societe de l'autre ; deux
   societes n'en font plus qu'une, celle de `a`, sous son nom. L'ecran demande
   une confirmation qui nomme les deux avant ce dernier cas. */
function confirmerRapprochement(a, b, nom = '') {
  if (!a || !b) return null;
  if (a.societe && b.societe) return fusionnerSocietes(a.societe.id, b.societe.id);
  const cles = e => e.participations.map(p => p.cle);
  const id = a.societe ? a.societe.id : b.societe ? b.societe.id
    : creerSociete(nom || nomSocietePropose(a.participations[0]?.libelle));
  if (!id) return null;
  rattacherASociete([...cles(a), ...cles(b)], id);
  return id;
}

function fusionnerSocietes(garde, absorbee) {
  if (!societeParId(garde) || !societeParId(absorbee) || garde === absorbee) return null;
  for (const c of COMPTES()) for (const l of (c.lignes || [])) if (l && l.societeId === absorbee) l.societeId = garde;
  for (const v of (Store.state.sales || [])) if (v && v.ligne && v.ligne.societeId === absorbee) v.ligne.societeId = garde;
  nettoyerSocietes();
  return garde;
}

function ecarterRapprochement(a, b) {
  if (!a || !b) return;
  const durable = p => assurerCleSociete(p.compte, p.ref) || p.cle;
  Store.state.meta = Store.state.meta || {};
  const liste = Array.isArray(Store.state.meta.rapprochementsEcartes)
    ? Store.state.meta.rapprochementsEcartes : [];
  const deja = new Set(liste.map(p => cleDePaire(p[0], p[1])));
  for (const x of a.participations) {
    for (const y of b.participations) {
      const paire = [String(durable(x)), String(durable(y))].sort();
      const k = JSON.stringify(paire);
      if (!deja.has(k)) { liste.push(paire); deja.add(k); }
    }
  }
  Store.state.meta.rapprochementsEcartes = liste;
}

/* --- la migration --------------------------------------------------------

   Trois gestes, idempotents, et aucun ne touche a une valeur ni a un
   identifiant de ligne :
     - une ligne de parts sans `cleSociete` en recoit une, libre ;
     - un `societeId` qui ne designe plus aucune societe se retire ;
     - une societe que plus rien ne designe disparait, journal compris.
   Les refus deja enregistres restent tels quels : un second passage ne les
   efface pas, et une paire dont une ligne n'existe plus ne gene personne. */
function migrerSocietes(s) {
  const prises = clesSocietePrises(s);
  for (const c of (s.comptes || [])) {
    if (!estCompteDeParts(c)) continue;
    for (const l of (c.lignes || [])) if (l && !l.cleSociete) l.cleSociete = nouvelleCleSociete(prises);
  }
  if (!Array.isArray(s.societes)) {
    if (s.societes !== undefined) delete s.societes;
  } else {
    s.societes = s.societes.filter(x => x && x.id && String(x.nom || '').trim());
  }
  const connues = new Set((s.societes || []).map(x => x.id));
  for (const c of (s.comptes || [])) {
    for (const l of (c.lignes || [])) if (l && l.societeId && !connues.has(l.societeId)) delete l.societeId;
  }
  for (const v of (s.sales || [])) {
    if (v && v.ligne && v.ligne.societeId && !connues.has(v.ligne.societeId)) delete v.ligne.societeId;
  }
  nettoyerSocietes(s);
}

partieChargee('assets/store-07-societes.js');
