partieDeTests('tests/09-ligne-projection-annonce-taux.tests.js');
/* ------------------------------------------------------------------
   Une ligne de projection annonce le taux qu'elle subit vraiment
   ------------------------------------------------------------------ */
suite('Une ligne de projection annonce le taux qu’elle subit', () => {

  /* Le panneau Ce que tu as deja ne peut pas afficher un rendement sur la ligne
     Liquidites alors que le calcul les porte a plat : le chiffre serait juste,
     son explication fausse.

     Le defaut classique de cette base de code : deux listes du meme fait, dont
     une seule est tenue a jour. `pochesProjection()` sort les liquidites de la
     poche de marche et leur retire tout rendement ; une fiche qui garderait
     l'ancien decoupage leur collerait le taux du non cote.

     Rien de ce qui se voit a l'ecran ne le trahirait : le montant serait juste,
     le total aussi, et la somme des parts ferait le total. Seule la
     confrontation de l'etiquette au calcul l'attrape, et c'est ce que fait cette
     suite -- elle reconstruit la fiche depuis sa source, la joue sur le fixture,
     et demande a `capitalisation()` ce qu'elle fait reellement de chaque poche. */

  /* La fiche vit dans app.js, que le harnais ne charge pas. On l'en extrait et
     on l'exécute pour de vrai : une assertion sur ce qu'elle produit vaut mieux
     qu'une recherche de motif dans une chaîne. Seule `A_PLAT` lui manque, elle
     lui est passée en paramètre — depuis sa propre déclaration, pour qu'une
     phrase réécrite là-bas n'ait pas à l'être ici. */
  function fiche() {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    /* A_PLAT se traduit a sa declaration : la phrase francaise reste la clef,
       et c'est elle que la fiche recoit — les tests tournent en francais. */
    const phrase = src.match(/const A_PLAT = trad\('([^']+)'\)/);
    vrai(phrase, 'la phrase « à plat » doit vivre à un seul endroit, dans A_PLAT : '
      + 'recopiée, c’est l’un des exemplaires qui finit par mentir');
    const bloc = src.match(/\n  baseProjection: \(\) => \{[\s\S]*?\n  \},/);
    vrai(bloc, 'la fiche « Ce que tu as déjà » doit être trouvable dans APERCUS');
    const corps = bloc[0].replace(/\n  baseProjection: /, '').replace(/,\s*$/, '');
    return new Function('A_PLAT', `return (${corps})();`)(phrase[1]);
  }

  test('les liquidités ne portent aucun taux, parce qu’elles n’en subissent aucun', () => {
    /* Le cas type : un rendement des autres actifs a 8 %. */
    Fixture.poser(s => { s.meta.projRate = 5; s.meta.projRateAutres = 8; });
    const f = fiche();
    const liq = f.lignes.find(l => /Liquidit/.test(l.label));
    vrai(liq, 'la fiche doit porter une ligne de liquidités');
    vrai(!/%/.test(liq.meta),
      `la ligne des liquidités annonce « ${liq.meta} » alors que la projection ne `
      + 'leur applique aucun rendement');

    /* Et ce que fait vraiment le calcul, sur la même hypothèse : les liquidités
       traversent la projection sans produire un centime. C'est la moitié qui
       rend l'assertion ci-dessus autre chose qu'une opinion. */
    const d = capitalisation({ years: 10 }).points.at(-1);
    pres(d.gainsLiquidites, 0, 'les liquidités ne produisent rien sur dix ans');
    vrai(d.gainsAutres > 0, 'quand les autres actifs, eux, capitalisent bien à 8 %');
  });

  test('le taux annoncé par une ligne est celui que le calcul lui applique', () => {
    /* La règle, énoncée pour toutes les lignes plutôt que pour celle qui a
       cassé : une ligne qui affiche un pourcentage doit produire du gain, une
       ligne qui n'en affiche pas ne doit rien produire. Elle vaudra pour la
       poche qu'on ajoutera. */
    Fixture.poser(s => { s.meta.projRate = 5; s.meta.projRateAutres = 8; });
    const f = fiche();
    const d = capitalisation({ years: 10 }).points.at(-1);
    const gainDe = {
      'Actifs de marché': d.gainsMarche,
      'Autres actifs': d.gainsAutres,
      'Capital garanti': d.gainsGaranti,
      'Liquidités': d.gainsLiquidites,
      'Réservé à un projet': d.gainsLiquidites,
    };
    for (const l of f.lignes) {
      const gain = gainDe[l.label];
      vrai(gain !== undefined,
        `la ligne « ${l.label} » n’est rattachée à aucune poche du calcul : `
        + 'ajoute-la à la table de ce test, ou à capitalisation()');
      const annonce = /%/.test(l.meta);
      eq(annonce, gain > 0.005,
        `« ${l.label} » annonce « ${l.meta} » pour un gain de ${Math.round(gain)} € : `
        + 'un taux affiché doit produire quelque chose, et un gain nul ne doit pas '
        + 's’annoncer comme un rendement');
    }
  });

  test('la somme des parts fait le total de la fiche', () => {
    /* La règle du projet, sur la fiche qu'on vient de réécrire : retirer une
       ligne — « Cash à investir » est partie — ne doit pas laisser le total
       compter ce que plus aucune ligne ne montre. */
    Fixture.poser(s => { s.meta.projRateAutres = 8; });
    const f = fiche();
    pres(f.lignes.reduce((s, l) => s + l.valeur, 0), f.total,
      'la somme des lignes de « Ce que tu as déjà » fait son total');
    const q = pochesProjection();
    pres(f.total, q.placees,
      'et ce total est bien la base qui capitalise, immobilier à part');
  });
});

/* ------------------------------------------------------------------
   Un horizon, deux portes
   ------------------------------------------------------------------ */
suite('La projection n’a qu’un seul horizon', () => {

  /* Les deux menus par horizon de Projection sont correles : une seule
     variable, deux endroits qui l'ecrivent.

     Sans cela, ils regleraient deux choses differentes sous le meme nom : celui
     de l'en-tete poserait `meta.projHorizon`, celui du tableau nourrirait
     `projExtra`, une ligne libre que le graphique ignore. Deux valeurs rangees
     separement pour une seule question, c'est exactement ce que ce projet
     interdit ailleurs. */

  test('les deux sélecteurs de la page écrivent le même réglage', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    /* Aucune seconde variable d'horizon ne doit renaître. */
    vrai(!/^\s*let projExtra/m.test(src),
      'une seconde variable d’horizon est revenue : deux valeurs pour une seule '
      + 'question finissent toujours par se contredire à l’écran');

    /* Et les deux menus sortent du même générateur : deux gabarits recopiés
       auraient pu diverger sur la liste des durées, si bien qu'un choix fait
       dans l'un n'aurait eu aucune option correspondante dans l'autre. */
    /* Un seul `<select>` écrit à la main. L'attribut, lui, apparaît une seconde
       fois dans l'écouteur qui l'attrape : compter l'attribut nu aurait fait
       échouer ce test sur son propre câblage. */
    const gabarits = src.match(/<select data-action-change="proj-horizon"/g) || [];
    eq(gabarits.length, 1,
      `le sélecteur d’horizon est écrit ${gabarits.length} fois : il doit sortir `
      + 'de selecteurHorizon(), sinon les deux listes peuvent proposer des durées '
      + 'différentes pour un même réglage');
    const appels = src.match(/\$\{selecteurHorizon\(\)\}/g) || [];
    eq(appels.length, 2,
      `la page doit porter ses deux portes sur ce réglage, elle en a ${appels.length}`);

    /* L'écouteur écrit bien l'état, et le sauvegarde : un horizon qui ne
       survivrait pas au rechargement redeviendrait un réglage local. */
    vrai(/projHorizon = \+sel\.value;\s*\n?\s*Store\.save\(\); render\(\);/.test(src),
      'changer l’horizon doit écrire l’état et le sauvegarder');
  });

  test('l’horizon choisi a toujours sa ligne dans le tableau', () => {
    /* Ce qui rend la corrélation visible : régler 40 ans depuis le pied du
       tableau doit faire apparaître la ligne 40 ans dans ce même tableau. Sans
       cette garantie, le sélecteur du bas déplacerait le graphique sans que rien
       ne bouge à côté de lui. C'est `capitalisation()` qui la tient. */
    Fixture.poser();
    for (const h of [3, 25, 40, 80]) {
      const jalons = capitalisation({ years: h }).jalons.map(j => j.horizon);
      vrai(jalons.includes(h),
        `l’horizon ${h} ans doit avoir sa ligne dans le tableau : ${jalons.join(', ')}`);
      eq(jalons[jalons.length - 1], h,
        'et ce doit être la dernière, le tableau se lisant dans l’ordre du temps');
    }
  });
});

/* ------------------------------------------------------------------
   Toucher un graphique pour défiler n'ouvre pas son infobulle
   ------------------------------------------------------------------ */
