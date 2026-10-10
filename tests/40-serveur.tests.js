partieDeTests('tests/40-serveur.tests.js');
/* ------------------------------------------------------------------
   Le serveur, joue pour de bon.

   `_worker.js` est un module : la page de tests l'importe tel quel et appelle
   son `fetch` avec un `env` factice. Chaque test importe une instance neuve
   (parametre unique dans l'adresse), pour que l'etat du module -- le frein en
   memoire -- ne passe pas d'un test a l'autre. Les fournisseurs de cours sont
   remplaces, le temps d'un test, par un `fetch` qui compte et repond vide :
   aucune requete ne sort.
   ------------------------------------------------------------------ */
let importsDuServeur = 0;
const serveurNeuf = async () =>
  (await import(`/_worker.js?test=${Date.now()}-${++importsDuServeur}`)).default;
const requeteServeur = (chemin, ip = '203.0.113.7') =>
  new Request('https://longward.test' + chemin, { headers: { 'CF-Connecting-IP': ip } });
const assetsFactices = { fetch: async () => new Response('application', { status: 200 }) };

/* Un fournisseur qui compte ses appels et ne connait rien. */
async function avecFournisseurFactice(faire) {
  const fetch0 = globalThis.fetch;
  const appels = { n: 0 };
  globalThis.fetch = async () => { appels.n++; return new Response('{}', { status: 404 }); };
  try { await faire(appels); } finally { globalThis.fetch = fetch0; }
}

suite('L’ouverture publique se réserve au site sans comptes', () => {
  test('sans mot de passe ni comptes, l’application est servie', async () => {
    const w = await serveurNeuf();
    const r = await w.fetch(requeteServeur('/'), { ASSETS: assetsFactices });
    eq(r.status, 200, 'la démonstration est ouverte');
    eq(await r.text(), 'application', 'et c’est l’application qui répond');
  });

  test('avec des comptes branchés, un anonyme reçoit la connexion', async () => {
    const w = await serveurNeuf();
    const DB = { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }), run: async () => ({}) }) };
    const r = await w.fetch(requeteServeur('/'), {
      ASSETS: assetsFactices, SUPABASE_URL: 'https://auth.longward.test', SUPABASE_PUBLISHABLE_KEY: 'cle', DB });
    eq(r.status, 401, 'la page de connexion, pas l’application');
    vrai((await r.text()) !== 'application', 'l’application n’est pas servie');
  });
});

