# Longward — index des règles

**Ce fichier est l'index des règles, pour tout agent qui touche ce code.**
`CLAUDE.md` l'importe. Il dit ce qui vaut pour tout changement, puis où lire le
détail : un dossier `regles/`, un fichier par sujet. **Le fichier d'un geste se
lit avant de faire ce geste, pas après.** Un changement de couleur ne demande
pas de lire les règles de publication, mais un push les demande toutes.

Lire `ETAT.md` en premier s'il est présent : il porte l'état réel du projet,
les décisions prises et les pièges rencontrés. Il n'est pas publié, car il
décrit le profil d'investisseur du propriétaire. Il vit dans le dépôt privé et,
ici, hors du suivi Git. Un clone du dépôt public ne l'a pas, et c'est normal.

## Obligatoire, selon le geste

| Avant de… | Lire, en entier |
|---|---|
| lancer des tests, en écrire, ou lire un verdict | [regles/tests.md](regles/tests.md) |
| pousser, publier, changer de branche | [regles/publier.md](regles/publier.md) |
| écrire un test, un commentaire ou un message de commit, ou toucher la graine | [regles/donnees-personnelles.md](regles/donnees-personnelles.md) |
| toucher l'interface : vue, carte, style, libellé | [regles/interface.md](regles/interface.md) |
| toucher une saisie, un solde, une date, un lien entre deux faits | [regles/donnees.md](regles/donnees.md) |
| modifier un calcul, un total ou une donnée dérivée | [regles/principes.md](regles/principes.md) |
| écrire du texte affiché ou un commentaire | [regles/ecriture.md](regles/ecriture.md) |
| écrire un fichier par script, heredoc ou Python | [regles/pieges.md](regles/pieges.md) |
| planifier ou faire relire avec Codex | [regles/deux-agents.md](regles/deux-agents.md) |

## Ce qui vaut pour tout changement

1. **Deux agents.** Tout changement qui n'est pas une retouche commence par un
   plan que Codex critique. Rien ne se commite sans son « validé ». Une
   fonctionnalité vaut une session Codex, reprise avec `codex exec resume`.
   Codex lit lui-même `git diff HEAD` dans l'arbre : on ne lui colle pas le
   diff. Il donne toutes ses objections en une seule passe.
2. **Tests verts, sur le bon port, avant tout push.** Ici, le port **8766**.
   Le push est gardé par le code de sortie, jamais par la dernière ligne lue :
   `python executer-tests.py > sortie 2>&1 && git push …`. Le code 0 seul
   autorise un envoi, le 2 dit un vert partiel, le 1 un rouge.
3. **Compléter les tests.** La question : quelle assertion aurait attrapé ce
   bug avant moi ? Une retouche visuelle ne reçoit pas de nouveau test : voir
   [regles/tests.md](regles/tests.md).
4. **Remplacer la balise `?v=`** d'`index.html` et de `tests.html` dès qu'un
   fichier d'`assets/` change.
5. **Jamais** `--force`, jamais la réécriture d'un historique publié, jamais un
   push d'une autre branche que celle demandée. La branche `demo` ne se pousse
   pas : la publication passe par `public-purge2:main` et par elle seule.
   L'arbre doit être propre avant tout `git checkout`.
6. **Ce dépôt est public.** Aucun nom réel de tiers, aucune citation et aucun
   montant du propriétaire dans `tests/`, dans un commentaire ou dans un
   message de commit. La graine reste entièrement fictive.
7. **Écrire.** Un commentaire dit pourquoi le code est ainsi, au présent et en
   ASCII, jamais ce qui s'est passé. Le texte affiché porte ses accents, tutoie,
   passe par `trad()` avec sa clef anglaise dans le même commit, et n'a pas de
   tiret cadratin.
8. **Messages de commit.** En français sur `demo`, en anglais sur le dépôt
   public.

## Fichiers en parties

Les gros fichiers vivent en parties d'une centaine de Ko : `assets/parties.js`
liste celles de l'application, `tests/sources.js` celles de la suite. On ouvre
la partie qui porte ce qu'on change, pas le groupe entier.
`lireSource('assets/app.js')` rend toujours le texte complet d'un groupe.

## Commandes

```
python executer-tests.py                          tout
python executer-tests.py --touche assets/app.js   les suites qui lisent ce fichier
python executer-tests.py --touche calcul          le modèle, sans lecture de source
python executer-tests.py --suites crédit          les suites dont le nom porte le mot
python serve.py --port 8766 --no-browser          le serveur de cet arbre
```

## Témoin de fin de fichier

Le mot témoin de ce fichier est **FIN-DES-REGLES**. Un agent qui ne le connaît
pas n'a pas lu l'index en entier.
