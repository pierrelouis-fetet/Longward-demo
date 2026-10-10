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

finDePartieDeTests('tests/40-serveur.tests.js');
