# Publier

Détail des règles 2, 4 et 5 de l'index, `AGENTS.md` : ce qui se fait avant chaque push, et comment la démo se publie.

## Avant chaque push, sans exception

1. **Lancer les tests** : ouvrir `/tests.html` sur le serveur local, **sur le
   port 8766**. Le titre de l'onglet donne le résultat. Aucun push si un test
   est rouge. Si un serveur y répond déjà, s'y rattacher (`launch.json`, entrée
   « demo ») : le port n'est pas un détail de confort, `localStorage` est lié à
   l'origine et un autre port donne une application vide. S'il n'y en a pas :
   `python serve.py --port 8766 --no-browser`.

   **8766 et non 8765**, et la confusion coûte une demi-heure : 8765 est
   l'origine du dossier principal, `Longward main`, dont l'application
   répond aussi et affiche aussi « Longward ». Une suite verte lue sur 8765
   n'aura rien vérifié de ce dépôt-ci. La balise `?v=` du fichier servi
   tranche : celle de la démonstration se termine par `-demo`.
2. **Compléter les tests** avec ce que le changement vient d'introduire. Un
   correctif sans test qui le protège se re-cassera. La question à se poser :
   *quelle assertion aurait attrapé ce bug avant moi ?* Une retouche visuelle
   ne reçoit pas de nouveau test : voir `regles/tests.md`.
3. **Remplacer la version** dans les balises `?v=…` d'`index.html` **et** de
   `tests.html` dès qu'un fichier d'`assets/` change. Sans ça, un navigateur
   qui a déjà vu le site resert l'ancien JavaScript — et la page de tests
   donnerait un vert mensonger. Une suite le vérifie désormais (« Les balises de
   version ne mentent pas ») : les deux pages doivent porter la même valeur,
   une seule, et aucun fichier d'`assets/` ne peut être servi sans balise.
   Régénérer les icônes compte comme un changement d'`assets/` : voir
   `ICONES.md` et `icones.py`.
4. **Pousser sans demander, si et seulement si les trois points ci-dessus sont
   faits.** L'accord est donné d'avance, le 12 août 2026 : ce qui le remplace,
   c'est la liste. Les tests verts, complétés, la balise de version remplacée,
   l'arbre de travail propre, et alors le push.

   Ce qui reste interdit sans un mot, parce qu'aucune vérification ne le rattrape :
   `--force` et toute réécriture d'un historique déjà publié ; un `git push` qui
   pousse une branche autre que celle demandée ; ici, pousser la branche de
   travail, dont l'historique est privé, la publication passant par
   `public-purge2:main` et par elle seule. `public-propre` existe encore et porte
   le même genre de nom : elle date du 18 août et accuse 63 commits de retard. La
   nommer a déjà envoyé une session ailleurs. Et en cas de rejet pour
   non-fast-forward, on regarde ce que le distant porte en plus avant de faire
   quoi que ce soit : quelqu'un a écrit ailleurs, l'écraser perdrait son travail.

   **Et l'arbre doit être propre AVANT tout `git checkout`.** Le miroir se pose
   par `git read-tree -u --reset`, qui écrase l'arbre de travail sans rien
   demander : une modification non commitée qui traînait au moment du basculement
   est perdue, et git ne l'a pas — elle n'a jamais été indexée. C'est arrivé à
   `AGENTS.md`, le 25 août, pendant la publication qui corrigeait justement le
   nom de branche ci-dessus. `git status --porcelain` doit rendre le vide, et
   c'est un arrêt, pas un avertissement.

   Les deux `fatal: Failed to write item to store` de chaque push sont du bruit :
   c'est la ligne d'avancement des refs qui dit si l'envoi a abouti, jamais le
   code de sortie.

## La cadence

**La suite passe une fois par état de l'arbre.** Un arbre modifié depuis son
dernier vert se relance, même pour une virgule demandée en relecture : le vert
couvrait l'ancien état. Un arbre inchangé ne se relance pas. Après un échec, la
relance écrit dans des fichiers de sortie neufs.

**On n'attend pas la CI de GitHub avant de répondre.** Le push fait, on répond ;
le verdict des deux dépôts publics se lit au message suivant, et un rouge se
corrige tout de suite. Attendre chaque CI allongeait chaque réponse de
plusieurs minutes pour un verdict presque toujours vert.
