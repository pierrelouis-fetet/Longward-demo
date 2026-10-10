"""Joue la suite dans un vrai navigateur, sans interaction, et rend un code de
sortie.

Pourquoi il fallait ca : la suite vit dans le navigateur, et son verdict etait un
titre d'onglet qu'un humain devait lire. Le README affirme que chaque chiffre
affiche est garde par un test ; cette affirmation n'etait verifiee par personne
d'autre que son auteur, sur sa machine, quand il y pensait. Une promesse de
fiabilite qui depend de la memoire de son auteur n'en est pas une.

Le titre se lit par l'endpoint HTTP de debogage, pas par une evaluation JS, et
c'est le point qui a demande deux essais. La suite lit ses fichiers source en XHR
SYNCHRONE : le fil principal du navigateur est bloque pendant ces lectures, donc
un `Runtime.evaluate` reste en file d'attente et la connexion tombe en timeout. `/json/list` rend le titre de chaque onglet sans jamais toucher au
fil de la page.

Le pilotage CDP vient de `captures.py` et n'est pas recopie : c'est le meme
besoin, la meme poignee de main, et deux clients qui divergent finiraient par ne
plus lancer le meme navigateur.

    python executer-tests.py                          tout
    python executer-tests.py --touche assets/app.js   ce qui lit ce fichier
    python executer-tests.py --touche tests/NN-x.tests.js   les suites de cette partie
    python executer-tests.py --touche calcul          le modele, sans lecture de source
    python executer-tests.py --suites credit          les suites dont le nom le porte

Le script demarre le serveur lui-meme s'il ne repond pas, ferme tout en sortant,
et rend TROIS codes de sortie, pas deux :

    0   vert, et complet. Le seul qui autorise un envoi.
    1   rouge.
    2   vert, mais PARTIEL — une selection etait demandee.

Le 2 n'est pas une coquetterie. La regle de la maison veut qu'un push soit garde
par `... && git push`, et `&&` ne passe que sur 0 : une execution ciblee ne peut
donc pas autoriser un envoi, meme si on oublie qu'elle etait ciblee. La regle
cesse d'etre une promesse et devient une mecanique.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import captures
import parcours
import controle_sql

# La console Windows ecrit en cp1252 et etouffe sur la coche du verdict : le
# script mourait apres avoir lu le bon resultat, ce qui est la pire facon
# d'echouer — un rouge qui ne dit rien du vert qu'il vient de mesurer.
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PORT = int(os.environ.get("PORT_LONGWARD", "8766"))
BASE = f"http://localhost:{PORT}"
RACINE = os.path.dirname(os.path.abspath(__file__))

# Le titre porte le verdict, et c'est deja la convention de la page : une coche
# et un compte, ou une croix et un nombre d'echecs. Le lire est donc le meme
# geste que celui d'un humain devant l'onglet.
OK, KO = "✓", "✕"
# Le titre d'une execution ciblee porte ce mot, pose par `tests.html`.
PARTIEL = "(PARTIEL)"


def selection():
    """Les options de ciblage, rendues en morceau de requete.

    Volontairement minuscule : deux drapeaux, aucune bibliotheque, et un refus
    net de ce qui n'est pas reconnu. Un argument mal orthographie qui serait
    ignore ferait tourner TOUTE la suite en laissant croire au contraire — ou
    l'inverse, ce qui est pire.
    """
    import urllib.parse
    args, params = sys.argv[1:], {}
    while args:
        drapeau = args.pop(0)
        cle = {"--suites": "suites", "--touche": "touche"}.get(drapeau)
        if not cle:
            sys.exit(f"option inconnue : {drapeau}\n"
                     "attendu : --suites <motif> ou --touche <chemin|calcul>")
        if not args:
            sys.exit(f"{drapeau} attend une valeur")
        params[cle] = args.pop(0)
    return ("?" + urllib.parse.urlencode(params)) if params else ""


def serveur_repond():
    try:
        with urllib.request.urlopen(BASE + "/tests.html", timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


# Les routes controlees apres une suite verte et complete, et la vue que
# chacune doit rendre : les huit vues, puis quatre anciennes adresses que
# REDIRECTIONS et currentView() (assets/app.js) menent ailleurs.
ROUTES = [
    ("#/overview", "overview"),
    ("#/budget", "budget"),
    ("#/positions", "positions"),
    ("#/allocation", "allocation"),
    ("#/accounts", "accounts"),
    ("#/data", "data"),
    ("#/settings", "settings"),
    ("#/profil", "profil"),
    ("#/objective", "overview"),
    ("#/rebalance", "positions"),
    ("#/patrimoine", "allocation"),
    ("#/notifications", "settings"),
]


# DES TRAJETS DE LA VUE, joues dans l'onglet de leur route une fois celle-ci
# rendue. La page de tests ne charge pas la vue ; ce controle la charge, dans un
# profil temporaire qui ne porte aucune donnee, et c'est le seul endroit ou un
# geste de l'interface s'exerce vraiment. Chaque trajet rend vrai, ou la phrase
# qui dit ce qui manque. Sans patrimoine, Allocation n'a pas de repartition et
# le trajet se tait : c'est le cas d'une graine vide (la beta). Avec un
# patrimoine, l'absence du selecteur est un echec.
TRAJETS = {
    "#/allocation": (
        "une ancre d'angle, demandee sur la page ouverte, ouvre son angle",
        "(async () => {"
        " if (!(patrimoine().brut > 0.005)) return true;"
        " ACTIONS.goto({ dataset: { view: 'allocation', anchor: 'disponibilite' } });"
        " await new Promise(r => setTimeout(r, 300));"
        " const b = document.querySelector('[data-action=\"alloc-angle\"][data-angle=\"disponibilite\"]');"
        " return !!(b && b.classList.contains('on'))"
        " && !!document.querySelector('section.alloc-angle[data-anchor=\"disponibilite\"]'); })()",
    ),
}


def jouer_trajet(ws, code):
    """Joue un trajet dans un onglet deja rendu ; rend vrai s'il aboutit."""
    onglet = captures.Onglet(ws)
    try:
        return onglet.js(code) is True
    finally:
        onglet.ferme()


