"""Les instructions D1 de l'etat, jouees contre un vrai SQLite.

D1 est SQLite. Les tests du navigateur jouent le worker avec un faux D1 qui
reconnait ses instructions : ils prouvent que le worker appelle la bonne
instruction avec les bons parametres, pas que l'instruction fait ce qu'on croit.
Ce controle prouve la seconde moitie : il extrait `SQL_ETAT` et `SCHEMA_ETAT_D1`
de `_worker.js` (le texte meme qui part en ligne), cree les tables -- celles de
`schema.sql` d'abord s'il existe --, active les cles etrangeres comme D1, et
joue les cas : base bonne ou perimee, deux ecritures sur la meme base, etat
efface, ecriture sans base, force, sauvegarde de migration seulement pour une
ecriture acceptee, corps illisible, bascule, cascades d'un compte.

    verifier(racine) -> (fautes, nombre de controles)
"""
import io
import os
import re
import sqlite3


def _extraire(source):
    m = re.search(r'const SCHEMA_VERSION_SQL = "([^"]*)";', source)
    if not m:
        raise ValueError("SCHEMA_VERSION_SQL introuvable")
    version_sql = m.group(1)
    d = source.index("const SQL_ETAT = {")
    f = source.index("\n};", d)
    sql = {}
    for nom, corps in re.findall(r"(\w+):\s*`([^`]*)`", source[d:f]):
        sql[nom] = corps.replace("${SCHEMA_VERSION_SQL}", version_sql)
    d = source.index("const SCHEMA_ETAT_D1 = [")
    f = source.index("\n];", d)
    schema = re.findall(r"`([^`]*)`", source[d:f])
    return sql, schema


