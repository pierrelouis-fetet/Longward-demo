partieDeTests('tests/21-premier-ecran-patrimoine-abord.tests.js');
/* ------------------------------------------------------------------
   Derniere passe avant les utilisateurs
   ------------------------------------------------------------------ */
suite('Premier écran : le patrimoine d’abord, et rien de vide', () => {

  const vue = () => {
    const app = lireSource('assets/app.js');
    const d = app.indexOf('function viewOverview()');
    return app.slice(d, app.indexOf('\nfunction ', d + 10));
  };

  test('le hero ne se rend pas sans compte : pas de coquille vide sous le guide', () => {
    /* Sur un profil vierge, tout ce que la carte porte se taisait deja — sauf la
       carte : un cadre de cinquante pixels, vide, entre le guide et l'explication.
       Mesure a 375 px. La garde englobe la carte entiere, et c'est la meme que
       celle de l'intitule et du montant : un seul fait decide. */
    const v = vue();
    vrai(/\$\{!aUnComptePropre\(\) \? '' : `\s*<div class="hero">/.test(v),
      'la carte entière attend le premier compte, pas seulement son contenu');
    /* Le commentaire HTML est optionnel : le depot public est servi sans
       commentaires, et ce controle doit etre vert des deux cotes. */
    vrai(/<\/div>`\}\s*(?:<!--[^>]*-->\s*)?\$\{guideDevant \? '' : guide\}/.test(v),
      'et la garde se ferme juste avant le guide replié');
  });

  test('les bandeaux d’exploitation passent sous le patrimoine', () => {
    /* « Enregistrer le releve de sept. 26 » etait la premiere ligne de l'ecran des
       que le guide etait referme : un rappel d'exploitation au-dessus du chiffre
       que l'application existe pour montrer. Les deux bandeaux se lisent sous le
       hero et sous le guide replie, qui ne coexistent jamais avec eux. */
    const v = vue();
    const hero = v.indexOf('<div class="hero">');
    const guideDerriere = v.indexOf("${guideDevant ? '' : guide}");
    const releve = v.indexOf("${moisEnAttente.missing && !guide ?");
    const depenses = v.indexOf("${depEnAttente.missing && !guide ?");
    /* Le point a retenir revient a part quand il ouvre la page, voir
       cartesApercu() ; les autres cartes suivent les bandeaux. */
    const retenir = v.indexOf('${cartes.tete}');
    const repart = v.indexOf('${cartes.suite}');
    vrai(hero > 0 && guideDerriere > hero, 'les repères existent, dans l’ordre connu');
    /* Et apres le point a retenir : un releve a prendre reste visible, mais ce
       n'est pas ce qu'on vient lire en premier. */
    vrai(retenir > guideDerriere && releve > retenir, 'le point à retenir passe avant les bandeaux');
    vrai(CARTES_APERCU[0] === 'retenir', 'et il ouvre la page par défaut');
    vrai(releve > guideDerriere && depenses > releve,
      'le relevé puis les dépenses, tous deux après le guide replié');
    vrai(depenses < repart, 'et avant tout ce qui commente le chiffre');
    vrai(v.indexOf('class="rappel card-cliquable"') > hero, 'aucun bandeau au-dessus du hero');
  });

  test('à quatre pas sur quatre, le guide tient en une ligne', () => {
    /* Il redevenait une pleine carte au dernier pas — 335 px a 375 — pour dire
       « c'est fait ». La barre repliee existait deja ; l'etat final l'emprunte,
       avec le seul geste qui reste. Il ne se ferme pas tout seul : disparaitre a
       l'instant ou l'on vient d'agir ressemble a une perte. */
    const app = lireSource('assets/app.js');
    const d = app.indexOf('function carteDemarrage()');
    const carte = app.slice(d, app.indexOf('\nfunction ', d + 10));
    const fini = carte.slice(carte.indexOf('if (fini) {'), carte.indexOf('return `\n  <div class="card demarrage">'));
    vrai(fini.length > 50, 'la branche finie existe avant la pleine carte');
    vrai(/class="card demarrage demarrage-barre demarrage-fini"/.test(fini), 'et c’est la barre d’une ligne');
    vrai(/✓ \$\{trad\('Tout est en place'\)\}/.test(fini), 'une coche et trois mots');
    vrai(/data-action="fermer-demarrage"/.test(fini), 'le seul geste qui reste : refermer');
    vrai(!/Refermer le guide/.test(app) && !/Ce guide a fait son travail/.test(app),
      'la pleine carte ne félicite plus : elle n’a plus d’état fini');
    vrai(!!I18N.en['Tout est en place'] && !!I18N.en['Refermer'], 'les deux mots existent en anglais');
    vrai(!I18N.en['Refermer le guide'], 'et l’ancien bouton n’a plus de clef');
  });
});

