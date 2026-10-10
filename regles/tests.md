# Tests

Détail des règles 2 et 3 de l'index, `AGENTS.md` : choisir ses tests, lire un verdict, et ce que les tests doivent couvrir.

## Choisir ses tests : ciblés par défaut, complets quand le risque le justifie

**Principe permanent : tests ciblés par défaut, suite complète uniquement quand
le risque le justifie.** Il gouverne la boucle de travail — et il ne gouverne
jamais un envoi, qui exige la suite entière (voir plus bas, c'est mécanique).

Avant de s'en servir, un chiffre. La suite a mis 112 secondes pendant des mois,
et c'est ce qui rendait la question urgente. Elle en met 14, dont 3,5 de tests :
le reste est le démarrage de Chrome, que rien ne cible. **Le ciblage ne fait donc
plus gagner que 3 secondes sur une exécution en ligne de commande.** Ce qu'il
apporte vraiment est ailleurs : la page ouverte dans un navigateur affiche 15
lignes au lieu de 1 052, et un rouge se lit sans le chercher.

La conséquence pratique est franche, et elle va contre l'intuition qui a mené
ici : **dans le doute, tout lancer.** Le plafond est à 14 secondes.

### Les commandes

```
python executer-tests.py                          tout
python executer-tests.py --touche assets/app.js   les suites qui lisent ce fichier
python executer-tests.py --touche assets/styles.css
python executer-tests.py --touche calcul          le modèle, sans lecture de source
python executer-tests.py --touche tests/NN-x.tests.js   les suites déclarées dans cette partie
python executer-tests.py --suites crédit          les suites dont le nom porte le mot
```

Et dans le navigateur, la même chose dans l'adresse :
`tests.html?touche=assets/app.js`, `tests.html?suites=crédit`,
`tests.html?touche=calcul`.

`--touche` se **dérive** du corps des suites : une suite qui lit
`assets/app.js` est celle dont le texte contient `lireSource('assets/app.js')`.
Aucune liste n'est tenue à la main, donc rien ne diverge quand un test déménage.
`calcul` est le complément — les suites qui ne lisent aucune source, donc celles
qui font tourner le modèle sur des nombres. C'est la moitié qui compte quand un
calcul change, et aucun nom de fichier ne la désigne.

Une exception : **`--touche tests/NN-….tests.js` choisit les suites déclarées
dans cette partie**, puisque la suite vit en parties (`tests/sources.js` en tient
le manifeste). C'est ce qu'on lance après avoir écrit un test : ses suites ne
lisent pas forcément leur propre fichier. Une partie qui manque à l'appel rend
le verdict rouge, même en exécution ciblée.

Les fichiers de l'application vivent aussi en parties (`assets/parties.js` en
tient la liste, `GROUPES`). `lireSource('assets/app.js')` rend le texte entier,
et `--touche assets/app-NN-….js` se ramène au groupe `assets/app.js`.

**Une suite verte et complète ouvre ensuite l'application sur douze routes**, en
mode contrôle et dans le profil temporaire du lanceur : chaque onglet doit écrire
« ✓ rendu <vue> » dans son titre. Une partie absente, une exception ou une vue
qui lève au rendu le rend rouge, avec le code 1.

**Puis les parcours de `parcours.py`** : des gestes réels de la vue (« Annuler »,
la fenêtre des dépenses, le relevé du mois, un état local illisible), joués dans
le même profil temporaire, et chaque route mesurée à 390 px en français puis en
anglais, sans débordement de la page. Un parcours rend `true` ou la phrase qui
dit ce qui manque ; un échec, ou un titre passé à « ✕ » pendant le geste, rend
le code 1. Un nouveau geste qui compte s'y ajoute : c'est le seul endroit où un
clic s'exerce vraiment.

`--suites` porte sur le **nom de la suite**, pas sur le sujet de chaque test
qu'elle contient : un contrôle sur le périmètre du graphique vit dans une suite
appelée « Deux réglages, deux questions », que `--suites périmètre` ne trouve
pas. C'est vérifié : la sélection a rendu neuf tests verts sans jamais toucher
celui qu'on voulait. En cas de doute, `--touche` sur le fichier, qui se dérive
du code et ne dépend d'aucun intitulé.

