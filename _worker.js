/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
         + '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(value) {
  return hex(new Uint8Array(await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(value))));
}

const SESSION_GLISSE = 14;
const SESSION_PLAFOND = 90;

async function sessionIdentity(request, env) {
  const token = cookieValue(request, 'lw_session');
  if (!token || !env.DB) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, s.expires_at, s.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.expires_at > unixepoch()
        AND s.created_at + ? > unixepoch()`)
    .bind(tokenHash, SESSION_PLAFOND * 86400).first();
  if (!row) return null;

  const maintenant = Math.floor(Date.now() / 1000);
  const vise = Math.min(maintenant + SESSION_GLISSE * 86400,
                        row.created_at + SESSION_PLAFOND * 86400);
  if (vise > row.expires_at + 86400) {
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .bind(vise, tokenHash).run();
  }
  return { id: row.id, email: row.email, provider: 'supabase' };
}

async function supabaseAuth(env, path, body) {
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !publishableKey) {
    return { ok: false, status: 501, data: { error: 'authentification non configurée' } };
  }
  const response = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + path, {
    method: 'POST',
    headers: {
      'apikey': publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch { /* reponse vide */ }
  return { ok: response.ok, status: response.status, data };
}

async function getJson(url, ttl = 45) {
  const r = await fetch(url, { headers: HEADERS, cf: { cacheTtl: ttl, cacheEverything: true } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function getText(url, ttl = 45) {
  const r = await fetch(url, { headers: HEADERS, cf: { cacheTtl: ttl, cacheEverything: true } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function clotureVeilleHoraire(symbol, jourDuCours) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
            + `${encodeURIComponent(symbol)}?interval=1h&range=5d`;
  try {
    const data = await getJson(url);
    const r = ((data.chart || {}).result || [])[0];
    if (!r) return null;
    const ts = r.timestamp || [];
    const cl = (((r.indicators || {}).quote || [])[0] || {}).close || [];
    const jour = t => new Date(t * 1000).toISOString().slice(0, 10);
    for (let i = cl.length - 1; i >= 0; i--) {
      if (cl[i] == null) continue;
      if (jour(ts[i]) < jourDuCours) return cl[i];
    }
  } catch (e) {
    return null;
  }
  return null;
}

async function yahooQuote(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
            + `${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const data = await getJson(url);
  const chart = data.chart || {};
  if (chart.error) throw new Error(chart.error.description || 'symbole inconnu');
  const result = (chart.result || [])[0];
  if (!result) throw new Error('symbole inconnu');

  const meta = result.meta || {};
  let price = meta.regularMarketPrice;
  if (price == null) throw new Error('pas de cours disponible');

  let currency = meta.currency || '';
  /* Yahoo expose deux « clôtures précédentes » qu'il ne faut pas confondre :
     `previousClose` est celle de la veille, `chartPreviousClose` celle qui
     précède la fenêtre demandée — soit six séances plus tôt avec range=5d.
     Prendre la seconde transformait la performance du jour en performance de
     la semaine. À défaut, on reprend l'avant-dernière clôture de la série. */
  const closes = (((result.indicators || {}).quote || [])[0] || {}).close || [];
  const horodatages = result.timestamp || [];
  const jour = t => new Date(t * 1000).toISOString().slice(0, 10);
  const jourDuCours = meta.regularMarketTime ? jour(meta.regularMarketTime) : null;
  let veilleTrouvee = false, replisAnterieurs = null;
  if (jourDuCours && horodatages.length === closes.length) {
    for (let i = closes.length - 1; i >= 0; i--) {
      if (jour(horodatages[i]) < jourDuCours) {
        veilleTrouvee = true; replisAnterieurs = closes[i]; break;
      }
    }
  }
  const reelles = closes.filter(v => v != null);
  /* La bougie d'abord, le champ de Yahoo ensuite — et non l'inverse.

     `meta.previousClose` ment. Mesure : 6,121 pour DCAM.PA quand le courtier
     disait 6,203, et 18,445 pour NATO.PA contre 19,202. L'ecart du
     jour passait de +0,60 % a +1,99 %, et de +1,25 % a +5,22 % : Longward
     annonçait 302 EUR de mouvement pour 100 reels. Le calcul etait juste, sa
     reference etait fausse.

     La derniere cloture dont le jour precede celui du cours est une donnee de
     la serie, pas un champ calcule ailleurs : elle se verifie, et elle ne peut
     pas dater d'un autre jour que celui qu'on lui demande. */
  let prev = veilleTrouvee
    ? (replisAnterieurs ?? await clotureVeilleHoraire(symbol, jourDuCours))
    : (meta.previousClose
       ?? (reelles.length >= 2 ? reelles[reelles.length - 2] : null)
       ?? meta.chartPreviousClose ?? null);
  if (currency === 'GBp') {            // Londres cote en pence
    price = price / 100;
    if (prev) prev = prev / 100;
    currency = 'GBP';
  }

  const periodes = meta.currentTradingPeriod || {};
  return {
    symbol: meta.symbol || symbol,
    name: meta.longName || meta.shortName || '',
    price, previousClose: prev, currency,
    exchange: meta.fullExchangeName || meta.exchangeName || '',
    time: meta.regularMarketTime || null,
    marketState: meta.marketState || null,
    longName: meta.longName || meta.shortName || '',
    kind: meta.instrumentType || '',
    low52: meta.fiftyTwoWeekLow ?? null,
    high52: meta.fiftyTwoWeekHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    volume: meta.regularMarketVolume ?? null,
    firstTrade: meta.firstTradeDate ?? null,
    session: {
      pre: periodes.pre ? [periodes.pre.start, periodes.pre.end] : null,
      regular: periodes.regular ? [periodes.regular.start, periodes.regular.end] : null,
      post: periodes.post ? [periodes.post.start, periodes.post.end] : null,
    },
    source: 'yahoo',
  };
}

async function stooqQuote(symbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;
  const lines = (await getText(url)).trim().split('\n');
  if (lines.length < 2) throw new Error('réponse vide');
  const row = lines[1].split(',');
  if (row.length < 7 || row[6] === 'N/D' || row[6] === '') throw new Error('symbole inconnu');
  return {
    symbol: row[0].toUpperCase(), name: '', price: parseFloat(row[6]),
    previousClose: null, currency: '', exchange: 'Stooq', time: null, source: 'stooq',
  };
}

async function quote(symbol) {
  const s = (symbol || '').trim();
  if (!s) return { symbol: s, error: 'symbole vide' };
  const errors = [];
  for (const fetcher of [yahooQuote, stooqQuote]) {
    try { return await fetcher(s); }
    catch (e) { errors.push(`${fetcher.name}: ${e.message}`); }
  }
  return { symbol: s, error: errors.join(' · ') };
}

async function search(query) {
  const url = 'https://query1.finance.yahoo.com/v1/finance/search?q='
            + `${encodeURIComponent(query)}&quotesCount=25&newsCount=0`;
  const data = await getJson(url, 300);
  return (data.quotes || [])
    .filter(q => q.symbol)
    .map(q => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || '',
      exchange: q.exchDisp || q.exchange || '',
      type: q.typeDisp || q.quoteType || '',
    }));
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function isinIsValid(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!ISIN_RE.test(c)) return false;
  const expanded = [...c.slice(0, 11)].map(ch => parseInt(ch, 36)).join('');
  let total = 0, double = true;
  for (let i = expanded.length - 1; i >= 0; i--) {
    let d = +expanded[i];
    if (double) { d *= 2; if (d > 9) d -= 9; }
    total += d;
    double = !double;
  }
  return (10 - total % 10) % 10 === +c[11];
}

