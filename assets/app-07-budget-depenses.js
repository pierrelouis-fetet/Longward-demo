/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function paliersCible(courant) {
  const p = [];
  for (let v = 0; v <= 100; v += 1) p.push(v);
  const c = Math.max(0, Math.min(100, num(courant)));
  if (!p.includes(c)) p.push(c);
  return p.sort((a, b) => a - b);
}

/* `paliersObjectif()` vivait ici : les cent-en-cent d'une liste deroulante
   pour l'objectif de depenses. Elle est partie avec la liste. Un objectif se
   saisit maintenant a l'euro, parce que quelqu'un qui vit avec 640 EUR par mois
   doit pouvoir viser juste, et que les paliers ronds ne servaient qu'a essayer
   des hypotheses — un champ libre le fait aussi bien. */

function mountBudget() {
  const year = budgetAnnee();
  /* `expenseSeriesVisible` et non `expenseSeries` : un mois a venir n'est pas
     un mois a zero euro, et une barre plate se lit comme un mois sans depenses. */
  const rows = expenseSeriesVisible(year);
  Charts.barsWithTarget($('#bChart'), {
    height: 300,
    items: rows.map(r => ({ label: r.label, value: r.total, note: r.note })),
    target: num(Store.state.budget.monthlyTarget),
    targetLabel: trad('Objectif'),
  });
  /* Le conteneur n'existe pas quand les categories sont desactivees : la carte
     entiere ne se rend plus. `mount()` sort en silence dans ce cas, mais on ne
     l'appelle meme pas -- une carte absente n'a pas de graphique a monter. */
  if ($('#bCats')) Charts.rankedBars($('#bCats'), { items: expenseByCategory(year) });
}