suite('Un graphique ne prend pas le geste de défilement', () => {

  /* Le graphique de l'accueil n'ouvre pas son infobulle quand on le touche pour
     faire defiler la page : il faut un delai ou un seuil.

     Un premier contact qui poserait l'infobulle en poserait forcement une sous
     un doigt qui traverse un graphique de 300 px pour atteindre le bas de la
     page.

     Le geste vit dans `cablerInfobulle`, qui ne touche ni au DOM ni au temps
     autrement que par `setTimeout` : on l'extrait de sa source et on le joue
     avec un element et des minuteurs de comedie. Une assertion sur le
     comportement vaut mieux qu'une recherche de motif -- et celle-ci decrit
     exactement les quatre gestes qu'un doigt peut faire. */
  function geste() {
    const src = lireSource('assets/charts.js');
    vrai(src, 'assets/charts.js doit être lisible pour ce contrôle');
    const bloc = src.match(/\n  function cablerInfobulle\(cible, montrer, masquer\) \{[\s\S]*?\n  \}\n/);
    vrai(bloc, 'cablerInfobulle doit être trouvable dans charts.js');

    /* Le seuil et le délai viennent de leur propre déclaration : les réécrire
       ici en ferait une seconde source, et le test continuerait de passer sur
       des valeurs que le code n'a plus. */
    const seuil = +(src.match(/const SEUIL_GLISSE = (\d+)/) || [])[1];
    const delai = +(src.match(/const DELAI_APPUI = (\d+)/) || [])[1];
    vrai(seuil > 0 && delai > 0, 'le seuil et le délai du geste doivent être déclarés');

    /* Les minuteurs ne s'exécutent pas tout seuls : le harnais est synchrone, et
       un test qui attend vraiment 130 ms serait un test qui dort. Ils sont
       rangés, et `echoir()` les déclenche à la demande. */
    const enAttente = [];
    const poser = fn => enAttente.push(fn);
    const retirer = id => { if (id) enAttente[id - 1] = null; };
    const fabrique = new Function('setTimeout', 'clearTimeout', 'SEUIL_GLISSE', 'DELAI_APPUI',
      `${bloc[0]}\nreturn cablerInfobulle;`);
    const cabler = fabrique(poser, retirer, seuil, delai);

    const ecouteurs = {};
    const cible = {
      addEventListener: (nom, fn) => { (ecouteurs[nom] = ecouteurs[nom] || []).push(fn); },
      setPointerCapture: () => {},
    };
    const vu = [];
    cabler(cible, ev => vu.push({ quoi: 'montre', x: ev.clientX }), () => vu.push({ quoi: 'cache' }));

    return {
      vu, seuil,
      emettre: (nom, ev) => (ecouteurs[nom] || []).forEach(fn => fn(ev)),
      echoir: () => enAttente.forEach((fn, i) => { if (fn) { enAttente[i] = null; fn(); } }),
      montres: () => vu.filter(v => v.quoi === 'montre').length,
      caches: () => vu.filter(v => v.quoi === 'cache').length,
    };
  }

  const doigt = (x, y, plus) => Object.assign(
    { pointerType: 'touch', pointerId: 1, clientX: x, clientY: y, buttons: 1, pressure: 0.5 }, plus);

  test('un doigt qui part vers le bas n’ouvre rien, même après le délai', () => {
    const g = geste();
    g.emettre('pointerdown', doigt(100, 100));
    eq(g.montres(), 0, 'poser le doigt n’ouvre plus rien tout de suite');
    /* Franchement au-delà du seuil, et vers le bas : un défilement. */
    g.emettre('pointermove', doigt(101, 100 + g.seuil * 3));
    g.echoir();
    eq(g.montres(), 0,
      'le geste est parti en défilement : le minuteur en attente ne doit plus rien ouvrir');
  });

  test('le doigt tenu en place ouvre l’infobulle', () => {
    const g = geste();
    g.emettre('pointerdown', doigt(100, 100));
    g.echoir();
    eq(g.montres(), 1, 'un doigt immobile pendant le délai demande bien à lire');
  });

  test('un glissement horizontal ouvre sans attendre', () => {
    /* Parcourir la courbe est un geste franc, et il n'a rien à voir avec le
       défilement : le faire attendre un dixième de seconde se sentirait. */
    const g = geste();
    g.emettre('pointerdown', doigt(100, 100));
    g.emettre('pointermove', doigt(100 + g.seuil * 3, 102));
    eq(g.montres(), 1, 'un glissement franc vers le côté suffit, sans attendre le minuteur');
    g.emettre('pointermove', doigt(100 + g.seuil * 5, 104));
    eq(g.montres(), 2, 'et le curseur suit ensuite chaque mouvement');
  });

  test('la souris, elle, n’attend rien', () => {
    /* Un survol ne prend le geste de personne : lui imposer le même seuil
       rendrait le graphique poussif là où il n'y a aucun conflit. */
    const g = geste();
    g.emettre('pointerdown', doigt(100, 100, { pointerType: 'mouse' }));
    eq(g.montres(), 1, 'la souris ouvre au clic');
    g.emettre('pointermove', doigt(140, 100, { pointerType: 'mouse', buttons: 0, pressure: 0 }));
    eq(g.montres(), 2, 'et au simple survol, sans bouton enfoncé');
  });

  test('une infobulle ouverte survit à l’annulation du pointeur, une autre non', () => {
    /* Les deux moitiés du même événement, et c'est ce qui distingue ce correctif
       de celui du 5 août plutôt que de le défaire. Ouverte, l'infobulle reste :
       `touch-action: pan-y` fait annuler le pointeur au moindre tremblement, et
       on tient justement le doigt en place pour lire. Pas encore ouverte,
       l'annulation est le signal le plus sûr qui existe — le navigateur vient de
       décider que ce geste est un défilement. */
    const ouverte = geste();
    ouverte.emettre('pointerdown', doigt(100, 100));
    ouverte.echoir();
    ouverte.emettre('pointercancel', doigt(100, 108));
    eq(ouverte.caches(), 0, 'une infobulle ouverte ne part pas sur une annulation');

    const naissante = geste();
    naissante.emettre('pointerdown', doigt(100, 100));
    naissante.emettre('pointercancel', doigt(100, 104));
    naissante.echoir();
    eq(naissante.montres(), 0,
      'et une infobulle pas encore ouverte ne s’ouvre plus après l’annulation');
  });

  test('lever le doigt ferme, et désarme', () => {
    const g = geste();
    g.emettre('pointerdown', doigt(100, 100));
    g.emettre('pointerup', doigt(100, 100));
    g.echoir();
    eq(g.montres(), 0, 'un appui bref et levé n’ouvre rien après coup');
    eq(g.caches(), 1, 'et la levée referme');
  });

  test('les deux graphiques tactiles passent par le même geste', () => {
    /* La courbe d'évolution et la sparkline avaient chacune leur câblage, à cent
       lignes d'écart. Deux copies d'un geste, c'est une copie qu'on oublie de
       corriger. */
    const src = lireSource('assets/charts.js');
    const appels = src.match(/cablerInfobulle\((svg|el),/g) || [];
    eq(appels.length, 2,
      `les deux graphiques tactiles doivent partager ce geste (${appels.length} trouvé·s)`);
    /* Et sur le SVG, pas sur le conteneur : `mount` rejoue le rendu à chaque
       redimensionnement, et des écouteurs posés sur un élément qui lui survit
       s'empileraient à chaque fois. Les propriétés `on…` d'avant s'écrasaient et
       masquaient ce piège. */
    vrai(!/\bel\.onpointer(down|move|up|leave)\s*=/.test(src),
      'plus aucune propriété « onpointer… » : elles cachaient l’empilement '
      + 'd’écouteurs sur un conteneur qui survit au rendu');
  });
});

/* ------------------------------------------------------------------
   Ce qu'on efface n'a plus de champ obligatoire
   ------------------------------------------------------------------ */
suite('Une ligne sans nom se supprime quand même', () => {

  /* Une charge fixe sans nom se supprime sans qu'on doive lui donner un nom.

     Le champ Poste est obligatoire, la case Supprimer cette charge vit dans la
     meme fenetre, et valider renverrait Poste : a remplir. Il faudrait donc
     baptiser une ligne pour avoir le droit de la faire disparaitre -- et la
     ligne sans nom est justement celle qu'on veut le plus souvent effacer,
     puisque c'est celle qu'on a creee par megarde. */

  test('cocher la suppression dispense des champs obligatoires', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/const lire = \(suite = false\) => \{[\s\S]*?\n    \};/);
    vrai(bloc, 'la validation d’askForm doit être trouvable');
    vrai(/c\.type === 'case' && c\.cle === 'supprimer'/.test(bloc[0]),
      'la dispense doit se lire sur la case de suppression, pas sur un champ au '
      + 'hasard : c’est le nom que les trois fenêtres lisent déjà en retour');
    vrai(/const manquant = efface \? null :/.test(bloc[0]),
      'un champ obligatoire ne garantit plus rien sur une ligne qui ne sera plus là');
  });

  test('la règle vit dans askForm, pas dans chacun de ses appelants', () => {
    /* Il y a une dizaine de fenêtres de ce type, et la onzième aurait oublié la
       question. La règle est donc au seul endroit qu'elles traversent toutes —
       et ce test vérifie que la convention de nom tient : une case qui
       s'appellerait autrement serait muette pour askForm. */
    const src = lireSource('assets/app.js');
    /* Le libelle passe par `trad()` depuis qu'il se traduit : c'est la clef
       `supprimer` que ce controle surveille, pas la langue du libelle. */
    const cases = src.match(/\{ cle: 'supprimer', label: (?:trad\()?'[^']*'\)?, type: 'case'/g) || [];
    vrai(cases.length >= 3,
      `les fenêtres qui suppriment par une case doivent toutes employer cette clé `
      + `(${cases.length} trouvée·s)`);
    /* Et chacune fait bien quelque chose de la réponse. */
    const lectures = src.match(/if \(v\.supprimer\)/g) || [];
    eq(lectures.length, cases.length,
      `${cases.length} cases de suppression pour ${lectures.length} lectures : `
      + 'une case cochée qui ne supprime rien est pire qu’une case absente');
  });

  test('une ligne sans nom ne se fait pas désigner par un vide', () => {
    /* « Supprimer la charge fixe «  » ? » désignait un vide par un vide. */
    const src = lireSource('assets/app.js');
    const bloc = src.match(/function makeDeleter\([\s\S]*?\n\}/);
    vrai(bloc, 'makeDeleter doit être trouvable');
    /* Les guillemets suivent la langue depuis `guill()` : l'anglais n'ecrit pas
       « x » mais “x”, et la citation d'un nom saisi traversait les deux langues. */
    vrai(/nom \? ` \$\{guill\(nom\)\}` :/.test(bloc[0]),
      'la question doit rester lisible quand la ligne n’a pas de nom');
  });
});

/* ------------------------------------------------------------------
   Une ligne se retire sans passer par une vente
   ------------------------------------------------------------------ */
suite('Une ligne de titres se supprime depuis sa fiche', () => {

  /* Une position se supprime sans se vendre, sur telephone aussi : un bouton
     rouge en bas de la fiche, avec confirmation.

     Le tableau des lignes ne se rend pas sous 768 px -- c'est la regle
     d'affichage du projet -- et une croix de suppression qui ne vivrait que la
     laisserait sur telephone une ligne saisie par erreur sans moyen de quitter
     le portefeuille. */

  test('la fiche porte sa sortie définitive, et la fait confirmer', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/function askPosition\(index\) \{[\s\S]*?\n\}\n/);
    vrai(bloc, 'la fiche d’une ligne de titres doit être trouvable');
    vrai(/id="posDelete"/.test(bloc[0]),
      'la fiche doit porter un bouton de suppression : sans lui, une ligne créée '
      + 'par erreur est indélébile sur téléphone');
    vrai(/class="btn ghost danger"/.test(bloc[0]),
      'et il se distingue des quatre gestes courants du pied de fenêtre');
    vrai(/posDelete'\)\.onclick = async \(\) => \{[\s\S]{0,600}?askConfirm/.test(bloc[0]),
      'une suppression se confirme, et la question se pose tant que la fiche peut '
      + 'encore nommer la ligne et son montant');
  });

  test('la suppression se traite avant tout ce qui compte en index', () => {
    /* `suite.supprimer`, `suite.vendre` et `suite.acheter` sont des index dans
       `Store.state.positions`. Retirer une ligne les décale tous : la
       suppression doit donc être la première branche, et elle doit sortir. */
    const src = lireSource('assets/app.js');
    const bloc = src.match(/async 'open-position'\(btn\) \{[\s\S]*?\n  \},/);
    vrai(bloc, 'l’ouverture d’une fiche doit être trouvable');
    const iSup = bloc[0].indexOf('suite.supprimer');
    const iVente = bloc[0].indexOf('suite.vendre');
    vrai(iSup > 0 && iVente > 0, 'les deux suites doivent être traitées');
    vrai(iSup < iVente,
      'la suppression décale les index : elle se traite avant la vente et l’achat');
    vrai(/Store\.addBackup\('avant suppression de ligne'\)/.test(bloc[0]),
      'et pose une sauvegarde, comme la vente et l’achat');
  });

  test('« Enregistrer » repeint la fiche, il ne retouche pas des nœuds', () => {
    /* « La plus-value ne se met pas à jour en changeant le PRU. » Elle ne le
       pouvait pas : « Enregistrer » reprenait deux nœuds à la main, le montant
       en tête et le total investi, et laissait tout le reste sur les anciens
       chiffres — la plus-value, sa part du portefeuille, l'écart du jour. La
       fiche se contredisait dans une même fenêtre, et sur le chiffre qu'on
       venait justement relire.

       C'est le défaut que ce projet nomme depuis longtemps : une liste écrite à
       la main pour une seule vérité. Un sixième chiffre ajouté demain aurait été
       oublié comme les trois autres. Le contrôle porte donc sur le mécanisme —
       une peinture unique — et non sur la présence de tel ou tel rafraîchissement,
       qui se satisferait de la version fautive. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/function askPosition\(index\) \{[\s\S]*?\n\}\n/);
    vrai(bloc, 'la fiche d’une ligne de titres doit être trouvable');

    const enr = bloc[0].match(/const enregistrer = \(\) => \{[\s\S]*?\n    \};/);
    vrai(enr, '« Enregistrer » doit être trouvable dans la fiche');
    vrai(/peindre\(\)/.test(enr[0]),
      'il repeint la fiche entière : tous ses chiffres dérivent de la même lecture');
    vrai(!/innerHTML/.test(enr[0]),
      'et il ne retouche aucun nœud à la main : le chiffre oublié serait le suivant');

    /* La peinture doit vraiment tout refaire, sinon « repeindre » ne veut rien
       dire : le corps, mais aussi l'en-tete, que le nom et le compte alimentent. */
    vrai(/const peindre = \(\) => \{[\s\S]{0,400}?\$\('#modalBody'\)\.innerHTML =/.test(bloc[0]),
      'la peinture reconstruit le corps de la fiche');
    vrai(/const peindre = \(\) => \{[\s\S]{0,400}?\$\('#modalTitle'\)/.test(bloc[0]),
      'et son en-tête, que le nom et le compte modifient depuis les champs');

    /* Le corps reconstruit emporte ses ecouteurs : sans rebranchement, le bouton
       de suppression et la verification d'ISIN meurent au premier enregistrement.
       C'est le piege de ce genre de correctif, et il est silencieux. */
    vrai(/brancher\(\);\n    \};/.test(bloc[0]),
      'la peinture repose les commandes du corps, qui partent avec l’ancien balisage');

    /* Une fiche longue qu'on repeint sans lui rendre sa place renvoie en haut,
       donc loin du champ qu'on vient de corriger. */
    vrai(/scrollTop/.test(enr[0]),
      'et la place dans la fiche est rendue : elle est longue, et on corrige en son milieu');
  });
});

/* ------------------------------------------------------------------
   Le journal des ventes porte le bouton qui l'alimente
   ------------------------------------------------------------------ */
suite('Une vente s’ajoute depuis le journal des ventes', () => {

  /* Une vente s'ajoute depuis la page ou on la lit.

     Un seul chemin, le bouton Vendre de la carte des lignes de titres dans
     Marches, obligerait la page Performance a ecrire l'itineraire. Quand une
     page doit donner la direction de son propre geste, c'est le geste qui est
     mal place.

     Et la carte du journal se rend avant la premiere vente : sans cela le
     bouton ne serait jamais la pour la premiere. C'est le cas qu'on ne voit pas
     en developpant sur un jeu de donnees deja rempli. */

  test('le journal se rend même vide, et porte le bouton', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/function salesCard\(\) \{[\s\S]*?\n\}/);
    vrai(bloc, 'la carte du journal des ventes doit être trouvable');
    vrai(!/if \(!toutes\.length\) return '';/.test(bloc[0]),
      'la carte ne doit plus disparaître faute de ventes : c’est justement '
      + 'l’écran où l’on vient saisir la première');
    vrai(/data-action="sell-position"/.test(bloc[0]),
      'et elle porte le bouton qui l’alimente');
    /* Il fut desactive faute de ligne a vendre, au motif qu'une fenetre qui
       s'ouvre pour se refermer ne vaut pas mieux qu'une erreur. La fenetre ne se
       referme plus : son menu propose « une vente passee, pour memoire », et
       s'ouvre dessus quand il n'y a rien a vendre. Un bouton grise qui ne dit
       pourquoi que dans une infobulle est pire, au doigt, qu'une fenetre qui
       montre ce qu'elle peut. */
    vrai(!/disabled/.test(bloc[0]),
      'et il ne se désactive plus : sans ligne, la fenêtre s’ouvre sur la vente passée');
    vrai(!/data-action="declarer-vente"/.test(bloc[0]),
      'un seul bouton : la nature de la vente se choisit dans la fenêtre');
  });

  test('aucun écran n’envoie plus chercher ce bouton ailleurs', () => {
    /* La phrase qui donnait l'itinéraire. Elle était juste et c'était le
       problème : une application qui explique où trouver son geste avoue qu'il
       n'est pas là où on le cherche. */
    const src = lireSource('assets/app.js');
    vrai(!/se trouve dans Marchés/.test(src),
      'un écran envoie encore chercher le bouton de vente dans un autre onglet');
  });

  test('les deux portes mènent à la même saisie', () => {
    /* Deux boutons sur une même action sont sains — c'est la règle du projet,
       celle du sélecteur d'année du journal. Ce qui serait fautif, ce serait
       deux fenêtres de saisie de vente.

       Les deux portes sont le journal des ventes et la fiche de chaque ligne.
       L'en-tête des lignes de titres n'en porte plus : à côté d'Ajouter, un
       geste rare y pesait autant que le geste courant. */
    const src = lireSource('assets/app.js');
    const boutons = src.match(/data-action="sell-position"/g) || [];
    eq(boutons.length, 1, `une porte dans les listes, ${boutons.length} trouvée·s`);
    vrai(/id="posSell"/.test(src), 'et la seconde dans la fiche de la ligne, qui vend celle-ci');
    const debut = src.indexOf('<div class="card" data-anchor="titres">');
    const vue = src.slice(debut, src.indexOf('<div class="liste-mobile">', debut));
    vrai(vue.length > 200 && !/sell-position/.test(vue), 'l’en-tête des lignes ne vend plus');
    const actions = src.match(/'sell-position'\(\) \{/g) || [];
    eq(actions.length, 1, 'et une seule action derrière elles');
    const fenetres = src.match(/function askSale\(/g) || [];
    eq(fenetres.length, 1, 'et une seule fenêtre de saisie de vente');
  });
});

/* ------------------------------------------------------------------
   Le survol ne se pose jamais au doigt
   ------------------------------------------------------------------ */