Un motif qui ne désigne rien est une **erreur**, pas un vert : « 0 test » sous
une coche est le pire des verts. Une option inconnue arrête le script, avant
même le serveur.

### Quel niveau pour quel changement

| Risque | Ce que c'est | Ce qu'on lance |
|---|---|---|
| Bas | un libellé, une traduction, une couleur, un commentaire | `--touche` sur le fichier modifié |
| Moyen | le balisage d'une carte, une chaîne affichée nouvelle, un graphique | `--touche` sur le fichier, **plus** `--suites` sur le sujet |
| Élevé | tout ce qui **calcule** | la suite complète, sans exception |

Est à risque élevé, et la liste n'est pas négociable : `store.js` sous toutes
ses formes ; une migration ; la persistance et la synchronisation ; un helper
partagé (`fmtEUR`, `trad`, `aide`, `esc`) — il ne se voit nulle part et se lit
partout ; la chaîne de publication ; et tout changement dont on ne sait pas dire
ce qu'il touche. Ce dernier cas est le plus fréquent, et c'est pour lui que le
plafond de 14 secondes compte.

### Un vert partiel ne peut pas autoriser un envoi

Le lanceur rend **trois** codes de sortie :

```
0   vert, et complet. Le seul qui autorise un envoi.
1   rouge.
2   vert, mais PARTIEL.
```

La règle de la maison veut qu'un push soit gardé par `... && git push`, et `&&`
ne passe que sur 0. Une exécution ciblée ne peut donc pas autoriser un envoi,
**même en ayant oublié qu'elle était ciblée**. La page écrit `(PARTIEL)` dans son
titre, le lanceur le lit et en tire le 2 : la règle cesse d'être une promesse
tenue de mémoire et devient une mécanique.

C'est la même leçon que le `$?` qui doit garder le push plutôt que le précéder.
Une règle que rien n'applique finit par ne pas s'appliquer.

## Ce qui ne reçoit pas de nouveau test

**Une retouche visuelle ne reçoit pas de nouveau test.** Une couleur, un
espacement, une taille, un libellé qui change : la relecture de Codex et la
vérification dans le navigateur la prouvent. Un test qui relit la feuille de
style pour y trouver `color: var(--accent)` ne protège de rien : il ne voit pas
l'écran, et il faut le réécrire le jour où l'on reformule la règle sans rien
changer à ce qui s'affiche. Près de la moitié de la suite relit déjà le code
plutôt que d'exercer un comportement.

Cela ne dispense de rien d'autre : **les tests existants s'exécutent toujours**,
au niveau que fixe le tableau ci-dessus, et en entier avant un push.

Les nouveaux tests vont à ce qui calcule, à ce qui écrit et à ce qui a déjà
cassé : un total, un solde, une vente, une annulation, un geste qui modifie les
données. Un bug signalé garde son test, même visuel, **s'il se prouve par un
comportement** : un élément qui sort de l'écran à 375 px, une zone tactile qui
en recouvre une autre, un contraste calculé sur le fond peint. Jamais par la
relecture d'une ligne de style.

## Ce que les tests doivent couvrir

La règle qui les gouverne tient en une phrase : **un total égale la somme de
ses parts**. Presque tous les bugs de calcul rencontrés la violaient sans que
rien ne se voie à l'écran.

À vérifier à chaque fois qu'un chiffre nouveau apparaît :

- La somme des parts fait le total affiché, et les pourcentages font 100 %.
- Le même libellé donne le même montant sur tous les écrans. « Liquidités »
  a déjà valu deux choses différentes sur deux pages, les deux totaux justes.
- Un pourcentage dit sur quelle base il est calculé. Trois écrans ont déjà
  donné trois parts différentes pour la même ligne.
- Rien ne sort de l'écran à 375 px. Un bouton hors cadre est inatteignable :
  `body` est en `overflow-x: clip`, les pixels au-delà du bord sont perdus.
