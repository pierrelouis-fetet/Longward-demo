/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
Object.assign(ACTIONS, {
  async 'charger-demo'() {
    if (modeDemo()) return;
    if (!await askConfirm(trad('Voir la démonstration ?') + '\n\n'
      + trad('Tes données ne sont pas touchées : elles restent enregistrées de leur côté, '
      + 'et tu les retrouves en quittant le mode. Rien ne part en ligne pendant ce temps.'),
      { ok: 'Charger la démonstration' })) return;
    setModeDemo(true);
    Store.state = structuredClone(SEED);
    Store.migrate();
    Store.save();
    render();
    if (estDemoVivante()) demoAJour().mois.then(() => render());
    toast(trad('Démonstration chargée, tes données sont en sécurité'));
  },

  async 'recharger-demo'() {
    if (!demoPerimee()) return;
    if (!await askConfirm(trad('Recharger la démonstration ?') + '\n\n'
      + trad('Les données de démonstration reprennent leur dernière version. Ce que tu as modifié dans la démo est remplacé ; une sauvegarde est prise avant, et elle se restaure depuis Données.'),
      { ok: 'Recharger la démo' })) return;
    Store.addBackup('avant rechargement de la démo');
    rechargerDemo();
    render();
    if (estDemoVivante()) demoAJour().mois.then(() => render());
    toast(trad('Démonstration à jour'));
  },
  'quitter-demo'() {
    if (!modeDemo()) return;
    setModeDemo(false);
    Store.load();
    refreshAccounts();
    render();
    toast(trad('Retour à tes données'));
  },

  /* `effacer-identite` et non `supprimer-compte` : ce dernier existe deja, et il
     supprime un compte BANCAIRE. Deux clefs de meme nom dans cet objet ne se
     signalent pas — la derniere gagne en silence, et le bouton de l'ecran du
     compte appelait la suppression d'une ligne d'actifs. Le mot « compte » est
     pris dans cette application, il faut en choisir un autre. */
  /* La carte se referme sur un geste, jamais sur une condition : voir la note
     de `CLE_DEMARRAGE`. Le bouton n'apparait qu'une fois les quatre pas
     franchis, donc rien ne se perd en la fermant. */
  'fermer-demarrage'() {
    masquerNotif(CLE_DEMARRAGE);
    guideDeplie = false;
    Store.save();
    render();
  },
  'basculer-demarrage'() {
    guideDeplie = !guideDeplie;
    render();
  },

  'deplier-pas'(btn) {
    const cle = btn.dataset.cle;
    pasDeplie = pasDeplie === cle ? null : cle;
    render();
  },

  'declarer-pas'(btn) {
    const cle = btn.dataset.cle;
    if (!cle) return;
    masquerNotif(cle);
    pasDeplie = null;
    Store.save();
    render();
    rendNotifs(); majOnglets();
    toast(trad('Ta liste est déclarée complète'));
  },

  async 'effacer-identite'() {
    const adresse = CloudSync.getUser();
    if (!await askConfirm(trad('Effacer définitivement ton compte ?') + '\n'
      + trad('Ton patrimoine, tes sauvegardes en ligne et ton accès à {a} seront effacés. '
        + 'Cette action ne s’annule pas.').replace('{a}', adresse || '')
      + '\n\n' + trad('Si tu veux garder une copie, annule et passe d’abord par Données.'),
      { ok: 'Effacer mon compte', danger: true })) return;

    let envoi;
    try {
      envoi = await fetch('/api/account/delete-code', { method: 'POST' });
    } catch (e) {
      toast(trad('Suppression impossible : vérifie ta connexion.'));
      return;
    }
    if (!envoi.ok) {
      toast(trad('Suppression impossible pour le moment. Rien n’a été effacé.'));
      return;
    }
    const code = await askText('Confirme avec le code reçu',
      trad('Un code vient d’être envoyé à {a}. Entre-le pour confirmer la suppression.')
        .replace('{a}', adresse || ''), '000000', '', 8);
    if (!code) return;

    let reponse;
    try {
      reponse = await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: String(code).trim() }),
      });
    } catch (e) {
      toast(trad('Suppression impossible : vérifie ta connexion.'));
      return;
    }
    if (reponse.status === 401) {
      toast(trad('Code incorrect ou expiré. Rien n’a été effacé.'));
      return;
    }
    if (!reponse.ok) {
      toast(trad('Suppression impossible pour le moment. Rien n’a été effacé.'));
      return;
    }
    const scope = CloudSync.getUserId();
    if (scope) {
      const suffixe = `:user:${scope}`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const cle = localStorage.key(i);
        if (cle?.endsWith(suffixe)) localStorage.removeItem(cle);
      }
    }
    location.replace('/');
  },

  async 'start-blank'() {
    if (!await askConfirm(trad('Réinitialiser Longward ?') + '\n'
      + trad('Toutes les données actuelles seront effacées : {p} positions, {c} comptes, '
        + '{m} mois de relevés, le budget et les dépenses.')
        .replace('{p}', Store.state.positions.length)
        .replace('{c}', ACCOUNTS.length)
        .replace('{m}', Store.state.monthly.filter(r => !rowIsEmpty(r)).length)
      + '\n\n' + trad('Une sauvegarde est prise avant, et Ctrl+Z annule.') + phraseCopieEnLigne(),
      { ok: 'Tout effacer', danger: true })) return;

    Store.addBackup('avant remise à zéro');
    Store.state = blankState();
    Store.migrate();
    Store.save();
    render();
    toast(trad('Tableau de bord vierge, à toi de le remplir'));
  },
  async 'cloud-push'(btn) {
    /* Le bouton dit qu'il travaille et ne se reclique pas : un second appui
       pendant l'envoi lancerait un second `PUT`. Le rendu qui suit le remplace. */
    if (btn) { btn.disabled = true; btn.classList.add('en-cours'); btn.setAttribute('aria-label', trad('Synchronisation…')); }
    const r = await CloudSync.push({ force: false });
    render();
    toast(r.ok ? trad('Envoyé en ligne') : r.skipped ? trad('Déjà à jour') : r.conflict ? trad('Conflit détecté') : trad('Échec'));
  },
  async 'cloud-force'() {
    if (!await askConfirm(trad('Imposer les données de cet appareil ?') + '\n\n' + trad('La version en ligne, plus récente, sera remplacée.'))) return;
    const r = await CloudSync.push({ force: true });
    render(); toast(r.ok ? trad('Version imposée') : trad('Échec'));
  },
  async 'cloud-pull'() {
    try {
      const data = await CloudSync.pull();
      if (!data) { toast(trad('Rien en ligne')); return; }
      const at = data.meta?.savedAt;
      if (!await askConfirm(trad('Recharger les données depuis le cloud ?') + '\n\n'
        + `${trad('En ligne :')} ${at ? new Date(at).toLocaleString(locale()) : trad('inconnue')}\n`
        + `${trad('Ici :')} ${new Date(Store.state.meta.savedAt || Date.now()).toLocaleString(locale())}\n\n`
        + trad("L'état actuel sera sauvegardé avant remplacement."))) return;
      const ecrit = Store.adopterVersionEnLigne(data, at, 'avant rechargement cloud');
      render();
      if (ecrit) toast(trad('Données rechargées'));
    } catch (e) { toast(trad('Échec :') + ' ' + e.message); }
  },
  'make-backup'() {
    Store.addBackup('manuelle') ? toast(trad('Sauvegarde créée')) : toast(trad('Sauvegarde impossible (stockage plein)'));
    render();
  },
  async 'restore-backup'(btn) {
    const i = +btn.dataset.i, b = Store.backups()[i];
    if (!b) return;
    if (!await askConfirm(trad('Restaurer la sauvegarde du {d} ?').replace('{d}',
        new Date(b.at).toLocaleString(locale(), { dateStyle: 'long', timeStyle: 'short' }))
      + '\n\n' + trad("L'état actuel sera d'abord sauvegardé, tu pourras donc revenir en arrière.") + phraseCopieEnLigne())) return;
    Store.restoreBackup(i);
    render(); toast(trad('Sauvegarde restaurée'));
  },
  'undo'() {
    if (!Store.undo()) { toast(trad('Rien à annuler')); return; }
    render(); toast(trad('Modification annulée'));
  },
  async 'telecharger-illisible'() {
    const brut = Store.texteIllisible();
    if (brut === null) { toast(trad('Échec')); return; }
    download(`longward-illisible-${stamp()}.json`, brut, 'text/plain');
    const illisible = Store.illisibleActif();
    if (illisible && !illisible.garde) {
      if (!await askConfirm(trad('Le fichier est-il bien enregistré ? Longward écrira ensuite de nouveau sur cet appareil, par-dessus la copie illisible.'),
        { ok: 'Oui, reprendre', danger: false })) return;
      Store.oublierIllisible();
      Store.save();
    }
    render();
  },
  async 'supprimer-illisible'() {
    if (!await askConfirm(trad('Supprimer la copie illisible de cet appareil ?') + '\n\n'
      + trad('Télécharge-la d’abord si tu veux la garder : cette suppression ne s’annule pas.'),
      { ok: 'Supprimer', danger: true })) return;
    Store.oublierIllisible();
    render();
  },
  'export-json'() {
    download(`longward-${stamp()}.json`, JSON.stringify(Store.state, null, 2));
    toast(trad('Sauvegarde exportée'));
  },
  'export-xlsx-positions'() {
    Xlsx.save(`positions-${stamp()}.xlsx`, [sheetPositions()]);
    toast(trad('Positions exportées en Excel'));
  },
  'export-xlsx-all'() {
    const feuilles = [
      sheetPositions(), sheetAllocation(), sheetRebalance(), sheetRoles(),
      ...(rebalanceRoles().base ? [sheetRoleComposition()] : []),
      sheetAccounts(), sheetHistory(),
      ...((Store.state.sales || []).length ? [sheetSales()] : []),
      sheetExpenses(),
      ...(apportsTries().length ? [sheetApports()] : []),
      sheetFixedCharges(),
    ];
    Xlsx.save(`longward-${stamp()}.xlsx`, feuilles);
    toast(`${trad('Classeur Excel exporté,')} ${feuilles.length} ${trad('feuilles')}`);
  },
  async 'reset'() {
    if (!await askConfirm(trad("Revenir aux données d'origine importées du Google Sheet ?") + '\n\n'
      + trad("Toutes tes modifications locales seront perdues. Exporte d'abord une sauvegarde si besoin."))) return;
    Store.reset(); render(); toast(trad('Données réinitialisées'));
  },
  async 'wipe'() {
    if (!await askConfirm(trad('Effacer TOUTES les données de ce tableau de bord dans ce navigateur ?') + '\n\n' + trad('Irréversible.'))) return;
    if (!await askConfirm(trad('Dernière confirmation : tout effacer ?'))) return;
    /* `cleStockage()` et non `STORAGE_KEY` : la demonstration ecrit sous une
       clef a elle, pour qu'un visiteur qui remet tout a zero ne touche pas les
       donnees d'un tableau de bord reel ouvert dans le meme navigateur. */
    try { localStorage.removeItem(cleStockage()); } catch (e) {}
    /* La graine passe par la migration, comme partout ailleurs ou elle sert.
       Elle est ecrite dans l'ancien modele, un compte par ligne de releve :
       c'est la migration qui en tire les etablissements, les comptes et leurs
       poches. Posee telle quelle, elle rendait un etat a moitie construit —
       `comptes` absent, et tout ce qui en descend a zero. L'ecran affichait
       donc 0 EUR sur huit cartes apres un effacement, et le premier
       enregistrement figeait cet etat vide pour les visites suivantes. */
    Store.state = structuredClone(SEED);
    Store.migrate();
    refreshAccounts();
    render(); toast(trad('Données effacées'));
    if (estDemoVivante()) demoAJour().mois.then(() => render());
  },
});

partieChargee('assets/app-08-actions-donnees.js');