def controle_des_routes():
    """Ouvre index.html sur chaque route, en mode controle, dans le profil
    temporaire, donc sans aucune donnee. assets/parties.js y ecrit
    « ✓ rendu <vue> » apres le premier rendu, ou « ✕ chargement : … » a la
    premiere erreur ; on lit le titre de l'exterieur, comme pour la suite.
    Chromium refuse GET pour /json/new : l'onglet se demande en PUT."""
    import urllib.parse
    cdp = f"http://127.0.0.1:{captures.PORT_CDP}"
    ouverts = {}
    sockets = {}
    trajets = []
    for route, vue in ROUTES:
        url = BASE + "/index.html?controle=1" + route
        req = urllib.request.Request(cdp + "/json/new?" + urllib.parse.quote(url, safe=""), method="PUT")
        with urllib.request.urlopen(req, timeout=10) as r:
            o = json.load(r)
            ouverts[o["id"]] = (route, vue)
            sockets[o["id"]] = o.get("webSocketDebuggerUrl")
    titres = {}
    try:
        for _ in range(150):                          # trente secondes au plus
            with urllib.request.urlopen(cdp + "/json/list", timeout=5) as r:
                for o in json.load(r):
                    if o.get("id") in ouverts:
                        titres[o["id"]] = o.get("title", "")
            if len(titres) == len(ouverts) and all(
                    t.startswith("✓ rendu") or t.startswith("✕") for t in titres.values()):
                break
            time.sleep(0.2)
        # Le signal suit le PREMIER rendu ; init() poursuit ensuite (cours,
        # synchronisation, second rendu). Les onglets restent ouverts quelques
        # secondes de plus, et le titre est relu : le registre garde le premier
        # echec, donc une erreur tardive y reste ecrite.
        time.sleep(4)
        with urllib.request.urlopen(cdp + "/json/list", timeout=5) as r:
            for o in json.load(r):
                if o.get("id") in ouverts:
                    titres[o["id"]] = o.get("title", "")
        for ident, (route, vue) in ouverts.items():
            if route not in TRAJETS or titres.get(ident, "") != "✓ rendu " + vue:
                continue
            nom, code = TRAJETS[route]
            try:
                ok = jouer_trajet(sockets[ident], code)
            except Exception as e:
                ok, nom = False, f"{nom} ({e})"
            if not ok:
                trajets.append(f"{route} : le trajet échoue : {nom}")
    finally:
        for ident in ouverts:
            try:
                urllib.request.urlopen(cdp + "/json/close/" + ident, timeout=5).close()
            except Exception:
                pass
    return [f"{route} : titre {titres.get(ident, '')!r}, attendu '✓ rendu {vue}'"
            for ident, (route, vue) in ouverts.items() if titres.get(ident, "") != "✓ rendu " + vue] + trajets


