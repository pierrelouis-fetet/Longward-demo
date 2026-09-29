# Données personnelles

Détail de la règle 6 de l'index, `AGENTS.md`.

## Données personnelles

Ce dépôt est public. `assets/seed.js` et `assets/seed-budget.js` sont
entièrement fictifs et **doivent le rester** : aucun montant constaté, aucune
personne réelle, aucune donnée de santé, jamais.
Un chiffre réel commité ici part en ligne au push suivant, et un dépôt public
ne se dépublie pas. Le fixture des tests est synthétique, et il doit le rester.

**Et la règle porte sur l'historique, pas seulement sur le fichier.** Une graine
peut être fictive aujourd'hui et ne pas l'avoir toujours été : ce sont les
commits qu'un dépôt public expose, pas l'état de l'arbre. Trois conséquences, à
tenir :

1. **Une branche de travail ne va jamais sur un dépôt public.** Son historique
   porte tout ce qu'on a essayé puis retiré, et personne ne relit six cents
   commits avant un push. Ici, seule `public-purge2:main` est publiable, et son
   historique a été reparti de zéro le 9 août pour cette raison exacte. Les
   branches `public`, `public-propre` et `public-purge` sont ses ancêtres
   abandonnés : elles portent le même genre de nom et des mois de retard, donc
   la seule façon de savoir laquelle est la bonne est de la comparer au distant,
   `git rev-list --count public-purge2..origin/main`, qui doit rendre 0.
2. **Avant de pousser vers un distant public, on regarde ce que la branche
   porte**, et pas seulement ce que l'arbre montre. `git log -S"<un nom>"` coûte
   trois secondes et répond.
3. Un test tient la graine (« aucun nom réel n'a repris place dans la graine »).
   Il liste ce qui est **attendu** plutôt que ce qui est interdit : une liste
   d'interdits demanderait d'écrire ici les vrais noms, donc de les publier pour
   les interdire. Et il ne remplace pas la règle : un historique ne se teste pas,
   il se contrôle avant d'être publié.

**Les captures du README se regénèrent par `python captures.py`**, jamais à la
main. Les quatre doivent montrer le même patrimoine : prises à des moments
différents, elles se contredisaient de 918,83 € et un lecteur attentif en
concluait que l'application compte mal. Le script pose la graine une fois, passe
en anglais, et prend les quatre images d'un seul tenant. Il faut que le serveur
tourne (`python serve.py --port 8766 --no-browser`).

Deux détails qui coûtent une heure si on les redécouvre : Chrome refuse la
connexion de débogage sans `--remote-allow-origins`, et `--screenshot` ne suffit
pas — il agrandit la fenêtre sans émuler l'appareil, donc les règles CSS de
téléphone ne s'appliquent pas et le rendu déborde. C'est
`Emulation.setDeviceMetricsOverride` qui donne ce qu'un téléphone affiche.

**La graine est le jeu de démonstration**, et il n'en existe pas de second :
`assets/demo.json` a vécu à côté d'elle, les deux ont divergé, le fichier est
parti. C'est donc la graine qu'un visiteur voit au premier chargement, et
`autoRefresh` y reste à `false` — une démonstration montre la même chose à tout
le monde, sinon les captures du README se contredisent et le lecteur en conclut
que l'application compte mal. Un test le garde.
