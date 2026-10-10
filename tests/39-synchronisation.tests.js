partieDeTests('tests/39-synchronisation.tests.js');
/* ------------------------------------------------------------------
   La synchronisation et les cours, joues pour de bon.

   `cloudsync.js` et `quotes.js` s'evaluent dans un bac a sable : un faux
   serveur qui applique la regle de base du worker KV, un faux stockage, un faux
   `sendBeacon` dont on livre le corps quand on veut. Aucune requete ne part, et
   le stockage reel de cette origine n'est jamais touche. Les relectures de
   source qui gardaient ces chemins ne jouaient aucune rencontre entre deux
   etats ; celles-ci les jouent.
   ------------------------------------------------------------------ */
const BacASable = (() => {
  function stockage() {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
             removeItem: k => { m.delete(k); } };
  }

  /* Le serveur KV du worker : une ecriture sans `force` n'est acceptee que si
     sa base est la date en place. Le corps se garde tel qu'il est arrive. */
  function serveur(initial) {
    const s = { corps: initial ? JSON.stringify(initial) : null, puts: 0, refus: 0,
                panne: false, lecturesEnPanne: 0, retenir: false, retenus: [] };
    s.ecrire = (url, corps) => {
      const p = new URL(url, 'http://local').searchParams;
      const avant = s.corps ? JSON.parse(s.corps)?.meta?.savedAt : null;
      if (p.get('force') !== '1' && avant && p.get('base') !== avant) {
        s.refus++;
        return { status: 409, body: { error: 'conflit', remoteSavedAt: avant,
          localSavedAt: JSON.parse(corps)?.meta?.savedAt, base: p.get('base') } };
      }
      s.corps = corps;
      s.puts++;
      return { status: 200, body: { ok: true } };
    };
    const reponse = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
    s.fetch = async (url, init = {}) => {
      if (s.panne) throw new Error('reseau coupe');
      if ((init.method || 'GET') === 'GET') {
        if (s.lecturesEnPanne > 0) { s.lecturesEnPanne--; throw new Error('lecture coupee'); }
        return s.corps ? reponse(200, JSON.parse(s.corps)) : reponse(204, null);
      }
      if (s.retenir) await new Promise(r => s.retenus.push(r));
      const r = s.ecrire(url, init.body);
      return reponse(r.status, r.body);
    };
    return s;
  }

  function charger({ srv, st, store, beacon = () => true }) {
    const beacons = [];
    const navigator = { sendBeacon: (url, blob) => {
      const ok = beacon();
      if (ok) beacons.push({ url, blob });
      return ok;
    } };
    const Quotes = { healthData: async () => ({ storage: 'kv', user: null, userId: null }) };
    const cs = new Function('Store', 'Quotes', 'fetch', 'navigator', 'localStorage', 'setTimeout', 'clearTimeout',
      lireSource('assets/cloudsync.js') + '\nreturn CloudSync;')(
      store, Quotes, srv.fetch, navigator, st, () => 0, () => {});
    cs.livrerBeacons = async () => {
      for (const b of beacons.splice(0)) srv.ecrire(b.url, await b.blob.text());
    };
    cs.beaconsEnAttente = () => beacons.length;
    return cs;
  }

  return { stockage, serveur, charger };
})();

/* Un etat minimal, tel que la synchronisation le voit : une date et un corps. */
const etatSync = (at, extra = {}) => ({ positions: [], monthly: [], meta: { savedAt: at }, ...extra });
const T1 = '2026-10-01T10:00:00.000Z', T2 = '2026-10-01T11:00:00.000Z', T3 = '2026-10-01T12:00:00.000Z';
const calme = () => new Promise(r => setTimeout(r, 0));

/* Un appareil aligne sur un serveur qui porte T1. */
async function appareilAligne(options = {}) {
  const srv = BacASable.serveur(etatSync(T1));
  const st = BacASable.stockage();
  const store = { state: etatSync(T1) };
  const cs = BacASable.charger({ srv, st, store, ...options });
  const r = await cs.init();
  return { srv, st, store, cs, r };
}