function viewData() {
  const checks = healthChecks();
  checks.sort((a, b) => RANG_NOTIF[a.level] - RANG_NOTIF[b.level]);
  const premiersPas = checks.filter(c => c.level === 'action' && c.sujet === 'saisies');
  const anomalies = checks.filter(c => !premiersPas.includes(c));
  const backups = Store.backups();
  const cloud = CloudSync.isAvailable() && !modeDemo();
  const s = cloud ? CloudSync.status() : null;
  const u = cloud ? CloudSync.getUser() : null;
  const savedAt = Store.state.meta.savedAt;
  const nbReleves = Store.state.monthly.filter(r => !rowIsEmpty(r)).length;
  const pluriel = (n, un, des) => `${n} ${trad(n > 1 ? des : un)}`;
  const nbComptes = comptesOuverts().filter(c => c.type !== 'especes' || valeurCompte(c) > 0.005).length;
  const compteurs = `${pluriel(nbComptes, 'compte', 'comptes')} · ${
    pluriel(nbReleves, 'relevé', 'relevés')} · ${pluriel(Store.state.positions.length, 'position', 'positions')}`;

  let etat;
  if (!cloud) {
    etat = { niveau: 'ok', titre: trad('Enregistrées sur cet appareil'),
             sous: savedAt ? trad('Dernière modification {q}').replace('{q}', fmtWhen(savedAt))
                           : trad('Aucune modification enregistrée pour l’instant') };
  } else if (s.conflict) {
    etat = { niveau: 'alerte', titre: trad('Conflit de synchronisation'),
             sous: trad('La version en ligne ({d}) est plus récente que celle de cet appareil.')
               .replace('{d}', new Date(s.conflict.remoteSavedAt).toLocaleString(locale())) };
  } else if (s.error) {
    etat = { niveau: 'erreur', titre: trad('Dernier envoi refusé'), sous: s.error };
  } else if (s.pushing || !CloudSync.aJour()) {
    etat = { niveau: 'attente', titre: trad('Modifications en attente d’envoi'),
             sous: trad('Elles partent quelques secondes après chaque changement.') };
  } else {
    etat = { niveau: 'ok', titre: trad('Données synchronisées'),
             sous: trad('Dernière synchronisation {q}').replace('{q}', fmtWhen(s.lastPush || savedAt)) };
  }

  const quand = iso => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short' });
  const heure = iso => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const ligneSauvegarde = (b, i) => `
      <li class="frise-ligne">
        <div class="frise-quand"><b>${esc(quand(b.at))}</b><span class="sub">${esc(heure(b.at))}</span></div>
        <div class="frise-quoi"><b>${esc(majuscule(b.reason))}</b>
          <span class="sub">${pluriel(((b.data && b.data.positions) || []).length, 'position', 'positions')} · ${
            (JSON.stringify(b.data || {}).length / 1024).toFixed(0)} Ko · ${fmtWhen(b.at)}</span></div>
        <button class="btn sm ghost" data-action="restore-backup" data-i="${i}">${trad('Restaurer')} →</button>
      </li>`;
  const recentes = backups.slice(0, 3), anciennes = backups.slice(3);

  return `
  <header class="page-tete">
    <h2>${trad('Données')}</h2>
    <p>${trad('Sauvegarde, synchronisation et contrôle de tes données.')}</p>
  </header>

  <section class="card tight etat-donnees etat-${etat.niveau}">
    <span class="etat-point" aria-hidden="true"></span>
    <div class="etat-texte">
      <b>${esc(etat.titre)}</b>
      <span class="sub">${esc(etat.sous)}</span>
      <span class="etat-compte">${compteurs}</span>
    </div>
    ${cloud && !s.conflict ? `<button class="btn icon etat-sync" data-action="cloud-push" type="button"
        title="${trad('Synchroniser maintenant')}" aria-label="${trad('Synchroniser maintenant')}">↻</button>` : ''}
    ${cloud && s.conflict ? `<div class="paire-btn etat-conflit">
      <button class="btn sm" data-action="cloud-pull">${trad('Prendre la version en ligne')}</button>
      <button class="btn sm ghost" data-action="cloud-force">${trad('Imposer celle de cet appareil')}</button>
    </div>` : ''}
  </section>

  <div class="colonnes-bureau">
  <section class="card tight controles ${anomalies.length ? 'controles-alerte' : 'controles-ok'}">
    <div class="controles-tete">
      <span class="etat-point" aria-hidden="true"></span>
      <span class="surtitre">${trad('Contrôles de cohérence')}</span>
      <b>${anomalies.length
        ? trad(anomalies.length > 1 ? '{n} points à vérifier' : '{n} point à vérifier').replace('{n}', anomalies.length)
        : trad('Tout semble cohérent')}</b>
    </div>
    ${anomalies.length ? `<ul class="controles-liste">${anomalies.map(c => `
      <li class="controle controle-${c.level}">
        <span class="controle-ic" aria-hidden="true">${ICONE_NOTIF[c.level] || '•'}</span>
        <div class="controle-texte"><b>${esc(c.title)}</b><span class="sub">${escMontant(c.detail)}</span></div>
        <a href="#/${c.view}" class="btn ghost sm">${trad('Examiner')}</a>
      </li>`).join('')}</ul>` : ''}
    ${premiersPas.length ? `<div class="controles-debut">
      <span class="surtitre">${trad('Saisies en attente')}</span>
      ${premiersPas.map(c => `
      <div class="controle controle-debut">
        <div class="controle-texte"><b>${esc(c.title)}</b><span class="sub">${escMontant(c.detail)}</span></div>
        <a href="#/${c.view}" class="btn ghost sm">${trad('Voir')}</a>
      </div>`).join('')}
    </div>` : ''}
  </section>

  <section class="card donnees-sections">
    <div class="donnees-section">
      <h2>${trad('Sauvegarde et restauration')}</h2>
      <div class="paire-btn">
        <button class="btn" data-action="export-json">⤓ ${trad('Sauvegarde JSON')}</button>
        <label class="btn ghost" for="importFile">⤒ ${trad('Importer une sauvegarde')}</label>
      </div>
      <input type="file" id="importFile" class="fichier-cache" accept="application/json,.json">
      <p class="small muted">${trad('Le JSON permet de restaurer entièrement Longward.')}${aide(trad('Le JSON restitue ton tableau de bord à l’identique : c’est celui à garder pour restaurer ou changer de machine. Importer remplace l’état enregistré dans ce navigateur, après confirmation, et une sauvegarde de l’état actuel est prise avant. Exporte d’abord si tu as un doute.'))}</p>
      <div class="row demo-bascule">
        ${modeDemo()
          ? `<button class="btn sm ghost" data-action="quitter-demo">← ${trad('Revenir à mes données')}</button>
             <span class="sub">${trad('La démonstration reste disponible')}</span>`
          : `<button class="btn sm ghost" type="button" data-action="charger-demo">▷ ${trad('Voir la démonstration')}</button>
             <span class="sub">${trad('Des chiffres fictifs, sans toucher aux tiennes')}</span>`}
      </div>
    </div>
    <div class="donnees-section">
      <h2>${trad('Exporter pour analyse')}</h2>
      <button class="btn ghost" data-action="export-xlsx-all">⤓ ${trad('Exporter vers Excel')}</button>
      <p class="small muted">${trad('Consulte tes données dans Excel ou un tableur.')}${aide(trad("L’Excel est une photo pour lire et retravailler ailleurs : une feuille par thème, montants au format {dev}, pourcentages calculables. Le découpage d’une catégorie de dépenses y a sa propre feuille, une ligne par montant. Il ne contient pas tous les réglages, il ne peut donc pas être rechargé ici : pour restaurer, c’est la sauvegarde JSON."))}</p>
    </div>
    <div class="donnees-section donnees-annuler">
      <div class="controle-texte">
        <h2>${trad('Dernière modification')}</h2>
        <span class="sub">${Store.undoCount()
          ? pluriel(Store.undoCount(), 'modification annulable', 'modifications annulables')
          : trad('rien à annuler pour l’instant')}</span>
      </div>
      <button class="btn sm ghost" data-action="undo" ${Store.undoCount() ? '' : 'disabled'}
        title="${trad('Annule le dernier changement effectué. Ctrl+Z fait la même chose.')}">↶ ${trad('Annuler')}</button>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2>${trad('Historique des sauvegardes')}</h2>
      <button class="btn sm ghost" data-action="make-backup">${trad('+ Sauvegarder maintenant')}</button>
    </div>
    <p class="sub frise-compte">${backups.length
      ? pluriel(backups.length, 'sauvegarde disponible sur cet appareil', 'sauvegardes disponibles sur cet appareil')
      : trad('Aucune sauvegarde pour l\'instant.')}${aide(trad('Une sauvegarde est prise automatiquement au premier chargement de la journée, et avant tout import, restauration ou réinitialisation. Restaurer sauvegarde d’abord l’état actuel : rien n’est perdu d’un seul geste. Les {n} plus récentes sont conservées dans ce navigateur.').replace('{n}', BACKUP_LIMIT))}</p>
    ${recentes.length ? `<ol class="frise">${recentes.map(ligneSauvegarde).join('')}</ol>` : ''}
    ${anciennes.length ? `<details class="data-view frise-reste">
      <summary>${trad('Voir les {n} sauvegardes').replace('{n}', backups.length)}</summary>
      <ol class="frise">${anciennes.map((b, i) => ligneSauvegarde(b, i + recentes.length)).join('')}</ol>
    </details>` : ''}
  </section>

  <section class="card tight confidentialite">
    <div class="confidentialite-tete">
      <span aria-hidden="true">🔒</span>
      <div>
        <b>${trad('Confidentialité et stockage')}</b>
        <span class="sub">${cloud
          ? trad('Tes données financières sont stockées en Europe, chez Cloudflare, et sur cet appareil.')
          : trad('Tes données financières restent uniquement sur cet appareil.')}</span>
      </div>
    </div>
    <details class="data-view">
      <summary>${trad('En savoir plus')}</summary>
      <p class="small muted confidentialite-detail">${trad('Ce tableau de bord contient des informations financières qui te concernent directement : au sens du RGPD, ce sont des <b>données à caractère personnel</b>, et tu en es responsable.')}
      ${cloud
        ? trad('Elles sont enregistrées <b>chez Cloudflare</b> (stockage KV, Europe), en plus de ce navigateur. Elles n’y sont <b>pas chiffrées de bout en bout</b> : techniquement, Cloudflare peut y accéder. L’accès est protégé par ton mot de passe, change-le s’il a pu fuiter, cela déconnecte aussitôt tous les appareils. Pour tout retirer : supprime l’espace KV et le projet Pages.')
        : trad('Elles restent <b>uniquement dans le navigateur de cette machine</b>, rien n’est envoyé sur un serveur.')}
      ${trad('Un export JSON ou Excel sort de ce cadre : évite de le déposer sur un service tiers non maîtrisé ou de l’envoyer par e-mail non chiffré, et efface ceux dont tu n’as plus besoin.')}</p>
    </details>
  </section>

  <details class="data-view diagnostic">
    <summary>${trad('Diagnostic')}</summary>
    <dl class="kv" style="margin-top:12px">
      <dt>${trad('Positions')}</dt><dd>${Store.state.positions.length}</dd>
      <dt>${trad('Relevés enregistrés')}</dt><dd>${nbReleves}</dd>
      <dt>${trad('Comptes suivis')}</dt><dd>${ACCOUNTS.length}</dd>
      <dt>${trad('Taille du stockage')}</dt><dd>${(JSON.stringify(Store.state).length / 1024).toFixed(1)} Ko</dd>
      ${u ? `<dt>${trad('Compte')}</dt><dd class="phrase">${esc(u)}</dd>` : ''}
      <dt>${trad('Version')}${aide(trad("La version du code que tu es en train d’exécuter, lue sur la balise du script. Si elle ne change pas après un déploiement, c’est que le navigateur ressert l’ancienne : ferme complètement l’application et rouvre-la, un simple rechargement ne suffit pas toujours."))}</dt>
        <dd style="font-family:var(--font-nb)">${esc(VERSION_APP)}</dd>
    </dl>
  </details>
  </div>

  <section class="card zone-danger">
    <div class="card-head"><h2>${trad('Réinitialiser Longward')}</h2></div>
    <p class="small muted">${trad('Supprime les comptes, relevés, budgets et dépenses pour repartir avec un espace vierge. Une sauvegarde est prise avant, et Ctrl+Z annule.')}</p>
    <button class="btn ghost danger" data-action="start-blank">${trad('Tout effacer')}</button>
  </section>`;
}
function mountData() {
  const f = $('#importFile');
  if (!f) return;
  f.addEventListener('change', async () => {
    const file = f.files[0];
    if (!file) return;
    if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
      await askConfirm(trad("L'Excel ne peut pas être réimporté") + '\n'
        + trad("C'est une photo pour lire et retravailler ailleurs : il ne contient pas tous les "
        + 'réglages du tableau de bord. Pour restaurer, prends le fichier « Sauvegarde JSON ».'),
        { ok: 'Compris', danger: false });
      f.value = '';
      return;
    }
    if (!await askConfirm(`${trad('Importer')} ${guill(file.name)} ?\n\n${trad('Cela remplacera toutes les données actuellement enregistrées dans ce navigateur.')}`)) {
      f.value = ''; return;
    }
    /* LIRE, VALIDER, SAUVEGARDER L'ANCIEN, PUIS SEULEMENT REMPLACER.

       L'ordre etait l'inverse : `Store.state = data` s'executait avant
       `Store.migrate()`, et un fichier qui passait la garde sommaire —
       `{ positions: [], monthly: [] }` la passe — faisait echouer la migration
       APRES avoir remplace l'etat. L'ecran annonçait « Import impossible » et
       le patrimoine etait deja perdu : zero compte, zero releve, zero euro.

       La migration s'execute donc sur un candidat, l'etat courant revient si
       elle echoue, et une sauvegarde est posee avant de toucher a quoi que ce
       soit. C'est le geste le plus destructeur de l'application ; il est le
       seul a n'avoir eu aucun filet. */
    try {
      const brut = await file.text();
      let data;
      try { data = JSON.parse(brut); }
      catch (e) { throw new Error(trad('Ce fichier n’est pas un JSON lisible.')); }
      if (!data || typeof data !== 'object' || Array.isArray(data)
          || !Array.isArray(data.positions) || !Array.isArray(data.monthly)
          || !data.budget || typeof data.budget !== 'object')
        throw new Error(trad('Ce fichier n’a pas la forme d’une sauvegarde Longward.'));

      const avant = Store.state;
      const filet = Store.addBackup('avant import');
      Store.state = data;
      try {
        Store.migrate();
        refreshAccounts();
      } catch (e) {
        Store.state = avant;
        refreshAccounts();
        throw new Error(trad('Cette sauvegarde n’a pas pu être relue : tes données n’ont pas bougé.'));
      }
      Store.save();
      render();
      toast(filet ? trad('Import réussi')
                  : trad('Import réussi, sans copie de secours'));
    } catch (e) {
      await askConfirm(trad('Import impossible') + '\n\n' + e.message,
        { ok: 'Compris', danger: false });
    }
  });
}

