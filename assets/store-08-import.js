/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

/* RIEN NE QUITTE L'APPAREIL. Le fichier se lit ici, sans service ni
   bibliotheque : un CSV est du texte, un .xlsx un ZIP de fichiers XML que le
   navigateur sait decompresser (`DecompressionStream`) et lire (`DOMParser`).
   Tout ce qui decide -- lire, deviner, regrouper, ecrire -- vit dans ce fichier
   et se teste sans interface ; la fenetre ne fait que montrer et demander. */

const IMPORT_LIMITES = { fichier: 20e6, decompresse: 60e6 };

class ErreurImport extends Error {
  constructor(code, detail) { super(code); this.code = code; this.detail = detail; }
}

const celluleVide = { t: 'vide', v: null };
const celluleTexte = v => (String(v ?? '').trim() === '' ? celluleVide : { t: 'texte', v: String(v) });

const normaliserTexte = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function decoderTexte(octets) {
  const b = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let t;
  try { t = new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch (e) { t = new TextDecoder('windows-1252').decode(b); }
  return t.replace(/^﻿/, '');
}

function separateurCSV(texte) {
  const lignes = texte.split(/\r?\n/).filter(l => l.trim()).slice(0, 15);
  let meilleur = ';', score = 0;
  for (const sep of [';', ',', '\t']) {
    const parNombre = new Map();
    for (const l of lignes) {
      let n = 0, dans = false;
      for (const ch of l) { if (ch === '"') dans = !dans; else if (ch === sep && !dans) n++; }
      if (n) parNombre.set(n, (parNombre.get(n) || 0) + 1);
    }
    for (const [n, fois] of parNombre) {
      const s = fois * 100 + n;
      if (s > score) { score = s; meilleur = sep; }
    }
  }
  return meilleur;
}

function lireCSV(texte) {
  const sep = separateurCSV(texte);
  const grille = [];
  let ligne = [], champ = '', dans = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (dans) {
      if (ch === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (ch === '"') dans = false;
      else champ += ch;
    } else if (ch === '"') dans = true;
    else if (ch === sep) { ligne.push(champ); champ = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ); grille.push(ligne); ligne = []; champ = '';
    } else champ += ch;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); grille.push(ligne); }
  return grille.map(l => l.map(celluleTexte));
}

function serieExcelEnDate(n, date1904 = false) {
  if (!Number.isFinite(n) || n < (date1904 ? 0 : 1)) return null;
  const jour = Math.floor(n);
  let base;
  if (date1904) base = Date.UTC(1904, 0, 1);
  else if (jour === 60) return null;
  else base = jour > 60 ? Date.UTC(1899, 11, 30) : Date.UTC(1899, 11, 31);
  return new Date(base + jour * 864e5).toISOString().slice(0, 10);
}

function formatEstDate(id, code) {
  if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
  if (!code) return false;
  const nu = String(code).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').toLowerCase();
  return /[dy]/.test(nu);
}

const lire16 = (b, o) => b[o] | (b[o + 1] << 8);
const lire32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function entreesZip(b) {
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (lire32(b, i) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new ErreurImport('zip-incomplet');
  const n = lire16(b, fin + 10);
  let o = lire32(b, fin + 16);
  const entrees = new Map();
  for (let k = 0; k < n; k++) {
    if (o + 46 > b.length || lire32(b, o) !== 0x02014b50) throw new ErreurImport('zip-incomplet');
    const drapeau = lire16(b, o + 8), methode = lire16(b, o + 10);
    const taille = lire32(b, o + 20), brute = lire32(b, o + 24);
    const lnom = lire16(b, o + 28), lext = lire16(b, o + 30), lcom = lire16(b, o + 32);
    const local = lire32(b, o + 42);
    const nom = new TextDecoder().decode(b.subarray(o + 46, o + 46 + lnom));
    if (drapeau & 1) throw new ErreurImport('zip-chiffre');
    if (taille === 0xFFFFFFFF || brute === 0xFFFFFFFF || local === 0xFFFFFFFF) throw new ErreurImport('zip64');
    entrees.set(nom, { methode, taille, brute, local });
    o += 46 + lnom + lext + lcom;
  }
  return entrees;
}

async function contenuZip(b, entree, budget) {
  const o = entree.local;
  if (o + 30 > b.length || lire32(b, o) !== 0x04034b50) throw new ErreurImport('zip-incomplet');
  const debut = o + 30 + lire16(b, o + 26) + lire16(b, o + 28);
  if (debut + entree.taille > b.length) throw new ErreurImport('zip-incomplet');
  if (entree.brute > budget.reste) throw new ErreurImport('trop-gros');
  const donnees = b.subarray(debut, debut + entree.taille);
  let sortie;
  if (entree.methode === 0) sortie = donnees;
  else if (entree.methode === 8) {
    const lecteur = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const morceaux = [];
    let total = 0;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.length;
      if (total > entree.brute) { await lecteur.cancel(); throw new ErreurImport('zip-incomplet'); }
      morceaux.push(value);
    }
    sortie = new Uint8Array(total);
    let o2 = 0;
    for (const m of morceaux) { sortie.set(m, o2); o2 += m.length; }
  } else throw new ErreurImport('zip-methode');
  if (sortie.length !== entree.brute) throw new ErreurImport('zip-incomplet');
  budget.reste -= sortie.length;
  return new TextDecoder().decode(sortie);
}