class _Base:
    def __init__(self, racine, schema_etat):
        self.c = sqlite3.connect(":memory:")
        self.c.execute("PRAGMA foreign_keys = ON")
        chemin = os.path.join(racine, "schema.sql")
        if os.path.exists(chemin):
            self.c.executescript(io.open(chemin, encoding="utf-8").read())
        for instruction in schema_etat:
            self.c.execute(instruction)
        self.comptes = bool(self.c.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").fetchone())

    def changes(self, sql, params=()):
        avant = self.c.total_changes
        self.c.execute(sql, params)
        return self.c.total_changes - avant

    def un(self, sql, params=()):
        return self.c.execute(sql, params).fetchone()


def verifier(racine):
    source = io.open(os.path.join(racine, "_worker.js"), encoding="utf-8").read()
    fautes, n = [], 0

    def ok(cond, phrase):
        nonlocal n
        n += 1
        if not cond:
            fautes.append(phrase)

    if sqlite3.sqlite_version_info < (3, 38, 0):
        return [f"SQLite {sqlite3.sqlite_version} : unixepoch() demande 3.38 au moins"], 1
    try:
        _jouer(racine, source, ok)
    except Exception as e:
        fautes.append(f"le controle s'interrompt : {type(e).__name__} : {e}")
    return fautes, n


def _jouer(racine, source, ok):
    sql, schema = _extraire(source)
    attendues = {"lire", "ecrireSurBase", "ecrireSansBase", "imposer", "sauverSurBase",
                 "sauverAvantImposer", "effacer", "importer", "purgerSauvegardes",
                 "basculeVue", "basculeLire"}
    ok(attendues <= set(sql), f"instructions manquantes : {sorted(attendues - set(sql))}")

    b = _Base(racine, schema)
    q = b.c
    proprio = "u1"
    if b.comptes:
        q.execute("INSERT INTO users (id, email, created_at, updated_at) VALUES ('u1', 'a@longward.test', 0, 0)")
    a_existe = bool(b.un("SELECT 1 FROM sqlite_master WHERE name = 'etat_bascule'"))
    corps = lambda v, at: '{"schemaVersion":%d,"meta":{"savedAt":"%s"},"positions":[],"monthly":[]}' % (v, at)
    sauvegardes = lambda: b.un("SELECT COUNT(*) FROM portfolio_backups")[0]

    # Ecriture sans base : seulement si rien n'est en place.
    ok(b.changes(sql["ecrireSansBase"], (proprio, corps(2, "A"), "r1")) == 1, "sans base, sur rien : ecrit")
    ok(b.changes(sql["ecrireSansBase"], (proprio, corps(2, "A2"), "rX")) == 0, "sans base, sur un etat : refuse")
    ok(b.un(sql["lire"], (proprio,))[1] == "r1", "la revision en place est r1")

    # Sur base : la bonne passe une fois, la perimee jamais.
    ok(b.changes(sql["ecrireSurBase"], (corps(2, "B"), "r2", proprio, "r1")) == 1, "base bonne : ecrit")
    ok(b.changes(sql["ecrireSurBase"], (corps(2, "C"), "r3", proprio, "r1")) == 0,
       "meme base une seconde fois : refuse (deux ecritures, une seule passe)")
    ok(b.un(sql["lire"], (proprio,))[0] == corps(2, "B"), "le corps en place est celui de la premiere")

    # Sauvegarde de migration : seulement pour une ecriture acceptee, et si le schema change.
    b.changes(sql["sauverSurBase"], (proprio, "r1", 3))
    ok(sauvegardes() == 0, "base perimee : aucune sauvegarde")
    b.changes(sql["sauverSurBase"], (proprio, "r2", 2))
    ok(sauvegardes() == 0, "meme schema : aucune sauvegarde")
    b.changes(sql["sauverSurBase"], (proprio, "r2", 3))
    ok(b.changes(sql["ecrireSurBase"], (corps(3, "D"), "r4", proprio, "r2")) == 1, "migration : ecrit")
    ok(sauvegardes() == 1, "migration acceptee : une sauvegarde")
    ok(b.un("SELECT schema_version, body FROM portfolio_backups")[0] == 2
       and b.un("SELECT body FROM portfolio_backups")[0] == corps(2, "B"),
       "la sauvegarde porte l'etat remplace et son schema")

    # Force : remplace, et sauvegarde si le schema change.
    b.changes(sql["sauverAvantImposer"], (proprio, 3))
    ok(sauvegardes() == 1, "force au meme schema : pas de sauvegarde")
    ok(b.changes(sql["imposer"], (proprio, corps(3, "E"), "r5")) >= 1, "force : ecrit")
    ok(b.un(sql["lire"], (proprio,))[1] == "r5", "force : la revision imposee est en place")

    # Retour du corps a une valeur passee : la revision, elle, ne revient pas.
    ok(b.changes(sql["ecrireSurBase"], (corps(2, "B"), "r6", proprio, "r5")) == 1, "retour au corps B : ecrit")
    ok(b.changes(sql["ecrireSurBase"], (corps(2, "Z"), "r7", proprio, "r2")) == 0,
       "un appareil reste sur l'ancien B (r2) ne peut pas ecrire")

    # Corps illisible : les sauvegardes ne levent pas.
    q.execute("UPDATE portfolios SET body = 'pas du json' WHERE owner_id = ?", (proprio,))
    try:
        b.changes(sql["sauverSurBase"], (proprio, "r6", 2))
        ok(True, "")
    except sqlite3.Error as e:
        ok(False, f"un corps illisible fait lever la sauvegarde : {e}")
    q.execute("UPDATE portfolios SET body = ? WHERE owner_id = ?", (corps(2, "B"), proprio))

    # Effacement : une ligne vide, que rien ne ressuscite.
    b.changes(sql["effacer"], (proprio,))
    ok(b.un(sql["lire"], (proprio,))[0] == "", "efface : le corps est vide")
    ok(b.changes(sql["importer"], (proprio, corps(2, "KV"), "rK")) == 0, "efface : l'import ne ressuscite rien")
    ok(b.changes(sql["ecrireSurBase"], (corps(2, "F"), "r8", proprio, "")) == 0, "efface : pas d'ecriture sur base")
    ok(b.changes(sql["ecrireSansBase"], (proprio, corps(2, "G"), "r9")) == 1, "efface : une ecriture sans base repart")

    # Import : seulement sans ligne.
    autre = "u2"
    if b.comptes:
        q.execute("INSERT INTO users (id, email, created_at, updated_at) VALUES ('u2', 'b@longward.test', 0, 0)")
    ok(b.changes(sql["importer"], (autre, corps(2, "K"), "rK")) == 1, "import sans ligne : ecrit")
    ok(b.changes(sql["importer"], (autre, corps(2, "K2"), "rK2")) == 0, "import sur une ligne : ignore")

    # Purge des sauvegardes de plus de cent quatre-vingts jours.
    q.execute("INSERT INTO portfolio_backups (owner_id, created_at, schema_version, body) VALUES (?, 0, 1, 'x')", (proprio,))
    avant = sauvegardes()
    b.changes(sql["purgerSauvegardes"])
    ok(sauvegardes() == avant - 1, "la purge retire la copie de plus de 180 jours, et elle seule")

    # Bascule : un seul passage note, puis l'ecart se mesure.
    if a_existe:
        b.changes(sql["basculeVue"], (proprio,))
        ok(b.changes(sql["basculeVue"], (proprio,)) == 0, "la bascule ne se note qu'une fois")
        depuis = b.un(sql["basculeLire"], (proprio,))
        ok(depuis is not None and depuis[0] >= 0, "l'ecart depuis la bascule se lit")

    # Cascades d'un compte (demonstration) : les sauvegardes suivent.
    if b.comptes:
        q.execute("INSERT INTO portfolio_backups (owner_id, created_at, schema_version, body) "
                  "VALUES ('u1', unixepoch(), 2, 'y')")
        q.execute("UPDATE users SET id = 'u1bis' WHERE id = 'u1'")
        ok(b.un("SELECT COUNT(*) FROM portfolio_backups WHERE owner_id = 'u1'")[0] == 0
           and b.un("SELECT COUNT(*) FROM portfolio_backups WHERE owner_id = 'u1bis'")[0] >= 1,
           "un compte renomme emporte ses sauvegardes")
        q.execute("DELETE FROM users WHERE id = 'u1bis'")
        ok(b.un("SELECT COUNT(*) FROM portfolio_backups WHERE owner_id = 'u1bis'")[0] == 0
           and b.un("SELECT COUNT(*) FROM portfolios WHERE owner_id = 'u1bis'")[0] == 0,
           "un compte supprime efface son etat et ses sauvegardes")


if __name__ == "__main__":
    import sys
    f, n = verifier(sys.argv[1] if len(sys.argv) > 1 else ".")
    print(f"{n} controles SQL, {len(f)} faute(s)")
    for x in f:
        print("  -", x)
    sys.exit(1 if f else 0)
