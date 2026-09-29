# Données saisies

Où une valeur s'écrit, ce qui la confirme, et comment deux faits se relient plutôt que de se saisir deux fois.

## Où l'on écrit, et ce qui le confirme

Deux régimes, et le choix n'est pas décoratif.

- **Dans une page, on écrit à la frappe.** Rien ne se perd en changeant d'écran,
  et c'est ce qui compte le plus. Un bouton « Enregistrer » sur une page serait
  pire : on corrige un montant en haut, on descend, on quitte, tout est perdu.
  Ce qui manquait n'était pas la validation mais la **confirmation** — le seul
  témoin était « Sauvegardé ✓ », 10,5 px au bas de la barre latérale, donc dans
  le tiroir fermé sur téléphone. Le champ qu'on vient de remplir porte donc un
  liseré vert huit dixièmes de seconde, `marquerEcrit()`, là où l'œil se trouve.
- **Dans une fenêtre, on diffère.** `data-differe` sur le corps, les deux
  écouteurs de champs le respectent, `appliquerDiffere()` applique tout au clic
  sur « Enregistrer ». C'est justifié là parce qu'on peut fermer sans valider :
  fermer avec des champs sales le dit et propose de garder. Le bouton « aller
  ailleurs » disparaît alors — deux boutons pleins côte à côte, l'un qui
  enregistre et l'autre qui s'en va, se disputent le même geste.
- **« Enregistrer » suit une règle, par famille.** Inventaire du 9 août 2026 :
  une fenêtre de **saisie en série** (fiche de ligne, dépenses du mois, relevé
  mensuel, aperçus modifiables) porte « Enregistrer », qui écrit **et reste**,
  plus « Fermer », qui demande s'il reste du non-enregistré. Une fenêtre
  d'**acte** (créer, vendre, archiver) porte le **nom de l'acte**, qui ferme.
  Le relevé mensuel a été le transfuge — douze champs comme sa jumelle des
  dépenses, mais qui fermait en enregistrant et jetait sans question. Un test
  garde la paire relOk / relFermer.
- La détection se fait **sur le balisage** (`[data-path]` présents), pas sur la
  description du panneau : un aperçu pose ses champs par `champs`, par
  `lignes[].champ` ou dans son propre `html`, et c'est ce troisième cas qui
  portait les liquidités.

- **Le cloud reçoit tout de suite, sauf pendant une frappe.** `Store.save()`
  pousse immédiatement ; `Store.save({ differe: true })` regroupe, et un seul
  appelant le demande — l'écouteur `input`, où cinq caractères valent cinq
  écritures sur une clé qui n'en accepte qu'une par seconde. C'était l'inverse :
  un clic sur « Enregistrer » attendait comme une frappe, et c'est dans cette
  attente que l'écran se verrouillait.
- **Le point d'entrée qui tourne est `_worker.js`, pas `functions/`.** Chez
  Cloudflare Pages, un `_worker.js` à la racine prend toute la main et le dossier
  `functions/` n'est **jamais chargé**. Les cinq fichiers de `functions/api/` sont
  des copies mortes de `handleState()`, `handleQuotes()` et compagnie — le dépôt
  public les a supprimés le 9 août pour cette raison. Corriger le mauvais fichier
  donne un commit qui prétend réparer, un déploiement sans effet et des tests au
  vert : c'est arrivé au correctif de synchro ci-dessous, et seul le merge vers la
  démo l'a fait voir. Un contrôle exige maintenant que les deux copies disent la
  même chose tant que la morte existe.
- **On n'écrase que la version qu'on a lue.** Le garde-fou du serveur comparait
  deux horodatages : il refusait une écriture dont le `savedAt` était plus ancien
  que celui en ligne. Ça ne peut pas tenir, et la preuve est arrivée par les
  sauvegardes du détenteur — **six « avant adoption de la version en ligne » dans
  une seule journée**, et des montants saisis qui disparaissaient. Le mécanisme :
  un onglet resté ouvert garde en mémoire l'état d'il y a six heures, le
  rafraîchissement des cours y appelle `Store.save()` toutes les cinq minutes, et
  `Store.save()` estampille `savedAt = maintenant`. Contenu périmé, estampille
  fraîche — donc plus récente que celle du téléphone qui vient de saisir. Le
  serveur acceptait, puis le téléphone adoptait en se croyant en retard.
  **Un horodatage récent ne dit rien de l'âge du contenu.** L'écrivain déclare
  donc la version qu'il a lue (`?base=…`, le repère `synced-at`), et le serveur
  n'accepte que si c'est encore celle en place — un `If-Match`. Trois corollaires :
  le contrôle vit **côté serveur**, parce que le `sendBeacon` de la fermeture ne
  peut rien vérifier avant de partir ; adopter une version en ligne doit la
  **noter comme lue**, sinon l'enregistrement suivant se fait refuser sans raison ;
  et un refus se dit **là où l'on se trouve** (toast, et famille `synchro` de la
  cloche), pas sur la seule page Données, où personne ne va après avoir saisi un
  montant.
  Ce qui reste sans garantie, et qu'il faut dire : il n'y a toujours pas de fusion.
  Deux appareils modifiés chacun de leur côté demandent un arbitrage — mais
  l'arbitrage est désormais **posé**, au lieu que le plus rapide gagne en silence.
  Trois autres pièces, chacune fermant un trou : le flush écoute
  `visibilitychange` vers `hidden` en plus de `pagehide` — sur téléphone la page
  est gelée, pas déchargée, et un onglet gelé n'exécute aucun minuteur ; un seul
  envoi est en vol à la fois, sinon deux `PUT` concurrents laissent le plus lent
  écrire en dernier ; un échec est réessayé une fois, puis sur l'événement
  `online`. Ce qui reste sans garantie, et qu'il faut dire : deux appareils
  modifiés hors ligne demandent un arbitrage, il n'y a pas de fusion.

## Relier deux faits plutôt que les saisir deux fois

Le motif le plus utile de cette base de code, appliqué quatre fois : une charge
fixe rembourse un crédit (`creditId`), une charge et un loyer se rattachent à un
bien (`bienId`).

- **Un seul porteur du montant**, et le lien décide lequel. La charge détient la
  mensualité, le crédit la lit : le budget ne change pas d'un octet, et la
  fenêtre du crédit n'offre plus le champ. L'offrir ferait deux surfaces
  d'édition, et celle-ci serait la perdante puisque la projection lit la charge.
- **Le sens du lien se choisit et s'explique.** Une charge peut exister sans
  crédit, un crédit sans charge (on ne rembourse pas une marge de courtier par
  mensualités), mais une mensualité ne peut pas exister sans sortir du budget :
  la charge est donc la source.
- **Garder l'unicité là où elle compte.** Deux charges sur un même crédit
  doubleraient la mensualité lue et la première trouvée gagnerait :
  `creditsRattachables()` écarte les crédits déjà pris. Deux charges sur un même
  bien sont normales — une taxe foncière et une copropriété — donc pas de garde.
