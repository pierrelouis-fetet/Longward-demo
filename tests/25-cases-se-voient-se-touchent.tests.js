partieDeTests('tests/25-cases-se-voient-se-touchent.tests.js');
/* ------------------------------------------------------------------
   Les cases : un bouton desactive se tait, le doigt atteint sa cible
   sans toucher la voisine, le clavier se voit, l'encre se lit sur le
   fond qu'elle a vraiment, et l'apercu de vente parle une seule langue.
   ------------------------------------------------------------------ */
suite('Les cases se voient, se touchent et se lisent', () => {
  const css = () => (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const app = () => lireSource('assets/app.js') || '';
  /* Les cibles tactiles valent au telephone et sous un doigt, a toute largeur. */
  const telephone = () => matchMedia('(max-width: 900px), (pointer: coarse)').matches;

  /* Decoupe une liste de selecteurs ou un selecteur en morceaux, sans couper
     a l'interieur des parentheses : `:is(a, b)` reste entier. */
  const decouper = (s, sep) => {
    const out = []; let prof = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') prof++;
      if (ch === ')') prof--;
      if (prof === 0 && sep.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  /* La zone qui recoit le doigt : la boite de l'element, agrandie de son
     `::after` quand il deborde en absolu. Le pseudo-element se pose sur la
     boite interieure, bordure exclue : c'est d'elle que partent ses decalages. */
  const zone = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const bord = c => parseFloat(s[`border${c}Width`]) || 0;
    const i = { l: r.left + bord('Left'), t: r.top + bord('Top'), r: r.right - bord('Right'), b: r.bottom - bord('Bottom') };
    const z = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    const a = getComputedStyle(el, '::after');
    if (a.content !== 'none' && a.position === 'absolute') {
      const px = v => (v === 'auto' ? null : parseFloat(v));
      const [L, T, R, B] = [a.left, a.top, a.right, a.bottom].map(px);
      if (L != null) z.l = Math.min(z.l, i.l + L);
      if (R != null) z.r = Math.max(z.r, i.r - R);
      if (T != null) z.t = Math.min(z.t, i.t + T);
      if (B != null) z.b = Math.max(z.b, i.b - B);
    }
    return { ...z, w: z.r - z.l, h: z.b - z.t };
  };
  const monter = html => {
    const boite = document.createElement('div');
    boite.style.cssText = 'position:fixed; left:0; top:0; width:340px; z-index:99999';
    boite.innerHTML = html;
    document.body.appendChild(boite);
    return boite;
  };

  /* -- B1. L'etat desactive ------------------------------------------ */

  test('un bouton désactivé ne s’allume ni au survol ni à l’appui', () => {
    /* Toute regle qui change l'aspect d'un `.btn` sous la souris ou le doigt
       exclut le bouton desactive. La liste n'est pas tenue a la main : on lit
       chaque selecteur de la feuille. */
    const fautes = [];
    for (const m of css().matchAll(/([^{}]+)\{/g)) {
      const prelude = m[1].trim();
      if (!prelude || prelude.startsWith('@')) continue;
      for (const sel of decouper(prelude, /,/)) {
        for (const morceau of decouper(sel, /[\s>+~]/)) {
          if (/\.btn(?![\w-])/.test(morceau) && /:(hover|active)/.test(morceau)
              && !/:not\(:disabled\)/.test(morceau)) fautes.push(sel);
        }
      }
    }
    eq(fautes.join(' | '), '', 'un bouton désactivé qui réagit promet un geste qu’il refusera');
  });

  test('désactivé, il pâlit et le curseur le dit', () => {
    const boite = monter('<button class="btn" disabled>A</button><button class="btn en-cours" disabled>B</button>');
    try {
      const [a, b] = boite.querySelectorAll('button');
      eq(getComputedStyle(a).opacity, '0.45', 'plus pâle');
      eq(getComputedStyle(a).cursor, 'not-allowed', 'et le curseur refuse');
      eq(getComputedStyle(b).opacity, '0.55', 'la synchronisation garde sa propre atténuation');
    } finally { boite.remove(); }
  });

  test('aucun bouton ne se dit désactivé sans l’être', () => {
    /* `aria-disabled` ne bloque rien : une ancre ainsi marquee resterait
       cliquable. Les boutons desactives sont tous des `<button disabled>`. */
    vrai(!/aria-disabled=["']true/.test(app()), 'aria-disabled="true" n’apparaît dans aucun rendu');
  });

  /* -- B2. Les cibles tactiles ---------------------------------------- */

  test('au téléphone, les familles de commandes atteignent leur cible', () => {
    const tel = css().slice(css().indexOf('@media (max-width: 900px)'));
    vrai(/\.retour \{[^}]*width: 44px; height: 44px;[^}]*margin: 0 0 0 -5px;/.test(css()),
      'le retour : une vraie boîte de 44, qui ne recouvre pas la marque');
    vrai(/select\.annee \{ min-height: 44px; \}/.test(tel), 'un <select> grandit pour de vrai');
    vrai(/\.plage select\.annee \{ min-height: 36px; \}/.test(tel), 'sauf parmi les segments, à leur hauteur');
    if (!telephone()) return;
    const boite = monter(`<div class="card">
        <button class="btn sm">Un</button>
        <span class="segmented"><button>A</button><button>B</button></span>
        <button class="btn icon xs">✕</button>
        <button class="lien-vue">Voir</button> <button class="lien-nu">Lien</button>
        <button class="mois-lien">Mai</button> <i class="col-aide" tabindex="0" role="button">?</i>
        <span class="aide" role="button" tabindex="0">?</span>
        <select class="annee"><option>2026</option></select></div>`);
    try {
      const q = s => boite.querySelector(s);
      for (const s of ['.btn.sm', '.segmented button']) vrai(zone(q(s)).h >= 43.5, `${s} : ${Math.round(zone(q(s)).h)} px de haut`);
      for (const s of ['.btn.icon.xs', '.lien-vue', '.lien-nu', '.mois-lien', '.col-aide']) {
        const z = zone(q(s));
        vrai(z.w >= 43.5 && z.h >= 43.5, `${s} : ${Math.round(z.w)}x${Math.round(z.h)}`);
      }
      const z = zone(q('.aide'));
      vrai(z.w >= 43.5 && z.h >= 24, `.aide : ${Math.round(z.w)}x${Math.round(z.h)}, 44 de large et 24 au moins de haut`);
      vrai(q('select.annee').getBoundingClientRect().height >= 43.5, 'le <select> mesure 44');
    } finally { boite.remove(); }
  });

  test('deux commandes voisines se partagent l’écart, sans le mordre', () => {
    if (!telephone()) return;
    /* Le rappel : "Plus tard" puis la croix. Le milieu de l'ecart est la
       frontiere, et la croix, derniere, deborde du cote libre. */
    const boite = monter(`<div class="note"><span class="rappel-sorties">
        <button class="btn sm ghost">Plus tard</button><button class="btn icon xs">✕</button></span></div>
      <div class="pas-actes" style="grid-template-columns: 1fr"><button class="btn">Un</button><button class="btn">Deux</button></div>
      <dl class="kv"><dt>Un <span class="aide" role="button" tabindex="0">?</span></dt><dd>1</dd>
        <dt>Deux <span class="aide" role="button" tabindex="0">?</span></dt><dd>2</dd></dl>
      <dl class="kv" style="font-size: 9px; line-height: 1"><dt>Un <span class="aide" role="button" tabindex="0">?</span></dt><dd>1</dd>
        <dt>Deux <span class="aide" role="button" tabindex="0">?</span></dt><dd>2</dd></dl>
      <dl class="ptf-compo" style="font-size: 9px; line-height: 1"><dt><button type="button" class="ptf-compo-lien">Placements</button></dt><dd>1</dd>
        <dt><button type="button" class="ptf-compo-lien">Espèces</button></dt><dd>2</dd></dl>`);
    try {
      const [plus, croix] = boite.querySelectorAll('.rappel-sorties .btn');
      const milieu = (plus.getBoundingClientRect().right + croix.getBoundingClientRect().left) / 2;
      vrai(Math.abs(zone(plus).r - milieu) < 0.6, `« Plus tard » s’arrête au milieu (${zone(plus).r} / ${milieu})`);
      vrai(Math.abs(zone(croix).l - milieu) < 0.6, `la croix commence au milieu (${zone(croix).l} / ${milieu})`);
      vrai(zone(croix).w >= 43.5 && zone(croix).h >= 43.5,
        `la croix : ${Math.round(zone(croix).w)}x${Math.round(zone(croix).h)}`);
      const [un, deux] = boite.querySelectorAll('.pas-actes .btn');
      vrai(zone(un).b <= zone(deux).t + 0.5, 'deux boutons empilés : les halos se touchent sans se recouvrir');
      /* La police de la machine change la hauteur d'une ligne : la plus petite
         imaginable ne doit pas rapprocher deux "?" au point de les faire se
         recouvrir. */
      for (const liste of boite.querySelectorAll('.kv')) {
        const [a1, a2] = liste.querySelectorAll('.aide');
        vrai(zone(a1).b <= zone(a2).t + 0.5,
          `deux « ? » de rangées voisines ne se recouvrent pas (${Math.round(zone(a1).b)} / ${Math.round(zone(a2).t)})`);
      }
      const [l1, l2] = boite.querySelectorAll('.ptf-compo-lien');
      vrai(zone(l1).h >= 40 && zone(l2).h >= 40, `un lien de composition : ${Math.round(zone(l1).h)} px de haut`);
      vrai(zone(l1).b <= zone(l2).t + 0.5, 'et deux rangées voisines ne se recouvrent pas');
    } finally { boite.remove(); }
  });

  test('dans une carte cliquable, le « ? » garde sa zone et la carte le reste', () => {
    if (!telephone()) return;
    const boite = monter(`<div class="card card-cliquable">
        <button type="button" class="card-couvre" aria-label="Carte"></button>
        <div class="card-head"><h2>Un titre <span class="aide" role="button" tabindex="0">?</span></h2></div>
        <p>Un corps de carte assez long pour occuper la place.</p></div>`);
    try {
      const aide = boite.querySelector('.aide');
      const z = zone(aide);
      const a = (x, y) => document.elementFromPoint(x, y);
      const cx = (z.l + z.r) / 2, cy = (z.t + z.b) / 2;
      vrai(a(cx, z.t + 1)?.closest('.aide') === aide, 'juste dans la zone, en haut : l’aide');
      vrai(a(cx, z.b - 1)?.closest('.aide') === aide, 'en bas');
      vrai(a(z.l + 1, cy)?.closest('.aide') === aide, 'à gauche');
      vrai(a(z.r - 1, cy)?.closest('.aide') === aide, 'à droite');
      vrai(a(cx, z.b + 1)?.classList.contains('card-couvre'), 'juste dehors : la carte');
      vrai(a(z.r + 1, cy)?.classList.contains('card-couvre'), 'à droite aussi');
    } finally { boite.remove(); }
  });

  test('une tablette tactile reçoit les mêmes cibles qu’un téléphone', () => {
    /* A 1024 px, une tablette prend la mise en page de l'ordinateur ; son
       doigt n'est pas plus fin pour autant. */
    const c = css();
    const i = c.indexOf('@media (max-width: 900px), (pointer: coarse) {');
    vrai(i > 0, 'le bloc des cibles vaut aussi sous un pointeur grossier');
    const bloc = c.slice(i);
    for (const r of ['.btn-rond::after {', '.aide::after { inset:', 'select.annee { min-height: 44px; }',
                     '.rappel-sorties { gap: 12px; }'])
      vrai(bloc.includes(r), `« ${r} » est dans ce bloc`);
  });

  test('le survol n’efface pas l’anneau du clavier', () => {
    /* Un pointeur pose sur le "?" au moment ou Tab l'atteint : la regle de
       survol venait apres celle du focus, a specificite egale, et retirait
       l'anneau. */
    for (const sel of ['.aide:hover', '.col-aide:hover']) {
      const r = (css().match(new RegExp(sel.replace(/[.]/g, '\\.') + ' \\{([^}]*)\\}')) || [])[1];
      vrai(r != null && !/outline: none/.test(r), `${sel} ne pose plus outline: none`);
    }
  });

  test('les halos du téléphone : l’inventaire', () => {
    const tel = css().slice(css().indexOf('@media (max-width: 900px)'));
    vrai(/\.rappel-sorties \{ gap: 12px; \}/.test(tel), 'le rappel écarte ses sorties de 12 px');
    vrai(/\.rappel-sorties > \.btn:not\(:last-child\)::after \{ right: -7px; \}/.test(tel)
      && /\.rappel-sorties > \.btn:not\(:first-child\)::after \{ left: -7px; \}/.test(tel),
      'chacun en prend la moitié');
    vrai(/\.card-head \{ flex-wrap: wrap; gap: 10px; \}/.test(tel), 'un en-tête qui passe à la ligne garde 10 px');
    vrai(/\.kv \{[^}]*gap: 10px; \}/.test(tel), 'une liste clé-valeur garde 10 px entre ses rangées');
  });

  /* -- B3. Le focus --------------------------------------------------- */

  test('le « ? » de colonne reçoit l’anneau commun au clavier', () => {
    const r = (css().match(/\.col-aide:focus-visible \{([^}]*)\}/) || [])[1] || '';
    vrai(/outline: 2px solid var\(--accent\); outline-offset: 2px;/.test(r), 'l’anneau de l’application');
    vrai(!/outline: none/.test(r), 'et plus de filet pointillé à la place');
  });

  /* -- B4. Le contraste, sur le fond vraiment peint -------------------- */

  const toile = document.createElement('canvas');
  toile.width = toile.height = 1;
  const cx = toile.getContext('2d', { willReadFrequently: true });
  const peindre = couches => {
    cx.globalAlpha = 1; cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, 1, 1);
    for (const [c, alpha] of couches) { cx.globalAlpha = alpha; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); }
    cx.globalAlpha = 1;
    return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const rapport = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  /* Les fonds de l'element et de ses ancetres, du plus lointain au plus
     proche, jusqu'a la sonde, qui porte la surface d'une carte ; `fondEnPlus`
     ajoute l'etat survole. Au-dela, le corps de la page change de theme avec
     une transition : sa couleur calculee serait encore l'ancienne. */
  const fonds = (el, fondEnPlus) => {
    const f = [];
    for (let n = el; n; n = n.parentElement) {
      const b = getComputedStyle(n).backgroundColor;
      if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') f.unshift([b, 1]);
      if (n.classList.contains('sonde-contraste')) break;
    }
    if (fondEnPlus) f.push([fondEnPlus, 1]);
    return f;
  };
  const mesurer = (el, { opacite, fondEnPlus } = {}) => {
    const f = fonds(el.parentElement, fondEnPlus);
    let o = opacite ?? 1;
    if (opacite == null) for (let n = el; n; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    return rapport(peindre([...f, [getComputedStyle(el).color, o]]), peindre(f));
  };

  test('l’encre se lit sur le fond qu’elle a vraiment, dans les deux thèmes', () => {
    const memoire = document.documentElement.dataset.theme;
    const boite = monter(`<div class="sonde-contraste" style="background: var(--surface-1)">
      <style>.sonde-contraste, .sonde-contraste * { transition: none !important; animation: none !important; }</style>
      <aside class="sidebar" style="position:static; transform:none"><span class="saved">Sauvegardé</span>
        <span class="saved flash">Sauvegardé</span></aside>
      <div class="card"><table><tbody><tr class="mois-attendu"><td><span class="marque-attendu">●</span></td></tr></tbody></table></div>
      <div class="popover-notifs" style="position:static; animation:none"><div class="notif-ligne">
        <button type="button" class="btn icon xs notif-x">✕</button></div></div></div>`);
    const fautes = [];
    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.dataset.theme = theme;
        const q = s => boite.querySelector(s);
        const surface2 = getComputedStyle(document.documentElement).getPropertyValue('--surface-2').trim();
        const cas = [
          ['.saved au repos', mesurer(q('.saved:not(.flash)')), 4.5],
          ['.saved.flash', mesurer(q('.saved.flash')), 4.5],
          ['.marque-attendu sur sa rangée ambrée', mesurer(q('.marque-attendu')), 4.5],
          /* La croix : visible au doigt, et sur la ligne survolee avec une souris. */
          ['.notif-x', mesurer(q('.notif-x'), { opacite: 1 }), 3],
          ['.notif-x sur la ligne survolée', mesurer(q('.notif-x'), { opacite: 1, fondEnPlus: surface2 }), 3],
        ];
        for (const [nom, r, seuil] of cas) if (!(r >= seuil)) fautes.push(`${theme} : ${nom} = ${r.toFixed(2)}:1`);
      }
    } finally {
      boite.remove();
      if (memoire) document.documentElement.dataset.theme = memoire;
      else delete document.documentElement.dataset.theme;
    }
    eq(fautes.join(' | '), '', 'sous le seuil, une indication ne se lit pas');
  });

  test('la croix d’une notification ne pâlit plus', () => {
    const c = css();
    vrai(/\.notif-x \{ margin: 6px 5px 0 0; flex: none; \}/.test(c), 'opaque au doigt');
    vrai(/\.notif-ligne:hover \.notif-x, \.notif-x:focus-visible \{ opacity: 1; \}/.test(c),
      'et entière sur la ligne survolée ou au clavier');
    vrai(/\.notif-reglages \{ flex: none; padding: 2px 4px; \}/.test(c), 'la roue des réglages, de même');
  });

  /* -- B5. L'apercu de vente ------------------------------------------ */

  test('l’aperçu de vente ne laisse aucun mot hors de trad()', () => {
    const a = app();
    const debut = a.indexOf("const nom = $('#vePasNom').value.trim();");
    const fin = a.indexOf('</div>`;\n    };', debut);
    vrai(debut > 0 && fin > debut, 'le rendu de l’aperçu doit être trouvable');
    const bloc = a.slice(debut, fin);
    /* Ce que le gabarit affiche en dur : le texte hors des `${...}` et hors des
       balises. Il ne reste que des signes. */
    let texte = '', i = 0;
    const gabarits = bloc.match(/`[\s\S]*?`/g) || [];
    for (const g of gabarits) {
      let prof = 0;
      for (i = 1; i < g.length - 1; i++) {
        if (g[i] === '$' && g[i + 1] === '{') { prof++; i++; continue; }
        if (prof) { if (g[i] === '{') prof++; else if (g[i] === '}') prof--; continue; }
        texte += g[i];
      }
    }
    texte = texte.replace(/<[^>]*>/g, ' ');
    vrai(!/[A-Za-zÀ-ÿ]{2,}/.test(texte), `du texte en dur : « ${texte.replace(/\s+/g, ' ').trim()} »`);
    for (const k of ['Plus-value de {m}', 'Moins-value de {m}', 'Tu n’as que {n} action sur cette ligne.',
                     'Tu n’as que {n} actions sur cette ligne.', 'Indique combien d’actions tu vends.',
                     'Encaissé {m} · prix de revient {p}',
                     'La ligne sera retirée du tableau, la vente reste au journal.',
                     'Il te restera {n} action.', 'Il te restera {n} actions.',
                     'Repousse ce rappel de {n} jours']) {
      vrai(!!I18N.en[k], `« ${k} » est traduite`);
      vrai(a.includes(`'${k}'`), `« ${k} » est bien celle que le rendu demande`);
    }
    eq(I18N.en['Il te restera {n} actions.'], 'You will have {n} shares left.', 'le pluriel reste un pluriel');
  });
});

finDePartieDeTests('tests/25-cases-se-voient-se-touchent.tests.js');