- Les migrations sont idempotentes : les jouer deux fois donne le même état.
- **Un fait se règle à un seul endroit.** Deux portes sur le même champ sont
  saines — le montant de la carte du mois et la barre « Objectif dépenses »
  ouvrent la même fenêtre. Deux champs pour la même valeur ne le sont pas :
  personne ne peut vérifier qu'ils s'accordent, et l'argument « jamais visibles
  en même temps » est exactement l'aveu du problème.
- **Une liste se dérive, elle ne se recopie pas.** Le défaut qui revient le plus
  souvent ici : deux listes écrites à la main pour une seule vérité, et celle
  qu'on oublie de changer dit le contraire de l'autre. Le regroupement par
  enveloppe parcourait `TYPES_COMPTE` : un compte au type inconnu disparaissait
  de la page sans quitter le total affiché en tête. `groupesParEnveloppe()` part
  des comptes, la table ne sert plus qu'à ordonner. Même faute côté vue : un
  renvoi lisait `SOUS_ONGLETS.allocation[1][1]`, l'ordre des onglets a changé, et
  la phrase invitait à aller dans « Patrimoine » depuis Patrimoine.
- **Un pourcentage n'existe que sur une base positive.** Diviser par une base
  négative retourne le signe, et une base qui traverse zéro rend le rapport
  arbitrairement grand : un crédit saisi sans son bien affichait « −475,5 % ».
  `deltas()` rend `pct: null` dans ces cas, et l'écran se contente de l'euro.
- **Une base qui bouge toute seule inverse le signal.** Le rendement immobilier
  se calculait sur « prix payé moins capital restant dû », un dénominateur qui
  grossit à chaque mensualité : à cash-flow égal le pourcentage baissait pendant
  que l'opération s'améliorait. Un ratio dont la base dérive avec le temps ne se
  compare pas à lui-même d'une année sur l'autre, et c'est pourtant l'usage
  qu'on en fait. Préférer une base que le détenteur déclare une fois — l'apport.
- **Quand plusieurs approximations manquent, vérifier si elles tirent du même
  côté.** L'immobilier ignorait la période du loyer, la vacance et l'impôt : les
  trois gonflaient le rendement. Un outil imprécis se trompe des deux côtés ;
  celui qui se trompe toujours du côté flatteur est biaisé, et ça ne se voit
  jamais sur un seul chiffre.
- **Un état se déclare, il ne se déduit pas.** Une échéance dépassée ne veut pas
  dire « en retard » : le virement arrive souvent avec quelques jours de retard,
  et peindre la ligne en rouge le lendemain crierait au loup à chaque fois.
  L'application signale, le détenteur tranche. Idem pour `verifieLe` sur un
  crédit : c'est le geste de quelqu'un qui a regardé, jamais une supposition.
- **Un chiffre qui vieillit tout seul doit se projeter et se rappeler.** Un
  capital restant dû est le seul champ qui devient faux sans que personne y
  touche. `projectionCredit()` rejoue l'amortissement depuis la dernière
  vérification, la cloche réclame au bout de trois mois en portant le montant
  projeté, et la fenêtre le propose sans jamais l'écrire — un remboursement
  anticipé la démentirait.
- **La cloche ne parle que de ce qui existe chez celui qui la regarde.** Elle
  réclamait une actualisation des cours à quelqu'un qui n'a aucun titre coté.
  Deux contrôles gardés par `Store.state.positions.length`, et les échéances par
  le drapeau `prete` du type de compte.

Vérifier dans le navigateur **sans jamais écrire dans les données réelles** : le
le `localStorage` de qui lance les tests n'est pas un bac à sable. Pour voir un état qu'il
n'a pas, remplacer `Store.state` par un `structuredClone` modifié, appeler
`render()`, lire, puis remettre l'original — `Store.save()` n'étant jamais
appelé, rien n'est écrit. Mettre tout de même le contenu de `localStorage` de
côté avant, et le remettre après.

**Cliquer un bouton, c'est appeler `Store.save()`.** Garder `Store.state` de
côté ne suffit alors plus : le clic a déjà réécrit le `localStorage`, et l'état
simulé y reste. Avant tout clic sur une action, mettre **la chaîne brute** de
côté (`localStorage.getItem('wealth-dashboard:v1')`) et la remettre telle quelle
à la fin, `savedAt` compris. Une longueur en octets identique avant et après le
prouve.