function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

/* Une cellule de tableur est du texte affiche : sans `trad()`, l'export d'une
   application en anglais sortait « Quotidien » et « Non cote ». La fonction
   plutot qu'un objet constant, parce que la langue peut changer entre deux
   exports dans la meme session. */
const POCKET = () => ({
  cash: trad(CLASSES_ACTIFS.liquidites),
  bourse: trad(CLASSES_ACTIFS.actions),
  pe: trad(CLASSES_ACTIFS.nonCote),
});

function sheetPositions() {
  const base = stockTotals().balance;
  const pnl = portfolioPnl();
  return {
    name: 'Positions',
    cols: [
      { h: 'Nom', t: 'text', w: 26 }, { h: 'ISIN', t: 'text', w: 15 }, { h: 'Symbole', t: 'text', w: 12 },
      { h: 'Compte', t: 'text', w: 14 },
      { h: 'Classe', t: 'text', w: 13 }, { h: 'Rôle', t: 'text', w: 11 },
      { h: 'Quantité', t: 'num', w: 11 }, { h: 'PRU', t: 'num', w: 11 },
      { h: 'Cours', t: 'num', w: 11 }, { h: 'Devise', t: 'text', w: 9 },
      { h: 'FX', t: 'num', w: 8 },
      { h: 'Valeur', t: 'eur', w: 15 }, { h: 'Investi', t: 'eur', w: 15 },
      { h: 'Perf {dev}', t: 'eur', w: 14 }, { h: 'Perf %', t: 'pct', w: 11 },
      { h: '% portefeuille', t: 'pct', w: 14 },
    ],
    rows: Store.state.positions.map(p => [
      p.name, p.isin || '', p.symbol || '', ACC[p.account]?.label || p.account,
      ASSET_CLASSES[assetClassDe(p)], ROLES[roleDe(p)],
      num(p.qty), num(p.buyPrice), num(p.price), p.currency || 'EUR', num(p.fx || 1),
      round2(posValue(p)), round2(posInvested(p)),
      posPerfEur(p) == null ? null : round2(posPerfEur(p)),
      posPerfPct(p) == null ? null : posPerfPct(p) / 100,
      poidsPortefeuille(posValue(p), base) / 100,
    ]),
    total: ['Total', '', '', '', '', null, null, null, '', null,
      round2(pnl.value), round2(pnl.invested), round2(pnl.pnl),
      pnl.pct == null ? null : pnl.pct / 100, poidsPortefeuille(pnl.value, base) / 100],
  };
}

