# Écriture

Détail de la règle 7 de l'index, `AGENTS.md` : les commentaires et le texte affiché.

## Écriture

- **Un commentaire dit pourquoi le code est ainsi, jamais ce qui s'est passé.**
  Au présent, sans date, sans nom, sans citation. Deux raisons, et la première
  suffit : **une application web sert ses fichiers en clair**, donc tout
  commentaire part en ligne et se lit dans `view-source` — les échanges cités,
  les noms d'établissements, les décisions abandonnées. La seconde est la règle
  de la maison : git garde déjà l'historique, le redire en commentaire crée une
  seconde copie que personne ne met à jour.
  Ce qui mérite un commentaire : une contrainte que le code ne peut pas dire
  lui-même — « cette règle doit rester après telle autre, même spécificité,
  c'est l'ordre qui tranche », « aucun backtick ici, il fermerait la chaîne ».
  Ce qui n'en mérite pas : « signalé le 5 août », « X a demandé », « le
  correctif précédent avait posé… ». Le quand et le qui vont dans le message de
  commit, le récit dans `ETAT.md`.
  Nettoyage fait une fois, 185 paragraphes et phrases retirés, `index.html`
  allégé de 43 % : ne pas le refaire une deuxième fois.

- **On développe en deux langues, français et anglais, dans le même geste.**
  Toute chaîne affichée naît enveloppée de `trad()` avec sa clé dans
  `i18n.js`, traduction anglaise comprise, dans le même commit. Le rattrapage
  de 2026 a montré le prix de l'autre méthode : près de deux mille chaînes
  reprises une à une, sur plusieurs jours. Une chaîne posée sans sa clé n'est
  pas un raccourci, c'est un bug. Seules les données du détenteur (noms de
  comptes, d'établissements, libellés saisis) ne se traduisent jamais.
- **Pas de tiret cadratin (—) dans le texte affiché.** Une virgule, un
  deux-points ou une parenthèse. Les commentaires de code peuvent en garder.
- **Le texte affiché porte ses accents ; les commentaires, non.** Les
  commentaires s'écrivent en ASCII, volontairement — `AGENTS.md` a déjà porté des
  octets invisibles. Mais « sur la periode affichee » dans une bulle d'aide
  n'est pas une variante, c'est une faute, et neuf bulles en portaient. Un test
  cherche une liste de mots toujours faux sans accent dans tout ce qui
  s'affiche ; y ajouter le mot suivant quand il se présente.
- **L'application tutoie, partout, bulles d'aide comprises.** Cette règle a
  longtemps dit l'inverse pour les textes d'aide, et le code ne l'a jamais
  suivie : au moment de la mesure, les bulles portaient 60 tutoiements pour 30
  vouvoiements. Une règle à deux régimes rendait le défaut invisible, puisque
  chaque exemplaire pouvait se réclamer d'une moitié. Un seul régime, et un
  test qui ne tolère plus un seul « vous », « vos » ou « votre » dans le texte
  affiché. Tranché le 5 août 2026.
- Un intitulé dit exactement ce qu'il compte. « Patrimoine total » affichant
  le net a déjà coûté une demi-journée.
