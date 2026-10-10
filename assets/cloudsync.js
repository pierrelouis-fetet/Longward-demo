/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const CloudSync = (() => {

  const WRITE_DELAY = 2500;

  const SYNCED_KEY = 'wealth-dashboard:synced-at';
  let userId = null;
  const syncedKey = () => userId ? `${SYNCED_KEY}:user:${userId}` : SYNCED_KEY;
  const lastSyncedAt = () => { try { return localStorage.getItem(syncedKey()); } catch (e) { return null; } };
  const markSynced = at => { try { localStorage.setItem(syncedKey(), at || ''); } catch (e) {} };

  /* L'EMPREINTE DU DERNIER CORPS QUE LE CLOUD PORTE, d'apres cet appareil.

     La date ne suffit pas a reconnaitre un etat. Une ecriture derivee -- un
     cours rafraichi, un ISIN resolu -- change le corps sans changer `savedAt`,
     et le serveur arbitre sur cette seule date : deux corps differents
     partagent donc une date. L'empreinte suit le corps. Elle se pose quand le
     serveur a accepte un envoi (celle du corps envoye, pas de l'etat courant),
     quand on prend la version en ligne, et au demarrage quand les deux cotes
     sont identiques. Elle survit au rechargement et se cloisonne par compte,
     comme la date : la deconnexion l'efface avec elle. */
  const SYNCED_BODY_KEY = 'wealth-dashboard:synced-body';
  const syncedBodyKey = () => userId ? `${SYNCED_BODY_KEY}:user:${userId}` : SYNCED_BODY_KEY;
  const lastSyncedBody = () => { try { return localStorage.getItem(syncedBodyKey()); } catch (e) { return null; } };
  const markSyncedBody = corps => { try { localStorage.setItem(syncedBodyKey(), empreinte(corps)); } catch (e) {} };
  function hache53(texte, graine) {
    let h1 = 0xdeadbeef ^ graine, h2 = 0x41c6ce57 ^ graine;
    for (let i = 0; i < texte.length; i++) {
      const c = texte.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const empreinte = texte => `${texte.length.toString(36)}.${hache53(texte, 0)}.${hache53(texte, 1)}`;
  const corpsLocal = () => JSON.stringify(Store.state);
  const sansSuspension = st => ({ ...st, meta: { ...(st.meta || {}), envoiSuspendu: undefined } });

  const COMPTES_KEY = 'wealth-dashboard:comptes';
  const litComptes = () => {
    try { return localStorage.getItem(COMPTES_KEY) === '1'; } catch (e) { return false; }
  };
  let comptes = litComptes();
  /* LE CHEMIN LOCAL D'ABORD N'EST OUVERT QU'A QUI S'EST DEJA PRESENTE COMME SANS
     COMPTES. `'0'` n'est ecrit que par une sonde qui a repondu ; un drapeau
     absent — premiere visite, ou site qui ne repond jamais — laisse `app.js` sur
     le chemin prudent, l'identite avant toute lecture. Une demonstration
     publique revient donc ici a chaque visite apres la premiere ; une instance a
     comptes n'y passe jamais, son drapeau vaut '1'. */
  const sansComptesConnu = () => {
    try { return localStorage.getItem(COMPTES_KEY) === '0'; } catch (e) { return false; }
  };
  let probed = false;

  let available = false;        // /api/state répond
  let user = null;              // email Cloudflare Access
  let timer = null;
  let lastPayload = null;       // évite les écritures identiques
  /* Les corps confies a `sendBeacon`, tant qu'aucune reponse ne dit s'ils sont
     arrives : le beacon part sans retour. Une liste et non un seul : deux
     fermetures de suite confient deux corps, et le premier peut arriver quand
     le second est refuse. */
  let beacons = [];
  let status = { lastPush: null, error: null, conflict: null, pushing: false };
  let onChange = () => {};
  let onConflit = () => {};

  const setOnChange = fn => { onChange = fn; };
  const setOnConflit = fn => { onConflit = fn; };

  /* Noter la version qu'on vient de lire. Le repere sert de `base` a la
     prochaine ecriture, et il doit donc se poser aussi quand on adopte l'etat du
     cloud sans l'avoir ecrit : sinon la sauvegarde suivante declare avoir lu une
     version qui n'est plus en place, et se fait refuser sans raison. */
  /* L'empreinte suit, et c'est celle du corps RECU (`corps`), tel qu'il est
     en ligne : la migration qui suit l'adoption peut le changer, et l'etat
     migre n'est alors pas en ligne -- `aJour()` le dit, et il part. Sans
     corps, l'etat courant. */
  const noterVersionLue = (at, corps) => { markSynced(at); markSyncedBody(corps ?? corpsLocal()); status.conflict = null; };

  const aJour = () => {
    const local = Store.state?.meta?.savedAt;
    if (!local) return true;
    return lastSyncedAt() === local && lastSyncedBody() === empreinte(corpsLocal());
  };

  async function probe() {
    const d = await Quotes.healthData();
    probed = true;
    available = !!d && (d.storage === 'kv' || d.storage === 'd1');
    user = (d && d.user) || null;
    userId = (d && d.userId) || null;
    if (d && typeof d.accounts === 'boolean') {
      comptes = d.accounts;
      try { localStorage.setItem(COMPTES_KEY, comptes ? '1' : '0'); } catch (e) {}
    }
    return available;
  }

  async function pull() {
    const r = await fetch('/api/state', {
      cache: 'no-store', headers: { 'X-Longward-User': userId || '' },
    });
    if (r.status === 204) return null;
    if (!r.ok) throw new Error(`lecture impossible (HTTP ${r.status})`);
    return r.json();
  }

  /* Un seul envoi en vol a la fois.

     Rien ne l'empechait, et l'envoi immediat a chaque geste rendait le defaut
     atteignable : deux clics rapproches lançaient deux `PUT` concurrents, et
     c'est le plus lent qui arrivait en dernier — donc potentiellement un etat
     plus ancien, ecrit par-dessus le plus recent. Sur un reseau mobile ou les
     latences varient d'un facteur trois, ce n'est pas une hypothese d'ecole.

     Quand un envoi est deja parti, on ne l'annule pas : on note qu'il faudra
     recommencer, et le `finally` s'en charge. Le dernier etat gagne toujours,
     puisque `push()` relit `Store.state` a chaque tour. */
  let enVol = null;
  let aRejouer = false;
  const RETRY_DELAY = 15000;
  let reessaiArme = false;

  async function push(opts = {}) {
    if (enVol) { aRejouer = true; return enVol; }
    enVol = pushMaintenant(opts);
    try { return await enVol; }
    finally {
      enVol = null;
      if (aRejouer) { aRejouer = false; push(opts); }
    }
  }

  async function pushMaintenant({ force = false } = {}) {
    if (!available) return { skipped: true };
    /* Apres un etat local illisible, la memoire porte la graine : l'envoyer
       remplacerait la vraie version en ligne. Seuls la reprise de celle-ci ou
       un "Imposer" explicite (`force`) levent la suspension. */
    if (!force && Store.envoiSuspendu) return { skipped: true, suspendu: true };
    const impose = force && Store.envoiSuspendu;
    const payload = impose ? JSON.stringify(sansSuspension(Store.state)) : JSON.stringify(Store.state);
    if (!force && payload === lastPayload) return { skipped: true };

    /* L'horodatage de CE qu'on envoie, releve au moment de la serialisation.

       `markSynced(Store.state.meta.savedAt)` le lisait apres la reponse du
       reseau. Une frappe pendant l'aller-retour — et il y en a, l'application
       ecrit a chaque caractere — et l'on marquait comme synchronise un etat plus
       recent que celui reellement envoye. La modification suivante devenait donc
       invisible au conflit, et pouvait etre ecrasee sans un mot. */
    const envoyeAt = Store.state?.meta?.savedAt;

    status.pushing = true;
    try {
      /* La version qu'on a lue part avec l'ecriture : le serveur n'accepte que si
         c'est encore celle en place. Voir la note de `handleState()` dans
         `_worker.js`, le seul point d'entree que Cloudflare Pages charge.
         Sans ce parametre, un onglet ouvert depuis des heures ecrasait ce qu'un
         autre appareil venait d'enregistrer, sur la seule foi d'une estampille
         plus fraiche. */
      const vu = lastSyncedAt();
      const params = force ? '?force=1' : (vu ? `?base=${encodeURIComponent(vu)}` : '');
      const r = await fetch('/api/state' + params, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Longward-User': userId || '' },
        body: payload,
      });

      if (r.status === 409) {
        const d = await r.json();
        /* NOTRE PROPRE BEACON, ARRIVE PENDANT QU'ON NE REGARDAIT PAS.

           La fermeture a confie un corps a `sendBeacon`, sans reponse. Le
           serveur l'a accepte, puis cet envoi-ci declare l'ancienne base et se
           fait refuser : sans ce cas, retourner sur l'application apres l'avoir
           cachee produisait un conflit contre soi-meme. La date seule ne le
           prouve pas, puisqu'une ecriture derivee garde la sienne : on lit la
           version en ligne et l'on compare les corps eux-memes, caractere pour
           caractere. Le meme corps, c'est le notre ; un autre, c'est un vrai
           conflit. */
        /* Une lecture qui echoue n'est pas un verdict : elle part dans le
           `catch`, comme une panne, avec son reessai, et les beacons restent en
           attente. */
        if (d && d.remoteSavedAt && beacons.some(b => b.at === d.remoteSavedAt)) {
          const distant = await pull();
          const texte = distant ? JSON.stringify(distant) : null;
          const sien = beacons.find(b => b.payload === texte);
          beacons = [];
          if (sien) {
            markSynced(sien.at);
            markSyncedBody(sien.payload);
            lastPayload = sien.payload;
            status.error = null;
            status.conflict = null;
            if (payload === sien.payload) return { ok: true };
            return pushMaintenant({ force });
          }
        }
        status.conflict = d;                 // une version plus récente existe en ligne
        status.error = null;
        onConflit(d);
        return { conflict: d };
      }
      if (!r.ok) throw new Error(`écriture impossible (HTTP ${r.status})`);

      lastPayload = payload;
      markSynced(envoyeAt);
      markSyncedBody(payload);
      beacons = [];
      if (impose && Store.leverSuspension) {
        Store.leverSuspension();
        try { if (Store.ecrireLocal) Store.ecrireLocal(); } catch (e) { /* le prochain enregistrement s'en charge */ }
      }
      status.lastPush = new Date().toISOString();
      status.error = null;
      status.conflict = null;
      return { ok: true };
    } catch (e) {
      status.error = e.message;
      /* Un echec reseau n'etait suivi de rien : l'erreur se notait, et la
         modification attendait la prochaine frappe ou la prochaine ouverture de
         l'application. Corriger un montant dans un train, puis ranger son
         telephone, suffisait a la laisser en arriere-plan pendant des heures.

         Un seul reessai arme, et non une boucle : si le reseau est vraiment
         coupe, c'est l'evenement `online` qui reprendra la main — insister
         toutes les quinze secondes ne ferait que vider la batterie. Le repere
         est pose avant l'attente, pour que deux echecs de suite n'arment pas
         deux minuteurs. */
      if (!reessaiArme) {
        reessaiArme = true;
        setTimeout(() => { reessaiArme = false; push(); }, RETRY_DELAY);
      }
      return { error: e.message };
    } finally {
      status.pushing = false;
      onChange();
    }
  }

  function schedulePush() {
    if (!available) return;
    clearTimeout(timer);
    timer = setTimeout(push, WRITE_DELAY);
  }

  /* QUI GAGNE AU DEMARRAGE, ET POURQUOI. Fonction pure, sans reseau ni
     stockage : c'est la seule forme sous laquelle cette regle se teste pour de
     bon. Tant qu'elle vivait dissoute dans `init()`, la suite ne pouvait
     qu'affirmer que telle ligne etait bien ecrite — elle n'a jamais joue une
     seule rencontre entre deux appareils, et le defaut ci-dessous a vecu des
     semaines sous un vert complet.

     TROIS DATES, ET LA TROISIEME EST CELLE QUI COMPTE. `localAt` et `remoteAt`
     disent quand chaque cote a ete ecrit ; `syncedAt` dit ou cet appareil avait
     laisse le cloud la derniere fois qu'il l'a lu ou ecrit. Comparer les deux
     premieres ne repond qu'a « qui porte l'estampille la plus fraiche », ce qui
     n'est pas la question posee.

     Car une estampille fraiche ne prouve aucun contenu frais. `Store.save()`
     date l'etat a chaque ecriture, et le rafraichissement des cours en est une :
     ouvrir l'application sur un ordinateur, sans rien toucher, suffisait a le
     faire passer pour porteur de modifications. Il l'emportait alors sur un
     telephone qui, lui, avait vraiment saisi quelque chose.

     `syncedAt` tranche parce qu'il parle de filiation et non d'heure : si le
     cloud n'est plus la ou nous l'avions laisse, quelqu'un d'autre a ecrit
     depuis, et cet ecart-la est un conflit quel que soit le sens des horloges.
     La regle du detenteur s'y applique alors comme partout ailleurs — la
     version en ligne, avec une sauvegarde et un message. */
  function arbitrer({ localAt, remoteAt, syncedAt }) {
    if (!localAt && !remoteAt) return 'rien';
    if (!localAt) return 'adopter';          // rien a perdre ici
    if (!remoteAt) return 'envoyer';         // rien de lisible en ligne
    if (localAt === remoteAt) return 'aligne';
    if (remoteAt > localAt) {
      return localAt === syncedAt ? 'adopter' : 'conflit';
    }
    return remoteAt === syncedAt ? 'envoyer' : 'conflit';
  }

  async function init() {
    if (!probed && !(await probe())) return { available: false };
    if (!available) return { available: false };
    let remote = null;
    try { remote = await pull(); }
    catch (e) { status.error = e.message; return { available: true, error: e.message }; }

    /* Rien en ligne. Le repere de synchronisation est efface avant l'envoi :
       il designe une version que le cloud n'a plus, donc le declarer ferait
       refuser l'ecriture qu'on veut justement faire. Sans lui, l'envoi part
       sans base, et c'est le serveur qui arbitre — il n'insere que s'il n'y a
       toujours rien. Un `force` faisait la meme chose en supprimant l'arbitrage
       au lieu de le laisser se tenir : si ce 204 etait une fausse lecture, il
       ecrasait un patrimoine entier sans un mot. */
    if (!remote) { markSynced(''); return { available: true, empty: true, user }; }

    if (Store.envoiSuspendu) {
      lastPayload = JSON.stringify(remote);
      markSynced(remote?.meta?.savedAt);
      return { available: true, adopted: true, at: remote?.meta?.savedAt, data: remote, user };
    }

    lastPayload = JSON.stringify(remote);

    const remoteAt = remote?.meta?.savedAt;
    const localAt = Store.state?.meta?.savedAt;
    const verdict = arbitrer({ localAt, remoteAt, syncedAt: lastSyncedAt() });

    if (verdict === 'adopter') {
      markSynced(remoteAt);
      return { available: true, adopted: true, at: remoteAt, data: remote, user };
    }

    if (verdict === 'conflit') {
      return { available: true, newer: true, at: remoteAt, data: remote, user, localAt };
    }

    /* Le repère ne se pose que sur une égalité vraie.

       `markSynced(localAt)` était appelé aussi quand le local était en avance,
       sans qu'aucune écriture n'ait eu lieu : le repère disait « cet état est
       aligné avec le cloud » alors qu'il n'avait jamais été envoyé, et la
       modification suivante devenait invisible au conflit. */
    if (verdict === 'aligne') {
      /* DATES EGALES, CORPS DIFFERENTS : QUI A LU QUOI ?

         Deux corps identiques sont alignes, et le repere se pose.

         Sinon, la date commune ne dit rien a elle seule : `horodatageApres()`
         ordonne les decisions d'UN appareil, pas de deux. Deux appareils
         partis de la meme version peuvent decider dans la meme milliseconde.
         Celui qui n'a jamais lu cette date n'a donc rien a imposer : c'est un
         conflit, regle comme les autres (version en ligne, sauvegarde,
         message).

         Celui qui l'a lue ou ecrite (`synced-at` egal) n'a pu la faire
         diverger que par des ecritures derivees, qui gardent la date. Si son
         corps n'est plus celui du repere -- ou s'il n'a pas de repere, sur une
         installation d'avant lui --, une ecriture derivee n'est peut-etre
         jamais partie : elle part maintenant, avec la date commune pour base.
         Ce qui s'y perd au pire, ce sont des cours plus frais ecrits par un
         autre appareil, que le prochain rafraichissement reprend. Si son
         corps est celui du repere, l'ecart vient d'un autre appareil : on
         prend sa version. */
      const local = corpsLocal();
      if (local === lastPayload) {
        markSynced(localAt);
        markSyncedBody(local);
      } else if (lastSyncedAt() !== localAt) {
        return { available: true, newer: true, at: remoteAt, data: remote, user, localAt };
      } else if (lastSyncedBody() !== empreinte(local)) {
        return { available: true, ready: true, user, aEnvoyer: true };
      } else {
        markSynced(remoteAt);
        return { available: true, adopted: true, at: remoteAt, data: remote, user };
      }
    }

    /* `envoyer` : cet appareil porte une modification jamais partie ET le cloud
       est reste exactement la ou il l'avait laisse. Il n'y a donc rien a perdre
       en ligne, et l'envoi part au demarrage plutot que d'attendre la frappe
       suivante — c'est cette attente qui perdait la saisie quand l'application
       passait en veille avant l'envoi differe. */
    return { available: true, ready: true, user, aEnvoyer: verdict === 'envoyer' };
  }

  /* Écrit ce qui reste en attente quand l'onglet s'en va.

     `sendBeacon` et non `fetch` : le navigateur le prend en charge et le poste
     apres la fermeture, ce qu'une requete ordinaire ne survit pas.

     Le minuteur d'envoi differe est annule au passage : sans cela, une page
     restauree depuis le cache d'arriere-plan garde un minuteur arme sur un etat
     deja envoye, et repousse le meme corps une seconde fois. Sans consequence
     sur les donnees, mais une ecriture pour rien.

     RIEN N'EST MARQUE ENVOYE. `sendBeacon` rend false quand le navigateur
     refuse le corps (trop gros pour partir en arriere-plan, quota), et meme
     quand il l'accepte, le serveur peut le refuser sans que personne ne le
     sache. Le corps confie est seulement retenu dans `beacons` : un second
     passage avec le meme corps -- l'ecran se cache, puis la page se decharge --
     ne repart pas, et le retour sur la page (`reprendre`) verifie. */
  function flushOnUnload() {
    if (!available || Store.envoiSuspendu) return;
    const payload = JSON.stringify(Store.state);
    if (payload === lastPayload) return;
    if (beacons.some(b => b.payload === payload)) return;
    clearTimeout(timer);
    try {
      const vu = lastSyncedAt();
      const params = vu ? `?base=${encodeURIComponent(vu)}` : '';
      const separateur = params ? '&' : '?';
      /* `sendBeacon` ne porte pas d'en-tete : le compte passe donc en
         parametre, faute de mieux, et le serveur le compare a sa session. */
      const parti = navigator.sendBeacon('/api/state' + params + separateur
        + `user=${encodeURIComponent(userId || '')}`,
        new Blob([payload], { type: 'application/json' }));
      if (parti) beacons.push({ payload, at: Store.state?.meta?.savedAt || '' });
    } catch (e) { /* rien à faire de plus au moment de la fermeture */ }
  }

  function reprendre() {
    if (!available) return null;
    return beacons.length || !aJour() ? push() : null;
  }

  return {
    init, pull, push, schedulePush, probe, flushOnUnload, reprendre, setOnChange,
    setOnConflit, noterVersionLue, arbitrer,
    isAvailable: () => available,
    aJour,
    getUser: () => user,
    getUserId: () => userId,
    comptesActifs: () => comptes,
    sansComptesConnu,
    status: () => ({ ...status }),
  };
})();
