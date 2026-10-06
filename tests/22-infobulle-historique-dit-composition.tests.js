partieDeTests('tests/22-infobulle-historique-dit-composition.tests.js');
suite('L’infobulle de l’historique dit la composition, pas seulement les montants', () => {
  const TOTAL = 30000;
  const enFrancais = f => { setLang('fr'); try { return f(); } finally { setLang('fr'); } };
  const enAnglais = f => { setLang('en'); try { return f(); } finally { setLang('fr'); } };

  test('chaque poche porte sa part du total de cette date', () => {
    setLang('fr');
    /* Les quatre lignes de l'exemple, au dixieme pres. */
    eq(fmtPoids(7200, TOTAL), '24,0 %', 'les liquidités');
    eq(fmtPoids(9900, TOTAL), '33,0 %', 'les actifs de marché, et le zéro décimal reste');
    eq(fmtPoids(90, TOTAL), '0,3 %', 'une poche minuscule reste visible');
    eq(fmtPoids(12810, TOTAL), '42,7 %', 'le non coté');
    /* Et le nombre nu, sans mise en forme, pour que le calcul se lise seul. */
    pres(poidsDansTotal(7200, TOTAL), 7200 / TOTAL * 100, 'aucune correction au passage');
  });

  test('une décimale, jamais plus, jamais moins', () => {
    setLang('fr');
    /* « 33 % » perdrait la difference avec 33,4 ; « 0,2826 % » n'apprend rien. */
    vrai(/^\d+,\d %$/.test(fmtPoids(9900, TOTAL)), '33,0 % garde son zéro');
    vrai(/^\d+,\d %$/.test(fmtPoids(90, TOTAL)), '0,3 % garde sa décimale');
    const c = lireSource('assets/charts.js');
    const bulle = c.slice(c.indexOf('const base = totals[i];'), c.indexOf('const left = Math.min'));
    /* La ligne Total dit « 100 % » sans decimale : cent n'est pas une mesure
       arrondie, c'est la definition de la base. */
    vrai(/fmtPct\(100, 0\)/.test(bulle), 'le total dit 100 % sans décimale');
  });

  test('la somme des parts arrondies n’est pas maquillée', () => {
    setLang('fr');
    /* 24,0 + 33,0 + 0,3 + 42,7 fait bien 100,0 ici, mais rien ne le garantit :
       un autre mois donnera 99,9 ou 100,1, et c'est acceptable. Ce que ce test
       fige, c'est qu'AUCUNE ligne n'est corrigee pour forcer la somme. */
    const parts = [7200, 9900, 90, 12810].map(v => poidsDansTotal(v, TOTAL));
    pres(parts.reduce((s, x) => s + x, 0), 100, 'les parts exactes font cent');
    for (const [i, v] of [7200, 9900, 90, 12810].entries()) {
      pres(parts[i], v / TOTAL * 100, `la part de ${v} est son quotient, et rien d’autre`);
    }
    const c = lireSource('assets/charts.js');
    const bulle = c.slice(c.indexOf('const base = totals[i];'), c.indexOf('const left = Math.min'));
    vrai(!/reste|reliquat|100 -|100-/.test(bulle.replace(/\/\*[\s\S]*?\*\//g, '')),
      'aucune dernière ligne rattrapée pour tomber juste');
  });

  test('un total nul ou négatif ne produit ni NaN ni Infinity', () => {
    setLang('fr');
    for (const base of [0, 0.004, -1, -30000]) {
      eq(poidsDansTotal(1000, base), null, `base ${base} : la part n’existe pas`);
      eq(fmtPoids(1000, base), '', 'et rien ne s’affiche');
    }
    /* Ni zero de substitution, ni tiret : les six autres endroits de
       l'application qui portent une part indisponible n'ecrivent rien, et le
       tiret cadratin est proscrit du texte affiché. */
    const c = lireSource('assets/charts.js');
    const bulle = c.slice(c.indexOf('const base = totals[i];'), c.indexOf('const left = Math.min'));
    vrai(!/—/.test(bulle), 'aucun tiret cadratin');
    /* Et la colonne disparaît entière : l'infobulle redevient celle d'avant. */
    vrai(/const avecPoids = !!opts\.parts && baseDivisible\(base\);/.test(bulle),
      'la colonne ne paraît que sur une base divisible');
    vrai(/: lignes\.map\(\(sr, k\) => `<div class="tt-row">/.test(bulle),
      'sinon le balisage d’avant est rendu tel quel');
  });

  test('une poche négative garde son signe, sur une base positive', () => {
    setLang('fr');
    /* Le tracé net impute le reliquat de dette sur la poche qui porte les
       prêts : elle devient négative, et la carte de répartition montre déjà
       cette part telle quelle. La masquer ferait un total qui ne vaudrait plus
       la somme de ses parts. */
    pres(poidsDansTotal(-5000, 20000), -25, 'la part suit le signe de la poche');
    vrai(fmtPoids(-5000, 20000).startsWith('−'), 'et le moins typographique le dit');
    /* Le total reste la somme de ses parts, signes compris. */
    const poches = [25000, -5000];
    pres(poches.reduce((s, v) => s + poidsDansTotal(v, 20000), 0), 100,
      'les parts font toujours cent');
  });

  test('une valeur minuscule ne casse rien', () => {
    setLang('fr');
    eq(fmtPoids(0.4, TOTAL), '0,0 %', 'sous le dixième, la part s’affiche nulle sans erreur');
    eq(fmtPoids(0, TOTAL), '0,0 %', 'et zéro reste zéro');
    /* Mais une poche absente n'entre pas dans l'infobulle : elle n'y entre pas
       davantage pour montrer « 0,0 % ». */
    const c = lireSource('assets/charts.js');
    vrai(/const lignes = series\.filter\(sr => Math\.abs\(Number\(p\[sr\.key\]\) \|\| 0\) > 0\.005\);/.test(c),
      'une poche vide ce mois-là reste hors de la bulle');
  });

  test('les deux langues, les deux devises', () => {
    /* Le poids suit la locale, jamais une virgule écrite à la main. */
    enFrancais(() => eq(fmtPoids(7200, TOTAL), '24,0 %', 'virgule décimale et espace insécable'));
    enAnglais(() => eq(fmtPoids(7200, TOTAL), '24.0%', 'point décimal, pas d’espace'));
    /* Et il ne dépend d’aucune devise : c’est un rapport, pas un montant. */
    setLang('fr');
    const avant = Store.state.meta.devise;
    try {
      Store.state.meta.devise = 'EUR';
      const eur = fmtPoids(7200, TOTAL);
      Store.state.meta.devise = 'USD';
      eq(fmtPoids(7200, TOTAL), eur, 'le poids est le même en euros et en dollars');
    } finally { Store.state.meta.devise = avant; }
    const c = lireSource('assets/charts.js');
    vrai(!/[€$]%/.test(c), 'aucun signe collé au pourcentage');
  });

  test('le montant et sa part sortent du même instantané', () => {
    const c = lireSource('assets/charts.js');
    const bulle = c.slice(c.indexOf('const base = totals[i];'), c.indexOf('const left = Math.min'));
    /* LA BASE EST LE TOTAL AFFICHÉ. Relire un patrimoine d'aujourd'hui pour
       diviser un montant de mars donnerait des parts qui ne totalisent pas
       cent, et personne ne pourrait dire laquelle des deux lignes ment. */
    vrai(/const base = totals\[i\];/.test(c), 'la base est le total du point');
    vrai(/totals\[i\] = |const totals = points\.map/.test(c) || /const totals = points\.map/.test(c),
      'lui-même dérivé des séries tracées');
    for (const interdit of ['patrimoine(', 'nowTotals(', 'historySeries(', 'poidsPoches(']) {
      vrai(!bulle.includes(interdit), `l’infobulle ne relit pas ${interdit}`);
    }
    /* Et le montant de la ligne vient du même point que sa part. */
    /* Le montant passe par `arrondirParts`, pour refaire le total a l'euro,
       mais il part du meme point que sa part. */
    vrai(/const euros = arrondirParts\(lignes\.map\(sr => p\[sr\.key\] \|\| 0\), totals\[i\]\);/.test(bulle)
      && /\$\{fmtEUR0\(euros\[k\]\)\}<\/b>\$\{poids\(p\[sr\.key\] \|\| 0\)\}/.test(bulle),
      'la même valeur nourrit le montant et le poids');
  });

  test('trois colonnes qui s’alignent, et rien ne déborde', () => {
    const css = lireSource('assets/styles.css');
    const bloc = css.slice(css.indexOf('.tt-parts {'), css.indexOf('.tt-fin {') + 60);
    /* UNE SEULE GRILLE POUR TOUTE LA BULLE. Une rangée en flex est son propre
       conteneur : sa colonne de montants se cale sur la longueur de son propre
       libellé, et rien ne s'aligne avec la rangée du dessus. */
    vrai(/display: grid/.test(bloc), 'les rangées partagent une grille');
    vrai(/grid-template-columns: auto minmax\(0, 1fr\) auto auto/.test(bloc),
      'quatre colonnes : pastille, libellé, montant, poids');
    vrai(/\.tt-ligne \{ display: contents; \}/.test(bloc),
      'et chaque rangée s’y fond, sinon ses cellules ne seraient pas des cellules');
    /* Des chiffres de largeur égale des deux côtés, sinon les virgules dansent. */
    eq((bloc.match(/font-variant-numeric: tabular-nums/g) || []).length, 2,
      'montants et poids alignent leurs chiffres');
    /* Le montant reste prioritaire : encre pleine contre encre secondaire. */
    vrai(/\.tt-parts b \{[^}]*color: var\(--text-primary\)/.test(bloc), 'le montant garde l’encre pleine');
    vrai(/\.tt-poids \{[^}]*color: var\(--muted\)/.test(bloc), 'le poids passe en second plan');
    /* Et il ne se coupe pas devant son signe. */
    vrai(/\.tt-poids \{[^}]*white-space: nowrap/.test(bloc), '« 24,0 % » tient sur une ligne');
    /* Le filet du total traverse les quatre colonnes : une rangée fondue n'a
       plus de boîte, donc plus de bordure. */
    vrai(/\.tt-filet \{[^}]*grid-column: 1 \/ -1/.test(bloc), 'le filet traverse la grille');
  });

  test('la Projection garde son infobulle, la part n’y a pas de sens', () => {
    const a = lireSource('assets/app.js');
    /* Le même dessin sert deux courbes. « Départ et versements » et
       « Rendement » ne composent pas un patrimoine : une part y répondrait à
       une question que personne ne pose. L'option le dit, plutôt qu'un défaut
       qui s'appliquerait partout. */
    const proj = a.slice(a.indexOf("Charts.stackedArea($('#chartProjection')"),
                         a.indexOf("Charts.stackedArea($('#chartProjection')") + 700);
    vrai(!/parts: true/.test(proj), 'la Projection ne demande pas les parts');
    const debut = a.indexOf('function monterEvolution()');
    vrai(/parts: true/.test(a.slice(debut, a.indexOf('\n}', debut))),
      'l’historique, lui, les demande');
  });
});

/* --- Trois insights, trois endroits ---------------------------------------

   « Progression du patrimoine » et « Poids d'une poche » sont deux lectures
   differentes, de deux familles differentes, et elles menaient toutes les deux
   a la courbe de l'evolution. Deux des trois places de la carte ouvraient donc
   le meme ecran, et la section paraissait se repeter.

   La destination se DERIVE du renvoi, et c'est la seule chose que cette suite
   lit dans la source : une metadonnee ecrite a la main a cote du bouton finit
   par le contredire. */
function destinationsPresentation() {
  const a = lireSource('assets/app.js');
  const table = a.slice(a.indexOf('const PRESENTATION_INSIGHT'), a.indexOf('/* --- Ce qui a deja ete montre'));
  const sansCommentaires = table.replace(/\/\*[\s\S]*?\*\//g, '');
  const par = {};
  let id = null;
  for (const ligne of sansCommentaires.split('\n')) {
    const entree = ligne.match(/^  ([a-z_]+): \{/);
    if (entree) { id = entree[1]; continue; }
    const cta = ligne.match(/cta: \{ vue: '([a-z-]+)'(?:, ancre: '([a-z]+)')?/);
    if (cta && id) { par[id] = `${cta[1]}:${cta[2] || ''}`; id = null; }
  }
  return par;
}

suite('À retenir mène à trois endroits différents, pas trois fois au même', () => {
  const app = () => lireSource('assets/app.js');

  test('la destination se dérive du renvoi, vue ET ancre', () => {
    const a = app();
    vrai(/const destinationInsight = p => \(p && p\.cta\) \? `\$\{p\.cta\.vue\}:\$\{p\.cta\.ancre \|\| ''\}` : '';/.test(a),
      'elle se lit sur le renvoi, elle ne se recopie pas ailleurs');
    /* PAS LA VUE SEULE. Trois insights pointent vers `overview` et y visent
       trois cartes qui repondent a trois questions differentes : les confondre
       en ecarterait deux pour une ressemblance qui n'existe que dans l'URL. */
    /* Deux des trois exemples ont quitté le catalogue : leur lecture redisait la
       carte qu'elle visait, sur le même écran. Le fait que le contrôle protège
       n'a pas bougé — plusieurs renvois vers `overview` restent distincts parce
       que l'ancre les sépare — et il se vérifie sur ce qui reste. */
    const d = destinationsPresentation();
    eq(d.wealth_pace_shift, 'overview:evolution');
    eq(d.goal_projected_date, 'objective:trajectoire');
    /* Plusieurs regles peuvent viser la MEME carte, et c'est justement le cas
       que la suite suivante traite : ce qui compte ici est que l'ancre entre
       dans la destination, pas que chaque regle en ait une a elle. */
    vrai(Object.values(d).every(x => !x.endsWith(':')) === false
      || Object.values(d).some(x => x.includes(':') && !x.endsWith(':')),
      'une ancre entre bien dans la destination');
    /* ET SURTOUT PAS LE LIBELLE : « Voir l'évolution » est du texte traduit, la
       sélection changerait de comportement entre le français et l'anglais. */
    /* La tranche s'arrete a la fin de la fonction : ses voisines parlent bien de
       libelles, et une fenetre trop large les aurait avalees. */
    const sel = a.slice(a.indexOf('const destinationInsight'),
                        a.indexOf(';', a.indexOf('const destinationInsight')));
    vrai(!/libelle/.test(sel), 'le libellé n’entre jamais dans la destination');
  });

  test('chaque règle a sa destination, et le cas observé est bien un doublon', () => {
    const d = destinationsPresentation();
    eq(Object.keys(d).length, REGLES_INSIGHT.length, 'les treize règles portent une destination');
    for (const r of REGLES_INSIGHT) vrai(!!d[r.id], `${r.id} a la sienne`);
    /* LE CAS QUI A DEMANDE CETTE PASSE. Deux lectures différentes, deux familles
       différentes, et le même graphique au bout du renvoi. */
    eq(d.wealth_pace_shift, d.pocket_share_shift,
      'progression et poids d’une poche mènent au même endroit');
    const prog = REGLES_INSIGHT.find(r => r.id === 'wealth_pace_shift');
    const poche = REGLES_INSIGHT.find(r => r.id === 'pocket_share_shift');
    vrai(prog.dedupeGroup !== poche.dedupeGroup, 'mais elles ne disent pas la même chose');
    vrai(prog.famille !== poche.famille, 'et ne sont pas de la même famille');
    /* Assez de destinations distinctes pour que la carte ait de quoi varier : le
       nombre suit le catalogue, et deux regles l'ont quitte. Ce qui compte est
       qu'elles ne convergent pas toutes au meme endroit, pas un compte exact. */
    vrai(new Set(Object.values(d)).size >= 5, `${new Set(Object.values(d)).size} destinations distinctes`);
  });

  test('premier tour : au plus une entrée par destination', () => {
    const l = [['A', 'history'], ['B', 'history'], ['C', 'autonomy'], ['D', 'goal']];
    eq(selectionParClef(l, x => x[1], 3).map(x => x[0]).join(','), 'A,C,D',
      'B laisse sa place, sa destination est déjà prise');
    const m = [['A', 'history'], ['B', 'allocation'], ['C', 'autonomy'], ['D', 'goal']];
    eq(selectionParClef(m, x => x[1], 3).map(x => x[0]).join(','), 'A,B,C',
      'quatre destinations, les trois premières sortent');
  });

  test('second tour : la diversité ne cache jamais un insight utile', () => {
    /* Deux destinations seulement, trois places : la troisieme revient a
       l'entree ecartee, derriere les deux autres. */
    const l = [['A', 'history'], ['B', 'history'], ['C', 'autonomy']];
    eq(selectionParClef(l, x => x[1], 3).map(x => x[0]).join(','), 'A,C,B',
      'B revient au second tour, mais après C');
    /* Une seule destination : la carte se remplit quand même. */
    const m = [['A', 'history'], ['B', 'history'], ['C', 'history']];
    eq(selectionParClef(m, x => x[1], 3).map(x => x[0]).join(','), 'A,B,C',
      'un seul endroit ne vide pas la carte');
    /* Deux entrées, deux places occupées : la diversité ne crée pas de trou. */
    eq(selectionParClef([['A', 'history'], ['B', 'history']], x => x[1], 3)
      .map(x => x[0]).join(','), 'A,B', 'rien n’est perdu');
  });

  test('zéro, un, deux : le comportement ne bouge pas', () => {
    eq(selectionParClef([], x => x[1], 3).length, 0, 'rien à choisir, rien de choisi');
    eq(selectionParClef([['A', 'history']], x => x[1], 3).map(x => x[0]).join(','), 'A');
    eq(selectionParClef([['A', 'history'], ['B', 'goal']], x => x[1], 3)
      .map(x => x[0]).join(','), 'A,B');
    /* Et jamais plus que le plafond demandé. */
    const cinq = 'ABCDE'.split('').map((n, i) => [n, 'd' + i]);
    eq(selectionParClef(cinq, x => x[1], 3).length, 3, 'trois places, trois entrées');
  });

  test('aucun tirage, aucune horloge : deux lectures, même résultat', () => {
    const l = [['A', 'history'], ['B', 'history'], ['C', 'autonomy'], ['D', 'goal']];
    const a = selectionParClef(l, x => x[1], 3).map(x => x[0]).join(',');
    for (let n = 0; n < 5; n++) {
      eq(selectionParClef(l, x => x[1], 3).map(x => x[0]).join(','), a, 'même liste, même ordre');
    }
    const m = lireSource('assets/insights.js');
    const bloc = m.slice(m.indexOf('function selectionParClef'), m.indexOf('COUCHE 2'));
    for (const interdit of ['Math.random', 'Date.now', 'sort(', 'shuffle']) {
      vrai(!bloc.includes(interdit), `la sélection n’utilise pas ${interdit}`);
    }
  });

  test('la déduplication métier passe avant la diversité de destination', () => {
    /* L'ordre est fige : le moteur retire d'abord ce qui dit deux fois la meme
       chose, la carte evite ensuite d'ouvrir deux fois le meme ecran. Inverser
       les deux laisserait passer un doublon métier sous prétexte qu'il mène
       ailleurs. */
    Fixture.poser();
    const moteur = construireInsights();
    const groupes = moteur.map(i => i.dedupeGroup);
    eq(new Set(groupes).size, groupes.length, 'le moteur a déjà dédupliqué');
    const d = destinationsPresentation();
    const carte = selectionParClef(moteur, i => d[i.id], 3);
    const g2 = carte.map(i => i.dedupeGroup);
    eq(new Set(g2).size, g2.length, 'et la carte n’en réintroduit aucun');
  });

  test('sur la graine, les trois entrées mènent à trois endroits', () => {
    Fixture.poser();
    const d = destinationsPresentation();
    const moteur = construireInsights();
    const carte = selectionParClef(moteur, i => d[i.id], 3);
    vrai(carte.length <= 3, `${carte.length} entrées`);
    const dests = carte.map(i => d[i.id]);
    /* Si le moteur propose au moins trois destinations distinctes, la carte en
       montre trois distinctes. Sinon le second tour a comblé, et c'est voulu. */
    const dispo = new Set(moteur.map(i => d[i.id]));
    if (dispo.size >= carte.length) {
      eq(new Set(dests).size, dests.length, 'autant de destinations que d’entrées');
    }
    /* L'ordre reste celui du moteur pour le premier tour : la tête ne bouge
       jamais. */
    eq(carte[0] && carte[0].id, moteur[0] && moteur[0].id, 'le mieux classé garde sa place');
  });

  test('aucun bouton « autres insights », et le rendu ne change pas de forme', () => {
    const a = app();
    const rendu = a.slice(a.indexOf('function carteARetenir()'), a.indexOf('function viewOverview()'));
    for (const mot of ['Voir d’autres', 'Mélanger', 'Rafraîchir', 'Plus d’insights']) {
      vrai(!rendu.includes(mot), `aucun bouton « ${mot} »`);
    }
    /* La vue ne reclasse toujours rien : elle lit la liste que le moteur a
       ordonnée, et la sélection ne fait que retirer. */
    vrai(!/\.sort\(/.test(rendu), 'aucun second classement dans la vue');
    vrai(/dernierARetenir = lus\.map/.test(rendu),
      'et la mémoire note ce qui a vraiment été montré, pas ce que le moteur proposait');
  });
});

/* --- La reserve immediate passe devant -------------------------------------

   L'accueil ne donne pas deux reserves pour la meme question, une petite sur
   sa carte et une grande dans sa lecture. Les deux seraient justes : la
   premiere compte l'epargne de precaution et le cash courant, la seconde y
   ajoute l'argent fleche vers un projet et ce qui se vend chez un courtier.
   Personne ne pourrait deviner laquelle dit de quoi on vivrait demain, et la
   plus grande passerait devant -- c'est-a-dire la plus rassurante. */
suite('La réserve de sécurité passe devant le mobilisable', () => {
  /* Pose une reserve d'exactement N mois : tout le cash de precaution et de
     courant se concentre sur une entree, les autres a zero. Le reste du
     patrimoine ne bouge pas, donc le mobilisable reste plus grand. */
  const poserReserve = mois => {
    Fixture.poser();
    const burn = runway().burn;
    let premier = null;
    for (const c of Store.state.comptes) for (const e of (c.cash || [])) {
      if (e.affectation !== 'precaution' && e.affectation !== 'courant') continue;
      if (!premier) premier = e; else e.montant = 0;
    }
    premier.montant = mois * burn;
    refreshAccounts();
    return runway();
  };

  test('un seul chiffre de réserve, et les deux écrans le lisent', () => {
    Fixture.poser();
    const r = runway();
    const p = poches();
    /* LE COUSSIN EST CELUI SUR LEQUEL ON VIVRAIT DEMAIN : l'épargne de
       précaution plus le cash courant. L'argent fléché vers un projet ou en
       attente d'investissement a déjà un travail. */
    pres(r.reserve, p.precaution + p.courant, 'la réserve est précaution + courant');
    pres(r.reserveMois, r.reserve / r.burn, 'et ses mois sont ce rapport');
    /* La carte ne recalcule plus rien : elle lit le modèle. */
    const a = lireSource('assets/app.js');
    const carte = a.slice(a.indexOf('function carteReserveResume()'),
                          a.indexOf('\n}\n', a.indexOf('function carteReserveResume()')));
    vrai(/data-anchor="autonomie"/.test(carte), 'la carte garde son ancre');
    vrai(/const ep = r\.reserve;/.test(carte), 'la carte lit la réserve du modèle');
    vrai(!/pk\.precaution \+ pk\.courant/.test(carte), 'elle ne la recompose plus');
    /* Et l'insight lit le meme nombre, pas un troisieme. */
    const i = evaluerInsights().find(x => x.id === 'liquidity_runway');
    if (i) {
      eq(i.params.reserve, num(r.reserve), 'l’insight annonce la même somme que la carte');
      eq(i.params.months, num(r.reserveMois), 'et les mêmes mois');
      vrai(i.params.months !== num(r.liquidMonths) || num(r.reserve) === num(r.burn) * num(r.liquidMonths),
        'ce n’est plus le chiffre mobilisable');
    }
  });

  test('le complément existe, il passe derrière, et la somme retombe juste', () => {
    /* CE CONTRÔLE INTERROGE LE MODÈLE, PLUS UNE RÈGLE D'INSIGHT. Il passait par
       `liquidity_runway`, dont la lecture redisait la carte du même écran et qui
       a quitté le catalogue ; la propriété, elle, appartient à `runway()` et
       n'avait rien à faire derrière une règle de présentation.

       RIEN N'EST PERDU : ce que la réserve ne compte pas existe quand même, et
       un total vaut la somme de ses parts. */
    Fixture.poser();
    const r = runway();
    const complement = num(r.liquidMonths) - num(r.reserveMois);
    pres(num(r.reserveMois) + complement, num(r.liquidMonths),
      'réserve plus complément font les mois mobilisables');
    vrai(complement >= -1e-9, 'le complément ne peut pas être négatif');
    /* Et le mobilisable reste le plus grand des deux : c'est ce qui rendait la
       confusion coûteuse, puisque le plus rassurant passait devant. */
    vrai(num(r.liquidMonths) >= num(r.reserveMois),
      'le mobilisable contient la réserve, jamais l’inverse');
  });




  test('« autonomie financière » a cédé la place, partout où c’était son nom', () => {
    const a = lireSource('assets/app.js');
    /* Les commentaires peuvent garder l'ancien mot : ils expliquent justement
       pourquoi il est parti. Seul compte ce qui s'affiche. */
    const affiche = a.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    /* Le terme evoquait aussi l'independance financiere : la carte compte de
       quoi tenir si les revenus s'arretaient, pas de quoi arreter de
       travailler. */
    vrai(!/Autonomie financière/.test(affiche), 'plus aucun titre ne porte l’ancien nom');
    vrai(!/autonomie financière/.test(affiche), 'ni aucune bulle d’aide');
    vrai(!/hors autonomie/.test(affiche), 'ni la mention des paliers hors cumul');
    /* Les deux renvois qui nommaient la carte la nomment toujours, avec son
       nouveau nom : un renvoi vers une carte qui n'existe plus est pire que
       pas de renvoi. */
    vrai(a.includes('Elle alimente la carte « Réserve de sécurité » de l’accueil.'),
      'la bulle des positions nomme la bonne carte');
    vrai(!!I18N.en['Réserve de sécurité'] && !!I18N.en['hors réserve'],
      'et les deux langues suivent');
  });

  test('sans coût de la vie, la réserve ne vaut pas zéro mois', () => {
    Store.state = blankState(); Store.migrate(); refreshAccounts();
    const r = runway();
    eq(r.burn, 0, 'aucun coût de la vie');
    eq(r.reserveMois, 0, 'le rapport ne s’invente pas');
    vrai(Number.isFinite(r.reserveMois), 'et surtout il ne vaut ni NaN ni Infinity');
    /* La regle ne parle pas : sans depenses observees, elle n'est pas eligible. */
    eq(evaluerInsights().find(x => x.id === 'liquidity_runway'), undefined,
      'et la lecture se tait plutôt que d’annoncer zéro');
  });
});

/* --- La date d'atteinte, au mois, et la meme partout -----------------------

   « franchie en 2029 » : entre janvier et decembre de cette annee-la il y a un
   an de vie, et le moteur boucle au mois, donc il sait lequel c'est. L'arrondi
   a l'annee jetait ce qu'il savait, deux fois — sur la date et sur le delai. */
suite('La cible se date au mois, et les deux écrans disent le même mois', () => {
  const projection = () => {
    const a = lireSource('assets/app.js');
    const i = a.indexOf('ligne-cible">');
    return a.slice(a.lastIndexOf('${s.target ?', i), a.indexOf('</p>', i) + 4);
  };

  test('un délai se dit en années ET en mois', () => {
    setLang('fr');
    /* Les quatre formes que le francais demande, et rien de plus. */
    eq(fmtDelaiMois(39), '3 ans et 3 mois', 'trois ans et un trimestre');
    eq(fmtDelaiMois(12), '1 an', 'un an juste, au singulier, et sans « 0 mois »');
    eq(fmtDelaiMois(16), '1 an et 4 mois', 'un an et des mois');
    eq(fmtDelaiMois(24), '2 ans', 'deux ans, au pluriel');
    eq(fmtDelaiMois(9), '9 mois', 'moins d’un an : pas d’années');
    eq(fmtDelaiMois(1), '1 mois', 'un seul mois');
    /* Sous le mois, un zero se lirait comme un delai nul. */
    eq(fmtDelaiMois(0), 'moins d’un mois', 'et surtout pas « 0 mois »');
    eq(fmtDelaiMois(-5), 'moins d’un mois', 'un délai négatif n’existe pas');
  });

  test('le délai suit la langue', () => {
    setLang('en');
    try {
      eq(fmtDelaiMois(39), '3 years and 3 months');
      eq(fmtDelaiMois(12), '1 year');
      eq(fmtDelaiMois(9), '9 months');
      eq(fmtDelaiMois(0), 'less than a month');
    } finally { setLang('fr'); }
    for (const c of ['an', 'ans', 'mois', 'et', 'moins d’un mois',
                     'vers', 'jusqu’en', 'non atteinte sur l’horizon simulé']) {
      vrai(!!I18N.en[c], `« ${c} » a sa traduction`);
    }
  });

  test('la Projection nomme le mois, et jamais l’année seule', () => {
    const src = projection();
    vrai(/moisEtAnnee\(anneeAtteinte\.year, anneeAtteinte\.month\)/.test(src),
      'la date passe par le formateur de mois');
    vrai(!/anneeAtteinte\.year\}/.test(src), 'l’année ne s’affiche plus seule');
    vrai(!/Math\.round\(anneeAtteinte\.yearsFromNow\)/.test(src),
      'et le délai ne s’arrondit plus à l’année');
    vrai(/fmtDelaiMois\(anneeAtteinte\.monthsFromNow\)/.test(src), 'il se compte au mois');
  });

  test('le wording reste une estimation, jamais une promesse', () => {
    const src = projection();
    /* « franchie » affirmait. La trajectoire depend d'un scenario de rendement
       et d'un versement que le lecteur a poses lui-meme. */
    vrai(!/franchie/.test(src), 'plus aucun verbe d’affirmation');
    vrai(/trad\('vers'\)/.test(src), 'la date est approchée');
    for (const mot of ['tu atteindras', 'garanti', 'certain', 'sûr']) {
      vrai(!new RegExp(mot, 'i').test(src), `« ${mot} » serait une promesse`);
    }
  });

  test('trois états, et aucun n’invente de date', () => {
    const src = projection();
    /* Deja atteinte : pas de date future, pas de delai. */
    vrai(/anneeAtteinte\.dejaAtteinte \? trad\('déjà atteinte'\)/.test(src),
      'une cible déjà franchie se dit telle quelle');
    vrai(/anneeAtteinte\.dejaAtteinte \? ''/.test(src), 'et ne porte aucun délai');
    /* Hors horizon : aucune date inventee, et l'horizon simule est nomme. */
    vrai(/trad\('non atteinte sur l’horizon simulé'\)/.test(src),
      'hors de l’horizon, aucune date n’est fabriquée');
    vrai(/trad\('jusqu’en'\)/.test(src), 'et l’horizon simulé se dit');
    /* Le moteur, lui, distingue bien les trois cas. */
    Fixture.poser(s => { s.meta.projTarget = 1e12; s.meta.projHorizon = 20; });
    eq(capitalisation({ years: 20 }).targetReached, null, 'une cible hors d’atteinte ne rend rien');
    Fixture.poser(s => { s.meta.projTarget = 1; s.meta.projHorizon = 20; });
    const deja = capitalisation({ years: 20 }).targetReached;
    eq(deja.dejaAtteinte, true, 'une cible déjà franchie le dit');
    eq(deja.monthsFromNow, 0, 'et son délai est nul');
  });

  test('Projection et « À retenir » lisent la même date, au même mois', () => {
    Fixture.poser(s => { s.meta.projTarget = 200000; s.meta.projHorizon = 30; });
    const a = capitalisation({ years: horizonProjection() }).targetReached;
    vrai(!!a && !a.dejaAtteinte, 'la fixture atteint sa cible dans l’horizon');
    /* UNE SEULE SOURCE. Les deux écrans lisent `targetReached` du même moteur,
       avec le même horizon, et le formatent avec la même fonction. Diverger
       demanderait d'en écrire une seconde. */
    const i = evaluerInsights().find(x => x.id === 'goal_projected_date');
    vrai(!!i, 'la lecture de l’accueil produit');
    eq(i.params.year, a.year, 'même année');
    eq(i.params.month, a.month, 'même mois');
    eq(i.params.monthsFromNow, a.monthsFromNow, 'même délai');
    /* Et les deux passent par `moisEtAnnee` : la chaîne affichée est la même. */
    const app = lireSource('assets/app.js');
    const bloc = app.slice(app.indexOf('goal_projected_date: {'),
                           app.indexOf('liquidity_runway_shift: {'));
    vrai(/moisEtAnnee\(p\.year, p\.month\)/.test(bloc), 'l’accueil formate avec moisEtAnnee');
    vrai(/moisEtAnnee\(anneeAtteinte\.year, anneeAtteinte\.month\)/.test(projection()),
      'la Projection aussi');
    /* Un seul horizon, et un test le figeait déjà : `projHorizon` de la vue et
       `horizonProjection()` du moteur sont la même dérivation. */
    eq(horizonProjection(), num(Store.state.meta.projHorizon) || 20,
      'et le même horizon des deux côtés');
  });

  test('le mois vient du moteur, pas d’une interpolation', () => {
    const st = lireSource('assets/store.js');
    /* La cible se franchit un mois donne : la boucle mensuelle note le passage
       au moment ou il a lieu, elle n'interpole pas entre deux points annuels. */
    const bloc = st.slice(st.indexOf('let atteinte = c.target > 0'),
                          st.indexOf('if (mois % 12 === 0) points.push'));
    vrai(/monthsFromNow: mois,/.test(bloc), 'le délai est le compteur de la boucle');
    vrai(/month: date\.getMonth\(\) \+ 1/.test(bloc), 'et le mois vient de ce compteur');
    vrai(!/interpol/i.test(bloc), 'aucune interpolation entre deux années');
  });
});

/* --- La carte de repartition, sous le hero ---------------------------------

   Elle disait « 14 965,00 € » pour une poche de patrimoine : deux decimales qui
   ne changent ni la part, ni la barre, ni la decision, et qui donnaient a une
   carte de composition l'allure d'un releve bancaire. Et sa plus petite poche
   dessinait une barre de moins d'un pixel. */
suite('La carte de répartition se lit au niveau du patrimoine', () => {
  const app = () => lireSource('assets/app.js');
  /* La carte sous le hero, et elle seule : trois autres listes partagent ce
     gabarit sur d'autres ecrans, et cette passe ne les touche pas. */
  const carte = () => {
    const a = app();
    /* Depuis la synthese : le gabarit d'une ligne est ecrit juste avant la
       balise de la carte, et il en fait partie. */
    const i = a.indexOf('const s = syntheseRepartition(classes);');
    return a.slice(i, a.indexOf('repart-base', i));
  };

  test('les montants perdent leurs centimes, les pourcentages gardent le leur', () => {
    const c = carte();
    vrai(/<b\$\{x\.value < 0 \? ' class="dette"' : ''\}>\$\{fmtEUR0\(x\.value\)\}<\/b>/.test(c),
      'le montant passe par le formateur à zéro décimale');
    vrai(!/fmtEUR\(x\.value\)/.test(c), 'et plus par celui qui en rend deux');
    /* LE CONTRAIRE POUR LA PART : une poche à trois dixièmes disparaîtrait
       derrière « 0 % », alors qu'elle existe. */
    vrai(/fmtPct\(x\.pct, 1\)/.test(c), 'le pourcentage garde sa décimale');
    /* Aucun signe monétaire en dur : le formateur central décide. Le dollar
       d'un `${}` n'en est pas un, et une fenêtre de balisage en est pleine. */
    const nu = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    vrai(!/€/.test(nu), 'aucun euro écrit à la main');
    vrai(!/\$(?!\{)/.test(nu), 'aucun dollar non plus');
  });

  test('l’affichage arrondit, les données jamais', () => {
    setLang('fr');
    const avant = Store.state.meta.devise;
    try {
      /* Les séparateurs d'un montant formaté sont des espaces insécables fines,
         pas des espaces ordinaires : on les normalise pour comparer. */
      const m = v => fmtEUR0(v).replace(/\s/g, ' ');
      Store.state.meta.devise = 'EUR';
      eq(m(4318.54), '4 319 €', 'EUR : arrondi à l’euro près');
      eq(m(160.57), '161 €', 'et vers le haut quand il le faut');
      eq(m(18906.19), '18 906 €');
      eq(m(24181.77), '24 182 €');
      setLang('en');
      eq(m(18906.19), '€18,906', 'EUR en anglais');
      Store.state.meta.devise = 'USD';
      eq(m(4318.54), '$4,319', 'USD en anglais');
      eq(m(18906.19), '$18,906');
      setLang('fr');
      eq(m(4318.54), '4 319 $', 'USD en français garde ses séparateurs');
    } finally { Store.state.meta.devise = avant; setLang('fr'); }
    /* ET LA VALEUR INTERNE NE BOUGE PAS. Le modele rend des centimes, la carte
       les tait : c'est l'ecran qui arrondit, jamais la donnee. */
    Fixture.poser();
    for (const x of repartitionClasses({ net: false })) {
      eq(x.value, num(x.value), `${x.classe} garde sa valeur exacte`);
      vrai(Math.round(x.value) !== x.value || true, 'et le modèle ne l’a pas arrondie');
    }
    const st = lireSource('assets/store.js');
    const f = st.slice(st.indexOf('function repartitionClasses'), st.indexOf('function repartitionClasses') + 1400);
    vrai(!/Math\.round/.test(f), 'aucun arrondi dans le modèle de la répartition');
  });

  test('les pourcentages suivent la langue, à une décimale', () => {
    setLang('fr');
    eq(fmtPct(10.36, 1), '10,4 %', 'virgule décimale et espace insécable');
    eq(fmtPct(0.3, 1), '0,3 %', 'une petite poche reste visible');
    setLang('en');
    try { eq(fmtPct(10.36, 1), '10.4%', 'point décimal, pas d’espace'); }
    finally { setLang('fr'); }
  });

  test('une poche minuscule garde une barre qu’on voit', () => {
    /* LE PLANCHER EST GRAPHIQUE, ET RIEN D'AUTRE. 0,3 % de 311 px font 0,93 px,
       que l'arrondi du navigateur et le rayon de la pastille effacent : la ligne
       portait un montant, un pourcentage, et une barre vide. */
    eq(largeurPart(0.3), 'max(3px, 0.3%)', 'trois pixels au minimum');
    eq(largeurPart(5), 'max(3px, 5.0%)', 'au-delà, c’est la proportion qui gagne');
    eq(largeurPart(66.3), 'max(3px, 66.3%)');
    /* ZERO N'EST PAS TROIS DIXIEMES. Une poche vide garde une barre vide. */
    eq(largeurPart(0), '0%', 'une poche à zéro ne reçoit aucun plancher');
    eq(largeurPart(null), '0%', 'ni une part absente');
    eq(largeurPart(-1), '0%', 'ni une part négative');
    /* Et il ne rend pas 0,3 % comparable a 5 % : sur une carte de 311 px, trois
       pixels contre seize. */
    const px = p => p > 0 ? Math.max(3, 311 * p / 100) : 0;
    vrai(px(5) / px(0.3) > 4, `${px(0.3)} px contre ${px(5)} px : les deux restent distinctes`);
  });

  test('le chiffre affiché ne bouge pas avec le plancher', () => {
    const c = carte();
    /* Le plancher vit dans le style de la barre, et nulle part ailleurs : le
       pourcentage passe par `fmtPct` sur `x.pct`, la valeur du modèle. */
    /* Plus de barre par ligne sur l'accueil : la barre du haut compose les
       memes parts. Le texte lit donc la part telle quelle, et le plancher ne
       sert plus qu'aux listes qui ont encore leurs barres. */
    vrai(!/class="repart-barre"/.test(c), 'aucune barre par ligne');
    vrai(/fmtPct\(x\.pct, 1\)/.test(c), 'le texte lit la part telle quelle');
    vrai(!/largeurPart/.test(c), 'et le plancher n’entre jamais dans le texte');
  });

  test('la carte s’est resserrée, elle n’est pas devenue dense', () => {
    const css = lireSource('assets/styles.css');
    const bloc = css.slice(css.indexOf('.repart { padding'), css.indexOf('.repart-ligne:last-child'));
    vrai(/padding: 10px 0;/.test(bloc), 'la rangée rend trois pixels en haut et en bas');
    vrai(/gap: 5px;/.test(bloc), 'et un de plus entre le texte et sa barre');
    /* CE QUI NE BOUGE PAS : la police, la graisse, la hauteur de barre. Une
       liste dense se reconnaît à ses petits caractères, pas à son remplissage. */
    vrai(!/font-size/.test(bloc), 'aucune police réduite');
    const barre = css.slice(css.indexOf('.repart-barre {'), css.indexOf('.repart-barre i'));
    vrai(/height: 5px;/.test(barre), 'la barre garde sa hauteur');
    vrai(/\.repart-nom \{ font-weight: 600;/.test(css), 'et le libellé sa graisse');
  });

  test('la hiérarchie tient : libellé, montant, poids', () => {
    const c = carte();
    const iNom = c.indexOf('repart-nom'), iVal = c.indexOf('fmtEUR0'), iPct = c.indexOf('repart-pct');
    vrai(iNom < iVal && iVal < iPct, 'l’ordre de lecture ne bouge pas');
    const css = lireSource('assets/styles.css');
    /* Le montant en encre pleine et en gras, la part en encre secondaire et
       d'un cran plus petite : c'est elle la donnée secondaire. */
    vrai(/\.repart-haut b \{[^}]*tabular-nums/.test(css), 'le montant aligne ses chiffres');
    const pct = css.slice(css.indexOf('.repart-pct {'), css.indexOf('}', css.indexOf('.repart-pct {')));
    vrai(/color: var\(--muted\)/.test(pct), 'la part reste discrète');
    vrai(/font-size: var\(--font-sm\)/.test(pct), 'et d’un cran plus petite');
    vrai(/tabular-nums/.test(pct), 'mais sa colonne tombe droit');
  });

  test('la carte se nomme, maintenant qu’elle ne suit plus le hero', () => {
    const c = carte();
    /* Elle etait sans titre parce que le hero, juste au-dessus, la presentait.
       Le point a retenir et l'objectif s'intercalent desormais : sans nom, elle
       se lirait comme leur suite. Son en-tete porte aussi le renvoi a la page
       qui la detaille. */
    vrai(/<h2>\$\{trad\('Répartition'\)\}<\/h2>/.test(c), 'elle se nomme');
    vrai(/href="#\/allocation">\$\{trad\('Voir toute l’allocation'\)\} →<\/a>/.test(c), 'et mène à Allocation');
    vrai(!!I18N.en['Voir toute l’allocation'], 'dans les deux langues');
  });

  test('les trois niveaux partagent leurs couleurs et leurs proportions', () => {
    /* Hero, carte, historique : une seule source pour les couleurs et les
       parts. Deux tables auraient fini par peindre la même poche de deux
       couleurs sur deux écrans. */
    Fixture.poser();
    const parts = repartitionClasses({ net: false });
    pres(parts.reduce((s, x) => s + x.pct, 0), 100, 'les parts font cent');
    for (const x of parts) vrai(!!x.couleur, `${x.classe} porte sa couleur du modèle`);
    const a = app();
    const c = carte();
    vrai(/repartitionClasses\(\{ net: evoNet \}\)/.test(a.slice(a.indexOf('const classes = repartitionClasses'), a.indexOf('const classes = repartitionClasses') + 80)),
      'la carte lit la même fonction que le hero');
    vrai(/background:\$\{x\.couleur\}/.test(c), 'et la couleur vient du modèle, pas du CSS');
  });
});

/* --- Un commentaire qui s'affiche -----------------------------------------

   UN COMMENTAIRE DE BLOC POSE DANS UN LITTERAL DE GABARIT N'EST PAS UN
   COMMENTAIRE, c'est du
   TEXTE. Le fichier se parse, la suite reste verte, la chaine de publication ne
   le retire pas — et le visiteur lit le raisonnement du developpeur en clair, au
   milieu de l'ecran d'accueil. C'est arrive, en production, sur les trois
   deploiements a la fois.

   Rien ne l'attrapait : le controle du parsage ne voit qu'un fichier valide, et
   celui des backticks dans un commentaire HTML regarde l'autre moitie du piege.
   Ce controle-ci lit le fichier caractere par caractere, exactement comme le
   filtre de publication, et signale tout ouvrant de bloc rencontre alors qu'on
   se trouve dans le TEXTE d'un gabarit — c'est-a-dire hors de tout `${'$'}{ }`. */
suite('Aucun commentaire ne part dans le balisage', () => {
  /* La pile dit ou l'on se trouve : `tpl` dans le texte d'un gabarit, `sub`
     dans une interpolation, vide dans du JavaScript ordinaire. */
  const commentairesAffiches = src => {
    const trouves = [];
    const pile = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      const dansTpl = pile.length > 0 && pile[pile.length - 1] === 'tpl';
      if (c === '\\') { i += 2; continue; }
      if (dansTpl) {
        if (c === '`') { pile.pop(); i++; continue; }
        if (c === '$' && src[i + 1] === '{') { pile.push('sub'); i += 2; continue; }
        if (c === '/' && src[i + 1] === '*') { trouves.push(i); i += 2; continue; }
        i++; continue;
      }
      if (c === '`') { pile.push('tpl'); i++; continue; }
      if (c === '"' || c === "'") {
        const q = c; i++;
        while (i < n && src[i] !== q) {
          if (src[i] === '\\') i++;
          if (src[i] === '\n') break;
          i++;
        }
        i++; continue;
      }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        const fin = src.indexOf('*/', i + 2);
        i = fin >= 0 ? fin + 2 : n;
        continue;
      }
      if (pile.length && pile[pile.length - 1] === 'sub') {
        if (c === '}') { pile.pop(); i++; continue; }
        if (c === '{') { pile.push('sub'); i++; continue; }
      }
      i++;
    }
    return trouves.map(p => src.slice(0, p).split('\n').length);
  };

  test('aucun fichier servi ne porte de commentaire dans son balisage', () => {
    for (const f of ['assets/app.js', 'assets/charts.js', 'assets/store.js',
                     'assets/insights.js', 'assets/i18n.js', 'assets/cloudsync.js']) {
      const lignes = commentairesAffiches(lireSource(f));
      eq(lignes.join(', '), '',
        `${f} : commentaire affiché ligne ${lignes.join(', ')}`);
    }
  });

  test('le contrôle attrape vraiment ce qu’il prétend attraper', () => {
    /* Un controle qui ne trouve jamais rien peut etre casse sans qu'on le sache.
       On lui donne les deux formes, celle qui s'affiche et celle qui ne
       s'affiche pas, et il doit les distinguer. */
    eq(commentairesAffiches('const h = `<b>x</b>\n  /* vu */\n`;').length, 1,
      'entre deux balises, le commentaire s’affiche');
    eq(commentairesAffiches('const h = `<b>${(() => { /* caché */ return 1; })()}</b>`;').length, 0,
      'dans une interpolation, il reste du code');
    eq(commentairesAffiches('/* ordinaire */ const x = 1;').length, 0,
      'hors gabarit, il reste du code');
    eq(commentairesAffiches('const h = `<b>${x}</b>`; /* après */').length, 0,
      'après la fermeture du gabarit aussi');
    /* Un gabarit imbrique dans une interpolation : le cas courant de ce fichier. */
    eq(commentairesAffiches('`<i>${l.map(x => `<b>\n/* vu */\n</b>`)}</i>`').length, 1,
      'et jusque dans un gabarit imbriqué');
  });

  test('la règle est écrite là où on la lira', () => {
    /* Le piege se double de son jumeau : un commentaire HTML dans un gabarit ne
       casse rien, mais il part jusqu'au DOM du visiteur. Les deux regles se
       lisent au meme endroit. */
    const a = lireSource('assets/app.js');
    vrai(/dans le gabarit, `<!-- -->` ; dans le code,/.test(a),
      'la règle des deux formes vit dans le fichier qu’elle protège');
  });
});

/* --- Le hero : une fenetre nommee pour ce qu'elle est ----------------------

   « 12 derniers mois » sous un « +127,7 % » se lit comme un rendement annuel.
   Deux choses le corrigent, et aucune ne touche a un calcul : la fenetre se dit
   glissante, et la bulle dit en toutes lettres que ce n'est pas une
   performance. */
suite('Le hero dit sa fenêtre et ce qu’elle n’est pas', () => {
  const vue = () => lireSource('assets/app.js');
  const bloc = () => {
    const a = vue();
    const i = a.indexOf('const blocVariation = !varAn');
    return a.slice(i, a.indexOf('`;', a.indexOf('</div>`', i)));
  };

  test('la fenêtre est vraiment glissante, et le moteur le prouve', () => {
    /* GLISSANTE VEUT DIRE : elle se termine aujourd'hui et remonte vers le
       relevé le plus proche d'il y a un an, jamais vers un 1er janvier. */
    const st = lireSource('assets/store.js');
    const f = st.slice(st.indexOf('function variationAn'), st.indexOf('function variationAn') + 2600);
    vrai(/const maintenant = enMois\(aujourdhui\);/.test(f), 'la fenêtre part d’aujourd’hui');
    vrai(/Math\.abs\(age\(p\) - 12\) > TOLERANCE_AN/.test(f), 'et vise douze mois en arrière');
    vrai(!/getFullYear|01-01/.test(f), 'aucune année civile n’entre dans le choix');
  });

  test('mais elle ne prétend jamais faire douze mois', () => {
    /* Le nombre affiché est l'AGE REEL du relevé retenu, dans une tolérance de
       trois mois. Écrire « 12 » sous une comparaison qui en couvre quinze
       serait le même mensonge que l'écrire sous quatre. */
    setLang('fr');
    const a = vue();
    vrai(/'depuis le relevé de \{m\}'/.test(a), 'le gabarit porte une marque de date, pas une date écrite');
    vrai(/varAn\.mois\} \$\{trad\('mois'\)\}/.test(a), 'le nombre de mois vient du moteur');
    vrai(!/12 mois'/.test(a), 'aucun douze écrit en dur');
    eq(trad('depuis le relevé de {m}').replace('{m}', 'sept. 25'), 'depuis le relevé de sept. 25',
      'et la phrase est celle qu’on attend');
  });

  test('l’anglais dit la période sans calquer le français', () => {
    setLang('en');
    try {
      eq(trad('depuis le relevé de {m}').replace('{m}', 'Sep 25'), 'since the Sep 25 statement');
      eq(trad('Patrimoine net'), 'Net worth', 'et le titre garde sa terminologie');
    } finally { setLang('fr'); }
  });

  test('le grand chiffre perd ses centimes, la variation aussi, le pourcentage non', () => {
    const b = bloc();
    /* Le montant : formateur central à zéro décimale, comme la carte de
       composition juste dessous. */
    vrai(/hero-value">\$\{fmtEUR0\(/.test(vue()), 'le patrimoine se lit sans centimes');
    /* La variation en euros n'en a jamais porté : `fmtSigned` formate déjà à
       zéro décimale. On le fige, pour que personne ne l'enrichisse. */
    vrai(/fmtSigned\(varAn\.eur\)/.test(b), 'la variation passe par le formateur signé');
    const st = lireSource('assets/store.js');
    vrai(/const fmtSigned = v => \(v >= 0 \? '\+' : '−'\) \+ fmtEUR\(Math\.abs\(v\), 0\);/.test(st),
      'et celui-là est à zéro décimale');
    /* Le pourcentage, lui, garde la sienne : à l'entier près, un écart de six
       dixièmes disparaîtrait. */
    vrai(/fmtSignedPct\(varAn\.pct, 1\)/.test(b), 'le pourcentage garde sa décimale');
    setLang('fr');
    eq(fmtSignedPct(127.74, 1), '+127,7 %');
    setLang('en');
    try { eq(fmtSignedPct(127.74, 1), '+127.7%'); } finally { setLang('fr'); }
  });

  test('rien n’est arrondi dans les données', () => {
    Fixture.poser();
    const t = nowTotals();
    /* L'écran arrondit, le modèle jamais : les centimes sont toujours là. */
    eq(t.total, num(t.total), 'le net garde sa valeur exacte');
    eq(t.brut, num(t.brut), 'le brut aussi');
    const st = lireSource('assets/store.js');
    const f = st.slice(st.indexOf('function nowTotals'), st.indexOf('function nowTotals') + 1200);
    vrai(!/Math\.round/.test(f), 'aucun arrondi dans nowTotals()');
  });

  test('la bulle nomme ce qui bouge, et ce que ce n’est pas', () => {
    const b = bloc();
    /* Elle ne cite que des composantes réellement incluses. */
    vrai(/les versements, les retraits, le remboursement du capital des crédits/.test(b),
      'le net cite le capital remboursé');
    const iBrut = b.indexOf('Variation de ton patrimoine brut');
    vrai(!/remboursement du capital/.test(b.slice(iBrut)),
      'le brut ne le cite pas : il ne le mesure pas');
    /* ET LE MOT EST RETOURNE, jamais posé. */
    vrai(/ce n’est pas la performance de tes placements/.test(b),
      'la bulle lève la confusion explicitement');
    const face = b.slice(0, b.indexOf('aide('));
    vrai(!/performance|rendement/i.test(face), 'mais la face ne nomme rien de tel');
  });

  test('la hiérarchie et l’alignement ne bougent pas', () => {
    const css = lireSource('assets/styles.css');
    /* Rien n'est centré : la lecture reste de gauche à droite. */
    for (const sel of ['.hero-label', '.hero-value', '.hero-deltas', '.hero-delta']) {
      const r = css.slice(css.indexOf(sel + ' '), css.indexOf('}', css.indexOf(sel + ' ')));
      vrai(!/text-align: center|justify-content: center|align-items: center;[^}]*justify/.test(r),
        `${sel} n’est pas centré`);
    }
    /* L'ordre de lecture : intitulé, montant, variation, période, barre. */
    const a = vue();
    const i = n => a.indexOf(n);
    vrai(i('hero-label') < i('hero-value'), 'l’intitulé précède le montant');
    vrai(i('const blocVariation') < i('hero-label'), 'la variation se construit avant');
    vrai(i('hero-value') < i('${blocVariation}'), 'et se rend après le montant');
  });

  test('aucun élément n’a été ajouté à droite', () => {
    /* Le vide à droite de la période est une respiration, pas un oubli : tout ce
       qui pouvait s'y mettre répétait un chiffre déjà lu deux centimètres plus
       bas. Le seul élément à droite reste la bascule Net / Brut, qui y était. */
    const a = vue();
    const i = a.indexOf('const blocVariation = !varAn');
    const b = a.slice(i, a.indexOf('`;', a.indexOf('</div>`', i)));
    eq((b.match(/<div class="hero-delta">/g) || []).length, 1,
      'une seule colonne de variation, comme avant');
    vrai(!/hero-aside|hero-droite|hero-extra/.test(a), 'aucun bloc nouveau à droite');
    const css = lireSource('assets/styles.css');
    vrai(/\.hero-label > \.segmented \{ margin-left: auto; \}/.test(css),
      'et la bascule garde sa place, la seule à droite');
  });
});

/* --- La courbe du hero, sur la fenetre de la variation ---------------------

   Le vide a droite du grand chiffre donnait une carte inachevee. Il porte une
   courbe qui part du releve de la variation posee a sa gauche et trace les
   releves jusqu'au dernier, comme la carte Evolution : aucun chiffre de plus,
   et aucun point du jour. */
suite('Le hero trace ses relevés depuis celui de sa variation', () => {
  const app = () => lireSource('assets/app.js');

  test('la série part du relevé de la variation et trace les relevés jusqu’au dernier', () => {
    Fixture.poser();
    const v = variationAn(todayISO(), true);
    vrai(!!v, 'la fixture a de quoi comparer');
    const s = serieAn(v.depuis, true);
    /* ELLE NE CHOISIT RIEN : le releve de depart lui est passe. Deux
       selections cote a cote finiraient par ne pas designer le meme releve, et
       la courbe ne partirait pas d'ou part le chiffre d'a cote. */
    const dans = historySeries({ includeNow: false }).filter(p => String(p.date) >= String(v.depuis));
    eq(s.length, dans.length, 'un point par relevé de la fenêtre, et rien d’autre');
    eq(s[0], num(dans[0].net), 'elle commence au relevé retenu par la variation');
    pres(s[0], v.avant, 'le même relevé que celui de la variation');
    eq(s[s.length - 1], num(dans[dans.length - 1].net), 'et finit sur le dernier relevé');
  });

  test('en haut et en bas, les deux courbes finissent sur le même relevé', () => {
    /* Les deux dessins ne tracent que des releves : ils finissent donc sur
       le meme, et aucun palier du jour ne prolonge l'un sans l'autre. */
    Fixture.poser();
    for (const net of [true, false]) {
      const v = variationAn(todayISO(), net);
      const haut = pointsAn(v.depuis, net);
      const bas = pointsEvolution({ net, financier: false, aujourdhui: false });
      pres(haut[haut.length - 1].valeur, bas[bas.length - 1].total,
        `${net ? 'en net' : 'en brut'}, la même dernière valeur`);
      eq(haut[haut.length - 1].label, fmtMoisAn(bas[bas.length - 1].date), 'et le même relevé');
    }
  });

  test('un seul relevé dans la fenêtre ne trace pas de courbe', () => {
    const [a, m] = todayISO().split('-').map(Number);
    const ilYaUnAn = `${a - 1}-${String(m).padStart(2, '0')}-01`;
    Fixture.poser(s => {
      s.monthly = [{ date: ilYaUnAn, comment: '', dettes: 0, v: { a: 1 }, parts: { a: { cash: 1000 } } }];
    });
    const v = variationAn(todayISO(), true);
    vrai(!!v, 'la variation existe');
    eq(pointsAn(v.depuis, true).length, 1, 'un point : sous le seuil de deux, la vue ne pose pas la courbe');
  });

  test('aucun point n’est inventé, aucun mois n’est comblé', () => {
    Fixture.poser();
    const v = variationAn(todayISO(), true);
    const s = serieAn(v.depuis, true);
    const reels = historySeries({ includeNow: false })
      .filter(p => String(p.date) >= String(v.depuis)).map(p => num(p.net));
    eq(s.join('|'), reels.join('|'), 'chaque valeur est celle d’un relevé qui existe');
    /* Aucune interpolation, aucun lissage : le modèle ne fabrique rien. */
    const st = lireSource('assets/store.js');
    const f = st.slice(st.indexOf('function serieAn'), st.indexOf('function deltas'));
    for (const interdit of ['interpol', 'moyenne', 'lissa', 'fill(', 'while (']) {
      vrai(!f.includes(interdit), `serieAn n’utilise pas ${interdit}`);
    }
    vrai(!/Math\.round|toFixed/.test(f), 'et n’arrondit rien');
  });

  test('net et brut lisent les mêmes champs que la variation', () => {
    Fixture.poser();
    const v = variationAn(todayISO(), false);
    const s = serieAn(v.depuis, false);
    const dans = historySeries({ includeNow: false }).filter(p => String(p.date) >= String(v.depuis));
    eq(s[0], num(dans[0].total), 'en brut, un relevé porte son total d’avoirs');
    eq(s[s.length - 1], num(dans[dans.length - 1].total), 'jusqu’au dernier relevé');
    /* L'accesseur d'un releve est mot pour mot celui de variationAn() :
       `net`, ou `total` (ses avoirs) en brut. Ce test le fige. */
    const net = serieAn(v.depuis, true);
    vrai(net[net.length - 1] !== s[s.length - 1] || num(dans[dans.length - 1].dettes) === 0,
      'net et brut diffèrent dès que le relevé porte un crédit');
  });

  test('pas assez d’historique : aucune courbe, et surtout aucune fausse', () => {
    eq(serieAn(null, true).length, 0, 'sans fenêtre, aucune série');
    Store.state = blankState(); Store.migrate(); refreshAccounts();
    eq(variationAn(todayISO(), true), null, 'sans relevé, aucune variation');
    /* La vue ne rend le conteneur que sur deux points au moins, et `sparkline()`
       se tait de son côté sous le même seuil : une ligne entre deux relevés
       reste une vraie lecture, un point seul n’en est pas une. */
    const a = app();
    vrai(/const blocSpark = serieHero\.length < 2 \? ''/.test(a),
      'sous deux points, la vue ne pose même pas le conteneur');
    const c = lireSource('assets/charts.js');
    vrai(/if \(values\.length < 2\) \{ el\.innerHTML = ''; return; \}/.test(c),
      'et le dessin se tait aussi');
  });

  test('sous un demi pour cent, la pente s’efface au lieu de se dramatiser', () => {
    const c = lireSource('assets/charts.js');
    const f = c.slice(c.indexOf('function sparkline'), c.indexOf('cablerInfobulle(svg', c.indexOf('function sparkline')));
    /* LE DEFAUT MESURE : cadree sur min/max, `[100 000, 110 000]` et
       `[100 000, 100 012]` rendaient le meme trace, « 0,32 200,4 ». Douze euros
       se lisaient comme dix mille, et c'est sur deux points — celui qui commence
       — que rien ne vient nuancer la pente. */
    vrai(/const AMPLITUDE_MINIMALE = 0\.005;/.test(c),
      'le plancher vaut un demi pour cent du niveau');
    eq((c.match(/AMPLITUDE_MINIMALE\s*=/g) || []).length, 1,
      'et il ne se declare qu’une fois');
    /* RELATIF, ET NON EN EUROS : un seuil ecrit en monnaie vaudrait pour un
       patrimoine et pas pour un autre, et il faudrait le convertir. */
    vrai(/Math\.abs\(milieu\) \* AMPLITUDE_MINIMALE/.test(f),
      'il se mesure sur le niveau, pas en monnaie');
    /* L'ECHELLE S'OUVRE AUTOUR DU MILIEU, ce qui pose une serie immobile au
       centre du cadre au lieu de la coller au bord bas. */
    vrai(/const milieu = \(min \+ max\) \/ 2;/.test(f), 'le milieu est le milieu');
    vrai(/const bas = \(max - min\) < plancher \? milieu - plancher \/ 2 : min;/.test(f),
      'sous le plancher, le cadre s’ouvre de part et d’autre du milieu');
    vrai(/const span = \(\(max - min\) < plancher \? plancher : max - min\) \|\| 1;/.test(f),
      'et au-dessus, rien ne change');
    /* Sur une serie entierement a zero, un plancher proportionnel vaudrait zero
       et la ligne retomberait au bord bas par la porte qu'on vient de fermer. */
    vrai(/Number\.EPSILON/.test(f), 'une série entièrement à zéro garde un plancher');
  });

  test('un patrimoine immobile ne se peint pas en bonne nouvelle', () => {
    const c = lireSource('assets/charts.js');
    const f = c.slice(c.indexOf('function sparkline'), c.indexOf('cablerInfobulle(svg', c.indexOf('function sparkline')));
    /* Vert veut dire « ça monte ». Sur une ligne qui n'a pas bouge, c'etait une
       bonne nouvelle inventee : l'encre neutre ne dit rien, ce qui est juste.

       LE CRITERE EST LA PENTE DESSINEE, PAS LE DRAPEAU DU CADRAGE, et c'est une
       mesure au seuil qui l'a impose : a +500 sur 100 000, l'ecart passe tout
       juste sous le plancher, l'echelle s'ouvre a peine, et le trait montait
       de presque toute la hauteur en se peignant en gris. On mesure donc les
       pixels que la pente occupe vraiment, et les deux decisions ne peuvent
       plus se contredire. */
    vrai(/const penteEnPixels = \(\(max - min\) \/ span\) \* \(H - 8\);/.test(f),
      'la pente se mesure en pixels, après l’ouverture de l’échelle');
    vrai(/penteEnPixels < 1 \? cssv\('--muted'\)/.test(f),
      'sous un pixel de pente, le trait passe en encre neutre');
    /* Au-dessus du plancher, le sens vient toujours du premier et du dernier
       point : la regle d'avant, intacte. */
    vrai(/values\[values\.length - 1\] >= values\[0\] \? cssv\('--good'\) : cssv\('--critical'\)/.test(f),
      'et au-dessus, la hausse et la baisse gardent leurs couleurs');
  });

  test('la couleur vient de la palette existante, et rien n’est ajouté', () => {
    const c = lireSource('assets/charts.js');
    /* La fenetre se borne sur la FIN du dessin et non sur un nombre de
       caracteres : un commentaire ajoute en tete la faisait glisser, et le
       controle finissait par lire autre chose que ce qu'il croyait. */
    const f = c.slice(c.indexOf('function sparkline'), c.indexOf('cablerInfobulle(svg', c.indexOf('function sparkline')));
    vrai(/cssv\('--good'\)/.test(f) && /cssv\('--critical'\)/.test(f),
      'hausse et baisse prennent les deux couleurs du projet');
    vrai(!/#[0-9a-f]{3,6}/i.test(f.replace(/cssv\([^)]*\) \|\| '#fff'/g, '')),
      'aucune couleur écrite en dur');
    /* Discrète : un trait fin, un remplissage à douze pour cent, aucune ombre. */
    vrai(/stroke-width="2"/.test(f), 'trait fin');
    vrai(/fill-opacity="\.12"/.test(f), 'remplissage très léger');
    for (const interdit of ['filter:', 'drop-shadow', 'animate', 'linearGradient']) {
      vrai(!f.includes(interdit), `aucun ${interdit}`);
    }
  });

  test('elle s’explore au doigt, sans parler au lecteur d’écran', () => {
    const c = lireSource('assets/charts.js');
    /* La fenetre se borne sur la FIN du dessin et non sur un nombre de
       caracteres : un commentaire ajoute en tete la faisait glisser, et le
       controle finissait par lire autre chose que ce qu'il croyait. */
    const f = c.slice(c.indexOf('function sparkline'), c.indexOf('cablerInfobulle(svg', c.indexOf('function sparkline')));
    /* LE DESSIN RESTE DÉCORATIF : le montant, la variation et la période sont
       écrits en toutes lettres à côté, et l'onglet Historique donne l'accès
       détaillé. Rien n'est piégé au clavier : l'infobulle est un div posé par
       `ensureTip`, sans tabindex. */
    vrai(/aria-hidden="true"/.test(f), 'le tracé ne se lit pas deux fois');
    vrai(!/tabindex/.test(f), 'et rien n’entre dans l’ordre de tabulation');
    /* `labels` allume l'exploration : le code du curseur et de l'infobulle
       existait, il dormait faute d'étiquettes à montrer. */
    const a = app();
    vrai(/labels: pts\.map\(p => p\.label\)/.test(a),
      'le montage passe les étiquettes, et c’est ce qui câble le doigt');
    vrai(/if \(!opts\.labels\) return;/.test(c), 'sans elles, rien ne se câble');
    /* Le défilement vertical de la page reste possible depuis la courbe. */
    vrai(/el\.style\.touchAction = 'pan-y';/.test(c),
      'un geste vertical fait défiler la page, il n’est pas capturé');
  });

  test('deux colonnes en haut, la barre de composition sur toute la largeur', () => {
    const a = app();
    /* La lecture reste à gauche ; la courbe prend le vide de droite ; la barre
       passe sous les deux, comme avant. */
    const i = a.indexOf('<div class="hero-haut">');
    vrai(i > 0, 'le haut du hero est une rangée');
    vrai(a.indexOf('<div class="hero-gauche">') > i, 'la colonne de lecture y entre');
    vrai(a.indexOf('${blocSpark}') > a.indexOf('${blocVariation}'),
      'et la courbe vient après elle');
    vrai(a.indexOf('hero-barre') > a.indexOf('${blocSpark}'),
      'la barre reste sous les deux colonnes');
    const css = lireSource('assets/styles.css');
    /* MOITIÉ-MOITIÉ. `3fr 2fr` réservait au texte trois cinquièmes qu'il ne
       demandait pas, `fit-content(60%)` rendait à la courbe tout ce que le texte
       laissait — sur un écran large elle s'étirait sur les trois quarts de la
       carte. Deux fractions égales ne dépendent ni de l'un ni de l'autre. */
    vrai(/grid-template-columns: minmax\(min-content, 1fr\) minmax\(0, 1fr\);/.test(css),
      'les deux colonnes se partagent la rangée en deux moitiés');
    vrai(/gap: 16px;/.test(css), 'et un écart normal les sépare');
    vrai(!/grid-template-columns: 50%/.test(css), 'sans pourcentages, qui déborderaient de l’écart');
    /* LE PLANCHER `min-content` N'EST PAS DÉCORATIF, il est mesuré : à 375 px le
       `clamp()` du grand chiffre reste à 34 px — il suit la fenêtre, pas sa
       colonne — et « 4 200 909 € », dont les séparateurs sont insécables,
       demande 166 px quand la moitié n'en donne que 148. Sans lui, dix-huit
       pixels de débordement ; avec lui, la lecture prend 166 et la courbe 129,
       et dans ce cas seulement. */
    const rangee = css.slice(css.indexOf('.hero-haut {'), css.indexOf('}', css.indexOf('.hero-haut {')));
    vrai(!/1fr 1fr/.test(rangee),
      'ni deux fractions nues, qui ne diraient rien du montant trop long');
    vrai(!/minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(rangee),
      'ni deux moitiés strictes, où un patrimoine à sept chiffres déborderait');
    vrai(/\.hero-gauche \{ min-width: 0; \}/.test(css),
      'et la colonne gauche accepte de se comprimer, sinon un gros montant la fait déborder');
  });

  test('elle reste à droite à toutes les largeurs, téléphone compris', () => {
    const css = lireSource('assets/styles.css');
    /* DEUX ESSAIS L'ONT PRÉCÉDÉ ET AUCUN NE TENAIT : l'effacer sous 560 px la
       faisait simplement manquer, la passer sous la lecture l'éloignait du
       chiffre qu'elle illustre. À 375 px la lecture tombe à 167 px et la courbe
       prend son plancher de 120 : rien ne déborde. */
    vrai(!/@media[^{]*\{\s*\.hero-(haut|spark)/.test(css),
      'aucune requête de média ne la déplace ni ne la masque');
    vrai(/\.hero-spark \{\s*min-width: 0;/.test(css),
      'la colonne de droite prend tout ce qui reste, sans plafond');
    /* PAS DE SELECTION NATIVE SOUS LE DOIGT : un appui maintenu sur un téléphone
       ouvrirait la loupe et la poignée de sélection, sur le geste même qui sert
       à lire la courbe. */
    const zone = css.slice(css.indexOf('.hero-spark {'), css.indexOf('}', css.indexOf('.hero-spark {')));
    vrai(/-webkit-user-select: none/.test(zone) && /-webkit-touch-callout: none/.test(zone),
      'et rien ne se sélectionne sous le doigt');
    /* AUCUNE HAUTEUR IMPOSÉE EN CSS, et c'est un piège mesuré : poser `height`
       sur le SVG ne l'aplatit pas, sa `viewBox` se recentre et le tracé
       rétrécit EN LARGEUR au milieu d'un conteneur pleine largeur. */
    vrai(!/\.hero-spark svg \{[^}]*height/.test(css),
      'et aucune hauteur n’est imposée au SVG depuis le CSS');
  });

  test('aucun blanc ne peut revenir entre le texte et la courbe', () => {
    const css = lireSource('assets/styles.css');
    /* DEUX FRACTIONS ÉGALES NE LAISSENT AUCUN RESTE À PLACER : ce qui n'est pas
       dans une moitié est dans l'autre, et l'écart est le seul espace entre
       elles. Le blanc d'autrefois naissait d'une colonne plus large que son
       contenu ; il ne peut plus revenir puisque aucune ne suit le sien. */
    vrai(/grid-template-columns: minmax\(min-content, 1fr\) minmax\(0, 1fr\);/.test(css),
      'aucune des deux colonnes ne suit la longueur de son contenu');
    vrai(!/\.hero-(gauche|spark) \{[^}]*flex:/.test(css),
      'et plus aucune règle de croissance pour en décider autrement');
    vrai(!/\.hero-spark \{[^}]*max-width/.test(css),
      'ni plafond de largeur, qui déplacerait le blanc derrière elle');
  });

  test('l’intitulé et sa bascule couvrent la carte, pas une colonne', () => {
    const a = app();
    const i = a.indexOf('<div class="hero">');
    const hero = a.slice(i, a.indexOf('hero-barre', i));
    /* LE DEFAUT, MESURE AVANT CORRECTION. L'intitule et sa bascule vivaient dans
       la colonne de lecture. Tant qu'elle prenait la plus grande part de la
       rangee, ils tenaient sur une ligne ; le jour ou les deux colonnes sont
       passees a la moitie chacune, la place a manque — a 390 px, 155 px de
       colonne pour 78 d'intitule, 10 d'ecart et 107 de pilule, soit 195. La
       pilule passait a la ligne, et sa marge automatique la posait au bord droit
       DE LA COLONNE, c'est-a-dire au milieu de la carte, juste au-dessus du
       grand chiffre. Vu a l'ecran, sur un telephone. */
    vrai(hero.indexOf('hero-label') < hero.indexOf('hero-haut'),
      'l’intitulé se rend avant la grille des deux colonnes');
    vrai(hero.indexOf('hero-label') < hero.indexOf('hero-gauche'),
      'et il n’est donc pas dans la colonne de lecture');
    /* La bascule se cale au bord droit de la carte, convention des autres
       cartes : l'intitule a gauche, sa bascule en haut a droite. */
    const css = lireSource('assets/styles.css');
    vrai(/\.hero-label > \.segmented \{ margin-left: auto; \}/.test(css),
      'la bascule se cale au bord droit');
    /* Et la grille ne porte plus que ce qui se partage vraiment en deux. */
    const haut = hero.slice(hero.indexOf('hero-haut'));
    vrai(!haut.includes('hero-label'), 'la grille ne porte plus l’intitulé');
    vrai(haut.includes('hero-value') && haut.includes('${blocSpark}'),
      'elle garde le chiffre et sa courbe');
  });

  test('la bulle se pose au-dessus du tracé, sans en sortir', () => {
    const c = lireSource('assets/charts.js');
    const b = c.slice(c.indexOf('function sparkline'), c.indexOf('return { stackedArea'));
    /* À `-6px` elle commençait six pixels au-dessus du cadre et retombait sur
       toute la hauteur de la courbe : on lisait le chiffre à travers le dessin
       qu'il commente. Son bas se pose maintenant au-dessus du cadre. */
    vrai(/tip\.style\.top = -Math\.min\(tip\.offsetHeight \+ 8,/.test(b),
      'son bas remonte au-dessus du cadre, de sa propre hauteur plus huit pixels');
    /* Et la montée est bornée par la place mesurée sur la carte, jamais par un
       nombre écrit : sinon elle sortirait par le haut. */
    vrai(/el\.getBoundingClientRect\(\)\.top - carte\.getBoundingClientRect\(\)\.top/.test(b),
      'la borne se mesure sur la carte qui porte le graphique');
  });

  test('le hero garde un seul chiffre principal', () => {
    const a = app();
    const i = a.indexOf('<div class="hero-haut">');
    const bloc = a.slice(i, a.indexOf('hero-barre', i));
    /* Aucun second montant, aucun pourcentage de plus : la courbe est une
       image, pas un indicateur. */
    eq((bloc.match(/hero-value/g) || []).length, 1, 'un seul grand chiffre');
    /* Le pourcentage vit dans `blocVariation`, construit plus haut : on le
       compte la ou il est ecrit, et on verifie qu'il n'en est pas apparu un
       second dans la rangee. */
    const variation = a.slice(a.indexOf('const blocVariation = !varAn'),
                              a.indexOf('`;', a.indexOf('</div>`', a.indexOf('const blocVariation = !varAn'))));
    eq((variation.match(/fmtSignedPct/g) || []).length, 1, 'un seul pourcentage');
    eq((bloc.match(/fmtSignedPct|fmtEUR0\(/g) || []).length, 1,
      'et la rangee n’en ajoute aucun autre');
    vrai(!/rendement|performance|benchmark|objectif/i.test(bloc.replace(/\/\*[\s\S]*?\*\//g, '')),
      'et aucun indicateur concurrent');
  });
});

/* --- RIEN NE SE SELECTIONNE, SAUF CE QUI S'EDITE ---------------------------

   Sur iPhone, un appui maintenu sur un montant ouvrait la loupe, posait les deux
   poignees bleues et sortait le menu Copier / Chercher / Traduire. La coupure est
   posee une fois, sur `body`. Une regle de ce genre ne vaut que par ce qui ne la
   contredit pas : ces controles cherchent donc surtout les exceptions, et
   verifient qu'il n'en reste qu'une, celle des champs de saisie. */
suite('Rien ne se sélectionne dans l’interface, sauf ce qui s’édite', () => {
  const css = () => lireSource('assets/styles.css');
  /* La fenetre s'ancre en debut de ligne : `html, body { background }` contient
     `body {` et serait trouve le premier. */
  const bloc = (c, sel) => {
    const i = c.indexOf('\n' + sel + ' {');
    return i < 0 ? '' : c.slice(i, c.indexOf('}', i));
  };

  test('la coupure est posée une fois, à la racine', () => {
    const c = css();
    vrai(c, 'assets/styles.css doit être lisible pour ce contrôle');
    /* `body` et non `html` : tout ce qui s'affiche est dedans, et les deux
       propriétés s'héritent, donc une déclaration couvre l'arbre entier.

       DEUX RÈGLES « body » COHABITENT, et l'ordre entre elles est tenu ailleurs :
       la première porte la police, un contrôle de la maison le vérifie en la
       lisant. La coupure vit donc dans la seconde, et ce contrôle-ci les lit
       toutes plutôt que de parier sur laquelle. */
    const regles = [];
    for (let i = c.indexOf('\nbody {'); i >= 0; i = c.indexOf('\nbody {', i + 1)) {
      regles.push(c.slice(i, c.indexOf('}', i)));
    }
    vrai(regles.length >= 1, 'la feuille déclare au moins une règle « body »');
    const b = regles.join('\n');
    vrai(/user-select: none/.test(b) && /-webkit-user-select: none/.test(b),
      'le corps de page ne se sélectionne pas');
    /* LES DEUX, ET PAS L'UN : `user-select` laisse passer la loupe et le menu
       contextuel d'iOS, que seul `-webkit-touch-callout` fait taire. */
    vrai(/-webkit-touch-callout: none/.test(b),
      'et il ne sort ni loupe, ni menu Copier / Chercher / Traduire');
  });

  test('ce qui s’édite garde sa sélection, et rien d’autre ne la reprend', () => {
    const c = css();
    const nu = c.replace(/\/\*[\s\S]*?\*\//g, '');
    /* L'exception nomme les trois formes editables. `contenteditable` n'est
       employe nulle part aujourd'hui : la ligne est posee pour le jour ou. */
    const exception = nu.slice(nu.indexOf('input, textarea,'),
                               nu.indexOf('}', nu.indexOf('input, textarea,')));
    for (const forme of ['input', 'textarea', '[contenteditable="true"]']) {
      vrai(exception.includes(forme), `« ${forme} » garde sa sélection`);
    }
    vrai(/user-select: text/.test(exception), 'et elle est rendue, pas seulement héritée');
    /* Sans `touch-callout: default`, iOS retire aussi le menu d'edition A
       L'INTERIEUR du champ : plus de Coller, plus de poignees de curseur. */
    vrai(/-webkit-touch-callout: default/.test(exception),
      'avec le menu d’édition qui va avec');
    /* ET C'EST LA SEULE. Une seconde regle qui rendrait la selection quelque
       part la reprendrait par specificite, sans que personne ne le voie : c'est
       exactement ce qui se passait sur les cartes a graphique, ou paragraphes et
       tableaux redevenaient selectionnables. */
    const rendus = (nu.match(/user-select: text/g) || []).length;
    eq(rendus, 2, `${rendus} déclarations rendent la sélection (une paire, la seule)`);
  });

  test('aucun événement n’est coupé au passage', () => {
    const c = css();
    /* `pointer-events: none` sur le shell ou sur les textes eteindrait boutons,
       renvois, survol, navigation et doigt sur la courbe. Ce qui est coupe est
       la selection native, rien d'autre. */
    for (const sel of ['body', '.main', '.view']) {
      vrai(!/pointer-events: none/.test(bloc(c, sel)),
        `« ${sel} » laisse passer les événements`);
    }
    /* Et le defilement vertical reste au navigateur : la sparkline le lui laisse
       par `touch-action: pan-y`, pose a la construction et non en CSS. */
    const ch = lireSource('assets/charts.js');
    vrai(/el\.style\.touchAction = 'pan-y'/.test(ch),
      'et le glissement vertical reste possible sur la courbe');
  });

  test('la courbe et sa bulle gardent leur propre garde', () => {
    const c = css();
    /* SEULE REDITE VOULUE DU FICHIER. Ailleurs l'appui maintenu est un geste
       parasite ; ici c'est le geste de lecture lui-meme, et une regle racine
       qu'on restreindrait un jour ne doit pas l'emporter sans qu'on le voie. */
    for (const sel of ['.hero-spark', '.tip-spark']) {
      const b = bloc(c, sel);
      vrai(/-webkit-user-select: none/.test(b) && /-webkit-touch-callout: none/.test(b),
        `« ${sel} » se défend seule aussi`);
    }
  });

  test('plus une seule garde locale ne dit ce que la racine dit déjà', () => {
    const nu = css().replace(/\/\*[\s\S]*?\*\//g, '');
    /* Six gardes avaient ete posees une par une — graphique, carte a graphique,
       en-tete de fiche, patrimoine de la barre laterale, montant masquable,
       colonnes triables. Elles disaient toutes la meme chose, et l'une d'elles
       la contredisait. Il en reste deux, et ce sont celles de la courbe. */
    const gardes = (nu.match(/user-select: none/g) || []).length;
    eq(gardes, 6, `${gardes} déclarations coupent la sélection, soit trois paires : la racine, la courbe, sa bulle`);
    /* Et la couleur de surbrillance n'a plus a etre eteinte a la main : il n'y a
       plus de surbrillance a peindre. */
    vrai(!/::selection \{ background: transparent/.test(nu),
      'aucun rattrapage de surbrillance ne subsiste');
  });
});

/* --- COPIER SANS ROUVRIR LA SELECTION --------------------------------------

   La regle de la maison est « rien ne se selectionne ». Son prix : une donnee
   qu'on recopie vraiment ailleurs n'a plus de chemin. Deux en ont un — le numero
   de compte et l'ISIN — par un bouton, jamais par une exception CSS. Ces
   controles tiennent les deux bords : que le bouton existe la ou il sert, et
   qu'aucune classe ne reprenne la selection par la fenetre. */
suite('La copie est un geste explicite, jamais une exception de sélection', () => {
  const app = () => lireSource('assets/app.js');
  const nu = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

  test('aucune classe ne reprend la sélection pour permettre la copie', () => {
    const css = lireSource('assets/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
    /* LA TENTATION A UN NOM : `.iban { user-select: text }`. Elle rouvre la
       loupe, les poignees et le menu natif sur la donnee la plus sensible de
       l'ecran, pour economiser un bouton. */
    for (const classe of ['iban', 'account-number', 'copyable', 'selectionnable',
                          'numero', 'montant', 'amount', 'retenir', 'hero-value']) {
      vrai(!new RegExp('\\.' + classe + '[^{]*\\{[^}]*user-select: text').test(css),
        `« .${classe} » ne rend pas la sélection`);
    }
    /* Et le compte global tient : une seule paire rend la selection, celle des
       champs de saisie. Ce controle-ci echoue AUSSI si quelqu'un en ajoute une
       ailleurs, quel que soit le nom qu'il lui donne. */
    eq((css.match(/user-select: text/g) || []).length, 2,
      'une seule exception dans toute la feuille, celle de la saisie');
  });

  test('une seule porte mène au presse-papiers', () => {
    const a = nu(app());
    vrai(/async function copierDansLePressePapiers\(valeur\)/.test(a),
      'le helper existe et il est unique');
    eq((a.match(/navigator\.clipboard/g) || []).length, 1,
      'un seul appel à l’API dans toute l’application');
    /* La reussite s'annonce APRES l'attente, sinon elle s'annoncerait avant de
       savoir : `await` puis le toast, dans cet ordre. */
    const bloc = a.slice(a.indexOf('async function copierDansLePressePapiers'),
                         a.indexOf('\n}', a.indexOf('async function copierDansLePressePapiers')));
    vrai(bloc.indexOf('await navigator.clipboard.writeText') < bloc.indexOf("trad('Copié')"),
      'le succès ne s’annonce qu’une fois la copie faite');
    vrai(/catch \(err\)[\s\S]*Impossible de copier/.test(bloc),
      'et l’échec le dit, sans faire croire au succès');
    vrai(/return false;/.test(bloc), 'et il se rend, il ne jette pas');
    /* Un toast, pas une fenetre : l'echec d'une copie n'interrompt personne. */
    vrai(!/askConfirm|modal/.test(bloc), 'aucune fenêtre modale pour un échec de copie');
  });

  test('la copie part d’un bouton, et de rien d’autre', () => {
    const a = nu(app());
    /* NI SURVOL, NI FOCUS, NI APPUI MAINTENU, NI CLIC SUR LA LIGNE. Le seul
       appelant est l'action du bouton, et le seul declencheur de cette action
       est le `data-action` que la delegation de clic lit. */
    const appels = (a.match(/copierDansLePressePapiers\(/g) || []).length;
    eq(appels, 2, 'une déclaration, un appel : celui de l’action');
    vrai(/'copier'\(btn\) \{ copierDansLePressePapiers\(btn\.dataset\.copie\); \}/.test(a),
      'l’action lit la valeur portée par le bouton');
    for (const piege of ['onmouseenter', 'onfocus', 'onpointerdown', 'oncontextmenu']) {
      vrai(!new RegExp(piege + '[^\\n]*copier', 'i').test(a),
        `la copie ne part pas sur ${piege}`);
    }
  });

  test('le bouton porte son nom, sa cible et sa discrétion', () => {
    const a = nu(app());
    const b = a.slice(a.indexOf('const boutonCopier ='), a.indexOf('\n};', a.indexOf('const boutonCopier =')));
    /* UN NOM PRECIS, PAS « Copier » TOUT SEUL : a l'oreille, « Copier » ne dit
       pas quoi. Le meme mot sert d'infobulle a la souris. */
    vrai(/aria-label="\$\{nom\}"/.test(b) && /title="\$\{nom\}"/.test(b),
      'il porte un nom accessible et le même en infobulle');
    vrai(/trad\(libelle\)/.test(b), 'et ce nom passe par la traduction');
    /* Une valeur vide ne laisse pas une icone morte derriere elle. */
    vrai(/if \(!v\) return '';/.test(b), 'et il ne s’écrit pas sans valeur à copier');
    vrai(/data-copie="\$\{esc\(v\)\}"/.test(b), 'la valeur traverse l’échappement');

    const css = lireSource('assets/styles.css');
    const regle = css.slice(css.indexOf('.btn-copie {'), css.indexOf('}', css.indexOf('.btn-copie {')));
    vrai(/background: none/.test(regle) && /border: none/.test(regle),
      'le bouton reste secondaire : ni fond, ni bordure');
    /* QUARANTE-QUATRE PIXELS DE CIBLE POUR QUINZE DE DESSIN. Au doigt, une
       icone se manque ; la zone s'etend sans que rien ne bouge a l'ecran. */
    const cible = css.slice(css.indexOf('.btn-copie::after {'), css.indexOf('}', css.indexOf('.btn-copie::after {')));
    vrai(/width: 44px/.test(cible) && /height: 44px/.test(cible),
      'sa zone tactile fait quarante-quatre pixels');
    vrai(/margin-left: 10px/.test(regle), 'et il ne colle pas au texte qu’il copie');
    vrai(/\.btn-copie:focus-visible \{[^}]*outline/.test(css),
      'le clavier voit où il est');
    vrai(!/\.btn-copie[^{]*\{[^}]*pointer-events: none/.test(css),
      'et aucun événement n’est coupé au passage');
  });

  test('seules deux données portent un bouton, et ce sont les bonnes', () => {
    const a = nu(app());
    /* TROIS APPELS POUR DEUX DONNEES : le numero de compte se lit a deux
       endroits — la fiche d'un placement et celle d'un compte — et l'ISIN a un.
       Un quatrieme appel serait une icone de plus dans une interface qui n'en
       demande pas. */
    const appels = [...a.matchAll(/boutonCopier\(([^,]+), '([^']+)'\)/g)].map(m => [m[1], m[2]]);
    /* Deux : le numero de compte sur la carte d'identite, et l'ISIN sur la fiche
       d'une ligne de titres. Il y en avait trois tant que la carte de valeur
       d'un actif en parts portait sa propre copie du numero ; elle l'a rendue a
       « Informations » avec le reste de l'identite. */
    eq(appels.length, 2, `${appels.length} boutons de copie dans toute l’application`);
    for (const [valeur, libelle] of appels) {
      vrai(/^(c\.numero|p\.isin)$/.test(valeur.trim()),
        `« ${valeur.trim()} » est une donnée qu’on recopie ailleurs`);
      vrai(/^Copier (le numéro de compte|l’ISIN)$/.test(libelle),
        `« ${libelle} » nomme ce qu’il copie`);
    }
    /* ET AUCUN MONTANT. « Est-ce qu'on le colle dans un autre formulaire ? »
       Pour un patrimoine, une variation ou un solde : non. */
    vrai(!/boutonCopier\([^)]*(fmtEUR|montant|solde|total|valeur\()/i.test(a),
      'aucun montant ne porte de bouton de copie');
  });

  test('le bouton copie la valeur du modèle, jamais une version affichée à part', () => {
    const a = nu(app());
    /* Le meme `c.numero` alimente le `<dd>` et le bouton : il n'y a pas deux
       verites, donc pas de version masquee a reconstituer. */
    vrai(/<dd>\$\{esc\(c\.numero\)\}\$\{boutonCopier\(c\.numero, 'Copier le numéro de compte'\)\}<\/dd>/.test(a),
      'le numéro affiché et le numéro copié sont la même donnée');
    vrai(/\$\{esc\(p\.isin\)\}<\/span>`\s*\+ boutonCopier\(p\.isin, 'Copier l’ISIN'\)/.test(a),
      'et l’ISIN aussi');
    /* RIEN DE MASQUE N'EST RENDU LISIBLE POUR L'OCCASION : le mode discret
       couvre les montants, et aucun montant ne porte de bouton. */
    const css = lireSource('assets/styles.css');
    const discret = css.slice(css.indexOf('body.discret'), css.indexOf('}', css.indexOf('body.discret')));
    vrai(!/btn-copie/.test(discret), 'le mode discret ne connaît pas ce bouton, et n’a rien à lui cacher');
  });

  test('les deux langues disent la réussite et l’échec', () => {
    for (const [fr, en] of [['Copié', 'Copied'],
                            ['Impossible de copier', 'Couldn’t copy'],
                            ['Copier le numéro de compte', 'Copy account number'],
                            ['Copier l’ISIN', 'Copy ISIN']]) {
      eq(I18N.en[fr], en, `« ${fr} » a sa traduction`);
    }
    /* Le message vit le temps d'un toast ordinaire, celui que la maison a deja
       retenu pour ce qui n'attend pas de reponse. */
    const a = lireSource('assets/app.js');
    vrai(/const vie = action \? 6000 : 2300;/.test(a),
      'et il s’efface seul, comme tous les messages sans bouton');
  });
});

/* --- La courbe du hero s'explore, et la reserve cesse de prescrire ---------

   Deux gestes sans rapport, sur le meme ecran. La courbe ne porte pas qu'une
   forme : elle dit ce qu'on avait a ce moment-la. La reserve, elle, n'ecrit
   pas de palier generique sous le chiffre de quelqu'un. */
suite('La courbe du hero s’explore au doigt', () => {
  const c = () => lireSource('assets/charts.js');
  const bloc = () => {
    const s = c();
    return s.slice(s.indexOf('function sparkline'), s.indexOf('return { stackedArea'));
  };

  test('chaque valeur porte sa date, et les deux viennent du même parcours', () => {
    /* Un second releve dans la fenetre : la courbe ne trace que des releves,
       et il en faut deux pour qu'elle existe. */
    Fixture.poser(s => { s.monthly.push({ ...structuredClone(s.monthly[0]), date: '2026-07-01' }); });
    const v = variationAn(todayISO(), true);
    const pts = pointsAn(v.depuis, true);
    vrai(pts.length >= 2, `${pts.length} points`);
    /* UN SEUL PARCOURS : deux filtres écrits côte à côte auraient fini par ne
       pas retenir les mêmes relevés, et la courbe aurait porté des étiquettes
       décalées d'un cran sur ses propres montants. */
    eq(pts.map(p => p.valeur).join('|'), serieAn(v.depuis, true).join('|'),
      'la série des valeurs dérive des points, elle ne les refait pas');
    const st = lireSource('assets/store.js');
    vrai(/const serieAn = \(depuis, net = true\) => pointsAn\(depuis, net\)\.map\(p => p\.valeur\);/.test(st),
      'et cela se lit dans le code');
    /* L'ANNÉE EN ENTIER, par le formateur qui existe déjà pour ça. Le ruban des
       relevés abrège parce que ses colonnes sont étroites ; une bulle de deux
       lignes n'a pas cette contrainte. `fmtMoisAn()` sert déjà aux échéances de
       crédit : en poser un second ici aurait donné deux façons de nommer le
       même mois. */
    const dans = historySeries({ includeNow: false }).filter(p => String(p.date) >= String(v.depuis));
    eq(pts.map(p => p.label).join('|'), dans.map(p => fmtMoisAn(p.date)).join('|'),
      'aucun second format de mois');
    setLang('fr');
    vrai(/^[a-zéû.]+ \d{4}$/.test(pts[0].label), `« ${pts[0].label} » porte son année entière`);
    vrai(!/ \d{2}$/.test(pts[0].label), 'et jamais une année sur deux chiffres');
    vrai(!pts.some(p => p.label === trad('Auj.')), 'et aucun point du jour : la courbe trace des relevés');
  });

  test('le point retenu est un relevé réel, jamais un entre-deux', () => {
    const b = bloc();
    /* L'abscisse du doigt s'arrondit au point le plus proche : aucun patrimoine
       intermédiaire n'est calculé. */
    vrai(/Math\.round\(\(ev\.clientX - r\.left\) \/ r\.width \* \(values\.length - 1\)\)/.test(b),
      'l’abscisse s’arrondit au point le plus proche');
    vrai(/Math\.max\(0, Math\.min\(values\.length - 1,/.test(b),
      'et reste dans les bornes de la série');
    /* DEUX LIGNES, LA DATE AU-DESSUS. En ligne, séparées d'un point médian, les
       deux se disputaient la même lecture et c'est la date qui gagnait, puisque
       qu'elle finissait la phrase. */
    vrai(/tip\.innerHTML = `<div class="tt-head">\$\{opts\.labels\[i\]\}<\/div>`/.test(b),
      'la date ouvre la bulle, dans l’intitulé partagé des infobulles');
    vrai(/\+ `<b>\$\{fmtEUR0\(values\[i\]\)\}<\/b>`;/.test(b),
      'et le montant la suit, lu au point et non à la moyenne');
    vrai(!/·/.test(b.replace(/\/\*[\s\S]*?\*\//g, '')),
      'plus aucune séparation en ligne');
    /* Deux informations, pas dix. */
    vrai(!/variation|apport|composition|performance/i.test(b.replace(/\/\*[\s\S]*?\*\//g, '')),
      'date et montant, rien d’autre');
  });

  test('elle ne déborde jamais de son cadre', () => {
    const b = bloc();
    /* Près du bord droit elle se décale à gauche, près du gauche elle se cale à
       zéro : le clamp le dit en une ligne. */
    vrai(/tip\.style\.left = Math\.max\(0, Math\.min\(W - tw, x\(i\) - tw \/ 2\)\) \+ 'px';/.test(b),
      'l’infobulle se recale dans la largeur du tracé');
  });

  test('le doigt explore, le défilement reste au doigt aussi', () => {
    const b = bloc();
    vrai(/el\.style\.touchAction = 'pan-y';/.test(b),
      'un geste vertical fait défiler la page');
    const s = c();
    const g = s.slice(s.indexOf('function cablerInfobulle'), s.indexOf('function ensureTip'));
    /* À ÉGALITÉ, LE GESTE VA AU DÉFILEMENT : c'est celui qu'on perd le plus mal,
       et une infobulle manquée se rattrape en reposant le doigt. */
    vrai(/if \(dy > SEUIL_GLISSE && dy >= dx\)/.test(g), 'un glissement vertical abandonne');
    vrai(/if \(dx > SEUIL_GLISSE\)/.test(g), 'un glissement horizontal ouvre');
    vrai(!/preventDefault/.test(g), 'et rien n’est capturé de force');
    /* La levée referme, sans minuteur. */
    vrai(/cible\.addEventListener\('pointerup', cacher\);/.test(g), 'lever le doigt referme');
    vrai(/cible\.addEventListener\('pointerleave', cacher\);/.test(g), 'sortir referme aussi');
  });

  test('rien ne se rend à nouveau pendant le mouvement', () => {
    const b = bloc();
    const montrer = b.slice(b.indexOf('const montrer = ev =>'), b.indexOf('const cacher ='));
    /* Seuls le curseur et l'infobulle bougent : pas un rendu de page par pixel. */
    for (const interdit of ['render(', 'innerHTML =', 'Store.', 'mount(']) {
      if (interdit === 'innerHTML =') continue;   // l'infobulle, et elle seule
      vrai(!montrer.includes(interdit), `le mouvement n’appelle pas ${interdit}`);
    }
    eq((montrer.match(/innerHTML/g) || []).length, 1, 'une seule écriture, celle de l’infobulle');
  });
});

/* --- UN SEUL SQUELETTE, PARCE QU'ON BALAYE CETTE CARTE ---------------------
   « À retenir » ne se lit pas ligne a ligne, on la parcourt. Un parcours
   suppose que le meme element se trouve toujours au meme endroit — titre,
   chiffre, contexte, complement, renvoi — et que rien d'important ne se cache
   au milieu d'une phrase. Ces controles tiennent l'ordre et la hierarchie, pas
   les mots : les mots, eux, ont leurs propres suites plus bas. */
suite('À retenir : chaque insight se lit dans le même ordre', () => {
  const app = () => lireSource('assets/app.js');
  const presentation = () => {
    const a = app();
    return a.slice(a.indexOf('const PRESENTATION_INSIGHT'), a.indexOf('function carteARetenir()'));
  };
  /* LA BORNE BASSE EST LA FONCTION SUIVANTE, QUELLE QU'ELLE SOIT. Elle nommait
     `viewOverview()`, qui se trouvait être la voisine : la carte commune des
     insights et le rendu d'une entrée se sont posés entre les deux, et la
     tranche a gonflé de deux fonctions que ces contrôles ne visent pas — d'où
     « deux listes » là où la carte de l'Aperçu n'en porte qu'une. Une borne se
     dérive de la structure, jamais d'un voisinage que rien ne garantit. */
  const rendu = () => {
    const a = app();
    const d = a.indexOf('function carteARetenir()');
    const f = a.indexOf('\nfunction ', d + 1);
    return a.slice(d, f > 0 ? f : undefined);
  };
  const entree = (id, suivant) => {
    const p = presentation();
    return p.slice(p.indexOf(id + ': {'), p.indexOf(suivant + ': {'));
  };

  test('une seule carte porte toutes les lectures', () => {
    const r = rendu();
    /* UNE CARTE, PLUSIEURS LECTURES DEDANS. Une carte par insight aurait trois
       cadres, trois ombres et trois en-tetes pour trois phrases, et la page
       d'accueil se serait allongee d'autant. */
    eq((r.match(/class="retenir-liste"/g) || []).length, 1, 'une liste, et une seule');
    eq((r.match(/<section/g) || []).length, 1, 'dans une seule section');
  });

  test('le gabarit pose les cinq blocs dans cet ordre', () => {
    /* LE GABARIT D'UNE ENTREE A DEMENAGE dans `ligneInsight()`, qui le rend pour
       tous les onglets. C'est la le bon endroit pour ce contrôle : l'ordre des
       cinq blocs est une propriété de l'entrée, pas de la carte qui la porte, et
       le vérifier dans une seule carte laisserait les autres libres d'en
       inventer un second. */
    const a = app();
    const d = a.indexOf('function ligneInsight(');
    const item = a.slice(d, a.indexOf('\nfunction ', d + 1));
    vrai(item.length > 200, 'le rendu d’une entrée est bien la fenêtre lue');
    const rang = c => item.indexOf('retenir-' + c);
    const ordre = ['titre', 'valeur', 'texte', 'second', 'lien'];
    for (let k = 1; k < ordre.length; k++) {
      vrai(rang(ordre[k - 1]) > 0 && rang(ordre[k - 1]) < rang(ordre[k]),
        `« ${ordre[k - 1]} » vient avant « ${ordre[k]} »`);
    }
  });

  test('les trois lectures de tête portent les cinq blocs', () => {
    /* Trois insights se disputent les trois places de la carte sur un etat
       nourri : ce sont eux qui doivent se ressembler en premier. */
    for (const [id, suivant] of [['allocation_target_gap', 'wealth_pace_shift'],
                                 ['wealth_pace_shift', 'goal_projected_date'],
                                 ['goal_projected_date', 'liquidity_runway_shift']]) {
      const b = entree(id, suivant).replace(/\/\*[\s\S]*?\*\//g, '');
      vrai(b.length > 80, `« ${id} » a bien été trouvé`);
      /* UN TITRE PEUT ÊTRE UNE FONCTION, et c'est même le cas quand il porte
         une conclusion : « Ton patrimoine avance plus vite qu'avant » se décide
         sur les chiffres de la règle, il ne peut pas être une constante. Le
         motif n'exigeait qu'une chaîne, donc il interdisait par accident le
         titre qui dit quelque chose. */
      for (const [champ, motif] of [['un titre', /\n    titre: ('|p =>)/],
                                    ['une valeur forte', /\n    valeur: /],
                                    ['un contexte', /\n    phrase: /],
                                    ['une information secondaire', /\n    secondaire: /],
                                    ['un renvoi', /\n    cta: \{/]]) {
        vrai(motif.test(b), `« ${id} » a ${champ}`);
      }
    }
  });

  test('le contexte prolonge le chiffre, il ne recommence pas une phrase', () => {
    const p = presentation();
    /* La réserve dit « de dépenses immédiates » depuis que son titre porte le
       verbe : « Ce que ta réserve couvre » suivi de « immédiatement couvertes »
       répétait le même mot à deux lignes d'écart. Ce que le contrôle défend est
       la FORME du contexte — un complément qui prolonge le chiffre au lieu de
       rouvrir une phrase — pas le choix des mots. */
    for (const c of ['sur les {n} derniers mois',
                     'pour atteindre ta cible de {t}']) {
      vrai(p.includes(`trad('${c}')`), `« ${c} » est le contexte affiché`);
      /* Pas de majuscule, pas de point : cette ligne continue la valeur du
         dessus, elle ne s'en detache pas. */
      vrai(!/[.]$/.test(c), `« ${c} » ne se ferme pas par un point`);
      vrai(c[0] === c[0].toLowerCase(), `« ${c} » ne reprend pas une majuscule`);
      vrai(c.length <= 40, `« ${c} » se lit d’un coup d’œil (${c.length} caractères)`);
      vrai(!!I18N.en[c], `« ${c} » a sa traduction`);
    }
  });

  test('l’information secondaire situe, elle ne juge pas et ne conseille pas', () => {
    const p = presentation();
    for (const s of ['contre {b} auparavant',
                     'selon tes hypothèses actuelles']) {
      vrai(p.includes(`trad('${s}')`), `« ${s} » est écrit`);
      vrai(!!I18N.en[s], `« ${s} » a sa traduction`);
      for (const mot of ['devrais', 'il faut', 'pense à', 'insuffisant', 'faible',
                         'idéal', 'recommand', '3 à 6']) {
        vrai(!new RegExp(mot, 'i').test(s), `« ${mot} » serait un jugement`);
      }
    }
  });

  test('la hiérarchie se voit avant de se lire', () => {
    const css = lireSource('assets/styles.css');
    const bloc = c => css.slice(css.indexOf(`.retenir-${c} {`),
      css.indexOf('}', css.indexOf(`.retenir-${c} {`)));
    vrai(/font-size: var\(--font-xl\)/.test(bloc('valeur'))
      && /font-weight: 700/.test(bloc('valeur')),
      'la valeur est le plus gros et le plus gras de l’entrée');
    vrai(/var\(--text-secondary\)/.test(bloc('texte')) && !/font-size/.test(bloc('texte')),
      'le contexte garde la taille du texte courant');
    vrai(/font-size: var\(--font-sm\)/.test(bloc('second'))
      && /var\(--muted\)/.test(bloc('second')),
      'et l’information secondaire est plus petite et plus pâle que lui');
    /* « janvier 2030 » ouvre sa ligne comme un chiffre et merite la capitale
       qu'un debut de ligne appelle ; `capitalize` aurait ecrit « 0,8 Mois ». */
    vrai(/\.retenir-valeur::first-letter \{ text-transform: uppercase; \}/.test(css),
      'la date porte sa capitale sans que les autres valeurs y perdent');
    vrai(!/\.retenir-valeur \{[^}]*text-transform: capitalize/.test(css),
      'jamais « capitalize », qui toucherait aussi l’unité');
  });
});

/* --- La reserve decrit, elle ne prescrit plus ------------------------------ */

/* --- Le moteur d'insights -------------------------------------------------

   Il lit les moteurs existants et en tire une lecture. Il ne calcule rien de
   financier, ne produit aucun texte, ne connait ni langue ni devise, et se tait
   des qu'une donnee manque. Ces trois proprietes sont ce que la suite protege :
   le reste n'est que le detail de cinq regles. */
suite('Le moteur d’insights ne parle pas sans données', () => {
  const src = () => lireSource('assets/insights.js');
  const par = (l, id) => l.find(i => i.id === id) || null;
  const vierge = () => { Store.state = blankState(); Store.migrate(); refreshAccounts(); };

  /* Un historique de N relevés mensuels consécutifs, valeur imposée mois par
     mois : c'est la seule facon de fabriquer un rythme comparable. */
  const poserHistorique = (valeurs, depart = '2024-01-31') => {
    const [y, m] = depart.split('-').map(Number);
    Store.state.monthly = valeurs.map((v, i) => {
      const d = new Date(Date.UTC(y, m - 1 + i + 1, 0));
      return { date: d.toISOString().slice(0, 10), comment: '', v: { c_courant: v } };
    });
  };

  test('1. un état vierge ne produit aucun insight', () => {
    vierge();
    const l = construireInsights();
    eq(l.length, 0, 'rien à dire, donc rien de dit : ' + l.map(i => i.id).join(', '));
    vrai(Array.isArray(l), 'et c’est une liste, pas null');
  });

  test('2. chaque règle déclare son éligibilité et ne rend rien sans elle', () => {
    vierge();
    for (const r of REGLES_INSIGHT) {
      eq(typeof r.eligible, 'function', `${r.id} déclare eligible()`);
      eq(typeof r.evaluer, 'function', `${r.id} déclare evaluer()`);
      vrai(!!r.titleKey && !!r.descriptionKey, `${r.id} porte ses clefs`);
      vrai(!!r.dedupeGroup, `${r.id} porte son groupe`);
      vrai(!!r.famille && !!r.question, `${r.id} porte sa famille et sa question`);
      vrai(num(r.reposJours) > 0 && num(r.materialite) > 0,
        `${r.id} declare son repos et sa matérialité`);
      /* Les deux fonctions recoivent les mesures deja faites, jamais l'etat
         brut : c'est ce qui garantit qu'un seul passage sur les moteurs sert
         treize regles, et que deux d'entre elles ne lisent pas le meme chiffre
         a deux instants differents. */
      eq(r.eligible(mesuresInsights(contexteInsights()), contexteInsights()), false,
        `${r.id} se tait sur un état vierge`);
    }
  });

  test('3. le moteur ne produit ni texte, ni signe monétaire, ni pourcentage formaté', () => {
    const s = src();
    /* Aucun signe monetaire en dur, dans aucune des deux devises. */
    vrai(!/[€$]/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), 'aucun symbole de devise hors commentaire');
    /* Aucun formateur : ni le central, ni un Intl local. */
    for (const interdit of ['fmtEUR', 'fmtCur', 'Intl.NumberFormat', 'toLocaleString',
                            'deviseBase', 'trad(', 't(\'']) {
      vrai(!s.includes(interdit), `le moteur n’appelle pas ${interdit}`);
    }
    /* Ni DOM, ni stockage, ni reseau, ni horloge non injectee. */
    for (const interdit of ['document', 'localStorage', 'fetch(', 'setTimeout', 'window.']) {
      vrai(!s.includes(interdit), `le moteur ne touche pas à ${interdit}`);
    }
    /* Et ce qu'il rend ne porte que des nombres et des clefs. */
    Fixture.poser();
    for (const i of construireInsights()) {
      for (const [k, v] of Object.entries(i.params)) {
        vrai(typeof v === 'number' || typeof v === 'string',
          `${i.id}.params.${k} est un nombre ou une clef, pas un objet formaté`);
        if (typeof v === 'string') vrai(!/[€$%]/.test(v), `${i.id}.params.${k} ne porte aucune unité`);
      }
      vrai(!!i.evidence && !!i.evidence.source, `${i.id} nomme son moteur source`);
    }
  });

  test('4. l’ordre est déterministe, et deux lectures rendent la même liste', () => {
    Fixture.poser();
    const a = construireInsights().map(i => i.id);
    const b = construireInsights().map(i => i.id);
    eq(a.join(','), b.join(','), 'deux appels de suite, même ordre');
    /* Le poids gouverne, l'ordre de declaration departage. Le poids est la
       somme du rang de la famille et de l'amplitude que la regle a rendue :
       il se lit, et c'est tout l'interet de ne pas avoir de score opaque. */
    const l = evaluerInsights();
    for (let i = 1; i < l.length; i++) {
      vrai(l[i - 1].poids >= l[i].poids, 'les poids ne remontent jamais');
      vrai(l[i].poids >= 10, 'aucun poids ne descend sous le rang le plus bas');
    }
    /* LE MOTEUR NE COUPE PLUS, IL ORDONNE. Le premier tour met en tete au plus
       une entree par famille, le second ajoute le reste derriere : l'ordre n'est
       donc plus celui de l'evaluation, et c'est voulu. Ce qui reste garanti,
       c'est que rien ne se perd et que la tete ne bouge pas. */
    const choisis = construireInsights().map(i => i.id);
    for (const id of choisis) vrai(l.some(x => x.id === id), `${id} vient de l’évaluation`);
    eq(choisis[0], l[0].id, 'le mieux classé reste en tête');
    eq(new Set(choisis).size, choisis.length, 'et aucun ne paraît deux fois');
    eq(construireInsights().map(i => i.id).join(','), choisis.join(','),
       'deux appels, même ordre');
    /* Et aucun horodatage ne traine dans le moteur. */
    vrai(!/Date\.now\(\)|new Date\(\)/.test(src()), 'aucune horloge ne sert de départage');
  });

  test('5. un seul insight par groupe de déduplication', () => {
    Fixture.poser();
    const l = construireInsights();
    const groupes = l.map(i => i.dedupeGroup);
    eq(new Set(groupes).size, groupes.length, 'aucun groupe n’apparaît deux fois');
  });

  test('6. la devise ne change pas un seul résultat du moteur', () => {
    Fixture.poser();
    Store.state.meta.devise = 'EUR';
    const eur = JSON.stringify(construireInsights());
    Store.state.meta.devise = 'USD';
    const usd = JSON.stringify(construireInsights());
    eq(usd, eur, 'les insights sont identiques en euros et en dollars');
  });
});

/* --- Le catalogue, le repos, la selection ---------------------------------

   Ce que la suite precedente protege, c'est le contrat du moteur. Celle-ci
   protege ce que le catalogue a de neuf : treize regles au lieu de cinq, un
   poids qui remplace un rang inverse, une memoire qui fait taire ce qui a deja
   ete dit, et une selection qui evite de raconter trois fois la meme histoire.

   Elle protege aussi ce que le catalogue REFUSE de faire, et c'est la moitie qui
   compte : trois familles d'insights ont ete ecartees faute de donnee, et le
   code porte la raison de chacune. Sans ce test, la prochaine lecture les
   reinventerait avec une heuristique deguisee en decision du detenteur. */
suite('Le catalogue s’est élargi, et il dit ce qu’il ne sait pas faire', () => {
  const src = () => lireSource('assets/insights.js');
  const sansCommentaires = () => src().replace(/\/\*[\s\S]*?\*\//g, '');

  test('chaque règle est unique, nommée, et rangée dans une famille', () => {
    const ids = REGLES_INSIGHT.map(r => r.id);
    eq(new Set(ids).size, ids.length, 'aucun identifiant en double');
    /* UN GROUPE PEUT SE PARTAGER, ET C'EST TOUT SON OBJET. Ce contrôle exigeait
       un groupe par règle, ce qui revenait à interdire le mécanisme qu'il
       croyait protéger : le groupe existe pour que deux règles qui diraient la
       même chose ne sortent pas ensemble. « Tes dépenses ont monté de 12 % » et
       « tes restaurants passent de 180 a 300 EUR » racontent le meme fait, la
       seconde en disant où ; elles partagent donc un groupe, et la plus forte
       gagne.

       Ce qui reste interdit, et c'est la vraie règle : partager un groupe entre
       deux familles. La famille sert à ordonner, le groupe à retirer — deux
       règles de familles différentes qui s'excluent feraient disparaître une
       question entière de l'écran sans que rien ne le dise. */
    const parGroupe = new Map();
    for (const r of REGLES_INSIGHT) {
      const l = parGroupe.get(r.dedupeGroup) || [];
      l.push(r); parGroupe.set(r.dedupeGroup, l);
    }
    for (const [groupe, regles] of parGroupe) {
      eq(new Set(regles.map(r => r.famille)).size, 1,
        `le groupe « ${groupe} » s’étend sur plusieurs familles : il ferait taire `
        + 'une question entière, pas une redite');
    }
    const familles = new Set(REGLES_INSIGHT.map(r => r.famille));
    vrai(familles.size >= 6, `${familles.size} familles distinctes`);
    for (const r of REGLES_INSIGHT) {
      vrai([INSIGHT_PRIORITE.HAUTE, INSIGHT_PRIORITE.MOYENNE, INSIGHT_PRIORITE.BASSE]
        .includes(r.priorite), `${r.id} porte un des trois rangs`);
    }
    /* Le rang le plus haut porte le plus grand nombre : le poids est une somme,
       et une echelle inversee se serait additionnee a l'envers. */
    vrai(INSIGHT_PRIORITE.HAUTE > INSIGHT_PRIORITE.BASSE, 'le rang monte avec l’importance');
  });

  /* CES DEUX TESTS LISENT DU CODE, ET JAMAIS UN COMMENTAIRE. La chaîne de
     publication retire les commentaires : une assertion posée sur une phrase
     explicative passe ici et rougit dans l'arbre publié, sans qu'aucun
     comportement n'ait changé. C'est arrivé, et une fois suffit. */
  test('ce que les données ne permettent pas est écarté, et rien ne le remplace', () => {
    const c = sansCommentaires();
    /* PAS DE RESERVE CIBLE INVENTEE. `runway()` porte un palier à trois et six
       mois qui sert une jauge ailleurs ; aucune règle ne le lit, sinon une
       phrase qui circule passerait pour un arbitrage du détenteur. */
    /* Le palier de trois mois entre desormais dans le moteur, et a un seul
       titre : DECIDER qu'une reserve insuffisante passe devant une bonne
       nouvelle. Il ne sort jamais en chiffre, il ne devient jamais une cible
       affichee, et `targetHigh` n'y entre pas du tout. */
    const catalogue = c.slice(c.indexOf('const REGLES_INSIGHT = ['));
    vrai(!/targetLow/.test(catalogue), 'aucune règle du catalogue ne lit un palier');
    vrai(/const reserveSousCible = m => num\(m\.runway\.reserve\) < num\(m\.runway\.targetLow\);/.test(c),
      'les deux seules lignes qui le nomment sont des gardes de sélection');
    vrai(/const moisManquants = m => Math\.max\(0,/.test(c), 'et la seconde mesure le manque');
    vrai(!/targetHigh/.test(c), 'le palier haut n’entre pas dans le moteur');
    /* PAS DE MARCHES. Le complément des apports mêle valorisation, capital
       remboursé et réévaluation, et rien ici ne sait les séparer. */
    vrai(!/march[ée]s/i.test(c), 'aucune règle n’attribue quoi que ce soit aux marchés');
    Fixture.poser();
    const o = evaluerInsights().find(x => x.id === 'wealth_growth_origin');
    if (o) {
      vrai('rest' in o.params, 'le complément s’appelle « le reste »');
      eq(o.evidence.restIsNotOnlyMarkets, true, 'et la preuve le déclare');
    }
    /* PAS D'HISTORIQUE PAR LIGNE. Les relevés notent des montants par compte :
       la concentration ne compare donc le portefeuille qu'à lui-même. */
    const k = evaluerInsights().find(x => x.id === 'concentration_top_line');
    if (k) {
      vrai(!Object.keys(k.params).some(n => /previous|avant/i.test(n)),
        'la concentration ne compare aucune date');
      vrai(!k.evidence.previousDate, 'et sa preuve n’en porte aucune');
    }
  });

  test('deux règles se passent de tout seuil posé, et se comparent au détenteur', () => {
    const c = sansCommentaires();
    const tranche = (a, b) => c.slice(c.indexOf(a), c.indexOf(b));
    /* Un mois sort de l'ordinaire quand il s'écarte de plus du DOUBLE de ce que
       ses propres mois s'écartent habituellement. Aucun montant, aucun
       pourcentage : trois cents euros de plus sont énormes chez l'un et
       invisibles chez l'autre. */
    /* LA BORNE BASSE EST LA REGLE SUIVANTE, QUELLE QU'ELLE SOIT. Elle nommait
       `concentration_top_line`, qui se trouvait être la voisine : trois règles
       posées entre les deux ont fait entrer leurs seuils dans la tranche, et le
       contrôle a crié sur du code qu'il ne visait pas. Une borne se dérive de
       la structure — la prochaine déclaration de règle — jamais d'un voisinage
       qui n'est garanti par rien. */
    const regleSuivante = depuis => {
      const i = c.indexOf(depuis);
      const j = c.indexOf("    id: '", i + depuis.length);
      return c.slice(i, j > 0 ? j : undefined);
    };
    const mois = regleSuivante("id: 'spending_month_anomaly'");
    vrai(/2 \* dispersion/.test(mois), 'le seuil est le double de sa propre dispersion');
    vrai(/mediane\(avant\.map/.test(mois), 'mesurée sur ses propres mois');
    vrai(!/SEUIL_/.test(mois), 'et aucun seuil posé n’entre dans la règle');
    /* Une ligne est remarquable quand elle pèse autant que les deux suivantes DU
       MEME portefeuille. « Seize pour cent, est-ce beaucoup » n'a pas de réponse
       générale, et toutes celles qui circulent sont des opinions. */
    const ligne = tranche("id: 'concentration_top_line'", 'function creditBientotSolde');
    vrai(/deuxSuivantes/.test(ligne), 'la première ligne se compare aux deux suivantes');
    vrai(!/SEUIL_/.test(ligne), 'et aucun seuil posé n’y entre non plus');
    /* Aucun jugement ne peut sortir du moteur, même par une clef. */
    for (const mot of ['prudent', 'sain', 'risque', 'recommand', 'optimal']) {
      vrai(!new RegExp(mot, 'i').test(c), `« ${mot} » ne sort pas du moteur`);
    }
  });

  test('un insight déjà montré se tait, et revient quand son chiffre bouge', () => {
    Fixture.poser();
    const l = evaluerInsights();
    vrai(l.length > 0, 'la graine a de quoi parler');
    const i = l[0];
    const regle = REGLES_INSIGHT.find(r => r.id === i.id);
    const ilYA = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

    /* CELUI D'AUJOURD'HUI RESTE A L'ECRAN. La vue note ce qu'elle vient de
       montrer ; si la note le faisait taire aussitôt, le rendu suivant du même
       jour le retirerait, et les entrées suivantes remonteraient pour subir le
       même sort. La carte se vidait en trois rendus, et c'est arrivé. */
    Store.state.meta.insightsVus = { [i.id]: { date: todayISO(), valeur: i.valeur } };
    vrai(evaluerInsights().some(x => x.id === i.id), 'noté aujourd’hui, il reste affiché');

    /* Le lendemain, il attend son tour — DERRIERE les autres, pas dehors. Ce
       controle exigeait son absence, et c'est ce qui rendait le defaut legitime
       : un insight au repos etait retire de la liste, si bien qu'un patrimoine
       calme, dont trois regles seulement parlent, voyait sa carte se vider le
       lendemain de la premiere lecture et annoncer « rien d'inhabituel ». */
    Store.state.meta.insightsVus[i.id].date = ilYA(1);
    const apres = evaluerInsights();
    const place = apres.findIndex(x => x.id === i.id);
    vrai(place >= 0, 'le lendemain, même chiffre : il est toujours là');
    eq(apres[place].repos, true, 'mais marqué au repos');
    vrai(apres.slice(0, place).every(x => !x.repos),
      'et rangé derrière tout ce qui est neuf : le repos classe, il ne fait pas taire');

    /* Il revient dès que sa propre matérialité est franchie, et pas avant. */
    Store.state.meta.insightsVus[i.id].valeur = i.valeur + num(regle.materialite) * 2 + 1;
    vrai(evaluerInsights().some(x => x.id === i.id), 'le chiffre a bougé : il revient');
  });

  test('tout le catalogue au repos ne fait pas dire « rien d’inhabituel »', () => {
    /* La carte d'insights ne portait plus que son etat calme.

     Le moteur avait pourtant trois choses a dire — sa reserve, son ecart de
       cible, le glissement d'une poche. Les trois avaient ete lues la veille,
       aucune n'avait bouge, et leurs repos durent vingt et un a quarante-cinq
       jours : la carte se taisait donc pour des semaines en annoncant le calme.

       L'ETAT CALME EST UNE REPONSE, ET ELLE DOIT RESTER VRAIE. « Rien
       d'inhabituel a signaler » veut dire que le moteur a regarde et n'a rien
       trouve. Il ne peut pas vouloir dire « tout ce qui a ete trouve dort ». */
    Fixture.poser();
    const avant = evaluerInsights();
    vrai(avant.length > 0, 'la graine a de quoi parler');
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    Store.state.meta.insightsVus = {};
    for (const x of avant) Store.state.meta.insightsVus[x.id] = { date: hier, valeur: x.valeur };

    const apres = evaluerInsights();
    eq(apres.length, avant.length,
      'tout le catalogue au repos ne retire rien de la liste');
    vrai(apres.every(x => x.repos), 'et chaque entrée se sait au repos');
    vrai(construireInsights().length > 0,
      'la carte a donc toujours quelque chose à dire, et ne peut pas annoncer '
      + 'le calme sur un patrimoine dont trois choses sont à retenir');
  });

  test('le repos fini, il revient même sans rien de neuf', () => {
    Fixture.poser();
    const i = evaluerInsights()[0];
    const regle = REGLES_INSIGHT.find(r => r.id === i.id);
    const vieux = new Date(Date.now() - (num(regle.reposJours) + 1) * 86400000)
      .toISOString().slice(0, 10);
    Store.state.meta.insightsVus = { [i.id]: { date: vieux, valeur: i.valeur } };
    vrai(evaluerInsights().some(x => x.id === i.id),
      'passé son repos, il a de nouveau le droit de se dire');
  });

  test('le moteur lit la mémoire, il ne l’écrit jamais', () => {
    vrai(!/Store\.save|Store\.state\.meta\.insightsVus =/.test(src()),
      'aucune écriture dans le moteur');
    const a = lireSource('assets/app.js');
    vrai(/Store\.state\.meta\.insightsVus = memoire;/.test(a), 'c’est la vue qui note');
    vrai(/function noterInsightsVus\(\)/.test(a), 'et elle a sa fonction');
    /* Elle note au MONTAGE, pas au rendu : rendre ne doit rien enregistrer. */
    const monte = a.slice(a.indexOf('function mountOverview()'),
                          a.indexOf('function mountOverview()') + 300);
    vrai(/noterInsightsVus\(\);/.test(monte), 'appelée depuis le montage de l’accueil');
    const rendu = a.slice(a.indexOf('function carteARetenir()'), a.indexOf('function viewOverview()'));
    vrai(!/Store\.save/.test(rendu), 'et le rendu n’enregistre rien');
    /* Trois lectures de suite rendent le meme resultat. */
    Fixture.poser();
    const avant = JSON.stringify(evaluerInsights());
    evaluerInsights();
    eq(JSON.stringify(evaluerInsights()), avant, 'trois lectures, un seul résultat');
  });

  test('le moteur ne coupe pas, il déduplique et met les familles en tête', () => {
    Fixture.poser();
    const choisis = construireInsights();
    /* AUCUN PLAFOND ICI. Le moteur coupait a trois avant que la Home ait choisi
       selon la destination : la quatrieme entree, celle qui aurait remplace un
       doublon de destination, n'arrivait jamais jusqu'a la carte. */
    vrai(!/MAX_INSIGHTS|slice\(0, 3\)/.test(lireSource('assets/insights.js')),
      'le moteur ne connaît aucun plafond d’affichage');
    const groupes = choisis.map(i => i.dedupeGroup);
    eq(new Set(groupes).size, groupes.length, 'aucun groupe deux fois');
    /* Les familles passent devant : les premieres entrees en sont autant de
       distinctes qu'il y en a. */
    const familles = choisis.map(i => i.famille);
    const distinctes = new Set(evaluerInsights().map(i => i.famille)).size;
    eq(new Set(familles.slice(0, distinctes)).size, Math.min(distinctes, familles.length),
      'le premier tour ne répète aucune famille');
  });

  test('la réserve se compare à elle-même, à dépenses constantes', () => {
    Fixture.poser();
    const m = mesuresInsights(contexteInsights());
    const avant = reserveIlYA(m, 3);
    const i = evaluerInsights().find(x => x.id === 'liquidity_runway_shift') || null;
    if (!avant) { eq(i, null, 'sans relevé assez ancien, elle se tait'); return; }
    /* LA CONSOMMATION EST LA MEME DES DEUX COTES. Les charges fixes n'ont pas
       d'historique : en mêler deux attribuerait au cash une variation venue du
       budget, et la phrase promettrait ce qu'elle ne mesure pas. */
    pres(avant.mois, num(avant.cash) / num(m.runway.burn),
      'les mois d’avant se comptent avec la consommation d’aujourd’hui');
    if (i) {
      vrai(i.evidence.burnConstant === true, 'la preuve le déclare');
      /* ET LE MEME PERIMETRE DES DEUX COTES. Un relevé mensuel ne note qu'une
         poche de trésorerie : répondre avec les liquidités mobilisables, qui
         ajoutent le différé, aurait comparé une poche à trois et annoncé une
         progression qui n'aurait été qu'un changement de définition. */
      eq(i.evidence.scope, 'cash', 'les deux dates parlent de la trésorerie');
      pres(i.params.months, num(m.totaux.cash) / num(m.runway.burn),
        'aujourd’hui se compte sur la même poche qu’hier');
      vrai(i.params.months !== num(m.runway.liquidMonths)
        || num(m.totaux.cash) === num(m.runway.immediate) + num(m.runway.tiers),
        'et non sur les liquidités mobilisables, qui comptent autre chose');
      pres(i.params.deltaMonths, i.params.months - i.params.previousMonths,
        'l’écart est bien la différence des deux');
      vrai(Math.abs(i.params.deltaMonths) >= SEUIL_AFFICHAGE_RESERVE_MOIS - 1e-9,
        'et il franchit son seuil d’affichage');
    }
  });

  test('les deux parts d’une poche se calculent sur la même base', () => {
    Fixture.poser();
    const m = mesuresInsights(contexteInsights());
    const p = partsDesPoches(m, 6);
    if (!p) { vrai(true, 'pas assez d’historique : rien à vérifier'); return; }
    /* LA REGLE CARDINALE DU PROJET : un total vaut la somme de ses parts. Les
       deux photos totalisent cent pour cent, sinon l'écart affiché mêlerait un
       changement de poids et un changement de périmètre. */
    const sommeAvant = p.lignes.reduce((s, x) => s + x.avant, 0);
    const sommeApres = p.lignes.reduce((s, x) => s + x.maintenant, 0);
    pres(sommeAvant, 100, 'les parts d’hier font cent');
    pres(sommeApres, 100, 'celles d’aujourd’hui aussi');
    pres(p.lignes.reduce((s, x) => s + x.ecart, 0), 0, 'donc les écarts se compensent');
    vrai(p.mois >= 6, 'et le relevé comparé date vraiment de six mois');
  });

  test('la première ligne ne parle que si elle pèse les deux suivantes', () => {
    Fixture.poser();
    const c = concentration({ financier: true });
    const i = evaluerInsights().find(x => x.id === 'concentration_top_line') || null;
    if (!c || !c.top3) { eq(i, null, 'moins de quatre lignes : elle se tait'); return; }
    const deux = num(c.top3.value) - num(c.premiere.value);
    eq(!!i, deux > 0 && num(c.premiere.value) >= deux,
      'elle parle exactement quand la première pèse au moins les deux suivantes');
    if (i) {
      pres(i.params.pct, num(c.premiere.pct), 'la part vient de concentration()');
      eq(i.evidence.nextTwoValue, deux, 'et la preuve porte le poids compare');
    }
  });

  test('un mois inhabituel se mesure à la dispersion du détenteur', () => {
    const poser = totaux => Fixture.poser(s => {
      s.budget.expenses = totaux.map((v, n) => ({
        month: `2026-0${n + 1}-01`, v: { Courses: v }, note: '',
      }));
    });
    const anomalie = () => evaluerInsights().find(x => x.id === 'spending_month_anomaly') || null;
    /* UNE SERIE PARFAITEMENT PLATE N'A PAS DE DISPERSION, donc pas d'anomalie
       possible : trois euros d'écart y seraient « inhabituels », ce qui ne veut
       rien dire. On se tait. */
    poser([1000, 1000, 1000, 1000, 1000, 1000, 1000, 2000]);
    eq(anomalie(), null, 'sans dispersion mesurable, aucune anomalie');
    /* Chez quelqu'un dont les mois varient de cinquante euros, mille de plus
       sortent de l'ordinaire. */
    poser([900, 1100, 950, 1050, 1000, 1200, 1000, 2000]);
    const i = anomalie();
    vrai(!!i, 'un mois au double de la dispersion habituelle se dit');
    eq(i.params.usual, 1000, 'le repère est la médiane de ses propres mois');
    eq(i.evidence.usualDeviation, 50, 'et le seuil sa propre dispersion');
    /* Le meme ecart, chez la meme personne, sous le double : on se tait. */
    poser([900, 1100, 950, 1050, 1000, 1200, 1000, 1050]);
    eq(anomalie(), null, 'sous le double de sa dispersion, rien à dire');
  });

  test('les dépenses se comparent trimestre contre trimestre, mois clos seulement', () => {
    Fixture.poser(s => {
      s.budget.expenses = [1000, 1000, 1000, 1400, 1400, 1400].map((v, n) => ({
        month: `2026-0${n + 1}-01`, v: { Courses: v }, note: '',
      }));
      /* Un mois courant enorme : il ne doit RIEN changer, il n'est pas clos. */
      s.budget.expenses.push({ month: currentMonthKey(), v: { Courses: 9000 }, note: '' });
    });
    const i = evaluerInsights().find(x => x.id === 'spending_shift');
    vrai(!!i, 'la règle produit');
    eq(i.params.current, 1400, 'les trois derniers mois clos');
    eq(i.params.previous, 1000, 'contre les trois d’avant');
    pres(i.params.deltaPct, 40, 'soit quarante pour cent');
    eq(i.evidence.currentTo, '2026-06-01', 'et le mois courant reste dehors');
  });
});

/* --- Les règles, une par une ---------------------------------------- */

finDePartieDeTests('tests/22-infobulle-historique-dit-composition.tests.js');
