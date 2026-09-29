# Interface

Les règles de mise en page et de composant, apprises écran par écran.

## Interface

- Aucun tableau de plus de trois colonnes sous 768 px : liste cliquable
  (`ligneListe()`, `.liste-mobile`, `.large-seulement`). La règle vise les
  tableaux **qui portent une action** — un bouton hors cadre est inatteignable.
  Un tableau de lecture peut défiler dans un `.table-wrap`, à une condition :
  **la colonne du total reste épinglée** (`.sticky-fin`). Sans elle, six colonnes
  dans 311 px cachaient le seul chiffre que la carte raconte. La colonne des noms,
  elle, ne s'épingle pas sous 768 px : elle mangerait la moitié de l'écran.
- Un tableau hors conteneur défilant doit tenir dans sa carte. Voir
  `.table-serree`, dont la règle CSS doit rester **après**
  `.data-view > table` : même spécificité, c'est l'ordre qui tranche.
- Pas de grille de tuiles pour des chiffres qui ne composent rien. La liste à
  barres de l'accueil (`.card.repart`) dit mieux la même chose.
- **Dans une grille, un champ remplit sa cellule.** Les plafonds de `.field`
  (9 em pour un nombre, largeur naturelle pour un menu) ont leur raison hors
  grille, mais dans une rangée ils donnaient quatre largeurs sur une même fiche —
  117, 160, 299 et 364 px — et rien ne s'alignait. C'est la grille qui décide de
  la largeur, le champ l'occupe.
- **Deux boutons, ou un bouton et un menu de nature : ça se tranche par la
  symétrie.** « + Rentrée » et « + Dépense » sont deux sens opposés du même acte,
  connus au moment où l'on appuie : deux boutons, et pas de menu — le demander
  ensuite ferait répondre deux fois à la même question. « Vendre » et « Vente
  passée » ne sont pas symétriques : la seconde est la variante dégradée de la
  première, celle que l'application n'a pas pu calculer et qu'on ne fait que
  déclarer. Un seul bouton, donc, et le repli en dernier choix du menu qui demande
  **quoi** vendre : la nature se choisit dans le même contrôle que le sujet, et
  avant les montants — elle change ce que les chiffres veulent dire.
  Bénéfice de bord : plus de bouton désactivé. Sans ligne à vendre, la fenêtre
  s'ouvre sur le repli au lieu de refuser de s'ouvrir, et un `disabled` dont la
  raison vit dans une infobulle ne se lit pas au doigt.
- **Deux boutons du même geste passent à la ligne ensemble, et mesurent pareil.**
  `.paire-btn` en fait un seul élément de flex — donc un seul point de rupture —
  et une grille à colonnes `1fr` leur donne la largeur du libellé le plus long.
  « − Vendre » et « + Vente passée » finissaient à 77 et 120 px, l'une au-dessus
  de l'autre : deux commandes de la même paire lues comme deux commandes sans
  rapport. Toute paire de ce genre porte la classe, pas seulement la première.
- **Une rangée de boutons a la géométrie de sa voisine, et ça se mesure.** Deux
  rangées dans une même carte, l'une en `btn` justifiée à droite et l'autre en
  `btn sm` à gauche, se lisent comme un oubli. La hiérarchie se dit par le
  remplissage — plein, fantôme, rouge — jamais par la taille. Et « même
  géométrie » ne veut pas dire « même classe » : en flex, la longueur du libellé
  décide de la largeur, donc `Archiver` faisait 79 px quand « Clôturer et
  supprimer » en faisait 157, dans deux rangées qui se voulaient jumelles.
  `.fiche-actes` est une **grille** : deux colonnes de même fraction, partagées
  par les deux rangées, donnent quatre boutons de largeur et de hauteur
  identiques et un seul bord droit. La preuve est une mesure, pas une lecture du
  CSS.
- **Ce qui porte un filet garde sa largeur ; on plafonne les colonnes, pas la
  rangée.** `max-width` sur la rangée la réduit à la largeur de ses boutons, et le
  filet, qui est dessiné sur elle, cesse de traverser la carte : il flotte au-dessus
  des deux boutons comme un trait sans raison. La rangée garde donc toute la largeur
  du contenu de la carte, ses colonnes sont plafonnées (`14em`) et
  `justify-content: end` les pousse à droite. Un test mesure que la rangée fait la
  largeur du contenu de sa carte **et** que ses boutons restent à droite.
- **Une rangée de boutons vit dans une carte, jamais entre deux.** Une rangée
  posée hors des cartes flotte au milieu d'une page où tout est encadré : un filet
  dans le vide et des boutons sans cadre.
- **La validation ferme la carte des champs ; elle ne rejoint pas les autres
  actes.** Trois places essayées en un jour, et c'est la troisième qui tient. La
  rangée « Annuler / Enregistrer » appartient au formulaire qu'elle valide, donc au
  bas de la carte qui porte les champs — « Informations » sur la fiche d'un compte,
  « Notes » sur celle d'un établissement, qui n'a pas de carte « Actions ». Groupés
  dans une seule carte, les quatre boutons formaient un mur : quatre rectangles de
  même taille sous un titre unique, sans ordre de lecture, et deux natures d'acte
  que seul le remplissage distinguait. Ce que la géométrie a gagné, elle le garde :
  une carte de moins ne dispense pas deux rangées voisines de s'accorder, la classe
  est la même dans les deux cartes et `apres-champs` n'ajoute qu'un filet.
