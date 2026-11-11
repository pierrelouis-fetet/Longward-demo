"""Les parcours : des gestes de l'interface, joues dans le vrai navigateur.

La suite vit dans `tests.html`, qui ne charge pas la vue : elle prouve le modele,
pas les ecrans. Les douze routes prouvent que chaque ecran se rend. Il manquait
le geste : cliquer "Annuler" et voir l'etat revenir, ouvrir la fenetre des
depenses par son bouton et voir le montant ecrit, enregistrer un releve. Ces
parcours le jouent, apres une suite verte et complete, dans le profil temporaire
du lanceur -- jamais dans des donnees reelles.

Chaque parcours est le corps d'une fonction asynchrone, joue dans un document
charge sur sa route : il rend `true`, ou la phrase qui dit ce qui manque. Il
peut aussi etre une liste de tels corps, entre lesquels une chaine
"TOUCHE:<nom>" envoie une vraie touche au navigateur (CDP) : un `.click()` ne
prouve pas qu'un geste se fait au clavier. De meme, "DOIGT:poser", "DOIGT:glisser"
et "DOIGT:lever" posent un vrai doigt, aux points que la page indique : un
evenement fabrique en JS ne prouve ni le delai d'un appui, ni le defilement que
le navigateur decide. Les
aides (`pause`, `attendre`, `cliquerVisible`) y sont posees avant lui. Les
fenetres s'ouvrent par le bouton que la vue montre, jamais par un appel direct :
un bouton absent ou mal branche doit faire echouer le parcours. Un titre
d'onglet passe a l'echec pendant le geste est un echec, meme si le parcours a
abouti : une erreur levee dans la vue ne doit pas passer. Un parcours propre a
une sorte d'instance rend "SAUTE" ailleurs : il ne compte pas comme joue, et le
lanceur dit combien ont ete sautes.

Puis chaque route se rend a 390 px, en francais puis en anglais, et la page ne
doit pas deborder en largeur. Un ecran qui pousse la page sur un telephone se
voit au premier coup d'oeil chez l'utilisateur, et nulle part dans la suite.

Chaque chargement est un document neuf (un parametre unique dans l'adresse) et
attend le signal de SA vue : changer seulement le fragment pourrait laisser la
mesure porter sur l'ecran precedent.

Le pilotage CDP est celui de `captures.py`, pas une copie.
"""
import json
import time
import urllib.request

import captures

AIDES_JS = r"""
const pause = ms => new Promise(r => setTimeout(r, ms));
async function attendre(cond, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (cond()) return true; } catch (e) { /* pas encore */ }
    await pause(40);
  }
  return false;
}
const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
function cliquerVisible(sel) {
  const e = [...document.querySelectorAll('#view ' + sel)].find(visible);
  if (!e) return false;
  e.click();
  return true;
}
const confirmeOuverte = () => { const c = document.querySelector('#confirm'); return !!c && !c.hidden; };
"""