function sheetAllocation() {
  const total = nowTotals().total;
  const items = allocationByAsset();
  return {
    name: 'Allocation',
    cols: [{ h: 'Actif', t: 'text', w: 34 }, { h: 'Montant', t: 'eur', w: 16 }, { h: '% du patrimoine', t: 'pct', w: 17 }],
    rows: items.map(i => [i.label, round2(i.value), i.pct / 100]),
    total: ['Patrimoine total', round2(total), 1],
  };
}

function sheetRebalance() {
  const r = rebalanceRows();
  const line = c => [c.label, round2(c.value), c.pct / 100, c.targetPct / 100, round2(c.targetVal), round2(c.delta)];
  return {
    name: 'Cibles par classe',
    cols: [
      { h: "Classe d'actif", t: 'text', w: 28 }, { h: 'Montant', t: 'eur', w: 16 },
      { h: '% actuel', t: 'pct', w: 12 }, { h: 'Cible %', t: 'pct', w: 12 },
      { h: 'Montant cible', t: 'eur', w: 16 }, { h: 'À ajuster', t: 'eur', w: 16 },
    ],
    rows: [...r.classes.map(line), ...(r.cash ? [line(r.cash)] : [])],
    total: [BASES.baseCibles.nom, round2(r.base), 1, null, null, null],
  };
}

function sheetApports() {
  const liste = apportsTries();
  return {
    name: 'Entrées et sorties',
    cols: [
      { h: 'Date', t: 'text', w: 12 }, { h: 'Intitulé', t: 'text', w: 30 },
      { h: 'Montant', t: 'eur', w: 16 }, { h: 'Note', t: 'text', w: 34 },
    ],
    rows: liste.map(a => [a.date || '', a.libelle || '', round2(a.montant), a.note || '']),
    total: ['Net', '', round2(apportsTotal()), ''],
  };
}

function sheetRoles() {
  const rr = rebalanceRoles();
  return {
    name: 'Socle et satellites',
    cols: [
      { h: 'Rôle', t: 'text', w: 24 }, { h: 'Montant', t: 'eur', w: 16 },
      { h: '% de la base', t: 'pct', w: 14 },
    ],
    rows: rr.roles.filter(x => x.value).map(x => [x.label, round2(x.value), x.pct / 100]),
    total: [BASES.baseCibles.nom, round2(rr.base), 1],
  };
}

