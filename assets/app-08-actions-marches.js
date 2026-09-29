/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
Object.assign(ACTIONS, {
  'sales-range'(btn) {
    const v = String(btn.dataset.range ?? btn.dataset.year ?? btn.value ?? '');
    if (v !== 'all' && !estAnnee(v)) return;
    salesRange = v;
    render();
  },
  async 'del-sale'(btn) {
    const i = +btn.dataset.i;
    const v = Store.state.sales[i];
    if (!v) return;
    if (v.declaree) {
      if (!await askConfirm(`${trad('Retirer')} ${guill(v.name)} ${trad('du journal ?')}\n\n`
        + trad("Cette vente était déclarée pour mémoire : elle n'avait rien écrit "
        + "d'autre, il n'y a rien à défaire. Réversible avec Ctrl+Z."),
        { ok: 'Retirer du journal', danger: true })) return;
      const avant = structuredClone(Store.state);
      const r = annulerVente(i);
      if (!r || r.erreur) { toast((r && r.erreur) || trad('Rien n’a été modifié.')); return; }
      Store.addBackup('avant retrait d’une vente déclarée', avant);
      fermerApercuSi('vente');
      Store.save(); render();
      toast(trad('Vente retirée du journal'));
      return;
    }
    const refus = verifierAnnulation(i);
    if (refus) { toast(refus); return; }
    const ou = v.cashAccount ? ACC[v.cashAccount]?.label || compteById(v.cashAccount)
      && nomCompteV2(compteById(v.cashAccount)) || 'le cash' : null;
    if (!await askConfirm(trad('Annuler cette vente ?') + '\n'
      + `${v.name}, ${num(v.qty)} × ${fmtCur(num(v.price), v.currency)}, ${fmtSigned(v.realised)}.\n\n`
      + trad('Les {n} titres reviennent sur leur ligne').replace('{n}', num(v.qty))
      + (ou ? ` ${trad('et {m} repartent de {ou}').replace('{m}', fmtEUR(num(v.gross))).replace('{ou}', ou)}` : '')
      + `, ${trad('et la vente quitte le journal.')}\n\n`
      + trad("Le total ne revient pas forcément à l'euro d'avant : les titres rendus valent le "
      + 'cours du jour. Réversible avec Ctrl+Z.'), { ok: 'Annuler la vente', danger: true })) return;
    const avant = structuredClone(Store.state);
    const r = annulerVente(i);
    if (!r || r.erreur) { toast((r && r.erreur) || trad('Rien n’a été modifié.')); return; }
    Store.addBackup('avant annulation de vente', avant);
    fermerApercuSi('vente');
    refreshAccounts();
    Store.save(); render();
    toast(`${trad('Vente annulée,')} ${num(v.qty)} ${trad('titres rendus')}`);
  },
  async 'sell-position'() {
    const v = await askSale();
    if (!v) return;
    if (v.passee) {
      const d = declarerVente(v);
      if (d.erreur) { toast(d.erreur); return; }
      Store.save(); render();
      toast(`${guill(v.name)} ${trad('ajoutée au journal')} · ${fmtSigned(num(v.realised))}`);
      return;
    }
    const avant = structuredClone(Store.state);
    const a = sellPosition(v);
    if (!a || a.erreur) { toast((a && a.erreur) || trad('Vente impossible')); return; }
    Store.addBackup('avant vente', avant);
    Store.save(); render();
    const ou = v.cashAccount
      ? ` · ${trad('encaissé sur')} ${ACC[v.cashAccount]?.label || trad('le cash')}` : '';
    toast(a.realised == null ? `${trad('Vente enregistrée')} · ${trad('Résultat non calculable : prix de revient non renseigné')}${ou}`
      : `${a.realised >= 0 ? trad('Plus-value') : trad('Moins-value')} ${trad('de')} ${fmtSigned(a.realised)}${ou}`);
  },
  /* Ajouter une ligne : un seul chemin, et c'est la recherche.

     Deux surfaces pour un seul travail, c'est le defaut que ce projet defait
     partout ailleurs : on ne les met pas cote a cote, on en garde une. Le bouton
     ouvre donc la recherche, et la saisie a la main reste au pied de cette
     carte, pour un titre sans ISIN ou cote nulle part.

     Le drapeau plutot qu'un `requestAnimationFrame` : changer de vue passe par
     `hashchange`, donc le champ n'existe pas encore au retour de cette
     fonction. `render()` le consomme quand la carte est posee. */
  'ajouter-ligne'(btn) {
    compteVisePourAjout = btn?.dataset.compte || null;
    ouvrirRechercheApresRendu = true;
    if (location.hash.startsWith('#/positions')) render();
    else location.hash = '#/positions';
  },

  async 'add-position'() {
    const v = await askForm({
      titre: trad('Nouvelle ligne de titres'),
      sous: trad('L’ISIN suffit : le symbole et le cours se remplissent à la prochaine actualisation'),
      lie: { de: 'assetClass', vers: 'account', options: comptesPourListe,
             vide: 'aucun compte ne peut porter cette classe' },
      champs: [
        { cle: 'name', label: 'Nom', type: 'texte', requis: true, max: NOM_LIGNE_MAX,
          exemple: 'ex. MSCI World',
          aide: trad('{n} caractères au plus : ce nom se lit dans une colonne de tableau. '
            + 'Le nom officiel du titre reste sur sa fiche').replace('{n}', NOM_LIGNE_MAX) },
        { cle: 'isin', label: 'ISIN', type: 'texte', exemple: 'ex. IE000OJ5TQP4',
          aide: trad('douze caractères, laisse vide si tu saisis le cours à la main') },
        { cle: 'assetClass', label: trad('Classe d’actif'), type: 'liste', options: OPTIONS_CLASSE, valeur: 'actions' },
        { cle: 'role', label: 'Rôle', type: 'liste', options: OPTIONS_ROLE, valeur: 'satellite',
          aide: trad('coeur de portefeuille ou pari satellite') },
        /* `nomCompte()` rend un champ de renommage, pas un libelle : dans une
           liste deroulante il s'afficherait comme du HTML brut. */
        { cle: 'account', label: 'Compte', type: 'liste', options: comptesPourListe('ETF'),
          valeur: defaultHoldingAccount(), aide: trad('limité aux comptes compatibles') },
        { cle: 'qty', label: 'Quantité', type: 'nombre', exemple: '0' },
        { cle: 'buyPrice', label: trad('Prix de revient unitaire'), type: 'nombre', exemple: '0' },
        { cle: 'currency', label: 'Devise', type: 'liste', options: CURRENCIES.map(c => [c, c]), valeur: 'EUR' },
        { cle: 'dateAchat', label: trad('Date d’achat'), type: 'date', valeur: todayISO(),
          aide: DATE_ACHAT_AIDE },
        { cle: 'manual', label: trad('Valeur saisie à la main'), type: 'case',
          aide: trad('coche si aucun cours ne peut être récupéré') },
      ],
    });
    if (!v) return;
    if (!v.account) { toast(trad('Ouvre d’abord un compte qui accepte cette catégorie')); return; }
    const isin = v.isin.toUpperCase();
    if (isin && !isinIsValid(isin)) toast(trad('ISIN accepté, mais sa clé de contrôle est incorrecte'));
    Store.state.positions.push({
      id: 'p' + Date.now(), name: v.name, isin, symbol: '', currency: v.currency,
      qty: v.qty, buyPrice: v.buyPrice, price: 0, fx: 1,
      assetClass: v.assetClass, role: v.role, account: v.account, manual: v.manual,
      dateAchat: v.dateAchat || '',
    });
    Store.save(); render();
    toast(`${guill(v.name)} ${trad('ajoutée')}`);
  },
  'marches-editer'() {
    marchesEdition = true;
    marchesFocus = { titre: true };
    retourHautDemande = true;
    render(); retourHaptique();
  },
  'marches-terminer'() {
    marchesEdition = false;
    retourHautDemande = true;
    render(); retourHaptique();
    $('.sous-onglets button.on')?.focus({ preventScroll: true });
  },
  'marches-monter'(btn) { deplacerSurMarches(btn.dataset.carte, -1); },
  'marches-descendre'(btn) { deplacerSurMarches(btn.dataset.carte, 1); },
  'marches-visibilite'(btn) {
    const id = btn.dataset.carte;
    if (!basculerCarteMarches(id)) return;
    Store.save();
    marchesAnnonce = trad(dispositionMarches().masquees.includes(id) ? '{c}, carte masquée' : '{c}, carte affichée')
      .replace('{c}', NOMS_CARTES_MARCHES[id]());
    marchesFocus = { carte: id, action: 'marches-visibilite' };
    render(); retourHaptique();
  },
  'marches-retablir'() {
    retablirDispositionMarches();
    Store.save();
    marchesAnnonce = trad('Disposition par défaut rétablie');
    marchesFocus = { titre: true };
    retourHautDemande = true;
    render(); retourHaptique();
  },
  async 'achat-noter'() {
    const v = await askForm({
      titre: trad('Noter un achat passé'),
      sous: trad('Pour mémoire : cet achat ne modifie ni les titres, ni le prix de revient, ni les espèces.'),
      ok: 'Enregistrer', champs: champsAchat(), valide: erreurAchat,
    });
    if (!v) return;
    const r = declarerAchat(v);
    if (r.erreur) { toast(r.erreur); return; }
    Store.save(); render();
    toast(`${guill(r.achat.name)} ${trad('ajouté au journal')}`);
  },
  async 'achat-modifier'(btn) {
    const id = btn.dataset.i;
    const a = (Store.state.purchases || []).find(x => x.id === id);
    if (!a) return;
    const v = await askForm({
      titre: trad('Modifier cet achat'),
      sous: trad('Pour mémoire : cet achat ne modifie ni les titres, ni le prix de revient, ni les espèces.'),
      ok: 'Enregistrer', valide: erreurAchat,
      champs: [...champsAchat(a),
        { cle: 'supprimer', label: trad('Retirer cet achat du journal'), type: 'case',
          aide: trad('L’achat disparaît du journal en validant. Rien d’autre ne bouge.') }],
    });
    if (!v) return;
    if (v.supprimer) {
      if (!await askConfirm(`${trad('Retirer cet achat du journal ?')}\n\n${a.name}, ${fmtDate(a.date)}`,
        { ok: 'Retirer du journal', danger: true })) return;
      Store.addBackup('avant retrait d’un achat du journal');
      retirerAchat(id);
      Store.save(); render();
      toast(trad('Achat retiré du journal'));
      return;
    }
    const r = modifierAchat(id, v);
    if (r.erreur) { toast(r.erreur); return; }
    Store.save(); render();
    toast(`${guill(r.achat.name)} ${trad('modifié')}`);
  },
  'filtrer-role'(btn) { posRole = btn.dataset.role; render(); },
  /* Deux routeurs de `change` visent ce selecteur — le generique, et celui des
     `select.annee` dont il porte la classe pour l'habillage et la garde des
     16 px. Le second appel arrive avec la meme valeur : on ne re-rend pas. */
  'filtrer-compte-titres'(sel) {
    const v = sel?.value ?? sel?.dataset?.year;
    if (v == null || v === posCompte) return;
    posCompte = v; render();
  },
  'jour-detail'() {
    const avant = hauteurJourLignes();
    jourDeplie = !jourDeplie;
    render();
    deroulerJour(avant);
  },
  'sort-positions'(th) {
    const key = th.dataset.key;
    const tri = triPositions();
    poserTriPositions(key, tri.key === key && tri.dir === 'desc' ? 'asc' : 'desc');
    render();
  },
  async 'trier-positions'() {
    const tri = triPositions();
    const v = await askOptions({
      titre: trad('Trier les lignes'),
      valeur: tri.key,
      options: TRI_POSITIONS_CHOIX.map(([k, l]) => ({
        v: k, l: trad(l),
        sous: k !== tri.key ? '' : tri.dir === 'desc' ? trad('décroissant') : trad('croissant'),
      })),
    });
    if (v == null) return;
    poserTriPositions(v, v === tri.key && tri.dir === 'desc' ? 'asc' : 'desc');
    render();
  },
  /* Le journal n'a plus de borne propre : elle est celle de la page, et le menu
     des annees a rejoint les crans de la plage. `sales-year` est parti avec. */
  'open-sale'(btn) { openApercu('vente', btn.dataset.i); },
  'tri-ventes'(btn) { triVentes = btn.dataset.tri; render(); },
  'journal-effacer'(btn) {
    const cle = btn.dataset.journal;
    if (!JOURNAUX[cle]) return;
    JOURNAUX[cle].requete = '';
    const champ = document.querySelector(`.journal-filtre-champ[data-journal="${cle}"]`);
    if (champ) { champ.value = ''; champ.focus({ preventScroll: true }); JOURNAUX.focus = cle; }
    remplirJournal(cle);
  },

  async 'edit-sale'(btn) {
    const i = +btn.dataset.i;
    const v = Store.state.sales?.[i];
    if (!v) return;
    const dev = v.currency || 'EUR';
    const saisi = await askForm({
      titre: trad('Modifier la vente'),
      sous: v.declaree ? trad('déclarée, pour mémoire') : `${fmtDate(v.date)} · ${esc(v.name)}`,
      ok: trad('Enregistrer'),
      champs: [
        { cle: 'date', label: 'Date', type: 'date', valeur: v.date,
          aide: trad('elle décide de la période où la vente compte, donc de la barre où elle apparaît') },
        { cle: 'name', label: 'Nom', type: 'texte', valeur: v.name, max: NOM_LIGNE_MAX },
        ...(v.declaree ? [
          { cle: 'gross', label: trad('Produit encaissé ({dev})'), type: 'nombre', valeur: num(v.gross) },
          { cle: 'realised', label: trad('Plus ou moins-value réalisée ({dev})'), type: 'nombre',
            valeur: num(v.realised),
            aide: trad('le prix de revient s’en déduit : produit moins plus-value') },
        ] : [
          { cle: 'lecture_montants', label: trad('Montants'), lecture: true,
            valeur: (num(v.qty) ? `${num(v.qty)} × ${fmtCur(v.price, dev)} = ` : '')
              + `${fmtEUR(num(v.gross))}, ${fmtSigned(v.realised)}`,
            aide: trad('ils ont crédité un compte et réduit une ligne le jour de la vente. Pour les '
              + 'corriger : annuler cette vente, puis la ressaisir, ce qui remet le cash et les titres d’aplomb') },
        ]),
        { cle: 'note', label: 'Note', type: 'texte', valeur: v.note || '' },
      ],
    });
    if (!saisi) return;
    Store.addBackup('avant modification d’une vente');
    v.date = saisi.date || v.date;
    v.name = String(saisi.name || '').trim() || v.name;
    v.note = saisi.note || '';
    if (v.declaree) {
      v.gross = round2(num(saisi.gross));
      v.realised = round2(num(saisi.realised));
      v.invested = round2(v.gross - v.realised);
    }
    Store.save(); render();
    toast(trad('Vente modifiée'));
  },
  async 'open-position'(btn) {
    const i = +btn.dataset.i;
    const suite = await askPosition(i);
    Store.save(); render();
    if (suite && suite.supprimer != null) {
      const p = Store.state.positions[suite.supprimer];
      if (!p) return;
      Store.addBackup('avant suppression de ligne');
      Store.state.positions.splice(suite.supprimer, 1);
      Store.save(); render();
      toast(`${guill(p.name || trad('Ligne'))} ${trad('supprimée')}`);
      return;
    }
    if (suite && suite.vendre != null) {
      const v = await askSale(suite.vendre);
      if (!v) return;
      const avant = structuredClone(Store.state);
      const a = sellPosition(v);
      if (!a || a.erreur) { toast((a && a.erreur) || trad('Vente impossible')); return; }
      Store.addBackup('avant vente', avant);
      Store.save(); render();
      toast(a.realised == null ? `${trad('Vente enregistrée')} · ${trad('Résultat non calculable : prix de revient non renseigné')}`
        : `${a.realised >= 0 ? trad('Plus-value') : trad('Moins-value')} ${trad('de')} ${fmtSigned(a.realised)}`);
    }
    if (suite && suite.acheter != null) {
      const a = await askBuy(suite.acheter);
      if (!a) return;
      const avant = structuredClone(Store.state);
      const r = acheterTitres(a);
      if (r.erreur) { toast(r.erreur); return; }
      Store.addBackup('avant achat', avant);
      const p = Store.state.positions[a.index];
      Store.save(); render();
      const payeur = r.debite ? compteById(a.source.compteId) : null;
      toast(`${a.qty} × ${fmtCur(a.price, p.currency)} · ${trad('nouveau PRU')} ${fmtCur(p.buyPrice, p.currency)}`
        + (payeur ? ` · ${fmtEUR0(r.coutBase)} ${trad('débité de')} ${nomCompteV2(payeur)}` : ''));
    }
  },

  /* « add-supplement » et « del-supplement » sont partis avec la carte
     « Autres depenses ». Une action sans bouton pour l'appeler est du code
     mort, et le balayage de verification cherche justement des `data-action`
     qui ne mènent à rien : autant ne pas lui laisser l'inverse a trouver. */

  /* « add-month » est partie avec le calendrier : elle ouvrait douze lignes
     vides pour l'année suivante, ce qui n'a plus de sens depuis que le journal
     n'affiche que les relevés renseignés — elle n'aurait plus rien ajouté de
     visible. Rien n'en dépendait : `ensureCalendarMonths()` ouvre l'année en
     cours à chaque migration, et « Ajouter un relevé » crée la ligne du mois
     demandé, quelle que soit son année. */
  async 'resolve-row'(btn) {
    const p = Store.state.positions[+btn.dataset.i];
    if (!p) return;
    if (Quotes.isOnline() === null) await Quotes.health();
    if (Quotes.isOnline() === false) {
      toast(trad('Impossible de mettre à jour les cours pour le moment'));
      return;
    }
    if (!isinIsValid(p.isin)) { toast(`${trad('ISIN invalide pour')} ${guill(p.name)}`); return; }
    btn.disabled = true;
    try {
      const r = await Quotes.resolveIsin(p.isin.trim());
      if (r.best && r.best.symbol) {
        p.symbol = r.best.symbol;
        Store.save(); render();
        const champ = document.querySelector(`#modalBody [data-path$=".symbol"]`);
        if (champ) champ.value = r.best.symbol;
        toast(`${p.name} → ${r.best.symbol} (${r.best.exchange})`);
      } else {
        toast(r.error || trad('Aucune cotation trouvée'));
        btn.disabled = false;
      }
    } catch (e) {
      toast(trad('Échec :') + ' ' + e.message);
      btn.disabled = false;
    }
  },
  async 'refresh-quotes'(btn) {
    if (Quotes.isOnline() === null) await Quotes.health();
    if (Quotes.isOnline() === false) {
      toast(trad('Impossible de mettre à jour les cours pour le moment'));
      return;
    }
    const chip = btn && btn.classList.contains('etat-cours');
    const label = btn && !chip ? btn.textContent : null;
    if (btn) { btn.disabled = true; }
    if (chip) majEtatCours('encours');
    else if (btn) btn.textContent = `↻ ${trad('Récupération…')}`;
    try {
      const { changes, empty } = await Quotes.refresh();
      /* Les lignes dont le cours a REELLEMENT bouge, avant le rendu qui les
         affiche. `changes` porte deja le `from` et le `to` de chaque ligne : la
         donnee existait, elle etait jetee. Un rafraichissement qui ne change
         rien n'allume donc rien — c'est ce qui separe « ce chiffre est frais »
         d'un appui sur un bouton. */
      coursFraichis = new Set(changes
        .filter(c => !c.error && Math.abs(num(c.to) - num(c.from)) > 1e-9)
        .map(c => c.symbol));
      Quotes.oublierReperes();
      render();
      if (empty) { toast(trad('Aucun symbole à suivre')); return; }
      const ok = changes.filter(c => !c.error).length;
      const ko = changes.length - ok;
      toast(`${ok} ${trad('cours mis à jour')}${ko ? ` · ${ko} ${trad('en échec')}` : ''}`);
    } catch (e) {
      if (btn) { btn.disabled = false; if (label !== null) btn.textContent = label; }
      majEtatCours();
      toast(trad('Échec :') + ' ' + e.message);
    }
  },
});

partieChargee('assets/app-08-actions-marches.js');