suite('La fermeture d’onglet ne marque rien comme envoyé sans preuve', () => {
  test('un beacon refusé par le navigateur : l’envoi suivant part', async () => {
    const { srv, store, cs } = await appareilAligne({ beacon: () => false });
    vrai(cs.aJour(), 'aligné au départ');
    store.state = etatSync(T2, { positions: [{ id: 'p1' }] });
    cs.flushOnUnload();
    eq(srv.puts, 0, 'rien n’est arrivé');
    vrai(!cs.aJour(), 'et le témoin ne le prétend pas');
    await cs.reprendre();
    eq(srv.puts, 1, 'le retour sur la page envoie');
    eq(JSON.parse(srv.corps).meta.savedAt, T2, 'la version en ligne est la bonne');
    vrai(cs.aJour(), 'puis le témoin le dit');
  });

  test('un beacon arrivé : pas de conflit contre soi-même au retour', async () => {
    const { srv, store, cs } = await appareilAligne();
    store.state = etatSync(T2, { positions: [{ id: 'p1' }] });
    cs.flushOnUnload();
    cs.flushOnUnload();
    eq(cs.beaconsEnAttente(), 1, 'caché puis déchargé : un seul beacon');
    await cs.livrerBeacons();
    eq(srv.puts, 1, 'le beacon est arrivé');
    await cs.reprendre();
    eq(cs.status().conflict, null, 'aucun conflit');
    eq(srv.puts, 1, 'et aucune écriture de plus pour le même corps');
    vrai(cs.aJour(), 'repère aligné sur le beacon');
  });

  test('un beacon arrivé puis une nouvelle saisie : l’envoi passe', async () => {
    const { srv, store, cs } = await appareilAligne();
    store.state = etatSync(T2, { positions: [{ id: 'p1' }] });
    cs.flushOnUnload();
    await cs.livrerBeacons();
    store.state = etatSync(T3, { positions: [{ id: 'p1' }, { id: 'p2' }] });
    const r = await cs.push();
    vrai(r && r.ok, 'l’envoi aboutit');
    eq(cs.status().conflict, null, 'sans conflit');
    eq(JSON.parse(srv.corps).meta.savedAt, T3, 'la saisie est en ligne');
    vrai(cs.aJour(), 'et le témoin le dit');
  });

  test('deux beacons, le premier arrivé, le second refusé : la saisie la plus récente passe', async () => {
    const { srv, store, cs } = await appareilAligne();
    store.state = etatSync(T2, { positions: [{ id: 'p1' }] });
    cs.flushOnUnload();
    store.state = etatSync(T3, { positions: [{ id: 'p1' }, { id: 'p2' }] });
    cs.flushOnUnload();
    eq(cs.beaconsEnAttente(), 2, 'deux corps confiés');
    await cs.livrerBeacons();
    eq(JSON.parse(srv.corps).meta.savedAt, T2, 'le premier est en ligne, le second refusé');
    const r = await cs.reprendre();
    vrai(r && r.ok, 'la reprise aboutit');
    eq(cs.status().conflict, null, 'sans conflit');
    eq(JSON.parse(srv.corps).meta.savedAt, T3, 'la saisie la plus récente est en ligne');
  });

  test('une lecture qui échoue après le refus n’est pas un conflit', async () => {
    const { srv, store, cs } = await appareilAligne();
    store.state = etatSync(T2, { positions: [{ id: 'p1' }] });
    cs.flushOnUnload();
    await cs.livrerBeacons();
    srv.lecturesEnPanne = 1;
    const r = await cs.reprendre();
    vrai(r && r.error, 'une panne, pas un verdict');
    eq(cs.status().conflict, null, 'aucun conflit annoncé');
    const r2 = await cs.reprendre();
    vrai(r2 && r2.ok, 'la reprise suivante reconnaît le beacon');
    vrai(cs.aJour(), 'et le repère s’aligne');
  });

  test('même date que le beacon, autre corps : un vrai conflit', async () => {
    const { srv, store, cs } = await appareilAligne();
    store.state = etatSync(T2, { positions: [{ id: 'p1' }] });
    cs.flushOnUnload();
    /* Un autre appareil a ecrit, a la meme date, autre chose : le beacon
       arrive apres lui et se fait refuser. */
    srv.corps = JSON.stringify(etatSync(T2, { positions: [{ id: 'autre' }] }));
    await cs.livrerBeacons();
    const r = await cs.reprendre();
    vrai(r && r.conflict, 'la date seule ne prouve rien : conflit');
    vrai(!!cs.status().conflict, 'et le conflit se voit');
    eq(JSON.parse(srv.corps).positions[0].id, 'autre', 'la version en ligne n’est pas écrasée');
  });
});