suite('La passerelle de marché a un frein', () => {
  test('le coût se compte en appels sortants au pire, partagé par les trois routes', async () => {
    await avecFournisseurFactice(async appels => {
      const w = await serveurNeuf();
      const quarante = Array.from({ length: 40 }, (_, i) => `S${i}`).join(',');
      /* 6 lots de 40 cotations (6 x 120 = 720), 10 ISIN (130), 50 recherches
         (50) : 900, tout passe. */
      for (let i = 0; i < 6; i++) {
        const r = await w.fetch(requeteServeur('/api/quotes?symbols=' + quarante), {});
        if (r.status === 429) { vrai(false, `le lot ${i + 1} est refusé trop tôt`); return; }
      }
      for (let i = 0; i < 10; i++) {
        const r = await w.fetch(requeteServeur('/api/isin?code=FR000000000' + i), {});
        if (r.status === 429) { vrai(false, `l’ISIN ${i + 1} est refusé trop tôt`); return; }
      }
      for (let i = 0; i < 50; i++) {
        const r = await w.fetch(requeteServeur('/api/search?q=ab' + i), {});
        if (r.status === 429) { vrai(false, `la recherche ${i + 1} est refusée trop tôt`); return; }
      }
      const avant = appels.n;
      vrai(avant > 0, 'les fournisseurs ont bien été appelés jusque-là');
      for (const chemin of ['/api/search?q=cd', '/api/isin?code=FR0000000099', '/api/quotes?symbols=A']) {
        const r = await w.fetch(requeteServeur(chemin), {});
        eq(r.status, 429, `${chemin.split('?')[0]} : le plafond partagé est atteint`);
        const attente = +r.headers.get('Retry-After');
        vrai(attente >= 1 && attente <= 60, `Retry-After dit quand revenir : ${attente}`);
      }
      eq(appels.n, avant, 'et rien ne sort une fois le plafond atteint');
      const autre = await w.fetch(requeteServeur('/api/search?q=ef', '198.51.100.9'), {});
      vrai(autre.status !== 429, `une autre adresse passe le frein (${autre.status} : le fournisseur factice ne connaît rien)`);
    });
  });

  test('la table se fait de la place sans libérer un client freiné, ni un quota épuisé', async () => {
    const w = await serveurNeuf();
    /* `q` d'une lettre : la recherche rend une liste vide sans rien appeler. */
    for (let i = 0; i < 901; i++) await w.fetch(requeteServeur('/api/search?q=a', '192.0.2.1'), {});
    eq((await w.fetch(requeteServeur('/api/search?q=a', '192.0.2.1'), {})).status, 429, 'ce client est freiné');
    /* Celui-ci a consomme exactement son quota : son prochain appel est le refus. */
    for (let i = 0; i < 900; i++) await w.fetch(requeteServeur('/api/search?q=a', '192.0.2.2'), {});
    for (let i = 0; i < 5200; i++) await w.fetch(requeteServeur('/api/search?q=a', `10.${i >> 16 & 255}.${i >> 8 & 255}.${i & 255}`), {});
    eq((await w.fetch(requeteServeur('/api/search?q=a', '192.0.2.1'), {})).status, 429,
      'cinq mille deux cents adresses plus tard, le freiné l’est toujours');
    eq((await w.fetch(requeteServeur('/api/search?q=a', '192.0.2.2'), {})).status, 429,
      'et le quota épuisé n’est pas remis à zéro');
  });

  test('une résolution d’ISIN ne fait jamais plus d’appels que son coût', async () => {
    const fetch0 = globalThis.fetch;
    try {
      for (const cas of ['noms', 'figi']) {
        let n = 0;
        globalThis.fetch = async url => {
          n++;
          const u = String(url);
          if (u.includes('openfigi')) {
            return new Response(JSON.stringify([{ data: ['A', 'B', 'C', 'D', 'E', 'F'].map(t =>
              ({ ticker: t, exchCode: 'FP', name: 'societe ' + t, securityType: 'Common Stock' })) }]), { status: 200 });
          }
          if (u.includes('/finance/search')) {
            const quotes = cas === 'noms' && /q=US0378331005/.test(u)
              ? Array.from({ length: 6 }, (_, i) => ({ symbol: 'N' + i, longname: 'Nom ' + i }))
              : [];
            return new Response(JSON.stringify({ quotes }), { status: 200 });
          }
          return new Response('{}', { status: 404 });
        };
        const w = await serveurNeuf();
        const r = await w.fetch(requeteServeur('/api/isin?code=US0378331005'), {});
        vrai(r.status !== 429, `${cas} : la résolution passe le frein`);
        vrai(n >= 2 && n <= 13, `${cas} : ${n} appels sortants, treize au plus`);
      }
    } finally { globalThis.fetch = fetch0; }
  });

  test('avec D1, le compteur de la base décide, pèse le lot et dit quand revenir', async () => {
    await avecFournisseurFactice(async appels => {
      const w = await serveurNeuf();
      const vus = [];
      const maintenant = Math.floor(Date.now() / 1000);
      const DB = { prepare: sql => ({
        run: async () => { vus.push({ sql, purge: true }); return {}; },
        bind: (...args) => ({ first: async () => { vus.push({ sql, args }); return { count: 901, reset_at: maintenant + 42 }; } }),
      }) };
      const r = await w.fetch(requeteServeur('/api/quotes?symbols=A,B,C'), { DB });
      eq(r.status, 429, 'au-delà du plafond, refusé');
      const attente = +r.headers.get('Retry-After');
      vrai(attente >= 40 && attente <= 43, `Retry-After suit la remise à zéro de la base : ${attente}`);
      const appel = vus.find(v => v.args && String(v.args[0]).startsWith('marche:ip:'));
      vrai(!!appel, 'le seau est celui de la passerelle, par adresse');
      eq(appel && appel.args[2], 9, 'le lot pèse ses trois cotations, trois appels chacune');
      vrai(vus.some(v => v.purge && /bucket LIKE 'marche:%'/.test(v.sql)), 'et les seaux échus se purgent');
      eq(appels.n, 0, 'rien n’est sorti');
    });
  });
});

