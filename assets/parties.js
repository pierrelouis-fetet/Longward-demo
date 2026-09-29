/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const GROUPES = {
  'assets/i18n.js': [
    'assets/i18n-1-socle.js',
    'assets/i18n-2-anglais.js',
    'assets/i18n-3-anglais-fin.js'
  ],
  'assets/store.js': [
    'assets/store-01-socle.js',
    'assets/store-02-bases-calcul-nommees.js',
    'assets/store-03-calculs-1.js',
    'assets/store-04-calculs-2.js',
    'assets/store-05-analyses.js',
    'assets/store-06-controles-coherence.js',
    'assets/store-07-societes.js'
  ],
  'assets/app.js': [
    'assets/app-01-socle.js',
    'assets/app-02-vue-ensemble.js',
    'assets/app-03-positions.js',
    'assets/app-04-cours-automatiques.js',
    'assets/app-05-avoirs-comptes-portefeuilles.js',
    'assets/app-06-fiche-compte-page.js',
    'assets/app-07-budget-depenses.js',
    'assets/app-08-actions-apercu.js',
    'assets/app-08-actions-marches.js',
    'assets/app-08-actions-allocation.js',
    'assets/app-08-actions-comptes.js',
    'assets/app-08-actions-budget.js',
    'assets/app-08-actions-donnees.js',
    'assets/app-09-rendu.js',
    'assets/app-10-formulaire-generique.js',
    'assets/app-11-fenetre-apercu.js'
  ],
  'assets/styles.css': [
    'assets/styles-01-socle.css',
    'assets/styles-02-barre-progression-objectif.css',
    'assets/styles-03-vue-tableau-graphiques.css',
    'assets/styles-04-telephone-menu-passe.css'
  ],
};

const PARTIES_CHARGEES = new Set();
function partieChargee(chemin) { PARTIES_CHARGEES.add(chemin); }

const estPartie = chemin => Object.values(GROUPES).some(liste => liste.includes(chemin));
const cheminDe = url => String(url || '').split('?')[0].replace(/^.*?(?=assets\/)/, '');

function partiesManquantes() {
  return [...document.querySelectorAll('script[src]')]
    .map(s => cheminDe(s.getAttribute('src')))
    .filter(p => estPartie(p) && !PARTIES_CHARGEES.has(p));
}

const CONTROLE = /[?&]controle=1(&|$)/.test(location.search);
let ECHEC_DE_CHARGEMENT = null;
function signalerErreur(e) {
  const m = e && e.message ? e.message : String(e);
  if (!ECHEC_DE_CHARGEMENT) ECHEC_DE_CHARGEMENT = m;
  if (CONTROLE) document.title = '✕ chargement : ' + ECHEC_DE_CHARGEMENT;
}
function signalerRendu() {
  if (CONTROLE && !ECHEC_DE_CHARGEMENT) document.title = '✓ rendu ' + (document.body.dataset.vue || '?');
}

function apresDeuxTrames(fn) {
  if (document.visibilityState === 'hidden') { setTimeout(fn, 0); return; }
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

function signalerPartiesManquantes(liste = partiesManquantes()) {
  signalerErreur('parties manquantes : ' + liste.join(', '));
  document.getElementById('lancement')?.remove();
  if (document.getElementById('parties-manquantes')) return;
  const b = document.createElement('div');
  b.id = 'parties-manquantes';
  b.setAttribute('role', 'alert');
  b.style.cssText = 'position:fixed;inset:0 0 auto 0;z-index:9999;padding:16px;'
    + 'background:#b3261e;color:#fff;font:16px/1.4 system-ui,sans-serif';
  b.textContent = 'Une partie de l’application n’a pas chargé (' + liste.join(', ') + '). Recharge la page.';
  (document.body || document.documentElement).appendChild(b);
}

addEventListener('error', e => {
  const cible = e.target;
  if (cible && cible !== window && (cible.tagName === 'SCRIPT' || cible.tagName === 'LINK')) {
    signalerErreur('chargement de ' + cheminDe(cible.src || cible.href));
  } else if (cible === window || !cible) {
    signalerErreur(e.error || e.message);
  }
}, true);
addEventListener('unhandledrejection', e => signalerErreur(e.reason || 'promesse rejetée'));

addEventListener('load', () => {
  const feuilles = [...document.querySelectorAll('link[rel="stylesheet"][href]')]
    .filter(l => estPartie(cheminDe(l.getAttribute('href'))))
    .filter(l => { try { return !l.sheet || !l.sheet.cssRules.length; } catch (err) { return true; } })
    .map(l => cheminDe(l.getAttribute('href')));
  const manquantes = [...partiesManquantes(), ...feuilles];
  if (manquantes.length) signalerPartiesManquantes(manquantes);
});