const PREFERRED_SUFFIXES = ['.PA', '', '.AS', '.DE', '.MI', '.MC', '.BR',
                            '.L', '.SW', '.VI', '.F', '.XD', '.SG'];

const FIGI_TO_YAHOO = {
  FP: '.PA', GR: '.DE', GY: '.DE', GF: '.F', GS: '.SG', LN: '.L', IM: '.MI',
  NA: '.AS', SW: '.SW', SE: '.SW', SM: '.MC', BB: '.BR', AV: '.VI', ID: '.IR',
  PL: '.LS', SS: '.ST', DC: '.CO', NO: '.OL', FH: '.HE', CN: '.TO', JP: '.T',
  AU: '.AX', HK: '.HK',
  US: '', UN: '', UQ: '', UW: '', UA: '', UR: '', UP: '',
};

const suffixOf = sym => sym.includes('.') ? '.' + sym.split('.').pop() : '';

const isOtc = item => /\botc\b|pink sheet/i.test(item.exchange || '');

function rank(item, prefer) {
  const auto = !prefer || prefer === 'auto';
  const order = auto
    ? []
    : [prefer, ...PREFERRED_SUFFIXES.filter(s => s !== prefer)];
  let pos = auto ? 0 : order.indexOf(suffixOf(item.symbol));
  if (pos < 0) pos = order.length;
  const kind = (item.type || '').toLowerCase() === 'fund' ? 1 : 0;
  const raw = item.symbol.split('.')[0].length === 12 ? 1 : 0;
  const otc = isOtc(item) ? 1 : 0;
  return otc * 10000 + raw * 1000 + kind * 100 + pos;
}

async function figiCandidates(isin) {
  const r = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
  });
  if (!r.ok) throw new Error(`OpenFIGI HTTP ${r.status}`);
  const payload = await r.json();
  const rows = (payload[0] && payload[0].data) || [];
  const seen = new Set(), out = [];
  for (const row of rows) {
    const suffix = FIGI_TO_YAHOO[row.exchCode];
    if (!row.ticker || suffix === undefined) continue;
    const symbol = `${row.ticker}${suffix}`;
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({
      symbol,
      name: (row.name || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      exchange: row.exchCode, type: row.securityType || '',
      source: 'openfigi', unverified: true,
    });
  }
  return out;
}

async function resolveIsin(code, prefer = '') {
  const isin = String(code || '').trim().toUpperCase();
  if (!isinIsValid(isin)) {
    return { code: isin, valid: false,
             error: 'ISIN invalide (12 caractères, clé de contrôle incorrecte)' };
  }

  const candidates = await search(isin).catch(() => []);
  const seen = new Set(candidates.map(c => c.symbol));

  for (const name of new Set(candidates.map(c => c.name).filter(Boolean))) {
    try {
      for (const extra of await search(name)) {
        if (!seen.has(extra.symbol)) { seen.add(extra.symbol); candidates.push(extra); }
      }
    } catch { /* l'ISIN seul fera l'affaire */ }
  }

  const imposee = prefer && prefer !== 'auto';
  if (!candidates.length || (imposee && !candidates.some(c => suffixOf(c.symbol) === prefer))) {
    let extras = [];
    try { extras = (await figiCandidates(isin)).filter(c => !seen.has(c.symbol)); }
    catch { extras = []; }
    extras.sort((a, b) => rank(a, prefer) - rank(b, prefer));
    for (const cand of extras.slice(0, 6)) {
      const probe = await quote(cand.symbol);
      if (probe.error) continue;
      cand.unverified = false;
      cand.name = probe.name || cand.name;
      cand.exchange = probe.exchange || cand.exchange;
      candidates.push(cand);
      seen.add(cand.symbol);
      if (suffixOf(cand.symbol) === prefer) break;
    }
  }

  if (!candidates.length) {
    return { code: isin, valid: true, best: null, candidates: [],
             error: 'aucune cotation trouvée pour cet ISIN' };
  }

  candidates.sort((a, b) => rank(a, prefer) - rank(b, prefer));
  return { code: isin, valid: true, best: candidates[0], candidates };
}

const MAX_BYTES = 2 * 1024 * 1024;

/* Les chemins qui appartiennent au depot et non au site : tests, documents de
   travail, scripts, schema, flux d'integration. Les fichiers a la racine en
   `.py` aussi. Tout ce qui n'est pas dans cette liste se sert comme avant. */
const FICHIERS_DE_DEVELOPPEMENT = /^\/(tests(\.html|\/.*)|\.github\/.*|CLAUDE\.md|README\.md|DEPLOY\.md|ICONES\.md|schema\.sql|wrangler\.json|[^/]+\.py)$/;
const keyFor = email => `state:${email || 'default'}`;

