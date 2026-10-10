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
prouve pas qu'un geste se fait au clavier. Les
aides (`pause`, `attendre`, `cliquerVisible`) y sont posees avant lui. Les
fenetres s'ouvrent par le bouton que la vue montre, jamais par un appel direct :
un bouton absent ou mal branche doit faire echouer le parcours. Un titre
d'onglet passe a l'echec pendant le geste est un echec, meme si le parcours a
abouti : une erreur levee dans la vue ne doit pas passer.

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
    sans lui, Chrome voit la touche mais ne la tape pas."""
    codes = {"Enter": (13, "\r"), "Space": (32, " "), "Tab": (9, "")}
    vk, texte = codes.get(nom, (0, ""))
    touche = " " if nom == "Space" else nom
    onglet.envoie("Input.dispatchKeyEvent", type="keyDown", key=touche, code=nom,
                  windowsVirtualKeyCode=vk, text=texte, unmodifiedText=texte)
    onglet.envoie("Input.dispatchKeyEvent", type="keyUp", key=touche, code=nom,
                  windowsVirtualKeyCode=vk)
    time.sleep(0.1)


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


def jouer(base, cdp, routes):
    """Joue les parcours puis le controle de largeur sur `routes`, une liste de
    (route, vue attendue). Rend (fautes, nombre de parcours joues)."""
    fautes, joues = [], 0
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
            for morceau in ([corps] if isinstance(corps, str) else corps):
                if morceau.startswith("TOUCHE:"):
                    _touche(onglet, morceau[len("TOUCHE:"):])
                    continue
                try:
                    r = onglet.js("(async () => {" + AIDES_JS + morceau + "})()")
                except Exception as e:
                    r = f"exception : {e}"
                if r is not True:
                    break
            apres = onglet.js("document.title") or ""
            if r is not True:
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
