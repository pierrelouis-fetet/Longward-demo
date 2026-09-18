/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const Charts = (() => {

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function ink() {
    return {
      grid:     cssv('--grid'),
      axis:     cssv('--axis'),
      muted:    cssv('--muted'),
      text:     cssv('--text-primary'),
      text2:    cssv('--text-secondary'),
      surface:  cssv('--surface-1'),
    };
  }

  const registry = new Map();     // el -> render fn

  /* Ce que chaque conteneur a trace en dernier, pour pouvoir animer vers la
     suite.

     Le souvenir vit ici et non chez l'appelant. `monterEvolution()` aurait pu
     garder les points precedents dans une variable de module, mais il aurait
     fallu qu'il sache aussi l'echelle, le tableau des bandes et leur ordre —
     soit la moitie de l'etat interne du graphique, recopiee dans la vue. La
     vue dit « anime cette transition », le graphique sait d'ou il vient.

     **Range par identifiant, et surtout pas par element.** Une `WeakMap` clefee
     sur le noeud etait le premier reflexe, et elle ne retenait rien : `render()`
     reecrit le `innerHTML` de la vue entiere, donc le `<div id="chartEvo">` du
     rendu suivant est un AUTRE noeud. La clef n'existait plus au moment de la
     lire, `get()` rendait `undefined`, et la transition se posait d'un coup sans
     erreur ni message — mesuree a l'image pres, elle etait deja arrivee a 13 ms.
     Un conteneur sans identifiant ne se souvient donc de rien, et n'anime pas :
     c'est le cas de tous les graphiques sauf celui-ci.

     Ce que ca retient est minuscule — sept tableaux d'une douzaine de nombres —
     et jamais un noeud du DOM, donc rien qui empeche une page de se liberer. */
  const dernierTrace = new Map();
  const cleTrace = el => el.id || null;

  const mouvementRefuse = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Un conteneur absent n'est pas une erreur, c'est une carte que la vue a
     choisi de ne pas rendre. Sans cette garde, chaque graphique lisait
     `el.clientWidth` sur `null` et l'exception remontait jusqu'a `render()` :
     l'ecran restait a moitie peint. Le cas se produit des qu'une vue masque une
     carte selon l'etat — un premier lancement, par exemple, ou aucune des six
     cartes de l'accueil n'a de quoi tracer quoi que ce soit.

     Un montage silencieux plutot qu'un appelant qui verifie : il y a une
     douzaine d'appels, donc douze occasions d'oublier la verification, et l'oubli
     ne se voit qu'a l'ecran blanc. */
  function mount(el, render) {
    if (!el) return;
    registry.set(el, render);
    render();
  }

  let rafId = null;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      for (const [el, fn] of registry) {
        if (el.isConnected) fn(); else registry.delete(el);
      }
    });
  });

  function refreshAll() {
    for (const [el, fn] of registry) { if (el.isConnected) fn(); else registry.delete(el); }
  }

  /* Toutes les infobulles des graphiques, pour pouvoir les refermer d'ailleurs.

     Les six graphiques cachaient la leur sur `mouseleave`. Cet evenement
     n'existe pas au doigt : rien ne « quitte » l'ecran quand on leve le doigt,
     et l'infobulle restait donc collee jusqu'au prochain rendu de la page. Sur
     telephone, elle recouvrait la moitie de la courbe sans aucun moyen de la
     faire partir.

     Un seul ecouteur, pose une fois pour toutes : toucher ailleurs referme.
     C'est le geste qu'on essaie d'instinct, et il vaut pour les six sans que
     chacun ait a s'en occuper. */
  const infobulles = new Set();
  let ecouteFermeture = false;

  function fermerInfobulles(saufDans) {
    for (const tip of infobulles) {
      if (!tip.isConnected) { infobulles.delete(tip); continue; }
      if (saufDans && tip.parentElement && tip.parentElement.contains(saufDans)) continue;
      tip.hidden = true;
      const cur = tip.parentElement && tip.parentElement.querySelector('.cursor');
      if (cur) cur.setAttribute('hidden', '');
      const spark = tip.parentElement && tip.parentElement.querySelector('.spark-curseur');
      if (spark) spark.style.display = 'none';
    }
  }

  /* --- ouvrir une infobulle au doigt sans voler le defilement ---------------

     « Le graphique de l'accueil ouvre son infobulle quand on le touche pour
     faire defiler la page. » Le premier contact posait l'infobulle, et un doigt
     qui passe sur un graphique de 300 px de haut pour atteindre le bas de la
     page en pose forcement un.

     Un appui ne veut donc plus dire « montre-moi ce mois ». Deux signes le
     disent, et il en suffit d'un :

     - **le temps** : le doigt tenu DELAI_APPUI sans bouger. Personne ne
       s'arrete un dixieme de seconde avant de lancer un defilement.
     - **la direction** : un glissement de plus de SEUIL_GLISSE pixels a
       l'horizontale. C'est le geste de parcours de la courbe, et il n'a rien a
       voir avec le defilement, qui est vertical.

     Et un signe l'annule : un glissement vertical franchit le seuil avant l'un
     des deux autres. Le geste est alors declare defilement pour de bon, plus
     rien ne l'armera avant que le doigt ne se leve.

     La souris ne passe pas par la : le survol n'a aucun cout, il ne prend le
     geste de personne.

     Le doigt garde ensuite la main sur toute la hauteur du graphique.
     `setPointerCapture` redirige tous les evenements de ce pointeur vers le
     graphique jusqu'a la levee, ou qu'aille le doigt : sans lui, sortir du
     cadre par le haut ou par le bas emet `pointerleave` et referme, or un doigt
     qui tient une colonne de 300 px en sort tout le temps. Le `try` n'est pas
     decoratif : un navigateur refuse la capture si le pointeur n'est plus
     actif, et l'exception finirait en console.

     `masquer` et non `cacher` en parametre : le second nom est celui de la
     fonction composee juste dessous, et le masquer ici aurait desarme le geste
     sans que rien ne le signale. Meme piege que `aideTexte` et `refus`,
     tous deux notes dans app.js. */
  const SEUIL_GLISSE = 8;    // px
  const DELAI_APPUI = 130;   // ms

  function cablerInfobulle(cible, montrer, masquer) {
    let arme = false, abandonne = false, depart = null, minuteur = null;
    const desarmer = () => {
      clearTimeout(minuteur); minuteur = null;
      arme = false; abandonne = false; depart = null;
    };
    const cacher = () => { desarmer(); masquer(); };

    cible.addEventListener('pointerdown', ev => {
      try { cible.setPointerCapture(ev.pointerId); } catch (e) { /* pointeur deja parti */ }
      desarmer();
      if (ev.pointerType !== 'touch') { arme = true; montrer(ev); return; }
      depart = { x: ev.clientX, y: ev.clientY, ev };
      minuteur = setTimeout(() => { minuteur = null; arme = true; montrer(depart.ev); }, DELAI_APPUI);
    });

    cible.addEventListener('pointermove', ev => {
      if (ev.pointerType !== 'touch') { montrer(ev); return; }
      if (!(ev.buttons || ev.pressure > 0)) return;
      if (arme) { montrer(ev); return; }
      if (abandonne || !depart) return;
      const dx = Math.abs(ev.clientX - depart.x), dy = Math.abs(ev.clientY - depart.y);
      if (dy > SEUIL_GLISSE && dy >= dx) { abandonne = true; clearTimeout(minuteur); minuteur = null; return; }
      if (dx > SEUIL_GLISSE) { clearTimeout(minuteur); minuteur = null; arme = true; montrer(ev); }
    });

    cible.addEventListener('pointerleave', cacher);
    cible.addEventListener('pointerup', cacher);

    /* `pointercancel` ne ferme pas une infobulle deja ouverte.

       Le graphique porte `touch-action: pan-y`, donc le navigateur
       annule le pointeur des qu'il reclame le geste — l'infobulle partait au
       moindre tremblement, alors qu'on tenait le doigt en place pour lire.

       Tant qu'elle n'est pas ouverte, en revanche, l'annulation est le signal
       le plus sur qui existe : le navigateur vient de decider que ce geste est
       un defilement. Le minuteur en attente n'a plus rien a ouvrir. */
    cible.addEventListener('pointercancel', () => { if (!arme) desarmer(); });
  }

  function ensureTip(el) {
    let tip = el.querySelector('.chart-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.hidden = true;
      el.appendChild(tip);
    }
    infobulles.add(tip);
    if (!ecouteFermeture) {
      ecouteFermeture = true;
      document.addEventListener('pointerdown', ev => fermerInfobulles(ev.target), true);
      window.addEventListener('scroll', () => fermerInfobulles(), { passive: true });
    }
    return tip;
  }

  /* Des graduations qui encadrent un intervalle SIGNE, zero tombant toujours
     sur l'une d'elles.

     `niceTicks` part de zero et monte : c'est tout ce qu'il faut tant qu'aucun
     total n'est negatif. Un patrimoine net peut l'etre — un achat recent finance
     a credit — et l'aire empilee se dessinait alors sous le cadre, invisible,
     avec un axe qui commencait a zero au-dessus de la courbe.

     Quand le minimum est positif ou nul, cette fonction rend exactement ce que
     rendait l'autre : le dessin de tous les cas deja en place ne bouge pas d'un
     pixel. */
  function niceTicksSignes(min, max, count = 4) {
    if (min >= 0) return niceTicks(max, count);
    const etendue = Math.max(max, 0) - min;
    const raw = etendue / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const bas = Math.floor(min / step) * step;
    const haut = Math.ceil(Math.max(max, 0) / step) * step;
    const ticks = [];
    for (let v = bas; v <= haut + step * 1e-9; v += step) ticks.push(v);
    return ticks;
  }

  function niceTicks(max, count = 4) {
    if (max <= 0) return [0];
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const ticks = [];
    for (let v = 0; v <= max * 1.001; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }

  let _ctx = null;
  function fitText(texte, largeurMax, police = '12.5px system-ui, -apple-system, "Segoe UI", sans-serif') {
    if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
    _ctx.font = police;
    if (_ctx.measureText(texte).width <= largeurMax) return texte;
    let court = texte;
    while (court.length > 1 && _ctx.measureText(court + '…').width > largeurMax) {
      court = court.slice(0, -1);
    }
    return court.trimEnd() + '…';
  }

  /* Le compact d'axe suit la devise du profil, et le signe se place comme la
     langue le veut : `Intl` met « 125 k € » en francais et « €125K » en
     anglais. On lui demande donc de formater l'unite de millier elle-meme,
     plutot que de coller un signe a la main du cote ou il ne va pas. */
  const kEur = v => {
    if (masqueActif()) return '•••';   // les axes chiffrés trahiraient le total
    const a = Math.abs(v);
    const dev = { style: 'currency', currency: deviseBase(), currencyDisplay: 'narrowSymbol',
                  maximumFractionDigits: a >= 1000 ? 1 : 0 };
    if (a >= 1000) return new Intl.NumberFormat(locale(), { ...dev, notation: 'compact' }).format(v);
    return new Intl.NumberFormat(locale(), dev).format(Math.round(v));
  };

  /* Option facultative, nee de la page Projection :
     `guide: { value, label }` est une ligne horizontale en pointille, comme
     celle de barsWithTarget. La cible long terme ne vivait que dans une note
     en texte ; tracee, on voit l'annee ou la courbe la croise sans lire un
     seul chiffre. Elle entre dans l'echelle : une cible hors de portee ecrase
     la courbe, et c'est exactement ce qu'elle doit montrer.
     (Une seconde serie en pointille pour les euros d'aujourd'hui a ete
     essayee puis retiree : deux courbes quasi paralleles, du bruit.) */
  function stackedArea(el, opts) {
    /* `anime` vit hors du rendu et s'eteint apres le premier : le registre
       rejoue ce rendu a chaque redimensionnement, et une transition qui se
       rejouerait en tirant sur le coin de la fenetre serait un tic. */
    let anime = !!opts.anime;
    mount(el, () => {
      /* `bande: { min, max }` : deux cles a lire sur chaque point, tracees en
         zone translucide derriere les bandes. Sert aux scenarios de la
         Projection — le meme calcul a deux points de rendement d'ecart. Une
         courbe unique a l'air d'une promesse ; la bande dit l'incertitude
         sans un mot. */
      const { points, series, guide, bande } = opts;
      const c = ink();
      const W = Math.max(el.clientWidth, 320);
      const H = opts.height || 300;
      const m = { t: 14, r: 16, b: 30, l: 54 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      if (!points.length) { el.innerHTML = `<p class="empty">${trad('Pas de données')}</p>`; return; }

      const totals = points.map(p => series.reduce((s, sr) => s + (p[sr.key] || 0), 0));
      const maxV = Math.max(...totals, guide ? guide.value : 0,
        bande ? Math.max(...points.map(p => p[bande.max] || 0)) : 0, 1);
      const minV = Math.min(0, ...totals,
        bande ? Math.min(...points.map(p => Number(p[bande.min]) || 0)) : 0);
      const ticks = niceTicksSignes(minV, maxV);
      const top = ticks[ticks.length - 1];
      const bas = ticks[0];
      const etendue = top - bas || 1;

      const x = i => m.l + (points.length === 1 ? iw / 2 : i * iw / (points.length - 1));
      const y = v => m.t + ih - ((v - bas) / etendue) * ih;

      /* --- la geometrie des bandes, en un seul endroit ---------------------

         Elle etait ecrite une fois, en ligne, ce qui suffisait tant que le
         dessin ne bougeait plus apres sa pose. L'animation en redemande une
         image par frame, avec d'autres valeurs et une autre echelle : deux
         ecritures du meme empilement auraient fini par ne plus empiler pareil,
         et le defaut ne se verrait que pendant le demi-seconde de la
         transition — donc jamais vraiment.

         `valeur(i, cle)` plutot que les points directement : c'est le seul
         point ou l'animation differe, elle interpole entre deux etats. `topC`
         de meme, l'echelle etant ce qui bouge le plus d'une vue a l'autre. */
      function empiler(valeur, topC, cles, basC = bas) {
        const etendueC = topC - basC || 1;
        const yC = v => m.t + ih - ((v - basC) / etendueC) * ih;
        let bas = points.map(() => 0);
        const bandes = [];
        for (const cle of cles) {
          const dessous = [...bas];
          bas = bas.map((v, i) => v + valeur(i, cle));
          bandes.push({
            cle,
            haut: bas.map((v, i) => `${x(i)},${yC(v)}`).join(' '),
            bas: dessous.map((v, i) => `${x(i)},${yC(v)}`).reverse().join(' '),
            epaisseur: Math.max(...bas.map((v, i) => Math.abs(yC(dessous[i]) - yC(v)))),
          });
        }
        return { bandes, cumul: bas, total: bas.map((v, i) => `${x(i)},${yC(v)}`).join(' '), y: yC };
      }

      const valeurDuPoint = (i, cle) => points[i][cle] || 0;
      const geo = empiler(valeurDuPoint, top, series.map(sr => sr.key));

      const areas = [];
      const HAUTEUR_TRAIT = 2.5;
      series.forEach((sr, k) => {
        const b = geo.bandes[k];
        /* `data-bande` : l'animation retrouve la bande de chaque poche sans
           compter les enfants, ce qu'un trait absent fausserait — une bande
           trop mince en pose deux de moins que sa voisine. */
        const trait = b.epaisseur >= HAUTEUR_TRAIT
          ? `<polyline points="${b.haut}" fill="none" stroke="${c.surface}" stroke-width="2"
                       stroke-linejoin="round" stroke-linecap="round"
                       data-trait="${esc(sr.key)}"/>`
            + `<polyline points="${b.haut}" fill="none" stroke="${sr.color}" stroke-width="1.75"
                        stroke-linejoin="round" stroke-linecap="round" data-trait="${esc(sr.key)}"/>`
          : '';
        areas.push(`<polygon points="${b.haut} ${b.bas}" fill="${sr.color}" fill-opacity=".28"
                             data-bande="${esc(sr.key)}"/>${trait}`);
      });
      const totalLine = geo.total;

      const every = Math.ceil(points.length / Math.max(3, Math.floor(iw / 78)));
      const xLabels = points.map((p, i) =>
        (i % every === 0 || i === points.length - 1)
          ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="tick">${esc(p.label)}</text>` : ''
      ).join('');

      const clip = 'clip' + Math.random().toString(36).slice(2, 8);
      el.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${trad('Évolution du patrimoine')}">
          <defs><clipPath id="${clip}"><rect x="${m.l}" y="0" width="${iw}" height="${H}"/></clipPath></defs>
          ${ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="${c.grid}" stroke-width="1" data-tick="${t}"/>
            <text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" class="tick" data-tick="${t}">${kEur(t)}</text>`).join('')}
          <g clip-path="url(#${clip})">
          ${bande ? (() => {
            const haut = points.map((p, i) => `${x(i)},${y(p[bande.max] || 0)}`).join(' ');
            const bas = points.map((p, i) => `${x(i)},${y(p[bande.min] || 0)}`).reverse().join(' ');
            return `<polygon points="${haut} ${bas}" fill="${c.text}" fill-opacity=".06"/>
              <polyline points="${haut}" fill="none" stroke="${c.text}" stroke-opacity=".28"
                        stroke-width="1" stroke-dasharray="3 4"/>
              <polyline points="${points.map((p, i) => `${x(i)},${y(p[bande.min] || 0)}`).join(' ')}"
                        fill="none" stroke="${c.text}" stroke-opacity=".28"
                        stroke-width="1" stroke-dasharray="3 4"/>`;
          })() : ''}
          <g class="chart-trace">
          ${areas.join('')}
          <polyline points="${totalLine}" fill="none" stroke="${c.text}" stroke-width="1.5"
                    stroke-opacity=".7" stroke-linejoin="round" stroke-linecap="round"/>
          </g>
          </g>
          ${guide ? `
            <line x1="${m.l}" x2="${W - m.r}" y1="${y(guide.value)}" y2="${y(guide.value)}"
                  stroke="${c.text}" stroke-opacity=".6" stroke-width="1" stroke-dasharray="6 4"/>
            <text x="${W - m.r}" y="${y(guide.value) - 6}" text-anchor="end" class="tick tick-strong">
              ${esc(guide.label || 'Cible')} ${kEur(guide.value)}</text>` : ''}
          <line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="${c.axis}" stroke-width="1"/>
          ${xLabels}
          <g class="cursor" hidden>
            <line class="cursor-line" y1="${m.t}" y2="${m.t + ih}" stroke="${c.text}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity=".5"/>
            ${series.map(sr => `<circle r="4.5" fill="${sr.color}" stroke="${c.surface}" stroke-width="2" data-k="${sr.key}"/>`).join('')}
            <circle r="5" fill="none" stroke="${c.text}" stroke-width="2" data-k="__total"/>
          </g>
          <rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" class="hit"/>
        </svg>`;

      const cle = cleTrace(el);
      /* Deformer quand les deux dessins parlent des memes mois, redecouvrir
         sinon : `animerDepuis` dit lequel des deux elle a pu faire. */
      if (anime && cle && !mouvementRefuse()
          && !animerDepuis(dernierTrace.get(cle))) balayer();
      anime = false;
      if (cle) dernierTrace.set(cle, {
        genre: 'aire',
        valeurs: Object.fromEntries(series.map(sr =>
          [sr.key, points.map(p => p[sr.key] || 0)])),
        cles: series.map(sr => sr.key),
        couleurs: Object.fromEntries(series.map(sr => [sr.key, sr.color])),
        top,
        bas,
        dates: points.map(p => p.date || p.label).join('|'),
      });

      function animerDepuis(avant) {
        if (!avant || avant.genre !== 'aire') return false;
        if (avant.dates !== points.map(p => p.date || p.label).join('|')) return false;
        const cles = [...avant.cles];
        for (const k of series.map(sr => sr.key)) if (!cles.includes(k)) cles.push(k);
        const ordre = series.map(sr => sr.key);
        cles.sort((a, b) => {
          const ia = ordre.indexOf(a), ib = ordre.indexOf(b);
          if (ia >= 0 && ib >= 0) return ia - ib;
          return avant.cles.indexOf(a) - avant.cles.indexOf(b);
        });

        const svgEl = el.querySelector('svg');
        const trace = el.querySelector('.chart-trace');
        if (!svgEl || !trace) return false;

        const couleur = Object.fromEntries(series.map(sr => [sr.key, sr.color]));
        const partantes = cles.filter(k => !ordre.includes(k));
        /* Les bandes qui s'en vont, reposees a leur rang pour la duree du
           mouvement. `insertBefore` sur la bande qui les suivait dans la pile :
           l'ordre de peinture EST l'ordre d'empilement en SVG. */
        const temporaires = partantes.map(k => {
          const suivante = ordre.find((_, i) => cles.indexOf(ordre[i]) > cles.indexOf(k));
          const apres = suivante ? trace.querySelector(`[data-bande="${suivante}"]`) : null;
          const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          poly.setAttribute('fill', avant.couleurs?.[k] || c.muted);
          poly.setAttribute('fill-opacity', '.28');
          poly.setAttribute('data-bande', k);
          trace.insertBefore(poly, apres);
          return poly;
        });

        const valeurAvant = (i, cle) => (avant.valeurs[cle] || [])[i] || 0;
        const valeurApres = (i, cle) => points[i][cle] || 0;
        const DUREE = 520;
        let debut = null, fini = false;

        const poser = (frac) => {
          const e = 1 - Math.pow(1 - frac, 3);
          const topC = avant.top + (top - avant.top) * e;
          const basC = num(avant.bas) + (bas - num(avant.bas)) * e;
          const etendueC = topC - basC || 1;
          const g = empiler((i, cle) => valeurAvant(i, cle)
            + (valeurApres(i, cle) - valeurAvant(i, cle)) * e, topC, cles, basC);
          g.bandes.forEach(b => {
            const forme = trace.querySelector(`[data-bande="${b.cle}"]`);
            if (forme) forme.setAttribute('points', `${b.haut} ${b.bas}`);
            for (const t of trace.querySelectorAll(`[data-trait="${b.cle}"]`)) {
              t.setAttribute('points', b.haut);
            }
          });
          const ligne = trace.querySelector('polyline:not([data-trait])');
          if (ligne) ligne.setAttribute('points', g.total);
          for (const rep of svgEl.querySelectorAll('[data-tick]')) {
            const v = Number(rep.dataset.tick);
            const yv = m.t + ih - ((v - basC) / etendueC) * ih;
            if (rep.tagName === 'line') { rep.setAttribute('y1', yv); rep.setAttribute('y2', yv); }
            else rep.setAttribute('y', yv + 4);
          }
        };

        const finir = () => {
          if (fini) return;
          fini = true;
          for (const t of temporaires) t.remove();
          geo.bandes.forEach(b => {
            const forme = trace.querySelector(`[data-bande="${b.cle}"]`);
            if (forme) forme.setAttribute('points', `${b.haut} ${b.bas}`);
            for (const t of trace.querySelectorAll(`[data-trait="${b.cle}"]`)) {
              t.setAttribute('points', b.haut);
            }
          });
          const ligne = trace.querySelector('polyline:not([data-trait])');
          if (ligne) ligne.setAttribute('points', totalLine);
          for (const rep of svgEl.querySelectorAll('[data-tick]')) {
            const yv = y(Number(rep.dataset.tick));
            if (rep.tagName === 'line') { rep.setAttribute('y1', yv); rep.setAttribute('y2', yv); }
            else rep.setAttribute('y', yv + 4);
          }
        };

        const pas = (t) => {
          if (fini) return;
          if (debut === null) debut = t;
          const frac = Math.min(1, (t - debut) / DUREE);
          poser(frac);
          if (frac < 1) requestAnimationFrame(pas); else finir();
        };
        poser(0);
        requestAnimationFrame(pas);
        svgEl.addEventListener('pointerdown', finir, { once: true });
        svgEl.addEventListener('pointermove', finir, { once: true });
        return true;
      }

      /* LE DESSIN SE REDECOUVRE, FAUTE DE POUVOIR SE DEFORMER.

         Changer de plage change les abscisses : trois ans n'a pas les mois d'un
         an, et interpoler une bande entre deux axes differents ferait glisser
         des valeurs d'une date vers une autre. C'est pour cela que
         `animerDepuis` refuse, et elle a raison de refuser.

         Reste a ne pas poser le nouveau dessin d'un coup. Le balayage de gauche
         a droite existe deja pour l'arrivee sur la vue : c'est le meme geste,
         dans le sens du temps, et il ne raconte rien de faux — il ne pretend pas
         qu'une valeur s'est deplacee, il decouvre une periode.

         Plus court qu'a l'arrivee, et sans retard : ici on vient d'appuyer sur
         un bouton qu'on peut reappuyer tout de suite, et une attente de huit
         dixiemes entre deux plages se sentirait. */
      function balayer() {
        const trace = el.querySelector('.chart-trace');
        if (!trace) return;
        trace.classList.add('chart-rejoue');
        /* LA CLASSE SE RETIRE, ET PAR DEUX CHEMINS. Sans retrait, un second
           changement de plage ne rejouerait rien — la classe serait deja la.
           Et `animationend` n'arrive pas toujours : un onglet en arriere-plan ne
           fait pas avancer ses animations, et l'evenement n'est jamais emis. Le
           minuteur est donc la deuxieme porte, un peu apres la duree declaree. */
        const oter = () => trace.classList.remove('chart-rejoue');
        trace.addEventListener('animationend', oter, { once: true });
        setTimeout(oter, 900);
      }

      const tip = ensureTip(el);
      const svg = el.querySelector('svg');
      const cur = el.querySelector('.cursor');
      const line = el.querySelector('.cursor-line');

      let iPrecedent = null;

      function move(ev) {
        const r = svg.getBoundingClientRect();
        const px = (ev.clientX - r.left) * (W / r.width);
        let i = Math.round((px - m.l) / (iw / Math.max(1, points.length - 1)));
        i = Math.max(0, Math.min(points.length - 1, i));
        /* Un tic au passage de chaque point, et seulement au doigt.

           C'est ce qui distingue un curseur qui suit le doigt d'une courbe qu'on
           parcourt : la main sent les mois defiler sans que l'oeil ait a lire
           les dates. Les applications de courtage le font toutes, et c'est la
           moitie de la sensation.

           Au changement d'index seulement — un tic par image donnerait une
           vibration continue — et jamais a la souris, ou il n'y a rien a sentir
           et ou `navigator.vibrate` ferait trembler un telephone pose a cote. */
        if (i !== iPrecedent) {
          if (iPrecedent !== null && ev.pointerType === 'touch') retourHaptique();
          iPrecedent = i;
        }
        const p = points[i];
        cur.removeAttribute('hidden');
        line.setAttribute('x1', x(i)); line.setAttribute('x2', x(i));
        let acc = 0;
        series.forEach(sr => {
          acc += p[sr.key] || 0;
          const dot = cur.querySelector(`[data-k="${sr.key}"]`);
          dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(acc));
        });
        const tdot = cur.querySelector('[data-k="__total"]');
        tdot.setAttribute('cx', x(i)); tdot.setAttribute('cy', y(totals[i]));

        tip.hidden = false;
        /* Une bande a zero sur ce mois-la ne se dit pas. `seriesUtiles()` garde
           une serie des qu'elle porte quelque chose QUELQUE PART, ce qui est
           juste pour la legende : sans cela une poche disparaitrait de la pile
           le mois ou elle se vide. Mais point par point, « Capital garanti 0 € »
           sur douze mois est une ligne qui n'apprend rien et qui fait douter,
           l'infobulle du mois dit ce qu'il y avait ce mois-la, et rien n'y
           etait. Une poche absente n'y entre donc pas, et elle n'y entre pas
           davantage pour montrer « 0,0 % ». */
        const lignes = series.filter(sr => Math.abs(Number(p[sr.key]) || 0) > 0.005);

        /* --- LE POIDS DE CHAQUE POCHE DANS LE TOTAL DE CETTE DATE ------------

           LA BASE EST `totals[i]`, ET C'EST EXACTEMENT LE TOTAL QUE LA DERNIERE
           LIGNE AFFICHE. Aucune autre source n'est relue : le montant et sa part
           viennent du meme instantane, donc le pourcentage ne peut pas dire
           autre chose que ce que la colonne d'a cote montre. Relire un
           `patrimoine()` d'aujourd'hui pour diviser un montant de mars aurait
           donne des parts qui ne totalisent pas cent.

           UN POURCENTAGE N'EXISTE QUE SUR UNE BASE STRICTEMENT POSITIVE. C'est
           la regle du projet, celle que `deltas()` et `poidsPoches()` appliquent
           deja. Un total nul diviserait par zero ; un patrimoine net negatif
           retournerait tous les signes, et « 43 % » sur une base de -20 000 ne
           veut rien dire. Dans ces deux cas la colonne ne parait pas du tout et
           l'infobulle redevient celle d'avant : c'est ce que font les six autres
           endroits de l'application ou une part indisponible ne s'ecrit pas.

           UNE POCHE NEGATIVE SUR UNE BASE POSITIVE GARDE SON SIGNE. Le trace net
           impute le reliquat de dette sur la poche qui porte les prets, qui
           devient negative ; la carte de repartition montre deja cette part
           telle quelle. La masquer ferait un total qui ne vaudrait plus la somme
           de ses parts, et c'est la regle cardinale de ce projet.

           LA LIGNE TOTAL DIT « 100 % » SANS DECIMALE, et les autres en portent
           une. Ce n'est pas une incoherence : cent n'est pas une mesure arrondie
           ici, c'est la definition de la base. Les lignes, elles, peuvent
           totaliser 99,9 ou 100,1 apres arrondi, et rien ne corrige la derniere
           pour forcer la somme : une part maquillee serait fausse pour cacher un
           arrondi qui, lui, est visible et honnete. */
        const base = totals[i];
        const avecPoids = !!opts.parts && baseDivisible(base);
        const poids = v => `<span class="tt-poids">${fmtPoids(v, base)}</span>`;
        const corps = avecPoids
          ? `<div class="tt-parts">` +
            lignes.map(sr => `<div class="tt-ligne"><span class="sw" style="background:${sr.color}"></span><span>${esc(sr.label)}</span><b>${fmtEUR0(p[sr.key] || 0)}</b>${poids(p[sr.key] || 0)}</div>`).join('') +
            `<span class="tt-filet"></span>` +
            `<div class="tt-ligne tt-fin"><span></span><span>${trad('Total')}</span><b>${fmtEUR0(totals[i])}</b><span class="tt-poids">${fmtPct(100, 0)}</span></div>` +
            `</div>`
          : lignes.map(sr => `<div class="tt-row"><span class="sw" style="background:${sr.color}"></span>${esc(sr.label)}<b>${fmtEUR0(p[sr.key] || 0)}</b></div>`).join('') +
            `<div class="tt-row tt-total">${trad('Total')}<b>${fmtEUR0(totals[i])}</b></div>`;
        tip.innerHTML = `<div class="tt-head">${esc(p.label)}</div>` + corps +
          (p.comment ? `<div class="tt-note">${esc(p.comment)}</div>` : '');
        const left = Math.min(Math.max(x(i) * (r.width / W) - tip.offsetWidth / 2, 4), r.width - tip.offsetWidth - 4);
        tip.style.left = left + 'px';
        tip.style.top = '8px';
      }
      /* Evenements pointeur et non souris : au doigt, `mousemove` est bien
         synthetise a l'appui — l'infobulle apparaissait donc — mais aucun
         `mouseleave` ne suit, et elle ne partait plus. Ici l'appui montre, le
         glissement suit le doigt, et lever la main la referme.

         Le glissement vertical reste possible : sans `touch-action: pan-y`, le
         navigateur reserve le geste au graphique et la page se bloque. */
      const cacher = () => {
        cur.setAttribute('hidden', ''); tip.hidden = true;
        iPrecedent = null;
      };
      el.style.touchAction = 'pan-y';
      /* Le doigt garde la main sur toute la verticale du mois touche, et un
         appui qui commence un defilement n'ouvre rien : tout le geste vit dans
         `cablerInfobulle`, en tete de fichier, avec son raisonnement.

         L'infobulle part avec le doigt, sans delai.

         Elle s'attardait 1 400 ms apres la levee, pour laisser le temps de lire.
         L'intention etait bonne et le raisonnement faux : on lit **pendant** qu'on
         appuie, pas apres. Le repit ne servait donc a rien, et il coutait cher.

         Car ce delai etait un `setTimeout` que rien n'annulait. Deux appuis
         rapproches, et le minuteur du premier fermait l'infobulle du second, en
         plein milieu — d'ou « la plupart du temps », qui est la signature d'un
         minuteur en retard et non d'une regle. Le supprimer regle les deux d'un
         coup : plus de disparition inexpliquee, et le geste devient celui qu'on
         attend — ça s'affiche tant que le doigt est la, ça part quand il se leve.

         Le minuteur d'armement, lui, est annule partout : a la levee, a la
         sortie, a l'annulation du pointeur et au debut du geste suivant. C'est
         la lecon de celui-la. */
      cablerInfobulle(svg, move, cacher);
    });
  }

  /* LE CENTRE SAIT PASSER A LA LIGNE, et c'est au dessin de le savoir.

     Un `<text>` SVG ne se replie pas : un libelle plus large que le trou sort
     de l'anneau et se lit par-dessus les tranches. « Tes investissements de
     marche » debordait des deux cotes.

     La coupe se fait a l'espace le PLUS PROCHE DU MILIEU, jamais au premier qui
     deborde : celui-la laisserait « Tes » seul sur une ligne au-dessus de tout
     le reste. Deux lignes au plus — au-dela, le centre mangerait l'anneau — et
     aucun mot n'est coupe : un nom tronque ne dit plus ce qu'il nomme, mieux
     vaut une ligne un peu large qu'un mot en morceaux.

     La largeur d'un caractere est estimee, pas mesuree : mesurer demanderait un
     rendu, donc un second passage, pour un reglage que l'oeil ne verifie qu'a
     deux caracteres pres. */
  function lignesCentre(texte, largeur) {
    const t = String(texte || '').trim();
    if (!t) return [];
    const parMax = Math.max(6, Math.floor(largeur / 5.9));
    if (t.length <= parMax) return [t];
    const milieu = t.length / 2;
    let coupe = -1;
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== ' ') continue;
      if (coupe < 0 || Math.abs(i - milieu) < Math.abs(coupe - milieu)) coupe = i;
    }
    return coupe < 0 ? [t] : [t.slice(0, coupe), t.slice(coupe + 1)];
  }

  function donut(el, opts) {
    /* Meme regle que la pile : le drapeau vit hors du rendu et s'eteint apres
       le premier. `mount` peut rappeler la fonction, et une transition rejouee
       a chaque redimensionnement serait un clignotement. */
    let anime = !!opts.anime;
    /* `null` tant qu'on n'a pas rendu : c'est le premier rendu qui decide s'il
       s'agit d'une arrivee, les suivants n'en sont jamais une. */
    let entree = null;
    mount(el, () => {
      const { items, centerLabel } = opts;
      const c = ink();
      const W = Math.max(el.clientWidth, 220);
      const H = opts.height || 240;
      const R = Math.min(W, H) / 2 - 8;
      const r = R * 0.62;
      const cx = W / 2, cy = H / 2;

      const DEBUT = -Math.PI / 2;
      /* `avance` est la fraction du tour deja dessinee, et elle sert au
         remplissage d'arrivee : chaque part est coupee au front, celles qui
         sont encore devant lui rendent un arc de longueur nulle, donc rien.

         Les parts gardent leurs proportions definitives pendant tout le
         remplissage. Les faire grandir ensemble aurait donne un anneau dont les
         parts changent de taille en se remplissant : on aurait lu une
         repartition qui bouge, alors que rien ne bouge. */
      const tracer = (liste, avance = 1) => {
        const somme = liste.reduce((s, i) => s + Math.max(0, i.valeur), 0) || 1;
        const front = DEBUT + Math.min(1, Math.max(0, avance)) * Math.PI * 2;
        let a0 = DEBUT;
        return liste.map(it => {
          const frac = Math.max(0, it.valeur) / somme;
          const a1 = a0 + frac * Math.PI * 2;
          const d0 = Math.min(a0, front), d1 = Math.min(a1, front);
          const large = (d1 - d0) > Math.PI ? 1 : 0;
          const p = (ang, rad) => `${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`;
          const d = `M ${p(d0, R)} A ${R} ${R} 0 ${large} 1 ${p(d1, R)} L ${p(d1, r)} A ${r} ${r} 0 ${large} 0 ${p(d0, r)} Z`;
          const mid = (a0 + a1) / 2;
          a0 = a1;
          return { d, frac, mid, cle: it.cle };
        });
      };

      const parts = items.map(it => ({
        cle: it.label, valeur: Math.max(0, it.value), couleur: it.color,
      }));
      const total = parts.reduce((s, i) => s + i.valeur, 0) || 1;
      const arcs = tracer(parts).map((a, i) => ({ ...a, it: items[i] }));
      const etiquette = lignesCentre(centerLabel || 'Total', 2 * r * 0.92);

      el.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${trad('Répartition')}">
          ${arcs.map((a, i) => `<path d="${a.d}" fill="${a.it.color}" stroke="${c.surface}" stroke-width="2" class="slice" data-i="${i}"/>`).join('')}
          <text x="${cx}" y="${cy - (etiquette.length > 1 ? 10 : 4)}" text-anchor="middle" class="donut-val">${kEur(opts.centerValue ?? total)}</text>
          ${etiquette.map((l, i) => `<text x="${cx}" y="${
            cy + (etiquette.length > 1 ? 8 + i * 13 : 16)
          }" text-anchor="middle" class="donut-lab">${esc(l)}</text>`).join('')}
        </svg>`;

      const cle = cleTrace(el);
      if (anime && cle && !mouvementRefuse()) animerDepuis(dernierTrace.get(cle));
      /* L'arrivee sur la vue se lit sur le DOM, pas sur un second drapeau :
         `render()` pose `.vue-entre` sur le conteneur de la vue avant d'y
         ecrire les cartes, et l'enleve 700 ms plus tard. Les jauges de la page
         poussent deja de zero sous cette classe ; l'anneau etait le seul a se
         poser d'un coup au milieu de barres qui grandissent.

         Decide au PREMIER rendu, puis consomme. `mount` rejoue la fonction a
         chaque redimensionnement, et se remplir a nouveau parce qu'on a tourne
         le telephone serait un clignotement.

         Jamais en meme temps que la transition de perimetre : celle-ci part des
         montants d'avant, un remplissage partirait de zero, et les deux se
         disputeraient les memes arcs. Le cas ne se presente pas — changer de
         perimetre n'est pas arriver sur la vue — mais l'ecrire vaut mieux que
         le supposer. */
      if (entree === null) entree = !!(el.closest && el.closest('.vue-entre'));
      if (entree && !anime && !mouvementRefuse()) remplir();
      entree = false;
      anime = false;
      if (cle) dernierTrace.set(cle, { genre: 'donut', parts });

      function remplir() {
        const svgEl = el.querySelector('svg');
        if (!svgEl) return;
        const noeuds = [...el.querySelectorAll('.slice')];
        if (!noeuds.length) return;
        const RETARD = 140, DUREE = 550;
        let debut = null, fini = false;

        const poser = (frac) => {
          /* Meme attenuation que les jauges, `cubic-bezier(.22,.61,.36,1)` :
             on part vite et on se pose lentement. */
          const e = 1 - Math.pow(1 - frac, 3);
          tracer(parts, e).forEach((a, i) => {
            if (noeuds[i]) noeuds[i].setAttribute('d', a.d);
          });
        };

        const finir = () => {
          if (fini) return;
          fini = true;
          arcs.forEach((a, i) => { if (noeuds[i]) noeuds[i].setAttribute('d', a.d); });
        };

        const pas = (t) => {
          if (fini) return;
          if (debut === null) debut = t;
          const f = Math.min(1, Math.max(0, (t - debut - RETARD) / DUREE));
          poser(f);
          if (f < 1) requestAnimationFrame(pas); else finir();
        };
        poser(0);
        requestAnimationFrame(pas);
        svgEl.addEventListener('pointerdown', finir, { once: true });
        svgEl.addEventListener('pointermove', finir, { once: true });
      }

      function animerDepuis(avant) {
        if (!avant || avant.genre !== 'donut') return;
        const noeud = new Map();
        el.querySelectorAll('.slice').forEach((n, i) => {
          if (parts[i]) noeud.set(parts[i].cle, n);
        });

        const ancien = avant.parts.map(p => p.cle);
        const cles = parts.map(p => p.cle);
        for (let i = ancien.length - 1; i >= 0; i--) {
          const k = ancien[i];
          if (cles.includes(k)) continue;
          let ancre = -1;
          for (let j = i - 1; j >= 0; j--) {
            const idx = cles.indexOf(ancien[j]);
            if (idx >= 0) { ancre = idx; break; }
          }
          cles.splice(ancre + 1, 0, k);
        }
        if (avant.parts.length === parts.length
            && parts.every((p, i) => avant.parts[i].cle === p.cle
                                  && Math.abs(avant.parts[i].valeur - p.valeur) < 0.005)) {
          return;
        }

        const valeur = (liste, k) => (liste.find(p => p.cle === k) || {}).valeur || 0;
        const teinte = k => (parts.find(p => p.cle === k)
                          || avant.parts.find(p => p.cle === k) || {}).couleur || c.muted;

        const svgEl = el.querySelector('svg');
        if (!svgEl) return;
        /* Les parts qui s'en vont, reposees a leur rang pour la duree du
           mouvement. Sans classe `slice` ni `data-i` : les infobulles sont
           branchees sur les parts d'arrivee, et une part fantome qui repondrait
           au survol annoncerait un montant qui n'existe plus. */
        const temporaires = [];
        for (const k of cles) {
          if (noeud.has(k)) continue;
          const suivante = cles.slice(cles.indexOf(k) + 1).find(x => noeud.has(x));
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('fill', teinte(k));
          path.setAttribute('stroke', c.surface);
          path.setAttribute('stroke-width', '2');
          svgEl.insertBefore(path, suivante ? noeud.get(suivante) : svgEl.querySelector('text'));
          noeud.set(k, path);
          temporaires.push(path);
        }

        const DUREE = 520;
        let debut = null, fini = false;

        const poser = (frac) => {
          const e = 1 - Math.pow(1 - frac, 3);
          tracer(cles.map(k => ({
            cle: k,
            valeur: valeur(avant.parts, k)
              + (valeur(parts, k) - valeur(avant.parts, k)) * e,
          }))).forEach(a => {
            const n = noeud.get(a.cle);
            if (n) n.setAttribute('d', a.d);
          });
        };

        const finir = () => {
          if (fini) return;
          fini = true;
          for (const t of temporaires) t.remove();
          arcs.forEach(a => {
            const n = noeud.get(a.cle);
            if (n) n.setAttribute('d', a.d);
          });
        };

        const pas = (t) => {
          if (fini) return;
          if (debut === null) debut = t;
          const f = Math.min(1, (t - debut) / DUREE);
          poser(f);
          if (f < 1) requestAnimationFrame(pas); else finir();
        };
        poser(0);
        requestAnimationFrame(pas);
        svgEl.addEventListener('pointerdown', finir, { once: true });
        svgEl.addEventListener('pointermove', finir, { once: true });
      }

      const tip = ensureTip(el);
      el.querySelectorAll('.slice').forEach(node => {
        node.addEventListener('mouseenter', () => {
          const a = arcs[+node.dataset.i];
          tip.hidden = false;
          tip.innerHTML = `<div class="tt-row"><span class="sw" style="background:${a.it.color}"></span>${esc(a.it.label)}<b>${fmtEUR0(a.it.value)}</b></div>
                           <div class="tt-row tt-total">Part<b>${fmtPct(a.frac * 100, 1)}</b></div>`;
          tip.style.left = Math.max(4, W / 2 - tip.offsetWidth / 2) + 'px';
          tip.style.top = '6px';
        });
        node.addEventListener('mouseleave', () => { tip.hidden = true; });
        /* Au doigt, aucun `mouseleave` ne suit l'appui : l'infobulle restait
           collee. Lever le doigt la referme, apres un instant de repit pour
           laisser lire le chiffre. Toucher ailleurs referme aussi, par
           l'ecouteur pose dans `ensureTip`. */
        node.addEventListener('pointerup', ev => {
          if (ev.pointerType === 'touch') setTimeout(() => { tip.hidden = true; }, 1400);
        });
      });
    });
  }

  function rankedBars(el, opts) {
    mount(el, () => {
      const items = opts.items.filter(i => opts.keepZero || i.value !== 0);
      const c = ink();
      const W = Math.max(el.clientWidth, 320);
      const rowH = opts.rowH || 30;
      const labelW = Math.min(210, Math.max(120, Math.round(W * 0.34)));
      const valueW = 108;
      const H = items.length * rowH + 8;
      const barMax = W - labelW - valueW - 8;
      const max = Math.max(...items.map(i => Math.abs(i.value)), 1);
      const color = opts.color || cssv('--series-1');

      el.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${trad('Répartition classée')}">
          ${items.map((it, i) => {
            const y = i * rowH + 4;
            const w = Math.max(2, Math.abs(it.value) / max * barMax);
            const neg = it.value < 0;
            return `
              <g class="rb" data-i="${i}">
                <rect x="0" y="${y}" width="${W}" height="${rowH - 2}" fill="transparent"/>
                <text x="0" y="${y + rowH / 2 + 1}" class="rb-label">${esc(fitText(it.label, labelW - 12))}</text>
                <title>${esc(it.label)}</title>
                <rect class="rb-barre" x="${labelW}" y="${y + 5}" width="${w}" height="${rowH - 14}" rx="4"
                      fill="${neg ? cssv('--critical') : (it.couleur || color)}"
                      fill-opacity="${it.dim ? .45 : 1}"/>
                <text x="${W}" y="${y + rowH / 2 + 1}" text-anchor="end" class="rb-val">${fmtEUR0Texte(it.value)}<tspan class="rb-pct"> · ${fmtPct(it.pct ?? 0, 1)}</tspan></text>
              </g>`;
          }).join('')}
        </svg>`;

      const tip = ensureTip(el);
      el.querySelectorAll('.rb').forEach(node => {
        if (opts.onPick) {
          node.style.cursor = 'pointer';
          node.addEventListener('click', () => opts.onPick(items[+node.dataset.i], +node.dataset.i));
        }
        const montrer = () => {
          const it = items[+node.dataset.i];
          tip.hidden = false;
          const sous = it.sous || [it.etab, it.type].filter(Boolean).join(' · ');
          tip.innerHTML = `<div class="tt-head">${esc(it.label)}</div>
            ${sous ? `<div class="tt-sous">${esc(sous)}</div>` : ''}
            <div class="tt-row">${esc(opts.valueLabel || trad('Montant'))}<b>${fmtEUR(it.value)}</b></div>
            ${it.average != null ? `<div class="tt-row">${trad('Par mois')}<b>${fmtEUR(it.average)}</b></div>` : ''}
            <div class="tt-row">${trad('Part')}<b>${fmtPct(it.pct ?? 0)}</b></div>`;
          tip.style.left = Math.max(4, W - tip.offsetWidth - 8) + 'px';
          /* Le haut suit la ligne survolee, et c'est la seule infobulle des
             graphiques dans ce cas : les autres s'epinglent en tete, donc rien
             ne pouvait les faire sortir. Celle-ci n'avait aucune borne basse, et
             sur les dernieres lignes elle depassait sa carte — les deux
             dernieres valeurs, le montant et la part, tombaient hors du cadre.
             Elle est posee en absolu dans le conteneur du graphique, donc c'est
             la hauteur de ce conteneur qui la retient.

             Et cette hauteur se MESURE : `H` est celle du viewBox, or le SVG est
             mis a l'echelle de la largeur disponible. Sur un telephone les deux
             differaient de dix pixels, et borner sur `H` laissait deborder
             d'autant. */
          const dispo = el.clientHeight || H;
          tip.style.top = Math.max(0,
            Math.min(dispo - tip.offsetHeight, +node.dataset.i * rowH - 6)) + 'px';
        };
        node.addEventListener('mouseenter', montrer);
        node.addEventListener('mouseleave', () => { tip.hidden = true; });
        /* Au doigt, `mouseenter` n'arrive qu'apres coup, et parfois pas du tout :
           un appui maintenu ne montrait donc rien, ou rien avant de relacher.
           `pointerdown` ouvre la bulle des que le doigt se pose, ce qui est
           precisement le geste qu'on fait pour la demander. */
        node.addEventListener('pointerdown', ev => {
          if (ev.pointerType === 'touch') montrer();
        });
        /* Au doigt, aucun `mouseleave` ne suit l'appui : l'infobulle restait
           collee. Lever le doigt la referme, apres un instant de repit pour
           laisser lire le chiffre. Toucher ailleurs referme aussi, par
           l'ecouteur pose dans `ensureTip`. */
        node.addEventListener('pointerup', ev => {
          if (ev.pointerType === 'touch') setTimeout(() => { tip.hidden = true; }, 1400);
        });
      });
    });
  }

  function groupedBars(el, opts) {
    mount(el, () => {
      const { items, seriesLabels } = opts;   // items: {label, a, b}
      const c = ink();
      const W = Math.max(el.clientWidth, 320);
      const H = opts.height || 260;
      const m = { t: 12, r: 12, b: 44, l: 54 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const max = Math.max(...items.flatMap(i => [i.a, i.b]), 1);
      const ticks = niceTicks(max);
      const top = ticks[ticks.length - 1];
      const y = v => m.t + ih - (v / top) * ih;
      const bandW = iw / items.length;
      const barW = Math.min(38, (bandW - 18) / 2);
      const cA = cssv('--series-1'), cB = cssv('--series-2');

      el.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${trad('Réel contre cible')}">
          ${ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="${c.grid}"/>
            <text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" class="tick">${kEur(t)}</text>`).join('')}
          ${items.map((it, i) => {
            const cxb = m.l + bandW * i + bandW / 2;
            const xa = cxb - barW - 1, xb = cxb + 1;
            return `<g class="gb" data-i="${i}">
              <rect class="gb-barre" x="${xa}" y="${y(it.a)}" width="${barW}" height="${Math.max(1, y(0) - y(it.a))}" rx="4" fill="${cA}"/>
              <rect class="gb-barre" x="${xb}" y="${y(it.b)}" width="${barW}" height="${Math.max(1, y(0) - y(it.b))}" rx="4" fill="${cB}" fill-opacity=".85"/>
              <text x="${cxb}" y="${H - 24}" text-anchor="middle" class="tick">${esc(it.label)}</text>
              <text x="${cxb}" y="${H - 8}" text-anchor="middle" class="tick tick-strong">${it.delta >= 0 ? '+' : '−'}${fmtEUR0Texte(Math.abs(it.delta))}</text>
            </g>`;
          }).join('')}
          <line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="${c.axis}"/>
        </svg>
        <div class="legend">
          <span><i style="background:${cA}"></i>${esc(seriesLabels[0])}</span>
          <span><i style="background:${cB}"></i>${esc(seriesLabels[1])}</span>
        </div>`;

      const tip = ensureTip(el);
      el.querySelectorAll('.gb').forEach(node => {
        if (opts.onPick) {
          node.style.cursor = 'pointer';
          node.addEventListener('click', () => opts.onPick(items[+node.dataset.i], +node.dataset.i));
        }
        node.addEventListener('mouseenter', () => {
          const it = items[+node.dataset.i];
          tip.hidden = false;
          tip.innerHTML = `<div class="tt-head">${esc(it.label)}</div>
            <div class="tt-row"><span class="sw" style="background:${cA}"></span>${esc(seriesLabels[0])}<b>${fmtEUR0(it.a)}</b></div>
            <div class="tt-row"><span class="sw" style="background:${cB}"></span>${esc(seriesLabels[1])}<b>${fmtEUR0(it.b)}</b></div>
            <div class="tt-row tt-total">${trad('Écart')}<b>${it.delta >= 0 ? '+' : '−'}${fmtEUR0(Math.abs(it.delta))}</b></div>
            ${opts.onPick ? `<div class="tt-row tt-hint">${trad('Clique pour changer la cible')}</div>` : ''}`;
          tip.style.left = Math.max(4, Math.min(W - tip.offsetWidth - 4, m.l + bandW * (+node.dataset.i) + bandW / 2 - tip.offsetWidth / 2)) + 'px';
          tip.style.top = '6px';
        });
        node.addEventListener('mouseleave', () => { tip.hidden = true; });
        /* Au doigt, aucun `mouseleave` ne suit l'appui : l'infobulle restait
           collee. Lever le doigt la referme, apres un instant de repit pour
           laisser lire le chiffre. Toucher ailleurs referme aussi, par
           l'ecouteur pose dans `ensureTip`. */
        node.addEventListener('pointerup', ev => {
          if (ev.pointerType === 'touch') setTimeout(() => { tip.hidden = true; }, 1400);
        });
      });
    });
  }

  function barsWithTarget(el, opts) {
    mount(el, () => {
      const { items, target, targetLabel } = opts;   // items: {label, value, note}
      const c = ink();
      const W = Math.max(el.clientWidth, 320);
      const H = opts.height || 280;
      const m = { t: 16, r: 14, b: 34, l: 56 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      if (!items.length) { el.innerHTML = `<p class="empty">${trad('Pas de données')}</p>`; return; }

      const max = Math.max(...items.map(i => i.value), target || 0, 1);
      const ticks = niceTicks(max);
      const top = ticks[ticks.length - 1];
      const y = v => m.t + ih - (v / top) * ih;
      const band = iw / items.length;
      const bw = Math.min(46, band * 0.62);

      /* Trois niveaux, pas deux. Tout mois au-dessus de l'objectif etait rouge :
         sur huit mois, sept l'etaient, et une couleur d'alerte qui s'allume
         presque toujours ne dit plus rien. Le seuil vit dans le modele,
         `niveauDepassement()`, partage avec les tableaux. */
      const teinte = { sous: cssv('--good'), leger: cssv('--serious'), grave: cssv('--critical') };
      const none = cssv('--grid');
      const every = Math.ceil(items.length / Math.max(3, Math.floor(iw / 62)));

      el.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${trad('Dépenses mensuelles')}">
          ${ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="${c.grid}"/>
            <text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" class="tick">${kEur(t)}</text>`).join('')}
          ${items.map((it, i) => {
            const cx = m.l + band * i + band / 2;
            const h = Math.max(it.value > 0 ? 2 : 0, y(0) - y(it.value));
            const fill = teinte[niveauDepassement(it.value, target)] || none;
            return `<g class="vb" data-i="${i}">
              <rect x="${m.l + band * i}" y="${m.t}" width="${band}" height="${ih}" fill="transparent"/>
              <rect class="vb-barre" x="${cx - bw / 2}" y="${y(it.value)}" width="${bw}" height="${h}" rx="4" fill="${fill}" fill-opacity=".9"/>
              ${(i % every === 0 || i === items.length - 1)
                ? `<text x="${cx}" y="${H - 12}" text-anchor="middle" class="tick">${esc(it.label)}</text>` : ''}
            </g>`;
          }).join('')}
          <line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="${c.axis}"/>
          ${target ? `
            <line x1="${m.l}" x2="${W - m.r}" y1="${y(target)}" y2="${y(target)}"
                  stroke="${c.text}" stroke-width="2" stroke-dasharray="5 4" stroke-opacity=".65"/>
            <text x="${W - m.r}" y="${y(target) - 6}" text-anchor="end" class="tick tick-strong">
              ${esc(targetLabel || trad('Objectif'))} ${kEur(target)}</text>` : ''}
        </svg>`;

      const tip = ensureTip(el);
      el.querySelectorAll('.vb').forEach(node => {
        node.addEventListener('mouseenter', () => {
          const it = items[+node.dataset.i];
          const diff = target ? it.value - target : null;
          tip.hidden = false;
          tip.innerHTML = `<div class="tt-head">${esc(it.label)}</div>
            <div class="tt-row">Dépensé<b>${fmtEUR0(it.value)}</b></div>
            ${target && it.value > 0 ? `<div class="tt-row tt-total">vs objectif<b>${diff > 0 ? '+' : '−'}${fmtEUR0(Math.abs(diff))}</b></div>` : ''}
            ${it.note ? `<div class="tt-note">${esc(it.note)}</div>` : ''}`;
          const cx = m.l + band * (+node.dataset.i) + band / 2;
          const r = el.querySelector('svg').getBoundingClientRect();
          tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4,
            cx * (r.width / W) - tip.offsetWidth / 2)) + 'px';
          tip.style.top = '4px';
        });
        node.addEventListener('mouseleave', () => { tip.hidden = true; });
        /* Au doigt, aucun `mouseleave` ne suit l'appui : l'infobulle restait
           collee. Lever le doigt la referme, apres un instant de repit pour
           laisser lire le chiffre. Toucher ailleurs referme aussi, par
           l'ecouteur pose dans `ensureTip`. */
        node.addEventListener('pointerup', ev => {
          if (ev.pointerType === 'touch') setTimeout(() => { tip.hidden = true; }, 1400);
        });
      });
    });
  }

  function deltaBars(el, opts) {
    mount(el, () => {
      const { items, average } = opts;
      const c = ink();
      const W = Math.max(el.clientWidth, 320);
      const H = opts.height || 220;
      const m = { t: 14, r: 12, b: 30, l: 56 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      if (!items.length) { el.innerHTML = `<p class="empty">${trad('Pas assez d\'historique')}</p>`; return; }

      const vals = items.map(i => i.value);
      const hi = Math.max(...vals, average || 0, 0);
      const lo = Math.min(...vals, average || 0, 0);
      const span = (hi - lo) || 1;
      const y = v => m.t + ih - ((v - lo) / span) * ih;
      const zero = y(0);
      const band = iw / items.length;
      const bw = Math.min(34, band * 0.6);

      const up = cssv('--good'), down = cssv('--critical');
      const every = Math.ceil(items.length / Math.max(3, Math.floor(iw / 60)));

      el.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(trad('Variation mensuelle du patrimoine'))}">
          ${[hi, 0, lo].filter((v, i, a) => a.indexOf(v) === i).map(v =>
            `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${c.grid}"/>
             <text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" class="tick">${kEur(v)}</text>`).join('')}
          ${items.map((it, i) => {
            const cx = m.l + band * i + band / 2;
            const top = it.value >= 0 ? y(it.value) : zero;
            const h = Math.max(2, Math.abs(zero - y(it.value)));
            return `<g class="vb" data-i="${i}">
              <rect x="${m.l + band * i}" y="${m.t}" width="${band}" height="${ih}" fill="transparent"/>
              <rect class="vb-barre"${it.value < 0 ? ' data-sous="1"' : ''} x="${cx - bw / 2}" y="${top}" width="${bw}" height="${h}" rx="3"
                    fill="${it.value >= 0 ? up : down}" fill-opacity=".9"/>
              ${(i % every === 0 || i === items.length - 1)
                ? `<text x="${cx}" y="${H - 10}" text-anchor="middle" class="tick">${esc(it.label)}</text>` : ''}
            </g>`;
          }).join('')}
          <line x1="${m.l}" x2="${W - m.r}" y1="${zero}" y2="${zero}" stroke="${c.axis}" stroke-width="1.5"/>
          ${average != null ? `
            <line x1="${m.l}" x2="${W - m.r}" y1="${y(average)}" y2="${y(average)}"
                  stroke="${c.text}" stroke-width="2" stroke-dasharray="5 4" stroke-opacity=".55"/>
            <text x="${W - m.r}" y="${y(average) - 5}" text-anchor="end" class="tick tick-strong">
              moyenne ${kEur(average)}</text>` : ''}
        </svg>`;

      const tip = ensureTip(el);
      el.querySelectorAll('.vb').forEach(node => {
        node.addEventListener('mouseenter', () => {
          const it = items[+node.dataset.i];
          tip.hidden = false;
          tip.innerHTML = `<div class="tt-head">${esc(it.label)}</div>
            <div class="tt-row">Variation<b>${it.value >= 0 ? '+' : '−'}${fmtEUR0(Math.abs(it.value))}</b></div>
            ${it.note ? `<div class="tt-note">${esc(it.note)}</div>` : ''}`;
          const cx = m.l + band * (+node.dataset.i) + band / 2;
          const r = el.querySelector('svg').getBoundingClientRect();
          tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4,
            cx * (r.width / W) - tip.offsetWidth / 2)) + 'px';
          tip.style.top = '2px';
        });
        node.addEventListener('mouseleave', () => { tip.hidden = true; });
        /* Au doigt, aucun `mouseleave` ne suit l'appui : l'infobulle restait
           collee. Lever le doigt la referme, apres un instant de repit pour
           laisser lire le chiffre. Toucher ailleurs referme aussi, par
           l'ecouteur pose dans `ensureTip`. */
        node.addEventListener('pointerup', ev => {
          if (ev.pointerType === 'touch') setTimeout(() => { tip.hidden = true; }, 1400);
        });
      });
    });
  }

  const AMPLITUDE_MINIMALE = 0.005;

  function sparkline(el, values, opts = {}) {
    mount(el, () => {
      const W = Math.max(el.clientWidth, 80), H = opts.height || 44;
      if (values.length < 2) { el.innerHTML = ''; return; }
      const min = Math.min(...values), max = Math.max(...values);
      /* UN PLANCHER D'AMPLITUDE, SINON TOUTE VARIATION DEVIENT UNE FALAISE.

         Le cadrage sur min/max donne toujours toute la hauteur a l'ecart
         existant, quel qu'il soit. Mesure faite sur le trace : `[100 000,
         110 000]` et `[100 000, 100 012]` rendent exactement le meme dessin,
         « 0,32 200,4 ». Douze euros de mouvement se lisaient donc comme dix
         mille, et c'est sur deux points — le cas de qui commence — que le
         malentendu est le plus fort, puisqu'aucune forme ne vient le nuancer.

         Sous un demi pour cent du niveau, l'echelle s'ouvre donc a ce demi
         pour cent AUTOUR DU MILIEU. La ligne ne ment plus dans les deux sens :
         un patrimoine immobile se pose au milieu du cadre au lieu de se coller
         au bord bas — `(max - min) || 1` envoyait toutes les valeurs egales sur
         la meme ligne, celle du plancher — et un mouvement negligeable reste
         visiblement negligeable. Rien n'est cache pour autant : le montant
         exact et son pourcentage sont ecrits juste a cote.

         `Number.EPSILON` comme minimum absolu : sur une serie entierement a
         zero, un plancher proportionnel vaudrait zero lui aussi, et la ligne
         retomberait au bord bas par la porte qu'on vient de fermer.

         LA COULEUR SUIT LA PENTE DESSINEE, ET NON LE DRAPEAU CI-DESSUS. Vert
         sur un patrimoine qui n'a pas bouge, c'etait une bonne nouvelle
         inventee ; mais lier l'encre au drapeau donnait pire, et c'est une
         mesure au seuil qui l'a montre : a +500 sur 100 000, l'ecart passe tout
         juste sous le plancher, l'echelle s'ouvre a peine et le trait monte
         donc de presque toute la hauteur — en gris. Une pente franche peinte
         comme une ligne morte.

         Le critere est donc geometrique et se suffit : on mesure ce que le
         trace occupe VRAIMENT en pixels apres l'ouverture, et l'encre devient
         neutre quand il n'y a plus de pente a colorer. Aucun second seuil
         metier, et les deux decisions ne peuvent plus se contredire. */
      const milieu = (min + max) / 2;
      const plancher = Math.max(Math.abs(milieu) * AMPLITUDE_MINIMALE, Number.EPSILON);
      const bas = (max - min) < plancher ? milieu - plancher / 2 : min;
      const span = ((max - min) < plancher ? plancher : max - min) || 1;
      const x = i => i * W / (values.length - 1);
      const y = v => H - 4 - ((v - bas) / span) * (H - 8);
      const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      const penteEnPixels = ((max - min) / span) * (H - 8);
      const col = opts.color || (penteEnPixels < 1 ? cssv('--muted')
        : values[values.length - 1] >= values[0] ? cssv('--good') : cssv('--critical'));
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
        <polygon points="0,${H} ${pts} ${W},${H}" fill="${col}" fill-opacity=".12"/>
        <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="3" fill="${col}"/>
        <circle class="spark-curseur" r="4" fill="${col}" stroke="${cssv('--surface-1') || '#fff'}"
                stroke-width="2" style="display:none"/>
      </svg>`;

      if (!opts.labels) return;
      const svg = el.querySelector('svg');
      const curseur = el.querySelector('.spark-curseur');
      const tip = ensureTip(el);
      tip.classList.add('tip-spark');
      el.style.position = 'relative';
      el.style.touchAction = 'pan-y';        // le defilement vertical reste possible

      const montrer = ev => {
        const r = svg.getBoundingClientRect();
        const i = Math.max(0, Math.min(values.length - 1,
          Math.round((ev.clientX - r.left) / r.width * (values.length - 1))));
        curseur.style.display = '';
        curseur.setAttribute('cx', x(i));
        curseur.setAttribute('cy', y(values[i]));
        /* LA DATE AU-DESSUS, LE MONTANT EN DESSOUS. En ligne, separes d'un point
           median, les deux se disputaient la meme lecture et c'est la date qui
           gagnait — elle finissait la phrase. Empiles, l'oeil prend le montant
           d'un coup et la date le situe. `tt-head` est le meme intitule que la
           bulle de la courbe d'evolution : petites capitales, encre secondaire,
           aucune couleur nouvelle. */
        tip.innerHTML = `<div class="tt-head">${opts.labels[i]}</div>`
          + `<b>${fmtEUR0(values[i])}</b>`;
        tip.hidden = false;                  // l'attribut hidden gagnerait sur un style inline
        const tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(W - tw, x(i) - tw / 2)) + 'px';
        /* AU-DESSUS DU TRACE, PAS DESSUS. A `-6px`, la bulle commencait six
           pixels au-dessus du cadre et retombait sur toute la hauteur de la
           courbe : on lisait le chiffre a travers le dessin qu'il commente.
           Son BAS se pose desormais huit pixels au-dessus du cadre, donc elle
           n'en couvre plus rien. La hauteur se mesure a chaque fois : elle
           depend de la langue et de la taille de police du lecteur.

           ET LA MONTEE EST BORNEE PAR LA PLACE QUI EXISTE, mesuree sur la carte
           qui porte le graphique et non ecrite en dur : sans cette borne, une
           bulle plus haute que l'espace disponible sortirait par le haut. Quand
           la place manque, elle redescend juste ce qu'il faut plutot que de
           depasser. */
        const carte = el.closest('.card, .hero');
        const placeAuDessus = carte
          ? el.getBoundingClientRect().top - carte.getBoundingClientRect().top - 4
          : el.clientHeight;
        tip.style.top = -Math.min(tip.offsetHeight + 8, Math.max(0, placeAuDessus)) + 'px';
      };
      const cacher = () => { curseur.style.display = 'none'; tip.hidden = true; };
      /* Meme regle que la courbe d'evolution, et pour les memes raisons : le doigt
         garde la main sur toute la hauteur, un appui qui commence un defilement
         n'ouvre rien, et ce qui ferme est sa levee, sans minuteur. Celui qui
         vivait ici — 1 200 ms, jamais annule — fermait l'infobulle du deuxieme
         appui avec le retard du premier.

         Cable sur le `svg` et non sur `el`, contrairement aux `on…` qui
         vivaient ici : `mount` rejoue ce rendu a chaque redimensionnement, et
         des `addEventListener` poses sur le conteneur, qui lui survit, se
         seraient empiles a chaque fois. Les proprietes `on…` s'ecrasaient et
         masquaient donc ce piege. Le `svg`, lui, est refait a chaque rendu par
         l'`innerHTML` ci-dessus : rien ne s'empile, et c'est deja ce que fait
         la courbe d'evolution. */
      cablerInfobulle(svg, montrer, cacher);
    });
  }

  return { stackedArea, donut, rankedBars, groupedBars, barsWithTarget, deltaBars,
           sparkline, refreshAll, cssv };
})();
