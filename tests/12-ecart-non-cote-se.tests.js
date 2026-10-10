partieDeTests('tests/12-ecart-non-cote-se.tests.js');
/* ------------------------------------------------------------------
   L ecart du non cote se dit, sans se meler aux cours
   ------------------------------------------------------------------ */
suite('L’écart du non coté se dit, sans se mêler aux cours', () => {

  test('la page Performance ignorait le non coté, et le calcul existe enfin', () => {
    /* `latentPnl()` ne lit que `positions` : le non cote, l'immobilier et les
       biens n'apparaissaient dans aucun ecart, alors qu'un prix de revient y est
       saisi et qu'ils portent souvent la moitie d'un patrimoine. */
    Fixture.poser();
    const cote = latentPnl();
    const nc = latentNonCote();
    vrai(cote.count > 0 && nc.lignes.length > 0, 'le fixture porte les deux natures');
    /* Aucune ligne de marche dans le non cote, et reciproquement : la frontiere
       se lit sur `marche`, pas sur une liste de classes — un ETF immobilier est
       cote. */
    vrai(nc.lignes.every(l => l.classe !== 'actions'),
      'les titres cotés restent chez eux');
    pres(nc.value, nc.lignes.reduce((s, l) => s + l.value, 0), 'le total est la somme des parts');
    pres(nc.invested, nc.lignes.reduce((s, l) => s + l.invested, 0), 'et l’investi aussi');
    pres(nc.pnl, nc.value - nc.invested, 'l’écart est la différence des deux');
  });

  test('une ligne sans prix de revient n’entre pas dans l’écart', () => {
    /* Sans prix paye, il n'y a pas d'ecart a dire : compter la valeur seule
       gonflerait la plus-value de tout ce qu'on n'a pas su renseigner. */
    Fixture.poser(s => {
      s.comptes.find(c => c.id === 'c_pe').lignes.push(
        { id: 'l_x', classe: 'nonCote', libelle: 'Sans prix', valeur: 5000, prixDeRevient: 0 });
    });
    const nc = latentNonCote();
    vrai(!nc.lignes.some(l => l.nom === 'Sans prix'), 'elle reste dehors');
    vrai(nc.invested > 0 && nc.pct !== null, 'et le pourcentage garde une base positive');
  });

  test('un pourcentage sans base positive n’existe pas', () => {
    Fixture.poser(s => {
      for (const c of s.comptes) for (const l of (c.lignes || [])) l.prixDeRevient = 0;
    });
    eq(latentNonCote().pct, null, 'plutôt qu’une division par zéro déguisée');
    pres(latentNonCote().invested, 0, 'aucune base');
  });

  test('l’âge de la valeur fait partie du chiffre', () => {
    /* Une plus-value declaree il y a trois ans ne vaut pas celle d'hier, et c'est
       la seule difference qu'une valeur declaree puisse honnetement montrer. Le
       seuil est celui de la cloche : un an. */
    Fixture.poser(s => {
      const l = s.comptes.find(c => c.id === 'c_pe').lignes[0];
      l.estimeLe = '2020-01-01';
    });
    const vieille = latentNonCote().lignes.find(l => l.nom === 'Startups');
    vrai(vieille && vieille.vieille, 'une estimation de 2020 est à revoir');
    eq(latentNonCote().aRevoir >= 1, true, 'et le compte le dit');
    /* Jamais estimee compte aussi : l'absence de date n'est pas une date recente. */
    Fixture.poser(s => { delete s.comptes.find(c => c.id === 'c_pe').lignes[0].estimeLe; });
    vrai(latentNonCote().lignes.find(l => l.nom === 'Startups').vieille,
      'sans date, la valeur est à revoir : l’absence n’est pas une fraîcheur');
  });

  test('rien de tout cela n’entre dans la page des marchés', () => {
    /* Marchés › Performance ne suit que ce dont le cours arrive tout seul, son
       ecran vide le dit : y ramener le non cote le remettrait d'ou l'application
       a mis du temps a le sortir. Et aucun total ne mele les deux natures. */
    const src = lireSource('assets/app.js');
    /* La regle a survecu a la page qui la portait : Performance a ete retiree, et
       c'est Positions qui est maintenant la page des marches. Le controle suit le
       sujet plutot que le nom — y ramener le non cote le remettrait d'ou
       l'application a mis du temps a le sortir. */
    const marches = src.slice(src.indexOf('function viewPositions('),
                              src.indexOf('function mountPositions('));
    vrai(marches.length > 1000, 'la page des marchés doit se relire depuis sa source');
    vrai(!/latentNonCote/.test(marches),
      'la page des marchés ne parle pas du non coté');
    /* Il se lit dans son propre apercu, celui qui s'ouvre depuis l'accueil. */
    const pe = src.slice(src.indexOf('  pe: () => {'), src.indexOf('  investi: () =>'));
    vrai(/latentNonCote\(\)/.test(pe), 'l’aperçu du non coté porte l’écart');
    vrai(/valeurs que tu déclares, pas des cours/.test(pe),
      'et il nomme la nature du chiffre avant de le donner');
    vrai(/\$\{fmtEUR0\(invested\)\} \$\{trad\('investis'\)\}/.test(pe),
      'la note du total dit sa base : le montant investi');
  });
});

/* ------------------------------------------------------------------
   Le versement mensuel dit ou il va
   ------------------------------------------------------------------ */
