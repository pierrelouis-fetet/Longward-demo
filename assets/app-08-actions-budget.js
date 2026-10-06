/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
Object.assign(ACTIONS, {
  'importer-tableau'(btn) {
    importerTableau(btn.dataset.cible === 'releves' ? 'releves' : 'depenses');
  },
  'sort-depenses'(btn) {
    const key = btn.dataset.key;
    depSort = !depSort || depSort.key !== key ? { key, dir: 'desc' }
            : depSort.dir === 'desc' ? { key, dir: 'asc' } : null;
    render();
  },
  'monter-category'(btn) {
    if (deplacerCategorie(btn.dataset.cat, -1)) { Store.save(); render(); }
  },
  'descendre-category'(btn) {
    if (deplacerCategorie(btn.dataset.cat, +1)) { Store.save(); render(); }
  },
  'budget-year'(btn) {
    budgetYear = btn.dataset.year === 'all' ? 'all' : btn.dataset.year;
    render();
  },
  'toggle-revenus'() { if (!Store.state.budget.income.length) return ACTIONS['add-income'](); fenetreRevenus(); },
  'revenu-estime'(el) {
    const r = B().income[+el.dataset.i];
    if (!r) return;
    r.estime = !!el.checked;
    Store.save();
    fenetreRevenus();
    render();
  },
  async 'regler-objectif-depenses'() {
    const actuel = num(Store.state.budget.monthlyTarget);
    const r = await askForm({
      titre: trad('Objectif de dépenses'),
      sous: trad('Ce que tu ne veux pas dépasser sur un mois'),
      champs: [{ cle: 'montant', label: trad('Objectif de dépenses mensuel ({dev})'),
                 type: 'nombre', valeur: actuel || '', exemple: '1000',
                 aide: trad('À l’euro. Laisse vide pour ne pas te fixer d’objectif.') }],
      ok: 'Enregistrer',
    });
    if (!r) return;
    Store.state.budget.monthlyTarget = Math.max(0, num(r.montant));
    Store.save(); render();
    toast(Store.state.budget.monthlyTarget
      ? `${trad('Objectif de dépenses :')} ${fmtEUR0(Store.state.budget.monthlyTarget)} ${trad('par mois')}`
      : trad('Objectif de dépenses retiré'));
  },

  async 'saisir-mois-courant'() {
    const cle = todayISO().slice(0, 7) + '-01';
    let i = Store.state.budget.expenses.findIndex(r => r.month === cle);
    if (i < 0) {
      Store.state.budget.expenses.push({ month: cle, note: '', v: {} });
      Store.state.budget.expenses.sort((a, b) => String(a.month).localeCompare(String(b.month)));
      Store.save();
      i = Store.state.budget.expenses.findIndex(r => r.month === cle);
    }
    return ACTIONS['edit-expense-month']({ dataset: { i: String(i) } });
  },
  async 'saisir-mois-en-attente'() {
    const att = depensesEnAttente();
    let i = att.index;
    if (i < 0) {
      Store.state.budget.expenses.push({ month: att.key, note: '', v: {} });
      Store.state.budget.expenses.sort((a, b) => String(a.month).localeCompare(String(b.month)));
      Store.save();
      i = Store.state.budget.expenses.findIndex(r => r.month === att.key);
    }
    budgetYear = att.key.slice(0, 4);     // sinon la ligne visee resterait filtree
    return ACTIONS['edit-expense-month']({ dataset: { i: String(i) } });
  },
  async 'edit-expense-month'(btn) {
    const i = +btn.dataset.i;
    const saisi = await askExpenseMonth(i);
    if (!saisi) return;
    const r = Store.state.budget.expenses[i];
    ecrireDepensesMois(i, saisi);
    if (saisi.rouvrir) { render(); return ACTIONS['edit-expense-month'](btn); }
    if (saisi.versTableau) {
      budgetYear = String(r.month).slice(0, 4);   // sinon le mois quitté serait filtré
      pendingAnchor = 'detail-mensuel';
      if (currentView() === 'budget') render(); else location.hash = '#/budget';
      return;
    }
    render();
    toast(`${fmtMonth(r.month)} · ${fmtEUR0(expenseRowTotal(r))}`);
  },
  /* LES DEUX ACTES QUI GERAIENT LES PERSONNES ONT DISPARU.

     Une charge fixe vaut ce qui est DEBITE du compte. Ce que quelqu'un reverse
     est une entree, saisie une fois avec le salaire — et c'est le seul endroit
     ou elle doit vivre. Enregistrer sa part ici en plus la comptait deux fois,
     et les deux saisies divergeaient. `budget.contributors` et les `shares`
     restent dans les donnees, sans que rien ne les lise. */

  async 'add-category'() {
    const nom = await askText('Nouvelle catégorie de dépenses',
      'Elle devient une colonne du tableau, vide sur tous les mois.', 'ex. Abonnements');
    if (!nom) return;
    if (!addExpenseCategory(nom)) { toast(trad('Cette catégorie existe déjà')); return; }
    Store.save(); render();
    toast(`${trad('Colonne')} ${guill(nom.trim())} ${trad('ajoutée')}`);
  },
  'retirer-category'(btn) {
    const cat = btn.dataset.cat;
    if (!retirerCategorie(cat)) return;
    Store.save(); render();
    const total = expenseCategoryTotal(cat);
    toast(total
      ? `${guill(cat)} ${trad('quitte la saisie. Ses {v} restent dans l’historique.')
          .replace('{v}', fmtEUR0(total))}`
      : `${guill(cat)} ${trad('quitte la saisie du mois.')}`);
  },
  'reprendre-category'(btn) {
    const cat = btn.dataset.cat;
    if (!reprendreCategorie(cat)) return;
    Store.save(); render();
    toast(`${guill(cat)} ${trad('revient dans la saisie du mois')}`);
  },
  async 'sans-distinction'() {
    const fait = await nePlusDetaillerPartout();
    if (!fait) { render(); return; }
    render();
    toast(`${trad('Une seule case à remplir :')} ${guill(fait.garde)}`);
  },
  'reprendre-detail'() {
    const fait = remettreLeDetail();
    if (!fait.categories && !fait.mois) return;
    render();
    toast(phraseRetourDetail(fait));
  },
  async 'del-category'(btn) {
    const cat = btn.dataset.cat;
    const total = expenseCategoryTotal(cat);
    const mois = Store.state.budget.expenses.filter(r => num(r.v?.[cat])).length;
    if (!await askConfirm(`${trad('Supprimer la catégorie')} ${guill(cat)} ?\n`
      + (total
        ? trad("Elle contient {v} répartis sur {m} mois. Ces montants seront effacés et tes "
             + "totaux baisseront d'autant.")
            .replace('{v}', fmtEUR0(total)).replace('{m}', mois) + '\n\n'
        : trad('Elle est vide, rien ne sera perdu.') + '\n\n')
      + trad('Réversible avec Ctrl+Z.'), { danger: total > 0, ok: 'Supprimer la colonne' })) return;
    Store.addBackup('avant suppression de catégorie');
    removeExpenseCategory(cat);
    Store.save(); render();
    toast(`${trad('Colonne')} ${guill(cat)} ${trad('supprimée')}`);
  },
  /* « add-expense-month » est partie avec son bouton : elle ouvrait douze lignes
     vides pour l'annee suivante, et une annee doit apparaitre quand des donnees
     existent, non parce qu'on a appuye. Les mois se creent a la demande, la ou
     l'on saisit -- « saisir-mois-courant » et « saisir-mois-en-attente » posent
     la ligne du mois vise si le calendrier ne la porte pas.
     Une action sans bouton pour l'appeler est du code mort, et le balayage de
     verification cherche justement les `data-action` qui ne menent a rien. */
  async 'del-expense-month'(btn) {
    const i = +btn.dataset.i, r = Store.state.budget.expenses[i];
    if (!r) return;
    const calendrier = isCalendarMonth(r.month);
    if (!await askConfirm(calendrier
      ? trad('Effacer les dépenses de {m} ?').replace('{m}', fmtMonth(r.month)) + '\n\n'
        + trad("La ligne reste dans le tableau, vide, les douze mois de l'année restent affichés.")
        + '\n\n' + trad('Réversible avec Ctrl+Z.')
      : trad('Supprimer la ligne du {d} des dépenses ?').replace('{d}', fmtDate(r.month))
        + '\n\n' + trad('Réversible avec Ctrl+Z.'))) return;
    if (calendrier) clearMonthRow(r, 'note');
    else Store.state.budget.expenses.splice(i, 1);
    Store.save(); render();
    toast(calendrier ? `${fmtMonth(r.month)} ${trad('vidé')}` : trad('Mois supprimé'));
  },
  async 'ajouter-apport'(btn) {
    const sortie = btn?.dataset.sens === 'sortie';
    const v = await askForm({
      titre: sortie ? 'Dépense exceptionnelle' : 'Entrée exceptionnelle',
      sous: sortie
        ? 'De l’argent parti une fois : une voiture, des travaux, un voyage'
        : 'De l’argent reçu une fois : héritage, prime, vente d’un bien',
      champs: [
        { cle: 'libelle', label: trad('De quoi s’agit-il ?'), type: 'texte', requis: true,
          exemple: sortie ? 'ex. Voiture' : 'ex. Succession' },
        { cle: 'montant', label: sortie ? 'Montant dépensé ({dev})' : 'Montant reçu ({dev})',
          type: 'nombre', requis: true, exemple: '0' },
        { cle: 'date', label: 'Date', type: 'date', valeur: todayISO(),
          requis: true, mois: true,
          aide: sortie ? 'elle situe la dépense dans ton historique'
                       : 'elle situe l’entrée dans ton historique' },
        { cle: 'note', label: 'Note', type: 'texte', exemple: trad('facultatif') },
      ],
    });
    if (!v) return;
    const montant = sortie ? -Math.abs(num(v.montant)) : Math.abs(num(v.montant));
    APPORTS().push({ id: 'a' + Date.now().toString(36), libelle: v.libelle,
      montant, date: v.date || todayISO(), note: v.note || '' });
    Store.save(); render();
    toast(`${guill(v.libelle)} · ${fmtSigned(montant)}`);
  },

  async 'editer-apport'(btn) {
    const i = +btn.dataset.i;
    const a = APPORTS()[i];
    if (!a) return;
    const etaitSortie = num(a.montant) < 0;
    const v = await askForm({
      titre: a.libelle || (etaitSortie ? 'Dépense exceptionnelle' : 'Entrée exceptionnelle'),
      sous: trad('Ces montants ne bougent aucun solde : ils disent d’où vient l’argent, ou où il est parti'),
      ok: 'Enregistrer',
      champs: [
        { cle: 'libelle', label: trad('De quoi s’agit-il ?'), type: 'texte', requis: true,
          valeur: a.libelle || '' },
        { cle: 'sens', label: 'Nature', type: 'liste',
          options: [['entree', 'Entrée, de l’argent reçu'], ['sortie', 'Dépense, de l’argent parti']],
          valeur: etaitSortie ? 'sortie' : 'entree' },
        { cle: 'montant', label: trad('Montant ({dev})'), type: 'nombre', requis: true,
          valeur: Math.abs(num(a.montant)) },
        { cle: 'date', label: 'Date', type: 'date', requis: true, mois: true,
          valeur: a.date || '' },
        { cle: 'note', label: 'Note', type: 'texte', valeur: a.note || '' },
        { cle: 'supprimer', label: trad('Supprimer cette ligne'), type: 'case',
          aide: trad('La ligne disparaît en validant. Réversible avec Ctrl+Z') },
      ],
    });
    if (!v) return;
    if (v.supprimer) {
      APPORTS().splice(i, 1);
      Store.save(); render();
      toast(`${guill(a.libelle)} ${trad('retirée du journal')}`);
      return;
    }
    a.libelle = v.libelle;
    a.montant = v.sens === 'sortie' ? -Math.abs(num(v.montant)) : Math.abs(num(v.montant));
    a.date = v.date || a.date; a.note = v.note || '';
    Store.save(); render();
    toast(`${guill(a.libelle)} · ${fmtSigned(a.montant)}`);
  },

  /* On en saisit rarement une seule. Depuis que le tableau passe par la fenetre,
     poser dix charges demandait dix allers-retours par « + Ligne » : le bouton
     d'enchainement enregistre et rouvre une fenetre vide, curseur sur le poste.

     La boucle vit ici et non dans `askForm` parce que c'est ici qu'on sait quoi
     recalculer entre deux saisies : les credits deja rattaches changent des que
     la charge precedente en prend un, et `creditsRattachables()` les ecarte. Une
     boucle generique aurait resservi la liste d'avant. */
  async 'add-charge'() {
    if (!await devisePosee()) return;
    for (;;) {
      const v = await askForm({
        titre: trad('Nouvelle charge fixe'),
        sous: trad('Le montant se saisit tel qu’il est facturé, le budget ramène au mois'),
        encore: 'Enregistrer et en ajouter une autre',
        champs: [
          { cle: 'label', label: 'Poste', type: 'texte', requis: true, exemple: 'ex. Assurance habitation' },
          { cle: 'amount', label: 'Montant', type: 'nombre', exemple: '0' },
          { cle: 'period', label: 'Facturé', type: 'liste', options: CHARGE_PERIODES, valeur: 'mois' },
          { cle: 'echeanceLe', label: trad('Prochaine échéance'), type: 'date',
            aide: trad('une échéance, passée ou à venir : les suivantes se déduisent de la périodicité') },
          { cle: 'provider', label: 'Organisme', type: 'texte', exemple: 'ex. Mon assureur',
            suggestions: valeursConnues('organisme') },
          ...(creditsEnCours().lignes.length ? [{ cle: 'creditId', type: 'liste',
            label: trad('Rembourse un crédit ?'), options: creditsRattachables(), valeur: '',
            aide: trad('la mensualité servira alors à suivre le capital restant dû') }] : []),
          ...(comptesBiens().length ? [{ cle: 'bienId', type: 'liste',
            label: trad('Charge d’un bien immobilier ?'), options: optionsBiens(), valeur: '',
            aide: trad('taxe foncière, copropriété, assurance PNO : elle entrera dans le ')
                + 'cash-flow du bien' }] : []),
          ...champsPartage(null),
        ],
        valide: v => validerPartsSaisies(v, v.amount, contributors().map(g => g.id)),
      });
      if (!v) return;
      const posee = {
        label: v.label, amount: v.amount, period: v.period, provider: v.provider, shares: {},
        echeanceLe: v.echeanceLe || '',
        creditId: v.creditId || null, bienId: v.bienId || null,
      };
      ecrirePartsSaisies(posee, v, contributors().map(g => g.id));
      Store.state.budget.fixedCharges.push(posee);
      Store.save(); render();
      toast(`${guill(v.label)} ${trad('ajoutée')} · ${fmtEUR(chargeMensuelle({ amount: v.amount, period: v.period }))} ${trad('/ mois')}`);
      if (!v.__encore) return;
    }
  },
  'del-charge': makeDeleter('fixedCharges', 'la charge fixe', c => c.label),

  async 'edit-charge'(btn) {
    const i = +btn.dataset.i;
    const c = Store.state.budget.fixedCharges[i];
    if (!c) return;
    const v = await askForm({
      titre: c.label || 'Charge fixe',
      sous: chargePeriode(c) === 'mois'
        ? 'Le montant se saisit tel qu’il est facturé'
        : trad('Facturée {p}, soit {v} par mois dans le budget')
            .replace('{p}', trad(CHARGE_PERIODE_LABEL[chargePeriode(c)]))
            .replace('{v}', fmtEUR(chargeMensuelle(c))),
      ok: 'Enregistrer',
      champs: [
        { cle: 'label', label: 'Poste', type: 'texte', requis: true, max: NOM_LIGNE_MAX, valeur: c.label },
        { cle: 'amount', label: 'Montant', type: 'nombre', valeur: num(c.amount) },
        { cle: 'period', label: 'Facturé', type: 'liste', options: CHARGE_PERIODES, valeur: chargePeriode(c) },
        { cle: 'echeanceLe', label: trad('Prochaine échéance'), type: 'date',
          valeur: c.echeanceLe || '',
          aide: trad('une échéance, passée ou à venir : les suivantes se déduisent de la périodicité') },
        { cle: 'provider', label: 'Organisme', type: 'texte', valeur: c.provider || '',
          suggestions: valeursConnues('organisme') },
        ...(creditsEnCours().lignes.length || c.creditId ? [{ cle: 'creditId', type: 'liste',
          label: trad('Rembourse un crédit ?'), options: creditsRattachables(c.creditId),
          valeur: c.creditId || '',
          aide: trad('la mensualité servira alors à suivre le capital restant dû') }] : []),
        ...(comptesBiens().length || c.bienId ? [{ cle: 'bienId', type: 'liste',
          label: trad('Charge d’un bien immobilier ?'), options: optionsBiens(),
          valeur: c.bienId || '',
          aide: trad('taxe foncière, copropriété, assurance PNO : elle entrera dans le ')
              + 'cash-flow du bien' }] : []),
        ...champsPartage(c),
        { cle: 'supprimer', label: trad('Supprimer cette charge'), type: 'case',
          aide: trad('La ligne disparaît en validant. Réversible avec Ctrl+Z') },
      ],
      /* `askForm` ne valide pas une ligne qu'on efface : rien a garder sur un
         objet qui part. */
      valide: v => validerPartsSaisies(v, v.amount, contributors().map(g => g.id)),
    });
    if (!v) return;
    if (v.supprimer) {
      Store.state.budget.fixedCharges.splice(i, 1);
      Store.save(); render();
      /* Meme raison que dans `makeDeleter` : sans nom, on ne cite pas un vide. */
      toast(c.label ? `${guill(c.label)} ${trad('supprimée')}` : trad('Charge fixe supprimée'));
      return;
    }
    c.label = v.label; c.amount = v.amount; c.period = v.period; c.provider = v.provider;
    c.echeanceLe = v.echeanceLe || '';
    ecrirePartsSaisies(c, v, contributors().map(g => g.id));
    if (v.creditId !== undefined) c.creditId = v.creditId || null;
    if (v.bienId !== undefined) c.bienId = v.bienId || null;
    Store.save(); render();
    toast(`${guill(c.label)} · ${fmtEUR(chargeMensuelle(c))} ${trad('/ mois')}`);
  },

  async 'ajouter-personne'() {
    const v = await askForm({
      titre: trad('Nouvelle personne'),
      sous: trad('Ses parts servent au suivi de la répartition et ne changent pas ton budget'),
      champs: [
        { cle: 'nom', label: 'Nom', type: 'texte', requis: true, max: NOM_LIGNE_MAX,
          exemple: 'ex. Camille' },
      ],
      valide: v => (contributors().some(g => memeNom(g.name, v.nom))
        ? { cle: 'nom', message: trad('Cette personne est déjà déclarée.') } : null),
    });
    if (!v) return;
    const b = Store.state.budget;
    b.contributors = b.contributors || [];
    b.contributors.push({ id: identifiantPersonne(v.nom), name: v.nom });
    Store.save(); render();
    toast(`${guill(v.nom)} ${trad('entre dans le partage')}`);
  },

  async 'editer-personne'(btn) {
    const id = btn.dataset.id;
    const g = contributors().find(x => x.id === id);
    if (!g) return;
    const p = partsDePersonne(id);
    const v = await askForm({
      titre: g.name,
      sous: p.lignes
        ? trad(p.lignes > 1 ? '{n} charges partagées, {v} par mois de part théorique'
                            : '{n} charge partagée, {v} par mois de part théorique')
            .replace('{n}', p.lignes).replace('{v}', fmtEUR0(p.mensuel))
        : trad('aucune part ne lui est attribuée pour l’instant'),
      ok: 'Enregistrer',
      champs: [
        { cle: 'nom', label: 'Nom', type: 'texte', requis: true, max: NOM_LIGNE_MAX,
          valeur: g.name },
        { cle: 'supprimer', label: trad('Retirer du partage'), type: 'case',
          aide: trad('Ton budget ne bouge pas : une part n’a jamais réduit une charge. Réversible avec Ctrl+Z.') },
        /* La case des parts n'existe que s'il y en a. Elle ne se cache pas quand
           la premiere est decochee : `montreSi` masque l'input d'une case sans
           masquer son intitule, et un libelle orphelin vaut moins qu'une case
           inerte dont le mot dit deja quand elle agit. */
        ...(p.lignes ? [{ cle: 'effacerParts', type: 'case', valeur: true,
          label: trad(p.lignes > 1 ? '… et ses parts sur {n} charges'
                                   : '… et sa part sur {n} charge').replace('{n}', p.lignes),
          aide: trad('décoche pour les garder dans le fichier : plus rien ne les lira, et son identifiant ne sera jamais redonné') }] : []),
      ],
      valide: v => (contributors().some(x => x.id !== id && memeNom(x.name, v.nom))
        ? { cle: 'nom', message: trad('Cette personne est déjà déclarée.') } : null),
    });
    if (!v) return;
    if (v.supprimer) {
      const n = retirerPersonne(id, { effacerParts: !!v.effacerParts });
      Store.save(); render();
      toast(`${guill(g.name)} ${trad('retiré du partage')}${n
        ? ` · ${n} ${trad(n > 1 ? 'parts effacées' : 'part effacée')}` : ''}`,
        porteDeSortie());
      return;
    }
    g.name = v.nom;
    Store.save(); render();
    toast(`${guill(g.name)} ${trad('enregistré')}`);
  },

  async 'add-income'() {
    if (!await devisePosee()) return;
    const v = await askForm({
      titre: trad('Nouvelle source de revenu'),
      sous: trad('Ce qui arrive vraiment sur ton compte : salaire net, loyer encaissé. Les charges que tu déclares à part ne sont pas déduites ici.'),
      champs: [
        { cle: 'label', label: 'Source', type: 'texte', requis: true, exemple: 'ex. Salaire net',
          suggestions: valeursConnues('source') },
        { cle: 'amount', label: trad('Montant ({dev})'), type: 'nombre', exemple: '0' },
        { cle: 'period', label: trad('Période'), type: 'liste',
          options: CHARGE_PERIODES.map(([cle, label]) => [cle, trad(label)]),
          valeur: 'mois' },
        { cle: 'estime', label: trad(' montant estimé'), type: 'case', valeur: false,
          aide: trad('un revenu variable déclaré en moyenne : les écrans qui s’en servent le diront') },
      ],
    });
    if (!v) { rafraichirRevenus(); return; }
    /* `estime` ne s'ecrit que s'il est vrai : un faux pose partout alourdirait
       l'etat sans rien dire de plus que son absence, et c'est deja la convention
       de la case de la liste. La periode, elle, s'ecrit toujours — c'est un
       choix qu'on vient de faire, et `chargePeriode()` retombe sur le mois pour
       tout ce qu'elle ne connait pas. */
    Store.state.budget.income.push({ label: v.label, amount: v.amount,
      period: v.period || 'mois', ...(v.estime ? { estime: true } : {}) });
    Store.save(); render(); rafraichirRevenus();
    toast(`${guill(v.label)} ${trad('ajoutée aux revenus')}`);
  },
  /* Une source de revenu, modifiable depuis ailleurs que la page Budget.

     Elle ne s'editait qu'en place, dans la liste des revenus : un loyer affiche
     sur la fiche de son bien n'avait donc aucune porte, et rien a l'ecran ne
     disait ou aller le corriger. La page Budget garde ses champs en place, c'est
     sa nature — on y saisit en serie. Cette fenetre est la seconde porte sur le
     meme champ, pas un second champ : les deux ecrivent `budget.income[i]`.

     Meme forme que sa jumelle des charges fixes, case de suppression comprise :
     deux fenetres qui font le meme geste sur deux listes voisines n'ont pas de
     raison de se ressembler a moitie. */
  async 'edit-income'(btn) {
    const i = +btn.dataset.i;
    const r = Store.state.budget.income[i];
    if (!r) return;
    const v = await askForm({
      titre: r.label || trad('Source de revenu'),
      sous: chargePeriode(r) === 'mois'
        ? trad('Le montant se saisit tel qu’il est perçu')
        : `${trad('Perçu')} ${trad(CHARGE_PERIODE_LABEL[chargePeriode(r)])}, ${trad('soit')} ${
            fmtEUR(revenuMensuel(r))} ${trad('par mois dans le budget')}`,
      ok: 'Enregistrer',
      champs: [
        { cle: 'label', label: 'Source', type: 'texte', requis: true, max: NOM_LIGNE_MAX,
          valeur: r.label || '', suggestions: valeursConnues('source') },
        { cle: 'amount', label: 'Montant', type: 'nombre', valeur: num(r.amount) },
        { cle: 'period', label: 'Perçu', type: 'liste', options: CHARGE_PERIODES,
          valeur: chargePeriode(r) },
        ...(comptesBiens().length || r.bienId ? [{ cle: 'bienId', type: 'liste',
          label: trad('Loyer d’un bien immobilier ?'), options: optionsBiens(),
          valeur: r.bienId || '',
          aide: trad('il entrera dans le cash-flow et le rendement de ce bien') }] : []),
        { cle: 'estime', label: trad(' montant estimé'), type: 'case', valeur: !!r.estime,
          aide: trad('un revenu variable déclaré en moyenne : les écrans qui s’en servent le diront') },
        { cle: 'supprimer', label: trad('Supprimer cette source'), type: 'case',
          aide: trad('La ligne disparaît en validant. Réversible avec Ctrl+Z') },
      ],
    });
    if (!v) return;
    if (v.supprimer) {
      Store.state.budget.income.splice(i, 1);
      Store.save(); render();
      toast(r.label ? `${guill(r.label)} ${trad('supprimée')}` : trad('Source supprimée'));
      return;
    }
    r.label = v.label; r.amount = num(v.amount); r.period = v.period;
    r.estime = !!v.estime;
    if (v.bienId !== undefined) r.bienId = v.bienId || null;
    Store.save(); render();
    toast(`${guill(r.label)} · ${fmtEUR(revenuMensuel(r))} ${trad('/ mois')}`);
  },

  async 'del-income'(btn) {
    await makeDeleter('income', 'la source de revenu', r => r.label).call(this, btn);
    rafraichirRevenus();
  },
});

partieChargee('assets/app-08-actions-budget.js');
