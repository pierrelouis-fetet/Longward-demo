partieDeTests('tests/28-les-chiffres-se-lisent.tests.js');
/* ------------------------------------------------------------------
   Ce qui ne doit pas avoir l'air casse : un separateur de milliers qui se
   voit, un « de » elide, une encre qui se lit, une porte a toutes les
   largeurs, une cible qui recoit le doigt, et le grand chiffre qui part de
   son dernier releve. Montants fictifs.
   ------------------------------------------------------------------ */
suite('Les chiffres se lisent, les portes se trouvent', () => {
  const app = () => lireSource('assets/app.js') || '';
  const corps = (src, debut) => {
    const i = src.indexOf(debut);
    return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i) + 2);
  };

  test('aucun formateur ne rend l’espace fine que Windows efface', () => {
    /* Segoe UI dessine U+202F sur un ou deux pixels : « 1639 » au lieu de
       « 1 639 ». Le controle porte sur ce que les formateurs RENDENT, a des
       montants qui ont des milliers, et en francais, la ou l'espace existe. */
    enLangue('fr', () => {
      const sorties = [fmtEUR(12345.6), fmtEUR0(1234567), fmtPct(1234.5, 1), fmtCur(1234.5, 'USD'),
                       fmtNombre(12345), fmtSigned(-4321)];
      for (const s of sorties) {
        vrai(!String(s).includes('\u202f'), `« ${s} » porte encore U+202F`);
      }
      vrai(/1\u00a0234\u00a0567/.test(fmtEUR0(1234567)), 'les milliers se séparent par une espace insécable');
      vrai(fmtSigned(-4321).includes('−'), 'et le signe moins reste le signe typographique');
    });
    /* Le formateur des axes vit dans charts.js, que cette page ne charge pas :
       on tire sa definition de la source et on l'execute telle quelle, sur ses
       deux branches, le compact au-dessus de mille et l'entier en dessous. */
    const c = lireSource('assets/charts.js') || '';
    const i = c.indexOf('const kEur = v =>');
    const def = c.slice(i, c.indexOf('\n  };', i) + 5);
    vrai(i > 0 && def.length > 100, 'le formateur des axes doit être trouvable');
    const kEur = new Function('masqueActif', `${def}\nreturn kEur;`)(() => false);
    enLangue('fr', () => {
      for (const v of [1234, -98765, 1234567, 999, -845]) {
        const s = kEur(v);
        vrai(!String(s).includes('\u202f'), `l’axe écrit « ${s} » avec U+202F`);
      }
      vrai(kEur(-845).includes('−'), 'et son signe moins est le signe typographique');
    });
  });

  test('« de » s’élide devant un mois qui commence par une voyelle', () => {
    enLangue('fr', () => {
      eq(eliderDe('depuis le relevé de août 26'), 'depuis le relevé d’août 26', 'août');
      eq(eliderDe('Voir le relevé de oct. 25'), 'Voir le relevé d’oct. 25', 'octobre');
      eq(eliderDe('depuis le relevé de sept. 25'), 'depuis le relevé de sept. 25', 'une consonne garde « de »');
      eq(eliderDe('Entre tes relevés de avr. 26 et de août 26'),
        'Entre tes relevés d’avr. 26 et d’août 26', 'les deux mois d’une même phrase');
      eq(eliderDe('Écarts depuis le relevé de juin 26'), 'Écarts depuis le relevé de juin 26',
        '« depuis » ne se touche pas');
    });
    enLangue('en', () => {
      eq(eliderDe('since the de août statement'), 'since the de août statement', 'l’anglais ne s’élide pas');
    });
    const a = app();
    for (const cle of ['depuis le relevé de {m}', 'Voir le relevé de {m}', 'Entre tes relevés de {a} et de {b}',
                       'Écarts depuis le relevé de {m}']) {
      const i = a.indexOf(`trad('${cle}')`);
      vrai(i > 0, `${cle} doit être trouvable`);
      vrai(/eliderDe\($/.test(a.slice(Math.max(0, i - 9), i)), `« ${cle} » passe par eliderDe`);
    }
  });

  test('le grand chiffre part du dernier relevé, jamais de zéro', () => {
    Fixture.poser(e => {
      e.monthly = [
        { date: '2026-06-30', comment: '', dettes: 40000,
          v: { c_courant: 3000, c_livret: 2000, c_pea: 10000, c_cto: 700, c_immo: 118000, c_pe: 2000 } },
        { date: '2026-01-31', comment: '', dettes: 41000,
          v: { c_courant: 2500, c_livret: 2000, c_pea: 9000, c_cto: 650, c_immo: 117000, c_pe: 2000 } },
      ];
    });
    const dernier = historySeries({ includeNow: false }).find(p => p.date === '2026-06-30');
    vrai(dernier, 'le relevé le plus récent se lit');
    pres(departDefilementHeros(true), dernier.net, 'le net du relevé, face au net d’aujourd’hui');
    pres(departDefilementHeros(false), dernier.total, 'ses avoirs, face au brut');
    /* Un net negatif est une valeur connue : un achat recent finance a
       credit. Il sert de depart comme une autre. */
    Fixture.poser(e => {
      e.monthly = [{ date: '2026-06-30', comment: '', dettes: 150000,
        v: { c_courant: 3000, c_livret: 2000, c_pea: 10000, c_cto: 700, c_immo: 118000, c_pe: 2000 } }];
    });
    const negatif = historySeries({ includeNow: false })[0];
    vrai(negatif && negatif.net < 0, 'le relevé porte un net négatif');
    pres(departDefilementHeros(true), negatif.net, 'et il part de là');
    Fixture.poser(e => { e.monthly = []; });
    eq(departDefilementHeros(true), null, 'sans relevé, rien ne défile');
    Fixture.poser(e => { e.monthly = [{ date: '2026-06-30', comment: '', v: {} }]; });
    eq(departDefilementHeros(true), null, 'un relevé vide ne vaut pas zéro de départ');
    /* Les gardes vivent dans la vue, que cette page ne charge pas : on les lit. */
    const d = corps(app(), 'function defilerHeros(');
    vrai(/prefers-reduced-motion: reduce/.test(d), 'le mouvement réduit l’empêche');
    vrai(/montantsMasques/.test(d), 'les montants masqués aussi');
    vrai(/try \{[^}]*sessionStorage\.getItem/.test(d) && /try \{ sessionStorage\.setItem/.test(d),
      'le stockage de session se lit et s’écrit sous garde');
    vrai(d.indexOf('herosDejaDefile = true;\n  try { sessionStorage.setItem') > 0,
      'le drapeau en mémoire se pose au départ, avant le stockage qui peut échouer');
    vrai(/aria-hidden="true"/.test(d) && /class="hors-ecran"/.test(d),
      'le chiffre qui bouge se tait, le montant final se lit');
    vrai(!/fmtEUR0\(/.test(d.replace(/fmtEUR0Texte\(/g, '')), 'le texte qui défile est la variante texte');
  });

  test('sur bureau aussi, on déclare une personne et on lit sa part', () => {
    /* Le partage suit les deux presentations, et chaque bloc ouvert dans la
       carte s'y ferme : un `</div>` de trop fermerait la carte avant le
       tableau du bureau, qui flotterait alors hors d'elle. */
    const a = app().replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    const ouverture = '<div class="card" data-anchor="charges">';
    const debut = a.indexOf(ouverture) + ouverture.length;
    const fin = a.indexOf("trad('+ Personne')", debut);
    vrai(debut > ouverture.length && fin > debut, 'la carte des charges doit se relire');
    const carte = a.slice(debut, fin);
    const mobile = carte.slice(carte.indexOf('class="liste-mobile"'), carte.indexOf('class="table-wrap large-seulement"'));
    vrai(mobile.length > 100, 'la liste du téléphone précède le tableau');
    vrai(!/ajouter-personne|editer-personne/.test(mobile), 'le partage n’est plus réservé au téléphone');
    vrai(/editer-personne/.test(carte.slice(carte.indexOf('class="table-wrap large-seulement"'))),
      'il suit le tableau du bureau');
    const ouvertes = (carte.match(/<div\b/g) || []).length;
    const fermees = (carte.match(/<\/div>/g) || []).length;
    eq(fermees, ouvertes, 'dans la carte, chaque bloc ouvert se ferme, et aucun ne ferme la carte avant l’heure');
  });

  test('l’encre faible de la barre latérale se lit', () => {
    const lum = ([r, g, b]) => {
      const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const rgb = v => {
      const h = String(v).trim().match(/^#([0-9a-f]{6})$/i);
      return h ? [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16)) : null;
    };
    const contraste = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const jeton = n => rgb(getComputedStyle(document.documentElement).getPropertyValue(n));
    const memoire = document.documentElement.dataset.theme;
    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.dataset.theme = theme;
        const fond = jeton('--sidebar');
        /* Le bloc du patrimoine, dans la barre, pose un voile clair sur elle :
           son fond reel est ce voile compose sur la barre. */
        const voile = String(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-hover'))
          .match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/);
        vrai(voile, `${theme} : --sidebar-hover doit se lire`);
        const a = voile[4] == null ? 1 : +voile[4];
        const bloc = [1, 2, 3].map((k, n) => Math.round(+voile[k] * a + fond[n] * (1 - a)));
        for (const [nom, f] of [['la barre', fond], ['le bloc du patrimoine', bloc]]) {
          const faible = contraste(jeton('--sidebar-faible'), f);
          vrai(faible >= 4.5, `${theme} : --sidebar-faible sur ${nom} = ${faible.toFixed(2)}:1`);
          vrai(faible < contraste(jeton('--sidebar-muted'), f) - 0.5,
            `${theme} : et elle reste en retrait de --sidebar-muted sur ${nom}`);
        }
      }
    } finally {
      if (memoire) document.documentElement.dataset.theme = memoire;
      else delete document.documentElement.dataset.theme;
    }
  });

  test('une jauge qui s’ouvre se prend au doigt, sans prendre celui du voisin', () => {
    /* Huit pixels de trait : la zone du doigt couvre les marges de la jauge
       pour atteindre 24 px, et pas plus. On le prouve par l'appui : un point
       dans la marge touche la jauge, un point juste au-dela touche le voisin. */
    const boite = document.createElement('div');
    boite.style.cssText = 'position:fixed; left:0; top:0; width:340px; z-index:99999; background: var(--surface-1)';
    boite.innerHTML = `<div class="reeq-ligne">
        <span class="voisin-haut" style="display:block; height:20px">A</span>
        <button type="button" class="reeq-jauge ouvrable"><i class="reeq-reel" style="width:40%"></i></button>
        <span class="voisin-bas" style="display:block; height:20px">B</span></div>`;
    document.body.appendChild(boite);
    try {
      const j = boite.querySelector('.reeq-jauge');
      const r = j.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const au = y => document.elementFromPoint(x, y);
      vrai(au(r.top - 7) === j && au(r.bottom + 7) === j, 'la marge de la jauge reçoit l’appui');
      vrai(au(r.top - 9) && au(r.top - 9).classList.contains('voisin-haut'), 'le voisin du dessus garde le sien');
      vrai(au(r.bottom + 9) && au(r.bottom + 9).classList.contains('voisin-bas'), 'celui du dessous aussi');
    } finally { boite.remove(); }
  });

  test('le chevron des rôles se prend au doigt sur téléphone', () => {
    if (!matchMedia('(max-width: 900px)').matches) return;
    const boite = document.createElement('div');
    boite.style.cssText = 'position:fixed; left:40px; top:40px; z-index:99999; background: var(--surface-1)';
    boite.innerHTML = '<button class="chevron-role" data-action="scinder-classe">›</button>';
    document.body.appendChild(boite);
    try {
      const c = boite.querySelector('.chevron-role');
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (const [dx, dy] of [[20, 0], [-20, 0], [0, 20], [0, -20]]) {
        eq(document.elementFromPoint(cx + dx, cy + dy), c, `à ${dx}, ${dy} px du centre, l’appui touche le chevron`);
      }
      vrai(r.width < 30, 'et son dessin reste petit');
    } finally { boite.remove(); }
  });

  test('des parts à l’euro refont leur total à l’euro', () => {
    const somme = l => l.reduce((a, b) => a + b, 0);
    eq(JSON.stringify(arrondirParts([])), '[]', 'une liste vide');
    eq(JSON.stringify(arrondirParts([0, 0])), '[0,0]', 'des zéros restent des zéros');
    /* Trois tiers de 100 : chacun s'arrondit a 33, le total a 100 ; l'euro
       manquant va a la premiere, a egalite d'erreur. */
    const tiers = arrondirParts([100 / 3, 100 / 3, 100 / 3]);
    eq(JSON.stringify(tiers), '[34,33,33]', 'l’euro manquant va à la première');
    eq(somme(tiers), 100, 'et la somme vaut le total arrondi');
    /* Le demi-euro s'eloigne de zero, comme fmtEUR0. */
    eq(JSON.stringify(arrondirParts([0.5, 0.5])), '[0,1]', 'deux demi-euros font un euro, pas deux');
    eq(JSON.stringify(arrondirParts([2.5])), '[3]', 'un demi-euro s’arrondit loin de zéro');
    eq(JSON.stringify(arrondirParts([-2.5])), '[-3]', 'des deux côtés de zéro');
    /* Des signes mixtes : ni +1 ni -1 pour deux parts qui s'annulent. */
    eq(JSON.stringify(arrondirParts([0.49, -0.49])), '[0,0]', 'deux quasi-zéros opposés restent à zéro');
    const mixte = arrondirParts([120000.4, -40000.4, 5000.4]);
    eq(somme(mixte), Math.round(120000.4 - 40000.4 + 5000.4), 'une dette dans la liste, et la somme tient');
    /* Des montants de centimes, comme un tableau d'Allocation. */
    const v = [14965.0, 45989.41, 2596.7, 3000.0];
    const r = arrondirParts(v);
    eq(somme(r), Math.round(somme(v)), 'les parts affichées refont le pied affiché');
    /* Une part negligeable masquee par l'ecran : les parts visibles visent le
       total affiche. */
    eq(JSON.stringify(arrondirParts([0.499], 0.503)), '[1]', 'la part visible vise le total qui compte la part masquée');
    eq(JSON.stringify(arrondirParts([0.25, 0.25], 0.503)), '[1,0]', 'à plusieurs aussi');
    /* Au-dela d'un euro d'ecart, ce n'est plus un arrondi : rien ne se maquille. */
    eq(JSON.stringify(arrondirParts([100], 250)), '[100]', 'une part qui manque ne se cache pas dans les autres');
    vrai(r.every((x, i) => Math.abs(x - v[i]) < 1), 'et aucune ne s’écarte d’un euro ou plus');
  });

  test('l’étiquette de la démonstration ne se montre que sur elle', () => {
    /* Aucune ecriture dans le stockage du navigateur : le mode exemple se lit
       la ou il se decide, dans la source. */
    const avant = Store.state;
    try {
      Store.state = structuredClone(SEED); Store.migrate(); refreshAccounts();
      /* La beta et l'arbre prive n'ont pas de `SEED_VERSION` : leur graine est
         vide ou n'est pas une demonstration, et rien ne s'y etiquette. */
      if (typeof SEED_VERSION === 'undefined') {
        eq(etiquetteDemoVisible(), false, 'sans graine de démonstration, aucune étiquette');
      } else if (!modeDemo()) {
        vrai(etiquetteDemoVisible(), 'la démonstration publique porte son étiquette');
      }
      Store.state = blankState(); Store.migrate();
      eq(etiquetteDemoVisible(), false, 'un patrimoine à soi ne la porte pas');
    } finally {
      Store.state = avant; refreshAccounts();
    }
    vrai(/const etiquetteDemoVisible = \(\) => estDemoVivante\(\) && !modeDemo\(\);/
      .test(lireSource('assets/store.js') || ''), 'le mode exemple, qui a déjà son bandeau, ne la porte pas');
    /* Le rendu la pose et la retire a chaque passage, et la meme garde cache
       Profil et la deconnexion sans compte : la page ne charge pas la vue, on
       lit donc le rendu dans la source. */
    const src = lireSource('assets/app.js') || '';
    vrai(/for \(const e of \$\$\('\.etiquette-demo'\)\) e\.hidden = !etiquetteDemoVisible\(\);/.test(src),
      'chaque rendu pose l’étiquette');
    vrai(/const compte = !!\(typeof CloudSync !== 'undefined' && CloudSync\.getUserId\(\)\);/.test(src)
      && /#nav a\[data-view="profil"\]'\)\) lien\.hidden = !compte;/.test(src)
      && /sortie\.hidden = !compte;/.test(src), 'Profil et la déconnexion suivent le compte, ensemble');
    eq(I18N.en['Exemple fictif'], 'Fictional example', 'et l’étiquette se traduit');
  });

  test('la bulle de la courbe refait son total à l’euro', () => {
    /* charts.js ne se charge pas ici : on verifie que la bulle passe ses
       montants par `arrondirParts`, dans ses deux variantes, et le cas que
       l'arrondi un par un fausserait. */
    const c = lireSource('assets/charts.js') || '';
    vrai(/const euros = arrondirParts\(lignes\.map\(sr => p\[sr\.key\] \|\| 0\), totals\[i\]\);/.test(c),
      'la bulle arrondit ses séries ensemble');
    eq((c.match(/<b>\$\{fmtEUR0\(euros\[k\]\)\}<\/b>/g) || []).length, 2, 'dans ses deux variantes');
    const e = arrondirParts([0.5, 0.5]);
    eq(e[0] + e[1], 1, 'deux séries de 0,50 € font 1 € sous un total de 1 €');
  });
});

finDePartieDeTests('tests/28-les-chiffres-se-lisent.tests.js');