suite('Le versement mensuel dit où il va', () => {

  /* Il partait toujours dans le marche, capitalise a son taux, et rien a l'ecran
     ne le disait : « on ne voit pas tout de suite que c'est la dessus ».
     L'hypothese est juste pour le cas courant — on investit son epargne — mais
     fausse pour qui epargne sans investir. */

  const projeter = (vers, ans = 10) => {
    Fixture.poser(s => {
      s.meta.projMonthly = 300;
      s.meta.projRate = 8;
      s.meta.projRateAutres = 0;
      s.meta.projVersementVers = vers;
    });
    return capitalisation({ years: ans });
  };

  test('le marché reste le défaut, et rien ne change pour les états existants', () => {
    Fixture.poser(s => { delete s.meta.projVersementVers; });
    eq(projectionSettings().versementVers, 'marche',
      'un état sans ce réglage se comporte comme avant');
    /* Une valeur inconnue retombe sur le marche plutot que de vider la poche. */
    Fixture.poser(s => { s.meta.projVersementVers = 'nimporte'; });
    const c = capitalisation({ years: 5 });
    vrai(c.points[5].gains > 0, 'une destination inconnue ne gèle pas la projection');
  });

  test('un versement sur les liquidités ne produit aucun gain', () => {
    /* Les liquidites sont portees a plat : 300 EUR par mois pendant dix ans font
       36 000 EUR, pas un centime de plus. C'est exactement ce qu'un livret non
       declare remunere fait, et c'est le seul chiffre honnete pour qui epargne
       sans investir. */
    const liq = projeter('liquidites');
    const dernier = liq.points[10];
    const verses = 300 * 12 * 10;
    /* Le gain vient alors du seul capital de depart, jamais des versements. */
    const marche = projeter('marche').points[10];
    vrai(dernier.gains < marche.gains,
      'le même versement rapporte moins sur un livret que sur le marché');
    pres(dernier.contributed - liq.points[0].contributed, verses,
      'les versements comptent pour ce qu’ils sont : de l’argent mis, pas gagné');
  });

  test('le total égale toujours ce qui est mis plus les gains', () => {
    /* La regle qui gouverne toute l'application, et le point que ce changement
       pouvait casser : les gains se calculaient par `capital - verse`, ce qui
       supposait que le versement va au marche. Sur un livret, le gain du marche
       devenait negatif et celui des liquidites comptait les versements. */
    for (const vers of ['marche', 'nonCote', 'liquidites']) {
      const c = projeter(vers);
      for (const p of c.points) {
        pres(p.total, p.contributed + p.gains,
          `${vers} : total = mis + gains, année ${p.year}`);
      }
      /* Et aucun gain negatif ne doit apparaitre par construction. Le point de
         depart est ecarte : il ne porte que le total et les versements acquis,
         pas le detail par poche, qui n'aurait aucun sens a l'annee zero. */
      const annees = c.points.filter(p => p.gainsMarche !== undefined);
      vrai(annees.length > 0, 'des années projetées existent');
      vrai(annees.every(p => p.gainsMarche >= -0.005),
        `${vers} : le gain du marché ne devient jamais négatif`);
      vrai(annees.every(p => p.gainsLiquidites >= -0.005),
        `${vers} : celui des liquidités non plus`);
    }
  });

  test('les autres actifs suivent leur propre taux, pas celui du marché', () => {
    Fixture.poser(s => {
      s.meta.projMonthly = 300;
      s.meta.projRate = 8;
      s.meta.projRateAutres = 3;
      s.meta.projVersementVers = 'autres';
    });
    const c = capitalisation({ years: 10 });
    const d = c.points[10];
    vrai(d.gainsAutres > 0, 'à 3 % les autres actifs produisent quelque chose');
    /* Et moins qu'a 8 % : le taux applique est bien le sien. */
    Fixture.poser(s => {
      s.meta.projMonthly = 300; s.meta.projRate = 8;
      s.meta.projRateAutres = 3; s.meta.projVersementVers = 'marche';
    });
    /* Le meme versement au marche a 8 % rapporte davantage : la poche recoit
       bien son taux et non celui d'a cote. */
    const auMarche = capitalisation({ years: 10 }).points[10];
    vrai(auMarche.gains > d.gains, 'le même versement à 8 % rapporte davantage');
  });

  test('l’écran le dit sans qu’on déplie, et le réglage existe', () => {
    const src = lireSource('assets/app.js');
    vrai(/champText\('Affectation des versements', 'meta\.projVersementVers', VERSEMENT_VERS/.test(src),
      'le champ existe, avec la table pour seule source de ses options');
    /* Le resume replie ne porte plus la destination ni les taux : il porte le
       versement, le nom du scenario et l'inflation. Quatre pourcentages a lire
       pour savoir ou l'on en est, c'etait trois de trop. */
    vrai(/trad\('scénario'\)\} \$\{trad\(nomScenario\(s\.scenario\)\)/.test(src),
      'le résumé replié nomme le scénario');
    vrai(!/marché'\)\} \$\{fmtPct\(s\.rate/.test(src),
      'et n’énumère plus les taux');
    /* Le marche d'abord, et par defaut : c'est la destination de l'epargne
       longue, celle qui vaut pour presque tout le monde. */
    eq(VERSEMENT_VERS[0][0], 'marche', 'les actifs de marché en tête : c’est le défaut');
    Fixture.poser(s => { delete s.meta.projVersementVers; });
    eq(projectionSettings().versementVers, 'marche',
      'un état neuf verse sur les actifs de marché');
    /* Chaque poche du moteur doit pouvoir recevoir le versement, sinon une
       allocation cible qui la nomme enverrait son argent ailleurs. */
    const offertes = VERSEMENT_VERS.map(([c]) => c);
    for (const poche of ['marche', 'autres', 'garanti', 'liquidites']) {
      vrai(offertes.includes(poche), `« ${poche} » doit être offert comme destination`);
    }
    /* Et rien de plus : une destination qui ne correspond a aucune poche
       enverrait le versement dans le vide — `repartitionVersement` retombe alors
       sur le marche, et le choix affiche ne serait pas celui qui s'applique. */
    eq(offertes.length, 4, 'quatre destinations, une par poche du moteur');
  });
});

/* ------------------------------------------------------------------
   Une modification ne se perd pas quand l ecran se verrouille
   ------------------------------------------------------------------ */
suite('Une modification ne se perd pas quand l’écran se verrouille', () => {

  /* Une saisie se sauvegarde sur le cloud meme quand l'ecran se verrouille
     juste apres : sans cela, on retrouverait une version anterieure en
     rouvrant, puisque l'envoi differe s'armerait, l'ecran se verrouillerait
     avant, et rien ne partirait.

     Un onglet gele n'execute aucun minuteur. Le seul moment ou du code tourne
     encore est le passage en arriere-plan, et sur telephone il ne se signale pas
     par `pagehide` -- la page n'est pas dechargee, elle est mise de cote puis
     restauree -- mais par `visibilitychange` vers `hidden`. */

  test('le passage en arrière-plan écrit ce qui reste en attente', () => {
    const src = lireSource('assets/app.js');
    vrai(/document\.addEventListener\('visibilitychange', \(\) => \{\s*if \(document\.hidden\) CloudSync\.flushOnUnload\(\);/.test(src),
      'sans cet écouteur, verrouiller l’écran perd la dernière saisie');
    /* `pagehide` reste : sur ordinateur une page peut disparaitre sans jamais
       devenir cachee. */
    vrai(/addEventListener\('pagehide', \(\) => CloudSync\.flushOnUnload\(\)\)/.test(src),
      'et la fermeture d’onglet reste couverte');
  });

  test('le délai d’envoi laisse une fenêtre courte', () => {
    /* Huit secondes regroupaient bien les modifications, et ouvraient une
       fenetre de huit secondes ou tout se perdait. Le regroupement tient encore
       a 2,5 s : une saisie au clavier ne produit qu'un envoi. */
    const cs = lireSource('assets/cloudsync.js');
    const m = cs.match(/const WRITE_DELAY = (\d+);/);
    vrai(m, 'le délai doit être trouvable');
    vrai(+m[1] <= 3000, `délai de ${m[1]} ms : trop long pour un geste sur téléphone`);
    vrai(+m[1] >= 1000, `délai de ${m[1]} ms : chaque frappe partirait séparément`);
  });

  test('le flush ne réenvoie pas deux fois le même état', () => {
    /* L'ecran se cache, puis la page se decharge : deux appels a la suite. Le
       corps confie au beacon est retenu, donc le second ne fait rien, et le
       minuteur est annule. Le comportement se joue dans la suite 39 ; ce
       controle garde la forme. */
    const cs = lireSource('assets/cloudsync.js');
    /* La tranche s'arrete a la fermeture de la fonction, pas apres un
       nombre de caracteres : une ligne ajoutee dans le corps poussait le
       repere hors d'une fenetre de 700, et le controle tombait sur un code
       juste. Un test ne doit dependre ni d'un commentaire ni d'une longueur. */
    const debut = cs.indexOf('function flushOnUnload');
    const fn = cs.slice(debut, cs.indexOf('\n  }\n', debut));
    vrai(/if \(payload === lastPayload\) return;/.test(fn),
      'un état déjà envoyé ne repart pas');
    vrai(/if \(beacons\.some\(b => b\.payload === payload\)\) return;/.test(fn),
      'un corps déjà confié au beacon ne repart pas');
    vrai(!/lastPayload = payload;/.test(fn),
      'et rien n’est marqué envoyé sans réponse du serveur');
    vrai(/clearTimeout\(timer\)/.test(fn),
      'le minuteur armé est annulé : une page restaurée ne repousse rien');
  });

  test('un geste explicite part tout de suite, seule la frappe se regroupe', () => {
    /* Chaque `save()` armait le minuteur : le clic sur « Enregistrer » — le geste
       par lequel on dit « c'est bon » — attendait donc comme une frappe au
       clavier, et c'est pendant cette attente que l'ecran se verrouillait.
       Le defaut est desormais l'envoi immediat ; le regroupement se demande. */
    const st = lireSource('assets/store.js');
    vrai(/if \(opts\.differe\) CloudSync\.schedulePush\(\); else CloudSync\.push\(\);/.test(st),
      'save() pousse tout de suite, sauf demande contraire');
    vrai(/save\(opts = \{\}\) \{/.test(st), 'et la demande passe par un argument');
    const src = lireSource('assets/app.js');
    /* Un seul appelant demande le regroupement : l'ecouteur de frappe. */
    const differes = src.match(/Store\.save\(\{ differe: true \}\)/g) || [];
    eq(differes.length, 1,
      'seule la saisie caractère par caractère se regroupe, et une seule fois');
    /* `change` clot une saisie : il ne se regroupe pas. */
    const surChange = src.slice(src.indexOf("document.addEventListener('change'"),
                                src.indexOf("document.addEventListener('change'") + 500);
    vrai(/Store\.save\(\);/.test(surChange) && !/differe: true/.test(surChange),
      'un champ quitté ou une liste choisie partent tout de suite');
  });

  test('deux envois ne se croisent pas', () => {
    /* Avec un envoi par geste, deux clics rapproches lançaient deux PUT
       concurrents : le plus lent arrivait en dernier, donc un etat plus ancien
       ecrit par-dessus le plus recent. */
    const cs = lireSource('assets/cloudsync.js');
    vrai(/if \(enVol\) \{ aRejouer = true; return enVol; \}/.test(cs),
      'un envoi déjà parti n’est pas doublé');
    vrai(/if \(aRejouer\) \{ aRejouer = false; push\(opts\); \}/.test(cs),
      'et ce qui est arrivé pendant le vol repart ensuite');
    /* `push()` relit l'etat a chaque tour, donc le dernier gagne toujours. */
    vrai(/async function pushMaintenant\(\{ force = false \} = \{\}\) \{\s*if \(!available\)/.test(cs),
      'l’envoi relit Store.state à chaque tour');
  });

  test('une réserve se dit une fois, là où elle porte', () => {
    /* Trois lignes de prose reservaient l'ecart du jour sous la carte de la
       plus-value latente, qui ne depend d'aucune date d'achat. La colonne « Var. »
       porte la meme reserve dans son aide, a l'endroit ou le chiffre se lit. */
    const src = lireSource('assets/app.js');
    vrai(!/lignes n’ont pas de date d’achat/.test(src),
      'la mention a quitté la carte de la plus-value latente');
    /* L'intitule « Var. » n'a plus d'aide : la reserve se dit la ou elle joue,
       sous le total du jour et sous le nom de la ligne achetee aujourd'hui. */
    vrai(/trad\('ou depuis ton achat du jour'\)/.test(src),
      'la réserve reste dite sous le total du jour');
    vrai(/trad\('acheté aujourd’hui'\)/.test(src),
      'et sous le nom de la ligne concernée');
  });
});

/* ------------------------------------------------------------------
   Un seul signe moins dans toute l application
   ------------------------------------------------------------------ */
suite('Un seul signe moins', () => {

  test('les formateurs rendent le signe moins, jamais le trait d’union', () => {
    /* `Intl` rend « -13 500,00 € » avec un trait d'union ASCII, alors que
       l'application ecrit ses negatifs a la main avec U+2212 : le meme ecran
       portait les deux, le grand chiffre en tete et les dettes en dessous. */
    Fixture.poser();
    for (const [nom, txt] of [['fmtEUR', fmtEUR(-13500)], ['fmtEUR0', fmtEUR0(-13500)],
                              ['fmtPct', fmtPct(-4.2)], ['fmtNombre', fmtNombre(-7)],
                              ['fmtCur', fmtCur(-99, 'USD')]]) {
      vrai(!txt.includes('-'), `${nom} rend un trait d’union : « ${txt} »`);
      vrai(txt.includes('−'), `${nom} doit porter le signe moins : « ${txt} »`);
    }
    /* Les positifs ne gagnent pas de signe au passage. */
    vrai(!/[-−]/.test(fmtEUR(13500)), 'et un montant positif reste sans signe');
  });

  test('le signe des formateurs est celui que les écrans écrivent à la main', () => {
    const src = lireSource('assets/app.js');
    /* Les dettes et les deltas s'ecrivent « −${fmtEUR(...)} » : le meme
       caractere, sinon la coherence ne tient qu'a la chance. */
    vrai(/−\$\{fmtEUR/.test(src), 'les écrans écrivent bien U+2212 devant leurs montants');
    eq(fmtSigned(-100).charCodeAt(0), 8722, 'et fmtSigned aussi');
  });
});

/* ------------------------------------------------------------------
   Un montant n a qu un porteur, et l ecran ne propose que celui-la
   ------------------------------------------------------------------ */
suite('Un montant n’a qu’un porteur', () => {

  test('la fiche du bien n’offre plus un second champ de mensualité', () => {
    /* Quand une charge fixe rembourse le credit, c'est elle qui detient la
       mensualite et `mensualiteCredit()` la lit chez elle : ecrire dans le champ
       de la fiche n'avait aucun effet, sans que rien ne le dise. La regle
       existait deja pour la fenetre du credit. */
    const src = lireSource('assets/app.js');
    /* Les champs du credit ont leur propre carte, une par pret. */
    const bloc = src.slice(src.indexOf('function carteCredit'),
                           src.indexOf('function espaceBien'));
    vrai(bloc.length > 500, 'la carte du crédit doit être trouvable');
    const i = bloc.indexOf('dettes.${i}.mensualite');
    vrai(i > 0, 'le champ existe encore, pour le crédit qui porte lui-même sa mensualité');
    vrai(/\$\{chargeDuCredit\(d\.id\) \?/.test(bloc.slice(Math.max(0, i - 900), i)),
      'mais il est derrière la question : une charge rembourse-t-elle ce crédit ?');
    vrai(/par mois, depuis la charge/.test(bloc),
      'et l’écran dit alors où le montant se règle, au lieu de se taire');
  });

  test('la date de solde se lit au même endroit sur les deux écrans', () => {
    /* `fin` etait calcule dans creditsEnCours() sans que personne ne le lise :
       du code mort d'un cote, et la carte des credits muette de l'autre. */
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes[0].taux = 3;
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = 600;
    });
    const ligne = creditsEnCours().lignes.find(x => x.id === 'd_pret');
    const src = lireSource('assets/app.js');
    vrai(/c\.fin \? `\$\{trad\('soldé'\)\} \$\{fmtMoisAn\(c\.fin\.finLe\)\}`/.test(src),
      'la carte des crédits affiche la fin, sans la recalculer de son côté');
    eq(ligne.fin.finLe, finCredit(ETABS().find(e => e.id === 'e_bien').dettes[0]).finLe,
      'et c’est la même date que la fiche du bien');
  });

  test('les postes d’un bien se proposent, et suivent son usage', () => {
    /* La taxe fonciere ouvre la liste : elle est due par tout proprietaire, et
       c'est la periode du premier poste que la fenetre prend par defaut. */
    Fixture.poser();
    const c = compteById('c_immo');
    const noms = chargesProposees(c).map(([l]) => l);
    eq(noms[0], 'Taxe foncière', 'le poste que tout propriétaire paie vient en premier');
    eq(chargesProposees(c)[0][1], 'an', 'et elle se facture à l’année');
    vrai(noms.includes('Provision pour travaux'),
      'la dépense que tout le monde oublie est proposée, c’est elle qui décide du vrai rendement');
    /* L'assurance ne porte pas le meme nom selon qu'on habite ou qu'on loue. */
    Fixture.poser(s => { s.comptes.find(x => x.id === 'c_immo').lignes[0].usage = 'locative'; });
    const loue = chargesProposees(compteById('c_immo')).map(([l]) => l);
    vrai(loue.includes('Assurance propriétaire non occupant'),
      'un logement loué porte une assurance de propriétaire non occupant');
    vrai(!loue.includes('Assurance habitation'), 'et pas celle de qui l’habite');
    Fixture.poser(s => { s.comptes.find(x => x.id === 'c_immo').lignes[0].usage = 'principale'; });
    const habite = chargesProposees(compteById('c_immo')).map(([l]) => l);
    vrai(habite.includes('Assurance habitation') && !habite.includes('Assurance propriétaire non occupant'),
      'et l’inverse pour qui l’habite');
    /* Les postes communs restent en tete dans les deux cas : ils ne se recopient
       pas d'une branche a l'autre. */
    eq(habite.slice(0, 3).join('|'), loue.slice(0, 3).join('|'),
      'ce qui vaut pour tous est écrit une fois');
  });

  test('l’infobulle du bouton se dérive de cette table', () => {
    /* Elle listait les postes a la main : ajouter un poste demandait de penser a
       deux endroits, et celui qu'on oubliait disait le contraire de l'autre. */
    const src = lireSource('assets/app.js');
    vrai(/title="\$\{esc\(chargesProposees\(c\)\.map\(\(\[l\]\) => trad\(l\)\)\.join\(', '\)\)\}"/.test(src),
      'un poste ajouté à la table apparaît dans l’infobulle sans qu’on y pense');
    vrai(!/Taxe foncière, copropriété, assurance PNO/.test(src),
      'et la liste écrite à la main a disparu');
  });

  test('un poste déjà nommé sur un bien se propose sur le suivant', () => {
    Fixture.poser(s => {
      s.budget.fixedCharges.push({ label: 'Ravalement 2027', amount: 300, period: 'an',
                                   shares: {}, bienId: 'c_immo' });
      /* Une charge sans bien n'a rien a faire dans cette liste : un abonnement
         telephonique n'est pas un poste de logement. */
      s.budget.fixedCharges.push({ label: 'Téléphone', amount: 30, period: 'mois', shares: {} });
    });
    const connus = valeursConnues('posteBien');
    vrai(connus.includes('Ravalement 2027'), 'ce qui a été tapé sur un bien revient');
    vrai(!connus.includes('Téléphone'), 'ce qui n’est pas rattaché à un bien reste dehors');
  });

  test('chaque ligne du mois porte sa source, et rien ne s’affiche sans porte', () => {
    /* Un montant qui s'affiche sans porte pour le corriger oblige a chercher sa
       source ailleurs, et rien a l'ecran ne dit ou : le loyer vit dans les
       revenus, la taxe fonciere dans les charges fixes, la mensualite chez le
       preteur. Le rang dans le budget voyage avec le montant. */
    Fixture.poser(s => {
      s.budget.income.push({ label: 'Loyer studio', amount: 7200, period: 'an', bienId: 'c_immo' });
      s.budget.fixedCharges.push({ label: 'Taxe foncière', amount: 1200, period: 'an',
                                   shares: {}, bienId: 'c_immo' });
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = 400;
    });
    const cf = cashFlowBien(compteById('c_immo'));
    eq(cf.sourcesLoyer.length, 1, 'la source de loyer est listée, pas seulement sommée');
    eq(cf.sourcesLoyer[0].i, Store.state.budget.income.length - 1,
      'et elle porte son rang dans le budget : c’est lui qui ouvre la bonne fenêtre');
    pres(cf.sourcesLoyer[0].mensuel, 600, 'au mois, comme partout ailleurs');
    pres(cf.sourcesLoyer[0].montant, 7200, 'et le montant tel qu’il est saisi, pour le rappeler');
    eq(cf.postesCharge.length, 1, 'la charge aussi');
    eq(cf.postesCharge[0].i, Store.state.budget.fixedCharges.length - 1, 'avec son rang');
    eq(cf.creditsListe.length, 1, 'et le crédit');
    eq(cf.creditsListe[0].index, 0, 'avec son rang chez son établissement');
    eq(cf.creditsListe[0].chargeIndex, null,
      'sa mensualité se règle chez lui : aucune charge ne le rembourse');
  });

  test('la somme des lignes affichées fait le solde, vacance comprise', () => {
    /* La regle du projet, appliquee a cette carte : un total egale la somme de
       ses parts. La vacance etait la seule part a agir sans se montrer. */
    Fixture.poser(s => {
      s.budget.income.push({ label: 'Loyer', amount: 600, period: 'mois', bienId: 'c_immo' });
      s.budget.fixedCharges.push({ label: 'Copropriété', amount: 100, period: 'mois',
                                   shares: {}, bienId: 'c_immo' });
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = 400;
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.moisLoues = 11;
      c.tauxImpot = 30;
    });
    const cf = cashFlowBien(compteById('c_immo'));
    const lignes = cf.sourcesLoyer.reduce((s, x) => s + x.mensuel, 0)
      - cf.vacanceEuros
      - cf.postesCharge.reduce((s, x) => s + x.mensuel, 0)
      - cf.impot
      - cf.creditsListe.reduce((s, x) => s + x.mensualite, 0);
    pres(lignes, cf.cashFlow, 'à l’euro : rien ne se retire en coulisse');
    pres(cf.vacanceEuros, 600 / 12, 'un mois de vacance sur douze');
  });

  test('la mensualité s’ouvre là où son montant se règle', () => {
    /* Quand une charge fixe rembourse le credit, c'est elle qui detient le
       montant : cliquer la ligne doit mener a la charge, pas au credit, sinon on
       atterrit sur une fenetre qui n'offre plus ce champ. */
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_bien').dettes[0].mensualite = null;
      s.budget.fixedCharges.push({ label: 'Prêt studio', amount: 400, period: 'mois',
                                   shares: {}, creditId: 'd_pret' });
    });
    const cf = cashFlowBien(compteById('c_immo'));
    eq(cf.creditsListe[0].chargeIndex, Store.state.budget.fixedCharges.length - 1,
      'la ligne pointe la charge qui porte la mensualité');
    const src = lireSource('assets/app.js');
    vrai(/action: x\.chargeIndex != null \? 'edit-charge' : 'editer-credit'/.test(src),
      'et la vue choisit la fenêtre selon ce lien');
  });

  test('un loyer se modifie et se supprime depuis le bien qui le porte', () => {
    /* Il ne s'editait qu'en place dans la page Budget : affiche sur la fiche de
       son bien, il n'avait aucune porte. La fenetre est la seconde porte sur le
       meme champ, pas un second champ. */
    const src = lireSource('assets/app.js');
    vrai(/async 'edit-income'\(btn\)/.test(src), 'la fenêtre existe');
    const fn = src.slice(src.indexOf("async 'edit-income'"), src.indexOf("async 'del-income'"));
    vrai(/budget\.income\.splice\(i, 1\)/.test(fn), 'elle supprime');
    vrai(/cle: 'period'/.test(fn), 'elle porte la période, comme sa jumelle des charges');
    vrai(/cle: 'bienId'/.test(fn), 'et le rattachement au bien');
    vrai(/r\.label = v\.label/.test(fn) && /r\.amount = num\(v\.amount\)/.test(fn),
      'elle écrit dans budget.income, la même case que les champs de la page');
    /* La page Budget garde ses champs en place : c'est sa nature, on y saisit en
       serie, et la fenetre ne doit pas les remplacer. */
    vrai(/data-path="budget\.income\.\$\{i\}\.amount"/.test(src),
      'les champs en place de la page Budget restent');
  });

  test('un crédit se renomme et se supprime depuis la fiche du bien', () => {
    const src = lireSource('assets/app.js');
    const fiche = src.slice(src.indexOf('function carteCredit'),
                            src.indexOf('function espaceBien'));
    vrai(/data-action="editer-credit" data-etab=/.test(fiche),
      'son nom ouvre sa fenêtre : renommer ne se faisait que depuis l’établissement');
    const fn = src.slice(src.indexOf("async 'editer-credit'"), src.indexOf("async 'retirer-credit'"));
    vrai(/cle: 'supprimer'/.test(fn), 'et la fenêtre porte la suppression');
    vrai(/e\.dettes\.splice\(i, 1\)/.test(fn), 'qui retire vraiment la dette');
    vrai(/patrimoine net/.test(fn),
      'le toast dit la conséquence : une dette qui part fait monter le net');
  });

  test('aucune ligne de la carte n’affiche un montant sans porte', () => {
    /* Le balayage qui compte : toute ligne de montant passe par `ligneSource`,
       ou bien porte une aide qui dit ou le regler. Les deux exceptions sont
       nommees ici, et ce sont des champs de la meme carte. */
    const src = lireSource('assets/app.js');
    /* `ligneSource` reste HORS du balayage : c'est elle qui pose le <dt> porteur
       du bouton, et l'inclure ferait compter la porte elle-meme comme une ligne
       sans porte. Les trois autres poseurs de lignes y sont, eux — la liste du
       mois, le total nomme, et le total des mensualites. */
    const bloc = src.slice(src.indexOf('function lignesDuMois'),
                           src.indexOf('function carteUsageInconnu'))
      + src.slice(src.indexOf('function ligneTotal'), src.indexOf('function ligneCharges'))
      + src.slice(src.indexOf('function ligneMensualite'),
                  src.indexOf('function blocCapitalRembourse'));
    vrai(bloc.length > 400, 'les fonctions doivent être trouvables');
    /* `<dt` et non `<dt>` : le sous-total du loyer retenu porte une classe, et
       le motif d'avant serait passe a cote sans rien dire. */
    const litteraux = bloc.match(/<dt[ >][^\n]*/g) || [];
    /* SIX. La fiscalite en ecrit deux, une par etat — celle qui porte un montant
       et celle qui dit « non estimee » — et la cascade en ajoute une sixieme, le
       sous-total d'avant fiscalite, qui ne parait que lorsque la fiscalite est
       connue. Six dans le fichier, jamais six a l'ecran. */
    eq(litteraux.length, 6,
      'six lignes seulement s’écrivent à la main : les autres passent par ligneSource');
    /* La regle qui compte n'est pas le nombre de lignes, c'est qu'aucune ne
       laisse chercher : chacune porte une aide qui dit ou le montant se regle.
       La vacance et l'impot renvoient a un champ de la meme carte, le total des
       mensualites renvoie a « Financement », qui detaille chaque pret.

       Les libelles ne se cherchent pas ici : celui du total des mensualites vient
       d'une variable, parce qu'il se met au pluriel. Ce sont les aides qui
       identifient les lignes, et c'est elles qui portent la regle.

       La quatrieme vient de `ligneTotal`, qui sert des qu'aucune porte unique
       n'existe : plusieurs charges, plusieurs credits, plusieurs loyers. Son
       aide dit ou le detail se corrige — le budget, ou « Financement ». A une
       seule source, la ligne garde son nom et sa porte. */
    vrai(litteraux.every(l => l.includes('${aide(')),
      'chacune porte une aide qui dit où le montant se règle');
    vrai(/Se règle par « Mois loués par an »/.test(bloc)
      && /Se règle par « Fiscalité estimée »/.test(bloc)
      && /se lit séparément dans « Financement »/.test(bloc),
      'et les trois le disent');
  });

  test('supprimer une ligne rattachée dit ce que ça emporte ailleurs', () => {
    /* Un loyer supprime depuis la page Budget fait tomber le cash-flow et les
       trois rendements de son bien, sur un ecran qu'on ne regarde pas a ce
       moment-la. Une consequence a deux ecrans de distance se lit avant. */
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function makeDeleter'), src.indexOf('function optionsBiens'));
    vrai(/item\.bienId \? compteById\(item\.bienId\) : null/.test(fn),
      'la confirmation regarde si la ligne est rattachée à un bien');
    vrai(/Le cash-flow et le rendement de/.test(fn), 'et nomme ce qui va tomber');
    vrai(/item\.creditId/.test(fn) && /n’aura plus de mensualité/.test(fn),
      'une charge qui rembourse un crédit le dit aussi : sa date de fin en dépend');
  });

  test('la liste des biens à rattacher porte ses accents', () => {
    /* « aucun, ce n'est pas lie a un bien » s'affichait tel quel dans deux
       fenetres. Les commentaires s'ecrivent sans accents, le texte affiche
       jamais. `optionsBiens` vit dans app.js, que le harnais ne charge pas :
       le controle se fait sur la source, comme les autres de cette famille. */
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function optionsBiens'), src.indexOf('function optionsBiens') + 260);
    vrai(/lié à un bien/.test(fn), 'la première option porte ses accents');
    vrai(!/lie a un bien/.test(src), 'et la version nue a disparu du fichier');
    vrai(/trad\('aucun, ce n’est pas lié à un bien'\)/.test(fn),
      'elle passe par trad, comme toute chaîne affichée');
  });

  test('une part hors bornes le dit au lieu d’être ignorée en silence', () => {
    const src = lireSource('assets/app.js');
    /* Le mot dit la REGLE, et non ce que le calcul ferait d'une valeur invalide :
       « au-dela, le bien compte en entier » laissait croire que la saisie avait
       ete prise en compte, alors qu'elle ne l'est plus du tout. */
    vrai(/La quote-part doit être comprise entre 0 et 100 %\./.test(src),
      'le champ garde la saisie, et un mot dit la règle');
    vrai(!/Au-delà, le bien compte en entier/.test(src), 'l’ancien wording est parti');
    vrai(/\$\{partEstValide\(l\.part\) \? '' :/.test(src),
      'et le mot n’apparaît que pour une valeur vraiment hors bornes, jamais sur 0 ni 100');
    /* Et surtout : elle ne s'ecrit plus. */
    vrai(/if \(\/\\\.part\$\/\.test\(path\) && f\.value !== '' && !partEstValide\(f\.value\)\)/
      .test(src), 'l’écriture refuse une quote-part hors bornes');
  });
});

/* ------------------------------------------------------------------
   Performance ne dit que ce qu'elle peut prouver
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   Une identite Access se prouve, elle ne se declare pas
   ------------------------------------------------------------------ */
suite('Une identité Access se prouve, elle ne se déclare pas', () => {

  /* Ce controle EXECUTE la validation au lieu de lire sa source, et c'est la
     seule façon de prouver qu'une signature est verifiee : un test qui cherche
     « crypto.subtle.verify » dans le fichier passerait aussi sur un appel dont
     le resultat est ignore.

     Le bloc est extrait de `_worker.js` et evalue avec un `fetch` bouchonne qui
     rend les clefs publiques d'une paire generee ici. Le jeton est donc signe
     pour de bon, et chaque falsification doit etre refusee. */
  const DOMAINE = 'exemple.cloudflareaccess.com';
  const AUD = 'aud-de-test-0123456789abcdef';

  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64urlTexte = s => b64url(new TextEncoder().encode(s));

  /* Le bloc de validation, tel qu'il vit dans le Worker. */
  const chargerValidateur = (source, clefsPubliques) => {
    const d = source.indexOf('const CLEFS_TTL_MS');
    const f = source.indexOf('\n}', source.indexOf('async function accessEmail')) + 2;
    vrai(d > 0 && f > d, 'le bloc de validation doit être trouvable dans _worker.js');
    const faussetFetch = async () => ({ ok: true, json: async () => ({ keys: clefsPubliques }) });
    return new Function('fetch', 'atob', 'crypto', 'TextDecoder', 'TextEncoder',
      `${source.slice(d, f)}\nreturn accessEmail;`)(
        faussetFetch, atob, crypto, TextDecoder, TextEncoder);
  };

  const paire = async () => crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);

  const signer = async (priv, entete, charge) => {
    const corps = `${b64urlTexte(JSON.stringify(entete))}.${b64urlTexte(JSON.stringify(charge))}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv,
      new TextEncoder().encode(corps));
    return `${corps}.${b64url(sig)}`;
  };

  const chargeSaine = () => ({
    aud: [AUD], iss: `https://${DOMAINE}`, email: 'proprietaire@exemple.fr',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const monter = async () => {
    const { privateKey, publicKey } = await paire();
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    const src = lireSource('_worker.js');
    vrai(src, '_worker.js doit être lisible pour ce contrôle');
    const valider = chargerValidateur(src, [{ ...jwk, kid: 'k1', alg: 'RS256' }]);
    const env = { ACCESS_TEAM_DOMAIN: DOMAINE, ACCESS_AUD: AUD };
    const appeler = jeton => valider(
      { headers: { get: n => (n === 'Cf-Access-Jwt-Assertion' ? jeton : null) } }, env);
    return { privateKey, valider, env, appeler };
  };

  test('un jeton correctement signé donne son adresse', async () => {
    const { privateKey, appeler } = await monter();
    const jeton = await signer(privateKey, { alg: 'RS256', kid: 'k1' }, chargeSaine());
    eq(await appeler(jeton), 'proprietaire@exemple.fr',
      'un jeton valide doit rendre l’adresse de sa charge');
  });

  test('une signature qui ne colle pas est refusée', async () => {
    const { privateKey, appeler } = await monter();
    const jeton = await signer(privateKey, { alg: 'RS256', kid: 'k1' }, chargeSaine());
    /* Un caractere de la charge change : la signature ne couvre plus le corps.
       C'est le defaut d'origine — la presence de l'en-tete valait identite, donc
       n'importe quelle charge passait. */
    const [h, , s] = jeton.split('.');
    const truquee = b64urlTexte(JSON.stringify({ ...chargeSaine(), email: 'voleur@ailleurs.fr' }));
    eq(await appeler(`${h}.${truquee}.${s}`), null,
      'une charge modifiée après signature doit être refusée');
  });

  test('les autres refus, un par un', async () => {
    const { privateKey, appeler } = await monter();
    const cas = [
      ['une audience étrangère', { alg: 'RS256', kid: 'k1' }, { ...chargeSaine(), aud: ['une-autre-app'] }],
      ['un émetteur étranger', { alg: 'RS256', kid: 'k1' }, { ...chargeSaine(), iss: 'https://ailleurs.example' }],
      ['un jeton expiré', { alg: 'RS256', kid: 'k1' }, { ...chargeSaine(), exp: Math.floor(Date.now() / 1000) - 10 }],
      ['une clef inconnue', { alg: 'RS256', kid: 'k-inconnue' }, chargeSaine()],
      ['sans adresse dans la charge', { alg: 'RS256', kid: 'k1' }, { ...chargeSaine(), email: '' }],
    ];
    for (const [quoi, entete, charge] of cas) {
      const jeton = await signer(privateKey, entete, charge);
      eq(await appeler(jeton), null, `${quoi} doit être refusé`);
    }
    /* `alg: none` est l'attaque classique : la signature est vide et le
       verificateur naif l'accepte. La garde porte sur l'algorithme annonce. */
    const sansAlgo = `${b64urlTexte(JSON.stringify({ alg: 'none', kid: 'k1' }))}.`
      + `${b64urlTexte(JSON.stringify(chargeSaine()))}.`;
    eq(await appeler(sansAlgo), null, '« alg: none » doit être refusé');
    eq(await appeler('pas-un-jeton'), null, 'une chaîne quelconque doit être refusée');
    eq(await appeler(null), null, 'aucun jeton, aucune identité');
  });

  test('sans réglage Access, aucune identité — et le mot de passe reprend la main', async () => {
    /* La regle qui empeche de se fermer la porte : sans les deux variables, il n'y
       a pas d'identite Access, donc pas d'autorisation par ce chemin. Ce n'est pas
       un verrou, c'est un retour au mot de passe, qui existe deja. */
    const { privateKey, valider } = await monter();
    const jeton = await signer(privateKey, { alg: 'RS256', kid: 'k1' }, chargeSaine());
    const req = { headers: { get: n => (n === 'Cf-Access-Jwt-Assertion' ? jeton : null) } };
    eq(await valider(req, {}), null, 'sans domaine ni audience, aucune identité');
    eq(await valider(req, { ACCESS_TEAM_DOMAIN: DOMAINE }), null, 'l’audience manque');
    eq(await valider(req, { ACCESS_AUD: AUD }), null, 'le domaine manque');
  });

  test('la clé KV ne vient plus d’un en-tête', () => {
    /* Le lien qui rendait le defaut exploitable : le meme en-tete valait
       autorisation ET choisissait la cle. Envoyer le nom de quelqu'un d'autre
       donnait son etat. La cle se derive desormais d'une adresse validee, passee
       en argument. */
    const src = lireSource('_worker.js');
    vrai(/const keyFor = email =>/.test(src),
      'keyFor prend une adresse, pas une requête');
    vrai(!/keyFor\(request\)/.test(src),
      'aucun appel ne doit encore lui passer la requête');
    const brut = (src.match(/headers\.get\('Cf-Access-Authenticated-User-Email'\)/g) || []).length;
    eq(brut, 0,
      'plus aucune lecture brute de l’en-tête d’identité : elle ne prouve rien');
  });
});

suite('Une vente datee dans le passe ne prend pas le cours du jour', () => {

  test('la fenetre avertit quand la date recule', () => {
    /* « Si quelqu'un ajoute une vente dans l'app un mois apres, le cours peut
       avoir change. » Il a change, et rien ne le disait : le prix et le taux se
       pre-remplissent au cours du jour, la date se recule librement, et la
       plus-value realisee se calculait alors sur un cours qui n'a jamais ete
       celui de la vente. Un chiffre faux que rien ne trahit — la faute que ce
       projet traque depuis le debut.

       Le mode « vente passee » etait deja a l'abri : il ne demande ni cours ni
       taux, mais le montant encaisse et la plus-value en euros, les deux
       chiffres du releve. C'est le mode normal, avec sa date libre, qui laissait
       passer.

       L'avis pointe et ne bloque pas : c'est peut-etre le bon prix, saisi a la
       main. Il nomme la porte d'a cote, dont les chiffres ne vieillissent pas. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit etre lisible');
    vrai(/id="veVieux" hidden/.test(src),
      'la fenetre de vente porte un avis, muet par defaut');
    const f = src.slice(src.indexOf('const avisCoursDuJour'),
                        src.indexOf('const avisCoursDuJour') + 1200);
    vrai(f.length > 200, 'le controle doit se relire depuis sa source');

    /* Les trois conditions, chacune verifiee : le mode, la date, et le fait que
       le prix soit reste celui qu'on a propose. Sans la premiere, l'avis
       s'afficherait sur une vente passee qui n'utilise aucun cours ; sans la
       troisieme, il crierait sur un prix deja corrige. */
    vrai(/!passee\(\)/.test(f),
      'pas d’avis en mode « vente passee » : elle ne lit aucun cours');
    vrai(/< todayISO\(\)/.test(f),
      'l’avis se declenche sur une date anterieure a aujourd’hui');
    vrai(/Math\.abs\(saisi - auJour\)/.test(f),
      'et il change de texte quand le prix a ete corrige a la main');

    /* Il se rejoue sur la date ET sur le prix : corriger l’un doit pouvoir
       eteindre l’avis, sinon il reste allume sur une saisie devenue juste. */
    vrai(/\$\('#veDate'\)\.oninput = avisCoursDuJour/.test(src),
      'la date rejoue le controle');
    vrai(/majApercuVente\(\); avisCoursDuJour\(\);/.test(src),
      'le prix aussi');
  });
});

suite('Une plus-value en devise dit ce que le courtier dit', () => {
  test('le total coïncide avec le mouvement du titre', () => {
    /* Aucune decomposition sous le total : le courtier convertit ses deux
       jambes au taux du jour, et l'application aussi. Deux lignes dont le
       titre et dont le change expliqueraient un ecart qui n'existe pas.

       Les deux jambes prenant le meme taux, le total EST le mouvement du titre.
       Les repeter dessous ne dirait rien, et `posPerfTitre` n'existe pas.

       Les chiffres sont fictifs, et ronds pour que le pourcentage se lise. */
    const p = { currency: 'USD', qty: 5, buyPrice: 400, price: 372, fx: 0.9 };
    pres(posPerfPct(p), (372 / 400 - 1) * 100,
      'le pourcentage est celui du titre dans sa monnaie');
    pres(posPerfPct(p), -7, 'soit ce que le courtier annonce');

    /* Et il ne bouge pas avec le taux : les deux jambes se compensent. */
    const autreTaux = Object.assign({}, p, { fx: 0.5 });
    pres(posPerfPct(autreTaux), posPerfPct(p),
      'un changement de taux ne déplace pas le pourcentage');

    /* Le montant en euros, lui, suit le taux du jour — et c'est assume : il dit
       ce que cette ligne a gagne ou perdu en euros d'aujourd'hui. */
    vrai(Math.abs(posPerfEur(autreTaux) - posPerfEur(p)) > 1,
      'le montant en euros, lui, suit le taux du jour');
  });

  test('aucune décomposition ne subsiste sous le total', () => {
    /* Le controle porte sur l'appel a `trad`, pas sur les mots : un commentaire
       qui raconte pourquoi ces lignes sont parties contient forcement leur nom, et
       la premiere redaction de ce test tombait sur son propre commentaire. Ce
       qu'on interdit, c'est qu'elles s'AFFICHENT. */
    const src = lireSource('assets/app.js');
    vrai(!/trad\('dont le titre'\)/.test(src) && !/trad\('dont le change'\)/.test(src),
      'les deux lignes ne doivent plus s’afficher : le total les dit toutes les deux');
    const store = lireSource('assets/store.js');
    vrai(!/posPerfTitre|posPerfParts/.test(store),
      'et leurs fonctions avec elles');
  });
});

suite('La répartition suit le commutateur, et ses parts font le total', () => {

  test('en net, la somme des classes fait le patrimoine net', () => {
    /* C'est la regle cardinale du projet, prise en flagrant delit sur l'accueil :
       le commutateur Net / Brut gouvernait le grand chiffre et la courbe, pas la
       carte de repartition. On lisait donc un patrimoine net en tete et une
       repartition qui totalisait le brut juste dessous.

       Le credit du fixture est le seul de l'etablissement du studio : son lien
       designe le studio, et il se retranche de l'immobilier. Aucune autre classe
       ne bouge. */
    Fixture.poser();
    const p = patrimoine();
    const net = repartitionClasses({ net: true });
    const somme = net.reduce((s, x) => s + x.value, 0);
    pres(somme, p.net, 'la somme des classes doit faire le patrimoine net');
    pres(net.reduce((s, x) => s + x.pct, 0), 100, 'et les parts doivent faire 100 %');

    const immo = net.find(x => x.classe === 'immobilier');
    const brut = repartitionClasses();
    const immoBrut = brut.find(x => x.classe === 'immobilier');
    pres(immo.value, immoBrut.value - Fixture.DETTE,
      'le prêt du studio se retranche de l’immobilier');
    pres(immo.dettes, Fixture.DETTE, 'et la part dit combien de crédit elle porte');
    for (const x of net) {
      if (x.classe === 'immobilier') continue;
      const jumelle = brut.find(b => b.classe === x.classe);
      pres(x.value, jumelle.value, `« ${x.label} » ne doit pas bouger : la dette ne la finance pas`);
    }
  });

  test('en brut, la somme des classes fait les avoirs', () => {
    /* L'autre moitie de l'invariant : le mode par defaut ne doit rien retrancher.
       Sans ce controle, mettre la dette partout passerait le premier test. */
    Fixture.poser();
    Store.state.etabs[0].dettes = [{ id: 'd1', libelle: 'Prêt', montant: 40000, note: '' }];
    refreshAccounts();
    const p = patrimoine();
    const brut = repartitionClasses();
    pres(brut.reduce((s, x) => s + x.value, 0), p.brut,
      'la somme des classes doit faire les avoirs, crédits non déduits');
  });

  test('une dette sans destination connue a sa ligne, et n’invente aucun immobilier', () => {
    /* Un credit a la consommation chez une banque qui tient deux comptes, sans
       lien : rien ne dit ce qu'il finance. Il allait a l'immobilier par defaut,
       et un patrimoine sans aucun bien affichait « Immobilier » en negatif. Il
       reste compte, sur sa propre ligne, et aucune classe ne le prend. */
    Fixture.poser(s => {
      s.comptes = s.comptes.filter(c => c.id !== 'c_immo');
      s.etabs = s.etabs.filter(e => e.id !== 'e_bien');
      s.etabs.find(e => e.id === 'e_banque').dettes =
        [{ id: 'd1', libelle: 'Crédit conso', montant: 5000, note: '' }];
    });
    const net = repartitionClasses({ net: true });
    vrai(!net.some(x => x.classe === 'immobilier'), 'aucune ligne immobilière sans bien');
    const seule = net.find(x => x.classe === DETTES_NON_AFFECTEES);
    vrai(seule, 'la dette a sa ligne');
    pres(seule.value, -5000, 'négative, pour son montant');
    pres(net.reduce((s, x) => s + x.value, 0), patrimoine().net,
      'et la somme fait toujours le patrimoine net');
    for (const x of net) {
      if (x.classe === DETTES_NON_AFFECTEES) continue;
      pres(x.dettes, 0, `« ${x.label} » ne porte aucun crédit`);
    }
  });

  test('la vue passe le même mode à ses deux lectures', () => {
    /* La barre du hero resume la liste qui la suit. Un appel qui oublierait
       l'argument ferait diverger les deux sur le meme ecran et au meme instant. */
    const src = lireSource('assets/app.js');
    eq((src.match(/repartitionClasses\(/g) || []).length, 2,
      'deux lectures, pas trois');
    eq((src.match(/repartitionClasses\(\{ net: evoNet \}\)/g) || []).length, 2,
      'et toutes deux dans le même mode');
    /* La mention de base suit aussi : elle annoncait « tes avoirs » dans les deux
       modes, donc en net elle nommait une base que les parts ne totalisaient plus.
       Une mention qui ne bouge pas quand le calcul bouge rassure a tort. */
    vrai(/evoNet \? BASES\.net : BASES\.avoirs/.test(src),
      'la mention de base doit suivre le commutateur');
  });
});


suite('Le deux-points se traduit comme le reste', () => {

  /* Le francais met une espace avant le deux-points, l'anglais n'en met pas.
     La phrase « Ici, tout est compte : 30 250 EUR » est juste en francais ; en
     anglais, un gabarit qui garderait l'espace produirait « everything is
     counted : EUR 30,250 ».

     Le premier correctif a casse le francais : `trad(phrase, repli)` rend le
     REPLI en francais et la traduction de la CLEF en anglais, donc passer ':'
     en repli ecrasait exactement le cas qui etait deja juste. Vu a l'ecran, pas
     par un test — d'ou celui-ci, qui tient les deux cotes a la fois. */
  test('le français garde son espace, l’anglais n’en met pas', () => {
    enLangue('fr', () => eq(deuxPoints(), ' :',
      'le deux-points français prend une espace insécable avant lui'));
    enLangue('en', () => eq(deuxPoints(), ':',
      'l’anglais n’en prend aucune'));
  });

  test('la page Allocation ne l’écrit plus dans son gabarit', () => {
    /* Ce controle a d'abord balaye tout le fichier, et il a rendu huit
       resultats dont cinq faux : un ternaire JavaScript s'ecrit aussi « } : »,
       et un deux-points a l'interieur d'une chaine deja traduite est correct
       puisque sa traduction le gere. Distinguer les trois demanderait de
       tokeniser le fichier.

       Il se resserre donc sur la page Allocation, dont je peux lire le gabarit
       en entier. Un controle qui prouve peu et le dit vaut mieux qu'un controle
       large qu'il faut entourer d'exceptions — les exceptions finissent par
       couvrir le defaut qu'on cherchait.

       Les separateurs des autres pages ont ete convertis a la main, et trois
       endroits gardent de la prose francaise ecrite hors de trad() : c'est un
       autre defaut, plus ancien, et il ne se corrige pas ici. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewAllocation()'),
                          src.indexOf('function mountAllocation'));
    const fautifs = [...vue.matchAll(/(?:<\/(?:b|span|dt|i)>|\}) : /g)];
    eq(fautifs.length, 0,
      fautifs.length + ' séparateur(s) écrit(s) dans le gabarit d’Allocation '
      + 'au lieu de passer par deuxPoints()');
  });

  test('la phrase du préambule nomme toutes les classes écartées', () => {
    /* L'enumeration est ecrite a la main — « immobilier et biens de valeur » —
       parce que la fabriquer depuis les libelles demanderait de les mettre en
       minuscules, ce qui ne se fait pas de la meme facon dans toutes les
       langues, et parce que ces libelles ne sont pas tous traduits.

       Elle est donc epinglee ici : le jour ou la liste des classes ecartees
       change, ce controle tombe et force a relire la phrase. C'est ce qui
       manquait — elle disait « l'immobilier est ecarte » alors que les objets
       de valeur sortaient aussi, et rien ne le signalait. */
    /* L'ancre etait `CLASSES_HORS_FINANCIER`, une liste de CLASSES. Elle a
       disparu avec le defaut qu'elle portait : la frontiere se lit sur le
       CONTENANT. L'enumeration reste ecrite a la main, et c'est desormais le
       predicat qui l'epingle — le jour ou un type detenu en direct s'ajoute, ce
       controle tombe et force a relire la phrase. */
    const dedans = TYPES_COMPTE.filter(t => !estHorsPerimetreFinancier({ type: t.id }));
    const dehors = TYPES_COMPTE.filter(t => estHorsPerimetreFinancier({ type: t.id }));
    eq(dehors.map(t => t.id).join(','), 'immo,bienValeur',
      'la liste des types écartés a changé : la phrase du préambule doit '
      + 'être relue, elle les énumère à la main');
    vrai(dedans.some(t => t.id === 'scpi'), 'la pierre papier n’en fait pas partie');
    const src = lireSource('assets/app.js');
    vrai(/immobilier en direct et biens de valeur écartés/.test(src),
      'le préambule doit dire « en direct » : sans ce mot il annonce que la SCPI '
      + 'sort, alors qu’elle reste');
  });
});

/* --- un mur n'est pas de la pierre papier -------------------------------

   LE DEFAUT. Le perimetre financier se lisait sur la CLASSE de la ligne :
   `['immobilier', 'bienValeur']` sortait, le reste restait. La classe
   `immobilier` couvre l'appartement qu'on habite ET la part de SCPI, et le
   support immobilier qu'une assurance-vie propose a cote de son fonds euros.
   Trois choses sans rapport sous un seul mot, et la vue financiere les jetait
   toutes les trois : un contrat de cent mille euros en annonçait cinquante
   parce qu'il portait de la pierre papier.

   La question n'etait pas « de quelle classe est cette ligne ? » mais « est-ce
   un mur qu'on detient soi-meme ? ». Le modele savait deja repondre — le
   drapeau `direct` de `TYPES_COMPTE`, que `estBienEnDirect` lit depuis toujours
   pour decider si l'on demande son usage a un bien. `estHorsPerimetreFinancier`
   pose la meme question pour le perimetre, et rien d'autre ne la pose.

   Ces tests additionnent : ils ne lisent presque aucune source. Un perimetre se
   prouve par des totaux qui se recomposent, pas par une expression rationnelle
   sur un filtre. */
/* --- « Aujourd'hui » n'est plus un second inventaire ---------------------

   LE DEFAUT ETAIT VISUEL, et il n'en etait pas moins reel. La carte du jour
   deroulait chaque ligne du portefeuille — nom, poids, variation, effet — et
   trois cents pixels plus bas, « Lignes de titres » redonnait les memes neuf
   titres avec leur valeur et leur performance depuis l'achat. Les deux cartes
   repondent a deux questions differentes, et sur un telephone elles se lisaient
   comme un doublon : on relisait neuf noms pour retrouver le seul qui avait
   bouge.

   Le partage est desormais net. « Aujourd'hui » dit ce qui a bouge et ce que
   cela a change ; « Lignes de titres » dit ce qu'on possede et ce que cela vaut.
   Aucune metrique de marche n'a bouge : ces controles verifient un CHOIX et un
   ORDRE, jamais un calcul. */
suite('Aujourd’hui montre ce qui a bougé, pas l’inventaire', () => {

  /* Quantite 100 et change 1 : l'effet en euros vaut cent fois l'ecart de prix,
     donc chaque cas se lit de tete. C'est le meme montage que les suites du
     jour deja en place. */
  const secondes = (iso, heure = '14:00:00') =>
    Math.floor(new Date(iso + 'T' + heure).getTime() / 1000);
  const veille = iso => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const poser = (jour, lignes) => Fixture.poser(e => {
    e.positions = lignes.map((l, i) => ({
      id: `p_${i}`, name: l.nom || `Ligne ${i}`, isin: '', symbol: `SYM${i}`,
      currency: 'EUR', qty: 100, buyPrice: 5, price: l.prix, fx: 1, fxBuy: 1,
      account: 'c_pea', manual: false, assetClass: 'actions', role: 'core',
      prevClose: l.veille,
      /* Sans heure, la ligne a cote aujourd'hui ; avec l'heure de la veille,
         elle se tait. C'est la seule difference entre un mouvement et une ligne
         « sans cours du jour ». */
      quoteTime: l.hier ? secondes(veille(jour), '22:00:00') : secondes(jour, '11:00:00'),
    }));
  });
  const noms = xs => xs.map(l => l.name).join(',');

  /* --- 1. le choix des mouvements --------------------------------------- */

  test('neuf lignes, un seul mouvement : un seul mouvement montré', () => {
    /* Le cas type. Des lignes qui n'ont pas cote depuis minuit n'occupent pas
       chacune une rangee pour repeter l'heure de leur dernier cours. Elles
       restent comptees en tete de carte et rendues au depliage. */
    auJour('2026-08-06', () => {
      poser('2026-08-06', [{ nom: 'Solana USD', prix: 10.06, veille: 10 }].concat(
        Array.from({ length: 8 }, (_, i) => ({ nom: `Fige ${i}`, prix: 20, veille: 19, hier: true }))));
      const j = dayPerformance();
      eq(j.lignes.length, 9, 'les neuf lignes ont une clôture de référence');
      eq(j.horsSeance, 8, 'huit se taisent');
      const m = mouvementsDuJour(j);
      eq(m.length, 1, 'un seul mouvement exploitable');
      eq(m[0].name, 'Solana USD', 'et c’est celui qui a coté');
      pres(m[0].eur, 6, 'son effet, six euros');
      vrai(!m.some(l => l.horsSeance),
        'aucune ligne sans cours du jour ne se glisse parmi les mouvements');
    });
  });

  test('cinq mouvements : les trois plus gros, et pas les cinq', () => {
    auJour('2026-08-06', () => {
      poser('2026-08-06', [
        { nom: 'A', prix: 1.10, veille: 1 },        // +10 €
        { nom: 'B', prix: 25.50, veille: 25 },      // +50 €
        { nom: 'C', prix: 99, veille: 100 },        // -100 €
        { nom: 'D', prix: 1.20, veille: 1 },        // +20 €
        { nom: 'E', prix: 5.05, veille: 5 },        // +5 €
      ].concat(Array.from({ length: 4 }, (_, i) =>
        ({ nom: `Fige ${i}`, prix: 20, veille: 19, hier: true }))));
      const j = dayPerformance();
      eq(j.lignes.length, 9, 'neuf lignes en tout');
      eq(mouvementsDuJour(j).length, 3, 'trois mouvements montrés, pas cinq');
    });
  });

  test('trois lignes, trois mouvements : les trois', () => {
    auJour('2026-08-06', () => {
      poser('2026-08-06', [{ nom: 'A', prix: 1.10, veille: 1 },
                           { nom: 'B', prix: 25.50, veille: 25 },
                           { nom: 'C', prix: 99, veille: 100 }]);
      eq(mouvementsDuJour().length, 3, 'aucune n’est écartée');
    });
  });

  test('aucun cours du jour : aucun faux mouvement à zéro', () => {
    /* La convention de la maison, appliquée ici aussi : un titre qui n'a pas
       coté ne fait pas 0 %, il ne dit rien. Le ranger dernier avec
       « 0,00 % · 0 € » serait exactement le zéro inventé que cette carte refuse
       déjà dans ses colonnes. */
    auJour('2026-08-06', () => {
      poser('2026-08-06', Array.from({ length: 9 }, (_, i) =>
        ({ nom: `Fige ${i}`, prix: 20, veille: 19, hier: true })));
      const j = dayPerformance();
      eq(j.toutHorsSeance, true, 'rien n’a coté depuis minuit');
      eq(mouvementsDuJour(j).length, 0, 'donc aucun mouvement n’est montré');
      /* Et la carte a de quoi le dire : le total se déclare au lieu de
         s’afficher, ce qui existait déjà et ne change pas. */
      eq(j.eur, 0, 'le total est nul, ce qui est juste');
    });
  });

  /* --- 2. l'ordre ------------------------------------------------------- */

  test('le classement suit l’effet en euros, pas la variation', () => {
    /* Ce qui a le plus fait bouger le portefeuille aujourd'hui se mesure en
       euros. Une ligne a +1 % qui pese la moitie du portefeuille deplace plus
       d'argent qu'une ligne a +10 % qui en pese trois pour cent. Trier par
       pourcentage donnerait D, A, B -- l'ordre des petites lignes agitees. */
    auJour('2026-08-06', () => {
      poser('2026-08-06', [
        { nom: 'A', prix: 1.10, veille: 1 },        // +10 %  → +10 €
        { nom: 'B', prix: 25.50, veille: 25 },      //  +2 %  → +50 €
        { nom: 'C', prix: 99, veille: 100 },        //  -1 %  → -100 €
        { nom: 'D', prix: 1.20, veille: 1 },        // +20 %  → +20 €
      ]);
      const j = dayPerformance();
      /* Les effets d'abord, sinon le reste du contrôle ne prouve rien. */
      const par = Object.fromEntries(j.lignes.map(l => [l.name, Math.round(l.eur)]));
      eq(`${par.A},${par.B},${par.C},${par.D}`, '10,50,-100,20', 'les quatre effets');
      eq(noms(mouvementsDuJour(j)), 'C,B,D',
        'la plus grosse perte passe devant, et la plus forte hausse ferme la marche');
      /* La valeur absolue, et non le signe : sans elle, C partirait en dernier. */
      vrai(noms(mouvementsDuJour(j)) !== 'D,A,B', 'ce n’est pas le classement par pourcentage');
      vrai(noms(mouvementsDuJour(j)) !== 'B,D,A', 'ni celui de l’effet signé');
    });
  });

  test('l’effet montré est celui de la colonne, pas un second calcul', () => {
    const src = lireSource('assets/store.js');
    const fn = src.slice(src.indexOf('function mouvementsDuJour('),
                         src.indexOf('function holdingsOf('));
    vrai(/Math\.abs\(num\(b\.eur\)\) - Math\.abs\(num\(a\.eur\)\)/.test(fn),
      'le tri lit `eur`, celui que dayPerformance rend déjà');
    vrai(!/prevClose|posValue|posPerf/.test(fn),
      'et ne recalcule aucune variation');
    vrai(/\.filter\(l => !l\.horsSeance\)/.test(fn),
      'les lignes sans cours du jour sont écartées du choix');
  });

  /* --- 3. ce que la carte rend ------------------------------------------ */

  test('la carte est repliée par défaut, et sur tous les écrans', () => {
    const src = lireSource('assets/app.js');
    vrai(/\nlet jourDeplie = false;/.test(src), 'l’état part replié');
    /* Aucune donnée persistée : c'est un état de vue, pas un réglage. */
    vrai(!/jourDeplie/.test(lireSource('assets/store.js')),
      'et il ne descend pas dans le modèle');
    for (const interdit of ['marketsTodayExpanded', 'todayCollapsed', 'showAllDaily'])
      vrai(!new RegExp(interdit).test(src), `${interdit} n’existe pas`);
    /* Aucune règle de largeur ne le déplie : le doublon existe aussi sur grand
       écran, et y dérouler neuf lignes parce qu'il y a la place ne répond à
       aucune question. */
    vrai(!/min-width[^;]*jourDeplie|jourDeplie[^;]*innerWidth/.test(src),
      'aucun seuil de largeur ne décide à sa place');
  });

  test('le jour dit ce qu’il compte, dans chaque état de la séance', () => {
    /* Rien en memoire, tout hors seance, seance mixte, cloture manquante : le
       moteur rend les memes comptes que la section affiche a cote du total. */
    const cotee = (p, prev, hier) => Object.assign(p, { prevClose: prev, quoteTime: Math.floor(new Date(todayISO() + 'T12:00:00').getTime() / 1000) - (hier ? 86400 : 0) });
    Fixture.poser(e => { e.positions.forEach(p => { delete p.prevClose; delete p.quoteTime; }); });
    eq(dayPerformance().lignes.length, 0, 'sans clôture en mémoire, aucune ligne');
    Fixture.poser(e => { e.positions.filter(p => !p.manual && num(p.price)).forEach(p => cotee(p, num(p.price), true)); });
    vrai(dayPerformance().toutHorsSeance, 'tout hors séance se dit comme tel');
    Fixture.poser(e => {
      e.positions.push(Object.assign(structuredClone(e.positions[0]), { id: 'p_trois', name: 'Troisième ligne' }));
      const [a, b, c] = e.positions;
      cotee(a, num(a.price) * 0.98, false);
      cotee(b, num(b.price) * 0.98, true);
      delete c.prevClose;
    });
    const j = dayPerformance();
    vrai(!j.toutHorsSeance && j.lignes.length > 0, 'une séance mixte a des lignes qui ont coté');
    vrai(j.sansDonnee >= 1, 'la clôture manquante se compte à part');
    vrai(j.horsSeance >= 1, 'et les lignes qui n’ont pas coté aujourd’hui aussi');
    eq(j.lignes.filter(l => l.horsSeance).length, j.horsSeance, 'les deux comptes ne se mélangent pas');
  });

  test('la section du jour se rend pour chaque état de la séance', () => {
    /* La vue n'est pas chargee dans cette page : la section se tire de la source
       et se joue telle quelle, avec les petites fonctions de la vue qu'elle
       emploie. Repliee, elle ne construit aucune rangee. */
    const src = lireSource('assets/app.js');
    const debut = src.indexOf('function sectionJour()');
    const code = src.slice(debut, src.indexOf('\n}\n', debut) + 2);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
    const section = new Function('esc', 'cls', 'aide', 'jourDeplie', 'enteteLignesJour', 'trierJour',
      code + '\nreturn sectionJour;')(esc, cls, () => '', false, () => '', l => l);
    const midi = Math.floor(new Date(todayISO() + 'T12:00:00').getTime() / 1000);
    const cotee = (p, prev, hier) => Object.assign(p, { prevClose: prev, quoteTime: midi - (hier ? 86400 : 0) });

    Fixture.poser(e => { e.positions.forEach(p => { delete p.prevClose; delete p.quoteTime; }); });
    let h = section();
    vrai(h.includes(trad('Pas encore de clôture de la veille en mémoire.')) && /data-action="refresh-quotes"/.test(h),
      'rien en mémoire : une ligne, et le geste qui y remédie');
    vrai(!/jour-plus/.test(h), 'sans bouton de détail');

    Fixture.poser(e => { e.positions.forEach(p => cotee(p, num(p.price), true)); });
    h = section();
    vrai(h.includes(trad('Aucune ligne n’a coté aujourd’hui')) && h.includes(trad('derniers cours')),
      'tout hors séance : une ligne, et la date des derniers cours');
    vrai(!/jour-plus/.test(h), 'sans bouton de détail');

    Fixture.poser(e => {
      e.positions.push(Object.assign(structuredClone(e.positions[0]), { id: 'p_trois', name: 'Troisième ligne' }));
      const [a, b, c] = e.positions;
      cotee(a, num(a.price) * 0.98, false);
      cotee(b, num(b.price) * 0.98, true);
      delete c.prevClose;
    });
    const j = dayPerformance();
    h = section();
    vrai(h.includes(fmtSigned(j.eur)), 'la séance mixte donne son total');
    vrai(h.includes(trad('sans cours du jour')) && /sans clôture de référence/.test(h),
      'et dit, à côté, les lignes qu’il ne compte pas');
    vrai(h.includes('>' + trad('Voir les {n} lignes').replace('{n}', j.lignes.length) + '<'),
      'le bouton compte toutes les lignes du jour');
    vrai(!/class="jour-ligne"/.test(h), 'replié, aucune rangée');
  });

  test('chaque angle de la répartition a son ancre, et l’ancre ouvre son angle', () => {
    const src = lireSource('assets/app.js');
    const constante = nom => {
      const i = src.indexOf(`const ${nom} =`);
      return new Function(`${src.slice(i, src.indexOf(';\n', i) + 1)}\nreturn ${nom};`)();
    };
    const angles = constante('ANGLES_ALLOCATION');
    const ancres = constante('ANCRES_ANGLES');
    eq(angles.map(([k]) => k).join(), 'categorie,lignes,detention,disponibilite', 'quatre angles, catégorie d’abord');
    const vue = src.slice(src.indexOf('function viewAllocation()'), src.indexOf('function mountAllocation'));
    for (const [cle] of angles) {
      const ancre = Object.keys(ancres).find(a => ancres[a] === cle);
      vrai(!!ancre, `l’angle « ${cle} » a une ancre`);
      vrai(new RegExp(`allocAngle !== '${cle}'[\\s\\S]{0,3000}?<section class="alloc-angle\\$\\{entreeAngle\\}" data-anchor="${ancre}"`).test(vue),
        `son ancre « ${ancre} » est posée sur sa section`);
    }
    vrai(/if \(pendingAnchor && ANCRES_ANGLES\[pendingAnchor\]\) allocAngle = ANCRES_ANGLES\[pendingAnchor\];/.test(vue),
      'une ancre choisit l’angle avant le rendu');
    vrai(/if \(allocAngleNav !== navsInternes\) \{ allocAngleNav = navsInternes; allocAngle = 'categorie'; \}/.test(vue),
      'l’angle revient à « Catégorie » à chaque arrivée sur la page');
    vrai(/k !== 'lignes' \|\| repartitionPortefeuille\(\)/.test(vue), 'l’angle sans lignes de marché ne se propose pas');
    vrai(/if \(view === 'allocation' && ANCRES_ANGLES\[pendingAnchor\]\) \{ render\(\); return; \}/.test(src),
      'sur la page déjà ouverte, l’ancre rend d’abord son angle');
    for (const [, l] of angles) vrai(!!I18N.en[l], `« ${l} » a sa traduction`);
  });

  test('le détail du jour ne se rend qu’une fois déplié', () => {
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf('function sectionJour()'), src.indexOf('\n}\n', src.indexOf('function sectionJour()')));
    vrai(/\$\{\(jourDeplie \? trierJour\(j\.lignes\) : \[\]\)\.map/.test(f),
      'les rangées détaillées ne sortent que dépliées, toutes les lignes du jour');
    vrai(/\$\{!jourDeplie \? '' : enteteLignesJour\(\)\}/.test(f), 'l’en-tête des colonnes suit');
    vrai(!/jourCompact|jour-mouv/.test(src), 'replié, aucune liste : la synthèse suffit');
    vrai(/<div class="jour-lignes">/.test(f), 'le conteneur existe replié, pour que le dépliement se mesure');
  });

  test('le bouton porte le compte des lignes qu’il ouvre', () => {
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function sectionJour()'),
                          src.indexOf('\n}\n', src.indexOf('function sectionJour()')));
    vrai(/data-action="jour-detail"/.test(vue), 'un vrai bouton, et une action');
    vrai(/<button type="button" class="jour-plus"/.test(vue), 'un `button`, pas un lien');
    vrai(/aria-expanded="\$\{jourDeplie \? 'true' : 'false'\}"/.test(vue),
      'et il annonce son état');
    vrai(/trad\('Voir les \{n\} lignes'\)/.test(vue) && /trad\('Voir la ligne'\)/.test(vue),
      'le nombre est dynamique, et le singulier existe');
    vrai(/trad\('Réduire'\)/.test(vue), 'et il sait se refermer');
    vrai(I18N.en['Voir les {n} lignes'] && I18N.en['Voir la ligne'] && I18N.en['Réduire'],
      'les trois sont traduites');
    /* Il déplie la carte, il ne navigue pas : renvoyer vers « Lignes de titres »
       aurait ouvert l'inventaire, qui ne dit rien du jour. */
    const action = src.slice(src.indexOf("'jour-detail'()"), src.indexOf('\n  },', src.indexOf("'jour-detail'()")));
    vrai(/jourDeplie = !jourDeplie;/.test(action), 'il bascule');
    vrai(/render\(\);/.test(action) && !/setView|location|scroll/.test(action),
      'et redessine la même carte');
  });

  test('chaque ligne du jour ouvre la fiche de sa position', () => {
    /* Le meme couple action et index que partout : deux chemins vers deux
       fiches se contrediraient le jour ou l'un change. */
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf('function sectionJour()'), src.indexOf('\n}\n', src.indexOf('function sectionJour()')));
    vrai(/data-action="open-position"\s*data-i="\$\{l\.index\}"/.test(f), 'la rangée du jour ouvre la fiche de sa position');
    vrai(/<button type="button" class="mois-lien"/.test(f), 'par un bouton, utilisable au clavier');
  });


  test('à partir de 768 px, le détail du jour lit ses colonnes une fois', () => {
    const css = lireSource('assets/styles.css');
    const i = css.indexOf('--jour-cols:');
    vrai(i > 0, 'les colonnes du jour sont déclarées une fois');
    eq(css.split('--jour-cols:').length - 1, 1, 'et une seule fois');
    const debut = css.lastIndexOf('@media (min-width: 768px) {', i);
    const bloc = css.slice(debut, css.indexOf('\n}', i));
    vrai(debut > 0 && /\.jour-lignes \.jour-ligne \{ grid-template-columns: var\(--jour-cols\); \}/.test(bloc),
      'le détail lit ces colonnes, avec deux classes pour battre sa règle de base');
    const src = lireSource('assets/app.js');
    eq(src.split('<div class="jour-ligne entete">').length - 1, 1, 'l’en-tête des colonnes s’écrit une fois');
  });

  test('« sans cours du jour » ne se dit qu’une fois', () => {
    /* Le compte vit en tête de carte, à côté du total. Le répéter en pied
       recréerait la redondance qu'on vient de retirer. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function sectionJour()'),
                          src.indexOf('\n}\n', src.indexOf('function sectionJour()')));
    const rendus = vue.split(`trad('sans cours du jour')`).length - 1;
    eq(rendus, 1, 'une seule occurrence rendue dans la vue Marchés');
    vrai(vue.indexOf(`trad('sans cours du jour')`) < vue.indexOf('class="jour-plus"'),
      'et c’est en tête, pas sous le bouton');
  });

  /* --- 4. l'inventaire reste l'inventaire ------------------------------- */

  test('« Lignes de titres » ne reçoit aucune variation du jour', () => {
    /* Une troisième métrique par ligne — « +5 % depuis achat · +0,4 %
       aujourd'hui » — recréerait la surcharge qu'on retire. La variation du jour
       vit dans « Aujourd'hui », et nulle part ailleurs. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewPositions('),
                          src.indexOf('function mountPositions('));
    const titres = vue.slice(vue.indexOf('data-anchor="titres"'));
    for (const marque of ['posDayChange', 'dayPerformance', 'prevClose', 'horsSeance'])
      vrai(!new RegExp(marque).test(titres),
        `le tableau des lignes ne parle pas de ${marque}`);
    /* Et il garde ce qu'il portait : filtres, actions, valeur, performance. */
    for (const garde of ['sortableTh', 'open-position', 'Vendre'])
      vrai(new RegExp(garde).test(titres), `${garde} est toujours là`);
  });

  test('aucune métrique de marché n’a changé', () => {
    /* Cette passe est de rendu. Les fonctions qui produisent les chiffres du
       jour sont lues, jamais réécrites : ce contrôle épingle leur forme. */
    const src = lireSource('assets/store.js');
    const fn = src.slice(src.indexOf('function posDayChange('),
                         src.indexOf('function marketStatus('));
    vrai(/pct: \(num\(p\.price\) \/ prev - 1\) \* 100,/.test(fn), 'la variation du jour');
    vrai(/eur: \(num\(p\.price\) - prev\) \* q \* fx,/.test(fn), 'l’effet, change compris');
    vrai(/if \(!coteAujourdhui\(p\)\) return \{ pct: 0, eur: 0, prev, price: num\(p\.price\), horsSeance: true \};/
      .test(fn), 'et la borne hors séance');
    Fixture.poser();
    const j = dayPerformance();
    pres(j.eur, j.lignes.reduce((s, l) => s + l.eur, 0),
      'le total reste la somme de ses parts');
  });
});

suite('Un mur n’est pas de la pierre papier', () => {

  const ligne = (id, classe, valeur, extra) => ({ id, classe, libelle: classe,
    valeur, prixDeRevient: valeur, quantite: 1, dateAcquisition: '', ...(extra || {}) });
  const compte = (id, type, lignes, cash) => ({ id, etabId: 'e', type, statut: 'ouvert',
    libelle: id, court: id, ouvertLe: '2020-01-01', numero: '', notes: '', alloc: '',
    cash: cash || [], lignes: lignes || [] });

  const APPART = v => compte('c_immo', 'immo',
    [ligne('l_a', 'immobilier', v, { usage: 'locative' })]);
  const SCPI = v => compte('c_scpi', 'scpi', [ligne('l_s', 'immobilier', v)]);
  const ETF = v => compte('c_cto', 'cto', [ligne('l_e', 'actions', v)]);
  const CASH = v => compte('c_bq', 'courant', [], [{ montant: v, affectation: 'courant' }]);
  const MONTRE = v => compte('c_bv', 'bienValeur', [ligne('l_m', 'bienValeur', v)]);
  const AV = (g, a, i) => compte('c_av', 'av', [ligne('l_g', 'garanti', g),
    ligne('l_x', 'actions', a), ligne('l_i', 'immobilier', i)]);
  const PER = i => compte('c_per', 'per', [ligne('l_p', 'immobilier', i)]);

  const poser = ({ comptes = [], dettes = [], positions = [] } = {}) => {
    Fixture.poser(s => {
      s.etabs = [{ id: 'e', nom: 'Banque', notes: '', dettes }];
      s.comptes = comptes;
      s.positions = positions;
      s.monthly = [];
      Object.assign(s.meta, { projScenario: 'central', projInflation: 0, projTarget: 0,
        projHorizon: 20, projMonthly: 0, projMonthlyZeroLu: true });
    });
    refreshAccounts();
  };

  const somme = xs => xs.reduce((s, x) => s + num(x.value), 0);

  /* --- 1. la frontiere elle-meme ---------------------------------------- */

  test('la question se pose une fois, et sur le contenant', () => {
    /* La table entiere, type par type : c'est elle qui decide, et une seule
       fonction la lit. Un `type === 'scpi'` recopie ailleurs aurait laisse le
       prochain support de pierre papier du mauvais cote. */
    const dehors = TYPES_COMPTE.filter(t => estHorsPerimetreFinancier({ type: t.id }))
      .map(t => t.id);
    eq(dehors.join(','), 'immo,bienValeur',
      'un appartement et un bien de valeur sortent, et eux seuls');
    for (const type of ['scpi', 'av', 'per', 'cto', 'pea', 'courant', 'livret'])
      eq(estHorsPerimetreFinancier({ type }), false, `${type} reste dans le périmètre`);
    /* Un type inconnu — cree par son detenteur, ou herite d'une migration —
       reste financier : on n'invente pas un mur. */
    eq(estHorsPerimetreFinancier({ type: 'levier' }), false,
      'un type inconnu ne devient pas un mur par défaut');
  });

  test('les drapeaux de la SCPI ne bougent pas', () => {
    /* La tentation etait de lui poser `direct: true` pour la faire passer. Elle
       aurait alors recu le questionnaire d'un appartement : usage, adresse,
       surface, lots, loyers. La frontiere physique est utile ailleurs, et elle
       reste ou elle est. */
    const t = typeCompte('scpi');
    eq(!!t.bienImmo, true, 'une SCPI pèse comme de la pierre');
    eq(!!t.direct, false, 'et ne se détient pas en direct');
    eq(estDetenuEnDirect(t), false, 'le prédicat le dit aussi');
    poser({ comptes: [SCPI(100000)] });
    eq(estBienEnDirect(compteById('c_scpi')), false, 'donc ce n’est pas un bien en direct');
    eq(usageEffectifBien(compteById('c_scpi')).source, 'inconnu',
      'et on ne lui demande pas si on l’habite');
  });

  /* --- 2. les scenarios, un par un -------------------------------------- */

  test('une SCPI seule est un patrimoine financier entier', () => {
    poser({ comptes: [SCPI(100000)] });
    pres(patrimoine().brut, 100000, 'brut');
    pres(patrimoine().net, 100000, 'net');
    pres(totalFinancier(), 100000, 'avoirs financiers');
    pres(netFinancier(), 100000, 'patrimoine financier net');
    pres(horsFinancierTotal(), 0, 'rien n’est écarté');
    eq(horsFinancierExiste(), false,
      'et le commutateur Tout / Financier ne s’affiche pas : il ne retirerait rien');
    const cls = repartitionClasses({ financier: true });
    pres(somme(cls), 100000, 'la répartition par classe fait les avoirs');
    pres(num(cls.find(c => c.classe === 'immobilier')?.value), 100000,
      'sous la classe Immobilier, qui désigne ici la pierre papier');
    pres(capitalisation({ years: 20 }).points[0].total, 100000, 'projection t0');
  });

  test('un appartement seul n’est pas un patrimoine financier', () => {
    poser({ comptes: [APPART(300000)] });
    pres(patrimoine().brut, 300000, 'brut');
    pres(totalFinancier(), 0, 'aucun avoir financier');
    pres(horsFinancierTotal(), 300000, 'tout est écarté');
    eq(horsFinancierExiste(), true, 'et le commutateur a un sens');
    const q = pochesProjection();
    pres(q.plat, 300000, 'la projection le porte à plat');
    pres(q.placees, 0, 'et rien ne capitalise');
  });

  test('un appartement et une SCPI ne partent pas du même côté', () => {
    poser({ comptes: [APPART(300000), SCPI(100000)] });
    pres(patrimoine().brut, 400000, 'le patrimoine global les porte tous deux');
    pres(totalFinancier(), 100000, 'la SCPI, et elle seule, est un avoir financier');
    pres(horsFinancierTotal(), 300000, 'le mur, et lui seul, est écarté');
    const q = pochesProjection();
    pres(q.plat, 300000, 'le mur est gelé');
    pres(q.autres, 100000, 'la SCPI est dans la poche sans hypothèse');
    pres(q.placees + q.plat, 400000, 'et chaque euro apparaît une fois');
    pres(capitalisation({ years: 20 }).points[0].total, 400000, 'projection t0');
  });

  test('le crédit du mur part avec le mur, la SCPI reste', () => {
    poser({ comptes: [APPART(300000), SCPI(100000)],
            dettes: [{ id: 'd_m', libelle: 'Prêt', montant: 200000, bienId: 'c_immo' }] });
    pres(patrimoine().net, 200000, 'patrimoine global net');
    pres(totalFinancier(), 100000, 'avoirs financiers');
    pres(dettesFinancieresTotal(), 0, 'le mortgage n’est pas une dette du périmètre');
    pres(netFinancier(), 100000, 'patrimoine financier net');
  });

  test('un crédit personnel, lui, reste financier', () => {
    poser({ comptes: [APPART(300000), SCPI(100000)],
            dettes: [{ id: 'd_m', libelle: 'Prêt', montant: 200000, bienId: 'c_immo' },
                     { id: 'd_p', libelle: 'Conso', montant: 20000 }] });
    pres(patrimoine().net, 180000, 'patrimoine global net');
    pres(totalFinancier(), 100000, 'avoirs financiers');
    pres(dettesFinancieresTotal(), 20000, 'seule la dette sans bien reste');
    pres(netFinancier(), 80000, 'patrimoine financier net');
  });

  test('une dette rattachée à une SCPI reste dans le périmètre', () => {
    /* Aucune heuristique : la SCPI n'est pas un bien en direct, donc rien ne
       sort avec elle. `detteLieeBienDirect` lit le lien et le mode de detention,
       jamais un libelle. */
    poser({ comptes: [SCPI(100000)],
            dettes: [{ id: 'd_s', libelle: 'Prêt SCPI', montant: 20000, bienId: 'c_scpi' }] });
    pres(dettesFinancieresTotal(), 20000, 'elle compte comme dette financière');
    pres(totalFinancier(), 100000, 'les avoirs ne bougent pas');
    pres(netFinancier(), 80000, 'et le net financier la retranche');
  });

  test('une assurance-vie qui porte de l’immobilier reste entière', () => {
    /* LE DEFAUT, dans sa forme la plus chere : le contrat vaut cent mille, la
       page en annonçait cinquante. La ligne immobiliere disparaissait des
       avoirs financiers, du camembert et de la base des pourcentages. */
    poser({ comptes: [AV(20000, 30000, 50000)] });
    pres(totalFinancier(), 100000, 'le contrat entier');
    pres(horsFinancierTotal(), 0, 'rien n’en sort');
    const cls = repartitionClasses({ financier: true });
    pres(somme(cls), 100000, 'la somme des classes fait les avoirs');
    pres(num(cls.find(c => c.classe === 'immobilier')?.value), 50000,
      'et le support immobilier a sa part');
    pres(num(cls.find(c => c.classe === 'garanti')?.value), 20000, 'le fonds euros aussi');
    const q = pochesProjection();
    pres(q.garanti, 20000, 'le fonds euros garde son taux');
    pres(q.marche, 30000, 'le fonds actions garde le sien');
    pres(q.autres, 50000, 'et le support immobilier n’en reçoit aucun');
    pres(q.plat, 0, 'rien n’est gelé comme un mur');
  });

  test('un PER qui porte de l’immobilier, de même', () => {
    poser({ comptes: [PER(50000)] });
    pres(totalFinancier(), 50000, 'le plan entier');
    pres(pochesProjection().plat, 0, 'aucune part gelée');
    pres(pochesProjection().autres, 50000, 'le support est un avoir financier');
  });

  test('un bien de valeur reste dehors', () => {
    /* La convention ne change pas : une montre est chez soi, on ne l'arbitre
       pas. Elle est `direct` comme un appartement, et sort par la même porte. */
    poser({ comptes: [MONTRE(10000), ETF(50000)] });
    pres(totalFinancier(), 50000, 'seul l’ETF est financier');
    pres(horsFinancierTotal(), 10000, 'la montre est écartée');
    pres(pochesProjection().plat, 10000, 'et portée à plat');
  });

  test('un ETF de foncières suit son chemin de position, pas celui d’une SCPI', () => {
    /* La preuve vient du modele et non du nom : `POCHE_DE_CLASSE` range
       `immobilierCote` dans `actions`, donc un REIT est un actif de marche. Rien
       ici ne regarde un libelle, un ticker ni un ISIN. */
    poser({ comptes: [compte('c_cto', 'cto', [])],
            positions: [{ id: 'p1', name: 'ETF Foncières', isin: '', symbol: 'REIT',
              currency: 'EUR', qty: 100, buyPrice: 100, price: 100, fx: 1, fxBuy: 1,
              account: 'c_cto', manual: false, assetClass: 'immobilierCote', role: 'core' }] });
    pres(totalFinancier(), 10000, 'il est financier');
    pres(patrimoine().classes.actions, 10000, 'et compte dans les actifs de marché');
    pres(patrimoine().classes.immobilier, 0, 'jamais dans la classe immobilier');
    pres(pochesProjection().marche, 10000, 'la projection lui applique le taux du marché');
    pres(pochesProjection().autres, 0, 'et non celui des actifs sans hypothèse');
  });

  /* --- 3. les invariants ------------------------------------------------ */

  test('ce qui reste et ce qui part recomposent toujours le brut', () => {
    /* Deux calculs independants : l'un somme les classes des comptes qui
       restent, l'autre somme la valeur des comptes qui sortent. Ils ne se
       derivent pas l'un de l'autre, donc leur accord prouve quelque chose. */
    const cas = [
      { nom: 'SCPI seule', comptes: [SCPI(100000)] },
      { nom: 'appartement seul', comptes: [APPART(300000)] },
      { nom: 'les deux', comptes: [APPART(300000), SCPI(100000)] },
      { nom: 'tout', comptes: [APPART(300000), SCPI(100000), ETF(50000),
                               CASH(20000), MONTRE(10000), AV(20000, 30000, 50000)] },
    ];
    for (const c of cas) {
      poser({ comptes: c.comptes });
      pres(totalFinancier() + horsFinancierTotal(), patrimoine().brut,
        `${c.nom} : les deux périmètres font le brut`);
    }
  });

  test('chaque euro reçoit une classification de projection, et une seule', () => {
    poser({ comptes: [APPART(300000), SCPI(100000), ETF(50000), CASH(20000),
                      MONTRE(10000), AV(20000, 30000, 50000)],
            dettes: [{ id: 'd_m', libelle: 'Prêt', montant: 200000, bienId: 'c_immo' }] });
    const q = pochesProjection();
    /* Les poches nommees une a une : une somme globale passerait si deux poches
       se partageaient les memes euros en s'annulant. */
    pres(q.marche, 80000, 'ETF et fonds actions');
    pres(q.autres, 150000, 'la SCPI et le support immobilier du contrat');
    pres(q.garanti, 20000, 'le fonds euros');
    pres(q.liquidites, 20000, 'le cash');
    pres(q.projet, 0, 'rien n’est réservé');
    pres(q.plat, 110000, 'le mur et la montre, moins le prêt');
    pres(q.placees + q.plat, patrimoine().net, 'la somme fait le patrimoine net');
    pres(q.placees, totalFinancier(), 'et ce qui capitalise est exactement le périmètre financier');
  });

  test('l’allocation se réconcilie, carte par carte', () => {
    poser({ comptes: [APPART(300000), SCPI(100000), ETF(50000), CASH(20000)] });
    pres(totalFinancier(), 170000, 'avoirs financiers : 100 000 + 50 000 + 20 000');
    const cls = repartitionClasses({ financier: true });
    pres(somme(cls), 170000, 'par classe');
    pres(num(cls.find(c => c.classe === 'immobilier')?.value), 100000, 'Immobilier : la SCPI');
    pres(num(cls.find(c => c.classe === 'actions')?.value), 50000, 'Actifs de marché : l’ETF');
    pres(num(cls.find(c => c.classe === 'liquidites')?.value), 20000, 'Liquidités : le cash');
    eq(cls.some(c => c.classe === 'bienValeur'), false, 'aucune ligne de biens de valeur');
    const cpt = allocationByAccount({ financier: true });
    pres(somme(cpt), 170000, 'par compte');
    eq(cpt.some(r => r.id === 'c_immo'), false, 'l’appartement n’a pas de ligne');
    eq(cpt.some(r => r.id === 'c_scpi'), true, 'la SCPI en a une');
    pres(somme(byAccountType({ financier: true })), 170000, 'par type de détention');
    pres(somme(allocationParDisponibilite({ financier: true })), 170000, 'par disponibilité');
    pres(somme(allocationByAsset({ credits: false, financier: true })), 170000, 'par ligne');
    pres(somme(poidsPoches({ financier: true })), 170000, 'et par poche du patrimoine');
    /* La poche `immo` reste, reduite a sa pierre papier : la retirer aurait fait
       une carte dont les parts ne font pas la base annoncee au-dessus d'elles. */
    pres(num(poidsPoches({ financier: true }).find(p => p.key === 'immo')?.value), 100000,
      'la poche Immobilier porte la SCPI');
  });

  test('le mode Tout ne change pas de sens', () => {
    poser({ comptes: [APPART(300000), SCPI(100000), ETF(50000), CASH(20000)],
            dettes: [{ id: 'd_m', libelle: 'Prêt', montant: 200000, bienId: 'c_immo' }] });
    pres(patrimoine().brut, 470000, 'le brut porte tout');
    pres(dettesTotal(), 200000, 'et toutes les dettes');
    pres(patrimoine().net, 270000, 'le net global');
    pres(somme(repartitionClasses({ net: true })), 270000,
      'la répartition globale fait le net, dette comprise');
    pres(somme(poidsPoches({ net: true })), 270000, 'et les poches aussi');
  });

  test('la disponibilité d’une SCPI ne change pas', () => {
    /* Entrer dans le perimetre financier ne rend rien liquide : le delai de
       sortie vient du type et de la classe, et ces deux-la n'ont pas bouge. */
    poser({ comptes: [SCPI(100000)] });
    const avant = mobiliteLigne(lignesDe(compteById('c_scpi'))[0], compteById('c_scpi'));
    eq(avant, mobilisabilite('immobilier', 'scpi'),
      'sa mobilisabilité vient de sa classe et de son type, comme avant');
    const dispo = allocationParDisponibilite({ financier: true });
    pres(somme(dispo), 100000, 'et elle apparaît une fois dans les paliers');
    eq(num(dispo.find(d => d.cle === 'immediat')?.value), 0,
      'jamais en disponible tout de suite');
  });

  test('la base des cibles ne dépend pas de ce périmètre', () => {
    /* Elle se calcule sur les POSITIONS de marche, jamais sur les lignes
       saisies a la main : une SCPI n'y entrait pas hier et n'y entre pas
       aujourd'hui. Le controle est ici pour que le lien soit dit, et non
       redecouvert la prochaine fois. */
    poser({ comptes: [SCPI(100000), CASH(20000)] });
    const sans = rebalanceRows().base;
    poser({ comptes: [SCPI(100000), CASH(20000), APPART(300000)] });
    pres(rebalanceRows().base, sans, 'ajouter un mur ne bouge pas la base des cibles');
  });

  /* --- 4. ce que la page en dit ----------------------------------------- */

  test('le texte nomme la pierre papier, dans les deux langues', () => {
    const src = lireSource('assets/app.js');
    vrai(/La pierre papier reste/.test(src),
      'l’aide du périmètre dit ce qui reste, pas seulement ce qui part');
    vrai(!/\bimmobilier et biens de valeur écartés, avec leurs crédits/.test(src),
      'et la mention courte ne promet plus que tout l’immobilier sort');
    for (const cle of Object.keys(I18N.en)) {
      if (!/La pierre papier reste/.test(cle)) continue;
      vrai(/Property investments stay/.test(I18N.en[cle]), 'traduite');
    }
    vrai(Object.keys(I18N.en).some(k => /La pierre papier reste/.test(k)),
      'la clef existe dans le dictionnaire');
    vrai(I18N.en['immobilier en direct et biens de valeur écartés, avec leurs crédits'],
      'la mention courte aussi');
    /* UNE CLEF DECALEE NE SE VOIT PAS. L'arbre prive portait la traduction de
       cette longue aide accrochee a la clef voisine : en anglais, la carte des
       delais de sortie rendait le perimetre entier, et le perimetre rendait un
       paragraphe d'une version disparue. Les deux etaient de l'anglais, donc
       aucun controle de langue ne les attrapait. Une phrase courte doit le
       rester : c'est ce qui distingue un couple droit d'un couple decale. */
    const dispo = I18N.en['Quand cet argent peut redevenir disponible.'];
    vrai(dispo && dispo.length < 80,
      `la clef voisine garde sa propre traduction, courte (${(dispo || '').length} caractères)`);
    vrai(!/property|valuables/i.test(dispo || ''),
      'et ne porte pas celle du périmètre');
  });

  test('la fiche de la part plate ne liste que ce qu’elle gèle', () => {
    /* Elle enumerait les lignes de classe `immobilier` : une SCPI y apparaissait
       sous « Ton immobilier net », dans une fiche dont le total est `partPlate()`
       — qui ne la porte plus. La somme des parts aurait cesse d'egaler le total. */
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('immobilierNet: (quoi) => {'),
                         src.indexOf('capaciteEpargne: () => {'));
    vrai(fn.length > 0, 'la fiche doit être trouvable');
    vrai(/if \(!estHorsPerimetreFinancier\(c\)\) continue;/.test(fn),
      'la fiche parcourt les comptes que le périmètre écarte');
    vrai(!/\['immobilier', 'bienValeur'\]\.includes/.test(fn),
      'et non les lignes d’une classe');
  });
});

suite('La vue financière retire les murs, et le total reste la somme de ses parts', () => {

  /* Le fixture porte un studio a 120 000 sur un brut de 138 250 : la base
     financiere vaut donc 18 250, verifiable de tete. Ces tests ne lisent aucune
     source, ils additionnent — c'est le seul controle qui aurait attrape le
     defaut du centre de l'anneau si le centre avait ete une fonction du modele
     plutot qu'une chaine de la vue. */
  const somme = xs => xs.reduce((s, x) => s + num(x.value), 0);

  test('ce qui reste et ce qui part recomposent le brut', () => {
    Fixture.poser();
    pres(horsFinancierTotal(), 120000, 'le studio du fixture, et lui seul');
    pres(totalFinancier(), 18250, 'le brut moins le studio');
    pres(totalFinancier() + horsFinancierTotal(), patrimoine().brut,
      'les deux moities doivent refaire le brut, sinon un euro se perd entre les vues');
  });

  test('chaque source de la page totalise la base financière', () => {
    Fixture.poser();
    const base = totalFinancier();
    pres(somme(repartitionClasses({ financier: true })), base, 'par classe d’actif');
    pres(somme(allocationByAsset({ credits: false, financier: true })), base, 'ligne par ligne');
    pres(somme(allocationByAccount({ financier: true })), base, 'par compte');
    pres(somme(byAccountType({ financier: true })), base, 'par enveloppe');
    /* Absente de la demonstration : la carte des delais n'y a jamais ete portee. */
    if (typeof allocationParDisponibilite === 'function') {
      pres(somme(allocationParDisponibilite({ financier: true })), base, 'par disponibilité');
    }
  });

  test('« Placé » perd les murs, et le cash le complète jusqu’à la base', () => {
    /* « Place » vaut le brut moins le cash : il ne se filtre pas par classe, il
       se retranche. Sans ca, cette seule ligne valait 131 750 sur une base de
       18 250 et sa barre sortait de la carte. */
    Fixture.poser();
    const t = nowTotals();
    const place = t.invested - horsFinancierTotal();
    pres(place, 11750, 'le place moins le studio');
    pres(place + (t.brut - t.invested), totalFinancier(),
      'le placé et le cash doivent refaire la base financière, à l’euro près');
  });

  test('aucune part ne dépasse sa base ni ne passe sous zéro', () => {
    /* Le defaut se voit a l'ecran avant de se lire : une barre qui sort de la
       carte, un pourcentage a 723 %. */
    Fixture.poser();
    const base = totalFinancier();
    for (const liste of [repartitionClasses({ financier: true }),
                         byAccountType({ financier: true }),
                         allocationByAccount({ financier: true })]) {
      for (const x of liste) {
        vrai(num(x.value) >= -0.005 && num(x.value) <= base + 0.005,
          `« ${x.label} » vaut ${num(x.value).toFixed(2)} sur une base de ${base.toFixed(2)}`);
        if (x.pct !== undefined) {
          vrai(num(x.pct) <= 100.005, `« ${x.label} » annonce ${num(x.pct).toFixed(1)} %`);
        }
      }
    }
  });

  test('sans le commutateur, rien ne change', () => {
    /* Le filtre est un ajout, pas un remplacement : la vue par defaut doit
       rendre exactement ce qu'elle rendait. */
    Fixture.poser();
    pres(somme(repartitionClasses()), patrimoine().brut, 'les classes en vue complète');
    pres(poches().classes.immobilier, 120000, 'poches() porte encore les murs par défaut');
    pres(poches({ financier: true }).classes.immobilier, 0, 'et les écarte sur demande');
    /* Le studio du fixture n'est pas declare residence principale : son palier
       depend donc du type de compte, et l'ecrire ici creerait une deuxieme
       source de verite. La somme des paliers, elle, doit valoir le brut — puis
       la base financiere. C'est le meme controle, sans le pari. */
    const paliers = o => Object.values(o).reduce((s, v) => s + num(v), 0);
    pres(paliers(poches().mobilisable), patrimoine().brut,
      'les paliers de disponibilité doivent refaire le brut');
    pres(paliers(poches({ financier: true }).mobilisable), totalFinancier(),
      'et la base financière une fois les murs écartés');
  });

  test('le commutateur ne s’offre que s’il retire quelque chose', () => {
    Fixture.poser();
    vrai(horsFinancierExiste(), 'le fixture porte un studio, donc le choix existe');
    /* Le meme patrimoine sans mur : les deux vues donneraient la meme page, et
       proposer le choix serait proposer rien. */
    for (const c of Store.state.comptes) {
      if (c.type === 'immo') c.lignes = [];
    }
    refreshAccounts();
    eq(horsFinancierExiste(), false,
      'sans mur ni objet de valeur, le commutateur doit se taire');
  });
});

/* ------------------------------------------------------------------
   Aujourd'hui : Net / Brut valorise, Financier / Global cadre
   ------------------------------------------------------------------ */
suite('Deux réglages, deux questions, et ils ne se marchent pas dessus', () => {

  /* La page portait deux notions que rien ne distinguait a l'ecran : COMMENT le
     patrimoine est valorise -- net ou brut -- et QUEL PERIMETRE la courbe montre.
     Deux commutateurs Net / Brut coexistaient, celui du grand chiffre et celui du
     graphique, sur une seule variable : deux boutons identiques a deux endroits,
     dont on pouvait croire qu'ils reglaient deux choses.

     Le second est parti. La place libre porte le seul reglage qui appartienne en
     propre a cette carte, le perimetre, et le fixture le mesure de tete :

       Liquidités          6 500     |  Financier   18 250
       Actifs de marché    9 750     |  Studio     120 000
       Non coté            2 000     |  Brut       138 250
                                     |  Crédit      40 000
                                     |  Net global  98 250   */

  const auj = pts => pts[pts.length - 1];
  const perimetre = (net, financier) => auj(pointsEvolution({ net, financier }));

  test('les quatre combinaisons donnent quatre chiffres justes', () => {
    Fixture.poser();
    pres(perimetre(true,  true).total,  18250, 'Financier net');
    pres(perimetre(false, true).total,  18250, 'Financier brut');
    pres(perimetre(true,  false).total, 98250, 'Global net');
    pres(perimetre(false, false).total, 138250, 'Global brut');
    /* Et la serie par defaut, avec son point du jour, s'accroche au chiffre que
       le reste de la page annonce. La carte d'evolution, elle, finit au dernier
       releve (`aujourdhui: false`). */
    pres(perimetre(false, false).total, patrimoine().brut, 'le brut du bandeau');
    pres(perimetre(true, false).total, patrimoine().net, 'le net du bandeau');
    pres(perimetre(true, true).total, totalFinancier(),
      'la base financière de la page Allocation');
  });

  test('le crédit immobilier ne se déduit jamais de la vue financière', () => {
    /* La regle, et c'est une regle de justesse. Le fixture porte 18 250 EUR
       d'avoirs financiers, un studio de 120 000 et un pret de 40 000 sur le
       studio. Retrancher ce pret d'un perimetre dont on vient de retirer les murs
       donnerait -21 750 EUR : un patrimoine financier negatif chez quelqu'un qui
       n'a aucune dette financiere. Le chiffre serait faux, et faux du cote qui
       alarme.

       Une dette ne declare pas l'actif qu'elle finance dans ce modele : elle vit
       sur un etablissement, sans lien vers le compte ni vers la ligne. Tant que
       ce lien n'existe pas, le financier net vaut le financier brut, et c'est
       preferable a une deduction inventee. */
    Fixture.poser();
    pres(patrimoine().dettes, 40000, 'le fixture porte bien un crédit');
    pres(perimetre(true, true).total, perimetre(false, true).total,
      'Financier net et Financier brut doivent donner le même montant');
    pres(perimetre(true, true).total, 18250,
      'et ce montant est celui des avoirs financiers');
    /* Le global, lui, le retranche, et c'est le seul endroit ou il le fait. */
    pres(perimetre(false, false).total - perimetre(true, false).total, 40000,
      'le global net soustrait exactement le crédit');
  });

  test('une dette de courtier ne se déduit pas non plus, faute de lien déclaré', () => {
    /* Le cas que le modele NE SAIT PAS traiter, epingle pour qu'on sache
       exactement ce qui manquerait le jour ou on voudra le traiter.

       Une marge de courtier ou un credit lombard sont des dettes financieres :
       elles devraient se retrancher du perimetre financier. Elles ne le font pas,
       parce qu'une dette ne porte que le nom de son etablissement, et le meme
       etablissement peut tenir le pret immobilier et le compte titres. Deviner
       par le libelle serait une convention de plus que rien ne verifie.

       Ce test ne demande donc pas la deduction : il fige l'etat des lieux et
       nomme la donnee manquante. Le jour ou une dette declarera son actif, il
       tombera, et c'est le signal qu'on attend de lui. */
    Fixture.poser(e => {
      e.etabs.find(x => x.id === 'e_courtier').dettes.push(
        { id: 'd_marge', libelle: 'Marge', montant: 5000, note: '' });
    });
    pres(patrimoine().dettes, 45000, 'les deux dettes comptent dans le patrimoine');
    pres(perimetre(true, true).total, 18250,
      'la vue financière reste sur les avoirs : aucune dette ne déclare son actif');
    /* La donnee qui manque, nommee : aucune dette ne porte de rattachement. */
    const champs = new Set(ETABS().flatMap(e => (e.dettes || []).flatMap(d => Object.keys(d))));
    for (const lien of ['compteId', 'ligneId', 'classe', 'actif']) {
      vrai(!champs.has(lien),
        `une dette porte « ${lien} » : le rattachement existe, la déduction financière doit suivre`);
    }
  });

  test('la vue financière ne garde pas les murs dans ses points', () => {
    /* Pas seulement masques a l'ecran : retires du point. Un total est la somme
       de ses parts, et un point qui porterait 120 000 EUR de murs sous un total
       de 18 250 le dementirait au premier lecteur venu. */
    Fixture.poser();
    for (const p of pointsEvolution({ net: true, financier: true })) {
      for (const cle of SERIES_HORS_FINANCIER) {
        vrai(!(cle in p), `le point de ${p.label} porte encore « ${cle} »`);
      }
      pres(pochesEvolution({ financier: true }).reduce((s, c) => s + num(p[c]), 0),
        num(p.total), `la pile de ${p.label} doit faire son total`);
    }
    /* Et le global les garde, sans quoi le commutateur ne commuterait rien. */
    pres(num(auj(pointsEvolution({ net: false, financier: false })).immo), 120000,
      'le studio revient en vue globale');
  });

  test('les liquidités et les placements traversent le filtre intacts', () => {
    /* Ce que la vue financiere retire est nomme ; tout le reste doit passer sans
       une egratignure. Le controle porte poche par poche plutot que sur le seul
       total : deux erreurs qui se compensent feraient un total juste. */
    Fixture.poser();
    const g = auj(pointsEvolution({ net: false, financier: false }));
    const f = auj(pointsEvolution({ net: false, financier: true }));
    for (const cle of pochesEvolution({ financier: true })) {
      pres(num(f[cle]), num(g[cle]), `la poche « ${cle} » ne doit pas bouger`);
    }
    pres(num(f.cash), 6500, 'les liquidités du fixture');
    pres(num(f.bourse), 9750, 'les actifs de marché, métaux compris');
    pres(num(f.pe), 2000, 'le non coté reste : on choisit d’y remettre ou non');
  });

  test('la légende ne peut annoncer que des bandes tracées', () => {
    /* Les points et les bandes se filtrent par la MEME fonction. Deux filtres
       ecrits separement auraient fini par annoncer en legende une bande absente
       du dessin, ou l'inverse : c'est le defaut que ce depot corrige sans arret. */
    Fixture.poser();
    eq(pochesEvolution({ financier: true }).join(','), 'cash,bourse,crypto,pe,garanti',
      'la vue financière garde cinq poches, dans l’ordre de la pile');
    eq(pochesEvolution().join(','), POCHES_EVOLUTION.join(','),
      'et la vue globale les garde toutes');
    const src = lireSource('assets/app.js');
    vrai(/function seriesUtiles\(points, \{ financier = false \} = \{\}\) \{/.test(src),
      'seriesUtiles prend le périmètre');
    vrai(/const gardees = pochesEvolution\(\{ financier \}\);/.test(src),
      'et il vient de pochesEvolution, la même que celle des points');
    /* Un seul appel calcule les deux, pour la carte et pour le montage. */
    vrai(/function evolutionAffichee\(\)/.test(src),
      'la carte et le graphique partagent un appel');
    eq((src.match(/evolutionAffichee\(\)/g) || []).length, 3,
      'sa définition, la carte, le montage : jamais un quatrième calcul parallèle');
  });

  test('l’échelle se recalcule sur les bandes tracées, jamais sur le patrimoine entier', () => {
    /* C'est le but meme de la vue : l'immobilier pese 87 % du fixture, et sa
       bande ecrase les quatre autres. L'echelle du graphique se derive des series
       qu'on lui passe, donc retirer l'immobilier de la liste suffit, sans qu'un
       seul chiffre soit force cote application. */
    Fixture.poser();
    const chartsSrc = lireSource('assets/charts.js');
    vrai(/const totals = points\.map\(p => series\.reduce\(/.test(chartsSrc),
      'le total tracé se dérive des séries reçues');
    vrai(/const maxV = Math\.max\(\.\.\.totals/.test(chartsSrc),
      'et le maximum de l’axe se dérive de ces totaux');
    /* Le rapport d'echelle, mesure : sept fois et demie plus bas. Sans lui, les
       variations financieres tiennent dans un huitieme de la hauteur. */
    const global = auj(pointsEvolution({ net: false, financier: false })).total;
    const financier = auj(pointsEvolution({ net: false, financier: true })).total;
    vrai(global / financier > 7,
      `l’échelle globale écrase la financière (${(global / financier).toFixed(1)} fois)`);
  });

  test('le périmètre du graphique ne touche à rien d’autre sur la page', () => {
    /* La question a laquelle la repartition repond -- de quoi le patrimoine est
       compose aujourd'hui -- est globale par nature. Cliquer Financier sur la
       courbe ne doit ni recalculer ses parts, ni changer le grand chiffre.

       Le controle porte sur la cause : `repartitionClasses` n'est jamais appelee
       avec le perimetre du graphique, et le grand chiffre ne le lit pas. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const sansCom = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    eq((sansCom.match(/repartitionClasses\(\{ net: evoNet \}\)/g) || []).length, 2,
      'la barre et la liste lisent le patrimoine complet, jamais le périmètre du graphique');
    vrai(!/repartitionClasses\([^)]*evoFinancier/.test(sansCom),
      'aucun appel ne passe evoFinancier à la répartition');
    vrai(/<div class="hero-value">\$\{fmtEUR0\(evoNet \? t\.total : t\.brut\)\}<\/div>/.test(sansCom),
      'le grand chiffre suit Net / Brut et rien d’autre');
    vrai(!/allocFinancier = evoFinancier/.test(sansCom),
      'et le commutateur d’Allocation ne se branche pas dessus');
  });

  test('il n’y a plus qu’un commutateur Net / Brut, et il est en haut', () => {
    const src = lireSource('assets/app.js');
    const sansCom = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    vrai(!sansCom.includes('evo-base'),
      'la bascule Net / Brut du graphique est partie, action comprise');
    eq((sansCom.match(/data-action="hero-base"/g) || []).length, 2,
      'les deux boutons du seul commutateur, dans la grande carte');
    eq((sansCom.match(/'hero-base'\(btn\)/g) || []).length, 1,
      'et une seule action pour eux');
    /* La courbe herite : elle lit la variable de la page, elle n'en a pas une. */
    vrai(/pointsEvolution\(\{ net: evoNet, financier: evoFinancier, aujourdhui: false \}\)/.test(sansCom),
      'la courbe lit le Net / Brut de la page');
    eq((sansCom.match(/\bevoNet = /g) || []).length, 2,
      'une déclaration et un seul geste qui l’écrit');
  });

  test('le graphique s’ouvre sur Financier', () => {
    /* Le defaut est le coeur du reglage : sans lui, personne ne decouvre que la
       courbe peut montrer autre chose qu'un mur. */
    const src = lireSource('assets/app.js');
    vrai(/let evoFinancier = true;/.test(src), 'Financier à l’ouverture');
    vrai(/let evoNet = true;/.test(src), 'et Net, comme le reste de la page');
    /* Il ne s'enregistre pas : un reglage de lecture vit le temps d'une session,
       comme le commutateur d'Allocation. */
    const action = src.slice(src.indexOf("'evo-perimetre'(btn)"),
                             src.indexOf("'evo-perimetre'(btn)") + 200);
    vrai(!/Store\.save/.test(action), 'et le clic n’écrit rien dans les données');
    vrai(!/evoFinancier/.test(lireSource('assets/store.js') || ''),
      'ce drapeau ne touche pas au modèle : store.js reçoit un argument, pas un état');
  });

  test('deux familles de contrôles segmentés, et une seule déclaration chacune', () => {
    /* Cette application a deux natures de controle segmente, et elles ne
       demandent pas la meme presence.

       La NAVIGATION — « Aujourd'hui | Historique | Projection », « Depenses |
       Charges fixes » — porte `.sous-onglets` : une barre qu'on vise.

       Les FILTRES DE VUE — Net / Brut, Financier / Global, les plages, le tri
       d'un journal, un filtre de role — portent `.seg-mini` : un etat qu'on
       choisit dans une carte, a cote d'un titre. « Choisir un etat » n'a pas le
       poids de « declencher une action », et c'est ce que l'ecart doit dire.

       Mesure apres harmonisation, hauteur du controle entier :

         navigation      36 px sur grand ecran, 40 sur telephone
         filtre de vue   31 px sur grand ecran, 35 sur telephone

       Les trois filtres de l'accueil sont au pixel identiques, ce qui n'etait pas
       le cas : la barre des plages avait sa propre regle. Cible au doigt : 33 px
       sur grand ecran et 37 sur telephone, pour 25 et 29 a l'oeil — le debord est
       pose en absolu, il n'occupe aucune place. */
    const css = lireSource('assets/styles.css');
    const app = lireSource('assets/app.js');
    vrai(css && app, 'les deux fichiers doivent être lisibles');

    /* 1. Les filtres partagent UNE declaration, et aucun n'a la sienne. */
    vrai(/^\.seg-mini button \{/m.test(css), 'la famille compacte est déclarée');
    vrai(!/\.plage \.segmented button \{/.test(css),
      'la barre des plages n’a plus de règle à elle : elle rejoint la famille');
    /* Les plages se lisent dans `rangeControl`, ou le controle SUIT son
       conteneur ; les autres portent leur action DANS le controle, donc on
       remonte. Deux sens de lecture, et c'est le balisage qui les impose. */
    const plage = app.slice(app.indexOf('function rangeControl('),
                            app.indexOf('</div>`;', app.indexOf('function rangeControl(')));
    vrai(/class="segmented seg-mini"/.test(plage),
      '« plage » est un filtre de vue : il porte la famille compacte');
    for (const usage of ['evo-perimetre', 'hero-base', 'tri-ventes', 'filtrer-role']) {
      const i = app.indexOf(`data-action="${usage}"`);
      vrai(i > 0, `« ${usage} » doit être trouvable`);
      const avant = app.slice(Math.max(0, i - 700), i);
      const dernier = avant.lastIndexOf('class="segmented');
      vrai(dernier >= 0, `« ${usage} » doit vivre dans un contrôle segmenté`);
      vrai(avant.slice(dernier, dernier + 40).includes('seg-mini'),
        `« ${usage} » est un filtre de vue : il porte la famille compacte`);
    }

    /* 2. `.seg-mini` doit SUIVRE `.segmented`, sinon elle ne fait rien. C'est
       exactement ce qui s'est passe pendant des mois : declaree avant, a
       specificite egale, elle perdait, et trois controles la portaient en
       croyant obtenir une version reduite. */
    vrai(css.indexOf('.seg-mini button {') > css.indexOf('.segmented button {'),
      'la famille compacte suit celle qu’elle doit battre : c’est l’ordre qui tranche');

    /* 3. La cible du doigt est plus grande que le dessin. */
    vrai(/\.seg-mini button::after \{[^}]*inset: -4px;/.test(css),
      'le débord de la cible tactile est posé, et il ne peint rien');
    vrai(/\.seg-mini button \{[^}]*position: relative;/.test(css),
      'et son ancrage avec lui');

    /* 4. La hauteur des deux familles est POSEE, jamais subie. Deux fois elle
       l'etait : la pastille de rappel gonflait la boite de ligne de la
       navigation, et la bande collante l'etirait a sa propre hauteur. */
    vrai(/\.sous-onglets \.segmented button \{[^}]*min-height: 30px;/.test(css),
      'la navigation déclare sa hauteur');
    vrai(/\.sous-onglets \{[^}]*align-items: center;/.test(css),
      'et elle ne s’étire plus à la hauteur de la bande collante');
    vrai(/\.sous-onglets \.segmented button \{[^}]*line-height: 1\.25;/.test(css),
      'sa boîte de ligne ne dépend plus de ce que la pilule contient');

    /* 5. La navigation reste PLUS HAUTE que les filtres : c'est la hierarchie
       entiere de cette passe. Les deux valeurs se lisent dans la feuille. */
    const hNav = Number((css.match(/\.sous-onglets \.segmented button \{[^}]*min-height: (\d+)px/) || [])[1]);
    const padFiltre = Number((css.match(/\.seg-mini button \{[^}]*padding: (\d+)px/) || [])[1]);
    vrai(hNav >= 30, `la navigation garde de la présence (${hNav} px)`);
    vrai(padFiltre <= 6, `le filtre reste compact (${padFiltre} px de remplissage)`);

    /* 6. Et les vrais boutons ne bougent pas : un toggle choisit un etat, un
       bouton declenche une action, et rien de cette passe ne les touche. */
    vrai(!/\.btn \{[^}]*min-height/.test(css.slice(css.indexOf('.seg-mini button {'))),
      'aucune règle de cette passe ne redéfinit les boutons d’action');
  });

  test('les deux bascules vivent en haut à droite de leur carte', () => {
    /* L'intitule a gauche, SA bascule au bord droit. C'est la ou vivent les
       commandes dans toute l'application — les vingt-six en-tetes de carte y
       posent leurs boutons — et une bascule calee a gauche sous un titre se lit
       comme un sous-titre.

       Elle a d'abord ete posee sous l'intitule, a gauche, parce que l'en-tete du
       graphique s'y repliait deja. Le bord droit vaut mieux, et il vaut aux deux
       tailles d'ecran : une seule regle au lieu d'une par point de rupture.

       Mesure a 375 px : le grand chiffre pose « Net | Brut » a 208 px du bord de
       la carte, contre l'autre bord ; le graphique y pose « Financier | Global »
       de meme. Aucun debordement, aucune bascule comprimee. */
    const css = lireSource('assets/styles.css');
    vrai(css, 'la feuille de style doit être lisible');

    vrai(/\.hero-label > \.segmented \{ margin-left: auto; \}/.test(css),
      'la bascule du grand chiffre se cale au bord droit');
    /* Une seule regle, hors de tout bloc telephone : elle vaut partout. Dans ce
       fichier une regle de PREMIER NIVEAU commence en colonne 0, celles d'un
       bloc media sont indentees de deux espaces — l'ancrage suffit a le dire. */
    vrai(/^\.hero-label > \.segmented \{ margin-left: auto; \}/m.test(css),
      'et elle ne dépend pas d’un point de rupture');
    vrai(/\.evo-commandes \{ justify-content: flex-end; \}/.test(css),
      'les commandes du graphique se calent au même bord quand elles se replient');

    /* Le plancher de 9,8 em est parti, et il n'a plus d'objet : l'intitule ne
       change plus de longueur, et la bascule est ancree a droite. */
    vrai(!/min-width: 9\.8em/.test(css),
      'le plancher qui réservait la place de « PATRIMOINE BRUT » n’a plus d’objet');
    /* Les regles de l'ancienne convention sont parties avec elle. */
    vrai(!/\.hero-label > \.segmented \{[^}]*grid-row: 2;/.test(css),
      'la bascule n’est plus posée sous l’intitulé');

    const app = lireSource('assets/app.js');
    /* L'intitule ne dit plus que « Patrimoine » : le qualifier a cote d'une
       bascule qui dit lequel des deux repetait le bouton, et le mot changeait de
       longueur a chaque clic. */
    const hero = app.slice(app.indexOf('<div class="hero-label">'),
                           app.indexOf('<div class="hero-value">'));
    /* L'INTITULE NOMME LA GRANDEUR QU'IL SURMONTE.

       Il a dit « Patrimoine » tout court un temps, au motif que la bascule d'a
       cote disait deja lequel des deux. Le motif tenait devant l'ecran, le
       bouton actif sous les yeux ; il ne tient ni sur une capture, ni pour une
       synthese vocale qui lit la carte de haut en bas, ni pour un coup d'oeil
       de trois secondes. Deux mots disent si les credits sont deduits, et c'est
       la premiere chose a savoir sur le plus gros chiffre de l'application. */
    vrai(/<span>\$\{trad\(evoNet \? 'Patrimoine net' : 'Patrimoine brut'\)\}<\/span>/.test(hero),
      'l’intitulé suit la bascule');
    /* Sa longueur varie de nouveau, et cela ne coute rien : la bascule est
       ancree au bord droit, verifie plus haut, donc la fin du mot ne la
       deplace pas. */
    vrai(!/min-width/.test(hero), 'aucune largeur réservée à la main');

    /* L'oeil du masquage a quitte la carte : l'en-tete le porte sur telephone,
       la barre laterale sur grand ecran. Trois exemplaires a trente pixels les
       uns des autres n'encombrent plus la ligne. */
    vrai(!/hero-oeil/.test(app), 'l’œil a quitté la carte du patrimoine');
    vrai(!/hero-oeil/.test(css), 'et sa règle est partie avec lui');
    const html = lireSource('index.html');
    vrai(/id="btnMasqueEntete"[\s\S]{0,200}data-action="toggle-masque"/.test(html),
      'l’en-tête en porte un, celui du haut de l’écran');
    vrai(/id="btnMasque"[\s\S]{0,200}data-action="toggle-masque"/.test(html),
      'et la barre latérale aussi, pour les grands écrans');
    /* Le raccourci demeure : c'est lui qui rend le geste atteignable partout. */
    vrai(/'h'/.test(app) || /case 'h'/.test(app),
      'et le raccourci clavier reste');
  });

  test('l’aide du titre dit la différence, et ne peut pas mentir', () => {
    /* Les deux boutons portent chacun une infobulle, qui n'existe qu'au survol.
       Au doigt, l'explication etait donc inatteignable — et c'est precisement la
       que la difference des deux perimetres se devine le moins. La pastille vit
       sur le titre, ou elle la dit une fois, plutot que deux definitions
       separees qu'il faudrait rapprocher soi-meme. */
    const src = lireSource('assets/app.js');
    const carte = src.slice(src.indexOf('function carteEvolution()'),
                            src.indexOf('function monterEvolution()'));
    /* La pastille vit sur le titre, et elle y vit SI ET SEULEMENT SI la bascule
       y vit aussi : une aide qui explique la différence entre deux vues n'a
       rien à dire quand une seule existe. Les deux lisent le même booléen. */
    vrai(/<h2>\$\{trad\('Évolution du patrimoine'\)\}\$\{\s*\n\s*perimetreUtile \? aide\(trad\(AIDE_PERIMETRE\)\) : ''\}<\/h2>/.test(carte),
      'la pastille vit sur le titre de la carte, et seulement quand le périmètre se choisit');
    /* Ecrit une fois : l'infobulle des boutons et la pastille ne peuvent pas
       diverger si elles ne se recopient pas. */
    eq((src.match(/const AIDE_PERIMETRE/g) || []).length, 1,
      'le texte est écrit une seule fois');

    const texte = (src.match(/const AIDE_PERIMETRE = '([^']*)'/) || [])[1] || '';
    vrai(texte.length > 80, 'le texte doit être trouvable');
    for (const mot of ['Financier', 'Global']) {
      vrai(texte.includes(mot), `« ${mot} » doit être nommé : on lit une différence, pas une définition`);
    }
    vrai(I18N.en[texte], 'et la clef a sa traduction anglaise');

    /* Le controle qui compte. L'aide PROMET qu'en vue financiere la bascule
       net/brut ne bouge pas la courbe. Ce n'est vrai que tant que le code ne
       retranche aucune dette dans ce perimetre : le jour ou quelqu'un rattache
       les dettes aux poches, la phrase devient un mensonge affiche, et rien
       d'autre ne le dirait. Les deux vivent donc ensemble. */
    const store = lireSource('assets/store.js');
    vrai(/const retrancher = net && !financier;/.test(store),
      'la vue financière ne retranche aucune dette : c’est ce que l’aide promet');
    vrai(/const avecDettes = net && !financier;/.test(store),
      'et la répartition suit la même règle');
    vrai(/net et brut y donnent la même courbe/.test(texte),
      'l’aide dit cette conséquence, celle qu’on observe en basculant');
  });

  test('le périmètre vit sur la ligne du titre, les périodes sur la leur', () => {
    /* Les deux commandes ont partage un bloc, pour se replier ensemble. Elles ne
       repondent pourtant pas a la meme question — l'une dit QUOI on regarde,
       l'autre SUR QUELLE DUREE — et le bloc les faisait descendre toutes les deux
       sous le titre, dont la ligne restait vide.

       Separees, l'en-tete se comporte comme les vingt-cinq autres : titre a
       gauche, commande a droite. Mesure a 1440 px : la bascule finit au bord
       droit du contenu de la carte, sur la ligne du titre. A 375 px en francais,
       « Evolution du patrimoine » prend 179 des 311 px et la bascule en demande
       140 : elle passe a la ligne suivante, toujours contre le bord droit. En
       anglais, « Wealth over time » lui laisse la place et elle reste en haut.
       C'est le repli du flex qui en decide, pas une valeur ecrite a la main. */
    const src = lireSource('assets/app.js');
    const carte = src.slice(src.indexOf('function carteEvolution()'),
                            src.indexOf('function monterEvolution()'));
    vrai(carte.length > 500, 'la carte doit être trouvable');

    /* Le perimetre est un enfant DIRECT de l'en-tete, a cote du titre. */
    const tete = carte.slice(carte.indexOf('<div class="card-head">'),
                             carte.indexOf('<div class="evo-commandes">'));
    vrai(/trad\('Évolution du patrimoine'\)/.test(tete), 'le titre y est');
    vrai(/data-action="evo-perimetre"/.test(tete),
      'et le périmètre avec lui, sur la même ligne');
    vrai(!/rangeControl/.test(tete),
      'les périodes n’y sont pas : elles ne disent pas la même chose que le périmètre');

    /* Les periodes ont leur rangee, calee sur le meme bord. */
    const rangee = carte.slice(carte.indexOf('<div class="evo-commandes">'),
                               carte.indexOf('<div class="chart" id="chartEvo">'));
    vrai(/rangeControl\('evo-range', evoRange\)/.test(rangee), 'les périodes y sont');
    vrai(!/data-action="evo-perimetre"/.test(rangee), 'et le périmètre n’y est plus');

    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const debut = css.indexOf('.evo-commandes {');
    vrai(debut > 0, 'la règle de la rangée doit exister');
    const regle = css.slice(debut, css.indexOf('}', debut));
    vrai(/justify-content:\s*flex-end/.test(regle),
      'la rangée des périodes se cale sur le même bord que la bascule du dessus');

    /* Et l'en-tete se replie plutot que de comprimer : c'est ce qui rattrape le
       francais, ou le titre ne laisse pas la place. */
    const iTel = css.indexOf('@media (max-width: 900px)');
    vrai(/\.card-head \{ flex-wrap: wrap;/.test(css.slice(iTel)),
      'l’en-tête se replie sous 900 px, ce qui suffit quand le titre est long');
  });
});

finDePartieDeTests('tests/12-ecart-non-cote-se.tests.js');