def titre_de_la_page():
    """Le titre vu de l'exterieur, sans executer une ligne dans la page."""
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{captures.PORT_CDP}/json/list", timeout=5
        ) as r:
            for onglet in json.load(r):
                if onglet.get("type") == "page" and "tests.html" in onglet.get("url", ""):
                    return onglet.get("title", "")
    except Exception:
        pass
    return ""


def details_des_echecs():
    """Les lignes rouges, telles que la page les affiche. La suite est finie a ce
    moment-la, donc le fil principal est libre et une evaluation passe."""
    onglet = None
    try:
        onglet = captures.Onglet(captures.cible())
        return onglet.js(
            "(() => { const l = document.body.innerText.split('\\n'), m = [];"
            " l.forEach((x, i) => { if (x.trim() === '\\u2715')"
            "   m.push(l.slice(i, i + 3).join(' | ')); });"
            " return m.join('\\n'); })()"
        )
    except Exception as e:
        return f"(details illisibles : {e})"
    finally:
        if onglet:
            onglet.ferme()


def main():
    if not captures.CHROME:
        sys.exit("Chrome introuvable : installe-le ou mets-le dans le PATH.")

    # Les arguments se lisent AVANT de demarrer quoi que ce soit : rejeter une
    # option apres avoir leve un serveur et un navigateur fait payer trois
    # secondes a une faute de frappe.
    cible = selection()
    if cible:
        print(f"execution ciblee : {cible}")

    serveur = None
    if serveur_repond():
        print(f"serveur deja en place sur {BASE}")
    else:
        serveur = subprocess.Popen(
            [sys.executable, os.path.join(RACINE, "serve.py"),
             "--port", str(PORT), "--no-browser"],
            cwd=RACINE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(40):
            if serveur_repond():
                break
            time.sleep(0.5)
        else:
            serveur.terminate()
            sys.exit(f"Le serveur n'a pas demarre sur {BASE}.")
        print(f"serveur demarre sur {BASE}")

    profil = tempfile.mkdtemp(prefix="longward-tests-")
    chrome = subprocess.Popen(
        [
            captures.CHROME,
            "--headless=new",
            f"--remote-debugging-port={captures.PORT_CDP}",
            # Depuis Chrome 111, la poignee de main websocket de debogage est
            # refusee par un 403 sans ce drapeau.
            "--remote-allow-origins=*",
            f"--user-data-dir={profil}",
            "--no-first-run",
            "--no-default-browser-check",
            # Sur un runner d'integration il n'y a ni bac a sable utilisable ni
            # /dev/shm de taille utile : sans ces deux drapeaux, Chrome meurt au
            # demarrage sans rien dire d'exploitable.
            "--no-sandbox",
            "--disable-dev-shm-usage",
            BASE + "/tests.html" + cible,
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    code = 1
    try:
        if not captures.attend_cdp():
            raise RuntimeError("Chrome n'a pas ouvert son port de debogage.")

        titre = ""
        # Un cinquieme de seconde : la suite complete tient en trois secondes et
        # demie depuis que les sources se lisent une seule fois, et un sondage a
        # la seconde y ajoutait un demi-tour de roue pour rien.
        for _ in range(1500):                      # cinq minutes au plus
            titre = titre_de_la_page()
            if titre.startswith(OK) or titre.startswith(KO):
                break
            time.sleep(0.2)
        else:
            raise RuntimeError(f"la suite n'a rendu aucun verdict (titre : {titre!r})")

        print(titre)
        # Une suite qui ne compte AUCUN test n'est pas une suite qui passe.
        #
        # Le harnais n'enregistre rien quand aucune partie de la suite ne se
        # charge (manifeste `tests/sources.js` absent, balises perdues) : il
        # rend zero reussite et zero echec, et le titre s'ecrit « ✓ 0 tests »
        # -- une coche verte sur une suite absente. Une partie seule qui manque
        # est, elle, un echec nomme par le harnais. Ce script sortait alors en 0,
        # donc un push enchaine derriere partait sur une suite qui n'avait rien
        # verifie. C'est le vert le plus dangereux qui soit : il ne signale rien
        # a corriger. Le compte est donc lu, et zero vaut echec.
        compte = re.search(r"\d+", titre)
        if titre.startswith(OK) and compte and int(compte.group()) == 0:
            print("\nAucun test executé : les parties de la suite ne se chargent "
                  "probablement pas (tests/sources.js, balises de tests.html). "
                  "Ouvrir /tests.html et lire la console.",
                  file=sys.stderr)
        elif titre.startswith(OK) and PARTIEL in titre:
            # Vert, mais il ne parle que d'une partie de la suite : 2, pour que
            # le `&&` d'un push ne passe pas.
            print("\nExecution PARTIELLE : ce vert ne dit rien du reste de la "
                  "suite, et ne peut pas autoriser un envoi. Relancer sans "
                  "option avant de pousser.", file=sys.stderr)
            code = 2
        elif titre.startswith(OK):
            code = 0
        else:
            print("\n" + (details_des_echecs() or "(aucun detail)"), file=sys.stderr)
        # Une suite verte et complete ne dit pas que l'application se charge :
        # tests.html ne charge pas app.js. Les douze routes le disent.
        if code == 0:
            fautes = controle_des_routes()
            if fautes:
                print("\nL'application ne se charge pas sur toutes ses routes :\n  "
                      + "\n  ".join(fautes), file=sys.stderr)
                code = 1
            else:
                print(f"{len(ROUTES)} routes rendues sans erreur")
                # Puis les gestes de la vue, et la largeur de chaque route sur
                # un telephone : voir parcours.py.
                fautes, joues = parcours.jouer(
                    BASE, f"http://127.0.0.1:{captures.PORT_CDP}", ROUTES)
                if fautes:
                    print("\nDes parcours échouent :\n  " + "\n  ".join(fautes), file=sys.stderr)
                    code = 1
                else:
                    print(f"{joues} parcours joués sans faute")
                    # Puis le SQL de l'etat contre un vrai SQLite : voir
                    # controle_sql.py.
                    fautes_sql, n_sql = controle_sql.verifier(os.path.dirname(os.path.abspath(__file__)))
                    if fautes_sql:
                        print("\nLe SQL de l'état ne tient pas :\n  " + "\n  ".join(fautes_sql), file=sys.stderr)
                        code = 1
                    else:
                        print(f"{n_sql} contrôles SQL sur SQLite {controle_sql.sqlite3.sqlite_version}")
    finally:
        chrome.terminate()
        if serveur:
            serveur.terminate()
        shutil.rmtree(profil, ignore_errors=True)

    sys.exit(code)


if __name__ == "__main__":
    main()
