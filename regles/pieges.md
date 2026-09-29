# Pièges

Ce qui casse un fichier sans prévenir, surtout quand on l'écrit par script.

## Pièges de cette base de code

- `store.js` a déjà porté des octets invisibles : deux `0x08` là où `\b` était
  voulu, et de vrais NUL. Si `grep` annonce « binary file », c'est revenu.
- L'outil Bash n'arrive pas toujours à réécrire ces octets ; passer par
  PowerShell.
- Un backtick dans un commentaire HTML placé à l'intérieur d'un littéral de
  gabarit ferme la chaîne et casse tout le fichier.
- Un `\n` qui passe par un script (heredoc, python) peut devenir un vrai
  retour à la ligne au milieu d'un littéral : tout texte contenant `\n` ou des
  backticks s'écrit avec l'éditeur, jamais via un script. Le test « chaque
  fichier de l'application se parse » attrape la récidive.
- `couleurClasse` est un `const` lexical : `window.couleurClasse = …` ne le
  remplace pas. Pour simuler une panne, éditer la table.
- **Un document en ligne (`cat << 'FIN'`) mange un niveau d'antislash**, malgré
  le délimiteur entre guillemets. `[^\\w]` arrive dans le fichier en `[^\w]`,
  qui vaut `[^w]` dans une chaîne JavaScript, et l'expression rationnelle se met
  à mentir sans erreur. Écrire tout ce qui porte des antislashs avec l'outil
  d'écriture de fichier, puis vérifier le fichier avec `grep`. Le même piège
  vaut pour Python : `'\\u2019'` y arrive en `'’'`.
- **Un `’` peut être écrit littéralement dans la source**, sous forme
  d'échappement JavaScript et non de caractère. Une recherche portant sur
  l'apostrophe typographique ne le trouve alors pas.
- **Un commentaire HTML n'est pas du JavaScript.** Écrit *avant* le backtick
  d'ouverture d'un littéral, `<!-- … -->` casse le fichier entier. Le piège se
  double du précédent : dedans, un backtick ferme la chaîne. Deux fautes commises
  le même jour, chacune détectée par la suite qui parse chaque fichier — mais
  seulement après un rechargement, donc plusieurs minutes perdues. La règle
  tient en deux mots : **dans** le gabarit, `<!-- -->` sans backtick ; **hors**
  du gabarit, `/* */`.
- **Une f-string Python ne s'étend pas à la ligne suivante.** Dans une
  concaténation implicite, seule la ligne préfixée `f` interprète ses accolades :
  `f"{{ a "` `"}}"` produit `{ a }}`. Le JavaScript généré reçoit alors une
  accolade de trop. Écrire le code injecté d'un seul tenant, ou passer les
  valeurs par `json.dumps()`.
- **`executer-tests.py` sert SON dossier, pas le répertoire courant.**
  `RACINE = os.path.dirname(os.path.abspath(__file__))` : lancé depuis ici, celui
  du dépôt privé démarre un serveur sur l'arbre privé et rend son verdict. Il
  n'accepte aucun argument de chemin, et n'en refuse donc aucun — le `.` passé
  derrière est ignoré en silence. Le vert obtenu est vrai, il ne parle simplement
  pas de l'arbre qu'on vient de modifier. Chaque dépôt a le sien : lancer celui du
  dossier où l'on se trouve. Le compte de tests diffère entre les deux (1 046
  contre 1 065) et c'est le signal le moins cher pour s'en apercevoir.