- **Ce qui valide vient avant ce qui détruit**, et c'est une règle de pouce : les
  cartes se suivent, et le doigt descendrait sur « Clôturer et supprimer » pour
  atteindre « Enregistrer ».
- **Sous 768 px, une rangée de boutons passe à une seule colonne.** À 375 px, deux
  colonnes laissent 152 px : « Clôturer et supprimer » s'y plie en deux lignes, sa
  rangée prend 17 px de plus que sa voisine, et les hauteurs ne s'accordent plus.
  Empilés, les boutons sont identiques et la cible est plus large sous le pouce.
- **Une rangée dans une carte ne pose aucun remplissage latéral** : la carte le
  donne déjà, et en poser un la décalerait de ses propres voisins.
- **Un menu déroulant a la largeur de ce qu'il montre, et jamais plus que sa
  carte.** Deux fautes opposées vivaient sur la page Préférences. « Français »
  s'affichait dans une boîte de 442 px, parce que la règle des grilles était
  écrite avec un combinateur descendant (`.grid .field`) : une cellule de grille
  est un **enfant** de la grille, jamais un descendant, et le sélecteur attrapait
  le moindre champ posé dans une carte posée dans une grille. À l'inverse
  « Oui, chercher les cours automatiquem » se coupait en plein mot, faute d'un
  plafond assez large. Le plafond est `min(28em, 100%)` : la seconde borne n'est
  pas décorative, un menu prend la largeur de sa plus longue option sans regarder
  où il est posé, et 28 em valent 364 px quand la carte n'en offre que 311 à
  375 px — il sortait de l'écran. `text-overflow: ellipsis` dit le reste.
- **Un en-tête de carte ne mélange pas un lien et des boutons.** Un renvoi vers un
  autre écran prend `btn sm ghost` comme ses voisins ; `.btn` retire le
  soulignement pour qu'un `<a>` puisse la porter.
- **Un bouton qui passe à la ligne reste à droite.** `justify-content:
  space-between` distribue ligne par ligne : seul sur la seconde, un bouton partait
  à gauche pendant que la carte voisine, dont le titre est plus court, gardait le
  sien à droite. `margin-left: auto` sur le dernier bouton d'un en-tête.
- **Une vue paramétrée ne se vérifie pas sur une instance.** La fiche d'un compte
  a été mesurée sur un compte de liquidités, qui ne rend ni carte de titres ni
  carte de placements : six types de compte sur douze portaient encore du français.
  Les balayer tous coûte trois lignes de plus.
- **Le contraste se calcule, il ne s'estime pas.** Personne ne voit la différence
  entre 4,3:1 et 4,6:1, et c'est pourtant la frontière de l'illisible. `--muted`
  portait le texte le plus petit de l'application — intitulés de colonnes à 11 px,
  bulles d'aide à 12, étiquettes de tuiles à 10,5 — à 3,61:1 sur une carte et 3,32
  sur `--surface-2`, dans les **deux** thèmes. Toute encre qui sert de texte franchit
  4,5:1 sur les trois fonds (`--surface-1`, `--surface-2`, `--page`), et un test le
  calcule pour les deux thèmes. Corollaire : une couleur d'aplat qui devient une
  couleur de texte change de seuil — l'orange `--serious` écrit les écarts au budget,
  il n'est pas qu'un remplissage. `--good-text` existe pour cette raison.
- **La cible du doigt est plus grande que le dessin.** Au téléphone, 44 px.
  Boutons, segments et puces y ont 36 px de dessin et 4 px de halo : deux voisins
  à 8 px, la mesure de la maison, se partagent l'écart sans se recouvrir. Les
  petites commandes isolées (icônes, liens de carte) débordent jusqu'à 44 dans les
  deux sens ; le « ? », qui vit dans des listes serrées, fait 44 de large et 25 de
  haut. Le halo est un `::after` transparent en `position: absolute`, calculé par
  `min(0px, calc(50% - 22px))` : il étend la zone sans rien déplacer ni rien
  peindre. Il se pose sur la boîte **intérieure**, bordure exclue, et c'est d'elle
  que partent ses décalages. Deux garde-fous : jamais de fond sur ce
  pseudo-élément, et **jamais d'empiétement sur le voisin**. Là où le voisin est
  plus près, le halo s'arrête au milieu de l'écart, et chaque point va à la
  commande la plus proche : la croix du rappel ne gagne pas de terrain sur « Plus
  tard ». Un `<select>` natif ne porte pas de halo fiable : sa boîte grandit pour
  de vrai. Minimum absolu, partout : 24 px. La preuve est une mesure
  (`elementFromPoint`, zones calculées), pas une lecture du CSS.
