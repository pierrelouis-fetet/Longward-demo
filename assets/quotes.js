/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const Quotes = (() => {

  const BASE = location.protocol === 'file:' ? 'http://127.0.0.1:8765' : '';

  let online = null;          // null = pas encore teste
  let healthPromise = null;   // mutualise : un seul appel reseau au demarrage

  /* LA SONDE NE RETIENT PAS LE DEMARRAGE PLUS DE 2,5 S. `init()` l'attend
     avant de lire le stockage local -- l'identite precede toute lecture --,
     et une requete sans limite laisserait l'ecran de lancement a l'infini des
     que le reseau pend : portail captif, tunnel, serveur muet. Au-dela, la
     reponse vaut "pas de serveur", comme la panne que le `catch` rend :
     l'application s'ouvre sur ce qu'elle a en local, le pied du menu dit
     "Sauvegarde localement", et sur une instance a comptes l'ecran "Session a
     reverifier" propose de recharger. Le retard emprunte le chemin de la
     panne, sans chemin a lui.

     Une reponse tardive ne se garde pas en cache. Le prochain appel resonde,
     parce que le serveur a pu revenir ; la synchronisation, elle, a deja
     tranche pour cette page -- `probe()` ne se rejoue pas -- et c'est voulu :
     adopter le cloud apres que l'ecran s'est ouvert sur le local serait la
     course que ce demarrage evite. */
  const DELAI_SONDE_MS = 2500;
  function healthData() {
    if (!healthPromise) {
      const garde = new AbortController();
      const minuteur = setTimeout(() => garde.abort(), DELAI_SONDE_MS);
      healthPromise = fetch(BASE + '/api/health', { cache: 'no-store', signal: garde.signal })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(d => {
          clearTimeout(minuteur);
          if (d === null && garde.signal.aborted) healthPromise = null;
          return d;
        });
    }
    return healthPromise;
  }

  async function health() {
    online = (await healthData()) !== null;
    return online;
  }

  const isOnline = () => online;

  function plan() {
    const symbols = [], currencies = new Set();
    for (const p of Store.state.positions) {
      const sym = (p.symbol || '').trim();
      if (p.manual || !sym) continue;
      if (!symbols.includes(sym)) symbols.push(sym);
      if (p.currency && p.currency !== deviseBase()) currencies.add(p.currency);
    }
    const fxPairs = [...currencies].map(c => `${deviseBase()}${c}=X`);
    return { symbols, fxPairs, currencies: [...currencies], all: [...symbols, ...fxPairs] };
  }

  async function resolveIsin(code, prefer) {
    const pref = prefer ?? Store.state.meta.preferredExchange ?? '';
    const r = await fetch(`${BASE}/api/isin?code=${encodeURIComponent(code)}&prefer=${encodeURIComponent(pref)}`,
      { cache: 'no-store' });
    if (!r.ok && r.status !== 502) throw new Error(`passerelle indisponible (HTTP ${r.status})`);
    return r.json();
  }

  async function resolveMissing() {
    const todo = Store.state.positions.filter(
      p => !(p.symbol || '').trim() && (p.isin || '').trim() && !p.manual);
    const done = [];
    for (const p of todo) {
      try {
        const r = await resolveIsin(p.isin.trim());
        if (r.best && r.best.symbol) {
          p.symbol = r.best.symbol;
          done.push({ name: p.name, isin: p.isin, symbol: r.best.symbol,
                      exchange: r.best.exchange, alternatives: (r.candidates || []).length - 1 });
        } else {
          done.push({ name: p.name, isin: p.isin, error: r.error || 'aucune cotation trouvée' });
        }
      } catch (e) {
        done.push({ name: p.name, isin: p.isin, error: e.message });
      }
    }
    /* `derive` pour la meme raison : un ISIN resolu en symbole est une deduction
       de la passerelle, pas une decision prise ici. */
    if (done.some(d => d.symbol)) Store.save({ derive: true });
    return done;
  }

  async function refresh() {
    const resolved = await resolveMissing();     // un ISIN suffit, le symbole suivra
    const p = plan();
    if (!p.all.length) return { changes: [], resolved, empty: true };

    const r = await fetch(BASE + '/api/quotes?symbols=' + encodeURIComponent(p.all.join(',')),
      { cache: 'no-store' });
    if (!r.ok) throw new Error(`passerelle indisponible (HTTP ${r.status})`);
    const data = await r.json();

    const bySym = {};
    p.all.forEach((s, i) => { bySym[s.toUpperCase()] = data.quotes[i]; });

    // `EURUSD=X` donne des USD par euro, on veut l'inverse : la base par unite
    const fx = {};
    const base = deviseBase();
    for (const c of p.currencies) {
      const q = bySym[`${base}${c}=X`];
      if (q && !q.error && q.price) fx[c] = 1 / q.price;
    }

    const manquantes = [...new Set(Store.state.positions
      .filter(pos => !pos.manual && (pos.symbol || '').trim())
      .map(pos => bySym[pos.symbol.trim().toUpperCase()])
      .filter(q => q && !q.error && q.price && q.currency && q.currency !== base && !(fx[q.currency] > 0))
      .map(q => q.currency))];
    if (manquantes.length) {
      try {
        const r2 = await fetch(BASE + '/api/quotes?symbols='
          + encodeURIComponent(manquantes.map(c => `${base}${c}=X`).join(',')), { cache: 'no-store' });
        if (r2.ok) {
          const d2 = await r2.json();
          manquantes.forEach((c, i) => {
            const q = (d2.quotes || [])[i];
            if (q && !q.error && q.price) fx[c] = 1 / q.price;
          });
        }
      } catch (e) { /* les lignes concernees le diront */ }
    }
    /* L'ancien taux d'une ligne ne vaut que pour sa devise, et que sous la
       devise de profil dans laquelle il a ete pris. Chaque ligne la retient
       (`pos.fxBase`), posee a chaque taux ecrit ici. La marque globale,
       `quotes.fxBase`, ne la remplace pas : elle passe a la nouvelle devise
       des le premier rafraichissement, meme quand une ligne n'a pas eu son
       change, et couvrirait alors le taux d'une autre devise. Sans marque de
       ligne, la provenance du taux est inconnue : il ne sert pas, et la ligne
       attend son change. */
    const tauxDe = (pos, devise) => {
      if (!devise || devise === base) return 1;
      if (fx[devise] > 0) return fx[devise];
      if (pos.fxBase === base && devise === pos.currency && num(pos.fx) > 0) return num(pos.fx);
      return null;
    };

    const changes = [];
    for (const pos of Store.state.positions) {
      const sym = (pos.symbol || '').trim();
      if (pos.manual || !sym) continue;
      const q = bySym[sym.toUpperCase()];

      if (!q || q.error || !q.price) {
        changes.push({ name: pos.name, symbol: sym, error: (q && q.error) || 'aucune réponse' });
        continue;
      }

      const devise = q.currency || pos.currency;
      const taux = tauxDe(pos, devise);
      if (taux === null) {
        changes.push({ name: pos.name, symbol: sym, error: trad('Change {c} indisponible').replace('{c}', devise) });
        continue;
      }

      const before = { price: num(pos.price), value: posValue(pos) };
      pos.price = q.price;
      pos.prevClose = num(q.previousClose) || null;
      pos.marketState = q.marketState || null;
      pos.session = q.session || null;
      pos.quoteTime = q.time || null;
      pos.exchange = q.exchange || pos.exchange || '';
      if (q.longName) pos.longName = q.longName;
      if (q.kind) pos.kind = q.kind;
      pos.low52 = q.low52 ?? null;
      pos.high52 = q.high52 ?? null;
      pos.dayLow = q.dayLow ?? null;
      pos.dayHigh = q.dayHigh ?? null;
      pos.volume = q.volume ?? null;
      if (q.firstTrade) pos.firstTrade = q.firstTrade;
      if (q.currency) pos.currency = q.currency;
      pos.fx = taux;
      pos.fxBase = base;
      
      changes.push({
        name: pos.name, symbol: q.symbol || sym, quoteName: q.name || '',
        from: before.price, to: q.price, currency: pos.currency,
        exchange: q.exchange || '', source: q.source, cached: !!q.cached,
        dayPct: q.previousClose ? (q.price / q.previousClose - 1) * 100 : null,
        valueDelta: posValue(pos) - before.value,
      });
    }

    /* `fxBase` : ces taux convertissent vers CETTE devise de base. Changer la
       devise du profil les rend non fiables jusqu'au rafraichissement suivant. */
    Store.state.quotes = { lastRun: new Date().toISOString(), fx, fxBase: base, changes, resolved };
    /* `derive` : un cours vient du marche, pas du detenteur. L'enregistrer ne
       doit pas dater l'etat, sinon ouvrir l'application suffirait a faire
       passer cet appareil pour porteur d'une modification, avec une
       estampille plus fraiche que celle du telephone sur lequel on a
       reellement saisi. */
    Store.save({ derive: true });
    return { changes, fx, resolved };
  }

  async function search(query) {
    const prefer = Store.state.meta.preferredExchange ?? '';
    const r = await fetch(`${BASE}/api/search?q=${encodeURIComponent(query)}`
      + `&prefer=${encodeURIComponent(prefer)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`recherche indisponible (HTTP ${r.status})`);
    return (await r.json()).results || [];
  }

  const FAMILLES_REPERES = [
    ['indices', trad('Indices'), [
      ['^GSPC',     'S&P 500'],
      ['^IXIC',     'Nasdaq'],
      ['^FCHI',     'CAC 40'],
      ['^STOXX50E', 'Stoxx 50'],
      ['^N225',     'Nikkei'],
      /* Le VIX ferme la famille, et il n'y est pas un indice de plus : il ne
         mesure pas un marche mais ce que ce marche ANTICIPE comme amplitude de
         variation. Sa tuile le dit autrement -- voir `NIVEAUX_VIX` dans app.js.

         Il passe par la meme passerelle et le meme cache que les cinq autres :
         un systeme parallele pour un seul symbole couterait une seconde source
         de fraicheur, et deux facons de dire "donnee indisponible". */
      ['^VIX',      'VIX'],
    ]],
    ['metaux', trad('Métaux'), [
      ['GC=F', trad('Or')],
      ['SI=F', trad('Argent')],
      ['PL=F', trad('Platine')],
      ['PA=F', 'Palladium'],
      ['HG=F', trad('Cuivre')],
    ]],
    ['crypto', 'Crypto', [
      ['BTC-USD', 'Bitcoin'],
      ['ETH-USD', 'Ethereum'],
      ['SOL-USD', 'Solana'],
      ['XRP-USD', 'XRP'],
    ]],
    ['devises', trad('Devises'), [
      ['EURUSD=X',  'EUR/USD'],
      ['EURGBP=X',  'EUR/GBP'],
      ['EURCHF=X',  'EUR/CHF'],
      ['EURJPY=X',  'EUR/JPY'],
      ['DX-Y.NYB',  'Dollar index'],
    ]],
  ];
  const FAMILLE_PAR_DEFAUT = FAMILLES_REPERES[0][0];
  const listeFamille = cle =>
    (FAMILLES_REPERES.find(f => f[0] === cle) || FAMILLES_REPERES[0])[2];

  const cacheReperes = new Map();

  /* Un seul chemin pour redemander : `oublierReperes()`. Aucun drapeau ici
     pour contourner le cache : une seconde porte que personne n'emprunte
     donnerait a lire un cablage qui n'existe pas. */
  async function reperes(famille = FAMILLE_PAR_DEFAUT) {
    const cle = FAMILLES_REPERES.some(f => f[0] === famille) ? famille : FAMILLE_PAR_DEFAUT;
    const garde = cacheReperes.get(cle);
    if (garde && (Date.now() - garde.at) / 1000 < 300) return garde.lignes;
    const liste = listeFamille(cle);
    const syms = liste.map(r => r[0]).join(',');
    const r = await fetch(`${BASE}/api/quotes?symbols=${encodeURIComponent(syms)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`marches indisponibles (HTTP ${r.status})`);
    const par = new Map(((await r.json()).quotes || []).map(x => [x.symbol, x]));
    const lignes = liste.map(([sym, nom]) => {
      const x = par.get(sym) || {};
      const prix = Number(x.price), veille = Number(x.previousClose);
      const utilisable = Number.isFinite(prix) && Number.isFinite(veille) && veille !== 0;
      /* La meme garde que sur une ligne de titres, et pour la meme raison : un
         cours qui date d'avant minuit ne fait pas la "variation du jour".
         Sans elle, le ruban afficherait sous un soleil le mouvement de la
         veille, sans rien qui le dise. La regle vaut pour tout ce qui compare
         un prix a une cloture, pas pour les seules positions.
         `coteAujourdhui()` lit `quoteTime`, `marketState` et `session` : le
         repere porte les trois. */
      const horsSeance = utilisable && !coteAujourdhui({
        quoteTime: x.time || null, marketState: x.marketState || null, session: x.session || null,
      });
      return { symbole: sym, nom, prix, veille, devise: x.currency || '',
               pct: utilisable && !horsSeance ? (prix - veille) / veille * 100 : null,
               horsSeance,
               /* L'etat de la place et les horaires de seance arrivent dans
                  la reponse et se gardent ici : `marketStatus()` les lit --
                  c'est ce qui allume le soleil ou la lune sur la tuile.
                  Bitcoin et l'EUR/USD n'ont pas besoin d'un cas
                  particulier : leur etat se deduit des donnees recues,
                  comme celui de toute autre ligne. */
               marketState: x.marketState || null,
               session: x.session || null,
               quoteTime: x.time || null,
               ok: utilisable };
    });
    cacheReperes.set(cle, { lignes, at: Date.now() });
    return lignes;
  }

  function oublierReperes() {
    cacheReperes.clear();
  }

  /* Ce qui est en route, pour que l'ecran ne dise pas "jamais actualises"
     pendant qu'une actualisation tourne. `suivre` compte aussi une attente qui
     precede l'appel, celle de la sonde de la passerelle. */
  let enVol = 0;
  const suivre = promesse => {
    enVol++;
    return Promise.resolve(promesse).finally(() => { enVol--; });
  };

  return { health, healthData, isOnline, refresh: (...a) => suivre(refresh(...a)),
           suivre, enCours: () => enVol > 0, search, plan, resolveIsin, resolveMissing,
           reperes, oublierReperes, famillesReperes: () => FAMILLES_REPERES.map(([cle, nom]) => [cle, nom]),
           familleParDefaut: FAMILLE_PAR_DEFAUT, BASE };
})();
