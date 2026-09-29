# Travailler à deux agents

Détail de la règle 1 de l'index, `AGENTS.md`. Deux agents se partagent le
travail : celui qui code (Claude Code) et celui qui relit (Codex). Les deux
lisent le même arbre de travail.

**Le plan se discute à deux.** Pour tout changement qui n'est pas une retouche,
l'agent qui code écrit son plan et le soumet à l'agent qui relit, qui le
critique point par point au lieu d'en écrire un autre. L'agent qui code répond,
et ne commence qu'une fois le plan final validé des deux côtés : le plan retenu
est celui qui a résisté aux deux, pas les idées de l'un appliquées par l'autre.

**Rien ne se commite sans relecture.** Une fois les tests verts, l'arbre de
travail porte exactement ce qui sera commité (`git add -N` pour un fichier
nouveau, `git status` pour vérifier qu'il n'y a rien d'autre). L'agent qui relit
lance lui-même `git status` et `git diff HEAD` : on lui donne l'arbre, la
branche, les fichiers à laisser de côté, la demande d'origine, le plan validé,
ce qui a été vérifié et les points à examiner, **jamais le diff collé**. Un diff
collé repart à chacune de ses étapes, et il le relit de toute façon.

Il répond « validé », ou liste **toutes** ses objections en une seule passe,
numérotées, avec le fichier et la ligne. Des objections livrées une par une
coûtent chacune un correctif, une suite de tests et une reprise. Chaque
objection se corrige ou se discute, puis la relecture reprend : une ligne par
objection pour dire ce qui a changé, et il relance son `git diff`. Pas de
commit, donc pas de push, tant que la réponse n'est pas « validé ». Un correctif
de test après un rouge d'intégration continue y passe aussi.

**Une fonctionnalité, une session.** La session Codex s'ouvre au premier
échange, avec le brief complet ; son identifiant se lit dans l'événement JSON
`thread.started` (`codex exec --json`) et se garde hors du dépôt. La critique,
le plan final et la relecture reprennent la même session
(`codex exec resume <id>`), en n'envoyant que le nouveau, et en rappelant à
chaque reprise l'arbre et la branche examinés. Le port de la démo vers le dépôt
privé reste la même fonctionnalité : on nomme l'arbre, et Codex fait son diff.
Chaque appel, ouverture comme reprise, passe `-c sandbox_mode="read-only"` : le
réglage par défaut de ce poste autorise l'écriture.