async function handleState(request, env, email, identifie) {
  if (!env.WEALTH) return json({ error: 'stockage non configuré' }, 501);
  /* UN VISITEUR ANONYME N'A PAS D'ETAT, ET NE PEUT PAS PRENDRE CELUI DES AUTRES.

     La cle retombe sur `state:default` quand aucune adresse n'est prouvee. C'est
     le cas voulu d'un proprietaire unique derriere un mot de passe : un seul
     etat, une seule cle. Ce n'est pas le cas d'un site ouvert — demonstration
     publique, ou ALLOW_PUBLIC — ou chaque visiteur anonyme tomberait sur la
     MEME cle et lirait, ecraserait ou effacerait ce que le precedent y a mis.

     Aujourd'hui la demonstration n'a aucun espace KV lie, donc la question ne se
     pose pas : `/api/state` y repond deja « stockage non configure ». Ce refus
     est la pour le jour ou quelqu'un en lie un — une case cochee dans un tableau
     de bord ne doit pas suffire a transformer une demonstration en boite aux
     lettres commune. La porte est fermee dans le code, la ou elle se relit. */
  if (!identifie) return json({ error: 'identité requise' }, 403);
  const key = keyFor(email);

  if (request.method === 'GET') {
    const raw = await env.WEALTH.get(key);
    if (!raw) return new Response(null, { status: 204 });
    return new Response(raw, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (request.method === 'DELETE') {
    await env.WEALTH.delete(key);
    return json({ ok: true });
  }

  const body = await request.text();
  if (body.length > MAX_BYTES) return json({ error: 'état trop volumineux' }, 413);

  let incoming;
  try { incoming = JSON.parse(body); }
  catch { return json({ error: 'JSON invalide' }, 400); }
  if (!incoming || !incoming.positions || !incoming.monthly) {
    return json({ error: 'format inattendu' }, 400);
  }

  /* Garde-fou : on n'écrase que la version qu'on a lue.
     -------------------------------------------------------------------------
     La règle précédente comparait deux horodatages : elle refusait une écriture
     dont le `savedAt` était plus ancien que celui en ligne. Elle ne pouvait pas
     tenir, et la preuve est venue des sauvegardes du détenteur — six « avant
     adoption de la version en ligne » dans une seule journée, et des montants
     saisis qui disparaissaient.

     Un onglet resté ouvert garde en mémoire l'état d'il y a six heures. Le
     rafraîchissement automatique des cours y appelle `Store.save()` toutes les
     cinq minutes, et `Store.save()` estampille `savedAt = maintenant`. Cet onglet
     envoie donc un contenu périmé avec une estampille fraîche, plus récente que
     celle du téléphone qui vient de saisir. L'ancienne règle l'acceptait — un
     horodatage récent ne dit rien de l'âge du contenu — et le téléphone, lui
     proprement synchronisé, adoptait ensuite cette version en se croyant
     simplement en retard.

     On compare donc une filiation, comme le fait `If-Match` : l'écrivain déclare
     la version qu'il a lue, et l'écriture n'est acceptée que si c'est encore
     celle en place. Un onglet qui n'a pas vu la dernière version est refusé,
     quelle que soit son horloge. C'est ici et non côté client parce que le
     `sendBeacon` de la fermeture d'onglet ne peut rien vérifier avant de partir.

     Sans `base` — un client d'avant ce correctif, dont un onglet encore ouvert —
     le refus est la bonne réponse : c'est exactement l'écrivain dont on se
     protège. Rien n'est perdu pour lui, son état reste sur son appareil, et un
     rechargement lui rend le droit d'écrire.

     `force=1` reste la porte de l'arbitrage : c'est le détenteur qui a vu les
     deux dates et choisi d'imposer la sienne. */
  const params = new URL(request.url).searchParams;
  if (params.get('force') !== '1') {
    const existing = await env.WEALTH.get(key);
    if (existing) {
      try {
        const prevAt = JSON.parse(existing)?.meta?.savedAt;
        const nextAt = incoming?.meta?.savedAt;
        const base = params.get('base');
        if (prevAt && base !== prevAt) {
          return json({ error: 'conflit', remoteSavedAt: prevAt, localSavedAt: nextAt,
                        base: base || null, raison: 'version non lue' }, 409);
        }
      } catch { /* état précédent illisible : on le remplace */ }
    }
  }

  try {
    const avant = await env.WEALTH.get(key);
    if (avant) {
      const vAvant = JSON.parse(avant)?.schemaVersion ?? 0;
      const vApres = incoming?.schemaVersion ?? 0;
      if (vApres !== vAvant) {
        const quand = new Date().toISOString().replace(/[:.]/g, '-');
        await env.WEALTH.put(`${key}:backup:v${vAvant}:${quand}`, avant,
                             { expirationTtl: 60 * 60 * 24 * 180 });
      }
    }
  } catch { /* une sauvegarde ratee ne doit pas empecher l'enregistrement */ }

  await env.WEALTH.put(key, body);
  return json({ ok: true, savedAt: incoming?.meta?.savedAt || null, bytes: body.length });
}

const DEMO_PUBLIQUE = true;

async function handleD1State(request, env, identity) {
  if (!env.DB) return json({ error: 'stockage non configuré' }, 501);
  if (!identity?.id) return json({ error: 'identité requise' }, 403);
  const owner = identity.id;
  const claimedOwner = request.headers.get('X-Longward-User')
    || new URL(request.url).searchParams.get('user');
  if (!claimedOwner || claimedOwner !== owner) {
    return json({ error: 'session changée, recharge nécessaire' }, 409);
  }

  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT body FROM portfolios WHERE owner_id = ?').bind(owner).first();
    if (!row) return new Response(null, { status: 204 });
    return new Response(row.body, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM portfolios WHERE owner_id = ?').bind(owner).run();
    return json({ ok: true });
  }

  if (request.method !== 'PUT' && request.method !== 'POST') {
    return json({ error: 'méthode non autorisée' }, 405);
  }

  const body = await request.text();
  if (body.length > MAX_BYTES) return json({ error: 'état trop volumineux' }, 413);
  let incoming;
  try { incoming = JSON.parse(body); }
  catch { return json({ error: 'JSON invalide' }, 400); }
  if (!incoming || !incoming.positions || !incoming.monthly) {
    return json({ error: 'format inattendu' }, 400);
  }

  const nextRevision = incoming?.meta?.savedAt;
  if (!nextRevision) return json({ error: 'révision manquante' }, 400);
  const params = new URL(request.url).searchParams;
  const force = params.get('force') === '1';
  const base = params.get('base');

  if (force) {
    await env.DB.prepare(
      `INSERT INTO portfolios (owner_id, body, revision, updated_at)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(owner_id) DO UPDATE SET
         body = excluded.body, revision = excluded.revision, updated_at = unixepoch()`)
      .bind(owner, body, nextRevision).run();
    return json({ ok: true, savedAt: nextRevision, bytes: body.length });
  }

  if (!base) {
    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO portfolios (owner_id, body, revision, updated_at)
       VALUES (?, ?, ?, unixepoch())`).bind(owner, body, nextRevision).run();
    if (inserted.meta?.changes === 1) {
      return json({ ok: true, savedAt: nextRevision, bytes: body.length });
    }
  } else {
    const updated = await env.DB.prepare(
      `UPDATE portfolios SET body = ?, revision = ?, updated_at = unixepoch()
        WHERE owner_id = ? AND revision = ?`)
      .bind(body, nextRevision, owner, base).run();
    if (updated.meta?.changes === 1) {
      return json({ ok: true, savedAt: nextRevision, bytes: body.length });
    }
  }

  const current = await env.DB.prepare(
    'SELECT revision FROM portfolios WHERE owner_id = ?').bind(owner).first();
  return json({ error: 'conflit', remoteSavedAt: current?.revision || null,
    localSavedAt: nextRevision, base: base || null, raison: 'version non lue' }, 409);
}

const CLEFS_TTL_MS = 60 * 60 * 1000;
let clefsCache = { url: null, a: 0, clefs: null };

async function clefsAccess(domaine) {
  const url = `https://${domaine.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/cdn-cgi/access/certs`;
  const maintenant = Date.now();
  if (clefsCache.clefs && clefsCache.url === url && maintenant - clefsCache.a < CLEFS_TTL_MS)
    return clefsCache.clefs;
  const r = await fetch(url, { cf: { cacheTtl: 3600 } });
  if (!r.ok) return null;
  const { keys } = await r.json();
  if (!Array.isArray(keys)) return null;
  clefsCache = { url, a: maintenant, clefs: keys };
  return keys;
}

const deB64url = s => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - p.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

async function accessEmail(request, env) {
  const jeton = request.headers.get('Cf-Access-Jwt-Assertion');
  const domaine = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  if (!jeton || !domaine || !aud) return null;

  const parts = jeton.split('.');
  if (parts.length !== 3) return null;
  let entete, charge;
  try {
    entete = JSON.parse(new TextDecoder().decode(deB64url(parts[0])));
    charge = JSON.parse(new TextDecoder().decode(deB64url(parts[1])));
  } catch { return null; }
  if (entete.alg !== 'RS256') return null;          // pas de none, pas de HS256

  const clefs = await clefsAccess(domaine);
  const jwk = clefs?.find(k => k.kid === entete.kid);
  if (!jwk) return null;

  let ok = false;
  try {
    const clef = await crypto.subtle.importKey('jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clef, deB64url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { return null; }
  if (!ok) return null;

  const auds = Array.isArray(charge.aud) ? charge.aud : [charge.aud];
  if (!auds.includes(aud)) return null;
  const attendu = `https://${domaine.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  if (charge.iss !== attendu) return null;
  const s = Math.floor(Date.now() / 1000);
  if (!charge.exp || charge.exp <= s) return null;
  if (charge.nbf && charge.nbf > s + 60) return null;

  return typeof charge.email === 'string' && charge.email ? charge.email : null;
}

const SESSION_DAYS = 30;
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

async function makeToken(secret) {
  const exp = String(Date.now() + SESSION_DAYS * 86400000);
  return `${exp}.${await hmac(secret, exp)}`;
}

async function tokenIsValid(token, secret) {
  if (!token || !token.includes('.')) return false;
  const [exp, sig] = token.split('.');
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = await hmac(secret, exp);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function cookieValue(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return hit ? hit.slice(name.length + 1) : null;
}

/* --- FREINER L'ABUS AVANT QU'IL COUTE ------------------------------------

   `/api/auth/request-code` n'est protege par aucune session : c'est sa raison
   d'etre, on ne peut pas demander d'etre connecte pour se connecter. Il prend
   une adresse quelconque et declenche un envoi facture, signe du domaine.
   Sans compteur, un inconnu fait partir autant de courrier qu'il veut.

   LE PLAFOND DU FOURNISSEUR NE SUFFIT PAS, ET POUR UNE RAISON QUI SURPREND :
   il vaut pour le PROJET ENTIER. Quelqu'un qui le sature n'envoie pas
   seulement du courrier indesirable, il empeche les vrais testeurs de
   recevoir le leur. Un plafond partage est une panne a la demande.

   Ce qui se protege ici n'est donc pas la facture, c'est la reputation du
   domaine et la disponibilite de l'inscription.

   `/api/auth/verify-code` compte aussi, et c'est le second oubli classique :
   un code a six chiffres sans limite d'essais se devine. */

const ABUS = {
  mailParAdresse: { plafond: 3, fenetre: 900 },
  mailParIp: { plafond: 12, fenetre: 3600 },
  essaisParAdresse: { plafond: 10, fenetre: 900 },
};

/* UNE SEULE INSTRUCTION, PARCE QUE DEUX NE TIENNENT PAS. Lire le compteur puis
   l'ecrire laisse deux requetes simultanees lire la meme valeur et la depasser
   toutes les deux. Le `ON CONFLICT ... DO UPDATE` fait l'addition dans la base,
   et `RETURNING` rend la valeur qui a reellement ete posee. */
async function compteur(env, seau, plafond, fenetre) {
  if (!env.DB) return { permis: true, reste: plafond };
  const row = await env.DB.prepare(
    `INSERT INTO auth_throttle (bucket, count, reset_at)
     VALUES (?1, 1, unixepoch() + ?2)
     ON CONFLICT(bucket) DO UPDATE SET
       count = CASE WHEN auth_throttle.reset_at <= unixepoch()
                    THEN 1 ELSE auth_throttle.count + 1 END,
       reset_at = CASE WHEN auth_throttle.reset_at <= unixepoch()
                       THEN unixepoch() + ?2 ELSE auth_throttle.reset_at END
     RETURNING count, reset_at`).bind(seau, fenetre).first();
  const count = row?.count ?? 1;
  return { permis: count <= plafond, reste: Math.max(0, plafond - count) };
}

const clientIp = request => request.headers.get('CF-Connecting-IP') || 'ip-inconnue';

/* TURNSTILE DORT TANT QU'IL N'EST PAS CONFIGURE, comme le reste des portes de
   ce worker. Sans `TURNSTILE_SECRET_KEY`, la fonction laisse passer et le
   formulaire ne montre aucun widget : une instance privee ne change pas de
   comportement parce qu'on a deploye une version plus recente. Avec les deux
   clefs, le formulaire porte le widget et le jeton se verifie ici.

   La verification se fait cote serveur : un widget affiche sans controle du
   jeton ne freine personne, il ajoute juste une image. */
async function turnstileOk(env, request, form) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  const token = String(form.get('cf-turnstile-response') || '');
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: clientIp(request),
      }),
    });
    const data = await r.json();
    return data.success === true;
  } catch (e) {
    return true;
  }
}

/* L'ACCES ADMINISTRATEUR, ET LE PEU QU'ON LUI DEMANDE.

   La clef `service role` ouvre tout chez le fournisseur d'identite : elle
   ignore les regles d'acces et parle au nom de n'importe qui. Elle ne sert donc
   qu'a ce qu'aucune autre ne peut faire, et le reste du worker continue avec la
   clef publiable.

   UN SEUL APPEL L'UTILISE AUJOURD'HUI : supprimer un compte. C'est le droit a
   l'effacement, et il ne s'exerce pas avec les droits de la personne
   elle-meme — un utilisateur ne peut pas se supprimer chez le fournisseur.

   L'identifiant vient TOUJOURS de la session verifiee, jamais d'un parametre.
   Prendre un identifiant du client donnerait a quiconque l'effacement du compte
   d'autrui, et cette clef-la ne refuserait pas. */
async function supabaseAdmin(env, chemin, methode) {
  const clef = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !clef) return { ok: false, status: 501 };
  try {
    const r = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + chemin, {
      method: methode,
      headers: { 'apikey': clef, 'Authorization': `Bearer ${clef}` },
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0 };
  }
}

async function createSession(env, user) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = b64url(bytes);
  const tokenHash = await sha256(token);
  const email = String(user.email || '').trim().toLowerCase();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_GLISSE * 86400;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= unixepoch()'),
    env.DB.prepare('DELETE FROM auth_throttle WHERE reset_at <= unixepoch()'),
    /* LA MEME ADRESSE PEUT REVENIR SOUS UN AUTRE IDENTIFIANT. Un compte
       supprime puis recree chez le fournisseur porte une adresse connue et un
       identifiant neuf. `ON CONFLICT(id)` ne voit pas ce cas : le conflit tombe
       sur l'index unique de l'adresse, l'instruction leve, et le lot entier est
       annule — la personne ne peut plus se connecter, sans qu'une ligne dise
       pourquoi. On reaffecte donc la ligne existante avant d'inserer, et la
       cascade du schema emmene le patrimoine et les sessions avec elle. */
    env.DB.prepare('UPDATE users SET id = ?1, updated_at = unixepoch() WHERE email = ?2 AND id <> ?1')
      .bind(user.id, email),
    env.DB.prepare(
      `INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, updated_at = unixepoch()`)
      .bind(user.id, email),
    env.DB.prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, unixepoch())')
      .bind(tokenHash, user.id, expiresAt),
  ]);
  return token;
}

const escHtml = value => String(value || '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const AUTH_STYLE = `<style>
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
background:#08080A;color:#ECEADF;margin:0;min-height:100dvh;display:grid;place-items:center;
padding:24px;background-image:radial-gradient(60em 40em at 20% -10%,rgba(126,77,255,.16),transparent 60%)}
form{width:min(25em,100%);background:#121216;border:1px solid #292930;border-radius:18px;padding:28px}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:24px;font-weight:650}.brand img{border-radius:8px}
h1{font-size:25px;margin:0 0 8px}p{color:#aaa8b0;font-size:14px;line-height:1.55}
label{display:block;font-size:13px;margin:22px 0 7px}input{width:100%;font:inherit;font-size:16px;
padding:13px 14px;border-radius:11px;border:1px solid #35353e;background:#0e0e12;color:#fff}
button{width:100%;font:inherit;font-weight:650;padding:13px;margin-top:18px;border:0;border-radius:11px;
color:#fff;background:linear-gradient(135deg,#7E4DFF,#9A63FF);cursor:pointer}.err{color:#ff7770}
.legal{font-size:11.5px;text-align:center;margin-top:18px}.legal a{color:#b98cff}</style>`;

/* LES PAGES DU WORKER PARLENT LA LANGUE DU VISITEUR.

   Elles ne peuvent pas appeler `trad()` : le worker les construit sans le
   dictionnaire. Leurs chaines vivent donc ici, en double, et c'est le prix a
   payer pour qu'un francophone ne lise pas l'anglais sur le seul ecran qu'il
   voit avant d'entrer.

   Les deux tables portent exactement les memes clefs, et un controle l'exige :
   une clef presente d'un seul cote rendrait `undefined` dans la page, sans
   erreur et sans que rien ne le dise. */
const AUTH_TEXTES = {
  en: {
    lang: 'en',
    titreConnexion: 'Sign in · Longward',
    titreCode: 'Verify · Longward',
    confidentialite: '/privacy',
    h1: 'Enter your space',
    intro: 'We send you a one-time code. If this address is new, your account is created once it is verified.',
    labelEmail: 'Email address',
    bouton: 'Send me a code',
    legalAvant: 'By continuing, you confirm you have read the ',
    legalLien: 'privacy policy',
    h1Code: 'Check your email',
    introAvant: 'Enter the code sent to ',
    labelCode: 'Code',
    boutonCode: 'Verify code',
    emailInvalide: 'Invalid email address.',
    tropIp: 'Too many requests from this network. Try again in an hour.',
    robot: 'Confirm you are not a robot, then try again.',
    tropMail: 'Too many codes requested for this address. Try again in fifteen minutes.',
    envoiImpossible: 'The code cannot be sent right now.',
    indisponible: 'Sign-in is unavailable. Try again in a moment.',
    codeInvalide: 'Invalid code.',
    tropEssais: 'Too many attempts. Request a new code in fifteen minutes.',
    codeFaux: 'Incorrect or expired code.',
  },
  fr: {
    lang: 'fr',
    titreConnexion: 'Connexion · Longward',
    titreCode: 'Vérification · Longward',
    confidentialite: '/confidentialite',
    h1: 'Entre dans ton espace',
    intro: 'Tu reçois un code à usage unique. Si cette adresse est nouvelle, ton compte est créé après vérification.',
    labelEmail: 'Adresse e-mail',
    bouton: 'Recevoir mon code',
    legalAvant: 'En continuant, tu reconnais avoir lu la ',
    legalLien: 'politique de confidentialité',
    h1Code: 'Vérifie ton e-mail',
    introAvant: 'Entre le code envoyé à ',
    labelCode: 'Code',
    boutonCode: 'Valider le code',
    emailInvalide: 'Adresse e-mail invalide.',
    tropIp: 'Trop de demandes depuis ce réseau. Réessaie dans une heure.',
    robot: 'Confirme que tu n’es pas un robot, puis réessaie.',
    tropMail: 'Trop de codes demandés pour cette adresse. Réessaie dans un quart d’heure.',
    envoiImpossible: 'Le code ne peut pas être envoyé pour le moment.',
    indisponible: 'Le service de connexion est indisponible. Réessaie dans un instant.',
    codeInvalide: 'Code invalide.',
    tropEssais: 'Trop d’essais. Demande un nouveau code dans un quart d’heure.',
    codeFaux: 'Code incorrect ou expiré.',
  },
};

/* `Accept-Language` est une liste ponderee, pas un code : `en-US,en;q=0.9,fr;q=0.8`
   annonce un anglophone qui comprend le francais. Chercher « fr » quelque part
   dedans le prendrait pour un francophone. On lit donc les poids. */
function langueDemandee(request) {
  const brut = request.headers.get('Accept-Language') || '';
  let meilleure = { code: 'en', q: -1 };
  for (const morceau of brut.split(',')) {
    const [etiquette, ...params] = morceau.trim().split(';');
    const code = etiquette.slice(0, 2).toLowerCase();
    if (!AUTH_TEXTES[code]) continue;
    let q = 1;
    for (const p of params) {
      const m = /^\s*q=([\d.]+)/.exec(p);
      if (m) q = Number(m[1]);
    }
    if (q > meilleure.q) meilleure = { code, q };
  }
  return meilleure.code;
}

const TURNSTILE_WIDGET = siteKey => !siteKey ? '' :
  `<div class="cf-turnstile" data-sitekey="${escHtml(siteKey)}" data-theme="dark"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;

const EMAIL_LOGIN_PAGE = (error, siteKey = '', T = AUTH_TEXTES.en) => `<!DOCTYPE html><html lang="${T.lang}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${T.titreConnexion}</title>${AUTH_STYLE}
<form method="POST" action="/api/auth/request-code"><div class="brand"><img src="/icon-192.png" alt="" width="34" height="34">Longward</div>
<h1>${T.h1}</h1><p>${T.intro}</p>
${error ? `<p class="err">${escHtml(error)}</p>` : ''}<label for="email">${T.labelEmail}</label>
<input id="email" name="email" type="email" autocomplete="email" required autofocus>
${TURNSTILE_WIDGET(siteKey)}
<button type="submit">${T.bouton}</button><p class="legal">${T.legalAvant}<a href="${T.confidentialite}">${T.legalLien}</a>.</p></form></html>`;

const VERIFY_PAGE = (email, error = '', T = AUTH_TEXTES.en) => `<!DOCTYPE html><html lang="${T.lang}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${T.titreCode}</title>${AUTH_STYLE}
<form method="POST" action="/api/auth/verify-code"><div class="brand"><img src="/icon-192.png" alt="" width="34" height="34">Longward</div>
<h1>${T.h1Code}</h1><p>${T.introAvant}<b>${escHtml(email)}</b>.</p>
${error ? `<p class="err">${escHtml(error)}</p>` : ''}<input name="email" type="hidden" value="${escHtml(email)}">
<label for="code">${T.labelCode}</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" required autofocus>
<button type="submit">${T.boutonCode}</button></form></html>`;

/* LA PORTE D'ENTREE MERITE LE SOIN DU RESTE.

   C'est le premier ecran, et longtemps le seul qu'un visiteur non autorise
   voyait : un logo, un champ et un bouton gris sur du noir. Tout ce que
   l'application soigne ensuite commencait par un formulaire de dépannage.

   TOUT EST EN LIGNE, ET C'EST OBLIGE. Cette page est construite par le Worker,
   qui n'a ni la feuille de styles ni le dictionnaire : elle ne peut appeler ni
   `trad()` ni une variable CSS. Les couleurs sont donc ecrites en dur, et c'est
   le seul endroit du projet ou ce soit acceptable. Elles valent celles du theme
   sombre — #9A63FF est l'accent de la marque, #0A0A0C son noir.

   AUCUN SCRIPT, et ce n'est pas un oubli : la CSP servie avec cette reponse
   porte `script-src 'self'` sans `unsafe-inline`. Un oeil qui devoile le mot de
   passe demanderait un script en ligne, donc il serait bloque sans un mot. Le
   style en ligne, lui, passe : `style-src` l'autorise.

   `error` ne porte que des chaines fixes de ce fichier, jamais une entree du
   visiteur. Si cela devait changer un jour, il faudrait l'echapper ici. */
const LOGIN_PAGE = (error) => `<!DOCTYPE html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Longward</title>
<style>
 *{box-sizing:border-box}
 body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
      background:#08080A;color:#ECEADF;margin:0;min-height:100dvh;
      display:grid;place-items:center;padding:24px;
      background-image:radial-gradient(60em 40em at 20% -10%,rgba(126,77,255,.16),transparent 60%),
                       radial-gradient(50em 34em at 90% 110%,rgba(58,120,255,.12),transparent 60%)}
 form{width:min(24em,100%);background:#121216;border:1px solid #23232A;
      border-radius:18px;padding:28px 26px 22px;
      box-shadow:0 20px 60px rgba(0,0,0,.55);
      display:flex;flex-direction:column;gap:0}
 .tete{display:flex;align-items:center;gap:10px;margin-bottom:22px}
 .mark{width:34px;height:34px;border-radius:23%;display:block;object-fit:cover}
 .nom{font-size:15px;font-weight:650;letter-spacing:-.01em}
 h1{font-size:25px;line-height:1.2;font-weight:640;letter-spacing:-.02em;margin:0 0 6px}
 h1 em{font-style:italic;font-weight:640;
       background:linear-gradient(100deg,#B98CFF,#7E4DFF);
       -webkit-background-clip:text;background-clip:text;color:transparent}
 .sous{color:#8B8992;font-size:13.5px;margin:0 0 22px}
 .sous b{color:#9A63FF;font-weight:620}
 label{display:block;font-size:12.5px;font-weight:560;color:#B9B7B0;margin:0 0 7px}
 input{width:100%;font:inherit;font-size:16px;padding:13px 14px;border-radius:11px;
       border:1px solid #2C2C34;background:#0E0E12;color:#fff}
 input::placeholder{color:#5C5A63}
 input:focus{outline:0;border-color:#7E4DFF;box-shadow:0 0 0 3px rgba(126,77,255,.22)}
 button{width:100%;font:inherit;font-size:15px;font-weight:640;padding:13px;
        margin-top:18px;border-radius:11px;border:0;cursor:pointer;color:#fff;
        background:linear-gradient(135deg,#7E4DFF,#9A63FF)}
 button:hover{filter:brightness(1.08)}
 button:active{transform:scale(.99)}
 button:focus-visible{outline:2px solid #B98CFF;outline-offset:2px}
 .err{display:block;color:#E0574F;font-size:13px;margin-top:10px}
 .pied{color:#6F6D76;font-size:11.5px;line-height:1.5;margin:18px 0 0;text-align:center}
 @media (prefers-reduced-motion:reduce){button:active{transform:none}}
</style>
<form method="POST" action="/api/login">
 <div class="tete">
   <img class="mark" src="/icon-192.png" alt="" width="34" height="34">
   <span class="nom">Longward</span>
 </div>
 <h1>Enter <em>your space</em></h1>
 <p class="sous">See clearly. <b>Move forward.</b></p>
 <label for="mdp">Password</label>
 <input id="mdp" type="password" name="password" placeholder="Your password" autofocus
        required autocomplete="current-password">
 ${error ? `<span class="err">${error}</span>` : ''}
 <button type="submit">Sign in</button>
 <p class="pied">This space is private. Your data stays yours.</p>
</form></html>`;

const LOCKED_PAGE = `<!DOCTYPE html><html lang="en"><meta charset="utf-8">
<title>Dashboard locked</title>
<style>
 body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#0d0d0d;color:#eceadf;
      margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
 main{max-width:34em;line-height:1.65}
 h1{font-size:22px;margin:0 0 4px} p{color:#c3c2b7}
 code{background:#232322;padding:2px 6px;border-radius:5px;font-size:13px}
 ol{color:#c3c2b7} li{margin:6px 0}
 .tag{display:inline-block;background:#d03b3b;color:#fff;font-size:11px;font-weight:700;
      padding:3px 9px;border-radius:99px;letter-spacing:.05em;margin-bottom:14px}
</style>
<main>
 <span class="tag">LOCKED</span>
 <h1>This dashboard is not protected yet</h1>
 <p>It serves nothing at all until a protection is in place. That is
    deliberate: an unusable site beats a net worth anyone can read.</p>
 <p><b>The simplest route, a password:</b></p>
 <ol>
  <li>Cloudflare project settings → <b>Variables and Secrets</b></li>
  <li><b>Add variable</b>, type <b>Secret</b></li>
  <li>Name: <code>DASHBOARD_PASSWORD</code>, value: your password</li>
  <li><b>Save and deploy</b></li>
 </ol>
 <p>Reload, and a sign-in screen appears.</p>
 <p style="font-size:13px;color:#898781">A sturdier option, for sign-in by email
    code: set up <b>Cloudflare Zero Trust → Access</b> on this hostname. Either
    route works, one of them is enough.</p>
 <p style="font-size:13px;color:#898781">To publish this site deliberately with no
    authentication, set the environment variable <code>ALLOW_PUBLIC=1</code> in the
    project settings.</p>
</main></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* Les ecritures viennent de l'interface Longward elle-meme. Ce controle
       bloque notamment une connexion ou une deconnexion imposee par un site
       tiers au moyen d'un formulaire invisible.

       Deux preuves valent ici, et la seconde n'est pas un relachement :
       `Sec-Fetch-Site` est pose par le navigateur, aucun script de page ne peut
       l'ecrire, et un envoi venu d'ailleurs porte `cross-site`. Elle rattrape
       le cas ou l'hebergeur presente au worker l'adresse immuable du
       deploiement quand le navigateur, lui, utilise l'alias de branche. */
    const memeOrigine = request.headers.get('Origin') === url.origin
      || request.headers.get('Sec-Fetch-Site') === 'same-origin';
    if (['POST', 'PUT', 'DELETE'].includes(request.method) && !memeOrigine) {
      return json({ error: 'origine refusée' }, 403);
    }

    const pwd = env.DASHBOARD_PASSWORD;
    /* Les protections de `_headers` ne s'appliquent qu'aux fichiers servis par
       Pages. Une reponse que ce worker construit lui-meme ne les herite pas :
       la page de connexion partait donc sans anti-cadrage, sans `nosniff` et
       sans politique de referent — la seule page du site ou l'on tape un mot de
       passe, et la moins protegee des trois.

       Elles sont recopiees ici, faute de pouvoir les lire depuis `_headers` a
       l'execution, et un test exige que les deux listes disent la meme chose. */
    const htmlHeaders = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy':
        'geolocation=(), camera=(), microphone=(), interest-cohort=()',
      /* La meme CSP que `_headers`, et pour la meme raison que les quatre
         au-dessus : ces reponses sont construites ici, donc les regles de
         Cloudflare Pages ne les touchent pas. La page de connexion est celle
         ou l'on tape un mot de passe ; elle ne peut pas etre la moins
         protegee des trois. Elle n'a ni style en ligne ni script, mais la
         liste se recopie entiere : deux CSP differentes sur un meme site
         finiraient par diverger sur la seule qui compte. */
      /* Le widget anti-robot est un script tiers : il lui faut sa source et son
         cadre, et rien de plus. Les deux ne s'ouvrent que si le site porte une
         clef publique, donc la CSP reste au plus serre partout ailleurs. Ce qui
         ne s'ouvre jamais, c'est `unsafe-inline` sur le script. */
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'"
        + (env.TURNSTILE_SITE_KEY ? ' https://challenges.cloudflare.com' : '')
        + "; style-src 'self' 'unsafe-inline'; "
        + "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
        + "manifest-src 'self'; worker-src 'self'; object-src 'none'; "
        + (env.TURNSTILE_SITE_KEY ? "frame-src https://challenges.cloudflare.com; " : '')
        + "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    };

    const emailAuthReady = !!(
      env.SUPABASE_URL
      && (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)
      && env.DB
    );
    const T = AUTH_TEXTES[langueDemandee(request)];
    const pageConnexion = error => EMAIL_LOGIN_PAGE(error, env.TURNSTILE_SITE_KEY || '', T);
    const pageCode = (adresse, erreur) => VERIFY_PAGE(adresse, erreur, T);

    if (path === '/api/auth/request-code' && request.method === 'POST') {
      try {
        const form = await request.formData();
        const email = String(form.get('email') || '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          return new Response(pageConnexion(T.emailInvalide), { status: 400, headers: htmlHeaders });
        }

        const parIp = await compteur(env, `otp:ip:${clientIp(request)}`,
          ABUS.mailParIp.plafond, ABUS.mailParIp.fenetre);
        if (!parIp.permis) {
          return new Response(pageConnexion(T.tropIp),
            { status: 429, headers: htmlHeaders });
        }
        if (!await turnstileOk(env, request, form)) {
          return new Response(pageConnexion(T.robot),
            { status: 400, headers: htmlHeaders });
        }
        const parMail = await compteur(env, `otp:mail:${email}`,
          ABUS.mailParAdresse.plafond, ABUS.mailParAdresse.fenetre);
        if (!parMail.permis) {
          return new Response(pageConnexion(T.tropMail),
            { status: 429, headers: htmlHeaders });
        }

        const sent = await supabaseAuth(env, '/auth/v1/otp', { email, create_user: true });
        if (!sent.ok) {
          return new Response(pageConnexion(T.envoiImpossible),
            { status: sent.status === 429 ? 429 : 502, headers: htmlHeaders });
        }
        return new Response(pageCode(email), { status: 200, headers: htmlHeaders });
      } catch (e) {
        /* Cette route vit hors du `try` general plus bas. Sans celui-ci, une
           panne de base rendrait la page d'exception brute de la plateforme
           sur le seul ecran ou un visiteur a besoin d'une phrase lisible. */
        return new Response(pageConnexion(T.indisponible),
          { status: 503, headers: htmlHeaders });
      }
    }

    if (path === '/api/auth/verify-code' && request.method === 'POST') {
      try {
      const form = await request.formData();
      const email = String(form.get('email') || '').trim().toLowerCase();
      const token = String(form.get('code') || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6,8}$/.test(token)) {
        return new Response(pageCode(email, T.codeInvalide), { status: 400, headers: htmlHeaders });
      }
      const essais = await compteur(env, `code:mail:${email}`,
        ABUS.essaisParAdresse.plafond, ABUS.essaisParAdresse.fenetre);
      if (!essais.permis) {
        return new Response(pageCode(email, T.tropEssais),
          { status: 429, headers: htmlHeaders });
      }
      const verified = await supabaseAuth(env, '/auth/v1/verify', { email, token, type: 'email' });
      const user = verified.data?.user;
      if (!verified.ok || !user?.id || !user?.email || !user?.email_confirmed_at) {
        return new Response(pageCode(email, T.codeFaux), { status: 401, headers: htmlHeaders });
      }
      const session = await createSession(env, user);
      return new Response(null, { status: 303, headers: {
        'Location': '/', 'Cache-Control': 'no-store',
        'Set-Cookie': `lw_session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_PLAFOND * 86400}`,
      } });
      } catch (e) {
        return new Response(pageCode('', T.indisponible),
          { status: 503, headers: htmlHeaders });
      }
    }

    if (path === '/api/login' && request.method === 'POST') {
      if (!pwd) return json({ error: 'aucun mot de passe configuré' }, 501);
      const form = await request.formData();
      const given = String(form.get('password') || '');

      const ok = (await hmac(pwd, 'check')) === (await hmac(given, 'check'));
      if (!ok) {
        await new Promise(r => setTimeout(r, 1000));   // freine le bourrinage
        return new Response(LOGIN_PAGE('Incorrect password.'), { status: 401, headers: htmlHeaders });
      }
      const token = await makeToken(pwd);
      return new Response(null, {
        status: 303,
        headers: {
          'Location': '/',
          'Set-Cookie': `wd_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; `
                      + `Max-Age=${SESSION_DAYS * 86400}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    /* LE GET COMPTE AUTANT QUE LE POST, ET CE N'EST PAS UN CONFORT.
       Le lien « Se déconnecter » est une ancre vers cette adresse ; le script
       de la page intercepte le clic, vide le stockage local, puis envoie un
       POST. Si ce script n'a pas pris, l'ancre part en GET : la route ne
       repondait qu'au POST, donc la personne lisait « route inconnue » en JSON
       et restait connectee. Un bouton de sortie qui ne sort pas est le pire
       des boutons.

       Accepter le GET ne rouvre rien : le cookie de compte est en
       `SameSite=Strict`, donc une image posee sur un site tiers n'emporte
       aucune session et ne deconnecte personne. */
    if (path === '/api/logout' && (request.method === 'POST' || request.method === 'GET')) {
      const session = cookieValue(request, 'lw_session');
      if (session && env.DB) {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
          .bind(await sha256(session)).run();
      }
      const sortie = new Headers({ 'Location': '/', 'Cache-Control': 'no-store' });
      sortie.append('Set-Cookie', 'lw_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      sortie.append('Set-Cookie', 'wd_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return new Response(null, { status: 303, headers: sortie });
    }

    const PUBLIC = ['/icon-192.png', '/apple-touch-icon.png',
      /* LES DEUX ECRITURES, ET CE N'EST PAS UNE PRECAUTION EN L'AIR.
         Cloudflare Pages redirige `/confidentialite.html` vers
         `/confidentialite` par un 308 avant meme d'arriver ici. Seule la
         premiere etait declaree publique : la redirection tombait donc sur le
         garde-fou, et la politique de confidentialite renvoyait la page de
         connexion. Le formulaire d'inscription y renvoie pourtant, et
         quelqu'un doit pouvoir la lire AVANT de donner son adresse. */
      '/confidentialite.html', '/confidentialite',
      '/privacy.html', '/privacy'];

    const email = await accessEmail(request, env);
    const appIdentity = await sessionIdentity(request, env);

    /* DEUX PORTES SUR LA MEME MAISON, ET LA PLUS ANCIENNE N'A PAS DE SERRURE
       INDIVIDUELLE. Le mot de passe unique est juste pour une instance a un
       seul proprietaire : sa session ne porte aucune identite, donc le stockage
       retombe sur la clef partagee `state:default`. Laisse en service a cote
       des comptes, il donne a quiconque connait ce mot de passe un acces qui
       n'est celui de personne — et `ALLOW_PUBLIC` fait pire encore.

       La consigne existait, ecrite dans un mode d'emploi. Une regle qui vit
       dans un document se respecte jusqu'au jour ou quelqu'un ne l'a pas lue. */
    const motDePasseAdmis = !!pwd && !emailAuthReady;
    const identifie = !!appIdentity || !!email
      || (motDePasseAdmis && await tokenIsValid(cookieValue(request, 'wd_session'), pwd));
    const authorised = PUBLIC.includes(path)
      || (DEMO_PUBLIQUE && !pwd)
      || (env.ALLOW_PUBLIC === '1' && !emailAuthReady)
      || identifie;

    if (!authorised) {
      if (emailAuthReady && !path.startsWith('/api/')) {
        return new Response(pageConnexion(''), { status: 401, headers: htmlHeaders });
      }
      if (path.startsWith('/api/')) {
        return json({ error: 'non authentifié' }, 403);
      }
      return new Response(pwd ? LOGIN_PAGE('') : LOCKED_PAGE, { status: pwd ? 401 : 403, headers: htmlHeaders });
    }

    if (!path.startsWith('/api/')) {
      if (FICHIERS_DE_DEVELOPPEMENT.test(path)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
      return env.ASSETS.fetch(request);        // le site lui-même
    }

    try {
      if (path === '/api/account/delete-code' && request.method === 'POST') {
        if (!appIdentity) return json({ error: 'identité requise' }, 403);
        const parIp = await compteur(env, `otp:ip:${clientIp(request)}`,
          ABUS.mailParIp.plafond, ABUS.mailParIp.fenetre);
        const parMail = await compteur(env, `otp:mail:${appIdentity.email}`,
          ABUS.mailParAdresse.plafond, ABUS.mailParAdresse.fenetre);
        if (!parIp.permis || !parMail.permis) {
          return json({ error: 'trop de demandes' }, 429);
        }
        const envoye = await supabaseAuth(env, '/auth/v1/otp',
          { email: appIdentity.email, create_user: false });
        if (!envoye.ok) return json({ error: 'envoi impossible' }, 502);
        return json({ ok: true });
      }

      if (path === '/api/account/delete' && request.method === 'POST') {
        if (!appIdentity) return json({ error: 'identité requise' }, 403);
        const essais = await compteur(env, `code:mail:${appIdentity.email}`,
          ABUS.essaisParAdresse.plafond, ABUS.essaisParAdresse.fenetre);
        if (!essais.permis) return json({ error: 'trop d’essais' }, 429);

        let recu = {};
        try { recu = await request.json(); } catch { /* corps vide */ }
        const code = String(recu.code || '').trim();
        if (!/^\d{6,8}$/.test(code)) return json({ error: 'code invalide' }, 400);

        const verifie = await supabaseAuth(env, '/auth/v1/verify',
          { email: appIdentity.email, token: code, type: 'email' });
        if (!verifie.ok || verifie.data?.user?.id !== appIdentity.id) {
          return json({ error: 'code incorrect' }, 401);
        }
        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(appIdentity.id).run();
        const chezLeFournisseur = await supabaseAdmin(
          env, `/auth/v1/admin/users/${appIdentity.id}`, 'DELETE');
        const sortie = new Headers({
          'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        });
        sortie.append('Set-Cookie',
          'lw_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
        return new Response(
          JSON.stringify({ ok: true, identiteEffacee: chezLeFournisseur.ok }),
          { headers: sortie });
      }

      if (path === '/api/health') {
        return json({
          ok: true,
          service: 'wealth-dashboard',
          host: 'cloudflare',
          storage: env.DB ? 'd1' : (env.WEALTH ? 'kv' : 'none'),
          accounts: emailAuthReady,
          userId: appIdentity?.id || null,
          user: appIdentity?.email || email || null,
        });
      }

      if (path === '/api/quotes') {
        const raw = url.searchParams.get('symbols') || '';
        const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 40);
        if (!symbols.length) return json({ error: 'aucun symbole' }, 400);
        return json({ quotes: await Promise.all(symbols.map(quote)), at: Date.now() / 1000 });
      }

      if (path === '/api/isin') {
        const code = (url.searchParams.get('code') || '').trim();
        if (!code) return json({ error: 'code manquant' }, 400);
        return json(await resolveIsin(code, (url.searchParams.get('prefer') || '').trim()));
      }

      if (path === '/api/search') {
        const q = (url.searchParams.get('q') || '').trim();
        if (q.length < 2) return json({ results: [] });
        const prefer = (url.searchParams.get('prefer') || '').trim();
        const out = await search(q);
        out.sort((a, b) => rank(a, prefer) - rank(b, prefer));
        return json({ results: out });
      }

      if (path === '/api/state' && appIdentity) return handleD1State(request, env, appIdentity);
      if (path === '/api/state') return handleState(request, env, email, identifie);

      return json({ error: 'route inconnue' }, 404);
    } catch (e) {
      console.error('api', e);
      return json({ error: 'service indisponible' }, 502);
    }
  },
};