/* ------------------------------------------------------------------
   Le protocole de l'etat, joue sur le serveur.

   La source du worker est evaluee : `export default {` y devient une
   constante, et la fonction rend les fonctions internes. Rien n'est ajoute au
   module servi. Le faux D1 reconnait les instructions de `SQL_ETAT` par leur
   texte meme, et les applique d'un seul tenant, comme la vraie base ; leur
   semantique SQL est prouvee a part, contre SQLite (controle_sql.py).
   ------------------------------------------------------------------ */
const InternesServeur = (() => {
  let cache = null;
  return () => cache || (cache = new Function(
    lireSource('_worker.js').replace(/export default \{/, 'const __defaut = {')
    + `\nreturn { handleState, servirEtatD1, lireEtatKV, SQL_ETAT, MAX_OCTETS_D1,
        handleStateD1: typeof handleStateD1 === 'function' ? handleStateD1 : null };`)());
})();

function kvEtat(initial = {}) {
  const m = new Map(Object.entries(initial).map(([k, v]) => [k, { value: v, metadata: null }]));
  return { m,
    get: async k => (m.has(k) ? m.get(k).value : null),
    getWithMetadata: async k => (m.has(k) ? { ...m.get(k) } : { value: null, metadata: null }),
    put: async (k, value, o = {}) => { m.set(k, { value, metadata: o.metadata || null }); },
    delete: async k => { m.delete(k); } };
}

function d1Etat(SQL) {
  const lignes = new Map(), sauvegardes = [], bascule = new Map();
  let maintenant = 1000;
  const changes = n => ({ meta: { changes: n } });
  const schemaDe = b => { try { return Number(JSON.parse(b)?.schemaVersion ?? 0) || 0; } catch { return 0; } };
  const exec = (sql, a) => {
    if (/^\s*CREATE TABLE/.test(sql)) return changes(0);
    const l = lignes.get(a[0]);
    switch (sql) {
      case SQL.lire: return l ? { body: l.body, revision: l.revision } : null;
      case SQL.ecrireSurBase: {
        const x = lignes.get(a[2]);
        if (!x || x.revision !== a[3] || x.body === '') return changes(0);
        lignes.set(a[2], { body: a[0], revision: a[1] }); return changes(1);
      }
      case SQL.ecrireSansBase:
        if (l && l.body !== '') return changes(0);
        lignes.set(a[0], { body: a[1], revision: a[2] }); return changes(1);
      case SQL.imposer: lignes.set(a[0], { body: a[1], revision: a[2] }); return changes(1);
      case SQL.sauverSurBase:
        if (l && l.revision === a[1] && l.body !== '' && schemaDe(l.body) !== a[2]) { sauvegardes.push({ owner: a[0], body: l.body }); return changes(1); }
        return changes(0);
      case SQL.sauverAvantImposer:
        if (l && l.body !== '' && schemaDe(l.body) !== a[1]) { sauvegardes.push({ owner: a[0], body: l.body }); return changes(1); }
        return changes(0);
      case SQL.effacer: lignes.set(a[0], { body: '', revision: '' }); return changes(1);
      case SQL.importer:
        if (l) return changes(0);
        lignes.set(a[0], { body: a[1], revision: a[2] }); return changes(1);
      case SQL.purgerSauvegardes: return changes(0);
      case SQL.basculeVue: if (!bascule.has(a[0])) bascule.set(a[0], maintenant); return changes(1);
      case SQL.basculeLire: return bascule.has(a[0]) ? { depuis: maintenant - bascule.get(a[0]) } : null;
    }
    throw new Error('instruction inconnue du faux D1 : ' + sql.slice(0, 60));
  };
  const lier = (sql, args) => ({ sql, args, first: async () => exec(sql, args), run: async () => exec(sql, args) });
  return { lignes, sauvegardes, avancer: s => { maintenant += s; },
    prepare: sql => ({ ...lier(sql, []), bind: (...a) => lier(sql, a) }),
    batch: async stmts => stmts.map(st => exec(st.sql, st.args)) };
}

const corpsEtat = (at, extra = {}) => JSON.stringify({ positions: [], monthly: [], schemaVersion: 2, meta: { savedAt: at }, ...extra });
const requeteEtat = (methode, params = '', corps) =>
  new Request('https://longward.test/api/state' + params, corps === undefined ? { method: methode } : { method: methode, body: corps });
const P1 = '2026-10-01T10:00:00.000Z', P2 = '2026-10-01T11:00:00.000Z', P3 = '2026-10-01T12:00:00.000Z';
const CLE_ETAT = 'state:default';

suite('Le protocole de l’état sur le serveur : KV', () => {
  test('un état d’avant le protocole a sa date pour révision ; chaque écriture tire un jeton', async () => {
    const { handleState } = InternesServeur();
    const WEALTH = kvEtat({ [CLE_ETAT]: corpsEtat(P1) });
    const g = await handleState(requeteEtat('GET'), { WEALTH }, null, true);
    eq(g.headers.get('X-Longward-Revision'), P1, 'la lecture rend la date comme révision');
    const p = await handleState(requeteEtat('PUT', '?proto=2&base=' + P1, corpsEtat(P2)), { WEALTH }, null, true);
    eq(p.status, 200, 'l’écriture sur cette base passe');
    const jeton = (await p.json()).revision;
    vrai(/^r1-/.test(jeton), `et rend un jeton : ${jeton}`);
    eq(WEALTH.m.get(CLE_ETAT).metadata.revision, jeton, 'gardé dans les métadonnées');
    eq((await handleState(requeteEtat('GET'), { WEALTH }, null, true)).headers.get('X-Longward-Revision'), jeton,
      'et rendu par la lecture suivante');
    const vieux = await handleState(requeteEtat('PUT', '?proto=2&base=' + P1, corpsEtat(P3)), { WEALTH }, null, true);
    eq(vieux.status, 409, 'l’ancienne base est refusée');
    eq((await vieux.json()).remoteRevision, jeton, 'avec la révision en place');
  });

  test('sans proto=2, aucune écriture : ni sur base, ni sans base, ni forcée, ni effacement', async () => {
    const { handleState } = InternesServeur();
    const WEALTH = kvEtat({ [CLE_ETAT]: corpsEtat(P1) });
    for (const params of ['?base=' + P1, '', '?force=1']) {
      const r = await handleState(requeteEtat('PUT', params, corpsEtat(P2)), { WEALTH }, null, true);
      eq(r.status, 426, `« ${params || 'sans base'} » : recharge nécessaire`);
    }
    eq((await handleState(requeteEtat('DELETE'), { WEALTH }, null, true)).status, 426, 'effacer aussi');
    eq(JSON.parse(WEALTH.m.get(CLE_ETAT).value).meta.savedAt, P1, 'rien n’a bougé');
  });

  test('une valeur d’avant, sans date, a une révision stable : lecture, puis écriture', async () => {
    const { handleState } = InternesServeur();
    const sansDate = JSON.stringify({ positions: [], monthly: [], meta: {} });
    const WEALTH = kvEtat({ [CLE_ETAT]: sansDate });
    const r1 = (await handleState(requeteEtat('GET'), { WEALTH }, null, true)).headers.get('X-Longward-Revision');
    const r2 = (await handleState(requeteEtat('GET'), { WEALTH }, null, true)).headers.get('X-Longward-Revision');
    vrai(!!r1 && r1 === r2, `une révision non vide et stable : ${r1}`);
    const p = await handleState(requeteEtat('PUT', '?proto=2&base=' + encodeURIComponent(r1), corpsEtat(P1)), { WEALTH }, null, true);
    eq(p.status, 200, 'l’écriture sur cette base passe');
  });

  test('un corps qui revient à une valeur passée ne rend pas sa révision', async () => {
    const { handleState } = InternesServeur();
    const WEALTH = kvEtat();
    const ecrire = async (corps, base) => handleState(requeteEtat('PUT', '?proto=2' + (base ? '&base=' + base : ''), corps), { WEALTH }, null, true);
    const rA = (await (await ecrire(corpsEtat(P1))).json()).revision;
    const rB = (await (await ecrire(corpsEtat(P2), rA)).json()).revision;
    const rA2 = (await (await ecrire(corpsEtat(P1), rB)).json()).revision;
    vrai(rA2 !== rA, 'A, B, puis A : un jeton neuf');
    eq((await ecrire(corpsEtat(P3), rA)).status, 409, 'un appareil resté sur le premier A ne peut pas écrire');
  });
});

suite('Le protocole de l’état sur le serveur : D1', () => {
  test('deux écritures sur la même base : une seule passe', async () => {
    const { servirEtatD1, SQL_ETAT } = InternesServeur();
    const DB = d1Etat(SQL_ETAT);
    const env = { DB };
    const r0 = await servirEtatD1(requeteEtat('PUT', '?proto=2', corpsEtat(P1)), env, 'o1');
    eq(r0.status, 200, 'rien en ligne : la première écriture passe sans base');
    const base = (await r0.json()).revision;
    const [a, b] = await Promise.all([
      servirEtatD1(requeteEtat('PUT', '?proto=2&base=' + base, corpsEtat(P2, { note: 'a' })), env, 'o1'),
      servirEtatD1(requeteEtat('PUT', '?proto=2&base=' + base, corpsEtat(P2, { note: 'b' })), env, 'o1'),
    ]);
    eq([a.status, b.status].sort().join(','), '200,409', 'même date, corps différents : l’une passe, l’autre non');
    eq((await servirEtatD1(requeteEtat('PUT', '?proto=2', corpsEtat(P3)), env, 'o1')).status, 409,
      'sans base sur un état existant : refus');
  });

  test('la sauvegarde de migration n’existe que pour une écriture acceptée', async () => {
    const { servirEtatD1, SQL_ETAT } = InternesServeur();
    const DB = d1Etat(SQL_ETAT);
    const env = { DB };
    const base = (await (await servirEtatD1(requeteEtat('PUT', '?proto=2', corpsEtat(P1)), env, 'o1')).json()).revision;
    eq((await servirEtatD1(requeteEtat('PUT', '?proto=2&base=perimee', corpsEtat(P2, { schemaVersion: 3 })), env, 'o1')).status, 409, 'base périmée');
    eq(DB.sauvegardes.length, 0, 'aucune sauvegarde pour un refus');
    eq((await servirEtatD1(requeteEtat('PUT', '?proto=2&base=' + base, corpsEtat(P2, { schemaVersion: 3 })), env, 'o1')).status, 200, 'migration acceptée');
    eq(DB.sauvegardes.length, 1, 'une sauvegarde');
    eq(JSON.parse(DB.sauvegardes[0].body).schemaVersion, 2, 'de l’état remplacé');
    eq((await servirEtatD1(requeteEtat('PUT', '?proto=2&force=1', corpsEtat(P3, { schemaVersion: 4 })), env, 'o1')).status, 200, 'force');
    eq(DB.sauvegardes.length, 2, 'force sauvegarde aussi ce qu’il remplace');
  });

  test('un état effacé reste effacé, et une écriture sans base repart', async () => {
    const { servirEtatD1, SQL_ETAT } = InternesServeur();
    const DB = d1Etat(SQL_ETAT);
    const env = { DB };
    const base = (await (await servirEtatD1(requeteEtat('PUT', '?proto=2', corpsEtat(P1)), env, 'o1')).json()).revision;
    eq((await servirEtatD1(requeteEtat('DELETE', '?proto=2'), env, 'o1')).status, 200, 'effacé');
    eq((await servirEtatD1(requeteEtat('GET'), env, 'o1')).status, 204, 'se lit comme absent');
    eq((await servirEtatD1(requeteEtat('PUT', '?proto=2&base=' + base, corpsEtat(P2)), env, 'o1')).status, 409,
      'l’ancienne base ne ressuscite rien');
    eq((await servirEtatD1(requeteEtat('PUT', '?proto=2', corpsEtat(P3)), env, 'o1')).status, 200, 'une écriture neuve passe');
  });

  test('la taille se compte en octets, et l’ancien client est refusé', async () => {
    const { servirEtatD1, SQL_ETAT, MAX_OCTETS_D1 } = InternesServeur();
    const env = { DB: d1Etat(SQL_ETAT) };
    const lourd = corpsEtat(P1, { note: 'é'.repeat(Math.ceil(MAX_OCTETS_D1 / 2) + 10) });
    vrai(lourd.length < 2 * 1024 * 1024, 'sous la limite en caractères');
    const r = await servirEtatD1(requeteEtat('PUT', '?proto=2', lourd), env, 'o1');
    eq(r.status, 413, 'au-dessus de la limite de la base en octets : refusé');
    eq((await servirEtatD1(requeteEtat('PUT', '', corpsEtat(P1)), env, 'o1')).status, 426, 'sans proto=2 : recharge nécessaire');
    eq((await servirEtatD1(requeteEtat('DELETE'), env, 'o1')).status, 426, 'effacer sans proto=2 aussi');
  });
});

finDePartieDeTests('tests/40-serveur.tests.js');