suite('Démarrage : le local d’abord, là où il n’y a personne à confondre', () => {

  test('la sonde ne précède la lecture que si le site peut tenir des comptes', () => {
    /* 3,3 s mesurees avant le premier pixel sur la demonstration avec des donnees
       locales et une passerelle qui pend, pour une sonde dont la reponse ne
       changeait rien a la lecture. La page se rend d'abord, la sonde part apres.
       Mais seulement sur un fait deja constate — le site a repondu « sans
       comptes » — jamais sur une supposition : premiere visite, site muet et
       instance a comptes gardent l'identite avant toute lecture. */
    const app = lireSource('assets/app.js');
    const d = app.indexOf('(async function init()');
    const init = app.slice(d, app.indexOf('CloudSync.setOnChange', d));
    vrai(/const localDAbord = CloudSync\.sansComptesConnu\(\);/.test(init), 'un seul fait décide');
    const garde = init.indexOf('if (!localDAbord) {');
    const sonde = init.indexOf('await CloudSync.probe();');
    const lecture = init.indexOf('Store.load();');
    const rendu = init.indexOf('\n  render();');
    const differee = init.indexOf('if (localDAbord) {');
    vrai(garde > 0 && sonde > garde && lecture > sonde, 'hors chemin local, la sonde précède toujours la lecture');
    vrai(/if \(!localDAbord\) \{\s*await CloudSync\.probe\(\);/.test(init), 'et c’est la garde qui la tient');
    vrai(rendu > lecture && differee > rendu, 'sur le chemin local, la page est rendue avant la sonde différée');
    vrai(/if \(localDAbord\) \{\s*await CloudSync\.probe\(\);\s*const portee = CloudSync\.getUserId\(\);\s*if \(portee\) \{\s*setStorageScope\(portee\);\s*relireMasque\(\);\s*Store\.load\(\);\s*render\(\);/.test(init),
      'une identité qui apparaîtrait quand même recadre la lecture et redessine');
    vrai(/else if \(CloudSync\.comptesActifs\(\)\) \{[\s\S]*?ecranIdentiteManquante\(\);\s*return;/.test(init),
      'le refus sans identité, sur un site à comptes, ne bouge pas');
  });

  test('« sans comptes connu » est un fait écrit par une sonde, jamais une absence', () => {
    const cs = lireSource('assets/cloudsync.js');
    vrai(/const sansComptesConnu = \(\) => \{\s*try \{ return localStorage\.getItem\(COMPTES_KEY\) === '0'; \}/.test(cs),
      'le drapeau doit valoir exactement « 0 » : absent, il ne dit rien');
    vrai(/sansComptesConnu,/.test(cs.slice(cs.lastIndexOf('return {'))), 'et il est exporté');
    vrai(/if \(d && typeof d\.accounts === 'boolean'\) \{\s*comptes = d\.accounts;\s*try \{ localStorage\.setItem\(COMPTES_KEY, comptes \? '1' : '0'\)/.test(cs),
      'seule une réponse du serveur l’écrit');
  });
});

suite('Vocabulaire : un relevé, un verbe', () => {

  test('le geste se dit « Enregistrer », en français comme en anglais', () => {
    /* Quatre verbes pour un meme geste — ajouter, creer, enregistrer, prendre —
       et un cinquieme mot en anglais, « snapshot », qui designait aussi la vue
       d'ensemble et l'export. Un mot, un geste. */
    const app = lireSource('assets/app.js');
    for (const mort of ['+ Ajouter un relevé', '+ Ajouter le relevé', '+ Ajouter ton premier relevé', 'Créer mon relevé'])
      vrai(!app.includes(`trad('${mort}')`) && !I18N.en[mort], '« ' + mort + ' » n’a plus d’appelant ni de clef');
    for (const [fr, en] of [['Enregistrer un relevé', 'Record a statement'], ['Enregistrer le relevé', 'Record the statement'],
                            ['Enregistrer ton premier relevé', 'Record your first statement'],
                            ['Enregistrer mon relevé', 'Record my statement'],
                            ['Enregistrer un relevé pour {m} ?', 'Record a statement for {m}?']])
      eq(I18N.en[fr], en, '« ' + fr + ' » se dit avec le même verbe');
    vrai(!Object.values(I18N.en).some(v => /snapshot/i.test(v)), 'aucune valeur anglaise ne dit snapshot');
    vrai(!Object.keys(I18N.en).some(k => /snapshot/i.test(k)), 'ni aucune clef');
    /* Le nom technique de la fenetre reste : c'est du code, il ne s'affiche pas. */
    vrai(/function askMonthlySnapshot\(index\)/.test(app), 'la fenêtre garde son nom de code');
  });
});

suite('Le pourcentage tient sur sa ligne', () => {

  test('la colonne des parts ne se coupe pas au téléphone', () => {
    /* « 32,09 » puis « % » a la ligne, a 390 px, dans le tableau sous l'anneau du
       portefeuille : la regle du telephone autorise la coupure n'importe ou dans
       une cellule, et la colonne des parts est la plus etroite. */
    const app = lireSource('assets/app.js');
    const css = lireSource('assets/styles.css');
    vrai(/<td class="muted pct">\$\{i\.pct == null \? '' : fmtPct\(i\.pct, 1\)\}<\/td>/.test(app), 'la cellule se nomme');
    vrai(/\.card > table td\.pct \{ white-space: nowrap; overflow-wrap: normal; \}/.test(css),
      'et la feuille la tient sur une ligne, plus fort que la règle de repli');
    const repli = css.indexOf('white-space: normal; overflow-wrap: anywhere;');
    vrai(repli > 0 && css.indexOf('td.pct { white-space: nowrap') > repli,
      'déclarée après la règle qu’elle contredit, pour gagner à spécificité égale ou non');
  });
});

suite('Trois montants voisins, trois noms qui disent leur périmètre', () => {

  test('chaque total se décompose en parts nommées, et aucun calcul ne bouge', () => {
    /* Mesure sur la demonstration : « Tes titres » 48 586, « Investi » 51 586,
       « Ton portefeuille » 52 177. Les trois etaient justes et personne ne pouvait
       dire pourquoi ils differaient. Les relations ci-dessous sont celles que les
       noms doivent laisser deviner :
         titres            = positions cotees
         comptes de marche = titres + lignes sans cours des comptes de marche + cash a investir
         placements        = comptes de marche - cash a investir + autres placements hors liquidites */
    const titres = latentPnl().value;
    const lignesSansCours = comptesOuverts()
      .filter(c => typeCompte(c.type).groupe === 'bourse')
      .flatMap(c => c.lignes || []).reduce((s, l) => s + num(l.valeur), 0);
    const aInvestir = poches().investir;
    const pf = repartitionPortefeuille();
    if (pf) pres(pf.total, titres + lignesSansCours + aInvestir, 'les comptes de marché : titres, sans cours, à investir');
    const autres = comptesOuverts()
      .filter(c => !estHorsPerimetreFinancier(c) && !['cash', 'bourse'].includes(typeCompte(c.type).groupe))
      .reduce((s, c) => s + valeurCompte(c), 0);
    pres(nowTotals().invested - horsFinancierTotal(), titres + lignesSansCours + autres,
      'les placements : tout ce qui n’est pas des liquidités, dans le périmètre financier');
  });

  test('les trois noms sont trois périmètres, et se lisent sans deviner', () => {
    const app = lireSource('assets/app.js');
    vrai(/<h2>\$\{trad\('Tes titres'\)\}<\/h2>/.test(app), 'les positions cotées gardent leur nom');
    vrai(/<p class="tete-legende">\$\{mentionBase\(\{ de: trad\('de tes comptes de marché'\) \}, pf\.total\)\}/.test(app), 'l’anneau porte le périmètre qu’il additionne');
    vrai(!/trad\('Ton portefeuille'\)/.test(app), 'et « Ton portefeuille », qui valait un autre montant que « Portefeuille », est parti');
    vrai(/const nomPortefeuille = \(\) => trad\('Comptes de marché'\);/.test(app), 'le centre de l’anneau et le pied du tableau disent la même chose');
    vrai(/Tes comptes de marché portent tes titres cotés, leurs placements sans cours et le cash qui y attend d’être investi\./.test(app),
      'et la phrase dessous décompose le total');
    /* Par la source, et non par `BASES.place.nom` : cette valeur est traduite au
       chargement, dans la langue du navigateur, et un test qui change de langue
       la fait diverger de `trad()`. Rouge sur le Chrome anglais de l'integration
       continue, vert sur un poste francais : le meme code, deux verdicts. */
    vrai(/place:\s+\{ nom: trad\('Placements'\)/.test(lireSource('assets/store.js')),
      'la ligne d’Allocation ne dit plus « Investi »');
    for (const cle of ['de tes comptes de marché', 'Comptes de marché', 'Placements', 'de tes placements'])
      vrai(!!I18N.en[cle], '« ' + cle + ' » existe en anglais');
    vrai(!I18N.en['Ton portefeuille'], 'l’ancienne clef est partie');
  });
});

suite('Budget vierge : une explication, une action, pas de tableau vide', () => {

  test('le détail mensuel attend la première dépense', () => {
    /* 761 px de structure a 375 px — douze mois vides, neuf categories, trois
       commandes — sous une page qui n'avait encore rien a corriger. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('data-anchor="detail-mensuel"');
    const avant = src.slice(i - 400, i);
    vrai(/\$\{!aDesDepensesSaisies\(\) \? '' : `\s*<div class="card" data-anchor="detail-mensuel">/.test(src.slice(i - 200, i + 60)),
      'la carte entière est gardée par la première dépense saisie');
    vrai(/<\/details>`\}\s*<\/div>`\}`\}/.test(src), 'et la garde se referme avec la carte');
    vrai(avant.length > 0, 'tranche trouvée');
  });

  test('une seule action pleine : les revenus se proposent en second', () => {
    const src = lireSource('assets/app.js');
    vrai(/function invitePremierPas\(cle, \{ secondaire = false \} = \{\}\)/.test(src), 'l’invite sait se faire discrète');
    vrai(/class="btn sm\$\{secondaire \? ' ghost' : ''\}"/.test(src), 'par la forme fantôme, celle des gestes secondaires');
    vrai(/if \(!f\.income\) return invitePremierPas\('revenus', \{ secondaire: true \}\);/.test(src),
      'sur Budget, « Entrer ton salaire net » passe en second derrière « Saisir les dépenses du mois »');
    vrai(/invitePremierPas\('revenus'\)\}/.test(src), 'ailleurs, l’invite garde sa forme pleine');
  });
});

/* ------------------------------------------------------------------
   Le prix par part est un terme d'une formule, pas un second montant
   ------------------------------------------------------------------ */
suite('Actif non coté : la formule montre pourquoi les montants sont liés', () => {

  const src = () => lireSource('assets/app.js');
  const rendu = () => { const s = src(); const i = s.indexOf('${!c.parPart ? \'\' : `<div class="champ-par-part"'); return s.slice(i, s.indexOf('</div>`}', i)); };
  const cablage = () => { const s = src(); return s.slice(s.indexOf('const fmtPartsFormule'), s.indexOf("const premier = $('#modalBody')")); };

  test('le montant du jour se lit « parts × prix = total », l’investi « montant ÷ parts = prix »', () => {
    /* Quatre champs nombre se suivaient, et « l'un remplit l'autre » decrivait
       la relation en abstrait : lequel remplir, lequel est calcule, lequel fait
       foi. La formule montre le calcul avec les valeurs reelles. Le sens suit
       le geste : un prix du jour revalorise le total ; un montant investi se
       ramene a un prix d'achat. */
    const r = rendu();
    const produit = r.slice(r.indexOf('` : `'), );
    const division = r.slice(0, r.indexOf('` : `'));
    vrai(/data-role="parts"[\s\S]*×[\s\S]*id="\$\{id\}_part"[\s\S]*{dev} \/ part[\s\S]*data-role="egal"[\s\S]*data-role="total"/.test(produit),
      'valeur du jour : parts × [prix] {dev} / part = total');
    vrai(/data-role="total"[\s\S]*÷[\s\S]*data-role="parts"[\s\S]*=[\s\S]*id="\$\{id\}_part"[\s\S]*{dev} \/ part/.test(division),
      'investissement : montant ÷ parts = [prix] {dev} / part');
    vrai(/c\.parPartDeduitParts \? `/.test(r), 'et c’est le drapeau du champ qui choisit le sens');
    vrai(/aria-label="\$\{esc\(trad\(c\.parPartLabel\)\)\}"/.test(r), 'le champ garde son nom pour qui ne voit pas la formule');
    vrai(!!I18N.en['{dev} / part'] && !!I18N.en['Coût d’achat'] && !!I18N.en['Valeur actuelle']
      && !!I18N.en['Valeur estimée'],
      'les mots neufs existent en anglais');
  });

  test('les termes écrits suivent les champs, formatés comme le reste', () => {
    const c = cablage();
    vrai(/maximumFractionDigits: 4/.test(c), 'le nombre de parts garde ses quatre décimales');
    vrai(/style: 'currency', currency: deviseBase\(\), currencyDisplay: 'narrowSymbol'/.test(c),
      'le montant en euros, sans décimales inutiles : « 8 250 € »');
    vrai(/moinsTypographique/.test(c) && /locale\(\)/.test(c), 'séparateurs et signe moins de la langue');
    vrai(/n\(\) > 0 \? fmtPartsFormule\(n\(\)\) : `… \$\{trad\('parts'\)\}`/.test(c), 'un terme absent s’écrit « … », le tiret cadratin étant proscrit à l’écran');
    vrai(/egal\.hidden = !aTotal; terme\('total'\)\.hidden = !aTotal;/.test(c),
      'et le résultat d’un produit attend son total au lieu d’afficher une équation cassée');
    /* Rafraichie a la suite de chaque ecriture, jamais en calculant elle-meme. */
    vrai(/const versUnite = \(\) => \{[\s\S]*?majFormule\(\);\s*\};/.test(c), 'après un prix par part recalculé');
    vrai(/const versTotal = \(\) => \{[\s\S]*?majFormule\(\);\s*\};/.test(c), 'après un total réécrit');
    vrai(/p\.majFormule\(\);\s*return true;/.test(c), 'après un nombre de parts déduit');
    vrai(!/formule[\s\S]{0,80}total\.value =/.test(c.slice(c.indexOf('const majFormule'), c.indexOf('const versUnite'))),
      'la formule n’écrit aucun champ');
  });

  test('deux groupes nommés, seulement pour les types qui se comptent en parts', () => {
    const s = src();
    /* « Valeur estimee » quand c'est le detenteur qui l'apprecie, « Valeur
       actuelle » sinon ; et « Cout d'achat » plutot qu'« Investissement
       initial » : trois choses qui ne se confondent pas, le cout, l'estimation,
       et le produit reel, qui ne se saisit qu'a la cession. */
    eq((s.match(/cle: 'section_valeur', label: estime \? 'Valeur estimée' : 'Valeur actuelle', type: 'section'/g) || []).length, 1,
      '« Valeur estimée » ou « Valeur actuelle » à la fiche');
    eq((s.match(/cle: 'section_valeur', label: estValeurEstimee\(t\) \? 'Valeur estimée' : 'Valeur actuelle', type: 'section'/g) || []).length, 1,
      'et à la création');
    eq((s.match(/cle: 'section_invest', label: 'Coût d’achat', type: 'section'/g) || []).length, 2,
      '« Coût d’achat » aux deux endroits aussi');
    vrai(!/tirerais/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')),
      'et plus aucune aide ne présente l’estimation comme un prix de vente obtenu');
    vrai(/\.\.\.\(type && type\.parts \? \[\{ cle: 'section_valeur'/.test(s) && /\.\.\.\(t\.parts \? \[\{ cle: 'section_valeur'/.test(s),
      'et ils suivent le drapeau du type : une montre n’en a pas');
    const fiche = s.slice(s.indexOf('function champsPlacement('), s.indexOf('\nfunction ', s.indexOf('function champsPlacement(') + 10));
    const ordre = ["cle: 'parts'", "cle: 'section_valeur'", "cle: 'valeur'", "cle: 'section_invest'", "cle: 'prixDeRevient'", "cle: 'dateAcquisition'"]
      .map(a => fiche.indexOf(a));
    vrai(ordre.every((v, i) => v > 0 && (i === 0 || v > ordre[i - 1])),
      'parts, puis valeur actuelle, puis investissement initial, puis la date : ' + ordre.join(','));
  });

  test('la formule tient sur un téléphone : en ligne, repliable, champ étroit', () => {
    const css = lireSource('assets/styles.css');
    const regle = css.match(/\.champ-par-part \{([^}]*)\}/)[1];
    vrai(/flex-wrap: wrap/.test(regle) && /align-items: center/.test(regle), 'les termes se replient sans se casser');
    vrai(/\.champ-par-part input \{[^}]*width: 6\.5em; max-width: 6\.5em; flex: none;/.test(css),
      'le champ du prix est étroit : six caractères suffisent, le total au-dessus porte la largeur');
    vrai(/\.champ-par-part \.formule-val \{[^}]*white-space: nowrap/.test(css), 'un terme ne se coupe pas en deux');
    vrai(/\.champ-par-part \.formule-sous \{[^}]*flex: 1 0 100%/.test(css), 'le sous-titre prend sa propre ligne');
  });
});

/* ------------------------------------------------------------------
   Données : un centre de données, pas un panneau technique
   ------------------------------------------------------------------ */
suite('Données se lit comme un centre de données', () => {

  const vue = () => { const s = lireSource('assets/app.js'); return s.slice(s.indexOf('function viewData() {'), s.indexOf('function mountData() {')); };
  const positions = (s, ...ancres) => ancres.map(a => s.indexOf(a));
  const croissant = l => l.every((v, i) => v > 0 && (i === 0 || v > l[i - 1]));

  test('l’ordre va du rassurant au dangereux, et rien n’a disparu', () => {
    /* Sept cartes de meme poids, un avertissement d'un ecran entier en tete :
       la securite des donnees n'aurait pas de reponse avant deux mille pixels.
       Le meme contenu, dans l'ordre de la question. */
    const v = vue();
    const l = positions(v, 'class="page-tete"', 'class="card tight etat-donnees',
      "trad('Contrôles de cohérence')", "trad('Sauvegarde et restauration')", "trad('Exporter pour analyse')",
      'data-action="undo"', "trad('Historique des sauvegardes')", "trad('Confidentialité et stockage')",
      "trad('Diagnostic')", "trad('Réinitialiser Longward')");
    vrai(croissant(l), 'en-tête, état, contrôles, sauvegarde, export, annuler, historique, confidentialité, diagnostic, réinitialiser : ' + l.join(' < '));
    for (const action of ['cloud-push', 'cloud-pull', 'cloud-force', 'export-json', 'export-xlsx-all', 'undo',
                          'make-backup', 'restore-backup', 'start-blank'])
      vrai(v.includes(`data-action="${action}"`), `l’action « ${action} » est toujours servie`);
    vrai(/id="importFile"/.test(v) && /<label class="btn ghost" for="importFile">/.test(v),
      'l’import reste un champ fichier, ouvert par un bouton qui le nomme');
    vrai(/Un export JSON ou Excel sort de ce cadre/.test(v) && /pas chiffrées de bout en bout/.test(v),
      'l’avertissement sur les données personnelles est entier, derrière « En savoir plus »');
    vrai(/<details class="data-view">\s*<summary>\$\{trad\('En savoir plus'\)\}/.test(v), 'et replié par défaut');
    for (const mesure of ['Positions', "trad('Relevés enregistrés')", "trad('Comptes suivis')", "trad('Taille du stockage')", "trad('Version')"])
      vrai(v.includes(mesure), `le diagnostic garde ${mesure}`);
  });

  test('l’état se dit en un point de couleur, et le vert ne ment pas', () => {
    const v = vue();
    vrai(/if \(!cloud\) \{[\s\S]*?niveau: 'ok'/.test(v), 'sans cloud, la donnée vit ici : un état sain');
    vrai(/s\.conflict\) \{[\s\S]*?niveau: 'alerte'/.test(v), 'un conflit est orange');
    vrai(/s\.error\) \{[\s\S]*?niveau: 'erreur'/.test(v), 'un envoi refusé est rouge');
    vrai(/s\.pushing \|\| !CloudSync\.aJour\(\)\) \{[\s\S]*?niveau: 'attente'/.test(v), 'ce qui reste à envoyer est orange');
    vrai(/niveau: 'ok', titre: trad\('Données synchronisées'\)/.test(v), 'et le vert n’arrive qu’une fois tout envoyé');
    vrai(/pluriel\(nbComptes, 'compte', 'comptes'\)/.test(v) && /c\.type !== 'especes' \|\| valeurCompte\(c\) > 0\.005/.test(v) && /'relevé', 'relevés'/.test(v) && /'position', 'positions'/.test(v),
      'comptes, relevés, positions se comptent sous l’état');
    vrai(/cloud && s\.conflict \? `<div class="paire-btn etat-conflit">[\s\S]*?cloud-pull[\s\S]*?cloud-force/.test(v),
      'en conflit, les deux arbitrages restent offerts');
    const src = lireSource('assets/app.js');
    vrai(/async 'cloud-push'\(btn\) \{[\s\S]*?btn\.disabled = true; btn\.classList\.add\('en-cours'\)/.test(src),
      'le bouton dit qu’il synchronise et ne se reclique pas');
  });

  test('les premiers pas ne sont pas des anomalies', () => {
    /* « Commence par tes comptes » est une invitation : la presenter en jaune,
       parmi les chiffres faux, apprend a ignorer le jaune. */
    const v = vue();
    vrai(/const premiersPas = checks\.filter\(c => c\.level === 'action' && c\.sujet === 'saisies'\);/.test(v),
      'les invitations de démarrage se séparent des contrôles');
    vrai(/const anomalies = checks\.filter\(c => !premiersPas\.includes\(c\)\);/.test(v), 'et le compte ne porte que sur le reste');
    vrai(/anomalies\.length \? 'controles-alerte' : 'controles-ok'/.test(v), 'le point passe au jaune sur les seules anomalies');
    vrai(/trad\('Tout semble cohérent'\)/.test(v) && /'\{n\} point à vérifier'/.test(v) && /'\{n\} points à vérifier'/.test(v),
      'le titre compte, au singulier comme au pluriel');
    vrai(/class="controles-debut">[\s\S]*?trad\('Saisies en attente'\)/.test(v), 'les saisies en attente ont leur propre groupe, neutre, au nom de leur famille');
    vrai(/trad\('Examiner'\)/.test(v), 'et une anomalie s’examine');
  });

  test('sauvegarde et lecture ne sont pas au même niveau', () => {
    const v = vue();
    const json = v.indexOf('data-action="export-json"'), xlsx = v.indexOf('data-action="export-xlsx-all"');
    vrai(json > 0 && xlsx > json, 'le JSON, qui restaure, vient avant l’Excel, qui se lit');
    vrai(/<button class="btn" data-action="export-json">/.test(v), 'la sauvegarde est le bouton plein');
    vrai(/<button class="btn ghost" data-action="export-xlsx-all">/.test(v), 'l’export de lecture est fantôme');
    vrai(v.indexOf("trad('Exporter pour analyse')") > json, 'et il a sa propre section');
    vrai(/trad\('Le JSON permet de restaurer entièrement Longward\.'\)\}\$\{aide\(/.test(v),
      'une phrase courte, le manuel dans la bulle');
  });

  test('l’historique des sauvegardes est une frise, trois lignes visibles', () => {
    const v = vue();
    vrai(/const recentes = backups\.slice\(0, 3\), anciennes = backups\.slice\(3\);/.test(v), 'trois récentes, le reste replié');
    vrai(/<details class="data-view frise-reste">[\s\S]*?trad\('Voir les \{n\} sauvegardes'\)/.test(v), 'derrière « Voir les N sauvegardes »');
    vrai(/ligneSauvegarde\(b, i \+ recentes\.length\)/.test(v), 'et les index de restauration restent ceux de la liste entière');
    vrai(!/<table class="large-seulement">/.test(v), 'plus de tableau à cinq colonnes : la frise vaut pour toutes les largeurs');
    vrai(/class="frise-quand"><b>\$\{esc\(quand\(b\.at\)\)\}<\/b><span class="sub">\$\{esc\(heure\(b\.at\)\)\}/.test(v),
      'la date et l’heure distinguent deux sauvegardes de même motif');
    const src = lireSource('assets/app.js');
    vrai(/async 'restore-backup'\(btn\) \{[\s\S]{0,300}askConfirm\(/.test(src), 'restaurer demande confirmation');
  });

  test('la réinitialisation ferme la page, sobre et confirmée', () => {
    const v = vue();
    vrai(/<section class="card zone-danger">[\s\S]*?class="btn ghost danger" data-action="start-blank">\$\{trad\('Tout effacer'\)\}/.test(v),
      'un bouton rouge secondaire, dans sa zone');
    vrai(v.indexOf('zone-danger') > v.indexOf("trad('Diagnostic')"), 'tout en bas');
    const src = lireSource('assets/app.js');
    const action = src.slice(src.indexOf("async 'start-blank'()"), src.indexOf("async 'start-blank'()") + 900);
    vrai(/trad\('Réinitialiser Longward \?'\)/.test(action) && /\{p\} positions, \{c\} comptes/.test(action)
      && /Une sauvegarde est prise avant, et Ctrl\+Z annule\./.test(action) && /ok: 'Tout effacer', danger: true/.test(action),
      'la confirmation dit ce qui part, et qu’une sauvegarde est prise avant');
  });

  test('les mots neufs existent en anglais, les morts sont partis', () => {
    for (const cle of ['Données synchronisées', 'Enregistrées sur cet appareil', 'Conflit de synchronisation',
                       'Tout semble cohérent', '{n} point à vérifier', 'Examiner', 'Saisies en attente',
                       'Sauvegarde et restauration', 'Importer une sauvegarde', 'Exporter pour analyse',
                       'Historique des sauvegardes', 'Voir les {n} sauvegardes', 'Confidentialité et stockage',
                       'En savoir plus', 'Réinitialiser Longward', 'Tout effacer', 'Synchronisation…'])
      vrai(!!I18N.en[cle], '« ' + cle + ' » existe en anglais');
    for (const morte of ['Revenir en arrière', 'Sauvegardes automatiques', 'Repartir de zéro', 'Tout effacer et repartir',
                         'Synchronisation en ligne', 'Données personnelles.'])
      vrai(!I18N.en[morte], '« ' + morte + ' » n’a plus d’appelant');
  });

  test('la feuille tient les nouveaux composants sur un téléphone', () => {
    const css = lireSource('assets/styles.css');
    vrai(/\.etat-donnees \{ display: grid; grid-template-columns: 10px minmax\(0, 1fr\) auto;/.test(css), 'l’état : un point, deux lignes, une icône');
    vrai(/\.etat-erreur \.etat-point \{ background: var\(--critical\)/.test(css) && /\.etat-alerte \.etat-point[^}]*var\(--warning\)/.test(css),
      'les couleurs d’état sont celles de la maison');
    vrai(/\.frise-ligne \{ display: grid; grid-template-columns: 62px minmax\(0, 1fr\) auto;/.test(css), 'la frise en trois colonnes');
    vrai(/\.fichier-cache \{ position: absolute; width: 1px; height: 1px; opacity: 0;/.test(css), 'le champ fichier se cache sans disparaître');
    vrai(/\.zone-danger \{ box-shadow: var\(--shadow\), inset 0 0 0 1px color-mix\(in oklab, var\(--critical\) 28%/.test(css),
      'la zone de danger se distingue d’un filet rouge léger, pas d’un aplat');
    vrai(/@keyframes tourne/.test(css) && /prefers-reduced-motion: reduce\) \{ \.btn\.en-cours \{ animation: none; \}/.test(css),
      'l’icône tourne pendant l’envoi, sauf mouvement réduit');
  });
});

/* ------------------------------------------------------------------
   Préférences : des lignes de réglages, des feuilles de choix
   ------------------------------------------------------------------ */
suite('Préférences se lit comme les réglages d’un téléphone', () => {

  const src = () => lireSource('assets/app.js');
  const vue = () => { const s = src(); return s.slice(s.indexOf('function viewSettings() {'), s.indexOf('function askOptions(')); };
  const positions = (s, ...ancres) => ancres.map(a => s.indexOf(a));
  const croissant = l => l.every((v, i) => v > 0 && (i === 0 || v > l[i - 1]));

  test('cinq groupes, dans l’ordre annoncé, et aucun menu déroulant', () => {
    const v = vue();
    const l = positions(v, 'class="page-tete"', "t('settings.general')", "t('settings.behaviour')",
      "trad('Notifications')", "trad('Rappels')", "trad('Alertes')");
    vrai(croissant(l), 'en-tête, Général, Marchés, Notifications, Rappels, Alertes : ' + l.join(' < '));
    vrai(!/<select/.test(v), 'plus aucun menu déroulant : une ligne à chevron ouvre une feuille de choix');
    vrai(!/data-path=/.test(v), 'et aucun champ lié : les réglages passent par des actions nommées');
    vrai(/\$\{viewNotifs\(\)\}/.test(v), 'la seconde moitié vit dans viewNotifs, comme avant');
  });

  test('chaque réglage a la forme de son choix', () => {
    const v = vue();
    for (const a of ['regl-theme', 'regl-langue', 'regl-place', 'regl-jour', 'alertes-en-cours', 'alertes-masquees'])
      vrai(v.includes(`action: '${a}'`), `« ${a} » est une ligne à chevron`);
    vrai(/ligneBascule\(\{ action: 'regl-autorefresh'/.test(v), 'l’actualisation est un interrupteur');
    vrai(/ligneBascule\(\{\s*action: 'famille-notif', cle,/.test(v), 'chaque famille de notifications aussi, par l’action qui existait');
    vrai(/role="switch" aria-checked="\$\{on \? 'true' : 'false'\}"/.test(src()), 'un interrupteur se dit tel à qui ne voit pas');
    vrai(/trad\('\{n\} sur \{t\} activées'\)/.test(v), 'le groupe compte ses familles allumées');
    vrai(!/rien à signaler/.test(v), 'et ne dit pas « rien à signaler » : c’est un état d’alerte, pas un réglage');
    vrai(/libellePlace\(m\.preferredExchange \?\? '\.PA'\)/.test(v) && /libelleJour\(jourRappel\(\)\)/.test(v),
      'la valeur courante se lit sur la ligne, en mots');
  });

  test('les mêmes clefs de stockage, les mêmes gestionnaires', () => {
    const s = src();
    vrai(/'regl-autorefresh'\(\) \{\s*Store\.state\.meta\.autoRefresh = !Store\.state\.meta\.autoRefresh;/.test(s), 'autoRefresh');
    vrai(/Store\.state\.meta\.preferredExchange = v;/.test(s), 'preferredExchange');
    vrai(/Store\.state\.meta\.jourRappel = Number\(v\);/.test(s), 'jourRappel');
    vrai(/if \(v && v !== currentLang\(\)\) \{ setLang\(v\); location\.reload\(\); \}/.test(s), 'la langue recharge, comme avant');
    vrai(/if \(v && v !== themeChoisi\(\)\) applyTheme\(v, true\);/.test(s), 'le thème aussi');
    vrai(/'reafficher-notif'\(btn\) \{\s*Store\.state\.meta\.notifsMasquees = notifsMasquees\(\)\.filter\(c => c !== btn\.dataset\.cle\);/.test(s),
      'une alerte masquée se réaffiche une à une, dans la même liste');
  });

  test('le thème connaît « Système », et la page peint toujours dark ou light', () => {
    const s = src();
    vrai(/function themeChoisi\(\)/.test(s) && /const themeEffectif = choix => choix === 'system' \? themeSysteme\(\) : \(choix \|\| 'dark'\);/.test(s),
      'le choix et l’effet sont deux choses');
    vrai(/document\.documentElement\.dataset\.theme = themeEffectif\(nom\);/.test(s), 'applyTheme peint l’effet et range le choix');
    vrai(/themeEffectif\(localStorage\.getItem\('wealth-dashboard:theme'\) \|\| 'dark'\)/.test(s), 'au démarrage aussi');
    vrai(/prefers-color-scheme: light/.test(s), 'et « Système » lit l’appareil');
    vrai(/\{ v: 'system', l: l\.system, sous: trad\('Suit le réglage de l’appareil'\) \}/.test(s), 'la feuille propose Système, Clair, Sombre');
    for (const cle of ['settings.theme.system', 'settings.general']) vrai(!!I18N.en[cle], cle + ' existe en anglais');
  });

  test('la feuille de choix se referme sur le choix, et la grille a sept colonnes', () => {
    const s = src();
    const f = s.slice(s.indexOf('function askOptions('), s.indexOf('let feuilleCourante'));
    vrai(/role="radiogroup"/.test(f) && /role="radio" aria-checked=/.test(f), 'les options se disent comme des boutons radio');
    vrai(/\$\('#modalBody'\)\.onclick = e => \{ const b = e\.target\.closest\('\.choix-ligne'\); if \(b\) \{ retourHaptique\(\); fermer\(b\.dataset\.v\); \} \};/.test(f),
      'toucher une option choisit et referme, sans bouton Valider');
    vrai(/grille: true, options: Array\.from\(\{ length: 28 \}/.test(s), 'le jour du rappel s’ouvre en grille de 28');
    const css = lireSource('assets/styles.css');
    vrai(/\.choix-grille \{ display: grid; grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/.test(css), 'sept colonnes, la forme d’un mois');
    vrai(/\.regl-ligne \{[^}]*min-height: 52px/.test(css) && /\.choix-grille \.choix-ligne \{[^}]*min-height: 44px/.test(css),
      'les cibles tactiles font au moins 44 px');
    vrai(/\.regl-ligne:focus-visible \{ outline: 2px solid var\(--accent\)/.test(css), 'le focus se voit');
  });

  test('les alertes vraies et les familles réglables ne se mélangent pas', () => {
    const s = src();
    vrai(/function alertesMasquees\(\)/.test(s) && /perimees: cles\.filter\(c => !toutes\.some\(n => n\.cle === c\)\)\.length/.test(s),
      'les alertes masquées se listent depuis le modèle, et les clefs orphelines se comptent');
    vrai(/function feuilleAlertesEnCours\(\)/.test(s) && /function feuilleAlertesMasquees\(\)/.test(s), 'deux feuilles, une par question');
    vrai(/data-action="alerte-voir" data-view=/.test(s) && /data-action="masquer-notif" data-cle=/.test(s), 'une alerte en cours se visite ou se tait');
    vrai(/data-action="reafficher-notif" data-cle=/.test(s) && /data-action="rendre-notifs">\$\{trad\('Tout réafficher'\)\}/.test(s),
      'une alerte masquée se réaffiche seule ou avec les autres');
    vrai(/if \(currentView\(\) === 'settings'\) \{ render\(\); rafraichirFeuille\(\); \}/.test(s), 'masquer depuis la feuille met la page et la feuille à jour');
    for (const cle of ['Alertes en cours', 'Alertes masquées', 'Réafficher', 'Ces alertes restent vraies mais ne sont plus affichées.',
                       'Marché privilégié', 'Actualisation automatique', '{n} sur {t} activées', 'Jour du rappel', '1er du mois', '{j} du mois'])
      vrai(!!I18N.en[cle], '« ' + cle + ' » existe en anglais');
    for (const morte of ['Notifications & rappels', 'Masquées une à une', 'Oui, chercher les cours automatiquement'])
      vrai(!I18N.en[morte], '« ' + morte + ' » n’a plus d’appelant');
  });
});

suite('Une page qui échoue le dit', () => {
  test('render attrape l’exception d’une vue et la montre en toast', () => {
    /* Sur un telephone, sans console, une vue qui leve une exception se lisait
       « le bouton ne marche plus » : l'adresse changeait, l'ecran restait. */
    const src = lireSource('assets/app.js');
    /* Bornee sur le code, pas sur un compte de caracteres : un commentaire ajoute
       plus haut dans render() la faisait sortir de sa fenetre. */
    const i = src.indexOf('function render()');
    const r = src.slice(i, src.indexOf('host.innerHTML = html;', i) + 30);
    vrai(/try \{ html = collerAides\(v\.render\(\)\); \}\s*catch \(e\) \{[\s\S]*?toast\(`\$\{trad\('Cette page n’a pas pu s’afficher'\)\}/.test(r),
      'le rendu est gardé, et le défaut se dit là où l’on est');
    vrai(/catch \(e\) \{[\s\S]*?return;\s*\}\s*host\.innerHTML = html;/.test(r), 'l’écran précédent reste utilisable');
    vrai(!!I18N.en['Cette page n’a pas pu s’afficher'], 'le message existe en anglais');
    const d = src.slice(src.indexOf('function viewData() {'), src.indexOf('function mountData() {'));
    vrai(/\(\(b\.data && b\.data\.positions\) \|\| \[\]\)\.length/.test(d) && /JSON\.stringify\(b\.data \|\| \{\}\)/.test(d),
      'et la frise des sauvegardes tolère une entrée sans données');
  });
});

suite('Une société ou plateforme contient des placements', () => {
  test('le mot du contenu suit le contenant, et la fiche s’en sert', () => {
    /* « Parts 2024 » et « Parts 2025 » sont des lignes d'investissement : sous le
       nom de la societe, « 2 comptes » se lisait comme deux comptes bancaires. */
    Fixture.poser();
    Store.state.etabs.push({ id: 'e_soc', nom: 'Essai SAS', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_soc1', etabId: 'e_soc', type: 'pe', cash: [], lignes: [] },
                             { id: 'c_soc2', etabId: 'e_soc', type: 'pe', cash: [], lignes: [] });
    refreshAccounts();
    eq(contenantDeLEtab('e_soc').titre, 'Société ou plateforme', 'le contenant est une société');
    eq(motContenu('e_soc', 1), trad('placement'), 'un placement');
    eq(motContenu('e_soc', 2), trad('placements'), 'deux placements');
    eq(motContenu('e_bq', 2), trad('comptes'), 'une banque tient toujours des comptes');
    vrai(!!I18N.en['placement'] && !!I18N.en['placements'], 'les deux formes existent en anglais');
    eq(I18N.en['Ajouter un'] + ' ' + I18N.en['placement'], 'Add an investment', 'et le bouton reste grammatical en anglais');
    const src = lireSource('assets/app.js');
    const fiche = src.slice(src.indexOf('function viewFicheEtab('), src.indexOf("trad('Crédits en cours')", src.indexOf('function viewFicheEtab(')));
    vrai(/<h2>\$\{majuscule\(motContenu\(e\.id, 2\)\)\}<\/h2>/.test(fiche),
      'la section porte le mot du contenant au pluriel, sans « rattachés », pour tous les contenants');
    vrai(!/trad\('rattachés'\)/.test(fiche) && !I18N.en['rattachés'], '« rattachés » est parti, de la fiche et du dictionnaire');
    /* Un assureur tient des contrats, un immeuble des biens : la meme table, la
       meme fonction, et le compteur, le titre et le bouton disent le meme mot. */
    Store.state.etabs.push({ id: 'e_ass', nom: 'Essai Vie', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_ass1', etabId: 'e_ass', type: 'av', cash: [], lignes: [] });
    refreshAccounts();
    eq(contenantDeLEtab('e_ass').titre, CONTENANTS.assureur.titre, 'une assurance-vie fait un assureur');
    eq(motContenu('e_ass', 1), trad('contrat'), 'un contrat');
    eq(motContenu('e_ass', 2), trad('contrats'), 'deux contrats');
    Store.state.etabs.push({ id: 'e_imm', nom: 'Essai Immo', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_imm1', etabId: 'e_imm', type: 'immo', cash: [], lignes: [] });
    refreshAccounts();
    eq(motContenu('e_imm', 2), trad('biens'), 'un immeuble tient des biens');
    for (const cle of ['compte', 'comptes', 'placement', 'placements', 'contrat', 'contrats', 'bien', 'biens'])
      vrai(!!I18N.en[cle], '« ' + cle + ' » existe en anglais');
    vrai(/\+ \$\{majuscule\(motContenu\(e\.id, 1\)\)\}/.test(fiche), 'le bouton suit : « + Placement »');
    const st = lireSource('assets/store.js');
    vrai(/nouveau: 'Nouvelle société ou plateforme',[\s\S]{0,400}contenu: 'placement' \}/.test(st), 'la table le déclare une fois');
  });
});

/* ------------------------------------------------------------------
   Premier lancement : une activation, pas un produit vide
   ------------------------------------------------------------------ */
suite('Premier lancement : Longward prend vie sous les yeux', () => {

  const src = () => lireSource('assets/app.js');
  const declarer = (...cles) => { Store.state.meta.notifsMasquees = cles.map(c => PAS_PAR_CLE[c].declare.cle); };
  const compte = () => {
    Store.state.etabs.push({ id: 'e_act', nom: 'Essai', notes: '', dettes: [] });
    Store.state.comptes.push({ id: 'c_act', etabId: 'e_act', type: 'courant', cash: [{ montant: 1500, libelle: 'courant', affectation: 'courant' }], lignes: [] });
    refreshAccounts();
  };
  const vierge = () => { Store.state = blankState(); Store.migrate(); refreshAccounts(); };

  test('1. un utilisateur vierge voit l’activation, et aucun zéro de substitution', () => {
    vierge();
    const e = etapesDemarrage();
    eq(e.vierge, true, 'aucun compte propre : vierge');
    eq(e.faits, 0, 'aucun pas franchi');
    eq(e.prochain && e.prochain.cle, 'comptes', 'le premier geste est le compte');
    const s = src();
    vrai(/if \(vierge\) return carteBienvenue\(\{ faits, total: PREMIERS_PAS\.length, premier, acquis \}\);/.test(s),
      'le guide vierge est l’écran d’activation, pas un second parcours');
    const b = s.slice(s.indexOf('function carteBienvenue('), s.indexOf('const SILHOUETTES'));
    vrai(/trad\('Bienvenue dans Longward'\)/.test(b) && /trad\('Tout ton patrimoine\. Une seule trajectoire\.'\)/.test(b), 'le titre et l’accroche');
    vrai(/data-action="\$\{esc\(premier\.action\)\}">\$\{trad\('Construire mon Longward'\)\}/.test(b), 'le CTA mène à l’action du premier pas existant');
    vrai(/PREMIERS_PAS\.map\(p => `[\s\S]*?motCourtPas\(p\)/.test(b), 'la progression se dérive des quatre pas du guide');
    /* Aucun chiffre inventé dans l’accueil vierge : ni montant, ni appel de format. */
    /* Les bornes sont du code, pas des commentaires : l'arbre publie n'en garde aucun. */
    const debut = s.indexOf("${sansComptes ? `");
    const v = s.slice(debut, s.indexOf(': piedApercu()}', debut)).replace(/<!--[\s\S]*?-->/g, '');
    vrai(debut > 0 && v.length > 200, 'la branche du premier lancement est trouvable');
    vrai(!/\d\s?€/.test(v) && !/fmtEUR|fmtPct|fmtSigned/.test(v), 'les aperçus ne portent aucun montant ni pourcentage');
    vrai(/apercuVerrou\(trad\('Patrimoine net'\)/.test(v) && /apercuVerrou\(trad\('Projection'\)/.test(v), 'quatre aperçus verrouillés disent ce qui viendra');
    vrai(/Ton tableau de bord s’enrichit à mesure que tu ajoutes tes données/.test(v), 'et la phrase reste');
    vrai(!/<text/.test(s.slice(s.indexOf('const SILHOUETTES'), s.indexOf('function apercuVerrou('))), 'les silhouettes n’écrivent rien');
  });

  test('2. un seul compte : la vraie valeur remplace l’aperçu, l’activation se replie', () => {
    vierge(); compte();
    const e = etapesDemarrage();
    eq(e.vierge, false, 'plus vierge');
    eq(e.faits, 0, 'le compte existe mais la liste n’est pas déclarée complète : le pas reste courant');
    eq(e.prochain.cle, 'comptes', 'le prochain pas demande la déclaration');
    declarer('comptes');
    eq(etapesDemarrage().faits, 1, 'déclaré, le pas est franchi');
    eq(etapesDemarrage().prochain.cle, 'revenus', 'et le suivant est le revenu');
    const s = src();
    vrai(/\$\{!aUnComptePropre\(\) \? '' : `\s*<div class="hero">/.test(s), 'le hero se rend dès le premier compte, l’aperçu Patrimoine disparaît avec l’accueil vierge');
    vrai(/if \(!vierge && !fini && !guideDeplie\) \{/.test(s), 'et le guide passe en barre repliée');
  });

  test('3. compte + revenu : la barre annonce la prochaine étape', () => {
    vierge(); compte(); declarer('comptes');
    Store.state.budget.income = [{ label: 'Salaire', amount: 3000 }];
    eq(etapesDemarrage().prochain.cle, 'revenus', 'le revenu saisi attend sa déclaration');
    declarer('comptes', 'revenus');
    const e = etapesDemarrage();
    eq(e.faits, 2, 'deux pas sur quatre');
    eq(e.prochain.cle, 'releves', 'le relevé, ouvrable puisqu’un compte existe');
    eq(motCourtPas(e.prochain), trad('Relevé mensuel'), 'dit en un mot court');
    const s = src();
    vrai(/trad\('Ton Longward prend forme'\)/.test(s) && /trad\('Prochaine étape'\)\}\$\{deuxPoints\(\)\} \$\{esc\(motProchainPas\(premier\)\)\}/.test(s),
      'la barre repliée dit « Ton Longward prend forme » et la prochaine étape');
    vrai(!/'Ton Longward est complété à/.test(s), 'aucun pourcentage de complétion inventé');
  });

  test('4. compte + revenu + dépenses : le pas des dépenses est franchi', () => {
    vierge(); compte(); declarer('comptes', 'revenus', 'depenses');
    Store.state.budget.income = [{ label: 'Salaire', amount: 3000 }];
    Store.state.budget.expenses = [{ month: '2026-08-01', v: { Loyer: 900 }, note: '' }];
    const e = etapesDemarrage();
    eq(pasAFaire('depenses'), false, 'des dépenses saisies franchissent le pas');
    eq(e.faits, 3, 'trois pas sur quatre');
    eq(e.prochain.cle, 'releves', 'il ne reste que le relevé');
  });

  test('5. un état riche ne montre ni activation ni aperçu parasite', () => {
    Fixture.poser();
    const e = etapesDemarrage();
    eq(e.vierge, false, 'le fixture a des comptes');
    vrai(!pasAFaire('comptes'), 'donc la branche des aperçus ne se rend pas');
    const s = src();
    vrai(/if \(demarrageMasque\(\) \|\| demarrageDepasse\(\)\) return '';/.test(s.slice(s.indexOf('function carteDemarrage()'))),
      'et le guide refermé, ou dépassé, ne revient pas');
  });

  test('6-8. le mode exemple : des données fictives, isolées, jamais envoyées', () => {
    const s = src();
    if (typeof modeDemo !== 'function') { vrai(!/data-action="charger-demo"/.test(lireSource('index.html')), 'sans mode démonstration, rien à proposer'); return; }
    vrai(/typeof SEED_VERSION !== 'undefined' && typeof modeDemo === 'function' && !modeDemo\(\)/.test(s),
      '« Voir un exemple » n’existe que là où une graine de démonstration existe, hors du mode lui-même');
    const action = s.slice(s.indexOf("async 'charger-demo'()"), s.indexOf("'quitter-demo'()"));
    vrai(/setModeDemo\(true\);\s*Store\.state = structuredClone\(SEED\);/.test(action), 'l’exemple est la graine, sous son propre mode');
    const st = lireSource('assets/store.js');
    vrai(/cleParUtilisateur\(modeDemo\(\) \? CLE_DEMO : CLE_REELLE\)/.test(st), 'le mode a sa propre clef de stockage');
    vrai(/if \(typeof CloudSync !== 'undefined' && !modeDemo\(\)\) \{\s*if \(opts\.differe\) CloudSync\.schedulePush\(\); else CloudSync\.push\(\);/.test(st),
      'et rien ne part au cloud en mode démonstration');
    vrai(/const cloud = modeDemo\(\) \? \{ available: false \} : await CloudSync\.init\(\);/.test(s), 'ni à l’ouverture');
    const html = lireSource('index.html');
    vrai(/id="bandeauDemo"[^>]*hidden/.test(html) && /data-i18n="demo.badge"/.test(html) && /data-action="quitter-demo"/.test(html),
      'le bandeau dit que c’est fictif et offre la sortie');
    vrai(/bandeau\.hidden = !modeDemo\(\);/.test(s), 'render le montre en mode démonstration seulement');
    vrai(!!I18N.en['demo.badge'] && !!I18N.en['demo.quitter'], 'traduit');
    /* Entrer et sortir du mode ne touche pas la clef reelle. */
    const reelle = cleStockage(); const avant = localStorage.getItem(reelle);
    try {
      setModeDemo(true);
      vrai(cleStockage() !== reelle, 'en mode exemple, on écrit ailleurs');
      eq(localStorage.getItem(reelle), avant, 'la vraie clef n’a pas bougé');
    } finally { setModeDemo(false); }
    eq(cleStockage(), reelle, 'et l’on revient à son espace');
  });

  test('9. la feuille tient les aperçus et l’activation sur 375 px', () => {
    const css = lireSource('assets/styles.css');
    vrai(/\.apercus-verrous \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 10px; \}/.test(css), 'deux colonnes compactes');
    vrai(/\.apercu-verrou \{[^}]*min-width: 0;/.test(css), 'les tuiles ne débordent pas');
    vrai(/\.bienvenue-actes \.btn \{ flex: 1 1 12em; \}/.test(css) && /max-width: 420px\) \{ \.bienvenue-actes \.btn \{ flex-basis: 100%; \}/.test(css),
      'les deux gestes s’empilent sous 420 px');
    vrai(/\.demarrage-texte \{ flex: 1 1 auto; min-width: 0;/.test(css), 'la barre repliée replie son texte');
    /* Deux lignes voulues sur téléphone, une seule dès 768 px ; la police ne bouge pas. */
    vrai(/\.bienvenue-pas \{[^}]*display: grid;\s*grid-template-columns: minmax\(0, 1\.25fr\) minmax\(0, 1fr\)/.test(css)
      && /min-width: 768px\) \{ \.bienvenue-pas \{ display: flex;/.test(css)
      && !/\.bienvenue-pas[^{]*\{[^}]*font-size: var\(--font-xs\)/.test(css),
      'les quatre pas tiennent une grille de deux colonnes sur téléphone, une ligne sur bureau');
    /* Le patrimoine net est le premier résultat : marqué seul, sans changer de taille. */
    const app = lireSource('assets/app.js');
    eq((app.match(/, 'barre', true\)\}/g) || []).length, 1, 'un seul aperçu principal, le patrimoine net');
    vrai(/\.apercu-verrou\.principal \{/.test(css) && !/\.apercu-verrou\.principal[^{]*\{[^}]*(font-size|padding:|grid-column)/.test(css),
      'il se distingue par le filet et le fond, pas par la taille');
  });
});

/* --- Aucun ecran ne se donne pour vide, aucun ne ment ----------------------

   Le parcours de reference est l'accueil : rien d'invente, une promesse, un
   geste. Cette suite verifie que les ecrans qui s'en ecartaient le tiennent, et
   surtout que leurs gardes se DERIVENT de l'etat plutot que d'etre poses en
   dur — un profil rempli ne doit pas voir passer un seul de ces textes. */
suite('Aucun ecran vide ne ment, aucun ne se tait', () => {
  const app = () => lireSource('assets/app.js');
  const css = () => lireSource('assets/styles.css');

  test('1. Marchés > Cible sans base : la page le dit au lieu de féliciter', () => {
    const s = app();
    vrai(/if \(!\(r\.base > 0\.005\)\) \{/.test(s),
      'une base vide rend un écran d’attente, pas trois cartes de zéros');
    const garde = s.slice(s.indexOf('if (!(r.base > 0.005)) {'),
                          s.indexOf('/* Profondeur libre'));
    vrai(/trad\('Les cibles répartissent ce que tu as placé\./.test(garde), 'et il dit ce qu’il attend');
    vrai(/data-action="ajouter-compte"/.test(garde) && /invitePremierPas\('comptes'\)/.test(garde),
      'avec une seule action, celle du premier pas quand il reste à faire');
    /* La félicitation demande une cible réelle : sans un pourcentage visé,
       chaque écart vaut zéro et « tout est à sa cible » se lit tout seul. */
    vrai(/\? `<p class="empty">\$\{trad\('✓ Chaque classe est à sa cible/.test(s)
      && /sumT > 0\.005/.test(s), 'et elle demande qu’une cible existe');
  });

  test('2. Budget > Charges fixes sans ligne : ni total nul, ni tableau d’en-têtes', () => {
    const s = app();
    vrai(/if \(!b\.fixedCharges\.length\) return `\s*<p class="empty"/.test(s),
      'sans une ligne, une phrase remplace le tableau');
    vrai(/\$\{!b\.fixedCharges\.length \? '' : `<span class="hint">\$\{fmtEUR\(f\.fixed\)\}/.test(s),
      'et le total ne s’écrit pas avant la première charge');
    vrai(/return n \? `<span class="hint">\$\{n\} \$\{n > 1 \? trad\('postes'\) : trad\('poste'\)\}<\/span>` : '';/.test(s),
      '« 0 poste » ne se compte pas');
  });

  test('3. Actifs vierge : aucun total inventé, et les familles en portes d’entrée', () => {
    const s = app();
    vrai(/const sansCompte = !ouverts\.some\(c => !typeCompte\(c\.type\)\.interne\);/.test(s),
      'la page sait qu’elle n’a aucun compte réel');
    vrai(/\$\{sansCompte && !filtre \? '' : `<dl class="kv cpt-resume">/.test(s),
      'et « Tes avoirs : 0,00 € » ne s’affiche pas avant le premier compte');
    /* Les familles se dérivent de la table des types : aucune n’est écrite à
       côté. Une liste de six identifiants a vécu ici, et il en manquait sept à
       l’écran — livret, PEA, assurance-vie, PER, prêt participatif, SCPI, bien
       de valeur. Toute sélection écrite à la main se remet à diverger. */
    const f = s.slice(s.indexOf('function famillesDActifs()'), s.indexOf('function viewAccounts()'));
    vrai(/const dispo = famillesEnVue\(\)\.map\(id => choix\.find\(t => t\.id === id\)\)\.filter\(Boolean\);/.test(f),
      'une famille retirée de la table disparaît d’ici, elle n’est pas recopiée');
    /* AUCUN TYPE N’EST HORS D’ATTEINTE. La table s’allonge avec le temps et la
       grille ne peut pas la suivre : « Autre… » ouvre la même fenêtre sans type
       imposé, donc la liste entière. Sans cette porte, un type ajouté demain
       n’aurait plus aucun chemin depuis une page vierge. */
    vrai(/const reste = choix\.length > dispo\.length;/.test(f)
      && /\$\{!reste \? '' : `\s*<button type="button" class="famille" data-action="ajouter-compte">\s*<span class="famille-nom">\$\{trad\('Autre…'\)\}/.test(f),
      'et tout ce qui n’a pas sa porte reste atteignable par « Autre… »');
    for (const id of ['courant', 'livret', 'pea', 'av', 'cto', 'immo', 'crypto']) {
      vrai(TYPES_COMPTE.some(t => t.id === id), `la famille ${id} existe dans la table`);
    }
    vrai(/data-action="ajouter-compte" data-type="\$\{esc\(t\.id\)\}"/.test(f),
      'et chaque porte ouvre la fenêtre d’ajout existante');
    vrai(/famillesDActifs\(\)/.test(s.slice(s.indexOf('if (sansCompte && !filtre) {'),
                                             s.indexOf('} else if (!ouverts.length'))),
      'elles ne paraissent que sur la page vierge');
  });

  test('4. la fenêtre d’ajout s’ouvre sur la famille choisie, sans sauter d’étape', () => {
    const s = app();
    const acte = s.slice(s.indexOf("async 'ajouter-compte'(btn)"), s.indexOf("if (!e1) return;"));
    vrai(/btn\?\.dataset\?\.type && typesCompteChoix\(\)\.some\(t => t\.id === btn\.dataset\.type\)/.test(acte),
      'le type proposé vient de la table, jamais du seul attribut');
    vrai(/Étape'\) \} 1/.test(acte) || /trad\('Étape'\)/.test(acte),
      'et la première étape reste posée');
  });

  test('5. Projection : une capacité d’épargne inconnue n’est pas une capacité nulle', () => {
    const s = app();
    vrai(/const versementInconnu = !\(num\(s\.monthly\) > 0\) && pasAFaire\('revenus'\);/.test(s),
      'inconnue veut dire : pas de revenu déclaré');
    vrai(/const ditVersement = versementInconnu\s*\n?\s*\? trad\('versement à définir'\)/.test(s),
      'et la page le dit au lieu d’écrire zéro');
    const vue = s.slice(s.indexOf('function viewObjective()'), s.indexOf('function viewPositions()'));
    eq((vue.match(/\$\{ditVersement\}/g) || []).length, 3, 'les trois affichages passent par là');
    vrai(!/fmtEUR0\(s\.monthly\)\} \$\{trad\('\/ mois'\)\}/.test(vue)
      || /champ\('Versement mensuel'/.test(vue),
      'seul le réglage garde le montant brut');
  });

  test('6. Historique vierge : pas de journal d’exception avant le premier compte', () => {
    const s = app();
    vrai(/if \(!aUnComptePropre\(\) && !tout\.length\) return '';/.test(s),
      'la carte s’efface tant qu’il n’y a ni compte ni mouvement');
    /* `!tout.length` et non le seul compte : un mouvement déjà saisi doit rester
       visible, la carte ne se referme pas sur une donnée réelle. */
    vrai(/&& !tout\.length\) return '';/.test(s), 'mais jamais sur un mouvement existant');
  });

  test('7. Marchés vierge : la carte se nomme par sa valeur', () => {
    const s = app();
    vrai(/trad\('Suis tes placements cotés'\)/.test(s), 'le titre dit ce que la page suit');
    vrai(!/trad\('Aucun titre coté'\)/.test(s), 'et non ce qu’elle n’a pas');
    const vide = s.slice(s.indexOf("trad('Suis tes placements cotés')"), s.indexOf('function viewAllocation'));
    const i = vide.indexOf("data-action=\"ajouter-ligne\"");
    const j = vide.indexOf('data-view="accounts"');
    vrai(i > -1 && j > -1 && i < j, 'poser un titre passe devant retourner à Actifs');
  });

  test('8. les archives disent ce qu’elles recevront', () => {
    const s = app();
    vrai(/trad\('Les comptes que tu clôtures se rangeront ici\.'\)/.test(s),
      'un tiroir vide annonce son contenu futur');
    vrai(!/trad\('Aucun compte archivé\.'\)/.test(s), 'plutôt que son absence');
  });

  test('9. un profil rempli ne voit aucun de ces écrans', () => {
    const s = app();
    /* Chaque garde est une condition sur l'etat, jamais un drapeau pose a la
       main : c'est ce qui les fait disparaitre tout seuls. */
    for (const garde of [/if \(!\(r\.base > 0\.005\)\) \{/, /if \(!b\.fixedCharges\.length\) return/,
                         /\$\{sansCompte && !filtre \? ''/, /if \(!aUnComptePropre\(\) && !tout\.length\) return/]) {
      vrai(garde.test(s), `la garde ${garde.source.slice(0, 28)} se dérive de l’état`);
    }
    vrai(!/etatVideForce|DEBUG_VIDE|forcerEtatVide/.test(s), 'aucun drapeau d’affichage ne les retient');
  });

  test('10. les portes d’entrée tiennent deux colonnes à 375 px, sans texte coupé', () => {
    const c = css();
    vrai(/\.familles \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 8px; \}/.test(c),
      'deux colonnes compactes');
    vrai(/\.famille-nom \{ min-width: 0; line-height: 1\.25; \}/.test(c)
      && !/\.famille-nom[^}]*text-overflow: ellipsis/.test(c),
      'un nom de famille passe à la ligne, il ne se tronque pas');
  });

  test('11. les nouveaux textes passent tous par le dictionnaire', () => {
    for (const cle of ['Suis tes placements cotés', 'Ce que Longward sait suivre',
                       'versement à définir', 'cibles à fixer',
                       'Les comptes que tu clôtures se rangeront ici.',
                       'Tes comptes et tes biens vivront ici.']) {
      vrai(!!I18N.en[cle], `« ${cle} » a sa traduction`);
    }
  });
});

/* --- Les cinq premieres minutes ------------------------------------------

   L'ecran vierge est au niveau ; c'est juste apres le premier compte que
   l'application se decidait a redevenir un mur : un compteur a zero sous le
   geste qu'on venait de faire, un graphique a axes nus, une liste vide en
   guise de formulaire, un dialogue qui repondait « non » au bouton qu'on avait
   touche. Chaque garde ci-dessous se derive de l'etat ; rien n'est un drapeau. */
suite('Les cinq premières minutes après le premier compte', () => {
  const app = () => lireSource('assets/app.js');
  const store = () => lireSource('assets/store.js');

  test('1. la barre nomme le geste qui reste, pas l’étape qu’on croit finie', () => {
    vrai(/const motProchainPas = p => \(p\.cle === 'comptes' && aUnComptePropre\(\)\)\s*\n?\s*\? trad\('Confirmer tes comptes'\) : motCourtPas\(p\);/.test(store()),
      'avec un compte non déclaré, le prochain pas s’appelle « Confirmer tes comptes »');
    vrai(/\$\{esc\(motProchainPas\(premier\)\)\}/.test(app()), 'et la barre repliée s’en sert');
    eq(MOTS_COURTS_PAS.depenses, 'Charges fixes', 'le quatrième pas porte le même nom que dans le guide');
  });

  test('2. avant le premier relevé, aucun graphique à axes nus sur l’accueil', () => {
    const s = app();
    vrai(/\$\{!aUnRelevePatrimonial\(\) \? '' : `\s*<div class="evo-commandes">/.test(s)
      && /<div class="chart" id="chartEvo"><\/div>`\}/.test(s),
      'la courbe d’évolution et ses plages attendent le premier relevé');
    vrai(/\$\{relevesRenseignes\(\) >= 2 \? `<div class="chart" id="chartPace"><\/div>`/.test(s)
      && /trad\('Il faut deux relevés pour une pente/.test(s),
      'le rythme dit en une phrase ce qu’il attend');
    vrai(/if \(\$\('#chartPace'\)\) Charts\.deltaBars/.test(s), 'et son montage supporte l’absence de l’élément');
    /* L'invite du releve reste, une seule fois, dans la carte d'evolution. */
    eq((s.slice(s.indexOf('function carteEvolution'), s.indexOf('function carteAccumulation')).match(/invitePremierPas\('releves'\)/g) || []).length, 1,
      'un seul bouton pour le relevé sur cette partie de l’accueil');
  });

  test('3. « Entrer ton salaire net » ouvre la fiche d’une source, pas une liste vide', () => {
    vrai(/'toggle-revenus'\(\) \{ if \(!Store\.state\.budget\.income\.length\) return ACTIONS\['add-income'\]\(\); fenetreRevenus\(\); \}/.test(app()),
      'sans source, la fenêtre de la liste n’a rien à lister');
  });

  test('4. le premier relevé : le bouton plein fait ce qu’on a demandé', () => {
    const s = app();
    const d = s.indexOf("async 'ajouter-releve'()");
    const a = s.slice(d, s.indexOf('\n  },\n', d));
    vrai(/ok: trad\('Enregistrer mon relevé'\), refus: trad\('Vérifier mes comptes et actifs'\)/.test(a),
      'enregistrer en plein, vérifier en second');
    vrai(/if \(enregistrer === false\) \{ location\.hash = '#\/accounts'; return; \}/.test(a)
      && /if \(!enregistrer\) return;/.test(a),
      'le second bouton mène aux poches, fermer la fenêtre ne mène nulle part');
    const c = s.slice(s.indexOf('function askConfirm('), s.indexOf('function askConfirm(') + 2200);
    vrai(/fermer\(null\)/.test(c) && (c.match(/fermer\(null\)/g) || []).length === 2 && /non\.onclick = \(\) => fermer\(false\)/.test(c),
      'askConfirm distingue refuser de fermer : Échap et le fond rendent null');
  });

  test('5. la cloche répond par un bouton qui dit oui, jamais par une croix', () => {
    const s = app();
    vrai(/\$\{x\.cle === CLE_INVENTAIRE \? `\s*<button type="button" class="btn sm notif-oui" data-action="declarer-pas"/.test(s),
      'la question de l’inventaire porte son propre bouton');
    vrai(!/La croix de cette ligne veut dire oui/.test(store()), 'et le texte ne fait plus deviner la croix');
    const d = s.slice(s.indexOf("'declarer-pas'(btn)"), s.indexOf("'declarer-pas'(btn)") + 700);
    vrai(/rendNotifs\(\); majOnglets\(\);/.test(d), 'déclarer depuis la cloche la rafraîchit');
  });

  test('6. l’assistant compte ses trois étapes, et n’exemplifie aucune marque', () => {
    const s = app();
    vrai(/\$\{trad\('Étape'\)\} 2 \$\{trad\('sur\.etape', 'sur'\)\} \$\{etapes\} · \$\{trad\('Son nom, tel qu’il s’affichera partout\.'\)\}/.test(s),
      'la deuxième marche est numérotée comme les deux autres');
    /* Le contrôle des noms de tiers vit dans verifier-avant-publication.py, et
       lui seul : ce test n'en recopie aucun, il vérifie que les exemples sont
       les nôtres. Une première version les énumérait, et le vérificateur a
       refusé l'arbre : la liste des noms à ne pas écrire s'était retrouvée écrite. */
    vrai(/exemple: 'ex\. Ma banque en ligne',/.test(store()) && /exemple: 'ex\. Mon assureur',/.test(s)
      && (s.match(/ex\. Ma banque'/g) || []).length >= 4,
      'les exemples de banque et d’assureur sont génériques');
    for (const cle of ['ex. Ma banque', 'ex. Ma banque en ligne', 'ex. Mon assureur']) {
      vrai(!!I18N.en[cle] && /^e\.g\. /.test(I18N.en[cle]), `« ${cle} » a sa traduction en « e.g. »`);
    }
  });

  test('7. les catégories d’un état neuf suivent la langue, la démo garde les siennes', () => {
    if (typeof categoriesParDefaut !== 'function') { vrai(!/categoriesParDefaut/.test(store()), 'cet arbre garde ses propres catégories'); return; }
    eq(EXPENSE_CATEGORIES_FR.length, EXPENSE_CATEGORIES.length, 'les deux listes ont le même nombre de postes');
    vrai(/categories: categoriesParDefaut\(\),/.test(lireSource('assets/seed.js')), 'un état vierge les demande dans la langue du moment');
    vrai(/s\.budget\.categories = categoriesParDefaut\(\);/.test(store()), 'et la migration aussi');
    const c = categoriesParDefaut();
    vrai(c.length === EXPENSE_CATEGORIES.length && (c.every((x, i) => x === EXPENSE_CATEGORIES[i]) || c.every((x, i) => x === EXPENSE_CATEGORIES_FR[i])),
      'elle rend l’une des deux listes, entière, jamais un mélange');
  });
});

/* --- Audit pre-beta : les dix premieres minutes ---------------------------

   Le parcours a ete rejoue en vrai, du compte vierge a la fin du guide. Ce qui
   a ete corrige se tient ici, et chaque garde se derive de l'etat. */
suite('Audit pré-bêta : les dix premières minutes', () => {
  const app = () => lireSource('assets/app.js');
  const store = () => lireSource('assets/store.js');
  const vierge = () => { Store.state = blankState(); Store.migrate(); refreshAccounts(); };

  test('1. le compteur du guide attend d’avoir quelque chose à compter', () => {
    const s = app();
    eq((s.match(/\$\{faits \? `\$\{trad\('\{n\} sur \{t\}'\)\.replace\('\{n\}', faits\)\.replace\('\{t\}', PREMIERS_PAS\.length\)\} · ` : ''\}/g) || []).length, 2,
      '« 0 sur 4 » ne s’écrit ni dans la barre repliée ni dans l’en-tête déplié');
    vrai(!/<span class="sub">\$\{trad\('\{n\} sur \{t\}'\)/.test(s), 'la barre ne commence plus par le compte');
    /* Le compte reste juste : rien ici ne compte un pas non déclaré. */
    vierge(); eq(etapesDemarrage().faits, 0, 'un état vierge n’a rien franchi');
  });

  test('2. le premier relevé arrive prérempli, et un relevé vide ne s’enregistre pas', () => {
    const s = app();
    const f = s.slice(s.indexOf('function askMonthlySnapshot('), s.indexOf('function askMonthlySnapshot(') + 26000);
    vrai(/if \(premier && \$\('#relPhoto'\) && !champs\.some\(c => String\(c\.value \?\? ''\)\.trim\(\) !== ''\)\) \{ \$\('#relPhoto'\)\.onclick\(\); sale = false; \}/.test(f),
      'la photo s’applique d’elle-même au premier relevé, sans salir la saisie');
    vrai(/if \(!Object\.keys\(v\)\.length && String\(\$\('#relDettes'\)\.value \?\? ''\)\.trim\(\) === ''\) \{/.test(f)
      && /trad\('Aucun montant saisi\. Renseigne au moins une poche/.test(f),
      'sans une poche saisie, « Enregistrer » refuse au lieu de féliciter');
    vrai(/trad\('Chaque poche est préremplie avec sa valeur d’aujourd’hui/.test(f), 'et le sous-titre dit ce qu’il y a à faire');
  });

  test('3. une pente demande deux relevés : rythme et variation annuelle se taisent avant', () => {
    const s = app();
    eq((s.match(/relevesRenseignes\(\) >= 2/g) || []).length, 2, 'les plages et le graphique du rythme attendent le second relevé');
    vrai(/\$\{lignes\.some\(x => x\.mois > 0\) \? \(\(\) => \{/.test(s), 'la variation annuelle attend un relevé qui ait un précédent');
    vierge(); eq(relevesRenseignes(), 0, 'aucun relevé sur un état vierge');
    Store.state.monthly[0].v = { courant: 1500 };
    eq(relevesRenseignes(), 1, 'un mois avec un montant compte pour un');
  });

  test('4. des charges inconnues ne valent pas zéro : la capacité et le partage attendent', () => {
    vierge();
    vrai(chargesInconnues(), 'rien saisi, rien déclaré : inconnues');
    Store.state.meta.notifsMasquees = [CLE_CHARGES];
    vrai(!chargesInconnues(), 'déclarées complètes sans une ligne : un zéro déclaré, pas une inconnue');
    vierge(); Store.state.budget.fixedCharges.push({ label: 'Loyer', amount: 900, period: 'mois' });
    vrai(!chargesInconnues(), 'une charge saisie les rend connues');
    const s = app();
    const acc = s.slice(s.indexOf('function carteAccumulation()'), s.indexOf('function carteAccumulation()') + 9000);
    vrai(/if \(chargesInconnues\(\)\) return `/.test(acc) && /trad\('Ta capacité d’épargne se calculera dès que tes charges fixes seront connues\.'\)/.test(acc),
      'l’accueil montre le revenu et dit que la capacité attend');
    const bud = s.slice(s.indexOf("trad('Où va ce que tu gagnes')"), s.indexOf("trad('Où va ce que tu gagnes')") + 6000);
    vrai(/if \(chargesInconnues\(\)\) return `/.test(bud) && /trad\('Le partage de ce revenu se dessinera dès que tes charges fixes seront connues\.'\)/.test(bud),
      'Budget montre le revenu et dit que le partage attend, sans « 100 % investissable »');
  });

  test('5. abandon et reprise : rien ne se perd, rien ne se rouvre tout seul', () => {
    vierge();
    vrai(!demarrageMasque(), 'le guide n’est pas fermé d’avance');
    const s = app();
    vrai(/'fermer-demarrage'\(\) \{\s*masquerNotif\(CLE_DEMARRAGE\);/.test(s), 'Refermer se retient dans l’état, donc survit au rechargement');
    vrai(!/window\.onload[^;]*askMonthlySnapshot|DOMContentLoaded[^;]*askForm/.test(s), 'aucune fenêtre ne s’ouvre au chargement');
  });
});

/* --- Des enveloppes americaines, sans fiscalite -----------------------------

   Quatre contenants de plus, pas une regle fiscale : un 401(k), deux IRA et un
   HSA se comportent comme les enveloppes de placement qui existaient. Les
   identifiants francais ne bougent pas, la langue ne change jamais une donnee,
   et aucun seuil americain n'entre dans le code. */
suite('Des enveloppes américaines, sans fiscalité', () => {
  const app = () => lireSource('assets/app.js');
  const store = () => lireSource('assets/store.js');
  const US = ['us401k', 'traditionalIra', 'rothIra', 'hsa'];
  const poser = () => {
    Store.state = blankState(); Store.migrate();
    Store.state.etabs.push({ id: 'e_us', nom: 'Plan provider', notes: '', dettes: [] });
    Store.state.comptes.push(
      { id: 'c_401k', etabId: 'e_us', type: 'us401k', cash: [], lignes: [] },
      { id: 'c_tira', etabId: 'e_us', type: 'traditionalIra', cash: [{ montant: 3000, libelle: 'cash', affectation: 'investir' }], lignes: [] },
      { id: 'c_roth', etabId: 'e_us', type: 'rothIra', cash: [{ montant: 2000, libelle: 'cash', affectation: 'investir' }], lignes: [] },
      { id: 'c_hsa',  etabId: 'e_us', type: 'hsa', cash: [{ montant: 1200, libelle: 'cash', affectation: 'precaution' }], lignes: [] });
    refreshAccounts();
  };

  test('1-3. en anglais, les trois enveloppes de base portent leur nom naturel', () => {
    eq(I18N.en['Compte courant'], 'Checking account', 'courant');
    eq(I18N.en['Livret'], 'Savings account', 'livret');
    eq(I18N.en['Compte-titres (CTO)'], 'Brokerage account', 'cto, sans le sigle français');
    for (const id of ['courant', 'livret', 'cto']) eq(typeCompte(id).id, id, 'l’identifiant ne bouge pas');
  });

  test('4-5. les quatre types existent, se proposent à la création, et gardent leur nom dans les deux langues', () => {
    for (const id of US) {
      const t = TYPES_COMPTE.find(x => x.id === id);
      vrai(t, `${id} est dans la table`);
      vrai(typesCompteChoix().some(x => x.id === id), `${id} se choisit`);
      eq(I18N.en[t.label], t.label, `« ${t.label} » se lit pareil en anglais`);
      vrai(!t.interne && !t.bienImmo && !t.direct && !t.prete && !t.parts && !t.vl, `${id} est une enveloppe, ni un bien ni un prêt`);
      eq(t.groupe, 'bourse', `${id} est du groupe des placements`);
      vrai(!t.dateSensible, `${id} ne porte aucun seuil d’ancienneté`);
    }
    eq(TYPES_COMPTE[TYPES_COMPTE.length - 1].id, 'especes', 'les espèces restent dernières');
  });

  test('6-8. 401(k) et IRA portent des placements compatibles, et rien d’autre', () => {
    for (const id of ['us401k', 'traditionalIra', 'rothIra']) {
      const t = typeCompte(id);
      vrai(t.titres, `${id} porte des titres`);
      vrai(t.classes.includes('actions') && t.classes.includes('obligations') && t.classes.includes('liquidites'),
        `${id} : actions, obligations, liquidités`);
      vrai(!t.classes.includes('immobilier') && !t.classes.includes('nonCote') && !t.classes.includes('crypto'),
        `${id} ne s’invente ni immobilier, ni non coté, ni crypto`);
    }
    vrai(typeCompte('us401k').classes.includes('garanti') && typeCompte('us401k').melange && typeCompte('us401k').sansCash,
      'le 401(k) est un plan de fonds : support garanti possible, pas de poche de cash à investir');
    /* Marchés retient les types qui peuvent porter une action ou une obligation. */
    const porteurs = TYPES_COMPTE.filter(t => (t.classes || []).some(c => ['actions', 'obligations', 'crypto'].includes(c))).map(t => t.id);
    for (const id of US) vrai(porteurs.includes(id), `${id} est éligible à Marchés`);
  });

  test('9. le HSA est une enveloppe patrimoniale, sans logique médicale ni fiscale', () => {
    const t = typeCompte('hsa');
    eq(t.classes.join(','), 'liquidites,actions,obligations');
    eq(t.defaut, 'precaution', 'son cash est une réserve par défaut');
    vrai(!t.disponibilite, 'aucune règle de disponibilité propre : il suit ses classes');
    vrai(!/qualified medical|triple tax|d[ée]penses m[ée]dicales|frais m[ée]dicaux/i.test(store() + app()),
      'aucune règle médicale ou fiscale du HSA dans le modèle');
  });

  test('10-12. patrimoine, allocation et projection les comptent comme les autres', () => {
    poser();
    const p = patrimoine();
    eq(Math.round(p.brut), 6200, 'le brut additionne les quatre poches');
    vrai(p.classes.liquidites >= 6200 - 0.01, 'leur cash est classé en liquidités');
    const avant = patrimoine().brut;
    /* Un fonds de plan sans cours : une ligne manuelle, valorisée par `value`. */
    Store.state.positions.push({ id: 'p_us', name: 'Index fund', qty: 10, buyPrice: 90, price: 100, fx: 1, fxBuy: 1,
      currency: 'EUR', assetClass: 'actions', role: 'core', account: 'c_401k', manual: true, value: 1000 });
    refreshAccounts();
    vrai(patrimoine().brut > avant + 999, 'une ligne posée sur le 401(k) entre dans le patrimoine');
    vrai(patrimoine().classes.actions >= 1000 - 0.01, 'et dans la classe actions de l’allocation');
    vrai(num(objectiveStatus().total) >= 6200, 'la projection part de ce total');
  });

  test('13. un relevé mensuel les conserve', () => {
    poser();
    const ligne = { date: '2026-09-01', comment: '', v: { c_401k: 1000, c_hsa: 1200 } };
    eq(Math.round(rowTotal(ligne)), 2200, 'les poches américaines s’additionnent comme les autres');
  });

  test('14. export puis import : mêmes types, même total', () => {
    poser();
    const brut = patrimoine().brut;
    const dump = JSON.stringify(Store.state);
    Store.state = JSON.parse(dump); Store.migrate(); refreshAccounts();
    eq(COMPTES().filter(c => !typeCompte(c.type).interne).map(c => c.type).join(), 'us401k,traditionalIra,rothIra,hsa', 'les identifiants survivent au voyage');
    eq(Math.round(patrimoine().brut), Math.round(brut), 'et le total aussi');
  });

  test('15. l’archivage fonctionne', () => {
    poser();
    const avant = patrimoine().brut;
    COMPTES().find(c => c.id === 'c_hsa').statut = 'archive';
    refreshAccounts();
    vrai(!comptesOuverts().some(c => c.id === 'c_hsa'), 'le HSA archivé quitte les comptes ouverts');
    eq(Math.round(patrimoine().brut), Math.round(avant - 1200), 'et le total');
  });

  test('16-18. la langue ne change jamais une donnée : un PER reste un PER, un PEA un PEA', () => {
    eq(typeCompte('per').id, 'per'); eq(typeCompte('pea').id, 'pea');
    vrai(/PER/.test(I18N.en['Plan d’épargne retraite (PER)']) && !/401/.test(I18N.en['Plan d’épargne retraite (PER)']),
      'le PER se traduit, il ne devient pas un 401(k)');
    vrai(!/Roth|IRA/.test(I18N.en['Assurance-vie'] || ''), 'l’assurance-vie ne devient pas un IRA');
    /* Les deux ne partagent qu'une propriété générale, déclarée : la disponibilité. */
    eq(mobilisabilite('liquidites', 'per'), 'bloque', 'un PER est fermé jusqu’à la retraite');
    eq(mobilisabilite('actions', 'us401k'), 'lent', 'une enveloppe de retraite américaine se casse, lentement et avec décote');
    eq(mobilisabilite('liquidites', 'hsa'), 'differe', 'le HSA suit ses classes');
  });

  test('19. aucun calcul fiscal américain n’existe', () => {
    const tout = store() + app();
    vrai(!/RMD|59 ?½|59\.5|\bIRS\b|contribution limit|plafond de contribution|early withdrawal|retrait anticipé|vesting|employer match|qualified medical/i.test(tout),
      'ni seuil d’âge, ni plafond, ni pénalité, ni abondement');
  });

  test('la disponibilité se déclare sur le type, plus jamais par un identifiant français', () => {
    vrai(!/^\s*if \(typeId === 'per'\)/m.test(store()), 'le `if (typeId === \'per\')` est parti');
    vrai(/const declaree = typeCompte\(typeId\)\.disponibilite;/.test(store()), 'le type dit sa disponibilité');
    eq(typeCompte('per').disponibilite, 'bloque');
  });

  test('le contenant se déclare aussi : un 401(k) est chez un teneur de compte, pas chez un assureur', () => {
    for (const id of US) eq(contenantDuType(id).titre, 'Banque ou courtier', `${id}`);
    /* Et son vocabulaire suit : un plan, pas un contrat, à l'étape 3 comme sur la fiche. */
    vrai(!enContrat(typeCompte('us401k')) && enContrat(typeCompte('av')) && enContrat(typeCompte('per')),
      'le 401(k) est un plan, l’assurance-vie et le PER des contrats');
    const s = app();
    vrai(/trad\(enContrat\(t\) \? 'Nommer le contrat' : 'Nommer le plan'\)/.test(s)
      && /enContrat\(t\) \? 'Nom du contrat' : 'Nom du plan'/.test(s),
      'l’étape 3 nomme un plan quand le contenant n’est pas un assureur');
    eq(contenantDuType('per').titre, 'Assureur ou courtier', 'le PER ne change pas');
    eq(contenantDuType('av').titre, 'Assureur ou courtier', 'l’assurance-vie non plus');
  });

  test('le sélecteur se lit par rubriques, et rien ne s’y perd', () => {
    /* Le contexte se pose : en euros, les enveloppes francaises sont chez
       elles et les americaines descendent dans « Autres pays ». */
    Fixture.poser(s => { s.meta.devise = 'EUR'; s.meta.deviseChoisie = true; });
    const rub = typesCompteParRubrique();
    const titres = rub.map(([t]) => t);
    eq(titres.join(' | '), 'Comptes bancaires | Investissements | Retraite et épargne avantagée | Biens et autres | Autres pays');
    const dans = titre => rub.find(([t]) => t === titre)[1].map(([id]) => id);
    eq(dans('Comptes bancaires').join(), 'courant,livret');
    eq(dans('Investissements').join(), 'pea,cto,av,crypto');
    eq(dans('Retraite et épargne avantagée').join(), 'per');
    eq(dans('Biens et autres').join(), 'pe,fondsNonCote,crowdfunding,immo,scpi,bienValeur');
    eq(dans('Autres pays').join(), 'us401k,traditionalIra,rothIra,hsa');
    eq(rub.reduce((n, [, l]) => n + l.length, 0), typesCompteChoix().length, 'chaque type choisissable est dans une rubrique');
    const s = app();
    vrai(/options: \[\.\.\.typesCompteParRubrique\(\),/.test(s), 'la création s’en sert');
    vrai(/Array\.isArray\(l\)/.test(s) && /<optgroup label="\$\{esc\(trad\(v\)\)\}">/.test(s), 'et la fenêtre sait rendre des groupes');
  });

  test('sur Actifs vierge, un Américain trouve ses portes, un Français les siennes', () => {
    const m = app().match(/const FAMILLES_EN_VUE = \{\s*fr: \[([^\]]*)\],\s*us: \[([^\]]*)\],/);
    vrai(m, 'deux listes de portes, une par pays de contexte');
    const ids = s => s.split(',').map(x => x.trim().replace(/'/g, ''));
    eq(ids(m[1]).join(), 'courant,livret,pea,av,cto,immo,crypto', 'un lecteur en France');
    eq(ids(m[2]).join(), 'courant,livret,cto,us401k,rothIra,immo,crypto', 'un lecteur aux États-Unis');
    for (const id of [...ids(m[1]), ...ids(m[2])]) vrai(TYPES_COMPTE.some(t => t.id === id), `${id} existe`);
    vrai(/const famillesEnVue = \(\) => FAMILLES_EN_VUE\[paysContexte\(\)\];/.test(app()),
      'la page lit la liste du pays de contexte, le meme que le selecteur');
    vrai(/const dispo = famillesEnVue\(\)\.map\(id => choix\.find\(t => t\.id === id\)\)\.filter\(Boolean\);/.test(app()),
      'et « Autre… » ouvre le reste');
  });
});

/* --- Le site sert l'application, le depot sert le code ---------------------

   Pages publie le depot entier : la suite de tests, le fichier des agents, les
   scripts de developpement, le schema de la base et le flux d'integration se
   telechargeaient depuis le domaine de l'application. Aucun secret dedans, et
   le depot public les porte de toute facon ; mais rien de cela n'a a repondre
   sur le site. */
suite('Le site ne sert que l’application', () => {
  const worker = () => lireSource('_worker.js');
  const motif = () => {
    const m = worker().match(/const FICHIERS_DE_DEVELOPPEMENT = (\/.*\/);/);
    vrai(m, 'le worker déclare la liste des chemins de développement');
    return new RegExp(m[1].slice(1, m[1].lastIndexOf('/')));
  };

  test('les fichiers de développement répondent 404 depuis le domaine', () => {
    const re = motif();
    for (const p of ['/tests.html', '/tests/store.tests.js', '/tests/harness.js', '/tests/fixture.js',
                     '/CLAUDE.md', '/AGENTS.md', '/regles/tests.md', '/README.md', '/DEPLOY.md', '/ICONES.md', '/schema.sql', '/wrangler.json',
                     '/serve.py', '/executer-tests.py', '/captures.py', '/icones.py',
                     '/.github/workflows/tests.yml', '/.github/workflows/claude.yml']) {
      vrai(re.test(p), `${p} n’a rien à faire sur le site`);
    }
    vrai(/if \(FICHIERS_DE_DEVELOPPEMENT\.test\(path\)\) return new Response\('Not found', \{ status: 404/.test(worker()),
      'et le worker les refuse avant de servir les fichiers');
  });

  test('l’application, ses pages publiques et ses assets restent servis', () => {
    const re = motif();
    for (const p of ['/', '/index.html', '/assets/parties.js', ...Object.values(GROUPES).flat().map(x => '/' + x),
                     '/assets/manrope-latin.woff2',
                     '/sw.js', '/manifest.webmanifest', '/robots.txt', '/privacy.html', '/privacy', '/confidentialite.html',
                     '/confidentialite', '/icon-192.png', '/apple-touch-icon.png', '/docs/desktop-overview.png', '/LICENSE',
                     '/api/health', '/api/state']) {
      vrai(!re.test(p), `${p} doit rester accessible`);
    }
  });

  test('une erreur serveur ne raconte pas son intérieur', () => {
    const w = worker();
    vrai(!/return json\(\{ error: e\.message \}, 502\);/.test(w), 'le message interne ne part plus au client');
    vrai(/console\.error\('api', e\);\s*return json\(\{ error: 'service indisponible' \}, 502\);/.test(w),
      'il se journalise côté serveur et le client reçoit un mot');
  });
});

/* --- Le depot repond a @claude ----------------------------------------------

   Le flux d'integration qui repond aux mentions vit dans `.github/`, un dossier
   que le site refuse deja de servir. Ce qu'il faut garder ici est plus petit et
   plus grave : une cle ne s'ecrit jamais en clair dans un fichier versionne, le
   flux ne part que sur une mention, et la suite de tests garde son propre flux,
   qui ne depend pas de lui.

   Le flux ne vit que dans le depot public : la chaine de publication le reprend
   d'une publication a l'autre, et ni cet arbre ni la beta ne le portent. La
   suite ne se declare donc que la ou le fichier existe. */
if (lireSource('.github/workflows/claude.yml') !== null) suite('Le dépôt répond à @claude, sans exposer de clé', () => {
  /* Les fins de ligne se normalisent : un poste Windows extrait les flux en
     CRLF, et les motifs ancres sur `\n` ne tiendraient que sur la CI. */
  const lf = t => (t || '').replace(/\r\n/g, '\n');
  const flux = () => lf(lireSource('.github/workflows/claude.yml'));

  test('le flux existe et emploie l’action officielle', () => {
    const f = flux();
    vrai(f, 'le fichier doit être lisible');
    vrai(/uses: anthropics\/claude-code-action@v1\s*$/m.test(f), 'l’action officielle, épinglée à sa version majeure');
    vrai(/claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_KEY \}\}/.test(f), 'le jeton d’abonnement se lit dans les secrets du dépôt');
    vrai(!/^\s+anthropic_api_key:/m.test(f), 'et il est la seule voie : pas de clé de console à côté');
    vrai(/claude setup-token/.test(f), 'le fichier dit comment obtenir le jeton');
    for (const droit of ['contents: write', 'pull-requests: write', 'issues: write', 'id-token: write', 'actions: read']) {
      vrai(new RegExp(`^      ${droit}\\b`, 'm').test(f), `${droit} est déclaré sur le travail`);
    }
  });

  test('aucune clé en clair, ni ici ni dans l’autre flux', () => {
    for (const p of ['.github/workflows/claude.yml', '.github/workflows/tests.yml']) {
      const f = lireSource(p);
      vrai(f, `${p} doit être lisible`);
      vrai(!/sk-ant-/.test(f), `${p} ne porte aucune clé Anthropic`);
      vrai(!/anthropic_api_key:\s*['"]?[A-Za-z0-9]/.test(f) && !/claude_code_oauth_token:\s*['"]?[A-Za-z0-9]/.test(f),
        `${p} ne colle aucun jeton : seule une référence à un secret est admise`);
    }
  });

  test('il ne répond qu’à une mention, sur les quatre événements', () => {
    const f = flux();
    for (const ev of ['issue_comment', 'pull_request_review_comment', 'issues', 'pull_request_review']) {
      vrai(new RegExp(`^  ${ev}:\\n`, 'm').test(f), `${ev} déclenche`);
      vrai(new RegExp(`github\\.event_name == '${ev}' && `).test(f), `${ev} est gardé par la condition`);
    }
    vrai(/contains\(github\.event\.issue\.title, '@claude'\)/.test(f) && /contains\(github\.event\.issue\.body, '@claude'\)/.test(f),
      'une issue le mentionne dans son titre ou dans son corps');
    vrai(!/^\s+push:/m.test(f) && !/^\s+schedule:/m.test(f) && !/^\s+workflow_dispatch:/m.test(f),
      'jamais sur un push, une horloge ou un bouton : une mention, ou rien');
  });

  test('la suite existante reste en place, et ne dépend pas de lui', () => {
    const t = lf(lireSource('.github/workflows/tests.yml'));
    vrai(t, 'tests.yml doit être lisible');
    vrai(/^on:\n  push:\n    branches: \[main\]\n  pull_request:\n    branches: \[main\]/m.test(t),
      'la suite tourne toujours à chaque push et à chaque PR vers main');
    vrai(/run: python executer-tests\.py\s*$/m.test(t), 'et c’est bien le lanceur qui rend le verdict');
    vrai(!/claude/i.test(t), 'le flux des tests ne connaît pas l’autre : ils ne dépendent pas l’un de l’autre');
  });
});

/* --- On doit pouvoir sortir de chez soi --------------------------------- */
suite('Se déconnecter existe aussi sur téléphone', () => {
  const html = () => lireSource('index.html');
  const absent = () => {
    if (/class="compte-liens"/.test(html())) return false;
    vrai(true, 'cette instance n’a pas de comptes, donc pas de barre de liens');
    return true;
  };

  test('les liens vivent dans le menu, le seul bloc qui devient le tiroir', () => {
    if (absent()) return;
    const src = html();
    const nav = src.slice(src.indexOf('<nav'), src.indexOf('</nav>'));
    vrai(/class="compte-liens"/.test(nav),
      'le pied devient la barre du haut sur téléphone : les liens seraient hors d’écran');
    const pied = src.slice(src.indexOf('class="sidebar-foot"'), src.indexOf('</aside>'));
    vrai(!/class="compte-liens"/.test(pied), 'et ils ne sont plus dans le pied');
    const outils = nav.indexOf('class="nav-outils"');
    vrai(outils > 0 && nav.indexOf('class="compte-liens"') > outils, 'ils ferment le tiroir, sous les deux réglages');
  });

  test('la sortie de session est atteignable, et nommée', () => {
    if (absent()) return;
    const src = html();
    vrai(/<a href="\/api\/logout" id="btnLogout" data-i18n="account.signout">/.test(src), 'la sortie existe');
    eq(I18N.en['account.signout'], 'Sign out');
    eq(FR['account.signout'], 'Se déconnecter');
    /* Le pied reste masqué sur téléphone : il ne porte plus que des doublons. */
    vrai(/\.sidebar-foot \{ display: none; \}/.test(lireSource('assets/styles.css')),
      'le pied, lui, n’a toujours rien à montrer là-haut');
  });

  test('la licence se lit à côté de la confidentialité', () => {
    if (absent()) return;
    const src = html();
    const liens = src.slice(src.indexOf('class="compte-liens"'), src.indexOf('</div>', src.indexOf('class="compte-liens"')));
    const ordre = ['account.privacy', 'account.licence', 'account.signout'].map(k => liens.indexOf(k));
    vrai(ordre.every((v, i) => v > 0 && (i === 0 || v > ordre[i - 1])), 'confidentialité, licence, sortie');
    vrai(/<a href="\/LICENSE" data-i18n="account.licence">AGPL-3\.0<\/a>/.test(liens), 'et elle mène au texte servi');
    eq(I18N.en['account.licence'], 'AGPL-3.0', 'un nom propre ne se traduit pas');
    eq(FR['account.licence'], 'AGPL-3.0');
  });
});

/* --- La porte se choisit sa langue ---------------------------------------
   La page de connexion suivait l'en-tete du navigateur, sans recours. Un
   francais sur un telephone regle en anglais, ou l'inverse, n'avait aucun moyen
   de changer : l'application, elle, porte ce choix, mais on ne l'atteint
   qu'apres s'etre connecte. */
suite('La page de connexion se choisit sa langue', () => {
  const worker = () => lireSource('_worker.js');

  test('un choix explicite prime sur la détection du navigateur', () => {
    const w = worker();
    vrai(/function langueDemandee\(request, url\) \{/.test(w), 'la fonction reçoit l’adresse');
    const f = w.slice(w.indexOf('function langueDemandee(request, url) {'),
                      w.indexOf('\n}', w.indexOf('function langueDemandee(request, url) {')));
    vrai(/const choisie = url && String\(url\.searchParams\.get\('lang'\) \|\| ''\)\.slice\(0, 2\)\.toLowerCase\(\);/.test(f)
      && /if \(AUTH_TEXTES\[choisie\]\) return choisie;/.test(f),
      '« ?lang=fr » gagne, et seulement s’il désigne une langue connue');
    vrai(/Accept-Language/.test(f), 'sinon l’en-tête du navigateur décide, comme avant');
    vrai(/const T = AUTH_TEXTES\[langueDemandee\(request, url\)\];/.test(w), 'et l’appel passe l’adresse');
  });

  test('les deux langues se proposent, et la page dit laquelle est active', () => {
    const w = worker();
    vrai(/const CHOIX_LANGUE = lang => `/.test(w), 'un seul gabarit pour les deux pages');
    const bloc = w.slice(w.indexOf('const CHOIX_LANGUE = lang => `'), w.indexOf('const EMAIL_LOGIN_PAGE'));
    vrai(/\[\['fr', 'Français'\], \['en', 'English'\]\]/.test(bloc),
      'deux langues, chacune nommée dans la sienne');
    eq((bloc.match(/href="\?lang=\$\{code\}"/g) || []).length, 2, 'un lien par langue, dérivé du code');
    vrai(/aria-current="page"/.test(bloc), 'la langue affichée se signale');
    vrai(/\.langues\{/.test(w), 'et elle a son style');
    /* Les deux pages le portent : celle qui demande l'adresse, et celle du code. */
    const login = w.slice(w.indexOf('const EMAIL_LOGIN_PAGE'), w.indexOf('const VERIFY_PAGE'));
    const verif = w.slice(w.indexOf('const VERIFY_PAGE'), w.indexOf('const LOGIN_PAGE'));
    vrai(/\$\{CHOIX_LANGUE\(T\.lang\)\}/.test(login), 'la page de connexion');
    vrai(/\$\{CHOIX_LANGUE\(T\.lang\)\}/.test(verif), 'la page du code');
  });

  test('le choix survit à l’envoi du formulaire', () => {
    const w = worker();
    vrai(/action="\/api\/auth\/request-code\?lang=\$\{T\.lang\}"/.test(w),
      'la demande de code emporte la langue');
    vrai(/action="\/api\/auth\/verify-code\?lang=\$\{T\.lang\}"/.test(w),
      'la vérification aussi : sans elle, la page du code repasserait à la langue du navigateur');
  });
});

/* --- Rien ne s'affiche hors du dictionnaire -------------------------------

   Trente-quatre textes francais etaient ecrits en dur dans le balisage : un
   bouton « − Vendre » a cote de son jumeau traduit, des en-tetes de colonnes
   entre des en-tetes traduits, des etiquettes de champs, des phrases entieres.
   L'interface anglaise les rendait en francais, et rien ne le disait — la
   moitie des clefs existaient deja dans le dictionnaire, elles n'etaient
   simplement pas appelees.

   Ce controle lit le balisage et refuse tout texte porteur de lettres pose
   juste apres une balise, qu'il soit suivi d'une fermeture ou d'une
   interpolation. C'est la deuxieme forme qui avait laisse passer
   « Surface (m²) », colle a son infobulle. */
suite('Rien ne s’affiche hors du dictionnaire', () => {
  test('aucun texte français n’est écrit en dur dans le balisage', () => {
    let src = lireSource('assets/app.js');
    /* Les commentaires ne s'affichent pas : on les ecarte avant de lire. */
    src = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    /* Ce qui a le droit de rester litteral : une entite, un extrait de code, et
       les fragments d'une phrase deja traduite qui porte son propre balisage. */
    const permis = new Set(['&nbsp;', 'python serve.py', 'données à caractère personnel',
      'chez Cloudflare', 'pas chiffrées de bout en bout',
      'uniquement dans le navigateur de cette machine', 'Lancer-Dashboard.cmd']);
    const fautifs = [];
    for (const m of src.matchAll(/>([^<>{}$`\n]{2,60})(?=<\/|\$\{)/g)) {
      const texte = m[1].trim();
      if (!/[A-Za-zÀ-ÿ]{3,}/.test(texte) || permis.has(texte)) continue;
      fautifs.push(texte);
    }
    eq(fautifs.length, 0, 'texte(s) hors dictionnaire : ' + [...new Set(fautifs)].join(' | '));
  });

  test('et chaque clef appelée porte sa traduction', () => {
    for (const cle of ['Aucune position', 'retenu', 'aucune ligne', 'Aucune ligne en {a}.',
                       'Rien ne correspond à {q}.', 'Surface (m²)', 'Adresse', 'Effet de levier',
                       'Réserve tactique de {v}', 'Seuil', 'Allocation {n}, {nom}', 'Total {a}',
                       'retirée', 'Positions', 'Il reste <b>{v}</b> à verser sur {p}',
                       'Vendre', 'Horizon', 'Total', 'Net', 'Note', 'Notes', 'Organisme',
                       'Total / mois', 'Date', 'Annuler', 'Financement', 'cible', 'Auto,']) {
      vrai(!!I18N.en[cle], `« ${cle} » a sa traduction`);
    }
    /* Un gabarit interpole doit survivre a la traduction, sinon le nombre
       disparait de la phrase anglaise sans que rien ne tombe. */
    for (const [cle, marques] of [['Aucune ligne en {a}.', ['{a}']], ['Rien ne correspond à {q}.', ['{q}']],
                                  ['Réserve tactique de {v}', ['{v}']], ['Total {a}', ['{a}']],
                                  ['Allocation {n}, {nom}', ['{n}', '{nom}']],
                                  ['Il reste <b>{v}</b> à verser sur {p}', ['{v}', '{p}']]]) {
      for (const marque of marques) {
        vrai(I18N.en[cle].includes(marque), `« ${cle} » garde ${marque} en anglais`);
      }
    }
  });
});

/* --- L'age exact le long de la projection ---------------------------------
   Une date de naissance, la date reelle de chaque point, et rien d'autre : ni
   approximation en jours, ni age range dans l'etat. */
suite('L’âge exact le long de la projection', () => {
  const app = () => lireSource('assets/app.js');

  test('1. l’âge se calcule sur le calendrier, pas sur une moyenne de jours', () => {
    /* Une date de naissance fictive, le 10 mars 1990, et ses quatre cas. */
    const n = '1990-03-10';
    eq(JSON.stringify(ageALaDate(n, '2026-03-10')), '{"annees":36,"mois":0}');
    eq(JSON.stringify(ageALaDate(n, '2027-03-09')), '{"annees":36,"mois":11}');
    eq(JSON.stringify(ageALaDate(n, '2027-03-10')), '{"annees":37,"mois":0}');
    eq(JSON.stringify(ageALaDate(n, '2027-03-11')), '{"annees":37,"mois":0}');
    eq(JSON.stringify(ageALaDate(n, '2027-07-10')), '{"annees":37,"mois":4}');
    /* La veille de l'anniversaire du mois : le mois n'est pas revolu. */
    eq(JSON.stringify(ageALaDate(n, '2026-04-09')), '{"annees":36,"mois":0}');
    eq(JSON.stringify(ageALaDate(n, '2026-04-10')), '{"annees":36,"mois":1}');
  });

  test('2. le 29 février : l’anniversaire tombe au 1er mars les années ordinaires', () => {
    const n = '2000-02-29';
    eq(JSON.stringify(ageALaDate(n, '2027-02-28')), '{"annees":26,"mois":11}');
    eq(JSON.stringify(ageALaDate(n, '2027-03-01')), '{"annees":27,"mois":0}');
    /* Une annee bissextile le rend a sa date. */
    eq(JSON.stringify(ageALaDate(n, '2028-02-29')), '{"annees":28,"mois":0}');
    /* Fin de mois : un 31 janvier plus un mois ne saute pas en mars. */
    eq(dateApresMois('2026-01-31', 1), '2026-02-28');
    eq(dateApresMois('2028-01-31', 1), '2028-02-29');
    eq(dateApresMois('2026-09-15', 12), '2027-09-15');
    eq(dateApresMois('2026-09-15', 240), '2046-09-15');
  });

  test('3. une date absente ou incohérente ne rend jamais zéro', () => {
    eq(ageALaDate('', '2026-09-15'), null, 'sans naissance');
    eq(ageALaDate('1990-03-10', ''), null, 'sans cible');
    eq(ageALaDate('pas une date', '2026-09-15'), null, 'date illisible');
    eq(ageALaDate('2030-01-01', '2026-09-15'), null, 'cible avant la naissance');
    Store.state = blankState(); Store.migrate();
    eq(dateNaissance(), null, 'un état neuf n’en porte pas');
    eq(ageAuPoint({ mois: 120 }), null, 'et aucun âge ne s’invente à sa place');
    Store.state.meta.naissance = '1990-03-10';
    vrai(dateNaissance() === '1990-03-10', 'une date valide se lit');
    Store.state.meta.naissance = '10/03/1990';
    eq(dateNaissance(), null, 'un autre format est refusé plutôt que deviné');
  });

  test('4. l’âge suit la date réelle du point, pas l’horizon en années', () => {
    const s = lireSource('assets/store.js');
    vrai(/return ageALaDate\(naissance, dateApresMois\(todayISO\(\), point\.mois\)\);/.test(s),
      'le compteur de mois du moteur donne la date, pas une addition d’années');
    /* Et c'est bien ce compteur que le moteur pose sur chaque point. */
    Store.state = blankState(); Store.migrate();
    Store.state.meta.naissance = '1990-03-10';
    const p = capitalisation({ years: 20 });
    vrai(p.points.length > 20, 'la projection porte ses points');
    for (const j of p.jalons) {
      const a = ageAuPoint(j);
      vrai(a && a.annees > 0, `le jalon ${j.horizon} porte un âge`);
      eq(a.annees, ageALaDate('1990-03-10', dateApresMois(todayISO(), j.mois)).annees, 'dérivé de sa date');
    }
  });

  test('5. l’âge s’affiche là où la date se lit, en deux longueurs', () => {
    const a = app();
    vrai(/const ageDetaille = a => !a \? '' :/.test(a) && /const ageCompact = a => !a \? '' :/.test(a),
      'deux formes, un seul calcul');
    /* Le tableau des horizons, sous l'année. */
    vrai(/<span class="sub">\$\{ageDetaille\(ageAuPoint\(j\)\)\}<\/span>/.test(a),
      'chaque horizon porte son âge');
    /* L'en-tête de la trajectoire, en compact. */
    vrai(/ageFin \? ` · \$\{ageCompact\(ageFin\)\}` : ''/.test(a),
      'et l’horizon choisi le porte à côté de son année');
    /* Et le réglage existe, en date. */
    vrai(/champDate\('Date de naissance', 'meta\.naissance'/.test(a), 'la date se saisit dans les hypothèses');
    vrai(/<input type="date" data-path="\$\{path\}"/.test(a), 'c’est un vrai champ date');
  });

  test('6. sans date de naissance, la projection ne change pas d’un euro', () => {
    Store.state = blankState(); Store.migrate();
    Store.state.now = { especes: 50000 };
    refreshAccounts();
    Store.state.meta.projMonthly = 500;
    const sans = capitalisation({ years: 20 });
    Store.state.meta.naissance = '1990-03-10';
    const avec = capitalisation({ years: 20 });
    eq(JSON.stringify(avec.points), JSON.stringify(sans.points),
      'les points sont identiques au centime');
    eq(JSON.stringify(avec.jalons), JSON.stringify(sans.jalons), 'les jalons aussi');
    /* Et le moteur ne lit jamais la date. */
    const s = lireSource('assets/store.js');
    const moteur = s.slice(s.indexOf('function capitalisation('), s.indexOf('function targetRequirements('));
    vrai(!/naissance|ageALaDate|ageAuPoint/.test(moteur), 'aucune mention de l’âge dans la capitalisation');
  });

  test('7. l’invitation est discrète, et mène au bon réglage', () => {
    const a = app();
    vrai(/trad\('Ajoute ta date de naissance pour voir ton âge dans la projection\.'\)/.test(a),
      'la phrase existe');
    vrai(/dateNaissance\(\) \? '' : `/.test(a), 'elle ne paraît que sans date');
    vrai(!/askConfirm\([^)]*naissance/.test(a), 'aucune fenêtre ne s’impose');
    for (const cle of ['Date de naissance', '{a} ans et {m} mois', '{a} ans et 1 mois',
                       'Ajoute ta date de naissance pour voir ton âge dans la projection.']) {
      vrai(!!I18N.en[cle], `« ${cle} » a sa traduction`);
    }
    vrai(I18N.en['{a} ans et {m} mois'].includes('{a}') && I18N.en['{a} ans et {m} mois'].includes('{m}'),
      'et les deux marques survivent à l’anglais');
  });
});

/* --- Une devise principale par profil -------------------------------------
   Un profil, une devise. Elle change l'unite, jamais les nombres, et la langue
   ne la decide pas. */
suite('Une devise principale par profil', () => {
  const neuf = () => { Store.state = blankState(); Store.migrate(); };
  const enLangue = (l, f) => {
    const avant = currentLang();
    try { setLang(l); return f(); } finally { setLang(avant); }
  };
  /* Les separateurs d'`Intl` sont des espaces insecables ou fines : les
     comparer a une espace ordinaire ferait echouer un format pourtant juste. */
  const plat = s => String(s).replace(/[\u00a0\u202f\u2009]/g, ' ');

  test('1. un état sans devise compte en euros', () => {
    neuf();
    delete Store.state.meta.devise;
    Store.migrate();
    eq(Store.state.meta.devise, 'EUR', 'la migration la pose');
    eq(deviseBase(), 'EUR');
    /* Idempotente : la rejouer ne change rien, et une valeur inconnue retombe. */
    Store.migrate();
    eq(Store.state.meta.devise, 'EUR');
    Store.state.meta.devise = 'XAU';
    Store.migrate();
    eq(Store.state.meta.devise, 'EUR', 'une devise inconnue redevient l’euro');
    Store.state.meta.devise = 'USD';
    Store.migrate();
    eq(Store.state.meta.devise, 'USD', 'un choix valide survit à la migration');
  });

  test('2. langue et devise sont indépendantes : les quatre croisements', () => {
    neuf();
    const cas = [];
    for (const [langue, devise] of [['fr', 'EUR'], ['en', 'USD'], ['fr', 'USD'], ['en', 'EUR']]) {
      Store.state.meta.devise = devise;
      cas.push(enLangue(langue, () => plat(fmtEUR0(1000))));
    }
    const [frEur, enUsd, frUsd, enEur] = cas;
    eq(frEur, '1 000 €', 'français + euro');
    eq(enUsd, '$1,000', 'anglais + dollar');
    vrai(/^1 000 \$/.test(frUsd), `français + dollar : le nombre au format français, le signe du dollar (${frUsd})`);
    eq(enEur, '€1,000', 'anglais + euro');
    /* Et la preuve que ce sont deux axes : quatre résultats distincts. */
    eq(new Set(cas).size, 4, 'aucune combinaison n’en recopie une autre');
  });

  test('3. changer de devise ne touche aucun nombre', () => {
    neuf();
    Store.state.now = { especes: 50000 };
    Store.state.budget.income = [{ label: 'Salaire', amount: 6200, period: 'mois' }];
    Store.state.budget.fixedCharges = [{ label: 'Loyer', amount: 2900, period: 'mois' }];
    Store.state.meta.projMonthly = 500;
    refreshAccounts();
    const photo = () => JSON.stringify({
      patrimoine: patrimoine(), budget: budgetFrame(), projection: capitalisation({ years: 20 }).points,
    });
    Store.state.meta.devise = 'EUR';
    const eur = photo();
    Store.state.meta.devise = 'USD';
    const usd = photo();
    eq(usd, eur, 'patrimoine, budget et projection rendent exactement les mêmes nombres');
    eq(num(Store.state.now.especes), 50000, 'et la donnée saisie n’a pas bougé');
  });

  test('4. le signe se pose dans t(), une seule fois, et seulement sur la marque', () => {
    const i = lireSource('assets/i18n.js');
    vrai(/function uniteMonetaire\(s\) \{/.test(i), 'un seul endroit pose le signe');
    vrai(/return uniteMonetaire\(s\);/.test(i), 'et t() y passe toute chaîne affichée');
    neuf();
    Store.state.meta.devise = 'EUR';
    eq(trad('Montant ({dev})'), 'Montant (€)');
    Store.state.meta.devise = 'USD';
    eq(trad('Montant ({dev})'), 'Montant ($)');
    /* La marque est explicite : une phrase qui parle de l'euro lui-meme, un
       plafond de la loi francaise, ne devient jamais un dollar. */
    const avecEuro = Object.keys(FR).filter(c => c.includes('€') && c.includes('{dev}'));
    eq(avecEuro.length, 0, 'aucune clef ne mélange le signe en dur et la marque');
    eq(trad('Aucune donnée'), 'Aucune donnée', 'une chaîne sans marque traverse t() intacte');
  });

  test('5. aucun montant affiché n’échappe au formateur', () => {
    const s = lireSource('assets/store.js');
    vrai(/currency: deviseBase\(\), currencyDisplay: 'narrowSymbol'/.test(s), 'fmtEUR lit la devise du profil');
    vrai(/montantsMasques \? masque\(deviseBase\(\)\)/.test(s), 'le masque aussi');
    vrai(/const fmtPart = v => fmtEUR\(v,/.test(s), 'et le prix par part');
    const c = lireSource('assets/charts.js');
    vrai(/currency: deviseBase\(\)/.test(c), 'les axes des graphiques aussi');
    vrai(!/\+ ' k€'/.test(c), 'plus aucun « k€ » collé à la main');
    const a = lireSource('assets/app.js');
    vrai(/style: 'currency', currency: deviseBase\(\)/.test(a), 'et la formule des parts');
  });

  test('6. le compact des axes suit la devise et la langue', () => {
    neuf();
    /* `Charts` n'expose pas son compact : on verifie la forme que produit la
       meme specification, celle qu'un axe rend a 125 000. */
    const compact = (v, devise) => plat(new Intl.NumberFormat(locale(), {
      style: 'currency', currency: devise, currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 1, notation: 'compact',
    }).format(v));
    eq(enLangue('en', () => compact(125000, 'USD')), '$125k', 'anglais, dollar');
    vrai(/125/.test(enLangue('fr', () => compact(125000, 'EUR'))), 'français, euro');
  });

  test('7. deux devises, et la table gouverne tout ce qui les liste', () => {
    eq(DEVISES_BASE.length, 2, 'EUR et USD pour cette passe');
    eq(DEVISES_BASE.map(([id]) => id).join(','), 'EUR,USD');
    const a = lireSource('assets/app.js');
    vrai(/options: DEVISES_BASE\.map\(/.test(a), 'le réglage se dérive de la table, il ne la recopie pas');
    vrai(/action: 'regl-devise'/.test(a), 'et la préférence existe, à côté de la langue');
    for (const [, nom] of DEVISES_BASE) vrai(!!I18N.en[nom], `« ${nom} » a sa traduction`);
    vrai(!!I18N.en['Devise principale'], 'et l’intitulé du réglage');
  });

  test('8. l’avertissement ne paraît que s’il y a des montants à relire', () => {
    const a = lireSource('assets/app.js');
    vrai(/if \(aDesMontantsSaisis\(\)\) \{/.test(a), 'la confirmation est conditionnelle');
    vrai(/Changer de devise ne convertit pas tes montants/.test(a), 'et elle le dit franchement');
    neuf();
    eq(aDesMontantsSaisis(), false, 'un profil neuf n’a rien à relire');
    Store.state.now = { especes: 8500 };
    refreshAccounts();
    eq(aDesMontantsSaisis(), true, 'un solde suffit');
    neuf();
    Store.state.budget.income = [{ label: 'Salaire', amount: 6200, period: 'mois' }];
    eq(aDesMontantsSaisis(), true, 'un revenu aussi');
  });

  test('9. la devise se persiste, s’exporte et ne contamine pas la démo', () => {
    neuf();
    Store.state.meta.devise = 'USD';
    /* Elle vit dans `meta`, donc elle suit l'etat partout ou il va : le
       stockage local, la sauvegarde en ligne, l'export JSON. */
    const copie = JSON.parse(JSON.stringify(Store.state));
    eq(copie.meta.devise, 'USD', 'un export la porte');
    Store.state = copie; Store.migrate();
    eq(deviseBase(), 'USD', 'et un import la rend');
    /* La demonstration ecrit sous sa propre clef de stockage : sa devise est
       celle de sa graine, et le profil reel ne la voit jamais. */
    const s = lireSource('assets/store.js');
    /* Cette instance-ci n'a pas de mode demonstration : la question de la
       contamination ne s'y pose pas, et l'exiger ferait echouer un test qui
       n'a rien a verifier. */
    if (/const cleStockage = /.test(s)) {
      vrai(/const cleStockage = \(\) => cleParUtilisateur\(modeDemo\(\) \? CLE_DEMO : CLE_REELLE\);/.test(s),
        'les deux états ne partagent pas leur clef');
    }
    vrai(/devise: 'EUR',/.test(lireSource('assets/seed.js')), 'et la graine déclare la sienne');
  });

  test('10. le change des cours pivote sur la devise du profil', () => {
    const q = lireSource('assets/quotes.js');
    vrai(/p\.currency !== deviseBase\(\)/.test(q), 'une ligne dans la devise du profil ne se convertit pas');
    vrai(/`\$\{deviseBase\(\)\}\$\{c\}=X`/.test(q), 'la paire demandée part de la devise du profil');
    vrai(/pos\.currency !== deviseBase\(\)/.test(q), 'et le taux ne s’applique qu’aux lignes étrangères');
    neuf();
    Store.state.meta.devise = 'USD';
    Store.state.positions = [{ id: 'p1', name: 'S&P 500', symbol: 'SPY', qty: 10, price: 500,
                               currency: 'USD', fx: 1, account: null }];
    eq(tauxAchat(Store.state.positions[0]), 1, 'un titre en dollars, un profil en dollars : aucun change');
    eq(posValue(Store.state.positions[0]), 5000, 'et la valeur est le produit nu');
  });
});

/* --- La devise se choisit avant le premier montant -------------------------
   Une micro-etape, avant la premiere saisie, et une seule fois. */
suite('La devise, avant la première saisie', () => {
  const app = () => lireSource('assets/app.js');
  const neuf = () => { Store.state = blankState(); Store.migrate(); };

  test('1. un profil vierge doit choisir, et la question précède toute saisie', () => {
    neuf();
    eq(deviseAChoisir(), true, 'rien n’a été choisi');
    const a = app();
    /* Les trois portes d'une saisie monetaire passent par la meme. */
    for (const acte of ['ajouter-compte', 'add-income', 'add-charge']) {
      const i = a.indexOf(`'${acte}'(`);
      vrai(i > 0, `${acte} existe`);
      const debut = a.slice(i, i + 400);
      vrai(/if \(!await devisePosee\(\)\) return;/.test(debut),
        `${acte} ne s’ouvre pas sans devise`);
    }
    vrai(/async function devisePosee\(\) \{\s*\n\s*if \(!deviseAChoisir\(\)\) return true;/.test(a),
      'et la porte est unique');
  });

  test('2. le choix se pose, et la suite s’ouvre dans cette devise', () => {
    const a = app();
    vrai(/Store\.state\.meta\.devise = choix;\s*\n\s*Store\.state\.meta\.deviseChoisie = true;\s*\n\s*Store\.save\(\);/.test(a),
      'la devise est enregistrée avant que quoi que ce soit s’ouvre');
    neuf();
    Store.state.meta.devise = 'USD';
    Store.state.meta.deviseChoisie = true;
    eq(deviseAChoisir(), false, 'la question ne se repose pas');
    eq(deviseBase(), 'USD');
    Store.state.meta.devise = 'EUR';
    eq(deviseBase(), 'EUR');
  });

  test('3. aucune des deux n’est préchoisie, et la langue ne répond pas', () => {
    const a = app();
    const f = a.slice(a.indexOf('function choixDevise()'), a.indexOf('async function devisePosee()'));
    vrai(/aria-checked="false"/.test(f) && !/aria-checked="true"/.test(f),
      'les deux cartes partent décochées');
    vrai(/id="devOk" type="button" disabled/.test(f), 'et le bouton attend un choix');
    vrai(/if \(!choix\) return;/.test(f), 'il ne valide rien sans lui');
    /* La langue ordonne, elle ne choisit pas. */
    vrai(/const ordre = enAnglais\(\) \? \['USD', 'EUR'\] : \['EUR', 'USD'\];/.test(f),
      'l’anglais voit le dollar en premier');
    vrai(!/meta\.devise = enAnglais|currentLang\(\) === 'en' \? 'USD'/.test(a),
      'et aucune langue ne pose la devise à la place de quelqu’un');
  });

  test('4. un état existant garde l’euro et n’est jamais interrompu', () => {
    /* Un profil deja servi : ses montants sont des euros, la question n'a pas
       lieu d'etre posee. */
    Store.state = blankState();
    Store.state.now = { especes: 50000 };
    delete Store.state.meta.devise;
    delete Store.state.meta.deviseChoisie;
    Store.migrate();
    refreshAccounts();
    eq(Store.state.meta.devise, 'EUR', 'il compte en euros');
    eq(Store.state.meta.deviseChoisie, true, 'et on ne le lui redemande pas');
    eq(deviseAChoisir(), false);
    /* Un profil vierge, lui, doit repondre. */
    neuf();
    eq(Store.state.meta.devise, 'EUR', 'une unité existe toujours, pour que rien ne s’affiche nu');
    eq(Store.state.meta.deviseChoisie, false, 'mais elle n’a pas été choisie');
    eq(deviseAChoisir(), true);
    /* Idempotent : rejouer la migration ne rouvre pas la question. */
    Store.migrate();
    eq(Store.state.meta.deviseChoisie, false);
  });

  test('5. le choix survit à une fermeture, une reprise, une synchronisation', () => {
    neuf();
    Store.state.meta.devise = 'USD';
    Store.state.meta.deviseChoisie = true;
    /* Il vit dans `meta`, donc il part partout ou l'etat part : le stockage
       local, la sauvegarde en ligne, l'export. */
    const repris = JSON.parse(JSON.stringify(Store.state));
    Store.state = repris; Store.migrate();
    eq(deviseBase(), 'USD', 'au retour, toujours le dollar');
    eq(deviseAChoisir(), false, 'et la question ne revient pas');
    /* Et la reprise du guide se fait au premier pas, pas a la devise. */
    eq(aUnComptePropre(), false, 'aucun compte n’a encore été créé');
  });

  test('6. la démonstration n’écrit jamais la devise réelle', () => {
    const a = app();
    const demo = a.slice(a.indexOf("'charger-demo'()"), a.indexOf("'charger-demo'()") + 1200);
    vrai(!/meta\.devise|deviseChoisie/.test(demo), 'elle ne touche pas au choix');
    vrai(!/await devisePosee\(\)/.test(demo), 'et elle n’exige pas qu’il soit fait');
    const s = lireSource('assets/store.js');
    /* Cette instance-ci n'a pas de mode demonstration : rien a isoler. */
    if (/const cleStockage = /.test(s)) {
      vrai(/const cleStockage = \(\) => cleParUtilisateur\(modeDemo\(\) \? CLE_DEMO : CLE_REELLE\);/.test(s),
        'les deux états vivent sous deux clefs');
    }
  });

  test('7. l’avertissement de conversion ne paraît qu’après coup', () => {
    const a = app();
    const regl = a.slice(a.indexOf("async 'regl-devise'()"), a.indexOf("async 'regl-place'()"));
    vrai(/if \(aDesMontantsSaisis\(\)\) \{/.test(regl), 'il dépend des données existantes');
    vrai(/Par exemple, 10 000 € deviendra 10 000 \$, sans conversion de valeur\./.test(regl),
      'et il donne l’exemple');
    /* La micro-etape, elle, n'avertit de rien : il n'y a encore aucun montant. */
    const f = a.slice(a.indexOf('function choixDevise()'), a.indexOf('async function devisePosee()'));
    vrai(!/convertira|conversion/.test(f), 'le premier choix ne fait peur à personne');
    for (const [fr] of [['Quelle est ta devise principale ?'], ['Configurons ton Longward'],
                        ['Dollar américain'], ['Continuer'],
                        ['Tous les montants de ton Longward seront lus dans cette devise.']]) {
      vrai(!!I18N.en[fr], `« ${fr} » a sa traduction`);
    }
  });

  test('8. deux cartes touchables, aucun menu, aucun drapeau', () => {
    const a = app();
    const f = a.slice(a.indexOf('function choixDevise()'), a.indexOf('async function devisePosee()'));
    vrai(!/<select/.test(f), 'pas de menu déroulant');
    vrai(/class="devise-carte"/.test(f), 'deux cartes');
    vrai(/NOMS_DEVISE\[id\]/.test(f), 'chacune nommée, et le nom vient du modèle');
    const css = lireSource('assets/styles.css');
    vrai(/\.devise-carte \{[\s\S]*?min-height: 64px;/.test(css), 'la cible du doigt est large');
    vrai(!/flag|drapeau/.test(f), 'aucun drapeau : l’euro n’est pas la France');
  });
});

/* --- Le poids de chaque poche dans l'infobulle de l'historique -------------

   « Liquidites 6 150 EUR » ne dit pas de quoi le patrimoine etait fait ce
   mois-la : il fallait diviser de tete par un total lu deux lignes plus bas.
   L'infobulle porte desormais la part, sur la meme base que le total qu'elle
   affiche, et les chiffres de cette suite sont ceux de l'exemple qui l'a
   demandee. */
finDePartieDeTests('tests/21-premier-ecran-patrimoine-abord.tests.js');