function sheetRoleComposition() {
  const rr = rebalanceRoles();
  const rows = [];
  for (const cle of ['core', 'satellite']) {
    const parts = rr.composition[cle] || [];
    const somme = parts.reduce((s, x) => s + x.value, 0);
    for (const p of parts) {
      rows.push([ROLES[cle], p.classe, p.nature === 'fonds' ? 'Fonds' : 'En direct',
                 round2(p.value), somme ? p.value / somme : 0,
                 rr.base ? p.value / rr.base : 0]);
    }
  }
  return {
    name: 'Composition des rôles',
    cols: [
      { h: 'Rôle', t: 'text', w: 14 }, { h: "Classe d'actif", t: 'text', w: 22 },
      { h: 'Nature', t: 'text', w: 12 }, { h: 'Montant', t: 'eur', w: 16 },
      { h: '% du rôle', t: 'pct', w: 12 }, { h: '% de la base', t: 'pct', w: 14 },
    ],
    rows,
    total: ['Total', '', '', round2(rows.reduce((s, x) => s + x[3], 0)), null,
            rr.base ? rows.reduce((s, x) => s + x[3], 0) / rr.base : 0],
  };
}

/* Les lignes de cibles a afficher : les classes, plus la tresorerie si elle est
   encore suivie. `rebalanceRows().cash` vaut null quand on l'a sortie. */
const lignesAvecTresorerie = r => r.cash ? [...r.classes, r.cash] : [...r.classes];

function sheetAccounts() {
  const info = Store.state.accountInfo;
  const rows = ACCOUNTS.filter(a => !a.legacy)
    .map(a => {
      const i = info[a.id] || {};
      const cash = cashOf(a.id);
      const value = nowValue(a.id) + cash;
      const invested = a.holdings
        ? holdingsOf(a.id).reduce((s, p) => s + posInvested(p), 0) + cash
        : (i.deposit != null ? i.deposit - (i.withdrawal || 0) : null);
      return [a.label, a.broker, POCKET()[a.group], i.opened || '',
        i.liquidity === 'illiquid' ? 'Illiquide' : 'Liquide',
        i.deposit ?? null, round2(value),
        invested == null ? null : round2(invested),
        invested == null ? null : round2(value - invested)];
    })
    .filter(r => r[6] !== 0);
  const t = nowTotals();
  return {
    name: 'Comptes',
    cols: [
      { h: 'Compte', t: 'text', w: 24 }, { h: 'Courtier', t: 'text', w: 17 },
      { h: 'Poche', t: 'text', w: 15 }, { h: 'Ouverture', t: 'date', w: 13 },
      { h: 'Liquidité', t: 'text', w: 12 }, { h: 'Dépôts', t: 'eur', w: 15 },
      { h: 'Valeur', t: 'eur', w: 15 }, { h: 'Investi', t: 'eur', w: 15 },
      { h: 'Plus-value', t: 'eur', w: 15 },
    ],
    rows,
    total: ['Patrimoine total', '', '', '', '', null, round2(t.total), null, null],
  };
}

function sheetHistory() {
  const poches = SERIES_PATRIMOINE();
  const colonnes = ACCOUNTS.filter(a => !a.legacy
    || (Store.state.monthly || []).some(r => Math.abs(num(r.v && r.v[a.id])) > 0.005));
  const mixtes = colonnes.filter(a => (Store.state.monthly || []).some(r => {
    const p = r.parts && r.parts[a.id];
    if (!p) return false;
    const cash = num(p.cash);
    const reste = Object.entries(p)
      .reduce((s, [k, m]) => s + (k === 'cash' ? 0 : num(m)), 0);
    return Math.abs(cash) > 0.005 && Math.abs(reste) > 0.005;
  }));
  return {
    name: 'Releves mensuels',
    cols: [
      { h: 'Date', t: 'date', w: 12 },
      ...poches.map(s => ({ h: s.label, t: 'eur', w: 14 })),
      { h: 'Total brut', t: 'eur', w: 16 },
      { h: 'Crédits', t: 'eur', w: 14 },
      { h: 'Total net', t: 'eur', w: 16 },
      ...colonnes.map(a => ({ h: a.label, t: 'eur', w: 15 })),
      ...mixtes.map(a => ({ h: `${a.label} · cash`, t: 'eur', w: 15 })),
      { h: 'Commentaire', t: 'text', w: 60 },
    ],
    rows: Store.state.monthly.map(r => {
      const g = rowGroups(r);
      return [r.date,
        ...poches.map(s => round2(num(g[s.key]))),
        round2(rowTotal(r)), round2(num(r.dettes)), round2(rowNet(r)),
        ...colonnes.map(a => r.v[a.id] == null ? null : num(r.v[a.id])),
        ...mixtes.map(a => cashDuReleve(r, a.id)),
        r.comment || ''];
    }),
  };
}