# (nom, route, vue attendue, largeur, corps JS). L'ordre compte : le dernier
# pose un etat illisible et remet le profil propre avant de rendre la main.
PARCOURS = [
    (
        "« Annuler » défait le dernier geste, et l'enregistrement suit",
        "#/data", "data", 1280,
        r"""
        const avant = Store.state.meta.objective;
        Store._lastPush = 0;
        Store.state.meta.objective = (Number(avant) || 0) + 12345;
        Store.save(); render();
        const annule = Store.state.meta.savedAt;
        await pause(120);
        const b = [...document.querySelectorAll('#view [data-action="undo"]')].find(visible);
        if (!b) return 'le bouton Annuler n’est pas visible';
        if (b.disabled) return 'le bouton Annuler dort alors qu’un geste vient d’être fait';
        b.click();
        if (!await attendre(() => Store.state.meta.objective === avant)) return 'l’objectif n’est pas revenu';
        const stocke = JSON.parse(localStorage.getItem(cleStockage()) || 'null');
        if (!stocke || stocke.meta.objective !== avant) return 'le stockage garde l’état annulé';
        if (!(Store.state.meta.savedAt > annule)) return 'l’état restauré n’est pas daté après l’état annulé';
        return true;
        """,
    ),
    (
        "Les dépenses du mois s'écrivent depuis leur fenêtre",
        "#/budget", "budget", 390,
        r"""
        if (!cliquerVisible('[data-action="saisir-mois-courant"]')) return 'aucun bouton visible n’ouvre la saisie du mois';
        if (!await attendre(() => document.querySelector('#modalBody [data-cat]'))) return 'la fenêtre des dépenses ne s’ouvre pas';
        const champ = document.querySelector('#modalBody [data-cat]');
        const cat = champ.dataset.cat;
        champ.value = '123,45';
        champ.dispatchEvent(new Event('input', { bubbles: true }));
        champ.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('#depOk').click();
        const cle = todayISO().slice(0, 7) + '-01';
        const ecrit = () => { const r = Store.state.budget.expenses.find(x => x.month === cle); return r && num(r.v[cat]) === 123.45; };
        if (!await attendre(ecrit)) return `le montant n’est pas écrit dans ${cat}`;
        const stocke = JSON.parse(localStorage.getItem(cleStockage()) || 'null');
        const r = stocke && stocke.budget.expenses.find(x => x.month === cle);
        if (!r || num(r.v[cat]) !== 123.45) return 'le montant n’est pas enregistré';
        const fermer = document.querySelector('#depFermer');
        if (fermer) fermer.click();
        return true;
        """,
    ),
    (
        "Une capture d'écran devient des dépenses à vérifier",
        "#/budget", "budget", 390,
        r"""
        /* Un serveur qui sait lire, simule dans la page : la sante annonce la
           lecture, la route rend deux operations. Rien ne s'ecrit : la fenetre
           s'arrete a l'etape des colonnes et se referme. */
        const sante0 = Quotes.healthData, fetch0 = window.fetch;
        try {
          Quotes.healthData = () => Promise.resolve({ ok: true, lecture: true });
          let envoye = null;
          window.fetch = async (url, o) => {
            if (!String(url).endsWith('/api/lire-captures')) return fetch0(url, o);
            envoye = JSON.parse(o.body);
            return new Response(JSON.stringify({ operations: [
              { date: '2026-10-02', libelle: 'CB CAFE', montant: -3.2, capture: 1, incertain: false,
                categorie: expenseCategories()[0] || '' },
              { date: '2026-10-03', libelle: 'CB PAIN', montant: -1.1, capture: 1, incertain: true, categorie: '' },
            ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          };
          if (!cliquerVisible('[data-action="importer-tableau"][data-cible="depenses"]')) return 'aucun bouton visible n’ouvre l’import des dépenses';
          if (!await attendre(() => (document.querySelector('#impFichier')?.accept || '').includes('image/png')))
            return 'le champ n’accepte pas les captures quand la lecture est offerte';
          const champ = document.querySelector('#impFichier');
          if (!champ.multiple) return 'le champ ne prend pas plusieurs captures';
          const toile = document.createElement('canvas');
          toile.width = 40; toile.height = 80;
          toile.getContext('2d').fillRect(0, 0, 40, 80);
          const blob = await new Promise(r => toile.toBlob(r, 'image/png'));
          const dt = new DataTransfer();
          dt.items.add(new File([blob], 'capture.png', { type: 'image/png' }));
          champ.files = dt.files;
          champ.dispatchEvent(new Event('change', { bubbles: true }));
          if (!await attendre(() => document.querySelector('#modalBody select[data-groupe]')))
            return 'la lecture ne mène pas aux catégories';
          if (document.querySelector('#impColDate')) return 'la fenêtre redemande les colonnes d’une capture';
          if (!envoye || envoye.images.length !== 1 || envoye.images[0].type !== 'image/jpeg'
              || !(envoye.images[0].data.length > 0) || envoye.images[0].data.length > LECTURE_LIMITES.octets)
            return 'la capture ne part pas en JPEG sous son plafond';
          if (envoye.aujourdhui !== todayISO()) return 'le jour envoyé n’est pas celui de l’appareil';
          if (JSON.stringify(envoye.categories) !== JSON.stringify(expenseCategories())) return 'les catégories ne partent pas avec la capture';
          if (expenseCategories().length
              && document.querySelector('#modalBody select[data-groupe]').value !== expenseCategories()[0])
            return 'la catégorie proposée n’est pas choisie d’office';
          const corps = document.querySelector('#modalBody').textContent;
          if (!corps.includes(trad('Lu par l’IA'))) return 'la fenêtre ne dit pas qui a lu';
          if (/claude/i.test(document.querySelector('#modal').textContent)) return 'la fenêtre nomme le modèle';
          if (!corps.includes('CB PAIN')) return 'la ligne lue avec un doute n’est pas montrée';
          document.querySelector('#modalClose').click();
          return true;
        } finally {
          Quotes.healthData = sante0;
          window.fetch = fetch0;
        }
        """,
    ),
    (
        "La carte Par catégorie bascule entre l'année et la moyenne par mois",
        "#/budget", "budget", 390,
        r"""
        /* Un etat et une date poses ici, pour que le geste prouve une bascule
           reelle sur toute instance et en tout mois : juin et juillet clos aux
           parts egales, aout en cours, qui ne pese que dans le total. L'etat,
           la date, l'annee et la lecture d'avant reviennent, sans rien
           enregistrer. */
        const sauve = Store.state, annee0 = budgetYear, lecture0 = depCatsParMois, jour0 = window.todayISO;
        try {
          window.todayISO = () => '2026-08-05';
          const s = structuredClone(sauve);
          s.budget.categories = ['Courses', 'Voyages'];
          s.budget.expenses = [
            { month: '2026-06-01', v: { Courses: 100, Voyages: 300 }, note: '' },
            { month: '2026-07-01', v: { Courses: 300, Voyages: 100 }, note: '' },
            { month: '2026-08-01', v: { Courses: 1000 }, note: '' },
          ];
          Store.state = s; budgetYear = '2026'; depCatsParMois = false; render();
          const lu = () => document.querySelector('#bCats')?.textContent || '';
          if (!await attendre(() => lu().includes(fmtEUR0Texte(1400)) && lu().includes(fmtPct(1400 / 1800 * 100, 1))))
            return 'la lecture Année ne montre pas le total et sa part';
          if (!cliquerVisible('[data-action="dep-cats-lecture"][data-lecture="mois"]')) return 'aucun bouton Par mois visible';
          if (!await attendre(() => lu().includes(fmtEUR0Texte(200)) && lu().includes(fmtPct(50, 1)) && !lu().includes(fmtEUR0Texte(1400))))
            return 'le graphique ne passe pas à la moyenne des mois clos et à sa part';
          const b = document.querySelector('#view [data-action="dep-cats-lecture"][data-lecture="mois"]');
          if (b.getAttribute('aria-pressed') !== 'true') return 'le bouton Par mois ne se dit pas pressé';
          if (!cliquerVisible('[data-action="dep-cats-lecture"][data-lecture="annee"]')) return 'le retour à l’année manque';
          if (!await attendre(() => lu().includes(fmtEUR0Texte(1400)))) return 'le total de l’année ne revient pas';
          return true;
        } finally {
          window.todayISO = jour0;
          Store.state = sauve; budgetYear = annee0; depCatsParMois = lecture0; render();
        }
        """,
    ),
    (
        "Les barres mensuelles des dépenses se lisent au doigt",
        "#/budget", "budget", 390,
        [
            r"""
            /* Un etat et une date poses ici : huit mois de 2026, mars le plus
               haut, aout en cours. Le dernier morceau remet tout en place. */
            window.__retour = { s: Store.state, an: budgetYear, jour: window.todayISO };
            window.todayISO = () => '2026-08-05';
            const s = structuredClone(Store.state);
            s.budget.categories = ['Courses'];
            s.budget.monthlyTarget = 1000;
            s.budget.expenses = [600, 800, 1400, 700, 900, 650, 750, 300]
              .map((v, k) => ({ month: `2026-0${k + 1}-01`, v: { Courses: v }, note: '' }));
            Store.state = s; budgetYear = '2026'; render();
            if (!await attendre(() => document.querySelectorAll('#bChart .vb').length === 8))
              return 'les huit barres mensuelles ne se dessinent pas';
            document.querySelector('#bChart').scrollIntoView({ block: 'center' });
            await pause(250);
            /* Le point de chaque colonne, bas dans la colonne : la ou se pose un
               doigt qui veut lire sans cacher la tete du graphique. */
            window.__colonne = (i, dy = 30) => {
              const r = document.querySelectorAll('#bChart .vb-colonne')[i].getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.bottom - dy };
            };
            window.__bulle = () => document.querySelector('#bChart .chart-tip');
            window.__lu = () => { const b = window.__bulle(); return b && !b.hidden ? b.querySelector('.tt-head').textContent : ''; };
            window.__actif = () => [...document.querySelectorAll('#bChart .vb')].findIndex(n => n.classList.contains('actif'));
            /* Le doigt se pose HAUT, sur la barre de mars, la plus grande : la
               ou une bulle posee en tete du graphique passerait dessous. */
            const haut = document.querySelectorAll('#bChart .vb-colonne')[2].getBoundingClientRect();
            window.__doigt = { x: haut.left + haut.width / 2, y: haut.top + 20 };
            return true;
            """,
            "DOIGT:poser",
            r"""
            await pause(350);
            if (window.__lu() !== fmtMonth('2026-03-01')) return `appui maintenu sur mars : la bulle dit « ${window.__lu()} »`;
            if (window.__actif() !== 2) return 'la colonne lue n’est pas marquée';
            const b = window.__bulle().getBoundingClientRect(), d = window.__doigt;
            if (d.x >= b.left - 8 && d.x <= b.right + 8 && d.y >= b.top && d.y <= b.bottom + 8)
              return 'la bulle passe sous le doigt';
            window.__doigt = { x: window.__colonne(3).x, y: d.y };
            return true;
            """,
            "DOIGT:glisser",
            r"""
            await pause(120);
            if (window.__lu() !== fmtMonth('2026-04-01')) return `le glissement ne suit pas le doigt : « ${window.__lu()} »`;
            if (window.__actif() !== 3) return 'la colonne marquée ne suit pas le doigt';
            /* Avril est au milieu du graphique : aucun cote du doigt n'y tient la
               bulle, qui doit alors passer au-dessus de lui. */
            const b = window.__bulle().getBoundingClientRect(), d = window.__doigt;
            if (d.x >= b.left - 8 && d.x <= b.right + 8 && d.y >= b.top && d.y <= b.bottom + 8)
              return 'après le glissement, la bulle passe sous le doigt';
            return true;
            """,
            "DOIGT:lever",
            r"""
            await pause(80);
            if (window.__lu()) return 'lever le doigt ne ferme pas la bulle';
            if (window.__actif() !== -1) return 'une colonne reste marquée après la levée';
            window.__doigt = window.__colonne(0);
            return true;
            """,
            "DOIGT:poser",
            "DOIGT:lever",
            r"""
            await pause(120);
            if (window.__lu() !== fmtMonth('2026-01-01')) return `un tap court ne montre pas janvier : « ${window.__lu()} »`;
            await pause(800);
            window.__doigt = window.__colonne(1);
            return true;
            """,
            "DOIGT:poser",
            "DOIGT:lever",
            r"""
            /* Le premier tap a pose sa fermeture il y a environ 1 s : elle est
               annulee par le second, dont la bulle doit tenir. */
            await pause(700);
            if (window.__lu() !== fmtMonth('2026-02-01')) return `le second tap est fermé par le minuteur du premier : « ${window.__lu()} »`;
            await pause(1100);
            if (window.__lu()) return 'la bulle d’un tap ne se referme pas';
            const p = window.__colonne(2);
            window.__doigts = { a: p, b: { x: p.x, y: p.y - 90 } };
            return true;
            """,
            "DOIGT:poser:a",
            "DOIGT:glisser:b",
            r"""
            await pause(300);
            if (window.__lu()) return 'un glissement vertical dès la pose ouvre la bulle';
            return true;
            """,
            "DOIGT:lever",
            r"""
            document.querySelector('#bChart').scrollIntoView({ block: 'center' });
            await pause(250);
            const p = window.__colonne(2);
            window.__doigts = { a: p, b: { x: p.x, y: p.y - 90 } };
            window.__defile = scrollY;
            return true;
            """,
            "DOIGT:poser:a",
            r"""
            await pause(350);
            if (!window.__lu()) return 'appui maintenu : la bulle ne s’ouvre pas';
            return true;
            """,
            "DOIGT:glisser:b",
            r"""
            await pause(300);
            if (scrollY === window.__defile) return 'le glissement vertical après l’ouverture ne fait pas défiler la page';
            if (window.__lu()) return 'un défilement après l’ouverture laisse la bulle ouverte';
            if (window.__actif() !== -1) return 'un défilement après l’ouverture laisse une colonne marquée';
            return true;
            """,
            "DOIGT:lever",
            r"""
            /* Le graphique remonte juste sous les barres collantes : une bulle
               posee au-dessus du doigt passerait derriere elles. */
            const fixes = [...document.querySelectorAll('body *')].filter(e => {
              const s = getComputedStyle(e), r = e.getBoundingClientRect();
              return (s.position === 'fixed' || s.position === 'sticky') && r.top <= 1 && r.height > 0 && r.height < 200;
            });
            const bas = Math.max(0, ...fixes.map(e => e.getBoundingClientRect().bottom));
            const chart = document.querySelector('#bChart').getBoundingClientRect();
            window.scrollBy(0, chart.top - bas - 2);
            await pause(250);
            const col = document.querySelectorAll('#bChart .vb-colonne')[3].getBoundingClientRect();
            window.__doigt = { x: col.left + col.width / 2, y: col.top + 20 };
            window.__fixes = fixes;
            return true;
            """,
            "DOIGT:poser",
            r"""
            await pause(350);
            if (window.__lu() !== fmtMonth('2026-04-01')) return `sous l’en-tête, l’appui sur avril n’ouvre pas sa bulle : « ${window.__lu()} »`;
            const b = window.__bulle().getBoundingClientRect(), d = window.__doigt;
            if (d.x >= b.left - 8 && d.x <= b.right + 8 && d.y >= b.top && d.y <= b.bottom + 8)
              return 'sous l’en-tête, la bulle passe sous le doigt';
            const cachee = window.__fixes.some(e => { const r = e.getBoundingClientRect(); return r.bottom > b.top + 1 && r.top < b.bottom; });
            if (cachee) return 'sous l’en-tête, la bulle passe derrière une barre collante';
            return true;
            """,
            "DOIGT:lever",
            r"""
            const r = window.__retour;
            window.todayISO = r.jour;
            Store.state = r.s; budgetYear = r.an; render();
            return true;
            """,
        ],
    ),
    (
        "Les catégories se rangent au téléphone, depuis le haut de l'onglet",
        "#/budget", "budget", 375,
        [r"""
        /* La porte du haut, sa feuille, et chaque geste par le bouton que la
           feuille montre : descendre, renommer par une vraie frappe puis
           toucher "Retirer" du doigt, ajouter (et renoncer par le fond),
           reprendre, Termine. L'etat et la chaine brute reviennent a l'identique
           a la fin, meme apres un echec. */
        if (!aDesDepensesSaisies() || sansDistinction()) return 'SAUTE';
        const cle = cleStockage(), brut = localStorage.getItem(cle), sauve = structuredClone(Store.state);
        window.__catsFin = async () => {
          if (categoriesOuvertes()) fermerFeuille();
          Store.state = sauve; render();
          await pause(120);
          if (brut == null) localStorage.removeItem(cle); else localStorage.setItem(cle, brut);
          return localStorage.getItem(cle) === brut;
        };
        const lanc = document.querySelector('#lancement'); if (lanc) lanc.style.display = 'none';
        const corps = document.querySelector('#modalBody');
        const ligne = c => [...corps.querySelectorAll('.cat-ligne')].find(l => l.dataset.cat === c);
        const auDoigt = el => { const q = el.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return e === el || el.contains(e); };
        const echec = async m => { await window.__catsFin(); return m; };
        const porte = document.querySelector('#view .hero-actes [data-action="gerer-categories"]');
        if (!porte) return echec('aucune porte des catégories en haut de l’onglet');
        porte.scrollIntoView({ block: 'center' }); await pause(60);
        if (!auDoigt(porte)) return echec('la couverture de la carte prend le toucher de la porte');
        porte.click();
        if (!await attendre(() => categoriesOuvertes())) return echec('la feuille ne s’ouvre pas');
        await pause(300);
        if (document.activeElement !== document.querySelector('#modalTitle')) return echec('le focus n’entre pas dans la feuille');
        const cadre = corps.getBoundingClientRect();
        for (const b of corps.querySelectorAll('.cat-commandes .btn')) {
          const q = b.getBoundingClientRect();
          if (q.left < cadre.left - 1 || q.right > cadre.right + 1) return echec(`une commande sort de la feuille : ${b.dataset.action}`);
        }
        const premiere = expenseCategories()[0];
        const bas = ligne(premiere).querySelector('[data-action="descendre-category"]');
        if (!auDoigt(bas)) return echec('la flèche de la première catégorie ne reçoit pas le toucher');
        bas.click();
        if (!await attendre(() => expenseCategories()[1] === premiere)) return echec('descendre ne déplace pas la première catégorie');
        const stocke = JSON.parse(localStorage.getItem(cle) || 'null');
        if (!stocke || stocke.budget.categories[1] !== premiere) return echec('le nouvel ordre n’est pas enregistré');
        if ([...corps.querySelectorAll('.cat-ligne')][1]?.dataset.cat !== premiere) return echec('la feuille ne montre pas le nouvel ordre');
        const f = document.activeElement;
        if (f?.dataset.cat !== premiere || f?.dataset.action !== 'descendre-category') return echec('le focus ne reste pas sur la catégorie déplacée');
        /* Le champ prend le focus, le curseur en fin de nom ; la frappe suit. Le
           doigt visera ensuite "Retirer" de la meme rangee. */
        const champ = ligne(premiere).querySelector('input');
        /* L'application selectionne le contenu d'un champ juste apres le focus :
           le curseur se pose en fin de nom une fois cette selection faite. */
        champ.focus(); await pause(120);
        champ.setSelectionRange(champ.value.length, champ.value.length);
        const retirer = ligne(premiere).querySelector('[data-action="retirer-category"]');
        const q = retirer.getBoundingClientRect();
        window.__doigt = { x: q.left + q.width / 2, y: q.top + q.height / 2 };
        window.__catsPremiere = premiere;
        return true;
        """,
        "TOUCHE:x",
        "DOIGT:poser",
        "DOIGT:lever",
        r"""
        const corps = document.querySelector('#modalBody');
        const ligne = c => [...corps.querySelectorAll('.cat-ligne')].find(l => l.dataset.cat === c);
        const nouveau = window.__catsPremiere + 'x';
        let verdict = true;
        try {
          if (!await attendre(() => expenseCategories().includes(nouveau))) return 'la frappe dans le nom ne renomme pas la catégorie';
          if (!await attendre(() => categorieRetiree(nouveau))) return 'l’appui sur « Retirer » après le renommage est perdu';
          if (!categoriesOuvertes()) return 'la feuille se ferme au renommage';
          if (!ligne(nouveau)?.classList.contains('cat-retiree')) return 'la rangée renommée ne se dit pas retirée';
          ligne(nouveau).querySelector('[data-action="reprendre-category"]').click();
          if (!await attendre(() => !categorieRetiree(nouveau))) return 'reprendre ne la rend pas à la saisie';
          /* Renoncer a l'ajout par le fond rend la feuille, focus sur l'ajout. */
          document.querySelector('#modalFoot [data-action="add-category"]').click();
          if (!await attendre(() => document.querySelector('#txtOk'))) return 'la fenêtre du nom ne s’ouvre pas';
          document.querySelector('#modal').dispatchEvent(new MouseEvent('click', { bubbles: true }));
          if (!await attendre(() => categoriesOuvertes())) return 'renoncer par le fond ne rend pas la feuille';
          if (document.activeElement?.dataset.action !== 'add-category') return 'après le renoncement, le focus n’est pas sur l’ajout';
          document.querySelector('#modalFoot [data-action="add-category"]').click();
          if (!await attendre(() => document.querySelector('#txtOk'))) return 'la fenêtre du nom ne se rouvre pas';
          const saisie = document.querySelector('#modalBody input');
          saisie.value = 'Parcours';
          saisie.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('#txtOk').click();
          if (!await attendre(() => categoriesOuvertes() && !!ligne('Parcours'))) return 'la feuille ne revient pas avec la catégorie ajoutée';
          if (document.activeElement?.dataset.cat !== 'Parcours') return 'le focus ne va pas au nom de la catégorie ajoutée';
          const lignes = [...corps.querySelectorAll('.cat-ligne')];
          const derniere = lignes[lignes.length - 1];
          derniere.scrollIntoView({ block: 'nearest' }); await pause(80);
          if (derniere.getBoundingClientRect().bottom > document.querySelector('#modalFoot').getBoundingClientRect().top + 1)
            return 'la dernière catégorie reste sous le pied de la feuille';
          document.querySelector('#modalFoot [data-action="fermer-categories"]').click();
          if (!await attendre(() => !categoriesOuvertes())) return '« Terminé » ne ferme pas la feuille';
          const porteHaut = () => document.querySelector('#view .hero-actes [data-action="gerer-categories"]');
          if (document.activeElement !== porteHaut()) return 'la fermeture ne rend pas le focus à la porte';
          /* Fermer par le fond passe par la sortie de la feuille : son etat
             s'efface et le focus revient a la porte. */
          porteHaut().blur(); porteHaut().click();
          if (!await attendre(() => categoriesOuvertes())) return 'la porte ne rouvre pas la feuille';
          document.querySelector('#modal').dispatchEvent(new MouseEvent('click', { bubbles: true }));
          if (!await attendre(() => !categoriesOuvertes())) return 'le fond ne ferme pas la feuille';
          if (feuilleCourante !== null || document.querySelector('#modalClose').onclick !== null)
            return 'fermée par le fond, la feuille laisse son état';
          if (document.activeElement !== porteHaut()) verdict = 'fermée par le fond, la feuille ne rend pas le focus à la porte';
        } finally {
          if (!await window.__catsFin()) verdict = 'la chaîne brute n’est pas revenue à l’identique';
        }
        return verdict;
        """],
    ),
    (
        "Le relevé du mois reprend les montants actuels et s'enregistre",
        "#/history", "overview", 390,
        r"""
        const cle = currentMonthKey();
        const i = Store.state.monthly.findIndex(x => x.date === cle);
        if (i >= 0) {
          Store.state.monthly[i] = { ...Store.state.monthly[i], v: {}, dettes: 0 };
          Store.save(); render();
          if (!rowIsEmpty(Store.state.monthly[i])) return 'la ligne du mois ne se vide pas avant le geste';
          await pause(120);
        }
        if (!cliquerVisible('[data-action="ajouter-releve"]')) return 'aucun bouton visible n’ouvre le relevé';
        if (!await attendre(() => document.querySelector('#relOk') || confirmeOuverte())) return 'ni le relevé ni son étape ne s’ouvrent';
        if (!document.querySelector('#relOk')) {
          document.querySelector('#confirmYes').click();
          if (!await attendre(() => document.querySelector('#relOk'))) return 'la fenêtre du relevé ne s’ouvre pas';
        }
        const photo = document.querySelector('#relPhoto');
        if (!photo) return 'le bouton Préremplir manque';
        photo.click();
        await pause(80);
        document.querySelector('#relOk').click();
        const plein = () => { const r = Store.state.monthly.find(x => x.date === cle); return r && !rowIsEmpty(r); };
        if (!await attendre(plein)) return 'le relevé du mois reste vide';
        const stocke = JSON.parse(localStorage.getItem(cleStockage()) || 'null');
        const r = stocke && stocke.monthly.find(x => x.date === cle);
        if (!r || rowIsEmpty(r)) return 'le relevé n’est pas enregistré';
        const fermer = document.querySelector('#relFermer');
        if (fermer) fermer.click();
        return true;
        """,
    ),
    (
        "Les rappels du mois forment une carte, et chaque rangée garde ses gestes",
        "#/overview", "overview", 390,
        [r"""
        const cle = currentMonthKey();
        Store.state.meta.rappelsMasques = {};
        Store.state.meta.jourRappel = 1;
        const i = Store.state.monthly.findIndex(x => x.date === cle);
        if (i >= 0) Store.state.monthly[i] = { ...Store.state.monthly[i], v: {}, dettes: 0 };
        const clos = moisPrecedentKey();
        const j = Store.state.budget.expenses.findIndex(x => x.month === clos);
        if (j >= 0) Store.state.budget.expenses[j] = { ...Store.state.budget.expenses[j], v: {} };
        Store.save(); render();
        await pause(150);
        if (!currentMonthPending().missing || !depensesEnAttente().missing) return 'les deux rappels ne s’allument pas';
        const carte = document.querySelector('#view > .rappels');
        if (!carte) return 'aucune carte ne porte les rappels';
        const rangees = [...carte.querySelectorAll(':scope > .rappel')];
        if (rangees.length !== 2) return `${rangees.length} rangée(s) au lieu de deux`;
        for (const r of rangees) {
          if (!r.querySelector('.card-couvre') || !r.querySelector('[data-action="reporter-rappel"]')
              || !r.querySelector('[data-action="taire-rappel"]')) return 'une rangée a perdu un geste';
          if ([...r.querySelectorAll('button')].some(b => b.tabIndex < 0)) return 'un geste ne se joint pas au clavier';
        }
        carte.scrollIntoView({ block: 'center' });
        await pause(80);
        const b = rangees[1].getBoundingClientRect();
        if (document.elementFromPoint(b.left + 24, b.top + 2) !== rangees[1].querySelector('.card-couvre')) return 'juste sous le filet, le toucher n’atteint pas la couverture de la seconde rangée';
        if (document.elementFromPoint(b.left + 24, b.top - 2) !== rangees[0].querySelector('.card-couvre')) return 'juste au-dessus, il n’atteint pas celle de la première';
        const plusTard = rangees[0].querySelector('[data-action="reporter-rappel"]');
        plusTard.focus();
        if (document.activeElement !== plusTard) return '« Plus tard » ne prend pas le focus';
        return true;
        """,
        "TOUCHE:Enter",
        r"""
        if (!await attendre(() => document.querySelectorAll('#view > .rappels > .rappel').length === 1)) return 'Entrée sur « Plus tard » ne retire pas sa rangée';
        document.querySelector('#view > .rappels [data-action="taire-rappel"]').click();
        if (!await attendre(() => !document.querySelector('#view > .rappels'))) return 'après la dernière croix, une carte vide reste';
        return true;
        """],
    ),
    (
        "Une VL sans date se pose depuis la fiche, curseur sur la date",
        "#/accounts", "accounts", 375,
        r"""
        /* Un fonds a une ligne, sans date de VL, pose le temps du geste : l'etat
           revient tel quel a la fin, stockage compris. */
        const avant = JSON.stringify(Store.state.comptes);
        const id = 'c_parcours_fonds';
        try {
          Store.state.comptes.push({ id, etabId: (ETABS()[0] || {}).id || null, type: 'fondsNonCote', statut: 'ouvert',
            ouvertLe: '2024-01-01', numero: '', notes: '', libelle: 'Fonds parcours', court: 'Fonds parcours', alloc: '',
            cash: [], lignes: [{ id: 'l_parcours', classe: 'nonCote', libelle: 'Fonds parcours', valeur: 1000, parts: 10,
                                quantite: 1, dateAcquisition: '2024-01-01', estimeLe: '' }] });
          refreshAccounts();
          location.hash = '#/compte/' + id;
          if (!await attendre(() => document.querySelector('#view .maj-valeur'))) return 'la fiche ne propose pas de dater la valeur';
          const b = document.querySelector('#view .maj-valeur');
          if (b.textContent.trim() !== trad('Dater la valeur')) return `le bouton dit « ${b.textContent.trim()} »`;
          if (!document.querySelector('#view .date-valeur')?.textContent.includes(trad('valeur non datée')))
            return 'la date manquante ne se dit pas « valeur non datée »';
          const r = b.getBoundingClientRect();
          if (r.right > innerWidth + 0.5) return 'le bouton déborde à 375 px';
          if (document.documentElement.scrollWidth > innerWidth + 0.5) return 'la fiche déborde à 375 px';
          const halo = parseFloat(getComputedStyle(b, '::after').height);
          if (!(halo >= 44)) return `la zone tactile fait ${halo} px, pas 44`;
          b.click();
          if (!await attendre(() => document.querySelector('#modalBody #f_estimeLe'))) return 'la fenêtre du placement ne s’ouvre pas sur sa date';
          const champ = document.querySelector('#modalBody #f_estimeLe');
          if (!POINTEUR_TACTILE && document.activeElement !== champ) return 'le curseur n’est pas sur la date';
          /* La fenetre s'ouvre par une transition : la mesure attend qu'elle
             soit posee. */
          const sousLesYeux = () => { const x = champ.getBoundingClientRect(); return x.top >= 0 && x.bottom <= innerHeight; };
          if (!await attendre(sousLesYeux, 2000)) {
            const x = champ.getBoundingClientRect();
            return `la date n’est pas sous les yeux (${Math.round(x.top)} à ${Math.round(x.bottom)}, fenêtre de ${innerHeight})`;
          }
          document.querySelector('#frmCancel').click();
          /* La fenetre se cache, son contenu reste jusqu'a la suivante. */
          if (!await attendre(() => document.querySelector('#modal').hidden)) return 'la fenêtre ne se referme pas';
          return true;
        } finally {
          Store.state.comptes = JSON.parse(avant); refreshAccounts(); Store.save();
          location.hash = '#/accounts';
        }
        """,
    ),
    (
        "Une caution se crée sans prix d'achat ni date de valeur",
        "#/accounts", "accounts", 390,
        r"""
        const avant = JSON.stringify(Store.state.comptes);
        const brut = nowByGroup().creances || 0;
        try {
          if (!cliquerVisible('[data-action="ajouter-compte"]:not([data-type])')) return 'aucun bouton visible n’ajoute un actif';
          if (!await attendre(() => document.querySelector('#modalBody #f_type'))) return 'le choix du type ne s’ouvre pas';
          const type = document.querySelector('#modalBody #f_type');
          if (![...type.options].some(o => o.value === 'depotGarantie')) return 'le dépôt de garantie manque à la liste des types';
          type.value = 'depotGarantie';
          type.dispatchEvent(new Event('change', { bubbles: true }));
          document.querySelector('#frmOk').click();
          if (!await attendre(() => document.querySelector('#modalBody #f_valeur'))) return 'la fenêtre de la créance ne s’ouvre pas';
          if (document.querySelector('#modalBody #f_prixDeRevient')) return 'une créance demande un prix d’achat';
          if (document.querySelector('#modalBody #f_estimeLe')) return 'une créance demande une date de valeur';
          const poser = (cle, v) => { const e = document.querySelector('#modalBody #f_' + cle); e.value = v;
            e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
          poser('libelle', 'Caution parcours');
          poser('valeur', '900');
          document.querySelector('#frmOk').click();
          const cree = () => Store.state.comptes.find(c => c.type === 'depotGarantie' && c.libelle === 'Caution parcours');
          if (!await attendre(cree)) return 'la caution n’est pas créée';
          const l = cree().lignes[0];
          if (l.classe !== 'creance' || num(l.valeur) !== 900) return 'la ligne ne porte pas la créance de 900';
          if (l.prixDeRevient != null) return 'un prix de revient s’est glissé dans la créance';
          if (Math.abs((nowByGroup().creances || 0) - brut - 900) > 0.005) return 'la poche des créances ne la compte pas';
          return true;
        } finally {
          Store.state.comptes = JSON.parse(avant); refreshAccounts(); Store.save();
          location.hash = '#/accounts';
        }
        """,
    ),
    (
        "Sans graine fictive, la démonstration ne s'ouvre pas et ne touche à rien",
        "#/data", "data", 1280,
        r"""
        if (exempleDisponible()) return 'SAUTE';
        const photo = () => {
          const o = [];
          for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o.push([k, localStorage.getItem(k)]); }
          return JSON.stringify(o.sort());
        };
        const avant = photo(), etat = JSON.stringify(Store.state);
        /* Un garde absent ouvrirait la confirmation, et l'appel attendrait une
           reponse qui ne vient pas : la course le dit au lieu de bloquer. */
        for (const nom of ['charger-demo', 'recharger-demo']) {
          const fini = await Promise.race([ACTIONS[nom]().then(() => true), pause(1500).then(() => false)]);
          if (!fini || confirmeOuverte()) return `${nom} demande une réponse : son garde n’a pas joué`;
        }
        if (photo() !== avant) return 'le stockage local a changé';
        if (JSON.stringify(Store.state) !== etat) return 'l’état en mémoire a changé';
        if (modeDemo()) return 'le mode exemple s’est ouvert';
        if (cleStockage() !== 'wealth-dashboard:v1') return 'la clé de stockage a basculé';
        if (document.querySelector('#view .demo-bascule')) return 'Données montre la bascule de la démonstration';
        return true;
        """,
    ),
    (
        "Un état local illisible se montre, et sa copie se supprime",
        "#/data", "data", 1280,
        r"""
        try {
          localStorage.removeItem(cleIllisible());
          localStorage.setItem(cleStockage(), '{pas du json');
          Store.load(); refreshAccounts(); render();
          if (!await attendre(() => document.querySelector('.etat-donnees.etat-erreur'))) return 'la carte ne se montre pas';
          if (localStorage.getItem(cleIllisible()) !== '{pas du json') return 'la copie n’est pas posée';
          if (!cliquerVisible('[data-action="supprimer-illisible"]')) return 'le bouton Supprimer n’est pas visible';
          if (!await attendre(confirmeOuverte)) return 'la suppression ne demande pas confirmation';
          document.querySelector('#confirmYes').click();
          if (!await attendre(() => !document.querySelector('.etat-donnees.etat-erreur'))) return 'la carte reste après la suppression';
          if (localStorage.getItem(cleIllisible()) !== null) return 'la copie reste après la suppression';
          return true;
        } finally {
          /* Le profil du lanceur repart propre : la graine ecrite, sans drapeau. */
          localStorage.removeItem(cleIllisible());
          Store.leverSuspension(); Store.illisible = null; Store.save();
        }
        """,
    ),
]


