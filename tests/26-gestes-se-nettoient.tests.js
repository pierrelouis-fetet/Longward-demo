partieDeTests('tests/26-gestes-se-nettoient.tests.js');
/* ------------------------------------------------------------------
   Les animations : un geste ne laisse rien derriere lui, un appui ne
   s'accuse qu'une fois, une fenetre repart de son etat.
   ------------------------------------------------------------------ */
suite('Les gestes se nettoient, les appuis s’accusent une fois', () => {
  const app = () => lireSource('assets/app.js') || '';
  const css = () => (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const corps = (src, debut) => {
    const i = src.indexOf(debut);
    return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i) + 2);
  };
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  /* Les deux outils vivent dans la vue, que cette page ne charge pas : on les
     tire de la source et on les execute tels quels. */
  const outil = nom => {
    const src = corps(app(), `function ${nom}(`);
    vrai(src.length > 50, `${nom} doit être trouvable`);
    return new Function('minuteursAccuse', `${src}\nreturn ${nom};`)(new WeakMap());
  };

  test('un second appui rejoue l’accusé en entier', async () => {
    const rejouerClasse = outil('rejouerClasse');
    const el = document.createElement('span');
    rejouerClasse(el, 'x', 60);
    await attendre(30);
    rejouerClasse(el, 'x', 60);
    await attendre(45);
    vrai(el.classList.contains('x'), 'le délai du premier appui ne coupe pas le second');
    await attendre(45);
    vrai(!el.classList.contains('x'), 'et le second retire la classe à son tour');
  });

  test('la fin d’un geste attend SA transition, et ne laisse aucun écouteur', async () => {
    const nettoyerApres = outil('nettoyerApres');
    const el = document.createElement('div');
    const enfant = document.createElement('button');
    el.appendChild(enfant);
    document.body.appendChild(el);
    try {
      el.style.transition = 'transform .2s'; el.style.willChange = 'transform';
      let fois = 0;
      nettoyerApres(el, 80, () => fois++);
      const fin = (cible, propertyName) => cible.dispatchEvent(new TransitionEvent('transitionend', { propertyName, bubbles: true }));
      fin(enfant, 'transform');
      eq(el.style.transition, 'transform 0.2s', 'la transition d’un enfant ne compte pas');
      fin(el, 'opacity');
      eq(el.style.willChange, 'transform', 'ni une autre propriété');
      fin(el, 'transform');
      eq(el.style.transition, '', 'la sienne retire la transition');
      eq(el.style.willChange, '', 'et will-change');
      eq(fois, 1, 'une fois');
      el.style.transition = 'transform .2s';
      fin(el, 'transform');
      await attendre(100);
      eq(fois, 1, 'ni l’écouteur ni le repli ne survivent au nettoyage');
      eq(el.style.transition, 'transform 0.2s', 'et le geste suivant garde ce qu’il pose');
    } finally { el.remove(); }
  });

  test('sans transition, un repli nettoie quand même', async () => {
    const nettoyerApres = outil('nettoyerApres');
    const el = document.createElement('div');
    el.style.transition = 'none'; el.style.willChange = 'transform';
    let fois = 0;
    const toutDeSuite = nettoyerApres(el, 40, () => fois++);
    await attendre(60);
    eq(el.style.transition + el.style.willChange, '', 'un simple toucher ne laisse rien en ligne');
    toutDeSuite();
    eq(fois, 1, 'et le nettoyage ne se rejoue pas');
  });

  test('l’onglet courant ne s’accuse qu’une fois', () => {
    const a = app();
    const i = a.indexOf("$('#tabbar')?.addEventListener('click'");
    const barre = a.slice(i, a.indexOf("rejouerClasse(lien, 'rebond', 420);", i) + 40);
    vrai(barre.length > 200, 'l’écouteur de la barre doit être trouvable');
    vrai(/if \(lien\.getAttribute\('href'\) !== location\.hash\) rejouerClasse\(e\.currentTarget, 'tape', 400\);/.test(barre),
      'la barre ne se tasse que si le lien mène ailleurs');
    vrai(/rejouerClasse\(lien, 'rebond', 420\);/.test(barre), 'l’icône rebondit sur place');
    vrai(!/setTimeout\(\(\) => (lien|barre)\.classList\.remove/.test(barre), 'et aucun délai à part ne coupe un accusé');
  });

  test('une ligne de compte repart d’où elle est, et le geste se nettoie', () => {
    const f = corps(app(), 'function monteSwipeComptes(');
    const lit = f.indexOf('getComputedStyle(ligne).transform');
    const coupe = f.indexOf("ligne.style.transition = 'none';");
    vrai(lit > 0 && coupe > lit, 'la position animée se lit avant de couper la transition');
    vrai(/if \(finDeRetour\) finDeRetour\(\);/.test(f), 'le nettoyage du geste précédent passe avant');
    vrai(/const position = \(\) => Math\.min\(0, origine \+ dx\);/.test(f), 'le glissement part de cette origine');
    vrai(/finDeRetour = nettoyerApres\(ligne, 300,/.test(f), 'la fin du geste retire transition et will-change');
    vrai(!/transitionend/.test(f), 'sans écouteur à part');
  });

  test('la feuille ne garde aucun style en ligne, et part d’où on la lâche', () => {
    const f = corps(app(), 'function monteGlissementFermeture(');
    vrai(/if \(axe === 'defile'\) \{ depart = null; panneau\.style\.transition = ''; panneau\.style\.willChange = ''; return; \}/.test(f),
      'un geste rendu au défilement retire sa transition');
    vrai(/if \(depart === null\) \{ axe = null; panneau\.style\.transition = ''; panneau\.style\.willChange = ''; return; \}/.test(f),
      'et le relâchement sans geste aussi');
    vrai(/panneau\.style\.transition = 'none';\s*\n\s*panneau\.style\.willChange = '';\s*\n\s*croix\.click\(\);/.test(f),
      'la fermeture ne remet pas la feuille en place');
    vrai(/retourEnCours = true;\s*\n\s*nettoyerApres\(panneau, 260, \(\) => \{ retourEnCours = false; \}\);/.test(f),
      'le retour se nettoie');
    vrai(/if \(e\.touches\.length !== 1 \|\| retourEnCours\) return;/.test(f), 'et un geste attend la fin du retour');
    vrai(/const relacher = \(\) => \{[^]*?\n\s*if \(retourEnCours\) return;\n\s*if \(trame\)/.test(f),
      'et son relâchement ne coupe pas le retour en cours');
    const m = corps(app(), 'function montrerModal(');
    vrai(/for \(const p of \['transition', 'transform', 'opacity', 'willChange'\]\) panneau\.style\[p\] = '';/.test(m),
      'une fenêtre rouverte part de son état CSS');
    /* La sortie part de la position lachee parce qu'elle n'a pas d'image de
       depart : en ajouter une la ferait repartir d'en haut. */
    for (const nom of ['feuille-sort', 'modal-sort']) {
      const k = (css().match(new RegExp(`@keyframes ${nom} \\{([^}]*\\}[^}]*)\\}`)) || [])[1] || '';
      vrai(/^\s*to \{/.test(k) && !/\bfrom\b|(^|[\s{,])0%/.test(k), `@keyframes ${nom} n’a qu’une image d’arrivée`);
    }
  });

  test('la hauteur du détail du jour reste animée, et la mesure le dit', () => {
    const a = app();
    vrai(/ANIMER LA HAUTEUR COUTE PEU, ET C'EST MESURE\./.test(a), 'la raison est écrite');
    vrai(/La peinture de\s*\n\s*ce qui descend, elle, n'a pas ete mesuree\./.test(a), 'et ce qui n’a pas été mesuré aussi');
  });
});

finDePartieDeTests('tests/26-gestes-se-nettoient.tests.js');