suite('Le témoin suit le corps, pas seulement la date', () => {
  test('une écriture dérivée qui n’est pas partie n’est pas « en ligne »', async () => {
    const { srv, store, cs } = await appareilAligne();
    store.state = etatSync(T1, { quotes: { lastRun: 'x' } });
    srv.panne = true;
    await cs.push();
    vrai(!cs.aJour(), 'même date, autre corps, envoi en échec : pas en ligne');
    srv.panne = false;
    await cs.push();
    vrai(cs.aJour(), 'l’envoi abouti le rend vrai');
    eq(JSON.parse(srv.corps).quotes.lastRun, 'x', 'et le cloud porte la donnée');
  });

  test('elle repart au chargement suivant, à dates égales', async () => {
    const { srv, st, store, cs } = await appareilAligne();
    store.state = etatSync(T1, { quotes: { lastRun: 'x' } });
    srv.panne = true;
    await cs.push();
    srv.panne = false;
    /* Rechargement : une nouvelle instance, le meme stockage, le meme etat. */
    const cs2 = BacASable.charger({ srv, st, store });
    const r = await cs2.init();
    eq(r.aEnvoyer, true, 'l’écriture jamais acceptée part au démarrage');
    await cs2.push();
    vrai(cs2.aJour(), 'puis elle est en ligne');
    eq(JSON.parse(srv.corps).quotes.lastRun, 'x', 'le cloud la porte');
  });

  test('une ancienne installation sans repère de corps n’est pas supposée alignée', async () => {
    const srv = BacASable.serveur(etatSync(T1));
    const st = BacASable.stockage();
    st.setItem('wealth-dashboard:synced-at', T1);
    const store = { state: etatSync(T1, { quotes: { lastRun: 'x' } }) };
    const cs = BacASable.charger({ srv, st, store });
    const r = await cs.init();
    eq(r.aEnvoyer, true, 'corps différent, aucun repère : il part');
    const store2 = { state: etatSync(T1) };
    const st2 = BacASable.stockage();
    st2.setItem('wealth-dashboard:synced-at', T1);
    const cs2 = BacASable.charger({ srv: BacASable.serveur(etatSync(T1)), st: st2, store: store2 });
    const r2 = await cs2.init();
    vrai(!r2.aEnvoyer, 'corps identique : rien à envoyer');
    vrai(cs2.aJour(), 'et le repère se pose');
  });

  test('dates égales, corps local reconnu, corps distant différent : on prend la version en ligne', async () => {
    const { srv, st, store } = await appareilAligne();
    srv.corps = JSON.stringify(etatSync(T1, { quotes: { lastRun: 'ailleurs' } }));
    const cs2 = BacASable.charger({ srv, st, store });
    const r = await cs2.init();
    vrai(r.adopted, 'l’écart vient d’un autre appareil : adopter');
    eq(r.data.quotes.lastRun, 'ailleurs', 'sa version');
  });

  test('après un état illisible, rien ne part tant que la version en ligne n’est pas reprise', async () => {
    const srv = BacASable.serveur(etatSync(T1, { positions: [{ id: 'vrai' }] }));
    srv.lecturesEnPanne = 1;
    const st = BacASable.stockage();
    st.setItem('wealth-dashboard:synced-at', T1);
    const store = { state: etatSync('', { positions: [{ id: 'graine' }] }), envoiSuspendu: true };
    const cs = BacASable.charger({ srv, st, store, beacon: () => true });
    const r = await cs.init();
    vrai(r.error, 'la lecture a échoué');
    store.state = etatSync(T2, { positions: [{ id: 'graine' }] });
    const p = await cs.push();
    vrai(p && p.suspendu, 'l’envoi ordinaire est suspendu');
    cs.flushOnUnload();
    eq(cs.beaconsEnAttente(), 0, 'la fermeture n’envoie rien non plus');
    eq(srv.puts, 0, 'la version en ligne est intacte');
    store.envoiSuspendu = false;
    const p2 = await cs.push();
    vrai(p2 && p2.ok, 'levée par la reprise, l’envoi repart');
  });

  test('deux appareils, la même milliseconde : celui qui n’a pas lu la date ne l’impose pas', async () => {
    const T0 = '2026-10-01T09:00:00.000Z';
    const srv = BacASable.serveur(etatSync(T1, { positions: [{ id: 'A' }] }));
    const st = BacASable.stockage();
    st.setItem('wealth-dashboard:synced-at', T0);
    const store = { state: etatSync(T1, { positions: [{ id: 'B' }] }) };
    const cs = BacASable.charger({ srv, st, store });
    const r = await cs.init();
    vrai(r.newer, 'même date, corps différent, date jamais lue ici : conflit');
    eq(srv.puts, 0, 'rien ne part');
    eq(JSON.parse(srv.corps).positions[0].id, 'A', 'la décision de l’autre appareil reste en ligne');
  });

  test('deux écritures dérivées pendant un envoi : la première réponse n’aligne pas la seconde', async () => {
    const { srv, store, cs } = await appareilAligne();
    const vus = [];
    cs.setOnChange(() => vus.push(cs.aJour()));
    store.state = etatSync(T1, { quotes: { lastRun: 'a' } });
    srv.retenir = true;
    const p1 = cs.push();
    await calme();
    store.state = etatSync(T1, { quotes: { lastRun: 'b' } });
    cs.push();
    srv.retenir = false;
    srv.retenus.shift()();
    await p1;
    await calme(); await calme();
    eq(vus[0], false, 'quand la première réponse arrive, la seconde attend encore');
    vrai(cs.aJour(), 'puis le second envoi l’aligne');
    eq(JSON.parse(srv.corps).quotes.lastRun, 'b', 'et le cloud porte la dernière');
  });

  test('une adoption suivie d’une migration envoie l’état migré', async () => {
    const { srv, store, cs } = await appareilAligne();
    const recu = JSON.stringify(etatSync(T2, { positions: [{ id: 'p1' }] }));
    srv.corps = recu;
    /* La migration change le corps en place, apres sa lecture. */
    store.state = { ...JSON.parse(recu), schemaVersion: 9 };
    cs.noterVersionLue(T2, recu);
    vrai(!cs.aJour(), 'l’état migré n’est pas en ligne');
    const r = await cs.push();
    vrai(r && r.ok, 'il part, avec la base lue');
    vrai(cs.aJour(), 'puis il l’est');
    eq(JSON.parse(srv.corps).schemaVersion, 9, 'le cloud porte l’état migré');
  });

  test('l’adoption note le corps reçu avant la migration, et n’écrit qu’en passant par le verrou', () => {
    const app = lireSource('assets/app.js');
    const i = app.indexOf('async function prendreVersionEnLigne(');
    const fn = app.slice(i, app.indexOf('\n  }\n', i));
    const ordre = ['const recu = JSON.stringify(donnees);', 'Store.migrate();',
      'CloudSync.noterVersionLue(quand, recu);', 'Store.ecrireLocal()', 'if (!CloudSync.aJour()) CloudSync.push();'];
    const pos = ordre.map(x => fn.indexOf(x));
    vrai(pos.every(p => p > 0), `les cinq gestes sont là : ${pos.join(', ')}`);
    vrai(pos.every((p, k) => !k || p > pos[k - 1]), 'dans cet ordre');
    vrai(/if \(ecrit\) toast\(trad\(mot\)\);\s*else Store\.signalerEchecEcriture\(\);/.test(fn),
      'un refus d’écriture ne s’annonce pas comme une réussite');
    vrai(/Store\.leverSuspension\(\);/.test(fn), 'et la version reprise lève la suspension');
  });
});