function sheetSales() {
  const ventes = (Store.state.sales || [])
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const st = salesStats('all');
  return {
    name: 'Ventes',
    cols: [
      { h: 'Date', t: 'date', w: 12 }, { h: 'Ligne', t: 'text', w: 26 },
      { h: 'ISIN', t: 'text', w: 15 }, { h: 'Compte', t: 'text', w: 16 },
      { h: 'Qté', t: 'num', w: 10 }, { h: 'Prix unitaire', t: 'eur', w: 14 },
      { h: 'Devise', t: 'text', w: 8 }, { h: 'Taux vente', t: 'num', w: 11 },
      { h: 'Prix de revient unitaire', t: 'eur', w: 15 }, { h: 'Produit de la vente', t: 'eur', w: 16 },
      { h: 'Encaissé net', t: 'eur', w: 14 },
      { h: 'Coût', t: 'eur', w: 15 }, { h: 'Résultat', t: 'eur', w: 14 },
      { h: '%', t: 'num', w: 10 }, { h: 'Crédité sur', t: 'text', w: 18 },
      { h: 'Note', t: 'text', w: 40 },
    ],
    rows: ventes.map(v => [
      v.date, v.name, v.isin || '', ACC[v.account]?.label || v.account || '',
      v.typeActif === 'bien' ? null : num(v.qty), v.typeActif === 'bien' ? null : round2(num(v.price)),
      v.currency || 'EUR', num(v.fxSell) || 1,
      ...(r => {
        const coutConnu = r.fiable || v.declaree;
        /* Le cout d'un bien est celui de ta part, connu ou non : `invested`. */
        const coutBien = v.typeActif === 'bien' && v.invested != null;
        return [coutConnu && estNombre(v.buyPrice) ? round2(num(v.buyPrice)) : null, round2(num(v.gross)),
                round2(encaisseNetVente(v)),
                (coutConnu || coutBien) && v.invested != null ? round2(num(v.invested)) : null,
                r.fiable ? round2(r.montant) : null,
                r.fiable && num(v.invested) ? round2(r.montant / num(v.invested) * 100) : null];
      })(resultatVente(v)),
      ACC[v.cashAccount]?.label || '', v.note || '',
    ]),
    total: [!st.fiables ? 'Aucune vente fiable' : st.partiel ? 'Total des ventes fiables' : 'Total',
            `${st.partiel ? `${st.fiables} sur ${st.count}` : st.count} vente${st.count > 1 ? 's' : ''}`,
            '', '', null, null, '', null, null,
            st.fiables ? round2(st.grossFiables) : null, st.fiables ? round2(st.encaisseFiables) : null,
            st.fiables ? round2(st.invested) : null,
            st.fiables ? round2(st.realised) : null,
            st.pct == null ? null : round2(st.pct), '', ''],
  };
}

function sheetExpenses() {
  const f = budgetFrame();
  const rows = Store.state.budget.expenses.map(r => [
    r.month, round2(expenseRowTotal(r)), round2(expenseRowTotal(r) - f.target),
    ...expenseCategories().map(c => r.v[c] == null ? null : num(r.v[c])),
    r.note || '',
  ]);
  const totals = expenseCategories().map(c =>
    round2(Store.state.budget.expenses.reduce((s, r) => s + num(r.v[c]), 0)));
  const grand = round2(totals.reduce((s, v) => s + v, 0));
  return {
    name: 'Dépenses',
    cols: [
      { h: 'Mois', t: 'date', w: 12 }, { h: 'Total', t: 'eur', w: 14 },
      { h: 'vs objectif', t: 'eur', w: 14 },
      ...expenseCategories().map(c => ({ h: c, t: 'eur', w: 13 })),
      { h: 'Note du mois', t: 'text', w: 60 },
    ],
    rows,
    total: ['Total', grand, null, ...totals, ''],
  };
}

function sheetFixedCharges() {
  const brut = Store.state.budget.fixedCharges
    .reduce((s, c) => s + chargeMensuelle(c), 0);
  const poids = c => brut ? chargeMensuelle(c) / brut : 0;
  const gens = contributors();
  return {
    name: 'Charges fixes',
    cols: [
      { h: 'Poste', t: 'text', w: 32 }, { h: 'Montant', t: 'eur', w: 15 },
      { h: 'Période', t: 'text', w: 13 }, { h: '{dev} / mois', t: 'eur', w: 15 },
      { h: '% des charges', t: 'pct', w: 15 },
      ...gens.map(g => ({ h: `Part théorique de ${g.name} / mois`, t: 'eur', w: 26 })),
      { h: 'Organisme', t: 'text', w: 24 },
    ],
    rows: Store.state.budget.fixedCharges.map(c => [
      c.label, round2(num(c.amount)), trad(CHARGE_PERIODE_LABEL[chargePeriode(c)]),
      round2(chargeMensuelle(c)), poids(c),
      ...gens.map(g => round2(shareMensuelle(c, g.id))),
      c.provider || '',
    ]),
    total: ['Total', null, '', round2(brut), brut ? 1 : 0,
      ...gens.map(g => round2(partTheoriqueMensuelle(g.id))), ''],
  };
}

async function proposerTransitionLoyer() {
  const loyers = loyersCourantsProbables();
  if (!loyers.length) return;
  const plusieurs = loyers.length > 1;
  const dire = x => `${x.c.label} · ${fmtEUR0(x.mensuel)} ${trad('à ta charge')}`;
  const v = await askForm({
    titre: plusieurs ? 'Tu as plusieurs loyers dans ton budget'
                     : 'Tu as déjà un loyer dans ton budget',
    sous: trad('Ce bien est maintenant ta résidence principale. Ce loyer est toujours compté dans tes charges fixes.'),
    ok: 'Enregistrer',
    champs: [
      ...(plusieurs
        ? [{ cle: 'quel', label: trad('Quel loyer correspond au logement que tu quittes ?'),
             type: 'liste', valeur: '',
             options: [['', trad('Aucun')], ...loyers.map(x => [String(x.i), dire(x)])] }]
        : [{ cle: 'seul', label: dire(loyers[0]), type: 'section' }]),
      { cle: 'quoi', label: trad('Que veux-tu en faire ?'), type: 'liste', valeur: 'garder',
        options: [['garder', trad('Le conserver')], ['terminer', trad('Le terminer')],
                  ['plusTard', trad('Plus tard')]],
        aide: trad('Garde-le si tu paies encore ton ancien logement pendant la transition.') },
    ],
  });
  if (!v || v.quoi !== 'terminer') return;
  const cible = plusieurs ? loyers.find(x => String(x.i) === String(v.quel)) : loyers[0];
  if (!cible) return;
  const nom = cible.c.label;
  /* La ligne quitte le budget COURANT, et lui seul. Les mois deja saisis vivent
     dans `budget.expenses` et dans les releves : rien ici ne les approche, et il
     n'y a pas de fausse chronologie a fabriquer. `Store.save()` empile l'etat
     d'avant, donc la porte de sortie rend la charge entiere — son montant, sa
     periode, son organisme, ses parts. */
  Store.state.budget.fixedCharges.splice(cible.i, 1);
  Store.save(); render();
  toast(`${guill(nom)} ${trad('retiré du budget')}`, porteDeSortie());
}