def _nouvel_onglet(cdp):
    req = urllib.request.Request(cdp + "/json/new?about:blank", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


def _fermer_onglet(cdp, ident):
    try:
        urllib.request.urlopen(cdp + "/json/close/" + ident, timeout=5).close()
    except Exception:
        pass


_chargements = 0


def _touche(onglet, nom):
    """Une vraie touche, enfoncee puis relachee, dans l'element qui a le focus.
    Le caractere porte par l'enfoncement (`text`) est ce qui active un bouton :
    sans lui, Chrome voit la touche mais ne la tape pas. Un nom d'un seul
    caractere tape ce caractere : une saisie faite ainsi est une vraie frappe,
    et le champ emettra `change` en perdant le focus, ce qu'une valeur posee
    en JS ne fait pas."""
    codes = {"Enter": (13, "\r"), "Space": (32, " "), "Tab": (9, "")}
    vk, texte = codes.get(nom, (ord(nom.upper()), nom) if len(nom) == 1 else (0, ""))
    touche = " " if nom == "Space" else nom
    onglet.envoie("Input.dispatchKeyEvent", type="keyDown", key=touche, code=nom,
                  windowsVirtualKeyCode=vk, text=texte, unmodifiedText=texte)
    onglet.envoie("Input.dispatchKeyEvent", type="keyUp", key=touche, code=nom,
                  windowsVirtualKeyCode=vk)
    time.sleep(0.1)


def _doigt(onglet, ordre):
    """Un vrai doigt, par CDP : `poser[:p]`, `glisser[:p]`, `lever`.

    Le point se lit dans la page, en pixels CSS : `window.__doigts[p]` quand
    l'ordre nomme un point, `window.__doigt` sinon. C'est le morceau JS
    precedent qui le pose, d'apres le dessin qu'il a sous les yeux. Deux ordres
    qui se suivent sans morceau JS entre eux partent sans attente : un
    glissement pose avant l'armement d'une infobulle se joue ainsi."""
    action, _, point = ordre.partition(":")
    if action == "lever":
        onglet.envoie("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        return
    onglet.envoie("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=1)
    lu = (f"JSON.stringify((window.__doigts || {{}})[{json.dumps(point)}])" if point
          else "JSON.stringify(window.__doigt)")
    p = json.loads(onglet.js(lu) or "null")
    if not p:
        raise ValueError(f"aucun point pour le doigt ({ordre})")
    onglet.envoie("Input.dispatchTouchEvent", type="touchStart" if action == "poser" else "touchMove",
                  touchPoints=[{"x": p["x"], "y": p["y"]}])


def _charger(onglet, base, route, vue, largeur):
    """Charge un document neuf sur la route, a la largeur donnee, et attend le
    signal de rendu de SA vue, ou un echec. Rend le titre lu."""
    global _chargements
    _chargements += 1
    onglet.envoie("Emulation.setDeviceMetricsOverride", width=largeur, height=900,
                  deviceScaleFactor=1, mobile=largeur < 768)
    onglet.envoie("Page.navigate", url=f"{base}/index.html?controle=1&parcours={_chargements}{route}")
    attendu = "✓ rendu " + vue
    titre = ""
    for _ in range(150):                                  # trente secondes au plus
        time.sleep(0.2)
        try:
            titre = onglet.js(
                f"location.search.includes('parcours={_chargements}') ? document.title : ''") or ""
        except Exception:
            continue
        if titre == attendu or titre.startswith("✕"):
            break
    # Le premier rendu precede la fin d'init() : les cours, la synchronisation.
    time.sleep(1.2)
    return onglet.js("document.title") or titre


# Les parcours sautes au dernier `jouer()` : propres a une autre instance.
SAUTES = []


def jouer(base, cdp, routes):
    """Joue les parcours puis le controle de largeur sur `routes`, une liste de
    (route, vue attendue). Rend (fautes, nombre de parcours joues) ; les noms
    des parcours sautes restent dans `SAUTES`."""
    fautes, joues = [], 0
    SAUTES.clear()
    o = _nouvel_onglet(cdp)
    onglet = captures.Onglet(o["webSocketDebuggerUrl"])
    try:
        onglet.envoie("Page.enable")
        # Au premier plan : un onglet cache ralentit ses minuteurs, et les
        # attentes des parcours en dependent.
        onglet.envoie("Page.bringToFront")
        for nom, route, vue, largeur, corps in PARCOURS:
            joues += 1
            titre = _charger(onglet, base, route, vue, largeur)
            if titre != "✓ rendu " + vue:
                fautes.append(f"{nom} : la route {route} ne rend pas {vue} ({titre!r})")
                continue
            r = True
            doigt = False
            try:
                for morceau in ([corps] if isinstance(corps, str) else corps):
                    if morceau.startswith("TOUCHE:"):
                        _touche(onglet, morceau[len("TOUCHE:"):])
                        continue
                    try:
                        if morceau.startswith("DOIGT:"):
                            doigt = True
                            _doigt(onglet, morceau[len("DOIGT:"):])
                            continue
                        r = onglet.js("(async () => {" + AIDES_JS + morceau + "})()")
                    except Exception as e:
                        r = f"exception : {e}"
                    if r is not True:
                        break
            finally:
                # Un doigt reste pose si le parcours s'arrete en route, et
                # l'emulation tactile changerait les parcours suivants : les
                # deux se levent ici, quoi qu'il soit arrive.
                if doigt:
                    try:
                        onglet.envoie("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
                    except Exception:
                        pass
                    onglet.envoie("Emulation.setTouchEmulationEnabled", enabled=False)
            apres = onglet.js("document.title") or ""
            if r == "SAUTE":
                joues -= 1
                SAUTES.append(nom)
            elif r is not True:
                fautes.append(f"{nom} : {r}")
            elif apres.startswith("✕"):
                fautes.append(f"{nom} : une erreur est levée pendant le geste ({apres!r})")

        for langue in ("fr", "en"):
            onglet.js(f"localStorage.setItem('wealth-dashboard:lang', {json.dumps(langue)}); true")
            for route, vue in routes:
                joues += 1
                titre = _charger(onglet, base, route, vue, 390)
                if titre != "✓ rendu " + vue:
                    fautes.append(f"{route} à 390 px ({langue}) : ne rend pas {vue} ({titre!r})")
                    continue
                m = onglet.js("({ page: document.documentElement.scrollWidth, ecran: innerWidth })")
                if m["page"] > m["ecran"] + 1:
                    fautes.append(f"{route} à 390 px ({langue}) : la page déborde, "
                                  f"{m['page']} px pour {m['ecran']}")
        onglet.js("localStorage.removeItem('wealth-dashboard:lang'); true")
    finally:
        onglet.ferme()
        _fermer_onglet(cdp, o["id"])
    return fautes, joues