/* --- Un etat local illisible -----------------------------------------------
   Ces tests touchent le vrai `Store` et le stockage de cette origine : les
   chaines brutes de la clef reelle, de la clef d'exemple et de leurs copies
   illisibles sont mises de cote et remises telles quelles. */
suite('Un état local illisible n’est plus écrasé', () => {
  const avecStockagePreserve = faire => {
    const demo0 = modeDemo();
    const cles = [];
    for (const d of [false, true]) { setModeDemo(d); cles.push(cleStockage(), cleIllisible()); }
    setModeDemo(demo0);
    const avant = cles.map(k => [k, localStorage.getItem(k)]);
    const etat0 = Store.state, ill0 = Store.illisible, ko0 = Store._ecritureKo;
    const flash0 = Object.getOwnPropertyDescriptor(globalThis, 'flashSaved');
    const cs0 = Object.getOwnPropertyDescriptor(globalThis, 'CloudSync');
    if (!flash0) globalThis.flashSaved = () => {};
    let envois = 0;
    globalThis.CloudSync = { isAvailable: () => true, status: () => ({}), aJour: () => true, getUser: () => null,
                             push() { envois++; }, schedulePush() { envois++; } };
    try { faire(() => envois); }
    finally {
      setModeDemo(demo0);
      for (const [k, v] of avant) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
      if (!flash0) delete globalThis.flashSaved;
      if (cs0) Object.defineProperty(globalThis, 'CloudSync', cs0); else delete globalThis.CloudSync;
      Store.state = etat0; Store.illisible = ill0; Store._ecritureKo = ko0;
      Fixture.poser();
    }
    for (const [k, v] of avant) eq(localStorage.getItem(k), v, `${k} rendue telle quelle`);
  };

  test('la chaîne brute est copiée à côté, et un contrôle le dit', () => {
    avecStockagePreserve(() => {
      setModeDemo(false);
      localStorage.removeItem(cleIllisible());
      localStorage.setItem(cleStockage(), '{pas du json');
      Store.load();
      vrai(!!Store.illisibleActif(), 'l’échec est constaté');
      vrai(Store.illisibleActif().garde, 'la copie est posée');
      vrai(Store.envoiSuspendu, 'et l’envoi en ligne est suspendu');
      eq(localStorage.getItem(cleIllisible()), '{pas du json', 'telle quelle');
      eq(Store.texteIllisible(), '{pas du json', 'et c’est elle qui se télécharge');
      vrai(healthChecks().some(c => c.level === 'error' && c.title === trad('Données de cet appareil illisibles')),
        'le contrôle d’erreur parle');
      Store.oublierIllisible();
      eq(localStorage.getItem(cleIllisible()), null, 'supprimer la copie l’efface');
      eq(Store.illisibleActif(), null, 'et le contrôle se tait');
    });
  });

  test('sans place pour la copie, rien n’écrit par-dessus la chaîne brute', () => {
    avecStockagePreserve(envois => {
      setModeDemo(false);
      localStorage.removeItem(cleIllisible());
      localStorage.setItem(cleStockage(), '{pas du json');
      const ecrire0 = Storage.prototype.setItem;
      const cleCopie = cleIllisible();
      Storage.prototype.setItem = function (k, v) {
        if (k === cleCopie) throw new DOMException('plein', 'QuotaExceededError');
        return ecrire0.call(this, k, v);
      };
      try { Store.load(); } finally { Storage.prototype.setItem = ecrire0; }
      eq(Store.illisibleActif().garde, false, 'la copie n’a pas pu se poser');
      eq(Store.ecrireLocal(), false, 'l’écriture locale refuse');
      Store.save();
      eq(localStorage.getItem(cleStockage()), '{pas du json', 'la chaîne brute est intacte');
      eq(envois(), 0, 'et rien ne part en ligne');
      eq(Store.texteIllisible(), '{pas du json', 'elle se télécharge depuis la clef principale');
      /* Le mode exemple ecrit sa propre clef : il n'est pas bloque. */
      setModeDemo(true);
      eq(Store.illisibleActif(), null, 'en exemple, aucun verrou');
      eq(Store.ecrireLocal(), true, 'la clef d’exemple s’écrit');
      setModeDemo(false);
      eq(localStorage.getItem(cleStockage()), '{pas du json', 'la chaîne réelle n’a toujours pas bougé');
    });
  });

  test('la suspension survit au rechargement : la graine ne part jamais', async () => {
    const demo0 = modeDemo();
    setModeDemo(false);
    const cles = [cleStockage(), cleIllisible()];
    const avant = cles.map(k => [k, localStorage.getItem(k)]);
    const etat0 = Store.state, ill0 = Store.illisible, ko0 = Store._ecritureKo;
    const flash0 = Object.getOwnPropertyDescriptor(globalThis, 'flashSaved');
    const cs0 = Object.getOwnPropertyDescriptor(globalThis, 'CloudSync');
    if (!flash0) globalThis.flashSaved = () => {};
    globalThis.CloudSync = { isAvailable: () => true, status: () => ({}), push() {}, schedulePush() {} };
    try {
      localStorage.removeItem(cleIllisible());
      localStorage.setItem(cleStockage(), '{pas du json');
      Store.load();
      vrai(Store.envoiSuspendu, 'suspendu au constat');
      Store.save();
      vrai(localStorage.getItem(cleStockage()) !== '{pas du json', 'la graine s’écrit en local, la copie étant gardée');
      Store.load();
      vrai(Store.envoiSuspendu, 'le rechargement relit la graine sans erreur, et la suspension tient');
      eq(JSON.parse(localStorage.getItem(cleStockage())).meta.envoiSuspendu, true, 'elle est écrite avec la graine');
      /* Le cloud repond maintenant : la vraie version en ligne. */
      const srv = BacASable.serveur(etatSync(T1, { positions: [{ id: 'vrai' }] }));
      const st = BacASable.stockage();
      st.setItem('wealth-dashboard:synced-at', T1);
      const cs = BacASable.charger({ srv, st, store: Store });
      const r = await cs.init();
      vrai(r.adopted, 'la version en ligne se prend');
      eq(r.data.positions[0].id, 'vrai', 'c’est bien elle');
      const p = await cs.push();
      vrai(p && p.suspendu, 'tant qu’elle n’est pas reprise, rien ne part');
      eq(srv.puts, 0, 'aucune graine en ligne');
      srv.panne = true;
      const echec = await cs.push({ force: true });
      vrai(echec && echec.error, 'un « Imposer » qui échoue');
      vrai(Store.envoiSuspendu, 'laisse tout suspendu');
      srv.panne = false;
      const f = await cs.push({ force: true });
      vrai(f && f.ok, 'un « Imposer » qui aboutit');
      vrai(!Store.envoiSuspendu, 'lève la suspension');
      eq(JSON.parse(srv.corps).meta.envoiSuspendu, undefined, 'sans que le drapeau parte en ligne');
      eq(JSON.parse(localStorage.getItem(cleStockage())).meta.envoiSuspendu, undefined,
        'et l’état local se réécrit sans lui');
      Store.load();
      vrai(!Store.envoiSuspendu, 'le rechargement ne suspend plus');
    } finally {
      setModeDemo(demo0);
      for (const [k, v] of avant) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
      if (!flash0) delete globalThis.flashSaved;
      if (cs0) Object.defineProperty(globalThis, 'CloudSync', cs0); else delete globalThis.CloudSync;
      Store.state = etat0; Store.illisible = ill0; Store._ecritureKo = ko0;
      Fixture.poser();
    }
    for (const [k, v] of avant) eq(localStorage.getItem(k), v, `${k} rendue telle quelle`);
  });

  test('un échec d’écriture se rétablit à la première écriture réussie', () => {
    avecStockagePreserve(() => {
      const sig0 = signalerEcriture;
      const vus = [];
      poserSignalEcriture((ok, premier) => vus.push(`${ok}:${!!premier}`));
      try {
        setModeDemo(false);
        Store.illisible = null; Store.leverSuspension(); Store._ecritureKo = false;
        Store.signalerEchecEcriture();
        Store.save();
        eq(vus.join(' '), 'false:true true:false', 'l’échec, puis le rétablissement');
      } finally { poserSignalEcriture(sig0); }
    });
  });

  test('un échec en exemple ne touche pas la copie des données réelles', () => {
    avecStockagePreserve(() => {
      setModeDemo(false);
      localStorage.removeItem(cleIllisible());
      setModeDemo(true);
      localStorage.setItem(cleStockage(), '{illisible en exemple');
      Store.load();
      vrai(!!Store.illisibleActif(), 'constaté en exemple');
      setModeDemo(false);
      eq(localStorage.getItem(cleIllisible()), null, 'la copie réelle n’existe pas');
      eq(Store.illisibleActif(), null, 'et le réel n’est pas verrouillé');
    });
  });

  test('aucune écriture de la clef principale hors de ecrireLocal()', () => {
    for (const f of ['assets/app.js', 'assets/store.js']) {
      const src = lireSource(f).replace(/\/\*[\s\S]*?\*\//g, '');
      const n = (src.match(/localStorage\.setItem\(cleStockage\(\)/g) || []).length;
      eq(n, f === 'assets/store.js' ? 1 : 0, `${f} : ${n} écriture(s) directe(s)`);
    }
    const st = lireSource('assets/store.js');
    const i = st.indexOf('  ecrireLocal() {');
    vrai(i > 0 && /localStorage\.setItem\(cleStockage\(\)/.test(st.slice(i, st.indexOf('\n  },', i))),
      'la seule est dans ecrireLocal()');
  });
});

/* --- Le change d'une devise de cours ----------------------------------------
   `quotes.js` dans le bac a sable : un faux `fetch` repond par symbole, et
   `Store.save` est un temoin. Les positions sont celles du fixture. */
suite('Un cours qui change de devise prend son propre change', () => {
  function chargerQuotes(repondre) {
    const appels = [];
    const enregistrements = [];
    const fetch = async url => {
      appels.push(url);
      const symboles = decodeURIComponent(String(url).split('symbols=')[1] || '').split(',');
      const table = repondre(symboles, appels.length);
      if (!table) return { ok: false, status: 502, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ quotes: symboles.map(s => table[s] || { error: 'inconnu' }) }) };
    };
    const store = { get state() { return Store.state; }, save(o) { enregistrements.push(o); } };
    const Q = new Function('Store', 'fetch', 'location', lireSource('assets/quotes.js') + '\nreturn Quotes;')(
      store, fetch, { protocol: 'http:' });
    return { Q, appels, enregistrements };
  }
  const etf = () => Store.state.positions.find(p => p.id === 'p_etf');

  test('une devise nouvelle demande sa paire dans une seconde requête', async () => {
    Fixture.poser(s => { s.quotes = { fxBase: 'EUR' }; });
    const { Q, appels } = chargerQuotes((symboles, n) => n === 1
      ? { IWDA: { price: 100, currency: 'USD' }, GOLD: { price: 76, currency: 'EUR' } }
      : { 'EURUSD=X': { price: 1.25 } });
    await Q.refresh();
    eq(appels.length, 2, 'deux requêtes');
    vrai(/EURUSD%3DX|EURUSD=X/.test(appels[1]), 'la seconde demande EURUSD');
    eq(etf().currency, 'USD', 'la ligne passe en dollars');
    eq(etf().fx, 0.8, 'avec le change du dollar');
    eq(etf().price, 100, 'et son cours');
    Fixture.poser();
  });

  test('change indisponible : la ligne n’est pas touchée, et le dit', async () => {
    Fixture.poser(s => { s.quotes = { fxBase: 'EUR' }; });
    const { Q } = chargerQuotes((symboles, n) => n === 1
      ? { IWDA: { price: 100, currency: 'USD' }, GOLD: { price: 76, currency: 'EUR' } } : null);
    const r = await Q.refresh();
    eq(etf().currency, 'EUR', 'devise inchangée');
    eq(etf().price, 90, 'cours inchangé');
    eq(etf().fx, 1, 'change inchangé');
    const err = r.changes.find(c => c.symbol === 'IWDA');
    eq(err && err.error, trad('Change {c} indisponible').replace('{c}', 'USD'), 'l’erreur nomme la devise');
    eq(Store.state.positions.find(p => p.id === 'p_or').price, 76, 'les autres lignes avancent');
    Fixture.poser();
  });

  test('devise inchangée sans change du jour : l’ancien taux reste, s’il vaut quelque chose', async () => {
    Fixture.poser(s => {
      s.quotes = { fxBase: 'EUR' };
      const p = s.positions.find(x => x.id === 'p_etf'); p.currency = 'USD'; p.fx = 0.9; p.fxBase = 'EUR';
    });
    const { Q } = chargerQuotes((symboles, n) => n === 1 ? { IWDA: { price: 101, currency: 'USD' }, GOLD: { price: 76 } } : null);
    await Q.refresh();
    eq(etf().fx, 0.9, 'l’ancien taux sert');
    eq(etf().price, 101, 'et le cours avance');
    Fixture.poser(s => {
      s.quotes = { fxBase: 'EUR' };
      const p = s.positions.find(x => x.id === 'p_etf'); p.currency = 'USD'; p.fx = 0; p.fxBase = 'EUR';
    });
    const { Q: Q2 } = chargerQuotes((symboles, n) => n === 1 ? { IWDA: { price: 101, currency: 'USD' }, GOLD: { price: 76 } } : null);
    await Q2.refresh();
    eq(etf().price, 90, 'un ancien taux nul ne sert pas : la ligne reste');
    Fixture.poser();
  });

  test('devise du profil changée : l’ancien taux ne vaut plus, même au passage suivant', async () => {
    Fixture.poser(s => {
      s.meta.devise = 'USD';
      s.quotes = { fxBase: 'EUR' };
      const p = s.positions.find(x => x.id === 'p_etf'); p.currency = 'GBP'; p.fx = 1.15;
    });
    for (const passage of [1, 2]) {
      const { Q } = chargerQuotes((symboles, n) => n === 1 ? { IWDA: { price: 7, currency: 'GBP' }, GOLD: { price: 80, currency: 'USD' } } : null);
      const r = await Q.refresh();
      eq(etf().fx, 1.15, `passage ${passage} : la ligne n’est pas touchée`);
      eq(etf().price, 90, `passage ${passage} : ni son cours`);
      vrai(r.changes.some(c => c.symbol === 'IWDA' && c.error), `passage ${passage} : et elle le dit`);
    }
    eq(Store.state.quotes.fxBase, 'USD', 'la marque globale a pourtant suivi le profil');
    vrai(!etf().fxBase, 'la ligne, elle, n’a pas de taux de provenance connue');
    Fixture.poser();
  });

  test('un taux sans provenance ne sert pas, même sous une marque globale à jour', async () => {
    /* L'etat que laissait l'ancien rafraichissement : un taux garde d'une
       autre devise, une marque globale a jour, aucune marque de ligne. */
    Fixture.poser(s => {
      s.quotes = { fxBase: 'EUR' };
      const p = s.positions.find(x => x.id === 'p_etf'); p.currency = 'USD'; p.fx = 1.17;
    });
    const { Q } = chargerQuotes((symboles, n) => n === 1 ? { IWDA: { price: 101, currency: 'USD' }, GOLD: { price: 76 } } : null);
    const r = await Q.refresh();
    eq(etf().price, 90, 'la ligne attend son change');
    eq(etf().fx, 1.17, 'son taux n’est pas réutilisé');
    vrai(r.changes.some(c => c.symbol === 'IWDA' && c.error), 'et elle le dit');
    Fixture.poser();
  });
});

finDePartieDeTests('tests/39-synchronisation.tests.js');