suite('Aucun survol ne peut rester collé au doigt', () => {

  /* Sur telephone, une ligne ne reste pas surlignee quand on ne touche plus
     rien.

     Au doigt, `:hover` ne se leve pas : le navigateur le pose a l'appui et le
     laisse allume jusqu'a ce qu'on touche ailleurs. Toute regle de survol est
     donc une tache de peinture sur telephone.

     Poser `@media (hover: hover)` sur une seule regle laisserait toutes les
     autres avec le meme defaut. Ce test derive la liste de la feuille elle-meme :
     il n'y a pas d'exception a tenir a jour, et la regle que quelqu'un ecrira
     demain est deja couverte. */

  /* Les zones protégées, et le texte hors commentaires : un `:hover` cité en
     prose dans un commentaire n'est pas une règle. */
  function survolsNus() {
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const nu = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
    const zones = [];
    for (const m of nu.matchAll(/@media\s*\(hover:\s*hover\)[^{]*\{/g)) {
      let i = m.index + m[0].length, prof = 1;
      while (i < nu.length && prof) {
        if (nu[i] === '{') prof++;
        else if (nu[i] === '}') prof--;
        i++;
      }
      zones.push([m.index, i]);
    }
    const dedans = p => zones.some(([a, b]) => a <= p && p < b);
    const nus = [];
    for (const m of nu.matchAll(/:hover/g)) {
      if (dedans(m.index)) continue;
      const deb = Math.max(nu.lastIndexOf('}', m.index), nu.lastIndexOf('{', m.index)) + 1;
      nus.push(nu.slice(deb, nu.indexOf('{', m.index)).trim().replace(/\s+/g, ' '));
    }
    return { nus, protegees: zones.length };
  }

  test('toute règle de survol vit sous « hover: hover »', () => {
    const { nus, protegees } = survolsNus();
    vrai(protegees > 1,
      `le garde-fou doit couvrir toute la feuille, il n’enveloppe que ${protegees} bloc(s)`);
    eq(nus.length, 0,
      `${nus.length} règle(s) de survol hors du garde-fou, elles resteront peintes `
      + `après un appui sur téléphone :\n  ${nus.slice(0, 8).join('\n  ')}`);
  });

  test('le clavier n’a pas été emporté avec le doigt', () => {
    /* Trois sélecteurs mélangeaient survol et focus — `.aide:hover,
       .aide:focus-visible` et deux autres. Enfermer la règle entière aurait
       supprimé l'indication au clavier en même temps que la tache au doigt :
       elles ont été coupées en deux, et la moitié focus est restée dehors. */
    const css = lireSource('assets/styles.css');
    const nu = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const sel of ['.aide:focus-visible', '.col-aide:focus-visible', '.cible-champ:focus']) {
      vrai(nu.includes(sel),
        `« ${sel} » a disparu : la moitié clavier d’un sélecteur mixte ne doit pas `
        + 'partir avec sa moitié survol');
    }
  });

  test('l’appui tactile garde son propre retour', () => {
    /* Ce qui remplace le survol au doigt existe déjà et ne bouge pas : `:active`
       et les classes posées par un écouteur tactile, qui elles se lèvent. Retirer
       le survol sans elles laisserait le téléphone sans aucun retour. */
    const nu = lireSource('assets/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/\.brand\.tape\s+\.brand-mark/.test(nu), 'le logo garde son relais tactile');
    vrai(/\.tabbar\.tape/.test(nu), 'la barre du bas aussi');
    vrai(/:active/.test(nu), 'et les règles d’appui restent');
  });
});

/* ------------------------------------------------------------------
   Un repère de synchronisation ne ment pas
   ------------------------------------------------------------------ */
suite('La synchronisation ne se déclare pas alignée sans l’être', () => {

  /* Une affectation changee a la main -- un livret passe en epargne de
     precaution -- ne se defait pas toute seule au rechargement.

     L'ecriture, elle, est juste : le changement entre bien dans l'etat et y
     reste. Le seul mecanisme du code capable de defaire une modification
     enregistree, sans un mot, est l'adoption silencieuse de la version en ligne
     au demarrage.

     Elle repose sur un repere : cet etat local est-il reste tel qu'on l'avait
     synchronise ? Si oui, cet appareil est simplement en retard et l'on adopte
     sans demander. Pose sur un chemin de LECTURE, sans qu'aucune ecriture n'ait
     eu lieu, ce repere dirait aligne d'un etat qui n'a jamais ete envoye. Cinq
     etapes suffiraient alors a perdre une modification pour de bon, et la
     derniere ne poserait aucune question. */

  function sourceSync() {
    const src = lireSource('assets/cloudsync.js');
    vrai(src, 'assets/cloudsync.js doit être lisible pour ce contrôle');
    return src;
  }

  test('le repère ne se pose que sur une égalité vraie', () => {
    const src = sourceSync();
    const init = src.match(/async function init\(\)[\s\S]*?\n  \}/);
    vrai(init, 'init() doit être trouvable');
    vrai(!/\n\s*if \(localAt\) markSynced\(localAt\);/.test(init[0]),
      'le repère était posé dès que l’état local existait, sans le comparer au '
      + 'cloud ni rien envoyer : il déclarait aligné ce qui ne l’était pas');
    /* L'egalite des deux horodatages est desormais nommee par l'arbitre, et
       `init()` ne fait que poser le repere sur son verdict. Le controle suit la
       regle la ou elle vit : la suite « Une estampille fraiche ne prouve aucun
       contenu frais » l'execute, celui-ci verifie qu'aucun autre chemin ne
       marque un alignement. */
    vrai(/if \(verdict === 'aligne'\) markSynced\(localAt\);/.test(init[0]),
      'il ne se pose que sur un alignement constaté, et par ce seul chemin');
    vrai(/localAt === remoteAt\) return 'aligne'/.test(src),
      'et l’alignement reste l’égalité des deux horodatages, la seule preuve '
      + 'd’alignement dont on dispose au démarrage');
  });

  test('un appareil en avance envoie au lieu d’attendre', () => {
    /* L'autre moitié. Un état local plus récent que le cloud est un état jamais
       envoyé : l'envoi différé de huit secondes ne suffit pas quand l'app passe
       en veille avant, et `sendBeacon` ne passe pas toujours. On l'envoie au
       démarrage plutôt que d'attendre la frappe suivante. */
    const src = sourceSync();
    vrai(/aEnvoyer: verdict === 'envoyer'/.test(src),
      'init() doit dire à l’appelant que cet appareil porte des modifications non envoyées');
    const app = lireSource('assets/app.js');
    /* MAIS PLUS EN FORCE, et c'est tout l'objet du correctif. Le `force`
       tenait sur un raisonnement qui paraissait solide : `init()` vient de lire
       le cloud et de le trouver plus ancien, donc la base connue ne peut pas
       correspondre, donc le garde-fou de filiation refuserait a tort.

       Sa premisse etait fausse. « Plus ancien » y voulait dire « estampille plus
       ancienne », et le rafraichissement des cours datait l'etat a chaque
       ouverture : un ordinateur rouvert apres plusieurs jours portait l'heure la
       plus fraiche et le contenu le plus vieux. `force=1` demandait alors au
       serveur de sauter exactement le controle pose pour empecher cette
       perte-la, et le patrimoine du telephone disparaissait sans sauvegarde,
       sans question et sans message.

       `init()` ne renvoie plus `aEnvoyer` que lorsque la base connue EST la
       version en ligne. L'ecriture ordinaire passe donc toute seule. */
    const sansCommentaires = app.replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/cloud\.aEnvoyer\) \{\s*await CloudSync\.push\(\);/.test(sansCommentaires),
      'et le démarrage doit les envoyer par une écriture ordinaire, qui déclare '
      + 'sa base et accepte d’être refusée');
  });

  test('l’horodatage envoyé est celui qu’on a envoyé', () => {
    /* `markSynced(Store.state.meta.savedAt)` lisait l'état APRÈS l'aller-retour
       réseau. Une frappe pendant ce temps — et l'application écrit à chaque
       caractère — et l'on marquait comme synchronisé un état plus récent que
       celui réellement transmis. */
    const src = sourceSync();
    /* `pushMaintenant` porte l'envoi lui-meme ; `push` ne fait plus que garder
       qu'un seul soit en vol a la fois. C'est la premiere qu'on inspecte. */
    const push = src.match(/async function pushMaintenant\([\s\S]*?\n  \}/);
    vrai(push, 'pushMaintenant() doit être trouvable');
    /* Sans les commentaires : celui de cette fonction cite justement la ligne
       fautive pour expliquer pourquoi elle est partie, et le contrôle se serait
       fait prendre par la prose qui le justifie. */
    const code = push[0].replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/const envoyeAt = Store\.state\?\.meta\?\.savedAt;/.test(code),
      'l’horodatage doit être relevé au moment de la sérialisation');
    vrai(/markSynced\(envoyeAt\)/.test(code) && !/markSynced\(Store\.state/.test(code),
      'et c’est celui-là qu’on marque, pas l’état du moment où la réponse arrive');
  });

  test('remplacer tout l’état laisse un point de retour', () => {
    /* L'adoption silencieuse remplace le patrimoine entier sur la foi d'un
       repère. Le repère a déjà menti une fois ; une sauvegarde rend l'erreur
       réparable au lieu d'être définitive, et ne coûte rien. */
    /* La sauvegarde a demenage dans la porte commune, celle que les trois
       chemins d'adoption empruntent desormais. Le controle porte donc sur la
       delegation : c'est elle qui garantit qu'aucun chemin ne remplace l'etat
       sans passer par le point de retour. */
    const app = lireSource('assets/app.js');
    const bloc = app.match(/if \(cloud\.adopted\) \{[\s\S]*?\n    \} else/);
    vrai(bloc, 'la branche d’adoption doit être trouvable');
    vrai(/prendreVersionEnLigne\(/.test(bloc[0]),
      'elle passe par la porte commune plutôt que de remplacer elle-même');
    const porte = app.slice(app.indexOf('async function prendreVersionEnLigne('));
    vrai(/Store\.addBackup\(/.test(porte.slice(0, 600)),
      'et cette porte pose une sauvegarde avant de tout remplacer');
  });

  /* Des montants enregistres ne disparaissent pas au retour sur l'application.

     Un horodatage plus recent ne designe pas un contenu plus recent. Un onglet
     ouvert depuis six heures garde en memoire l'etat du matin ; le
     rafraichissement des cours y appelle `Store.save()` toutes les cinq minutes,
     ce qui estampille `savedAt = maintenant` et pousse tout. Contenu perime,
     estampille fraiche : le serveur accepterait, et un autre appareil
     adopterait ensuite. */

  test('on n’écrase que la version qu’on a lue', () => {
    /* Dans `_worker.js`, et c'est tout l'objet du controle suivant : le premier
       correctif a ete ecrit dans `functions/api/state.js`, qui ne tourne pas. */
    const src = lireSource('_worker.js');
    vrai(src, '_worker.js doit être lisible pour ce contrôle');
    const bloc = src.match(/async function handleState\([\s\S]*?\n\}/);
    vrai(bloc, 'handleState() doit être trouvable');
    const code = bloc[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    vrai(/params\.get\('base'\)/.test(code),
      'l’écrivain déclare la version qu’il a lue');
    vrai(/base !== prevAt/.test(code),
      'et l’écriture n’est acceptée que si c’est encore celle en place');
    /* L'ancienne regle ne suffisait pas et ne doit pas revenir seule : elle
       comparait deux horloges, or l'onglet perime a toujours la plus fraiche. */
    vrai(!/nextAt < prevAt/.test(code),
      'la comparaison d’horodatages seule ne protège de rien : elle laissait '
      + 'passer un contenu périmé portant une estampille fraîche');
    vrai(/force/.test(code), 'l’arbitrage explicite garde sa porte');
  });

  test('le point d’entrée qu’on teste est celui qui tourne', () => {
    /* Le correctif a d'abord ete ecrit dans `functions/api/state.js`. Chez
       Cloudflare Pages, un `_worker.js` a la racine prend toute la main et le
       dossier `functions/` n'est jamais charge : le defaut est reste en
       production, et un controle qui lisait le fichier mort passait au vert. Le
       depot public l'a note des le 9 aout — « functions/api/ etait du code mort,
       c'est _worker.js qui traite les requetes » — et a supprime le dossier.

       Deux surfaces pour un fait, dont une morte : tant que la copie existe ici,
       ce controle exige qu'elles disent la meme chose. La vraie reponse est de
       supprimer la morte, comme le fork l'a fait. */
    const worker = lireSource('_worker.js');
    vrai(/path === '\/api\/state'\) return handleState/.test(worker),
      'c’est bien _worker.js qui route /api/state');
    /* La copie morte est supprimee, `shared/market.js` avec elle : il n'y a plus
       qu'un seul endroit ou corriger. Le controle reste malgre tout, au cas ou
       quelqu'un recree le dossier en croyant que Pages le charge. */
    const mort = lireSource('functions/api/state.js');
    vrai(!mort || /base !== prevAt/.test(mort),
      'functions/api/ est du code mort chez Pages : soit il n’existe pas, soit il '
      + 'porte la même règle, sinon le prochain correctif ira dans celui qui ne '
      + 'tourne pas');
  });

  test('la base voyage avec l’écriture, beacon compris', () => {
    /* Le `sendBeacon` de la fermeture d'onglet ne peut rien verifier avant de
       partir : c'est precisement pourquoi le garde-fou est cote serveur, et
       pourquoi ce chemin-la doit lui aussi declarer sa base. Un onglet perime
       qu'on ferme envoyait tout son etat d'un coup. */
    const src = sourceSync();
    const push = src.match(/async function pushMaintenant\([\s\S]*?\n  \}/)[0]
      .replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/base=\$\{encodeURIComponent\(vu\)\}/.test(push),
      'l’envoi ordinaire déclare la version lue');
    const flush = src.match(/function flushOnUnload\([\s\S]*?\n  \}/)[0]
      .replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/base=\$\{encodeURIComponent\(vu\)\}/.test(flush),
      'le beacon de fermeture aussi');
  });

  test('adopter une version en ligne la note comme lue', () => {
    /* Sinon la sauvegarde suivante declare avoir lu une version qui n'est plus en
       place, et se fait refuser sans raison : le correctif se retournerait contre
       le detenteur qui vient de choisir la version en ligne. */
    const src = sourceSync();
    vrai(/const noterVersionLue = at => \{ markSynced\(at\);/.test(src),
      'cloudsync expose de quoi noter une version lue');
    /* Plus de branche « charger celle en ligne » : il n'y a plus de question, et
       les trois chemins passent par la meme porte. C'est elle qui note. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('async function prendreVersionEnLigne(');
    const porte = app.slice(i, app.indexOf('\n  }', i));
    vrai(/CloudSync\.noterVersionLue\(quand\);/.test(porte),
      'la porte commune note la version adoptée');
  });

  test('un refus se voit ailleurs que sur la page Données', () => {
    /* Une modification qui n'est pas partie est le seul etat de l'application ou
       fermer fait perdre quelque chose. Il se disait sur la seule page ou
       personne ne va apres avoir saisi un montant. */
    const src = sourceSync();
    vrai(/onConflit\(d\)/.test(src), 'le refus appelle un signal');
    const app = lireSource('assets/app.js');
    vrai(/CloudSync\.setOnConflit\(/.test(app), 'que le démarrage branche');
    vrai(/toast\(trad\('Modification gardée ici/.test(app), 'sur un toast immédiat');
    const store = lireSource('assets/store.js');
    vrai(/\['synchro',\s*trad\('Synchronisation'\)/.test(store),
      'et la cloche porte une famille pour ça');
    vrai(/CloudSync\.status\(\)\.conflict/.test(store),
      'alimentée par le conflit réel, pas par une supposition');
    /* La cloche ne parle que de ce qui existe chez celui qui la regarde : sans
       synchro disponible, ce controle n'a rien a dire. */
    vrai(/typeof CloudSync !== 'undefined' && CloudSync\.isAvailable\(\)/.test(store),
      'et elle se tait là où la synchro n’existe pas');
  });
});

/* ------------------------------------------------------------------
   Budget : le moteur dit quel poste a bougé, ou il se tait
   ------------------------------------------------------------------ */
suite('Budget : le moteur dit quel poste a bougé, ou il se tait', () => {

  /* CES CONTROLES JOUENT LES REGLES, ils ne lisent pas leur source. Chacun pose
     un budget choisi et demande au moteur ce qu'il en tire : c'est la seule
     forme sous laquelle « ne montrer un insight que s'il est reellement utile »
     se verifie, puisque la moitie de la promesse est un SILENCE.

     Le fil qui les relie : un insight de depenses ne sort que si le mouvement
     est a la fois RELATIF — il bouge d'au moins un sixieme — et MATERIEL — il
     pese au moins un vingtieme du budget du mois. Une seule des deux conditions
     laisse passer du bruit, et le bruit est ce que cette carte ne doit pas
     porter. */

  /* Un budget de N mois, chaque mois portant les postes qu'on lui donne. Les
     mois sont poses en arriere a partir d'aujourd'hui, et tous CLOS : le moteur
     ecarte le mois en cours, et un fixture qui l'inclurait testerait autre chose
     que ce qu'il annonce. */
  const moisAvant = n => {
    const d = new Date(todayISO() + 'T12:00:00');
    d.setMonth(d.getMonth() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const poserBudget = (mois, options = {}) => Fixture.poser(s => {
    s.budget.monthlyTarget = options.objectif === undefined ? 1000 : options.objectif;
    s.budget.categories = [...new Set(mois.flatMap(v => Object.keys(v)))];
    /* Le plus ancien en premier, et le plus recent au mois dernier. */
    s.budget.expenses = mois.map((v, i) => ({ month: moisAvant(mois.length - i), v, note: '' }));
    if (options.enCours) {
      s.budget.expenses.push({ month: moisAvant(0), v: options.enCours, note: '' });
    }
  });
  const budgetSortis = () => insightsDeLOnglet('budget', {});
  const trouve = id => budgetSortis().find(x => x.id === id);

  /* Six mois : trois de reference, trois recents ou un poste double. */
  const SIX_MOIS_AVEC_DERIVE = [
    { Courses: 400, Sorties: 100 }, { Courses: 400, Sorties: 100 }, { Courses: 400, Sorties: 100 },
    { Courses: 400, Sorties: 300 }, { Courses: 400, Sorties: 300 }, { Courses: 400, Sorties: 300 },
  ];

  test('un mois vide ne fait parler personne', () => {
    poserBudget([]);
    eq(budgetSortis().length, 0,
      'sans une seule dépense saisie, il n’y a rien à dire : c’est l’écran des '
      + 'premiers pas qui parle, pas un insight');
  });

  test('un seul mois dit la limite, et ne compare rien', () => {
    poserBudget([{ Courses: 400 }]);
    const t = trouve('budget_history_thin');
    vrai(t, 'la carte dit pourquoi elle ne compare pas');
    eq(t.params.months, 1, 'et combien de mois elle a');
    eq(t.params.needed, 6, 'et combien il en faut');
    vrai(!trouve('spending_category_shift'), 'aucune dérive n’est calculée sur un mois');
    vrai(!trouve('spending_shift'), 'ni sur le total');
  });

  test('l’aveu d’historique s’éteint dès qu’il y a de quoi comparer', () => {
    /* LA SEULE REGLE DU CATALOGUE DONT LE BUT EST DE DISPARAITRE. Un insight qui
       reviendrait tous les mois pour annoncer qu'il manque des donnees serait
       exactement le bruit qu'on voulait eviter. */
    poserBudget(SIX_MOIS_AVEC_DERIVE);
    vrai(!trouve('budget_history_thin'),
      'six mois suffisent : elle n’a plus rien à dire et ne revient jamais');
  });

  test('le poste qui a doublé est nommé, avec ses deux montants', () => {
    poserBudget(SIX_MOIS_AVEC_DERIVE);
    const d = trouve('spending_category_shift');
    vrai(d, 'la dérive d’un poste doit sortir');
    eq(d.params.category, 'Sorties', 'et c’est le poste qui a bougé, pas le plus gros');
    pres(d.params.previous, 100, 'son niveau d’avant');
    pres(d.params.current, 300, 'son niveau de maintenant');
    pres(d.params.deltaPct, 200, 'et l’écart relatif');
  });

  test('un petit poste qui double ne passe pas devant un gros qui bouge', () => {
    /* LE PIEGE DU POURCENTAGE SEUL. Un abonnement de huit euros qui passe a
       seize fait +100 %, et ce +100 % couronnerait le bruit. La condition de
       poids l'écarte : huit euros ne pèsent rien dans un budget de cinq cents. */
    poserBudget([
      { Courses: 400, Abo: 8 }, { Courses: 400, Abo: 8 }, { Courses: 400, Abo: 8 },
      { Courses: 400, Abo: 16 }, { Courses: 400, Abo: 16 }, { Courses: 400, Abo: 16 },
    ]);
    vrai(!trouve('spending_category_shift'),
      'huit euros de plus ne sont pas une dérive, quel que soit leur pourcentage');
  });

  test('un gros poste qui bouge à peine ne sort pas non plus', () => {
    /* LE PIEGE SYMETRIQUE. L'alimentation bouge de quelques euros tous les mois
       sans que cela veuille rien dire, et elle sortirait a chaque fois puisqu'elle
       est la plus grosse ligne. */
    poserBudget([
      { Courses: 400 }, { Courses: 400 }, { Courses: 400 },
      { Courses: 420 }, { Courses: 420 }, { Courses: 420 },
    ]);
    vrai(!trouve('spending_category_shift'),
      'cinq pour cent sur la plus grosse ligne restent de la vie courante');
  });

  test('un poste qui s’éteint ne se dit pas : il n’appelle aucune décision', () => {
    /* Une reparation imprevue parait un mois puis disparait. La fenetre suivante
       la voit tomber a zero, donc « −100 % », et ce moins-cent-pour-cent
       sortirait en tete tous les trimestres sans que personne ait rien a en
       faire. Le mois exceptionnel, lui, est deja dit par sa propre règle. */
    poserBudget([
      { Courses: 400, Imprevu: 300 }, { Courses: 400, Imprevu: 300 }, { Courses: 400, Imprevu: 300 },
      { Courses: 400 }, { Courses: 400 }, { Courses: 400 },
    ]);
    const d = trouve('spending_category_shift');
    vrai(!d || d.params.category !== 'Imprevu',
      'une dépense qui s’arrête n’est pas une dérive à signaler');
  });

  test('un poste qui apparaît se dit sans inventer de pourcentage', () => {
    poserBudget([
      { Courses: 400 }, { Courses: 400 }, { Courses: 400 },
      { Courses: 400, Garde: 250 }, { Courses: 400, Garde: 250 }, { Courses: 400, Garde: 250 },
    ]);
    const d = trouve('spending_category_shift');
    vrai(d, 'un poste nouveau qui pèse doit se dire');
    eq(d.params.category, 'Garde', 'et c’est bien lui');
    eq(d.params.isNew, true, 'la présentation saura qu’il n’avait pas de base');
    eq(d.params.deltaPct, null,
      'un pourcentage n’existe que sur une base positive : sans niveau d’avant, '
      + 'il n’y en a pas, et « +100 % » serait une mesure inventée');
  });

  test('le rythme du mois en cours prévient d’un dépassement, pas avant le tiers', () => {
    /* La regle regarde le seul mois non clos du catalogue, et elle le dit.

       La depense suit l'avancement du mois : un montant fixe se projette plus
       bas a mesure que le mois avance, et passait sous le seuil en fin de mois.
       Celle-ci se projette toujours a une fois et demie l'objectif. */
    poserBudget(SIX_MOIS_AVEC_DERIVE, { objectif: 1000, enCours: { Courses: 1 } });
    const m = mesuresInsights(contexteInsights({}));
    const depense = Math.round(1000 * 1.5 * m.encours.avancement);
    poserBudget(SIX_MOIS_AVEC_DERIVE, { objectif: 1000, enCours: { Courses: depense } });
    const p = trouve('spending_target_pace');
    if (m.encours.avancement < 1 / 3) {
      vrai(!p, 'avant le tiers du mois, une projection ne mesure que le hasard des premiers jours');
    } else {
      vrai(p, 'passé le tiers du mois, le rythme se dit');
      pres(p.params.spent, depense, 'ce qui est déjà sorti');
      vrai(p.params.projected > p.params.target, 'et la projection dépasse l’objectif');
    }
  });

  test('sans objectif déclaré, il n’y a pas de dépassement à annoncer', () => {
    poserBudget(SIX_MOIS_AVEC_DERIVE, { objectif: 0, enCours: { Courses: 5000 } });
    vrai(!trouve('spending_target_pace'),
      'un dépassement suppose une cible : sans elle, il n’y a qu’une dépense');
  });

  test('un mois à part nomme ce qui le porte, ou se tait là-dessus', () => {
    /* La hausse tenue par un seul poste : il doit etre nomme.

       LES MOIS DE REFERENCE VARIENT, ET C'EST LA REGLE QUI L'EXIGE : elle
       compare l'écart à la dispersion habituelle de cette personne, et une série
       parfaitement plate ferait de trois euros une anomalie. Sans dispersion
       mesurable, elle se tait — ce qui est juste, et ce qu'un fixture trop
       régulier prenait pour un défaut. */
    poserBudget([
      { Courses: 380 }, { Courses: 420 }, { Courses: 400 }, { Courses: 410 },
      { Courses: 390 }, { Courses: 400 }, { Courses: 400, Travaux: 1400 },
    ]);
    const a = trouve('spending_month_anomaly');
    vrai(a, 'un mois qui sort de l’ordinaire doit se dire');
    eq(a.params.drivers.join(','), 'Travaux', 'et le poste qui le porte est nommé');

    /* La hausse repartie sur cinq postes : aucun ne l'explique, on n'en cite
       aucun plutot que de laisser croire que les deux premiers suffisent. */
    /* La dispersion se mesure sur le TOTAL du mois, pas sur ses postes : des
       mois qui varient au-dedans mais tombent tous sur le même total sont
       parfaitement plats pour cette règle. Ce sont donc les totaux qui bougent. */
    poserBudget([
      { A: 80, B: 100, C: 100, D: 100, E: 100 }, { A: 120, B: 100, C: 100, D: 100, E: 100 },
      { A: 100, B: 100, C: 100, D: 100, E: 100 }, { A: 110, B: 100, C: 100, D: 100, E: 100 },
      { A: 90, B: 100, C: 100, D: 100, E: 100 }, { A: 100, B: 100, C: 100, D: 100, E: 100 },
      { A: 260, B: 260, C: 260, D: 260, E: 260 },
    ]);
    const b = trouve('spending_month_anomaly');
    vrai(b, 'le mois sort toujours de l’ordinaire');
    eq(b.params.drivers.length, 0, 'mais aucun poste ne l’explique à lui seul');
    eq(b.params.driversDelta, null,
      'et les chiffres ne survivent pas au refus de nommer : ils se liraient '
      + 'comme la cause');
  });

  test('deux règles ne racontent jamais la même chose sur la même carte', () => {
    /* `spending_shift` dit que le total a change de niveau, `spending_category_shift`
       dit quel poste l'a fait. Elles partagent un groupe de déduplication, donc
       la plus forte sort seule — et c'est celle qui nomme le poste, parce qu'elle
       contient l'autre information en plus de la sienne. */
    poserBudget(SIX_MOIS_AVEC_DERIVE);
    const ids = budgetSortis().map(x => x.id);
    vrai(!(ids.includes('spending_shift') && ids.includes('spending_category_shift')),
      'le total et le poste ne se disent pas ensemble');
    eq(ids.length, new Set(ids).size, 'et aucune règle ne sort deux fois');
  });

  test('un insight de dépenses ne s’affiche plus sur l’Aperçu', () => {
    /* L'ADRESSAGE PAR ONGLET, ET CE QU'IL CORRIGE. Une remarque sur les
       restaurants s'affichait sur la page du patrimoine, ou personne ne vient la
       chercher, et elle occupait une des trois places au détriment d'une lecture
       patrimoniale. */
    poserBudget(SIX_MOIS_AVEC_DERIVE);
    const surApercu = insightsDeLOnglet('overview', {}).map(x => x.id);
    vrai(!surApercu.includes('spending_category_shift'),
      'une règle se lit sur l’onglet où l’on est déjà en train d’y penser');
    for (const r of REGLES_INSIGHT) {
      vrai(['overview', 'budget', 'allocation', 'accounts', 'positions'].includes(r.onglet),
        `${r.id} déclare un onglet qui existe`);
    }
  });

  test('le moteur filtre par onglet, il ne coupe pas', () => {
    poserBudget(SIX_MOIS_AVEC_DERIVE);
    const tous = construireInsights({});
    for (const vue of ['overview', 'budget', 'allocation', 'accounts', 'positions']) {
      eq(insightsDeLOnglet(vue, {}).join(','),
         tous.filter(i => i.onglet === vue).join(','),
         `« ${vue} » reçoit exactement ce que le moteur y range, sans plafond`);
    }
  });
});

/* ------------------------------------------------------------------
   Un non coté se cède, et la cession s'inscrit quelque part
   ------------------------------------------------------------------ */
suite('Un non coté se cède, et la cession s’inscrit quelque part', () => {

  /* Une ligne cotee se vendait ; tout le reste ne pouvait que s'archiver, et
     archiver ne dit rien de l'argent. La valeur quittait le patrimoine, le
     produit se retapait a la main, et la plus-value realisee n'entrait nulle
     part — la baisse tombait dans « ce qui ne vient pas du budget », c'est-a-dire
     dans la case de ce qu'on n'explique pas.

     Ces controles JOUENT la cession sur un etat pose, et verifient les trois
     mouvements : le journal, le cash, la ligne. */

  /* Une participation en parts, posee a cote de la graine : 4 000 parts payees
     1 EUR, qui en valent 3 aujourd'hui. Les chiffres sont ronds pour que
     l'assertion se lise, et synthetiques comme tout ce fixture. */
  const poserParts = () => Fixture.poser(s => {
    s.comptes.push({
      id: 'c_parts', etabId: 'e_pe', type: 'pe', statut: 'ouvert',
      ouvertLe: '2024-01-01', numero: '', notes: '',
      libelle: 'Participation', court: 'Participation', alloc: '', cash: [],
      lignes: [{ id: 'l_parts', classe: 'nonCote', libelle: 'Participation',
                 parts: 4000, valeur: 12000, prixDeRevient: 4000,
                 dateAcquisition: '2024-01-01' }],
    });
  });

  const ligneParts = () => compteById('c_parts').lignes[0];

  test('une cession partielle sort son prorata, et rien de plus', () => {
    poserParts();
    const a = cederPlacement({ compteId: 'c_parts', index: 0, parts: 1000,
                               produit: 3300, cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }),
                               date: '2026-09-20' });
    vrai(a, 'la cession doit aboutir');
    pres(a.investi, 1000, 'le quart des parts emporte le quart de l’investi');
    pres(a.realised, 2300, 'et la plus-value est le produit moins cet investi');
    pres(a.sortie, 3000, 'la valeur qui quitte le patrimoine est le prorata de '
      + 'la valeur, pas le produit encaissé');

    const l = ligneParts();
    pres(num(l.parts), 3000, 'il reste les trois quarts des parts');
    pres(num(l.valeur), 9000, 'et les trois quarts de la valeur');
    pres(num(l.prixDeRevient), 3000, 'et les trois quarts de l’investi');
    /* LE PRIX UNITAIRE NE BOUGE PAS, et c'est toute la regle du prorata : il
       vaut exactement ce qu'il valait avant la cession, des deux cotes. */
    pres(num(l.valeur) / num(l.parts), 3, 'la valeur par part est inchangée');
    pres(num(l.prixDeRevient) / num(l.parts), 1, 'le prix de revient par part aussi');
  });

  test('le produit devient des espèces, et la plus-value entre au journal', () => {
    poserParts();
    const avant = valeurCompte(compteById('c_courant'));
    cederPlacement({ compteId: 'c_parts', index: 0, parts: 1000, produit: 3300,
                     cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-20' });
    pres(valeurCompte(compteById('c_courant')) - avant, 3300,
      'le compte crédité reçoit le produit : sans ça le patrimoine chuterait '
      + 'de la valeur cédée sans que rien ne la remplace');

    const v = Store.state.sales[0];
    vrai(v, 'le journal porte la cession');
    eq(v.cession, 'vente', 'et dit de quelle nature elle est');
    eq(v.account, 'c_parts', 'elle sait d’où elle vient');
    pres(num(v.realised), 2300, 'et la plus-value réalisée y est');
    /* Le meme journal que les ventes de titres, et non un second : deux listes
       auraient donne deux totaux annuels qui finissent par se contredire. */
    pres(num(v.qty), 1000, 'les parts tiennent lieu de quantité');
    pres(num(v.price), 3.3, 'le prix de cession par part s’en dérive');
    pres(num(v.buyPrice), 1, 'et le prix de revient par part aussi');
  });

  test('une cession totale retire la ligne et archive l’actif terminal', () => {
    poserParts();
    cederPlacement({ compteId: 'c_parts', index: 0, parts: 4000, produit: 13000,
                     cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-20' });
    const c = compteById('c_parts');
    eq((c.lignes || []).length, 0, 'la ligne s’en va');
    /* UN ACTIF TERMINAL EST SON PLACEMENT : vide, il n'a plus de raison de
       figurer dans la liste des actifs, et le laisser ouvert a zéro euro y
       ferait une ligne morte que personne ne saurait plus pourquoi fermer. */
    eq(c.statut, 'archive', 'et le compte, qui EST le placement, s’archive');
    eq(c.clotureLe, '2026-09-20', 'à la date de la cession');
    pres(num(Store.state.sales[0].realised), 9000, 'la plus-value totale au journal');
  });

  test('un remboursement partiel de financement participatif rend les intérêts', () => {
    /* Le fixture porte un prêt de 2 000 EUR. Il en rembourse la moitié, et
       verse 1 100 : mille de capital, cent d'intérêts. */
    Fixture.poser();
    const a = cederPlacement({ compteId: 'c_pe', index: 0, nature: 'remboursement',
                               capital: 1000, produit: 1100,
                               cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-20' });
    vrai(a, 'le remboursement doit aboutir');
    pres(a.investi, 1000, 'la moitié du capital sort');
    pres(a.realised, 100, 'et les intérêts perçus sont le résultat');
    pres(num(compteById('c_pe').lignes[0].valeur), 1000, 'il reste la moitié du prêt');
    eq(Store.state.sales[0].cession, 'remboursement', 'le journal dit sa nature');
  });

  test('un défaut total inscrit la perte, même sans un euro récupéré', () => {
    Fixture.poser();
    const a = cederPlacement({ compteId: 'c_pe', index: 0, nature: 'defaut',
                               produit: 0, cashAccount: '', date: '2026-09-20' });
    vrai(a, 'un défaut sans récupération reste une cession : c’est le produit '
      + 'qui est nul, pas la fraction cédée');
    pres(a.realised, -2000, 'la moins-value est tout l’investi');
    eq((compteById('c_pe').lignes || []).length, 0, 'la ligne s’en va');
    eq(Store.state.sales[0].cession, 'defaut', 'et le journal le nomme');
  });

  test('annuler une cession rend tout, et ne fabrique aucune ligne de titres', () => {
    poserParts();
    const titresAvant = Store.state.positions.length;
    const cashAvant = valeurCompte(compteById('c_courant'));
    cederPlacement({ compteId: 'c_parts', index: 0, parts: 4000, produit: 13000,
                     cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-20' });
    annulerVente(0);

    /* Le defaut qu'on evite ici : `annulerVente()` rendait des TITRES. Sur une
       cession de non coté, elle aurait poussé dans `positions` une ligne cotée
       fantôme, avec un cours et un prix, pour un actif qui n'en a pas. */
    eq(Store.state.positions.length, titresAvant,
      'aucune position n’est fabriquée : un non coté n’est pas une ligne de titres');
    pres(valeurCompte(compteById('c_courant')), cashAvant, 'les espèces repartent');
    const c = compteById('c_parts');
    eq(c.statut, 'ouvert', 'le compte rouvre');
    vrai(!c.clotureLe, 'et un compte rouvert n’est pas clôturé');
    eq((c.lignes || []).length, 1, 'la ligne revient');
    pres(num(c.lignes[0].parts), 4000, 'avec ses parts');
    pres(num(c.lignes[0].valeur), 12000, 'et sa valeur');
    eq(Store.state.sales.length, 0, 'le journal oublie la cession');
  });

  test('annuler une cession partielle ne rend que ce qu’elle avait pris', () => {
    poserParts();
    cederPlacement({ compteId: 'c_parts', index: 0, parts: 1000, produit: 3300,
                     cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-20' });
    annulerVente(0);
    const l = ligneParts();
    pres(num(l.parts), 4000, 'les parts reviennent');
    pres(num(l.valeur), 12000, 'la valeur revient');
    pres(num(l.prixDeRevient), 4000, 'l’investi revient');
  });

  test('céder zéro part n’est pas une cession', () => {
    poserParts();
    const a = cederPlacement({ compteId: 'c_parts', index: 0, parts: 0,
                               produit: 500, cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-01' });
    eq(a, null, 'sans fraction cédée, il n’y a ni ligne à réduire ni résultat à inscrire');
    eq((Store.state.sales || []).length, 0, 'et rien n’entre au journal');
  });

  test('le journal ne montre pas « 0 × 0 € » sous une cession sans parts', () => {
    /* Vu a l'ecran avant d'etre corrige : la cession d'un fonds non cote
       s'affichait « 20/09/2026 · 0 × 0,00 € ». Les deux zeros sont des cases
       vides — un placement sans parts n'a ni quantite ni prix unitaire — et ils
       se lisaient comme des faits.

       La question se pose donc a la DONNEE et non au drapeau `declaree` : celui-
       ci repondait « ce n'est pas une vente declaree, donc elle a une
       quantite », ce qui n'a jamais ete la meme question. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf("action: 'open-sale'");
    vrai(i > 0, 'la ligne du journal doit être trouvable');
    const bloc = app.slice(i, i + 600);
    vrai(/num\(v\.qty\) \?/.test(bloc),
      'le sous-titre demande à la vente si elle porte une quantité');
    vrai(/trad\('\{m\} reçus'\)/.test(bloc),
      'et sans quantité, il dit le montant reçu plutôt que deux zéros');
  });

  test('un pourcentage de cession n’existe que sur une base positive', () => {
    poserParts();
    const l = ligneParts();
    delete l.prixDeRevient;
    const a = apercuCession(l, typeCompte('pe'), { parts: 1000, produit: 3300 });
    eq(a.pct, null, 'sans investi connu, la cession se dit en euros et se tait '
      + 'sur le taux — diviser par zéro rendrait un pourcentage arbitraire');
    eq(a.investi, null, 'l’investi est inconnu, pas nul');
    eq(a.realised, null, 'et le résultat aussi : un produit encaissé n’est pas une plus-value');
    pres(a.produit, 3300, 'le produit, lui, se dit');
  });
});

/* ------------------------------------------------------------------
   Une estampille fraîche ne prouve aucun contenu frais
   ------------------------------------------------------------------ */
suite('Une estampille fraîche ne prouve aucun contenu frais', () => {

  /* Un ordinateur rouvert apres plusieurs jours chargeait son contenu perime,
     puis l'imposait en ligne par-dessus les saisies faites entre-temps sur le
     telephone. Sans sauvegarde, sans question et sans message.

     CE CONTROLE JOUE LA REGLE AU LIEU DE LA LIRE. Les suites de synchro
     precedentes affirment que telle ligne est bien ecrite dans le fichier ;
     aucune n'a jamais fait se rencontrer deux appareils, et c'est exactement
     pour cela que ce defaut a vecu des semaines sous un vert complet. La regle
     d'arbitrage est donc une fonction pure, extraite de `cloudsync.js` et
     EXECUTEE ici sur des dates choisies.

     Le defaut tenait en une phrase : l'application demandait « qui porte
     l'estampille la plus fraiche ? » la ou il fallait demander « le cloud
     est-il encore la ou cet appareil l'avait laisse ? ». Les deux questions ont
     la meme reponse tant qu'un seul appareil ecrit. Elles divergent des que
     `Store.save()` est appele par autre chose qu'une decision — le
     rafraichissement des cours, toutes les cinq minutes et a chaque
     ouverture. */
  let arbitreMemo = null;
  function arbitre() {
    if (arbitreMemo) return arbitreMemo;
    const src = lireSource('assets/cloudsync.js');
    vrai(src, 'assets/cloudsync.js doit être lisible pour ce contrôle');
    /* Les bornes sont du CODE et non des commentaires : une phrase se reformule,
       et un `indexOf` sur une phrase vaut -1 le jour où elle bouge. */
    const d = src.indexOf('function arbitrer({');
    const f = src.indexOf('\n  }', d) + 4;
    vrai(d > 0 && f > d,
      'la règle d’arbitrage doit être isolable : c’est la condition pour la jouer');
    arbitreMemo = new Function(`${src.slice(d, f)}\nreturn arbitrer;`)();
    return arbitreMemo;
  }

  /* Trois jours, deux appareils, et la perte telle qu'elle s'est produite. */
  const J17 = '2026-09-17T09:57:00.000Z';   // les deux appareils s'alignent
  const J19 = '2026-09-19T18:20:00.000Z';   // le telephone saisit, et pousse
  const J20 = '2026-09-20T08:05:00.000Z';   // l'ordinateur rouvre et rafraichit

  test('l’ordinateur rouvert après trois jours ne s’impose plus au téléphone', () => {
    /* L'ordinateur porte le patrimoine du 17 et l'estampille du 20, gagnee sur
       un rafraichissement de cours. Le telephone a saisi le 19 et pousse. La
       comparaison d'horloges donnait « le local est en avance » — donc envoi en
       force, donc la saisie du telephone effacee sans un mot. */
    eq(arbitre()({ localAt: J20, remoteAt: J19, syncedAt: J17 }), 'conflit',
      'un contenu périmé portant une estampille fraîche ne doit jamais '
      + 'écraser en ligne : le cloud a bougé depuis la dernière lecture de cet '
      + 'appareil, et cela seul suffit à en faire un arbitrage');
  });

  test('et l’arbitrage rendu est celui du détenteur : la version en ligne', () => {
    /* « conflit » n'est pas une question posee a l'utilisateur — le detenteur a
       tranche le 15 septembre : c'est toujours la version en ligne, sans
       demander, avec une sauvegarde et un message qui dit ou la retrouver. Le
       verdict designe donc la branche `newer`, celle qui passe par la porte
       commune. */
    const src = lireSource('assets/cloudsync.js');
    const i = src.indexOf("if (verdict === 'conflit')");
    vrai(i > 0, 'le verdict de conflit doit être traité dans init()');
    vrai(/newer: true/.test(src.slice(i, i + 200)),
      'il mène à la branche qui adopte la version en ligne avec un point de retour');
  });

  test('une saisie jamais partie part, quand personne n’a écrit depuis', () => {
    /* L'autre moitie, et elle doit continuer de marcher : c'est le cas du
       telephone qu'on verrouille avant l'envoi differe. Le cloud est reste
       exactement la ou cet appareil l'avait laisse, donc rien ne s'y perd. */
    eq(arbitre()({ localAt: J20, remoteAt: J19, syncedAt: J19 }), 'envoyer',
      'le cloud est là où on l’avait laissé : la saisie locale peut partir');
  });

  test('l’appareil simplement en retard adopte sans question', () => {
    eq(arbitre()({ localAt: J17, remoteAt: J19, syncedAt: J17 }), 'adopter',
      'rien n’a été saisi ici depuis la dernière synchro : c’est le cas normal '
      + 'du deuxième appareil, et poser la question à chaque fois serait pénible');
  });

  test('le cloud en avance sur une saisie locale reste un arbitrage', () => {
    eq(arbitre()({ localAt: J19, remoteAt: J20, syncedAt: J17 }), 'conflit',
      'les deux côtés ont bougé depuis la dernière lecture : sauvegarde et message');
  });

  test('deux horodatages égaux sont un alignement, pas un envoi', () => {
    eq(arbitre()({ localAt: J19, remoteAt: J19, syncedAt: J17 }), 'aligne',
      'même contenu des deux côtés : il n’y a rien à faire, et surtout rien à écrire');
  });

  test('un appareil vierge prend ce qui est en ligne', () => {
    eq(arbitre()({ localAt: undefined, remoteAt: J19, syncedAt: null }), 'adopter',
      'un navigateur neuf n’a rien à perdre : il n’y a pas de conflit à arbitrer');
  });

  test('un appareil qui n’a jamais synchronisé ne s’impose pas', () => {
    /* Le repere absent est la forme la plus franche de l'ignorance : on ne sait
       pas ou l'on a laisse le cloud. Elle ne peut pas valoir permission
       d'ecraser. */
    eq(arbitre()({ localAt: J20, remoteAt: J19, syncedAt: null }), 'conflit',
      'sans repère de filiation, l’estampille locale ne prouve rien');
  });

  test('rien en ligne et rien ici ne déclenche aucune écriture', () => {
    eq(arbitre()({ localAt: undefined, remoteAt: undefined, syncedAt: null }), 'rien',
      'un état sans horodatage se ferait refuser par le serveur — révision manquante');
  });

  test('le premier envoi ne force plus rien non plus', () => {
    /* Une lecture a vide autorisait elle aussi un `force`, au motif qu'il n'y a
       rien a perdre. C'est vrai tant que la lecture dit la verite ; si ce 204
       venait d'une session qui a change de mains, il effacait un patrimoine
       entier. Le repere est efface, l'ecriture part sans base, et c'est le
       serveur qui n'insere que s'il n'y a toujours rien. */
    const src = lireSource('assets/cloudsync.js');
    vrai(/if \(!remote\) \{ markSynced\(''\); return \{ available: true, empty: true/.test(src),
      'init() efface le repère avant d’annoncer un cloud vide');
    const app = lireSource('assets/app.js').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(/cloud\.empty\) \{\s*await CloudSync\.push\(\);/.test(app),
      'et le premier envoi est une écriture ordinaire');
  });

  test('le démarrage n’impose plus rien, le bouton d’arbitrage garde sa porte', () => {
    /* La distinction qui compte : un ecrasement en force est une decision, et
       une decision se prend par quelqu'un. Le bouton « imposer les donnees de
       cet appareil » le demande et l'annonce ; le demarrage, lui, s'executait
       tout seul au reveil d'un onglet. */
    const app = lireSource('assets/app.js');
    const d = app.indexOf('const cloud = modeDemo()');
    const f = app.indexOf('if (cloud.available) {', d);
    vrai(d > 0 && f > d, 'le bloc de démarrage de la synchro doit être trouvable');
    const demarrage = app.slice(d, f).replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/force/.test(demarrage),
      'aucun chemin automatique ne saute le garde-fou de filiation');
    vrai(/'cloud-force'[\s\S]{0,600}?CloudSync\.push\(\{ force: true \}\)/.test(app),
      'mais l’arbitrage explicite du détenteur reste possible, et il se demande');
  });

  test('un cours rafraîchi ne date pas l’état', () => {
    /* LA CAUSE, et non plus seulement sa consequence. Tant que `Quotes.refresh()`
       estampille `savedAt`, ouvrir l'application suffit a faire passer un
       appareil pour porteur d'une modification, et la question « qui est en
       avance ? » reste sans reponse fiable. */
    const store = lireSource('assets/store.js');
    vrai(/if \(!opts\.derive\) this\.state\.meta\.savedAt = horodatageApres\(opts\.apres, this\.state\.meta\.savedAt\);/
      .test(store),
      'Store.save() ne date l’état que pour une écriture qui porte une décision');
    const q = lireSource('assets/quotes.js');
    const code = q.replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/\n\s*Store\.save\(\);/.test(code),
      'aucune écriture de la passerelle de cours ne date l’état');
    vrai((code.match(/Store\.save\(\{ derive: true \}\)/g) || []).length >= 2,
      'ni le rafraîchissement des cours, ni la résolution des ISIN');
  });
});

/* ------------------------------------------------------------------
   Un compte a deux bouts
   ------------------------------------------------------------------ */
suite('Un compte archivé reste consultable et daté', () => {

  /* Un compte archive reste cliquable, et porte une date de cloture comme il
     porte une date d'ouverture.

     Une carte des comptes archives qui ne rendrait que Restaurer et une croix,
     sans que le nom ouvre rien, rendrait un compte archive inatteignable, alors
     que c'est justement pour son historique qu'on l'archive plutot que de le
     supprimer. */

  test('l’entrée des archivés mène à leur écran, elle ne déplie plus une liste', () => {
    /* Le groupe repliait une liste de lignes, et chaque ligne ouvrait la fiche
       du compte. C'etait juste tant qu'on ne faisait que LIRE. Depuis que la
       gestion de ces comptes vit ici — restaurer, supprimer — un groupe ne
       suffit plus : ses lignes sont des boutons, et un bouton dans un bouton
       n'existe pas. L'entree mene donc a un ecran, qui porte les gestes. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/const anciens = comptesAnciens\(\);[\s\S]*?\n  \}\)\(\)\}/);
    vrai(bloc, 'l’entrée des comptes archivés doit être trouvable');
    vrai(/data-view="comptes-archives"/.test(bloc[0]), 'elle mène à l’écran dédié');
    vrai(!/groupe\('archives'/.test(bloc[0]), 'et ne rend plus un groupe repliable');
    vrai(!/ligneCompte\(c\)/.test(bloc[0]), 'ni les lignes de la liste des comptes');
    vrai(/'comptes-archives': \{ cle: 'accounts'/.test(src),
      'l’écran est enregistré sous la clé « accounts » : son retour remonte à Actifs');
  });

  test('restaurer se confirme, partout où le bouton existe', () => {
    /* Le bouton avait ete retire de la liste des archives d'Actifs, et pour une
       raison precise : il y etait a portee de pouce ET SANS QUESTION. C'est la
       question qui manquait, et elle vit desormais dans l'acte lui-meme. Le
       bouton peut donc revenir la ou ces comptes se GERENT — leur ecran — sans
       que le geste redevienne muet. La page Actifs, elle, ne fait que mener. */
    const src = lireSource('assets/app.js');
    const acte = src.match(/async 'restaurer-compte'\(btn\) \{[\s\S]*?\n  \},/);
    vrai(acte, 'la restauration doit être trouvable, et attendre une réponse');
    vrai(/askConfirm\(/.test(acte[0]),
      'et se confirmer : c’est un geste qu’on ne veut pas faire en visant autre chose');
    const fiche = src.match(/function viewFicheCompte\(id\) \{[\s\S]*?\n\}/);
    vrai(/data-action="restaurer-compte"/.test(fiche[0]),
      'la fiche le garde : c’est là qu’on agit sur un compte');
    const ecran = src.match(/function viewComptesArchives\(\) \{[\s\S]*?\n\}/);
    vrai(ecran && /data-action="restaurer-compte"/.test(ecran[0]),
      'et l’écran des archivés le porte : c’est là que ces comptes se gèrent');
    const entree = src.match(/const anciens = comptesAnciens\(\);[\s\S]*?\n  \}\)\(\)\}/);
    vrai(!/data-action="restaurer-compte"/.test(entree[0]),
      'la page Actifs, elle, ne fait que mener');
  });

  test('archiver demande la date, restaurer l’efface', () => {
    /* Un état se déclare, il ne se déduit pas : la date se pose au moment où on
       la connaît, et un compte rouvert ne peut pas rester « clôturé le… ». */
    const src = lireSource('assets/app.js');
    const arch = src.match(/async 'archiver-compte'\(btn\) \{[\s\S]*?\n  \},/);
    vrai(arch, 'l’archivage doit être trouvable');
    vrai(/cle: 'clotureLe'/.test(arch[0]),
      'archiver doit demander la date de clôture : c’est le seul moment où on la connaît');
    vrai(/c\.statut = 'archive'/.test(arch[0]), 'et poser le statut');

    const rest = src.match(/'restaurer-compte'\(btn\) \{[\s\S]*?\n  \},/);
    vrai(rest, 'la restauration doit être trouvable');
    vrai(/delete c\.clotureLe/.test(rest[0]),
      'restaurer doit effacer la date : « ouvert » et « clôturé le 12 mars » se '
      + 'contredisent, et c’est la date qu’on croirait');
  });

  test('la date ne s’affiche et ne s’édite que sur un compte clôturé', () => {
    /* L'offrir sur un compte ouvert ferait du formulaire une seconde façon de
       clôturer, muette et sans confirmation — deux surfaces pour un seul fait,
       et la plus discrète l'emporterait. */
    const src = lireSource('assets/app.js');
    const fiche = src.match(/function viewFicheCompte\(id\) \{[\s\S]*?\n\}/);
    vrai(fiche, 'la fiche d’un compte doit être trouvable');
    /* La phrase passe par trad() depuis qu'elle se traduit : le controle suit
       la garde `statut === 'archive'`, pas la langue du libelle. */
    vrai(/c\.statut === 'archive' \? `<dt>\$\{trad\('Date de clôture'\)\}<\/dt>/.test(fiche[0]),
      'la fiche ne montre la date que sur un compte archivé');

    const form = src.match(/async 'modifier-compte'\(btn\)[\s\S]*?\n  \},/);
    vrai(form, 'le formulaire de modification doit être trouvable');
    vrai(/if \(c\.statut === 'archive'\) champs\.push\(/.test(form[0]),
      'et le champ ne s’offre que là aussi');
    vrai(/if \('clotureLe' in v\) pose\('clotureLe', v\.clotureLe\)/.test(form[0]),
      'un champ vidé efface la clé, comme les autres champs de cette fenêtre');
  });
});

/* ------------------------------------------------------------------
   Marchés ne liste plus trois fois les mêmes lignes
   ------------------------------------------------------------------ */
suite('Une page ne liste pas trois fois les mêmes positions', () => {

  /* Positions ne montre pas trois fois de suite toutes les positions : la carte
     du jour, une performance par ligne, puis les lignes de titres. Une
     performance par ligne double la page Performance, a la fonction pres : les
     deux appelleraient `rankedBars` sur la plus-value latente par position,
     triee.

     Il reste deux listes, et elles repondent a deux questions differentes : ce
     qui a bouge aujourd'hui, et ce qu'on detient. La plus-value se lit sur la
     page dont c'est le sujet. */

  test('la page se lit du portefeuille vers le marché', () => {
    /* L'ORDRE EST VOULU. Un mouvement du jour lu avant tout autre chiffre n'a
       pas de referentiel : on sait combien on a avant d'apprendre de combien ca
       a bouge.

       Cinq questions, dans l'ordre ou on se les pose :
         ce qu'on a          -> la synthese du portefeuille
         ce qui a bouge      -> la carte du jour
         ce qu'on detient    -> les lignes de titres
         ce que fait le      -> les reperes de marche, qui sont du contexte
           marche               exterieur et ne s'intercalent pas
         ce qu'on a vendu    -> la recherche, puis le journal et le realise */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewPositions('),
                          src.indexOf('function mountPositions('));
    const ou = m => {
      const i = vue.indexOf(m);
      vrai(i > 0, `le bloc ${m} doit exister dans la vue Marchés`);
      return i;
    };
    /* La tete de page est fixe, le reste suit la disposition : l'ordre par
       defaut de `CARTES_MARCHES` porte desormais cette lecture, et la
       recherche d'un titre suit les lignes qu'elle sert. */
    const ret = vue.slice(vue.indexOf('  return `\n  ${barreEtatCours()}'));
    vrai(ret.indexOf('barreEtatCours()') >= 0
      && ret.indexOf(`trad('Portefeuille')`) > ret.indexOf('barreEtatCours()')
      && ret.indexOf('${composerMarches(blocsMarches)}') > ret.indexOf(`trad('Portefeuille')`),
      'l’état des cours, puis le portefeuille, puis les cartes rangées');
    eq(CARTES_MARCHES.join(), 'titres,retenir,reperes,ventes,achats',
      'par défaut : ce que je détiens juste après le portefeuille, les constats, le marché, puis les deux journaux');
    /* Le jour n'est plus une carte : il tient dans le portefeuille, sous la
       plus-value, et les lignes de titres le suivent. */
    const ptf = ret.slice(ret.indexOf(`trad('Portefeuille')`), ret.indexOf('${composerMarches(blocsMarches)}'));
    vrai(/\$\{sectionJour\(\)\}/.test(ptf), 'le jour se lit dans la carte du portefeuille');
    const bloc = id => vue.slice(vue.indexOf(`    ${id}: () => `), vue.indexOf('\n    ', vue.indexOf(`    ${id}: () => `) + 8));
    for (const [id, m] of [['retenir', "${carteInsights('positions', 'À retenir')}"],
                           ['titres', 'data-anchor="titres"'], ['reperes', 'id="reperesFamilles"'],
                           ['ventes', '\n  ${salesCard()}\n']])
      vrai(vue.indexOf(m) > vue.indexOf(`    ${id}: () => `), `« ${id} » porte son bloc`);
    vrai(ou('id="reperes"') - ou('id="reperesFamilles"') < 300,
      'les deux conteneurs des repères restent voisins');
    for (const m of ['${sectionJour()}', 'data-anchor="titres"', 'id="reperes"',
                     'id="reperesFamilles"', `trad('Portefeuille')`, '\n  ${salesCard()}\n'])
      eq(vue.split(m).length - 1, 1, `${m} n’apparaît qu’une fois`);
  });

  test('la synthèse porte enfin son nom, et le même dans les deux langues', () => {
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewPositions('),
                          src.indexOf('function mountPositions('));
    /* Depuis le calcul des parts et non depuis le `div` : les apercus se
       declarent dans le tableau `parts`, au-dessus du gabarit, et une tranche
       qui commence au `div` ne les voit pas. */
    const carte = vue.slice(vue.indexOf('const st = stockTotals();'),
                            vue.indexOf('${composerMarches(blocsMarches)}'));
    vrai(/<div class="card-head"><h2>\$\{trad\('Portefeuille'\)\}<\/h2><\/div>/.test(carte),
      'la carte de synthèse porte un titre');
    eq(I18N.en['Portefeuille'], 'Portfolio', 'et il est traduit');
    /* Le titre nomme, il ne décrit pas : la carte est déjà dense. */
    vrai(!/Résumé du portefeuille|Vue d’ensemble des positions|Investissements actuels/.test(vue),
      'et le titre reste un nom, pas une description');
    /* Rien n'est ajouté à son contenu : les deux barres, le prix de revient et
       la plus-value latente, et pas un indicateur de plus. */
    vrai(/apercu: 'portefeuille'/.test(carte) && /apercu: 'cashInvestir'/.test(carte),
      'les deux barres et leurs aperçus sont intacts');
    /* Les deux chiffres sont restés, leur rang a changé : la plus-value monte
       en tête avec sa propre ligne d'intitulé, le prix de revient recule d'un
       cran sous elle. « Prix de revient des titres » a perdu son suffixe, qui
       redisait le sujet de la carte. */
    vrai(/trad\('Plus-value latente'\)/.test(carte) && /label: 'Placements'/.test(carte),
      'la plus-value et la composition sont toujours là');
    /* Et elle ne s'affiche pas vide : sans part, elle ne se rend pas. */
    vrai(/if \(!parts\.length\) return '';/.test(vue),
      'une carte sans part ne se rend pas');
  });

});

/* ------------------------------------------------------------------
   Un réglage se voit
   ------------------------------------------------------------------ */
suite('L’objectif de dépenses se voit comme un réglage', () => {

  /* L'objectif se voit comme un reglage : le montant porte le signal de ce qui
     se modifie, en couleur d'accent.

     Un champ discret sans intitule, un champ etiquete qui doublonne avec son
     jumeau de l'onglet voisin, ou un montant souligne d'un pointille gris ne se
     voient pas. Ce signal-ci n'invente rien : c'est celui du montant des
     revenus, deux cartes plus bas, dont le chevron dit qu'on peut cliquer. Meme
     probleme, meme signal. */

  test('le montant porte l’accent et le chevron', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    vrai(/class="hero-delta-chev"/.test(src),
      'le chevron doit annoncer que ce montant s’ouvre');

    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible');
    const nu = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const bloc = nu.match(/\.hero-delta-reglable > b \{[^}]*\}/);
    vrai(bloc, 'la règle du montant réglable doit être trouvable');
    vrai(/color:\s*var\(--accent\)/.test(bloc[0]),
      'le montant doit porter l’accent : le pointillé gris ne se voyait pas');
    vrai(/var\(--accent\)/.test((nu.match(/\.hero-delta-reglable > b \{[^}]*\}/) || [''])[0]
      + (nu.match(/\.hero-delta-reglable > span \{[^}]*\}/) || [''])[0]),
      'et son intitulé aussi, pour que le couple se lise comme une commande');
  });

  test('les deux écarts voisins restent en gris', () => {
    /* C'est le contraste qui désigne. Peindre les trois ferait de l'accent une
       décoration, et il ne dirait plus lequel se règle. */
    const src = lireSource('assets/app.js');
    const vue = src.match(/function viewBudget\([\s\S]*?\n\}/);
    vrai(vue, 'la vue Budget doit être trouvable');
    const reglables = vue[0].match(/hero-delta-reglable/g) || [];
    eq(reglables.length, 1,
      `${reglables.length} écarts réglables : un seul des trois se règle, et c’est `
      + 'ce qui rend l’accent lisible');
  });

  test('les deux portes de l’objectif mènent au même réglage', () => {
    /* Le montant de la carte du mois et la barre « Objectif dépenses » ouvrent
       la même fenêtre. Deux portes sur un même champ sont saines ; deux champs
       ne le seraient pas, et c'est ce qui avait été retiré. */
    const src = lireSource('assets/app.js');
    const portes = src.match(/data-action="regler-objectif-depenses"/g) || [];
    /* Trois dans le code, deux à l'écran : la brique du mois a une version
       vide, avant la première dépense, qui porte sa propre porte — et ne se
       rend jamais en même temps que la pleine. Sans elle, un profil vierge
       sans revenu n'aurait aucun chemin vers l'objectif. */
    eq(portes.length, 3, `trois portes attendues, ${portes.length} trouvée·s`);
    const dv = src.indexOf('function briqueDepensesVide(');
    const vide = src.slice(dv, src.indexOf('\nfunction ', dv + 10));
    eq((vide.match(/data-action="regler-objectif-depenses"/g) || []).length, 1,
      'la brique vide porte une porte, et une seule');
    const champs = src.match(/data-path="meta\.monthlyTarget"|budget\.monthlyTarget'/g) || [];
    vrai(champs.length <= 1,
      'un seul champ pour l’objectif : deux ne peuvent pas se vérifier l’un l’autre');
  });
});

/* ------------------------------------------------------------------
   La barre du haut revient après un battement, pas au premier tremblement
   ------------------------------------------------------------------ */
suite('La barre du haut ne revient pas au moindre geste', () => {

  /* Le menu ne revient pas au moindre retour vers le haut : il faut un battement,
     environ un tiers d'ecran de glissement.

     Le motif du marche -- `enterAlways` de Material 3 -- rend la barre au premier
     geste vers le haut. En lecture, on remonte sans arret de quelques dizaines
     de pixels : pour relire une ligne, pour revoir un total qu'on vient de
     depasser. Chacune de ces corrections ferait retomber la barre sur le
     contenu, et elle repartirait au geste suivant.

     Le mecanisme vit dans un ecouteur de defilement, sans autre dependance que
     `window` et `document.body.classList` : on l'extrait de sa source et on le
     joue avec une fenetre et un corps de comedie. Une assertion sur le
     comportement vaut mieux qu'une recherche de motif -- et ici elle decrit
     exactement les gestes qu'un doigt peut faire. */
  function barre(hauteur = 900) {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const bloc = src.match(/\n  \(\(\) => \{\n    const SEUIL = 64, PAS = 6;[\s\S]*?\n  \}\)\(\);/);
    vrai(bloc, 'le mécanisme de la barre du haut doit être trouvable');

    const classes = new Set();
    const corps = {
      classList: {
        contains: c => classes.has(c),
        add: c => classes.add(c),
        remove: c => classes.delete(c),
        toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
      },
    };
    const ecouteurs = {};
    const fenetre = {
      scrollY: 0, innerHeight: hauteur,
      addEventListener: (nom, fn) => { (ecouteurs[nom] = ecouteurs[nom] || []).push(fn); },
    };
    /* `modalesOuvertes` est passé à zéro : ce contrôle porte sur le geste de
       lecture, pas sur la garde des fenêtres, qui a sa propre raison d'être. */
    new Function('window', 'document', 'modalesOuvertes', bloc[0])(fenetre, { body: corps }, 0);

    return {
      hauteur,
      cachee: () => classes.has('haut-cache'),
      sousPage: () => classes.add('sous-page'),
      /* Un geste, en une fois : le mécanisme ne compte que des distances, la
         vitesse ne l'intéresse pas. */
      vers: y => { fenetre.scrollY = y; (ecouteurs.scroll || []).forEach(fn => fn()); },
      changerDePage: () => (ecouteurs.hashchange || []).forEach(fn => fn()),
    };
  }

  test('descendre la retire, une fois passé le haut de page', () => {
    const b = barre();
    b.vers(40);
    vrai(!b.cachee(), 'sous le seuil on est encore en haut de page, la barre y reste');
    b.vers(600);
    vrai(b.cachee(), 'plus bas, elle se retire');
  });

  test('une correction de lecture ne la ramène pas', () => {
    /* Le geste type : on descend, on remonte de quarante pixels pour relire, et
       la barre ne doit pas retomber sur le texte. */
    const b = barre();
    b.vers(600);
    vrai(b.cachee(), 'elle est retirée');
    b.vers(560);
    vrai(b.cachee(), 'quarante pixels vers le haut ne la ramènent pas');
    b.vers(520);
    vrai(b.cachee(), 'ni quatre-vingts');
  });

  test('un tiers d’écran la ramène', () => {
    const b = barre(900);
    b.vers(900);
    vrai(b.cachee(), 'elle est retirée');
    b.vers(900 - (b.hauteur / 3 - 20));
    vrai(b.cachee(), 'juste sous le battement, elle ne bouge pas encore');
    b.vers(900 - (b.hauteur / 3 + 20));
    vrai(!b.cachee(), 'passé le tiers d’écran cumulé, elle revient');
  });

  test('le battement se cumule, et une reprise vers le bas le remet à zéro', () => {
    /* C'est ce zéro qui distingue lire de vouloir revenir : une remontée hachée
       de corrections successives ne doit pas finir par déclencher le retour. */
    const b = barre(900);
    b.vers(1200);
    for (let i = 1; i <= 4; i++) b.vers(1200 - i * 50);      // 200 px cumulés
    vrai(b.cachee(), 'quatre corrections de cinquante pixels restent sous le battement');
    b.vers(1050);                                            // on repart vers le bas
    b.vers(1000);
    b.vers(950);                                             // 100 px, compteur remis à zéro
    vrai(b.cachee(), 'le compteur est reparti de zéro, la barre reste retirée');

    /* Et un vrai geste, lui, la ramène d'un coup. */
    b.vers(600);
    vrai(!b.cachee(), 'un lancer de trois cent cinquante pixels la ramène');
  });

  test('revenir au sommet la ramène sans battement', () => {
    /* Sinon la page du haut pourrait rester décapitée : sur un écran haut, le
       tiers demandé peut dépasser ce qui reste à remonter. */
    const b = barre(900);
    b.vers(200);
    vrai(b.cachee(), 'elle est retirée');
    b.vers(0);
    vrai(!b.cachee(), 'arriver en haut de page la rend, quoi qu’ait fait le compteur');
  });

  test('une sous-page garde la sienne, et changer d’écran la rend', () => {
    const b = barre();
    b.sousPage();
    b.vers(800);
    vrai(!b.cachee(), 'une sous-page ne cache jamais sa barre : elle y porte le retour');

    const c = barre();
    c.vers(800);
    vrai(c.cachee(), 'retirée');
    c.changerDePage();
    vrai(!c.cachee(), 'changer d’écran la rend : on arrive en haut d’une page neuve');
  });

  test('le battement se mesure en fraction d’écran, pas en pixels', () => {
    /* Sur un iPhone SE et sur une tablette, le même geste couvre une fraction
       d'écran comparable, pas une distance comparable. */
    const petit = barre(600), grand = barre(1200);
    petit.vers(900); grand.vers(900);
    petit.vers(900 - 250); grand.vers(900 - 250);
    vrai(!petit.cachee(), 'deux cent cinquante pixels dépassent le tiers d’un petit écran');
    vrai(grand.cachee(), 'mais pas celui d’un grand');
  });
});

/* ------------------------------------------------------------------
   La barre latérale reste, et se laisse parcourir
   ------------------------------------------------------------------ */
suite('La barre latérale ne s’en va pas avec la page', () => {

  /* Le menu du haut reste en place quand on defile, et c'est un defaut s'il
     defile avec l'ecran.

     Une barre en `position: sticky; top: 0` peut quand meme partir avec la page :
     sur un document de 2 062 px a 1 280 x 900, elle serait a `top: -800px` apres
     un defilement de 800, sans un pixel de retenue.

     La cause n'est pas dans sa regle mais deux cents lignes plus haut :
     `html, body { height: 100% }` plafonnerait le corps a la hauteur de l'ecran.
     Or le corps est la grille qui porte cette barre, donc sa zone de grille
     ferait exactement la hauteur de la barre -- et un element colle n'a de
     course que dans son bloc conteneur.

     Ce que ca couterait : le pied de cette barre porte le patrimoine net en
     permanence, et l'accueil compte sur lui. Il s'en irait au premier
     defilement. */

  function cssNuDeLaFeuille() {
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  test('le corps peut dépasser l’écran, sinon rien ne peut y coller', () => {
    const nu = cssNuDeLaFeuille();
    vrai(!/\bhtml,\s*body\s*\{[^}]*\bheight:\s*100%/.test(nu),
      'le corps ne doit plus être plafonné à la hauteur de l’écran : sa grille '
      + 'est le bloc conteneur de la barre latérale, et une zone aussi haute que '
      + 'la barre ne lui laisse aucune course');
    const corps = nu.split('}').find(b => b.split('{')[0].trim() === 'body');
    vrai(corps, 'la règle « body » doit exister');
    vrai(/min-height:\s*100%/.test(corps),
      'et il ne descend pas sous un écran : c’est ce qui garde le fond peint '
      + 'd’un bord à l’autre sur une page courte');
  });

  test('la première règle « body » est bien celle de la police', () => {
    /* Le contrôle de la police des montants cherche « le bloc dont le sélecteur
       est exactement body », et prend le premier. Il y en a plusieurs — les
       requêtes média en portent — mais celui de tête doit rester le principal :
       une règle du même nom glissée avant lui ferait lire autre chose que ce
       qu'il croit lire. C'est arrivé en écrivant ce correctif, et c'est le test
       de la police qui l'a attrapé. */
    const nu = cssNuDeLaFeuille();
    const premier = nu.split('}').find(b => b.split('{')[0].trim() === 'body');
    vrai(premier, 'la règle « body » doit exister');
    vrai(/font-family:\s*var\(--font\)/.test(premier),
      'la première règle « body » de la feuille doit être la règle principale : '
      + 'c’est elle que le contrôle de la police lit');
  });

  test('elle reste collée en haut, et défile en elle-même si elle déborde', () => {
    /* Deux choses distinctes, et la seconde est l'autre moitié du défaut :
       dans une fenêtre de 560 px de haut, son contenu en fait 655. Sans
       défilement interne, le pied — patrimoine net et témoin de sauvegarde —
       était purement inatteignable. */
    const nu = cssNuDeLaFeuille();
    const regle = nu.split('}').find(b => b.split('{')[0].trim() === '.sidebar'
      && /position:/.test(b));
    vrai(regle, 'la règle de la barre latérale doit être trouvable');
    vrai(/position:\s*sticky/.test(regle) && /top:\s*0/.test(regle),
      'elle se colle en haut de la fenêtre');
    vrai(/overflow-y:\s*auto/.test(regle),
      'et se laisse parcourir quand elle ne tient pas : sinon son pied est perdu '
      + 'sur un écran court');
    vrai(/overscroll-behavior:\s*contain/.test(regle),
      'sans emporter la page une fois son bas atteint');
  });
});

/* ------------------------------------------------------------------
   Un montant masqué reste un dessin, jamais du balisage en clair
   ------------------------------------------------------------------ */
suite('Le mode masqué n’imprime pas ses balises', () => {

  /* En mode masque, aucune carte ne montre du balisage a la place d'un texte :
     une note comme dont tant a investir, sous la ligne Liquidites d'Allocation,
     afficherait sinon cent caracteres de balise.

     Un montant masque n'est pas du texte : c'est une balise SVG, l'oeil barre
     qui remplace les chiffres. Une note qui mele du texte libre et un montant
     doit donc passer par `escMontant`, qui echappe tout puis restitue le seul
     fragment que nous ayons produit -- et non par `esc`, qui l'imprime en clair.

     La regle reste `esc` partout ailleurs : une note saisie par l'utilisateur ne
     doit jamais traverser. Ce controle verifie donc les deux sens. */

  test('une note qui porte un montant passe par escMontant', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    /* Les producteurs : les notes construites avec un formateur de montant. */
    const producteurs = [...src.matchAll(/note:[\s\S]{0,160}?\$\{fmt(EUR|Signed|Pct)/g)];
    vrai(producteurs.length,
      'au moins une note doit être construite à partir d’un montant, sinon ce '
      + 'contrôle ne protège plus rien');

    /* Le consommateur de celle d'Allocation, la seule dans ce cas. */
    vrai(/\$\{escMontant\(i\.note\)\}/.test(src),
      'la note de la table d’allocation doit passer par escMontant : elle porte '
      + '« dont X € à investir », et un montant masqué est une balise');
    vrai(!/\$\{esc\(i\.note\)\}/.test(src),
      'et surtout pas par esc, qui l’imprimerait en clair');
  });

  test('les notes saisies restent échappées', () => {
    /* L'autre moitié, et elle compte autant : `escMontant` sur une note tapée
       par l'utilisateur laisserait passer un fragment de balisage si quelqu'un
       collait le dessin de l'œil dans un commentaire de mois. Ces notes-là
       gardent l'échappement strict. */
    const src = lireSource('assets/app.js');
    vrai(/\$\{esc\(cur\.note\)\}/.test(src),
      'le commentaire d’un mois est une saisie : il reste échappé');
    /* La note passe par trad() depuis qu'elle se traduit, mais esc() reste la
       derniere barriere : la traduction se fait DANS l'echappement, jamais
       apres lui. L'ordre inverse laisserait passer le balisage d'une entree
       anglaise. */
    vrai(/\$\{esc\(trad\(x\.note\)\)\}/.test(src),
      'la note d’un palier d’autonomie est de la prose : elle aussi, et esc() reste dehors');
  });

  test('escMontant ne laisse passer que ce que nous produisons', () => {
    /* Le fragment restitué est comparé à celui que nous avons fabriqué, échappé.
       Rien d'autre ne traverse : c'est ce qui distingue cette variante d'un
       simple `innerHTML`. */
    const src = lireSource('assets/app.js');
    const bloc = src.match(/const escMontant = s => \{[\s\S]*?\n\};/);
    vrai(bloc, 'escMontant doit être trouvable');
    vrai(/const t = esc\(s\);/.test(bloc[0]),
      'elle échappe tout d’abord : un texte saisi ne doit jamais traverser');
    vrai(/split\(esc\(OEIL_MASQUE\)\)\.join\(OEIL_MASQUE\)/.test(bloc[0]),
      'puis restitue le seul fragment que nous ayons produit, reconnu sous sa '
      + 'forme échappée');
  });

  test('aucun montant formaté ne part dans un canal texte', () => {
    /* Une fenetre d'apercu ne se recouvre pas de balisage : un sous-titre qui
       compose objectif ${fmtEUR0(cible)} par mois et part dans textContent
       imprime une balise au lieu de la dessiner.

       Corriger une fenetre seule referait le defaut au prochain apercu -- une
       quarantaine composent leurs textes ainsi. La regle se derive donc de la
       source : une affectation `.textContent =` ne peut pas porter un
       formateur de montant dans sa propre expression. Ceux qui en portent un
       passent par escMontant et innerHTML, comme les tuiles et les
       notifications. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    for (const m of src.matchAll(/\.textContent = [^;]{0,300}/g)) {
      vrai(!/fmt(EUR0?|Cur|Signed|Mois)\(|masque\(/.test(m[0]),
        'un montant formaté est une balise en mode discret, il ne peut pas '
        + `partir dans textContent : ${m[0].slice(0, 90)}`);
    }

    /* Et les canaux des apercus, la ou la photo a ete prise : le sous-titre,
       la note du total et les meta de lignes recoivent des chaines composees
       par une quarantaine de producteurs — ils passent par escMontant, a
       l'ouverture comme au rafraichissement. */
    for (const canal of [/#modalSub'\)\.innerHTML = escMontant\(a\.sous/g,
                         /escMontant\(noteApercu\(a\)\)/g,
                         /escMontant\(l\.meta\)/g]) {
      vrai((src.match(canal) || []).length >= 2,
        `le canal ${canal.source.slice(0, 40)} doit passer par escMontant à `
        + 'l’ouverture et à la mise à jour');
    }
  });
});

/* ------------------------------------------------------------------
   L'échelle visuelle est fermée

   Une interface dont aucun coin ne repond au voisin a l'air assemblee, pas
   dessinee. Vingt-trois rayons distincts, seize graisses et des ombres noires
   ecrites en dur, identiques dans les deux themes : aucune de ces differences
   n'est une decision -- 7 px contre 8 px ne se voit pas -- mais leur somme se
   voit.

   La regle est celle des couleurs, deja en place plus haut : une echelle
   se ferme, et la valeur suivante demande d'elargir l'echelle, pas de
   glisser une valeur orpheline. Ces controles se derivent de la feuille
   entiere : la regle ecrite demain est deja couverte.
   ------------------------------------------------------------------ */
suite('L’échelle visuelle est fermée', () => {

  const feuille = () => (lireSource('assets/styles.css') || '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  test('les rayons viennent de l’échelle, pas du pifomètre', () => {
    /* Autorisé : les jetons (var), 0, les pourcentages, les micro-arrondis
       jusqu'à 4 px (ils suivent la hauteur d'une barre ou d'une coche, pas
       l'échelle), et 16 px et plus (le tiroir mobile arrondit à 20, un cran
       au-dessus des cartes, et c'est voulu : c'est une surface d'un autre
       ordre). Interdit : tout rayon nu de 5 à 15 px — il a un jeton — et les
       pilules écrites 99 ou 999. */
    const css = feuille();
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const decls = [...css.matchAll(/border-radius:([^;}]*)/g)];
    vrai(decls.length > 40, 'la feuille déclare bien ses rayons');
    for (const d of decls) {
      for (const [, n] of d[1].matchAll(/(\d+(?:\.\d+)?)px/g)) {
        const v = parseFloat(n);
        vrai(v <= 4 || v >= 16,
          `rayon nu de ${v}px : entre 5 et 15 px, l’échelle a un jeton `
          + `(--radius-xs 6, --radius-sm 9, --radius 14) — ${d[0].slice(0, 60)}`);
        vrai(v !== 99 && v !== 999,
          `une pilule s’écrit var(--radius-pill), pas ${v}px`);
      }
    }
  });

  test('les graisses viennent de l’échelle', () => {
    /* Huit paliers, chacun un rôle : 400 prose, 500 interface, 550 libellé
       appuyé, 600 accentué, 650 titres et chiffres, 680 titres Manrope, 700
       gras fort, 720 héros de page. Les 450, 560, 620, 640, 740, 750 et 760
       qui vivaient entre deux paliers n'étaient pas des nuances : personne ne
       distingue 640 de 650, et chaque écart était une occasion de diverger. */
    const css = feuille();
    const permis = new Set([400, 500, 550, 600, 650, 680, 700, 720]);
    const decls = [...css.matchAll(/font-weight: *(\d+)(?! *\d)/g)];
    vrai(decls.length > 60, 'la feuille déclare bien ses graisses');
    for (const [, p] of decls) {
      vrai(permis.has(+p),
        `graisse ${p} hors échelle : les paliers sont ${[...permis].join(', ')}`);
    }
  });

  test('aucune ombre noire écrite en dur : trois niveaux, réglés par thème', () => {
    /* Un menu, une infobulle et une fenêtre portaient chacun leur propre noir,
       le même dans les deux thèmes : 45 % de noir sous un menu en thème clair
       pèse trois fois trop lourd. `--shadow` pose, `--ombre-flottante`
       détache, `--ombre-fenetre` recouvre — et chaque thème règle sa densité
       dans son bloc de jetons, seul endroit où le noir a le droit de
       s'écrire. */
    const css = feuille();
    for (const d of css.matchAll(/box-shadow:([^;}]*)/g)) {
      /* Les biseaux `inset` sont de la matiere, pas de l'elevation : le verre
         de l'ovale melange un liseret clair et une penombre interne, regles
         sur un vrai telephone. L'echelle des ombres ne gouverne que ce qui
         flotte au-dessus de la page. */
      if (/inset/.test(d[1])) continue;
      vrai(!/rgba\(0, ?0, ?0/.test(d[1]),
        `ombre noire en dur hors jetons : ${d[0].slice(0, 70)}`);
    }
    /* Et les jetons existent dans les deux thèmes, sans quoi le sombre
       hériterait des densités du clair. */
    const brut = lireSource('assets/styles.css') || '';
    for (const jeton of ['--ombre-flottante', '--ombre-fenetre']) {
      vrai((brut.match(new RegExp(`${jeton}:`, 'g')) || []).length === 2,
        `${jeton} se règle dans les deux thèmes`);
    }
  });

  test('les règles d’une tuile vivent une fois', () => {
    /* Les trois règles de tuile existaient en deux exemplaires contradictoires
       à quarante lignes d'écart — 23/700 contre 24/620 pour le chiffre. L'écran
       rendait la fusion des deux, propriété par propriété : retoucher un
       exemplaire ne changeait que la moitié du rendu, sans erreur nulle part. */
    const css = feuille();
    for (const sel of ['.tile .t-label', '.tile .t-value', '.tile .t-meta']) {
      const n = (css.match(new RegExp(sel.replace(/[.]/g, '\\.') + ' *\\{', 'g')) || []).length;
      eq(n, 1, `${sel} doit être déclaré une seule fois, il l’a déjà été deux`);
    }
  });

  test('l’espacement en ligne suit les paliers 4, 8 et 12', () => {
    /* 196 styles en ligne dans les gabarits, dont des marges à 6, 10, 12, 14
       et 16 px pour le même geste — pousser un bloc sous son voisin. Personne
       ne choisissait entre 10 et 12 : c'était la valeur du jour. Trois paliers
       suffisent — micro, serré, courant ; au-delà, c'est une classe de la
       feuille qui décide. Les marges composées (quatre valeurs, ou mêlées à
       une autre propriété) restent hors du contrôle : elles règlent des cas
       de mise en page, pas un empilement. */
    const src = lireSource('assets/app.js') || '';
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    for (const m of src.matchAll(/style="margin(?:-top|-bottom)?:(\d+)px(?: 0 0)?"/g)) {
      vrai(['4', '8', '12'].includes(m[1]),
        `marge en ligne de ${m[1]}px : les paliers sont 4, 8 et 12 — ${m[0]}`);
    }
  });
});

/* --- Annuler est une decision ---------------------------------------------
   Le vrai `Store.save()`, hors exemple, avec un faux `CloudSync` qui compte les
   envois. `save()` ecrit le stockage de cette origine : la chaine brute est mise
   de cote avant et remise telle quelle apres, comme pour tout geste qui
   enregistre. L'horloge est figee : deux gestes dans la meme milliseconde
   doivent quand meme recevoir deux dates. */
suite('Annuler passe par l’enregistrement ordinaire', () => {
  test('un envoi, une date plus récente que l’état annulé, rien de réempilé', () => {
    const demo0 = modeDemo();
    const cs0 = Object.getOwnPropertyDescriptor(globalThis, 'CloudSync');
    const flash0 = Object.getOwnPropertyDescriptor(globalThis, 'flashSaved');
    const now0 = Date.now;
    const pile0 = Store._undo, prev0 = Store._prev, push0 = Store._lastPush, ko0 = Store._ecritureKo;
    setModeDemo(false);
    const cle = cleStockage();
    const brut = localStorage.getItem(cle);
    let envois = 0;
    try {
      globalThis.CloudSync = { isAvailable: () => true, push() { envois++; }, schedulePush() {} };
      if (!flash0) globalThis.flashSaved = () => {};
      Date.now = () => Date.parse('2026-10-10T12:00:00.000Z');
      Fixture.poser();
      Store._undo = []; Store._prev = structuredClone(Store.state); Store._lastPush = 0;

      Store.state.meta.objective = 111111; Store.save();
      const t1 = Store.state.meta.savedAt;
      Store._lastPush = 0;
      Store.state.meta.objective = 222222; Store.save();
      const t2 = Store.state.meta.savedAt;
      vrai(t2 > t1, `horloge figée, deux gestes : deux dates (${t1}, ${t2})`);
      eq(envois, 2, 'chaque geste part en ligne');
      eq(Store.undoCount(), 2, 'deux états à défaire');

      vrai(Store.undo(), 'il restait de quoi annuler');
      eq(Store.state.meta.objective, 111111, 'l’état d’avant revient');
      vrai(Store.state.meta.savedAt > t2, 'daté après l’état annulé, que le cloud porte peut-être');
      eq(envois, 3, 'et l’annulation part en ligne');
      eq(Store.undoCount(), 1, 'la pile baisse d’un, sans réempiler l’état annulé');
      eq(JSON.parse(localStorage.getItem(cle)).meta.objective, 111111, 'l’écriture locale suit');

      vrai(Store.undo(), 'un second Annuler');
      eq(Store.state.meta.objective, Fixture.etat().meta.objective, 'remonte d’un cran, pas vers l’état annulé');
      eq(Store.undo(), false, 'pile vide : rien à annuler');
      eq(envois, 4, 'et rien ne part pour rien');
    } finally {
      Date.now = now0;
      if (brut === null) localStorage.removeItem(cle); else localStorage.setItem(cle, brut);
      setModeDemo(demo0);
      if (cs0) Object.defineProperty(globalThis, 'CloudSync', cs0); else delete globalThis.CloudSync;
      if (!flash0) delete globalThis.flashSaved;
      Store._undo = pile0; Store._prev = prev0; Store._lastPush = push0; Store._ecritureKo = ko0;
      Fixture.poser();
    }
    eq(localStorage.getItem(cle), brut, 'le stockage de cette origine est rendu tel quel');
  });

  test('la date suit l’horloge, ou dépasse la plus récente connue', () => {
    const now0 = Date.now;
    try {
      Date.now = () => Date.parse('2026-10-10T12:00:00.000Z');
      eq(horodatageApres(), '2026-10-10T12:00:00.000Z', 'rien de connu : l’horloge');
      eq(horodatageApres('2026-10-10T11:00:00.000Z'), '2026-10-10T12:00:00.000Z', 'l’horloge avance : elle');
      eq(horodatageApres('2026-10-10T12:00:00.000Z'), '2026-10-10T12:00:00.001Z', 'même milliseconde : une de plus');
      eq(horodatageApres('2026-10-11T08:00:00.000Z', '2026-10-10T09:00:00.000Z'), '2026-10-11T08:00:00.001Z',
        'horloge en retard : la plus récente connue, plus une');
      eq(horodatageApres('', 'n’importe quoi', undefined), '2026-10-10T12:00:00.000Z', 'l’illisible ne compte pas');
    } finally { Date.now = now0; }
  });
});

finDePartieDeTests('tests/09-ligne-projection-annonce-taux.tests.js');
