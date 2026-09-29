/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function litPlacement(v, base, t) {
  const genre = estValeurEstimee(t) ? 'estimation' : 'vl';
  const ligne = {
    ...base,
    libelle: v.libelle,
    valeur: num(v.valeur),
    prixDeRevient: num(v.prixDeRevient) || null,
    dateAcquisition: v.dateAcquisition || '',
    ...(v.parts !== undefined ? { parts: num(v.parts) || null } : {}),
    ...(v.vlPeriode !== undefined ? { vlPeriode: v.vlPeriode || 'trimestre' } : {}),
    ...(v.estimeLe !== undefined ? { estimeLe: dateApresSaisie({
      avant: base.valeur, apres: num(v.valeur),
      dateAvant: base.estimeLe || '', dateSaisie: v.estimeLe || '', genre }) || '' } : {}),
    ...(v.taux !== undefined
      ? { taux: estDeclare(v.taux) ? num(v.taux) : null } : {}),
    ...(v.echeance !== undefined ? { echeance: v.echeance || '' } : {}),
    ...(v.statut !== undefined ? { statut: v.statut || 'encours' } : {}),
    ...(v.projet !== undefined ? { projet: !!v.projet } : {}),
    ...(v.projetLe !== undefined ? { projetLe: v.projetLe || '' } : {}),
  };
  /* Un montant investi tape par-dessus un detail (prix, frais, travaux) le
     remplace : sans ca, `acquisitionLigne` continuait de lire le detail et la
     correction n'existait nulle part. Inchange, le detail reste — un zero
     declare aux trois postes n'est pas un champ vide. */
  const DETAIL = ['prixAchat', 'fraisAcquisition', 'travauxInitiaux'];
  const tape = estDeclare(v.prixDeRevient) ? num(v.prixDeRevient) : null;
  if (DETAIL.some(k => estDeclare(base[k])) && tape !== coutAcquisition(base)) {
    for (const k of DETAIL) delete ligne[k];
  }
  return ligne;
}

function creditsRattachables(sien = null) {
  const pris = new Set(Store.state.budget.fixedCharges
    .map(c => c.creditId).filter(x => x && x !== sien));
  return [['', 'aucun, c’est une charge ordinaire'],
    ...creditsEnCours().lignes.filter(c => !pris.has(c.id))
      .map(c => [c.id, `${c.libelle} · ${c.etabNom} · ${fmtEUR0(c.reste)} ${trad('restant dû')}`])];
}