- **Tout ce qui se focalise porte l'anneau de l'application.** Vingt-cinq composants
  déclaraient leur `:focus-visible` en accent, et les deux plus courants s'en
  remettaient au navigateur : `.btn`, dont l'anneau système ne se voit presque pas
  sur un bouton plein clair, et `.aide`, qui posait `outline: none` en changeant la
  couleur d'un filet de 1 px sur une pastille de 15. Un `outline: none` sans
  remplacement visible n'est jamais un choix de style.
- **Le rouge est réservé à ce qui est faux.** Une saisie mensuelle en attente n'est
  pas une panne : la pastille de l'onglet Budget s'annonce en `--warning`, comme sa
  jumelle `.badge` de la barre latérale, qui l'était déjà — deux couleurs pour le
  même signal selon la taille de l'écran, personne ne pouvait le voir. Une alerte
  rouge qui revient tous les mois cesse d'être lue.
- **Un glyphe ne dit qu'une chose.** `↻` veut dire « actualiser » à quatre endroits
  (les cours, la synchronisation, le symbole depuis l'ISIN, l'état du chargement) :
  il ne peut pas annoncer aussi « effacer seize mois de relevés ». `+` reste au
  geste qui crée — et il est donc juste sur « + Sauvegarder maintenant », qui ajoute
  une sauvegarde à la liste.
- **Le thème se change en rechargeant.** Changer l'attribut `data-theme` repeint
  la barre latérale, les cartes, les textes et les graphiques — tout sauf le fond
  du corps, qui reste à la couleur de l'ancien thème jusqu'au rechargement suivant.
  Mesuré : `--page` lue sur le corps rend bien la nouvelle valeur, un élément créé
  à l'instant la rend aussi, et le corps reste peint à l'ancienne. On obtenait des
  cartes claires sur une page noire. `applyTheme(nom, true)` recharge, comme le
  sélecteur de langue depuis toujours ; le drapeau reste faux au démarrage, sinon
  la page se recharge en boucle.
- **Un chiffre garde sa base sur téléphone.** `font-size: 0` masquait « sur 7 mois
  clos, hors charges fixes » sous la tuile qui affiche 1 404 € : un dividende sans
  son diviseur n'est pas un chiffre plus court, c'est un chiffre faux. La base se
  serre (10,5 px), elle ne disparaît pas. Les deux raisons du masquage étaient
  tombées sans que personne le remarque — le texte ne se tronque plus, et
  `grid-auto-rows: 1fr` égalise déjà les hauteurs de tuiles.
- **Un pied de fenêtre tient sur une ligne à 375 px.** Ses boutons se partagent
  la largeur à parts égales : trois font 107 px chacun, et un libellé trop long
  s'y plie en trois lignes — la hauteur double et le bouton voisin paraît énorme.
  Un test refuse tout pied dont les libellés dépassent 36 caractères au total.
- **Une page s'ouvre sur son sujet, se lit, puis se corrige.** L'ordre des cartes
  ne se voit dans aucun calcul et aucun rendu ne le signale : un bloc déplacé se
  remet en place au prochain coup d'éditeur, sans que rien ne casse. Quatre suites
  le mesurent désormais, une par écran. Le principe, dans cet ordre : le grand
  chiffre ou le geste qu'on vient faire, les cartes qui font lire, **puis** l'outil
  de correction, **et la destruction en dernier**. Sur Dépenses, le tableau de
  correction de 880 px s'intercalait entre les cartes de lecture ; sur Performance,
  les deux cartes des ventes encadraient celle du portefeuille détenu — l'état vide
  de la seconde l'avouait, « le journal, plus haut, porte le bouton », et une carte
  qui donne l'itinéraire vers sa voisine est mal placée ; sur Données, « État »
  était coincé entre les sauvegardes et la remise à zéro.
  **Sur Positions, c'est une décision du détenteur** : le portefeuille ouvre la
  page, le jour tient dans sa carte en une section compacte, et les lignes de
  titres suivent aussitôt. Elle remplace la précédente, qui faisait ouvrir la
  page par une carte du jour à part. Une règle générale ne défait pas une
  décision prise ; on la lit avant de proposer.
- **Une page qui ne peut rien montrer dit ce qui la remplirait**, et ne montre
  rien d'autre. Allocation répartissait 0 € entre sept classes, Projection étalait
  des zéros sur cinquante ans : commenter chaque carte aurait remplacé six zéros
  par six phrases. `pageAvantDonnees()` et `invitePremierPas()` portent la forme,
  `PREMIERS_PAS` les textes. Corollaire : `mount()` de `charts.js` sort en silence
  quand son conteneur n'a pas été rendu, sinon masquer une carte lève une
  exception jusqu'à `render()`.
- **Une réserve se dit une fois, là où elle porte.** Trois lignes réservaient
  l'écart du jour sous la carte de la plus-value latente, qui ne dépend d'aucune
  date d'achat. Elle est dite dans l'aide de la colonne concernée, là où le
  chiffre se lit.