const elementsXML = (noeud, nom) => [...noeud.getElementsByTagNameNS('*', nom)];
const xml = texte => {
  const doc = new DOMParser().parseFromString(texte, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new ErreurImport('xlsx-illisible');
  return doc;
};
const texteRiche = el => elementsXML(el, 't')
  .filter(t => !(t.parentNode && t.parentNode.localName === 'rPh'))
  .map(t => t.textContent).join('');

function colonneDeReference(ref) {
  const m = /^([A-Z]+)/.exec(String(ref || ''));
  if (!m) return null;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function lireXLSX(buffer) {
  const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const entrees = entreesZip(b);
  const budget = { reste: IMPORT_LIMITES.decompresse };
  const lire = async nom => {
    const e = entrees.get(nom);
    return e ? contenuZip(b, e, budget) : null;
  };
  const wbTexte = await lire('xl/workbook.xml');
  if (!wbTexte) throw new ErreurImport('xlsx-illisible');
  const wb = xml(wbTexte);
  const pr = elementsXML(wb, 'workbookPr')[0];
  const date1904 = !!pr && /^(1|true)$/i.test(pr.getAttribute('date1904') || '');
  const rels = new Map();
  const relsTexte = await lire('xl/_rels/workbook.xml.rels');
  if (relsTexte) for (const r of elementsXML(xml(relsTexte), 'Relationship')) {
    const cible = r.getAttribute('Target') || '';
    rels.set(r.getAttribute('Id'), cible.startsWith('/') ? cible.slice(1) : `xl/${cible}`);
  }
  const partages = [];
  const ssTexte = await lire('xl/sharedStrings.xml');
  if (ssTexte) for (const si of elementsXML(xml(ssTexte), 'si')) partages.push(texteRiche(si));
  const styleDate = [];
  const stTexte = await lire('xl/styles.xml');
  if (stTexte) {
    const st = xml(stTexte);
    const codes = new Map(elementsXML(st, 'numFmt').map(f => [+f.getAttribute('numFmtId'), f.getAttribute('formatCode')]));
    const xfs = elementsXML(st, 'cellXfs')[0];
    if (xfs) for (const xf of [...xfs.children].filter(e => e.localName === 'xf')) {
      const id = +xf.getAttribute('numFmtId') || 0;
      styleDate.push(formatEstDate(id, codes.get(id)));
    }
  }
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const feuilles = [];
  for (const s of elementsXML(wb, 'sheet')) {
    const rid = s.getAttributeNS(RNS, 'id') || s.getAttribute('r:id');
    const chemin = rels.get(rid);
    const texte = chemin ? await lire(chemin) : null;
    if (!texte) continue;
    const grille = [];
    for (const row of elementsXML(xml(texte), 'row')) {
      const ligne = [];
      for (const c of [...row.children].filter(e => e.localName === 'c')) {
        const col = colonneDeReference(c.getAttribute('r'));
        const i = col == null ? ligne.length : col;
        const t = c.getAttribute('t') || 'n';
        const vEl = [...c.children].find(e => e.localName === 'v');
        const fEl = [...c.children].find(e => e.localName === 'f');
        const v = vEl ? vEl.textContent : null;
        let cel;
        if (t === 's') cel = celluleTexte(partages[+v] ?? '');
        else if (t === 'inlineStr') {
          const is = [...c.children].find(e => e.localName === 'is');
          cel = celluleTexte(is ? texteRiche(is) : '');
        } else if (t === 'str') cel = v == null ? { t: 'illisible', v: null } : celluleTexte(v);
        else if (t === 'b') cel = v == null ? celluleVide : celluleTexte(v === '1' ? 'VRAI' : 'FAUX');
        else if (t === 'e') cel = { t: 'illisible', v: null };
        else if (v == null || v === '') cel = fEl ? { t: 'illisible', v: null } : celluleVide;
        else {
          const n = Number(v);
          if (!Number.isFinite(n)) cel = { t: 'illisible', v: null };
          else if (styleDate[+c.getAttribute('s') || 0]) {
            const d = serieExcelEnDate(n, date1904);
            cel = d ? { t: 'date', v: d } : { t: 'illisible', v: null };
          } else cel = { t: 'nombre', v: n };
        }
        ligne[i] = cel;
      }
      const idx = +row.getAttribute('r');
      grille[Number.isFinite(idx) && idx > 0 ? idx - 1 : grille.length] =
        Array.from(ligne, x => x || celluleVide);
    }
    feuilles.push({ nom: s.getAttribute('name') || '', grille: Array.from(grille, l => l || []) });
  }
  return feuilles;
}

async function lireFichierTableau(nom, buffer) {
  const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (b.length > IMPORT_LIMITES.fichier) throw new ErreurImport('trop-gros');
  if (b.length >= 4 && lire32(b, 0) === 0xE011CFD0) throw new ErreurImport('xls');
  if (b.length >= 4 && lire32(b, 0) === 0x04034b50) return lireXLSX(b);
  if (/\.(xlsx|xlsm)$/i.test(nom)) throw new ErreurImport('xlsx-illisible');
  return [{ nom: String(nom || '').replace(/\.[^.]+$/, ''), grille: lireCSV(decoderTexte(b)) }];
}

function nombreDepuisTexte(s) {
  let t = String(s ?? '').replace(/[\s  ]/g, '').replace(/[€$£]|EUR|USD|CHF/gi, '');
  if (!t) return null;
  let signe = 1;
  if (/^\(.*\)$/.test(t)) { signe = -1; t = t.slice(1, -1); }
  if (/-$/.test(t)) { signe = -signe; t = t.slice(0, -1); }
  if (/^[+-]/.test(t)) { if (t[0] === '-') signe = -signe; t = t.slice(1); }
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const v = t.lastIndexOf(','), p = t.lastIndexOf('.');
  if (v >= 0 && p >= 0) {
    const dec = v > p ? ',' : '.', mil = dec === ',' ? '.' : ',';
    t = t.split(mil).join('').replace(dec, '.');
  } else if (v >= 0 || p >= 0) {
    const sep = v >= 0 ? ',' : '.';
    if (new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(t)) t = t.split(sep).join('');
    else if (t.split(sep).length > 2) return null;
    else t = t.replace(sep, '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? signe * n : null;
}

function nombreDepuisCellule(c) {
  if (!c || c.t === 'vide') return null;
  if (c.t === 'nombre') return c.v;
  if (c.t === 'texte') return nombreDepuisTexte(c.v);
  return null;
}

const celluleMonetaire = c => !!c && c.t !== 'vide'
  && !(c.t === 'texte' && /^(\s*[-\u2013\u2014.]*\s*|n\/?a)$/i.test(c.v));

const MOIS_NOMS = [
  ['janvier', 'janv', 'jan', 'january'], ['fevrier', 'fevr', 'fev', 'feb', 'february'],
  ['mars', 'mar', 'march'], ['avril', 'avr', 'apr', 'april'], ['mai', 'may'],
  ['juin', 'jun', 'june'], ['juillet', 'juil', 'jul', 'july'], ['aout', 'aug', 'august'],
  ['septembre', 'sept', 'sep', 'september'], ['octobre', 'oct', 'october'],
  ['novembre', 'nov', 'november'], ['decembre', 'dec', 'december'],
];

const isoJour = (a, m, j) => {
  if (!(a >= 1900 && a <= 2200 && m >= 1 && m <= 12 && j >= 1 && j <= 31)) return null;
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCMonth() === m - 1 ? d.toISOString().slice(0, 10) : null;
};
const anneeComplete = a => (a < 100 ? 2000 + a : a);

function partiesJourMois(s) {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(String(s || '').trim());
  return m ? [+m[1], +m[2], anneeComplete(+m[3])] : null;
}

function ordreDesDates(cellules) {
  let jm = false, mj = false;
  for (const c of cellules) {
    if (!c || c.t !== 'texte') continue;
    const p = partiesJourMois(c.v);
    if (!p) continue;
    if (p[0] > 12) jm = true;
    if (p[1] > 12) mj = true;
  }
  return jm && !mj ? 'jm' : mj && !jm ? 'mj' : null;
}

/* Un jour, en ISO, ou null. `ordre` tranche jj/mm ('jm') ou mm/jj ('mj'). */
function jourDepuisCellule(c, ordre = 'jm') {
  if (!c) return null;
  if (c.t === 'date') return c.v;
  if (c.t !== 'texte') return null;
  const s = c.v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return isoJour(+m[1], +m[2], +m[3]);
  const p = partiesJourMois(s);
  if (p) return ordre === 'mj' ? isoJour(p[2], p[0], p[1]) : isoJour(p[2], p[1], p[0]);
  return null;
}

function moisDepuisCellule(c, ordre = 'jm') {
  const j = jourDepuisCellule(c, ordre);
  if (j) return `${j.slice(0, 7)}-01`;
  if (!c || c.t !== 'texte') return null;
  const s = c.v.trim();
  let m = /^(\d{4})[-/](\d{1,2})$/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-01`;
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${String(+m[1]).padStart(2, '0')}-01`;
  const n = normaliserTexte(s).split(' ');
  if (n.length === 2 && /^\d{2}(\d{2})?$/.test(n[1])) {
    const i = MOIS_NOMS.findIndex(noms => noms.includes(n[0]));
    if (i >= 0) return `${anneeComplete(+n[1])}-${String(i + 1).padStart(2, '0')}-01`;
  }
  return null;
}

function ordreAChoisir(cellules) {
  const ambigues = cellules.some(c => c && c.t === 'texte' && partiesJourMois(c.v));
  return { ordre: ordreDesDates(cellules), aDemander: ambigues && !ordreDesDates(cellules) };
}

const estDonnee = c => !!c && (c.t === 'nombre' || c.t === 'date'
  || (c.t === 'texte' && (nombreDepuisTexte(c.v) != null || moisDepuisCellule(c) != null)));

function detecterEntete(grille) {
  for (let i = 0; i < Math.min(10, grille.length - 1); i++) {
    const textes = (grille[i] || []).filter(c => c && c.t === 'texte' && !estDonnee(c)).length;
    const suivante = (grille[i + 1] || []).filter(estDonnee).length;
    if (textes >= 2 && suivante >= 1) return i;
  }
  return 0;
}

function orienterMoisEnLignes(grille) {
  const premiere = (grille[0] || []).slice(1);
  const mois = premiere.filter(c => moisDepuisCellule(c, 'jm') || moisDepuisCellule(c, 'mj')).length;
  const colonne = grille.slice(1).map(l => l && l[0]);
  const textes = colonne.filter(c => c && c.t === 'texte' && !estDonnee(c)).length;
  if (mois < 2 || mois < premiere.filter(c => c && c.t !== 'vide').length / 2 || textes < colonne.length / 2) {
    return { grille, retournee: false };
  }
  const largeur = Math.max(...grille.map(l => (l || []).length));
  const t = [];
  for (let j = 0; j < largeur; j++) t.push(grille.map(l => (l && l[j]) || celluleVide));
  return { grille: t, retournee: true };
}

const MOTS_COLONNES = {
  date: ['date operation', 'date d operation', 'date comptable', 'date', 'jour', 'booking date', 'transaction date'],
  libelle: ['libelle', 'libelle operation', 'description', 'detail', 'details', 'intitule', 'operation', 'label', 'payee', 'memo'],
  montant: ['montant', 'montant eur', 'amount', 'somme', 'valeur'],
  debit: ['debit', 'debit eur', 'debits', 'sortie', 'sorties', 'withdrawal'],
  credit: ['credit', 'credit eur', 'credits', 'entree', 'entrees', 'deposit'],
  categorie: ['categorie', 'category', 'sous categorie'],
};

function colonneParMots(noms, cle, exclure = []) {
  for (const mot of MOTS_COLONNES[cle]) {
    const i = noms.findIndex((n, k) => !exclure.includes(k) && (n === mot || n.startsWith(`${mot} `)));
    if (i >= 0) return i;
  }
  return -1;
}

function devinerColonnesOperations(entete, lignes) {
  const noms = entete.map(c => normaliserTexte(c && c.v));
  const indices = entete.map((c, i) => i);
  const col = { date: colonneParMots(noms, 'date'), libelle: -1, montant: -1, debit: -1, credit: -1, categorie: -1 };
  if (col.date < 0) col.date = indices.find(i => lignes.slice(0, 5).some(l => jourDepuisCellule(l[i]))) ?? -1;
  const pris = [col.date];
  const debit = colonneParMots(noms, 'debit', pris);
  const credit = colonneParMots(noms, 'credit', [...pris, debit]);
  if (debit >= 0 && credit >= 0) { col.debit = debit; col.credit = credit; pris.push(debit, credit); }
  else {
    col.montant = colonneParMots(noms, 'montant', pris);
    if (col.montant < 0) col.montant = debit >= 0 ? debit : credit;
    if (col.montant >= 0) pris.push(col.montant);
  }
  col.libelle = colonneParMots(noms, 'libelle', pris);
  if (col.libelle < 0) {
    col.libelle = indices.find(i => !pris.includes(i)
      && lignes.slice(0, 5).some(l => l[i] && l[i].t === 'texte' && !estDonnee(l[i]))) ?? -1;
  }
  if (col.libelle >= 0) pris.push(col.libelle);
  col.categorie = colonneParMots(noms, 'categorie', pris);
  return col;
}

function sensMajoritaire(lignes, i) {
  let neg = 0, pos = 0;
  for (const l of lignes) {
    const n = nombreDepuisCellule(l[i]);
    if (n < 0) neg++; else if (n > 0) pos++;
  }
  return neg >= pos ? 'negatif' : 'positif';
}

function lignesOperations(grille, debut, col, { ordre = 'jm', sens = 'negatif' } = {}) {
  const lignes = [], ecartees = [];
  for (let n = debut; n < grille.length; n++) {
    const l = grille[n] || [];
    if (!l.some(c => c && c.t !== 'vide')) continue;
    const libelle = col.libelle >= 0 && l[col.libelle] ? String(l[col.libelle].v ?? '').trim() : '';
    const categorieBanque = col.categorie >= 0 && l[col.categorie] ? String(l[col.categorie].v ?? '').trim() : '';
    const date = col.date >= 0 ? jourDepuisCellule(l[col.date], ordre) : null;
    let montant = null, credit = false, illisible = false;
    const lire = i => {
      if (i < 0) return null;
      const n = nombreDepuisCellule(l[i]);
      if (n == null && celluleMonetaire(l[i])) illisible = true;
      return n;
    };
    let lesDeux = false, deuxMontants = 0;
    if (col.debit >= 0 || col.credit >= 0) {
      const d = lire(col.debit), c = lire(col.credit);
      lesDeux = !!d && !!c;
      if (lesDeux) deuxMontants = round2(Math.abs(d) + Math.abs(c));
      if (d) montant = Math.abs(d);
      else if (c) { montant = Math.abs(c); credit = true; }
      else if (d === 0 || c === 0) montant = 0;
    } else {
      const m = lire(col.montant);
      if (m != null) {
        const depense = sens === 'negatif' ? m < 0 : m > 0;
        montant = Math.abs(m);
        credit = !depense && m !== 0;
      }
    }
    const pied = !date && /\b(total|solde|sous total|balance)\b/.test(normaliserTexte(libelle));
    if (pied) { ecartees.push({ n, raison: 'pied', montant, libelle }); continue; }
    if (illisible) { ecartees.push({ n, raison: 'montant', libelle, date }); continue; }
    if (lesDeux) { ecartees.push({ n, raison: 'debit-credit', montant: deuxMontants, libelle, date }); continue; }
    if (montant == null) { ecartees.push({ n, raison: 'vide', libelle, date }); continue; }
    if (!date) { ecartees.push({ n, raison: 'date', montant, libelle }); continue; }
    if (!(montant > 0)) { ecartees.push({ n, raison: 'zero', montant: 0, libelle, date }); continue; }
    lignes.push({ n, date, libelle, montant: round2(montant), credit, categorieBanque });
  }
  return { lignes, ecartees };
}

const PREFIXES_BANCAIRES = new Set(['cb', 'carte', 'prlv', 'prelevement', 'sepa', 'vir', 'virement',
  'paiement', 'achat', 'fact', 'facture', 'retrait', 'dab', 'pay', 'paypal', 'europe', 'inst', 'emis',
  'recu', 'card', 'payment', 'purchase', 'debit', 'du', 'le', 'de', 'la', 'des', 'et', 'chez', 'frais']);
function cleMarchand(libelle) {
  const mots = normaliserTexte(libelle).split(' ')
    .filter(m => m.length > 1 && !/\d/.test(m) && !PREFIXES_BANCAIRES.has(m));
  return mots.slice(0, mots.length > 3 ? 2 : 3).join(' ');
}

function chargeFixeProbable(ligne, charges) {
  const lib = normaliserTexte(ligne.libelle);
  for (const c of charges || []) {
    const montants = [num(c.amount), chargeMensuelle(c)].filter(x => x > 0);
    if (montants.some(m => Math.abs(m - ligne.montant) < 0.005)) return c;
    for (const nom of [c.label, c.provider]) {
      const n = normaliserTexte(nom);
      if (n.length >= 4 && lib.includes(n)) return c;
    }
  }
  return null;
}

const IGNORER = '__ignorer';

function proposerCategories(lignes, { regles = {}, categories = [], charges = [] } = {}) {
  const parNom = new Map(categories.map(c => [normaliserTexte(c), c]));
  return lignes.map(l => {
    const cle = cleMarchand(l.libelle);
    if (cle && regles[cle] && (regles[cle] === IGNORER || categories.includes(regles[cle]))) {
      return { cle, choix: regles[cle], raison: 'regle' };
    }
    const banque = parNom.get(normaliserTexte(l.categorieBanque));
    if (banque) return { cle, choix: banque, raison: 'banque' };
    if (chargeFixeProbable(l, charges)) return { cle, choix: IGNORER, raison: 'charge' };
    return { cle, choix: '', raison: '' };
  });
}

function planOperations(lignes, choix) {
  const mois = {};
  const r = { importe: 0, credits: 0, ignore: 0, aClasser: 0, nImporte: 0, nCredits: 0, nIgnore: 0, aChoisir: 0 };
  lignes.forEach((l, i) => {
    if (l.credit) { r.credits += l.montant; r.nCredits++; return; }
    const c = choix[i];
    if (c === IGNORER) { r.ignore += l.montant; r.nIgnore++; return; }
    if (!c) { r.aChoisir++; r.aClasser += l.montant; return; }
    const m = `${l.date.slice(0, 7)}-01`;
    const e = mois[m] || (mois[m] = { v: {}, total: 0, n: 0, du: l.date, au: l.date });
    e.v[c] = (e.v[c] || 0) + l.montant;
    e.n++;
    if (l.date < e.du) e.du = l.date;
    if (l.date > e.au) e.au = l.date;
    r.importe += l.montant; r.nImporte++;
  });
  for (const e of Object.values(mois)) {
    for (const c of Object.keys(e.v)) e.v[c] = round2(e.v[c]);
    e.total = round2(Object.values(e.v).reduce((s, x) => s + x, 0));
  }
  for (const k of ['importe', 'credits', 'ignore', 'aClasser']) r[k] = round2(r[k]);
  return { mois, rapprochement: r };
}

const dernierJourDuMois = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);

function etatMoisImport(m, e, existant, aujourdhui = todayISO(), forme = 'operations') {
  const courant = `${String(aujourdhui).slice(0, 7)}-01`;
  const total = existant ? round2(expenseRowTotalBrut(existant)) : 0;
  const disparues = existant && forme === 'operations' ? Object.keys(existant.v || {})
    .filter(c => num(existant.v[c]) && !(c in (e.v || {}))).map(c => ({ categorie: c, montant: num(existant.v[c]) })) : [];
  const aVenir = m > courant;
  const enCours = m === courant;
  const incomplet = forme === 'operations' && !enCours && !aVenir && !!e.du
    && (+e.du.slice(8, 10) > 3 || e.au < dernierJourDuMois(m));
  const saisi = total > 0.005;
  const defaut = aVenir ? 'garder' : saisi ? 'garder' : incomplet ? 'garder' : 'remplacer';
  return { mois: m, total, importe: e.total, disparues, aVenir, enCours, incomplet, saisi, defaut };
}

const expenseRowTotalBrut = r => Object.values((r && r.v) || {}).reduce((s, x) => s + num(x), 0);

function devinerColonnesMois(entete, lignes, categories) {
  const parNom = new Map(categories.map(c => [normaliserTexte(c), c]));
  const date = entete.map((c, i) => i).find(i => lignes.slice(0, 5).some(l => moisDepuisCellule(l[i]))) ?? -1;
  return { date, colonnes: entete.map((c, i) => (i === date ? null : parNom.get(normaliserTexte(c && c.v)) || '')) };
}

function devinerFormeDepenses(entete, lignes, categories) {
  const { colonnes } = devinerColonnesMois(entete, lignes, categories);
  const noms = entete.map(c => normaliserTexte(c && c.v));
  return colonnes.filter(Boolean).length >= 1 && colonneParMots(noms, 'libelle') < 0 ? 'mois' : 'operations';
}

function lignesParMois(grille, debut, colDate, cibles, ordre = 'jm') {
  const lignes = [], ecartees = [], parMois = {};
  for (let n = debut; n < grille.length; n++) {
    const l = grille[n] || [];
    if (!l.some(c => c && c.t !== 'vide')) continue;
    const mois = colDate >= 0 ? moisDepuisCellule(l[colDate], ordre) : null;
    const valeurs = {};
    let illisible = false, aValeur = false;
    cibles.forEach((cible, i) => {
      if (!cible) return;
      const v = nombreDepuisCellule(l[i]);
      if (v == null) { if (celluleMonetaire(l[i])) illisible = true; return; }
      (valeurs[cible] = valeurs[cible] || []).push(v);
      aValeur = true;
    });
    if (!mois) {
      const texte = l.map(c => (c && c.t === 'texte' ? c.v : '')).join(' ');
      ecartees.push({ n, raison: /\b(total|moyenne|somme)\b/.test(normaliserTexte(texte)) ? 'pied' : 'date' });
      continue;
    }
    if (illisible) { ecartees.push({ n, raison: 'montant', mois }); continue; }
    if (!aValeur) continue;
    const ligne = { n, mois, valeurs };
    lignes.push(ligne);
    (parMois[mois] = parMois[mois] || []).push(ligne);
  }
  const doublons = Object.fromEntries(Object.entries(parMois).filter(([, ls]) => ls.length > 1)
    .map(([m, ls]) => [m, ls.map(x => x.n)]));
  return { lignes, ecartees, doublons };
}

const MOTS_DETTE = ['dette', 'dettes', 'emprunt', 'emprunts', 'pret', 'prets', 'capital restant', 'credits en cours',
  'outstanding loans', 'loan', 'loans', 'debt', 'debts', 'mortgage'];
const MOTS_IGNORES_RELEVE = ['total', 'patrimoine', 'net', 'brut', 'commentaire', 'comment', 'note', 'cash', 'variation'];

/* La cible de chaque colonne d'un tableau de releves : 'date', un compte
   ({ compte: id }), 'dettes', IGNORER, ou '' (a choisir). L'ordre de lecture
   decide, et il va du plus sur au moins sur :
     1. une marque finale explicite : « [identifiant] » designe ce compte,
        ouvert ou cloture, « [dettes] » les credits du mois ;
     2. la colonne des mois, par son CONTENU : une colonne de mois n'est pas un
        solde, meme si un compte porte le nom de son en-tete ;
     3. le libelle exact d'un compte ouvert, puis « libelle etablissement »,
        chacun seulement s'il designe UN compte ;
     4. les mots de dette, parmi les colonnes qui restent : une colonne
        reconnue comme compte n'est jamais une dette ;
     5. les en-tetes sans montant a saisir (`ignorer`, totaux, commentaire),
        puis l'etablissement qui ne porte qu'un compte ouvert.
   Un compte cloture ne se pre-remplit que par sa marque. */
function devinerColonnesReleves(entete, lignes, comptes, { ignorer = [] } = {}) {
  const ouverts = comptes.filter(a => !a.legacy);
  const ids = new Set(comptes.map(a => a.id));
  const ignores = new Set(ignorer.map(normaliserTexte));
  const bruts = entete.map(c => String((c && c.v) ?? '').trim());
  const noms = bruts.map(normaliserTexte);
  const seul = liste => (liste.length === 1 ? liste[0] : null);
  const cibles = bruts.map(b => {
    const m = /\[([^\][]+)\]\s*$/.exec(b);
    if (!m) return undefined;
    const marque = m[1].trim();
    if (marque === 'dettes') return 'dettes';
    return ids.has(marque) ? { compte: marque } : undefined;
  });
  const date = noms.findIndex((n, i) => cibles[i] === undefined
    && lignes.slice(0, 5).some(l => moisDepuisCellule(l[i])));
  if (date >= 0) cibles[date] = 'date';
  noms.forEach((n, i) => {
    if (cibles[i] !== undefined || !n) return;
    const a = seul(ouverts.filter(x => normaliserTexte(x.label) === n))
      || seul(ouverts.filter(x => normaliserTexte(`${x.label} ${x.broker || ''}`) === n));
    if (a) cibles[i] = { compte: a.id };
  });
  const dettes = noms.map((n, i) => (cibles[i] === undefined && n
    && ((n === 'credits' && noms.includes('total brut')) || MOTS_DETTE.some(m => n === m || n.includes(m))) ? i : -1))
    .filter(i => i >= 0);
  return noms.map((n, i) => {
    if (cibles[i] !== undefined) return cibles[i];
    if (!n) return IGNORER;
    if (dettes.length === 1 && dettes[0] === i) return 'dettes';
    if (dettes.includes(i)) return '';
    if (ignores.has(n) || / cash$/.test(n) || MOTS_IGNORES_RELEVE.some(m => n === m || n.startsWith(`${m} `))) return IGNORER;
    const parEtab = ouverts.filter(a => normaliserTexte(a.broker) === n);
    if (parEtab.length === 1) return { compte: parEtab[0].id };
    const numerique = lignes.slice(0, 5).some(l => nombreDepuisCellule(l[i]) != null);
    return numerique ? '' : IGNORER;
  });
}

function blocagesColonnesReleves(entete, cibles) {
  const blocages = [];
  const vus = new Map();
  cibles.forEach((c, i) => {
    if (c && typeof c === 'object') {
      if (vus.has(c.compte)) blocages.push({ code: 'compte-double', compte: c.compte, colonnes: [vus.get(c.compte), i] });
      else vus.set(c.compte, i);
    }
  });
  const dettes = cibles.map((c, i) => (c === 'dettes' ? i : -1)).filter(i => i >= 0);
  if (dettes.length > 1 && dettes.some(i => /\btotal\b/.test(normaliserTexte(entete[i] && entete[i].v)))) {
    blocages.push({ code: 'dettes-total', colonnes: dettes });
  }
  if (!cibles.includes('date')) blocages.push({ code: 'sans-date' });
  return blocages;
}

function blocagesColonnesMois(cibles, colDate) {
  const blocages = [];
  const vus = new Map();
  cibles.forEach((c, i) => {
    if (!c || c === IGNORER) return;
    if (vus.has(c)) blocages.push({ code: 'categorie-double', categorie: c, colonnes: [vus.get(c), i] });
    else vus.set(c, i);
  });
  if (colDate < 0) blocages.push({ code: 'sans-date' });
  return blocages;
}

/* La cle de cible d'une colonne de releve, telle que `lignesParMois` la
   regroupe : l'identifiant du compte, ou 'dettes'. */
const cleCibleReleve = c => (c && typeof c === 'object' ? `compte:${c.compte}` : c === 'dettes' ? 'dettes' : null);

function planParMois(lignes, cible, choixDoublons = {}) {
  const mois = {};
  for (const l of lignes) {
    const garde = choixDoublons[l.mois];
    if (garde != null && garde !== l.n) continue;
    const e = { v: {} };
    for (const [cle, vals] of Object.entries(l.valeurs)) {
      const somme = vals.reduce((s, x) => s + x, 0);
      if (cible === 'releves') {
        if (cle === 'dettes') e.dettes = round2(vals.reduce((s, x) => s + Math.abs(x), 0));
        else if (cle.startsWith('compte:')) e.v[cle.slice(7)] = round2(somme);
      } else e.v[cle] = round2(Math.abs(somme));
    }
    mois[l.mois] = e;
  }
  return mois;
}

const doublonsNonResolus = (doublons, choix = {}) => Object.keys(doublons).filter(m => choix[m] == null);

const RAISONS_A_DECIDER = ['date', 'montant', 'debit-credit'];

function blocagesOperations({ col, ordreADemander = false, ordre = null, lignes = [], choix = [],
                              ecartees = [], ecarteesAcceptees = false }) {
  const b = [];
  if (!col || col.date < 0) b.push({ code: 'sans-date' });
  if (!col || (col.montant < 0 && col.debit < 0 && col.credit < 0)) b.push({ code: 'sans-montant' });
  if (col && col.debit >= 0 && col.debit === col.credit) b.push({ code: 'meme-colonne' });
  if (ordreADemander && !ordre) b.push({ code: 'ordre' });
  const aDecider = ecartees.filter(e => RAISONS_A_DECIDER.includes(e.raison)).length;
  if (aDecider && !ecarteesAcceptees) b.push({ code: 'ecartees', n: aDecider });
  const sans = lignes.filter((l, i) => !l.credit && !choix[i]).length;
  if (sans) b.push({ code: 'a-choisir', n: sans });
  return b;
}

function rapprochementOperations(lignes, ecartees, plan) {
  const r = plan.rapprochement;
  const ecarte = round2(ecartees.reduce((s, e) => s + (Number.isFinite(e.montant) ? e.montant : 0), 0));
  const lu = round2(lignes.reduce((s, l) => s + l.montant, 0) + ecarte);
  return { lu, importe: r.importe, credits: r.credits, ignore: r.ignore, aClasser: r.aClasser, ecarte,
           illisibles: ecartees.filter(e => e.raison === 'montant').length };
}

/* L'application d'un plan sur un ETAT (un clone), sans rien sauvegarder. Le
   plan porte les mois retenus, deja resolus (doublons choisis, decisions
   prises). Rend le nombre de mois modifies.

   plan.cible 'depenses', forme 'operations' : le `v` du mois est REMPLACE par
   les totaux importes ; reimporter le meme fichier donne le meme etat.
   Forme 'mois' : seules les categories presentes changent ; zero retire la
   cle, comme la saisie manuelle.
   plan.cible 'releves' : seuls les comptes presents changent ; un releve sans
   `parts` se convertit d'abord comme a la saisie manuelle (`parts` de tout le
   releve, `poches` retire), un releve qui en porte ne recalcule que les
   comptes importes ; `dettes` se remplace si une colonne y va ; la date de la
   photo s'efface sur un mois modifie. */
function appliquerImport(etat, plan) {
  let modifies = 0;
  if (plan.cible === 'depenses') {
    const b = etat.budget;
    for (const [m, e] of Object.entries(plan.mois)) {
      let r = b.expenses.find(x => x.month === m);
      if (!r) { r = { month: m, note: '', v: {} }; b.expenses.push(r); }
      if (plan.forme === 'operations') {
        r.v = Object.fromEntries(Object.entries(e.v).filter(([, x]) => num(x)).map(([c, x]) => [c, round2(x)]));
      } else {
        const v = { ...(r.v || {}) };
        for (const [c, x] of Object.entries(e.v)) {
          if (num(x)) v[c] = round2(x); else delete v[c];
        }
        r.v = v;
      }
      delete r.avantRegroupement;
      modifies++;
    }
    ensureCalendarMonths(b.expenses, 'month', 'note');
    if (plan.regles) b.reglesImport = { ...(b.reglesImport || {}), ...plan.regles };
  } else if (plan.cible === 'releves') {
    for (const [m, e] of Object.entries(plan.mois)) {
      let r = etat.monthly.find(x => x.date === m);
      if (!r) { r = { date: m, comment: '', v: {} }; etat.monthly.push(r); }
      const v = { ...(r.v || {}), ...e.v };
      if (!r.parts) {
        r.parts = partsDuReleve(v);
        delete r.poches;
      } else {
        const neuves = partsDuReleve(e.v);
        for (const id of Object.keys(e.v)) {
          if (neuves[id]) r.parts[id] = neuves[id]; else delete r.parts[id];
        }
        for (const id of Object.keys(r.parts)) if (!(id in v)) delete r.parts[id];
        for (const id of Object.keys(v)) {
          if (id in e.v) continue;
          const p = r.parts[id];
          if (!p) { const n = partsDuReleve({ [id]: v[id] })[id]; if (n) r.parts[id] = n; continue; }
          const reste = round2(round2(num(v[id])) - Object.values(p).reduce((s, x) => s + num(x), 0));
          if (!reste) continue;
          if (Math.abs(reste) <= 0.05) {
            const k = Object.keys(p).reduce((g, x) => (Math.abs(num(p[x])) > Math.abs(num(p[g])) ? x : g));
            p[k] = round2(num(p[k]) + reste);
          } else {
            const n = partsDuReleve({ [id]: v[id] })[id];
            if (n) r.parts[id] = n; else delete r.parts[id];
          }
        }
      }
      r.v = v;
      if (e.dettes != null) r.dettes = round2(e.dettes);
      delete r.clotureLe;
      modifies++;
    }
    etat.monthly.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  return modifies;
}

function verifierImport(etat, plan) {
  for (const [m, e] of Object.entries(plan.mois)) {
    if (plan.cible === 'depenses') {
      const r = etat.budget.expenses.find(x => x.month === m);
      if (!r) return false;
      for (const [c, x] of Object.entries(e.v)) if (Math.abs(num(r.v[c]) - round2(x)) > 0.005) return false;
    } else {
      const r = etat.monthly.find(x => x.date === m);
      if (!r) return false;
      for (const [id, x] of Object.entries(e.v)) if (Math.abs(num(r.v[id]) - num(x)) > 0.005) return false;
      if (e.dettes != null && Math.abs(num(r.dettes) - num(e.dettes)) > 0.005) return false;
      const somme = Object.values(r.v).reduce((s, x) => s + num(x), 0);
      if (Math.abs(rowTotal(r) - somme) > 0.005) return false;
    }
  }
  return true;
}

/* L'ecriture en bloc : le resultat se construit et se verifie sur un clone,
   puis remplace l'etat en une seule affectation, suivie d'une seule
   sauvegarde. Une erreur avant l'affectation laisse l'etat intact. Le retour
   dit si l'ecriture a atteint l'appareil (`Store._ecritureKo`). */
function ecrireImport(plan, { sauver = true } = {}) {
  const avant = Store.state;
  let apres, modifies;
  try {
    apres = structuredClone(avant);
    modifies = appliquerImport(apres, plan);
    if (!verifierImport(apres, plan)) return { ok: false, erreur: 'verification' };
  } catch (e) {
    return { ok: false, erreur: (e && e.message) || 'erreur' };
  }
  Store.state = apres;
  refreshAccounts();
  if (sauver) Store.save();
  return { ok: true, modifies, enregistre: !Store._ecritureKo };
}

/* --- MODELES A REMPLIR ----------------------------------------------------

   Un classeur pret a remplir, fait des colonnes de CE profil : ses
   categories, ses comptes ouverts, ecrits tels qu'il les porte (seuls les
   en-tetes fixes passent par la langue). Rempli puis importe, il se relit sans
   rien associer a la main ; importe vide, il ne change rien. Une seule feuille,
   "A remplir" : l'exemple vit dans la fenetre, il ne peut donc jamais
   s'importer. Rend des feuilles au format de `Xlsx.build`. */

const enTetesReserves = () => new Set(['Mois', 'Month', 'Crédits en cours', 'Outstanding loans',
  trad('Mois'), trad('Crédits en cours')].map(normaliserTexte));

function enTetesComptes(ouverts) {
  const reserves = enTetesReserves();
  const parNom = new Map();
  for (const a of ouverts) {
    const n = normaliserTexte(a.label);
    parNom.set(n, (parNom.get(n) || 0) + 1);
  }
  return ouverts.map(a => {
    const n = normaliserTexte(a.label);
    return !n || parNom.get(n) > 1 || reserves.has(n) ? `${a.label} [${a.id}]` : a.label;
  });
}

function modeleOperations() {
  return [{ name: trad('À remplir'), rows: [], cols: [
    { h: trad('Date'), t: 'date', w: 12 }, { h: trad('Libellé'), t: 'text', w: 40 }, { h: trad('Montant'), t: 'eur', w: 14 }] }];
}

function modeleDepensesParMois(categories, annee) {
  const rows = Array.from({ length: 12 }, (_, i) =>
    [`${annee}-${String(i + 1).padStart(2, '0')}-01`, ...categories.map(() => null)]);
  return [{ name: trad('À remplir'), rows, cols: [
    { h: trad('Mois'), t: 'date', w: 12 }, ...categories.map(c => ({ h: c, t: 'eur', w: 14 }))] }];
}

function modeleReleves(comptes, aujourdhui = todayISO(), avecDettes = false) {
  const ouverts = comptes.filter(a => !a.legacy);
  const entetes = enTetesComptes(ouverts);
  const nomDettes = trad('Crédits en cours');
  const conflit = ouverts.some(a => normaliserTexte(a.label) === normaliserTexte(nomDettes));
  const [an, mois] = String(aujourdhui).split('-').map(Number);
  const dates = Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(an, mois - 12 + i, 1)).toISOString().slice(0, 10));
  const cols = [{ h: trad('Mois'), t: 'date', w: 12 }, ...entetes.map(h => ({ h, t: 'eur', w: 16 }))];
  if (avecDettes) cols.push({ h: conflit ? `${nomDettes} [dettes]` : nomDettes, t: 'eur', w: 16 });
  return [{ name: trad('À remplir'), cols, rows: dates.map(d => [d, ...cols.slice(1).map(() => null)]) }];
}

/* L'import complet : une sauvegarde d'abord, une question si elle echoue,
   l'ecriture en bloc, puis ce qui en est vraiment advenu. `confirmer` pose la
   question (la fenetre lui passe `askConfirm`). Rend `annule`, `erreur`,
   `session` (ecrit en memoire, refuse par le stockage) ou `enregistre`. */
async function importerAvecSauvegarde(plan, confirmer) {
  if (!Store.addBackup('avant import d’un fichier') && !await confirmer()) return { statut: 'annule' };
  const r = ecrireImport(plan);
  if (!r.ok) return { statut: 'erreur' };
  return { statut: r.enregistre ? 'enregistre' : 'session', modifies: r.modifies };
}

partieChargee('assets/store-08-import.js');