const ACTIONS = {
  'go-performance'() { location.hash = '#/performance'; },
  'copier'(btn) { copierDansLePressePapiers(btn.dataset.copie); },
  'apercu'(btn) { openApercu(btn.dataset.apercu, btn.dataset.arg); },
  async 'modal-close'() {
    const corps = $('#modalBody');
    if (corps?.dataset.differe === 'sale') {
      const garder = await askConfirm(trad('Modifications non enregistrées') + '\n'
        + trad('Ce panneau porte des montants qui ne sont pas encore dans tes données.'),
        { ok: 'Enregistrer et fermer', refus: 'Fermer sans enregistrer', danger: false });
      if (garder) { appliquerDiffere(); Store.save(); render(); toast(trad('Montants enregistrés')); }
    }
    closeApercu();
  },

  async 'objectif-depart'() {
    if ($('#modalBody')?.dataset.differe === 'sale') { appliquerDiffere(); Store.save(); }
    if (!(num(objectiveStatus().obj) > 0)) return;
    const choix = departsPossibles();
    const actuel = departObjectif();
    const iActuel = actuel ? choix.findIndex(x => x.source === actuel.source && x.date === actuel.date
      && (x.releve || null) === (actuel.releve || null)) : -1;
    const v = await askForm({
      titre: 'Point de départ de l’objectif',
      sous: trad('La barre mesure le chemin entre ce point et ta cible. Un départ passé se prend sur un relevé enregistré.'),
      ok: 'Choisir',
      champs: [{ cle: 'depart', label: trad('Partir de'), type: 'liste', valeur: String(Math.max(0, iActuel)),
        options: choix.map((x, i) => [String(i), x.source === 'jour'
          ? `${trad('Aujourd’hui')} · ${fmtEUR0(x.valeur)}`
          : `${trad('Relevé')} · ${fmtMonth(x.releve)} · ${fmtEUR0(x.valeur)}`]) }],
    });
    if (v) {
      const x = choix[+v.depart];
      if (x) {
        Store.state.meta.objectifDepart = { date: x.date, valeur: x.valeur, source: x.source,
                                            ...(x.releve ? { releve: x.releve } : {}) };
        Store.save(); render();
        toast(`${trad('Point de départ')}${deuxPoints()} ${fmtEUR0(x.valeur)} ${trad('le')} ${fmtDate(x.date)}`);
      }
    }
    openApercu('objectif');
  },
  'apercu-enregistrer'() {
    /* Un capital corrige ici se date par `applyField`, comme partout : c'est le
       montant qui change qui dit qu'on l'a relu. Enregistrer le panneau ne date
       pas les credits qu'on n'a pas touches -- la fenetre d'un credit porte sa
       date de verification, pour confirmer un capital inchange. */
    appliquerDiffere();
    Store.save();
    render();
    if (apercuOuvert) openApercu(apercuOuvert, apercuArg);
    toast(trad('Montants enregistrés'));
  },
  'notifications'() { retourHaptique(); basculeNotifs(); },
  /* Revenir d'où l'on vient, sauf si l'on vient de nulle part : un signet ouvert
     directement n'a pas d'histoire dans l'application, et `history.back()`
     sortirait du site. L'accueil sert alors de sortie. */
  'retour-arriere'() {
    retourHaptique();
    if (navsInternes > 0) history.back(); else location.hash = '#/overview';
  },
  'fermer-notifs'() { fermeNotifs(); },
  'masquer-notif'(btn) {
    masquerNotif(btn.dataset.cle);
    Store.save();
    rendNotifs();
    majOnglets();
    if (currentView() === 'settings') { render(); rafraichirFeuille(); }
    toast(trad('Notification masquée. On la ramène depuis Notifications.'));
  },
  'rendre-notifs'() {
    rendreNotifs();
    Store.save(); render();
    rendNotifs(); majOnglets(); rafraichirFeuille();
    toast(trad('Toutes les notifications sont réaffichées'));
  },
  'reafficher-notif'(btn) {
    Store.state.meta.notifsMasquees = notifsMasquees().filter(c => c !== btn.dataset.cle);
    Store.save(); render();
    rendNotifs(); majOnglets(); rafraichirFeuille();
  },
  'fermer-feuille'() { fermerFeuille(); },
  'alerte-voir'(btn) { fermerFeuille(); closeApercu(); location.hash = '#/' + btn.dataset.view; },
  'alertes-en-cours'() { feuilleAlertesEnCours(); },
  'alertes-masquees'() { feuilleAlertesMasquees(); },
  async 'regl-theme'() {
    const l = LIBELLES_THEME();
    const v = await askOptions({ titre: t('settings.theme'), valeur: themeChoisi(), options: [
      { v: 'system', l: l.system, sous: trad('Suit le réglage de l’appareil') },
      { v: 'light', l: l.light }, { v: 'dark', l: l.dark }] });
    if (v && v !== themeChoisi()) applyTheme(v, true);
  },
  async 'regl-langue'() {
    const v = await askOptions({ titre: t('settings.language'), sous: t('settings.language.hint'), valeur: currentLang(),
      options: LANGS.map(([c, nom]) => ({ v: c, l: nom })) });
    if (v && v !== currentLang()) { setLang(v); location.reload(); }
  },
  'regl-autorefresh'() {
    Store.state.meta.autoRefresh = !Store.state.meta.autoRefresh;
    Store.save(); render(); retourHaptique();
  },
  'regl-retenir'() {
    Store.state.meta.retenirMasquee = !Store.state.meta.retenirMasquee;
    Store.save(); render(); retourHaptique();
  },
  'retenir-plier'() {
    Store.state.meta.retenirReplie = !retenirReplie();
    Store.save(); render(); retourHaptique();
  },
  'apercu-editer'() {
    apercuEdition = true;
    apercuFocus = { titre: true };
    retourHautDemande = true;
    render(); retourHaptique();
  },
  'apercu-terminer'() {
    apercuEdition = false;
    retourHautDemande = true;
    render(); retourHaptique();
    $('.sous-onglets button.on')?.focus({ preventScroll: true });
  },
  'apercu-monter'(btn) { deplacerSurApercu(btn.dataset.carte, -1); },
  'apercu-descendre'(btn) { deplacerSurApercu(btn.dataset.carte, 1); },
  'apercu-visibilite'(btn) {
    const id = btn.dataset.carte;
    if (!basculerCarteApercu(id)) return;
    Store.save();
    apercuAnnonce = trad(dispositionApercu().masquees.includes(id) ? '{c}, carte masquée' : '{c}, carte affichée')
      .replace('{c}', CARTES_APERCU_VUE[id].nom());
    apercuFocus = { carte: id, action: 'apercu-visibilite' };
    render(); retourHaptique();
  },
  'apercu-retablir'() {
    retablirDispositionApercu();
    Store.save();
    apercuAnnonce = trad('Disposition par défaut rétablie');
    apercuFocus = { titre: true };
    retourHautDemande = true;
    render(); retourHaptique();
  },
  async 'retenir-options'() {
    const v = await askOptions({
      titre: trad('Section À retenir'),
      sous: trad('Tu pourras la réafficher depuis Préférences.'),
      options: [{ v: 'masquer', l: trad('Masquer cette section') }],
    });
    if (v !== 'masquer') return;
    Store.state.meta.retenirMasquee = true;
    Store.save(); render(); retourHaptique();
  },
  async 'regl-devise'() {
    const avant = deviseBase();
    const v = await askOptions({
      titre: trad('Devise principale'), sous: trad('Les montants gardent leur format local.'),
      valeur: avant, options: DEVISES_BASE.map(([id, nom]) => ({ v: id, l: trad(nom) })),
    });
    if (v == null || v === avant) return;
    if (aDesMontantsSaisis()) {
      const suite = await askConfirm(
        trad('Changer de devise ne convertit pas tes montants\nTes chiffres restent les mêmes, '
          + 'ils s’affichent simplement dans la nouvelle devise. Longward ne fait aucune conversion de change.')
        + ' ' + trad('Par exemple, 10 000 € deviendra 10 000 $, sans conversion de valeur.'),
        { danger: false, ok: trad('Changer la devise'), refus: trad('Annuler') });
      if (!suite) return;
    }
    Store.state.meta.devise = v;
    Store.save(); render(); retourHaptique();
  },
  async 'regl-place'() {
    const options = [];
    for (const [region, places] of EXCHANGES) places.forEach(([v, l], i) => options.push({ v, l, groupe: i === 0 ? region : '' }));
    const v = await askOptions({ titre: trad('Marché privilégié'), sous: trad('Départage un titre coté sur plusieurs marchés'),
      valeur: Store.state.meta.preferredExchange ?? '.PA', options });
    if (v == null) return;
    Store.state.meta.preferredExchange = v;
    Store.save(); render();
  },
  async 'regl-jour'() {
    const v = await askOptions({ titre: trad('Jour du rappel'), sous: trad('Les saisies mensuelles sont rappelées à partir de cette date.'),
      valeur: jourRappel(), grille: true, options: Array.from({ length: 28 }, (_, i) => ({ v: i + 1, l: String(i + 1) })) });
    if (v == null) return;
    Store.state.meta.jourRappel = Number(v);
    Store.save(); render();
  },
  /* L'interrupteur bascule ce qu'il trouve, il ne recoit plus une valeur.
     C'etait un `data-action-change` sur une liste deroulante, qui lisait
     `sel.value` ; c'est un bouton, et l'etat vit dans les reglages. Lire l'etat
     plutot que le recevoir supprime la question « et si les deux divergent ». */
  'famille-notif'(btn) {
    const cle = btn.dataset.cle;
    const actif = !reglagesNotifs()[cle];
    Store.state.meta.notifsReglages = {
      ...(Store.state.meta.notifsReglages || {}), [cle]: actif };
    Store.save(); render();
    retourHaptique();
    toast(`${actif ? trad('Activé') : trad('Éteint')}${deuxPoints()} ${
      (FAMILLES_NOTIF.find(f => f[0] === cle) || [, cle])[1].toLowerCase()}`);
  },
  /* Une tuile peut viser une carte de la fiche (`data-anchor`) et y poser le
     curseur (`data-focus="1"`) : c'est la porte de la liste « À mettre à
     jour », qui mene au bon compte ET au bon champ. */
  'aller-fiche'(btn) {
    closeApercu();
    pendingAnchor = btn.dataset.anchor || null;
    pendingFocus = btn.dataset.focus === '1';
    location.hash = btn.dataset.route;
  },
  'revoir-tout'(btn) {
    revoirToutOuvert = true;
    const carte = btn.closest('.revoir');
    if (carte) carte.classList.add('ouvert');
    btn.remove();
  },

  'goto'(btn) {
    closeApercu();
    pendingAnchor = btn.dataset.anchor || null;
    const view = btn.dataset.view;
    if (currentView() === view) {
      if (view === 'allocation' && ANCRES_ANGLES[pendingAnchor]) { render(); return; }
      focusAnchor(); return;
    }
    location.hash = '#/' + view;
  },

  /* Les memes deux gestes, dans le panneau des liquidites.

     Ils ne passent pas par `render()` : le panneau porte des champs de saisie,
     et le reconstruire sous les doigts perdrait le focus et la frappe en cours.
     L'etat vit donc dans le DOM du panneau, qui ne survit pas a sa fermeture —
     c'est voulu, une fenetre s'ouvre repliee ou depliee de la meme facon a
     chaque fois, sans se souvenir d'un geste fait la fois d'avant. */
  'apercu-voir-tout'() {
    $('#modalBody').classList.add('tout-voir');
  },

  'history-year'(btn) {
    if (btn.dataset.year === String(historyYear)) return;
    historyYear = btn.dataset.year;
    relanceGraphes = true;
    render();
  },
  'proj-use-budget'() {
    const m = suggestedMonthly();
    Store.state.meta.projMonthly = m;
    Store.save(); render();
    toast(`${trad('Versement mensuel réglé sur')} ${fmtEUR0(m)}`);
  },
  'evo-range'(btn) {
    if (btn.dataset.range === evoRange) return;
    evoRange = btn.dataset.range;
    evoTransition = true;
    render();
  },
  /* Le perimetre de la courbe. Il ne touche a rien d'autre : le grand chiffre,
     la repartition et les autres cartes lisent le patrimoine complet, et c'est
     voulu — voir `evoFinancier`.

     `evo-base` vivait ici, jumeau de `hero-base` : deux commandes pour une seule
     variable. Elle est partie avec la bascule Net / Brut du graphique. */
  'evo-perimetre'(btn) {
    const voulu = btn.dataset.perimetre === 'financier';
    if (voulu === evoFinancier) return;
    evoFinancier = voulu;
    evoTransition = true;
    render();
  },
  'proj-scenario'(btn) {
    /* La case « Personnalise » n'applique rien : elle ouvre le depliant, et
       c'est tout. Lui faire enregistrer `projScenario = 'perso'` aurait fige les
       taux du scenario en cours sous un autre nom, sans qu'un seul chiffre
       change a l'ecran — un etat qui ne veut rien dire, et un pave enfonce que
       l'utilisateur n'a pas choisi. Le preset reconnu reste donc allume jusqu'a
       ce qu'une hypothese bouge vraiment.

       Le depliant ne se referme jamais ici : deja ouvert, il le reste. */
    if (btn.dataset.scenario === 'perso') {
      hypoOuvert = true;
      avanceOuvert = true;
      render();
      /* `nearest` ne bouge la page que si le depliant n'est pas deja visible :
         sur ordinateur il est juste sous les paves, et faire sauter l'ecran pour
         rien serait pire que ne rien faire. */
      $('#hypoAvance')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    Store.state.meta.projScenario = btn.dataset.scenario;
    Store.save(); render();
  },
  /* Le seul commutateur Net / Brut de la page, et il la gouverne entière : le
     grand chiffre, la répartition qui le décompose, et la courbe plus bas. Son
     jumeau `evo-base` vivait sur le graphique, sur la même variable ; il est
     parti, la courbe hérite. */
  'hero-base'(btn) {
    const voulu = !!btn.dataset.net;
    if (voulu === evoNet) return;
    evoNet = voulu;
    evoTransition = true;
    relanceGraphes = true;
    render();
  },
  /* On change d'adresse, pas d'état : `hashchange` déclenche le rendu, et le
     bouton retour du navigateur ramène au sous-onglet précédent. */
  'taire-rappel'(btn) {
    const genre = btn.dataset.genre;
    const p = genre === 'depenses' ? depensesEnAttente() : currentMonthPending();
    masquerRappel(genre, p.key);
    Store.save();
    render();
    toast(`${trad('Rappel de')} ${p.label} ${trad('masqué jusqu’au mois prochain')}`);
  },

  'reporter-rappel'(btn) {
    const genre = btn.dataset.genre;
    const p = genre === 'depenses' ? depensesEnAttente() : currentMonthPending();
    const quand = reporterRappel(genre);
    Store.save();
    render();
    toast(`${trad('Rappel de')} ${p.label} ${trad('repoussé au')} ${fmtJourMois(quand)}`);
  },

  'sous-onglet'(btn) {
    retourHaptique();
    /* Plus de remise a zero ici : `render()` retient une position par vue, et
       sous-onglet compris. La poser a zero avant de router faisait retenir zero
       pour l'onglet qu'on quitte, donc lui faisait perdre sa place. */
    tapeSousOnglets = true;
    location.hash = '#/' + btn.dataset.route;
  },
  /* « proj-extra-clear » est parti avec la ligne libre du tableau « Par
     horizon » : les deux sélecteurs de la page écrivent désormais le même
     réglage, il n'y a plus de ligne surnuméraire à retirer. Une action sans
     bouton pour l'appeler est du code mort, et le balayage de vérification
     cherche justement les `data-action` qui ne mènent à rien. */
  'toggle-masque'() { setMasque(!masqueActif()); render(); },
  'pace-range'(btn) { paceRange = btn.dataset.range; render(); },
};

partieChargee('assets/app-08-actions-apercu.js');