function focusLast(listPath, field) {
  const list = getPath(listPath) || [];
  const el = $(`[data-path="${CSS.escape(`${listPath}.${list.length - 1}.${field}`)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'nearest' });
  el.focus();
  el.select?.();
}

function makeDeleter(listKey, what, nameOf) {
  return async function (btn) {
    const i = +btn.dataset.i;
    const list = Store.state.budget[listKey];
    const item = list[i];
    if (!item) return;
    const nom = String(nameOf(item) || '').trim();
    const suites = [];
    const bien = item.bienId ? compteById(item.bienId) : null;
    if (bien) {
      suites.push(`${trad('Le cash-flow et le rendement de')} ${guill(nomCompteV2(bien))} ${
        trad('ne la compteront plus.')}`);
    }
    if (item.creditId) {
      const cr = creditsEnCours().lignes.find(x => x.id === item.creditId);
      if (cr) {
        suites.push(`${guill(cr.libelle)} ${trad('n’aura plus de mensualité : sa date de fin '
          + 'et la part de capital de chaque échéance cesseront de se calculer.')}`);
      }
    }
    if (!await askConfirm(`${trad('Supprimer')} ${what}${nom ? ` ${guill(nom)}` : trad(', qui n’a pas de nom')} ?\n\n`
      + (suites.length ? `${suites.join(' ')}\n\n` : '')
      + trad("Cette action est réversible avec Ctrl+Z, et une sauvegarde du jour existe dans l'onglet Données."))) return;
    list.splice(i, 1);
    Store.save(); render(); toast(trad('Ligne supprimée'));
  };
}

/* Les credits proposables au rattachement d'une charge fixe.

   Hors de l'objet ACTIONS : ce n'est pas une action, et une declaration `const`
   dans un litteral d'objet ne se parse pas — le fichier entier tombait.

   Un credit deja rembourse par une autre charge n'y figure pas : deux charges sur
   le meme credit doubleraient la mensualite lue, et la premiere trouvee
   gagnerait sans qu'on sache laquelle. Celui de la charge en cours d'edition, lui,
   reste dans la liste : sinon la modifier le detacherait. */
function optionsBiens() {
  return [['', trad('aucun, ce n’est pas lié à un bien')],
    ...comptesBiens().map(c => [c.id, nomCompteV2(c)])];
}

/* `type` : le type du compte qui porte la ligne, pas seulement sa classe. */
const EXEMPLE_PLACEMENT = {
  actions:     'ex. ETF MSCI World',
  garanti:     'ex. Fonds euros',
  obligations: 'ex. Fonds obligataire',
  liquidites:  'ex. Fonds monétaire',
  immobilier:  'ex. SCPI de rendement',
  nonCote:     'ex. Projet Bordeaux',
  crypto:      'ex. Bitcoin',
};

function champsPlacement(classe, l = null, prete = false, type = null) {
  const echeancier = !!prete;
  /* Quatre notions voisines, et les confondre s'est deja paye : une valeur
     qu'on ESTIME soi-meme (une montre, un appartement), une valeur qu'un tiers
     PUBLIE (la VL d'un fonds), une valeur qu'on RELEVE sur le document d'un
     assureur ou d'un teneur de compte (le fonds en euros d'un contrat mixte),
     et le fait qu'une valeur porte une DATE : vrai des trois cotes, faux pour
     un pret dont le nominal ne bouge pas.

     `estime` et `releve` commandent le nom du montant : "Valeur estimee" pour
     ce qu'on apprecie soi-meme, "Derniere valeur connue" pour ce qu'un releve
     donne et qui date de lui, "Valeur aujourd'hui" pour ce qu'on lit publie.
     Une VL rangee sous "Valeur estimee" aurait fait passer un chiffre publie
     pour une opinion, ce qui est exactement l'inverse de ce qu'il est.

     `datee` commande la presence du champ de date, `publiee` et `releve` son
     nom, `publiee` seul sa cadence. Un seul champ pour les trois natures : la
     date a laquelle ce chiffre a ete etabli. Un second aurait ete deux
     ecritures du meme fait. */
  const publiee = !!(type && type.vl);
  /* `estValeurEstimee` et non `estDetenuEnDirect` : une part de societe se
     valorise soi-meme autant qu'une montre, et c'est deja ce que dit la liste
     des comptes en ecrivant « estimation actuelle » sous son montant. Restreinte
     au direct, la question « depuis quand ce chiffre tient-il ? » ne se posait
     pas la ou elle se pose le plus — une valeur de part vieillit entre deux
     levees, et rien a l'ecran ne disait depuis quand.
     Un seul predicat pour un seul fait : celui qui decide du mot « estimation »
     decide aussi de la date qui l'accompagne. */
  const estime = estValeurEstimee(type);
  /* `releve` : le support saisi d'un contrat mixte, dont la valeur se lit sur
     le releve de l'assureur ou du teneur de compte. Elle se date comme une VL,
     du jour du document. */
  const releve = valeurDeReleve(type);
  const datee = estime || publiee || releve;
  return [
    { cle: 'libelle', label: 'Intitulé', type: 'texte', requis: true, max: NOM_LIGNE_MAX,
      valeur: l ? (l.libelle || '') : '',
      exemple: EXEMPLE_PLACEMENT[classe] || 'ex. Projet Bordeaux' },
    ...(type && type.parts ? [{ cle: 'parts', label: trad('Nombre de parts'),
      type: 'nombre', valeur: l ? (num(l.parts) || '') : '', exemple: '0',
      aide: trad('il se déduit du montant investi, et commande la valeur du jour') }] : []),
    ...(type && type.parts ? [{ cle: 'section_valeur', label: estime ? 'Valeur estimée' : 'Valeur actuelle', type: 'section' }] : []),
    { cle: 'valeur',
      label: `${estime ? 'Valeur estimée' : releve ? 'Dernière valeur connue' : 'Valeur aujourd’hui'} ({dev})`, type: 'nombre',
      valeur: l ? num(l.valeur) : '', exemple: '0',
      aide: estime ? 'ton estimation du jour : ce n’est pas un prix de vente, le produit réel se saisit à la cession'
          : publiee ? 'la dernière valeur liquidative publiée, pour les parts que tu détiens'
          : releve ? 'celle que donne ton dernier relevé de l’assureur ou du teneur de compte : elle date du jour de ce relevé'
                    : 'ce que la ligne vaut, capital et intérêts courus compris',
      /* Le TOTAL reste la donnee stockee, le prix par part n'est qu'une autre
         facon de l'ecrire. Voir le cablage dans `askForm`. */
      ...(type && type.parts
        ? { parPart: 'parts', parPartLabel: 'Prix de la part aujourd’hui ({dev})' } : {}) },
    ...(type && type.parts ? [{ cle: 'section_invest', label: 'Coût d’achat', type: 'section' }] : []),
    { cle: 'prixDeRevient', label: trad('Montant investi ({dev})'), type: 'nombre',
      /* Le COUT EFFECTIF, et non le seul champ legacy : une ligne creee avec
         prix, frais et travaux (un ancien bien de valeur) montrait ici un champ
         vide, et ce qu'on y tapait ne changeait rien — `acquisitionLigne`
         prefere le detail complet. Voir `litPlacement`, qui l'efface alors. */
      valeur: l && coutAcquisition(l) !== null ? coutAcquisition(l) : '', exemple: '0',
      aide: trad('facultatif, il donne la plus-value'),
      ...(type && type.parts
        ? { parPart: 'parts', parPartLabel: 'Prix d’achat de la part ({dev})',
            parPartSous: 'il donne le nombre de parts',
            parPartDeduitParts: true } : {}) },
    { cle: 'dateAcquisition', label: trad('Date d’entrée'), type: 'date',
      valeur: l ? (l.dateAcquisition || '') : todayISO() },
    ...(datee ? [{ cle: 'estimeLe',
      label: trad(publiee ? 'VL du' : releve ? 'Valeur au' : 'Estimée le'), type: 'date',
      valeur: l ? (l.estimeLe || '') : todayISO(),
      /* ELLE NE PROMET PAS LA CLOCHE. Une valeur perimee (`valeurPerimee()`)
         se rappelle dans la carte "A mettre a jour" d'Actifs et avant un
         releve mensuel, jamais dans la cloche : une bulle qui la promettrait
         mentirait, et le mensonge se propagerait a chaque type qu'on ajoute.
         Elle dit donc ce que la date EST : le jour ou ce chiffre a ete etabli,
         ou celui du document qui le donne. */
      aide: trad(publiee ? 'la date de la dernière valeur liquidative publiée'
                 : releve ? 'la date de ce relevé : corrige-la s’il est plus ancien qu’aujourd’hui'
                 : 'le jour où tu as établi ce chiffre') }] : []),
    ...(publiee ? [{ cle: 'vlPeriode', label: trad('Publiée'), type: 'liste',
      options: VL_PERIODES, valeur: l ? (l.vlPeriode || 'trimestre') : 'trimestre',
      aide: trad('à quelle fréquence le fonds publie sa valeur') }] : []),
    ...(echeancier ? [
      { cle: 'taux', label: trad('Taux annoncé (%)'), type: 'nombre',
        valeur: l && estDeclare(l.taux) ? num(l.taux) : '', exemple: '0',
        aide: trad('facultatif, celui du contrat') },
      { cle: 'echeance', label: 'Échéance', type: 'date',
        valeur: l ? (l.echeance || '') : '',
        aide: trad('la date de remboursement prévue') },
      { cle: 'statut', label: trad('Où en est-il ?'), type: 'liste',
        options: Object.entries(STATUTS_LIGNE),
        valeur: l ? statutLigne(l) : 'encours',
        aide: trad('à déclarer : une échéance dépassée ne veut pas dire en retard') },
    ] : []),
    { cle: 'projet', label: trad('Réservé à un projet'), type: 'case',
      valeur: l ? !!l.projet : false,
      aide: trad('cet argent est déjà promis : la projection le porte à plat au lieu de le faire travailler') },
    { cle: 'projetLe', label: trad('Pour quand ?'), type: 'date',
      valeur: l ? (l.projetLe || '') : '',
      aide: trad('facultatif, sans effet sur les calculs') },
  ];
}

partieChargee('assets/app-07-budget-depenses.js');
