/* La suite de tests, en parties.

   Un seul fichier de 2,7 Mo ne se lisait plus, ni par un agent venu verifier
   un changement de couleur, ni par un humain. La suite vit donc en parties
   d'une centaine de Ko, chargees par tests.html dans l'ordre de ce manifeste,
   et `lireSource('tests/store.tests.js')` rend toujours le texte d'origine.

   Chaque partie s'ouvre sur partieDeTests('<chemin>') et se ferme sur
   finDePartieDeTests('<chemin>'), seuls sur leur ligne. Le second ne
   s'execute que si la partie a ete lue et interpretee jusqu'au bout : une
   partie absente, en 404 ou mal ecrite manque a l'appel, et le harnais rend
   le verdict rouge avant toute selection. */
const PARTIES_DE_TESTS = [
  'tests/01-socle.tests.js',
  'tests/02-ce-qui-change-entre.tests.js',
  'tests/03-source-se-lit-fois.tests.js',
  'tests/04-centre-anneau-sait-passer.tests.js',
  'tests/05-charges-fixes-se-rangent.tests.js',
  'tests/06-projection-capitalisation.tests.js',
  'tests/07-application-s-adresse-toujours.tests.js',
  'tests/08-charge-fixe-vaut-ce.tests.js',
  'tests/09-ligne-projection-annonce-taux.tests.js',
  'tests/10-rappel-saisies-attend-son.tests.js',
  'tests/11-navigation-arrive-en-haut.tests.js',
  'tests/12-ecart-non-cote-se.tests.js',
  'tests/13-changer-perimetre-se-voit.tests.js',
  'tests/14-boutons-fiche-ont-geometrie.tests.js',
  'tests/15-personnalise-est-case-pas.tests.js',
  'tests/16-performance-jour-se-compte.tests.js',
  'tests/17-licence-ne-ment-pas.tests.js',
  'tests/18-releve-note-sa-propre.tests.js',
  'tests/19-frontiere-entre-pierre-papier.tests.js',
  'tests/20-versement-propose-vient-budget.tests.js',
  'tests/21-premier-ecran-patrimoine-abord.tests.js',
  'tests/22-infobulle-historique-dit-composition.tests.js',
  'tests/23-insight-ecart-cible-allocation.tests.js',
  'tests/24-chaque-categorie-repartition-s.tests.js',
  'tests/25-cases-se-voient-se-touchent.tests.js',
  'tests/26-gestes-se-nettoient.tests.js',
  'tests/27-societes-sous-jacentes.tests.js',
  'tests/28-les-chiffres-se-lisent.tests.js',
  'tests/29-partie-compte.tests.js',
  'tests/30-arbitrages.tests.js',
  'tests/31-vente-bien.tests.js',
  'tests/32-supports-dates.tests.js',
  'tests/33-scpi.tests.js',
  'tests/34-compte-par-defaut.tests.js',
  'tests/35-courbe-mensuelle.tests.js',
  'tests/36-cibles-debutant.tests.js',
  'tests/37-caps-du-patrimoine.tests.js',
  'tests/38-import-tableau.tests.js',
];
const PARTIES_DE_TESTS_CHARGEES = new Set();
let PARTIE_DE_TESTS_COURANTE = null;
function partieDeTests(chemin) { PARTIE_DE_TESTS_COURANTE = chemin; }
function finDePartieDeTests(chemin) {
  PARTIES_DE_TESTS_CHARGEES.add(chemin);
  PARTIE_DE_TESTS_COURANTE = null;
}
const partiesDeTestsManquantes = () => PARTIES_DE_TESTS.filter(p => !PARTIES_DE_TESTS_CHARGEES.has(p));

/* Les groupes : un chemin d'origine et ses parties. Ceux des assets viennent
   de GROUPES, dans assets/parties.js, quand la page le charge. */
function partiesDuGroupe(chemin) {
  if (chemin === 'tests/store.tests.js') return PARTIES_DE_TESTS;
  return (typeof GROUPES !== 'undefined' && GROUPES[chemin]) || null;
}
/* Le groupe d'une partie, ou le chemin lui-meme s'il n'appartient a aucun. */
function groupeDe(chemin) {
  if (PARTIES_DE_TESTS.includes(chemin)) return 'tests/store.tests.js';
  if (typeof GROUPES !== 'undefined')
    for (const [g, liste] of Object.entries(GROUPES)) if (liste.includes(chemin)) return g;
  return chemin;
}
/* L'en-tete de licence que le filtre de publication pose en tete de chaque
   fichier d'assets. Un groupe reconstitue n'en garde que le premier : le
   fichier unique qu'il remplace n'en portait qu'un. */
const ENTETE_DE_LICENCE = /^\/\*! Longward[\s\S]*?\*\/\n/;
/* Une ligne de marqueur, telle que le decoupage l'ecrit : seule sur sa ligne. */
const LIGNE_MARQUEUR = /^(?:partieDeTests|finDePartieDeTests|partieChargee)\('[^'\n]+'\);\n/gm;
